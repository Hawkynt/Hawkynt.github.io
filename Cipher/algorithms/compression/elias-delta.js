/*
 * Universal Elias Delta Coding
 * Compatible with both Browser and Node.js environments
 * Educational implementation of Peter Elias's improved universal integer encoding
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
 * EliasDeltaAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class EliasDeltaAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Elias Delta Coding";
        this.description = "Peter Elias improved universal integer encoding, more efficient than Gamma for larger numbers using variable-length prefix codes.";
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Universal";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.inventor = "Peter Elias";
        this.year = 1975;
        this.country = CountryCode.US;

        this.documentation = [
          new LinkItem("Universal codeword sets and representations of the integers", "https://ieeexplore.ieee.org/document/1054906"),
          new LinkItem("Elias Delta Coding - Wikipedia", "https://en.wikipedia.org/wiki/Elias_delta_coding"),
          new LinkItem("Information Theory and Coding", "https://web.stanford.edu/class/ee376a/")
        ];

        this.references = [
          new LinkItem("Elements of Information Theory", "https://www.wiley.com/en-us/Elements+of+Information+Theory%2C+2nd+Edition-p-9780471241959"),
          new LinkItem("Introduction to Data Compression", "https://www.elsevier.com/books/introduction-to-data-compression/sayood/978-0-12-620862-7")
        ];

        // Wire format (matches CompressionWorkbench's BB_EliasDelta building
        // block): a 4-byte little-endian original length, followed by the
        // Delta-coded bitstream (MSB-first, zero-padded to a byte boundary).
        this.tests = [
          new TestCase(
            [0x01, 0x02, 0x03, 0x04, 0x05],
            [5, 0, 0, 0, 69, 99, 92],
            "Small integer sequence",
            "https://en.wikipedia.org/wiki/Elias_delta_coding"
          ),
          new TestCase(
            [0x7F, 0x80, 0x81, 0xFF],
            [4, 0, 0, 0, 16, 0, 64, 17, 0, 132, 128, 0],
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
       * @returns {EliasDeltaInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new EliasDeltaInstance(this, isInverse);
      }
    }

    class EliasDeltaInstance extends IAlgorithmInstance {
      /**
       * @param {EliasDeltaAlgorithm} algorithm - Parent algorithm
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

      // Wire format (matches CompressionWorkbench's BB_EliasDelta building
      // block): a 4-byte little-endian original length, followed by the
      // Delta-coded bitstream (MSB-first, zero-padded to a byte boundary).
      // Elias Delta cannot encode 0, so byte values are mapped to (value + 1).
      /**
       * @param {uint8[]} data - Input bytes
       * @returns {uint8[]} Length header and Delta codes
       */
      _compress(data) {
        const bitStream = OpCodes.CreateBitStream();
        bitStream.writeUint32LE(data.length);
        for (let k = 0; k < data.length; k++) {
          /** @type {int32} */
          const value = data[k] + 1;
          this._encodeDelta(bitStream, value);
        }
        /** @type {uint8[]} */
        const bytes = bitStream.toArray();
        return bytes;
      }

      /**
       * @param {uint8[]} data - Length header and Delta codes
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
          const value = this._decodeDelta(bitStream) - 1;
          result.push(value);
        }

        return result;
      }

      /**
       * Encode a positive integer using Elias Delta coding: Gamma-code the
       * bit length (N+1) of value, then append the lower N bits of value
       * (without its leading 1), MSB first.
       * @private
       * @param {_BitStream} bitStream - Output bit stream
       * @param {int32} value - Positive integer
       */
      _encodeDelta(bitStream, value) {
        /** @type {int32} */
        let n = 0;
        /** @type {int32} */
        let v = value;
        while (v > 1) {
          n++;
          v = Math.floor(v / 2);
        }

        // Gamma-encode (n + 1): floor(log2(n+1)) zero-bits, then binary of (n+1).
        /** @type {int32} */
        const lenBits = n + 1;
        /** @type {int32} */
        let lenLen = 0;
        /** @type {int32} */
        let tmp = lenBits;
        while (tmp > 1) {
          lenLen++;
          tmp = Math.floor(tmp / 2);
        }

        for (let i = 0; i < lenLen; i++) {
          bitStream.writeBit(0);
        }
        for (let i = lenLen; i >= 0; i--) {
          bitStream.writeBit(OpCodes.And32(OpCodes.Shr32(lenBits, i), 1));
        }

        // Lower n bits of value (without the implicit leading 1).
        for (let i = n - 1; i >= 0; i--) {
          bitStream.writeBit(OpCodes.And32(OpCodes.Shr32(value, i), 1));
        }
      }

      /**
       * Decode an Elias Delta code: Gamma-decode the bit length (n+1), then
       * read n more bits with an implicit leading 1.
       * @private
       * @param {_BitStream} bitStream - Input bit stream
       * @returns {int32} Decoded positive integer
       */
      _decodeDelta(bitStream) {
        /** @type {int32} */
        let lenLen = 0;
        /** @type {uint32} */
        let bit = bitStream.readBit();
        while (bit === 0) {
          lenLen++;
          bit = bitStream.readBit();
        }

        /** @type {int32} */
        let lenBits = 1;
        for (let i = 0; i < lenLen; i++) {
          lenBits = OpCodes.Or32(OpCodes.Shl32(lenBits, 1), bitStream.readBit());
        }

        /** @type {int32} */
        const n = lenBits - 1;

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

    const algorithmInstance = new EliasDeltaAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { EliasDeltaAlgorithm, EliasDeltaInstance };
}));