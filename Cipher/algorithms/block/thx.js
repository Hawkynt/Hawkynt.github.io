/*
 * THX (Twofish Extended) Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * THX - Educational extended version of Twofish cipher
 * Extended key sizes (256/512/1024-bit) with proportional round increases
 * Enhanced security margins with simplified, functional key schedule
 *
 * Educational implementation for cryptographic study.
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

  /**
 * THXAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class THXAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "THX (Twofish Extended)";
      this.description = "Educational extended Twofish with 256/512/1024-bit keys and proportional rounds (16/20/24). Based on Twofish structure with simplified key schedule for learning.";
      this.inventor = "Educational Variant (Based on Schneier Twofish)";
      this.year = 2025;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Extended Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.INTERNATIONAL;

      // Algorithm-specific configuration
      this.SupportedKeySizes = [
        new KeySize(32, 128, 32)  // 256-bit to 1024-bit keys in 256-bit increments
      ];
      this.SupportedBlockSizes = [
        new KeySize(16, 16, 0)    // 128-bit blocks only
      ];

      // Documentation links
      this.documentation = [
        new LinkItem("Original Twofish Specification", "https://www.schneier.com/academic/twofish/"),
        new LinkItem("Extended Block Cipher Design", "https://en.wikipedia.org/wiki/Block_cipher"),
        new LinkItem("Educational Cryptography", "https://en.wikipedia.org/wiki/Cryptography")
      ];

      // Reference links
      this.references = [
        new LinkItem("Twofish Official Paper", "https://www.schneier.com/academic/twofish/"),
        new LinkItem("Block Cipher Theory", "https://en.wikipedia.org/wiki/Block_cipher"),
        new LinkItem("Feistel Networks", "https://en.wikipedia.org/wiki/Feistel_cipher")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability(
          "Educational Implementation",
          "This is an educational extension of Twofish, not suitable for production use",
          "Use only for learning cryptographic principles and algorithm design"
        )
      ];

      // Test vectors for educational purposes
      this.tests = [
        {
          text: 'THX-256 Zero Test Vector',
          uri: 'Educational implementation test',
          input: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
          key: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
          expected: [0x5F, 0xF7, 0xE9, 0xC6, 0x6D, 0x38, 0xA2, 0x76, 0xB8, 0x4A, 0x46, 0x4D, 0x10, 0x41, 0x4C, 0x65]
        },
        {
          text: 'THX-256 Pattern Test Vector',
          uri: 'Educational implementation test',
          input: [0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF, 0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF],
          key: [0xFE, 0xDC, 0xBA, 0x98, 0x76, 0x54, 0x32, 0x10, 0xFE, 0xDC, 0xBA, 0x98, 0x76, 0x54, 0x32, 0x10,
                0xFE, 0xDC, 0xBA, 0x98, 0x76, 0x54, 0x32, 0x10, 0xFE, 0xDC, 0xBA, 0x98, 0x76, 0x54, 0x32, 0x10],
          expected: [0x2F, 0x35, 0xF8, 0x97, 0x93, 0xD1, 0xC8, 0xD7, 0x2E, 0x18, 0x58, 0xA6, 0x70, 0x92, 0xF8, 0x7F]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new THXInstance(this, isInverse);
    }
  }

  // Instance class - handles the actual THX encryption/decryption
  /**
 * THX cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class THXInstance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = 16; // 128-bit blocks
      this.KeySize = 0;

      // THX configuration constants
      this.ROUNDS_CONFIG = {
        256: 16,  // THX-256: 16 rounds
        512: 20,  // THX-512: 20 rounds
        1024: 24  // THX-1024: 24 rounds
      };

      // Twofish Q0 S-box (original from Twofish specification)
      this.Q0 = [
        0xA9, 0x67, 0xB3, 0xE8, 0x04, 0xFD, 0xA3, 0x76, 0x9A, 0x92, 0x80, 0x78, 0xE4, 0xDD, 0xD1, 0x38,
        0x0D, 0xC6, 0x35, 0x98, 0x18, 0xF7, 0xEC, 0x6C, 0x43, 0x75, 0x37, 0x26, 0xFA, 0x13, 0x94, 0x48,
        0xF2, 0xD0, 0x8B, 0x30, 0x84, 0x54, 0xDF, 0x23, 0x19, 0x5B, 0x3D, 0x59, 0xF3, 0xAE, 0xA2, 0x82,
        0x63, 0x01, 0x83, 0x2E, 0xD9, 0x51, 0x9B, 0x7C, 0xA6, 0xEB, 0xA5, 0xBE, 0x16, 0x0C, 0xE3, 0x61,
        0xC0, 0x8C, 0x3A, 0xF5, 0x73, 0x2C, 0x25, 0x0B, 0xBB, 0x4E, 0x89, 0x6B, 0x53, 0x6A, 0xB4, 0xF1,
        0xE1, 0xE6, 0xBD, 0x45, 0xE2, 0xF4, 0xB6, 0x66, 0xCC, 0x95, 0x03, 0x56, 0xD4, 0x1C, 0x1E, 0xD7,
        0xFB, 0xC3, 0x8E, 0xB5, 0xE9, 0xCF, 0xBF, 0xBA, 0xEA, 0x77, 0x39, 0xAF, 0x33, 0xC9, 0x62, 0x71,
        0x81, 0x79, 0x09, 0xAD, 0x24, 0xCD, 0xF9, 0xD8, 0xE5, 0xC5, 0xB9, 0x4D, 0x44, 0x08, 0x86, 0xE7,
        0xA1, 0x1D, 0xAA, 0xED, 0x06, 0x70, 0xB2, 0xD2, 0x41, 0x7B, 0xA0, 0x11, 0x31, 0xC2, 0x27, 0x90,
        0x20, 0xF6, 0x60, 0xFF, 0x96, 0x5C, 0xB1, 0xAB, 0x9E, 0x9C, 0x52, 0x1B, 0x5F, 0x93, 0x0A, 0xEF,
        0x91, 0x85, 0x49, 0xEE, 0x2D, 0x4F, 0x8F, 0x3B, 0x47, 0x87, 0x6D, 0x46, 0xD6, 0x3E, 0x69, 0x64,
        0x2A, 0xCE, 0xCB, 0x2F, 0xFC, 0x97, 0x05, 0x7A, 0xAC, 0x7F, 0xD5, 0x1A, 0x4B, 0x0E, 0xA7, 0x5A,
        0x28, 0x14, 0x3F, 0x29, 0x88, 0x3C, 0x4C, 0x02, 0xB8, 0xDA, 0xB0, 0x17, 0x55, 0x1F, 0x8A, 0x7D,
        0x57, 0xC7, 0x8D, 0x74, 0xB7, 0xC4, 0x9F, 0x72, 0x7E, 0x15, 0x22, 0x12, 0x58, 0x07, 0x99, 0x34,
        0x6E, 0x50, 0xDE, 0x68, 0x65, 0xBC, 0xDB, 0xF8, 0xC8, 0xA8, 0x2B, 0x40, 0xDC, 0xFE, 0x32, 0xA4,
        0xCA, 0x10, 0x21, 0xF0, 0xD3, 0x5D, 0x0F, 0x00, 0x6F, 0x9D, 0x36, 0x42, 0x4A, 0x5E, 0xC1, 0xE0
      ];

      // Twofish Q1 S-box (original from Twofish specification)
      this.Q1 = [
        0x75, 0xF3, 0xC6, 0xF4, 0xDB, 0x7B, 0xFB, 0xC8, 0x4A, 0xD3, 0xE6, 0x6B, 0x45, 0x7D, 0xE8, 0x4B,
        0xD6, 0x32, 0xD8, 0xFD, 0x37, 0x71, 0xF1, 0xE1, 0x30, 0x0F, 0xF8, 0x1B, 0x87, 0xFA, 0x06, 0x3F,
        0x5E, 0xBA, 0xAE, 0x5B, 0x8A, 0x00, 0xBC, 0x9D, 0x6D, 0xC1, 0xB1, 0x0E, 0x80, 0x5D, 0xD2, 0xD5,
        0xA0, 0x84, 0x07, 0x14, 0xB5, 0x90, 0x2C, 0xA3, 0xB2, 0x73, 0x4C, 0x54, 0x92, 0x74, 0x36, 0x51,
        0x38, 0xB0, 0xBD, 0x5A, 0xFC, 0x60, 0x62, 0x96, 0x6C, 0x42, 0xF7, 0x10, 0x7C, 0x28, 0x27, 0x8C,
        0x13, 0x95, 0x9C, 0xC7, 0x24, 0x46, 0x3B, 0x70, 0xCA, 0xE3, 0x85, 0xCB, 0x11, 0xD0, 0x93, 0xB8,
        0xA6, 0x83, 0x20, 0xFF, 0x9F, 0x77, 0xC3, 0xCC, 0x03, 0x6F, 0x08, 0xBF, 0x40, 0xE7, 0x2B, 0xE2,
        0x79, 0x0C, 0xAA, 0x82, 0x41, 0x3A, 0xEA, 0xB9, 0xE4, 0x9A, 0xA4, 0x97, 0x7E, 0xDA, 0x7A, 0x17,
        0x66, 0x94, 0xA1, 0x1D, 0x3D, 0xF0, 0xDE, 0xB3, 0x0B, 0x72, 0xA7, 0x1C, 0xEF, 0xD1, 0x53, 0x3E,
        0x8F, 0x33, 0x26, 0x5F, 0xEC, 0x76, 0x2A, 0x49, 0x81, 0x88, 0xEE, 0x21, 0xC4, 0x1A, 0xEB, 0xD9,
        0xC5, 0x39, 0x99, 0xCD, 0xAD, 0x31, 0x8B, 0x01, 0x18, 0x23, 0xDD, 0x1F, 0x4E, 0x2D, 0xF9, 0x48,
        0x4F, 0xF2, 0x65, 0x8E, 0x78, 0x5C, 0x58, 0x19, 0x8D, 0xE5, 0x98, 0x57, 0x67, 0x7F, 0x05, 0x64,
        0xAF, 0x63, 0xB6, 0xFE, 0xF5, 0xB7, 0x3C, 0xA5, 0xCE, 0xE9, 0x68, 0x44, 0xE0, 0x4D, 0x43, 0x69,
        0x29, 0x2E, 0xAC, 0x15, 0x59, 0xA8, 0x0A, 0x9E, 0x6E, 0x47, 0xDF, 0x34, 0x35, 0x6A, 0xCF, 0xDC,
        0x22, 0xC9, 0xC0, 0x9B, 0x89, 0xD4, 0xED, 0xAB, 0x12, 0xA2, 0x0D, 0x52, 0xBB, 0x02, 0x2F, 0xA9,
        0xD7, 0x61, 0x1E, 0xB4, 0x50, 0x04, 0xF6, 0xC2, 0x16, 0x25, 0x86, 0x56, 0x55, 0x09, 0xBE, 0x91
      ];

      // Twofish MDS matrix for diffusion
      this.MDS = [
        [0x01, 0xEF, 0x5B, 0x5B],
        [0x5B, 0xEF, 0xEF, 0x01],
        [0xEF, 0x5B, 0x01, 0xEF],
        [0xEF, 0x01, 0xEF, 0x5B]
      ];

      this.subkeys = null;
      this.sboxKeys = null;
      this.numRounds = 0;
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
        this.KeySize = 0;
        this.subkeys = null;
        this.sboxKeys = null;
        this.numRounds = 0;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      const keyBits = keyBytes.length * 8;
      if (!this.ROUNDS_CONFIG[keyBits]) {
        throw new Error(`Invalid THX key size: ${keyBits} bits. Supported: 256, 512, 1024 bits`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this.numRounds = this.ROUNDS_CONFIG[keyBits];

      // Generate key schedule using simplified approach
      this._generateKeySchedule(keyBytes);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Feed data to the cipher
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }
      this.inputBuffer.push(...data);
    }

    // Get the cipher result
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data to process");
      }
      if (this.inputBuffer.length % 16 !== 0) {
        throw new Error("THX requires input length to be multiple of 16 bytes");
      }

      const output = [];

      // Process data in 16-byte blocks
      for (let i = 0; i < this.inputBuffer.length; i += 16) {
        const block = this.inputBuffer.slice(i, i + 16);
        const processedBlock = this._processBlock(block);
        output.push(...processedBlock);
      }

      // Clear input buffer
      this.inputBuffer = [];

      return output;
    }

    // Generate simplified key schedule
    _generateKeySchedule(masterKey) {
      const keyWords = masterKey.length / 4;
      const subkeyCount = 4 + (this.numRounds * 2) + 4; // Input + rounds + output whitening

      this.subkeys = [];
      this.sboxKeys = [[], [], [], []];

      // Convert key to 32-bit words
      const keyWords32 = [];
      for (let i = 0; i < keyWords; i++) {
        const offset = i * 4;
        keyWords32.push(OpCodes.Pack32LE(
          masterKey[offset],
          masterKey[offset + 1],
          masterKey[offset + 2],
          masterKey[offset + 3]
        ));
      }

      // Generate subkeys using simplified key schedule
      for (let i = 0; i < subkeyCount; i += 2) {
        const a = this._h(i * 2, keyWords32);
        const b = this._h(i * 2 + 1, keyWords32);

        // PHT (Pseudo Hadamard Transform)
        const [t0, t1] = this._pht(a, OpCodes.RotL32(b, 8));
        this.subkeys.push(t0);
        if (i + 1 < subkeyCount) {
          this.subkeys.push(t1);
        }
      }

      // Generate key-dependent S-boxes using simplified approach
      for (let box = 0; box < 4; box++) {
        for (let i = 0; i < 256; i++) {
          const keyIndex = (box * 256 + i) % keyWords32.length;
          const mixValue = keyWords32[keyIndex];
          const baseQ = (box % 2 === 0) ? this.Q0[i] : this.Q1[i];
          this.sboxKeys[box][i] = baseQ ^ ((mixValue >>> (8 * (i % 4))) & 0xFF);
        }
      }
    }

    // Simplified h-function for educational purposes
    _h(x, k) {
      const bytes = [
        (x >>> 0) & 0xFF,
        (x >>> 8) & 0xFF,
        (x >>> 16) & 0xFF,
        (x >>> 24) & 0xFF
      ];

      // Apply key-dependent transformations (simplified)
      for (let i = Math.min(k.length - 1, 3); i >= 0; i--) {
        const keyBytes = [
          (k[i] >>> 0) & 0xFF,
          (k[i] >>> 8) & 0xFF,
          (k[i] >>> 16) & 0xFF,
          (k[i] >>> 24) & 0xFF
        ];

        for (let j = 0; j < 4; j++) {
          bytes[j] ^= keyBytes[j];
          bytes[j] = (j % 2 === 0) ? this.Q0[bytes[j]] : this.Q1[bytes[j]];
        }
      }

      // MDS matrix multiplication
      const result = [0, 0, 0, 0];
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          result[i] ^= OpCodes.GF256Mul(this.MDS[i][j], bytes[j]);
        }
      }

      return OpCodes.Pack32LE(result[0], result[1], result[2], result[3]);
    }

    // Pseudo Hadamard Transform
    _pht(a, b) {
      const newA = (a + b) >>> 0;
      const newB = (a + (b << 1)) >>> 0;
      return [newA, newB];
    }

    // F-function for Feistel rounds
    _fFunction(x) {
      const bytes = [
        (x >>> 0) & 0xFF,
        (x >>> 8) & 0xFF,
        (x >>> 16) & 0xFF,
        (x >>> 24) & 0xFF
      ];

      // Apply key-dependent S-boxes
      const t = [
        this.sboxKeys[0][bytes[0]],
        this.sboxKeys[1][bytes[1]],
        this.sboxKeys[2][bytes[2]],
        this.sboxKeys[3][bytes[3]]
      ];

      // MDS matrix multiplication
      const result = [0, 0, 0, 0];
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          result[i] ^= OpCodes.GF256Mul(this.MDS[i][j], t[j]);
        }
      }

      return OpCodes.Pack32LE(result[0], result[1], result[2], result[3]);
    }

    // Process a single 16-byte block
    _processBlock(block) {
      // Convert block to 32-bit words (little-endian)
      let r0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let r1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      let r2 = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
      let r3 = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);

      if (this.isInverse) {
        // Decryption - reverse the encryption process

        // Undo output whitening
        const outputOffset = 4 + (this.numRounds * 2);
        r0 ^= this.subkeys[outputOffset];
        r1 ^= this.subkeys[outputOffset + 1];
        r2 ^= this.subkeys[outputOffset + 2];
        r3 ^= this.subkeys[outputOffset + 3];

        // Reverse Feistel rounds
        for (let round = this.numRounds - 1; round >= 0; round--) {
          const k = 4 + (round * 2);

          // Rotate state (reverse)
          [r0, r1, r2, r3] = [r2, r3, r0, r1];

          // Undo rotations
          r2 = OpCodes.RotR32(r2, 1);
          r3 = OpCodes.RotL32(r3, 1);

          // F-functions
          const f0 = this._fFunction(r0);
          const f1 = this._fFunction(OpCodes.RotL32(r1, 8));

          // PHT
          const [t0, t1] = this._pht(f0, f1);

          // Undo round key application
          r2 ^= (t0 + this.subkeys[k]) >>> 0;
          r3 ^= (t1 + this.subkeys[k + 1]) >>> 0;
        }

        // Undo input whitening
        r0 ^= this.subkeys[0];
        r1 ^= this.subkeys[1];
        r2 ^= this.subkeys[2];
        r3 ^= this.subkeys[3];

      } else {
        // Encryption

        // Input whitening
        r0 ^= this.subkeys[0];
        r1 ^= this.subkeys[1];
        r2 ^= this.subkeys[2];
        r3 ^= this.subkeys[3];

        // Feistel rounds
        for (let round = 0; round < this.numRounds; round++) {
          const k = 4 + (round * 2);

          // F-functions
          const f0 = this._fFunction(r0);
          const f1 = this._fFunction(OpCodes.RotL32(r1, 8));

          // PHT
          const [t0, t1] = this._pht(f0, f1);

          // Apply round keys and update state
          r2 ^= (t0 + this.subkeys[k]) >>> 0;
          r3 ^= (t1 + this.subkeys[k + 1]) >>> 0;
          r2 = OpCodes.RotL32(r2, 1);
          r3 = OpCodes.RotR32(r3, 1);

          // Rotate state
          [r0, r1, r2, r3] = [r2, r3, r0, r1];
        }

        // Output whitening
        const outputOffset = 4 + (this.numRounds * 2);
        r0 ^= this.subkeys[outputOffset];
        r1 ^= this.subkeys[outputOffset + 1];
        r2 ^= this.subkeys[outputOffset + 2];
        r3 ^= this.subkeys[outputOffset + 3];
      }

      // Convert back to bytes
      const bytes0 = OpCodes.Unpack32LE(r0);
      const bytes1 = OpCodes.Unpack32LE(r1);
      const bytes2 = OpCodes.Unpack32LE(r2);
      const bytes3 = OpCodes.Unpack32LE(r3);

      return [...bytes0, ...bytes1, ...bytes2, ...bytes3];
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new THXAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { THXAlgorithm, THXInstance };
}));