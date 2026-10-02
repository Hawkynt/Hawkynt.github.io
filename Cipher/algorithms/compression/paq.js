/*
 * PAQ-style Context Mixing Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * A clean-room port of CompressionWorkbench's context-mixing building block
 * (BB_ContextMixing), byte-for-byte identical to its wire format.
 *
 * Scope honesty: the real PAQ family (Matt Mahoney et al.,
 * http://mattmahoney.net/dc/paq.html) combines dozens of specialised models -
 * word, sparse, indirect, record, PPM-style, plus image and audio detectors -
 * behind a large mixing network with several SSE/APM stages. This implements
 * NONE of that. It is the reduced lpaq-style primitive the reference block
 * documents: six hashed bit models over byte orders 0, 1, 2, 3, 4 and 6, a
 * single logistic-domain mixer trained by online gradient descent, one
 * adaptive probability map (SSE) keyed on the previous byte, and a binary
 * arithmetic coder.
 *
 * Method references (public specifications, no third-party source consulted):
 *   - M. Mahoney, "Data Compression Explained", http://mattmahoney.net/dc/dce.html
 *     (chapters on context mixing, logistic mixing, SSE/APM)
 *   - https://en.wikipedia.org/wiki/Context_mixing
 *
 * Wire format: [originalLength: uint32 LE] [arithmetic-coded bitstream,
 * bytes coded MSB-first]. Empty input yields the four header bytes only.
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

  // ===== LOGISTIC PRIMITIVES =====
  // stretch(p) = ln(p / (1 - p)) and squash(x) = 1 / (1 + e^-x), tabulated on a
  // 12-bit probability grid with the logit domain clamped to [-2047, 2047].

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

  // ===== REDUCED CONTEXT-MIXING MODEL SET =====

  /** @type {int32[]} */
  const CM_ORDERS = [0, 1, 2, 3, 4, 6];         // 0 = bit position only, k = previous k bytes
  /** @type {int32[]} */
  const CM_ORDER_TABLE_BITS = [10, 16, 18, 21, 22, 22];
  /** @type {int32} */
  const CM_WEIGHT_SHIFT = 16;                    // mixer weights are Q16 fixed point
  /** @type {int32} */
  const CM_LEARNING_RATE = 3;
  /** @type {int32} */
  const CM_APM_CONTEXTS = 256;                   // SSE keyed on the previous byte

  // The mixer weights are never clamped, so they (and the dot product) are
  // kept as exact float64 values, as the plain number arithmetic always was.

  class CmState {
    constructor() {
      /** @type {ContextModel[]} */
      this.models = [];
      for (let i = 0; i < CM_ORDERS.length; i++) {
        this.models.push(new ContextModel(CM_ORDER_TABLE_BITS[i]));
      }
      /** @type {int32} */
      this.modelCount = this.models.length;

      /** @type {float64} */
      const initial = Math.trunc(OpCodes.Shl32(1, CM_WEIGHT_SHIFT) / Math.max(1, this.modelCount));
      /** @type {float64[]} */
      this.weights = new Array(this.modelCount);
      /** @type {int32[]} */
      this.stretched = new Array(this.modelCount);
      /** @type {uint32[]} */
      this.contexts = new Array(this.modelCount);
      for (let i = 0; i < this.modelCount; i++) {
        this.weights[i] = initial;
        this.stretched[i] = 0;
        this.contexts[i] = 0;
      }

      /** @type {Apm} */
      this.apm = new Apm(CM_APM_CONTEXTS);
      /** @type {int32[]} */
      this.history = new Array(8);
      for (let i = 0; i < 8; i++) {
        this.history[i] = 0;
      }
      /** @type {int32} */
      this.lastProbability12 = 0;
    }

    /**
     * @param {int32} c0 - Partial current byte with its leading 1
     */
    computeContexts(c0) {
      for (let i = 0; i < this.modelCount; ++i) {
        /** @type {int32} */
        const order = CM_ORDERS[i];
        // Seed with the order itself so different orders never share a slot,
        // then fold in the prior bytes and the partial current byte.
        /** @type {uint32} */
        let h = OpCodes.Mul32(order, 0x9E3779B1);
        for (let k = 0; k < order; ++k) {
          h = mixHash(h, this.history[k]);
        }
        h = mixHash(h, c0);
        this.contexts[i] = OpCodes.And32(h, 0x7FFFFFFF);
      }
    }

    /**
     * @returns {int32} Probability of a one bit, scaled by 65536
     */
    predict() {
      /** @type {float64} */
      let dot = 0;
      for (let i = 0; i < this.modelCount; ++i) {
        /** @type {ContextModel} */
        const model = this.models[i];
        /** @type {int32} */
        const p = model.predict(this.contexts[i]);
        /** @type {int32} */
        const s = logisticStretch(p);
        this.stretched[i] = s;
        dot += this.weights[i] * s;
      }

      /** @type {int32} */
      const logit = Math.floor(dot / 65536);
      /** @type {int32} */
      const p12 = logisticSquash(logit);
      this.lastProbability12 = p12;

      /** @type {int32} */
      const mixed16 = Math.max(1, Math.min(65535, OpCodes.Shl32(p12, 16 - CM_PROB_BITS)));
      /** @type {int32} */
      const mixed12 = OpCodes.Shr32(mixed16, 16 - CM_PROB_BITS);

      /** @type {int32} */
      const refined12 = this.apm.refine(mixed12, this.history[0]);
      /** @type {int32} */
      let blended12 = Math.floor((mixed12 + 3 * refined12) / 4);
      blended12 = Math.max(1, Math.min(CM_PROB_SCALE - 1, blended12));

      /** @type {int32} */
      const p16 = OpCodes.Shl32(blended12, 16 - CM_PROB_BITS);
      return Math.max(1, Math.min(65535, p16));
    }

    /**
     * @param {int32} bit - Observed bit
     */
    update(bit) {
      /** @type {int32} */
      const error = (bit === 1 ? CM_PROB_SCALE : 0) - this.lastProbability12;
      for (let i = 0; i < this.modelCount; ++i) {
        /** @type {float64} */
        const grad = CM_LEARNING_RATE * error * this.stretched[i];
        this.weights[i] += Math.floor(grad / CM_PROB_SCALE);
      }
      for (let i = 0; i < this.modelCount; ++i) {
        /** @type {ContextModel} */
        const model = this.models[i];
        model.update(this.contexts[i], bit);
      }

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

  // ===== MAIN ALGORITHM =====

  class PAQAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "PAQ (Context Mixing)";
      this.description = "Reduced lpaq-style context-mixing primitive: six hashed bit models over byte orders 0, 1, 2, 3, 4 and 6, blended by a single logistic-domain mixer trained by online gradient descent, refined by one adaptive probability map (SSE) keyed on the previous byte, and entropy-coded with a 30-bit binary arithmetic coder. Byte-for-byte identical to CompressionWorkbench's BB_ContextMixing reference block. This is deliberately NOT the full PAQ ensemble - the real PAQ8/cmix model sets add word, sparse, indirect, record and media-specific models behind a much larger mixing network, none of which is implemented here.";
      this.inventor = "Matt Mahoney (context mixing / PAQ family)";
      this.year = 2002;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Context Mixing";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("PAQ - Wikipedia", "https://en.wikipedia.org/wiki/PAQ"),
        new LinkItem("Data Compression Explained (context mixing, SSE)", "http://mattmahoney.net/dc/dce.html"),
        new LinkItem("PAQ Data Compression Programs", "https://www.mattmahoney.net/dc/paq.html")
      ];

      this.references = [
        new LinkItem("Context Mixing - Wikipedia", "https://en.wikipedia.org/wiki/Context_mixing"),
        new LinkItem("Hutter Prize Competition", "http://prize.hutter1.net/"),
        new LinkItem("Adaptive Weighing of Context Models (Mahoney, 2005)", "https://www.cs.fit.edu/~mmahoney/compression/cs200516.pdf")
      ];

      // Wire format: [originalLength uint32 LE][arithmetic-coded bitstream].
      // Expected bytes reproduce CompressionWorkbench's BB_ContextMixing block.
      this.tests = [
        {
          text: "Empty input - header only",
          uri: "http://mattmahoney.net/dc/dce.html",
          input: [],
          expected: [0, 0, 0, 0]
        },
        {
          text: "Single byte 0x41",
          uri: "http://mattmahoney.net/dc/dce.html",
          input: [65],
          expected: [1, 0, 0, 0, 65, 128]
        },
        {
          text: "Repeated English pangram (4x)",
          uri: "https://en.wikipedia.org/wiki/Context_mixing",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. "),
          expected: [180, 0, 0, 0, 116, 111, 186, 47, 246, 188, 142, 184, 20, 171, 11, 158, 32, 198, 204, 182, 123, 189, 98, 153, 60, 245, 73, 176, 102, 245, 63, 202, 16, 102, 193, 23, 104, 198, 128, 74, 238, 198, 11, 74, 60, 98]
        },
        {
          text: "256 identical bytes",
          uri: "https://www.mattmahoney.net/dc/paq.html",
          input: (function() { const a = new Array(256); a.fill(0x61); return a; })(),
          expected: [0, 1, 0, 0, 97, 169, 189, 244]
        },
        {
          text: "All 256 byte values in order",
          uri: "https://www.mattmahoney.net/dc/paq.html",
          input: (function() { const a = new Array(256); for (let i = 0; i < 256; ++i) a[i] = i; return a; })(),
          expected: [0, 1, 0, 0, 0, 35, 84, 143, 131, 170, 252, 208, 73, 97, 44, 35, 82, 248, 231, 219, 32, 102, 19, 124, 119, 180, 84, 106, 254, 53, 223, 95, 98, 158, 176, 168, 181, 171, 10, 108, 127, 142, 135, 76, 37, 225, 255, 236, 203, 205, 120, 89, 144, 10, 253, 216, 145, 148, 171, 21, 238, 0, 25, 45, 206, 224, 82, 2, 91, 188, 42, 120, 33, 75, 103, 73, 170, 55, 186, 37, 96, 102, 224, 23, 13, 87, 251, 66, 4, 62, 22, 55, 165, 25, 184, 222, 247, 10, 2, 104, 131, 59, 107, 6, 98, 243, 77, 129, 226, 130, 43, 27, 212, 218, 78, 23, 29, 162, 10, 226, 53, 223, 225, 141, 124, 131, 63, 51, 165, 64, 34, 219, 91, 226, 220, 68, 237, 94, 31, 149, 100, 161, 5, 39, 221, 106, 237, 78, 228, 50, 213, 53, 26, 85, 142, 71, 185, 47, 148, 82, 186, 31, 212, 25, 67, 52, 139, 77, 88, 229, 56, 146, 63, 131, 41, 189, 213, 90, 224, 115, 93, 15, 130, 60, 150, 127, 162, 106, 190, 199, 42, 208, 132, 45, 33, 171, 149, 9, 1, 66, 233, 165, 16, 93, 75, 67, 148, 234, 66, 95, 86, 213, 153, 59, 175, 194, 54, 214, 148, 38, 245, 45, 165, 57, 92, 153, 37, 249, 84, 31, 3, 113, 27, 96, 66, 153, 203, 112, 121, 45, 106, 59, 208, 140]
        }
      ];
    }

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - True to decompress
     * @returns {PAQInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new PAQInstance(this, isInverse);
    }
  }

  class PAQInstance extends IAlgorithmInstance {
    /**
     * @param {PAQAlgorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - True to decompress
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse; // true = decompress, false = compress
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
     * @param {uint8[]} data - Input bytes (a missing array counts as empty)
     * @returns {uint8[]} Length header and coded bits
     */
    compress(data) {
      /** @type {uint8[]} */
      let input = data;
      if (!input) {
        input = [];
      }
      /** @type {uint8[]} */
      const result = OpCodes.Unpack32LE(input.length);
      if (input.length === 0) {
        return result;
      }

      /** @type {ArithmeticEncoder} */
      const encoder = new ArithmeticEncoder();
      /** @type {CmState} */
      const state = new CmState();

      for (let i = 0; i < input.length; ++i) {
        /** @type {uint8} */
        const value = input[i];
        /** @type {int32} */
        let c0 = 1; // partial byte with a leading 1 sentinel
        for (let bit = 7; bit >= 0; --bit) {
          /** @type {int32} */
          const bitVal = OpCodes.And32(OpCodes.Shr32(value, bit), 1);
          state.computeContexts(c0);
          /** @type {int32} */
          const prob1 = state.predict();
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
     * @param {uint8[]} data - Length header and coded bits
     * @returns {uint8[]} Decoded bytes
     */
    decompress(data) {
      /** @type {uint8[]} */
      let bytes = data;
      if (!bytes) {
        bytes = [];
      }
      if (bytes.length < 4) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      /** @type {uint32} */
      const size = OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
      /** @type {uint8[]} */
      const result = new Array(size);
      if (size === 0) {
        return result;
      }

      /** @type {uint8[]} */
      const payload = bytes.slice(4);
      /** @type {ArithmeticDecoder} */
      const decoder = new ArithmeticDecoder(payload);
      /** @type {CmState} */
      const state = new CmState();

      for (let i = 0; i < size; ++i) {
        /** @type {int32} */
        let c0 = 1;
        for (let bit = 7; bit >= 0; --bit) {
          state.computeContexts(c0);
          /** @type {int32} */
          const prob1 = state.predict();
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

  const algorithmInstance = new PAQAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return {
    PAQAlgorithm,
    PAQInstance,
    ContextModel,
    Apm,
    Logistic,
    ArithmeticEncoder,
    ArithmeticDecoder
  };
}));
