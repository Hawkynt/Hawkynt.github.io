/*
 * EksLOKI-89 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The "EksLOKI-89-256" block cipher as implemented in the DarkCrypt Total
 * Commander plugin (Alexander Myasnikov, "Zarya" project). It builds on the
 * classic LOKI89 round primitive (Brown/Pieprzyk/Seberry, 1990) but is a
 * heavily extended ("Eks" = expanded) variant:
 *   - 256-bit key (vs 64-bit for textbook LOKI89)
 *   - key schedule expands the 32-byte key through a 256-byte SBOX1 into an
 *     8 KiB key-dependent table, then runs an RC4-like shuffle to build a
 *     256-byte permutation P that supplies all round subkey material
 *   - 18-round Feistel network (vs 16 rounds) with independent per-round
 *     subkeys taken from P, plus input/output whitening
 *   - the round function itself is a multi-layer construction: each round
 *     stacks two or three LOKI89 S-box/permutation passes, XOR-mixing extra
 *     subkey words between the passes (two round-function flavours, one with
 *     an additional mixing word, are interleaved through the network)
 *   - 32-bit words are read/written little-endian
 * The LOKI89 S-boxes are generated from irreducible-polynomial/exponent
 * descriptors over GF(2^8); the fixed permutation P and the descriptor table
 * are the standard LOKI89 tables. No public specification of this DarkCrypt
 * variant exists; this implementation follows the behavior of the DarkCrypt
 * plugin. Test vectors verified against the DarkCrypt implementation
 * (crypt/decrypt round-trip verified).
 * 64-bit blocks, 256-bit keys. Educational only.
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
          LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ---- Fixed LOKI89 tables (DATA) ----

  // 256-byte SBOX1 used by the key schedule.
  const SBOX1 = OpCodes.Hex8ToBytes(
    "a3d70983f848f6f4b321157899b1aff9e72d4d8ace4cca2e5295d91e4e384428" +
    "0adf02a017f1606812b77ac3e9fa3d5396846bbaf2639a197caee5f5f7166aa2" +
    "39b67b0fc193811beeb41aead0912fb855b9da853f41bfe05a58805f660bd890" +
    "35d5c0a733066569450094566d989b7697fcb2c2b0fedb20e1ebd6e4dd474a1d" +
    "42ed9e6e493ccd4327d207d4dec7671889cb301f8dc68faac874dcc95d5c31a4" +
    "7088612c9f0d2b8750825464267d0340344b1c73d1c4fd3bccfb7fabe63e5ba5" +
    "ad04239c145122f02979717eff8c0ee20cefbc72756f37a1ecd38e628b8610e8" +
    "087711be924f24c532369dcff3a6bbac5e6ca9135725b5e3bda83a0105592a46");

  // LOKI89 S-box descriptors: {generator (irreducible poly), exponent} per row.
  const SFN = [
    [375, 31], [379, 31], [391, 31], [395, 31], [397, 31], [415, 31], [419, 31], [425, 31],
    [433, 31], [445, 31], [451, 31], [463, 31], [471, 31], [477, 31], [487, 31], [499, 31]
  ];

  // LOKI89 32-bit permutation P: output bit o receives input bit P[o] (MSB first).
  const PERM = [
    31, 23, 15, 7, 30, 22, 14, 6, 29, 21, 13, 5, 28, 20, 12, 4,
    27, 19, 11, 3, 26, 18, 10, 2, 25, 17, 9, 1, 24, 16, 8, 0
  ];

  // GF(2^8) multiply modulo generator gen.
  function mult8(a, b, gen) {
    let p = 0;
    while (b) {
      if (OpCodes.And32(b, 1)) p ^= a;
      a = OpCodes.Shl32(a, 1);
      if (a >= 256) a ^= gen;
      b = OpCodes.Shr32(b, 1);
    }
    return OpCodes.And32(p, 0xff);
  }

  // GF(2^8) exponentiation: base^exp mod gen.
  function exp8(base, exp, gen) {
    if (base === 0) return 0;
    let acc = OpCodes.And32(base, 0xff), res = 1;
    while (exp) {
      if (OpCodes.And32(exp, 1)) res = mult8(res, acc, gen);
      exp = OpCodes.Shr32(exp, 1);
      acc = mult8(acc, acc, gen);
    }
    return OpCodes.And32(res, 0xff);
  }

  // Precompute the 12-bit -> 8-bit LOKI89 S-box lookup (derived from SFN, DATA).
  const S12 = new Uint8Array(4096);
  for (let i = 0; i < 4096; i++) {
    const row = OpCodes.Or32(OpCodes.And32(OpCodes.Shr32(i, 8), 0xc), OpCodes.And32(i, 3));
    const col = OpCodes.And32(OpCodes.Shr32(i, 2), 0xff);
    S12[i] = exp8(OpCodes.And32(OpCodes.Xor32(col, row), 0xff), SFN[row][1], SFN[row][0]);
  }

  // Precompute per-output-bit shift/index for the P permutation.
  // out bit position (from MSB) o -> takes input bit PERM[o].
  const S = a => {
    a = OpCodes.ToUint32(a);
    return OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(S12[OpCodes.And32(a, 0xfff)], OpCodes.Shl32(S12[OpCodes.And32(OpCodes.Shr32(a, 8), 0xfff)], 8)), OpCodes.Shl32(S12[OpCodes.And32(OpCodes.Shr32(a, 16), 0xfff)], 16)), OpCodes.Shl32(S12[OpCodes.And32(OpCodes.Or32(OpCodes.Shr32(a, 24), OpCodes.Shl32(a, 8)), 0xfff)], 24));
  };

  function perm32(inp) {
    let out = 0, mask = 0x80000000;
    for (let o = 0; o < 32; o++) {
      if (OpCodes.And32(OpCodes.Shr32(inp, PERM[o]), 1)) out = OpCodes.Or32(out, mask);
      mask = OpCodes.Shr32(mask, 1);
    }
    return OpCodes.ToUint32(out);
  }

  const SP = a => perm32(S(a));

  // Round-function flavour B: two S/P passes with one S-only pass, mixing Ta, Tb.
  function fB(x, SK, Ta, Tb) {
    let t = SP(OpCodes.Xor32(x, SK));
    t = OpCodes.Xor32(t, Ta);
    t = OpCodes.Xor32(S(t), Tb);
    return SP(t);
  }

  // Round-function flavour A: as B plus an additional S-only pass mixing U.
  function fA(x, SK, Ta, Tb, U) {
    let t = SP(OpCodes.Xor32(x, SK));
    t = OpCodes.Xor32(t, Ta);
    t = OpCodes.Xor32(S(t), Tb);
    t = OpCodes.Xor32(S(t), U);
    return SP(t);
  }

  // Per-round subkey word indices into the 64-word permutation P.
  // [SK, Ta, Tb, (U)]; rounds carrying a 4th index use flavour A.
  const ROUND_KEYS = [
    [2, 20, 21, 56], [3, 22, 23],     [4, 24, 25],
    [5, 26, 27, 57], [6, 28, 29],     [7, 30, 31],
    [8, 32, 33, 58], [9, 34, 35],     [10, 36, 37],
    [11, 38, 39, 59], [12, 40, 41],   [13, 42, 43],
    [14, 44, 45, 60], [15, 46, 47],   [16, 48, 49],
    [17, 50, 51, 61], [18, 52, 53],   [19, 54, 55]
  ];

  function roundFunction(round, data, p) {
    const e = ROUND_KEYS[round - 1];
    return (e.length === 4)
      ? fA(data, p[e[0]], p[e[1]], p[e[2]], p[e[3]])
      : fB(data, p[e[0]], p[e[1]], p[e[2]]);
  }

  // Expand a 32-byte key into 64 little-endian subkey words (the permutation P).
  function expandKey(key) {
    // table2[k*256 + j] = SBOX1[key[k] ^ j]
    const table2 = new Uint8Array(32 * 256);
    for (let k = 0; k < 32; k++) {
      const kk = key[k];
      const base = k * 256;
      for (let j = 0; j < 256; j++) table2[base + j] = SBOX1[OpCodes.And32(OpCodes.Xor32(kk, j), 0xff)];
    }
    // Identity permutation, then an RC4-like key-dependent shuffle.
    const P = new Uint8Array(256);
    for (let i = 0; i < 256; i++) P[i] = i;
    let carry = 0;
    // Counter continues from 0x100 (left over from the identity-fill loop).
    for (let i = 0x100; i < 0xC000; i++) {
      carry = SBOX1[carry];
      const pos1 = OpCodes.And32(i, 0xff);
      const t = OpCodes.And32(P[pos1] + table2[OpCodes.And32(i, 0x1fff)] + carry, 0xff);
      const t2 = OpCodes.And32(OpCodes.Or32(OpCodes.Shl32(t, 1), OpCodes.Shr32(t, 7)), 0xff);   // rotate byte left by 1
      const B = P[t2];
      const A = P[pos1], C = P[B];
      P[pos1] = C; P[B] = A;                       // swap P[pos1] and P[B]
      carry = B;
    }
    const p = new Array(64);
    for (let i = 0; i < 64; i++)
      p[i] = OpCodes.Pack32LE(P[i * 4], P[i * 4 + 1], P[i * 4 + 2], P[i * 4 + 3]);
    return p;
  }

  class DarkCryptEksLOKI89Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "EksLOKI-89 (DarkCrypt)";
      this.description = "Expanded LOKI89 variant from the DarkCrypt Total Commander plugin. Uses a 256-bit key expanded via an RC4-like key schedule into a 256-byte permutation supplying subkeys for an 18-round Feistel network whose round function stacks multiple LOKI89 S-box/permutation passes. 64-bit block, 256-bit key.";
      this.inventor = "Lawrie Brown, Josef Pieprzyk, Jennifer Seberry (base LOKI89); DarkCrypt variant by Alexander Myasnikov";
      this.year = 2009;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];  // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];   // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("LOKI89 (base algorithm)", "https://en.wikipedia.org/wiki/LOKI")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard variant", "Custom expanded LOKI89 with a bespoke key schedule and round function; unanalyzed and not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Eksloki89 — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("ce1f4a43dbf023a2")
        },
        {
          text: "DarkCrypt Eksloki89 — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("11a7f5d2c116be80")
        },
        {
          text: "DarkCrypt Eksloki89 — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("d4b4ee5170264650")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptEksLOKI89Instance(this, isInverse);
    }
  }

  class DarkCryptEksLOKI89Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._p = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._p = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 32)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. EksLOKI-89 (DarkCrypt) requires exactly 32 bytes`);
      this._key = [...keyBytes];
      this._p = expandKey(this._key);
      this.KeySize = keyBytes.length;
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

    _encryptBlock(block) {
      const p = this._p;
      const X0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      const X1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      let L = OpCodes.Xor32(X0, p[0]);
      let R = OpCodes.Xor32(X1, p[1]);
      for (let r = 1; r <= 18; r++) {
        if (OpCodes.And32(r, 1)) L = OpCodes.Xor32(L, roundFunction(r, R, p));
        else       R = OpCodes.Xor32(R, roundFunction(r, L, p));
      }
      const out0 = OpCodes.Xor32(R, p[62]);
      const out1 = OpCodes.Xor32(L, p[63]);
      return [...OpCodes.Unpack32LE(out0), ...OpCodes.Unpack32LE(out1)];
    }

    _decryptBlock(block) {
      const p = this._p;
      const C0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      const C1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      let R = OpCodes.Xor32(C0, p[62]);
      let L = OpCodes.Xor32(C1, p[63]);
      for (let r = 18; r >= 1; r--) {
        if (OpCodes.And32(r, 1)) L = OpCodes.Xor32(L, roundFunction(r, R, p));
        else       R = OpCodes.Xor32(R, roundFunction(r, L, p));
      }
      const X0 = OpCodes.Xor32(L, p[0]);
      const X1 = OpCodes.Xor32(R, p[1]);
      return [...OpCodes.Unpack32LE(X0), ...OpCodes.Unpack32LE(X1)];
    }
  }

  const algorithmInstance = new DarkCryptEksLOKI89Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptEksLOKI89Algorithm, DarkCryptEksLOKI89Instance };
}));
