/*
 * Topological Color Code - Quantum Error Correction
 * 2D topological code on hexagonal lattice with 3-coloring (triangular lattice)
 * Implements [[7,1,3]] simplex color code (distance-3)
 * Supports transversal gates beyond Clifford group for universal quantum computing
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

  // Face indicator rows of the [[7,1,3]] lattice (copied wherever used)
  /** @type {uint8[]} */
  const FACE_012 = [1, 1, 1, 0, 0, 0, 0];
  /** @type {uint8[]} */
  const FACE_235 = [0, 0, 1, 1, 0, 1, 0];
  /** @type {uint8[]} */
  const FACE_145 = [0, 1, 0, 0, 1, 1, 0];
  /** @type {uint8[]} */
  const FACE_023 = [1, 0, 1, 1, 0, 0, 0];
  /** @type {uint8[]} */
  const FACE_125 = [0, 1, 1, 0, 0, 1, 0];
  /** @type {uint8[]} */
  const FACE_456 = [0, 0, 0, 0, 1, 1, 1];
  /** @type {uint8[]} */
  const FACE_013 = [1, 1, 0, 1, 0, 0, 0];
  /** @type {uint8[]} */
  const FACE_256 = [0, 0, 1, 0, 0, 1, 1];

  /**
   * Stabilizer counts as reported by getLatticeInfo()
   * @class
   */
  class StabilizerCounts {
    /**
     * @param {int32} X - X-type generators
     * @param {int32} Z - Z-type generators
     */
    constructor(X, Z) {
      /** @type {int32} */
      this.X = X;
      /** @type {int32} */
      this.Z = Z;
    }
  }

  /**
   * Lattice description as reported by getLatticeInfo()
   * @class
   */
  class LatticeInfo {
    /**
     * @param {int32} vertices - Physical qubits
     * @param {int32} logicalQubits - Logical qubits
     * @param {int32} distance - Code distance
     * @param {StabilizerCounts} stabilizers - Generator counts
     */
    constructor(vertices, logicalQubits, distance, stabilizers) {
      /** @type {int32} */
      this.vertices = vertices;
      /** @type {int32} */
      this.logicalQubits = logicalQubits;
      /** @type {int32} */
      this.distance = distance;
      /** @type {StabilizerCounts} */
      this.stabilizers = stabilizers;
      /** @type {string} */
      this.latticeType = 'Triangular (2-simplex)';
      /** @type {string} */
      this.colorCoding = '3-coloring (RED, GREEN, BLUE faces)';
      /** @type {string} */
      this.topology = 'Hexagonal plaquettes with 3-body stabilizers';
    }
  }

  class TopologicalColorCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Topological Color Code";
      this.description = "2D topological quantum code on hexagonal lattice with 3-coloring. Supports transversal gates beyond Clifford group enabling fault-tolerant universal quantum computing. Triangular lattice structure with color-coded stabilizers (X and Z operators on each colored face). Superior gate implementation compared to surface codes for certain operations.";
      this.inventor = "Hector Bombin, Miguel Angel Martin-Delgado";
      this.year = 2006;
      this.category = CategoryType.ECC;
      this.subCategory = "Quantum Code";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.INTL;

      // Documentation and references
      this.documentation = [
        new LinkItem("Error Correction Zoo - Color Code", "https://errorcorrectionzoo.org/c/color"),
        new LinkItem("Error Correction Zoo - 2D Color Code", "https://errorcorrectionzoo.org/c/2d_color"),
        new LinkItem("Quantum Journal - Boundaries and Twist Defects", "https://quantum-journal.org/papers/q-2018-10-19-101/"),
        new LinkItem("Wikipedia - Topological Quantum Computing", "https://en.wikipedia.org/wiki/Topological_quantum_computer")
      ];

      this.references = [
        new LinkItem("Bombin and Martin-Delgado (2006) - Original Paper", "https://arxiv.org/abs/quant-ph/0605138"),
        new LinkItem("Bombin (2015) - Gauge Color Codes", "https://arxiv.org/abs/1311.0879"),
        new LinkItem("Kubica (2018) - Unfolding Color Code", "https://arxiv.org/abs/1708.07131"),
        new LinkItem("Delfosse et al (2020) - Decoder for Triangular Color Code", "https://arxiv.org/abs/2108.11395"),
        new LinkItem("Landahl et al (2011) - Fault-Tolerant Quantum Computing", "https://arxiv.org/abs/1108.5738")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Distance-3 Error Correction Limit",
          "The [[7,1,3]] color code can only correct single qubit errors. For practical quantum computing, higher-distance codes (d≥5) are needed but require significantly more qubits."
        ),
        new Vulnerability(
          "Syndrome Extraction Complexity",
          "Color codes require measuring stabilizers on all three colors of faces (plaquettes), which is more complex than surface codes requiring only two types of stabilizers."
        ),
        new Vulnerability(
          "Qubit Overhead",
          "Encodes 1 logical qubit into 7 physical qubits for distance-3. Higher distances scale as n ≈ d² qubits, similar to surface codes."
        ),
        new Vulnerability(
          "Classical Simulation Limitations",
          "This implementation simulates quantum states as classical bit patterns for educational purposes. Real color codes require quantum hardware and preserve superposition states, entanglement, and phase information."
        ),
        new Vulnerability(
          "Decoder Complexity",
          "Optimal decoding for color codes is NP-hard. Practical decoders use approximate algorithms (Möbius matching, restriction decoders) with sub-optimal performance."
        )
      ];

      // Test vectors based on Error Correction Zoo and standard quantum code literature
      // [[7,1,3]] color code on triangular lattice (2-simplex in 2D)
      // Color code logical states follow CSS code structure
      this.tests = [
        // Encode logical |0⟩ state
        new TestCase(
          [0],
          [0, 0, 0, 0, 0, 0, 0],
          "Color code [[7,1,3]] encode logical |0⟩",
          "https://errorcorrectionzoo.org/c/color"
        ),
        // Encode logical |1⟩ state
        new TestCase(
          [1],
          [1, 1, 1, 1, 1, 1, 1],
          "Color code [[7,1,3]] encode logical |1⟩",
          "https://errorcorrectionzoo.org/c/color"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {TopologicalColorCodeInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new TopologicalColorCodeInstance(this, isInverse);
    }
  }

  /**
 * TopologicalColorCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class TopologicalColorCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {TopologicalColorCodeAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this.result = null;

      // Color code [[7,1,3]] parameters
      this.n = 7; // Physical qubits (vertices of triangular lattice)
      this.k = 1; // Logical qubits
      this.d = 3; // Code distance (corrects floor((d-1)/2) = 1 error)

      // Hexagonal lattice with 3-coloring (RED=0, GREEN=1, BLUE=2)
      // Triangular lattice with 7 vertices arranged in triangular pattern:
      //       0
      //      /|\
      //     1 2 3
      //    / \|/ \
      //   4   5   6
      //
      // Face coloring (plaquettes):
      // - RED faces: [0,1,2], [2,3,5], [1,4,5]
      // - GREEN faces: [0,2,3], [1,2,5], [4,5,6]
      // - BLUE faces: [0,1,3], [2,5,6], [1,5,4]

      // Stabilizer generators for [[7,1,3]] color code
      // Each face has both X-type and Z-type stabilizers
      // X-stabilizers detect phase-flip errors
      // Z-stabilizers detect bit-flip errors

      // RED face X-stabilizers (acting on vertices of red faces)
      /** @type {uint8[][]} */
      this.stabilizerRedX = [
        FACE_012.slice(), // Face {0,1,2}
        FACE_235.slice(), // Face {2,3,5}
        FACE_145.slice()  // Face {1,4,5}
      ];

      // GREEN face X-stabilizers
      /** @type {uint8[][]} */
      this.stabilizerGreenX = [
        FACE_023.slice(), // Face {0,2,3}
        FACE_125.slice(), // Face {1,2,5}
        FACE_456.slice()  // Face {4,5,6}
      ];

      // BLUE face X-stabilizers
      /** @type {uint8[][]} */
      this.stabilizerBlueX = [
        FACE_013.slice(), // Face {0,1,3}
        FACE_256.slice(), // Face {2,5,6}
        FACE_145.slice()  // Face {1,4,5} (redundant with red)
      ];

      // Z-stabilizers (same structure as X-stabilizers)
      // In CSS-type color codes, Z-stabilizers mirror X-stabilizers
      /** @type {uint8[][]} */
      this.stabilizerRedZ = this.stabilizerRedX;
      /** @type {uint8[][]} */
      this.stabilizerGreenZ = this.stabilizerGreenX;
      /** @type {uint8[][]} */
      this.stabilizerBlueZ = this.stabilizerBlueX;

      // Independent stabilizers (non-redundant set)
      // 6 independent stabilizers for [[7,1,3]] code (n-k = 6)
      /** @type {uint8[][]} */
      this.stabilizerGeneratorsX = [
        FACE_012.slice(), // Red face {0,1,2}
        FACE_235.slice(), // Red face {2,3,5}
        FACE_145.slice(), // Red/Blue face {1,4,5}
        FACE_023.slice(), // Green face {0,2,3}
        FACE_125.slice(), // Green face {1,2,5}
        FACE_456.slice()  // Green face {4,5,6}
      ];

      /** @type {uint8[][]} */
      this.stabilizerGeneratorsZ = [
        FACE_012.slice(), // Red Z-stabilizer
        FACE_235.slice(), // Red Z-stabilizer
        FACE_145.slice(), // Red/Blue Z-stabilizer
        FACE_023.slice(), // Green Z-stabilizer
        FACE_125.slice(), // Green Z-stabilizer
        FACE_456.slice()  // Green Z-stabilizer
      ];

      // Logical operators (stabilizer-commuting operators)
      // Logical X operator: X̄ acts on qubits forming a path through lattice
      /** @type {uint8[]} */
      this.logicalX = [1, 1, 1, 1, 1, 1, 1]; // All qubits (for [[7,1,3]] simplex code)

      // Logical Z operator: Z̄ anticommutes with X̄
      /** @type {uint8[]} */
      this.logicalZ = [1, 1, 1, 1, 1, 1, 1]; // All qubits (dual structure)
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('TopologicalColorCodeInstance.Feed: Input must be bit array');
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
        throw new Error('TopologicalColorCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    /**
     * Encode logical qubit to 7 physical qubits using [[7,1,3]] color code
     * For classical simulation: |0⟩ → |0000000⟩, |1⟩ → |1111111⟩
     * Real quantum encoding preserves superposition: α|0⟩+β|1⟩ → α|0000000⟩+β|1111111⟩
     * @param {uint8[]} logicalQubit - One logical bit
     * @returns {uint8[]} Seven physical bits
     */
    encode(logicalQubit) {
      if (logicalQubit.length !== this.k) {
        throw new Error("Color code encode: Input must be exactly " + this.k + " logical qubit (as classical bit)");
      }

      /** @type {uint8} */
      const logical = logicalQubit[0];

      // Color code logical codewords (CSS code structure)
      // Logical |0⟩ is the +1 eigenstate of all Z-stabilizers → |0000000⟩
      // Logical |1⟩ is obtained by applying logical X̄ → |1111111⟩
      /** @type {uint8[]} */
      const encoded = [];
      for (let i = 0; i < this.n; ++i) encoded.push(logical);

      return encoded;
    }

    /**
     * Decode physical qubits with error correction
     * Measures X and Z stabilizers to detect and correct errors
     * Uses syndrome decoding to identify error locations on triangular lattice
     * @param {uint8[]} physicalQubits - Seven physical bits
     * @returns {uint8[]} One logical bit
     */
    decode(physicalQubits) {
      if (physicalQubits.length !== this.n) {
        throw new Error("Color code decode: Input must be exactly " + this.n + " physical qubits (as classical bits)");
      }

      // Copy to avoid modifying input
      /** @type {uint8[]} */
      const received = physicalQubits.slice();

      // Measure Z-stabilizers (detect X errors / bit-flips)
      /** @type {uint8[]} */
      const syndromeZ = this.measureStabilizers(received, this.stabilizerGeneratorsZ);

      // Calculate error location from syndrome
      /** @type {int32} */
      const errorPosition = this.decodeMinimumWeight(syndromeZ, this.stabilizerGeneratorsZ);

      // Correct bit-flip error if detected
      if (errorPosition !== -1 && errorPosition < this.n) {
        received[errorPosition] = OpCodes.And32(OpCodes.Xor32(received[errorPosition], 1), 0xFF);
      }

      // Extract logical qubit (majority vote for classical simulation)
      // Real quantum decoding would measure logical Z̄ operator
      /** @type {uint8} */
      const logicalQubit = this.extractLogicalQubit(received);

      /** @type {uint8[]} */
      const decoded = [logicalQubit];
      return decoded;
    }

    /**
     * Measure stabilizer generators
     * Returns syndrome (array of measurement outcomes)
     * @param {uint8[]} qubits - Physical bits
     * @param {uint8[][]} stabilizers - Generator rows
     * @returns {uint8[]} Syndrome
     */
    measureStabilizers(qubits, stabilizers) {
      /** @type {uint8[]} */
      const syndrome = [];

      for (let i = 0; i < stabilizers.length; ++i) {
        /** @type {uint8} */
        let measurement = 0;
        for (let j = 0; j < this.n; ++j) {
          if (stabilizers[i][j] === 1) {
            measurement = OpCodes.And32(OpCodes.Xor32(measurement, qubits[j]), 0xFF);
          }
        }
        syndrome.push(measurement);
      }

      return syndrome;
    }

    /**
     * Decode syndrome to error position using minimum weight matching
     * For [[7,1,3]] code, use lookup table for single-qubit errors
     * @param {uint8[]} syndrome - Syndrome
     * @param {uint8[][]} stabilizers - Generator rows
     * @returns {int32} Error position, or -1
     */
    decodeMinimumWeight(syndrome, stabilizers) {
      // Check if syndrome is trivial (no error)
      /** @type {int32} */
      let syndromeSum = 0;
      for (let i = 0; i < syndrome.length; ++i) syndromeSum += syndrome[i];
      if (syndromeSum === 0) {
        return -1; // No error detected
      }

      // For distance-3 code, try all single-qubit error hypotheses
      // Find qubit position that matches syndrome
      for (let pos = 0; pos < this.n; ++pos) {
        // Calculate expected syndrome for error at position pos
        /** @type {uint8[]} */
        const expectedSyndrome = [];
        for (let i = 0; i < stabilizers.length; ++i) {
          expectedSyndrome.push(stabilizers[i][pos]);
        }

        // Check if expected syndrome matches measured syndrome
        let match = true;
        for (let i = 0; i < syndrome.length; ++i) {
          if (syndrome[i] !== expectedSyndrome[i]) {
            match = false;
            break;
          }
        }

        if (match) {
          return pos; // Error found at position pos
        }
      }

      // If no single-qubit error matches, try two-qubit errors (detectable but not correctable)
      // For educational purposes, return -1 (error detected but not correctable)
      return -1;
    }

    /**
     * Extract logical qubit using majority vote (classical approximation)
     * Real quantum systems would measure logical Z̄ operator
     * @param {uint8[]} qubits - Physical bits
     * @returns {uint8} Majority bit
     */
    extractLogicalQubit(qubits) {
      // Count ones
      /** @type {int32} */
      let ones = 0;
      for (let i = 0; i < this.n; ++i) {
        ones += qubits[i];
      }

      // Majority vote: if more than half are 1, logical qubit is |1⟩
      return ones > this.n / 2 ? 1 : 0;
    }

    /**
     * Detect if error is present (public API)
     * @param {uint8[]} data - Received codeword symbols
     * @returns {boolean} True if errors detected
     */
    DetectError(data) {
      if (data.length !== this.n) {
        return true; // Invalid length is an error
      }

      // Measure all stabilizers
      /** @type {uint8[]} */
      const syndromeX = this.measureStabilizers(data, this.stabilizerGeneratorsX);
      /** @type {uint8[]} */
      const syndromeZ = this.measureStabilizers(data, this.stabilizerGeneratorsZ);

      // Check if any syndrome is non-trivial
      let hasError = false;
      for (let i = 0; i < syndromeX.length && !hasError; ++i) hasError = syndromeX[i] !== 0;
      for (let i = 0; i < syndromeZ.length && !hasError; ++i) hasError = syndromeZ[i] !== 0;

      return hasError;
    }

    /**
     * Introduce error for testing (educational purposes)
     * errorType: 'X' (bit-flip), 'Z' (phase-flip), 'Y' (both)
     * position: qubit index 0-6
     * @param {uint8[]} qubits - Physical bits
     * @param {string} errorType - "X", "Z" or "Y"
     * @param {int32} position - Qubit index
     * @returns {uint8[]} Bits with the error applied
     */
    IntroduceError(qubits, errorType, position) {
      if (position < 0 || position >= this.n) {
        throw new Error("Error position must be between 0 and " + (this.n - 1));
      }

      /** @type {uint8[]} */
      const result = qubits.slice();

      switch (errorType) {
        case 'X':
          // X error: bit-flip (|0⟩↔|1⟩)
          result[position] = OpCodes.And32(OpCodes.Xor32(result[position], 1), 0xFF);
          break;

        case 'Z':
          // Z error: phase-flip (classical simulation: no visible effect on computational basis)
          // In real quantum systems: |+⟩→|-⟩, affects superposition phases
          // Mark symbolically for educational purposes
          break;

        case 'Y':
          // Y error: both X and Z errors (XZ = iY)
          result[position] = OpCodes.And32(OpCodes.Xor32(result[position], 1), 0xFF);
          break;

        default:
          throw new Error("Unknown error type: " + errorType + ". Use 'X', 'Z', or 'Y'");
      }

      return result;
    }

    /**
     * Get lattice structure information (educational visualization)
     * @returns {LatticeInfo} Lattice description
     */
    getLatticeInfo() {
      return new LatticeInfo(this.n, this.k, this.d,
        new StabilizerCounts(this.stabilizerGeneratorsX.length, this.stabilizerGeneratorsZ.length));
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new TopologicalColorCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { TopologicalColorCodeAlgorithm, TopologicalColorCodeInstance };
}));
