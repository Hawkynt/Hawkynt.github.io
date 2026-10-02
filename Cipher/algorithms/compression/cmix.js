/*
 * CMIX Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * A clean-room port of CompressionWorkbench's reduced CMIX building block
 * (BB_Cmix). Scope honesty: the real cmix (Byron Knoll,
 * https://github.com/byronknoll/cmix) is an ensemble of dozens of models,
 * including neural-network and PAQ8/LSTM sub-models, mixed through multiple
 * mixer layers. This implements NONE of that ensemble. It is the reduced
 * subset CompressionWorkbench documents and this port matches exactly:
 * hashed byte-history contexts (orders 0,1,2,3,4,6), one word context (hash
 * of bytes since the last non-alphanumeric byte), one match model (follows
 * the longest recent repeat), all eight predictions combined by a single
 * logistic-domain mixer and refined by two chained adaptive probability map
 * (SSE) stages, entropy-coded with a binary arithmetic coder.
 *
 * Wire format: [originalLength: uint32 LE] [arithmetic-coded bitstream,
 * MSB-first per byte]
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
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
          CompressionAlgorithm, IAlgorithmInstance, LinkItem } = AlgorithmFramework;

  // ===== LOGISTIC MIXING PRIMITIVES (ported from Compression.Core.Entropy.ContextMixing) =====

  /** @type {int32} */
  const CM_PROB_BITS = 12;
  /** @type {int32} */
  const CM_PROB_SCALE = 4096;
  /** @type {int32} */
  const CM_MIN_STRETCH = -2047;
  /** @type {int32} */
  const CM_MAX_STRETCH = 2047;

  /**
   * Replicates the reference's rounding (round-half-to-even).
   * @param {float64} x - Value
   * @returns {int32} x rounded to the nearest integer, ties to even
   */
  function roundHalfEven(x) {
    /** @type {int32} */
    const flo = Math.floor(x);
    /** @type {float64} */
    const diff = x - flo;
    if (diff < 0.5) {
      return flo;
    }
    if (diff > 0.5) {
      return flo + 1;
    }
    return (flo % 2 === 0) ? flo : flo + 1;
  }

  /**
   * @returns {int16[]} squash(x) on the 12-bit grid for every logit x
   */
  function buildSquashTable() {
    /** @type {int32} */
    const span = CM_MAX_STRETCH - CM_MIN_STRETCH + 1;
    /** @type {int16[]} */
    const table = new Int16Array(span);
    for (let i = 0; i < span; ++i) {
      /** @type {float64} */
      const x = (CM_MIN_STRETCH + i) / 256.0;
      /** @type {float64} */
      const p = 1.0 / (1.0 + Math.exp(-x));
      /** @type {int32} */
      const scaled = roundHalfEven(p * CM_PROB_SCALE);
      table[i] = Math.max(1, Math.min(CM_PROB_SCALE - 1, scaled));
    }
    return table;
  }

  /**
   * @param {int16[]} squash - Squash table
   * @returns {int16[]} Its inverse on the 12-bit grid
   */
  function buildStretchTable(squash) {
    // Invert squash so the two are exact mutual inverses on the 12-bit grid.
    /** @type {int16[]} */
    const table = new Int16Array(CM_PROB_SCALE);
    /** @type {int32} */
    let pos = 0;
    for (let x = CM_MIN_STRETCH; x <= CM_MAX_STRETCH; ++x) {
      /** @type {int32} */
      const p = squash[x - CM_MIN_STRETCH];
      while (pos <= p && pos < CM_PROB_SCALE) {
        table[pos++] = x;
      }
    }
    while (pos < CM_PROB_SCALE) {
      table[pos++] = CM_MAX_STRETCH;
    }
    return table;
  }

  /** @type {int16[]} */
  const CM_SQUASH_TABLE = buildSquashTable();
  /** @type {int16[]} */
  const CM_STRETCH_TABLE = buildStretchTable(CM_SQUASH_TABLE);

  /**
   * @param {int32} logit - Logit
   * @returns {int32} Probability of a one bit on the 12-bit grid
   */
  function logisticSquash(logit) {
    if (logit <= CM_MIN_STRETCH) {
      return 1;
    }
    if (logit >= CM_MAX_STRETCH) {
      return CM_PROB_SCALE - 1;
    }
    return CM_SQUASH_TABLE[logit - CM_MIN_STRETCH];
  }

  /**
   * @param {int32} probability - Probability on the 12-bit grid
   * @returns {int32} Its logit
   */
  function logisticStretch(probability) {
    /** @type {int32} */
    const p = Math.max(0, Math.min(CM_PROB_SCALE - 1, probability));
    return CM_STRETCH_TABLE[p];
  }

  /**
   * The logistic primitives, as exported (the coders call the functions)
   */
  class Logistic {
    /** @returns {int32} Probability bits */
    static get ProbabilityBits() {
      return CM_PROB_BITS;
    }

    /** @returns {int32} Probability scale */
    static get ProbabilityScale() {
      return CM_PROB_SCALE;
    }

    /** @returns {int32} Smallest logit */
    static get MinStretch() {
      return CM_MIN_STRETCH;
    }

    /** @returns {int32} Largest logit */
    static get MaxStretch() {
      return CM_MAX_STRETCH;
    }

    /**
     * @param {int32} logit - Logit
     * @returns {int32} Probability of a one bit on the 12-bit grid
     */
    static Squash(logit) {
      return logisticSquash(logit);
    }

    /**
     * @param {int32} probability - Probability on the 12-bit grid
     * @returns {int32} Its logit
     */
    static Stretch(probability) {
      return logisticStretch(probability);
    }
  }

  // Deterministic 32-bit hash mixer used to fold history bytes into a context.
  /**
   * @param {uint32} h - Hash so far
   * @param {uint32} x - Value folded in
   * @returns {uint32} New hash
   */
  function mixHash(h, x) {
    /** @type {uint32} */
    const sum = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(x, 0x9E3779B1), OpCodes.Shl32(h, 6)), OpCodes.Shr32(h, 2));
    return OpCodes.Xor32(h, sum);
  }

  // ===== CONTEXT MODEL =====
  // Each slot packs a 12-bit probability of bit 1 in the high bits and a
  // saturating hit count in the low 10 bits; the update rate shrinks as the
  // count grows so fresh contexts adapt fast and trained ones stay stable.

  /** @type {int32} */
  const CM_COUNT_BITS = 10;
  /** @type {int32} */
  const CM_COUNT_MASK = 1023;

  class ContextModel {
    /**
     * @param {int32} tableBits - log2 of the number of slots
     */
    constructor(tableBits) {
      /** @type {int32} */
      const tableSize = OpCodes.Shl32(1, tableBits);
      /** @type {int32} */
      this.tableMask = tableSize - 1;
      /** @type {int32[]} */
      this.state = new Int32Array(tableSize);
      this.state.fill(OpCodes.Shl32(CM_PROB_SCALE / 2, CM_COUNT_BITS));
    }

    /**
     * @param {uint32} context - Context hash
     * @returns {int32} Probability of a one bit on the 12-bit grid
     */
    predict(context) {
      /** @type {uint32} */
      const idx = OpCodes.And32(context, this.tableMask);
      /** @type {int32} */
      const p = OpCodes.Shr32(this.state[idx], CM_COUNT_BITS);
      return Math.max(1, Math.min(CM_PROB_SCALE - 1, p));
    }

    /**
     * @param {uint32} context - Context hash
     * @param {int32} bit - Observed bit
     */
    update(context, bit) {
      /** @type {uint32} */
      const idx = OpCodes.And32(context, this.tableMask);
      /** @type {int32} */
      const packed = this.state[idx];
      /** @type {int32} */
      let probability = OpCodes.Shr32(packed, CM_COUNT_BITS);
      /** @type {int32} */
      let count = OpCodes.And32(packed, CM_COUNT_MASK);
      /** @type {int32} */
      const rate = count + 2;
      /** @type {int32} */
      const target = bit === 1 ? CM_PROB_SCALE : 0;
      probability = probability + Math.trunc((target - probability) / rate);
      probability = Math.max(1, Math.min(CM_PROB_SCALE - 1, probability));
      if (count < CM_COUNT_MASK) {
        ++count;
      }
      this.state[idx] = OpCodes.Or32(OpCodes.Shl32(probability, CM_COUNT_BITS), count);
    }
  }

  // ===== ADAPTIVE PROBABILITY MAP (SSE) =====

  /** @type {int32} */
  const APM_KNOTS = 33;
  /** @type {int32} */
  const APM_STEP = Math.trunc((CM_MAX_STRETCH - CM_MIN_STRETCH) / (APM_KNOTS - 1));

  class Apm {
    /**
     * @param {int32} contexts - Number of contexts (a power of two)
     * @param {int32} [rate=7] - log2 of the update divisor
     */
    constructor(contexts, rate = 7) {
      /** @type {int32} */
      this.contextMask = contexts - 1;
      /** @type {int32} */
      this.rate = rate;
      /** @type {float64} */
      this.rateDivisor = Math.pow(2, this.rate);
      /** @type {int32[]} */
      this.map = new Int32Array(contexts * APM_KNOTS);
      for (let c = 0; c < contexts; ++c) {
        for (let k = 0; k < APM_KNOTS; ++k) {
          /** @type {int32} */
          const logit = CM_MIN_STRETCH + k * APM_STEP;
          this.map[c * APM_KNOTS + k] = logisticSquash(logit);
        }
      }
      /** @type {int32} */
      this.lastIndex = 0;
      /** @type {int32} */
      this.lastWeight = 0;
    }

    /**
     * @param {int32} probability - Probability on the 12-bit grid
     * @param {uint32} context - Context
     * @returns {int32} Refined probability
     */
    refine(probability, context) {
      /** @type {int32} */
      const s = logisticStretch(probability) - CM_MIN_STRETCH;
      /** @type {int32} */
      let knot = Math.trunc(s / APM_STEP);
      /** @type {int32} */
      let weight = s - knot * APM_STEP;
      if (knot >= APM_KNOTS - 1) {
        knot = APM_KNOTS - 2;
        weight = APM_STEP;
      }
      /** @type {int32} */
      const contextIndex = OpCodes.And32(context, this.contextMask);
      /** @type {int32} */
      const baseIdx = contextIndex * APM_KNOTS + knot;
      /** @type {int32} */
      const lo = this.map[baseIdx];
      /** @type {int32} */
      const hi = this.map[baseIdx + 1];
      /** @type {int32} */
      const refined = lo + Math.trunc((hi - lo) * weight / APM_STEP);
      this.lastIndex = (weight * 2 >= APM_STEP) ? baseIdx + 1 : baseIdx;
      this.lastWeight = weight;
      return Math.max(1, Math.min(CM_PROB_SCALE - 1, refined));
    }

    /**
     * @param {int32} bit - Observed bit
     */
    update(bit) {
      /** @type {int32} */
      const target = bit === 1 ? CM_PROB_SCALE - 1 : 0;
      /** @type {int32} */
      const current = this.map[this.lastIndex];
      this.map[this.lastIndex] = current + Math.floor((target - current) / this.rateDivisor);
    }
  }

  // ===== MATCH MODEL =====

  class MatchModel {
    /**
     * @param {int32} capacity - Number of bytes the history can hold
     * @param {int32} [minOrder=4] - Context length hashed to find a match
     * @param {int32} [hashBits=18] - log2 of the hash table size
     */
    constructor(capacity, minOrder = 4, hashBits = 18) {
      /** @type {uint8[]} */
      this.buffer = new Uint8Array(Math.max(capacity, 1));
      /** @type {int32} */
      this.minOrder = Math.max(minOrder, 1);
      /** @type {int32} */
      const size = OpCodes.Shl32(1, hashBits);
      /** @type {int32[]} */
      this.hashHead = new Int32Array(size).fill(-1);
      /** @type {int32} */
      this.hashMask = size - 1;
      /** @type {int32} */
      this.length = 0;
      /** @type {int32} */
      this.matchPointer = -1;
      /** @type {int32} */
      this.matchLength = 0;
    }

    /**
     * @returns {int32} Byte the current match predicts next, or -1 without a match
     */
    get predictedByte() {
      if (this.matchLength > 0 && this.matchPointer >= 0 && this.matchPointer < this.length) {
        return this.buffer[this.matchPointer];
      }
      return -1;
    }

    /**
     * @param {uint8} value - Next byte of the history
     */
    append(value) {
      if (this.matchLength > 0 && this.matchPointer < this.length && this.buffer[this.matchPointer] === value) {
        ++this.matchPointer;
        ++this.matchLength;
      } else {
        this.matchLength = 0;
        this.matchPointer = -1;
      }

      if (this.length < this.buffer.length) {
        this.buffer[this.length] = value;
      }
      ++this.length;

      if (this.length < this.minOrder) {
        return;
      }

      /** @type {uint32} */
      const hash = this._computeContextHash();
      if (this.matchLength === 0) {
        /** @type {int32} */
        const candidate = this.hashHead[hash];
        if (candidate >= 0 && candidate < this.length) {
          this.matchPointer = candidate;
          this.matchLength = 1;
        }
      }

      this.hashHead[hash] = this.length;
    }

    /**
     * @returns {uint32} Hash of the last minOrder bytes
     */
    _computeContextHash() {
      /** @type {uint32} */
      let h = 0xC2B2AE35;
      for (let i = this.length - this.minOrder; i < this.length; ++i) {
        h = mixHash(h, this.buffer[i]);
      }
      return OpCodes.And32(h, this.hashMask);
    }
  }

  // ===== BINARY ARITHMETIC CODER (30-bit precision) =====
  // The bounds stay below 2^30, but range * prob0 needs up to 46 bits: it is
  // computed in float64 (exact), as the plain number arithmetic was.

  /** @type {int32} */
  const AC_FULL_RANGE = OpCodes.Shl32(1, 30);
  /** @type {int32} */
  const AC_HALF_RANGE = OpCodes.Shl32(1, 29);
  /** @type {int32} */
  const AC_QUARTER_RANGE = OpCodes.Shl32(1, 28);

  class ArithmeticEncoder {
    constructor() {
      /** @type {int32} */
      this.low = 0;
      /** @type {int32} */
      this.high = AC_FULL_RANGE - 1;
      /** @type {int32} */
      this.pendingBits = 0;
      /** @type {uint32} */
      this.bitBuffer = 0;
      /** @type {int32} */
      this.bitsInBuffer = 0;
      /** @type {uint8[]} */
      this.output = [];
    }

    /**
     * @param {int32} bit - Bit to code
     * @param {int32} prob0 - Probability of a zero bit, scaled by 65536
     */
    encodeBit(bit, prob0) {
      /** @type {float64} */
      const range = this.high - this.low + 1;
      /** @type {int32} */
      const mid = this.low + Math.floor(range * prob0 / 65536) - 1;
      if (bit === 0) {
        this.high = mid;
      } else {
        this.low = mid + 1;
      }
      this._normalize();
    }

    /** Output the final disambiguating bits and the partial last byte */
    finish() {
      ++this.pendingBits;
      this._writeBitAndPending(this.low >= AC_QUARTER_RANGE ? 1 : 0);
      if (this.bitsInBuffer > 0) {
        this.bitBuffer = OpCodes.Shl32(this.bitBuffer, 8 - this.bitsInBuffer);
        this.output.push(OpCodes.And32(this.bitBuffer, 0xFF));
      }
    }

    /** Shift out settled bits (with underflow handling) */
    _normalize() {
      for (;;) {
        if (this.high < AC_HALF_RANGE) {
          this._writeBitAndPending(0);
        } else if (this.low >= AC_HALF_RANGE) {
          this._writeBitAndPending(1);
          this.low -= AC_HALF_RANGE;
          this.high -= AC_HALF_RANGE;
        } else if (this.low >= AC_QUARTER_RANGE && this.high < 3 * AC_QUARTER_RANGE) {
          ++this.pendingBits;
          this.low -= AC_QUARTER_RANGE;
          this.high -= AC_QUARTER_RANGE;
        } else {
          break;
        }
        this.low = OpCodes.Shl32(this.low, 1);
        this.high = OpCodes.Or32(OpCodes.Shl32(this.high, 1), 1);
      }
    }

    /**
     * @param {int32} bit - Bit, followed by the pending opposite bits
     */
    _writeBitAndPending(bit) {
      this._writeBit(bit);
      /** @type {int32} */
      const opposite = 1 - bit;
      while (this.pendingBits > 0) {
        this._writeBit(opposite);
        --this.pendingBits;
      }
    }

    /**
     * @param {int32} bit - Bit
     */
    _writeBit(bit) {
      this.bitBuffer = OpCodes.Or32(OpCodes.Shl32(this.bitBuffer, 1), bit);
      ++this.bitsInBuffer;
      if (this.bitsInBuffer !== 8) {
        return;
      }
      this.output.push(OpCodes.And32(this.bitBuffer, 0xFF));
      this.bitBuffer = 0;
      this.bitsInBuffer = 0;
    }
  }

  class ArithmeticDecoder {
    /**
     * @param {uint8[]} bytes - Coded bytes (zero bits past the end)
     */
    constructor(bytes) {
      /** @type {uint8[]} */
      this.input = bytes;
      /** @type {int32} */
      this.pos = 0;
      /** @type {int32} */
      this.low = 0;
      /** @type {int32} */
      this.high = AC_FULL_RANGE - 1;
      /** @type {int32} */
      this.code = 0;
      /** @type {uint8} */
      this.bitBuffer = 0;
      /** @type {int32} */
      this.bitsRemaining = 0;
      for (let i = 0; i < 30; ++i) {
        this.code = OpCodes.Or32(OpCodes.Shl32(this.code, 1), this._readBit());
      }
    }

    /**
     * @param {int32} prob0 - Probability of a zero bit, scaled by 65536
     * @returns {int32} Decoded bit
     */
    decodeBit(prob0) {
      /** @type {float64} */
      const range = this.high - this.low + 1;
      /** @type {int32} */
      const mid = this.low + Math.floor(range * prob0 / 65536) - 1;
      /** @type {int32} */
      let bit = 0;
      if (this.code <= mid) {
        bit = 0;
        this.high = mid;
      } else {
        bit = 1;
        this.low = mid + 1;
      }
      this._normalize();
      return bit;
    }

    /** Shift in bits as the interval narrows */
    _normalize() {
      for (;;) {
        if (this.high < AC_HALF_RANGE) {
          // both halves already agree on the leading bit
        } else if (this.low >= AC_HALF_RANGE) {
          this.low -= AC_HALF_RANGE;
          this.high -= AC_HALF_RANGE;
          this.code -= AC_HALF_RANGE;
        } else if (this.low >= AC_QUARTER_RANGE && this.high < 3 * AC_QUARTER_RANGE) {
          this.low -= AC_QUARTER_RANGE;
          this.high -= AC_QUARTER_RANGE;
          this.code -= AC_QUARTER_RANGE;
        } else {
          break;
        }
        this.low = OpCodes.Shl32(this.low, 1);
        this.high = OpCodes.Or32(OpCodes.Shl32(this.high, 1), 1);
        this.code = OpCodes.Or32(OpCodes.Shl32(this.code, 1), this._readBit());
      }
    }

    /**
     * @returns {uint32} Next bit, 0 past the end
     */
    _readBit() {
      if (this.bitsRemaining === 0) {
        this.bitBuffer = this.pos < this.input.length ? this.input[this.pos++] : 0;
        this.bitsRemaining = 8;
      }
      --this.bitsRemaining;
      return OpCodes.And32(OpCodes.Shr32(this.bitBuffer, this.bitsRemaining), 1);
    }
  }

  // Matches .NET's char.IsLetterOrDigit for a single byte value (0-255):
  // ASCII digits '0'-'9', plus any Unicode letter category in that range.
  // The answers for all 256 byte values are computed once, by the same test.
  /**
   * @returns {boolean[]} Letter-or-digit flag for every byte value
   */
  function buildLetterOrDigitTable() {
    /** @type {boolean[]} */
    const table = new Array(256);
    for (let value = 0; value < 256; value++) {
      if (value >= 48 && value <= 57) {
        table[value] = true;
      } else {
        /** @type {boolean} */
        const isLetter = /\p{L}/u.test(String.fromCharCode(value));
        table[value] = isLetter;
      }
    }
    return table;
  }

  /** @type {boolean[]} */
  const LETTER_OR_DIGIT = buildLetterOrDigitTable();

  /**
   * @param {uint8} value - Byte value
   * @returns {boolean} True for an ASCII digit or a letter
   */
  function isLetterOrDigitByte(value) {
    return LETTER_OR_DIGIT[value];
  }

  // ===== CMIX REDUCED MODEL SET =====

  /** @type {int32[]} */
  const CMIX_ORDERS = [0, 1, 2, 3, 4, 6];
  /** @type {int32[]} */
  const CMIX_ORDER_TABLE_BITS = [10, 16, 18, 21, 22, 22];
  /** @type {int32} */
  const CMIX_WORD_TABLE_BITS = 18;
  /** @type {int32} */
  const CMIX_WEIGHT_SHIFT = 16;
  /** @type {int32} */
  const CMIX_LEARNING_RATE = 3;
  /** @type {int32} */
  const CMIX_INPUT_COUNT = 8;

  // The mixer weights are never clamped, so they (and the dot product) are
  // kept as exact float64 values, as the plain number arithmetic always was.

  class CmixState {
    /**
     * @param {int32} capacity - Message length (match model history size)
     */
    constructor(capacity) {
      /** @type {ContextModel[]} */
      this.orderModels = [];
      for (let i = 0; i < CMIX_ORDERS.length; i++) {
        this.orderModels.push(new ContextModel(CMIX_ORDER_TABLE_BITS[i]));
      }
      /** @type {ContextModel} */
      this.wordModel = new ContextModel(CMIX_WORD_TABLE_BITS);
      /** @type {MatchModel} */
      this.matchModel = new MatchModel(capacity);

      /** @type {float64} */
      const initial = Math.trunc(OpCodes.Shl32(1, CMIX_WEIGHT_SHIFT) / CMIX_INPUT_COUNT);
      /** @type {float64[]} */
      this.weights = new Array(CMIX_INPUT_COUNT);
      /** @type {int32[]} */
      this.stretched = new Array(CMIX_INPUT_COUNT);
      for (let i = 0; i < CMIX_INPUT_COUNT; i++) {
        this.weights[i] = initial;
        this.stretched[i] = 0;
      }
      /** @type {uint32[]} */
      this.contexts = new Array(CMIX_INPUT_COUNT - 1);
      for (let i = 0; i < CMIX_INPUT_COUNT - 1; i++) {
        this.contexts[i] = 0;
      }

      /** @type {int32[]} */
      this.history = new Array(8);
      for (let i = 0; i < 8; i++) {
        this.history[i] = 0;
      }
      /** @type {uint32} */
      this.wordHash = 0;
      /** @type {int32} */
      this.preApmProbability12 = 0;

      /** @type {Apm} */
      this.apm1 = new Apm(256);
      /** @type {Apm} */
      this.apm2 = new Apm(512);
    }

    /**
     * @param {int32} c0 - Partial current byte with its leading 1
     * @param {int32} bit - Position of the bit being predicted (7..0)
     * @returns {int32} Probability of a one bit, scaled by 65536
     */
    predict(c0, bit) {
      for (let i = 0; i < this.orderModels.length; ++i) {
        /** @type {int32} */
        const order = CMIX_ORDERS[i];
        /** @type {uint32} */
        let h = OpCodes.Mul32(order, 0x9E3779B1);
        for (let k = 0; k < order; ++k) {
          h = mixHash(h, this.history[k]);
        }
        h = mixHash(h, c0);
        this.contexts[i] = OpCodes.And32(h, 0x7FFFFFFF);
        /** @type {ContextModel} */
        const model = this.orderModels[i];
        /** @type {int32} */
        const p = model.predict(this.contexts[i]);
        this.stretched[i] = logisticStretch(p);
      }

      /** @type {uint32} */
      const wordContext = OpCodes.And32(mixHash(this.wordHash, c0), 0x7FFFFFFF);
      this.contexts[this.contexts.length - 1] = wordContext;
      /** @type {int32} */
      const wordIndex = this.orderModels.length;
      /** @type {int32} */
      const wordP = this.wordModel.predict(wordContext);
      this.stretched[wordIndex] = logisticStretch(wordP);

      /** @type {int32} */
      const matchIndex = wordIndex + 1;
      /** @type {int32} */
      const matchStretch = CmixState._matchStretch(this.matchModel, c0, bit);
      this.stretched[matchIndex] = matchStretch;

      /** @type {float64} */
      let dot = 0;
      for (let i = 0; i < CMIX_INPUT_COUNT; ++i) {
        dot += this.weights[i] * this.stretched[i];
      }

      /** @type {int32} */
      const logit = Math.floor(dot / 65536);
      /** @type {int32} */
      const p12 = logisticSquash(logit);
      this.preApmProbability12 = p12;

      /** @type {int32} */
      const refined1 = this.apm1.refine(p12, this.history[0]);
      /** @type {int32} */
      const matchLength = this.matchModel.matchLength;
      /** @type {uint32} */
      const apm2Context = OpCodes.And32(OpCodes.Xor32(OpCodes.And32(this.history[0], 0xFF), matchLength > 0 ? 0x100 : 0), 0x1FF);
      /** @type {int32} */
      const refined2 = this.apm2.refine(refined1, apm2Context);

      /** @type {int32} */
      let blended = Math.floor((p12 + refined1 + 2 * refined2) / 4);
      blended = Math.max(1, Math.min(CM_PROB_SCALE - 1, blended));

      /** @type {int32} */
      const p16 = OpCodes.Shl32(blended, 4);
      return Math.max(1, Math.min(65535, p16));
    }

    /**
     * @param {int32} bit - Observed bit
     */
    update(bit) {
      for (let i = 0; i < this.orderModels.length; ++i) {
        /** @type {ContextModel} */
        const model = this.orderModels[i];
        model.update(this.contexts[i], bit);
      }

      this.wordModel.update(this.contexts[this.contexts.length - 1], bit);

      /** @type {int32} */
      const error = (bit === 1 ? CM_PROB_SCALE : 0) - this.preApmProbability12;
      for (let i = 0; i < CMIX_INPUT_COUNT; ++i) {
        /** @type {float64} */
        const grad = CMIX_LEARNING_RATE * error * this.stretched[i];
        this.weights[i] += Math.floor(grad / CM_PROB_SCALE);
      }

      this.apm1.update(bit);
      this.apm2.update(bit);
    }

    /**
     * @param {uint8} value - Finished byte
     */
    pushByte(value) {
      for (let k = this.history.length - 1; k > 0; --k) {
        this.history[k] = this.history[k - 1];
      }
      this.history[0] = OpCodes.And32(value, 0xFF);

      if (isLetterOrDigitByte(value)) {
        this.wordHash = mixHash(this.wordHash === 0 ? 0x811C9DC5 : this.wordHash, value);
      } else {
        this.wordHash = 0;
      }

      this.matchModel.append(OpCodes.And32(value, 0xFF));
    }

    /**
     * Stretch contributed by the match model for the bit being coded
     * @param {MatchModel} model - Match model
     * @param {int32} c0 - Partial current byte with its leading 1
     * @param {int32} bit - Position of the bit being predicted (7..0)
     * @returns {int32} Signed confidence, 0 without a usable match
     */
    static _matchStretch(model, c0, bit) {
      /** @type {int32} */
      const predicted = model.predictedByte;
      if (predicted < 0) {
        return 0;
      }

      /** @type {int32} */
      const placedBits = 7 - bit;
      if (placedBits > 0) {
        /** @type {int32} */
        const mask = OpCodes.Shl32(1, placedBits) - 1;
        /** @type {uint32} */
        const actualPrefix = OpCodes.And32(c0, mask);
        /** @type {uint32} */
        const predictedPrefix = OpCodes.And32(OpCodes.Shr32(predicted, 8 - placedBits), mask);
        if (actualPrefix !== predictedPrefix) {
          return 0;
        }
      }

      /** @type {uint32} */
      const predictedBit = OpCodes.And32(OpCodes.Shr32(predicted, bit), 1);
      /** @type {int32} */
      const matchLength = model.matchLength;
      /** @type {int32} */
      const confidence = Math.min(matchLength, 28) * 64;
      return predictedBit === 1 ? confidence : -confidence;
    }
  }

  // ===== MAIN CMIX ALGORITHM =====

  class CMIXAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "CMIX";
      this.description = "Reduced context-mixing model set (hashed orders 0,1,2,3,4,6 plus a word context and a match model, mixed by one logistic-domain mixer with two chained SSE stages). Ported to be byte-for-byte identical to CompressionWorkbench's reduced BB_Cmix reference block. NOT the full cmix ensemble (dozens of models, neural/LSTM sub-models, multiple mixer layers) - that reference is impractical to reproduce and this port intentionally matches only the documented reduced subset.";
      this.inventor = "Byron Knoll (concept); reduced clean-room reimplementation";
      this.year = 2013;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Context Mixing";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.CA;

      this.documentation = [
        new LinkItem("cmix Reference (byronknoll)", "https://github.com/byronknoll/cmix"),
        new LinkItem("cmix Overview", "https://www.byronknoll.com/cmix.html"),
        new LinkItem("Context Mixing - Wikipedia", "https://en.wikipedia.org/wiki/Context_mixing")
      ];

      this.references = [
        new LinkItem("cmix blog write-up", "http://byronknoll.blogspot.com/2014/01/cmix.html"),
        new LinkItem("Data Compression Explained (text)", "https://www.mattmahoney.net/dc/text.html")
      ];

      this.tests = [
        {
          text: "Empty data test",
          uri: "https://github.com/byronknoll/cmix",
          input: [],
          expected: [0, 0, 0, 0]
        },
        {
          text: "Single byte test",
          uri: "https://github.com/byronknoll/cmix",
          input: [65]
        },
        {
          text: "Mixed alphanumeric data",
          uri: "https://www.mattmahoney.net/dc/text.html",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog")
        },
        {
          text: "Repetitive text compression",
          uri: "https://www.byronknoll.com/cmix.html",
          input: OpCodes.AnsiToBytes("abcabcabcabcabcabc")
        }
      ];
    }

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - True to decompress
     * @returns {CMIXInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new CMIXInstance(this, isInverse);
    }
  }

  class CMIXInstance extends IAlgorithmInstance {
    /**
     * @param {CMIXAlgorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - True to decompress
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
    }

    /**
     * Compress or decompress the collected input
     * @returns {uint8[]} Output bytes
     */
    Result() {
      /** @type {uint8[]} */
      let result;
      if (this.isInverse) {
        result = this.decompress(this.inputBuffer);
      } else {
        result = this.compress(this.inputBuffer);
      }

      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;
      return result;
    }

    /**
     * @param {uint8[]} data - Input bytes
     * @returns {uint8[]} Length header and coded bits
     */
    compress(data) {
      /** @type {uint8[]} */
      const result = OpCodes.Unpack32LE(data.length);
      if (data.length === 0) {
        return result;
      }

      /** @type {ArithmeticEncoder} */
      const encoder = new ArithmeticEncoder();
      /** @type {CmixState} */
      const state = new CmixState(data.length);

      for (let i = 0; i < data.length; ++i) {
        /** @type {uint8} */
        const value = data[i];
        /** @type {int32} */
        let c0 = 1;
        for (let bit = 7; bit >= 0; --bit) {
          /** @type {int32} */
          const bitVal = OpCodes.And32(OpCodes.Shr32(value, bit), 1);
          /** @type {int32} */
          const prob1 = state.predict(c0, bit);
          encoder.encodeBit(bitVal, 65536 - prob1);
          state.update(bitVal);
          c0 = OpCodes.Or32(OpCodes.Shl32(c0, 1), bitVal);
        }
        state.pushByte(value);
      }

      encoder.finish();
      /** @type {uint8[]} */
      const coded = encoder.output;
      for (let k = 0; k < coded.length; k++) {
        result.push(coded[k]);
      }
      return result;
    }

    /**
     * @param {uint8[]} compressedData - Length header and coded bits
     * @returns {uint8[]} Decoded bytes
     */
    decompress(compressedData) {
      if (!compressedData || compressedData.length < 4) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      /** @type {uint32} */
      const size = OpCodes.Pack32LE(compressedData[0], compressedData[1], compressedData[2], compressedData[3]);
      /** @type {uint8[]} */
      const result = new Array(size);
      if (size === 0) {
        return result;
      }

      /** @type {uint8[]} */
      const rest = compressedData.slice(4);
      /** @type {ArithmeticDecoder} */
      const decoder = new ArithmeticDecoder(rest);
      /** @type {CmixState} */
      const state = new CmixState(size);

      for (let i = 0; i < size; ++i) {
        /** @type {int32} */
        let c0 = 1;
        for (let bit = 7; bit >= 0; --bit) {
          /** @type {int32} */
          const prob1 = state.predict(c0, bit);
          /** @type {int32} */
          const bitVal = decoder.decodeBit(65536 - prob1);
          state.update(bitVal);
          c0 = OpCodes.Or32(OpCodes.Shl32(c0, 1), bitVal);
        }
        /** @type {uint8} */
        const b = OpCodes.And32(c0, 0xFF);
        result[i] = b;
        state.pushByte(b);
      }

      return result;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new CMIXAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return {
    CMIXAlgorithm,
    CMIXInstance,
    ContextModel,
    Apm,
    Logistic,
    MatchModel,
    ArithmeticEncoder,
    ArithmeticDecoder
  };
}));
