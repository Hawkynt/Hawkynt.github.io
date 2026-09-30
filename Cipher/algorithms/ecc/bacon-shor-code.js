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
          ErrorCorrectionAlgorithm, IErrorCorrectionInstance, TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ===== BACON-SHOR [[9,1,3]] CODE CONSTANTS =====

  // The Bacon-Shor code uses a 3×3 lattice of qubits
  // Qubits are arranged as:
  //   0 1 2
  //   3 4 5
  //   6 7 8
  //
  // Stabilizer generators are products of two-qubit gauge operators

  /**
   * A stabilizer generator: the qubits it acts on
   * @class
   */
  class Stabilizer {
    /**
     * @param {int32[]} qubits - Qubit indices
     * @param {string} name - Operator name
     * @param {string} description - Human-readable description
     */
    constructor(qubits, name, description) {
      /** @type {int32[]} */
      this.qubits = qubits;
      /** @type {string} */
      this.name = name;
      /** @type {string} */
      this.description = description;
    }
  }

  /**
   * A stabilizer as reported by getStabilizers()
   * @class
   */
  class StabilizerView {
    /**
     * @param {string} name - Operator name
     * @param {int32[]} qubits - Qubit indices
     * @param {string} description - Human-readable description
     */
    constructor(name, qubits, description) {
      /** @type {string} */
      this.name = name;
      /** @type {int32[]} */
      this.qubits = qubits;
      /** @type {string} */
      this.description = description;
    }
  }

  /**
   * A two-qubit X-gauge operator within one lattice row
   * @class
   */
  class XGauge {
    /**
     * @param {int32} qubitA - First qubit index
     * @param {int32} qubitB - Second qubit index
     * @param {int32} row - Lattice row
     * @param {string} name - Operator name
     */
    constructor(qubitA, qubitB, row, name) {
      /** @type {int32[]} */
      this.qubits = [qubitA, qubitB];
      /** @type {int32} */
      this.row = row;
      /** @type {string} */
      this.name = name;
    }
  }

  /**
   * A two-qubit Z-gauge operator within one lattice column
   * @class
   */
  class ZGauge {
    /**
     * @param {int32} qubitA - First qubit index
     * @param {int32} qubitB - Second qubit index
     * @param {int32} col - Lattice column
     * @param {string} name - Operator name
     */
    constructor(qubitA, qubitB, col, name) {
      /** @type {int32[]} */
      this.qubits = [qubitA, qubitB];
      /** @type {int32} */
      this.col = col;
      /** @type {string} */
      this.name = name;
    }
  }

  // X-type stabilizers (detect phase errors): Act on adjacent columns
  // X_{i,*}X_{i+1,*} means X on all qubits in column i and column i+1
  /** @type {int32[]} */
  const X_COLUMNS_01 = [0, 1, 3, 4, 6, 7];
  /** @type {int32[]} */
  const X_COLUMNS_12 = [1, 2, 4, 5, 7, 8];
  /** @type {Stabilizer[]} */
  const X_STABILIZERS_3x3 = [
    new Stabilizer(X_COLUMNS_01, 'X_col0 X_col1', 'X on columns 0,1'),
    new Stabilizer(X_COLUMNS_12, 'X_col1 X_col2', 'X on columns 1,2')
  ];

  // Z-type stabilizers (detect bit-flip errors): Act on adjacent rows
  // Z_{*,j}Z_{*,j+1} means Z on all qubits in row j and row j+1
  /** @type {int32[]} */
  const Z_ROWS_01 = [0, 1, 2, 3, 4, 5];
  /** @type {int32[]} */
  const Z_ROWS_12 = [3, 4, 5, 6, 7, 8];
  /** @type {Stabilizer[]} */
  const Z_STABILIZERS_3x3 = [
    new Stabilizer(Z_ROWS_01, 'Z_row0 Z_row1', 'Z on rows 0,1'),
    new Stabilizer(Z_ROWS_12, 'Z_row1 Z_row2', 'Z on rows 1,2')
  ];

  // Two-qubit X-gauge operators (measuring pairs for X-stabilizer syndrome)
  /** @type {XGauge[]} */
  const X_GAUGES_3x3 = [
    new XGauge(0, 1, 0, 'X_{0,0}X_{0,1}'),
    new XGauge(1, 2, 0, 'X_{0,1}X_{0,2}'),
    new XGauge(3, 4, 1, 'X_{1,0}X_{1,1}'),
    new XGauge(4, 5, 1, 'X_{1,1}X_{1,2}'),
    new XGauge(6, 7, 2, 'X_{2,0}X_{2,1}'),
    new XGauge(7, 8, 2, 'X_{2,1}X_{2,2}')
  ];

  // Two-qubit Z-gauge operators (measuring pairs for Z-stabilizer syndrome)
  /** @type {ZGauge[]} */
  const Z_GAUGES_3x3 = [
    new ZGauge(0, 3, 0, 'Z_{0,0}Z_{1,0}'),
    new ZGauge(3, 6, 0, 'Z_{1,0}Z_{2,0}'),
    new ZGauge(1, 4, 1, 'Z_{0,1}Z_{1,1}'),
    new ZGauge(4, 7, 1, 'Z_{1,1}Z_{2,1}'),
    new ZGauge(2, 5, 2, 'Z_{0,2}Z_{1,2}'),
    new ZGauge(5, 8, 2, 'Z_{1,2}Z_{2,2}')
  ];

  // Logical operators
  // Logical X: Acts on entire row (weight-3 string across lattice)
  /** @type {int32[]} */
  const LOGICAL_X = [0, 1, 2]; // Top row

  // Logical Z: Acts on entire column (weight-3 string across lattice)
  /** @type {int32[]} */
  const LOGICAL_Z = [0, 3, 6]; // Left column

  // Classical encoding for educational simulation
  // OpCodes.Or32(Logical, 0)⟩ encoded OpCodes.Or32(as, 000) 000 000⟩
  // OpCodes.Or32(Logical, 1)⟩ encoded OpCodes.Or32(as, 111) 000 000⟩ (logical X applied)
  /** @type {uint8[]} */
  const LOGICAL_ZERO_9 = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  /** @type {uint8[]} */
  const LOGICAL_ONE_9  = [1, 1, 1, 0, 0, 0, 0, 0, 0];

  /**
   * Error location and kind found from a syndrome
   * @class
   */
  class ErrorInfo {
    /**
     * @param {int32} position - Qubit index, or -1 for none
     * @param {int32} type - 0 none, 1 X, 2 Z, 3 Y
     */
    constructor(position, type) {
      /** @type {int32} */
      this.position = position;
      /** @type {int32} */
      this.type = type;
    }
  }

  /**
   * Code parameters as reported by getCodeParameters()
   * @class
   */
  class CodeParameters {
    constructor() {
      /** @type {int32} */
      this.n = 9;           // Physical qubits (3×3 lattice)
      /** @type {int32} */
      this.k = 1;           // Logical qubits
      /** @type {int32} */
      this.d = 3;           // Minimum distance
      /** @type {int32} */
      this.t = 1;           // Error correction capability
      /** @type {string} */
      this.type = 'Subsystem';
      /** @type {int32} */
      this.gauges = 4;      // Gauge degrees of freedom
      /** @type {int32} */
      this.stabilizers = 4; // Stabilizer generators (2 X-type, 2 Z-type)
      /** @type {string} */
      this.lattice = '3×3';
    }
  }

  /**
   * Stabilizers as reported by getStabilizers()
   * @class
   */
  class StabilizerSet {
    /**
     * @param {StabilizerView[]} xStabilizers - X-type stabilizers
     * @param {StabilizerView[]} zStabilizers - Z-type stabilizers
     */
    constructor(xStabilizers, zStabilizers) {
      /** @type {StabilizerView[]} */
      this.xStabilizers = xStabilizers;
      /** @type {StabilizerView[]} */
      this.zStabilizers = zStabilizers;
    }
  }

  /**
   * Gauge operators as reported by getGaugeOperators()
   * @class
   */
  class GaugeSet {
    /**
     * @param {XGaugeView[]} xGauges - X-type gauges
     * @param {ZGaugeView[]} zGauges - Z-type gauges
     */
    constructor(xGauges, zGauges) {
      /** @type {XGaugeView[]} */
      this.xGauges = xGauges;
      /** @type {ZGaugeView[]} */
      this.zGauges = zGauges;
    }
  }

  /**
   * An X-gauge as reported by getGaugeOperators()
   * @class
   */
  class XGaugeView {
    /**
     * @param {string} name - Operator name
     * @param {int32[]} qubits - Qubit indices
     * @param {int32} row - Lattice row
     */
    constructor(name, qubits, row) {
      /** @type {string} */
      this.name = name;
      /** @type {int32[]} */
      this.qubits = qubits;
      /** @type {int32} */
      this.row = row;
    }
  }

  /**
   * A Z-gauge as reported by getGaugeOperators()
   * @class
   */
  class ZGaugeView {
    /**
     * @param {string} name - Operator name
     * @param {int32[]} qubits - Qubit indices
     * @param {int32} col - Lattice column
     */
    constructor(name, qubits, col) {
      /** @type {string} */
      this.name = name;
      /** @type {int32[]} */
      this.qubits = qubits;
      /** @type {int32} */
      this.col = col;
    }
  }

  /**
   * A logical operator as reported by getLogicalOperators()
   * @class
   */
  class LogicalOperator {
    /**
     * @param {int32[]} qubits - Qubit indices
     * @param {string} description - Human-readable description
     */
    constructor(qubits, description) {
      /** @type {int32[]} */
      this.qubits = qubits;
      /** @type {string} */
      this.description = description;
    }
  }

  /**
   * Logical operators as reported by getLogicalOperators()
   * @class
   */
  class LogicalOperatorSet {
    /**
     * @param {LogicalOperator} logicalX - Logical X
     * @param {LogicalOperator} logicalZ - Logical Z
     */
    constructor(logicalX, logicalZ) {
      /** @type {LogicalOperator} */
      this.logicalX = logicalX;
      /** @type {LogicalOperator} */
      this.logicalZ = logicalZ;
    }
  }

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
      this.SupportedBlockSizes = [new KeySize(1, 1, 1)]; // 1 logical bit per block
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
        // Encode OpCodes.Or32(logical, 0)⟩ to 9-qubit codeword
        new TestCase(
          [0], // Logical 0
          [0, 0, 0, 0, 0, 0, 0, 0, 0], // Encoded OpCodes.Or32(as, 000) 000 000⟩
          "Bacon-Shor [[9,1,3]] encode OpCodes.Or32(logical, 0)⟩",
          "https://errorcorrectionzoo.org/c/bacon_shor"
        ),
        // Encode OpCodes.Or32(logical, 1)⟩ to 9-qubit codeword
        new TestCase(
          [1], // Logical 1
          [1, 1, 1, 0, 0, 0, 0, 0, 0], // Encoded OpCodes.Or32(as, 111) 000 000⟩ (logical X on top row)
          "Bacon-Shor [[9,1,3]] encode OpCodes.Or32(logical, 1)⟩",
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
   * @returns {BaconShorCodeInstance} New cipher instance
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
   * @param {BaconShorCodeAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
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
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
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

    /**
     * Encode each buffered bit into a 9-qubit block
     * @returns {uint8[]} Encoded bits
     */
    _encode() {
      if (this.inputBuffer.length === 0) {
        throw new Error('Bacon-Shor code requires at least 1 bit of logical data');
      }

      /** @type {uint8[]} */
      const result = [];

      // Process each input bit as a logical qubit
      for (let i = 0; i < this.inputBuffer.length; ++i) {
        /** @type {uint8} */
        const logicalBit = OpCodes.And32(this.inputBuffer[i], 1);

        // Encode using [[9,1,3]] Bacon-Shor code
        // OpCodes.Or32(Logical, 0)⟩ → [0,0,0,0,0,0,0,0,0]
        // OpCodes.Or32(Logical, 1)⟩ → [1,1,1,0,0,0,0,0,0] (logical X applied to top row)
        if (logicalBit === 0) {
          for (let _i = 0; _i < LOGICAL_ZERO_9.length; _i++) result.push(LOGICAL_ZERO_9[_i]);
        } else {
          for (let _i = 0; _i < LOGICAL_ONE_9.length; _i++) result.push(LOGICAL_ONE_9[_i]);
        }
      }

      this.inputBuffer = [];
      return result;
    }

    // ===== DECODING WITH ERROR CORRECTION =====

    /**
     * Decode buffered 9-qubit blocks with correction
     * @returns {uint8[]} Decoded bits
     */
    _decode() {
      if (this.inputBuffer.length === 0) {
        throw new Error('Bacon-Shor code requires encoded data');
      }

      if (this.inputBuffer.length % 9 !== 0) {
        throw new Error('Bacon-Shor code requires data in 9-qubit blocks');
      }

      /** @type {uint8[]} */
      const result = [];

      // Process 9-bit blocks (3×3 lattice)
      for (let i = 0; i < this.inputBuffer.length; i += 9) {
        // Extract 9-qubit codeword
        /** @type {uint8[]} */
        const codeword = this.inputBuffer.slice(i, i + 9);

        // Measure gauge operators to determine syndrome
        /** @type {uint8[]} */
        const xSyndrome = this._measureXGauges(codeword);
        /** @type {uint8[]} */
        const zSyndrome = this._measureZGauges(codeword);

        // Determine error location and type from syndrome
        /** @type {ErrorInfo} */
        const errorInfo = this._analyzeGaugeSyndrome(xSyndrome, zSyndrome);

        // Apply correction
        /** @type {uint8[]} */
        let corrected = codeword.slice();
        if (errorInfo.position >= 0) {
          corrected = this._applyCorrection(corrected, errorInfo.position, errorInfo.type);
        }

        // Decode to logical bit using logical observable
        /** @type {uint8} */
        const logicalBit = this._decodeLogicalBit(corrected);

        result.push(logicalBit);
      }

      this.inputBuffer = [];
      return result;
    }

    // ===== GAUGE SYNDROME MEASUREMENT =====
    // Bacon-Shor uses two-qubit gauge measurements instead of full stabilizer measurements

    /**
     * Measure the X-gauge operators
     * @param {uint8[]} codeword - 9-qubit block
     * @returns {uint8[]} Six gauge outcomes
     */
    _measureXGauges(codeword) {
      // Measure X-gauge operators (6 two-qubit measurements)
      // Returns array of 6 gauge measurement outcomes (0 or 1)
      /** @type {uint8[]} */
      const gaugeOutcomes = [];

      for (let i = 0; i < X_GAUGES_3x3.length; ++i) {
        /** @type {XGauge} */
        const gauge = X_GAUGES_3x3[i];
        // In classical simulation, gauge measurement is parity of two qubits
        // Real quantum: joint measurement of X⊗X operator
        /** @type {int32} */
        const outcome = OpCodes.ToInt(OpCodes.Xor32(codeword[gauge.qubits[0]], codeword[gauge.qubits[1]]));
        gaugeOutcomes.push(outcome);
      }

      return gaugeOutcomes;
    }

    /**
     * Measure the Z-gauge operators
     * @param {uint8[]} codeword - 9-qubit block
     * @returns {uint8[]} Six gauge outcomes
     */
    _measureZGauges(codeword) {
      // Measure Z-gauge operators (6 two-qubit measurements)
      // Returns array of 6 gauge measurement outcomes (0 or 1)
      /** @type {uint8[]} */
      const gaugeOutcomes = [];

      for (let i = 0; i < Z_GAUGES_3x3.length; ++i) {
        /** @type {ZGauge} */
        const gauge = Z_GAUGES_3x3[i];
        // In classical simulation, Z-gauge doesn't change computational basis
        // But we track parity for syndrome extraction
        /** @type {int32} */
        const outcome = OpCodes.ToInt(OpCodes.Xor32(codeword[gauge.qubits[0]], codeword[gauge.qubits[1]]));
        gaugeOutcomes.push(outcome);
      }

      return gaugeOutcomes;
    }

    // ===== SYNDROME ANALYSIS =====
    // Determine error location and type from gauge measurements

    /**
     * Turn gauge outcomes into an error location
     * @param {uint8[]} xGauges - X-gauge outcomes
     * @param {uint8[]} zGauges - Z-gauge outcomes
     * @returns {ErrorInfo} Error location and kind
     */
    _analyzeGaugeSyndrome(xGauges, zGauges) {
      // Compute stabilizer syndromes from gauge outcomes
      // X-stabilizers (2 total): products of gauge pairs
      /** @type {int32} */
      const xStab0 = OpCodes.ToInt(OpCodes.Xor32(OpCodes.Xor32(xGauges[0], xGauges[2]), xGauges[4])); // Columns 0-1
      /** @type {int32} */
      const xStab1 = OpCodes.ToInt(OpCodes.Xor32(OpCodes.Xor32(xGauges[1], xGauges[3]), xGauges[5])); // Columns 1-2

      // Z-stabilizers (2 total): products of gauge pairs
      /** @type {int32} */
      const zStab0 = OpCodes.ToInt(OpCodes.Xor32(zGauges[0], zGauges[1])); // Rows 0-1
      /** @type {int32} */
      const zStab1 = OpCodes.ToInt(OpCodes.Xor32(zGauges[2], zGauges[3])); // Rows 1-2

      // Combine into 4-bit syndrome
      /** @type {int32} */
      const syndrome = OpCodes.ToInt(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(zStab0, OpCodes.Shl32(zStab1, 1)), OpCodes.Shl32(xStab0, 2)), OpCodes.Shl32(xStab1, 3)));

      // Decode syndrome to error location (simplified for 3×3 lattice)
      if (syndrome === 0) {
        return new ErrorInfo(-1, 0); // No error
      }

      // Simplified error correction: map syndrome to most likely error
      // Real implementation would use full syndrome lookup table
      return this._syndromeToError(syndrome, zGauges, xGauges);
    }

    /**
     * Pick the most likely error for a non-zero syndrome
     * @param {int32} syndrome - 4-bit stabilizer syndrome
     * @param {uint8[]} zGauges - Z-gauge outcomes
     * @param {uint8[]} xGauges - X-gauge outcomes
     * @returns {ErrorInfo} Error location and kind
     */
    _syndromeToError(syndrome, zGauges, xGauges) {
      // Simplified syndrome decoding for educational purposes
      // In practice, gauge freedom allows multiple correction strategies

      // Determine which row/column has error based on gauge outcomes
      let errorRow = -1;
      let errorCol = -1;

      // Check Z-gauges to find error row (bit-flip location)
      for (let i = 0; i < 3; ++i) {
        /** @type {uint8} */
        const gauge1 = zGauges[i * 2];
        /** @type {uint8} */
        const gauge2 = zGauges[i * 2 + 1];
        if (gauge1 !== 0 || gauge2 !== 0) {
          errorRow = i;
          break;
        }
      }

      // Check X-gauges to find error column (phase-flip location)
      for (let i = 0; i < 3; ++i) {
        /** @type {uint8} */
        const gauge1 = xGauges[i * 2];
        /** @type {uint8} */
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
        return new ErrorInfo(errorRow * 3 + errorCol, 1); // X error
      } else if (errorRow < 0 && errorCol >= 0) {
        // Phase-flip error (X error detected)
        errorRow = 1; // Default to middle row
        return new ErrorInfo(errorRow * 3 + errorCol, 2); // Z error
      } else if (errorRow >= 0 && errorCol >= 0) {
        // Both bit-flip and phase-flip
        return new ErrorInfo(errorRow * 3 + errorCol, 3); // Y error
      }

      return new ErrorInfo(-1, 0); // Undetermined
    }

    // ===== ERROR CORRECTION =====

    /**
     * Flip the affected qubit
     * @param {uint8[]} codeword - 9-qubit block
     * @param {int32} position - Qubit index
     * @param {int32} errorType - 0 none, 1 X, 2 Z, 3 Y
     * @returns {uint8[]} Corrected block
     */
    _applyCorrection(codeword, position, errorType) {
      /** @type {uint8[]} */
      const corrected = codeword.slice();

      switch (errorType) {
        case 1: // X error (bit-flip)
          corrected[position] = OpCodes.Xor32(corrected[position], 1);
          break;
        case 2: // Z error (phase-flip)
          // Phase error doesn't affect classical bits
          // In real quantum implementation, would apply Z correction
          break;
        case 3: // Y error (both)
          corrected[position] = OpCodes.Xor32(corrected[position], 1);
          // Also apply phase correction (not visible classically)
          break;
      }

      return corrected;
    }

    // ===== LOGICAL DECODING =====

    /**
     * Majority vote over the top row
     * @param {uint8[]} codeword - Corrected 9-qubit block
     * @returns {uint8} Logical bit
     */
    _decodeLogicalBit(codeword) {
      // Measure logical observable (top row for logical X basis)
      // In classical simulation: majority vote on representative qubits
      /** @type {uint8[]} */
      const topRow = codeword.slice(0, 3);
      /** @type {int32} */
      let ones = 0;
      for (let i = 0; i < topRow.length; ++i) {
        if (topRow[i] === 1) ++ones;
      }

      // Majority vote: if at least 2 of 3 qubits in top row are 1, decode OpCodes.Or32(as, 1)⟩
      return ones >= 2 ? 1 : 0;
    }

    // ===== ERROR DETECTION =====

    /**
     * @param {uint8[]} data - Received codeword symbols
     * @returns {boolean} True if errors detected
     */
    DetectError(data) {
      if (!data || data.length < 9) return true;

      // Measure gauge operators on first codeword
      /** @type {uint8[]} */
      const codeword = data.slice(0, 9);
      /** @type {uint8[]} */
      const xGauges = this._measureXGauges(codeword);
      /** @type {uint8[]} */
      const zGauges = this._measureZGauges(codeword);

      // Check if any gauge indicates error
      /** @type {boolean} */
      let hasXError = false;
      for (let i = 0; i < xGauges.length; ++i) {
        if (xGauges[i] !== 0) { hasXError = true; break; }
      }
      /** @type {boolean} */
      let hasZError = false;
      for (let i = 0; i < zGauges.length; ++i) {
        if (zGauges[i] !== 0) { hasZError = true; break; }
      }

      return hasXError || hasZError;
    }

    // ===== UTILITY METHODS =====

    /**
     * @returns {CodeParameters} Code parameters
     */
    getCodeParameters() {
      return new CodeParameters();
    }

    /**
     * @returns {StabilizerSet} Stabilizer generators
     */
    getStabilizers() {
      /** @type {StabilizerView[]} */
      const xStabilizers = [];
      for (let i = 0; i < X_STABILIZERS_3x3.length; ++i) {
        /** @type {Stabilizer} */
        const s = X_STABILIZERS_3x3[i];
        xStabilizers.push(new StabilizerView(s.name, s.qubits, s.description));
      }
      /** @type {StabilizerView[]} */
      const zStabilizers = [];
      for (let i = 0; i < Z_STABILIZERS_3x3.length; ++i) {
        /** @type {Stabilizer} */
        const s = Z_STABILIZERS_3x3[i];
        zStabilizers.push(new StabilizerView(s.name, s.qubits, s.description));
      }
      return new StabilizerSet(xStabilizers, zStabilizers);
    }

    /**
     * @returns {GaugeSet} Gauge operators
     */
    getGaugeOperators() {
      /** @type {XGaugeView[]} */
      const xGauges = [];
      for (let i = 0; i < X_GAUGES_3x3.length; ++i) {
        /** @type {XGauge} */
        const g = X_GAUGES_3x3[i];
        xGauges.push(new XGaugeView(g.name, g.qubits, g.row));
      }
      /** @type {ZGaugeView[]} */
      const zGauges = [];
      for (let i = 0; i < Z_GAUGES_3x3.length; ++i) {
        /** @type {ZGauge} */
        const g = Z_GAUGES_3x3[i];
        zGauges.push(new ZGaugeView(g.name, g.qubits, g.col));
      }
      return new GaugeSet(xGauges, zGauges);
    }

    /**
     * @returns {LogicalOperatorSet} Logical operators
     */
    getLogicalOperators() {
      return new LogicalOperatorSet(
        new LogicalOperator(LOGICAL_X, 'Logical X acts on top row (qubits 0,1,2)'),
        new LogicalOperator(LOGICAL_Z, 'Logical Z acts on left column (qubits 0,3,6)'));
    }
  }

  // Register the algorithm
  const algorithmInstance = new BaconShorCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return algorithmInstance;

}));
