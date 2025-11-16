/*
 * EME (ECB-Mask-ECB) Mode of Operation
 * Wide-block tweakable block cipher mode for format-preserving encryption
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
    root.EME = factory(root.AlgorithmFramework, root.OpCodes);
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

  class EmeAlgorithm extends CipherModeAlgorithm {
    constructor() {
      super();

      this.name = "EME";
      this.description = "EME (ECB-Mask-ECB) is a wide-block tweakable cipher mode that can handle variable-length inputs while preserving format. It uses a three-round construction: ECB encrypt, mask with universal hash, then ECB encrypt again. Primarily used for format-preserving encryption applications.";
      this.inventor = "Shai Halevi, Phillip Rogaway";
      this.year = 2003;
      this.category = CategoryType.MODE;
      this.subCategory = "Wide-Block Tweakable Mode";
      this.securityStatus = SecurityStatus.EXPERIMENTAL; // Research mode for specialized applications
      this.complexity = ComplexityType.RESEARCH;
      this.country = CountryCode.US;

      this.RequiresIV = false; // Uses tweak instead of IV
      this.SupportedIVSizes = []; // Not applicable for EME

      this.documentation = [
        new LinkItem("EME Original Paper", "https://web.cs.ucdavis.edu/~rogaway/papers/eme.pdf"),
        new LinkItem("Wide-Block Encryption", "https://web.cs.ucdavis.edu/~rogaway/papers/wide-block.pdf"),
        new LinkItem("Format-Preserving Encryption", "https://csrc.nist.gov/publications/detail/sp/800-38g/rev-1/draft")
      ];

      this.references = [
        new LinkItem("Academic Implementation", "https://github.com/ciphers/eme-mode"),
        new LinkItem("FPE Libraries", "https://github.com/mysto/python-fpe")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Research Status", "EME mode is primarily used in specialized format-preserving encryption applications and has limited real-world deployment."),
        new Vulnerability("Implementation Complexity", "Requires careful implementation of universal hash functions and proper masking operations.")
      ];

      // Round-trip test vectors for EME mode
      this.tests = [
        {
          text: "EME round-trip test - single block",
          uri: "https://web.cs.ucdavis.edu/~rogaway/papers/eme.pdf",
          input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          tweak: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new EmeModeInstance(this, isInverse);
    }
  }

  /**
 * EmeMode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class EmeModeInstance extends IAlgorithmInstance {
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
      this.key = null;
      this.tweak = null;
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
     * Set the encryption key
     * @param {Array} key - Key for block cipher
     */
    setKey(key) {
      if (!key || key.length === 0) {
        throw new Error("Key cannot be empty");
      }
      this.key = [...key];
    }

    /**
     * Set the tweak value
     * @param {Array} tweak - Tweak value for EME mode
     */
    setTweak(tweak) {
      if (!tweak) {
        throw new Error("Tweak cannot be null");
      }
      this.tweak = [...tweak];
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
      if (!this.key) {
        throw new Error("Key must be set for EME mode.");
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
      if (!this.key) {
        throw new Error("Key must be set for EME mode.");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      const blockSize = this.blockCipher.BlockSize;
      if (this.inputBuffer.length % blockSize !== 0) {
        throw new Error(`Input length must be multiple of ${blockSize} bytes for EME mode`);
      }

      // EME: ECB-Mask-ECB construction (simplified educational implementation)
      const output = [];
      const numBlocks = this.inputBuffer.length / blockSize;

      if (this.isInverse) {
        // EME Decryption: reverse the ECB-Mask-ECB process

        // Step 1: First ECB decryption layer
        const layer1 = [];
        for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
          const block = this.inputBuffer.slice(i, i + blockSize);
          const decryptCipher = this.blockCipher.algorithm.CreateInstance(true);
          decryptCipher.key = this.key;
          decryptCipher.Feed(block);
          const decrypted = decryptCipher.Result();
          layer1.push(...decrypted);
        }

        // Step 2: Remove mask (simplified - real EME uses complex universal hash)
        const unmasked = [];
        for (let i = 0; i < layer1.length; i += blockSize) {
          const block = layer1.slice(i, i + blockSize);
          const mask = this._generateMask(i / blockSize, numBlocks);
          const unmaskedBlock = OpCodes.XorArrays(block, mask);
          unmasked.push(...unmaskedBlock);
        }

        // Step 3: Second ECB decryption layer
        for (let i = 0; i < unmasked.length; i += blockSize) {
          const block = unmasked.slice(i, i + blockSize);
          const decryptCipher = this.blockCipher.algorithm.CreateInstance(true);
          decryptCipher.key = this.key;
          decryptCipher.Feed(block);
          const plainBlock = decryptCipher.Result();
          output.push(...plainBlock);
        }

      } else {
        // EME Encryption: ECB-Mask-ECB process

        // Step 1: First ECB encryption layer
        const layer1 = [];
        for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
          const block = this.inputBuffer.slice(i, i + blockSize);
          const encryptCipher = this.blockCipher.algorithm.CreateInstance(false);
          encryptCipher.key = this.key;
          encryptCipher.Feed(block);
          const encrypted = encryptCipher.Result();
          layer1.push(...encrypted);
        }

        // Step 2: Apply mask (simplified - real EME uses complex universal hash)
        const masked = [];
        for (let i = 0; i < layer1.length; i += blockSize) {
          const block = layer1.slice(i, i + blockSize);
          const mask = this._generateMask(i / blockSize, numBlocks);
          const maskedBlock = OpCodes.XorArrays(block, mask);
          masked.push(...maskedBlock);
        }

        // Step 3: Second ECB encryption layer
        for (let i = 0; i < masked.length; i += blockSize) {
          const block = masked.slice(i, i + blockSize);
          const encryptCipher = this.blockCipher.algorithm.CreateInstance(false);
          encryptCipher.key = this.key;
          encryptCipher.Feed(block);
          const cipherBlock = encryptCipher.Result();
          output.push(...cipherBlock);
        }
      }

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return output;
    }

    /**
     * Generate mask for EME mode (simplified educational version)
     * Real EME uses sophisticated universal hash functions
     * @param {number} blockIndex - Current block index
     * @param {number} totalBlocks - Total number of blocks
     * @returns {Array} Mask bytes
     */
    _generateMask(blockIndex, totalBlocks) {
      const blockSize = this.blockCipher.BlockSize;
      const mask = new Array(blockSize);

      // Simplified mask generation using tweak and block position
      for (let i = 0; i < blockSize; i++) {
        let maskByte = blockIndex + totalBlocks;
        if (this.tweak && i < this.tweak.length) {
          maskByte ^= this.tweak[i];
        }
        mask[i] = (maskByte + i) & 0xFF;
      }

      return mask;
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new EmeAlgorithm());

  // ===== EXPORTS =====

  return { EmeAlgorithm, EmeModeInstance };
}));