/*
 * Spritz Stream Cipher - Production Implementation
 * RC4 successor with improved security using sponge-like construction
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Spritz is a sponge-like stream cipher designed by Ron Rivest and Jacob Schuldt
 * as a successor to RC4. It uses absorb/squeeze operations similar to Keccak/SHA-3
 * with a 256-byte state array and improved mixing functions.
 *
 * SECURITY STATUS: EXPERIMENTAL - Limited cryptanalysis compared to established ciphers.
 * USE FOR: Research, experimental applications, RC4 replacement studies.
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
 * SpritzAlgorithm - Stream cipher implementation
 * @class
 * @extends {StreamCipherAlgorithm}
 */

  class SpritzAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Spritz";
      this.description = "Sponge-like stream cipher designed as RC4 successor by Rivest and Schuldt. Uses 256-byte state with absorb/squeeze operations similar to Keccak/SHA-3 construction.";
      this.inventor = "Ron Rivest, Jacob Schuldt";
      this.year = 2014;
      this.category = CategoryType.STREAM;
      this.subCategory = "Sponge-based Stream Cipher";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Algorithm-specific configuration
      this.SupportedKeySizes = [
        new KeySize(1, 256, 0)  // Variable key size 1-256 bytes
      ];
      this.SupportedNonceSizes = [
        new KeySize(0, 256, 0)  // Optional IV/nonce support
      ];

      // Documentation links
      this.documentation = [
        new LinkItem("Spritz Paper (Rivest & Schuldt)", "https://people.csail.mit.edu/rivest/pubs/RS14.pdf"),
        new LinkItem("Spritz Cryptanalysis", "https://eprint.iacr.org/2016/856.pdf"),
        new LinkItem("Rivest's Spritz Page", "https://people.csail.mit.edu/rivest/Spritz/")
      ];

      // Security vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability(
          "Limited Analysis",
          "Newer algorithm with less cryptanalytic scrutiny than established ciphers",
          "Use well-established stream ciphers for production systems"
        ),
        new Vulnerability(
          "Performance Concerns",
          "More complex than RC4 with potentially slower performance",
          "Consider performance requirements for target applications"
        )
      ];

      // Research-based test vectors
      this.tests = [
        {
          text: "Spritz Basic Test",
          uri: "Educational test case based on Rivest & Schuldt specification",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("06256ff1baf8bbdc38dcc328c9bd21dc")
        }
      ];

      // Spritz constants
      this.STATE_SIZE = 256;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SpritzInstance(this, isInverse);
    }
  }

  // Instance class implementing production-grade Spritz
  /**
 * Spritz cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SpritzInstance extends IAlgorithmInstance {
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

      // Spritz state
      this.S = new Array(this.algorithm.STATE_SIZE);  // 256-byte state
      this.i = 0;                                     // State pointer i
      this.j = 0;                                     // State pointer j
      this.k = 0;                                     // State pointer k
      this.z = 0;                                     // State pointer z
      this.a = 0;                                     // Absorb counter
      this.w = 1;                                     // Whip counter
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
      if (keyLength < 1 || keyLength > 256) {
        throw new Error(`Invalid Spritz key size: ${keyLength} bytes. Requires 1-256 bytes`);
      }

      this._key = [...keyBytes];
      this._initialize();
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
        return;
      }

      if (!Array.isArray(ivBytes)) {
        throw new Error("Invalid IV - must be byte array");
      }

      if (ivBytes.length > 256) {
        throw new Error(`Invalid Spritz IV size: ${ivBytes.length} bytes. Maximum 256 bytes`);
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
      if (this.inputBuffer.length === 0) {
        throw new Error("No data to process");
      }
      if (!this.initialized) {
        throw new Error("Spritz not properly initialized");
      }

      const output = [];

      // Process input data byte by byte (stream cipher)
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const keystreamByte = this._squeeze();
        output.push(this.inputBuffer[i] ^ keystreamByte);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }


    // Initialize Spritz cipher state
    _initialize() {
      if (!this._key) return;

      this._initializeState();
      this._absorb(this._key);

      if (this._iv && this._iv.length > 0) {
        this._absorbStop();
        this._absorb(this._iv);
      }

      this._absorbStop();
      this._shuffle();
      this.initialized = true;
    }

    // Initialize state array to identity permutation
    _initializeState() {
      this.i = 0;
      this.j = 0;
      this.k = 0;
      this.z = 0;
      this.a = 0;
      this.w = 1;

      // Initialize S to identity permutation
      for (let v = 0; v < this.algorithm.STATE_SIZE; v++) {
        this.S[v] = v;
      }
    }

    // Absorb data into state (sponge absorb phase)
    _absorb(data) {
      for (let v = 0; v < data.length; v++) {
        this._absorbByte(data[v]);
      }
    }

    // Absorb single byte
    _absorbByte(b) {
      this._absorbNibble(b & 0xF);        // Low nibble
      this._absorbNibble((b >>> 4) & 0xF); // High nibble
    }

    // Absorb single nibble (4 bits)
    _absorbNibble(x) {
      if (this.a === (this.algorithm.STATE_SIZE / 2)) {
        this._shuffle();
      }

      // Swap S[a] and S[128 + x]
      const temp = this.S[this.a];
      this.S[this.a] = this.S[128 + x];
      this.S[128 + x] = temp;

      this.a = (this.a + 1) % (this.algorithm.STATE_SIZE / 2);
    }

    // Stop absorbing (pad and transition)
    _absorbStop() {
      if (this.a === (this.algorithm.STATE_SIZE / 2)) {
        this._shuffle();
      }
      this.a = (this.a + 1) % (this.algorithm.STATE_SIZE / 2);
    }

    // Shuffle state (multiple whip operations)
    _shuffle() {
      this._whip(512);  // 2 * STATE_SIZE whips
      this._crush();
      this._whip(512);
      this._crush();
      this._whip(512);
      this.a = 0;
    }

    // Whip operation (state mixing)
    _whip(r) {
      for (let v = 0; v < r; v++) {
        this._update();
      }
      this.w = (this.w + 2) % 256;
    }

    // Crush operation (avalanche)
    _crush() {
      for (let v = 0; v < (this.algorithm.STATE_SIZE / 2); v++) {
        if (this.S[v] > this.S[this.algorithm.STATE_SIZE - 1 - v]) {
          // Swap S[v] and S[STATE_SIZE - 1 - v]
          const temp = this.S[v];
          this.S[v] = this.S[this.algorithm.STATE_SIZE - 1 - v];
          this.S[this.algorithm.STATE_SIZE - 1 - v] = temp;
        }
      }
    }

    // Update state pointers and mix
    _update() {
      this.i = (this.i + this.w) % this.algorithm.STATE_SIZE;
      this.j = (this.k + this.S[(this.j + this.S[this.i]) % this.algorithm.STATE_SIZE]) % this.algorithm.STATE_SIZE;
      this.k = (this.i + this.k + this.S[this.j]) % this.algorithm.STATE_SIZE;

      // Swap S[i] and S[j]
      const temp = this.S[this.i];
      this.S[this.i] = this.S[this.j];
      this.S[this.j] = temp;
    }

    // Drip operation (prepare for output)
    _drip() {
      if (this.a > 0) {
        this._shuffle();
      }
      this._update();
      return this._output();
    }

    // Output function
    _output() {
      this.z = this.S[(this.j + this.S[(this.i + this.S[(this.z + this.k) % this.algorithm.STATE_SIZE]) % this.algorithm.STATE_SIZE]) % this.algorithm.STATE_SIZE];
      return this.z;
    }

    // Squeeze operation (sponge squeeze phase)
    _squeeze() {
      if (this.a > 0) {
        this._shuffle();
      }
      return this._drip();
    }
  }

  // Register the algorithm
  const algorithmInstance = new SpritzAlgorithm();
  RegisterAlgorithm(algorithmInstance);

  // Return for module systems
  return { SpritzAlgorithm, SpritzInstance };
}));