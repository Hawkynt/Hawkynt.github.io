/*
 * SHA1-512 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The SHA-1 compression function used as a raw block cipher (SHACAL-style), as implemented
 * in the DarkCrypt Total Commander plugin (Alexander Myasnikov, "Zarya" project).
 *
 * This build runs the unmodified, standard SHA-1 compression function (standard message
 * schedule expansion W[t] = ROTL1(W[t-3] ^ W[t-8] ^ W[t-14] ^ W[t-16]) for t=16..79,
 * standard Ch/Parity/Maj round functions, standard round constants 0x5A827999,
 * 0x6ED9EBA1, 0x8F1BBCDC, 0xCA62C1D6) but WITHOUT the Merkle-Damgard feedback addition
 * and WITHOUT a fixed IV: the 160-bit plaintext block is loaded directly into the working
 * registers (A,B,C,D,E) and the 512-bit key is used directly as the one-block message
 * schedule (16 x 32-bit words). All words are read/written little-endian (unlike the
 * FIPS 180 reference, which is big-endian). Since every internal SHA-1 step is invertible
 * given the message words, this makes the compression function a genuine keyed permutation
 * of the 160-bit state (this is the classic "SHACAL" idea, applied here to SHA-1 rather
 * than SHA-256).
 * 160-bit blocks, 512-bit keys. Educational only.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([
        '../../AlgorithmFramework', '../../OpCodes'], factory);
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

  /**
   * SHA-1 step function (Ch, Parity, Maj, Parity by step range)
   * @param {int32} t - Step 0..79
   * @param {uint32} b - Word B
   * @param {uint32} c - Word C
   * @param {uint32} d - Word D
   * @returns {uint32} f(b, c, d)
   */
  function stepF(t, b, c, d) {
    if (t < 20) return OpCodes.Or32(OpCodes.And32(b, c), OpCodes.And32(~b, d));
    if (t < 40) return OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(b, c), d));
    if (t < 60) return OpCodes.Or32(OpCodes.Or32(OpCodes.And32(b, c), OpCodes.And32(b, d)), OpCodes.And32(c, d));
    return OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(b, c), d));
  }

  /**
   * SHA-1 step constant
   * @param {int32} t - Step 0..79
   * @returns {uint32} K for the step range
   */
  function stepK(t) {
    if (t < 20) return 0x5A827999;
    if (t < 40) return 0x6ED9EBA1;
    if (t < 60) return 0x8F1BBCDC;
    return 0xCA62C1D6;
  }

  /**
   * @param {uint32[]} M - 16 key words
   * @returns {uint32[]} 80-word message schedule
   */
  function expandSchedule(M) {
    /** @type {uint32[]} */
    const W = M.slice();
    for (let t = 16; t < 80; t++)
      W.push(OpCodes.RotL32(OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(W[t - 3], W[t - 8]), W[t - 14]), W[t - 16])), 1));
    return W;
  }

  /**
   * @param {uint32[]} state - Five state words
   * @param {uint32[]} M - 16 key words
   * @returns {uint32[]} Five output words
   */
  function sha1Encrypt(state, M) {
    const W = expandSchedule(M);
    let A = state[0], B = state[1], C = state[2], D = state[3], E = state[4];
    for (let t = 0; t < 80; t++) {
      const f = stepF(t, B, C, D);
      const k = stepK(t);
      const temp = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(OpCodes.RotL32(A, 5), f), E), k), W[t]);
      E = D; D = C; C = OpCodes.RotL32(B, 30); B = A; A = temp;
    }
    /** @type {uint32[]} */
    const out = [A, B, C, D, E];
    return out;
  }

  // Inverse: replay the 80 steps back to front. At step t the forward transform was
  // (A,B,C,D,E) -> (temp, A, rotl(B,30), C, D); given the post-state, B_old = C_new,
  // C_old = rotr(B_new,30), D_old = D... wait D_old = C_new is wrong; derive carefully below.
  /**
   * @param {uint32[]} state - Five state words
   * @param {uint32[]} M - 16 key words
   * @returns {uint32[]} Five output words
   */
  function sha1Decrypt(state, M) {
    const W = expandSchedule(M);
    let A = state[0], B = state[1], C = state[2], D = state[3], E = state[4];
    for (let t = 79; t >= 0; t--) {
      // forward: newE=D_old, newD=C_old, newC=rotl(B_old,30), newB=A_old, newA=temp
      const dOld = E;                      // newE = D_old
      const cOld = D;                      // newD = C_old
      const bOld = OpCodes.RotR32(C, 30);  // newC = rotl(B_old,30)
      const aOld = B;                      // newB = A_old
      const f = stepF(t, bOld, cOld, dOld);
      const k = stepK(t);
      const temp = A;                      // newA = temp
      const eOld = OpCodes.Sub32(OpCodes.Sub32(OpCodes.Sub32(OpCodes.Sub32(temp, OpCodes.RotL32(aOld, 5)), f), k), W[t]);
      A = aOld; B = bOld; C = cOld; D = dOld; E = eOld;
    }
    /** @type {uint32[]} */
    const out = [A, B, C, D, E];
    return out;
  }

  class DarkCryptSHA1Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();
      this.name = "SHA1-512 (DarkCrypt)";
      this.description = "SHA-1 compression function used as a raw keyed block cipher (SHACAL-style), as implemented in the DarkCrypt Total Commander plugin. 160-bit block, 512-bit key.";
      this.inventor = "Alexander Myasnikov (DarkCrypt plugin)";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;
      this.SupportedKeySizes = [new KeySize(64, 64, 0)];
      this.SupportedBlockSizes = [new KeySize(20, 20, 0)];
      this.documentation = [new LinkItem("DarkCrypt plugin", "https://totalcmd.net/plugring/darkcrypttc.html")];
      this.tests = [
        {
          text: "DarkCrypt SHA1-512 - all-zero key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("ed47159ec291ec57c88bfa30545a78c7e3a5efa7")
        },
        {
          text: "DarkCrypt SHA1-512 - incrementing key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f10111213"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("19b4b40fc6da2c67682e1726758b65d8e52228d1")
        },
        {
          text: "DarkCrypt SHA1-512 - shifted incrementing key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f20212223"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40"),
          expected: OpCodes.Hex8ToBytes("9c043cc531aba3373fd2eaea45bed8b1b47625af")
        }
      ];
    }

    /**
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     * @returns {DarkCryptSHA1Instance} New instance
     */
    CreateInstance(isInverse = false) { return new DarkCryptSHA1Instance(this, isInverse); }
  }

  class DarkCryptSHA1Instance extends IBlockCipherInstance {
    /**
     * @param {DarkCryptSHA1Algorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint32[]|null} */
      this._messageWords = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = 20;
      this.KeySize = 0;
    }

    /**
     * @param {uint8[]|null} keyBytes - Key bytes, or null to clear
     */
    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._messageWords = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 64)
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. SHA1-512 (DarkCrypt) requires exactly 64 bytes");
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      /** @type {uint32[]} */
      const words = [];
      for (let i = 0; i < 16; i++)
        words.push(OpCodes.Pack32LE(keyBytes[i * 4], keyBytes[i * 4 + 1], keyBytes[i * 4 + 2], keyBytes[i * 4 + 3]));
      this._messageWords = words;
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

    /**
       * @param {uint8[]} block - Input block
     * @returns {uint32[]} Five little-endian words
     */
    _blockToWords(block) {
      /** @type {uint32[]} */
      const w = [];
      for (let i = 0; i < 5; i++)
        w.push(OpCodes.Pack32LE(block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]));
      return w;
    }

    /**
     * @param {uint32[]} w - Words
     * @returns {uint8[]} Little-endian bytes
     */
    _wordsToBlock(w) {
      /** @type {uint8[]} */
      const out = [];
      for (let i = 0; i < w.length; i++) out.push(...OpCodes.Unpack32LE(w[i]));
      return out;
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _encryptBlock(block) {
      const out = sha1Encrypt(this._blockToWords(block), this._messageWords);
      return this._wordsToBlock(out);
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _decryptBlock(block) {
      const out = sha1Decrypt(this._blockToWords(block), this._messageWords);
      return this._wordsToBlock(out);
    }
  }

  const algorithmInstance = new DarkCryptSHA1Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptSHA1Algorithm, DarkCryptSHA1Instance };
}));
