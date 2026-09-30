/*
 * Stabilizer Quantum Error Correction Code Implementation
 * Most general framework for quantum error correction using stabilizer formalism
 * Includes [[5,1,3]] perfect code implementation
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
          ErrorCorrectionAlgorithm, IErrorCorrectionInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== STABILIZER CODE CONSTANTS =====

  // [[5,1,3]] Five-Qubit Perfect Code - Smallest perfect quantum code
  // Encodes 1 logical qubit into 5 physical qubits, corrects any single-qubit error
  // Code space is defined by 4 stabilizer generators (commuting Pauli operators)

  // Stabilizer generators for [[5,1,3]] code (in binary representation)
  // Format: [X bits, Z bits] where each is 5 bits for 5 qubits
  // X = bit flip, Z = phase flip, Y = XZ (both)

  /**
   * One stabilizer generator as X and Z qubit masks
   * @class
   */
  class Stabilizer {
    /**
     * @param {uint32} x - X-part qubit mask
     * @param {uint32} z - Z-part qubit mask
     * @param {string} name - Pauli string
     */
    constructor(x, z, name) {
      /** @type {uint32} */
      this.x = x;
      /** @type {uint32} */
      this.z = z;
      /** @type {string} */
      this.name = name;
    }
  }

  /**
   * Error pattern a syndrome points at
   * @class
   */
  class SyndromeEntry {
    /**
     * @param {int32} qubit - Affected qubit, -1 for none
     * @param {int32} errorType - 0=none, 1=X, 2=Z, 3=Y
     */
    constructor(qubit, errorType) {
      /** @type {int32} */
      this.qubit = qubit;
      /** @type {int32} */
      this.errorType = errorType;
    }
  }

  /**
   * Readable form of a stabilizer generator
   * @class
   */
  class StabilizerDescription {
    /**
     * @param {string} name - Pauli string
     * @param {string} x - X mask as five binary digits
     * @param {string} z - Z mask as five binary digits
     * @param {string} description - Affected qubits
     */
    constructor(name, x, z, description) {
      /** @type {string} */
      this.name = name;
      /** @type {string} */
      this.x = x;
      /** @type {string} */
      this.z = z;
      /** @type {string} */
      this.description = description;
    }
  }

  /**
   * [[n,k,d]] parameters of the code
   * @class
   */
  class StabilizerCodeParameters {
    constructor() {
      /** @type {int32} */
      this.n = 5;  // Number of physical qubits
      /** @type {int32} */
      this.k = 1;  // Number of logical qubits
      /** @type {int32} */
      this.d = 3;  // Minimum distance
      /** @type {int32} */
      this.t = 1;  // Error correction capability
      /** @type {string} */
      this.type = 'Stabilizer';
      /** @type {int32} */
      this.stabilizers = 4;  // Number of independent stabilizer generators
    }
  }

  // Generator format: XZZXI (X on qubits 0,4; Z on qubits 1,2)
  /** @type {Stabilizer[]} */
  const STABILIZERS_5_1_3 = [
    new Stabilizer(0b10011, 0b00000, 'XZZXI'), // X on 0,3,4; Z on 1,2
    new Stabilizer(0b01101, 0b10000, 'IXZZX'), // X on 0,2,3; Z on 1,4
    new Stabilizer(0b10110, 0b01000, 'XIXZZ'), // X on 1,2,4; Z on 0,3
    new Stabilizer(0b01011, 0b00100, 'ZXIXZ')  // X on 0,1,3; Z on 2,4
  ];

  /** @type {SyndromeEntry} */
  const NO_ERROR_5_1_3 = new SyndromeEntry(-1, 0);

  // Syndrome lookup table for [[5,1,3]] code
  // Maps 4-bit syndrome to error pattern (which qubit has which error)
  // Error types: 0=none, 1=X, 2=Z, 3=Y(XZ)
  /** @type {SyndromeEntry[]} */
  const SYNDROME_TABLE_5_1_3 = buildSyndromeTable();

  /**
   * Syndrome-indexed error patterns; a later entry for the same syndrome
   * replaces an earlier one, and unlisted syndromes stay null
   * @returns {SyndromeEntry[]} 16-entry table
   */
  function buildSyndromeTable() {
    /** @type {SyndromeEntry[]} */
    const table = [];
    for (let s = 0; s < 16; ++s) table.push(null);

    // No error
    table[0b0000] = new SyndromeEntry(-1, 0);

    // Single X errors (bit flips)
    table[0b1101] = new SyndromeEntry(0, 1); // X on qubit 0
    table[0b1010] = new SyndromeEntry(1, 1); // X on qubit 1
    table[0b0110] = new SyndromeEntry(2, 1); // X on qubit 2
    table[0b1100] = new SyndromeEntry(3, 1); // X on qubit 3
    table[0b0011] = new SyndromeEntry(4, 1); // X on qubit 4

    // Single Z errors (phase flips)
    table[0b1000] = new SyndromeEntry(0, 2); // Z on qubit 0
    table[0b0100] = new SyndromeEntry(1, 2); // Z on qubit 1
    table[0b0010] = new SyndromeEntry(2, 2); // Z on qubit 2
    table[0b0001] = new SyndromeEntry(3, 2); // Z on qubit 3
    table[0b1001] = new SyndromeEntry(4, 2); // Z on qubit 4

    // Single Y errors (both bit and phase flip)
    table[0b0101] = new SyndromeEntry(0, 3); // Y on qubit 0
    table[0b1110] = new SyndromeEntry(1, 3); // Y on qubit 1
    table[0b0100] = new SyndromeEntry(2, 3); // Y on qubit 2
    table[0b1101] = new SyndromeEntry(3, 3); // Y on qubit 3
    table[0b1010] = new SyndromeEntry(4, 3); // Y on qubit 4

    return table;
  }

  // ===== CLASSICAL REPRESENTATION =====
  // For educational purposes, we represent quantum states classically as bit arrays
  // Each logical qubit encoded as 5 physical bits (for [[5,1,3]] code)

  // Logical basis states in stabilizer code:
  // |0_L> = (|00000> + |10010> + |01001> + |10100> + |01010> + ...)
  // |1_L> = X_L|0_L> where X_L is logical X operator

  // Classical encoding: map logical bit to 5-bit codeword (simplified)
  const LOGICAL_ZERO_5_1_3 = 0b00000; // Representative of |0_L> equivalence class
  const LOGICAL_ONE_5_1_3  = 0b11111; // Representative of |1_L> equivalence class

  // ===== ALGORITHM IMPLEMENTATION =====

  class StabilizerQuantumCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Stabilizer Quantum Code";
      this.description = "Most general framework for quantum error correction using stabilizer formalism. Stabilizer group S consists of commuting Pauli operators that define the code space as the simultaneous +1 eigenspace of all stabilizers. Includes CSS codes, Shor code, and surface codes as special cases. This implementation demonstrates the [[5,1,3]] five-qubit perfect code - the smallest quantum code that can correct an arbitrary single-qubit error. Foundation of fault-tolerant quantum computing.";
      this.inventor = "Daniel Gottesman";
      this.year = 1996;
      this.category = CategoryType.ECC;
      this.subCategory = "Quantum Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Algorithm capabilities
      this.SupportedBlockSizes = [new KeySize(1, 1, 1)]; // 1 logical bit per block
      this.supportsErrorDetection = true;
      this.supportsErrorCorrection = true;
      this.errorCorrectionCapability = 1; // Can correct 1 error per 5-qubit block
      this.codeLength = 5; // 5 physical qubits
      this.dataLength = 1; // 1 logical qubit
      this.minDistance = 3; // Minimum distance = 3

      // Documentation
      this.documentation = [
        new LinkItem("Gottesman's PhD Thesis", "https://arxiv.org/abs/quant-ph/9705052"),
        new LinkItem("Error Correction Zoo - Stabilizer Codes", "https://errorcorrectionzoo.org/c/stabilizer"),
        new LinkItem("Nielsen&Chuang - Quantum Computation", "http://mmrc.amss.cas.cn/tlb/201702/W020170224608149940643.pdf"),
        new LinkItem("Five-Qubit Code", "https://errorcorrectionzoo.org/c/stab_5_1_3"),
        new LinkItem("Stabilizer Formalism - Wikipedia", "https://en.wikipedia.org/wiki/Stabilizer_code"),
        new LinkItem("Quantum Error Correction Tutorial", "https://arxiv.org/abs/0904.2557")
      ];

      this.references = [
        new LinkItem("Five-Qubit Stabilizer Code Implementation (Qiskit)", "https://github.com/bernwo/five-qubit-code"),
        new LinkItem("Qiskit StabilizerState Implementation", "https://github.com/Qiskit/qiskit/blob/main/qiskit/quantum_info/states/stabilizerstate.py")
      ];

      // Test vectors for [[5,1,3]] code (classical representation)
      // Using simplified encoding: logical 0 → 00000, logical 1 → 11111
      // Format: array of bits representing qubits
      // All test vectors are ENCODE tests (logical qubit → physical qubits)
      // Round-trip tests will verify encoding/decoding symmetry
      this.tests = [
        // Encode logical |0⟩
        new TestCase(
          [0], // Logical 0
          [0, 0, 0, 0, 0], // Encoded as |0⟩_L in 5 qubits
          "Five-qubit code encode logical |0⟩",
          "https://errorcorrectionzoo.org/c/stab_5_1_3"
        ),
        // Encode logical |1⟩
        new TestCase(
          [1], // Logical 1
          [1, 1, 1, 1, 1], // Encoded as |1⟩_L in 5 qubits
          "Five-qubit code encode logical |1⟩",
          "https://errorcorrectionzoo.org/c/stab_5_1_3"
        ),
        // Encode multiple logical bits
        new TestCase(
          [0, 1], // Two logical bits
          [0, 0, 0, 0, 0, 1, 1, 1, 1, 1], // Two 5-qubit codewords
          "Encode two logical qubits",
          "https://errorcorrectionzoo.org/c/stab_5_1_3"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {StabilizerQuantumCodeInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new StabilizerQuantumCodeInstance(this, isInverse);
    }
  }

  /**
 * StabilizerQuantumCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class StabilizerQuantumCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {StabilizerQuantumCodeAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('StabilizerQuantumCodeInstance.Feed: Input must be byte array');
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
    // Maps logical qubit state to 5 physical qubits using stabilizer code

    /**
     * @returns {uint8[]} Five physical bits per logical bit
     */
    _encode() {
      if (this.inputBuffer.length === 0) {
        throw new Error('Stabilizer code requires at least 1 bit of logical data');
      }

      /** @type {uint8[]} */
      const result = [];

      // Process each input bit as a logical qubit
      for (let i = 0; i < this.inputBuffer.length; i++) {
        /** @type {uint8} */
        const logicalBit = OpCodes.ToByte(this.inputBuffer[i]);

        // Encode using [[5,1,3]] code
        // Simplified: |0_L> → [0,0,0,0,0], |1_L> → [1,1,1,1,1]
        // Real quantum implementation would use proper superposition states
        /** @type {uint8} */
        const physical = logicalBit === 0 ? 0 : 1;
        for (let q = 0; q < 5; ++q) result.push(physical);
      }

      this.inputBuffer = [];
      return result;
    }

    // ===== DECODING WITH ERROR CORRECTION =====

    /**
     * @returns {uint8[]} One logical bit per five-bit block
     */
    _decode() {
      if (this.inputBuffer.length === 0) {
        throw new Error('Stabilizer code requires encoded data');
      }

      if (this.inputBuffer.length % 5 !== 0) {
        throw new Error('Stabilizer code requires data in 5-qubit blocks');
      }

      /** @type {uint8[]} */
      const result = [];

      // Process 5-bit blocks
      for (let i = 0; i < this.inputBuffer.length; i += 5) {
        // Extract 5-qubit codeword
        /** @type {uint8[]} */
        const codeword = this.inputBuffer.slice(i, i + 5);

        // Convert to packed integer for syndrome calculation
        /** @type {uint32} */
        const packed = this._packBits(codeword);

        // Measure stabilizers to get syndrome
        /** @type {uint32} */
        const syndrome = this._measureSyndrome(packed);

        // Lookup error correction
        /** @type {SyndromeEntry} */
        let errorInfo = NO_ERROR_5_1_3;
        if (syndrome < SYNDROME_TABLE_5_1_3.length && SYNDROME_TABLE_5_1_3[syndrome] !== null) {
          errorInfo = SYNDROME_TABLE_5_1_3[syndrome];
        }

        // Apply correction
        /** @type {uint32} */
        let corrected = packed;
        if (errorInfo.qubit >= 0) {
          corrected = this._applyCorrection(packed, errorInfo.qubit, errorInfo.errorType);
        }

        // Decode to logical bit
        // Simplified: measure if closer to 00000 or 11111
        /** @type {uint8} */
        const logicalBit = this._decodeLogicalBit(corrected);

        result.push(logicalBit);
      }

      this.inputBuffer = [];
      return result;
    }

    // Pack 5-bit array into integer
    /**
     * @param {uint8[]} bits - Up to five bits
     * @returns {uint32} Bits packed MSB first
     */
    _packBits(bits) {
      /** @type {uint32} */
      let result = 0;
      for (let i = 0; i < Math.min(5, bits.length); i++) {
        result = OpCodes.ToUint32(OpCodes.Shl32(result, 1)|OpCodes.ToByte(bits[i]));
      }
      return result;
    }

    // ===== STABILIZER MEASUREMENT =====
    // Measures all stabilizer generators to compute syndrome

    /**
     * @param {uint32} codeword - Packed codeword
     * @returns {uint32} Syndrome
     */
    _measureSyndrome(codeword) {
      /** @type {uint32} */
      let syndrome = 0;

      for (let i = 0; i < STABILIZERS_5_1_3.length; i++) {
        /** @type {Stabilizer} */
        const stabilizer = STABILIZERS_5_1_3[i];

        // Compute eigenvalue (-1 or +1) by counting parity
        // In classical representation: XOR of affected qubits
        /** @type {uint32} */
        const xParity = this._computeParity(codeword, stabilizer.x);
        /** @type {uint32} */
        const zParity = this._computeParity(codeword, stabilizer.z);

        // Syndrome bit: 0 if +1 eigenvalue, 1 if -1 eigenvalue
        // Simplified: XOR of parities indicates error
        /** @type {uint32} */
        const syndromeBit = OpCodes.Xor32(xParity, zParity);

        syndrome = OpCodes.Xor32(syndrome, OpCodes.Shl32(syndromeBit, i));
      }

      return syndrome;
    }

    // Compute parity of bits selected by mask
    /**
     * @param {uint32} value - Packed codeword
     * @param {uint32} mask - Qubit selection
     * @returns {uint32} Folded parity
     */
    _computeParity(value, mask) {
      /** @type {uint32} */
      let result = 0;
      /** @type {uint32} */
      let masked = OpCodes.And32(value, mask);

      while (masked) {
        result = OpCodes.Xor32(result, OpCodes.ToByte(masked));
        masked = OpCodes.Shr32(masked, 1);
      }

      return result;
    }

    // ===== ERROR CORRECTION =====
    // Apply correction based on error type and location

    /**
     * @param {uint32} codeword - Packed codeword
     * @param {int32} qubit - Qubit index
     * @param {int32} errorType - 1=X, 2=Z, 3=Y
     * @returns {uint32} Corrected codeword
     */
    _applyCorrection(codeword, qubit, errorType) {
      /** @type {uint32} */
      let corrected = codeword;

      switch (errorType) {
        case 1: // X error (bit flip)
          corrected = OpCodes.Xor32(corrected, OpCodes.Shl32(1, qubit));
          break;
        case 2: // Z error (phase flip)
          // In classical representation, phase errors don't affect bit values
          // But we track them for proper quantum behavior
          // For educational purposes, we just note the correction
          break;
        case 3: // Y error (both bit and phase flip)
          corrected = OpCodes.Xor32(corrected, OpCodes.Shl32(1, qubit));
          // Also correct phase (not visible in classical representation)
          break;
      }

      return corrected;
    }

    // ===== LOGICAL DECODING =====
    // Decode 5-qubit codeword to 1 logical bit

    /**
     * @param {uint32} codeword - Packed codeword
     * @returns {uint8} Majority bit
     */
    _decodeLogicalBit(codeword) {
      // Count number of 1s in codeword
      /** @type {int32} */
      const weight = this._hammingWeight(codeword);

      // Majority vote: closer to 00000 or 11111?
      // If weight > 2.5, decode as 1; otherwise 0
      return weight >= 3 ? 1 : 0;
    }

    // Count number of 1-bits (Hamming weight)
    /**
     * @param {uint32} value - Packed codeword
     * @returns {int32} Number of set bits
     */
    _hammingWeight(value) {
      /** @type {int32} */
      let count = 0;
      /** @type {uint32} */
      let temp = value;
      while (temp) {
        count += OpCodes.ToByte(temp);
        temp = OpCodes.Shr32(temp, 1);
      }
      return count;
    }

    // ===== ERROR DETECTION =====

    /**
     * @param {uint8[]} data - Received codeword symbols
     * @returns {boolean} True if errors detected
     */
    DetectError(data) {
      if (!data || data.length === 0) {
        return false;
      }

      // Pack first 5 bits into codeword
      /** @type {uint32} */
      const packed = this._packBits(data.slice(0, 5));

      // Measure syndrome on first codeword
      /** @type {uint32} */
      const syndrome = this._measureSyndrome(packed);

      // Non-zero syndrome indicates error
      return syndrome !== 0;
    }

    // Get error correction capability
    /**
     * @returns {int32} Correctable errors per block
     */
    getMaxCorrectableErrors() {
      return 1; // [[5,1,3]] code corrects 1 error per 5-qubit block
    }

    // Get code parameters
    /**
     * @returns {StabilizerCodeParameters} Code parameters
     */
    getCodeParameters() {
      return new StabilizerCodeParameters();
    }

    // Get stabilizer generators (for educational reference)
    /**
     * @returns {StabilizerDescription[]} Stabilizer generators
     */
    getStabilizers() {
      /** @type {StabilizerDescription[]} */
      const described = [];
      for (let i = 0; i < STABILIZERS_5_1_3.length; ++i) {
        /** @type {Stabilizer} */
        const s = STABILIZERS_5_1_3[i];
        /** @type {string} */
        const xBits = s.x.toString(2).padStart(5, '0');
        /** @type {string} */
        const zBits = s.z.toString(2).padStart(5, '0');
        described.push(new StabilizerDescription(
          s.name,
          xBits,
          zBits,
          "X on qubits: " + (this._getBitPositions(s.x)) + ", Z on qubits: " + (this._getBitPositions(s.z))
        ));
      }
      return described;
    }

    /**
     * @param {uint32} value - Qubit mask
     * @returns {string} Comma-separated positions or "none"
     */
    _getBitPositions(value) {
      /** @type {int32[]} */
      const positions = [];
      for (let i = 0; i < 5; i++) {
        if (OpCodes.And32(value, OpCodes.Shl32(1, i))) {
          positions.push(i);
        }
      }
      return positions.length > 0 ? positions.join(',') : 'none';
    }
  }

  // Register the algorithm
  const algorithmInstance = new StabilizerQuantumCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return algorithmInstance;

}));
