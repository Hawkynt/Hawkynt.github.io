/*
 * Achterbahn-128/80 Stream Cipher
 * eSTREAM Phase 3 candidate (BROKEN - DO NOT USE IN PRODUCTION)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Achterbahn-128/80 (Gammel, Goettfert, Kniffler) drives 13 binary nonlinear
 * feedback shift registers A0..A12 of lengths 21..33. Bit (length - 16) of
 * every register feeds a Boolean combining function F of 13 variables whose
 * output is the keystream bit. Achterbahn-80 uses only A1..A11 (A0 and A12
 * stay zero); Achterbahn-128 uses all 13 registers.
 *
 * Each register shifts towards bit 0 and receives its new top bit as
 * feed-in XOR its feedback polynomial. Initialisation, per the specification:
 *   1. load the first key bits K0..K(n-1) into each register in parallel,
 *   2. feed the remaining key bits into each register,
 *   3. feed all IV bits into all registers,
 *   4. feed the output of F back into all registers for 32 clocks,
 *   5. set bit 0 of every register to 1 (no register may be all zero),
 *   6. clock all registers 64 times with feed-in 0.
 * Key, IV and keystream bits are numbered least significant bit first
 * within each byte.
 *
 * SECURITY STATUS: BROKEN - distinguishing and key recovery attacks are known.
 * USE ONLY FOR: academic research, cryptanalysis studies, historical reference.
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
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          StreamCipherAlgorithm, IAlgorithmInstance,
          LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM CONSTANTS =====

  /** @type {int32[]} Register lengths of A0..A12 */
  const REGISTER_LENGTHS = [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33];

  /** @type {int32} Distance from the top of each register to the bit that feeds F */
  const OUTPUT_OFFSET = 16;

  // Feedback polynomials of A0..A12 in algebraic normal form, as published in the
  // specification: every monomial lists the state bits x_i it multiplies.
  /** @type {int32[][][]} */
  const FEEDBACK = [
    // A0 (length 21)
    [[0], [2], [3], [4], [5], [6], [8], [11], [15], [1, 11], [2, 11], [2, 12], [4, 6], [4, 7], [5, 6], [1, 2, 11], [1, 2, 12], [1, 9, 11], [9, 10, 11], [1, 2, 6, 13], [1, 2, 9, 11], [2, 9, 10, 11], [1, 2, 9, 12], [2, 9, 10, 12], [1, 2, 6, 9, 13], [2, 6, 9, 10, 13]],
    // A1 (length 22)
    [[0], [1], [5], [6], [8], [13], [15], [1, 3], [1, 7], [1, 13], [4, 12], [5, 11], [6, 12], [7, 9], [1, 11, 14], [1, 4, 11, 14], [1, 7, 11, 14], [1, 4, 10, 11, 14], [1, 7, 9, 11, 14], [1, 10, 11, 12, 14]],
    // A2 (length 23)
    [[0], [4], [5], [13], [16], [1, 6], [1, 7], [4, 6], [5, 11], [7, 9], [8, 11], [12, 14], [1, 5, 9, 15], [1, 9, 10, 15], [1, 3, 9, 11, 15], [1, 5, 9, 11, 15], [1, 8, 9, 11, 15], [1, 9, 10, 11, 15]],
    // A3 (length 24)
    [[0], [2], [3], [6], [8], [12], [18], [1, 11], [1, 15], [2, 13], [4, 13], [6, 15], [12, 13], [13, 14], [2, 5, 14], [2, 5, 6], [2, 6, 7], [2, 7, 14], [5, 6, 7], [5, 7, 14], [1, 2, 5, 15], [1, 2, 7, 15], [1, 5, 7, 15], [2, 5, 6, 15], [2, 5, 9, 14], [2, 5, 9, 16], [2, 6, 7, 15], [2, 7, 9, 14], [2, 7, 9, 16], [5, 6, 7, 15], [5, 7, 9, 14], [5, 7, 9, 16]],
    // A4 (length 25)
    [[0], [6], [11], [20], [1, 5], [3, 5], [4, 12], [5, 14], [6, 16], [7, 16], [8, 15], [8, 17], [15, 17], [2, 3, 14], [2, 5, 14], [5, 8, 15], [5, 8, 17], [5, 12, 13], [5, 12, 14], [5, 15, 17], [2, 3, 12, 13], [2, 3, 12, 14], [2, 3, 8, 15], [2, 3, 8, 17], [2, 3, 15, 17], [2, 5, 8, 15], [2, 5, 8, 17], [2, 5, 12, 13], [2, 5, 12, 14], [2, 5, 15, 17]],
    // A5 (length 26)
    [[0], [4], [5], [15], [16], [17], [21], [2, 4], [2, 18], [3, 6], [4, 13], [12, 13], [3, 4, 10], [3, 4, 15], [3, 10, 14], [3, 14, 15], [4, 10, 15], [10, 14, 15], [3, 4, 10, 13], [3, 4, 13, 15], [3, 7, 10, 11], [3, 7, 10, 14], [3, 7, 11, 15], [3, 7, 14, 15], [3, 10, 12, 13], [3, 12, 13, 15], [4, 10, 13, 15], [7, 10, 11, 15], [7, 10, 14, 15], [10, 12, 13, 15]],
    // A6 (length 27)
    [[0], [3], [4], [15], [25], [1, 3], [1, 8], [1, 12], [6, 17], [10, 13], [10, 17], [13, 14], [5, 10, 11, 18], [2, 5, 11, 16, 18], [2, 5, 11, 17, 18], [5, 10, 11, 13, 18], [5, 11, 13, 14, 18], [5, 11, 16, 17, 18]],
    // A7 (length 28)
    [[0], [1], [5], [20], [25], [1, 2], [2, 17], [4, 12], [10, 15], [10, 18], [14, 16], [16, 20], [7, 9, 18, 19], [1, 2, 7, 9, 13, 19], [7, 9, 10, 15, 19], [7, 9, 10, 18, 19]],
    // A8 (length 29)
    [[0], [2], [10], [11], [17], [18], [21], [24], [1, 4], [8, 21], [10, 21], [13, 19], [6, 15, 19], [8, 9, 18], [13, 14, 16], [13, 14, 19], [13, 15, 19], [6, 14, 15, 16], [6, 14, 15, 19], [8, 9, 18, 19], [13, 14, 15, 16], [13, 14, 15, 19], [8, 9, 14, 16, 18], [8, 9, 14, 18, 19]],
    // A9 (length 30)
    [[0], [1], [7], [10], [12], [18], [28], [2, 8], [4, 7], [4, 18], [10, 12], [10, 19], [10, 22], [14, 22], [3, 5, 7], [3, 7, 8], [5, 7, 8], [1, 3, 5, 9], [1, 3, 5, 21], [1, 3, 8, 9], [1, 3, 8, 21], [1, 5, 8, 9], [1, 5, 8, 21], [3, 4, 5, 7], [3, 4, 5, 18], [3, 4, 7, 8], [3, 4, 8, 18], [3, 5, 9, 21], [3, 8, 9, 21], [4, 5, 7, 8], [4, 5, 8, 18], [5, 8, 9, 21]],
    // A10 (length 31)
    [[0], [2], [5], [6], [15], [17], [18], [20], [25], [8, 18], [8, 20], [12, 21], [14, 19], [17, 21], [20, 22], [4, 12, 22], [4, 19, 22], [7, 20, 21], [8, 18, 22], [8, 20, 22], [12, 19, 22], [20, 21, 22], [4, 7, 12, 21], [4, 7, 19, 21], [4, 12, 21, 22], [4, 19, 21, 22], [7, 8, 18, 21], [7, 8, 20, 21], [7, 12, 19, 21], [8, 18, 21, 22], [8, 20, 21, 22], [12, 19, 21, 22]],
    // A11 (length 32)
    [[0], [3], [17], [22], [28], [2, 13], [5, 19], [7, 19], [8, 12], [8, 13], [13, 15], [2, 12, 13], [7, 8, 12], [7, 8, 14], [8, 12, 13], [2, 7, 12, 13], [2, 7, 13, 14], [4, 11, 12, 24], [7, 8, 12, 13], [7, 8, 13, 14], [4, 7, 11, 12, 24], [4, 7, 11, 14, 24]],
    // A12 (length 33)
    [[0], [2], [7], [9], [10], [15], [23], [25], [30], [8, 15], [12, 16], [13, 15], [13, 25], [1, 8, 14], [1, 8, 18], [8, 12, 16], [8, 14, 18], [8, 15, 16], [8, 15, 17], [15, 17, 24], [1, 8, 14, 17], [1, 8, 17, 18], [1, 14, 17, 24], [1, 17, 18, 24], [8, 12, 16, 17], [8, 14, 17, 18], [8, 15, 16, 17], [12, 16, 17, 24], [14, 17, 18, 24], [15, 16, 17, 24]]
  ];

  /** @type {int32[]} Registers used by Achterbahn-80 */
  const REGISTERS_80 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  /** @type {int32[]} Registers used by Achterbahn-128 */
  const REGISTERS_128 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  /**
   * Bit i of a byte string, least significant bit first within each byte
   * @param {uint8[]} bytes
   * @param {int32} i
   * @returns {uint8}
   */
  function bitAt(bytes, i) {
    return OpCodes.GetBit(bytes[Math.floor(i / 8)], i % 8);
  }

  /**
   * Boolean combining function F(x0, ..., x12) of the specification, in its
   * multiplexer-friendly factored form
   * @param {uint8[]} x - The 13 register output bits
   * @returns {uint8}
   */
  function combine(x) {
    const a1 = OpCodes.Xor32(x[1], x[2]);
    const c = OpCodes.Xor32(x[2], x[9]);
    const h3 = OpCodes.Xor32(x[3], x[7]);
    const t = OpCodes.Xor32(x[4], x[9]);
    const e = OpCodes.Xor32(OpCodes.And32(OpCodes.Xor32(x[0], x[6]), x[5]), x[6]);
    const r = OpCodes.Xor32(OpCodes.And32(OpCodes.Xor32(x[1], x[4]), c), t);
    const b = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(r, OpCodes.And32(a1, x[5])), x[2]), h3);
    const a = OpCodes.Xor32(OpCodes.And32(OpCodes.Xor32(x[10], x[11]), OpCodes.Xor32(OpCodes.Xor32(c, OpCodes.And32(a1, t)), e)), e);
    const h = OpCodes.And32(OpCodes.Xor32(x[8], x[12]),
      OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(b, a), r), x[7]), x[10]));
    /** @type {uint32[]} */
    const terms = [h3, a1, t, a, h, x[0], x[5], x[6], x[11], x[12]];
    /** @type {uint32} */
    let n = 0;
    for (let i = 0; i < terms.length; i++) n = OpCodes.Xor32(n, terms[i]);
    return OpCodes.And32(n, 1);
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * AchterbahnAlgorithm - Stream cipher implementation
 * @class
 * @extends {StreamCipherAlgorithm}
 */

  class AchterbahnAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Achterbahn-128/80";
      this.description = "NLFSR-based stream cipher from the eSTREAM project: 13 nonlinear feedback shift registers of lengths 21 to 33 feed a Boolean combining function. Achterbahn-80 takes an 80-bit key and uses 11 registers, Achterbahn-128 a 128-bit key and all 13. BROKEN - multiple cryptanalytic attacks exist. DO NOT USE in production.";
      this.inventor = "Berndt Gammel, Rainer Göttfert, Oliver Kniffler (Infineon Technologies)";
      this.year = 2006;
      this.category = CategoryType.STREAM;
      this.subCategory = "NLFSR Stream Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.DE;

      // Algorithm-specific configuration
      this.SupportedKeySizes = [
        new KeySize(10, 10, 0), // Achterbahn-80
        new KeySize(16, 16, 0)  // Achterbahn-128
      ];
      this.SupportedNonceSizes = [
        new KeySize(0, 16, 1)   // IV of whole bytes, at most as long as the key
      ];

      // Documentation links
      this.documentation = [
        new LinkItem("eSTREAM Achterbahn Specification", "https://www.ecrypt.eu.org/stream/p3ciphers/achterbahn/achterbahn_p3.pdf"),
        new LinkItem("Achterbahn Official Site", "https://www.matpack.de/achterbahn/specification.html"),
        new LinkItem("Wikipedia: Achterbahn", "https://en.wikipedia.org/wiki/Achterbahn_(cipher)")
      ];

      this.references = [
        new LinkItem("Achterbahn-128/80 C Reference Implementation (Gammel, Göttfert, Kniffler)", "https://github.com/crocs-muni/CryptoStreams/blob/master/streams/stream_ciphers/estream/achterbahn/achterbahn-128-80.cpp"),
        new LinkItem("SUPERCOP Benchmarking Suite (includes eSTREAM submission sources)", "https://bench.cr.yp.to/supercop.html")
      ];

      // Security vulnerabilities (CRITICAL)
      this.knownVulnerabilities = [
        new Vulnerability(
          "Distinguishing Attack",
          "Linear distinguishing attacks can distinguish keystream from random with practical complexity",
          "DO NOT USE - cipher is cryptographically broken"
        ),
        new Vulnerability(
          "Key Recovery Attack",
          "Practical key recovery attacks demonstrated against both 80-bit and 128-bit variants",
          "DO NOT USE - fundamental design flaws exist"
        ),
        new Vulnerability(
          "Correlation Attack",
          "NLFSR correlation attacks reduce effective security below key length",
          "DO NOT USE - not suitable for any production use"
        )
      ];

      this.tests = [
        {
          text: "Achterbahn-80 reference keystream: key 01..0a, IV 01..0a",
          uri: "https://github.com/crocs-muni/CryptoStreams/blob/master/streams/stream_ciphers/estream/achterbahn/achterbahn-128-80.cpp",
          key: OpCodes.Hex8ToBytes("0102030405060708090a"),
          iv: OpCodes.Hex8ToBytes("0102030405060708090a"),
          input: OpCodes.CreateArray(32, 0),
          expected: OpCodes.Hex8ToBytes("e59cd632f3f1af7da47e19ff46651f38103a29f2f655edc07f5d6d2dd62a96aa")
        },
        {
          text: "Achterbahn-128 reference keystream: key 01..10, IV 01..10",
          uri: "https://github.com/crocs-muni/CryptoStreams/blob/master/streams/stream_ciphers/estream/achterbahn/achterbahn-128-80.cpp",
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          iv: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          input: OpCodes.CreateArray(32, 0),
          expected: OpCodes.Hex8ToBytes("df71f042738f6d9ec21d896d0cc12baf54c8ce55a6507a1243b471c2cdf0ec42")
        },
        {
          text: "DarkCrypt Achterbahn-128 — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("03203d5a7794b1ceeb0825425f7c99b6d3f00d2a4764819ebbd8f5122f4c6986a3c0ddfa1734516e8ba8c5e2ff1c3956"),
          key: OpCodes.Hex8ToBytes("0b30557a9fc4e90e33587da2c7ec1136"),
          iv: OpCodes.Hex8ToBytes("073c71a6db10457aafe4194e83b8ed22"),
          expected: OpCodes.Hex8ToBytes("6dd3c8f5a6d34d8fb506c8d60b6b61078079cdca88da26e16427f60a9d02e0cf30524272d3b3f951a7a7076cb4ed211b")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new AchterbahnInstance(this, isInverse);
    }
  }

  /**
 * Achterbahn cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class AchterbahnInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {AchterbahnAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]} */
      this._iv = [];
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {uint8[][]|null} Register bits, bit 0 first */
      this.registers = null;
      /** @type {int32[]} Registers in use */
      this.active = REGISTERS_128;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - 10-byte (Achterbahn-80) or 16-byte (Achterbahn-128) key, or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.registers = null;
        return;
      }
      if (keyBytes.length !== 10 && keyBytes.length !== 16) {
        throw new Error("Invalid Achterbahn key size: " + keyBytes.length + " bytes. Requires 10 (Achterbahn-80) or 16 (Achterbahn-128) bytes");
      }
      if (this._iv.length > keyBytes.length) {
        throw new Error("Invalid IV size: " + this._iv.length + " bytes. The IV may not be longer than the key");
      }
      this._key = [...keyBytes];
      this._setup();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
   * Set initialization vector
   * @param {uint8[]|null} ivBytes - IV bytes (at most as many as the key has), or null for none
   * @throws {Error} If IV size is invalid
   */

    set iv(ivBytes) {
      /** @type {uint8[]} */
      const iv = ivBytes ? [...ivBytes] : OpCodes.CreateArray(0, 0);
      if (iv.length > (this._key ? this._key.length : 16)) {
        throw new Error("Invalid IV size: " + iv.length + " bytes. The IV may not be longer than the key");
      }
      this._iv = iv;
      if (this._key) this._setup();
    }

    /**
   * Get copy of current IV
   * @returns {uint8[]} Copy of IV bytes
   */

    get iv() {
      return [...this._iv];
    }

    /**
     * @param {uint8[]|null} nonceBytes
     */
    set nonce(nonceBytes) { this.iv = nonceBytes; }

    /**
     * @returns {uint8[]}
     */
    get nonce() { return this.iv; }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) {
        throw new Error("Key not set");
      }
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set or no data fed
   */

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data to process");
      }

      /** @type {uint8[]} */
      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++) {
        /** @type {uint32} */
        let keystreamByte = 0;
        for (let bit = 0; bit < 8; bit++) {
          keystreamByte = OpCodes.Or32(keystreamByte, OpCodes.Shl32(this._output(), bit));
          this._clockAll(0);
        }
        output.push(OpCodes.Xor8(this.inputBuffer[i], keystreamByte));
      }

      this.inputBuffer = [];
      return output;
    }

    // Key and IV setup (steps 1 to 6 of the specification)
    _setup() {
      /** @type {uint8[]} */
      const key = this._key;
      /** @type {int32} */
      const keyBits = key.length * 8;
      this.active = key.length > 10 ? REGISTERS_128 : REGISTERS_80;
      this.registers = REGISTER_LENGTHS.map(n => OpCodes.CreateArray(n, 0));

      // Steps 1 and 2: the first key bits fill each register, the rest are fed in
      for (let k = 0; k < this.active.length; k++) {
        /** @type {int32} */
        const r = this.active[k];
        /** @type {int32} */
        const n = REGISTER_LENGTHS[r];
        for (let j = 0; j < n; j++) this.registers[r][j] = bitAt(key, j);
        for (let j = n; j < keyBits; j++) this._clock(r, bitAt(key, j));
      }

      // Step 3: feed in every IV bit
      for (let j = 0; j < this._iv.length * 8; j++) this._clockAll(bitAt(this._iv, j));

      // Step 4: feed the keystream back for 32 clocks
      for (let j = 0; j < 32; j++) this._clockAll(this._output());

      // Step 5: no register may be all zero
      for (let k = 0; k < this.active.length; k++) this.registers[this.active[k]][0] = 1;

      // Step 6: warm-up
      for (let j = 0; j < 64; j++) this._clockAll(0);
    }

    /**
     * Clock one register: its new top bit is the feed-in XOR the feedback polynomial
     * @param {int32} r - Register index
     * @param {uint8} feedIn - Bit shifted in together with the feedback
     */
    _clock(r, feedIn) {
      /** @type {uint8[]} */
      const x = this.registers[r];
      /** @type {int32[][]} */
      const poly = FEEDBACK[r];
      /** @type {uint32} */
      let f = feedIn;
      for (let m = 0; m < poly.length; m++) {
        /** @type {int32[]} */
        const monomial = poly[m];
        /** @type {uint32} */
        let product = 1;
        for (let v = 0; v < monomial.length; v++) product = OpCodes.And32(product, x[monomial[v]]);
        f = OpCodes.Xor32(f, product);
      }
      x.shift();
      x.push(f);
    }

    /**
     * Clock every register in use with the same feed-in bit
     * @param {uint8} feedIn
     */
    _clockAll(feedIn) {
      for (let k = 0; k < this.active.length; k++) this._clock(this.active[k], feedIn);
    }

    /**
     * Current keystream bit: F over bit (length - 16) of every register
     * @returns {uint8}
     */
    _output() {
      /** @type {uint8[]} */
      const x = OpCodes.CreateArray(REGISTER_LENGTHS.length, 0);
      for (let r = 0; r < REGISTER_LENGTHS.length; r++) x[r] = this.registers[r][REGISTER_LENGTHS[r] - OUTPUT_OFFSET];
      return combine(x);
    }
  }

  // Register the algorithm
  const algorithmInstance = new AchterbahnAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // Return for module systems
  return { AchterbahnAlgorithm, AchterbahnInstance };
}));
