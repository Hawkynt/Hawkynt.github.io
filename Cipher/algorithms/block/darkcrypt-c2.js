/*
 * C2 / Cryptomeria (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The C2 block cipher as implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). This is a direct port of the
 * publicly documented Cryptomeria/C2 cipher structure (4C Entity), a 10-round
 * Feistel network with a 56-bit master key expanded into ten 32-bit round
 * keys via an S-box driven key schedule:
 *   - Round function: t = data + roundKey (mod 2^32); v0 = S[t & 0xFF];
 *     v1 = ((t>>8)&0xFF) ^ rotl8(v0^0x65,1); v2 = ((t>>16)&0xFF) ^ rotl8(v0^0x2B,5);
 *     v3 = ((t>>24)&0xFF) ^ rotl8(v0^0xC9,2); combine little-endian into a
 *     32-bit word w, then output w ^ rotl32(w,9) ^ rotl32(w,22).
 *   - Key schedule: split the 56-bit key into L (24 bits) and R (32 bits);
 *     for round i=0..9: roundKey[i] = (S[(L&0xFF)^i] << 4) + R (mod 2^32),
 *     then rotate the combined 56-bit (L:R) register left by 17 bits.
 *   - Feistel update per round: newR = L + F(R, roundKey); L = R (add mod
 *     2^32, not XOR); after 10 rounds the (L,R) halves are swapped once more
 *     to produce the output words. Decrypt runs the same structure with
 *     subtraction and round keys applied in reverse order (9 downto 0).
 * DarkCrypt exposes a 64-bit (8-byte) key slot via getkeysize(), but setup()
 * only copies the first 7 bytes (56 bits) into the key-schedule state — the
 * 8th key byte is read but never used, matching genuine C2's 56-bit key.
 * Little-endian 32-bit words are read/written directly from the block bytes
 * (no byte-swap).
 * The S-box below (DarkCrypt's chosen "SecretConstant" table) is DarkCrypt's
 * own constant, not the 4C Entity's licensed production S-box, which
 * remains proprietary. Test vectors verified against the DarkCrypt
 * implementation (crypt/decrypt round-trip verified).
 * 64-bit blocks, 64-bit key slot (56 bits effective). Educational only.
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

  const ROUNDS = 10;

  // DarkCrypt's C2 "SecretConstant" S-box (DarkCrypt's own constant, not the 4C Entity's licensed production S-box).
  const SBOX = [
    0xA3,0xD7,0x09,0x83,0xF8,0x48,0xF6,0xF4,0xB3,0x21,0x15,0x78,0x99,0xB1,0xAF,0xF9,
    0xE7,0x2D,0x4D,0x8A,0xCE,0x4C,0xCA,0x2E,0x52,0x95,0xD9,0x1E,0x4E,0x38,0x44,0x28,
    0x0A,0xDF,0x02,0xA0,0x17,0xF1,0x60,0x68,0x12,0xB7,0x7A,0xC3,0xE9,0xFA,0x3D,0x53,
    0x96,0x84,0x6B,0xBA,0xF2,0x63,0x9A,0x19,0x7C,0xAE,0xE5,0xF5,0xF7,0x16,0x6A,0xA2,
    0x39,0xB6,0x7B,0x0F,0xC1,0x93,0x81,0x1B,0xEE,0xB4,0x1A,0xEA,0xD0,0x91,0x2F,0xB8,
    0x55,0xB9,0xDA,0x85,0x3F,0x41,0xBF,0xE0,0x5A,0x58,0x80,0x5F,0x66,0x0B,0xD8,0x90,
    0x35,0xD5,0xC0,0xA7,0x33,0x06,0x65,0x69,0x45,0x00,0x94,0x56,0x6D,0x98,0x9B,0x76,
    0x97,0xFC,0xB2,0xC2,0xB0,0xFE,0xDB,0x20,0xE1,0xEB,0xD6,0xE4,0xDD,0x47,0x4A,0x1D,
    0x42,0xED,0x9E,0x6E,0x49,0x3C,0xCD,0x43,0x27,0xD2,0x07,0xD4,0xDE,0xC7,0x67,0x18,
    0x89,0xCB,0x30,0x1F,0x8D,0xC6,0x8F,0xAA,0xC8,0x74,0xDC,0xC9,0x5D,0x5C,0x31,0xA4,
    0x70,0x88,0x61,0x2C,0x9F,0x0D,0x2B,0x87,0x50,0x82,0x54,0x64,0x26,0x7D,0x03,0x40,
    0x34,0x4B,0x1C,0x73,0xD1,0xC4,0xFD,0x3B,0xCC,0xFB,0x7F,0xAB,0xE6,0x3E,0x5B,0xA5,
    0xAD,0x04,0x23,0x9C,0x14,0x51,0x22,0xF0,0x29,0x79,0x71,0x7E,0xFF,0x8C,0x0E,0xE2,
    0x0C,0xEF,0xBC,0x72,0x75,0x6F,0x37,0xA1,0xEC,0xD3,0x8E,0x62,0x8B,0x86,0x10,0xE8,
    0x08,0x77,0x11,0xBE,0x92,0x4F,0x24,0xC5,0x32,0x36,0x9D,0xCF,0xF3,0xA6,0xBB,0xAC,
    0x5E,0x6C,0xA9,0x13,0x57,0x25,0xB5,0xE3,0xBD,0xA8,0x3A,0x01,0x05,0x59,0x2A,0x46
  ];

  class DarkCryptC2Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "C2 (DarkCrypt)";
      this.description = "Cryptomeria/C2 cipher (4C Entity) as implemented in the DarkCrypt Total Commander plugin: 10-round Feistel network, 56-bit key (of a 64-bit key slot), 64-bit block. Round function combines an S-box lookup with 8-bit and 32-bit rotations. The structure matches the published C2 specification exactly (add-based Feistel, S-box driven key schedule with a 17-bit 56-bit register rotation).";
      this.inventor = "4C Entity, LLC (Cryptomeria/C2 specification); DarkCrypt port by Alexander Myasnikov";
      this.year = 2003;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(8, 8, 0)];   // fixed 64-bit key slot (56 bits effective)
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];  // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("Cryptomeria cipher (C2) — Wikipedia", "https://en.wikipedia.org/wiki/Cryptomeria_cipher"),
        new LinkItem("Cryptanalysis of C2 (CRYPTO 2009)", "https://www.iacr.org/archive/crypto2009/56770248/56770248.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Proprietary S-box substituted", "DarkCrypt uses its own constant table instead of the 4C Entity's licensed production S-box; the real C2 cipher's security also depends on that secret S-box remaining unpublished.", "Use AES or another vetted cipher."),
        new Vulnerability("Short effective key", "Only 56 bits of the 64-bit key slot are used, making brute-force key search feasible.", "Use a cipher with at least 128-bit keys.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt C2 — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000"),
          expected: OpCodes.Hex8ToBytes("afa7ed3f67eecbc0")
        },
        {
          text: "DarkCrypt C2 — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("78b03362d08db481")
        },
        {
          text: "DarkCrypt C2 — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708"),
          expected: OpCodes.Hex8ToBytes("7f6eefe40d2021c9")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptC2Instance(this, isInverse);
    }
  }

  class DarkCryptC2Instance extends IBlockCipherInstance {
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
      if (keyBytes.length !== 8)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. C2 (DarkCrypt) requires exactly 8 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._roundKeys = this._scheduleKey(this._key);
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
        output.push(...(this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block)));
      }
      this.inputBuffer = [];
      return output;
    }

    // Round function F(data,key): S-box substitution plus byte/word rotations.
    _f(data, key) {
      const t = OpCodes.ToUint32(data + key);
      const v0 = SBOX[OpCodes.And32(t, 0xFF)];
      const v1 = OpCodes.Xor32(OpCodes.And32(OpCodes.Shr32(t, 8), 0xFF), OpCodes.RotL8(OpCodes.Xor32(v0, 0x65), 1));
      const v2 = OpCodes.Xor32(OpCodes.And32(OpCodes.Shr32(t, 16), 0xFF), OpCodes.RotL8(OpCodes.Xor32(v0, 0x2B), 5));
      const v3 = OpCodes.Xor32(OpCodes.And32(OpCodes.Shr32(t, 24), 0xFF), OpCodes.RotL8(OpCodes.Xor32(v0, 0xC9), 2));
      const combined = OpCodes.Pack32LE(v0, v1, v2, v3);
      return OpCodes.Xor32(OpCodes.Xor32(combined, OpCodes.RotL32(combined, 9)), OpCodes.RotL32(combined, 22));
    }

    // Key schedule: only the first 7 bytes (56 bits) of the 8-byte key are used.
    _scheduleKey(key) {
      let L = OpCodes.ToUint32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(key[0], 16), OpCodes.Shl32(key[1], 8)), key[2]));
      let R = OpCodes.ToUint32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(key[3], 24), OpCodes.Shl32(key[4], 16)), OpCodes.Shl32(key[5], 8)), key[6]));
      const rk = new Array(ROUNDS);
      for (let i = 0; i < ROUNDS; i++) {
        L = OpCodes.And32(L, 0xFFFFFF);
        const idx = OpCodes.Xor32(OpCodes.And32(L, 0xFF), i);
        rk[i] = OpCodes.ToUint32(OpCodes.Shl32(SBOX[idx], 4) + R);
        const newL = OpCodes.Or32(OpCodes.Shr32(R, 15), OpCodes.Shl32(L, 17));
        const newR = OpCodes.Or32(OpCodes.Shl32(R, 17), OpCodes.Shr32(L, 7));
        L = newL;
        R = newR;
      }
      return rk;
    }

    _encryptBlock(block) {
      let L = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let R = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      const rk = this._roundKeys;
      for (let i = 0; i < ROUNDS; i++) {
        const t = this._f(R, rk[i]);
        const newR = OpCodes.ToUint32(L + t);
        L = R;
        R = newR;
      }
      const tmp = L; L = R; R = tmp;
      return [...OpCodes.Unpack32LE(L), ...OpCodes.Unpack32LE(R)];
    }

    _decryptBlock(block) {
      let L = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let R = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      const rk = this._roundKeys;
      for (let j = ROUNDS - 1; j >= 0; j--) {
        const t = this._f(R, rk[j]);
        const newR = OpCodes.ToUint32(L - t);
        L = R;
        R = newR;
      }
      const tmp = L; L = R; R = tmp;
      return [...OpCodes.Unpack32LE(L), ...OpCodes.Unpack32LE(R)];
    }
  }

  const algorithmInstance = new DarkCryptC2Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptC2Algorithm, DarkCryptC2Instance };
}));
