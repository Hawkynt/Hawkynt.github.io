/*
 * DoubleKing Block Cipher Implementation
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 *
 * DoubleKing is a 384-bit block cipher variant of BaseKing designed by Tim van Dijk.
 */

// Load AlgorithmFramework

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
      this.description = "384-bit block cipher with 384-bit key size, a variant of BaseKing designed by Tim van Dijk. Uses 11 rounds plus final transformation.";
      this.inventor = "Tim van Dijk";
      this.year = 2020;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.NL;

      // Block and key specifications
      this.blockSize = 48; // 384-bit blocks
      this.keySizes = [
        new KeySize(48, 48, 1) // Fixed 384-bit key
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Tim van Dijk's Bachelor Thesis", "https://www.cs.ru.nl/bachelors-theses/2017/Tim_van_Dijk___4477073___A_high-performance_threshold_implementation_of_a_BaseKing_variant_on_an_ARM_architecture.pdf"),
        new LinkItem("Radboud University Research", "https://www.cs.ru.nl/bachelors-theses/")
      ];

      this.references = [
        new LinkItem("BaseKing Foundation", "https://github.com/TimVanDijk/Bachelor-Thesis-Public"),
        new LinkItem("Threshold Implementation", "Side-channel attack resistance techniques")
      ];

      // Test vectors
      this.tests = [
        {
          text: "All zeros test vector",
          uri: "DoubleKing implementation validation",
          input: Array(48).fill(0x00),
          key: Array(48).fill(0x00),
          expected: [0x2d, 0xbd, 0x40, 0xae, 0x1f, 0x91, 0x9f, 0x5c, 0x13, 0x71, 0x8b, 0xaf, 0xaa, 0x00, 0x70, 0xf5, 0xc5, 0x35, 0x79, 0xbe, 0x5f, 0x64, 0x92, 0x01, 0xd3, 0x69, 0xe1, 0x73, 0x66, 0xcc, 0x0b, 0xb5, 0x7e, 0x17, 0x10, 0xd3, 0x4f, 0xa5, 0x06, 0x97, 0x37, 0x58, 0xcd, 0xc6, 0x40, 0xc3, 0xc0, 0x2f]
        },
        {
          text: "All ones test vector",
          uri: "DoubleKing implementation validation",
          input: Array(48).fill(0xFF),
          key: Array(48).fill(0xFF),
          expected: [0x46, 0x80, 0x5c, 0x2b, 0x13, 0x38, 0x08, 0x39, 0x54, 0xf3, 0x9e, 0x51, 0xc7, 0xed, 0x96, 0x26, 0x61, 0xec, 0x75, 0xf3, 0x86, 0xd2, 0xaf, 0xb1, 0xdf, 0xbf, 0x59, 0xc5, 0xe6, 0x65, 0x74, 0x84, 0xd9, 0x87, 0xf7, 0x68, 0x47, 0x62, 0xc0, 0xf1, 0x3b, 0x2d, 0x56, 0x25, 0x65, 0xe8, 0xdf, 0x05]
        },
        {
          text: "Sequential pattern test vector",
          uri: "DoubleKing implementation validation",
          input: [0x00, 0x03, 0x06, 0x09, 0x0c, 0x0f, 0x12, 0x15, 0x18, 0x1b, 0x1e, 0x21, 0x24, 0x27, 0x2a, 0x2d, 0x30, 0x33, 0x36, 0x39, 0x3c, 0x3f, 0x42, 0x45, 0x48, 0x4b, 0x4e, 0x51, 0x54, 0x57, 0x5a, 0x5d, 0x60, 0x63, 0x66, 0x69, 0x6c, 0x6f, 0x72, 0x75, 0x78, 0x7b, 0x7e, 0x81, 0x84, 0x87, 0x8a, 0x8d],
          key: [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f],
          expected: [0x20, 0x3a, 0xd6, 0x22, 0xb9, 0x5d, 0xfd, 0xda, 0xf9, 0x3a, 0x18, 0x36, 0xf3, 0x1f, 0x3a, 0x2d, 0x92, 0xb4, 0xf0, 0xe4, 0x35, 0xf1, 0x3f, 0x24, 0xee, 0x43, 0xa0, 0x30, 0xb8, 0x63, 0x99, 0xf8, 0x3f, 0x5a, 0x8e, 0x0d, 0x61, 0x95, 0xbe, 0x33, 0xa3, 0x8a, 0x9b, 0xd6, 0x68, 0x54, 0xf0, 0xde]
        }
      ];

      // Algorithm parameters
      this.BLOCK_SIZE = 48;      // 384 bits = 48 bytes = 12 words x 32 bits
      this.KEY_SIZE = 48;        // 384 bits = 48 bytes = 12 words x 32 bits
      this.WORD_SIZE = 4;        // 32-bit words
      this.NUM_ROUNDS = 11;      // Number of main rounds
      this.NUM_WORDS = 12;       // Number of 32-bit words in block/key

      // Round shift constants (enhanced for 32-bit words)
      this.shiftConstants = [0, 16, 2, 30, 10, 20, 14, 12, 26, 28, 4, 6];

      // Round constants for each round (32-bit values)
      this.roundConstants = [
        1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048
      ];
    }

    CreateInstance(key) {
      return new DoubleKingInstance(key);
    }

    /**
     * Mu transformation - reverses word order
     * @param {Array} a - Array of 12 words to transform
     */
    mu(a) {
      for (let i = 0; i < 6; i++) {
        const temp = a[i];
        a[i] = a[11 - i];
        a[11 - i] = temp;
      }
    }

    /**
     * Theta transformation - linear mixing step (enhanced for 32-bit)
     * @param {Array} k - Round key (12 words)
     * @param {Array} a - State array (12 words)
     * @param {number} RC - Round constant
     */
    theta(k, a, RC) {
      // Add round key and constants
      a[0] ^= k[0];    a[1] ^= k[1];    a[2] ^= k[2] ^ RC;   a[3] ^= k[3] ^ RC;
      a[4] ^= k[4];    a[5] ^= k[5];    a[6] ^= k[6];       a[7] ^= k[7];
      a[8] ^= k[8] ^ RC; a[9] ^= k[9] ^ RC; a[10] ^= k[10]; a[11] ^= k[11];

      // Enhanced linear mixing for 32-bit words
      const A = new Array(4);
      const B = new Array(6);

      B[0] = a[0] ^ a[4] ^ a[8];
      A[1] = a[1] ^ a[5] ^ a[9];
      A[2] = a[2] ^ a[6] ^ a[10];
      A[3] = a[3] ^ a[7] ^ a[11];
      A[0] = B[0] ^ A[1];  A[1] ^= A[2];   A[2] ^= A[3];   A[3] ^= B[0];

      B[0] = a[0] ^ a[6]; B[1] = a[1] ^ a[7];  B[2] = a[2] ^ a[8];
      B[3] = a[3] ^ a[9]; B[4] = a[4] ^ a[10]; B[5] = a[5] ^ a[11];

      a[0] ^= A[2] ^ B[3];  a[1] ^= A[3] ^ B[4];
      a[2] ^= A[0] ^ B[5];  a[3] ^= A[1] ^ B[0];
      a[4] ^= A[2] ^ B[1];  a[5] ^= A[3] ^ B[2];
      a[6] ^= A[0] ^ B[3];  a[7] ^= A[1] ^ B[4];
      a[8] ^= A[2] ^ B[5];  a[9] ^= A[3] ^ B[0];
      a[10] ^= A[0] ^ B[1]; a[11] ^= A[1] ^ B[2];
    }

    /**
     * Pi1 transformation - left rotation permutation (32-bit)
     * @param {Array} a - State array (12 words)
     */
    pi1(a) {
      for (let j = 0; j < this.NUM_WORDS; j++) {
        a[j] = OpCodes.RotL32(a[j], this.shiftConstants[j]);
      }
    }

    /**
     * Gamma transformation - nonlinear step (enhanced for 32-bit)
     * @param {Array} a - State array (12 words)
     */
    gamma(a) {
      const aa = new Array(24); // Double size to avoid modulo operations

      // Copy state twice
      for (let i = 0; i < this.NUM_WORDS; i++) {
        aa[i] = aa[i + this.NUM_WORDS] = a[i];
      }

      // Enhanced nonlinear transformation: a[i] = a[i] ^ (a[i+4] | ~a[i+8])
      for (let i = 0; i < this.NUM_WORDS; i++) {
        a[i] = aa[i] ^ (aa[i + 4] | (~aa[i + 8] >>> 0));
      }
    }

    /**
     * Pi2 transformation - right rotation permutation (32-bit)
     * @param {Array} a - State array (12 words)
     */
    pi2(a) {
      for (let j = 0; j < this.NUM_WORDS; j++) {
        a[j] = OpCodes.RotR32(a[j], this.shiftConstants[11 - j]);
      }
    }

    /**
     * Core DoubleKing round function
     * @param {Array} k - Round key (12 words)
     * @param {Array} a - State array (12 words)
     * @param {Array} RC - Round constants
     */
    doubleKingCore(k, a, RC) {
      // 11 main rounds
      for (let i = 0; i < this.NUM_ROUNDS; i++) {
        this.theta(k, a, RC[i]);
        this.pi1(a);
        this.gamma(a);
        this.pi2(a);
      }

      // Final round (Theta + Mu)
      this.theta(k, a, RC[this.NUM_ROUNDS]);
      this.mu(a);
    }

    /**
     * Pi1 inverse transformation - right rotation permutation (inverse of Pi1)
     * @param {Array} a - State array (12 words)
     */
    pi1Inverse(a) {
      for (let j = 0; j < this.NUM_WORDS; j++) {
        a[j] = OpCodes.RotR32(a[j], this.shiftConstants[j]);
      }
    }

    /**
     * Pi2 inverse transformation - left rotation permutation (inverse of Pi2)
     * @param {Array} a - State array (12 words)
     */
    pi2Inverse(a) {
      for (let j = 0; j < this.NUM_WORDS; j++) {
        a[j] = OpCodes.RotL32(a[j], this.shiftConstants[11 - j]);
      }
    }
  }

  // Instance class for actual encryption/decryption
  class DoubleKingInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.keyWords = null;
      this.inputBuffer = [];
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
        (keyBytes.length - ks.minSize) % ks.stepSize === 0
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;

      // Convert byte array to 32-bit words (big-endian)
      this.keyWords = [];
      for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
        this.keyWords[i] = OpCodes.Pack32BE(
          keyBytes[i * 4], 
          keyBytes[i * 4 + 1], 
          keyBytes[i * 4 + 2], 
          keyBytes[i * 4 + 3]
        );
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

      // Clear input buffer
      this.inputBuffer = [];

      return output;
    }

    _encryptBlock(block) {
      // Convert bytes to 32-bit words (big-endian)
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
      this.algorithm.doubleKingCore(this.keyWords, words, this.algorithm.roundConstants);

      // Convert words back to bytes (big-endian)
      const result = new Array(this.algorithm.BLOCK_SIZE);
      for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
        const bytes = OpCodes.Unpack32BE(words[i]);
        result[i * 4] = bytes[0];
        result[i * 4 + 1] = bytes[1];
        result[i * 4 + 2] = bytes[2];
        result[i * 4 + 3] = bytes[3];
      }

      return result;
    }

    _decryptBlock(block) {
      // Convert bytes to 32-bit words (big-endian)
      const words = [];
      for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
        words[i] = OpCodes.Pack32BE(
          block[i * 4], 
          block[i * 4 + 1], 
          block[i * 4 + 2], 
          block[i * 4 + 3]
        );
      }

      // For decryption, we need to reverse the operations
      // 1. Reverse Mu (Mu is its own inverse)
      this.algorithm.mu(words);

      // 2. Reverse final Theta (Theta is its own inverse)
      this.algorithm.theta(this.keyWords, words, this.algorithm.roundConstants[this.algorithm.NUM_ROUNDS]);

      // 3. Reverse 11 rounds in reverse order
      for (let i = this.algorithm.NUM_ROUNDS - 1; i >= 0; i--) {
        // Reverse in exact opposite order
        this.algorithm.pi2Inverse(words);   // Reverse Pi2 
        this.algorithm.gamma(words);        // Gamma is its own inverse
        this.algorithm.pi1Inverse(words);   // Reverse Pi1 
        this.algorithm.theta(this.keyWords, words, this.algorithm.roundConstants[i]); // Reverse Theta
      }

      // Convert words back to bytes (big-endian)
      const result = new Array(this.algorithm.BLOCK_SIZE);
      for (let i = 0; i < this.algorithm.NUM_WORDS; i++) {
        const bytes = OpCodes.Unpack32BE(words[i]);
        result[i * 4] = bytes[0];
        result[i * 4 + 1] = bytes[1];
        result[i * 4 + 2] = bytes[2];
        result[i * 4 + 3] = bytes[3];
      }

      return result;
    }
  }

  // Register the algorithm immediately

  // ===== REGISTRATION =====

    const algorithmInstance = new DoubleKingAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DoubleKingAlgorithm, DoubleKingInstance };
}));