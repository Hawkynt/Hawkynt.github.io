/*
 * Crypto-1 Stream Cipher - AlgorithmFramework Implementation
 * INSECURE: Cryptographically broken - for educational purposes only
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Crypto-1 is a proprietary stream cipher used in NXP MIFARE Classic cards.
 * It was reverse-engineered by the cryptographic community and found to be
 * severely vulnerable to multiple attacks.
 *
 * Key characteristics:
 * - 48-bit key and internal state
 * - LFSR with nonlinear filter function
 * - 20-to-1 nonlinear output function
 * - Used in RFID/NFC authentication
 *
 * SECURITY WARNING: Crypto-1 is cryptographically broken and should never
 * be used for actual security applications.
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

  /**
 * Crypto1Algorithm - Stream cipher implementation
 * @class
 * @extends {StreamCipherAlgorithm}
 */

  class Crypto1Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Crypto-1";
      this.description = "Proprietary stream cipher used in NXP MIFARE Classic cards, reverse-engineered by cryptographic community. Uses 48-bit LFSR with nonlinear filter function. Cryptographically broken with multiple practical attacks published.";
      this.inventor = "NXP Semiconductors (proprietary design)";
      this.year = 1994;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.NL;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(6, 6, 0)  // Crypto-1: 48-bit keys only (6 bytes)
      ];
      this.SupportedNonceSizes = [
        new KeySize(0, 0, 0)  // Crypto-1 does not use nonce/IV
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Crypto-1 Cryptanalysis", "https://eprint.iacr.org/2008/166.pdf"),
        new LinkItem("MIFARE Classic Security Analysis", "https://www.cs.virginia.edu/~evans/pubs/ccs08/"),
        new LinkItem("Dismantling MIFARE Classic", "https://www.cs.ru.nl/~flaviog/publications/mifare.pdf")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability(
          "Key Recovery Attack",
          "Multiple practical key recovery attacks allow extracting 48-bit keys in seconds",
          "Do not use - algorithm is fundamentally broken"
        ),
        new Vulnerability(
          "Weak PRNG",
          "Predictable keystream generation allows statistical attacks",
          "Algorithm cannot be fixed - replace with secure alternative"
        ),
        new Vulnerability(
          "Correlation Attacks",
          "Linear correlations in LFSR output enable cryptanalytic attacks",
          "Fundamental design flaw - use modern stream ciphers instead"
        )
      ];

      // Test vectors
      this.tests = [
        {
          text: "Crypto-1 Test Vector (Educational)",
          uri: "https://github.com/nfc-tools/mfcuk",
          input: OpCodes.Hex8ToBytes("00000000"),
          key: OpCodes.Hex8ToBytes("000102030405"),
          expected: OpCodes.Hex8ToBytes("4e8485a0")
        }
      ];

      // Crypto-1 constants
      this.LFSR_SIZE = 48;         // 48-bit LFSR state
      this.KEY_SIZE = 6;           // 48 bits = 6 bytes

      // LFSR feedback polynomial (reverse-engineered)
      // Polynomial: x^48 + x^43 + x^39 + x^38 + x^36 + x^34 + x^33 + x^31 + x^29 + x^24 + x^23 + x^21 + x^19 + x^13 + x^9 + x^7 + x^6 + x^5 + 1
      this.FEEDBACK_TAPS = [0, 5, 6, 7, 9, 13, 19, 21, 23, 24, 29, 31, 33, 34, 36, 38, 39, 43];

      // Filter function taps (20 positions used for nonlinear filter)
      this.FILTER_TAPS = [0, 1, 2, 3, 5, 6, 7, 8, 9, 13, 14, 15, 17, 19, 24, 30, 32, 33, 43, 45];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Crypto1Instance(this, isInverse);
    }
  }

  /**
 * Crypto1 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Crypto1Instance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];

      // Crypto-1 state
      this.state = new Array(this.algorithm.LFSR_SIZE);
      this.initialized = false;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      if (keyBytes.length !== this.algorithm.KEY_SIZE) {
        throw new Error(`Crypto-1 requires exactly 48-bit (6-byte) keys, got ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this._initializeCrypto1();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

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

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data to process");
      }
      if (!this.initialized) {
        throw new Error("Crypto-1 not properly initialized");
      }

      const result = [];
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const keystreamByte = this._generateKeystreamByte();
        result.push(OpCodes.XorN(this.inputBuffer[i], keystreamByte));
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];
      return result;
    }

    _initializeCrypto1() {
      // Load 48-bit key into LFSR state
      for (let i = 0; i < this.algorithm.LFSR_SIZE; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        if (byteIndex < this._key.length) {
          this.state[i] = OpCodes.AndN(OpCodes.Shr32(this._key[byteIndex], bitIndex), 1);
        } else {
          this.state[i] = 0;
        }
      }
      this.initialized = true;
    }

    _clockLFSR() {
      // Calculate feedback using linear polynomial
      let feedback = 0;
      for (let i = 0; i < this.algorithm.FEEDBACK_TAPS.length; i++) {
        feedback = OpCodes.XorN(feedback, this.state[this.algorithm.FEEDBACK_TAPS[i]]);
      }

      // Shift LFSR
      for (let i = this.algorithm.LFSR_SIZE - 1; i > 0; i--) {
        this.state[i] = this.state[i - 1];
      }
      this.state[0] = feedback;

      return feedback;
    }

    _filterFunction() {
      // Nonlinear 20-to-1 filter function
      // Extract bits from filter tap positions
      const filterBits = new Array(this.algorithm.FILTER_TAPS.length);
      for (let i = 0; i < this.algorithm.FILTER_TAPS.length; i++) {
        filterBits[i] = this.state[this.algorithm.FILTER_TAPS[i]];
      }

      // Simplified nonlinear Boolean function (educational approximation)
      // Real Crypto-1 uses a more complex function, but this captures the essence
      let output = 0;

      // Linear terms
      for (let i = 0; i < filterBits.length; i++) {
        output = OpCodes.XorN(output, filterBits[i]);
      }

      // Quadratic terms (degree 2)
      output = OpCodes.XorN(output, OpCodes.AndN(filterBits[0], filterBits[1]));
      output = OpCodes.XorN(output, OpCodes.AndN(filterBits[2], filterBits[3]));
      output = OpCodes.XorN(output, OpCodes.AndN(filterBits[4], filterBits[5]));
      output = OpCodes.XorN(output, OpCodes.AndN(filterBits[6], filterBits[7]));
      output = OpCodes.XorN(output, OpCodes.AndN(filterBits[8], filterBits[9]));
      output = OpCodes.XorN(output, OpCodes.AndN(filterBits[10], filterBits[11]));
      output = OpCodes.XorN(output, OpCodes.AndN(filterBits[12], filterBits[13]));
      output = OpCodes.XorN(output, OpCodes.AndN(filterBits[14], filterBits[15]));
      output = OpCodes.XorN(output, OpCodes.AndN(filterBits[16], filterBits[17]));
      output = OpCodes.XorN(output, OpCodes.AndN(filterBits[18], filterBits[19]));

      // Some cubic terms (degree 3) - simplified
      if (filterBits.length >= 6) {
        output = OpCodes.XorN(output, OpCodes.AndN(OpCodes.AndN(filterBits[0], filterBits[1]), filterBits[2]));
        output = OpCodes.XorN(output, OpCodes.AndN(OpCodes.AndN(filterBits[3], filterBits[4]), filterBits[5]));
      }

      return OpCodes.AndN(output, 1);
    }

    _generateKeystreamBit() {
      // Clock LFSR and apply filter function
      this._clockLFSR();
      return this._filterFunction();
    }

    _generateKeystreamByte() {
      let keystreamByte = 0;

      for (let bit = 0; bit < 8; bit++) {
        const keystreamBit = this._generateKeystreamBit();
        keystreamByte = OpCodes.OrN(keystreamByte, OpCodes.Shl32(keystreamBit, bit));
      }

      return keystreamByte;
    }
  }

  // Register the algorithm
  const algorithmInstance = new Crypto1Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // Return for module systems
  return { Crypto1Algorithm, Crypto1Instance };
}));