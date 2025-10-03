/*
 * Grain Stream Cipher - AlgorithmFramework Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Grain is a stream cipher designed by Hell, Johansson, and Meier.
 * It combines an 80-bit LFSR with an 80-bit NLFSR:
 * - LFSR: 80 bits with primitive polynomial
 * - NLFSR: 80 bits with nonlinear feedback function
 * - Output: combines LFSR and NLFSR bits with nonlinear filter
 *
 * Key size: 80 bits, IV size: 64 bits
 * Initialization: 160 clock cycles
 *
 * This implementation is for educational purposes only.
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

  class GrainAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Grain";
      this.description = "Hardware-oriented stream cipher using combination of LFSR and NLFSR. Part of the eSTREAM hardware portfolio and ISO/IEC 29192-3 standard. Features 80-bit keys and 64-bit IVs.";
      this.inventor = "Martin Hell, Thomas Johansson, and Willi Meier";
      this.year = 2005;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.SE;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(10, 10, 0)  // Grain: 80-bit keys only (10 bytes)
      ];
      this.SupportedNonceSizes = [
        new KeySize(8, 8, 0)    // Grain: 64-bit IVs (8 bytes)
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("ISO/IEC 29192-3:2012 - Grain Stream Cipher", "https://www.iso.org/standard/56426.html"),
        new LinkItem("eSTREAM Grain Specification", "https://www.ecrypt.eu.org/stream/grain.html"),
        new LinkItem("Grain: A Stream Cipher for Constrained Environments", "http://www.ecrypt.eu.org/stream/papersdir/2005/017.pdf")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [];

      // Test vectors
      this.tests = [
        {
          text: "Grain Test Vector (all-zero key and IV)",
          uri: "https://www.ecrypt.eu.org/stream/e2-grain.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000"),
          iv: OpCodes.Hex8ToBytes("0000000000000000"),
          expected: OpCodes.Hex8ToBytes("6b15855017682edc")
        }
      ];

      // Grain constants
      this.LFSR_SIZE = 80;
      this.NLFSR_SIZE = 80;
      this.KEY_SIZE = 80;          // 80-bit key
      this.IV_SIZE = 64;           // 64-bit IV
      this.INIT_ROUNDS = 160;      // Initialization rounds (2 * 80)
    }

    CreateInstance(isInverse = false) {
      return new GrainInstance(this, isInverse);
    }
  }

  class GrainInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];

      // Grain state
      this.lfsr = new Array(this.algorithm.LFSR_SIZE);   // 80-bit LFSR
      this.nlfsr = new Array(this.algorithm.NLFSR_SIZE); // 80-bit NLFSR
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

      if (keyBytes.length !== 10) {
        throw new Error(`Grain requires exactly 80-bit (10-byte) keys, got ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this._initializeIfReady();
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    set iv(ivBytes) {
      if (!ivBytes) {
        this._iv = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(ivBytes)) {
        throw new Error("Invalid IV - must be byte array");
      }

      if (ivBytes.length !== 8) {
        throw new Error(`Grain requires exactly 64-bit (8-byte) IVs, got ${ivBytes.length} bytes`);
      }

      this._iv = [...ivBytes];
      this._initializeIfReady();
    }

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    set nonce(nonceBytes) {
      // For compatibility, treat nonce as IV
      this.iv = nonceBytes;
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
      if (!this._iv) {
        throw new Error("IV not set");
      }

      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._iv) {
        throw new Error("IV not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data to process");
      }
      if (!this.initialized) {
        throw new Error("Grain not properly initialized");
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

    _initializeIfReady() {
      if (this._key && this._iv) {
        this._initializeGrain();
      }
    }

    _initializeGrain() {
      // Load NLFSR with 80-bit key
      for (let i = 0; i < 80; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        this.nlfsr[i] = (this._key[byteIndex] >>> bitIndex) & 1;
      }

      // Load LFSR with 64-bit IV followed by 16 ones
      for (let i = 0; i < 64; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        this.lfsr[i] = (this._iv[byteIndex] >>> bitIndex) & 1;
      }

      // Set remaining 16 bits of LFSR to 1
      for (let i = 64; i < 80; i++) {
        this.lfsr[i] = 1;
      }

      // Run initialization for 160 rounds
      for (let i = 0; i < this.algorithm.INIT_ROUNDS; i++) {
        const output = this._clockCipher();
        // During initialization, feedback output to both registers
        this.lfsr[0] ^= output;
        this.nlfsr[0] ^= output;
      }

      this.initialized = true;
    }

    /**
     * LFSR feedback function
     * Primitive polynomial: x^80 + x^43 + x^42 + x^38 + x^33 + x^28 + x^21 + x^14 + x^9 + x^8 + x^6 + x^5 + 1
     * @returns {number} Feedback bit (0 or 1)
     */
    _lfsrFeedback() {
      return this.lfsr[79] ^ this.lfsr[42] ^ this.lfsr[41] ^ this.lfsr[37] ^
             this.lfsr[32] ^ this.lfsr[27] ^ this.lfsr[20] ^ this.lfsr[13] ^
             this.lfsr[8] ^ this.lfsr[7] ^ this.lfsr[5] ^ this.lfsr[4];
    }

    /**
     * NLFSR feedback function
     * g(x) = x0 + x13 + x23 + x38 + x51 + x62 + x0x1 + x17x20 + x43x47 + x65x68 + x70x78
     * @returns {number} Feedback bit (0 or 1)
     */
    _nlfsrFeedback() {
      const linear = this.nlfsr[79] ^ this.nlfsr[66] ^ this.nlfsr[56] ^ this.nlfsr[41] ^
                     this.nlfsr[28] ^ this.nlfsr[17];

      const nonlinear = (this.nlfsr[79] & this.nlfsr[78]) ^
                        (this.nlfsr[62] & this.nlfsr[59]) ^
                        (this.nlfsr[36] & this.nlfsr[32]) ^
                        (this.nlfsr[14] & this.nlfsr[11]) ^
                        (this.nlfsr[9] & this.nlfsr[1]);

      return linear ^ nonlinear;
    }

    /**
     * Output filter function
     * h(x) = x1 + x4 + x0x3 + x2x3 + x3x4 + x0x1x2 + x0x2x3 + x0x2x4 + x1x2x4 + x2x3x4
     * @param {Array} x - Array of 5 LFSR bits
     * @returns {number} Filter output (0 or 1)
     */
    _outputFilter(x) {
      return x[1] ^ x[4] ^ (x[0] & x[3]) ^ (x[2] & x[3]) ^ (x[3] & x[4]) ^
             (x[0] & x[1] & x[2]) ^ (x[0] & x[2] & x[3]) ^ (x[0] & x[2] & x[4]) ^
             (x[1] & x[2] & x[4]) ^ (x[2] & x[3] & x[4]);
    }

    /**
     * Clock the Grain cipher one step
     * @returns {number} Output bit (0 or 1)
     */
    _clockCipher() {
      // Get output bit before shifting
      const lfsrOut = this._lfsrFeedback();
      const nlfsrOut = this._nlfsrFeedback();

      // Get bits for output filter (specific positions from LFSR)
      const filterBits = [
        this.lfsr[2],   // x0
        this.lfsr[15],  // x1
        this.lfsr[36],  // x2
        this.lfsr[45],  // x3
        this.lfsr[64]   // x4
      ];

      // Calculate output
      const output = this._outputFilter(filterBits) ^
                     this.lfsr[1] ^ this.lfsr[2] ^ this.lfsr[4] ^ this.lfsr[10] ^
                     this.lfsr[31] ^ this.lfsr[43] ^ this.lfsr[56] ^
                     this.nlfsr[9] ^ this.nlfsr[20] ^ this.nlfsr[29] ^ this.nlfsr[38] ^
                     this.nlfsr[47] ^ this.nlfsr[56] ^ this.nlfsr[59] ^ this.nlfsr[61] ^
                     this.nlfsr[65] ^ this.nlfsr[68] ^ this.nlfsr[70];

      // Shift LFSR
      for (let i = 79; i > 0; i--) {
        this.lfsr[i] = this.lfsr[i - 1];
      }
      this.lfsr[0] = lfsrOut;

      // Shift NLFSR
      for (let i = 79; i > 0; i--) {
        this.nlfsr[i] = this.nlfsr[i - 1];
      }
      this.nlfsr[0] = nlfsrOut ^ this.lfsr[0]; // NLFSR input includes LFSR output

      return output;
    }

    /**
     * Generate one keystream bit
     * @returns {number} Keystream bit (0 or 1)
     */
    _generateKeystreamBit() {
      return this._clockCipher();
    }

    /**
     * Generate one keystream byte (8 bits)
     * @returns {number} Keystream byte (0-255)
     */
    _generateKeystreamByte() {
      let byte = 0;
      for (let i = 0; i < 8; i++) {
        byte = byte | (this._generateKeystreamBit() << i);  // LSB first
      }
      return byte;
    }
  }

  // Register the algorithm
  const algorithmInstance = new GrainAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // Return for module systems
  return { GrainAlgorithm, GrainInstance };
}));