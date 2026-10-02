/*
 * CSC (Context Sorting Compression) Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * A clean-room port of CompressionWorkbench's reduced CSC building block
 * (BB_Csc): LZ77 parsing (hash-chain match finder, 32 KiB window, 3-258 byte
 * matches) whose four channels - match/literal flag, literal bytes, match
 * length, match distance - are entropy-coded with logistic-domain context
 * mixing over a single shared binary arithmetic coder. Every token starts
 * with a flag bit predicted by two hashed models over the last one/two
 * flags. Literal bytes are coded bit-by-bit with an order-0/order-1 mixer
 * (context = previous output byte) refined by an SSE stage. Length and
 * distance are coded through order-0 adaptive bit-trees on the same
 * ContextModel/ArithmeticEncoder primitives.
 *
 * Modelled after Fu Siyuan's CSC (https://github.com/fusiyuan2010/CSC).
 * This is a reduced, from-specification reimplementation matching the
 * CompressionWorkbench reference exactly, not the full reference CSC.
 *
 * Wire format: [originalLength: uint32 LE] [arithmetic-coded token stream:
 * flag bit, then literal byte OR (length, distance), interleaved in order]
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

  // ===== LZ77 HASH-CHAIN MATCH FINDER (matches Compression.Core.Dictionary.MatchFinders.HashChainMatchFinder) =====

  /**
   * Match found by the hash-chain search
   */
  class Lz77Match {
    /**
     * @param {int32} distance - Distance back to the match source (0 when none)
     * @param {int32} length - Match length (0 when none)
     */
    constructor(distance, length) {
      /** @type {int32} */
      this.distance = distance;
      /** @type {int32} */
      this.length = length;
    }
  }

  class HashChainMatchFinder {
    /**
     * @param {int32} windowSize - Size of the chain ring (a power of two)
     * @param {int32} [maxChainDepth=128] - Maximum chain nodes visited per search
     */
    constructor(windowSize, maxChainDepth = 128) {
      /** @type {int32} */
      this.maxChainDepth = maxChainDepth;
      /** @type {int32} */
      const hashSize = OpCodes.Shl32(1, 15);
      /** @type {int32} */
      this.hashMask = hashSize - 1;
      /** @type {int32[]} */
      this.head = new Int32Array(hashSize).fill(-1);
      /** @type {int32[]} */
      this.prev = new Int32Array(windowSize); // defaults to 0, matching C#'s int[] default
    }

    /**
     * @param {uint8[]} data - Bytes
     * @param {int32} position - Position of the three hashed bytes
     * @returns {uint32} Bucket
     */
    _computeHash(data, position) {
      /** @type {uint32} */
      const h1 = OpCodes.Shl32(data[position], 10);
      /** @type {uint32} */
      const h2 = OpCodes.Shl32(data[position + 1], 5);
      return OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(h1, h2), data[position + 2]), this.hashMask);
    }

    /**
     * Find the longest match at position and insert the position
     * @param {uint8[]} data - Bytes
     * @param {int32} position - Position to match
     * @param {int32} maxDistance - Largest allowed distance
     * @param {int32} maxLength - Largest match length
     * @param {int32} minLength - Smallest useful match length
     * @returns {Lz77Match} Best match, or distance 0 and length 0
     */
    findMatch(data, position, maxDistance, maxLength, minLength) {
      if (position + 2 >= data.length) {
        return new Lz77Match(0, 0);
      }

      /** @type {int32} */
      let bestDistance = 0;
      /** @type {int32} */
      let bestLength = 0;

      /** @type {uint32} */
      const hash = this._computeHash(data, position);
      /** @type {int32} */
      let candidate = this.head[hash];
      /** @type {int32} */
      let chainCount = 0;
      /** @type {int32} */
      const windowStart = Math.max(0, position - maxDistance);
      /** @type {int32} */
      const mask = this.prev.length - 1;

      while (candidate >= windowStart && chainCount < this.maxChainDepth) {
        if (candidate === position) {
          candidate = this.prev[OpCodes.And32(candidate, mask)];
          ++chainCount;
          continue;
        }
        /** @type {int32} */
        const distance = position - candidate;
        /** @type {int32} */
        const limit = Math.min(maxLength, Math.min(data.length - position, data.length - candidate));
        if (bestLength === 0 || (bestLength < limit && data[candidate + bestLength] === data[position + bestLength])) {
          /** @type {int32} */
          const length = HashChainMatchFinder._matchLength(data, candidate, position, limit);
          if (length >= minLength && length > bestLength) {
            bestLength = length;
            bestDistance = distance;
            if (bestLength >= maxLength) {
              break;
            }
          }
        }

        candidate = this.prev[OpCodes.And32(candidate, mask)];
        if (candidate <= windowStart) {
          break;
        }
        ++chainCount;
      }

      this.prev[OpCodes.And32(position, mask)] = this.head[hash];
      this.head[hash] = position;

      if (bestLength >= minLength) {
        return new Lz77Match(bestDistance, bestLength);
      }
      return new Lz77Match(0, 0);
    }

    /**
     * Insert a position into the chains without searching
     * @param {uint8[]} data - Bytes
     * @param {int32} position - Position to insert
     */
    insertPosition(data, position) {
      if (position + 2 >= data.length) {
        return;
      }
      /** @type {uint32} */
      const hash = this._computeHash(data, position);
      /** @type {int32} */
      const mask = this.prev.length - 1;
      this.prev[OpCodes.And32(position, mask)] = this.head[hash];
      this.head[hash] = position;
    }

    /**
     * @param {uint8[]} data - Bytes
     * @param {int32} pos1 - First position
     * @param {int32} pos2 - Second position
     * @param {int32} limit - Largest length compared
     * @returns {int32} Number of equal bytes
     */
    static _matchLength(data, pos1, pos2, limit) {
      /** @type {int32} */
      let matched = 0;
      while (matched < limit && data[pos1 + matched] === data[pos2 + matched]) {
        ++matched;
      }
      return matched;
    }
  }

  // ===== LZ77 PARSER (matches Compression.Core.Dictionary.Lz77.Lz77Compressor) =====

  /**
   * One parsed token: a literal byte or a (distance, length) match
   */
  class Lz77Token {
    /**
     * @param {boolean} isLiteral - True for a literal
     * @param {uint8} literal - Literal byte (0 for a match)
     * @param {int32} distance - Match distance (0 for a literal)
     * @param {int32} length - Match length (0 for a literal)
     */
    constructor(isLiteral, literal, distance, length) {
      /** @type {boolean} */
      this.isLiteral = isLiteral;
      /** @type {uint8} */
      this.literal = literal;
      /** @type {int32} */
      this.distance = distance;
      /** @type {int32} */
      this.length = length;
    }
  }

  /**
   * @param {uint8[]} data - Input bytes
   * @param {HashChainMatchFinder} matchFinder - Match finder
   * @param {int32} windowSize - Largest match distance
   * @param {int32} maxMatchLength - Largest match length
   * @param {int32} minMatchLength - Smallest match length
   * @returns {Lz77Token[]} Greedy token sequence
   */
  function lz77Parse(data, matchFinder, windowSize, maxMatchLength, minMatchLength) {
    /** @type {Lz77Token[]} */
    const tokens = [];
    /** @type {int32} */
    let position = 0;
    while (position < data.length) {
      /** @type {Lz77Match} */
      const match = matchFinder.findMatch(data, position, windowSize, maxMatchLength, minMatchLength);

      if (match.length >= minMatchLength) {
        tokens.push(new Lz77Token(false, 0, match.distance, match.length));
        for (let i = 1; i < match.length; ++i) {
          matchFinder.insertPosition(data, position + i);
        }
        position += match.length;
      } else {
        tokens.push(new Lz77Token(true, data[position], 0, 0));
        ++position;
      }
    }
    return tokens;
  }

  // ===== CSC MODEL STATE =====

  /** @type {int32} */
  const CSC_WINDOW_SIZE = 32768;
  /** @type {int32} */
  const CSC_MAX_MATCH_LENGTH = 258;
  /** @type {int32} */
  const CSC_MIN_MATCH_LENGTH = 3;

  class CscState {
    constructor() {
      // Flag channel: mixes order-1 (last flag) and order-2 (last two flags) contexts.
      /** @type {ContextModel[]} */
      this.flagModels = [new ContextModel(2), new ContextModel(4)];
      /** @type {ContextMixer} */
      this.flagMixer = new ContextMixer(this.flagModels);
      /** @type {uint32} */
      this.flagHistory = 0;

      // Literal channel: order-0 and order-1 (previous output byte) contexts.
      /** @type {ContextModel[]} */
      this.literalModels = [new ContextModel(9), new ContextModel(16)];
      /** @type {ContextMixer} */
      this.literalMixer = new ContextMixer(this.literalModels);
      /** @type {Apm} */
      this.literalApm = new Apm(256);
      /** @type {uint8} */
      this.previousByte = 0;

      /** @type {uint32[]} */
      this.flagContexts = [0, 0];
      /** @type {uint32[]} */
      this.literalContexts = [0, 0];

      // Length/distance channels: order-0 adaptive bit-trees (context = c0 directly).
      /** @type {ContextModel} */
      this.lengthModel = new ContextModel(9);
      /** @type {ContextModel} */
      this.distanceModel = new ContextModel(17);
    }

    /**
     * @param {uint8} value - Byte copied by a match
     */
    pushLiteralByte(value) {
      this.previousByte = value;
    }

    /**
     * @param {ArithmeticEncoder} encoder - Output coder
     * @param {int32} bit - 1 for a match, 0 for a literal
     */
    encodeFlag(encoder, bit) {
      this._computeFlagContexts();
      /** @type {int32} */
      const prob1 = this._predictFlag();
      encoder.encodeBit(bit, 65536 - prob1);
      this._updateFlag(bit);
    }

    /**
     * @param {ArithmeticDecoder} decoder - Input coder
     * @returns {int32} 1 for a match, 0 for a literal
     */
    decodeFlag(decoder) {
      this._computeFlagContexts();
      /** @type {int32} */
      const prob1 = this._predictFlag();
      /** @type {int32} */
      const bit = decoder.decodeBit(65536 - prob1);
      this._updateFlag(bit);
      return bit;
    }

    _computeFlagContexts() {
      this.flagContexts[0] = OpCodes.And32(this.flagHistory, 0x1);
      this.flagContexts[1] = OpCodes.And32(this.flagHistory, 0x3);
    }

    /**
     * @returns {int32} Probability of a match flag, scaled by 65536
     */
    _predictFlag() {
      /** @type {int32} */
      const mixed16 = this.flagMixer.predict(this.flagContexts);
      return Math.max(1, Math.min(65535, mixed16));
    }

    /**
     * @param {int32} bit - Observed flag
     */
    _updateFlag(bit) {
      this.flagMixer.update(this.flagContexts, bit);
      this.flagHistory = OpCodes.And32(OpCodes.Or32(OpCodes.Shl32(this.flagHistory, 1), bit), 0x3);
    }

    /**
     * @param {ArithmeticEncoder} encoder - Output coder
     * @param {uint8} value - Literal byte
     */
    encodeLiteral(encoder, value) {
      /** @type {int32} */
      let c0 = 1;
      for (let bit = 7; bit >= 0; --bit) {
        /** @type {int32} */
        const bitVal = OpCodes.And32(OpCodes.Shr32(value, bit), 1);
        this._computeLiteralContexts(c0);
        /** @type {int32} */
        const prob1 = this._predictLiteral();
        encoder.encodeBit(bitVal, 65536 - prob1);
        this._updateLiteral(bitVal);
        c0 = OpCodes.Or32(OpCodes.Shl32(c0, 1), bitVal);
      }
      this.previousByte = value;
    }

    /**
     * @param {ArithmeticDecoder} decoder - Input coder
     * @returns {uint8} Literal byte
     */
    decodeLiteral(decoder) {
      /** @type {int32} */
      let c0 = 1;
      for (let bit = 7; bit >= 0; --bit) {
        this._computeLiteralContexts(c0);
        /** @type {int32} */
        const prob1 = this._predictLiteral();
        /** @type {int32} */
        const bitVal = decoder.decodeBit(65536 - prob1);
        this._updateLiteral(bitVal);
        c0 = OpCodes.Or32(OpCodes.Shl32(c0, 1), bitVal);
      }
      /** @type {uint8} */
      const b = OpCodes.And32(c0, 0xFF);
      this.previousByte = b;
      return b;
    }

    /**
     * @param {int32} c0 - Partial current byte with its leading 1
     */
    _computeLiteralContexts(c0) {
      this.literalContexts[0] = OpCodes.And32(c0, 0x1FF);
      this.literalContexts[1] = OpCodes.And32(OpCodes.Xor32(OpCodes.Mul32(this.previousByte, 0x9E3779B1), c0), 0xFFFF);
    }

    /**
     * @returns {int32} Probability of a one bit, scaled by 65536
     */
    _predictLiteral() {
      /** @type {int32} */
      const mixed16 = this.literalMixer.predict(this.literalContexts);
      /** @type {int32} */
      const mixed12 = OpCodes.Shr32(mixed16, 4);
      /** @type {int32} */
      const refined12 = this.literalApm.refine(mixed12, this.previousByte);
      /** @type {int32} */
      let blended12 = OpCodes.Shr32(mixed12 + refined12, 1);
      blended12 = Math.max(1, Math.min(CM_PROB_SCALE - 1, blended12));
      /** @type {int32} */
      const p16 = OpCodes.Shl32(blended12, 4);
      return Math.max(1, Math.min(65535, p16));
    }

    /**
     * @param {int32} bit - Observed bit
     */
    _updateLiteral(bit) {
      this.literalMixer.update(this.literalContexts, bit);
      this.literalApm.update(bit);
    }

    /**
     * @param {ArithmeticEncoder} encoder - Output coder
     * @param {int32} value - Match length minus the minimum (8 bits)
     */
    encodeLength(encoder, value) {
      CscState._encodeOrderZero(encoder, this.lengthModel, value, 8);
    }

    /**
     * @param {ArithmeticDecoder} decoder - Input coder
     * @returns {int32} Match length minus the minimum
     */
    decodeLength(decoder) {
      /** @type {int32} */
      const value = CscState._decodeOrderZero(decoder, this.lengthModel, 8);
      return value;
    }

    /**
     * @param {ArithmeticEncoder} encoder - Output coder
     * @param {int32} value - Match distance minus one (16 bits)
     */
    encodeDistance(encoder, value) {
      CscState._encodeOrderZero(encoder, this.distanceModel, value, 16);
    }

    /**
     * @param {ArithmeticDecoder} decoder - Input coder
     * @returns {int32} Match distance minus one
     */
    decodeDistance(decoder) {
      /** @type {int32} */
      const value = CscState._decodeOrderZero(decoder, this.distanceModel, 16);
      return value;
    }

    /**
     * @param {ArithmeticEncoder} encoder - Output coder
     * @param {ContextModel} model - Bit-tree model
     * @param {int32} value - Value to code
     * @param {int32} numBits - Number of bits, most significant first
     */
    static _encodeOrderZero(encoder, model, value, numBits) {
      /** @type {int32} */
      let c0 = 1;
      for (let bit = numBits - 1; bit >= 0; --bit) {
        /** @type {int32} */
        const bitVal = OpCodes.And32(OpCodes.Shr32(value, bit), 1);
        /** @type {int32} */
        const p12 = model.predict(c0);
        /** @type {int32} */
        let prob1 = OpCodes.Shl32(p12, 4);
        prob1 = Math.max(1, Math.min(65535, prob1));
        encoder.encodeBit(bitVal, 65536 - prob1);
        model.update(c0, bitVal);
        c0 = OpCodes.Or32(OpCodes.Shl32(c0, 1), bitVal);
      }
    }

    /**
     * @param {ArithmeticDecoder} decoder - Input coder
     * @param {ContextModel} model - Bit-tree model
     * @param {int32} numBits - Number of bits, most significant first
     * @returns {int32} Decoded value
     */
    static _decodeOrderZero(decoder, model, numBits) {
      /** @type {int32} */
      let c0 = 1;
      for (let bit = numBits - 1; bit >= 0; --bit) {
        /** @type {int32} */
        const p12 = model.predict(c0);
        /** @type {int32} */
        let prob1 = OpCodes.Shl32(p12, 4);
        prob1 = Math.max(1, Math.min(65535, prob1));
        /** @type {int32} */
        const bitVal = decoder.decodeBit(65536 - prob1);
        model.update(c0, bitVal);
        c0 = OpCodes.Or32(OpCodes.Shl32(c0, 1), bitVal);
      }
      /** @type {int32} */
      const leadingOne = OpCodes.Shl32(1, numBits);
      return c0 - leadingOne;
    }
  }

  // ===== MAIN CSC ALGORITHM =====

  class CSCCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "CSC (Context Sorting Compression)";
      this.description = "LZ77 parsing (hash-chain match finder, 32 KiB window, 3-258 byte matches) whose flag/literal/length/distance channels are entropy-coded with logistic-domain context mixing over a shared binary arithmetic coder. Ported to be byte-for-byte identical to CompressionWorkbench's reduced BB_Csc reference block.";
      this.inventor = "Fu Siyuan (concept); reduced clean-room reimplementation";
      this.year = 2012;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "LZ77 + Context Mixing";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.CN;

      this.documentation = [
        new LinkItem("CSC Reference (fusiyuan2010)", "https://github.com/fusiyuan2010/CSC"),
        new LinkItem("LZ77 and LZ78 - Wikipedia", "https://en.wikipedia.org/wiki/LZ77_and_LZ78"),
        new LinkItem("Context Mixing Notes", "https://mattmahoney.net/dc/dce.html#Section_43")
      ];

      this.references = [
        new LinkItem("CSC Source Repository", "https://github.com/fusiyuan2010/CSC"),
        new LinkItem("Data Compression Explained", "http://mattmahoney.net/dc/dce.html")
      ];

      this.tests = [
        {
          text: "Empty data test",
          uri: "https://github.com/fusiyuan2010/CSC",
          input: [],
          expected: [0, 0, 0, 0]
        },
        {
          text: "Single byte test",
          uri: "https://github.com/fusiyuan2010/CSC",
          input: [65]
        },
        {
          text: "Mixed alphanumeric data",
          uri: "http://mattmahoney.net/dc/dce.html",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog")
        },
        {
          text: "Repetitive text compression",
          uri: "https://en.wikipedia.org/wiki/LZ77_and_LZ78",
          input: OpCodes.AnsiToBytes("abcabcabcabcabcabc")
        }
      ];
    }

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - True to decompress
     * @returns {CSCInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new CSCInstance(this, isInverse);
    }
  }

  class CSCInstance extends IAlgorithmInstance {
    /**
     * @param {CSCCompression} algorithm - Parent algorithm
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
     * @returns {uint8[]} Length header and coded tokens
     */
    compress(data) {
      /** @type {uint8[]} */
      const result = OpCodes.Unpack32LE(data.length);
      if (data.length === 0) {
        return result;
      }

      /** @type {HashChainMatchFinder} */
      const matchFinder = new HashChainMatchFinder(CSC_WINDOW_SIZE);
      /** @type {Lz77Token[]} */
      const tokens = lz77Parse(data, matchFinder, CSC_WINDOW_SIZE, CSC_MAX_MATCH_LENGTH, CSC_MIN_MATCH_LENGTH);

      /** @type {ArithmeticEncoder} */
      const encoder = new ArithmeticEncoder();
      /** @type {CscState} */
      const state = new CscState();

      /** @type {int32} */
      let position = 0;
      for (let t = 0; t < tokens.length; ++t) {
        /** @type {Lz77Token} */
        const token = tokens[t];
        state.encodeFlag(encoder, token.isLiteral ? 0 : 1);

        if (token.isLiteral) {
          state.encodeLiteral(encoder, token.literal);
          ++position;
        } else {
          state.encodeLength(encoder, token.length - CSC_MIN_MATCH_LENGTH);
          state.encodeDistance(encoder, token.distance - 1);
          for (let i = 0; i < token.length; ++i) {
            state.pushLiteralByte(data[position + i]);
          }
          position += token.length;
        }
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
     * @param {uint8[]} compressedData - Length header and coded tokens
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
      /** @type {CscState} */
      const state = new CscState();

      /** @type {int32} */
      let position = 0;
      while (position < size) {
        /** @type {int32} */
        const isMatch = state.decodeFlag(decoder);

        if (isMatch === 0) {
          /** @type {uint8} */
          const literal = state.decodeLiteral(decoder);
          result[position++] = literal;
        } else {
          /** @type {int32} */
          const lengthCode = state.decodeLength(decoder);
          /** @type {int32} */
          const length = lengthCode + CSC_MIN_MATCH_LENGTH;
          /** @type {int32} */
          const distanceCode = state.decodeDistance(decoder);
          /** @type {int32} */
          const distance = distanceCode + 1;
          /** @type {int32} */
          const src = position - distance;
          for (let i = 0; i < length; ++i) {
            /** @type {uint8} */
            const b = result[src + i];
            result[position++] = b;
            state.pushLiteralByte(b);
          }
        }
      }

      return result;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new CSCCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return {
    CSCCompression,
    CSCInstance,
    ContextModel,
    ContextMixer,
    Apm,
    Logistic,
    HashChainMatchFinder,
    ArithmeticEncoder,
    ArithmeticDecoder
  };
}));
