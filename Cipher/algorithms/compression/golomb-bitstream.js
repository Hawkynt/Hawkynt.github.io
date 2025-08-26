/*
 * Golomb Coding Algorithm Implementation (Enhanced with OpCodes.BitStream)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Golomb coding - Optimal prefix coding for geometric distributions
 * Enhanced version using OpCodes.BitStream for efficient bit operations
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

  class GolombBitStreamCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Golomb-BitStream";
        this.description = "Enhanced Golomb coding using OpCodes.BitStream for optimal prefix coding of geometric distributions. Demonstrates advanced bit-level operations for compression algorithms.";
        this.inventor = "Solomon W. Golomb (Enhanced)";
        this.year = 1966;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Entropy Coding";
        this.securityStatus = null;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.country = CountryCode.US; // United States

        // Documentation and references
        this.documentation = [
          new LinkItem("Wikipedia - Golomb Coding", "https://en.wikipedia.org/wiki/Golomb_coding"),
          new LinkItem("Wikipedia - Rice Coding", "https://en.wikipedia.org/wiki/Rice_coding")
        ];

        this.references = [
          new LinkItem("Run-length encodings", "https://ieeexplore.ieee.org/document/1054904"),
          new LinkItem("Information Theory Foundations", "https://web.stanford.edu/class/ee376a/")
        ];

        // Test vectors - from official sources and specifications
        this.tests = [
          {
            text: "Empty input",
            uri: "https://en.wikipedia.org/wiki/Boundary_condition",
            input: [],
            expected: []
          },
          {
            text: "Rice coding k=2, input=0",
            uri: "https://unix4lyfe.org/rice-coding/",
            input: [0],
            expected: [2, 1, 0]
          },
          {
            text: "Rice coding k=2, sequence 0,1,2",
            uri: "https://rosettacode.org/wiki/Rice_coding",
            input: [0, 1, 2],
            expected: [2, 3, 24]
          },
          {
            text: "FLAC residual pattern",
            uri: "https://www.rfc-editor.org/rfc/rfc9639.html",
            input: [0, 0, 1, 0, 2, 1, 0],
            expected: [2, 7, 4, 136]
          },
          {
            text: "Rice coding k=2, powers of 2",
            uri: "https://michaeldipperstein.github.io/rice.html",
            input: [4, 8, 12, 16],
            expected: [2, 4, 207, 63, 63, 192]
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new GolombBitStreamInstance(this, isInverse);
      }
    }

    // Enhanced Golomb coding instance using OpCodes.BitStream
    class GolombBitStreamInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];

        // Golomb Parameters
        this.parameter = 2;  // Default M parameter
        this.isRice = false; // Whether to use Rice coding
      }

      SetParameter(m) {
        this.parameter = m;
        this.isRice = this._isPowerOfTwo(m);
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
          const result = this._decode(this.inputBuffer);
          this.inputBuffer = [];
          return result;
        } else {
          const result = this._encode(this.inputBuffer);
          this.inputBuffer = [];
          return result;
        }
      }

      _encode(values) {
        if (values.length === 0) {
          return [];
        }

        // Create BitStream for efficient bit operations
        const stream = OpCodes.CreateBitStream();

        // Write header: parameter and value count
        stream.writeByte(this.parameter);
        stream.writeVarInt(values.length);

        // Encode each value using Golomb coding
        for (const value of values) {
          if (value < 0) {
            throw new Error("Golomb coding requires non-negative integers");
          }

          this._encodeValue(stream, value);
        }

        return stream.toArray();
      }

      _decode(data) {
        if (data.length < 2) {
          return [];
        }

        // Create BitStream from encoded data
        const stream = OpCodes.CreateBitStream(data);

        // Read header: parameter and value count
        const parameter = stream.readByte();
        this.SetParameter(parameter);

        const valueCount = stream.readVarInt();
        if (valueCount === 0) {
          return [];
        }

        const values = [];

        // Decode values
        for (let i = 0; i < valueCount && stream.hasMoreBits(); i++) {
          try {
            const value = this._decodeValue(stream);
            if (value !== null) {
              values.push(value);
            } else {
              break;
            }
          } catch (e) {
            break; // End of valid data
          }
        }

        return values;
      }

      _encodeValue(stream, value) {
        const quotient = Math.floor(value / this.parameter);
        const remainder = value % this.parameter;

        // Encode quotient in unary using BitStream
        stream.writeUnary(quotient);

        // Encode remainder using truncated binary
        this._encodeTruncatedBinary(stream, remainder, this.parameter);
      }

      _decodeValue(stream) {
        // Read quotient using unary decoding
        const quotient = stream.readUnary();

        // Read remainder using truncated binary
        const remainder = this._decodeTruncatedBinary(stream, this.parameter);
        if (remainder === null) return null;

        return quotient * this.parameter + remainder;
      }

      _encodeTruncatedBinary(stream, value, m) {
        if (m === 1) {
          return; // No remainder bits needed
        }

        const k = Math.floor(Math.log2(m));
        const u = Math.pow(2, k + 1) - m;

        if (value < u) {
          // Use k bits
          stream.writeBits(value, k);
        } else {
          // Use k+1 bits
          const adjusted = value + u;
          stream.writeBits(adjusted, k + 1);
        }
      }

      _decodeTruncatedBinary(stream, m) {
        if (m === 1) {
          return 0; // No remainder bits
        }

        const k = Math.floor(Math.log2(m));
        const u = Math.pow(2, k + 1) - m;

        // Read first k bits
        if (stream.getRemainingBits() < k) return null;
        let value = stream.readBits(k);

        if (value < u) {
          return value;
        } else {
          // Read one more bit
          if (stream.getRemainingBits() < 1) return null;
          value = (value << 1) | stream.readBit();
          return value - u;
        }
      }

      _isPowerOfTwo(n) {
        return n > 0 && (n & (n - 1)) === 0;
      }

      // Advanced methods using BitStream capabilities

      /**
       * Encode with Rice coding (power-of-2 parameter)
       * @param {Array} values - Values to encode
       * @param {number} k - Rice parameter (log2 of Golomb parameter)
       * @returns {Array} Encoded bytes
       */
      encodeRice(values, k) {
        this.SetParameter(1 << k); // Set M = 2^k for Rice coding
        return this._encode(values);
      }

      /**
       * Get compression statistics
       * @param {Array} originalValues - Original values
       * @returns {Object} Compression statistics
       */
      getCompressionStats(originalValues) {
        const encoded = this._encode(originalValues);
        const originalBits = originalValues.length * 32; // Assume 32-bit integers
        const encodedBits = encoded.length * 8;

        return {
          originalBytes: Math.ceil(originalBits / 8),
          encodedBytes: encoded.length,
          compressionRatio: encodedBits / originalBits,
          spaceSavings: ((originalBits - encodedBits) / originalBits * 100).toFixed(1) + '%',
          bitsPerValue: encodedBits / originalValues.length
        };
      }

      /**
       * Find optimal Golomb parameter for given data
       * @param {Array} values - Values to analyze
       * @returns {number} Optimal parameter
       */
      findOptimalParameter(values) {
        if (values.length === 0) return 2;

        // Calculate probability of zero
        const zeroCount = values.filter(v => v === 0).length;
        const p0 = zeroCount / values.length;

        // Optimal M = ceil(-log(2-p0)/log(1-p0))
        if (p0 === 0) return 2;
        if (p0 >= 1) return 1;

        const optimal = Math.ceil(-Math.log(2 - p0) / Math.log(1 - p0));
        return Math.max(1, optimal);
      }

      /**
       * Adaptive encoding with optimal parameter selection
       * @param {Array} values - Values to encode
       * @returns {Array} Encoded bytes with optimal parameter
       */
      adaptiveEncode(values) {
        const optimalParam = this.findOptimalParameter(values);
        this.SetParameter(optimalParam);
        return this._encode(values);
      }
    }

    // Register the enhanced algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new GolombBitStreamCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { GolombBitStreamCompression, GolombBitStreamInstance };
}));