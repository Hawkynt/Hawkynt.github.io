/*
 * Romulus-N1 - NIST Lightweight Cryptography Finalist
 * AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * Romulus-N1 is a nonce-based authenticated encryption with associated data (AEAD)
 * scheme based on the SKINNY-128-384 tweakable block cipher. It provides both
 * confidentiality and authenticity using a TBC-based mode of operation.
 *
 * Features:
 * - 128-bit key, 128-bit nonce
 * - 128-bit authentication tag
 * - Based on SKINNY-128-384 tweakable block cipher
 * - Supports arbitrary length messages and associated data
 * - NIST LWC Round 2 finalist
 *
 * Specification: https://romulusae.github.io/romulus/
 * Designers: Tetsu Iwata, Mustafa Khairallah, Kazuhiko Minematsu, Thomas Peyrin
 * Year: 2019
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
    root.RomulusN1 = factory(root.AlgorithmFramework, root.OpCodes);
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
          AeadAlgorithm, IAeadInstance, LinkItem, KeySize } = AlgorithmFramework;

  // ============================================================================
  // SKINNY-128 Constants and S-box
  // ============================================================================

  const SKINNY_128_BLOCK_SIZE = 16;
  const SKINNY_128_384_ROUNDS = 56;

  // SKINNY-128 8-bit S-box
  const SKINNY_SBOX = [
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
  ];

  // Note: Round constants are generated dynamically using LFSR, not from a precomputed table

  // ============================================================================
  // SKINNY-128-384 Helper Functions
  // ============================================================================

  /**
   * LFSR for updating TK2 in SKINNY-128-384
   * Formula: x' = (x << 1) XOR ((x >> 7) & 1) XOR ((x >> 5) & 1)
   */
  function skinny128_LFSR2(x) {
    return ((x << 1) ^ ((x >>> 7) & 1) ^ ((x >>> 5) & 1)) & 0xFF;
  }

  /**
   * LFSR for updating TK3 in SKINNY-128-384
   * Formula: x' = (x >> 1) XOR ((x << 7) & 0x80) XOR ((x << 1) & 0x80)
   */
  function skinny128_LFSR3(x) {
    return ((x >>> 1) ^ ((x << 7) & 0x80) ^ ((x << 1) & 0x80)) & 0xFF;
  }

  /**
   * Apply permutation PT to an array
   */
  function skinny128_permute(s) {
    const temp = [...s];
    s[0] = temp[0]; s[1] = temp[1]; s[2] = temp[2]; s[3] = temp[3];
    s[4] = temp[7]; s[5] = temp[4]; s[6] = temp[5]; s[7] = temp[6];
    s[8] = temp[10]; s[9] = temp[11]; s[10] = temp[8]; s[11] = temp[9];
    s[12] = temp[13]; s[13] = temp[14]; s[14] = temp[15]; s[15] = temp[12];
  }

  /**
   * Initialize SKINNY-128-384 key schedule
   */
  function skinny128_384_init(TK) {
    const ks = {
      TK1: new Array(16),
      TK2: new Array(16),
      TK3: new Array(16)
    };

    // Copy TK1, TK2, TK3
    for (let i = 0; i < 16; i++) {
      ks.TK1[i] = TK[i];
      ks.TK2[i] = TK[16 + i];
      ks.TK3[i] = TK[32 + i];
    }

    return ks;
  }

  /**
   * Encrypt a block with SKINNY-128-384 (56 rounds)
   */
  function skinny128_384_encrypt(ks, output, input) {
    const state = [...input];
    const TK1 = [...ks.TK1];
    const TK2 = [...ks.TK2];
    const TK3 = [...ks.TK3];

    // Generate round constants using LFSR
    let rc = 0;

    for (let round = 0; round < SKINNY_128_384_ROUNDS; round++) {
      // SubCells - Apply S-box
      for (let i = 0; i < 16; i++) {
        state[i] = SKINNY_SBOX[state[i]];
      }

      // Generate round constant using LFSR
      rc = (rc << 1) ^ ((rc >>> 5) & 1) ^ ((rc >>> 4) & 1) ^ 1;
      rc &= 0x3F;

      // AddConstants
      state[0] ^= rc & 0x0F;
      state[4] ^= (rc >>> 4) & 0x03;
      state[8] ^= 0x02;

      // AddRoundTweakey - XOR first two rows with tweakey
      for (let i = 0; i < 8; i++) {
        state[i] ^= TK1[i] ^ TK2[i] ^ TK3[i];
      }

      // ShiftRows
      // Row 1: [4,5,6,7] → [7,4,5,6] (right by 1)
      let tmp = state[7];
      state[7] = state[6]; state[6] = state[5]; state[5] = state[4]; state[4] = tmp;

      // Row 2: [8,9,10,11] → [10,11,8,9] (swap pairs)
      tmp = state[8]; state[8] = state[10]; state[10] = tmp;
      tmp = state[9]; state[9] = state[11]; state[11] = tmp;

      // Row 3: [12,13,14,15] → [13,14,15,12] (left by 1)
      tmp = state[12];
      state[12] = state[13]; state[13] = state[14]; state[14] = state[15]; state[15] = tmp;

      // MixColumns
      for (let i = 0; i < 4; i++) {
        const c0 = state[i];
        const c1 = state[4 + i];
        const c2 = state[8 + i];
        const c3 = state[12 + i];

        state[i] = c0 ^ c2 ^ c3;
        state[4 + i] = c0;
        state[8 + i] = c1 ^ c2;
        state[12 + i] = c0 ^ c2;
      }

      // Update tweakey schedule: apply permutation and LFSR
      const TK1_new = new Array(16);
      const TK2_new = new Array(16);
      const TK3_new = new Array(16);

      // Permutation PT: [9, 15, 8, 13, 10, 14, 12, 11, 0, 1, 2, 3, 4, 5, 6, 7]
      for (let i = 0; i < 16; i++) {
        const PT = [9, 15, 8, 13, 10, 14, 12, 11, 0, 1, 2, 3, 4, 5, 6, 7];
        const pos = PT[i];
        TK1_new[i] = TK1[pos];
        TK2_new[i] = TK2[pos];
        TK3_new[i] = TK3[pos];
      }

      // Apply LFSR to first two rows of TK2 and TK3
      for (let i = 0; i < 8; i++) {
        const x2 = TK2_new[i];
        const x3 = TK3_new[i];

        TK2[i] = skinny128_LFSR2(x2);
        TK3[i] = skinny128_LFSR3(x3);
      }

      // Copy lower rows without LFSR
      for (let i = 8; i < 16; i++) {
        TK1[i] = TK1_new[i];
        TK2[i] = TK2_new[i];
        TK3[i] = TK3_new[i];
      }

      // Copy TK1 upper rows (no LFSR)
      for (let i = 0; i < 8; i++) {
        TK1[i] = TK1_new[i];
      }
    }

    for (let i = 0; i < 16; i++) {
      output[i] = state[i];
    }
  }

  /**
   * Encrypt a block with SKINNY-128-384 and explicit TK2 value
   */
  function skinny128_384_encrypt_tk2(ks, output, input, tk2) {
    // Update TK2 in key schedule
    for (let i = 0; i < 16; i++) {
      ks.TK2[i] = tk2[i];
    }
    skinny128_384_encrypt(ks, output, input);
  }

  // ============================================================================
  // Romulus-N1 Specific Functions
  // ============================================================================

  /**
   * Update the 56-bit LFSR counter for Romulus-N1
   * C reference: TK1[0] = (TK1[0] << 1) ^ (mask & 0x95)
   */
  function romulus1_update_counter(TK1) {
    const mask = (TK1[6] >> 7) & 1;
    const feedback = mask ? 0x95 : 0;

    // Shift left through bytes 0-6 (56 bits)
    for (let i = 6; i > 0; i--) {
      TK1[i] = ((TK1[i] << 1) | (TK1[i - 1] >> 7)) & 0xff;
    }
    TK1[0] = ((TK1[0] << 1) ^ feedback) & 0xff;
  }

  /**
   * Apply the Romulus rho function (full block)
   */
  function romulus_rho(S, C, M) {
    for (let i = 0; i < 16; i++) {
      const s = S[i];
      const m = M[i];
      S[i] ^= m;
      C[i] = m ^ ((s >> 1) ^ (s & 0x80) ^ ((s << 7) & 0xff));
    }
  }

  /**
   * Apply the Romulus rho function (short block with padding)
   */
  function romulus_rho_short(S, C, M, len) {
    for (let i = 0; i < len; i++) {
      const s = S[i];
      const m = M[i];
      S[i] ^= m;
      C[i] = m ^ ((s >> 1) ^ (s & 0x80) ^ ((s << 7) & 0xff));
    }
    S[15] ^= len;
  }

  /**
   * Apply the inverse Romulus rho function (full block)
   */
  function romulus_rho_inverse(S, M, C) {
    for (let i = 0; i < 16; i++) {
      const s = S[i];
      const m = C[i] ^ ((s >> 1) ^ (s & 0x80) ^ ((s << 7) & 0xff));
      S[i] ^= m;
      M[i] = m;
    }
  }

  /**
   * Apply the inverse Romulus rho function (short block with padding)
   */
  function romulus_rho_inverse_short(S, M, C, len) {
    for (let i = 0; i < len; i++) {
      const s = S[i];
      const m = C[i] ^ ((s >> 1) ^ (s & 0x80) ^ ((s << 7) & 0xff));
      S[i] ^= m;
      M[i] = m;
    }
    S[15] ^= len;
  }

  /**
   * Generate authentication tag from Romulus state
   */
  function romulus_generate_tag(T, S) {
    for (let i = 0; i < 16; i++) {
      const s = S[i];
      T[i] = ((s >> 1) ^ (s & 0x80) ^ ((s << 7) & 0xff)) & 0xff;
    }
  }

  // ============================================================================
  // Romulus-N1 Algorithm Class
  // ============================================================================

  class RomulusN1Algorithm extends AeadAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Romulus-N1";
      this.description = "NIST Lightweight Cryptography Round 2 finalist providing authenticated encryption based on SKINNY-128-384 tweakable block cipher. Designed for resource-constrained environments with low area and energy requirements.";
      this.inventor = "Tetsu Iwata, Mustafa Khairallah, Kazuhiko Minematsu, Thomas Peyrin";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0)  // 128-bit key only
      ];
      this.SupportedTagSizes = [
        new KeySize(16, 16, 0)  // 128-bit tag only
      ];
      this.SupportsDetached = false;

      // Documentation and references
      this.documentation = [
        new LinkItem("Romulus Official Site", "https://romulusae.github.io/romulus/"),
        new LinkItem("NIST LWC Project", "https://csrc.nist.gov/Projects/lightweight-cryptography"),
        new LinkItem("Romulus Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/romulus-spec-final.pdf")
      ];

      this.references = [
        new LinkItem("SKINNY Cipher Specification", "https://eprint.iacr.org/2016/660.pdf"),
        new LinkItem("Reference Implementation", "https://github.com/rweather/lightweight-crypto")
      ];

      // Test vectors from official NIST LWC KAT file Romulus-N1.txt
      this.tests = [
        {
          text: "NIST LWC KAT Count=1 (empty PT, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("5D8DB25AACB3DAB45FBC2F8D77849F90")
        },
        {
          text: "NIST LWC KAT Count=2 (empty PT, 1-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("2590094BA7DD1CDFF6BDED1878B0BD55")
        },
        {
          text: "NIST LWC KAT Count=34 (1-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("896531796709540239DD66621B504BD255")
        },
        {
          text: "NIST LWC KAT Count=35 (1-byte PT, 1-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("CB4D354361E0B2E89B7BD3375F5547437E")
        }
      ];

      // Constants
      this.KEY_SIZE = 16;      // 128 bits
      this.NONCE_SIZE = 16;    // 128 bits
      this.TAG_SIZE = 16;      // 128 bits
    }

    CreateInstance(isInverse = false) {
      return new RomulusN1Instance(this, isInverse);
    }
  }

  // ============================================================================
  // Romulus-N1 Instance Class
  // ============================================================================

  class RomulusN1Instance extends IAeadInstance {
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

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      if (keyBytes.length !== 16) {
        throw new Error(`Romulus-N1 key must be 16 bytes long, got ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
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

      if (!Array.isArray(nonceBytes)) {
        throw new Error("Invalid nonce - must be byte array");
      }

      if (nonceBytes.length !== 16) {
        throw new Error(`Romulus-N1 requires exactly 16 bytes of nonce, got ${nonceBytes.length} bytes`);
      }

      this._nonce = [...nonceBytes];
    }

    get nonce() {
      return this._nonce ? [...this._nonce] : null;
    }

    // Property: associatedData
    set associatedData(adBytes) {
      if (!adBytes) {
        this._associatedData = [];
        return;
      }

      if (!Array.isArray(adBytes)) {
        throw new Error("Invalid associated data - must be byte array");
      }

      this._associatedData = [...adBytes];
    }

    get associatedData() {
      return [...this._associatedData];
    }

    /**
     * Initialize Romulus-N1 key schedule with key and optional nonce
     */
    _romulus1_init(k, npub) {
      const TK = new Array(48);

      // TK1: 56-bit LFSR counter (initialized to 0x01)
      TK[0] = 0x01;
      for (let i = 1; i < 16; i++) {
        TK[i] = 0;
      }

      // TK2: Nonce or zeros
      if (npub) {
        for (let i = 0; i < 16; i++) {
          TK[16 + i] = npub[i];
        }
      } else {
        for (let i = 0; i < 16; i++) {
          TK[16 + i] = 0;
        }
      }

      // TK3: Key
      for (let i = 0; i < 16; i++) {
        TK[32 + i] = k[i];
      }

      return skinny128_384_init(TK);
    }

    /**
     * Process associated data for Romulus-N1
     */
    _romulus_n1_process_ad(ks, S, npub, ad, adlen) {
      // Handle special case of no associated data
      if (adlen === 0) {
        romulus1_update_counter(ks.TK1);
        ks.TK1[7] = 0x1A;
        skinny128_384_encrypt_tk2(ks, S, S, npub);
        return;
      }

      // Process all double blocks except the last
      ks.TK1[7] = 0x08;
      let pos = 0;
      while (adlen > 32) {
        romulus1_update_counter(ks.TK1);
        for (let i = 0; i < 16; i++) {
          S[i] ^= ad[pos + i];
        }
        skinny128_384_encrypt_tk2(ks, S, S, ad.slice(pos + 16, pos + 32));
        romulus1_update_counter(ks.TK1);
        pos += 32;
        adlen -= 32;
      }

      // Pad and process the left-over blocks
      romulus1_update_counter(ks.TK1);
      if (adlen === 32) {
        // Left-over complete double block
        for (let i = 0; i < 16; i++) {
          S[i] ^= ad[pos + i];
        }
        skinny128_384_encrypt_tk2(ks, S, S, ad.slice(pos + 16, pos + 32));
        romulus1_update_counter(ks.TK1);
        ks.TK1[7] = 0x18;
      } else if (adlen > 16) {
        // Left-over partial double block
        const pad = new Array(16).fill(0);
        const temp = adlen - 16;
        for (let i = 0; i < 16; i++) {
          S[i] ^= ad[pos + i];
        }
        for (let i = 0; i < temp; i++) {
          pad[i] = ad[pos + 16 + i];
        }
        pad[15] = temp;
        skinny128_384_encrypt_tk2(ks, S, S, pad);
        romulus1_update_counter(ks.TK1);
        ks.TK1[7] = 0x1A;
      } else if (adlen === 16) {
        // Left-over complete single block
        for (let i = 0; i < adlen; i++) {
          S[i] ^= ad[pos + i];
        }
        ks.TK1[7] = 0x18;
      } else {
        // Left-over partial single block
        for (let i = 0; i < adlen; i++) {
          S[i] ^= ad[pos + i];
        }
        S[15] ^= adlen;
        ks.TK1[7] = 0x1A;
      }
      skinny128_384_encrypt_tk2(ks, S, S, npub);
    }

    /**
     * Encrypt plaintext with Romulus-N1
     */
    _romulus_n1_encrypt(ks, S, m, mlen) {
      const c = new Array(mlen);

      // Handle special case of no plaintext
      if (mlen === 0) {
        romulus1_update_counter(ks.TK1);
        ks.TK1[7] = 0x15;
        skinny128_384_encrypt(ks, S, S);
        return c;
      }

      // Process all blocks except the last
      ks.TK1[7] = 0x04;
      let pos = 0;
      let remaining = mlen;
      while (remaining > 16) {
        const mBlock = new Array(16);
        const cBlock = new Array(16);
        for (let i = 0; i < 16; i++) {
          mBlock[i] = m[pos + i];
        }
        romulus_rho(S, cBlock, mBlock);
        for (let i = 0; i < 16; i++) {
          c[pos + i] = cBlock[i];
        }
        romulus1_update_counter(ks.TK1);
        skinny128_384_encrypt(ks, S, S);
        pos += 16;
        remaining -= 16;
      }

      // Pad and process the last block
      romulus1_update_counter(ks.TK1);
      if (remaining < 16) {
        const mBlock = new Array(16);
        const cBlock = new Array(16);
        for (let i = 0; i < remaining; i++) {
          mBlock[i] = m[pos + i];
        }
        romulus_rho_short(S, cBlock, mBlock, remaining);
        for (let i = 0; i < remaining; i++) {
          c[pos + i] = cBlock[i];
        }
        ks.TK1[7] = 0x15;
      } else {
        const mBlock = new Array(16);
        const cBlock = new Array(16);
        for (let i = 0; i < 16; i++) {
          mBlock[i] = m[pos + i];
        }
        romulus_rho(S, cBlock, mBlock);
        for (let i = 0; i < 16; i++) {
          c[pos + i] = cBlock[i];
        }
        ks.TK1[7] = 0x14;
      }
      skinny128_384_encrypt(ks, S, S);

      return c;
    }

    /**
     * Decrypt ciphertext with Romulus-N1
     */
    _romulus_n1_decrypt(ks, S, c, clen) {
      const m = new Array(clen);

      // Handle special case of no ciphertext
      if (clen === 0) {
        romulus1_update_counter(ks.TK1);
        ks.TK1[7] = 0x15;
        skinny128_384_encrypt(ks, S, S);
        return m;
      }

      // Process all blocks except the last
      ks.TK1[7] = 0x04;
      let pos = 0;
      let remaining = clen;
      while (remaining > 16) {
        const cBlock = new Array(16);
        const mBlock = new Array(16);
        for (let i = 0; i < 16; i++) {
          cBlock[i] = c[pos + i];
        }
        romulus_rho_inverse(S, mBlock, cBlock);
        for (let i = 0; i < 16; i++) {
          m[pos + i] = mBlock[i];
        }
        romulus1_update_counter(ks.TK1);
        skinny128_384_encrypt(ks, S, S);
        pos += 16;
        remaining -= 16;
      }

      // Pad and process the last block
      romulus1_update_counter(ks.TK1);
      if (remaining < 16) {
        const cBlock = new Array(16);
        const mBlock = new Array(16);
        for (let i = 0; i < remaining; i++) {
          cBlock[i] = c[pos + i];
        }
        romulus_rho_inverse_short(S, mBlock, cBlock, remaining);
        for (let i = 0; i < remaining; i++) {
          m[pos + i] = mBlock[i];
        }
        ks.TK1[7] = 0x15;
      } else {
        const cBlock = new Array(16);
        const mBlock = new Array(16);
        for (let i = 0; i < 16; i++) {
          cBlock[i] = c[pos + i];
        }
        romulus_rho_inverse(S, mBlock, cBlock);
        for (let i = 0; i < 16; i++) {
          m[pos + i] = mBlock[i];
        }
        ks.TK1[7] = 0x14;
      }
      skinny128_384_encrypt(ks, S, S);

      return m;
    }

    // Feed/Result pattern
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._nonce) {
        throw new Error("Nonce not set");
      }

      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._nonce) {
        throw new Error("Nonce not set");
      }

      const result = [];

      if (this.isInverse) {
        // Decryption mode: input is ciphertext + tag
        if (this.inputBuffer.length < 16) {
          throw new Error("Ciphertext must include 16-byte authentication tag");
        }

        const ctLen = this.inputBuffer.length - 16;
        const ciphertext = this.inputBuffer.slice(0, ctLen);
        const receivedTag = this.inputBuffer.slice(ctLen);

        // Initialize key schedule with no nonce
        let ks = this._romulus1_init(this._key, null);

        // Process associated data
        const S = new Array(16).fill(0);
        this._romulus_n1_process_ad(ks, S, this._nonce, this._associatedData, this._associatedData.length);

        // Re-initialize with nonce
        ks = this._romulus1_init(this._key, this._nonce);

        // Decrypt ciphertext
        const plaintext = this._romulus_n1_decrypt(ks, S, ciphertext, ciphertext.length);

        // Generate and verify tag
        const computedTag = new Array(16);
        romulus_generate_tag(computedTag, S);

        // Constant-time comparison
        if (!OpCodes.ConstantTimeCompare(computedTag, receivedTag)) {
          throw new Error("Authentication tag verification failed");
        }

        result.push(...plaintext);
      } else {
        // Encryption mode
        const plaintext = this.inputBuffer;

        // Initialize key schedule with no nonce
        let ks = this._romulus1_init(this._key, null);

        // Process associated data
        const S = new Array(16).fill(0);
        this._romulus_n1_process_ad(ks, S, this._nonce, this._associatedData, this._associatedData.length);

        // Re-initialize with nonce
        ks = this._romulus1_init(this._key, this._nonce);

        // Encrypt plaintext
        const ciphertext = this._romulus_n1_encrypt(ks, S, plaintext, plaintext.length);

        // Generate tag
        const tag = new Array(16);
        romulus_generate_tag(tag, S);

        result.push(...ciphertext, ...tag);
      }

      // Clear input buffer
      this.inputBuffer = [];

      return result;
    }
  }

  // ============================================================================
  // Registration
  // ============================================================================

  RegisterAlgorithm(new RomulusN1Algorithm());

  return RomulusN1Algorithm;
}));
