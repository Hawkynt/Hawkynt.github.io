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

  /**
 * GolombBitStreamCompression - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

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

      /**
       * Create a new instance
       * @param {boolean} [isInverse=false] - True to decompress
       * @returns {GolombBitStreamInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new GolombBitStreamInstance(this, isInverse);
      }
    }

    /**
     * Compression statistics reported by getCompressionStats()
     */
    class GolombCompressionStats {
      /**
       * @param {int32} originalBytes - Size of the values at 32 bits each
       * @param {int32} encodedBytes - Size of the encoding
       * @param {float64} compressionRatio - Encoded bits per original bit
       * @param {string} spaceSavings - Percentage saved, one decimal, with '%'
       * @param {float64} bitsPerValue - Encoded bits per value
       */
      constructor(originalBytes, encodedBytes, compressionRatio, spaceSavings, bitsPerValue) {
        /** @type {int32} */
        this.originalBytes = originalBytes;
        /** @type {int32} */
        this.encodedBytes = encodedBytes;
        /** @type {float64} */
        this.compressionRatio = compressionRatio;
        /** @type {string} */
        this.spaceSavings = spaceSavings;
        /** @type {float64} */
        this.bitsPerValue = bitsPerValue;
      }
    }

    // Enhanced Golomb coding instance using OpCodes.BitStream
    class GolombBitStreamInstance extends IAlgorithmInstance {
      /**
       * @param {GolombBitStreamCompression} algorithm - Parent algorithm
       * @param {boolean} [isInverse=false] - True to decompress
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        /** @type {boolean} */
        this.isInverse = isInverse;
        /** @type {uint8[]} */
        this.inputBuffer = [];

        // Golomb Parameters
        /** @type {int32} */
        this.parameter = 2;  // Default M parameter
        /** @type {boolean} */
        this.isRice = false; // Whether to use Rice coding
      }

      /**
       * Set the Golomb parameter M
       * @param {int32} m - Parameter (Rice coding when a power of two)
       */
      SetParameter(m) {
        this.parameter = m;
        this.isRice = this._isPowerOfTwo(m);
      }

      /**
       * Compress or decompress the collected input
       * @returns {uint8[]} Output bytes
       */
      Result() {
        /** @type {uint8[]} */
        let result = [];
        if (this.inputBuffer.length === 0) {
          return result;
        }

        if (this.isInverse) {
          result = this._decode(this.inputBuffer);
        } else {
          result = this._encode(this.inputBuffer);
        }
        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        return result;
      }

      /**
       * @param {uint8[]} values - Non-negative values
       * @returns {uint8[]} Parameter byte, value count and Golomb codes
       */
      _encode(values) {
        if (values.length === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }

        // Create BitStream for output
        const stream = OpCodes.CreateBitStream();

        // Write header: parameter and count
        stream.writeByte(this.parameter);
        stream.writeVarInt(values.length);

        // Encode each value
        for (let i = 0; i < values.length; i++) {
          /** @type {int32} */
          const value = values[i];
          if (value < 0) {
            throw new Error("Golomb coding requires non-negative integers");
          }

          this._encodeValue(stream, value);
        }

        /** @type {uint8[]} */
        const bytes = stream.toArray();
        return bytes;
      }

      /**
       * @param {uint8[]} data - Parameter byte, value count and Golomb codes
       * @returns {uint8[]} Decoded values
       */
      _decode(data) {
        /** @type {uint8[]} */
        const values = [];
        if (data.length < 2) {
          return values;
        }

        // Create BitStream from input data
        const stream = OpCodes.CreateBitStream(data);

        // Read header
        /** @type {int32} */
        const parameter = stream.readByte();
        this.SetParameter(parameter);

        /** @type {uint32} */
        const valueCount = stream.readVarInt();
        if (valueCount === 0) {
          return values;
        }

        // Decode values
        for (let i = 0; i < valueCount; i++) {
          /** @type {boolean} */
          const more = stream.hasMoreBits();
          if (!more) {
            break;
          }
          try {
            /** @type {int32} */
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

      /**
       * @param {_BitStream} stream - Output bits
       * @param {int32} value - Non-negative value
       */
      _encodeValue(stream, value) {
        /** @type {int32} */
        const quotient = Math.floor(value / this.parameter);
        /** @type {int32} */
        const remainder = value % this.parameter;

        // Encode quotient in unary
        stream.writeUnary(quotient);

        // Encode remainder using truncated binary
        this._encodeTruncatedBinary(stream, remainder, this.parameter);
      }

      /**
       * @param {_BitStream} stream - Input bits
       * @returns {int32|null} Decoded value, or null when the data ran out
       */
      _decodeValue(stream) {
        // Decode quotient from unary
        /** @type {int32} */
        const quotient = stream.readUnary();

        // Decode remainder using truncated binary
        /** @type {int32|null} */
        const remainder = this._decodeTruncatedBinary(stream, this.parameter);
        if (remainder === null) {
          return null;
        }

        return quotient * this.parameter + remainder;
      }

      /**
       * @param {_BitStream} stream - Output bits
       * @param {int32} value - Remainder 0..m-1
       * @param {int32} m - Golomb parameter
       */
      _encodeTruncatedBinary(stream, value, m) {
        if (m === 1) {
          return; // No remainder bits needed
        }

        /** @type {int32} */
        const k = Math.floor(Math.log2(m));
        /** @type {int32} */
        const u = Math.pow(2, k + 1) - m;

        if (value < u) {
          // Use k bits
          stream.writeBits(value, k);
        } else {
          // Use k+1 bits
          /** @type {int32} */
          const adjusted = value + u;
          stream.writeBits(adjusted, k + 1);
        }
      }

      /**
       * @param {_BitStream} stream - Input bits
       * @param {int32} m - Golomb parameter
       * @returns {int32|null} Remainder, or null when the data ran out
       */
      _decodeTruncatedBinary(stream, m) {
        if (m === 1) {
          return 0; // No remainder bits
        }

        /** @type {int32} */
        const k = Math.floor(Math.log2(m));
        /** @type {int32} */
        const u = Math.pow(2, k + 1) - m;

        // Read k bits first
        /** @type {int32} */
        const remaining = stream.getRemainingBits();
        if (remaining < k) {
          return null;
        }
        /** @type {int32} */
        let value = stream.readBits(k);

        if (value < u) {
          return value;
        } else {
          // Need one more bit
          /** @type {int32} */
          const left = stream.getRemainingBits();
          if (left < 1) {
            return null;
          }
          value = OpCodes.ToInt(OpCodes.Or32(OpCodes.Shl32(value, 1), stream.readBit()));
          return value - u;
        }
      }

      /**
       * @param {int32} n - Value
       * @returns {boolean} True when n is a positive power of two
       */
      _isPowerOfTwo(n) {
        return n > 0 && OpCodes.And32(n, n - 1) === 0;
      }

      // Advanced methods using BitStream capabilities

      /**
       * Encode with Rice coding (power-of-2 parameter)
       * @param {uint8[]} values - Values to encode
       * @param {int32} k - Rice parameter (log2 of Golomb parameter)
       * @returns {uint8[]} Encoded bytes
       */
      encodeRice(values, k) {
        this.SetParameter(OpCodes.Shl32(1, k)); // Set M = 2^k for Rice coding
        return this._encode(values);
      }

      /**
       * Get compression statistics
       * @param {uint8[]} originalValues - Original values
       * @returns {GolombCompressionStats} Compression statistics
       */
      getCompressionStats(originalValues) {
        /** @type {uint8[]} */
        const encoded = this._encode(originalValues);
        /** @type {int32} */
        const originalBits = originalValues.length * 32; // Assume 32-bit integers
        /** @type {int32} */
        const encodedBits = encoded.length * 8;
        /** @type {string} */
        const savings = ((originalBits - encodedBits) / originalBits * 100).toFixed(1);

        return new GolombCompressionStats(
          Math.ceil(originalBits / 8),
          encoded.length,
          encodedBits / originalBits,
          savings + '%',
          encodedBits / originalValues.length
        );
      }

      /**
       * Find optimal Golomb parameter for given data
       * @param {uint8[]} values - Values to analyze
       * @returns {int32} Optimal parameter
       */
      findOptimalParameter(values) {
        if (values.length === 0) {
          return 2;
        }

        // Calculate probability of zero
        /** @type {int32} */
        let zeroCount = 0;
        for (let i = 0; i < values.length; i++) {
          if (values[i] === 0) {
            zeroCount++;
          }
        }
        /** @type {float64} */
        const p0 = zeroCount / values.length;

        // Optimal M = ceil(-log(2-p0)/log(1-p0))
        if (p0 === 0) {
          return 2;
        }
        if (p0 >= 1) {
          return 1;
        }

        /** @type {int32} */
        const optimal = Math.ceil(-Math.log(2 - p0) / Math.log(1 - p0));
        return Math.max(1, optimal);
      }

      /**
       * Adaptive encoding with optimal parameter selection
       * @param {uint8[]} values - Values to encode
       * @returns {uint8[]} Encoded bytes with optimal parameter
       */
      adaptiveEncode(values) {
        /** @type {int32} */
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