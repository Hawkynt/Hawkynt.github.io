/*
 * Deoxys-II - CAESAR Competition In-Depth Security Portfolio Winner
 * Professional implementation following CAESAR submission v1.43 specification
 * (c)2006-2025 Hawkynt
 *
 * Deoxys-II is a nonce-misuse resistant authenticated encryption algorithm selected
 * for the CAESAR "in-depth security" portfolio. It provides graceful security degradation
 * even when nonces are repeated, achieving MRAE (Misuse-Resistant Authenticated Encryption)
 * security. Based on the TWEAKEY framework using AES round functions.
 *
 * Variants:
 * - Deoxys-II-128: 128-bit key, 120-bit nonce, 128-bit tag (uses Deoxys-BC-256)
 * - Deoxys-II-256: 256-bit key, 120-bit nonce, 128-bit tag (uses Deoxys-BC-384)
 *
 * Reference: https://sites.google.com/view/deoxyscipher
 * Paper: "The Deoxys AEAD Family" - Journal of Cryptology 2021
 * CAESAR: https://competitions.cr.yp.to/round3/deoxysv141.pdf
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
          AeadAlgorithm, IAeadInstance, LinkItem, KeySize } = AlgorithmFramework;

  // AES S-box (same as standard AES)
  const SBOX = new Uint8Array([
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

  // AES Inverse S-box
  const INV_SBOX = new Uint8Array([
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

  // H-permutation for TWEAKEY framework
  const H_PERM = new Uint8Array([1, 6, 11, 12, 5, 10, 15, 0, 9, 14, 3, 4, 13, 2, 7, 8]);

  // Round constants for Deoxys-BC
  const RCON = [
    [1, 2, 4, 8, 0x2f, 0x2f, 0x2f, 0x2f, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 2, 4, 8, 0x5e, 0x5e, 0x5e, 0x5e, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 2, 4, 8, 0xbc, 0xbc, 0xbc, 0xbc, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 2, 4, 8, 0x63, 0x63, 0x63, 0x63, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 2, 4, 8, 0xc6, 0xc6, 0xc6, 0xc6, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 2, 4, 8, 0x97, 0x97, 0x97, 0x97, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 2, 4, 8, 0x35, 0x35, 0x35, 0x35, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 2, 4, 8, 0x6a, 0x6a, 0x6a, 0x6a, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 2, 4, 8, 0xd4, 0xd4, 0xd4, 0xd4, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 2, 4, 8, 0xb3, 0xb3, 0xb3, 0xb3, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 2, 4, 8, 0x7d, 0x7d, 0x7d, 0x7d, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 2, 4, 8, 0xfa, 0xfa, 0xfa, 0xfa, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 2, 4, 8, 0xef, 0xef, 0xef, 0xef, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 2, 4, 8, 0xc5, 0xc5, 0xc5, 0xc5, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 2, 4, 8, 0x91, 0x91, 0x91, 0x91, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 2, 4, 8, 0x39, 0x39, 0x39, 0x39, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 2, 4, 8, 0x72, 0x72, 0x72, 0x72, 0, 0, 0, 0, 0, 0, 0, 0]
  ];

  // Tweak domain separation constants for Deoxys-II
  const TWEAK_AD = 0x20;       // Associated data processing
  const TWEAK_AD_LAST = 0x60;  // Last AD block
  const TWEAK_M = 0x00;        // Message processing
  const TWEAK_M_LAST = 0x40;   // Last message block
  const TWEAK_TAG = 0x10;      // Tag generation

  // AES MixColumns multiplication lookup tables (for performance)
  const MUL2 = new Uint8Array(256);
  const MUL3 = new Uint8Array(256);

  // Initialize MixColumns tables (AES GF(2^8) with irreducible 0x11B)
  (function() {
    for (let i = 0; i < 256; ++i) {
      MUL2[i] = OpCodes.GFMul(i, 2, 0x11B, 8);
      MUL3[i] = OpCodes.GFMul(i, 3, 0x11B, 8);
    }
  })();

  // AES SubBytes transformation
  function SubBytes(state) {
    for (let i = 0; i < 16; ++i) {
      state[i] = SBOX[state[i]];
    }
  }

  // AES ShiftRows transformation
  function ShiftRows(state) {
    let temp;
    // Row 1: shift left by 1
    temp = state[1];
    state[1] = state[5];
    state[5] = state[9];
    state[9] = state[13];
    state[13] = temp;

    // Row 2: shift left by 2
    temp = state[2];
    state[2] = state[10];
    state[10] = temp;
    temp = state[6];
    state[6] = state[14];
    state[14] = temp;

    // Row 3: shift left by 3 (equivalent to right by 1)
    temp = state[3];
    state[3] = state[15];
    state[15] = state[11];
    state[11] = state[7];
    state[7] = temp;
  }

  // AES MixColumns transformation
  function MixColumns(state) {
    for (let i = 0; i < 4; ++i) {
      const s0 = state[i];
      const s1 = state[i + 4];
      const s2 = state[i + 8];
      const s3 = state[i + 12];

      state[i] = MUL2[s0] ^ MUL3[s1] ^ s2 ^ s3;
      state[i + 4] = s0 ^ MUL2[s1] ^ MUL3[s2] ^ s3;
      state[i + 8] = s0 ^ s1 ^ MUL2[s2] ^ MUL3[s3];
      state[i + 12] = MUL3[s0] ^ s1 ^ s2 ^ MUL2[s3];
    }
  }

  // AES round function (SubBytes + ShiftRows + MixColumns)
  function AESRound(state) {
    SubBytes(state);
    ShiftRows(state);
    MixColumns(state);
  }

  // H-substitution for TWEAKEY framework
  function HSubstitution(tk) {
    const result = new Uint8Array(16);
    for (let i = 0; i < 16; ++i) {
      result[i] = tk[H_PERM[i]];
    }
    tk.set(result);
  }

  // LFSR2 for TWEAKEY framework (used in Deoxys-BC-256)
  function LFSR2(tk) {
    for (let i = 0; i < 16; ++i) {
      const x = tk[i];
      tk[i] = ((x << 1) & 0xFE) ^ (((x >> 7) ^ (x >> 5)) & 0x01);
    }
  }

  // LFSR3 for TWEAKEY framework (used in Deoxys-BC-384)
  function LFSR3(tk) {
    for (let i = 0; i < 16; ++i) {
      const x = tk[i];
      tk[i] = ((x >> 1) & 0x7F) ^ (((x << 7) ^ (x << 1)) & 0x80);
    }
  }

  // Deoxys-BC-256 encryption (14 rounds, 128-bit key + 128-bit tweak)
  function DeoxysBc256Encrypt(state, tweak, subkeys) {
    // Precompute all subtweakeys (tweak XOR subkeys)
    const subtweakeys = new Array(15);
    const tweakCopy = new Uint8Array(tweak);

    // First subtweakey
    subtweakeys[0] = new Uint8Array(16);
    for (let i = 0; i < 16; ++i) {
      subtweakeys[0][i] = tweakCopy[i] ^ subkeys[0][i];
    }

    // Remaining subtweakeys
    for (let r = 1; r < 15; ++r) {
      HSubstitution(tweakCopy);
      subtweakeys[r] = new Uint8Array(16);
      for (let i = 0; i < 16; ++i) {
        subtweakeys[r][i] = tweakCopy[i] ^ subkeys[r][i];
      }
    }

    // Initial AddRoundTweakey
    for (let i = 0; i < 16; ++i) {
      state[i] ^= subtweakeys[0][i];
    }

    // 14 rounds: each round is SubBytes + ShiftRows + MixColumns + AddRoundTweakey
    for (let r = 1; r < 15; ++r) {
      SubBytes(state);
      ShiftRows(state);
      MixColumns(state);

      // AddRoundTweakey
      for (let i = 0; i < 16; ++i) {
        state[i] ^= subtweakeys[r][i];
      }
    }
  }

  // Deoxys-BC-384 encryption (16 rounds, 256-bit key + 128-bit tweak)
  function DeoxysBc384Encrypt(state, tweak, subkeys) {
    // Precompute all subtweakeys (tweak XOR subkeys)
    const subtweakeys = new Array(17);
    const tweakCopy = new Uint8Array(tweak);

    // First subtweakey
    subtweakeys[0] = new Uint8Array(16);
    for (let i = 0; i < 16; ++i) {
      subtweakeys[0][i] = tweakCopy[i] ^ subkeys[0][i];
    }

    // Remaining subtweakeys
    for (let r = 1; r < 17; ++r) {
      HSubstitution(tweakCopy);
      subtweakeys[r] = new Uint8Array(16);
      for (let i = 0; i < 16; ++i) {
        subtweakeys[r][i] = tweakCopy[i] ^ subkeys[r][i];
      }
    }

    // Initial AddRoundTweakey
    for (let i = 0; i < 16; ++i) {
      state[i] ^= subtweakeys[0][i];
    }

    // 16 rounds: each round is SubBytes + ShiftRows + MixColumns + AddRoundTweakey
    for (let r = 1; r < 17; ++r) {
      SubBytes(state);
      ShiftRows(state);
      MixColumns(state);

      // AddRoundTweakey
      for (let i = 0; i < 16; ++i) {
        state[i] ^= subtweakeys[r][i];
      }
    }
  }

  // Precompute subkeys for Deoxys-BC-256 (128-bit key)
  function PrecomputeSubkeysBc256(key) {
    const subkeys = [];
    const tk2 = new Uint8Array(key);

    // First subkey
    const sk0 = new Uint8Array(16);
    for (let i = 0; i < 16; ++i) {
      sk0[i] = tk2[i] ^ RCON[0][i];
    }
    subkeys.push(sk0);

    // Remaining subkeys
    for (let r = 1; r < 15; ++r) {
      HSubstitution(tk2);
      LFSR2(tk2);
      const sk = new Uint8Array(16);
      for (let i = 0; i < 16; ++i) {
        sk[i] = tk2[i] ^ RCON[r][i];
      }
      subkeys.push(sk);
    }

    return subkeys;
  }

  // Precompute subkeys for Deoxys-BC-384 (256-bit key)
  function PrecomputeSubkeysBc384(key) {
    const subkeys = [];
    const tk3 = new Uint8Array(key.slice(0, 16));
    const tk2 = new Uint8Array(key.slice(16, 32));

    // First subkey
    const sk0 = new Uint8Array(16);
    for (let i = 0; i < 16; ++i) {
      sk0[i] = tk3[i] ^ tk2[i] ^ RCON[0][i];
    }
    subkeys.push(sk0);

    // Remaining subkeys
    for (let r = 1; r < 17; ++r) {
      HSubstitution(tk2);
      LFSR2(tk2);
      HSubstitution(tk3);
      LFSR3(tk3);

      const sk = new Uint8Array(16);
      for (let i = 0; i < 16; ++i) {
        sk[i] = tk3[i] ^ tk2[i] ^ RCON[r][i];
      }
      subkeys.push(sk);
    }

    return subkeys;
  }

  // Deoxys-II-128 AEAD Algorithm
  /**
 * DeoxysII128Algorithm - AEAD cipher implementation
 * @class
 * @extends {AeadAlgorithm}
 */

  class DeoxysII128Algorithm extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "Deoxys-II-128";
      this.description = "CAESAR in-depth security portfolio winner with nonce-misuse resistance. Uses 128-bit keys with Deoxys-BC-256 tweakable block cipher based on AES rounds.";
      this.inventor = "Jérémy Jean, Ivica Nikolić, Thomas Peyrin, Yannick Seurin";
      this.year = 2016;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = null; // CAESAR finalist - in-depth security
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedTagSizes = [new KeySize(16, 16, 1)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem(
          "Deoxys Official Website",
          "https://sites.google.com/view/deoxyscipher"
        ),
        new LinkItem(
          "The Deoxys AEAD Family (Journal of Cryptology 2021)",
          "https://link.springer.com/article/10.1007/s00145-021-09397-w"
        ),
        new LinkItem(
          "CAESAR Submission v1.43",
          "https://competitions.cr.yp.to/round3/deoxysv141.pdf"
        )
      ];

      // Official test vectors from RustCrypto Deoxys implementation
      this.tests = [
        {
          text: "Deoxys-II-128: Empty plaintext, empty AAD",
          uri: "https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_128.rs",
          key: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          nonce: OpCodes.Hex8ToBytes("202122232425262728292a2b2c2d2e"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("97d951f2fd129001483e831f2a6821e9")
        },
        {
          text: "Deoxys-II-128: Empty plaintext, 32-byte AAD",
          uri: "https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_128.rs",
          key: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          nonce: OpCodes.Hex8ToBytes("202122232425262728292a2b2c2d2e"),
          aad: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("3c197ca5317af5a2b95b178a60553132")
        },
        {
          text: "Deoxys-II-128: Empty plaintext, 33-byte AAD",
          uri: "https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_128.rs",
          key: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          nonce: OpCodes.Hex8ToBytes("202122232425262728292a2b2c2d2e"),
          aad: OpCodes.Hex8ToBytes("a754f3387be992ffee5bee80e18b151900c6d69ec59786fb12d2eadb0750f82cf5"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("0a989ed78fa16776cd6c691ea734d874")
        },
        {
          text: "Deoxys-II-128: 32-byte plaintext, empty AAD",
          uri: "https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_128.rs",
          key: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          nonce: OpCodes.Hex8ToBytes("202122232425262728292a2b2c2d2e"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("fa22f8eb84ee6d2388bdb16150232e856cd5fa3508bc589dad16d284208048c9a381b06ef16db99df089e738c3b4064a")
        },
        {
          text: "Deoxys-II-128: 33-byte plaintext, empty AAD",
          uri: "https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_128.rs",
          key: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          nonce: OpCodes.Hex8ToBytes("202122232425262728292a2b2c2d2e"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("06ac1756eccece62bd743fa80c299f7baa3872b556130f52265919494bdc136db3"),
          expected: OpCodes.Hex8ToBytes("82bf241958b324ed053555d23315d3cc20935527fc970ff34a9f521a95e302136d0eadc8612d5208c491e93005195e9769")
        },
        {
          text: "Deoxys-II-128: 32-byte plaintext, 16-byte AAD",
          uri: "https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_128.rs",
          key: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          nonce: OpCodes.Hex8ToBytes("202122232425262728292a2b2c2d2e"),
          aad: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("9cdb554dfc03bff4feeb94df7736038361a76532b6b5a9c0bdb64a74dee983ffbc1a7b5b8e961e65ceff6877ef9e4a98")
        },
        {
          text: "Deoxys-II-128: 33-byte plaintext, 17-byte AAD",
          uri: "https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_128.rs",
          key: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          nonce: OpCodes.Hex8ToBytes("202122232425262728292a2b2c2d2e"),
          aad: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f10"),
          input: OpCodes.Hex8ToBytes("039ca0907aa315a0d5ba020c84378840023d4ad3ba639787d3f6f46cb446bd63dc"),
          expected: OpCodes.Hex8ToBytes("801f1b81878faca562c8c6c0859b166c2669fbc54b1784be637827b4905729bdf9fe4e9bcd26b96647350eda1e550cc994")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new DeoxysII128Instance(this, isInverse);
    }
  }

  // Deoxys-II-256 AEAD Algorithm
  /**
 * DeoxysII256Algorithm - AEAD cipher implementation
 * @class
 * @extends {AeadAlgorithm}
 */

  class DeoxysII256Algorithm extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "Deoxys-II-256";
      this.description = "CAESAR in-depth security portfolio winner with nonce-misuse resistance. Uses 256-bit keys with Deoxys-BC-384 tweakable block cipher based on AES rounds.";
      this.inventor = "Jérémy Jean, Ivica Nikolić, Thomas Peyrin, Yannick Seurin";
      this.year = 2016;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = null; // CAESAR finalist - in-depth security
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedKeySizes = [new KeySize(32, 32, 1)];
      this.SupportedTagSizes = [new KeySize(16, 16, 1)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem(
          "Deoxys Official Website",
          "https://sites.google.com/view/deoxyscipher"
        ),
        new LinkItem(
          "The Deoxys AEAD Family (Journal of Cryptology 2021)",
          "https://link.springer.com/article/10.1007/s00145-021-09397-w"
        ),
        new LinkItem(
          "CAESAR Submission v1.43",
          "https://competitions.cr.yp.to/round3/deoxysv141.pdf"
        )
      ];

      // Official test vectors from RustCrypto Deoxys implementation
      this.tests = [
        {
          text: "Deoxys-II-256: Empty plaintext, empty AAD",
          uri: "https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_256.rs",
          key: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f"),
          nonce: OpCodes.Hex8ToBytes("202122232425262728292a2b2c2d2e"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("2b97bd77712f0cde975309959dfe1d7c")
        },
        {
          text: "Deoxys-II-256: Empty plaintext, 32-byte AAD",
          uri: "https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_256.rs",
          key: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f"),
          nonce: OpCodes.Hex8ToBytes("202122232425262728292a2b2c2d2e"),
          aad: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("54708ae5565a71f147bdb94d7ba3aed7")
        },
        {
          text: "Deoxys-II-256: Empty plaintext, 33-byte AAD",
          uri: "https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_256.rs",
          key: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f"),
          nonce: OpCodes.Hex8ToBytes("202122232425262728292a2b2c2d2e"),
          aad: OpCodes.Hex8ToBytes("f495c9c03d29989695d98ff5d430650125805c1e0576d06f26cbda42b1f82238b8"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("3277689dc4208cc1ff59d15434a1baf1")
        },
        {
          text: "Deoxys-II-256: 32-byte plaintext, empty AAD",
          uri: "https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_256.rs",
          key: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f"),
          nonce: OpCodes.Hex8ToBytes("202122232425262728292a2b2c2d2e"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("9da20db1c2781f6669257d87e2a4d9be1970f7581bef2c995e1149331e5e8cc192ce3aec3a4b72ff9eab71c2a93492fa")
        },
        {
          text: "Deoxys-II-256: 33-byte plaintext, empty AAD",
          uri: "https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_256.rs",
          key: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f"),
          nonce: OpCodes.Hex8ToBytes("202122232425262728292a2b2c2d2e"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("15cd77732f9d0c4c6e581ef400876ad9188c5b8850ebd38224da95d7cdc99f7acc"),
          expected: OpCodes.Hex8ToBytes("e5ffd2abc5b459a73667756eda6443ede86c0883fc51dd75d22bb14992c684618c5fa78d57308f19d0252072ee39df5ecc")
        },
        {
          text: "Deoxys-II-256: 32-byte plaintext, 16-byte AAD",
          uri: "https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_256.rs",
          key: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f"),
          nonce: OpCodes.Hex8ToBytes("202122232425262728292a2b2c2d2e"),
          aad: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("109f8a168b36dfade02628a9e129d5257f03cc7912aefa79729b67b186a2b08f6549f9bf10acba0a451dbb2484a60d90")
        },
        {
          text: "Deoxys-II-256: 33-byte plaintext, 17-byte AAD",
          uri: "https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_256.rs",
          key: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f"),
          nonce: OpCodes.Hex8ToBytes("202122232425262728292a2b2c2d2e"),
          aad: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f10"),
          input: OpCodes.Hex8ToBytes("422857fb165af0a35c03199fb895604dca9cea6d788954962c419e0d5c225c0327"),
          expected: OpCodes.Hex8ToBytes("7d772203fa38be296d8d20d805163130c69aba8cb16ed845c2296c61a8f34b394e0b3f10e3933c78190b24b33008bf80e9")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new DeoxysII256Instance(this, isInverse);
    }
  }

  // Base instance class for Deoxys-II AEAD
  /**
 * DeoxysII AEAD instance implementing Feed/Result pattern
 * @class
 * @extends {IAeadInstance}
 */

  class DeoxysIIInstanceBase extends IAeadInstance {
    constructor(algorithm, isInverse, bcEncrypt, precomputeSubkeys) {
      super(algorithm);
      this.isInverse = isInverse;
      this.bcEncrypt = bcEncrypt;
      this.precomputeSubkeys = precomputeSubkeys;
      this._key = null;
      this._nonce = null;
      this.subkeys = null;
      this.inputBuffer = [];
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.subkeys = null;
        return;
      }

      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this.subkeys = this.precomputeSubkeys(new Uint8Array(keyBytes));
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

      if (nonceBytes.length !== 15) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected 15)`);
      }

      this._nonce = [...nonceBytes];
    }

    get nonce() {
      return this._nonce ? [...this._nonce] : null;
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
      if (!this.subkeys) throw new Error("Subkeys not computed");

      const plaintext = new Uint8Array(this.inputBuffer);
      const aad = this.aad && this.aad.length > 0 ? new Uint8Array(this.aad) : new Uint8Array(0);
      const nonce = new Uint8Array(this._nonce);

      let result;
      if (this.isInverse) {
        // Decryption: split ciphertext and tag
        if (plaintext.length < 16) {
          throw new Error("Ciphertext too short (must include 16-byte tag)");
        }
        const ciphertext = plaintext.slice(0, -16);
        const tag = plaintext.slice(-16);
        result = this.decrypt(nonce, aad, ciphertext, tag);
      } else {
        // Encryption: returns ciphertext || tag
        result = this.encrypt(nonce, aad, plaintext);
      }

      this.inputBuffer = [];
      return Array.from(result);
    }

    encrypt(nonce, aad, plaintext) {
      const tag = new Uint8Array(16);
      const tweak = new Uint8Array(16);

      // Process associated data
      this.computeAdTag(aad, tweak, tag);

      // Authenticate message
      this.authenticateMessage(plaintext, tweak, tag);

      // Generate tag
      tweak.fill(0);
      tweak[0] = TWEAK_TAG;
      tweak.set(nonce, 1);
      const tagBlock = new Uint8Array(tag);
      this.bcEncrypt(tagBlock, tweak, this.subkeys);
      tag.set(tagBlock);

      // Encrypt message
      const ciphertext = this.encryptMessage(plaintext, tweak, tag, nonce);

      // Return ciphertext || tag
      const result = new Uint8Array(ciphertext.length + 16);
      result.set(ciphertext);
      result.set(tag, ciphertext.length);
      return result;
    }

    decrypt(nonce, aad, ciphertext, expectedTag) {
      const tag = new Uint8Array(16);
      const tweak = new Uint8Array(16);

      // Process associated data
      this.computeAdTag(aad, tweak, tag);

      // Decrypt message
      const plaintext = this.encryptMessage(ciphertext, tweak, expectedTag, nonce);

      // Authenticate decrypted message
      tweak.fill(0);
      this.authenticateMessage(plaintext, tweak, tag);

      // Generate tag
      tweak[0] = TWEAK_TAG;
      tweak.set(nonce, 1);
      const tagBlock = new Uint8Array(tag);
      this.bcEncrypt(tagBlock, tweak, this.subkeys);
      tag.set(tagBlock);

      // Constant-time tag comparison
      let mismatch = 0;
      for (let i = 0; i < 16; ++i) {
        mismatch |= tag[i] ^ expectedTag[i];
      }

      if (mismatch !== 0) {
        throw new Error("Authentication tag verification failed");
      }

      return plaintext;
    }

    computeAdTag(aad, tweak, tag) {
      if (aad.length === 0) return;

      tweak[0] = TWEAK_AD;

      for (let index = 0; index * 16 < aad.length; ++index) {
        const start = index * 16;
        const end = Math.min(start + 16, aad.length);
        const adBlock = aad.slice(start, end);

        // Set block counter
        const counter = new DataView(new ArrayBuffer(8));
        counter.setBigUint64(0, BigInt(index), false);
        tweak.set(new Uint8Array(counter.buffer), 8);

        if (adBlock.length === 16) {
          // Full block
          const block = new Uint8Array(adBlock);
          this.bcEncrypt(block, tweak, this.subkeys);
          for (let i = 0; i < 16; ++i) {
            tag[i] ^= block[i];
          }
        } else {
          // Last partial block
          tweak[0] = TWEAK_AD_LAST;
          const block = new Uint8Array(16);
          block.set(adBlock);
          block[adBlock.length] = 0x80; // Padding
          this.bcEncrypt(block, tweak, this.subkeys);
          for (let i = 0; i < 16; ++i) {
            tag[i] ^= block[i];
          }
        }
      }
    }

    authenticateMessage(message, tweak, tag) {
      if (message.length === 0) return;

      tweak[0] = TWEAK_M;

      for (let index = 0; index * 16 < message.length; ++index) {
        const start = index * 16;
        const end = Math.min(start + 16, message.length);
        const msgBlock = message.slice(start, end);

        // Set block counter
        const counter = new DataView(new ArrayBuffer(8));
        counter.setBigUint64(0, BigInt(index), false);
        tweak.set(new Uint8Array(counter.buffer), 8);

        if (msgBlock.length === 16) {
          // Full block
          const block = new Uint8Array(msgBlock);
          this.bcEncrypt(block, tweak, this.subkeys);
          for (let i = 0; i < 16; ++i) {
            tag[i] ^= block[i];
          }
        } else {
          // Last partial block
          tweak[0] = TWEAK_M_LAST;
          const block = new Uint8Array(16);
          block.set(msgBlock);
          block[msgBlock.length] = 0x80; // Padding
          this.bcEncrypt(block, tweak, this.subkeys);
          for (let i = 0; i < 16; ++i) {
            tag[i] ^= block[i];
          }
        }
      }
    }

    encryptMessage(message, tweak, tag, nonce) {
      if (message.length === 0) return new Uint8Array(0);

      const output = new Uint8Array(message.length);
      tweak.set(tag);
      tweak[0] |= 0x80; // Set encryption flag

      for (let index = 0; index * 16 < message.length; ++index) {
        const start = index * 16;
        const end = Math.min(start + 16, message.length);
        const msgBlock = message.slice(start, end);

        // XOR block counter into tweak
        const counter = new DataView(new ArrayBuffer(8));
        counter.setBigUint64(0, BigInt(index), false);
        const counterBytes = new Uint8Array(counter.buffer);
        for (let i = 0; i < 8; ++i) {
          tweak[8 + i] ^= counterBytes[i];
        }

        // Generate keystream block
        const keystreamBlock = new Uint8Array(16);
        keystreamBlock[0] = 0;
        keystreamBlock.set(nonce, 1);
        this.bcEncrypt(keystreamBlock, tweak, this.subkeys);

        // XOR with message
        for (let i = 0; i < msgBlock.length; ++i) {
          output[start + i] = msgBlock[i] ^ keystreamBlock[i];
        }

        // XOR counter back out
        for (let i = 0; i < 8; ++i) {
          tweak[8 + i] ^= counterBytes[i];
        }
      }

      return output;
    }
  }

  // Deoxys-II-128 instance
  class DeoxysII128Instance extends DeoxysIIInstanceBase {
    constructor(algorithm, isInverse) {
      super(algorithm, isInverse, DeoxysBc256Encrypt, PrecomputeSubkeysBc256);
    }
  }

  // Deoxys-II-256 instance
  class DeoxysII256Instance extends DeoxysIIInstanceBase {
    constructor(algorithm, isInverse) {
      super(algorithm, isInverse, DeoxysBc384Encrypt, PrecomputeSubkeysBc384);
    }
  }

  // Register algorithms
  RegisterAlgorithm(new DeoxysII128Algorithm());
  RegisterAlgorithm(new DeoxysII256Algorithm());

  return {
    DeoxysII128: DeoxysII128Algorithm,
    DeoxysII256: DeoxysII256Algorithm
  };
}));
