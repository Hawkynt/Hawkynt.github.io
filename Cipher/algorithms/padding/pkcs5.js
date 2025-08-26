/*
 * PKCS#5 Padding Scheme
 * Password-based encryption padding (identical to PKCS#7 for 8-byte blocks)
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

  class Pkcs5Algorithm extends PaddingAlgorithm {
    constructor() {
      super();

      this.name = "PKCS#5";
      this.description = "PKCS#5 padding scheme is designed specifically for 8-byte block ciphers like DES. Each padding byte contains the number of padding bytes added. This is essentially identical to PKCS#7 but restricted to 8-byte blocks only. It was developed for password-based encryption systems.";
      this.inventor = "RSA Laboratories";
      this.year = 1993;
      this.category = CategoryType.PADDING;
      this.subCategory = "Password-Based Padding";
      this.securityStatus = SecurityStatus.SECURE; // Standard padding for 8-byte blocks
      this.complexity = ComplexityType.SIMPLE;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("RFC 2898 - PKCS #5", "https://tools.ietf.org/rfc/rfc2898.txt"),
        new LinkItem("Password-Based Cryptography", "https://www.rsa.com/en-us/company/standards"),
        new LinkItem("PKCS Standards", "https://en.wikipedia.org/wiki/PKCS")
      ];

      this.references = [
        new LinkItem("RSA Laboratories", "https://www.rsa.com/"),
        new LinkItem("DES Encryption", "https://csrc.nist.gov/publications/detail/fips/46-3/archive/1999-10-25"),
        new LinkItem("Password-Based Encryption", "https://tools.ietf.org/rfc/rfc8018.txt")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Padding Oracle Attack", "Like PKCS#7, PKCS#5 can be vulnerable to padding oracle attacks if error messages reveal padding validity."),
        new Vulnerability("Block Size Limitation", "PKCS#5 is restricted to 8-byte blocks only, limiting its applicability to modern ciphers."),
        new Vulnerability("Legacy Cipher Usage", "Primarily used with DES, which is now considered cryptographically broken.")
      ];

      // Test vectors for PKCS#5 padding (8-byte blocks only)
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("6bc1bee22e"), // 5 bytes
          OpCodes.Hex8ToBytes("6bc1bee22e030303"), // Padded to 8 bytes with 0x03
          "PKCS#5 padding with 3 bytes needed",
          "RFC 2898"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("6bc1bee22e409f96"), // 8 bytes (full block)
          OpCodes.Hex8ToBytes("6bc1bee22e409f960808080808080808"), // Padded to 16 bytes with 0x08
          "PKCS#5 padding for full block",
          "RFC 2898"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e9"), // 9 bytes  
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e907070707070707"), // Padded to 16 bytes with 0x07
          "PKCS#5 padding with 7 bytes needed",
          "RFC 2898"
        )
      ];

      // All PKCS#5 tests use 8-byte blocks
      this.tests.forEach(test => {
        test.blockSize = 8;
      });
    }

    CreateInstance(isInverse = false) {
      return new Pkcs5Instance(this, isInverse);
    }
  }

  class Pkcs5Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this.blockSize = 8; // PKCS#5 is always 8 bytes
    }

    /**
     * Set the block size (must be 8 for PKCS#5)
     * @param {number} blockSize - Block size in bytes (must be 8)
     */
    setBlockSize(blockSize) {
      if (blockSize !== 8) {
        throw new Error("PKCS#5 is designed for 8-byte blocks only. Use PKCS#7 for other block sizes.");
      }
      this.blockSize = 8;
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
     * Add PKCS#5 padding to data
     * @returns {Array} Padded data
     */
    _addPadding() {
      const data = this.inputBuffer;
      const blockSize = 8; // PKCS#5 is always 8 bytes
      const paddingLength = blockSize - (data.length % blockSize);

      // Create padding: each byte contains the padding length
      const padding = new Array(paddingLength).fill(paddingLength);

      const result = [...data, ...padding];

      // Clear input buffer
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return result;
    }

    /**
     * Remove PKCS#5 padding from data
     * @returns {Array} Unpadded data
     */
    _removePadding() {
      const paddedData = this.inputBuffer;

      if (paddedData.length === 0) {
        return paddedData;
      }

      if (paddedData.length % 8 !== 0) {
        throw new Error("Padded data length must be multiple of 8 bytes for PKCS#5");
      }

      const paddingLength = paddedData[paddedData.length - 1];

      // Validate padding length (must be 1-8 for PKCS#5)
      if (paddingLength < 1 || paddingLength > 8) {
        throw new Error("Invalid PKCS#5 padding length");
      }

      // Validate we have enough data
      if (paddingLength > paddedData.length) {
        throw new Error("Invalid PKCS#5 padding - padding length exceeds data length");
      }

      // Check that all padding bytes contain the padding length
      for (let i = 1; i <= paddingLength; i++) {
        if (paddedData[paddedData.length - i] !== paddingLength) {
          throw new Error("Invalid PKCS#5 padding - inconsistent padding bytes");
        }
      }

      const result = paddedData.slice(0, paddedData.length - paddingLength);

      // Clear input buffer
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return result;
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new Pkcs5Algorithm());

  // ===== EXPORTS =====

  return { Pkcs5Algorithm, Pkcs5Instance };
}));