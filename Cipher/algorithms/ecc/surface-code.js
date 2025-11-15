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

    CreateInstance(isInverse = false) {
      return new TopologicalSurfaceCodeInstance(this, isInverse);
    }
  }

  class TopologicalSurfaceCodeInstance extends IErrorCorrectionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;

      // Default configuration: Distance-3 planar surface code [[17,1,3]]
      this._distance = 3;
      this._errorType = 'X'; // X (bit flip) or Z (phase flip) errors
      this._logicalState = null;
      this._syndromeExtraction = false;

      // Initialize lattice structures
      this._initializeLattice();
    }

    // Configuration properties
    set distance(d) {
      if (d !== 3 && d !== 5 && d !== 7) {
        throw new Error('TopologicalSurfaceCodeInstance.distance: Only distances 3, 5, 7 supported (17, 49, 97 qubits)');
      }
      this._distance = d;
      this._initializeLattice();
    }

    get distance() {
      return this._distance;
    }

    set errorType(type) {
      if (type !== 'X' && type !== 'Z') {
        throw new Error('TopologicalSurfaceCodeInstance.errorType: Must be "X" or "Z"');
      }
      this._errorType = type;
    }

    get errorType() {
      return this._errorType;
    }

    set logicalState(state) {
      if (state !== null && state !== 0 && state !== 1) {
        throw new Error('TopologicalSurfaceCodeInstance.logicalState: Must be 0, 1, or null');
      }
      this._logicalState = state;
    }

    get logicalState() {
      return this._logicalState;
    }

    set syndromeExtraction(value) {
      this._syndromeExtraction = !!value;
    }

    get syndromeExtraction() {
      return this._syndromeExtraction;
    }

    _initializeLattice() {
      // Initialize surface code lattice based on distance
      // Qubit counts for rotated planar surface code [[n,1,d]]
      const qubitCounts = {
        3: 17,  // [[17,1,3]]
        5: 49,  // [[49,1,5]]
        7: 97   // [[97,1,7]]
      };

      const d = this._distance;
      this._numQubits = qubitCounts[d];

      // Lattice dimensions for rotated surface code
      this._latticeRows = 2 * d - 1;
      this._latticeCols = 2 * d - 1;

      // Initialize stabilizer generators
      // X-stabilizers (star operators) and Z-stabilizers (plaquette operators)
      this._xStabilizers = this._generateXStabilizers();
      this._zStabilizers = this._generateZStabilizers();
    }

    _generateXStabilizers() {
      // Generate X-type stabilizers (star operators)
      // Each X stabilizer acts on 4 adjacent qubits in star pattern
      const stabilizers = [];
      const d = this._distance;

      // For distance-3 rotated surface code [[17,1,3]]
      // Simplified stabilizer layout for 17 qubits
      if (d === 3) {
        // 8 X-stabilizers for distance-3
        stabilizers.push([0, 1, 5, 6]);     // Top-left
        stabilizers.push([1, 2, 6, 7]);     // Top-center
        stabilizers.push([2, 3, 7, 8]);     // Top-right
        stabilizers.push([5, 6, 9, 10]);    // Middle-left
        stabilizers.push([6, 7, 10, 11]);   // Middle-center
        stabilizers.push([7, 8, 11, 12]);   // Middle-right
        stabilizers.push([9, 10, 13, 14]);  // Bottom-left
        stabilizers.push([10, 11, 14, 15]); // Bottom-center
      } else if (d === 5) {
        // Approximate for distance-5 (49 qubits)
        for (let i = 0; i < 24; ++i) {
          const base = i * 2;
          stabilizers.push([base, base + 1, base + 7, base + 8].filter(q => q < 49));
        }
      } else if (d === 7) {
        // Approximate for distance-7 (97 qubits)
        for (let i = 0; i < 48; ++i) {
          const base = i * 2;
          stabilizers.push([base, base + 1, base + 14, base + 15].filter(q => q < 97));
        }
      }

      return stabilizers;
    }

    _generateZStabilizers() {
      // Generate Z-type stabilizers (plaquette operators)
      // Each Z stabilizer acts on 4 qubits around a plaquette
      const stabilizers = [];
      const d = this._distance;

      // For distance-3 rotated surface code [[17,1,3]]
      if (d === 3) {
        // 8 Z-stabilizers for distance-3 (dual to X-stabilizers)
        stabilizers.push([0, 1, 4, 5]);      // Plaquette 1
        stabilizers.push([1, 2, 5, 6]);      // Plaquette 2
        stabilizers.push([2, 3, 6, 7]);      // Plaquette 3
        stabilizers.push([4, 5, 8, 9]);      // Plaquette 4
        stabilizers.push([5, 6, 9, 10]);     // Plaquette 5
        stabilizers.push([6, 7, 10, 11]);    // Plaquette 6
        stabilizers.push([8, 9, 12, 13]);    // Plaquette 7
        stabilizers.push([9, 10, 13, 14]);   // Plaquette 8
      } else if (d === 5) {
        // Approximate for distance-5
        for (let i = 0; i < 24; ++i) {
          const base = i * 2;
          stabilizers.push([base, base + 1, base + 6, base + 7].filter(q => q < 49));
        }
      } else if (d === 7) {
        // Approximate for distance-7
        for (let i = 0; i < 48; ++i) {
          const base = i * 2;
          stabilizers.push([base, base + 1, base + 13, base + 14].filter(q => q < 97));
        }
      }

      return stabilizers;
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('TopologicalSurfaceCodeInstance.Feed: Input must be bit array');
      }

      if (this.isInverse) {
        // Decoding: error correction and syndrome extraction
        this.result = this.decode(data);
      } else {
        // Encoding: map logical qubit to physical qubits
        this.result = this.encode(data);
      }
    }

    Result() {
      if (this.result === null) {
        throw new Error('TopologicalSurfaceCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

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
        const encoded = new Array(numPhysicalQubits).fill(0);

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
        const encoded = new Array(numPhysicalQubits).fill(0);
        if (data[0] === 1) {
          // Apply logical X
          for (let i = 0; i < numPhysicalQubits; ++i) {
            encoded[i] = 1;
          }
        }
        return encoded;
      }

      // If data doesn't match expected size, throw error
      throw new Error(`encode: Invalid input size ${data.length}, expected 1 or ${numPhysicalQubits} (currently ${numPhysicalQubits})`);
    }

    decode(data) {
      const numPhysicalQubits = this._numQubits;

      if (data.length !== numPhysicalQubits) {
        throw new Error(`decode: Input must be ${numPhysicalQubits} bits for distance-${this._distance} code`);
      }

      // Create working copy
      const state = [...data];

      // Extract syndrome from stabilizer measurements
      const syndrome = this._measureSyndrome(state);

      // If syndrome extraction mode, return syndrome
      if (this._syndromeExtraction) {
        return syndrome;
      }

      // Decode syndrome to find all error locations (minimum weight perfect matching)
      const errorLocations = this._decodeSyndrome(syndrome);

      // Apply corrections for all detected errors
      for (const errorLocation of errorLocations) {
        if (errorLocation >= 0 && errorLocation < state.length) {
          state[errorLocation] ^= 1; // Flip bit
        }
      }

      return state;
    }

    _measureSyndrome(state) {
      // Measure all stabilizers and return syndrome
      const syndrome = [];
      const stabilizers = this._errorType === 'X' ? this._xStabilizers : this._zStabilizers;

      for (let s of stabilizers) {
        // Measure stabilizer (parity of qubits)
        let measurement = 0;
        for (let qubit of s) {
          if (qubit < state.length) {
            measurement = measurement ^ state[qubit]; // XOR parity
          }
        }
        syndrome.push(measurement);
      }

      return syndrome;
    }

    _decodeSyndrome(syndrome) {
      // Simplified minimum-weight perfect matching decoder
      // For production, use Blossom V or PyMatching algorithms

      // Find all non-zero syndrome indices
      const triggeredStabilizers = [];
      for (let i = 0; i < syndrome.length; ++i) {
        if (syndrome[i] !== 0) {
          triggeredStabilizers.push(i);
        }
      }

      // If no errors detected, return empty array
      if (triggeredStabilizers.length === 0) {
        return [];
      }

      // Get stabilizers
      const stabilizers = this._errorType === 'X' ? this._xStabilizers : this._zStabilizers;

      // For single triggered stabilizer, pick one of its qubits
      if (triggeredStabilizers.length === 1) {
        const stabIdx = triggeredStabilizers[0];
        if (stabIdx < stabilizers.length && stabilizers[stabIdx].length > 0) {
          return [stabilizers[stabIdx][0]];
        }
        return [];
      }

      // For multiple triggered stabilizers, find qubits that appear in multiple stabilizers
      // These are more likely to be the error location
      const qubitCounts = new Map();
      for (const stabIdx of triggeredStabilizers) {
        if (stabIdx < stabilizers.length) {
          for (const qubit of stabilizers[stabIdx]) {
            qubitCounts.set(qubit, (qubitCounts.get(qubit) || 0) + 1);
          }
        }
      }

      // Find qubit that appears in most stabilizers
      let maxCount = 0;
      let errorQubit = -1;
      for (const [qubit, count] of qubitCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          errorQubit = qubit;
        }
      }

      return errorQubit >= 0 ? [errorQubit] : [];
    }

    _syndromeToErrorLocation(syndromeIndex) {
      // Map syndrome measurement to most likely error location
      // This is a simplified heuristic; real decoders use MWPM
      const stabilizers = this._errorType === 'X' ? this._xStabilizers : this._zStabilizers;

      if (syndromeIndex < stabilizers.length) {
        const stabilizer = stabilizers[syndromeIndex];
        // Return first qubit in stabilizer as likely error location
        if (stabilizer.length > 0) {
          return stabilizer[0];
        }
      }

      return 0;
    }

    DetectError(data) {
      if (data.length !== this._numQubits) {
        return true; // Invalid size indicates error
      }

      const syndrome = this._measureSyndrome(data);

      // Check if any stabilizer is violated
      for (let measurement of syndrome) {
        if (measurement !== 0) {
          return true;
        }
      }

      return false;
    }

    GetCodeParameters() {
      // Return [[n, k, d]] parameters
      const n = this._numQubits;
      const k = 1; // Single logical qubit
      const d = this._distance;

      return { n, k, d, description: `[[${n},${k},${d}]]` };
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
