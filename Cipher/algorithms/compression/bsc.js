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

  const RC_BIT_MODEL_TOTAL_BITS = 11;
  const RC_BIT_MODEL_TOTAL = OpCodes.Shl32(1, RC_BIT_MODEL_TOTAL_BITS); // 2048
  const RC_NUM_MOVE_BITS = 5;
  const RC_TOP_VALUE = OpCodes.Shl32(1, 24);
  const RC_PROB_INIT_VALUE = RC_BIT_MODEL_TOTAL / 2; // 1024

  class RangeEncoder {
    constructor() {
      this.range = 0xFFFFFFFF;
      this.low = 0; // may transiently exceed 32 bits (carry); truncated on each shiftLow
      this.cacheSize = 1;
      this.cache = 0;
      this.output = [];
    }
    encodeBit(probs, idx, bit) {
      const bound = OpCodes.ToUint32(OpCodes.Shr32(this.range, RC_BIT_MODEL_TOTAL_BITS) * probs[idx]);
      if (bit === 0) {
        this.range = bound;
        probs[idx] += Math.floor((RC_BIT_MODEL_TOTAL - probs[idx]) / OpCodes.Shl32(1, RC_NUM_MOVE_BITS));
      } else {
        this.low += bound;
        this.range -= bound;
        probs[idx] -= Math.floor(probs[idx] / OpCodes.Shl32(1, RC_NUM_MOVE_BITS));
      }
      this._normalize();
    }
    finish() {
      for (let i = 0; i < 5; ++i) this._shiftLow();
    }
    _normalize() {
      if (this.range >= RC_TOP_VALUE) return;
      this.range = OpCodes.Shl32(this.range, 8);
      this._shiftLow();
    }
    _shiftLow() {
      const carry = Math.floor(this.low / 4294967296); // this.low >> 32
      if (this.low < 0xFF000000 || carry !== 0) {
        let temp = this.cache;
        do {
          this.output.push(OpCodes.And32(temp + carry, 0xFF));
          temp = 0xFF;
        } while (--this.cacheSize > 0);
        this.cache = OpCodes.And32(Math.floor(OpCodes.ToUint32(this.low) / 16777216), 0xFF);
      }
      ++this.cacheSize;
      this.low = OpCodes.Shl32(this.low, 8);
    }
  }

  class RangeDecoder {
    constructor(bytes) {
      this.input = bytes;
      this.pos = 0;
      this.range = 0xFFFFFFFF;
      this.code = 0;
      this._readByte(); // leading 0x00 byte, discarded (matches RangeEncoder's initial cache)
      for (let i = 0; i < 4; ++i)
        this.code = OpCodes.Or32(OpCodes.Shl32(this.code, 8), this._readByte());
    }
    _readByte() {
      return this.pos < this.input.length ? this.input[this.pos++] : 0;
    }
    decodeBit(probs, idx) {
      const bound = OpCodes.ToUint32(OpCodes.Shr32(this.range, RC_BIT_MODEL_TOTAL_BITS) * probs[idx]);
      let bit;
      if (this.code < bound) {
        this.range = bound;
        probs[idx] += Math.floor((RC_BIT_MODEL_TOTAL - probs[idx]) / OpCodes.Shl32(1, RC_NUM_MOVE_BITS));
        bit = 0;
      } else {
        this.code -= bound;
        this.range -= bound;
        probs[idx] -= Math.floor(probs[idx] / OpCodes.Shl32(1, RC_NUM_MOVE_BITS));
        bit = 1;
      }
      this._normalize();
      return bit;
    }
    _normalize() {
      if (this.range >= RC_TOP_VALUE) return;
      this.range = OpCodes.Shl32(this.range, 8);
      this.code = OpCodes.Or32(OpCodes.Shl32(this.code, 8), this._readByte());
    }
  }

  class BitTreeEncoder {
    constructor(numBits) {
      this.numBits = numBits;
      this.probs = new Int32Array(OpCodes.Shl32(1, numBits)).fill(RC_PROB_INIT_VALUE);
    }
    encode(encoder, value) {
      let index = 1;
      for (let i = this.numBits - 1; i >= 0; --i) {
        const bit = OpCodes.And32(OpCodes.Shr32(value, i), 1);
        encoder.encodeBit(this.probs, index, bit);
        index = OpCodes.Or32(OpCodes.Shl32(index, 1), bit);
      }
    }
  }

  class BitTreeDecoder {
    constructor(numBits) {
      this.numBits = numBits;
      this.probs = new Int32Array(OpCodes.Shl32(1, numBits)).fill(RC_PROB_INIT_VALUE);
    }
    decode(decoder) {
      let index = 1;
      for (let i = 0; i < this.numBits; ++i) {
        const bit = decoder.decodeBit(this.probs, index);
        index = OpCodes.Or32(OpCodes.Shl32(index, 1), bit);
      }
      return index - OpCodes.Shl32(1, this.numBits);
    }
  }

  // ===== BURROWS-WHEELER TRANSFORM (matches Compression.Core.Transforms.BurrowsWheelerTransform) =====

  class BurrowsWheelerTransform {
    static forward(data) {
      const n = data.length;
      if (n === 0) return { transformed: [], index: 0 };

      const sa = new Array(n);
      for (let i = 0; i < n; ++i) sa[i] = i;

      // Full cyclic-rotation comparison sort. JS Array.prototype.sort is a
      // stable sort, so fully-tied rotations (periodic input) keep their
      // original relative (ascending index) order.
      sa.sort((a, b) => {
        for (let k = 0; k < n; ++k) {
          const da = data[(a + k) % n];
          const db = data[(b + k) % n];
          if (da !== db) return da - db;
        }
        return 0;
      });

      const transformed = new Array(n);
      let index = 0;
      for (let i = 0; i < n; ++i) {
        if (sa[i] === 0) { index = i; transformed[i] = data[n - 1]; }
        else transformed[i] = data[sa[i] - 1];
      }
      return { transformed, index };
    }

    static inverse(data, index) {
      const n = data.length;
      if (n === 0) return [];

      const count = new Array(256).fill(0);
      for (let i = 0; i < n; ++i) ++count[data[i]];

      const cumulative = new Array(256).fill(0);
      let sum = 0;
      for (let c = 0; c < 256; ++c) { cumulative[c] = sum; sum += count[c]; }

      const lfMap = new Array(n);
      const tempCount = cumulative.slice();
      for (let i = 0; i < n; ++i) { lfMap[i] = tempCount[data[i]]; ++tempCount[data[i]]; }

      const result = new Array(n);
      let idx = index;
      for (let i = n - 1; i >= 0; --i) { result[i] = data[idx]; idx = lfMap[idx]; }
      return result;
    }
  }

  // ===== MOVE-TO-FRONT (matches Compression.Core.Transforms.MoveToFrontTransform) =====

  class MoveToFront {
    static encode(data) {
      const alphabet = new Uint8Array(256);
      for (let i = 0; i < 256; ++i) alphabet[i] = i;

      const result = new Array(data.length);
      for (let i = 0; i < data.length; ++i) {
        const symbol = data[i];
        let idx = 0;
        while (alphabet[idx] !== symbol) ++idx;
        result[i] = idx;

        if (idx > 0) {
          for (let k = idx; k > 0; --k) alphabet[k] = alphabet[k - 1];
          alphabet[0] = symbol;
        }
      }
      return result;
    }

    static decode(data) {
      const alphabet = new Uint8Array(256);
      for (let i = 0; i < 256; ++i) alphabet[i] = i;

      const result = new Array(data.length);
      for (let i = 0; i < data.length; ++i) {
        const idx = data[i];
        const symbol = alphabet[idx];
        result[i] = symbol;

        if (idx > 0) {
          for (let k = idx; k > 0; --k) alphabet[k] = alphabet[k - 1];
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

    CreateInstance(isInverse = false) {
      return new BSCInstance(this, isInverse);
    }
  }

  class BSCInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }


    Result() {
      const result = this.isInverse ?
        this.decompress(this.inputBuffer) :
        this.compress(this.inputBuffer);

      this.inputBuffer = [];
      return result;
    }

    compress(data) {
      const header = OpCodes.Unpack32LE(data.length);
      if (data.length === 0) return header;

      const bwt = BurrowsWheelerTransform.forward(data);
      const mtf = MoveToFront.encode(bwt.transformed);
      const indexHeader = OpCodes.Unpack32LE(bwt.index);

      const encoder = new RangeEncoder();
      const trees = [new BitTreeEncoder(8), new BitTreeEncoder(8)];

      let context = 0;
      for (const b of mtf) {
        trees[context].encode(encoder, b);
        context = b === 0 ? 0 : 1;
      }

      encoder.finish();
      return [...header, ...indexHeader, ...encoder.output];
    }

    decompress(compressedData) {
      if (!compressedData || compressedData.length < 4)
        return [];

      const size = OpCodes.Pack32LE(compressedData[0], compressedData[1], compressedData[2], compressedData[3]);
      if (size === 0) return [];

      if (compressedData.length < 8)
        throw new Error('Invalid BSC compressed data: too short');

      const index = OpCodes.Pack32LE(compressedData[4], compressedData[5], compressedData[6], compressedData[7]);
      const rest = compressedData.slice(8);

      const decoder = new RangeDecoder(rest);
      const trees = [new BitTreeDecoder(8), new BitTreeDecoder(8)];

      const mtf = new Array(size);
      let context = 0;
      for (let i = 0; i < size; ++i) {
        const b = trees[context].decode(decoder);
        mtf[i] = b;
        context = b === 0 ? 0 : 1;
      }

      const bwt = MoveToFront.decode(mtf);
      return BurrowsWheelerTransform.inverse(bwt, index);
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
