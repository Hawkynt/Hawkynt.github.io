/*
 * Neural Network Compression (Educational) Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * An online-trained two-layer neural predictor (a genuine multi-layer
 * perceptron with a nonlinear tanh hidden layer and backpropagation) drives
 * a binary arithmetic coder bit-by-bit -- an NNCP-style neural sequence
 * predictor. The network learns the statistics of the data as it
 * compresses, and the decoder replays the identical learning trajectory
 * (same fixed pseudo-random initial weights, same update order), so no
 * weights are transmitted.
 *
 * Byte-identical to CompressionWorkbench's BB_Neural.
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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== LOGISTIC TABLES (fast table-based logistic transforms, PAQ/lpaq-style) =====
  // Probabilities are 12-bit fixed point in [0, 4095] (i.e. p/4096); the stretch
  // domain is the integer logit clamped to [-2047, 2047]. Both tables are
  // precomputed once so the per-bit hot path uses only array indexing.

  /** @type {int32} */
  const PROBABILITY_BITS = 12;
  /** @type {int32} */
  const PROBABILITY_SCALE = OpCodes.Shl32(1, PROBABILITY_BITS); // 4096
  /** @type {int32} */
  const MIN_STRETCH = -2047;
  /** @type {int32} */
  const MAX_STRETCH = 2047;

  // .NET's Math.Round(double) defaults to MidpointRounding.ToEven (banker's
  // rounding), unlike JS's Math.round (always rounds .5 up). Reproduced
  // exactly here since the squash table is exercised across many logits and
  // an off-by-one at a single midpoint would desync the arithmetic coder.
  /**
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
    const span = MAX_STRETCH - MIN_STRETCH + 1;
    /** @type {int16[]} */
    const table = new Int16Array(span);
    for (let i = 0; i < span; ++i) {
      /** @type {float64} */
      const x = (MIN_STRETCH + i) / 256.0; // logit in natural units
      /** @type {float64} */
      const p = 1.0 / (1.0 + Math.exp(-x));
      /** @type {int32} */
      const scaled = roundHalfEven(p * PROBABILITY_SCALE);
      table[i] = Math.max(1, Math.min(PROBABILITY_SCALE - 1, scaled));
    }
    return table;
  }

  /**
   * @param {int16[]} squashTable - Squash table
   * @returns {int16[]} Its inverse on the 12-bit grid
   */
  function buildStretchTable(squashTable) {
    /** @type {int16[]} */
    const table = new Int16Array(PROBABILITY_SCALE);
    /** @type {int32} */
    let pos = 0;
    for (let x = MIN_STRETCH; x <= MAX_STRETCH; ++x) {
      /** @type {int32} */
      const p = squashTable[x - MIN_STRETCH];
      while (pos <= p && pos < PROBABILITY_SCALE) {
        table[pos++] = x;
      }
    }
    while (pos < PROBABILITY_SCALE) {
      table[pos++] = MAX_STRETCH;
    }
    return table;
  }

  /** @type {int16[]} */
  const SQUASH_TABLE = buildSquashTable();
  /** @type {int16[]} */
  const STRETCH_TABLE = buildStretchTable(SQUASH_TABLE);

  /**
   * @param {int32} logit - Logit
   * @returns {int32} Probability of a one bit on the 12-bit grid
   */
  function squash(logit) {
    if (logit <= MIN_STRETCH) {
      return 1;
    }
    if (logit >= MAX_STRETCH) {
      return PROBABILITY_SCALE - 1;
    }
    return SQUASH_TABLE[logit - MIN_STRETCH];
  }

  /**
   * @param {int32} probability - Probability on the 12-bit grid
   * @returns {int32} Logit
   */
  function stretch(probability) {
    /** @type {int32} */
    const p = Math.max(0, Math.min(PROBABILITY_SCALE - 1, probability));
    return STRETCH_TABLE[p];
  }

  // ===== CONTEXT MODEL =====
  // A single context model predicting P(bit=1) given a context hash. Each
  // context maps to an adaptive 12-bit probability state (upper bits) plus a
  // saturating hit count (lower 10 bits) that slows the adaptation rate as a
  // context is seen more often. Pure integer arithmetic -- deterministic
  // across platforms.

  class ContextModel {
    /**
     * @param {int32} tableBits - log2 of the table size
     */
    constructor(tableBits) {
      /** @type {int32} */
      const tableSize = OpCodes.Shl32(1, tableBits); // constant per model, computed once
      /** @type {int32} */
      this.tableMask = tableSize - 1;
      /** @type {int32[]} */
      this.state = new Int32Array(tableSize).fill(OpCodes.Shl32(PROBABILITY_SCALE / 2, 10));
    }

    /**
     * @param {uint32} context - Context hash (31 bits)
     * @returns {int32} Probability of a one bit on the 12-bit grid
     */
    predict(context) {
      /** @type {uint32} */
      const idx = OpCodes.And32(context, this.tableMask);
      /** @type {int32} */
      const p = OpCodes.Shr32(this.state[idx], 10);
      return Math.max(1, Math.min(PROBABILITY_SCALE - 1, p));
    }

    /**
     * @param {uint32} context - Context hash (31 bits)
     * @param {int32} bit - Observed bit
     */
    update(context, bit) {
      /** @type {uint32} */
      const idx = OpCodes.And32(context, this.tableMask);
      /** @type {int32} */
      const packed = this.state[idx];
      /** @type {int32} */
      let probability = OpCodes.Shr32(packed, 10);
      /** @type {int32} */
      let count = OpCodes.And32(packed, 1023);

      /** @type {int32} */
      const rate = count + 2;
      /** @type {int32} */
      const target = bit === 1 ? PROBABILITY_SCALE : 0;
      probability += Math.trunc((target - probability) / rate); // C# int division truncates toward zero
      probability = Math.max(1, Math.min(PROBABILITY_SCALE - 1, probability));

      if (count < 1023) {
        ++count;
      }

      this.state[idx] = OpCodes.Or32(OpCodes.Shl32(probability, 10), count);
    }
  }

  // ===== NEURAL PREDICTOR =====
  // Bank of bit models: orders 0..3 over the recent byte history, plus two
  // hashed sparse contexts. A fully-connected hidden layer (tanh) with
  // backprop mixes their stretched predictions.

  /** @type {int32[]} */
  const ORDERS = [0, 1, 2, 3];
  /** @type {int32[]} */
  const ORDER_TABLE_BITS = [10, 16, 18, 20];
  /** @type {int32[][]} */
  const SPARSE_PATTERNS = [[1, 3], [2, 4]];
  /** @type {int32} */
  const SPARSE_TABLE_BITS = 18;
  /** @type {int32} */
  const HIDDEN_UNITS = 12;
  /** @type {float64} */
  const LEARNING_RATE = 0.06;

  /**
   * @param {uint32} h - Hash so far
   * @param {uint32} x - Value folded in
   * @returns {uint32} New hash
   */
  function mix32(h, x) {
    /** @type {uint32} */
    let t = OpCodes.Add32(x, 0x9E3779B1);
    t = OpCodes.Add32(t, OpCodes.Shl32(h, 6));
    t = OpCodes.Add32(t, OpCodes.Shr32(h, 2));
    return OpCodes.Xor32(h, t);
  }

  /**
   * Deterministic weight generator (32-bit LCG) for the initial weights
   */
  class WeightGenerator {
    /**
     * @param {uint32} seed - Initial LCG state
     */
    constructor(seed) {
      /** @type {uint32} */
      this.value = seed;
    }

    /**
     * @param {float64} scale - Largest magnitude
     * @returns {float64} Next weight in [-scale, scale)
     */
    next(scale) {
      /** @type {uint32} */
      const newState = OpCodes.Add32(OpCodes.Mul32(this.value, 1664525), 1013904223);
      this.value = newState;
      /** @type {float64} */
      const unit = OpCodes.Shr32(newState, 8) / 16777216.0; // [0,1)
      return (unit * 2.0 - 1.0) * scale;
    }
  }

  class NeuralPredictor {
    constructor() {
      /** @type {int32} */
      const orderModels = ORDERS.length;
      /** @type {int32} */
      const sparseModels = SPARSE_PATTERNS.length;
      /** @type {int32} */
      const modelCount = orderModels + sparseModels;

      /** @type {ContextModel[]} */
      this.models = [];
      for (let i = 0; i < orderModels; ++i) {
        this.models.push(new ContextModel(ORDER_TABLE_BITS[i]));
      }
      for (let i = 0; i < sparseModels; ++i) {
        this.models.push(new ContextModel(SPARSE_TABLE_BITS));
      }

      /** @type {int32} */
      this.inputCount = modelCount + 1; // + bias
      /** @type {int32[]} */
      this.history = [0, 0, 0, 0, 0, 0, 0, 0];

      /** @type {float64[][]} */
      this.w1 = [];
      for (let j = 0; j < HIDDEN_UNITS; ++j) {
        this.w1.push(new Float64Array(this.inputCount));
      }
      /** @type {float64[]} */
      this.w2 = new Float64Array(HIDDEN_UNITS);

      /** @type {float64[]} */
      this.inputs = new Float64Array(this.inputCount);
      /** @type {float64[]} */
      this.hidden = new Float64Array(HIDDEN_UNITS);
      /** @type {uint32[]} */
      this.contexts = new Array(modelCount);
      for (let i = 0; i < modelCount; ++i) {
        this.contexts[i] = 0;
      }
      /** @type {float64} */
      this.lastProbability = 0;

      // Symmetry-breaking initialisation: a fixed, deterministic pseudo-random
      // fill, replayed identically by the decoder.
      /** @type {WeightGenerator} */
      const rng = new WeightGenerator(0x12345678);
      for (let j = 0; j < HIDDEN_UNITS; ++j) {
        /** @type {float64[]} */
        const row = this.w1[j];
        for (let i = 0; i < this.inputCount; ++i) {
          /** @type {float64} */
          const w = rng.next(0.20);
          row[i] = w;
        }
        /** @type {float64} */
        const w2 = rng.next(0.20);
        this.w2[j] = w2;
      }
    }

    /**
     * @param {int32} partialByte - Partial current byte with its leading 1
     * @returns {int32} Probability of a one bit, scaled by 65536
     */
    predict(partialByte) {
      this._computeContexts(partialByte);

      for (let i = 0; i < this.models.length; ++i) {
        /** @type {ContextModel} */
        const model = this.models[i];
        /** @type {int32} */
        const p12 = model.predict(this.contexts[i]);
        /** @type {int32} */
        const s = stretch(p12);
        this.inputs[i] = s / 256.0;
      }
      this.inputs[this.inputCount - 1] = 1.0; // bias input

      for (let j = 0; j < HIDDEN_UNITS; ++j) {
        /** @type {float64[]} */
        const row = this.w1[j];
        /** @type {float64} */
        let sum = 0.0;
        for (let i = 0; i < this.inputCount; ++i) {
          sum += row[i] * this.inputs[i];
        }
        this.hidden[j] = Math.tanh(sum);
      }

      /** @type {float64} */
      let y = 0.0;
      for (let j = 0; j < HIDDEN_UNITS; ++j) {
        y += this.w2[j] * this.hidden[j];
      }

      /** @type {float64} */
      const p = 1.0 / (1.0 + Math.exp(-y));
      this.lastProbability = p;

      /** @type {int32} */
      const p16 = Math.trunc(p * 65536.0);
      return Math.max(1, Math.min(65535, p16));
    }

    /**
     * @param {int32} bit - Observed bit
     */
    update(bit) {
      /** @type {float64} */
      const delta = bit - this.lastProbability;
      /** @type {float64} */
      const lr = LEARNING_RATE;

      /** @type {float64[]} */
      const hiddenDelta = new Float64Array(HIDDEN_UNITS);
      for (let j = 0; j < HIDDEN_UNITS; ++j) {
        /** @type {float64} */
        const h = this.hidden[j];
        hiddenDelta[j] = delta * this.w2[j] * (1.0 - h * h);
      }

      for (let j = 0; j < HIDDEN_UNITS; ++j) {
        this.w2[j] += lr * delta * this.hidden[j];
      }

      for (let j = 0; j < HIDDEN_UNITS; ++j) {
        /** @type {float64} */
        const dj = lr * hiddenDelta[j];
        /** @type {float64[]} */
        const row = this.w1[j];
        for (let i = 0; i < this.inputCount; ++i) {
          row[i] += dj * this.inputs[i];
        }
      }

      for (let i = 0; i < this.models.length; ++i) {
        /** @type {ContextModel} */
        const model = this.models[i];
        model.update(this.contexts[i], bit);
      }
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

    /**
     * @param {int32} partialByte - Partial current byte with its leading 1
     */
    _computeContexts(partialByte) {
      /** @type {int32} */
      const orderModels = ORDERS.length;

      for (let i = 0; i < orderModels; ++i) {
        /** @type {int32} */
        const order = ORDERS[i];
        /** @type {uint32} */
        let h = OpCodes.Mul32(order, 0x9E3779B1);
        for (let k = 0; k < order; ++k) {
          h = mix32(h, this.history[k]);
        }
        h = mix32(h, partialByte);
        this.contexts[i] = OpCodes.And32(h, 0x7FFFFFFF);
      }

      for (let s = 0; s < SPARSE_PATTERNS.length; ++s) {
        /** @type {int32[]} */
        const pattern = SPARSE_PATTERNS[s];
        /** @type {uint32} */
        let h = OpCodes.Add32(0xA5A5A5A5, OpCodes.Mul32(s, 0x85EBCA77));
        for (let p = 0; p < pattern.length; ++p) {
          h = mix32(h, this.history[pattern[p]]);
        }
        h = mix32(h, partialByte);
        this.contexts[orderModels + s] = OpCodes.And32(h, 0x7FFFFFFF);
      }
    }
  }

  // ===== BINARY ARITHMETIC CODER =====
  // Bit-level arithmetic coder with 30-bit precision (fits safely in an
  // unsigned 32-bit range). The bounds stay below 2^30, but range * prob0
  // needs up to 46 bits: it is computed in float64 (exact), as the plain
  // number arithmetic was.

  /** @type {int32} */
  const PRECISION_BITS = 30;
  /** @type {int32} */
  const FULL_RANGE = 1073741824;  // 2^30
  /** @type {int32} */
  const HALF_RANGE = 536870912;   // 2^29
  /** @type {int32} */
  const QUARTER_RANGE = 268435456; // 2^28

  class ArithmeticEncoder {
    constructor() {
      /** @type {uint8[]} */
      this.output = [];
      /** @type {int32} */
      this.low = 0;
      /** @type {int32} */
      this.high = FULL_RANGE - 1;
      /** @type {int32} */
      this.pendingBits = 0;
      /** @type {uint32} */
      this.bitBuffer = 0;
      /** @type {int32} */
      this.bitsInBuffer = 0;
    }

    /**
     * @param {int32} bit - Bit to code
     * @param {int32} prob0 - Probability of a zero bit, scaled by 65536
     */
    encodeBit(bit, prob0) {
      /** @type {float64} */
      const range = this.high - this.low + 1;
      /** @type {int32} */
      const mid = this.low + Math.floor((range * prob0) / 65536) - 1;

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
      this._writeBitAndPending(this.low >= QUARTER_RANGE ? 1 : 0);

      if (this.bitsInBuffer > 0) {
        this.bitBuffer = OpCodes.Shl32(this.bitBuffer, 8 - this.bitsInBuffer);
        this.output.push(OpCodes.And32(this.bitBuffer, 0xFF));
      }
    }

    /** Shift out settled bits (with underflow handling) */
    _normalize() {
      for (;;) {
        if (this.high < HALF_RANGE) {
          this._writeBitAndPending(0);
        } else if (this.low >= HALF_RANGE) {
          this._writeBitAndPending(1);
          this.low -= HALF_RANGE;
          this.high -= HALF_RANGE;
        } else if (this.low >= QUARTER_RANGE && this.high < 3 * QUARTER_RANGE) {
          ++this.pendingBits;
          this.low -= QUARTER_RANGE;
          this.high -= QUARTER_RANGE;
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
     * @param {uint8[]} data - Coded bytes (zero bits past the end)
     * @param {int32} offset - Position of the first coded byte
     */
    constructor(data, offset) {
      /** @type {uint8[]} */
      this.data = data;
      /** @type {int32} */
      this.pos = offset;
      /** @type {int32} */
      this.low = 0;
      /** @type {int32} */
      this.high = FULL_RANGE - 1;
      /** @type {uint8} */
      this.bitBuffer = 0;
      /** @type {int32} */
      this.bitsRemaining = 0;

      /** @type {int32} */
      this.code = 0;
      for (let i = 0; i < PRECISION_BITS; ++i) {
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
      const mid = this.low + Math.floor((range * prob0) / 65536) - 1;

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
        if (this.high < HALF_RANGE) {
          // both in lower half - just shift
        } else if (this.low >= HALF_RANGE) {
          this.low -= HALF_RANGE;
          this.high -= HALF_RANGE;
          this.code -= HALF_RANGE;
        } else if (this.low >= QUARTER_RANGE && this.high < 3 * QUARTER_RANGE) {
          this.low -= QUARTER_RANGE;
          this.high -= QUARTER_RANGE;
          this.code -= QUARTER_RANGE;
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
        this.bitBuffer = this.pos < this.data.length ? this.data[this.pos] : 0;
        ++this.pos;
        this.bitsRemaining = 8;
      }

      --this.bitsRemaining;
      return OpCodes.And32(OpCodes.Shr32(this.bitBuffer, this.bitsRemaining), 1);
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * NeuralCompressionAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class NeuralCompressionAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Neural Network Compression (Educational)";
        this.description = "Online-trained two-layer neural predictor (backprop through a tanh hidden layer) driving a binary arithmetic coder, NNCP-style. The network learns as it compresses; the decoder replays the identical learning trajectory, so no weights are transmitted.";
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Neural Network";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.EXPERT;
        this.inventor = "Educational Implementation";
        this.year = 2019;
        this.country = CountryCode.INTL;

        this.documentation = [
          new LinkItem("Neural Data Compression", "https://arxiv.org/abs/1811.01057"),
          new LinkItem("Prediction by Partial Matching", "https://en.wikipedia.org/wiki/Prediction_by_partial_matching"),
          new LinkItem("Context Modeling", "https://compression.ru/download/articles/context/cm_1.pdf")
        ];

        this.references = [
          new LinkItem("Neural Networks", "https://en.wikipedia.org/wiki/Neural_network"),
          new LinkItem("Adaptive Compression", "https://en.wikipedia.org/wiki/Adaptive_compression"),
          new LinkItem("Predictive Coding", "https://en.wikipedia.org/wiki/Predictive_coding")
        ];

        // Test vectors with actual compressed outputs.
        // Wire format (byte-identical to CompressionWorkbench's BB_Neural):
        //   4 bytes original length (little-endian); if 0, no payload follows.
        //   Otherwise a binary-arithmetic-coded bitstream, one byte at a time
        //   MSB-first, each bit predicted by the online neural model.
        this.tests = [
          new TestCase(
            [],
            [0, 0, 0, 0],
            "Empty input",
            "https://arxiv.org/abs/1811.01057"
          ),
          new TestCase(
            [65], // "A"
            [1, 0, 0, 0, 61, 0],
            "Single byte",
            "https://en.wikipedia.org/wiki/Neural_network"
          ),
          new TestCase(
            [65, 65], // "AA"
            [2, 0, 0, 0, 61, 12],
            "Simple repetition",
            "https://en.wikipedia.org/wiki/Prediction_by_partial_matching"
          ),
          new TestCase(
            [97, 98, 99, 97], // "abca"
            [4, 0, 0, 0, 91, 235, 44, 74],
            "Pattern recognition",
            "https://compression.ru/download/articles/context/cm_1.pdf"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      /**
       * Create a new instance
       * @param {boolean} [isInverse=false] - True to decompress
       * @returns {NeuralCompressionInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new NeuralCompressionInstance(this, isInverse);
      }
    }

    class NeuralCompressionInstance extends IAlgorithmInstance {
      /**
       * @param {NeuralCompressionAlgorithm} algorithm - Parent algorithm
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
        if (this.isInverse) {
          if (this.inputBuffer.length === 0) {
            /** @type {uint8[]} */
            const empty = [];
            return empty;
          }
          /** @type {uint8[]} */
          const decoded = this._decompress(this.inputBuffer);
          /** @type {uint8[]} */
          const freshAfterDecode = [];
          this.inputBuffer = freshAfterDecode;
          return decoded;
        }

        // Even empty input produces a fixed 4-byte header (matches the
        // C# reference, which always writes the original length).
        /** @type {uint8[]} */
        const result = this._compress(this.inputBuffer);
        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        return result;
      }

      /**
       * @param {uint8[]} data - Input bytes
       * @returns {uint8[]} Length header and coded bits
       */
      _compress(data) {
        /** @type {uint8[]} */
        const output = OpCodes.Unpack32LE(data.length);
        if (data.length === 0) {
          return output;
        }

        /** @type {ArithmeticEncoder} */
        const encoder = new ArithmeticEncoder();
        /** @type {NeuralPredictor} */
        const net = new NeuralPredictor();

        for (let n = 0; n < data.length; ++n) {
          /** @type {uint8} */
          const value = data[n];
          /** @type {int32} */
          let partial = 1; // leading-1 sentinel
          for (let bit = 7; bit >= 0; --bit) {
            /** @type {int32} */
            const bitVal = OpCodes.And32(OpCodes.Shr32(value, bit), 1);

            /** @type {int32} */
            const prob1 = net.predict(partial);
            encoder.encodeBit(bitVal, 65536 - prob1); // coder wants P(bit=0)
            net.update(bitVal);

            partial = OpCodes.Or32(OpCodes.Shl32(partial, 1), bitVal);
          }

          net.pushByte(value);
        }

        encoder.finish();
        /** @type {uint8[]} */
        const coded = encoder.output;
        for (let k = 0; k < coded.length; k++) {
          output.push(coded[k]);
        }
        return output;
      }

      /**
       * @param {uint8[]} data - Length header and coded bits
       * @returns {uint8[]} Decoded bytes
       */
      _decompress(data) {
        /** @type {uint32} */
        const size = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
        /** @type {uint8[]} */
        const result = [];
        if (size === 0) {
          return result;
        }

        /** @type {ArithmeticDecoder} */
        const decoder = new ArithmeticDecoder(data, 4);
        /** @type {NeuralPredictor} */
        const net = new NeuralPredictor();

        for (let i = 0; i < size; ++i) {
          /** @type {int32} */
          let partial = 1;
          for (let bit = 7; bit >= 0; --bit) {
            /** @type {int32} */
            const prob1 = net.predict(partial);
            /** @type {int32} */
            const bitVal = decoder.decodeBit(65536 - prob1);
            net.update(bitVal);

            partial = OpCodes.Or32(OpCodes.Shl32(partial, 1), bitVal);
          }

          /** @type {uint8} */
          const b = OpCodes.And32(partial, 0xFF);
          result.push(b);
          net.pushByte(b);
        }

        return result;
      }
    }

  // ===== REGISTRATION =====

    const algorithmInstance = new NeuralCompressionAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { NeuralCompressionAlgorithm, NeuralCompressionInstance };
}));
