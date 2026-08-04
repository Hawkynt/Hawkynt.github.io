/*
 * CS-Cipher (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * CS-Cipher ("Chiffrement Symetrique") as implemented in the DarkCrypt Total Commander
 * plugin (Alexander Myasnikov, "Zarya" project), matching the published design
 * (Stern & Vaudenay, FSE 1998): a 64-bit block, 128-bit key cipher whose round function
 * combines a fixed byte S-box with an 8x8 bit-matrix transposition, using the hexadecimal
 * digits of e as "nothing up my sleeve" round constants. Concrete parameters (rounds, key
 * schedule feedback structure) as used by the DarkCrypt implementation:
 *   - 12 elementary rounds (each round = two S-box+diffusion sub-layers), plus an initial
 *     8-byte key-dependent whitening XOR.
 *   - Round-key material is 200 bytes: 8 bytes whitening, followed by 8 groups of
 *     [8 bytes of e's hex digits][8 bytes of e's hex digits][8 key-derived bytes].
 *   - The 8 key-derived 8-byte blocks are produced by a feedback generator:
 *       Block[p] = Transpose( S( Block[p-1] XOR Sbox[8p..8p+7] ) ) XOR Block[p-2]
 *     seeded with Block[-2] = key[8..15], Block[-1] = key[0..7].
 * 64-bit blocks, 128-bit keys. Educational only.
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

  const ROUNDS = 12;

  // CS-Cipher S-box (matches the published Stern/Vaudenay S-box exactly).
  const CS_SBOX = [
    0x29,0x0d,0x61,0x40,0x9c,0xeb,0x9e,0x8f,0x1f,0x85,0x5f,0x58,0x5b,0x01,0x39,0x86,
    0x97,0x2e,0xd7,0xd6,0x35,0xae,0x17,0x16,0x21,0xb6,0x69,0x4e,0xa5,0x72,0x87,0x08,
    0x3c,0x18,0xe6,0xe7,0xfa,0xad,0xb8,0x89,0xb7,0x00,0xf7,0x6f,0x73,0x84,0x11,0x63,
    0x3f,0x96,0x7f,0x6e,0xbf,0x14,0x9d,0xac,0xa4,0x0e,0x7e,0xf6,0x20,0x4a,0x62,0x30,
    0x03,0xc5,0x4b,0x5a,0x46,0xa3,0x44,0x65,0x7d,0x4d,0x3d,0x42,0x79,0x49,0x1b,0x5c,
    0xf5,0x6c,0xb5,0x94,0x54,0xff,0x56,0x57,0x0b,0xf4,0x43,0x0c,0x4f,0x70,0x6d,0x0a,
    0xe4,0x02,0x3e,0x2f,0xa2,0x47,0xe0,0xc1,0xd5,0x1a,0x95,0xa7,0x51,0x5e,0x33,0x2b,
    0x5d,0xd4,0x1d,0x2c,0xee,0x75,0xec,0xdd,0x7c,0x4c,0xa6,0xb4,0x78,0x48,0x3a,0x32,
    0x98,0xaf,0xc0,0xe1,0x2d,0x09,0x0f,0x1e,0xb9,0x27,0x8a,0xe9,0xbd,0xe3,0x9f,0x07,
    0xb1,0xea,0x92,0x93,0x53,0x6a,0x31,0x10,0x80,0xf2,0xd8,0x9b,0x04,0x36,0x06,0x8e,
    0xbe,0xa9,0x64,0x45,0x38,0x1c,0x7a,0x6b,0xf3,0xa1,0xf0,0xcd,0x37,0x25,0x15,0x81,
    0xfb,0x90,0xe8,0xd9,0x7b,0x52,0x19,0x28,0x26,0x88,0xfc,0xd1,0xe2,0x8c,0xa0,0x34,
    0x82,0x67,0xda,0xcb,0xc7,0x41,0xe5,0xc4,0xc8,0xef,0xdb,0xc3,0xcc,0xab,0xce,0xed,
    0xd0,0xbb,0xd3,0xd2,0x71,0x68,0x13,0x12,0x9a,0xb3,0xc2,0xca,0xde,0x77,0xdc,0xdf,
    0x66,0x83,0xbc,0x8d,0x60,0xc6,0x22,0x23,0xb2,0x8b,0x91,0x05,0x76,0xcf,0x74,0xc9,
    0xaa,0xf1,0x99,0xa8,0x59,0x50,0x3b,0x2a,0xfe,0xf9,0x24,0xb0,0xba,0xfd,0xf8,0x55
  ];

  // Diffusion lookup tables (precomputed bit-matrix-transposition halves).
  const CS_L0 = [
    0x00,0x01,0x06,0x07,0x04,0x05,0x02,0x03,0x18,0x19,0x1e,0x1f,0x1c,0x1d,0x1a,0x1b,
    0x10,0x11,0x16,0x17,0x14,0x15,0x12,0x13,0x08,0x09,0x0e,0x0f,0x0c,0x0d,0x0a,0x0b,
    0x60,0x61,0x66,0x67,0x64,0x65,0x62,0x63,0x78,0x79,0x7e,0x7f,0x7c,0x7d,0x7a,0x7b,
    0x70,0x71,0x76,0x77,0x74,0x75,0x72,0x73,0x68,0x69,0x6e,0x6f,0x6c,0x6d,0x6a,0x6b,
    0x40,0x41,0x46,0x47,0x44,0x45,0x42,0x43,0x58,0x59,0x5e,0x5f,0x5c,0x5d,0x5a,0x5b,
    0x50,0x51,0x56,0x57,0x54,0x55,0x52,0x53,0x48,0x49,0x4e,0x4f,0x4c,0x4d,0x4a,0x4b,
    0x20,0x21,0x26,0x27,0x24,0x25,0x22,0x23,0x38,0x39,0x3e,0x3f,0x3c,0x3d,0x3a,0x3b,
    0x30,0x31,0x36,0x37,0x34,0x35,0x32,0x33,0x28,0x29,0x2e,0x2f,0x2c,0x2d,0x2a,0x2b,
    0x81,0x80,0x87,0x86,0x85,0x84,0x83,0x82,0x99,0x98,0x9f,0x9e,0x9d,0x9c,0x9b,0x9a,
    0x91,0x90,0x97,0x96,0x95,0x94,0x93,0x92,0x89,0x88,0x8f,0x8e,0x8d,0x8c,0x8b,0x8a,
    0xe1,0xe0,0xe7,0xe6,0xe5,0xe4,0xe3,0xe2,0xf9,0xf8,0xff,0xfe,0xfd,0xfc,0xfb,0xfa,
    0xf1,0xf0,0xf7,0xf6,0xf5,0xf4,0xf3,0xf2,0xe9,0xe8,0xef,0xee,0xed,0xec,0xeb,0xea,
    0xc1,0xc0,0xc7,0xc6,0xc5,0xc4,0xc3,0xc2,0xd9,0xd8,0xdf,0xde,0xdd,0xdc,0xdb,0xda,
    0xd1,0xd0,0xd7,0xd6,0xd5,0xd4,0xd3,0xd2,0xc9,0xc8,0xcf,0xce,0xcd,0xcc,0xcb,0xca,
    0xa1,0xa0,0xa7,0xa6,0xa5,0xa4,0xa3,0xa2,0xb9,0xb8,0xbf,0xbe,0xbd,0xbc,0xbb,0xba,
    0xb1,0xb0,0xb7,0xb6,0xb5,0xb4,0xb3,0xb2,0xa9,0xa8,0xaf,0xae,0xad,0xac,0xab,0xaa
  ];

  const CS_L3 = [
    0x00,0x02,0x04,0x06,0x08,0x0a,0x0c,0x0e,0x10,0x12,0x14,0x16,0x18,0x1a,0x1c,0x1e,
    0x20,0x22,0x24,0x26,0x28,0x2a,0x2c,0x2e,0x30,0x32,0x34,0x36,0x38,0x3a,0x3c,0x3e,
    0x40,0x42,0x44,0x46,0x48,0x4a,0x4c,0x4e,0x50,0x52,0x54,0x56,0x58,0x5a,0x5c,0x5e,
    0x60,0x62,0x64,0x66,0x68,0x6a,0x6c,0x6e,0x70,0x72,0x74,0x76,0x78,0x7a,0x7c,0x7e,
    0x80,0x82,0x84,0x86,0x88,0x8a,0x8c,0x8e,0x90,0x92,0x94,0x96,0x98,0x9a,0x9c,0x9e,
    0xa0,0xa2,0xa4,0xa6,0xa8,0xaa,0xac,0xae,0xb0,0xb2,0xb4,0xb6,0xb8,0xba,0xbc,0xbe,
    0xc0,0xc2,0xc4,0xc6,0xc8,0xca,0xcc,0xce,0xd0,0xd2,0xd4,0xd6,0xd8,0xda,0xdc,0xde,
    0xe0,0xe2,0xe4,0xe6,0xe8,0xea,0xec,0xee,0xf0,0xf2,0xf4,0xf6,0xf8,0xfa,0xfc,0xfe,
    0x01,0x03,0x05,0x07,0x09,0x0b,0x0d,0x0f,0x11,0x13,0x15,0x17,0x19,0x1b,0x1d,0x1f,
    0x21,0x23,0x25,0x27,0x29,0x2b,0x2d,0x2f,0x31,0x33,0x35,0x37,0x39,0x3b,0x3d,0x3f,
    0x41,0x43,0x45,0x47,0x49,0x4b,0x4d,0x4f,0x51,0x53,0x55,0x57,0x59,0x5b,0x5d,0x5f,
    0x61,0x63,0x65,0x67,0x69,0x6b,0x6d,0x6f,0x71,0x73,0x75,0x77,0x79,0x7b,0x7d,0x7f,
    0x81,0x83,0x85,0x87,0x89,0x8b,0x8d,0x8f,0x91,0x93,0x95,0x97,0x99,0x9b,0x9d,0x9f,
    0xa1,0xa3,0xa5,0xa7,0xa9,0xab,0xad,0xaf,0xb1,0xb3,0xb5,0xb7,0xb9,0xbb,0xbd,0xbf,
    0xc1,0xc3,0xc5,0xc7,0xc9,0xcb,0xcd,0xcf,0xd1,0xd3,0xd5,0xd7,0xd9,0xdb,0xdd,0xdf,
    0xe1,0xe3,0xe5,0xe7,0xe9,0xeb,0xed,0xef,0xf1,0xf3,0xf5,0xf7,0xf9,0xfb,0xfd,0xff
  ];

  // Hexadecimal digits of e (2.b7e151628aed2a6abf7158809cf4f3c7...), used as "nothing up my
  // sleeve" round constants.
  const CS_EDIGITS = OpCodes.Hex8ToBytes("b7e151628aed2a6abf7158809cf4f3c7");

  // Inverse S-box and the inverse of (L0[x] ^ L3[x]), precomputed once for decryption.
  const CS_SBOX_INV = new Array(256);
  for (let i = 0; i < 256; i++) CS_SBOX_INV[CS_SBOX[i]] = i;

  const CS_M_INV = new Array(256);
  for (let i = 0; i < 256; i++) CS_M_INV[OpCodes.Xor32(CS_L0[i], CS_L3[i])] = i;

  // Elementary nonlinear+diffusion functions used by both key schedule and round function.
  function P(a, b) { return CS_SBOX[OpCodes.Xor32(CS_L0[a], b)]; }
  function Q(a, b) { return CS_SBOX[OpCodes.Xor32(CS_L3[a], b)]; }

  // Recovers (a, b) from (u = P(a,b) ^ k1, v = Q(a,b) ^ k2).
  function invertPQ(u, k1, v, k2) {
    const x = CS_SBOX_INV[OpCodes.Xor32(u, k1)];
    const y = CS_SBOX_INV[OpCodes.Xor32(v, k2)];
    const a = CS_M_INV[OpCodes.Xor32(x, y)];
    const b = OpCodes.Xor32(x, CS_L0[a]);
    return [a, b];
  }

  // 8x8 bit-matrix transposition (bit i of row j becomes bit j of row i, MSB-first in both
  // dimensions), used by the key-schedule feedback generator.
  function transpose8x8(y) {
    const out = new Array(8);
    for (let i = 0; i < 8; i++) {
      let v = 0;
      for (let j = 0; j < 8; j++) {
        const bit = OpCodes.And32(OpCodes.Shr32(y[j], 7 - i), 1);
        v |= OpCodes.Shl32(bit, 7 - j);
      }
      out[i] = v;
    }
    return out;
  }

  class DarkCryptCSCipherAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "CS-Cipher (DarkCrypt)";
      this.description = "CS-Cipher as implemented in the DarkCrypt Total Commander plugin: 64-bit block, 128-bit key, 12 elementary rounds. Matches the published Stern/Vaudenay S-box and e-digit round constants.";
      this.inventor = "Jacques Stern, Serge Vaudenay (base CS-Cipher); DarkCrypt variant by Alexander Myasnikov";
      this.year = 1998;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.FR;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];  // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];   // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("CS-Cipher (Stern, Vaudenay, FSE 1998)", "https://link.springer.com/chapter/10.1007/3-540-69710-1_13")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Not selected for NESSIE", "Submitted to the NESSIE project but not selected; later cryptanalysis found weaknesses in reduced-round variants.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Cscipher — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("e7557c23ea2074bb")
        },
        {
          text: "DarkCrypt Cscipher — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("434a4eaec4abf667")
        },
        {
          text: "DarkCrypt Cscipher — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("3b99b12ffcb158e4")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptCSCipherInstance(this, isInverse);
    }
  }

  class DarkCryptCSCipherInstance extends IBlockCipherInstance {
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
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. CS-Cipher (DarkCrypt) requires exactly 16 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._roundKeys = this._expandKey(this._key);
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

    // Builds the 200-byte round-key buffer: 8 bytes of whitening, followed by 8 groups of
    // [e-digits low half][e-digits high half][8 key-derived feedback bytes].
    _expandKey(key) {
      const blocks = [key.slice(8, 16), key.slice(0, 8)]; // Block[-2], Block[-1]
      for (let p = 0; p < 9; p++) {
        const prev1 = blocks[blocks.length - 1];
        const prev2 = blocks[blocks.length - 2];
        const c = CS_SBOX.slice(8 * p, 8 * p + 8);
        const x = prev1.map((b, i) => OpCodes.Xor32(b, c[i]));
        const y = x.map(v => CS_SBOX[v]);
        const t = transpose8x8(y);
        blocks.push(t.map((b, i) => OpCodes.Xor32(b, prev2[i])));
      }

      const generated = blocks.slice(2); // Block[0..8]
      const rk = generated[0].slice();   // whitening = Block[0]
      for (let g = 0; g < 8; g++) {
        rk.push(...CS_EDIGITS.slice(0, 8));
        rk.push(...CS_EDIGITS.slice(8, 16));
        rk.push(...generated[g + 1]);
      }
      return rk; // 200 bytes
    }

    _encryptBlock(block) {
      const rk = this._roundKeys;
      let s = block.map((b, i) => OpCodes.Xor32(b, rk[i]));

      for (let r = 0; r < ROUNDS; r++) {
        const base = 8 + r * 16;
        const k = rk.slice(base, base + 16);

        const d = new Array(8);
        d[0] = OpCodes.Xor32(P(s[0], s[1]), k[0]);
        d[1] = OpCodes.Xor32(P(s[2], s[3]), k[1]);
        d[2] = OpCodes.Xor32(P(s[4], s[5]), k[2]);
        d[3] = OpCodes.Xor32(P(s[6], s[7]), k[3]);
        d[4] = OpCodes.Xor32(Q(s[0], s[1]), k[4]);
        d[5] = OpCodes.Xor32(Q(s[2], s[3]), k[5]);
        d[6] = OpCodes.Xor32(Q(s[4], s[5]), k[6]);
        d[7] = OpCodes.Xor32(Q(s[6], s[7]), k[7]);

        const ns = new Array(8);
        ns[0] = OpCodes.Xor32(P(d[0], d[1]), k[8]);
        ns[1] = OpCodes.Xor32(P(d[2], d[3]), k[9]);
        ns[2] = OpCodes.Xor32(P(d[4], d[5]), k[10]);
        ns[3] = OpCodes.Xor32(P(d[6], d[7]), k[11]);
        ns[4] = OpCodes.Xor32(Q(d[0], d[1]), k[12]);
        ns[5] = OpCodes.Xor32(Q(d[2], d[3]), k[13]);
        ns[6] = OpCodes.Xor32(Q(d[4], d[5]), k[14]);
        ns[7] = OpCodes.Xor32(Q(d[6], d[7]), k[15]);
        s = ns;
      }

      return s;
    }

    _decryptBlock(block) {
      const rk = this._roundKeys;
      let s = block.slice();

      for (let r = ROUNDS - 1; r >= 0; r--) {
        const base = 8 + r * 16;
        const k = rk.slice(base, base + 16);

        const d = new Array(8);
        let ab = invertPQ(s[0], k[8], s[4], k[12]);  d[0] = ab[0]; d[1] = ab[1];
        ab = invertPQ(s[1], k[9], s[5], k[13]);       d[2] = ab[0]; d[3] = ab[1];
        ab = invertPQ(s[2], k[10], s[6], k[14]);      d[4] = ab[0]; d[5] = ab[1];
        ab = invertPQ(s[3], k[11], s[7], k[15]);      d[6] = ab[0]; d[7] = ab[1];

        const ps = new Array(8);
        ab = invertPQ(d[0], k[0], d[4], k[4]);        ps[0] = ab[0]; ps[1] = ab[1];
        ab = invertPQ(d[1], k[1], d[5], k[5]);        ps[2] = ab[0]; ps[3] = ab[1];
        ab = invertPQ(d[2], k[2], d[6], k[6]);        ps[4] = ab[0]; ps[5] = ab[1];
        ab = invertPQ(d[3], k[3], d[7], k[7]);        ps[6] = ab[0]; ps[7] = ab[1];
        s = ps;
      }

      return s.map((b, i) => OpCodes.Xor32(b, rk[i]));
    }
  }

  const algorithmInstance = new DarkCryptCSCipherAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptCSCipherAlgorithm, DarkCryptCSCipherInstance };
}));
