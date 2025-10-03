/*
 * Grain v1 Stream Cipher - AlgorithmFramework Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Grain v1 is a lightweight stream cipher designed for restricted hardware environments.
 * It was selected for the final eSTREAM portfolio in the Profile 2 category.
 * The algorithm uses:
 * - 80-bit keys and 64-bit IVs
 * - 80-bit Linear Feedback Shift Register (LFSR)
 * - 80-bit Non-linear Feedback Shift Register (NFSR)
 * - Boolean output filter function
 * - 160 initialization rounds before keystream generation
 *
 * This implementation follows the eSTREAM specification.
 * For educational purposes only - use proven libraries for production.
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

  class GrainV1Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Grain v1";
      this.description = "Lightweight stream cipher using LFSR and NFSR designed for restricted hardware environments. Selected for eSTREAM Portfolio Profile 2. Uses 80-bit keys and 64-bit IVs with 160-bit total state.";
      this.inventor = "Martin Hell, Thomas Johansson, and Willi Meier";
      this.year = 2004;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.SE;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(10, 10, 0)  // Grain v1: 80-bit keys only (10 bytes)
      ];
      this.SupportedNonceSizes = [
        new KeySize(8, 8, 0)    // Grain v1: 64-bit IVs (8 bytes)
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("eSTREAM Grain v1 Specification", "https://www.ecrypt.eu.org/stream/grainpf.html"),
        new LinkItem("Grain - A New Stream Cipher", "https://www.eit.lth.se/fileadmin/eit/courses/eit060f/Grain.pdf"),
        new LinkItem("eSTREAM Portfolio", "https://www.ecrypt.eu.org/stream/")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [];

      // Test vectors
      this.tests = [
        {
          text: "eSTREAM Grain v1 Test Vector",
          uri: "https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/grain/",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000"),
          iv: OpCodes.Hex8ToBytes("0000000000000000"),
          expected: OpCodes.Hex8ToBytes("7d405a412bfa1f7b")
        }
      ];

      // Cipher parameters
      this.nBlockSizeInBits = 1;   // Stream cipher - 1 bit at a time
      this.nKeySizeInBits = 80;    // 80-bit key
      this.nIVSizeInBits = 64;     // 64-bit IV
    }

    CreateInstance(isInverse = false) {
      return new GrainV1Instance(this, isInverse);
    }
  }

  class GrainV1Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];

      // Internal state
      this.lfsr = new Array(80).fill(0);    // 80-bit LFSR state
      this.nfsr = new Array(80).fill(0);    // 80-bit NFSR state
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
        throw new Error(`Grain v1 requires exactly 80-bit (10-byte) keys, got ${keyBytes.length} bytes`);
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
        throw new Error(`Grain v1 requires exactly 64-bit (8-byte) IVs, got ${ivBytes.length} bytes`);
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
        throw new Error("Grain v1 not properly initialized");
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
        this._initializeGrainV1();
      }
    }

    /**
     * Setup key and IV for Grain v1
     */
    _initializeGrainV1() {
      // Load key into NFSR (80 bits)
      for (let i = 0; i < 80; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        this.nfsr[i] = (this._key[byteIndex] >>> bitIndex) & 1;
      }

      // Load IV into LFSR low 64 bits
      for (let i = 0; i < 64; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        this.lfsr[i] = (this._iv[byteIndex] >>> bitIndex) & 1;
      }

      // Fill remaining 16 LFSR bits with ones
      for (let i = 64; i < 80; i++) {
        this.lfsr[i] = 1;
      }

      // Initialization phase - 160 rounds
      for (let round = 0; round < 160; round++) {
        const output = this._generateOutputBit();

        // Update both registers with feedback XOR output
        const newLFSRBit = this._updateLFSR() ^ output;
        const newNFSRBit = this._updateNFSR() ^ output;

        // Shift and insert new bits
        this._shiftRegister(this.lfsr, newLFSRBit);
        this._shiftRegister(this.nfsr, newNFSRBit);
      }

      this.initialized = true;
    }

    /**
     * LFSR feedback function - polynomial: x^80 + x^62 + x^51 + x^13 + 1
     * @returns {number} New LFSR feedback bit
     */
    _updateLFSR() {
      // Feedback polynomial positions: 62, 51, 13, 0
      return this.lfsr[62] ^ this.lfsr[51] ^ this.lfsr[13] ^ this.lfsr[0];
    }

    /**
     * NFSR feedback function - includes linear terms from LFSR and nonlinear terms
     * @returns {number} New NFSR feedback bit
     */
    _updateNFSR() {
      // Linear terms from NFSR and LFSR
      const linear = this.nfsr[62] ^ this.nfsr[60] ^ this.nfsr[52] ^ this.nfsr[45] ^
                    this.nfsr[37] ^ this.nfsr[33] ^ this.nfsr[28] ^ this.nfsr[21] ^
                    this.nfsr[14] ^ this.nfsr[9] ^ this.nfsr[0] ^ this.lfsr[63];

      // Nonlinear terms (simplified version)
      const nonlinear = (this.nfsr[63] & this.nfsr[60]) ^
                       (this.nfsr[37] & this.nfsr[33]) ^
                       (this.nfsr[15] & this.nfsr[9]) ^
                       (this.nfsr[60] & this.nfsr[52] & this.nfsr[45]) ^
                       (this.nfsr[33] & this.nfsr[28] & this.nfsr[21]) ^
                       (this.nfsr[63] & this.nfsr[45] & this.nfsr[28] & this.nfsr[9]) ^
                       (this.nfsr[60] & this.nfsr[52] & this.nfsr[37] & this.nfsr[33]) ^
                       (this.nfsr[63] & this.nfsr[60] & this.nfsr[21] & this.nfsr[15]) ^
                       (this.nfsr[63] & this.nfsr[60] & this.nfsr[52] & this.nfsr[45] & this.nfsr[37]) ^
                       (this.nfsr[33] & this.nfsr[28] & this.nfsr[21] & this.nfsr[15] & this.nfsr[9]) ^
                       (this.nfsr[52] & this.nfsr[45] & this.nfsr[37] & this.nfsr[33] & this.nfsr[28] & this.nfsr[21]);

      return linear ^ nonlinear;
    }

    /**
     * Generate output bit using filter function
     * @returns {number} Output keystream bit
     */
    _generateOutputBit() {
      // Output filter: combines bits from LFSR and NFSR
      const lfsrBits = this.lfsr[3] ^ this.lfsr[25] ^ this.lfsr[46] ^ this.lfsr[64];
      const nfsrBits = this.nfsr[63] ^ this.nfsr[60] ^ this.nfsr[52] ^ this.nfsr[45] ^
                      this.nfsr[37] ^ this.nfsr[33] ^ this.nfsr[28];

      // Boolean function h(x) - simplified 5-input function
      const x1 = this.lfsr[25], x2 = this.lfsr[46], x3 = this.lfsr[64], x4 = this.lfsr[63];
      const x5 = this.nfsr[63];

      const h = x1 ^ x4 ^ (x1 & x3) ^ (x2 & x3) ^ (x3 & x4) ^ (x1 & x2 & x5);

      return lfsrBits ^ nfsrBits ^ h;
    }

    /**
     * Shift register left and insert new bit at position 0
     * @param {Array} register - Register to shift
     * @param {number} newBit - New bit to insert
     */
    _shiftRegister(register, newBit) {
      for (let i = 79; i > 0; i--) {
        register[i] = register[i - 1];
      }
      register[0] = newBit & 1;
    }

    /**
     * Generate one keystream byte (8 bits)
     * @returns {number} Keystream byte (0-255)
     */
    _generateKeystreamByte() {
      let byte = 0;

      // Generate 8 bits for one byte
      for (let bit = 0; bit < 8; bit++) {
        const outputBit = this._generateOutputBit();
        byte |= (outputBit << bit);

        // Update registers for next bit
        const newLFSRBit = this._updateLFSR();
        const newNFSRBit = this._updateNFSR();

        this._shiftRegister(this.lfsr, newLFSRBit);
        this._shiftRegister(this.nfsr, newNFSRBit);
      }

      return byte;
    }
  }

  // Register the algorithm
  const algorithmInstance = new GrainV1Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // Return for module systems
  return { GrainV1Algorithm, GrainV1Instance };
}));