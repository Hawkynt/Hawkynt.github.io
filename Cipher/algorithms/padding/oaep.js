/*
 * OAEP (Optimal Asymmetric Encryption Padding) Scheme
 * Secure padding scheme for RSA encryption
 * (c)2006-2025 Hawkynt
 */

// Load AlgorithmFramework (REQUIRED)

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class OaepAlgorithm extends PaddingAlgorithm {
    constructor() {
      super();

      this.name = "OAEP";
      this.description = "OAEP (Optimal Asymmetric Encryption Padding) is a secure padding scheme for RSA encryption that provides strong security guarantees under the random oracle model. It uses a mask generation function and hash function to create randomized padding that prevents various attacks against plain RSA.";
      this.inventor = "Mihir Bellare, Phillip Rogaway";
      this.year = 1994;
      this.category = CategoryType.PADDING;
      this.subCategory = "Asymmetric Padding";
      this.securityStatus = SecurityStatus.SECURE; // Provably secure under random oracle model
      this.complexity = ComplexityType.RESEARCH;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("RFC 8017 - PKCS #1 v2.2", "https://tools.ietf.org/rfc/rfc8017.txt"),
        new LinkItem("Original OAEP Paper", "https://cseweb.ucsd.edu/~mihir/papers/oaep.pdf"),
        new LinkItem("Random Oracle Model", "https://en.wikipedia.org/wiki/Random_oracle")
      ];

      this.references = [
        new LinkItem("RSA-OAEP Security", "https://eprint.iacr.org/2001/117.pdf"),
        new LinkItem("OpenSSL OAEP Implementation", "https://github.com/openssl/openssl/blob/master/crypto/rsa/rsa_oaep.c"),
        new LinkItem("Practical Cryptography", "https://cryptopals.com/sets/6/challenges/42")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Implementation Complexity", "OAEP requires careful implementation of mask generation functions and hash operations to avoid side-channel attacks."),
        new Vulnerability("Random Oracle Assumption", "Security proofs rely on the random oracle model, which doesn't exist in practice."),
        new Vulnerability("Timing Attacks", "Improper implementation can be vulnerable to timing attacks during padding verification.")
      ];

      // Educational test vectors (simplified implementation)
      // Note: Uses deterministic seed generation for test repeatability
      // Real OAEP uses cryptographically secure random seed generation
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e11739317"), // 15-byte message
          OpCodes.Hex8ToBytes("006f74a71a747b4cf4793ce3ed2d2c48955d83635e6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b435225340716f9c8dbaabd8c9f6e714053223504455423320110ffceddacbb8a9968774655243302475621300312fdccdfaeb9889b6a75445726310049582f3e0d1cf3c2d1a0b787fea5c5a87768a098a267532d7c8de6"),
          "OAEP padding with 15-byte message (deterministic seed)",
          "Educational implementation"
        )
      ];

      // Add test parameters
      for (let i = 0; i < this.tests.length; i++) {
        /** @type {uint8[]} */
        const emptyLabel = [];
        this.tests[i].keySize = 128; // 1024-bit RSA key (128 bytes)
        this.tests[i].hashFunction = "SHA-1";
        this.tests[i].mgfFunction = "MGF1";
        this.tests[i].label = emptyLabel; // Empty label
      }
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new OaepInstance(this, isInverse);
    }
  }

  /**
 * Oaep cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class OaepInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {OaepAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {int32} */
      this._keySize = 128; // Default RSA key size in bytes (1024 bits)
      /** @type {string} */
      this._hashFunction = "SHA-1";
      /** @type {string} */
      this._mgfFunction = "MGF1";
      /** @type {uint8[]} */
      this._label = []; // Optional label (usually empty)
      /** @type {uint8[]|null} */
      this._seed = null; // Explicit seed for deterministic testing
    }

    /**
     * RSA key size in bytes
     * @returns {int32} Key size
     */
    get keySize() { return this._keySize; }

    /**
     * @param {int32} value - RSA key size in bytes (at least 64)
     */
    set keySize(value) {
      if (!value || value < 64) {
        throw new Error("RSA key size must be at least 64 bytes (512 bits)");
      }
      this._keySize = value;
    }

    /**
     * Hash function name
     * @returns {string} Hash function name
     */
    get hashFunction() { return this._hashFunction; }

    /**
     * @param {string} value - Hash function name (empty: SHA-1)
     */
    set hashFunction(value) {
      this._hashFunction = value ? value : "SHA-1";
    }

    /**
     * Mask generation function name
     * @returns {string} MGF name
     */
    get mgfFunction() { return this._mgfFunction; }

    /**
     * @param {string} value - Mask generation function name (empty: MGF1)
     */
    set mgfFunction(value) {
      this._mgfFunction = value ? value : "MGF1";
    }

    /**
     * OAEP label
     * @returns {uint8[]} Label bytes
     */
    get label() { return this._label; }

    /**
     * @param {uint8[]|null} value - Label bytes (null: empty label)
     */
    set label(value) {
      if (value) {
        this._label = value;
      } else {
        /** @type {uint8[]} */
        const emptyLabel = [];
        this._label = emptyLabel;
      }
    }

    /**
     * Set explicit seed for deterministic OAEP padding
     * When set, this seed is used instead of generating one
     * @param {uint8[]|null} seedBytes - Seed bytes for deterministic padding
     */
    set seed(seedBytes) {
      if (!seedBytes) {
        this._seed = null;
        return;
      }
      this._seed = [...seedBytes];
    }

    /**
     * @returns {uint8[]|null} Copy of the explicit seed
     */
    get seed() {
      return this._seed ? [...this._seed] : null;
    }


    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Allow empty input buffer - padding can pad zero-length data to a full block
      if (this.isInverse) {
        // For unpadding, we need data
        if (this.inputBuffer.length === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty; // Return empty array for empty input
        }
        return this._unpadOAEP();
      } else {
        // For padding, empty input is fine - it will be padded to a full block
        return this._padOAEP();
      }
    }

    /**
     * Apply OAEP padding (simplified educational implementation)
     * @returns {uint8[]} OAEP padded data
     */
    _padOAEP() {
      const message = this.inputBuffer;
      const hashLength = this._getHashLength();

      // Check message length constraints
      if (message.length > this._keySize - 2 * hashLength - 2) {
        throw new Error("Message too long for OAEP padding. Maximum length: " + (this._keySize - 2 * hashLength - 2) + " bytes");
      }

      // Step 1: Hash the label (usually empty)
      const labelHash = this._simpleHash(this._label);

      // Step 2: Generate PS (padding string of zeros)
      const paddingLength = this._keySize - message.length - 2 * hashLength - 2;
      const paddingString = OpCodes.CreateArray(paddingLength, 0);

      // Step 3: Construct DB = labelHash || PS || 0x01 || message
      const db = [...labelHash, ...paddingString, 0x01, ...message];

      // Step 4: Generate seed (use explicit seed if provided, otherwise deterministic)
      const seed = this._seed ? [...this._seed] : this._generateDeterministicSeed(hashLength, message);

      // Step 5: Generate mask for DB using MGF1
      const dbMask = this._mgf1(seed, db.length);

      // Step 6: Mask DB
      /** @type {uint8[]} */
      const maskedDB = new Array(db.length);
      for (let i = 0; i < db.length; i++) {
        maskedDB[i] = OpCodes.Xor8(db[i], dbMask[i]);
      }

      // Step 7: Generate mask for seed
      const seedMask = this._mgf1(maskedDB, hashLength);

      // Step 8: Mask seed
      /** @type {uint8[]} */
      const maskedSeed = new Array(seed.length);
      for (let i = 0; i < seed.length; i++) {
        maskedSeed[i] = OpCodes.Xor8(seed[i], seedMask[i]);
      }

      // Step 9: Construct EM = 0x00 || maskedSeed || maskedDB
      const result = [0x00, ...maskedSeed, ...maskedDB];

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      OpCodes.ClearArray(seed);
      OpCodes.ClearArray(db);
      this.inputBuffer = [];

      return result;
    }

    /**
     * Remove OAEP padding (simplified educational implementation)
     * @returns {uint8[]} Original message
     */
    _unpadOAEP() {
      const paddedMessage = this.inputBuffer;
      const hashLength = this._getHashLength();

      if (paddedMessage.length !== this._keySize) {
        throw new Error("Invalid OAEP padded message length");
      }

      if (paddedMessage[0] !== 0x00) {
        throw new Error("Invalid OAEP padding - missing leading zero");
      }

      // Extract maskedSeed and maskedDB
      const maskedSeed = paddedMessage.slice(1, 1 + hashLength);
      const maskedDB = paddedMessage.slice(1 + hashLength);

      // Unmask seed
      const seedMask = this._mgf1(maskedDB, hashLength);
      /** @type {uint8[]} */
      const seed = new Array(maskedSeed.length);
      for (let i = 0; i < maskedSeed.length; i++) {
        seed[i] = OpCodes.Xor8(maskedSeed[i], seedMask[i]);
      }

      // Unmask DB
      const dbMask = this._mgf1(seed, maskedDB.length);
      /** @type {uint8[]} */
      const db = new Array(maskedDB.length);
      for (let i = 0; i < maskedDB.length; i++) {
        db[i] = OpCodes.Xor8(maskedDB[i], dbMask[i]);
      }

      // Extract labelHash and find message
      const labelHash = this._simpleHash(this._label);
      const expectedLabelHash = db.slice(0, hashLength);

      // Verify label hash
      for (let i = 0; i < hashLength; i++) {
        if (labelHash[i] !== expectedLabelHash[i]) {
          throw new Error("Invalid OAEP padding - label hash mismatch");
        }
      }

      // Find 0x01 separator
      let separatorIndex = -1;
      for (let i = hashLength; i < db.length; i++) {
        if (db[i] === 0x01) {
          separatorIndex = i;
          break;
        } else if (db[i] !== 0x00) {
          throw new Error("Invalid OAEP padding - invalid padding string");
        }
      }

      if (separatorIndex === -1) {
        throw new Error("Invalid OAEP padding - no message separator found");
      }

      const result = db.slice(separatorIndex + 1);

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      OpCodes.ClearArray(seed);
      OpCodes.ClearArray(db);
      this.inputBuffer = [];

      return result;
    }

    /**
     * Get hash length based on hash function
     * @returns {int32} Hash length in bytes
     */
    _getHashLength() {
      switch (this._hashFunction) {
        case "SHA-1": return 20;
        case "SHA-256": return 32;
        case "SHA-384": return 48;
        case "SHA-512": return 64;
        default: return 20; // Default to SHA-1
      }
    }

    /**
     * Simple hash function (educational implementation)
     * @param {uint8[]} data - Data to hash
     * @returns {uint8[]} Hash value
     */
    _simpleHash(data) {
      const hashLength = this._getHashLength();
      /** @type {uint8[]} */
      const hash = new Array(hashLength);

      // Simple hash: XOR data in chunks and add constants
      for (let i = 0; i < hashLength; i++) {
        hash[i] = OpCodes.And32(i * 17 + 42, 0xFF); // Base pattern

        for (let j = 0; j < data.length; j++) {
          hash[i] = OpCodes.Xor8(hash[i], data[j]);
          hash[i] = OpCodes.RotL8(hash[i], 1); // Rotate left 1 bit
        }
      }

      return hash;
    }

    /**
     * Generate deterministic seed for educational/testing purposes
     * In production, use cryptographically secure random generation
     * @param {int32} length - Seed length in bytes
     * @param {uint8[]} message - Message bytes for deterministic generation
     * @returns {uint8[]} Deterministic seed
     */
    _generateDeterministicSeed(length, message) {
      /** @type {uint8[]} */
      const seed = new Array(length);
      // Use simple XOR pattern based on message for deterministic output
      for (let i = 0; i < length; i++) {
        seed[i] = OpCodes.And32(i * 23 + 17, 0xFF); // Base pattern
        if (message && message.length > 0) {
          seed[i] = OpCodes.Xor8(seed[i], message[i % message.length]);
        }
      }
      return seed;
    }

    /**
     * MGF1 mask generation function (simplified educational implementation)
     * @param {uint8[]} seed - Seed value
     * @param {int32} length - Desired mask length
     * @returns {uint8[]} Generated mask
     */
    _mgf1(seed, length) {
      /** @type {uint8[]} */
      const mask = new Array(length);
      const hashLength = this._getHashLength();

      for (let i = 0; i < length; i += hashLength) {
        const counter = Math.floor(i / hashLength);
        const counterBytes = OpCodes.Unpack32BE(counter);

        const hashInput = [...seed, ...counterBytes];
        const hash = this._simpleHash(hashInput);

        const copyLength = Math.min(hashLength, length - i);
        for (let j = 0; j < copyLength; j++) {
          mask[i + j] = hash[j];
        }
      }

      return mask;
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new OaepAlgorithm());

  // ===== EXPORTS =====

  return { OaepAlgorithm, OaepInstance };
}));