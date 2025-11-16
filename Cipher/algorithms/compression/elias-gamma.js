/*
 * Universal Elias Gamma Coding
 * Compatible with both Browser and Node.js environments
 * Educational implementation of Peter Elias's universal integer encoding
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
 * EliasGammaAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class EliasGammaAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Elias Gamma Coding";
        this.description = "Peter Elias universal integer encoding optimal for geometric distributions where small values are more frequent.";
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Universal";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.inventor = "Peter Elias";
        this.year = 1975;
        this.country = CountryCode.US;

        this.documentation = [
          new LinkItem("Universal codeword sets and representations of the integers", "https://ieeexplore.ieee.org/document/1054906"),
          new LinkItem("Elias Gamma Coding - Wikipedia", "https://en.wikipedia.org/wiki/Elias_gamma_coding"),
          new LinkItem("Information Theory and Coding", "https://web.stanford.edu/class/ee376a/")
        ];

        this.references = [
          new LinkItem("Elements of Information Theory", "https://www.wiley.com/en-us/Elements+of+Information+Theory%2C+2nd+Edition-p-9780471241959"),
          new LinkItem("Introduction to Data Compression", "https://www.elsevier.com/books/introduction-to-data-compression/sayood/978-0-12-620862-7")
        ];

        // Convert existing tests to new format
        this.tests = [
          new TestCase(
            [0x01, 0x02, 0x03, 0x04, 0x05],
            [0, 0, 0, 5, 0, 0, 0, 21, 76, 133, 48],
            "Small integer sequence",
            "https://en.wikipedia.org/wiki/Elias_gamma_coding"
          ),
          new TestCase(
            [0x7F, 0x80, 0x81, 0xFF],
            [0, 0, 0, 4, 0, 0, 0, 62, 1, 0, 2, 4, 4, 16, 4, 0],
            "Mixed small and large values",
            "Boundary value test"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new EliasGammaInstance(this, isInverse);
      }
    }

    class EliasGammaInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse; // true = decompress, false = compress
        this.inputBuffer = [];
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
      }

      Result() {
        if (this.inputBuffer.length === 0) return [];

        // Process using existing compression logic
        const result = this.isInverse ? 
          this.decompress(this.inputBuffer) : 
          this.compress(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      }

      compress(data) {
        if (!data || data.length === 0) return [];

        let bitStream = '';

        // Encode each byte using Elias Gamma
        for (const byte of data) {
          // Elias Gamma cannot encode 0, so we use byte + 1
          const value = byte + 1;
          const gammaCode = this._encodeGamma(value);
          bitStream += gammaCode;
        }

        // Store original length and convert to bytes
        const compressed = this._packBitStream(bitStream, data.length);

        return this._stringToBytes(compressed);
      }

      decompress(data) {
        if (!data || data.length === 0) return [];

        const compressedString = this._bytesToString(data);

        // Unpack bit stream and get original length
        const { bitStream, originalLength } = this._unpackBitStream(compressedString);

        const decodedBytes = [];
        let pos = 0;

        // Decode until we have the expected number of bytes
        while (decodedBytes.length < originalLength && pos < bitStream.length) {
          const { value, bitsConsumed } = this._decodeGamma(bitStream, pos);

          if (value === null) {
            throw new Error('Invalid Elias Gamma code in compressed data');
          }

          // Convert back to byte (subtract 1 since we added 1 during encoding)
          const byte = value - 1;
          if (byte < 0 || byte > 255) {
            throw new Error('Invalid byte value in compressed data');
          }

          decodedBytes.push(byte);
          pos += bitsConsumed;
        }

        if (decodedBytes.length !== originalLength) {
          throw new Error('Decompressed length mismatch');
        }

        return decodedBytes;
      }

      /**
       * Encode a positive integer using Elias Gamma coding
       * Format: unary(floor(log2(n))) + binary(n - 2^floor(log2(n)))
       * @private
       */
      _encodeGamma(value) {
        if (value <= 0) {
          throw new Error('Elias Gamma can only encode positive integers');
        }

        // Special case for 1
        if (value === 1) {
          return '1';
        }

        // Calculate number of bits needed
        const bitsNeeded = Math.floor(Math.log2(value));

        // Create unary prefix (bitsNeeded zeros followed by 1)
        const unaryPrefix = '0'.repeat(bitsNeeded) + '1';

        // Create binary suffix (value without leading 1)
        const binaryValue = value.toString(2);
        const binarySuffix = binaryValue.substring(1); // Remove leading '1'

        return unaryPrefix + binarySuffix;
      }

      /**
       * Decode an Elias Gamma code from bit stream
       * @private
       */
      _decodeGamma(bitStream, startPos) {
        if (startPos >= bitStream.length) {
          return { value: null, bitsConsumed: 0 };
        }

        // Count leading zeros (unary part)
        let zeros = 0;
        let pos = startPos;

        while (pos < bitStream.length && bitStream[pos] === '0') {
          zeros++;
          pos++;
        }

        // Check for terminating '1'
        if (pos >= bitStream.length || bitStream[pos] !== '1') {
          return { value: null, bitsConsumed: 0 };
        }

        pos++; // Skip the '1'

        // Read binary suffix
        if (zeros === 0) {
          // Special case: value is 1
          return { value: 1, bitsConsumed: 1 };
        }

        if (pos + zeros > bitStream.length) {
          return { value: null, bitsConsumed: 0 };
        }

        const binarySuffix = bitStream.substring(pos, pos + zeros);
        const value = parseInt('1' + binarySuffix, 2);

        return { value: value, bitsConsumed: zeros + 1 + zeros };
      }

      /**
       * Pack bit stream into bytes with header
       * @private
       */
      _packBitStream(bitStream, originalLength) {
        const bytes = [];

        // Store original length (4 bytes, big-endian)
        bytes.push((originalLength >>> 24) & 0xFF);
        bytes.push((originalLength >>> 16) & 0xFF);
        bytes.push((originalLength >>> 8) & 0xFF);
        bytes.push(originalLength & 0xFF);

        // Store bit stream length (4 bytes, big-endian)
        const bitLength = bitStream.length;
        bytes.push((bitLength >>> 24) & 0xFF);
        bytes.push((bitLength >>> 16) & 0xFF);
        bytes.push((bitLength >>> 8) & 0xFF);
        bytes.push(bitLength & 0xFF);

        // Pad bit stream to byte boundary
        const padding = (8 - (bitStream.length % 8)) % 8;
        const paddedBits = bitStream + '0'.repeat(padding);

        // Convert to bytes
        for (let i = 0; i < paddedBits.length; i += 8) {
          const byte = paddedBits.substr(i, 8);
          bytes.push(parseInt(byte, 2));
        }

        return this._bytesToString(bytes);
      }

      /**
       * Unpack bit stream from bytes
       * @private
       */
      _unpackBitStream(compressedData) {
        const bytes = this._stringToBytes(compressedData);

        if (bytes.length < 8) {
          throw new Error('Invalid compressed data: header too short');
        }

        // Read original length
        const originalLength = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];

        // Read bit stream length
        const bitLength = (bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7];

        // Convert bytes back to bit stream
        let bitStream = '';
        for (let i = 8; i < bytes.length; i++) {
          bitStream += bytes[i].toString(2).padStart(8, '0');
        }

        // Trim to actual bit length
        bitStream = bitStream.substring(0, bitLength);

        return { bitStream, originalLength };
      }

      // Utility functions
      _stringToBytes(str) {
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
          bytes.push(str.charCodeAt(i) & 0xFF);
        }
        return bytes;
      }

      _bytesToString(bytes) {
        let str = "";
        for (let i = 0; i < bytes.length; i++) {
          str += String.fromCharCode(bytes[i]);
        }
        return str;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new EliasGammaAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { EliasGammaAlgorithm, EliasGammaInstance };
}));