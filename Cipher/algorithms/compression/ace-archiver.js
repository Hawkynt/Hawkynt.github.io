/*
 * ACE Compression Algorithm
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * ACE is the compression method of Marcel Lemke's WinAce archiver. The "ACE 1.0"
 * method pairs an LZ77 matcher over a sliding dictionary with two Huffman trees
 * rebuilt for every block of at most 32768 tokens.
 *
 * Wire format produced here - a 4-byte little-endian uncompressed length followed
 * by the ACE bit stream:
 *   - each block opens with two Huffman code-length lists, the 284-symbol main
 *     tree first and the 255-symbol length tree second. A list is a 9-bit count
 *     of pre-tree symbols; when that count is zero the list is a single 9-bit
 *     symbol index instead (a tree with at most one used symbol). Otherwise the
 *     count is followed by that many raw 4-bit pre-tree code lengths and then the
 *     code lengths themselves, run-length coded: symbols 0-15 are literal
 *     lengths, 16 repeats the previous length 3-6 times (2 extra bits), 17 skips
 *     3-10 symbols (3 extra bits) and 18 skips 11-138 symbols (7 extra bits)
 *   - main-tree symbols below 256 are literal bytes, 256 ends the block, and
 *     257-283 are match-length slots with bases 2, 3, ... 1032 and 0-8 extra bits
 *   - a match's length slot is followed by a 2-bit distance mode - 0 selects an
 *     explicit distance, 1-3 replay one of the three most recent distances - and,
 *     for mode 0, the distance minus one in as many bits as the dictionary has
 *   - the encoder emits explicit distances only; the decoder honours all four modes
 *
 * Bits are accumulated most-significant-bit first and flushed as 16-bit
 * little-endian words, which is what makes the byte order of an ACE stream look
 * shuffled compared to a byte-at-a-time coder. The dictionary is 32 KiB (15 bits),
 * matches run from 2 to 1032 bytes.
 *
 * Documentation and references:
 *   - https://en.wikipedia.org/wiki/ACE_(compression_format) - overview of the
 *     format, its dictionary range (1 KiB to 4 MiB) and its method numbering
 *   - Huffman, "A Method for the Construction of Minimum-Redundancy Codes", 1952
 *   - Ziv and Lempel, "A Universal Algorithm for Sequential Data Compression", 1977
 *
 * Huffman code lengths come from the shared deterministic builder in
 * huffman-code-lengths.data.js, so the tree shape is a function of the symbol
 * frequencies alone.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes', './huffman-code-lengths.data'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('./huffman-code-lengths.data')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes, root.HuffmanCodeLengths);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, HuffmanCodeLengths) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  if (!HuffmanCodeLengths) {
    throw new Error('HuffmanCodeLengths dependency is required');
  }

  const { RegisterAlgorithm, CategoryType, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== ACE CONSTANTS =====

  const DICT_BITS = 15;                 // 32 KiB dictionary
  const DICT_SIZE = 32768;
  const DICT_MASK = 32767;
  const MAIN_SYMBOLS = 284;             // 256 literals + end-of-block + 27 length slots
  const LEN_SYMBOLS = 255;              // secondary length tree
  const SYMBOL_END_OF_BLOCK = 256;
  const SYMBOL_MATCH_BASE = 257;
  const NUM_REP_OFFSETS = 4;
  const MAX_CODE_LENGTH = 16;
  const BLOCK_SIZE = 32768;             // tokens per block
  const MIN_MATCH = 2;
  const MAX_MATCH = 1032;
  const PRE_TREE_SYMBOLS = 19;

  // Match length bases and extra-bit widths for main-tree symbols 257-283.
  const LENGTH_BASE = [
    2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    12, 14, 16, 20, 24, 32, 40, 56, 72, 104,
    136, 200, 264, 392, 520, 776, 1032
  ];
  const LENGTH_EXTRA = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    1, 1, 2, 2, 3, 3, 4, 4, 5, 5,
    6, 6, 7, 7, 8, 8, 8
  ];

  const HASH_SIZE = 32768;
  const HASH_MASK = 32767;
  const MAX_CHAIN_DEPTH = 128;

  // ===== BIT STREAM (most-significant-bit first, flushed as 16-bit LE words) =====

  class AceBitWriter {
    constructor() {
      this.bytes = [];
      this.buffer = 0;
      this.bitsUsed = 0;
    }

    writeBits(value, count) {
      for (let i = count - 1; i >= 0; --i) {
        this.buffer = OpCodes.Or32(OpCodes.Shl32(this.buffer, 1), OpCodes.And32(OpCodes.Shr32(value, i), 1));
        if (++this.bitsUsed !== 16)
          continue;

        this.bytes.push(OpCodes.And32(this.buffer, 0xFF));
        this.bytes.push(OpCodes.And32(OpCodes.Shr32(this.buffer, 8), 0xFF));
        this.buffer = 0;
        this.bitsUsed = 0;
      }
    }

    toArray() {
      if (this.bitsUsed > 0) {
        this.buffer = OpCodes.Shl32(this.buffer, 16 - this.bitsUsed);
        this.bytes.push(OpCodes.And32(this.buffer, 0xFF));
        this.bytes.push(OpCodes.And32(OpCodes.Shr32(this.buffer, 8), 0xFF));
        this.buffer = 0;
        this.bitsUsed = 0;
      }
      return this.bytes;
    }
  }

  class AceBitReader {
    constructor(data, start) {
      this.data = data;
      this.pos = start;
      this.buffer = 0;
      this.bitsAvailable = 0;
    }

    ensureBits(count) {
      while (this.bitsAvailable < count && this.pos + 1 < this.data.length) {
        const word = OpCodes.Or32(this.data[this.pos], OpCodes.Shl32(this.data[this.pos + 1], 8));
        this.pos += 2;
        this.buffer = OpCodes.Or32(this.buffer, OpCodes.Shl32(word, 16 - this.bitsAvailable));
        this.bitsAvailable += 16;
      }

      if (this.bitsAvailable >= count || this.pos >= this.data.length)
        return;

      this.buffer = OpCodes.Or32(this.buffer, OpCodes.Shl32(this.data[this.pos++], 24 - this.bitsAvailable));
      this.bitsAvailable += 8;
    }

    peekBits(count) {
      this.ensureBits(count);
      return OpCodes.Shr32(this.buffer, 32 - count);
    }

    dropBits(count) {
      this.buffer = OpCodes.Shl32(this.buffer, count);
      this.bitsAvailable -= count;
    }

    readBits(count) {
      const value = this.peekBits(count);
      this.dropBits(count);
      return value;
    }
  }

  // ===== HUFFMAN =====

  // Deterministic code lengths, clamped to maxBits and then lengthened from the
  // back until the Kraft sum fits again.
  function buildCodeLengths(frequencies, numSymbols, maxBits) {
    // Ties between equally frequent symbols are broken by the total order documented
    // in huffman-code-lengths.data.js, so the tree shape follows from the frequencies
    // alone rather than from any container's ordering of equal keys.
    const lengths = HuffmanCodeLengths.buildCodeLengths(frequencies, numSymbols);

    for (let i = 0; i < numSymbols; ++i)
      if (lengths[i] > maxBits) lengths[i] = maxBits;

    const kraftMax = OpCodes.Shl32(1, maxBits);
    let kraftSum = 0;
    for (let i = 0; i < numSymbols; ++i)
      if (lengths[i] > 0) kraftSum += OpCodes.Shr32(kraftMax, lengths[i]);

    while (kraftSum > kraftMax)
      for (let i = numSymbols - 1; i >= 0; --i) {
        if (lengths[i] <= 0 || lengths[i] >= maxBits)
          continue;

        kraftSum -= OpCodes.Shr32(kraftMax, lengths[i]);
        ++lengths[i];
        kraftSum += OpCodes.Shr32(kraftMax, lengths[i]);
        if (kraftSum <= kraftMax) break;
      }

    return lengths;
  }

  // Canonical numbering: shortest codes first, equal lengths in ascending symbol order.
  function buildCanonicalCodes(lengths) {
    let maxLen = 0;
    for (let i = 0; i < lengths.length; ++i)
      if (lengths[i] > maxLen) maxLen = lengths[i];

    const codes = new Array(lengths.length).fill(0);
    if (maxLen === 0)
      return codes;

    const blCount = new Array(maxLen + 1).fill(0);
    for (let i = 0; i < lengths.length; ++i)
      if (lengths[i] > 0) ++blCount[lengths[i]];

    const nextCode = new Array(maxLen + 1).fill(0);
    let code = 0;
    for (let b = 1; b <= maxLen; ++b) {
      code = OpCodes.Shl32(code + blCount[b - 1], 1);
      nextCode[b] = code;
    }

    for (let i = 0; i < lengths.length; ++i)
      if (lengths[i] > 0) codes[i] = nextCode[lengths[i]]++;

    return codes;
  }

  // Flat lookup table indexed by the next maxLen bits; each entry packs the symbol
  // in the low 16 bits and its code length above them.
  function buildDecodeTable(codeLengths, numSymbols, maxBits) {
    let maxLen = 0;
    for (let i = 0; i < numSymbols; ++i)
      if (codeLengths[i] > maxLen) maxLen = codeLengths[i];
    if (maxLen === 0) maxLen = 1;
    maxLen = Math.min(maxLen, maxBits);

    const tableSize = OpCodes.Shl32(1, maxLen);
    const table = new Int32Array(tableSize);

    const blCount = new Array(maxLen + 1).fill(0);
    for (let i = 0; i < numSymbols; ++i)
      if (codeLengths[i] > 0 && codeLengths[i] <= maxLen) ++blCount[codeLengths[i]];

    const nextCode = new Array(maxLen + 1).fill(0);
    let code = 0;
    for (let b = 1; b <= maxLen; ++b) {
      code = OpCodes.Shl32(code + blCount[b - 1], 1);
      nextCode[b] = code;
    }

    for (let sym = 0; sym < numSymbols; ++sym) {
      const len = codeLengths[sym];
      if (len === 0 || len > maxLen) continue;

      const c = nextCode[len]++;
      const fill = OpCodes.Shl32(1, maxLen - len);
      const packed = OpCodes.Or32(sym, OpCodes.Shl32(len, 16));
      const start = OpCodes.Shl32(c, maxLen - len);
      for (let j = 0; j < fill; ++j)
        table[start + j] = packed;
    }

    return { table: table, bits: maxLen };
  }

  function decodeSymbol(reader, decoder) {
    // A degenerate tree holds one symbol and no code, so it consumes no bits.
    if (decoder.bits === 0)
      return OpCodes.And32(decoder.table[0], 0xFFFF);

    const entry = decoder.table[reader.peekBits(decoder.bits)];
    const symbol = OpCodes.And32(entry, 0xFFFF);
    const codeLen = OpCodes.Shr32(entry, 16);
    if (codeLen > 0)
      reader.dropBits(codeLen);
    return symbol;
  }

  // ===== MATCH FINDER =====

  class HashChainMatchFinder {
    constructor(windowSize, maxChainDepth) {
      this.maxChainDepth = maxChainDepth;
      this.head = new Int32Array(HASH_SIZE).fill(-1);
      this.prev = new Int32Array(windowSize);
      this.prevMask = windowSize - 1;
    }

    static computeHash(data, position) {
      return OpCodes.And32(
        OpCodes.Xor32(
          OpCodes.Xor32(OpCodes.Shl32(data[position], 10), OpCodes.Shl32(data[position + 1], 5)),
          data[position + 2]
        ),
        HASH_MASK
      );
    }

    findMatch(data, position, maxDistance, maxLength, minLength) {
      if (position + 2 >= data.length)
        return { distance: 0, length: 0 };

      let bestDistance = 0;
      let bestLength = 0;

      const hash = HashChainMatchFinder.computeHash(data, position);
      let candidate = this.head[hash];
      let chainCount = 0;
      const windowStart = Math.max(0, position - maxDistance);

      while (candidate >= windowStart && chainCount < this.maxChainDepth) {
        if (candidate === position) {
          candidate = this.prev[OpCodes.And32(candidate, this.prevMask)];
          ++chainCount;
          continue;
        }

        const limit = Math.min(maxLength, Math.min(data.length - position, data.length - candidate));
        if (bestLength === 0 || (bestLength < limit && data[candidate + bestLength] === data[position + bestLength])) {
          let length = 0;
          while (length < limit && data[candidate + length] === data[position + length])
            ++length;

          if (length >= minLength && length > bestLength) {
            bestLength = length;
            bestDistance = position - candidate;
            if (bestLength >= maxLength)
              break;
          }
        }

        candidate = this.prev[OpCodes.And32(candidate, this.prevMask)];
        if (candidate <= windowStart)
          break;

        ++chainCount;
      }

      this.prev[OpCodes.And32(position, this.prevMask)] = this.head[hash];
      this.head[hash] = position;

      return bestLength >= minLength
        ? { distance: bestDistance, length: bestLength }
        : { distance: 0, length: 0 };
    }

    insertPosition(data, position) {
      if (position + 2 >= data.length)
        return;

      const hash = HashChainMatchFinder.computeHash(data, position);
      this.prev[OpCodes.And32(position, this.prevMask)] = this.head[hash];
      this.head[hash] = position;
    }
  }

  // ===== ENCODER =====

  function getLengthSymbol(length) {
    for (let i = LENGTH_BASE.length - 1; i >= 0; --i)
      if (length >= LENGTH_BASE[i])
        return SYMBOL_MATCH_BASE + i;
    return SYMBOL_MATCH_BASE;
  }

  // Run-length coding of a code-length list, producing a flat stream in which the
  // repeat markers 16, 17 and 18 are each followed by their raw count.
  function runLengthEncodeLengths(codeLengths, numSymbols) {
    const rle = [];
    let idx = 0;

    while (idx < numSymbols) {
      if (codeLengths[idx] === 0) {
        let run = 1;
        while (idx + run < numSymbols && codeLengths[idx + run] === 0) ++run;
        const totalRun = run;

        while (run > 0) {
          if (run >= 11) {
            rle.push(18);
            rle.push(Math.min(run - 11, 127));
            run -= Math.min(run, 138);
          } else if (run >= 3) {
            rle.push(17);
            rle.push(run - 3);
            run = 0;
          } else {
            rle.push(0);
            --run;
          }
        }

        idx += totalRun;
        continue;
      }

      rle.push(codeLengths[idx]);
      const prev = codeLengths[idx];
      ++idx;

      let rep = 0;
      while (idx < numSymbols && codeLengths[idx] === prev && rep < 6) {
        ++rep;
        ++idx;
      }

      while (rep >= 3) {
        rle.push(16);
        rle.push(rep - 3);
        rep = 0;
      }
      while (rep > 0) {
        rle.push(prev);
        --rep;
      }
    }

    return rle;
  }

  function writeHuffmanTree(writer, codeLengths, numSymbols) {
    let usedCount = 0;
    for (let i = 0; i < numSymbols; ++i)
      if (codeLengths[i] > 0) ++usedCount;

    if (usedCount === 0) {
      writer.writeBits(0, 9);
      writer.writeBits(0, 9);
      return;
    }

    if (usedCount === 1) {
      writer.writeBits(0, 9);
      for (let i = 0; i < numSymbols; ++i)
        if (codeLengths[i] > 0) {
          writer.writeBits(i, 9);
          break;
        }
      return;
    }

    const rle = runLengthEncodeLengths(codeLengths, numSymbols);

    const preFreq = new Array(PRE_TREE_SYMBOLS).fill(0);
    for (let i = 0; i < rle.length; ++i) {
      const sym = rle[i];
      if (sym <= 18) ++preFreq[sym];
      if (sym >= 16 && sym <= 18) ++i;
    }

    const preLengths = buildCodeLengths(preFreq, PRE_TREE_SYMBOLS, MAX_CODE_LENGTH);
    const preCodes = buildCanonicalCodes(preLengths);

    let preCount = PRE_TREE_SYMBOLS;
    while (preCount > 0 && preLengths[preCount - 1] === 0) --preCount;
    writer.writeBits(preCount, 9);
    for (let i = 0; i < preCount; ++i)
      writer.writeBits(preLengths[i], 4);

    for (let i = 0; i < rle.length; ++i) {
      const sym = rle[i];
      if (sym <= 15) {
        writer.writeBits(preCodes[sym], preLengths[sym]);
      } else if (sym === 16) {
        writer.writeBits(preCodes[16], preLengths[16]);
        writer.writeBits(rle[++i], 2);
      } else if (sym === 17) {
        writer.writeBits(preCodes[17], preLengths[17]);
        writer.writeBits(rle[++i], 3);
      } else if (sym === 18) {
        writer.writeBits(preCodes[18], preLengths[18]);
        writer.writeBits(rle[++i], 7);
      }
    }
  }

  function aceCompress(input) {
    const result = [
      OpCodes.And32(input.length, 0xFF),
      OpCodes.And32(OpCodes.Shr32(input.length, 8), 0xFF),
      OpCodes.And32(OpCodes.Shr32(input.length, 16), 0xFF),
      OpCodes.And32(OpCodes.Shr32(input.length, 24), 0xFF)
    ];
    if (input.length === 0)
      return result;

    const writer = new AceBitWriter();
    const matchFinder = new HashChainMatchFinder(DICT_SIZE, MAX_CHAIN_DEPTH);
    let pos = 0;

    while (pos < input.length) {
      const symbols = [];
      const lengths = [];
      const distances = [];

      while (pos < input.length && symbols.length < BLOCK_SIZE) {
        const match = matchFinder.findMatch(input, pos, DICT_SIZE, MAX_MATCH, MIN_MATCH);
        if (match.length >= MIN_MATCH) {
          symbols.push(getLengthSymbol(match.length));
          lengths.push(match.length);
          distances.push(match.distance);
          for (let i = 1; i < match.length && pos + i < input.length; ++i)
            matchFinder.insertPosition(input, pos + i);
          pos += match.length;
        } else {
          symbols.push(input[pos]);
          lengths.push(0);
          distances.push(0);
          ++pos;
        }
      }

      const mainFreq = new Array(MAIN_SYMBOLS).fill(0);
      const lenFreq = new Array(LEN_SYMBOLS).fill(0);
      mainFreq[SYMBOL_END_OF_BLOCK] = 1;
      for (let i = 0; i < symbols.length; ++i)
        ++mainFreq[symbols[i]];

      const mainLengths = buildCodeLengths(mainFreq, MAIN_SYMBOLS, MAX_CODE_LENGTH);
      const lenLengths = buildCodeLengths(lenFreq, LEN_SYMBOLS, MAX_CODE_LENGTH);
      const mainCodes = buildCanonicalCodes(mainLengths);

      writeHuffmanTree(writer, mainLengths, MAIN_SYMBOLS);
      writeHuffmanTree(writer, lenLengths, LEN_SYMBOLS);

      for (let i = 0; i < symbols.length; ++i) {
        const sym = symbols[i];
        writer.writeBits(mainCodes[sym], mainLengths[sym]);
        if (sym < 256)
          continue;

        const lenIdx = sym - SYMBOL_MATCH_BASE;
        const extra = LENGTH_EXTRA[lenIdx];
        if (extra > 0)
          writer.writeBits(lengths[i] - LENGTH_BASE[lenIdx], extra);

        writer.writeBits(0, 2);
        writer.writeBits(distances[i] - 1, DICT_BITS);
      }

      writer.writeBits(mainCodes[SYMBOL_END_OF_BLOCK], mainLengths[SYMBOL_END_OF_BLOCK]);
    }

    const body = writer.toArray();
    for (let i = 0; i < body.length; ++i)
      result.push(body[i]);
    return result;
  }

  // ===== DECODER =====

  function readHuffmanTree(reader, numSymbols) {
    const numCodes = reader.readBits(9);

    if (numCodes === 0) {
      const sym = reader.readBits(9);
      // A tree with at most one used symbol: every lookup yields that symbol and
      // consumes no bits.
      return { table: new Int32Array(1).fill(sym), bits: 0, degenerate: true };
    }

    const preLengths = new Array(numCodes).fill(0);
    for (let i = 0; i < numCodes; ++i)
      preLengths[i] = reader.readBits(4);

    const preTree = buildDecodeTable(preLengths, numCodes, MAX_CODE_LENGTH);

    const codeLengths = new Array(numSymbols).fill(0);
    let idx = 0;
    while (idx < numSymbols) {
      const code = decodeSymbol(reader, preTree);

      if (code < 16) {
        codeLengths[idx++] = code;
      } else if (code === 16) {
        const count = reader.readBits(2) + 3;
        const prev = idx > 0 ? codeLengths[idx - 1] : 0;
        for (let j = 0; j < count && idx < numSymbols; ++j)
          codeLengths[idx++] = prev;
      } else if (code === 17) {
        idx += reader.readBits(3) + 3;
      } else if (code === 18) {
        idx += reader.readBits(7) + 11;
      } else {
        throw new Error('ACE: invalid code-length symbol in stream');
      }
    }

    return buildDecodeTable(codeLengths, numSymbols, MAX_CODE_LENGTH);
  }

  function readDistance(reader, repOffsets) {
    const mode = reader.readBits(2);
    if (mode > 0 && mode < NUM_REP_OFFSETS)
      return repOffsets[mode - 1];
    return reader.readBits(DICT_BITS) + 1;
  }

  function aceDecompress(input) {
    if (input.length < 4)
      return [];

    const originalSize = OpCodes.Or32(
      OpCodes.Or32(input[0], OpCodes.Shl32(input[1], 8)),
      OpCodes.Or32(OpCodes.Shl32(input[2], 16), OpCodes.Shl32(input[3], 24))
    );
    if (originalSize === 0)
      return [];

    const reader = new AceBitReader(input, 4);
    const output = new Array(originalSize).fill(0);
    const window = new Uint8Array(DICT_SIZE);
    const repOffsets = new Array(NUM_REP_OFFSETS).fill(1);
    let windowPos = 0;
    let outPos = 0;

    while (outPos < originalSize) {
      const mainTree = readHuffmanTree(reader, MAIN_SYMBOLS);
      readHuffmanTree(reader, LEN_SYMBOLS);
      if (mainTree.degenerate)
        throw new Error('ACE: main tree carries no usable code');

      while (outPos < originalSize) {
        const sym = decodeSymbol(reader, mainTree);

        if (sym < 256) {
          output[outPos++] = sym;
          window[windowPos] = sym;
          windowPos = OpCodes.And32(windowPos + 1, DICT_MASK);
          continue;
        }

        if (sym === SYMBOL_END_OF_BLOCK)
          break;

        const lenIdx = sym - SYMBOL_MATCH_BASE;
        if (lenIdx < 0 || lenIdx >= LENGTH_BASE.length)
          throw new Error('ACE: invalid match symbol in stream');

        let length = LENGTH_BASE[lenIdx];
        const extra = LENGTH_EXTRA[lenIdx];
        if (extra > 0)
          length += reader.readBits(extra);

        const distance = readDistance(reader, repOffsets);
        for (let i = repOffsets.length - 1; i > 0; --i)
          repOffsets[i] = repOffsets[i - 1];
        repOffsets[0] = distance;

        let srcPos = OpCodes.And32(windowPos - distance + DICT_SIZE, DICT_MASK);
        for (let j = 0; j < length && outPos < originalSize; ++j) {
          const b = window[srcPos];
          output[outPos++] = b;
          window[windowPos] = b;
          windowPos = OpCodes.And32(windowPos + 1, DICT_MASK);
          srcPos = OpCodes.And32(srcPos + 1, DICT_MASK);
        }
      }
    }

    return output;
  }

  // ===== ALGORITHM =====

  class AceArchiverCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "ACE (WinAce)";
      this.description = "WinAce's ACE 1.0 method: an LZ77 matcher over a 32 KiB dictionary feeding two per-block Huffman trees, a 284-symbol main tree of literals, an end-of-block marker and 27 match-length slots whose code lengths travel through a 19-symbol pre-tree, plus a 2-bit distance mode selecting either an explicit 15-bit distance or one of three recent distances. Bits are packed most-significant-bit first and flushed as 16-bit little-endian words.";
      this.inventor = "Marcel Lemke";
      this.year = 1998;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.DE;

      this.documentation = [
        new LinkItem("ACE (compression format)", "https://en.wikipedia.org/wiki/ACE_(compression_format)"),
        new LinkItem("Canonical Huffman code", "https://en.wikipedia.org/wiki/Canonical_Huffman_code")
      ];

      this.references = [
        new LinkItem("Huffman, A Method for the Construction of Minimum-Redundancy Codes, 1952", "https://en.wikipedia.org/wiki/Huffman_coding"),
        new LinkItem("Ziv and Lempel, A Universal Algorithm for Sequential Data Compression, 1977", "https://en.wikipedia.org/wiki/LZ77_and_LZ78")
      ];

      this.tests = [
        {
          text: "Empty input - length header only",
          uri: "https://en.wikipedia.org/wiki/ACE_(compression_format)",
          input: [],
          expected: [0x00, 0x00, 0x00, 0x00]
        },
        {
          text: "Single byte 'A' - one literal plus end-of-block",
          uri: "https://en.wikipedia.org/wiki/ACE_(compression_format)",
          input: [0x41],
          expected: [
            0x01, 0x00, 0x00, 0x00, 0x80, 0x09, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0xB3, 0x0D, 0xA5, 0xFE, 0x00, 0x20, 0x20, 0x00
          ]
        },
        {
          text: "Repeated byte run - one literal then a single long match",
          uri: "https://en.wikipedia.org/wiki/ACE_(compression_format)",
          input: OpCodes.AnsiToBytes("aaaaaaaaaaaaaaaa"),
          expected: [
            0x10, 0x00, 0x00, 0x00, 0x81, 0x09, 0x00, 0x10, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0xB6, 0x0A, 0x13, 0xFE, 0x40, 0x80, 0x00, 0x80, 0x80, 0x04,
            0x30, 0x00
          ]
        },
        {
          text: "Periodic text - three literals then a match carrying extra length bits",
          uri: "https://en.wikipedia.org/wiki/ACE_(compression_format)",
          input: OpCodes.AnsiToBytes("abcabcabcabcabcabcab"),
          expected: [
            0x14, 0x00, 0x00, 0x00, 0x80, 0x09, 0x00, 0x11, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0xB7, 0x0A, 0xE0, 0xCF, 0x0C, 0xF0, 0x00, 0x06, 0x6E, 0x00,
            0x00, 0x48, 0x00, 0x09
          ]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new AceArchiverInstance(this, isInverse);
    }
  }

  class AceArchiverInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let i = 0; i < data.length; ++i)
        this.inputBuffer.push(data[i]);
    }

    Result() {
      const data = this.inputBuffer;
      this.inputBuffer = [];
      return this.isInverse ? aceDecompress(data) : aceCompress(data);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new AceArchiverCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { AceArchiverCompression, AceArchiverInstance };
}));
