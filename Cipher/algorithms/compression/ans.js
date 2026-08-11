/*
 * uABS (Uniform Binary Asymmetric Numeral Systems) Compression
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Binary member of the ANS family described by Jarek Duda. The message is
 * expanded into a bit sequence and every bit is coded with the uABS
 * transition pair
 *
 *     decode(x)     -> bit = floor((x+1)*p) - floor(x*p)
 *                      x'  = bit ? floor(x*p) : x - floor(x*p)
 *     encode(x', 1) =  ceil((x'+1)/p) - 1
 *     encode(x', 0) =  floor(x'/(1-p))
 *
 * where p is the probability of a one bit, held as a 16-bit fraction. The
 * coder keeps a single scalar state in [2^16, 2^24) and renormalizes a whole
 * byte at a time.
 *
 * This is deliberately NOT the range variant (see rans.js) and NOT a table
 * variant (see fse.js and tans.js): there is no frequency table and no state
 * table at all. The probability feeding each coding step comes from an order-0
 * adaptive binary context tree - 255 contexts, one per prefix of the bits of
 * the current byte - so no model is transmitted. Because ANS is
 * last-in-first-out, the encoder runs the model forward once to record the
 * probability that governed each bit, then codes the bits backwards; the
 * decoder runs the identical model forward and stays in step.
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

  // ===== uABS CONSTANTS =====

  const PROB_ONE = 65536;        // probability scale: p equals p1 / PROB_ONE
  const PROB_HALF = 32768;       // initial probability of every context
  const PROB_MIN = 1;            // p never reaches 0 or 1, so every bit stays codable
  const PROB_MAX = 65535;
  const STATE_LOWER = 65536;     // coding interval is [STATE_LOWER, STATE_UPPER)
  const STATE_UPPER = 16777216;  // 256 * STATE_LOWER: renormalization unit is one byte
  const RENORM_BYTE = 256;
  const ADAPT_RATE = 32;         // a context moves 1/32 of the way per observed bit
  const CONTEXT_COUNT = 256;     // binary context tree over the 8 bits of one byte

  // ===== uABS CORE =====

  // Encoding transition. Both branches are monotonically non-decreasing in
  // state, which is what makes the renormalization loop terminate, and both
  // land back inside [STATE_LOWER, STATE_UPPER) once the loop stops.
  function uabsEncodeStep(state, bit, p1) {
    if (bit === 1) return Math.floor(((state + 1) * PROB_ONE + p1 - 1) / p1) - 1;
    return Math.floor(state * PROB_ONE / (PROB_ONE - p1));
  }

  // Count of one-bit states strictly below the given state, i.e. floor(state*p).
  function uabsCountBelow(state, p1) {
    return Math.floor(state * p1 / PROB_ONE);
  }

  // Adaptive update of one binary context: an exponential moving average with
  // rate 1/ADAPT_RATE, clamped away from the degenerate probabilities.
  function adaptProbability(p1, bit) {
    let updated = bit === 1
      ? p1 + Math.floor((PROB_ONE - p1) / ADAPT_RATE)
      : p1 - Math.floor(p1 / ADAPT_RATE);
    if (updated < PROB_MIN) updated = PROB_MIN;
    if (updated > PROB_MAX) updated = PROB_MAX;
    return updated;
  }

  function newModel() {
    const model = new Uint16Array(CONTEXT_COUNT);
    for (let i = 0; i < CONTEXT_COUNT; i++) model[i] = PROB_HALF;
    return model;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * UABSAlgorithm - binary ANS entropy coder
   * @class
   * @extends {CompressionAlgorithm}
   */
  class UABSAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "uABS (Binary Asymmetric Numeral Systems)";
      this.description = "Binary variant of Asymmetric Numeral Systems. Each bit of the message is coded with the uABS transition pair against a 24-bit state that renormalizes one byte at a time. Probabilities come from an order-0 adaptive binary context tree, so no frequency table is transmitted. Distinct from the range variant (rANS) and from the table variants (FSE, tANS), which are implemented separately.";
      this.inventor = "Jarek Duda";
      this.year = 2009;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Entropy Coding";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.PL;

      this.documentation = [
        new LinkItem("Asymmetric Numeral Systems (original paper)", "https://arxiv.org/abs/0902.0271"),
        new LinkItem("ANS with applications to data compression", "https://arxiv.org/abs/1311.2540"),
        new LinkItem("ANS on Wikipedia (uABS section)", "https://en.wikipedia.org/wiki/Asymmetric_numeral_systems")
      ];

      this.references = [
        new LinkItem("Jarek Duda homepage", "http://th.if.uj.edu.pl/~dudaj/"),
        new LinkItem("ryg_rans (range variant, for comparison)", "https://github.com/rygorous/ryg_rans"),
        new LinkItem("Finite State Entropy (table variant, for comparison)", "https://github.com/Cyan4973/FiniteStateEntropy")
      ];

      // Wire format:
      //   [uint32 LE original length][uint32 BE final state][renormalization bytes]
      // The state reads big-endian because the encoder emits its bytes
      // little-endian and then reverses the whole tail so the decoder can walk
      // it front to back.
      //
      // Every context starts at PROB_HALF, and at p = 1/2 the uABS transitions
      // collapse to state -> 2*state + bit; that is what makes the single-byte
      // cases below derivable with pencil and paper. The two-byte case
      // additionally pins the context adaptation rule.
      this.tests = [
        new TestCase(
          [],
          [0, 0, 0, 0],
          "Empty input - length header only",
          "https://arxiv.org/abs/0902.0271"
        ),
        new TestCase(
          [0],
          [1, 0, 0, 0, 0, 1, 0, 0, 0],
          "Single zero byte - eight bits coded at p=1/2",
          "https://arxiv.org/abs/1311.2540"
        ),
        new TestCase(
          [65],
          [1, 0, 0, 0, 0, 1, 0, 0, 65],
          "Single byte 0x41 - renormalization emits one payload byte",
          "https://en.wikipedia.org/wiki/Asymmetric_numeral_systems"
        ),
        new TestCase(
          [255],
          [1, 0, 0, 0, 0, 1, 0, 1, 127],
          "Single byte 0xFF - all-ones bit path",
          "http://th.if.uj.edu.pl/~dudaj/"
        ),
        new TestCase(
          [65, 65],
          [2, 0, 0, 0, 0, 200, 35, 130, 166],
          "Two identical bytes - pins the context adaptation rule",
          "https://arxiv.org/abs/0902.0271"
        ),
        // Round-trip only from here on: these exist to exercise renormalization
        // and the whole byte alphabet, not to pin bytes a human can check.
        new TestCase(OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. "), [], "Natural text round-trip", "Regression test for model desync"),
        new TestCase(Array.from({ length: 256 }, (_, i) => i), [], "All 256 byte values round-trip", "Regression test for model desync"),
        new TestCase(new Array(512).fill(0x5a), [], "Long run round-trip", "Regression test for renormalization"),
        new TestCase(Array.from({ length: 256 }, (_, i) => i % 2 ? 0x55 : 0xaa), [], "Alternating pattern round-trip", "Regression test for renormalization")
      ];

      // For test suite compatibility
      this.testVectors = this.tests;
    }

    CreateInstance(isInverse = false) {
      return new UABSInstance(this, isInverse);
    }
  }

  class UABSInstance extends IAlgorithmInstance {
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

      const totalBits = data.length * 8;
      const model = newModel();
      const recorded = new Uint16Array(totalBits);

      // Pass 1 - drive the adaptive model forward, recording the probability
      // that was in force when each bit was observed.
      let cursor = 0;
      for (let i = 0; i < data.length; i++) {
        const byte = data[i];
        let context = 1;
        for (let b = 7; b >= 0; b--) {
          const bit = OpCodes.GetBit(byte, b) ? 1 : 0;
          const p1 = model[context];
          recorded[cursor++] = p1;
          model[context] = adaptProbability(p1, bit);
          context = context * 2 + bit;
        }
      }

      // Pass 2 - code the bits backwards, the direction ANS requires.
      const tail = [];
      let state = STATE_LOWER;
      for (let i = totalBits - 1; i >= 0; i--) {
        const byte = data[Math.floor(i / 8)];
        const bit = OpCodes.GetBit(byte, 7 - (i % 8)) ? 1 : 0;
        const p1 = recorded[i];

        let next = uabsEncodeStep(state, bit, p1);
        while (next >= STATE_UPPER) {
          tail.push(state % RENORM_BYTE);
          state = Math.floor(state / RENORM_BYTE);
          next = uabsEncodeStep(state, bit, p1);
        }
        state = next;
      }

      const stateBytes = OpCodes.Unpack32LE(state);
      for (let i = 0; i < 4; i++) tail.push(stateBytes[i]);

      tail.reverse();
      for (let i = 0; i < tail.length; i++) output.push(tail[i]);

      return output;
    }

    _decompress() {
      const data = this.inputBuffer;
      this.inputBuffer = [];

      if (data.length < 4) return [];
      const originalLength = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      if (originalLength === 0) return [];
      if (data.length < 8) throw new Error('Truncated uABS stream: final state is missing');

      let position = 4;
      let state = OpCodes.Pack32BE(data[position], data[position + 1], data[position + 2], data[position + 3]);
      position += 4;

      const model = newModel();
      const output = new Array(originalLength);

      for (let i = 0; i < originalLength; i++) {
        let context = 1;
        let byte = 0;
        for (let b = 0; b < 8; b++) {
          const p1 = model[context];
          const below = uabsCountBelow(state, p1);
          const bit = uabsCountBelow(state + 1, p1) - below;

          state = bit === 1 ? below : state - below;
          while (state < STATE_LOWER && position < data.length) {
            state = state * RENORM_BYTE + data[position++];
          }

          model[context] = adaptProbability(p1, bit);
          context = context * 2 + bit;
          byte = byte * 2 + bit;
        }
        output[i] = byte;
      }

      return output;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new UABSAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { UABSAlgorithm, UABSInstance };
}));
