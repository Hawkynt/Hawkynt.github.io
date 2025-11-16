/* PAEF-ForkSkinny Authenticated Encryption
 * Browser + Worker + Node (CJS/AMD-friendly) UMD
 * (c)2006-2025 Hawkynt
 *
 * ForkAE is a family of authenticated encryption algorithms based on ForkSkinny,
 * a modified version of the SKINNY tweakable block cipher. The modification
 * introduces "forking" where each input block produces two output blocks for
 * use in encryption and authentication via parallel processing.
 *
 * This implements PAEF (Parallel AEAD with Forking) mode variants:
 * - PAEF-ForkSkinny-128-192: 128-bit key, 48-bit nonce, 128-bit tag
 *
 * NIST Lightweight Cryptography Competition Candidate
 * Reference: https://www.esat.kuleuven.be/cosic/forkae/
*/

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    factory();
  }
}(
  (function() {
    if (typeof globalThis !== 'undefined') return globalThis;
    if (typeof window !== 'undefined') return window;
    if (typeof global !== 'undefined') return global;
    if (typeof self !== 'undefined') return self;
    return this;
  })(),
  function() {
    'use strict';

    // Load AlgorithmFramework and OpCodes
    var global = (function() {
      if (typeof globalThis !== 'undefined') return globalThis;
      if (typeof window !== 'undefined') return window;
      if (typeof global !== 'undefined') return global;
      if (typeof self !== 'undefined') return self;
      return this;
    })();

    if (!global.AlgorithmFramework && typeof require !== 'undefined') {
      global.AlgorithmFramework = require('../../AlgorithmFramework.js');
    }
    if (!global.OpCodes && typeof require !== 'undefined') {
      global.OpCodes = require('../../OpCodes.js');
    }

    var AlgorithmFramework = global.AlgorithmFramework;
    var OpCodes = global.OpCodes;

    if (!AlgorithmFramework) {
      throw new Error('AlgorithmFramework is required but not loaded');
    }
    if (!OpCodes) {
      throw new Error('OpCodes is required but not loaded');
    }

    var RegisterAlgorithm = AlgorithmFramework.RegisterAlgorithm;
    var CategoryType = AlgorithmFramework.CategoryType;
    var SecurityStatus = AlgorithmFramework.SecurityStatus;
    var ComplexityType = AlgorithmFramework.ComplexityType;
    var CountryCode = AlgorithmFramework.CountryCode;
    var AeadAlgorithm = AlgorithmFramework.AeadAlgorithm;
    var IAeadInstance = AlgorithmFramework.IAeadInstance;
    var TestCase = AlgorithmFramework.TestCase;
    var LinkItem = AlgorithmFramework.LinkItem;
    var KeySize = AlgorithmFramework.KeySize;

    // ==================== SKINNY-128 Helper Functions ====================

    // Round constants for ForkSkinny (87 rounds total)
    var RC = [
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

    // SKINNY-128 S-box (applied to 32-bit words containing 4 bytes)
    function skinny128_sbox(x) {
      var y;

      // Mix the bits
      x = (~x) >>> 0;
      x ^= (((x >>> 2) & (x >>> 3)) & 0x11111111);
      y = (((x << 5) & (x << 1)) & 0x20202020);
      x ^= (((x << 5) & (x << 4)) & 0x40404040) ^ y;
      y = (((x << 2) & (x << 1)) & 0x80808080);
      x ^= (((x >>> 2) & (x << 1)) & 0x02020202) ^ y;
      y = (((x >>> 5) & (x << 1)) & 0x04040404);
      x ^= (((x >>> 1) & (x >>> 2)) & 0x08080808) ^ y;
      x = (~x) >>> 0;

      // Final permutation for each byte: [2 7 6 1 3 0 4 5]
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
      var y;

      // Mix the bits
      x = (~x) >>> 0;
      y = (((x >>> 1) & (x >>> 3)) & 0x01010101);
      x ^= (((x >>> 2) & (x >>> 3)) & 0x10101010) ^ y;
      y = (((x >>> 6) & (x >>> 1)) & 0x02020202);
      x ^= (((x >>> 1) & (x >>> 2)) & 0x08080808) ^ y;
      y = (((x << 2) & (x << 1)) & 0x80808080);
      x ^= (((x >>> 1) & (x << 2)) & 0x04040404) ^ y;
      y = (((x << 5) & (x << 1)) & 0x20202020);
      x ^= (((x << 4) & (x << 5)) & 0x40404040) ^ y;
      x = (~x) >>> 0;

      // Final permutation for each byte: [5 3 0 4 6 7 2 1]
      x = (((x & 0x01010101) << 2) |
           ((x & 0x04040404) << 4) |
           ((x & 0x02020202) << 6) |
           ((x & 0x20202020) >>> 5) |
           ((x & 0xC8C8C8C8) >>> 2) |
           ((x & 0x10101010) >>> 1)) >>> 0;

      return x;
    }

    // LFSR operations for tweakey schedule
    function skinny128_LFSR2(x) {
      return (((x << 1) & 0xFEFEFEFE) ^
              (((x >>> 7) ^ (x >>> 5)) & 0x01010101)) >>> 0;
    }

    function skinny128_LFSR3(x) {
      return (((x >>> 1) & 0x7F7F7F7F) ^
              (((x << 7) ^ (x << 1)) & 0x80808080)) >>> 0;
    }

    function skinny128_inv_LFSR2(x) {
      return skinny128_LFSR3(x);
    }

    function skinny128_inv_LFSR3(x) {
      return skinny128_LFSR2(x);
    }

    // Tweakey permutation PT = [9, 15, 8, 13, 10, 14, 12, 11, 0, 1, 2, 3, 4, 5, 6, 7]
    function skinny128_permute_tk(tk) {
      var row2 = tk[2];
      var row3 = tk[3];
      tk[2] = tk[0];
      tk[3] = tk[1];
      row3 = ((row3 << 16) | (row3 >>> 16)) >>> 0;
      tk[0] = (((row2 >>> 8) & 0x000000FF) |
               ((row2 << 16) & 0x00FF0000) |
               (row3 & 0xFF00FF00)) >>> 0;
      tk[1] = (((row2 >>> 16) & 0x000000FF) |
               (row2 & 0xFF000000) |
               ((row3 << 8) & 0x0000FF00) |
               (row3 & 0x00FF0000)) >>> 0;
    }

    // Inverse tweakey permutation
    function skinny128_inv_permute_tk(tk) {
      var row0 = tk[0];
      var row1 = tk[1];
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

    // Helper for byte rotations in row shifting
    function leftRotate8(value) {
      return OpCodes.RotL32(value, 8);
    }

    function leftRotate16(value) {
      return OpCodes.RotL32(value, 16);
    }

    function leftRotate24(value) {
      return OpCodes.RotL32(value, 24);
    }

    function rightRotate8(value) {
      return OpCodes.RotR32(value, 8);
    }

    function rightRotate16(value) {
      return OpCodes.RotR32(value, 16);
    }

    function rightRotate24(value) {
      return OpCodes.RotR32(value, 24);
    }

    // ==================== ForkSkinny-128-256 Core Functions ====================

    var FORKSKINNY_128_256_ROUNDS_BEFORE = 21;
    var FORKSKINNY_128_256_ROUNDS_AFTER = 27;

    // ForkSkinny state structure
    function ForkSkinny128_256_State() {
      this.S = [0, 0, 0, 0];    // State (4 x 32-bit words)
      this.TK1 = [0, 0, 0, 0];  // Tweakey 1
      this.TK2 = [0, 0, 0, 0];  // Tweakey 2
    }

    // Perform rounds from 'first' to 'last' (exclusive)
    function forkskinny_128_256_rounds(state, first, last) {
      var s0 = state.S[0];
      var s1 = state.S[1];
      var s2 = state.S[2];
      var s3 = state.S[3];
      var temp, rc;

      for (var round = first; round < last; ++round) {
        // Apply S-box to all cells
        s0 = skinny128_sbox(s0);
        s1 = skinny128_sbox(s1);
        s2 = skinny128_sbox(s2);
        s3 = skinny128_sbox(s3);

        // XOR round constant and subkey
        rc = RC[round];
        s0 ^= state.TK1[0] ^ state.TK2[0] ^ (rc & 0x0F) ^ 0x00020000;
        s1 ^= state.TK1[1] ^ state.TK2[1] ^ (rc >>> 4);
        s2 ^= 0x02;
        s0 >>>= 0;
        s1 >>>= 0;

        // Shift rows (rotate cells right in row words)
        s1 = leftRotate8(s1);
        s2 = leftRotate16(s2);
        s3 = leftRotate24(s3);

        // Mix columns
        s1 ^= s2;
        s2 ^= s0;
        temp = (s3 ^ s2) >>> 0;
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

    // Perform inverse rounds from 'first' down to 'last' (exclusive)
    function forkskinny_128_256_inv_rounds(state, first, last) {
      var s0 = state.S[0];
      var s1 = state.S[1];
      var s2 = state.S[2];
      var s3 = state.S[3];
      var temp, rc;

      while (first > last) {
        // Inverse permute tweakey
        state.TK2[0] = skinny128_inv_LFSR2(state.TK2[0]);
        state.TK2[1] = skinny128_inv_LFSR2(state.TK2[1]);
        skinny128_inv_permute_tk(state.TK1);
        skinny128_inv_permute_tk(state.TK2);

        // Inverse mix columns
        temp = s0;
        s0 = s1;
        s1 = s2;
        s2 = s3;
        s3 = (temp ^ s2) >>> 0;
        s2 ^= s0;
        s1 ^= s2;

        // Inverse shift rows
        s1 = rightRotate8(s1);
        s2 = rightRotate16(s2);
        s3 = rightRotate24(s3);

        // XOR round constant and subkey
        --first;
        rc = RC[first];
        s0 ^= state.TK1[0] ^ state.TK2[0] ^ (rc & 0x0F) ^ 0x00020000;
        s1 ^= state.TK1[1] ^ state.TK2[1] ^ (rc >>> 4);
        s2 ^= 0x02;
        s0 >>>= 0;
        s1 >>>= 0;

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

    // Fast-forward tweakey schedule
    function forkskinny_128_256_forward_tk(state, rounds) {
      // Optimization: tweakey permutation repeats every 16 rounds
      while (rounds >= 16) {
        for (var i = 0; i < 8; ++i) {
          state.TK2[0] = skinny128_LFSR2(state.TK2[0]);
          state.TK2[1] = skinny128_LFSR2(state.TK2[1]);
          state.TK2[2] = skinny128_LFSR2(state.TK2[2]);
          state.TK2[3] = skinny128_LFSR2(state.TK2[3]);
        }
        rounds -= 16;
      }

      while (rounds > 0) {
        skinny128_permute_tk(state.TK1);
        skinny128_permute_tk(state.TK2);
        state.TK2[0] = skinny128_LFSR2(state.TK2[0]);
        state.TK2[1] = skinny128_LFSR2(state.TK2[1]);
        --rounds;
      }
    }

    // Reverse tweakey schedule
    function forkskinny_128_256_reverse_tk(state, rounds) {
      // Optimization: tweakey permutation repeats every 16 rounds
      while (rounds >= 16) {
        for (var i = 0; i < 8; ++i) {
          state.TK2[0] = skinny128_inv_LFSR2(state.TK2[0]);
          state.TK2[1] = skinny128_inv_LFSR2(state.TK2[1]);
          state.TK2[2] = skinny128_inv_LFSR2(state.TK2[2]);
          state.TK2[3] = skinny128_inv_LFSR2(state.TK2[3]);
        }
        rounds -= 16;
      }

      while (rounds > 0) {
        state.TK2[0] = skinny128_inv_LFSR2(state.TK2[0]);
        state.TK2[1] = skinny128_inv_LFSR2(state.TK2[1]);
        skinny128_inv_permute_tk(state.TK1);
        skinny128_inv_permute_tk(state.TK2);
        --rounds;
      }
    }

    // ForkSkinny-128-256 encryption (produces two outputs from forking)
    function forkskinny_128_256_encrypt(tweakey, output_left, output_right, input) {
      var state = new ForkSkinny128_256_State();

      // Unpack tweakey (32 bytes) and input (16 bytes) as little-endian
      state.TK1[0] = OpCodes.Pack32LE(tweakey[0], tweakey[1], tweakey[2], tweakey[3]);
      state.TK1[1] = OpCodes.Pack32LE(tweakey[4], tweakey[5], tweakey[6], tweakey[7]);
      state.TK1[2] = OpCodes.Pack32LE(tweakey[8], tweakey[9], tweakey[10], tweakey[11]);
      state.TK1[3] = OpCodes.Pack32LE(tweakey[12], tweakey[13], tweakey[14], tweakey[15]);
      state.TK2[0] = OpCodes.Pack32LE(tweakey[16], tweakey[17], tweakey[18], tweakey[19]);
      state.TK2[1] = OpCodes.Pack32LE(tweakey[20], tweakey[21], tweakey[22], tweakey[23]);
      state.TK2[2] = OpCodes.Pack32LE(tweakey[24], tweakey[25], tweakey[26], tweakey[27]);
      state.TK2[3] = OpCodes.Pack32LE(tweakey[28], tweakey[29], tweakey[30], tweakey[31]);
      state.S[0] = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      state.S[1] = OpCodes.Pack32LE(input[4], input[5], input[6], input[7]);
      state.S[2] = OpCodes.Pack32LE(input[8], input[9], input[10], input[11]);
      state.S[3] = OpCodes.Pack32LE(input[12], input[13], input[14], input[15]);

      // Run rounds before forking point
      forkskinny_128_256_rounds(state, 0, FORKSKINNY_128_256_ROUNDS_BEFORE);

      // Determine which outputs we need
      if (output_left && output_right) {
        // Save state at forking point
        var F = [state.S[0], state.S[1], state.S[2], state.S[3]];

        // Generate right output block
        forkskinny_128_256_rounds(state,
          FORKSKINNY_128_256_ROUNDS_BEFORE,
          FORKSKINNY_128_256_ROUNDS_BEFORE + FORKSKINNY_128_256_ROUNDS_AFTER);

        var bytes = OpCodes.Unpack32LE(state.S[0]);
        output_right[0] = bytes[0]; output_right[1] = bytes[1];
        output_right[2] = bytes[2]; output_right[3] = bytes[3];
        bytes = OpCodes.Unpack32LE(state.S[1]);
        output_right[4] = bytes[0]; output_right[5] = bytes[1];
        output_right[6] = bytes[2]; output_right[7] = bytes[3];
        bytes = OpCodes.Unpack32LE(state.S[2]);
        output_right[8] = bytes[0]; output_right[9] = bytes[1];
        output_right[10] = bytes[2]; output_right[11] = bytes[3];
        bytes = OpCodes.Unpack32LE(state.S[3]);
        output_right[12] = bytes[0]; output_right[13] = bytes[1];
        output_right[14] = bytes[2]; output_right[15] = bytes[3];

        // Restore state at forking point
        state.S[0] = F[0];
        state.S[1] = F[1];
        state.S[2] = F[2];
        state.S[3] = F[3];
      }

      if (output_left) {
        // Generate left output block (apply branching constant first)
        state.S[0] = (state.S[0] ^ 0x08040201) >>> 0;
        state.S[1] = (state.S[1] ^ 0x82412010) >>> 0;
        state.S[2] = (state.S[2] ^ 0x28140a05) >>> 0;
        state.S[3] = (state.S[3] ^ 0x8844a251) >>> 0;

        forkskinny_128_256_rounds(state,
          FORKSKINNY_128_256_ROUNDS_BEFORE + FORKSKINNY_128_256_ROUNDS_AFTER,
          FORKSKINNY_128_256_ROUNDS_BEFORE + FORKSKINNY_128_256_ROUNDS_AFTER * 2);

        var bytes = OpCodes.Unpack32LE(state.S[0]);
        output_left[0] = bytes[0]; output_left[1] = bytes[1];
        output_left[2] = bytes[2]; output_left[3] = bytes[3];
        bytes = OpCodes.Unpack32LE(state.S[1]);
        output_left[4] = bytes[0]; output_left[5] = bytes[1];
        output_left[6] = bytes[2]; output_left[7] = bytes[3];
        bytes = OpCodes.Unpack32LE(state.S[2]);
        output_left[8] = bytes[0]; output_left[9] = bytes[1];
        output_left[10] = bytes[2]; output_left[11] = bytes[3];
        bytes = OpCodes.Unpack32LE(state.S[3]);
        output_left[12] = bytes[0]; output_left[13] = bytes[1];
        output_left[14] = bytes[2]; output_left[15] = bytes[3];
      } else if (!output_left && output_right) {
        // Only need right output
        forkskinny_128_256_rounds(state,
          FORKSKINNY_128_256_ROUNDS_BEFORE,
          FORKSKINNY_128_256_ROUNDS_BEFORE + FORKSKINNY_128_256_ROUNDS_AFTER);

        var bytes = OpCodes.Unpack32LE(state.S[0]);
        output_right[0] = bytes[0]; output_right[1] = bytes[1];
        output_right[2] = bytes[2]; output_right[3] = bytes[3];
        bytes = OpCodes.Unpack32LE(state.S[1]);
        output_right[4] = bytes[0]; output_right[5] = bytes[1];
        output_right[6] = bytes[2]; output_right[7] = bytes[3];
        bytes = OpCodes.Unpack32LE(state.S[2]);
        output_right[8] = bytes[0]; output_right[9] = bytes[1];
        output_right[10] = bytes[2]; output_right[11] = bytes[3];
        bytes = OpCodes.Unpack32LE(state.S[3]);
        output_right[12] = bytes[0]; output_right[13] = bytes[1];
        output_right[14] = bytes[2]; output_right[15] = bytes[3];
      }
    }

    // ForkSkinny-128-256 decryption (inverse fork operation)
    function forkskinny_128_256_decrypt(tweakey, output_left, output_right, input) {
      var state = new ForkSkinny128_256_State();
      var fstate = new ForkSkinny128_256_State();

      // Unpack tweakey and input
      state.TK1[0] = OpCodes.Pack32LE(tweakey[0], tweakey[1], tweakey[2], tweakey[3]);
      state.TK1[1] = OpCodes.Pack32LE(tweakey[4], tweakey[5], tweakey[6], tweakey[7]);
      state.TK1[2] = OpCodes.Pack32LE(tweakey[8], tweakey[9], tweakey[10], tweakey[11]);
      state.TK1[3] = OpCodes.Pack32LE(tweakey[12], tweakey[13], tweakey[14], tweakey[15]);
      state.TK2[0] = OpCodes.Pack32LE(tweakey[16], tweakey[17], tweakey[18], tweakey[19]);
      state.TK2[1] = OpCodes.Pack32LE(tweakey[20], tweakey[21], tweakey[22], tweakey[23]);
      state.TK2[2] = OpCodes.Pack32LE(tweakey[24], tweakey[25], tweakey[26], tweakey[27]);
      state.TK2[3] = OpCodes.Pack32LE(tweakey[28], tweakey[29], tweakey[30], tweakey[31]);
      state.S[0] = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      state.S[1] = OpCodes.Pack32LE(input[4], input[5], input[6], input[7]);
      state.S[2] = OpCodes.Pack32LE(input[8], input[9], input[10], input[11]);
      state.S[3] = OpCodes.Pack32LE(input[12], input[13], input[14], input[15]);

      // Fast-forward tweakey to end of schedule
      forkskinny_128_256_forward_tk(state,
        FORKSKINNY_128_256_ROUNDS_BEFORE + FORKSKINNY_128_256_ROUNDS_AFTER * 2);

      // Perform inverse rounds to get back to forking point
      forkskinny_128_256_inv_rounds(state,
        FORKSKINNY_128_256_ROUNDS_BEFORE + FORKSKINNY_128_256_ROUNDS_AFTER * 2,
        FORKSKINNY_128_256_ROUNDS_BEFORE + FORKSKINNY_128_256_ROUNDS_AFTER);

      // Remove branching constant
      state.S[0] = (state.S[0] ^ 0x08040201) >>> 0;
      state.S[1] = (state.S[1] ^ 0x82412010) >>> 0;
      state.S[2] = (state.S[2] ^ 0x28140a05) >>> 0;
      state.S[3] = (state.S[3] ^ 0x8844a251) >>> 0;

      // Roll tweakey back
      forkskinny_128_256_reverse_tk(state, FORKSKINNY_128_256_ROUNDS_AFTER);

      // Save state at forking point
      fstate.S = state.S.slice();
      fstate.TK1 = state.TK1.slice();
      fstate.TK2 = state.TK2.slice();

      // Generate left output (inverse before rounds)
      forkskinny_128_256_inv_rounds(state, FORKSKINNY_128_256_ROUNDS_BEFORE, 0);
      var bytes = OpCodes.Unpack32LE(state.S[0]);
      output_left[0] = bytes[0]; output_left[1] = bytes[1];
      output_left[2] = bytes[2]; output_left[3] = bytes[3];
      bytes = OpCodes.Unpack32LE(state.S[1]);
      output_left[4] = bytes[0]; output_left[5] = bytes[1];
      output_left[6] = bytes[2]; output_left[7] = bytes[3];
      bytes = OpCodes.Unpack32LE(state.S[2]);
      output_left[8] = bytes[0]; output_left[9] = bytes[1];
      output_left[10] = bytes[2]; output_left[11] = bytes[3];
      bytes = OpCodes.Unpack32LE(state.S[3]);
      output_left[12] = bytes[0]; output_left[13] = bytes[1];
      output_left[14] = bytes[2]; output_left[15] = bytes[3];

      // Generate right output (forward after rounds from fork point)
      forkskinny_128_256_rounds(fstate,
        FORKSKINNY_128_256_ROUNDS_BEFORE,
        FORKSKINNY_128_256_ROUNDS_BEFORE + FORKSKINNY_128_256_ROUNDS_AFTER);
      bytes = OpCodes.Unpack32LE(fstate.S[0]);
      output_right[0] = bytes[0]; output_right[1] = bytes[1];
      output_right[2] = bytes[2]; output_right[3] = bytes[3];
      bytes = OpCodes.Unpack32LE(fstate.S[1]);
      output_right[4] = bytes[0]; output_right[5] = bytes[1];
      output_right[6] = bytes[2]; output_right[7] = bytes[3];
      bytes = OpCodes.Unpack32LE(fstate.S[2]);
      output_right[8] = bytes[0]; output_right[9] = bytes[1];
      output_right[10] = bytes[2]; output_right[11] = bytes[3];
      bytes = OpCodes.Unpack32LE(fstate.S[3]);
      output_right[12] = bytes[0]; output_right[13] = bytes[1];
      output_right[14] = bytes[2]; output_right[15] = bytes[3];
    }

    // ==================== PAEF Mode Implementation ====================

    var BLOCK_SIZE = 16;
    var NONCE_SIZE = 6;
    var COUNTER_SIZE = 2;
    var TWEAKEY_SIZE = 32;
    var TAG_SIZE = 16;

    // Set counter value in tweakey with domain separation
    function paef_set_counter(tweakey, counter, domain) {
      // Counter occupies last COUNTER_SIZE bytes of tweakey
      // Domain (3 bits) is in upper bits of counter field
      var combined = (counter | (domain << (COUNTER_SIZE * 8 - 3))) >>> 0;

      for (var i = 0; i < COUNTER_SIZE; ++i) {
        tweakey[16 + NONCE_SIZE + COUNTER_SIZE - 1 - i] = combined & 0xFF;
        combined >>>= 8;
      }
    }

    // Check if padding is correct (0x80 followed by zeros)
    function paef_is_padding_valid(block, len) {
      if (len === 0) return false;
      if (block[0] !== 0x80) return false;

      for (var i = 1; i < len; ++i) {
        if (block[i] !== 0) return false;
      }
      return true;
    }

    // ==================== PAEF-ForkSkinny-128-192 Algorithm Class ====================

    function PAEFForkSkinny128_192Algorithm() {
      this.name = "PAEF-ForkSkinny-128-192";
      this.description = "Parallel authenticated encryption with forking based on ForkSkinny-128-256 tweakable block cipher. NIST Lightweight Cryptography Competition candidate optimized for small packet sizes with parallel processing capability.";
      this.inventor = "Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.AT;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedNonceSizes = [new KeySize(6, 6, 1)];
      this.TagSize = 16;

      this.documentation = [
        new LinkItem("ForkAE Official Website", "https://www.esat.kuleuven.be/cosic/forkae/"),
        new LinkItem("NIST LWC Submission", "https://csrc.nist.gov/projects/lightweight-cryptography"),
        new LinkItem("ForkSkinny Specification", "https://eprint.iacr.org/2019/1004.pdf")
      ];

      this.tests = [
        // Test vectors from NIST KAT file PAEF-ForkSkinny-128-192.txt
        {
          text: "Empty PT, Empty AD",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("DE2381C2D19A843CFF8C3BAAB8AE9A4C")
        },
        {
          text: "Empty PT, 1-byte AD",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("AABC9CAF30A81191E44E26032D1B073F")
        },
        {
          text: "Empty PT, 2-byte AD",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405"),
          associatedData: OpCodes.Hex8ToBytes("0001"),
          input: [],
          expected: OpCodes.Hex8ToBytes("56E1C0FB050C740B9D1FC539CF38512F")
        },
        {
          text: "Empty PT, 16-byte AD",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405"),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: [],
          expected: OpCodes.Hex8ToBytes("687A101BBBF86F3A98080AFCFA7FD965")
        },
        {
          text: "1-byte PT, Empty AD",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("312E5E7DDE73A0048DD7DE0C66BE4033A2")
        },
        {
          text: "1-byte PT, 1-byte AD",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("9B92C2D2EEDBB1956999F80F4BA5470CA2")
        },
        {
          text: "16-byte PT, Empty AD",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("D10CC6CDA5214AD435F9B231B0BDD1D182E2D5A15505E038AFC39EEFBEA7D84F")
        },
        {
          text: "16-byte PT, 16-byte AD",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405"),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("B976D6D61ED925EEADF1B8CD4AC208B482E2D5A15505E038AFC39EEFBEA7D84F")
        }
      ];
    }

    PAEFForkSkinny128_192Algorithm.prototype = Object.create(AeadAlgorithm.prototype);
    PAEFForkSkinny128_192Algorithm.prototype.constructor = PAEFForkSkinny128_192Algorithm;

    PAEFForkSkinny128_192Algorithm.prototype.CreateInstance = function(isInverse) {
      return new PAEFForkSkinny128_192Instance(this, isInverse);
    };

    // ==================== PAEF-ForkSkinny-128-192 Instance Class ====================

    class PAEFForkSkinny128_192Instance extends IAeadInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this._key = null;
        this._nonce = null;
        this._associatedData = [];
        this.inputBuffer = [];
      }

      // Property: key
      set key(keyBytes) {
        if (!keyBytes) {
          this._key = null;
          return;
        }

        if (keyBytes.length !== 16) {
          throw new Error('Invalid key size: ' + keyBytes.length + ' bytes (expected 16)');
        }

        this._key = Array.from(keyBytes);
      }

      get key() {
        return this._key ? [...this._key] : null;
      }

      // Property: nonce
      set nonce(nonceBytes) {
        if (!nonceBytes) {
          this._nonce = null;
          return;
        }

        if (nonceBytes.length !== 6) {
          throw new Error('Invalid nonce size: ' + nonceBytes.length + ' bytes (expected 6)');
        }

        this._nonce = Array.from(nonceBytes);
      }

      get nonce() {
        return this._nonce ? [...this._nonce] : null;
      }

      // Property: associatedData
      set associatedData(adBytes) {
        if (!adBytes || adBytes.length === 0) {
          this._associatedData = [];
          return;
        }

        this._associatedData = Array.from(adBytes);
      }

      get associatedData() {
        return [...this._associatedData];
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
      }

      Result() {
        if (!this._key) throw new Error("Key not set");
        if (!this._nonce) throw new Error("Nonce not set");

        const inputData = this.inputBuffer;
        this.inputBuffer = [];

        let output;

        if (this.isInverse) {
          output = this._decrypt(inputData, this._associatedData, this._nonce, this._key);
        } else {
          output = this._encrypt(inputData, this._associatedData, this._nonce, this._key);
        }

        // Clear state
        this._associatedData = [];

        return output;
      }

      // PAEF encryption implementation
      _encrypt(m, ad, npub, k) {
      var mlen = m.length;
      var adlen = ad.length;
      var tweakey = [];
      var tag = [];
      var block = [];
      var counter;

      // Check data limits (2^17 bytes = 128KB for PAEF-128-192)
      var dataLimit = (1 << 17);
      if (adlen > dataLimit || mlen > dataLimit) {
        throw new Error("Data length exceeds PAEF-ForkSkinny-128-192 limit");
      }

      // Format initial tweakey: key (16) || nonce (6) || counter (2) || padding (8)
      for (var i = 0; i < 16; ++i) {
        tweakey[i] = k[i];
      }
      for (var i = 0; i < NONCE_SIZE; ++i) {
        tweakey[16 + i] = npub[i];
      }
      for (var i = 16 + NONCE_SIZE; i < TWEAKEY_SIZE; ++i) {
        tweakey[i] = 0;
      }

      // Initialize tag to zeros
      for (var i = 0; i < BLOCK_SIZE; ++i) {
        tag[i] = 0;
      }

      // Process associated data
      counter = 1;
      var adPos = 0;

      while (adlen > BLOCK_SIZE) {
        paef_set_counter(tweakey, counter, 0); // domain 0 = full AD block
        forkskinny_128_256_encrypt(tweakey, null, block, ad.slice(adPos, adPos + BLOCK_SIZE));
        tag = OpCodes.XorArrays(tag, block);
        adPos += BLOCK_SIZE;
        adlen -= BLOCK_SIZE;
        ++counter;
      }

      if (adlen === BLOCK_SIZE) {
        paef_set_counter(tweakey, counter, 1); // domain 1 = last full AD block
        forkskinny_128_256_encrypt(tweakey, null, block, ad.slice(adPos, adPos + BLOCK_SIZE));
        tag = OpCodes.XorArrays(tag, block);
      } else if (adlen !== 0 || mlen === 0) {
        // Padded AD block or empty message
        for (var i = 0; i < adlen; ++i) {
          block[i] = ad[adPos + i];
        }
        block[adlen] = 0x80;
        for (var i = adlen + 1; i < BLOCK_SIZE; ++i) {
          block[i] = 0;
        }
        paef_set_counter(tweakey, counter, 3); // domain 3 = padded AD block
        forkskinny_128_256_encrypt(tweakey, null, block, block);
        tag = OpCodes.XorArrays(tag, block);
      }

      // If no message, return tag only
      if (mlen === 0) {
        return tag;
      }

      // Encrypt plaintext blocks
      var c = [];
      var mPos = 0;
      counter = 1;

      while (mlen > BLOCK_SIZE) {
        paef_set_counter(tweakey, counter, 4); // domain 4 = full PT block
        var cipherBlock = new Array(BLOCK_SIZE);
        forkskinny_128_256_encrypt(tweakey, cipherBlock, block, m.slice(mPos, mPos + BLOCK_SIZE));
        tag = OpCodes.XorArrays(tag, block);
        c.push.apply(c, cipherBlock);
        mPos += BLOCK_SIZE;
        mlen -= BLOCK_SIZE;
        ++counter;
      }

      // Process last plaintext block
      if (mlen === BLOCK_SIZE) {
        paef_set_counter(tweakey, counter, 5); // domain 5 = last full PT block
        var cipherBlock = new Array(BLOCK_SIZE);
        var authBlock = new Array(BLOCK_SIZE);
        forkskinny_128_256_encrypt(tweakey, cipherBlock, authBlock, m.slice(mPos, mPos + BLOCK_SIZE));

        // XOR accumulated tag with ciphertext for final block
        for (var i = 0; i < BLOCK_SIZE; ++i) {
          cipherBlock[i] = (cipherBlock[i] ^ tag[i]) & 0xFF;
        }
        c.push.apply(c, cipherBlock);
        c.push.apply(c, authBlock); // Append authentication tag from right output
      } else {
        // Partial last block
        var paddedBlock = new Array(BLOCK_SIZE);
        for (var i = 0; i < mlen; ++i) {
          paddedBlock[i] = m[mPos + i];
        }
        paddedBlock[mlen] = 0x80;
        for (var i = mlen + 1; i < BLOCK_SIZE; ++i) {
          paddedBlock[i] = 0;
        }

        paef_set_counter(tweakey, counter, 7); // domain 7 = padded PT block
        var cipherBlock = new Array(BLOCK_SIZE);
        var authBlock = new Array(BLOCK_SIZE);
        forkskinny_128_256_encrypt(tweakey, cipherBlock, authBlock, paddedBlock);

        // XOR accumulated tag with ciphertext
        for (var i = 0; i < BLOCK_SIZE; ++i) {
          cipherBlock[i] = (cipherBlock[i] ^ tag[i]) & 0xFF;
        }
        c.push.apply(c, cipherBlock);

        // Append only mlen bytes of authentication tag from right output
        for (var i = 0; i < mlen; ++i) {
          c.push(authBlock[i]);
        }
      }

      return c;
      }

      // PAEF decryption implementation
      _decrypt(c, ad, npub, k) {
      var clen = c.length;
      var adlen = ad.length;

      // Validate ciphertext length
      if (clen < BLOCK_SIZE) {
        throw new Error("Invalid ciphertext length");
      }

      clen -= BLOCK_SIZE;
      var tweakey = new Array(TWEAKEY_SIZE);
      var tag = new Array(BLOCK_SIZE);
      var block = new Array(BLOCK_SIZE);
      var counter;

      // Check data limits
      var dataLimit = (1 << 17);
      if (adlen > dataLimit || clen > dataLimit) {
        throw new Error("Data length exceeds PAEF-ForkSkinny-128-192 limit");
      }

      // Format initial tweakey
      for (var i = 0; i < 16; ++i) {
        tweakey[i] = k[i];
      }
      for (var i = 0; i < NONCE_SIZE; ++i) {
        tweakey[16 + i] = npub[i];
      }
      for (var i = 16 + NONCE_SIZE; i < TWEAKEY_SIZE; ++i) {
        tweakey[i] = 0;
      }

      // Initialize tag
      for (var i = 0; i < BLOCK_SIZE; ++i) {
        tag[i] = 0;
      }

      // Process associated data (same as encryption)
      counter = 1;
      var adPos = 0;
      var adlenRemaining = adlen;

      while (adlenRemaining > BLOCK_SIZE) {
        paef_set_counter(tweakey, counter, 0);
        forkskinny_128_256_encrypt(tweakey, null, block, ad.slice(adPos, adPos + BLOCK_SIZE));
        tag = OpCodes.XorArrays(tag, block);
        adPos += BLOCK_SIZE;
        adlenRemaining -= BLOCK_SIZE;
        ++counter;
      }

      if (adlenRemaining === BLOCK_SIZE) {
        paef_set_counter(tweakey, counter, 1);
        forkskinny_128_256_encrypt(tweakey, null, block, ad.slice(adPos, adPos + BLOCK_SIZE));
        tag = OpCodes.XorArrays(tag, block);
      } else if (adlenRemaining !== 0 || clen === 0) {
        for (var i = 0; i < adlenRemaining; ++i) {
          block[i] = ad[adPos + i];
        }
        block[adlenRemaining] = 0x80;
        for (var i = adlenRemaining + 1; i < BLOCK_SIZE; ++i) {
          block[i] = 0;
        }
        paef_set_counter(tweakey, counter, 3);
        forkskinny_128_256_encrypt(tweakey, null, block, block);
        tag = OpCodes.XorArrays(tag, block);
      }

      // If no ciphertext payload, verify tag
      if (clen === 0) {
        var valid = OpCodes.ConstantTimeCompare(tag, c.slice(0, BLOCK_SIZE));
        if (!valid) {
          throw new Error("Authentication tag verification failed");
        }
        return [];
      }

      // Decrypt ciphertext blocks
      var m = [];
      var cPos = 0;
      counter = 1;
      var clenRemaining = clen;

      while (clenRemaining > BLOCK_SIZE) {
        paef_set_counter(tweakey, counter, 4);
        var plainBlock = new Array(BLOCK_SIZE);
        var dummyLeft = new Array(BLOCK_SIZE);
        forkskinny_128_256_decrypt(tweakey, plainBlock, block, c.slice(cPos, cPos + BLOCK_SIZE));
        tag = OpCodes.XorArrays(tag, block);
        m.push.apply(m, plainBlock);
        cPos += BLOCK_SIZE;
        clenRemaining -= BLOCK_SIZE;
        ++counter;
      }

      // Process last ciphertext block
      if (clenRemaining === BLOCK_SIZE) {
        paef_set_counter(tweakey, counter, 5);

        // XOR tag with ciphertext first
        var temp = new Array(BLOCK_SIZE);
        for (var i = 0; i < BLOCK_SIZE; ++i) {
          temp[i] = (c[cPos + i] ^ tag[i]) & 0xFF;
        }

        var plainBlock = new Array(BLOCK_SIZE);
        forkskinny_128_256_decrypt(tweakey, plainBlock, block, temp);

        // Verify tag
        var receivedTag = c.slice(cPos + BLOCK_SIZE, cPos + BLOCK_SIZE + BLOCK_SIZE);
        var valid = OpCodes.ConstantTimeCompare(block, receivedTag);
        if (!valid) {
          throw new Error("Authentication tag verification failed");
        }

        m.push.apply(m, plainBlock);
      } else {
        // Partial last block
        var temp = new Array(BLOCK_SIZE);
        for (var i = 0; i < BLOCK_SIZE; ++i) {
          temp[i] = (c[cPos + i] ^ tag[i]) & 0xFF;
        }

        paef_set_counter(tweakey, counter, 7);
        var block2 = new Array(BLOCK_SIZE);
        var dummyLeft = new Array(BLOCK_SIZE);
        forkskinny_128_256_decrypt(tweakey, block2, block, temp);

        // Validate padding
        if (!paef_is_padding_valid(block2.slice(clenRemaining), BLOCK_SIZE - clenRemaining)) {
          throw new Error("Invalid padding");
        }

        // Verify tag
        var receivedTag = c.slice(cPos + BLOCK_SIZE, cPos + BLOCK_SIZE + clenRemaining);
        var valid = OpCodes.ConstantTimeCompare(block.slice(0, clenRemaining), receivedTag);
        if (!valid) {
          throw new Error("Authentication tag verification failed");
        }

        for (var i = 0; i < clenRemaining; ++i) {
          m.push(block2[i]);
        }
      }

      return m;
      }
    }

    // Register the algorithm
    RegisterAlgorithm(new PAEFForkSkinny128_192Algorithm());

    return {
      PAEFForkSkinny128_192Algorithm: PAEFForkSkinny128_192Algorithm,
      PAEFForkSkinny128_192Instance: PAEFForkSkinny128_192Instance
    };
  }
));
