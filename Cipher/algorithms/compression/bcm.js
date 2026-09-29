/*
 * BCM (Block Context Mixing) Compression Algorithm
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * A clean-room port of CompressionWorkbench's reduced BCM building block
 * (BB_Bcm): a Burrows-Wheeler Transform followed by a compact logistic-domain
 * context-mixing back end (orders 0-2 over the sorted string, one mixer, one
 * adaptive probability map / SSE stage), entropy-coded with a binary
 * arithmetic coder. Modelled after Ilya Muravyov's BCM ("Big brother of
 * BZip2"); this is a reduced, from-specification reimplementation matching
 * the CompressionWorkbench reference exactly, not the full reference BCM.
 *
 * Wire format: [originalLength: uint32 LE] [bwtPrimaryIndex: uint32 LE]
 * [arithmetic-coded bitstream of the BWT output, MSB-first per byte]
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

  // ===== BURROWS-WHEELER TRANSFORM (matches Compression.Core.Transforms.BurrowsWheelerTransform) =====

  /**
   * Result of the forward transform
   */
  class BwtResult {
    /**
     * @param {uint8[]} transformed - Last column of the sorted rotations
     * @param {int32} index - Row of the original rotation
     */
    constructor(transformed, index) {
      /** @type {uint8[]} */
      this.transformed = transformed;
      /** @type {int32} */
      this.index = index;
    }
  }

  /**
   * Compare the rotations of data starting at a and b
   * @param {uint8[]} data - Bytes
   * @param {int32} a - First rotation start
   * @param {int32} b - Second rotation start
   * @returns {int32} Negative, zero or positive as rotation a sorts before, with or after b
   */
  function compareRotations(data, a, b) {
    /** @type {int32} */
    const n = data.length;
    for (let k = 0; k < n; ++k) {
      /** @type {int32} */
      const da = data[(a + k) % n];
      /** @type {int32} */
      const db = data[(b + k) % n];
      if (da !== db) {
        return da - db;
      }
    }
    return 0;
  }

  /**
   * Stable merge sort of rotation starts. Fully-tied rotations (periodic
   * input) keep their ascending index order, exactly as the stable
   * Array.prototype.sort did.
   * @param {uint8[]} data - Bytes
   * @param {int32[]} sa - Rotation starts, sorted in place
   */
  function sortRotations(data, sa) {
    /** @type {int32} */
    const n = sa.length;
    /** @type {int32[]} */
    let src = sa.slice();
    /** @type {int32[]} */
    let dst = new Array(n);
    for (let width = 1; width < n; width *= 2) {
      for (let lo = 0; lo < n; lo += 2 * width) {
        /** @type {int32} */
        const mid = Math.min(lo + width, n);
        /** @type {int32} */
        const hi = Math.min(lo + 2 * width, n);
        /** @type {int32} */
        let i = lo;
        /** @type {int32} */
        let j = mid;
        /** @type {int32} */
        let k = lo;
        while (i < mid && j < hi) {
          if (compareRotations(data, src[j], src[i]) < 0) {
            dst[k++] = src[j++];
          } else {
            dst[k++] = src[i++];
          }
        }
        while (i < mid) {
          dst[k++] = src[i++];
        }
        while (j < hi) {
          dst[k++] = src[j++];
        }
      }
      /** @type {int32[]} */
      const swap = src;
      src = dst;
      dst = swap;
    }
    for (let i = 0; i < n; i++) {
      sa[i] = src[i];
    }
  }

  class BurrowsWheelerTransform {
    /**
     * @param {uint8[]} data - Input bytes
     * @returns {BwtResult} Last column and original row
     */
    static forward(data) {
      /** @type {int32} */
      const n = data.length;
      if (n === 0) {
        /** @type {uint8[]} */
        const none = [];
        return new BwtResult(none, 0);
      }

      /** @type {int32[]} */
      const sa = new Array(n);
      for (let i = 0; i < n; ++i) {
        sa[i] = i;
      }

      // Full cyclic-rotation comparison sort, stable, so fully-tied rotations
      // (periodic input) keep their original relative (ascending index) order.
      sortRotations(data, sa);

      /** @type {uint8[]} */
      const transformed = new Array(n);
      /** @type {int32} */
      let index = 0;
      for (let i = 0; i < n; ++i) {
        if (sa[i] === 0) {
          index = i;
          transformed[i] = data[n - 1];
        } else {
          transformed[i] = data[sa[i] - 1];
        }
      }
      return new BwtResult(transformed, index);
    }

    /**
     * @param {uint8[]} data - Last column
     * @param {int32} index - Row of the original rotation
     * @returns {uint8[]} Original bytes
     */
    static inverse(data, index) {
      /** @type {int32} */
      const n = data.length;
      /** @type {uint8[]} */
      const result = new Array(n);
      if (n === 0) {
        return result;
      }

      /** @type {int32[]} */
      const count = new Int32Array(256);
      for (let i = 0; i < n; ++i) {
        ++count[data[i]];
      }

      /** @type {int32[]} */
      const cumulative = new Int32Array(256);
      /** @type {int32} */
      let sum = 0;
      for (let c = 0; c < 256; ++c) {
        cumulative[c] = sum;
        sum += count[c];
      }

      /** @type {int32[]} */
      const lfMap = new Array(n);
      /** @type {int32[]} */
      const tempCount = cumulative.slice();
      for (let i = 0; i < n; ++i) {
        lfMap[i] = tempCount[data[i]];
        ++tempCount[data[i]];
      }

      /** @type {int32} */
      let idx = index;
      for (let i = n - 1; i >= 0; --i) {
        result[i] = data[idx];
        idx = lfMap[idx];
      }
      return result;
    }
  }

  // ===== BCM MODEL STATE (orders 0-2 over the BWT output) =====

  /** @type {int32[]} */
  const BCM_ORDERS = [0, 1, 2];
  /** @type {int32[]} */
  const BCM_ORDER_TABLE_BITS = [9, 16, 20];
  /** @type {int32} */
  const BCM_APM_CONTEXTS = 256;

  class BcmState {
    constructor() {
      /** @type {ContextModel[]} */
      this.models = [];
      for (let i = 0; i < BCM_ORDERS.length; i++) {
        this.models.push(new ContextModel(BCM_ORDER_TABLE_BITS[i]));
      }
      /** @type {ContextMixer} */
      this.mixer = new ContextMixer(this.models);
      /** @type {Apm} */
      this.apm = new Apm(BCM_APM_CONTEXTS);
      /** @type {int32[]} */
      this.history = [0, 0, 0, 0];
    }

    /** @returns {int32} Number of context models */
    get modelCount() {
      return this.models.length;
    }

    /**
     * @param {uint32[]} contexts - Context per model, filled in
     * @param {int32} c0 - Partial current byte with its leading 1
     */
    computeContexts(contexts, c0) {
      for (let i = 0; i < this.models.length; ++i) {
        /** @type {int32} */
        const order = BCM_ORDERS[i];
        /** @type {uint32} */
        let h = OpCodes.Mul32(order, 0x9E3779B1);
        for (let k = 0; k < order; ++k) {
          h = mixHash(h, this.history[k]);
        }
        h = mixHash(h, c0);
        contexts[i] = OpCodes.And32(h, 0x7FFFFFFF);
      }
    }

    /**
     * @param {uint32[]} contexts - Context per model
     * @returns {int32} Probability of a one bit, scaled by 65536
     */
    predict(contexts) {
      /** @type {int32} */
      const mixed16 = this.mixer.predict(contexts);
      /** @type {int32} */
      const mixed12 = OpCodes.Shr32(mixed16, 4);
      /** @type {int32} */
      const refined12 = this.apm.refine(mixed12, this.history[0]);
      /** @type {int32} */
      let blended12 = OpCodes.Shr32(mixed12 + refined12, 1);
      blended12 = Math.max(1, Math.min(CM_PROB_SCALE - 1, blended12));
      /** @type {int32} */
      const p16 = OpCodes.Shl32(blended12, 4);
      return Math.max(1, Math.min(65535, p16));
    }

    /**
     * @param {uint32[]} contexts - Context per model
     * @param {int32} bit - Observed bit
     */
    update(contexts, bit) {
      this.mixer.update(contexts, bit);
      this.apm.update(bit);
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

  // ===== MAIN BCM ALGORITHM =====

  class BCMCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BCM (Block Context Mixing)";
      this.description = "Burrows-Wheeler Transform with a compact order-0..2 context-mixing back end, BCM-style. Ported to be byte-for-byte identical to CompressionWorkbench's reduced BB_Bcm reference block.";
      this.inventor = "Ilya Muravyov (concept); reduced clean-room reimplementation";
      this.year = 2010;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "BWT + Context Mixing";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Documentation with credible sources
      this.documentation = [
        new LinkItem("BCM Reference (encode84)", "https://github.com/encode84/bcm"),
        new LinkItem("Burrows-Wheeler Transform", "https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform"),
        new LinkItem("Context Mixing", "https://en.wikipedia.org/wiki/Context_mixing")
      ];

      this.references = [
        new LinkItem("BCM Compression Analysis", "https://encode.su/threads/1738-bcm-Big-brother-of-bzip2"),
        new LinkItem("Burrows-Wheeler SRC-RR-124", "https://www.hpl.hp.com/techreports/Compaq-DEC/SRC-RR-124.pdf"),
        new LinkItem("Data Compression Explained", "http://mattmahoney.net/dc/dce.html")
      ];

      // Round-trip test vectors (compression algorithms use round-trip testing)
      this.tests = [
        {
          text: "Empty data test",
          uri: "https://github.com/encode84/bcm",
          input: [],
          expected: [0, 0, 0, 0]
        },
        {
          text: "Single byte test",
          uri: "https://github.com/encode84/bcm",
          input: [65]
        },
        {
          text: "Simple repeated pattern",
          uri: "https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform",
          input: OpCodes.AnsiToBytes("AAABBBCCC")
        },
        {
          text: "Classic banana example",
          uri: "https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform",
          input: OpCodes.AnsiToBytes("banana")
        },
        {
          text: "Mixed alphanumeric data",
          uri: "http://mattmahoney.net/dc/dce.html",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog")
        },
        {
          text: "Repetitive text compression",
          uri: "https://encode.su/threads/1738-bcm-Big-brother-of-bzip2",
          input: OpCodes.AnsiToBytes("abcabcabcabcabcabc")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {BCMInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new BCMInstance(this, isInverse);
    }
  }

  /**
 * BCM cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class BCMInstance extends IAlgorithmInstance {
    /**
     * @param {BCMCompression} algorithm - Parent algorithm
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
     * @returns {uint8[]} Length, BWT index and coded bits
     */
    compress(data) {
      /** @type {uint8[]} */
      const header = OpCodes.Unpack32LE(data.length);
      if (data.length === 0) {
        return header;
      }

      /** @type {BwtResult} */
      const bwt = BurrowsWheelerTransform.forward(data);
      /** @type {uint8[]} */
      const indexHeader = OpCodes.Unpack32LE(bwt.index);

      /** @type {ArithmeticEncoder} */
      const encoder = new ArithmeticEncoder();
      /** @type {BcmState} */
      const state = new BcmState();
      /** @type {int32} */
      const modelCount = state.modelCount;
      /** @type {uint32[]} */
      const contexts = new Array(modelCount);

      for (let k = 0; k < bwt.transformed.length; k++) {
        /** @type {uint8} */
        const value = bwt.transformed[k];
        /** @type {int32} */
        let c0 = 1;
        for (let bit = 7; bit >= 0; --bit) {
          /** @type {int32} */
          const bitVal = OpCodes.And32(OpCodes.Shr32(value, bit), 1);
          state.computeContexts(contexts, c0);
          /** @type {int32} */
          const prob1 = state.predict(contexts);
          encoder.encodeBit(bitVal, 65536 - prob1);
          state.update(contexts, bitVal);
          c0 = OpCodes.Or32(OpCodes.Shl32(c0, 1), bitVal);
        }
        state.pushByte(value);
      }

      encoder.finish();
      /** @type {uint8[]} */
      const output = header.concat(indexHeader);
      for (let k = 0; k < encoder.output.length; k++) {
        output.push(encoder.output[k]);
      }
      return output;
    }

    /**
     * @param {uint8[]} compressedData - Length, BWT index and coded bits
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
      if (size === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      if (compressedData.length < 8) {
        throw new Error('Invalid BCM compressed data: too short');
      }

      /** @type {uint32} */
      const index = OpCodes.Pack32LE(compressedData[4], compressedData[5], compressedData[6], compressedData[7]);
      /** @type {uint8[]} */
      const rest = compressedData.slice(8);

      /** @type {ArithmeticDecoder} */
      const decoder = new ArithmeticDecoder(rest);
      /** @type {BcmState} */
      const state = new BcmState();
      /** @type {int32} */
      const modelCount = state.modelCount;
      /** @type {uint32[]} */
      const contexts = new Array(modelCount);

      /** @type {uint8[]} */
      const bwt = new Array(size);
      for (let i = 0; i < size; ++i) {
        /** @type {int32} */
        let c0 = 1;
        for (let bit = 7; bit >= 0; --bit) {
          state.computeContexts(contexts, c0);
          /** @type {int32} */
          const prob1 = state.predict(contexts);
          /** @type {int32} */
          const bitVal = decoder.decodeBit(65536 - prob1);
          state.update(contexts, bitVal);
          c0 = OpCodes.Or32(OpCodes.Shl32(c0, 1), bitVal);
        }
        /** @type {uint8} */
        const b = OpCodes.And32(c0, 0xFF);
        bwt[i] = b;
        state.pushByte(b);
      }

      /** @type {uint8[]} */
      const restored = BurrowsWheelerTransform.inverse(bwt, index);
      return restored;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new BCMCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return {
    BCMCompression,
    BCMInstance,
    BurrowsWheelerTransform,
    ContextModel,
    ContextMixer,
    Apm,
    Logistic,
    ArithmeticEncoder,
    ArithmeticDecoder
  };
}));
