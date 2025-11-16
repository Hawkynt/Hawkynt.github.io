/**
 * ForkSkinny Tweakable Block Cipher
 *
 * ForkSkinny is a modified version of the SKINNY block cipher that supports "forking":
 * halfway through the rounds, the cipher forks in two different directions to produce
 * two different outputs from a single input. This innovative construction is designed
 * for authenticated encryption in the ForkAE NIST lightweight crypto finalist.
 *
 * References:
 * - ForkAE specification: https://www.esat.kuleuven.be/cosic/forkae/
 * - Original implementation: https://github.com/rweather/lightweight-crypto
 *
 * @author Reference implementation by Southern Storm Software, Pty Ltd (2020)
 * @author JavaScript implementation for SynthelicZ Cipher Tools
 */

(function(global) {
  'use strict';

  // Load dependencies
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    global.AlgorithmFramework = require('../../AlgorithmFramework.js');
  }

  if (!global.OpCodes && typeof require !== 'undefined') {
    global.OpCodes = require('../../OpCodes.js');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ForkSkinny round constants (7-bit LFSR for 87 rounds)
  const RC = [
    0x01, 0x03, 0x07, 0x0f, 0x1f, 0x3f, 0x7e, 0x7d,
    0x7b, 0x77, 0x6f, 0x5f, 0x3e, 0x7c, 0x79, 0x73,
    0x67, 0x4f, 0x1e, 0x3d, 0x7a, 0x75, 0x6b, 0x57,
    0x2e, 0x5c, 0x38, 0x70, 0x61, 0x43, 0x06, 0x0d,
    0x1b, 0x37, 0x6e, 0x5d, 0x3a, 0x74, 0x69, 0x53,
    0x26, 0x4c, 0x18, 0x31, 0x62, 0x45, 0x0a, 0x15,
    0x2b, 0x56, 0x2c, 0x58, 0x30, 0x60, 0x41, 0x02,
    0x05, 0x0b, 0x17, 0x2f, 0x5e, 0x3c, 0x78, 0x71,
    0x63, 0x47, 0x0e, 0x1d, 0x3b, 0x76, 0x6d, 0x5b,
    0x36, 0x6c, 0x59, 0x32, 0x64, 0x49, 0x12, 0x25,
    0x4a, 0x14, 0x29, 0x52, 0x24, 0x48, 0x10
  ];

  // SKINNY-128 S-box (optimized bit-sliced version)
  function skinny128_sbox(x) {
    let y;

    // Mix the bits
    x = (~x) >>> 0;
    x ^= (((x >>> 2) & (x >>> 3)) & 0x11111111) >>> 0;
    y = (((x << 5) & (x << 1)) & 0x20202020) >>> 0;
    x ^= ((((x << 5) & (x << 4)) & 0x40404040) ^ y) >>> 0;
    y = (((x << 2) & (x << 1)) & 0x80808080) >>> 0;
    x ^= ((((x >>> 2) & (x << 1)) & 0x02020202) ^ y) >>> 0;
    y = (((x >>> 5) & (x << 1)) & 0x04040404) >>> 0;
    x ^= ((((x >>> 1) & (x >>> 2)) & 0x08080808) ^ y) >>> 0;
    x = (~x) >>> 0;

    // Permutation: [2 7 6 1 3 0 4 5]
    x = (((x & 0x08080808) << 1) |
         ((x & 0x32323232) << 2) |
         ((x & 0x01010101) << 5) |
         ((x & 0x80808080) >>> 6) |
         ((x & 0x40404040) >>> 4) |
         ((x & 0x04040404) >>> 2)) >>> 0;

    return x;
  }

  // SKINNY-128 inverse S-box
  function skinny128_inv_sbox(x) {
    let y;

    // Mix the bits
    x = (~x) >>> 0;
    y = (((x >>> 1) & (x >>> 3)) & 0x01010101) >>> 0;
    x ^= ((((x >>> 2) & (x >>> 3)) & 0x10101010) ^ y) >>> 0;
    y = (((x >>> 6) & (x >>> 1)) & 0x02020202) >>> 0;
    x ^= ((((x >>> 1) & (x >>> 2)) & 0x08080808) ^ y) >>> 0;
    y = (((x << 2) & (x << 1)) & 0x80808080) >>> 0;
    x ^= ((((x >>> 1) & (x << 2)) & 0x04040404) ^ y) >>> 0;
    y = (((x << 5) & (x << 1)) & 0x20202020) >>> 0;
    x ^= ((((x << 4) & (x << 5)) & 0x40404040) ^ y) >>> 0;
    x = (~x) >>> 0;

    // Permutation: [5 3 0 4 6 7 2 1]
    x = (((x & 0x01010101) << 2) |
         ((x & 0x04040404) << 4) |
         ((x & 0x02020202) << 6) |
         ((x & 0x20202020) >>> 5) |
         ((x & 0xC8C8C8C8) >>> 2) |
         ((x & 0x10101010) >>> 1)) >>> 0;

    return x;
  }

  // LFSR2 for TK2 (forward direction)
  function skinny128_LFSR2(x) {
    const _x = x >>> 0;
    return (((_x << 1) & 0xFEFEFEFE) ^
            (((_x >>> 7) ^ (_x >>> 5)) & 0x01010101)) >>> 0;
  }

  // LFSR3 for TK3 (forward direction)
  function skinny128_LFSR3(x) {
    const _x = x >>> 0;
    return (((_x >>> 1) & 0x7F7F7F7F) ^
            (((_x << 7) ^ (_x << 1)) & 0x80808080)) >>> 0;
  }

  // Inverse LFSR2 (LFSR3 is inverse of LFSR2)
  function skinny128_inv_LFSR2(x) {
    return skinny128_LFSR3(x);
  }

  // Inverse LFSR3 (LFSR2 is inverse of LFSR3)
  function skinny128_inv_LFSR3(x) {
    return skinny128_LFSR2(x);
  }

  // Permute tweakey state PT = [9, 15, 8, 13, 10, 14, 12, 11, 0, 1, 2, 3, 4, 5, 6, 7]
  function skinny128_permute_tk(tk) {
    const row2 = tk[2];
    const row3 = tk[3];
    tk[2] = tk[0];
    tk[3] = tk[1];
    const row3_rot = ((row3 << 16) | (row3 >>> 16)) >>> 0;
    tk[0] = (((row2 >>> 8) & 0x000000FF) |
             ((row2 << 16) & 0x00FF0000) |
             (row3_rot & 0xFF00FF00)) >>> 0;
    tk[1] = (((row2 >>> 16) & 0x000000FF) |
             (row2 & 0xFF000000) |
             ((row3_rot << 8) & 0x0000FF00) |
             (row3_rot & 0x00FF0000)) >>> 0;
  }

  // Inverse permute tweakey PT' = [8, 9, 10, 11, 12, 13, 14, 15, 2, 0, 4, 7, 6, 3, 5, 1]
  function skinny128_inv_permute_tk(tk) {
    const row0 = tk[0];
    const row1 = tk[1];
    tk[0] = tk[2];
    tk[1] = tk[3];
    tk[2] = (((row0 >>> 16) & 0x000000FF) |
             ((row0 << 8) & 0x0000FF00) |
             ((row1 << 16) & 0x00FF0000) |
             (row1 & 0xFF000000)) >>> 0;
    tk[3] = (((row0 >>> 16) & 0x0000FF00) |
             ((row0 << 16) & 0xFF000000) |
             ((row1 >>> 16) & 0x000000FF) |
             ((row1 << 8) & 0x00FF0000)) >>> 0;
  }

  // ForkSkinny-128-256 state
  class ForkSkinny128_256_State {
    constructor() {
      this.TK1 = new Uint32Array(4);
      this.TK2 = new Uint32Array(4);
      this.S = new Uint32Array(4);
    }
  }

  // ForkSkinny-128-384 state
  class ForkSkinny128_384_State {
    constructor() {
      this.TK1 = new Uint32Array(4);
      this.TK2 = new Uint32Array(4);
      this.TK3 = new Uint32Array(4);
      this.S = new Uint32Array(4);
    }
  }

  // Apply ForkSkinny-128-256 rounds
  function forkskinny_128_256_rounds(state, first, last) {
    let s0 = state.S[0];
    let s1 = state.S[1];
    let s2 = state.S[2];
    let s3 = state.S[3];

    for (let round = first; round < last; round++) {
      // Apply S-box to all cells
      s0 = skinny128_sbox(s0);
      s1 = skinny128_sbox(s1);
      s2 = skinny128_sbox(s2);
      s3 = skinny128_sbox(s3);

      // XOR round constant and subkey
      const rc = RC[round];
      s0 ^= (state.TK1[0] ^ state.TK2[0] ^ (rc & 0x0F) ^ 0x00020000) >>> 0;
      s1 ^= (state.TK1[1] ^ state.TK2[1] ^ (rc >>> 4)) >>> 0;
      s2 ^= 0x02;

      // Shift rows (left rotate to move cells right)
      s1 = OpCodes.RotL32(s1, 8);
      s2 = OpCodes.RotL32(s2, 16);
      s3 = OpCodes.RotL32(s3, 24);

      // Mix columns
      s1 ^= s2;
      s2 ^= s0;
      const temp = (s3 ^ s2) >>> 0;
      s3 = s2;
      s2 = s1;
      s1 = s0;
      s0 = temp;

      // Permute tweakey for next round
      skinny128_permute_tk(state.TK1);
      skinny128_permute_tk(state.TK2);
      state.TK2[0] = skinny128_LFSR2(state.TK2[0]);
      state.TK2[1] = skinny128_LFSR2(state.TK2[1]);
    }

    state.S[0] = s0;
    state.S[1] = s1;
    state.S[2] = s2;
    state.S[3] = s3;
  }

  // Apply ForkSkinny-128-256 inverse rounds
  function forkskinny_128_256_inv_rounds(state, first, last) {
    let s0 = state.S[0];
    let s1 = state.S[1];
    let s2 = state.S[2];
    let s3 = state.S[3];

    for (let round = first; round > last; round--) {
      // Inverse permute tweakey
      state.TK2[0] = skinny128_inv_LFSR2(state.TK2[0]);
      state.TK2[1] = skinny128_inv_LFSR2(state.TK2[1]);
      skinny128_inv_permute_tk(state.TK1);
      skinny128_inv_permute_tk(state.TK2);

      // Inverse mix columns
      const temp = s0;
      s0 = s1;
      s1 = s2;
      s2 = s3;
      s3 = (temp ^ s2) >>> 0;
      s2 ^= s0;
      s1 ^= s2;

      // Inverse shift rows
      s1 = OpCodes.RotR32(s1, 8);
      s2 = OpCodes.RotR32(s2, 16);
      s3 = OpCodes.RotR32(s3, 24);

      // XOR round constant and subkey
      const rc = RC[round - 1];
      s0 ^= (state.TK1[0] ^ state.TK2[0] ^ (rc & 0x0F) ^ 0x00020000) >>> 0;
      s1 ^= (state.TK1[1] ^ state.TK2[1] ^ (rc >>> 4)) >>> 0;
      s2 ^= 0x02;

      // Apply inverse S-box
      s0 = skinny128_inv_sbox(s0);
      s1 = skinny128_inv_sbox(s1);
      s2 = skinny128_inv_sbox(s2);
      s3 = skinny128_inv_sbox(s3);
    }

    state.S[0] = s0;
    state.S[1] = s1;
    state.S[2] = s2;
    state.S[3] = s3;
  }

  // Forward tweakey schedule
  function forkskinny_128_256_forward_tk(state, rounds) {
    // Optimization: permutation repeats every 16 rounds
    while (rounds >= 16) {
      for (let i = 0; i < 8; i++) {
        state.TK2[0] = skinny128_LFSR2(state.TK2[0]);
        state.TK2[1] = skinny128_LFSR2(state.TK2[1]);
        state.TK2[2] = skinny128_LFSR2(state.TK2[2]);
        state.TK2[3] = skinny128_LFSR2(state.TK2[3]);
      }
      rounds -= 16;
    }

    // Handle remaining rounds
    while (rounds > 0) {
      skinny128_permute_tk(state.TK1);
      skinny128_permute_tk(state.TK2);
      state.TK2[0] = skinny128_LFSR2(state.TK2[0]);
      state.TK2[1] = skinny128_LFSR2(state.TK2[1]);
      rounds--;
    }
  }

  // Reverse tweakey schedule
  function forkskinny_128_256_reverse_tk(state, rounds) {
    // Optimization: permutation repeats every 16 rounds
    while (rounds >= 16) {
      for (let i = 0; i < 8; i++) {
        state.TK2[0] = skinny128_inv_LFSR2(state.TK2[0]);
        state.TK2[1] = skinny128_inv_LFSR2(state.TK2[1]);
        state.TK2[2] = skinny128_inv_LFSR2(state.TK2[2]);
        state.TK2[3] = skinny128_inv_LFSR2(state.TK2[3]);
      }
      rounds -= 16;
    }

    // Handle remaining rounds
    while (rounds > 0) {
      state.TK2[0] = skinny128_inv_LFSR2(state.TK2[0]);
      state.TK2[1] = skinny128_inv_LFSR2(state.TK2[1]);
      skinny128_inv_permute_tk(state.TK1);
      skinny128_inv_permute_tk(state.TK2);
      rounds--;
    }
  }

  // Apply ForkSkinny-128-384 rounds
  function forkskinny_128_384_rounds(state, first, last) {
    let s0 = state.S[0];
    let s1 = state.S[1];
    let s2 = state.S[2];
    let s3 = state.S[3];

    for (let round = first; round < last; round++) {
      // Apply S-box to all cells
      s0 = skinny128_sbox(s0);
      s1 = skinny128_sbox(s1);
      s2 = skinny128_sbox(s2);
      s3 = skinny128_sbox(s3);

      // XOR round constant and subkey
      const rc = RC[round];
      s0 ^= (state.TK1[0] ^ state.TK2[0] ^ state.TK3[0] ^ (rc & 0x0F) ^ 0x00020000) >>> 0;
      s1 ^= (state.TK1[1] ^ state.TK2[1] ^ state.TK3[1] ^ (rc >>> 4)) >>> 0;
      s2 ^= 0x02;

      // Shift rows
      s1 = OpCodes.RotL32(s1, 8);
      s2 = OpCodes.RotL32(s2, 16);
      s3 = OpCodes.RotL32(s3, 24);

      // Mix columns
      s1 ^= s2;
      s2 ^= s0;
      const temp = (s3 ^ s2) >>> 0;
      s3 = s2;
      s2 = s1;
      s1 = s0;
      s0 = temp;

      // Permute tweakey
      skinny128_permute_tk(state.TK1);
      skinny128_permute_tk(state.TK2);
      skinny128_permute_tk(state.TK3);
      state.TK2[0] = skinny128_LFSR2(state.TK2[0]);
      state.TK2[1] = skinny128_LFSR2(state.TK2[1]);
      state.TK3[0] = skinny128_LFSR3(state.TK3[0]);
      state.TK3[1] = skinny128_LFSR3(state.TK3[1]);
    }

    state.S[0] = s0;
    state.S[1] = s1;
    state.S[2] = s2;
    state.S[3] = s3;
  }

  // Apply ForkSkinny-128-384 inverse rounds
  function forkskinny_128_384_inv_rounds(state, first, last) {
    let s0 = state.S[0];
    let s1 = state.S[1];
    let s2 = state.S[2];
    let s3 = state.S[3];

    for (let round = first; round > last; round--) {
      // Inverse permute tweakey
      state.TK2[0] = skinny128_inv_LFSR2(state.TK2[0]);
      state.TK2[1] = skinny128_inv_LFSR2(state.TK2[1]);
      state.TK3[0] = skinny128_inv_LFSR3(state.TK3[0]);
      state.TK3[1] = skinny128_inv_LFSR3(state.TK3[1]);
      skinny128_inv_permute_tk(state.TK1);
      skinny128_inv_permute_tk(state.TK2);
      skinny128_inv_permute_tk(state.TK3);

      // Inverse mix columns
      const temp = s0;
      s0 = s1;
      s1 = s2;
      s2 = s3;
      s3 = (temp ^ s2) >>> 0;
      s2 ^= s0;
      s1 ^= s2;

      // Inverse shift rows
      s1 = OpCodes.RotR32(s1, 8);
      s2 = OpCodes.RotR32(s2, 16);
      s3 = OpCodes.RotR32(s3, 24);

      // XOR round constant and subkey
      const rc = RC[round - 1];
      s0 ^= (state.TK1[0] ^ state.TK2[0] ^ state.TK3[0] ^ (rc & 0x0F) ^ 0x00020000) >>> 0;
      s1 ^= (state.TK1[1] ^ state.TK2[1] ^ state.TK3[1] ^ (rc >>> 4)) >>> 0;
      s2 ^= 0x02;

      // Apply inverse S-box
      s0 = skinny128_inv_sbox(s0);
      s1 = skinny128_inv_sbox(s1);
      s2 = skinny128_inv_sbox(s2);
      s3 = skinny128_inv_sbox(s3);
    }

    state.S[0] = s0;
    state.S[1] = s1;
    state.S[2] = s2;
    state.S[3] = s3;
  }

  // Forward tweakey schedule for 128-384
  function forkskinny_128_384_forward_tk(state, rounds) {
    while (rounds >= 16) {
      for (let i = 0; i < 8; i++) {
        state.TK2[0] = skinny128_LFSR2(state.TK2[0]);
        state.TK2[1] = skinny128_LFSR2(state.TK2[1]);
        state.TK2[2] = skinny128_LFSR2(state.TK2[2]);
        state.TK2[3] = skinny128_LFSR2(state.TK2[3]);
        state.TK3[0] = skinny128_LFSR3(state.TK3[0]);
        state.TK3[1] = skinny128_LFSR3(state.TK3[1]);
        state.TK3[2] = skinny128_LFSR3(state.TK3[2]);
        state.TK3[3] = skinny128_LFSR3(state.TK3[3]);
      }
      rounds -= 16;
    }

    while (rounds > 0) {
      skinny128_permute_tk(state.TK1);
      skinny128_permute_tk(state.TK2);
      skinny128_permute_tk(state.TK3);
      state.TK2[0] = skinny128_LFSR2(state.TK2[0]);
      state.TK2[1] = skinny128_LFSR2(state.TK2[1]);
      state.TK3[0] = skinny128_LFSR3(state.TK3[0]);
      state.TK3[1] = skinny128_LFSR3(state.TK3[1]);
      rounds--;
    }
  }

  // Reverse tweakey schedule for 128-384
  function forkskinny_128_384_reverse_tk(state, rounds) {
    while (rounds >= 16) {
      for (let i = 0; i < 8; i++) {
        state.TK2[0] = skinny128_inv_LFSR2(state.TK2[0]);
        state.TK2[1] = skinny128_inv_LFSR2(state.TK2[1]);
        state.TK2[2] = skinny128_inv_LFSR2(state.TK2[2]);
        state.TK2[3] = skinny128_inv_LFSR2(state.TK2[3]);
        state.TK3[0] = skinny128_inv_LFSR3(state.TK3[0]);
        state.TK3[1] = skinny128_inv_LFSR3(state.TK3[1]);
        state.TK3[2] = skinny128_inv_LFSR3(state.TK3[2]);
        state.TK3[3] = skinny128_inv_LFSR3(state.TK3[3]);
      }
      rounds -= 16;
    }

    while (rounds > 0) {
      state.TK2[0] = skinny128_inv_LFSR2(state.TK2[0]);
      state.TK2[1] = skinny128_inv_LFSR2(state.TK2[1]);
      state.TK3[0] = skinny128_inv_LFSR3(state.TK3[0]);
      state.TK3[1] = skinny128_inv_LFSR3(state.TK3[1]);
      skinny128_inv_permute_tk(state.TK1);
      skinny128_inv_permute_tk(state.TK2);
      skinny128_inv_permute_tk(state.TK3);
      rounds--;
    }
  }

  // Constants for forking points
  const FORKSKINNY_128_256_ROUNDS_BEFORE = 21;
  const FORKSKINNY_128_256_ROUNDS_AFTER = 27;
  const FORKSKINNY_128_384_ROUNDS_BEFORE = 25;
  const FORKSKINNY_128_384_ROUNDS_AFTER = 31;

  // Branching constants for left fork
  const BRANCH_CONSTANT = [0x08040201, 0x82412010, 0x28140a05, 0x8844a251];

  // ForkSkinny-128-256 Algorithm
  /**
 * ForkSkinny128_256 - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class ForkSkinny128_256 extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "ForkSkinny-128-256";
      this.description = "ForkSkinny is a tweakable block cipher with forking construction, producing two outputs from one input. Designed for authenticated encryption in the ForkAE NIST lightweight crypto finalist.";
      this.inventor = "Elena Andreeva, Reza Reyhanitabar, Damian Vizar";
      this.year = 2019;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Tweakable Block Cipher";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BE;

      this.SupportedKeySizes = [new KeySize(32, 32, 1)];
      this.SupportedBlockSizes = [new KeySize(16, 16, 1)];

      this.documentation = [
        new LinkItem("ForkAE Official Website", "https://www.esat.kuleuven.be/cosic/forkae/"),
        new LinkItem("Reference Implementation", "https://github.com/rweather/lightweight-crypto"),
        new LinkItem("NIST Lightweight Crypto", "https://csrc.nist.gov/projects/lightweight-cryptography")
      ];

      // Test vectors from reference implementation
      const OC = typeof OpCodes !== 'undefined' ? OpCodes : global.OpCodes;
      this.tests = [
        {
          text: "ForkSkinny-128-256 Left Output",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/unit/test-forkskinny.c",
          input: OC.Hex8ToBytes("00112233445566778899aabbccddeeff"),
          key: OC.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OC.Hex8ToBytes("32411c5ca70baf9249514b3893254228"),
          forkOutput: "left"
        },
        {
          text: "ForkSkinny-128-256 Right Output",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/unit/test-forkskinny.c",
          input: OC.Hex8ToBytes("00112233445566778899aabbccddeeff"),
          key: OC.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OC.Hex8ToBytes("d6fd008b1f5f14aaf1341a5f76e5a32f"),
          forkOutput: "right"
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new ForkSkinny128_256Instance(this, isInverse);
    }
  }

  // ForkSkinny-128-256 Instance
  /**
 * ForkSkinny128_256 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ForkSkinny128_256Instance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._forkOutput = "both"; // "left", "right", or "both"
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      if (keyBytes.length !== 32) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes");
      }

      this._key = [...keyBytes];
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    set forkOutput(value) {
      if (value !== "left" && value !== "right" && value !== "both") {
        throw new Error("forkOutput must be 'left', 'right', or 'both'");
      }
      this._forkOutput = value;
    }

    get forkOutput() {
      return this._forkOutput;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");
      if (this.inputBuffer.length % 16 !== 0) {
        throw new Error("Input must be multiple of 16 bytes");
      }

      const output = [];

      for (let i = 0; i < this.inputBuffer.length; i += 16) {
        const block = this.inputBuffer.slice(i, i + 16);
        let result;

        if (this.isInverse) {
          result = this.decryptBlock(block);
        } else {
          result = this.encryptBlock(block);
        }

        output.push(...result);
      }

      this.inputBuffer = [];
      return output;
    }

    encryptBlock(input) {
      const state = new ForkSkinny128_256_State();

      // Load tweakey and plaintext (little-endian)
      state.TK1[0] = OpCodes.Pack32LE(this._key[0], this._key[1], this._key[2], this._key[3]);
      state.TK1[1] = OpCodes.Pack32LE(this._key[4], this._key[5], this._key[6], this._key[7]);
      state.TK1[2] = OpCodes.Pack32LE(this._key[8], this._key[9], this._key[10], this._key[11]);
      state.TK1[3] = OpCodes.Pack32LE(this._key[12], this._key[13], this._key[14], this._key[15]);
      state.TK2[0] = OpCodes.Pack32LE(this._key[16], this._key[17], this._key[18], this._key[19]);
      state.TK2[1] = OpCodes.Pack32LE(this._key[20], this._key[21], this._key[22], this._key[23]);
      state.TK2[2] = OpCodes.Pack32LE(this._key[24], this._key[25], this._key[26], this._key[27]);
      state.TK2[3] = OpCodes.Pack32LE(this._key[28], this._key[29], this._key[30], this._key[31]);
      state.S[0] = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      state.S[1] = OpCodes.Pack32LE(input[4], input[5], input[6], input[7]);
      state.S[2] = OpCodes.Pack32LE(input[8], input[9], input[10], input[11]);
      state.S[3] = OpCodes.Pack32LE(input[12], input[13], input[14], input[15]);

      // Run rounds before forking
      forkskinny_128_256_rounds(state, 0, FORKSKINNY_128_256_ROUNDS_BEFORE);

      let outputLeft = null;
      let outputRight = null;

      if (this._forkOutput === "both" || this._forkOutput === "left") {
        // Save state at fork point (state AND tweakey)
        const F_S = [state.S[0], state.S[1], state.S[2], state.S[3]];
        const F_TK1 = [state.TK1[0], state.TK1[1], state.TK1[2], state.TK1[3]];
        const F_TK2 = [state.TK2[0], state.TK2[1], state.TK2[2], state.TK2[3]];

        if (this._forkOutput === "both") {
          // Generate right output first
          forkskinny_128_256_rounds(state, FORKSKINNY_128_256_ROUNDS_BEFORE,
                                    FORKSKINNY_128_256_ROUNDS_BEFORE + FORKSKINNY_128_256_ROUNDS_AFTER);
          outputRight = this.unpackState(state.S);

          // Restore fork point (state AND tweakey)
          state.S[0] = F_S[0];
          state.S[1] = F_S[1];
          state.S[2] = F_S[2];
          state.S[3] = F_S[3];
          state.TK1[0] = F_TK1[0];
          state.TK1[1] = F_TK1[1];
          state.TK1[2] = F_TK1[2];
          state.TK1[3] = F_TK1[3];
          state.TK2[0] = F_TK2[0];
          state.TK2[1] = F_TK2[1];
          state.TK2[2] = F_TK2[2];
          state.TK2[3] = F_TK2[3];
        }

        // Generate left output with branching constant
        state.S[0] ^= BRANCH_CONSTANT[0];
        state.S[1] ^= BRANCH_CONSTANT[1];
        state.S[2] ^= BRANCH_CONSTANT[2];
        state.S[3] ^= BRANCH_CONSTANT[3];
        forkskinny_128_256_rounds(state, FORKSKINNY_128_256_ROUNDS_BEFORE + FORKSKINNY_128_256_ROUNDS_AFTER,
                                  FORKSKINNY_128_256_ROUNDS_BEFORE + FORKSKINNY_128_256_ROUNDS_AFTER * 2);
        outputLeft = this.unpackState(state.S);
      } else {
        // Only right output
        forkskinny_128_256_rounds(state, FORKSKINNY_128_256_ROUNDS_BEFORE,
                                  FORKSKINNY_128_256_ROUNDS_BEFORE + FORKSKINNY_128_256_ROUNDS_AFTER);
        outputRight = this.unpackState(state.S);
      }

      // Return appropriate output based on fork selection
      if (this._forkOutput === "left") return outputLeft;
      if (this._forkOutput === "right") return outputRight;
      return outputLeft.concat(outputRight); // Both outputs concatenated
    }

    decryptBlock(input) {
      const state = new ForkSkinny128_256_State();

      // Load tweakey and ciphertext
      state.TK1[0] = OpCodes.Pack32LE(this._key[0], this._key[1], this._key[2], this._key[3]);
      state.TK1[1] = OpCodes.Pack32LE(this._key[4], this._key[5], this._key[6], this._key[7]);
      state.TK1[2] = OpCodes.Pack32LE(this._key[8], this._key[9], this._key[10], this._key[11]);
      state.TK1[3] = OpCodes.Pack32LE(this._key[12], this._key[13], this._key[14], this._key[15]);
      state.TK2[0] = OpCodes.Pack32LE(this._key[16], this._key[17], this._key[18], this._key[19]);
      state.TK2[1] = OpCodes.Pack32LE(this._key[20], this._key[21], this._key[22], this._key[23]);
      state.TK2[2] = OpCodes.Pack32LE(this._key[24], this._key[25], this._key[26], this._key[27]);
      state.TK2[3] = OpCodes.Pack32LE(this._key[28], this._key[29], this._key[30], this._key[31]);
      state.S[0] = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      state.S[1] = OpCodes.Pack32LE(input[4], input[5], input[6], input[7]);
      state.S[2] = OpCodes.Pack32LE(input[8], input[9], input[10], input[11]);
      state.S[3] = OpCodes.Pack32LE(input[12], input[13], input[14], input[15]);

      // Fast-forward tweakey to end of schedule
      const totalRounds = FORKSKINNY_128_256_ROUNDS_BEFORE + FORKSKINNY_128_256_ROUNDS_AFTER * 2;
      forkskinny_128_256_forward_tk(state, totalRounds);

      // Decrypt left branch in reverse
      forkskinny_128_256_inv_rounds(state, totalRounds,
                                    FORKSKINNY_128_256_ROUNDS_BEFORE + FORKSKINNY_128_256_ROUNDS_AFTER);
      state.S[0] ^= BRANCH_CONSTANT[0];
      state.S[1] ^= BRANCH_CONSTANT[1];
      state.S[2] ^= BRANCH_CONSTANT[2];
      state.S[3] ^= BRANCH_CONSTANT[3];

      // Decrypt common rounds
      forkskinny_128_256_inv_rounds(state, FORKSKINNY_128_256_ROUNDS_BEFORE, 0);

      return this.unpackState(state.S);
    }

    unpackState(S) {
      const output = [];
      for (let i = 0; i < 4; i++) {
        const bytes = OpCodes.Unpack32LE(S[i]);
        output.push(...bytes);
      }
      return output;
    }
  }

  // ForkSkinny-128-384 Algorithm
  /**
 * ForkSkinny128_384 - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class ForkSkinny128_384 extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "ForkSkinny-128-384";
      this.description = "ForkSkinny-128-384 is a tweakable block cipher with 384-bit tweakey and forking construction. Used in ForkAE authenticated encryption suite.";
      this.inventor = "Elena Andreeva, Reza Reyhanitabar, Damian Vizar";
      this.year = 2019;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Tweakable Block Cipher";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BE;

      this.SupportedKeySizes = [new KeySize(48, 48, 1)];
      this.SupportedBlockSizes = [new KeySize(16, 16, 1)];

      this.documentation = [
        new LinkItem("ForkAE Official Website", "https://www.esat.kuleuven.be/cosic/forkae/"),
        new LinkItem("Reference Implementation", "https://github.com/rweather/lightweight-crypto")
      ];

      const OC = typeof OpCodes !== 'undefined' ? OpCodes : global.OpCodes;
      this.tests = [
        {
          text: "ForkSkinny-128-384 Left Output",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/unit/test-forkskinny.c",
          input: OC.Hex8ToBytes("00112233445566778899aabbccddeeff"),
          key: OC.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f"),
          expected: OC.Hex8ToBytes("29260866a85fa181f7c1392fd709296c"),
          forkOutput: "left"
        },
        {
          text: "ForkSkinny-128-384 Right Output",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/unit/test-forkskinny.c",
          input: OC.Hex8ToBytes("00112233445566778899aabbccddeeff"),
          key: OC.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f"),
          expected: OC.Hex8ToBytes("d086cd2919969ee6c30adba21194f870"),
          forkOutput: "right"
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new ForkSkinny128_384Instance(this, isInverse);
    }
  }

  // ForkSkinny-128-384 Instance
  /**
 * ForkSkinny128_384 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ForkSkinny128_384Instance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._forkOutput = "both";
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      if (keyBytes.length !== 48) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes");
      }

      this._key = [...keyBytes];
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    set forkOutput(value) {
      if (value !== "left" && value !== "right" && value !== "both") {
        throw new Error("forkOutput must be 'left', 'right', or 'both'");
      }
      this._forkOutput = value;
    }

    get forkOutput() {
      return this._forkOutput;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");
      if (this.inputBuffer.length % 16 !== 0) {
        throw new Error("Input must be multiple of 16 bytes");
      }

      const output = [];

      for (let i = 0; i < this.inputBuffer.length; i += 16) {
        const block = this.inputBuffer.slice(i, i + 16);
        let result;

        if (this.isInverse) {
          result = this.decryptBlock(block);
        } else {
          result = this.encryptBlock(block);
        }

        output.push(...result);
      }

      this.inputBuffer = [];
      return output;
    }

    encryptBlock(input) {
      const state = new ForkSkinny128_384_State();

      // Load tweakey and plaintext
      state.TK1[0] = OpCodes.Pack32LE(this._key[0], this._key[1], this._key[2], this._key[3]);
      state.TK1[1] = OpCodes.Pack32LE(this._key[4], this._key[5], this._key[6], this._key[7]);
      state.TK1[2] = OpCodes.Pack32LE(this._key[8], this._key[9], this._key[10], this._key[11]);
      state.TK1[3] = OpCodes.Pack32LE(this._key[12], this._key[13], this._key[14], this._key[15]);
      state.TK2[0] = OpCodes.Pack32LE(this._key[16], this._key[17], this._key[18], this._key[19]);
      state.TK2[1] = OpCodes.Pack32LE(this._key[20], this._key[21], this._key[22], this._key[23]);
      state.TK2[2] = OpCodes.Pack32LE(this._key[24], this._key[25], this._key[26], this._key[27]);
      state.TK2[3] = OpCodes.Pack32LE(this._key[28], this._key[29], this._key[30], this._key[31]);
      state.TK3[0] = OpCodes.Pack32LE(this._key[32], this._key[33], this._key[34], this._key[35]);
      state.TK3[1] = OpCodes.Pack32LE(this._key[36], this._key[37], this._key[38], this._key[39]);
      state.TK3[2] = OpCodes.Pack32LE(this._key[40], this._key[41], this._key[42], this._key[43]);
      state.TK3[3] = OpCodes.Pack32LE(this._key[44], this._key[45], this._key[46], this._key[47]);
      state.S[0] = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      state.S[1] = OpCodes.Pack32LE(input[4], input[5], input[6], input[7]);
      state.S[2] = OpCodes.Pack32LE(input[8], input[9], input[10], input[11]);
      state.S[3] = OpCodes.Pack32LE(input[12], input[13], input[14], input[15]);

      // Run rounds before forking
      forkskinny_128_384_rounds(state, 0, FORKSKINNY_128_384_ROUNDS_BEFORE);

      let outputLeft = null;
      let outputRight = null;

      if (this._forkOutput === "both" || this._forkOutput === "left") {
        // Save state at fork point (state AND tweakey)
        const F_S = [state.S[0], state.S[1], state.S[2], state.S[3]];
        const F_TK1 = [state.TK1[0], state.TK1[1], state.TK1[2], state.TK1[3]];
        const F_TK2 = [state.TK2[0], state.TK2[1], state.TK2[2], state.TK2[3]];
        const F_TK3 = [state.TK3[0], state.TK3[1], state.TK3[2], state.TK3[3]];

        if (this._forkOutput === "both") {
          forkskinny_128_384_rounds(state, FORKSKINNY_128_384_ROUNDS_BEFORE,
                                    FORKSKINNY_128_384_ROUNDS_BEFORE + FORKSKINNY_128_384_ROUNDS_AFTER);
          outputRight = this.unpackState(state.S);

          // Restore fork point (state AND tweakey)
          state.S[0] = F_S[0];
          state.S[1] = F_S[1];
          state.S[2] = F_S[2];
          state.S[3] = F_S[3];
          state.TK1[0] = F_TK1[0];
          state.TK1[1] = F_TK1[1];
          state.TK1[2] = F_TK1[2];
          state.TK1[3] = F_TK1[3];
          state.TK2[0] = F_TK2[0];
          state.TK2[1] = F_TK2[1];
          state.TK2[2] = F_TK2[2];
          state.TK2[3] = F_TK2[3];
          state.TK3[0] = F_TK3[0];
          state.TK3[1] = F_TK3[1];
          state.TK3[2] = F_TK3[2];
          state.TK3[3] = F_TK3[3];
        }

        state.S[0] ^= BRANCH_CONSTANT[0];
        state.S[1] ^= BRANCH_CONSTANT[1];
        state.S[2] ^= BRANCH_CONSTANT[2];
        state.S[3] ^= BRANCH_CONSTANT[3];
        forkskinny_128_384_rounds(state, FORKSKINNY_128_384_ROUNDS_BEFORE + FORKSKINNY_128_384_ROUNDS_AFTER,
                                  FORKSKINNY_128_384_ROUNDS_BEFORE + FORKSKINNY_128_384_ROUNDS_AFTER * 2);
        outputLeft = this.unpackState(state.S);
      } else {
        forkskinny_128_384_rounds(state, FORKSKINNY_128_384_ROUNDS_BEFORE,
                                  FORKSKINNY_128_384_ROUNDS_BEFORE + FORKSKINNY_128_384_ROUNDS_AFTER);
        outputRight = this.unpackState(state.S);
      }

      if (this._forkOutput === "left") return outputLeft;
      if (this._forkOutput === "right") return outputRight;
      return outputLeft.concat(outputRight);
    }

    decryptBlock(input) {
      const state = new ForkSkinny128_384_State();

      // Load tweakey and ciphertext
      state.TK1[0] = OpCodes.Pack32LE(this._key[0], this._key[1], this._key[2], this._key[3]);
      state.TK1[1] = OpCodes.Pack32LE(this._key[4], this._key[5], this._key[6], this._key[7]);
      state.TK1[2] = OpCodes.Pack32LE(this._key[8], this._key[9], this._key[10], this._key[11]);
      state.TK1[3] = OpCodes.Pack32LE(this._key[12], this._key[13], this._key[14], this._key[15]);
      state.TK2[0] = OpCodes.Pack32LE(this._key[16], this._key[17], this._key[18], this._key[19]);
      state.TK2[1] = OpCodes.Pack32LE(this._key[20], this._key[21], this._key[22], this._key[23]);
      state.TK2[2] = OpCodes.Pack32LE(this._key[24], this._key[25], this._key[26], this._key[27]);
      state.TK2[3] = OpCodes.Pack32LE(this._key[28], this._key[29], this._key[30], this._key[31]);
      state.TK3[0] = OpCodes.Pack32LE(this._key[32], this._key[33], this._key[34], this._key[35]);
      state.TK3[1] = OpCodes.Pack32LE(this._key[36], this._key[37], this._key[38], this._key[39]);
      state.TK3[2] = OpCodes.Pack32LE(this._key[40], this._key[41], this._key[42], this._key[43]);
      state.TK3[3] = OpCodes.Pack32LE(this._key[44], this._key[45], this._key[46], this._key[47]);
      state.S[0] = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      state.S[1] = OpCodes.Pack32LE(input[4], input[5], input[6], input[7]);
      state.S[2] = OpCodes.Pack32LE(input[8], input[9], input[10], input[11]);
      state.S[3] = OpCodes.Pack32LE(input[12], input[13], input[14], input[15]);

      const totalRounds = FORKSKINNY_128_384_ROUNDS_BEFORE + FORKSKINNY_128_384_ROUNDS_AFTER * 2;
      forkskinny_128_384_forward_tk(state, totalRounds);

      forkskinny_128_384_inv_rounds(state, totalRounds,
                                    FORKSKINNY_128_384_ROUNDS_BEFORE + FORKSKINNY_128_384_ROUNDS_AFTER);
      state.S[0] ^= BRANCH_CONSTANT[0];
      state.S[1] ^= BRANCH_CONSTANT[1];
      state.S[2] ^= BRANCH_CONSTANT[2];
      state.S[3] ^= BRANCH_CONSTANT[3];

      forkskinny_128_384_inv_rounds(state, FORKSKINNY_128_384_ROUNDS_BEFORE, 0);

      return this.unpackState(state.S);
    }

    unpackState(S) {
      const output = [];
      for (let i = 0; i < 4; i++) {
        const bytes = OpCodes.Unpack32LE(S[i]);
        output.push(...bytes);
      }
      return output;
    }
  }

  // Register algorithms
  RegisterAlgorithm(new ForkSkinny128_256());
  RegisterAlgorithm(new ForkSkinny128_384());

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      ForkSkinny128_256,
      ForkSkinny128_384
    };
  }

})(typeof window !== 'undefined' ? window : global);
