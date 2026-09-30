/*
 * LZMS Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZMS ("LZ" + "MS") is Microsoft's dictionary-compression format introduced with
 * Windows 8 / WIMGAPI, used by the WIM (Windows Imaging Format) archiver and by
 * msdelta as the successor, in that product lineage, to LZX and Xpress-Huffman.
 *
 * Note: Microsoft has never published an [MS-XXXX] Open Specifications document for
 * LZMS. Everything publicly known about its bitstream comes from clean-room work,
 * most notably Eric Biggers' `wimlib` project (https://wimlib.net/ and
 * https://github.com/ebiggers/wimlib), whose documentation describes LZMS as LZ77
 * matching combined with two interleaved streams: a forward Huffman-coded stream
 * carrying literals, length symbols and offset slots, and a backward range-coded
 * stream carrying the binary literal/match, LZ/delta and repeat-offset decisions.
 * An optional x86 call/jmp address post-filter sits ahead of the main stage; the
 * filter is out of scope here and this file implements only the LZ77 core.
 *
 * This implementation follows that general, publicly-documented LZMS design but its
 * exact bitstream layout is a clean-room design of its own: it has NOT been checked
 * against, and is not intended to be bit-compatible with, Microsoft's encoder or
 * wimlib's decoder. Encoder and decoder below only need to agree with each other.
 *
 * Stream layout: [4-byte LE uncompressed size][forward Huffman bytes][range-coded
 * 16-bit words written backwards from the end of the buffer].
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== CONSTANTS =====

  const NUM_LZ_OFFSET_SLOTS = 799;
  const NUM_RECENT_LZ_OFFSETS = 3;
  const NUM_RECENT_DELTA_OFFSETS = 3;
  const NUM_PROB_BITS = 6;
  const INITIAL_PROB = 32;              // 1 shifted left by (NUM_PROB_BITS - 1)
  const PROB_DENOMINATOR = 64;          // 1 shifted left by NUM_PROB_BITS
  const PROB_ADAPT_SHIFT = 4;

  const LITERAL_REBUILD_INTERVAL = 1024;
  const LZ_OFFSET_REBUILD_INTERVAL = 1024;
  const LENGTH_REBUILD_INTERVAL = 512;
  const DELTA_POWER_REBUILD_INTERVAL = 1024;
  const DELTA_OFFSET_REBUILD_INTERVAL = 1024;

  const NUM_LITERAL_SYMBOLS = 256;
  const NUM_LENGTH_SYMBOLS = 27;
  const NUM_DELTA_POWER_SYMBOLS = 8;
  const NUM_DELTA_OFFSET_SLOTS = 799;

  const MIN_MATCH_LENGTH = 2;
  const MAX_MATCH_LENGTH = 224;
  const MAX_CODE_LENGTH = 15;
  const MAX_TABLE_BITS = 12;
  const CHAIN_DEPTH = 64;

  // Slots of the two main range-coded decisions in the probs arrays.
  const PROB_LZ_MATCH = 0;
  const PROB_DELTA_MATCH = 1;

  /** @type {int32[]} */
  const LENGTH_BASE = [
    2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 20, 24, 28, 32,
    40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224
  ];

  /** @type {int32[]} */
  const LENGTH_EXTRA_BITS = [
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 2,
    3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 0
  ];

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

  // ===== HUFFMAN HELPERS =====

  /**
   * Assigns code lengths in symbol order from the set of symbols with non-zero
   * frequency: the shortest possible uniform width, with the first
   * (2^width - count) symbols one bit shorter so the Kraft sum stays exactly 1.
   * @param {int32[]} freqs - Frequency per symbol
   * @param {int32} numSymbols - Alphabet size
   * @param {int32} maxLen - Longest allowed code
   * @returns {int32[]} Code length per symbol
   */
  function buildCodeLengths(freqs, numSymbols, maxLen) {
    /** @type {int32[]} */
    const codeLens = filledArray(numSymbols, 0);

    /** @type {int32} */
    let nonZero = 0;
    for (let i = 0; i < numSymbols; ++i) {
      if (freqs[i] > 0) {
        ++nonZero;
      }
    }

    if (nonZero <= 1) {
      for (let i = 0; i < numSymbols; ++i) {
        if (freqs[i] > 0) {
          codeLens[i] = 1;
        }
      }
      return codeLens;
    }

    /** @type {int32} */
    let bitsNeeded = 1;
    while (OpCodes.Shl32(1, bitsNeeded) < nonZero) {
      ++bitsNeeded;
    }
    bitsNeeded = Math.min(bitsNeeded, maxLen);

    /** @type {int32} */
    const shortCount = OpCodes.Shl32(1, bitsNeeded) - nonZero;
    /** @type {int32} */
    let assigned = 0;
    for (let i = 0; i < numSymbols; ++i) {
      if (freqs[i] <= 0) {
        continue;
      }
      codeLens[i] = (assigned < shortCount && bitsNeeded > 1) ? bitsNeeded - 1 : bitsNeeded;
      ++assigned;
    }

    return codeLens;
  }

  /**
   * @param {int32[]} codeLens - Code length per symbol
   * @param {int32} numSymbols - Alphabet size
   * @returns {int32} Longest code length
   */
  function maxCodeLength(codeLens, numSymbols) {
    /** @type {int32} */
    let maxLen = 0;
    for (let i = 0; i < numSymbols; ++i) {
      if (codeLens[i] > maxLen) {
        maxLen = codeLens[i];
      }
    }
    return maxLen;
  }

  /**
   * First code of each length for a canonical code, per the DEFLATE construction.
   * @param {int32[]} codeLens - Code length per symbol
   * @param {int32} numSymbols - Alphabet size
   * @param {int32} maxLen - Longest code length
   * @returns {int32[]} First code per length
   */
  function firstCodes(codeLens, numSymbols, maxLen) {
    /** @type {int32[]} */
    const blCount = filledArray(maxLen + 1, 0);
    for (let i = 0; i < numSymbols; ++i) {
      if (codeLens[i] > 0) {
        ++blCount[codeLens[i]];
      }
    }

    /** @type {int32[]} */
    const nextCode = filledArray(maxLen + 1, 0);
    /** @type {int32} */
    let code = 0;
    for (let bits = 1; bits <= maxLen; ++bits) {
      code = OpCodes.Shl32(code + blCount[bits - 1], 1);
      nextCode[bits] = code;
    }
    return nextCode;
  }

  /**
   * Canonical code value for every symbol, assigned in increasing symbol order.
   * @param {int32[]} codeLens - Code length per symbol
   * @param {int32} numSymbols - Alphabet size
   * @returns {int32[]} Code per symbol
   */
  function buildCanonicalCodes(codeLens, numSymbols) {
    /** @type {int32} */
    const maxLen = maxCodeLength(codeLens, numSymbols);
    /** @type {int32[]} */
    const codes = filledArray(numSymbols, 0);
    if (maxLen === 0) {
      return codes;
    }

    /** @type {int32[]} */
    const nextCode = firstCodes(codeLens, numSymbols, maxLen);
    for (let sym = 0; sym < numSymbols; ++sym) {
      /** @type {int32} */
      const len = codeLens[sym];
      if (len <= 0) {
        continue;
      }
      codes[sym] = nextCode[len];
      nextCode[len] = nextCode[len] + 1;
    }
    return codes;
  }

  /**
   * Flat lookup table mapping a peeked prefix to a packed (length, symbol) entry.
   */
  class DecodeTable {
    /**
     * @param {int32[]} table - Entries: symbol in the low 16 bits, length above
     * @param {int32} tableBits - Prefix width
     */
    constructor(table, tableBits) {
      /** @type {int32[]} */
      this.table = table;
      /** @type {int32} */
      this.tableBits = tableBits;
    }
  }

  /**
   * @param {int32[]} codeLens - Code length per symbol
   * @param {int32} numSymbols - Alphabet size
   * @returns {DecodeTable} Lookup table
   */
  function buildDecodeTable(codeLens, numSymbols) {
    /** @type {int32} */
    const maxLen = maxCodeLength(codeLens, numSymbols);
    if (maxLen === 0) {
      return new DecodeTable(filledArray(2, 0), 1);
    }

    /** @type {int32} */
    const tableBits = Math.min(maxLen, MAX_TABLE_BITS);
    /** @type {int32} */
    const tableSize = OpCodes.Shl32(1, tableBits);
    /** @type {int32[]} */
    const table = filledArray(tableSize, 0);
    /** @type {int32[]} */
    const nextCode = firstCodes(codeLens, numSymbols, maxLen);

    for (let sym = 0; sym < numSymbols; ++sym) {
      /** @type {int32} */
      const len = codeLens[sym];
      if (len <= 0 || len > tableBits) {
        continue;
      }

      /** @type {int32} */
      const code = nextCode[len];
      nextCode[len] = code + 1;

      /** @type {int32} */
      const prefix = OpCodes.Shl32(code, tableBits - len);
      /** @type {int32} */
      const fill = OpCodes.Shl32(1, tableBits - len);
      /** @type {int32} */
      const entry = OpCodes.Or32(sym, OpCodes.Shl32(len, 16));
      for (let j = 0; j < fill && prefix + j < tableSize; ++j) {
        table[prefix + j] = entry;
      }
    }

    return new DecodeTable(table, tableBits);
  }

  /**
   * @param {int32[]} freqs - Frequencies, halved in place (at least 1)
   * @param {int32} count - Number of entries
   */
  function halveFrequencies(freqs, count) {
    for (let i = 0; i < count; ++i) {
      freqs[i] = Math.max(1, OpCodes.Shr32(freqs[i] + 1, 1));
    }
  }

  // ===== OFFSET AND LENGTH SLOTS =====

  /**
   * Maps a match distance onto its offset slot (exponent plus one mantissa bit).
   * @param {int32} offset - Match distance
   * @returns {int32} Offset slot
   */
  function offsetToSlot(offset) {
    if (offset <= 0) {
      return 0;
    }
    if (offset <= 2) {
      return offset - 1;
    }

    /** @type {int32} */
    const value = offset - 1;
    /** @type {int32} */
    let highBit = 0;
    /** @type {uint32} */
    let tmp = value;
    while (tmp > 1) {
      tmp = OpCodes.Shr32(tmp, 1);
      ++highBit;
    }

    /** @type {int32} */
    const secondBit = OpCodes.And32(OpCodes.Shr32(value, highBit - 1), 1);
    /** @type {int32} */
    const slot = 2 * (highBit - 1) + secondBit + 2;
    return slot >= NUM_LZ_OFFSET_SLOTS ? NUM_LZ_OFFSET_SLOTS - 1 : slot;
  }

  /**
   * @param {int32} slot - Offset slot
   * @returns {int32} Extra-bit count of the slot
   */
  function slotExtraBits(slot) {
    return slot < 2 ? 0 : Math.floor((slot - 2) / 2);
  }

  /**
   * @param {int32} slot - Offset slot
   * @param {int32} extraBits - Extra-bit count of the slot
   * @returns {uint32} Base offset (minus one) of the slot
   */
  function slotBaseOffset(slot, extraBits) {
    return OpCodes.Shl32(2 + OpCodes.And32(slot, 1), extraBits);
  }

  /**
   * @param {int32} length - Match length
   * @returns {int32} Length symbol
   */
  function lengthToSymbol(length) {
    for (let i = LENGTH_BASE.length - 1; i >= 0; --i) {
      if (length < LENGTH_BASE[i]) {
        continue;
      }
      return i;
    }
    return 0;
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

  /** Hash-chain match finder over a 3-byte hash with a bounded chain walk. */
  class HashChainMatchFinder {
    /**
     * @param {int32} windowSize - Chain window
     * @param {int32} maxChainDepth - Chain walk limit
     */
    constructor(windowSize, maxChainDepth) {
      /** @type {int32} */
      this.maxChainDepth = maxChainDepth;
      /** @type {int32[]} */
      this.head = new Int32Array(32768).fill(-1);
      /** @type {int32[]} */
      this.prev = new Int32Array(Math.max(1, windowSize));
      /** @type {int32} */
      this.prevMask = Math.max(1, windowSize) - 1;
    }

    /**
     * @param {uint8[]} data - Input
     * @param {int32} position - Position of the three hashed bytes
     * @returns {int32} Hash bucket
     */
    static Hash(data, position) {
      /** @type {uint32} */
      const mixed = OpCodes.Xor32(
        OpCodes.Xor32(OpCodes.Shl32(data[position], 10), OpCodes.Shl32(data[position + 1], 5)),
        data[position + 2]);
      return OpCodes.And32(mixed, 0x7FFF);
    }

    /**
     * @param {uint8[]} data - Input
     * @param {int32} position - Current position, inserted into the chains
     * @param {int32} maxDistance - Farthest allowed distance
     * @param {int32} maxLength - Longest allowed match
     * @param {int32} minLength - Shortest usable match
     * @returns {MatchResult} Longest (nearest on ties) match
     */
    FindMatch(data, position, maxDistance, maxLength, minLength) {
      if (position + 2 >= data.length) {
        return new MatchResult(0, 0);
      }

      /** @type {int32} */
      let bestDistance = 0;
      /** @type {int32} */
      let bestLength = 0;

      /** @type {int32} */
      const hash = HashChainMatchFinder.Hash(data, position);
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
    InsertPosition(data, position) {
      if (position + 2 >= data.length) {
        return;
      }
      /** @type {int32} */
      const hash = HashChainMatchFinder.Hash(data, position);
      this.prev[OpCodes.And32(position, this.prevMask)] = this.head[hash];
      this.head[hash] = position;
    }
  }

  // ===== COMPRESSOR =====

  /**
   * Produces the two interleaved streams. The range coder emits 16-bit words that
   * are laid down backwards from the end of the buffer, with carries propagated
   * into the words already emitted; the Huffman coder writes MSB-first bytes
   * forward from the start.
   */
  class LzmsCompressor {
    constructor() {
      /** @type {uint8[]} */
      this.fwdBytes = [];
      /** @type {int32} */
      this.fwdAcc = 0;
      /** @type {int32} */
      this.fwdAccBits = 0;

      /** @type {float64[]} */
      this.rcWords = [];
      /** @type {uint32} */
      this.rcRange = 4294967295;
      /** @type {float64} */
      this.rcLow = 0;

      /** @type {int32[]} */
      this.probMatch = filledArray(2, INITIAL_PROB);
      /** @type {int32[]} */
      this.probLzRepeat = filledArray(NUM_RECENT_LZ_OFFSETS, INITIAL_PROB);
      /** @type {int32[]} */
      this.recentLzOffsets = [1, 1, 1];

      /** @type {int32[]} */
      this.literalFreqs = [];
      /** @type {int32} */
      this.literalCount = 0;
      /** @type {int32[]} */
      this.literalCodeLens = [];
      /** @type {int32[]} */
      this.literalCodes = [];
      /** @type {int32[]} */
      this.lzOffsetFreqs = [];
      /** @type {int32} */
      this.lzOffsetCount = 0;
      /** @type {int32[]} */
      this.lzOffsetCodeLens = [];
      /** @type {int32[]} */
      this.lzOffsetCodes = [];
      /** @type {int32[]} */
      this.lengthFreqs = [];
      /** @type {int32} */
      this.lengthCount = 0;
      /** @type {int32[]} */
      this.lengthCodeLens = [];
      /** @type {int32[]} */
      this.lengthCodes = [];
    }

    /**
     * @param {uint8[]} data - Input
     * @returns {uint8[]} Forward Huffman bytes followed by the backward range words
     */
    Compress(data) {
      if (data.length === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      this.literalFreqs = filledArray(NUM_LITERAL_SYMBOLS, 1);
      this.literalCount = 0;
      this._rebuildLiteral();

      this.lzOffsetFreqs = filledArray(NUM_LZ_OFFSET_SLOTS, 1);
      this.lzOffsetCount = 0;
      this._rebuildLzOffset();

      this.lengthFreqs = filledArray(NUM_LENGTH_SYMBOLS, 1);
      this.lengthCount = 0;
      this._rebuildLength();

      /** @type {HashChainMatchFinder} */
      const matchFinder = new HashChainMatchFinder(data.length, CHAIN_DEPTH);
      /** @type {int32} */
      let pos = 0;

      while (pos < data.length) {
        /** @type {MatchResult} */
        let best = new MatchResult(0, 0);
        if (pos + 3 <= data.length) {
          best = matchFinder.FindMatch(data, pos,
            Math.min(pos, data.length),
            Math.min(MAX_MATCH_LENGTH, data.length - pos),
            MIN_MATCH_LENGTH);
        }

        if (best.length >= MIN_MATCH_LENGTH) {
          /** @type {int32} */
          let recentIndex = -1;
          for (let i = 0; i < NUM_RECENT_LZ_OFFSETS; ++i) {
            if (this.recentLzOffsets[i] !== best.distance) {
              continue;
            }
            recentIndex = i;
            break;
          }

          this._encodeProbBit(this.probMatch, PROB_LZ_MATCH, 1);
          this._encodeProbBit(this.probMatch, PROB_DELTA_MATCH, 0);

          if (recentIndex >= 0) {
            for (let i = 0; i < recentIndex; ++i) {
              this._encodeProbBit(this.probLzRepeat, i, 0);
            }
            this._encodeProbBit(this.probLzRepeat, recentIndex, 1);

            /** @type {int32} */
            const offset = this.recentLzOffsets[recentIndex];
            for (let j = recentIndex; j > 0; --j) {
              this.recentLzOffsets[j] = this.recentLzOffsets[j - 1];
            }
            this.recentLzOffsets[0] = offset;
          } else {
            for (let i = 0; i < NUM_RECENT_LZ_OFFSETS; ++i) {
              this._encodeProbBit(this.probLzRepeat, i, 0);
            }

            /** @type {int32} */
            const slot = offsetToSlot(best.distance);
            this._writeHuffman(slot, this.lzOffsetCodeLens, this.lzOffsetCodes, NUM_LZ_OFFSET_SLOTS);
            this._writeOffsetExtraBits(best.distance, slot);

            ++this.lzOffsetFreqs[slot];
            if (++this.lzOffsetCount >= LZ_OFFSET_REBUILD_INTERVAL) {
              this._rebuildLzOffset();
              halveFrequencies(this.lzOffsetFreqs, NUM_LZ_OFFSET_SLOTS);
              this.lzOffsetCount = 0;
            }

            this.recentLzOffsets[2] = this.recentLzOffsets[1];
            this.recentLzOffsets[1] = this.recentLzOffsets[0];
            this.recentLzOffsets[0] = best.distance;
          }

          this._encodeMatchLength(best.length);

          for (let i = 1; i < best.length && pos + i + 2 < data.length; ++i) {
            matchFinder.InsertPosition(data, pos + i);
          }
          pos += best.length;
        } else {
          this._encodeProbBit(this.probMatch, PROB_LZ_MATCH, 0);
          this._writeLiteral(data[pos]);
          ++pos;
        }
      }

      this._flushRangeEncoder();
      this._flushForwardBits();
      return this._mergeStreams();
    }

    _rebuildLiteral() {
      this.literalCodeLens = buildCodeLengths(this.literalFreqs, NUM_LITERAL_SYMBOLS, MAX_CODE_LENGTH);
      this.literalCodes = buildCanonicalCodes(this.literalCodeLens, NUM_LITERAL_SYMBOLS);
    }

    _rebuildLzOffset() {
      this.lzOffsetCodeLens = buildCodeLengths(this.lzOffsetFreqs, NUM_LZ_OFFSET_SLOTS, MAX_CODE_LENGTH);
      this.lzOffsetCodes = buildCanonicalCodes(this.lzOffsetCodeLens, NUM_LZ_OFFSET_SLOTS);
    }

    _rebuildLength() {
      this.lengthCodeLens = buildCodeLengths(this.lengthFreqs, NUM_LENGTH_SYMBOLS, MAX_CODE_LENGTH);
      this.lengthCodes = buildCanonicalCodes(this.lengthCodeLens, NUM_LENGTH_SYMBOLS);
    }

    /**
     * @param {uint8} value - Literal
     */
    _writeLiteral(value) {
      this._writeHuffman(value, this.literalCodeLens, this.literalCodes, NUM_LITERAL_SYMBOLS);
      ++this.literalFreqs[value];
      if (++this.literalCount >= LITERAL_REBUILD_INTERVAL) {
        this._rebuildLiteral();
        halveFrequencies(this.literalFreqs, NUM_LITERAL_SYMBOLS);
        this.literalCount = 0;
      }
    }

    /**
     * @param {int32} length - Match length
     */
    _encodeMatchLength(length) {
      /** @type {int32} */
      const sym = lengthToSymbol(length);
      this._writeHuffman(sym, this.lengthCodeLens, this.lengthCodes, NUM_LENGTH_SYMBOLS);

      /** @type {int32} */
      const extraBits = LENGTH_EXTRA_BITS[sym];
      if (extraBits > 0) {
        this._writeForwardBits(length - LENGTH_BASE[sym], extraBits);
      }

      ++this.lengthFreqs[sym];
      if (++this.lengthCount >= LENGTH_REBUILD_INTERVAL) {
        this._rebuildLength();
        halveFrequencies(this.lengthFreqs, NUM_LENGTH_SYMBOLS);
        this.lengthCount = 0;
      }
    }

    /**
     * @param {int32} offset - Match distance
     * @param {int32} slot - Its offset slot
     */
    _writeOffsetExtraBits(offset, slot) {
      /** @type {int32} */
      const extraBits = slotExtraBits(slot);
      if (extraBits <= 0) {
        return;
      }
      /** @type {int32} */
      const base = slotBaseOffset(slot, extraBits);
      /** @type {int32} */
      const extra = (offset - 1) - base;
      this._writeForwardBits(extra < 0 ? 0 : extra, extraBits);
    }

    /**
     * @param {int32} symbol - Symbol (out-of-range symbols code as 0)
     * @param {int32[]} codeLens - Code length per symbol
     * @param {int32[]} codes - Code per symbol
     * @param {int32} numSymbols - Alphabet size
     */
    _writeHuffman(symbol, codeLens, codes, numSymbols) {
      /** @type {int32} */
      const sym = symbol >= numSymbols ? 0 : symbol;
      /** @type {int32} */
      const len = codeLens[sym] <= 0 ? 1 : codeLens[sym];
      this._writeForwardBits(codes[sym], len);
    }

    // --- forward (Huffman) bitstream, MSB first ---

    /**
     * @param {uint32} value - Bits to write
     * @param {int32} count - Bit count
     */
    _writeForwardBits(value, count) {
      for (let i = count - 1; i >= 0; --i) {
        /** @type {int32} */
        const bit = OpCodes.And32(OpCodes.Shr32(value, i), 1);
        this.fwdAcc = this.fwdAcc * 2 + bit;
        ++this.fwdAccBits;
        if (this.fwdAccBits === 8) {
          this.fwdBytes.push(this.fwdAcc);
          this.fwdAcc = 0;
          this.fwdAccBits = 0;
        }
      }
    }

    _flushForwardBits() {
      if (this.fwdAccBits === 0) {
        return;
      }
      this.fwdBytes.push(OpCodes.And32(OpCodes.Shl32(this.fwdAcc, 8 - this.fwdAccBits), 0xFF));
      this.fwdAcc = 0;
      this.fwdAccBits = 0;
    }

    // --- backward range-coded bitstream ---

    // The bound (range >> 6) * prob stays below 2^32, so Mul32 is exact.
    /**
     * @param {int32[]} probs - Probability array
     * @param {int32} index - Probability slot
     * @param {int32} bit - Bit to code
     */
    _encodeProbBit(probs, index, bit) {
      /** @type {int32} */
      const prob = probs[index];
      /** @type {uint32} */
      const bound = OpCodes.Mul32(OpCodes.Shr32(this.rcRange, NUM_PROB_BITS), prob);
      if (bit === 0) {
        this.rcRange = bound;
        /** @type {int32} */
        const step = OpCodes.Shr32(PROB_DENOMINATOR - prob, PROB_ADAPT_SHIFT);
        probs[index] = prob + step;
      } else {
        this.rcLow += bound;
        this.rcRange = OpCodes.Sub32(this.rcRange, bound);
        /** @type {int32} */
        const step = OpCodes.Shr32(prob, PROB_ADAPT_SHIFT);
        probs[index] = prob - step;
      }
      this._normalizeRangeEncoder();
    }

    _normalizeRangeEncoder() {
      while (this.rcRange <= 0xFFFF) {
        this._emitRangeWord();
        this.rcRange = OpCodes.Shl32(this.rcRange, 16);
      }
    }

    _emitRangeWord() {
      /** @type {float64} */
      const carry = Math.floor(this.rcLow / 4294967296);
      /** @type {float64} */
      const word = Math.floor(this.rcLow / 65536) % 65536;

      if (carry !== 0) {
        for (let i = this.rcWords.length - 1; i >= 0; --i) {
          this.rcWords[i] = (this.rcWords[i] + 1) % 65536;
          if (this.rcWords[i] !== 0) {
            break;
          }
        }
      }

      this.rcWords.push(word);
      this.rcLow = (this.rcLow % 65536) * 65536;
    }

    _flushRangeEncoder() {
      for (let i = 0; i < 2; ++i) {
        this._emitRangeWord();
      }
      while (this.rcWords.length < 2) {
        this.rcWords.push(0);
      }
    }

    /**
     * @returns {uint8[]} Forward bytes, then the range words from the end backwards
     */
    _mergeStreams() {
      /** @type {uint8[]} */
      const result = new Array(this.fwdBytes.length + this.rcWords.length * 2);
      for (let i = 0; i < result.length; ++i) {
        result[i] = 0;
      }
      for (let i = 0; i < this.fwdBytes.length; ++i) {
        result[i] = this.fwdBytes[i];
      }

      // Word 0 occupies the final two bytes, word 1 the two before it, and so on.
      /** @type {int32} */
      let pos = result.length;
      for (let i = 0; i < this.rcWords.length; ++i) {
        pos -= 2;
        result[pos] = OpCodes.And32(this.rcWords[i], 0xFF);
        result[pos + 1] = OpCodes.And32(OpCodes.Shr32(this.rcWords[i], 8), 0xFF);
      }

      return result;
    }
  }

  // ===== DECOMPRESSOR =====

  class LzmsDecompressor {
    constructor() {
      /** @type {int32[]} */
      this.probMatch = filledArray(2, INITIAL_PROB);
      /** @type {int32[]} */
      this.probLzRepeat = filledArray(NUM_RECENT_LZ_OFFSETS, INITIAL_PROB);
      /** @type {int32[]} */
      this.probDeltaRepeat = filledArray(NUM_RECENT_DELTA_OFFSETS, INITIAL_PROB);
      /** @type {float64[]} */
      this.recentLzOffsets = [1, 1, 1];
      /** @type {int32[]} */
      this.recentDeltaPower = [0, 0, 0];
      /** @type {float64[]} */
      this.recentDeltaOffset = [1, 1, 1];

      /** @type {uint8[]} */
      this.input = [];
      /** @type {int32} */
      this.rcPos = 0;
      /** @type {uint32} */
      this.rcRange = 4294967295;
      /** @type {uint32} */
      this.rcCode = 0;
      /** @type {int32} */
      this.fwdPos = 0;
      /** @type {float64} */
      this.fwdAcc = 0;
      /** @type {int32} */
      this.fwdAccBits = 0;

      /** @type {int32[]} */
      this.literalFreqs = [];
      /** @type {int32} */
      this.literalCount = 0;
      /** @type {int32[]} */
      this.lzOffsetFreqs = [];
      /** @type {int32} */
      this.lzOffsetCount = 0;
      /** @type {int32[]} */
      this.lengthFreqs = [];
      /** @type {int32} */
      this.lengthCount = 0;
      /** @type {int32[]} */
      this.deltaPowerFreqs = [];
      /** @type {int32} */
      this.deltaPowerCount = 0;
      /** @type {int32[]} */
      this.deltaOffsetFreqs = [];
      /** @type {int32} */
      this.deltaOffsetCount = 0;

      /** @type {DecodeTable} */
      this.literalTable = new DecodeTable(filledArray(2, 0), 1);
      /** @type {DecodeTable} */
      this.lzOffsetTable = new DecodeTable(filledArray(2, 0), 1);
      /** @type {DecodeTable} */
      this.lengthTable = new DecodeTable(filledArray(2, 0), 1);
      /** @type {DecodeTable} */
      this.deltaPowerTable = new DecodeTable(filledArray(2, 0), 1);
      /** @type {DecodeTable} */
      this.deltaOffsetTable = new DecodeTable(filledArray(2, 0), 1);
    }

    /**
     * @param {uint8[]} input - Merged streams
     * @param {uint32} uncompressedSize - Number of bytes to produce
     * @returns {uint8[]} Decompressed bytes
     */
    Decompress(input, uncompressedSize) {
      if (uncompressedSize === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }
      if (input.length === 0) {
        throw new Error("LZMS decompression error: compressed data is empty");
      }

      this.input = input;
      /** @type {uint8[]} */
      const output = [];

      // Range decoder reads 16-bit words backwards from the end of the buffer.
      this.rcPos = input.length;
      this.rcRange = 4294967295;
      this.rcCode = 0;
      for (let i = 0; i < 4; ++i) {
        /** @type {uint8} */
        const next = this.rcPos > 0 ? input[--this.rcPos] : 0;
        this.rcCode = OpCodes.Or32(OpCodes.Shl32(this.rcCode, 8), next);
      }

      // Forward Huffman bitstream reads MSB-first from the start of the buffer.
      this.fwdPos = 0;
      this.fwdAcc = 0;
      this.fwdAccBits = 0;

      this.literalFreqs = filledArray(NUM_LITERAL_SYMBOLS, 1);
      this.literalCount = 0;
      this._rebuildLiteral();

      this.lzOffsetFreqs = filledArray(NUM_LZ_OFFSET_SLOTS, 1);
      this.lzOffsetCount = 0;
      this._rebuildLzOffset();

      this.lengthFreqs = filledArray(NUM_LENGTH_SYMBOLS, 1);
      this.lengthCount = 0;
      this._rebuildLength();

      this.deltaPowerFreqs = filledArray(NUM_DELTA_POWER_SYMBOLS, 1);
      this.deltaPowerCount = 0;
      this._rebuildDeltaPower();

      this.deltaOffsetFreqs = filledArray(NUM_DELTA_OFFSET_SLOTS, 1);
      this.deltaOffsetCount = 0;
      this._rebuildDeltaOffset();

      while (output.length < uncompressedSize) {
        /** @type {uint32} */
        const matchFlag = this._decodeProbBit(this.probMatch, PROB_LZ_MATCH);
        if (matchFlag === 0) {
          /** @type {int32} */
          const sym = this._decodeHuffman(this.literalTable, NUM_LITERAL_SYMBOLS);
          output.push(sym);

          ++this.literalFreqs[sym];
          if (++this.literalCount >= LITERAL_REBUILD_INTERVAL) {
            this._rebuildLiteral();
            halveFrequencies(this.literalFreqs, NUM_LITERAL_SYMBOLS);
            this.literalCount = 0;
          }
          continue;
        }

        /** @type {uint32} */
        const deltaFlag = this._decodeProbBit(this.probMatch, PROB_DELTA_MATCH);
        if (deltaFlag === 0) {
          this._decodeLzMatch(output, uncompressedSize);
        } else {
          this._decodeDeltaMatch(output, uncompressedSize);
        }
      }

      return output;
    }

    /**
     * @param {uint8[]} output - Output so far, appended to
     * @param {uint32} limit - Output size limit
     */
    _decodeLzMatch(output, limit) {
      for (let i = 0; i < NUM_RECENT_LZ_OFFSETS; ++i) {
        /** @type {uint32} */
        const repeatFlag = this._decodeProbBit(this.probLzRepeat, i);
        if (repeatFlag === 0) {
          continue;
        }

        /** @type {float64} */
        const offset = this.recentLzOffsets[i];
        for (let j = i; j > 0; --j) {
          this.recentLzOffsets[j] = this.recentLzOffsets[j - 1];
        }
        this.recentLzOffsets[0] = offset;

        /** @type {float64} */
        const repLength = this._decodeMatchLength();
        this._copyMatch(output, offset, repLength, limit);
        return;
      }

      /** @type {int32} */
      const slot = this._decodeHuffman(this.lzOffsetTable, NUM_LZ_OFFSET_SLOTS);
      /** @type {float64} */
      const offset = this._decodeOffsetFromSlot(slot);

      ++this.lzOffsetFreqs[slot];
      if (++this.lzOffsetCount >= LZ_OFFSET_REBUILD_INTERVAL) {
        this._rebuildLzOffset();
        halveFrequencies(this.lzOffsetFreqs, NUM_LZ_OFFSET_SLOTS);
        this.lzOffsetCount = 0;
      }

      this.recentLzOffsets[2] = this.recentLzOffsets[1];
      this.recentLzOffsets[1] = this.recentLzOffsets[0];
      this.recentLzOffsets[0] = offset;

      /** @type {float64} */
      const length = this._decodeMatchLength();
      this._copyMatch(output, offset, length, limit);
    }

    /**
     * @param {uint8[]} output - Output so far, appended to
     * @param {uint32} limit - Output size limit
     */
    _decodeDeltaMatch(output, limit) {
      for (let i = 0; i < NUM_RECENT_DELTA_OFFSETS; ++i) {
        /** @type {uint32} */
        const repeatFlag = this._decodeProbBit(this.probDeltaRepeat, i);
        if (repeatFlag === 0) {
          continue;
        }

        /** @type {int32} */
        const power = this.recentDeltaPower[i];
        /** @type {float64} */
        const deltaOffset = this.recentDeltaOffset[i];
        for (let j = i; j > 0; --j) {
          this.recentDeltaPower[j] = this.recentDeltaPower[j - 1];
          this.recentDeltaOffset[j] = this.recentDeltaOffset[j - 1];
        }
        this.recentDeltaPower[0] = power;
        this.recentDeltaOffset[0] = deltaOffset;

        /** @type {float64} */
        const repLength = this._decodeMatchLength();
        this._copyDeltaMatch(output, power, deltaOffset, repLength, limit);
        return;
      }

      /** @type {int32} */
      const power = this._decodeHuffman(this.deltaPowerTable, NUM_DELTA_POWER_SYMBOLS);
      ++this.deltaPowerFreqs[power];
      if (++this.deltaPowerCount >= DELTA_POWER_REBUILD_INTERVAL) {
        this._rebuildDeltaPower();
        halveFrequencies(this.deltaPowerFreqs, NUM_DELTA_POWER_SYMBOLS);
        this.deltaPowerCount = 0;
      }

      /** @type {int32} */
      const slot = this._decodeHuffman(this.deltaOffsetTable, NUM_DELTA_OFFSET_SLOTS);
      /** @type {float64} */
      const deltaOffset = this._decodeOffsetFromSlot(slot);
      ++this.deltaOffsetFreqs[slot];
      if (++this.deltaOffsetCount >= DELTA_OFFSET_REBUILD_INTERVAL) {
        this._rebuildDeltaOffset();
        halveFrequencies(this.deltaOffsetFreqs, NUM_DELTA_OFFSET_SLOTS);
        this.deltaOffsetCount = 0;
      }

      this.recentDeltaPower[2] = this.recentDeltaPower[1];
      this.recentDeltaPower[1] = this.recentDeltaPower[0];
      this.recentDeltaPower[0] = power;
      this.recentDeltaOffset[2] = this.recentDeltaOffset[1];
      this.recentDeltaOffset[1] = this.recentDeltaOffset[0];
      this.recentDeltaOffset[0] = deltaOffset;

      /** @type {float64} */
      const length = this._decodeMatchLength();
      this._copyDeltaMatch(output, power, deltaOffset, length, limit);
    }

    /**
     * @returns {float64} Match length
     */
    _decodeMatchLength() {
      /** @type {int32} */
      const sym = this._decodeHuffman(this.lengthTable, NUM_LENGTH_SYMBOLS);

      ++this.lengthFreqs[sym];
      if (++this.lengthCount >= LENGTH_REBUILD_INTERVAL) {
        this._rebuildLength();
        halveFrequencies(this.lengthFreqs, NUM_LENGTH_SYMBOLS);
        this.lengthCount = 0;
      }

      /** @type {float64} */
      let length = LENGTH_BASE[sym];
      /** @type {int32} */
      const extraBits = LENGTH_EXTRA_BITS[sym];
      if (extraBits > 0) {
        /** @type {float64} */
        const extra = this._readForwardBits(extraBits);
        length += extra;
      }
      return length;
    }

    // Extra-bit counts can exceed 32 for high slots of a corrupt stream; the
    // forward reader then works in plain double arithmetic, as before.
    /**
     * @param {int32} slot - Offset slot
     * @returns {float64} Offset
     */
    _decodeOffsetFromSlot(slot) {
      if (slot < 2) {
        return slot + 1;
      }
      /** @type {int32} */
      const extraBits = slotExtraBits(slot);
      /** @type {float64} */
      const base = slotBaseOffset(slot, extraBits);
      /** @type {float64} */
      let extra = 0;
      if (extraBits > 0) {
        extra = this._readForwardBits(extraBits);
      }
      return base + extra + 1;
    }

    /**
     * @param {uint8[]} output - Output so far, appended to
     * @param {float64} offset - Match distance
     * @param {float64} length - Match length
     * @param {uint32} limit - Output size limit
     */
    _copyMatch(output, offset, length, limit) {
      /** @type {float64} */
      const srcStart = output.length - offset;
      if (srcStart < 0) {
        throw new Error("LZMS decompression error: match offset exceeds output buffer");
      }
      for (let i = 0; i < length && output.length < limit; ++i) {
        output.push(output[srcStart + i]);
      }
    }

    /**
     * Delta match: the byte-level differences at stride 2^power repeat at the
     * given offset, so each byte is the previous byte one span back plus the
     * difference observed one offset earlier.
     * @param {uint8[]} output - Output so far, appended to
     * @param {int32} power - Stride exponent
     * @param {float64} deltaOffset - Offset of the difference source
     * @param {float64} length - Match length
     * @param {uint32} limit - Output size limit
     */
    _copyDeltaMatch(output, power, deltaOffset, length, limit) {
      /** @type {int32} */
      const span = OpCodes.Shl32(1, power);
      /** @type {float64} */
      const srcOffset = deltaOffset + span;
      for (let i = 0; i < length && output.length < limit; ++i) {
        /** @type {int32} */
        const outPos = output.length;
        /** @type {int32} */
        const prevAtSpan = outPos - span >= 0 ? output[outPos - span] : 0;
        /** @type {float64} */
        const srcPos = outPos - srcOffset;
        /** @type {float64} */
        const srcPrev = srcPos - span;
        /** @type {int32} */
        const matchByte = srcPos >= 0 ? output[srcPos] : 0;
        /** @type {int32} */
        const matchPrev = srcPrev >= 0 ? output[srcPrev] : 0;
        output.push(OpCodes.And32(prevAtSpan + matchByte - matchPrev, 0xFF));
      }
    }

    _rebuildLiteral() {
      this.literalTable = buildDecodeTable(
        buildCodeLengths(this.literalFreqs, NUM_LITERAL_SYMBOLS, MAX_CODE_LENGTH), NUM_LITERAL_SYMBOLS);
    }

    _rebuildLzOffset() {
      this.lzOffsetTable = buildDecodeTable(
        buildCodeLengths(this.lzOffsetFreqs, NUM_LZ_OFFSET_SLOTS, MAX_CODE_LENGTH), NUM_LZ_OFFSET_SLOTS);
    }

    _rebuildLength() {
      this.lengthTable = buildDecodeTable(
        buildCodeLengths(this.lengthFreqs, NUM_LENGTH_SYMBOLS, MAX_CODE_LENGTH), NUM_LENGTH_SYMBOLS);
    }

    _rebuildDeltaPower() {
      this.deltaPowerTable = buildDecodeTable(
        buildCodeLengths(this.deltaPowerFreqs, NUM_DELTA_POWER_SYMBOLS, MAX_CODE_LENGTH), NUM_DELTA_POWER_SYMBOLS);
    }

    _rebuildDeltaOffset() {
      this.deltaOffsetTable = buildDecodeTable(
        buildCodeLengths(this.deltaOffsetFreqs, NUM_DELTA_OFFSET_SLOTS, MAX_CODE_LENGTH), NUM_DELTA_OFFSET_SLOTS);
    }

    // --- backward range-coded bitstream ---

    /**
     * @param {int32[]} probs - Probability array
     * @param {int32} index - Probability slot
     * @returns {uint32} Decoded bit
     */
    _decodeProbBit(probs, index) {
      /** @type {int32} */
      const prob = probs[index];
      /** @type {uint32} */
      const bound = OpCodes.Mul32(OpCodes.Shr32(this.rcRange, NUM_PROB_BITS), prob);
      /** @type {uint32} */
      let bit = 0;
      if (this.rcCode < bound) {
        this.rcRange = bound;
        /** @type {int32} */
        const step = OpCodes.Shr32(PROB_DENOMINATOR - prob, PROB_ADAPT_SHIFT);
        probs[index] = prob + step;
        bit = 0;
      } else {
        this.rcCode = OpCodes.Sub32(this.rcCode, bound);
        this.rcRange = OpCodes.Sub32(this.rcRange, bound);
        /** @type {int32} */
        const step = OpCodes.Shr32(prob, PROB_ADAPT_SHIFT);
        probs[index] = prob - step;
        bit = 1;
      }
      this._normalizeRangeDecoder();
      return bit;
    }

    _normalizeRangeDecoder() {
      while (this.rcRange < 65536) {
        this.rcRange = OpCodes.Shl32(this.rcRange, 16);
        this.rcCode = OpCodes.Shl32(this.rcCode, 16);
        if (this.rcPos >= 2) {
          this.rcCode = OpCodes.Or32(
            OpCodes.Or32(this.rcCode, this.input[this.rcPos - 2]), OpCodes.Shl32(this.input[this.rcPos - 1], 8));
          this.rcPos -= 2;
        }
      }
    }

    // --- forward (Huffman) bitstream, MSB first ---

    /**
     * @param {int32} count - Bits wanted in the accumulator
     */
    _fillForwardBits(count) {
      while (this.fwdAccBits < count) {
        /** @type {uint8} */
        const next = this.fwdPos < this.input.length ? this.input[this.fwdPos++] : 0;
        this.fwdAcc = this.fwdAcc * 256 + next;
        this.fwdAccBits += 8;
      }
    }

    /**
     * @param {int32} count - Bit count
     * @returns {float64} Next count bits, not consumed
     */
    _peekForwardBits(count) {
      this._fillForwardBits(count);
      return Math.floor(this.fwdAcc / Math.pow(2, this.fwdAccBits - count));
    }

    /**
     * @param {int32} count - Bits to consume
     */
    _consumeForwardBits(count) {
      this.fwdAcc = this.fwdAcc % Math.pow(2, this.fwdAccBits - count);
      this.fwdAccBits -= count;
    }

    /**
     * @param {int32} count - Bit count
     * @returns {float64} Next count bits
     */
    _readForwardBits(count) {
      /** @type {float64} */
      const value = this._peekForwardBits(count);
      this._consumeForwardBits(count);
      return value;
    }

    /**
     * @param {DecodeTable} decodeTable - Lookup table
     * @param {int32} numSymbols - Alphabet size
     * @returns {int32} Decoded symbol (out-of-range symbols decode as 0)
     */
    _decodeHuffman(decodeTable, numSymbols) {
      /** @type {int32[]} */
      const table = decodeTable.table;
      /** @type {int32} */
      const tableBits = decodeTable.tableBits;
      if (table.length === 0 || tableBits === 0) {
        return 0;
      }

      /** @type {float64} */
      const peek = this._peekForwardBits(tableBits);
      /** @type {int32} */
      const entry = table[peek];
      /** @type {int32} */
      const sym = OpCodes.And32(entry, 0xFFFF);
      /** @type {int32} */
      let len = OpCodes.Shr32(entry, 16);
      if (len < 1) {
        len = tableBits;
      }
      this._consumeForwardBits(len);
      return sym < numSymbols ? sym : 0;
    }
  }

  // ===== LZMS ALGORITHM =====

  class LZMSAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LZMS";
      this.description = "Microsoft's LZ77 compression format, introduced with Windows 8 for the WIM (Windows Imaging Format) archiver and msdelta, succeeding LZX/Xpress-Huffman in that lineage. Interleaves a forward Huffman stream for literals, lengths and offset slots with a backward range-coded stream for the binary decisions. Clean-room implementation: no official Microsoft specification exists.";
      this.inventor = "Microsoft Corporation";
      this.year = 2012;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("wimlib - free implementation of the WIM/SWM/ESD formats (documents the reverse-engineered LZMS design)", "https://wimlib.net/"),
        new LinkItem("wimlib source repository", "https://github.com/ebiggers/wimlib")
      ];

      this.references = [
        new LinkItem("Windows Imaging Format (WIM) overview", "https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/windows-imaging-file-format-wim"),
        new LinkItem("LZMA SDK - adaptive binary range coder reference design", "https://www.7-zip.org/sdk.html")
      ];

      // Test vectors - confirmed to round-trip and to match the reference
      // implementation of the same stream layout byte for byte.
      /** @type {uint8[]} */
      const repetitive = [];
      for (let i = 0; i < 300; i++) {
        repetitive.push(0x42);
      }

      /** @type {uint8[]} */
      const alternating = [];
      for (let i = 0; i < 256; i++) {
        alternating.push(i % 2 === 0 ? 0xAA : 0x55);
      }

      // Deterministic pseudo-random binary sample (no Math.random - keeps the vector stable).
      // The product is evaluated in double precision, exactly as the committed vector expects.
      /** @type {uint8[]} */
      const pseudoRandom = [];
      /** @type {float64} */
      let seed = 0x2A6F11C3;
      for (let i = 0; i < 512; i++) {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        /** @type {float64} */
        const byte = seed % 256;
        pseudoRandom.push(byte);
      }

      this.tests = [
        new TestCase(
          [],
          [0, 0, 0, 0],
          "LZMS - empty input (header only)",
          "https://wimlib.net/"
        ),
        new TestCase(
          [0x21],
          [1, 0, 0, 0, 33, 0, 0, 0, 0],
          "LZMS - single byte",
          "https://wimlib.net/"
        ),
        new TestCase(
          repetitive,
          [44, 1, 0, 0, 66, 254, 44, 222, 31, 94, 92],
          "LZMS - long repetitive run (300x 0x42)",
          "https://github.com/ebiggers/wimlib"
        ),
        new TestCase(
          alternating,
          [0, 1, 0, 0, 170, 85, 0, 254, 112, 223, 152, 113, 38],
          "LZMS - alternating byte pattern (0xAA/0x55)",
          "https://github.com/ebiggers/wimlib"
        ),
        new TestCase(
          pseudoRandom,
          [0, 2, 0, 0, 0, 0, 64, 128, 0, 64, 0, 16, 32, 142, 0, 164, 64, 128, 128, 32, 69, 32, 62, 32, 18, 3, 197, 128, 10, 116, 5, 75, 0, 12, 6, 5, 64, 154, 160, 92, 176, 224, 21, 238, 2, 192, 193, 151, 48, 65, 88, 12, 65, 61, 96, 191, 32, 94, 176, 24, 151, 1, 90, 232, 36, 176, 15, 152, 49, 70, 14, 141, 96, 230, 196, 24, 245, 130, 133, 64, 18, 7, 0, 64, 187, 108, 23, 173, 3, 135, 96, 52, 14, 130, 169, 64, 173, 64, 81, 8, 50, 98, 8, 11, 6, 157, 1, 37, 1, 252, 172, 25, 85, 131, 131, 112, 25, 39, 1, 61, 96, 173, 124, 16, 157, 6, 104, 193, 110, 96, 142, 64, 163, 130, 12, 32, 131, 56, 32, 226, 132, 28, 99, 1, 220, 176, 33, 57, 1, 96, 224, 62, 242, 5, 235, 96, 224, 20, 11, 5, 160, 60, 130, 177, 96, 220, 168, 25, 49, 2, 200, 194, 222, 108, 47, 156, 115, 188, 186, 16, 195, 72, 155, 255, 38, 211, 163, 170, 255, 57, 41, 7, 126, 131, 80, 100, 3],
          "LZMS - pseudo-random binary sample",
          "https://github.com/ebiggers/wimlib"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("This WIM (Windows Imaging Format) image uses LZMS compression for maximum ratio."),
          [80, 0, 0, 0, 84, 104, 105, 115, 32, 87, 73, 77, 32, 40, 87, 105, 110, 100, 111, 119, 115, 32, 73, 109, 97, 103, 105, 110, 103, 32, 70, 111, 114, 109, 97, 116, 41, 32, 105, 3, 226, 202, 64, 234, 230, 202, 230, 64, 152, 180, 154, 166, 64, 198, 222, 218, 224, 228, 202, 230, 230, 210, 222, 220, 64, 204, 222, 228, 64, 218, 194, 240, 210, 218, 234, 218, 64, 228, 194, 232, 210, 222, 92, 0, 0, 79, 18, 87, 46, 0, 0],
          "LZMS - WIM-flavoured text",
          "https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/windows-imaging-file-format-wim"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new LZMSInstance(this, isInverse);
    }
  }

  // ===== LZMS INSTANCE =====

  class LZMSInstance extends IAlgorithmInstance {
    /**
     * @param {LZMSAlgorithm} algorithm - Owning algorithm
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
     * @returns {uint8[]} Compressed or decompressed bytes
     */
    Result() {
      /** @type {uint8[]} */
      const data = this.inputBuffer;
      this.inputBuffer = [];
      if (this.isInverse) {
        return this._decompress(data);
      }
      return this._compress(data);
    }

    /**
     * @param {uint8[]} data - Input
     * @returns {uint8[]} Size header followed by the merged streams
     */
    _compress(data) {
      // 4-byte little-endian uncompressed size header
      /** @type {uint8[]} */
      const output = [];
      output.push(OpCodes.And32(data.length, 0xFF));
      output.push(OpCodes.And32(OpCodes.Shr32(data.length, 8), 0xFF));
      output.push(OpCodes.And32(OpCodes.Shr32(data.length, 16), 0xFF));
      output.push(OpCodes.And32(OpCodes.Shr32(data.length, 24), 0xFF));

      /** @type {LzmsCompressor} */
      const compressor = new LzmsCompressor();
      /** @type {uint8[]} */
      const payload = compressor.Compress(data);
      for (let i = 0; i < payload.length; ++i) {
        output.push(payload[i]);
      }
      return output;
    }

    /**
     * @param {uint8[]} data - Size header followed by the merged streams
     * @returns {uint8[]} Decompressed bytes
     */
    _decompress(data) {
      if (data.length < 4) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }
      /** @type {uint32} */
      const uncompressedSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      if (uncompressedSize === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }
      /** @type {LzmsDecompressor} */
      const decompressor = new LzmsDecompressor();
      /** @type {uint8[]} */
      const decoded = decompressor.Decompress(data.slice(4), uncompressedSize);
      return decoded;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZMSAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZMSAlgorithm, LZMSInstance };
}));
