/*
 * Bacon-Shor Subsystem Quantum Error Correction Code
 * [[9,1,3]] subsystem code with gauge freedom for simplified error correction
 * Uses 3×3 qubit lattice with X and Z gauge operators
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
          ErrorCorrectionAlgorithm, IErrorCorrectionInstance, TestCase, LinkItem, Vulnerability } = AlgorithmFramework;

  // ===== BACON-SHOR [[9,1,3]] CODE CONSTANTS =====

  // The Bacon-Shor code uses a 3×3 lattice of qubits
  // Qubits are arranged as:
  //   0 1 2
  //   3 4 5
  //   6 7 8
  //
  // Stabilizer generators are products of two-qubit gauge operators

  // X-type stabilizers (detect phase errors): Act on adjacent columns
  // X_{i,*}X_{i+1,*} means X on all qubits in column i and column i+1
  const X_STABILIZERS_3x3 = [
    { qubits: [0, 1, 3, 4, 6, 7], name: 'X_col0 X_col1', description: 'X on columns 0,1' },
    { qubits: [1, 2, 4, 5, 7, 8], name: 'X_col1 X_col2', description: 'X on columns 1,2' }
  ];

  // Z-type stabilizers (detect bit-flip errors): Act on adjacent rows
  // Z_{*,j}Z_{*,j+1} means Z on all qubits in row j and row j+1
  const Z_STABILIZERS_3x3 = [
    { qubits: [0, 1, 2, 3, 4, 5], name: 'Z_row0 Z_row1', description: 'Z on rows 0,1' },
    { qubits: [3, 4, 5, 6, 7, 8], name: 'Z_row1 Z_row2', description: 'Z on rows 1,2' }
  ];

  // Two-qubit X-gauge operators (measuring pairs for X-stabilizer syndrome)
  const X_GAUGES_3x3 = [
    { qubits: [0, 1], row: 0, name: 'X_{0,0}X_{0,1}' },
    { qubits: [1, 2], row: 0, name: 'X_{0,1}X_{0,2}' },
    { qubits: [3, 4], row: 1, name: 'X_{1,0}X_{1,1}' },
    { qubits: [4, 5], row: 1, name: 'X_{1,1}X_{1,2}' },
    { qubits: [6, 7], row: 2, name: 'X_{2,0}X_{2,1}' },
    { qubits: [7, 8], row: 2, name: 'X_{2,1}X_{2,2}' }
  ];

  // Two-qubit Z-gauge operators (measuring pairs for Z-stabilizer syndrome)
  const Z_GAUGES_3x3 = [
    { qubits: [0, 3], col: 0, name: 'Z_{0,0}Z_{1,0}' },
    { qubits: [3, 6], col: 0, name: 'Z_{1,0}Z_{2,0}' },
    { qubits: [1, 4], col: 1, name: 'Z_{0,1}Z_{1,1}' },
    { qubits: [4, 7], col: 1, name: 'Z_{1,1}Z_{2,1}' },
    { qubits: [2, 5], col: 2, name: 'Z_{0,2}Z_{1,2}' },
    { qubits: [5, 8], col: 2, name: 'Z_{1,2}Z_{2,2}' }
  ];

  // Logical operators
  // Logical X: Acts on entire row (weight-3 string across lattice)
  const LOGICAL_X = [0, 1, 2]; // Top row

  // Logical Z: Acts on entire column (weight-3 string across lattice)
  const LOGICAL_Z = [0, 3, 6]; // Left column

  // Classical encoding for educational simulation
  // OpCodes.OrN(Logical, 0)⟩ encoded OpCodes.OrN(as, 000) 000 000⟩
  // OpCodes.OrN(Logical, 1)⟩ encoded OpCodes.OrN(as, 111) 000 000⟩ (logical X applied)
  const LOGICAL_ZERO_9 = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const LOGICAL_ONE_9  = [1, 1, 1, 0, 0, 0, 0, 0, 0];

  // ===== ALGORITHM IMPLEMENTATION =====

  class BaconShorCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Bacon-Shor Code";
      this.description = "Subsystem quantum error correction code combining Shor's 9-qubit code concepts with gauge freedom. [[9,1,3]] configuration encodes 1 logical qubit in 9 physical qubits arranged in 3×3 lattice with distance 3. Uses X-gauge and Z-gauge operators for error correction without full syndrome extraction, enabling simpler two-qubit measurements compared to stabilizer codes. Gauge subsystems provide fault-tolerant error correction without entangled ancillary states. Used in quantum computing research at IonQ, Rigetti.";
      this.inventor = "Dave Bacon, Peter Shor";
      this.year = 2006;
      this.category = CategoryType.ECC;
      this.subCategory = "Subsystem Quantum Code";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Algorithm capabilities
      this.SupportedBlockSizes = [{ minSize: 1, maxSize: 1, step: 1 }]; // 1 logical bit per block
      this.supportsErrorDetection = true;
      this.supportsErrorCorrection = true;
      this.errorCorrectionCapability = 1; // Can correct 1 error per 9-qubit block
      this.codeLength = 9; // 9 physical qubits (3×3 lattice)
      this.dataLength = 1; // 1 logical qubit
      this.minDistance = 3; // Minimum distance = 3
      this.isSubsystemCode = true; // Distinguished feature
      this.gaugeQubits = 4; // Number of gauge degrees of freedom

      // Documentation
      this.documentation = [
        new LinkItem("Error Correction Zoo - Bacon-Shor Code", "https://errorcorrectionzoo.org/c/bacon_shor"),
        new LinkItem("Bacon-Shor Code - Wikipedia", "https://en.wikipedia.org/wiki/Bacon%E2%80%93Shor_code"),
        new LinkItem("Original Paper - Bacon (2006)", "https://arxiv.org/abs/quant-ph/0506023"),
        new LinkItem("Subsystem Fault Tolerance (IBM)", "https://arxiv.org/abs/1708.02821"),
        new LinkItem("Comparing Shor and Steane Error Correction", "https://www.science.org/doi/10.1126/sciadv.adp2008"),
        new LinkItem("Quantum Error Correction Tutorial", "https://arxiv.org/abs/0905.2794")
      ];

      this.references = [
        new LinkItem("Bacon - Operator Quantum Error Correction", "https://arxiv.org/abs/quant-ph/0506023"),
        new LinkItem("Poulin - Unified Framework for Subsystem Codes", "https://arxiv.org/abs/quant-ph/0601066"),
        new LinkItem("Ahn et al. - Fault-Tolerant Bacon-Shor Code", "https://arxiv.org/abs/1708.02821"),
        new LinkItem("Dynamical Logical Qubits", "https://arxiv.org/abs/2403.03291"),
        new LinkItem("Improved Performance with Steane's Method", "https://arxiv.org/abs/2403.01659")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Single Error Correction Only",
          "[[9,1,3]] Bacon-Shor code can correct only 1 arbitrary qubit error. Multiple errors cause decoding failure. Larger lattices (e.g., 5×5 for distance 5) needed for higher error tolerance."
        ),
        new Vulnerability(
          "Gauge Qubit Overhead",
          "Encodes 1 logical qubit into 9 physical qubits with 4 gauge degrees of freedom (9 = 1 logical + 4 stabilizers + 4 gauge). High overhead compared to LDPC quantum codes."
        ),
        new Vulnerability(
          "Classical Simulation Approximation",
          "This implementation represents quantum states as classical bit arrays for educational purposes. Real quantum Bacon-Shor codes preserve superposition and require quantum hardware with proper syndrome measurement circuits."
        ),
        new Vulnerability(
          "Correlated Errors",
          "Gauge freedom simplifies syndrome extraction but can mask certain correlated error patterns. Fault-tolerant protocols required for practical quantum computing applications."
        )
      ];

      // Test vectors for [[9,1,3]] Bacon-Shor code
      // Based on Error Correction Zoo and theoretical construction
      // Using classical representation for educational demonstration
      this.tests = [
        // Encode OpCodes.OrN(logical, 0)⟩ to 9-qubit codeword
        new TestCase(
          [0], // Logical 0
          [0, 0, 0, 0, 0, 0, 0, 0, 0], // Encoded OpCodes.OrN(as, 000) 000 000⟩
          "Bacon-Shor [[9,1,3]] encode OpCodes.OrN(logical, 0)⟩",
          "https://errorcorrectionzoo.org/c/bacon_shor"
        ),
        // Encode OpCodes.OrN(logical, 1)⟩ to 9-qubit codeword
        new TestCase(
          [1], // Logical 1
          [1, 1, 1, 0, 0, 0, 0, 0, 0], // Encoded OpCodes.OrN(as, 111) 000 000⟩ (logical X on top row)
          "Bacon-Shor [[9,1,3]] encode OpCodes.OrN(logical, 1)⟩",
          "https://errorcorrectionzoo.org/c/bacon_shor"
        ),
        // Encode multiple logical qubits
        new TestCase(
          [0, 1], // Two logical bits
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0], // Two 9-qubit codewords
          "Encode two logical qubits in Bacon-Shor code",
          "https://errorcorrectionzoo.org/c/bacon_shor"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new BaconShorCodeInstance(this, isInverse);
    }
  }

  /**
 * BaconShorCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class BaconShorCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('BaconShorCodeInstance.Feed: Input must be byte array');
      }
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.inputBuffer.length === 0) {
        throw new Error('No data fed');
      }

      if (this.isInverse) {
        return this._decode();
      } else {
        return this._encode();
      }
    }

    // ===== ENCODING =====
    // Maps logical qubit to 9 physical qubits in 3×3 lattice

    _encode() {
      if (this.inputBuffer.length === 0) {
        throw new Error('Bacon-Shor code requires at least 1 bit of logical data');
      }

      const result = [];

      // Process each input bit as a logical qubit
      for (let i = 0; i < this.inputBuffer.length; ++i) {
        const logicalBit = this.inputBuffer[i]&1;

        // Encode using [[9,1,3]] Bacon-Shor code
        // OpCodes.OrN(Logical, 0)⟩ → [0,0,0,0,0,0,0,0,0]
        // OpCodes.OrN(Logical, 1)⟩ → [1,1,1,0,0,0,0,0,0] (logical X applied to top row)
        if (logicalBit === 0) {
          result.push(...LOGICAL_ZERO_9);
        } else {
          result.push(...LOGICAL_ONE_9);
        }
      }

      this.inputBuffer = [];
      return result;
    }

    // ===== DECODING WITH ERROR CORRECTION =====

    _decode() {
      if (this.inputBuffer.length === 0) {
        throw new Error('Bacon-Shor code requires encoded data');
      }

      if (this.inputBuffer.length % 9 !== 0) {
        throw new Error('Bacon-Shor code requires data in 9-qubit blocks');
      }

      const result = [];

      // Process 9-bit blocks (3×3 lattice)
      for (let i = 0; i < this.inputBuffer.length; i += 9) {
        // Extract 9-qubit codeword
        const codeword = this.inputBuffer.slice(i, i + 9);

        // Measure gauge operators to determine syndrome
        const xSyndrome = this._measureXGauges(codeword);
        const zSyndrome = this._measureZGauges(codeword);

        // Determine error location and type from syndrome
        const errorInfo = this._analyzeGaugeSyndrome(xSyndrome, zSyndrome);

        // Apply correction
        let corrected = [...codeword];
        if (errorInfo.position >= 0) {
          corrected = this._applyCorrection(corrected, errorInfo.position, errorInfo.type);
        }

        // Decode to logical bit using logical observable
        const logicalBit = this._decodeLogicalBit(corrected);

        result.push(logicalBit);
      }

      this.inputBuffer = [];
      return result;
    }

    // ===== GAUGE SYNDROME MEASUREMENT =====
    // Bacon-Shor uses two-qubit gauge measurements instead of full stabilizer measurements

    _measureXGauges(codeword) {
      // Measure X-gauge operators (6 two-qubit measurements)
      // Returns array of 6 gauge measurement outcomes (0 or 1)
      const gaugeOutcomes = [];

      for (let i = 0; i < X_GAUGES_3x3.length; ++i) {
        const gauge = X_GAUGES_3x3[i];
        // In classical simulation, gauge measurement is parity of two qubits
        // Real quantum: joint measurement of X⊗X operator
        const outcome = codeword[gauge.qubits[0]]^codeword[gauge.qubits[1]];
        gaugeOutcomes.push(outcome);
      }

      return gaugeOutcomes;
    }

    _measureZGauges(codeword) {
      // Measure Z-gauge operators (6 two-qubit measurements)
      // Returns array of 6 gauge measurement outcomes (0 or 1)
      const gaugeOutcomes = [];

      for (let i = 0; i < Z_GAUGES_3x3.length; ++i) {
        const gauge = Z_GAUGES_3x3[i];
        // In classical simulation, Z-gauge doesn't change computational basis
        // But we track parity for syndrome extraction
        const outcome = codeword[gauge.qubits[0]]^codeword[gauge.qubits[1]];
        gaugeOutcomes.push(outcome);
      }

      return gaugeOutcomes;
    }

    // ===== SYNDROME ANALYSIS =====
    // Determine error location and type from gauge measurements

    _analyzeGaugeSyndrome(xGauges, zGauges) {
      // Compute stabilizer syndromes from gauge outcomes
      // X-stabilizers (2 total): products of gauge pairs
      const xStab0 = xGauges[0]^xGauges[2]^xGauges[4]; // Columns 0-1
      const xStab1 = xGauges[1]^xGauges[3]^xGauges[5]; // Columns 1-2

      // Z-stabilizers (2 total): products of gauge pairs
      const zStab0 = zGauges[0]^zGauges[1]; // Rows 0-1
      const zStab1 = zGauges[2]^zGauges[3]; // Rows 1-2

      // Combine into 4-bit syndrome
      const syndrome = (zStab0)|(OpCodes.Shl32(zStab1, 1))|(OpCodes.Shl32(xStab0, 2))|(OpCodes.Shl32(xStab1, 3));

      // Decode syndrome to error location (simplified for 3×3 lattice)
      if (syndrome === 0) {
        return { position: -1, type: 0 }; // No error
      }

      // Simplified error correction: map syndrome to most likely error
      // Real implementation would use full syndrome lookup table
      return this._syndromeToError(syndrome, zGauges, xGauges);
    }

    _syndromeToError(syndrome, zGauges, xGauges) {
      // Simplified syndrome decoding for educational purposes
      // In practice, gauge freedom allows multiple correction strategies

      // Determine which row/column has error based on gauge outcomes
      let errorRow = -1;
      let errorCol = -1;

      // Check Z-gauges to find error row (bit-flip location)
      for (let i = 0; i < 3; ++i) {
        const gauge1 = zGauges[i * 2];
        const gauge2 = zGauges[i * 2 + 1];
        if (gauge1 !== 0 || gauge2 !== 0) {
          errorRow = i;
          break;
        }
      }

      // Check X-gauges to find error column (phase-flip location)
      for (let i = 0; i < 3; ++i) {
        const gauge1 = xGauges[i * 2];
        const gauge2 = xGauges[i * 2 + 1];
        if (gauge1 !== 0 || gauge2 !== 0) {
          errorCol = i;
          break;
        }
      }

      // Determine error position in 3×3 lattice
      if (errorRow >= 0 && errorCol < 0) {
        // Bit-flip error (Z error detected)
        errorCol = 1; // Default to middle column
        return { position: errorRow * 3 + errorCol, type: 1 }; // X error
      } else if (errorRow < 0 && errorCol >= 0) {
        // Phase-flip error (X error detected)
        errorRow = 1; // Default to middle row
        return { position: errorRow * 3 + errorCol, type: 2 }; // Z error
      } else if (errorRow >= 0 && errorCol >= 0) {
        // Both bit-flip and phase-flip
        return { position: errorRow * 3 + errorCol, type: 3 }; // Y error
      }

      return { position: -1, type: 0 }; // Undetermined
    }

    // ===== ERROR CORRECTION =====

    _applyCorrection(codeword, position, errorType) {
      const corrected = [...codeword];

      switch (errorType) {
        case 1: // X error (bit-flip)
          corrected[position] ^= 1;
          break;
        case 2: // Z error (phase-flip)
          // Phase error doesn't affect classical bits
          // In real quantum implementation, would apply Z correction
          break;
        case 3: // Y error (both)
          corrected[position] ^= 1;
          // Also apply phase correction (not visible classically)
          break;
      }

      return corrected;
    }

    // ===== LOGICAL DECODING =====

    _decodeLogicalBit(codeword) {
      // Measure logical observable (top row for logical X basis)
      // In classical simulation: majority vote on representative qubits
      const topRow = codeword.slice(0, 3);
      const ones = topRow.filter(b => b === 1).length;

      // Majority vote: if at least 2 of 3 qubits in top row are 1, decode OpCodes.OrN(as, 1)⟩
      return ones >= 2 ? 1 : 0;
    }

    // ===== ERROR DETECTION =====

    DetectError(data) {
      if (!data || data.length < 9) return true;

      // Measure gauge operators on first codeword
      const codeword = data.slice(0, 9);
      const xGauges = this._measureXGauges(codeword);
      const zGauges = this._measureZGauges(codeword);

      // Check if any gauge indicates error
      const hasXError = xGauges.some(g => g !== 0);
      const hasZError = zGauges.some(g => g !== 0);

      return hasXError || hasZError;
    }

    // ===== UTILITY METHODS =====

    getCodeParameters() {
      return {
        n: 9,           // Physical qubits (3×3 lattice)
        k: 1,           // Logical qubits
        d: 3,           // Minimum distance
        t: 1,           // Error correction capability
        type: 'Subsystem',
        gauges: 4,      // Gauge degrees of freedom
        stabilizers: 4, // Stabilizer generators (2 X-type, 2 Z-type)
        lattice: '3×3'
      };
    }

    getStabilizers() {
      return {
        xStabilizers: X_STABILIZERS_3x3.map(s => ({
          name: s.name,
          qubits: s.qubits,
          description: s.description
        })),
        zStabilizers: Z_STABILIZERS_3x3.map(s => ({
          name: s.name,
          qubits: s.qubits,
          description: s.description
        }))
      };
    }

    getGaugeOperators() {
      return {
        xGauges: X_GAUGES_3x3.map(g => ({
          name: g.name,
          qubits: g.qubits,
          row: g.row
        })),
        zGauges: Z_GAUGES_3x3.map(g => ({
          name: g.name,
          qubits: g.qubits,
          col: g.col
        }))
      };
    }

    getLogicalOperators() {
      return {
        logicalX: {
          qubits: LOGICAL_X,
          description: 'Logical X acts on top row (qubits 0,1,2)'
        },
        logicalZ: {
          qubits: LOGICAL_Z,
          description: 'Logical Z acts on left column (qubits 0,3,6)'
        }
      };
    }
  }

  // Register the algorithm
  const algorithmInstance = new BaconShorCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return algorithmInstance;

}));
