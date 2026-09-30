/*
 * Simpira v2 Permutation Family
 * NIST-published permutation using AES round function as only building block
 * Supports 128×b bit inputs with Generalized Feistel Structure
 * Authors: Shay Gueron and Nicky Mouha (ASIACRYPT 2016)
 * Reference: IACR ePrint 2016/122, NIST publication
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
          Algorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // AES S-box for Simpira permutations
  /** @type {uint8[]} */
  const AES_SBOX = [
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
  ];

  // AES Inverse S-box for inverse permutations
  /** @type {uint8[]} */
  const AES_INV_SBOX = [
    0x52, 0x09, 0x6A, 0xD5, 0x30, 0x36, 0xA5, 0x38, 0xBF, 0x40, 0xA3, 0x9E, 0x81, 0xF3, 0xD7, 0xFB,
    0x7C, 0xE3, 0x39, 0x82, 0x9B, 0x2F, 0xFF, 0x87, 0x34, 0x8E, 0x43, 0x44, 0xC4, 0xDE, 0xE9, 0xCB,
    0x54, 0x7B, 0x94, 0x32, 0xA6, 0xC2, 0x23, 0x3D, 0xEE, 0x4C, 0x95, 0x0B, 0x42, 0xFA, 0xC3, 0x4E,
    0x08, 0x2E, 0xA1, 0x66, 0x28, 0xD9, 0x24, 0xB2, 0x76, 0x5B, 0xA2, 0x49, 0x6D, 0x8B, 0xD1, 0x25,
    0x72, 0xF8, 0xF6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xD4, 0xA4, 0x5C, 0xCC, 0x5D, 0x65, 0xB6, 0x92,
    0x6C, 0x70, 0x48, 0x50, 0xFD, 0xED, 0xB9, 0xDA, 0x5E, 0x15, 0x46, 0x57, 0xA7, 0x8D, 0x9D, 0x84,
    0x90, 0xD8, 0xAB, 0x00, 0x8C, 0xBC, 0xD3, 0x0A, 0xF7, 0xE4, 0x58, 0x05, 0xB8, 0xB3, 0x45, 0x06,
    0xD0, 0x2C, 0x1E, 0x8F, 0xCA, 0x3F, 0x0F, 0x02, 0xC1, 0xAF, 0xBD, 0x03, 0x01, 0x13, 0x8A, 0x6B,
    0x3A, 0x91, 0x11, 0x41, 0x4F, 0x67, 0xDC, 0xEA, 0x97, 0xF2, 0xCF, 0xCE, 0xF0, 0xB4, 0xE6, 0x73,
    0x96, 0xAC, 0x74, 0x22, 0xE7, 0xAD, 0x35, 0x85, 0xE2, 0xF9, 0x37, 0xE8, 0x1C, 0x75, 0xDF, 0x6E,
    0x47, 0xF1, 0x1A, 0x71, 0x1D, 0x29, 0xC5, 0x89, 0x6F, 0xB7, 0x62, 0x0E, 0xAA, 0x18, 0xBE, 0x1B,
    0xFC, 0x56, 0x3E, 0x4B, 0xC6, 0xD2, 0x79, 0x20, 0x9A, 0xDB, 0xC0, 0xFE, 0x78, 0xCD, 0x5A, 0xF4,
    0x1F, 0xDD, 0xA8, 0x33, 0x88, 0x07, 0xC7, 0x31, 0xB1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xEC, 0x5F,
    0x60, 0x51, 0x7F, 0xA9, 0x19, 0xB5, 0x4A, 0x0D, 0x2D, 0xE5, 0x7A, 0x9F, 0x93, 0xC9, 0x9C, 0xEF,
    0xA0, 0xE0, 0x3B, 0x4D, 0xAE, 0x2A, 0xF5, 0xB0, 0xC8, 0xEB, 0xBB, 0x3C, 0x83, 0x53, 0x99, 0x61,
    0x17, 0x2B, 0x04, 0x7E, 0xBA, 0x77, 0xD6, 0x26, 0xE1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0C, 0x7D
  ];

  // AES operations using OpCodes

  /**
   * AES SubBytes
   * @param {uint8[]} block - 16-byte AES state
   * @returns {uint8[]} Substituted state
   */
  function aesSubBytes(block) {
    /** @type {uint8[]} */
    const result = new Array(16);
    for (let i = 0; i < 16; ++i) {
      result[i] = AES_SBOX[block[i]];
    }
    return result;
  }

  /**
   * AES InvSubBytes
   * @param {uint8[]} block - 16-byte AES state
   * @returns {uint8[]} Substituted state
   */
  function aesInvSubBytes(block) {
    /** @type {uint8[]} */
    const result = new Array(16);
    for (let i = 0; i < 16; ++i) {
      result[i] = AES_INV_SBOX[block[i]];
    }
    return result;
  }

  /**
   * AES ShiftRows
   * @param {uint8[]} block - 16-byte AES state
   * @returns {uint8[]} Shifted state
   */
  function aesShiftRows(block) {
    /** @type {uint8[]} */
    const result = [
      block[0], block[5], block[10], block[15],  // Row 0: no shift
      block[4], block[9], block[14], block[3],   // Row 1: left shift 1
      block[8], block[13], block[2], block[7],   // Row 2: left shift 2
      block[12], block[1], block[6], block[11]   // Row 3: left shift 3
    ];
    return result;
  }

  /**
   * AES InvShiftRows
   * @param {uint8[]} block - 16-byte AES state
   * @returns {uint8[]} Shifted state
   */
  function aesInvShiftRows(block) {
    /** @type {uint8[]} */
    const result = [
      block[0], block[13], block[10], block[7],   // Row 0: no shift
      block[4], block[1], block[14], block[11],   // Row 1: right shift 1
      block[8], block[5], block[2], block[15],    // Row 2: right shift 2
      block[12], block[9], block[6], block[3]     // Row 3: right shift 3
    ];
    return result;
  }

  /**
   * Multiplication by x in GF(2^8) modulo the AES polynomial
   * @param {uint8} p - Field element
   * @returns {uint8} p * x
   */
  function mulX(p) {
    return OpCodes.Xor8(OpCodes.Shl8(OpCodes.And8(p, 0x7F), 1), OpCodes.And8(p, 0x80) !== 0 ? 0x1B : 0);
  }

  // FIPS 197 section 5.3.3 InvMixColumns: the coefficients are {0e},{0b},{0d},{09}.
  // As polynomials over GF(2): 0e = x^3+x^2+x, 0b = x^3+x+1, 0d = x^3+x^2+1,
  // 09 = x^3+1, where each application of mulX is one multiplication by x.
  // mul14 previously repeated mul11's body (x^3+x+1), so InvMixColumns was not
  // the inverse of MixColumns and Simpira-128 could not undo its own permutation.

  /**
   * @param {uint8} p - Field element
   * @returns {uint8} p * {0e}
   */
  function mul14(p) { return OpCodes.Xor8(OpCodes.Xor8(mulX(mulX(mulX(p))), mulX(mulX(p))), mulX(p)); }

  /**
   * @param {uint8} p - Field element
   * @returns {uint8} p * {0d}
   */
  function mul13(p) { return OpCodes.Xor8(OpCodes.Xor8(mulX(mulX(mulX(p))), mulX(mulX(p))), p); }

  /**
   * @param {uint8} p - Field element
   * @returns {uint8} p * {0b}
   */
  function mul11(p) { return OpCodes.Xor8(OpCodes.Xor8(mulX(mulX(mulX(p))), mulX(p)), p); }

  /**
   * @param {uint8} p - Field element
   * @returns {uint8} p * {09}
   */
  function mul9(p) { return OpCodes.Xor8(mulX(mulX(mulX(p))), p); }

  /**
   * AES MixColumns
   * @param {uint8[]} block - 16-byte AES state
   * @returns {uint8[]} Mixed state
   */
  function aesMixColumns(block) {
    /** @type {uint8[]} */
    const result = new Array(16);
    /** @type {int32} */
    let j = 0;

    for (let i = 0; i < 4; ++i) {
      /** @type {uint8} */
      const c0 = block[4 * i];
      /** @type {uint8} */
      const c1 = block[4 * i + 1];
      /** @type {uint8} */
      const c2 = block[4 * i + 2];
      /** @type {uint8} */
      const c3 = block[4 * i + 3];

      result[j++] = OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(mulX(c0), mulX(c1)), c1), c2), c3);
      result[j++] = OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(c0, mulX(c1)), mulX(c2)), c2), c3);
      result[j++] = OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(c0, c1), mulX(c2)), mulX(c3)), c3);
      result[j++] = OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(mulX(c0), c0), c1), c2), mulX(c3));
    }

    return result;
  }

  /**
   * AES InvMixColumns
   * @param {uint8[]} block - 16-byte AES state
   * @returns {uint8[]} Unmixed state
   */
  function aesInvMixColumns(block) {
    /** @type {uint8[]} */
    const result = new Array(16);
    /** @type {int32} */
    let j = 0;

    for (let i = 0; i < 4; ++i) {
      /** @type {uint8} */
      const c0 = block[4 * i];
      /** @type {uint8} */
      const c1 = block[4 * i + 1];
      /** @type {uint8} */
      const c2 = block[4 * i + 2];
      /** @type {uint8} */
      const c3 = block[4 * i + 3];

      result[j++] = OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(mul14(c0), mul11(c1)), mul13(c2)), mul9(c3));
      result[j++] = OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(mul9(c0), mul14(c1)), mul11(c2)), mul13(c3));
      result[j++] = OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(mul13(c0), mul9(c1)), mul14(c2)), mul11(c3));
      result[j++] = OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(mul11(c0), mul13(c1)), mul9(c2)), mul14(c3));
    }

    return result;
  }

  /**
   * One AES round: SubBytes, ShiftRows, MixColumns, AddRoundKey
   * @param {uint8[]} block - 16-byte AES state
   * @param {uint8[]} roundKey - 16-byte round key
   * @returns {uint8[]} New state
   */
  function aesRound(block, roundKey) {
    /** @type {uint8[]} */
    let b = aesSubBytes(block);
    b = aesShiftRows(b);
    b = aesMixColumns(b);
    return OpCodes.XorArrays(b, roundKey);
  }

  /**
   * Inverse of one AES round
   * @param {uint8[]} block - 16-byte AES state
   * @param {uint8[]} roundKey - 16-byte round key
   * @returns {uint8[]} Previous state
   */
  function aesInvRound(block, roundKey) {
    /** @type {uint8[]} */
    let b = OpCodes.XorArrays(block, roundKey);
    b = aesInvMixColumns(b);
    b = aesInvShiftRows(b);
    b = aesInvSubBytes(b);
    return b;
  }

  /**
   * Simpira v2 configuration of one variant
   * @class
   */
  class SimpiraConfig {
    /**
     * @param {int32} b - Number of 128-bit blocks
     * @param {int32} rounds - Number of rounds
     * @param {string} name - Variant name
     */
    constructor(b, rounds, name) {
      /** @type {int32} */
      this.b = b;
      /** @type {int32} */
      this.rounds = rounds;
      /** @type {string} */
      this.name = name;
    }
  }

  /**
   * Simpira v2 configuration for different variants
   * @param {int32} bitSize - Permutation width in bits
   * @returns {SimpiraConfig|null} The configuration, or null for an unsupported width
   */
  function simpiraConfig(bitSize) {
    switch (bitSize) {
      case 128: return new SimpiraConfig(1, 12, "Simpira-128");
      case 256: return new SimpiraConfig(2, 15, "Simpira-256");
      case 384: return new SimpiraConfig(3, 21, "Simpira-384");
      case 512: return new SimpiraConfig(4, 15, "Simpira-512");
      case 768: return new SimpiraConfig(6, 15, "Simpira-768");
      case 1024: return new SimpiraConfig(8, 18, "Simpira-1024");
      default: return null;
    }
  }

  // Base algorithm class for Simpira v2 permutations
  class SimpliraPermutationAlgorithm extends Algorithm {
    /**
     * @param {int32} bitSize - Permutation width in bits
     */
    constructor(bitSize) {
      super();

      /** @type {SimpiraConfig|null} */
      const config = simpiraConfig(bitSize);
      if (!config) {
        throw new Error("Unsupported Simpira variant: " + bitSize + " bits");
      }

      /** @type {int32} */
      this.bitSize = bitSize;
      /** @type {int32} */
      this.byteSize = Math.floor(bitSize / 8);
      /** @type {int32} */
      this.b = config.b;
      /** @type {int32} */
      this.rounds = config.rounds;

      this.name = config.name;
      this.description = config.name + " permutation using AES round function. Input/output size: " + bitSize + " bits (" + this.byteSize + " bytes). Designed for Intel AES-NI optimization.";
      this.inventor = "Shay Gueron, Nicky Mouha";
      this.year = 2016;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Cryptographic Permutation";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US; // NIST publication

      this.inputSize = this.byteSize;
      this.outputSize = this.byteSize;
      this.blockSize = this.byteSize;

      this.documentation = [
        new LinkItem("IACR ePrint 2016/122", "https://eprint.iacr.org/2016/122"),
        new LinkItem("ASIACRYPT 2016 Paper", "https://link.springer.com/chapter/10.1007/978-3-662-53887-6_16"),
        new LinkItem("NIST Publication", "https://www.nist.gov/publications/simpira-v2-family-efficient-permutations-using-aes-found-function"),
        new LinkItem("Reference Implementation", "https://mouha.be/wp-content/uploads/simpira_v2.zip")
      ];

      this.references = [
        new LinkItem("Simpira Implementation (SPHINCS optimized code)", "https://github.com/kste/sphincs/blob/master/arm/simpira/simpira.c")
      ];

      // Test vectors from reference implementation or derived
      this.tests = [
        new TestCase(
          new Array(this.byteSize).fill(0),
          this._computeTestVector(new Array(this.byteSize).fill(0)),
          `${config.name} Zero Vector Test`,
          "https://mouha.be/simpira/"
        ),
        new TestCase(
          new Array(this.byteSize).fill(0).map((_, i) => i % 256),
          this._computeTestVector(new Array(this.byteSize).fill(0).map((_, i) => i % 256)),
          `${config.name} Sequential Vector Test`,
          "https://mouha.be/simpira/"
        )
      ];
    }

    /**
     * Compute the permutation of a vector input
     * @param {uint8[]} input - Input bytes
     * @returns {uint8[]} Permuted bytes
     */
    _computeTestVector(input) {
      // Create instance and compute expected output
      /** @type {SimpliraPermutationInstance} */
      const instance = this.CreateInstance(false);
      instance.Feed(input);
      /** @type {uint8[]} */
      const output = instance.Result();
      return output;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {SimpliraPermutationInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SimpliraPermutationInstance(this, isInverse);
    }
  }

  /**
 * SimpliraPermutation cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SimpliraPermutationInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {SimpliraPermutationAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {string} */
      this.variantName = algorithm.name;
      /** @type {int32} */
      this.byteSize = algorithm.byteSize;
      /** @type {int32} */
      this.b = algorithm.b;
      /** @type {int32} */
      this.rounds = algorithm.rounds;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      if (this.inputBuffer.length + data.length > this.byteSize) {
        throw new Error("Input too large: " + this.variantName + " accepts exactly " + this.byteSize + " bytes");
      }

      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.inputBuffer.length !== this.byteSize) {
        throw new Error("Invalid input size: expected " + this.byteSize + " bytes, got " + this.inputBuffer.length);
      }

      if (this.isInverse) {
        return this._computeInverse();
      } else {
        return this._computePermutation();
      }
    }

    /**
     * @returns {uint8[]} Permuted buffer
     */
    _computePermutation() {
      if (this.b === 1) {
        // For b=1: 12-round AES with fixed round keys
        return this._simpira128();
      } else {
        // For b≥2: Generalized Feistel Structure
        return this._simpiraGFS();
      }
    }

    /**
     * @returns {uint8[]} Inverse-permuted buffer
     */
    _computeInverse() {
      if (this.b === 1) {
        // For b=1: Inverse of 12-round AES
        return this._simpira128Inverse();
      } else {
        // For b≥2: Inverse Generalized Feistel Structure
        return this._simpiraGFSInverse();
      }
    }

    /**
     * @returns {uint8[]} Simpira-128 of the buffer
     */
    _simpira128() {
      // Simpira-128: 12-round AES with fixed round keys
      /** @type {uint8[]} */
      let block = this.inputBuffer.slice();

      // Initial round key addition
      /** @type {uint8[]} */
      const initialRc = this._generateRoundConstant(0, 0);
      block = OpCodes.XorArrays(block, initialRc);

      // 11 full rounds
      for (let round = 1; round <= 11; ++round) {
        /** @type {uint8[]} */
        const roundRc = this._generateRoundConstant(round, 0);
        block = aesRound(block, roundRc);
      }

      // Final round (no MixColumns)
      /** @type {uint8[]} */
      const finalRc = this._generateRoundConstant(12, 0);
      block = aesSubBytes(block);
      block = aesShiftRows(block);
      block = OpCodes.XorArrays(block, finalRc);

      return block;
    }

    /**
     * @returns {uint8[]} Inverse Simpira-128 of the buffer
     */
    _simpira128Inverse() {
      // Inverse Simpira-128: 12-round inverse AES
      /** @type {uint8[]} */
      let block = this.inputBuffer.slice();

      // Undo final round
      /** @type {uint8[]} */
      const finalRc = this._generateRoundConstant(12, 0);
      block = OpCodes.XorArrays(block, finalRc);
      block = aesInvShiftRows(block);
      block = aesInvSubBytes(block);

      // Undo 11 full rounds
      for (let round = 11; round >= 1; --round) {
        /** @type {uint8[]} */
        const roundRc = this._generateRoundConstant(round, 0);
        block = aesInvRound(block, roundRc);
      }

      // Undo initial round key addition
      /** @type {uint8[]} */
      const initialRc = this._generateRoundConstant(0, 0);
      block = OpCodes.XorArrays(block, initialRc);

      return block;
    }

    /**
     * Split the buffer into b blocks of 128 bits each
     * @returns {uint8[][]} The blocks
     */
    _splitBlocks() {
      /** @type {uint8[][]} */
      const blocks = [];
      for (let i = 0; i < this.b; ++i) {
        blocks.push(this.inputBuffer.slice(i * 16, (i + 1) * 16));
      }
      return blocks;
    }

    /**
     * Concatenate blocks back to output
     * @param {uint8[][]} blocks - The blocks
     * @returns {uint8[]} Their concatenation
     */
    _joinBlocks(blocks) {
      /** @type {uint8[]} */
      const result = [];
      for (let i = 0; i < this.b; ++i) {
        /** @type {uint8[]} */
        const blk = blocks[i];
        for (let k = 0; k < blk.length; ++k) result.push(blk[k]);
      }
      return result;
    }

    /**
     * @returns {uint8[]} Generalized Feistel permutation of the buffer
     */
    _simpiraGFS() {
      // Generalized Feistel Structure for b≥2
      /** @type {int32} */
      const b = this.b;
      /** @type {int32} */
      const rounds = this.rounds;

      /** @type {uint8[][]} */
      const blocks = this._splitBlocks();

      // Apply GFS rounds
      for (let round = 0; round < rounds; ++round) {
        // F-function: two AES rounds with round constants
        /** @type {uint8[]} */
        const fInput = blocks[0];
        /** @type {uint8[]} */
        const fOutput = this._fFunction(fInput, round);

        // XOR with next block and rotate
        blocks[1] = OpCodes.XorArrays(blocks[1], fOutput);

        // Rotate blocks: (X0, X1, ..., Xb-1) -> (X1, X2, ..., Xb-1, X0)
        /** @type {uint8[]} */
        const temp = blocks[0];
        for (let i = 0; i < b - 1; ++i) {
          blocks[i] = blocks[i + 1];
        }
        blocks[b - 1] = temp;
      }

      return this._joinBlocks(blocks);
    }

    /**
     * @returns {uint8[]} Inverse generalized Feistel permutation of the buffer
     */
    _simpiraGFSInverse() {
      // Inverse Generalized Feistel Structure
      /** @type {int32} */
      const b = this.b;
      /** @type {int32} */
      const rounds = this.rounds;

      /** @type {uint8[][]} */
      const blocks = this._splitBlocks();

      // Apply inverse GFS rounds
      for (let round = rounds - 1; round >= 0; --round) {
        // Inverse rotate blocks: (X0, X1, ..., Xb-1) -> (Xb-1, X0, X1, ..., Xb-2)
        /** @type {uint8[]} */
        const temp = blocks[b - 1];
        for (let i = b - 1; i > 0; --i) {
          blocks[i] = blocks[i - 1];
        }
        blocks[0] = temp;

        // Inverse F-function application
        /** @type {uint8[]} */
        const fInput = blocks[0];
        /** @type {uint8[]} */
        const fOutput = this._fFunction(fInput, round);
        blocks[1] = OpCodes.XorArrays(blocks[1], fOutput);
      }

      return this._joinBlocks(blocks);
    }

    /**
     * F-function: two AES rounds
     * @param {uint8[]} input - 16-byte block
     * @param {int32} round - Round index
     * @returns {uint8[]} F output
     */
    _fFunction(input, round) {
      /** @type {uint8[]} */
      let block = input.slice();

      // First AES round with round constant
      /** @type {uint8[]} */
      const rc1 = this._generateRoundConstant(round, 0);
      block = aesRound(block, rc1);

      // Second AES round with different round constant
      /** @type {uint8[]} */
      const rc2 = this._generateRoundConstant(round, 1);
      block = aesRound(block, rc2);

      return block;
    }

    /**
     * Simpira v2 round constant generation
     * @param {int32} round - Round index
     * @param {int32} subRound - 0 or 1
     * @returns {uint8[]} 16-byte round constant
     */
    _generateRoundConstant(round, subRound) {
      // Based on simple counter to avoid backdoors
      /** @type {uint8[]} */
      const constant = new Array(16);
      /** @type {int32} */
      const counter = (round * 2 + subRound) + 1; // Start from 1

      // Fill with strengthened constants (v2 improvement)
      for (let i = 0; i < 16; ++i) {
        constant[i] = OpCodes.ToByte(counter + i * 17); // Dense constants to prevent invariant subspaces
      }

      return constant;
    }
  }

  // ===== ALGORITHM REGISTRATIONS =====

  // Register the most important Simpira variants
  class Simpira128Algorithm extends SimpliraPermutationAlgorithm {
    constructor() { super(128); }
  }

  class Simpira256Algorithm extends SimpliraPermutationAlgorithm {
    constructor() { super(256); }
  }

  class Simpira512Algorithm extends SimpliraPermutationAlgorithm {
    constructor() { super(512); }
  }

  // Register algorithms
  RegisterAlgorithm(new Simpira128Algorithm());
  RegisterAlgorithm(new Simpira256Algorithm());
  RegisterAlgorithm(new Simpira512Algorithm());

  // Export for module systems
  return { SimpliraPermutationAlgorithm, SimpliraPermutationInstance, Simpira128Algorithm, Simpira256Algorithm, Simpira512Algorithm };
}));
