/*
 * ISO 10126 Padding Scheme
 * Pads with random bytes except last byte indicates padding length
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

  class Iso10126Algorithm extends PaddingAlgorithm {
    constructor() {
      super();

      this.name = "ISO 10126";
      this.description = "ISO 10126 padding scheme fills blocks with random bytes except for the last byte, which indicates the padding length. This approach provides some confusion to attackers but the standard has been withdrawn due to security concerns and implementation issues.";
      this.inventor = "ISO/IEC";
      this.year = 1991;
      this.category = CategoryType.PADDING;
      this.subCategory = "Random Padding";
      this.securityStatus = SecurityStatus.DEPRECATED; // Withdrawn standard
      this.complexity = ComplexityType.SIMPLE;
      this.country = CountryCode.INTERNATIONAL;

      this.documentation = [
        new LinkItem("ISO/IEC 10126 (Withdrawn)", "https://www.iso.org/standard/18101.html"),
        new LinkItem("Padding Attack Vulnerabilities", "https://en.wikipedia.org/wiki/Padding_oracle_attack"),
        new LinkItem("Cryptographic Padding Methods", "https://tools.ietf.org/rfc/rfc3852.txt")
      ];

      this.references = [
        new LinkItem("ISO/IEC Standards", "https://www.iso.org/committee/45144.html"),
        new LinkItem("Block Cipher Modes", "https://csrc.nist.gov/publications/detail/sp/800-38a/final"),
        new LinkItem("Withdrawn Cryptographic Standards", "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Standard Withdrawn", "ISO 10126 has been withdrawn due to security and implementation concerns. Modern systems should use PKCS#7 or other standardized padding."),
        new Vulnerability("Padding Oracle Attacks", "Random padding can be vulnerable to timing attacks and padding oracle attacks if error handling reveals padding validity."),
        new Vulnerability("Implementation Complexity", "Random padding requires secure random number generation and careful implementation to avoid weaknesses.")
      ];

      // Educational test vectors (note: random bytes vary)
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e11739317"), // 15 bytes
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393170000000000000000000000000000000011"), // Example: 16 zero bytes + 0x11 (17 padding bytes)
          "ISO 10126 padding example (random bytes vary)",
          "ISO/IEC 10126 (Withdrawn)"
        )
      ];

      // Add block size and test mode for test
      this.tests.forEach(test => {
        test.blockSize = 32; // 32-byte block
        test.testMode = true; // Enable deterministic padding for testing
      });
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Iso10126Instance(this, isInverse);
    }
  }

  /**
 * Iso10126 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Iso10126Instance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this.blockSize = 16; // Default block size
      this.testMode = false; // Use deterministic padding for testing
      this._seed = null;
      this._rngState = 0;
    }

    /**
     * Set seed for deterministic random number generation
     * Used for testing purposes to make padding reproducible
     * @param {Array} seedBytes - Seed bytes for PRNG initialization
     */
    set seed(seedBytes) {
      if (!seedBytes) {
        this._seed = null;
        this._rngState = 0;
        return;
      }
      this._seed = [...seedBytes];
      // Initialize RNG state from seed using simple hash
      this._rngState = 0;
      for (let i = 0; i < this._seed.length; i++) {
        this._rngState = ((this._rngState * 31) + this._seed[i]) >>> 0;
      }
      // Ensure non-zero state
      if (this._rngState === 0) this._rngState = 1;
    }

    get seed() {
      return this._seed ? [...this._seed] : null;
    }

    /**
     * Generate deterministic or secure random byte
     * @returns {number} Random byte (0-255)
     */
    _getRandomByte() {
      if (this.testMode) {
        // Test mode: Use zeros for deterministic testing
        return 0x00;
      } else if (this._seed) {
        // Deterministic: Linear Congruential Generator
        // Using MINSTD parameters (a=48271, c=0, m=2^31-1)
        this._rngState = (this._rngState * 48271) % 0x7FFFFFFF;
        return this._rngState & 0xFF;
      } else {
        // Non-deterministic: Use secure random
        return OpCodes.SecureRandom(256);
      }
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
     * Add ISO 10126 padding to data
     * @returns {Array} Padded data
     */
    _addPadding() {
      const data = this.inputBuffer;
      const paddingLength = this.blockSize - (data.length % this.blockSize);

      // Create padding: random bytes followed by length byte
      const padding = [];

      // Add random bytes (padding length - 1)
      for (let i = 0; i < paddingLength - 1; i++) {
        // Use seeded PRNG if seed set, otherwise secure random
        padding.push(this._getRandomByte());
      }

      // Add length byte
      padding.push(paddingLength);

      const result = [...data, ...padding];

      // Clear input buffer
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return result;
    }

    /**
     * Remove ISO 10126 padding from data
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

      // Validate padding length
      if (paddingLength < 1 || paddingLength > this.blockSize) {
        throw new Error("Invalid ISO 10126 padding length");
      }

      // Validate we have enough data
      if (paddingLength > paddedData.length) {
        throw new Error("Invalid ISO 10126 padding - padding length exceeds data length");
      }

      const result = paddedData.slice(0, paddedData.length - paddingLength);

      // Clear input buffer
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return result;
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new Iso10126Algorithm());

  // ===== EXPORTS =====

  return { Iso10126Algorithm, Iso10126Instance };
}));