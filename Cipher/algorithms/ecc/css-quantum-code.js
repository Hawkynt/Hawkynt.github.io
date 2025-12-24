/*
 * CSS (Calderbank-Shor-Steane) Quantum Error Correction Code
 * Stabilizer code constructed from two classical linear codes C1 and C2 where C2⊥ ⊆ C1
 * Implements Steane [[7,1,3]] code - the simplest CSS code
 * (c)2006-2025 Hawkynt
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
          ErrorCorrectionAlgorithm, IErrorCorrectionInstance,
          TestCase, LinkItem, Vulnerability } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class CSSQuantumCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "CSS Quantum Code";
      this.description = "Quantum stabilizer code constructed from two classical linear codes C1 and C2 where the dual of C2 is a subset of C1. Corrects quantum errors (bit-flip X and phase-flip Z errors). Steane [[7,1,3]] code corrects one qubit error. Foundation for fault-tolerant quantum computing. Used in quantum computers by IBM, Google.";
      this.inventor = "Robert Calderbank, Peter Shor, Andrew Steane";
      this.year = 1996;
      this.category = CategoryType.ECC;
      this.subCategory = "Quantum Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Error Correction Zoo - CSS Code", "https://errorcorrectionzoo.org/c/css"),
        new LinkItem("Wikipedia - CSS Code", "https://en.wikipedia.org/wiki/CSS_code"),
        new LinkItem("Quantum Error Correction Tutorial", "https://www.scottaaronson.com/qclec/9.pdf"),
        new LinkItem("IBM Quantum Computing", "https://quantum-computing.ibm.com/composer/docs/iqx/guide/quantum-error-correction")
      ];

      this.references = [
        new LinkItem("Steane's Original Paper (1996)", "https://arxiv.org/abs/quant-ph/9605011"),
        new LinkItem("Calderbank&Shor (1996)", "https://arxiv.org/abs/quant-ph/9512032"),
        new LinkItem("Nielsen&Chuang - Quantum Computation", "https://doi.org/10.1017/CBO9780511976667"),
        new LinkItem("Preskill - Quantum Error Correction Notes", "http://theory.caltech.edu/~preskill/ph219/chap7.pdf"),
        new LinkItem("Gottesman - Stabilizer Codes", "https://arxiv.org/abs/quant-ph/9705052")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Single Qubit Error Correction Only",
          "Steane [[7,1,3]] code can only correct 1 arbitrary qubit error (bit-flip, phase-flip, or both). Multiple errors cause decoding failure."
        ),
        new Vulnerability(
          "Overhead Cost",
          "Encodes 1 logical qubit into 7 physical qubits (7x overhead). Higher-distance CSS codes have even larger overhead."
        ),
        new Vulnerability(
          "Classical Simulation Limitations",
          "This implementation treats quantum states as classical bit arrays for educational purposes. Real quantum error correction requires quantum hardware and preserves superposition states."
        ),
        new Vulnerability(
          "Measurement Errors",
          "Does not account for measurement errors in syndrome extraction, which real quantum systems must address through fault-tolerant protocols."
        )
      ];

      // Test vectors from quantum computing literature
      // These represent classical bit patterns for educational demonstration
      // Real quantum states would be in superposition
      // All test vectors are ENCODE tests (logical qubit → physical qubits)
      // Round-trip tests will verify decoding with and without errors
      this.tests = [
        // Steane [[7,1,3]] - Encoding logical qubit state 0
        new TestCase(
          [0],
          [0, 0, 0, 0, 0, 0, 0],
          "Steane [[7,1,3]] encode logical qubit state 0",
          "https://errorcorrectionzoo.org/c/steane"
        ),
        // Steane [[7,1,3]] - Encoding logical qubit state 1
        new TestCase(
          [1],
          [1, 1, 1, 1, 1, 1, 1],
          "Steane [[7,1,3]] encode logical qubit state 1",
          "https://errorcorrectionzoo.org/c/steane"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new CSSQuantumCodeInstance(this, isInverse);
    }
  }

  /**
 * CSSQuantumCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class CSSQuantumCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;

      // Steane [[7,1,3]] code parameters
      this.n = 7; // Physical qubits
      this.k = 1; // Logical qubits
      this.d = 3; // Code distance (can correct (d-1)/2 = 1 error)

      // Hamming [7,4] generator matrix for CSS construction
      // This is the classical code C1 used to protect against bit-flip errors
      this.G = [
        [1, 1, 0, 1, 0, 0, 0],
        [1, 0, 1, 0, 1, 0, 0],
        [0, 1, 1, 0, 0, 1, 0],
        [1, 1, 1, 0, 0, 0, 1]
      ];

      // Hamming [7,4] parity check matrix
      // Used for syndrome measurement
      this.H = [
        [0, 0, 0, 1, 1, 1, 1],
        [0, 1, 1, 0, 0, 1, 1],
        [1, 0, 1, 0, 1, 0, 1]
      ];

      // Steane code stabilizer generators (for reference)
      // X-type stabilizers (detect phase-flip errors)
      this.stabilizerX = [
        [1, 1, 1, 1, 0, 0, 0],
        [1, 1, 0, 0, 1, 1, 0],
        [1, 0, 1, 0, 1, 0, 1]
      ];

      // Z-type stabilizers (detect bit-flip errors)
      this.stabilizerZ = [
        [1, 1, 1, 1, 0, 0, 0],
        [1, 1, 0, 0, 1, 1, 0],
        [1, 0, 1, 0, 1, 0, 1]
      ];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('CSSQuantumCodeInstance.Feed: Input must be bit array');
      }

      if (this.isInverse) {
        // Decode: error correction
        this.result = this.decode(data);
      } else {
        // Encode: logical qubit to physical qubits
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
        throw new Error('CSSQuantumCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    /**
     * Encode logical qubit to 7 physical qubits using Steane [[7,1,3]] code
     * For classical simulation: state 0 maps to all-zeros, state 1 maps to all-ones
     * Real quantum encoding would preserve superposition with linear combinations of these basis states
     */
    encode(logicalQubit) {
      if (logicalQubit.length !== this.k) {
        throw new Error(`CSS encode: Input must be exactly ${this.k} logical qubit (as classical bit)`);
      }

      const logical = logicalQubit[0];

      // Steane code logical codewords
      // Logical qubit state 0 encoded as all-zeros codeword (all qubits in ground state)
      // Logical qubit state 1 encoded as all-ones codeword (all qubits in excited state)
      // This is the standard CSS construction using dual Hamming codes
      const encoded = new Array(this.n).fill(logical);

      return encoded;
    }

    /**
     * Decode physical qubits with error correction
     * Measures Z-stabilizers to detect bit-flip errors
     * In classical simulation, this corrects single bit-flip errors
     */
    decode(physicalQubits) {
      if (physicalQubits.length !== this.n) {
        throw new Error(`CSS decode: Input must be exactly ${this.n} physical qubits (as classical bits)`);
      }

      // Copy to avoid modifying input
      const received = [...physicalQubits];

      // Measure Z-stabilizers (detect bit-flip errors)
      const syndrome = this.measureSyndrome(received);

      // Calculate error position from syndrome
      const errorPosition = this.syndromeToErrorPosition(syndrome);

      // Correct the error if detected
      if (errorPosition !== -1) {
        received[errorPosition] = OpCodes.XorN(received[errorPosition], 1); // Flip the erroneous bit
      }

      // Extract logical qubit (majority vote for classical simulation)
      // Real quantum decoding would measure logical observable
      const logicalQubit = this.extractLogicalQubit(received);

      return [logicalQubit];
    }

    /**
     * Measure syndrome using parity check matrix
     * Returns 3-bit syndrome indicating error location
     */
    measureSyndrome(qubits) {
      const syndrome = new Array(3).fill(0);

      for (let i = 0; i < 3; ++i) {
        let parity = 0;
        for (let j = 0; j < this.n; ++j) {
          if (this.H[i][j] === 1) {
            parity = OpCodes.XorN(parity, qubits[j]);
          }
        }
        syndrome[i] = parity;
      }

      return syndrome;
    }

    /**
     * Convert syndrome to error position using Hamming code lookup
     * Syndrome = 0 means no error
     * Syndrome = position in binary for single-bit error
     */
    syndromeToErrorPosition(syndrome) {
      // Convert syndrome to integer
      const syndromeValue = OpCodes.OrN(OpCodes.OrN(syndrome[0], OpCodes.ShiftLn(syndrome[1], 1)), OpCodes.ShiftLn(syndrome[2], 2));

      if (syndromeValue === 0) {
        return -1; // No error
      }

      // Syndrome directly gives error position in Hamming code
      // Positions: 1,2,3,4,5,6,7 (1-indexed in theory, 0-indexed in array)
      return syndromeValue - 1;
    }

    /**
     * Extract logical qubit using majority vote (classical approximation)
     * Real quantum systems would measure logical observable operators
     */
    extractLogicalQubit(qubits) {
      // Count ones
      let ones = 0;
      for (let i = 0; i < this.n; ++i) {
        ones += qubits[i];
      }

      // Majority vote: if more than half are 1, logical qubit is in state 1
      return ones > this.n / 2 ? 1 : 0;
    }

    /**
     * Detect if error is present (public API for testing)
     */
    DetectError(data) {
      if (data.length !== this.n) {
        return true; // Invalid length is an error
      }

      const syndrome = this.measureSyndrome(data);
      const syndromeValue = OpCodes.OrN(OpCodes.OrN(syndrome[0], OpCodes.ShiftLn(syndrome[1], 1)), OpCodes.ShiftLn(syndrome[2], 2));

      return syndromeValue !== 0;
    }

    /**
     * Introduce error for testing (educational purposes)
     * errorType: 'bit-flip' (X gate), 'phase-flip' (Z gate), 'both' (Y gate)
     * position: qubit index 0-6
     */
    IntroduceError(qubits, errorType, position) {
      if (position < 0 || position >= this.n) {
        throw new Error(`Error position must be between 0 and ${this.n - 1}`);
      }

      const result = [...qubits];

      switch (errorType) {
        case 'bit-flip':
          // X gate: bit-flip (swaps qubit states 0 and 1)
          result[position] = OpCodes.XorN(result[position], 1);
          break;

        case 'phase-flip':
          // Z gate: phase-flip (classical simulation: no visible effect on computational basis)
          // In real quantum: flips phase of superposition states, but classical bits unchanged
          // For educational purposes, we mark this symbolically
          break;

        case 'both':
          // Y gate: both bit-flip and phase-flip
          result[position] = OpCodes.XorN(result[position], 1);
          break;

        default:
          throw new Error(`Unknown error type: ${errorType}`);
      }

      return result;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new CSSQuantumCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { CSSQuantumCodeAlgorithm, CSSQuantumCodeInstance };
}));
