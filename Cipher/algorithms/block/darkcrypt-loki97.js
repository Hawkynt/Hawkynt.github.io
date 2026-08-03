/*
 * LOKI97 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The LOKI97 block cipher as implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). 128-bit block, 256-bit key, 16 rounds.
 * Test vectors were verified against the DarkCrypt implementation's key
 * schedule and S-box tables, including encrypt/decrypt round-trip.
 *
 * Structure (matches the DarkCrypt implementation exactly):
 *   - Two GF S-boxes: S1(x) = (x^0x1FFF)^3 in GF(2^13) mod 0x2911, kept low byte;
 *                     S2(x) = (x^0x07FF)^3 in GF(2^11) mod 0x0AA7, kept low byte.
 *   - A byte-permutation table P scattering nibble bits to positions 7,15,23,31.
 *   - f(A,B): keyed-permute A by B, expand through eight overlapping S-box lookups
 *     (Sa layer), permute via P, then a second Sb layer folding in B.
 *   - Key schedule: 48 subkeys SK[i] = k4 ^ f(k1 + k3 + i*DELTA, k2) with
 *     DELTA = 0x9E3779B97F4A7C15, Feistel-shifting the four 64-bit key words.
 *   - Encrypt: 16 rounds of R' = L ^ f(R + SKa, SKb); L' = (R + SKa) + SKc.
 * All 64-bit words are big-endian. Educational only.
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

  // ---- 32-bit helpers -------------------------------------------------------
  const u32 = x => OpCodes.ToUint32(x);
  const SHR = (a, n) => (n &= 31, n === 0 ? u32(a) : OpCodes.Shr32(a, n));
  const SHL = (a, n) => (n &= 31, OpCodes.Shl32(a, n));

  // GF(2^m) cube: value^3 with reduction polynomial `red` once a doubling reaches `thr`.
  function gfMul(a, b, red, thr) {
    a = u32(a); b = u32(b); let acc = 0;
    while (b !== 0) {
      if (OpCodes.And32(b, 1)) acc ^= a;
      a = OpCodes.Shl32(a, 1);
      if (u32(a) >= thr) a ^= red;
      b = OpCodes.Shr32(b, 1);
    }
    return u32(acc);
  }
  function cube(x, red, thr) { return gfMul(x, gfMul(x, x, red, thr), red, thr); }
  function S1(i) { return OpCodes.And32(cube(OpCodes.Xor32(i, 0x1FFF), 0x2911, 0x2000), 0xFF); } // GF(2^13)
  function S2(i) { return OpCodes.And32(cube(OpCodes.Xor32(i, 0x07FF), 0x0AA7, 0x0800), 0xFF); } // GF(2^11)

  // 64-bit rotate-left over the pair [hi, lo].
  function rol64(hi, lo, n) {
    n = ((n % 64) + 64) % 64;
    if (n === 0) return [hi, lo];
    if (n === 32) return [lo, hi];
    if (n < 32) return [OpCodes.Or32(OpCodes.Shl32(hi, n), OpCodes.Shr32(lo, 32 - n)), OpCodes.Or32(OpCodes.Shl32(lo, n), OpCodes.Shr32(hi, 32 - n))];
    const m = n - 32;
    return [OpCodes.Or32(OpCodes.Shl32(lo, m), OpCodes.Shr32(hi, 32 - m)), OpCodes.Or32(OpCodes.Shl32(hi, m), OpCodes.Shr32(lo, 32 - m))];
  }

  // Bit-scatter of a byte's low / high nibble to positions 7,15,23,31 (the P table).
  function scatterLow(v)  { let o = 0; for (let j = 0; j < 4; j++) o |= OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(v, 4 + j), 1), 7 + 8 * j); return u32(o); }
  function scatterHigh(v) { let o = 0; for (let j = 0; j < 4; j++) o |= OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(v, j), 1), 7 + 8 * j); return u32(o); }

  // Sa layer S-box selection and index masks per 8-bit segment.
  const SA_TABLES = [S1, S2, S1, S2, S2, S1, S2, S1];
  const SA_MASKS  = [0x1FFF, 0x7FF, 0x1FFF, 0x7FF, 0x7FF, 0x1FFF, 0x7FF, 0x1FFF];

  // 64-bit add / subtract over [hi, lo] pairs.
  function add64(h1, l1, h2, l2) {
    const lo = u32(l1 + l2);
    const carry = OpCodes.ToUint32(lo) < OpCodes.ToUint32(l1) ? 1 : 0;
    return [u32(h1 + h2 + carry), lo];
  }
  function sub64(h1, l1, h2, l2) {
    const borrow = OpCodes.ToUint32(l1) < OpCodes.ToUint32(l2) ? 1 : 0;
    return [u32(h1 - h2 - borrow), u32(l1 - l2)];
  }

  const DELTA_HI = 0x9E3779B9, DELTA_LO = 0x7F4A7C15; // DELTA = 0x9E3779B97F4A7C15

  // The LOKI97 f-function. A = (A1:A2) 64-bit, B = (X:SKr) 64-bit key/tweak word.
  function fFunction(A1, A2, X, SKr) {
    // Keyed swap of A controlled by B: KP1/KP2 pick bits from A1/A2 depending on SKr.
    const KP1 = u32(OpCodes.And32(A1, ~SKr) | OpCodes.And32(A2, SKr));
    const KP2 = u32(OpCodes.And32(A1, SKr) | OpCodes.And32(A2, ~SKr));

    // Sa layer + P permutation over eight overlapping 8-bit windows of (KP1:KP2).
    let pLow = 0, pHigh = 0;
    for (let k = 0; k < 8; k++) {
      const w = rol64(KP1, KP2, 8 * (k + 1));
      const s = SA_TABLES[k](OpCodes.And32(w[1], SA_MASKS[k]));
      pLow  = u32(pLow  | SHR(scatterLow(s),  7 - k));
      pHigh = u32(pHigh | SHR(scatterHigh(s), 7 - k));
    }

    // Sb layer folds the key word X into the permuted value, producing two 32-bit words.
    const l8  = S2(OpCodes.Or32(OpCodes.And32(SHR(X, 21), 0x700), OpCodes.And32(SHR(pLow, 24), 0xFF)));
    const l9  = S2(OpCodes.Or32(OpCodes.And32(SHR(X, 18), 0x700), OpCodes.And32(SHR(pLow, 16), 0xFF)));
    const l10 = S1(OpCodes.Or32(OpCodes.And32(SHR(X, 13), 0x1F00), OpCodes.And32(SHR(pLow, 8), 0xFF)));
    const l11 = S1(OpCodes.Or32(OpCodes.And32(SHR(X, 8), 0x1F00), OpCodes.And32(pLow, 0xFF)));
    const word0 = u32(SHL(l8, 24) | SHL(l9, 16) | SHL(l10, 8) | l11);

    const l12 = S2(OpCodes.Or32(OpCodes.And32(SHR(X, 5), 0x700), OpCodes.And32(SHR(pHigh, 24), 0xFF)));
    const l13 = S2(OpCodes.Or32(OpCodes.And32(SHR(X, 2), 0x700), OpCodes.And32(SHR(pHigh, 16), 0xFF)));
    const l14 = S1(OpCodes.Or32(OpCodes.And32(SHL(X, 3), 0x1F00), OpCodes.And32(SHR(pHigh, 8), 0xFF)));
    const l15 = S1(OpCodes.Or32(OpCodes.And32(SHL(X, 8), 0x1F00), OpCodes.And32(pHigh, 0xFF)));
    const word1 = u32(SHL(l12, 24) | SHL(l13, 16) | SHL(l14, 8) | l15);

    return [word0, word1];
  }

  class DarkCryptLOKI97Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "LOKI97 (DarkCrypt)";
      this.description = "LOKI97 as implemented in the DarkCrypt Total Commander plugin. 128-bit block, 256-bit key, 16-round Feistel with GF-based S-boxes (S1 in GF(2^13), S2 in GF(2^11)), a bit-scatter permutation, and a DELTA=0x9E3779B97F4A7C15 key schedule.";
      this.inventor = "Lawrie Brown, Josef Pieprzyk, Jennifer Seberry (base LOKI97); DarkCrypt variant by Alexander Myasnikov";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];   // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)];  // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("LOKI97 (AES submission, base algorithm)", "https://www.unsw.adfa.edu.au/~lpb/research/loki97/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Differential/linear weaknesses", "LOKI97 was cryptanalysed during the AES process and is not competitive; this DarkCrypt build is unanalysed.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation,
      // cross-checked against its internal 48-word key schedule.
      this.tests = [
        {
          text: "DarkCrypt Lokilib — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("78914e82206f130a6619b59cb5fe4f3b")
        },
        {
          text: "DarkCrypt Lokilib — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("16f9beb8cf88424b8b56c5d3a96da8c7")
        },
        {
          text: "DarkCrypt Lokilib — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("b5635930e1d8ed8bbe7963efe306def1")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptLOKI97Instance(this, isInverse);
    }
  }

  class DarkCryptLOKI97Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._sk = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._sk = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 32)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. LOKI97 (DarkCrypt) requires exactly 32 bytes`);
      this._key = [...keyBytes];
      this._sk = this._keySchedule(this._key);
      this.KeySize = keyBytes.length;
    }

    get key() { return this._key ? [...this._key] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      this.inputBuffer.push(...data);
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

    // 48 subkeys SK[i] = k4 ^ f(k1 + k3 + i*DELTA, k2), Feistel-shifting the key words.
    _keySchedule(keyBytes) {
      // The key loader consumes the 256-bit key as four 64-bit words, each read
      // as two little-endian 32-bit lanes.
      const chunkLE = idx => {
        const o = idx * 8;
        return [
          OpCodes.Pack32LE(keyBytes[o], keyBytes[o + 1], keyBytes[o + 2], keyBytes[o + 3]),
          OpCodes.Pack32LE(keyBytes[o + 4], keyBytes[o + 5], keyBytes[o + 6], keyBytes[o + 7])
        ];
      };
      let Q0 = chunkLE(0), Q1 = chunkLE(1), Q2 = chunkLE(2), Q3 = chunkLE(3);
      let cstHi = DELTA_HI, cstLo = DELTA_LO;  // iteration i uses i*DELTA
      const SK = [];
      for (let i = 1; i <= 48; i++) {
        const a1 = add64(Q0[0], Q0[1], Q2[0], Q2[1]);
        const a2 = add64(a1[0], a1[1], cstHi, cstLo);
        const f = fFunction(a2[0], a2[1], Q1[0], Q1[1]);
        const SKi = [OpCodes.Xor32(Q3[0], f[0]), OpCodes.Xor32(Q3[1], f[1])];
        SK.push(SKi);
        Q3 = Q2; Q2 = Q1; Q1 = Q0; Q0 = SKi;
        const nc = add64(cstHi, cstLo, DELTA_HI, DELTA_LO);
        cstHi = nc[0]; cstLo = nc[1];
      }
      return SK;
    }

    _encryptBlock(block) {
      let L = [OpCodes.Pack32BE(block[0], block[1], block[2], block[3]),
               OpCodes.Pack32BE(block[4], block[5], block[6], block[7])];
      let R = [OpCodes.Pack32BE(block[8], block[9], block[10], block[11]),
               OpCodes.Pack32BE(block[12], block[13], block[14], block[15])];
      const SK = this._sk;
      for (let r = 1; r <= 16; r++) {
        const SKa = SK[3 * r - 3], SKb = SK[3 * r - 2], SKc = SK[3 * r - 1];
        const s1 = add64(R[0], R[1], SKa[0], SKa[1]);
        const fo = fFunction(s1[0], s1[1], SKb[0], SKb[1]);
        const s3 = add64(s1[0], s1[1], SKc[0], SKc[1]);
        const newR = [OpCodes.Xor32(L[0], fo[0]), OpCodes.Xor32(L[1], fo[1])];
        L = s3; R = newR;
      }
      // Ciphertext is stored (R || L).
      return [
        ...OpCodes.Unpack32BE(R[0]), ...OpCodes.Unpack32BE(R[1]),
        ...OpCodes.Unpack32BE(L[0]), ...OpCodes.Unpack32BE(L[1])
      ];
    }

    _decryptBlock(block) {
      let R = [OpCodes.Pack32BE(block[0], block[1], block[2], block[3]),
               OpCodes.Pack32BE(block[4], block[5], block[6], block[7])];
      let L = [OpCodes.Pack32BE(block[8], block[9], block[10], block[11]),
               OpCodes.Pack32BE(block[12], block[13], block[14], block[15])];
      const SK = this._sk;
      for (let r = 16; r >= 1; r--) {
        const SKa = SK[3 * r - 3], SKb = SK[3 * r - 2], SKc = SK[3 * r - 1];
        const X = sub64(L[0], L[1], SKc[0], SKc[1]);
        const fo = fFunction(X[0], X[1], SKb[0], SKb[1]);
        const newR = sub64(X[0], X[1], SKa[0], SKa[1]);
        const newL = [OpCodes.Xor32(R[0], fo[0]), OpCodes.Xor32(R[1], fo[1])];
        L = newL; R = newR;
      }
      return [
        ...OpCodes.Unpack32BE(L[0]), ...OpCodes.Unpack32BE(L[1]),
        ...OpCodes.Unpack32BE(R[0]), ...OpCodes.Unpack32BE(R[1])
      ];
    }
  }

  const algorithmInstance = new DarkCryptLOKI97Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptLOKI97Algorithm, DarkCryptLOKI97Instance };
}));
