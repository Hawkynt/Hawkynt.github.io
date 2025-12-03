/*
 * BaseKing Block Cipher Implementation - FIXED VERSION
 * Based on Tim van Dijk's Python reference implementation
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 *
 * BaseKing is a 192-bit block cipher designed by Joan Daemen.
 * This implementation is based on the correct reference from Tim van Dijk's
 * Bachelor Thesis which shows the proper way to handle decryption.
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
 * BaseKingAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class BaseKingAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BaseKing";
      this.description = "192-bit block cipher with 192-bit key size using 11 rounds plus final transformation.";
      this.inventor = "Joan Daemen";
      this.year = 1994;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BE;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(24, 24, 0) // Fixed 192-bit key
      ];
      this.SupportedBlockSizes = [
        new KeySize(24, 24, 0) // Fixed 192-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Tim van Dijk's Bachelor Thesis", "https://www.cs.ru.nl/bachelors-theses/2017/Tim_van_Dijk___4477073___A_high-performance_threshold_implementation_of_a_BaseKing_variant_on_an_ARM_architecture.pdf"),
        new LinkItem("Joan Daemen's Doctoral Dissertation", "Cipher and hash function design strategies based on linear and differential cryptanalysis")
      ];

      this.references = [
        new LinkItem("Joan Daemen Research Page", "https://cs.ru.nl/~joan/JoanDaemenResearch.html"),
        new LinkItem("Tim van Dijk's Python Reference Implementation", "BaseKing.py and DoubleKing.py from Bachelor thesis")
      ];

      // Test vectors (corrected based on Python reference implementation)
      this.tests = [
        {
          text: "All zeros test vector",
          uri: "Tim van Dijk's Python reference implementation",
          input: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
          key: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
          expected: [56,1,79,37,111,83,70,136,16,66,109,241,142,115,4,184,163,8,74,93,163,208,26,148]
        },
        {
          text: "All ones test vector",
          uri: "Tim van Dijk's Python reference implementation",
          input: [255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255],
          key: [255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255],
          expected: [68,80,157,99,42,46,126,204,167,114,2,171,140,170,244,63,156,119,209,32,90,139,108,209]
        },
        {
          text: "Sequential pattern test vector",
          uri: "Tim van Dijk's Python reference implementation",
          input: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
          key: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24],
          expected: [165,108,195,30,229,81,12,65,237,102,208,27,93,6,34,68,70,37,201,116,20,122,115,40]
        }
      ];

      // Algorithm constants (from Tim van Dijk's Python reference)
      this.NUM_WORDS = 12;       // 12 words × 16 bits = 192 bits
      this.BLOCK_SIZE = 24;      // 24 bytes = 192 bits
      this.NUM_ROUNDS = 11;      // 11 rounds
      this.MAX_BITS = 16;        // 16-bit words

      // Constants from Tim van Dijk's reference implementation
      this.ROUND_CONSTANTS_TEMPLATE = [0, 0, -1, -1, 0, 0, 0, 0, -1, -1, 0, 0];
      this.ROUND_CONSTANTS = [11, 22, 44, 88, 176, 113, 226, 213, 187, 103, 206, 141];
      this.ROTATION_CONSTANTS = [0, 8, 1, 15, 5, 10, 7, 6, 13, 14, 2, 3];
      this.DIFFUSION_CONSTANTS = [0, 2, 6, 7, 9, 10, 11];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new BaseKingInstance(this, isInverse);
    }

    // Circular rotate left (16-bit) using OpCodes
    rol16(val, r_bits = 1) {
      return OpCodes.RotL16(val, r_bits);
    }

    // Circular rotate right (16-bit) using OpCodes
    ror16(val, r_bits = 1) {
      return OpCodes.RotR16(val, r_bits);
    }

    // Add cipher key and round constant to the state
    keyAddition(mode, block, key, r) {
      const result = [...block];

      if (mode === 'enc') {
        // Encryption mode
        const template = [...this.ROUND_CONSTANTS_TEMPLATE];
        for (let i = 0; i < 12; i++) {
          const roundConstValue = template[i] === -1 ? this.ROUND_CONSTANTS[r] : template[i];
          result[i] = OpCodes.XorN(OpCodes.XorN(block[i], key[i]), roundConstValue);
        }
      } else if (mode === 'dec') {
        // Decryption mode - different round constant handling
        const template = [...this.ROUND_CONSTANTS_TEMPLATE];
        for (let i = 0; i < template.length; i++) {
          if (template[i] === -1) {
            template[i] = this.ROUND_CONSTANTS[this.NUM_ROUNDS - r];
          }
        }
        const diffusedTemplate = this.diffusion([...template.reverse()]);

        for (let i = 0; i < 12; i++) {
          result[i] = OpCodes.XorN(OpCodes.XorN(block[i], key[i]), diffusedTemplate[i]);
        }
      }

      return result;
    }

    // Transform the words with a linear transformation of high diffusion
    diffusion(block) {
      const result = new Array(12);
      for (let i = 0; i < 12; i++) {
        result[i] = 0;
        for (const offset of this.DIFFUSION_CONSTANTS) {
          result[i] ^= block[(i + offset) % 12];
        }
      }
      return result;
    }

    // Shift each 16-bit word in the state the amount specified in ROTATION_CONSTANTS to the left
    earlyShift(block) {
      const result = new Array(12);
      for (let i = 0; i < 12; i++) {
        result[i] = this.rol16(block[i], this.ROTATION_CONSTANTS[i]);
      }
      return result;
    }

    // Nonlinear transformation of words (the gamma operation)
    sBox(block) {
      const result = new Array(12);
      for (let i = 0; i < 12; i++) {
        result[i] = OpCodes.XorN(block[i], OpCodes.OrN(block[(i + 4) % 12], OpCodes.AndN(~block[(i + 8) % 12], 0xFFFF)));
      }
      return result;
    }

    // Shift each word in the state the amount specified in ROTATION_CONSTANTS to the right
    lateShift(block) {
      const result = new Array(12);
      for (let i = 0; i < 12; i++) {
        result[i] = this.ror16(block[i], this.ROTATION_CONSTANTS[this.NUM_ROUNDS - i]);
      }
      return result;
    }

    // Core BaseKing algorithm (encrypts if mode is 'enc', decrypts if mode is 'dec')
    baseKing(block, key, mode) {
      let state = [...block];

      // BaseKing has 11 rounds...
      for (let r = 0; r < this.NUM_ROUNDS; r++) {
        state = this.keyAddition(mode, state, key, r);
        state = this.diffusion(state);
        state = this.earlyShift(state);
        state = this.sBox(state);
        state = this.lateShift(state);
      }

      // ... and 1 final output transformation
      state = this.keyAddition(mode, state, key, this.NUM_ROUNDS);
      state = this.diffusion(state);

      // Invert the order of the words
      return state.reverse();
    }
  }

  // ===== INSTANCE CLASS =====

  /**
 * BaseKing cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class BaseKingInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse) {
      super();
      this.algorithm = algorithm;
      this.isInverse = isInverse;
      this._key = null;
      this.keyWords = null;
      this.inputBuffer = [];

      // Properties
      this.BlockSize = 24; // 192 bits
      this.KeySize = 0;
    }

    // Property setter for key
    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.keyWords = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
        (ks.stepSize === 0 || (keyBytes.length - ks.minSize) % ks.stepSize === 0)
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;

      // Convert byte array to 16-bit words (big-endian) using OpCodes
      this.keyWords = [];
      for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
        this.keyWords[i] = OpCodes.Pack16BE(keyBytes[i * 2], keyBytes[i * 2 + 1]);
      }

      // For decryption, transform the key (as per Python reference)
      if (this.isInverse) {
        // Compute the inverse key first
        this.keyWords = this.algorithm.diffusion(this.keyWords);
        this.keyWords = this.keyWords.reverse();
      }
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Validate input length
      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
      }

      const output = [];

      // Process each block
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        const processedBlock = this.isInverse
          ? this._decryptBlock(block)
          : this._encryptBlock(block);
        output.push(...processedBlock);
      }

      // Clear input buffer securely using OpCodes
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return output;
    }

    _encryptBlock(block) {
      // Convert bytes to 16-bit words (big-endian) using OpCodes
      const words = [];
      for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
        words[i] = OpCodes.Pack16BE(block[i * 2], block[i * 2 + 1]);
      }

      // Apply BaseKing encryption
      const result = this.algorithm.baseKing(words, this.keyWords, 'enc');

      // Convert words back to bytes (big-endian) using OpCodes
      const outputBytes = new Array(this.algorithm.BLOCK_SIZE);
      for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
        const bytes = OpCodes.Unpack16BE(result[i]);
        outputBytes[i * 2] = bytes[0];
        outputBytes[i * 2 + 1] = bytes[1];
      }

      return outputBytes;
    }

    _decryptBlock(block) {
      // Convert bytes to 16-bit words (big-endian) using OpCodes
      const words = [];
      for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
        words[i] = OpCodes.Pack16BE(block[i * 2], block[i * 2 + 1]);
      }

      // Apply BaseKing decryption (using same algorithm with preprocessed key)
      const result = this.algorithm.baseKing(words, this.keyWords, 'dec');

      // Convert words back to bytes (big-endian) using OpCodes
      const outputBytes = new Array(this.algorithm.BLOCK_SIZE);
      for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
        const bytes = OpCodes.Unpack16BE(result[i]);
        outputBytes[i * 2] = bytes[0];
        outputBytes[i * 2 + 1] = bytes[1];
      }

      return outputBytes;
    }
  }

  // Register the algorithm immediately
  if (AlgorithmFramework && AlgorithmFramework.RegisterAlgorithm) {
    AlgorithmFramework.RegisterAlgorithm(new BaseKingAlgorithm());
  }

  return BaseKingAlgorithm;
}));