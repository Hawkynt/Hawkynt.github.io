/*
 * ZPAQ context-mixing compressor
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The compression core of ZPAQ: data is coded one bit at a time, each bit
 * against a prediction produced by several context models, and the coded bits
 * go through a binary range coder so that a confident prediction actually costs
 * a fraction of a bit.
 *
 * Model - four direct context models (ZPAQ CM components) over hashed orders
 * 1..4. Each holds 65536 counters of 16 bits, all starting at one half. After
 * every whole byte the four order hashes are rebuilt with ZPAQ's HASH step,
 * h = (h + b + 512) * 773 taken modulo 2^32, folded from the most recent byte
 * outwards, so order n hashes the last n bytes and bytes before the start of
 * the message read as zero. Before each bit the hash is offset by the partly
 * coded byte times 0x9E3779B1, and the low 16 bits of that select the counter.
 * The four counters are averaged with truncation, and each is then moved
 * towards the observed bit by one sixteenth of the remaining error, rounded
 * towards minus infinity.
 *
 * Coder - a carry-propagating binary range coder. It splits the range by
 * bound = floor(range / 2^16) * p and gives the lower subrange to a 1 bit, ZPAQ's
 * convention, so the more confident the model is that a 1 follows the cheaper
 * coding that 1 becomes. Getting that backwards round-trips perfectly and
 * inflates instead of compressing, which is exactly the failure this file used
 * to have.
 *
 * Coder safety - on entry to every bit the range lies in [2^24, 2^32) and the
 * probability in [1, 65535]. The 1 subrange is then at least
 * floor(2^24 / 2^16) * 1 = 256 wide, and the 0 subrange is
 * range - bound, which is at least floor(range / 2^16), so also at least 256
 * wide. Neither can ever be empty. Renormalisation multiplies a range below
 * 2^24 by 256 until it is not, which takes at most two steps and cannot reach
 * 2^32, so the invariant is restored exactly rather than merely approached.
 * An interval collapse, where one subrange has zero width and the coder can no
 * longer distinguish the two bits, is therefore impossible.
 *
 * Wire format - a 4-byte little-endian uncompressed length followed by the
 * coded bytes. An empty message is the header alone. The decoder learns the
 * byte count from the header, so the coded stream carries no end marker.
 *
 * Not implemented: the journaling archive container, the general ZPAQL virtual
 * machine with its configurable COMP/HCOMP sections, deduplication and
 * versioning. This file is the context-mixing compressor alone, over a single
 * stream, with the one fixed model above rather than a programmable one.
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
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== CODER CONSTANTS =====

  const TOP = 4294967296;          // 2^32
  const RANGE_MAX = 4294967295;    // 2^32 - 1, the initial range
  const RANGE_MIN = 16777216;      // 2^24, the renormalization threshold
  const TOP_BYTE = 16777216;       // 2^24, the place value of the top byte
  const CARRY_EDGE = 4278190080;   // 0xFF000000, above which a carry still ripples
  const BYTE_BASE = 256;
  const PROB_SCALE = 65536;        // probabilities are fractions of 2^16
  const PROB_HALF = 32768;
  const PROB_MIN = 1;
  const PROB_MAX = 65535;
  const FLUSH_BYTES = 5;

  // ===== MODEL CONSTANTS =====

  const ORDERS = 4;                // context models over orders 1..4
  const TABLE_SIZE = 65536;        // counters per model
  const ADAPT_DIVISOR = 16;        // one sixteenth of the remaining error per observation
  const HASH_ADDEND = 512;         // the addend of ZPAQ's HASH step
  const HASH_MULTIPLIER = 773;     // the multiplier of ZPAQ's HASH step
  const PARTIAL_MULTIPLIER = 2654435761; // 0x9E3779B1, spreads the partly coded byte
  const HISTORY_SIZE = 65536;      // ring of recent bytes the order hashes read
  const HEADER_BYTES = 4;

  // ===== CONTEXT MODEL =====

  /**
   * Four direct context models over hashed orders 1..4, averaged.
   * @class
   */
  class ContextMixingModel {
    constructor() {
      this.tables = [];
      for (let i = 0; i < ORDERS; i++) {
        const table = new Uint16Array(TABLE_SIZE);
        table.fill(PROB_HALF);
        this.tables.push(table);
      }
      // Before the first byte no order hash has been computed, so every context
      // is zero and all four models address the same counter value, one half.
      this.contexts = new Uint32Array(ORDERS);
      this.slots = new Int32Array(ORDERS);
      this.history = new Uint8Array(HISTORY_SIZE);
      this.cursor = 0;
    }

    /**
     * Probability that the next bit is 1, given the bits of the current byte
     * seen so far. `partial` starts at 1 and takes on one more bit each time,
     * so it identifies both the bit position and the prefix.
     * @param {number} partial - leading 1 followed by the bits coded so far
     * @returns {number} probability of a 1 bit, in 1..65535
     */
    predict(partial) {
      // A single odd multiple of the prefix offsets all four hashes. It is odd,
      // so distinct prefixes never land on the same counter within one model.
      const spread = OpCodes.Mul32(partial, PARTIAL_MULTIPLIER);

      let total = 0;
      for (let i = 0; i < ORDERS; i++) {
        // The low 16 bits of the offset hash. They survive the wrap at 32 bits
        // untouched, so no separate reduction is needed before taking them.
        const slot = (this.contexts[i] + spread) % TABLE_SIZE;
        this.slots[i] = slot;
        total += this.tables[i][slot];
      }

      let combined = Math.floor(total / ORDERS);
      if (combined < PROB_MIN) combined = PROB_MIN;
      if (combined > PROB_MAX) combined = PROB_MAX;
      return combined;
    }

    /**
     * Moves every counter that contributed to the last prediction towards the
     * observed bit by one sixteenth of the remaining error. The division rounds
     * towards minus infinity, which is what lets a counter reach 0 exactly
     * while it only ever approaches 65535.
     * @param {number} bit - the observed bit, 0 or 1
     */
    update(bit) {
      const target = bit === 1 ? PROB_MAX : 0;
      for (let i = 0; i < ORDERS; i++) {
        const slot = this.slots[i];
        const current = this.tables[i][slot];
        this.tables[i][slot] = current + Math.floor((target - current) / ADAPT_DIVISOR);
      }
    }

    /**
     * Appends a finished byte to the history ring and rebuilds the four order
     * hashes from it with ZPAQ's HASH step.
     * @param {number} value - the byte just coded
     */
    pushByte(value) {
      this.history[this.cursor] = value;
      this.cursor = (this.cursor + 1) % HISTORY_SIZE;

      // Fold in the most recent byte first, then one byte further back for each
      // further order, so order n is the hash of the last n bytes. The ring is
      // far longer than the deepest order and starts as zeros, so positions
      // before the start of the message read as zero and never alias.
      let hash = 0;
      for (let order = 1; order <= ORDERS; order++) {
        const back = (this.cursor + HISTORY_SIZE - order) % HISTORY_SIZE;
        hash = OpCodes.Mul32(
          OpCodes.ToUint32(hash + this.history[back] + HASH_ADDEND),
          HASH_MULTIPLIER
        );
        this.contexts[order - 1] = hash;
      }
    }
  }

  // ===== BINARY RANGE CODER =====

  /**
   * Splits the range between the two bit values. See the file header for the
   * invariant that keeps both subranges at least 256 wide.
   * @param {number} range - the current range, at least 2^24
   * @param {number} probabilityOfOne - probability of a 1 bit
   * @returns {number} the width of the 1 subrange
   */
  function splitRange(range, probabilityOfOne) {
    let p = probabilityOfOne;
    if (p < PROB_MIN) p = PROB_MIN;
    if (p > PROB_MAX) p = PROB_MAX;
    return Math.floor(range / PROB_SCALE) * p;
  }

  /**
   * Carry-propagating binary range encoder.
   * @class
   */
  class RangeEncoder {
    constructor() {
      this.low = 0;
      this.range = RANGE_MAX;
      this.cache = 0;
      this.pending = 1;
      this.bytes = [];
    }

    encodeBit(bit, probabilityOfOne) {
      const bound = splitRange(this.range, probabilityOfOne);
      if (bit === 1) {
        this.range = bound;
      } else {
        this.low += bound;
        this.range -= bound;
      }
      while (this.range < RANGE_MIN) {
        this.shiftLow();
        this.range *= BYTE_BASE;
      }
    }

    // Emits the top byte of `low`, holding it back while a later carry could
    // still increment it. A run of 0xFF bytes is only counted; when a byte
    // arrives that either cannot carry or has just carried, the whole run is
    // resolved at once.
    shiftLow() {
      const carry = this.low >= TOP ? 1 : 0;
      const value = this.low - carry * TOP;

      if (value < CARRY_EDGE || carry === 1) {
        let held = this.cache;
        do {
          this.bytes.push((held + carry) % BYTE_BASE);
          held = 255;
          this.pending--;
        } while (this.pending !== 0);
        this.cache = Math.floor(value / TOP_BYTE);
      }

      this.pending++;
      this.low = (value % TOP_BYTE) * BYTE_BASE;
    }

    finish() {
      for (let i = 0; i < FLUSH_BYTES; i++) this.shiftLow();
      return this.bytes;
    }
  }

  /**
   * Carry-propagating binary range decoder, the exact mirror of RangeEncoder.
   * @class
   */
  class RangeDecoder {
    constructor(data, offset) {
      this.data = data;
      this.position = offset;
      this.range = RANGE_MAX;
      this.code = 0;
      // The encoder's first flushed byte is always its initially empty cache,
      // so the code word is the five leading bytes read big-endian into 32 bits.
      for (let i = 0; i < FLUSH_BYTES; i++)
        this.code = OpCodes.ToUint32(this.code * BYTE_BASE) + this.nextByte();
    }

    // Past the end of the stream the flush has already pinned every remaining
    // bit, so the padding value only has to agree with the encoder's.
    nextByte() {
      if (this.position >= this.data.length) return 0;
      return this.data[this.position++];
    }

    decodeBit(probabilityOfOne) {
      const bound = splitRange(this.range, probabilityOfOne);
      let bit;
      if (this.code < bound) {
        bit = 1;
        this.range = bound;
      } else {
        bit = 0;
        this.code -= bound;
        this.range -= bound;
      }
      while (this.range < RANGE_MIN) {
        this.range *= BYTE_BASE;
        this.code = OpCodes.ToUint32(this.code * BYTE_BASE) + this.nextByte();
      }
      return bit;
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * ZPAQAlgorithm - ZPAQ's context-mixing compressor
   * @class
   * @extends {CompressionAlgorithm}
   */
  class ZPAQAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ZPAQ (Context Mixing)";
      this.description = "The context-mixing compressor at the heart of ZPAQ: four direct context models over hashed orders 1 to 4 predict each bit of the message, their predictions are averaged, and a carry-propagating binary range coder turns confident predictions into fractions of a bit. The order hashes are rebuilt after every byte with ZPAQ's HASH step, h = (h + b + 512) * 773 modulo 2 to the 32. Covers the modelling and coding stages only - the journaling archive container, the general ZPAQL virtual machine with its configurable COMP/HCOMP sections, deduplication and versioning are not implemented.";
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Context Mixing";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.inventor = "Matt Mahoney";
      this.year = 2009;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("ZPAQ specification and tools", "http://mattmahoney.net/dc/zpaq.html"),
        new LinkItem("The ZPAQ Open Standard Format", "http://mattmahoney.net/dc/zpaq206.pdf"),
        new LinkItem("Data Compression Explained - context mixing", "http://mattmahoney.net/dc/dce.html")
      ];

      this.references = [
        new LinkItem("libzpaq reference implementation", "https://github.com/zpaq/zpaq"),
        new LinkItem("PAQ family of compressors", "https://en.wikipedia.org/wiki/PAQ"),
        new LinkItem("Context mixing", "https://en.wikipedia.org/wiki/Context_mixing")
      ];

      // Wire format: [uint32 LE original length][range-coded payload].
      //
      // The vectors below were derived by hand. Before any byte has been seen,
      // every counter still holds the initial probability 32768, and each bit of
      // the first byte lands on a counter nobody has touched yet, so all eight
      // bits are coded at exactly one half. That makes the coder's bound
      // arithmetic and its flush sequence reproducible with pencil and paper.
      this.tests = [
        new TestCase(
          [],
          [0, 0, 0, 0],
          "Empty input - length header only",
          "http://mattmahoney.net/dc/zpaq.html"
        ),
        new TestCase(
          [0],
          [1, 0, 0, 0, 0, 254, 255, 128, 0],
          "Single zero byte - eight bits coded at one half",
          "http://mattmahoney.net/dc/zpaq206.pdf"
        ),
        new TestCase(
          [65],
          [1, 0, 0, 0, 0, 189, 255, 128, 0],
          "Single byte 0x41 - pins the subrange convention",
          "http://mattmahoney.net/dc/dce.html"
        ),
        // Round-trip only from here on: once the models start adapting, the
        // byte stream is no longer something a human can reproduce by hand.
        new TestCase(OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. "), [], "Natural text round-trip", "Regression test for model desync"),
        new TestCase(Array.from({ length: 256 }, (_, i) => i), [], "All 256 byte values round-trip", "Regression test for model desync"),
        new TestCase(new Array(1024).fill(0x61), [], "Long run round-trip", "Regression test for high-confidence predictions"),
        new TestCase(Array.from({ length: 128 }, (_, i) => i % 2 ? 0x62 : 0x61), [], "Alternating pattern round-trip", "Regression test for renormalization")
      ];

      // For test suite compatibility
      this.testVectors = this.tests;
    }

    CreateInstance(isInverse = false) {
      return new ZPAQInstance(this, isInverse);
    }
  }

  class ZPAQInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }


    Result() {
      if (this.isInverse) {
        // A compressed stream always carries at least the 4-byte length
        // header, so an empty buffer is not a valid compressed message.
        if (this.inputBuffer.length === 0) return [];
        return this._decompress();
      }
      return this._compress();
    }

    _compress() {
      const data = this.inputBuffer;
      this.inputBuffer = [];

      const output = OpCodes.Unpack32LE(OpCodes.ToUint32(data.length));
      if (data.length === 0) return output;

      const model = new ContextMixingModel();
      const encoder = new RangeEncoder();

      for (let i = 0; i < data.length; i++) {
        const value = data[i];
        let partial = 1;
        for (let b = 7; b >= 0; b--) {
          const bit = OpCodes.GetBit(value, b) ? 1 : 0;
          encoder.encodeBit(bit, model.predict(partial));
          model.update(bit);
          partial = partial * 2 + bit;
        }
        model.pushByte(value);
      }

      const payload = encoder.finish();
      for (let i = 0; i < payload.length; i++) output.push(payload[i]);
      return output;
    }

    _decompress() {
      const data = this.inputBuffer;
      this.inputBuffer = [];

      if (data.length < HEADER_BYTES) return [];
      const originalLength = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      if (originalLength === 0) return [];

      const model = new ContextMixingModel();
      const decoder = new RangeDecoder(data, HEADER_BYTES);
      const output = new Array(originalLength);

      for (let i = 0; i < originalLength; i++) {
        let partial = 1;
        for (let b = 0; b < 8; b++) {
          const bit = decoder.decodeBit(model.predict(partial));
          model.update(bit);
          partial = partial * 2 + bit;
        }
        // The leading 1 that started `partial` has been carried to bit 8.
        const value = partial - 256;
        output[i] = value;
        model.pushByte(value);
      }

      return output;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new ZPAQAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ZPAQAlgorithm, ZPAQInstance, ContextMixingModel, RangeEncoder, RangeDecoder };
}));
