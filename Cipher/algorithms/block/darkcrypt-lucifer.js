/*
 * Lucifer (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The Lucifer block cipher as implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). 128-bit block, 128-bit key, 16-round
 * Feistel network. Test vectors were verified against the DarkCrypt implementation.
 *
 * Key schedule: the 16-byte key is expanded into two 16-byte buffers — a raw
 * copy, and a copy with each byte's bits permuted by a fixed 8-bit permutation
 * (3,5,0,4,2,1,7,6). setup() precomputes TWO full 16-round schedules (one for
 * encryption, one for decryption) by walking a rotating index through these
 * buffers: for encryption the index advances by 9 (mod 16) between rounds
 * (8 subkey bytes consumed + 1 extra step) starting at index 9; for decryption
 * it advances by 7 (mod 16) starting at index 0. Each round consumes 8 bytes
 * from the bit-permuted buffer as that round's subkey and 1 byte from the raw
 * buffer as that round's "selector" byte.
 *
 * Round function: T = selector[round] XOR (right[0] ^ ... ^ right[7]). For each
 * of the 8 right-half byte positions p, bit p of T (MSB-first) selects one of
 * two 256-entry byte-substitution tables (each a fixed combination of two
 * classic 4-bit Lucifer S-boxes S0/S1 applied to the high/low nibbles in one of
 * the two possible orders); the substituted byte is XORed with that position's
 * subkey byte, and the resulting 8 bits are scattered — one bit each, same bit
 * weight preserved — into the 8 bytes of the left half via a fixed 64-entry
 * permutation table (cyclic shifts of the 8 distinct bit weights). Left/right
 * halves are then swapped (pointer swap) for the next round; after all 16
 * rounds, the two halves are swapped once more in memory.
 *
 * Educational only.
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

  // Fixed 8-bit bit-weight mask, MSB first (used both as a bit-test table and,
  // combined with PERM_TABLE, to build the key-schedule bit permutation).
  const BITMASK = [0x80, 0x40, 0x20, 0x10, 0x08, 0x04, 0x02, 0x01];

  // Per-key-byte bit permutation used to build the "A" key-schedule buffer:
  // source bit j (weight BITMASK[j]) moves to destination bit PERM_TABLE[j].
  const PERM_TABLE = [3, 5, 0, 4, 2, 1, 7, 6];

  // Diffusion table: 8 groups of 8 bytes, group p used for right-half byte
  // position p. Each group is a cyclic rotation of the 8 distinct bit weights,
  // so group[p][k] is always a single bit weight; it selects which single bit
  // of the round-function output for position p lands in left-half byte k
  // (bit weight preserved). This is Lucifer's fixed P-permutation.
  const PBOX = [
    0x04,0x10,0x20,0x02,0x01,0x08,0x40,0x80,0x80,0x04,0x10,0x20,0x02,0x01,0x08,0x40,
    0x40,0x80,0x04,0x10,0x20,0x02,0x01,0x08,0x08,0x40,0x80,0x04,0x10,0x20,0x02,0x01,
    0x01,0x08,0x40,0x80,0x04,0x10,0x20,0x02,0x02,0x01,0x08,0x40,0x80,0x04,0x10,0x20,
    0x20,0x02,0x01,0x08,0x40,0x80,0x04,0x10,0x10,0x20,0x02,0x01,0x08,0x40,0x80,0x04
  ];

  // Byte-substitution table used when the interchange control bit for a given
  // right-half byte position is CLEAR (combines the two classic 4-bit Lucifer
  // S-boxes applied to the nibbles in one fixed order).
  const SBOX_B = [
    0x57,0x15,0x75,0x36,0x17,0x37,0x14,0x54,0x74,0x76,0x16,0x35,0x55,0x77,0x34,0x56,
    0xDF,0x9D,0xFD,0xBE,0x9F,0xBF,0x9C,0xDC,0xFC,0xFE,0x9E,0xBD,0xDD,0xFF,0xBC,0xDE,
    0xCF,0x8D,0xED,0xAE,0x8F,0xAF,0x8C,0xCC,0xEC,0xEE,0x8E,0xAD,0xCD,0xEF,0xAC,0xCE,
    0xD3,0x91,0xF1,0xB2,0x93,0xB3,0x90,0xD0,0xF0,0xF2,0x92,0xB1,0xD1,0xF3,0xB0,0xD2,
    0xD7,0x95,0xF5,0xB6,0x97,0xB7,0x94,0xD4,0xF4,0xF6,0x96,0xB5,0xD5,0xF7,0xB4,0xD6,
    0x5F,0x1D,0x7D,0x3E,0x1F,0x3F,0x1C,0x5C,0x7C,0x7E,0x1E,0x3D,0x5D,0x7F,0x3C,0x5E,
    0xDB,0x99,0xF9,0xBA,0x9B,0xBB,0x98,0xD8,0xF8,0xFA,0x9A,0xB9,0xD9,0xFB,0xB8,0xDA,
    0x43,0x01,0x61,0x22,0x03,0x23,0x00,0x40,0x60,0x62,0x02,0x21,0x41,0x63,0x20,0x42,
    0xC3,0x81,0xE1,0xA2,0x83,0xA3,0x80,0xC0,0xE0,0xE2,0x82,0xA1,0xC1,0xE3,0xA0,0xC2,
    0xC7,0x85,0xE5,0xA6,0x87,0xA7,0x84,0xC4,0xE4,0xE6,0x86,0xA5,0xC5,0xE7,0xA4,0xC6,
    0xCB,0x89,0xE9,0xAA,0x8B,0xAB,0x88,0xC8,0xE8,0xEA,0x8A,0xA9,0xC9,0xEB,0xA8,0xCA,
    0x4B,0x09,0x69,0x2A,0x0B,0x2B,0x08,0x48,0x68,0x6A,0x0A,0x29,0x49,0x6B,0x28,0x4A,
    0x5B,0x19,0x79,0x3A,0x1B,0x3B,0x18,0x58,0x78,0x7A,0x1A,0x39,0x59,0x7B,0x38,0x5A,
    0x47,0x05,0x65,0x26,0x07,0x27,0x04,0x44,0x64,0x66,0x06,0x25,0x45,0x67,0x24,0x46,
    0x4F,0x0D,0x6D,0x2E,0x0F,0x2F,0x0C,0x4C,0x6C,0x6E,0x0E,0x2D,0x4D,0x6F,0x2C,0x4E,
    0x53,0x11,0x71,0x32,0x13,0x33,0x10,0x50,0x70,0x72,0x12,0x31,0x51,0x73,0x30,0x52
  ];

  // Byte-substitution table used when the interchange control bit is SET
  // (same two 4-bit S-boxes, nibble order swapped relative to SBOX_B).
  const SBOX_A = [
    0x57,0xDF,0xCF,0xD3,0xD7,0x5F,0xDB,0x43,0xC3,0xC7,0xCB,0x4B,0x5B,0x47,0x4F,0x53,
    0x15,0x9D,0x8D,0x91,0x95,0x1D,0x99,0x01,0x81,0x85,0x89,0x09,0x19,0x05,0x0D,0x11,
    0x75,0xFD,0xED,0xF1,0xF5,0x7D,0xF9,0x61,0xE1,0xE5,0xE9,0x69,0x79,0x65,0x6D,0x71,
    0x36,0xBE,0xAE,0xB2,0xB6,0x3E,0xBA,0x22,0xA2,0xA6,0xAA,0x2A,0x3A,0x26,0x2E,0x32,
    0x17,0x9F,0x8F,0x93,0x97,0x1F,0x9B,0x03,0x83,0x87,0x8B,0x0B,0x1B,0x07,0x0F,0x13,
    0x37,0xBF,0xAF,0xB3,0xB7,0x3F,0xBB,0x23,0xA3,0xA7,0xAB,0x2B,0x3B,0x27,0x2F,0x33,
    0x14,0x9C,0x8C,0x90,0x94,0x1C,0x98,0x00,0x80,0x84,0x88,0x08,0x18,0x04,0x0C,0x10,
    0x54,0xDC,0xCC,0xD0,0xD4,0x5C,0xD8,0x40,0xC0,0xC4,0xC8,0x48,0x58,0x44,0x4C,0x50,
    0x74,0xFC,0xEC,0xF0,0xF4,0x7C,0xF8,0x60,0xE0,0xE4,0xE8,0x68,0x78,0x64,0x6C,0x70,
    0x76,0xFE,0xEE,0xF2,0xF6,0x7E,0xFA,0x62,0xE2,0xE6,0xEA,0x6A,0x7A,0x66,0x6E,0x72,
    0x16,0x9E,0x8E,0x92,0x96,0x1E,0x9A,0x02,0x82,0x86,0x8A,0x0A,0x1A,0x06,0x0E,0x12,
    0x35,0xBD,0xAD,0xB1,0xB5,0x3D,0xB9,0x21,0xA1,0xA5,0xA9,0x29,0x39,0x25,0x2D,0x31,
    0x55,0xDD,0xCD,0xD1,0xD5,0x5D,0xD9,0x41,0xC1,0xC5,0xC9,0x49,0x59,0x45,0x4D,0x51,
    0x77,0xFF,0xEF,0xF3,0xF7,0x7F,0xFB,0x63,0xE3,0xE7,0xEB,0x6B,0x7B,0x67,0x6F,0x73,
    0x34,0xBC,0xAC,0xB0,0xB4,0x3C,0xB8,0x20,0xA0,0xA4,0xA8,0x28,0x38,0x24,0x2C,0x30,
    0x56,0xDE,0xCE,0xD2,0xD6,0x5E,0xDA,0x42,0xC2,0xC6,0xCA,0x4A,0x5A,0x46,0x4E,0x52
  ];

  function bitPermuteByte(byte) {
    let out = 0;
    for (let j = 0; j < 8; j++)
      if (OpCodes.And32(byte, BITMASK[j])) out |= BITMASK[PERM_TABLE[j]];
    return out;
  }

  // Builds both the encryption (mode=1) and decryption (mode=0) round schedules
  // (16 x 8-byte subkeys, 16 selector bytes) from the 16-byte master key.
  function buildSchedules(key16) {
    const rawBuf = key16.slice();
    const permBuf = key16.map(bitPermuteByte);

    const schedules = {};
    for (const mode of [1, 0]) {
      let idx = (mode === 1) ? 8 : 0;
      const subkeys = [];
      const selectors = [];
      for (let r = 0; r < 16; r++) {
        if (mode === 1) idx = OpCodes.And32(idx + 1, 0xF);
        selectors.push(rawBuf[idx === 0 ? 15 : idx - 1]);
        const roundKey = new Array(8);
        for (let j = 0; j < 8; j++) {
          roundKey[j] = permBuf[idx];
          if (j < 7) idx = OpCodes.And32(idx + 1, 0xF);
        }
        subkeys.push(roundKey);
        if (mode === 1) idx = OpCodes.And32(idx + 1, 0xF);
      }
      schedules[mode] = { subkeys, selectors };
    }
    return schedules;
  }

  function cryptCore(block16, schedule) {
    const blk = block16.slice();
    let leftOff = 0, rightOff = 8;

    for (let r = 0; r < 16; r++) {
      const right = blk.slice(rightOff, rightOff + 8);
      let t = schedule.selectors[r];
      for (let i = 0; i < 8; i++) t ^= right[i];

      for (let p = 0; p < 8; p++) {
        const table = OpCodes.And32(t, BITMASK[p]) ? SBOX_A : SBOX_B;
        const combined = OpCodes.And32(OpCodes.Xor32(table[right[p]], schedule.subkeys[r][p]), 0xFF);
        const group = p * 8;
        for (let k = 0; k < 8; k++)
          blk[leftOff + k] ^= OpCodes.And32(PBOX[group + k], combined);
      }

      const tmp = leftOff; leftOff = rightOff; rightOff = tmp;
    }

    const out = new Array(16);
    for (let i = 0; i < 8; i++) { out[i] = blk[8 + i]; out[8 + i] = blk[i]; }
    return out;
  }

  class DarkCryptLuciferAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Lucifer (DarkCrypt)";
      this.description = "Lucifer variant from the DarkCrypt Total Commander plugin: 128-bit block, 128-bit key, 16-round Feistel network with a data/key-dependent interchange bit selecting between two byte-substitution tables per round, and a fixed bit-level diffusion permutation.";
      this.inventor = "Horst Feistel, Don Coppersmith (base Lucifer); DarkCrypt variant by Alexander Myasnikov";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];  // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("Lucifer (base algorithm, Sorkin 1984 specification)", "https://www.tandfonline.com/doi/abs/10.1080/0161-118491858746")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard variant", "DarkCrypt-specific key schedule and S-box/permutation tables; unanalyzed and not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Lucifer — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("6161616161616161c4c4c4c4c4c4c4c4")
        },
        {
          text: "DarkCrypt Lucifer — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("eac9ad3fbcad4fadbb6351a881169755")
        },
        {
          text: "DarkCrypt Lucifer — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("d4e265cd01b3b803b75efc1b0bda4a8b")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptLuciferInstance(this, isInverse);
    }
  }

  class DarkCryptLuciferInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null; this.KeySize = 0; this._schedules = null;
        return;
      }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Lucifer (DarkCrypt) requires exactly 16 bytes`);

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._schedules = buildSchedules(this._key);
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
        const schedule = this._schedules[this.isInverse ? 0 : 1];
        output.push(...cryptCore(block, schedule));
      }
      this.inputBuffer = [];
      return output;
    }
  }

  const algorithmInstance = new DarkCryptLuciferAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptLuciferAlgorithm, DarkCryptLuciferInstance };
}));
