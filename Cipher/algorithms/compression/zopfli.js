/*
 * Zopfli Compression Algorithm Implementation (RFC 1951 DEFLATE, optimal parsing)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Zopfli exists to spend a great deal of time producing an ordinary RFC 1951 stream
 * that happens to be smaller. Its one idea is that the parse and the Huffman trees are
 * circular: what a match costs depends on the trees, and the trees depend on which
 * matches the parse chose. Neither can be settled first, so it guesses, solves the
 * other exactly, and repeats - parse greedily for realistic symbol counts, price every
 * symbol by the entropy of those counts, find the cheapest parse under that pricing by
 * shortest path, take the counts of that parse, and go round again. Every round is
 * measured exactly and the smallest is what gets emitted.
 *
 * The output is standard DEFLATE, readable by any conforming decoder including zlib.
 *
 * Every decision here is made with integer arithmetic, so the CompressionWorkbench
 * implementation of the same design (Compression.Core/Deflate) produces the same bytes.
 *
 * References:
 *   RFC 1951, "DEFLATE Compressed Data Format Specification version 1.3"
 *   L. Vandevenne and J. Alakuijala, "Compress data more densely with Zopfli",
 *     Google Open Source Blog, 2013
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

  // ===== RFC 1951 CONSTANTS (shared shape with algorithms/compression/deflate.js) =====

  /** @type {int32[]} */
  const LENGTH_BASE = [
    3, 4, 5, 6, 7, 8, 9, 10,
    11, 13, 15, 17, 19, 23, 27, 31,
    35, 43, 51, 59, 67, 83, 99, 115,
    131, 163, 195, 227,
    258
  ];
  /** @type {int32[]} */
  const LENGTH_EXTRA = [
    0, 0, 0, 0, 0, 0, 0, 0,
    1, 1, 1, 1, 2, 2, 2, 2,
    3, 3, 3, 3, 4, 4, 4, 4,
    5, 5, 5, 5,
    0
  ];

  /** @type {int32[]} */
  const DISTANCE_BASE = [
    1, 2, 3, 4, 5, 7, 9, 13,
    17, 25, 33, 49, 65, 97, 129, 193,
    257, 385, 513, 769, 1025, 1537, 2049, 3073,
    4097, 6145, 8193, 12289, 16385, 24577
  ];
  /** @type {int32[]} */
  const DISTANCE_EXTRA = [
    0, 0, 0, 0, 1, 1, 2, 2,
    3, 3, 4, 4, 5, 5, 6, 6,
    7, 7, 8, 8, 9, 9, 10, 10,
    11, 11, 12, 12, 13, 13
  ];

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

  /**
   * @returns {int32[]} Fixed literal/length code lengths (RFC 1951 section 3.2.6)
   */
  function buildFixedLiteralLengths() {
    /** @type {int32[]} */
    const lengths = new Array(288);
    for (let i = 0; i <= 143; ++i) {
      lengths[i] = 8;
    }
    for (let i = 144; i <= 255; ++i) {
      lengths[i] = 9;
    }
    for (let i = 256; i <= 279; ++i) {
      lengths[i] = 7;
    }
    for (let i = 280; i <= 287; ++i) {
      lengths[i] = 8;
    }
    return lengths;
  }

  /** @type {int32[]} */
  const FIXED_LITERAL_LENGTHS = buildFixedLiteralLengths();

  /** @type {int32[]} */
  const FIXED_DISTANCE_LENGTHS = new Array(30);
  FIXED_DISTANCE_LENGTHS.fill(5);

  const LIT_LEN_ALPHABET_SIZE = 286;
  const DIST_ALPHABET_SIZE = 30;
  const CL_ALPHABET_SIZE = 19;
  const MAX_CODE_BITS = 15;
  const MAX_CL_CODE_BITS = 7;
  const END_OF_BLOCK = 256;
  const WINDOW_SIZE = 32768;
  const MAX_MATCH = 258;
  const MIN_MATCH = 3;
  /** @type {int32[]} */
  const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  const BLOCK_TYPE_STORED = 0;
  const BLOCK_TYPE_STATIC = 1;
  const BLOCK_TYPE_DYNAMIC = 2;

  // Costs are carried in units of 1/BIT_SCALE bit, so the shortest-path search never
  // touches a floating-point number and its answer depends on the input alone.
  const BIT_SCALE = 65536;

  // ===== BIT STREAM HELPERS (LSB-first, matches RFC 1951) =====

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

    // Write Huffman code in reversed bit order (RFC 1951 requirement)
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

    alignToByte() {
      if (this.bitCount > 0) {
        this.bytes.push(OpCodes.And32(this.bitBuffer, 0xFF));
        this.bitBuffer = 0;
        this.bitCount = 0;
      }
    }

    /**
     * @returns {uint8[]} All bytes written, the pending bits flushed
     */
    flush() {
      this.alignToByte();
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
  //
  // Code lengths come from the shared deterministic builder, whose tie-break among
  // equally likely symbols is written down rather than inherited from a container's
  // internals; the depth limit RFC 1951 imposes is then repaired here.

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
   * @param {int32[]} counts - Count per symbol
   * @param {int32} maxBits - Longest allowed code
   * @returns {int32[]} Code length per symbol
   */
  function buildHuffmanCodeLengths(counts, maxBits) {
    /** @type {int32[]} */
    const lengths = HuffmanCodeLengths.buildCodeLengths(counts);
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

  // Encodes the concatenated literal/length and distance code lengths with the
  // run-length alphabet of RFC 1951 section 3.2.7.
  /**
   * @param {int32[]} lengths - Code lengths
   * @returns {RleSequence} Run-length coded list
   */
  function encodeCodeLengthRuns(lengths) {
    /** @type {RleSequence} */
    const result = new RleSequence();
    /** @type {int32} */
    let i = 0;

    while (i < lengths.length) {
      /** @type {int32} */
      const value = lengths[i];

      if (value === 0) {
        /** @type {int32} */
        let zeros = 1;
        while (i + zeros < lengths.length && lengths[i + zeros] === 0) {
          ++zeros;
        }

        /** @type {int32} */
        let remaining = zeros;
        while (remaining > 0) {
          if (remaining >= 11) {
            // Symbol 18 repeats a zero 11 to 138 times.
            /** @type {int32} */
            const run = Math.min(remaining, 138);
            result.add(18, 7, run - 11);
            remaining -= run;
          } else if (remaining >= 3) {
            // Symbol 17 repeats a zero 3 to 10 times.
            result.add(17, 3, remaining - 3);
            remaining = 0;
          } else {
            result.add(0, 0, 0);
            --remaining;
          }
        }

        i += zeros;
        continue;
      }

      // Symbol 16 repeats the previous length 3 to 6 times, so the length itself is
      // written once first.
      result.add(value, 0, 0);
      ++i;

      /** @type {int32} */
      let repeats = 0;
      while (i + repeats < lengths.length && lengths[i + repeats] === value) {
        ++repeats;
      }

      /** @type {int32} */
      let left = repeats;
      while (left >= 3) {
        /** @type {int32} */
        const run = Math.min(left, 6);
        result.add(16, 2, run - 3);
        left -= run;
      }
      while (left > 0) {
        result.add(value, 0, 0);
        --left;
      }

      i += repeats;
    }

    return result;
  }

  // Both mappings are asked for millions of times per parse, so RFC 1951 table 3.2.5 is
  // walked once at load and answered from a lookup afterwards.

  /**
   * @returns {uint16[]} Length code per match length
   */
  function buildLengthCodeTable() {
    /** @type {uint16[]} */
    const table = new Uint16Array(MAX_MATCH + 1);
    for (let length = MIN_MATCH; length <= MAX_MATCH; ++length) {
      /** @type {int32} */
      let code = 285;
      for (let i = 0; i < LENGTH_BASE.length; ++i) {
        /** @type {int32} */
        const maxLen = i < LENGTH_BASE.length - 1 ? LENGTH_BASE[i + 1] - 1 : LENGTH_BASE[i];
        if (length <= maxLen) {
          code = 257 + i;
          break;
        }
      }
      table[length] = code;
    }
    return table;
  }

  /**
   * @returns {uint8[]} Distance code per distance
   */
  function buildDistanceCodeTable() {
    /** @type {uint8[]} */
    const table = new Uint8Array(WINDOW_SIZE + 1);
    for (let distance = 1; distance <= WINDOW_SIZE; ++distance) {
      /** @type {int32} */
      let code = 29;
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
          code = i;
          break;
        }
      }
      table[distance] = code;
    }
    return table;
  }

  /** @type {uint16[]} */
  const LENGTH_CODE_TABLE = buildLengthCodeTable();

  /** @type {uint8[]} */
  const DISTANCE_CODE_TABLE = buildDistanceCodeTable();

  /**
   * @param {int32} length - Match length
   * @returns {int32} Length code
   */
  function getLengthCode(length) {
    return LENGTH_CODE_TABLE[length];
  }

  /**
   * @param {int32} distance - Match distance
   * @returns {int32} Distance code
   */
  function getDistanceCode(distance) {
    return DISTANCE_CODE_TABLE[distance];
  }

  // ===== COST MODEL =====
  //
  // The published Zopfli method drives its shortest-path search with the entropy of the
  // symbol counts produced by the previous parse, not with the integer Huffman code
  // lengths those counts would yield. Entropy is the better guide because Huffman lengths
  // are rounded to whole bits: a symbol carrying 1.2 bits of information and one carrying
  // 1.9 both get a one-bit code, so a parse steered by code lengths cannot tell them apart
  // and systematically over-values the commonest symbols. A symbol with a count of zero is
  // priced as if it occurred once - it is not forbidden, it merely did not appear last
  // time, and a fixed large penalty would wrongly rule it out for good.

  // Base-2 logarithm of a positive integer, in units of 1/BIT_SCALE.
  //
  // The value is first halved until it lies in [1,2), each halving contributing one whole
  // bit. Squaring a number in [1,2) either leaves it there or moves it into [2,4); which
  // of the two happens is exactly the next fractional bit of the logarithm, so sixteen
  // squarings yield sixteen fractional bits. Only integer multiplication and division are
  // involved and the largest intermediate stays below 2^34, so every machine agrees.
  /**
   * @param {float64} value - Positive integer
   * @returns {float64} log2(value) in units of 1/BIT_SCALE
   */
  function log2Fixed(value) {
    if (value <= 1) {
      return 0;
    }

    /** @type {float64} */
    let scaled = value * BIT_SCALE;
    /** @type {float64} */
    let result = 0;
    while (scaled >= 2 * BIT_SCALE) {
      scaled = Math.floor(scaled / 2);
      result += BIT_SCALE;
    }

    /** @type {float64} */
    let bit = BIT_SCALE / 2;
    for (let i = 0; i < 16; ++i) {
      scaled = Math.floor(scaled * scaled / BIT_SCALE);
      if (scaled >= 2 * BIT_SCALE) {
        scaled = Math.floor(scaled / 2);
        result += bit;
      }
      bit = Math.floor(bit / 2);
    }

    return result;
  }

  /**
   * @param {float64[]} counts - Count per symbol
   * @returns {float64[]} Cost per symbol in units of 1/BIT_SCALE bit
   */
  function entropyCosts(counts) {
    /** @type {float64[]} */
    const result = new Array(counts.length);

    /** @type {float64} */
    let total = 0;
    for (let i = 0; i < counts.length; ++i) {
      total += counts[i];
    }

    // An empty alphabet has no observations to learn from; pricing every symbol at
    // log2(alphabet size) is the uniform distribution, which is the honest prior.
    /** @type {float64} */
    const log2Total = log2Fixed(total === 0 ? counts.length : total);

    for (let i = 0; i < counts.length; ++i) {
      /** @type {float64} */
      const cost = counts[i] === 0 ? log2Total : log2Total - log2Fixed(counts[i]);
      result[i] = cost < 0 ? 0 : cost;
    }

    return result;
  }

  class ZopfliCostModel {
    /**
     * @param {float64[]} litLenCounts - Literal/length counts
     * @param {float64[]} distCounts - Distance counts
     */
    constructor(litLenCounts, distCounts) {
      /** @type {float64[]} */
      const litLenCost = entropyCosts(litLenCounts);
      /** @type {float64[]} */
      const distCost = entropyCosts(distCounts);
      /** @type {float64[]} */
      this.litLenCost = litLenCost;

      // The shortest-path search asks for these millions of times, and both are functions
      // of the model alone, so they are worked out once here rather than per edge.
      /** @type {float64[]} */
      this.lengthCost = new Float64Array(MAX_MATCH + 1);
      for (let length = MIN_MATCH; length <= MAX_MATCH; ++length) {
        /** @type {int32} */
        const code = LENGTH_CODE_TABLE[length];
        this.lengthCost[length] = litLenCost[code] + LENGTH_EXTRA[code - 257] * BIT_SCALE;
      }

      /** @type {float64[]} */
      this.distanceCost = new Float64Array(DIST_ALPHABET_SIZE);
      for (let code = 0; code < DIST_ALPHABET_SIZE; ++code) {
        this.distanceCost[code] = distCost[code] + DISTANCE_EXTRA[code] * BIT_SCALE;
      }
    }

    // The two halves of a back-reference are read separately because the parser walks
    // every length that shares one distance in a row, so the distance's cost is paid for
    // once per run rather than once per edge.
    /**
     * @param {uint8} literal - Literal byte
     * @returns {float64} Its cost
     */
    literalCost(literal) {
      return this.litLenCost[literal];
    }
  }

  // ===== MATCH FINDING =====
  //
  // A shortest-path parse needs more than the single longest match at a position: a
  // shorter match may leave the remaining input in a cheaper state, so every reachable
  // length is a candidate edge, and RFC 1951 allows up to 256 distinct ones.
  //
  // The chain is walked newest-first, so candidate distances only ever grow as the walk
  // proceeds. The first candidate to reach a given length therefore reaches it at the
  // shortest distance available, and no later candidate can improve on it. That turns the
  // answer into a short list of runs: lengths 3 up to the first candidate's length share
  // its distance, the next lengths up to the second candidate's length share the second
  // candidate's distance, and so on. Shorter distances also cost fewer bits, so preferring
  // them is never wrong.

  // How many chain links a single position may examine. The walk also stops as soon as a
  // maximal match is in hand, which is what keeps runs of one repeated byte cheap, so the
  // cap only bites on input whose three-byte prefixes collide often without the matches
  // themselves getting long. Four thousand links is where the ratio stops improving
  // measurably on such input; it is also the depth zlib's own strongest setting uses.
  const MAX_CHAIN_HITS = 4096;

  class ZopfliHashChain {
    /**
     * @param {int32} windowSize - Chain window, a power of two
     */
    constructor(windowSize) {
      /** @type {int32} */
      this.windowSize = windowSize;
      /** @type {int32} */
      this.hashBits = 15;
      /** @type {int32} */
      this.hashSize = OpCodes.Shl32(1, this.hashBits);
      /** @type {int32} */
      this.hashMask = this.hashSize - 1;
      /** @type {int32[]} */
      this.head = new Int32Array(this.hashSize).fill(-1);
      /** @type {int32[]} */
      this.prev = new Int32Array(windowSize).fill(-1);
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

    // Appends the match runs available at the position and inserts it into the chain.
    // Run k covers the lengths from runMaxLength[k-1]+1 (or 3 for the first run) through
    // runMaxLength[k], all at distance runDistance[k].
    /**
     * @param {uint8[]} data - Input
     * @param {int32} position - Current position
     * @param {int32} maxDistance - Farthest allowed distance
     * @param {int32} maxLength - Longest allowed match
     * @param {int32[]} runMaxLength - Receives the run end lengths
     * @param {int32[]} runDistance - Receives the run distances
     */
    findMatchRuns(data, position, maxDistance, maxLength, runMaxLength, runDistance) {
      // The hash covers three bytes, so the last two positions can neither be searched
      // for nor entered into the chain.
      if (position + 2 >= data.length) {
        return;
      }

      /** @type {int32} */
      const hash = this._hash(data, position);
      /** @type {int32} */
      let candidate = this.head[hash];
      /** @type {int32} */
      const windowStart = Math.max(0, position - maxDistance);
      /** @type {int32} */
      const effectiveMaxLength = Math.min(maxLength, data.length - position);

      /** @type {int32} */
      const mask = this.windowSize - 1;
      /** @type {int32} */
      let hits = 0;
      /** @type {int32} */
      let bestLength = 2; // one below the shortest match RFC 1951 can express

      while (candidate >= windowStart && hits < MAX_CHAIN_HITS) {
        /** @type {int32} */
        const distance = position - candidate;

        /** @type {int32} */
        let length = 0;
        while (length < effectiveMaxLength && data[candidate + length] === data[position + length]) {
          ++length;
        }

        if (length > bestLength) {
          runMaxLength.push(length);
          runDistance.push(distance);
          bestLength = length;

          // Nothing further back can beat a maximal match, and no shorter length is left
          // uncovered, so the walk is done.
          if (bestLength >= effectiveMaxLength) {
            break;
          }
        }

        /** @type {int32} */
        const next = this.prev[OpCodes.And32(candidate, mask)];

        // The chain runs strictly backwards; anything else is an entry from a previous
        // trip round the window and must not be followed.
        if (next < 0 || next >= candidate) {
          break;
        }

        candidate = next;
        ++hits;
      }

      this.prev[OpCodes.And32(position, mask)] = this.head[hash];
      this.head[hash] = position;
    }
  }

  /**
   * Longest match at a position; length 0 when none.
   */
  class MatchInfo {
    /**
     * @param {int32} length - Match length
     * @param {int32} distance - Backward distance
     */
    constructor(length, distance) {
      /** @type {int32} */
      this.length = length;
      /** @type {int32} */
      this.distance = distance;
    }
  }

  // Holds the match runs of every position, searched once and read many times. Zopfli
  // parses the same input over and over, each pass differing only in how it prices
  // symbols; the matches themselves never change, since they depend on the bytes and the
  // window rather than on the cost model. Searching them once is what makes a dozen
  // passes affordable and lets the splitter and every block's parse share one search.
  class ZopfliMatchCache {
    /**
     * @param {uint8[]} data - Input
     */
    constructor(data) {
      /** @type {ZopfliHashChain} */
      const chain = new ZopfliHashChain(WINDOW_SIZE);
      /** @type {int32[]} */
      const runStart = new Int32Array(data.length + 1);
      /** @type {int32[]} */
      const maxLengths = [];
      /** @type {int32[]} */
      const distances = [];

      for (let position = 0; position < data.length; ++position) {
        runStart[position] = maxLengths.length;
        chain.findMatchRuns(data, position, WINDOW_SIZE, MAX_MATCH, maxLengths, distances);
      }

      runStart[data.length] = maxLengths.length;

      /** @type {int32[]} */
      this.runStart = runStart;
      /** @type {uint16[]} */
      this.runMaxLength = new Uint16Array(maxLengths.length);
      /** @type {uint16[]} */
      this.runDistance = new Uint16Array(distances.length);
      for (let k = 0; k < maxLengths.length; ++k) {
        this.runMaxLength[k] = maxLengths[k];
        this.runDistance[k] = distances[k];
      }
    }

    /**
     * @param {int32} position - Position
     * @returns {MatchInfo} Longest match there
     */
    longestMatch(position) {
      /** @type {int32} */
      const end = this.runStart[position + 1];
      if (end === this.runStart[position]) {
        return new MatchInfo(0, 0);
      }
      return new MatchInfo(this.runMaxLength[end - 1], this.runDistance[end - 1]);
    }
  }

  /**
   * One parsed symbol: a literal byte or a (length, distance) match.
   */
  class ZopfliSymbol {
    /**
     * @param {boolean} isLiteral - True for a literal
     * @param {int32} literal - Literal byte
     * @param {int32} length - Match length
     * @param {int32} distance - Match distance
     */
    constructor(isLiteral, literal, length, distance) {
      /** @type {boolean} */
      this.isLiteral = isLiteral;
      /** @type {int32} */
      this.literal = literal;
      /** @type {int32} */
      this.length = length;
      /** @type {int32} */
      this.distance = distance;
    }
  }

  // ===== OPTIMAL PARSER =====
  //
  // Every position is a node; a literal is an edge one byte long and a match of length l
  // is an edge l bytes long, each weighted by what the current cost model says the
  // corresponding symbols cost. Because every edge moves strictly forward, one sweep in
  // increasing position order relaxes the graph in topological order and the result is
  // the true minimum, not the greedy or lazy approximation an ordinary encoder settles for.

  /** @type {float64} */
  const UNREACHABLE = 1.7976931348623157e+308; // Number.MAX_VALUE

  /**
   * @param {uint8[]} data - Input
   * @param {int32} start - First byte of the range
   * @param {int32} end - End of the range
   * @param {ZopfliMatchCache} cache - Match runs
   * @param {ZopfliCostModel} model - Symbol prices
   * @returns {ZopfliSymbol[]} Cheapest parse
   */
  function optimalParse(data, start, end, cache, model) {
    /** @type {ZopfliSymbol[]} */
    const symbols = [];
    /** @type {int32} */
    const span = end - start;
    if (span <= 0) {
      return symbols;
    }

    /** @type {float64[]} */
    const cost = new Float64Array(span + 1).fill(UNREACHABLE);
    /** @type {uint16[]} */
    const length = new Uint16Array(span + 1);
    /** @type {uint16[]} */
    const distance = new Uint16Array(span + 1);
    cost[0] = 0;

    for (let i = 0; i < span; ++i) {
      /** @type {float64} */
      const here = cost[i];
      if (here === UNREACHABLE) {
        continue;
      }

      /** @type {int32} */
      const position = start + i;

      /** @type {float64} */
      const literalPrice = model.literalCost(data[position]);
      /** @type {float64} */
      const literalCost = here + literalPrice;
      if (literalCost < cost[i + 1]) {
        cost[i + 1] = literalCost;
        length[i + 1] = 1;
        distance[i + 1] = 0;
      }

      /** @type {int32} */
      const runEnd = cache.runStart[position + 1];
      /** @type {float64[]} */
      const lengthCost = model.lengthCost;
      /** @type {int32} */
      let matchLength = MIN_MATCH;
      for (let run = cache.runStart[position]; run < runEnd; ++run) {
        /** @type {int32} */
        const runDistance = cache.runDistance[run];
        /** @type {int32} */
        const runMax = cache.runMaxLength[run];
        /** @type {float64} */
        const distanceCost = here + model.distanceCost[DISTANCE_CODE_TABLE[runDistance]];

        // A match may not reach past the end of the range being parsed: the next block
        // starts there and would decode the overlap twice.
        while (matchLength <= runMax && i + matchLength <= span) {
          /** @type {float64} */
          const candidate = distanceCost + lengthCost[matchLength];
          if (candidate < cost[i + matchLength]) {
            cost[i + matchLength] = candidate;
            length[i + matchLength] = matchLength;
            distance[i + matchLength] = runDistance;
          }
          ++matchLength;
        }

        if (i + matchLength > span) {
          break;
        }
      }
    }

    /** @type {int32} */
    let pos = span;
    while (pos > 0) {
      if (distance[pos] === 0) {
        symbols.push(new ZopfliSymbol(true, data[start + pos - 1], 0, 0));
        --pos;
        continue;
      }

      symbols.push(new ZopfliSymbol(false, 0, length[pos], distance[pos]));
      pos -= length[pos];
    }

    symbols.reverse();
    return symbols;
  }

  // The ordinary lazy-matching parse of a plain DEFLATE encoder. Zopfli runs it once
  // before the first shortest-path pass, purely to have realistic symbol counts to seed
  // the cost model with: starting from the RFC 1951 fixed tables instead would spend the
  // first pass, and often several after it, discovering what the input looks like.
  /**
   * @param {uint8[]} data - Input
   * @param {int32} start - First byte of the range
   * @param {int32} end - End of the range
   * @param {ZopfliMatchCache} cache - Match runs
   * @returns {ZopfliSymbol[]} Lazy-matching parse
   */
  function greedyParse(data, start, end, cache) {
    /** @type {ZopfliSymbol[]} */
    const symbols = [];
    /** @type {int32} */
    let position = start;

    while (position < end) {
      /** @type {MatchInfo} */
      const match = cache.longestMatch(position);
      /** @type {int32} */
      let length = match.length;
      if (length > end - position) {
        length = end - position;
      }

      if (length >= MIN_MATCH && position + 1 < end) {
        /** @type {MatchInfo} */
        const nextMatch = cache.longestMatch(position + 1);
        /** @type {int32} */
        let nextLength = nextMatch.length;
        if (nextLength > end - position - 1) {
          nextLength = end - position - 1;
        }

        // A longer match one byte later is worth the literal it costs to wait for.
        if (nextLength > length) {
          symbols.push(new ZopfliSymbol(true, data[position], 0, 0));
          ++position;
          continue;
        }
      }

      if (length < MIN_MATCH) {
        symbols.push(new ZopfliSymbol(true, data[position], 0, 0));
        ++position;
        continue;
      }

      symbols.push(new ZopfliSymbol(false, 0, length, match.distance));
      position += length;
    }

    return symbols;
  }

  // ===== BLOCK COST =====
  //
  // What a block of symbols actually costs in each of the three block types RFC 1951
  // offers, so that the splitter and the emitter decide from the same numbers. The cost is
  // derived from symbol histograms rather than from the symbols themselves, so the cost of
  // any range is available in time proportional to the alphabet instead of to the range -
  // which is what makes an exhaustive search over split points affordable. For a dynamic
  // block the figure is exact, code-length table and all; approximating that table (for
  // instance at three bits per symbol) inflates it several-fold and biases the splitter
  // towards blocks that are far too large.

  /**
   * @param {int32[]} distCounts - Distance counts, padded in place
   */
  function ensureDistanceCode(distCounts) {
    for (let i = 0; i < distCounts.length; ++i) {
      if (distCounts[i] > 0) {
        return;
      }
    }

    distCounts[0] = 1;
  }

  /**
   * Transmitted alphabet sizes of a dynamic block.
   */
  class TreeSizes {
    /**
     * @param {int32} hlit - Literal/length codes transmitted
     * @param {int32} hdist - Distance codes transmitted
     */
    constructor(hlit, hdist) {
      /** @type {int32} */
      this.hlit = hlit;
      /** @type {int32} */
      this.hdist = hdist;
    }
  }

  /**
   * @param {int32[]} litLenLengths - Literal/length code lengths
   * @param {int32[]} distLengths - Distance code lengths
   * @returns {TreeSizes} Trimmed alphabet sizes
   */
  function trimTrees(litLenLengths, distLengths) {
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

    return new TreeSizes(hlit, hdist);
  }

  /**
   * @param {int32[]} litLenCounts - Literal/length counts
   * @param {int32[]} distCounts - Distance counts
   * @param {int32[]} litLenLengths - Literal/length code lengths
   * @param {int32[]} distLengths - Distance code lengths
   * @returns {float64} Bits of the coded symbols
   */
  function tokenBits(litLenCounts, distCounts, litLenLengths, distLengths) {
    /** @type {float64} */
    let bits = 0;

    for (let symbol = 0; symbol < litLenCounts.length; ++symbol) {
      /** @type {float64} */
      const count = litLenCounts[symbol];
      if (count === 0) {
        continue;
      }

      bits += count * litLenLengths[symbol];
      if (symbol > END_OF_BLOCK) {
        bits += count * LENGTH_EXTRA[symbol - 257];
      }
    }

    for (let symbol = 0; symbol < distCounts.length; ++symbol) {
      /** @type {float64} */
      const count = distCounts[symbol];
      if (count === 0) {
        continue;
      }

      bits += count * (distLengths[symbol] + DISTANCE_EXTRA[symbol]);
    }

    return bits;
  }

  // Size in bits of a dynamic block's header, including the run-length-coded description
  // of both trees.
  /**
   * @param {int32[]} litLenLengths - Literal/length code lengths
   * @param {int32[]} distLengths - Distance code lengths
   * @returns {float64} Header bits
   */
  function headerBits(litLenLengths, distLengths) {
    /** @type {TreeSizes} */
    const sizes = trimTrees(litLenLengths, distLengths);
    /** @type {int32} */
    const hlit = sizes.hlit;
    /** @type {int32} */
    const hdist = sizes.hdist;

    /** @type {int32[]} */
    const combined = new Array(hlit + hdist);
    for (let i = 0; i < hlit; ++i) {
      combined[i] = litLenLengths[i];
    }
    for (let i = 0; i < hdist; ++i) {
      combined[hlit + i] = distLengths[i];
    }

    /** @type {RleSequence} */
    const runs = encodeCodeLengthRuns(combined);
    /** @type {int32[]} */
    const clCounts = zeroArray(CL_ALPHABET_SIZE);
    for (let k = 0; k < runs.symbol.length; ++k) {
      ++clCounts[runs.symbol[k]];
    }

    /** @type {int32[]} */
    const clLengths = buildHuffmanCodeLengths(clCounts, MAX_CL_CODE_BITS);

    /** @type {int32} */
    let hclen = CL_ALPHABET_SIZE;
    while (hclen > 4 && clLengths[CODE_LENGTH_ORDER[hclen - 1]] === 0) {
      --hclen;
    }

    /** @type {float64} */
    let bits = 3 + 5 + 5 + 4 + hclen * 3;
    for (let k = 0; k < runs.symbol.length; ++k) {
      bits += clLengths[runs.symbol[k]] + runs.extraBits[k];
    }

    return bits;
  }

  // Flattens stretches of nearly equal counts so that the code lengths they produce come
  // out exactly equal.
  //
  // A dynamic block spends real bits describing its trees, and RFC 1951 describes them
  // with a run-length alphabet whose symbol 16 repeats the previous code length. Two
  // symbols whose counts differ by one may land on different code lengths and break a run
  // that would otherwise have been free; giving them the same count costs a fraction of a
  // bit in the data and can save several in the header. The published Zopfli method does
  // the same and keeps whichever of the two tables comes out smaller, which is why this
  // only ever produces a candidate, never a decision.
  //
  // A stretch is flattened only when it is at least four symbols long, every count in it
  // is non-zero, and the largest and smallest differ by at most three. Excluding zeros
  // matters: a long run of unused symbols is already described in a handful of bits by
  // symbols 17 and 18, and raising those counts to one would be a large loss.
  /**
   * @param {int32[]} counts - Counts
   * @returns {int32[]} Smoothed copy
   */
  function smoothCountsForRuns(counts) {
    /** @type {int32[]} */
    const result = counts.slice();

    /** @type {int32} */
    let end = counts.length;
    while (end > 0 && counts[end - 1] === 0) {
      --end;
    }

    /** @type {int32} */
    let i = 0;
    while (i < end) {
      if (counts[i] === 0) {
        ++i;
        continue;
      }

      /** @type {int32} */
      let low = counts[i];
      /** @type {int32} */
      let high = counts[i];
      /** @type {int32} */
      let j = i + 1;
      while (j < end && counts[j] !== 0) {
        /** @type {int32} */
        const nextLow = Math.min(low, counts[j]);
        /** @type {int32} */
        const nextHigh = Math.max(high, counts[j]);
        if (nextHigh - nextLow > 3) {
          break;
        }

        low = nextLow;
        high = nextHigh;
        ++j;
      }

      /** @type {int32} */
      const run = j - i;
      if (run >= 4 && high !== low) {
        /** @type {float64} */
        let sum = 0;
        for (let k = i; k < j; ++k) {
          sum += counts[k];
        }

        /** @type {int32} */
        let mean = Math.floor((sum + Math.floor(run / 2)) / run);
        if (mean < 1) {
          mean = 1;
        }

        for (let k = i; k < j; ++k) {
          result[k] = mean;
        }
      }

      i = j;
    }

    return result;
  }

  /**
   * Trees chosen for a dynamic block and what the block costs with them.
   */
  class DynamicBlock {
    /**
     * @param {int32[]} litLenLengths - Literal/length code lengths
     * @param {int32[]} distLengths - Distance code lengths
     * @param {float64} bits - Block size in bits
     */
    constructor(litLenLengths, distLengths, bits) {
      /** @type {int32[]} */
      this.litLenLengths = litLenLengths;
      /** @type {int32[]} */
      this.distLengths = distLengths;
      /** @type {float64} */
      this.bits = bits;
    }
  }

  // Chooses the trees a dynamic block should use and reports what the block costs with
  // them. Two candidate tree pairs are costed and the cheaper wins: the one the counts
  // imply directly, and the one implied by the smoothed histogram. Both are measured
  // against the real symbol counts, since smoothing changes only how the trees are shaped
  // and described, never what the block actually contains.
  /**
   * @param {int32[]} litLenCounts - Literal/length counts
   * @param {int32[]} distCounts - Distance counts
   * @returns {DynamicBlock} Chosen trees and cost
   */
  function buildDynamicBlock(litLenCounts, distCounts) {
    // The header must describe a distance tree even for a block that holds no
    // back-reference, so one is invented for the tree; it is not counted as an emitted
    // symbol, because it is not one.
    /** @type {int32[]} */
    const distForTree = distCounts.slice();
    ensureDistanceCode(distForTree);

    /** @type {int32[]} */
    const plainLitLen = buildHuffmanCodeLengths(litLenCounts, MAX_CODE_BITS);
    /** @type {int32[]} */
    const plainDist = buildHuffmanCodeLengths(distForTree, MAX_CODE_BITS);
    /** @type {float64} */
    const plainBits = headerBits(plainLitLen, plainDist)
      + tokenBits(litLenCounts, distCounts, plainLitLen, plainDist);

    /** @type {int32[]} */
    const smoothLitLen = buildHuffmanCodeLengths(smoothCountsForRuns(litLenCounts), MAX_CODE_BITS);
    /** @type {int32[]} */
    const smoothDist = buildHuffmanCodeLengths(smoothCountsForRuns(distForTree), MAX_CODE_BITS);
    /** @type {float64} */
    const smoothBits = headerBits(smoothLitLen, smoothDist)
      + tokenBits(litLenCounts, distCounts, smoothLitLen, smoothDist);

    if (smoothBits < plainBits) {
      return new DynamicBlock(smoothLitLen, smoothDist, smoothBits);
    }
    return new DynamicBlock(plainLitLen, plainDist, plainBits);
  }

  /**
   * @param {int32[]} litLenCounts - Literal/length counts
   * @param {int32[]} distCounts - Distance counts
   * @returns {float64} Dynamic block size in bits
   */
  function dynamicBlockBits(litLenCounts, distCounts) {
    /** @type {DynamicBlock} */
    const block = buildDynamicBlock(litLenCounts, distCounts);
    return block.bits;
  }

  /**
   * @param {int32[]} litLenCounts - Literal/length counts
   * @param {int32[]} distCounts - Distance counts
   * @returns {float64} Static block size in bits
   */
  function staticBlockBits(litLenCounts, distCounts) {
    /** @type {float64} */
    const tokens = tokenBits(litLenCounts, distCounts, FIXED_LITERAL_LENGTHS, FIXED_DISTANCE_LENGTHS);
    return 3 + tokens;
  }

  // A stored block is byte-aligned, so its true cost depends on where in the byte the
  // preceding block ended. The worst case of seven padding bits is charged here rather
  // than tracking the writer's position, because the choice this figure feeds into is
  // never that close and a cost that does not depend on emission order is far easier to
  // keep identical across implementations. Each stored block carries a 16-bit length and
  // its complement, and RFC 1951 caps one at 65535 bytes, so a long run of raw data needs
  // several.
  /**
   * @param {float64} byteCount - Bytes in the block
   * @returns {float64} Stored block size in bits
   */
  function storedBlockBits(byteCount) {
    /** @type {float64} */
    const chunks = Math.max(1, Math.floor((byteCount + 65534) / 65535));
    return chunks * (3 + 7 + 32) + byteCount * 8;
  }

  /**
   * Cheapest block type and its size.
   */
  class BlockChoice {
    /**
     * @param {int32} blockType - BLOCK_TYPE_STORED, BLOCK_TYPE_STATIC or BLOCK_TYPE_DYNAMIC
     * @param {float64} bits - Block size in bits
     */
    constructor(blockType, bits) {
      /** @type {int32} */
      this.blockType = blockType;
      /** @type {float64} */
      this.bits = bits;
    }
  }

  /**
   * @param {int32[]} litLenCounts - Literal/length counts
   * @param {int32[]} distCounts - Distance counts
   * @param {float64} byteCount - Bytes in the block
   * @returns {BlockChoice} Cheapest block type
   */
  function cheapestBlock(litLenCounts, distCounts, byteCount) {
    /** @type {float64} */
    const stored = storedBlockBits(byteCount);
    /** @type {float64} */
    const fixedHuffman = staticBlockBits(litLenCounts, distCounts);
    /** @type {float64} */
    const dynamicHuffman = dynamicBlockBits(litLenCounts, distCounts);

    // Ties go to the simpler type, which keeps the choice stable and the output smaller
    // to describe.
    if (stored <= fixedHuffman && stored <= dynamicHuffman) {
      return new BlockChoice(BLOCK_TYPE_STORED, stored);
    }

    if (fixedHuffman <= dynamicHuffman) {
      return new BlockChoice(BLOCK_TYPE_STATIC, fixedHuffman);
    }
    return new BlockChoice(BLOCK_TYPE_DYNAMIC, dynamicHuffman);
  }

  // ===== BLOCK SPLITTING =====
  //
  // A block carries its own Huffman trees, so a boundary buys the encoder a fresh
  // description of the data on either side and costs it a second header. Where the input
  // changes character that trade is strongly worth making, and where it does not, it is
  // not. Zopfli therefore searches for the split points instead of imposing a fixed block
  // size. The published method places one split at a time, greedily; this does a proper
  // dynamic program over a grid of candidate boundaries instead, finding the cheapest
  // partition into at most MAX_BLOCKS blocks outright, which can never do worse. It is
  // affordable because the histogram of any range is the difference of two prefix
  // histograms, so evaluating a candidate takes time proportional to the alphabet rather
  // than to the block.

  const MAX_BLOCKS = 15;
  const MIN_SYMBOLS_TO_SPLIT = 512;
  const MAX_CANDIDATES = 128;

  /**
   * Range of symbols forming one block.
   */
  class SymbolRange {
    /**
     * @param {int32} start - First symbol
     * @param {int32} end - End of the symbols
     */
    constructor(start, end) {
      /** @type {int32} */
      this.start = start;
      /** @type {int32} */
      this.end = end;
    }
  }

  /**
   * @param {int32[][]} litLenPrefix - Literal/length prefix histograms
   * @param {int32[][]} distPrefix - Distance prefix histograms
   * @param {float64[]} bytePrefix - Bytes consumed at each boundary
   * @param {int32} from - Starting boundary
   * @param {int32} to - Ending boundary
   * @returns {float64} Cheapest block size in bits for that range
   */
  function rangeCost(litLenPrefix, distPrefix, bytePrefix, from, to) {
    /** @type {int32[]} */
    const litLen = new Array(LIT_LEN_ALPHABET_SIZE);
    for (let s = 0; s < LIT_LEN_ALPHABET_SIZE; ++s) {
      litLen[s] = litLenPrefix[to][s] - litLenPrefix[from][s];
    }

    /** @type {int32[]} */
    const dist = new Array(DIST_ALPHABET_SIZE);
    for (let s = 0; s < DIST_ALPHABET_SIZE; ++s) {
      dist[s] = distPrefix[to][s] - distPrefix[from][s];
    }

    litLen[END_OF_BLOCK] = 1;

    /** @type {BlockChoice} */
    const choice = cheapestBlock(litLen, dist, bytePrefix[to] - bytePrefix[from]);
    return choice.bits;
  }

  /**
   * @param {ZopfliSymbol[]} symbols - Seed parse
   * @param {int32} maxBlocks - Most blocks allowed
   * @returns {SymbolRange[]} Cheapest partition of the symbols
   */
  function splitBlocks(symbols, maxBlocks) {
    if (symbols.length < MIN_SYMBOLS_TO_SPLIT || maxBlocks <= 1) {
      /** @type {SymbolRange[]} */
      const whole = [];
      whole.push(new SymbolRange(0, symbols.length));
      return whole;
    }

    // Candidate boundaries on a regular grid. Finer than this buys almost nothing: a
    // boundary a few symbols out of place costs a handful of bits, while the header it
    // saves or spends is hundreds.
    /** @type {int32} */
    const interval = Math.max(1, Math.floor(symbols.length / MAX_CANDIDATES));
    /** @type {int32[]} */
    const candidates = [0];
    for (let i = interval; i < symbols.length; i += interval) {
      candidates.push(i);
    }
    if (candidates[candidates.length - 1] !== symbols.length) {
      candidates.push(symbols.length);
    }

    /** @type {int32} */
    const count = candidates.length;

    // Prefix histograms at the candidate boundaries, plus the input bytes consumed, so
    // that any candidate block's statistics are one subtraction away.
    /** @type {int32[][]} */
    const litLenPrefix = new Array(count);
    /** @type {int32[][]} */
    const distPrefix = new Array(count);
    /** @type {float64[]} */
    const bytePrefix = zeroArray(count);
    litLenPrefix[0] = zeroArray(LIT_LEN_ALPHABET_SIZE);
    distPrefix[0] = zeroArray(DIST_ALPHABET_SIZE);

    for (let c = 1; c < count; ++c) {
      /** @type {int32[]} */
      const litLen = litLenPrefix[c - 1].slice();
      /** @type {int32[]} */
      const dist = distPrefix[c - 1].slice();
      /** @type {float64} */
      let bytes = bytePrefix[c - 1];

      for (let s = candidates[c - 1]; s < candidates[c]; ++s) {
        /** @type {ZopfliSymbol} */
        const symbol = symbols[s];
        if (symbol.isLiteral) {
          ++litLen[symbol.literal];
          ++bytes;
          continue;
        }

        ++litLen[getLengthCode(symbol.length)];
        ++dist[getDistanceCode(symbol.distance)];
        bytes += symbol.length;
      }

      litLenPrefix[c] = litLen;
      distPrefix[c] = dist;
      bytePrefix[c] = bytes;
    }

    /** @type {float64[][]} */
    const cost = new Array(count);
    for (let i = 0; i < count; ++i) {
      cost[i] = new Float64Array(count);
      for (let j = i + 1; j < count; ++j) {
        cost[i][j] = rangeCost(litLenPrefix, distPrefix, bytePrefix, i, j);
      }
    }

    // best[b][j] is the cheapest way to cover the first j candidate intervals with
    // exactly b blocks; from[b][j] remembers where that partition's last block began.
    /** @type {float64[][]} */
    const best = new Array(maxBlocks + 1);
    /** @type {int32[][]} */
    const from = new Array(maxBlocks + 1);
    for (let b = 0; b <= maxBlocks; ++b) {
      best[b] = new Float64Array(count).fill(UNREACHABLE);
      from[b] = new Int32Array(count);
    }

    for (let j = 1; j < count; ++j) {
      best[1][j] = cost[0][j];
      from[1][j] = 0;
    }

    for (let b = 2; b <= maxBlocks; ++b) {
      for (let j = b; j < count; ++j) {
        for (let i = b - 1; i < j; ++i) {
          if (best[b - 1][i] === UNREACHABLE) {
            continue;
          }

          /** @type {float64} */
          const total = best[b - 1][i] + cost[i][j];
          if (total >= best[b][j]) {
            continue;
          }

          best[b][j] = total;
          from[b][j] = i;
        }
      }
    }

    /** @type {int32} */
    let bestBlocks = 1;
    for (let b = 2; b <= maxBlocks; ++b) {
      if (best[b][count - 1] < best[bestBlocks][count - 1]) {
        bestBlocks = b;
      }
    }

    /** @type {int32[]} */
    const boundaries = [];
    /** @type {int32} */
    let node = count - 1;
    for (let b = bestBlocks; b >= 1; --b) {
      boundaries.push(node);
      node = from[b][node];
    }

    boundaries.push(0);
    boundaries.reverse();

    /** @type {SymbolRange[]} */
    const result = [];
    for (let i = 0; i + 1 < boundaries.length; ++i) {
      result.push(new SymbolRange(candidates[boundaries[i]], candidates[boundaries[i + 1]]));
    }

    return result;
  }

  // ===== ITERATIVE SEARCH =====

  // How many rounds of re-parsing a block gets. Each round costs about as much as one
  // pass of the shortest-path search over the block, so the budget shrinks as the input
  // grows; the returns diminish sharply after the first few rounds in any case.
  /**
   * @param {int32} totalLength - Input length
   * @returns {int32} Rounds per block
   */
  function iterationsFor(totalLength) {
    if (totalLength <= 16384) {
      return 60;
    }
    if (totalLength <= 131072) {
      return 40;
    }
    if (totalLength <= 524288) {
      return 30;
    }
    return 25;
  }

  /**
   * Symbol histograms of a parse.
   */
  class SymbolCounts {
    /**
     * @param {int32[]} litLen - Literal/length counts
     * @param {int32[]} dist - Distance counts
     */
    constructor(litLen, dist) {
      /** @type {int32[]} */
      this.litLen = litLen;
      /** @type {int32[]} */
      this.dist = dist;
    }
  }

  // Counts the symbols of a parse, with the end-of-block symbol included.
  /**
   * @param {ZopfliSymbol[]} symbols - Parse
   * @returns {SymbolCounts} Histograms
   */
  function countSymbols(symbols) {
    /** @type {int32[]} */
    const litLen = zeroArray(LIT_LEN_ALPHABET_SIZE);
    /** @type {int32[]} */
    const dist = zeroArray(DIST_ALPHABET_SIZE);

    for (let k = 0; k < symbols.length; ++k) {
      /** @type {ZopfliSymbol} */
      const symbol = symbols[k];
      if (symbol.isLiteral) {
        ++litLen[symbol.literal];
        continue;
      }

      ++litLen[getLengthCode(symbol.length)];
      ++dist[getDistanceCode(symbol.distance)];
    }

    litLen[END_OF_BLOCK] = 1;
    return new SymbolCounts(litLen, dist);
  }

  /**
   * @param {int32[]} litLenCounts - Literal/length counts
   * @param {int32[]} distCounts - Distance counts
   * @param {float64} byteCount - Bytes in the block
   * @returns {float64} Cheapest block size in bits
   */
  function blockBits(litLenCounts, distCounts, byteCount) {
    /** @type {BlockChoice} */
    const choice = cheapestBlock(litLenCounts, distCounts, byteCount);
    return choice.bits;
  }

  // Replaces about a third of the counts with another count drawn from the same table.
  // The point is to move the cost model somewhere the loop has not been, cheaply, without
  // losing the shape of the distribution: every value written is a value the table already
  // held. The generator is the linear congruential one of Knuth's The Art of Computer
  // Programming volume 2, taken modulo 2^32; only its high bits are consulted, since the
  // low bits of such a generator cycle far too quickly to be useful.
  /**
   * @param {int32[]} counts - Counts, perturbed in place
   * @param {uint32} state - Generator state
   * @returns {uint32} Updated generator state
   */
  function perturbCounts(counts, state) {
    /** @type {uint32} */
    let s = state;
    for (let i = 0; i < counts.length; ++i) {
      /** @type {float64} */
      const product = OpCodes.Mul32(s, 1664525);
      s = OpCodes.ToUint32(product + 1013904223);
      if (Math.floor(s / 256) % 3 !== 0) {
        continue;
      }

      /** @type {float64} */
      const product2 = OpCodes.Mul32(s, 1664525);
      s = OpCodes.ToUint32(product2 + 1013904223);
      counts[i] = counts[s % counts.length];
    }

    return s;
  }

  // Weights the current counts at one and the previous round's at one half. Halving the
  // older term keeps the blend bounded no matter how many rounds run, which integer counts
  // need and floating-point ones can ignore.
  /**
   * @param {int32[]} current - Current counts
   * @param {int32[]} previous - Previous counts
   * @returns {int32[]} Blend
   */
  function blendCounts(current, previous) {
    /** @type {int32[]} */
    const result = new Array(current.length);
    for (let i = 0; i < current.length; ++i) {
      result[i] = current[i] + Math.floor(previous[i] / 2);
    }
    return result;
  }

  // The loop is not a contraction and need not improve every round, which is why the size
  // of each round's parse is measured exactly and the smallest is what gets emitted. When
  // two consecutive rounds land on the same size the search has settled, and it is nudged
  // off that fixed point by perturbing the counts, so that the remaining rounds explore
  // instead of recomputing an answer already in hand.
  /**
   * @param {uint8[]} data - Input
   * @param {int32} start - First byte of the block
   * @param {int32} end - End of the block
   * @param {ZopfliMatchCache} cache - Match runs
   * @param {int32} iterations - Rounds
   * @returns {ZopfliSymbol[]} Smallest parse found
   */
  function optimizeBlock(data, start, end, cache, iterations) {
    /** @type {int32} */
    const byteCount = end - start;

    /** @type {ZopfliSymbol[]} */
    const seed = greedyParse(data, start, end, cache);
    /** @type {SymbolCounts} */
    const seedCounts = countSymbols(seed);

    /** @type {ZopfliSymbol[]} */
    let best = seed;
    /** @type {float64} */
    let bestBits = blockBits(seedCounts.litLen, seedCounts.dist, byteCount);
    /** @type {int32[]} */
    let bestLitLen = seedCounts.litLen;
    /** @type {int32[]} */
    let bestDist = seedCounts.dist;

    /** @type {int32[]} */
    let modelLitLen = seedCounts.litLen;
    /** @type {int32[]} */
    let modelDist = seedCounts.dist;

    /** @type {int32[]} */
    let lastLitLen = null;
    /** @type {int32[]} */
    let lastDist = null;
    /** @type {float64} */
    let lastBits = -1;
    /** @type {boolean} */
    let perturbed = false;
    /** @type {uint32} */
    let random = 0x5A17E1F1;

    for (let iteration = 0; iteration < iterations; ++iteration) {
      /** @type {ZopfliCostModel} */
      const model = new ZopfliCostModel(modelLitLen, modelDist);
      /** @type {ZopfliSymbol[]} */
      const parsed = optimalParse(data, start, end, cache, model);
      /** @type {SymbolCounts} */
      const parsedCounts = countSymbols(parsed);
      /** @type {float64} */
      const bits = blockBits(parsedCounts.litLen, parsedCounts.dist, byteCount);

      if (bits < bestBits) {
        best = parsed;
        bestBits = bits;
        bestLitLen = parsedCounts.litLen;
        bestDist = parsedCounts.dist;
      }

      /** @type {int32[]} */
      let nextLitLen = parsedCounts.litLen;
      /** @type {int32[]} */
      let nextDist = parsedCounts.dist;

      // Two rounds of the same size means the loop has reached a fixed point. Restarting
      // from the best counts seen, perturbed, is what turns the remaining rounds into a
      // wider search rather than a repetition.
      if (iteration >= 5 && bits === lastBits) {
        nextLitLen = bestLitLen.slice();
        nextDist = bestDist.slice();
        random = perturbCounts(nextLitLen, random);
        random = perturbCounts(nextDist, random);
        perturbed = true;
      }

      // Once the search is exploring, blending in the previous round's counts damps the
      // swing between rounds; converging slowly on a better answer beats oscillating.
      if (perturbed && lastLitLen !== null && lastDist !== null) {
        nextLitLen = blendCounts(nextLitLen, lastLitLen);
        nextDist = blendCounts(nextDist, lastDist);
      }

      lastLitLen = modelLitLen;
      lastDist = modelDist;
      lastBits = bits;
      modelLitLen = nextLitLen;
      modelDist = nextDist;
    }

    return best;
  }

  /**
   * A planned block: its input byte range and the symbols that encode it.
   */
  class PlannedBlock {
    /**
     * @param {int32} start - First input byte
     * @param {int32} end - End of the input bytes
     * @param {ZopfliSymbol[]} symbols - Chosen parse
     */
    constructor(start, end, symbols) {
      /** @type {int32} */
      this.start = start;
      /** @type {int32} */
      this.end = end;
      /** @type {ZopfliSymbol[]} */
      this.symbols = symbols;
    }
  }

  // Plans how to encode the input: where the blocks go and what symbols each holds.
  /**
   * @param {uint8[]} data - Input
   * @returns {PlannedBlock[]} Blocks to emit
   */
  function compressOptimal(data) {
    /** @type {PlannedBlock[]} */
    const result = [];
    if (data.length === 0) {
      /** @type {ZopfliSymbol[]} */
      const none = [];
      result.push(new PlannedBlock(0, 0, none));
      return result;
    }

    /** @type {ZopfliMatchCache} */
    const cache = new ZopfliMatchCache(data);
    /** @type {ZopfliSymbol[]} */
    const seed = greedyParse(data, 0, data.length, cache);

    // Split on the seed parse. The split points are input positions, so each block can
    // then be parsed on its own terms, with its own cost model - which is the whole point
    // of splitting. Matches inside a block may still reach back into earlier blocks.
    /** @type {SymbolRange[]} */
    const ranges = splitBlocks(seed, MAX_BLOCKS);
    /** @type {int32[]} */
    const byteStart = new Array(ranges.length + 1);
    /** @type {int32} */
    let consumed = 0;
    /** @type {int32} */
    let symbolIndex = 0;
    for (let r = 0; r < ranges.length; ++r) {
      byteStart[r] = consumed;
      for (; symbolIndex < ranges[r].end; ++symbolIndex) {
        /** @type {ZopfliSymbol} */
        const symbol = seed[symbolIndex];
        consumed += symbol.isLiteral ? 1 : symbol.length;
      }
    }

    byteStart[ranges.length] = data.length;

    /** @type {int32} */
    const iterations = iterationsFor(data.length);
    for (let r = 0; r < ranges.length; ++r) {
      /** @type {int32} */
      const start = byteStart[r];
      /** @type {int32} */
      const end = byteStart[r + 1];
      result.push(new PlannedBlock(start, end, optimizeBlock(data, start, end, cache, iterations)));
    }

    return result;
  }

  // ===== BLOCK EMISSION =====

  /**
   * @param {BitStream} stream - Output bits
   * @param {ZopfliSymbol[]} symbols - Block symbols
   * @param {HuffmanTree} literalTree - Literal/length tree
   * @param {HuffmanTree} distanceTree - Distance tree
   */
  function writeTokens(stream, symbols, literalTree, distanceTree) {
    for (let k = 0; k < symbols.length; ++k) {
      /** @type {ZopfliSymbol} */
      const token = symbols[k];
      if (token.isLiteral) {
        literalTree.requireCode(token.literal);
        stream.writeHuffmanCode(literalTree.codeValue[token.literal], literalTree.codeLength[token.literal]);
        continue;
      }

      /** @type {int32} */
      const lengthCode = getLengthCode(token.length);
      /** @type {int32} */
      const lengthIndex = lengthCode - 257;
      literalTree.requireCode(lengthCode);
      stream.writeHuffmanCode(literalTree.codeValue[lengthCode], literalTree.codeLength[lengthCode]);
      if (LENGTH_EXTRA[lengthIndex] > 0) {
        stream.writeBits(token.length - LENGTH_BASE[lengthIndex], LENGTH_EXTRA[lengthIndex]);
      }

      /** @type {int32} */
      const distCode = getDistanceCode(token.distance);
      distanceTree.requireCode(distCode);
      stream.writeHuffmanCode(distanceTree.codeValue[distCode], distanceTree.codeLength[distCode]);
      if (DISTANCE_EXTRA[distCode] > 0) {
        stream.writeBits(token.distance - DISTANCE_BASE[distCode], DISTANCE_EXTRA[distCode]);
      }
    }
  }

  /**
   * @param {BitStream} stream - Output bits
   * @param {uint8[]} data - Input
   * @param {int32} start - First byte of the block
   * @param {int32} end - End of the block
   * @param {boolean} isFinal - True for the last block
   */
  function emitStoredBlock(stream, data, start, end, isFinal) {
    /** @type {int32} */
    let offset = start;
    while (offset < end) {
      /** @type {int32} */
      const chunkSize = Math.min(end - offset, 65535);
      /** @type {boolean} */
      const isLastChunk = (offset + chunkSize >= end) && isFinal;

      stream.writeBits(isLastChunk ? 1 : 0, 1);
      stream.writeBits(BLOCK_TYPE_STORED, 2);
      stream.alignToByte();

      stream.writeBits(chunkSize, 16);
      stream.writeBits(OpCodes.And32(OpCodes.ToUint32(-chunkSize - 1), 0xFFFF), 16);

      for (let i = 0; i < chunkSize; ++i) {
        stream.writeBits(data[offset + i], 8);
      }

      offset += chunkSize;
    }
  }

  /**
   * @param {BitStream} stream - Output bits
   * @param {ZopfliSymbol[]} symbols - Block symbols
   * @param {boolean} isFinal - True for the last block
   */
  function emitStaticHuffmanBlock(stream, symbols, isFinal) {
    /** @type {HuffmanTree} */
    const literalTree = HuffmanTree.buildFromLengths(FIXED_LITERAL_LENGTHS);
    /** @type {HuffmanTree} */
    const distanceTree = HuffmanTree.buildFromLengths(FIXED_DISTANCE_LENGTHS);

    stream.writeBits(isFinal ? 1 : 0, 1);
    stream.writeBits(BLOCK_TYPE_STATIC, 2);

    writeTokens(stream, symbols, literalTree, distanceTree);

    literalTree.requireCode(END_OF_BLOCK);
    stream.writeHuffmanCode(literalTree.codeValue[END_OF_BLOCK], literalTree.codeLength[END_OF_BLOCK]);
  }

  /**
   * @param {BitStream} stream - Output bits
   * @param {int32[]} litLenCounts - Literal/length counts
   * @param {int32[]} distCounts - Distance counts
   * @param {ZopfliSymbol[]} symbols - Block symbols
   * @param {boolean} isFinal - True for the last block
   */
  function emitDynamicHuffmanBlock(stream, litLenCounts, distCounts, symbols, isFinal) {
    // The trees are the ones the block's measured cost was based on, which may be the
    // run-friendly variant, and which already invents the distance code a block without
    // back-references needs.
    /** @type {DynamicBlock} */
    const chosen = buildDynamicBlock(litLenCounts, distCounts);
    /** @type {int32[]} */
    const litLenLengths = chosen.litLenLengths;
    /** @type {int32[]} */
    const distLengths = chosen.distLengths;
    /** @type {TreeSizes} */
    const sizes = trimTrees(litLenLengths, distLengths);
    /** @type {int32} */
    const hlit = sizes.hlit;
    /** @type {int32} */
    const hdist = sizes.hdist;

    /** @type {int32[]} */
    const combined = new Array(hlit + hdist);
    for (let i = 0; i < hlit; ++i) {
      combined[i] = litLenLengths[i];
    }
    for (let i = 0; i < hdist; ++i) {
      combined[hlit + i] = distLengths[i];
    }
    /** @type {RleSequence} */
    const runs = encodeCodeLengthRuns(combined);

    /** @type {int32[]} */
    const clCounts = zeroArray(CL_ALPHABET_SIZE);
    for (let k = 0; k < runs.symbol.length; ++k) {
      ++clCounts[runs.symbol[k]];
    }
    if (!anyPositive(clCounts)) {
      clCounts[0] = 1;
    }
    /** @type {int32[]} */
    const clLengths = buildHuffmanCodeLengths(clCounts, MAX_CL_CODE_BITS);

    /** @type {int32} */
    let hclen = CL_ALPHABET_SIZE;
    while (hclen > 4 && clLengths[CODE_LENGTH_ORDER[hclen - 1]] === 0) {
      --hclen;
    }

    /** @type {HuffmanTree} */
    const clTree = HuffmanTree.buildFromLengths(clLengths);

    stream.writeBits(isFinal ? 1 : 0, 1);
    stream.writeBits(BLOCK_TYPE_DYNAMIC, 2);
    stream.writeBits(hlit - 257, 5);
    stream.writeBits(hdist - 1, 5);
    stream.writeBits(hclen - 4, 4);

    for (let i = 0; i < hclen; ++i) {
      stream.writeBits(clLengths[CODE_LENGTH_ORDER[i]], 3);
    }

    for (let k = 0; k < runs.symbol.length; ++k) {
      /** @type {int32} */
      const symbol = runs.symbol[k];
      clTree.requireCode(symbol);
      stream.writeHuffmanCode(clTree.codeValue[symbol], clTree.codeLength[symbol]);
      if (runs.extraBits[k] > 0) {
        stream.writeBits(runs.extraValue[k], runs.extraBits[k]);
      }
    }

    /** @type {HuffmanTree} */
    const literalTree = HuffmanTree.buildFromLengths(litLenLengths.slice(0, hlit));
    /** @type {HuffmanTree} */
    const distanceTree = HuffmanTree.buildFromLengths(distLengths.slice(0, hdist));

    writeTokens(stream, symbols, literalTree, distanceTree);

    literalTree.requireCode(END_OF_BLOCK);
    stream.writeHuffmanCode(literalTree.codeValue[END_OF_BLOCK], literalTree.codeLength[END_OF_BLOCK]);
  }

  // ===== ZOPFLI COMPRESSION ALGORITHM =====

  class ZopfliCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Zopfli";
      this.description = "Iterative-optimal DEFLATE encoder from Google (2013). Parses the input by shortest path over the entropy of the previous parse's symbol counts, repeats until the size stops falling, and searches for the block boundaries that minimise the total. Output is standard RFC 1951 DEFLATE, decodable by any conforming reader.";
      this.inventor = "Lode Vandevenne, Jyrki Alakuijala (Google)";
      this.year = 2013;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Deflate Optimizer (LZ77 + Huffman)";
      this.securityStatus = null;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Zopfli Announcement (2013)", "https://opensource.googleblog.com/2013/02/compress-data-more-densely-with-zopfli.html"),
        new LinkItem("RFC 1951 - Deflate Format", "https://datatracker.ietf.org/doc/html/rfc1951"),
        new LinkItem("Zopfli Wikipedia", "https://en.wikipedia.org/wiki/Zopfli")
      ];

      this.references = [
        new LinkItem("Official Google Zopfli Repository (C reference implementation)", "https://github.com/google/zopfli")
      ];

      // Test vectors - Round-trip compression tests (Zopfli output varies with
      // iteration/block-splitting heuristics, so exact bytes aren't pinned here)
      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes("hello"),
          [],
          "Zopfli RFC 1951 round-trip - hello",
          "https://datatracker.ietf.org/doc/html/rfc1951"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AAAA"),
          [],
          "Zopfli RFC 1951 round-trip - AAAA",
          "https://datatracker.ietf.org/doc/html/rfc1951"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("ABCABCABC"),
          [],
          "Zopfli RFC 1951 round-trip - ABCABCABC",
          "https://datatracker.ietf.org/doc/html/rfc1951"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new ZopfliInstance(this, isInverse);
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

  // The former {base, extra} tables had no entry past their ends; reading one
  // raised this TypeError, which a corrupt stream still gets.
  /**
   * @param {int32} index - Table index
   * @param {int32} size - Table size
   */
  function requireTableEntry(index, size) {
    if (index < 0 || index >= size) {
      throw new TypeError("Cannot read properties of undefined (reading 'base')");
    }
  }

  /**
   * Zopfli cipher instance implementing Feed/Result pattern
   * @class
   * @extends {IAlgorithmInstance}
   */
  class ZopfliInstance extends IAlgorithmInstance {
    /**
     * @param {ZopfliCompression} algorithm - Owning algorithm
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
      // Like DEFLATE, an empty input is not a no-op for compression: RFC 1951
      // still requires a minimal final block. Decompression of a genuinely
      // empty buffer has nothing to read and legitimately yields [].
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
     * @returns {uint8[]} Raw DEFLATE stream
     */
    _compress(data) {
      /** @type {BitStream} */
      const stream = new BitStream();
      /** @type {PlannedBlock[]} */
      const blocks = compressOptimal(data);

      for (let i = 0; i < blocks.length; ++i) {
        /** @type {PlannedBlock} */
        const block = blocks[i];
        /** @type {int32} */
        const start = block.start;
        /** @type {int32} */
        const end = block.end;
        /** @type {ZopfliSymbol[]} */
        const symbols = block.symbols;
        /** @type {boolean} */
        const isLastBlock = i === blocks.length - 1;

        /** @type {SymbolCounts} */
        const counts = countSymbols(symbols);

        // Data that will not compress must still be handed on unharmed: without the
        // stored block type an incompressible block grows by roughly a byte per hundred
        // instead of by five bytes per 64 KB.
        /** @type {BlockChoice} */
        const choice = cheapestBlock(counts.litLen, counts.dist, end - start);
        if (choice.blockType === BLOCK_TYPE_STORED) {
          emitStoredBlock(stream, data, start, end, isLastBlock);
        } else if (choice.blockType === BLOCK_TYPE_STATIC) {
          emitStaticHuffmanBlock(stream, symbols, isLastBlock);
        } else {
          emitDynamicHuffmanBlock(stream, counts.litLen, counts.dist, symbols, isLastBlock);
        }
      }

      /** @type {uint8[]} */
      const packed = stream.flush();
      return packed;
    }

    // ===== DECOMPRESSION (standard RFC 1951 reader) =====

    /**
     * @param {uint8[]} data - Raw DEFLATE stream
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
            literalTree = HuffmanTree.buildFromLengths(FIXED_LITERAL_LENGTHS);
            distanceTree = HuffmanTree.buildFromLengths(FIXED_DISTANCE_LENGTHS);
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
              requireTableEntry(lengthCode, LENGTH_BASE.length);
              /** @type {int32} */
              let length = LENGTH_BASE[lengthCode];
              if (LENGTH_EXTRA[lengthCode] > 0) {
                /** @type {uint32} */
                const extra = reader.readBits(LENGTH_EXTRA[lengthCode]);
                length += extra;
              }

              /** @type {int32} */
              const distCode = distanceTree.decode(reader);
              requireTableEntry(distCode, DISTANCE_BASE.length);
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

  const algorithmInstance = new ZopfliCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ZopfliCompression, ZopfliInstance };
}));
