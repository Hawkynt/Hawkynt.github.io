/*
 * Haraka Hash Function Family (Haraka-256 and Haraka-512)
 * Based on AES round function, optimized for Intel AES-NI
 * From: "Haraka v2 – Efficient Short-Input Hashing for Post-Quantum Applications"
 * Authors: Stefan Kölbl, Martin M. Lauridsen, Florian Mendel, Christian Rechberger
 * Conference: IACR ePrint Archive 2016/098
 * (c)2006-2025 Hawkynt
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework.js'),
      require('../../OpCodes.js')
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem } = AlgorithmFramework;

  // AES S-box for Haraka operations
  const AES_SBOX = Object.freeze([
    0x63, 0x7C, 0x77, 0x7B, 0xF2, 0x6B, 0x6F, 0xC5, 0x30, 0x01, 0x67, 0x2B, 0xFE, 0xD7, 0xAB, 0x76,
    0xCA, 0x82, 0xC9, 0x7D, 0xFA, 0x59, 0x47, 0xF0, 0xAD, 0xD4, 0xA2, 0xAF, 0x9C, 0xA4, 0x72, 0xC0,
    0xB7, 0xFD, 0x93, 0x26, 0x36, 0x3F, 0xF7, 0xCC, 0x34, 0xA5, 0xE5, 0xF1, 0x71, 0xD8, 0x31, 0x15,
    0x04, 0xC7, 0x23, 0xC3, 0x18, 0x96, 0x05, 0x9A, 0x07, 0x12, 0x80, 0xE2, 0xEB, 0x27, 0xB2, 0x75,
    0x09, 0x83, 0x2C, 0x1A, 0x1B, 0x6E, 0x5A, 0xA0, 0x52, 0x3B, 0xD6, 0xB3, 0x29, 0xE3, 0x2F, 0x84,
    0x53, 0xD1, 0x00, 0xED, 0x20, 0xFC, 0xB1, 0x5B, 0x6A, 0xCB, 0xBE, 0x39, 0x4A, 0x4C, 0x58, 0xCF,
    0xD0, 0xEF, 0xAA, 0xFB, 0x43, 0x4D, 0x33, 0x85, 0x45, 0xF9, 0x02, 0x7F, 0x50, 0x3C, 0x9F, 0xA8,
    0x51, 0xA3, 0x40, 0x8F, 0x92, 0x9D, 0x38, 0xF5, 0xBC, 0xB6, 0xDA, 0x21, 0x10, 0xFF, 0xF3, 0xD2,
    0xCD, 0x0C, 0x13, 0xEC, 0x5F, 0x97, 0x44, 0x17, 0xC4, 0xA7, 0x7E, 0x3D, 0x64, 0x5D, 0x19, 0x73,
    0x60, 0x81, 0x4F, 0xDC, 0x22, 0x2A, 0x90, 0x88, 0x46, 0xEE, 0xB8, 0x14, 0xDE, 0x5E, 0x0B, 0xDB,
    0xE0, 0x32, 0x3A, 0x0A, 0x49, 0x06, 0x24, 0x5C, 0xC2, 0xD3, 0xAC, 0x62, 0x91, 0x95, 0xE4, 0x79,
    0xE7, 0xC8, 0x37, 0x6D, 0x8D, 0xD5, 0x4E, 0xA9, 0x6C, 0x56, 0xF4, 0xEA, 0x65, 0x7A, 0xAE, 0x08,
    0xBA, 0x78, 0x25, 0x2E, 0x1C, 0xA6, 0xB4, 0xC6, 0xE8, 0xDD, 0x74, 0x1F, 0x4B, 0xBD, 0x8B, 0x8A,
    0x70, 0x3E, 0xB5, 0x66, 0x48, 0x03, 0xF6, 0x0E, 0x61, 0x35, 0x57, 0xB9, 0x86, 0xC1, 0x1D, 0x9E,
    0xE1, 0xF8, 0x98, 0x11, 0x69, 0xD9, 0x8E, 0x94, 0x9B, 0x1E, 0x87, 0xE9, 0xCE, 0x55, 0x28, 0xDF,
    0x8C, 0xA1, 0x89, 0x0D, 0xBF, 0xE6, 0x42, 0x68, 0x41, 0x99, 0x2D, 0x0F, 0xB0, 0x54, 0xBB, 0x16
  ]);

  // Haraka round constants (from reference implementation)
  const HARAKA_RC = Object.freeze([
    Object.freeze([0x9D, 0x7B, 0x81, 0x75, 0xF0, 0xFE, 0xC5, 0xB2, 0x0A, 0xC0, 0x20, 0xE6, 0x4C, 0x70, 0x84, 0x06]),
    Object.freeze([0x17, 0xF7, 0x08, 0x2F, 0xA4, 0x6B, 0x0F, 0x64, 0x6B, 0xA0, 0xF3, 0x88, 0xE1, 0xB4, 0x66, 0x8B]),
    Object.freeze([0x14, 0x91, 0x02, 0x9F, 0x60, 0x9D, 0x02, 0xCF, 0x98, 0x84, 0xF2, 0x53, 0x2D, 0xDE, 0x02, 0x34]),
    Object.freeze([0x79, 0x4F, 0x5B, 0xFD, 0xAF, 0xBC, 0xF3, 0xBB, 0x08, 0x4F, 0x7B, 0x2E, 0xE6, 0xEA, 0xD6, 0x0E]),
    Object.freeze([0x44, 0x70, 0x39, 0xBE, 0x1C, 0xCD, 0xEE, 0x79, 0x8B, 0x44, 0x72, 0x48, 0xCB, 0xB0, 0xCF, 0xCB]),
    Object.freeze([0x7B, 0x05, 0x8A, 0x2B, 0xED, 0x35, 0x53, 0x8D, 0xB7, 0x32, 0x90, 0x6E, 0xEE, 0xCD, 0xEA, 0x7E]),
    Object.freeze([0x1B, 0xEF, 0x4F, 0xDA, 0x61, 0x27, 0x41, 0xE2, 0xD0, 0x7C, 0x2E, 0x5E, 0x43, 0x8F, 0xC2, 0x67]),
    Object.freeze([0x3B, 0x0B, 0xC7, 0x1F, 0xE2, 0xFD, 0x5F, 0x67, 0x07, 0xCC, 0xCA, 0xAF, 0xB0, 0xD9, 0x24, 0x29]),
    Object.freeze([0xEE, 0x65, 0xD4, 0xB9, 0xCA, 0x8F, 0xDB, 0xEC, 0xE9, 0x7F, 0x86, 0xE6, 0xF1, 0x63, 0x4D, 0xAB]),
    Object.freeze([0x33, 0x7E, 0x03, 0xAD, 0x4F, 0x40, 0x2A, 0x5B, 0x64, 0xCD, 0xB7, 0xD4, 0x84, 0xBF, 0x30, 0x1C]),
    Object.freeze([0x00, 0x98, 0xF6, 0x8D, 0x2E, 0x8B, 0x02, 0x69, 0xBF, 0x23, 0x17, 0x94, 0xB9, 0x0B, 0xCC, 0xB2]),
    Object.freeze([0x8A, 0x2D, 0x9D, 0x5C, 0xC8, 0x9E, 0xAA, 0x4A, 0x72, 0x55, 0x6F, 0xDE, 0xA6, 0x78, 0x04, 0xFA]),
    Object.freeze([0xD4, 0x9F, 0x12, 0x29, 0x2E, 0x4F, 0xFA, 0x0E, 0x12, 0x2A, 0x77, 0x6B, 0x2B, 0x9F, 0xB4, 0xDF]),
    Object.freeze([0xEE, 0x12, 0x6A, 0xBB, 0xAE, 0x11, 0xD6, 0x32, 0x36, 0xA2, 0x49, 0xF4, 0x44, 0x03, 0xA1, 0x1E]),
    Object.freeze([0xA6, 0xEC, 0xA8, 0x9C, 0xC9, 0x00, 0x96, 0x5F, 0x84, 0x00, 0x05, 0x4B, 0x88, 0x49, 0x04, 0xAF]),
    Object.freeze([0xEC, 0x93, 0xE5, 0x27, 0xE3, 0xC7, 0xA2, 0x78, 0x4F, 0x9C, 0x19, 0x9D, 0xD8, 0x5E, 0x02, 0x21]),
    Object.freeze([0x73, 0x01, 0xD4, 0x82, 0xCD, 0x2E, 0x28, 0xB9, 0xB7, 0xC9, 0x59, 0xA7, 0xF8, 0xAA, 0x3A, 0xBF]),
    Object.freeze([0x6B, 0x7D, 0x30, 0x10, 0xD9, 0xEF, 0xF2, 0x37, 0x17, 0xB0, 0x86, 0x61, 0x0D, 0x70, 0x60, 0x62]),
    Object.freeze([0xC6, 0x9A, 0xFC, 0xF6, 0x53, 0x91, 0xC2, 0x81, 0x43, 0x04, 0x30, 0x21, 0xC2, 0x45, 0xCA, 0x5A]),
    Object.freeze([0x3A, 0x94, 0xD1, 0x36, 0xE8, 0x92, 0xAF, 0x2C, 0xBB, 0x68, 0x6B, 0x22, 0x3C, 0x97, 0x23, 0x92]),
    Object.freeze([0xB4, 0x71, 0x10, 0xE5, 0x58, 0xB9, 0xBA, 0x6C, 0xEB, 0x86, 0x58, 0x22, 0x38, 0x92, 0xBF, 0xD3]),
    Object.freeze([0x8D, 0x12, 0xE1, 0x24, 0xDD, 0xFD, 0x3D, 0x93, 0x77, 0xC6, 0xF0, 0xAE, 0xE5, 0x3C, 0x86, 0xDB]),
    Object.freeze([0xB1, 0x12, 0x22, 0xCB, 0xE3, 0x8D, 0xE4, 0x83, 0x9C, 0xA0, 0xEB, 0xFF, 0x68, 0x62, 0x60, 0xBB]),
    Object.freeze([0x7D, 0xF7, 0x2B, 0xC7, 0x4E, 0x1A, 0xB9, 0x2D, 0x9C, 0xD1, 0xE4, 0xE2, 0xDC, 0xD3, 0x4B, 0x73]),
    Object.freeze([0x4E, 0x92, 0xB3, 0x2C, 0xC4, 0x15, 0x14, 0x4B, 0x43, 0x1B, 0x30, 0x61, 0xC3, 0x47, 0xBB, 0x43]),
    Object.freeze([0x99, 0x68, 0xEB, 0x16, 0xDD, 0x31, 0xB2, 0x03, 0xF6, 0xEF, 0x07, 0xE7, 0xA8, 0x75, 0xA7, 0xDB]),
    Object.freeze([0x2C, 0x47, 0xCA, 0x7E, 0x02, 0x23, 0x5E, 0x8E, 0x77, 0x59, 0x75, 0x3C, 0x4B, 0x61, 0xF3, 0x6D]),
    Object.freeze([0xF9, 0x17, 0x86, 0xB8, 0xB9, 0xE5, 0x1B, 0x6D, 0x77, 0x7D, 0xDE, 0xD6, 0x17, 0x5A, 0xA7, 0xCD]),
    Object.freeze([0x5D, 0xEE, 0x46, 0xA9, 0x9D, 0x06, 0x6C, 0x9D, 0xAA, 0xE9, 0xA8, 0x6B, 0xF0, 0x43, 0x6B, 0xEC]),
    Object.freeze([0xC1, 0x27, 0xF3, 0x3B, 0x59, 0x11, 0x53, 0xA2, 0x2B, 0x33, 0x57, 0xF9, 0x50, 0x69, 0x1E, 0xCB]),
    Object.freeze([0xD9, 0xD0, 0x0E, 0x60, 0x53, 0x03, 0xED, 0xE4, 0x9C, 0x61, 0xDA, 0x00, 0x75, 0x0C, 0xEE, 0x2C]),
    Object.freeze([0x50, 0xA3, 0xA4, 0x63, 0xBC, 0xBA, 0xBB, 0x80, 0xAB, 0x0C, 0xE9, 0x96, 0xA1, 0xA5, 0xB1, 0xF0]),
    Object.freeze([0x39, 0xCA, 0x8D, 0x93, 0x30, 0xDE, 0x0D, 0xAB, 0x88, 0x29, 0x96, 0x5E, 0x02, 0xB1, 0x3D, 0xAE]),
    Object.freeze([0x42, 0xB4, 0x75, 0x2E, 0xA8, 0xF3, 0x14, 0x88, 0x0B, 0xA4, 0x54, 0xD5, 0x38, 0x8F, 0xBB, 0x17]),
    Object.freeze([0xF6, 0x16, 0x0A, 0x36, 0x79, 0xB7, 0xB6, 0xAE, 0xD7, 0x7F, 0x42, 0x5F, 0x5B, 0x8A, 0xBB, 0x34]),
    Object.freeze([0xDE, 0xAF, 0xBA, 0xFF, 0x18, 0x59, 0xCE, 0x43, 0x38, 0x54, 0xE5, 0xCB, 0x41, 0x52, 0xF6, 0x26]),
    Object.freeze([0x78, 0xC9, 0x9E, 0x83, 0xF7, 0x9C, 0xCA, 0xA2, 0x6A, 0x02, 0xF3, 0xB9, 0x54, 0x9A, 0xE9, 0x4C]),
    Object.freeze([0x35, 0x12, 0x90, 0x22, 0x28, 0x6E, 0xC0, 0x40, 0xBE, 0xF7, 0xDF, 0x1B, 0x1A, 0xA5, 0x51, 0xAE]),
    Object.freeze([0xCF, 0x59, 0xA6, 0x48, 0x0F, 0xBC, 0x73, 0xC1, 0x2B, 0xD2, 0x7E, 0xBA, 0x3C, 0x61, 0xC1, 0xA0]),
    Object.freeze([0xA1, 0x9D, 0xC5, 0xE9, 0xFD, 0xBD, 0xD6, 0x4A, 0x88, 0x82, 0x28, 0x02, 0x03, 0xCC, 0x6A, 0x75])
  ]);

  // Helper functions for AES operations using OpCodes

  function aesSubBytes(state) {
    const result = new Array(16);
    for (let i = 0; i < 16; ++i) {
      result[i] = AES_SBOX[state[i]];
    }
    return result;
  }

  function aesShiftRows(state) {
    return [
      state[0], state[5], state[10], state[15],  // Row 0: no shift
      state[4], state[9], state[14], state[3],   // Row 1: left shift 1
      state[8], state[13], state[2], state[7],   // Row 2: left shift 2
      state[12], state[1], state[6], state[11]   // Row 3: left shift 3
    ];
  }

  function aesMixColumns(state) {
    const result = new Array(16);
    let j = 0;

    // Process each column (4 bytes)
    for (let i = 0; i < 4; ++i) {
      const c0 = state[4 * i];
      const c1 = state[4 * i + 1];
      const c2 = state[4 * i + 2];
      const c3 = state[4 * i + 3];

      // Galois field multiplication in GF(2^8)
      function mulX(p) {
        return OpCodes.XorN(OpCodes.Shl32(OpCodes.AndN(p, 0x7F), 1), (OpCodes.Shr32(OpCodes.AndN(p, 0x80), 7) * 0x1B));
      }

      result[j++] = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(mulX(c0), mulX(c1)), c1), c2), c3);
      result[j++] = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(c0, mulX(c1)), mulX(c2)), c2), c3);
      result[j++] = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(c0, c1), mulX(c2)), mulX(c3)), c3);
      result[j++] = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(mulX(c0), c0), c1), c2), mulX(c3));
    }

    return result;
  }

  function aesEncryptRound(state, roundKey) {
    state = aesSubBytes(state);
    state = aesShiftRows(state);
    state = aesMixColumns(state);

    // Add round key using OpCodes XOR
    return OpCodes.XorArrays(state, roundKey);
  }

  // ===== HARAKA-256 ALGORITHM =====

  /**
 * Haraka256Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class Haraka256Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "Haraka-256";
      this.description = "High-performance hash function optimized for short inputs using AES round function. Designed for post-quantum cryptographic applications with Intel AES-NI optimization.";
      this.inventor = "Stefan Kölbl, Martin M. Lauridsen, Florian Mendel, Christian Rechberger";
      this.year = 2016;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.AT; // Austria (TU Graz)

      this.inputSize = 32;  // 256 bits
      this.outputSize = 32; // 256 bits

      this.documentation = [
        new LinkItem("IACR ePrint Archive", "https://eprint.iacr.org/2016/098.pdf"),
        new LinkItem("Reference Implementation", "https://github.com/kste/haraka"),
        new LinkItem("Bouncy Castle Implementation", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/digests/Haraka256Digest.java")
      ];

      // Official test vectors from Appendix B, Haraka-256 v2, IACR ePrint 2016/098
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          OpCodes.Hex8ToBytes("8027CCB87949774B78D0545FB72BF70C695C2A0923CBD47BBA1159EFBF2B2C1C"),
          "IACR ePrint 2016/098 Appendix B",
          "https://eprint.iacr.org/2016/098.pdf"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new Haraka256Instance(this);
    }
  }

  /**
 * Haraka256 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Haraka256Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.inputBuffer = [];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      if (this.inputBuffer.length + data.length > 32) {
        throw new Error("Input too long: Haraka-256 accepts exactly 32 bytes");
      }

      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.inputBuffer.length !== 32) {
        throw new Error(`Invalid input size: expected 32 bytes, got ${this.inputBuffer.length}`);
      }

      return this._haraka256(this.inputBuffer);
    }

    _haraka256(input) {
      // Split 32-byte input into two 16-byte blocks
      const s1 = [
        input.slice(0, 16),    // s1[0]
        input.slice(16, 32)    // s1[1]
      ];

      const s2 = [new Array(16), new Array(16)];
      const original = [...input]; // Save original for final XOR

      // 5 rounds of Haraka-256
      for (let round = 0; round < 5; ++round) {
        // Apply 2 AES rounds per Haraka round
        s1[0] = aesEncryptRound(s1[0], HARAKA_RC[round * 4]);
        s1[1] = aesEncryptRound(s1[1], HARAKA_RC[round * 4 + 1]);
        s1[0] = aesEncryptRound(s1[0], HARAKA_RC[round * 4 + 2]);
        s1[1] = aesEncryptRound(s1[1], HARAKA_RC[round * 4 + 3]);

        // Mix operation - interleave the blocks
        this._mix256(s1, s2);

        // Copy s2 back to s1 for next round
        s1[0] = [...s2[0]];
        s1[1] = [...s2[1]];
      }

      // Final XOR with original input (Davies-Meyer construction)
      const output = new Array(32);
      for (let i = 0; i < 16; ++i) {
        output[i] = OpCodes.XorN(s2[0][i], original[i]);
        output[i + 16] = OpCodes.XorN(s2[1][i], original[i + 16]);
      }

      return output;
    }

    _mix256(s1, s2) {
      // Haraka-256 mix operation - specific interleaving pattern
      for (let i = 0; i < 4; ++i) {
        s2[0][i] = s1[0][i];
        s2[0][i + 4] = s1[1][i];
        s2[0][i + 8] = s1[0][i + 4];
        s2[0][i + 12] = s1[1][i + 4];

        s2[1][i] = s1[0][i + 8];
        s2[1][i + 4] = s1[1][i + 8];
        s2[1][i + 8] = s1[0][i + 12];
        s2[1][i + 12] = s1[1][i + 12];
      }
    }
  }

  // ===== HARAKA-512 ALGORITHM =====

  /**
 * Haraka512Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class Haraka512Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "Haraka-512";
      this.description = "High-performance hash function for 512-bit inputs producing 256-bit output using AES round function. Optimized for post-quantum signature schemes requiring efficient hashing.";
      this.inventor = "Stefan Kölbl, Martin M. Lauridsen, Florian Mendel, Christian Rechberger";
      this.year = 2016;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.AT; // Austria (TU Graz)

      this.inputSize = 64;  // 512 bits
      this.outputSize = 32; // 256 bits

      this.documentation = [
        new LinkItem("IACR ePrint Archive", "https://eprint.iacr.org/2016/098.pdf"),
        new LinkItem("Reference Implementation", "https://github.com/kste/haraka"),
        new LinkItem("Bouncy Castle Implementation", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/digests/Haraka512Digest.java")
      ];

      // Official test vectors from Appendix B, Haraka-512 v2, IACR ePrint 2016/098
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F"),
          OpCodes.Hex8ToBytes("BE7F723B4E80A99813B292287F306F625A6D57331CAE5F34DD9277B0945BE2AA"),
          "IACR ePrint 2016/098 Appendix B",
          "https://eprint.iacr.org/2016/098.pdf"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new Haraka512Instance(this);
    }
  }

  /**
 * Haraka512 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Haraka512Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.inputBuffer = [];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      if (this.inputBuffer.length + data.length > 64) {
        throw new Error("Input too long: Haraka-512 accepts exactly 64 bytes");
      }

      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.inputBuffer.length !== 64) {
        throw new Error(`Invalid input size: expected 64 bytes, got ${this.inputBuffer.length}`);
      }

      return this._haraka512(this.inputBuffer);
    }

    _haraka512(input) {
      // Split 64-byte input into four 16-byte blocks
      const s1 = [
        input.slice(0, 16),    // s1[0]
        input.slice(16, 32),   // s1[1]
        input.slice(32, 48),   // s1[2]
        input.slice(48, 64)    // s1[3]
      ];

      const s2 = [new Array(16), new Array(16), new Array(16), new Array(16)];
      let rcIndex = 0; // Round constant index

      // 5 rounds of Haraka-512 (following reference implementation exactly)
      for (let round = 0; round < 5; ++round) {
        // Apply 2 AES rounds per Haraka round to each block
        s1[0] = aesEncryptRound(s1[0], HARAKA_RC[rcIndex++]);
        s1[1] = aesEncryptRound(s1[1], HARAKA_RC[rcIndex++]);
        s1[2] = aesEncryptRound(s1[2], HARAKA_RC[rcIndex++]);
        s1[3] = aesEncryptRound(s1[3], HARAKA_RC[rcIndex++]);

        s1[0] = aesEncryptRound(s1[0], HARAKA_RC[rcIndex++]);
        s1[1] = aesEncryptRound(s1[1], HARAKA_RC[rcIndex++]);
        s1[2] = aesEncryptRound(s1[2], HARAKA_RC[rcIndex++]);
        s1[3] = aesEncryptRound(s1[3], HARAKA_RC[rcIndex++]);

        // Mix operation - interleave the four blocks
        this._mix512(s1, s2);

        // Copy s2 back to s1 for next round
        for (let i = 0; i < 4; ++i) {
          s1[i] = [...s2[i]];
        }
      }

      // Final XOR with original message (Davies-Meyer construction)
      s1[0] = OpCodes.XorArrays(s2[0], input.slice(0, 16));
      s1[1] = OpCodes.XorArrays(s2[1], input.slice(16, 32));
      s1[2] = OpCodes.XorArrays(s2[2], input.slice(32, 48));
      s1[3] = OpCodes.XorArrays(s2[3], input.slice(48, 64));

      // Haraka-512 specific output construction (256-bit output from 512-bit input)
      const output = new Array(32);

      // Copy s1[0][8:15] (8 bytes)
      for (let i = 0; i < 8; ++i) {
        output[i] = s1[0][i + 8];
      }

      // Copy s1[1][8:15] (8 bytes)
      for (let i = 0; i < 8; ++i) {
        output[i + 8] = s1[1][i + 8];
      }

      // Copy s1[2][0:7] (8 bytes)
      for (let i = 0; i < 8; ++i) {
        output[i + 16] = s1[2][i];
      }

      // Copy s1[3][0:7] (8 bytes)
      for (let i = 0; i < 8; ++i) {
        output[i + 24] = s1[3][i];
      }

      return output;
    }

    _mix512(s1, s2) {
      // Haraka-512 mix operation - complex interleaving of four blocks
      for (let i = 0; i < 4; ++i) {
        s2[0][i] = s1[0][i + 12];
        s2[0][i + 4] = s1[2][i + 12];
        s2[0][i + 8] = s1[1][i + 12];
        s2[0][i + 12] = s1[3][i + 12];

        s2[1][i] = s1[2][i];
        s2[1][i + 4] = s1[0][i];
        s2[1][i + 8] = s1[3][i];
        s2[1][i + 12] = s1[1][i];

        s2[2][i] = s1[2][i + 4];
        s2[2][i + 4] = s1[0][i + 4];
        s2[2][i + 8] = s1[3][i + 4];
        s2[2][i + 12] = s1[1][i + 4];

        s2[3][i] = s1[0][i + 8];
        s2[3][i + 4] = s1[2][i + 8];
        s2[3][i + 8] = s1[1][i + 8];
        s2[3][i + 12] = s1[3][i + 8];
      }
    }
  }

  // Register both algorithms
  RegisterAlgorithm(new Haraka256Algorithm());
  RegisterAlgorithm(new Haraka512Algorithm());

  // Export for module systems
  return { Haraka256Algorithm, Haraka256Instance, Haraka512Algorithm, Haraka512Instance };
}));
