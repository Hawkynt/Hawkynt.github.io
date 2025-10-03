/*
 * E0 Bluetooth Stream Cipher - AlgorithmFramework Implementation
 * INSECURE: Has known vulnerabilities - for educational purposes only
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * E0 is the stream cipher used in the Bluetooth protocol for encryption.
 * It combines four LFSRs of different lengths with a nonlinear combining function.
 *
 * Key characteristics:
 * - Key lengths: 8-128 bits (typically 128 bits)
 * - Four LFSRs of lengths: 25, 31, 33, 39 bits
 * - Two 2-bit memory elements
 * - Nonlinear combining function based on majority logic
 *
 * SECURITY WARNING: E0 has known cryptanalytic vulnerabilities and should not
 * be used for new security applications. Implemented for educational purposes.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
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
          StreamCipherAlgorithm, IAlgorithmInstance,
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class E0Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "E0";
      this.description = "Stream cipher used in Bluetooth protocol for encryption. Combines four LFSRs with nonlinear combining function using majority logic. Has known cryptanalytic vulnerabilities and should not be used for new security applications.";
      this.inventor = "Bluetooth SIG";
      this.year = 1998;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.MULTI;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(1, 16, 0)  // E0: 8-128 bit keys (1-16 bytes)
      ];
      this.SupportedNonceSizes = [
        new KeySize(0, 0, 0)  // E0 does not use nonce/IV
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Bluetooth Security Analysis", "https://www.cs.technion.ac.il/~biham/BT/"),
        new LinkItem("E0 Cryptanalysis", "https://eprint.iacr.org/2004/152.pdf"),
        new LinkItem("Bluetooth E0 Specification", "https://www.bluetooth.com/specifications/")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability(
          "Correlation Attack",
          "Statistical correlation attacks can recover keystream with practical complexity",
          "Do not use for cryptographic applications - educational purposes only"
        ),
        new Vulnerability(
          "FMS Attack",
          "Fluhrer-Mantin-Shamir style attacks applicable to E0 structure",
          "Algorithm has fundamental structural weaknesses"
        ),
        new Vulnerability(
          "Algebraic Attack",
          "Recent 2022 algebraic attacks using Gröbner bases with complexity 2^79",
          "Modern attacks demonstrate practical vulnerability"
        )
      ];

      // Test vectors
      this.tests = [
        {
          text: "E0 Test Vector (Educational)",
          uri: "https://www.bluetooth.com/specifications/",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("f6b37e0393807025e9b6ad61e8ba3953")
        }
      ];

      // E0 constants
      this.LFSR_LENGTHS = [25, 31, 33, 39];  // Four LFSR lengths
      this.TOTAL_STATE_BITS = 132;           // 25+31+33+39 + 4 memory bits

      // Primitive feedback polynomials for each LFSR (from Bluetooth spec)
      this.FEEDBACK_POLYNOMIALS = [
        // LFSR 0 (25 bits): x^25 + x^20 + x^12 + x^8 + 1
        [0, 8, 12, 20, 24],
        // LFSR 1 (31 bits): x^31 + x^24 + x^16 + x^12 + 1
        [0, 12, 16, 24, 30],
        // LFSR 2 (33 bits): x^33 + x^28 + x^24 + x^4 + 1
        [0, 4, 24, 28, 32],
        // LFSR 3 (39 bits): x^39 + x^36 + x^28 + x^4 + 1
        [0, 4, 28, 36, 38]
      ];

      // Output tap positions for each LFSR
      this.OUTPUT_TAPS = [24, 30, 32, 38]; // MSB positions for each LFSR
    }

    CreateInstance(isInverse = false) {
      return new E0Instance(this, isInverse);
    }
  }

  class E0Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];

      // E0 state
      this.lfsr = new Array(4);
      this.c0 = 0;
      this.c_minus_1 = 0;
      this.initialized = false;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      const keyLength = keyBytes.length;
      if (keyLength < 1 || keyLength > 16) {
        throw new Error(`Invalid E0 key size: ${keyLength} bytes. Requires 1-16 bytes`);
      }

      this._key = [...keyBytes];
      this._initializeE0();
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    set iv(ivData) {
      // E0 doesn't traditionally use IV, but store for compatibility
      this._iv = ivData;
    }

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    set nonce(nonceData) {
      this.iv = nonceData;
    }

    get nonce() {
      return this.iv;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }
      if (!this._key) {
        throw new Error("Key not set");
      }

      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data to process");
      }
      if (!this.initialized) {
        throw new Error("E0 not properly initialized");
      }

      const result = [];
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const keystreamByte = this._generateKeystreamByte();
        result.push(this.inputBuffer[i] ^ keystreamByte);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];
      return result;
    }

    _initializeE0() {
      // Initialize four LFSRs
      for (let i = 0; i < 4; i++) {
        this.lfsr[i] = new Array(this.algorithm.LFSR_LENGTHS[i]).fill(0);
      }

      // Load key material into LFSRs
      let keyBitIndex = 0;
      const totalKeyBits = this._key.length * 8;

      // Distribute key bits across all four LFSRs
      for (let reg = 0; reg < 4; reg++) {
        const length = this.algorithm.LFSR_LENGTHS[reg];

        for (let i = 0; i < length; i++) {
          if (keyBitIndex < totalKeyBits) {
            const byteIndex = Math.floor(keyBitIndex / 8);
            const bitIndex = keyBitIndex % 8;
            this.lfsr[reg][i] = (this._key[byteIndex] >> bitIndex) & 1;
            keyBitIndex++;
          } else {
            // Repeat key pattern if key is shorter than total LFSR space
            const repeatIndex = keyBitIndex % totalKeyBits;
            const byteIndex = Math.floor(repeatIndex / 8);
            const bitIndex = repeatIndex % 8;
            this.lfsr[reg][i] = (this._key[byteIndex] >> bitIndex) & 1;
            keyBitIndex++;
          }
        }
      }

      // Ensure no LFSR is all zeros
      for (let reg = 0; reg < 4; reg++) {
        let allZero = true;
        for (let i = 0; i < this.algorithm.LFSR_LENGTHS[reg]; i++) {
          if (this.lfsr[reg][i] !== 0) {
            allZero = false;
            break;
          }
        }
        if (allZero) {
          this.lfsr[reg][0] = 1;  // Set LSB to prevent all-zero state
        }
      }

      // Initialize memory elements with some key-derived values
      const keyLength = this._key.length;
      this.c0 = (this._key[0] ^ this._key[1 % keyLength]) & 3;
      this.c_minus_1 = (this._key[2 % keyLength] ^ this._key[3 % keyLength]) & 3;

      this.initialized = true;
    }

    _clockLFSR(regIndex) {
      const reg = this.lfsr[regIndex];
      const length = this.algorithm.LFSR_LENGTHS[regIndex];
      const taps = this.algorithm.FEEDBACK_POLYNOMIALS[regIndex];

      // Calculate feedback using primitive polynomial
      let feedback = 0;
      for (let i = 0; i < taps.length; i++) {
        feedback ^= reg[taps[i]];
      }

      // Get output bit before shifting
      const output = reg[length - 1];

      // Shift register
      for (let i = length - 1; i > 0; i--) {
        reg[i] = reg[i - 1];
      }
      reg[0] = feedback;

      return output;
    }

    _combiningFunction(outputs) {
      // E0 combining function using majority logic and memory elements

      // Sum the four LFSR outputs
      let sum = 0;
      for (let i = 0; i < 4; i++) {
        sum += outputs[i];
      }

      // Add memory elements
      sum += this.c0 + this.c_minus_1;

      // Extract output bit and carry bits
      const outputBit = sum & 1;
      const carry = sum >> 1;

      // Update memory elements (simplified E0 state update)
      this.c_minus_1 = this.c0;
      this.c0 = carry & 3;  // Keep only 2 bits

      return outputBit;
    }

    _generateKeystreamBit() {
      // Clock all four LFSRs and get output bits
      const outputs = new Array(4);
      for (let i = 0; i < 4; i++) {
        outputs[i] = this._clockLFSR(i);
      }

      // Apply combining function
      return this._combiningFunction(outputs);
    }

    _generateKeystreamByte() {
      let keystreamByte = 0;

      for (let bit = 0; bit < 8; bit++) {
        const keystreamBit = this._generateKeystreamBit();
        keystreamByte |= (keystreamBit << bit);
      }

      return keystreamByte;
    }
  }

  // Register the algorithm
  const algorithmInstance = new E0Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // Return for module systems
  return { E0Algorithm, E0Instance };
}));