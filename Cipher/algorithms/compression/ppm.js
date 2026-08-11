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
  const MAX_ORDER = 3;
  const NUM_SYMBOLS = 256;
  const CODE_BITS = 16;
  const TOP_VALUE = 65535;
  const FIRST_QUARTER = 16384;
  const HALF = 32768;
  const THIRD_QUARTER = 49152;
  const MAX_FREQUENCY = 16383;

  // ===== MODEL =====

  // One finite context: the symbols seen after it, in first-seen order, with
  // their occurrence counts. First-seen order is part of the wire format,
  // because it fixes where each symbol sits in the coder's frequency range.
  class Context {
    constructor() {
      this.symbols = [];
      this.counts = [];
      this.total = 0;
    }

    // Splits the frequency mass into (escape frequency, sum of symbol
    // frequencies) under the current exclusion set.
    effectiveTotals(excluded) {
      let escape = 0;
      let sum = 0;
      for (let k = 0; k < this.symbols.length; ++k) {
        if (excluded[this.symbols[k]]) continue;
        sum += this.counts[k];
        ++escape;
      }
      return { escape: escape, symbolTotal: sum };
    }

    // Sums the frequencies of the non-excluded symbols preceding symbol, and
    // reports its own frequency (0 when absent or excluded).
    cumulativeBefore(symbol, excluded, out) {
      let cumulative = 0;
      for (let k = 0; k < this.symbols.length; ++k) {
        const s = this.symbols[k];
        if (excluded[s]) continue;
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
    symbolAt(target, excluded, out) {
      let running = 0;
      for (let k = 0; k < this.symbols.length; ++k) {
        const s = this.symbols[k];
        if (excluded[s]) continue;
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
    exclude(excluded, out) {
      for (let k = 0; k < this.symbols.length; ++k) {
        const s = this.symbols[k];
        if (excluded[s]) continue;
        excluded[s] = true;
        ++out.excludedCount;
      }
    }

    // Increments the count for symbol, appending it when first seen, and halves
    // the table when it would outgrow the coder.
    increment(symbol) {
      for (let k = 0; k < this.symbols.length; ++k) {
        if (this.symbols[k] !== symbol) continue;
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
      if (this.total + this.symbols.length <= MAX_FREQUENCY) return;

      let total = 0;
      for (let k = 0; k < this.counts.length; ++k) {
        // Round up so no symbol is ever forgotten; a count of one stays one.
        this.counts[k] = Math.floor((this.counts[k] + 1) / 2);
        total += this.counts[k];
      }
      this.total = total;
    }
  }

  // The set of contexts of every order the model keeps, keyed by the packed
  // context bytes.
  class Model {
    constructor() {
      this.byOrder = [];
      for (let order = 0; order <= MAX_ORDER; ++order) this.byOrder.push(new Map());
    }

    // Packs the `order` bytes preceding `position` into a context key.
    static keyOf(order, history, position) {
      let key = 0;
      for (let k = order; k >= 1; --k) key = key * 256 + history[position - k];
      return key;
    }

    // Returns the context of the given order at the given position, or null
    // when it has never been seen.
    find(order, history, position) {
      if (order > MAX_ORDER || position < order) return null;
      const context = this.byOrder[order].get(Model.keyOf(order, history, position));
      return context === undefined ? null : context;
    }

    // Records symbol in every context of order 0..MAX_ORDER that applies at
    // position.
    update(history, position, symbol) {
      const highestOrder = Math.min(MAX_ORDER, position);
      for (let order = 0; order <= highestOrder; ++order) {
        const table = this.byOrder[order];
        const key = Model.keyOf(order, history, position);
        let context = table.get(key);
        if (context === undefined) {
          context = new Context();
          table.set(key, context);
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
    constructor(header) {
      this.output = [];
      for (let i = 0; i < header.length; ++i) this.output.push(header[i]);
      this.low = 0;
      this.high = TOP_VALUE;
      this.pending = 0;
      this.bitBuffer = 0;
      this.bitCount = 0;
    }

    // Narrows the interval to the sub-range [cumulativeLow, cumulativeHigh) out
    // of `total`.
    encode(cumulativeLow, cumulativeHigh, total) {
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
    finish() {
      ++this.pending;
      this._emitWithPending(this.low < FIRST_QUARTER ? 0 : 1);
      while (this.bitCount !== 0) this._putBit(0);
      return this.output;
    }

    _emitWithPending(bit) {
      this._putBit(bit);
      const opposite = 1 - bit;
      while (this.pending > 0) {
        this._putBit(opposite);
        --this.pending;
      }
    }

    _putBit(bit) {
      this.bitBuffer = this.bitBuffer * 2 + bit;
      if (++this.bitCount !== 8) return;
      this.output.push(this.bitBuffer);
      this.bitBuffer = 0;
      this.bitCount = 0;
    }
  }

  // The decoding half of the same coder; bits past the end of the stream read
  // as zero.
  class ArithmeticDecoder {
    constructor(data, offset) {
      this.data = data;
      this.position = offset;
      this.bitBuffer = 0;
      this.bitCount = 0;
      this.low = 0;
      this.high = TOP_VALUE;
      this.value = 0;
      for (let i = 0; i < CODE_BITS; ++i) this.value = this.value * 2 + this._getBit();
    }

    // Reports which of `total` equal slices of the current interval the encoded
    // value falls in.
    target(total) {
      const range = this.high - this.low + 1;
      return Math.floor(((this.value - this.low + 1) * total - 1) / range);
    }

    // Narrows the interval exactly as the encoder did, consuming the symbol
    // just identified.
    update(cumulativeLow, cumulativeHigh, total) {
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
        this.value = this.value * 2 + this._getBit();
      }
    }

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

    CreateInstance(isInverse = false) {
      return new PPMInstance(this, isInverse);
    }
  }

  class PPMInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse; // true = decompress, false = compress
      this.inputBuffer = [];
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      const result = this.isInverse ?
        this.decompress(this.inputBuffer) :
        this.compress(this.inputBuffer);

      this.inputBuffer = [];
      return result;
    }

    compress(data) {
      data = data || [];

      const lengthBytes = OpCodes.Unpack32LE(OpCodes.ToUint32(data.length));
      const header = [MAX_ORDER, lengthBytes[0], lengthBytes[1], lengthBytes[2], lengthBytes[3]];
      if (data.length === 0) return header;

      const model = new Model();
      const encoder = new ArithmeticEncoder(header);
      const excluded = new Array(NUM_SYMBOLS).fill(false);
      const out = { frequency: 0, cumulative: 0, excludedCount: 0 };

      for (let i = 0; i < data.length; ++i) {
        const symbol = OpCodes.And32(data[i], 0xFF);
        for (let s = 0; s < NUM_SYMBOLS; ++s) excluded[s] = false;
        out.excludedCount = 0;

        let coded = false;
        const highestOrder = Math.min(MAX_ORDER, i);
        for (let order = highestOrder; order >= 0; --order) {
          const context = model.find(order, data, i);
          if (context === null) continue;

          const totals = context.effectiveTotals(excluded);
          if (totals.escape === 0) continue;

          const total = totals.symbolTotal + totals.escape;
          const cumulative = context.cumulativeBefore(symbol, excluded, out);
          if (out.frequency > 0) {
            encoder.encode(cumulative, cumulative + out.frequency, total);
            coded = true;
            break;
          }

          // Escape occupies the top of the range, above every predicted symbol.
          encoder.encode(totals.symbolTotal, total, total);
          context.exclude(excluded, out);
        }

        if (!coded) {
          // Order -1: every byte value the shorter contexts have not ruled out.
          const total = NUM_SYMBOLS - out.excludedCount;
          let cumulative = 0;
          for (let s = 0; s < symbol; ++s) if (!excluded[s]) ++cumulative;
          encoder.encode(cumulative, cumulative + 1, total);
        }

        model.update(data, i, symbol);
      }

      return encoder.finish();
    }

    decompress(data) {
      data = data || [];
      if (data.length === 0) return [];
      if (data.length < 5) throw new Error('PPM: truncated header');

      const maxOrder = data[0];
      if (maxOrder !== MAX_ORDER)
        throw new Error('PPM: stream declares order ' + maxOrder + ', this model is order ' + MAX_ORDER);

      const originalSize = OpCodes.Pack32LE(data[1], data[2], data[3], data[4]);
      if (originalSize === 0) return [];

      const model = new Model();
      const decoder = new ArithmeticDecoder(data, 5);
      const excluded = new Array(NUM_SYMBOLS).fill(false);
      const out = { frequency: 0, cumulative: 0, excludedCount: 0 };
      const result = new Array(originalSize);

      for (let i = 0; i < originalSize; ++i) {
        for (let s = 0; s < NUM_SYMBOLS; ++s) excluded[s] = false;
        out.excludedCount = 0;
        let symbol = -1;

        const highestOrder = Math.min(MAX_ORDER, i);
        for (let order = highestOrder; order >= 0; --order) {
          const context = model.find(order, result, i);
          if (context === null) continue;

          const totals = context.effectiveTotals(excluded);
          if (totals.escape === 0) continue;

          const total = totals.symbolTotal + totals.escape;
          const target = decoder.target(total);
          if (target >= totals.symbolTotal) {
            decoder.update(totals.symbolTotal, total, total);
            context.exclude(excluded, out);
            continue;
          }

          symbol = context.symbolAt(target, excluded, out);
          if (symbol < 0) throw new Error('PPM: corrupt arithmetic-coded stream');
          decoder.update(out.cumulative, out.cumulative + out.frequency, total);
          break;
        }

        if (symbol < 0) {
          const total = NUM_SYMBOLS - out.excludedCount;
          const target = decoder.target(total);
          let cumulative = 0;
          for (let s = 0; s < NUM_SYMBOLS; ++s) {
            if (excluded[s]) continue;
            if (cumulative === target) {
              symbol = s;
              break;
            }
            ++cumulative;
          }
          if (symbol < 0) throw new Error('PPM: corrupt arithmetic-coded stream');
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
