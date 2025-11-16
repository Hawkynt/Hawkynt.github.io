/*
 * ANSI X9.23 Padding Scheme
 * Pads with zeros except last byte indicates padding length
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

  class AnsiX923Algorithm extends PaddingAlgorithm {
    constructor() {
      super();

      this.name = "ANSI X9.23";
      this.description = "ANSI X9.23 padding scheme fills blocks with zero bytes except for the last byte, which indicates the padding length. This scheme is commonly used in financial cryptographic applications and provides a deterministic padding method suitable for block ciphers.";
      this.inventor = "ANSI";
      this.year = 1998;
      this.category = CategoryType.PADDING;
      this.subCategory = "Block Padding";
      this.securityStatus = SecurityStatus.SECURE; // Standard padding scheme
      this.complexity = ComplexityType.SIMPLE;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("ANSI X9.23 Standard", "https://webstore.ansi.org/standards/ascx9/ansix9231998"),
        new LinkItem("Financial Cryptographic Standards", "https://x9.org/workproducts/"),
        new LinkItem("Padding in Cryptography", "https://en.wikipedia.org/wiki/Padding_(cryptography)")
      ];

      this.references = [
        new LinkItem("ANSI X9 Committee", "https://x9.org/"),
        new LinkItem("Financial Services Cryptography", "https://www.iso.org/committee/45144.html"),
        new LinkItem("Block Cipher Padding", "https://tools.ietf.org/rfc/rfc3852.txt")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Padding Oracle", "Like other padding schemes, ANSI X9.23 can be vulnerable to padding oracle attacks if error messages reveal padding validity."),
        new Vulnerability("Length Disclosure", "The padding scheme reveals information about the original message length modulo block size.")
      ];

      // Test vectors for ANSI X9.23 padding
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e11739317"), // 15 bytes
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393170000000000000000000000000000000011"), // Padded to 32 bytes (15 + 17, last byte is 0x11 = 17)
          "ANSI X9.23 padding with 17 bytes needed",
          "ANSI X9.23 Standard"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393"), // 14 bytes
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393000000000000000000000000000000000012"), // Padded to 32 bytes (14 + 18, last byte is 0x12 = 18)
          "ANSI X9.23 padding with 18 bytes needed",
          "ANSI X9.23 Standard"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("6bc1bee22e"), // 5 bytes
          OpCodes.Hex8ToBytes("6bc1bee22e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003b"), // Padded to 64 bytes (5 + 59, last byte is 0x3B = 59)
          "ANSI X9.23 padding with 59 bytes needed",
          "ANSI X9.23 Standard"
        )
      ];

      // Add block sizes for tests
      this.tests.forEach((test, index) => {
        if (index === 0 || index === 1) {
          test.blockSize = 32; // 32-byte blocks for first two tests
        } else {
          test.blockSize = 64; // 64-byte block for third test
        }
      });
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new AnsiX923Instance(this, isInverse);
    }
  }

  /**
 * AnsiX923 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class AnsiX923Instance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

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

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Allow empty input buffer - padding can pad zero-length data to a full block
      if (this.isInverse) {
        // For unpadding, we need data
        if (this.inputBuffer.length === 0) {
          return []; // Return empty array for empty input
        }
        return this._removePadding();
      } else {
        // For padding, empty input is fine - it will be padded to a full block
        return this._addPadding();
      }
    }

    /**
     * Add ANSI X9.23 padding to data
     * @returns {Array} Padded data
     */
    _addPadding() {
      const data = this.inputBuffer;
      const paddingLength = this._blockSize - (data.length % this._blockSize);

      // Create padding: zeros followed by length byte
      const padding = new Array(paddingLength - 1).fill(0);
      padding.push(paddingLength);

      const result = [...data, ...padding];

      // Clear input buffer
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return result;
    }

    /**
     * Remove ANSI X9.23 padding from data
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

      const paddingLength = paddedData[paddedData.length - 1];

      // Validate padding length
      if (paddingLength < 1 || paddingLength > this._blockSize) {
        throw new Error("Invalid ANSI X9.23 padding length");
      }

      // Check that padding bytes (except last) are zeros
      for (let i = paddedData.length - paddingLength; i < paddedData.length - 1; i++) {
        if (paddedData[i] !== 0) {
          throw new Error("Invalid ANSI X9.23 padding - non-zero padding bytes");
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

    RegisterAlgorithm(new AnsiX923Algorithm());

  // ===== EXPORTS =====

  return { AnsiX923Algorithm, AnsiX923Instance };
}));