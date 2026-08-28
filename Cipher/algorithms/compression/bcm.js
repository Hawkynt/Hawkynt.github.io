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

  // ===== BURROWS-WHEELER TRANSFORM (matches Compression.Core.Transforms.BurrowsWheelerTransform) =====

  class BurrowsWheelerTransform {
    static forward(data) {
      const n = data.length;
      if (n === 0) return { transformed: [], index: 0 };

      const sa = new Array(n);
      for (let i = 0; i < n; ++i) sa[i] = i;

      // Full cyclic-rotation comparison sort. JS Array.prototype.sort is a
      // stable sort, so fully-tied rotations (periodic input) keep their
      // original relative (ascending index) order.
      sa.sort((a, b) => {
        for (let k = 0; k < n; ++k) {
          const da = data[(a + k) % n];
          const db = data[(b + k) % n];
          if (da !== db) return da - db;
        }
        return 0;
      });

      const transformed = new Array(n);
      let index = 0;
      for (let i = 0; i < n; ++i) {
        if (sa[i] === 0) { index = i; transformed[i] = data[n - 1]; }
        else transformed[i] = data[sa[i] - 1];
      }
      return { transformed, index };
    }

    static inverse(data, index) {
      const n = data.length;
      if (n === 0) return [];

      const count = new Array(256).fill(0);
      for (let i = 0; i < n; ++i) ++count[data[i]];

      const cumulative = new Array(256).fill(0);
      let sum = 0;
      for (let c = 0; c < 256; ++c) { cumulative[c] = sum; sum += count[c]; }

      const lfMap = new Array(n);
      const tempCount = cumulative.slice();
      for (let i = 0; i < n; ++i) { lfMap[i] = tempCount[data[i]]; ++tempCount[data[i]]; }

      const result = new Array(n);
      let idx = index;
      for (let i = n - 1; i >= 0; --i) { result[i] = data[idx]; idx = lfMap[idx]; }
      return result;
    }
  }

  // ===== BCM MODEL STATE (orders 0-2 over the BWT output) =====

  const BCM_ORDERS = [0, 1, 2];
  const BCM_ORDER_TABLE_BITS = [9, 16, 20];
  const BCM_APM_CONTEXTS = 256;

  class BcmState {
    constructor() {
      this.models = BCM_ORDERS.map((_, i) => new ContextModel(BCM_ORDER_TABLE_BITS[i]));
      this.mixer = new ContextMixer(this.models);
      this.apm = new Apm(BCM_APM_CONTEXTS);
      this.history = [0, 0, 0, 0];
    }
    get modelCount() { return this.models.length; }

    computeContexts(contexts, c0) {
      for (let i = 0; i < this.models.length; ++i) {
        const order = BCM_ORDERS[i];
        let h = OpCodes.ToUint32(order * 0x9E3779B1);
        for (let k = 0; k < order; ++k) h = mixHash(h, this.history[k]);
        h = mixHash(h, c0);
        contexts[i] = OpCodes.And32(h, 0x7FFFFFFF);
      }
    }

    predict(contexts) {
      const mixed16 = this.mixer.predict(contexts);
      const mixed12 = OpCodes.Shr32(mixed16, 4);
      const refined12 = this.apm.refine(mixed12, this.history[0]);
      let blended12 = OpCodes.Shr32(mixed12 + refined12, 1);
      blended12 = Math.max(1, Math.min(CM_PROB_SCALE - 1, blended12));
      const p16 = OpCodes.Shl32(blended12, 4);
      return Math.max(1, Math.min(65535, p16));
    }

    update(contexts, bit) {
      this.mixer.update(contexts, bit);
      this.apm.update(bit);
    }

    pushByte(value) {
      for (let k = this.history.length - 1; k > 0; --k) this.history[k] = this.history[k - 1];
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
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new BCMInstance(this, isInverse);
    }
  }

  /**
 * BCM cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class BCMInstance extends IAlgorithmInstance {
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

      const bwt = BurrowsWheelerTransform.forward(data);
      const indexHeader = OpCodes.Unpack32LE(bwt.index);

      const encoder = new ArithmeticEncoder();
      const state = new BcmState();
      const contexts = new Array(state.modelCount);

      for (const value of bwt.transformed) {
        let c0 = 1;
        for (let bit = 7; bit >= 0; --bit) {
          const bitVal = OpCodes.And32(OpCodes.Shr32(value, bit), 1);
          state.computeContexts(contexts, c0);
          const prob1 = state.predict(contexts);
          encoder.encodeBit(bitVal, 65536 - prob1);
          state.update(contexts, bitVal);
          c0 = OpCodes.Or32(OpCodes.Shl32(c0, 1), bitVal);
        }
        state.pushByte(value);
      }

      encoder.finish();
      return [...header, ...indexHeader, ...encoder.output];
    }

    decompress(compressedData) {
      if (!compressedData || compressedData.length < 4)
        return [];

      const size = OpCodes.Pack32LE(compressedData[0], compressedData[1], compressedData[2], compressedData[3]);
      if (size === 0) return [];

      if (compressedData.length < 8)
        throw new Error('Invalid BCM compressed data: too short');

      const index = OpCodes.Pack32LE(compressedData[4], compressedData[5], compressedData[6], compressedData[7]);
      const rest = compressedData.slice(8);

      const decoder = new ArithmeticDecoder(rest);
      const state = new BcmState();
      const contexts = new Array(state.modelCount);

      const bwt = new Array(size);
      for (let i = 0; i < size; ++i) {
        let c0 = 1;
        for (let bit = 7; bit >= 0; --bit) {
          state.computeContexts(contexts, c0);
          const prob1 = state.predict(contexts);
          const bitVal = decoder.decodeBit(65536 - prob1);
          state.update(contexts, bitVal);
          c0 = OpCodes.Or32(OpCodes.Shl32(c0, 1), bitVal);
        }
        const b = OpCodes.And32(c0, 0xFF);
        bwt[i] = b;
        state.pushByte(b);
      }

      return BurrowsWheelerTransform.inverse(bwt, index);
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
