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

        // Wire format (matches CompressionWorkbench's BB_EliasGamma building
        // block): a 4-byte little-endian original length, followed by the
        // Gamma-coded bitstream (MSB-first, zero-padded to a byte boundary).
        this.tests = [
          new TestCase(
            [0x01, 0x02, 0x03, 0x04, 0x05],
            [5, 0, 0, 0, 76, 133, 48],
            "Small integer sequence",
            "https://en.wikipedia.org/wiki/Elias_gamma_coding"
          ),
          new TestCase(
            [0x7F, 0x80, 0x81, 0xFF],
            [4, 0, 0, 0, 1, 0, 2, 4, 4, 16, 4, 0],
            "Mixed small and large values",
            "Boundary value test"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      /**
       * Create a new instance
       * @param {boolean} [isInverse=false] - True for the inverse transform
       * @returns {EliasGammaInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new EliasGammaInstance(this, isInverse);
      }
    }

    class EliasGammaInstance extends IAlgorithmInstance {
      /**
       * @param {EliasGammaAlgorithm} algorithm - Parent algorithm
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
          result = this._decompress(this.inputBuffer);
        } else {
          result = this._compress(this.inputBuffer);
        }

        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        return result;
      }

      // Wire format (matches CompressionWorkbench's BB_EliasGamma building
      // block): a 4-byte little-endian original length, followed by the
      // Gamma-coded bitstream (MSB-first, zero-padded to a byte boundary).
      // Elias Gamma cannot encode 0, so byte values are mapped to (value + 1).
      /**
       * @param {uint8[]} data - Input bytes
       * @returns {uint8[]} Length header and Gamma codes
       */
      _compress(data) {
        const bitStream = OpCodes.CreateBitStream();
        bitStream.writeUint32LE(data.length);
        for (let k = 0; k < data.length; k++) {
          /** @type {int32} */
          const value = data[k] + 1;
          this._encodeGamma(bitStream, value);
        }
        /** @type {uint8[]} */
        const bytes = bitStream.toArray();
        return bytes;
      }

      /**
       * @param {uint8[]} data - Length header and Gamma codes
       * @returns {uint8[]} Decoded bytes
       */
      _decompress(data) {
        /** @type {uint8[]} */
        const result = [];
        if (data.length < 4) {
          return result;
        }

        const bitStream = OpCodes.CreateBitStream(data);
        /** @type {uint8} */
        const c0 = bitStream.readByte();
        /** @type {uint8} */
        const c1 = bitStream.readByte();
        /** @type {uint8} */
        const c2 = bitStream.readByte();
        /** @type {uint8} */
        const c3 = bitStream.readByte();
        /** @type {uint32} */
        const originalLength = OpCodes.Pack32LE(c0, c1, c2, c3);
        if (originalLength === 0) {
          return result;
        }

        for (let i = 0; i < originalLength; i++) {
          /** @type {int32} */
          const value = this._decodeGamma(bitStream) - 1;
          result.push(value);
        }

        return result;
      }

      /**
       * Encode a positive integer using Elias Gamma coding: floor(log2(n))
       * zero-bits, then the (floor(log2(n))+1)-bit binary form of n, MSB first.
       * @private
       * @param {_BitStream} bitStream - Output bit stream
       * @param {int32} value - Positive integer
       */
      _encodeGamma(bitStream, value) {
        /** @type {int32} */
        let n = 0;
        /** @type {int32} */
        let v = value;
        while (v > 1) {
          n++;
          v = Math.floor(v / 2);
        }

        for (let i = 0; i < n; i++) {
          bitStream.writeBit(0);
        }
        for (let i = n; i >= 0; i--) {
          bitStream.writeBit(OpCodes.And32(OpCodes.Shr32(value, i), 1));
        }
      }

      /**
       * Decode an Elias Gamma code: count leading zero-bits n (the
       * terminating 1-bit is consumed but not counted), then read n more
       * bits with an implicit leading 1.
       * @private
       * @param {_BitStream} bitStream - Input bit stream
       * @returns {int32} Decoded positive integer
       */
      _decodeGamma(bitStream) {
        /** @type {int32} */
        let n = 0;
        /** @type {uint32} */
        let bit = bitStream.readBit();
        while (bit === 0) {
          n++;
          bit = bitStream.readBit();
        }

        /** @type {int32} */
        let value = 1;
        for (let i = 0; i < n; i++) {
          value = OpCodes.Or32(OpCodes.Shl32(value, 1), bitStream.readBit());
        }

        return value;
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