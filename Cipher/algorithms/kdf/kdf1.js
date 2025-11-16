/*
 * KDF1 Implementation (IEEE 1363 and ISO 18033-2)
 * Educational implementation of KDF1 Key Derivation Function
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

  // ===== KDF1 (IEEE 1363) ALGORITHM IMPLEMENTATION =====

  class KDF1Algorithm extends KdfAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "KDF1";
      this.description = "KDF1 Key Derivation Function from IEEE 1363. Single-hash KDF limited to one hash block output, used primarily for compatibility with legacy systems.";
      this.inventor = "IEEE 1363 Working Group";
      this.year = 2000;
      this.category = CategoryType.KDF;
      this.subCategory = "Basic KDF";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // KDF-specific properties
      this.SaltRequired = false;
      this.SupportedOutputSizes = [1, 64]; // Limited to one hash block (max SHA-512 = 64 bytes)

      // KDF1 constants
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
        new LinkItem("Botan Library KDF1 Implementation", "https://github.com/randombit/botan/blob/master/src/lib/kdf/kdf1/kdf1.cpp")
      ];

      this.references = [
        new LinkItem("Botan KDF1 Reference Implementation", "https://github.com/randombit/botan/tree/master/src/lib/kdf/kdf1"),
        new LinkItem("Botan KDF1 Test Vectors", "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf1.vec")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Single Hash Block Limitation",
          "KDF1 (IEEE 1363) limited to single hash output - maximum 20 bytes for SHA-1, 32 for SHA-256, 64 for SHA-512"
        ),
        new Vulnerability(
          "Legacy Algorithm",
          "KDF1 provided for compatibility only. Use KDF2, HKDF, or KDF1-ISO-18033 for new systems"
        ),
        new Vulnerability(
          "Hash Function Strength",
          "Security depends on hash function choice. SHA-1 is considered weak; use SHA-256 or stronger"
        )
      ];

      // Test vectors from Botan reference implementation
      // Source: https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf1.vec
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("61736F67696A6F7367696A736F69676A736F6964676A6F696A6F736467696A736F6964676A736F6964676A736F696A"),
          [],
          "KDF1(SHA-1) Test Vector 1 - Full hash output",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf1.vec"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("61736F67696A6F7367696A736F69676A736F6964676A6F696A6F736467696A736F6964676A736F6964676A736F696A"),
          [],
          "KDF1(SHA-1) Test Vector 2 - Truncated output (10 bytes)",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf1.vec"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("61736F67696A6F7367696A736F69676A736F6964676A6F696A6F736467696A73"),
          OpCodes.Hex8ToBytes("6F6964676A736F6964676A736F696A"),
          "KDF1(SHA-1) Test Vector 3 - With salt (full output)",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf1.vec"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("61736F67696A6F7367696A736F69676A736F6964676A6F696A6F736467696A"),
          OpCodes.Hex8ToBytes("736F6964676A736F6964676A736F696A"),
          "KDF1(SHA-1) Test Vector 4 - With salt (full output, different split)",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf1.vec"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("617361736F67696A6F7367696A736F69676A736F6964676A6F696A6F736467696A736F6964676A736F6964676A736F696A0A"),
          [],
          "KDF1(SHA-1) Test Vector 5 - Full hash output with newline",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf1.vec"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("617361736F67696A6F7367696A736F69676A736F6964676A6F696A6F73646769"),
          OpCodes.Hex8ToBytes("6A736F6964676A736F6964676A736F696A0A"),
          "KDF1(SHA-1) Test Vector 6 - With salt and newline",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf1.vec"
        )
      ];

      // Configure test parameters
      this.tests[0].salt = [];
      this.tests[0].outputSize = 20;
      this.tests[0].hashFunction = 'SHA-1';
      this.tests[0].expected = OpCodes.Hex8ToBytes("A0D760447F105CE64DB99FF2FC92F961F24E7D9C");

      this.tests[1].salt = [];
      this.tests[1].outputSize = 10;
      this.tests[1].hashFunction = 'SHA-1';
      this.tests[1].expected = OpCodes.Hex8ToBytes("A0D760447F105CE64DB9");

      this.tests[2].salt = OpCodes.Hex8ToBytes("6F6964676A736F6964676A736F696A");
      this.tests[2].outputSize = 20;
      this.tests[2].hashFunction = 'SHA-1';
      this.tests[2].expected = OpCodes.Hex8ToBytes("A0D760447F105CE64DB99FF2FC92F961F24E7D9C");

      this.tests[3].salt = OpCodes.Hex8ToBytes("736F6964676A736F6964676A736F696A");
      this.tests[3].outputSize = 20;
      this.tests[3].hashFunction = 'SHA-1';
      this.tests[3].expected = OpCodes.Hex8ToBytes("A0D760447F105CE64DB99FF2FC92F961F24E7D9C");

      this.tests[4].salt = [];
      this.tests[4].outputSize = 20;
      this.tests[4].hashFunction = 'SHA-1';
      this.tests[4].expected = OpCodes.Hex8ToBytes("DBFEFA0EA12D352C4AE5B0AF17D061E0E2C469A8");

      this.tests[5].salt = OpCodes.Hex8ToBytes("6A736F6964676A736F6964676A736F696A0A");
      this.tests[5].outputSize = 20;
      this.tests[5].hashFunction = 'SHA-1';
      this.tests[5].expected = OpCodes.Hex8ToBytes("DBFEFA0EA12D352C4AE5B0AF17D061E0E2C469A8");
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new KDF1Instance(this, isInverse);
    }
  }

  // ===== KDF1-ISO-18033 ALGORITHM IMPLEMENTATION =====

  class KDF1ISO18033Algorithm extends KdfAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "KDF1-ISO-18033";
      this.description = "KDF1 Key Derivation Function from ISO/IEC 18033-2. Counter-based iterative hash KDF supporting arbitrary output lengths with 32-bit counter starting at 0.";
      this.inventor = "ISO/IEC JTC 1/SC 27";
      this.year = 2006;
      this.category = CategoryType.KDF;
      this.subCategory = "Counter-based KDF";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null; // International standard

      // KDF-specific properties
      this.SaltRequired = false;
      this.SupportedOutputSizes = [1, 2147483647]; // Up to 2GB output (limited by 32-bit counter)

      // KDF1-ISO constants
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
        new LinkItem("ISO/IEC 18033-2 - Encryption Algorithms Part 2", "https://www.iso.org/standard/69210.html"),
        new LinkItem("Botan Library KDF1-ISO-18033 Implementation", "https://github.com/randombit/botan/blob/master/src/lib/kdf/kdf1_iso18033/kdf1_iso18033.cpp")
      ];

      this.references = [
        new LinkItem("Botan KDF1-ISO-18033 Reference Implementation", "https://github.com/randombit/botan/tree/master/src/lib/kdf/kdf1_iso18033"),
        new LinkItem("Botan KDF1-ISO-18033 Test Vectors", "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf1_iso18033.vec"),
        new LinkItem("ISO 18033-2 Test Vectors (Annex C.5)", "https://www.iso.org/standard/69210.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Counter Overflow",
          "KDF1-ISO-18033 uses 32-bit counter; output limited to 2^32 hash blocks (theoretical max ~80GB for SHA-1)"
        ),
        new Vulnerability(
          "Hash Function Strength",
          "Security depends on hash function choice. SHA-1 is considered weak; use SHA-256 or stronger"
        ),
        new Vulnerability(
          "Counter Starts at Zero",
          "Unlike KDF2 which starts at 1, KDF1-ISO-18033 counter starts at 0. This is intentional per ISO spec"
        )
      ];

      // Test vectors from ISO 18033-2 Annex C.5
      // Source: https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf1_iso18033.vec
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("D6E168C5F256A2DCFF7EF12FACD390F393C7A88D"),
          [],
          "KDF1-ISO-18033(SHA-1) Test Vector C.5.1 - 107 byte output",
          "https://www.iso.org/standard/69210.html"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("B711F58766B5D696513538F03036F30E0FC11CE1CAAE38873F07DCA43127A4DEE36A6CA5970F6C06926037DE7DF79C4915D83FF705821D2C46A1FA7BB81B73E27176FEB7FD3A45E40B843F1AAEBCCB1FD4AE168ACA94F8D062951EDEC1469BFEB97B79490FA58AD1D3CCB4"),
          [],
          "KDF1-ISO-18033(SHA-1) Test Vector C.5.1 - 20 byte output (truncated)",
          "https://www.iso.org/standard/69210.html"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("D6E168C5F256A2DCFF7EF12FACD390F393C7A88D"),
          [],
          "KDF1-ISO-18033(SHA-256) Test Vector C.5.3 - 20 byte output",
          "https://www.iso.org/standard/69210.html"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("09248DA92DCF5CA8360AE7F18533A19C6BA8E99ADF79665BC31DC5A62F70535E52C53015B9D37D412FF3C1193439599E1B628774C50D9CCB78D82C425E4521EE47B8C36A4BCFFE8B8112A89312FC04432A6DB6F05118F9946C80230CD9222E0146F2CBD5251CC388A62359"),
          [],
          "KDF1-ISO-18033(SHA-256) Test Vector - 20 byte output",
          "https://www.iso.org/standard/69210.html"
        )
      ];

      // Configure test parameters
      this.tests[0].salt = [];
      this.tests[0].outputSize = 107;
      this.tests[0].hashFunction = 'SHA-1';
      this.tests[0].expected = OpCodes.Hex8ToBytes("C325EBBB41A82551D5D0AD4834870A05EF3918C8CAAE38873F07DCA43127A4DEE36A6CA5970F6C06926037DE7DF79C4915D83FF705821D2C46A1FA7BB81B73E27176FEB7FD3A45E40B843F1AAEBCCB1EF4FA7EE3B9B491A342F43EAAA435EFDED41E0A3A6EC2EFF1F2ED95");

      this.tests[1].salt = [];
      this.tests[1].outputSize = 20;
      this.tests[1].hashFunction = 'SHA-1';
      this.tests[1].expected = OpCodes.Hex8ToBytes("281D7CB2D7D5531ED1F9382152D9BE9A89A1DF09");

      this.tests[2].salt = [];
      this.tests[2].outputSize = 20;
      this.tests[2].hashFunction = 'SHA-256';
      this.tests[2].expected = OpCodes.Hex8ToBytes("0742BA966813AF75536BB6149CC44FC256FD6406");

      this.tests[3].salt = [];
      this.tests[3].outputSize = 20;
      this.tests[3].hashFunction = 'SHA-256';
      this.tests[3].expected = OpCodes.Hex8ToBytes("6F0195F38EED2417AA6EB7A365245073E58711DB");
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new KDF1ISO18033Instance(this, isInverse);
    }
  }

  // ===== KDF1 INSTANCE IMPLEMENTATION =====

  /**
 * KDF1 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class KDF1Instance extends IKdfInstance {
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
        throw new Error('KDF1Instance.Feed: Input must be byte array (shared secret)');
      }

      if (this.isInverse) {
        throw new Error('KDF1Instance.Feed: KDF1 cannot be reversed (one-way function)');
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
        throw new Error('KDF1Instance.Result: Shared secret required - use Feed() method or set secret directly');
      }

      const secret = this._secret;
      const salt = this._salt || [];
      const outputSize = this.OutputSize || 20;
      const hashFunc = this._hashFunction || 'SHA-1';

      return this.deriveKey(secret, salt, outputSize, hashFunc);
    }

    deriveKey(secret, salt, outputLength, hashFunction) {
      // KDF1 (IEEE 1363) implementation
      // Output = truncate(H(secret || salt), outputLength)
      // NOTE: Limited to single hash block

      const hashName = Array.isArray(hashFunction)
        ? String.fromCharCode(...hashFunction)
        : hashFunction;

      const hashInfo = this.algorithm.HASH_FUNCTIONS[hashName];
      if (!hashInfo) {
        throw new Error('Unsupported hash function: ' + hashName);
      }

      const hashLen = hashInfo.size;

      // KDF1 (IEEE 1363) is limited to single hash output
      if (outputLength > hashLen) {
        throw new Error('KDF1 maximum output length exceeded (limited to ' + hashLen + ' bytes for ' + hashName + ')');
      }

      // Concatenate: secret || salt (no label in KDF1 from test vectors)
      const input = OpCodes.ConcatArrays(secret, salt);

      // Compute hash
      const hash = this.hashData(input, hashFunction);

      // Truncate to requested output length
      return hash.slice(0, outputLength);
    }

    hashData(data, hashFunction) {
      const hashName = Array.isArray(hashFunction)
        ? String.fromCharCode(...hashFunction)
        : hashFunction;

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

      return this.performHash(data, actualHashName);
    }

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

    // Hash computation using Node.js crypto
    sha1(message) {
      try {
        if (typeof require !== 'undefined') {
          const crypto = require('crypto');
          const hash = crypto.createHash('sha1');
          const msgBuffer = Array.isArray(message) ? Buffer.from(message) : Buffer.from(String(message), 'utf8');
          return Array.from(hash.update(msgBuffer).digest());
        }
      } catch (e) {
        // Fallback
      }
      throw new Error('SHA-1 hash computation requires Node.js crypto module');
    }

    sha256(message) {
      try {
        if (typeof require !== 'undefined') {
          const crypto = require('crypto');
          const hash = crypto.createHash('sha256');
          const msgBuffer = Array.isArray(message) ? Buffer.from(message) : Buffer.from(String(message), 'utf8');
          return Array.from(hash.update(msgBuffer).digest());
        }
      } catch (e) {
        // Fallback
      }
      throw new Error('SHA-256 hash computation requires Node.js crypto module');
    }

    sha512(message) {
      try {
        if (typeof require !== 'undefined') {
          const crypto = require('crypto');
          const hash = crypto.createHash('sha512');
          const msgBuffer = Array.isArray(message) ? Buffer.from(message) : Buffer.from(String(message), 'utf8');
          return Array.from(hash.update(msgBuffer).digest());
        }
      } catch (e) {
        // Fallback
      }
      throw new Error('SHA-512 hash computation requires Node.js crypto module');
    }
  }

  // ===== KDF1-ISO-18033 INSTANCE IMPLEMENTATION =====

  /**
 * KDF1ISO18033 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class KDF1ISO18033Instance extends IKdfInstance {
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
        throw new Error('KDF1ISO18033Instance.Feed: Input must be byte array (shared secret)');
      }

      if (this.isInverse) {
        throw new Error('KDF1ISO18033Instance.Feed: KDF1-ISO-18033 cannot be reversed (one-way function)');
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
        throw new Error('KDF1ISO18033Instance.Result: Shared secret required - use Feed() method or set secret directly');
      }

      const secret = this._secret;
      const salt = this._salt || [];
      const outputSize = this.OutputSize || 20;
      const hashFunc = this._hashFunction || 'SHA-1';

      return this.deriveKey(secret, salt, outputSize, hashFunc);
    }

    deriveKey(secret, salt, outputLength, hashFunction) {
      // KDF1-ISO-18033 implementation based on ISO/IEC 18033-2
      // Output = H(secret || counter || salt) for counter = 0, 1, 2, ...
      // Counter is 32-bit big-endian, starting at 0

      const hashName = Array.isArray(hashFunction)
        ? String.fromCharCode(...hashFunction)
        : hashFunction;

      const hashInfo = this.algorithm.HASH_FUNCTIONS[hashName];
      if (!hashInfo) {
        throw new Error('Unsupported hash function: ' + hashName);
      }

      const hashLen = hashInfo.size;
      const numBlocks = Math.ceil(outputLength / hashLen);

      // Limit to 2^32 blocks (as per ISO 18033-2 and Botan implementation)
      if (numBlocks > 0xFFFFFFFF) {
        throw new Error('KDF1-ISO-18033 maximum output length exceeded (> 2^32 blocks)');
      }

      let output = [];

      // Generate each block using counter-based iteration
      // Counter starts at 0 (big-endian 32-bit)
      for (let counter = 0; counter < numBlocks; counter++) {
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
      // KDF1-ISO-18033 input order: secret || counter (big-endian 32-bit) || salt
      // Use OpCodes for all byte operations and array manipulation

      // Get counter as big-endian byte array using OpCodes functions
      const uint32Counter = OpCodes.ToUint32(counter);
      const counterBytes = OpCodes.Unpack32BE(uint32Counter);

      // Concatenate arrays: secret || counter || salt
      return OpCodes.ConcatArrays(secret, counterBytes, salt);
    }

    hashData(data, hashFunction) {
      const hashName = Array.isArray(hashFunction)
        ? String.fromCharCode(...hashFunction)
        : hashFunction;

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

      return this.performHash(data, actualHashName);
    }

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

    // Hash computation using Node.js crypto
    sha1(message) {
      try {
        if (typeof require !== 'undefined') {
          const crypto = require('crypto');
          const hash = crypto.createHash('sha1');
          const msgBuffer = Array.isArray(message) ? Buffer.from(message) : Buffer.from(String(message), 'utf8');
          return Array.from(hash.update(msgBuffer).digest());
        }
      } catch (e) {
        // Fallback
      }
      throw new Error('SHA-1 hash computation requires Node.js crypto module');
    }

    sha256(message) {
      try {
        if (typeof require !== 'undefined') {
          const crypto = require('crypto');
          const hash = crypto.createHash('sha256');
          const msgBuffer = Array.isArray(message) ? Buffer.from(message) : Buffer.from(String(message), 'utf8');
          return Array.from(hash.update(msgBuffer).digest());
        }
      } catch (e) {
        // Fallback
      }
      throw new Error('SHA-256 hash computation requires Node.js crypto module');
    }

    sha512(message) {
      try {
        if (typeof require !== 'undefined') {
          const crypto = require('crypto');
          const hash = crypto.createHash('sha512');
          const msgBuffer = Array.isArray(message) ? Buffer.from(message) : Buffer.from(String(message), 'utf8');
          return Array.from(hash.update(msgBuffer).digest());
        }
      } catch (e) {
        // Fallback
      }
      throw new Error('SHA-512 hash computation requires Node.js crypto module');
    }
  }

  // ===== REGISTRATION =====

  const kdf1Algorithm = new KDF1Algorithm();
  if (!AlgorithmFramework.Find(kdf1Algorithm.name)) {
    RegisterAlgorithm(kdf1Algorithm);
  }

  const kdf1ISOAlgorithm = new KDF1ISO18033Algorithm();
  if (!AlgorithmFramework.Find(kdf1ISOAlgorithm.name)) {
    RegisterAlgorithm(kdf1ISOAlgorithm);
  }

  // ===== EXPORTS =====

  return { KDF1Algorithm, KDF1Instance, KDF1ISO18033Algorithm, KDF1ISO18033Instance };
}));
