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

  /** @type {int32} */
  const MAX_DEPTH = 2;

  // Context identifier spaces: order-0 occupies id 0, order-1 occupies
  // 0x100..0x1FF and order-2 occupies 0x10100..0x200FF, so the three orders
  // never collide inside the single context dictionary.
  /** @type {int32} */
  const CTX_ORDER1_BASE = 0x100;
  /** @type {int32} */
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

      /**
       * Create a new instance
       * @param {boolean} [isInverse=false] - True to decompress
       * @returns {CTWInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new CTWInstance(this, isInverse);
      }
    }

    /** @type {int32} */
    const CONTEXT_ID_COUNT = CTX_ORDER2_BASE + 0x10000; // ids 0 .. 0x200FF

    /**
     * Symbol counts of one context, with the symbols kept in first-seen order
     * so that ties between equally frequent symbols always resolve to the
     * earliest observed one.
     */
    class ContextFrequencies {
      constructor() {
        /** @type {uint8[]} */
        this.symbols = [];
        /** @type {int32[]} */
        this.counts = new Int32Array(256);
      }
    }

    /**
     * Frequency table for every context, preserving first-seen order so that
     * ties between equally frequent symbols always resolve to the earliest
     * observed one.
     */
    class ContextModel {
      constructor() {
        /** @type {ContextFrequencies[]} */
        this.contexts = new Array(CONTEXT_ID_COUNT);
        for (let i = 0; i < CONTEXT_ID_COUNT; i++) {
          this.contexts[i] = null;
        }
      }

      /**
       * Returns the most frequent symbol of a context, or -1 when unseen.
       * @param {int32} contextId - Context identifier
       * @returns {int32} Symbol, or -1
       */
      mostFrequent(contextId) {
        /** @type {ContextFrequencies} */
        const freqs = this.contexts[contextId];
        if (freqs === null || freqs.symbols.length === 0) {
          return -1;
        }

        /** @type {int32} */
        let bestSymbol = -1;
        /** @type {int32} */
        let bestCount = 0;
        for (let k = 0; k < freqs.symbols.length; k++) {
          /** @type {uint8} */
          const symbol = freqs.symbols[k];
          if (freqs.counts[symbol] > bestCount) {
            bestCount = freqs.counts[symbol];
            bestSymbol = symbol;
          }
        }

        return bestSymbol;
      }

      /**
       * Count one more occurrence of a symbol in a context
       * @param {int32} contextId - Context identifier
       * @param {uint8} symbol - Observed symbol
       */
      update(contextId, symbol) {
        /** @type {ContextFrequencies} */
        let freqs = this.contexts[contextId];
        if (freqs === null) {
          freqs = new ContextFrequencies();
          this.contexts[contextId] = freqs;
        }
        if (freqs.counts[symbol] === 0) {
          freqs.symbols.push(symbol);
        }
        freqs.counts[symbol] = freqs.counts[symbol] + 1;
      }
    }

    class CTWInstance extends IAlgorithmInstance {
      /**
       * @param {CTWAlgorithm} algorithm - Parent algorithm
       * @param {boolean} [isInverse=false] - True to decompress
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        /** @type {boolean} */
        this.isInverse = isInverse; // true = decompress, false = compress
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
       * @param {uint8[]} data - Input bytes (a missing array counts as empty)
       * @returns {uint8[]} Header, hit flags and mispredicted bytes
       */
      compress(data) {
        /** @type {uint8[]} */
        let src = data;
        if (!src) {
          src = [];
        }
        /** @type {int32} */
        const n = src.length;

        // Header: 4-byte little-endian original size, 1-byte maximum order.
        /** @type {uint8[]} */
        const output = OpCodes.Unpack32LE(n);
        output.push(MAX_DEPTH);

        if (n === 0) {
          return output;
        }

        /** @type {ContextModel} */
        const model = new ContextModel();
        /** @type {uint8[]} */
        const hits = new Uint8Array(n);
        /** @type {uint8[]} */
        const missSymbols = [];

        for (let i = 0; i < n; ++i) {
          /** @type {uint8} */
          const symbol = src[i];
          /** @type {int32} */
          const predicted = this._predict(model, src, i);

          if (predicted === symbol) {
            hits[i] = 1;
          } else {
            missSymbols.push(symbol);
          }

          this._learn(model, src, i, symbol);
        }

        // Pack the hit/miss flags, MSB first within each byte.
        /** @type {int32} */
        const flagByteCount = Math.floor((n + 7) / 8);
        for (let byteIdx = 0; byteIdx < flagByteCount; ++byteIdx) {
          /** @type {uint32} */
          let flagByte = 0;
          for (let bit = 0; bit < 8; ++bit) {
            /** @type {int32} */
            const srcIdx = byteIdx * 8 + bit;
            if (srcIdx < n && hits[srcIdx] === 1) {
              flagByte = OpCodes.And32(OpCodes.Or32(flagByte, OpCodes.Shr32(0x80, bit)), 0xFF);
            }
          }
          output.push(flagByte);
        }

        for (let k = 0; k < missSymbols.length; k++) {
          output.push(missSymbols[k]);
        }

        return output;
      }

      /**
       * @param {uint8[]} data - Header, hit flags and mispredicted bytes
       * @returns {uint8[]} Decoded bytes
       */
      decompress(data) {
        /** @type {uint8[]} */
        let bytes = data;
        if (!bytes) {
          bytes = [];
        }
        /** @type {uint8[]} */
        const dst = [];
        if (bytes.length < 5) {
          return dst;
        }

        // float64: the size may be up to 2^32 - 1 and the flag count adds 7 to it
        /** @type {float64} */
        const originalSize = OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
        // bytes[4] carries the maximum context order (currently always 2).
        if (originalSize === 0) {
          return dst;
        }

        /** @type {int32} */
        const base = 5;
        /** @type {int32} */
        const flagByteCount = Math.floor((originalSize + 7) / 8);
        if (bytes.length - base < flagByteCount) {
          throw new Error('Unexpected end of context-predictor flag data');
        }

        /** @type {ContextModel} */
        const model = new ContextModel();
        /** @type {int32} */
        let missPos = base + flagByteCount;

        for (let i = 0; i < originalSize; ++i) {
          /** @type {int32} */
          const byteIdx = base + Math.floor(i / 8);
          /** @type {int32} */
          const bitIdx = i % 8;
          /** @type {boolean} */
          const isHit = OpCodes.And32(bytes[byteIdx], OpCodes.Shr32(0x80, bitIdx)) !== 0;

          /** @type {int32} */
          let symbol = 0;
          if (isHit) {
            symbol = this._predict(model, dst, dst.length);
          } else {
            if (missPos >= bytes.length) {
              throw new Error('Unexpected end of context-predictor miss data');
            }
            symbol = bytes[missPos++];
          }

          dst.push(symbol);

          this._learn(model, dst, dst.length - 1, symbol);
        }

        return dst;
      }

      /**
       * Count the byte at position idx in its order-0, order-1 and order-2
       * contexts (as far as the data before it reaches).
       * @param {ContextModel} model - Model
       * @param {uint8[]} data - Bytes up to at least idx
       * @param {int32} idx - Position of the byte
       * @param {uint8} symbol - The byte
       */
      _learn(model, data, idx, symbol) {
        model.update(0, symbol);
        if (idx >= 1) {
          /** @type {int32} */
          const prev1 = data[idx - 1];
          model.update(CTX_ORDER1_BASE + prev1, symbol);
          if (idx >= 2) {
            /** @type {int32} */
            const prev2 = data[idx - 2];
            model.update(CTX_ORDER2_BASE + prev2 * 256 + prev1, symbol);
          }
        }
      }

      /**
       * Predicts the byte at position pos from the deepest context that has
       * already been observed: order-2, then order-1, then order-0, then zero.
       * @param {ContextModel} model - Model
       * @param {uint8[]} data - Bytes before pos
       * @param {int32} pos - Position to predict
       * @returns {int32} Predicted byte
       */
      _predict(model, data, pos) {
        if (pos >= 2) {
          /** @type {int32} */
          const prev2 = data[pos - 2];
          /** @type {int32} */
          const prev1 = data[pos - 1];
          /** @type {int32} */
          const pred2 = model.mostFrequent(CTX_ORDER2_BASE + prev2 * 256 + prev1);
          if (pred2 >= 0) {
            return pred2;
          }
        }
        if (pos >= 1) {
          /** @type {int32} */
          const prev1 = data[pos - 1];
          /** @type {int32} */
          const pred1 = model.mostFrequent(CTX_ORDER1_BASE + prev1);
          if (pred1 >= 0) {
            return pred1;
          }
        }
        /** @type {int32} */
        const pred = model.mostFrequent(0);
        if (pred >= 0) {
          return pred;
        }

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
