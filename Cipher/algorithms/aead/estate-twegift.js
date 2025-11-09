/*
 * ESTATE-TWEGIFT-128 - NIST Lightweight Cryptography Candidate
 * AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * ESTATE (Encrypt-State-Authenticate-Translate-Extract) is an authenticated encryption
 * algorithm based on the tweakable GIFT-128 block cipher (TweGIFT-128). It uses FCBC
 * (Full CBC-MAC) authentication mode combined with OFB encryption mode to provide
 * nonce-misuse resistant AEAD.
 *
 * Features:
 * - 128-bit key, 128-bit nonce, 128-bit tag
 * - Two-pass authenticated encryption
 * - Nonce-misuse resistance (same nonce with different plaintext/AD still secure)
 * - GIFT-128 with tweaks for domain separation
 * - FCBC authentication + OFB encryption
 *
 * References:
 * - https://csrc.nist.gov/Projects/lightweight-cryptography
 * - ESTATE specification (NIST LWC submission)
 * - Reference implementation: rweather/lightweight-crypto
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

  // ===== TweGIFT-128 CONSTANTS =====

  // Round constants for GIFT-128 (bit-sliced representation)
  const GIFT128_RC = new Uint8Array([
    0x01, 0x03, 0x07, 0x0F, 0x1F, 0x3E, 0x3D, 0x3B,
    0x37, 0x2F, 0x1E, 0x3C, 0x39, 0x33, 0x27, 0x0E,
    0x1D, 0x3A, 0x35, 0x2B, 0x16, 0x2C, 0x18, 0x30,
    0x21, 0x02, 0x05, 0x0B, 0x17, 0x2E, 0x1C, 0x38,
    0x31, 0x23, 0x06, 0x0D, 0x1B, 0x36, 0x2D, 0x1A
  ]);

  // TweGIFT-128 tweak values (4-bit tweaks expanded to 32-bit)
  const GIFT128T_TWEAK_1 = 0xe1e1e1e1;
  const GIFT128T_TWEAK_2 = 0xd2d2d2d2;
  const GIFT128T_TWEAK_3 = 0x33333333;
  const GIFT128T_TWEAK_4 = 0xb4b4b4b4;
  const GIFT128T_TWEAK_5 = 0x55555555;
  const GIFT128T_TWEAK_6 = 0x66666666;
  const GIFT128T_TWEAK_7 = 0x87878787;
  const GIFT128T_TWEAK_8 = 0x78787878;

  // ===== GIFT-128 KEY SCHEDULE =====

  class GIFT128NKeySchedule {
    constructor(key) {
      // Use little-endian key byte order from HYENA/ESTATE submission
      // Mirror the fixslicing word order of 3, 1, 2, 0
      this.k = new Uint32Array(4);
      this.k[0] = OpCodes.Pack32LE(key[0], key[1], key[2], key[3]);
      this.k[1] = OpCodes.Pack32LE(key[8], key[9], key[10], key[11]);
      this.k[2] = OpCodes.Pack32LE(key[4], key[5], key[6], key[7]);
      this.k[3] = OpCodes.Pack32LE(key[12], key[13], key[14], key[15]);
    }
  }

  // ===== BIT PERMUTATION HELPERS =====

  function bitPermuteStep(value, mask, shift) {
    const t = ((value >>> shift) ^ value) & mask;
    return ((value ^ t) ^ (t << shift)) >>> 0;
  }

  function perm3Inner(x) {
    x = bitPermuteStep(x, 0x0a0a0a0a, 3);
    x = bitPermuteStep(x, 0x00cc00cc, 6);
    x = bitPermuteStep(x, 0x0000f0f0, 12);
    x = bitPermuteStep(x, 0x000000ff, 24);
    return x >>> 0;
  }

  function perm0(x) {
    return OpCodes.RotL32(perm3Inner(x), 8);
  }

  function perm1(x) {
    return OpCodes.RotL32(perm3Inner(x), 16);
  }

  function perm2(x) {
    return OpCodes.RotL32(perm3Inner(x), 24);
  }

  function perm3(x) {
    return perm3Inner(x);
  }

  // ===== GIFT-128 NIBBLE-TO-WORDS CONVERSION =====

  // Convert nibble-based representation to word-based
  function gift128nToWords(input) {
    // Load little-endian 32-bit words (HYENA nibble order)
    let s0 = OpCodes.Pack32LE(input[12], input[13], input[14], input[15]);
    let s1 = OpCodes.Pack32LE(input[8], input[9], input[10], input[11]);
    let s2 = OpCodes.Pack32LE(input[4], input[5], input[6], input[7]);
    let s3 = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);

    // Rearrange bits for word-based processing
    const permWords = function(x) {
      x = bitPermuteStep(x, 0x0a0a0a0a, 3);
      x = bitPermuteStep(x, 0x00cc00cc, 6);
      x = bitPermuteStep(x, 0x0000f0f0, 12);
      x = bitPermuteStep(x, 0x0000ff00, 8);
      return x >>> 0;
    };

    s0 = permWords(s0);
    s1 = permWords(s1);
    s2 = permWords(s2);
    s3 = permWords(s3);

    // Rearrange bytes and return as big-endian words
    const output = new Uint32Array(4);
    output[0] = OpCodes.Pack32BE(
      (s0 & 0xFF), (s1 & 0xFF), (s2 & 0xFF), (s3 & 0xFF)
    );
    output[1] = OpCodes.Pack32BE(
      ((s0 >>> 8) & 0xFF), ((s1 >>> 8) & 0xFF), ((s2 >>> 8) & 0xFF), ((s3 >>> 8) & 0xFF)
    );
    output[2] = OpCodes.Pack32BE(
      ((s0 >>> 16) & 0xFF), ((s1 >>> 16) & 0xFF), ((s2 >>> 16) & 0xFF), ((s3 >>> 16) & 0xFF)
    );
    output[3] = OpCodes.Pack32BE(
      ((s0 >>> 24) & 0xFF), ((s1 >>> 24) & 0xFF), ((s2 >>> 24) & 0xFF), ((s3 >>> 24) & 0xFF)
    );

    return output;
  }

  // Convert word-based representation to nibble-based
  function gift128nToNibbles(input) {
    // Reverse the byte arrangement
    let s0 = (input[0] & 0xFF) | ((input[1] & 0xFF) << 8) |
             ((input[2] & 0xFF) << 16) | ((input[3] & 0xFF) << 24);
    let s1 = ((input[0] >>> 8) & 0xFF) | ((input[1] >>> 8) & 0xFF) << 8 |
             ((input[2] >>> 8) & 0xFF) << 16 | ((input[3] >>> 8) & 0xFF) << 24;
    let s2 = ((input[0] >>> 16) & 0xFF) | ((input[1] >>> 16) & 0xFF) << 8 |
             ((input[2] >>> 16) & 0xFF) << 16 | ((input[3] >>> 16) & 0xFF) << 24;
    let s3 = ((input[0] >>> 24) & 0xFF) | ((input[1] >>> 24) & 0xFF) << 8 |
             ((input[2] >>> 24) & 0xFF) << 16 | ((input[3] >>> 24) & 0xFF) << 24;

    s0 = s0 >>> 0;
    s1 = s1 >>> 0;
    s2 = s2 >>> 0;
    s3 = s3 >>> 0;

    // Apply inverse of PERM_WORDS
    const invPermWords = function(x) {
      x = bitPermuteStep(x, 0x00aa00aa, 7);
      x = bitPermuteStep(x, 0x0000cccc, 14);
      x = bitPermuteStep(x, 0x00f000f0, 4);
      x = bitPermuteStep(x, 0x0000ff00, 8);
      return x >>> 0;
    };

    s0 = invPermWords(s0);
    s1 = invPermWords(s1);
    s2 = invPermWords(s2);
    s3 = invPermWords(s3);

    // Store as little-endian bytes
    const output = new Uint8Array(16);
    const b0 = OpCodes.Unpack32LE(s0);
    const b1 = OpCodes.Unpack32LE(s1);
    const b2 = OpCodes.Unpack32LE(s2);
    const b3 = OpCodes.Unpack32LE(s3);

    output[12] = b0[0]; output[13] = b0[1]; output[14] = b0[2]; output[15] = b0[3];
    output[8] = b1[0]; output[9] = b1[1]; output[10] = b1[2]; output[11] = b1[3];
    output[4] = b2[0]; output[5] = b2[1]; output[6] = b2[2]; output[7] = b2[3];
    output[0] = b3[0]; output[1] = b3[1]; output[2] = b3[2]; output[3] = b3[3];

    return output;
  }

  // ===== TweGIFT-128 ENCRYPTION =====

  function gift128tEncrypt(ks, input, tweak) {
    // Convert from nibbles to words
    const words = gift128nToWords(input);
    let s0 = words[0];
    let s1 = words[1];
    let s2 = words[2];
    let s3 = words[3];

    // Initialize key schedule
    let w0 = ks.k[3];
    let w1 = ks.k[1];
    let w2 = ks.k[2];
    let w3 = ks.k[0];

    // Perform all 40 rounds
    for (let round = 0; round < 40; ++round) {
      // SubCells - apply the S-box
      s1 ^= s0 & s2;
      s0 ^= s1 & s3;
      s2 ^= s0 | s1;
      s3 ^= s2;
      s1 ^= s3;
      s3 ^= 0xFFFFFFFF;
      s2 ^= s0 & s1;

      // Swap s0 and s3
      let temp = s0;
      s0 = s3;
      s3 = temp;

      // PermBits - apply the 128-bit permutation
      s0 = perm0(s0);
      s1 = perm1(s1);
      s2 = perm2(s2);
      s3 = perm3(s3);

      // AddRoundKey - XOR in the key schedule and round constant
      s2 ^= w1;
      s1 ^= w3;
      s3 ^= (0x80000000 ^ GIFT128_RC[round]) >>> 0;

      // AddTweak - XOR in the tweak every 5 rounds except the last
      if (((round + 1) % 5) === 0 && round < 39) {
        s0 ^= tweak;
      }

      // Rotate the key schedule
      temp = w3;
      w3 = w2;
      w2 = w1;
      w1 = w0;
      w0 = (((temp & 0xFFFC0000) >>> 2) | ((temp & 0x00030000) << 14) |
            ((temp & 0x00000FFF) << 4) | ((temp & 0x0000F000) >>> 12)) >>> 0;
    }

    // Pack result and convert to nibbles
    const outWords = new Uint32Array(4);
    outWords[0] = s0;
    outWords[1] = s1;
    outWords[2] = s2;
    outWords[3] = s3;

    return gift128nToNibbles(outWords);
  }

  // GIFT-128n encryption (tweak = 0)
  function gift128nEncrypt(ks, input) {
    return gift128tEncrypt(ks, input, 0);
  }

  // ===== ESTATE FCBC AUTHENTICATION =====

  // FCBC MAC for variable-length messages
  function estateFCBC(ks, tag, m, tweak1, tweak2) {
    let offset = 0;
    const mlen = m.length;

    // Process full blocks
    while (offset + 16 < mlen) {
      for (let i = 0; i < 16; ++i) {
        tag[i] ^= m[offset + i];
      }
      const encrypted = gift128nEncrypt(ks, tag);
      for (let i = 0; i < 16; ++i) {
        tag[i] = encrypted[i];
      }
      offset += 16;
    }

    // Process last block (full or partial)
    const remaining = mlen - offset;
    if (remaining === 16) {
      // Full last block
      for (let i = 0; i < 16; ++i) {
        tag[i] ^= m[offset + i];
      }
      const encrypted = gift128tEncrypt(ks, tag, tweak1);
      for (let i = 0; i < 16; ++i) {
        tag[i] = encrypted[i];
      }
    } else if (remaining > 0) {
      // Partial last block
      for (let i = 0; i < remaining; ++i) {
        tag[i] ^= m[offset + i];
      }
      tag[remaining] ^= 0x01; // Padding bit
      const encrypted = gift128tEncrypt(ks, tag, tweak2);
      for (let i = 0; i < 16; ++i) {
        tag[i] = encrypted[i];
      }
    }
  }

  // ESTATE authentication (computes MAC over AD and message)
  function estateAuthenticate(ks, tag, m, ad) {
    const mlen = m.length;
    const adlen = ad.length;

    // Handle case where both message and AD are empty
    if (mlen === 0 && adlen === 0) {
      const encrypted = gift128tEncrypt(ks, tag, GIFT128T_TWEAK_8);
      for (let i = 0; i < 16; ++i) {
        tag[i] = encrypted[i];
      }
      return;
    }

    // Encrypt the nonce
    const encrypted = gift128tEncrypt(ks, tag, GIFT128T_TWEAK_1);
    for (let i = 0; i < 16; ++i) {
      tag[i] = encrypted[i];
    }

    // Compute FCBC MAC over associated data
    if (adlen > 0) {
      if (mlen > 0) {
        estateFCBC(ks, tag, ad, GIFT128T_TWEAK_2, GIFT128T_TWEAK_3);
      } else {
        estateFCBC(ks, tag, ad, GIFT128T_TWEAK_6, GIFT128T_TWEAK_7);
      }
    }

    // Compute FCBC MAC over message data
    if (mlen > 0) {
      estateFCBC(ks, tag, m, GIFT128T_TWEAK_4, GIFT128T_TWEAK_5);
    }
  }

  // ===== ESTATE ENCRYPTION =====

  // OFB encryption/decryption (symmetric operation)
  function estateEncrypt(ks, tag, output, input) {
    const block = new Uint8Array(16);
    for (let i = 0; i < 16; ++i) {
      block[i] = tag[i];
    }

    let offset = 0;
    const len = input.length;

    // Process full blocks
    while (offset + 16 <= len) {
      const encrypted = gift128nEncrypt(ks, block);
      for (let i = 0; i < 16; ++i) {
        output[offset + i] = encrypted[i] ^ input[offset + i];
        block[i] = encrypted[i];
      }
      offset += 16;
    }

    // Process partial last block
    const remaining = len - offset;
    if (remaining > 0) {
      const encrypted = gift128nEncrypt(ks, block);
      for (let i = 0; i < remaining; ++i) {
        output[offset + i] = encrypted[i] ^ input[offset + i];
      }
    }
  }

  // ===== CONSTANT-TIME TAG COMPARISON =====

  function constantTimeCompare(a, b) {
    let result = 0;
    for (let i = 0; i < 16; ++i) {
      result |= a[i] ^ b[i];
    }
    return result === 0;
  }

  // ===== ALGORITHM DEFINITION =====

  class EstateTweGIFT extends AeadAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ESTATE-TWEGIFT-128";
      this.description = "Nonce-misuse resistant authenticated encryption based on tweakable GIFT-128. Uses FCBC authentication and OFB encryption to provide security even when nonces are reused with different plaintexts.";
      this.inventor = "Ashwin Jha, Eik List, Mridul Nandi";
      this.year = 2020;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.IN;

      // Algorithm capabilities
      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedNonceSizes = [new KeySize(16, 16, 1)];
      this.TagSize = 16;

      // Documentation
      this.documentation = [
        new LinkItem(
          "NIST LWC Candidate",
          "https://csrc.nist.gov/Projects/lightweight-cryptography"
        ),
        new LinkItem(
          "ESTATE Specification",
          "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/ESTATE-spec-round2.pdf"
        ),
        new LinkItem(
          "Reference Implementation",
          "https://github.com/rweather/lightweight-crypto"
        )
      ];

      // Official test vectors from NIST KAT
      this.tests = [
        // Empty plaintext, empty AD
        {
          text: "NIST KAT Count 1 - Empty PT and AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          ad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("AAB13EC6C00EA011AF831A0098A79883")
        },
        // Empty plaintext, 1 byte AD
        {
          text: "NIST KAT Count 2 - Empty PT, 1 byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          ad: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("B2DFE0A387561795DFB34A6FB60B74FD")
        },
        // Empty plaintext, 2 bytes AD
        {
          text: "NIST KAT Count 3 - Empty PT, 2 bytes AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          ad: OpCodes.Hex8ToBytes("0001"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("A3418C9A93A22348816F3C907864B5AD")
        },
        // Empty plaintext, 16 bytes AD
        {
          text: "NIST KAT Count 17 - Empty PT, 16 bytes AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          ad: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("098196B91BA5CDDFE1B66D2E403737E5")
        },
        // 1 byte plaintext, empty AD
        {
          text: "NIST KAT Count 34 - 1 byte PT, empty AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          ad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("61C85435E5E798BE247258BDE9E901E281")
        },
        // 1 byte plaintext, 1 byte AD
        {
          text: "NIST KAT Count 35 - 1 byte PT, 1 byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          ad: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("273B88F53F687B4E57E66068DC8F2810A8")
        },
        // 1 byte plaintext, 16 bytes AD
        {
          text: "NIST KAT Count 50 - 1 byte PT, 16 bytes AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          ad: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("3FB5DA8025AF0DB8ABED6100D573B0C70A")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // AEAD decryption is handled by the same instance
      }
      return new EstateTweGIFTInstance(this);
    }
  }

  // ===== ALGORITHM INSTANCE =====

  class EstateTweGIFTInstance extends IAeadInstance {
    constructor(algorithm) {
      super(algorithm);
      this._key = null;
      this._nonce = null;
      this._ad = [];
      this._inputBuffer = [];
    }

    // Key property with validation
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

    get key() {
      return this._key ? Array.from(this._key) : null;
    }

    // Nonce property with validation
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

    // Associated data property
    set associatedData(adBytes) {
      this._ad = adBytes ? Array.from(adBytes) : [];
    }

    get associatedData() {
      return this._ad.slice();
    }

    // Feed data for encryption/decryption
    Feed(data) {
      if (!data || data.length === 0) return;
      this._inputBuffer.push(...data);
    }

    // Process and return result with authentication tag
    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._nonce) {
        throw new Error("Nonce not set");
      }

      // Initialize key schedule
      const ks = new GIFT128NKeySchedule(this._key);

      // Initialize tag with nonce
      const tag = new Uint8Array(this._nonce);

      // Create input/output buffers
      const input = new Uint8Array(this._inputBuffer);
      const output = new Uint8Array(input.length);

      // Authenticate AD and plaintext
      estateAuthenticate(ks, tag, input, new Uint8Array(this._ad));

      // Encrypt the plaintext
      estateEncrypt(ks, tag, output, input);

      // Combine ciphertext and tag
      // Tag is in nibble format - reverse the 32-bit word order
      const result = new Uint8Array(output.length + 16);
      result.set(output, 0);
      // Reverse word order: swap 4-byte groups
      for (let i = 0; i < 4; ++i) {
        result[output.length + i] = tag[12 + i];
        result[output.length + 4 + i] = tag[8 + i];
        result[output.length + 8 + i] = tag[4 + i];
        result[output.length + 12 + i] = tag[i];
      }

      // Clear buffer
      this._inputBuffer = [];

      return Array.from(result);
    }

    // Decrypt and verify
    Decrypt(ciphertext) {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._nonce) {
        throw new Error("Nonce not set");
      }

      const ct = new Uint8Array(ciphertext);

      // Validate ciphertext length
      if (ct.length < 16) {
        throw new Error("Invalid ciphertext length (too short for tag)");
      }

      // Split ciphertext and tag
      const ctLen = ct.length - 16;
      const ctData = ct.slice(0, ctLen);
      const receivedTag = ct.slice(ctLen);

      // Initialize key schedule
      const ks = new GIFT128NKeySchedule(this._key);

      // Initialize tag with nonce
      const tag = new Uint8Array(this._nonce);

      // Decrypt the ciphertext
      const plaintext = new Uint8Array(ctLen);
      estateEncrypt(ks, receivedTag, plaintext, ctData);

      // Recompute authentication tag
      const computedTag = new Uint8Array(this._nonce);
      estateAuthenticate(ks, computedTag, plaintext, new Uint8Array(this._ad));

      // Verify tag in constant time
      if (!constantTimeCompare(computedTag, receivedTag)) {
        // Zero out plaintext on authentication failure
        for (let i = 0; i < plaintext.length; ++i) {
          plaintext[i] = 0;
        }
        throw new Error("Authentication tag verification failed");
      }

      return Array.from(plaintext);
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new EstateTweGIFT());

  return EstateTweGIFT;
}));
