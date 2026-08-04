/*
 * Pomaranch (DarkCrypt) Stream Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Pomaranch is a synchronous stream cipher by Cees J.A. Jansen, Tor
 * Helleseth and Alexander Kholosha, submitted to the eSTREAM project.
 * Its keystream generator, the Cascade Jump Controlled Sequence
 * Generator (CJCSG), replaces classical irregular clock control with
 * "jump registers": linear feedback shift registers whose cells switch
 * between plain delay (S-cell) and self-XOR feedback (F-cell) behaviour
 * under the control of a key-dependent nonlinear filter, letting the
 * register either step once or "jump" several steps ahead while always
 * performing the same number of XOR operations (a side-channel
 * countermeasure).
 *
 * This implementation is the original (Version 1) 128-bit-key CJCSG:
 * nine cascaded 14-bit jump register sections (the last section holding
 * only the register, no filter), each of the first eight driven by a
 * 16-bit section key derived from the 128-bit master key. Every section's
 * Key Map extracts a 9-bit vector from fixed register cells, XORs it with
 * the low 9 bits of the section key, passes it through a 9-to-7 S-box,
 * XORs the result with the high 7 bits of the section key and feeds that
 * into a 7-variable balanced Boolean function to produce a "jump control"
 * bit. During Key Setup the nine registers are preset to fixed constants
 * and cycled 128 times in Shift Mode (cascading each section's jump
 * control into the next, closing the loop from the last section back to
 * the first) to build a per-key Initialization Vector. Loading an actual
 * IV XORs it cyclically, 14 bits per section, into that Initialization
 * Vector, followed by a 128-step blind run-up in Key Stream Generation
 * Mode. The keystream is then produced one bit per step as the XOR of a
 * fixed tap cell from all nine registers, packed most-significant-bit
 * first into bytes.
 *
 * IV length is fixed here at 14 bytes (112 bits), the maximum allowed by
 * the specification for the 128-bit key version.
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
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize } = AlgorithmFramework;

  const SECTIONS = 9;       // 8 full sections (register + Key Map) + 1 register-only section
  const KEYMAP_SECTIONS = 8;
  const REG_BITS = 14;      // jump register width in bits
  const SHIFT_STEPS = 128;  // Shift Mode steps during key setup and IV run-up

  // 9-to-7 S-box for the Key Map: inversion in the multiplicative group of
  // GF(2^9) with primitive polynomial f(x) = x^9 + x + 1 (top/bottom bits dropped).
  const SBOX = [
    0,0,0,127,64,85,127,54,96,18,42,57,63,83,91,51,112,17,73,38,21,
    103,92,49,95,122,105,113,45,104,25,61,120,107,8,112,100,89,19,39,
    74,102,115,41,110,80,88,119,47,62,61,15,52,29,56,88,22,16,52,26,
    12,125,94,93,124,75,53,14,4,77,120,84,114,2,44,112,73,9,19,19,
    101,121,115,21,57,5,20,115,55,72,104,14,108,63,59,116,87,121,31,
    89,94,80,7,91,90,98,14,33,92,84,44,72,75,82,72,82,90,85,13,48,70,
    97,62,34,47,24,46,108,126,91,101,76,26,69,71,119,66,30,38,95,60,
    97,106,117,57,82,65,78,86,78,56,82,100,111,4,34,73,65,9,51,50,94,
    124,87,57,72,10,77,92,54,2,64,74,78,121,48,27,56,100,18,52,98,7,
    51,54,84,31,94,93,31,122,12,43,29,60,70,79,5,108,110,111,76,40,
    121,3,39,45,68,45,14,113,13,71,117,16,120,46,63,42,1,22,80,100,
    76,37,44,105,13,36,2,41,21,109,125,106,71,70,122,88,23,35,84,48,
    87,95,12,81,7,87,81,12,30,23,105,54,3,127,1,109,42,114,36,102,39,
    77,34,98,79,99,117,123,81,97,86,79,51,83,77,111,33,30,125,48,59,
    53,33,58,123,28,22,41,27,96,4,39,19,43,115,103,10,28,16,105,126,
    50,114,55,32,66,69,17,41,36,37,96,43,68,66,89,49,25,55,111,11,62,
    61,107,67,28,37,36,28,69,95,102,3,46,60,27,17,1,109,96,29,37,112,
    103,68,60,40,24,62,13,59,92,11,114,24,9,79,26,29,113,106,3,127,25,
    32,27,88,42,5,15,123,47,116,46,40,15,25,61,34,6,83,85,2,78,73,30,
    68,35,107,103,45,66,26,118,122,119,67,55,44,38,9,20,102,124,32,65,
    101,83,10,86,74,98,5,22,110,7,123,56,75,6,63,35,120,58,90,8,97,
    124,81,23,119,31,49,85,58,64,126,11,49,104,118,50,80,38,69,18,4,
    86,8,52,90,6,117,18,89,65,76,20,74,10,21,118,93,126,23,53,113,35,
    67,99,110,125,116,108,99,11,33,17,8,106,53,24,50,43,20,47,59,6,99,
    104,93,67,71,107,16,40,101,70,118,15,58,75,32,116,109,91,64,1,0
  ];

  // 7-variable balanced Boolean function (2-resilient, degree 4, nonlinearity 56)
  // producing the section's "jump control out" bit from the Key Map's S-box output.
  const BOOL_F = [
    0,1,1,1,1,0,0,1,0,1,1,0,1,0,0,1,1,0,0,0,0,0,0,1,0,1,1,1,1,1,0,0,
    1,1,0,0,0,1,0,1,1,0,0,0,1,0,0,1,0,0,1,1,1,0,1,1,1,0,1,0,0,1,1,0,
    1,0,1,0,1,1,0,0,0,0,1,1,0,0,1,0,0,1,1,0,1,1,1,0,0,1,0,0,0,1,1,1,
    0,1,1,0,0,0,0,1,1,0,0,1,1,1,1,1,0,1,0,1,1,0,1,0,1,1,0,1,0,0,0,0
  ];

  // Fixed preset values for the nine jump registers (lsb of each value loads
  // into the register's cell 1).
  const PRESET = [0x090F, 0x36A8, 0x2216, 0x2308, 0x34C4, 0x3198, 0x28B8, 0x0370, 0x1CD1];

  // Cell roles at Jump Control = 0: true = feedback (F) cell, false = shift (S) cell,
  // indexed by cell number 1..14 (array index = cell - 1). Exactly seven of each.
  const IS_FEEDBACK_CELL = [true, false, true, false, false, false, true, true, true, false, true, false, true, false];

  // Key Map input cells (lsb..msb of the 9-bit filter input vector).
  const KEYMAP_CELLS = [2, 3, 4, 5, 7, 8, 9, 10, 11];

  const TAP_CELL_A = 6;        // trinomial feedback tap
  const TAP_CELL_B = 14;       // register wrap-around cell
  const KEYSTREAM_CELL = 13;   // keystream contribution tap

  function cellBit(reg, cell) { return OpCodes.And32(OpCodes.Shr32(reg, cell - 1), 1); }

  // One clock of a single 14-bit jump register: Galois-style left shift with the
  // trinomial tap fed into cell 1, F-cells additionally XOR their own previous value.
  function clockRegister(reg, injectBit, jumpControl) {
    const tap = OpCodes.Xor32(cellBit(reg, TAP_CELL_A), cellBit(reg, TAP_CELL_B));
    const newCell1 = OpCodes.Xor32(tap, OpCodes.And32(injectBit, 1));
    let result = 0;
    let prevBit = newCell1;
    for (let cell = 1; cell <= REG_BITS; cell++) {
      const oldBit = cellBit(reg, cell);
      const isF = jumpControl ? !IS_FEEDBACK_CELL[cell - 1] : IS_FEEDBACK_CELL[cell - 1];
      const inputBit = cell === 1 ? newCell1 : prevBit;
      const bit = isF ? OpCodes.Xor32(inputBit, oldBit) : inputBit;
      result |= OpCodes.Shl32(bit, cell - 1);
      prevBit = oldBit;
    }
    return OpCodes.And32(result, 0x3FFF);
  }

  // Key Map: derives the "jump control out" bit of a section from its register
  // state and its 16-bit section key.
  function keyMapOutput(reg, sectionKey) {
    let v = 0;
    for (let i = 0; i < KEYMAP_CELLS.length; i++) v |= OpCodes.Shl32(cellBit(reg, KEYMAP_CELLS[i]), i);
    const sum9 = OpCodes.Xor32(v, OpCodes.And32(sectionKey, 0x1FF));
    const w = SBOX[sum9];
    const sum7 = OpCodes.Xor32(w, OpCodes.And32(OpCodes.Shr32(sectionKey, 9), 0x7F));
    return BOOL_F[sum7];
  }

  class DarkCryptPomaranchAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "Pomaranch (DarkCrypt)";
      this.description = "Cascade Jump Controlled Sequence Generator (CJCSG), the 128-bit-key stream cipher behind Pomaranch: nine cascaded jump registers whose cells switch between shift and feedback roles under a key-dependent nonlinear filter, producing keystream as the XOR of a fixed tap across all sections.";
      this.inventor = "Cees J.A. Jansen, Tor Helleseth, Alexander Kholosha";
      this.year = 2005;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.NO;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];   // fixed 128-bit key
      this.SupportedNonceSizes = [new KeySize(14, 14, 0)]; // fixed 112-bit IV (this build's choice within the spec's 64-112 bit range)

      this.documentation = [
        new LinkItem("Cascade Jump Controlled Sequence Generator (CJCSG)", "https://www.ecrypt.eu.org/stream/ciphers/pomaranch/pomaranch.pdf"),
        new LinkItem("eSTREAM Pomaranch Page", "https://www.ecrypt.eu.org/stream/pomaranchp3.html")
      ];

      this.references = [
        new LinkItem("DarkCrypt Total Commander plugin", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [];

      this.tests = [
        {
          text: "DarkCrypt Pomaranch - 128-bit key, zero IV keystream",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("0000000000000000000000000000"),
          input: new Array(128).fill(0),
          expected: OpCodes.Hex8ToBytes("e5d7f7c09b1f1d3f672216e3e3103fce0619eb25cce07c03a2f8be6925248beb5dd63ea00a03885b02c97b77aab437b9b2642c0d78c5ddc443bc4a28032f7b441cc09ba2992b57b6074a370eee93503efd988c1f2b873780f6afd0c662ee5730648a969b2458be556a4371e1e0cd4b390cb028860b122db7b7116a243d56f448")
        },
        {
          text: "DarkCrypt Pomaranch - 128-bit key, zero IV, incrementing plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("0000000000000000000000000000"),
          input: (() => { const a = []; for (let i = 0; i < 64; i++) a.push(i); return a; })(),
          expected: OpCodes.Hex8ToBytes("e5d6f5c39f1a1b386f2b1ce8ef1d31c11608f936d8f56a14bae1a472393995f47df71c832e26ae7c2ae0515c8699199682551e3e4cf0ebf37b8570133f12457b")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptPomaranchInstance(this, isInverse);
    }
  }

  class DarkCryptPomaranchInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._iv = null;

      this.registers = new Array(SECTIONS).fill(0);
      this.sectionKeys = new Array(KEYMAP_SECTIONS).fill(0);
      this.initialized = false;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.initialized = false; return; }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Pomaranch (DarkCrypt) requires exactly 16 bytes`);
      this._key = [...keyBytes];
      if (this._iv) this._initialize();
    }

    get key() { return this._key ? [...this._key] : null; }

    set iv(ivBytes) {
      if (!ivBytes) { this._iv = null; this.initialized = false; return; }
      if (ivBytes.length === 0)
        throw new Error("Invalid IV size: 0 bytes. Pomaranch (DarkCrypt) requires a non-empty IV");
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
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._iv) throw new Error("IV not set");
      if (this.inputBuffer.length === 0) throw new Error("No data to process");
      if (!this.initialized) throw new Error("Pomaranch (DarkCrypt) not properly initialized");

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++) {
        output.push(OpCodes.XorN(this.inputBuffer[i], this._nextKeystreamByte()));
      }
      this.inputBuffer = [];
      return output;
    }

    // ===== Pomaranch / CJCSG core =====

    _initialize() {
      if (!this._key || !this._iv) return;

      this.sectionKeys = new Array(KEYMAP_SECTIONS);
      for (let i = 0; i < KEYMAP_SECTIONS; i++)
        this.sectionKeys[i] = OpCodes.And32(this._key[i * 2] | OpCodes.Shl32(this._key[i * 2 + 1], 8), 0xFFFF);

      // Key Setup: preset the nine registers, then run 128 Shift Mode steps.
      this.registers = PRESET.slice();
      for (let s = 0; s < SHIFT_STEPS; s++) this._shiftModeStep();

      // Save the per-key Initialization Vector, then load & XOR the actual IV
      // cyclically, 14 bits per register (14 msb of the IV chunk into the
      // register's high cell, wrapping around if the IV is shorter than 18*N bits).
      const initVector = this.registers.slice();
      this.registers = initVector.slice();

      const ivBits = [];
      for (const b of this._iv) for (let k = 7; k >= 0; k--) ivBits.push(OpCodes.And32(OpCodes.Shr32(b, k), 1));
      let pos = 0;
      for (let i = 0; i < SECTIONS; i++) {
        let chunk = 0;
        for (let k = 0; k < REG_BITS; k++) {
          chunk = OpCodes.Shl32(chunk, 1) | ivBits[pos % ivBits.length];
          pos++;
        }
        this.registers[i] ^= chunk;
      }

      // Blind run-up: 128 Key Stream Generation Mode steps, output discarded.
      for (let s = 0; s < SHIFT_STEPS; s++) this._generateStep();

      this.initialized = true;
    }

    // One Shift Mode step across all nine registers: every register uses the
    // base (Jump Control = 0) cell roles; the feedback of register i+1 is
    // additionally XORed with the Key Map output of register i, and register 1's
    // feedback is XORed with cell 1 of the last register, closing the cascade.
    _shiftModeStep() {
      const reg = this.registers;
      const wrapBit = cellBit(reg[SECTIONS - 1], 1);
      const jco = new Array(KEYMAP_SECTIONS);
      for (let i = 0; i < KEYMAP_SECTIONS; i++) jco[i] = keyMapOutput(reg[i], this.sectionKeys[i]);

      const next = new Array(SECTIONS);
      next[0] = clockRegister(reg[0], wrapBit, 0);
      for (let i = 1; i < SECTIONS; i++) next[i] = clockRegister(reg[i], jco[i - 1], 0);
      this.registers = next;
    }

    // One Key Stream Generation Mode step: the Jump Control bit cascades from
    // section to section (XOR of each section's own Key Map output into the
    // running total), selecting each register's cell roles for this step; the
    // output bit is the XOR of the tap cell across all nine registers, read
    // before the registers are clocked.
    _generateStep() {
      const reg = this.registers;
      const jco = new Array(KEYMAP_SECTIONS);
      for (let i = 0; i < KEYMAP_SECTIONS; i++) jco[i] = keyMapOutput(reg[i], this.sectionKeys[i]);

      const jc = new Array(SECTIONS);
      jc[0] = 0;
      for (let i = 1; i < SECTIONS; i++) jc[i] = OpCodes.Xor32(jc[i - 1], jco[i - 1]);

      let outputBit = 0;
      for (let i = 0; i < SECTIONS; i++) outputBit ^= cellBit(reg[i], KEYSTREAM_CELL);

      const next = new Array(SECTIONS);
      for (let i = 0; i < SECTIONS; i++) next[i] = clockRegister(reg[i], 0, jc[i]);
      this.registers = next;

      return outputBit;
    }

    _nextKeystreamByte() {
      let b = 0;
      for (let bitpos = 7; bitpos >= 0; bitpos--) b |= OpCodes.Shl32(this._generateStep(), bitpos);
      return OpCodes.And32(b, 0xFF);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DarkCryptPomaranchAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DarkCryptPomaranchAlgorithm, DarkCryptPomaranchInstance };
}));
