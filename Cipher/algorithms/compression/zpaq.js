/*
 * ZPAQ context-mixing compressor
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The compression core of ZPAQ: data is coded one bit at a time, each bit
 * against a prediction produced by several context models, and the coded bits
 * go through a binary arithmetic coder so that a confident prediction actually
 * costs a fraction of a bit.
 *
 * Model - four direct context models over hashed orders 1..4. Each holds a
 * 16-bit probability that the next bit is 1, indexed by the order's context
 * hash combined with the bits of the current byte decoded so far. Each is
 * updated with a count-scaled step, so a fresh slot moves fast and a
 * well-visited one settles at roughly 1/32 per observation. The four
 * predictions are averaged, matching the simple mixing this model uses.
 *
 * Coder - a carry-propagating binary range coder holding a 32-bit range that
 * is renormalized whenever it drops below 2^24. It keeps ZPAQ's subrange
 * convention: the subrange below the split codes a 1 bit, so the more
 * confident the model is that a 1 follows, the cheaper coding that 1 becomes.
 * Getting that backwards round-trips perfectly and inflates instead of
 * compressing, which is exactly the failure this file used to have. The
 * carry-propagating form is used rather than ZPAQ's carryless low/high pair
 * because the latter can shrink its interval to zero width, whereas keeping
 * the range at or above 2^24 makes both subranges provably non-empty.
 *
 * Not implemented: the journaling archive container, the ZPAQL virtual machine
 * and its configurable COMP/HCOMP sections, deduplication and versioning. This
 * file is the context-mixing compressor alone, over a single stream.
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

  // ===== CONSTANTS =====

  const TOP = 4294967296;          // 2^32
  const RANGE_MAX = 4294967295;    // 2^32 - 1
  const RANGE_MIN = 16777216;      // 2^24, the renormalization threshold
  const BYTE_SHIFT = 16777216;     // 2^24, used to lift out the top byte
  const CARRY_EDGE = 4278190080;   // 0xFF000000
  const PROB_ONE = 65536;
  const PROB_HALF = 32768;
  const PROB_MIN = 1;
  const PROB_MAX = 65535;

  const ORDERS = 4;                // context models over orders 1..4
  const COUNT_LIMIT = 30;          // steady-state adaptation of about 1/32
  const HASH_MULTIPLIER = 2654435761;
  const ORDER_SALT = 2246822519;
  const PARTIAL_MULTIPLIER = 1103515245;

  const MIN_TABLE_BITS = 16;
  const MAX_TABLE_BITS = 20;

  // Table size is derived from the message length, which both sides know from
  // the header, so encoder and decoder always allocate identical models.
  function tableBitsFor(length) {
    let bits = 0;
    let remaining = length;
    while (remaining > 1) { remaining = Math.floor(remaining / 2); bits++; }
    bits += 2;
    if (bits < MIN_TABLE_BITS) bits = MIN_TABLE_BITS;
    if (bits > MAX_TABLE_BITS) bits = MAX_TABLE_BITS;
    return bits;
  }

  // ===== CONTEXT MODEL =====

  class ContextMixingModel {
    constructor(tableBits) {
      this.size = OpCodes.Shl32(1, tableBits);
      this.mask = this.size - 1;
      this.probabilities = [];
      this.counts = [];
      for (let i = 0; i < ORDERS; i++) {
        const table = new Uint16Array(this.size);
        for (let j = 0; j < this.size; j++) table[j] = PROB_HALF;
        this.probabilities.push(table);
        this.counts.push(new Uint8Array(this.size));
      }
      this.contexts = new Int32Array(ORDERS);
      this.slots = new Int32Array(ORDERS);
      this.history = 0;
      this.refreshContexts();
    }

    // Hash of the last `order` bytes, salted so the orders never share a slot
    // by accident.
    refreshContexts() {
      for (let order = 1; order <= ORDERS; order++) {
        // Orders 1..3 keep the low 8/16/24 bits of the history; order 4 is the
        // whole 32-bit history, for which there is no divisor to take.
        const window = order === ORDERS
          ? this.history
          : this.history % OpCodes.Shl32(1, order * 8);
        this.contexts[order - 1] = OpCodes.ToUint32(
          OpCodes.Mul32(OpCodes.ToUint32(window + order), HASH_MULTIPLIER) + OpCodes.Mul32(order, ORDER_SALT)
        );
      }
    }

    // Probability that the next bit is 1, given the bits of the current byte
    // seen so far (`partial` starts at 1 and grows one bit at a time).
    predict(partial) {
      let total = 0;
      for (let i = 0; i < ORDERS; i++) {
        const slot = OpCodes.And32(
          OpCodes.ToUint32(this.contexts[i] + OpCodes.Mul32(partial, PARTIAL_MULTIPLIER)),
          this.mask
        );
        this.slots[i] = slot;
        total += this.probabilities[i][slot];
      }

      let combined = Math.floor(total / ORDERS);
      if (combined < PROB_MIN) combined = PROB_MIN;
      if (combined > PROB_MAX) combined = PROB_MAX;
      return combined;
    }

    // Count-scaled update of every component that contributed to the last
    // prediction. Early observations move a slot a long way; once the count
    // saturates the step settles at about 1/32 of the remaining error.
    update(bit) {
      const target = bit === 1 ? PROB_MAX : 0;
      for (let i = 0; i < ORDERS; i++) {
        const slot = this.slots[i];
        const observed = this.counts[i][slot];
        const current = this.probabilities[i][slot];
        this.probabilities[i][slot] = current + Math.floor((target - current) / (observed + 2));
        if (observed < COUNT_LIMIT) this.counts[i][slot] = observed + 1;
      }
    }

    // Fold a finished byte into the history and recompute the order hashes.
    pushByte(value) {
      this.history = OpCodes.ToUint32(this.history * 256 + value);
      this.refreshContexts();
    }
  }

  // ===== BINARY RANGE CODER =====

  class RangeEncoder {
    constructor() {
      this.low = 0;
      this.range = RANGE_MAX;
      this.cache = 0;
      this.pending = 1;
      this.bytes = [];
    }

    encodeBit(bit, probabilityOfOne) {
      const bound = Math.floor(this.range / PROB_ONE) * probabilityOfOne;
      if (bit === 1) {
        this.range = bound;
      } else {
        this.low += bound;
        this.range -= bound;
      }
      while (this.range < RANGE_MIN) {
        this.shiftLow();
        this.range *= 256;
      }
    }

    shiftLow() {
      const carry = this.low >= TOP ? 1 : 0;
      const value = this.low - carry * TOP;

      if (value < CARRY_EDGE || carry === 1) {
        let held = this.cache;
        do {
          this.bytes.push((held + carry) % 256);
          held = 255;
          this.pending--;
        } while (this.pending !== 0);
        this.cache = Math.floor(value / BYTE_SHIFT);
      }

      this.pending++;
      this.low = (value % BYTE_SHIFT) * 256;
    }

    finish() {
      for (let i = 0; i < 5; i++) this.shiftLow();
      return this.bytes;
    }
  }

  class RangeDecoder {
    constructor(data, offset) {
      this.data = data;
      this.position = offset;
      this.range = RANGE_MAX;
      this.code = 0;
      for (let i = 0; i < 5; i++) this.code = OpCodes.ToUint32(this.code * 256) + this.nextByte();
    }

    nextByte() {
      if (this.position >= this.data.length) return 0;
      return this.data[this.position++];
    }

    decodeBit(probabilityOfOne) {
      const bound = Math.floor(this.range / PROB_ONE) * probabilityOfOne;
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
        this.range *= 256;
        this.code = OpCodes.ToUint32(this.code * 256) + this.nextByte();
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
      this.description = "The context-mixing compressor at the heart of ZPAQ: four direct context models over hashed orders 1 to 4 predict each bit of the message, their predictions are averaged, and a binary range coder turns confident predictions into fractions of a bit. Covers the modelling and coding stages only - the journaling archive container, the ZPAQL virtual machine with its configurable COMP/HCOMP sections, deduplication and versioning are not implemented.";
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
      // every model slot still holds the initial probability 32768, and each
      // bit of the first byte lands on a slot nobody has touched yet, so all
      // eight bits are coded at exactly one half. That makes the coder's bound
      // arithmetic (bound = floor(range/65536) * 32768) and its flush sequence
      // reproducible with pencil and paper.
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

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
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

      const model = new ContextMixingModel(tableBitsFor(data.length));
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

      if (data.length < 4) return [];
      const originalLength = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      if (originalLength === 0) return [];

      const model = new ContextMixingModel(tableBitsFor(originalLength));
      const decoder = new RangeDecoder(data, 4);
      const output = new Array(originalLength);

      for (let i = 0; i < originalLength; i++) {
        let partial = 1;
        for (let b = 0; b < 8; b++) {
          const bit = decoder.decodeBit(model.predict(partial));
          model.update(bit);
          partial = partial * 2 + bit;
        }
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
