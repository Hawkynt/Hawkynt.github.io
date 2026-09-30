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
  /** @type {int32[]} */
  const LEN_BITS = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0];
  /** @type {int32[]} */
  const LEN_BASE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768];

  const HASH_SIZE = 32768;
  const HASH_MASK = 32767;
  const MAX_CHAIN_DEPTH = 128;

  const TOKEN_LITERAL = 0;
  const TOKEN_MATCH = 1;
  const TOKEN_REPEAT_LAST = 2;
  const TOKEN_REPEAT_OFFSET = 3;

  /**
   * @param {int32} size - Number of entries
   * @param {int32} value - Initial value of every entry
   * @returns {int32[]} Plain array filled with value
   */
  function filledArray(size, value) {
    /** @type {int32[]} */
    const arr = new Array(size);
    for (let i = 0; i < size; ++i) {
      arr[i] = value;
    }
    return arr;
  }

  // ===== BIT STREAM (most-significant-bit first) =====

  class Rar3BitWriter {
    constructor() {
      /** @type {uint8[]} */
      this.bytes = [];
      /** @type {uint32} */
      this.bitBuffer = 0;
      /** @type {int32} */
      this.bitsUsed = 0;
    }

    /**
     * @param {uint32} value - Value whose low count bits are written
     * @param {int32} count - Bit count, most significant first
     */
    writeBits(value, count) {
      /** @type {int32} */
      const mask = OpCodes.Shl32(1, count) - 1;
      /** @type {uint32} */
      const masked = OpCodes.And32(value, mask);
      this.bitBuffer = OpCodes.Or32(this.bitBuffer, OpCodes.Shl32(masked, 32 - this.bitsUsed - count));
      this.bitsUsed += count;

      while (this.bitsUsed >= 8) {
        this.bytes.push(OpCodes.Shr32(this.bitBuffer, 24));
        this.bitBuffer = OpCodes.Shl32(this.bitBuffer, 8);
        this.bitsUsed -= 8;
      }
    }

    /**
     * @returns {uint8[]} All bytes written, the last one zero-padded
     */
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
    /**
     * @param {uint8[]} data - Input
     * @param {int32} startByte - First byte of the bit stream
     */
    constructor(data, startByte) {
      /** @type {uint8[]} */
      this.data = data;
      /** @type {float64} */
      this.bitPos = startByte * 8;
    }

    /**
     * @param {int32} count - Bit count
     * @returns {uint32} Next count bits, not consumed
     */
    peekBits(count) {
      /** @type {uint32} */
      let result = 0;
      for (let i = 0; i < count; ++i) {
        /** @type {float64} */
        const byteIdx = Math.floor((this.bitPos + i) / 8);
        /** @type {int32} */
        const bitIdx = 7 - ((this.bitPos + i) % 8);
        if (byteIdx < this.data.length) {
          result = OpCodes.Or32(OpCodes.Shl32(result, 1), OpCodes.And32(OpCodes.Shr32(this.data[byteIdx], bitIdx), 1));
        } else {
          result = OpCodes.Shl32(result, 1);
        }
      }
      return result;
    }

    /**
     * @param {int32} count - Bits to consume
     */
    dropBits(count) {
      this.bitPos += count;
    }

    /**
     * @param {int32} count - Bit count
     * @returns {uint32} Next count bits
     */
    readBits(count) {
      /** @type {uint32} */
      const value = this.peekBits(count);
      this.bitPos += count;
      return value;
    }
  }

  // ===== HUFFMAN =====

  // Deterministic code lengths, clamped to maxBits and then lengthened from the
  // back until the Kraft sum fits again.
  /**
   * @param {int32[]} frequencies - Frequency per symbol
   * @param {int32} numSymbols - Alphabet size
   * @param {int32} maxBits - Longest allowed code
   * @returns {int32[]} Code length per symbol
   */
  function buildCodeLengths(frequencies, numSymbols, maxBits) {
    // Ties between equally frequent symbols are broken by the total order documented
    // in huffman-code-lengths.data.js, so the tree shape follows from the frequencies
    // alone rather than from any container's ordering of equal keys.
    /** @type {int32[]} */
    const lengths = HuffmanCodeLengths.buildCodeLengths(frequencies, numSymbols);

    for (let i = 0; i < numSymbols; ++i) {
      if (lengths[i] > maxBits) {
        lengths[i] = maxBits;
      }
    }

    /** @type {uint32} */
    const kraftMax = OpCodes.Shl32(1, maxBits);
    /** @type {float64} */
    let kraftSum = 0;
    for (let i = 0; i < numSymbols; ++i) {
      if (lengths[i] > 0) {
        kraftSum += OpCodes.Shr32(kraftMax, lengths[i]);
      }
    }

    while (kraftSum > kraftMax) {
      for (let i = numSymbols - 1; i >= 0; --i) {
        if (lengths[i] <= 0 || lengths[i] >= maxBits) {
          continue;
        }

        kraftSum -= OpCodes.Shr32(kraftMax, lengths[i]);
        ++lengths[i];
        kraftSum += OpCodes.Shr32(kraftMax, lengths[i]);
        if (kraftSum <= kraftMax) {
          break;
        }
      }
    }

    return lengths;
  }

  // Canonical numbering: shortest codes first, equal lengths in ascending symbol
  // order, written most-significant-bit first so no reversal is needed.
  /**
   * @param {int32[]} lengths - Code length per symbol
   * @param {int32} numSymbols - Alphabet size
   * @returns {int32[]} Code per symbol
   */
  function buildCanonicalCodes(lengths, numSymbols) {
    /** @type {int32} */
    let maxLen = 0;
    for (let i = 0; i < numSymbols; ++i) {
      if (lengths[i] > maxLen) {
        maxLen = lengths[i];
      }
    }

    /** @type {int32[]} */
    const codes = filledArray(numSymbols, 0);
    if (maxLen === 0) {
      return codes;
    }

    /** @type {int32[]} */
    const blCount = filledArray(maxLen + 1, 0);
    for (let i = 0; i < numSymbols; ++i) {
      if (lengths[i] > 0) {
        ++blCount[lengths[i]];
      }
    }

    /** @type {int32[]} */
    const nextCode = filledArray(maxLen + 1, 0);
    /** @type {int32} */
    let code = 0;
    for (let b = 1; b <= maxLen; ++b) {
      code = OpCodes.Shl32(code + blCount[b - 1], 1);
      nextCode[b] = code;
    }

    for (let i = 0; i < numSymbols; ++i) {
      if (lengths[i] > 0) {
        codes[i] = nextCode[lengths[i]]++;
      }
    }

    return codes;
  }

  class Rar3HuffmanEncoder {
    /**
     * @param {int32[]} frequencies - Frequency per symbol
     * @param {int32} numSymbols - Alphabet size
     */
    constructor(frequencies, numSymbols) {
      /** @type {int32[]} */
      this.codeLengths = buildCodeLengths(frequencies, numSymbols, MAX_CODE_LENGTH);
      /** @type {int32[]} */
      this.codes = buildCanonicalCodes(this.codeLengths, numSymbols);
    }

    /**
     * @param {Rar3BitWriter} writer - Output bits
     * @param {int32} symbol - Symbol to code
     */
    encodeSymbol(writer, symbol) {
      writer.writeBits(this.codes[symbol], this.codeLengths[symbol]);
    }
  }

  /**
   * Flat lookup table over the widest code in the tree.
   */
  class Rar3DecodeTable {
    /**
     * @param {int32[]} symbols - Symbol per prefix, -1 when unreachable
     * @param {int32[]} lengths - Code length per prefix
     * @param {int32} maxBits - Prefix width
     */
    constructor(symbols, lengths, maxBits) {
      /** @type {int32[]} */
      this.symbols = symbols;
      /** @type {int32[]} */
      this.lengths = lengths;
      /** @type {int32} */
      this.maxBits = maxBits;
    }
  }

  // Flat lookup table over the widest code in the tree. Entries the canonical
  // numbering never reaches keep symbol -1 and reject the stream.
  /**
   * @param {int32[]} codeLengths - Code length per symbol
   * @param {int32} numSymbols - Alphabet size
   * @returns {Rar3DecodeTable} Lookup table
   */
  function buildDecodeTable(codeLengths, numSymbols) {
    /** @type {int32} */
    let maxBits = 0;
    for (let i = 0; i < numSymbols; ++i) {
      if (codeLengths[i] > maxBits) {
        maxBits = codeLengths[i];
      }
    }
    if (maxBits === 0) {
      maxBits = 1;
    }
    if (maxBits > MAX_CODE_LENGTH) {
      maxBits = MAX_CODE_LENGTH;
    }

    /** @type {int32} */
    const tableSize = OpCodes.Shl32(1, maxBits);
    /** @type {int32[]} */
    const symbols = new Int32Array(tableSize).fill(-1);
    /** @type {int32[]} */
    const lengths = new Int32Array(tableSize);

    /** @type {int32[]} */
    const blCount = filledArray(MAX_CODE_LENGTH + 1, 0);
    for (let i = 0; i < numSymbols; ++i) {
      if (codeLengths[i] > 0) {
        ++blCount[codeLengths[i]];
      }
    }

    /** @type {int32[]} */
    const nextCode = filledArray(MAX_CODE_LENGTH + 1, 0);
    /** @type {int32} */
    let code = 0;
    for (let bits = 1; bits <= maxBits; ++bits) {
      code = OpCodes.Shl32(code + blCount[bits - 1], 1);
      nextCode[bits] = code;
    }

    for (let sym = 0; sym < numSymbols; ++sym) {
      /** @type {int32} */
      const len = codeLengths[sym];
      if (len <= 0 || len > maxBits) {
        continue;
      }

      /** @type {int32} */
      const c = nextCode[len]++;
      /** @type {int32} */
      const prefix = OpCodes.Shl32(c, maxBits - len);
      /** @type {int32} */
      const count = OpCodes.Shl32(1, maxBits - len);
      for (let j = 0; j < count && prefix + j < tableSize; ++j) {
        symbols[prefix + j] = sym;
        lengths[prefix + j] = len;
      }
    }

    return new Rar3DecodeTable(symbols, lengths, maxBits);
  }

  /**
   * @param {Rar3BitReader} reader - Input bits
   * @param {Rar3DecodeTable} decoder - Lookup table
   * @returns {int32} Decoded symbol
   */
  function decodeSymbol(reader, decoder) {
    /** @type {uint32} */
    const peek = reader.peekBits(decoder.maxBits);
    /** @type {int32} */
    const sym = decoder.symbols[peek];
    if (sym < 0) {
      throw new Error('RAR3: invalid Huffman code in stream');
    }

    reader.dropBits(decoder.lengths[peek]);
    return sym;
  }

  // ===== MATCH FINDER =====

  /**
   * Match found by the hash-chain finder; length 0 when none.
   */
  class MatchResult {
    /**
     * @param {int32} distance - Backward distance
     * @param {int32} length - Match length
     */
    constructor(distance, length) {
      /** @type {int32} */
      this.distance = distance;
      /** @type {int32} */
      this.length = length;
    }
  }

  class HashChainMatchFinder {
    /**
     * @param {int32} windowSize - Chain window, a power of two
     * @param {int32} maxChainDepth - Chain walk limit
     */
    constructor(windowSize, maxChainDepth) {
      /** @type {int32} */
      this.maxChainDepth = maxChainDepth;
      /** @type {int32[]} */
      this.head = new Int32Array(HASH_SIZE).fill(-1);
      /** @type {int32[]} */
      this.prev = new Int32Array(windowSize);
      /** @type {int32} */
      this.prevMask = windowSize - 1;
    }

    /**
     * @param {uint8[]} data - Input
     * @param {int32} position - Position of the three hashed bytes
     * @returns {int32} Hash bucket
     */
    static computeHash(data, position) {
      return OpCodes.And32(
        OpCodes.Xor32(
          OpCodes.Xor32(OpCodes.Shl32(data[position], 10), OpCodes.Shl32(data[position + 1], 5)),
          data[position + 2]
        ),
        HASH_MASK
      );
    }

    /**
     * @param {uint8[]} data - Input
     * @param {int32} position - Current position, inserted into the chains
     * @param {int32} maxDistance - Farthest allowed distance
     * @param {int32} maxLength - Longest allowed match
     * @param {int32} minLength - Shortest usable match
     * @returns {MatchResult} Longest (nearest on ties) match
     */
    findMatch(data, position, maxDistance, maxLength, minLength) {
      if (position + 2 >= data.length) {
        return new MatchResult(0, 0);
      }

      /** @type {int32} */
      let bestDistance = 0;
      /** @type {int32} */
      let bestLength = 0;

      /** @type {int32} */
      const hash = HashChainMatchFinder.computeHash(data, position);
      /** @type {int32} */
      let candidate = this.head[hash];
      /** @type {int32} */
      let chainCount = 0;
      /** @type {int32} */
      const windowStart = Math.max(0, position - maxDistance);

      while (candidate >= windowStart && chainCount < this.maxChainDepth) {
        if (candidate === position) {
          candidate = this.prev[OpCodes.And32(candidate, this.prevMask)];
          ++chainCount;
          continue;
        }

        /** @type {int32} */
        const limit = Math.min(maxLength, Math.min(data.length - position, data.length - candidate));
        if (bestLength === 0 || (bestLength < limit && data[candidate + bestLength] === data[position + bestLength])) {
          /** @type {int32} */
          let length = 0;
          while (length < limit && data[candidate + length] === data[position + length]) {
            ++length;
          }

          if (length >= minLength && length > bestLength) {
            bestLength = length;
            bestDistance = position - candidate;
            if (bestLength >= maxLength) {
              break;
            }
          }
        }

        candidate = this.prev[OpCodes.And32(candidate, this.prevMask)];
        if (candidate <= windowStart) {
          break;
        }

        ++chainCount;
      }

      this.prev[OpCodes.And32(position, this.prevMask)] = this.head[hash];
      this.head[hash] = position;

      if (bestLength >= minLength) {
        return new MatchResult(bestDistance, bestLength);
      }
      return new MatchResult(0, 0);
    }

    /**
     * @param {uint8[]} data - Input
     * @param {int32} position - Position to insert into the chains
     */
    insertPosition(data, position) {
      if (position + 2 >= data.length) {
        return;
      }

      /** @type {int32} */
      const hash = HashChainMatchFinder.computeHash(data, position);
      this.prev[OpCodes.And32(position, this.prevMask)] = this.head[hash];
      this.head[hash] = position;
    }
  }

  // ===== SLOT ARITHMETIC =====

  /**
   * @param {int32} length - Length minus the table's minimum
   * @param {int32} maxSlots - Slots available in the table
   * @returns {int32} Length slot
   */
  function getLenSlot(length, maxSlots) {
    for (let i = Math.min(maxSlots, LEN_BASE.length) - 1; i >= 0; --i) {
      if (length < LEN_BASE[i]) {
        continue;
      }

      /** @type {int32} */
      let maxExtra = 0;
      if (LEN_BITS[i] > 0) {
        /** @type {int32} */
        const span = OpCodes.Shl32(1, LEN_BITS[i]);
        maxExtra = span - 1;
      }
      if (length <= LEN_BASE[i] + maxExtra) {
        return i;
      }
    }
    return 0;
  }

  /**
   * @param {int32} distance - Match distance
   * @returns {int32} Distance slot
   */
  function getDistSlot(distance) {
    if (distance <= 4) {
      return distance - 1;
    }

    /** @type {int32} */
    const d = distance - 1;
    /** @type {int32} */
    const highBit = 31 - Math.clz32(d);
    /** @type {int32} */
    const bits = highBit - 1;
    /** @type {int32} */
    const lowBit = OpCodes.And32(OpCodes.Shr32(d, bits), 1);
    return bits * 2 + 2 + lowBit;
  }

  /**
   * @param {int32} distSlot - Distance slot
   * @returns {int32} Extra-bit count of the slot
   */
  function distSlotExtraBits(distSlot) {
    return Math.floor(distSlot / 2) - 1;
  }

  /**
   * @param {int32} distSlot - Distance slot (at least 4)
   * @returns {int32} Smallest distance of the slot
   */
  function distSlotBase(distSlot) {
    /** @type {int32} */
    const base = OpCodes.Shl32(OpCodes.Or32(2, OpCodes.And32(distSlot, 1)), distSlotExtraBits(distSlot));
    return base + 1;
  }

  // A Huffman table with no used symbol has no code to write, so give it one.
  /**
   * @param {int32[]} frequencies - Frequency per symbol, adjusted in place
   */
  function ensureNonEmpty(frequencies) {
    for (let i = 0; i < frequencies.length; ++i) {
      if (frequencies[i] > 0) {
        return;
      }
    }
    frequencies[0] = 1;
  }

  // ===== ENCODER =====

  /**
   * Run-length coded code-length list: per entry the code-length symbol and
   * the width and value of the raw bits that follow it.
   */
  class RleSequence {
    constructor() {
      /** @type {int32[]} */
      this.symbols = [];
      /** @type {int32[]} */
      this.bitCounts = [];
      /** @type {int32[]} */
      this.values = [];
    }

    /**
     * @param {int32} symbol - Code-length symbol
     * @param {int32} bitCount - Raw bits following it
     * @param {int32} value - Their value
     */
    add(symbol, bitCount, value) {
      this.symbols.push(symbol);
      this.bitCounts.push(bitCount);
      this.values.push(value);
    }
  }

  // Code lengths travel as deltas modulo 16 against the previous block's lengths,
  // run-length coded through the 20-symbol code-length tree.
  /**
   * @param {int32[]} codeLengths - New code lengths
   * @param {int32[]} prevLengths - Previous block's code lengths
   * @param {int32} numSymbols - Alphabet size
   * @returns {RleSequence} Run-length coded deltas
   */
  function buildRleSequence(codeLengths, prevLengths, numSymbols) {
    /** @type {RleSequence} */
    const rle = new RleSequence();
    /** @type {int32} */
    let i = 0;

    while (i < numSymbols) {
      /** @type {int32} */
      const delta = OpCodes.And32(codeLengths[i] - prevLengths[i], 0x0F);

      if (codeLengths[i] === 0 && delta === 0) {
        /** @type {int32} */
        const runStart = i;
        while (i < numSymbols && codeLengths[i] === 0
            && OpCodes.And32(codeLengths[i] - prevLengths[i], 0x0F) === 0) {
          ++i;
        }

        /** @type {int32} */
        let run = i - runStart;
        while (run > 0) {
          if (run >= 11) {
            /** @type {int32} */
            const count = Math.min(run, 138);
            rle.add(18, 7, count - 11);
            run -= count;
          } else if (run >= 3) {
            rle.add(17, 3, run - 3);
            run = 0;
          } else {
            rle.add(0, 0, 0);
            --run;
          }
        }
        continue;
      }

      if (delta === 0) {
        rle.add(0, 0, 0);
        /** @type {int32} */
        const unchanged = codeLengths[i];
        ++i;

        /** @type {int32} */
        let rep = 0;
        while (i < numSymbols && codeLengths[i] === unchanged
            && OpCodes.And32(codeLengths[i] - prevLengths[i], 0x0F) === 0 && rep < 6) {
          ++rep;
          ++i;
        }

        while (rep >= 3) {
          /** @type {int32} */
          const batch = Math.min(rep, 6);
          rle.add(16, 2, batch - 3);
          rep -= batch;
        }
        while (rep > 0) {
          rle.add(0, 0, 0);
          --rep;
        }
        continue;
      }

      rle.add(delta, 0, 0);
      /** @type {int32} */
      const repeated = codeLengths[i];
      ++i;

      /** @type {int32} */
      let rep = 0;
      while (i < numSymbols && codeLengths[i] === repeated && rep < 6) {
        ++rep;
        ++i;
      }

      while (rep >= 3) {
        /** @type {int32} */
        const batch = Math.min(rep, 6);
        rle.add(16, 2, batch - 3);
        rep -= batch;
      }
      while (rep > 0) {
        rle.add(OpCodes.And32(codeLengths[i - rep] - prevLengths[i - rep], 0x0F), 0, 0);
        --rep;
      }
    }

    return rle;
  }

  /**
   * @param {Rar3BitWriter} writer - Output bits
   * @param {RleSequence} rle - Run-length coded deltas
   * @param {Rar3HuffmanEncoder} clEncoder - Code-length tree encoder
   */
  function writeRle(writer, rle, clEncoder) {
    for (let i = 0; i < rle.symbols.length; ++i) {
      clEncoder.encodeSymbol(writer, rle.symbols[i]);
      if (rle.bitCounts[i] > 0) {
        writer.writeBits(rle.values[i], rle.bitCounts[i]);
      }
    }
  }

  /**
   * Parsed token list as parallel rows.
   */
  class Rar3Tokens {
    constructor() {
      /** @type {int32[]} */
      this.types = [];
      /** @type {int32[]} */
      this.literals = [];
      /** @type {int32[]} */
      this.lengths = [];
      /** @type {int32[]} */
      this.distances = [];
      /** @type {int32[]} */
      this.repIndices = [];
    }

    /**
     * @param {int32} type - Token kind
     * @param {int32} literal - Literal byte
     * @param {int32} length - Match length
     * @param {int32} distance - Match distance
     * @param {int32} repIndex - Repeated-distance index
     */
    add(type, literal, length, distance, repIndex) {
      this.types.push(type);
      this.literals.push(literal);
      this.lengths.push(length);
      this.distances.push(distance);
      this.repIndices.push(repIndex);
    }
  }

  /**
   * @param {uint8[]} input - Data to compress
   * @returns {uint8[]} Size header followed by one LZ block
   */
  function rar3Compress(input) {
    /** @type {uint8[]} */
    const result = [];
    result.push(OpCodes.And32(input.length, 0xFF));
    result.push(OpCodes.And32(OpCodes.Shr32(input.length, 8), 0xFF));
    result.push(OpCodes.And32(OpCodes.Shr32(input.length, 16), 0xFF));
    result.push(OpCodes.And32(OpCodes.Shr32(input.length, 24), 0xFF));
    if (input.length === 0) {
      return result;
    }

    /** @type {Rar3BitWriter} */
    const writer = new Rar3BitWriter();
    writer.writeBits(0, 1); // 0 selects the LZ coder, 1 would select PPMd

    // --- token collection ---
    /** @type {HashChainMatchFinder} */
    const matchFinder = new HashChainMatchFinder(WINDOW_SIZE, MAX_CHAIN_DEPTH);
    /** @type {int32[]} */
    const rep = [0, 0, 0, 0];
    /** @type {Rar3Tokens} */
    const tokens = new Rar3Tokens();
    /** @type {int32} */
    let pos = 0;

    while (pos < input.length) {
      /** @type {MatchResult} */
      const match = matchFinder.findMatch(input, pos, WINDOW_SIZE, MAX_MATCH_LENGTH, MIN_MATCH);

      if (match.length >= MIN_MATCH) {
        /** @type {int32} */
        let repIdx = -1;
        for (let r = 0; r < 4; ++r) {
          if (rep[r] === match.distance) {
            repIdx = r;
            break;
          }
        }

        /** @type {int32} */
        let effectiveLen = match.length;

        if (repIdx >= 0) {
          if (effectiveLen > MAX_REP_MATCH_LENGTH) {
            effectiveLen = MAX_REP_MATCH_LENGTH;
          }
          tokens.add(TOKEN_REPEAT_OFFSET, 0, effectiveLen, 0, repIdx);

          /** @type {int32} */
          const dist = rep[repIdx];
          for (let i = repIdx; i > 0; --i) {
            rep[i] = rep[i - 1];
          }
          rep[0] = dist;
        } else {
          tokens.add(TOKEN_MATCH, 0, effectiveLen, match.distance, 0);

          rep[3] = rep[2];
          rep[2] = rep[1];
          rep[1] = rep[0];
          rep[0] = match.distance;
        }

        for (let i = 1; i < effectiveLen && pos + i < input.length; ++i) {
          matchFinder.insertPosition(input, pos + i);
        }
        pos += effectiveLen;
        continue;
      }

      // No match long enough, but a two-byte replay of the last distance still
      // beats spending two literals on it.
      if (rep[0] > 0 && pos + 2 <= input.length && pos >= rep[0]
          && input[pos] === input[pos - rep[0]] && input[pos + 1] === input[pos + 1 - rep[0]]) {
        tokens.add(TOKEN_REPEAT_LAST, 0, 0, 0, 0);
        matchFinder.insertPosition(input, pos);
        if (pos + 1 < input.length) {
          matchFinder.insertPosition(input, pos + 1);
        }
        pos += 2;
        continue;
      }

      tokens.add(TOKEN_LITERAL, input[pos], 0, 0, 0);
      matchFinder.insertPosition(input, pos);
      ++pos;
    }

    // --- frequencies ---
    /** @type {int32[]} */
    const mainFreq = filledArray(MAIN_TABLE_SIZE, 0);
    /** @type {int32[]} */
    const distFreq = filledArray(DIST_TABLE_SIZE, 0);
    /** @type {int32[]} */
    const lowDistFreq = filledArray(LOW_DIST_TABLE_SIZE, 0);
    /** @type {int32[]} */
    const repLenFreq = filledArray(REP_LEN_TABLE_SIZE, 0);

    for (let i = 0; i < tokens.types.length; ++i) {
      /** @type {int32} */
      const type = tokens.types[i];

      if (type === TOKEN_LITERAL) {
        ++mainFreq[tokens.literals[i]];
      } else if (type === TOKEN_REPEAT_LAST) {
        ++mainFreq[258];
      } else if (type === TOKEN_REPEAT_OFFSET) {
        ++mainFreq[259 + tokens.repIndices[i]];
        /** @type {int32} */
        const repSlot = getLenSlot(tokens.lengths[i] - 2, REP_LEN_TABLE_SIZE);
        ++repLenFreq[repSlot];
      } else {
        /** @type {int32} */
        const lenSlot = getLenSlot(tokens.lengths[i] - 3, 36);
        ++mainFreq[263 + lenSlot];

        /** @type {int32} */
        const distSlot = getDistSlot(tokens.distances[i]);
        ++distFreq[distSlot];
        if (distSlot >= 4 && distSlotExtraBits(distSlot) >= 4) {
          /** @type {int32} */
          const base = distSlotBase(distSlot);
          ++lowDistFreq[OpCodes.And32(tokens.distances[i] - base, 0xF)];
        }
      }
    }

    ensureNonEmpty(mainFreq);
    ensureNonEmpty(distFreq);
    ensureNonEmpty(lowDistFreq);
    ensureNonEmpty(repLenFreq);

    /** @type {Rar3HuffmanEncoder} */
    const mainEnc = new Rar3HuffmanEncoder(mainFreq, MAIN_TABLE_SIZE);
    /** @type {Rar3HuffmanEncoder} */
    const distEnc = new Rar3HuffmanEncoder(distFreq, DIST_TABLE_SIZE);
    /** @type {Rar3HuffmanEncoder} */
    const lowDistEnc = new Rar3HuffmanEncoder(lowDistFreq, LOW_DIST_TABLE_SIZE);
    /** @type {Rar3HuffmanEncoder} */
    const repLenEnc = new Rar3HuffmanEncoder(repLenFreq, REP_LEN_TABLE_SIZE);

    // --- tables ---
    // A standalone stream is one block, so there is no previous block to delta
    // against and every previous length is zero.
    /** @type {RleSequence} */
    const rleMain = buildRleSequence(mainEnc.codeLengths, filledArray(MAIN_TABLE_SIZE, 0), MAIN_TABLE_SIZE);
    /** @type {RleSequence} */
    const rleDist = buildRleSequence(distEnc.codeLengths, filledArray(DIST_TABLE_SIZE, 0), DIST_TABLE_SIZE);
    /** @type {RleSequence} */
    const rleLowDist = buildRleSequence(lowDistEnc.codeLengths, filledArray(LOW_DIST_TABLE_SIZE, 0), LOW_DIST_TABLE_SIZE);
    /** @type {RleSequence} */
    const rleRepLen = buildRleSequence(repLenEnc.codeLengths, filledArray(REP_LEN_TABLE_SIZE, 0), REP_LEN_TABLE_SIZE);

    /** @type {int32[]} */
    const clFreq = filledArray(CODE_LENGTH_TABLE_SIZE, 0);
    /** @type {RleSequence[]} */
    const allRle = [rleMain, rleDist, rleLowDist, rleRepLen];
    for (let t = 0; t < allRle.length; ++t) {
      /** @type {RleSequence} */
      const sequence = allRle[t];
      for (let i = 0; i < sequence.symbols.length; ++i) {
        ++clFreq[sequence.symbols[i]];
      }
    }
    ensureNonEmpty(clFreq);

    /** @type {Rar3HuffmanEncoder} */
    const clEnc = new Rar3HuffmanEncoder(clFreq, CODE_LENGTH_TABLE_SIZE);
    for (let i = 0; i < CODE_LENGTH_TABLE_SIZE; ++i) {
      writer.writeBits(clEnc.codeLengths[i], 4);
    }

    writeRle(writer, rleMain, clEnc);
    writeRle(writer, rleDist, clEnc);
    writeRle(writer, rleLowDist, clEnc);
    writeRle(writer, rleRepLen, clEnc);

    // --- tokens ---
    for (let i = 0; i < tokens.types.length; ++i) {
      /** @type {int32} */
      const type = tokens.types[i];

      if (type === TOKEN_LITERAL) {
        mainEnc.encodeSymbol(writer, tokens.literals[i]);
        continue;
      }

      if (type === TOKEN_REPEAT_LAST) {
        mainEnc.encodeSymbol(writer, 258);
        continue;
      }

      if (type === TOKEN_REPEAT_OFFSET) {
        mainEnc.encodeSymbol(writer, 259 + tokens.repIndices[i]);
        /** @type {int32} */
        const repLength = tokens.lengths[i] - 2;
        /** @type {int32} */
        const repLenSlot = getLenSlot(repLength, REP_LEN_TABLE_SIZE);
        repLenEnc.encodeSymbol(writer, repLenSlot);
        if (LEN_BITS[repLenSlot] > 0) {
          writer.writeBits(repLength - LEN_BASE[repLenSlot], LEN_BITS[repLenSlot]);
        }
        continue;
      }

      /** @type {int32} */
      const length = tokens.lengths[i] - 3;
      /** @type {int32} */
      const lenSlot = getLenSlot(length, 36);
      mainEnc.encodeSymbol(writer, 263 + lenSlot);
      if (LEN_BITS[lenSlot] > 0) {
        writer.writeBits(length - LEN_BASE[lenSlot], LEN_BITS[lenSlot]);
      }

      /** @type {int32} */
      const distSlot = getDistSlot(tokens.distances[i]);
      distEnc.encodeSymbol(writer, distSlot);
      if (distSlot < 4) {
        continue;
      }

      /** @type {int32} */
      const bits = distSlotExtraBits(distSlot);
      /** @type {int32} */
      const base = distSlotBase(distSlot);
      /** @type {int32} */
      const extra = tokens.distances[i] - base;
      if (bits >= 4) {
        if (bits > 4) {
          writer.writeBits(OpCodes.Shr32(extra, 4), bits - 4);
        }
        lowDistEnc.encodeSymbol(writer, OpCodes.And32(extra, 0xF));
      } else if (bits > 0) {
        writer.writeBits(extra, bits);
      }
    }

    /** @type {uint8[]} */
    const body = writer.toArray();
    for (let i = 0; i < body.length; ++i) {
      result.push(body[i]);
    }
    return result;
  }

  // ===== DECODER =====

  /**
   * @param {Rar3BitReader} reader - Input bits
   * @param {Rar3DecodeTable} clDecoder - Code-length tree
   * @param {int32[]} lengths - Code lengths, updated in place by the deltas
   * @param {int32} count - Alphabet size
   */
  function readTableLengths(reader, clDecoder, lengths, count) {
    /** @type {int32} */
    let i = 0;
    while (i < count) {
      /** @type {int32} */
      const sym = decodeSymbol(reader, clDecoder);

      if (sym < 16) {
        lengths[i] = OpCodes.And32(lengths[i] + sym, 0x0F);
        ++i;
      } else if (sym === 16) {
        if (i === 0) {
          throw new Error('RAR3: table repeat at start');
        }

        /** @type {int32} */
        const repeatField = reader.readBits(2);
        /** @type {int32} */
        let repeat = 3 + repeatField;
        /** @type {int32} */
        const prev = lengths[i - 1];
        while (repeat-- > 0 && i < count) {
          lengths[i++] = prev;
        }
      } else if (sym === 17) {
        /** @type {int32} */
        const repeatField = reader.readBits(3);
        /** @type {int32} */
        let repeat = 3 + repeatField;
        while (repeat-- > 0 && i < count) {
          lengths[i++] = 0;
        }
      } else if (sym === 18) {
        /** @type {int32} */
        const repeatField = reader.readBits(7);
        /** @type {int32} */
        let repeat = 11 + repeatField;
        while (repeat-- > 0 && i < count) {
          lengths[i++] = 0;
        }
      } else {
        throw new Error('RAR3: invalid code-length symbol in stream');
      }
    }
  }

  /**
   * Decoder output: the produced bytes and the sliding window they pass through.
   */
  class Rar3Output {
    /**
     * @param {uint32} unpackedSize - Number of bytes to produce
     */
    constructor(unpackedSize) {
      /** @type {uint32} */
      this.unpackedSize = unpackedSize;
      /** @type {uint8[]} */
      this.output = new Array(unpackedSize);
      for (let i = 0; i < unpackedSize; ++i) {
        this.output[i] = 0;
      }
      /** @type {uint8[]} */
      this.window = new Uint8Array(WINDOW_SIZE);
      /** @type {int32} */
      this.windowPos = 0;
      /** @type {int32} */
      this.outPos = 0;
    }

    /**
     * @param {int32} value - Literal byte
     */
    putLiteral(value) {
      this.window[OpCodes.And32(this.windowPos, WINDOW_MASK)] = value;
      ++this.windowPos;
      this.output[this.outPos++] = value;
    }

    /**
     * @param {int32} distance - Match distance
     * @param {int32} length - Match length
     */
    copyMatch(distance, length) {
      for (let i = 0; i < length && this.outPos < this.unpackedSize; ++i) {
        /** @type {uint8} */
        const b = this.window[OpCodes.And32(this.windowPos - distance, WINDOW_MASK)];
        this.window[OpCodes.And32(this.windowPos, WINDOW_MASK)] = b;
        ++this.windowPos;
        this.output[this.outPos++] = b;
      }
    }
  }

  /**
   * @param {uint8[]} input - Size header followed by the block stream
   * @returns {uint8[]} Decompressed bytes
   */
  function rar3Decompress(input) {
    if (input.length < 4) {
      /** @type {uint8[]} */
      const empty = [];
      return empty;
    }

    /** @type {uint32} */
    const unpackedSize = OpCodes.Or32(
      OpCodes.Or32(input[0], OpCodes.Shl32(input[1], 8)),
      OpCodes.Or32(OpCodes.Shl32(input[2], 16), OpCodes.Shl32(input[3], 24))
    );
    if (unpackedSize === 0) {
      /** @type {uint8[]} */
      const empty = [];
      return empty;
    }

    /** @type {Rar3BitReader} */
    const reader = new Rar3BitReader(input, 4);
    /** @type {Rar3Output} */
    const sink = new Rar3Output(unpackedSize);
    /** @type {int32[]} */
    const rep = [0, 0, 0, 0];

    /** @type {int32[]} */
    const mainLens = filledArray(MAIN_TABLE_SIZE, 0);
    /** @type {int32[]} */
    const distLens = filledArray(DIST_TABLE_SIZE, 0);
    /** @type {int32[]} */
    const lowDistLens = filledArray(LOW_DIST_TABLE_SIZE, 0);
    /** @type {int32[]} */
    const repLenLens = filledArray(REP_LEN_TABLE_SIZE, 0);
    /** @type {boolean} */
    let tablesRead = false;

    while (sink.outPos < unpackedSize) {
      if (!tablesRead) {
        /** @type {uint32} */
        const coderBit = reader.readBits(1);
        if (coderBit !== 0) {
          throw new Error('RAR3: the PPMd coder is not implemented');
        }

        /** @type {int32[]} */
        const clLens = filledArray(CODE_LENGTH_TABLE_SIZE, 0);
        for (let i = 0; i < CODE_LENGTH_TABLE_SIZE; ++i) {
          /** @type {int32} */
          const len = reader.readBits(4);
          clLens[i] = len;
        }
        /** @type {Rar3DecodeTable} */
        const clDecoder = buildDecodeTable(clLens, CODE_LENGTH_TABLE_SIZE);

        readTableLengths(reader, clDecoder, mainLens, MAIN_TABLE_SIZE);
        readTableLengths(reader, clDecoder, distLens, DIST_TABLE_SIZE);
        readTableLengths(reader, clDecoder, lowDistLens, LOW_DIST_TABLE_SIZE);
        readTableLengths(reader, clDecoder, repLenLens, REP_LEN_TABLE_SIZE);
        tablesRead = true;
      }

      /** @type {Rar3DecodeTable} */
      const mainDecoder = buildDecodeTable(mainLens, MAIN_TABLE_SIZE);
      /** @type {Rar3DecodeTable} */
      const distDecoder = buildDecodeTable(distLens, DIST_TABLE_SIZE);
      /** @type {Rar3DecodeTable} */
      const lowDistDecoder = buildDecodeTable(lowDistLens, LOW_DIST_TABLE_SIZE);
      /** @type {Rar3DecodeTable} */
      const repLenDecoder = buildDecodeTable(repLenLens, REP_LEN_TABLE_SIZE);

      while (sink.outPos < unpackedSize) {
        /** @type {int32} */
        const sym = decodeSymbol(reader, mainDecoder);

        if (sym < 256) {
          sink.putLiteral(sym);
          continue;
        }

        if (sym === 256) {
          // End of block: a set bit means the four tables follow again, a clear
          // bit introduces a virtual-machine filter, which this coder never emits.
          /** @type {uint32} */
          const tablesBit = reader.readBits(1);
          if (tablesBit === 0) {
            throw new Error('RAR3: virtual-machine filter blocks are not implemented');
          }

          tablesRead = false;
          break;
        }

        if (sym === 257) {
          break;
        }

        if (sym === 258) {
          sink.copyMatch(rep[0], 2);
          continue;
        }

        if (sym < 263) {
          /** @type {int32} */
          const repIdx = sym - 259;
          /** @type {int32} */
          const dist = rep[repIdx];
          for (let i = repIdx; i > 0; --i) {
            rep[i] = rep[i - 1];
          }
          rep[0] = dist;

          /** @type {int32} */
          const lenSym = decodeSymbol(reader, repLenDecoder);
          /** @type {int32} */
          let repLength = LEN_BASE[lenSym] + 2;
          if (LEN_BITS[lenSym] > 0) {
            /** @type {int32} */
            const extra = reader.readBits(LEN_BITS[lenSym]);
            repLength += extra;
          }

          sink.copyMatch(dist, repLength);
          continue;
        }

        /** @type {int32} */
        const lenCode = sym - 263;
        /** @type {int32} */
        let length = LEN_BASE[lenCode] + 3;
        if (LEN_BITS[lenCode] > 0) {
          /** @type {int32} */
          const extra = reader.readBits(LEN_BITS[lenCode]);
          length += extra;
        }

        /** @type {int32} */
        const distSym = decodeSymbol(reader, distDecoder);
        /** @type {int32} */
        let distance = 0;
        if (distSym < 4) {
          distance = distSym + 1;
        } else {
          /** @type {int32} */
          const bits = distSlotExtraBits(distSym);
          distance = distSlotBase(distSym);
          if (bits >= 4) {
            if (bits > 4) {
              /** @type {int32} */
              const high = reader.readBits(bits - 4);
              /** @type {int32} */
              const shifted = OpCodes.Shl32(high, 4);
              distance += shifted;
            }
            /** @type {int32} */
            const low = decodeSymbol(reader, lowDistDecoder);
            distance += low;
          } else if (bits > 0) {
            /** @type {int32} */
            const extra = reader.readBits(bits);
            distance += extra;
          }
        }

        rep[3] = rep[2];
        rep[2] = rep[1];
        rep[1] = rep[0];
        rep[0] = distance;

        sink.copyMatch(distance, length);
      }
    }

    return sink.output;
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
    /**
     * @param {RarCompression} algorithm - Owning algorithm
     * @param {boolean} isInverse - True for decompression
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
    }

    /**
     * @param {uint8[]} data - Bytes to append
     */
    Feed(data) {
      if (!data || data.length === 0) {
        return;
      }
      for (let i = 0; i < data.length; ++i) {
        this.inputBuffer.push(data[i]);
      }
    }

    /**
     * @returns {uint8[]} Compressed or decompressed bytes
     */
    Result() {
      /** @type {uint8[]} */
      const data = this.inputBuffer;
      this.inputBuffer = [];
      if (this.isInverse) {
        return rar3Decompress(data);
      }
      return rar3Compress(data);
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
