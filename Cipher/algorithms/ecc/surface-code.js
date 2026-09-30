/*
 * Topological Surface Code Implementation
 * Distance-3 planar surface code [[17,1,3]] with stabilizer-based error correction
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

  /**
   * [[n, k, d]] parameters as reported by GetCodeParameters()
   * @class
   */
  class SurfaceCodeParameters {
    /**
     * @param {int32} n - Physical qubits
     * @param {int32} k - Logical qubits
     * @param {int32} d - Distance
     */
    constructor(n, k, d) {
      /** @type {int32} */
      this.n = n;
      /** @type {int32} */
      this.k = k;
      /** @type {int32} */
      this.d = d;
      /** @type {string} */
      this.description = "[[" + n + "," + k + "," + d + "]]";
    }
  }

  /**
   * The four qubits of a stabilizer
   * @param {int32} a - First qubit
   * @param {int32} b - Second qubit
   * @param {int32} c - Third qubit
   * @param {int32} d - Fourth qubit
   * @returns {int32[]} Qubit indices
   */
  function quad(a, b, c, d) {
    /** @type {int32[]} */
    const qubits = [a, b, c, d];
    return qubits;
  }

  /**
   * The qubits of a stabilizer that lie below a limit, in order
   * @param {int32} a - First qubit
   * @param {int32} b - Second qubit
   * @param {int32} c - Third qubit
   * @param {int32} d - Fourth qubit
   * @param {int32} limit - Exclusive upper bound
   * @returns {int32[]} Qubit indices below the limit
   */
  function quadBelow(a, b, c, d, limit) {
    /** @type {int32[]} */
    const all = [a, b, c, d];
    /** @type {int32[]} */
    const kept = [];
    for (let i = 0; i < all.length; ++i) {
      if (all[i] < limit) kept.push(all[i]);
    }
    return kept;
  }

  class TopologicalSurfaceCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Topological Surface Code";
      this.description = "Classical simulation of topological surface code, a 2D lattice quantum error correction code with stabilizer measurements. Educational implementation demonstrating syndrome extraction and error correction principles from Kitaev's fault-tolerant quantum computing framework.";
      this.inventor = "Alexei Kitaev";
      this.year = 1997;
      this.category = CategoryType.ECC;
      this.subCategory = "Quantum Code";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.RU;

      // Documentation and references
      this.documentation = [
        new LinkItem("Kitaev's Original Paper (1997)", "https://arxiv.org/abs/quant-ph/9707021"),
        new LinkItem("Topological Quantum Memory (2002)", "https://arxiv.org/abs/quant-ph/0110143"),
        new LinkItem("Error Correction Zoo - Surface Code", "https://errorcorrectionzoo.org/c/surface"),
        new LinkItem("Google Quantum AI - Surface Code", "https://www.nature.com/articles/s41586-022-05434-1"),
        new LinkItem("IBM Qiskit Surface Codes", "https://github.com/The-Singularity-Research/QISKit-Surface-Codes")
      ];

      this.references = [
        new LinkItem("Fault-tolerant quantum computation by anyons", "https://arxiv.org/abs/quant-ph/9707021"),
        new LinkItem("Dennis, Kitaev, Landahl, Preskill - Topological quantum memory", "https://arxiv.org/abs/quant-ph/0110143"),
        new LinkItem("Google Willow Surface Code", "https://www.nature.com/articles/s41586-024-08449-y"),
        new LinkItem("Surface codes: Towards practical large-scale quantum computation", "https://arxiv.org/abs/1208.0928")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Quantum Hardware Required",
          "Surface codes require quantum hardware with physical qubits. Classical simulation is exponentially expensive."
        ),
        new Vulnerability(
          "Threshold Requirements",
          "Requires physical error rates below ~1% threshold for effective error correction. Above threshold, logical error rates increase."
        ),
        new Vulnerability(
          "Resource Overhead",
          "Distance-3 code requires 17 physical qubits per logical qubit. Distance-5 requires 49 qubits. Overhead grows quadratically."
        )
      ];

      // Test vectors based on stabilizer formalism from academic literature
      // Surface codes operate on quantum states, so we represent classical bit patterns
      // that would correspond to syndrome measurements and error patterns
      this.tests = [
        // Test 1: No errors - all syndrome measurements should be zero
        {
          text: "Distance-3 planar surface code - no errors",
          uri: "https://errorcorrectionzoo.org/c/surface",
          distance: 3,
          input: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 17 qubits, no errors
          expected: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] // No syndrome, no correction
        },

        // Test 2: Detect single bit flip error with stabilizers
        {
          text: "Distance-3 planar surface code - X error detection via stabilizers",
          uri: "https://arxiv.org/abs/quant-ph/0110143",
          distance: 3,
          input: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Error on position 1
          expected: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] // Corrected (simplified heuristic)
        },

        // Test 3: Detect single phase flip error with Z stabilizers
        {
          text: "Distance-3 planar surface code - Z error detection via stabilizers",
          uri: "https://arxiv.org/abs/quant-ph/0110143",
          distance: 3,
          errorType: 'Z',
          input: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Z error on position 1
          expected: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] // Corrected
        },

        // Test 4: Logical state encoding - basis state |0>
        {
          text: "Encode logical |0> state in distance-3 surface code",
          uri: "https://errorcorrectionzoo.org/c/surface",
          distance: 3,
          logicalState: 0,
          input: [0], // Logical bit 0
          expected: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] // Encoded as 17 physical qubits
        },

        // Test 5: Logical state encoding - basis state |1>
        {
          text: "Encode logical |1> state in distance-3 surface code",
          uri: "https://errorcorrectionzoo.org/c/surface",
          distance: 3,
          logicalState: 1,
          input: [1], // Logical bit 1
          expected: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] // Encoded (simplified representation)
        },

        // Test 6: Distance-5 configuration (49 qubits)
        {
          text: "Distance-5 planar surface code - no errors",
          uri: "https://www.nature.com/articles/s41586-024-08449-y",
          distance: 5,
          input: new Array(49).fill(0),
          expected: new Array(49).fill(0)
        },

        // Test 7: Syndrome extraction - adjacent X stabilizers detect bit flip
        {
          text: "Syndrome extraction for X stabilizer violation",
          uri: "https://arxiv.org/abs/1208.0928",
          distance: 3,
          syndromeExtraction: true,
          input: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Error creates syndrome
          expected: [0, 1, 1, 0, 0, 0, 0, 0] // Syndrome vector from 8 X-stabilizers
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {TopologicalSurfaceCodeInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new TopologicalSurfaceCodeInstance(this, isInverse);
    }
  }

  /**
 * TopologicalSurfaceCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class TopologicalSurfaceCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {TopologicalSurfaceCodeAlgorithm} algorithm - Parent algorithm instance
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

      // Default configuration: Distance-3 planar surface code [[17,1,3]]
      /** @type {int32} */
      this._distance = 3;
      /** @type {string} */
      this._errorType = 'X'; // X (bit flip) or Z (phase flip) errors
      /** @type {int32} */
      this._logicalState = null;
      /** @type {boolean} */
      this._syndromeExtraction = false;
      /** @type {int32} */
      this._numQubits = 0;
      /** @type {int32} */
      this._latticeRows = 0;
      /** @type {int32} */
      this._latticeCols = 0;
      /** @type {int32[][]} */
      this._xStabilizers = null;
      /** @type {int32[][]} */
      this._zStabilizers = null;

      // Initialize lattice structures
      this._initializeLattice();
    }

    // Configuration properties
    /**
     * @param {int32} d - Code distance (3, 5 or 7)
     */
    set distance(d) {
      if (d !== 3 && d !== 5 && d !== 7) {
        throw new Error('TopologicalSurfaceCodeInstance.distance: Only distances 3, 5, 7 supported (17, 49, 97 qubits)');
      }
      this._distance = d;
      this._initializeLattice();
    }

    /**
     * @returns {int32} Code distance
     */
    get distance() {
      return this._distance;
    }

    /**
     * @param {string} type - "X" or "Z"
     */
    set errorType(type) {
      if (type !== 'X' && type !== 'Z') {
        throw new Error('TopologicalSurfaceCodeInstance.errorType: Must be "X" or "Z"');
      }
      this._errorType = type;
    }

    /**
     * @returns {string} "X" or "Z"
     */
    get errorType() {
      return this._errorType;
    }

    /**
     * @param {int32} state - 0, 1 or null
     */
    set logicalState(state) {
      if (state !== null && state !== 0 && state !== 1) {
        throw new Error('TopologicalSurfaceCodeInstance.logicalState: Must be 0, 1, or null');
      }
      this._logicalState = state;
    }

    /**
     * @returns {int32} 0, 1 or null
     */
    get logicalState() {
      return this._logicalState;
    }

    /**
     * @param {boolean} value - Return the syndrome instead of decoding
     */
    set syndromeExtraction(value) {
      this._syndromeExtraction = !!value;
    }

    /**
     * @returns {boolean} Syndrome extraction mode
     */
    get syndromeExtraction() {
      return this._syndromeExtraction;
    }

    /**
     * @returns {void}
     */
    _initializeLattice() {
      // Initialize surface code lattice based on distance
      // Qubit counts for rotated planar surface code [[n,1,d]]
      // [[17,1,3]], [[49,1,5]], [[97,1,7]]
      const d = this._distance;
      this._numQubits = d === 3 ? 17 : (d === 5 ? 49 : 97);

      // Lattice dimensions for rotated surface code
      this._latticeRows = 2 * d - 1;
      this._latticeCols = 2 * d - 1;

      // Initialize stabilizer generators
      // X-stabilizers (star operators) and Z-stabilizers (plaquette operators)
      this._xStabilizers = this._generateXStabilizers();
      this._zStabilizers = this._generateZStabilizers();
    }

    /**
     * @returns {int32[][]} X stabilizers
     */
    _generateXStabilizers() {
      // Generate X-type stabilizers (star operators)
      // Each X stabilizer acts on 4 adjacent qubits in star pattern
      /** @type {int32[][]} */
      const stabilizers = [];
      const d = this._distance;

      // For distance-3 rotated surface code [[17,1,3]]
      // Simplified stabilizer layout for 17 qubits
      if (d === 3) {
        // 8 X-stabilizers for distance-3
        stabilizers.push(quad(0, 1, 5, 6));     // Top-left
        stabilizers.push(quad(1, 2, 6, 7));     // Top-center
        stabilizers.push(quad(2, 3, 7, 8));     // Top-right
        stabilizers.push(quad(5, 6, 9, 10));    // Middle-left
        stabilizers.push(quad(6, 7, 10, 11));   // Middle-center
        stabilizers.push(quad(7, 8, 11, 12));   // Middle-right
        stabilizers.push(quad(9, 10, 13, 14));  // Bottom-left
        stabilizers.push(quad(10, 11, 14, 15)); // Bottom-center
      } else if (d === 5) {
        // Approximate for distance-5 (49 qubits)
        for (let i = 0; i < 24; ++i) {
          const base = i * 2;
          stabilizers.push(quadBelow(base, base + 1, base + 7, base + 8, 49));
        }
      } else if (d === 7) {
        // Approximate for distance-7 (97 qubits)
        for (let i = 0; i < 48; ++i) {
          const base = i * 2;
          stabilizers.push(quadBelow(base, base + 1, base + 14, base + 15, 97));
        }
      }

      return stabilizers;
    }

    /**
     * @returns {int32[][]} Z stabilizers
     */
    _generateZStabilizers() {
      // Generate Z-type stabilizers (plaquette operators)
      // Each Z stabilizer acts on 4 qubits around a plaquette
      /** @type {int32[][]} */
      const stabilizers = [];
      const d = this._distance;

      // For distance-3 rotated surface code [[17,1,3]]
      if (d === 3) {
        // 8 Z-stabilizers for distance-3 (dual to X-stabilizers)
        stabilizers.push(quad(0, 1, 4, 5));      // Plaquette 1
        stabilizers.push(quad(1, 2, 5, 6));      // Plaquette 2
        stabilizers.push(quad(2, 3, 6, 7));      // Plaquette 3
        stabilizers.push(quad(4, 5, 8, 9));      // Plaquette 4
        stabilizers.push(quad(5, 6, 9, 10));     // Plaquette 5
        stabilizers.push(quad(6, 7, 10, 11));    // Plaquette 6
        stabilizers.push(quad(8, 9, 12, 13));    // Plaquette 7
        stabilizers.push(quad(9, 10, 13, 14));   // Plaquette 8
      } else if (d === 5) {
        // Approximate for distance-5
        for (let i = 0; i < 24; ++i) {
          const base = i * 2;
          stabilizers.push(quadBelow(base, base + 1, base + 6, base + 7, 49));
        }
      } else if (d === 7) {
        // Approximate for distance-7
        for (let i = 0; i < 48; ++i) {
          const base = i * 2;
          stabilizers.push(quadBelow(base, base + 1, base + 13, base + 14, 97));
        }
      }

      return stabilizers;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('TopologicalSurfaceCodeInstance.Feed: Input must be bit array');
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
        throw new Error('TopologicalSurfaceCodeInstance.Result: Call Feed() first to process data');
      }
      this.result = this.isInverse
        ? this.decode(this._feedBuffer)
        : this.encode(this._feedBuffer);
      return this.result;
    }

    /**
     * @param {uint8[]} data - Message symbols
     * @returns {uint8[]} Codeword symbols
     */
    encode(data) {
      // Encode logical qubit(s) into surface code
      const numPhysicalQubits = this._numQubits;

      // If input is already physical qubit array (codeword), perform error correction
      if (data.length === numPhysicalQubits) {
        return this.decode(data); // Apply error correction
      }

      // Check if encoding logical state from property
      if (this._logicalState !== null) {
        // Encode single logical qubit
        /** @type {uint8[]} */
        const encoded = OpCodes.CreateArray(numPhysicalQubits, 0);

        if (this._logicalState === 1) {
          // Apply logical X operator (flips all qubits along a logical operator path)
          // For distance-3, this is a simplified representation
          for (let i = 0; i < numPhysicalQubits; ++i) {
            encoded[i] = 1;
          }
        }

        return encoded;
      }

      // Single logical qubit encoding from data
      if (data.length === 1) {
        /** @type {uint8[]} */
        const encoded = OpCodes.CreateArray(numPhysicalQubits, 0);
        if (data[0] === 1) {
          // Apply logical X
          for (let i = 0; i < numPhysicalQubits; ++i) {
            encoded[i] = 1;
          }
        }
        return encoded;
      }

      // If data doesn't match expected size, throw error
      throw new Error("encode: Invalid input size " + data.length + ", expected 1 or " + numPhysicalQubits + " (currently " + numPhysicalQubits + ")");
    }

    /**
     * @param {uint8[]} data - Received codeword symbols
     * @returns {uint8[]} Decoded message symbols
     */
    decode(data) {
      const numPhysicalQubits = this._numQubits;

      if (data.length !== numPhysicalQubits) {
        throw new Error("decode: Input must be " + numPhysicalQubits + " bits for distance-" + this._distance + " code");
      }

      // Create working copy
      /** @type {uint8[]} */
      const state = data.slice();

      // Extract syndrome from stabilizer measurements
      /** @type {uint8[]} */
      const syndrome = this._measureSyndrome(state);

      // If syndrome extraction mode, return syndrome
      if (this._syndromeExtraction) {
        return syndrome;
      }

      // Decode syndrome to find all error locations (minimum weight perfect matching)
      /** @type {int32[]} */
      const errorLocations = this._decodeSyndrome(syndrome);

      // Apply corrections for all detected errors
      for (let e = 0; e < errorLocations.length; ++e) {
        /** @type {int32} */
        const errorLocation = errorLocations[e];
        if (errorLocation >= 0 && errorLocation < state.length) {
          state[errorLocation] = OpCodes.Xor32(state[errorLocation], 1); // Flip bit
        }
      }

      return state;
    }

    /**
     * @param {uint8[]} state - Physical qubits
     * @returns {uint8[]} Stabilizer outcomes
     */
    _measureSyndrome(state) {
      // Measure all stabilizers and return syndrome
      /** @type {uint8[]} */
      const syndrome = [];
      /** @type {int32[][]} */
      const stabilizers = this._errorType === 'X' ? this._xStabilizers : this._zStabilizers;

      for (let si = 0; si < stabilizers.length; ++si) {
        /** @type {int32[]} */
        const s = stabilizers[si];
        // Measure stabilizer (parity of qubits)
        /** @type {uint32} */
        let measurement = 0;
        for (let qi = 0; qi < s.length; ++qi) {
          /** @type {int32} */
          const qubit = s[qi];
          if (qubit < state.length) {
            measurement = OpCodes.Xor32(measurement, state[qubit]); // XOR parity
          }
        }
        syndrome.push(measurement);
      }

      return syndrome;
    }

    /**
     * @param {uint8[]} syndrome - Stabilizer outcomes
     * @returns {int32[]} Qubits to flip
     */
    _decodeSyndrome(syndrome) {
      // Simplified minimum-weight perfect matching decoder
      // For production, use Blossom V or PyMatching algorithms

      // Find all non-zero syndrome indices
      /** @type {int32[]} */
      const triggeredStabilizers = [];
      for (let i = 0; i < syndrome.length; ++i) {
        if (syndrome[i] !== 0) {
          triggeredStabilizers.push(i);
        }
      }

      // If no errors detected, return empty array
      /** @type {int32[]} */
      const none = [];
      if (triggeredStabilizers.length === 0) {
        return none;
      }

      // Get stabilizers
      /** @type {int32[][]} */
      const stabilizers = this._errorType === 'X' ? this._xStabilizers : this._zStabilizers;

      // For single triggered stabilizer, pick one of its qubits
      if (triggeredStabilizers.length === 1) {
        const stabIdx = triggeredStabilizers[0];
        if (stabIdx < stabilizers.length && stabilizers[stabIdx].length > 0) {
          /** @type {int32[]} */
          const single = [stabilizers[stabIdx][0]];
          return single;
        }
        return none;
      }

      // For multiple triggered stabilizers, find qubits that appear in multiple stabilizers
      // These are more likely to be the error location
      // (qubits in first-seen order with their counts)
      /** @type {int32[]} */
      const seenQubits = [];
      /** @type {int32[]} */
      const qubitCounts = [];
      for (let t = 0; t < triggeredStabilizers.length; ++t) {
        const stabIdx = triggeredStabilizers[t];
        if (stabIdx < stabilizers.length) {
          /** @type {int32[]} */
          const qubits = stabilizers[stabIdx];
          for (let q = 0; q < qubits.length; ++q) {
            const at = seenQubits.indexOf(qubits[q]);
            if (at < 0) {
              seenQubits.push(qubits[q]);
              qubitCounts.push(1);
            } else {
              qubitCounts[at] = qubitCounts[at] + 1;
            }
          }
        }
      }

      // Find qubit that appears in most stabilizers
      let maxCount = 0;
      let errorQubit = -1;
      for (let q = 0; q < seenQubits.length; ++q) {
        if (qubitCounts[q] > maxCount) {
          maxCount = qubitCounts[q];
          errorQubit = seenQubits[q];
        }
      }

      if (errorQubit >= 0) {
        /** @type {int32[]} */
        const found = [errorQubit];
        return found;
      }
      return none;
    }

    /**
     * @param {int32} syndromeIndex - Stabilizer index
     * @returns {int32} Likely error qubit
     */
    _syndromeToErrorLocation(syndromeIndex) {
      // Map syndrome measurement to most likely error location
      // This is a simplified heuristic; real decoders use MWPM
      /** @type {int32[][]} */
      const stabilizers = this._errorType === 'X' ? this._xStabilizers : this._zStabilizers;

      if (syndromeIndex < stabilizers.length) {
        /** @type {int32[]} */
        const stabilizer = stabilizers[syndromeIndex];
        // Return first qubit in stabilizer as likely error location
        if (stabilizer.length > 0) {
          return stabilizer[0];
        }
      }

      return 0;
    }

    /**
     * @param {uint8[]} data - Received codeword symbols
     * @returns {boolean} True if errors detected
     */
    DetectError(data) {
      if (data.length !== this._numQubits) {
        return true; // Invalid size indicates error
      }

      /** @type {uint8[]} */
      const syndrome = this._measureSyndrome(data);

      // Check if any stabilizer is violated
      for (let i = 0; i < syndrome.length; ++i) {
        if (syndrome[i] !== 0) {
          return true;
        }
      }

      return false;
    }

    /**
     * @returns {SurfaceCodeParameters} [[n, k, d]] parameters
     */
    GetCodeParameters() {
      // Return [[n, k, d]] parameters
      const n = this._numQubits;
      const k = 1; // Single logical qubit
      const d = this._distance;

      return new SurfaceCodeParameters(n, k, d);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new TopologicalSurfaceCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { TopologicalSurfaceCodeAlgorithm, TopologicalSurfaceCodeInstance };
}));
