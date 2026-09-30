/*
 * MMB (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * MMB (Modular Multiplication-based Block cipher, Joan Daemen 1993) as implemented in the
 * DarkCrypt Total Commander plugin (Alexander Myasnikov, "Zarya" project), following the
 * published design except for the "eta" layer: a 128-bit block treated as four 32-bit
 * words, six rounds of [key XOR, multiplication modulo 2^32-1 by fixed per-word constants,
 * a "theta" XOR diffusion layer], plus a final key-XOR-only stage. Key schedule is trivial: the four 32-bit key words are
 * used directly, cycled through the four word slots with a rotation that advances by one
 * word each round. Between multiplication and diffusion sits the "eta" correction layer,
 * which XORs the constant 0x2AAAAAAA into word 0 when word 0 is odd. Unlike the published
 * design, word 3 is never corrected, so the all-zero block stays a fixed point under the
 * all-zero key.
 * 128-bit blocks, 128-bit keys. Educational only.
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

  const ROUNDS = 6;
  const ODD_CORRECTION = 0x2AAAAAAA;
  const MOD_2_32_1 = 0xFFFFFFFFn; // 2^32 - 1

  // Per-word multiplication constants (encrypt direction).
  /** @type {uint32[]} */
  const FWD_CONST = [0x025F1CDB, 0x04BE39B6, 0x12F8E6D8, 0x2F8E6D81];
  // Multiplicative inverses of FWD_CONST modulo (2^32 - 1), used for decryption.
  /** @type {uint32[]} */
  const INV_CONST = [0x0DAD4694, 0x06D6A34A, 0x81B5A8D2, 0x281B5A8D];

  // Multiplication modulo 2^32 - 1.
  /**
   * @param {uint32} a - First factor
   * @param {uint32} b - Second factor
   * @returns {uint32} a * b mod (2^32 - 1)
   */
  function mulModMersenne(a, b) {
    return OpCodes.ToUint32(Number(OpCodes.MulModN(BigInt(OpCodes.ToUint32(a)), BigInt(OpCodes.ToUint32(b)), MOD_2_32_1)));
  }

  // "theta" XOR diffusion layer shared by encryption and decryption (it is its own inverse).
  /**
   * @param {uint32[]} w - Four words
   * @returns {uint32[]} Diffused words
   */
  function diffuse(w) {
    const e = OpCodes.Xor32(w[2], w[0]);
    const a = OpCodes.Xor32(w[1], w[3]);
    return [OpCodes.Xor32(w[0], a), OpCodes.Xor32(w[1], e), OpCodes.Xor32(w[2], a), OpCodes.Xor32(w[3], e)];
  }

  // The "eta" correction layer:
  //   eta(a0,a1,a2,a3) = (a0 XOR lsb(a0)*d, a1, a2, a3)
  // Only word 0 is corrected, when its least significant bit is set. Since
  // d = 0x2AAAAAAA is even, the correction never changes the bit it is selected
  // by, so eta is its own inverse and the same function serves both directions.
  /**
   * @param {uint32[]} s - Four words (corrected in place)
   * @returns {uint32[]} The same array
   */
  function eta(s) {
    if (OpCodes.And32(s[0], 1) !== 0) s[0] = OpCodes.Xor32(s[0], ODD_CORRECTION);
    return s;
  }

  // Forward round transform: multiply-by-constant, eta correction, then diffuse.
  /**
   * @param {uint32[]} w - Four words
   * @returns {uint32[]} Round output
   */
  function roundForward(w) {
    /** @type {uint32[]} */
    const m = [];
    for (let i = 0; i < w.length; i++) m.push(mulModMersenne(w[i], FWD_CONST[i]));
    return diffuse(eta(m));
  }

  // Inverse round transform: diffuse, eta correction, then multiply by inverse constant.
  /**
   * @param {uint32[]} w - Four words
   * @returns {uint32[]} Round input
   */
  function roundInverse(w) {
    const s = eta(diffuse(w));
    /** @type {uint32[]} */
    const m = [];
    for (let i = 0; i < s.length; i++) m.push(mulModMersenne(s[i], INV_CONST[i]));
    return m;
  }

  class DarkCryptMMBAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "MMB (DarkCrypt)";
      this.description = "MMB (Modular Multiplication-based Block cipher) as implemented in the DarkCrypt Total Commander plugin: 128-bit block/key, 6 rounds combining modular multiplication (mod 2^32-1) with an XOR diffusion layer.";
      this.inventor = "Joan Daemen (base MMB); DarkCrypt variant by Alexander Myasnikov";
      this.year = 1993;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];  // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("MMB (Daemen, 1993)", "https://en.wikipedia.org/wiki/MMB_(cipher)")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Weak-key differential attack", "Biham demonstrated a weak-key class and differential attack against MMB shortly after publication.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt MMB — incrementing key/plaintext (verified against the DarkCrypt implementation)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("13d3b3fe7bc02c0dc56dc648a5ae9d32")
        },
        {
          text: "DarkCrypt MMB — shifted incrementing key/plaintext (verified against the DarkCrypt implementation)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("eaf8b8248e6a72f072dbc17e40a95c13")
        },
        {
          text: "DarkCrypt MMB — zero key, single set bit (verified against the DarkCrypt implementation)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000001"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("1ee0920041dfb7cb05c6fbcd5ba51eec")
        },
        {
          text: "DarkCrypt MMB — random key/plaintext (verified against the DarkCrypt implementation)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("049005731fad4901eb411879d4f5a4ac"),
          key: OpCodes.Hex8ToBytes("b92c2757b9edb9024541662e8ebf42d1"),
          expected: OpCodes.Hex8ToBytes("916279fa86fa981886f9f4065efcde05")
        }
      ];
    }

    /**
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     * @returns {DarkCryptMMBInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new DarkCryptMMBInstance(this, isInverse);
    }
  }

  class DarkCryptMMBInstance extends IBlockCipherInstance {
    /**
     * @param {DarkCryptMMBAlgorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint32[]|null} */
      this._K = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    /**
     * @param {uint8[]|null} keyBytes - Key bytes, or null to clear
     */
    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._K = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 16)
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. MMB (DarkCrypt) requires exactly 16 bytes");
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._K = [
        OpCodes.Pack32LE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3]),
        OpCodes.Pack32LE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]),
        OpCodes.Pack32LE(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11]),
        OpCodes.Pack32LE(keyBytes[12], keyBytes[13], keyBytes[14], keyBytes[15])
      ];
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
     * @returns {uint32[]} Four little-endian words
     */
    _blockToWords(block) {
      return [
        OpCodes.Pack32LE(block[0], block[1], block[2], block[3]),
        OpCodes.Pack32LE(block[4], block[5], block[6], block[7]),
        OpCodes.Pack32LE(block[8], block[9], block[10], block[11]),
        OpCodes.Pack32LE(block[12], block[13], block[14], block[15])
      ];
    }

    /**
     * @param {uint32[]} w - Four words
     * @returns {uint8[]} 16 bytes
     */
    _wordsToBlock(w) {
      return [
        ...OpCodes.Unpack32LE(w[0]), ...OpCodes.Unpack32LE(w[1]),
        ...OpCodes.Unpack32LE(w[2]), ...OpCodes.Unpack32LE(w[3])
      ];
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _encryptBlock(block) {
      const K = this._K;
      let w = this._blockToWords(block);
      for (let r = 0; r < ROUNDS + 1; r++) {
        for (let j = 0; j < 4; j++) w[j] = OpCodes.Xor32(w[j], K[(r + j) % 4]);
        if (r < ROUNDS) w = roundForward(w);
      }
      return this._wordsToBlock(w);
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _decryptBlock(block) {
      const K = this._K;
      let w = this._blockToWords(block);
      /** @type {int32[]} */
      const rotations = [2, 1, 0, 3, 2, 1, 0];
      for (let r = 0; r < ROUNDS + 1; r++) {
        for (let j = 0; j < 4; j++) w[j] = OpCodes.Xor32(w[j], K[(rotations[r] + j) % 4]);
        if (r < ROUNDS) w = roundInverse(w);
      }
      return this._wordsToBlock(w);
    }
  }

  const algorithmInstance = new DarkCryptMMBAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptMMBAlgorithm, DarkCryptMMBInstance };
}));
