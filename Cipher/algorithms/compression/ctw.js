/*
 * Context Predictor (order-2/1/0) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * A most-frequent-symbol predictor over an order-2/1/0 byte context hierarchy.
 * Each input byte is predicted from the most frequently observed symbol in the
 * deepest context that has been seen before; a hit/miss bitmap plus the literal
 * bytes of the misses form the payload.
 *
 * Despite the historical "CTW" block name this is NOT the Context Tree Weighting
 * method of Willems, Shtarkov and Tjalkens - see ctw-willems.js for that.
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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== FORMAT CONSTANTS =====

  const MAX_DEPTH = 2;

  // Context identifier spaces: order-0 occupies id 0, order-1 occupies
  // 0x100..0x1FF and order-2 occupies 0x10100..0x200FF, so the three orders
  // never collide inside the single context dictionary.
  const CTX_ORDER1_BASE = 0x100;
  const CTX_ORDER2_BASE = 0x10100;

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * CTWAlgorithm - Compression algorithm implementation
   * @class
   * @extends {CompressionAlgorithm}
   */

  class CTWAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        // NOTE: despite the legacy name this predates, this is NOT the Context
        // Tree Weighting method of Willems, Shtarkov and Tjalkens: it has no
        // Krichevsky-Trofimov estimator, no binary context tree and no
        // recursive weighting between a node's own estimate and its
        // children. It is a simple most-frequent-symbol predictor over an
        // order-2/1/0 byte context hierarchy. See "Context Tree Weighting
        // (Willems)" in ctw-willems.js for a genuine implementation of the
        // CTW method.
        this.name = "Context Predictor (order-2/1/0)";
        this.description = "Most-frequent-symbol predictor over an order-2/1/0 byte context hierarchy with a hit/miss bitmap. Not the Context Tree Weighting (CTW) method despite the legacy name this block previously used.";
        this.inventor = "Unknown (educational most-frequent-symbol predictor)";
        this.year = 1995;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Statistical";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.NL; // Netherlands

        // Documentation and references
        this.documentation = [
          new LinkItem("Context modeling - Wikipedia", "https://en.wikipedia.org/wiki/Context_mixing"),
          new LinkItem("Prediction by Partial Matching", "https://en.wikipedia.org/wiki/Prediction_by_partial_matching")
        ];

        this.references = [
          new LinkItem("Statistical Compression Survey", "https://homepages.cwi.nl/~paulv/papers/statsmodcourse.pdf"),
          new LinkItem("Data Compression Course", "https://web.stanford.edu/class/ee398a/")
        ];

        // Wire format (byte-identical to CompressionWorkbench's BB_CTW):
        //   4 bytes uncompressed size (little-endian)
        //   1 byte  maximum context order (always 2)
        //   ceil(n/8) flag bytes, MSB-first, bit set = the prediction was correct
        //   the literal bytes of every mispredicted position, in order
        this.tests = [
          {
            input: [],
            expected: [0, 0, 0, 0, 2],
            text: "Empty input",
            uri: "https://en.wikipedia.org/wiki/Context_mixing"
          },
          {
            input: OpCodes.AnsiToBytes("A"),
            expected: [1, 0, 0, 0, 2, 0, 65],
            text: "Single byte - the empty model predicts zero, so it misses",
            uri: "https://en.wikipedia.org/wiki/Context_mixing"
          },
          {
            input: OpCodes.AnsiToBytes("0"),
            expected: [1, 0, 0, 0, 2, 0, 48],
            text: "Single character",
            uri: "https://en.wikipedia.org/wiki/Context_mixing"
          },
          {
            input: OpCodes.AnsiToBytes("01"),
            expected: [2, 0, 0, 0, 2, 0, 48, 49],
            text: "Two symbols",
            uri: "https://en.wikipedia.org/wiki/Context_mixing"
          },
          {
            input: OpCodes.AnsiToBytes("0101"),
            expected: [4, 0, 0, 0, 2, 48, 48, 49],
            text: "Alternating pattern - the order-1 context predicts the tail",
            uri: "https://en.wikipedia.org/wiki/Context_mixing"
          },
          {
            input: OpCodes.AnsiToBytes("00110011"),
            expected: [8, 0, 0, 0, 2, 71, 48, 49, 49, 48],
            text: "Structured pattern",
            uri: "https://en.wikipedia.org/wiki/Context_mixing"
          },
          {
            input: OpCodes.AnsiToBytes("abcabc"),
            expected: [6, 0, 0, 0, 2, 28, 97, 98, 99],
            text: "Repeating sequence",
            uri: "https://en.wikipedia.org/wiki/Context_mixing"
          },
          {
            input: OpCodes.AnsiToBytes("aaaaaaaaaaaaaaaa"),
            expected: [16, 0, 0, 0, 2, 127, 255, 97],
            text: "Run of one byte - every position after the first is predicted",
            uri: "https://en.wikipedia.org/wiki/Context_mixing"
          }
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new CTWInstance(this, isInverse);
      }
    }

    /**
     * Frequency table for one context, preserving first-seen order so that ties
     * between equally frequent symbols always resolve to the earliest observed
     * one (JavaScript Map iterates in insertion order).
     */
    class ContextModel {
      constructor() {
        this.contexts = new Map();
      }

      /** Returns the most frequent symbol of a context, or -1 when unseen. */
      mostFrequent(contextId) {
        const freqs = this.contexts.get(contextId);
        if (freqs === undefined || freqs.size === 0)
          return -1;

        let bestSymbol = -1;
        let bestCount = 0;
        for (const entry of freqs)
          if (entry[1] > bestCount) {
            bestCount = entry[1];
            bestSymbol = entry[0];
          }

        return bestSymbol;
      }

      update(contextId, symbol) {
        let freqs = this.contexts.get(contextId);
        if (freqs === undefined) {
          freqs = new Map();
          this.contexts.set(contextId, freqs);
        }
        const current = freqs.get(symbol);
        freqs.set(symbol, (current === undefined ? 0 : current) + 1);
      }
    }

    class CTWInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse; // true = decompress, false = compress
        this.inputBuffer = [];
      }


      Result() {
        const result = this.isInverse
          ? this.decompress(this.inputBuffer)
          : this.compress(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      }

      compress(data) {
        const src = data || [];
        const n = src.length;
        const output = [];

        // Header: 4-byte little-endian original size, 1-byte maximum order.
        output.push(n&0xFF);
        output.push(OpCodes.Shr32(n, 8)&0xFF);
        output.push(OpCodes.Shr32(n, 16)&0xFF);
        output.push(OpCodes.Shr32(n, 24)&0xFF);
        output.push(MAX_DEPTH);

        if (n === 0)
          return output;

        const model = new ContextModel();
        const hits = new Uint8Array(n);
        const missSymbols = [];

        for (let i = 0; i < n; ++i) {
          const symbol = src[i];
          const predicted = this._predict(model, src, i);

          if (predicted === symbol)
            hits[i] = 1;
          else
            missSymbols.push(symbol);

          model.update(0, symbol);
          if (i >= 1) model.update(CTX_ORDER1_BASE + src[i - 1], symbol);
          if (i >= 2) model.update(CTX_ORDER2_BASE + src[i - 2] * 256 + src[i - 1], symbol);
        }

        // Pack the hit/miss flags, MSB first within each byte.
        const flagByteCount = Math.floor((n + 7) / 8);
        for (let byteIdx = 0; byteIdx < flagByteCount; ++byteIdx) {
          let flagByte = 0;
          for (let bit = 0; bit < 8; ++bit) {
            const srcIdx = byteIdx * 8 + bit;
            if (srcIdx < n && hits[srcIdx] === 1)
              flagByte = OpCodes.Or32(flagByte, OpCodes.Shr32(0x80, bit))&0xFF;
          }
          output.push(flagByte);
        }

        for (let _i = 0; _i < missSymbols.length; _i++) output.push(missSymbols[_i]);

        return output;
      }

      decompress(data) {
        const bytes = data || [];
        if (bytes.length < 5)
          return [];

        const originalSize = OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
        // bytes[4] carries the maximum context order (currently always 2).
        if (originalSize === 0)
          return [];

        const base = 5;
        const flagByteCount = Math.floor((originalSize + 7) / 8);
        if (bytes.length - base < flagByteCount)
          throw new Error('Unexpected end of context-predictor flag data');

        const model = new ContextModel();
        const dst = [];
        let missPos = base + flagByteCount;

        for (let i = 0; i < originalSize; ++i) {
          const byteIdx = base + Math.floor(i / 8);
          const bitIdx = i % 8;
          const isHit = OpCodes.And32(bytes[byteIdx], OpCodes.Shr32(0x80, bitIdx)) !== 0;

          let symbol;
          if (isHit) {
            symbol = this._predict(model, dst, dst.length);
          } else {
            if (missPos >= bytes.length)
              throw new Error('Unexpected end of context-predictor miss data');
            symbol = bytes[missPos++];
          }

          dst.push(symbol);

          const idx = dst.length - 1;
          model.update(0, symbol);
          if (idx >= 1) model.update(CTX_ORDER1_BASE + dst[idx - 1], symbol);
          if (idx >= 2) model.update(CTX_ORDER2_BASE + dst[idx - 2] * 256 + dst[idx - 1], symbol);
        }

        return dst;
      }

      /**
       * Predicts the byte at position pos from the deepest context that has
       * already been observed: order-2, then order-1, then order-0, then zero.
       */
      _predict(model, data, pos) {
        if (pos >= 2) {
          const pred = model.mostFrequent(CTX_ORDER2_BASE + data[pos - 2] * 256 + data[pos - 1]);
          if (pred >= 0) return pred;
        }
        if (pos >= 1) {
          const pred = model.mostFrequent(CTX_ORDER1_BASE + data[pos - 1]);
          if (pred >= 0) return pred;
        }
        const pred = model.mostFrequent(0);
        if (pred >= 0) return pred;

        return 0;
      }
    }

  // ===== REGISTRATION =====

    const algorithmInstance = new CTWAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { CTWAlgorithm, CTWInstance };
}));
