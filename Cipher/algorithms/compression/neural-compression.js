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

  const PROBABILITY_BITS = 12;
  const PROBABILITY_SCALE = OpCodes.Shl32(1, PROBABILITY_BITS); // 4096
  const MIN_STRETCH = -2047;
  const MAX_STRETCH = 2047;

  // .NET's Math.Round(double) defaults to MidpointRounding.ToEven (banker's
  // rounding), unlike JS's Math.round (always rounds .5 up). Reproduced
  // exactly here since the squash table is exercised across many logits and
  // an off-by-one at a single midpoint would desync the arithmetic coder.
  function roundHalfEven(x) {
    const floor = Math.floor(x);
    const diff = x - floor;
    if (diff < 0.5) return floor;
    if (diff > 0.5) return floor + 1;
    return (floor % 2 === 0) ? floor : floor + 1;
  }

  function buildSquashTable() {
    const span = MAX_STRETCH - MIN_STRETCH + 1;
    const table = new Array(span);
    for (let i = 0; i < span; ++i) {
      const x = (MIN_STRETCH + i) / 256.0; // logit in natural units
      const p = 1.0 / (1.0 + Math.exp(-x));
      const scaled = roundHalfEven(p * PROBABILITY_SCALE);
      table[i] = Math.max(1, Math.min(PROBABILITY_SCALE - 1, scaled));
    }
    return table;
  }

  function buildStretchTable(squash) {
    const table = new Array(PROBABILITY_SCALE);
    let pos = 0;
    for (let x = MIN_STRETCH; x <= MAX_STRETCH; ++x) {
      const p = squash[x - MIN_STRETCH];
      while (pos <= p && pos < PROBABILITY_SCALE)
        table[pos++] = x;
    }
    while (pos < PROBABILITY_SCALE)
      table[pos++] = MAX_STRETCH;
    return table;
  }

  const SQUASH_TABLE = buildSquashTable();
  const STRETCH_TABLE = buildStretchTable(SQUASH_TABLE);

  function squash(logit) {
    if (logit <= MIN_STRETCH) return 1;
    if (logit >= MAX_STRETCH) return PROBABILITY_SCALE - 1;
    return SQUASH_TABLE[logit - MIN_STRETCH];
  }

  function stretch(probability) {
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
    constructor(tableBits) {
      const tableSize = OpCodes.Shl32(1, tableBits); // constant per model, computed once
      this.tableMask = tableSize - 1;
      this.state = new Array(tableSize).fill(OpCodes.Shl32(PROBABILITY_SCALE / 2, 10));
    }

    predict(context) {
      const idx = OpCodes.AndN(context, this.tableMask);
      const p = OpCodes.Shr32(this.state[idx], 10);
      return Math.max(1, Math.min(PROBABILITY_SCALE - 1, p));
    }

    update(context, bit) {
      const idx = OpCodes.AndN(context, this.tableMask);
      const packed = this.state[idx];
      let probability = OpCodes.Shr32(packed, 10);
      let count = OpCodes.AndN(packed, 1023);

      const rate = count + 2;
      const target = bit === 1 ? PROBABILITY_SCALE : 0;
      probability += Math.trunc((target - probability) / rate); // C# int division truncates toward zero
      probability = Math.max(1, Math.min(PROBABILITY_SCALE - 1, probability));

      if (count < 1023) ++count;

      this.state[idx] = OpCodes.OrN(OpCodes.Shl32(probability, 10), count);
    }
  }

  // ===== NEURAL PREDICTOR =====
  // Bank of bit models: orders 0..3 over the recent byte history, plus two
  // hashed sparse contexts. A fully-connected hidden layer (tanh) with
  // backprop mixes their stretched predictions.

  const ORDERS = [0, 1, 2, 3];
  const ORDER_TABLE_BITS = [10, 16, 18, 20];
  const SPARSE_PATTERNS = [[1, 3], [2, 4]];
  const SPARSE_TABLE_BITS = 18;
  const HIDDEN_UNITS = 12;
  const LEARNING_RATE = 0.06;

  function mix32(h, x) {
    let t = OpCodes.Add32(x, 0x9E3779B1);
    t = OpCodes.Add32(t, OpCodes.Shl32(h, 6));
    t = OpCodes.Add32(t, OpCodes.Shr32(h, 2));
    return OpCodes.XorN(h, t);
  }

  function nextWeight(state, scale) {
    const newState = OpCodes.Add32(OpCodes.Mul32(state.value, 1664525), 1013904223);
    state.value = newState;
    const unit = OpCodes.Shr32(newState, 8) / 16777216.0; // [0,1)
    return (unit * 2.0 - 1.0) * scale;
  }

  class NeuralPredictor {
    constructor() {
      const orderModels = ORDERS.length;
      const sparseModels = SPARSE_PATTERNS.length;
      const modelCount = orderModels + sparseModels;

      this.models = [];
      for (let i = 0; i < orderModels; ++i)
        this.models.push(new ContextModel(ORDER_TABLE_BITS[i]));
      for (let i = 0; i < sparseModels; ++i)
        this.models.push(new ContextModel(SPARSE_TABLE_BITS));

      this.inputCount = modelCount + 1; // + bias
      this.history = new Array(8).fill(0);

      this.w1 = [];
      for (let j = 0; j < HIDDEN_UNITS; ++j)
        this.w1.push(new Array(this.inputCount).fill(0));
      this.w2 = new Array(HIDDEN_UNITS).fill(0);

      this.inputs = new Array(this.inputCount).fill(0);
      this.hidden = new Array(HIDDEN_UNITS).fill(0);
      this.contexts = new Array(modelCount).fill(0);
      this.lastProbability = 0;

      // Symmetry-breaking initialisation: a fixed, deterministic pseudo-random
      // fill, replayed identically by the decoder.
      const rng = { value: 0x12345678 };
      for (let j = 0; j < HIDDEN_UNITS; ++j) {
        for (let i = 0; i < this.inputCount; ++i)
          this.w1[j][i] = nextWeight(rng, 0.20);
        this.w2[j] = nextWeight(rng, 0.20);
      }
    }

    predict(partialByte) {
      this._computeContexts(partialByte);

      for (let i = 0; i < this.models.length; ++i) {
        const p12 = this.models[i].predict(this.contexts[i]);
        this.inputs[i] = stretch(p12) / 256.0;
      }
      this.inputs[this.inputCount - 1] = 1.0; // bias input

      for (let j = 0; j < HIDDEN_UNITS; ++j) {
        let sum = 0.0;
        for (let i = 0; i < this.inputCount; ++i)
          sum += this.w1[j][i] * this.inputs[i];
        this.hidden[j] = Math.tanh(sum);
      }

      let y = 0.0;
      for (let j = 0; j < HIDDEN_UNITS; ++j)
        y += this.w2[j] * this.hidden[j];

      const p = 1.0 / (1.0 + Math.exp(-y));
      this.lastProbability = p;

      const p16 = Math.trunc(p * 65536.0);
      return Math.max(1, Math.min(65535, p16));
    }

    update(bit) {
      const delta = bit - this.lastProbability;
      const lr = LEARNING_RATE;

      const hiddenDelta = new Array(HIDDEN_UNITS);
      for (let j = 0; j < HIDDEN_UNITS; ++j) {
        const h = this.hidden[j];
        hiddenDelta[j] = delta * this.w2[j] * (1.0 - h * h);
      }

      for (let j = 0; j < HIDDEN_UNITS; ++j)
        this.w2[j] += lr * delta * this.hidden[j];

      for (let j = 0; j < HIDDEN_UNITS; ++j) {
        const dj = lr * hiddenDelta[j];
        for (let i = 0; i < this.inputCount; ++i)
          this.w1[j][i] += dj * this.inputs[i];
      }

      for (let i = 0; i < this.models.length; ++i)
        this.models[i].update(this.contexts[i], bit);
    }

    pushByte(value) {
      for (let k = this.history.length - 1; k > 0; --k)
        this.history[k] = this.history[k - 1];
      this.history[0] = OpCodes.AndN(value, 0xFF);
    }

    _computeContexts(partialByte) {
      const orderModels = ORDERS.length;

      for (let i = 0; i < orderModels; ++i) {
        const order = ORDERS[i];
        let h = OpCodes.Mul32(order, 0x9E3779B1);
        for (let k = 0; k < order; ++k)
          h = mix32(h, this.history[k]);
        h = mix32(h, partialByte);
        this.contexts[i] = OpCodes.AndN(h, 0x7FFFFFFF);
      }

      for (let s = 0; s < SPARSE_PATTERNS.length; ++s) {
        const pattern = SPARSE_PATTERNS[s];
        let h = OpCodes.Add32(0xA5A5A5A5, OpCodes.Mul32(s, 0x85EBCA77));
        for (const idx of pattern)
          h = mix32(h, this.history[idx]);
        h = mix32(h, partialByte);
        this.contexts[orderModels + s] = OpCodes.AndN(h, 0x7FFFFFFF);
      }
    }
  }

  // ===== BINARY ARITHMETIC CODER =====
  // Bit-level arithmetic coder with 30-bit precision (fits safely in an
  // unsigned 32-bit range).

  const PRECISION_BITS = 30;
  const FULL_RANGE = 1073741824;  // 2^30
  const HALF_RANGE = 536870912;   // 2^29
  const QUARTER_RANGE = 268435456; // 2^28

  class ArithmeticEncoder {
    constructor() {
      this.output = [];
      this.low = 0;
      this.high = FULL_RANGE - 1;
      this.pendingBits = 0;
      this.bitBuffer = 0;
      this.bitsInBuffer = 0;
    }

    encodeBit(bit, prob0) {
      const range = this.high - this.low + 1;
      const mid = this.low + Math.floor((range * prob0) / 65536) - 1;

      if (bit === 0) this.high = mid;
      else this.low = mid + 1;

      this._normalize();
    }

    finish() {
      ++this.pendingBits;
      this._writeBitAndPending(this.low >= QUARTER_RANGE ? 1 : 0);

      if (this.bitsInBuffer > 0) {
        this.bitBuffer = OpCodes.Shl32(this.bitBuffer, 8 - this.bitsInBuffer);
        this.output.push(OpCodes.AndN(this.bitBuffer, 0xFF));
      }
    }

    _normalize() {
      for (;;) {
        if (this.high < HALF_RANGE)
          this._writeBitAndPending(0);
        else if (this.low >= HALF_RANGE) {
          this._writeBitAndPending(1);
          this.low -= HALF_RANGE;
          this.high -= HALF_RANGE;
        } else if (this.low >= QUARTER_RANGE && this.high < 3 * QUARTER_RANGE) {
          ++this.pendingBits;
          this.low -= QUARTER_RANGE;
          this.high -= QUARTER_RANGE;
        } else
          break;

        this.low = OpCodes.Shl32(this.low, 1);
        this.high = OpCodes.OrN(OpCodes.Shl32(this.high, 1), 1);
      }
    }

    _writeBitAndPending(bit) {
      this._writeBit(bit);
      const opposite = OpCodes.XorN(bit, 1);
      while (this.pendingBits > 0) {
        this._writeBit(opposite);
        --this.pendingBits;
      }
    }

    _writeBit(bit) {
      this.bitBuffer = OpCodes.OrN(OpCodes.Shl32(this.bitBuffer, 1), bit);
      ++this.bitsInBuffer;
      if (this.bitsInBuffer !== 8) return;

      this.output.push(OpCodes.AndN(this.bitBuffer, 0xFF));
      this.bitBuffer = 0;
      this.bitsInBuffer = 0;
    }
  }

  class ArithmeticDecoder {
    constructor(data, offset) {
      this.data = data;
      this.pos = offset;
      this.low = 0;
      this.high = FULL_RANGE - 1;
      this.bitBuffer = 0;
      this.bitsRemaining = 0;

      this.code = 0;
      for (let i = 0; i < PRECISION_BITS; ++i)
        this.code = OpCodes.OrN(OpCodes.Shl32(this.code, 1), this._readBit());
    }

    decodeBit(prob0) {
      const range = this.high - this.low + 1;
      const mid = this.low + Math.floor((range * prob0) / 65536) - 1;

      let bit;
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
        } else
          break;

        this.low = OpCodes.Shl32(this.low, 1);
        this.high = OpCodes.OrN(OpCodes.Shl32(this.high, 1), 1);
        this.code = OpCodes.OrN(OpCodes.Shl32(this.code, 1), this._readBit());
      }
    }

    _readBit() {
      if (this.bitsRemaining === 0) {
        this.bitBuffer = this.pos < this.data.length ? this.data[this.pos] : 0;
        ++this.pos;
        this.bitsRemaining = 8;
      }

      --this.bitsRemaining;
      return OpCodes.AndN(OpCodes.Shr32(this.bitBuffer, this.bitsRemaining), 1);
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

      CreateInstance(isInverse = false) {
        return new NeuralCompressionInstance(this, isInverse);
      }
    }

    class NeuralCompressionInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
      }


      Result() {
        if (this.isInverse) {
          if (this.inputBuffer.length === 0) return [];
          const result = this._decompress(this.inputBuffer);
          this.inputBuffer = [];
          return result;
        }

        // Even empty input produces a fixed 4-byte header (matches the
        // C# reference, which always writes the original length).
        const result = this._compress(this.inputBuffer);
        this.inputBuffer = [];
        return result;
      }

      _compress(data) {
        const output = OpCodes.Unpack32LE(data.length);
        if (data.length === 0) return output;

        const encoder = new ArithmeticEncoder();
        const net = new NeuralPredictor();

        for (const value of data) {
          let partial = 1; // leading-1 sentinel
          for (let bit = 7; bit >= 0; --bit) {
            const bitVal = OpCodes.AndN(OpCodes.Shr32(value, bit), 1);

            const prob1 = net.predict(partial);
            encoder.encodeBit(bitVal, 65536 - prob1); // coder wants P(bit=0)
            net.update(bitVal);

            partial = OpCodes.OrN(OpCodes.Shl32(partial, 1), bitVal);
          }

          net.pushByte(value);
        }

        encoder.finish();
        for (let _i = 0; _i < encoder.output.length; _i++) output.push(encoder.output[_i]);
        return output;
      }

      _decompress(data) {
        const size = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
        if (size === 0) return [];

        const decoder = new ArithmeticDecoder(data, 4);
        const net = new NeuralPredictor();

        const result = [];
        for (let i = 0; i < size; ++i) {
          let partial = 1;
          for (let bit = 7; bit >= 0; --bit) {
            const prob1 = net.predict(partial);
            const bitVal = decoder.decodeBit(65536 - prob1);
            net.update(bitVal);

            partial = OpCodes.OrN(OpCodes.Shl32(partial, 1), bitVal);
          }

          const b = OpCodes.AndN(partial, 0xFF);
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
