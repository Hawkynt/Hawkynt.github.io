/*
 * GASCON Family - NIST Lightweight Cryptography AEAD Algorithms
 * Professional implementations of GASCON and DryGASCON variants
 * (c)2006-2025 Hawkynt
 *
 * This file consolidates two GASCON algorithm variants:
 *
 * 1. GASCON-128 AEAD: Bit-interleaved variant of Ascon optimized for 32-bit platforms.
 *    Uses standard sponge construction with 8-byte rate and 6-round intermediate permutation.
 *
 * 2. DryGASCON128k16: NIST LWC finalist using DrySPONGE construction with GASCON permutation.
 *    Uses 16-byte rate with 7-round intermediate permutation and x-value for side-channel resistance.
 *
 * Both share the same 40-byte GASCON-128 permutation but differ in their sponge construction
 * and operational parameters.
 *
 * References:
 * - NIST LWC: https://csrc.nist.gov/projects/lightweight-cryptography
 * - Ascon/GASCON: https://ascon.iaik.tugraz.at/
 * - DryGASCON: https://github.com/sebastien-riou/DryGASCON
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

  // ========================[ SHARED BIT-INTERLEAVED ROTATION HELPERS ]========================

  // 64-bit rotation helper using bit-interleaved format
  // GASCON uses bit-interleaving: 64-bit value split into even/odd bits stored in separate 32-bit words
  function rotr64_interleaved(low, high, bits) {
    bits = bits % 64;
    if (bits === 0) return [low, high];

    if (bits < 32) {
      const newLow = OpCodes.RotR32(low, bits);
      const newHigh = OpCodes.RotR32(high, bits);
      return [newLow, newHigh];
    }

    bits -= 32;
    const newLow = OpCodes.RotR32(high, bits);
    const newHigh = OpCodes.RotR32(low, bits);
    return [newLow, newHigh];
  }

  // Odd rotation: swap low/high and adjust rotation amount
  function rotr64_interleaved_odd(low, high, bits) {
    const low_rot = OpCodes.RotR32(low, ((bits + 1) % 32));
    const high_rot = OpCodes.RotR32(high, bits);
    return [high_rot, low_rot];
  }

  // ========================[ SHARED GASCON-128 PERMUTATION ]========================

  // GASCON-128 permutation state: 5 x 64-bit words in bit-interleaved format
  // Shared by both GASCON-128 and DryGASCON128k16
  class GASCON128Permutation {
    constructor() {
      // State: 5 x 64-bit words stored as pairs [low32, high32] for bit-interleaved operations
      this.S = new Array(5);
      for (let i = 0; i < 5; ++i) {
        this.S[i] = [0, 0]; // [low32, high32]
      }
    }

    // Core round function implementing GASCON permutation
    coreRound(roundNum) {
      // Add round constant to S[2]: ((0x0F - round) << 4) | round
      const c = ((0x0F - roundNum) << 4) | roundNum;
      this.S[2][0] = (this.S[2][0] ^ c) >>> 0;

      // Substitution layer (chi function)
      // x0 ^= x4; x2 ^= x1; x4 ^= x3;
      this.S[0][0] = (this.S[0][0] ^ this.S[4][0]) >>> 0;
      this.S[0][1] = (this.S[0][1] ^ this.S[4][1]) >>> 0;
      this.S[2][0] = (this.S[2][0] ^ this.S[1][0]) >>> 0;
      this.S[2][1] = (this.S[2][1] ^ this.S[1][1]) >>> 0;
      this.S[4][0] = (this.S[4][0] ^ this.S[3][0]) >>> 0;
      this.S[4][1] = (this.S[4][1] ^ this.S[3][1]) >>> 0;

      // t[i] = (~x[i]) & x[i+1]
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

      // x[i] ^= t[i+1]
      this.S[0][0] = (this.S[0][0] ^ t1_l) >>> 0;
      this.S[0][1] = (this.S[0][1] ^ t1_h) >>> 0;
      this.S[1][0] = (this.S[1][0] ^ t2_l) >>> 0;
      this.S[1][1] = (this.S[1][1] ^ t2_h) >>> 0;
      this.S[2][0] = (this.S[2][0] ^ t3_l) >>> 0;
      this.S[2][1] = (this.S[2][1] ^ t3_h) >>> 0;
      this.S[3][0] = (this.S[3][0] ^ t4_l) >>> 0;
      this.S[3][1] = (this.S[3][1] ^ t4_h) >>> 0;
      this.S[4][0] = (this.S[4][0] ^ t0_l) >>> 0;
      this.S[4][1] = (this.S[4][1] ^ t0_h) >>> 0;

      // x1 ^= x0; x3 ^= x2; x0 ^= x4; x2 = ~x2;
      this.S[1][0] = (this.S[1][0] ^ this.S[0][0]) >>> 0;
      this.S[1][1] = (this.S[1][1] ^ this.S[0][1]) >>> 0;
      this.S[3][0] = (this.S[3][0] ^ this.S[2][0]) >>> 0;
      this.S[3][1] = (this.S[3][1] ^ this.S[2][1]) >>> 0;
      this.S[0][0] = (this.S[0][0] ^ this.S[4][0]) >>> 0;
      this.S[0][1] = (this.S[0][1] ^ this.S[4][1]) >>> 0;
      this.S[2][0] = (~this.S[2][0]) >>> 0;
      this.S[2][1] = (~this.S[2][1]) >>> 0;

      // Linear diffusion layer (bit-interleaved rotations)
      // x0 ^= rightRotate19(x0) ^ rightRotate28(x0)
      let r1 = rotr64_interleaved_odd(this.S[0][0], this.S[0][1], 9);
      let r2 = rotr64_interleaved(this.S[0][0], this.S[0][1], 14);
      this.S[0][0] = (this.S[0][0] ^ r1[0] ^ r2[0]) >>> 0;
      this.S[0][1] = (this.S[0][1] ^ r1[1] ^ r2[1]) >>> 0;

      // x1 ^= rightRotate61(x1) ^ rightRotate38(x1)
      r1 = rotr64_interleaved_odd(this.S[1][0], this.S[1][1], 30);
      r2 = rotr64_interleaved(this.S[1][0], this.S[1][1], 19);
      this.S[1][0] = (this.S[1][0] ^ r1[0] ^ r2[0]) >>> 0;
      this.S[1][1] = (this.S[1][1] ^ r1[1] ^ r2[1]) >>> 0;

      // x2 ^= rightRotate1(x2) ^ rightRotate6(x2)
      const r2a = rotr64_interleaved_odd(this.S[2][0], this.S[2][1], 0);
      r2 = rotr64_interleaved(this.S[2][0], this.S[2][1], 3);
      this.S[2][0] = (this.S[2][0] ^ r2a[0] ^ r2[0]) >>> 0;
      this.S[2][1] = (this.S[2][1] ^ r2a[1] ^ r2[1]) >>> 0;

      // x3 ^= rightRotate10(x3) ^ rightRotate17(x3)
      r1 = rotr64_interleaved(this.S[3][0], this.S[3][1], 5);
      r2 = rotr64_interleaved_odd(this.S[3][0], this.S[3][1], 8);
      this.S[3][0] = (this.S[3][0] ^ r1[0] ^ r2[0]) >>> 0;
      this.S[3][1] = (this.S[3][1] ^ r1[1] ^ r2[1]) >>> 0;

      // x4 ^= rightRotate7(x4) ^ rightRotate40(x4)
      r1 = rotr64_interleaved_odd(this.S[4][0], this.S[4][1], 3);
      r2 = rotr64_interleaved(this.S[4][0], this.S[4][1], 20);
      this.S[4][0] = (this.S[4][0] ^ r1[0] ^ r2[0]) >>> 0;
      this.S[4][1] = (this.S[4][1] ^ r1[1] ^ r2[1]) >>> 0;
    }

    // Load bytes into state (little-endian)
    loadBytes(bytes, offset, index) {
      const low = OpCodes.Pack32LE(
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3]
      );
      const high = OpCodes.Pack32LE(
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7]
      );
      this.S[index] = [low, high];
    }

    // Store state to bytes (little-endian)
    storeBytes(bytes, offset, index) {
      const b = OpCodes.Unpack32LE(this.S[index][0]);
      bytes[offset] = b[0];
      bytes[offset + 1] = b[1];
      bytes[offset + 2] = b[2];
      bytes[offset + 3] = b[3];

      const b2 = OpCodes.Unpack32LE(this.S[index][1]);
      bytes[offset + 4] = b2[0];
      bytes[offset + 5] = b2[1];
      bytes[offset + 6] = b2[2];
      bytes[offset + 7] = b2[3];
    }

    // Convert to byte array (for GASCON-128 compatibility)
    toByteArray() {
      const B = new Array(40);
      for (let i = 0; i < 5; ++i) {
        this.storeBytes(B, i * 8, i);
      }
      return B;
    }

    // Load from byte array (for GASCON-128 compatibility)
    fromByteArray(B) {
      for (let i = 0; i < 5; ++i) {
        this.loadBytes(B, i * 8, i);
      }
    }
  }

  // ========================[ GASCON-128 AEAD (Standard Sponge) ]========================

  // GASCON-128 permutation wrapper with byte-oriented interface
  class GasconPermutation {
    constructor() {
      this.B = new Array(40).fill(0);
    }

    getWord32LE(offset) {
      return OpCodes.Pack32LE(
        this.B[offset],
        this.B[offset + 1],
        this.B[offset + 2],
        this.B[offset + 3]
      );
    }

    setWord32LE(offset, value) {
      const bytes = OpCodes.Unpack32LE(value);
      this.B[offset] = bytes[0];
      this.B[offset + 1] = bytes[1];
      this.B[offset + 2] = bytes[2];
      this.B[offset + 3] = bytes[3];
    }

    permute(firstRound) {
      // Load state as 10 x 32-bit little-endian words
      let x0_l = this.getWord32LE(0);
      let x0_h = this.getWord32LE(4);
      let x1_l = this.getWord32LE(8);
      let x1_h = this.getWord32LE(12);
      let x2_l = this.getWord32LE(16);
      let x2_h = this.getWord32LE(20);
      let x3_l = this.getWord32LE(24);
      let x3_h = this.getWord32LE(28);
      let x4_l = this.getWord32LE(32);
      let x4_h = this.getWord32LE(36);

      for (let round = firstRound; round < 12; ++round) {
        // Add round constant to x2 low word
        x2_l ^= ((0x0F - round) << 4) | round;

        // Substitution layer
        x0_l ^= x4_l; x0_h ^= x4_h;
        x2_l ^= x1_l; x2_h ^= x1_h;
        x4_l ^= x3_l; x4_h ^= x3_h;

        const t0_l = (~x0_l & x1_l) >>> 0;
        const t0_h = (~x0_h & x1_h) >>> 0;
        const t1_l = (~x1_l & x2_l) >>> 0;
        const t1_h = (~x1_h & x2_h) >>> 0;
        const t2_l = (~x2_l & x3_l) >>> 0;
        const t2_h = (~x2_h & x3_h) >>> 0;
        const t3_l = (~x3_l & x4_l) >>> 0;
        const t3_h = (~x3_h & x4_h) >>> 0;
        const t4_l = (~x4_l & x0_l) >>> 0;
        const t4_h = (~x4_h & x0_h) >>> 0;

        x0_l ^= t1_l; x0_h ^= t1_h;
        x1_l ^= t2_l; x1_h ^= t2_h;
        x2_l ^= t3_l; x2_h ^= t3_h;
        x3_l ^= t4_l; x3_h ^= t4_h;
        x4_l ^= t0_l; x4_h ^= t0_h;

        x1_l ^= x0_l; x1_h ^= x0_h;
        x3_l ^= x2_l; x3_h ^= x2_h;
        x0_l ^= x4_l; x0_h ^= x4_h;
        x2_l = (~x2_l) >>> 0;
        x2_h = (~x2_h) >>> 0;

        // Linear diffusion layer
        let r0 = rotr64_interleaved_odd(x0_l, x0_h, 9);
        let r1 = rotr64_interleaved(x0_l, x0_h, 14);
        x0_l ^= r0[0] ^ r1[0];
        x0_h ^= r0[1] ^ r1[1];

        r0 = rotr64_interleaved_odd(x1_l, x1_h, 30);
        r1 = rotr64_interleaved(x1_l, x1_h, 19);
        x1_l ^= r0[0] ^ r1[0];
        x1_h ^= r0[1] ^ r1[1];

        r0 = rotr64_interleaved_odd(x2_l, x2_h, 0);
        r1 = rotr64_interleaved(x2_l, x2_h, 3);
        x2_l ^= r0[0] ^ r1[0];
        x2_h ^= r0[1] ^ r1[1];

        r0 = rotr64_interleaved(x3_l, x3_h, 5);
        r1 = rotr64_interleaved_odd(x3_l, x3_h, 8);
        x3_l ^= r0[0] ^ r1[0];
        x3_h ^= r0[1] ^ r1[1];

        r0 = rotr64_interleaved_odd(x4_l, x4_h, 3);
        r1 = rotr64_interleaved(x4_l, x4_h, 20);
        x4_l ^= r0[0] ^ r1[0];
        x4_h ^= r0[1] ^ r1[1];
      }

      // Store back to state
      this.setWord32LE(0, x0_l);
      this.setWord32LE(4, x0_h);
      this.setWord32LE(8, x1_l);
      this.setWord32LE(12, x1_h);
      this.setWord32LE(16, x2_l);
      this.setWord32LE(20, x2_h);
      this.setWord32LE(24, x3_l);
      this.setWord32LE(28, x3_h);
      this.setWord32LE(32, x4_l);
      this.setWord32LE(36, x4_h);
    }

    xorBytes(data, offset, length) {
      for (let i = 0; i < length; ++i) {
        this.B[offset + i] ^= data[i];
      }
    }

    xorAndExtract(data, offset, length) {
      const output = [];
      for (let i = 0; i < length; ++i) {
        this.B[offset + i] ^= data[i];
        output.push(this.B[offset + i]);
      }
      return output;
    }

    xorAndReplace(data, offset, length) {
      const output = [];
      for (let i = 0; i < length; ++i) {
        const plainByte = this.B[offset + i] ^ data[i];
        output.push(plainByte);
        this.B[offset + i] = data[i];
      }
      return output;
    }
  }

  class GASCON128Algorithm extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "GASCON-128 AEAD";
      this.description = "Bit-interleaved variant of Ascon optimized for 32-bit platforms. Provides authenticated encryption with 128-bit security level using sponge construction with efficient bit-interleaved permutation.";
      this.inventor = "Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Lightweight Cryptography";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedTagSizes = [new KeySize(16, 16, 1)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem(
          "NIST LWC Project",
          "https://csrc.nist.gov/projects/lightweight-cryptography"
        ),
        new LinkItem(
          "GASCON Specification",
          "https://ascon.iaik.tugraz.at/"
        ),
        new LinkItem(
          "Reference Implementation",
          "https://github.com/rweather/lightweight-crypto"
        )
      ];

      this.tests = [
        {
          text: "GASCON-128: Empty message, empty AAD (Count 1)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GASCON-128.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("16F28158685B2A85F573C62E16D61F09")
        },
        {
          text: "GASCON-128: Empty message with 8-byte AAD (Count 9)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GASCON-128.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("0001020304050607"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("15D0B60D1C4C3155966CBCF508EEDCD9")
        },
        {
          text: "GASCON-128: 1-byte plaintext, empty AAD (Count 34)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GASCON-128.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("1269EAF2046BE0BD81FEF44491D24A035C")
        },
        {
          text: "GASCON-128: 1-byte plaintext with 1-byte AAD (Count 35)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GASCON-128.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("32C53850FAC4F45EC3303C6618151EA75B")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new GASCON128Instance(this, isInverse);
    }
  }

  /**
 * GASCON128 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class GASCON128Instance extends IAeadInstance {
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

      this.IV = 0x80400c0600000000;
      this.rate = 8;
      this.tagSize = 16;

      this.perm = new GasconPermutation();
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
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 16)`);
      }

      this._key = [...keyBytes];
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

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

    set associatedData(adBytes) {
      this.aad = adBytes;
    }

    get associatedData() {
      return this.aad;
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
        if (this.inputBuffer.length < 16) {
          throw new Error("Ciphertext too short (must include tag)");
        }
        return this._decrypt();
      } else {
        return this._encrypt();
      }
    }

    _initialize() {
      const ivLow = (this.IV & 0xFFFFFFFF) >>> 0;
      const ivHigh = Math.floor(this.IV / 0x100000000);

      this.perm.B[0] = (ivLow) & 0xFF;
      this.perm.B[1] = (ivLow >>> 8) & 0xFF;
      this.perm.B[2] = (ivLow >>> 16) & 0xFF;
      this.perm.B[3] = (ivLow >>> 24) & 0xFF;
      this.perm.B[4] = (ivHigh) & 0xFF;
      this.perm.B[5] = (ivHigh >>> 8) & 0xFF;
      this.perm.B[6] = (ivHigh >>> 16) & 0xFF;
      this.perm.B[7] = (ivHigh >>> 24) & 0xFF;

      for (let i = 0; i < 16; ++i) {
        this.perm.B[8 + i] = this._key[i];
        this.perm.B[24 + i] = this._nonce[i];
      }

      this.perm.permute(0);
      this.perm.xorBytes(this._key, 24, 16);
    }

    _absorbAAD(aad) {
      let pos = 0;
      while (pos + 8 <= aad.length) {
        this.perm.xorBytes(aad.slice(pos, pos + 8), 0, 8);
        this.perm.permute(6);
        pos += 8;
      }

      if (pos < aad.length) {
        this.perm.xorBytes(aad.slice(pos), 0, aad.length - pos);
      }

      this.perm.B[aad.length % 8] ^= 0x80;
      this.perm.permute(6);
    }

    _encrypt() {
      this._initialize();

      if (this._aad.length > 0) {
        this._absorbAAD(this._aad);
      }

      this.perm.B[39] ^= 0x01;

      const ciphertext = [];
      const plaintext = this.inputBuffer;
      let pos = 0;

      while (pos + 8 <= plaintext.length) {
        const block = this.perm.xorAndExtract(plaintext.slice(pos, pos + 8), 0, 8);
        ciphertext.push(...block);
        this.perm.permute(6);
        pos += 8;
      }

      if (pos < plaintext.length) {
        const block = this.perm.xorAndExtract(plaintext.slice(pos), 0, plaintext.length - pos);
        ciphertext.push(...block);
      }

      this.perm.B[plaintext.length % 8] ^= 0x80;
      this.perm.xorBytes(this._key, 8, 16);
      this.perm.permute(0);

      const tag = [];
      for (let i = 0; i < 16; ++i) {
        tag.push(this.perm.B[24 + i] ^ this._key[i]);
      }

      this.inputBuffer = [];
      return [...ciphertext, ...tag];
    }

    _decrypt() {
      const ciphertextWithTag = this.inputBuffer;
      const ciphertextLen = ciphertextWithTag.length - 16;
      const ciphertext = ciphertextWithTag.slice(0, ciphertextLen);
      const receivedTag = ciphertextWithTag.slice(ciphertextLen);

      this._initialize();

      if (this._aad.length > 0) {
        this._absorbAAD(this._aad);
      }

      this.perm.B[39] ^= 0x01;

      const plaintext = [];
      let pos = 0;

      while (pos + 8 <= ciphertext.length) {
        const block = this.perm.xorAndReplace(ciphertext.slice(pos, pos + 8), 0, 8);
        plaintext.push(...block);
        this.perm.permute(6);
        pos += 8;
      }

      if (pos < ciphertext.length) {
        const block = this.perm.xorAndReplace(ciphertext.slice(pos), 0, ciphertext.length - pos);
        plaintext.push(...block);
      }

      this.perm.B[ciphertext.length % 8] ^= 0x80;
      this.perm.xorBytes(this._key, 8, 16);
      this.perm.permute(0);

      const expectedTag = [];
      for (let i = 0; i < 16; ++i) {
        expectedTag.push(this.perm.B[24 + i] ^ this._key[i]);
      }

      let tagMatch = true;
      for (let i = 0; i < 16; ++i) {
        if (expectedTag[i] !== receivedTag[i]) {
          tagMatch = false;
        }
      }

      if (!tagMatch) {
        throw new Error("Authentication tag verification failed");
      }

      this.inputBuffer = [];
      return plaintext;
    }
  }

  // ========================[ DRYGASCON128K16 (DrySPONGE) ]========================

  const DRYSPONGE128_RATE = 16;
  const DRYSPONGE128_XSIZE = 16;
  const DRYSPONGE128_ROUNDS = 7;
  const DRYSPONGE128_INIT_ROUNDS = 11;
  const DRYGASCON128_TAG_SIZE = 16;
  const DRYGASCON128_NONCE_SIZE = 16;

  const DRYDOMAIN128_PADDED = (1 << 8);
  const DRYDOMAIN128_FINAL = (1 << 9);
  const DRYDOMAIN128_NONCE = (1 << 10);
  const DRYDOMAIN128_ASSOC_DATA = (2 << 10);
  const DRYDOMAIN128_MESSAGE = (3 << 10);

  class DrySponge128State {
    constructor() {
      this.c = new GASCON128Permutation();
      this.r = new Array(DRYSPONGE128_RATE);
      for (let i = 0; i < DRYSPONGE128_RATE; ++i) this.r[i] = 0;
      this.x = new Array(DRYSPONGE128_XSIZE);
      for (let i = 0; i < DRYSPONGE128_XSIZE; ++i) this.x[i] = 0;
      this.domain = 0;
      this.rounds = DRYSPONGE128_ROUNDS;
    }

    selectX(index) {
      const xW = new Array(4);
      for (let i = 0; i < 4; ++i) {
        xW[i] = OpCodes.Pack32LE(
          this.x[i * 4],
          this.x[i * 4 + 1],
          this.x[i * 4 + 2],
          this.x[i * 4 + 3]
        );
      }

      let result = 0;
      for (let i = 0; i < 4; ++i) {
        const mask = ((i === index) ? 0xFFFFFFFF : 0) >>> 0;
        result = (result ^ (xW[i] & mask)) >>> 0;
      }
      return result;
    }

    mixPhase(data) {
      const ds = this.domain;

      const mixData = new Array(14);
      mixData[0] = data[0] | (data[1] << 8);
      mixData[1] = (data[1] >>> 2) | (data[2] << 6);
      mixData[2] = (data[2] >>> 4) | (data[3] << 4);
      mixData[3] = (data[3] >>> 6) | (data[4] << 2);
      mixData[4] = data[5] | (data[6] << 8);
      mixData[5] = (data[6] >>> 2) | (data[7] << 6);
      mixData[6] = (data[7] >>> 4) | (data[8] << 4);
      mixData[7] = (data[8] >>> 6) | (data[9] << 2);
      mixData[8] = data[10] | (data[11] << 8);
      mixData[9] = (data[11] >>> 2) | (data[12] << 6);
      mixData[10] = (data[12] >>> 4) | (data[13] << 4);
      mixData[11] = (data[13] >>> 6) | (data[14] << 2);
      mixData[12] = data[15] ^ ds;
      mixData[13] = ds >>> 10;

      for (let i = 0; i < 14; ++i) {
        this.mixPhaseRound(mixData[i] & 0x3FF);
        this.c.coreRound(0);
      }
    }

    mixPhaseRound(data) {
      const x0 = this.selectX((data) & 0x03);
      const x1 = this.selectX((data >>> 2) & 0x03);
      const x2 = this.selectX((data >>> 4) & 0x03);
      const x3 = this.selectX((data >>> 6) & 0x03);
      const x4 = this.selectX((data >>> 8) & 0x03);

      this.c.S[0][0] = (this.c.S[0][0] ^ x0) >>> 0;
      this.c.S[1][0] = (this.c.S[1][0] ^ x1) >>> 0;
      this.c.S[2][0] = (this.c.S[2][0] ^ x2) >>> 0;
      this.c.S[3][0] = (this.c.S[3][0] ^ x3) >>> 0;
      this.c.S[4][0] = (this.c.S[4][0] ^ x4) >>> 0;
    }

    g() {
      this.c.coreRound(0);

      const w0 = (this.c.S[0][0] ^ this.c.S[2][1]) >>> 0;
      const w1 = (this.c.S[0][1] ^ this.c.S[3][0]) >>> 0;
      const w2 = (this.c.S[1][0] ^ this.c.S[3][1]) >>> 0;
      const w3 = (this.c.S[1][1] ^ this.c.S[2][0]) >>> 0;

      for (let round = 1; round < this.rounds; ++round) {
        this.c.coreRound(round);

        const w0_new = (this.c.S[0][0] ^ this.c.S[2][1]) >>> 0;
        const w1_new = (this.c.S[0][1] ^ this.c.S[3][0]) >>> 0;
        const w2_new = (this.c.S[1][0] ^ this.c.S[3][1]) >>> 0;
        const w3_new = (this.c.S[1][1] ^ this.c.S[2][0]) >>> 0;

        this.r[0] ^= OpCodes.Unpack32LE(w0_new)[0];
        this.r[1] ^= OpCodes.Unpack32LE(w0_new)[1];
        this.r[2] ^= OpCodes.Unpack32LE(w0_new)[2];
        this.r[3] ^= OpCodes.Unpack32LE(w0_new)[3];

        this.r[4] ^= OpCodes.Unpack32LE(w1_new)[0];
        this.r[5] ^= OpCodes.Unpack32LE(w1_new)[1];
        this.r[6] ^= OpCodes.Unpack32LE(w1_new)[2];
        this.r[7] ^= OpCodes.Unpack32LE(w1_new)[3];

        this.r[8] ^= OpCodes.Unpack32LE(w2_new)[0];
        this.r[9] ^= OpCodes.Unpack32LE(w2_new)[1];
        this.r[10] ^= OpCodes.Unpack32LE(w2_new)[2];
        this.r[11] ^= OpCodes.Unpack32LE(w2_new)[3];

        this.r[12] ^= OpCodes.Unpack32LE(w3_new)[0];
        this.r[13] ^= OpCodes.Unpack32LE(w3_new)[1];
        this.r[14] ^= OpCodes.Unpack32LE(w3_new)[2];
        this.r[15] ^= OpCodes.Unpack32LE(w3_new)[3];
      }

      const b0 = OpCodes.Unpack32LE(w0);
      const b1 = OpCodes.Unpack32LE(w1);
      const b2 = OpCodes.Unpack32LE(w2);
      const b3 = OpCodes.Unpack32LE(w3);

      this.r[0] = b0[0]; this.r[1] = b0[1]; this.r[2] = b0[2]; this.r[3] = b0[3];
      this.r[4] = b1[0]; this.r[5] = b1[1]; this.r[6] = b1[2]; this.r[7] = b1[3];
      this.r[8] = b2[0]; this.r[9] = b2[1]; this.r[10] = b2[2]; this.r[11] = b2[3];
      this.r[12] = b3[0]; this.r[13] = b3[1]; this.r[14] = b3[2]; this.r[15] = b3[3];
    }

    f(input, len) {
      const padded = new Array(DRYSPONGE128_RATE);
      if (len < DRYSPONGE128_RATE) {
        for (let i = 0; i < len; ++i) padded[i] = input[i];
        padded[len] = 0x01;
        for (let i = len + 1; i < DRYSPONGE128_RATE; ++i) padded[i] = 0;
      } else {
        for (let i = 0; i < DRYSPONGE128_RATE; ++i) padded[i] = input[i];
      }

      this.mixPhase(padded);
      this.g();
      this.domain = 0;
    }
  }

  class DryGASCON128Algorithm extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "DryGASCON128k16";
      this.description = "NIST Lightweight Cryptography finalist using DrySPONGE construction with GASCON permutation. Provides authenticated encryption with 16-byte key and protection against side-channel attacks.";
      this.inventor = "Sébastien Riou, Michaël Raulet, Stéphane Castelain";
      this.year = 2020;
      this.category = CategoryType.AEAD;
      this.subCategory = "Lightweight Cryptography";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.FRANCE;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedTagSizes = [new KeySize(16, 16, 1)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem(
          "DryGASCON GitHub Repository",
          "https://github.com/sebastien-riou/DryGASCON"
        ),
        new LinkItem(
          "NIST LWC Project Page",
          "https://csrc.nist.gov/projects/lightweight-cryptography"
        ),
        new LinkItem(
          "DryGASCON Specification",
          "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/drygascon-spec-final.pdf"
        )
      ];

      this.tests = [
        {
          text: "DryGASCON128k16: Empty message, empty AAD (Count 1)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("BB857CC1CB30BD12F67FBBCC00206053")
        },
        {
          text: "DryGASCON128k16: Empty message, 1-byte AAD (Count 2)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("FED9825CEAE6CCD64CF6042FCB18628B")
        },
        {
          text: "DryGASCON128k16: Empty message, 16-byte AAD (Count 17)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("8D376C65983428D27D936228AF47435B")
        },
        {
          text: "DryGASCON128k16: 1-byte plaintext, empty AAD (Count 34)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("F249CAF7DD8BD11993B3A1E63A38E8997A")
        },
        {
          text: "DryGASCON128k16: 1-byte plaintext, 1-byte AAD (Count 35)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("51D99A58C5A70590B6CAFDCFD1A0FFA8C2")
        },
        {
          text: "DryGASCON128k16: 8-byte plaintext, empty AAD (Count 265)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("8D8F6233FB2FB74DD5DE8C9BD8CCD4CAD04C3BD1C7B7")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new DryGASCON128Instance(this, isInverse);
    }
  }

  /**
 * DryGASCON128 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class DryGASCON128Instance extends IAeadInstance {
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
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 16)`);
      }

      this._key = [...keyBytes];
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() { return this._key ? [...this._key] : null; }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (nonceBytes.length !== DRYGASCON128_NONCE_SIZE) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected ${DRYGASCON128_NONCE_SIZE})`);
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

    set associatedData(adBytes) {
      this.aad = adBytes;
    }

    get associatedData() {
      return this.aad;
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
        return this._decrypt();
      } else {
        return this._encrypt();
      }
    }

    _setup(state, finalBlock) {
      state.c.S[0][0] = OpCodes.Pack32LE(this._key[0], this._key[1], this._key[2], this._key[3]);
      state.c.S[0][1] = OpCodes.Pack32LE(this._key[4], this._key[5], this._key[6], this._key[7]);
      state.c.S[1][0] = OpCodes.Pack32LE(this._key[8], this._key[9], this._key[10], this._key[11]);
      state.c.S[1][1] = OpCodes.Pack32LE(this._key[12], this._key[13], this._key[14], this._key[15]);

      state.c.S[2][0] = OpCodes.Pack32LE(this._key[0], this._key[1], this._key[2], this._key[3]);
      state.c.S[2][1] = OpCodes.Pack32LE(this._key[4], this._key[5], this._key[6], this._key[7]);
      state.c.S[3][0] = OpCodes.Pack32LE(this._key[8], this._key[9], this._key[10], this._key[11]);
      state.c.S[3][1] = OpCodes.Pack32LE(this._key[12], this._key[13], this._key[14], this._key[15]);

      state.c.S[4][0] = OpCodes.Pack32LE(this._key[0], this._key[1], this._key[2], this._key[3]);
      state.c.S[4][1] = OpCodes.Pack32LE(this._key[4], this._key[5], this._key[6], this._key[7]);

      let roundCount = 0;
      const MAX_ROUNDS = 1000;
      let cWordsAreSame = false;
      do {
        state.c.coreRound(0);
        roundCount++;
        if (roundCount >= MAX_ROUNDS) {
          throw new Error(`DryGASCON128: Failed to generate unique X words after ${MAX_ROUNDS} rounds`);
        }

        const cWords = [
          state.c.S[0][0],
          state.c.S[0][1],
          state.c.S[1][0],
          state.c.S[1][1]
        ];

        cWordsAreSame = false;
        for (let i = 0; i < 3; ++i) {
          for (let j = i + 1; j < 4; ++j) {
            if (cWords[i] === cWords[j]) {
              cWordsAreSame = true;
              break;
            }
          }
          if (cWordsAreSame) break;
        }
      } while (cWordsAreSame);

      for (let i = 0; i < 16; ++i) {
        const stateIdx = Math.floor(i / 8);
        const wordOffset = i % 8;
        if (wordOffset < 4) {
          state.x[i] = (state.c.S[stateIdx][0] >>> (wordOffset * 8)) & 0xFF;
        } else {
          state.x[i] = (state.c.S[stateIdx][1] >>> ((wordOffset - 4) * 8)) & 0xFF;
        }
      }

      for (let i = 0; i < 16; ++i) {
        const stateIdx = Math.floor(i / 8);
        const wordOffset = i % 8;
        if (wordOffset < 4) {
          const mask = ~(0xFF << (wordOffset * 8));
          state.c.S[stateIdx][0] = ((state.c.S[stateIdx][0] & mask) | (this._key[i] << (wordOffset * 8))) >>> 0;
        } else {
          const mask = ~(0xFF << ((wordOffset - 4) * 8));
          state.c.S[stateIdx][1] = ((state.c.S[stateIdx][1] & mask) | (this._key[i] << ((wordOffset - 4) * 8))) >>> 0;
        }
      }

      state.rounds = DRYSPONGE128_INIT_ROUNDS;
      state.domain = DRYDOMAIN128_NONCE;
      if (finalBlock) {
        state.domain |= DRYDOMAIN128_FINAL;
      }
      state.f(this._nonce, 16);

      state.rounds = DRYSPONGE128_ROUNDS;
    }

    _processAD(state, ad, finalBlock) {
      if (ad.length === 0) return;

      let offset = 0;
      while (ad.length - offset > DRYSPONGE128_RATE) {
        const block = ad.slice(offset, offset + DRYSPONGE128_RATE);
        state.f(block, DRYSPONGE128_RATE);
        offset += DRYSPONGE128_RATE;
      }

      const lastBlock = ad.slice(offset);
      state.domain = DRYDOMAIN128_ASSOC_DATA;
      if (finalBlock) {
        state.domain |= DRYDOMAIN128_FINAL;
      }
      if (lastBlock.length < DRYSPONGE128_RATE) {
        state.domain |= DRYDOMAIN128_PADDED;
      }
      state.f(lastBlock, lastBlock.length);
    }

    _encrypt() {
      const plaintext = this.inputBuffer;
      const output = [];

      const state = new DrySponge128State();
      const adLen = this._aad.length;
      const mLen = plaintext.length;

      this._setup(state, adLen === 0 && mLen === 0);

      if (adLen > 0) {
        this._processAD(state, this._aad, mLen === 0);
      }

      if (mLen > 0) {
        let offset = 0;

        while (mLen - offset > DRYSPONGE128_RATE) {
          const block = plaintext.slice(offset, offset + DRYSPONGE128_RATE);
          for (let i = 0; i < DRYSPONGE128_RATE; ++i) {
            output.push(block[i] ^ state.r[i]);
          }
          state.f(block, DRYSPONGE128_RATE);
          offset += DRYSPONGE128_RATE;
        }

        const lastBlock = plaintext.slice(offset);
        state.domain = DRYDOMAIN128_MESSAGE | DRYDOMAIN128_FINAL;
        if (lastBlock.length < DRYSPONGE128_RATE) {
          state.domain |= DRYDOMAIN128_PADDED;
        }

        for (let i = 0; i < lastBlock.length; ++i) {
          output.push(lastBlock[i] ^ state.r[i]);
        }

        state.f(lastBlock, lastBlock.length);
      }

      for (let i = 0; i < DRYGASCON128_TAG_SIZE; ++i) {
        output.push(state.r[i]);
      }

      this.inputBuffer = [];
      return output;
    }

    _decrypt() {
      const ciphertext = this.inputBuffer;

      if (ciphertext.length < DRYGASCON128_TAG_SIZE) {
        throw new Error("Ciphertext too short (must include tag)");
      }

      const output = [];
      const state = new DrySponge128State();

      const ctLen = ciphertext.length - DRYGASCON128_TAG_SIZE;
      const adLen = this._aad.length;

      this._setup(state, adLen === 0 && ctLen === 0);

      if (adLen > 0) {
        this._processAD(state, this._aad, ctLen === 0);
      }

      if (ctLen > 0) {
        let offset = 0;

        while (ctLen - offset > DRYSPONGE128_RATE) {
          const block = ciphertext.slice(offset, offset + DRYSPONGE128_RATE);
          const plainBlock = new Array(DRYSPONGE128_RATE);
          for (let i = 0; i < DRYSPONGE128_RATE; ++i) {
            plainBlock[i] = block[i] ^ state.r[i];
            output.push(plainBlock[i]);
          }
          state.f(plainBlock, DRYSPONGE128_RATE);
          offset += DRYSPONGE128_RATE;
        }

        const lastBlockLen = ctLen - offset;
        const lastBlock = ciphertext.slice(offset, offset + lastBlockLen);
        state.domain = DRYDOMAIN128_MESSAGE | DRYDOMAIN128_FINAL;
        if (lastBlockLen < DRYSPONGE128_RATE) {
          state.domain |= DRYDOMAIN128_PADDED;
        }

        const plainBlock = new Array(lastBlockLen);
        for (let i = 0; i < lastBlockLen; ++i) {
          plainBlock[i] = lastBlock[i] ^ state.r[i];
          output.push(plainBlock[i]);
        }

        state.f(plainBlock, lastBlockLen);
      }

      const receivedTag = ciphertext.slice(ctLen, ctLen + DRYGASCON128_TAG_SIZE);
      const computedTag = state.r.slice(0, DRYGASCON128_TAG_SIZE);

      let tagMatch = 0;
      for (let i = 0; i < DRYGASCON128_TAG_SIZE; ++i) {
        tagMatch |= receivedTag[i] ^ computedTag[i];
      }

      if (tagMatch !== 0) {
        throw new Error("Authentication tag verification failed");
      }

      this.inputBuffer = [];
      return output;
    }
  }

  // ========================[ REGISTRATION ]========================

  RegisterAlgorithm(new GASCON128Algorithm());
  RegisterAlgorithm(new DryGASCON128Algorithm());

  return {
    GASCON128Algorithm,
    GASCON128Instance,
    DryGASCON128Algorithm,
    DryGASCON128Instance
  };
}));
