/*
 * ISO/IEC 7816-4 Padding Scheme
 * Pads with 0x80 followed by zero bytes
 * (c)2006-2025 Hawkynt
 */

// Load AlgorithmFramework (REQUIRED)

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

  class Iso78164Algorithm extends PaddingAlgorithm {
    constructor() {
      super();

      this.name = "ISO/IEC 7816-4";
      this.description = "ISO/IEC 7816-4 padding scheme appends a single '1' bit (0x80 byte) followed by zero bits to fill the block. This method is designed for smart card communication and provides unambiguous padding removal. It is identical to bit padding and is widely used in cryptographic protocols.";
      this.inventor = "ISO/IEC";
      this.year = 2005;
      this.category = CategoryType.PADDING;
      this.subCategory = "Smart Card Padding";
      this.securityStatus = SecurityStatus.SECURE; // Unambiguous padding
      this.complexity = ComplexityType.SIMPLE;
      this.country = CountryCode.INTERNATIONAL;

      this.documentation = [
        new LinkItem("ISO/IEC 7816-4 Standard", "https://www.iso.org/standard/77180.html"),
        new LinkItem("Smart Card Communication", "https://en.wikipedia.org/wiki/ISO/IEC_7816"),
        new LinkItem("Padding in Cryptography", "https://en.wikipedia.org/wiki/Padding_(cryptography)")
      ];

      this.references = [
        new LinkItem("ISO/IEC 7816 Series", "https://www.iso.org/committee/45144.html"),
        new LinkItem("Smart Card Standards", "https://cardwerk.com/smart-card-standard-iso14443-type-a/"),
        new LinkItem("Cryptographic Padding Methods", "https://tools.ietf.org/rfc/rfc3852.txt")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("None Known", "ISO/IEC 7816-4 padding provides unambiguous padding removal with no known cryptographic weaknesses."),
        new Vulnerability("Length Expansion", "Always adds at least one byte of padding, which increases data size even for complete blocks.")
      ];

      // Test vectors for ISO/IEC 7816-4 padding
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e11739317"), // 15 bytes
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393178000000000000000000000000000000000"), // Padded to 32 bytes (15 + 17)
          "ISO 7816-4 padding with 17 bytes needed",
          "ISO/IEC 7816-4"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"), // 16 bytes (half block)
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a80000000000000000000000000000000"), // Padded to 32 bytes (16 + 16)
          "ISO 7816-4 padding for half block",
          "ISO/IEC 7816-4"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("6bc1bee22e"), // 5 bytes
          OpCodes.Hex8ToBytes("6bc1bee22e800000"), // Padded to 8 bytes (5 + 3)
          "ISO 7816-4 padding with 3 bytes needed",
          "ISO/IEC 7816-4"
        )
      ];

      // Add block sizes for tests
      this.tests.forEach((test, index) => {
        if (index === 0 || index === 1) {
          test.blockSize = 32; // 32-byte blocks for first two tests
        } else {
          test.blockSize = 8; // 8-byte block for third test
        }
      });
    }

    CreateInstance(isInverse = false) {
      return new Iso78164Instance(this, isInverse);
    }
  }

  class Iso78164Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._blockSize = 16; // Default block size
    }

    // Property getter and setter for test framework
    get blockSize() { return this._blockSize; }
    set blockSize(value) {
      if (!value || value < 1 || value > 255) {
        throw new Error("Block size must be between 1 and 255 bytes");
      }
      this._blockSize = value;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    Result() {
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      if (this.isInverse) {
        return this._removePadding();
      } else {
        return this._addPadding();
      }
    }

    /**
     * Add ISO/IEC 7816-4 padding to data
     * @returns {Array} Padded data
     */
    _addPadding() {
      const data = this.inputBuffer;
      const paddingLength = this._blockSize - (data.length % this._blockSize);

      // Always add padding: 0x80 followed by zeros
      const padding = [0x80];
      for (let i = 1; i < paddingLength; i++) {
        padding.push(0x00);
      }

      // If no padding needed (data is exact multiple), add full block
      if (paddingLength === this._blockSize) {
        padding.length = 0;
        padding.push(0x80);
        for (let i = 1; i < this._blockSize; i++) {
          padding.push(0x00);
        }
      }

      const result = [...data, ...padding];

      // Clear input buffer
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return result;
    }

    /**
     * Remove ISO/IEC 7816-4 padding from data
     * @returns {Array} Unpadded data
     */
    _removePadding() {
      const paddedData = this.inputBuffer;

      if (paddedData.length === 0) {
        return paddedData;
      }

      if (paddedData.length % this._blockSize !== 0) {
        throw new Error("Padded data length must be multiple of block size");
      }

      // Find the last 0x80 byte (the '1' bit marker)
      let paddingStart = -1;
      for (let i = paddedData.length - 1; i >= 0; i--) {
        if (paddedData[i] === 0x80) {
          paddingStart = i;
          break;
        } else if (paddedData[i] !== 0x00) {
          throw new Error("Invalid ISO 7816-4 padding - non-zero byte found");
        }
      }

      if (paddingStart === -1) {
        throw new Error("Invalid ISO 7816-4 padding - no 0x80 byte found");
      }

      const result = paddedData.slice(0, paddingStart);

      // Clear input buffer
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return result;
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new Iso78164Algorithm());

  // ===== EXPORTS =====

  return { Iso78164Algorithm, Iso78164Instance };
}));