/*
 * Romulus - NIST Lightweight Cryptography Finalist
 * AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * Romulus is a family of authenticated encryption algorithms based on the
 * SKINNY-128 tweakable block cipher. The family includes Romulus-N (nonce-based)
 * and Romulus-M (nonce-misuse resistant) variants with different nonce sizes.
 *
 * Features:
 * - 128-bit key and tag for all variants
 * - Multiple nonce sizes: 128-bit (N1/M1), 96-bit (N2/M2/N3/M3)
 * - TBC-based construction (SKINNY-128-384 or SKINNY-128-256)
 * - Efficient in hardware implementations
 * - NIST LWC finalist
 *
 * Variants:
 * - Romulus-N1/N2/N3: Nonce-based AEAD (primary recommendation: N1)
 * - Romulus-M1/M2/M3: Nonce-misuse resistant AEAD
 * - Romulus-T: TBC-based hash then encrypt mode
 *
 * References:
 * - https://romulusae.github.io/romulus/
 * - https://csrc.nist.gov/Projects/lightweight-cryptography
 * - NIST LWC Romulus Specification (Final Round)
 *
 * Based on reference implementations:
 * - Southern Storm Software (C implementation)
 * - Bouncy Castle (Java implementation)
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
          AeadAlgorithm, IAeadInstance, TestCase, LinkItem, KeySize, AuthResult } = AlgorithmFramework;

  // ===== SKINNY-128 TWEAKABLE BLOCK CIPHER =====

  // SKINNY-128 8-bit S-box
  const SKINNY_SBOX = new Uint8Array([
    0x65, 0x4c, 0x6a, 0x42, 0x4b, 0x63, 0x43, 0x6b, 0x55, 0x75, 0x5a, 0x7a, 0x53, 0x73, 0x5b, 0x7b,
    0x35, 0x8c, 0x3a, 0x81, 0x89, 0x33, 0x80, 0x3b, 0x95, 0x25, 0x98, 0x2a, 0x90, 0x23, 0x99, 0x2b,
    0xe5, 0xcc, 0xe8, 0xc1, 0xc9, 0xe0, 0xc0, 0xe9, 0xd5, 0xf5, 0xd8, 0xf8, 0xd0, 0xf0, 0xd9, 0xf9,
    0xa5, 0x1c, 0xa8, 0x12, 0x1b, 0xa0, 0x13, 0xa9, 0x05, 0xb5, 0x0a, 0xb8, 0x03, 0xb0, 0x0b, 0xb9,
    0x32, 0x88, 0x3c, 0x85, 0x8d, 0x34, 0x84, 0x3d, 0x91, 0x22, 0x9c, 0x2c, 0x94, 0x24, 0x9d, 0x2d,
    0x62, 0x4a, 0x6c, 0x45, 0x4d, 0x64, 0x44, 0x6d, 0x52, 0x72, 0x5c, 0x7c, 0x54, 0x74, 0x5d, 0x7d,
    0xa1, 0x1a, 0xac, 0x15, 0x1d, 0xa4, 0x14, 0xad, 0x02, 0xb1, 0x0c, 0xbc, 0x04, 0xb4, 0x0d, 0xbd,
    0xe1, 0xc8, 0xec, 0xc5, 0xcd, 0xe4, 0xc4, 0xed, 0xd1, 0xf1, 0xdc, 0xfc, 0xd4, 0xf4, 0xdd, 0xfd,
    0x36, 0x8e, 0x38, 0x82, 0x8b, 0x30, 0x83, 0x39, 0x96, 0x26, 0x9a, 0x28, 0x93, 0x20, 0x9b, 0x29,
    0x66, 0x4e, 0x68, 0x41, 0x49, 0x60, 0x40, 0x69, 0x56, 0x76, 0x58, 0x78, 0x50, 0x70, 0x59, 0x79,
    0xa6, 0x1e, 0xaa, 0x11, 0x19, 0xa3, 0x10, 0xab, 0x06, 0xb6, 0x08, 0xba, 0x00, 0xb3, 0x09, 0xbb,
    0xe6, 0xce, 0xea, 0xc2, 0xcb, 0xe3, 0xc3, 0xeb, 0xd6, 0xf6, 0xda, 0xfa, 0xd3, 0xf3, 0xdb, 0xfb,
    0x31, 0x8a, 0x3e, 0x86, 0x8f, 0x37, 0x87, 0x3f, 0x92, 0x21, 0x9e, 0x2e, 0x97, 0x27, 0x9f, 0x2f,
    0x61, 0x48, 0x6e, 0x46, 0x4f, 0x67, 0x47, 0x6f, 0x51, 0x71, 0x5e, 0x7e, 0x57, 0x77, 0x5f, 0x7f,
    0xa2, 0x18, 0xae, 0x16, 0x1f, 0xa7, 0x17, 0xaf, 0x01, 0xb2, 0x0e, 0xbe, 0x07, 0xb7, 0x0f, 0xbf,
    0xe2, 0xca, 0xee, 0xc6, 0xcf, 0xe7, 0xc7, 0xef, 0xd2, 0xf2, 0xde, 0xfe, 0xd7, 0xf7, 0xdf, 0xff
  ]);

  // SKINNY-128 tweakey permutation
  const SKINNY_TWEAKEY_P = new Uint8Array([9, 15, 8, 13, 10, 14, 12, 11, 0, 1, 2, 3, 4, 5, 6, 7]);

  // SKINNY-128 round constants (40 rounds for SKINNY-128-384)
  const SKINNY_RC = new Uint8Array([
    0x01, 0x03, 0x07, 0x0F, 0x1F, 0x3E, 0x3D, 0x3B, 0x37, 0x2F,
    0x1E, 0x3C, 0x39, 0x33, 0x27, 0x0E, 0x1D, 0x3A, 0x35, 0x2B,
    0x16, 0x2C, 0x18, 0x30, 0x21, 0x02, 0x05, 0x0B, 0x17, 0x2E,
    0x1C, 0x38, 0x31, 0x23, 0x06, 0x0D, 0x1B, 0x36, 0x2D, 0x1A
  ]);

  /**
   * SKINNY-128-384 encryption (40 rounds)
   * @param {Uint8Array} state - 16-byte state (modified in place)
   * @param {Uint8Array} tweakey - 48-byte tweakey (TK1 || TK2 || TK3)
   */
  function skinny128_384_encrypt(state, tweakey) {
    // Initialize state as 4x4 matrix
    const s = new Uint8Array(16);
    for (let i = 0; i < 16; ++i) {
      s[i] = state[i];
    }

    // Initialize three 16-byte tweakey states
    const tk1 = new Uint8Array(16);
    const tk2 = new Uint8Array(16);
    const tk3 = new Uint8Array(16);

    for (let i = 0; i < 16; ++i) {
      tk1[i] = tweakey[i];
      tk2[i] = tweakey[16 + i];
      tk3[i] = tweakey[32 + i];
    }

    // 56 rounds for SKINNY-128-384 (per C reference implementation)
    // Note: BouncyCastle uses 40, but C reference uses 56
    let rc = 0;  // Round constant LFSR state
    for (let round = 0; round < 56; ++round) {
      // SubCells: Apply S-box
      for (let i = 0; i < 16; ++i) {
        s[i] = SKINNY_SBOX[s[i]];
      }

      // Generate round constant using LFSR
      rc = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.Shl32(rc, 1), OpCodes.AndN(OpCodes.Shr32(rc, 5), 0x01)), OpCodes.AndN(OpCodes.Shr32(rc, 4), 0x01)), 0x01);
      rc = OpCodes.AndN(rc, 0x3F);

      // AddConstants
      s[0] ^= OpCodes.AndN(rc, 0x0f);
      s[4] ^= OpCodes.AndN(OpCodes.Shr32(rc, 4), 0x03);
      s[8] ^= 0x02;

      // AddRoundTweakey: XOR first two rows with tweakey
      for (let i = 0; i < 8; ++i) {
        s[i] ^= OpCodes.XorN(OpCodes.XorN(tk1[i], tk2[i]), tk3[i]);
      }

      // ShiftRows: Row 1 right by 1, row 2 by 2 (swap pairs), row 3 left by 1
      // Row 1: [4,5,6,7] → [7,4,5,6] (right by 1)
      let tmp = s[7];
      s[7] = s[6]; s[6] = s[5]; s[5] = s[4]; s[4] = tmp;

      // Row 2: [8,9,10,11] → [10,11,8,9] (swap pairs)
      tmp = s[8]; s[8] = s[10]; s[10] = tmp;
      tmp = s[9]; s[9] = s[11]; s[11] = tmp;

      // Row 3: [12,13,14,15] → [13,14,15,12] (left by 1)
      tmp = s[12];
      s[12] = s[13]; s[13] = s[14]; s[14] = s[15]; s[15] = tmp;

      // MixColumns
      for (let i = 0; i < 4; ++i) {
        const c0 = s[i];
        const c1 = s[4 + i];
        const c2 = s[8 + i];
        const c3 = s[12 + i];

        s[i] = OpCodes.XorN(OpCodes.XorN(c0, c2), c3);
        s[4 + i] = c0;
        s[8 + i] = OpCodes.XorN(c1, c2);
        s[12 + i] = OpCodes.XorN(c0, c2);
      }

      // Update tweakey: apply permutation and LFSR
      const tk1_new = new Uint8Array(16);
      const tk2_new = new Uint8Array(16);
      const tk3_new = new Uint8Array(16);

      for (let i = 0; i < 16; ++i) {
        const pos = SKINNY_TWEAKEY_P[i];
        tk1_new[i] = tk1[pos];
        tk2_new[i] = tk2[pos];
        tk3_new[i] = tk3[pos];
      }

      // Apply LFSR to first two rows of TK2 and TK3
      for (let i = 0; i < 8; ++i) {
        const x2 = tk2_new[i];
        const x3 = tk3_new[i];

        tk2[i] = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(OpCodes.Shl32(x2, 1), OpCodes.AndN(OpCodes.Shr32(x2, 7), 0x01)), OpCodes.AndN(OpCodes.Shr32(x2, 5), 0x01)), 0xFF);
        tk3[i] = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(OpCodes.Shr32(x3, 1), OpCodes.AndN(OpCodes.Shl32(x3, 7), 0x80)), OpCodes.AndN(OpCodes.Shl32(x3, 1), 0x80)), 0xFF);
      }

      // Copy lower rows without LFSR
      for (let i = 8; i < 16; ++i) {
        tk1[i] = tk1_new[i];
        tk2[i] = tk2_new[i];
        tk3[i] = tk3_new[i];
      }

      // Copy TK1 (no LFSR)
      for (let i = 0; i < 8; ++i) {
        tk1[i] = tk1_new[i];
      }
    }

    // Copy result back
    for (let i = 0; i < 16; ++i) {
      state[i] = s[i];
    }
  }

  /**
   * SKINNY-128-256 encryption (48 rounds)
   * @param {Uint8Array} state - 16-byte state (modified in place)
   * @param {Uint8Array} tweakey - 32-byte tweakey (TK1 || TK2)
   */
  function skinny128_256_encrypt(state, tweakey) {
    const s = new Uint8Array(16);
    for (let i = 0; i < 16; ++i) {
      s[i] = state[i];
    }

    const tk1 = new Uint8Array(16);
    const tk2 = new Uint8Array(16);

    for (let i = 0; i < 16; ++i) {
      tk1[i] = tweakey[i];
      tk2[i] = tweakey[16 + i];
    }

    // 48 rounds for SKINNY-128-256 (per specification)
    for (let round = 0; round < 48; ++round) {
      // SubCells
      for (let i = 0; i < 16; ++i) {
        s[i] = SKINNY_SBOX[s[i]];
      }

      // AddConstants
      s[0] ^= OpCodes.AndN(SKINNY_RC[round], 0x0f);
      s[4] ^= OpCodes.AndN(OpCodes.Shr32(SKINNY_RC[round], 4), 0x03);
      s[8] ^= 0x02;

      // AddRoundTweakey
      for (let i = 0; i < 8; ++i) {
        s[i] ^= OpCodes.XorN(tk1[i], tk2[i]);
      }

      // ShiftRows: Row 1 right by 1, row 2 by 2 (swap pairs), row 3 left by 1
      // Row 1: [4,5,6,7] → [7,4,5,6] (right by 1)
      let tmp = s[7];
      s[7] = s[6]; s[6] = s[5]; s[5] = s[4]; s[4] = tmp;

      // Row 2: [8,9,10,11] → [10,11,8,9] (swap pairs)
      tmp = s[8]; s[8] = s[10]; s[10] = tmp;
      tmp = s[9]; s[9] = s[11]; s[11] = tmp;

      // Row 3: [12,13,14,15] → [13,14,15,12] (left by 1)
      tmp = s[12];
      s[12] = s[13]; s[13] = s[14]; s[14] = s[15]; s[15] = tmp;

      // MixColumns
      for (let i = 0; i < 4; ++i) {
        const c0 = s[i];
        const c1 = s[4 + i];
        const c2 = s[8 + i];
        const c3 = s[12 + i];

        s[i] = OpCodes.XorN(OpCodes.XorN(c0, c2), c3);
        s[4 + i] = c0;
        s[8 + i] = OpCodes.XorN(c1, c2);
        s[12 + i] = OpCodes.XorN(c0, c2);
      }

      // Update tweakey
      const tk1_new = new Uint8Array(16);
      const tk2_new = new Uint8Array(16);

      for (let i = 0; i < 16; ++i) {
        const pos = SKINNY_TWEAKEY_P[i];
        tk1_new[i] = tk1[pos];
        tk2_new[i] = tk2[pos];
      }

      // Apply LFSR to first two rows of TK2
      for (let i = 0; i < 8; ++i) {
        const x2 = tk2_new[i];
        tk2[i] = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(OpCodes.Shl32(x2, 1), OpCodes.AndN(OpCodes.Shr32(x2, 7), 0x01)), OpCodes.AndN(OpCodes.Shr32(x2, 5), 0x01)), 0xFF);
      }

      for (let i = 8; i < 16; ++i) {
        tk1[i] = tk1_new[i];
        tk2[i] = tk2_new[i];
      }

      for (let i = 0; i < 8; ++i) {
        tk1[i] = tk1_new[i];
      }
    }

    for (let i = 0; i < 16; ++i) {
      state[i] = s[i];
    }
  }

  // ===== ROMULUS UTILITY FUNCTIONS =====

  /**
   * LFSR update for 56-bit counter (used in Romulus-N1/M1)
   * Updates CNT' = 2 * CNT mod GF(2^56) with polynomial x^56 + x^7 + x^4 + x^2 + 1
   */
  function lfsr_gf56(cnt) {
    const fb = OpCodes.AndN(OpCodes.Shr32(cnt[6], 7), 0x01);
    cnt[6] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(cnt[6], 1), OpCodes.Shr32(cnt[5], 7)), 0xFF);
    cnt[5] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(cnt[5], 1), OpCodes.Shr32(cnt[4], 7)), 0xFF);
    cnt[4] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(cnt[4], 1), OpCodes.Shr32(cnt[3], 7)), 0xFF);
    cnt[3] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(cnt[3], 1), OpCodes.Shr32(cnt[2], 7)), 0xFF);
    cnt[2] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(cnt[2], 1), OpCodes.Shr32(cnt[1], 7)), 0xFF);
    cnt[1] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(cnt[1], 1), OpCodes.Shr32(cnt[0], 7)), 0xFF);
    cnt[0] = OpCodes.AndN(OpCodes.XorN(OpCodes.Shl32(cnt[0], 1), (fb === 1 ? 0x95 : 0x00)), 0xFF);
  }

  /**
   * LFSR update for 24-bit counter (used in Romulus-N2/M2/N3/M3)
   * Updates CNT' = 2 * CNT mod GF(2^24) with polynomial x^24 + x^4 + x^3 + x + 1
   */
  function lfsr_gf24(cnt) {
    const fb = OpCodes.AndN(OpCodes.Shr32(cnt[2], 7), 0x01);
    cnt[2] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(cnt[2], 1), OpCodes.Shr32(cnt[1], 7)), 0xFF);
    cnt[1] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(cnt[1], 1), OpCodes.Shr32(cnt[0], 7)), 0xFF);
    cnt[0] = OpCodes.AndN(OpCodes.XorN(OpCodes.Shl32(cnt[0], 1), (fb === 1 ? 0x1B : 0x00)), 0xFF);
  }

  /**
   * G function: generates keystream/tag material by applying linear transformation
   * G(S) = S right-shift 1 XOR S[7] XOR S left-shift 7
   */
  function g_function(input, output, offset, length) {
    for (let i = 0; i < length; ++i) {
      const s = input[i];
      output[offset + i] = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(OpCodes.Shr32(s, 1), OpCodes.AndN(s, 0x80)), OpCodes.AndN(OpCodes.Shl32(s, 7), 0x80)), 0xFF);
    }
  }

  /**
   * Rho function: encryption mode transformation
   * S' = S XOR M, C = M XOR G(S)
   */
  function rho_encrypt(state, plaintext, ciphertext, ptOff, ctOff, length) {
    const gout = new Uint8Array(16);
    g_function(state, gout, 0, 16);

    for (let i = 0; i < length; ++i) {
      const m = plaintext[ptOff + i];
      state[i] ^= m;
      ciphertext[ctOff + i] = OpCodes.XorN(m, gout[i]);
    }
  }

  /**
   * Rho inverse function: decryption mode transformation
   * M = C XOR G(S), S' = S XOR M
   */
  function rho_decrypt(state, ciphertext, plaintext, ctOff, ptOff, length) {
    const gout = new Uint8Array(16);
    g_function(state, gout, 0, 16);

    for (let i = 0; i < length; ++i) {
      const m = OpCodes.XorN(ciphertext[ctOff + i], gout[i]);
      plaintext[ptOff + i] = m;
      state[i] ^= m;
    }
  }

  /**
   * Pad partial block (used for AD and message processing)
   */
  function pad_block(input, inOff, output, length) {
    for (let i = 0; i < 16; ++i) {
      output[i] = 0;
    }
    for (let i = 0; i < length; ++i) {
      output[i] = input[inOff + i];
    }
    output[15] = OpCodes.AndN(length, 0x0F);
  }

  // ===== ROMULUS-N IMPLEMENTATION =====

  /**
 * RomulusN cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class RomulusNInstance extends IAeadInstance {
    constructor(algorithm, variant) {
      super(algorithm);
      this.variant = variant;  // 1, 2, or 3
      this._key = null;
      this._nonce = null;
      this.aad = [];
      this.message = [];
      this.tagSize = 16;
      this.isEncrypting = true;

      // Initialize based on variant
      if (variant === 1) {
        this.nonceSize = 16;
        this.useSkinny384 = true;
        this.domain_ad_full = 0x08;
        this.domain_ad_final_full = 0x18;
        this.domain_ad_final_partial = 0x1A;
        this.domain_ad_empty = 0x1A;
        this.domain_msg_full = 0x04;
        this.domain_msg_final_full = 0x14;
        this.domain_msg_final_partial = 0x15;
        this.domain_msg_empty = 0x15;
      } else if (variant === 2) {
        this.nonceSize = 12;
        this.useSkinny384 = true;
        this.domain_ad_full = 0x48;
        this.domain_ad_final_full = 0x58;
        this.domain_ad_final_partial = 0x5A;
        this.domain_ad_empty = 0x5A;
        this.domain_msg_full = 0x44;
        this.domain_msg_final_full = 0x54;
        this.domain_msg_final_partial = 0x55;
        this.domain_msg_empty = 0x55;
      } else {  // variant === 3
        this.nonceSize = 12;
        this.useSkinny384 = false;
        this.domain_ad_full = 0x88;
        this.domain_ad_final_full = 0x98;
        this.domain_ad_final_partial = 0x9A;
        this.domain_ad_empty = 0x9A;
        this.domain_msg_full = 0x84;
        this.domain_msg_final_full = 0x94;
        this.domain_msg_final_partial = 0x95;
        this.domain_msg_empty = 0x95;
      }
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes || keyBytes.length !== 16) {
        throw new Error("Key must be 16 bytes");
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
      if (!nonceBytes || nonceBytes.length !== this.nonceSize) {
        throw new Error(`Nonce must be ${this.nonceSize} bytes`);
      }
      this._nonce = new Uint8Array(nonceBytes);
    }

    get nonce() {
      return this._nonce ? Array.from(this._nonce) : null;
    }

    set associatedData(adBytes) {
      this.aad = adBytes ? Array.from(adBytes) : [];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this.message.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");

      if (this.isEncrypting) {
        return this._encrypt();
      } else {
        return this._decrypt();
      }
    }

    _encrypt() {
      const pt = new Uint8Array(this.message);
      const ct = new Uint8Array(pt.length + 16);

      // Initialize state
      const state = new Uint8Array(16);
      const cnt = new Uint8Array(7);
      cnt[0] = 0x01;

      // Process associated data
      this._processAD(state, cnt);

      // Reset counter for message processing
      for (let i = 0; i < 7; ++i) cnt[i] = 0;
      cnt[0] = 0x01;

      // Process message
      let ptOff = 0;
      let ctOff = 0;
      let remaining = pt.length;

      if (remaining === 0) {
        // Empty message
        this._lfsr_update(cnt);
        this._skinny_encrypt(state, cnt, this.domain_msg_empty);
      } else {
        // Process full blocks
        while (remaining > 16) {
          rho_encrypt(state, pt, ct, ptOff, ctOff, 16);
          this._lfsr_update(cnt);
          this._skinny_encrypt(state, cnt, this.domain_msg_full);
          ptOff += 16;
          ctOff += 16;
          remaining -= 16;
        }

        // Process final block
        this._lfsr_update(cnt);
        if (remaining === 16) {
          rho_encrypt(state, pt, ct, ptOff, ctOff, 16);
          this._skinny_encrypt(state, cnt, this.domain_msg_final_full);
        } else {
          rho_encrypt(state, pt, ct, ptOff, ctOff, remaining);
          state[15] ^= remaining;
          this._skinny_encrypt(state, cnt, this.domain_msg_final_partial);
        }
        ctOff += remaining;
      }

      // Generate tag
      g_function(state, ct, ctOff, 16);

      // Clear sensitive data
      OpCodes.ClearArray(state);
      OpCodes.ClearArray(cnt);
      this.message = [];

      return Array.from(ct);
    }

    _decrypt() {
      if (this.message.length < 16) {
        throw new Error("Ciphertext too short (must include 16-byte tag)");
      }

      const ct = new Uint8Array(this.message);
      const pt = new Uint8Array(ct.length - 16);

      const state = new Uint8Array(16);
      const cnt = new Uint8Array(7);
      cnt[0] = 0x01;

      // Process associated data
      this._processAD(state, cnt);

      // Reset counter
      for (let i = 0; i < 7; ++i) cnt[i] = 0;
      cnt[0] = 0x01;

      // Process ciphertext
      let ctOff = 0;
      let ptOff = 0;
      let remaining = pt.length;

      if (remaining === 0) {
        this._lfsr_update(cnt);
        this._skinny_encrypt(state, cnt, this.domain_msg_empty);
      } else {
        while (remaining > 16) {
          rho_decrypt(state, ct, pt, ctOff, ptOff, 16);
          this._lfsr_update(cnt);
          this._skinny_encrypt(state, cnt, this.domain_msg_full);
          ctOff += 16;
          ptOff += 16;
          remaining -= 16;
        }

        this._lfsr_update(cnt);
        if (remaining === 16) {
          rho_decrypt(state, ct, pt, ctOff, ptOff, 16);
          this._skinny_encrypt(state, cnt, this.domain_msg_final_full);
        } else {
          rho_decrypt(state, ct, pt, ctOff, ptOff, remaining);
          state[15] ^= remaining;
          this._skinny_encrypt(state, cnt, this.domain_msg_final_partial);
        }
        ctOff += remaining;
      }

      // Verify tag
      const computedTag = new Uint8Array(16);
      g_function(state, computedTag, 0, 16);
      const receivedTag = ct.slice(ctOff, ctOff + 16);

      if (!OpCodes.ConstantTimeCompare(computedTag, receivedTag)) {
        OpCodes.ClearArray(pt);
        throw new Error("Authentication tag verification failed");
      }

      OpCodes.ClearArray(state);
      OpCodes.ClearArray(cnt);
      this.message = [];

      return Array.from(pt);
    }

    _processAD(state, cnt) {
      const ad = new Uint8Array(this.aad);

      if (ad.length === 0) {
        this._lfsr_update(cnt);
        this._skinny_encrypt(state, cnt, this.domain_ad_empty);
        return;
      }

      const blockSize = this.variant === 1 ? 32 : 28;
      const halfBlock = 16;
      let offset = 0;
      let remaining = ad.length;

      // Process full double blocks
      while (remaining > blockSize) {
        this._lfsr_update(cnt);
        // XOR first half with state
        for (let i = 0; i < halfBlock; ++i) {
          state[i] ^= ad[offset + i];
        }
        this._skinny_encrypt_with_tk2(state, cnt, ad.slice(offset + halfBlock, offset + blockSize), this.domain_ad_full);
        this._lfsr_update(cnt);
        offset += blockSize;
        remaining -= blockSize;
      }

      // Process final block(s)
      this._lfsr_update(cnt);
      if (remaining === blockSize) {
        // Full double block
        for (let i = 0; i < halfBlock; ++i) {
          state[i] ^= ad[offset + i];
        }
        this._skinny_encrypt_with_tk2(state, cnt, ad.slice(offset + halfBlock, offset + blockSize), this.domain_ad_full);
        this._lfsr_update(cnt);
        this._skinny_encrypt(state, cnt, this.domain_ad_final_full);
      } else if (remaining > halfBlock) {
        // Partial double block
        for (let i = 0; i < halfBlock; ++i) {
          state[i] ^= ad[offset + i];
        }
        const padded = new Uint8Array(blockSize - halfBlock);
        pad_block(ad, offset + halfBlock, padded, remaining - halfBlock);
        this._skinny_encrypt_with_tk2(state, cnt, padded, this.domain_ad_full);
        this._lfsr_update(cnt);
        this._skinny_encrypt(state, cnt, this.domain_ad_final_partial);
      } else if (remaining === halfBlock) {
        // Full single block
        for (let i = 0; i < halfBlock; ++i) {
          state[i] ^= ad[offset + i];
        }
        this._skinny_encrypt(state, cnt, this.domain_ad_final_full);
      } else {
        // Partial single block
        for (let i = 0; i < remaining; ++i) {
          state[i] ^= ad[offset + i];
        }
        state[15] ^= remaining;
        this._skinny_encrypt(state, cnt, this.domain_ad_final_partial);
      }
    }

    _skinny_encrypt(state, cnt, domain) {
      const tweakey = new Uint8Array(this.useSkinny384 ? 48 : 32);

      // Build tweakey: CNT || domain || nonce || key
      for (let i = 0; i < 7; ++i) {
        tweakey[i] = cnt[i];
      }
      tweakey[7] = domain;

      for (let i = 8; i < 16; ++i) {
        tweakey[i] = 0;
      }

      for (let i = 0; i < this.nonceSize; ++i) {
        tweakey[16 + i] = this._nonce[i];
      }

      for (let i = this.nonceSize; i < 16; ++i) {
        tweakey[16 + i] = 0;
      }

      const keyOffset = this.useSkinny384 ? 32 : 16;
      for (let i = 0; i < 16; ++i) {
        tweakey[keyOffset + i] = this._key[i];
      }

      if (this.useSkinny384) {
        skinny128_384_encrypt(state, tweakey);
      } else {
        skinny128_256_encrypt(state, tweakey);
      }
    }

    _skinny_encrypt_with_tk2(state, cnt, tk2Data, domain) {
      const tweakey = new Uint8Array(this.useSkinny384 ? 48 : 32);

      // TK1: CNT || domain || padding || tk2Data
      for (let i = 0; i < 7; ++i) {
        tweakey[i] = cnt[i];
      }
      tweakey[7] = domain;

      for (let i = 8; i < 16; ++i) {
        tweakey[i] = i - 8 < tk2Data.length ? tk2Data[i - 8] : 0;
      }

      // TK2: Nonce or zero
      for (let i = 0; i < 16; ++i) {
        tweakey[16 + i] = i < this.nonceSize ? this._nonce[i] : 0;
      }

      // TK3 (for 384) or continuation (for 256): Key
      const keyOffset = this.useSkinny384 ? 32 : 16;
      for (let i = 0; i < 16; ++i) {
        tweakey[keyOffset + i] = this._key[i];
      }

      if (this.useSkinny384) {
        skinny128_384_encrypt(state, tweakey);
      } else {
        skinny128_256_encrypt(state, tweakey);
      }
    }

    _lfsr_update(cnt) {
      if (this.variant === 1) {
        lfsr_gf56(cnt);
      } else {
        lfsr_gf24(cnt);
      }
    }
  }

  // ===== ALGORITHM DEFINITIONS =====

  class RomulusN1Algorithm extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "Romulus-N1";
      this.description = "NIST Lightweight Cryptography finalist using SKINNY-128-384 tweakable block cipher. Primary recommendation of Romulus family with 128-bit nonce and tag.";
      this.inventor = "Tetsu Iwata, Mustafa Khairallah, Kazuhiko Minematsu, Thomas Peyrin";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.JP;

      this.SupportedTagSizes = [new KeySize(16, 16, 0)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem("Romulus Official Site", "https://romulusae.github.io/romulus/"),
        new LinkItem("NIST LWC Finalist", "https://csrc.nist.gov/Projects/lightweight-cryptography"),
        new LinkItem("Romulus Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/romulus-spec-final.pdf")
      ];

      this.tests = [
        {
          text: "Romulus-N1 NIST KAT Count=1 (empty message, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("5D8DB25AACB3DAB45FBC2F8D77849F90")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      const instance = new RomulusNInstance(this, 1);
      instance.isEncrypting = !isInverse;
      return instance;
    }
  }

  class RomulusN2Algorithm extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "Romulus-N2";
      this.description = "Romulus variant with 96-bit nonce using SKINNY-128-384. Balanced security and performance with shorter nonce.";
      this.inventor = "Tetsu Iwata, Mustafa Khairallah, Kazuhiko Minematsu, Thomas Peyrin";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.JP;

      this.SupportedTagSizes = [new KeySize(16, 16, 0)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem("Romulus Official Site", "https://romulusae.github.io/romulus/")
      ];

      this.tests = [];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      const instance = new RomulusNInstance(this, 2);
      instance.isEncrypting = !isInverse;
      return instance;
    }
  }

  class RomulusN3Algorithm extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "Romulus-N3";
      this.description = "Romulus variant with 96-bit nonce using SKINNY-128-256. Lightweight version with reduced tweakey size.";
      this.inventor = "Tetsu Iwata, Mustafa Khairallah, Kazuhiko Minematsu, Thomas Peyrin";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.JP;

      this.SupportedTagSizes = [new KeySize(16, 16, 0)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem("Romulus Official Site", "https://romulusae.github.io/romulus/")
      ];

      this.tests = [];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      const instance = new RomulusNInstance(this, 3);
      instance.isEncrypting = !isInverse;
      return instance;
    }
  }

  // Register all algorithms
  RegisterAlgorithm(new RomulusN1Algorithm());
  RegisterAlgorithm(new RomulusN2Algorithm());
  RegisterAlgorithm(new RomulusN3Algorithm());

  return {
    RomulusN1Algorithm,
    RomulusN2Algorithm,
    RomulusN3Algorithm
  };
}));
