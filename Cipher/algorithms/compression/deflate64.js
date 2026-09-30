/*
 * Deflate64 (Enhanced Deflate) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Deflate64 extends RFC 1951 DEFLATE (as used by ZIP compression method 9) with:
 *   - a 64 KB sliding window (instead of 32 KB)
 *   - two additional distance codes 30-31, reaching distances up to 65536
 *   - length code 285 reinterpreted as base 3 with 16 extra bits, covering
 *     match lengths 3-65538 (instead of the fixed length-258 code)
 * There is no standard "fixed" Huffman table for the extended alphabet, so
 * Deflate64 streams always use dynamic Huffman blocks (or stored/uncompressed
 * blocks) - never static ones. Output is Deflate64-specific: NOT decodable by
 * a standard RFC 1951 DEFLATE reader such as zlib.
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== DEFLATE64 CONSTANTS =====

  // Length codes 257-285 (base, extra bits). Code 285 is base 3 with 16 extra bits
  // in Deflate64 (covers lengths 259-65538), unlike standard Deflate's fixed 258.
  /** @type {int32[]} */
  const LENGTH_BASE = [
    3, 4, 5, 6, 7, 8, 9, 10,
    11, 13, 15, 17, 19, 23, 27, 31,
    35, 43, 51, 59, 67, 83, 99, 115,
    131, 163, 195, 227,
    3
  ];
  /** @type {int32[]} */
  const LENGTH_EXTRA = [
    0, 0, 0, 0, 0, 0, 0, 0,
    1, 1, 1, 1, 2, 2, 2, 2,
    3, 3, 3, 3, 4, 4, 4, 4,
    5, 5, 5, 5,
    16
  ];

  // Distance codes 0-31 (base, extra bits). Codes 30-31 extend standard Deflate to
  // reach distances up to 65536.
  /** @type {int32[]} */
  const DISTANCE_BASE = [
    1, 2, 3, 4, 5, 7, 9, 13,
    17, 25, 33, 49, 65, 97, 129, 193,
    257, 385, 513, 769, 1025, 1537, 2049, 3073,
    4097, 6145, 8193, 12289, 16385, 24577, 32769, 49153
  ];
  /** @type {int32[]} */
  const DISTANCE_EXTRA = [
    0, 0, 0, 0, 1, 1, 2, 2,
    3, 3, 4, 4, 5, 5, 6, 6,
    7, 7, 8, 8, 9, 9, 10, 10,
    11, 11, 12, 12, 13, 13, 14, 14
  ];

  const LIT_LEN_ALPHABET_SIZE = 286;
  const DIST_ALPHABET_SIZE = 32;
  const CL_ALPHABET_SIZE = 19;
  const MAX_CODE_BITS = 15;
  const MAX_CL_CODE_BITS = 7;
  const END_OF_BLOCK = 256;
  const WINDOW_SIZE = 65536;
  const MAX_MATCH_LENGTH = 65538;
  const MIN_MATCH = 3;
  const MAX_UNCOMPRESSED_BLOCK_SIZE = 65535;
  const DEFAULT_BLOCK_SIZE = 32768;
  /** @type {int32[]} */
  const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  /**
   * @param {int32} size - Number of entries
   * @returns {int32[]} Plain array of zeros
   */
  function zeroArray(size) {
    /** @type {int32[]} */
    const arr = new Array(size);
    arr.fill(0);
    return arr;
  }

  /**
   * @param {int32[]} values - Values
   * @returns {boolean} True when any value is positive
   */
  function anyPositive(values) {
    for (let i = 0; i < values.length; ++i) {
      if (values[i] > 0) {
        return true;
      }
    }
    return false;
  }

  // Lengths 3-258 resolve to codes 257-284 (code 284's own range covers up to
  // 258, since its base 227 + 2^5-1 extra reaches 258). Code 285 is reserved
  // for lengths 259-65538 exclusively (Deflate64Constants.GetLengthCode: the
  // search deliberately excludes the reinterpreted last entry).
  /**
   * @param {int32} length - Match length
   * @returns {int32} Length code 257..285
   */
  function getLengthCode(length) {
    if (length > 258) {
      return 285;
    }
    for (let i = 0; i < LENGTH_BASE.length - 2; ++i) {
      /** @type {int32} */
      const maxLen = LENGTH_BASE[i + 1] - 1;
      if (length <= maxLen) {
        return 257 + i;
      }
    }
    return 257 + (LENGTH_BASE.length - 2); // code 284: covers up to length 258
  }

  /**
   * @param {int32} distance - Match distance
   * @returns {int32} Distance code 0..31
   */
  function getDistanceCode(distance) {
    for (let i = 0; i < DISTANCE_BASE.length; ++i) {
      /** @type {float64} */
      let maxDist = 0;
      if (i < DISTANCE_BASE.length - 1) {
        maxDist = DISTANCE_BASE[i + 1] - 1;
      } else {
        /** @type {int32} */
        const span = OpCodes.Shl32(1, DISTANCE_EXTRA[i]);
        maxDist = OpCodes.ToUint32(DISTANCE_BASE[i] + span - 1);
      }
      if (distance <= maxDist) {
        return i;
      }
    }
    return 31;
  }

  // ===== BIT STREAM HELPERS (LSB-first, matches RFC 1951 / Deflate64) =====

  class BitStream {
    constructor() {
      /** @type {uint8[]} */
      this.bytes = [];
      /** @type {uint32} */
      this.bitBuffer = 0;
      /** @type {int32} */
      this.bitCount = 0;
    }

    /**
     * @param {uint32} value - Bits to append (not masked)
     * @param {int32} numBits - Bit count
     */
    writeBits(value, numBits) {
      this.bitBuffer = OpCodes.Or32(this.bitBuffer, OpCodes.Shl32(value, this.bitCount));
      this.bitCount += numBits;

      while (this.bitCount >= 8) {
        this.bytes.push(OpCodes.And32(this.bitBuffer, 0xFF));
        this.bitBuffer = OpCodes.Shr32(this.bitBuffer, 8);
        this.bitCount -= 8;
      }
    }

    /**
     * @param {int32} code - Huffman code, most significant bit first
     * @param {int32} length - Code length
     */
    writeHuffmanCode(code, length) {
      /** @type {uint32} */
      let reversed = 0;
      for (let i = 0; i < length; ++i) {
        /** @type {uint32} */
        const bit = OpCodes.And32(OpCodes.Shr16(code, i), 1);
        reversed = OpCodes.And32(OpCodes.Or32(reversed, OpCodes.Shl16(bit, length - 1 - i)), 0xFFFF);
      }
      this.writeBits(reversed, length);
    }

    /**
     * @returns {uint8[]} All bytes written, the pending bits flushed
     */
    flush() {
      if (this.bitCount > 0) {
        this.bytes.push(OpCodes.And32(this.bitBuffer, 0xFF));
        this.bitBuffer = 0;
        this.bitCount = 0;
      }
      return this.bytes;
    }
  }

  class BitReader {
    /**
     * @param {uint8[]} bytes - Input
     */
    constructor(bytes) {
      /** @type {uint8[]} */
      this.bytes = bytes;
      /** @type {int32} */
      this.bytePos = 0;
      /** @type {uint32} */
      this.bitBuffer = 0;
      /** @type {int32} */
      this.bitCount = 0;
    }

    /**
     * @param {int32} numBits - Bit count
     * @returns {uint32} Bits read, least significant first
     */
    readBits(numBits) {
      while (this.bitCount < numBits) {
        if (this.bytePos >= this.bytes.length) {
          throw new Error('Unexpected end of compressed data');
        }
        this.bitBuffer = OpCodes.Or32(this.bitBuffer, OpCodes.Shl32(this.bytes[this.bytePos++], this.bitCount));
        this.bitCount += 8;
      }

      /** @type {uint32} */
      const mask = OpCodes.Sub32(OpCodes.Shl32(1, numBits), 1);
      /** @type {uint32} */
      const value = OpCodes.And32(this.bitBuffer, mask);
      this.bitBuffer = OpCodes.Shr32(this.bitBuffer, numBits);
      this.bitCount -= numBits;
      return value;
    }

    alignToByte() {
      this.bitBuffer = 0;
      this.bitCount = 0;
    }

    /**
     * @returns {boolean} True while bits remain
     */
    hasMore() {
      return this.bytePos < this.bytes.length || this.bitCount > 0;
    }
  }

  // ===== CANONICAL HUFFMAN TREE (RFC 1951 code assignment) =====

  // The decoding tree is kept as node rows (symbol, zero child, one child; -1
  // for none). Codes are inserted in symbol order exactly as the former object
  // tree did: a leaf replaces whatever hung at its slot and a longer code walks
  // through (and extends) whatever node it meets, so inconsistent length sets
  // decode as before.
  class HuffmanTree {
    constructor() {
      /** @type {boolean} */
      this.hasRoot = false;
      /** @type {int32[]} */
      this.nodeSymbol = [];
      /** @type {int32[]} */
      this.nodeZero = [];
      /** @type {int32[]} */
      this.nodeOne = [];
      /** @type {boolean} */
      this.hasCodes = false;
      /** @type {boolean[]} */
      this.codePresent = [];
      /** @type {int32[]} */
      this.codeValue = [];
      /** @type {int32[]} */
      this.codeLength = [];
    }

    /**
     * @param {int32} symbol - Leaf symbol, -1 for an inner node
     * @returns {int32} New node index
     */
    _newNode(symbol) {
      /** @type {int32} */
      const index = this.nodeSymbol.length;
      this.nodeSymbol.push(symbol);
      this.nodeZero.push(-1);
      this.nodeOne.push(-1);
      return index;
    }

    /**
     * @param {int32} node - Parent node
     * @param {uint32} bit - Branch
     * @returns {int32} Child, -1 when absent
     */
    _child(node, bit) {
      return bit ? this.nodeOne[node] : this.nodeZero[node];
    }

    /**
     * @param {int32} node - Parent node
     * @param {uint32} bit - Branch
     * @param {int32} child - Child node
     */
    _setChild(node, bit, child) {
      if (bit) {
        this.nodeOne[node] = child;
      } else {
        this.nodeZero[node] = child;
      }
    }

    // A length set without any used symbol throws the RangeError the former
    // Math.max(...[]) / new Array(-Infinity) pair raised.
    /**
     * @param {int32[]} lengths - Code length per symbol
     * @returns {HuffmanTree} Codes and decoding tree
     */
    static buildFromLengths(lengths) {
      /** @type {HuffmanTree} */
      const tree = new HuffmanTree();
      /** @type {int32} */
      let maxLen = 0;
      /** @type {boolean} */
      let anyUsed = false;
      for (let i = 0; i < lengths.length; ++i) {
        if (lengths[i] > 0) {
          if (!anyUsed || lengths[i] > maxLen) {
            maxLen = lengths[i];
          }
          anyUsed = true;
        }
      }
      if (!anyUsed) {
        throw new RangeError('Invalid array length');
      }

      /** @type {int32[]} */
      const blCount = zeroArray(maxLen + 1);
      for (let i = 0; i < lengths.length; ++i) {
        if (lengths[i] > 0) {
          blCount[lengths[i]]++;
        }
      }

      /** @type {int32[]} */
      const nextCode = zeroArray(maxLen + 1);
      /** @type {int32} */
      let code = 0;
      blCount[0] = 0;

      for (let bits = 1; bits <= maxLen; ++bits) {
        code = OpCodes.Shl16(code + blCount[bits - 1], 1);
        nextCode[bits] = code;
      }

      for (let n = 0; n < lengths.length; ++n) {
        /** @type {int32} */
        const len = lengths[n];
        tree.codePresent.push(len !== 0);
        tree.codeValue.push(0);
        tree.codeLength.push(0);
        if (len !== 0) {
          tree.codeValue[n] = nextCode[len];
          tree.codeLength[n] = len;
          nextCode[len]++;
        }
      }

      tree.hasRoot = true;
      tree._newNode(-1);
      for (let symbol = 0; symbol < lengths.length; ++symbol) {
        if (!tree.codePresent[symbol]) {
          continue;
        }

        /** @type {int32} */
        let node = 0;
        /** @type {int32} */
        const code = tree.codeValue[symbol];
        /** @type {int32} */
        const length = tree.codeLength[symbol];

        for (let i = length - 1; i >= 0; --i) {
          /** @type {uint32} */
          const bit = OpCodes.And32(OpCodes.Shr16(code, i), 1);

          if (i === 0) {
            /** @type {int32} */
            const leaf = tree._newNode(symbol);
            tree._setChild(node, bit, leaf);
          } else {
            /** @type {int32} */
            let next = tree._child(node, bit);
            if (next < 0) {
              next = tree._newNode(-1);
              tree._setChild(node, bit, next);
            }
            node = next;
          }
        }
      }

      tree.hasCodes = true;
      return tree;
    }

    /**
     * @param {BitReader} bitReader - Input bits
     * @returns {int32} Decoded symbol
     */
    decode(bitReader) {
      if (!this.hasRoot) {
        throw new Error('Invalid Huffman tree');
      }
      /** @type {int32} */
      let node = 0;

      while (this.nodeSymbol[node] < 0) {
        /** @type {uint32} */
        const bit = bitReader.readBits(1);
        node = this._child(node, bit);
        if (node < 0) {
          throw new Error('Invalid Huffman code');
        }
      }

      return this.nodeSymbol[node];
    }

    /**
     * Throws when the symbol has no code, as the former encode() did.
     * @param {int32} symbol - Symbol about to be written
     */
    requireCode(symbol) {
      if (!this.hasCodes || !this.codePresent[symbol]) {
        throw new Error('No Huffman code for symbol ' + symbol);
      }
    }
  }

  // ===== HUFFMAN CODE LENGTHS =====

  // Code lengths come from the shared deterministic builder in
  // huffman-code-lengths.data.js. Its tie-break among equally likely symbols is a
  // written rule - lighter first, then leaves before internal nodes, leaves by
  // ascending symbol, internal nodes oldest first - and CompressionWorkbench's
  // DeterministicHuffman follows the same rule, so the two produce the same tree
  // because the algorithm says so and not because either copies the other's heap.

  /**
   * @param {int32[]} codeLengths - Code lengths, limited in place
   * @param {int32} maxLength - Longest allowed code
   */
  function limitHuffmanCodeLengths(codeLengths, maxLength) {
    /** @type {boolean} */
    let needsAdjustment = false;
    for (let i = 0; i < codeLengths.length; ++i) {
      if (codeLengths[i] > maxLength) {
        needsAdjustment = true;
        break;
      }
    }
    if (!needsAdjustment) {
      return;
    }

    /** @type {int32[]} */
    const symbolIds = [];
    /** @type {int32[]} */
    const symbolLens = [];
    for (let i = 0; i < codeLengths.length; ++i) {
      if (codeLengths[i] > 0) {
        symbolIds.push(i);
        symbolLens.push(codeLengths[i]);
      }
    }

    for (let i = 0; i < symbolLens.length; ++i) {
      if (symbolLens[i] > maxLength) {
        symbolLens[i] = maxLength;
      }
    }

    /** @type {uint32} */
    const kraftMax = OpCodes.Shl32(1, maxLength);

    for (;;) {
      /** @type {float64} */
      let kraftSum = 0;
      for (let i = 0; i < symbolLens.length; ++i) {
        kraftSum += OpCodes.Shl32(1, maxLength - symbolLens[i]);
      }
      if (kraftSum <= kraftMax) {
        break;
      }

      /** @type {int32} */
      let shortestIdx = -1;
      /** @type {float64} */
      let shortestLen = Infinity;
      for (let i = 0; i < symbolLens.length; ++i) {
        if (symbolLens[i] < maxLength && symbolLens[i] < shortestLen) {
          shortestLen = symbolLens[i];
          shortestIdx = i;
        }
      }

      if (shortestIdx < 0) {
        break;
      }
      ++symbolLens[shortestIdx];
    }

    for (;;) {
      /** @type {float64} */
      let kraftSum = 0;
      for (let i = 0; i < symbolLens.length; ++i) {
        kraftSum += OpCodes.Shl32(1, maxLength - symbolLens[i]);
      }
      /** @type {float64} */
      const excess = kraftMax - kraftSum;
      if (excess <= 0) {
        break;
      }

      /** @type {int32} */
      let longestIdx = -1;
      /** @type {int32} */
      let longestLen = 0;
      for (let i = 0; i < symbolLens.length; ++i) {
        if (symbolLens[i] > longestLen) {
          longestLen = symbolLens[i];
          longestIdx = i;
        }
      }

      if (longestIdx < 0 || longestLen <= 1) {
        break;
      }

      /** @type {uint32} */
      const added = OpCodes.Shl32(1, maxLength - longestLen);
      if (added <= excess) {
        symbolLens[longestIdx] = longestLen - 1;
      } else {
        break;
      }
    }

    codeLengths.fill(0);
    for (let i = 0; i < symbolIds.length; ++i) {
      codeLengths[symbolIds[i]] = symbolLens[i];
    }
  }

  /**
   * @param {int32[]} frequencies - Frequency per symbol
   * @param {int32} alphabetSize - Alphabet size
   * @param {int32} maxBits - Longest allowed code
   * @returns {int32[]} Code length per symbol
   */
  function buildHuffmanCodeLengths(frequencies, alphabetSize, maxBits) {
    /** @type {int32[]} */
    const lengths = HuffmanCodeLengths.buildCodeLengths(frequencies, alphabetSize);
    limitHuffmanCodeLengths(lengths, maxBits);
    return lengths;
  }

  /**
   * Run-length coded code-length list: per entry the symbol and the width and
   * value of the raw bits that follow it.
   */
  class RleSequence {
    constructor() {
      /** @type {int32[]} */
      this.symbol = [];
      /** @type {int32[]} */
      this.extraBits = [];
      /** @type {int32[]} */
      this.extraValue = [];
    }

    /**
     * @param {int32} symbol - Code-length symbol
     * @param {int32} extraBits - Raw bits following it
     * @param {int32} extraValue - Their value
     */
    add(symbol, extraBits, extraValue) {
      this.symbol.push(symbol);
      this.extraBits.push(extraBits);
      this.extraValue.push(extraValue);
    }
  }

  /**
   * @param {int32[]} lengths - Code lengths
   * @returns {RleSequence} Run-length coded list
   */
  function runLengthEncodeCodeLengths(lengths) {
    /** @type {RleSequence} */
    const result = new RleSequence();
    /** @type {int32} */
    let i = 0;

    while (i < lengths.length) {
      /** @type {int32} */
      const value = lengths[i];

      if (value === 0) {
        /** @type {int32} */
        let zeroCount = 1;
        while (i + zeroCount < lengths.length && lengths[i + zeroCount] === 0) {
          ++zeroCount;
        }

        /** @type {int32} */
        let count = zeroCount;
        while (count > 0) {
          if (count >= 11) {
            /** @type {int32} */
            const run = Math.min(count, 138);
            result.add(18, 7, run - 11);
            count -= run;
          } else if (count >= 3) {
            result.add(17, 3, count - 3);
            count = 0;
          } else {
            result.add(0, 0, 0);
            --count;
          }
        }

        i += zeroCount;
      } else {
        result.add(value, 0, 0);
        ++i;

        /** @type {int32} */
        let repeatCount = 0;
        while (i + repeatCount < lengths.length && lengths[i + repeatCount] === value) {
          ++repeatCount;
        }

        /** @type {int32} */
        let count = repeatCount;
        while (count >= 3) {
          /** @type {int32} */
          const run = Math.min(count, 6);
          result.add(16, 2, run - 3);
          count -= run;
        }
        while (count > 0) {
          result.add(value, 0, 0);
          --count;
        }

        i += repeatCount;
      }
    }

    return result;
  }

  // ===== HASH-CHAIN MATCH FINDER (matches CompressionWorkbench's HashChainMatchFinder) =====

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
      /** @type {int32} */
      this.hashBits = 15;
      /** @type {int32} */
      this.hashSize = OpCodes.Shl32(1, this.hashBits);
      /** @type {int32} */
      this.hashMask = this.hashSize - 1;
      /** @type {int32[]} */
      this.head = new Int32Array(this.hashSize).fill(-1);
      /** @type {int32[]} */
      this.prev = new Int32Array(windowSize);
      /** @type {int32} */
      this.prevMask = windowSize - 1;
    }

    /**
     * @param {uint8[]} data - Input
     * @param {int32} pos - Position of the three hashed bytes
     * @returns {int32} Hash bucket
     */
    _hash(data, pos) {
      /** @type {uint32} */
      const h = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Shl32(data[pos], 10), OpCodes.Shl32(data[pos + 1], 5)), data[pos + 2]);
      return OpCodes.And32(h, this.hashMask);
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

  // ===== DEFLATE64 COMPRESSION ALGORITHM =====

  class Deflate64Algorithm extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Deflate64";
      this.description = "Enhanced DEFLATE (ZIP compression method 9) with a 64KB sliding window, distance codes up to 65536, and a 16-bit extended length code reaching matches up to 65538 bytes. Always uses dynamic Huffman blocks - no fixed table is defined for the extended alphabet.";
      this.inventor = "PKWARE";
      this.year = 2001;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Hybrid";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.WINDOW_SIZE = WINDOW_SIZE;
      this.MAX_MATCH_LENGTH = MAX_MATCH_LENGTH;
      this.MIN_MATCH = MIN_MATCH;

      // Documentation
      this.documentation = [
        new LinkItem(".ZIP File Format Specification (APPNOTE.TXT)", "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT"),
        new LinkItem("RFC 1951 - DEFLATE Specification (base algorithm)", "https://www.rfc-editor.org/rfc/rfc1951")
      ];

      this.references = [
        new LinkItem(".NET Deflate64Stream", "https://learn.microsoft.com/en-us/dotnet/api/system.io.compression.deflate64stream"),
        new LinkItem("DEFLATE Wikipedia", "https://en.wikipedia.org/wiki/Deflate")
      ];

      // Test vectors - Round-trip compression tests (wire format differs from
      // standard DEFLATE, so only round-trip behaviour is pinned here)
      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes("hello"),
          [],
          "Deflate64 round-trip - hello",
          "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AAAA"),
          [],
          "Deflate64 round-trip - AAAA",
          "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("ABCABCABC"),
          [],
          "Deflate64 round-trip - ABCABCABC",
          "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new Deflate64Instance(this, isInverse);
    }
  }

  /**
   * Parsed tokens as parallel rows: a literal or a (length, distance) match.
   */
  class Deflate64Tokens {
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
     * @param {int32} length - Match length
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
   * Literal/length and distance trees of a block.
   */
  class DynamicTrees {
    /**
     * @param {HuffmanTree} literal - Literal/length tree
     * @param {HuffmanTree} distance - Distance tree
     */
    constructor(literal, distance) {
      /** @type {HuffmanTree} */
      this.literal = literal;
      /** @type {HuffmanTree} */
      this.distance = distance;
    }
  }

  /**
   * Deflate64 cipher instance implementing Feed/Result pattern
   * @class
   * @extends {IAlgorithmInstance}
   */
  class Deflate64Instance extends IAlgorithmInstance {
    /**
     * @param {Deflate64Algorithm} algorithm - Owning algorithm
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
      // Like DEFLATE, an empty input is not a no-op for compression: it still
      // requires a minimal final block. Decompression of a genuinely empty
      // buffer has nothing to read and legitimately yields [].
      if (this.isInverse && this.inputBuffer.length === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      /** @type {uint8[]} */
      let result = [];
      if (this.isInverse) {
        result = this._decompress(this.inputBuffer);
      } else {
        result = this._compress(this.inputBuffer);
      }

      this.inputBuffer = [];
      return result;
    }

    // ===== COMPRESSION =====

    /**
     * @param {uint8[]} data - Input
     * @returns {uint8[]} Deflate64 stream
     */
    _compress(data) {
      /** @type {BitStream} */
      const stream = new BitStream();

      if (data.length === 0) {
        /** @type {uint8[]} */
        const nothing = [];
        this._emitCompressedBlock(stream, nothing, true);
        /** @type {uint8[]} */
        const emptyStream = stream.flush();
        return emptyStream;
      }

      /** @type {int32} */
      let offset = 0;
      while (data.length - offset > DEFAULT_BLOCK_SIZE) {
        this._emitCompressedBlock(stream, data.slice(offset, offset + DEFAULT_BLOCK_SIZE), false);
        offset += DEFAULT_BLOCK_SIZE;
      }
      this._emitCompressedBlock(stream, data.slice(offset), true);

      /** @type {uint8[]} */
      const packed = stream.flush();
      return packed;
    }

    // Deflate64 never emits static Huffman blocks (no fixed table exists for
    // the extended alphabet): only uncompressed vs. dynamic are compared.
    /**
     * @param {BitStream} stream - Output bits
     * @param {uint8[]} blockData - Block bytes
     * @param {boolean} isFinal - True for the last block
     */
    _emitCompressedBlock(stream, blockData, isFinal) {
      /** @type {Deflate64Tokens} */
      const tokens = this._findMatches(blockData, 128);

      /** @type {int32[]} */
      const litLenFreqs = zeroArray(LIT_LEN_ALPHABET_SIZE);
      /** @type {int32[]} */
      const distFreqs = zeroArray(DIST_ALPHABET_SIZE);
      for (let t = 0; t < tokens.isLiteral.length; ++t) {
        if (tokens.isLiteral[t]) {
          ++litLenFreqs[tokens.literal[t]];
        } else {
          /** @type {int32} */
          const lengthCode = getLengthCode(tokens.matchLength[t]);
          /** @type {int32} */
          const distCode = getDistanceCode(tokens.distance[t]);
          ++litLenFreqs[lengthCode];
          ++distFreqs[distCode];
        }
      }
      litLenFreqs[END_OF_BLOCK] = 1;

      /** @type {int32} */
      const numSubBlocks = Math.max(1, Math.ceil(blockData.length / MAX_UNCOMPRESSED_BLOCK_SIZE));
      /** @type {float64} */
      const uncompressedBits = 3 + numSubBlocks * 5 * 8 + blockData.length * 8;

      /** @type {float64} */
      const dynamicSize = this._estimateDynamicSize(litLenFreqs.slice(), distFreqs.slice(), tokens);

      if (uncompressedBits < dynamicSize) {
        this._emitUncompressedBlock(stream, blockData, isFinal);
      } else {
        this._emitDynamicHuffmanBlock(stream, litLenFreqs, distFreqs, tokens, isFinal);
      }
    }

    /**
     * @param {uint8[]} data - Block bytes
     * @param {int32} chainDepth - Chain walk limit
     * @returns {Deflate64Tokens} Greedy parse
     */
    _findMatches(data, chainDepth) {
      /** @type {Deflate64Tokens} */
      const result = new Deflate64Tokens();
      if (data.length === 0) {
        return result;
      }

      /** @type {int32} */
      const maxMatchLen = Math.min(MAX_MATCH_LENGTH, data.length);
      /** @type {HashChainMatchFinder} */
      const matcher = new HashChainMatchFinder(WINDOW_SIZE, chainDepth);
      /** @type {int32} */
      let pos = 0;

      while (pos < data.length) {
        /** @type {int32} */
        const maxLen = Math.min(maxMatchLen, data.length - pos);
        /** @type {MatchResult} */
        const match = matcher.findMatch(data, pos, WINDOW_SIZE, maxLen, MIN_MATCH);

        if (match.length >= MIN_MATCH) {
          result.add(false, 0, match.length, match.distance);
          for (let i = 1; i < match.length; ++i) {
            if (pos + i < data.length) {
              matcher.insertPosition(data, pos + i);
            }
          }
          pos += match.length;
        } else {
          result.add(true, data[pos], 0, 0);
          ++pos;
        }
      }

      return result;
    }

    /**
     * @param {int32[]} litLenFreqs - Literal/length frequencies (scratch copy)
     * @param {int32[]} distFreqs - Distance frequencies (scratch copy)
     * @param {Deflate64Tokens} tokens - Block tokens
     * @returns {float64} Dynamic block size in bits
     */
    _estimateDynamicSize(litLenFreqs, distFreqs, tokens) {
      /** @type {int32[]} */
      const litLenLengths = buildHuffmanCodeLengths(litLenFreqs, LIT_LEN_ALPHABET_SIZE, MAX_CODE_BITS);

      if (!anyPositive(distFreqs)) {
        distFreqs[0] = 1;
      }
      /** @type {int32[]} */
      const distLengths = buildHuffmanCodeLengths(distFreqs, DIST_ALPHABET_SIZE, MAX_CODE_BITS);

      /** @type {float64} */
      let bits = 3 + 5 + 5 + 4;

      /** @type {int32} */
      let hlit = litLenLengths.length;
      while (hlit > 257 && litLenLengths[hlit - 1] === 0) {
        --hlit;
      }
      /** @type {int32} */
      let hdist = distLengths.length;
      while (hdist > 1 && distLengths[hdist - 1] === 0) {
        --hdist;
      }

      /** @type {int32[]} */
      const combined = new Array(hlit + hdist);
      for (let i = 0; i < hlit; ++i) {
        combined[i] = litLenLengths[i];
      }
      for (let i = 0; i < hdist; ++i) {
        combined[hlit + i] = distLengths[i];
      }
      /** @type {RleSequence} */
      const rle = runLengthEncodeCodeLengths(combined);

      /** @type {int32[]} */
      const clFreqs = zeroArray(CL_ALPHABET_SIZE);
      for (let k = 0; k < rle.symbol.length; ++k) {
        ++clFreqs[rle.symbol[k]];
      }
      if (!anyPositive(clFreqs)) {
        clFreqs[0] = 1;
      }
      /** @type {int32[]} */
      const clLengths = buildHuffmanCodeLengths(clFreqs, CL_ALPHABET_SIZE, MAX_CL_CODE_BITS);

      /** @type {int32} */
      let hclen = CL_ALPHABET_SIZE;
      while (hclen > 4 && clLengths[CODE_LENGTH_ORDER[hclen - 1]] === 0) {
        --hclen;
      }
      bits += hclen * 3;

      for (let k = 0; k < rle.symbol.length; ++k) {
        bits += clLengths[rle.symbol[k]] + rle.extraBits[k];
      }

      for (let t = 0; t < tokens.isLiteral.length; ++t) {
        if (tokens.isLiteral[t]) {
          bits += litLenLengths[tokens.literal[t]];
        } else {
          /** @type {int32} */
          const lengthCode = getLengthCode(tokens.matchLength[t]);
          bits += litLenLengths[lengthCode];
          bits += LENGTH_EXTRA[lengthCode - 257];
          /** @type {int32} */
          const distCode = getDistanceCode(tokens.distance[t]);
          bits += distLengths[distCode];
          bits += DISTANCE_EXTRA[distCode];
        }
      }
      bits += litLenLengths[END_OF_BLOCK];
      return bits;
    }

    /**
     * @param {BitStream} stream - Output bits
     * @param {Deflate64Tokens} tokens - Block tokens
     * @param {HuffmanTree} literalTree - Literal/length tree
     * @param {HuffmanTree} distanceTree - Distance tree
     */
    _writeTokens(stream, tokens, literalTree, distanceTree) {
      for (let t = 0; t < tokens.isLiteral.length; ++t) {
        if (tokens.isLiteral[t]) {
          /** @type {int32} */
          const literal = tokens.literal[t];
          literalTree.requireCode(literal);
          stream.writeHuffmanCode(literalTree.codeValue[literal], literalTree.codeLength[literal]);
        } else {
          /** @type {int32} */
          const length = tokens.matchLength[t];
          /** @type {int32} */
          const lengthCode = getLengthCode(length);
          /** @type {int32} */
          const lengthIndex = lengthCode - 257;
          literalTree.requireCode(lengthCode);
          stream.writeHuffmanCode(literalTree.codeValue[lengthCode], literalTree.codeLength[lengthCode]);
          if (LENGTH_EXTRA[lengthIndex] > 0) {
            stream.writeBits(length - LENGTH_BASE[lengthIndex], LENGTH_EXTRA[lengthIndex]);
          }

          /** @type {int32} */
          const distance = tokens.distance[t];
          /** @type {int32} */
          const distCode = getDistanceCode(distance);
          distanceTree.requireCode(distCode);
          stream.writeHuffmanCode(distanceTree.codeValue[distCode], distanceTree.codeLength[distCode]);
          if (DISTANCE_EXTRA[distCode] > 0) {
            stream.writeBits(distance - DISTANCE_BASE[distCode], DISTANCE_EXTRA[distCode]);
          }
        }
      }
    }

    /**
     * @param {BitStream} stream - Output bits
     * @param {int32[]} litLenFreqs - Literal/length frequencies
     * @param {int32[]} distFreqs - Distance frequencies
     * @param {Deflate64Tokens} tokens - Block tokens
     * @param {boolean} isFinal - True for the last block
     */
    _emitDynamicHuffmanBlock(stream, litLenFreqs, distFreqs, tokens, isFinal) {
      if (!anyPositive(distFreqs)) {
        distFreqs[0] = 1;
      }

      /** @type {int32[]} */
      const litLenLengths = buildHuffmanCodeLengths(litLenFreqs, LIT_LEN_ALPHABET_SIZE, MAX_CODE_BITS);
      /** @type {int32[]} */
      const distLengths = buildHuffmanCodeLengths(distFreqs, DIST_ALPHABET_SIZE, MAX_CODE_BITS);

      /** @type {int32} */
      let hlit = litLenLengths.length;
      while (hlit > 257 && litLenLengths[hlit - 1] === 0) {
        --hlit;
      }
      /** @type {int32} */
      let hdist = distLengths.length;
      while (hdist > 1 && distLengths[hdist - 1] === 0) {
        --hdist;
      }

      /** @type {int32[]} */
      const combined = new Array(hlit + hdist);
      for (let i = 0; i < hlit; ++i) {
        combined[i] = litLenLengths[i];
      }
      for (let i = 0; i < hdist; ++i) {
        combined[hlit + i] = distLengths[i];
      }
      /** @type {RleSequence} */
      const rleSymbols = runLengthEncodeCodeLengths(combined);

      /** @type {int32[]} */
      const clFreqs = zeroArray(CL_ALPHABET_SIZE);
      for (let k = 0; k < rleSymbols.symbol.length; ++k) {
        ++clFreqs[rleSymbols.symbol[k]];
      }
      if (!anyPositive(clFreqs)) {
        clFreqs[0] = 1;
      }
      /** @type {int32[]} */
      const clLengths = buildHuffmanCodeLengths(clFreqs, CL_ALPHABET_SIZE, MAX_CL_CODE_BITS);

      /** @type {int32} */
      let hclen = CL_ALPHABET_SIZE;
      while (hclen > 4 && clLengths[CODE_LENGTH_ORDER[hclen - 1]] === 0) {
        --hclen;
      }

      /** @type {HuffmanTree} */
      const clTree = HuffmanTree.buildFromLengths(clLengths);

      stream.writeBits(isFinal ? 1 : 0, 1);
      stream.writeBits(2, 2); // BTYPE = 10 (dynamic Huffman)
      stream.writeBits(hlit - 257, 5);
      stream.writeBits(hdist - 1, 5);
      stream.writeBits(hclen - 4, 4);

      for (let i = 0; i < hclen; ++i) {
        stream.writeBits(clLengths[CODE_LENGTH_ORDER[i]], 3);
      }

      for (let k = 0; k < rleSymbols.symbol.length; ++k) {
        /** @type {int32} */
        const symbol = rleSymbols.symbol[k];
        clTree.requireCode(symbol);
        stream.writeHuffmanCode(clTree.codeValue[symbol], clTree.codeLength[symbol]);
        if (rleSymbols.extraBits[k] > 0) {
          stream.writeBits(rleSymbols.extraValue[k], rleSymbols.extraBits[k]);
        }
      }

      /** @type {HuffmanTree} */
      const literalTree = HuffmanTree.buildFromLengths(litLenLengths.slice(0, hlit));
      /** @type {HuffmanTree} */
      const distanceTree = HuffmanTree.buildFromLengths(distLengths.slice(0, hdist));

      this._writeTokens(stream, tokens, literalTree, distanceTree);

      literalTree.requireCode(END_OF_BLOCK);
      stream.writeHuffmanCode(literalTree.codeValue[END_OF_BLOCK], literalTree.codeLength[END_OF_BLOCK]);
    }

    /**
     * @param {BitStream} stream - Output bits
     * @param {uint8[]} data - Block bytes
     * @param {boolean} isFinal - True for the last block
     */
    _emitUncompressedBlock(stream, data, isFinal) {
      /** @type {int32} */
      let offset = 0;
      while (offset < data.length) {
        /** @type {int32} */
        const chunkSize = Math.min(data.length - offset, MAX_UNCOMPRESSED_BLOCK_SIZE);
        /** @type {boolean} */
        const isLastChunk = (offset + chunkSize >= data.length) && isFinal;

        stream.writeBits(isLastChunk ? 1 : 0, 1);
        stream.writeBits(0, 2); // BTYPE = 00 (uncompressed)
        stream.flush();

        /** @type {uint32} */
        const len = OpCodes.And32(chunkSize, 0xFFFF);
        /** @type {uint32} */
        const nlen = OpCodes.And32(OpCodes.Xor32(len, 0xFFFF), 0xFFFF);
        stream.writeBits(len, 16);
        stream.writeBits(nlen, 16);

        for (let i = 0; i < chunkSize; ++i) {
          stream.writeBits(data[offset + i], 8);
        }

        offset += chunkSize;
      }

      if (data.length !== 0 || !isFinal) {
        return;
      }

      stream.writeBits(1, 1);
      stream.writeBits(0, 2);
      stream.flush();
      stream.writeBits(0, 16);
      stream.writeBits(0xFFFF, 16);
    }

    // ===== DECOMPRESSION =====

    /**
     * @param {uint8[]} data - Deflate64 stream
     * @returns {uint8[]} Decompressed bytes
     */
    _decompress(data) {
      /** @type {BitReader} */
      const reader = new BitReader(data);
      /** @type {uint8[]} */
      const output = [];

      while (reader.hasMore()) {
        /** @type {uint32} */
        const bfinal = reader.readBits(1);
        /** @type {uint32} */
        const btype = reader.readBits(2);

        if (btype === 0) {
          reader.alignToByte();
          /** @type {uint32} */
          const len = reader.readBits(16);
          /** @type {uint32} */
          const nlen = reader.readBits(16);

          if (OpCodes.Xor32(len, nlen) !== 0xFFFF) {
            throw new Error('Invalid uncompressed block length');
          }

          for (let i = 0; i < len; ++i) {
            /** @type {uint32} */
            const byte = reader.readBits(8);
            output.push(byte);
          }
        } else if (btype === 1 || btype === 2) {
          /** @type {HuffmanTree} */
          let literalTree = null;
          /** @type {HuffmanTree} */
          let distanceTree = null;

          if (btype === 1) {
            // Standard-Deflate fixed tables (decoder accepts them for
            // completeness, even though this encoder never emits them).
            /** @type {int32[]} */
            const fixedLit = new Array(288);
            for (let i = 0; i <= 143; ++i) {
              fixedLit[i] = 8;
            }
            for (let i = 144; i <= 255; ++i) {
              fixedLit[i] = 9;
            }
            for (let i = 256; i <= 279; ++i) {
              fixedLit[i] = 7;
            }
            for (let i = 280; i <= 287; ++i) {
              fixedLit[i] = 8;
            }
            literalTree = HuffmanTree.buildFromLengths(fixedLit);
            /** @type {int32[]} */
            const fixedDist = new Array(DIST_ALPHABET_SIZE);
            fixedDist.fill(5);
            distanceTree = HuffmanTree.buildFromLengths(fixedDist);
          } else {
            /** @type {DynamicTrees} */
            const trees = this._readDynamicTrees(reader);
            literalTree = trees.literal;
            distanceTree = trees.distance;
          }

          while (true) {
            /** @type {int32} */
            const symbol = literalTree.decode(reader);

            if (symbol === END_OF_BLOCK) {
              break;
            } else if (symbol < 256) {
              output.push(symbol);
            } else {
              /** @type {int32} */
              const lengthCode = symbol - 257;
              if (lengthCode >= LENGTH_BASE.length) {
                // The former table of objects had no entry here either.
                throw new TypeError("Cannot read properties of undefined (reading 'base')");
              }
              /** @type {int32} */
              let length = LENGTH_BASE[lengthCode];
              if (LENGTH_EXTRA[lengthCode] > 0) {
                /** @type {uint32} */
                const extra = reader.readBits(LENGTH_EXTRA[lengthCode]);
                length += extra;
              }

              /** @type {int32} */
              const distCode = distanceTree.decode(reader);
              /** @type {int32} */
              let distance = DISTANCE_BASE[distCode];
              if (DISTANCE_EXTRA[distCode] > 0) {
                /** @type {uint32} */
                const extra = reader.readBits(DISTANCE_EXTRA[distCode]);
                distance += extra;
              }

              /** @type {int32} */
              const startPos = output.length - distance;
              for (let i = 0; i < length; ++i) {
                output.push(output[startPos + i]);
              }
            }
          }
        } else {
          throw new Error('Invalid block type');
        }

        if (bfinal) {
          break;
        }
      }

      return output;
    }

    /**
     * @param {BitReader} reader - Input bits
     * @returns {DynamicTrees} Literal/length and distance trees
     */
    _readDynamicTrees(reader) {
      /** @type {int32} */
      const hlitField = reader.readBits(5);
      /** @type {int32} */
      const hdistField = reader.readBits(5);
      /** @type {int32} */
      const hclenField = reader.readBits(4);
      /** @type {int32} */
      const hlit = hlitField + 257;
      /** @type {int32} */
      const hdist = hdistField + 1;
      /** @type {int32} */
      const hclen = hclenField + 4;

      /** @type {int32[]} */
      const codeLengthLengths = zeroArray(19);
      for (let i = 0; i < hclen; ++i) {
        /** @type {int32} */
        const len = reader.readBits(3);
        codeLengthLengths[CODE_LENGTH_ORDER[i]] = len;
      }

      /** @type {HuffmanTree} */
      const codeLengthTree = HuffmanTree.buildFromLengths(codeLengthLengths);

      /** @type {int32[]} */
      const lengths = [];
      while (lengths.length < hlit + hdist) {
        /** @type {int32} */
        const symbol = codeLengthTree.decode(reader);

        if (symbol < 16) {
          lengths.push(symbol);
        } else if (symbol === 16) {
          /** @type {int32} */
          const field = reader.readBits(2);
          /** @type {int32} */
          const repeat = field + 3;
          /** @type {int32} */
          let value = 0;
          if (lengths.length > 0) {
            value = lengths[lengths.length - 1];
          }
          for (let i = 0; i < repeat; ++i) {
            lengths.push(value);
          }
        } else if (symbol === 17) {
          /** @type {int32} */
          const field = reader.readBits(3);
          /** @type {int32} */
          const repeat = field + 3;
          for (let i = 0; i < repeat; ++i) {
            lengths.push(0);
          }
        } else if (symbol === 18) {
          /** @type {int32} */
          const field = reader.readBits(7);
          /** @type {int32} */
          const repeat = field + 11;
          for (let i = 0; i < repeat; ++i) {
            lengths.push(0);
          }
        }
      }

      /** @type {int32[]} */
      const literalLengths = lengths.slice(0, hlit);
      /** @type {int32[]} */
      const distanceLengths = lengths.slice(hlit, hlit + hdist);

      /** @type {HuffmanTree} */
      const literal = HuffmanTree.buildFromLengths(literalLengths);
      /** @type {HuffmanTree} */
      const distance = HuffmanTree.buildFromLengths(distanceLengths);
      return new DynamicTrees(literal, distance);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new Deflate64Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Deflate64Algorithm, Deflate64Instance };
}));
