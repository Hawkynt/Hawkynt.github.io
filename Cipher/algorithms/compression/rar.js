/*
 * RAR3 (classic) Compression Algorithm
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The classic RAR method is the one introduced with RAR 3.x and carried through
 * RAR 4.x: LZ77 matching over a dictionary of up to 4 MiB, four repeat-offset
 * slots, and four Huffman tables whose code lengths are transmitted as deltas
 * against the previous block. It is a different algorithm from RAR5, which
 * lives in rar5.js. RAR3's optional PPMd mode and its virtual-machine data
 * filters are not produced here; the stream always opens with a zero bit, the
 * flag that selects the LZ coder over PPMd.
 *
 * The four tables:
 *   main    299 symbols - 0-255 literals, 256 end of block or filter, 257 end of
 *           data, 258 repeat the last match with length 2, 259-262 replay one of
 *           the four recent distances (a repeat-length symbol follows), and
 *           263-298 a new match whose length slot has base 3, 4, ... 227 with up
 *           to 5 extra bits. A distance symbol follows
 *   dist     60 slots - slots 0-3 are distances 1-4; slot s above that has
 *           bits = s/2 - 1 and base ((2 | (s & 1)) shifted left by bits) + 1
 *   lowdist  17 symbols - the low four bits of a distance whose slot carries at
 *           least four extra bits; the bits above those four are raw
 *   replen   28 symbols - the length of a repeat-offset match, base 2, 3, ... 226
 *
 * Wire format produced here - a 4-byte little-endian uncompressed length
 * followed by the RAR3 bit stream: one zero bit, then twenty raw 4-bit code
 * lengths for the code-length tree, then the four tables' code lengths through
 * that tree (0-15 a delta modulo 16 against the previous block, 16 repeats the
 * previous length 3-6 times, 17 runs 3-10 zeros, 18 runs 11-138 zeros), then
 * the tokens. All bit fields are most-significant-bit first.
 *
 * Documentation and references:
 *   - https://en.wikipedia.org/wiki/RAR_(file_format) - overview of the format
 *     and its dictionary sizes per version
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

  // ===== RAR3 CONSTANTS =====

  const WINDOW_SIZE = 4194304;          // 4 MiB, the RAR3 maximum
  const WINDOW_MASK = 4194303;
  const MAIN_TABLE_SIZE = 299;
  const DIST_TABLE_SIZE = 60;
  const LOW_DIST_TABLE_SIZE = 17;
  const REP_LEN_TABLE_SIZE = 28;
  const CODE_LENGTH_TABLE_SIZE = 20;
  const MAX_CODE_LENGTH = 15;
  const MAX_MATCH_LENGTH = 258;
  const MAX_REP_MATCH_LENGTH = 257;
  const MIN_MATCH = 3;

  // Length slots: the first 28 serve the repeat-length table, all 36 the main table.
  const LEN_BITS = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0];
  const LEN_BASE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768];

  const HASH_SIZE = 32768;
  const HASH_MASK = 32767;
  const MAX_CHAIN_DEPTH = 128;

  const TOKEN_LITERAL = 0;
  const TOKEN_MATCH = 1;
  const TOKEN_REPEAT_LAST = 2;
  const TOKEN_REPEAT_OFFSET = 3;

  // ===== BIT STREAM (most-significant-bit first) =====

  class Rar3BitWriter {
    constructor() {
      this.bytes = [];
      this.bitBuffer = 0;
      this.bitsUsed = 0;
    }

    writeBits(value, count) {
      const masked = OpCodes.And32(value, OpCodes.Shl32(1, count) - 1);
      this.bitBuffer = OpCodes.Or32(this.bitBuffer, OpCodes.Shl32(masked, 32 - this.bitsUsed - count));
      this.bitsUsed += count;

      while (this.bitsUsed >= 8) {
        this.bytes.push(OpCodes.Shr32(this.bitBuffer, 24));
        this.bitBuffer = OpCodes.Shl32(this.bitBuffer, 8);
        this.bitsUsed -= 8;
      }
    }

    toArray() {
      while (this.bitsUsed > 0) {
        this.bytes.push(OpCodes.Shr32(this.bitBuffer, 24));
        this.bitBuffer = OpCodes.Shl32(this.bitBuffer, 8);
        this.bitsUsed -= 8;
      }
      return this.bytes;
    }
  }

  // Huffman decoding peeks a full code-length window before it knows how long the
  // current code actually is, so the last codes of a stream need lookahead past
  // the final payload byte. Reads past the end yield zero bits, which is what a
  // decoder reading a packed block inside a larger archive sees as padding.
  class Rar3BitReader {
    constructor(data, startByte) {
      this.data = data;
      this.bitPos = startByte * 8;
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

    dropBits(count) {
      this.bitPos += count;
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

  // Canonical numbering: shortest codes first, equal lengths in ascending symbol
  // order, written most-significant-bit first so no reversal is needed.
  function buildCanonicalCodes(lengths, numSymbols) {
    let maxLen = 0;
    for (let i = 0; i < numSymbols; ++i)
      if (lengths[i] > maxLen) maxLen = lengths[i];

    const codes = new Array(numSymbols).fill(0);
    if (maxLen === 0)
      return codes;

    const blCount = new Array(maxLen + 1).fill(0);
    for (let i = 0; i < numSymbols; ++i)
      if (lengths[i] > 0) ++blCount[lengths[i]];

    const nextCode = new Array(maxLen + 1).fill(0);
    let code = 0;
    for (let b = 1; b <= maxLen; ++b) {
      code = OpCodes.Shl32(code + blCount[b - 1], 1);
      nextCode[b] = code;
    }

    for (let i = 0; i < numSymbols; ++i)
      if (lengths[i] > 0) codes[i] = nextCode[lengths[i]]++;

    return codes;
  }

  class Rar3HuffmanEncoder {
    constructor(frequencies, numSymbols) {
      this.codeLengths = buildCodeLengths(frequencies, numSymbols, MAX_CODE_LENGTH);
      this.codes = buildCanonicalCodes(this.codeLengths, numSymbols);
    }

    encodeSymbol(writer, symbol) {
      writer.writeBits(this.codes[symbol], this.codeLengths[symbol]);
    }
  }

  // Flat lookup table over the widest code in the tree. Entries the canonical
  // numbering never reaches keep symbol -1 and reject the stream.
  function buildDecodeTable(codeLengths, numSymbols) {
    let maxBits = 0;
    for (let i = 0; i < numSymbols; ++i)
      if (codeLengths[i] > maxBits) maxBits = codeLengths[i];
    if (maxBits === 0) maxBits = 1;
    if (maxBits > MAX_CODE_LENGTH) maxBits = MAX_CODE_LENGTH;

    const tableSize = OpCodes.Shl32(1, maxBits);
    const symbols = new Int32Array(tableSize).fill(-1);
    const lengths = new Int32Array(tableSize);

    const blCount = new Array(MAX_CODE_LENGTH + 1).fill(0);
    for (let i = 0; i < numSymbols; ++i)
      if (codeLengths[i] > 0) ++blCount[codeLengths[i]];

    const nextCode = new Array(MAX_CODE_LENGTH + 1).fill(0);
    let code = 0;
    for (let bits = 1; bits <= maxBits; ++bits) {
      code = OpCodes.Shl32(code + blCount[bits - 1], 1);
      nextCode[bits] = code;
    }

    for (let sym = 0; sym < numSymbols; ++sym) {
      const len = codeLengths[sym];
      if (len <= 0 || len > maxBits) continue;

      const c = nextCode[len]++;
      const prefix = OpCodes.Shl32(c, maxBits - len);
      const count = OpCodes.Shl32(1, maxBits - len);
      for (let j = 0; j < count && prefix + j < tableSize; ++j) {
        symbols[prefix + j] = sym;
        lengths[prefix + j] = len;
      }
    }

    return { symbols: symbols, lengths: lengths, maxBits: maxBits };
  }

  function decodeSymbol(reader, decoder) {
    const peek = reader.peekBits(decoder.maxBits);
    const sym = decoder.symbols[peek];
    if (sym < 0)
      throw new Error('RAR3: invalid Huffman code in stream');

    reader.dropBits(decoder.lengths[peek]);
    return sym;
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

  function getLenSlot(length, maxSlots) {
    for (let i = Math.min(maxSlots, LEN_BASE.length) - 1; i >= 0; --i) {
      if (length < LEN_BASE[i]) continue;

      const maxExtra = LEN_BITS[i] > 0 ? OpCodes.Shl32(1, LEN_BITS[i]) - 1 : 0;
      if (length <= LEN_BASE[i] + maxExtra)
        return i;
    }
    return 0;
  }

  function getDistSlot(distance) {
    if (distance <= 4) return distance - 1;

    const d = distance - 1;
    const highBit = 31 - Math.clz32(d);
    const bits = highBit - 1;
    const lowBit = OpCodes.And32(OpCodes.Shr32(d, bits), 1);
    return bits * 2 + 2 + lowBit;
  }

  function distSlotExtraBits(distSlot) {
    return Math.floor(distSlot / 2) - 1;
  }

  function distSlotBase(distSlot) {
    return OpCodes.Shl32(OpCodes.Or32(2, OpCodes.And32(distSlot, 1)), distSlotExtraBits(distSlot)) + 1;
  }

  // A Huffman table with no used symbol has no code to write, so give it one.
  function ensureNonEmpty(frequencies) {
    for (let i = 0; i < frequencies.length; ++i)
      if (frequencies[i] > 0) return;
    frequencies[0] = 1;
  }

  // ===== ENCODER =====

  // Code lengths travel as deltas modulo 16 against the previous block's lengths,
  // run-length coded through the 20-symbol code-length tree.
  function buildRleSequence(codeLengths, prevLengths, numSymbols) {
    const rle = [];
    let i = 0;

    while (i < numSymbols) {
      const delta = OpCodes.And32(codeLengths[i] - prevLengths[i], 0x0F);

      if (codeLengths[i] === 0 && delta === 0) {
        const runStart = i;
        while (i < numSymbols && codeLengths[i] === 0
            && OpCodes.And32(codeLengths[i] - prevLengths[i], 0x0F) === 0)
          ++i;

        let run = i - runStart;
        while (run > 0) {
          if (run >= 11) {
            const count = Math.min(run, 138);
            rle.push([18, 7, count - 11]);
            run -= count;
          } else if (run >= 3) {
            rle.push([17, 3, run - 3]);
            run = 0;
          } else {
            rle.push([0, 0, 0]);
            --run;
          }
        }
        continue;
      }

      if (delta === 0) {
        rle.push([0, 0, 0]);
        const unchanged = codeLengths[i];
        ++i;

        let rep = 0;
        while (i < numSymbols && codeLengths[i] === unchanged
            && OpCodes.And32(codeLengths[i] - prevLengths[i], 0x0F) === 0 && rep < 6) {
          ++rep;
          ++i;
        }

        while (rep >= 3) {
          const batch = Math.min(rep, 6);
          rle.push([16, 2, batch - 3]);
          rep -= batch;
        }
        while (rep > 0) {
          rle.push([0, 0, 0]);
          --rep;
        }
        continue;
      }

      rle.push([delta, 0, 0]);
      const repeated = codeLengths[i];
      ++i;

      let rep = 0;
      while (i < numSymbols && codeLengths[i] === repeated && rep < 6) {
        ++rep;
        ++i;
      }

      while (rep >= 3) {
        const batch = Math.min(rep, 6);
        rle.push([16, 2, batch - 3]);
        rep -= batch;
      }
      while (rep > 0) {
        rle.push([OpCodes.And32(codeLengths[i - rep] - prevLengths[i - rep], 0x0F), 0, 0]);
        --rep;
      }
    }

    return rle;
  }

  function writeRle(writer, rle, clEncoder) {
    for (let i = 0; i < rle.length; ++i) {
      const entry = rle[i];
      clEncoder.encodeSymbol(writer, entry[0]);
      if (entry[1] > 0)
        writer.writeBits(entry[2], entry[1]);
    }
  }

  function rar3Compress(input) {
    const result = [
      OpCodes.And32(input.length, 0xFF),
      OpCodes.And32(OpCodes.Shr32(input.length, 8), 0xFF),
      OpCodes.And32(OpCodes.Shr32(input.length, 16), 0xFF),
      OpCodes.And32(OpCodes.Shr32(input.length, 24), 0xFF)
    ];
    if (input.length === 0)
      return result;

    const writer = new Rar3BitWriter();
    writer.writeBits(0, 1); // 0 selects the LZ coder, 1 would select PPMd

    // --- token collection ---
    const matchFinder = new HashChainMatchFinder(WINDOW_SIZE, MAX_CHAIN_DEPTH);
    const rep = [0, 0, 0, 0];
    const types = [];
    const literals = [];
    const lengths = [];
    const distances = [];
    const repIndices = [];
    let pos = 0;

    const push = (type, literal, length, distance, repIndex) => {
      types.push(type);
      literals.push(literal);
      lengths.push(length);
      distances.push(distance);
      repIndices.push(repIndex);
    };

    while (pos < input.length) {
      const match = matchFinder.findMatch(input, pos, WINDOW_SIZE, MAX_MATCH_LENGTH, MIN_MATCH);

      if (match.length >= MIN_MATCH) {
        let repIdx = -1;
        for (let r = 0; r < 4; ++r)
          if (rep[r] === match.distance) { repIdx = r; break; }

        let effectiveLen = match.length;

        if (repIdx >= 0) {
          if (effectiveLen > MAX_REP_MATCH_LENGTH) effectiveLen = MAX_REP_MATCH_LENGTH;
          push(TOKEN_REPEAT_OFFSET, 0, effectiveLen, 0, repIdx);

          const dist = rep[repIdx];
          for (let i = repIdx; i > 0; --i)
            rep[i] = rep[i - 1];
          rep[0] = dist;
        } else {
          push(TOKEN_MATCH, 0, effectiveLen, match.distance, 0);

          rep[3] = rep[2];
          rep[2] = rep[1];
          rep[1] = rep[0];
          rep[0] = match.distance;
        }

        for (let i = 1; i < effectiveLen && pos + i < input.length; ++i)
          matchFinder.insertPosition(input, pos + i);
        pos += effectiveLen;
        continue;
      }

      // No match long enough, but a two-byte replay of the last distance still
      // beats spending two literals on it.
      if (rep[0] > 0 && pos + 2 <= input.length && pos >= rep[0]
          && input[pos] === input[pos - rep[0]] && input[pos + 1] === input[pos + 1 - rep[0]]) {
        push(TOKEN_REPEAT_LAST, 0, 0, 0, 0);
        matchFinder.insertPosition(input, pos);
        if (pos + 1 < input.length) matchFinder.insertPosition(input, pos + 1);
        pos += 2;
        continue;
      }

      push(TOKEN_LITERAL, input[pos], 0, 0, 0);
      matchFinder.insertPosition(input, pos);
      ++pos;
    }

    // --- frequencies ---
    const mainFreq = new Array(MAIN_TABLE_SIZE).fill(0);
    const distFreq = new Array(DIST_TABLE_SIZE).fill(0);
    const lowDistFreq = new Array(LOW_DIST_TABLE_SIZE).fill(0);
    const repLenFreq = new Array(REP_LEN_TABLE_SIZE).fill(0);

    for (let i = 0; i < types.length; ++i) {
      const type = types[i];

      if (type === TOKEN_LITERAL) {
        ++mainFreq[literals[i]];
      } else if (type === TOKEN_REPEAT_LAST) {
        ++mainFreq[258];
      } else if (type === TOKEN_REPEAT_OFFSET) {
        ++mainFreq[259 + repIndices[i]];
        ++repLenFreq[getLenSlot(lengths[i] - 2, REP_LEN_TABLE_SIZE)];
      } else {
        ++mainFreq[263 + getLenSlot(lengths[i] - 3, 36)];

        const distSlot = getDistSlot(distances[i]);
        ++distFreq[distSlot];
        if (distSlot >= 4 && distSlotExtraBits(distSlot) >= 4)
          ++lowDistFreq[OpCodes.And32(distances[i] - distSlotBase(distSlot), 0xF)];
      }
    }

    ensureNonEmpty(mainFreq);
    ensureNonEmpty(distFreq);
    ensureNonEmpty(lowDistFreq);
    ensureNonEmpty(repLenFreq);

    const mainEnc = new Rar3HuffmanEncoder(mainFreq, MAIN_TABLE_SIZE);
    const distEnc = new Rar3HuffmanEncoder(distFreq, DIST_TABLE_SIZE);
    const lowDistEnc = new Rar3HuffmanEncoder(lowDistFreq, LOW_DIST_TABLE_SIZE);
    const repLenEnc = new Rar3HuffmanEncoder(repLenFreq, REP_LEN_TABLE_SIZE);

    // --- tables ---
    // A standalone stream is one block, so there is no previous block to delta
    // against and every previous length is zero.
    const rleMain = buildRleSequence(mainEnc.codeLengths, new Array(MAIN_TABLE_SIZE).fill(0), MAIN_TABLE_SIZE);
    const rleDist = buildRleSequence(distEnc.codeLengths, new Array(DIST_TABLE_SIZE).fill(0), DIST_TABLE_SIZE);
    const rleLowDist = buildRleSequence(lowDistEnc.codeLengths, new Array(LOW_DIST_TABLE_SIZE).fill(0), LOW_DIST_TABLE_SIZE);
    const rleRepLen = buildRleSequence(repLenEnc.codeLengths, new Array(REP_LEN_TABLE_SIZE).fill(0), REP_LEN_TABLE_SIZE);

    const clFreq = new Array(CODE_LENGTH_TABLE_SIZE).fill(0);
    const allRle = [rleMain, rleDist, rleLowDist, rleRepLen];
    for (let t = 0; t < allRle.length; ++t)
      for (let i = 0; i < allRle[t].length; ++i)
        ++clFreq[allRle[t][i][0]];
    ensureNonEmpty(clFreq);

    const clEnc = new Rar3HuffmanEncoder(clFreq, CODE_LENGTH_TABLE_SIZE);
    for (let i = 0; i < CODE_LENGTH_TABLE_SIZE; ++i)
      writer.writeBits(clEnc.codeLengths[i], 4);

    writeRle(writer, rleMain, clEnc);
    writeRle(writer, rleDist, clEnc);
    writeRle(writer, rleLowDist, clEnc);
    writeRle(writer, rleRepLen, clEnc);

    // --- tokens ---
    for (let i = 0; i < types.length; ++i) {
      const type = types[i];

      if (type === TOKEN_LITERAL) {
        mainEnc.encodeSymbol(writer, literals[i]);
        continue;
      }

      if (type === TOKEN_REPEAT_LAST) {
        mainEnc.encodeSymbol(writer, 258);
        continue;
      }

      if (type === TOKEN_REPEAT_OFFSET) {
        mainEnc.encodeSymbol(writer, 259 + repIndices[i]);
        const repLength = lengths[i] - 2;
        const repLenSlot = getLenSlot(repLength, REP_LEN_TABLE_SIZE);
        repLenEnc.encodeSymbol(writer, repLenSlot);
        if (LEN_BITS[repLenSlot] > 0)
          writer.writeBits(repLength - LEN_BASE[repLenSlot], LEN_BITS[repLenSlot]);
        continue;
      }

      const length = lengths[i] - 3;
      const lenSlot = getLenSlot(length, 36);
      mainEnc.encodeSymbol(writer, 263 + lenSlot);
      if (LEN_BITS[lenSlot] > 0)
        writer.writeBits(length - LEN_BASE[lenSlot], LEN_BITS[lenSlot]);

      const distSlot = getDistSlot(distances[i]);
      distEnc.encodeSymbol(writer, distSlot);
      if (distSlot < 4)
        continue;

      const bits = distSlotExtraBits(distSlot);
      const extra = distances[i] - distSlotBase(distSlot);
      if (bits >= 4) {
        if (bits > 4)
          writer.writeBits(OpCodes.Shr32(extra, 4), bits - 4);
        lowDistEnc.encodeSymbol(writer, OpCodes.And32(extra, 0xF));
      } else if (bits > 0) {
        writer.writeBits(extra, bits);
      }
    }

    const body = writer.toArray();
    for (let i = 0; i < body.length; ++i)
      result.push(body[i]);
    return result;
  }

  // ===== DECODER =====

  function readTableLengths(reader, clDecoder, lengths, count) {
    let i = 0;
    while (i < count) {
      const sym = decodeSymbol(reader, clDecoder);

      if (sym < 16) {
        lengths[i] = OpCodes.And32(lengths[i] + sym, 0x0F);
        ++i;
      } else if (sym === 16) {
        if (i === 0)
          throw new Error('RAR3: table repeat at start');

        let repeat = 3 + reader.readBits(2);
        const prev = lengths[i - 1];
        while (repeat-- > 0 && i < count)
          lengths[i++] = prev;
      } else if (sym === 17) {
        let repeat = 3 + reader.readBits(3);
        while (repeat-- > 0 && i < count)
          lengths[i++] = 0;
      } else if (sym === 18) {
        let repeat = 11 + reader.readBits(7);
        while (repeat-- > 0 && i < count)
          lengths[i++] = 0;
      } else {
        throw new Error('RAR3: invalid code-length symbol in stream');
      }
    }
  }

  function rar3Decompress(input) {
    if (input.length < 4)
      return [];

    const unpackedSize = OpCodes.Or32(
      OpCodes.Or32(input[0], OpCodes.Shl32(input[1], 8)),
      OpCodes.Or32(OpCodes.Shl32(input[2], 16), OpCodes.Shl32(input[3], 24))
    );
    if (unpackedSize === 0)
      return [];

    const reader = new Rar3BitReader(input, 4);
    const output = new Array(unpackedSize).fill(0);
    const window = new Uint8Array(WINDOW_SIZE);
    const rep = [0, 0, 0, 0];
    let windowPos = 0;
    let outPos = 0;

    const mainLens = new Array(MAIN_TABLE_SIZE).fill(0);
    const distLens = new Array(DIST_TABLE_SIZE).fill(0);
    const lowDistLens = new Array(LOW_DIST_TABLE_SIZE).fill(0);
    const repLenLens = new Array(REP_LEN_TABLE_SIZE).fill(0);
    let tablesRead = false;

    const copyMatch = (distance, length) => {
      for (let i = 0; i < length && outPos < unpackedSize; ++i) {
        const b = window[OpCodes.And32(windowPos - distance, WINDOW_MASK)];
        window[OpCodes.And32(windowPos, WINDOW_MASK)] = b;
        ++windowPos;
        output[outPos++] = b;
      }
    };

    while (outPos < unpackedSize) {
      if (!tablesRead) {
        if (reader.readBits(1) !== 0)
          throw new Error('RAR3: the PPMd coder is not implemented');

        const clLens = new Array(CODE_LENGTH_TABLE_SIZE).fill(0);
        for (let i = 0; i < CODE_LENGTH_TABLE_SIZE; ++i)
          clLens[i] = reader.readBits(4);
        const clDecoder = buildDecodeTable(clLens, CODE_LENGTH_TABLE_SIZE);

        readTableLengths(reader, clDecoder, mainLens, MAIN_TABLE_SIZE);
        readTableLengths(reader, clDecoder, distLens, DIST_TABLE_SIZE);
        readTableLengths(reader, clDecoder, lowDistLens, LOW_DIST_TABLE_SIZE);
        readTableLengths(reader, clDecoder, repLenLens, REP_LEN_TABLE_SIZE);
        tablesRead = true;
      }

      const mainDecoder = buildDecodeTable(mainLens, MAIN_TABLE_SIZE);
      const distDecoder = buildDecodeTable(distLens, DIST_TABLE_SIZE);
      const lowDistDecoder = buildDecodeTable(lowDistLens, LOW_DIST_TABLE_SIZE);
      const repLenDecoder = buildDecodeTable(repLenLens, REP_LEN_TABLE_SIZE);

      while (outPos < unpackedSize) {
        const sym = decodeSymbol(reader, mainDecoder);

        if (sym < 256) {
          window[OpCodes.And32(windowPos, WINDOW_MASK)] = sym;
          ++windowPos;
          output[outPos++] = sym;
          continue;
        }

        if (sym === 256) {
          // End of block: a set bit means the four tables follow again, a clear
          // bit introduces a virtual-machine filter, which this coder never emits.
          if (reader.readBits(1) === 0)
            throw new Error('RAR3: virtual-machine filter blocks are not implemented');

          tablesRead = false;
          break;
        }

        if (sym === 257)
          break;

        if (sym === 258) {
          copyMatch(rep[0], 2);
          continue;
        }

        if (sym < 263) {
          const repIdx = sym - 259;
          const dist = rep[repIdx];
          for (let i = repIdx; i > 0; --i)
            rep[i] = rep[i - 1];
          rep[0] = dist;

          const lenSym = decodeSymbol(reader, repLenDecoder);
          let repLength = LEN_BASE[lenSym] + 2;
          if (LEN_BITS[lenSym] > 0)
            repLength += reader.readBits(LEN_BITS[lenSym]);

          copyMatch(dist, repLength);
          continue;
        }

        const lenCode = sym - 263;
        let length = LEN_BASE[lenCode] + 3;
        if (LEN_BITS[lenCode] > 0)
          length += reader.readBits(LEN_BITS[lenCode]);

        const distSym = decodeSymbol(reader, distDecoder);
        let distance;
        if (distSym < 4) {
          distance = distSym + 1;
        } else {
          const bits = distSlotExtraBits(distSym);
          distance = distSlotBase(distSym);
          if (bits >= 4) {
            if (bits > 4)
              distance += OpCodes.Shl32(reader.readBits(bits - 4), 4);
            distance += decodeSymbol(reader, lowDistDecoder);
          } else if (bits > 0) {
            distance += reader.readBits(bits);
          }
        }

        rep[3] = rep[2];
        rep[2] = rep[1];
        rep[1] = rep[0];
        rep[0] = distance;

        copyMatch(distance, length);
      }
    }

    return output;
  }

  // ===== ALGORITHM =====

  class RarCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "RAR3 (classic)";
      this.description = "The classic RAR method of RAR 3.x and 4.x: LZ77 matching over a 4 MiB dictionary with four repeat-offset slots, coded through four Huffman tables - a 299-symbol main table of literals, repeat markers and match-length slots, a 60-slot distance table, a 17-symbol low-distance table carrying the bottom four bits of long distances, and a 28-symbol repeat-length table. Table code lengths travel as deltas modulo 16 through a 20-symbol code-length tree. LZ mode only; the optional PPMd coder and the virtual-machine filters are not produced.";
      this.inventor = "Eugene Roshal";
      this.year = 2002;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.documentation = [
        new LinkItem("RAR (file format)", "https://en.wikipedia.org/wiki/RAR_(file_format)"),
        new LinkItem("Canonical Huffman code", "https://en.wikipedia.org/wiki/Canonical_Huffman_code")
      ];

      this.references = [
        new LinkItem("Storer and Szymanski, Data compression via textual substitution, 1982", "https://dl.acm.org/doi/10.1145/322344.322346"),
        new LinkItem("Huffman, A Method for the Construction of Minimum-Redundancy Codes, 1952", "https://en.wikipedia.org/wiki/Huffman_coding")
      ];

      this.tests = [
        {
          text: "Empty input - length header only",
          uri: "https://en.wikipedia.org/wiki/RAR_(file_format)",
          input: [],
          expected: [0x00, 0x00, 0x00, 0x00]
        },
        {
          text: "Single byte 'A' - one literal",
          uri: "https://en.wikipedia.org/wiki/RAR_(file_format)",
          input: [0x41],
          expected: [
            0x01, 0x00, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x08, 0x5B, 0x3F, 0xF5, 0x16, 0x08, 0x54, 0x80
          ]
        },
        {
          text: "Repeated byte run - one literal then a match",
          uri: "https://en.wikipedia.org/wiki/RAR_(file_format)",
          input: OpCodes.AnsiToBytes("aaaaaaaaaaaaaaaa"),
          expected: [
            0x10, 0x00, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x08, 0x6B, 0x3F, 0xE6, 0x91, 0xCB, 0x04, 0x2A, 0x41, 0x00
          ]
        },
        {
          text: "Periodic text - literals then a match carrying extra length bits",
          uri: "https://en.wikipedia.org/wiki/RAR_(file_format)",
          input: OpCodes.AnsiToBytes("abcabcabcabcabcabcab"),
          expected: [
            0x14, 0x00, 0x00, 0x00, 0x19, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x08, 0x2B, 0x54, 0xFE, 0x33, 0x06, 0xED, 0xCB, 0xB8, 0x2F, 0x10,
            0x1B, 0x00
          ]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new RarInstance(this, isInverse);
    }
  }

  class RarInstance extends IAlgorithmInstance {
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
      return this.isInverse ? rar3Decompress(data) : rar3Compress(data);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new RarCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RarCompression, RarInstance };
}));
