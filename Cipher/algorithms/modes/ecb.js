/*
 * ECB (Electronic Codebook) Mode of Operation
 * Educational implementation of the simplest block cipher mode
 * WARNING: ECB mode reveals patterns in plaintext - not secure for most applications
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
    root.ECB = factory(root.AlgorithmFramework, root.OpCodes);
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

  class EcbAlgorithm extends CipherModeAlgorithm {
    constructor() {
      super();

      this.name = "ECB";
      this.description = "Electronic Codebook mode encrypts each block independently using the underlying block cipher. This is the simplest mode but reveals patterns in plaintext data, making it unsuitable for most cryptographic applications. Educational implementation for learning cipher modes.";
      this.inventor = "US National Bureau of Standards";
      this.year = 1977;
      this.category = CategoryType.MODE;
      this.subCategory = "Block Cipher Mode";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      this.RequiresIV = false;
      this.SupportedIVSizes = []; // ECB doesn't use IV

      this.documentation = [
        new LinkItem("NIST SP 800-38A", "https://csrc.nist.gov/publications/detail/sp/800-38a/final"),
        new LinkItem("FIPS 81 (Historical)", "https://csrc.nist.gov/csrc/media/publications/fips/81/archive/1980-12-02/documents/fips81.pdf")
      ];

      this.references = [
        new LinkItem("Cryptography Engineering", "Chapter on block cipher modes"),
        new LinkItem("Applied Cryptography", "Bruce Schneier - Chapter 9")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Pattern Leakage", "Identical plaintext blocks produce identical ciphertext blocks, revealing patterns"),
        new Vulnerability("Block Replay", "Individual blocks can be extracted and replayed in different positions"),
        new Vulnerability("Known Plaintext", "If attacker knows one block plaintext/ciphertext pair, identical blocks elsewhere are compromised")
      ];

      this.tests = [
        {
          text: "AES-128 ECB test vector",
          uri: "NIST SP 800-38A",
          input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          cipher: "AES",
          expected: OpCodes.Hex8ToBytes("3ad77bb40d7a3660a89ecaf32466ef97")
        },
        {
          text: "AES-128 ECB second block",
          uri: "NIST SP 800-38A",
          input: OpCodes.Hex8ToBytes("ae2d8a571e03ac9c9eb76fac45af8e51"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          cipher: "AES",
          expected: OpCodes.Hex8ToBytes("f5d3d58503b9699de785895a96fdbaaf")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new EcbModeInstance(this, isInverse);
    }
  }

  /**
 * EcbMode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class EcbModeInstance extends IAlgorithmInstance {
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
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
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
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      const blockSize = this.blockCipher.BlockSize;
      if (this.inputBuffer.length % blockSize !== 0) {
        throw new Error(`Input length must be multiple of ${blockSize} bytes for ECB mode`);
      }

      const output = [];

      // Process each block independently
      // ECB applies the block cipher to each block separately
      for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
        const block = this.inputBuffer.slice(i, i + blockSize);

        // Use the provided block cipher directly
        // The cipher should already be configured for encryption or decryption
        this.blockCipher.Feed(block);
        const processedBlock = this.blockCipher.Result();

        output.push(...processedBlock);
      }

      // Clear input buffer for next operation
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return output;
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new EcbAlgorithm());

  // ===== EXPORTS =====

  return { EcbAlgorithm, EcbModeInstance };
}));