/*
 * PAQ8hp (High Performance) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * A clean-room port of CompressionWorkbench's reduced PAQ8hp building block
 * (BB_Paq8hp). Scope honesty: real PAQ8hp (a PAQ8 variant tuned for the
 * Hutter Prize / enwik benchmark, see http://mattmahoney.net/dc/paq.html)
 * ships dozens of specialised models (word, sparse, indirect, PPM-style,
 * image/audio detectors, and more) behind a large mixing network. This
 * implements NONE of that. It is the reduced subset CompressionWorkbench
 * documents and this port matches exactly: hashed byte-history contexts
 * (orders 0,1,2,3,4,6), one match model (follows the longest recent
 * repeat), context-selected mixing (16 independent weight vectors, one per
 * high nibble of the previous byte - the PAQ8 technique of letting the
 * mixer specialise per context), and a single SSE stage keyed on an
 * order-2 hash, entropy-coded with a binary arithmetic coder.
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

  // ===== MATCH MODEL =====

  class MatchModel {
    constructor(capacity, minOrder, hashBits) {
      this.buffer = new Uint8Array(Math.max(capacity, 1));
      this.minOrder = Math.max(minOrder === undefined ? 4 : minOrder, 1);
      const bits = hashBits === undefined ? 18 : hashBits;
      const size = OpCodes.Shl32(1, bits);
      this.hashHead = new Int32Array(size).fill(-1);
      this.hashMask = size - 1;
      this.length = 0;
      this.matchPointer = -1;
      this.matchLength = 0;
    }
    get predictedByte() {
      return this.matchLength > 0 && this.matchPointer >= 0 && this.matchPointer < this.length
        ? this.buffer[this.matchPointer]
        : -1;
    }
    append(value) {
      if (this.matchLength > 0 && this.matchPointer < this.length && this.buffer[this.matchPointer] === value) {
        ++this.matchPointer;
        ++this.matchLength;
      } else {
        this.matchLength = 0;
        this.matchPointer = -1;
      }

      if (this.length < this.buffer.length) this.buffer[this.length] = value;
      ++this.length;

      if (this.length < this.minOrder) return;

      const hash = this._computeContextHash();
      if (this.matchLength === 0) {
        const candidate = this.hashHead[hash];
        if (candidate >= 0 && candidate < this.length) {
          this.matchPointer = candidate;
          this.matchLength = 1;
        }
      }

      this.hashHead[hash] = this.length;
    }
    _computeContextHash() {
      let h = 0xC2B2AE35;
      for (let i = this.length - this.minOrder; i < this.length; ++i)
        h = mixHash(h, this.buffer[i]);
      return OpCodes.And32(h, this.hashMask);
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

  // ===== PAQ8HP REDUCED MODEL SET =====

  const PAQ8HP_ORDERS = [0, 1, 2, 3, 4, 6];
  const PAQ8HP_ORDER_TABLE_BITS = [10, 16, 18, 21, 22, 22];
  const PAQ8HP_WEIGHT_SHIFT = 16;
  const PAQ8HP_LEARNING_RATE = 3;
  const PAQ8HP_MIXER_CONTEXTS = 16; // selected by the previous byte's high nibble
  const PAQ8HP_INPUT_COUNT = 7; // 6 hashed byte-order models + 1 match model

  class Paq8HpState {
    constructor(capacity) {
      this.orderModels = PAQ8HP_ORDERS.map((_, i) => new ContextModel(PAQ8HP_ORDER_TABLE_BITS[i]));
      this.matchModel = new MatchModel(capacity);

      const initial = Math.trunc(OpCodes.Shl32(1, PAQ8HP_WEIGHT_SHIFT) / PAQ8HP_INPUT_COUNT);
      this.weightSets = [];
      for (let c = 0; c < PAQ8HP_MIXER_CONTEXTS; ++c)
        this.weightSets.push(new Array(PAQ8HP_INPUT_COUNT).fill(initial));

      this.stretched = new Array(PAQ8HP_INPUT_COUNT).fill(0);
      this.contexts = new Array(PAQ8HP_INPUT_COUNT - 1).fill(0);

      this.history = new Array(8).fill(0);
      this.mixerContext = 0;
      this.preApmProbability12 = 0;

      this.apm = new Apm(OpCodes.Shl32(1, 16));
    }

    predict(c0, bit) {
      for (let i = 0; i < this.orderModels.length; ++i) {
        const order = PAQ8HP_ORDERS[i];
        let h = OpCodes.ToUint32(order * 0x9E3779B1);
        for (let k = 0; k < order; ++k) h = mixHash(h, this.history[k]);
        h = mixHash(h, c0);
        this.contexts[i] = OpCodes.And32(h, 0x7FFFFFFF);
        this.stretched[i] = Logistic.Stretch(this.orderModels[i].predict(this.contexts[i]));
      }

      const matchIndex = this.orderModels.length;
      this.stretched[matchIndex] = Paq8HpState._matchStretch(this.matchModel, c0, bit);

      this.mixerContext = OpCodes.And32(OpCodes.Shr32(this.history[0], 4), PAQ8HP_MIXER_CONTEXTS - 1);
      const weights = this.weightSets[this.mixerContext];

      let dot = 0;
      for (let i = 0; i < PAQ8HP_INPUT_COUNT; ++i) dot += weights[i] * this.stretched[i];

      const logit = Math.floor(dot / 65536);
      const p12 = Logistic.Squash(logit);
      this.preApmProbability12 = p12;

      const apmContext = OpCodes.And32(OpCodes.Xor32(OpCodes.Shl32(this.history[0], 8), this.history[1]), 0xFFFF);
      const refined = this.apm.refine(p12, apmContext);

      let blended = Math.floor((p12 + 3 * refined) / 4);
      blended = Math.max(1, Math.min(CM_PROB_SCALE - 1, blended));

      const p16 = OpCodes.Shl32(blended, 4);
      return Math.max(1, Math.min(65535, p16));
    }

    update(bit) {
      for (let i = 0; i < this.orderModels.length; ++i)
        this.orderModels[i].update(this.contexts[i], bit);

      const error = (bit === 1 ? CM_PROB_SCALE : 0) - this.preApmProbability12;
      const weights = this.weightSets[this.mixerContext];
      for (let i = 0; i < PAQ8HP_INPUT_COUNT; ++i) {
        const grad = PAQ8HP_LEARNING_RATE * error * this.stretched[i];
        weights[i] += Math.floor(grad / CM_PROB_SCALE);
      }

      this.apm.update(bit);
    }

    pushByte(value) {
      for (let k = this.history.length - 1; k > 0; --k) this.history[k] = this.history[k - 1];
      this.history[0] = OpCodes.And32(value, 0xFF);

      this.matchModel.append(OpCodes.And32(value, 0xFF));
    }

    static _matchStretch(model, c0, bit) {
      const predicted = model.predictedByte;
      if (predicted < 0) return 0;

      const placedBits = 7 - bit;
      if (placedBits > 0) {
        const mask = OpCodes.Shl32(1, placedBits) - 1;
        const actualPrefix = OpCodes.And32(c0, mask);
        const predictedPrefix = OpCodes.And32(OpCodes.Shr32(predicted, 8 - placedBits), mask);
        if (actualPrefix !== predictedPrefix) return 0;
      }

      const predictedBit = OpCodes.And32(OpCodes.Shr32(predicted, bit), 1);
      const confidence = Math.min(model.matchLength, 28) * 64;
      return predictedBit === 1 ? confidence : -confidence;
    }
  }

  // ===== MAIN PAQ8HP ALGORITHM =====

  class PAQ8HPAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "PAQ8hp (High Performance)";
      this.description = "Reduced context-mixing model set (hashed orders 0,1,2,3,4,6 plus a match model, combined with PAQ8-style context-selected mixing - 16 weight vectors chosen by the previous byte's high nibble - and refined by a single SSE stage). Ported to be byte-for-byte identical to CompressionWorkbench's reduced BB_Paq8hp reference block. NOT the full PAQ8hp ensemble (word/sparse/indirect/PPM-style/media-detector models behind a large mixing network) - that reference is impractical to reproduce and this port intentionally matches only the documented reduced subset.";
      this.inventor = "Matt Mahoney, Alexander Ratushnyak, PAQ Team (concept); reduced clean-room reimplementation";
      this.year = 2007;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Context Mixing";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("PAQ8 Family Overview", "https://www.mattmahoney.net/dc/paq.html"),
        new LinkItem("PAQ8hp Archive", "http://mattmahoney.net/dc/paq8hp12any.zip"),
        new LinkItem("Context Mixing - Wikipedia", "https://en.wikipedia.org/wiki/Context_mixing")
      ];

      this.references = [
        new LinkItem("Hutter Prize", "http://prize.hutter1.net/"),
        new LinkItem("Data Compression Explained", "http://mattmahoney.net/dc/dce.html")
      ];

      this.tests = [
        {
          text: "Empty data test",
          uri: "https://www.mattmahoney.net/dc/paq.html",
          input: [],
          expected: [0, 0, 0, 0]
        },
        {
          text: "Single byte test",
          uri: "https://www.mattmahoney.net/dc/paq.html",
          input: [65]
        },
        {
          text: "Mixed alphanumeric data",
          uri: "http://mattmahoney.net/dc/dce.html",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog")
        },
        {
          text: "Repetitive text compression",
          uri: "http://prize.hutter1.net/",
          input: OpCodes.AnsiToBytes("abcabcabcabcabcabc")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new PAQ8HPInstance(this, isInverse);
    }
  }

  class PAQ8HPInstance extends IAlgorithmInstance {
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
      const state = new Paq8HpState(data.length);

      for (const value of data) {
        let c0 = 1;
        for (let bit = 7; bit >= 0; --bit) {
          const bitVal = OpCodes.And32(OpCodes.Shr32(value, bit), 1);
          const prob1 = state.predict(c0, bit);
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
      const state = new Paq8HpState(size);

      const result = new Array(size);
      for (let i = 0; i < size; ++i) {
        let c0 = 1;
        for (let bit = 7; bit >= 0; --bit) {
          const prob1 = state.predict(c0, bit);
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

  const algorithmInstance = new PAQ8HPAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return {
    PAQ8HPAlgorithm,
    PAQ8HPInstance,
    ContextModel,
    Apm,
    Logistic,
    MatchModel,
    ArithmeticEncoder,
    ArithmeticDecoder
  };
}));
