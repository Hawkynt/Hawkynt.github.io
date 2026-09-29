/*
 * MCM (Modified Context Mixing) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * A clean-room port of CompressionWorkbench's reduced MCM building block
 * (BB_Mcm): a two-level mixing network. Three model groups (local: orders
 * 0-2, medium: orders 3-4, wide: order 6 plus a sparse skip-1 context) are
 * each combined by their own context mixer; the three group predictions are
 * combined by a top-level mixer and refined by two chained adaptive
 * probability map (SSE) stages before binary arithmetic coding.
 *
 * Modelled after Mathieu Chartier's MCM (https://github.com/mathieuchartier/mcm).
 * This is a reduced, from-specification reimplementation matching the
 * CompressionWorkbench reference exactly, not the full reference MCM.
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
   * @returns {int32[]} squash(x) on the 12-bit grid for every logit x
   */
  function buildSquashTable() {
    /** @type {int32} */
    const span = CM_MAX_STRETCH - CM_MIN_STRETCH + 1;
    /** @type {int32[]} */
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
   * @param {int32[]} squash - Squash table
   * @returns {int32[]} Its inverse on the 12-bit grid
   */
  function buildStretchTable(squash) {
    // Invert squash so the two are exact mutual inverses on the 12-bit grid.
    /** @type {int32[]} */
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

  /** @type {int32[]} */
  const CM_SQUASH_TABLE = buildSquashTable();
  /** @type {int32[]} */
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

  // ===== CONTEXT MIXER =====
  // The mixer weights are never clamped, so they (and the dot product) are
  // kept as exact float64 values, as the plain number arithmetic always was.

  class ContextMixer {
    /**
     * @param {ContextModel[]} models - Models mixed
     */
    constructor(models) {
      /** @type {ContextModel[]} */
      this.models = models;
      /** @type {int32} */
      this.numModels = models.length;
      /** @type {float64} */
      const initial = Math.trunc(65536 / Math.max(1, this.numModels));
      /** @type {float64[]} */
      this.weights = new Array(this.numModels);
      /** @type {int32[]} */
      this.stretched = new Array(this.numModels);
      for (let i = 0; i < this.numModels; i++) {
        this.weights[i] = initial;
        this.stretched[i] = 0;
      }
      /** @type {int32} */
      this.lastProbability = 0;
    }

    /**
     * @param {uint32[]} contexts - Context per model
     * @returns {int32} Probability of a one bit, scaled by 65536
     */
    predict(contexts) {
      /** @type {float64} */
      let dot = 0;
      for (let i = 0; i < this.numModels; ++i) {
        /** @type {ContextModel} */
        const model = this.models[i];
        /** @type {int32} */
        const p = model.predict(contexts[i]);
        /** @type {int32} */
        const s = logisticStretch(p);
        this.stretched[i] = s;
        dot += this.weights[i] * s;
      }
      /** @type {int32} */
      const logit = Math.floor(dot / 65536);
      /** @type {int32} */
      const p12 = logisticSquash(logit);
      this.lastProbability = p12;
      /** @type {int32} */
      const p16 = OpCodes.Shl32(p12, 4);
      return Math.max(1, Math.min(65535, p16));
    }

    /**
     * @param {uint32[]} contexts - Context per model
     * @param {int32} bit - Observed bit
     */
    update(contexts, bit) {
      /** @type {int32} */
      const error = (bit === 1 ? CM_PROB_SCALE : 0) - this.lastProbability;
      for (let i = 0; i < this.numModels; ++i) {
        /** @type {float64} */
        const grad = 3 * error * this.stretched[i];
        this.weights[i] += Math.floor(grad / CM_PROB_SCALE);
      }
      for (let i = 0; i < this.numModels; ++i) {
        /** @type {ContextModel} */
        const model = this.models[i];
        model.update(contexts[i], bit);
      }
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

  // ===== MCM TWO-LEVEL MIXING NETWORK =====

  /** @type {int32[]} */
  const MCM_LOCAL_ORDERS = [0, 1, 2];
  /** @type {int32[]} */
  const MCM_MEDIUM_ORDERS = [3, 4];
  /** @type {int32} */
  const MCM_WEIGHT_SHIFT = 16;
  /** @type {int32} */
  const MCM_LEARNING_RATE = 3;
  /** @type {uint32} */
  const MCM_SPARSE_SEED = 0xC2B2AE35;

  // The top-level network weights are never clamped, so they (and the dot
  // product) are kept as exact float64 values, as the plain numbers were.

  class McmState {
    constructor() {
      /** @type {ContextModel[]} */
      this.local = [new ContextModel(9), new ContextModel(16), new ContextModel(20)];
      /** @type {ContextModel[]} */
      this.medium = [new ContextModel(21), new ContextModel(22)];
      /** @type {ContextModel[]} */
      this.wide = [new ContextModel(22), new ContextModel(18)]; // order-6, sparse(skip-1)

      /** @type {ContextMixer} */
      this.localMixer = new ContextMixer(this.local);
      /** @type {ContextMixer} */
      this.mediumMixer = new ContextMixer(this.medium);
      /** @type {ContextMixer} */
      this.wideMixer = new ContextMixer(this.wide);

      /** @type {uint32[]} */
      this.localCtx = [0, 0, 0];
      /** @type {uint32[]} */
      this.mediumCtx = [0, 0];
      /** @type {uint32[]} */
      this.wideCtx = [0, 0];

      /** @type {float64} */
      const initialWeight = Math.trunc(OpCodes.Shl32(1, MCM_WEIGHT_SHIFT) / 3);
      /** @type {float64[]} */
      this.networkWeights = [initialWeight, initialWeight, initialWeight];
      /** @type {int32[]} */
      this.networkStretch = [0, 0, 0];
      /** @type {int32} */
      this.preApmProbability12 = 0;

      /** @type {Apm} */
      this.apm1 = new Apm(256);
      /** @type {Apm} */
      this.apm2 = new Apm(OpCodes.Shl32(1, 12));

      /** @type {int32[]} */
      this.history = [0, 0, 0, 0, 0, 0, 0, 0];
    }

    /**
     * @param {int32} order - Number of history bytes hashed
     * @param {int32} c0 - Partial current byte with its leading 1
     * @returns {uint32} 31-bit context hash
     */
    _hashOrder(order, c0) {
      /** @type {uint32} */
      let h = OpCodes.Mul32(order, 0x9E3779B1);
      for (let k = 0; k < order; ++k) {
        h = mixHash(h, this.history[k]);
      }
      h = mixHash(h, c0);
      return OpCodes.And32(h, 0x7FFFFFFF);
    }

    /**
     * @param {int32} c0 - Partial current byte with its leading 1
     */
    _computeContexts(c0) {
      for (let i = 0; i < MCM_LOCAL_ORDERS.length; ++i) {
        this.localCtx[i] = this._hashOrder(MCM_LOCAL_ORDERS[i], c0);
      }

      for (let i = 0; i < MCM_MEDIUM_ORDERS.length; ++i) {
        this.mediumCtx[i] = this._hashOrder(MCM_MEDIUM_ORDERS[i], c0);
      }

      this.wideCtx[0] = this._hashOrder(6, c0);
      // Sparse context: byte two positions back, skipping the immediate predecessor.
      /** @type {uint32} */
      let h = mixHash(MCM_SPARSE_SEED, this.history[1]);
      h = mixHash(h, c0);
      this.wideCtx[1] = OpCodes.And32(h, 0x7FFFFFFF);
    }

    /**
     * @param {int32} c0 - Partial current byte with its leading 1
     * @returns {int32} Probability of a one bit, scaled by 65536
     */
    predict(c0) {
      this._computeContexts(c0);

      /** @type {int32} */
      const pLocal16 = this.localMixer.predict(this.localCtx);
      /** @type {int32} */
      const pMedium16 = this.mediumMixer.predict(this.mediumCtx);
      /** @type {int32} */
      const pWide16 = this.wideMixer.predict(this.wideCtx);

      this.networkStretch[0] = logisticStretch(OpCodes.Shr32(pLocal16, 4));
      this.networkStretch[1] = logisticStretch(OpCodes.Shr32(pMedium16, 4));
      this.networkStretch[2] = logisticStretch(OpCodes.Shr32(pWide16, 4));

      /** @type {float64} */
      let dot = 0;
      for (let i = 0; i < 3; ++i) {
        dot += this.networkWeights[i] * this.networkStretch[i];
      }

      /** @type {int32} */
      const logit = Math.floor(dot / 65536);
      /** @type {int32} */
      const p12 = logisticSquash(logit);
      this.preApmProbability12 = p12;

      /** @type {int32} */
      const refined1 = this.apm1.refine(p12, this.history[0]);
      /** @type {uint32} */
      const apm2Context = OpCodes.And32(OpCodes.Xor32(OpCodes.Shl32(this.history[0], 4), OpCodes.Shr32(this.history[1], 4)), 0xFFF);
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
      this.localMixer.update(this.localCtx, bit);
      this.mediumMixer.update(this.mediumCtx, bit);
      this.wideMixer.update(this.wideCtx, bit);

      /** @type {int32} */
      const error = (bit === 1 ? CM_PROB_SCALE : 0) - this.preApmProbability12;
      for (let i = 0; i < 3; ++i) {
        /** @type {float64} */
        const grad = MCM_LEARNING_RATE * error * this.networkStretch[i];
        this.networkWeights[i] += Math.floor(grad / CM_PROB_SCALE);
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
    }
  }

  // ===== MAIN MCM ALGORITHM =====

  class MCMCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "MCM";
      this.description = "Two-level context-mixing network: local (orders 0-2), medium (orders 3-4) and wide (order 6 + sparse skip-1) model groups, each mixed by their own mixer, combined by a top-level mixer and refined by two chained SSE stages. Ported to be byte-for-byte identical to CompressionWorkbench's reduced BB_Mcm reference block.";
      this.inventor = "Mathieu Chartier (concept); reduced clean-room reimplementation";
      this.year = 2013;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Context Mixing";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.CA;

      this.documentation = [
        new LinkItem("MCM Reference (mathieuchartier)", "https://github.com/mathieuchartier/mcm"),
        new LinkItem("MCM Discussion Thread", "https://encode.su/threads/2121-MCM-new-compressor-by-Mathieu-Chartier"),
        new LinkItem("Context Mixing - Wikipedia", "https://en.wikipedia.org/wiki/Context_mixing")
      ];

      this.references = [
        new LinkItem("MCM Source Repository", "https://github.com/mathieuchartier/mcm"),
        new LinkItem("Data Compression Explained", "http://mattmahoney.net/dc/dce.html")
      ];

      this.tests = [
        {
          text: "Empty data test",
          uri: "https://github.com/mathieuchartier/mcm",
          input: [],
          expected: [0, 0, 0, 0]
        },
        {
          text: "Single byte test",
          uri: "https://github.com/mathieuchartier/mcm",
          input: [65]
        },
        {
          text: "Mixed alphanumeric data",
          uri: "http://mattmahoney.net/dc/dce.html",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog")
        },
        {
          text: "Repetitive text compression",
          uri: "https://encode.su/threads/2121-MCM-new-compressor-by-Mathieu-Chartier",
          input: OpCodes.AnsiToBytes("abcabcabcabcabcabc")
        }
      ];
    }

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - True to decompress
     * @returns {MCMInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new MCMInstance(this, isInverse);
    }
  }

  class MCMInstance extends IAlgorithmInstance {
    /**
     * @param {MCMCompression} algorithm - Parent algorithm
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
      /** @type {McmState} */
      const state = new McmState();

      for (let i = 0; i < data.length; ++i) {
        /** @type {uint8} */
        const value = data[i];
        /** @type {int32} */
        let c0 = 1;
        for (let bit = 7; bit >= 0; --bit) {
          /** @type {int32} */
          const bitVal = OpCodes.And32(OpCodes.Shr32(value, bit), 1);
          /** @type {int32} */
          const prob1 = state.predict(c0);
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
      const result = new Array();
      if (size === 0) {
        return result;
      }

      /** @type {uint8[]} */
      const rest = compressedData.slice(4);
      /** @type {ArithmeticDecoder} */
      const decoder = new ArithmeticDecoder(rest);
      /** @type {McmState} */
      const state = new McmState();

      for (let i = 0; i < size; ++i) {
        /** @type {int32} */
        let c0 = 1;
        for (let bit = 7; bit >= 0; --bit) {
          /** @type {int32} */
          const prob1 = state.predict(c0);
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

  const algorithmInstance = new MCMCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return {
    MCMCompression,
    MCMInstance,
    ContextModel,
    ContextMixer,
    Apm,
    Logistic,
    ArithmeticEncoder,
    ArithmeticDecoder
  };
}));
