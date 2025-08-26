/*
 * Delta Encoding Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * Educational implementation of difference-based encoding
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

  class DeltaCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Delta Encoding";
        this.description = "Difference-based transform that stores differences between consecutive values. Effective for data with small variations like audio samples, image gradients, or time series.";
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

      CreateInstance(isInverse = false) {
        return new DeltaInstance(this, isInverse);
      }
    }

    class DeltaInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
      }

      Result() {
        if (this.inputBuffer.length === 0) {
          return [];
        }

        if (this.isInverse) {
          return this._decompress();
        } else {
          return this._compress();
        }
      }

      _compress() {
        if (this.inputBuffer.length === 0) {
          return [];
        }

        // Apply delta transformation
        const deltaData = [];

        // First byte stays the same
        deltaData.push(this.inputBuffer[0]);

        // Subsequent bytes are differences from previous
        for (let i = 1; i < this.inputBuffer.length; i++) {
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
        const compressed = this._applyRLE(deltaData);

        // Clear input buffer
        this.inputBuffer = [];

        return compressed;
      }

      _decompress() {
        if (this.inputBuffer.length === 0) {
          return [];
        }

        // Decompress RLE first
        const deltaData = this._decompressRLE(this.inputBuffer);

        if (deltaData.length === 0) {
          return [];
        }

        // Apply inverse delta transformation
        const result = [];

        // First byte stays the same
        result.push(deltaData[0]);

        // Reconstruct original values from deltas
        for (let i = 1; i < deltaData.length; i++) {
          let delta = deltaData[i];

          // Convert from unsigned to signed
          if (delta > 127) {
            delta -= 256;
          }

          // Add delta to previous value
          let value = result[i - 1] + delta;

          // Handle wraparound
          value = (value + 256) % 256;
          result.push(value);
        }

        // Clear input buffer
        this.inputBuffer = [];

        return result;
      }

      _applyRLE(data) {
        if (data.length === 0) return data;

        const result = [];
        let count = 1;
        let current = data[0];

        for (let i = 1; i < data.length; i++) {
          if (data[i] === current && count < 255) {
            count++;
          } else {
            // Write run
            if (count > 1) {
              result.push(255); // RLE marker
              result.push(count);
              result.push(current);
            } else {
              // Single occurrence, but avoid conflict with RLE marker
              if (current === 255) {
                result.push(255, 1, 255); // Encoded single 255
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
          result.push(255, count, current);
        } else {
          if (current === 255) {
            result.push(255, 1, 255);
          } else {
            result.push(current);
          }
        }

        return result;
      }

      _decompressRLE(data) {
        if (data.length === 0) return data;

        const result = [];
        let i = 0;

        while (i < data.length) {
          if (data[i] === 255 && i + 2 < data.length) {
            // RLE encoded run
            const count = data[i + 1];
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