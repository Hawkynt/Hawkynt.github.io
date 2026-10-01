/*
 * Pike Stream Cipher Implementation
 * Educational implementation inspired by Pike cipher by Ross Anderson
 * Based on three lagged Fibonacci generators with clock control
 * (c)2006-2025 Hawkynt
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, CountryCode,
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, Vulnerability } = AlgorithmFramework;

  /** @type {int32} */
  const KEY_SIZE = 32;      // 256-bit default key
  /** @type {int32} */
  const IV_SIZE = 16;       // 128-bit IV

  // LFG parameters (simplified Pike-inspired)
  /** @type {int32} */
  const LAG_A = 55;         // a_i = a_{i-55} + a_{i-24} (mod 2^32)
  /** @type {int32} */
  const TAP_A = 24;
  /** @type {int32} */
  const LAG_B = 57;         // b_i = b_{i-57} + b_{i-7} (mod 2^32)
  /** @type {int32} */
  const TAP_B = 7;
  /** @type {int32} */
  const LAG_C = 58;         // c_i = c_{i-58} + c_{i-19} (mod 2^32)
  /** @type {int32} */
  const TAP_C = 19;

  /** @type {uint32} */
  const GOLDEN_RATIO = 0x9E3779B9;

  /**
   * Fill a register with little-endian words read cyclically from the key.
   * An empty key reads as zero bytes.
   * @param {uint8[]} key - Key bytes
   * @param {int32} length - Register length in words
   * @param {int32} offset - Byte offset of the first word in the key
   * @returns {uint32[]} Register words
   */
  function loadRegister(key, length, offset) {
    /** @type {uint32[]} */
    const reg = new Array(length);
    for (let i = 0; i < length; i++) {
      /** @type {uint8[]} */
      const b = [0, 0, 0, 0];
      if (key.length > 0) {
        for (let k = 0; k < 4; k++) b[k] = key[(i * 4 + offset + k) % key.length];
      }
      reg[i] = OpCodes.Pack32LE(b[0], b[1], b[2], b[3]);
    }
    return reg;
  }

  /**
   * Educational Pike-inspired stream function: encrypts or decrypts `data`.
   * @param {uint8[]} key - Key bytes (any length)
   * @param {uint8[]} iv - IV bytes; mixed in only when at least 16 long
   * @param {uint8[]} data - Input bytes
   * @returns {uint8[]} Output bytes
   */
  function educationalPike(key, iv, data) {
    // Initialize three LFGs with key material at different offsets
    /** @type {uint32[]} */
    const lfgA = loadRegister(key, LAG_A, 0);
    /** @type {uint32[]} */
    const lfgB = loadRegister(key, LAG_B, 8);
    /** @type {uint32[]} */
    const lfgC = loadRegister(key, LAG_C, 16);

    // Mix in IV
    if (iv.length >= IV_SIZE) {
      for (let i = 0; i < 4; i++) {
        const ivWord = OpCodes.Pack32LE(iv[i * 4], iv[i * 4 + 1], iv[i * 4 + 2], iv[i * 4 + 3]);
        lfgA[i] = OpCodes.Xor32(lfgA[i], ivWord);
        lfgB[i] = OpCodes.Xor32(lfgB[i], ivWord);
        lfgC[i] = OpCodes.Xor32(lfgC[i], ivWord);
      }
    }

    // LFG positions
    /** @type {int32} */
    let posA = 0;
    /** @type {int32} */
    let posB = 0;
    /** @type {int32} */
    let posC = 0;

    /** @type {uint8[]} */
    const output = [];
    for (let i = 0; i < data.length; i++) {
      // Simple state mixing for educational purposes
      const mixA = OpCodes.Add32(lfgA[posA], lfgA[(posA + TAP_A) % LAG_A]);
      const mixB = OpCodes.Add32(lfgB[posB], lfgB[(posB + TAP_B) % LAG_B]);
      const mixC = OpCodes.Add32(lfgC[posC], lfgC[(posC + TAP_C) % LAG_C]);

      // Update LFG states
      lfgA[posA] = mixA;
      lfgB[posB] = mixB;
      lfgC[posC] = mixC;

      // Generate keystream by combining all three
      const keystreamWord = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(mixA, mixB), mixC), OpCodes.Mul32(i, GOLDEN_RATIO));
      const keystreamByte = OpCodes.ToUint8(OpCodes.Add32(keystreamWord, i));

      output.push(OpCodes.Xor8(data[i], keystreamByte));

      // Advance positions
      posA = (posA + 1) % LAG_A;
      posB = (posB + 1) % LAG_B;
      posC = (posC + 1) % LAG_C;
    }

    return output;
  }

  /**
   * Pike-inspired educational stream cipher
   * @class
   * @extends {StreamCipherAlgorithm}
   */
  class PikeAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "PIKE";
      this.description = "Educational implementation inspired by Pike stream cipher. Designed by Ross Anderson using three lagged Fibonacci generators with clock control mechanism.";
      this.inventor = "Ross Anderson";
      this.year = 1994;
      this.country = CountryCode.GB;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      /** @type {string} */
      this.securityNotes = "Educational implementation only. Pike was designed to replace FISH but has potential vulnerabilities. Use only for educational purposes.";

      this.documentation = [
        new LinkItem("Pike Cipher Wikipedia", "https://en.wikipedia.org/wiki/Pike_(cipher)"),
        new LinkItem("Lagged Fibonacci Generators", "https://en.wikipedia.org/wiki/Lagged_Fibonacci_generator"),
        new LinkItem("Ross Anderson's Work", "https://www.cl.cam.ac.uk/~rja14/")
      ];

      this.references = [
        new LinkItem("FISH Cryptanalysis", "https://www.cl.cam.ac.uk/~rja14/Papers/fibonacci.pdf"),
        new LinkItem("Pike Design Notes", "https://en.wikipedia.org/wiki/Pike_(cipher)"),
        new LinkItem("Anderson's Publications", "https://www.cl.cam.ac.uk/~rja14/papers.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Educational Implementation", "This is a simplified educational implementation", "Use only for learning about lagged Fibonacci generators")
      ];

      this.tests = [
        {
          text: "Pike Educational Test Vector 1 (Empty)",
          uri: "Educational test case",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          iv: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("")
        },
        {
          text: "Pike Educational Test Vector 2 (Single Byte)",
          uri: "Educational test case",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          iv: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("20")
        },
        {
          text: "Pike Educational Test Vector 3 (Two Bytes)",
          uri: "Educational test case",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          iv: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("20BF")
        },
        {
          text: "Pike Educational Test Vector 4 (Block)",
          uri: "Educational test case",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          iv: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("20BF4E19EC9F6A19F89B3EFDB47732D1")
        }
      ];
    }

    /**
     * Create a cipher instance (encryption and decryption are identical)
     * @param {boolean} [isInverse=false] - Unused: keystream XOR is its own inverse
     * @returns {PikeInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new PikeInstance(this, isInverse);
    }
  }

  /**
   * Pike-inspired cipher instance
   * @class
   * @extends {IAlgorithmInstance}
   */
  class PikeInstance extends IAlgorithmInstance {
    /**
     * @param {PikeAlgorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - Unused
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]|null} */
      this._iv = null;
    }

    /**
     * @param {uint8[]|null} keyData - Key bytes (any length; none means 32 zero bytes)
     */
    set key(keyData) { this._key = keyData; }

    /**
     * @returns {uint8[]|null} Copy of the key
     */
    get key() { return this._key ? [...this._key] : null; }

    /**
     * @param {uint8[]|null} ivData - IV bytes (none means 16 zero bytes)
     */
    set iv(ivData) { this._iv = ivData; }

    /**
     * @returns {uint8[]|null} Copy of the IV
     */
    get iv() { return this._iv ? [...this._iv] : null; }

    /**
     * Append message bytes
     * @param {uint8[]} data - Bytes to append
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      for (let i = 0; i < data.length; i++) this.inputBuffer.push(data[i]);
    }

    /**
     * Encipher everything fed so far with a freshly keyed generator.
     * @returns {uint8[]} Output bytes
     */
    Result() {
      /** @type {uint8[]} */
      const key = this._key ? this._key : OpCodes.CreateArray(KEY_SIZE, 0);
      /** @type {uint8[]} */
      const iv = this._iv ? this._iv : OpCodes.CreateArray(IV_SIZE, 0);
      return educationalPike(key, iv, this.inputBuffer);
    }
  }

  const algorithmInstance = new PikeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { PikeAlgorithm, PikeInstance };
}));
