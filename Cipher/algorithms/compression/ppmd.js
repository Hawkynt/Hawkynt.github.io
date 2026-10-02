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

  /** @type {int32} */
  const PPMD_DEFAULT_ORDER = 6;
  /** @type {int32} */
  const PPMD_NUM_SYMBOLS = 256;
  /** @type {int32} */
  const PPMD_RESCALE_THRESHOLD = 2500;

  // ===== MULTI-SYMBOL RANGE CODER (matches Compression.Core.Entropy.Ppmd.PpmdRangeCoder) =====

  /** @type {uint32} */
  const PR_TOP = OpCodes.Shl32(1, 24);

  class PpmdRangeEncoder {
    constructor() {
      /** @type {float64} */
      this.range = 0xFFFFFFFF;
      // low may transiently exceed 32 bits (carry); it is kept as an exact
      // float64 and truncated on each shiftLow
      /** @type {float64} */
      this.low = 0;
      /** @type {int32} */
      this.cacheSize = 1;
      /** @type {int32} */
      this.cache = 0;
      /** @type {uint8[]} */
      this.output = [];
    }

    /**
     * @param {int32} lowCumFreq - Cumulative frequency below the symbol
     * @param {int32} freq - Symbol frequency
     * @param {int32} totalFreq - Frequency total
     */
    encode(lowCumFreq, freq, totalFreq) {
      /** @type {float64} */
      const r = Math.floor(this.range / totalFreq);
      this.low += r * lowCumFreq;
      this.range = r * freq;
      this._normalize();
    }

    /** Flush the pending bytes */
    finish() {
      for (let i = 0; i < 5; ++i) {
        this._shiftLow();
      }
    }

    _normalize() {
      while (this.range < PR_TOP) {
        this.range = OpCodes.Shl32(OpCodes.ToUint32(this.range), 8);
        this._shiftLow();
      }
    }

    _shiftLow() {
      /** @type {int32} */
      const carry = Math.floor(this.low / 4294967296); // this.low >> 32
      if (this.low < 0xFF000000 || carry !== 0) {
        /** @type {int32} */
        let temp = this.cache;
        do {
          this.output.push(OpCodes.And32(temp + carry, 0xFF));
          temp = 0xFF;
        } while (--this.cacheSize > 0);
        this.cache = OpCodes.And32(OpCodes.Shr32(OpCodes.ToUint32(this.low), 24), 0xFF);
      }
      ++this.cacheSize;
      this.low = OpCodes.Shl32(OpCodes.ToUint32(this.low), 8);
    }
  }

  class PpmdRangeDecoder {
    /**
     * @param {uint8[]} bytes - Coded bytes (zero past the end)
     */
    constructor(bytes) {
      /** @type {uint8[]} */
      this.input = bytes;
      /** @type {int32} */
      this.pos = 0;
      // range and code are plain numbers in the reference arithmetic; a
      // corrupt stream can drive code below zero, so both stay float64
      /** @type {float64} */
      this.range = 0xFFFFFFFF;
      /** @type {float64} */
      this.code = 0;
      this._readByte(); // leading byte (only used for EOF detection in the reference; value discarded)
      for (let i = 0; i < 4; ++i) {
        this.code = OpCodes.Or32(OpCodes.Shl32(OpCodes.ToUint32(this.code), 8), this._readByte());
      }
    }

    /**
     * @returns {uint8} Next byte, 0 past the end
     */
    _readByte() {
      return this.pos < this.input.length ? this.input[this.pos++] : 0;
    }

    /**
     * @param {int32} totalFreq - Frequency total
     * @returns {float64} Frequency position of the coded value
     */
    getThreshold(totalFreq) {
      this.range = Math.floor(this.range / totalFreq);
      return Math.floor(this.code / this.range);
    }

    /**
     * @param {int32} lowCumFreq - Cumulative frequency below the symbol
     * @param {int32} freq - Symbol frequency
     * @param {int32} totalFreq - Frequency total
     */
    decode(lowCumFreq, freq, totalFreq) {
      this.code -= this.range * lowCumFreq;
      this.range = this.range * freq;
      this._normalize();
    }

    _normalize() {
      while (this.range < PR_TOP) {
        this.range = OpCodes.Shl32(OpCodes.ToUint32(this.range), 8);
        this.code = OpCodes.Or32(OpCodes.Shl32(OpCodes.ToUint32(this.code), 8), this._readByte());
      }
    }
  }

  // ===== PPMd CONTEXT NODE (matches Compression.Core.Entropy.Ppmd.PpmdContext) =====

  /**
   * Coding table of one context: the non-excluded symbols in ascending order
   * with their cumulative frequencies, the escape (symbol -1) last
   */
  class PpmdCodingTable {
    constructor() {
      /** @type {int32[]} */
      this.symbol = [];
      /** @type {int32[]} */
      this.cumFreq = [];
      /** @type {int32[]} */
      this.freq = [];
    }
  }

  class PpmdContext {
    constructor() {
      /** @type {int32[]} */
      this.counts = new Int32Array(PPMD_NUM_SYMBOLS); // symbol (0-255) -> count, 0 = absent
      /** @type {int32} */
      this.size = 0;
    }

    /**
     * @returns {int32} Escape frequency
     */
    get escapeFreq() {
      return Math.max(1, this.size);
    }

    /**
     * @returns {int32} Escape plus all symbol frequencies
     */
    get totalFreq() {
      /** @type {int32} */
      let sum = Math.max(1, this.size);
      for (let s = 0; s < PPMD_NUM_SYMBOLS; ++s) {
        sum += this.counts[s];
      }
      return sum;
    }

    /**
     * @returns {int32} Number of distinct symbols seen
     */
    get symbolCount() {
      return this.size;
    }

    /**
     * @param {int32} symbol - Symbol seen
     */
    incrementFreq(symbol) {
      if (this.counts[symbol] === 0) {
        ++this.size;
      }
      ++this.counts[symbol];
    }

    /** Halve every count (rounding up, so no symbol is dropped) */
    rescale() {
      for (let s = 0; s < PPMD_NUM_SYMBOLS; ++s) {
        if (this.counts[s] > 0) {
          this.counts[s] = Math.trunc((this.counts[s] + 1) / 2);
        }
      }
    }

    // Builds a sorted (by symbol) coding table with escape appended last.
    /**
     * @param {boolean[]} excluded - Symbols ruled out, or null
     * @returns {PpmdCodingTable} Coding table
     */
    buildCodingTable(excluded) {
      /** @type {PpmdCodingTable} */
      const result = new PpmdCodingTable();
      /** @type {int32} */
      let cumFreq = 0;
      /** @type {int32} */
      let includedCount = 0;

      for (let sym = 0; sym < PPMD_NUM_SYMBOLS; ++sym) {
        /** @type {int32} */
        const frequency = this.counts[sym];
        if (frequency === 0) {
          continue;
        }
        if (excluded !== null && excluded[sym]) {
          continue;
        }
        result.symbol.push(sym);
        result.cumFreq.push(cumFreq);
        result.freq.push(frequency);
        cumFreq += frequency;
        ++includedCount;
      }

      result.symbol.push(-1);
      result.cumFreq.push(cumFreq);
      result.freq.push(Math.max(1, includedCount));
      return result;
    }
  }

  // ===== PPMd MODEL H (matches Compression.Core.Entropy.Ppmd.PpmdModelBase + PpmdModelH) =====

  /** @type {uint64} */
  const FNV_OFFSET_BASIS = 14695981039346656037n;
  /** @type {uint64} */
  const FNV_PRIME = 1099511628211n;
  /** @type {uint64} */
  const MASK64 = 0xFFFFFFFFFFFFFFFFn;
  /** @type {uint64} */
  const MASK32 = 0xFFFFFFFFn;
  /** @type {bigint} */
  const MOD64 = 0x10000000000000000n;

  /**
   * Contexts keyed by "order:hash" strings (an open-addressing table; it only
   * answers lookups, so its layout cannot influence the model)
   */
  class PpmdContextTable {
    constructor() {
      /** @type {string[]} */
      this.keys = new Array(64);
      /** @type {uint32[]} */
      this.seeds = new Uint32Array(64);
      /** @type {PpmdContext[]} */
      this.values = new Array(64);
      for (let i = 0; i < 64; i++) {
        this.keys[i] = null;
        this.values[i] = null;
      }
      /** @type {int32} */
      this.mask = 63;
      /** @type {int32} */
      this.count = 0;
    }

    /**
     * @param {string} key - Context key
     * @param {uint32} seed - Hash bits of the key
     * @returns {int32} Slot holding the key, or the empty slot where it belongs
     */
    _slot(key, seed) {
      /** @type {int32} */
      let slot = OpCodes.And32(OpCodes.Mul32(seed, 0x9E3779B1), this.mask);
      while (this.keys[slot] !== null && this.keys[slot] !== key) {
        slot = OpCodes.And32(slot + 1, this.mask);
      }
      return slot;
    }

    /**
     * @param {string} key - Context key
     * @param {uint32} seed - Hash bits of the key
     * @returns {PpmdContext} Context, or null when never created
     */
    get(key, seed) {
      return this.values[this._slot(key, seed)];
    }

    /**
     * @param {string} key - Context key
     * @param {uint32} seed - Hash bits of the key
     * @param {PpmdContext} context - New context
     */
    add(key, seed, context) {
      /** @type {int32} */
      const slot = this._slot(key, seed);
      this.keys[slot] = key;
      this.seeds[slot] = seed;
      this.values[slot] = context;
      ++this.count;
      if (this.count * 2 > this.mask) {
        this._grow();
      }
    }

    /** Double the table and re-insert every context */
    _grow() {
      /** @type {string[]} */
      const oldKeys = this.keys;
      /** @type {uint32[]} */
      const oldSeeds = this.seeds;
      /** @type {PpmdContext[]} */
      const oldValues = this.values;
      /** @type {int32} */
      const size = (this.mask + 1) * 2;
      this.keys = new Array(size);
      this.seeds = new Uint32Array(size);
      this.values = new Array(size);
      for (let i = 0; i < size; i++) {
        this.keys[i] = null;
        this.values[i] = null;
      }
      this.mask = size - 1;
      for (let i = 0; i < oldKeys.length; i++) {
        if (oldKeys[i] !== null) {
          /** @type {int32} */
          const slot = this._slot(oldKeys[i], oldSeeds[i]);
          this.keys[slot] = oldKeys[i];
          this.seeds[slot] = oldSeeds[i];
          this.values[slot] = oldValues[i];
        }
      }
    }
  }

  class PpmdModelH {
    /**
     * @param {int32} maxOrder - Highest context order
     */
    constructor(maxOrder) {
      /** @type {int32} */
      this.maxOrder = maxOrder;
      /** @type {int32} */
      this.historyLength = Math.max(maxOrder + 1, 1024);
      /** @type {uint8[]} */
      this.history = new Uint8Array(this.historyLength);
      /** @type {int32} */
      this.historyPos = 0;
      /** @type {int32} */
      this.historyCount = 0;
      /** @type {PpmdContextTable} */
      this.contexts = new PpmdContextTable(); // "order:hash" -> PpmdContext
      // Hash bits of the key built by the last _buildContextKey call
      /** @type {uint32} */
      this.keySeed = 0;
    }

    /**
     * FNV-1a (64-bit) over the last order history bytes
     * @param {int32} order - Context order
     * @returns {string} Context key "order:hash"
     */
    _buildContextKey(order) {
      /** @type {uint64} */
      let hash = FNV_OFFSET_BASIS;
      for (let i = order; i >= 1; --i) {
        /** @type {int32} */
        const idx = ((this.historyPos - i) % this.historyLength + this.historyLength) % this.historyLength;
        /** @type {uint64} */
        const value = BigInt(this.history[idx]);
        hash = OpCodes.XorN(hash, value);
        hash = OpCodes.AndN(OpCodes.MulModN(hash, FNV_PRIME, MOD64), MASK64);
      }
      /** @type {uint32} */
      const seed = Number(OpCodes.AndN(hash, MASK32));
      this.keySeed = seed;
      /** @type {string} */
      const text = hash.toString();
      return order + ':' + text;
    }

    /**
     * @param {int32} order - Context order
     * @returns {PpmdContext} Existing context, or null
     */
    getContext(order) {
      if (order === 0) {
        /** @type {PpmdContext} */
        const zero = this._getOrCreateOrderZero();
        return zero;
      }
      if (order > this.historyCount) {
        return null;
      }
      /** @type {string} */
      const key = this._buildContextKey(order);
      /** @type {PpmdContext} */
      const ctx = this.contexts.get(key, this.keySeed);
      return ctx;
    }

    /**
     * @param {int32} order - Context order
     * @returns {PpmdContext} Context (created on first use), or null
     */
    getOrCreateContext(order) {
      if (order === 0) {
        /** @type {PpmdContext} */
        const zero = this._getOrCreateOrderZero();
        return zero;
      }
      if (order > this.historyCount) {
        return null;
      }
      /** @type {string} */
      const key = this._buildContextKey(order);
      /** @type {PpmdContext} */
      let ctx = this.contexts.get(key, this.keySeed);
      if (ctx === null) {
        ctx = new PpmdContext();
        this.contexts.add(key, this.keySeed, ctx);
      }
      return ctx;
    }

    /**
     * @returns {PpmdContext} The order-0 context
     */
    _getOrCreateOrderZero() {
      /** @type {string} */
      const key = '0:0';
      /** @type {PpmdContext} */
      let ctx = this.contexts.get(key, 0);
      if (ctx === null) {
        ctx = new PpmdContext();
        this.contexts.add(key, 0, ctx);
      }
      return ctx;
    }

    /**
     * @param {int32} symbol - Symbol just coded
     */
    updateModel(symbol) {
      /** @type {int32} */
      const maxCtxOrder = Math.min(this.maxOrder, this.historyCount);
      for (let order = 0; order <= maxCtxOrder; ++order) {
        /** @type {PpmdContext} */
        const ctx = this.getOrCreateContext(order);
        if (ctx === null) {
          continue;
        }
        ctx.incrementFreq(symbol);
        /** @type {int32} */
        const total = ctx.totalFreq;
        if (total > PPMD_RESCALE_THRESHOLD) {
          ctx.rescale();
        }
      }

      this.history[this.historyPos] = symbol;
      this.historyPos = (this.historyPos + 1) % this.historyLength;
      if (this.historyCount < this.historyLength) {
        ++this.historyCount;
      }
    }

    /**
     * @param {PpmdCodingTable} table - Coding table
     * @param {boolean[]} excluded - Exclusions to extend, or null
     * @returns {boolean[]} Exclusions including every symbol of the table
     */
    static _exclude(table, excluded) {
      /** @type {boolean[]} */
      let set = excluded;
      if (set === null) {
        set = new Array(PPMD_NUM_SYMBOLS);
        for (let s = 0; s < PPMD_NUM_SYMBOLS; ++s) {
          set[s] = false;
        }
      }
      for (let k = 0; k < table.symbol.length; ++k) {
        if (table.symbol[k] >= 0) {
          set[table.symbol[k]] = true;
        }
      }
      return set;
    }

    /**
     * @param {PpmdRangeEncoder} encoder - Output coder
     * @param {int32} symbol - Symbol to code
     */
    encodeSymbol(encoder, symbol) {
      /** @type {boolean[]} */
      let excluded = null;
      /** @type {int32} */
      const maxCtxOrder = Math.min(this.maxOrder, this.historyCount);

      for (let order = maxCtxOrder; order >= 0; --order) {
        /** @type {PpmdContext} */
        const ctx = this.getContext(order);
        if (ctx === null || ctx.size === 0) {
          continue;
        }

        /** @type {PpmdCodingTable} */
        const table = ctx.buildCodingTable(excluded);
        /** @type {int32} */
        let totalFreq = 0;
        for (let k = 0; k < table.freq.length; ++k) {
          totalFreq += table.freq[k];
        }
        if (totalFreq === 0) {
          continue;
        }

        /** @type {int32} */
        let found = -1;
        for (let k = 0; k < table.symbol.length; ++k) {
          if (table.symbol[k] === symbol) {
            found = k;
            break;
          }
        }
        if (found >= 0) {
          encoder.encode(table.cumFreq[found], table.freq[found], totalFreq);
          this.updateModel(symbol);
          return;
        }

        /** @type {int32} */
        const escape = table.symbol.length - 1;
        if (table.symbol[escape] !== -1) {
          continue;
        }

        encoder.encode(table.cumFreq[escape], table.freq[escape], totalFreq);

        excluded = PpmdModelH._exclude(table, excluded);
      }

      PpmdModelH._encodeOrderMinus1(encoder, symbol, excluded);
      this.updateModel(symbol);
    }

    /**
     * @param {PpmdRangeDecoder} decoder - Input coder
     * @returns {int32} Decoded symbol
     */
    decodeSymbol(decoder) {
      /** @type {boolean[]} */
      let excluded = null;
      /** @type {int32} */
      const maxCtxOrder = Math.min(this.maxOrder, this.historyCount);

      for (let order = maxCtxOrder; order >= 0; --order) {
        /** @type {PpmdContext} */
        const ctx = this.getContext(order);
        if (ctx === null || ctx.size === 0) {
          continue;
        }

        /** @type {PpmdCodingTable} */
        const table = ctx.buildCodingTable(excluded);
        /** @type {int32} */
        let totalFreq = 0;
        for (let k = 0; k < table.freq.length; ++k) {
          totalFreq += table.freq[k];
        }
        if (totalFreq === 0) {
          continue;
        }

        /** @type {float64} */
        const threshold = decoder.getThreshold(totalFreq);

        /** @type {int32} */
        let cumFreq = 0;
        /** @type {int32} */
        let matched = -1;
        for (let k = 0; k < table.symbol.length; ++k) {
          if (threshold < cumFreq + table.freq[k]) {
            matched = k;
            break;
          }
          cumFreq += table.freq[k];
        }
        if (matched < 0) {
          continue;
        }

        decoder.decode(table.cumFreq[matched], table.freq[matched], totalFreq);

        if (table.symbol[matched] === -1) {
          excluded = PpmdModelH._exclude(table, excluded);
          continue;
        }

        /** @type {int32} */
        const symbol = table.symbol[matched];
        this.updateModel(symbol);
        return symbol;
      }

      /** @type {int32} */
      const decoded = PpmdModelH._decodeOrderMinus1(decoder, excluded);
      this.updateModel(decoded);
      return decoded;
    }

    /**
     * @param {PpmdRangeEncoder} encoder - Output coder
     * @param {int32} symbol - Symbol to code
     * @param {boolean[]} excluded - Symbols ruled out, or null
     */
    static _encodeOrderMinus1(encoder, symbol, excluded) {
      /** @type {int32} */
      let available = 0;
      /** @type {int32} */
      let cumFreq = 0;
      /** @type {boolean} */
      let found = false;
      /** @type {int32} */
      let foundCumFreq = 0;

      for (let s = 0; s < PPMD_NUM_SYMBOLS; ++s) {
        if (excluded !== null && excluded[s]) {
          continue;
        }
        if (s === symbol) {
          foundCumFreq = cumFreq;
          found = true;
        }
        ++cumFreq;
        ++available;
      }

      if (!found || available === 0) {
        encoder.encode(symbol, 1, PPMD_NUM_SYMBOLS);
        return;
      }

      encoder.encode(foundCumFreq, 1, available);
    }

    /**
     * @param {PpmdRangeDecoder} decoder - Input coder
     * @param {boolean[]} excluded - Symbols ruled out, or null
     * @returns {int32} Decoded symbol
     */
    static _decodeOrderMinus1(decoder, excluded) {
      /** @type {int32} */
      let available = 0;
      for (let s = 0; s < PPMD_NUM_SYMBOLS; ++s) {
        if (excluded !== null && excluded[s]) {
          continue;
        }
        ++available;
      }
      if (available === 0) {
        available = PPMD_NUM_SYMBOLS;
      }

      /** @type {float64} */
      const threshold = decoder.getThreshold(available);

      /** @type {int32} */
      let cumFreq = 0;
      for (let s = 0; s < PPMD_NUM_SYMBOLS; ++s) {
        if (excluded !== null && excluded[s]) {
          continue;
        }
        if (threshold === cumFreq) {
          decoder.decode(cumFreq, 1, available);
          return s;
        }
        ++cumFreq;
      }

      // Fallback pass (mirrors the reference's second scan for a boundary
      // threshold that fell inside rather than exactly on a cumFreq step).
      cumFreq = 0;
      /** @type {int32} */
      let lastSymbol = 0;
      for (let s = 0; s < PPMD_NUM_SYMBOLS; ++s) {
        if (excluded !== null && excluded[s]) {
          continue;
        }
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

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - True to decompress
     * @returns {PPMDInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new PPMDInstance(this, isInverse);
    }
  }

  class PPMDInstance extends IAlgorithmInstance {
    /**
     * @param {PPMDAlgorithm} algorithm - Parent algorithm
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
     * @returns {uint8[]} Order byte, size and range-coded symbols
     */
    compress(data) {
      /** @type {uint8[]} */
      const result = [];
      result.push(OpCodes.And32(PPMD_DEFAULT_ORDER, 0xFF));
      /** @type {uint8[]} */
      const sizeBytes = OpCodes.Unpack32LE(data.length);
      for (let i = 0; i < sizeBytes.length; i++) {
        result.push(sizeBytes[i]);
      }
      if (data.length === 0) {
        return result;
      }

      /** @type {PpmdModelH} */
      const model = new PpmdModelH(PPMD_DEFAULT_ORDER);
      /** @type {PpmdRangeEncoder} */
      const encoder = new PpmdRangeEncoder();
      for (let i = 0; i < data.length; i++) {
        model.encodeSymbol(encoder, data[i]);
      }
      encoder.finish();

      /** @type {uint8[]} */
      const coded = encoder.output;
      for (let i = 0; i < coded.length; i++) {
        result.push(coded[i]);
      }
      return result;
    }

    /**
     * @param {uint8[]} compressedData - Order byte, size and range-coded symbols
     * @returns {uint8[]} Decoded bytes
     */
    decompress(compressedData) {
      if (!compressedData || compressedData.length < 5) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      /** @type {uint8} */
      const order = compressedData[0];
      /** @type {uint32} */
      const originalSize = OpCodes.Pack32LE(compressedData[1], compressedData[2], compressedData[3], compressedData[4]);
      /** @type {uint8[]} */
      const result = new Array(originalSize);
      if (originalSize === 0) {
        return result;
      }

      /** @type {uint8[]} */
      const rest = compressedData.slice(5);
      /** @type {PpmdModelH} */
      const model = new PpmdModelH(order);
      /** @type {PpmdRangeDecoder} */
      const decoder = new PpmdRangeDecoder(rest);

      for (let i = 0; i < originalSize; ++i) {
        /** @type {int32} */
        const symbol = model.decodeSymbol(decoder);
        result[i] = symbol;
      }

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
