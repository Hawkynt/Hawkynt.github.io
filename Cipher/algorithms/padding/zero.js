/*
 * Zero Padding Scheme
 * Pads data with zero bytes to reach block size
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

  class ZeroPaddingAlgorithm extends PaddingAlgorithm {
    constructor() {
      super();

      this.name = "Zero Padding";
      this.description = "Zero padding scheme fills remaining bytes with zero values to reach the block size. This is the simplest padding method but has ambiguity issues when the original data ends with zero bytes, making it impossible to distinguish padding from actual data during removal.";
      this.inventor = "N/A";
      this.year = 1970;
      this.category = CategoryType.PADDING;
      this.subCategory = "Simple Padding";
      this.securityStatus = SecurityStatus.EDUCATIONAL; // Ambiguous padding removal
      this.complexity = ComplexityType.TRIVIAL;
      this.country = CountryCode.INTERNATIONAL;

      this.documentation = [
        new LinkItem("ISO/IEC 9797-1", "https://www.iso.org/standard/31136.html"),
        new LinkItem("Padding Ambiguity Issues", "https://en.wikipedia.org/wiki/Padding_(cryptography)#Zero_padding"),
        new LinkItem("Block Cipher Padding", "https://tools.ietf.org/rfc/rfc3852.txt")
      ];

      this.references = [
        new LinkItem("Cryptographic Padding Methods", "https://csrc.nist.gov/publications/detail/sp/800-38a/final"),
        new LinkItem("Block Cipher Modes", "https://en.wikipedia.org/wiki/Block_cipher_mode_of_operation"),
        new LinkItem("ISO Standards", "https://www.iso.org/committee/45144.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Ambiguous Padding Removal", "Cannot distinguish between padding zeros and actual data zeros, leading to potential data corruption during unpadding."),
        new Vulnerability("Data Loss Risk", "If original data ends with zeros, those zeros will be incorrectly removed during unpadding."),
        new Vulnerability("Protocol Vulnerabilities", "The ambiguity can be exploited in certain protocols where message length matters.")
      ];

      // Test vectors for zero padding
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e11739317"), // 15 bytes
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393170000000000000000000000000000000000"), // Padded to 32 bytes (15 + 17 padding bytes)
          "Zero padding with 17 bytes needed",
          "Zero padding specification"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"), // 16 bytes (full block)
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"), // No padding needed
          "Zero padding for exact block size",
          "Zero padding specification"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("6bc1bee22e"), // 5 bytes
          OpCodes.Hex8ToBytes("6bc1bee22e000000"), // Padded to 8 bytes
          "Zero padding with 3 bytes needed",
          "Zero padding specification"
        )
      ];

      // Add block sizes for tests
      this.tests.forEach((test, index) => {
        if (index === 0) {
          test.blockSize = 32; // 32-byte block for first test
        } else if (index === 1) {
          test.blockSize = 16; // 16-byte block for second test
        } else {
          test.blockSize = 8; // 8-byte block for third test
        }
      });
    }

    CreateInstance(isInverse = false) {
      return new ZeroPaddingInstance(this, isInverse);
    }
  }

  class ZeroPaddingInstance extends IAlgorithmInstance {
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
     * Add zero padding to data
     * @returns {Array} Padded data
     */
    _addPadding() {
      const data = this.inputBuffer;
      const paddingLength = this.blockSize - (data.length % this.blockSize);

      // Only add padding if needed
      if (paddingLength === this.blockSize) {
        // Data is already exact multiple of block size
        const result = [...data];

        // Clear input buffer
        OpCodes.ClearArray(this.inputBuffer);
        this.inputBuffer = [];

        return result;
      }

      // Create zero padding
      const padding = new Array(paddingLength).fill(0);
      const result = [...data, ...padding];

      // Clear input buffer
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return result;
    }

    /**
     * Remove zero padding from data (WARNING: Ambiguous)
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

      // WARNING: This is ambiguous - we can't distinguish between
      // padding zeros and actual data zeros
      let lastNonZero = paddedData.length - 1;
      while (lastNonZero >= 0 && paddedData[lastNonZero] === 0) {
        lastNonZero--;
      }

      const result = paddedData.slice(0, lastNonZero + 1);

      // Clear input buffer
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return result;
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new ZeroPaddingAlgorithm());

  // ===== EXPORTS =====

  return { ZeroPaddingAlgorithm, ZeroPaddingInstance };
}));