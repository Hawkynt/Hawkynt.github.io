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
  /** @type {uint8[]} */
  const S6 = [
    47,59,25,42,15,23,28,39,26,38,36,19,60,24,29,56,
    37,63,20,61,55, 2,30,44, 9,10, 6,22,53,48,51,11,
    62,52,35,18,14,46, 0,54,17,40,27, 4,31, 8, 5,12,
     3,16,41,34,33, 7,45,49,50,58, 1,21,43,57,32,13
  ];

  // 5x5 S-box (32 entries), used for the four inner 5-bit fields of Sfunc
  /** @type {uint8[]} */
  const S5 = [
    20,26, 7,31,19,12,10,15,22,30,13,14, 4,24, 9,18,
    27,11, 1,21, 6,16, 2,28,23, 5, 8, 3, 0,17,29,25
  ];

  // 4x4 S-box (16 entries) for Bfunc, forward direction
  /** @type {uint8[]} */
  const BSBOX = [2,5,10,12,7,15,1,11,13,6,0,9,4,8,3,14];
  // 4x4 S-box (16 entries) for Bfunc, inverse direction (exact functional inverse of BSBOX)
  /** @type {uint8[]} */
  const BSBOX_INV = [10,6,0,14,12,1,9,4,13,11,2,7,3,8,15,5];

  // 32x32 bit diffusion matrix used by Mfunc. MATRIX[j] is XORed into the
  // accumulator whenever bit (31-j) of the input word is set.
  /** @type {uint32[]} */
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
  /** @type {uint8[][]} */
  const TBL_A = [
    [0,1,2,3],[1,0,3,2],[2,3,0,1],[3,2,1,0],
    [0,2,3,1],[1,3,2,0],[2,0,1,3],[3,1,0,2],
    [0,3,1,2],[1,2,0,3],[2,1,3,0],[3,0,2,1]
  ];
  /** @type {uint8[][]} */
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

    /**
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     * @returns {DarkCryptSC2000Instance} New instance
     */
    CreateInstance(isInverse = false) {
      return new DarkCryptSC2000Instance(this, isInverse);
    }
  }

  class DarkCryptSC2000Instance extends IBlockCipherInstance {
    /**
     * @param {DarkCryptSC2000Algorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint32[]|null} */
      this._roundKeys = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    /**
     * @param {uint8[]|null} keyBytes - Key bytes, or null to clear
     */
    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._roundKeys = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 32)
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. SC2000 (DarkCrypt) requires exactly 32 bytes");
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._roundKeys = this._expandKey(this._key);
    }

    /**
     * @returns {uint8[]|null} Copy of the key, or null
     */
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
        throw new Error("Input length must be multiple of " + this.BlockSize + " bytes");

      /** @type {uint8[]} */
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
    /**
     * @param {uint32} x - Word
     * @returns {uint32} S-layer output
     */
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
    /**
     * @param {uint32} x - Word
     * @returns {uint32} Matrix product
     */
    _mFunc(x) {
      /** @type {uint32} */
      let acc = 0;
      for (let b = 0; b < 32; b++) {
        if (OpCodes.And32(OpCodes.Shr32(x, b), 1))
          acc = OpCodes.Xor32(acc, MATRIX[31 - b]);
      }
      return acc;
    }

    // ----- Bfunc: bit-sliced 4x4 S-box applied to a 4x32 matrix formed
    // from the state words (one row per word, one column per bit lane) -----
    /**
     * @param {uint32[]} words - Four state words
     * @param {uint8[]} table - 4x4 S-box
     * @returns {uint32[]} Four output words
     */
    _bFunc(words, table) {
      /** @type {uint32} */
      let o0 = 0;
      /** @type {uint32} */
      let o1 = 0;
      /** @type {uint32} */
      let o2 = 0;
      /** @type {uint32} */
      let o3 = 0;
      for (let bit = 0; bit < 32; bit++) {
        const a = OpCodes.And32(OpCodes.Shr32(words[0], bit), 1);
        const b = OpCodes.And32(OpCodes.Shr32(words[1], bit), 1);
        const c = OpCodes.And32(OpCodes.Shr32(words[2], bit), 1);
        const d = OpCodes.And32(OpCodes.Shr32(words[3], bit), 1);
        const val = table[OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(a, 3), OpCodes.Shl32(b, 2)), OpCodes.Shl32(c, 1)), d)];
        if (OpCodes.And32(OpCodes.Shr32(val, 3), 1)) o0 = OpCodes.Or32(o0, OpCodes.Shl32(1, bit));
        if (OpCodes.And32(OpCodes.Shr32(val, 2), 1)) o1 = OpCodes.Or32(o1, OpCodes.Shl32(1, bit));
        if (OpCodes.And32(OpCodes.Shr32(val, 1), 1)) o2 = OpCodes.Or32(o2, OpCodes.Shl32(1, bit));
        if (OpCodes.And32(val, 1))                   o3 = OpCodes.Or32(o3, OpCodes.Shl32(1, bit));
      }
      /** @type {uint32[]} */
      const out = [o0, o1, o2, o3];
      return out;
    }

    // ----- Ifunc: XOR four subkey words into the state -----
    /**
     * @param {uint32[]} words - Four state words
     * @param {uint32} rk0 - Subkey word
     * @param {uint32} rk1 - Subkey word
     * @param {uint32} rk2 - Subkey word
     * @param {uint32} rk3 - Subkey word
     * @returns {uint32[]} Four output words
     */
    _iFunc(words, rk0, rk1, rk2, rk3) {
      /** @type {uint32[]} */
      const out = [
        OpCodes.Xor32(words[0], rk0),
        OpCodes.Xor32(words[1], rk1),
        OpCodes.Xor32(words[2], rk2),
        OpCodes.Xor32(words[3], rk3)
      ];
      return out;
    }

    // ----- F: combine Mfunc(Sfunc(u)) and Mfunc(Sfunc(v)) under a bit mask -----
    /**
     * @param {uint32} u - First word
     * @param {uint32} v - Second word
     * @param {uint32} mask - Bit mask
     * @returns {uint32[]} [m0, m1]
     */
    _fFunc(u, v, mask) {
      const t0 = this._mFunc(this._sFunc(u));
      const t1 = this._mFunc(this._sFunc(v));
      const m0 = OpCodes.Xor32(OpCodes.And32(mask, t0), t1);
      const m1 = OpCodes.Xor32(OpCodes.And32(OpCodes.Not32(mask), t1), t0);
      /** @type {uint32[]} */
      const out = [m0, m1];
      return out;
    }

    // ----- Rfunc: two one-round Feistel passes over the four state words -----
    /**
     * @param {uint32[]} words - Four state words
     * @param {uint32} mask - Round mask
     * @returns {uint32[]} Four output words
     */
    _rFuncPair(words, mask) {
      const X0 = words[0];
      const X1 = words[1];
      const X2 = words[2];
      const X3 = words[3];
      const ma = this._fFunc(X2, X3, mask);
      const X0p = OpCodes.Xor32(X0, ma[0]);
      const X1p = OpCodes.Xor32(X1, ma[1]);
      const mb = this._fFunc(X0p, X1p, mask);
      const X0f = OpCodes.Xor32(X2, mb[0]);
      const X1f = OpCodes.Xor32(X3, mb[1]);
      /** @type {uint32[]} */
      const out = [X0f, X1f, X0p, X1p];
      return out;
    }

    /**
     * @param {uint32[]} words - Four state words
     * @param {uint32} mask - Round mask
     * @returns {uint32[]} Four output words
     */
    _rFuncPairInverse(words, mask) {
      const X0f = words[0];
      const X1f = words[1];
      const X0p = words[2];
      const X1p = words[3];
      const mb = this._fFunc(X0p, X1p, mask);
      const X2 = OpCodes.Xor32(X0f, mb[0]);
      const X3 = OpCodes.Xor32(X1f, mb[1]);
      const ma = this._fFunc(X2, X3, mask);
      const X0 = OpCodes.Xor32(X0p, ma[0]);
      const X1 = OpCodes.Xor32(X1p, ma[1]);
      /** @type {uint32[]} */
      const out = [X0, X1, X2, X3];
      return out;
    }

    // ----- Key schedule -----
    // Step 1: 8 master-key words (little-endian).
    // Step 2: 4 branches of 2 words each produce 3 intermediate words apiece (12 total).
    // Step 3: the 12 intermediate words are combined (rotate/add/xor) into 56 round-key words.
    /**
     * @param {uint8[]} keyBytes - Key bytes
     * @returns {uint32[]} 56 round-key words
     */
    _expandKey(keyBytes) {
      /** @type {uint32[]} */
      const master = [];
      for (let i = 0; i < 8; i++)
        master.push(OpCodes.Pack32LE(keyBytes[i * 4], keyBytes[i * 4 + 1], keyBytes[i * 4 + 2], keyBytes[i * 4 + 3]));

      /** @type {uint32[]} */
      const V = new Array(12);
      for (let branch = 0; branch < 4; branch++) {
        const X = master[2 * branch];
        const Y = master[2 * branch + 1];
        const U0 = this._mFunc(this._sFunc(X));
        const U1 = this._mFunc(this._sFunc(Y));
        for (let k = 0; k < 3; k++) {
          const mult = k + 1;
          const kConst = this._mFunc(this._sFunc(4 * k + branch));
          const sum = OpCodes.Add32(U0, kConst);
          const multU1 = OpCodes.Mul32(mult, U1); // mult is 1..3, so the product is exact
          const xorVal = OpCodes.Xor32(sum, multU1);
          V[branch * 3 + k] = this._mFunc(this._sFunc(xorVal));
        }
      }

      /** @type {uint32[]} */
      const RK = new Array(RK_WORDS);
      for (let n = 0; n < RK_WORDS; n++) {
        const idx1 = (Math.floor(n / 36) + n) % 12;
        const idx2 = n % 9;
        const sa = TBL_A[idx1];
        const sb = TBL_B[idx2];
        const W1 = V[OpCodes.Add32(OpCodes.Mul32(sa[0], 3), sb[0])];
        const W2 = V[OpCodes.Add32(OpCodes.Mul32(sa[1], 3), sb[1])];
        const W3 = V[OpCodes.Add32(OpCodes.Mul32(sa[2], 3), sb[2])];
        const W4 = V[OpCodes.Add32(OpCodes.Mul32(sa[3], 3), sb[3])];
        const part1 = OpCodes.Add32(OpCodes.RotL32(W1, 1), W2);
        const sub = OpCodes.Sub32(OpCodes.RotL32(W3, 1), W4);
        const part2 = OpCodes.RotL32(sub, 1);
        RK[n] = OpCodes.Xor32(part1, part2);
      }
      return RK;
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _encryptBlock(block) {
      const RK = this._roundKeys;
      /** @type {uint32[]} */
      let words = [
        OpCodes.Pack32LE(block[0], block[1], block[2], block[3]),
        OpCodes.Pack32LE(block[4], block[5], block[6], block[7]),
        OpCodes.Pack32LE(block[8], block[9], block[10], block[11]),
        OpCodes.Pack32LE(block[12], block[13], block[14], block[15])
      ];

      for (let r = 0; r < ROUNDS; r++) {
        words = this._iFunc(words, RK[8 * r], RK[8 * r + 1], RK[8 * r + 2], RK[8 * r + 3]);
        words = this._bFunc(words, BSBOX);
        words = this._iFunc(words, RK[8 * r + 4], RK[8 * r + 5], RK[8 * r + 6], RK[8 * r + 7]);
        const mask = OpCodes.And32(r, 1) === 0 ? 0x55555555 : 0x33333333;
        words = this._rFuncPair(words, mask);
      }
      words = this._iFunc(words, RK[48], RK[49], RK[50], RK[51]);
      words = this._bFunc(words, BSBOX);
      words = this._iFunc(words, RK[52], RK[53], RK[54], RK[55]);

      return [
        ...OpCodes.Unpack32LE(words[0]), ...OpCodes.Unpack32LE(words[1]),
        ...OpCodes.Unpack32LE(words[2]), ...OpCodes.Unpack32LE(words[3])
      ];
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _decryptBlock(block) {
      const RK = this._roundKeys;
      /** @type {uint32[]} */
      let words = [
        OpCodes.Pack32LE(block[0], block[1], block[2], block[3]),
        OpCodes.Pack32LE(block[4], block[5], block[6], block[7]),
        OpCodes.Pack32LE(block[8], block[9], block[10], block[11]),
        OpCodes.Pack32LE(block[12], block[13], block[14], block[15])
      ];

      words = this._iFunc(words, RK[52], RK[53], RK[54], RK[55]);
      words = this._bFunc(words, BSBOX_INV);
      words = this._iFunc(words, RK[48], RK[49], RK[50], RK[51]);

      for (let r = ROUNDS - 1; r >= 0; r--) {
        const mask = OpCodes.And32(r, 1) === 0 ? 0x55555555 : 0x33333333;
        words = this._rFuncPairInverse(words, mask);
        words = this._iFunc(words, RK[8 * r + 4], RK[8 * r + 5], RK[8 * r + 6], RK[8 * r + 7]);
        words = this._bFunc(words, BSBOX_INV);
        words = this._iFunc(words, RK[8 * r], RK[8 * r + 1], RK[8 * r + 2], RK[8 * r + 3]);
      }

      return [
        ...OpCodes.Unpack32LE(words[0]), ...OpCodes.Unpack32LE(words[1]),
        ...OpCodes.Unpack32LE(words[2]), ...OpCodes.Unpack32LE(words[3])
      ];
    }
  }

  const algorithmInstance = new DarkCryptSC2000Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptSC2000Algorithm, DarkCryptSC2000Instance };
}));
