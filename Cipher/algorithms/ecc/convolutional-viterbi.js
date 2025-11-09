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

      // Test vectors for K=3, rate 1/2, generators (7,5) octal
      this.tests = [
        new TestCase(
          [0, 0, 0, 0], // 4 zero bits input
          [0, 0, 0, 0, 0, 0, 0, 0], // 8 encoded bits (rate 1/2)
          "K=3 all zeros test",
          "https://web.mit.edu/6.02/www/f2011/handouts/8.pdf"
        ),
        new TestCase(
          [1, 0, 0, 0], // Single 1 bit
          [0, 0, 1, 0, 0, 0, 0, 0], // Encoded output
          "K=3 single bit test",
          "https://web.mit.edu/6.02/www/f2011/handouts/8.pdf"
        ),
        new TestCase(
          [1, 1, 1, 1], // All ones
          [0, 0, 1, 0, 1, 0, 1, 0], // Encoded output
          "K=3 all ones test",
          "https://web.mit.edu/6.02/www/f2011/handouts/8.pdf"
        ),
        new TestCase(
          [1, 0, 1, 0], // Alternating pattern
          [0, 0, 1, 0, 0, 0, 1, 0], // Encoded output
          "K=3 alternating pattern",
          "https://web.mit.edu/6.02/www/f2011/handouts/8.pdf"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new ConvolutionalViterbiInstance(this, isInverse);
    }
  }

  class ConvolutionalViterbiInstance extends IErrorCorrectionInstance {
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

    Result() {
      if (this.result === null) {
        throw new Error('ConvolutionalViterbiInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    encode(data) {
      // Convolutional encoding with K=3, rate 1/2
      const output = [];
      let state = 0; // Shift register state (K-1 bits)
      const stateMask = (1 << (this._constraintLength - 1)) - 1;

      for (let i = 0; i < data.length; ++i) {
        const inputBit = data[i] & 1;

        // Shift input bit into state
        state = ((state << 1) | inputBit) & stateMask;

        // Generate output bits using generator polynomials
        const fullState = state | (inputBit << (this._constraintLength - 1));
        const out1 = this.convolve(fullState, this._generator1);
        const out2 = this.convolve(fullState, this._generator2);

        output.push(out1, out2);
      }

      return output;
    }

    convolve(state, generator) {
      // XOR all bits where generator polynomial is 1
      let result = 0;
      let temp = state & generator;

      while (temp) {
        result ^= (temp & 1);
        temp >>= 1;
      }

      return result;
    }

    viterbiDecode(received) {
      // Viterbi decoder using maximum likelihood path
      if (received.length % this._rate !== 0) {
        throw new Error(`Viterbi decode: Input length must be multiple of ${this._rate}`);
      }

      const numBits = received.length / this._rate;
      const numStates = 1 << (this._constraintLength - 1);

      // Path metrics and survivor paths
      const pathMetrics = new Array(numStates).fill(Infinity);
      const newPathMetrics = new Array(numStates);
      const survivorPaths = Array.from({ length: numStates }, () => []);

      pathMetrics[0] = 0; // Start in zero state

      // Process each received symbol
      for (let t = 0; t < numBits; ++t) {
        const r1 = received[t * this._rate];
        const r2 = received[t * this._rate + 1];

        newPathMetrics.fill(Infinity);
        const newSurvivorPaths = Array.from({ length: numStates }, () => []);

        // For each current state
        for (let state = 0; state < numStates; ++state) {
          if (pathMetrics[state] === Infinity) continue;

          // Try both possible input bits (0 and 1)
          for (let inputBit = 0; inputBit <= 1; ++inputBit) {
            // Calculate next state
            const nextState = ((state << 1) | inputBit) & (numStates - 1);

            // Calculate expected output
            const fullState = state | (inputBit << (this._constraintLength - 1));
            const e1 = this.convolve(fullState, this._generator1);
            const e2 = this.convolve(fullState, this._generator2);

            // Calculate Hamming distance (branch metric)
            const branchMetric = (r1 ^ e1) + (r2 ^ e2);
            const newMetric = pathMetrics[state] + branchMetric;

            // Update if better path found
            if (newMetric < newPathMetrics[nextState]) {
              newPathMetrics[nextState] = newMetric;
              newSurvivorPaths[nextState] = [...survivorPaths[state], inputBit];
            }
          }
        }

        // Update for next iteration
        for (let s = 0; s < numStates; ++s) {
          pathMetrics[s] = newPathMetrics[s];
          survivorPaths[s] = newSurvivorPaths[s];
        }
      }

      // Find best final path (minimum metric)
      let bestMetric = Infinity;
      let bestPath = [];

      for (let state = 0; state < numStates; ++state) {
        if (pathMetrics[state] < bestMetric) {
          bestMetric = pathMetrics[state];
          bestPath = survivorPaths[state];
        }
      }

      return bestPath;
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
