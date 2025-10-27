/*
 * Ascon AEAD - NIST SP 800-232 Lightweight Cryptography Winner
 * Professional implementation following NIST SP 800-232 specification
 * (c)2006-2025 Hawkynt
 *
 * Ascon is NIST's selected lightweight cryptography standard for authenticated encryption
 * with associated data (AEAD). This implementation provides all three official variants:
 * - Ascon-128: 128-bit key, 128-bit nonce, 8-byte rate, 128-bit tag
 * - Ascon-128a: 128-bit key, 128-bit nonce, 16-byte rate, 128-bit tag (faster)
 * - Ascon-80pq: 160-bit key, 128-bit nonce, 8-byte rate, 128-bit tag (post-quantum security margin)
 *
 * Reference: https://csrc.nist.gov/pubs/sp/800/232/final
 * Specification: https://ascon.iaik.tugraz.at/
 * C Reference: https://github.com/ascon/ascon-c
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

  // 64-bit rotation (from working AsconHash256)
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

  function rotr64(low, high, positions) {
    return rotl64(low, high, 64 - positions);
  }

  // Canonical Ascon permutation (from C reference)
  class AsconPermutation {
    constructor() {
      // Ascon state: 5 x 64-bit words (stored as pairs of 32-bit values [low32, high32])
      this.S = new Array(5);
      for (let i = 0; i < 5; ++i) {
        this.S[i] = [0, 0];
      }
    }

    P(rounds) {
      for (let i = 12 - rounds; i < 12; ++i) {
        this._round(i);
      }
    }

    _round(roundNum) {
      // Round constant: ((0x0F - roundNum) << 4) | roundNum
      const c = ((0x0F - roundNum) << 4) | roundNum;

      // Add round constant to x2
      this.S[2][0] = (this.S[2][0] ^ c) >>> 0;

      // Substitution layer (canonical from C reference)
      // x0 ^= x4; x4 ^= x3; x2 ^= x1;
      this.S[0][0] = (this.S[0][0] ^ this.S[4][0]) >>> 0; this.S[0][1] = (this.S[0][1] ^ this.S[4][1]) >>> 0;
      this.S[4][0] = (this.S[4][0] ^ this.S[3][0]) >>> 0; this.S[4][1] = (this.S[4][1] ^ this.S[3][1]) >>> 0;
      this.S[2][0] = (this.S[2][0] ^ this.S[1][0]) >>> 0; this.S[2][1] = (this.S[2][1] ^ this.S[1][1]) >>> 0;

      // t0 = ~x0; t1 = ~x1; t2 = ~x2; t3 = ~x3; t4 = ~x4;
      // t0 &= x1; t1 &= x2; t2 &= x3; t3 &= x4; t4 &= x0;
      const t0_l = ((~this.S[0][0]) & this.S[1][0]) >>> 0;
      const t0_h = ((~this.S[0][1]) & this.S[1][1]) >>> 0;
      const t1_l = ((~this.S[1][0]) & this.S[2][0]) >>> 0;
      const t1_h = ((~this.S[1][1]) & this.S[2][1]) >>> 0;
      const t2_l = ((~this.S[2][0]) & this.S[3][0]) >>> 0;
      const t2_h = ((~this.S[2][1]) & this.S[3][1]) >>> 0;
      const t3_l = ((~this.S[3][0]) & this.S[4][0]) >>> 0;
      const t3_h = ((~this.S[3][1]) & this.S[4][1]) >>> 0;
      const t4_l = ((~this.S[4][0]) & this.S[0][0]) >>> 0;
      const t4_h = ((~this.S[4][1]) & this.S[0][1]) >>> 0;

      // x0 ^= t1; x1 ^= t2; x2 ^= t3; x3 ^= t4; x4 ^= t0;
      this.S[0][0] = (this.S[0][0] ^ t1_l) >>> 0; this.S[0][1] = (this.S[0][1] ^ t1_h) >>> 0;
      this.S[1][0] = (this.S[1][0] ^ t2_l) >>> 0; this.S[1][1] = (this.S[1][1] ^ t2_h) >>> 0;
      this.S[2][0] = (this.S[2][0] ^ t3_l) >>> 0; this.S[2][1] = (this.S[2][1] ^ t3_h) >>> 0;
      this.S[3][0] = (this.S[3][0] ^ t4_l) >>> 0; this.S[3][1] = (this.S[3][1] ^ t4_h) >>> 0;
      this.S[4][0] = (this.S[4][0] ^ t0_l) >>> 0; this.S[4][1] = (this.S[4][1] ^ t0_h) >>> 0;

      // x1 ^= x0; x0 ^= x4; x3 ^= x2; x2 = ~x2;
      this.S[1][0] = (this.S[1][0] ^ this.S[0][0]) >>> 0; this.S[1][1] = (this.S[1][1] ^ this.S[0][1]) >>> 0;
      this.S[0][0] = (this.S[0][0] ^ this.S[4][0]) >>> 0; this.S[0][1] = (this.S[0][1] ^ this.S[4][1]) >>> 0;
      this.S[3][0] = (this.S[3][0] ^ this.S[2][0]) >>> 0; this.S[3][1] = (this.S[3][1] ^ this.S[2][1]) >>> 0;
      this.S[2][0] = (~this.S[2][0]) >>> 0;
      this.S[2][1] = (~this.S[2][1]) >>> 0;

      // Linear diffusion layer
      const s0_l = this.S[0][0], s0_h = this.S[0][1];
      const s1_l = this.S[1][0], s1_h = this.S[1][1];
      const s2_l = this.S[2][0], s2_h = this.S[2][1];
      const s3_l = this.S[3][0], s3_h = this.S[3][1];
      const s4_l = this.S[4][0], s4_h = this.S[4][1];

      // x0 ^= rightRotate19_64(x0) ^ rightRotate28_64(x0)
      let r0 = rotr64(s0_l, s0_h, 19);
      let r1 = rotr64(s0_l, s0_h, 28);
      this.S[0][0] = (s0_l ^ r0[0] ^ r1[0]) >>> 0;
      this.S[0][1] = (s0_h ^ r0[1] ^ r1[1]) >>> 0;

      // x1 ^= rightRotate61_64(x1) ^ rightRotate39_64(x1)
      r0 = rotr64(s1_l, s1_h, 61);
      r1 = rotr64(s1_l, s1_h, 39);
      this.S[1][0] = (s1_l ^ r0[0] ^ r1[0]) >>> 0;
      this.S[1][1] = (s1_h ^ r0[1] ^ r1[1]) >>> 0;

      // x2 ^= rightRotate1_64(x2) ^ rightRotate6_64(x2)
      r0 = rotr64(s2_l, s2_h, 1);
      r1 = rotr64(s2_l, s2_h, 6);
      this.S[2][0] = (s2_l ^ r0[0] ^ r1[0]) >>> 0;
      this.S[2][1] = (s2_h ^ r0[1] ^ r1[1]) >>> 0;

      // x3 ^= rightRotate10_64(x3) ^ rightRotate17_64(x3)
      r0 = rotr64(s3_l, s3_h, 10);
      r1 = rotr64(s3_l, s3_h, 17);
      this.S[3][0] = (s3_l ^ r0[0] ^ r1[0]) >>> 0;
      this.S[3][1] = (s3_h ^ r0[1] ^ r1[1]) >>> 0;

      // x4 ^= rightRotate7_64(x4) ^ rightRotate41_64(x4)
      r0 = rotr64(s4_l, s4_h, 7);
      r1 = rotr64(s4_l, s4_h, 41);
      this.S[4][0] = (s4_l ^ r0[0] ^ r1[0]) >>> 0;
      this.S[4][1] = (s4_h ^ r0[1] ^ r1[1]) >>> 0;
    }
  }

  // Base class for all Ascon AEAD variants
  class AsconAEADBase extends AeadAlgorithm {
    constructor(variant) {
      super();
      this.variant = variant;

      this.inventor = "Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer";
      this.year = 2023;
      this.category = CategoryType.AEAD;
      this.subCategory = "Lightweight Cryptography";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.AUSTRIA;

      this.documentation = [
        new LinkItem(
          "NIST SP 800-232",
          "https://csrc.nist.gov/pubs/sp/800/232/final"
        ),
        new LinkItem(
          "Ascon Specification",
          "https://ascon.iaik.tugraz.at/"
        ),
        new LinkItem(
          "NIST LWC Winner Announcement",
          "https://www.nist.gov/news-events/news/2023/02/nist-standardizes-ascon-cryptography-protecting-iot-devices"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new AsconAEADInstance(this, isInverse);
    }
  }

  // Ascon-128 (standard variant)
  class Ascon128 extends AsconAEADBase {
    constructor() {
      super('ascon128');
      this.name = "Ascon-128 AEAD";
      this.description = "NIST's lightweight cryptography standard for authenticated encryption. Uses 128-bit keys with 8-byte rate for balanced security and performance.";

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedTagSizes = [new KeySize(16, 16, 1)];
      this.SupportsDetached = false;

      // Official test vectors from NIST LWC KAT file
      this.tests = [
        {
          text: "Ascon-128: Empty message, empty AAD (Count 1)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("E355159F292911F794CB1432A0103A8A")
        },
        {
          text: "Ascon-128: Single byte plaintext (Count 33)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("BC18C3F4E39ECA7222490D967C79BFFC92")
        },
        {
          text: "Ascon-128: 8-byte plaintext (Count 265)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("BC820DBDF7A4631C01A8807A44254B42AC6BB490DA1E000A")
        },
        {
          text: "Ascon-128: 16-byte plaintext with 8-byte AAD (Count 536)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("0001020304050607"),
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("69FFEE6F5505A4897E2EC80CBDFF67CE31614DAC97643C45940A8F9E7964613A")
        }
      ];
    }
  }

  // Ascon-128a (faster variant)
  class Ascon128a extends AsconAEADBase {
    constructor() {
      super('ascon128a');
      this.name = "Ascon-128a AEAD";
      this.description = "Faster variant of Ascon-128 with 16-byte rate. Provides same security level as Ascon-128 with improved throughput for larger messages.";

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedTagSizes = [new KeySize(16, 16, 1)];
      this.SupportsDetached = false;

      this.tests = [
        {
          text: "Ascon-128a: Empty message, empty AAD (Count 1)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("7A834E6F09210957067B10FD831F0078")
        },
        {
          text: "Ascon-128a: 16-byte plaintext (Count 529)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("6E490CFED5B3546767350CD83C4ACFBDB10F611B7D79278BD8067FC1BCDF39BE")
        },
        {
          text: "Ascon-128a: 16-byte plaintext with 8-byte AAD (Count 536)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("0001020304050607"),
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("34D3B7EDB89B1D5067C4EC9EB8052962522E547863AC130D032A06927D4261DB")
        }
      ];
    }
  }

  // Ascon-80pq (post-quantum security margin)
  class Ascon80pq extends AsconAEADBase {
    constructor() {
      super('ascon80pq');
      this.name = "Ascon-80pq AEAD";
      this.description = "Ascon variant with 160-bit key providing extra security margin against quantum attacks. Maintains same performance as Ascon-128.";

      this.SupportedKeySizes = [new KeySize(20, 20, 1)];
      this.SupportedTagSizes = [new KeySize(16, 16, 1)];
      this.SupportsDetached = false;

      this.tests = [
        {
          text: "Ascon-80pq: Empty message, empty AAD (Count 1)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F10111213"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("ABB688EFA0B9D56B33277A2C97D2146B")
        },
        {
          text: "Ascon-80pq: 8-byte plaintext (Count 265)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F10111213"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("2846418067CE93861A484E22565F161146FB6F47913803F9")
        },
        {
          text: "Ascon-80pq: 16-byte plaintext with 8-byte AAD (Count 536)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F10111213"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("0001020304050607"),
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("E16C12DD1DB74FA773415872B01CB834DBE18B2D5C6C9E77DF52E8CABB7A3283")
        }
      ];
    }
  }

  // Unified instance for all variants
  class AsconAEADInstance extends IAeadInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.variant = algorithm.variant;
      this._key = null;
      this._nonce = null;
      this._aad = [];

      // Variant-specific parameters (matching C reference)
      if (this.variant === 'ascon128') {
        this.IV = 0x80400c0600000000; // 64-bit IV
        this.keybytes = 16;
        this.rate = 8;
        this.a = 12; // Initial/final rounds
        this.b = 6;  // Intermediate rounds
      } else if (this.variant === 'ascon128a') {
        this.IV = 0x80800c0800000000;
        this.keybytes = 16;
        this.rate = 16;
        this.a = 12;
        this.b = 8;
      } else if (this.variant === 'ascon80pq') {
        this.IV = 0xa0400c0600000000;
        this.keybytes = 20;
        this.rate = 8;
        this.a = 12;
        this.b = 6;
      }

      this.perm = new AsconPermutation();
      this.inputBuffer = [];
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      if (keyBytes.length !== this.keybytes) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected ${this.keybytes})`);
      }

      this._key = [...keyBytes];
    }

    get key() { return this._key ? [...this._key] : null; }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (nonceBytes.length !== 16) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected 16)`);
      }

      this._nonce = [...nonceBytes];
    }

    get nonce() { return this._nonce ? [...this._nonce] : null; }

    set aad(aadBytes) {
      if (!aadBytes) {
        this._aad = [];
        return;
      }
      this._aad = [...aadBytes];
    }

    get aad() { return [...this._aad]; }

    // Standard AEAD interface property (alias for aad)
    set associatedData(adBytes) {
      this.aad = adBytes;
    }

    get associatedData() {
      return this.aad;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");

      if (this.isInverse) {
        // Decrypt mode
        if (this.inputBuffer.length < 16) {
          throw new Error("Ciphertext too short (must include tag)");
        }
        return this._decrypt();
      } else {
        // Encrypt mode
        return this._encrypt();
      }
    }

    _encrypt() {
      const plaintext = this.inputBuffer;
      const output = [];

      // Initialize state following C reference exactly
      // State layout: S[0]=IV, S[1-2]=key, S[3-4]=nonce (for 16-byte key)

      // S[0] = IV
      const ivHigh = Math.floor(this.IV / 0x100000000);
      const ivLow = (this.IV & 0xFFFFFFFF) >>> 0;
      this.perm.S[0] = [ivLow, ivHigh];

      if (this.keybytes === 16) {
        // Ascon-128 and Ascon-128a: 16-byte key
        // S[1] = key[0-7]
        const k1High = OpCodes.Pack32BE(this._key[0], this._key[1], this._key[2], this._key[3]);
        const k1Low = OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]);
        this.perm.S[1] = [k1Low, k1High];

        // S[2] = key[8-15]
        const k2High = OpCodes.Pack32BE(this._key[8], this._key[9], this._key[10], this._key[11]);
        const k2Low = OpCodes.Pack32BE(this._key[12], this._key[13], this._key[14], this._key[15]);
        this.perm.S[2] = [k2Low, k2High];
      } else {
        // Ascon-80pq: 20-byte key
        // First 4 bytes of key go into IV
        const k0 = OpCodes.Pack32BE(this._key[0], this._key[1], this._key[2], this._key[3]);
        this.perm.S[0][1] ^= k0;

        // S[1] = key[4-11]
        const k1High = OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]);
        const k1Low = OpCodes.Pack32BE(this._key[8], this._key[9], this._key[10], this._key[11]);
        this.perm.S[1] = [k1Low, k1High];

        // S[2] = key[12-19]
        const k2High = OpCodes.Pack32BE(this._key[12], this._key[13], this._key[14], this._key[15]);
        const k2Low = OpCodes.Pack32BE(this._key[16], this._key[17], this._key[18], this._key[19]);
        this.perm.S[2] = [k2Low, k2High];
      }

      // S[3] = nonce[0-7]
      const n0High = OpCodes.Pack32BE(this._nonce[0], this._nonce[1], this._nonce[2], this._nonce[3]);
      const n0Low = OpCodes.Pack32BE(this._nonce[4], this._nonce[5], this._nonce[6], this._nonce[7]);
      this.perm.S[3] = [n0Low, n0High];

      // S[4] = nonce[8-15]
      const n1High = OpCodes.Pack32BE(this._nonce[8], this._nonce[9], this._nonce[10], this._nonce[11]);
      const n1Low = OpCodes.Pack32BE(this._nonce[12], this._nonce[13], this._nonce[14], this._nonce[15]);
      this.perm.S[4] = [n1Low, n1High];

      // P12
      this.perm.P(this.a);

      // XOR key into S[3-4] (C reference: lw_xor_block(state.B + 24, k, ASCON128_KEY_SIZE))
      if (this.keybytes === 16) {
        const k1High = OpCodes.Pack32BE(this._key[0], this._key[1], this._key[2], this._key[3]);
        const k1Low = OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]);
        const k2High = OpCodes.Pack32BE(this._key[8], this._key[9], this._key[10], this._key[11]);
        const k2Low = OpCodes.Pack32BE(this._key[12], this._key[13], this._key[14], this._key[15]);

        this.perm.S[3][0] ^= k1Low;
        this.perm.S[3][1] ^= k1High;
        this.perm.S[4][0] ^= k2Low;
        this.perm.S[4][1] ^= k2High;
      } else {
        // Ascon-80pq
        const k0 = OpCodes.Pack32BE(this._key[0], this._key[1], this._key[2], this._key[3]);
        const k1High = OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]);
        const k1Low = OpCodes.Pack32BE(this._key[8], this._key[9], this._key[10], this._key[11]);
        const k2High = OpCodes.Pack32BE(this._key[12], this._key[13], this._key[14], this._key[15]);
        const k2Low = OpCodes.Pack32BE(this._key[16], this._key[17], this._key[18], this._key[19]);

        this.perm.S[2][1] ^= k0;
        this.perm.S[3][0] ^= k1Low;
        this.perm.S[3][1] ^= k1High;
        this.perm.S[4][0] ^= k2Low;
        this.perm.S[4][1] ^= k2High;
      }

      // Process AAD
      if (this._aad.length > 0) {
        this._absorbAAD(this._aad);
      }

      // Domain separation (C reference: state.B[39] ^= 0x01 which is S[4] byte 7)
      this.perm.S[4][0] ^= 1;

      // Encrypt plaintext
      const ciphertext = this._processData(plaintext, true);
      output.push(...ciphertext);

      // Finalize and generate tag
      const tag = this._finalize();
      output.push(...tag);

      this.inputBuffer = [];
      return output;
    }

    _decrypt() {
      const ciphertextWithTag = this.inputBuffer;
      const ciphertextLen = ciphertextWithTag.length - 16;
      const ciphertext = ciphertextWithTag.slice(0, ciphertextLen);
      const receivedTag = ciphertextWithTag.slice(ciphertextLen);

      // Initialize state (same as encrypt)
      const ivHigh = Math.floor(this.IV / 0x100000000);
      const ivLow = (this.IV & 0xFFFFFFFF) >>> 0;
      this.perm.S[0] = [ivLow, ivHigh];

      if (this.keybytes === 16) {
        const k1High = OpCodes.Pack32BE(this._key[0], this._key[1], this._key[2], this._key[3]);
        const k1Low = OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]);
        this.perm.S[1] = [k1Low, k1High];

        const k2High = OpCodes.Pack32BE(this._key[8], this._key[9], this._key[10], this._key[11]);
        const k2Low = OpCodes.Pack32BE(this._key[12], this._key[13], this._key[14], this._key[15]);
        this.perm.S[2] = [k2Low, k2High];
      } else {
        const k0 = OpCodes.Pack32BE(this._key[0], this._key[1], this._key[2], this._key[3]);
        this.perm.S[0][1] ^= k0;

        const k1High = OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]);
        const k1Low = OpCodes.Pack32BE(this._key[8], this._key[9], this._key[10], this._key[11]);
        this.perm.S[1] = [k1Low, k1High];

        const k2High = OpCodes.Pack32BE(this._key[12], this._key[13], this._key[14], this._key[15]);
        const k2Low = OpCodes.Pack32BE(this._key[16], this._key[17], this._key[18], this._key[19]);
        this.perm.S[2] = [k2Low, k2High];
      }

      const n0High = OpCodes.Pack32BE(this._nonce[0], this._nonce[1], this._nonce[2], this._nonce[3]);
      const n0Low = OpCodes.Pack32BE(this._nonce[4], this._nonce[5], this._nonce[6], this._nonce[7]);
      this.perm.S[3] = [n0Low, n0High];

      const n1High = OpCodes.Pack32BE(this._nonce[8], this._nonce[9], this._nonce[10], this._nonce[11]);
      const n1Low = OpCodes.Pack32BE(this._nonce[12], this._nonce[13], this._nonce[14], this._nonce[15]);
      this.perm.S[4] = [n1Low, n1High];

      this.perm.P(this.a);

      if (this.keybytes === 16) {
        const k1High = OpCodes.Pack32BE(this._key[0], this._key[1], this._key[2], this._key[3]);
        const k1Low = OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]);
        const k2High = OpCodes.Pack32BE(this._key[8], this._key[9], this._key[10], this._key[11]);
        const k2Low = OpCodes.Pack32BE(this._key[12], this._key[13], this._key[14], this._key[15]);

        this.perm.S[3][0] ^= k1Low;
        this.perm.S[3][1] ^= k1High;
        this.perm.S[4][0] ^= k2Low;
        this.perm.S[4][1] ^= k2High;
      } else {
        const k0 = OpCodes.Pack32BE(this._key[0], this._key[1], this._key[2], this._key[3]);
        const k1High = OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]);
        const k1Low = OpCodes.Pack32BE(this._key[8], this._key[9], this._key[10], this._key[11]);
        const k2High = OpCodes.Pack32BE(this._key[12], this._key[13], this._key[14], this._key[15]);
        const k2Low = OpCodes.Pack32BE(this._key[16], this._key[17], this._key[18], this._key[19]);

        this.perm.S[2][1] ^= k0;
        this.perm.S[3][0] ^= k1Low;
        this.perm.S[3][1] ^= k1High;
        this.perm.S[4][0] ^= k2Low;
        this.perm.S[4][1] ^= k2High;
      }

      // Process AAD
      if (this._aad.length > 0) {
        this._absorbAAD(this._aad);
      }

      // Domain separation
      this.perm.S[4][0] ^= 1;

      // Decrypt ciphertext
      const plaintext = this._processData(ciphertext, false);

      // Finalize and verify tag
      const computedTag = this._finalize();

      // Constant-time tag comparison
      let tagMatch = true;
      for (let i = 0; i < 16; ++i) {
        if (receivedTag[i] !== computedTag[i]) {
          tagMatch = false;
        }
      }

      if (!tagMatch) {
        throw new Error("MAC verification failed");
      }

      this.inputBuffer = [];
      return plaintext;
    }

    _absorbAAD(aad) {
      let offset = 0;

      // Process complete blocks
      while (offset + this.rate <= aad.length) {
        if (this.rate === 8) {
          const high = OpCodes.Pack32BE(aad[offset], aad[offset+1], aad[offset+2], aad[offset+3]);
          const low = OpCodes.Pack32BE(aad[offset+4], aad[offset+5], aad[offset+6], aad[offset+7]);
          this.perm.S[0][0] ^= low;
          this.perm.S[0][1] ^= high;
        } else {
          const high0 = OpCodes.Pack32BE(aad[offset], aad[offset+1], aad[offset+2], aad[offset+3]);
          const low0 = OpCodes.Pack32BE(aad[offset+4], aad[offset+5], aad[offset+6], aad[offset+7]);
          const high1 = OpCodes.Pack32BE(aad[offset+8], aad[offset+9], aad[offset+10], aad[offset+11]);
          const low1 = OpCodes.Pack32BE(aad[offset+12], aad[offset+13], aad[offset+14], aad[offset+15]);
          this.perm.S[0][0] ^= low0;
          this.perm.S[0][1] ^= high0;
          this.perm.S[1][0] ^= low1;
          this.perm.S[1][1] ^= high1;
        }
        this.perm.P(this.b);
        offset += this.rate;
      }

      // Process final partial block with padding (C reference style)
      const remaining = aad.length - offset;
      if (remaining > 0) {
        const padded = new Array(this.rate).fill(0);
        for (let i = 0; i < remaining; ++i) {
          padded[i] = aad[offset + i];
        }
        padded[remaining] = 0x80;

        if (this.rate === 8) {
          const high = OpCodes.Pack32BE(padded[0], padded[1], padded[2], padded[3]);
          const low = OpCodes.Pack32BE(padded[4], padded[5], padded[6], padded[7]);
          this.perm.S[0][0] ^= low;
          this.perm.S[0][1] ^= high;
        } else {
          const high0 = OpCodes.Pack32BE(padded[0], padded[1], padded[2], padded[3]);
          const low0 = OpCodes.Pack32BE(padded[4], padded[5], padded[6], padded[7]);
          const high1 = OpCodes.Pack32BE(padded[8], padded[9], padded[10], padded[11]);
          const low1 = OpCodes.Pack32BE(padded[12], padded[13], padded[14], padded[15]);
          this.perm.S[0][0] ^= low0;
          this.perm.S[0][1] ^= high0;
          this.perm.S[1][0] ^= low1;
          this.perm.S[1][1] ^= high1;
        }
        this.perm.P(this.b);
      } else {
        // remaining === 0: either empty AAD or complete rate block(s)
        // PAD(0) is always applied to the first word of the rate
        // For empty AAD: S[0]
        // For complete blocks: S[0] (after last permutation)
        this.perm.S[0][1] ^= 0x80000000;
        this.perm.P(this.b);
      }
    }

    _processData(data, encrypt) {
      const output = [];
      let offset = 0;

      // Process complete blocks
      while (offset + this.rate <= data.length) {
        if (this.rate === 8) {
          const high = OpCodes.Pack32BE(data[offset], data[offset+1], data[offset+2], data[offset+3]);
          const low = OpCodes.Pack32BE(data[offset+4], data[offset+5], data[offset+6], data[offset+7]);

          if (encrypt) {
            // Encrypt: C = P XOR S[0]
            this.perm.S[0][0] ^= low;
            this.perm.S[0][1] ^= high;

            const outHigh = OpCodes.Unpack32BE(this.perm.S[0][1]);
            const outLow = OpCodes.Unpack32BE(this.perm.S[0][0]);
            output.push(...outHigh, ...outLow);
          } else {
            // Decrypt: P = C XOR S[0], then S[0] = C
            const pHigh = (high ^ this.perm.S[0][1]) >>> 0;
            const pLow = (low ^ this.perm.S[0][0]) >>> 0;

            const outHigh = OpCodes.Unpack32BE(pHigh);
            const outLow = OpCodes.Unpack32BE(pLow);
            output.push(...outHigh, ...outLow);

            this.perm.S[0][0] = low;
            this.perm.S[0][1] = high;
          }
        } else {
          const high0 = OpCodes.Pack32BE(data[offset], data[offset+1], data[offset+2], data[offset+3]);
          const low0 = OpCodes.Pack32BE(data[offset+4], data[offset+5], data[offset+6], data[offset+7]);
          const high1 = OpCodes.Pack32BE(data[offset+8], data[offset+9], data[offset+10], data[offset+11]);
          const low1 = OpCodes.Pack32BE(data[offset+12], data[offset+13], data[offset+14], data[offset+15]);

          if (encrypt) {
            this.perm.S[0][0] ^= low0;
            this.perm.S[0][1] ^= high0;
            this.perm.S[1][0] ^= low1;
            this.perm.S[1][1] ^= high1;

            const out0High = OpCodes.Unpack32BE(this.perm.S[0][1]);
            const out0Low = OpCodes.Unpack32BE(this.perm.S[0][0]);
            const out1High = OpCodes.Unpack32BE(this.perm.S[1][1]);
            const out1Low = OpCodes.Unpack32BE(this.perm.S[1][0]);
            output.push(...out0High, ...out0Low, ...out1High, ...out1Low);
          } else {
            const p0High = (high0 ^ this.perm.S[0][1]) >>> 0;
            const p0Low = (low0 ^ this.perm.S[0][0]) >>> 0;
            const p1High = (high1 ^ this.perm.S[1][1]) >>> 0;
            const p1Low = (low1 ^ this.perm.S[1][0]) >>> 0;

            const out0High = OpCodes.Unpack32BE(p0High);
            const out0Low = OpCodes.Unpack32BE(p0Low);
            const out1High = OpCodes.Unpack32BE(p1High);
            const out1Low = OpCodes.Unpack32BE(p1Low);
            output.push(...out0High, ...out0Low, ...out1High, ...out1Low);

            this.perm.S[0][0] = low0;
            this.perm.S[0][1] = high0;
            this.perm.S[1][0] = low1;
            this.perm.S[1][1] = high1;
          }
        }

        this.perm.P(this.b);
        offset += this.rate;
      }

      // Process final partial block with padding
      const remaining = data.length - offset;
      if (remaining > 0) {
        const padded = new Array(this.rate).fill(0);
        for (let i = 0; i < remaining; ++i) {
          padded[i] = data[offset + i];
        }
        padded[remaining] = 0x80;

        if (this.rate === 8) {
          const high = OpCodes.Pack32BE(padded[0], padded[1], padded[2], padded[3]);
          const low = OpCodes.Pack32BE(padded[4], padded[5], padded[6], padded[7]);

          if (encrypt) {
            this.perm.S[0][0] ^= low;
            this.perm.S[0][1] ^= high;

            const outHigh = OpCodes.Unpack32BE(this.perm.S[0][1]);
            const outLow = OpCodes.Unpack32BE(this.perm.S[0][0]);
            const outBlock = [...outHigh, ...outLow];
            for (let i = 0; i < remaining; ++i) {
              output.push(outBlock[i]);
            }
          } else {
            // Decrypt partial block following BouncyCastle ProcessFinalDecrypt exactly
            // Step 1: XOR padding into state at position `remaining`
            if (remaining < 4) {
              this.perm.S[0][1] ^= (0x80000000 >>> (remaining << 3)) >>> 0;
            } else {
              this.perm.S[0][0] ^= (0x80000000 >>> ((remaining - 4) << 3)) >>> 0;
            }

            // Step 2: Pack ciphertext bytes
            for (let i = 0; i < remaining; ++i) {
              padded[i] = data[offset + i];
            }
            const cHigh = OpCodes.Pack32BE(padded[0], padded[1], padded[2], padded[3]);
            const cLow = OpCodes.Pack32BE(padded[4], padded[5], padded[6], padded[7]);

            // Step 3: XOR ciphertext into state
            this.perm.S[0][0] ^= cLow;
            this.perm.S[0][1] ^= cHigh;

            // Step 4: Output plaintext (state XOR ciphertext = plaintext)
            const pHigh = OpCodes.Unpack32BE(this.perm.S[0][1]);
            const pLow = OpCodes.Unpack32BE(this.perm.S[0][0]);
            for (let i = 0; i < remaining; ++i) {
              if (i < 4) {
                output.push(pHigh[i]);
              } else {
                output.push(pLow[i - 4]);
              }
            }

            // Step 5: Mask to clear the ciphertext bytes (keep padding and lower state)
            const maskLow = remaining <= 4 ? 0 : (0xFFFFFFFF >>> ((remaining - 4) << 3));
            const maskHigh = remaining < 4 ? (0xFFFFFFFF >>> (remaining << 3)) : 0xFFFFFFFF;
            this.perm.S[0][0] &= maskLow;
            this.perm.S[0][1] &= maskHigh;

            // Step 6: XOR ciphertext back to restore it in the cleared position
            this.perm.S[0][0] ^= cLow;
            this.perm.S[0][1] ^= cHigh;
          }
        } else {
          // 16-byte rate
          const high0 = OpCodes.Pack32BE(padded[0], padded[1], padded[2], padded[3]);
          const low0 = OpCodes.Pack32BE(padded[4], padded[5], padded[6], padded[7]);
          const high1 = OpCodes.Pack32BE(padded[8], padded[9], padded[10], padded[11]);
          const low1 = OpCodes.Pack32BE(padded[12], padded[13], padded[14], padded[15]);

          if (encrypt) {
            this.perm.S[0][0] ^= low0;
            this.perm.S[0][1] ^= high0;
            this.perm.S[1][0] ^= low1;
            this.perm.S[1][1] ^= high1;

            const out0High = OpCodes.Unpack32BE(this.perm.S[0][1]);
            const out0Low = OpCodes.Unpack32BE(this.perm.S[0][0]);
            const out1High = OpCodes.Unpack32BE(this.perm.S[1][1]);
            const out1Low = OpCodes.Unpack32BE(this.perm.S[1][0]);
            const outBlock = [...out0High, ...out0Low, ...out1High, ...out1Low];
            for (let i = 0; i < remaining; ++i) {
              output.push(outBlock[i]);
            }
          } else {
            const s0High = OpCodes.Unpack32BE(this.perm.S[0][1]);
            const s0Low = OpCodes.Unpack32BE(this.perm.S[0][0]);
            const s1High = OpCodes.Unpack32BE(this.perm.S[1][1]);
            const s1Low = OpCodes.Unpack32BE(this.perm.S[1][0]);
            const sBlock = [...s0High, ...s0Low, ...s1High, ...s1Low];

            for (let i = 0; i < remaining; ++i) {
              output.push(data[offset + i] ^ sBlock[i]);
              padded[i] = data[offset + i];
            }

            const c0High = OpCodes.Pack32BE(padded[0], padded[1], padded[2], padded[3]);
            const c0Low = OpCodes.Pack32BE(padded[4], padded[5], padded[6], padded[7]);
            const c1High = OpCodes.Pack32BE(padded[8], padded[9], padded[10], padded[11]);
            const c1Low = OpCodes.Pack32BE(padded[12], padded[13], padded[14], padded[15]);
            this.perm.S[0][0] ^= c0Low;
            this.perm.S[0][1] ^= c0High;
            this.perm.S[1][0] ^= c1Low;
            this.perm.S[1][1] ^= c1High;
          }
        }
      } else {
        // remaining === 0: either empty message or complete rate block(s)
        // PAD(0) is always applied to the first word of the rate
        // For empty message: S[0]
        // For complete blocks: S[0] (after last permutation)
        this.perm.S[0][1] ^= 0x80000000;
      }

      return output;
    }

    _finalize() {
      // XOR key into state (C reference: lw_xor_block(state.B + 8, k, ASCON128_KEY_SIZE))
      // For Ascon-128: state.B[8-23] = S[1-2]
      // For Ascon-128a: state.B[16-31] = S[2-3]

      if (this.keybytes === 16) {
        const k1High = OpCodes.Pack32BE(this._key[0], this._key[1], this._key[2], this._key[3]);
        const k1Low = OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]);
        const k2High = OpCodes.Pack32BE(this._key[8], this._key[9], this._key[10], this._key[11]);
        const k2Low = OpCodes.Pack32BE(this._key[12], this._key[13], this._key[14], this._key[15]);

        if (this.variant === 'ascon128a') {
          // Ascon-128a: XOR at S[2-3]
          this.perm.S[2][0] ^= k1Low;
          this.perm.S[2][1] ^= k1High;
          this.perm.S[3][0] ^= k2Low;
          this.perm.S[3][1] ^= k2High;
        } else {
          // Ascon-128: XOR at S[1-2]
          this.perm.S[1][0] ^= k1Low;
          this.perm.S[1][1] ^= k1High;
          this.perm.S[2][0] ^= k2Low;
          this.perm.S[2][1] ^= k2High;
        }
      } else {
        // Ascon-80pq: XOR at S[1-3]
        const k1High = OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]);
        const k1Low = OpCodes.Pack32BE(this._key[8], this._key[9], this._key[10], this._key[11]);
        const k2High = OpCodes.Pack32BE(this._key[12], this._key[13], this._key[14], this._key[15]);
        const k2Low = OpCodes.Pack32BE(this._key[16], this._key[17], this._key[18], this._key[19]);

        // state.B[8-27] = S[1-3] + 4 bytes
        this.perm.S[1][0] ^= k1Low;
        this.perm.S[1][1] ^= k1High;
        this.perm.S[2][0] ^= k2Low;
        this.perm.S[2][1] ^= k2High;
      }

      // Final permutation
      this.perm.P(this.a);

      // Extract tag from S[3-4] and XOR with key
      // C reference: lw_xor_block_2_src(c + mlen, state.B + 24, k, 16);
      const tag = [];

      if (this.keybytes === 16) {
        const k1High = OpCodes.Pack32BE(this._key[0], this._key[1], this._key[2], this._key[3]);
        const k1Low = OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]);
        const k2High = OpCodes.Pack32BE(this._key[8], this._key[9], this._key[10], this._key[11]);
        const k2Low = OpCodes.Pack32BE(this._key[12], this._key[13], this._key[14], this._key[15]);

        const tag3High = (this.perm.S[3][1] ^ k1High) >>> 0;
        const tag3Low = (this.perm.S[3][0] ^ k1Low) >>> 0;
        const tag4High = (this.perm.S[4][1] ^ k2High) >>> 0;
        const tag4Low = (this.perm.S[4][0] ^ k2Low) >>> 0;

        const tag3HighBytes = OpCodes.Unpack32BE(tag3High);
        const tag3LowBytes = OpCodes.Unpack32BE(tag3Low);
        const tag4HighBytes = OpCodes.Unpack32BE(tag4High);
        const tag4LowBytes = OpCodes.Unpack32BE(tag4Low);

        tag.push(...tag3HighBytes, ...tag3LowBytes, ...tag4HighBytes, ...tag4LowBytes);
      } else {
        // Ascon-80pq: XOR with key[4-19]
        const k1High = OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]);
        const k1Low = OpCodes.Pack32BE(this._key[8], this._key[9], this._key[10], this._key[11]);
        const k2High = OpCodes.Pack32BE(this._key[12], this._key[13], this._key[14], this._key[15]);
        const k2Low = OpCodes.Pack32BE(this._key[16], this._key[17], this._key[18], this._key[19]);

        const tag3High = (this.perm.S[3][1] ^ k1High) >>> 0;
        const tag3Low = (this.perm.S[3][0] ^ k1Low) >>> 0;
        const tag4High = (this.perm.S[4][1] ^ k2High) >>> 0;
        const tag4Low = (this.perm.S[4][0] ^ k2Low) >>> 0;

        const tag3HighBytes = OpCodes.Unpack32BE(tag3High);
        const tag3LowBytes = OpCodes.Unpack32BE(tag3Low);
        const tag4HighBytes = OpCodes.Unpack32BE(tag4High);
        const tag4LowBytes = OpCodes.Unpack32BE(tag4Low);

        tag.push(...tag3HighBytes, ...tag3LowBytes, ...tag4HighBytes, ...tag4LowBytes);
      }

      return tag;
    }
  }

  // Register all three variants
  RegisterAlgorithm(new Ascon128());
  RegisterAlgorithm(new Ascon128a());
  RegisterAlgorithm(new Ascon80pq());

  return { Ascon128, Ascon128a, Ascon80pq };
}));
