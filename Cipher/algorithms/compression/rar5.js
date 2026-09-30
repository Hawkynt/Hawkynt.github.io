/*
 * RAR5 (LZ + multi-table Huffman) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * RAR 5.0 is the archive format introduced with WinRAR 5 in 2013. Its default
 * compression method is an LZ77 stage over a power-of-two dictionary (128KB
 * minimum) whose tokens are entropy coded with four Huffman tables, all of
 * which are serialised at the head of every block through a 20-symbol
 * "pre-code" tree:
 *   - main table (306 symbols): literals 0-255, four repeated-offset symbols,
 *     a filter symbol, an end-of-block symbol, and match-length slots from 262
 *   - offset table (64 symbols): distance slots, each with a number of extra
 *     bits derived from the slot index
 *   - low-offset table (16 symbols): the low four bits of long distances
 *   - length table (44 symbols): match lengths for repeated-offset matches
 * Bits are written most-significant-first. Each block is preceded by a
 * byte-aligned header carrying flags (padding bits in the last byte, size
 * field width, last-block and table-present markers), a checksum byte
 * (0x5A xor flags xor the size bytes) and a 1-3 byte little-endian block size.
 *
 * This building block additionally prefixes a 4-byte little-endian
 * uncompressed size so a bare block round-trips without archive framing.
 *
 * This is a documented-subset implementation of the RAR5 block coding: the
 * encoder emits literals and plain matches only - no PPM modelling and no
 * delta/E8E9/ARM filter blocks - while the decoder tolerates the repeated
 * offset, filter and end-of-block symbols. Distances carry an implicit match
 * length bonus (+1 above 256, +2 above 8192, +3 above 262144) that the encoder
 * subtracts and the decoder adds back.
 *
 * References:
 * - RARLAB, "RAR 5.0 archive format" technical note
 * - Wikipedia, RAR (file format)
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes', './huffman-code-lengths.data'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('./huffman-code-lengths.data')
    );
  } else {
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

  if (!AlgorithmFramework)
    throw new Error('AlgorithmFramework dependency is required');

  if (!OpCodes)
    throw new Error('OpCodes dependency is required');

  if (!HuffmanCodeLengths)
    throw new Error('HuffmanCodeLengths dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== CONSTANTS =====

  const MAX_CODE_LENGTH = 15;
  const MAIN_TABLE_SIZE = 306;
  const OFFSET_TABLE_SIZE = 64;
  const LOW_OFFSET_TABLE_SIZE = 16;
  const LENGTH_TABLE_SIZE = 44;
  const CODE_LENGTH_TABLE_SIZE = 20;

  const LITERAL_COUNT = 256;
  const REPEAT_OFFSET0 = 256;
  const REPEAT_OFFSET3 = 259;
  const END_OF_BLOCK = 261;
  const MATCH_BASE = 262;

  const MIN_DICTIONARY_SIZE = 128 * 1024;
  const MAX_MATCH_LENGTH = 0x101 + 8;
  const MIN_MATCH_LENGTH = 2;

  /**
   * @param {int32} size - Number of entries
   * @returns {int32[]} Plain array of zeros
   */
  function zeroArray(size) {
    /** @type {int32[]} */
    const arr = new Array(size);
    for (let i = 0; i < size; ++i) {
      arr[i] = 0;
    }
    return arr;
  }

  /**
   * @param {int32} slot - Distance slot
   * @returns {int32} Extra-bit count of the slot
   */
  function distanceExtraBits(slot) {
    return slot < 4 ? 0 : OpCodes.Shr32(slot - 2, 1);
  }

  /**
   * @param {int32} slot - Distance slot
   * @returns {int32} Smallest distance (minus one) of the slot
   */
  function distanceBase(slot) {
    if (slot < 4) {
      return slot;
    }
    return OpCodes.Shl32(2 + OpCodes.And32(slot, 1), OpCodes.Shr32(slot - 2, 1));
  }

  // RAR5 grants extra length to matches at large distances.
  /**
   * @param {float64} distance - Match distance
   * @returns {int32} Length bonus
   */
  function lengthBonus(distance) {
    /** @type {int32} */
    let bonus = 0;
    if (distance > 0x100) {
      ++bonus;
    }
    if (distance > 0x2000) {
      ++bonus;
    }
    if (distance > 0x40000) {
      ++bonus;
    }
    return bonus;
  }

  /**
   * @param {int32} distance - Distance minus one
   * @returns {int32} Distance slot
   */
  function distanceSlot(distance) {
    if (distance < 4) {
      return distance;
    }
    /** @type {int32} */
    const p = 31 - Math.clz32(distance);
    /** @type {int32} */
    const low = OpCodes.And32(OpCodes.Shr32(distance, p - 1), 1);
    return 2 * p + low;
  }

  /**
   * @param {int32} slot - Length slot (8 or more)
   * @returns {int32} Extra-bit count of the slot
   */
  function lengthSlotBits(slot) {
    return Math.floor(slot / 4) - 1;
  }

  /**
   * @param {int32} slot - Length slot (8 or more)
   * @returns {int32} Smallest length of the slot
   */
  function lengthSlotBaseLen(slot) {
    /** @type {int32} */
    const shifted = OpCodes.Shl32(OpCodes.Or32(4, OpCodes.And32(slot, 3)), lengthSlotBits(slot));
    return 2 + shifted;
  }

  /**
   * @param {int32} length - Match length
   * @returns {int32} Length slot
   */
  function lengthSlot(length) {
    if (length <= 9) {
      return length - 2;
    }
    for (let slot = 43; slot >= 8; --slot) {
      /** @type {int32} */
      const baseLen = lengthSlotBaseLen(slot);
      /** @type {int32} */
      const span = OpCodes.Shl32(1, lengthSlotBits(slot));
      if (length >= baseLen && length <= baseLen + span - 1) {
        return slot;
      }
    }
    return 43;
  }

  // ===== BIT I/O (MSB-first) =====

  class Rar5BitWriter {
    constructor() {
      /** @type {uint8[]} */
      this.bytes = [];
      /** @type {uint32} */
      this.bitBuffer = 0;
      /** @type {int32} */
      this.bitsUsed = 0;
      /** @type {int32} */
      this.bitCount = 0;
    }

    /**
     * @param {uint32} value - Value whose low count bits are written
     * @param {int32} count - Bit count, most significant first
     */
    writeBits(value, count) {
      if (count > 0) {
        /** @type {uint32} */
        const masked = OpCodes.And32(value, OpCodes.BitMask(count));
        this.bitBuffer = OpCodes.Or32(this.bitBuffer, OpCodes.Shl32(masked, 32 - this.bitsUsed - count));
      }
      this.bitsUsed += count;
      this.bitCount += count;
      while (this.bitsUsed >= 8) {
        this.bytes.push(OpCodes.And32(OpCodes.Shr32(this.bitBuffer, 24), 0xFF));
        this.bitBuffer = OpCodes.Shl32(this.bitBuffer, 8);
        this.bitsUsed -= 8;
      }
    }

    // Copies bitCount bits out of an MSB-first packed byte array.
    /**
     * @param {uint8[]} data - Packed bits
     * @param {int32} bitCount - Number of bits to copy
     */
    writeBytes(data, bitCount) {
      /** @type {int32} */
      let remaining = bitCount;
      /** @type {int32} */
      let index = 0;
      while (remaining >= 8) {
        this.writeBits(data[index++], 8);
        remaining -= 8;
      }
      if (remaining > 0) {
        this.writeBits(OpCodes.Shr32(data[index], 8 - remaining), remaining);
      }
    }

    /**
     * @returns {uint8[]} Bytes written, the partial last byte included
     */
    toArray() {
      /** @type {uint8[]} */
      const out = this.bytes.slice();
      if (this.bitsUsed > 0) {
        out.push(OpCodes.And32(OpCodes.Shr32(this.bitBuffer, 24), 0xFF));
      }
      return out;
    }
  }

  class Rar5BitReader {
    /**
     * @param {uint8[]} data - Input
     */
    constructor(data) {
      /** @type {uint8[]} */
      this.data = data;
      /** @type {int32} */
      this.bytePos = 0;
      /** @type {uint32} */
      this.bitBuffer = 0;
      /** @type {int32} */
      this.bitsAvailable = 0;
    }

    /**
     * @returns {boolean} True when every input bit has been consumed
     */
    isAtEnd() {
      return this.bytePos >= this.data.length && this.bitsAvailable === 0;
    }

    /**
     * @param {int32} count - Bits wanted in the buffer
     */
    fill(count) {
      while (this.bitsAvailable < count && this.bytePos < this.data.length) {
        this.bitBuffer = OpCodes.Or32(this.bitBuffer, OpCodes.Shl32(this.data[this.bytePos++], 24 - this.bitsAvailable));
        this.bitsAvailable += 8;
      }
    }

    /**
     * @param {int32} count - Bit count
     * @returns {uint32} Next count bits (0 for a non-positive count)
     */
    readBits(count) {
      if (count <= 0) {
        return 0;
      }
      this.fill(count);
      /** @type {uint32} */
      const value = OpCodes.Shr32(this.bitBuffer, 32 - count);
      this.bitBuffer = OpCodes.Shl32(this.bitBuffer, count);
      this.bitsAvailable -= count;
      return value;
    }

    /**
     * @param {int32} count - Bit count
     * @returns {uint32} Next count bits, not consumed
     */
    peekBits(count) {
      this.fill(count);
      return OpCodes.Shr32(this.bitBuffer, 32 - count);
    }

    /**
     * @param {int32} count - Bits to consume
     */
    dropBits(count) {
      this.bitBuffer = OpCodes.Shl32(this.bitBuffer, count);
      this.bitsAvailable -= count;
    }

    alignToByte() {
      /** @type {int32} */
      const drop = OpCodes.And32(this.bitsAvailable, 7);
      if (drop <= 0) {
        return;
      }
      this.bitBuffer = OpCodes.Shl32(this.bitBuffer, drop);
      this.bitsAvailable -= drop;
    }
  }

  // ===== HUFFMAN CODE CONSTRUCTION =====

  /**
   * @param {int32[]} lengths - Code lengths, adjusted in place
   * @param {int32} numSymbols - Alphabet size
   * @param {int32} maxBits - Longest allowed code
   */
  function clampAndFixKraft(lengths, numSymbols, maxBits) {
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
        if (lengths[i] > 0 && lengths[i] < maxBits) {
          kraftSum -= OpCodes.Shr32(kraftMax, lengths[i]);
          ++lengths[i];
          kraftSum += OpCodes.Shr32(kraftMax, lengths[i]);
          if (kraftSum <= kraftMax) {
            break;
          }
        }
      }
    }
  }

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
    clampAndFixKraft(lengths, numSymbols, maxBits);
    return lengths;
  }

  /**
   * @param {int32[]} lengths - Code length per symbol
   * @param {int32} numSymbols - Alphabet size
   * @returns {int32[]} Code per symbol
   */
  function buildCanonicalCodes(lengths, numSymbols) {
    /** @type {int32} */
    let maxLen = 0;
    for (let i = 0; i < lengths.length; ++i) {
      if (lengths[i] > maxLen) {
        maxLen = lengths[i];
      }
    }

    /** @type {int32[]} */
    const codes = zeroArray(numSymbols);
    if (maxLen === 0) {
      return codes;
    }

    /** @type {int32[]} */
    const blCount = zeroArray(maxLen + 1);
    for (let i = 0; i < lengths.length; ++i) {
      if (lengths[i] > 0) {
        ++blCount[lengths[i]];
      }
    }

    /** @type {int32[]} */
    const nextCode = zeroArray(maxLen + 1);
    /** @type {int32} */
    let code = 0;
    for (let bits = 1; bits <= maxLen; ++bits) {
      code = OpCodes.Shl32(code + blCount[bits - 1], 1);
      nextCode[bits] = code;
    }

    for (let i = 0; i < numSymbols; ++i) {
      if (lengths[i] <= 0) {
        continue;
      }
      codes[i] = nextCode[lengths[i]]++;
    }

    return codes;
  }

  class Rar5HuffmanEncoder {
    constructor() {
      /** @type {int32[]} */
      this.codeLengths = [];
      /** @type {int32[]} */
      this.codes = [];
    }

    /**
     * @param {int32[]} frequencies - Frequency per symbol
     * @param {int32} numSymbols - Alphabet size
     */
    build(frequencies, numSymbols) {
      this.codeLengths = buildCodeLengths(frequencies, numSymbols, MAX_CODE_LENGTH);
      this.codes = buildCanonicalCodes(this.codeLengths, numSymbols);
    }

    /**
     * @param {Rar5BitWriter} writer - Output bits
     * @param {int32} symbol - Symbol to code
     */
    encodeSymbol(writer, symbol) {
      writer.writeBits(this.codes[symbol], this.codeLengths[symbol]);
    }
  }

  // ===== HUFFMAN DECODING =====

  const QUICK_BITS = 10;
  /** @type {int32} */
  const QUICK_SIZE = OpCodes.Shl32(1, QUICK_BITS);
  /** @type {uint32} */
  const SLOW_FLAG = 0x80000000;

  class Rar5HuffmanDecoder {
    constructor() {
      /** @type {int32[]} */
      this.quickTable = null;
      /** @type {int32} */
      this.maxCodeLength = 0;
      /** @type {int32[]} */
      this.slowSymbols = null;
      /** @type {int32[]} */
      this.slowCodes = null;
      /** @type {int32[]} */
      this.slowLengths = null;
      /** @type {int32} */
      this.slowCount = 0;
    }

    /**
     * @param {int32[]} codeLengths - Code length per symbol
     * @param {int32} numSymbols - Alphabet size
     */
    build(codeLengths, numSymbols) {
      this.maxCodeLength = 0;
      this.slowCount = 0;

      /** @type {int32} */
      let numUsed = 0;
      for (let i = 0; i < numSymbols; ++i) {
        if (codeLengths[i] <= 0) {
          continue;
        }
        this.maxCodeLength = Math.max(this.maxCodeLength, codeLengths[i]);
        ++numUsed;
      }

      if (numUsed === 0) {
        this.quickTable = new Int32Array(QUICK_SIZE).fill(-1);
        return;
      }

      if (numUsed === 1) {
        /** @type {int32} */
        let singleSymbol = 0;
        for (let i = 0; i < numSymbols; ++i) {
          if (codeLengths[i] > 0) {
            singleSymbol = i;
            break;
          }
        }
        /** @type {int32} */
        const entry = OpCodes.Or32(singleSymbol, OpCodes.Shl32(1, 16));
        this.quickTable = new Int32Array(QUICK_SIZE).fill(entry);
        return;
      }

      if (this.maxCodeLength > MAX_CODE_LENGTH) {
        this.maxCodeLength = MAX_CODE_LENGTH;
      }

      /** @type {int32[]} */
      const blCount = zeroArray(this.maxCodeLength + 1);
      for (let i = 0; i < numSymbols; ++i) {
        /** @type {int32} */
        const len = codeLengths[i];
        if (len > 0 && len <= this.maxCodeLength) {
          ++blCount[len];
        }
      }

      /** @type {int32[]} */
      const nextCode = zeroArray(this.maxCodeLength + 1);
      /** @type {int32} */
      let code = 0;
      for (let bits = 1; bits <= this.maxCodeLength; ++bits) {
        code = OpCodes.Shl32(code + blCount[bits - 1], 1);
        nextCode[bits] = code;
      }

      this.quickTable = new Int32Array(QUICK_SIZE).fill(-1);

      for (let sym = 0; sym < numSymbols; ++sym) {
        /** @type {int32} */
        const len = codeLengths[sym];
        if (len === 0 || len > this.maxCodeLength) {
          continue;
        }

        /** @type {int32} */
        const c = nextCode[len]++;
        /** @type {int32} */
        const entry = OpCodes.Or32(sym, OpCodes.Shl32(len, 16));

        if (len <= QUICK_BITS) {
          /** @type {int32} */
          const prefix = OpCodes.Shl32(c, QUICK_BITS - len);
          /** @type {int32} */
          const suffixCount = OpCodes.Shl32(1, QUICK_BITS - len);
          for (let j = 0; j < suffixCount; ++j) {
            this.quickTable[prefix + j] = entry;
          }
        } else {
          /** @type {int32} */
          const prefix = OpCodes.Shr32(c, len - QUICK_BITS);
          if (this.quickTable[prefix] === -1) {
            // The typed table stores the flagged entry as a negative int32.
            this.quickTable[prefix] = OpCodes.Or32(entry, SLOW_FLAG);
          }
        }
      }

      this._buildSlowTable(codeLengths, numSymbols);
    }

    /**
     * @param {int32[]} codeLengths - Code length per symbol
     * @param {int32} numSymbols - Alphabet size
     */
    _buildSlowTable(codeLengths, numSymbols) {
      /** @type {int32} */
      let count = 0;
      for (let i = 0; i < numSymbols; ++i) {
        if (codeLengths[i] > QUICK_BITS && codeLengths[i] <= this.maxCodeLength) {
          ++count;
        }
      }

      if (count === 0) {
        this.slowCount = 0;
        return;
      }

      this.slowSymbols = zeroArray(count);
      this.slowCodes = zeroArray(count);
      this.slowLengths = zeroArray(count);
      this.slowCount = count;

      /** @type {int32[]} */
      const blCount = zeroArray(this.maxCodeLength + 1);
      for (let i = 0; i < numSymbols; ++i) {
        /** @type {int32} */
        const len = codeLengths[i];
        if (len > 0 && len <= this.maxCodeLength) {
          ++blCount[len];
        }
      }

      /** @type {int32[]} */
      const nextCode = zeroArray(this.maxCodeLength + 1);
      /** @type {int32} */
      let code = 0;
      for (let bits = 1; bits <= this.maxCodeLength; ++bits) {
        code = OpCodes.Shl32(code + blCount[bits - 1], 1);
        nextCode[bits] = code;
      }

      /** @type {int32} */
      let index = 0;
      for (let sym = 0; sym < numSymbols; ++sym) {
        /** @type {int32} */
        const len = codeLengths[sym];
        /** @type {int32} */
        const c = nextCode[len]++;
        if (len <= QUICK_BITS || len > this.maxCodeLength) {
          continue;
        }
        this.slowSymbols[index] = sym;
        this.slowCodes[index] = c;
        this.slowLengths[index] = len;
        ++index;
      }
    }

    /**
     * @param {Rar5BitReader} reader - Input bits
     * @returns {int32} Decoded symbol (0 for an unassigned prefix)
     */
    decodeSymbol(reader) {
      if (this.quickTable === null) {
        throw new Error('RAR5: Huffman table has not been built');
      }

      reader.fill(this.maxCodeLength);
      /** @type {uint32} */
      const bits = reader.peekBits(QUICK_BITS);
      /** @type {int32} */
      const entry = this.quickTable[bits];

      if (entry >= 0) {
        /** @type {int32} */
        const symbol = OpCodes.And32(entry, 0xFFFF);
        /** @type {int32} */
        const length = OpCodes.And32(OpCodes.Shr32Signed(entry, 16), 0x7FFF);
        reader.dropBits(length);
        return symbol;
      }

      if (entry !== -1 && OpCodes.And32(entry, SLOW_FLAG) !== 0) {
        return this._decodeSlowPath(reader);
      }

      reader.dropBits(1);
      return 0;
    }

    /**
     * @param {Rar5BitReader} reader - Input bits
     * @returns {int32} Decoded symbol (0 when no long code matches)
     */
    _decodeSlowPath(reader) {
      if (this.slowCount === 0) {
        return 0;
      }

      /** @type {uint32} */
      const bits = reader.peekBits(this.maxCodeLength);
      for (let i = 0; i < this.slowCount; ++i) {
        /** @type {int32} */
        const len = this.slowLengths[i];
        /** @type {uint32} */
        const topBits = OpCodes.Shr32(bits, this.maxCodeLength - len);
        if (topBits !== this.slowCodes[i]) {
          continue;
        }
        reader.dropBits(len);
        return this.slowSymbols[i];
      }

      reader.dropBits(1);
      return 0;
    }
  }

  // ===== MATCH FINDER =====

  const HASH_BITS = 15;
  /** @type {int32} */
  const HASH_SIZE = OpCodes.Shl32(1, HASH_BITS);
  /** @type {int32} */
  const HASH_MASK = HASH_SIZE - 1;
  const MAX_CHAIN_DEPTH = 128;

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
    _hash(data, position) {
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
      const hash = this._hash(data, position);
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
        const distance = position - candidate;
        /** @type {int32} */
        const limit = Math.min(maxLength, Math.min(data.length - position, data.length - candidate));

        if (bestLength === 0 ||
            (bestLength < limit && data[candidate + bestLength] === data[position + bestLength])) {
          /** @type {int32} */
          let length = 0;
          while (length < limit && data[candidate + length] === data[position + length]) {
            ++length;
          }

          if (length >= minLength && length > bestLength) {
            bestLength = length;
            bestDistance = distance;
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
      const hash = this._hash(data, position);
      this.prev[OpCodes.And32(position, this.prevMask)] = this.head[hash];
      this.head[hash] = position;
    }
  }

  // ===== ENCODER =====

  /**
   * @param {int32[]} frequencies - Frequencies, padded in place
   */
  function ensureAtLeastTwo(frequencies) {
    /** @type {int32} */
    let count = 0;
    for (let i = 0; i < frequencies.length; ++i) {
      if (frequencies[i] > 0) {
        ++count;
      }
    }

    // A single-symbol table would let the decoder consume zero bits, so pad to
    // at least two used symbols.
    if (count === 0) {
      frequencies[0] = 1;
      frequencies[1] = 1;
      return;
    }
    if (count === 1) {
      for (let i = 0; i < frequencies.length; ++i) {
        if (frequencies[i] === 0) {
          frequencies[i] = 1;
          break;
        }
      }
    }
  }

  /**
   * Pre-code run-length list: per entry the symbol and the width and value of
   * the raw bits that follow it.
   */
  class RleSequence {
    constructor() {
      /** @type {int32[]} */
      this.sym = [];
      /** @type {int32[]} */
      this.extraBits = [];
      /** @type {int32[]} */
      this.extraValue = [];
    }

    /**
     * @param {int32} sym - Pre-code symbol
     * @param {int32} extraBits - Raw bits following it
     * @param {int32} extraValue - Their value
     */
    add(sym, extraBits, extraValue) {
      this.sym.push(sym);
      this.extraBits.push(extraBits);
      this.extraValue.push(extraValue);
    }
  }

  // Pre-code RLE alphabet: 0-15 direct lengths, 16 repeat previous (3 extra
  // bits, +3), 17 repeat previous (7 extra bits, +11), 18 zero run (3 extra
  // bits, +3), 19 zero run (7 extra bits, +11).
  /**
   * @param {int32[]} codeLengths - Code lengths
   * @param {int32} numSymbols - Alphabet size
   * @returns {RleSequence} Run-length coded list
   */
  function computeRleSequence(codeLengths, numSymbols) {
    /** @type {RleSequence} */
    const rle = new RleSequence();
    /** @type {int32} */
    let i = 0;

    while (i < numSymbols) {
      if (codeLengths[i] === 0) {
        /** @type {int32} */
        let run = 1;
        while (i + run < numSymbols && codeLengths[i + run] === 0) {
          ++run;
        }
        i += run;

        while (run > 0) {
          if (run >= 11) {
            /** @type {int32} */
            const count = Math.min(run, 138);
            rle.add(19, 7, count - 11);
            run -= count;
          } else if (run >= 3) {
            /** @type {int32} */
            const count = Math.min(run, 10);
            rle.add(18, 3, count - 3);
            run -= count;
          } else {
            rle.add(0, 0, 0);
            --run;
          }
        }
        continue;
      }

      /** @type {int32} */
      const value = codeLengths[i];
      rle.add(value, 0, 0);
      ++i;

      /** @type {int32} */
      let repeat = 0;
      while (i < numSymbols && codeLengths[i] === value) {
        ++repeat;
        ++i;
      }

      while (repeat > 0) {
        if (repeat >= 11) {
          /** @type {int32} */
          const count = Math.min(repeat, 138);
          rle.add(17, 7, count - 11);
          repeat -= count;
        } else if (repeat >= 3) {
          /** @type {int32} */
          const count = Math.min(repeat, 10);
          rle.add(16, 3, count - 3);
          repeat -= count;
        } else {
          rle.add(value, 0, 0);
          --repeat;
        }
      }
    }

    return rle;
  }

  /**
   * @param {Rar5BitWriter} writer - Output bits
   * @param {int32} slot - Length slot
   * @param {int32} length - Match length
   */
  function writeLengthExtra(writer, slot, length) {
    if (slot < 8) {
      return;
    }
    writer.writeBits(length - lengthSlotBaseLen(slot), lengthSlotBits(slot));
  }

  /**
   * @param {Rar5BitWriter} writer - Output bits
   * @param {int32} distance - Match distance
   * @param {Rar5HuffmanEncoder} offsetEncoder - Distance slot encoder
   * @param {Rar5HuffmanEncoder} lowOffsetEncoder - Low-nibble encoder
   */
  function encodeDistance(writer, distance, offsetEncoder, lowOffsetEncoder) {
    /** @type {int32} */
    const dist0 = distance - 1;
    /** @type {int32} */
    const slot = distanceSlot(dist0);
    offsetEncoder.encodeSymbol(writer, slot);

    /** @type {int32} */
    const extraBits = distanceExtraBits(slot);
    if (extraBits <= 0) {
      return;
    }

    /** @type {int32} */
    const base = distanceBase(slot);
    /** @type {int32} */
    const extra = dist0 - base;
    if (extraBits >= 4) {
      if (extraBits > 4) {
        writer.writeBits(OpCodes.Shr32(extra, 4), extraBits - 4);
      }
      lowOffsetEncoder.encodeSymbol(writer, OpCodes.And32(extra, 0xF));
      return;
    }

    writer.writeBits(extra, extraBits);
  }

  /**
   * @param {Rar5BitWriter} writer - Output bits
   * @param {int32} blockBitSize - Bits in the block body
   * @param {boolean} tablePresent - True when the body starts with tables
   * @param {boolean} lastBlock - True for the final block
   */
  function writeBlockHeader(writer, blockBitSize, tablePresent, lastBlock) {
    /** @type {int32} */
    const bitsToAlign = (8 - (writer.bitCount % 8)) % 8;
    if (bitsToAlign > 0) {
      writer.writeBits(0, bitsToAlign);
    }

    /** @type {int32} */
    const blockSize = Math.floor((blockBitSize + 7) / 8);
    /** @type {int32} */
    const paddingBits = blockSize * 8 - blockBitSize;

    /** @type {int32} */
    let byteCount = 0;
    if (blockSize <= 0xFF) {
      byteCount = 1;
    } else if (blockSize <= 0xFFFF) {
      byteCount = 2;
    } else {
      byteCount = 3;
    }

    /** @type {uint32} */
    const blockFlags = OpCodes.And32(
      OpCodes.Or32(
        OpCodes.Or32(OpCodes.And32(7 - paddingBits, 0x07), OpCodes.Shl32(OpCodes.And32(byteCount - 1, 0x03), 3)),
        OpCodes.Or32(lastBlock ? 0x40 : 0x00, tablePresent ? 0x80 : 0x00)
      ),
      0xFF
    );

    /** @type {uint32} */
    let checkSum = OpCodes.And32(OpCodes.Xor32(0x5A, blockFlags), 0xFF);
    for (let i = 0; i < byteCount; ++i) {
      checkSum = OpCodes.And32(OpCodes.Xor32(checkSum, OpCodes.And32(OpCodes.Shr32(blockSize, i * 8), 0xFF)), 0xFF);
    }

    writer.writeBits(blockFlags, 8);
    writer.writeBits(checkSum, 8);
    for (let i = 0; i < byteCount; ++i) {
      writer.writeBits(OpCodes.And32(OpCodes.Shr32(blockSize, i * 8), 0xFF), 8);
    }
  }

  /**
   * Parsed tokens as parallel rows.
   */
  class Rar5Tokens {
    constructor() {
      /** @type {boolean[]} */
      this.isLiteral = [];
      /** @type {int32[]} */
      this.literal = [];
      /** @type {int32[]} */
      this.matchLength = [];
      /** @type {int32[]} */
      this.distance = [];
    }

    /**
     * @param {boolean} isLiteral - True for a literal
     * @param {int32} literal - Literal byte
     * @param {int32} length - Coded match length (bonus removed)
     * @param {int32} distance - Match distance
     */
    add(isLiteral, literal, length, distance) {
      this.isLiteral.push(isLiteral);
      this.literal.push(literal);
      this.matchLength.push(length);
      this.distance.push(distance);
    }
  }

  /**
   * @param {uint8[]} data - Input
   * @returns {uint8[]} One block with header, tables and tokens
   */
  function rar5Compress(data) {
    if (data.length === 0) {
      /** @type {uint8[]} */
      const empty = [];
      return empty;
    }

    /** @type {int32} */
    const dictionarySize = MIN_DICTIONARY_SIZE;
    /** @type {HashChainMatchFinder} */
    const matchFinder = new HashChainMatchFinder(dictionarySize, MAX_CHAIN_DEPTH);

    // ---- LZ token collection ----
    /** @type {Rar5Tokens} */
    const tokens = new Rar5Tokens();
    /** @type {int32} */
    let pos = 0;
    while (pos < data.length) {
      /** @type {MatchResult} */
      const match = matchFinder.findMatch(data, pos, dictionarySize, MAX_MATCH_LENGTH, MIN_MATCH_LENGTH);
      /** @type {int32} */
      const bonus = lengthBonus(match.distance);

      if (match.length >= MIN_MATCH_LENGTH + bonus) {
        /** @type {int32} */
        const useLength = match.length;
        tokens.add(false, 0, useLength - bonus, match.distance);
        for (let i = 1; i < useLength && pos + i < data.length; ++i) {
          matchFinder.insertPosition(data, pos + i);
        }
        pos += useLength;
        continue;
      }

      tokens.add(true, data[pos], 0, 0);
      ++pos;
    }

    // ---- frequency tables ----
    /** @type {int32[]} */
    const mainFreq = zeroArray(MAIN_TABLE_SIZE);
    /** @type {int32[]} */
    const offsetFreq = zeroArray(OFFSET_TABLE_SIZE);
    /** @type {int32[]} */
    const lowOffsetFreq = zeroArray(LOW_OFFSET_TABLE_SIZE);
    /** @type {int32[]} */
    const lengthFreq = zeroArray(LENGTH_TABLE_SIZE);

    for (let i = 0; i < tokens.isLiteral.length; ++i) {
      if (tokens.isLiteral[i]) {
        ++mainFreq[tokens.literal[i]];
        continue;
      }
      /** @type {int32} */
      const lenSlot = lengthSlot(tokens.matchLength[i]);
      ++mainFreq[MATCH_BASE + lenSlot];
      /** @type {int32} */
      const slot = distanceSlot(tokens.distance[i] - 1);
      ++offsetFreq[slot];
      if (distanceExtraBits(slot) >= 4) {
        /** @type {int32} */
        const base = distanceBase(slot);
        ++lowOffsetFreq[OpCodes.And32((tokens.distance[i] - 1) - base, 0xF)];
      }
    }

    ensureAtLeastTwo(mainFreq);
    ensureAtLeastTwo(offsetFreq);
    ensureAtLeastTwo(lowOffsetFreq);
    ensureAtLeastTwo(lengthFreq);

    /** @type {Rar5HuffmanEncoder} */
    const mainEncoder = new Rar5HuffmanEncoder();
    /** @type {Rar5HuffmanEncoder} */
    const offsetEncoder = new Rar5HuffmanEncoder();
    /** @type {Rar5HuffmanEncoder} */
    const lowOffsetEncoder = new Rar5HuffmanEncoder();
    /** @type {Rar5HuffmanEncoder} */
    const lengthEncoder = new Rar5HuffmanEncoder();

    mainEncoder.build(mainFreq, MAIN_TABLE_SIZE);
    offsetEncoder.build(offsetFreq, OFFSET_TABLE_SIZE);
    lowOffsetEncoder.build(lowOffsetFreq, LOW_OFFSET_TABLE_SIZE);
    lengthEncoder.build(lengthFreq, LENGTH_TABLE_SIZE);

    // ---- block body: serialised tables, then tokens ----
    /** @type {Rar5BitWriter} */
    const blockWriter = new Rar5BitWriter();

    /** @type {RleSequence[]} */
    const rleSequences = [];
    rleSequences.push(computeRleSequence(mainEncoder.codeLengths, MAIN_TABLE_SIZE));
    rleSequences.push(computeRleSequence(offsetEncoder.codeLengths, OFFSET_TABLE_SIZE));
    rleSequences.push(computeRleSequence(lowOffsetEncoder.codeLengths, LOW_OFFSET_TABLE_SIZE));
    rleSequences.push(computeRleSequence(lengthEncoder.codeLengths, LENGTH_TABLE_SIZE));

    /** @type {int32[]} */
    const preCodeFreq = zeroArray(CODE_LENGTH_TABLE_SIZE);
    for (let s = 0; s < rleSequences.length; ++s) {
      /** @type {RleSequence} */
      const sequence = rleSequences[s];
      for (let i = 0; i < sequence.sym.length; ++i) {
        ++preCodeFreq[sequence.sym[i]];
      }
    }

    /** @type {Rar5HuffmanEncoder} */
    const preCodeEncoder = new Rar5HuffmanEncoder();
    preCodeEncoder.build(preCodeFreq, CODE_LENGTH_TABLE_SIZE);

    // Pre-code lengths, 4 bits each. A literal 15 is escaped by a following
    // zero nibble so it cannot be read as a zero-fill directive.
    for (let i = 0; i < CODE_LENGTH_TABLE_SIZE; ++i) {
      blockWriter.writeBits(preCodeEncoder.codeLengths[i], 4);
      if (preCodeEncoder.codeLengths[i] === 15) {
        blockWriter.writeBits(0, 4);
      }
    }

    for (let s = 0; s < rleSequences.length; ++s) {
      /** @type {RleSequence} */
      const sequence = rleSequences[s];
      for (let i = 0; i < sequence.sym.length; ++i) {
        preCodeEncoder.encodeSymbol(blockWriter, sequence.sym[i]);
        if (sequence.extraBits[i] > 0) {
          blockWriter.writeBits(sequence.extraValue[i], sequence.extraBits[i]);
        }
      }
    }

    for (let i = 0; i < tokens.isLiteral.length; ++i) {
      if (tokens.isLiteral[i]) {
        mainEncoder.encodeSymbol(blockWriter, tokens.literal[i]);
        continue;
      }
      /** @type {int32} */
      const length = tokens.matchLength[i];
      /** @type {int32} */
      const slot = lengthSlot(length);
      mainEncoder.encodeSymbol(blockWriter, MATCH_BASE + slot);
      writeLengthExtra(blockWriter, slot, length);
      encodeDistance(blockWriter, tokens.distance[i], offsetEncoder, lowOffsetEncoder);
    }

    /** @type {int32} */
    const blockBitSize = blockWriter.bitCount;
    /** @type {uint8[]} */
    const blockBytes = blockWriter.toArray();

    /** @type {Rar5BitWriter} */
    const writer = new Rar5BitWriter();
    writeBlockHeader(writer, blockBitSize, true, true);
    writer.writeBytes(blockBytes, blockBitSize);
    /** @type {uint8[]} */
    const packed = writer.toArray();
    return packed;
  }

  // ===== DECODER =====

  /**
   * @param {Rar5BitReader} reader - Input bits
   * @param {int32} slot - Length slot
   * @returns {int32} Match length
   */
  function slotToLength(reader, slot) {
    if (slot < 8) {
      return slot + 2;
    }
    /** @type {int32} */
    const lBits = lengthSlotBits(slot);
    /** @type {int32} */
    let length = lengthSlotBaseLen(slot);
    if (lBits > 0) {
      /** @type {int32} */
      const extra = reader.readBits(lBits);
      length += extra;
    }
    return length;
  }

  /**
   * @param {Rar5BitReader} reader - Input bits
   * @param {Rar5HuffmanDecoder} preCodeDecoder - Pre-code decoder
   * @param {int32} count - Alphabet size
   * @returns {int32[]} Code lengths
   */
  function readCodeLengths(reader, preCodeDecoder, count) {
    /** @type {int32[]} */
    const lengths = zeroArray(count);
    /** @type {int32} */
    let i = 0;

    while (i < count) {
      /** @type {int32} */
      const sym = preCodeDecoder.decodeSymbol(reader);

      if (sym < 16) {
        lengths[i++] = sym;
        continue;
      }

      if (sym === 16 || sym === 17) {
        if (i === 0) {
          throw new Error('RAR5: code length repeat at start of table');
        }
        /** @type {int32} */
        let repeat = 0;
        if (sym === 16) {
          /** @type {int32} */
          const field = reader.readBits(3);
          repeat = field + 3;
        } else {
          /** @type {int32} */
          const field = reader.readBits(7);
          repeat = field + 11;
        }
        /** @type {int32} */
        const previous = lengths[i - 1];
        for (let j = 0; j < repeat && i < count; ++j) {
          lengths[i++] = previous;
        }
        continue;
      }

      if (sym === 18 || sym === 19) {
        /** @type {int32} */
        let repeat = 0;
        if (sym === 18) {
          /** @type {int32} */
          const field = reader.readBits(3);
          repeat = field + 3;
        } else {
          /** @type {int32} */
          const field = reader.readBits(7);
          repeat = field + 11;
        }
        for (let j = 0; j < repeat && i < count; ++j) {
          lengths[i++] = 0;
        }
        continue;
      }

      throw new Error('RAR5: invalid pre-code symbol');
    }

    return lengths;
  }

  class Rar5Decoder {
    /**
     * @param {int32} dictionarySize - Minimum window size
     */
    constructor(dictionarySize) {
      /** @type {int32} */
      let size = 1;
      while (size < dictionarySize) {
        size = OpCodes.Shl32(size, 1);
      }
      /** @type {uint8[]} */
      this.window = new Uint8Array(size);
      /** @type {int32} */
      this.windowMask = size - 1;
      /** @type {int32} */
      this.windowPos = 0;
      /** @type {float64[]} */
      this.repDist = [0, 0, 0, 0];
      /** @type {int32} */
      this.lastLength = 0;
      /** @type {Rar5HuffmanDecoder} */
      this.mainDecoder = new Rar5HuffmanDecoder();
      /** @type {Rar5HuffmanDecoder} */
      this.offsetDecoder = new Rar5HuffmanDecoder();
      /** @type {Rar5HuffmanDecoder} */
      this.lowOffsetDecoder = new Rar5HuffmanDecoder();
      /** @type {Rar5HuffmanDecoder} */
      this.lengthDecoder = new Rar5HuffmanDecoder();
      /** @type {boolean} */
      this.tablesRead = false;
    }

    /**
     * @param {Rar5BitReader} reader - Input bits
     */
    _readTables(reader) {
      /** @type {int32[]} */
      const preCodeLengths = zeroArray(CODE_LENGTH_TABLE_SIZE);

      // A raw 15 followed by a non-zero nibble means "fill count+2 zeros";
      // followed by a zero nibble it is a literal length of 15.
      for (let i = 0; i < CODE_LENGTH_TABLE_SIZE;) {
        /** @type {int32} */
        const len = reader.readBits(4);
        if (len === 15) {
          /** @type {int32} */
          const count = reader.readBits(4);
          if (count !== 0) {
            for (let j = 0; j < count + 2 && i < CODE_LENGTH_TABLE_SIZE; ++j) {
              preCodeLengths[i++] = 0;
            }
            continue;
          }
        }
        preCodeLengths[i++] = len;
      }

      /** @type {Rar5HuffmanDecoder} */
      const preCodeDecoder = new Rar5HuffmanDecoder();
      preCodeDecoder.build(preCodeLengths, CODE_LENGTH_TABLE_SIZE);

      this.mainDecoder.build(readCodeLengths(reader, preCodeDecoder, MAIN_TABLE_SIZE), MAIN_TABLE_SIZE);
      this.offsetDecoder.build(readCodeLengths(reader, preCodeDecoder, OFFSET_TABLE_SIZE), OFFSET_TABLE_SIZE);
      this.lowOffsetDecoder.build(readCodeLengths(reader, preCodeDecoder, LOW_OFFSET_TABLE_SIZE), LOW_OFFSET_TABLE_SIZE);
      this.lengthDecoder.build(readCodeLengths(reader, preCodeDecoder, LENGTH_TABLE_SIZE), LENGTH_TABLE_SIZE);
    }

    // High slots of a corrupt stream give distances up to 2^32; the window
    // mask folds them exactly as before.
    /**
     * @param {Rar5BitReader} reader - Input bits
     * @returns {float64} Match distance
     */
    _decodeDistance(reader) {
      /** @type {int32} */
      const slot = this.offsetDecoder.decodeSymbol(reader);
      if (slot < 4) {
        return slot + 1;
      }

      /** @type {int32} */
      const extraBits = OpCodes.Shr32(slot - 2, 1);
      /** @type {float64} */
      const baseDist = OpCodes.Shl32(2 + OpCodes.And32(slot, 1), extraBits);

      if (extraBits >= 4) {
        /** @type {uint32} */
        let highBits = 0;
        if (extraBits > 4) {
          highBits = reader.readBits(extraBits - 4);
        }
        /** @type {float64} */
        const lowBits = this.lowOffsetDecoder.decodeSymbol(reader);
        /** @type {float64} */
        const high = OpCodes.Shl32(highBits, 4);
        return baseDist + high + lowBits + 1;
      }

      /** @type {float64} */
      const extra = reader.readBits(extraBits);
      return baseDist + extra + 1;
    }

    /**
     * @param {uint8[]} output - Output buffer
     * @param {int32} outputPos - Next output position
     * @param {uint32} maxOutput - Output size
     * @param {float64} distance - Match distance
     * @param {int32} length - Match length
     * @returns {int32} Bytes copied
     */
    _copyMatch(output, outputPos, maxOutput, distance, length) {
      /** @type {int32} */
      let copied = 0;
      for (let i = 0; i < length && outputPos + copied < maxOutput; ++i) {
        /** @type {uint8} */
        const b = this.window[OpCodes.And32(this.windowPos - distance, this.windowMask)];
        output[outputPos + copied] = b;
        this.window[OpCodes.And32(this.windowPos, this.windowMask)] = b;
        ++this.windowPos;
        ++copied;
      }
      return copied;
    }

    /**
     * @param {uint8[]} compressed - Block stream
     * @param {uint32} uncompressedSize - Number of bytes to produce
     * @returns {uint8[]} Decompressed bytes (zero-filled past the stream's end)
     */
    decompress(compressed, uncompressedSize) {
      if (uncompressedSize === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      /** @type {Rar5BitReader} */
      const reader = new Rar5BitReader(compressed);
      /** @type {uint8[]} */
      const output = new Array(uncompressedSize);
      output.fill(0);
      /** @type {int32} */
      let outputPos = 0;

      this.tablesRead = false;

      while (outputPos < uncompressedSize) {
        /** @type {boolean} */
        const atEnd = reader.isAtEnd();
        if (atEnd) {
          break;
        }
        if (!this.tablesRead) {
          reader.alignToByte();

          /** @type {uint32} */
          const blockFlags = reader.readBits(8);
          reader.readBits(8); // header checksum byte

          /** @type {int32} */
          const byteCount = OpCodes.And32(OpCodes.Shr32(blockFlags, 3), 3) + 1;
          if (byteCount === 4) {
            throw new Error('RAR5: invalid block header size field');
          }

          for (let b = 0; b < byteCount; ++b) {
            reader.readBits(8); // block size, unused here
          }

          if (OpCodes.And32(blockFlags, 0x80) !== 0) {
            this._readTables(reader);
          }
          this.tablesRead = true;
        }

        /** @type {int32} */
        const sym = this.mainDecoder.decodeSymbol(reader);

        if (sym < LITERAL_COUNT) {
          output[outputPos] = sym;
          this.window[OpCodes.And32(this.windowPos, this.windowMask)] = sym;
          ++this.windowPos;
          ++outputPos;
          continue;
        }

        if (sym >= MATCH_BASE && sym < MAIN_TABLE_SIZE) {
          /** @type {int32} */
          let matchLength = slotToLength(reader, sym - MATCH_BASE);
          /** @type {float64} */
          let distance = this._decodeDistance(reader);
          if (distance < 0) {
            distance = 0;
          }

          matchLength += lengthBonus(distance);

          this.repDist[3] = this.repDist[2];
          this.repDist[2] = this.repDist[1];
          this.repDist[1] = this.repDist[0];
          this.repDist[0] = distance;
          this.lastLength = matchLength;

          /** @type {int32} */
          const copied = this._copyMatch(output, outputPos, uncompressedSize, distance, matchLength);
          outputPos += copied;
          continue;
        }

        if (sym >= REPEAT_OFFSET0 && sym <= REPEAT_OFFSET3) {
          /** @type {int32} */
          const repIndex = sym - REPEAT_OFFSET0;
          /** @type {float64} */
          const distance = this.repDist[repIndex];
          for (let i = repIndex; i > 0; --i) {
            this.repDist[i] = this.repDist[i - 1];
          }
          this.repDist[0] = distance;

          /** @type {int32} */
          let matchLength = 0;
          if (sym === REPEAT_OFFSET0) {
            matchLength = this.lastLength;
            if (matchLength === 0) {
              matchLength = 2;
            }
          } else {
            /** @type {int32} */
            const lenSym = this.lengthDecoder.decodeSymbol(reader);
            matchLength = slotToLength(reader, lenSym);
          }

          this.lastLength = matchLength;
          /** @type {int32} */
          const copied = this._copyMatch(output, outputPos, uncompressedSize, distance, matchLength);
          outputPos += copied;
          continue;
        }

        if (sym === END_OF_BLOCK) {
          this.tablesRead = false;
        }
      }

      return output;
    }
  }

  // ===== BUILDING BLOCK CONTAINER =====

  /**
   * @param {uint8[]} data - Input
   * @returns {uint8[]} Size header followed by the block
   */
  function blockCompress(data) {
    /** @type {uint8[]} */
    const compressed = rar5Compress(data);
    /** @type {uint32} */
    const size = OpCodes.ToUint32(data.length);
    /** @type {uint8[]} */
    const out = [];
    out.push(OpCodes.And32(size, 0xFF));
    out.push(OpCodes.And32(OpCodes.Shr32(size, 8), 0xFF));
    out.push(OpCodes.And32(OpCodes.Shr32(size, 16), 0xFF));
    out.push(OpCodes.And32(OpCodes.Shr32(size, 24), 0xFF));
    for (let i = 0; i < compressed.length; ++i) {
      out.push(compressed[i]);
    }
    return out;
  }

  /**
   * @param {uint8[]} data - Size header followed by the block
   * @returns {uint8[]} Decompressed bytes
   */
  function blockDecompress(data) {
    if (data.length < 4) {
      /** @type {uint8[]} */
      const empty = [];
      return empty;
    }

    /** @type {uint32} */
    const originalSize = OpCodes.Or32(
      OpCodes.Or32(OpCodes.Or32(data[0], OpCodes.Shl32(data[1], 8)), OpCodes.Shl32(data[2], 16)),
      OpCodes.Shl32(data[3], 24)
    );

    /** @type {Rar5Decoder} */
    const decoder = new Rar5Decoder(MIN_DICTIONARY_SIZE);
    /** @type {uint8[]} */
    const decoded = decoder.decompress(data.slice(4), originalSize);
    return decoded;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class Rar5Compression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "RAR5";
      this.description = "Block compression stage of the RAR 5.0 archive format: LZ77 over a 128KB dictionary whose literals, match-length slots, distance slots and low-distance nibbles are entropy coded with four Huffman tables, themselves serialised through a 20-symbol pre-code with run-length escapes. Bits are most-significant-first and each block carries a byte-aligned flags/checksum/size header. Documented-subset implementation covering literals and plain matches; PPM modelling and the delta/E8E9/ARM filters are out of scope.";
      this.inventor = "Eugene Roshal";
      this.year = 2013;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.RU;

      this.documentation = [
        new LinkItem("RARLAB - RAR 5.0 archive format technical note", "https://www.rarlab.com/technote.htm"),
        new LinkItem("Wikipedia - RAR (file format)", "https://en.wikipedia.org/wiki/RAR_(file_format)"),
        new LinkItem("Wikipedia - LZ77 and LZ78", "https://en.wikipedia.org/wiki/LZ77_and_LZ78")
      ];

      this.references = [
        new LinkItem("RARLAB - UnRAR source distribution", "https://www.rarlab.com/rar_add.htm"),
        new LinkItem("7-Zip - contains an independent RAR5 decoder", "https://www.7-zip.org/"),
        new LinkItem("Huffman, A Method for the Construction of Minimum-Redundancy Codes, 1952", "https://ieeexplore.ieee.org/document/4051119")
      ];

      // Test vectors cross-checked byte-for-byte against CompressionWorkbench's
      // BB_Rar reference implementation (4-byte LE size prefix + one RAR5 block).
      this.tests = [
        new TestCase(
          [],
          [0x00, 0x00, 0x00, 0x00],
          "Empty input - size prefix only, no block emitted",
          "https://www.rarlab.com/technote.htm"
        ),
        new TestCase(
          [0x41],
          [
            0x01, 0x00, 0x00, 0x00, 0xc0, 0x88, 0x12, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x01, 0x5a, 0xbf, 0xf6, 0xcb, 0x32, 0x0c, 0x9f, 0x80
          ],
          "Single byte - one literal plus the four Huffman tables",
          "https://www.rarlab.com/technote.htm"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. ".repeat(4)),
          [
            0xb4, 0x00, 0x00, 0x00, 0xc2, 0xa5, 0x3d, 0x53, 0x45, 0x43, 0x40, 0x00, 0x00, 0x00, 0x00, 0x30,
            0x32, 0x0a, 0xfc, 0x05, 0xc2, 0x7e, 0x81, 0xf3, 0x93, 0x5c, 0xe7, 0xfa, 0x1b, 0x04, 0xb0, 0x45,
            0x99, 0xec, 0x42, 0xa4, 0x00, 0x54, 0x24, 0x1f, 0x9a, 0x0c, 0x21, 0x44, 0xfa, 0xb1, 0xe4, 0x4a,
            0xce, 0x1f, 0x95, 0xc2, 0xa8, 0xd7, 0xc8, 0x15, 0x4d, 0x11, 0xaf, 0x33, 0xbc, 0xe0, 0x7c, 0x47,
            0xeb, 0x73, 0xc0, 0xa0
          ],
          "Text sample repeated 4x",
          "https://www.rarlab.com/technote.htm"
        ),
        new TestCase(
          new Array(256).fill(0x61),
          [
            0x00, 0x01, 0x00, 0x00, 0xc7, 0x8e, 0x13, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x01, 0xd6, 0x7f, 0xd5, 0x21, 0x4b, 0x32, 0x0c, 0x9f, 0x7a
          ],
          "Long repetitive run - 256 identical bytes",
          "https://www.rarlab.com/technote.htm"
        ),
        new TestCase(
          [0x41, 0x42, 0x41, 0x42, 0x41, 0x42, 0x41, 0x42, 0x41, 0x42, 0x41, 0x42],
          [
            0x0c, 0x00, 0x00, 0x00, 0xc0, 0x8f, 0x15, 0x02, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x01, 0x36, 0xf7, 0xf3, 0x68, 0x62, 0x8c, 0xe8, 0x0e, 0x87, 0xec, 0x80
          ],
          "Alternating two-byte pattern - ABABABABABAB",
          "https://www.rarlab.com/technote.htm"
        ),
        new TestCase(
          [
            0x9e, 0x1f, 0xd2, 0x4b, 0x6a, 0x0c, 0xf7, 0x83, 0x21, 0x55, 0xbe, 0x08, 0x3d, 0xc4, 0x71, 0xaa,
            0x9e, 0x1f, 0xd2, 0x4b, 0x6a, 0x0c, 0xf7, 0x83, 0x11, 0x62, 0xef, 0x90, 0x4d, 0x7c, 0x38, 0xa1
          ],
          [
            0x20, 0x00, 0x00, 0x00, 0xc0, 0xa4, 0x3e, 0x44, 0x00, 0x32, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x22, 0x68, 0x81, 0x24, 0x08, 0xe2, 0x16, 0x24, 0x81, 0x1c, 0x30, 0x80, 0x8c, 0x16, 0x3c, 0x59,
            0x01, 0x20, 0x47, 0x70, 0xdd, 0x08, 0xca, 0xd0, 0x2d, 0x11, 0xcc, 0xd0, 0x9d, 0x1a, 0xf5, 0xfc,
            0xb7, 0xfe, 0x07, 0xff, 0x1f, 0xf4, 0x4e, 0xb9, 0x7a, 0xf2, 0x57, 0x17, 0x50, 0xb4, 0x0d, 0xe1,
            0x84, 0xed, 0xb7, 0x3f, 0x80
          ],
          "Pseudo-random binary sample with one repeated run",
          "https://www.rarlab.com/technote.htm"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("Optimal parsing minimises the total token cost, not the local match length."),
          [
            0x4b, 0x00, 0x00, 0x00, 0xc7, 0xda, 0x47, 0x33, 0x05, 0x33, 0x30, 0x00, 0x00, 0x00, 0x00, 0x50,
            0x42, 0x0a, 0xf8, 0x01, 0x96, 0x0a, 0xe0, 0x35, 0x55, 0x45, 0x64, 0x5a, 0x7c, 0x55, 0xa7, 0x8f,
            0xfd, 0x6a, 0xc1, 0xd7, 0xd5, 0x8a, 0xdb, 0x01, 0xb6, 0x1f, 0xf3, 0x65, 0xa3, 0x0e, 0x37, 0x8f,
            0xad, 0xa7, 0x42, 0x1a, 0x5a, 0x1a, 0xd2, 0xc1, 0x54, 0x06, 0x8f, 0x2c, 0xd7, 0xa9, 0x23, 0x35,
            0x67, 0xa1, 0x34, 0x7f, 0x97, 0xac, 0xf2, 0x63, 0x07, 0x2a, 0x1d, 0x27, 0x45, 0x7b
          ],
          "English text with short interior repeats",
          "https://www.rarlab.com/technote.htm"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new Rar5Instance(this, isInverse);
    }
  }

  class Rar5Instance extends IAlgorithmInstance {
    /**
     * @param {Rar5Compression} algorithm - Owning algorithm
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
        return blockDecompress(data);
      }
      return blockCompress(data);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new Rar5Compression();
  if (!AlgorithmFramework.Find(algorithmInstance.name))
    RegisterAlgorithm(algorithmInstance);

  // ===== EXPORTS =====

  return { Rar5Compression, Rar5Instance };
}));
