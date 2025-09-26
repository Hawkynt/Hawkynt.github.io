/*
 * DoubleKing Block Cipher Implementation - FIXED VERSION
 * Based on Tim van Dijk's Python reference implementation
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 *
 * DoubleKing is BaseKing adapted for 32-bit words instead of 16-bit words.
 * This allows for more efficient implementation on ARM architectures.
 * Uses 384-bit blocks and 384-bit keys (12 × 32-bit words).
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

  class DoubleKingAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "DoubleKing";
      this.description = "384-bit block cipher with 384-bit key using 32-bit words. BaseKing variant designed by Tim van Dijk for ARM architecture efficiency. Uses 11 rounds plus final transformation.";
      this.inventor = "Tim van Dijk";
      this.year = 2017;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.NL;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(48, 48, 0) // Fixed 384-bit key
      ];
      this.SupportedBlockSizes = [
        new KeySize(48, 48, 0) // Fixed 384-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Tim van Dijk's Bachelor Thesis", "https://www.cs.ru.nl/bachelors-theses/2017/Tim_van_Dijk___4477073___A_high-performance_threshold_implementation_of_a_BaseKing_variant_on_an_ARM_architecture.pdf"),
        new LinkItem("Joan Daemen's Doctoral Dissertation", "Cipher and hash function design strategies based on linear and differential cryptanalysis")
      ];

      this.references = [
        new LinkItem("Joan Daemen Research Page", "https://cs.ru.nl/~joan/JoanDaemenResearch.html"),
        new LinkItem("Tim van Dijk's Python Reference Implementation", "DoubleKing.py from Bachelor thesis")
      ];

      // Test vectors (corrected based on Python reference implementation)
      this.tests = [
        {
          text: "All zeros test vector",
          uri: "Tim van Dijk's Python reference implementation",
          input: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
          key: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
          expected: [118,235,81,66,153,52,54,145,92,30,230,164,57,178,111,39,232,76,55,179,23,232,13,240,174,85,25,2,30,18,104,85,77,118,116,156,224,255,128,74,78,163,231,124,213,135,12,212]
        },
        {
          text: "All ones test vector",
          uri: "Tim van Dijk's Python reference implementation",
          input: [255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255],
          key: [255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255],
          expected: [168,160,180,161,131,234,23,143,251,74,29,136,108,187,65,90,183,200,26,191,24,79,115,101,138,138,183,47,186,208,182,102,14,199,123,165,12,134,93,38,44,108,180,117,7,146,11,96]
        },
        {
          text: "Sequential pattern test vector",
          uri: "Tim van Dijk's Python reference implementation",
          input: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47],
          key: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48],
          expected: [152,199,174,143,147,104,204,103,136,135,192,5,9,240,137,227,98,239,47,47,243,3,207,209,126,160,34,150,22,46,172,177,83,3,16,132,59,68,193,207,21,73,57,152,203,74,242,179]
        }
      ];

      // Algorithm constants (from Tim van Dijk's Python reference)
      this.NUM_WORDS = 12;       // 12 words × 32 bits = 384 bits
      this.BLOCK_SIZE = 48;      // 48 bytes = 384 bits
      this.NUM_ROUNDS = 11;      // 11 rounds
      this.MAX_BITS = 32;        // 32-bit words

      // Constants from Tim van Dijk's reference implementation (DoubleKing.py)
      this.ROUND_CONSTANTS_TEMPLATE = [0, 0, -1, -1, 0, 0, 0, 0, -1, -1, 0, 0];
      this.ROUND_CONSTANTS = [11, 22, 44, 88, 176, 113, 226, 213, 187, 103, 206, 141];
      this.ROTATION_CONSTANTS = [0, 1, 3, 6, 10, 15, 21, 28, 4, 13, 23, 2];
      this.DIFFUSION_CONSTANTS = [0, 2, 6, 7, 9, 10, 11];
    }

    CreateInstance(isInverse = false) {
      return new DoubleKingInstance(this, isInverse);
    }

    // Circular rotate left (32-bit) using OpCodes
    rol32(val, r_bits = 1) {
      return OpCodes.RotL32(val, r_bits);
    }

    // Circular rotate right (32-bit) using OpCodes
    ror32(val, r_bits = 1) {
      return OpCodes.RotR32(val, r_bits);
    }

    // Add cipher key and round constant to the state
    keyAddition(mode, block, key, r) {
      const result = [...block];

      if (mode === 'enc') {
        // Encryption mode
        const template = [...this.ROUND_CONSTANTS_TEMPLATE];
        for (let i = 0; i < 12; i++) {
          const roundConstValue = template[i] === -1 ? this.ROUND_CONSTANTS[r] : template[i];
          result[i] = block[i] ^ key[i] ^ roundConstValue;
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
          result[i] = block[i] ^ key[i] ^ diffusedTemplate[i];
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

    // Shift each 32-bit word in the state the amount specified in ROTATION_CONSTANTS to the left
    earlyShift(block) {
      const result = new Array(12);
      for (let i = 0; i < 12; i++) {
        result[i] = this.rol32(block[i], this.ROTATION_CONSTANTS[i]);
      }
      return result;
    }

    // Nonlinear transformation of words (the gamma operation)
    sBox(block) {
      const result = new Array(12);
      for (let i = 0; i < 12; i++) {
        result[i] = block[i] ^ (block[(i + 4) % 12] | (~block[(i + 8) % 12] >>> 0));
      }
      return result;
    }

    // Shift each word in the state the amount specified in ROTATION_CONSTANTS to the right
    lateShift(block) {
      const result = new Array(12);
      for (let i = 0; i < 12; i++) {
        result[i] = this.ror32(block[i], this.ROTATION_CONSTANTS[this.NUM_ROUNDS - i]);
      }
      return result;
    }

    // Core DoubleKing algorithm (encrypts if mode is 'enc', decrypts if mode is 'dec')
    doubleKing(block, key, mode) {
      let state = [...block];

      // DoubleKing has 11 rounds...
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

  class DoubleKingInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse) {
      super();
      this.algorithm = algorithm;
      this.isInverse = isInverse;
      this._key = null;
      this.keyWords = null;
      this.inputBuffer = [];

      // Properties
      this.BlockSize = 48; // 384 bits
      this.KeySize = 0;
    }

    // Property setter for key
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

      // Convert byte array to 32-bit words (big-endian) using OpCodes
      this.keyWords = [];
      for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
        this.keyWords[i] = OpCodes.Pack32BE(
          keyBytes[i * 4],
          keyBytes[i * 4 + 1],
          keyBytes[i * 4 + 2],
          keyBytes[i * 4 + 3]
        );
      }

      // For decryption, transform the key (as per Python reference)
      if (this.isInverse) {
        // Compute the inverse key first
        this.keyWords = this.algorithm.diffusion(this.keyWords);
        this.keyWords = this.keyWords.reverse();
      }
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      this.inputBuffer.push(...data);
    }

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
      // Convert bytes to 32-bit words (big-endian) using OpCodes
      const words = [];
      for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
        words[i] = OpCodes.Pack32BE(
          block[i * 4],
          block[i * 4 + 1],
          block[i * 4 + 2],
          block[i * 4 + 3]
        );
      }

      // Apply DoubleKing encryption
      const result = this.algorithm.doubleKing(words, this.keyWords, 'enc');

      // Convert words back to bytes (big-endian) using OpCodes
      const outputBytes = new Array(this.algorithm.BLOCK_SIZE);
      for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
        const bytes = OpCodes.Unpack32BE(result[i]);
        outputBytes[i * 4] = bytes[0];
        outputBytes[i * 4 + 1] = bytes[1];
        outputBytes[i * 4 + 2] = bytes[2];
        outputBytes[i * 4 + 3] = bytes[3];
      }

      return outputBytes;
    }

    _decryptBlock(block) {
      // Convert bytes to 32-bit words (big-endian) using OpCodes
      const words = [];
      for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
        words[i] = OpCodes.Pack32BE(
          block[i * 4],
          block[i * 4 + 1],
          block[i * 4 + 2],
          block[i * 4 + 3]
        );
      }

      // Apply DoubleKing decryption (using same algorithm with preprocessed key)
      const result = this.algorithm.doubleKing(words, this.keyWords, 'dec');

      // Convert words back to bytes (big-endian) using OpCodes
      const outputBytes = new Array(this.algorithm.BLOCK_SIZE);
      for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
        const bytes = OpCodes.Unpack32BE(result[i]);
        outputBytes[i * 4] = bytes[0];
        outputBytes[i * 4 + 1] = bytes[1];
        outputBytes[i * 4 + 2] = bytes[2];
        outputBytes[i * 4 + 3] = bytes[3];
      }

      return outputBytes;
    }
  }

  // Register the algorithm immediately
  if (AlgorithmFramework && AlgorithmFramework.RegisterAlgorithm) {
    AlgorithmFramework.RegisterAlgorithm(new DoubleKingAlgorithm());
  }

  return DoubleKingAlgorithm;
}));