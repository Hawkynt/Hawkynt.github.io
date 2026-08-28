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

  const CM_PROB_BITS = 12;
  const CM_PROB_SCALE = 4096;
  const CM_MIN_STRETCH = -2047;
  const CM_MAX_STRETCH = 2047;

  // Replicates C#'s Math.Round(double) default (MidpointRounding.ToEven).
  function roundHalfEven(x) {
    const flo = Math.floor(x);
    const diff = x - flo;
    if (diff < 0.5) return flo;
    if (diff > 0.5) return flo + 1;
    return (flo % 2 === 0) ? flo : flo + 1;
  }

  function buildSquashTable() {
    const span = CM_MAX_STRETCH - CM_MIN_STRETCH + 1;
    const table = new Int16Array(span);
    for (let i = 0; i < span; ++i) {
      const x = (CM_MIN_STRETCH + i) / 256.0;
      const p = 1.0 / (1.0 + Math.exp(-x));
      const scaled = roundHalfEven(p * CM_PROB_SCALE);
      table[i] = Math.max(1, Math.min(CM_PROB_SCALE - 1, scaled));
    }
    return table;
  }

  function buildStretchTable(squash) {
    const table = new Int16Array(CM_PROB_SCALE);
    let pos = 0;
    for (let x = CM_MIN_STRETCH; x <= CM_MAX_STRETCH; ++x) {
      const p = squash[x - CM_MIN_STRETCH];
      while (pos <= p && pos < CM_PROB_SCALE) table[pos++] = x;
    }
    while (pos < CM_PROB_SCALE) table[pos++] = CM_MAX_STRETCH;
    return table;
  }

  const CM_SQUASH_TABLE = buildSquashTable();
  const CM_STRETCH_TABLE = buildStretchTable(CM_SQUASH_TABLE);

  const Logistic = {
    ProbabilityBits: CM_PROB_BITS,
    ProbabilityScale: CM_PROB_SCALE,
    MinStretch: CM_MIN_STRETCH,
    MaxStretch: CM_MAX_STRETCH,
    Squash(logit) {
      if (logit <= CM_MIN_STRETCH) return 1;
      if (logit >= CM_MAX_STRETCH) return CM_PROB_SCALE - 1;
      return CM_SQUASH_TABLE[logit - CM_MIN_STRETCH];
    },
    Stretch(probability) {
      const p = Math.max(0, Math.min(CM_PROB_SCALE - 1, probability));
      return CM_STRETCH_TABLE[p];
    }
  };

  // Deterministic 32-bit hash mixer (matches the C# reference's private Mix helper).
  function mixHash(h, x) {
    const sum = OpCodes.ToUint32(x + 0x9E3779B1 + OpCodes.Shl32(h, 6) + OpCodes.Shr32(h, 2));
    return OpCodes.Xor32(h, sum);
  }

  // ===== CONTEXT MODEL =====

  class ContextModel {
    constructor(tableBits) {
      const tableSize = OpCodes.Shl32(1, tableBits);
      this.tableMask = tableSize - 1;
      this.state = new Int32Array(tableSize);
      this.state.fill(OpCodes.Shl32(CM_PROB_SCALE / 2, 10));
    }
    predict(context) {
      const idx = OpCodes.And32(context, this.tableMask);
      const p = OpCodes.Shr32(this.state[idx], 10);
      return Math.max(1, Math.min(CM_PROB_SCALE - 1, p));
    }
    update(context, bit) {
      const idx = OpCodes.And32(context, this.tableMask);
      const packed = this.state[idx];
      let probability = OpCodes.Shr32(packed, 10);
      let count = OpCodes.And32(packed, 1023);
      const rate = count + 2;
      const target = bit === 1 ? CM_PROB_SCALE : 0;
      probability = probability + Math.trunc((target - probability) / rate);
      probability = Math.max(1, Math.min(CM_PROB_SCALE - 1, probability));
      if (count < 1023) ++count;
      this.state[idx] = OpCodes.Or32(OpCodes.Shl32(probability, 10), count);
    }
  }

  // ===== CONTEXT MIXER =====

  class ContextMixer {
    constructor(models) {
      this.models = models;
      this.numModels = models.length;
      this.weights = new Array(this.numModels).fill(Math.trunc(65536 / Math.max(1, this.numModels)));
      this.stretched = new Array(this.numModels).fill(0);
      this.lastProbability = 0;
    }
    predict(contexts) {
      let dot = 0;
      for (let i = 0; i < this.numModels; ++i) {
        const s = Logistic.Stretch(this.models[i].predict(contexts[i]));
        this.stretched[i] = s;
        dot += this.weights[i] * s;
      }
      const logit = Math.floor(dot / 65536);
      const p12 = Logistic.Squash(logit);
      this.lastProbability = p12;
      const p16 = OpCodes.Shl32(p12, 4);
      return Math.max(1, Math.min(65535, p16));
    }
    update(contexts, bit) {
      const error = (bit === 1 ? CM_PROB_SCALE : 0) - this.lastProbability;
      for (let i = 0; i < this.numModels; ++i) {
        const grad = 3 * error * this.stretched[i];
        this.weights[i] += Math.floor(grad / CM_PROB_SCALE);
      }
      for (let i = 0; i < this.numModels; ++i)
        this.models[i].update(contexts[i], bit);
    }
  }

  // ===== ADAPTIVE PROBABILITY MAP (SSE) =====

  const APM_KNOTS = 33;
  const APM_STEP = Math.trunc((CM_MAX_STRETCH - CM_MIN_STRETCH) / (APM_KNOTS - 1));

  class Apm {
    constructor(contexts, rate) {
      this.contextMask = contexts - 1;
      this.rate = rate === undefined ? 7 : rate;
      this.rateDivisor = Math.pow(2, this.rate);
      this.map = new Int32Array(contexts * APM_KNOTS);
      for (let c = 0; c < contexts; ++c)
        for (let k = 0; k < APM_KNOTS; ++k) {
          const logit = CM_MIN_STRETCH + k * APM_STEP;
          this.map[c * APM_KNOTS + k] = Logistic.Squash(logit);
        }
      this.lastIndex = 0;
      this.lastWeight = 0;
    }
    refine(probability, context) {
      const s = Logistic.Stretch(probability) - CM_MIN_STRETCH;
      let knot = Math.trunc(s / APM_STEP);
      let weight = s - knot * APM_STEP;
      if (knot >= APM_KNOTS - 1) { knot = APM_KNOTS - 2; weight = APM_STEP; }
      const baseIdx = OpCodes.And32(context, this.contextMask) * APM_KNOTS + knot;
      const lo = this.map[baseIdx];
      const hi = this.map[baseIdx + 1];
      const refined = lo + Math.trunc((hi - lo) * weight / APM_STEP);
      this.lastIndex = (weight * 2 >= APM_STEP) ? baseIdx + 1 : baseIdx;
      this.lastWeight = weight;
      return Math.max(1, Math.min(CM_PROB_SCALE - 1, refined));
    }
    update(bit) {
      const target = bit === 1 ? CM_PROB_SCALE - 1 : 0;
      const current = this.map[this.lastIndex];
      this.map[this.lastIndex] = current + Math.floor((target - current) / this.rateDivisor);
    }
  }

  // ===== BINARY ARITHMETIC CODER (30-bit precision, matches Compression.Core.Entropy.Arithmetic) =====

  const AC_FULL_RANGE = OpCodes.Shl32(1, 30);
  const AC_HALF_RANGE = OpCodes.Shl32(1, 29);
  const AC_QUARTER_RANGE = OpCodes.Shl32(1, 28);

  class ArithmeticEncoder {
    constructor() {
      this.low = 0;
      this.high = AC_FULL_RANGE - 1;
      this.pendingBits = 0;
      this.bitBuffer = 0;
      this.bitsInBuffer = 0;
      this.output = [];
    }
    encodeBit(bit, prob0) {
      const range = this.high - this.low + 1;
      const mid = this.low + Math.floor(range * prob0 / 65536) - 1;
      if (bit === 0) this.high = mid; else this.low = mid + 1;
      this._normalize();
    }
    finish() {
      ++this.pendingBits;
      this._writeBitAndPending(this.low >= AC_QUARTER_RANGE ? 1 : 0);
      if (this.bitsInBuffer > 0) {
        this.bitBuffer = OpCodes.Shl32(this.bitBuffer, 8 - this.bitsInBuffer);
        this.output.push(OpCodes.And32(this.bitBuffer, 0xFF));
      }
    }
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
        } else break;
        this.low = OpCodes.Shl32(this.low, 1);
        this.high = OpCodes.Or32(OpCodes.Shl32(this.high, 1), 1);
      }
    }
    _writeBitAndPending(bit) {
      this._writeBit(bit);
      const opposite = 1 - bit;
      while (this.pendingBits > 0) { this._writeBit(opposite); --this.pendingBits; }
    }
    _writeBit(bit) {
      this.bitBuffer = OpCodes.Or32(OpCodes.Shl32(this.bitBuffer, 1), bit);
      ++this.bitsInBuffer;
      if (this.bitsInBuffer !== 8) return;
      this.output.push(OpCodes.And32(this.bitBuffer, 0xFF));
      this.bitBuffer = 0;
      this.bitsInBuffer = 0;
    }
  }

  class ArithmeticDecoder {
    constructor(bytes) {
      this.input = bytes;
      this.pos = 0;
      this.low = 0;
      this.high = AC_FULL_RANGE - 1;
      this.code = 0;
      this.bitBuffer = 0;
      this.bitsRemaining = 0;
      for (let i = 0; i < 30; ++i)
        this.code = OpCodes.Or32(OpCodes.Shl32(this.code, 1), this._readBit());
    }
    decodeBit(prob0) {
      const range = this.high - this.low + 1;
      const mid = this.low + Math.floor(range * prob0 / 65536) - 1;
      let bit;
      if (this.code <= mid) { bit = 0; this.high = mid; } else { bit = 1; this.low = mid + 1; }
      this._normalize();
      return bit;
    }
    _normalize() {
      for (;;) {
        if (this.high < AC_HALF_RANGE) {
          // both in lower half
        } else if (this.low >= AC_HALF_RANGE) {
          this.low -= AC_HALF_RANGE; this.high -= AC_HALF_RANGE; this.code -= AC_HALF_RANGE;
        } else if (this.low >= AC_QUARTER_RANGE && this.high < 3 * AC_QUARTER_RANGE) {
          this.low -= AC_QUARTER_RANGE; this.high -= AC_QUARTER_RANGE; this.code -= AC_QUARTER_RANGE;
        } else break;
        this.low = OpCodes.Shl32(this.low, 1);
        this.high = OpCodes.Or32(OpCodes.Shl32(this.high, 1), 1);
        this.code = OpCodes.Or32(OpCodes.Shl32(this.code, 1), this._readBit());
      }
    }
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

  const MCM_LOCAL_ORDERS = [0, 1, 2];
  const MCM_MEDIUM_ORDERS = [3, 4];
  const MCM_WEIGHT_SHIFT = 16;
  const MCM_LEARNING_RATE = 3;
  const MCM_SPARSE_SEED = 0xC2B2AE35;

  class McmState {
    constructor() {
      this.local = [new ContextModel(9), new ContextModel(16), new ContextModel(20)];
      this.medium = [new ContextModel(21), new ContextModel(22)];
      this.wide = [new ContextModel(22), new ContextModel(18)]; // order-6, sparse(skip-1)

      this.localMixer = new ContextMixer(this.local);
      this.mediumMixer = new ContextMixer(this.medium);
      this.wideMixer = new ContextMixer(this.wide);

      this.localCtx = new Array(3).fill(0);
      this.mediumCtx = new Array(2).fill(0);
      this.wideCtx = new Array(2).fill(0);

      const initialWeight = Math.trunc(OpCodes.Shl32(1, MCM_WEIGHT_SHIFT) / 3);
      this.networkWeights = [initialWeight, initialWeight, initialWeight];
      this.networkStretch = [0, 0, 0];
      this.preApmProbability12 = 0;

      this.apm1 = new Apm(256);
      this.apm2 = new Apm(OpCodes.Shl32(1, 12));

      this.history = new Array(8).fill(0);
    }

    _hashOrder(order, c0) {
      let h = OpCodes.ToUint32(order * 0x9E3779B1);
      for (let k = 0; k < order; ++k) h = mixHash(h, this.history[k]);
      h = mixHash(h, c0);
      return OpCodes.And32(h, 0x7FFFFFFF);
    }

    _computeContexts(c0) {
      for (let i = 0; i < MCM_LOCAL_ORDERS.length; ++i)
        this.localCtx[i] = this._hashOrder(MCM_LOCAL_ORDERS[i], c0);

      for (let i = 0; i < MCM_MEDIUM_ORDERS.length; ++i)
        this.mediumCtx[i] = this._hashOrder(MCM_MEDIUM_ORDERS[i], c0);

      this.wideCtx[0] = this._hashOrder(6, c0);
      // Sparse context: byte two positions back, skipping the immediate predecessor.
      let h = mixHash(MCM_SPARSE_SEED, this.history[1]);
      h = mixHash(h, c0);
      this.wideCtx[1] = OpCodes.And32(h, 0x7FFFFFFF);
    }

    predict(c0) {
      this._computeContexts(c0);

      const pLocal16 = this.localMixer.predict(this.localCtx);
      const pMedium16 = this.mediumMixer.predict(this.mediumCtx);
      const pWide16 = this.wideMixer.predict(this.wideCtx);

      this.networkStretch[0] = Logistic.Stretch(OpCodes.Shr32(pLocal16, 4));
      this.networkStretch[1] = Logistic.Stretch(OpCodes.Shr32(pMedium16, 4));
      this.networkStretch[2] = Logistic.Stretch(OpCodes.Shr32(pWide16, 4));

      let dot = 0;
      for (let i = 0; i < 3; ++i) dot += this.networkWeights[i] * this.networkStretch[i];

      const logit = Math.floor(dot / 65536);
      const p12 = Logistic.Squash(logit);
      this.preApmProbability12 = p12;

      const refined1 = this.apm1.refine(p12, this.history[0]);
      const apm2Context = OpCodes.And32(OpCodes.Xor32(OpCodes.Shl32(this.history[0], 4), OpCodes.Shr32(this.history[1], 4)), 0xFFF);
      const refined2 = this.apm2.refine(refined1, apm2Context);

      let blended = Math.floor((p12 + refined1 + 2 * refined2) / 4);
      blended = Math.max(1, Math.min(CM_PROB_SCALE - 1, blended));

      const p16 = OpCodes.Shl32(blended, 4);
      return Math.max(1, Math.min(65535, p16));
    }

    update(bit) {
      this.localMixer.update(this.localCtx, bit);
      this.mediumMixer.update(this.mediumCtx, bit);
      this.wideMixer.update(this.wideCtx, bit);

      const error = (bit === 1 ? CM_PROB_SCALE : 0) - this.preApmProbability12;
      for (let i = 0; i < 3; ++i) {
        const grad = MCM_LEARNING_RATE * error * this.networkStretch[i];
        this.networkWeights[i] += Math.floor(grad / CM_PROB_SCALE);
      }

      this.apm1.update(bit);
      this.apm2.update(bit);
    }

    pushByte(value) {
      for (let k = this.history.length - 1; k > 0; --k) this.history[k] = this.history[k - 1];
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

    CreateInstance(isInverse = false) {
      return new MCMInstance(this, isInverse);
    }
  }

  class MCMInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }


    Result() {
      const result = this.isInverse ?
        this.decompress(this.inputBuffer) :
        this.compress(this.inputBuffer);

      this.inputBuffer = [];
      return result;
    }

    compress(data) {
      const header = OpCodes.Unpack32LE(data.length);
      if (data.length === 0) return header;

      const encoder = new ArithmeticEncoder();
      const state = new McmState();

      for (const value of data) {
        let c0 = 1;
        for (let bit = 7; bit >= 0; --bit) {
          const bitVal = OpCodes.And32(OpCodes.Shr32(value, bit), 1);
          const prob1 = state.predict(c0);
          encoder.encodeBit(bitVal, 65536 - prob1);
          state.update(bitVal);
          c0 = OpCodes.Or32(OpCodes.Shl32(c0, 1), bitVal);
        }
        state.pushByte(value);
      }

      encoder.finish();
      return [...header, ...encoder.output];
    }

    decompress(compressedData) {
      if (!compressedData || compressedData.length < 4)
        return [];

      const size = OpCodes.Pack32LE(compressedData[0], compressedData[1], compressedData[2], compressedData[3]);
      if (size === 0) return [];

      const rest = compressedData.slice(4);
      const decoder = new ArithmeticDecoder(rest);
      const state = new McmState();

      const result = new Array(size);
      for (let i = 0; i < size; ++i) {
        let c0 = 1;
        for (let bit = 7; bit >= 0; --bit) {
          const prob1 = state.predict(c0);
          const bitVal = decoder.decodeBit(65536 - prob1);
          state.update(bitVal);
          c0 = OpCodes.Or32(OpCodes.Shl32(c0, 1), bitVal);
        }
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
