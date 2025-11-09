/*
 * Quantum LDPC (Low-Density Parity-Check) Code
 * Quantum extension of classical LDPC codes using sparse parity-check matrices
 * Implements [[7,1,3]] Steane-style QLDPC for educational demonstration
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

  class QuantumLDPCAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Quantum LDPC Code";
      this.description = "Quantum extension of low-density parity-check codes using sparse parity-check matrices for both X and Z stabilizers. Enables scalable quantum error correction with lower overhead than surface codes. Under active research for fault-tolerant quantum computing by IBM, Google, and Microsoft.";
      this.inventor = "Daniel Gottesman, David MacKay";
      this.year = 2003;
      this.category = CategoryType.ECC;
      this.subCategory = "Quantum Code";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Error Correction Zoo - Quantum LDPC", "https://errorcorrectionzoo.org/c/qldpc"),
        new LinkItem("MacKay et al. - Sparse Graph Codes", "https://arxiv.org/abs/quant-ph/0304161"),
        new LinkItem("Wikipedia - Quantum LDPC Codes", "https://en.wikipedia.org/wiki/Quantum_error_correction#Quantum_LDPC_codes"),
        new LinkItem("Steane Code (QLDPC Example)", "https://errorcorrectionzoo.org/c/steane")
      ];

      this.references = [
        new LinkItem("MacKay-Mitchison-McFadden (2004)", "https://ieeexplore.ieee.org/document/1337106"),
        new LinkItem("Gottesman - Stabilizer Codes", "https://arxiv.org/abs/quant-ph/9705052"),
        new LinkItem("PRX Quantum - QLDPC Review", "https://link.aps.org/doi/10.1103/PRXQuantum.2.040101"),
        new LinkItem("Nielsen & Chuang - Quantum Computation", "https://doi.org/10.1017/CBO9780511976667")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Decoding Complexity",
          "Iterative belief propagation decoding has high computational complexity and may not converge for all error patterns."
        ),
        new Vulnerability(
          "Error Floor Phenomenon",
          "Like classical LDPC codes, QLDPC codes exhibit error floors at very low error rates due to near-codewords and trapping sets."
        ),
        new Vulnerability(
          "Classical Simulation Limitations",
          "This implementation treats quantum states as classical bit arrays for educational purposes. Real quantum error correction operates on superposition states requiring quantum hardware."
        ),
        new Vulnerability(
          "Limited Distance",
          "The [[7,1,3]] example code corrects only 1 arbitrary qubit error. Practical quantum computing requires larger codes with higher distance."
        )
      ];

      // Test vectors based on [[7,1,3]] Steane-style QLDPC code
      // Using sparse parity-check matrices from Hamming [7,4,3] construction
      // Reference: Error Correction Zoo - Steane code stabilizers
      this.tests = [
        // Encode logical |0⟩ state
        {
          text: "QLDPC [[7,1,3]] encode logical |0⟩",
          uri: "https://errorcorrectionzoo.org/c/steane",
          input: [0], // Logical qubit |0⟩
          expected: [0, 0, 0, 0, 0, 0, 0] // 7 physical qubits all |0⟩
        },
        // Encode logical |1⟩ state
        {
          text: "QLDPC [[7,1,3]] encode logical |1⟩",
          uri: "https://errorcorrectionzoo.org/c/steane",
          input: [1], // Logical qubit |1⟩
          expected: [1, 1, 1, 1, 1, 1, 1] // 7 physical qubits all |1⟩
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new QuantumLDPCInstance(this, isInverse);
    }
  }

  class QuantumLDPCInstance extends IErrorCorrectionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;

      // [[7,1,3]] Quantum LDPC code parameters
      this.n = 7; // Physical qubits
      this.k = 1; // Logical qubits
      this.d = 3; // Code distance (corrects (d-1)/2 = 1 error)

      // Sparse parity-check matrix for X-stabilizers (bit-flip detection)
      // Based on Hamming [7,4,3] code H matrix
      // Each row has weight 4, making this "low-density"
      // Reference: https://errorcorrectionzoo.org/c/steane
      this.H_X = [
        [0, 0, 0, 1, 1, 1, 1],
        [0, 1, 1, 0, 0, 1, 1],
        [1, 0, 1, 0, 1, 0, 1]
      ];

      // Sparse parity-check matrix for Z-stabilizers (phase-flip detection)
      // For Steane-style QLDPC: H_Z = H_X (self-dual CSS code)
      // Reference: https://errorcorrectionzoo.org/c/steane
      this.H_Z = [
        [0, 0, 0, 1, 1, 1, 1],
        [0, 1, 1, 0, 0, 1, 1],
        [1, 0, 1, 0, 1, 0, 1]
      ];

      // Stabilizer generators in Pauli notation (for reference)
      // X-type: IIIXXXX, IXXIIXX, XIXIXIX
      // Z-type: IIIZZZZ, IZZIIZZ, ZIZIZIZ
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('QuantumLDPCInstance.Feed: Input must be bit array');
      }

      if (this.isInverse) {
        // Decode with error correction
        this.result = this.decode(data);
      } else {
        // Encode logical qubit to physical qubits
        this.result = this.encode(data);
      }
    }

    Result() {
      if (this.result === null) {
        throw new Error('QuantumLDPCInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    /**
     * Encode logical qubit to 7 physical qubits using QLDPC [[7,1,3]]
     * Classical simulation: |0⟩ → |0000000⟩, |1⟩ → |1111111⟩
     * Real quantum: α|0⟩+β|1⟩ → α|0000000⟩+β|1111111⟩ (preserves superposition)
     */
    encode(logicalQubit) {
      if (logicalQubit.length !== this.k) {
        throw new Error(`QLDPC encode: Input must be exactly ${this.k} logical qubit (as classical bit)`);
      }

      const logical = logicalQubit[0];

      // Steane-style QLDPC logical codewords
      // Logical |0⟩ encoded as |0000000⟩ (even parity codeword)
      // Logical |1⟩ encoded as |1111111⟩ (odd parity codeword)
      // This satisfies all X and Z stabilizer constraints
      const encoded = new Array(this.n).fill(logical);

      return encoded;
    }

    /**
     * Decode physical qubits with quantum error correction
     * Uses separate X and Z syndrome measurements
     */
    decode(physicalQubits) {
      if (physicalQubits.length !== this.n) {
        throw new Error(`QLDPC decode: Input must be exactly ${this.n} physical qubits (as classical bits)`);
      }

      // Copy to avoid modifying input
      const received = [...physicalQubits];

      // Measure Z-stabilizers to detect X errors (bit-flips)
      const syndromeX = this.measureSyndrome(received, this.H_Z);

      // Correct X errors (bit-flips)
      const errorPosX = this.syndromeToErrorPosition(syndromeX);
      if (errorPosX !== -1) {
        received[errorPosX] ^= 1;
      }

      // Measure X-stabilizers to detect Z errors (phase-flips)
      // In classical simulation, phase-flips don't affect computational basis
      // Real quantum systems would need additional syndrome measurement
      const syndromeZ = this.measureSyndrome(received, this.H_X);
      const errorPosZ = this.syndromeToErrorPosition(syndromeZ);

      // For classical simulation, we note phase errors but can't observe them
      if (errorPosZ !== -1) {
        // In real quantum system: apply Z correction at errorPosZ
        // Classical simulation: no visible effect in computational basis
      }

      // Extract logical qubit using majority vote (classical approximation)
      const logicalQubit = this.extractLogicalQubit(received);

      return [logicalQubit];
    }

    /**
     * Measure syndrome using sparse parity-check matrix
     * Utilizes low-density property for efficient computation
     */
    measureSyndrome(qubits, parityMatrix) {
      const syndrome = new Array(parityMatrix.length).fill(0);

      for (let i = 0; i < parityMatrix.length; ++i) {
        let parity = 0;
        // Sparse matrix: only sum where matrix entry is 1
        for (let j = 0; j < this.n; ++j) {
          if (parityMatrix[i][j] === 1) {
            parity ^= qubits[j];
          }
        }
        syndrome[i] = parity;
      }

      return syndrome;
    }

    /**
     * Convert syndrome to error position using Hamming code lookup
     * Syndrome = 0 means no error
     * Syndrome ≠ 0 identifies error location
     */
    syndromeToErrorPosition(syndrome) {
      // Convert syndrome to integer using OpCodes
      let syndromeValue = 0;
      for (let i = 0; i < syndrome.length; ++i) {
        if (syndrome[i] === 1) {
          syndromeValue |= (1 << i);
        }
      }

      if (syndromeValue === 0) {
        return -1; // No error
      }

      // Hamming code: syndrome directly gives error position (1-indexed)
      // Positions: 1,2,3,4,5,6,7 (convert to 0-indexed)
      return syndromeValue - 1;
    }

    /**
     * Extract logical qubit using majority vote (classical approximation)
     * Real quantum systems measure logical Pauli operators
     */
    extractLogicalQubit(qubits) {
      // Count ones using OpCodes (though simple addition works here)
      let ones = 0;
      for (let i = 0; i < this.n; ++i) {
        ones += qubits[i];
      }

      // Majority vote: if more than half are 1, logical qubit is |1⟩
      return ones > (this.n >> 1) ? 1 : 0;
    }

    /**
     * Detect if error is present (public API for testing)
     * Measures both X and Z syndromes
     */
    DetectError(data) {
      if (data.length !== this.n) {
        return true; // Invalid length is an error
      }

      // Check X errors via Z-stabilizers
      const syndromeX = this.measureSyndrome(data, this.H_Z);
      let syndromeValueX = 0;
      for (let i = 0; i < syndromeX.length; ++i) {
        syndromeValueX |= (syndromeX[i] << i);
      }

      // Check Z errors via X-stabilizers
      const syndromeZ = this.measureSyndrome(data, this.H_X);
      let syndromeValueZ = 0;
      for (let i = 0; i < syndromeZ.length; ++i) {
        syndromeValueZ |= (syndromeZ[i] << i);
      }

      return syndromeValueX !== 0 || syndromeValueZ !== 0;
    }

    /**
     * Introduce quantum error for testing (educational purposes)
     * errorType: 'X' (bit-flip), 'Z' (phase-flip), 'Y' (both)
     * position: qubit index 0-6
     */
    IntroduceError(qubits, errorType, position) {
      if (position < 0 || position >= this.n) {
        throw new Error(`Error position must be between 0 and ${this.n - 1}`);
      }

      const result = [...qubits];

      switch (errorType) {
        case 'X':
          // X gate: bit-flip (|0⟩↔|1⟩)
          result[position] ^= 1;
          break;

        case 'Z':
          // Z gate: phase-flip (classical simulation: no visible effect)
          // Real quantum: |+⟩→|-⟩, but computational basis unchanged
          break;

        case 'Y':
          // Y gate: both bit-flip and phase-flip (iXZ)
          result[position] ^= 1;
          break;

        default:
          throw new Error(`Unknown error type: ${errorType}. Use 'X', 'Z', or 'Y'`);
      }

      return result;
    }

    /**
     * Check sparse matrix density (for validation)
     * Returns density as fraction of non-zero entries
     */
    getMatrixDensity(matrix) {
      let nonZeroCount = 0;
      let totalEntries = 0;

      for (let i = 0; i < matrix.length; ++i) {
        for (let j = 0; j < matrix[i].length; ++j) {
          ++totalEntries;
          if (matrix[i][j] !== 0) {
            ++nonZeroCount;
          }
        }
      }

      return totalEntries > 0 ? nonZeroCount / totalEntries : 0;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new QuantumLDPCAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { QuantumLDPCAlgorithm, QuantumLDPCInstance };
}));
