/*
 * Elephant AEAD - NIST Lightweight Cryptography Finalist
 * AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * Elephant is a family of authenticated encryption algorithms based on sponge
 * permutations (Spongent-π and Keccak-p[200]). It uses an LFSR-based mask
 * technique to provide both encryption and authentication in a lightweight design.
 *
 * Three variants:
 * - Dumbo: Spongent-π[160], 80 rounds, 8-byte tag
 * - Jumbo: Spongent-π[176], 90 rounds, 8-byte tag
 * - Delirium: Keccak-p[200], 18 rounds, 16-byte tag
 *
 * All variants:
 * - 128-bit key
 * - 96-bit nonce
 * - NIST LWC finalist
 *
 * References:
 * - https://www.esat.kuleuven.be/cosic/elephant/
 * - NIST Lightweight Cryptography Round 3
 * - https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/elephant-spec-final.pdf
 *
 * This implementation is for educational purposes only.
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
          AeadAlgorithm, IAeadInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== PERMUTATION PRIMITIVES =====

  /**
   * Spongent S-box (4-bit to 4-bit non-linear transformation)
   * Applied to 8 nibbles in parallel across a 32-bit word
   */
  function spongentSbox(x3) {
    var x2 = (x3 >>> 1) >>> 0;
    var x1 = (x2 >>> 1) >>> 0;
    var x0 = (x1 >>> 1) >>> 0;

    var q0 = (x0 ^ x2) >>> 0;
    var q1 = (x1 ^ x2) >>> 0;
    var t0 = (q0 & q1) >>> 0;
    var q2 = (~(x0 ^ x1 ^ x3 ^ t0)) >>> 0;
    var t1 = (q2 & ~x0) >>> 0;
    var q3 = (x1 ^ t1) >>> 0;
    var t2 = (q3 & (q3 ^ x2 ^ x3 ^ t0)) >>> 0;
    var t3 = ((x2 ^ t0) & ~(x1 ^ t0)) >>> 0;

    q0 = (x1 ^ x2 ^ x3 ^ t2) >>> 0;
    q1 = (x0 ^ x2 ^ x3 ^ t0 ^ t1) >>> 0;
    q2 = (x0 ^ x1 ^ x2 ^ t1) >>> 0;
    q3 = (x0 ^ x3 ^ t0 ^ t3) >>> 0;

    return (((q0 << 3) & 0x88888888) | ((q1 << 2) & 0x44444444) |
            ((q2 << 1) & 0x22222222) | (q3 & 0x11111111)) >>> 0;
  }

  /**
   * Spongent-π[160] permutation
   * 160-bit state, 80 rounds
   */
  function spongent160Permute(state) {
    var RC = [
      0x75, 0xae, 0x6a, 0x56, 0x54, 0x2a, 0x29, 0x94,
      0x53, 0xca, 0x27, 0xe4, 0x4f, 0xf2, 0x1f, 0xf8,
      0x3e, 0x7c, 0x7d, 0xbe, 0x7a, 0x5e, 0x74, 0x2e,
      0x68, 0x16, 0x50, 0x0a, 0x21, 0x84, 0x43, 0xc2,
      0x07, 0xe0, 0x0e, 0x70, 0x1c, 0x38, 0x38, 0x1c,
      0x71, 0x8e, 0x62, 0x46, 0x44, 0x22, 0x09, 0x90,
      0x12, 0x48, 0x24, 0x24, 0x49, 0x92, 0x13, 0xc8,
      0x26, 0x64, 0x4d, 0xb2, 0x1b, 0xd8, 0x36, 0x6c,
      0x6d, 0xb6, 0x5a, 0x5a, 0x35, 0xac, 0x6b, 0xd6,
      0x56, 0x6a, 0x2d, 0xb4, 0x5b, 0xda, 0x37, 0xec,
      0x6f, 0xf6, 0x5e, 0x7a, 0x3d, 0xbc, 0x7b, 0xde,
      0x76, 0x6e, 0x6c, 0x36, 0x58, 0x1a, 0x31, 0x8c,
      0x63, 0xc6, 0x46, 0x62, 0x0d, 0xb0, 0x1a, 0x58,
      0x34, 0x2c, 0x69, 0x96, 0x52, 0x4a, 0x25, 0xa4,
      0x4b, 0xd2, 0x17, 0xe8, 0x2e, 0x74, 0x5d, 0xba,
      0x3b, 0xdc, 0x77, 0xee, 0x6e, 0x76, 0x5c, 0x3a,
      0x39, 0x9c, 0x73, 0xce, 0x66, 0x66, 0x4c, 0x32,
      0x19, 0x98, 0x32, 0x4c, 0x65, 0xa6, 0x4a, 0x52,
      0x15, 0xa8, 0x2a, 0x54, 0x55, 0xaa, 0x2b, 0xd4,
      0x57, 0xea, 0x2f, 0xf4, 0x5f, 0xfa, 0x3f, 0xfc
    ];

    // Load state as little-endian 32-bit words
    var x0 = OpCodes.Pack32LE(state[0], state[1], state[2], state[3]);
    var x1 = OpCodes.Pack32LE(state[4], state[5], state[6], state[7]);
    var x2 = OpCodes.Pack32LE(state[8], state[9], state[10], state[11]);
    var x3 = OpCodes.Pack32LE(state[12], state[13], state[14], state[15]);
    var x4 = OpCodes.Pack32LE(state[16], state[17], state[18], state[19]);

    var t0, t1, t2, t3, t4;
    var BCP = function(x, bit) { return (x & (1 << bit)) >>> 0; };
    var BUP = function(x, from, to) { return ((x << (to - from)) & (1 << to)) >>> 0; };
    var BDN = function(x, from, to) { return ((x >>> (from - to)) & (1 << to)) >>> 0; };

    // 80 rounds
    for (var round = 0; round < 80; ++round) {
      // Add round constants
      x0 ^= RC[round * 2];
      x4 ^= (RC[round * 2 + 1] << 24) >>> 0;

      // Apply S-box
      t0 = spongentSbox(x0);
      t1 = spongentSbox(x1);
      t2 = spongentSbox(x2);
      t3 = spongentSbox(x3);
      t4 = spongentSbox(x4);

      // Bit permutation layer
      x0 = (BCP(t0, 0) ^ BDN(t0, 4, 1) ^ BDN(t0, 8, 2) ^
            BDN(t0, 12, 3) ^ BDN(t0, 16, 4) ^ BDN(t0, 20, 5) ^
            BDN(t0, 24, 6) ^ BDN(t0, 28, 7) ^ BUP(t1, 0, 8) ^
            BUP(t1, 4, 9) ^ BUP(t1, 8, 10) ^ BDN(t1, 12, 11) ^
            BDN(t1, 16, 12) ^ BDN(t1, 20, 13) ^ BDN(t1, 24, 14) ^
            BDN(t1, 28, 15) ^ BUP(t2, 0, 16) ^ BUP(t2, 4, 17) ^
            BUP(t2, 8, 18) ^ BUP(t2, 12, 19) ^ BUP(t2, 16, 20) ^
            BUP(t2, 20, 21) ^ BDN(t2, 24, 22) ^ BDN(t2, 28, 23) ^
            BUP(t3, 0, 24) ^ BUP(t3, 4, 25) ^ BUP(t3, 8, 26) ^
            BUP(t3, 12, 27) ^ BUP(t3, 16, 28) ^ BUP(t3, 20, 29) ^
            BUP(t3, 24, 30) ^ BUP(t3, 28, 31)) >>> 0;

      x1 = (BUP(t0, 1, 8) ^ BUP(t0, 5, 9) ^ BUP(t0, 9, 10) ^
            BDN(t0, 13, 11) ^ BDN(t0, 17, 12) ^ BDN(t0, 21, 13) ^
            BDN(t0, 25, 14) ^ BDN(t0, 29, 15) ^ BUP(t1, 1, 16) ^
            BUP(t1, 5, 17) ^ BUP(t1, 9, 18) ^ BUP(t1, 13, 19) ^
            BUP(t1, 17, 20) ^ BCP(t1, 21) ^ BDN(t1, 25, 22) ^
            BDN(t1, 29, 23) ^ BUP(t2, 1, 24) ^ BUP(t2, 5, 25) ^
            BUP(t2, 9, 26) ^ BUP(t2, 13, 27) ^ BUP(t2, 17, 28) ^
            BUP(t2, 21, 29) ^ BUP(t2, 25, 30) ^ BUP(t2, 29, 31) ^
            BCP(t4, 0) ^ BDN(t4, 4, 1) ^ BDN(t4, 8, 2) ^
            BDN(t4, 12, 3) ^ BDN(t4, 16, 4) ^ BDN(t4, 20, 5) ^
            BDN(t4, 24, 6) ^ BDN(t4, 28, 7)) >>> 0;

      x2 = (BUP(t0, 2, 16) ^ BUP(t0, 6, 17) ^ BUP(t0, 10, 18) ^
            BUP(t0, 14, 19) ^ BUP(t0, 18, 20) ^ BDN(t0, 22, 21) ^
            BDN(t0, 26, 22) ^ BDN(t0, 30, 23) ^ BUP(t1, 2, 24) ^
            BUP(t1, 6, 25) ^ BUP(t1, 10, 26) ^ BUP(t1, 14, 27) ^
            BUP(t1, 18, 28) ^ BUP(t1, 22, 29) ^ BUP(t1, 26, 30) ^
            BUP(t1, 30, 31) ^ BDN(t3, 1, 0) ^ BDN(t3, 5, 1) ^
            BDN(t3, 9, 2) ^ BDN(t3, 13, 3) ^ BDN(t3, 17, 4) ^
            BDN(t3, 21, 5) ^ BDN(t3, 25, 6) ^ BDN(t3, 29, 7) ^
            BUP(t4, 1, 8) ^ BUP(t4, 5, 9) ^ BUP(t4, 9, 10) ^
            BDN(t4, 13, 11) ^ BDN(t4, 17, 12) ^ BDN(t4, 21, 13) ^
            BDN(t4, 25, 14) ^ BDN(t4, 29, 15)) >>> 0;

      x3 = (BUP(t0, 3, 24) ^ BUP(t0, 7, 25) ^ BUP(t0, 11, 26) ^
            BUP(t0, 15, 27) ^ BUP(t0, 19, 28) ^ BUP(t0, 23, 29) ^
            BUP(t0, 27, 30) ^ BCP(t0, 31) ^ BDN(t2, 2, 0) ^
            BDN(t2, 6, 1) ^ BDN(t2, 10, 2) ^ BDN(t2, 14, 3) ^
            BDN(t2, 18, 4) ^ BDN(t2, 22, 5) ^ BDN(t2, 26, 6) ^
            BDN(t2, 30, 7) ^ BUP(t3, 2, 8) ^ BUP(t3, 6, 9) ^
            BCP(t3, 10) ^ BDN(t3, 14, 11) ^ BDN(t3, 18, 12) ^
            BDN(t3, 22, 13) ^ BDN(t3, 26, 14) ^ BDN(t3, 30, 15) ^
            BUP(t4, 2, 16) ^ BUP(t4, 6, 17) ^ BUP(t4, 10, 18) ^
            BUP(t4, 14, 19) ^ BUP(t4, 18, 20) ^ BDN(t4, 22, 21) ^
            BDN(t4, 26, 22) ^ BDN(t4, 30, 23)) >>> 0;

      x4 = (BDN(t1, 3, 0) ^ BDN(t1, 7, 1) ^ BDN(t1, 11, 2) ^
            BDN(t1, 15, 3) ^ BDN(t1, 19, 4) ^ BDN(t1, 23, 5) ^
            BDN(t1, 27, 6) ^ BDN(t1, 31, 7) ^ BUP(t2, 3, 8) ^
            BUP(t2, 7, 9) ^ BDN(t2, 11, 10) ^ BDN(t2, 15, 11) ^
            BDN(t2, 19, 12) ^ BDN(t2, 23, 13) ^ BDN(t2, 27, 14) ^
            BDN(t2, 31, 15) ^ BUP(t3, 3, 16) ^ BUP(t3, 7, 17) ^
            BUP(t3, 11, 18) ^ BUP(t3, 15, 19) ^ BUP(t3, 19, 20) ^
            BDN(t3, 23, 21) ^ BDN(t3, 27, 22) ^ BDN(t3, 31, 23) ^
            BUP(t4, 3, 24) ^ BUP(t4, 7, 25) ^ BUP(t4, 11, 26) ^
            BUP(t4, 15, 27) ^ BUP(t4, 19, 28) ^ BUP(t4, 23, 29) ^
            BUP(t4, 27, 30) ^ BCP(t4, 31)) >>> 0;
    }

    // Store back to state as little-endian bytes
    var bytes0 = OpCodes.Unpack32LE(x0);
    var bytes1 = OpCodes.Unpack32LE(x1);
    var bytes2 = OpCodes.Unpack32LE(x2);
    var bytes3 = OpCodes.Unpack32LE(x3);
    var bytes4 = OpCodes.Unpack32LE(x4);

    for (var i = 0; i < 4; ++i) {
      state[i] = bytes0[i];
      state[4 + i] = bytes1[i];
      state[8 + i] = bytes2[i];
      state[12 + i] = bytes3[i];
      state[16 + i] = bytes4[i];
    }
  }

  /**
   * Spongent-π[176] permutation
   * 176-bit state (22 bytes), 90 rounds
   */
  function spongent176Permute(state) {
    var RC = [
      0x45, 0xa2, 0x0b, 0xd0, 0x16, 0x68, 0x2c, 0x34,
      0x59, 0x9a, 0x33, 0xcc, 0x67, 0xe6, 0x4e, 0x72,
      0x1d, 0xb8, 0x3a, 0x5c, 0x75, 0xae, 0x6a, 0x56,
      0x54, 0x2a, 0x29, 0x94, 0x53, 0xca, 0x27, 0xe4,
      0x4f, 0xf2, 0x1f, 0xf8, 0x3e, 0x7c, 0x7d, 0xbe,
      0x7a, 0x5e, 0x74, 0x2e, 0x68, 0x16, 0x50, 0x0a,
      0x21, 0x84, 0x43, 0xc2, 0x07, 0xe0, 0x0e, 0x70,
      0x1c, 0x38, 0x38, 0x1c, 0x71, 0x8e, 0x62, 0x46,
      0x44, 0x22, 0x09, 0x90, 0x12, 0x48, 0x24, 0x24,
      0x49, 0x92, 0x13, 0xc8, 0x26, 0x64, 0x4d, 0xb2,
      0x1b, 0xd8, 0x36, 0x6c, 0x6d, 0xb6, 0x5a, 0x5a,
      0x35, 0xac, 0x6b, 0xd6, 0x56, 0x6a, 0x2d, 0xb4,
      0x5b, 0xda, 0x37, 0xec, 0x6f, 0xf6, 0x5e, 0x7a,
      0x3d, 0xbc, 0x7b, 0xde, 0x76, 0x6e, 0x6c, 0x36,
      0x58, 0x1a, 0x31, 0x8c, 0x63, 0xc6, 0x46, 0x62,
      0x0d, 0xb0, 0x1a, 0x58, 0x34, 0x2c, 0x69, 0x96,
      0x52, 0x4a, 0x25, 0xa4, 0x4b, 0xd2, 0x17, 0xe8,
      0x2e, 0x74, 0x5d, 0xba, 0x3b, 0xdc, 0x77, 0xee,
      0x6e, 0x76, 0x5c, 0x3a, 0x39, 0x9c, 0x73, 0xce,
      0x66, 0x66, 0x4c, 0x32, 0x19, 0x98, 0x32, 0x4c,
      0x65, 0xa6, 0x4a, 0x52, 0x15, 0xa8, 0x2a, 0x54,
      0x55, 0xaa, 0x2b, 0xd4, 0x57, 0xea, 0x2f, 0xf4,
      0x5f, 0xfa, 0x3f, 0xfc
    ];

    // Load state (last word is 16-bit only)
    var x0 = OpCodes.Pack32LE(state[0], state[1], state[2], state[3]);
    var x1 = OpCodes.Pack32LE(state[4], state[5], state[6], state[7]);
    var x2 = OpCodes.Pack32LE(state[8], state[9], state[10], state[11]);
    var x3 = OpCodes.Pack32LE(state[12], state[13], state[14], state[15]);
    var x4 = OpCodes.Pack32LE(state[16], state[17], state[18], state[19]);
    var x5 = OpCodes.Pack16LE(state[20], state[21]);

    var t0, t1, t2, t3, t4, t5;
    var BCP = function(x, bit) { return (x & (1 << bit)) >>> 0; };
    var BUP = function(x, from, to) { return ((x << (to - from)) & (1 << to)) >>> 0; };
    var BDN = function(x, from, to) { return ((x >>> (from - to)) & (1 << to)) >>> 0; };

    // 90 rounds
    for (var round = 0; round < 90; ++round) {
      // Add round constants
      x0 ^= RC[round * 2];
      x5 ^= (RC[round * 2 + 1] << 8) >>> 0;

      // Apply S-box
      t0 = spongentSbox(x0);
      t1 = spongentSbox(x1);
      t2 = spongentSbox(x2);
      t3 = spongentSbox(x3);
      t4 = spongentSbox(x4);
      t5 = spongentSbox(x5);

      // Bit permutation (bit i → (44 * i) % 175, except last bit)
      x0 = (BCP(t0, 0) ^ BDN(t0, 4, 1) ^ BDN(t0, 8, 2) ^
            BDN(t0, 12, 3) ^ BDN(t0, 16, 4) ^ BDN(t0, 20, 5) ^
            BDN(t0, 24, 6) ^ BDN(t0, 28, 7) ^ BUP(t1, 0, 8) ^
            BUP(t1, 4, 9) ^ BUP(t1, 8, 10) ^ BDN(t1, 12, 11) ^
            BDN(t1, 16, 12) ^ BDN(t1, 20, 13) ^ BDN(t1, 24, 14) ^
            BDN(t1, 28, 15) ^ BUP(t2, 0, 16) ^ BUP(t2, 4, 17) ^
            BUP(t2, 8, 18) ^ BUP(t2, 12, 19) ^ BUP(t2, 16, 20) ^
            BUP(t2, 20, 21) ^ BDN(t2, 24, 22) ^ BDN(t2, 28, 23) ^
            BUP(t3, 0, 24) ^ BUP(t3, 4, 25) ^ BUP(t3, 8, 26) ^
            BUP(t3, 12, 27) ^ BUP(t3, 16, 28) ^ BUP(t3, 20, 29) ^
            BUP(t3, 24, 30) ^ BUP(t3, 28, 31)) >>> 0;

      x1 = (BUP(t0, 1, 12) ^ BUP(t0, 5, 13) ^ BUP(t0, 9, 14) ^
            BUP(t0, 13, 15) ^ BDN(t0, 17, 16) ^ BDN(t0, 21, 17) ^
            BDN(t0, 25, 18) ^ BDN(t0, 29, 19) ^ BUP(t1, 1, 20) ^
            BUP(t1, 5, 21) ^ BUP(t1, 9, 22) ^ BUP(t1, 13, 23) ^
            BUP(t1, 17, 24) ^ BUP(t1, 21, 25) ^ BUP(t1, 25, 26) ^
            BDN(t1, 29, 27) ^ BUP(t2, 1, 28) ^ BUP(t2, 5, 29) ^
            BUP(t2, 9, 30) ^ BUP(t2, 13, 31) ^ BCP(t4, 0) ^
            BDN(t4, 4, 1) ^ BDN(t4, 8, 2) ^ BDN(t4, 12, 3) ^
            BDN(t4, 16, 4) ^ BDN(t4, 20, 5) ^ BDN(t4, 24, 6) ^
            BDN(t4, 28, 7) ^ BUP(t5, 0, 8) ^ BUP(t5, 4, 9) ^
            BUP(t5, 8, 10) ^ BDN(t5, 12, 11)) >>> 0;

      x2 = (BUP(t0, 2, 24) ^ BUP(t0, 6, 25) ^ BUP(t0, 10, 26) ^
            BUP(t0, 14, 27) ^ BUP(t0, 18, 28) ^ BUP(t0, 22, 29) ^
            BUP(t0, 26, 30) ^ BUP(t0, 30, 31) ^ BDN(t2, 17, 0) ^
            BDN(t2, 21, 1) ^ BDN(t2, 25, 2) ^ BDN(t2, 29, 3) ^
            BUP(t3, 1, 4) ^ BCP(t3, 5) ^ BDN(t3, 9, 6) ^
            BDN(t3, 13, 7) ^ BDN(t3, 17, 8) ^ BDN(t3, 21, 9) ^
            BDN(t3, 25, 10) ^ BDN(t3, 29, 11) ^ BUP(t4, 1, 12) ^
            BUP(t4, 5, 13) ^ BUP(t4, 9, 14) ^ BUP(t4, 13, 15) ^
            BDN(t4, 17, 16) ^ BDN(t4, 21, 17) ^ BDN(t4, 25, 18) ^
            BDN(t4, 29, 19) ^ BUP(t5, 1, 20) ^ BUP(t5, 5, 21) ^
            BUP(t5, 9, 22) ^ BUP(t5, 13, 23)) >>> 0;

      x3 = (BDN(t1, 2, 0) ^ BDN(t1, 6, 1) ^ BDN(t1, 10, 2) ^
            BDN(t1, 14, 3) ^ BDN(t1, 18, 4) ^ BDN(t1, 22, 5) ^
            BDN(t1, 26, 6) ^ BDN(t1, 30, 7) ^ BUP(t2, 2, 8) ^
            BUP(t2, 6, 9) ^ BCP(t2, 10) ^ BDN(t2, 14, 11) ^
            BDN(t2, 18, 12) ^ BDN(t2, 22, 13) ^ BDN(t2, 26, 14) ^
            BDN(t2, 30, 15) ^ BUP(t3, 2, 16) ^ BUP(t3, 6, 17) ^
            BUP(t3, 10, 18) ^ BUP(t3, 14, 19) ^ BUP(t3, 18, 20) ^
            BDN(t3, 22, 21) ^ BDN(t3, 26, 22) ^ BDN(t3, 30, 23) ^
            BUP(t4, 2, 24) ^ BUP(t4, 6, 25) ^ BUP(t4, 10, 26) ^
            BUP(t4, 14, 27) ^ BUP(t4, 18, 28) ^ BUP(t4, 22, 29) ^
            BUP(t4, 26, 30) ^ BUP(t4, 30, 31)) >>> 0;

      x4 = (BUP(t0, 3, 4) ^ BDN(t0, 7, 5) ^ BDN(t0, 11, 6) ^
            BDN(t0, 15, 7) ^ BDN(t0, 19, 8) ^ BDN(t0, 23, 9) ^
            BDN(t0, 27, 10) ^ BDN(t0, 31, 11) ^ BUP(t1, 3, 12) ^
            BUP(t1, 7, 13) ^ BUP(t1, 11, 14) ^ BCP(t1, 15) ^
            BDN(t1, 19, 16) ^ BDN(t1, 23, 17) ^ BDN(t1, 27, 18) ^
            BDN(t1, 31, 19) ^ BUP(t2, 3, 20) ^ BUP(t2, 7, 21) ^
            BUP(t2, 11, 22) ^ BUP(t2, 15, 23) ^ BUP(t2, 19, 24) ^
            BUP(t2, 23, 25) ^ BDN(t2, 27, 26) ^ BDN(t2, 31, 27) ^
            BUP(t3, 3, 28) ^ BUP(t3, 7, 29) ^ BUP(t3, 11, 30) ^
            BUP(t3, 15, 31) ^ BDN(t5, 2, 0) ^ BDN(t5, 6, 1) ^
            BDN(t5, 10, 2) ^ BDN(t5, 14, 3)) >>> 0;

      x5 = (BDN(t3, 19, 0) ^ BDN(t3, 23, 1) ^ BDN(t3, 27, 2) ^
            BDN(t3, 31, 3) ^ BUP(t4, 3, 4) ^ BDN(t4, 7, 5) ^
            BDN(t4, 11, 6) ^ BDN(t4, 15, 7) ^ BDN(t4, 19, 8) ^
            BDN(t4, 23, 9) ^ BDN(t4, 27, 10) ^ BDN(t4, 31, 11) ^
            BUP(t5, 3, 12) ^ BUP(t5, 7, 13) ^ BUP(t5, 11, 14) ^
            BCP(t5, 15)) >>> 0;
    }

    // Store back to state
    var bytes0 = OpCodes.Unpack32LE(x0);
    var bytes1 = OpCodes.Unpack32LE(x1);
    var bytes2 = OpCodes.Unpack32LE(x2);
    var bytes3 = OpCodes.Unpack32LE(x3);
    var bytes4 = OpCodes.Unpack32LE(x4);
    var bytes5 = OpCodes.Unpack16LE(x5);

    for (var i = 0; i < 4; ++i) {
      state[i] = bytes0[i];
      state[4 + i] = bytes1[i];
      state[8 + i] = bytes2[i];
      state[12 + i] = bytes3[i];
      state[16 + i] = bytes4[i];
    }
    state[20] = bytes5[0];
    state[21] = bytes5[1];
  }

  /**
   * Keccak-p[200] permutation (for Delirium variant)
   * 200-bit state (25 bytes = 5x5 lane array), 18 rounds
   */
  function keccakP200Permute(state) {
    var RC = [
      0x01, 0x82, 0x8a, 0x00, 0x8b, 0x01, 0x81, 0x09, 0x8a,
      0x88, 0x09, 0x0a, 0x8b, 0x8b, 0x89, 0x03, 0x02, 0x80
    ];

    var RHO = [0, 1, 6, 4, 3, 4, 4, 6, 7, 4, 3, 2, 3, 1, 7, 1, 5, 7, 5, 0, 2, 2, 5, 0, 6];

    var tempA = new Array(25);
    var index = function(x, y) { return x + y * 5; };
    var ROL8 = function(a, offset) {
      return ((a << offset) | ((a & 0xff) >>> (8 - offset))) & 0xFF;
    };

    for (var round = 0; round < 18; ++round) {
      var x, y;

      // Theta
      for (x = 0; x < 5; ++x) {
        tempA[x] = 0;
        for (y = 0; y < 5; ++y) {
          tempA[x] ^= state[index(x, y)];
        }
      }
      for (x = 0; x < 5; ++x) {
        tempA[x + 5] = ROL8(tempA[(x + 1) % 5], 1) ^ tempA[(x + 4) % 5];
      }
      for (x = 0; x < 5; ++x) {
        for (y = 0; y < 5; ++y) {
          state[index(x, y)] ^= tempA[x + 5];
        }
      }

      // Rho
      for (x = 0; x < 5; ++x) {
        for (y = 0; y < 5; ++y) {
          tempA[index(x, y)] = ROL8(state[index(x, y)], RHO[index(x, y)]);
        }
      }

      // Pi
      for (x = 0; x < 5; ++x) {
        for (y = 0; y < 5; ++y) {
          state[index(y, (2 * x + 3 * y) % 5)] = tempA[index(x, y)];
        }
      }

      // Chi
      for (y = 0; y < 5; ++y) {
        for (x = 0; x < 5; ++x) {
          tempA[x] = (state[index(x, y)] ^ ((~state[index((x + 1) % 5, y)]) & state[index((x + 2) % 5, y)])) & 0xFF;
        }
        for (x = 0; x < 5; ++x) {
          state[index(x, y)] = tempA[x];
        }
      }

      // Iota
      state[0] ^= RC[round];
    }
  }

  // ===== LFSR FUNCTIONS =====

  /**
   * Dumbo LFSR: feedback polynomial for 160-bit mask
   * Complete LFSR operation: shift left + compute feedback byte
   * newByte = rotL3(mask[0]) ^ (mask[3] << 7) ^ (mask[13] >> 7)
   */
  function dumboLFSR(output, input) {
    var temp = (OpCodes.RotL8(input[0], 3) ^ (input[3] << 7) ^ (input[13] >>> 7)) & 0xFF;
    for (var i = 0; i < 19; ++i) {
      output[i] = input[i + 1];
    }
    output[19] = temp;
  }

  /**
   * Jumbo LFSR: feedback polynomial for 176-bit mask
   * Complete LFSR operation: shift left + compute feedback byte
   * newByte = rotL1(mask[0]) ^ (mask[3] << 7) ^ (mask[19] >> 7)
   */
  function jumboLFSR(output, input) {
    var temp = (OpCodes.RotL8(input[0], 1) ^ (input[3] << 7) ^ (input[19] >>> 7)) & 0xFF;
    for (var i = 0; i < 21; ++i) {
      output[i] = input[i + 1];
    }
    output[21] = temp;
  }

  /**
   * Delirium LFSR: feedback polynomial for 200-bit mask
   * Complete LFSR operation: shift left + compute feedback byte
   * newByte = rotL1(mask[0]) ^ rotL1(mask[2]) ^ (mask[13] << 1)
   */
  function deliriumLFSR(output, input) {
    var temp = (OpCodes.RotL8(input[0], 1) ^ OpCodes.RotL8(input[2], 1) ^ (input[13] << 1)) & 0xFF;
    for (var i = 0; i < 24; ++i) {
      output[i] = input[i + 1];
    }
    output[24] = temp;
  }

  // ===== ELEPHANT V2 INSTANCE (Protected Counter Sum) =====

  /**
   * Elephant v2 AEAD Instance
   * Implements Protected Counter Sum MAC mode as per NIST LWC Round 3
   * Based on Bouncy Castle ElephantEngine reference implementation
   */
  class ElephantInstance extends IAeadInstance {
    constructor(algorithm, variant) {
      super(algorithm);
      this.variant = variant;
      this._key = null;
      this._nonce = null;
      this._associatedData = [];
      this.inputBuffer = [];
      this.nbIts = 0;
      this.adOff = 0;
      this.aadState = 'INIT';

      // Variant-specific configuration
      if (variant === 'dumbo') {
        this.blockSize = 20;
        this.macSize = 8;
        this.permute = spongent160Permute;
        this.lfsrStep = dumboLFSR;
      } else if (variant === 'jumbo') {
        this.blockSize = 22;
        this.macSize = 8;
        this.permute = spongent176Permute;
        this.lfsrStep = jumboLFSR;
      } else if (variant === 'delirium') {
        this.blockSize = 25;
        this.macSize = 16;
        this.permute = keccakP200Permute;
        this.lfsrStep = deliriumLFSR;
      }

      // v2 three-mask system for protected counter sum
      this.previousMask = new Array(this.blockSize);
      this.currentMask = new Array(this.blockSize);
      this.nextMask = new Array(this.blockSize);
      this.buffer = new Array(this.blockSize);
      this.tagBuffer = new Array(this.blockSize);
      this.previousOutputMessage = new Array(this.blockSize);
      this.expandedKey = new Array(this.blockSize);

      // Initialize arrays to zero
      for (var i = 0; i < this.blockSize; ++i) {
        this.previousMask[i] = 0;
        this.currentMask[i] = 0;
        this.nextMask[i] = 0;
        this.buffer[i] = 0;
        this.tagBuffer[i] = 0;
        this.previousOutputMessage[i] = 0;
        this.expandedKey[i] = 0;
      }
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }
      if (!Array.isArray(keyBytes) || keyBytes.length !== 16) {
        throw new Error('Invalid key size: ' + (keyBytes ? keyBytes.length : 0) + ' bytes (expected 16)');
      }
      this._key = [...keyBytes];
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }
      if (!Array.isArray(nonceBytes) || nonceBytes.length !== 12) {
        throw new Error('Invalid nonce size: ' + (nonceBytes ? nonceBytes.length : 0) + ' bytes (expected 12)');
      }
      this._nonce = [...nonceBytes];
    }

    get nonce() {
      return this._nonce ? [...this._nonce] : null;
    }

    set associatedData(adBytes) {
      this._associatedData = adBytes ? [...adBytes] : [];
    }

    get associatedData() {
      return [...this._associatedData];
    }

    /**
     * Helper: XOR two arrays into a third array
     * z[i] ^= x[i] ^ y[i]
     */
    xorTo(len, x, y, z) {
      for (var i = 0; i < len; ++i) {
        z[i] = (z[i] ^ x[i] ^ y[i]) & 0xFF;
      }
    }

    /**
     * Helper: XOR array into destination
     * dest[i] ^= src[i]
     */
    xorArray(len, src, dest) {
      for (var i = 0; i < len; ++i) {
        dest[i] = (dest[i] ^ src[i]) & 0xFF;
      }
    }

    /**
     * LFSR step: compute next_mask from current_mask
     * Uses variant-specific feedback polynomial
     * The LFSR function performs complete operation (shift + feedback)
     */
    lfsrStepMask() {
      // The LFSR function does the complete operation
      this.lfsrStep(this.nextMask, this.currentMask);
    }

    /**
     * Swap mask buffers (cyclically shift)
     * previous <- current <- next <- previous
     */
    swapMasks() {
      var temp = this.previousMask;
      this.previousMask = this.currentMask;
      this.currentMask = this.nextMask;
      this.nextMask = temp;
    }

    /**
     * Compute cipher block (v2 algorithm)
     * buffer = nonce || 0...
     * buffer ^= (current_mask XOR next_mask)
     * buffer = permute(buffer)
     * buffer ^= (current_mask XOR next_mask)
     * buffer ^= input
     */
    computeCipherBlock(input, inOff, blockSize, output, outOff) {
      // Initialize buffer with nonce
      for (var i = 0; i < 12; ++i) {
        this.buffer[i] = this._nonce[i];
      }
      for (var i = 12; i < this.blockSize; ++i) {
        this.buffer[i] = 0;
      }

      // buffer ^= (current_mask XOR next_mask)
      this.xorTo(this.blockSize, this.currentMask, this.nextMask, this.buffer);

      // Permute
      this.permute(this.buffer);

      // buffer ^= (current_mask XOR next_mask)
      this.xorTo(this.blockSize, this.currentMask, this.nextMask, this.buffer);

      // buffer ^= input
      for (var i = 0; i < blockSize; ++i) {
        this.buffer[i] = (this.buffer[i] ^ input[inOff + i]) & 0xFF;
      }

      // Copy to output
      for (var i = 0; i < blockSize; ++i) {
        output[outOff + i] = this.buffer[i];
      }
    }

    /**
     * Process AAD bytes into buffer
     * State machine: INIT -> AAD -> DATA
     */
    processAADBytes(output) {
      var len = 0;

      // State: INIT - first call
      if (this.aadState === 'INIT') {
        // Initialize current_mask from expanded key
        for (var i = 0; i < this.blockSize; ++i) {
          this.currentMask[i] = this.expandedKey[i];
        }
        // Copy nonce to output
        for (var i = 0; i < 12; ++i) {
          output[i] = this._nonce[i];
        }
        len = 12;
        this.aadState = 'AAD';
      } else if (this.aadState === 'AAD') {
        // State: AAD - processing associated data
        // If adlen is divisible by blockSize, add padding block
        if (this.adOff === this._associatedData.length) {
          for (var i = 0; i < this.blockSize; ++i) {
            output[i] = 0;
          }
          output[0] = 0x01;
          return;
        }
      }

      var rOutlen = this.blockSize - len;
      var rAdlen = this._associatedData.length - this.adOff;

      // Fill with associated data if available
      if (rOutlen <= rAdlen) {
        // Enough AD
        for (var i = 0; i < rOutlen; ++i) {
          output[len + i] = this._associatedData[this.adOff + i];
        }
        this.adOff += rOutlen;
      } else {
        // Not enough AD, need to pad
        if (rAdlen > 0) {
          for (var i = 0; i < rAdlen; ++i) {
            output[len + i] = this._associatedData[this.adOff + i];
          }
          this.adOff += rAdlen;
        }
        for (var i = len + rAdlen; i < len + rOutlen; ++i) {
          output[i] = 0;
        }
        output[len + rAdlen] = 0x01;
        this.aadState = 'DATA';
      }
    }

    /**
     * Absorb AAD block into tag
     */
    absorbAAD() {
      this.processAADBytes(this.buffer);
      this.xorArray(this.blockSize, this.nextMask, this.buffer);
      this.permute(this.buffer);
      this.xorArray(this.blockSize, this.nextMask, this.buffer);
      this.xorArray(this.blockSize, this.buffer, this.tagBuffer);
    }

    /**
     * Absorb ciphertext block into tag
     * IMPORTANT: buffer must already be filled with ciphertext block before calling!
     */
    absorbCiphertext() {
      this.xorTo(this.blockSize, this.previousMask, this.nextMask, this.buffer);
      this.permute(this.buffer);
      this.xorTo(this.blockSize, this.previousMask, this.nextMask, this.buffer);
      this.xorArray(this.blockSize, this.buffer, this.tagBuffer);
    }

    /**
     * Process complete message bytes (interleaved AD, plaintext, ciphertext)
     */
    processBytes(m, output, outOff, nbIt, nblocksM, nblocksC, mlen, nblocksAd) {
      var rv = 0;
      var outputMessage = new Array(this.blockSize);

      for (var i = this.nbIts; i < nbIt; ++i) {
        var rSize = (i === nblocksM - 1) ? mlen - i * this.blockSize : this.blockSize;

        // Compute mask for next message
        this.lfsrStepMask();

        if (i < nblocksM) {
          // Compute ciphertext block
          this.computeCipherBlock(m, rv, rSize, output, outOff);

          if (!this.isInverse) {
            // Encryption: save ciphertext
            for (var j = 0; j < rSize; ++j) {
              outputMessage[j] = this.buffer[j];
            }
          } else {
            // Decryption: save ciphertext from input
            for (var j = 0; j < rSize; ++j) {
              outputMessage[j] = m[rv + j];
            }
          }

          outOff += rSize;
          rv += rSize;
        }

        if (i > 0 && i <= nblocksC) {
          // Compute tag for ciphertext block
          var blockOffset = (i - 1) * this.blockSize;

          if (blockOffset === mlen) {
            // Add padding block
            for (var j = 1; j < this.blockSize; ++j) {
              this.buffer[j] = 0;
            }
            this.buffer[0] = 0x01;
          } else {
            var rClen = mlen - blockOffset;
            if (this.blockSize <= rClen) {
              // Enough ciphertext
              for (var j = 0; j < this.blockSize; ++j) {
                this.buffer[j] = this.previousOutputMessage[j];
              }
            } else {
              // Not enough ciphertext, pad
              if (rClen > 0) {
                for (var j = 0; j < rClen; ++j) {
                  this.buffer[j] = this.previousOutputMessage[j];
                }
                for (var j = rClen; j < this.blockSize; ++j) {
                  this.buffer[j] = 0;
                }
                this.buffer[rClen] = 0x01;
              }
            }
          }

          this.absorbCiphertext();
        }

        // Process AD if remaining
        if (i + 1 < nblocksAd) {
          this.absorbAAD();
        }

        // Cyclically shift masks
        this.swapMasks();

        for (var j = 0; j < this.blockSize; ++j) {
          this.previousOutputMessage[j] = outputMessage[j];
        }
      }

      this.nbIts = i;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error('Invalid input data - must be byte array');
      }
      if (!this._key) throw new Error('Key not set');
      if (!this._nonce) throw new Error('Nonce not set');

      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error('Key not set');
      if (!this._nonce) throw new Error('Nonce not set');

      // Initialize expanded key: expandedKey = permute(key || 0...)
      for (var i = 0; i < 16; ++i) {
        this.expandedKey[i] = this._key[i];
      }
      for (var i = 16; i < this.blockSize; ++i) {
        this.expandedKey[i] = 0;
      }
      this.permute(this.expandedKey);

      // Initialize tag buffer to zero
      for (var i = 0; i < this.blockSize; ++i) {
        this.tagBuffer[i] = 0;
      }

      // Reset iteration counter, AD offset, and state
      this.nbIts = 0;
      this.adOff = 0;
      this.aadState = 'INIT';

      var mlen = this.isInverse ? this.inputBuffer.length - this.macSize : this.inputBuffer.length;
      var nblocksC = 1 + Math.floor(mlen / this.blockSize);
      var nblocksM = (mlen % this.blockSize) !== 0 ? nblocksC : nblocksC - 1;
      var nblocksAd = 1 + Math.floor((12 + this._associatedData.length) / this.blockSize);
      var nbIt = Math.max(nblocksC + 1, nblocksAd - 1);

      // Process initial AAD block (nonce + start of AD) similar to processFinalAAD()
      // This initializes current_mask and fills tag_buffer (NOT buffer) with nonce+AD directly
      // This is NOT absorbed - it's the base that ciphertext blocks are XORed into
      if (this.aadState === 'INIT') {
        this.processAADBytes(this.tagBuffer);
      }

      var output = new Array(mlen);
      this.processBytes(this.inputBuffer, output, 0, nbIt, nblocksM, nblocksC, mlen, nblocksAd);

      // Finalize tag: tag = permute(tag XOR expandedKey) XOR expandedKey
      this.xorArray(this.blockSize, this.expandedKey, this.tagBuffer);
      this.permute(this.tagBuffer);
      this.xorArray(this.blockSize, this.expandedKey, this.tagBuffer);

      var result;
      if (!this.isInverse) {
        // Encryption: append tag
        result = new Array(mlen + this.macSize);
        for (var i = 0; i < mlen; ++i) {
          result[i] = output[i];
        }
        for (var i = 0; i < this.macSize; ++i) {
          result[mlen + i] = this.tagBuffer[i];
        }
      } else {
        // Decryption: verify tag
        var receivedTag = this.inputBuffer.slice(mlen);
        var tagMatch = true;
        for (var i = 0; i < this.macSize; ++i) {
          if (this.tagBuffer[i] !== receivedTag[i]) {
            tagMatch = false;
          }
        }
        if (!tagMatch) {
          throw new Error('Authentication tag verification failed');
        }
        result = output;
      }

      this.inputBuffer = [];
      return result;
    }
  }

  // ===== ALGORITHM CLASSES =====

  class DumboAlgorithm extends AeadAlgorithm {
    constructor() {
      super();
      this.name = "Elephant-Dumbo";
      this.description = "Elephant AEAD variant using Spongent-π[160] permutation with 80 rounds. NIST Lightweight Cryptography finalist designed for constrained environments.";
      this.inventor = "Tim Beyne, Yu Long Chen, Christoph Dobraunig, Bart Mennink";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BE;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];
      this.SupportedTagSizes = [new KeySize(8, 8, 0)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem("Elephant Official Site", "https://www.esat.kuleuven.be/cosic/elephant/"),
        new LinkItem("NIST LWC Finalist Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/elephant-spec-final.pdf")
      ];

      this.knownVulnerabilities = [];

      // NIST LWC test vectors
      this.tests = [
        {
          text: "NIST LWC KAT Vector #1 (empty PT, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("6655B717736ADFF3")
        },
        {
          text: "NIST LWC KAT Vector #2 (empty PT, 1-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("B6925C1C8CA1058E")
        },
        {
          text: "NIST LWC KAT Vector #17 (empty PT, 16-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: [],
          expected: OpCodes.Hex8ToBytes("2BAAC762EF2C63E7")
        },
        {
          text: "NIST LWC KAT Vector #33 (16-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("22877528B93B5B1F8AFEE1957227F87A65C46F73A9FDC4F4")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      var instance = new ElephantInstance(this, 'dumbo');
      instance.isInverse = isInverse;
      return instance;
    }
  }

  class JumboAlgorithm extends AeadAlgorithm {
    constructor() {
      super();
      this.name = "Elephant-Jumbo";
      this.description = "Elephant AEAD variant using Spongent-π[176] permutation with 90 rounds. NIST Lightweight Cryptography finalist offering higher security margin.";
      this.inventor = "Tim Beyne, Yu Long Chen, Christoph Dobraunig, Bart Mennink";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BE;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];
      this.SupportedTagSizes = [new KeySize(8, 8, 0)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem("Elephant Official Site", "https://www.esat.kuleuven.be/cosic/elephant/"),
        new LinkItem("NIST LWC Finalist Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/elephant-spec-final.pdf")
      ];

      this.knownVulnerabilities = [];

      this.tests = [
        {
          text: "NIST LWC KAT Vector #1 (empty PT, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("71D6733193DFF6DA")
        },
        {
          text: "NIST LWC KAT Vector #2 (empty PT, 1-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("E8B4846473BD4F9D")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      var instance = new ElephantInstance(this, 'jumbo');
      instance.isInverse = isInverse;
      return instance;
    }
  }

  class DeliriumAlgorithm extends AeadAlgorithm {
    constructor() {
      super();
      this.name = "Elephant-Delirium";
      this.description = "Elephant AEAD variant using Keccak-p[200] permutation with 18 rounds and 128-bit tag. NIST Lightweight Cryptography finalist with highest security level.";
      this.inventor = "Tim Beyne, Yu Long Chen, Christoph Dobraunig, Bart Mennink";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BE;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];
      this.SupportedTagSizes = [new KeySize(16, 16, 0)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem("Elephant Official Site", "https://www.esat.kuleuven.be/cosic/elephant/"),
        new LinkItem("NIST LWC Finalist Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/elephant-spec-final.pdf")
      ];

      this.knownVulnerabilities = [];

      this.tests = [
        {
          text: "NIST LWC KAT Vector #1 (empty PT, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("26249B5BB264DEF8EA1F17937D6B7847")
        },
        {
          text: "NIST LWC KAT Vector #2 (empty PT, 1-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("D3CF5762E5F852DEFF9DE450FA7EB970")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      var instance = new ElephantInstance(this, 'delirium');
      instance.isInverse = isInverse;
      return instance;
    }
  }

  // Register all three variants
  RegisterAlgorithm(new DumboAlgorithm());
  RegisterAlgorithm(new JumboAlgorithm());
  RegisterAlgorithm(new DeliriumAlgorithm());

  return {
    DumboAlgorithm: DumboAlgorithm,
    JumboAlgorithm: JumboAlgorithm,
    DeliriumAlgorithm: DeliriumAlgorithm
  };
}));
