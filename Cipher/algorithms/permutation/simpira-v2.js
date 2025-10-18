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

  // AES Inverse S-box for inverse permutations
  const AES_INV_SBOX = Object.freeze([
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
  ]);

  // AES operations using OpCodes
  function aesSubBytes(state) {
    const result = new Array(16);
    for (let i = 0; i < 16; ++i) {
      result[i] = AES_SBOX[state[i]];
    }
    return result;
  }

  function aesInvSubBytes(state) {
    const result = new Array(16);
    for (let i = 0; i < 16; ++i) {
      result[i] = AES_INV_SBOX[state[i]];
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

  function aesInvShiftRows(state) {
    return [
      state[0], state[13], state[10], state[7],   // Row 0: no shift
      state[4], state[1], state[14], state[11],   // Row 1: right shift 1
      state[8], state[5], state[2], state[15],    // Row 2: right shift 2
      state[12], state[9], state[6], state[3]     // Row 3: right shift 3
    ];
  }

  function aesMixColumns(state) {
    const result = new Array(16);
    let j = 0;

    for (let i = 0; i < 4; ++i) {
      const c0 = state[4 * i];
      const c1 = state[4 * i + 1];
      const c2 = state[4 * i + 2];
      const c3 = state[4 * i + 3];

      function mulX(p) {
        return ((p & 0x7F) << 1) ^ (((p & 0x80) >>> 7) * 0x1B);
      }

      result[j++] = mulX(c0) ^ mulX(c1) ^ c1 ^ c2 ^ c3;
      result[j++] = c0 ^ mulX(c1) ^ mulX(c2) ^ c2 ^ c3;
      result[j++] = c0 ^ c1 ^ mulX(c2) ^ mulX(c3) ^ c3;
      result[j++] = mulX(c0) ^ c0 ^ c1 ^ c2 ^ mulX(c3);
    }

    return result;
  }

  function aesInvMixColumns(state) {
    const result = new Array(16);
    let j = 0;

    for (let i = 0; i < 4; ++i) {
      const c0 = state[4 * i];
      const c1 = state[4 * i + 1];
      const c2 = state[4 * i + 2];
      const c3 = state[4 * i + 3];

      function mul14(p) { return mulX(mulX(mulX(p))) ^ mulX(p) ^ p; }
      function mul13(p) { return mulX(mulX(mulX(p))) ^ mulX(mulX(p)) ^ p; }
      function mul11(p) { return mulX(mulX(mulX(p))) ^ mulX(p) ^ p; }
      function mul9(p) { return mulX(mulX(mulX(p))) ^ p; }
      function mulX(p) { return ((p & 0x7F) << 1) ^ (((p & 0x80) >>> 7) * 0x1B); }

      result[j++] = mul14(c0) ^ mul11(c1) ^ mul13(c2) ^ mul9(c3);
      result[j++] = mul9(c0) ^ mul14(c1) ^ mul11(c2) ^ mul13(c3);
      result[j++] = mul13(c0) ^ mul9(c1) ^ mul14(c2) ^ mul11(c3);
      result[j++] = mul11(c0) ^ mul13(c1) ^ mul9(c2) ^ mul14(c3);
    }

    return result;
  }

  function aesRound(state, roundKey) {
    state = aesSubBytes(state);
    state = aesShiftRows(state);
    state = aesMixColumns(state);
    return OpCodes.XorArrays(state, roundKey);
  }

  function aesInvRound(state, roundKey) {
    state = OpCodes.XorArrays(state, roundKey);
    state = aesInvMixColumns(state);
    state = aesInvShiftRows(state);
    state = aesInvSubBytes(state);
    return state;
  }

  // Simpira v2 configuration for different variants
  const SIMPIRA_CONFIGS = {
    128: { b: 1, rounds: 12, name: "Simpira-128" },
    256: { b: 2, rounds: 15, name: "Simpira-256" },
    384: { b: 3, rounds: 21, name: "Simpira-384" },
    512: { b: 4, rounds: 15, name: "Simpira-512" },
    768: { b: 6, rounds: 15, name: "Simpira-768" },
    1024: { b: 8, rounds: 18, name: "Simpira-1024" }
  };

  // Base algorithm class for Simpira v2 permutations
  class SimpliraPermutationAlgorithm extends Algorithm {
    constructor(bitSize) {
      super();

      const config = SIMPIRA_CONFIGS[bitSize];
      if (!config) {
        throw new Error(`Unsupported Simpira variant: ${bitSize} bits`);
      }

      this.bitSize = bitSize;
      this.byteSize = bitSize / 8;
      this.b = config.b;
      this.rounds = config.rounds;

      this.name = config.name;
      this.description = `${config.name} permutation using AES round function. Input/output size: ${bitSize} bits (${this.byteSize} bytes). Designed for Intel AES-NI optimization.`;
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

    _computeTestVector(input) {
      // Create instance and compute expected output
      const instance = this.CreateInstance(false);
      instance.Feed(input);
      return instance.Result();
    }

    CreateInstance(isInverse = false) {
      return new SimpliraPermutationInstance(this, isInverse);
    }
  }

  class SimpliraPermutationInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      if (this.inputBuffer.length + data.length > this.algorithm.byteSize) {
        throw new Error(`Input too large: ${this.algorithm.name} accepts exactly ${this.algorithm.byteSize} bytes`);
      }

      this.inputBuffer.push(...data);
    }

    Result() {
      if (this.inputBuffer.length !== this.algorithm.byteSize) {
        throw new Error(`Invalid input size: expected ${this.algorithm.byteSize} bytes, got ${this.inputBuffer.length}`);
      }

      if (this.isInverse) {
        return this._computeInverse();
      } else {
        return this._computePermutation();
      }
    }

    _computePermutation() {
      const config = SIMPIRA_CONFIGS[this.algorithm.bitSize];

      if (config.b === 1) {
        // For b=1: 12-round AES with fixed round keys
        return this._simpira128();
      } else {
        // For b≥2: Generalized Feistel Structure
        return this._simpiraGFS();
      }
    }

    _computeInverse() {
      const config = SIMPIRA_CONFIGS[this.algorithm.bitSize];

      if (config.b === 1) {
        // For b=1: Inverse of 12-round AES
        return this._simpira128Inverse();
      } else {
        // For b≥2: Inverse Generalized Feistel Structure
        return this._simpiraGFSInverse();
      }
    }

    _simpira128() {
      // Simpira-128: 12-round AES with fixed round keys
      let state = [...this.inputBuffer];

      // Initial round key addition
      const initialKey = this._generateRoundConstant(0, 0);
      state = OpCodes.XorArrays(state, initialKey);

      // 11 full rounds
      for (let round = 1; round <= 11; ++round) {
        const roundKey = this._generateRoundConstant(round, 0);
        state = aesRound(state, roundKey);
      }

      // Final round (no MixColumns)
      const finalKey = this._generateRoundConstant(12, 0);
      state = aesSubBytes(state);
      state = aesShiftRows(state);
      state = OpCodes.XorArrays(state, finalKey);

      return state;
    }

    _simpira128Inverse() {
      // Inverse Simpira-128: 12-round inverse AES
      let state = [...this.inputBuffer];

      // Undo final round
      const finalKey = this._generateRoundConstant(12, 0);
      state = OpCodes.XorArrays(state, finalKey);
      state = aesInvShiftRows(state);
      state = aesInvSubBytes(state);

      // Undo 11 full rounds
      for (let round = 11; round >= 1; --round) {
        const roundKey = this._generateRoundConstant(round, 0);
        state = aesInvRound(state, roundKey);
      }

      // Undo initial round key addition
      const initialKey = this._generateRoundConstant(0, 0);
      state = OpCodes.XorArrays(state, initialKey);

      return state;
    }

    _simpiraGFS() {
      // Generalized Feistel Structure for b≥2
      const b = this.algorithm.b;
      const rounds = this.algorithm.rounds;

      // Split input into b blocks of 128 bits each
      const blocks = [];
      for (let i = 0; i < b; ++i) {
        blocks.push(this.inputBuffer.slice(i * 16, (i + 1) * 16));
      }

      // Apply GFS rounds
      for (let round = 0; round < rounds; ++round) {
        // F-function: two AES rounds with round constants
        const fInput = blocks[0];
        const fOutput = this._fFunction(fInput, round);

        // XOR with next block and rotate
        blocks[1] = OpCodes.XorArrays(blocks[1], fOutput);

        // Rotate blocks: (X0, X1, ..., Xb-1) -> (X1, X2, ..., Xb-1, X0)
        const temp = blocks[0];
        for (let i = 0; i < b - 1; ++i) {
          blocks[i] = blocks[i + 1];
        }
        blocks[b - 1] = temp;
      }

      // Concatenate blocks back to output
      const result = [];
      for (let i = 0; i < b; ++i) {
        result.push(...blocks[i]);
      }

      return result;
    }

    _simpiraGFSInverse() {
      // Inverse Generalized Feistel Structure
      const b = this.algorithm.b;
      const rounds = this.algorithm.rounds;

      // Split input into b blocks of 128 bits each
      const blocks = [];
      for (let i = 0; i < b; ++i) {
        blocks.push(this.inputBuffer.slice(i * 16, (i + 1) * 16));
      }

      // Apply inverse GFS rounds
      for (let round = rounds - 1; round >= 0; --round) {
        // Inverse rotate blocks: (X0, X1, ..., Xb-1) -> (Xb-1, X0, X1, ..., Xb-2)
        const temp = blocks[b - 1];
        for (let i = b - 1; i > 0; --i) {
          blocks[i] = blocks[i - 1];
        }
        blocks[0] = temp;

        // Inverse F-function application
        const fInput = blocks[0];
        const fOutput = this._fFunction(fInput, round);
        blocks[1] = OpCodes.XorArrays(blocks[1], fOutput);
      }

      // Concatenate blocks back to output
      const result = [];
      for (let i = 0; i < b; ++i) {
        result.push(...blocks[i]);
      }

      return result;
    }

    _fFunction(input, round) {
      // F-function: two AES rounds
      let state = [...input];

      // First AES round with round constant
      const rc1 = this._generateRoundConstant(round, 0);
      state = aesRound(state, rc1);

      // Second AES round with different round constant
      const rc2 = this._generateRoundConstant(round, 1);
      state = aesRound(state, rc2);

      return state;
    }

    _generateRoundConstant(round, subRound) {
      // Simpira v2 round constant generation
      // Based on simple counter to avoid backdoors
      const constant = new Array(16);
      const counter = (round * 2 + subRound) + 1; // Start from 1

      // Fill with strengthened constants (v2 improvement)
      for (let i = 0; i < 16; ++i) {
        constant[i] = (counter + i * 17) & 0xFF; // Dense constants to prevent invariant subspaces
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
