/*
 * RC4 Stream Cipher - Production Implementation
 * DEPRECATED: Cryptographically broken and prohibited (RFC 7465)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * WARNING: RC4 is cryptographically broken and officially deprecated.
 * Statistical biases, related-key attacks, and broadcast vulnerabilities exist.
 * DO NOT USE for any security-sensitive applications.
 *
 * RC4 is a variable-key-size stream cipher using:
 * - Key Scheduling Algorithm (KSA) for S-box initialization
 * - Pseudo-Random Generation Algorithm (PRGA) for keystream generation
 * - 256-byte internal state (S-box)
 * - Two index pointers (i, j)
 *
 * SECURITY STATUS: BROKEN - Deprecated by RFC 7465, vulnerable to multiple attacks.
 * USE ONLY FOR: Legacy compatibility, historical analysis, protocol reverse engineering.
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
 * RC4Algorithm - Stream cipher implementation
 * @class
 * @extends {StreamCipherAlgorithm}
 */

  class RC4Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "RC4";
      this.description = "Variable-key-size stream cipher using 256-byte internal state with KSA and PRGA algorithms. BROKEN - deprecated by RFC 7465 due to statistical biases and related-key attacks.";
      this.inventor = "Ron Rivest";
      this.year = 1987;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // Algorithm-specific configuration
      this.SupportedKeySizes = [
        new KeySize(1, 256, 0)  // RC4 supports 1-256 byte keys, step 0 for variable
      ];
      this.SupportedNonceSizes = [
        new KeySize(0, 0, 0)    // RC4 does not use nonce/IV
      ];

      // Documentation links
      this.documentation = [
        new LinkItem("RFC 6229: Test Vectors for RC4", "https://tools.ietf.org/html/rfc6229"),
        new LinkItem("RFC 7465: Prohibiting RC4 Cipher Suites", "https://tools.ietf.org/html/rfc7465"),
        new LinkItem("Applied Cryptography: RC4 Analysis", "https://www.schneier.com/academic/paperfiles/paper-rc4.pdf")
      ];

      // Security vulnerabilities (CRITICAL)
      this.knownVulnerabilities = [
        new Vulnerability(
          "Statistical Biases",
          "RC4 keystream contains detectable statistical biases exploitable in various attack scenarios",
          "DO NOT USE - Use ChaCha20 or AES-GCM instead"
        ),
        new Vulnerability(
          "Related-Key Attacks",
          "Vulnerable to attacks when keys share common prefixes or patterns (WEP vulnerability)",
          "DO NOT USE - Algorithm fundamentally broken"
        ),
        new Vulnerability(
          "Broadcast Attacks",
          "Statistical analysis of multiple ciphertexts can recover plaintext patterns",
          "DO NOT USE - Officially deprecated by RFC 7465"
        )
      ];

      // Official RFC 6229 test vectors
      this.tests = [
        {
          text: "RFC 6229 Test Vector (40-bit key)",
          uri: "https://tools.ietf.org/html/rfc6229#section-2",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0102030405"),
          expected: OpCodes.Hex8ToBytes("b2396305f03dc027")
        },
        {
          text: "RFC 6229 Test Vector (128-bit key)",
          uri: "https://tools.ietf.org/html/rfc6229#section-2",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("9ac7cc9a609d1ef7")
        },
        {
          text: "RFC 6229 Test Vector (256-bit key)",
          uri: "https://tools.ietf.org/html/rfc6229#section-2",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("eaa6bd25880bf93d")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new RC4Instance(this, isInverse);
    }
  }

  // Instance class implementing production-grade RC4
  /**
 * RC4 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class RC4Instance extends IAlgorithmInstance {
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

      // RC4 state
      this.S = new Array(256);  // S-box permutation
      this.i = 0;               // PRGA counter i
      this.j = 0;               // PRGA counter j
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
        throw new Error(`Invalid RC4 key size: ${keyLength} bytes. Requires 1-256 bytes`);
      }

      this._key = [...keyBytes];
      this._initializeRC4();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    set iv(ivData) {
      // RC4 doesn't traditionally use IV, but store for compatibility
      this._iv = ivData;
    }

    /**
   * Get copy of current IV
   * @returns {uint8[]|null} Copy of IV bytes or null
   */

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    set nonce(nonceData) {
      this.iv = nonceData;
    }

    get nonce() {
      return this.iv;
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
        throw new Error("RC4 not properly initialized");
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

    // Initialize RC4 with Key Scheduling Algorithm (KSA)
    _initializeRC4() {
      if (!this._key) return;

      // Step 1: Initialize S-box with identity permutation
      for (let i = 0; i < 256; i++) {
        this.S[i] = i;
      }

      // Step 2: Use key to scramble S-box (KSA)
      let j = 0;
      for (let i = 0; i < 256; i++) {
        j = (j + this.S[i] + this._key[i % this._key.length]) & 0xFF;

        // Swap S[i] and S[j]
        const temp = this.S[i];
        this.S[i] = this.S[j];
        this.S[j] = temp;
      }

      // Reset PRGA counters
      this.i = 0;
      this.j = 0;
      this.initialized = true;
    }

    // Pseudo-Random Generation Algorithm (PRGA) - generate one keystream byte
    _generateKeystreamByte() {
      // Increment i
      this.i = (this.i + 1) & 0xFF;

      // Update j
      this.j = (this.j + this.S[this.i]) & 0xFF;

      // Swap S[i] and S[j]
      const temp = this.S[this.i];
      this.S[this.i] = this.S[this.j];
      this.S[this.j] = temp;

      // Calculate and return keystream byte
      const t = (this.S[this.i] + this.S[this.j]) & 0xFF;
      return this.S[t];
    }
  }

  // Register the algorithm
  const algorithmInstance = new RC4Algorithm();
  RegisterAlgorithm(algorithmInstance);

  // Return for module systems
  return { RC4Algorithm, RC4Instance };
}));