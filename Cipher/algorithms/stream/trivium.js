/*
 * Trivium Stream Cipher - Production Implementation
 * eSTREAM finalist and ISO/IEC 29192-3 standard hardware-oriented stream cipher
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Trivium is an NLFSR-based stream cipher designed by De Cannière and Preneel.
 * It uses three interconnected nonlinear feedback shift registers:
 * - Register A: 93 bits
 * - Register B: 84 bits
 * - Register C: 111 bits
 * Total state: 288 bits (93 + 84 + 111)
 *
 * Features:
 * - 80-bit keys and 80-bit IVs
 * - 288-bit internal state
 * - Hardware-optimized design
 * - eSTREAM hardware portfolio finalist
 * - ISO/IEC 29192-3 standard
 * - Initialization: 1152 clock cycles
 *
 * SECURITY STATUS: SECURE - eSTREAM finalist and ISO standard, no known practical attacks.
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
 * TriviumAlgorithm - Stream cipher implementation
 * @class
 * @extends {StreamCipherAlgorithm}
 */

  class TriviumAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Trivium";
      this.description = "Hardware-oriented NLFSR-based stream cipher using three interconnected shift registers. eSTREAM hardware portfolio finalist and ISO/IEC 29192-3 standard with 288-bit state.";
      this.inventor = "Christophe De Cannière, Bart Preneel";
      this.year = 2005;
      this.category = CategoryType.STREAM;
      this.subCategory = "NLFSR Stream Cipher";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BE;

      // Algorithm-specific configuration
      this.SupportedKeySizes = [
        new KeySize(10, 10, 0)  // Fixed 80-bit (10 bytes) keys
      ];
      this.SupportedNonceSizes = [
        new KeySize(10, 10, 0)  // Fixed 80-bit (10 bytes) IV
      ];

      // Documentation links
      this.documentation = [
        new LinkItem("ISO/IEC 29192-3:2012 - Trivium Stream Cipher", "https://www.iso.org/standard/56426.html"),
        new LinkItem("eSTREAM Trivium Specification", "https://www.ecrypt.eu.org/stream/trivium.html"),
        new LinkItem("Trivium: A Stream Cipher Construction", "https://www.esat.kuleuven.be/cosic/publications/article-1137.pdf")
      ];

      // Security status notes
      this.knownVulnerabilities = [];

      // Official eSTREAM and ISO test vectors
      this.tests = [
        {
          text: "eSTREAM Trivium Test Vector 1 - All zeros",
          uri: "https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/trivium/",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000"),
          expected: OpCodes.Hex8ToBytes("fbe0bf265859051b")
        },
        {
          text: "eSTREAM Trivium Test Vector 2 - Standard key",
          uri: "https://www.ecrypt.eu.org/stream/trivium.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0123456789ABCDEFFEDC"),
          iv: OpCodes.Hex8ToBytes("112233445566778899AA"),
          expected: OpCodes.Hex8ToBytes("45ba46148c9df036")
        }
      ];

      // Trivium constants
      this.REGISTER_A_SIZE = 93;
      this.REGISTER_B_SIZE = 84;
      this.REGISTER_C_SIZE = 111;
      this.TOTAL_STATE_SIZE = 288;  // 93 + 84 + 111
      this.KEY_SIZE = 80;           // 80-bit key
      this.IV_SIZE = 80;            // 80-bit IV
      this.INIT_ROUNDS = 1152;      // Initialization rounds (4 * 288)
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new TriviumInstance(this, isInverse);
    }
  }

  // Instance class implementing production-grade Trivium
  /**
 * Trivium cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class TriviumInstance extends IAlgorithmInstance {
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

      // Trivium state
      this.state = new Array(this.algorithm.TOTAL_STATE_SIZE); // 288-bit state
      this.initialized = false;
    }

    // Property setter for key
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

      if (keyBytes.length !== 10) {
        throw new Error(`Invalid Trivium key size: ${keyBytes.length} bytes. Requires exactly 10 bytes (80 bits)`);
      }

      this._key = [...keyBytes];
      if (this._iv) {
        this._initialize();
      }
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property setter for IV
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

      if (ivBytes.length !== 10) {
        throw new Error(`Invalid Trivium IV size: ${ivBytes.length} bytes. Requires exactly 10 bytes (80 bits)`);
      }

      this._iv = [...ivBytes];
      if (this._key) {
        this._initialize();
      }
    }

    /**
   * Get copy of current IV
   * @returns {uint8[]|null} Copy of IV bytes or null
   */

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    // Feed data to the cipher
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

    // Get the cipher result
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
        throw new Error("Trivium not properly initialized");
      }

      const output = [];

      // Process input data byte by byte (stream cipher)
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const keystreamByte = this._generateKeystreamByte();
        output.push(this.inputBuffer[i] ^ keystreamByte);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    // Initialize Trivium cipher state
    _initialize() {
      if (!this._key || !this._iv) return;

      // Initialize all state bits to 0
      for (let i = 0; i < this.algorithm.TOTAL_STATE_SIZE; i++) {
        this.state[i] = 0;
      }

      // Load 80-bit key into positions 0-79 (register A)
      for (let i = 0; i < 80; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        this.state[i] = OpCodes.GetBit(this._key[byteIndex], bitIndex);
      }

      // Load 80-bit IV into positions 93-172 (register B)
      for (let i = 0; i < 80; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        this.state[93 + i] = OpCodes.GetBit(this._iv[byteIndex], bitIndex);
      }

      // Set the last 3 bits of register C to 1 (positions 285, 286, 287)
      this.state[285] = 1;
      this.state[286] = 1;
      this.state[287] = 1;

      // Run initialization for 1152 rounds (4 * 288)
      for (let i = 0; i < this.algorithm.INIT_ROUNDS; i++) {
        this._clockCipher();
      }

      this.initialized = true;
    }

    // Clock the Trivium cipher one step
    _clockCipher() {
      // Extract bits from specific positions
      // Register A taps: 65, 92 (output), 90, 91, 92 (feedback)
      const t1 = this.state[65] ^ this.state[92];
      const s1 = this.state[90] & this.state[91];
      const f1 = t1 ^ s1 ^ this.state[170]; // XOR with bit from register B

      // Register B taps: 161, 176 (output), 174, 175, 176 (feedback)
      const t2 = this.state[161] ^ this.state[176];
      const s2 = this.state[174] & this.state[175];
      const f2 = t2 ^ s2 ^ this.state[263]; // XOR with bit from register C

      // Register C taps: 242, 287 (output), 285, 286, 287 (feedback)
      const t3 = this.state[242] ^ this.state[287];
      const s3 = this.state[285] & this.state[286];
      const f3 = t3 ^ s3 ^ this.state[68]; // XOR with bit from register A

      // Shift registers and insert feedback
      // Shift register C (positions 177-287) - shift right
      for (let i = 287; i > 177; i--) {
        this.state[i] = this.state[i - 1];
      }
      this.state[177] = f2; // Insert feedback from register B

      // Shift register B (positions 93-176) - shift right
      for (let i = 176; i > 93; i--) {
        this.state[i] = this.state[i - 1];
      }
      this.state[93] = f1; // Insert feedback from register A

      // Shift register A (positions 0-92) - shift right
      for (let i = 92; i > 0; i--) {
        this.state[i] = this.state[i - 1];
      }
      this.state[0] = f3; // Insert feedback from register C

      // Output bit (only used during keystream generation)
      return t1 ^ t2 ^ t3;
    }

    // Generate one keystream bit
    _generateKeystreamBit() {
      return this._clockCipher();
    }

    // Generate one keystream byte (8 bits)
    _generateKeystreamByte() {
      let byte = 0;
      for (let i = 0; i < 8; i++) {
        byte = byte | (this._generateKeystreamBit() << i);  // LSB first
      }
      return byte;
    }
  }

  // Register the algorithm
  const algorithmInstance = new TriviumAlgorithm();
  RegisterAlgorithm(algorithmInstance);

  // Return for module systems
  return algorithmInstance;
}));
