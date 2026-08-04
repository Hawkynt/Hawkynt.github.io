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

  // ===== LZ77 HASH-CHAIN MATCH FINDER (matches Compression.Core.Dictionary.MatchFinders.HashChainMatchFinder) =====

  class HashChainMatchFinder {
    constructor(windowSize, maxChainDepth) {
      this.maxChainDepth = maxChainDepth === undefined ? 128 : maxChainDepth;
      const hashSize = OpCodes.Shl32(1, 15);
      this.hashMask = hashSize - 1;
      this.head = new Int32Array(hashSize).fill(-1);
      this.prev = new Int32Array(windowSize); // defaults to 0, matching C#'s int[] default
    }
    _computeHash(data, position) {
      const h1 = OpCodes.Shl32(data[position], 10);
      const h2 = OpCodes.Shl32(data[position + 1], 5);
      return OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(h1, h2), data[position + 2]), this.hashMask);
    }
    findMatch(data, position, maxDistance, maxLength, minLength) {
      if (position + 2 >= data.length) return { distance: 0, length: 0 };

      let bestDistance = 0;
      let bestLength = 0;

      const hash = this._computeHash(data, position);
      let candidate = this.head[hash];
      let chainCount = 0;
      const windowStart = Math.max(0, position - maxDistance);
      const mask = this.prev.length - 1;

      while (candidate >= windowStart && chainCount < this.maxChainDepth) {
        if (candidate === position) {
          candidate = this.prev[OpCodes.And32(candidate, mask)];
          ++chainCount;
          continue;
        }
        const distance = position - candidate;
        const limit = Math.min(maxLength, Math.min(data.length - position, data.length - candidate));
        if (bestLength === 0 || (bestLength < limit && data[candidate + bestLength] === data[position + bestLength])) {
          const length = HashChainMatchFinder._matchLength(data, candidate, position, limit);
          if (length >= minLength && length > bestLength) {
            bestLength = length;
            bestDistance = distance;
            if (bestLength >= maxLength) break;
          }
        }

        candidate = this.prev[OpCodes.And32(candidate, mask)];
        if (candidate <= windowStart) break;
        ++chainCount;
      }

      this.prev[OpCodes.And32(position, mask)] = this.head[hash];
      this.head[hash] = position;

      return bestLength >= minLength ? { distance: bestDistance, length: bestLength } : { distance: 0, length: 0 };
    }
    insertPosition(data, position) {
      if (position + 2 >= data.length) return;
      const hash = this._computeHash(data, position);
      const mask = this.prev.length - 1;
      this.prev[OpCodes.And32(position, mask)] = this.head[hash];
      this.head[hash] = position;
    }
    static _matchLength(data, pos1, pos2, limit) {
      let matched = 0;
      while (matched < limit && data[pos1 + matched] === data[pos2 + matched]) ++matched;
      return matched;
    }
  }

  // ===== LZ77 PARSER (matches Compression.Core.Dictionary.Lz77.Lz77Compressor) =====

  function lz77Parse(data, matchFinder, windowSize, maxMatchLength, minMatchLength) {
    const tokens = [];
    let position = 0;
    while (position < data.length) {
      const match = matchFinder.findMatch(data, position, windowSize, maxMatchLength, minMatchLength);

      if (match.length >= minMatchLength) {
        tokens.push({ isLiteral: false, distance: match.distance, length: match.length });
        for (let i = 1; i < match.length; ++i) matchFinder.insertPosition(data, position + i);
        position += match.length;
      } else {
        tokens.push({ isLiteral: true, literal: data[position] });
        ++position;
      }
    }
    return tokens;
  }

  // ===== CSC MODEL STATE =====

  const CSC_WINDOW_SIZE = 32768;
  const CSC_MAX_MATCH_LENGTH = 258;
  const CSC_MIN_MATCH_LENGTH = 3;

  class CscState {
    constructor() {
      // Flag channel: mixes order-1 (last flag) and order-2 (last two flags) contexts.
      this.flagModels = [new ContextModel(2), new ContextModel(4)];
      this.flagMixer = new ContextMixer(this.flagModels);
      this.flagHistory = 0;

      // Literal channel: order-0 and order-1 (previous output byte) contexts.
      this.literalModels = [new ContextModel(9), new ContextModel(16)];
      this.literalMixer = new ContextMixer(this.literalModels);
      this.literalApm = new Apm(256);
      this.previousByte = 0;

      this.flagContexts = [0, 0];
      this.literalContexts = [0, 0];

      // Length/distance channels: order-0 adaptive bit-trees (context = c0 directly).
      this.lengthModel = new ContextModel(9);
      this.distanceModel = new ContextModel(17);
    }

    pushLiteralByte(value) { this.previousByte = value; }

    encodeFlag(encoder, bit) {
      this._computeFlagContexts();
      const prob1 = this._predictFlag();
      encoder.encodeBit(bit, 65536 - prob1);
      this._updateFlag(bit);
    }
    decodeFlag(decoder) {
      this._computeFlagContexts();
      const prob1 = this._predictFlag();
      const bit = decoder.decodeBit(65536 - prob1);
      this._updateFlag(bit);
      return bit;
    }
    _computeFlagContexts() {
      this.flagContexts[0] = OpCodes.And32(this.flagHistory, 0x1);
      this.flagContexts[1] = OpCodes.And32(this.flagHistory, 0x3);
    }
    _predictFlag() {
      const mixed16 = this.flagMixer.predict(this.flagContexts);
      return Math.max(1, Math.min(65535, mixed16));
    }
    _updateFlag(bit) {
      this.flagMixer.update(this.flagContexts, bit);
      this.flagHistory = OpCodes.And32(OpCodes.Or32(OpCodes.Shl32(this.flagHistory, 1), bit), 0x3);
    }

    encodeLiteral(encoder, value) {
      let c0 = 1;
      for (let bit = 7; bit >= 0; --bit) {
        const bitVal = OpCodes.And32(OpCodes.Shr32(value, bit), 1);
        this._computeLiteralContexts(c0);
        const prob1 = this._predictLiteral();
        encoder.encodeBit(bitVal, 65536 - prob1);
        this._updateLiteral(bitVal);
        c0 = OpCodes.Or32(OpCodes.Shl32(c0, 1), bitVal);
      }
      this.previousByte = value;
    }
    decodeLiteral(decoder) {
      let c0 = 1;
      for (let bit = 7; bit >= 0; --bit) {
        this._computeLiteralContexts(c0);
        const prob1 = this._predictLiteral();
        const bitVal = decoder.decodeBit(65536 - prob1);
        this._updateLiteral(bitVal);
        c0 = OpCodes.Or32(OpCodes.Shl32(c0, 1), bitVal);
      }
      const b = OpCodes.And32(c0, 0xFF);
      this.previousByte = b;
      return b;
    }
    _computeLiteralContexts(c0) {
      this.literalContexts[0] = OpCodes.And32(c0, 0x1FF);
      this.literalContexts[1] = OpCodes.And32(OpCodes.Xor32(OpCodes.ToUint32(this.previousByte * 0x9E3779B1), c0), 0xFFFF);
    }
    _predictLiteral() {
      const mixed16 = this.literalMixer.predict(this.literalContexts);
      const mixed12 = OpCodes.Shr32(mixed16, 4);
      const refined12 = this.literalApm.refine(mixed12, this.previousByte);
      let blended12 = OpCodes.Shr32(mixed12 + refined12, 1);
      blended12 = Math.max(1, Math.min(CM_PROB_SCALE - 1, blended12));
      const p16 = OpCodes.Shl32(blended12, 4);
      return Math.max(1, Math.min(65535, p16));
    }
    _updateLiteral(bit) {
      this.literalMixer.update(this.literalContexts, bit);
      this.literalApm.update(bit);
    }

    encodeLength(encoder, value) { CscState._encodeOrderZero(encoder, this.lengthModel, value, 8); }
    decodeLength(decoder) { return CscState._decodeOrderZero(decoder, this.lengthModel, 8); }
    encodeDistance(encoder, value) { CscState._encodeOrderZero(encoder, this.distanceModel, value, 16); }
    decodeDistance(decoder) { return CscState._decodeOrderZero(decoder, this.distanceModel, 16); }

    static _encodeOrderZero(encoder, model, value, numBits) {
      let c0 = 1;
      for (let bit = numBits - 1; bit >= 0; --bit) {
        const bitVal = OpCodes.And32(OpCodes.Shr32(value, bit), 1);
        let prob1 = OpCodes.Shl32(model.predict(c0), 4);
        prob1 = Math.max(1, Math.min(65535, prob1));
        encoder.encodeBit(bitVal, 65536 - prob1);
        model.update(c0, bitVal);
        c0 = OpCodes.Or32(OpCodes.Shl32(c0, 1), bitVal);
      }
    }
    static _decodeOrderZero(decoder, model, numBits) {
      let c0 = 1;
      for (let bit = numBits - 1; bit >= 0; --bit) {
        let prob1 = OpCodes.Shl32(model.predict(c0), 4);
        prob1 = Math.max(1, Math.min(65535, prob1));
        const bitVal = decoder.decodeBit(65536 - prob1);
        model.update(c0, bitVal);
        c0 = OpCodes.Or32(OpCodes.Shl32(c0, 1), bitVal);
      }
      return c0 - OpCodes.Shl32(1, numBits);
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

    CreateInstance(isInverse = false) {
      return new CSCInstance(this, isInverse);
    }
  }

  class CSCInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
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

      const matchFinder = new HashChainMatchFinder(CSC_WINDOW_SIZE);
      const tokens = lz77Parse(data, matchFinder, CSC_WINDOW_SIZE, CSC_MAX_MATCH_LENGTH, CSC_MIN_MATCH_LENGTH);

      const encoder = new ArithmeticEncoder();
      const state = new CscState();

      let position = 0;
      for (const token of tokens) {
        state.encodeFlag(encoder, token.isLiteral ? 0 : 1);

        if (token.isLiteral) {
          state.encodeLiteral(encoder, token.literal);
          ++position;
        } else {
          state.encodeLength(encoder, token.length - CSC_MIN_MATCH_LENGTH);
          state.encodeDistance(encoder, token.distance - 1);
          for (let i = 0; i < token.length; ++i)
            state.pushLiteralByte(data[position + i]);
          position += token.length;
        }
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
      const state = new CscState();

      const result = new Array(size);
      let position = 0;
      while (position < size) {
        const isMatch = state.decodeFlag(decoder);

        if (isMatch === 0) {
          const literal = state.decodeLiteral(decoder);
          result[position++] = literal;
        } else {
          const length = state.decodeLength(decoder) + CSC_MIN_MATCH_LENGTH;
          const distance = state.decodeDistance(decoder) + 1;
          const src = position - distance;
          for (let i = 0; i < length; ++i) {
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
