/*
 * Grain Family Stream Ciphers - AlgorithmFramework Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Consolidated implementation of the Grain family:
 * - Grain v1 (80-bit key, 64-bit IV) - eSTREAM Portfolio Profile 2
 * - Grain-128 (128-bit key, 96-bit IV) - eSTREAM Portfolio Profile 2
 *
 * The Grain family consists of hardware-oriented stream ciphers designed
 * for restricted hardware environments, combining Linear and Non-linear
 * Feedback Shift Registers with Boolean output functions.
 *
 * This implementation is based on the eSTREAM specifications and
 * Bouncy Castle reference implementation for Grain-128.
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

  // ===== GRAIN V1 IMPLEMENTATION (80-bit) =====

  /**
 * GrainV1Algorithm - Stream cipher implementation
 * @class
 * @extends {StreamCipherAlgorithm}
 */

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

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new GrainV1Instance(this, isInverse);
    }
  }

  /**
 * GrainV1 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class GrainV1Instance extends IAlgorithmInstance {
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

      // Internal state
      this.lfsr = new Array(80).fill(0);    // 80-bit LFSR state
      this.nfsr = new Array(80).fill(0);    // 80-bit NFSR state
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

      if (keyBytes.length !== 10) {
        throw new Error(`Grain v1 requires exactly 80-bit (10-byte) keys, got ${keyBytes.length} bytes`);
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
        throw new Error(`Grain v1 requires exactly 64-bit (8-byte) IVs, got ${ivBytes.length} bytes`);
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

    set nonce(nonceBytes) {
      // For compatibility, treat nonce as IV
      this.iv = nonceBytes;
    }

    get nonce() {
      return this.iv;
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
        throw new Error("Grain v1 not properly initialized");
      }

      const result = [];
      for (let i = 0; i < this.inputBuffer.length; ++i) {
        const keystreamByte = this._generateKeystreamByte();
        result.push(OpCodes.XorN(this.inputBuffer[i], keystreamByte));
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
      for (let i = 0; i < 80; ++i) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        this.nfsr[i] = OpCodes.AndN(OpCodes.Shr32(this._key[byteIndex], bitIndex), 1);
      }

      // Load IV into LFSR low 64 bits
      for (let i = 0; i < 64; ++i) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        this.lfsr[i] = OpCodes.AndN(OpCodes.Shr32(this._iv[byteIndex], bitIndex), 1);
      }

      // Fill remaining 16 LFSR bits with ones
      for (let i = 64; i < 80; ++i) {
        this.lfsr[i] = 1;
      }

      // Initialization phase - 160 rounds
      for (let round = 0; round < 160; ++round) {
        const output = this._generateOutputBit();

        // Update both registers with feedback XOR output
        const newLFSRBit = OpCodes.XorN(this._updateLFSR(), output);
        const newNFSRBit = OpCodes.XorN(this._updateNFSR(), output);

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
      return OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(this.lfsr[62], this.lfsr[51]), this.lfsr[13]), this.lfsr[0]);
    }

    /**
     * NFSR feedback function - includes linear terms from LFSR and nonlinear terms
     * @returns {number} New NFSR feedback bit
     */
    _updateNFSR() {
      // Linear terms from NFSR and LFSR
      let linear = this.nfsr[62];
      linear = OpCodes.XorN(linear, this.nfsr[60]);
      linear = OpCodes.XorN(linear, this.nfsr[52]);
      linear = OpCodes.XorN(linear, this.nfsr[45]);
      linear = OpCodes.XorN(linear, this.nfsr[37]);
      linear = OpCodes.XorN(linear, this.nfsr[33]);
      linear = OpCodes.XorN(linear, this.nfsr[28]);
      linear = OpCodes.XorN(linear, this.nfsr[21]);
      linear = OpCodes.XorN(linear, this.nfsr[14]);
      linear = OpCodes.XorN(linear, this.nfsr[9]);
      linear = OpCodes.XorN(linear, this.nfsr[0]);
      linear = OpCodes.XorN(linear, this.lfsr[63]);

      // Nonlinear terms
      let nonlinear = OpCodes.AndN(this.nfsr[63], this.nfsr[60]);
      nonlinear = OpCodes.XorN(nonlinear, OpCodes.AndN(this.nfsr[37], this.nfsr[33]));
      nonlinear = OpCodes.XorN(nonlinear, OpCodes.AndN(this.nfsr[15], this.nfsr[9]));
      nonlinear = OpCodes.XorN(nonlinear, OpCodes.AndN(OpCodes.AndN(this.nfsr[60], this.nfsr[52]), this.nfsr[45]));
      nonlinear = OpCodes.XorN(nonlinear, OpCodes.AndN(OpCodes.AndN(this.nfsr[33], this.nfsr[28]), this.nfsr[21]));
      nonlinear = OpCodes.XorN(nonlinear, OpCodes.AndN(OpCodes.AndN(OpCodes.AndN(this.nfsr[63], this.nfsr[45]), this.nfsr[28]), this.nfsr[9]));
      nonlinear = OpCodes.XorN(nonlinear, OpCodes.AndN(OpCodes.AndN(OpCodes.AndN(this.nfsr[60], this.nfsr[52]), this.nfsr[37]), this.nfsr[33]));
      nonlinear = OpCodes.XorN(nonlinear, OpCodes.AndN(OpCodes.AndN(OpCodes.AndN(this.nfsr[63], this.nfsr[60]), this.nfsr[21]), this.nfsr[15]));
      nonlinear = OpCodes.XorN(nonlinear, OpCodes.AndN(OpCodes.AndN(OpCodes.AndN(OpCodes.AndN(this.nfsr[63], this.nfsr[60]), this.nfsr[52]), this.nfsr[45]), this.nfsr[37]));
      nonlinear = OpCodes.XorN(nonlinear, OpCodes.AndN(OpCodes.AndN(OpCodes.AndN(OpCodes.AndN(this.nfsr[33], this.nfsr[28]), this.nfsr[21]), this.nfsr[15]), this.nfsr[9]));
      nonlinear = OpCodes.XorN(nonlinear, OpCodes.AndN(OpCodes.AndN(OpCodes.AndN(OpCodes.AndN(OpCodes.AndN(this.nfsr[52], this.nfsr[45]), this.nfsr[37]), this.nfsr[33]), this.nfsr[28]), this.nfsr[21]));

      return OpCodes.XorN(linear, nonlinear);
    }

    /**
     * Generate output bit using filter function
     * @returns {number} Output keystream bit
     */
    _generateOutputBit() {
      // Output filter: combines bits from LFSR and NFSR
      let lfsrBits = OpCodes.XorN(OpCodes.XorN(this.lfsr[3], this.lfsr[25]), OpCodes.XorN(this.lfsr[46], this.lfsr[64]));
      let nfsrBits = this.nfsr[63];
      nfsrBits = OpCodes.XorN(nfsrBits, this.nfsr[60]);
      nfsrBits = OpCodes.XorN(nfsrBits, this.nfsr[52]);
      nfsrBits = OpCodes.XorN(nfsrBits, this.nfsr[45]);
      nfsrBits = OpCodes.XorN(nfsrBits, this.nfsr[37]);
      nfsrBits = OpCodes.XorN(nfsrBits, this.nfsr[33]);
      nfsrBits = OpCodes.XorN(nfsrBits, this.nfsr[28]);

      // Boolean function h(x)
      const x1 = this.lfsr[25], x2 = this.lfsr[46], x3 = this.lfsr[64], x4 = this.lfsr[63];
      const x5 = this.nfsr[63];

      let h = OpCodes.XorN(x1, x4);
      h = OpCodes.XorN(h, OpCodes.AndN(x1, x3));
      h = OpCodes.XorN(h, OpCodes.AndN(x2, x3));
      h = OpCodes.XorN(h, OpCodes.AndN(x3, x4));
      h = OpCodes.XorN(h, OpCodes.AndN(OpCodes.AndN(x1, x2), x5));

      return OpCodes.XorN(OpCodes.XorN(lfsrBits, nfsrBits), h);
    }

    /**
     * Shift register left and insert new bit at position 0
     * @param {Array} register - Register to shift
     * @param {number} newBit - New bit to insert
     */
    _shiftRegister(register, newBit) {
      for (let i = 79; i > 0; --i) {
        register[i] = register[i - 1];
      }
      register[0] = OpCodes.AndN(newBit, 1);
    }

    /**
     * Generate one keystream byte (8 bits)
     * @returns {number} Keystream byte (0-255)
     */
    _generateKeystreamByte() {
      let byte = 0;

      // Generate 8 bits for one byte
      for (let bit = 0; bit < 8; ++bit) {
        const outputBit = this._generateOutputBit();
        byte = OpCodes.OrN(byte, OpCodes.Shl32(outputBit, bit));

        // Update registers for next bit
        const newLFSRBit = this._updateLFSR();
        const newNFSRBit = this._updateNFSR();

        this._shiftRegister(this.lfsr, newLFSRBit);
        this._shiftRegister(this.nfsr, newNFSRBit);
      }

      return byte;
    }
  }

  // ===== GRAIN-128 IMPLEMENTATION (128-bit) =====

  /**
 * Grain128Algorithm - Stream cipher implementation
 * @class
 * @extends {StreamCipherAlgorithm}
 */

  class Grain128Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Grain-128";
      this.description = "Hardware-oriented stream cipher using LFSR and NFSR designed for restricted hardware environments. Selected for eSTREAM Portfolio Profile 2. Uses 128-bit keys, 96-bit IVs, and 256-bit total state.";
      this.inventor = "Martin Hell, Thomas Johansson, and Willi Meier";
      this.year = 2006;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.SE;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0)  // Grain-128: 128-bit keys only (16 bytes)
      ];
      this.SupportedNonceSizes = [
        new KeySize(12, 12, 0)  // Grain-128: 96-bit IVs (12 bytes)
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("eSTREAM Grain-128 Specification", "https://www.ecrypt.eu.org/stream/grainpf.html"),
        new LinkItem("Grain-128 - A New Stream Cipher", "https://www.eit.lth.se/fileadmin/eit/courses/eit060f/Grain128.pdf"),
        new LinkItem("Bouncy Castle Reference Implementation", "https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/engines/Grain128Engine.java")
      ];

      // Test vectors from Bouncy Castle test suite
      this.tests = [
        {
          text: "Bouncy Castle Test Vector #1 - All zeros",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/Grain128Test.java",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          iv: OpCodes.Hex8ToBytes("000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("f09b7bf7d7f6b5c2de2ffc73ac21397f")
        },
        {
          text: "Bouncy Castle Test Vector #2 - Pattern key and IV",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/Grain128Test.java",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0123456789abcdef123456789abcdef0"),
          iv: OpCodes.Hex8ToBytes("0123456789abcdef12345678"),
          expected: OpCodes.Hex8ToBytes("afb5babfa8de896b4b9c6acaf7c4fbfd")
        }
      ];

      // Cipher parameters
      this.nBlockSizeInBits = 1;    // Stream cipher - 1 bit at a time
      this.nKeySizeInBits = 128;    // 128-bit key
      this.nIVSizeInBits = 96;      // 96-bit IV
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Grain128Instance(this, isInverse);
    }
  }

  /**
 * Grain128 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Grain128Instance extends IAlgorithmInstance {
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

      // Internal state - using 32-bit words like Bouncy Castle
      // 4 words of 32 bits = 128 bits total
      this.lfsr = new Array(4).fill(0);  // LFSR state (4 x 32-bit words = 128 bits)
      this.nfsr = new Array(4).fill(0);  // NFSR state (4 x 32-bit words = 128 bits)
      this.out = new Array(4).fill(0);   // Output buffer (32 bits per round)
      this.index = 4;                     // Output byte index (4 = need new round)
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

      if (keyBytes.length !== 16) {
        throw new Error(`Grain-128 requires exactly 128-bit (16-byte) keys, got ${keyBytes.length} bytes`);
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

      if (ivBytes.length !== 12) {
        throw new Error(`Grain-128 requires exactly 96-bit (12-byte) IVs, got ${ivBytes.length} bytes`);
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
        this._initializeState();
      }
    }

    _initializeState() {
      // Extend IV from 12 bytes to 16 bytes by appending 0xFFFFFFFF
      const workingIV = [...this._iv, 0xFF, 0xFF, 0xFF, 0xFF];

      // Load NFSR with key (little-endian packing)
      // Load LFSR with IV (little-endian packing)
      for (let i = 0; i < 4; ++i) {
        const j = i * 4;
        this.nfsr[i] = OpCodes.Pack32LE(
          this._key[j],
          this._key[j + 1],
          this._key[j + 2],
          this._key[j + 3]
        );
        this.lfsr[i] = OpCodes.Pack32LE(
          workingIV[j],
          workingIV[j + 1],
          workingIV[j + 2],
          workingIV[j + 3]
        );
      }

      // 256-bit initialization phase (8 rounds of 32 bits)
      for (let i = 0; i < 8; ++i) {
        const output = this._getOutput();
        const nfsrOutput = this._getOutputNFSR();
        const lfsrOutput = this._getOutputLFSR();

        // During init, output is fed back into both registers
        this.nfsr = this._shift(this.nfsr, OpCodes.XorN(OpCodes.XorN(nfsrOutput, this.lfsr[0]), output));
        this.lfsr = this._shift(this.lfsr, OpCodes.XorN(lfsrOutput, output));
      }

      this.initialized = true;
      this.index = 4; // Reset output index
    }

    // Get output from non-linear function g(x) - NFSR feedback
    _getOutputNFSR() {
      // Extract bits from NFSR using bit positions
      const b0 = this.nfsr[0];
      const b3 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[0], 3), OpCodes.Shl32(this.nfsr[1], 29)));
      const b11 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[0], 11), OpCodes.Shl32(this.nfsr[1], 21)));
      const b13 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[0], 13), OpCodes.Shl32(this.nfsr[1], 19)));
      const b17 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[0], 17), OpCodes.Shl32(this.nfsr[1], 15)));
      const b18 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[0], 18), OpCodes.Shl32(this.nfsr[1], 14)));
      const b26 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[0], 26), OpCodes.Shl32(this.nfsr[1], 6)));
      const b27 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[0], 27), OpCodes.Shl32(this.nfsr[1], 5)));
      const b40 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[1], 8), OpCodes.Shl32(this.nfsr[2], 24)));
      const b48 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[1], 16), OpCodes.Shl32(this.nfsr[2], 16)));
      const b56 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[1], 24), OpCodes.Shl32(this.nfsr[2], 8)));
      const b59 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[1], 27), OpCodes.Shl32(this.nfsr[2], 5)));
      const b61 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[1], 29), OpCodes.Shl32(this.nfsr[2], 3)));
      const b65 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[2], 1), OpCodes.Shl32(this.nfsr[3], 31)));
      const b67 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[2], 3), OpCodes.Shl32(this.nfsr[3], 29)));
      const b68 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[2], 4), OpCodes.Shl32(this.nfsr[3], 28)));
      const b84 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[2], 20), OpCodes.Shl32(this.nfsr[3], 12)));
      const b91 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[2], 27), OpCodes.Shl32(this.nfsr[3], 5)));
      const b96 = this.nfsr[3];

      // g(x) = b0 XOR b26 XOR b56 XOR b91 XOR b96 XOR b3b67 XOR b11b13 XOR b17b18
      //        XOR b27b59 XOR b40b48 XOR b61b65 XOR b68b84
      return OpCodes.ToDWord(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(b0, b26), b56), b91), b96),
        OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.AndN(b3, b67), OpCodes.AndN(b11, b13)), OpCodes.AndN(b17, b18)),
        OpCodes.XorN(OpCodes.XorN(OpCodes.AndN(b27, b59), OpCodes.AndN(b40, b48)), OpCodes.XorN(OpCodes.AndN(b61, b65), OpCodes.AndN(b68, b84))))));
    }

    // Get output from linear function f(x) - LFSR feedback
    _getOutputLFSR() {
      // Extract bits from LFSR using bit positions
      const s0 = this.lfsr[0];
      const s7 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.lfsr[0], 7), OpCodes.Shl32(this.lfsr[1], 25)));
      const s38 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.lfsr[1], 6), OpCodes.Shl32(this.lfsr[2], 26)));
      const s70 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.lfsr[2], 6), OpCodes.Shl32(this.lfsr[3], 26)));
      const s81 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.lfsr[2], 17), OpCodes.Shl32(this.lfsr[3], 15)));
      const s96 = this.lfsr[3];

      // f(x) = s0 XOR s7 XOR s38 XOR s70 XOR s81 XOR s96
      return OpCodes.ToDWord(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(s0, s7), s38), s70), s81), s96));
    }

    // Get output from output function h(x)
    _getOutput() {
      // Extract NFSR bits for output function
      const b2 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[0], 2), OpCodes.Shl32(this.nfsr[1], 30)));
      const b12 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[0], 12), OpCodes.Shl32(this.nfsr[1], 20)));
      const b15 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[0], 15), OpCodes.Shl32(this.nfsr[1], 17)));
      const b36 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[1], 4), OpCodes.Shl32(this.nfsr[2], 28)));
      const b45 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[1], 13), OpCodes.Shl32(this.nfsr[2], 19)));
      const b64 = this.nfsr[2];
      const b73 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[2], 9), OpCodes.Shl32(this.nfsr[3], 23)));
      const b89 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[2], 25), OpCodes.Shl32(this.nfsr[3], 7)));
      const b95 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.nfsr[2], 31), OpCodes.Shl32(this.nfsr[3], 1)));

      // Extract LFSR bits for output function
      const s8 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.lfsr[0], 8), OpCodes.Shl32(this.lfsr[1], 24)));
      const s13 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.lfsr[0], 13), OpCodes.Shl32(this.lfsr[1], 19)));
      const s20 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.lfsr[0], 20), OpCodes.Shl32(this.lfsr[1], 12)));
      const s42 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.lfsr[1], 10), OpCodes.Shl32(this.lfsr[2], 22)));
      const s60 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.lfsr[1], 28), OpCodes.Shl32(this.lfsr[2], 4)));
      const s79 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.lfsr[2], 15), OpCodes.Shl32(this.lfsr[3], 17)));
      const s93 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.lfsr[2], 29), OpCodes.Shl32(this.lfsr[3], 3)));
      const s94 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this.lfsr[2], 31), OpCodes.Shl32(this.lfsr[3], 1)));

      // h(x) = b12s8 XOR s13s20 XOR b95s42 XOR s60s79 XOR b12b95s94 XOR s93
      //        XOR b2 XOR b15 XOR b36 XOR b45 XOR b64 XOR b73 XOR b89
      return OpCodes.ToDWord(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.AndN(b12, s8), OpCodes.AndN(s13, s20)), OpCodes.AndN(b95, s42)), OpCodes.AndN(s60, s79)),
        OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.AndN(OpCodes.AndN(b12, b95), s94), s93), OpCodes.XorN(OpCodes.XorN(b2, b15), OpCodes.XorN(b36, b45))),
        OpCodes.XorN(OpCodes.XorN(b64, b73), b89))));
    }

    // Shift register array by 32 bits and add new value
    _shift(array, val) {
      array[0] = array[1];
      array[1] = array[2];
      array[2] = array[3];
      array[3] = OpCodes.ToDWord(val);
      return array;
    }

    // Generate one round of keystream (32 bits / 4 bytes)
    _oneRound() {
      const output = this._getOutput();

      // Store output bytes (little-endian)
      this.out[0] = OpCodes.AndN(output, 0xFF);
      this.out[1] = OpCodes.AndN(OpCodes.Shr32(output, 8), 0xFF);
      this.out[2] = OpCodes.AndN(OpCodes.Shr32(output, 16), 0xFF);
      this.out[3] = OpCodes.AndN(OpCodes.Shr32(output, 24), 0xFF);

      // Update registers (after initialization, no output feedback)
      const nfsrFeedback = OpCodes.XorN(this._getOutputNFSR(), this.lfsr[0]);
      const lfsrFeedback = this._getOutputLFSR();
      this.nfsr = this._shift(this.nfsr, nfsrFeedback);
      this.lfsr = this._shift(this.lfsr, lfsrFeedback);
    }

    // Get next keystream byte
    _getKeyStream() {
      if (this.index > 3) {
        this._oneRound();
        this.index = 0;
      }
      return this.out[this.index++];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) {
        return;
      }

      if (!this.initialized) {
        throw new Error("Grain-128 not initialized - key and IV must be set");
      }

      // Stream cipher - accumulate input
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.initialized) {
        throw new Error("Grain-128 not initialized - key and IV must be set");
      }

      if (this.inputBuffer.length === 0) {
        return [];
      }

      // XOR input with keystream
      const output = [];
      for (let i = 0; i < this.inputBuffer.length; ++i) {
        output.push(OpCodes.XorN(this.inputBuffer[i], this._getKeyStream()));
      }

      this.inputBuffer = [];
      return output;
    }

    Reset() {
      this.inputBuffer = [];
      this.index = 4;
      if (this._key && this._iv) {
        this._initializeState();
      }
    }
  }

  // Register both algorithms
  const grainV1Instance = new GrainV1Algorithm();
  if (!AlgorithmFramework.Find(grainV1Instance.name)) {
    RegisterAlgorithm(grainV1Instance);
  }

  const grain128Instance = new Grain128Algorithm();
  if (!AlgorithmFramework.Find(grain128Instance.name)) {
    RegisterAlgorithm(grain128Instance);
  }

  // Return for module systems
  return { GrainV1Algorithm, GrainV1Instance, Grain128Algorithm, Grain128Instance };
}));
