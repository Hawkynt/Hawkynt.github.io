/*
 * Edon80 (DarkCrypt) Stream Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Edon80 is an eSTREAM hardware-profile (Profile 2) synchronous stream
 * cipher by Danilo Gligoroski, Smile Markovski, Ljupco Kocarev and Marjan
 * Gusev. It is built entirely from "e-transformers": simple pipeline
 * stages that apply one of four fixed 4x4 quasigroups (functions on the
 * two-bit alphabet {0,1,2,3}) to a stream of two-bit digits. Eighty such
 * stages are chained into a shift-register pipeline; each stage keeps a
 * single two-bit memory cell and is permanently bound to one of the four
 * quasigroups, the binding being determined by the secret key.
 *
 * Parameters (this build): 80-bit key (10 bytes), 64-bit IV (8 bytes).
 * The key is split into forty two-bit digits (most significant bits of
 * each byte first); digit m selects the quasigroup used by pipeline
 * stage m, and the same forty choices are repeated for stages 40-79.
 *
 * Initialization loads the forty key digits, then the thirty-two IV
 * digits, then a fixed eight-digit tail (3,2,1,0,0,1,2,3), for eighty
 * digits total. These eighty digits are fed one at a time, most recently
 * loaded first, as the "leader" of a full pass through all eighty
 * pipeline stages: stage 0 combines the leader digit with its own state
 * through its bound quasigroup, and each following stage combines the
 * freshly produced digit from the previous stage with its own state.
 * After all eighty leaders have been consumed this way the pipeline
 * holds the working state, and an internal two-bit counter is set to 3.
 *
 * Keystream generation repeatedly advances the pipeline: the counter is
 * incremented (mod 4) and fed into stage 0 in place of a leader digit,
 * and stage 0's output propagates through stages 1-79 exactly as during
 * initialization for stage 0, but for stages 1-79 the roles are
 * exchanged -- each stage combines its own current state with the
 * neighbouring stage's freshly produced digit (rather than the other
 * way around, as during initialization). Two such passes yield one
 * two-bit keystream digit (only the second pass's final digit is kept);
 * four digits, most significant first, form one keystream byte.
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
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  const STAGES = 80;          // number of e-transformer pipeline stages
  const KEY_DIGITS = 40;      // two-bit digits carried by the 80-bit key
  const IV_DIGITS = 32;       // two-bit digits carried by the 64-bit IV
  const TAIL_DIGITS = [3, 2, 1, 0, 0, 1, 2, 3]; // fixed padding appended after key+IV digits

  // The four fixed 4x4 quasigroups on the alphabet {0,1,2,3} that every
  // e-transformer stage is built from. Q[q][a][b] is the quasigroup q
  // applied to operands (a, b).
  const QUASIGROUPS = [
    [[0, 2, 1, 3], [2, 1, 3, 0], [1, 3, 0, 2], [3, 0, 2, 1]],
    [[1, 3, 0, 2], [0, 1, 2, 3], [2, 0, 3, 1], [3, 2, 1, 0]],
    [[2, 1, 0, 3], [1, 2, 3, 0], [3, 0, 2, 1], [0, 3, 1, 2]],
    [[3, 2, 1, 0], [1, 0, 3, 2], [0, 3, 2, 1], [2, 1, 0, 3]]
  ];

  class Edon80Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "Edon80";
      this.description = "Edon80 quasigroup-based stream cipher, an eSTREAM hardware-profile candidate built from an 80-stage pipeline of e-transformers, each bound to one of four fixed 4x4 quasigroups. This build uses the 80-bit key / 64-bit IV parameters of the DarkCrypt Total Commander plugin.";
      this.inventor = "Danilo Gligoroski, Smile Markovski, Ljupco Kocarev, Marjan Gusev";
      this.year = 2005;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedKeySizes = [new KeySize(10, 10, 0)];   // fixed 80-bit key
      this.SupportedNonceSizes = [new KeySize(8, 8, 0)];   // fixed 64-bit IV

      this.documentation = [
        new LinkItem("The Stream Cipher Edon80 (Gligoroski, Markovski, Knapskog)", "https://link.springer.com/chapter/10.1007/978-3-540-68351-3_12"),
        new LinkItem("eSTREAM: the ECRYPT Stream Cipher Project - Edon80 specification", "https://www.ecrypt.eu.org/stream/p3ciphers/edon80/edon80_p3.pdf")
      ];

      this.references = [
        new LinkItem("DarkCrypt Total Commander plugin", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Key-recovery distinguishing attack",
          "Not recommended for new designs; Edon80 was not selected for the final eSTREAM portfolio.",
          "https://link.springer.com/chapter/10.1007/978-3-540-76900-2_35"
        )
      ];

      // Test vectors: 80-bit key (bytes 0..9), zero IV.
      this.tests = [
        {
          text: "DarkCrypt Edon-80 - 80-bit key, zero IV keystream",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("00010203040506070809"),
          iv: OpCodes.Hex8ToBytes("0000000000000000"),
          input: new Array(128).fill(0),
          expected: OpCodes.Hex8ToBytes("50ba2a55711e9be5bd8901ceab15538548891e65601888716d14b46e1550ad11f90774f6514f403d6cfd118cf6e3baf383cc171d2b4b965cb37d14d175a9bcb8ddda1b8c282e811f199e73870c96b66595e8d80389e7682cd22e0ac9b2fa7d2c07184c5d24bcb2c6c7f855db25de890a6feed9dd07fbb135a4fea0bce4239718")
        },
        {
          text: "DarkCrypt Edon-80 - 80-bit key, zero IV, incrementing plaintext (fresh setup)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("00010203040506070809"),
          iv: OpCodes.Hex8ToBytes("0000000000000000"),
          input: (() => { const a = []; for (let i = 0; i < 64; i++) a.push(i); return a; })(),
          expected: OpCodes.Hex8ToBytes("50bb2856751b9de2b5800bc5a7185d8a58980c76740d9e66750dae75094db30ed92656d5756a661a44d43ba7dace94dcb3fd252e1f7ea06b8b442eea49948287")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new Edon80Instance(this, isInverse);
    }
  }

  class Edon80Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._iv = null;

      this.stageQuasigroups = null; // one of QUASIGROUPS per pipeline stage, chosen by the key
      this.state = null;            // 80 two-bit pipeline register values
      this.counter = 0;
      this.initialized = false;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.initialized = false; return; }
      if (keyBytes.length !== 10)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Edon80 (DarkCrypt) requires exactly 10 bytes`);
      this._key = [...keyBytes];
      if (this._iv) this._initialize();
    }

    get key() { return this._key ? [...this._key] : null; }

    set iv(ivBytes) {
      if (!ivBytes) { this._iv = null; this.initialized = false; return; }
      if (ivBytes.length !== 8)
        throw new Error(`Invalid IV size: ${ivBytes.length} bytes. Edon80 (DarkCrypt) requires exactly 8 bytes`);
      this._iv = [...ivBytes];
      if (this._key) this._initialize();
    }

    get iv() { return this._iv ? [...this._iv] : null; }

    set nonce(nonceBytes) { this.iv = nonceBytes; }
    get nonce() { return this.iv; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      if (!this._iv) throw new Error("IV not set");
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._iv) throw new Error("IV not set");
      if (this.inputBuffer.length === 0) throw new Error("No data to process");
      if (!this.initialized) throw new Error("Edon80 (DarkCrypt) not properly initialized");

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++)
        output.push(OpCodes.XorN(this.inputBuffer[i], this._nextKeystreamByte()));

      this.inputBuffer = [];
      return output;
    }

    // ===== Edon80 (80-bit key / 64-bit IV variant) core =====

    // Split each byte into four two-bit digits, most significant first.
    static _bytesToDigits(bytes) {
      const digits = [];
      for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        digits.push(
          OpCodes.And32(OpCodes.Shr32(b, 6), 3),
          OpCodes.And32(OpCodes.Shr32(b, 4), 3),
          OpCodes.And32(OpCodes.Shr32(b, 2), 3),
          OpCodes.And32(b, 3)
        );
      }
      return digits;
    }

    _initialize() {
      const keyDigits = Edon80Instance._bytesToDigits(this._key); // 40 digits
      const ivDigits = Edon80Instance._bytesToDigits(this._iv);   // 32 digits

      // Bind each of the 80 pipeline stages to a quasigroup selected by the
      // key digits; the choice for stages 0-39 is repeated for stages 40-79.
      const stageQuasigroups = new Array(STAGES);
      for (let m = 0; m < KEY_DIGITS; m++) {
        const chosen = QUASIGROUPS[keyDigits[m]];
        stageQuasigroups[m] = chosen;
        stageQuasigroups[m + KEY_DIGITS] = chosen;
      }
      this.stageQuasigroups = stageQuasigroups;

      // Build the 80-digit leader sequence: key digits, then IV digits,
      // then the fixed tail, and load it into the initial pipeline state.
      const leaders = new Array(STAGES);
      const state = new Array(STAGES);
      let p = 0;
      for (let i = 0; i < KEY_DIGITS; i++, p++) leaders[p] = state[p] = keyDigits[i];
      for (let i = 0; i < IV_DIGITS; i++, p++) leaders[p] = state[p] = ivDigits[i];
      for (let i = 0; i < TAIL_DIGITS.length; i++, p++) leaders[p] = state[p] = TAIL_DIGITS[i];

      // Feed the leaders through the pipeline, most recently loaded first.
      for (let k = STAGES - 1; k >= 0; k--) {
        const stage = STAGES - 1 - k;
        const Q = stageQuasigroups[stage];
        state[0] = Q[leaders[k]][state[0]];
        for (let j = 1; j < STAGES; j++) state[j] = Q[state[j - 1]][state[j]];
      }

      this.state = state;
      this.counter = 3;
      this.initialized = true;
    }

    // One full pass of the pipeline, driven by a two-bit input digit fed
    // into stage 0. Returns the digit produced by the last stage.
    _pipelinePass(inputDigit) {
      const state = this.state;
      const Q0 = this.stageQuasigroups[0];
      state[0] = Q0[state[0]][inputDigit];
      for (let i = 1; i < STAGES; i++) {
        const Qi = this.stageQuasigroups[i];
        state[i] = Qi[state[i]][state[i - 1]];
      }
      return state[STAGES - 1];
    }

    // One keystream digit: advance the counter, run two pipeline passes,
    // keep only the second pass's output digit.
    _nextDigit() {
      this.counter = OpCodes.And32(this.counter + 1, 3);
      this._pipelinePass(this.counter);
      this.counter = OpCodes.And32(this.counter + 1, 3);
      return this._pipelinePass(this.counter);
    }

    _nextKeystreamByte() {
      let b = 0;
      for (let i = 0; i < 4; i++) b = OpCodes.And32(OpCodes.Xor32(OpCodes.Shl32(b, 2), this._nextDigit()), 0xFF);
      return b;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new Edon80Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Edon80Algorithm, Edon80Instance };
}));
