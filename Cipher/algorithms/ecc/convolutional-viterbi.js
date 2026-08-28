/*
 * Convolutional Code with Viterbi Decoder Implementation
 * Forward error correction using convolutional encoding and maximum likelihood decoding
 * (c)2006-2025 Hawkynt
 */

// Load AlgorithmFramework (REQUIRED)

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
          ErrorCorrectionAlgorithm, IErrorCorrectionInstance,
          TestCase, LinkItem, Vulnerability } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class ConvolutionalViterbiAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Convolutional Code (Viterbi)";
      this.description = "Convolutional encoder with Viterbi maximum likelihood decoder. Uses constraint length K=3, rate 1/2 with generator polynomials (7,5) octal. Widely used in digital communications including WiFi, LTE, and satellite systems.";
      this.inventor = "Andrew Viterbi";
      this.year = 1967;
      this.category = CategoryType.ECC;
      this.subCategory = "Convolutional Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Viterbi Decoder", "https://en.wikipedia.org/wiki/Viterbi_decoder"),
        new LinkItem("MIT Viterbi Tutorial", "https://web.mit.edu/6.02/www/f2011/handouts/8.pdf"),
        new LinkItem("Convolutional Encoding", "https://users.ece.utexas.edu/~gerstl/ee382v_f14/soc/drm/Viterbi.pdf")
      ];

      this.references = [
        new LinkItem("Viterbi's Original Paper", "https://ieeexplore.ieee.org/document/1054010"),
        new LinkItem("Error Correction Coding", "https://www.ece.unb.ca/tervo/ece4253/convolution3.shtml"),
        new LinkItem("Princeton Lecture Notes", "https://www.cs.princeton.edu/courses/archive/spring18/cos463/lectures/L09-viterbi.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Decoding Complexity",
          "Viterbi decoding complexity grows exponentially with constraint length. K=7 is practical limit for software."
        ),
        new Vulnerability(
          "Error Propagation",
          "Bit errors can propagate through decoder state transitions, though typically limited to 5× constraint length."
        )
      ];

      // Test vectors for K=3, rate 1/2, generators (7,5) octal.
      // The encoder emits, per input bit, the GF(2) inner products of the
      // register [b(i), b(i-1), b(i-2)] with g1=111 and g2=101. Its impulse
      // response is therefore 11 10 11, i.e. the columns of the two generator
      // polynomials read left to right, which is the value the single-bit
      // vector below records.
      this.tests = [
        new TestCase(
          [0, 0, 0, 0], // 4 zero bits input
          [0, 0, 0, 0, 0, 0, 0, 0], // 8 encoded bits (rate 1/2)
          "K=3 all zeros test",
          "https://web.mit.edu/6.02/www/f2011/handouts/8.pdf"
        ),
        new TestCase(
          [1, 0, 0, 0], // Single 1 bit - yields the (7,5) impulse response
          [1, 1, 1, 0, 1, 1, 0, 0], // 11 10 11 00
          "K=3 single bit test",
          "https://web.mit.edu/6.02/www/f2011/handouts/8.pdf"
        ),
        new TestCase(
          [1, 1, 1, 1], // All ones
          [1, 1, 0, 1, 1, 0, 1, 0], // 11 01 10 10
          "K=3 all ones test",
          "https://web.mit.edu/6.02/www/f2011/handouts/8.pdf"
        ),
        new TestCase(
          [1, 0, 1, 0], // Alternating pattern
          [1, 1, 1, 0, 0, 0, 1, 0], // 11 10 00 10
          "K=3 alternating pattern",
          "https://web.mit.edu/6.02/www/f2011/handouts/8.pdf"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new ConvolutionalViterbiInstance(this, isInverse);
    }
  }

  /**
 * ConvolutionalViterbi cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ConvolutionalViterbiInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;

      // Default: K=3, rate 1/2, generators (7,5) octal = (111, 101) binary
      this._constraintLength = 3;
      this._rate = 2; // 1/2 rate (2 output bits per input bit)
      this._generator1 = 0b111; // Octal 7
      this._generator2 = 0b101; // Octal 5
    }

    set constraintLength(k) {
      if (k < 2 || k > 7) {
        throw new Error('ConvolutionalViterbiInstance.constraintLength: Must be between 2 and 7');
      }
      this._constraintLength = k;
    }

    get constraintLength() {
      return this._constraintLength;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('ConvolutionalViterbiInstance.Feed: Input must be bit array');
      }

      if (this.isInverse) {
        this.result = this.viterbiDecode(data);
      } else {
        this.result = this.encode(data);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.result === null) {
        throw new Error('ConvolutionalViterbiInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    encode(data) {
      // Convolutional encoding with K=3, rate 1/2.
      // The shift register holds the current input bit in its most significant
      // position followed by the K-1 preceding input bits, so that a generator
      // polynomial masks directly onto the register layout.
      const output = [];
      const constraintLength = this._constraintLength;
      const stateMask = OpCodes.Shl32(1, constraintLength - 1) - 1;
      let state = 0; // The K-1 preceding input bits, most recent first

      for (let i = 0; i < data.length; ++i) {
        const inputBit = OpCodes.AndN(data[i], 1);

        // Present the input bit alongside the history, then emit the parities
        const fullRegister = OpCodes.OrN(OpCodes.Shl32(inputBit, constraintLength - 1), state);
        const out1 = this.convolve(fullRegister, this._generator1);
        const out2 = this.convolve(fullRegister, this._generator2);

        output.push(out1, out2);

        // Advance the register; the oldest bit falls off the end
        state = OpCodes.AndN(OpCodes.Shr32(fullRegister, 1), stateMask);
      }

      return output;
    }

    convolve(state, generator) {
      // XOR all bits where generator polynomial is 1
      let result = 0;
      let temp = OpCodes.AndN(state, generator);

      while (temp) {
        result = OpCodes.XorN(result, OpCodes.AndN(temp, 1));
        temp = OpCodes.Shr32(temp, 1);
      }

      return result;
    }

    viterbiDecode(received) {
      // Maximum likelihood decoding over the trellis: an add-compare-select
      // forward pass that records one survivor decision per state per stage,
      // followed by a traceback from the most likely terminating state.
      if (received.length % this._rate !== 0) {
        throw new Error(`Viterbi decode: Input length must be multiple of ${this._rate}`);
      }

      const numBits = received.length / this._rate;
      const constraintLength = this._constraintLength;
      const numStates = OpCodes.Shl32(1, constraintLength - 1);
      const stateMask = numStates - 1;

      let pathMetrics = new Array(numStates).fill(Infinity);
      pathMetrics[0] = 0; // The encoder starts in the all-zero state

      // Survivor decisions: for each stage, the input bit that entered a state
      // and the predecessor state it came from
      const decisionBit = [];
      const decisionFrom = [];

      for (let t = 0; t < numBits; ++t) {
        const r1 = OpCodes.AndN(received[t * this._rate], 1);
        const r2 = OpCodes.AndN(received[t * this._rate + 1], 1);

        const nextMetrics = new Array(numStates).fill(Infinity);
        const enteredWith = new Array(numStates).fill(0);
        const cameFrom = new Array(numStates).fill(0);

        for (let state = 0; state < numStates; ++state) {
          if (pathMetrics[state] === Infinity) continue;

          // Try both possible input bits (0 and 1)
          for (let inputBit = 0; inputBit <= 1; ++inputBit) {
            // Expected output for this branch, using the same register layout
            // as the encoder, and the state the branch leads to
            const fullRegister = OpCodes.OrN(OpCodes.Shl32(inputBit, constraintLength - 1), state);
            const nextState = OpCodes.AndN(OpCodes.Shr32(fullRegister, 1), stateMask);
            const e1 = this.convolve(fullRegister, this._generator1);
            const e2 = this.convolve(fullRegister, this._generator2);

            // Branch metric is the Hamming distance to the received symbol
            const branchMetric = OpCodes.XorN(r1, e1) + OpCodes.XorN(r2, e2);
            const candidate = pathMetrics[state] + branchMetric;

            // Keep the better of the two paths merging into nextState
            if (candidate < nextMetrics[nextState]) {
              nextMetrics[nextState] = candidate;
              enteredWith[nextState] = inputBit;
              cameFrom[nextState] = state;
            }
          }
        }

        decisionBit.push(enteredWith);
        decisionFrom.push(cameFrom);
        pathMetrics = nextMetrics;
      }

      // The trellis is not zero-terminated, so terminate on the state with the
      // smallest accumulated metric
      let bestState = 0;
      let bestMetric = Infinity;
      for (let state = 0; state < numStates; ++state) {
        if (pathMetrics[state] < bestMetric) {
          bestMetric = pathMetrics[state];
          bestState = state;
        }
      }

      // Trace the survivor path back to recover the information bits
      const decoded = new Array(numBits).fill(0);
      let state = bestState;
      for (let t = numBits - 1; t >= 0; --t) {
        decoded[t] = decisionBit[t][state];
        state = decisionFrom[t][state];
      }

      return decoded;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new ConvolutionalViterbiAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ConvolutionalViterbiAlgorithm, ConvolutionalViterbiInstance };
}));
