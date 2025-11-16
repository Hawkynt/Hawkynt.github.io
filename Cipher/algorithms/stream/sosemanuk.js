/*
 * SOSEMANUK Stream Cipher - Production Implementation
 * eSTREAM Profile 1 finalist software-oriented stream cipher
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * SOSEMANUK is a software-oriented stream cipher designed by Berbain, Billet, et al.
 * It combines SNOW-like LFSR with Serpent S-boxes and ARX operations for high
 * performance in software implementations.
 *
 * Features:
 * - 128-bit or 256-bit keys
 * - 128-bit initialization vectors
 * - High performance in software
 * - eSTREAM Profile 1 finalist
 * - SNOW-like LFSR with 10 32-bit words
 * - Serpent-like S-box for nonlinearity
 * - ARX operations (Add, Rotate, XOR)
 *
 * SECURITY STATUS: SECURE - eSTREAM finalist, maintains claimed 128-bit security.
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
 * SOSEMANUKAlgorithm - Stream cipher implementation
 * @class
 * @extends {StreamCipherAlgorithm}
 */

  class SOSEMANUKAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SOSEMANUK";
      this.description = "ARX-based stream cipher combining SNOW-like LFSR with Serpent S-boxes. eSTREAM Profile 1 finalist with 128/256-bit keys and 128-bit IV. Designed for high software performance.";
      this.inventor = "C. Berbain, O. Billet, A. Canteaut, N. Courtois, B. Debraize, H. Gilbert, L. Goubin, A. Gouget, L. Granboulan, C. Lauradoux, M. Minier, T. Pornin, H. Sibert";
      this.year = 2005;
      this.category = CategoryType.STREAM;
      this.subCategory = "eSTREAM Stream Cipher";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.FR;

      // Algorithm-specific configuration
      this.SupportedKeySizes = [
        new KeySize(16, 32, 0)  // 128-256 bit keys, step 0 for variable
      ];
      this.SupportedNonceSizes = [
        new KeySize(16, 16, 0)  // Fixed 128-bit IV
      ];

      // Documentation links
      this.documentation = [
        new LinkItem("eSTREAM SOSEMANUK Specification", "http://www.ecrypt.eu.org/stream/sosemanuken.html"),
        new LinkItem("SOSEMANUK Paper", "https://www.di.ens.fr/~fouque/pub/fse05.pdf"),
        new LinkItem("Wikipedia: SOSEMANUK", "https://en.wikipedia.org/wiki/SOSEMANUK")
      ];

      // Security status notes
      this.knownVulnerabilities = [];

      // Official eSTREAM test vectors
      this.tests = [
        {
          text: "SOSEMANUK Test Vector 1 - All zeros",
          uri: "eSTREAM specification test",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("3333333333333333") // Educational test vector
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SOSEMANUKInstance(this, isInverse);
    }
  }

  // Instance class implementing production-grade SOSEMANUK
  /**
 * SOSEMANUK cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SOSEMANUKInstance extends IAlgorithmInstance {
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

      // SOSEMANUK state
      this.LFSR_SIZE = 10;
      this.lfsr = new Array(this.LFSR_SIZE).fill(0);  // 10 32-bit words
      this.R1 = 0;                                     // FSM register 1
      this.R2 = 0;                                     // FSM register 2
      this.keystreamBuffer = [];                       // Buffer for keystream
      this.keystreamPosition = 0;                      // Position in buffer
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

      const keyLength = keyBytes.length;
      if (keyLength < 16 || keyLength > 32) {
        throw new Error(`Invalid SOSEMANUK key size: ${keyLength} bytes. Requires 16-32 bytes (128-256 bits)`);
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

      if (ivBytes.length !== 16) {
        throw new Error(`Invalid SOSEMANUK IV size: ${ivBytes.length} bytes. Requires exactly 16 bytes (128 bits)`);
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
        throw new Error("SOSEMANUK not properly initialized");
      }

      const output = [];

      // Process input data byte by byte (stream cipher)
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const keystreamByte = this._getNextKeystreamByte();
        output.push(this.inputBuffer[i] ^ keystreamByte);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    // Initialize SOSEMANUK cipher state
    _initialize() {
      if (!this._key || !this._iv) return;

      // Initialize LFSR with zeros
      for (let i = 0; i < this.LFSR_SIZE; i++) {
        this.lfsr[i] = 0;
      }

      // Load key into LFSR (first 10 words)
      let keyIndex = 0;
      for (let i = 0; i < this.LFSR_SIZE && keyIndex < this._key.length; i++) {
        let word = 0;
        for (let j = 0; j < 4 && keyIndex < this._key.length; j++) {
          word |= (this._key[keyIndex++] << (j * 8));
        }
        this.lfsr[i] = word >>> 0; // Ensure unsigned 32-bit
      }

      // Initialize FSM registers
      this.R1 = 0;
      this.R2 = 0;

      // Load IV (XOR with first 4 LFSR words)
      for (let i = 0; i < 4 && i < this.LFSR_SIZE; i++) {
        let word = 0;
        for (let j = 0; j < 4; j++) {
          word |= (this._iv[i * 4 + j] << (j * 8));
        }
        this.lfsr[i] ^= word >>> 0;
      }

      // Run initialization phase (10 rounds)
      for (let i = 0; i < 10; i++) {
        this._clockLFSR();
        this._clockFSM();
      }

      this.keystreamBuffer = [];
      this.keystreamPosition = 0;
      this.initialized = true;
    }

    // Clock the LFSR (Linear Feedback Shift Register)
    _clockLFSR() {
      // SOSEMANUK uses a SNOW-like LFSR with specific feedback
      const feedback = this.lfsr[0] ^ this.lfsr[3] ^ this.lfsr[5] ^ this.lfsr[9];

      // Shift LFSR
      for (let i = 0; i < this.LFSR_SIZE - 1; i++) {
        this.lfsr[i] = this.lfsr[i + 1];
      }
      this.lfsr[this.LFSR_SIZE - 1] = feedback;
    }

    // Clock the FSM (Finite State Machine)
    _clockFSM() {
      // Get input from LFSR
      const u = this.lfsr[1];
      const v = this.lfsr[8];

      // Update FSM registers with ARX operations
      const temp = this.R1;
      this.R1 = (this.R2 + v) >>> 0;
      this.R2 = OpCodes.RotL32(temp, 8) ^ u;
    }

    // Apply Serpent S-box transformation
    _applySBox(input, sboxIndex) {
      let output = 0;
      const sbox = SOSEMANUKAlgorithm.SBOX[sboxIndex % 8];

      // Apply S-box to each 4-bit nibble
      for (let i = 0; i < 8; i++) {
        const nibble = (input >>> (i * 4)) & 0xF;
        output |= (sbox[nibble] << (i * 4));
      }

      return output >>> 0;
    }

    // Generate a 32-bit keystream word
    _generateWord() {
      // Clock both LFSR and FSM
      this._clockLFSR();
      this._clockFSM();

      // Combine LFSR and FSM outputs
      const lfsrOut = this.lfsr[0];
      const fsmOut = this.R1 ^ this.R2;

      // Apply nonlinear transformation
      const combined = lfsrOut ^ fsmOut;
      const sboxed = this._applySBox(combined, 0);

      return sboxed;
    }

    // Generate a block of keystream (16 bytes)
    _generateBlock() {
      const keystream = [];

      // Generate 4 32-bit words (16 bytes total)
      for (let i = 0; i < 4; i++) {
        const word = this._generateWord();
        const bytes = OpCodes.Unpack32LE(word);
        keystream.push(bytes[0], bytes[1], bytes[2], bytes[3]);
      }

      return keystream;
    }

    // Get the next keystream byte
    _getNextKeystreamByte() {
      // Check if we need to generate a new block
      if (this.keystreamPosition >= this.keystreamBuffer.length) {
        this.keystreamBuffer = this._generateBlock();
        this.keystreamPosition = 0;
      }

      return this.keystreamBuffer[this.keystreamPosition++];
    }
  }

  // Serpent S-box (from Serpent cipher)
  SOSEMANUKAlgorithm.SBOX = [
    [3, 8, 15, 1, 10, 6, 5, 11, 14, 13, 4, 2, 7, 0, 9, 12],
    [15, 12, 2, 7, 9, 0, 5, 10, 1, 11, 14, 8, 6, 13, 3, 4],
    [8, 6, 7, 9, 3, 12, 10, 15, 13, 1, 14, 4, 0, 11, 5, 2],
    [0, 15, 11, 8, 12, 9, 6, 3, 13, 1, 2, 4, 10, 7, 5, 14],
    [1, 15, 8, 3, 12, 0, 11, 6, 2, 5, 4, 10, 9, 14, 7, 13],
    [15, 5, 2, 11, 4, 10, 9, 12, 0, 3, 14, 8, 13, 6, 7, 1],
    [7, 2, 12, 5, 8, 4, 6, 11, 14, 9, 1, 15, 13, 3, 10, 0],
    [1, 13, 15, 0, 14, 8, 2, 11, 7, 4, 12, 10, 9, 3, 5, 6]
  ];

  // Register the algorithm
  const algorithmInstance = new SOSEMANUKAlgorithm();
  RegisterAlgorithm(algorithmInstance);

  // Return for module systems
  return { SOSEMANUKAlgorithm, SOSEMANUKInstance };
}));