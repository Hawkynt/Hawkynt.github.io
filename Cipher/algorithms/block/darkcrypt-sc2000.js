/*
 * SC2000 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The SC2000 block cipher as implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). SC2000 was designed by a Fujitsu Labs
 * research group (Shimoyama, Yanami, Yokoyama, et al.), submitted to NESSIE and
 * recommended by CRYPTREC. The general public description (128-bit block, an
 * Ifunc subkey-XOR layer, a Bfunc S-box layer built from a 4-bit S-box applied
 * to a 4x32 bit matrix, and two one-round Feistel Rfunc layers per round built
 * from a 6x6 S-box, a 5x5 S-box, and a 32x32 bit diffusion matrix) matches the
 * published cipher, but this build always runs 6.5 rounds (56 round-key
 * words) regardless of key size — the published spec calls for 7.5 rounds with
 * 192/256-bit keys. Only a 256-bit key is supported by this build (no key
 * extension logic is present for shorter keys).
 * As implemented in the DarkCrypt Total Commander plugin; test vectors
 * verified against the DarkCrypt implementation.
 * 128-bit blocks, 256-bit keys. Educational only.
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

  // ===== TABLES =====

  // 6x6 S-box (64 entries), used for the outer 6-bit fields of Sfunc
  const S6 = [
    47,59,25,42,15,23,28,39,26,38,36,19,60,24,29,56,
    37,63,20,61,55, 2,30,44, 9,10, 6,22,53,48,51,11,
    62,52,35,18,14,46, 0,54,17,40,27, 4,31, 8, 5,12,
     3,16,41,34,33, 7,45,49,50,58, 1,21,43,57,32,13
  ];

  // 5x5 S-box (32 entries), used for the four inner 5-bit fields of Sfunc
  const S5 = [
    20,26, 7,31,19,12,10,15,22,30,13,14, 4,24, 9,18,
    27,11, 1,21, 6,16, 2,28,23, 5, 8, 3, 0,17,29,25
  ];

  // 4x4 S-box (16 entries) for Bfunc, forward direction
  const BSBOX = [2,5,10,12,7,15,1,11,13,6,0,9,4,8,3,14];
  // 4x4 S-box (16 entries) for Bfunc, inverse direction (exact functional inverse of BSBOX)
  const BSBOX_INV = [10,6,0,14,12,1,9,4,13,11,2,7,3,8,15,5];

  // 32x32 bit diffusion matrix used by Mfunc. MATRIX[j] is XORed into the
  // accumulator whenever bit (31-j) of the input word is set.
  const MATRIX = [
    0xD0C19225, 0xA5A2240A, 0x1B84D250, 0xB728A4A1,
    0x6A704902, 0x85DDDBE6, 0x766FF4A4, 0xECDFE128,
    0xAFD13E94, 0xDF837D09, 0xBB27FA52, 0x695059AC,
    0x52A1BB58, 0xCC322F1D, 0x1844565B, 0xB4A8ACF6,
    0x34235438, 0x6847A851, 0xE48C0CBB, 0xCD181136,
    0x9A112A0C, 0x43EC6D0E, 0x87D8D27D, 0x487DC995,
    0x90FB9B4B, 0xA1F63697, 0xFC513ED9, 0x78A37D93,
    0x8D16C5DF, 0x9E0C8BBE, 0x3C381F7C, 0xE9FB0779
  ];

  // Key-schedule selector tables (extended key generation): for output word n,
  // TBL_A[idx1] picks 4 branch indices (0..3) and TBL_B[idx2] picks 4 within-
  // branch indices (0..2); together they select the 4 intermediate words that
  // feed the rotate/add/xor combiner.
  const TBL_A = [
    [0,1,2,3],[1,0,3,2],[2,3,0,1],[3,2,1,0],
    [0,2,3,1],[1,3,2,0],[2,0,1,3],[3,1,0,2],
    [0,3,1,2],[1,2,0,3],[2,1,3,0],[3,0,2,1]
  ];
  const TBL_B = [
    [0,0,0,0],[1,1,1,1],[2,2,2,2],[0,1,0,1],
    [1,2,1,2],[2,0,2,0],[0,2,0,2],[1,0,1,0],
    [2,1,2,1]
  ];

  const ROUNDS = 6; // 6.5 rounds: 6 full rounds plus a final Ifunc/Bfunc/Ifunc half-round
  const RK_WORDS = 56;

  class DarkCryptSC2000Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "SC2000 (DarkCrypt)";
      this.description = "SC2000 variant from the DarkCrypt Total Commander plugin: always runs 6.5 rounds (56 round-key words) regardless of key size, whereas the published CRYPTREC/NESSIE spec calls for 7.5 rounds with 256-bit keys. 128-bit block, 256-bit key only.";
      this.inventor = "Takeshi Shimoyama, Hirotaka Yanami, et al. (Fujitsu Labs, base algorithm); DarkCrypt variant by Alexander Myasnikov";
      this.year = 2000;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];  // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("The Block Cipher SC2000 (FSE 2001, base algorithm)", "https://link.springer.com/chapter/10.1007/3-540-45473-X_26")
      ];

      this.references = [
        new LinkItem("Security Analysis of the Block Cipher SC2000 (CRYPTREC)", "https://www.cryptrec.go.jp/exreport/cryptrec-ex-2202-2012p3.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard variant / round-count deviation", "Always runs 6.5 rounds with a 256-bit key (spec calls for 7.5); unanalyzed at this round count and not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Sc2000 — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("a3bae4fac0c472bba5a4b96032abb2c4")
        },
        {
          text: "DarkCrypt Sc2000 — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("8d53448d8ec85ce6eae7e9092035b267")
        },
        {
          text: "DarkCrypt Sc2000 — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("f9bccd4158dfae69184d14098d7bb939")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptSC2000Instance(this, isInverse);
    }
  }

  class DarkCryptSC2000Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._roundKeys = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._roundKeys = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 32)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. SC2000 (DarkCrypt) requires exactly 32 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._roundKeys = this._expandKey(this._key);
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

    // ----- Sfunc: split a word into 6/5/5/5/5/6-bit fields (MSB to LSB),
    // run the outer fields through the 6x6 S-box and the inner fields
    // through the 5x5 S-box, and recombine at the same bit positions -----
    _sFunc(x) {
      const top6  = OpCodes.And32(OpCodes.Shr32(x, 26), 0x3F);
      const f1    = OpCodes.And32(OpCodes.Shr32(x, 21), 0x1F);
      const f2    = OpCodes.And32(OpCodes.Shr32(x, 16), 0x1F);
      const f3    = OpCodes.And32(OpCodes.Shr32(x, 11), 0x1F);
      const f4    = OpCodes.And32(OpCodes.Shr32(x, 6), 0x1F);
      const low6  = OpCodes.And32(x, 0x3F);

      let result = OpCodes.Shl32(S6[top6], 26);
      result = OpCodes.Or32(result, OpCodes.Shl32(S5[f1], 21));
      result = OpCodes.Or32(result, OpCodes.Shl32(S5[f2], 16));
      result = OpCodes.Or32(result, OpCodes.Shl32(S5[f3], 11));
      result = OpCodes.Or32(result, OpCodes.Shl32(S5[f4], 6));
      result = OpCodes.Or32(result, S6[low6]);
      return result;
    }

    // ----- Mfunc: 32x32 bit GF(2) matrix multiply. Bit b of the input
    // selects MATRIX[31-b], which is XORed into the accumulator -----
    _mFunc(x) {
      let acc = 0;
      for (let b = 0; b < 32; b++) {
        if (OpCodes.And32(OpCodes.Shr32(x, b), 1))
          acc = OpCodes.Xor32(acc, MATRIX[31 - b]);
      }
      return acc;
    }

    // ----- Bfunc: bit-sliced 4x4 S-box applied to a 4x32 matrix formed
    // from the state words (one row per word, one column per bit lane) -----
    _bFunc(state, table) {
      let o0 = 0, o1 = 0, o2 = 0, o3 = 0;
      for (let bit = 0; bit < 32; bit++) {
        const a = OpCodes.And32(OpCodes.Shr32(state[0], bit), 1);
        const b = OpCodes.And32(OpCodes.Shr32(state[1], bit), 1);
        const c = OpCodes.And32(OpCodes.Shr32(state[2], bit), 1);
        const d = OpCodes.And32(OpCodes.Shr32(state[3], bit), 1);
        const val = table[OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(a, 3), OpCodes.Shl32(b, 2)), OpCodes.Shl32(c, 1)), d)];
        if (OpCodes.And32(OpCodes.Shr32(val, 3), 1)) o0 = OpCodes.Or32(o0, OpCodes.Shl32(1, bit));
        if (OpCodes.And32(OpCodes.Shr32(val, 2), 1)) o1 = OpCodes.Or32(o1, OpCodes.Shl32(1, bit));
        if (OpCodes.And32(OpCodes.Shr32(val, 1), 1)) o2 = OpCodes.Or32(o2, OpCodes.Shl32(1, bit));
        if (OpCodes.And32(val, 1))                   o3 = OpCodes.Or32(o3, OpCodes.Shl32(1, bit));
      }
      return [o0, o1, o2, o3];
    }

    // ----- Ifunc: XOR four subkey words into the state -----
    _iFunc(state, rk0, rk1, rk2, rk3) {
      return [
        OpCodes.Xor32(state[0], rk0),
        OpCodes.Xor32(state[1], rk1),
        OpCodes.Xor32(state[2], rk2),
        OpCodes.Xor32(state[3], rk3)
      ];
    }

    // ----- F: combine Mfunc(Sfunc(u)) and Mfunc(Sfunc(v)) under a bit mask -----
    _fFunc(u, v, mask) {
      const t0 = this._mFunc(this._sFunc(u));
      const t1 = this._mFunc(this._sFunc(v));
      const m0 = OpCodes.Xor32(OpCodes.And32(mask, t0), t1);
      const m1 = OpCodes.Xor32(OpCodes.And32(OpCodes.Not32(mask), t1), t0);
      return [m0, m1];
    }

    // ----- Rfunc: two one-round Feistel passes over the four state words -----
    _rFuncPair(state, mask) {
      const [X0, X1, X2, X3] = state;
      const [m0a, m1a] = this._fFunc(X2, X3, mask);
      const X0p = OpCodes.Xor32(X0, m0a);
      const X1p = OpCodes.Xor32(X1, m1a);
      const [m0b, m1b] = this._fFunc(X0p, X1p, mask);
      const X0f = OpCodes.Xor32(X2, m0b);
      const X1f = OpCodes.Xor32(X3, m1b);
      return [X0f, X1f, X0p, X1p];
    }

    _rFuncPairInverse(state, mask) {
      const [X0f, X1f, X2f, X3f] = state;
      const X0p = X2f, X1p = X3f;
      const [m0b, m1b] = this._fFunc(X0p, X1p, mask);
      const X2 = OpCodes.Xor32(X0f, m0b);
      const X3 = OpCodes.Xor32(X1f, m1b);
      const [m0a, m1a] = this._fFunc(X2, X3, mask);
      const X0 = OpCodes.Xor32(X0p, m0a);
      const X1 = OpCodes.Xor32(X1p, m1a);
      return [X0, X1, X2, X3];
    }

    // ----- Key schedule -----
    // Step 1: 8 master-key words (little-endian).
    // Step 2: 4 branches of 2 words each produce 3 intermediate words apiece (12 total).
    // Step 3: the 12 intermediate words are combined (rotate/add/xor) into 56 round-key words.
    _expandKey(keyBytes) {
      const key = [];
      for (let i = 0; i < 8; i++)
        key.push(OpCodes.Pack32LE(keyBytes[i * 4], keyBytes[i * 4 + 1], keyBytes[i * 4 + 2], keyBytes[i * 4 + 3]));

      const pairs = [[key[0], key[1]], [key[2], key[3]], [key[4], key[5]], [key[6], key[7]]];
      const V = new Array(12);
      for (let branch = 0; branch < 4; branch++) {
        const X = pairs[branch][0], Y = pairs[branch][1];
        const U0 = this._mFunc(this._sFunc(X));
        const U1 = this._mFunc(this._sFunc(Y));
        for (let k = 0; k < 3; k++) {
          const mult = k + 1;
          const kConst = this._mFunc(this._sFunc(4 * k + branch));
          const sum = OpCodes.Add32(U0, kConst);
          const multU1 = OpCodes.ToUint32(mult * U1);
          const xorVal = OpCodes.Xor32(sum, multU1);
          V[branch * 3 + k] = this._mFunc(this._sFunc(xorVal));
        }
      }

      const RK = new Array(RK_WORDS);
      for (let n = 0; n < RK_WORDS; n++) {
        const idx1 = (Math.floor(n / 36) + n) % 12;
        const idx2 = n % 9;
        const [b1, b2, b3, b4] = TBL_A[idx1];
        const [k1, k2, k3, k4] = TBL_B[idx2];
        const W1 = V[b1 * 3 + k1], W2 = V[b2 * 3 + k2], W3 = V[b3 * 3 + k3], W4 = V[b4 * 3 + k4];
        const part1 = OpCodes.Add32(OpCodes.RotL32(W1, 1), W2);
        const sub = OpCodes.Sub32(OpCodes.RotL32(W3, 1), W4);
        const part2 = OpCodes.RotL32(sub, 1);
        RK[n] = OpCodes.Xor32(part1, part2);
      }
      return RK;
    }

    _encryptBlock(block) {
      const RK = this._roundKeys;
      let state = [
        OpCodes.Pack32LE(block[0], block[1], block[2], block[3]),
        OpCodes.Pack32LE(block[4], block[5], block[6], block[7]),
        OpCodes.Pack32LE(block[8], block[9], block[10], block[11]),
        OpCodes.Pack32LE(block[12], block[13], block[14], block[15])
      ];

      for (let r = 0; r < ROUNDS; r++) {
        state = this._iFunc(state, RK[8 * r], RK[8 * r + 1], RK[8 * r + 2], RK[8 * r + 3]);
        state = this._bFunc(state, BSBOX);
        state = this._iFunc(state, RK[8 * r + 4], RK[8 * r + 5], RK[8 * r + 6], RK[8 * r + 7]);
        const mask = OpCodes.And32(r, 1) === 0 ? 0x55555555 : 0x33333333;
        state = this._rFuncPair(state, mask);
      }
      state = this._iFunc(state, RK[48], RK[49], RK[50], RK[51]);
      state = this._bFunc(state, BSBOX);
      state = this._iFunc(state, RK[52], RK[53], RK[54], RK[55]);

      return [
        ...OpCodes.Unpack32LE(state[0]), ...OpCodes.Unpack32LE(state[1]),
        ...OpCodes.Unpack32LE(state[2]), ...OpCodes.Unpack32LE(state[3])
      ];
    }

    _decryptBlock(block) {
      const RK = this._roundKeys;
      let state = [
        OpCodes.Pack32LE(block[0], block[1], block[2], block[3]),
        OpCodes.Pack32LE(block[4], block[5], block[6], block[7]),
        OpCodes.Pack32LE(block[8], block[9], block[10], block[11]),
        OpCodes.Pack32LE(block[12], block[13], block[14], block[15])
      ];

      state = this._iFunc(state, RK[52], RK[53], RK[54], RK[55]);
      state = this._bFunc(state, BSBOX_INV);
      state = this._iFunc(state, RK[48], RK[49], RK[50], RK[51]);

      for (let r = ROUNDS - 1; r >= 0; r--) {
        const mask = OpCodes.And32(r, 1) === 0 ? 0x55555555 : 0x33333333;
        state = this._rFuncPairInverse(state, mask);
        state = this._iFunc(state, RK[8 * r + 4], RK[8 * r + 5], RK[8 * r + 6], RK[8 * r + 7]);
        state = this._bFunc(state, BSBOX_INV);
        state = this._iFunc(state, RK[8 * r], RK[8 * r + 1], RK[8 * r + 2], RK[8 * r + 3]);
      }

      return [
        ...OpCodes.Unpack32LE(state[0]), ...OpCodes.Unpack32LE(state[1]),
        ...OpCodes.Unpack32LE(state[2]), ...OpCodes.Unpack32LE(state[3])
      ];
    }
  }

  const algorithmInstance = new DarkCryptSC2000Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptSC2000Algorithm, DarkCryptSC2000Instance };
}));
