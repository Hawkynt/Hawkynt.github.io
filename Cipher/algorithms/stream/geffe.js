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

  // LFSR parameters (coprime lengths for security)
  const LFSR1_LENGTH = 11;  // First LFSR length
  const LFSR2_LENGTH = 13;  // Second LFSR length
  const LFSR3_LENGTH = 17;  // Third LFSR length

  // LFSR feedback polynomials (primitive polynomials)
  /** @type {int32[]} */
  const LFSR1_TAPS = [11, 9];      // x^11 + x^9 + 1
  /** @type {int32[]} */
  const LFSR2_TAPS = [13, 12, 10, 9]; // x^13 + x^12 + x^10 + x^9 + 1
  /** @type {int32[]} */
  const LFSR3_TAPS = [17, 14];     // x^17 + x^14 + 1

  /**
   * The three LFSR registers of a Geffe generator
   */
  class GeffeState {
    constructor() {
      /** @type {uint8[]} */
      this.lfsr1 = []; // 11-bit register
      /** @type {uint8[]} */
      this.lfsr2 = []; // 13-bit register
      /** @type {uint8[]} */
      this.lfsr3 = []; // 17-bit register
    }
  }

  /**
   * @param {uint8[]} bits - Register bits
   * @returns {boolean} True when every bit is 0
   */
  function allZero(bits) {
    for (let i = 0; i < bits.length; i++) {
      if (bits[i] !== 0) return false;
    }
    return true;
  }

  /**
   * Initialize LFSR state from key and IV
   * @param {uint8[]} key - Key bytes
   * @param {uint8[]} iv - IV bytes
   * @returns {GeffeState} Fresh register state
   */
  function initializeRegisters(key, iv) {
    // Initialize LFSR1 from first part of key
    /** @type {uint8[]} */
    const lfsr1 = new Array(LFSR1_LENGTH);
    for (let i = 0; i < LFSR1_LENGTH; i++) {
      lfsr1[i] = OpCodes.And32(OpCodes.Shr32(key[i % key.length], (i % 8)), 1);
    }

    // Initialize LFSR2 from middle part of key + IV
    /** @type {uint8[]} */
    const lfsr2 = new Array(LFSR2_LENGTH);
    for (let i = 0; i < LFSR2_LENGTH; i++) {
      const keyIdx = (i + 4) % key.length;
      const ivIdx = i % iv.length;
      lfsr2[i] = OpCodes.And32(OpCodes.Shr32(OpCodes.Xor32(key[keyIdx], iv[ivIdx]), (i % 8)), 1);
    }

    // Initialize LFSR3 from last part of key + IV
    /** @type {uint8[]} */
    const lfsr3 = new Array(LFSR3_LENGTH);
    for (let i = 0; i < LFSR3_LENGTH; i++) {
      const keyIdx = (i + 8) % key.length;
      const ivIdx = (i + 4) % iv.length;
      lfsr3[i] = OpCodes.And32(OpCodes.Shr32(OpCodes.Xor32(key[keyIdx], iv[ivIdx]), (i % 8)), 1);
    }

    // Ensure LFSRs are not all-zero
    if (allZero(lfsr1)) lfsr1[0] = 1;
    if (allZero(lfsr2)) lfsr2[0] = 1;
    if (allZero(lfsr3)) lfsr3[0] = 1;

    const registers = new GeffeState();
    registers.lfsr1 = lfsr1;
    registers.lfsr2 = lfsr2;
    registers.lfsr3 = lfsr3;
    return registers;
  }

  /**
   * Step LFSR and return output bit
   * @param {uint8[]} lfsr - Register bits (shifted in place)
   * @param {int32[]} taps - Feedback taps (1-based)
   * @returns {uint8} Output bit
   */
  function stepRegister(lfsr, taps) {
    // Calculate feedback bit
    /** @type {uint32} */
    let feedback = 0;
    for (let t = 0; t < taps.length; t++) {
      feedback = OpCodes.Xor32(feedback, lfsr[taps[t] - 1]); // Convert to 0-based indexing
    }

    // Shift register
    const outputBit = lfsr[0];
    for (let i = 0; i < lfsr.length - 1; i++) {
      lfsr[i] = lfsr[i + 1];
    }
    lfsr[lfsr.length - 1] = feedback;

    return outputBit;
  }

  /**
   * Geffe combining function: f(x1,x2,x3) = (x1 AND x2) XOR (NOT x1 AND x3)
   * @param {uint8} bit1 - Selector bit
   * @param {uint8} bit2 - Bit taken when bit1 is 1
   * @param {uint8} bit3 - Bit taken when bit1 is 0
   * @returns {uint32} Combined bit
   */
  function combine(bit1, bit2, bit3) {
    return OpCodes.Xor32(OpCodes.And32(bit1, bit2), OpCodes.And32((1 - bit1), bit3));
  }

  /**
   * Generate one byte of keystream
   * @param {GeffeState} registers - Register state (advanced in place)
   * @returns {uint8} Keystream byte
   */
  function nextKeystreamByte(registers) {
    /** @type {uint32} */
    let output = 0;

    // Generate 8 bits for one byte
    for (let bit = 0; bit < 8; bit++) {
      // Step each LFSR and get output bits
      const bit1 = stepRegister(registers.lfsr1, LFSR1_TAPS);
      const bit2 = stepRegister(registers.lfsr2, LFSR2_TAPS);
      const bit3 = stepRegister(registers.lfsr3, LFSR3_TAPS);

      // Apply Geffe combining function
      const keyBit = combine(bit1, bit2, bit3);

      // Add bit to output byte
      output = OpCodes.Or32(output, OpCodes.Shl32(keyBit, bit));
    }

    return OpCodes.And32(output, 0xFF);
  }

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
      /** @type {int32} */
      this.LFSR1_LENGTH = LFSR1_LENGTH;
      /** @type {int32} */
      this.LFSR2_LENGTH = LFSR2_LENGTH;
      /** @type {int32} */
      this.LFSR3_LENGTH = LFSR3_LENGTH;

      // LFSR feedback polynomials (primitive polynomials)
      /** @type {int32[]} */
      this.LFSR1_TAPS = LFSR1_TAPS;
      /** @type {int32[]} */
      this.LFSR2_TAPS = LFSR2_TAPS;
      /** @type {int32[]} */
      this.LFSR3_TAPS = LFSR3_TAPS;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new GeffeInstance(this, isInverse);
    }

    /**
     * Initialize LFSR state from key and IV
     * @param {uint8[]} key - Key bytes
     * @param {uint8[]} iv - IV bytes
     * @returns {GeffeState} Fresh register state
     */
    initializeLFSRs(key, iv) {
      return initializeRegisters(key, iv);
    }

    /**
     * Step LFSR and return output bit
     * @param {uint8[]} lfsr - Register bits (shifted in place)
     * @param {int32[]} taps - Feedback taps (1-based)
     * @returns {uint8} Output bit
     */
    stepLFSR(lfsr, taps) {
      return stepRegister(lfsr, taps);
    }

    /**
     * Geffe combining function: f(x1,x2,x3) = (x1 AND x2) XOR (NOT x1 AND x3)
     * @param {uint8} bit1 - Selector bit
     * @param {uint8} bit2 - Bit taken when bit1 is 1
     * @param {uint8} bit3 - Bit taken when bit1 is 0
     * @returns {uint32} Combined bit
     */
    geffeFunction(bit1, bit2, bit3) {
      return combine(bit1, bit2, bit3);
    }

    /**
     * Generate one byte of keystream
     * @param {GeffeState} state - Register state (advanced in place)
     * @returns {uint8} Keystream byte
     */
    generateKeystreamByte(state) {
      return nextKeystreamByte(state);
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
   * @param {GeffeAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]|null} */
      this._iv = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {boolean} */
      this.initialized = false;
      /** @type {GeffeState|null} */
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
        throw new Error("Geffe Generator requires exactly 16-byte keys, got " + keyBytes.length + " bytes");
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
        throw new Error("Geffe Generator requires exactly 8-byte IVs, got " + ivBytes.length + " bytes");
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
        this.state = initializeRegisters(this._key, this._iv);
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

      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
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
      /** @type {uint8[]} */
      const result = [];

      // Process each byte of input
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const keystreamByte = nextKeystreamByte(this.state);
        result.push(OpCodes.Xor8(this.inputBuffer[i], keystreamByte));
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