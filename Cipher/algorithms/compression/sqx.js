/*
 * SQX Compression Algorithm
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * SQX is the archive format written by Rainer Nausedat (with Sven Ritter). Its
 * LZH method pairs an LZ77 matcher over a 32 KiB dictionary with two Huffman
 * trees rebuilt for every block of at most 16384 tokens, over an unusually wide
 * main alphabet that folds short matches and their distances into single
 * symbols. The symbol layout below is the one this implementation produces and
 * reads, and it is shared byte-for-byte with the sibling CompressionWorkbench
 * (C#) project's SQX stage.
 *
 * Main tree, 310 symbols:
 *   0-255    literal bytes
 *   256      repeat the previous match, same length and distance
 *   257-260  replay one of the four most recent distances; a length symbol from
 *            the 284+ range follows
 *   261-268  a length-2 match whose distance is this slot's base (0, 4, 8, 16,
 *            32, 64, 128, 192) plus 2 to 6 extra bits, then incremented
 *   269-283  a length-3 match, bases 0, 1, 2, 4 ... 8192 with 0 to 13 extra bits
 *   284-308  a match of length 4 or more: bases 4, 5, ... 228 with up to 5 extra
 *            bits, and slot 308 an escape carrying 14 raw bits plus 257. A
 *            distance-tree symbol follows
 *
 * Distance tree, 48 slots: slot 0 is distance 1, slot 1 distance 2, and slot s
 * above that is 2^(s-1) plus (s-1) raw bits. A distance past 16383 (and past
 * 262143) shortens the coded length by one, which the decoder adds back.
 *
 * Wire format produced here - a 4-byte little-endian uncompressed length
 * followed by the SQX bit stream. Each block is a 16-bit symbol count, 19 raw
 * 4-bit pre-tree code lengths, then the main and distance code lengths
 * run-length coded through that pre-tree (16 repeats the previous length 3-6
 * times, 17 runs 3-10 zeros, 18 runs 11-138 zeros), then the tokens. A 16-bit
 * zero count ends the stream. All bit fields are most-significant-bit first.
 *
 * Documentation and references:
 *   - https://docs.fileformat.com/compression/sqx/ - the SQX format catalogue
 *     entry; the container itself is proprietary and carries no published
 *     bitstream specification
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

  // ===== SQX CONSTANTS =====

  const DICT_SIZE = 32768;
  const DICT_MASK = 32767;
  const DIST_SLOTS = 48;                // slot count for dictionaries up to 1 MiB
  const NC = 310;                       // main tree symbols
  const PRE_TREE_SYMBOLS = 19;
  const PRE_TREE_MAX_BITS = 7;
  const MAIN_TREE_MAX_BITS = 15;
  const DUP_LAST_SYMBOL = 256;
  const REP_START = 257;
  const REP_CODES = 4;
  const LEN2_START = 261;
  const LEN2_CODES = 8;
  const LEN3_START = 269;
  const LEN3_CODES = 15;
  const LEN_START = 284;
  const LEN_CODES = 25;
  const MIN_MATCH = 2;
  const MAX_MATCH = 258;
  const BLOCK_SIZE = 16384;             // tokens per block
  const MAX_DIST_LEN2 = 0xFF;
  const MAX_DIST_LEN3 = 0x3FFF;
  const MAX_DIST_LEN4 = 0x3FFFF;

  const LEN2_OFFSETS = [0, 4, 8, 16, 32, 64, 128, 192];
  const LEN2_EXTRA_BITS = [2, 2, 3, 4, 5, 6, 6, 6];
  const LEN3_OFFSETS = [0, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192];
  const LEN3_EXTRA_BITS = [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  const LEN_OFFSETS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128, 160, 192, 224, 0];
  const LEN_EXTRA_BITS = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 5, 0];

  // Highest adjusted length that still fits the last ordinary slot; beyond it the
  // encoder falls back to the 14-bit escape in slot 308.
  const MAX_ORDINARY_ADJ_LEN = 224 + OpCodes.Shl32(1, LEN_EXTRA_BITS[23]) - 1;

  const HASH_SIZE = 32768;
  const HASH_MASK = 32767;
  const MAX_CHAIN_DEPTH = 128;

  // ===== BIT STREAM (most-significant-bit first) =====

  class SqxBitWriter {
    constructor() {
      this.bytes = [];
      this.current = 0;
      this.bitPos = 0;
    }

    writeBits(value, count) {
      for (let i = count - 1; i >= 0; --i) {
        if (OpCodes.And32(OpCodes.Shr32(value, i), 1) !== 0)
          this.current = OpCodes.Or32(this.current, OpCodes.Shl32(1, 7 - this.bitPos));
        if (++this.bitPos !== 8)
          continue;

        this.bytes.push(this.current);
        this.current = 0;
        this.bitPos = 0;
      }
    }

    toArray() {
      if (this.bitPos > 0) {
        this.bytes.push(this.current);
        this.current = 0;
        this.bitPos = 0;
      }
      return this.bytes;
    }
  }

  class SqxBitReader {
    constructor(data, startBit) {
      this.data = data;
      this.bitPos = startBit;
    }

    peekBits(count) {
      let result = 0;
      for (let i = 0; i < count; ++i) {
        const byteIdx = Math.floor((this.bitPos + i) / 8);
        const bitIdx = 7 - ((this.bitPos + i) % 8);
        result = byteIdx < this.data.length
          ? OpCodes.Or32(OpCodes.Shl32(result, 1), OpCodes.And32(OpCodes.Shr32(this.data[byteIdx], bitIdx), 1))
          : OpCodes.Shl32(result, 1);
      }
      return result;
    }

    readBits(count) {
      const value = this.peekBits(count);
      this.bitPos += count;
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
    for (let i = 0; i < lengths.length; ++i)
      if (lengths[i] > 0) kraftSum += OpCodes.Shr32(kraftMax, lengths[i]);

    while (kraftSum > kraftMax)
      for (let i = lengths.length - 1; i >= 0; --i) {
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

  // Flat lookup table always sized 2^tableBits, so a peek of tableBits is always in
  // range. Each entry packs the symbol below bit 16 and its code length above it. A
  // tree with at most one used symbol answers that symbol everywhere and costs one
  // bit, which is what a one-leaf canonical code occupies.
  function buildDecodeTable(codeLengths, numSymbols, tableBits) {
    let maxLen = 0;
    for (let i = 0; i < numSymbols; ++i)
      if (codeLengths[i] > maxLen) maxLen = codeLengths[i];
    if (maxLen === 0) maxLen = 1;
    if (maxLen > tableBits) maxLen = tableBits;

    const tableSize = OpCodes.Shl32(1, tableBits);
    const table = new Int32Array(tableSize);

    let usedCount = 0;
    let singleSym = 0;
    for (let i = 0; i < numSymbols; ++i)
      if (codeLengths[i] > 0) { ++usedCount; singleSym = i; }

    if (usedCount <= 1) {
      table.fill(OpCodes.Or32(singleSym, OpCodes.Shl32(1, 16)));
      return table;
    }

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
      const fill = OpCodes.Shl32(1, tableBits - len);
      const baseIdx = OpCodes.Shl32(c, tableBits - len);
      const entry = OpCodes.Or32(sym, OpCodes.Shl32(len, 16));
      for (let j = 0; j < fill && baseIdx + j < tableSize; ++j)
        table[baseIdx + j] = entry;
    }

    return table;
  }

  function decodeSymbol(reader, table, tableBits) {
    const entry = table[OpCodes.And32(reader.peekBits(tableBits), OpCodes.Shl32(1, tableBits) - 1)];
    const symbol = OpCodes.And32(entry, 0xFFFF);
    const codeLen = OpCodes.Shr32(entry, 16);
    reader.bitPos += codeLen > 0 ? codeLen : 1;
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

  // ===== SLOT ARITHMETIC =====

  function getLen2DistCode(distance) {
    for (let i = LEN2_CODES - 1; i >= 0; --i)
      if (distance >= LEN2_OFFSETS[i]) return i;
    return 0;
  }

  function getLen3DistCode(distance) {
    for (let i = LEN3_CODES - 1; i >= 0; --i)
      if (distance >= LEN3_OFFSETS[i]) return i;
    return 0;
  }

  // A long distance buys one length back on the decode side, so the coded length is
  // shortened by one per crossed threshold before it is slotted.
  function adjustLength(length, distance) {
    let adjusted = length - 4;
    if (distance > MAX_DIST_LEN3) --adjusted;
    if (distance > MAX_DIST_LEN4) --adjusted;
    return adjusted;
  }

  function getAdjustedLenCode(length, distance) {
    let adjLen = adjustLength(length, distance);
    if (adjLen < 0) adjLen = 0;
    if (adjLen > MAX_ORDINARY_ADJ_LEN)
      return LEN_CODES - 1;

    for (let i = 23; i >= 0; --i)
      if (adjLen >= LEN_OFFSETS[i]) return i;
    return 0;
  }

  function getDistSymbol(distance) {
    if (distance <= 2) return distance <= 1 ? 0 : 1;

    let sym = 1;
    let d = distance;
    while (d > 1) { d = OpCodes.Shr32(d, 1); ++sym; }
    return sym;
  }

  // ===== ENCODER =====

  function countMatch(data, pos, dist) {
    let len = 0;
    const maxLen = Math.min(MAX_MATCH, data.length - pos);
    while (len < maxLen && data[pos + len] === data[pos - dist + len])
      ++len;
    return len;
  }

  // Run-length coding of one code-length list into (symbol, extraBits, extraValue)
  // triples for the pre-tree.
  function runLengthEncode(lengths) {
    const result = [];
    let i = 0;

    while (i < lengths.length) {
      const value = lengths[i];

      if (value === 0) {
        let count = 1;
        while (i + count < lengths.length && lengths[i + count] === 0) ++count;

        let remaining = count;
        while (remaining > 0) {
          if (remaining >= 11) {
            const run = Math.min(remaining, 138);
            result.push([18, 7, run - 11]);
            remaining -= run;
          } else if (remaining >= 3) {
            result.push([17, 3, remaining - 3]);
            remaining = 0;
          } else {
            result.push([0, 0, 0]);
            --remaining;
          }
        }
        i += count;
        continue;
      }

      result.push([value, 0, 0]);
      ++i;

      let count = 0;
      while (i + count < lengths.length && lengths[i + count] === value) ++count;

      let remaining = count;
      while (remaining >= 3) {
        const run = Math.min(remaining, 6);
        result.push([16, 2, run - 3]);
        remaining -= run;
      }
      while (remaining > 0) {
        result.push([value, 0, 0]);
        --remaining;
      }
      i += count;
    }

    return result;
  }

  function emitRle(writer, rle, preCodes, preLengths) {
    for (let i = 0; i < rle.length; ++i) {
      const entry = rle[i];
      writer.writeBits(preCodes[entry[0]], preLengths[entry[0]]);
      if (entry[1] > 0)
        writer.writeBits(entry[2], entry[1]);
    }
  }

  function sqxCompress(input) {
    const result = [
      OpCodes.And32(input.length, 0xFF),
      OpCodes.And32(OpCodes.Shr32(input.length, 8), 0xFF),
      OpCodes.And32(OpCodes.Shr32(input.length, 16), 0xFF),
      OpCodes.And32(OpCodes.Shr32(input.length, 24), 0xFF)
    ];
    if (input.length === 0)
      return result;

    const writer = new SqxBitWriter();
    const matchFinder = new HashChainMatchFinder(DICT_SIZE, MAX_CHAIN_DEPTH);
    const prevDists = [0, 0, 0, 0];
    let prevDistIndex = 0;
    let pos = 0;

    const updateRepDists = distance => {
      prevDists[OpCodes.And32(prevDistIndex, 3)] = distance;
      ++prevDistIndex;
    };
    const advance = (from, len) => {
      for (let i = 1; i < len && from + i < input.length; ++i)
        matchFinder.insertPosition(input, from + i);
    };

    while (pos < input.length) {
      // --- collect one block of tokens ---
      const symbols = [];
      const lengths = [];
      const distances = [];

      while (pos < input.length && symbols.length < BLOCK_SIZE) {
        const match = matchFinder.findMatch(input, pos, DICT_SIZE, MAX_MATCH, MIN_MATCH);

        let bestRepIdx = -1;
        let bestRepLen = 0;
        for (let r = 0; r < 4; ++r) {
          const dist = prevDists[OpCodes.And32(prevDistIndex - r, 3)];
          if (dist === 0 || dist > pos) continue;

          const len = countMatch(input, pos, dist);
          if (len >= 4 && len > bestRepLen) {
            bestRepLen = len;
            bestRepIdx = r;
          }
        }

        const repDist = bestRepIdx >= 0 ? prevDists[OpCodes.And32(prevDistIndex - bestRepIdx, 3)] : 0;
        const repMinLen4 = 4 + (repDist > MAX_DIST_LEN3 ? 1 : 0) + (repDist > MAX_DIST_LEN4 ? 1 : 0);
        const matchMinLen4 = 4 + (match.distance > MAX_DIST_LEN3 ? 1 : 0) + (match.distance > MAX_DIST_LEN4 ? 1 : 0);

        if (bestRepLen >= match.length && bestRepLen >= repMinLen4) {
          const dist = prevDists[OpCodes.And32(prevDistIndex - bestRepIdx, 3)];
          symbols.push(REP_START + bestRepIdx);
          lengths.push(bestRepLen);
          distances.push(dist);
          updateRepDists(dist);
          advance(pos, bestRepLen);
          pos += bestRepLen;
        } else if (match.length >= matchMinLen4) {
          symbols.push(LEN_START);
          lengths.push(match.length);
          distances.push(match.distance);
          updateRepDists(match.distance);
          advance(pos, match.length);
          pos += match.length;
        } else if (match.length === 3 && match.distance <= MAX_DIST_LEN3) {
          symbols.push(LEN3_START + getLen3DistCode(match.distance - 1));
          lengths.push(3);
          distances.push(match.distance);
          updateRepDists(match.distance);
          advance(pos, 3);
          pos += 3;
        } else if (match.length === 2 && match.distance <= MAX_DIST_LEN2) {
          symbols.push(LEN2_START + getLen2DistCode(match.distance - 1));
          lengths.push(2);
          distances.push(match.distance);
          updateRepDists(match.distance);
          advance(pos, 2);
          pos += 2;
        } else {
          symbols.push(input[pos]);
          lengths.push(0);
          distances.push(0);
          ++pos;
        }
      }

      // --- frequencies ---
      const mainFreq = new Array(NC).fill(0);
      const distFreq = new Array(DIST_SLOTS).fill(0);
      let totalSymbols = 0;

      for (let i = 0; i < symbols.length; ++i) {
        const sym = symbols[i];
        ++totalSymbols;

        if (sym < 256) {
          ++mainFreq[sym];
        } else if (sym >= REP_START && sym < REP_START + REP_CODES) {
          ++mainFreq[sym];
          ++mainFreq[LEN_START + getAdjustedLenCode(lengths[i], distances[i])];
          ++totalSymbols;
        } else if (sym >= LEN2_START && sym < LEN2_START + LEN2_CODES) {
          ++mainFreq[sym];
        } else if (sym >= LEN3_START && sym < LEN3_START + LEN3_CODES) {
          ++mainFreq[sym];
        } else if (sym === LEN_START) {
          ++mainFreq[LEN_START + getAdjustedLenCode(lengths[i], distances[i])];
          const distSym = getDistSymbol(distances[i]);
          if (distSym < DIST_SLOTS) ++distFreq[distSym];
        }
      }

      // --- trees ---
      const mainLengths = buildCodeLengths(mainFreq, NC, MAIN_TREE_MAX_BITS);
      const distLengths = buildCodeLengths(distFreq, DIST_SLOTS, MAIN_TREE_MAX_BITS);
      const mainCodes = buildCanonicalCodes(mainLengths);
      const distCodes = buildCanonicalCodes(distLengths);

      const mainRle = runLengthEncode(mainLengths);
      const distRle = runLengthEncode(distLengths);

      const preFreq = new Array(PRE_TREE_SYMBOLS).fill(0);
      for (let i = 0; i < mainRle.length; ++i) ++preFreq[mainRle[i][0]];
      for (let i = 0; i < distRle.length; ++i) ++preFreq[distRle[i][0]];
      const preLengths = buildCodeLengths(preFreq, PRE_TREE_SYMBOLS, PRE_TREE_MAX_BITS);
      const preCodes = buildCanonicalCodes(preLengths);

      // --- block header ---
      writer.writeBits(totalSymbols, 16);
      for (let i = 0; i < PRE_TREE_SYMBOLS; ++i)
        writer.writeBits(preLengths[i], 4);
      emitRle(writer, mainRle, preCodes, preLengths);
      emitRle(writer, distRle, preCodes, preLengths);

      // --- tokens ---
      for (let i = 0; i < symbols.length; ++i) {
        const sym = symbols[i];
        const length = lengths[i];
        const distance = distances[i];

        if (sym < 256) {
          writer.writeBits(mainCodes[sym], mainLengths[sym]);
          continue;
        }

        if (sym >= REP_START && sym < REP_START + REP_CODES) {
          writer.writeBits(mainCodes[sym], mainLengths[sym]);
          const repLenCode = getAdjustedLenCode(length, distance);
          const repLenSym = LEN_START + repLenCode;
          writer.writeBits(mainCodes[repLenSym], mainLengths[repLenSym]);
          if (LEN_EXTRA_BITS[repLenCode] > 0)
            writer.writeBits(adjustLength(length, distance) - LEN_OFFSETS[repLenCode], LEN_EXTRA_BITS[repLenCode]);
          continue;
        }

        if (sym >= LEN2_START && sym < LEN2_START + LEN2_CODES) {
          writer.writeBits(mainCodes[sym], mainLengths[sym]);
          const idx = sym - LEN2_START;
          if (LEN2_EXTRA_BITS[idx] > 0)
            writer.writeBits((distance - 1) - LEN2_OFFSETS[idx], LEN2_EXTRA_BITS[idx]);
          continue;
        }

        if (sym >= LEN3_START && sym < LEN3_START + LEN3_CODES) {
          writer.writeBits(mainCodes[sym], mainLengths[sym]);
          const idx = sym - LEN3_START;
          if (LEN3_EXTRA_BITS[idx] > 0)
            writer.writeBits((distance - 1) - LEN3_OFFSETS[idx], LEN3_EXTRA_BITS[idx]);
          continue;
        }

        // Length 4 or more: length slot, its extra bits, then the distance tree.
        const lenCode = getAdjustedLenCode(length, distance);
        writer.writeBits(mainCodes[LEN_START + lenCode], mainLengths[LEN_START + lenCode]);

        if (lenCode === LEN_CODES - 1)
          writer.writeBits(length - 257, 14);
        else if (LEN_EXTRA_BITS[lenCode] > 0)
          writer.writeBits(adjustLength(length, distance) - LEN_OFFSETS[lenCode], LEN_EXTRA_BITS[lenCode]);

        let distSym = getDistSymbol(distance);
        if (distSym >= DIST_SLOTS) distSym = DIST_SLOTS - 1;
        writer.writeBits(distCodes[distSym], distLengths[distSym]);
        if (distSym >= 2) {
          const extraBits = distSym - 1;
          writer.writeBits(distance - OpCodes.Shl32(1, extraBits), extraBits);
        }
      }
    }

    writer.writeBits(0, 16);

    const body = writer.toArray();
    for (let i = 0; i < body.length; ++i)
      result.push(body[i]);
    return result;
  }

  // ===== DECODER =====

  function readCodeLengths(reader, preTree, count) {
    const lengths = new Array(count).fill(0);
    let i = 0;

    while (i < count) {
      const sym = decodeSymbol(reader, preTree, PRE_TREE_MAX_BITS);

      if (sym < 16) {
        lengths[i++] = sym;
      } else if (sym === 16) {
        const repeat = reader.readBits(2) + 3;
        const prev = i > 0 ? lengths[i - 1] : 0;
        for (let j = 0; j < repeat && i < count; ++j)
          lengths[i++] = prev;
      } else if (sym === 17) {
        const repeat = reader.readBits(3) + 3;
        for (let j = 0; j < repeat && i < count; ++j)
          lengths[i++] = 0;
      } else if (sym === 18) {
        const repeat = reader.readBits(7) + 11;
        for (let j = 0; j < repeat && i < count; ++j)
          lengths[i++] = 0;
      } else {
        throw new Error('SQX: invalid code-length symbol in stream');
      }
    }

    return lengths;
  }

  function decodeDistance(reader, distSym) {
    if (distSym === 0) return 1;
    if (distSym === 1) return 2;

    const extraBits = distSym - 1;
    return OpCodes.Shl32(1, extraBits) + reader.readBits(extraBits);
  }

  function sqxDecompress(input) {
    if (input.length < 4)
      return [];

    const originalSize = OpCodes.Or32(
      OpCodes.Or32(input[0], OpCodes.Shl32(input[1], 8)),
      OpCodes.Or32(OpCodes.Shl32(input[2], 16), OpCodes.Shl32(input[3], 24))
    );
    if (originalSize === 0)
      return [];

    const reader = new SqxBitReader(input.slice(4), 0);
    const output = new Array(originalSize).fill(0);
    const window = new Uint8Array(DICT_SIZE);
    const prevDists = [0, 0, 0, 0];
    let prevDistIndex = 0;
    let windowPos = 0;
    let outPos = 0;
    let lastLen = 0;
    let lastDist = 0;

    const updateRepDists = distance => {
      prevDists[OpCodes.And32(prevDistIndex, 3)] = distance;
      ++prevDistIndex;
    };
    const copyMatch = (distance, length) => {
      for (let i = 0; i < length && outPos < originalSize; ++i) {
        const b = window[OpCodes.And32(windowPos - distance, DICT_MASK)];
        output[outPos++] = b;
        window[windowPos] = b;
        windowPos = OpCodes.And32(windowPos + 1, DICT_MASK);
      }
    };

    while (outPos < originalSize) {
      const blockSymbolCount = reader.readBits(16);
      if (blockSymbolCount === 0) break;

      const preTreeLengths = new Array(PRE_TREE_SYMBOLS).fill(0);
      for (let i = 0; i < PRE_TREE_SYMBOLS; ++i)
        preTreeLengths[i] = reader.readBits(4);
      const preTree = buildDecodeTable(preTreeLengths, PRE_TREE_SYMBOLS, PRE_TREE_MAX_BITS);

      const mainLengths = readCodeLengths(reader, preTree, NC);
      const mainTree = buildDecodeTable(mainLengths, NC, MAIN_TREE_MAX_BITS);

      const distLengths = readCodeLengths(reader, preTree, DIST_SLOTS);
      const distTree = buildDecodeTable(distLengths, DIST_SLOTS, MAIN_TREE_MAX_BITS);

      let symbolsDecoded = 0;
      while (symbolsDecoded < blockSymbolCount && outPos < originalSize) {
        const sym = decodeSymbol(reader, mainTree, MAIN_TREE_MAX_BITS);
        ++symbolsDecoded;

        if (sym < 256) {
          output[outPos++] = sym;
          window[windowPos] = sym;
          windowPos = OpCodes.And32(windowPos + 1, DICT_MASK);
          continue;
        }

        if (sym === DUP_LAST_SYMBOL) {
          copyMatch(lastDist, lastLen);
          continue;
        }

        if (sym >= REP_START && sym < REP_START + REP_CODES) {
          let distance = prevDists[OpCodes.And32(prevDistIndex - (sym - REP_START), 3)];
          if (distance === 0) distance = 1;

          const lenSym = decodeSymbol(reader, mainTree, MAIN_TREE_MAX_BITS);
          let length = MIN_MATCH;
          if (lenSym >= LEN_START && lenSym < LEN_START + LEN_CODES) {
            const lenIdx = lenSym - LEN_START;
            length = LEN_OFFSETS[lenIdx] + 4;
            if (LEN_EXTRA_BITS[lenIdx] > 0)
              length += reader.readBits(LEN_EXTRA_BITS[lenIdx]);
            if (distance > MAX_DIST_LEN3) ++length;
            if (distance > MAX_DIST_LEN4) ++length;
          }
          ++symbolsDecoded;

          lastLen = length;
          lastDist = distance;
          updateRepDists(distance);
          copyMatch(distance, length);
          continue;
        }

        if (sym >= LEN2_START && sym < LEN2_START + LEN2_CODES) {
          const idx = sym - LEN2_START;
          let distance = LEN2_OFFSETS[idx];
          if (LEN2_EXTRA_BITS[idx] > 0)
            distance += reader.readBits(LEN2_EXTRA_BITS[idx]);
          ++distance;

          lastLen = 2;
          lastDist = distance;
          updateRepDists(distance);
          copyMatch(distance, 2);
          continue;
        }

        if (sym >= LEN3_START && sym < LEN3_START + LEN3_CODES) {
          const idx = sym - LEN3_START;
          let distance = LEN3_OFFSETS[idx];
          if (LEN3_EXTRA_BITS[idx] > 0)
            distance += reader.readBits(LEN3_EXTRA_BITS[idx]);
          ++distance;

          lastLen = 3;
          lastDist = distance;
          updateRepDists(distance);
          copyMatch(distance, 3);
          continue;
        }

        if (sym >= LEN_START && sym < LEN_START + LEN_CODES) {
          const lenIdx = sym - LEN_START;
          let length;

          if (lenIdx === LEN_CODES - 1) {
            length = reader.readBits(14) + 257;
          } else {
            length = LEN_OFFSETS[lenIdx] + 4;
            if (LEN_EXTRA_BITS[lenIdx] > 0)
              length += reader.readBits(LEN_EXTRA_BITS[lenIdx]);
          }

          const distance = decodeDistance(reader, decodeSymbol(reader, distTree, MAIN_TREE_MAX_BITS));

          if (lenIdx !== LEN_CODES - 1) {
            if (distance > MAX_DIST_LEN3) ++length;
            if (distance > MAX_DIST_LEN4) ++length;
          }

          lastLen = length;
          lastDist = distance;
          updateRepDists(distance);
          copyMatch(distance, length);
        }
      }
    }

    return output;
  }

  // ===== ALGORITHM =====

  class SqxCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "SQX";
      this.description = "The SQX archiver's LZH method: an LZ77 matcher over a 32 KiB dictionary feeding a 310-symbol main tree that folds literals, four repeated-distance slots, length-2 and length-3 matches with inline distances, and 25 length-4-or-more slots into one alphabet, alongside a 48-slot distance tree. Per-block code lengths travel through a 19-symbol pre-tree written as raw 4-bit fields, and all bit fields are most-significant-bit first.";
      this.inventor = "Rainer Nausedat";
      this.year = 2004;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.DE;

      this.documentation = [
        new LinkItem("fileformat.com - SQX File Format", "https://docs.fileformat.com/compression/sqx/"),
        new LinkItem("Canonical Huffman code", "https://en.wikipedia.org/wiki/Canonical_Huffman_code")
      ];

      this.references = [
        new LinkItem("Storer and Szymanski, Data compression via textual substitution, 1982", "https://dl.acm.org/doi/10.1145/322344.322346"),
        new LinkItem("Huffman, A Method for the Construction of Minimum-Redundancy Codes, 1952", "https://en.wikipedia.org/wiki/Huffman_coding")
      ];

      this.tests = [
        {
          text: "Empty input - length header only",
          uri: "https://docs.fileformat.com/compression/sqx/",
          input: [],
          expected: [0x00, 0x00, 0x00, 0x00]
        },
        {
          text: "Single byte 'A' - one literal",
          uri: "https://docs.fileformat.com/compression/sqx/",
          input: [0x41],
          expected: [
            0x01, 0x00, 0x00, 0x00, 0x00, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x1B, 0x67, 0xFE, 0xFD, 0x28, 0x00, 0x00
          ]
        },
        {
          text: "Repeated byte run - one literal then a length-4-or-more match",
          uri: "https://docs.fileformat.com/compression/sqx/",
          input: OpCodes.AnsiToBytes("aaaaaaaaaaaaaaaa"),
          expected: [
            0x10, 0x00, 0x00, 0x00, 0x00, 0x02, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x1D, 0x67, 0xFD, 0x72, 0x15, 0x48, 0xC0, 0x00, 0x00
          ]
        },
        {
          text: "Periodic text - literals then a match carrying extra length bits",
          uri: "https://docs.fileformat.com/compression/sqx/",
          input: OpCodes.AnsiToBytes("abcabcabcabcabcabcab"),
          expected: [
            0x14, 0x00, 0x00, 0x00, 0x00, 0x04, 0x33, 0x20, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x15, 0x6A, 0x9F, 0xCB, 0x60, 0x4D, 0xB9, 0x10, 0xDA,
            0x80, 0x00, 0x00
          ]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new SqxInstance(this, isInverse);
    }
  }

  class SqxInstance extends IAlgorithmInstance {
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
      return this.isInverse ? sqxDecompress(data) : sqxCompress(data);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new SqxCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SqxCompression, SqxInstance };
}));
