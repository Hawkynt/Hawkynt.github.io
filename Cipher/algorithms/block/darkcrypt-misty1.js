/*
 * Misty1 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * MISTY1 as implemented in the DarkCrypt Total Commander plugin (Alexander
 * Myasnikov, "Zarya" project). This variant differs from the published
 * MISTY1 specification (RFC 2994) in several ways:
 *  - The declared key size is 256 bits, but setup() only ever uses the
 *    first 16 bytes of the supplied key, loaded into two 32-bit "key
 *    material" registers, byte-swapping each 4-byte group before slicing
 *    it into two big-endian 16-bit words; the remaining 16 key bytes are
 *    never used.
 *  - The S7 substitution table is the standard RFC 2994 table, unmodified.
 *  - The S9 substitution table is NOT the RFC 2994 table: roughly 300 of
 *    its 512 entries differ, so it is reproduced here byte-for-byte as used
 *    by the DarkCrypt implementation.
 *  - FL (and its inverse) match the standard RFC 2994 FL definition exactly.
 *  - FI and FO use the same S-box tables and subkey layout as RFC 2994's
 *    functions but combine the terms in a different order (FI applies both
 *    S-box tables twice in a two-stage lattice rather than the textbook
 *    single-pass Feistel form; FO mixes the upper/lower 16-bit halves in a
 *    mirrored order), and the outer 8-round FL/FO network's final two words
 *    are swapped before being written back to the block.
 * 64-bit blocks. setup() declares a 256-bit key; only the first 128 bits
 * participate in the key schedule. Educational only.
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
}((function () {
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
          BlockCipherAlgorithm, IBlockCipherInstance,
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // Standard RFC 2994 S7 table (7-bit in/out) -- matches the DarkCrypt implementation exactly.
  const S7TABLE = Object.freeze([
    0x1b,0x32,0x33,0x5a,0x3b,0x10,0x17,0x54,0x5b,0x1a,0x72,0x73,0x6b,0x2c,0x66,0x49,
    0x1f,0x24,0x13,0x6c,0x37,0x2e,0x3f,0x4a,0x5d,0x0f,0x40,0x56,0x25,0x51,0x1c,0x04,
    0x0b,0x46,0x20,0x0d,0x7b,0x35,0x44,0x42,0x2b,0x1e,0x41,0x14,0x4b,0x79,0x15,0x6f,
    0x0e,0x55,0x09,0x36,0x74,0x0c,0x67,0x53,0x28,0x0a,0x7e,0x38,0x02,0x07,0x60,0x29,
    0x19,0x12,0x65,0x2f,0x30,0x39,0x08,0x68,0x5f,0x78,0x2a,0x4c,0x64,0x45,0x75,0x3d,
    0x59,0x48,0x03,0x57,0x7c,0x4f,0x62,0x3c,0x1d,0x21,0x5e,0x27,0x6a,0x70,0x4d,0x3a,
    0x01,0x6d,0x6e,0x63,0x18,0x77,0x23,0x05,0x26,0x76,0x00,0x31,0x2d,0x7a,0x7f,0x61,
    0x50,0x22,0x11,0x06,0x47,0x16,0x52,0x4e,0x71,0x3e,0x69,0x43,0x34,0x5c,0x58,0x7d
  ]);

  // Non-standard S9 table (9-bit in/out), as used by the DarkCrypt
  // implementation -- roughly 300 of the 512 entries differ from the RFC 2994
  // reference table, so it cannot be reused from a standard implementation.
  const S9TABLE = Object.freeze([
    0x1c3,0x0cb,0x153,0x19f,0x1e3,0x0e9,0x0fb,0x035,0x181,0x0b9,0x117,0x1eb,0x133,0x009,0x02d,0x0d3,
    0x0c7,0x14a,0x037,0x07e,0x0eb,0x164,0x193,0x1d8,0x0a3,0x11e,0x055,0x02c,0x01d,0x1a2,0x163,0x118,
    0x14b,0x152,0x1d2,0x00f,0x02b,0x030,0x13a,0x0e5,0x111,0x138,0x18e,0x063,0x0e3,0x0c8,0x1f4,0x01b,
    0x001,0x09d,0x0f8,0x1a0,0x16d,0x1f3,0x01c,0x146,0x07d,0x0d1,0x082,0x1ea,0x183,0x12d,0x0f4,0x19e,
    0x1d3,0x0dd,0x1e2,0x128,0x1e0,0x0ec,0x059,0x091,0x011,0x12f,0x026,0x0dc,0x0b0,0x18c,0x10f,0x1f7,
    0x0e7,0x16c,0x0b6,0x0f9,0x0d8,0x151,0x101,0x14c,0x103,0x0b8,0x154,0x12b,0x1ae,0x017,0x071,0x00c,
    0x047,0x058,0x07f,0x1a4,0x134,0x129,0x084,0x15d,0x19d,0x1b2,0x1a3,0x048,0x07c,0x051,0x1ca,0x023,
    0x13d,0x1a7,0x165,0x03b,0x042,0x0da,0x192,0x0ce,0x0c1,0x06b,0x09f,0x1f1,0x12c,0x184,0x0fa,0x196,
    0x1e1,0x169,0x17d,0x031,0x180,0x10a,0x094,0x1da,0x186,0x13e,0x11c,0x060,0x175,0x1cf,0x067,0x119,
    0x065,0x068,0x099,0x150,0x008,0x007,0x17c,0x0b7,0x024,0x019,0x0de,0x127,0x0db,0x0e4,0x1a9,0x052,
    0x109,0x090,0x19c,0x1c1,0x028,0x1b3,0x135,0x16a,0x176,0x0df,0x1e5,0x188,0x0c5,0x16e,0x1de,0x1b1,
    0x0c3,0x1df,0x036,0x0ee,0x1ee,0x0f0,0x093,0x049,0x09a,0x1b6,0x069,0x081,0x125,0x00b,0x05e,0x0b4,
    0x149,0x1c7,0x174,0x03e,0x13b,0x1b7,0x08e,0x1c6,0x0ae,0x010,0x095,0x1ef,0x04e,0x0f2,0x1fd,0x085,
    0x0fd,0x0f6,0x0a0,0x16f,0x083,0x08a,0x156,0x09b,0x13c,0x107,0x167,0x098,0x1d0,0x1e9,0x003,0x1fe,
    0x0bd,0x122,0x089,0x0d2,0x18f,0x012,0x033,0x06a,0x142,0x0ed,0x170,0x11b,0x0e2,0x14f,0x158,0x131,
    0x147,0x05d,0x113,0x1cd,0x079,0x161,0x1a5,0x179,0x09e,0x1b4,0x0cc,0x022,0x132,0x01a,0x0e8,0x004,
    0x187,0x1ed,0x197,0x039,0x1bf,0x1d7,0x027,0x18b,0x0c6,0x09c,0x0d0,0x14e,0x06c,0x034,0x1f2,0x06e,
    0x0ca,0x025,0x0ba,0x191,0x0fe,0x013,0x106,0x02f,0x1ad,0x172,0x1db,0x0c0,0x10b,0x1d6,0x0f5,0x1ec,
    0x10d,0x076,0x114,0x1ab,0x075,0x10c,0x1e4,0x159,0x054,0x11f,0x04b,0x0c4,0x1be,0x0f7,0x029,0x0a4,
    0x00e,0x1f0,0x077,0x04d,0x17a,0x086,0x08b,0x0b3,0x171,0x0bf,0x10e,0x104,0x097,0x15b,0x160,0x168,
    0x0d7,0x0bb,0x066,0x1ce,0x0fc,0x092,0x1c5,0x06f,0x016,0x04a,0x0a1,0x139,0x0af,0x0f1,0x190,0x00a,
    0x1aa,0x143,0x17b,0x056,0x18d,0x166,0x0d4,0x1fb,0x14d,0x194,0x19a,0x087,0x1f8,0x123,0x0a7,0x1b8,
    0x141,0x03c,0x1f9,0x140,0x02a,0x155,0x11a,0x1a1,0x198,0x0d5,0x126,0x1af,0x061,0x12e,0x157,0x1dc,
    0x072,0x18a,0x0aa,0x096,0x115,0x0ef,0x045,0x07b,0x08d,0x145,0x053,0x05f,0x178,0x0b2,0x02e,0x020,
    0x1d5,0x03f,0x1c9,0x1e7,0x1ac,0x044,0x038,0x014,0x0b1,0x16b,0x0ab,0x0b5,0x05a,0x182,0x1c8,0x1d4,
    0x018,0x177,0x064,0x0cf,0x06d,0x100,0x199,0x130,0x15a,0x005,0x120,0x1bb,0x1bd,0x0e0,0x04f,0x0d6,
    0x13f,0x1c4,0x12a,0x015,0x006,0x0ff,0x19b,0x0a6,0x043,0x088,0x050,0x15f,0x1e8,0x121,0x073,0x17e,
    0x0bc,0x0c2,0x0c9,0x173,0x189,0x1f5,0x074,0x1cc,0x1e6,0x1a8,0x195,0x01f,0x041,0x00d,0x1ba,0x032,
    0x03d,0x1d1,0x080,0x0a8,0x057,0x1b9,0x162,0x148,0x0d9,0x105,0x062,0x07a,0x021,0x1ff,0x112,0x108,
    0x1c0,0x0a9,0x11d,0x1b0,0x1a6,0x0cd,0x0f3,0x05c,0x102,0x05b,0x1d9,0x144,0x1f6,0x0ad,0x0a5,0x03a,
    0x1cb,0x136,0x17f,0x046,0x0e1,0x01e,0x1dd,0x0e6,0x137,0x1fa,0x185,0x08c,0x08f,0x040,0x1b5,0x0be,
    0x078,0x000,0x0ac,0x110,0x15e,0x124,0x002,0x1bc,0x0a2,0x0ea,0x070,0x1fc,0x116,0x15c,0x04c,0x1c2
  ]);

  function S7(x) { return S7TABLE[OpCodes.And32(x, 0x7F)]; }
  function S9(x) { return S9TABLE[OpCodes.And32(x, 0x1FF)]; }

  function mod8(x) { return ((x % 8) + 8) % 8; }

  // FI: two-stage S-box lattice (differs from RFC 2994's single-pass form).
  function FI(fiIn, subkey) {
    const D9 = OpCodes.And32(OpCodes.Shr32(fiIn, 7), 0x1FF);
    const D7 = OpCodes.And32(fiIn, 0x7F);
    const t1 = OpCodes.Xor32(S9(D9), D7);
    const t2 = OpCodes.Xor32(S7(D7), t1);
    const dLo7 = OpCodes.And32(t2, 0x7F);
    const kLow9 = OpCodes.And32(subkey, 0x1FF);
    const kHigh7 = OpCodes.And32(OpCodes.Shr32(subkey, 9), 0x7F);
    const d9prime = OpCodes.And32(OpCodes.Xor32(t1, kLow9), 0x1FF);
    const dHi7 = OpCodes.Xor32(dLo7, kHigh7);
    const d9 = OpCodes.Xor32(S9(d9prime), dHi7);
    return OpCodes.Or32(OpCodes.Shl32(OpCodes.And32(dHi7, 0x7F), 9), OpCodes.And32(d9, 0x1FF));
  }

  // FO: 3-stage mix of the two 16-bit halves (mirrored order vs RFC 2994).
  function FO(EK, foIn, k) {
    const Thi = OpCodes.And32(OpCodes.Shr32(foIn, 16), 0xFFFF);
    const Tlo = OpCodes.And32(foIn, 0xFFFF);
    const A1 = OpCodes.And32(OpCodes.Xor32(Thi, EK[k]), 0xFFFF);
    const R1 = FI(A1, EK[8 + mod8(k + 5)]);
    const B1 = OpCodes.And32(OpCodes.Xor32(R1, Tlo), 0xFFFF);
    const C1 = OpCodes.And32(OpCodes.Xor32(Tlo, EK[mod8(k + 2)]), 0xFFFF);
    const R2 = FI(C1, EK[8 + mod8(k + 1)]);
    const D1 = OpCodes.And32(OpCodes.Xor32(B1, EK[mod8(k + 7)]), 0xFFFF);
    const mixed = OpCodes.And32(OpCodes.Xor32(R2, B1), 0xFFFF);
    const R3 = FI(D1, EK[8 + mod8(k + 3)]);
    const finalLow = OpCodes.And32(OpCodes.Xor32(R3, mixed), 0xFFFF);
    const finalHigh = OpCodes.And32(OpCodes.Xor32(EK[mod8(k + 4)], mixed), 0xFFFF);
    return OpCodes.Or32(OpCodes.Shl32(finalHigh, 16), finalLow);
  }

  // FL: matches RFC 2994's FL definition exactly.
  function FL(EK, flIn, k) {
    let dHi = OpCodes.And32(OpCodes.Shr32(flIn, 16), 0xFFFF);
    let dLo = OpCodes.And32(flIn, 0xFFFF);
    if (k % 2 === 0) {
      const n = k / 2;
      dLo = OpCodes.And32(OpCodes.Xor32(dLo, OpCodes.And32(dHi, EK[n])), 0xFFFF);
      dHi = OpCodes.And32(OpCodes.Xor32(dHi, dLo | EK[8 + mod8(n + 6)]), 0xFFFF);
    } else {
      const m = (k - 1) / 2;
      dLo = OpCodes.And32(OpCodes.Xor32(dLo, OpCodes.And32(dHi, EK[8 + mod8(m + 2)])), 0xFFFF);
      dHi = OpCodes.And32(OpCodes.Xor32(dHi, dLo | EK[mod8(m + 4)]), 0xFFFF);
    }
    return OpCodes.Or32(OpCodes.Shl32(dHi, 16), dLo);
  }

  // FL_inv: exact inverse of FL (reverse update order).
  function FL_inv(EK, flOut, k) {
    const dHi2 = OpCodes.And32(OpCodes.Shr32(flOut, 16), 0xFFFF);
    const dLo2 = OpCodes.And32(flOut, 0xFFFF);
    let dHi, dLo;
    if (k % 2 === 0) {
      const n = k / 2;
      dHi = OpCodes.And32(OpCodes.Xor32(dHi2, dLo2 | EK[8 + mod8(n + 6)]), 0xFFFF);
      dLo = OpCodes.And32(OpCodes.Xor32(dLo2, OpCodes.And32(dHi, EK[n])), 0xFFFF);
    } else {
      const m = (k - 1) / 2;
      dHi = OpCodes.And32(OpCodes.Xor32(dHi2, dLo2 | EK[mod8(m + 4)]), 0xFFFF);
      dLo = OpCodes.And32(OpCodes.Xor32(dLo2, OpCodes.And32(dHi, EK[8 + mod8(m + 2)])), 0xFFFF);
    }
    return OpCodes.Or32(OpCodes.Shl32(dHi, 16), dLo);
  }

  // Key schedule: only the first 16 bytes of the key participate. Each
  // 4-byte group is byte-reversed, then sliced into two big-endian 16-bit
  // words -- i.e. K[2g] = bytes[4g+3]:bytes[4g+2], K[2g+1] = bytes[4g+1]:bytes[4g].
  function expandKey(keyBytes) {
    const K = new Array(8);
    for (let g = 0; g < 4; g++) {
      K[g * 2]     = OpCodes.Pack16BE(keyBytes[g * 4 + 3], keyBytes[g * 4 + 2]);
      K[g * 2 + 1] = OpCodes.Pack16BE(keyBytes[g * 4 + 1], keyBytes[g * 4 + 0]);
    }
    const EK = new Array(16);
    for (let i = 0; i < 8; i++) EK[i] = K[i];
    for (let i = 0; i < 8; i++) EK[i + 8] = OpCodes.And32(FI(EK[i], EK[mod8(i + 1)]), 0xFFFF);
    return EK;
  }

  function blockToDwords(block) {
    return [
      OpCodes.Pack32LE(block[0], block[1], block[2], block[3]),
      OpCodes.Pack32LE(block[4], block[5], block[6], block[7])
    ];
  }

  function dwordsToBlock(dwordA, dwordB) {
    return [...OpCodes.Unpack32LE(dwordA), ...OpCodes.Unpack32LE(dwordB)];
  }

  // 8-round FL/FO network. The final two words are swapped before being
  // written back to the block (block[0..3]=Y, block[4..7]=X).
  function encryptBlock(block, EK) {
    const [A, B] = blockToDwords(block);
    let X = FL(EK, A, 0);
    let Y = FL(EK, B, 1);
    for (let pair = 0; pair < 4; pair++) {
      const k = pair * 2;
      Y = OpCodes.Xor32(Y, FO(EK, X, k));
      const t = FO(EK, Y, k + 1);
      X = FL(EK, OpCodes.Xor32(t, X), k + 2);
      Y = FL(EK, Y, k + 3);
    }
    return dwordsToBlock(Y, X);
  }

  function decryptBlock(block, EK) {
    const [dwordA, dwordB] = blockToDwords(block);
    let Yout = dwordA, Xout = dwordB;
    for (let pair = 3; pair >= 0; pair--) {
      const k = pair * 2;
      const Ya = FL_inv(EK, Yout, k + 3);
      const t = FO(EK, Ya, k + 1);
      const Xin = OpCodes.Xor32(FL_inv(EK, Xout, k + 2), t);
      const Yin = OpCodes.Xor32(Ya, FO(EK, Xin, k));
      Xout = Xin; Yout = Yin;
    }
    const A = FL_inv(EK, Xout, 0);
    const B = FL_inv(EK, Yout, 1);
    return dwordsToBlock(A, B);
  }

  class DarkCryptMisty1Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Misty1 (DarkCrypt)";
      this.description = "MISTY1 block cipher (Matsui, 1996) as implemented in the DarkCrypt Total Commander plugin: standard S7 table, a non-standard S9 table, non-standard FI/FO combining formulas, and a final word swap. Declares a 256-bit key but only the first 128 bits are used. 64-bit block.";
      this.inventor = "Mitsuru Matsui (base MISTY1); DarkCrypt variant by Alexander Myasnikov";
      this.year = 1996;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];  // fixed 256-bit (only first 128 bits used)
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];  // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("RFC 2994 - A Description of the MISTY1 Encryption Algorithm", "https://tools.ietf.org/rfc/rfc2994.txt")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard variant", "DarkCrypt uses a modified S9 table and non-standard FI/FO combining formulas, and silently discards half of the declared 256-bit key; unanalyzed and not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Misty — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("81624ab96f0fb76c")
        },
        {
          text: "DarkCrypt Misty — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("8ba6bd45ec482725")
        },
        {
          text: "DarkCrypt Misty — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("a3786b1085819599")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptMisty1Instance(this, isInverse);
    }
  }

  class DarkCryptMisty1Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._roundKeys = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._roundKeys = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 32)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Misty1 (DarkCrypt) requires exactly 32 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._roundKeys = expandKey(this._key);
    }

    get key() { return this._key ? [...this._key] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");
      if (this.inputBuffer.length % this.BlockSize !== 0)
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        output.push(...(this.isInverse ? decryptBlock(block, this._roundKeys) : encryptBlock(block, this._roundKeys)));
      }
      this.inputBuffer = [];
      return output;
    }
  }

  const algorithmInstance = new DarkCryptMisty1Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptMisty1Algorithm, DarkCryptMisty1Instance };
}));
