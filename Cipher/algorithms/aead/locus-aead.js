/*
 * LOCUS-AEAD - Lightweight Authenticated Encryption
 * AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * LOCUS-AEAD is a 128-bit tag variant of LOTUS-AEAD using the GIFT-COFB
 * construction. It combines the GIFT-64 tweakable block cipher (64-bit blocks,
 * 128-bit keys) with a COFB-like mode for authenticated encryption.
 *
 * Key Features:
 * - 128-bit keys and nonces (16 bytes)
 * - 64-bit block cipher (GIFT-64)
 * - 64-bit authentication tag (8 bytes)
 * - Tweakable block cipher construction
 * - Optimized for lightweight/embedded applications
 * - NIST Lightweight Cryptography submission
 *
 * References:
 * - NIST LWC Submission: LOTUS-AEAD and LOCUS-AEAD
 * - Reference implementation: rweather/lightweight-crypto
 * - https://csrc.nist.gov/Projects/lightweight-cryptography
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

  // ===== GIFT-64 TWEAKABLE BLOCK CIPHER =====

  const GIFT64_BLOCK_SIZE = 8; // 64-bit blocks

  // Round constants for GIFT-64
  const GIFT64_RC = new Uint8Array([
    0x01, 0x03, 0x07, 0x0F, 0x1F, 0x3E, 0x3D, 0x3B,
    0x37, 0x2F, 0x1E, 0x3C, 0x39, 0x33, 0x27, 0x0E,
    0x1D, 0x3A, 0x35, 0x2B, 0x16, 0x2C, 0x18, 0x30,
    0x21, 0x02, 0x05, 0x0B
  ]);

  // Tweak values (expanded 16-bit tweaks for GIFT-64)
  const GIFT64T_TWEAK_0 = 0x0000;
  const GIFT64T_TWEAK_1 = 0xe1e1;
  const GIFT64T_TWEAK_2 = 0xd2d2;
  const GIFT64T_TWEAK_3 = 0x3333;
  const GIFT64T_TWEAK_4 = 0xb4b4;
  const GIFT64T_TWEAK_5 = 0x5555;
  const GIFT64T_TWEAK_6 = 0x6666;
  const GIFT64T_TWEAK_12 = 0xcccc;
  const GIFT64T_TWEAK_13 = 0x2d2d;

  // Bit permutation helper
  function bitPermuteStep16(value, mask, shift) {
    const t = OpCodes.AndN(OpCodes.XorN(OpCodes.Shr32(value, shift), value), mask);
    return OpCodes.ToUint32(OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(value, t), OpCodes.Shl32(t, shift)), 0xFFFF));
  }

  // Permutation macros for GIFT-64 (16-bit nibble permutations)
  function PERM1_INNER(x) {
    x = bitPermuteStep16(x, 0x0a0a, 3);
    x = bitPermuteStep16(x, 0x00cc, 6);
    // Swap nibbles: (x & 0x0f0f) << 4 | (x & 0xf0f0) >> 4
    const swapped = OpCodes.OrN(OpCodes.Shl32(OpCodes.AndN(x, 0x0f0f), 4), OpCodes.Shr32(OpCodes.AndN(x, 0xf0f0), 4));
    return OpCodes.ToUint32(OpCodes.AndN(swapped, 0xFFFF));
  }

  function PERM0(x) {
    const inner = PERM1_INNER(x);
    // leftRotate12_16
    return OpCodes.ToUint32(OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(inner, 12), OpCodes.Shr32(inner, 4)), 0xFFFF));
  }

  function PERM1(x) {
    return PERM1_INNER(x);
  }

  function PERM2(x) {
    const inner = PERM1_INNER(x);
    // leftRotate4_16
    return OpCodes.ToUint32(OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(inner, 4), OpCodes.Shr32(inner, 12)), 0xFFFF));
  }

  function PERM3(x) {
    const inner = PERM1_INNER(x);
    // leftRotate8_16
    return OpCodes.ToUint32(OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(inner, 8), OpCodes.Shr32(inner, 8)), 0xFFFF));
  }

  // GIFT-64 Key Schedule
  class GIFT64KeySchedule {
    constructor(key) {
      // Load key as little-endian 32-bit words (LOTUS/LOCUS uses LE)
      this.k = new Uint32Array(4);
      this.k[0] = OpCodes.Pack32LE(key[12], key[13], key[14], key[15]);
      this.k[1] = OpCodes.Pack32LE(key[8], key[9], key[10], key[11]);
      this.k[2] = OpCodes.Pack32LE(key[4], key[5], key[6], key[7]);
      this.k[3] = OpCodes.Pack32LE(key[0], key[1], key[2], key[3]);
    }
  }

  // Convert GIFT-64 nibble representation to word representation
  function gift64nToWords(output, input) {
    // Load as little-endian 32-bit words (LOTUS/LOCUS nibble order)
    let s0 = OpCodes.Pack32LE(input[4], input[5], input[6], input[7]);
    let s1 = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);

    // Bit permutation to scatter nibbles
    // 0 8 16 24 1 9 17 25 2 10 18 26 3 11 19 27 4 12 20 28 5 13 21 29 6 14 22 30 7 15 23 31
    function bitPermuteStep32(y, mask, shift) {
      const t = OpCodes.AndN(OpCodes.XorN(OpCodes.Shr32(y, shift), y), mask);
      return OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(y, t), OpCodes.Shl32(t, shift)));
    }

    s0 = bitPermuteStep32(s0, 0x0a0a0a0a, 3);
    s0 = bitPermuteStep32(s0, 0x00cc00cc, 6);
    s0 = bitPermuteStep32(s0, 0x0000f0f0, 12);
    s0 = bitPermuteStep32(s0, 0x0000ff00, 8);

    s1 = bitPermuteStep32(s1, 0x0a0a0a0a, 3);
    s1 = bitPermuteStep32(s1, 0x00cc00cc, 6);
    s1 = bitPermuteStep32(s1, 0x0000f0f0, 12);
    s1 = bitPermuteStep32(s1, 0x0000ff00, 8);

    // Rearrange bytes
    output[0] = OpCodes.AndN(s0, 0xFF);
    output[1] = OpCodes.AndN(s1, 0xFF);
    output[2] = OpCodes.AndN(OpCodes.Shr32(s0, 8), 0xFF);
    output[3] = OpCodes.AndN(OpCodes.Shr32(s1, 8), 0xFF);
    output[4] = OpCodes.AndN(OpCodes.Shr32(s0, 16), 0xFF);
    output[5] = OpCodes.AndN(OpCodes.Shr32(s1, 16), 0xFF);
    output[6] = OpCodes.AndN(OpCodes.Shr32(s0, 24), 0xFF);
    output[7] = OpCodes.AndN(OpCodes.Shr32(s1, 24), 0xFF);
  }

  // Convert GIFT-64 word representation back to nibble representation
  function gift64nToNibbles(output, input) {
    // Rearrange bytes
    let s0 = OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(OpCodes.Shl32(input[6], 24), OpCodes.Shl32(input[4], 16)), OpCodes.Shl32(input[2], 8)), input[0]);
    let s1 = OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(OpCodes.Shl32(input[7], 24), OpCodes.Shl32(input[5], 16)), OpCodes.Shl32(input[3], 8)), input[1]);

    s0 = OpCodes.ToUint32(s0);
    s1 = OpCodes.ToUint32(s1);

    // Inverse bit permutation
    function bitPermuteStep32(y, mask, shift) {
      const t = OpCodes.AndN(OpCodes.XorN(OpCodes.Shr32(y, shift), y), mask);
      return OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(y, t), OpCodes.Shl32(t, shift)));
    }

    s0 = bitPermuteStep32(s0, 0x00aa00aa, 7);
    s0 = bitPermuteStep32(s0, 0x0000cccc, 14);
    s0 = bitPermuteStep32(s0, 0x00f000f0, 4);
    s0 = bitPermuteStep32(s0, 0x0000ff00, 8);

    s1 = bitPermuteStep32(s1, 0x00aa00aa, 7);
    s1 = bitPermuteStep32(s1, 0x0000cccc, 14);
    s1 = bitPermuteStep32(s1, 0x00f000f0, 4);
    s1 = bitPermuteStep32(s1, 0x0000ff00, 8);

    // Store as little-endian
    const s0bytes = OpCodes.Unpack32LE(s0);
    const s1bytes = OpCodes.Unpack32LE(s1);
    output[4] = s0bytes[0];
    output[5] = s0bytes[1];
    output[6] = s0bytes[2];
    output[7] = s0bytes[3];
    output[0] = s1bytes[0];
    output[1] = s1bytes[1];
    output[2] = s1bytes[2];
    output[3] = s1bytes[3];
  }

  // GIFT-64 encryption (16-bit nibble-based, low memory variant)
  function gift64tEncrypt(ks, output, input, tweak) {
    // Convert nibbles to words
    const wordInput = new Uint8Array(8);
    gift64nToWords(wordInput, input);

    // Load words as big-endian 16-bit values for processing
    let s0 = OpCodes.Pack16BE(wordInput[0], wordInput[1]);
    let s1 = OpCodes.Pack16BE(wordInput[2], wordInput[3]);
    let s2 = OpCodes.Pack16BE(wordInput[4], wordInput[5]);
    let s3 = OpCodes.Pack16BE(wordInput[6], wordInput[7]);

    // Initialize key schedule
    let w0 = ks.k[0];
    let w1 = ks.k[1];
    let w2 = ks.k[2];
    let w3 = ks.k[3];

    // 28 rounds of GIFT-64
    for (let round = 0; round < 28; ++round) {
      // SubCells - GIFT-64 S-box
      s1 = OpCodes.ToUint32(OpCodes.XorN(s1, OpCodes.AndN(s0, s2)));
      s0 = OpCodes.ToUint32(OpCodes.XorN(s0, OpCodes.AndN(s1, s3)));
      s2 = OpCodes.ToUint32(OpCodes.XorN(s2, OpCodes.OrN(s0, s1)));
      s3 = OpCodes.ToUint32(OpCodes.XorN(s3, s2));
      s1 = OpCodes.ToUint32(OpCodes.XorN(s1, s3));
      s3 = OpCodes.ToUint32(OpCodes.XorN(s3, 0xFFFF));
      s2 = OpCodes.ToUint32(OpCodes.XorN(s2, OpCodes.AndN(s0, s1)));
      let temp = s0;
      s0 = s3;
      s3 = temp;

      // PermBits - apply permutations
      s0 = PERM0(s0);
      s1 = PERM1(s1);
      s2 = PERM2(s2);
      s3 = PERM3(s3);

      // AddRoundKey
      s0 = OpCodes.ToUint32(OpCodes.AndN(OpCodes.XorN(s0, OpCodes.AndN(w3, 0xFFFF)), 0xFFFF));
      s1 = OpCodes.ToUint32(OpCodes.AndN(OpCodes.XorN(s1, OpCodes.Shr32(w3, 16)), 0xFFFF));
      s3 = OpCodes.ToUint32(OpCodes.AndN(OpCodes.XorN(s3, OpCodes.XorN(0x8000, GIFT64_RC[round])), 0xFFFF));

      // AddTweak every 4 rounds except last
      if (OpCodes.AndN(OpCodes.AndN(round + 1, 0xFF) % 4, 0xFF) === 0 && round < 27 && tweak !== 0) {
        s2 = OpCodes.ToUint32(OpCodes.AndN(OpCodes.XorN(s2, tweak), 0xFFFF));
      }

      // Rotate key schedule
      temp = w3;
      w3 = w2;
      w2 = w1;
      w1 = w0;
      w0 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(OpCodes.Shr32(OpCodes.AndN(temp, 0xFFFC0000), 2), OpCodes.Shl32(OpCodes.AndN(temp, 0x00030000), 14)), OpCodes.Shl32(OpCodes.AndN(temp, 0x00000FFF), 4)), OpCodes.Shr32(OpCodes.AndN(temp, 0x0000F000), 12)));
    }

    // Convert back to word representation
    const wordOutput = new Uint8Array(8);
    const s0_bytes = OpCodes.Unpack16BE(s0);
    const s1_bytes = OpCodes.Unpack16BE(s1);
    const s2_bytes = OpCodes.Unpack16BE(s2);
    const s3_bytes = OpCodes.Unpack16BE(s3);

    wordOutput[0] = s0_bytes[0];
    wordOutput[1] = s0_bytes[1];
    wordOutput[2] = s1_bytes[0];
    wordOutput[3] = s1_bytes[1];
    wordOutput[4] = s2_bytes[0];
    wordOutput[5] = s2_bytes[1];
    wordOutput[6] = s3_bytes[0];
    wordOutput[7] = s3_bytes[1];

    // Convert words back to nibbles
    gift64nToNibbles(output, wordOutput);
  }

  // GIFT-64 decryption
  function gift64tDecrypt(ks, output, input, tweak) {
    // Convert nibbles to words
    const wordInput = new Uint8Array(8);
    gift64nToWords(wordInput, input);

    // Load words as big-endian 16-bit values for processing
    let s0 = OpCodes.Pack16BE(wordInput[0], wordInput[1]);
    let s1 = OpCodes.Pack16BE(wordInput[2], wordInput[3]);
    let s2 = OpCodes.Pack16BE(wordInput[4], wordInput[5]);
    let s3 = OpCodes.Pack16BE(wordInput[6], wordInput[7]);

    // Fast-forward key schedule to end
    let w0 = ks.k[0];
    let w1 = ks.k[1];
    let w2 = ks.k[2];
    let w3 = ks.k[3];

    w0 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(OpCodes.Shr32(OpCodes.AndN(w0, 0xC0000000), 14), OpCodes.Shl32(OpCodes.AndN(w0, 0x3FFF0000), 2)), OpCodes.Shl32(OpCodes.AndN(w0, 0x0000000F), 12)), OpCodes.Shr32(OpCodes.AndN(w0, 0x0000FFF0), 4)));
    w1 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(OpCodes.Shr32(OpCodes.AndN(w1, 0xC0000000), 14), OpCodes.Shl32(OpCodes.AndN(w1, 0x3FFF0000), 2)), OpCodes.Shl32(OpCodes.AndN(w1, 0x0000000F), 12)), OpCodes.Shr32(OpCodes.AndN(w1, 0x0000FFF0), 4)));
    w2 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(OpCodes.Shr32(OpCodes.AndN(w2, 0xC0000000), 14), OpCodes.Shl32(OpCodes.AndN(w2, 0x3FFF0000), 2)), OpCodes.Shl32(OpCodes.AndN(w2, 0x0000000F), 12)), OpCodes.Shr32(OpCodes.AndN(w2, 0x0000FFF0), 4)));
    w3 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(OpCodes.Shr32(OpCodes.AndN(w3, 0xC0000000), 14), OpCodes.Shl32(OpCodes.AndN(w3, 0x3FFF0000), 2)), OpCodes.Shl32(OpCodes.AndN(w3, 0x0000000F), 12)), OpCodes.Shr32(OpCodes.AndN(w3, 0x0000FFF0), 4)));

    // Inverse permutation helper
    function INV_PERM1_INNER(x) {
      x = bitPermuteStep16(x, 0x0505, 5);
      x = bitPermuteStep16(x, 0x00cc, 6);
      const swapped = OpCodes.OrN(OpCodes.Shl32(OpCodes.AndN(x, 0x0f0f), 4), OpCodes.Shr32(OpCodes.AndN(x, 0xf0f0), 4));
      return OpCodes.ToUint32(OpCodes.AndN(swapped, 0xFFFF));
    }

    function INV_PERM0(x) {
      const rotated = OpCodes.ToUint32(OpCodes.AndN(OpCodes.OrN(OpCodes.Shr32(x, 12), OpCodes.Shl32(x, 4)), 0xFFFF));
      return INV_PERM1_INNER(rotated);
    }

    function INV_PERM1(x) {
      return INV_PERM1_INNER(x);
    }

    function INV_PERM2(x) {
      const rotated = OpCodes.ToUint32(OpCodes.AndN(OpCodes.OrN(OpCodes.Shr32(x, 4), OpCodes.Shl32(x, 12)), 0xFFFF));
      return INV_PERM1_INNER(rotated);
    }

    function INV_PERM3(x) {
      const rotated = OpCodes.ToUint32(OpCodes.AndN(OpCodes.OrN(OpCodes.Shr32(x, 8), OpCodes.Shl32(x, 8)), 0xFFFF));
      return INV_PERM1_INNER(rotated);
    }

    // 28 rounds in reverse
    for (let round = 28; round > 0; --round) {
      // Rotate key schedule backwards
      let temp = w0;
      w0 = w1;
      w1 = w2;
      w2 = w3;
      w3 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(OpCodes.Shl32(OpCodes.AndN(temp, 0x3FFF0000), 2), OpCodes.Shr32(OpCodes.AndN(temp, 0xC0000000), 14)), OpCodes.Shr32(OpCodes.AndN(temp, 0x0000FFF0), 4)), OpCodes.Shl32(OpCodes.AndN(temp, 0x0000000F), 12)));

      // AddTweak every 4 rounds except last
      if (OpCodes.AndN(round, 0xFF) % 4 === 0 && round !== 28 && tweak !== 0) {
        s2 = OpCodes.ToUint32(OpCodes.AndN(OpCodes.XorN(s2, tweak), 0xFFFF));
      }

      // AddRoundKey
      s0 = OpCodes.ToUint32(OpCodes.AndN(OpCodes.XorN(s0, OpCodes.AndN(w3, 0xFFFF)), 0xFFFF));
      s1 = OpCodes.ToUint32(OpCodes.AndN(OpCodes.XorN(s1, OpCodes.Shr32(w3, 16)), 0xFFFF));
      s3 = OpCodes.ToUint32(OpCodes.AndN(OpCodes.XorN(s3, OpCodes.XorN(0x8000, GIFT64_RC[round - 1])), 0xFFFF));

      // InvPermBits
      s0 = INV_PERM0(s0);
      s1 = INV_PERM1(s1);
      s2 = INV_PERM2(s2);
      s3 = INV_PERM3(s3);

      // InvSubCells
      temp = s0;
      s0 = s3;
      s3 = temp;
      s2 = OpCodes.ToUint32(OpCodes.XorN(s2, OpCodes.AndN(s0, s1)));
      s3 = OpCodes.ToUint32(OpCodes.XorN(s3, 0xFFFF));
      s1 = OpCodes.ToUint32(OpCodes.XorN(s1, s3));
      s3 = OpCodes.ToUint32(OpCodes.XorN(s3, s2));
      s2 = OpCodes.ToUint32(OpCodes.XorN(s2, OpCodes.OrN(s0, s1)));
      s0 = OpCodes.ToUint32(OpCodes.XorN(s0, OpCodes.AndN(s1, s3)));
      s1 = OpCodes.ToUint32(OpCodes.XorN(s1, OpCodes.AndN(s0, s2)));
    }

    // Convert back to word representation
    const wordOutput = new Uint8Array(8);
    const s0_bytes = OpCodes.Unpack16BE(s0);
    const s1_bytes = OpCodes.Unpack16BE(s1);
    const s2_bytes = OpCodes.Unpack16BE(s2);
    const s3_bytes = OpCodes.Unpack16BE(s3);

    wordOutput[0] = s0_bytes[0];
    wordOutput[1] = s0_bytes[1];
    wordOutput[2] = s1_bytes[0];
    wordOutput[3] = s1_bytes[1];
    wordOutput[4] = s2_bytes[0];
    wordOutput[5] = s2_bytes[1];
    wordOutput[6] = s3_bytes[0];
    wordOutput[7] = s3_bytes[1];

    // Convert words back to nibbles
    gift64nToNibbles(output, wordOutput);
  }

  // ===== LOCUS-AEAD MODE =====

  // Multiply key by 2 in GF(128)
  function locusMul2(ks) {
    const mask = OpCodes.AndN(ks.k[0], 0x80000000) !== 0 ? 0x87 : 0;
    ks.k[0] = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(ks.k[0], 1), OpCodes.Shr32(ks.k[1], 31)));
    ks.k[1] = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(ks.k[1], 1), OpCodes.Shr32(ks.k[2], 31)));
    ks.k[2] = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(ks.k[2], 1), OpCodes.Shr32(ks.k[3], 31)));
    ks.k[3] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.Shl32(ks.k[3], 1), mask));
  }

  // Initialize LOCUS state
  function locusInit(key, nonce) {
    // Initialize key schedule with original key
    let ks = new GIFT64KeySchedule(key);

    // Compute deltaN = E_K(0^64, tweak=0)
    const deltaN = new Uint8Array(GIFT64_BLOCK_SIZE);
    const zeros = new Uint8Array(GIFT64_BLOCK_SIZE);
    gift64tEncrypt(ks, deltaN, zeros, GIFT64T_TWEAK_0);

    // Compute T = key XOR nonce
    const T = new Uint8Array(16);
    for (let i = 0; i < 16; ++i) {
      T[i] = OpCodes.XorN(key[i], nonce[i]);
    }

    // Reinitialize key schedule with T
    ks = new GIFT64KeySchedule(T);

    // Update deltaN = E_T(deltaN, tweak=1)
    const temp = new Uint8Array(GIFT64_BLOCK_SIZE);
    gift64tEncrypt(ks, temp, deltaN, GIFT64T_TWEAK_1);
    for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
      deltaN[i] = temp[i];
    }

    return { ks: ks, deltaN: deltaN };
  }

  // Process associated data
  function locusProcessAD(ks, deltaN, V, ad, adlen) {
    const X = new Uint8Array(GIFT64_BLOCK_SIZE);
    let adPos = 0;

    // Process full blocks
    while (adlen > GIFT64_BLOCK_SIZE) {
      locusMul2(ks);

      // X = ad[i] XOR deltaN
      for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
        X[i] = OpCodes.XorN(ad[adPos + i], deltaN[i]);
      }

      gift64tEncrypt(ks, X, X, GIFT64T_TWEAK_2);

      // V = V XOR X
      for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
        V[i] = OpCodes.XorN(V[i], X[i]);
      }

      adPos += GIFT64_BLOCK_SIZE;
      adlen -= GIFT64_BLOCK_SIZE;
    }

    // Process final block (partial or full)
    locusMul2(ks);

    for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
      X[i] = deltaN[i];
    }

    const temp = OpCodes.AndN(adlen, 0xFFFFFFFF);
    if (temp < GIFT64_BLOCK_SIZE) {
      // Partial block - use tweak 3 with padding
      for (let i = 0; i < temp; ++i) {
        X[i] = OpCodes.XorN(X[i], ad[adPos + i]);
      }
      X[temp] = OpCodes.XorN(X[temp], 0x01); // Padding bit
      gift64tEncrypt(ks, X, X, GIFT64T_TWEAK_3);
    } else {
      // Full block - use tweak 2
      for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
        X[i] = OpCodes.XorN(X[i], ad[adPos + i]);
      }
      gift64tEncrypt(ks, X, X, GIFT64T_TWEAK_2);
    }

    for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
      V[i] = OpCodes.XorN(V[i], X[i]);
    }
  }

  // Generate authentication tag
  function locusGenTag(ks, deltaN, W, V) {
    locusMul2(ks);

    const temp = new Uint8Array(GIFT64_BLOCK_SIZE);
    for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
      temp[i] = OpCodes.XorN(OpCodes.XorN(W[i], deltaN[i]), V[i]);
    }

    gift64tEncrypt(ks, temp, temp, GIFT64T_TWEAK_6);

    const tag = new Uint8Array(GIFT64_BLOCK_SIZE);
    for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
      tag[i] = OpCodes.XorN(temp[i], deltaN[i]);
    }

    return tag;
  }

  // ===== LOCUS-AEAD ALGORITHM CLASS =====

  class LocusAead extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "LOCUS-AEAD";
      this.description = "Lightweight authenticated encryption with 128-bit keys, 128-bit nonces, and 64-bit tags. Uses GIFT-64 tweakable block cipher with COFB-style mode. Optimized for constrained environments.";
      this.inventor = "GIFT Team (Banik, Pandey, Peyrin, Sasaki, Sim, Todo)";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedNonceSizes = [new KeySize(16, 16, 1)];
      this.SupportedTagSizes = [new KeySize(8, 8, 1)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem(
          "NIST LWC Submission",
          "https://csrc.nist.gov/Projects/lightweight-cryptography"
        ),
        new LinkItem(
          "GIFT Specification",
          "https://eprint.iacr.org/2017/622.pdf"
        ),
        new LinkItem(
          "Reference Implementation",
          "https://github.com/rweather/lightweight-crypto"
        )
      ];

      // Test vectors from NIST LOCUS-AEAD.txt
      this.tests = [
        {
          text: "LOCUS-AEAD Vector #1: Empty PT and AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes(""),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("37F3EBB83FF38DE8")
        },
        {
          text: "LOCUS-AEAD Vector #34: 1-byte PT, empty AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("03DC889ADC2B53EC2A")
        },
        {
          text: "LOCUS-AEAD Vector #100: 3-byte PT, empty AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("F0381683C1937F51C16EE7")
        },
        {
          text: "LOCUS-AEAD Vector #300: 8-byte PT, 2-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("B3015DCA2A2B544F0BFA5D08D3F2F71F86")
        },
        {
          text: "LOCUS-AEAD Vector #1007: 29-byte PT, 16-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("B3015DCA2A2B544F2B37C2018BF764F82E4497FCC0A066688B5A78D55A0BC749353D0B8AC5DE")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LocusAeadInstance(this, isInverse);
    }
  }

  // ===== LOCUS-AEAD INSTANCE =====

  /**
 * LocusAead cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LocusAeadInstance extends IAeadInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._nonce = null;
      this._aad = [];
      this.inputBuffer = [];
      this.tagSize = 8; // LOCUS uses 64-bit (8-byte) tags
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
      if (keyBytes.length !== 16) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes (expected 16)");
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

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }
      if (nonceBytes.length !== 16) {
        throw new Error("Invalid nonce size: " + nonceBytes.length + " bytes (expected 16)");
      }
      this._nonce = [...nonceBytes];
    }

    get nonce() {
      return this._nonce ? [...this._nonce] : null;
    }

    set aad(aadBytes) {
      this._aad = aadBytes ? [...aadBytes] : [];
    }

    get aad() {
      return [...this._aad];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");

      if (this.isInverse) {
        return this.decrypt();
      } else {
        return this.encrypt();
      }
    }

    encrypt() {
      const plaintext = new Uint8Array(this.inputBuffer);
      const plen = plaintext.length;
      const ad = new Uint8Array(this._aad);
      const adlen = ad.length;

      // Initialize state
      const state = locusInit(new Uint8Array(this._key), new Uint8Array(this._nonce));
      const W = new Uint8Array(GIFT64_BLOCK_SIZE);
      const V = new Uint8Array(GIFT64_BLOCK_SIZE);

      // Process associated data
      if (adlen > 0) {
        locusProcessAD(state.ks, state.deltaN, V, ad, adlen);
      }

      const ciphertext = new Uint8Array(plen);
      let ptPos = 0;
      let ctPos = 0;
      let remaining = plen;

      // Encrypt plaintext
      if (plen > 0) {
        const X = new Uint8Array(GIFT64_BLOCK_SIZE);

        // Process full blocks
        while (remaining > GIFT64_BLOCK_SIZE) {
          locusMul2(state.ks);

          // X = plaintext[i] XOR deltaN
          for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
            X[i] = OpCodes.XorN(plaintext[ptPos + i], state.deltaN[i]);
          }

          gift64tEncrypt(state.ks, X, X, GIFT64T_TWEAK_4);

          // W = W XOR X
          for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
            W[i] = OpCodes.XorN(W[i], X[i]);
          }

          gift64tEncrypt(state.ks, X, X, GIFT64T_TWEAK_4);

          // ciphertext[i] = X XOR deltaN
          for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
            ciphertext[ctPos + i] = OpCodes.XorN(X[i], state.deltaN[i]);
          }

          ptPos += GIFT64_BLOCK_SIZE;
          ctPos += GIFT64_BLOCK_SIZE;
          remaining -= GIFT64_BLOCK_SIZE;
        }

        // Process final block
        if (remaining > 0) {
          locusMul2(state.ks);

          for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
            X[i] = state.deltaN[i];
          }
          X[0] = OpCodes.XorN(X[0], OpCodes.AndN(remaining, 0xFFFFFFFF));

          gift64tEncrypt(state.ks, X, X, GIFT64T_TWEAK_5);

          for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
            W[i] = OpCodes.XorN(W[i], X[i]);
          }

          for (let i = 0; i < remaining; ++i) {
            W[i] = OpCodes.XorN(W[i], plaintext[ptPos + i]);
          }

          gift64tEncrypt(state.ks, X, X, GIFT64T_TWEAK_5);

          for (let i = 0; i < remaining; ++i) {
            X[i] = OpCodes.XorN(X[i], state.deltaN[i]);
          }

          for (let i = 0; i < remaining; ++i) {
            ciphertext[ctPos + i] = OpCodes.XorN(plaintext[ptPos + i], X[i]);
          }
        }
      }

      // Generate authentication tag
      const tag = locusGenTag(state.ks, state.deltaN, W, V);

      // Combine ciphertext and tag
      const output = new Uint8Array(plen + 8);
      output.set(ciphertext);
      output.set(tag, plen);

      this.inputBuffer = [];
      return Array.from(output);
    }

    decrypt() {
      if (this.inputBuffer.length < 8) {
        throw new Error("Invalid ciphertext: too short for authentication tag");
      }

      const ctWithTag = new Uint8Array(this.inputBuffer);
      const clen = ctWithTag.length - 8;
      const ciphertext = ctWithTag.subarray(0, clen);
      const receivedTag = ctWithTag.subarray(clen, clen + 8);

      const ad = new Uint8Array(this._aad);
      const adlen = ad.length;

      // Initialize state
      const state = locusInit(new Uint8Array(this._key), new Uint8Array(this._nonce));
      const W = new Uint8Array(GIFT64_BLOCK_SIZE);
      const V = new Uint8Array(GIFT64_BLOCK_SIZE);

      // Process associated data
      if (adlen > 0) {
        locusProcessAD(state.ks, state.deltaN, V, ad, adlen);
      }

      const plaintext = new Uint8Array(clen);
      let ctPos = 0;
      let ptPos = 0;
      let remaining = clen;

      // Decrypt ciphertext
      if (clen > 0) {
        const X = new Uint8Array(GIFT64_BLOCK_SIZE);

        // Process full blocks
        while (remaining > GIFT64_BLOCK_SIZE) {
          locusMul2(state.ks);

          // X = ciphertext[i] XOR deltaN
          for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
            X[i] = OpCodes.XorN(ciphertext[ctPos + i], state.deltaN[i]);
          }

          gift64tDecrypt(state.ks, X, X, GIFT64T_TWEAK_4);

          // W = W XOR X
          for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
            W[i] = OpCodes.XorN(W[i], X[i]);
          }

          gift64tDecrypt(state.ks, X, X, GIFT64T_TWEAK_4);

          // plaintext[i] = X XOR deltaN
          for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
            plaintext[ptPos + i] = OpCodes.XorN(X[i], state.deltaN[i]);
          }

          ctPos += GIFT64_BLOCK_SIZE;
          ptPos += GIFT64_BLOCK_SIZE;
          remaining -= GIFT64_BLOCK_SIZE;
        }

        // Process final block
        if (remaining > 0) {
          locusMul2(state.ks);

          for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
            X[i] = state.deltaN[i];
          }
          X[0] = OpCodes.XorN(X[0], OpCodes.AndN(remaining, 0xFFFFFFFF));

          gift64tEncrypt(state.ks, X, X, GIFT64T_TWEAK_5);

          for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
            W[i] = OpCodes.XorN(W[i], X[i]);
          }

          gift64tEncrypt(state.ks, X, X, GIFT64T_TWEAK_5);

          for (let i = 0; i < remaining; ++i) {
            X[i] = OpCodes.XorN(X[i], state.deltaN[i]);
          }

          for (let i = 0; i < remaining; ++i) {
            plaintext[ptPos + i] = OpCodes.XorN(ciphertext[ctPos + i], X[i]);
          }

          for (let i = 0; i < remaining; ++i) {
            W[i] = OpCodes.XorN(W[i], plaintext[ptPos + i]);
          }
        }
      }

      // Verify authentication tag
      const computedTag = locusGenTag(state.ks, state.deltaN, W, V);

      // Constant-time tag comparison
      let tagMatch = true;
      for (let i = 0; i < 8; ++i) {
        if (computedTag[i] !== receivedTag[i]) {
          tagMatch = false;
        }
      }

      if (!tagMatch) {
        throw new Error("Authentication tag verification failed");
      }

      this.inputBuffer = [];
      return Array.from(plaintext);
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new LocusAead());

  return {
    LocusAead: LocusAead,
    LocusAeadInstance: LocusAeadInstance
  };

}));
