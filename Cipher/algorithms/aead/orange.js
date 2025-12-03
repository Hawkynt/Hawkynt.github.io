/*
 * ORANGE-Zest AEAD - NIST Lightweight Cryptography Candidate
 * Professional Implementation following NIST LWC specification
 * (c)2006-2025 Hawkynt
 *
 * ORANGE is a family of lightweight authenticated encryption algorithms based on the
 * PHOTON-256 permutation. This file implements ORANGE-Zest, the main AEAD variant.
 *
 * Features:
 * - 128-bit key and nonce
 * - 128-bit authentication tag
 * - PHOTON-256 permutation (32-byte state)
 * - Domain separation for AD and message processing
 * - Efficient keystream generation with rho function
 * - GF(128) multiplication for state updates
 *
 * References:
 * - https://www.isical.ac.in/~lightweight/Orange/
 * - NIST LWC Submission: https://csrc.nist.gov/Projects/lightweight-cryptography
 *
 * This implementation uses the PHOTON-256 permutation with custom ORANGE-specific
 * modes for authenticated encryption with associated data.
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

  // ===== PHOTON-256 PERMUTATION =====
  // Implementation based on bit-sliced approach from reference code

  const D = 8;
  const Dq = 3;
  const Dr = 7;
  const DSquare = 64;
  const ROUND = 12;
  const STATE_INBYTES = 32;
  const PHOTON256_STATE_SIZE = 32;

  // PHOTON permutation round constants
  const photon256_rc = [
    0x96d2f0e1, 0xb4f0d2c3, 0xf0b49687, 0x692d0f1e,
    0x5a1e3c2d, 0x3c785a4b, 0xe1a58796, 0x4b0f2d3c,
    0x1e5a7869, 0xa5e1c3d2, 0xd296b4a5, 0x2d694b5a
  ];

  // PHOTON S-box (4-bit)
  const sbox = [12, 5, 6, 11, 9, 0, 10, 13, 3, 14, 15, 8, 4, 7, 1, 2];

  // MixColumn matrix for PHOTON permutation
  const MixColMatrix = [
    [  2,  4,  2, 11,  2,  8,  5,  6 ],
    [ 12,  9,  8, 13,  7,  7,  5,  2 ],
    [  4,  4, 13, 13,  9,  4, 13,  9 ],
    [  1,  6,  5,  1, 12, 13, 15, 14 ],
    [ 15, 12,  9, 13, 14,  5, 14, 13 ],
    [  9, 14,  5, 15,  4, 12,  9,  6 ],
    [ 12,  2,  2, 10,  3,  1,  1, 14 ],
    [ 15,  1, 13, 10,  5, 10,  2,  3 ]
  ];

  // Bit permutation helper
  function bitPermuteStep(y, mask, shift) {
    const t = OpCodes.AndN(OpCodes.XorN(OpCodes.Shr32(y, shift), y), mask);
    return OpCodes.XorN(OpCodes.XorN(y, t), OpCodes.Shl32(t, shift));
  }

  // Convert to bit-sliced form
  function photon256ToSliced(out, input) {
    let t0, t1, t2, t3;

    // Load and convert first 16 bytes
    t0 = OpCodes.Unpack32LE(input.slice(0, 4));
    t1 = OpCodes.Unpack32LE(input.slice(4, 8));
    t2 = OpCodes.Unpack32LE(input.slice(8, 12));
    t3 = OpCodes.Unpack32LE(input.slice(12, 16));

    // Bit permutation for slicing
    t0 = bitPermuteStep(t0, 0x0a0a0a0a, 3);
    t0 = bitPermuteStep(t0, 0x00cc00cc, 6);
    t0 = bitPermuteStep(t0, 0x0000f0f0, 12);
    t0 = bitPermuteStep(t0, 0x0000ff00, 8);

    t1 = bitPermuteStep(t1, 0x0a0a0a0a, 3);
    t1 = bitPermuteStep(t1, 0x00cc00cc, 6);
    t1 = bitPermuteStep(t1, 0x0000f0f0, 12);
    t1 = bitPermuteStep(t1, 0x0000ff00, 8);

    t2 = bitPermuteStep(t2, 0x0a0a0a0a, 3);
    t2 = bitPermuteStep(t2, 0x00cc00cc, 6);
    t2 = bitPermuteStep(t2, 0x0000f0f0, 12);
    t2 = bitPermuteStep(t2, 0x0000ff00, 8);

    t3 = bitPermuteStep(t3, 0x0a0a0a0a, 3);
    t3 = bitPermuteStep(t3, 0x00cc00cc, 6);
    t3 = bitPermuteStep(t3, 0x0000f0f0, 12);
    t3 = bitPermuteStep(t3, 0x0000ff00, 8);

    out[0] = (t0 & 0x000000FF) | ((t1 << 8) & 0x0000FF00) |
             ((t2 << 16) & 0x00FF0000) | ((t3 << 24) & 0xFF000000);
    out[1] = ((t0 >>> 8) & 0x000000FF) | (t1 & 0x0000FF00) |
             ((t2 << 8) & 0x00FF0000) | ((t3 << 16) & 0xFF000000);
    out[2] = ((t0 >>> 16) & 0x000000FF) | ((t1 >>> 8) & 0x0000FF00) |
             (t2 & 0x00FF0000) | ((t3 << 8) & 0xFF000000);
    out[3] = ((t0 >>> 24) & 0x000000FF) | ((t1 >>> 16) & 0x0000FF00) |
             ((t2 >>> 8) & 0x00FF0000) | (t3 & 0xFF000000);

    // Load and convert second 16 bytes
    t0 = OpCodes.Unpack32LE(input.slice(16, 20));
    t1 = OpCodes.Unpack32LE(input.slice(20, 24));
    t2 = OpCodes.Unpack32LE(input.slice(24, 28));
    t3 = OpCodes.Unpack32LE(input.slice(28, 32));

    t0 = bitPermuteStep(t0, 0x0a0a0a0a, 3);
    t0 = bitPermuteStep(t0, 0x00cc00cc, 6);
    t0 = bitPermuteStep(t0, 0x0000f0f0, 12);
    t0 = bitPermuteStep(t0, 0x0000ff00, 8);

    t1 = bitPermuteStep(t1, 0x0a0a0a0a, 3);
    t1 = bitPermuteStep(t1, 0x00cc00cc, 6);
    t1 = bitPermuteStep(t1, 0x0000f0f0, 12);
    t1 = bitPermuteStep(t1, 0x0000ff00, 8);

    t2 = bitPermuteStep(t2, 0x0a0a0a0a, 3);
    t2 = bitPermuteStep(t2, 0x00cc00cc, 6);
    t2 = bitPermuteStep(t2, 0x0000f0f0, 12);
    t2 = bitPermuteStep(t2, 0x0000ff00, 8);

    t3 = bitPermuteStep(t3, 0x0a0a0a0a, 3);
    t3 = bitPermuteStep(t3, 0x00cc00cc, 6);
    t3 = bitPermuteStep(t3, 0x0000f0f0, 12);
    t3 = bitPermuteStep(t3, 0x0000ff00, 8);

    out[4] = (t0 & 0x000000FF) | ((t1 << 8) & 0x0000FF00) |
             ((t2 << 16) & 0x00FF0000) | ((t3 << 24) & 0xFF000000);
    out[5] = ((t0 >>> 8) & 0x000000FF) | (t1 & 0x0000FF00) |
             ((t2 << 8) & 0x00FF0000) | ((t3 << 16) & 0xFF000000);
    out[6] = ((t0 >>> 16) & 0x000000FF) | ((t1 >>> 8) & 0x0000FF00) |
             (t2 & 0x00FF0000) | ((t3 << 8) & 0xFF000000);
    out[7] = ((t0 >>> 24) & 0x000000FF) | ((t1 >>> 16) & 0x0000FF00) |
             ((t2 >>> 8) & 0x00FF0000) | (t3 & 0xFF000000);
  }

  // Convert from bit-sliced form
  function photon256FromSliced(out, input) {
    // Input is a byte array, need to extract nibbles properly
    const tempBytes = new Uint8Array(input);

    // First 16 bytes
    let x0 = ((tempBytes[0] & 0xFF)) |
             ((tempBytes[4] & 0xFF) << 8) |
             ((tempBytes[8] & 0xFF) << 16) |
             ((tempBytes[12] & 0xFF) << 24);
    let x1 = ((tempBytes[1] & 0xFF)) |
             ((tempBytes[5] & 0xFF) << 8) |
             ((tempBytes[9] & 0xFF) << 16) |
             ((tempBytes[13] & 0xFF) << 24);
    let x2 = ((tempBytes[2] & 0xFF)) |
             ((tempBytes[6] & 0xFF) << 8) |
             ((tempBytes[10] & 0xFF) << 16) |
             ((tempBytes[14] & 0xFF) << 24);
    let x3 = ((tempBytes[3] & 0xFF)) |
             ((tempBytes[7] & 0xFF) << 8) |
             ((tempBytes[11] & 0xFF) << 16) |
             ((tempBytes[15] & 0xFF) << 24);

    x0 = bitPermuteStep(x0, 0x00aa00aa, 7);
    x0 = bitPermuteStep(x0, 0x0000cccc, 14);
    x0 = bitPermuteStep(x0, 0x00f000f0, 4);
    x0 = bitPermuteStep(x0, 0x0000ff00, 8);

    x1 = bitPermuteStep(x1, 0x00aa00aa, 7);
    x1 = bitPermuteStep(x1, 0x0000cccc, 14);
    x1 = bitPermuteStep(x1, 0x00f000f0, 4);
    x1 = bitPermuteStep(x1, 0x0000ff00, 8);

    x2 = bitPermuteStep(x2, 0x00aa00aa, 7);
    x2 = bitPermuteStep(x2, 0x0000cccc, 14);
    x2 = bitPermuteStep(x2, 0x00f000f0, 4);
    x2 = bitPermuteStep(x2, 0x0000ff00, 8);

    x3 = bitPermuteStep(x3, 0x00aa00aa, 7);
    x3 = bitPermuteStep(x3, 0x0000cccc, 14);
    x3 = bitPermuteStep(x3, 0x00f000f0, 4);
    x3 = bitPermuteStep(x3, 0x0000ff00, 8);

    out.set(OpCodes.Pack32LE(x0), 0);
    out.set(OpCodes.Pack32LE(x1), 4);
    out.set(OpCodes.Pack32LE(x2), 8);
    out.set(OpCodes.Pack32LE(x3), 12);

    // Second 16 bytes
    x0 = ((input[16] & 0xFF)) |
         ((input[20] & 0xFF) << 8) |
         ((input[24] & 0xFF) << 16) |
         ((input[28] & 0xFF) << 24);
    x1 = ((input[17] & 0xFF)) |
         ((input[21] & 0xFF) << 8) |
         ((input[25] & 0xFF) << 16) |
         ((input[29] & 0xFF) << 24);
    x2 = ((input[18] & 0xFF)) |
         ((input[22] & 0xFF) << 8) |
         ((input[26] & 0xFF) << 16) |
         ((input[30] & 0xFF) << 24);
    x3 = ((input[19] & 0xFF)) |
         ((input[23] & 0xFF) << 8) |
         ((input[27] & 0xFF) << 16) |
         ((input[31] & 0xFF) << 24);

    x0 = bitPermuteStep(x0, 0x00aa00aa, 7);
    x0 = bitPermuteStep(x0, 0x0000cccc, 14);
    x0 = bitPermuteStep(x0, 0x00f000f0, 4);
    x0 = bitPermuteStep(x0, 0x0000ff00, 8);

    x1 = bitPermuteStep(x1, 0x00aa00aa, 7);
    x1 = bitPermuteStep(x1, 0x0000cccc, 14);
    x1 = bitPermuteStep(x1, 0x00f000f0, 4);
    x1 = bitPermuteStep(x1, 0x0000ff00, 8);

    x2 = bitPermuteStep(x2, 0x00aa00aa, 7);
    x2 = bitPermuteStep(x2, 0x0000cccc, 14);
    x2 = bitPermuteStep(x2, 0x00f000f0, 4);
    x2 = bitPermuteStep(x2, 0x0000ff00, 8);

    x3 = bitPermuteStep(x3, 0x00aa00aa, 7);
    x3 = bitPermuteStep(x3, 0x0000cccc, 14);
    x3 = bitPermuteStep(x3, 0x00f000f0, 4);
    x3 = bitPermuteStep(x3, 0x0000ff00, 8);

    out.set(OpCodes.Pack32LE(x0), 16);
    out.set(OpCodes.Pack32LE(x1), 20);
    out.set(OpCodes.Pack32LE(x2), 24);
    out.set(OpCodes.Pack32LE(x3), 28);
  }

  // GF(16) field multiplication
  function photon256FieldMultiply(a, x) {
    let result = 0;
    let t;

    if (a & 1) result ^= x;
    t = x >>> 24;
    x = ((x << 8) ^ t ^ (t << 8)) >>> 0;

    if (a & 2) result ^= x;
    t = x >>> 24;
    x = ((x << 8) ^ t ^ (t << 8)) >>> 0;

    if (a & 4) result ^= x;
    t = x >>> 24;
    x = ((x << 8) ^ t ^ (t << 8)) >>> 0;

    if (a & 8) result ^= x;

    return result >>> 0;
  }

  // Read row from bit-sliced state (little-endian)
  function readRow(bytes, row) {
    if (row < 4) {
      return ((bytes[row]) |
              (bytes[row + 4] << 8) |
              (bytes[row + 8] << 16) |
              (bytes[row + 12] << 24)) >>> 0;
    } else {
      return ((bytes[row + 12]) |
              (bytes[row + 16] << 8) |
              (bytes[row + 20] << 16) |
              (bytes[row + 24] << 24)) >>> 0;
    }
  }

  // Write row to bit-sliced state (little-endian)
  function writeRow(bytes, row, value) {
    if (row < 4) {
      bytes[row] = value & 0xFF;
      bytes[row + 4] = (value >>> 8) & 0xFF;
      bytes[row + 8] = (value >>> 16) & 0xFF;
      bytes[row + 12] = (value >>> 24) & 0xFF;
    } else {
      bytes[row + 12] = value & 0xFF;
      bytes[row + 16] = (value >>> 8) & 0xFF;
      bytes[row + 20] = (value >>> 16) & 0xFF;
      bytes[row + 24] = (value >>> 24) & 0xFF;
    }
  }

  // PHOTON-256 S-box in bit-sliced form
  function photon256SboxBitsliced(words) {
    let t1, t2;

    // Apply S-box transformation
    words[1] ^= words[2];
    words[3] ^= (words[2] & words[1]);
    t1 = words[3];
    words[3] = (words[3] & words[1]) ^ words[2];
    t2 = words[3];
    words[3] ^= words[0];
    words[3] = (~words[3]) >>> 0;
    words[2] = words[3];
    t2 |= words[0];
    words[0] ^= t1;
    words[1] ^= words[0];
    words[2] |= words[1];
    words[2] ^= t1;
    words[1] ^= t2;
    words[3] ^= words[1];
  }

  // PHOTON-256 permutation - simplified nibble-based approach
  function photon256Permute(state) {
    // Convert byte array to 2D nibble array (8x8)
    const state2d = new Array(8);
    for (let i = 0; i < 8; ++i) {
      state2d[i] = new Array(8);
    }

    for (let i = 0; i < 64; ++i) {
      state2d[i >>> 3][i & 7] = ((state[i >>> 1] & 0xFF) >>> (4 * (i & 1))) & 0xf;
    }

    // 12 rounds of PHOTON permutation
    const RC_constants = [
       1,  0,  2,  6, 14, 15, 13,  9,
       3,  2,  0,  4, 12, 13, 15, 11,
       7,  6,  4,  0,  8,  9, 11, 15,
      14, 15, 13,  9,  1,  0,  2,  6,
      13, 12, 14, 10,  2,  3,  1,  5,
      11, 10,  8, 12,  4,  5,  7,  3,
       6,  7,  5,  1,  9,  8, 10, 14,
      12, 13, 15, 11,  3,  2,  0,  4,
       9,  8, 10, 14,  6,  7,  5,  1,
       2,  3,  1,  5, 13, 12, 14, 10,
       5,  4,  6,  2, 10, 11,  9, 13,
      10, 11,  9, 13,  5,  4,  6,  2
    ];

    for (let round = 0; round < ROUND; ++round) {
      // AddConstant
      const rcOffset = round * 8;
      for (let i = 0; i < 8; ++i) {
        state2d[i][0] = OpCodes.XorN(state2d[i][0], RC_constants[rcOffset + i]);
      }

      // SubCells (S-box layer)
      for (let i = 0; i < 8; ++i) {
        for (let j = 0; j < 8; ++j) {
          state2d[i][j] = sbox[state2d[i][j]];
        }
      }

      // ShiftRows
      for (let i = 1; i < 8; ++i) {
        const temp = new Array(8);
        for (let j = 0; j < 8; ++j) {
          temp[j] = state2d[i][j];
        }
        for (let j = 0; j < 8; ++j) {
          state2d[i][j] = temp[(j + i) % 8];
        }
      }

      // MixColumnSerial
      const tempCol = new Array(8);
      for (let j = 0; j < 8; ++j) {
        for (let i = 0; i < 8; ++i) {
          let sum = 0;
          for (let k = 0; k < 8; ++k) {
            const x = MixColMatrix[i][k];
            const b = state2d[k][j];

            // GF(16) multiplication
            sum = OpCodes.XorN(sum, x * OpCodes.AndN(b, 1));
            sum = OpCodes.XorN(sum, x * OpCodes.AndN(b, 2));
            sum = OpCodes.XorN(sum, x * OpCodes.AndN(b, 4));
            sum = OpCodes.XorN(sum, x * OpCodes.AndN(b, 8));
          }

          // Reduction modulo x^4 + x + 1
          let t0 = OpCodes.Shr32(sum, 4);
          sum = OpCodes.XorN(OpCodes.XorN(OpCodes.AndN(sum, 15), t0), OpCodes.Shl32(t0, 1));

          let t1 = OpCodes.Shr32(sum, 4);
          sum = OpCodes.XorN(OpCodes.XorN(OpCodes.AndN(sum, 15), t1), OpCodes.Shl32(t1, 1));

          tempCol[i] = OpCodes.AndN(sum, 0xf);
        }
        for (let i = 0; i < 8; ++i) {
          state2d[i][j] = tempCol[i];
        }
      }
    }

    // Convert 2D nibble array back to byte array
    for (let i = 0; i < 64; i += 2) {
      state[OpCodes.Shr32(i, 1)] = OpCodes.OrN(OpCodes.AndN(state2d[OpCodes.Shr32(i, 3)][OpCodes.AndN(i, 7)], 0xf), OpCodes.Shl32(OpCodes.AndN(state2d[OpCodes.Shr32(i, 3)][OpCodes.AndN(i + 1, 7)], 0xf), 4));
    }
  }

  // ===== ORANGE HELPER FUNCTIONS =====

  // Doubles a block in GF(128) field
  function orangeBlockDouble(block, value) {
    for (let v = 0; v < value; ++v) {
      const mask = (OpCodes.AndN(block[15], 0x80) !== 0) ? 0x87 : 0x00;
      for (let i = 15; i > 0; --i) {
        block[i] = OpCodes.OrN(OpCodes.Shl32(block[i], 1), OpCodes.Shr32(block[i - 1], 7));
      }
      block[0] = OpCodes.XorN(OpCodes.Shl32(block[0], 1), mask);
    }
  }

  // Rotates a block left by 1 bit
  function orangeBlockRotate(out, input) {
    for (let i = 15; i > 0; --i) {
      out[i] = OpCodes.OrN(OpCodes.Shl32(input[i], 1), OpCodes.Shr32(input[i - 1], 7));
    }
    out[0] = OpCodes.OrN(OpCodes.Shl32(input[0], 1), OpCodes.Shr32(input[15], 7));
  }

  // ORANGE rho function
  function orangeRho(KS, S, state) {
    orangeBlockDouble(S, 1);
    orangeBlockRotate(KS.subarray(0, 16), state.subarray(0, 16));
    for (let i = 0; i < 16; ++i) {
      KS[16 + i] = OpCodes.XorN(state[16 + i], S[i]);
    }
    S.set(state.subarray(16, 32));
  }

  // ===== ORANGE-ZEST AEAD ALGORITHM =====

  class OrangeZestAlgorithm extends AeadAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ORANGE-Zest";
      this.description = "NIST Lightweight Cryptography candidate using PHOTON-256 permutation with efficient keystream generation and GF(128) operations for authenticated encryption.";
      this.inventor = "Zhenzhen Bao, Avik Chakraborti, Nilanjan Datta, Jian Guo, Mridul Nandi, Thomas Peyrin, Kan Yasuda";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.INTL;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0)  // 128-bit key only
      ];
      this.SupportedTagSizes = [
        new KeySize(16, 16, 0)  // 128-bit tag only
      ];
      this.SupportsDetached = false;

      // Documentation
      this.documentation = [
        new LinkItem(
          "ORANGE Official Website",
          "https://www.isical.ac.in/~lightweight/Orange/"
        ),
        new LinkItem(
          "NIST LWC Project Page",
          "https://csrc.nist.gov/Projects/lightweight-cryptography"
        ),
        new LinkItem(
          "ORANGE Specification",
          "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/orange-spec-round2.pdf"
        )
      ];

      // Test vectors from NIST KAT file
      this.tests = [
        {
          text: "NIST KAT Vector #1 - Empty PT and AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("F315BF7B2779EF4B99F8CC33B7155755")
        },
        {
          text: "NIST KAT Vector #2 - Empty PT, 1-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("3E23CE190D4C8FCA425D39A3776341B2")
        },
        {
          text: "NIST KAT Vector #5 - Empty PT, 4-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00010203"),
          input: [],
          expected: OpCodes.Hex8ToBytes("AB63B2ADE8E854BCB72DBE00A29EBBC6")
        },
        {
          text: "NIST KAT Vector #34 - 1-byte PT, empty AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("BC3791431F6A798A76AE57A5177D909210")
        },
        {
          text: "NIST KAT Vector #35 - 1-byte PT, 1-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("CBA400078FAC89A39288303677E5A08984")
        },
        {
          text: "NIST KAT Vector #38 - 1-byte PT, 4-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00010203"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("4ED50A9171537DAAD559B399342FDCE743")
        }
      ];
    }

    CreateInstance(isInverse) {
      if (isInverse === false) {
        return new OrangeZestInstance(this, false);
      }
      if (isInverse === true) {
        return new OrangeZestInstance(this, true);
      }
      return new OrangeZestInstance(this, false);
    }
  }

  // ===== ORANGE-ZEST INSTANCE =====

  /**
 * OrangeZest cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class OrangeZestInstance extends IAeadInstance {
    constructor(algorithm, isInverse) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._nonce = null;
      this._plaintext = [];
      this._associatedData = [];
      this._ciphertext = [];
    }

    // Property setters with validation
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

      if (keyBytes.length !== 16) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes (must be 16)");
      }

      this._key = new Uint8Array(keyBytes);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? Array.from(this._key) : null;
    }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (nonceBytes.length !== 16) {
        throw new Error("Invalid nonce size: " + nonceBytes.length + " bytes (must be 16)");
      }

      this._nonce = new Uint8Array(nonceBytes);
    }

    get nonce() {
      return this._nonce ? Array.from(this._nonce) : null;
    }

    set plaintext(data) {
      if (!data) {
        this._plaintext = [];
        return;
      }
      this._plaintext = Array.isArray(data) ? data : Array.from(data);
    }

    get plaintext() {
      return this._plaintext.slice();
    }

    set associatedData(data) {
      if (!data) {
        this._associatedData = [];
        return;
      }
      this._associatedData = Array.isArray(data) ? data : Array.from(data);
    }

    get associatedData() {
      return this._associatedData.slice();
    }

    set ciphertext(data) {
      if (!data) {
        this._ciphertext = [];
        return;
      }
      this._ciphertext = Array.isArray(data) ? data : Array.from(data);
    }

    get ciphertext() {
      return this._ciphertext.slice();
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      if (this.isInverse) {
        this._ciphertext.push(...data);
      } else {
        this._plaintext.push(...data);
      }
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
      if (!this._nonce) {
        throw new Error("Nonce not set");
      }

      if (this.isInverse) {
        return this._decrypt();
      } else {
        return this._encrypt();
      }
    }

    _encrypt() {
      const state = new Uint8Array(32);
      const mlen = this._plaintext.length;
      const adlen = this._associatedData.length;
      const output = new Uint8Array(mlen + 16);

      // Initialize state with nonce and key
      state.set(this._nonce, 0);
      state.set(this._key, 16);

      // Handle associated data and message payload
      if (adlen === 0) {
        if (mlen === 0) {
          // Empty message and AD
          state[16] = OpCodes.XorN(state[16], 2);
          photon256Permute(state);
          output.set(state.subarray(0, 16), mlen);
        } else {
          // Message only
          state[16] = OpCodes.XorN(state[16], 1);
          this._orangeEncrypt(state, this._key, output, this._plaintext, mlen);
          this._orangeGenerateTag(state);
          output.set(state.subarray(0, 16), mlen);
        }
      } else {
        // Process associated data
        this._orangeProcessHash(state, this._associatedData, adlen, 1, 2);
        if (mlen !== 0) {
          this._orangeEncrypt(state, this._key, output, this._plaintext, mlen);
        }
        this._orangeGenerateTag(state);
        output.set(state.subarray(0, 16), mlen);
      }

      return Array.from(output);
    }

    _decrypt() {
      const clen = this._ciphertext.length;
      if (clen < 16) {
        throw new Error("Ciphertext too short (must include 16-byte tag)");
      }

      const state = new Uint8Array(32);
      const mlen = clen - 16;
      const adlen = this._associatedData.length;
      const output = new Uint8Array(mlen);

      // Initialize state with nonce and key
      state.set(this._nonce, 0);
      state.set(this._key, 16);

      // Handle associated data and message payload
      if (adlen === 0) {
        if (mlen === 0) {
          // Empty message and AD
          state[16] = OpCodes.XorN(state[16], 2);
          photon256Permute(state);
        } else {
          // Message only
          state[16] = OpCodes.XorN(state[16], 1);
          this._orangeDecrypt(state, this._key, output, this._ciphertext, mlen);
        }
      } else {
        // Process associated data
        this._orangeProcessHash(state, this._associatedData, adlen, 1, 2);
        if (mlen !== 0) {
          this._orangeDecrypt(state, this._key, output, this._ciphertext, mlen);
        }
      }

      // Verify authentication tag
      this._orangeGenerateTag(state);
      const computedTag = state.subarray(0, 16);
      const receivedTag = this._ciphertext.slice(mlen, mlen + 16);

      for (let i = 0; i < 16; ++i) {
        if (computedTag[i] !== receivedTag[i]) {
          throw new Error("Authentication tag verification failed");
        }
      }

      return Array.from(output);
    }

    _orangeProcessHash(state, data, len, domain0, domain1) {
      let offset = 0;
      while (len > 32) {
        photon256Permute(state);
        for (let i = 0; i < 32; ++i) {
          state[i] = OpCodes.XorN(state[i], data[offset + i]);
        }
        offset += 32;
        len -= 32;
      }

      photon256Permute(state);
      if (len < 32) {
        const stateSecondHalf = state.subarray(16, 32);
        orangeBlockDouble(stateSecondHalf, domain1);
        state[len] = OpCodes.XorN(state[len], 0x01);
      } else {
        const stateSecondHalf = state.subarray(16, 32);
        orangeBlockDouble(stateSecondHalf, domain0);
      }

      for (let i = 0; i < len; ++i) {
        state[i] = OpCodes.XorN(state[i], data[offset + i]);
      }
    }

    _orangeEncrypt(state, k, c, m, len) {
      const S = new Uint8Array(16);
      const KS = new Uint8Array(32);
      S.set(k);

      let offset = 0;
      while (len > 32) {
        photon256Permute(state);
        orangeRho(KS, S, state);
        for (let i = 0; i < 32; ++i) {
          c[offset + i] = OpCodes.XorN(m[offset + i], KS[i]);
          state[i] = OpCodes.XorN(state[i], c[offset + i]);
        }
        offset += 32;
        len -= 32;
      }

      photon256Permute(state);
      if (len < 32) {
        const stateSecondHalf = state.subarray(16, 32);
        orangeBlockDouble(stateSecondHalf, 2);
        orangeRho(KS, S, state);
        for (let i = 0; i < len; ++i) {
          c[offset + i] = OpCodes.XorN(m[offset + i], KS[i]);
          state[i] = OpCodes.XorN(state[i], c[offset + i]);
        }
        state[len] = OpCodes.XorN(state[len], 0x01);
      } else {
        const stateSecondHalf = state.subarray(16, 32);
        orangeBlockDouble(stateSecondHalf, 1);
        orangeRho(KS, S, state);
        for (let i = 0; i < 32; ++i) {
          c[offset + i] = OpCodes.XorN(m[offset + i], KS[i]);
          state[i] = OpCodes.XorN(state[i], c[offset + i]);
        }
      }
    }

    _orangeDecrypt(state, k, m, c, len) {
      const S = new Uint8Array(16);
      const KS = new Uint8Array(32);
      S.set(k);

      let offset = 0;
      while (len > 32) {
        photon256Permute(state);
        orangeRho(KS, S, state);
        for (let i = 0; i < 32; ++i) {
          state[i] = OpCodes.XorN(state[i], c[offset + i]);
          m[offset + i] = OpCodes.XorN(c[offset + i], KS[i]);
        }
        offset += 32;
        len -= 32;
      }

      photon256Permute(state);
      if (len < 32) {
        const stateSecondHalf = state.subarray(16, 32);
        orangeBlockDouble(stateSecondHalf, 2);
        orangeRho(KS, S, state);
        for (let i = 0; i < len; ++i) {
          state[i] = OpCodes.XorN(state[i], c[offset + i]);
          m[offset + i] = OpCodes.XorN(c[offset + i], KS[i]);
        }
        state[len] = OpCodes.XorN(state[len], 0x01);
      } else {
        const stateSecondHalf = state.subarray(16, 32);
        orangeBlockDouble(stateSecondHalf, 1);
        orangeRho(KS, S, state);
        for (let i = 0; i < 32; ++i) {
          state[i] = OpCodes.XorN(state[i], c[offset + i]);
          m[offset + i] = OpCodes.XorN(c[offset + i], KS[i]);
        }
      }
    }

    _orangeGenerateTag(state) {
      // Swap two halves of state
      for (let i = 0; i < 16; ++i) {
        const temp = state[i];
        state[i] = state[i + 16];
        state[i + 16] = temp;
      }
      photon256Permute(state);
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new OrangeZestAlgorithm());

  return {
    OrangeZestAlgorithm: OrangeZestAlgorithm,
    OrangeZestInstance: OrangeZestInstance
  };
}));
