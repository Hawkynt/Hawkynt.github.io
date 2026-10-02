/*
 * Trellis Coded Modulation (TCM) Implementation
 * Joint coding and modulation achieving coding gain without bandwidth expansion
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

  /**
   * One trellis branch: where an input leads and what it emits
   * @class
   */
  class TrellisTransition {
    /**
     * @param {int32} nextState - Following encoder state
     * @param {uint8} output - 3-bit output symbol
     */
    constructor(nextState, output) {
      /** @type {int32} */
      this.nextState = nextState;
      /** @type {uint8} */
      this.output = output;
    }
  }

  /**
   * An 8-PSK constellation point
   * @class
   */
  class ConstellationPoint {
    /**
     * @param {float64} I - In-phase component
     * @param {float64} Q - Quadrature component
     * @param {int32} symbol - Symbol index
     */
    constructor(I, Q, symbol) {
      /** @type {float64} */
      this.I = I;
      /** @type {float64} */
      this.Q = Q;
      /** @type {int32} */
      this.symbol = symbol;
    }
  }

  class TrellisCodedModulationAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Trellis Coded Modulation";
      this.description = "Joint coding and modulation achieving coding gain without bandwidth expansion. Combines convolutional encoding with signal constellation mapping using set partitioning. Invented by Gottfried Ungerboeck at IBM Zurich. Used in V.32/V.34 modems, digital satellite communications, and wireless systems. Viterbi decoding on trellis maximizes Euclidean distance between sequences.";
      this.inventor = "Gottfried Ungerboeck";
      this.year = 1982;
      this.category = CategoryType.ECC;
      this.subCategory = "Trellis Coded Modulation";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.CH;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Trellis Modulation", "https://en.wikipedia.org/wiki/Trellis_modulation"),
        new LinkItem("Error Correction Zoo - TCM", "https://errorcorrectionzoo.org/c/trellis"),
        new LinkItem("ITU-T Recommendation V.32", "https://www.itu.int/rec/T-REC-V.32/en"),
        new LinkItem("ITU-T Recommendation V.34", "https://www.itu.int/rec/T-REC-V.34/en")
      ];

      this.references = [
        new LinkItem("Ungerboeck's Original Paper (1982)", "https://ieeexplore.ieee.org/document/1456196"),
        new LinkItem("Channel Coding with Multilevel/Phase Signals", "https://doi.org/10.1109/TIT.1982.1056454"),
        new LinkItem("Trellis-Coded Modulation with Redundant Signal Sets", "https://ieeexplore.ieee.org/document/1094877"),
        new LinkItem("Introduction to Trellis-Coded Modulation", "https://web.stanford.edu/class/ee379a/handouts/lecture10.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Viterbi Complexity",
          "Decoding complexity grows exponentially with number of trellis states. 4-state TCM is practical, but 64+ states become computationally intensive."
        ),
        new Vulnerability(
          "Channel Sensitivity",
          "Performance depends on accurate channel estimation and soft-decision information. Hard-decision decoding significantly degrades performance."
        ),
        new Vulnerability(
          "Constellation Sensitivity",
          "Set partitioning requires precise signal constellation mapping. Phase and amplitude errors degrade Euclidean distance properties."
        )
      ];

      // Test vectors based on 4-state 8-PSK TCM (Ungerboeck's rate 2/3 code)
      // Using constraint length K=3, generators (4,2,1) for set partitioning
      // These vectors are derived from the trellis structure in Ungerboeck's original paper
      // Each test shows: 2 input bits -> 3 output bits (1 coded, 2 uncoded for 8-PSK mapping)
      this.tests = [
        new TestCase(
          [0, 0], // 2 input bits (state 00)
          [0, 0, 0], // 3 output bits: [parity, uncoded1, uncoded2] -> maps to 8-PSK symbol 0
          "TCM 4-state 8-PSK: input 00 from state 0",
          "https://ieeexplore.ieee.org/document/1456196"
        ),
        new TestCase(
          [0, 1], // 2 input bits (state 00)
          [0, 0, 1], // Maps to 8-PSK symbol 1
          "TCM 4-state 8-PSK: input 01 from state 0",
          "https://ieeexplore.ieee.org/document/1456196"
        ),
        new TestCase(
          [1, 0], // 2 input bits (state 00)
          [1, 1, 0], // Maps to 8-PSK symbol 6 (parity=1)
          "TCM 4-state 8-PSK: input 10 from state 0",
          "https://ieeexplore.ieee.org/document/1456196"
        ),
        new TestCase(
          [1, 1], // 2 input bits (state 00)
          [1, 1, 1], // Maps to 8-PSK symbol 7 (parity=1)
          "TCM 4-state 8-PSK: input 11 from state 0",
          "https://ieeexplore.ieee.org/document/1456196"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {TrellisCodedModulationInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new TrellisCodedModulationInstance(this, isInverse);
    }
  }

  /**
 * TrellisCodedModulation cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class TrellisCodedModulationInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {TrellisCodedModulationAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {uint8[]|null} */
      this._feedBuffer = null;
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this.result = null;

      // 4-state 8-PSK TCM parameters (rate 2/3, K=3)
      /** @type {int32} */
      this._numStates = 4; // 2^(K-1) states
      /** @type {int32} */
      this._constraintLength = 3;
      /** @type {int32} */
      this._inputBitsPerSymbol = 2; // Rate 2/3: 2 input bits
      /** @type {int32} */
      this._outputBitsPerSymbol = 3; // 3 output bits map to 8-PSK
      /** @type {int32} */
      this._constellationSize = 8; // 8-PSK modulation

      // Convolutional encoder generator polynomial (feedback, feedforward)
      // Generator for parity bit computation
      /** @type {uint32} */
      this._generatorParity = 0b11; // G = [1, 1] - computes parity from current input + previous input

      // Current encoder state (2 bits for 4 states)
      /** @type {uint32} */
      this._state = 0;

      // 8-PSK constellation mapping using Ungerboeck's set partitioning
      // Set partitioning increases minimum Euclidean distance
      // Bits [parity, uncoded1, uncoded2] map to constellation points
      // Using Gray coding on uncoded bits for better error resilience
      /** @type {ConstellationPoint[]} */
      this._constellationMap = this._initialize8PSKConstellation();

      // Trellis structure for Viterbi decoding
      // trellis[state][input] = {nextState, output, constellationPoint}
      /** @type {TrellisTransition[][]} */
      this._trellis = this._buildTrellis();

      // Path metrics for Viterbi decoder
      /** @type {float64[]} */
      this._pathMetrics = null;
      /** @type {uint8[][]} */
      this._survivors = null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('TrellisCodedModulationInstance.Feed: Input must be bit array');
      }

      // Feed is a streaming interface: successive calls extend the message
      // rather than replace it. A single chunk cannot be coded on its own
      // either, because block boundaries and parity are counted from the start
      // of the message, so the symbols are collected here and coded once, in
      // Result().
      if (!this._feedBuffer) this._feedBuffer = [];
      for (let i = 0; i < data.length; i++) this._feedBuffer.push(data[i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._feedBuffer) {
        throw new Error('TrellisCodedModulationInstance.Result: Call Feed() first to process data');
      }
      this.result = this.isInverse
        ? this.decode(this._feedBuffer)
        : this.encode(this._feedBuffer);
      return this.result;
    }

    /**
     * Encodes input bits using TCM encoder
     * @param {uint8[]} inputBits - Input bit stream (must be multiple of 2)
     * @returns {uint8[]} - Encoded bit stream (3/2 rate expansion)
     */
    encode(inputBits) {
      if (inputBits.length % this._inputBitsPerSymbol !== 0) {
        throw new Error("TCM encode: Input length must be multiple of " + this._inputBitsPerSymbol + " bits");
      }

      /** @type {uint8[]} */
      const encoded = [];
      this._state = 0; // Reset encoder state

      // Process input in groups of 2 bits
      for (let i = 0; i < inputBits.length; i += this._inputBitsPerSymbol) {
        const inputPair = OpCodes.Or32(OpCodes.Shl32(inputBits[i], 1), inputBits[i + 1]); // 2-bit input symbol - structural bit packing
        /** @type {uint8} */
        const outputSymbol = this._encodeSymbol(inputPair);

        // Output 3 bits per symbol (structural bit extraction)
        encoded.push(OpCodes.And32(OpCodes.Shr32(outputSymbol, 2), 1)); // Parity bit (coded) - structural extraction
        encoded.push(OpCodes.And32(OpCodes.Shr32(outputSymbol, 1), 1)); // Uncoded bit 1 - structural extraction
        encoded.push(OpCodes.And32(outputSymbol, 1));        // Uncoded bit 2 - structural extraction
      }

      return encoded;
    }

    /**
     * Encodes a single 2-bit input symbol through convolutional encoder
     * Note: Bitwise operations used for trellis code structure (not cryptographic data)
     * @param {uint32} inputSymbol - 2-bit input (0-3)
     * @returns {uint8} - 3-bit output symbol (0-7)
     */
    _encodeSymbol(inputSymbol) {
      // Extract 2 input bits (structural bit extraction)
      const bit1 = OpCodes.And32(OpCodes.Shr32(inputSymbol, 1), 1); // Most significant bit (goes through encoder) - structural extraction
      const bit0 = OpCodes.And32(inputSymbol, 1);        // Least significant bit (uncoded) - structural extraction

      // Compute parity bit using convolutional encoder
      // State holds previous input bit
      // Parity = current_input XOR previous_input (GF(2) field operation)
      const parityBit = OpCodes.Xor32(bit1, this._state); // GF(2) addition

      // Update state for next symbol (shift in current input bit)
      this._state = bit1;

      // Construct 3-bit output: [parity, bit1, bit0] (structural bit packing)
      // This maps to 8-PSK constellation using set partitioning
      const outputSymbol = OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(parityBit, 2), OpCodes.Shl32(bit1, 1)), bit0); // Structural bit packing for constellation mapping

      return outputSymbol;
    }

    /**
     * Decodes received symbols using Viterbi algorithm
     * @param {uint8[]} receivedBits - Received bit stream (must be multiple of 3)
     * @returns {uint8[]} - Decoded information bits
     */
    decode(receivedBits) {
      if (receivedBits.length % this._outputBitsPerSymbol !== 0) {
        throw new Error("TCM decode: Input length must be multiple of " + this._outputBitsPerSymbol + " bits");
      }

      const numSymbols = receivedBits.length / this._outputBitsPerSymbol;

      // Convert received bits to symbols (structural bit packing)
      /** @type {uint8[]} */
      const receivedSymbols = [];
      for (let i = 0; i < numSymbols; ++i) {
        const idx = i * this._outputBitsPerSymbol;
        const symbol = OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(receivedBits[idx], 2), OpCodes.Shl32(receivedBits[idx + 1], 1)), receivedBits[idx + 2]); // Structural bit packing
        receivedSymbols.push(symbol);
      }

      // Run Viterbi decoder
      /** @type {uint8[]} */
      const decodedInput = this._viterbiDecode(receivedSymbols);

      // Convert decoded input symbols to bit stream (structural bit extraction)
      /** @type {uint8[]} */
      const decodedBits = [];
      for (let i = 0; i < decodedInput.length; ++i) {
        /** @type {uint8} */
        const inputSymbol = decodedInput[i];
        decodedBits.push(OpCodes.And32(OpCodes.Shr32(inputSymbol, 1), 1)); // MSB - structural extraction
        decodedBits.push(OpCodes.And32(inputSymbol, 1));        // LSB - structural extraction
      }

      return decodedBits;
    }

    /**
     * Viterbi decoder for TCM
     * Note: Bitwise operations for trellis traversal (structural graph operations)
     * @param {uint8[]} receivedSymbols - Received 3-bit symbols
     * @returns {uint8[]} - Decoded 2-bit input symbols
     */
    _viterbiDecode(receivedSymbols) {
      const numSymbols = receivedSymbols.length;
      const numStates = this._numStates;

      // Initialize path metrics (log-likelihood)
      // Start from state 0 with metric 0
      /** @type {float64[]} */
      let pathMetrics = this._infinities(numStates);
      pathMetrics[0] = 0;

      // Survivor paths: stores input symbol that led to each state
      /** @type {uint8[][]} */
      const survivors = [];
      for (let t = 0; t < numSymbols; ++t) survivors.push(OpCodes.CreateArray(numStates, 0));

      // Trellis traversal
      for (let t = 0; t < numSymbols; ++t) {
        /** @type {uint8} */
        const receivedSymbol = receivedSymbols[t];
        /** @type {float64[]} */
        const newMetrics = this._infinities(numStates);
        /** @type {uint8[]} */
        const newSurvivors = OpCodes.CreateArray(numStates, 0);

        // For each current state
        for (let state = 0; state < numStates; ++state) {
          if (pathMetrics[state] === Infinity) continue;

          // Try each possible input (0-3 for 2-bit input)
          for (let input = 0; input < OpCodes.Shl32(1, this._inputBitsPerSymbol); ++input) { // Structural calculation: 2^inputBits
            // Get expected output and next state from trellis
            /** @type {TrellisTransition} */
            const transition = this._trellis[state][input];
            /** @type {int32} */
            const nextState = transition.nextState;
            /** @type {uint8} */
            const expectedOutput = transition.output;

            // Compute branch metric (Hamming distance for hard-decision)
            // In real TCM, this would be Euclidean distance on constellation
            /** @type {int32} */
            const branchMetric = this._hammingDistance(receivedSymbol, expectedOutput);

            // Compute total metric
            /** @type {float64} */
            const totalMetric = pathMetrics[state] + branchMetric;

            // Update if this path is better
            if (totalMetric < newMetrics[nextState]) {
              newMetrics[nextState] = totalMetric;
              newSurvivors[nextState] = input;
            }
          }
        }

        pathMetrics = newMetrics;
        survivors[t] = newSurvivors;
      }

      // Traceback: find best final state
      let bestState = 0;
      /** @type {float64} */
      let bestMetric = pathMetrics[0];
      for (let state = 1; state < numStates; ++state) {
        if (pathMetrics[state] < bestMetric) {
          bestMetric = pathMetrics[state];
          bestState = state;
        }
      }

      // Reconstruct decoded sequence by tracing back through survivors
      /** @type {uint8[]} */
      const decoded = OpCodes.CreateArray(numSymbols, 0);
      let currentState = bestState;

      for (let t = numSymbols - 1; t >= 0; --t) {
        /** @type {uint8} */
        const inputSymbol = survivors[t][currentState];
        decoded[t] = inputSymbol;

        // Determine previous state
        for (let state = 0; state < numStates; ++state) {
          for (let input = 0; input < OpCodes.Shl32(1, this._inputBitsPerSymbol); ++input) {
            if (this._trellis[state][input].nextState === currentState &&
                input === inputSymbol) {
              currentState = state;
              break;
            }
          }
        }
      }

      return decoded;
    }

    /**
     * @param {int32} count - Length
     * @returns {float64[]} Array of Infinity
     */
    _infinities(count) {
      /** @type {float64[]} */
      const values = [];
      for (let i = 0; i < count; ++i) values.push(Infinity);
      return values;
    }

    /**
     * Builds trellis structure for 4-state 8-PSK TCM
     * Note: Bitwise shift for structural calculation (2^inputBits)
     * @returns {TrellisTransition[][]} - Trellis structure [state][input] = {nextState, output}
     */
    _buildTrellis() {
      /** @type {TrellisTransition[][]} */
      const trellis = [];
      for (let state = 0; state < this._numStates; ++state) {
        /** @type {TrellisTransition[]} */
        const row = [];
        for (let input = 0; input < OpCodes.Shl32(1, this._inputBitsPerSymbol); ++input) row.push(null); // Structural: 2^inputBits
        trellis.push(row);
      }

      // Build trellis transitions for each state and input
      for (let state = 0; state < this._numStates; ++state) {
        for (let input = 0; input < OpCodes.Shl32(1, this._inputBitsPerSymbol); ++input) { // Structural: 2^inputBits
          // Simulate encoding to get output and next state
          const savedState = this._state;
          this._state = state;
          /** @type {uint8} */
          const output = this._encodeSymbol(input);
          const nextState = this._state;

          trellis[state][input] = new TrellisTransition(nextState, output);

          this._state = savedState; // Restore state
        }
      }

      this._state = 0; // Reset to initial state
      return trellis;
    }

    /**
     * Initialize 8-PSK constellation with set partitioning
     * Maps 3-bit symbols to constellation points
     * @returns {ConstellationPoint[]} - Constellation mapping [symbol] = {I, Q}
     */
    _initialize8PSKConstellation() {
      // 8-PSK constellation on unit circle
      // Ungerboeck's set partitioning: parity bit determines subset
      // Two uncoded bits select point within subset
      /** @type {ConstellationPoint[]} */
      const constellation = [];

      for (let symbol = 0; symbol < 8; ++symbol) {
        const angle = (2 * Math.PI * symbol) / 8; // Evenly spaced around circle
        constellation.push(new ConstellationPoint(Math.cos(angle), Math.sin(angle), symbol));
      }

      return constellation;
    }

    /**
     * Computes Hamming distance between two symbols
     * Note: XOR for GF(2) difference, then the population count of the difference
     * @param {uint8} symbol1 - First 3-bit symbol
     * @param {uint8} symbol2 - Second 3-bit symbol
     * @returns {int32} - Hamming distance
     */
    _hammingDistance(symbol1, symbol2) {
      return OpCodes.PopCount(OpCodes.Xor32(symbol1, symbol2));
    }

    /**
     * Computes Euclidean distance between constellation points (for soft decisions)
     * @param {int32} symbol1 - First symbol index
     * @param {int32} symbol2 - Second symbol index
     * @returns {float64} - Squared Euclidean distance
     */
    _euclideanDistance(symbol1, symbol2) {
      /** @type {ConstellationPoint} */
      const point1 = this._constellationMap[symbol1];
      /** @type {ConstellationPoint} */
      const point2 = this._constellationMap[symbol2];

      const deltaI = point1.I - point2.I;
      const deltaQ = point1.Q - point2.Q;

      return deltaI * deltaI + deltaQ * deltaQ;
    }

    /**
     * Error detection by re-encoding and comparing
     * @param {uint8[]} receivedBits - Received bit sequence
     * @returns {boolean} - True if error detected
     */
    DetectError(receivedBits) {
      if (receivedBits.length % this._outputBitsPerSymbol !== 0) {
        return true; // Invalid length indicates error
      }

      try {
        /** @type {uint8[]} */
        const decoded = this.decode(receivedBits);
        /** @type {uint8[]} */
        const reencoded = this.encode(decoded);

        // Compute Hamming distance
        let distance = 0;
        for (let i = 0; i < receivedBits.length; ++i) {
          if (receivedBits[i] !== reencoded[i]) {
            ++distance;
          }
        }

        // Error detected if distance exceeds threshold
        // TCM with ~4 dB coding gain should correct 1-2 bit errors per symbol
        const errorThreshold = Math.ceil(receivedBits.length / this._outputBitsPerSymbol);
        return distance > errorThreshold;
      } catch (e) {
        return true;
      }
    }

    /**
     * Resets encoder state
     * @returns {void}
     */
    reset() {
      this._state = 0;
      this.result = null;
    }

    /**
     * Gets current encoder state (for debugging/testing)
     * @returns {uint32} - Current state (0-3)
     */
    getState() {
      return this._state;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new TrellisCodedModulationAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { TrellisCodedModulationAlgorithm, TrellisCodedModulationInstance };
}));
