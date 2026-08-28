/*
 * Xpress (LZ77+Huffman) Compression Algorithm
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Microsoft's Xpress compression algorithm, LZ77+Huffman variant ([MS-XCA]
 * section 2.1), matching the reference CompressionWorkbench encoder/decoder
 * (Compression.Core.Dictionary.Xpress.XpressHuffmanCompressor/Decompressor)
 * byte-for-byte.
 *
 * Data is split into independent 64 KiB chunks. Each chunk starts with a
 * 256-byte table of 4-bit Huffman code lengths for a 512-symbol alphabet
 * (two nibbles per byte, low nibble = lower-indexed symbol), followed by a
 * bit-packed stream of Huffman-coded symbols, LSB-first, packed into 16-bit
 * little-endian words:
 *   - Symbols 0-255: literal bytes.
 *   - Symbols 256-511: LZ matches, encoded as
 *     256 + (offsetLog2 << 4) + min(length - 3, 15), where offsetLog2 =
 *     floor(log2(distance)). offsetLog2 raw extra bits (the low bits of
 *     distance - 2^offsetLog2) follow, packed into the same bit stream.
 *     If the length nibble is 15, one extra byte follows (raw, not
 *     Huffman-coded): length = extra + 3, unless extra == 255, in which
 *     case a raw 16-bit LE length follows instead.
 *
 * The reference decoder rewinds any 16-bit words it eagerly over-read past a
 * chunk's bit stream (the encoder pads each chunk to a 16-bit boundary, so
 * only sub-word padding bits are lost) so the next chunk's table header
 * starts at the right byte offset. This implementation wraps the whole
 * multi-chunk payload in a single self-contained 4-byte little-endian
 * original-length header (no side channel needed for Feed/Result use).
 *
 * The match finder is a hash-chain search (3-byte hash, 8192-byte window,
 * 128-candidate chain depth) and the Huffman tree is built with a
 * frequency-ordered min-heap (ties broken by symbol, where internal nodes
 * carry the sentinel symbol -1) plus a length-limiting pass that clamps
 * codes to 15 bits and repairs the Kraft inequality by lengthening the
 * shortest violating codes, then reclaims any leftover budget by shortening
 * the longest codes -- both reference-specific choices that must be
 * reproduced exactly for byte-identical output, not just a valid tree.
 *
 * References:
 * - [MS-XCA]: Xpress Compression Algorithm
 *   https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/a8b7cb0a-92a6-4187-a23b-5e14273b96f8
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

  if (!HuffmanCodeLengths) {
    throw new Error('HuffmanCodeLengths dependency is required');
  }

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, LinkItem } = AlgorithmFramework;

  // ===== FORMAT CONSTANTS =====

  const WINDOW_SIZE = 8192;
  const MIN_MATCH = 3;
  const MAX_MATCH = 65538;
  const LENGTH_SENTINEL_8 = 255;
  const HUFF_SYMBOL_COUNT = 512;
  const HUFF_CHUNK_SIZE = 65536;
  const HUFF_TABLE_HEADER_BYTES = 256;
  const HUFF_MAX_CODE_LENGTH = 15;
  const MAX_CHAIN_DEPTH = 128;

  // ===== HASH-CHAIN MATCH FINDER =====
  //
  // The reference finder stores `prev` in a fixed WindowSize-sized circular
  // buffer (indexed by position & (WindowSize-1)), not one slot per input
  // position, and explicitly skips a chain entry that collides with the
  // current position (a stale slot reused after the buffer wrapped around).

  const MF_HASH_BITS = 15;
  const MF_HASH_SIZE = OpCodes.Shl32(1, MF_HASH_BITS);

  function mfHash(data, pos) {
    const h1 = OpCodes.Shl32(data[pos], 10);
    const h2 = OpCodes.Shl32(data[pos + 1], 5);
    const h3 = data[pos + 2];
    return OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(h1, h2), h3), MF_HASH_SIZE - 1);
  }

  class HashChainMatchFinder {
    constructor(windowSize, maxChainDepth) {
      this.maxChainDepth = maxChainDepth;
      this.head = new Int32Array(MF_HASH_SIZE).fill(-1);
      this.prev = new Int32Array(windowSize);
      this.mask = windowSize - 1;
    }

    findMatch(data, position, maxDistance, maxLength, minLength) {
      if (position + 2 >= data.length) return { distance: 0, length: 0 };

      let bestDistance = 0, bestLength = 0;
      const h = mfHash(data, position);
      let candidate = this.head[h];
      let chainCount = 0;
      const windowStart = Math.max(0, position - maxDistance);

      while (candidate >= windowStart && chainCount < this.maxChainDepth) {
        if (candidate === position) {
          candidate = this.prev[OpCodes.And32(candidate, this.mask)];
          chainCount++;
          continue;
        }

        const distance = position - candidate;
        const limit = Math.min(maxLength, Math.min(data.length - position, data.length - candidate));
        // (The reference has a "quick check" pruning gate here purely for speed;
        // it never changes which candidate wins, so it's safe to always measure
        // the full match length directly.)
        let length = 0;
        while (length < limit && data[candidate + length] === data[position + length]) length++;
        if (length >= minLength && length > bestLength) {
          bestLength = length;
          bestDistance = distance;
          if (bestLength >= maxLength) break;
        }

        candidate = this.prev[OpCodes.And32(candidate, this.mask)];
        if (candidate <= windowStart) break;
        chainCount++;
      }

      this.prev[OpCodes.And32(position, this.mask)] = this.head[h];
      this.head[h] = position;

      return bestLength >= minLength ? { distance: bestDistance, length: bestLength } : { distance: 0, length: 0 };
    }

    insertPosition(data, position) {
      if (position + 2 >= data.length) return;
      const h = mfHash(data, position);
      this.prev[OpCodes.And32(position, this.mask)] = this.head[h];
      this.head[h] = position;
    }
  }

  // ===== HUFFMAN TREE CONSTRUCTION =====

  // Code lengths come from the shared deterministic builder in
  // huffman-code-lengths.data.js. Its tie-break among equally likely symbols is a
  // written rule - lighter first, then leaves before internal nodes, leaves by
  // ascending symbol, internal nodes oldest first - and CompressionWorkbench's
  // DeterministicHuffman follows the same rule, so the two produce the same tree
  // because the algorithm says so and not because either copies the other's heap.

  function limitCodeLengths(codeLengths, maxLength) {
    const needsAdjustment = codeLengths.some(t => t > maxLength);
    if (!needsAdjustment) return;

    const symbols = [];
    for (let i = 0; i < codeLengths.length; i++) if (codeLengths[i] > 0) symbols.push({ symbol: i, length: codeLengths[i] });

    for (let i = 0; i < symbols.length; i++) if (symbols[i].length > maxLength) symbols[i].length = maxLength;

    const kraftMax = OpCodes.Shl32(1, maxLength);
    for (;;) {
      let kraftSum = 0;
      for (let i = 0; i < symbols.length; i++) kraftSum += OpCodes.Shl32(1, maxLength - symbols[i].length);
      if (kraftSum <= kraftMax) break;

      let shortestIdx = -1, shortestLen = Infinity;
      for (let i = 0; i < symbols.length; i++)
        if (symbols[i].length < maxLength && symbols[i].length < shortestLen) {
          shortestLen = symbols[i].length;
          shortestIdx = i;
        }
      if (shortestIdx < 0) break;
      symbols[shortestIdx].length++;
    }

    for (;;) {
      let kraftSum = 0;
      for (let i = 0; i < symbols.length; i++) kraftSum += OpCodes.Shl32(1, maxLength - symbols[i].length);
      const excess = kraftMax - kraftSum;
      if (excess <= 0) break;

      let longestIdx = -1, longestLen = 0;
      for (let i = 0; i < symbols.length; i++)
        if (symbols[i].length > longestLen) {
          longestLen = symbols[i].length;
          longestIdx = i;
        }
      if (longestIdx < 0 || longestLen <= 1) break;

      const added = OpCodes.Shl32(1, maxLength - longestLen);
      if (added <= excess) symbols[longestIdx].length--;
      else break;
    }

    codeLengths.fill(0);
    for (let i = 0; i < symbols.length; i++) codeLengths[symbols[i].symbol] = symbols[i].length;
  }

  function buildLengths(freq) {
    const hasAny = freq.some(v => v > 0);
    if (!hasAny) return new Array(HUFF_SYMBOL_COUNT).fill(9);

    const usedCount = freq.filter(v => v > 0).length;
    if (usedCount < 2)
      for (let i = 0; i < freq.length; i++)
        if (freq[i] === 0) { freq[i] = 1; break; }

    const lengths = HuffmanCodeLengths.buildCodeLengths(freq, HUFF_SYMBOL_COUNT);
    limitCodeLengths(lengths, HUFF_MAX_CODE_LENGTH);
    return lengths;
  }

  function reverseBits(code, length) {
    let result = 0, c = code;
    for (let i = 0; i < length; i++) {
      result = OpCodes.Or32(OpCodes.Shl32(result, 1), OpCodes.And32(c, 1));
      c = OpCodes.Shr32(c, 1);
    }
    return result;
  }

  function buildCanonicalCodes(lengths) {
    const maxLen = lengths.length > 0 ? Math.max(...lengths) : 0;
    if (maxLen === 0) return new Array(lengths.length).fill(0);

    const blCount = new Array(maxLen + 1).fill(0);
    for (const v of lengths) if (v > 0) blCount[v]++;

    const nextCode = new Array(maxLen + 1).fill(0);
    let code = 0;
    for (let b = 1; b <= maxLen; b++) {
      code = OpCodes.Shl32(code + blCount[b - 1], 1);
      nextCode[b] = code;
    }

    const codes = new Array(lengths.length).fill(0);
    for (let i = 0; i < lengths.length; i++)
      if (lengths[i] > 0) codes[i] = reverseBits(nextCode[lengths[i]]++, lengths[i]);
    return codes;
  }

  function log2Floor(x) {
    let result = 0, v = x;
    while (v > 1) { v = OpCodes.Shr32(v, 1); result++; }
    return result;
  }

  // ===== CHUNK COMPRESSOR =====

  function compressChunk(chunk, out) {
    const matchFinder = new HashChainMatchFinder(WINDOW_SIZE, MAX_CHAIN_DEPTH);
    const tokens = [];
    const freq = new Array(HUFF_SYMBOL_COUNT).fill(0);
    let pos = 0;

    while (pos < chunk.length) {
      const match = matchFinder.findMatch(chunk, pos, WINDOW_SIZE, MAX_MATCH, MIN_MATCH);

      if (match.length >= MIN_MATCH) {
        const offsetLog2 = log2Floor(match.distance);
        const lengthHeader = Math.min(match.length - MIN_MATCH, 15);
        const symbol = 256 + OpCodes.Shl32(offsetLog2, 4) + lengthHeader;

        tokens.push({ symbol, distance: match.distance, length: match.length });
        freq[symbol]++;

        for (let i = 1; i < match.length; i++) matchFinder.insertPosition(chunk, pos + i);
        pos += match.length;
      } else {
        tokens.push({ symbol: chunk[pos], distance: 0, length: 0 });
        freq[chunk[pos]]++;
        pos++;
      }
    }

    const codeLengths = buildLengths(freq);

    const tableHeader = new Array(HUFF_TABLE_HEADER_BYTES).fill(0);
    for (let i = 0; i < HUFF_SYMBOL_COUNT; i += 2)
      tableHeader[i / 2] = OpCodes.Or32(OpCodes.And32(codeLengths[i], 0xF), OpCodes.Shl32(OpCodes.And32(codeLengths[i + 1], 0xF), 4));
    for (let i = 0; i < tableHeader.length; i++) out.push(tableHeader[i]);

    const codes = buildCanonicalCodes(codeLengths);

    let bitBuf = 0, bitsInBuf = 0;
    const bitBytes = [];

    function flushWord() {
      bitBytes.push(OpCodes.And32(bitBuf, 0xFF));
      bitBytes.push(OpCodes.And32(OpCodes.Shr32(bitBuf, 8), 0xFF));
      bitBuf = 0;
      bitsInBuf = 0;
    }

    function writeBits(value, count) {
      let remaining = count, v = value;
      while (remaining > 0) {
        const space = 16 - bitsInBuf;
        const take = Math.min(space, remaining);
        const mask = OpCodes.Shl32(1, take) - 1;
        bitBuf = OpCodes.Or32(bitBuf, OpCodes.Shl32(OpCodes.And32(v, mask), bitsInBuf));
        v = OpCodes.Shr32(v, take);
        remaining -= take;
        bitsInBuf += take;
        if (bitsInBuf === 16) flushWord();
      }
    }

    for (const { symbol, distance, length } of tokens) {
      writeBits(codes[symbol], codeLengths[symbol]);
      if (symbol < 256) continue;

      const offsetLog2 = OpCodes.Shr32(symbol - 256, 4);
      if (offsetLog2 > 0) {
        const baseOffset = OpCodes.Shl32(1, offsetLog2);
        writeBits(distance - baseOffset, offsetLog2);
      }

      const lengthHeader = OpCodes.And32(symbol - 256, 0xF);
      if (lengthHeader !== 15) continue;

      const adj = length - MIN_MATCH;
      if (adj < LENGTH_SENTINEL_8) writeBits(adj, 8);
      else {
        writeBits(LENGTH_SENTINEL_8, 8);
        writeBits(length, 16);
      }
    }

    if (bitsInBuf > 0) flushWord();
    for (let i = 0; i < bitBytes.length; i++) out.push(bitBytes[i]);
  }

  function compressXpressHuffman(input) {
    if (input.length === 0) return [];
    const out = [];
    let pos = 0;
    while (pos < input.length) {
      const chunkSize = Math.min(HUFF_CHUNK_SIZE, input.length - pos);
      compressChunk(input.slice(pos, pos + chunkSize), out);
      pos += chunkSize;
    }
    return out;
  }

  // ===== CHUNK DECOMPRESSOR =====

  function buildDecodeTable(codeLengths) {
    let maxLen = 0;
    for (let i = 0; i < codeLengths.length; i++) if (codeLengths[i] > maxLen) maxLen = codeLengths[i];

    if (maxLen === 0) return { table: [0, 0], maxLen: 1 };

    const tableSize = OpCodes.Shl32(1, maxLen);
    const table = new Array(tableSize).fill(-1);

    const blCount = new Array(maxLen + 1).fill(0);
    for (let i = 0; i < codeLengths.length; i++) if (codeLengths[i] > 0) blCount[codeLengths[i]]++;

    const nextCode = new Array(maxLen + 1).fill(0);
    let code = 0;
    for (let b = 1; b <= maxLen; b++) {
      code = OpCodes.Shl32(code + blCount[b - 1], 1);
      nextCode[b] = code;
    }

    for (let sym = 0; sym < codeLengths.length; sym++) {
      const len = codeLengths[sym];
      if (len === 0) continue;

      const symCode = nextCode[len]++;
      const reversed = reverseBits(symCode, len);
      const fillCount = OpCodes.Shl32(1, maxLen - len);
      const packed = OpCodes.Or32(sym, OpCodes.Shl32(len, 16));
      for (let fill = 0; fill < fillCount; fill++) table[reversed + OpCodes.Shl32(fill, len)] = packed;
    }

    return { table, maxLen };
  }

  function decompressXpressHuffman(input, uncompressedSize) {
    if (uncompressedSize === 0) return [];

    const output = new Array(uncompressedSize);
    let inputPos = 0, bitBuf = 0, bitsAvailable = 0;
    let outputPos = 0;

    function readBits(count) {
      while (bitsAvailable < count) {
        if (inputPos + 1 < input.length) {
          const word = OpCodes.Pack16LE(input[inputPos], input[inputPos + 1]);
          inputPos += 2;
          bitBuf = OpCodes.Or32(bitBuf, OpCodes.Shl32(word, bitsAvailable));
          bitsAvailable += 16;
        } else if (inputPos < input.length) {
          bitBuf = OpCodes.Or32(bitBuf, OpCodes.Shl32(input[inputPos++], bitsAvailable));
          bitsAvailable += 8;
        } else break;
      }
      const mask = OpCodes.Shl32(1, count) - 1;
      const result = OpCodes.And32(bitBuf, mask);
      bitBuf = OpCodes.Shr32(bitBuf, count);
      bitsAvailable -= count;
      return result;
    }

    while (outputPos < uncompressedSize) {
      bitBuf = 0;
      bitsAvailable = 0;

      if (inputPos + HUFF_TABLE_HEADER_BYTES > input.length) throw new Error("XPRESS Huffman compressed data is truncated.");

      const codeLengths = new Array(HUFF_SYMBOL_COUNT).fill(0);
      for (let i = 0; i < HUFF_TABLE_HEADER_BYTES; i++) {
        codeLengths[i * 2] = OpCodes.And32(input[inputPos + i], 0xF);
        codeLengths[i * 2 + 1] = OpCodes.And32(OpCodes.Shr32(input[inputPos + i], 4), 0xF);
      }
      inputPos += HUFF_TABLE_HEADER_BYTES;

      const { table: decodeTable, maxLen: maxCodeLength } = buildDecodeTable(codeLengths);

      const chunkUncompressedSize = Math.min(HUFF_CHUNK_SIZE, uncompressedSize - outputPos);
      const chunkEnd = outputPos + chunkUncompressedSize;

      while (outputPos < chunkEnd) {
        while (bitsAvailable < maxCodeLength && inputPos + 1 < input.length) {
          const word = OpCodes.Pack16LE(input[inputPos], input[inputPos + 1]);
          inputPos += 2;
          bitBuf = OpCodes.Or32(bitBuf, OpCodes.Shl32(word, bitsAvailable));
          bitsAvailable += 16;
        }
        const peekMask = OpCodes.Shl32(1, maxCodeLength) - 1;
        const peek = OpCodes.And32(bitBuf, peekMask);
        const entry = decodeTable[peek];
        if (entry === undefined || entry < 0) throw new Error("XPRESS Huffman compressed data contains an invalid Huffman code.");
        const codeLen = OpCodes.Shr32(entry, 16);
        bitBuf = OpCodes.Shr32(bitBuf, codeLen);
        bitsAvailable -= codeLen;
        const sym = OpCodes.And32(entry, 0xFFFF);

        if (sym < 256) {
          output[outputPos++] = sym;
        } else {
          const offsetLog2 = OpCodes.Shr32(sym - 256, 4);
          const lengthHeader = OpCodes.And32(sym - 256, 0xF);

          let distance;
          if (offsetLog2 === 0) distance = 1;
          else distance = OpCodes.Shl32(1, offsetLog2) + readBits(offsetLog2);

          let length;
          if (lengthHeader < 15) length = lengthHeader + MIN_MATCH;
          else {
            const extra = readBits(8);
            if (extra !== LENGTH_SENTINEL_8) length = extra + MIN_MATCH;
            else length = readBits(16);
          }

          const copyFrom0 = outputPos - distance;
          if (copyFrom0 < 0) throw new Error("XPRESS Huffman compressed data contains an invalid match descriptor.");
          let copyFrom = copyFrom0;
          const copyEnd = Math.min(outputPos + length, chunkEnd);
          while (outputPos < copyEnd) output[outputPos++] = output[copyFrom++];
        }
      }

      inputPos -= OpCodes.Shl32(Math.floor(bitsAvailable / 16), 1);
    }

    return output;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class XpressCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "Xpress";
      this.description = "Microsoft's LZ77+Huffman compression algorithm ([MS-XCA]), used in WIM images, NTFS, and Hyper-V. Splits data into 64KB chunks, each with its own 512-symbol canonical Huffman table (256 literals + 256 length/offset-class match symbols) over an LSB-first, 16-bit-word-packed bit stream.";
      this.inventor = "Microsoft";
      this.year = 2014;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("[MS-XCA]: Xpress Compression Algorithm",
          "https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/a8b7cb0a-92a6-4187-a23b-5e14273b96f8")
      ];

      this.references = [
        new LinkItem("[MS-XCA] 2.1: LZ77+Huffman Compression Algorithm Details",
          "https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/a8b7cb0a-92a6-4187-a23b-5e14273b96f8")
      ];

      this.tests = [
        {
          text: "Empty input",
          uri: "https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/",
          input: [],
          expected: [0, 0, 0, 0]
        },
        {
          text: "Highly repetitive input (64 'A' bytes)",
          uri: "https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/",
          input: new Array(64).fill(0x41),
          roundTripOnly: true
        },
        {
          text: "Text sample",
          uri: "https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox."),
          roundTripOnly: true
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new XpressInstance(this, isInverse);
    }
  }

  class XpressInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }


    Result() {
      const result = this.isInverse ? this._decompress(this.inputBuffer) : this._compress(this.inputBuffer);
      this.inputBuffer = [];
      return result;
    }

    _compress(input) {
      const n = input.length;
      const header = OpCodes.Unpack32LE(n);
      return header.concat(compressXpressHuffman(input));
    }

    _decompress(input) {
      if (input.length < 4) throw new Error("Xpress: input smaller than 4-byte header.");
      const originalSize = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      if (originalSize < 0) throw new Error("Xpress: negative decompressed size.");
      return decompressXpressHuffman(input.slice(4), originalSize);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new XpressCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { XpressCompression, XpressInstance };
}));
