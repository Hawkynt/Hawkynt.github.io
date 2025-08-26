/*
 * PKCS#7 Padding Scheme
 * Pads data to a multiple of block size using byte values equal to the padding length
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

  class Pkcs7Algorithm extends PaddingAlgorithm {
    constructor() {
      super();

      this.name = "PKCS#7";
      this.description = "PKCS#7 padding scheme where padding bytes contain the number of padding bytes added. This ensures data is padded to block boundary with deterministic padding removal. It is the most widely used padding scheme for block ciphers and supports variable block sizes from 1 to 255 bytes.";
      this.inventor = "RSA Laboratories";
      this.year = 1993;
      this.category = CategoryType.PADDING;
      this.subCategory = "Block Padding";
      this.securityStatus = SecurityStatus.SECURE; // Standard and widely adopted
      this.complexity = ComplexityType.SIMPLE;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("RFC 2315 - PKCS #7", "https://tools.ietf.org/rfc/rfc2315.txt"),
        new LinkItem("RFC 5652 - CMS", "https://tools.ietf.org/rfc/rfc5652.txt"),
        new LinkItem("Padding in Cryptography", "https://en.wikipedia.org/wiki/Padding_(cryptography)#PKCS#5_and_PKCS#7")
      ];

      this.references = [
        new LinkItem("OpenSSL PKCS7 Padding", "https://github.com/openssl/openssl/blob/master/crypto/evp/evp_lib.c"),
        new LinkItem("Crypto++ PKCS Padding", "https://github.com/weidai11/cryptopp/blob/master/pkcspad.cpp"),
        new LinkItem("RSA Laboratories", "https://www.rsa.com/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Padding Oracle Attack", "When decryption errors reveal padding validity, attackers can decrypt arbitrary ciphertexts byte by byte. Use authenticated encryption modes or ensure error messages don't distinguish between padding and other decryption errors."),
        new Vulnerability("Length Disclosure", "The padding scheme reveals information about the original message length modulo block size.")
      ];

      // Test vectors for PKCS#7 padding
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e11739317"), // 15 bytes
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393171111111111111111111111111111111111"), // Padded to 32 bytes with 17 bytes of 0x11
          "PKCS#7 padding with 17 bytes needed",
          "RFC 2315"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"), // 16 bytes (full block)
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a10101010101010101010101010101010"), // Padded to 32 bytes with 16 bytes of 0x10
          "PKCS#7 padding for full block",
          "RFC 2315"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("6bc1bee22e"), // 5 bytes
          OpCodes.Hex8ToBytes("6bc1bee22e030303"), // Padded to 8 bytes with 0x03
          "PKCS#7 padding with 3 bytes needed",
          "RFC 2315"
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
      return new Pkcs7Instance(this, isInverse);
    }
  }

  class Pkcs7Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this.blockSize = 16; // Default block size
    }

    /**
     * Set the block size for padding
     * @param {number} blockSize - Block size in bytes (1-255)
     */
    setBlockSize(blockSize) {
      if (!blockSize || blockSize < 1 || blockSize > 255) {
        throw new Error("Block size must be between 1 and 255 bytes");
      }
      this.blockSize = blockSize;
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
     * Add PKCS#7 padding to data
     * @returns {Array} Padded data
     */
    _addPadding() {
      const data = this.inputBuffer;
      const paddingLength = this.blockSize - (data.length % this.blockSize);

      // Create padding: each byte contains the padding length
      const padding = new Array(paddingLength).fill(paddingLength);

      const result = [...data, ...padding];

      // Clear input buffer
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return result;
    }

    /**
     * Remove PKCS#7 padding from data
     * @returns {Array} Unpadded data
     */
    _removePadding() {
      const paddedData = this.inputBuffer;

      if (paddedData.length === 0) {
        return paddedData;
      }

      if (paddedData.length % this.blockSize !== 0) {
        throw new Error("Padded data length must be multiple of block size");
      }

      const paddingLength = paddedData[paddedData.length - 1];

      // Validate padding length (must be 1 to blockSize)
      if (paddingLength < 1 || paddingLength > this.blockSize) {
        throw new Error("Invalid PKCS#7 padding length");
      }

      // Validate we have enough data
      if (paddingLength > paddedData.length) {
        throw new Error("Invalid PKCS#7 padding - padding length exceeds data length");
      }

      // Check that all padding bytes contain the padding length
      for (let i = 1; i <= paddingLength; i++) {
        if (paddedData[paddedData.length - i] !== paddingLength) {
          throw new Error("Invalid PKCS#7 padding - inconsistent padding bytes");
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

    RegisterAlgorithm(new Pkcs7Algorithm());

  // ===== EXPORTS =====

  return { Pkcs7Algorithm, Pkcs7Instance };
}));