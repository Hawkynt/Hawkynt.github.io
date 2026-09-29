/*
 * Moustique Self-Synchronizing Stream Cipher
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Moustique is a hardware-oriented stream cipher submitted to the eSTREAM
 * project (Profile 2, hardware) by Joan Daemen and Paris Kitsos. Unlike most
 * stream ciphers, self-synchronization is not bolted on as a mode of
 * operation: it is intrinsic to the design. The cipher's core state is a
 * 96-cell conjugated cellular shift register (CCSR): each cell is a small
 * cellular-automaton neighborhood keyed by one of the cipher's 96 key bits,
 * and the automaton rule for the very first cell is driven directly by the
 * ciphertext bit that was just produced. Because the recovery of internal
 * state after any disturbance depends only on the last few ciphertext bits
 * (the design's "input memory"), the receiver resynchronizes automatically.
 *
 * A handful of the CCSR's rightmost cells are widened (holding up to 16
 * bits of extra state rather than 1) so that the register's overall period
 * is long enough despite its small size. The 128 bits produced by one CCSR
 * update are then whitened by a 7-stage linear pipeline (each stage taking
 * 53, 53, 53, 53, 53, 12 and finally 3 bits of input) before the 3
 * remaining bits are XORed together into a single keystream bit.
 *
 * Moustique takes a 96-bit (12-byte) key and processes a 104-bit (13-byte)
 * starting value as 105 warm-up clocks (1 fixed clock plus 104 input bits,
 * matching the design's input-memory length) before the first real
 * plaintext/ciphertext bit is produced. All bits -- key, starting value,
 * plaintext and ciphertext -- are consumed and produced most-significant-
 * bit first within each byte, one bit per clock.
 *
 * Moustique was later shown to be considerably weaker than its 96-bit key
 * suggests when the same key and starting value are reused, and it did not
 * advance to the final eSTREAM portfolio.
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

  // ===== CCSR cell-width table (Figure 3 / Table 1 of the Moustique spec) =====
  // Cells 1..88 hold a single bit each. Cells 89..96 are progressively wider,
  // giving the CCSR 128 bits of state in total (96 + 32 extra bits).
  /**
   * @param {int32} j
   * @returns {int32}
   */
  function cellWidth(j) {
    if (j >= 1 && j <= 88) return 1;
    if (j >= 89 && j <= 92) return 2;
    if (j >= 93 && j <= 94) return 4;
    if (j === 95) return 8;
    if (j === 96) return 16;
    throw new Error('cell index out of range: ' + j);
  }

  /**
   * @returns {int32[]} width of every cell 1..96 (index 0 unused)
   */
  function buildCellWidths() {
    /** @type {int32[]} */
    const widths = new Array(97);
    for (let j = 1; j <= 96; j++) widths[j] = cellWidth(j);
    return widths;
  }

  /** @type {int32[]} */
  const CELL_WIDTH = buildCellWidths();

  // Flat bit index for (cell j, extra-bit row i), row-major by i: index 0 is
  // reserved for the external "c" input; indices 1..96 are every cell's own
  // (row 0) bit, in order; indices 97..128 are the extra rows of the widened
  // cells 89..96, enumerated row by row (all row-1 extras first, then all
  // row-2 extras, and so on).
  /**
   * @returns {int32[][]} flat bit index per (cell, row)
   */
  function buildCellBitIndex() {
    /** @type {int32[][]} */
    const index = new Array(97);
    for (let j = 1; j <= 96; j++) {
      /** @type {int32[]} */
      const rows = new Array(CELL_WIDTH[j]);
      index[j] = rows;
    }
    for (let j = 1; j <= 96; j++) index[j][0] = j;
    /** @type {int32} */
    let next = 97;
    for (let row = 1; row <= 15; row++)
      for (let j = 1; j <= 96; j++)
        if (CELL_WIDTH[j] > row) index[j][row] = next++;
    if (next !== 129) throw new Error('CCSR bit-layout construction error');
    return index;
  }

  /** @type {int32[][]} */
  const CELL_BIT_INDEX = buildCellBitIndex();

  // The three GF(2) neighborhood functions used by the CCSR update rule
  // (Table 2 of the spec) and by the widened top-cell equation.
  /**
   * @param {uint32} a
   * @param {uint32} b
   * @param {uint32} c
   * @param {uint32} d
   * @returns {uint32}
   */
  function f0(a, b, c, d) { return OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(a, b), c), d); }
  /**
   * @param {uint32} a
   * @param {uint32} b
   * @param {uint32} c
   * @param {uint32} d
   * @returns {uint32}
   */
  function f1(a, b, c, d) { return OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(a, b), OpCodes.And32(c, OpCodes.Xor32(d, 1))), 1); }
  /**
   * @param {uint32} a
   * @param {uint32} b
   * @param {uint32} c
   * @param {uint32} d
   * @returns {uint32}
   */
  function f2(a, b, c, d) { return OpCodes.Xor32(OpCodes.And32(a, OpCodes.Xor32(b, 1)), OpCodes.And32(c, OpCodes.Xor32(d, 1))); }

  // Read cell j's bit at extra-row (state row mod that cell's own width);
  // cell 0 denotes the external "c" (feedback) input, which has no extra rows.
  /**
   * @param {uint8[]} state
   * @param {int32} j
   * @param {int32} row
   * @param {uint32} cVal
   * @returns {uint32}
   */
  function cellBit(state, j, row, cVal) {
    if (j === 0) {
      return cVal;
    }
    /** @type {int32} */
    const w = CELL_WIDTH[j];
    /** @type {int32} */
    const r = ((row % w) + w) % w;
    return state[CELL_BIT_INDEX[j][r]];
  }

  // One CCSR update: computes every cell's every bit from the previous state,
  // the 96-bit key and the current feedback/input bit c.
  /**
   * @param {uint8[]} state
   * @param {uint8[]} key
   * @param {uint32} cVal
   * @returns {uint8[]}
   */
  function ccsrUpdate(state, key, cVal) {
    const next = new Uint8Array(129);
    for (let j = 1; j <= 96; j++) {
      /** @type {int32} */
      const width = CELL_WIDTH[j];
      for (let row = 0; row < width; row++) {
        /** @type {uint32} */
        let bit = 0;
        if (j === 96 && row > 0) {
          // Widened top-cell equation (spec eq. 12): the extra rows of the
          // final, 16-bit-wide cell follow their own neighborhood rule
          // instead of the generic Table-2 case below.
          /** @type {uint32} */
          const near95 = cellBit(state, 95, row % 8, cVal);
          /** @type {uint32} */
          const far95 = cellBit(state, 95 - row, 0, cVal);
          /** @type {uint32} */
          const near94 = cellBit(state, 94, row % 4, cVal);
          const farCell = 94 - row;
          /** @type {uint32} */
          const far94 = cellBit(state, farCell, 1 % cellWidth(farCell), cVal);
          bit = f2(near95, far95, near94, far94);
        } else {
          // Generic Table-2 rule: which of the four neighborhood cases
          // applies is fixed by (j - row) mod 3 and mod 6.
          const d = j - row;
          const mod3 = ((d % 3) + 3) % 3;
          const mod6 = ((d % 6) + 6) % 6;
          /** @type {boolean} */
          let useF0 = false;
          /** @type {int32} */
          let v = 0;
          /** @type {int32} */
          let w = 0;
          if (mod3 === 1) { useF0 = true; v = (2 * (d - 1)) / 3; w = j - 2; }
          else if (mod3 === 2) { v = j - 4; w = j - 2; }
          else if (mod6 === 3) { v = 0; w = j - 2; }
          else { v = j - 5; w = 0; }
          if (j <= 2) { v = 0; w = 0; }
          /** @type {uint32} */
          const self = cellBit(state, j - 1, row, cVal);
          /** @type {uint32} */
          const left = cellBit(state, v, row, cVal);
          /** @type {uint32} */
          const right = cellBit(state, w, row, cVal);
          bit = useF0 ? f0(self, key[j - 1], left, right) : f1(self, key[j - 1], left, right);
        }
        next[CELL_BIT_INDEX[j][row]] = bit;
      }
    }
    return next;
  }

  /**
   * @param {uint8[]} state
   * @param {int32} i
   * @returns {uint32}
   */
  function stateBit(state, i) { return (i >= 1 && i <= 128) ? state[i] : 0; }
  /**
   * @param {uint8[]} arr
   * @param {int32} i
   * @param {int32} len
   * @returns {uint32}
   */
  function arrBit(arr, i, len) { return (i >= 0 && i < len) ? arr[i] : 0; }

  // Pipeline stage 1: 128 CCSR bits compressed to 53, with the spec's
  // output-index permutation (position i is written to (4*i) mod 53).
  /**
   * @param {uint8[]} state
   * @returns {uint8[]}
   */
  function pipelineStage1(state) {
    const out = new Uint8Array(53);
    for (let i = 0; i < 53; i++)
      out[(4 * i) % 53] = f1(stateBit(state, 128 - i), stateBit(state, i + 18), stateBit(state, 113 - i), stateBit(state, i + 1));
    return out;
  }

  // Pipeline stages 2-5: each compresses 53 bits to 53, same permutation.
  /**
   * @param {uint8[]} prev
   * @returns {uint8[]}
   */
  function pipelineStage(prev) {
    const out = new Uint8Array(53);
    for (let i = 0; i < 53; i++)
      out[(4 * i) % 53] = f1(arrBit(prev, i, 53), arrBit(prev, i + 3, 53), arrBit(prev, i + 1, 53), arrBit(prev, i + 2, 53));
    return out;
  }

  // Pipeline stage 6: 53 bits compressed to 12, no permutation.
  /**
   * @param {uint8[]} prev
   * @returns {uint8[]}
   */
  function pipelineStage6(prev) {
    const out = new Uint8Array(12);
    for (let i = 0; i < 12; i++)
      out[i] = f1(arrBit(prev, 4 * i, 53), arrBit(prev, 4 * i + 3, 53), arrBit(prev, 4 * i + 1, 53), arrBit(prev, 4 * i + 2, 53));
    return out;
  }

  // Pipeline stage 7: 12 bits compressed to the final 3 output bits.
  /**
   * @param {uint8[]} prev
   * @returns {uint8[]}
   */
  function pipelineStage7(prev) {
    const out = new Uint8Array(3);
    for (let i = 0; i < 3; i++)
      out[i] = f0(arrBit(prev, 4 * i, 12), arrBit(prev, 4 * i + 1, 12), arrBit(prev, 4 * i + 2, 12), arrBit(prev, 4 * i + 3, 12));
    return out;
  }

  const WARMUP_CLOCKS = 105; // 1 fixed clock + 104 starting-value bits (13 bytes)

  class MoustiqueEngine {
    /**
     * @param {uint8[]} keyBits96 - 96 key bits, one per element
     */
    constructor(keyBits96) {
      /** @type {uint8[]} */
      this.key = keyBits96;
      /** @type {uint8[]} */
      this.state = new Uint8Array(129);  // CCSR: index 0 unused (c held separately), 1..128 cells
      /** @type {uint32} */
      this.c = 0;                        // feedback/input bit consumed by the NEXT clock
      /** @type {uint32} */
      this.pendingOutput = 0;            // keystream bit produced by the PREVIOUS clock
      /** @type {uint8[]} */
      this.p1 = new Uint8Array(53);
      /** @type {uint8[]} */
      this.p2 = new Uint8Array(53);
      /** @type {uint8[]} */
      this.p3 = new Uint8Array(53);
      /** @type {uint8[]} */
      this.p4 = new Uint8Array(53);
      /** @type {uint8[]} */
      this.p5 = new Uint8Array(53);
      /** @type {uint8[]} */
      this.p6 = new Uint8Array(12);
      /** @type {uint8[]} */
      this.p7 = new Uint8Array(3);
    }

    // A single clock advances every pipeline stage and the CCSR by one step,
    // consuming inputBit as the new feedback value and returning the
    // keystream bit that resulted from the state as it stood BEFORE this
    // clock's own pipeline stages were recomputed.
    /**
     * @param {uint32} inputBit
     * @returns {uint32}
     */
    clock(inputBit) {
      /** @type {uint32} */
      const output = this.pendingOutput;
      /** @type {uint32} */
      const nextOutput = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(this.p7[0], this.p7[1]), this.p7[2]), 1);

      /** @type {uint8[]} */
      const nextP7 = pipelineStage7(this.p6);
      /** @type {uint8[]} */
      const nextP6 = pipelineStage6(this.p5);
      /** @type {uint8[]} */
      const nextP5 = pipelineStage(this.p4);
      /** @type {uint8[]} */
      const nextP4 = pipelineStage(this.p3);
      /** @type {uint8[]} */
      const nextP3 = pipelineStage(this.p2);
      /** @type {uint8[]} */
      const nextP2 = pipelineStage(this.p1);
      /** @type {uint8[]} */
      const nextP1 = pipelineStage1(this.state);
      /** @type {uint8[]} */
      const nextState = ccsrUpdate(this.state, this.key, this.c);

      this.pendingOutput = nextOutput;
      this.p7 = nextP7; this.p6 = nextP6; this.p5 = nextP5; this.p4 = nextP4;
      this.p3 = nextP3; this.p2 = nextP2; this.p1 = nextP1; this.state = nextState;
      this.c = OpCodes.And32(inputBit, 1);

      return output;
    }

    /**
     * @param {uint8[]} bits
     */
    warmUp(bits) {
      for (let i = 0; i < bits.length; i++) this.clock(bits[i]);
    }

    // Self-synchronizing encryption: the feedback bit fed back into the CCSR
    // is always the CIPHERTEXT bit, whichever direction is being computed.
    /**
     * @param {uint32} plainBit
     * @returns {uint32}
     */
    encryptBit(plainBit) {
      const z = this.pendingOutput;
      const cipherBit = OpCodes.And32(OpCodes.Xor32(plainBit, z), 1);
      this.clock(cipherBit);
      return cipherBit;
    }

    /**
     * @param {uint32} cipherBit
     * @returns {uint32}
     */
    decryptBit(cipherBit) {
      const z = this.pendingOutput;
      const plainBit = OpCodes.And32(OpCodes.Xor32(cipherBit, z), 1);
      this.clock(OpCodes.And32(cipherBit, 1));
      return plainBit;
    }
  }

  /**
   * @param {uint8[]} bytes
   * @returns {uint8[]}
   */
  function bytesToBitsMSBFirst(bytes) {
    /** @type {uint8[]} */
    const bits = new Array(bytes.length * 8);
    for (let i = 0; i < bytes.length; i++)
      for (let k = 0; k < 8; k++) bits[i * 8 + k] = OpCodes.And32(OpCodes.Shr32(bytes[i], 7 - k), 1);
    return bits;
  }

  /**
   * @param {uint8[]} bits
   * @returns {uint8[]}
   */
  function bitsToBytesMSBFirst(bits) {
    /** @type {uint8[]} */
    const out = new Array(OpCodes.Shr32(bits.length, 3));
    for (let i = 0; i < out.length; i++) {
      /** @type {uint32} */
      let b = 0;
      for (let k = 0; k < 8; k++) b = OpCodes.Or32(OpCodes.Shl32(b, 1), OpCodes.And32(bits[i * 8 + k], 1));
      out[i] = OpCodes.And32(b, 0xFF);
    }
    return out;
  }

  class DarkCryptMoustiqueAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "Moustique";
      this.description = "Self-synchronizing stream cipher built around a 96-bit conjugated cellular shift register whose feedback rule is driven by the produced ciphertext bit, followed by a 7-stage compression pipeline that reduces 128 register bits to one keystream bit. Uses a 96-bit key and a 104-bit starting value consumed as a 105-clock warm-up.";
      this.inventor = "Joan Daemen, Paris Kitsos";
      this.year = 2005;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.BE;

      this.SupportedKeySizes = [new KeySize(12, 12, 0)];   // fixed 96-bit key
      this.SupportedNonceSizes = [new KeySize(13, 13, 0)]; // fixed 104-bit starting value

      this.documentation = [
        new LinkItem("The Self-Synchronizing Stream Cipher Moustique (Daemen and Kitsos)", "https://www.ecrypt.eu.org/stream/p3ciphers/moustique/moustique_p3.pdf"),
        new LinkItem("eSTREAM Moustique Page", "https://www.ecrypt.eu.org/stream/moustiquep3.html")
      ];

      this.references = [
        new LinkItem("DarkCrypt / Zarya Total Commander plugin", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Cryptanalysis of the Self-Synchronizing Stream Cipher Moustique (Käsper, Rijmen, Bjørstad, Rechberger, Robshaw, Sekar)", '', '', "https://www.iacr.org/archive/asiacrypt2008/53500204/53500204.pdf")
      ];

      // The first four vectors are quoted from testvalues.txt in the authors'
      // own eSTREAM submission package (moustique.tar.gz). Because Moustique is
      // self-synchronizing, a constant ciphertext stream drives the register to
      // a constant state, so the keystream settles on a single key-dependent
      // bit: for the all-zero key that bit is 1, which is why all-zero
      // plaintext encrypts to all-ones-derived output here rather than to
      // zeroes. A vector whose input and output are both all zero would
      // therefore distinguish nothing and is deliberately not used.
      this.tests = [
        {
          text: "eSTREAM Moustique testvalues.txt - zero key, zero starting value, zero plaintext",
          uri: "https://web.archive.org/web/20070326181649if_/http://www.ecrypt.eu.org:80/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/mosquito/moustique.tar.gz?view=tar",
          key: OpCodes.Hex8ToBytes("000000000000000000000000"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000"),
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("ffc02501a57e0bf7840e8b8fe2edef46")
        },
        {
          text: "eSTREAM Moustique testvalues.txt - zero key, zero starting value, all-ones plaintext",
          uri: "https://web.archive.org/web/20070326181649if_/http://www.ecrypt.eu.org:80/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/mosquito/moustique.tar.gz?view=tar",
          key: OpCodes.Hex8ToBytes("000000000000000000000000"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000"),
          input: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
          expected: OpCodes.Hex8ToBytes("00000000000000000000000000000000")
        },
        {
          text: "eSTREAM Moustique testvalues.txt - zero key, zero starting value, counting plaintext",
          uri: "https://web.archive.org/web/20070326181649if_/http://www.ecrypt.eu.org:80/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/mosquito/moustique.tar.gz?view=tar",
          key: OpCodes.Hex8ToBytes("000000000000000000000000"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000"),
          input: OpCodes.Hex8ToBytes("0123456789abcdef0123456789abcdef"),
          expected: OpCodes.Hex8ToBytes("fee35ee5484164a0fee95934fd771361")
        },
        {
          text: "eSTREAM Moustique testvalues.txt - zero key, zero starting value, descending plaintext",
          uri: "https://web.archive.org/web/20070326181649if_/http://www.ecrypt.eu.org:80/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/mosquito/moustique.tar.gz?view=tar",
          key: OpCodes.Hex8ToBytes("000000000000000000000000"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000"),
          input: OpCodes.Hex8ToBytes("fedcba9876543210fedcba9876543210"),
          expected: OpCodes.Hex8ToBytes("0123172a369bce1d035f3447ccb75001")
        },
        {
          text: "DarkCrypt Moustique - 96-bit key, zero starting value, incrementing 64-byte input",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000"),
          input: (() => { const a = []; for (let i = 0; i < 64; i++) a.push(i); return a; })(),
          expected: OpCodes.Hex8ToBytes("0001021c69bbf834446db204fe215faa5c9dcebd7d420f1b95b50687eb641265064b1664db647d5976dd3d4ebd7542a11fff0fb491ca8ff9686f5d094d72fb33")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptMoustiqueInstance(this, isInverse);
    }
  }

  class DarkCryptMoustiqueInstance extends IAlgorithmInstance {
    /**
     * @param {DarkCryptMoustiqueAlgorithm} algorithm
     * @param {boolean} [isInverse=false]
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
      /** @type {MoustiqueEngine|null} */
      this.engine = null;
    }

    /**
     * @param {uint8[]|null} keyBytes
     */
    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.engine = null; return; }
      if (keyBytes.length !== 12)
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. Moustique requires exactly 12 bytes (96 bits)");
      this._key = [...keyBytes];
      if (this._iv) this._initialize();
    }

    /**
     * @returns {uint8[]|null}
     */
    get key() { return this._key ? [...this._key] : null; }

    /**
     * @param {uint8[]|null} ivBytes
     */
    set iv(ivBytes) {
      if (!ivBytes) { this._iv = null; this.engine = null; return; }
      if (ivBytes.length !== 13)
        throw new Error("Invalid IV size: " + ivBytes.length + " bytes. Moustique requires exactly 13 bytes (104 bits)");
      this._iv = [...ivBytes];
      if (this._key) this._initialize();
    }

    /**
     * @returns {uint8[]|null}
     */
    get iv() { return this._iv ? [...this._iv] : null; }

    /**
     * @param {uint8[]|null} nonceBytes
     */
    set nonce(nonceBytes) { this.iv = nonceBytes; }
    /**
     * @returns {uint8[]|null}
     */
    get nonce() { return this.iv; }

    /**
     * @param {uint8[]} data
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      if (!this._iv) throw new Error("IV not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
     * @returns {uint8[]}
     */
    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._iv) throw new Error("IV not set");
      if (this.inputBuffer.length === 0) throw new Error("No data to process");
      if (!this.engine) {
        throw new Error("Moustique not properly initialized");
      }

      /** @type {uint8[]} */
      const inputBits = bytesToBitsMSBFirst(this.inputBuffer);
      /** @type {uint8[]} */
      const outputBits = new Array(inputBits.length);
      if (this.isInverse) {
        for (let i = 0; i < inputBits.length; i++) {
          /** @type {uint32} */
          const bit = this.engine.decryptBit(inputBits[i]);
          outputBits[i] = bit;
        }
      } else {
        for (let i = 0; i < inputBits.length; i++) {
          /** @type {uint32} */
          const bit = this.engine.encryptBit(inputBits[i]);
          outputBits[i] = bit;
        }
      }

      this.inputBuffer = [];
      return bitsToBytesMSBFirst(outputBits);
    }

    _initialize() {
      if (!this._key || !this._iv) {
        return;
      }

      /** @type {uint8[]} */
      const keyBits = bytesToBitsMSBFirst(this._key);       // 96 bits
      /** @type {uint8[]} */
      const startBits = bytesToBitsMSBFirst(this._iv);      // 104 bits

      this.engine = new MoustiqueEngine(keyBits);
      /** @type {uint8[]} */
      const warmupBits = OpCodes.CreateArray(WARMUP_CLOCKS, 0);
      for (let i = 0; i < startBits.length; i++) warmupBits[1 + i] = startBits[i];
      this.engine.warmUp(warmupBits);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DarkCryptMoustiqueAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DarkCryptMoustiqueAlgorithm, DarkCryptMoustiqueInstance };
}));
