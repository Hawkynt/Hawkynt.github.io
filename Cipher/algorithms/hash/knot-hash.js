/*
 * KNOT-HASH Family - NIST Lightweight Cryptography Finalist
 * Professional implementation following reference specification
 * (c)2006-2025 Hawkynt
 *
 * KNOT is a family of lightweight authenticated encryption and hash algorithms
 * based on bit-slice PRESENT-like permutations. This file implements all 4 hash variants:
 * - KNOT-HASH-256-256: KNOT-256 permutation (4×64-bit), 256-bit output
 * - KNOT-HASH-256-384: KNOT-384 permutation (4×96-bit), 256-bit output
 * - KNOT-HASH-384-384: KNOT-384 permutation (4×96-bit), 384-bit output
 * - KNOT-HASH-512-512: KNOT-512 permutation (8×64-bit), 512-bit output
 *
 * Reference: https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/knot-spec-final.pdf
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

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem } = AlgorithmFramework;

  // ===== ROUND CONSTANTS =====

  // Round constants for 7-bit variant (used by KNOT-256 and KNOT-384)
  const RC7 = [
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x41, 0x03, 0x06, 0x0c, 0x18, 0x30,
    0x61, 0x42, 0x05, 0x0a, 0x14, 0x28, 0x51, 0x23, 0x47, 0x0f, 0x1e, 0x3c,
    0x79, 0x72, 0x64, 0x48, 0x11, 0x22, 0x45, 0x0b, 0x16, 0x2c, 0x59, 0x33,
    0x67, 0x4e, 0x1d, 0x3a, 0x75, 0x6a, 0x54, 0x29, 0x53, 0x27, 0x4f, 0x1f,
    0x3e, 0x7d, 0x7a, 0x74, 0x68, 0x50, 0x21, 0x43, 0x07, 0x0e, 0x1c, 0x38,
    0x71, 0x62, 0x44, 0x09, 0x12, 0x24, 0x49, 0x13, 0x26, 0x4d, 0x1b, 0x36,
    0x6d, 0x5a, 0x35, 0x6b, 0x56, 0x2d, 0x5b, 0x37, 0x6f, 0x5e, 0x3d, 0x7b,
    0x76, 0x6c, 0x58, 0x31, 0x63, 0x46, 0x0d, 0x1a, 0x34, 0x69, 0x52, 0x25,
    0x4b, 0x17, 0x2e, 0x5d, 0x3b, 0x77, 0x6e, 0x5c
  ];

  // Round constants for 8-bit variant (used by KNOT-512)
  const RC8 = [
    0x01, 0x02, 0x04, 0x08, 0x11, 0x23, 0x47, 0x8e, 0x1c, 0x38, 0x71, 0xe2,
    0xc4, 0x89, 0x12, 0x25, 0x4b, 0x97, 0x2e, 0x5c, 0xb8, 0x70, 0xe0, 0xc0,
    0x81, 0x03, 0x06, 0x0c, 0x19, 0x32, 0x64, 0xc9, 0x92, 0x24, 0x49, 0x93,
    0x26, 0x4d, 0x9b, 0x37, 0x6e, 0xdc, 0xb9, 0x72, 0xe4, 0xc8, 0x90, 0x20,
    0x41, 0x82, 0x05, 0x0a, 0x15, 0x2b, 0x56, 0xad, 0x5b, 0xb6, 0x6d, 0xda,
    0xb5, 0x6b, 0xd6, 0xac, 0x59, 0xb2, 0x65, 0xcb, 0x96, 0x2c, 0x58, 0xb0,
    0x61, 0xc3, 0x87, 0x0f, 0x1f, 0x3e, 0x7d, 0xfb, 0xf6, 0xed, 0xdb, 0xb7,
    0x6f, 0xde, 0xbd, 0x7a, 0xf5, 0xeb, 0xd7, 0xae, 0x5d, 0xba, 0x74, 0xe8,
    0xd1, 0xa2, 0x44, 0x88, 0x10, 0x21, 0x43, 0x86, 0x0d, 0x1b, 0x36, 0x6c,
    0xd8, 0xb1, 0x63, 0xc7, 0x8f, 0x1e, 0x3c, 0x79, 0xf3, 0xe7, 0xce, 0x9c,
    0x39, 0x73, 0xe6, 0xcc, 0x98, 0x31, 0x62, 0xc5, 0x8b, 0x16, 0x2d, 0x5a,
    0xb4, 0x69, 0xd2, 0xa4, 0x48, 0x91, 0x22, 0x45
  ];

  // ===== KNOT-256 PERMUTATION (4 × 64-bit words) =====

  /**
   * 64-bit rotation helper using pairs of 32-bit words [low, high]
   * @param {uint32} low - Low 32 bits
   * @param {uint32} high - High 32 bits
   * @param {number} positions - Rotation amount
   * @returns {uint32[]} Rotated [low, high] pair
   */
  function rotl64(low, high, positions) {
    positions %= 64;
    if (positions === 0) return [low, high];
    if (positions === 32) return [high, low];

    if (positions < 32) {
      return [
        ((low << positions) | (high >>> (32 - positions))) >>> 0,
        ((high << positions) | (low >>> (32 - positions))) >>> 0
      ];
    }

    positions -= 32;
    return [
      ((high << positions) | (low >>> (32 - positions))) >>> 0,
      ((low << positions) | (high >>> (32 - positions))) >>> 0
    ];
  }

  /**
   * KNOT S-box applied to four 64-bit words in bit-sliced mode
   * @param {uint32[]} a0 - First word as [low, high]
   * @param {uint32[]} a1 - Second word as [low, high]
   * @param {uint32[]} a2 - Third word as [low, high]
   * @param {uint32[]} a3 - Fourth word as [low, high]
   * @returns {uint32[][]} Array of [a0_new, b1, b2, b3]
   */
  function knotSbox64Array(a0, a1, a2, a3) {
    var t1_l = (~a0[0]) >>> 0;
    var t1_h = (~a0[1]) >>> 0;

    var t3_l = (a2[0] ^ (a1[0] & t1_l)) >>> 0;
    var t3_h = (a2[1] ^ (a1[1] & t1_h)) >>> 0;

    var b3_l = (a3[0] ^ t3_l) >>> 0;
    var b3_h = (a3[1] ^ t3_h) >>> 0;

    var t6_l = (a3[0] ^ t1_l) >>> 0;
    var t6_h = (a3[1] ^ t1_h) >>> 0;

    var b2_l = ((a1[0] | a2[0]) ^ t6_l) >>> 0;
    var b2_h = ((a1[1] | a2[1]) ^ t6_h) >>> 0;

    t1_l = (a1[0] ^ a3[0]) >>> 0;
    t1_h = (a1[1] ^ a3[1]) >>> 0;

    var a0_l = (t1_l ^ (t3_l & t6_l)) >>> 0;
    var a0_h = (t1_h ^ (t3_h & t6_h)) >>> 0;

    var b1_l = (t3_l ^ (b2_l & t1_l)) >>> 0;
    var b1_h = (t3_h ^ (b2_h & t1_h)) >>> 0;

    return [
      [a0_l, a0_h],
      [b1_l, b1_h],
      [b2_l, b2_h],
      [b3_l, b3_h]
    ];
  }

  /**
   * KNOT-256 permutation with 7-bit round constants
   * State is 4 × 64-bit words stored as byte array (little-endian)
   * @param {uint8[]} stateBytes - 32-byte state array
   * @param {number} rounds - Number of rounds to perform
   */
  function knot256Permute(stateBytes, rounds) {
    // Load state as four 64-bit words (little-endian)
    var x0 = [
      OpCodes.Pack32LE(stateBytes[0], stateBytes[1], stateBytes[2], stateBytes[3]),
      OpCodes.Pack32LE(stateBytes[4], stateBytes[5], stateBytes[6], stateBytes[7])
    ];
    var x1 = [
      OpCodes.Pack32LE(stateBytes[8], stateBytes[9], stateBytes[10], stateBytes[11]),
      OpCodes.Pack32LE(stateBytes[12], stateBytes[13], stateBytes[14], stateBytes[15])
    ];
    var x2 = [
      OpCodes.Pack32LE(stateBytes[16], stateBytes[17], stateBytes[18], stateBytes[19]),
      OpCodes.Pack32LE(stateBytes[20], stateBytes[21], stateBytes[22], stateBytes[23])
    ];
    var x3 = [
      OpCodes.Pack32LE(stateBytes[24], stateBytes[25], stateBytes[26], stateBytes[27]),
      OpCodes.Pack32LE(stateBytes[28], stateBytes[29], stateBytes[30], stateBytes[31])
    ];

    // Perform permutation rounds
    for (var r = 0; r < rounds; r++) {
      // Add round constant to first word
      x0[0] = (x0[0] ^ RC7[r]) >>> 0;

      // Apply S-box
      var sboxResult = knotSbox64Array(x0, x1, x2, x3);
      x0 = sboxResult[0];
      var b1 = sboxResult[1];
      var b2 = sboxResult[2];
      var b3 = sboxResult[3];

      // Linear diffusion layer with rotations
      x1 = rotl64(b1[0], b1[1], 1);   // rotate left by 1
      x2 = rotl64(b2[0], b2[1], 8);   // rotate left by 8
      x3 = rotl64(b3[0], b3[1], 25);  // rotate left by 25
    }

    // Store state back to bytes (little-endian)
    var unpacked = OpCodes.Unpack32LE(x0[0]);
    stateBytes[0] = unpacked[0]; stateBytes[1] = unpacked[1];
    stateBytes[2] = unpacked[2]; stateBytes[3] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x0[1]);
    stateBytes[4] = unpacked[0]; stateBytes[5] = unpacked[1];
    stateBytes[6] = unpacked[2]; stateBytes[7] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x1[0]);
    stateBytes[8] = unpacked[0]; stateBytes[9] = unpacked[1];
    stateBytes[10] = unpacked[2]; stateBytes[11] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x1[1]);
    stateBytes[12] = unpacked[0]; stateBytes[13] = unpacked[1];
    stateBytes[14] = unpacked[2]; stateBytes[15] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x2[0]);
    stateBytes[16] = unpacked[0]; stateBytes[17] = unpacked[1];
    stateBytes[18] = unpacked[2]; stateBytes[19] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x2[1]);
    stateBytes[20] = unpacked[0]; stateBytes[21] = unpacked[1];
    stateBytes[22] = unpacked[2]; stateBytes[23] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x3[0]);
    stateBytes[24] = unpacked[0]; stateBytes[25] = unpacked[1];
    stateBytes[26] = unpacked[2]; stateBytes[27] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x3[1]);
    stateBytes[28] = unpacked[0]; stateBytes[29] = unpacked[1];
    stateBytes[30] = unpacked[2]; stateBytes[31] = unpacked[3];
  }

  // ===== KNOT-384 PERMUTATION (4 × 96-bit words) =====

  /**
   * KNOT S-box applied to four 32-bit words in bit-sliced mode
   * @param {uint32} a0 - First word
   * @param {uint32} a1 - Second word
   * @param {uint32} a2 - Third word
   * @param {uint32} a3 - Fourth word
   * @returns {uint32[]} Array [a0_new, b1, b2, b3]
   */
  function knotSbox32(a0, a1, a2, a3) {
    var t1 = (~a0) >>> 0;
    var t3 = (a2 ^ (a1 & t1)) >>> 0;
    var b3 = (a3 ^ t3) >>> 0;
    var t6 = (a3 ^ t1) >>> 0;
    var b2 = ((a1 | a2) ^ t6) >>> 0;
    t1 = (a1 ^ a3) >>> 0;
    var a0_new = (t1 ^ (t3 & t6)) >>> 0;
    var b1 = (t3 ^ (b2 & t1)) >>> 0;

    return [a0_new, b1, b2, b3];
  }

  /**
   * 96-bit rotation (short version for 1 and 8 bit rotations)
   * @param {uint32} low64_l - Low 32 bits of 64-bit part
   * @param {uint32} low64_h - High 32 bits of 64-bit part
   * @param {uint32} high32 - 32-bit part
   * @param {number} bits - Rotation amount
   * @returns {uint32[]} [a0_low, a0_high, a1]
   */
  function rotl96Short(low64_l, low64_h, high32, bits) {
    var b0_shift_low, b0_shift_high;
    if (bits === 0) {
      b0_shift_low = low64_l;
      b0_shift_high = low64_h;
    } else if (bits < 32) {
      b0_shift_low = (low64_l << bits) >>> 0;
      b0_shift_high = ((low64_h << bits) | (low64_l >>> (32 - bits))) >>> 0;
    } else {
      b0_shift_low = 0;
      b0_shift_high = (low64_l << (bits - 32)) >>> 0;
    }

    var b1_shift = (high32 >>> (32 - bits)) >>> 0;
    var a0_low = (b0_shift_low | b1_shift) >>> 0;
    var a0_high = b0_shift_high;

    var a1_from_b1 = (high32 << bits) >>> 0;
    var shift_right = 64 - bits;
    var a1_from_b0;
    if (shift_right >= 32) {
      a1_from_b0 = (low64_h >>> (shift_right - 32)) >>> 0;
    } else {
      a1_from_b0 = ((low64_h >>> shift_right) | (low64_l << (32 - shift_right))) >>> 0;
    }

    var a1 = (a1_from_b1 | a1_from_b0) >>> 0;

    return [a0_low, a0_high, a1];
  }

  /**
   * 96-bit rotation (long version for 55 bit rotation)
   * @param {uint32} low64_l - Low 32 bits of 64-bit part
   * @param {uint32} low64_h - High 32 bits of 64-bit part
   * @param {uint32} high32 - 32-bit part
   * @param {number} bits - Rotation amount
   * @returns {uint32[]} [a0_low, a0_high, a1]
   */
  function rotl96Long(low64_l, low64_h, high32, bits) {
    var shift1 = bits;
    var shift2 = bits - 32;
    var shift3 = 96 - bits;

    var p1_low = 0;
    var p1_high = (low64_l << shift2) >>> 0;

    var p2_low = (high32 << shift2) >>> 0;
    var p2_high = (high32 >>> (32 - shift2)) >>> 0;

    var p3_low = (low64_h >>> (shift3 - 32)) >>> 0;
    var p3_high = 0;

    var a0_low = (p1_low | p2_low | p3_low) >>> 0;
    var a0_high = (p1_high | p2_high | p3_high) >>> 0;

    var a1 = ((low64_h << shift2) | (low64_l >>> (32 - shift2))) >>> 0;

    return [a0_low, a0_high, a1];
  }

  /**
   * KNOT-384 permutation with 7-bit round constants
   * State is 4 × 96-bit words stored as byte array (little-endian)
   * @param {uint8[]} stateBytes - 48-byte state array
   * @param {number} rounds - Number of rounds to perform
   */
  function knot384Permute(stateBytes, rounds) {
    // Load state matching C reference implementation
    var x0_l = OpCodes.Pack32LE(stateBytes[0], stateBytes[1], stateBytes[2], stateBytes[3]);
    var x0_h = OpCodes.Pack32LE(stateBytes[4], stateBytes[5], stateBytes[6], stateBytes[7]);
    var x1 = OpCodes.Pack32LE(stateBytes[8], stateBytes[9], stateBytes[10], stateBytes[11]);

    var x2_l = OpCodes.Pack32LE(stateBytes[12], stateBytes[13], stateBytes[14], stateBytes[15]);
    var x2_h = OpCodes.Pack32LE(stateBytes[16], stateBytes[17], stateBytes[18], stateBytes[19]);
    var x3 = OpCodes.Pack32LE(stateBytes[20], stateBytes[21], stateBytes[22], stateBytes[23]);

    var x4_l = OpCodes.Pack32LE(stateBytes[24], stateBytes[25], stateBytes[26], stateBytes[27]);
    var x4_h = OpCodes.Pack32LE(stateBytes[28], stateBytes[29], stateBytes[30], stateBytes[31]);
    var x5 = OpCodes.Pack32LE(stateBytes[32], stateBytes[33], stateBytes[34], stateBytes[35]);

    var x6_l = OpCodes.Pack32LE(stateBytes[36], stateBytes[37], stateBytes[38], stateBytes[39]);
    var x6_h = OpCodes.Pack32LE(stateBytes[40], stateBytes[41], stateBytes[42], stateBytes[43]);
    var x7 = OpCodes.Pack32LE(stateBytes[44], stateBytes[45], stateBytes[46], stateBytes[47]);

    // Perform permutation rounds
    for (var r = 0; r < rounds; r++) {
      // Add round constant to first 64-bit word
      x0_l = (x0_l ^ RC7[r]) >>> 0;

      // Apply S-box to 64-bit parts
      var sboxResult64 = knotSbox64Array([x0_l, x0_h], [x2_l, x2_h], [x4_l, x4_h], [x6_l, x6_h]);
      var new_x0 = sboxResult64[0];
      var b2 = sboxResult64[1];
      var b4 = sboxResult64[2];
      var b6 = sboxResult64[3];

      x0_l = new_x0[0];
      x0_h = new_x0[1];

      // Apply S-box to 32-bit parts
      var sboxResult32 = knotSbox32(x1, x3, x5, x7);
      x1 = sboxResult32[0];
      var b3 = sboxResult32[1];
      var b5 = sboxResult32[2];
      var b7 = sboxResult32[3];

      // Linear diffusion layer with 96-bit rotations
      var rot1 = rotl96Short(b2[0], b2[1], b3, 1);
      x2_l = rot1[0];
      x2_h = rot1[1];
      x3 = rot1[2];

      var rot8 = rotl96Short(b4[0], b4[1], b5, 8);
      x4_l = rot8[0];
      x4_h = rot8[1];
      x5 = rot8[2];

      var rot55 = rotl96Long(b6[0], b6[1], b7, 55);
      x6_l = rot55[0];
      x6_h = rot55[1];
      x7 = rot55[2];
    }

    // Store state back to bytes (little-endian)
    var unpacked = OpCodes.Unpack32LE(x0_l);
    stateBytes[0] = unpacked[0]; stateBytes[1] = unpacked[1];
    stateBytes[2] = unpacked[2]; stateBytes[3] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x0_h);
    stateBytes[4] = unpacked[0]; stateBytes[5] = unpacked[1];
    stateBytes[6] = unpacked[2]; stateBytes[7] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x1);
    stateBytes[8] = unpacked[0]; stateBytes[9] = unpacked[1];
    stateBytes[10] = unpacked[2]; stateBytes[11] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x2_l);
    stateBytes[12] = unpacked[0]; stateBytes[13] = unpacked[1];
    stateBytes[14] = unpacked[2]; stateBytes[15] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x2_h);
    stateBytes[16] = unpacked[0]; stateBytes[17] = unpacked[1];
    stateBytes[18] = unpacked[2]; stateBytes[19] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x3);
    stateBytes[20] = unpacked[0]; stateBytes[21] = unpacked[1];
    stateBytes[22] = unpacked[2]; stateBytes[23] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x4_l);
    stateBytes[24] = unpacked[0]; stateBytes[25] = unpacked[1];
    stateBytes[26] = unpacked[2]; stateBytes[27] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x4_h);
    stateBytes[28] = unpacked[0]; stateBytes[29] = unpacked[1];
    stateBytes[30] = unpacked[2]; stateBytes[31] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x5);
    stateBytes[32] = unpacked[0]; stateBytes[33] = unpacked[1];
    stateBytes[34] = unpacked[2]; stateBytes[35] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x6_l);
    stateBytes[36] = unpacked[0]; stateBytes[37] = unpacked[1];
    stateBytes[38] = unpacked[2]; stateBytes[39] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x6_h);
    stateBytes[40] = unpacked[0]; stateBytes[41] = unpacked[1];
    stateBytes[42] = unpacked[2]; stateBytes[43] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x7);
    stateBytes[44] = unpacked[0]; stateBytes[45] = unpacked[1];
    stateBytes[46] = unpacked[2]; stateBytes[47] = unpacked[3];
  }

  // ===== KNOT-512 PERMUTATION (8 × 64-bit words) =====

  /**
   * 128-bit rotation helper
   * @param {uint32} b0_l - Low 32 bits of first 64-bit word
   * @param {uint32} b0_h - High 32 bits of first 64-bit word
   * @param {uint32} b1_l - Low 32 bits of second 64-bit word
   * @param {uint32} b1_h - High 32 bits of second 64-bit word
   * @param {number} bits - Rotation amount
   * @returns {uint32[]} [a0_low32, a0_high32, a1_low32, a1_high32]
   */
  function rotl128(b0_l, b0_h, b1_l, b1_h, bits) {
    if (bits === 0) {
      return [b0_l, b0_h, b1_l, b1_h];
    }

    function shift64L(low, high, bits) {
      if (bits === 0) return [low, high];
      if (bits >= 32) {
        return [0, (low << (bits - 32)) >>> 0];
      }
      return [
        (low << bits) >>> 0,
        ((high << bits) | (low >>> (32 - bits))) >>> 0
      ];
    }

    function shift64R(low, high, bits) {
      if (bits === 0) return [low, high];
      if (bits >= 32) {
        return [((high >>> (bits - 32)) | 0) >>> 0, 0];
      }
      return [
        ((low >>> bits) | (high << (32 - bits))) >>> 0,
        (high >>> bits) >>> 0
      ];
    }

    var b0_shifted = shift64L(b0_l, b0_h, bits);
    var b1_shifted_r = shift64R(b1_l, b1_h, 64 - bits);
    var a0_l = (b0_shifted[0] | b1_shifted_r[0]) >>> 0;
    var a0_h = (b0_shifted[1] | b1_shifted_r[1]) >>> 0;

    var b1_shifted = shift64L(b1_l, b1_h, bits);
    var b0_shifted_r = shift64R(b0_l, b0_h, 64 - bits);
    var a1_l = (b1_shifted[0] | b0_shifted_r[0]) >>> 0;
    var a1_h = (b1_shifted[1] | b0_shifted_r[1]) >>> 0;

    return [a0_l, a0_h, a1_l, a1_h];
  }

  /**
   * KNOT S-box for KNOT-512 (flat parameter version)
   * @param {uint32} a0_l - First word low 32 bits
   * @param {uint32} a0_h - First word high 32 bits
   * @param {uint32} a1_l - Second word low 32 bits
   * @param {uint32} a1_h - Second word high 32 bits
   * @param {uint32} a2_l - Third word low 32 bits
   * @param {uint32} a2_h - Third word high 32 bits
   * @param {uint32} a3_l - Fourth word low 32 bits
   * @param {uint32} a3_h - Fourth word high 32 bits
   * @returns {uint32[]} Flat array of 8 values
   */
  function knotSbox64Flat(a0_l, a0_h, a1_l, a1_h, a2_l, a2_h, a3_l, a3_h) {
    var t1_l = (~a0_l) >>> 0;
    var t1_h = (~a0_h) >>> 0;

    var t3_l = (a2_l ^ (a1_l & t1_l)) >>> 0;
    var t3_h = (a2_h ^ (a1_h & t1_h)) >>> 0;

    var b3_l = (a3_l ^ t3_l) >>> 0;
    var b3_h = (a3_h ^ t3_h) >>> 0;

    var t6_l = (a3_l ^ t1_l) >>> 0;
    var t6_h = (a3_h ^ t1_h) >>> 0;

    var b2_l = ((a1_l | a2_l) ^ t6_l) >>> 0;
    var b2_h = ((a1_h | a2_h) ^ t6_h) >>> 0;

    t1_l = (a1_l ^ a3_l) >>> 0;
    t1_h = (a1_h ^ a3_h) >>> 0;

    var a0_new_l = (t1_l ^ (t3_l & t6_l)) >>> 0;
    var a0_new_h = (t1_h ^ (t3_h & t6_h)) >>> 0;

    var b1_l = (t3_l ^ (b2_l & t1_l)) >>> 0;
    var b1_h = (t3_h ^ (b2_h & t1_h)) >>> 0;

    return [
      a0_new_l, a0_new_h,
      b1_l, b1_h,
      b2_l, b2_h,
      b3_l, b3_h
    ];
  }

  /**
   * KNOT-512 permutation with 8-bit round constants
   * State is 8 × 64-bit words stored as byte array (little-endian)
   * @param {uint8[]} stateBytes - 64-byte state array
   * @param {number} rounds - Number of rounds to perform
   */
  function knot512Permute(stateBytes, rounds) {
    // Load state as eight 64-bit words (little-endian)
    var x0_l = OpCodes.Pack32LE(stateBytes[0], stateBytes[1], stateBytes[2], stateBytes[3]);
    var x0_h = OpCodes.Pack32LE(stateBytes[4], stateBytes[5], stateBytes[6], stateBytes[7]);
    var x1_l = OpCodes.Pack32LE(stateBytes[8], stateBytes[9], stateBytes[10], stateBytes[11]);
    var x1_h = OpCodes.Pack32LE(stateBytes[12], stateBytes[13], stateBytes[14], stateBytes[15]);
    var x2_l = OpCodes.Pack32LE(stateBytes[16], stateBytes[17], stateBytes[18], stateBytes[19]);
    var x2_h = OpCodes.Pack32LE(stateBytes[20], stateBytes[21], stateBytes[22], stateBytes[23]);
    var x3_l = OpCodes.Pack32LE(stateBytes[24], stateBytes[25], stateBytes[26], stateBytes[27]);
    var x3_h = OpCodes.Pack32LE(stateBytes[28], stateBytes[29], stateBytes[30], stateBytes[31]);
    var x4_l = OpCodes.Pack32LE(stateBytes[32], stateBytes[33], stateBytes[34], stateBytes[35]);
    var x4_h = OpCodes.Pack32LE(stateBytes[36], stateBytes[37], stateBytes[38], stateBytes[39]);
    var x5_l = OpCodes.Pack32LE(stateBytes[40], stateBytes[41], stateBytes[42], stateBytes[43]);
    var x5_h = OpCodes.Pack32LE(stateBytes[44], stateBytes[45], stateBytes[46], stateBytes[47]);
    var x6_l = OpCodes.Pack32LE(stateBytes[48], stateBytes[49], stateBytes[50], stateBytes[51]);
    var x6_h = OpCodes.Pack32LE(stateBytes[52], stateBytes[53], stateBytes[54], stateBytes[55]);
    var x7_l = OpCodes.Pack32LE(stateBytes[56], stateBytes[57], stateBytes[58], stateBytes[59]);
    var x7_h = OpCodes.Pack32LE(stateBytes[60], stateBytes[61], stateBytes[62], stateBytes[63]);

    // Perform permutation rounds
    for (var r = 0; r < rounds; r++) {
      // Add round constant to first word (low 32 bits)
      x0_l = (x0_l ^ RC8[r]) >>> 0;

      // Apply S-box to both columns
      var sbox0 = knotSbox64Flat(x0_l, x0_h, x2_l, x2_h, x4_l, x4_h, x6_l, x6_h);
      x0_l = sbox0[0]; x0_h = sbox0[1];
      var b2_l = sbox0[2]; var b2_h = sbox0[3];
      var b4_l = sbox0[4]; var b4_h = sbox0[5];
      var b6_l = sbox0[6]; var b6_h = sbox0[7];

      var sbox1 = knotSbox64Flat(x1_l, x1_h, x3_l, x3_h, x5_l, x5_h, x7_l, x7_h);
      x1_l = sbox1[0]; x1_h = sbox1[1];
      var b3_l = sbox1[2]; var b3_h = sbox1[3];
      var b5_l = sbox1[4]; var b5_h = sbox1[5];
      var b7_l = sbox1[6]; var b7_h = sbox1[7];

      // Linear diffusion layer with 128-bit rotations
      var rot1 = rotl128(b2_l, b2_h, b3_l, b3_h, 1);
      x2_l = rot1[0]; x2_h = rot1[1]; x3_l = rot1[2]; x3_h = rot1[3];

      var rot2 = rotl128(b4_l, b4_h, b5_l, b5_h, 16);
      x4_l = rot2[0]; x4_h = rot2[1]; x5_l = rot2[2]; x5_h = rot2[3];

      var rot3 = rotl128(b6_l, b6_h, b7_l, b7_h, 25);
      x6_l = rot3[0]; x6_h = rot3[1]; x7_l = rot3[2]; x7_h = rot3[3];
    }

    // Store state back to bytes (little-endian)
    var unpacked = OpCodes.Unpack32LE(x0_l);
    stateBytes[0] = unpacked[0]; stateBytes[1] = unpacked[1];
    stateBytes[2] = unpacked[2]; stateBytes[3] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x0_h);
    stateBytes[4] = unpacked[0]; stateBytes[5] = unpacked[1];
    stateBytes[6] = unpacked[2]; stateBytes[7] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x1_l);
    stateBytes[8] = unpacked[0]; stateBytes[9] = unpacked[1];
    stateBytes[10] = unpacked[2]; stateBytes[11] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x1_h);
    stateBytes[12] = unpacked[0]; stateBytes[13] = unpacked[1];
    stateBytes[14] = unpacked[2]; stateBytes[15] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x2_l);
    stateBytes[16] = unpacked[0]; stateBytes[17] = unpacked[1];
    stateBytes[18] = unpacked[2]; stateBytes[19] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x2_h);
    stateBytes[20] = unpacked[0]; stateBytes[21] = unpacked[1];
    stateBytes[22] = unpacked[2]; stateBytes[23] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x3_l);
    stateBytes[24] = unpacked[0]; stateBytes[25] = unpacked[1];
    stateBytes[26] = unpacked[2]; stateBytes[27] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x3_h);
    stateBytes[28] = unpacked[0]; stateBytes[29] = unpacked[1];
    stateBytes[30] = unpacked[2]; stateBytes[31] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x4_l);
    stateBytes[32] = unpacked[0]; stateBytes[33] = unpacked[1];
    stateBytes[34] = unpacked[2]; stateBytes[35] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x4_h);
    stateBytes[36] = unpacked[0]; stateBytes[37] = unpacked[1];
    stateBytes[38] = unpacked[2]; stateBytes[39] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x5_l);
    stateBytes[40] = unpacked[0]; stateBytes[41] = unpacked[1];
    stateBytes[42] = unpacked[2]; stateBytes[43] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x5_h);
    stateBytes[44] = unpacked[0]; stateBytes[45] = unpacked[1];
    stateBytes[46] = unpacked[2]; stateBytes[47] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x6_l);
    stateBytes[48] = unpacked[0]; stateBytes[49] = unpacked[1];
    stateBytes[50] = unpacked[2]; stateBytes[51] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x6_h);
    stateBytes[52] = unpacked[0]; stateBytes[53] = unpacked[1];
    stateBytes[54] = unpacked[2]; stateBytes[55] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x7_l);
    stateBytes[56] = unpacked[0]; stateBytes[57] = unpacked[1];
    stateBytes[58] = unpacked[2]; stateBytes[59] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x7_h);
    stateBytes[60] = unpacked[0]; stateBytes[61] = unpacked[1];
    stateBytes[62] = unpacked[2]; stateBytes[63] = unpacked[3];
  }

  // ===== ALGORITHM CLASSES =====

  /**
   * KNOT-HASH-256-256 - Cryptographic hash function
   * Uses KNOT-256 permutation (4×64-bit) with 256-bit output
   * @class
   * @extends {HashFunctionAlgorithm}
   */
  class KnotHash256_256 extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "KNOT-HASH-256-256";
      this.description = "Lightweight hash function based on bit-sliced PRESENT-like permutations, finalist in NIST Lightweight Cryptography competition. Uses KNOT-256 permutation in sponge construction with 256-bit output.";
      this.inventor = "Zheng Gong, Guohong Liao, Ling Song, Keting Jia, Lei Hu";
      this.year = 2019;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight Hash";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CN;

      this.SupportedOutputSizes = [{ minSize: 32, maxSize: 32, stepSize: 1 }];

      this.documentation = [
        new LinkItem(
          "KNOT Specification (NIST LWC)",
          "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/knot-spec-final.pdf"
        ),
        new LinkItem(
          "NIST Lightweight Cryptography",
          "https://csrc.nist.gov/projects/lightweight-cryptography"
        ),
        new LinkItem(
          "KNOT Official Website",
          "https://www.knotcipher.com/"
        )
      ];

      // Official test vectors from NIST LWC KAT
      this.tests = [
        {
          text: "KNOT-HASH-256-256: Empty message (NIST KAT Count=1)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("CF1AC5B7AA08D36D544E2D2049D0D0A5F1F6FF7B553D18035E69323D8E4118B1")
        },
        {
          text: "KNOT-HASH-256-256: Single zero byte (NIST KAT Count=2)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("1B8F1C5978ADCE6C4BAC3715E304A0F3026F873820CA4A6386CBFD0A3709949C")
        },
        {
          text: "KNOT-HASH-256-256: Two bytes (NIST KAT Count=3)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("3CFF1E8CD8CAC2FEEB696969251F828AA2288D8CCBBECBAF422634577FCED63B")
        },
        {
          text: "KNOT-HASH-256-256: Four bytes (NIST KAT Count=5)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("8410C4BBD8828E9D9A2183F23918B5F45182735560A2E1D142884D10B66327A8")
        },
        {
          text: "KNOT-HASH-256-256: Eight bytes (NIST KAT Count=9)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("6B8CCC0A32775C876B63E8E146E103172188287CDF7ED236CD5D6276C16C6B76")
        },
        {
          text: "KNOT-HASH-256-256: 16 bytes (NIST KAT Count=17)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("3D1BB21C5B2FDB385DB2231896467CC987E9EB5CCC622F88E9FA45AFEF66B6AB")
        }
      ];
    }

    /**
     * Create new hash instance
     * @param {boolean} [isInverse=false] - Not applicable for hash functions
     * @returns {KnotHash256_256Instance|null} New instance or null if inverse requested
     */
    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new KnotHash256_256Instance(this);
    }
  }

  /**
   * KNOT-HASH-256-384 - Cryptographic hash function
   * Uses KNOT-384 permutation (4×96-bit) with 256-bit output
   * @class
   * @extends {HashFunctionAlgorithm}
   */
  class KnotHash256_384 extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "KNOT-HASH-256-384";
      this.description = "Lightweight hash function based on bit-sliced PRESENT-like permutations, finalist in NIST Lightweight Cryptography competition. Uses KNOT-384 permutation with 256-bit output.";
      this.inventor = "Zheng Gong, Guohong Liao, Ling Song, Keting Jia, Lei Hu";
      this.year = 2019;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight Hash";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CN;

      this.SupportedOutputSizes = [{ minSize: 32, maxSize: 32, stepSize: 1 }];

      this.documentation = [
        new LinkItem(
          "KNOT Specification (NIST LWC)",
          "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/knot-spec-final.pdf"
        ),
        new LinkItem(
          "NIST Lightweight Cryptography",
          "https://csrc.nist.gov/projects/lightweight-cryptography"
        ),
        new LinkItem(
          "KNOT Official Website",
          "https://www.knotcipher.com/"
        )
      ];

      this.tests = [
        {
          text: "KNOT-HASH-256-384: Empty message (NIST KAT Count=1)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("5025252949BF0EBF9D750D2E11AB5C75E4F7B8DCA426B58EA2AE52A857653E04")
        },
        {
          text: "KNOT-HASH-256-384: Single zero byte (NIST KAT Count=2)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("C15C34623E347C0D3F73B84D8F1706F4F95C5640A1AB8DB43FD7B07E07AD0397")
        },
        {
          text: "KNOT-HASH-256-384: Two bytes (NIST KAT Count=3)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("53CA8EC8BFBB0610154C86019BDBB45C70706696120233D61EC1199BCCAD8CD3")
        },
        {
          text: "KNOT-HASH-256-384: Three bytes (NIST KAT Count=4)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102"),
          expected: OpCodes.Hex8ToBytes("9E6908918B5445FFAC8321B0D8EB83A47D0C2C858CDAD1DBC81DB70F9DF012ED")
        },
        {
          text: "KNOT-HASH-256-384: Four bytes (NIST KAT Count=5)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("21EF8A4C2E600A3D2B40DE5A80E6BA4B664116A1383F26EF95AD1892BE649CD5")
        },
        {
          text: "KNOT-HASH-256-384: Eight bytes (NIST KAT Count=9)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("DF3DBEFA6AB5194E5692C7FEF78C442F6A6FEAF262ADB5F3630682B58FE3766F")
        },
        {
          text: "KNOT-HASH-256-384: 16 bytes (NIST KAT Count=17)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("B3F056368184838CC83DFB0E7466E439A010743AE7C03E55022D116B5C3733B3")
        },
        {
          text: "KNOT-HASH-256-384: 32 bytes (NIST KAT Count=33)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          expected: OpCodes.Hex8ToBytes("4968D39797D02A81928E67B085E06F5C9DFB44A1FD8D49F3029B9AF126783B54")
        },
        {
          text: "KNOT-HASH-256-384: 48 bytes (NIST KAT Count=49)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F"),
          expected: OpCodes.Hex8ToBytes("8D818B7B903BA04A94CF0992B89A2988BA086C339096D16DFD636B4A3F7BD743")
        },
        {
          text: "KNOT-HASH-256-384: 64 bytes (NIST KAT Count=65)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F"),
          expected: OpCodes.Hex8ToBytes("C38B93AAC496B1376A1E53E7A82A2836A5141A08BC91F48291D1446921A535B8")
        }
      ];
    }

    /**
     * Create new hash instance
     * @param {boolean} [isInverse=false] - Not applicable for hash functions
     * @returns {KnotHash256_384Instance|null} New instance or null if inverse requested
     */
    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new KnotHash256_384Instance(this);
    }
  }

  /**
   * KNOT-HASH-384-384 - Cryptographic hash function
   * Uses KNOT-384 permutation (4×96-bit) with 384-bit output
   * @class
   * @extends {HashFunctionAlgorithm}
   */
  class KnotHash384_384 extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "KNOT-HASH-384-384";
      this.description = "Lightweight hash function based on bit-sliced PRESENT-like permutations, finalist in NIST Lightweight Cryptography competition. Uses KNOT-384 permutation in sponge construction with 384-bit output.";
      this.inventor = "Zheng Gong, Guohong Liao, Ling Song, Keting Jia, Lei Hu";
      this.year = 2019;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight Hash";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CN;

      this.SupportedOutputSizes = [{ minSize: 48, maxSize: 48, stepSize: 1 }];

      this.documentation = [
        new LinkItem(
          "KNOT Specification (NIST LWC)",
          "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/knot-spec-final.pdf"
        ),
        new LinkItem(
          "NIST Lightweight Cryptography",
          "https://csrc.nist.gov/projects/lightweight-cryptography"
        ),
        new LinkItem(
          "KNOT Official Website",
          "https://www.knotcipher.com/"
        )
      ];

      this.tests = [
        {
          text: "KNOT-HASH-384-384: Empty message (NIST KAT Count=1)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("4F3D463251831D3689692AA1B4E02DDAD79ABFCBE075A2CD2805E95C099DB75BF11C3C5EC917B6C5B3B76F8BB8D6DB2C")
        },
        {
          text: "KNOT-HASH-384-384: Single zero byte (NIST KAT Count=2)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("2FECE6F7FB33CA6F455E3A09C31B58BA9A4EDF0B04F4EAB7F1001A3EA23C6AD727FC1A15928E090EAABD0596C69B07AA")
        },
        {
          text: "KNOT-HASH-384-384: Two bytes (NIST KAT Count=3)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("07EF998B299615EDB5AFAB4D78A15A1C2076089BE8FAEEB427FF85BE69B71A99D591124F7965E5B72B0BC13E1A2A0A7C")
        },
        {
          text: "KNOT-HASH-384-384: Three bytes (NIST KAT Count=4)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102"),
          expected: OpCodes.Hex8ToBytes("750664415D55A3BA35E4A63CBA99D79FF1EE85C4B6CDD5D6A40952B27DEA031E83DF8D4499035A32F94533044B6C8B2C")
        },
        {
          text: "KNOT-HASH-384-384: Four bytes (NIST KAT Count=5)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("878D0F1348618CCA9DBA50520FFD5E1D540FF485940CFA3CF4A9BBE25AC2055ADAC5B110F208126526C9D16ABE4D27F4")
        },
        {
          text: "KNOT-HASH-384-384: Eight bytes (NIST KAT Count=9)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("B1E3A6B7E420FB6678B27C79270BAFE86FE6F91D8625ED60D586CBE4903CCA1E2E9585B721731B8EE97B1883325854D7")
        },
        {
          text: "KNOT-HASH-384-384: 16 bytes (NIST KAT Count=17)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("8019206BAC3D6A99998BB49063204805541C4B406C2CE651AEF67B6833A0B43DFCFE110F4EE9604D8A68295DB90067CD")
        },
        {
          text: "KNOT-HASH-384-384: 32 bytes (NIST KAT Count=33)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          expected: OpCodes.Hex8ToBytes("D0DC496AB1D681A63CBCC2156C361BA70F7924DA17D8F606F1AD8214114F09D44D35BA33547D512B198A77AEC5B09ADE")
        },
        {
          text: "KNOT-HASH-384-384: 48 bytes (NIST KAT Count=49)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F"),
          expected: OpCodes.Hex8ToBytes("268397BFF02CC2EE39B32644875B3B227B54B194E86F69DD1C2277299DAEB82655742DE0BBF1121A116D61E563FA10FF")
        },
        {
          text: "KNOT-HASH-384-384: 64 bytes (NIST KAT Count=65)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F"),
          expected: OpCodes.Hex8ToBytes("3AEC65FCA168DF0A8BC4FE1852861097978CCC770CE135C5110681E7AEC8E662AC5AD3D764BC03CDEC2D09AFF2197587")
        }
      ];
    }

    /**
     * Create new hash instance
     * @param {boolean} [isInverse=false] - Not applicable for hash functions
     * @returns {KnotHash384_384Instance|null} New instance or null if inverse requested
     */
    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new KnotHash384_384Instance(this);
    }
  }

  /**
   * KNOT-HASH-512-512 - Cryptographic hash function
   * Uses KNOT-512 permutation (8×64-bit) with 512-bit output
   * @class
   * @extends {HashFunctionAlgorithm}
   */
  class KnotHash512_512 extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "KNOT-HASH-512-512";
      this.description = "Lightweight hash function based on bit-sliced PRESENT-like permutations, finalist in NIST Lightweight Cryptography competition. Uses KNOT-512 permutation (8-bit round constants, 140 rounds) with 512-bit state and 512-bit output.";
      this.inventor = "Zheng Gong, Guohong Liao, Ling Song, Keting Jia, Lei Hu";
      this.year = 2019;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight Hash";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CN;

      this.SupportedOutputSizes = [{ minSize: 64, maxSize: 64, stepSize: 1 }];

      this.documentation = [
        new LinkItem(
          "KNOT Specification (NIST LWC)",
          "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/knot-spec-final.pdf"
        ),
        new LinkItem(
          "NIST Lightweight Cryptography",
          "https://csrc.nist.gov/projects/lightweight-cryptography"
        ),
        new LinkItem(
          "KNOT Official Website",
          "https://www.knotcipher.com/"
        )
      ];

      this.tests = [
        {
          text: "KNOT-HASH-512-512: Empty message (NIST KAT Count=1)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("729F0DC105A78582B78CD25D3B41CDEEF87D99C6C974D5D1DF4E96410ADD3B23CCFF5A3C69EB2061FD1BACFC8AAAC4E425ED2CC1407F2BEE0FB66FEF17FCEC91")
        },
        {
          text: "KNOT-HASH-512-512: Single zero byte (NIST KAT Count=2)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("C52CD4B2C4BA2D8434E92B9B282F01BE053B8DE3CFF0657716DE40442995DA4AF61347C7C431AF2D1B35799E7C19F8113BB5A69102CD0903D43D1C87C4B159BD")
        },
        {
          text: "KNOT-HASH-512-512: Two bytes (NIST KAT Count=3)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("CEE96A707A416CB1D9AA4F42E9E7268641B53E613B77F337B56AF3CB7426F411714A9ABD52FE83DF5509676D2713B250EEAA998CBE26D374A94002C93C54A618")
        },
        {
          text: "KNOT-HASH-512-512: Three bytes (NIST KAT Count=4)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102"),
          expected: OpCodes.Hex8ToBytes("CD2B323E45F1ED5C96E5A3FA90557580077B297B76EEB2EE9B6A95505DB4798E90C579F69C623B0213CD0AA38638773618887EB11A8B0FE70594DDE14DA99AF2")
        },
        {
          text: "KNOT-HASH-512-512: Four bytes (NIST KAT Count=5)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("9F6EF40003F292DCAFCC6FEA2E4F0C375A527C30190632D2F1FDA172623A11F25BA2C524580A80CEEC9D4C9297D2929FF19ED9767095A9DC4AF5D36B4B99B995")
        },
        {
          text: "KNOT-HASH-512-512: Five bytes (NIST KAT Count=6)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("0001020304"),
          expected: OpCodes.Hex8ToBytes("F0508B66FF661AB94A82C154DB81BB83BE42C238C15B4DE266701D02A5CEDBAFEA5C87BE26EFC9E132FA05FC93E6FA621B18FE457876440B61A81604A2161531")
        },
        {
          text: "KNOT-HASH-512-512: Eight bytes (NIST KAT Count=9)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("39EAC539C10EC0384E7FB96B0DF99B5A7669C55E5151580C6AE6769F9F031528036E3E65664F67B8312975E19AAA9B1BE4A20E51F2DD82981CF6340EA108A4C8")
        },
        {
          text: "KNOT-HASH-512-512: Nine bytes (NIST KAT Count=10)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708"),
          expected: OpCodes.Hex8ToBytes("E44B1FC05E514245944D1E1DF6A2B6D9B8C9C2D304C1B346FFF24CB0A77E3EEA13A72EE29AB99991C515BA0C4C02FD4047866D42B033B6996CAA88B8FF85A4C2")
        },
        {
          text: "KNOT-HASH-512-512: 16 bytes (NIST KAT Count=17)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("C544924BE5549A4694540271C191BF128B6B636D930A8C9AEF26EA0D0D8F12F801A2CB4BD39042A1B71483954445DFA8D1BC83D94F151A3E9254D599B1A0649D")
        },
        {
          text: "KNOT-HASH-512-512: 24 bytes (NIST KAT Count=25)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          expected: OpCodes.Hex8ToBytes("7A1CBC00F4F13ED3C21BD406992BBE0C71539A88CFD3D870602800842AD3C456C1564BA47252B14EF77F088650E83F2578D6C4B9BC84E6BE9951265E44A94F3A")
        }
      ];
    }

    /**
     * Create new hash instance
     * @param {boolean} [isInverse=false] - Not applicable for hash functions
     * @returns {KnotHash512_512Instance|null} New instance or null if inverse requested
     */
    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new KnotHash512_512Instance(this);
    }
  }

  // ===== INSTANCE CLASSES =====

  /**
   * KNOT-HASH-256-256 instance implementing Feed/Result pattern
   * @class
   * @extends {IHashFunctionInstance}
   */
  class KnotHash256_256Instance extends IHashFunctionInstance {
    /**
     * Initialize KNOT-HASH-256-256 instance
     * @param {KnotHash256_256} algorithm - Parent algorithm
     */
    constructor(algorithm) {
      super(algorithm);

      this.STATE_SIZE = 32; // 256 bits
      this.RATE = 4;        // 4 bytes
      this.ROUNDS = 68;     // Number of rounds

      this.state = new Array(this.STATE_SIZE);
      this.buffer = [];

      this.Reset();
    }

    /**
     * Reset hash state
     */
    Reset() {
      for (var i = 0; i < this.STATE_SIZE; i++) {
        this.state[i] = 0;
      }
      this.buffer = [];
    }

    /**
     * Feed data for hashing
     * @param {uint8[]} data - Input byte array
     */
    Feed(data) {
      if (!data || data.length === 0) return;

      for (var i = 0; i < data.length; i++) {
        this.buffer.push(data[i]);
      }
    }

    /**
     * Get hash result
     * @returns {uint8[]} 256-bit hash output
     */
    Result() {
      // Process all complete blocks
      var offset = 0;
      while (offset + this.RATE <= this.buffer.length) {
        for (var i = 0; i < this.RATE; i++) {
          this.state[i] ^= this.buffer[offset + i];
        }
        knot256Permute(this.state, this.ROUNDS);
        offset += this.RATE;
      }

      // Process final partial block
      var remaining = this.buffer.length - offset;
      for (var i = 0; i < remaining; i++) {
        this.state[i] ^= this.buffer[offset + i];
      }

      // Add padding
      this.state[remaining] ^= 0x01;

      // Apply permutation
      knot256Permute(this.state, this.ROUNDS);

      // Squeeze first half (16 bytes)
      var output = [];
      for (var i = 0; i < 16; i++) {
        output.push(this.state[i]);
      }

      // Apply permutation again
      knot256Permute(this.state, this.ROUNDS);

      // Squeeze second half (16 bytes)
      for (var i = 0; i < 16; i++) {
        output.push(this.state[i]);
      }

      this.Reset();
      return output;
    }
  }

  /**
   * KNOT-HASH-256-384 instance implementing Feed/Result pattern
   * @class
   * @extends {IHashFunctionInstance}
   */
  class KnotHash256_384Instance extends IHashFunctionInstance {
    /**
     * Initialize KNOT-HASH-256-384 instance
     * @param {KnotHash256_384} algorithm - Parent algorithm
     */
    constructor(algorithm) {
      super(algorithm);

      this.STATE_SIZE = 48; // 384 bits
      this.RATE = 16;       // 16 bytes
      this.ROUNDS = 80;     // Number of rounds

      this.state = new Array(this.STATE_SIZE);
      this.buffer = [];

      this.Reset();
    }

    /**
     * Reset hash state
     */
    Reset() {
      for (var i = 0; i < this.STATE_SIZE; i++) {
        this.state[i] = 0;
      }

      // Set domain separator
      this.state[this.STATE_SIZE - 1] ^= 0x80;

      this.buffer = [];
    }

    /**
     * Feed data for hashing
     * @param {uint8[]} data - Input byte array
     */
    Feed(data) {
      if (!data || data.length === 0) return;

      for (var i = 0; i < data.length; i++) {
        this.buffer.push(data[i]);
      }
    }

    /**
     * Get hash result
     * @returns {uint8[]} 256-bit hash output
     */
    Result() {
      // Process all complete blocks
      var offset = 0;
      while (offset + this.RATE <= this.buffer.length) {
        for (var i = 0; i < this.RATE; i++) {
          this.state[i] ^= this.buffer[offset + i];
        }
        knot384Permute(this.state, this.ROUNDS);
        offset += this.RATE;
      }

      // Process final partial block
      var remaining = this.buffer.length - offset;
      for (var i = 0; i < remaining; i++) {
        this.state[i] ^= this.buffer[offset + i];
      }

      // Add padding
      this.state[remaining] ^= 0x01;

      // Apply permutation
      knot384Permute(this.state, this.ROUNDS);

      // Squeeze first half (16 bytes)
      var output = [];
      for (var i = 0; i < 16; i++) {
        output.push(this.state[i]);
      }

      // Apply permutation again
      knot384Permute(this.state, this.ROUNDS);

      // Squeeze second half (16 bytes)
      for (var i = 0; i < 16; i++) {
        output.push(this.state[i]);
      }

      this.Reset();
      return output;
    }
  }

  /**
   * KNOT-HASH-384-384 instance implementing Feed/Result pattern
   * @class
   * @extends {IHashFunctionInstance}
   */
  class KnotHash384_384Instance extends IHashFunctionInstance {
    /**
     * Initialize KNOT-HASH-384-384 instance
     * @param {KnotHash384_384} algorithm - Parent algorithm
     */
    constructor(algorithm) {
      super(algorithm);

      this.STATE_SIZE = 48; // 384 bits
      this.RATE = 6;        // 6 bytes
      this.ROUNDS = 104;    // Number of rounds

      this.state = new Array(this.STATE_SIZE);
      this.buffer = [];

      this.Reset();
    }

    /**
     * Reset hash state
     */
    Reset() {
      for (var i = 0; i < this.STATE_SIZE; i++) {
        this.state[i] = 0;
      }

      // No domain separator for 384-384

      this.buffer = [];
    }

    /**
     * Feed data for hashing
     * @param {uint8[]} data - Input byte array
     */
    Feed(data) {
      if (!data || data.length === 0) return;

      for (var i = 0; i < data.length; i++) {
        this.buffer.push(data[i]);
      }
    }

    /**
     * Get hash result
     * @returns {uint8[]} 384-bit hash output
     */
    Result() {
      // Process all complete blocks
      var offset = 0;
      while (offset + this.RATE <= this.buffer.length) {
        for (var i = 0; i < this.RATE; i++) {
          this.state[i] ^= this.buffer[offset + i];
        }
        knot384Permute(this.state, this.ROUNDS);
        offset += this.RATE;
      }

      // Process final partial block
      var remaining = this.buffer.length - offset;
      for (var i = 0; i < remaining; i++) {
        this.state[i] ^= this.buffer[offset + i];
      }

      // Add padding
      this.state[remaining] ^= 0x01;

      // Apply permutation
      knot384Permute(this.state, this.ROUNDS);

      // Squeeze first half (24 bytes)
      var output = [];
      for (var i = 0; i < 24; i++) {
        output.push(this.state[i]);
      }

      // Apply permutation again
      knot384Permute(this.state, this.ROUNDS);

      // Squeeze second half (24 bytes)
      for (var i = 0; i < 24; i++) {
        output.push(this.state[i]);
      }

      this.Reset();
      return output;
    }
  }

  /**
   * KNOT-HASH-512-512 instance implementing Feed/Result pattern
   * @class
   * @extends {IHashFunctionInstance}
   */
  class KnotHash512_512Instance extends IHashFunctionInstance {
    /**
     * Initialize KNOT-HASH-512-512 instance
     * @param {KnotHash512_512} algorithm - Parent algorithm
     */
    constructor(algorithm) {
      super(algorithm);

      this.STATE_SIZE = 64; // 512 bits
      this.RATE = 8;        // 8 bytes
      this.ROUNDS = 140;    // Number of rounds

      this.state = new Array(this.STATE_SIZE);
      this.buffer = [];

      this.Reset();
    }

    /**
     * Reset hash state
     */
    Reset() {
      for (var i = 0; i < this.STATE_SIZE; i++) {
        this.state[i] = 0;
      }
      this.buffer = [];
    }

    /**
     * Feed data for hashing
     * @param {uint8[]} data - Input byte array
     */
    Feed(data) {
      if (!data || data.length === 0) return;

      for (var i = 0; i < data.length; i++) {
        this.buffer.push(data[i]);
      }
    }

    /**
     * Get hash result
     * @returns {uint8[]} 512-bit hash output
     */
    Result() {
      // Process all complete blocks
      var offset = 0;
      while (offset + this.RATE <= this.buffer.length) {
        for (var i = 0; i < this.RATE; i++) {
          this.state[i] ^= this.buffer[offset + i];
        }
        knot512Permute(this.state, this.ROUNDS);
        offset += this.RATE;
      }

      // Process final partial block
      var remaining = this.buffer.length - offset;
      for (var i = 0; i < remaining; i++) {
        this.state[i] ^= this.buffer[offset + i];
      }

      // Add padding
      this.state[remaining] ^= 0x01;

      // Apply permutation
      knot512Permute(this.state, this.ROUNDS);

      // Squeeze first half (32 bytes)
      var output = [];
      for (var i = 0; i < 32; i++) {
        output.push(this.state[i]);
      }

      // Apply permutation again
      knot512Permute(this.state, this.ROUNDS);

      // Squeeze second half (32 bytes)
      for (var i = 0; i < 32; i++) {
        output.push(this.state[i]);
      }

      this.Reset();
      return output;
    }
  }

  // ===== REGISTRATION =====

  const alg256_256 = new KnotHash256_256();
  const alg256_384 = new KnotHash256_384();
  const alg384_384 = new KnotHash384_384();
  const alg512_512 = new KnotHash512_512();

  if (!AlgorithmFramework.Find(alg256_256.name)) RegisterAlgorithm(alg256_256);
  if (!AlgorithmFramework.Find(alg256_384.name)) RegisterAlgorithm(alg256_384);
  if (!AlgorithmFramework.Find(alg384_384.name)) RegisterAlgorithm(alg384_384);
  if (!AlgorithmFramework.Find(alg512_512.name)) RegisterAlgorithm(alg512_512);

  // ===== EXPORTS =====

  return {
    KnotHash256_256: KnotHash256_256,
    KnotHash256_256Instance: KnotHash256_256Instance,
    KnotHash256_384: KnotHash256_384,
    KnotHash256_384Instance: KnotHash256_384Instance,
    KnotHash384_384: KnotHash384_384,
    KnotHash384_384Instance: KnotHash384_384Instance,
    KnotHash512_512: KnotHash512_512,
    KnotHash512_512Instance: KnotHash512_512Instance
  };
}));
