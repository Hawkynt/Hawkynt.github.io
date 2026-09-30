/*
 * BSC (Block Sorting Compression) Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * A clean-room port of CompressionWorkbench's reduced BSC building block
 * (BB_Bsc): a Burrows-Wheeler Transform, a Move-to-Front recoding, and a
 * lightweight adaptive entropy stage - an LZMA-style adaptive bit-tree over
 * a byte-aligned range coder. Two bit-trees are kept: one for ranks that
 * immediately follow a zero rank and one for the rest, since MTF output
 * alternates between long zero runs and scattered non-zero ranks; this
 * single order-1 split is the entire context model, deliberately far
 * lighter than a full context-mixing ensemble - matching where libbsc's
 * actual entropy stage sits relative to full CM coders.
 *
 * Modelled after Ilya Grebnov's libbsc (https://github.com/IlyaGrebnov/libbsc).
 * This is a reduced, from-specification reimplementation matching the
 * CompressionWorkbench reference exactly, not the full reference libbsc.
 *
 * Wire format: [originalLength: uint32 LE] [bwtPrimaryIndex: uint32 LE]
 * [range-coded MTF ranks, one adaptive 8-bit tree per rank, selected by
 * whether the previous rank was zero]
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
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, LinkItem } = AlgorithmFramework;

  // ===== LZMA-STYLE RANGE CODER (matches Compression.Core.Entropy.RangeCoding) =====

  /** @type {int32} */
  const RC_BIT_MODEL_TOTAL_BITS = 11;
  /** @type {int32} */
  const RC_BIT_MODEL_TOTAL = OpCodes.Shl32(1, RC_BIT_MODEL_TOTAL_BITS); // 2048
  /** @type {int32} */
  const RC_NUM_MOVE_BITS = 5;
  /** @type {uint32} */
  const RC_TOP_VALUE = OpCodes.Shl32(1, 24);
  /** @type {int32} */
  const RC_PROB_INIT_VALUE = RC_BIT_MODEL_TOTAL / 2; // 1024

  class RangeEncoder {
    constructor() {
      /** @type {uint32} */
      this.range = 0xFFFFFFFF;
      // low may transiently exceed 32 bits (carry); it is kept as an exact
      // float64 and truncated on each shiftLow
      /** @type {float64} */
      this.low = 0;
      /** @type {int32} */
      this.cacheSize = 1;
      /** @type {int32} */
      this.cache = 0;
      /** @type {uint8[]} */
      this.output = [];
    }

    /**
     * @param {int32[]} probs - Probabilities
     * @param {int32} idx - Probability used
     * @param {int32} bit - Bit to code
     */
    encodeBit(probs, idx, bit) {
      /** @type {int32} */
      const p = probs[idx];
      // range >> 11 times an 11-bit probability stays below 2^32, so Mul32 is exact
      /** @type {uint32} */
      const bound = OpCodes.Mul32(OpCodes.Shr32(this.range, RC_BIT_MODEL_TOTAL_BITS), p);
      if (bit === 0) {
        this.range = bound;
        /** @type {int32} */
        const up = OpCodes.Shr32(RC_BIT_MODEL_TOTAL - p, RC_NUM_MOVE_BITS);
        probs[idx] = p + up;
      } else {
        this.low += bound;
        this.range = OpCodes.Sub32(this.range, bound);
        /** @type {int32} */
        const down = OpCodes.Shr32(p, RC_NUM_MOVE_BITS);
        probs[idx] = p - down;
      }
      this._normalize();
    }

    /** Flush the pending bytes */
    finish() {
      for (let i = 0; i < 5; ++i) {
        this._shiftLow();
      }
    }

    _normalize() {
      if (this.range >= RC_TOP_VALUE) {
        return;
      }
      this.range = OpCodes.Shl32(this.range, 8);
      this._shiftLow();
    }

    _shiftLow() {
      /** @type {int32} */
      const carry = Math.floor(this.low / 4294967296); // this.low >> 32
      if (this.low < 0xFF000000 || carry !== 0) {
        /** @type {int32} */
        let temp = this.cache;
        do {
          this.output.push(OpCodes.And32(temp + carry, 0xFF));
          temp = 0xFF;
        } while (--this.cacheSize > 0);
        this.cache = OpCodes.And32(OpCodes.Shr32(OpCodes.ToUint32(this.low), 24), 0xFF);
      }
      ++this.cacheSize;
      this.low = OpCodes.Shl32(OpCodes.ToUint32(this.low), 8);
    }
  }

  class RangeDecoder {
    /**
     * @param {uint8[]} bytes - Coded bytes (zero past the end)
     */
    constructor(bytes) {
      /** @type {uint8[]} */
      this.input = bytes;
      /** @type {int32} */
      this.pos = 0;
      /** @type {uint32} */
      this.range = 0xFFFFFFFF;
      /** @type {uint32} */
      this.code = 0;
      this._readByte(); // leading 0x00 byte, discarded (matches RangeEncoder's initial cache)
      for (let i = 0; i < 4; ++i) {
        this.code = OpCodes.Or32(OpCodes.Shl32(this.code, 8), this._readByte());
      }
    }

    /**
     * @returns {uint8} Next byte, 0 past the end
     */
    _readByte() {
      return this.pos < this.input.length ? this.input[this.pos++] : 0;
    }

    /**
     * @param {int32[]} probs - Probabilities
     * @param {int32} idx - Probability used
     * @returns {int32} Decoded bit
     */
    decodeBit(probs, idx) {
      /** @type {int32} */
      const p = probs[idx];
      /** @type {uint32} */
      const bound = OpCodes.Mul32(OpCodes.Shr32(this.range, RC_BIT_MODEL_TOTAL_BITS), p);
      /** @type {int32} */
      let bit = 0;
      if (this.code < bound) {
        this.range = bound;
        /** @type {int32} */
        const up = OpCodes.Shr32(RC_BIT_MODEL_TOTAL - p, RC_NUM_MOVE_BITS);
        probs[idx] = p + up;
        bit = 0;
      } else {
        this.code = OpCodes.Sub32(this.code, bound);
        this.range = OpCodes.Sub32(this.range, bound);
        /** @type {int32} */
        const down = OpCodes.Shr32(p, RC_NUM_MOVE_BITS);
        probs[idx] = p - down;
        bit = 1;
      }
      this._normalize();
      return bit;
    }

    _normalize() {
      if (this.range >= RC_TOP_VALUE) {
        return;
      }
      this.range = OpCodes.Shl32(this.range, 8);
      this.code = OpCodes.Or32(OpCodes.Shl32(this.code, 8), this._readByte());
    }
  }

  class BitTreeEncoder {
    /**
     * @param {int32} numBits - Bits per symbol
     */
    constructor(numBits) {
      /** @type {int32} */
      this.numBits = numBits;
      /** @type {int32[]} */
      this.probs = new Int32Array(OpCodes.Shl32(1, numBits)).fill(RC_PROB_INIT_VALUE);
    }

    /**
     * @param {RangeEncoder} encoder - Output coder
     * @param {uint32} value - Symbol
     */
    encode(encoder, value) {
      /** @type {uint32} */
      let index = 1;
      for (let i = this.numBits - 1; i >= 0; --i) {
        /** @type {uint32} */
        const bit = OpCodes.And32(OpCodes.Shr32(value, i), 1);
        encoder.encodeBit(this.probs, index, bit);
        index = OpCodes.Or32(OpCodes.Shl32(index, 1), bit);
      }
    }
  }

  class BitTreeDecoder {
    /**
     * @param {int32} numBits - Bits per symbol
     */
    constructor(numBits) {
      /** @type {int32} */
      this.numBits = numBits;
      /** @type {int32[]} */
      this.probs = new Int32Array(OpCodes.Shl32(1, numBits)).fill(RC_PROB_INIT_VALUE);
    }

    /**
     * @param {RangeDecoder} decoder - Input coder
     * @returns {int32} Symbol
     */
    decode(decoder) {
      /** @type {uint32} */
      let index = 1;
      for (let i = 0; i < this.numBits; ++i) {
        /** @type {int32} */
        const bit = decoder.decodeBit(this.probs, index);
        index = OpCodes.Or32(OpCodes.Shl32(index, 1), bit);
      }
      /** @type {int32} */
      const top = OpCodes.Shl32(1, this.numBits);
      /** @type {int32} */
      const leaf = index;
      return leaf - top;
    }
  }

  // ===== BURROWS-WHEELER TRANSFORM (matches Compression.Core.Transforms.BurrowsWheelerTransform) =====

  /**
   * Result of the forward transform
   */
  class BwtResult {
    /**
     * @param {uint8[]} transformed - Last column of the sorted rotations
     * @param {int32} index - Row of the original rotation
     */
    constructor(transformed, index) {
      /** @type {uint8[]} */
      this.transformed = transformed;
      /** @type {int32} */
      this.index = index;
    }
  }

  /**
   * Compare the rotations of data starting at a and b
   * @param {uint8[]} data - Bytes
   * @param {int32} a - First rotation start
   * @param {int32} b - Second rotation start
   * @returns {int32} Negative, zero or positive as rotation a sorts before, with or after b
   */
  function compareRotations(data, a, b) {
    /** @type {int32} */
    const n = data.length;
    for (let k = 0; k < n; ++k) {
      /** @type {int32} */
      const da = data[(a + k) % n];
      /** @type {int32} */
      const db = data[(b + k) % n];
      if (da !== db) {
        return da - db;
      }
    }
    return 0;
  }

  /**
   * Stable merge sort of rotation starts. Fully-tied rotations (periodic
   * input) keep their ascending index order, exactly as the stable
   * Array.prototype.sort did.
   * @param {uint8[]} data - Bytes
   * @param {int32[]} sa - Rotation starts, sorted in place
   */
  function sortRotations(data, sa) {
    /** @type {int32} */
    const n = sa.length;
    /** @type {int32[]} */
    let src = sa.slice();
    /** @type {int32[]} */
    let dst = new Array(n);
    for (let width = 1; width < n; width *= 2) {
      for (let lo = 0; lo < n; lo += 2 * width) {
        /** @type {int32} */
        const mid = Math.min(lo + width, n);
        /** @type {int32} */
        const hi = Math.min(lo + 2 * width, n);
        /** @type {int32} */
        let i = lo;
        /** @type {int32} */
        let j = mid;
        /** @type {int32} */
        let k = lo;
        while (i < mid && j < hi) {
          if (compareRotations(data, src[j], src[i]) < 0) {
            dst[k++] = src[j++];
          } else {
            dst[k++] = src[i++];
          }
        }
        while (i < mid) {
          dst[k++] = src[i++];
        }
        while (j < hi) {
          dst[k++] = src[j++];
        }
      }
      /** @type {int32[]} */
      const swap = src;
      src = dst;
      dst = swap;
    }
    for (let i = 0; i < n; i++) {
      sa[i] = src[i];
    }
  }

  class BurrowsWheelerTransform {
    /**
     * @param {uint8[]} data - Input bytes
     * @returns {BwtResult} Last column and original row
     */
    static forward(data) {
      /** @type {int32} */
      const n = data.length;
      if (n === 0) {
        /** @type {uint8[]} */
        const none = [];
        return new BwtResult(none, 0);
      }

      /** @type {int32[]} */
      const sa = new Array(n);
      for (let i = 0; i < n; ++i) {
        sa[i] = i;
      }

      // Full cyclic-rotation comparison sort, stable, so fully-tied rotations
      // (periodic input) keep their original relative (ascending index) order.
      sortRotations(data, sa);

      /** @type {uint8[]} */
      const transformed = new Array(n);
      /** @type {int32} */
      let index = 0;
      for (let i = 0; i < n; ++i) {
        if (sa[i] === 0) {
          index = i;
          transformed[i] = data[n - 1];
        } else {
          transformed[i] = data[sa[i] - 1];
        }
      }
      return new BwtResult(transformed, index);
    }

    /**
     * @param {uint8[]} data - Last column
     * @param {int32} index - Row of the original rotation
     * @returns {uint8[]} Original bytes
     */
    static inverse(data, index) {
      /** @type {int32} */
      const n = data.length;
      /** @type {uint8[]} */
      const result = new Array(n);
      if (n === 0) {
        return result;
      }

      /** @type {int32[]} */
      const count = new Int32Array(256);
      for (let i = 0; i < n; ++i) {
        ++count[data[i]];
      }

      /** @type {int32[]} */
      const cumulative = new Int32Array(256);
      /** @type {int32} */
      let sum = 0;
      for (let c = 0; c < 256; ++c) {
        cumulative[c] = sum;
        sum += count[c];
      }

      /** @type {int32[]} */
      const lfMap = new Array(n);
      /** @type {int32[]} */
      const tempCount = cumulative.slice();
      for (let i = 0; i < n; ++i) {
        lfMap[i] = tempCount[data[i]];
        ++tempCount[data[i]];
      }

      /** @type {int32} */
      let idx = index;
      for (let i = n - 1; i >= 0; --i) {
        result[i] = data[idx];
        idx = lfMap[idx];
      }
      return result;
    }
  }

  // ===== MOVE-TO-FRONT (matches Compression.Core.Transforms.MoveToFrontTransform) =====

  class MoveToFront {
    /**
     * @param {uint8[]} data - Bytes
     * @returns {uint8[]} Move-to-front ranks
     */
    static encode(data) {
      /** @type {uint8[]} */
      const alphabet = new Uint8Array(256);
      for (let i = 0; i < 256; ++i) {
        alphabet[i] = i;
      }

      /** @type {uint8[]} */
      const result = new Array(data.length);
      for (let i = 0; i < data.length; ++i) {
        /** @type {uint8} */
        const symbol = data[i];
        /** @type {int32} */
        let idx = 0;
        while (alphabet[idx] !== symbol) {
          ++idx;
        }
        result[i] = idx;

        if (idx > 0) {
          /** @type {int32} */
          const last = idx;
          for (let k = last; k > 0; --k) {
            alphabet[k] = alphabet[k - 1];
          }
          alphabet[0] = symbol;
        }
      }
      return result;
    }

    /**
     * @param {uint8[]} data - Move-to-front ranks
     * @returns {uint8[]} Bytes
     */
    static decode(data) {
      /** @type {uint8[]} */
      const alphabet = new Uint8Array(256);
      for (let i = 0; i < 256; ++i) {
        alphabet[i] = i;
      }

      /** @type {uint8[]} */
      const result = new Array(data.length);
      for (let i = 0; i < data.length; ++i) {
        /** @type {uint8} */
        const idx = data[i];
        /** @type {uint8} */
        const symbol = alphabet[idx];
        result[i] = symbol;

        if (idx > 0) {
          /** @type {int32} */
          const last = idx;
          for (let k = last; k > 0; --k) {
            alphabet[k] = alphabet[k - 1];
          }
          alphabet[0] = symbol;
        }
      }
      return result;
    }
  }

  // ===== MAIN BSC ALGORITHM =====

  class BSCAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "BSC (Block Sorting Compression)";
      this.description = "Burrows-Wheeler Transform, Move-to-Front recoding, and an LZMA-style adaptive bit-tree entropy stage (two trees selected by whether the previous rank was zero). Ported to be byte-for-byte identical to CompressionWorkbench's reduced BB_Bsc reference block.";
      this.inventor = "Ilya Grebnov (concept); reduced clean-room reimplementation";
      this.year = 2009;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "BWT + Entropy Coding";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.RU;

      this.documentation = [
        new LinkItem("libbsc Repository", "https://github.com/IlyaGrebnov/libbsc"),
        new LinkItem("bsc Discussion Thread", "https://encode.su/threads/586-bsc-new-block-sorting-compressor"),
        new LinkItem("Burrows-Wheeler Transform", "https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform")
      ];

      this.references = [
        new LinkItem("Burrows-Wheeler SRC-RR-124", "https://www.hpl.hp.com/techreports/Compaq-DEC/SRC-RR-124.pdf"),
        new LinkItem("LZMA Specification", "https://www.7-zip.org/sdk.html")
      ];

      this.tests = [
        {
          text: "Empty data test",
          uri: "https://github.com/IlyaGrebnov/libbsc",
          input: [],
          expected: [0, 0, 0, 0]
        },
        {
          text: "Single byte test",
          uri: "https://github.com/IlyaGrebnov/libbsc",
          input: [65]
        },
        {
          text: "Classic banana example",
          uri: "https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform",
          input: OpCodes.AnsiToBytes("banana")
        },
        {
          text: "Mixed alphanumeric data",
          uri: "https://encode.su/threads/586-bsc-new-block-sorting-compressor",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog")
        },
        {
          text: "Repetitive text compression",
          uri: "https://github.com/IlyaGrebnov/libbsc",
          input: OpCodes.AnsiToBytes("abcabcabcabcabcabc")
        }
      ];
    }

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - True to decompress
     * @returns {BSCInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new BSCInstance(this, isInverse);
    }
  }

  class BSCInstance extends IAlgorithmInstance {
    /**
     * @param {BSCAlgorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - True to decompress
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
    }

    /**
     * Compress or decompress the collected input
     * @returns {uint8[]} Output bytes
     */
    Result() {
      /** @type {uint8[]} */
      let result;
      if (this.isInverse) {
        result = this.decompress(this.inputBuffer);
      } else {
        result = this.compress(this.inputBuffer);
      }
      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;
      return result;
    }

    /**
     * @param {uint8[]} data - Input bytes
     * @returns {uint8[]} Size, BWT index and range-coded ranks
     */
    compress(data) {
      /** @type {uint8[]} */
      const result = OpCodes.Unpack32LE(data.length);
      if (data.length === 0) {
        return result;
      }

      /** @type {BwtResult} */
      const bwt = BurrowsWheelerTransform.forward(data);
      /** @type {uint8[]} */
      const mtf = MoveToFront.encode(bwt.transformed);
      /** @type {uint8[]} */
      const indexHeader = OpCodes.Unpack32LE(bwt.index);

      /** @type {RangeEncoder} */
      const encoder = new RangeEncoder();
      /** @type {BitTreeEncoder[]} */
      const trees = [new BitTreeEncoder(8), new BitTreeEncoder(8)];

      /** @type {int32} */
      let context = 0;
      for (let i = 0; i < mtf.length; i++) {
        /** @type {uint8} */
        const b = mtf[i];
        /** @type {BitTreeEncoder} */
        const tree = trees[context];
        tree.encode(encoder, b);
        context = b === 0 ? 0 : 1;
      }

      encoder.finish();
      for (let i = 0; i < indexHeader.length; i++) {
        result.push(indexHeader[i]);
      }
      /** @type {uint8[]} */
      const coded = encoder.output;
      for (let i = 0; i < coded.length; i++) {
        result.push(coded[i]);
      }
      return result;
    }

    /**
     * @param {uint8[]} compressedData - Size, BWT index and range-coded ranks
     * @returns {uint8[]} Decoded bytes
     */
    decompress(compressedData) {
      if (!compressedData || compressedData.length < 4) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      /** @type {uint32} */
      const size = OpCodes.Pack32LE(compressedData[0], compressedData[1], compressedData[2], compressedData[3]);
      if (size === 0) {
        /** @type {uint8[]} */
        const none = [];
        return none;
      }

      if (compressedData.length < 8) {
        throw new Error('Invalid BSC compressed data: too short');
      }

      /** @type {uint32} */
      const index = OpCodes.Pack32LE(compressedData[4], compressedData[5], compressedData[6], compressedData[7]);
      /** @type {uint8[]} */
      const rest = compressedData.slice(8);

      /** @type {RangeDecoder} */
      const decoder = new RangeDecoder(rest);
      /** @type {BitTreeDecoder[]} */
      const trees = [new BitTreeDecoder(8), new BitTreeDecoder(8)];

      /** @type {uint8[]} */
      const mtf = new Array(size);
      /** @type {int32} */
      let context = 0;
      for (let i = 0; i < size; ++i) {
        /** @type {BitTreeDecoder} */
        const tree = trees[context];
        /** @type {int32} */
        const b = tree.decode(decoder);
        mtf[i] = b;
        context = b === 0 ? 0 : 1;
      }

      /** @type {uint8[]} */
      const bwt = MoveToFront.decode(mtf);
      /** @type {uint8[]} */
      const restored = BurrowsWheelerTransform.inverse(bwt, index);
      return restored;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new BSCAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return {
    BSCAlgorithm,
    BSCInstance,
    BurrowsWheelerTransform,
    MoveToFront,
    RangeEncoder,
    RangeDecoder,
    BitTreeEncoder,
    BitTreeDecoder
  };
}));
