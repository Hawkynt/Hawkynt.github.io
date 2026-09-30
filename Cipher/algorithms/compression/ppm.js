/*
 * PPM (Prediction by Partial Matching) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * A finite-context statistical model whose symbol predictions are driven into
 * an adaptive arithmetic coder, so a symbol the model considers likely costs a
 * fraction of a bit rather than a whole byte.
 *
 * Specification sources:
 *   J. G. Cleary and I. H. Witten, "Data Compression Using Adaptive Coding and
 *   Partial String Matching", IEEE Transactions on Communications 32(4), 1984,
 *   396-402 - the blending-by-escape model: predict from the longest context
 *   seen so far and fall back to shorter contexts through an explicit escape.
 *
 *   A. Moffat, "Implementing the PPM Data Compression Scheme", IEEE
 *   Transactions on Communications 38(11), 1990, 1917-1921 - escape method C
 *   (the escape gets a count equal to the number of distinct symbols the
 *   context has ever predicted) and full exclusion.
 *
 *   I. H. Witten, R. M. Neal and J. G. Cleary, "Arithmetic Coding for Data
 *   Compression", Communications of the ACM 30(6), 1987, 520-540 - the 16-bit
 *   incremental arithmetic coder with underflow (bits-to-follow) handling.
 *
 * Model. Contexts of order 0 through MAX_ORDER are kept, each a symbol-to-count
 * table in first-seen order. A symbol is coded from the longest context that
 * both exists and predicts it. Where the longest context does not predict it,
 * an escape is coded in that context and coding drops to the next shorter one;
 * a context never seen before costs nothing at all, since its escape
 * probability is one. Below order 0 sits a fixed order -1 context giving every
 * byte value equal probability, so any symbol can always be coded.
 *
 * Escape method C. The escape is allotted a frequency equal to the number of
 * distinct symbols the context predicts, so a context that has been surprising
 * in the past is cheaper to escape out of.
 *
 * Full exclusion. Escaping from a context proves the symbol is none of the ones
 * that context predicts, so those symbols are removed from consideration in
 * every shorter context and their probability mass is redistributed.
 *
 * Update. After a symbol is coded, every context of order 0 through MAX_ORDER
 * that applies at that position has its count for the symbol incremented.
 * Counts are halved when a context's frequency total would exceed what the
 * coder's 16-bit registers can carry, which also lets the model track drifting
 * statistics.
 *
 * Wire format (matches CompressionWorkbench's BB_PPM building block):
 *   [maxOrder: 1 byte]
 *   [originalLength: 4 bytes little-endian]
 *   [arithmetic-coded symbol stream, bits packed most-significant first]
 * The length header terminates decoding, so no end-of-stream symbol is coded.
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

  // ===== CODER CONSTANTS =====

  // Witten-Neal-Cleary register layout: 16-bit code values, so the largest
  // frequency total that cannot overflow the narrowing arithmetic is 2^14 - 1.
  /** @type {int32} */
  const MAX_ORDER = 3;
  /** @type {int32} */
  const NUM_SYMBOLS = 256;
  /** @type {int32} */
  const CODE_BITS = 16;
  /** @type {int32} */
  const TOP_VALUE = 65535;
  /** @type {int32} */
  const FIRST_QUARTER = 16384;
  /** @type {int32} */
  const HALF = 32768;
  /** @type {int32} */
  const THIRD_QUARTER = 49152;
  /** @type {int32} */
  const MAX_FREQUENCY = 16383;

  // ===== MODEL =====

  /**
   * Results reported by the context queries (a reusable out-parameter record)
   */
  class PpmScratch {
    constructor() {
      /** @type {int32} */
      this.frequency = 0;
      /** @type {int32} */
      this.cumulative = 0;
      /** @type {int32} */
      this.excludedCount = 0;
      /** @type {int32} */
      this.escape = 0;
      /** @type {int32} */
      this.symbolTotal = 0;
    }
  }

  // One finite context: the symbols seen after it, in first-seen order, with
  // their occurrence counts. First-seen order is part of the wire format,
  // because it fixes where each symbol sits in the coder's frequency range.
  class Context {
    constructor() {
      /** @type {int32[]} */
      this.symbols = [];
      /** @type {int32[]} */
      this.counts = [];
      /** @type {int32} */
      this.total = 0;
    }

    // Splits the frequency mass into (escape frequency, sum of symbol
    // frequencies) under the current exclusion set.
    /**
     * @param {boolean[]} excluded - Symbols ruled out
     * @param {PpmScratch} out - Receives escape and symbolTotal
     */
    effectiveTotals(excluded, out) {
      /** @type {int32} */
      let escape = 0;
      /** @type {int32} */
      let sum = 0;
      for (let k = 0; k < this.symbols.length; ++k) {
        if (excluded[this.symbols[k]]) {
          continue;
        }
        sum += this.counts[k];
        ++escape;
      }
      out.escape = escape;
      out.symbolTotal = sum;
    }

    // Sums the frequencies of the non-excluded symbols preceding symbol, and
    // reports its own frequency (0 when absent or excluded).
    /**
     * @param {int32} symbol - Symbol
     * @param {boolean[]} excluded - Symbols ruled out
     * @param {PpmScratch} out - Receives frequency
     * @returns {int32} Cumulative frequency below the symbol
     */
    cumulativeBefore(symbol, excluded, out) {
      /** @type {int32} */
      let cumulative = 0;
      for (let k = 0; k < this.symbols.length; ++k) {
        /** @type {int32} */
        const s = this.symbols[k];
        if (excluded[s]) {
          continue;
        }
        if (s === symbol) {
          out.frequency = this.counts[k];
          return cumulative;
        }
        cumulative += this.counts[k];
      }
      out.frequency = 0;
      return 0;
    }

    // Finds the non-excluded symbol whose frequency range contains target,
    // or -1 when none does.
    /**
     * @param {int32} target - Frequency position
     * @param {boolean[]} excluded - Symbols ruled out
     * @param {PpmScratch} out - Receives cumulative and frequency
     * @returns {int32} Symbol or -1
     */
    symbolAt(target, excluded, out) {
      /** @type {int32} */
      let running = 0;
      for (let k = 0; k < this.symbols.length; ++k) {
        /** @type {int32} */
        const s = this.symbols[k];
        if (excluded[s]) {
          continue;
        }
        /** @type {int32} */
        const count = this.counts[k];
        if (target < running + count) {
          out.cumulative = running;
          out.frequency = count;
          return s;
        }
        running += count;
      }
      out.cumulative = 0;
      out.frequency = 0;
      return -1;
    }

    // Rules out every symbol this context predicts, because escaping from it
    // proved the symbol is none of them.
    /**
     * @param {boolean[]} excluded - Symbols ruled out (extended)
     * @param {PpmScratch} out - excludedCount is increased
     */
    exclude(excluded, out) {
      for (let k = 0; k < this.symbols.length; ++k) {
        /** @type {int32} */
        const s = this.symbols[k];
        if (excluded[s]) {
          continue;
        }
        excluded[s] = true;
        ++out.excludedCount;
      }
    }

    // Increments the count for symbol, appending it when first seen, and halves
    // the table when it would outgrow the coder.
    /**
     * @param {int32} symbol - Symbol seen
     */
    increment(symbol) {
      for (let k = 0; k < this.symbols.length; ++k) {
        if (this.symbols[k] !== symbol) {
          continue;
        }
        ++this.counts[k];
        ++this.total;
        this._rescaleIfNeeded();
        return;
      }

      this.symbols.push(symbol);
      this.counts.push(1);
      ++this.total;
      this._rescaleIfNeeded();
    }

    _rescaleIfNeeded() {
      if (this.total + this.symbols.length <= MAX_FREQUENCY) {
        return;
      }

      /** @type {int32} */
      let total = 0;
      for (let k = 0; k < this.counts.length; ++k) {
        // Round up so no symbol is ever forgotten; a count of one stays one.
        this.counts[k] = Math.floor((this.counts[k] + 1) / 2);
        total += this.counts[k];
      }
      this.total = total;
    }
  }

  /**
   * Contexts of one order, keyed by the packed context bytes (an open-
   * addressing hash table; lookups never depend on insertion order)
   */
  class ContextTable {
    constructor() {
      /** @type {int32[]} */
      this.keys = new Int32Array(64);
      /** @type {Context[]} */
      this.values = new Array(64);
      for (let i = 0; i < 64; i++) {
        this.values[i] = null;
      }
      /** @type {int32} */
      this.mask = 63;
      /** @type {int32} */
      this.count = 0;
    }

    /**
     * @param {int32} key - Packed context bytes
     * @returns {int32} Slot holding the key, or the empty slot where it belongs
     */
    _slot(key) {
      /** @type {int32} */
      let slot = OpCodes.And32(OpCodes.Shr32(OpCodes.Mul32(key, 0x9E3779B1), 7), this.mask);
      while (this.values[slot] !== null && this.keys[slot] !== key) {
        slot = OpCodes.And32(slot + 1, this.mask);
      }
      return slot;
    }

    /**
     * @param {int32} key - Packed context bytes
     * @returns {Context} Context, or null when never seen
     */
    get(key) {
      return this.values[this._slot(key)];
    }

    /**
     * @param {int32} key - Packed context bytes
     * @param {Context} context - New context for the key
     */
    add(key, context) {
      /** @type {int32} */
      const slot = this._slot(key);
      this.keys[slot] = key;
      this.values[slot] = context;
      ++this.count;
      if (this.count * 2 > this.mask) {
        this._grow();
      }
    }

    /** Double the table and re-insert every context */
    _grow() {
      /** @type {int32[]} */
      const oldKeys = this.keys;
      /** @type {Context[]} */
      const oldValues = this.values;
      /** @type {int32} */
      const size = (this.mask + 1) * 2;
      this.keys = new Int32Array(size);
      this.values = new Array(size);
      for (let i = 0; i < size; i++) {
        this.values[i] = null;
      }
      this.mask = size - 1;
      for (let i = 0; i < oldValues.length; i++) {
        if (oldValues[i] !== null) {
          /** @type {int32} */
          const slot = this._slot(oldKeys[i]);
          this.keys[slot] = oldKeys[i];
          this.values[slot] = oldValues[i];
        }
      }
    }
  }

  // The set of contexts of every order the model keeps, keyed by the packed
  // context bytes.
  class Model {
    constructor() {
      /** @type {ContextTable[]} */
      this.byOrder = [];
      for (let order = 0; order <= MAX_ORDER; ++order) {
        this.byOrder.push(new ContextTable());
      }
    }

    // Packs the `order` bytes preceding `position` into a context key.
    /**
     * @param {int32} order - Context length
     * @param {uint8[]} history - Bytes so far
     * @param {int32} position - Current position
     * @returns {int32} Packed key
     */
    static keyOf(order, history, position) {
      /** @type {int32} */
      let key = 0;
      for (let k = order; k >= 1; --k) {
        key = key * 256 + history[position - k];
      }
      return key;
    }

    // Returns the context of the given order at the given position, or null
    // when it has never been seen.
    /**
     * @param {int32} order - Context length
     * @param {uint8[]} history - Bytes so far
     * @param {int32} position - Current position
     * @returns {Context} Context or null
     */
    find(order, history, position) {
      if (order > MAX_ORDER || position < order) {
        return null;
      }
      /** @type {int32} */
      const key = Model.keyOf(order, history, position);
      /** @type {ContextTable} */
      const table = this.byOrder[order];
      /** @type {Context} */
      const context = table.get(key);
      return context;
    }

    // Records symbol in every context of order 0..MAX_ORDER that applies at
    // position.
    /**
     * @param {uint8[]} history - Bytes so far
     * @param {int32} position - Current position
     * @param {int32} symbol - Symbol seen
     */
    update(history, position, symbol) {
      /** @type {int32} */
      const highestOrder = Math.min(MAX_ORDER, position);
      for (let order = 0; order <= highestOrder; ++order) {
        /** @type {ContextTable} */
        const table = this.byOrder[order];
        /** @type {int32} */
        const key = Model.keyOf(order, history, position);
        /** @type {Context} */
        let context = table.get(key);
        if (context === null) {
          context = new Context();
          table.add(key, context);
        }
        context.increment(symbol);
      }
    }
  }

  // ===== ARITHMETIC CODER =====

  // The encoding half of the Witten-Neal-Cleary incremental arithmetic coder: a
  // 16-bit interval renormalised a bit at a time, with straddling (underflow)
  // intervals counted rather than emitted until their direction is known.
  class ArithmeticEncoder {
    /**
     * @param {uint8[]} header - Bytes the output starts with
     */
    constructor(header) {
      /** @type {uint8[]} */
      this.output = [];
      for (let i = 0; i < header.length; ++i) {
        this.output.push(header[i]);
      }
      /** @type {int32} */
      this.low = 0;
      /** @type {int32} */
      this.high = TOP_VALUE;
      /** @type {int32} */
      this.pending = 0;
      /** @type {int32} */
      this.bitBuffer = 0;
      /** @type {int32} */
      this.bitCount = 0;
    }

    // Narrows the interval to the sub-range [cumulativeLow, cumulativeHigh) out
    // of `total`.
    /**
     * @param {int32} cumulativeLow - Range start
     * @param {int32} cumulativeHigh - Range end
     * @param {int32} total - Frequency total
     */
    encode(cumulativeLow, cumulativeHigh, total) {
      /** @type {int32} */
      const range = this.high - this.low + 1;
      this.high = this.low + Math.floor(range * cumulativeHigh / total) - 1;
      this.low = this.low + Math.floor(range * cumulativeLow / total);

      for (;;) {
        if (this.high < HALF) {
          this._emitWithPending(0);
        } else if (this.low >= HALF) {
          this._emitWithPending(1);
          this.low -= HALF;
          this.high -= HALF;
        } else if (this.low >= FIRST_QUARTER && this.high < THIRD_QUARTER) {
          ++this.pending;
          this.low -= FIRST_QUARTER;
          this.high -= FIRST_QUARTER;
        } else {
          break;
        }

        this.low = this.low * 2;
        this.high = this.high * 2 + 1;
      }
    }

    // Disambiguates the final interval, flushes the bit buffer and returns the
    // complete stream.
    /**
     * @returns {uint8[]} Complete stream
     */
    finish() {
      ++this.pending;
      this._emitWithPending(this.low < FIRST_QUARTER ? 0 : 1);
      while (this.bitCount !== 0) {
        this._putBit(0);
      }
      return this.output;
    }

    /**
     * @param {int32} bit - Bit, followed by the pending opposite bits
     */
    _emitWithPending(bit) {
      this._putBit(bit);
      /** @type {int32} */
      const opposite = 1 - bit;
      while (this.pending > 0) {
        this._putBit(opposite);
        --this.pending;
      }
    }

    /**
     * @param {int32} bit - Bit
     */
    _putBit(bit) {
      this.bitBuffer = this.bitBuffer * 2 + bit;
      if (++this.bitCount !== 8) {
        return;
      }
      this.output.push(this.bitBuffer);
      this.bitBuffer = 0;
      this.bitCount = 0;
    }
  }

  // The decoding half of the same coder; bits past the end of the stream read
  // as zero.
  class ArithmeticDecoder {
    /**
     * @param {uint8[]} data - Coded bytes
     * @param {int32} offset - Position of the first coded byte
     */
    constructor(data, offset) {
      /** @type {uint8[]} */
      this.data = data;
      /** @type {int32} */
      this.position = offset;
      /** @type {uint8} */
      this.bitBuffer = 0;
      /** @type {int32} */
      this.bitCount = 0;
      /** @type {int32} */
      this.low = 0;
      /** @type {int32} */
      this.high = TOP_VALUE;
      /** @type {int32} */
      this.value = 0;
      for (let i = 0; i < CODE_BITS; ++i) {
        /** @type {uint32} */
        const bit = this._getBit();
        this.value = this.value * 2 + bit;
      }
    }

    // Reports which of `total` equal slices of the current interval the encoded
    // value falls in.
    /**
     * @param {int32} total - Frequency total
     * @returns {int32} Frequency position of the coded value
     */
    target(total) {
      /** @type {int32} */
      const range = this.high - this.low + 1;
      return Math.floor(((this.value - this.low + 1) * total - 1) / range);
    }

    // Narrows the interval exactly as the encoder did, consuming the symbol
    // just identified.
    /**
     * @param {int32} cumulativeLow - Range start
     * @param {int32} cumulativeHigh - Range end
     * @param {int32} total - Frequency total
     */
    update(cumulativeLow, cumulativeHigh, total) {
      /** @type {int32} */
      const range = this.high - this.low + 1;
      this.high = this.low + Math.floor(range * cumulativeHigh / total) - 1;
      this.low = this.low + Math.floor(range * cumulativeLow / total);

      for (;;) {
        if (this.high < HALF) {
          // Nothing to subtract: the interval is already in the lower half.
        } else if (this.low >= HALF) {
          this.value -= HALF;
          this.low -= HALF;
          this.high -= HALF;
        } else if (this.low >= FIRST_QUARTER && this.high < THIRD_QUARTER) {
          this.value -= FIRST_QUARTER;
          this.low -= FIRST_QUARTER;
          this.high -= FIRST_QUARTER;
        } else {
          break;
        }

        this.low = this.low * 2;
        this.high = this.high * 2 + 1;
        /** @type {uint32} */
        const bit = this._getBit();
        this.value = this.value * 2 + bit;
      }
    }

    /**
     * @returns {uint32} Next bit, 0 past the end
     */
    _getBit() {
      if (this.bitCount === 0) {
        this.bitBuffer = this.position < this.data.length ? this.data[this.position++] : 0;
        this.bitCount = 8;
      }
      --this.bitCount;
      return OpCodes.And32(OpCodes.Shr32(this.bitBuffer, this.bitCount), 1);
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * PPMAlgorithm - Compression algorithm implementation
   * @class
   * @extends {CompressionAlgorithm}
   */
  class PPMAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "PPM (Prediction by Partial Matching)";
      this.description = "Order-3 finite-context model with escape method C and full exclusion, driving a Witten-Neal-Cleary arithmetic coder. Each byte is coded from the longest context that predicts it, escaping down to shorter contexts and finally to a uniform order -1 model, so predictable bytes cost a fraction of a bit each.";
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Statistical";
      this.securityStatus = null;
      this.complexity = ComplexityType.EXPERT;
      this.inventor = "John Cleary, Ian Witten";
      this.year = 1984;
      this.country = CountryCode.INTL;

      // PPM parameters
      this.MAX_ORDER = MAX_ORDER;

      this.documentation = [
        new LinkItem("Cleary and Witten, Data Compression Using Adaptive Coding and Partial String Matching (IEEE Trans. Comm. 32, 1984)", "https://ieeexplore.ieee.org/document/1096090"),
        new LinkItem("Moffat, Implementing the PPM Data Compression Scheme (IEEE Trans. Comm. 38, 1990)", "https://ieeexplore.ieee.org/document/61469"),
        new LinkItem("Witten, Neal and Cleary, Arithmetic Coding for Data Compression (CACM 30, 1987)", "https://dl.acm.org/doi/10.1145/214762.214771")
      ];

      this.references = [
        new LinkItem("Text Compression - Bell, Cleary, Witten", "https://www.amazon.com/Text-Compression-Timothy-C-Bell/dp/0133616900"),
        new LinkItem("PPM - Wikipedia", "https://en.wikipedia.org/wiki/Prediction_by_partial_matching"),
        new LinkItem("Canterbury Corpus", "https://corpus.canterbury.ac.nz/")
      ];

      // Test vectors - byte-exact against CompressionWorkbench's BB_PPM
      // building block. Expected outputs are given as hex.
      //
      // The first two were derived by hand from the published equations: the
      // empty case is the header alone, and the single byte 0x41 meets an empty
      // model, so it is coded in the uniform order -1 context as the interval
      // [65/256, 66/256), which the CACM 1987 encoder renormalises to the bits
      // 01000001 before its two-bit flush and zero padding. The rest were
      // checked against an independently written decoder and against the
      // information content the model itself predicts for the input, which an
      // incorrectly coded stream cannot match.
      this.tests = [
        new TestCase(
          [],
          OpCodes.Hex8ToBytes("0300000000"),
          "Empty input - only the 5-byte header (order 3, zero length)",
          "https://ieeexplore.ieee.org/document/1096090"
        ),
        new TestCase(
          OpCodes.AsciiToBytes("A"),
          OpCodes.Hex8ToBytes("03010000004140"),
          "Single byte 0x41 - no context exists, so it is coded in the uniform order -1 model",
          "https://dl.acm.org/doi/10.1145/214762.214771"
        ),
        new TestCase(
          OpCodes.AsciiToBytes("AA"),
          OpCodes.Hex8ToBytes("03020000004120"),
          "Two identical bytes - the second escapes the order-1 and order-0 contexts, then costs one bit at order -1",
          "https://ieeexplore.ieee.org/document/61469"
        ),
        new TestCase(
          OpCodes.AsciiToBytes("ABABABABABABABAB"),
          OpCodes.Hex8ToBytes("031000000041a0a090"),
          "Alternating two-byte pattern - the order-2 contexts turn deterministic almost immediately",
          "https://ieeexplore.ieee.org/document/1096090"
        ),
        new TestCase(
          (function() { const b = new Array(64); for (let i = 0; i < 64; ++i) b[i] = 0x61; return b; })(),
          OpCodes.Hex8ToBytes("0340000000610040"),
          "Long repetitive run - 64 copies of 0x61 cost a fraction of a bit each",
          "https://ieeexplore.ieee.org/document/1096090"
        ),
        new TestCase(
          OpCodes.AsciiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. "),
          OpCodes.Hex8ToBytes("035a00000074b48df0b3d1cb7eedfab1dd59c3cd5e412caa40daae22b0623d8562a01614b461adf95dcdc03520b7975380000071d0"),
          "English text with a repeated sentence - the second copy is nearly free",
          "https://corpus.canterbury.ac.nz/"
        ),
        new TestCase(
          [243, 204, 191, 171, 157, 143, 229, 84, 239, 176, 155, 208, 176, 245, 186, 148, 128, 53, 183, 104, 65, 66, 101, 148, 122, 107, 131, 193, 65, 79, 229, 58],
          OpCodes.Hex8ToBytes("0320000000f3e6d6c69214c6b021d228a4cca116071313901bfcd274ad71170df0e246cdbae06a18"),
          "Pseudo-random binary sample - every byte escapes down to the order -1 model",
          "https://ieeexplore.ieee.org/document/61469"
        ),
        new TestCase(
          (function() { const b = new Array(256); for (let i = 0; i < 256; ++i) b[i] = i; return b; })(),
          OpCodes.Hex8ToBytes("030001000000804060504844322518904aa6d42a8582e98ad2703c205169752ad58edc7a4426156c16d3e23946bc6d3fa555ecf7b49ac1a9009c5fbae4568e08c5837e396ae89560bf295b31ebe7f55b9e75ad26cb8d62c530e298b1acb936bcf3a6b6058524deaa8365cf3e30e6df18f4306d6b0927a66d6c9ff76af6984a07cfa179583c251100f367ded7d2cecccccdd0d4dae2edfb0b1f375477a1d4105ab525b05d3647a163a69a779e87d485ddffeff456e6bbf9d8b113e6afcb78c340137df245fff98902ae3b4a64ca3716854b444d368ceec1ee87b48247dbea55ba542abd3d9e08219758cd98082cf1c78d2d6ee4f666d89800"),
          "All 256 byte values 0x00..0xFF - every byte is new, so each costs the full order -1 price",
          "https://ieeexplore.ieee.org/document/1096090"
        )
      ];

      // For test suite compatibility
      this.testVectors = this.tests;
    }

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - True to decompress
     * @returns {PPMInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new PPMInstance(this, isInverse);
    }
  }

  /**
   * @param {boolean[]} excluded - Exclusion flags, all cleared
   */
  function clearExclusions(excluded) {
    for (let s = 0; s < NUM_SYMBOLS; ++s) {
      excluded[s] = false;
    }
  }

  class PPMInstance extends IAlgorithmInstance {
    /**
     * @param {PPMAlgorithm} algorithm - Parent algorithm
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
     * @returns {uint8[]} Order byte, size and coded stream
     */
    compress(data) {
      /** @type {uint8[]} */
      let input = data;
      if (!input) {
        input = [];
      }

      /** @type {uint8[]} */
      const lengthBytes = OpCodes.Unpack32LE(OpCodes.ToUint32(input.length));
      /** @type {uint8[]} */
      const header = [MAX_ORDER, lengthBytes[0], lengthBytes[1], lengthBytes[2], lengthBytes[3]];
      if (input.length === 0) {
        return header;
      }

      /** @type {Model} */
      const model = new Model();
      /** @type {ArithmeticEncoder} */
      const encoder = new ArithmeticEncoder(header);
      /** @type {boolean[]} */
      const excluded = new Array(NUM_SYMBOLS);
      clearExclusions(excluded);
      /** @type {PpmScratch} */
      const out = new PpmScratch();

      for (let i = 0; i < input.length; ++i) {
        /** @type {uint32} */
        const symbol = OpCodes.And32(input[i], 0xFF);
        clearExclusions(excluded);
        out.excludedCount = 0;

        /** @type {boolean} */
        let coded = false;
        /** @type {int32} */
        const highestOrder = Math.min(MAX_ORDER, i);
        for (let order = highestOrder; order >= 0; --order) {
          /** @type {Context} */
          const context = model.find(order, input, i);
          if (context === null) {
            continue;
          }

          context.effectiveTotals(excluded, out);
          if (out.escape === 0) {
            continue;
          }
          /** @type {int32} */
          const symbolTotal = out.symbolTotal;

          /** @type {int32} */
          const total = symbolTotal + out.escape;
          /** @type {int32} */
          const cumulative = context.cumulativeBefore(symbol, excluded, out);
          if (out.frequency > 0) {
            encoder.encode(cumulative, cumulative + out.frequency, total);
            coded = true;
            break;
          }

          // Escape occupies the top of the range, above every predicted symbol.
          encoder.encode(symbolTotal, total, total);
          context.exclude(excluded, out);
        }

        if (!coded) {
          // Order -1: every byte value the shorter contexts have not ruled out.
          /** @type {int32} */
          const total = NUM_SYMBOLS - out.excludedCount;
          /** @type {int32} */
          let cumulative = 0;
          for (let s = 0; s < symbol; ++s) {
            if (!excluded[s]) {
              ++cumulative;
            }
          }
          encoder.encode(cumulative, cumulative + 1, total);
        }

        model.update(input, i, symbol);
      }

      /** @type {uint8[]} */
      const coded = encoder.finish();
      return coded;
    }

    /**
     * @param {uint8[]} data - Order byte, size and coded stream (a missing array counts as empty)
     * @returns {uint8[]} Decoded bytes
     */
    decompress(data) {
      /** @type {uint8[]} */
      let input = data;
      if (!input) {
        input = [];
      }
      if (input.length === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }
      if (input.length < 5) {
        throw new Error('PPM: truncated header');
      }

      /** @type {uint8} */
      const maxOrder = input[0];
      if (maxOrder !== MAX_ORDER) {
        throw new Error('PPM: stream declares order ' + maxOrder + ', this model is order ' + MAX_ORDER);
      }

      /** @type {uint32} */
      const originalSize = OpCodes.Pack32LE(input[1], input[2], input[3], input[4]);
      /** @type {uint8[]} */
      const result = new Array(originalSize);
      if (originalSize === 0) {
        return result;
      }

      /** @type {Model} */
      const model = new Model();
      /** @type {ArithmeticDecoder} */
      const decoder = new ArithmeticDecoder(input, 5);
      /** @type {boolean[]} */
      const excluded = new Array(NUM_SYMBOLS);
      clearExclusions(excluded);
      /** @type {PpmScratch} */
      const out = new PpmScratch();

      for (let i = 0; i < originalSize; ++i) {
        clearExclusions(excluded);
        out.excludedCount = 0;
        /** @type {int32} */
        let symbol = -1;

        /** @type {int32} */
        const highestOrder = Math.min(MAX_ORDER, i);
        for (let order = highestOrder; order >= 0; --order) {
          /** @type {Context} */
          const context = model.find(order, result, i);
          if (context === null) {
            continue;
          }

          context.effectiveTotals(excluded, out);
          if (out.escape === 0) {
            continue;
          }
          /** @type {int32} */
          const symbolTotal = out.symbolTotal;

          /** @type {int32} */
          const total = symbolTotal + out.escape;
          /** @type {int32} */
          const target = decoder.target(total);
          if (target >= symbolTotal) {
            decoder.update(symbolTotal, total, total);
            context.exclude(excluded, out);
            continue;
          }

          symbol = context.symbolAt(target, excluded, out);
          if (symbol < 0) {
            throw new Error('PPM: corrupt arithmetic-coded stream');
          }
          decoder.update(out.cumulative, out.cumulative + out.frequency, total);
          break;
        }

        if (symbol < 0) {
          /** @type {int32} */
          const total = NUM_SYMBOLS - out.excludedCount;
          /** @type {int32} */
          const target = decoder.target(total);
          /** @type {int32} */
          let cumulative = 0;
          for (let s = 0; s < NUM_SYMBOLS; ++s) {
            if (excluded[s]) {
              continue;
            }
            if (cumulative === target) {
              symbol = s;
              break;
            }
            ++cumulative;
          }
          if (symbol < 0) {
            throw new Error('PPM: corrupt arithmetic-coded stream');
          }
          decoder.update(cumulative, cumulative + 1, total);
        }

        result[i] = symbol;
        model.update(result, i, symbol);
      }

      return result;
    }
  }


  // ===== REGISTRATION =====

  const algorithmInstance = new PPMAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { PPMAlgorithm, PPMInstance };
}));
