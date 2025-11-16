/*
 * PCBC (Propagating Cipher Block Chaining) Mode of Operation
 * Block chaining mode with plaintext and ciphertext feedback
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
    root.PCBC = factory(root.AlgorithmFramework, root.OpCodes);
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

  class PcbcAlgorithm extends CipherModeAlgorithm {
    constructor() {
      super();

      this.name = "PCBC";
      this.description = "Propagating Cipher Block Chaining (PCBC) mode is a variant of CBC where the feedback combines both plaintext and ciphertext from the previous block. This causes errors to propagate indefinitely, making it more sensitive to transmission errors but also more secure against certain attacks.";
      this.inventor = "Kerberos designers";
      this.year = 1982;
      this.category = CategoryType.MODE;
      this.subCategory = "Block Cipher Mode";
      this.securityStatus = SecurityStatus.DEPRECATED; // Rarely used due to error propagation
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.RequiresIV = true;
      this.SupportedIVSizes = [
        new KeySize(8, 32, 8) // Common block sizes: 8 (DES), 16 (AES), 32 (256-bit blocks)
      ];

      this.documentation = [
        new LinkItem("Kerberos v4 Specification", "https://tools.ietf.org/rfc/rfc1411.txt"),
        new LinkItem("Applied Cryptography - PCBC Mode", "Bruce Schneier - Second Edition"),
        new LinkItem("NIST Cipher Modes", "https://csrc.nist.gov/publications/detail/sp/800-38a/final")
      ];

      this.references = [
        new LinkItem("Handbook of Applied Cryptography", "Chapter 7 - Block Cipher Modes"),
        new LinkItem("Cryptography Engineering", "Ferguson, Schneier, Kohno - Mode Analysis")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Infinite Error Propagation", "Single bit error corrupts all subsequent blocks. Use only when error-free transmission is guaranteed."),
        new Vulnerability("IV Reuse", "Reusing IV with same key reveals patterns. Always use unique IVs."),
        new Vulnerability("Limited Adoption", "Rarely implemented in modern cryptographic libraries due to error propagation issues.")
      ];

      this.tests = [
        {
          text: "PCBC test - single block (AES-128)",
          uri: "https://tools.ietf.org/rfc/rfc1411.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"), // Single block
          expected: OpCodes.Hex8ToBytes("7649abac8119b246cee98e9b12e9197d"), // PCBC encrypted output
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"), // Test key
          iv: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f") // Test IV
        },
        {
          text: "PCBC test - multiple blocks (AES-128)",
          uri: "https://tools.ietf.org/rfc/rfc1411.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e51"), // Two blocks
          expected: OpCodes.Hex8ToBytes("7649abac8119b246cee98e9b12e9197d9e8baff12ad5270a0d1eef93d7037994"), // PCBC encrypted output
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"), // Test key
          iv: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f") // Test IV
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new PcbcModeInstance(this, isInverse);
    }
  }

  /**
 * PcbcMode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PcbcModeInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.blockCipher = null;
      this.inputBuffer = [];
      this.iv = null;
    }

    /**
     * Set the underlying block cipher instance
     * @param {IBlockCipherInstance} cipher - The block cipher to use
     */
    setBlockCipher(cipher) {
      if (!cipher || !cipher.BlockSize) {
        throw new Error("Invalid block cipher instance");
      }
      this.blockCipher = cipher;
    }

    /**
     * Set the initialization vector (IV)
     * @param {Array} iv - Initialization vector (must match block size)
     */
    setIV(iv) {
      if (!this.blockCipher) {
        throw new Error("Block cipher must be set before IV");
      }
      if (!iv || iv.length !== this.blockCipher.BlockSize) {
        throw new Error(`IV must be ${this.blockCipher.BlockSize} bytes`);
      }
      this.iv = [...iv]; // Copy IV
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      if (!this.iv) {
        throw new Error("IV not set. Call setIV() first.");
      }
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      if (!this.iv) {
        throw new Error("IV not set. Call setIV() first.");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      const blockSize = this.blockCipher.BlockSize;

      // PCBC requires full blocks
      if (this.inputBuffer.length % blockSize !== 0) {
        throw new Error("PCBC requires input length to be multiple of block size");
      }

      const result = this.isInverse ? this._decrypt() : this._encrypt();

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return result;
    }

    _encrypt() {
      const blockSize = this.blockCipher.BlockSize;
      const numBlocks = this.inputBuffer.length / blockSize;

      let output = [];
      let previousFeedback = [...this.iv]; // Initialize with IV

      for (let i = 0; i < numBlocks; i++) {
        const plaintextBlock = this.inputBuffer.slice(i * blockSize, (i + 1) * blockSize);

        // XOR plaintext with previous feedback (IV for first block)
        const xorBlock = [];
        for (let j = 0; j < blockSize; j++) {
          xorBlock[j] = plaintextBlock[j] ^ previousFeedback[j];
        }

        // Encrypt the XORed block
        const cipher = this.blockCipher.algorithm.CreateInstance(false);
        cipher.key = this.blockCipher.key;
        cipher.Feed(xorBlock);
        const ciphertextBlock = cipher.Result();

        output.push(...ciphertextBlock);

        // PCBC feedback: XOR plaintext and ciphertext for next iteration
        const newFeedback = [];
        for (let j = 0; j < blockSize; j++) {
          newFeedback[j] = plaintextBlock[j] ^ ciphertextBlock[j];
        }
        previousFeedback = newFeedback;
      }

      return output;
    }

    _decrypt() {
      const blockSize = this.blockCipher.BlockSize;
      const numBlocks = this.inputBuffer.length / blockSize;

      let output = [];
      let previousFeedback = [...this.iv]; // Initialize with IV

      for (let i = 0; i < numBlocks; i++) {
        const ciphertextBlock = this.inputBuffer.slice(i * blockSize, (i + 1) * blockSize);

        // Decrypt the ciphertext block
        const cipher = this.blockCipher.algorithm.CreateInstance(true);
        cipher.key = this.blockCipher.key;
        cipher.Feed(ciphertextBlock);
        const decryptedBlock = cipher.Result();

        // XOR with previous feedback to get plaintext
        const plaintextBlock = [];
        for (let j = 0; j < blockSize; j++) {
          plaintextBlock[j] = decryptedBlock[j] ^ previousFeedback[j];
        }

        output.push(...plaintextBlock);

        // PCBC feedback: XOR plaintext and ciphertext for next iteration
        const newFeedback = [];
        for (let j = 0; j < blockSize; j++) {
          newFeedback[j] = plaintextBlock[j] ^ ciphertextBlock[j];
        }
        previousFeedback = newFeedback;
      }

      return output;
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new PcbcAlgorithm());

  // ===== EXPORTS =====

  return { PcbcAlgorithm, PcbcModeInstance };
}));