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
      this.SupportedOutputSizes = [1, 2147483647]; // Up to 2GB output

      // KDF2 constants
      this.DEFAULT_HASH = 'SHA-1';
      this.DEFAULT_OUTPUT_LENGTH = 20;
      this.HASH_FUNCTIONS = {
        'SHA-1': { size: 20, name: 'SHA-1' },
        'SHA1': { size: 20, name: 'SHA-1' },
        'SHA-256': { size: 32, name: 'SHA-256' },
        'SHA256': { size: 32, name: 'SHA-256' },
        'SHA-512': { size: 64, name: 'SHA-512' },
        'SHA512': { size: 64, name: 'SHA-512' }
      };

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

      this.tests[2].salt = [];
      this.tests[2].outputSize = 20;
      this.tests[2].hashFunction = 'SHA-1';
      this.tests[2].expected = OpCodes.Hex8ToBytes("744AB703F5BC082E59185F6D049D2D367DB245C2");
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new KDF2Instance(this, isInverse);
    }
  }

  /**
 * KDF2 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class KDF2Instance extends IKdfInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 20; // Default to SHA-1 output size
      this._salt = [];
      this._hashFunction = 'SHA-1';
      this._secret = null;
    }

    // Property getters and setters
    get salt() { return this._salt; }
    set salt(value) { this._salt = Array.isArray(value) ? value : []; }

    get outputSize() { return this.OutputSize; }
    set outputSize(value) { this.OutputSize = value; }

    get hashFunction() { return this._hashFunction; }
    set hashFunction(value) { this._hashFunction = value || 'SHA-1'; }

    get secret() { return this._secret; }
    set secret(value) { this._secret = value; }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('KDF2Instance.Feed: Input must be byte array (shared secret)');
      }

      if (this.isInverse) {
        throw new Error('KDF2Instance.Feed: KDF2 cannot be reversed (one-way function)');
      }

      // Store secret for Result() method
      this._secret = data;
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._secret) {
        throw new Error('KDF2Instance.Result: Shared secret required - use Feed() method or set secret directly');
      }

      const secret = this._secret;
      const salt = this._salt || [];
      const outputSize = this.OutputSize || 20;
      const hashFunc = this._hashFunction || 'SHA-1';

      return this.deriveKey(secret, salt, outputSize, hashFunc);
    }

    deriveKey(secret, salt, outputLength, hashFunction) {
      // KDF2 implementation based on IEEE 1363 / ISO 18033-2
      // Output = H(secret || counter || salt) for counter = 1, 2, 3, ...

      const hashName = Array.isArray(hashFunction)
        ? String.fromCharCode(...hashFunction)
        : hashFunction;

      const hashInfo = this.algorithm.HASH_FUNCTIONS[hashName];
      if (!hashInfo) {
        throw new Error('Unsupported hash function: ' + hashName);
      }

      const hashLen = hashInfo.size;
      const numBlocks = Math.ceil(outputLength / hashLen);

      // Limit to 2^32 - 2 blocks (as per Botan implementation)
      if (numBlocks > 0xFFFFFFFE) {
        throw new Error('KDF2 maximum output length exceeded (> 2^32 - 2 blocks)');
      }

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

    concatenateInputs(secret, counter, salt) {
      // KDF2 input order: secret || counter (big-endian 32-bit) || salt
      // Use OpCodes for all byte operations and array manipulation

      // Get counter as big-endian byte array using OpCodes functions
      const uint32Counter = OpCodes.ToUint32(counter);
      const counterBytes = OpCodes.Unpack32BE(uint32Counter);

      // Concatenate arrays using OpCodes for consistency
      return OpCodes.ConcatArrays(secret, counterBytes, salt);
    }

    hashData(data, hashFunction) {
      // Dynamically compute hash of data
      // This requires accessing registered hash functions from AlgorithmFramework

      const hashName = Array.isArray(hashFunction)
        ? String.fromCharCode(...hashFunction)
        : hashFunction;

      // Get the hash algorithm from the framework
      let hashAlgo = null;

      // Map hash names to algorithm names
      const hashMap = {
        'SHA-1': 'SHA-1',
        'SHA1': 'SHA-1',
        'SHA-256': 'SHA-256',
        'SHA256': 'SHA-256',
        'SHA-512': 'SHA-512',
        'SHA512': 'SHA-512'
      };

      const actualHashName = hashMap[hashName];
      if (!actualHashName) {
        throw new Error('Unsupported hash function: ' + hashName);
      }

      // Use simple hash implementations if available
      return this.performHash(data, actualHashName);
    }

    performHash(data, hashFunction) {
      // Fallback hash implementations for common functions
      // These are simple reference implementations

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

    // Hash computation using Node.js crypto or framework algorithms
    sha1(message) {
      try {
        // Try Node.js crypto first
        if (typeof require !== 'undefined') {
          const crypto = require('crypto');
          const hash = crypto.createHash('sha1');
          const msgBuffer = Array.isArray(message) ? Buffer.from(message) : Buffer.from(String(message), 'utf8');
          return Array.from(hash.update(msgBuffer).digest());
        }
      } catch (e) {
        // Fallback to framework
      }

      // Fallback: try using framework hash algorithm
      return this.computeHashWithFramework(message, 'SHA-1');
    }

    sha256(message) {
      try {
        // Try Node.js crypto first
        if (typeof require !== 'undefined') {
          const crypto = require('crypto');
          const hash = crypto.createHash('sha256');
          const msgBuffer = Array.isArray(message) ? Buffer.from(message) : Buffer.from(String(message), 'utf8');
          return Array.from(hash.update(msgBuffer).digest());
        }
      } catch (e) {
        // Fallback to framework
      }

      return this.computeHashWithFramework(message, 'SHA-256');
    }

    sha512(message) {
      try {
        // Try Node.js crypto first
        if (typeof require !== 'undefined') {
          const crypto = require('crypto');
          const hash = crypto.createHash('sha512');
          const msgBuffer = Array.isArray(message) ? Buffer.from(message) : Buffer.from(String(message), 'utf8');
          return Array.from(hash.update(msgBuffer).digest());
        }
      } catch (e) {
        // Fallback to framework
      }

      return this.computeHashWithFramework(message, 'SHA-512');
    }

    computeHashWithFramework(message, hashName) {
      // Try to use framework-registered hash algorithms
      const msgArray = Array.isArray(message) ? message : [];

      // Map hash function names to expected algorithm names in framework
      const hashAlgoMap = {
        'SHA-1': 'SHA-1',
        'SHA-256': 'SHA-256',
        'SHA-512': 'SHA-512'
      };

      const algoName = hashAlgoMap[hashName];
      if (!algoName) {
        throw new Error('Unsupported hash function: ' + hashName);
      }

      // Placeholder: in a full implementation, this would instantiate the hash algorithm
      // from the framework and use it to compute the hash
      // For now, return error to force use of Node.js crypto
      throw new Error('Hash computation requires Node.js crypto module');
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
