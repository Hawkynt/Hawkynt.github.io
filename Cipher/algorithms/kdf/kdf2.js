/*
 * KDF2 Implementation
 * Educational implementation of KDF2 (IEEE 1363, ISO/IEC 18033)
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

  // Load required hash functions
  if (typeof require !== 'undefined') {
    try {
      require('../hash/sha1.js');
      require('../hash/sha256.js');
      require('../hash/sha512.js');
    } catch (e) {
      // Hash functions may already be loaded or unavailable
    }
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

  class KDF2Algorithm extends KdfAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "KDF2";
      this.description = "KDF2 Key Derivation Function as defined in IEEE 1363 and ISO/IEC 18033-2. Iterative hash-based KDF using a counter to generate cryptographic keys from shared secrets using optional salt.";
      this.inventor = "IEEE 1363, ISO/IEC 18033";
      this.year = 2000;
      this.category = CategoryType.KDF;
      this.subCategory = "Counter-based KDF";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // KDF-specific properties
      this.SaltRequired = false;
      this.SupportedOutputSizes = [new KeySize(1, 2147483647, 1)]; // Up to 2GB output

      // KDF2 constants
      this.DEFAULT_HASH = 'SHA-1';
      this.DEFAULT_OUTPUT_LENGTH = 20;

      // Documentation and references
      this.documentation = [
        new LinkItem("IEEE 1363 - Standard Specifications for Public Key Cryptography", "https://standards.ieee.org/ieee/1363/6171/"),
        new LinkItem("ISO/IEC 18033-2 - Encryption Algorithms Part 2", "https://www.iso.org/standard/69210.html"),
        new LinkItem("Botan Library KDF2 Implementation", "https://github.com/randombit/botan/blob/master/src/lib/kdf/kdf2/kdf2.cpp")
      ];

      this.references = [
        new LinkItem("Botan KDF2 Reference Implementation", "https://github.com/randombit/botan/tree/master/src/lib/kdf/kdf2"),
        new LinkItem("Botan KDF2 Test Vectors", "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf2.vec")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Hash Function Strength",
          "KDF2 security depends on the chosen hash function. SHA-1 is considered weak; use SHA-256 or stronger."
        ),
        new Vulnerability(
          "Counter Overflow",
          "KDF2 uses 32-bit counter; output limited to 2^32 - 1 hash blocks (approx 16GB for SHA-1)"
        ),
        new Vulnerability(
          "Salt Usage",
          "Unlike HKDF, KDF2 treats salt as optional input rather than domain separation parameter"
        )
      ];

      // Test vectors from Botan reference implementation (SHA-1)
      // KDF2 is a one-way function, so we test actual outputs from reference implementation
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("FD7A43EA8A443C580C0DE618ECC013704505EFF8B5A4A9"),
          OpCodes.Hex8ToBytes("BF0B2ECD1724A348211D8C0CA7"),
          "KDF2(SHA-1) Test Vector 1 - 1 byte output",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf2.vec"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("701F3480DFE95F57941F804B1B2413EF"),
          OpCodes.Hex8ToBytes("55A4E9DD5F4CA2EF82"),
          "KDF2(SHA-1) Test Vector 2 - 2 byte output",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf2.vec"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("CA7C0F8C3FFA87A96E1B74AC8E6AF594347BB40A"),
          [],
          "KDF2(SHA-1) BouncyCastle Test Vector - full block (no salt)",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf2.vec"
        )
      ];

      // Configure test parameters
      this.tests[0].salt = OpCodes.Hex8ToBytes("BF0B2ECD1724A348211D8C0CA7");
      this.tests[0].outputSize = 1;
      this.tests[0].hashFunction = 'SHA-1';
      this.tests[0].expected = OpCodes.Hex8ToBytes("79");

      this.tests[1].salt = OpCodes.Hex8ToBytes("55A4E9DD5F4CA2EF82");
      this.tests[1].outputSize = 2;
      this.tests[1].hashFunction = 'SHA-1';
      this.tests[1].expected = OpCodes.Hex8ToBytes("FBEC");

      this.tests[2].salt = OpCodes.Hex8ToBytes('');
      this.tests[2].outputSize = 20;
      this.tests[2].hashFunction = 'SHA-1';
      this.tests[2].expected = OpCodes.Hex8ToBytes("744AB703F5BC082E59185F6D049D2D367DB245C2");
    }

    /**
   * Create new KDF2 instance
   * @param {boolean} [isInverse=false] - Refused by Feed: KDF2 has no inverse
   * @returns {KDF2Instance} New KDF2 instance
   */

    CreateInstance(isInverse = false) {
      return new KDF2Instance(this, isInverse);
    }
  }

  /**
 * KDF2 instance implementing the Feed/Result pattern
 * @class
 * @extends {IKdfInstance}
 */

  class KDF2Instance extends IKdfInstance {
    /**
   * Initialize a KDF2 instance
   * @param {KDF2Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Refused by Feed: KDF2 has no inverse
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 20; // Default to SHA-1 output size
      /** @type {uint8[]} */
      this._salt = [];
      /** @type {string} */
      this._hashFunction = 'SHA-1';
      /** @type {uint8[]} Shared secret (null until fed or set) */
      this._secret = null;
    }

    // Property getters and setters
    /** @returns {uint8[]} Salt */
    get salt() { return this._salt; }
    /** @param {uint8[]} value - Salt (anything but an array clears it) */
    set salt(value) {
      if (Array.isArray(value)) { this._salt = value; } else { this._salt = []; }
    }

    /** @returns {int32} Output size in bytes */
    get outputSize() { return this.OutputSize; }
    /** @param {int32} value - Output size in bytes */
    set outputSize(value) { this.OutputSize = value; }

    /** @returns {string} Hash name */
    get hashFunction() { return this._hashFunction; }
    /** @param {string} value - Hash name (empty selects SHA-1) */
    set hashFunction(value) {
      if (value) { this._hashFunction = value; } else { this._hashFunction = 'SHA-1'; }
    }

    /** @returns {uint8[]} Shared secret */
    get secret() { return this._secret; }
    /** @param {uint8[]} value - Shared secret */
    set secret(value) { this._secret = value; }

    /**
   * Feed shared secret bytes
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If the input is not an array or the instance is inverse
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('KDF2Instance.Feed: Input must be byte array (shared secret)');
      }

      if (this.isInverse) {
        throw new Error('KDF2Instance.Feed: KDF2 cannot be reversed (one-way function)');
      }

      // Feed is a streaming interface: successive calls extend the input rather
      // than replace it, so Feed(a); Feed(b) derives from the same octet string
      // as Feed(a || b).
      if (!this._secret) this._secret = [];
      for (let i = 0; i < data.length; i++) this._secret.push(data[i]);
    }

    /**
   * Derive the key
   * @returns {uint8[]} Derived key bytes
   * @throws {Error} If no secret was fed or set, or the hash is unsupported
   */

    Result() {
      if (!this._secret) {
        throw new Error('KDF2Instance.Result: Shared secret required - use Feed() method or set secret directly');
      }

      const secret = this._secret;
      /** @type {uint8[]} */
      let salt = [];
      if (this._salt) { salt = this._salt; }
      let outputSize = this.OutputSize;
      if (!outputSize) { outputSize = 20; }
      let hashFunc = this._hashFunction;
      if (!hashFunc) { hashFunc = 'SHA-1'; }

      return this.deriveKey(secret, salt, outputSize, hashFunc);
    }

    /**
     * KDF2 (IEEE 1363 / ISO 18033-2): H(secret || counter || salt) for counter = 1, 2, ...
     * @param {uint8[]} secret - Shared secret
     * @param {uint8[]} salt - Salt / other info
     * @param {int32} outputLength - Output length in bytes
     * @param {string} hashFunction - Hash name
     * @returns {uint8[]} Derived key
     * @throws {Error} If the hash is unsupported
     */
    deriveKey(secret, salt, outputLength, hashFunction) {
      const hashName = hashFunction;
      const hashLen = this.hashSize(hashName);
      const numBlocks = Math.ceil(outputLength / hashLen);

      // Limit to 2^32 - 2 blocks (as per Botan implementation)
      if (numBlocks > 0xFFFFFFFE) {
        throw new Error('KDF2 maximum output length exceeded (> 2^32 - 2 blocks)');
      }

      /** @type {uint8[]} */
      let output = [];

      // Generate each block using counter-based iteration
      // Counter starts at 1 (big-endian 32-bit)
      for (let counter = 1; counter <= numBlocks; counter++) {
        const blockData = this.concatenateInputs(secret, counter, salt);
        const blockHash = this.hashData(blockData, hashFunction);

        if (output.length + blockHash.length <= outputLength) {
          output = output.concat(blockHash);
        } else {
          // Partial block for final iteration
          const remaining = outputLength - output.length;
          output = output.concat(blockHash.slice(0, remaining));
        }
      }

      return output.slice(0, outputLength);
    }

    /**
     * secret || counter (big-endian 32-bit) || salt
     * @param {uint8[]} secret - Shared secret
     * @param {int32} counter - Block counter
     * @param {uint8[]} salt - Salt / other info
     * @returns {uint8[]} Hash input
     */
    concatenateInputs(secret, counter, salt) {
      // Get counter as big-endian byte array using OpCodes functions
      const uint32Counter = OpCodes.ToUint32(counter);
      const counterBytes = OpCodes.Unpack32BE(uint32Counter);

      // Concatenate arrays using OpCodes for consistency
      // ConcatArrays takes an array of arrays as single argument
      return OpCodes.ConcatArrays([secret, counterBytes, salt]);
    }

    /**
     * Digest length of a supported hash
     * @param {string} hashName - SHA-1, SHA-256 or SHA-512 (dash optional)
     * @returns {int32} Digest size in bytes
     * @throws {Error} If the hash is unsupported
     */
    hashSize(hashName) {
      switch (hashName) {
        case 'SHA-1': case 'SHA1': return 20;
        case 'SHA-256': case 'SHA256': return 32;
        case 'SHA-512': case 'SHA512': return 64;
        default: throw new Error('Unsupported hash function: ' + hashName);
      }
    }

    /**
     * Name the framework registers a supported hash under
     * @param {string} hashName - SHA-1, SHA-256 or SHA-512 (dash optional)
     * @returns {string} Registered name
     * @throws {Error} If the hash is unsupported
     */
    registeredHashName(hashName) {
      switch (hashName) {
        case 'SHA-1': case 'SHA1': return 'SHA-1';
        case 'SHA-256': case 'SHA256': return 'SHA-256';
        case 'SHA-512': case 'SHA512': return 'SHA-512';
        default: throw new Error('Unsupported hash function: ' + hashName);
      }
    }

    /**
     * Hash with a supported hash
     * @param {uint8[]} data - Message
     * @param {string} hashFunction - Hash name
     * @returns {uint8[]} Digest
     * @throws {Error} If the hash is unsupported or unavailable
     */
    hashData(data, hashFunction) {
      return this.performHash(data, this.registeredHashName(hashFunction));
    }

    /**
     * Dispatch to the digest of a registered hash name
     * @param {uint8[]} data - Message
     * @param {string} hashFunction - SHA-1, SHA-256 or SHA-512
     * @returns {uint8[]} Digest
     * @throws {Error} If the hash is not one of those
     */
    performHash(data, hashFunction) {
      if (hashFunction === 'SHA-1') {
        return this.sha1(data);
      } else if (hashFunction === 'SHA-256') {
        return this.sha256(data);
      } else if (hashFunction === 'SHA-512') {
        return this.sha512(data);
      } else {
        throw new Error('Hash function not available: ' + hashFunction);
      }
    }

    // Hash computation using Node.js crypto (CommonJS only) or framework algorithms
    /**
     * SHA-1 digest
     * @param {uint8[]} message - Message
     * @returns {uint8[]} 20-byte digest
     */
    sha1(message) {
      if (typeof module !== 'undefined' && typeof require !== 'undefined') {
        const crypto = require('crypto');
        return Array.from(crypto.createHash('sha1').update(Buffer.from(message)).digest());
      }

      // Fallback: try using framework hash algorithm
      return this.computeHashWithFramework(message, 'SHA-1');
    }

    /**
     * SHA-256 digest
     * @param {uint8[]} message - Message
     * @returns {uint8[]} 32-byte digest
     */
    sha256(message) {
      if (typeof module !== 'undefined' && typeof require !== 'undefined') {
        const crypto = require('crypto');
        return Array.from(crypto.createHash('sha256').update(Buffer.from(message)).digest());
      }

      return this.computeHashWithFramework(message, 'SHA-256');
    }

    /**
     * SHA-512 digest
     * @param {uint8[]} message - Message
     * @returns {uint8[]} 64-byte digest
     */
    sha512(message) {
      if (typeof module !== 'undefined' && typeof require !== 'undefined') {
        const crypto = require('crypto');
        return Array.from(crypto.createHash('sha512').update(Buffer.from(message)).digest());
      }

      return this.computeHashWithFramework(message, 'SHA-512');
    }

    /**
     * Digest with a framework-registered hash
     * @param {uint8[]} message - Message
     * @param {string} hashName - SHA-1, SHA-256 or SHA-512
     * @returns {uint8[]} Digest
     * @throws {Error} If the hash is unsupported or not registered
     */
    computeHashWithFramework(message, hashName) {
      if (hashName !== 'SHA-1' && hashName !== 'SHA-256' && hashName !== 'SHA-512') {
        throw new Error('Unsupported hash function: ' + hashName);
      }
      const algoName = hashName;

      // Try to use framework-registered hash algorithms
      const hashAlgo = AlgorithmFramework.Find(algoName);
      if (hashAlgo) {
        /** @type {IHashFunctionInstance} */
        const instance = hashAlgo.CreateInstance(false);
        if (instance) {
          instance.Feed(message);
          /** @type {uint8[]} */
          const digest = instance.Result();
          return digest;
        }
      }

      throw new Error('Hash algorithm ' + algoName + ' not available. Ensure hash algorithms are loaded before KDF2.');
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new KDF2Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { KDF2Algorithm, KDF2Instance };
}));
