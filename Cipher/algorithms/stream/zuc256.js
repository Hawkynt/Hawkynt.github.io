/*
 * ZUC-256 Stream Cipher - Production Implementation
 * 3GPP Confidentiality and Integrity Algorithm (256-bit variant)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * ZUC-256 is an enhanced version of ZUC with 256-bit keys and 200-bit IVs.
 * Designed by DACAS for next-generation mobile communications security.
 *
 * Features:
 * - 256-bit keys and 200-bit IVs (vs ZUC-128's 128-bit)
 * - 16-stage 31-bit LFSR over GF(2^31-1)
 * - Bit reorganization layer
 * - Nonlinear function with dual S-boxes
 * - 32-bit word-oriented keystream output
 * - Enhanced security for future 5G/6G systems
 *
 * Reference: https://www.is.cas.cn/ztzl2016/zouchongzhi/201801/W020180126529970733243.pdf
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
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
          StreamCipherAlgorithm, IAlgorithmInstance,
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * ZUC256Algorithm - Stream cipher implementation
 * @class
 * @extends {StreamCipherAlgorithm}
 */

  class ZUC256Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ZUC-256";
      this.description = "Enhanced word-oriented stream cipher with 16-stage LFSR over GF(2^31-1). Successor to ZUC-128 for next-generation 5G/6G mobile communications with 256-bit keys and 200-bit IVs.";
      this.inventor = "DACAS (Data Assurance and Communication Security Research Center)";
      this.year = 2018;
      this.category = CategoryType.STREAM;
      this.subCategory = "3GPP Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.CN;

      // Algorithm-specific configuration
      this.SupportedKeySizes = [
        new KeySize(32, 32, 0)  // Fixed 256-bit (32 bytes) keys
      ];
      this.SupportedNonceSizes = [
        new KeySize(25, 25, 0)  // Fixed 200-bit (25 bytes) IV
      ];

      // Documentation links
      this.documentation = [
        new LinkItem("ZUC-256 Algorithm Specification", "https://www.is.cas.cn/ztzl2016/zouchongzhi/201801/W020180126529970733243.pdf"),
        new LinkItem("3GPP Security Algorithms", "https://www.3gpp.org/technologies/keywords-acronyms/100-the-3gpp-security-algorithms")
      ];

      // Security status notes
      this.knownVulnerabilities = [];

      // Official test vectors from BouncyCastle
      this.tests = [
        {
          text: "ZUC-256 Test Vector 1 - All zeros",
          uri: "https://www.is.cas.cn/ztzl2016/zouchongzhi/201801/W020180126529970733243.pdf",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("58d03ad62e032ce2dafc683a39bdcb0352a2bc67f1b7de74163ce3a101ef55589639d75b95fa681b7f090df756391ccc903b7612744d544c17bc3fad8b163b08")
        },
        {
          text: "ZUC-256 Test Vector 2 - All ones pattern",
          uri: "https://www.is.cas.cn/ztzl2016/zouchongzhi/201801/W020180126529970733243.pdf",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
          iv: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF3F3F3F3F3F3F3F3F"),
          expected: OpCodes.Hex8ToBytes("3356cbaed1a1c18b6baa4ffe343f777c9e15128f251ab65b949f7b26ef7157f296dd2fa9df95e3ee7a5be02ec32ba585505af316c2f9ded27cdbd935e441ce11")
        }
      ];

      // ZUC constants
      this.MASK31 = 0x7FFFFFFF; // 2^31 - 1
      this.LFSR_SIZE = 16;
      this.INIT_ROUNDS = 32;

      // ZUC-256 D constants (from BouncyCastle specification)
      this.D = [
        0x22, 0x2f, 0x24, 0x2a, 0x6d, 0x40, 0x40, 0x40,
        0x40, 0x40, 0x40, 0x40, 0x40, 0x52, 0x10, 0x30
      ];

      // ZUC S-boxes (identical to ZUC-128)
      this.S0 = [
        0x3E,0x72,0x5B,0x47,0xCA,0xE0,0x00,0x33,0x04,0xD1,0x54,0x98,0x09,0xB9,0x6D,0xCB,
        0x7B,0x1B,0xF9,0x32,0xAF,0x9D,0x6A,0xA5,0xB8,0x2D,0xFC,0x1D,0x08,0x53,0x03,0x90,
        0x4D,0x4E,0x84,0x99,0xE4,0xCE,0xD9,0x91,0xDD,0xB6,0x85,0x48,0x8B,0x29,0x6E,0xAC,
        0xCD,0xC1,0xF8,0x1E,0x73,0x43,0x69,0xC6,0xB5,0xBD,0xFD,0x39,0x63,0x20,0xD4,0x38,
        0x76,0x7D,0xB2,0xA7,0xCF,0xED,0x57,0xC5,0xF3,0x2C,0xBB,0x14,0x21,0x06,0x55,0x9B,
        0xE3,0xEF,0x5E,0x31,0x4F,0x7F,0x5A,0xA4,0x0D,0x82,0x51,0x49,0x5F,0xBA,0x58,0x1C,
        0x4A,0x16,0xD5,0x17,0xA8,0x92,0x24,0x1F,0x8C,0xFF,0xD8,0xAE,0x2E,0x01,0xD3,0xAD,
        0x3B,0x4B,0xDA,0x46,0xEB,0xC9,0xDE,0x9A,0x8F,0x87,0xD7,0x3A,0x80,0x6F,0x2F,0xC8,
        0xB1,0xB4,0x37,0xF7,0x0A,0x22,0x13,0x28,0x7C,0xCC,0x3C,0x89,0xC7,0xC3,0x96,0x56,
        0x07,0xBF,0x7E,0xF0,0x0B,0x2B,0x97,0x52,0x35,0x41,0x79,0x61,0xA6,0x4C,0x10,0xFE,
        0xBC,0x26,0x95,0x88,0x8A,0xB0,0xA3,0xFB,0xC0,0x18,0x94,0xF2,0xE1,0xE5,0xE9,0x5D,
        0xD0,0xDC,0x11,0x66,0x64,0x5C,0xEC,0x59,0x42,0x75,0x12,0xF5,0x74,0x9C,0xAA,0x23,
        0x0E,0x86,0xAB,0xBE,0x2A,0x02,0xE7,0x67,0xE6,0x44,0xA2,0x6C,0xC2,0x93,0x9F,0xF1,
        0xF6,0xFA,0x36,0xD2,0x50,0x68,0x9E,0x62,0x71,0x15,0x3D,0xD6,0x40,0xC4,0xE2,0x0F,
        0x8E,0x83,0x77,0x6B,0x25,0x05,0x3F,0x0C,0x30,0xEA,0x70,0xB7,0xA1,0xE8,0xA9,0x65,
        0x8D,0x27,0x1A,0xDB,0x81,0xB3,0xA0,0xF4,0x45,0x7A,0x19,0xDF,0xEE,0x78,0x34,0x60
      ];

      this.S1 = [
        0x55,0xC2,0x63,0x71,0x3B,0xC8,0x47,0x86,0x9F,0x3C,0xDA,0x5B,0x29,0xAA,0xFD,0x77,
        0x8C,0xC5,0x94,0x0C,0xA6,0x1A,0x13,0x00,0xE3,0xA8,0x16,0x72,0x40,0xF9,0xF8,0x42,
        0x44,0x26,0x68,0x96,0x81,0xD9,0x45,0x3E,0x10,0x76,0xC6,0xA7,0x8B,0x39,0x43,0xE1,
        0x3A,0xB5,0x56,0x2A,0xC0,0x6D,0xB3,0x05,0x22,0x66,0xBF,0xDC,0x0B,0xFA,0x62,0x48,
        0xDD,0x20,0x11,0x06,0x36,0xC9,0xC1,0xCF,0xF6,0x27,0x52,0xBB,0x69,0xF5,0xD4,0x87,
        0x7F,0x84,0x4C,0xD2,0x9C,0x57,0xA4,0xBC,0x4F,0x9A,0xDF,0xFE,0xD6,0x8D,0x7A,0xEB,
        0x2B,0x53,0xD8,0x5C,0xA1,0x14,0x17,0xFB,0x23,0xD5,0x7D,0x30,0x67,0x73,0x08,0x09,
        0xEE,0xB7,0x70,0x3F,0x61,0xB2,0x19,0x8E,0x4E,0xE5,0x4B,0x93,0x8F,0x5D,0xDB,0xA9,
        0xAD,0xF1,0xAE,0x2E,0xCB,0x0D,0xFC,0xF4,0x2D,0x46,0x6E,0x1D,0x97,0xE8,0xD1,0xE9,
        0x4D,0x37,0xA5,0x75,0x5E,0x83,0x9E,0xAB,0x82,0x9D,0xB9,0x1C,0xE0,0xCD,0x49,0x89,
        0x01,0xB6,0xBD,0x58,0x24,0xA2,0x5F,0x38,0x78,0x99,0x15,0x90,0x50,0xB8,0x95,0xE4,
        0xD0,0x91,0xC7,0xCE,0xED,0x0F,0xB4,0x6F,0xA0,0xCC,0xF0,0x02,0x4A,0x79,0xC3,0xDE,
        0xA3,0xEF,0xEA,0x51,0xE6,0x6B,0x18,0xEC,0x1B,0x2C,0x80,0xF7,0x74,0xE7,0xFF,0x21,
        0x5A,0x6A,0x54,0x1E,0x41,0x31,0x92,0x35,0xC4,0x33,0x07,0x0A,0xBA,0x7E,0x0E,0x34,
        0x88,0xB1,0x98,0x7C,0xF3,0x3D,0x60,0x6C,0x7B,0xCA,0xD3,0x1F,0x32,0x65,0x04,0x28,
        0x64,0xBE,0x85,0x9B,0x2F,0x59,0x8A,0xD7,0xB0,0x25,0xAC,0xAF,0x12,0x03,0xE2,0xF2
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new ZUC256Instance(this, isInverse);
    }
  }

  // Instance class implementing production-grade ZUC-256
  /**
 * ZUC256 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ZUC256Instance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];

      // ZUC state
      this.LFSR = new Array(this.algorithm.LFSR_SIZE);  // 16 x 31-bit registers
      this.X = new Array(4);                           // Bit reorganization registers
      this.R1 = 0;                                     // Nonlinear function register 1
      this.R2 = 0;                                     // Nonlinear function register 2
      this.initialized = false;
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
        this.initialized = false;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      if (keyBytes.length !== 32) {
        throw new Error(`Invalid ZUC-256 key size: ${keyBytes.length} bytes. Requires exactly 32 bytes (256 bits)`);
      }

      this._key = [...keyBytes];
      if (this._iv) {
        this._initialize();
      }
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property setter for IV
    /**
   * Set initialization vector
   * @param {uint8[]|null} ivBytes - IV bytes or null to clear
   * @throws {Error} If IV size is invalid
   */

    set iv(ivBytes) {
      if (!ivBytes) {
        this._iv = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(ivBytes)) {
        throw new Error("Invalid IV - must be byte array");
      }

      if (ivBytes.length !== 25) {
        throw new Error(`Invalid ZUC-256 IV size: ${ivBytes.length} bytes. Requires exactly 25 bytes (200 bits)`);
      }

      this._iv = [...ivBytes];
      if (this._key) {
        this._initialize();
      }
    }

    /**
   * Get copy of current IV
   * @returns {uint8[]|null} Copy of IV bytes or null
   */

    get iv() {
      return this._iv ? [...this._iv] : null;
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
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._iv) {
        throw new Error("IV not set");
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
      if (!this._iv) {
        throw new Error("IV not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data to process");
      }
      if (!this.initialized) {
        throw new Error("ZUC-256 not properly initialized");
      }

      const output = [];

      // Process input data in 4-byte (32-bit word) chunks
      for (let i = 0; i < this.inputBuffer.length; i += 4) {
        const keystreamWord = this._generateKeystreamWord();

        // Convert keystream word to bytes (big-endian)
        const keystreamBytes = OpCodes.Unpack32BE(keystreamWord);

        // XOR with input data
        for (let j = 0; j < 4 && i + j < this.inputBuffer.length; j++) {
          output.push(this.inputBuffer[i + j] ^ keystreamBytes[j]);
        }
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    // Initialize ZUC-256 cipher state (different from ZUC-128)
    _initialize() {
      if (!this._key || !this._iv) return;

      const k = this._key;
      const iv = this._iv;
      const D = this.algorithm.D;

      // ZUC-256 specific LFSR initialization (from BouncyCastle specification)
      // Each LFSR cell is constructed from 4 bytes: MAKEU31(a, b, c, d) = (a << 23) | (b << 16) | (c << 8) | d
      this.LFSR[0] = this._MAKEU31(k[0], D[0], k[21], k[16]);
      this.LFSR[1] = this._MAKEU31(k[1], D[1], k[22], k[17]);
      this.LFSR[2] = this._MAKEU31(k[2], D[2], k[23], k[18]);
      this.LFSR[3] = this._MAKEU31(k[3], D[3], k[24], k[19]);
      this.LFSR[4] = this._MAKEU31(k[4], D[4], k[25], k[20]);
      this.LFSR[5] = this._MAKEU31(iv[0], (D[5] | (iv[17] & 0x3F)), k[5], k[26]);
      this.LFSR[6] = this._MAKEU31(iv[1], (D[6] | (iv[18] & 0x3F)), k[6], k[27]);
      this.LFSR[7] = this._MAKEU31(iv[10], (D[7] | (iv[19] & 0x3F)), k[7], iv[2]);
      this.LFSR[8] = this._MAKEU31(k[8], (D[8] | (iv[20] & 0x3F)), iv[3], iv[11]);
      this.LFSR[9] = this._MAKEU31(k[9], (D[9] | (iv[21] & 0x3F)), iv[12], iv[4]);
      this.LFSR[10] = this._MAKEU31(iv[5], (D[10] | (iv[22] & 0x3F)), k[10], k[28]);
      this.LFSR[11] = this._MAKEU31(k[11], (D[11] | (iv[23] & 0x3F)), iv[6], iv[13]);
      this.LFSR[12] = this._MAKEU31(k[12], (D[12] | (iv[24] & 0x3F)), iv[7], iv[14]);
      this.LFSR[13] = this._MAKEU31(k[13], D[13], iv[15], iv[8]);
      this.LFSR[14] = this._MAKEU31(k[14], (D[14] | ((k[31] >>> 4) & 0xF)), iv[16], iv[9]);
      this.LFSR[15] = this._MAKEU31(k[15], (D[15] | (k[31] & 0xF)), k[30], k[29]);

      this.R1 = 0;
      this.R2 = 0;

      // Initialization phase (32 iterations without output)
      for (let i = 0; i < this.algorithm.INIT_ROUNDS; i++) {
        this._bitReorganization();
        const W = this._nonlinearFunction();
        this._LFSRWithInitialization((W >>> 1) & 0x7FFFFFFF);
      }

      // Final initialization step (BouncyCastle pattern)
      this._bitReorganization();
      this._nonlinearFunction(); // Discard output
      this._LFSRWithoutInitialization();

      this.initialized = true;
    }

    // Build a 31-bit integer from 4 bytes
    _MAKEU31(a, b, c, d) {
      return (((a & 0xFF) << 23) | ((b & 0xFF) << 16) | ((c & 0xFF) << 8) | (d & 0xFF)) & this.algorithm.MASK31;
    }

    // Modular addition: (a + b) mod (2^31 - 1)
    // More efficient than direct modulo
    _AddM(a, b) {
      const c = a + b;
      return (c & 0x7FFFFFFF) + (c >>> 31);
    }

    // LFSR step with initialization feedback
    _LFSRWithInitialization(u) {
      let f = this.LFSR[0];
      f = this._AddM(f, this._mulByPow2(this.LFSR[0], 8));
      f = this._AddM(f, this._mulByPow2(this.LFSR[4], 20));
      f = this._AddM(f, this._mulByPow2(this.LFSR[10], 21));
      f = this._AddM(f, this._mulByPow2(this.LFSR[13], 17));
      f = this._AddM(f, this._mulByPow2(this.LFSR[15], 15));
      f = this._AddM(f, u);

      // Shift LFSR
      for (let i = 0; i < 15; i++) {
        this.LFSR[i] = this.LFSR[i + 1];
      }
      this.LFSR[15] = f;
    }

    // LFSR step without initialization feedback (working mode)
    _LFSRWithoutInitialization() {
      let f = this.LFSR[0];
      f = this._AddM(f, this._mulByPow2(this.LFSR[0], 8));
      f = this._AddM(f, this._mulByPow2(this.LFSR[4], 20));
      f = this._AddM(f, this._mulByPow2(this.LFSR[10], 21));
      f = this._AddM(f, this._mulByPow2(this.LFSR[13], 17));
      f = this._AddM(f, this._mulByPow2(this.LFSR[15], 15));

      // Shift LFSR
      for (let i = 0; i < 15; i++) {
        this.LFSR[i] = this.LFSR[i + 1];
      }
      this.LFSR[15] = f;
    }

    // Multiplication by 2^k modulo (2^31 - 1)
    _mulByPow2(x, k) {
      x = x & this.algorithm.MASK31;
      k = k % 31;
      const result = ((x << k) | (x >>> (31 - k))) & this.algorithm.MASK31;
      return result;
    }

    // Bit reorganization
    _bitReorganization() {
      this.X[0] = (((this.LFSR[15] & 0x7FFF8000) << 1) | (this.LFSR[14] & 0x0000FFFF)) >>> 0;
      this.X[1] = (((this.LFSR[11] & 0x0000FFFF) << 16) | (this.LFSR[9] >>> 15)) >>> 0;
      this.X[2] = (((this.LFSR[7] & 0x0000FFFF) << 16) | (this.LFSR[5] >>> 15)) >>> 0;
      this.X[3] = (((this.LFSR[2] & 0x0000FFFF) << 16) | (this.LFSR[0] >>> 15)) >>> 0;
    }

    // S-box lookup (32-bit word composed of 4 bytes)
    _sbox(x) {
      return ((this.algorithm.S0[(x >>> 24) & 0xFF] << 24) |
              (this.algorithm.S1[(x >>> 16) & 0xFF] << 16) |
              (this.algorithm.S0[(x >>> 8) & 0xFF] << 8) |
              (this.algorithm.S1[x & 0xFF])) >>> 0;
    }

    // Linear transformation L1
    _L1(x) {
      return (x ^ OpCodes.RotL32(x, 2) ^ OpCodes.RotL32(x, 10) ^ OpCodes.RotL32(x, 18) ^ OpCodes.RotL32(x, 24)) >>> 0;
    }

    // Linear transformation L2
    _L2(x) {
      return (x ^ OpCodes.RotL32(x, 8) ^ OpCodes.RotL32(x, 14) ^ OpCodes.RotL32(x, 22) ^ OpCodes.RotL32(x, 30)) >>> 0;
    }

    // Nonlinear function F (returns W for use during initialization)
    _nonlinearFunction() {
      const W = (((this.X[0] ^ this.R1) >>> 0) + this.R2) >>> 0;
      const W1 = (this.R1 + this.X[1]) >>> 0;
      const W2 = (this.R2 ^ this.X[2]) >>> 0;
      const u = this._L1(((W1 << 16) | (W2 >>> 16)) >>> 0);
      const v = this._L2(((W2 << 16) | (W1 >>> 16)) >>> 0);

      this.R1 = this._sbox(u);
      this.R2 = this._sbox(v);

      return W;
    }

    // Generate keystream word
    _generateKeystreamWord() {
      this._bitReorganization();
      const Z = (this._nonlinearFunction() ^ this.X[3]) >>> 0;
      this._LFSRWithoutInitialization();
      return Z;
    }
  }

  // Register the algorithm
  const algorithmInstance = new ZUC256Algorithm();
  RegisterAlgorithm(algorithmInstance);

  // Return for module systems
  return { ZUC256Algorithm, ZUC256Instance };
}));
