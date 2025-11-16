/*
 * SUNDAE-GIFT - NIST Lightweight Cryptography Candidate
 * AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * SUNDAE (Synthetic Counter in Tweak) is a deterministic authenticated encryption
 * scheme using the GIFT-128 block cipher. It provides authenticated encryption
 * without requiring a nonce (deterministic AEAD), making it suitable for key-wrap
 * and similar applications where determinism is required.
 *
 * Features:
 * - 128-bit key
 * - Variable nonce sizes: 0, 64, 96, or 128 bits (4 variants)
 * - 128-bit authentication tag
 * - Deterministic when nonce is empty
 * - GIFT-128 block cipher (bit-sliced implementation)
 * - NIST LWC Round 2 candidate
 *
 * References:
 * - NIST Lightweight Cryptography Competition (Round 2)
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

  // ===== GIFT-128 BLOCK CIPHER (Bit-Sliced) =====

  // Round constants for GIFT-128 (6-bit values)
  const GIFT128_RC = new Uint8Array([
    0x01, 0x03, 0x07, 0x0F, 0x1F, 0x3E, 0x3D, 0x3B,
    0x37, 0x2F, 0x1E, 0x3C, 0x39, 0x33, 0x27, 0x0E,
    0x1D, 0x3A, 0x35, 0x2B, 0x16, 0x2C, 0x18, 0x30,
    0x21, 0x02, 0x05, 0x0B, 0x17, 0x2E, 0x1C, 0x38,
    0x31, 0x23, 0x06, 0x0D, 0x1B, 0x36, 0x2D, 0x1A
  ]);

  // Bit permutation helper (bit_permute_step technique)
  function bitPermuteStep(value, mask, shift) {
    const t = ((value >>> shift) ^ value) & mask;
    return ((value ^ t) ^ (t << shift)) >>> 0;
  }

  // PERM3_INNER - Core permutation
  function perm3Inner(x) {
    x = bitPermuteStep(x, 0x0a0a0a0a, 3);
    x = bitPermuteStep(x, 0x00cc00cc, 6);
    x = bitPermuteStep(x, 0x0000f0f0, 12);
    x = bitPermuteStep(x, 0x000000ff, 24);
    return x >>> 0;
  }

  // Row permutations PERM0-PERM3
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

  // GIFT-128 Key Schedule
  class GIFT128KeySchedule {
    constructor(key) {
      // Mirror the fixslicing word order: 3, 1, 2, 0
      // Load as big-endian 32-bit words
      this.k = new Uint32Array(4);
      this.k[0] = OpCodes.Pack32BE(key[12], key[13], key[14], key[15]);
      this.k[1] = OpCodes.Pack32BE(key[4], key[5], key[6], key[7]);
      this.k[2] = OpCodes.Pack32BE(key[8], key[9], key[10], key[11]);
      this.k[3] = OpCodes.Pack32BE(key[0], key[1], key[2], key[3]);
    }
  }

  // GIFT-128 encryption (bit-sliced, matches reference implementation)
  function gift128bEncrypt(ks, output, input) {
    // Load input as big-endian 32-bit words
    let s0 = OpCodes.Pack32BE(input[0], input[1], input[2], input[3]);
    let s1 = OpCodes.Pack32BE(input[4], input[5], input[6], input[7]);
    let s2 = OpCodes.Pack32BE(input[8], input[9], input[10], input[11]);
    let s3 = OpCodes.Pack32BE(input[12], input[13], input[14], input[15]);

    // Initialize key schedule words (order for TINY variant)
    let w0 = ks.k[3];
    let w1 = ks.k[1];
    let w2 = ks.k[2];
    let w3 = ks.k[0];

    // Perform all 40 rounds
    for (let round = 0; round < 40; round++) {
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

      // Rotate the key schedule
      temp = w3;
      w3 = w2;
      w2 = w1;
      w1 = w0;
      w0 = (((temp & 0xFFFC0000) >>> 2) | ((temp & 0x00030000) << 14) |
            ((temp & 0x00000FFF) << 4) | ((temp & 0x0000F000) >>> 12)) >>> 0;
    }

    // Store output as big-endian
    const b0 = OpCodes.Unpack32BE(s0 >>> 0);
    const b1 = OpCodes.Unpack32BE(s1 >>> 0);
    const b2 = OpCodes.Unpack32BE(s2 >>> 0);
    const b3 = OpCodes.Unpack32BE(s3 >>> 0);

    output[0] = b0[0]; output[1] = b0[1]; output[2] = b0[2]; output[3] = b0[3];
    output[4] = b1[0]; output[5] = b1[1]; output[6] = b1[2]; output[7] = b1[3];
    output[8] = b2[0]; output[9] = b2[1]; output[10] = b2[2]; output[11] = b2[3];
    output[12] = b3[0]; output[13] = b3[1]; output[14] = b3[2]; output[15] = b3[3];
  }

  // ===== SUNDAE MODE IMPLEMENTATION =====

  // Multiply a block value by 2 in the special byte field
  // Implements the custom Galois Field multiplication used by SUNDAE
  function sundaeMultiply(B) {
    const B0 = B[0];

    // Shift left by 1 byte (rotate)
    for (let i = 0; i < 15; i++) {
      B[i] = B[i + 1];
    }
    B[15] = B0;

    // XOR feedback polynomial at positions 10, 12, 14
    B[10] ^= B0;
    B[12] ^= B0;
    B[14] ^= B0;
  }

  // XOR block operation
  function xorBlock(dest, src, length) {
    for (let i = 0; i < length; i++) {
      dest[i] ^= src[i];
    }
  }

  // Compute MAC over concatenated data buffers
  function sundaeGiftAeadMac(ks, V, data1, data1len, data2, data2len) {
    // Nothing to do if input is empty
    if (data1len === 0 && data2len === 0) {
      return;
    }

    let pos1 = 0, pos2 = 0;
    let len;

    // Format the first block (assumes data1len <= 16, which is the nonce)
    xorBlock(V, data1.slice(pos1, pos1 + data1len), data1len);
    len = 16 - data1len;
    if (len > data2len) len = data2len;
    xorBlock(V.slice(data1len), data2.slice(pos2, pos2 + len), len);
    pos2 += len;
    data2len -= len;
    len += data1len;

    // Process as many full blocks as we can, except the last
    while (data2len > 0) {
      gift128bEncrypt(ks, V, V);
      len = 16;
      if (len > data2len) len = data2len;
      xorBlock(V, data2.slice(pos2, pos2 + len), len);
      pos2 += len;
      data2len -= len;
    }

    // Pad and process the last block
    if (len < 16) {
      V[len] ^= 0x80;
      sundaeMultiply(V);
      gift128bEncrypt(ks, V, V);
    } else {
      sundaeMultiply(V);
      sundaeMultiply(V);
      gift128bEncrypt(ks, V, V);
    }
  }

  // SUNDAE-GIFT encryption
  function sundaeGiftAeadEncrypt(c, m, mlen, ad, adlen, npub, npublen, k, domainsep) {
    const ks = new GIFT128KeySchedule(k);
    const V = new Uint8Array(16);
    const T = new Uint8Array(16);
    const P = new Uint8Array(16);

    // Format and encrypt the initial domain separation block
    let domain = domainsep;
    if (adlen > 0) domain |= 0x80;
    if (mlen > 0) domain |= 0x40;
    V[0] = domain;
    for (let i = 1; i < 16; i++) V[i] = 0;
    gift128bEncrypt(ks, T, V);

    // Authenticate the nonce and associated data
    sundaeGiftAeadMac(ks, T, npub, npublen, ad, adlen);

    // Authenticate the plaintext
    sundaeGiftAeadMac(ks, T, new Uint8Array(0), 0, m, mlen);

    // Encrypt the plaintext to produce the ciphertext
    // First 16 bytes of ciphertext is the tag
    // Need to swap plaintext for current block with ciphertext/tag from previous block
    V.set(T);
    let mpos = 0;
    let cpos = 0;

    while (mlen >= 16) {
      gift128bEncrypt(ks, V, V);
      // XOR plaintext with V to get next tag/partial ciphertext
      for (let i = 0; i < 16; i++) {
        P[i] = V[i] ^ m[mpos + i];
      }
      // Write previous tag to ciphertext
      c.set(T.slice(0, 16), cpos);
      // Current P becomes next tag
      T.set(P);
      cpos += 16;
      mpos += 16;
      mlen -= 16;
    }

    if (mlen > 0) {
      gift128bEncrypt(ks, V, V);
      for (let i = 0; i < mlen; i++) {
        V[i] ^= m[mpos + i];
      }
      c.set(T.slice(0, 16), cpos);
      c.set(V.slice(0, mlen), cpos + 16);
    } else {
      c.set(T.slice(0, 16), cpos);
    }

    return 0; // Success
  }

  // SUNDAE-GIFT decryption
  function sundaeGiftAeadDecrypt(m, c, clen, ad, adlen, npub, npublen, k, domainsep) {
    // Bail out if ciphertext is too short (must contain at least the 16-byte tag)
    if (clen < 16) {
      return -1; // Authentication failure
    }

    const mlen = clen - 16;
    const ks = new GIFT128KeySchedule(k);
    const V = new Uint8Array(16);
    const T = new Uint8Array(16);

    // Extract tag from beginning of ciphertext
    T.set(c.slice(0, 16));
    let cpos = 16;
    let mpos = 0;
    let len = mlen;

    // Decrypt the ciphertext to recover plaintext
    V.set(T);
    while (len >= 16) {
      gift128bEncrypt(ks, V, V);
      for (let i = 0; i < 16; i++) {
        m[mpos + i] = c[cpos + i] ^ V[i];
      }
      cpos += 16;
      mpos += 16;
      len -= 16;
    }
    if (len > 0) {
      gift128bEncrypt(ks, V, V);
      for (let i = 0; i < len; i++) {
        m[mpos + i] = c[cpos + i] ^ V[i];
      }
    }

    // Format and encrypt the initial domain separation block
    let domain = domainsep;
    if (adlen > 0) domain |= 0x80;
    if (mlen > 0) domain |= 0x40;
    V[0] = domain;
    for (let i = 1; i < 16; i++) V[i] = 0;
    gift128bEncrypt(ks, V, V);

    // Authenticate the nonce and associated data
    sundaeGiftAeadMac(ks, V, npub, npublen, ad, adlen);

    // Authenticate the plaintext
    sundaeGiftAeadMac(ks, V, new Uint8Array(0), 0, m, mlen);

    // Check the authentication tag (constant-time comparison)
    let diff = 0;
    for (let i = 0; i < 16; i++) {
      diff |= T[i] ^ V[i];
    }

    // Clear plaintext on authentication failure
    if (diff !== 0) {
      OpCodes.ClearArray(m);
      return -1; // Authentication failure
    }

    return 0; // Success
  }

  // ===== SUNDAE-GIFT-128 ALGORITHM CLASS =====

  class SundaeGift128Algorithm extends AeadAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SUNDAE-GIFT-128";
      this.description = "Deterministic authenticated encryption using GIFT-128 block cipher with SUNDAE mode. Supports 128-bit nonce for authenticated encryption with associated data in lightweight applications.";
      this.inventor = "Subhadeep Banik, Zhenzhen Bao, Avik Chakraborti, et al.";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL; // International collaboration

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0) // SUNDAE-GIFT uses only 128-bit keys
      ];

      this.SupportedNonceSizes = [
        new KeySize(16, 16, 0) // SUNDAE-GIFT-128 uses 128-bit nonces
      ];

      this.SupportedTagSizes = [
        new KeySize(16, 16, 0) // Fixed 128-bit authentication tag
      ];

      this.SupportsDetached = false; // Tag is prepended to ciphertext

      // Documentation and references
      this.documentation = [
        new LinkItem("SUNDAE Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/sundae-gift-spec-round2.pdf"),
        new LinkItem("NIST LWC Round 2 Candidate", "https://csrc.nist.gov/Projects/lightweight-cryptography/round-2-candidates"),
        new LinkItem("GIFT-128 Specification", "https://eprint.iacr.org/2017/622.pdf")
      ];

      this.references = [
        new LinkItem("SUNDAE-GIFT Submission", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/sundae-gift-spec-round2.pdf"),
        new LinkItem("Reference Implementation", "https://github.com/rweather/lightweight-crypto")
      ];

      // Official test vectors from NIST LWC KAT files
      // Source: Reference Sources/c-cpp-source/academic/lightweight-crypto/test/kat/SUNDAE-GIFT-128.txt
      this.tests = [
        {
          text: 'SUNDAE-GIFT-128 KAT Vector #1 (Empty plaintext, empty AD)',
          uri: 'X:\\Coding\\Working Copies\\Hawkynt.git\\Hawkynt.github.io\\Cipher\\Reference Sources\\c-cpp-source\\academic\\lightweight-crypto\\test\\kat\\SUNDAE-GIFT-128.txt',
          input: OpCodes.Hex8ToBytes(""),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("F3467A06083B64358EB51659FC8D6D5D")
        },
        {
          text: 'SUNDAE-GIFT-128 KAT Vector #2 (Empty plaintext, 1-byte AD)',
          uri: 'X:\\Coding\\Working Copies\\Hawkynt.git\\Hawkynt.github.io\\Cipher\\Reference Sources\\c-cpp-source\\academic\\lightweight-crypto\\test\\kat\\SUNDAE-GIFT-128.txt',
          input: OpCodes.Hex8ToBytes(""),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("C8FD86B45B125A5EBE0B1E8D60DC44C2")
        },
        {
          text: 'SUNDAE-GIFT-128 KAT Vector #5 (Empty plaintext, 4-byte AD)',
          uri: 'X:\\Coding\\Working Copies\\Hawkynt.git\\Hawkynt.github.io\\Cipher\\Reference Sources\\c-cpp-source\\academic\\lightweight-crypto\\test\\kat\\SUNDAE-GIFT-128.txt',
          input: OpCodes.Hex8ToBytes(""),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("1893183DDD2E9178C0FC28D0A8945812")
        },
        {
          text: 'SUNDAE-GIFT-128 KAT Vector #34 (1-byte plaintext, empty AD)',
          uri: 'X:\\Coding\\Working Copies\\Hawkynt.git\\Hawkynt.github.io\\Cipher\\Reference Sources\\c-cpp-source\\academic\\lightweight-crypto\\test\\kat\\SUNDAE-GIFT-128.txt',
          input: OpCodes.Hex8ToBytes("00"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("7A6C405C76704442D565FF3B1434665B0B")
        },
        {
          text: 'SUNDAE-GIFT-128 KAT Vector #35 (1-byte plaintext, 1-byte AD)',
          uri: 'X:\\Coding\\Working Copies\\Hawkynt.git\\Hawkynt.github.io\\Cipher\\Reference Sources\\c-cpp-source\\academic\\lightweight-crypto\\test\\kat\\SUNDAE-GIFT-128.txt',
          input: OpCodes.Hex8ToBytes("00"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("23BDC419387C27EB8B17FF0EDA9843338A")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SundaeGift128Instance(this, isInverse);
    }
  }

  // ===== SUNDAE-GIFT-128 INSTANCE CLASS =====

  /**
 * SundaeGift128 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SundaeGift128Instance extends IAeadInstance {
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
      this.inputBuffer = [];
      this.tagSize = 16; // Fixed 128-bit tag
    }

    // Property setter for key
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

      // Validate key size (must be exactly 16 bytes)
      if (keyBytes.length !== 16) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes (SUNDAE-GIFT requires 16 bytes)");
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

    // Property setter for nonce
    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      // Validate nonce size (must be exactly 16 bytes for SUNDAE-GIFT-128)
      if (nonceBytes.length !== 16) {
        throw new Error("Invalid nonce size: " + nonceBytes.length + " bytes (SUNDAE-GIFT-128 requires 16 bytes)");
      }

      this._nonce = new Uint8Array(nonceBytes);
    }

    get nonce() {
      return this._nonce ? Array.from(this._nonce) : null;
    }

    // Feed/Result pattern implementation
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");
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

      // Get AAD from aad property (inherited from IAeadInstance)
      const aad = this.aad || [];

      if (this.isInverse) {
        // Decryption mode
        if (this.inputBuffer.length < 16) {
          throw new Error("Invalid ciphertext: too short (must be at least 16 bytes)");
        }

        const ciphertext = new Uint8Array(this.inputBuffer);
        const plaintext = new Uint8Array(this.inputBuffer.length - 16);

        const result = sundaeGiftAeadDecrypt(
          plaintext,
          ciphertext,
          ciphertext.length,
          new Uint8Array(aad),
          aad.length,
          this._nonce,
          this._nonce.length,
          this._key,
          0xB0 // Domain separation for SUNDAE-GIFT-128
        );

        this.inputBuffer = []; // Clear for next operation

        if (result !== 0) {
          throw new Error("Authentication tag verification failed");
        }

        return Array.from(plaintext);
      } else {
        // Encryption mode
        const plaintext = new Uint8Array(this.inputBuffer);
        const ciphertext = new Uint8Array(this.inputBuffer.length + 16); // +16 for tag

        sundaeGiftAeadEncrypt(
          ciphertext,
          plaintext,
          plaintext.length,
          new Uint8Array(aad),
          aad.length,
          this._nonce,
          this._nonce.length,
          this._key,
          0xB0 // Domain separation for SUNDAE-GIFT-128
        );

        this.inputBuffer = []; // Clear for next operation
        return Array.from(ciphertext);
      }
    }
  }

  // Register algorithm
  RegisterAlgorithm(new SundaeGift128Algorithm());

  // Export for module systems
  return {
    SundaeGift128Algorithm: SundaeGift128Algorithm,
    SundaeGift128Instance: SundaeGift128Instance
  };
}));
