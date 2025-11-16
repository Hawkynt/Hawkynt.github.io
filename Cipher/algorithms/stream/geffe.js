/*
 * Geffe Generator Stream Cipher - AlgorithmFramework Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The Geffe generator is a classical stream cipher using three Linear Feedback
 * Shift Registers (LFSRs) and a Boolean combining function.
 *
 * SECURITY WARNING: The Geffe generator has known correlation weaknesses and is
 * vulnerable to correlation attacks. This is an educational implementation.
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
 * GeffeAlgorithm - Stream cipher implementation
 * @class
 * @extends {StreamCipherAlgorithm}
 */

  class GeffeAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Geffe Generator";
      this.description = "Classical stream cipher using three Linear Feedback Shift Registers (LFSRs) and a Boolean combining function. Uses correlation between output bits for keystream generation.";
      this.inventor = "Harold Geffe";
      this.year = 1973;
      this.category = CategoryType.STREAM;
      this.subCategory = "LFSR Stream Cipher";
      this.securityStatus = SecurityStatus.INSECURE;
      this.complexity = ComplexityType.BASIC;
      this.country = CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0)  // 128-bit keys
      ];
      this.SupportedNonceSizes = [
        new KeySize(8, 8, 0)   // 64-bit IVs
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Stream Cipher Design", "https://link.springer.com/book/10.1007/978-3-642-32369-2"),
        new LinkItem("LFSR-based Stream Ciphers", "https://www.springer.com/book/9780387341880"),
        new LinkItem("Correlation Attacks on Stream Ciphers", "https://link.springer.com/chapter/10.1007/0-387-34805-0_21")
      ];

      this.references = [
        new LinkItem("Geffe Generator Analysis", "https://csrc.nist.gov/publications/detail/sp/800-22/rev-1a/final"),
        new LinkItem("LFSR Theory", "https://web.archive.org/web/20190416141256/https://www.cs.miami.edu/home/burt/learning/Csc609.092/lfsr.html"),
        new LinkItem("Stream Cipher Cryptanalysis", "https://eprint.iacr.org/2013/013")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability("Correlation Attack", "The Geffe generator is vulnerable to correlation attacks due to statistical bias in the combining function - educational purposes only")
      ];

      // Test vectors
      this.tests = [
        {
          text: 'Geffe Generator Test Vector 1 (Educational)',
          uri: 'Educational implementation test',
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("0c0502030405060708090a0b0c0d0e0f") // Generated from our implementation
        },
        {
          text: 'Geffe Generator Test Vector 2 (Shorter input)',
          uri: 'Educational implementation test',
          input: OpCodes.Hex8ToBytes("00010203040506070809"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("0c050203040506070809") // Generated from our implementation
        }
      ];

      // LFSR parameters (coprime lengths for security)
      this.LFSR1_LENGTH = 11;  // First LFSR length
      this.LFSR2_LENGTH = 13;  // Second LFSR length
      this.LFSR3_LENGTH = 17;  // Third LFSR length

      // LFSR feedback polynomials (primitive polynomials)
      this.LFSR1_TAPS = [11, 9];      // x^11 + x^9 + 1
      this.LFSR2_TAPS = [13, 12, 10, 9]; // x^13 + x^12 + x^10 + x^9 + 1
      this.LFSR3_TAPS = [17, 14];     // x^17 + x^14 + 1
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new GeffeInstance(this, isInverse);
    }

    // Initialize LFSR state from key and IV
    initializeLFSRs(key, iv) {
      // Initialize LFSR1 from first part of key
      const lfsr1 = new Array(this.LFSR1_LENGTH);
      for (let i = 0; i < this.LFSR1_LENGTH; i++) {
        lfsr1[i] = (key[i % key.length] >> (i % 8)) & 1;
      }

      // Initialize LFSR2 from middle part of key + IV
      const lfsr2 = new Array(this.LFSR2_LENGTH);
      for (let i = 0; i < this.LFSR2_LENGTH; i++) {
        const keyIdx = (i + 4) % key.length;
        const ivIdx = i % iv.length;
        lfsr2[i] = ((key[keyIdx] ^ iv[ivIdx]) >> (i % 8)) & 1;
      }

      // Initialize LFSR3 from last part of key + IV
      const lfsr3 = new Array(this.LFSR3_LENGTH);
      for (let i = 0; i < this.LFSR3_LENGTH; i++) {
        const keyIdx = (i + 8) % key.length;
        const ivIdx = (i + 4) % iv.length;
        lfsr3[i] = ((key[keyIdx] ^ iv[ivIdx]) >> (i % 8)) & 1;
      }

      // Ensure LFSRs are not all-zero
      if (lfsr1.every(bit => bit === 0)) lfsr1[0] = 1;
      if (lfsr2.every(bit => bit === 0)) lfsr2[0] = 1;
      if (lfsr3.every(bit => bit === 0)) lfsr3[0] = 1;

      return { lfsr1, lfsr2, lfsr3 };
    }

    // Step LFSR and return output bit
    stepLFSR(lfsr, taps) {
      // Calculate feedback bit
      let feedback = 0;
      for (const tap of taps) {
        feedback ^= lfsr[tap - 1]; // Convert to 0-based indexing
      }

      // Shift register
      const outputBit = lfsr[0];
      for (let i = 0; i < lfsr.length - 1; i++) {
        lfsr[i] = lfsr[i + 1];
      }
      lfsr[lfsr.length - 1] = feedback;

      return outputBit;
    }

    // Geffe combining function: f(x1,x2,x3) = (x1 ∧ x2) ⊕ (¬x1 ∧ x3)
    geffeFunction(bit1, bit2, bit3) {
      return (bit1 & bit2) ^ ((1 - bit1) & bit3);
    }

    // Generate one byte of keystream
    generateKeystreamByte(state) {
      let output = 0;

      // Generate 8 bits for one byte
      for (let bit = 0; bit < 8; bit++) {
        // Step each LFSR and get output bits
        const bit1 = this.stepLFSR(state.lfsr1, this.LFSR1_TAPS);
        const bit2 = this.stepLFSR(state.lfsr2, this.LFSR2_TAPS);
        const bit3 = this.stepLFSR(state.lfsr3, this.LFSR3_TAPS);

        // Apply Geffe combining function
        const keyBit = this.geffeFunction(bit1, bit2, bit3);

        // Add bit to output byte
        output |= keyBit << bit;
      }

      return output & 0xFF;
    }
  }

  // ===== INSTANCE IMPLEMENTATION =====

  /**
 * Geffe cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class GeffeInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];
      this.initialized = false;
      this.state = null;
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

      if (keyBytes.length !== 16) {
        throw new Error(`Geffe Generator requires exactly 16-byte keys, got ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this._initializeIfReady();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
   * Set initialization vector
   * @param {uint8[]|null} ivBytes - IV bytes or null to clear
   * @throws {Error} If IV size is invalid
   */

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
        throw new Error(`Geffe Generator requires exactly 8-byte IVs, got ${ivBytes.length} bytes`);
      }

      this._iv = [...ivBytes];
      this._initializeIfReady();
    }

    /**
   * Get copy of current IV
   * @returns {uint8[]|null} Copy of IV bytes or null
   */

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    _initializeIfReady() {
      if (this._key && this._iv) {
        this.state = this.algorithm.initializeLFSRs(this._key, this._iv);
        this.initialized = true;
      }
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
      if (!this._iv) {
        throw new Error("IV not set");
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
      if (!this._iv) {
        throw new Error("IV not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data to process");
      }
      if (!this.initialized) {
        throw new Error("Geffe Generator not properly initialized");
      }

      // Educational Geffe generator implementation
      const result = [];

      // Process each byte of input
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const keystreamByte = this.algorithm.generateKeystreamByte(this.state);
        result.push(this.inputBuffer[i] ^ keystreamByte);
      }

      // Clear input buffer
      this.inputBuffer = [];

      return result;
    }

    Clear() {
      if (this._key) {
        OpCodes.ClearArray(this._key);
      }
      if (this._iv) {
        OpCodes.ClearArray(this._iv);
      }
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];
      this.initialized = false;
      this.state = null;
    }
  }

  // ===== REGISTRATION =====

  const geffeAlgorithm = new GeffeAlgorithm();
  RegisterAlgorithm(geffeAlgorithm);

  return geffeAlgorithm;
}));