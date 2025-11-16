/*
 * SpoC AEAD - Sponge-based Authenticated Encryption
 * Professional implementation based on NIST LWC Round 2 submission
 * (c)2006-2025 Hawkynt
 *
 * SpoC is a family of lightweight AEAD algorithms using a Beetle-like sponge construction
 * built on top of the sLiSCP-light permutation. Two variants are provided:
 *
 * - SpoC-128: 128-bit key, 128-bit nonce, 128-bit tag, sLiSCP-light-256 permutation
 * - SpoC-64: 128-bit key, 128-bit nonce, 64-bit tag, sLiSCP-light-192 permutation (primary)
 *
 * The sLiSCP-light permutation uses Simeck-based round functions for lightweight
 * cryptographic operations suitable for resource-constrained embedded devices.
 *
 * Reference: https://uwaterloo.ca/communications-security-lab/lwc/spoc
 * C Implementation: https://github.com/rweather/lightweight-crypto
 * Test Vectors: NIST LWC KAT files
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

  // ========================[ sLiSCP-light-256 Permutation ]========================

  // Round constants for sLiSCP-light-256 (18 rounds, 4 bytes per round)
  const SLISCP_LIGHT256_RC = [
    0x0f, 0x47, 0x08, 0x64, 0x04, 0xb2, 0x86, 0x6b,
    0x43, 0xb5, 0xe2, 0x6f, 0xf1, 0x37, 0x89, 0x2c,
    0x44, 0x96, 0xe6, 0xdd, 0x73, 0xee, 0xca, 0x99,
    0xe5, 0x4c, 0x17, 0xea, 0x0b, 0xf5, 0x8e, 0x0f,
    0x47, 0x07, 0x64, 0x04, 0xb2, 0x82, 0x6b, 0x43,
    0xb5, 0xa1, 0x6f, 0xf1, 0x37, 0x78, 0x2c, 0x44,
    0x96, 0xa2, 0xdd, 0x73, 0xee, 0xb9, 0x99, 0xe5,
    0x4c, 0xf2, 0xea, 0x0b, 0xf5, 0x85, 0x0f, 0x47,
    0x07, 0x23, 0x04, 0xb2, 0x82, 0xd9, 0x43, 0xb5
  ];

  // Simeck-64 round function (used in sLiSCP-light-256)
  function simeck64Round(x, y, rcBit) {
    const rotl5 = OpCodes.RotL32(x, 5);
    const rotl1 = OpCodes.RotL32(x, 1);
    y = (y ^ (rotl5 & x) ^ rotl1 ^ 0xFFFFFFFE ^ (rcBit & 1)) >>> 0;
    return y;
  }

  // Simeck-64 box (8 rounds)
  function simeck64Box(x, y, rc) {
    for (let i = 0; i < 8; ++i) {
      if (i % 2 === 0) {
        y = simeck64Round(x, y, rc);
        rc >>= 1;
      } else {
        x = simeck64Round(y, x, rc);
        rc >>= 1;
      }
    }
    return [x, y];
  }

  // sLiSCP-light-256 permutation (for SpoC-128)
  function sliscpLight256PermuteSpoc(state) {
    // Load state as 8 x 32-bit words (big-endian)
    let x0 = OpCodes.Pack32BE(state[0], state[1], state[2], state[3]);
    let x1 = OpCodes.Pack32BE(state[4], state[5], state[6], state[7]);
    let x2 = OpCodes.Pack32BE(state[16], state[17], state[18], state[19]);
    let x3 = OpCodes.Pack32BE(state[20], state[21], state[22], state[23]);
    let x4 = OpCodes.Pack32BE(state[8], state[9], state[10], state[11]);
    let x5 = OpCodes.Pack32BE(state[12], state[13], state[14], state[15]);
    let x6 = OpCodes.Pack32BE(state[24], state[25], state[26], state[27]);
    let x7 = OpCodes.Pack32BE(state[28], state[29], state[30], state[31]);

    // Perform 18 permutation rounds
    for (let round = 0; round < 18; ++round) {
      const rcOffset = round * 4;

      // Apply Simeck-64 to two 64-bit sub-blocks
      [x2, x3] = simeck64Box(x2, x3, SLISCP_LIGHT256_RC[rcOffset]);
      [x6, x7] = simeck64Box(x6, x7, SLISCP_LIGHT256_RC[rcOffset + 1]);

      // Add step constants
      x0 = (x0 ^ 0xFFFFFFFF) >>> 0;
      x1 = (x1 ^ 0xFFFFFF00 ^ SLISCP_LIGHT256_RC[rcOffset + 2]) >>> 0;
      x4 = (x4 ^ 0xFFFFFFFF) >>> 0;
      x5 = (x5 ^ 0xFFFFFF00 ^ SLISCP_LIGHT256_RC[rcOffset + 3]) >>> 0;

      // Mix the sub-blocks
      const t0 = (x0 ^ x2) >>> 0;
      const t1 = (x1 ^ x3) >>> 0;
      x0 = x2;
      x1 = x3;
      x2 = (x4 ^ x6) >>> 0;
      x3 = (x5 ^ x7) >>> 0;
      x4 = x6;
      x5 = x7;
      x6 = t0;
      x7 = t1;
    }

    // Store state back (big-endian)
    const w0 = OpCodes.Unpack32BE(x0);
    const w1 = OpCodes.Unpack32BE(x1);
    const w2 = OpCodes.Unpack32BE(x2);
    const w3 = OpCodes.Unpack32BE(x3);
    const w4 = OpCodes.Unpack32BE(x4);
    const w5 = OpCodes.Unpack32BE(x5);
    const w6 = OpCodes.Unpack32BE(x6);
    const w7 = OpCodes.Unpack32BE(x7);

    state[0] = w0[0]; state[1] = w0[1]; state[2] = w0[2]; state[3] = w0[3];
    state[4] = w1[0]; state[5] = w1[1]; state[6] = w1[2]; state[7] = w1[3];
    state[16] = w2[0]; state[17] = w2[1]; state[18] = w2[2]; state[19] = w2[3];
    state[20] = w3[0]; state[21] = w3[1]; state[22] = w3[2]; state[23] = w3[3];
    state[8] = w4[0]; state[9] = w4[1]; state[10] = w4[2]; state[11] = w4[3];
    state[12] = w5[0]; state[13] = w5[1]; state[14] = w5[2]; state[15] = w5[3];
    state[24] = w6[0]; state[25] = w6[1]; state[26] = w6[2]; state[27] = w6[3];
    state[28] = w7[0]; state[29] = w7[1]; state[30] = w7[2]; state[31] = w7[3];
  }

  // ========================[ sLiSCP-light-192 Permutation ]========================

  // Round constants for sLiSCP-light-192 (18 rounds, 4 bytes per round)
  const SLISCP_LIGHT192_RC = [
    0x07, 0x27, 0x08, 0x29, 0x04, 0x34, 0x0c, 0x1d,
    0x06, 0x2e, 0x0a, 0x33, 0x25, 0x19, 0x2f, 0x2a,
    0x17, 0x35, 0x38, 0x1f, 0x1c, 0x0f, 0x24, 0x10,
    0x12, 0x08, 0x36, 0x18, 0x3b, 0x0c, 0x0d, 0x14,
    0x26, 0x0a, 0x2b, 0x1e, 0x15, 0x2f, 0x3e, 0x31,
    0x3f, 0x38, 0x01, 0x09, 0x20, 0x24, 0x21, 0x2d,
    0x30, 0x36, 0x11, 0x1b, 0x28, 0x0d, 0x39, 0x16,
    0x3c, 0x2b, 0x05, 0x3d, 0x22, 0x3e, 0x27, 0x03,
    0x13, 0x01, 0x34, 0x02, 0x1a, 0x21, 0x2e, 0x23
  ];

  // Position mappings for SpoC-64 rate and mask bytes
  const SPOC_64_RATE_POS = [0, 1, 2, 3, 12, 13, 14, 15];
  const SPOC_64_MASK_POS = [6, 7, 8, 9, 18, 19, 20, 21];

  // Load 24-bit word (big-endian)
  function loadWord24BE(bytes, offset) {
    return ((bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2]) >>> 0;
  }

  // Store 24-bit word (big-endian)
  function storeWord24BE(bytes, offset, value) {
    bytes[offset] = (value >>> 16) & 0xFF;
    bytes[offset + 1] = (value >>> 8) & 0xFF;
    bytes[offset + 2] = value & 0xFF;
  }

  // Simeck-48 round function (used in sLiSCP-light-192)
  function simeck48Round(x, y, rcBit) {
    const rotl5 = ((x << 5) | (x >>> 19)) & 0x00FFFFFF;
    const rotl1 = ((x << 1) | (x >>> 23)) & 0x00FFFFFF;
    y = ((y ^ (rotl5 & x) ^ rotl1 ^ 0x00FFFFFE ^ (rcBit & 1)) & 0x00FFFFFF) >>> 0;
    return y;
  }

  // Simeck-48 box (6 rounds)
  function simeck48Box(x, y, rc) {
    for (let i = 0; i < 6; ++i) {
      if (i % 2 === 0) {
        y = simeck48Round(x, y, rc);
        rc >>= 1;
      } else {
        x = simeck48Round(y, x, rc);
        rc >>= 1;
      }
    }
    return [x, y];
  }

  // sLiSCP-light-192 permutation (for SpoC-64)
  function sliscpLight192Permute(state) {
    // Load state as 8 x 24-bit words (big-endian)
    let x0 = loadWord24BE(state, 0);
    let x1 = loadWord24BE(state, 3);
    let x2 = loadWord24BE(state, 6);
    let x3 = loadWord24BE(state, 9);
    let x4 = loadWord24BE(state, 12);
    let x5 = loadWord24BE(state, 15);
    let x6 = loadWord24BE(state, 18);
    let x7 = loadWord24BE(state, 21);

    // Perform 18 permutation rounds
    for (let round = 0; round < 18; ++round) {
      const rcOffset = round * 4;

      // Apply Simeck-48 to two 48-bit sub-blocks
      [x2, x3] = simeck48Box(x2, x3, SLISCP_LIGHT192_RC[rcOffset]);
      [x6, x7] = simeck48Box(x6, x7, SLISCP_LIGHT192_RC[rcOffset + 1]);

      // Add step constants
      x0 = (x0 ^ 0x00FFFFFF) >>> 0;
      x1 = (x1 ^ 0x00FFFF00 ^ SLISCP_LIGHT192_RC[rcOffset + 2]) >>> 0;
      x4 = (x4 ^ 0x00FFFFFF) >>> 0;
      x5 = (x5 ^ 0x00FFFF00 ^ SLISCP_LIGHT192_RC[rcOffset + 3]) >>> 0;

      // Mix the sub-blocks
      const t0 = (x0 ^ x2) >>> 0;
      const t1 = (x1 ^ x3) >>> 0;
      x0 = x2;
      x1 = x3;
      x2 = (x4 ^ x6) >>> 0;
      x3 = (x5 ^ x7) >>> 0;
      x4 = x6;
      x5 = x7;
      x6 = t0;
      x7 = t1;
    }

    // Store state back (big-endian)
    storeWord24BE(state, 0, x0);
    storeWord24BE(state, 3, x1);
    storeWord24BE(state, 6, x2);
    storeWord24BE(state, 9, x3);
    storeWord24BE(state, 12, x4);
    storeWord24BE(state, 15, x5);
    storeWord24BE(state, 18, x6);
    storeWord24BE(state, 21, x7);
  }

  // ========================[ SpoC-128 Algorithm ]========================

  class SpoC128 extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "SpoC-128";
      this.description = "Lightweight AEAD using sLiSCP-light-256 permutation with 128-bit tag. Sponge-based construction optimized for resource-constrained devices.";
      this.inventor = "Kalikinkar Mandal, Dhiman Saha";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "AEAD Cipher";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedNonceSizes = [new KeySize(16, 16, 1)];
      this.SupportedTagSizes = [new KeySize(16, 16, 1)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem("SpoC Specification", "https://uwaterloo.ca/communications-security-lab/lwc/spoc"),
        new LinkItem("NIST LWC Round 2 Package", "https://csrc.nist.gov/projects/lightweight-cryptography/round-2-candidates"),
        new LinkItem("C Reference Implementation", "https://github.com/rweather/lightweight-crypto")
      ];

      this.tests = [
        {
          text: "NIST LWC KAT Vector #1 - Empty plaintext and AD",
          uri: "X:/Coding/Working Copies/Hawkynt.git/Hawkynt.github.io/Cipher/Reference Sources/c-cpp-source/academic/lightweight-crypto/test/kat/SpoC-128.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes(""),
          associatedData: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("5A32211F98ADD5BA77539A4660512DCB")
        },
        {
          text: "NIST LWC KAT Vector #2 - Empty plaintext with single AD byte",
          uri: "X:/Coding/Working Copies/Hawkynt.git/Hawkynt.github.io/Cipher/Reference Sources/c-cpp-source/academic/lightweight-crypto/test/kat/SpoC-128.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes(""),
          associatedData: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("1590ABABDCADDCBF42F12F6E211407A0")
        },
        {
          text: "NIST LWC KAT Vector #34 - Single plaintext byte, empty AD",
          uri: "X:/Coding/Working Copies/Hawkynt.git/Hawkynt.github.io/Cipher/Reference Sources/c-cpp-source/academic/lightweight-crypto/test/kat/SpoC-128.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes("00"),
          associatedData: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("595154BE7E7A3515EC09E9A1BE55B02783")
        },
        {
          text: "NIST LWC KAT Vector #35 - Single plaintext byte with single AD byte",
          uri: "X:/Coding/Working Copies/Hawkynt.git/Hawkynt.github.io/Cipher/Reference Sources/c-cpp-source/academic/lightweight-crypto/test/kat/SpoC-128.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes("00"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("AE7CEED1D556F2F0607F90C89C1208A6C9")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SpoC128Instance(this, isInverse);
    }
  }

  /**
 * SpoC128 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SpoC128Instance extends IAeadInstance {
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
      this._associatedData = null;
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

    set associatedData(adBytes) {
      this._associatedData = adBytes ? [...adBytes] : null;
    }

    get associatedData() {
      return this._associatedData ? [...this._associatedData] : null;
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

      const state = new Array(32);
      const ad = this._associatedData || [];
      const adlen = ad.length;

      // Initialize state: nonce || key
      for (let i = 0; i < 16; ++i) {
        state[i] = this._nonce[i];
        state[i + 16] = this._key[i];
      }

      // Absorb associated data
      if (adlen > 0) {
        let adOffset = 0;
        let remaining = adlen;

        // Full rate blocks
        while (remaining >= 16) {
          sliscpLight256PermuteSpoc(state);
          for (let i = 0; i < 16; ++i) {
            state[i + 16] ^= ad[adOffset + i];
          }
          state[0] ^= 0x20; // Domain separation
          adOffset += 16;
          remaining -= 16;
        }

        // Partial block with padding
        if (remaining > 0) {
          sliscpLight256PermuteSpoc(state);
          for (let i = 0; i < remaining; ++i) {
            state[i + 16] ^= ad[adOffset + i];
          }
          state[remaining + 16] ^= 0x80; // Padding
          state[0] ^= 0x30; // Domain separation
        }
      }

      if (!this.isInverse) {
        // Encryption
        const plaintext = this.inputBuffer;
        const mlen = plaintext.length;
        const ciphertext = [];
        let mOffset = 0;
        let remaining = mlen;

        // Process plaintext
        if (mlen > 0) {
          // Full rate blocks
          while (remaining >= 16) {
            sliscpLight256PermuteSpoc(state);
            for (let i = 0; i < 16; ++i) {
              state[i + 16] ^= plaintext[mOffset + i];
              ciphertext.push(plaintext[mOffset + i] ^ state[i]);
            }
            state[0] ^= 0x40; // Domain separation
            mOffset += 16;
            remaining -= 16;
          }

          // Partial block with padding
          if (remaining > 0) {
            sliscpLight256PermuteSpoc(state);
            for (let i = 0; i < remaining; ++i) {
              state[i + 16] ^= plaintext[mOffset + i];
              ciphertext.push(plaintext[mOffset + i] ^ state[i]);
            }
            state[remaining + 16] ^= 0x80; // Padding
            state[0] ^= 0x50; // Domain separation
          }
        }

        // Finalize and generate tag
        state[0] ^= 0x80;
        sliscpLight256PermuteSpoc(state);

        // Append tag
        for (let i = 0; i < 16; ++i) {
          ciphertext.push(state[i + 16]);
        }

        this.inputBuffer = [];
        return ciphertext;

      } else {
        // Decryption
        const ciphertext = this.inputBuffer;
        const clen = ciphertext.length;

        if (clen < 16) {
          throw new Error("Ciphertext too short (missing tag)");
        }

        const mlen = clen - 16;
        const plaintext = [];
        let cOffset = 0;
        let remaining = mlen;

        // Process ciphertext
        if (mlen > 0) {
          // Full rate blocks
          while (remaining >= 16) {
            sliscpLight256PermuteSpoc(state);
            for (let i = 0; i < 16; ++i) {
              const ptByte = ciphertext[cOffset + i] ^ state[i];
              plaintext.push(ptByte);
              state[i + 16] ^= ptByte;
            }
            state[0] ^= 0x40; // Domain separation
            cOffset += 16;
            remaining -= 16;
          }

          // Partial block with padding
          if (remaining > 0) {
            sliscpLight256PermuteSpoc(state);
            for (let i = 0; i < remaining; ++i) {
              const ptByte = ciphertext[cOffset + i] ^ state[i];
              plaintext.push(ptByte);
              state[i + 16] ^= ptByte;
            }
            state[remaining + 16] ^= 0x80; // Padding
            state[0] ^= 0x50; // Domain separation
          }
        }

        // Finalize and verify tag
        state[0] ^= 0x80;
        sliscpLight256PermuteSpoc(state);

        // Check tag (constant-time comparison)
        let tagMatch = 0;
        for (let i = 0; i < 16; ++i) {
          tagMatch |= state[i + 16] ^ ciphertext[mlen + i];
        }

        if (tagMatch !== 0) {
          throw new Error("Authentication tag verification failed");
        }

        this.inputBuffer = [];
        return plaintext;
      }
    }
  }

  // ========================[ SpoC-64 Algorithm ]========================

  class SpoC64 extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "SpoC-64";
      this.description = "Lightweight AEAD using sLiSCP-light-192 permutation with 64-bit tag. Primary SpoC variant optimized for minimal hardware implementation.";
      this.inventor = "Kalikinkar Mandal, Dhiman Saha";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "AEAD Cipher";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedNonceSizes = [new KeySize(16, 16, 1)];
      this.SupportedTagSizes = [new KeySize(8, 8, 1)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem("SpoC Specification", "https://uwaterloo.ca/communications-security-lab/lwc/spoc"),
        new LinkItem("NIST LWC Round 2 Package", "https://csrc.nist.gov/projects/lightweight-cryptography/round-2-candidates"),
        new LinkItem("C Reference Implementation", "https://github.com/rweather/lightweight-crypto")
      ];

      this.tests = [
        {
          text: "NIST LWC KAT Vector #1 - Empty plaintext and AD",
          uri: "X:/Coding/Working Copies/Hawkynt.git/Hawkynt.github.io/Cipher/Reference Sources/c-cpp-source/academic/lightweight-crypto/test/kat/SpoC-64.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes(""),
          associatedData: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("1B8E3D0312362A22")
        },
        {
          text: "NIST LWC KAT Vector #2 - Empty plaintext with single AD byte",
          uri: "X:/Coding/Working Copies/Hawkynt.git/Hawkynt.github.io/Cipher/Reference Sources/c-cpp-source/academic/lightweight-crypto/test/kat/SpoC-64.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes(""),
          associatedData: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("E314F8572D6D1995")
        },
        {
          text: "NIST LWC KAT Vector #34 - Single plaintext byte, empty AD",
          uri: "X:/Coding/Working Copies/Hawkynt.git/Hawkynt.github.io/Cipher/Reference Sources/c-cpp-source/academic/lightweight-crypto/test/kat/SpoC-64.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes("00"),
          associatedData: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("D54568591AB6696C94")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SpoC64Instance(this, isInverse);
    }
  }

  /**
 * SpoC64 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SpoC64Instance extends IAeadInstance {
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
      this._associatedData = null;
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

    set associatedData(adBytes) {
      this._associatedData = adBytes ? [...adBytes] : null;
    }

    get associatedData() {
      return this._associatedData ? [...this._associatedData] : null;
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

      const state = new Array(24);
      const ad = this._associatedData || [];
      const adlen = ad.length;

      // Initialize state by interleaving key and nonce
      state[0] = this._nonce[0];
      state[1] = this._nonce[1];
      state[2] = this._nonce[2];
      state[3] = this._nonce[3];
      state[4] = this._key[6];
      state[5] = this._key[7];
      state[6] = this._key[0];
      state[7] = this._key[1];
      state[8] = this._key[2];
      state[9] = this._key[3];
      state[10] = this._key[4];
      state[11] = this._key[5];
      state[12] = this._nonce[4];
      state[13] = this._nonce[5];
      state[14] = this._nonce[6];
      state[15] = this._nonce[7];
      state[16] = this._key[14];
      state[17] = this._key[15];
      state[18] = this._key[8];
      state[19] = this._key[9];
      state[20] = this._key[10];
      state[21] = this._key[11];
      state[22] = this._key[12];
      state[23] = this._key[13];

      sliscpLight192Permute(state);

      // XOR remaining nonce bytes
      state[6] ^= this._nonce[8];
      state[7] ^= this._nonce[9];
      state[8] ^= this._nonce[10];
      state[9] ^= this._nonce[11];
      state[18] ^= this._nonce[12];
      state[19] ^= this._nonce[13];
      state[20] ^= this._nonce[14];
      state[21] ^= this._nonce[15];

      // Absorb associated data
      if (adlen > 0) {
        let adOffset = 0;
        let remaining = adlen;

        // Full rate blocks (8 bytes)
        while (remaining >= 8) {
          sliscpLight192Permute(state);
          state[6] ^= ad[adOffset];
          state[7] ^= ad[adOffset + 1];
          state[8] ^= ad[adOffset + 2];
          state[9] ^= ad[adOffset + 3];
          state[18] ^= ad[adOffset + 4];
          state[19] ^= ad[adOffset + 5];
          state[20] ^= ad[adOffset + 6];
          state[21] ^= ad[adOffset + 7];
          state[0] ^= 0x20; // Domain separation
          adOffset += 8;
          remaining -= 8;
        }

        // Partial block with padding
        if (remaining > 0) {
          sliscpLight192Permute(state);
          state[SPOC_64_MASK_POS[remaining]] ^= 0x80; // Padding
          state[0] ^= 0x30; // Domain separation
          for (let i = remaining - 1; i >= 0; --i) {
            state[SPOC_64_MASK_POS[i]] ^= ad[adOffset + i];
          }
        }
      }

      if (!this.isInverse) {
        // Encryption
        const plaintext = this.inputBuffer;
        const mlen = plaintext.length;
        const ciphertext = [];
        let mOffset = 0;
        let remaining = mlen;

        // Process plaintext
        if (mlen > 0) {
          // Full rate blocks
          while (remaining >= 8) {
            sliscpLight192Permute(state);
            state[6] ^= plaintext[mOffset];
            state[7] ^= plaintext[mOffset + 1];
            state[8] ^= plaintext[mOffset + 2];
            state[9] ^= plaintext[mOffset + 3];
            state[18] ^= plaintext[mOffset + 4];
            state[19] ^= plaintext[mOffset + 5];
            state[20] ^= plaintext[mOffset + 6];
            state[21] ^= plaintext[mOffset + 7];

            ciphertext.push(plaintext[mOffset] ^ state[0]);
            ciphertext.push(plaintext[mOffset + 1] ^ state[1]);
            ciphertext.push(plaintext[mOffset + 2] ^ state[2]);
            ciphertext.push(plaintext[mOffset + 3] ^ state[3]);
            ciphertext.push(plaintext[mOffset + 4] ^ state[12]);
            ciphertext.push(plaintext[mOffset + 5] ^ state[13]);
            ciphertext.push(plaintext[mOffset + 6] ^ state[14]);
            ciphertext.push(plaintext[mOffset + 7] ^ state[15]);

            state[0] ^= 0x40; // Domain separation
            mOffset += 8;
            remaining -= 8;
          }

          // Partial block with padding
          if (remaining > 0) {
            sliscpLight192Permute(state);
            state[SPOC_64_MASK_POS[remaining]] ^= 0x80; // Padding
            for (let i = remaining - 1; i >= 0; --i) {
              const mbyte = plaintext[mOffset + i];
              state[SPOC_64_MASK_POS[i]] ^= mbyte;
              ciphertext.push(mbyte ^ state[SPOC_64_RATE_POS[i]]);
            }
            state[0] ^= 0x50; // Domain separation
          }
        }

        // Finalize and generate tag
        state[0] ^= 0x80;
        sliscpLight192Permute(state);

        // Append 8-byte tag
        ciphertext.push(state[6], state[7], state[8], state[9]);
        ciphertext.push(state[18], state[19], state[20], state[21]);

        this.inputBuffer = [];
        return ciphertext;

      } else {
        // Decryption
        const ciphertext = this.inputBuffer;
        const clen = ciphertext.length;

        if (clen < 8) {
          throw new Error("Ciphertext too short (missing tag)");
        }

        const mlen = clen - 8;
        const plaintext = [];
        let cOffset = 0;
        let remaining = mlen;

        // Process ciphertext
        if (mlen > 0) {
          // Full rate blocks
          while (remaining >= 8) {
            sliscpLight192Permute(state);

            const m0 = ciphertext[cOffset] ^ state[0];
            const m1 = ciphertext[cOffset + 1] ^ state[1];
            const m2 = ciphertext[cOffset + 2] ^ state[2];
            const m3 = ciphertext[cOffset + 3] ^ state[3];
            const m4 = ciphertext[cOffset + 4] ^ state[12];
            const m5 = ciphertext[cOffset + 5] ^ state[13];
            const m6 = ciphertext[cOffset + 6] ^ state[14];
            const m7 = ciphertext[cOffset + 7] ^ state[15];

            plaintext.push(m0, m1, m2, m3, m4, m5, m6, m7);

            state[6] ^= m0;
            state[7] ^= m1;
            state[8] ^= m2;
            state[9] ^= m3;
            state[18] ^= m4;
            state[19] ^= m5;
            state[20] ^= m6;
            state[21] ^= m7;

            state[0] ^= 0x40; // Domain separation
            cOffset += 8;
            remaining -= 8;
          }

          // Partial block with padding
          if (remaining > 0) {
            sliscpLight192Permute(state);
            state[SPOC_64_MASK_POS[remaining]] ^= 0x80; // Padding
            for (let i = remaining - 1; i >= 0; --i) {
              const mbyte = ciphertext[cOffset + i] ^ state[SPOC_64_RATE_POS[i]];
              state[SPOC_64_MASK_POS[i]] ^= mbyte;
              plaintext.push(mbyte);
            }
            state[0] ^= 0x50; // Domain separation
          }
        }

        // Finalize and verify tag
        state[0] ^= 0x80;
        sliscpLight192Permute(state);

        // Check 8-byte tag (constant-time comparison)
        let tagMatch = 0;
        tagMatch |= state[6] ^ ciphertext[mlen];
        tagMatch |= state[7] ^ ciphertext[mlen + 1];
        tagMatch |= state[8] ^ ciphertext[mlen + 2];
        tagMatch |= state[9] ^ ciphertext[mlen + 3];
        tagMatch |= state[18] ^ ciphertext[mlen + 4];
        tagMatch |= state[19] ^ ciphertext[mlen + 5];
        tagMatch |= state[20] ^ ciphertext[mlen + 6];
        tagMatch |= state[21] ^ ciphertext[mlen + 7];

        if (tagMatch !== 0) {
          throw new Error("Authentication tag verification failed");
        }

        this.inputBuffer = [];
        return plaintext;
      }
    }
  }

  // Register both variants
  RegisterAlgorithm(new SpoC128());
  RegisterAlgorithm(new SpoC64());

  return {
    SpoC128: SpoC128,
    SpoC64: SpoC64
  };
}));
