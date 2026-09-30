/*
 * Delta + RLE Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * Educational implementation of difference-based encoding followed by
 * run-length encoding of the delta stream. This is a compressing variant -
 * for the pure, size-preserving delta transform (no RLE pass), see
 * delta-filter.js / "Delta Filter".
 * (c)2006-2025 Hawkynt
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

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * DeltaCompression - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class DeltaCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Delta + RLE";
        this.description = "Difference-based transform (stores differences between consecutive values) followed by run-length encoding of the delta stream, so unlike the pure delta filter this actually compresses. Effective for data with small variations like audio samples, image gradients, or time series, and for long runs of a constant or steadily-changing value. See 'Delta Filter' for the non-compressing, size-preserving variant.";
        this.inventor = "Various (general technique)";
        this.year = 1950;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Transform";
        this.securityStatus = null;
        this.complexity = ComplexityType.SIMPLE;
        this.country = CountryCode.UNKNOWN;

        // Documentation and references
        this.documentation = [
          new LinkItem("Delta Encoding - Wikipedia", "https://en.wikipedia.org/wiki/Delta_encoding"),
          new LinkItem("PNG Delta Filters", "http://libpng.org/pub/png/spec/1.2/PNG-Filters.html"),
          new LinkItem("Time Series Compression", "https://www.vldb.org/pvldb/vol8/p1816-pelkonen.pdf")
        ];

        this.references = [
          new LinkItem("PNG Reference Implementation", "http://libpng.org/pub/png/libpng.html"),
          new LinkItem("TIFF Differencing Predictor", "https://www.adobe.io/open/standards/TIFF.html"),
          new LinkItem("InfluxDB Time Series Delta", "https://docs.influxdata.com/influxdb/v1.8/concepts/storage_engine/")
        ];

        // Test vectors with actual delta encoded outputs
        this.tests = [
          {
            text: "Empty data test",
            uri: "Edge case test",
            input: [], 
            expected: [] // Empty input produces empty output
          },
          {
            text: "Single byte test",
            uri: "Minimal delta test",
            input: [65], // "A"
            expected: [65] // First byte unchanged in delta encoding
          },
          {
            text: "Incrementing sequence - ideal for delta compression",
            uri: "https://en.wikipedia.org/wiki/Delta_encoding",
            input: [10, 12, 14, 16], // Small, consistent deltas
            expected: [10, 255, 3, 2] // Delta encoded output from current implementation
          }
        ];
      }

      /**
       * Create a new instance
       * @param {boolean} [isInverse=false] - True to decompress
       * @returns {DeltaInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new DeltaInstance(this, isInverse);
      }
    }

    class DeltaInstance extends IAlgorithmInstance {
      /**
       * @param {DeltaCompression} algorithm - Parent algorithm
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
        if (this.inputBuffer.length === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }

        if (this.isInverse) {
          return this._decompress();
        } else {
          return this._compress();
        }
      }

      /**
       * @returns {uint8[]} RLE-packed deltas
       */
      _compress() {
        /** @type {uint8[]} */
        const deltaData = [];
        if (this.inputBuffer.length === 0) {
          return deltaData;
        }

        // Apply delta transformation

        // First byte stays the same
        deltaData.push(this.inputBuffer[0]);

        // Subsequent bytes are differences from previous
        for (let i = 1; i < this.inputBuffer.length; i++) {
          /** @type {int32} */
          let delta = this.inputBuffer[i] - this.inputBuffer[i - 1];

          // Handle wraparound for signed differences
          if (delta > 127) {
            delta -= 256;
          } else if (delta < -128) {
            delta += 256;
          }

          // Convert to unsigned byte
          delta = (delta + 256) % 256;
          deltaData.push(delta);
        }

        // Apply simple RLE compression to the delta data
        /** @type {uint8[]} */
        const compressed = this._applyRLE(deltaData);

        // Clear input buffer
        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;

        return compressed;
      }

      /**
       * @returns {uint8[]} Restored bytes
       */
      _decompress() {
        /** @type {uint8[]} */
        const result = [];
        if (this.inputBuffer.length === 0) {
          return result;
        }

        // Decompress RLE first
        /** @type {uint8[]} */
        const deltaData = this._decompressRLE(this.inputBuffer);

        if (deltaData.length === 0) {
          return result;
        }

        // Apply inverse delta transformation

        // First byte stays the same
        result.push(deltaData[0]);

        // Reconstruct original values from deltas
        for (let i = 1; i < deltaData.length; i++) {
          /** @type {int32} */
          let delta = deltaData[i];

          // Convert from unsigned to signed
          if (delta > 127) {
            delta -= 256;
          }

          // Add delta to previous value
          /** @type {int32} */
          let value = result[i - 1] + delta;

          // Handle wraparound
          value = (value + 256) % 256;
          result.push(value);
        }

        // Clear input buffer
        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;

        return result;
      }

      /**
       * Append one (marker, count, value) run
       * @param {uint8[]} result - Output
       * @param {int32} count - Run length
       * @param {uint8} value - Run value
       */
      _pushRun(result, count, value) {
        result.push(255); // RLE marker
        result.push(count);
        result.push(value);
      }

      /**
       * @param {uint8[]} data - Delta bytes
       * @returns {uint8[]} Runs packed as 255, count, value
       */
      _applyRLE(data) {
        if (data.length === 0) {
          return data;
        }

        /** @type {uint8[]} */
        const result = [];
        /** @type {int32} */
        let count = 1;
        /** @type {uint8} */
        let current = data[0];

        for (let i = 1; i < data.length; i++) {
          if (data[i] === current && count < 255) {
            count++;
          } else {
            // Write run
            if (count > 1) {
              this._pushRun(result, count, current);
            } else {
              // Single occurrence, but avoid conflict with RLE marker
              if (current === 255) {
                this._pushRun(result, 1, 255); // Encoded single 255
              } else {
                result.push(current);
              }
            }
            current = data[i];
            count = 1;
          }
        }

        // Handle final run
        if (count > 1) {
          this._pushRun(result, count, current);
        } else {
          if (current === 255) {
            this._pushRun(result, 1, 255);
          } else {
            result.push(current);
          }
        }

        return result;
      }

      /**
       * @param {uint8[]} data - Runs packed as 255, count, value
       * @returns {uint8[]} Delta bytes
       */
      _decompressRLE(data) {
        if (data.length === 0) {
          return data;
        }

        /** @type {uint8[]} */
        const result = [];
        /** @type {int32} */
        let i = 0;

        while (i < data.length) {
          if (data[i] === 255 && i + 2 < data.length) {
            // RLE encoded run
            /** @type {uint8} */
            const count = data[i + 1];
            /** @type {uint8} */
            const value = data[i + 2];

            for (let j = 0; j < count; j++) {
              result.push(value);
            }
            i += 3;
          } else {
            // Single value
            result.push(data[i]);
            i++;
          }
        }

        return result;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new DeltaCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DeltaCompression, DeltaInstance };
}));