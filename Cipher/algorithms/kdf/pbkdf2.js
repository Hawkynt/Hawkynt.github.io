/*
 * PBKDF2 Implementation
 * Educational implementation of Password-Based Key Derivation Function 2
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

  class PBKDF2Algorithm extends KdfAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "PBKDF2";
      this.description = "Password-Based Key Derivation Function 2 (PBKDF2) using HMAC-SHA1 for key stretching. Converts passwords into cryptographic keys through iterative hashing. Educational implementation demonstrating key derivation principles.";
      this.inventor = "RSA Laboratories";
      this.year = 2000;
      this.category = CategoryType.KDF;
      this.subCategory = "Key Derivation Function";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // KDF-specific properties
      this.SaltRequired = true;
      this.SupportedOutputSizes = [new KeySize(1, 128, 1)]; // 1 to 128 bytes

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 2898 - PKCS #5: Password-Based Cryptography Specification", "https://tools.ietf.org/html/rfc2898"),
        new LinkItem("Wikipedia - PBKDF2", "https://en.wikipedia.org/wiki/PBKDF2"),
        new LinkItem("OWASP Password Storage", "https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html")
      ];

      this.references = [
        new LinkItem("NIST SP 800-132", "https://csrc.nist.gov/publications/detail/sp/800-132/final"),
        new LinkItem("bcrypt vs PBKDF2", "https://security.stackexchange.com/questions/4781/do-any-security-experts-recommend-bcrypt-for-password-storage"),
        new LinkItem("Python PBKDF2 Implementation", "https://docs.python.org/3/library/hashlib.html#hashlib.pbkdf2_hmac")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Timing Attacks",
          "Use constant-time comparison for password verification and sufficient iteration counts"
        ),
        new Vulnerability(
          "Insufficient Iteration Count",
          "Use minimum 100,000 iterations for 2023. Increase over time as computing power grows"
        )
      ];

      // Test vectors from RFC 6070 (PBKDF2-HMAC-SHA1)
      this.tests = [
        {
          text: "RFC 6070 Test Vector 1: password/salt, 1 iteration",
          uri: "https://tools.ietf.org/html/rfc6070",
          input: OpCodes.AnsiToBytes('password'),
          salt: OpCodes.AnsiToBytes('salt'),
          iterations: 1,
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes("0c60c80f961f0e71f3a9b524af6012062fe037a6")
        },
        {
          text: "RFC 6070 Test Vector 2: password/salt, 2 iterations",
          uri: "https://tools.ietf.org/html/rfc6070",
          input: OpCodes.AnsiToBytes('password'),
          salt: OpCodes.AnsiToBytes('salt'),
          iterations: 2,
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes("ea6c014dc72d6f8ccd1ed92ace1d41f0d8de8957")
        }
      ];
    }

    /**
   * Create new PBKDF2 instance
   * @param {boolean} [isInverse=false] - Refused by Feed: PBKDF2 has no inverse
   * @returns {PBKDF2Instance} New PBKDF2 instance
   */

    CreateInstance(isInverse = false) {
      return new PBKDF2Instance(this, isInverse);
    }
  }

  /**
 * PBKDF2 instance implementing the Feed/Result pattern
 * @class
 * @extends {IKdfInstance}
 */

  class PBKDF2Instance extends IKdfInstance {
    /**
   * Initialize a PBKDF2 instance
   * @param {PBKDF2Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Refused by Feed: PBKDF2 has no inverse
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 32; // Default 256-bit output
      this.Iterations = 100000; // Default secure iteration count
      /** @type {uint8[]} Salt (null derives with an empty salt) */
      this.salt = null;
      /** @type {uint8[]} Password set directly (null uses the fed bytes) */
      this.password = null;
      /** @type {uint8[]} Fed password bytes (null until the first Feed) */
      this._inputData = null;
    }

    // Property aliases for test vector compatibility
    /** @returns {int32} Output size in bytes */
    get outputSize() { return this.OutputSize; }
    /** @param {int32} value - Output size in bytes */
    set outputSize(value) { this.OutputSize = value; }

    /** @returns {int32} Iteration count */
    get iterations() { return this.Iterations; }
    /** @param {int32} value - Iteration count */
    set iterations(value) { this.Iterations = value; }

    /**
   * Feed password bytes
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If the input is not an array or the instance is inverse
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('PBKDF2Instance.Feed: Input must be byte array (password)');
      }

      if (this.isInverse) {
        throw new Error('PBKDF2Instance.Feed: PBKDF2 cannot be reversed (one-way function)');
      }

      // Feed is a streaming interface: successive calls extend the input rather
      // than replace it, so Feed(a); Feed(b) derives from the same octet string
      // as Feed(a || b).
      if (!this._inputData) this._inputData = [];
      for (let i = 0; i < data.length; i++) this._inputData.push(data[i]);
    }

    /**
   * Derive the key
   * @returns {uint8[]} Derived key bytes
   * @throws {Error} If neither a password was set nor data fed
   */

    Result() {
      // PBKDF2 can work with pre-set parameters or fed data
      if (!this.password && !this._inputData) {
        throw new Error('PBKDF2Instance.Result: Password required - use Feed() method or set password directly');
      }

      /** @type {uint8[]} */
      let pwd = this.password;
      if (!pwd) { pwd = this._inputData; }
      /** @type {uint8[]} */
      let slt = [];
      if (this.salt) { slt = this.salt; }
      let iter = this.Iterations;
      if (!iter) { iter = 4096; }
      let outSize = this.OutputSize;
      if (!outSize) { outSize = 32; }

      return this.deriveKey(pwd, slt, iter, outSize);
    }

    /**
     * PBKDF2-HMAC-SHA1 (RFC 8018 section 5.2)
     * @param {uint8[]} password - Password bytes
     * @param {uint8[]} salt - Salt bytes
     * @param {int32} iterations - Iteration count
     * @param {int32} outputSize - Derived key length in bytes
     * @returns {uint8[]} Derived key
     */
    deriveKey(password, salt, iterations, outputSize) {
      const hLen = 20; // SHA1 output size (using HMAC-SHA1 per RFC 6070)
      const l = Math.ceil(outputSize / hLen);
      const r = outputSize - (l - 1) * hLen;

      /** @type {uint8[]} */
      let derivedKey = [];

      for (let i = 1; i <= l; i++) {
        const block = this.F(password, salt, iterations, i);

        if (i < l) {
          derivedKey = derivedKey.concat(block);
        } else {
          // Last block - only take r bytes
          derivedKey = derivedKey.concat(block.slice(0, r));
        }
      }

      return derivedKey;
    }

    /**
     * F(P, S, c, i) = U_1 XOR U_2 XOR ... XOR U_c
     * @param {uint8[]} password - Password bytes
     * @param {uint8[]} salt - Salt bytes
     * @param {int32} iterations - Iteration count
     * @param {int32} blockNumber - One-based block index i
     * @returns {uint8[]} Block T_i
     */
    F(password, salt, iterations, blockNumber) {
      // U_1 = PRF(P, S || INT(i))
      /** @type {uint8[]} */
      const saltPlusI = salt.concat(this.intToBytes(blockNumber));
      let U = this.hmacSha1(password, saltPlusI);
      let result = U.slice();

      // U_2 through U_c
      for (let j = 2; j <= iterations; j++) {
        U = this.hmacSha1(password, U);
        result = OpCodes.XorArrays(result, U);
      }

      return result;
    }

    /**
     * HMAC-SHA1 (RFC 2104)
     * @param {uint8[]} key - HMAC key
     * @param {uint8[]} data - Message
     * @returns {uint8[]} 20-byte MAC
     */
    hmacSha1(key, data) {
      // HMAC(K, M) = H((K xor opad) || H((K xor ipad) || M))

      const blockSize = 64; // SHA-1 block size
      const opad = 0x5C;
      const ipad = 0x36;

      // If key is longer than block size, hash it
      let keyBytes = key.slice();
      if (keyBytes.length > blockSize) {
        keyBytes = this.sha1(keyBytes);
      }

      // Pad key to block size
      while (keyBytes.length < blockSize) {
        keyBytes.push(0);
      }

      // Create inner and outer padded keys
      /** @type {uint8[]} */
      const innerKey = keyBytes.map(b => OpCodes.Xor8(b, ipad));
      /** @type {uint8[]} */
      const outerKey = keyBytes.map(b => OpCodes.Xor8(b, opad));

      // HMAC = H(outer_key || H(inner_key || data))
      const innerHash = this.sha1(innerKey.concat(data));
      return this.sha1(outerKey.concat(innerHash));
    }

    /**
     * SHA-1 digest with the registered SHA-1. Registry-first: Find() is
     * checked before require() loads the module (CommonJS only; an AMD or
     * browser loader cannot require synchronously, and the page loads SHA-1).
     * @param {uint8[]} data - Message
     * @returns {uint8[]} 20-byte digest
     * @throws {Error} If SHA-1 is not registered
     */
    sha1(data) {
      let sha1Alg = AlgorithmFramework.Find('SHA-1');
      if (!sha1Alg && typeof module !== 'undefined' && typeof require !== 'undefined') {
        require('../hash/sha1.js');
        sha1Alg = AlgorithmFramework.Find('SHA-1');
      }
      if (!sha1Alg) {
        throw new Error('PBKDF2Instance.sha1: SHA-1 is not registered. Load it before PBKDF2');
      }

      /** @type {IHashFunctionInstance} */
      const hashInstance = sha1Alg.CreateInstance();
      hashInstance.Feed(data);
      /** @type {uint8[]} */
      const digest = hashInstance.Result();
      return digest;
    }

    /**
     * INT(i): four-byte big-endian block index
     * @param {uint32} value - Block index
     * @returns {uint8[]} Four bytes
     */
    intToBytes(value) {
      return OpCodes.Unpack32BE(value);
    }

    // Configuration methods
    /**
     * Set the salt
     * @param {uint8[]} salt - Salt bytes
     * @returns {void}
     */
    setSalt(salt) {
      this.salt = salt;
    }

    /**
     * Set the iteration count (warns below 1000)
     * @param {int32} iterations - Iteration count
     * @returns {void}
     */
    setIterations(iterations) {
      if (iterations < 1000) {
        console.warn('PBKDF2: Low iteration count may be insecure');
      }
      this.Iterations = iterations;
    }

    /**
     * Set the derived key length (warns below 16)
     * @param {int32} size - Output size in bytes
     * @returns {void}
     */
    setOutputSize(size) {
      if (size < 16) {
        console.warn('PBKDF2: Small output size may be insecure');
      }
      this.OutputSize = size;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new PBKDF2Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { PBKDF2Algorithm, PBKDF2Instance };
}));