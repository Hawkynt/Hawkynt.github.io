/*
 * PPMd (PPM with Dynamic Memory) Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * A clean-room port of CompressionWorkbench's PPMd building block (BB_Ppmd,
 * Model H): a context trie with Method D escape estimation (escape
 * frequency = number of distinct symbols observed), periodic rescaling at
 * a total-frequency threshold of 2500, exclusion of already-coded symbols
 * when falling through to lower orders, a flat order(-1) fallback over all
 * non-excluded byte values, and a multi-symbol range coder. Context nodes
 * are identified by an FNV-1a (64-bit) hash of the preceding byte sequence
 * so encoder and decoder derive identical context identities without a
 * pointer-based trie.
 *
 * Wire format: [order: uint8] [originalLength: uint32 LE] [range-coded
 * stream, one PPMd symbol at a time]
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

  const PPMD_DEFAULT_ORDER = 6;
  const PPMD_NUM_SYMBOLS = 256;
  const PPMD_RESCALE_THRESHOLD = 2500;

  // ===== MULTI-SYMBOL RANGE CODER (matches Compression.Core.Entropy.Ppmd.PpmdRangeCoder) =====

  const PR_TOP = OpCodes.Shl32(1, 24);

  class PpmdRangeEncoder {
    constructor() {
      this.range = 0xFFFFFFFF;
      this.low = 0; // may transiently exceed 32 bits (carry); truncated on each shiftLow
      this.cacheSize = 1;
      this.cache = 0;
      this.output = [];
    }
    encode(lowCumFreq, freq, totalFreq) {
      const r = Math.floor(this.range / totalFreq);
      this.low += r * lowCumFreq;
      this.range = r * freq;
      this._normalize();
    }
    finish() {
      for (let i = 0; i < 5; ++i) this._shiftLow();
    }
    _normalize() {
      while (this.range < PR_TOP) {
        this.range = OpCodes.Shl32(this.range, 8);
        this._shiftLow();
      }
    }
    _shiftLow() {
      const carry = Math.floor(this.low / 4294967296); // this.low >> 32
      if (this.low < 0xFF000000 || carry !== 0) {
        let temp = this.cache;
        do {
          this.output.push(OpCodes.And32(temp + carry, 0xFF));
          temp = 0xFF;
        } while (--this.cacheSize > 0);
        this.cache = OpCodes.And32(Math.floor(OpCodes.ToUint32(this.low) / 16777216), 0xFF);
      }
      ++this.cacheSize;
      this.low = OpCodes.Shl32(this.low, 8);
    }
  }

  class PpmdRangeDecoder {
    constructor(bytes) {
      this.input = bytes;
      this.pos = 0;
      this.range = 0xFFFFFFFF;
      this.code = 0;
      this._readByte(); // leading byte (only used for EOF detection in the reference; value discarded)
      for (let i = 0; i < 4; ++i)
        this.code = OpCodes.Or32(OpCodes.Shl32(this.code, 8), this._readByte());
    }
    _readByte() {
      return this.pos < this.input.length ? this.input[this.pos++] : 0;
    }
    getThreshold(totalFreq) {
      this.range = Math.floor(this.range / totalFreq);
      return Math.floor(this.code / this.range);
    }
    decode(lowCumFreq, freq, totalFreq) {
      this.code -= this.range * lowCumFreq;
      this.range = this.range * freq;
      this._normalize();
    }
    _normalize() {
      while (this.range < PR_TOP) {
        this.range = OpCodes.Shl32(this.range, 8);
        this.code = OpCodes.Or32(OpCodes.Shl32(this.code, 8), this._readByte());
      }
    }
  }

  // ===== PPMd CONTEXT NODE (matches Compression.Core.Entropy.Ppmd.PpmdContext) =====

  class PpmdContext {
    constructor() {
      this.freq = new Map(); // symbol (0-255) -> count
    }
    get escapeFreq() { return Math.max(1, this.freq.size); }
    get totalFreq() {
      let sum = this.escapeFreq;
      for (const v of this.freq.values()) sum += v;
      return sum;
    }
    get symbolCount() { return this.freq.size; }
    incrementFreq(symbol) {
      this.freq.set(symbol, (this.freq.get(symbol) || 0) + 1);
    }
    rescale() {
      const toRemove = [];
      for (const [sym, f] of this.freq) {
        const newFreq = Math.trunc((f + 1) / 2);
        if (newFreq <= 0) toRemove.push(sym);
        else this.freq.set(sym, newFreq);
      }
      for (const sym of toRemove) this.freq.delete(sym);
    }
    // Builds a sorted (by symbol) coding table with escape appended last.
    buildCodingTable(excluded) {
      const result = [];
      let cumFreq = 0;
      let includedCount = 0;

      const sorted = [...this.freq.keys()].sort((a, b) => a - b);
      for (const sym of sorted) {
        if (excluded && excluded.has(sym)) continue;
        const frequency = this.freq.get(sym);
        result.push({ symbol: sym, cumFreq, freq: frequency });
        cumFreq += frequency;
        ++includedCount;
      }

      const escapeFreq = Math.max(1, includedCount);
      result.push({ symbol: -1, cumFreq, freq: escapeFreq });
      return result;
    }
  }

  // ===== PPMd MODEL H (matches Compression.Core.Entropy.Ppmd.PpmdModelBase + PpmdModelH) =====

  const FNV_OFFSET_BASIS = 14695981039346656037n;
  const FNV_PRIME = 1099511628211n;
  const MASK64 = 0xFFFFFFFFFFFFFFFFn;

  class PpmdModelH {
    constructor(maxOrder) {
      this.maxOrder = maxOrder;
      this.historyLength = Math.max(maxOrder + 1, 1024);
      this.history = new Uint8Array(this.historyLength);
      this.historyPos = 0;
      this.historyCount = 0;
      this.contexts = new Map(); // "order:hash" -> PpmdContext
    }

    _buildContextKey(order) {
      let hash = FNV_OFFSET_BASIS;
      for (let i = order; i >= 1; --i) {
        const idx = ((this.historyPos - i) % this.historyLength + this.historyLength) % this.historyLength;
        hash = OpCodes.XorN(hash, BigInt(this.history[idx]));
        hash = OpCodes.AndN(hash * FNV_PRIME, MASK64);
      }
      return order + ':' + hash.toString();
    }

    getContext(order) {
      if (order === 0) return this._getOrCreateOrderZero();
      if (order > this.historyCount) return null;
      const key = this._buildContextKey(order);
      return this.contexts.get(key) || null;
    }

    getOrCreateContext(order) {
      if (order === 0) return this._getOrCreateOrderZero();
      if (order > this.historyCount) return null;
      const key = this._buildContextKey(order);
      let ctx = this.contexts.get(key);
      if (!ctx) { ctx = new PpmdContext(); this.contexts.set(key, ctx); }
      return ctx;
    }

    _getOrCreateOrderZero() {
      const key = '0:0';
      let ctx = this.contexts.get(key);
      if (!ctx) { ctx = new PpmdContext(); this.contexts.set(key, ctx); }
      return ctx;
    }

    updateModel(symbol) {
      const maxCtxOrder = Math.min(this.maxOrder, this.historyCount);
      for (let order = 0; order <= maxCtxOrder; ++order) {
        const ctx = this.getOrCreateContext(order);
        if (!ctx) continue;
        ctx.incrementFreq(symbol);
        if (ctx.totalFreq > PPMD_RESCALE_THRESHOLD) ctx.rescale();
      }

      this.history[this.historyPos] = symbol;
      this.historyPos = (this.historyPos + 1) % this.historyLength;
      if (this.historyCount < this.historyLength) ++this.historyCount;
    }

    encodeSymbol(encoder, symbol) {
      let excluded = null;
      const maxCtxOrder = Math.min(this.maxOrder, this.historyCount);

      for (let order = maxCtxOrder; order >= 0; --order) {
        const ctx = this.getContext(order);
        if (!ctx || ctx.symbolCount === 0) continue;

        const table = ctx.buildCodingTable(excluded);
        let totalFreq = 0;
        for (const e of table) totalFreq += e.freq;
        if (totalFreq === 0) continue;

        let found = null;
        for (const e of table) if (e.symbol === symbol) { found = e; break; }
        if (found) {
          encoder.encode(found.cumFreq, found.freq, totalFreq);
          this.updateModel(symbol);
          return;
        }

        const escapeEntry = table[table.length - 1];
        if (escapeEntry.symbol !== -1) continue;

        encoder.encode(escapeEntry.cumFreq, escapeEntry.freq, totalFreq);

        excluded = excluded || new Set();
        for (const e of table) if (e.symbol >= 0) excluded.add(e.symbol);
      }

      PpmdModelH._encodeOrderMinus1(encoder, symbol, excluded);
      this.updateModel(symbol);
    }

    decodeSymbol(decoder) {
      let excluded = null;
      const maxCtxOrder = Math.min(this.maxOrder, this.historyCount);

      for (let order = maxCtxOrder; order >= 0; --order) {
        const ctx = this.getContext(order);
        if (!ctx || ctx.symbolCount === 0) continue;

        const table = ctx.buildCodingTable(excluded);
        let totalFreq = 0;
        for (const e of table) totalFreq += e.freq;
        if (totalFreq === 0) continue;

        const threshold = decoder.getThreshold(totalFreq);

        let cumFreq = 0;
        let matched = null;
        for (const e of table) {
          if (threshold < cumFreq + e.freq) { matched = e; break; }
          cumFreq += e.freq;
        }
        if (!matched) continue;

        decoder.decode(matched.cumFreq, matched.freq, totalFreq);

        if (matched.symbol === -1) {
          excluded = excluded || new Set();
          for (const e of table) if (e.symbol >= 0) excluded.add(e.symbol);
          continue;
        }

        const symbol = matched.symbol;
        this.updateModel(symbol);
        return symbol;
      }

      const decoded = PpmdModelH._decodeOrderMinus1(decoder, excluded);
      this.updateModel(decoded);
      return decoded;
    }

    static _encodeOrderMinus1(encoder, symbol, excluded) {
      let available = 0;
      let cumFreq = 0;
      let found = false;
      let foundCumFreq = 0;

      for (let s = 0; s < PPMD_NUM_SYMBOLS; ++s) {
        if (excluded && excluded.has(s)) continue;
        if (s === symbol) { foundCumFreq = cumFreq; found = true; }
        ++cumFreq;
        ++available;
      }

      if (!found || available === 0) {
        encoder.encode(symbol, 1, PPMD_NUM_SYMBOLS);
        return;
      }

      encoder.encode(foundCumFreq, 1, available);
    }

    static _decodeOrderMinus1(decoder, excluded) {
      let available = 0;
      for (let s = 0; s < PPMD_NUM_SYMBOLS; ++s) {
        if (excluded && excluded.has(s)) continue;
        ++available;
      }
      if (available === 0) available = PPMD_NUM_SYMBOLS;

      const threshold = decoder.getThreshold(available);

      let cumFreq = 0;
      for (let s = 0; s < PPMD_NUM_SYMBOLS; ++s) {
        if (excluded && excluded.has(s)) continue;
        if (threshold === cumFreq) {
          decoder.decode(cumFreq, 1, available);
          return s;
        }
        ++cumFreq;
      }

      // Fallback pass (mirrors the reference's second scan for a boundary
      // threshold that fell inside rather than exactly on a cumFreq step).
      cumFreq = 0;
      let lastSymbol = 0;
      for (let s = 0; s < PPMD_NUM_SYMBOLS; ++s) {
        if (excluded && excluded.has(s)) continue;
        if (threshold < cumFreq + 1) {
          decoder.decode(cumFreq, 1, available);
          return s;
        }
        lastSymbol = s;
        ++cumFreq;
      }

      decoder.decode(cumFreq - 1, 1, available);
      return lastSymbol;
    }
  }

  // ===== MAIN PPMd ALGORITHM =====

  class PPMDAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "PPMd (PPM with Dynamic Memory)";
      this.description = "Context trie with Method D escape estimation (escape frequency = number of distinct symbols observed), periodic rescaling, exclusion of already-coded symbols on escape, and a flat order(-1) fallback, entropy-coded with a multi-symbol range coder. Ported to be byte-for-byte identical to CompressionWorkbench's BB_Ppmd (Model H) reference block.";
      this.inventor = "Dmitry Shkarin (concept); reduced clean-room reimplementation";
      this.year = 1999;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Statistical (PPM)";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.RU;

      this.documentation = [
        new LinkItem("PPMd Overview - Wikipedia", "https://en.wikipedia.org/wiki/Prediction_by_partial_matching"),
        new LinkItem("7-Zip PPMd Method", "https://www.7-zip.org/7z.html"),
        new LinkItem("Data Compression Explained (PPM)", "http://mattmahoney.net/dc/dce.html#Section_431")
      ];

      this.references = [
        new LinkItem("Shkarin PPMd var.H/I sources", "http://www.compression.ru/ds/"),
        new LinkItem("Method D Escape Estimation", "https://en.wikipedia.org/wiki/Prediction_by_partial_matching#Method_D")
      ];

      this.tests = [
        {
          text: "Empty data test",
          uri: "http://www.compression.ru/ds/",
          input: [],
          expected: [PPMD_DEFAULT_ORDER, 0, 0, 0, 0]
        },
        {
          text: "Single byte test",
          uri: "http://www.compression.ru/ds/",
          input: [65]
        },
        {
          text: "Mixed alphanumeric data",
          uri: "http://mattmahoney.net/dc/dce.html#Section_431",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog")
        },
        {
          text: "Repetitive text compression",
          uri: "https://en.wikipedia.org/wiki/Prediction_by_partial_matching",
          input: OpCodes.AnsiToBytes("abcabcabcabcabcabc")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new PPMDInstance(this, isInverse);
    }
  }

  class PPMDInstance extends IAlgorithmInstance {
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
      const header = [OpCodes.And32(PPMD_DEFAULT_ORDER, 0xFF), ...OpCodes.Unpack32LE(data.length)];
      if (data.length === 0) return header;

      const model = new PpmdModelH(PPMD_DEFAULT_ORDER);
      const encoder = new PpmdRangeEncoder();
      for (const b of data)
        model.encodeSymbol(encoder, b);
      encoder.finish();

      return [...header, ...encoder.output];
    }

    decompress(compressedData) {
      if (!compressedData || compressedData.length < 5)
        return [];

      const order = compressedData[0];
      const originalSize = OpCodes.Pack32LE(compressedData[1], compressedData[2], compressedData[3], compressedData[4]);
      if (originalSize === 0) return [];

      const rest = compressedData.slice(5);
      const model = new PpmdModelH(order);
      const decoder = new PpmdRangeDecoder(rest);

      const result = new Array(originalSize);
      for (let i = 0; i < originalSize; ++i)
        result[i] = model.decodeSymbol(decoder);

      return result;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new PPMDAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return {
    PPMDAlgorithm,
    PPMDInstance,
    PpmdModelH,
    PpmdContext,
    PpmdRangeEncoder,
    PpmdRangeDecoder
  };
}));
