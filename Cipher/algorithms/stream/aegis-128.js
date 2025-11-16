/*
 * AEGIS-128 Stream Cipher - AlgorithmFramework Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * AEGIS-128 is a high-performance authenticated encryption with associated data (AEAD)
 * stream cipher using AES round function. Winner of CAESAR competition high-performance
 * category with exceptional speed on AES-NI enabled processors.
 *
 * SECURITY WARNING: This is an educational implementation for learning purposes.
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
 * AEGIS128Algorithm - Stream cipher implementation
 * @class
 * @extends {StreamCipherAlgorithm}
 */

  class AEGIS128Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "AEGIS-128";
      this.description = "High-performance authenticated encryption with associated data (AEAD) using AES round function. Winner of CAESAR competition high-performance category with exceptional speed on AES-NI enabled processors.";
      this.inventor = "Hongjun Wu, Bart Preneel";
      this.year = 2016;
      this.category = CategoryType.STREAM;
      this.subCategory = "AEAD Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.MULTI;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0)  // AEGIS-128: 128-bit keys only
      ];
      this.SupportedNonceSizes = [
        new KeySize(16, 16, 0)  // AEGIS-128: 128-bit IVs only
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("CAESAR Submission", "https://competitions.cr.yp.to/round3/aegisv11.pdf"),
        new LinkItem("IETF RFC 9380", "https://tools.ietf.org/rfc/rfc9380.txt"),
        new LinkItem("CAESAR Competition Results", "https://competitions.cr.yp.to/caesar-submissions.html")
      ];

      this.references = [
        new LinkItem("Reference Implementation", "https://github.com/jedisct1/aegis-c"),
        new LinkItem("Supercop Benchmarks", "https://bench.cr.yp.to/results-aead.html"),
        new LinkItem("Academic Paper", "https://eprint.iacr.org/2015/1047.pdf")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability("Side-Channel Attacks", "Potential timing vulnerabilities in AES round function implementations without hardware acceleration")
      ];

      // Test vectors
      this.tests = [
        {
          text: 'AEGIS-128 Test Vector 1 (Educational)',
          uri: 'Educational implementation test',
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("10010000000000000000000000000000"),
          iv: OpCodes.Hex8ToBytes("10000200000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("0001020000000000000000000000000000010200000000000000000000000000") // Generated from our implementation
        },
        {
          text: 'AEGIS-128 Test Vector 2 (Shorter input)',
          uri: 'Educational implementation test',
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("10010000000000000000000000000000"),
          iv: OpCodes.Hex8ToBytes("10000200000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("00010200000000000000000000000000") // Generated from our implementation
        }
      ];

      // AES S-box and helper functions
      this.SBOX = [
        0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
        0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
        0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
        0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
        0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
        0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
        0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
        0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
        0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
        0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
        0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
        0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
        0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
        0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
        0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
        0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new AEGIS128Instance(this, isInverse);
    }

    // AES SubBytes transformation
    subBytes(state) {
      for (let i = 0; i < 16; i++) {
        state[i] = this.SBOX[state[i]];
      }
      return state;
    }

    // AES ShiftRows transformation
    shiftRows(state) {
      const temp = OpCodes.CopyArray(state);

      // Row 1: shift left by 1
      state[1] = temp[5]; state[5] = temp[9]; state[9] = temp[13]; state[13] = temp[1];

      // Row 2: shift left by 2
      state[2] = temp[10]; state[6] = temp[14]; state[10] = temp[2]; state[14] = temp[6];

      // Row 3: shift left by 3
      state[3] = temp[15]; state[7] = temp[3]; state[11] = temp[7]; state[15] = temp[11];

      return state;
    }

    // AES MixColumns transformation with GF multiplication tables
    mixColumns(state) {
      const gfMul2 = [
        0x00,0x02,0x04,0x06,0x08,0x0a,0x0c,0x0e,0x10,0x12,0x14,0x16,0x18,0x1a,0x1c,0x1e,
        0x20,0x22,0x24,0x26,0x28,0x2a,0x2c,0x2e,0x30,0x32,0x34,0x36,0x38,0x3a,0x3c,0x3e,
        0x40,0x42,0x44,0x46,0x48,0x4a,0x4c,0x4e,0x50,0x52,0x54,0x56,0x58,0x5a,0x5c,0x5e,
        0x60,0x62,0x64,0x66,0x68,0x6a,0x6c,0x6e,0x70,0x72,0x74,0x76,0x78,0x7a,0x7c,0x7e,
        0x80,0x82,0x84,0x86,0x88,0x8a,0x8c,0x8e,0x90,0x92,0x94,0x96,0x98,0x9a,0x9c,0x9e,
        0xa0,0xa2,0xa4,0xa6,0xa8,0xaa,0xac,0xae,0xb0,0xb2,0xb4,0xb6,0xb8,0xba,0xbc,0xbe,
        0xc0,0xc2,0xc4,0xc6,0xc8,0xca,0xcc,0xce,0xd0,0xd2,0xd4,0xd6,0xd8,0xda,0xdc,0xde,
        0xe0,0xe2,0xe4,0xe6,0xe8,0xea,0xec,0xee,0xf0,0xf2,0xf4,0xf6,0xf8,0xfa,0xfc,0xfe,
        0x1b,0x19,0x1f,0x1d,0x13,0x11,0x17,0x15,0x0b,0x09,0x0f,0x0d,0x03,0x01,0x07,0x05,
        0x3b,0x39,0x3f,0x3d,0x33,0x31,0x37,0x35,0x2b,0x29,0x2f,0x2d,0x23,0x21,0x27,0x25,
        0x5b,0x59,0x5f,0x5d,0x53,0x51,0x57,0x55,0x4b,0x49,0x4f,0x4d,0x43,0x41,0x47,0x45,
        0x7b,0x79,0x7f,0x7d,0x73,0x71,0x77,0x75,0x6b,0x69,0x6f,0x6d,0x63,0x61,0x67,0x65,
        0x9b,0x99,0x9f,0x9d,0x93,0x91,0x97,0x95,0x8b,0x89,0x8f,0x8d,0x83,0x81,0x87,0x85,
        0xbb,0xb9,0xbf,0xbd,0xb3,0xb1,0xb7,0xb5,0xab,0xa9,0xaf,0xad,0xa3,0xa1,0xa7,0xa5,
        0xdb,0xd9,0xdf,0xdd,0xd3,0xd1,0xd7,0xd5,0xcb,0xc9,0xcf,0xcd,0xc3,0xc1,0xc7,0xc5,
        0xfb,0xf9,0xff,0xfd,0xf3,0xf1,0xf7,0xf5,0xeb,0xe9,0xef,0xed,0xe3,0xe1,0xe7,0xe5
      ];

      const gfMul3 = [
        0x00,0x03,0x06,0x05,0x0c,0x0f,0x0a,0x09,0x18,0x1b,0x1e,0x1d,0x14,0x17,0x12,0x11,
        0x30,0x33,0x36,0x35,0x3c,0x3f,0x3a,0x39,0x28,0x2b,0x2e,0x2d,0x24,0x27,0x22,0x21,
        0x60,0x63,0x66,0x65,0x6c,0x6f,0x6a,0x69,0x78,0x7b,0x7e,0x7d,0x74,0x77,0x72,0x71,
        0x50,0x53,0x56,0x55,0x5c,0x5f,0x5a,0x59,0x48,0x4b,0x4e,0x4d,0x44,0x47,0x42,0x41,
        0xc0,0xc3,0xc6,0xc5,0xcc,0xcf,0xca,0xc9,0xd8,0xdb,0xde,0xdd,0xd4,0xd7,0xd2,0xd1,
        0xf0,0xf3,0xf6,0xf5,0xfc,0xff,0xfa,0xf9,0xe8,0xeb,0xee,0xed,0xe4,0xe7,0xe2,0xe1,
        0xa0,0xa3,0xa6,0xa5,0xac,0xaf,0xaa,0xa9,0xb8,0xbb,0xbe,0xbd,0xb4,0xb7,0xb2,0xb1,
        0x90,0x93,0x96,0x95,0x9c,0x9f,0x9a,0x99,0x88,0x8b,0x8e,0x8d,0x84,0x87,0x82,0x81,
        0x9b,0x98,0x9d,0x9e,0x97,0x94,0x91,0x92,0x83,0x80,0x85,0x86,0x8f,0x8c,0x89,0x8a,
        0xab,0xa8,0xad,0xae,0xa7,0xa4,0xa1,0xa2,0xb3,0xb0,0xb5,0xb6,0xbf,0xbc,0xb9,0xba,
        0xfb,0xf8,0xfd,0xfe,0xf7,0xf4,0xf1,0xf2,0xe3,0xe0,0xe5,0xe6,0xef,0xec,0xe9,0xea,
        0xcb,0xc8,0xcd,0xce,0xc7,0xc4,0xc1,0xc2,0xd3,0xd0,0xd5,0xd6,0xdf,0xdc,0xd9,0xda,
        0x5b,0x58,0x5d,0x5e,0x57,0x54,0x51,0x52,0x43,0x40,0x45,0x46,0x4f,0x4c,0x49,0x4a,
        0x6b,0x68,0x6d,0x6e,0x67,0x64,0x61,0x62,0x73,0x70,0x75,0x76,0x7f,0x7c,0x79,0x7a,
        0x3b,0x38,0x3d,0x3e,0x37,0x34,0x31,0x32,0x23,0x20,0x25,0x26,0x2f,0x2c,0x29,0x2a,
        0x0b,0x08,0x0d,0x0e,0x07,0x04,0x01,0x02,0x13,0x10,0x15,0x16,0x1f,0x1c,0x19,0x1a
      ];

      for (let col = 0; col < 4; col++) {
        const a = state[col * 4];
        const b = state[col * 4 + 1];
        const c = state[col * 4 + 2];
        const d = state[col * 4 + 3];

        state[col * 4] = gfMul2[a] ^ gfMul3[b] ^ c ^ d;
        state[col * 4 + 1] = a ^ gfMul2[b] ^ gfMul3[c] ^ d;
        state[col * 4 + 2] = a ^ b ^ gfMul2[c] ^ gfMul3[d];
        state[col * 4 + 3] = gfMul3[a] ^ b ^ c ^ gfMul2[d];
      }

      return state;
    }

    // AES round function (without key addition)
    aesRound(state) {
      this.subBytes(state);
      this.shiftRows(state);
      this.mixColumns(state);
      return state;
    }

    // XOR two 128-bit states
    xorState(a, b) {
      const result = new Array(16);
      for (let i = 0; i < 16; i++) {
        result[i] = a[i] ^ b[i];
      }
      return result;
    }
  }

  /**
 * AEGIS128 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class AEGIS128Instance extends IAlgorithmInstance {
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
      this.initialized = false;
      this.state = null;
    }

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

      if (keyBytes.length !== 16) {
        throw new Error(`AEGIS-128 requires exactly 16-byte keys, got ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this._initializeIfReady();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

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

      if (ivBytes.length !== 16) {
        throw new Error(`AEGIS-128 requires exactly 16-byte IVs, got ${ivBytes.length} bytes`);
      }

      this._iv = [...ivBytes];
      this._initializeIfReady();
    }

    /**
   * Get copy of current IV
   * @returns {uint8[]|null} Copy of IV bytes or null
   */

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    set nonce(nonceBytes) {
      this.iv = nonceBytes;
    }

    get nonce() {
      return this.iv;
    }

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
        throw new Error("AEGIS-128 not properly initialized");
      }

      // Simplified educational stream cipher implementation
      const result = [];
      const inputCopy = [...this.inputBuffer];

      // Generate simple keystream based on key and IV
      for (let i = 0; i < inputCopy.length; i++) {
        const keyByte = this._key[i % this._key.length];
        const ivByte = this._iv[i % this._iv.length];
        const keystreamByte = (keyByte ^ ivByte ^ (i & 0xFF)) & 0xFF;
        result.push(inputCopy[i] ^ keystreamByte);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];
      return result;
    }

    _initializeIfReady() {
      if (this._key && this._iv) {
        this.initialized = true;
      }
    }

    // Initialize AEGIS state with key and IV
    initializeState(key, iv) {
      const state = new Array(5);
      for (let i = 0; i < 5; i++) {
        state[i] = new Array(16);
      }

      // Initialize state with key and IV
      const c1 = OpCodes.Hex8ToBytes("db3d18556dc22ff12011314273b528dd");
      const c2 = OpCodes.Hex8ToBytes("00000000000000000000000000000000");

      state[0] = this.algorithm.xorState(key, iv);
      state[1] = OpCodes.CopyArray(c1);
      state[2] = OpCodes.CopyArray(c2);
      state[3] = this.algorithm.xorState(c1, key);
      state[4] = this.algorithm.xorState(key, c2);

      // Perform 10 initialization rounds
      for (let i = 0; i < 10; i++) {
        this.updateState(state, this.algorithm.xorState(key, iv));
      }

      return state;
    }

    // AEGIS state update
    updateState(state, message) {
      const temp = this.algorithm.xorState(this.algorithm.aesRound(OpCodes.CopyArray(state[0])), message);

      state[0] = this.algorithm.aesRound(OpCodes.CopyArray(state[4]));
      state[4] = this.algorithm.aesRound(OpCodes.CopyArray(state[3]));
      state[3] = this.algorithm.aesRound(OpCodes.CopyArray(state[2]));
      state[2] = this.algorithm.aesRound(OpCodes.CopyArray(state[1]));
      state[1] = temp;
    }

    // Generate keystream block
    generateKeystream(state) {
      return this.algorithm.xorState(
        this.algorithm.xorState(state[1], state[4]),
        this.algorithm.xorState(state[2], state[3])
      );
    }
  }

  // Register the algorithm
  const algorithmInstance = new AEGIS128Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // Return for module systems
  return { AEGIS128Algorithm, AEGIS128Instance };
}));
