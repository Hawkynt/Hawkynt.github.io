/*
 * TLS-PRF (TLS Pseudorandom Function) Implementation
 * Production-ready implementation of TLS key derivation functions
 * (c)2006-2025 Hawkynt
 *
 * Implements:
 * - TLS 1.0/1.1 PRF (RFC 2246) using MD5+SHA-1 hybrid
 * - TLS 1.2 PRF (RFC 5246) using HMAC with configurable hash
 *
 * Reference: Botan library implementation
 * https://github.com/randombit/botan/blob/master/src/lib/kdf/prf_tls/prf_tls.cpp
 */

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

  // Pre-load required hash functions and HMAC
  if (typeof require !== 'undefined') {
    try {
      require('../hash/md.js');        // MD5
      require('../hash/sha1.js');      // SHA-1
      require('../hash/sha256.js');    // SHA-224, SHA-256
      require('../hash/sha512.js');    // SHA-384, SHA-512
      require('../mac/hmac.js');       // HMAC
    } catch (loadError) {
      // Dependencies might already be loaded or will be loaded by test framework
    }
  }

  // ===== TLS 1.0/1.1 PRF IMPLEMENTATION =====

  class TLSPRFAlgorithm extends KdfAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "TLS-PRF";
      this.description = "TLS 1.0/1.1 Pseudorandom Function using MD5 and SHA-1 in parallel. Derives keying material from secrets, labels, and seeds for SSL/TLS protocol handshakes. Uses P_hash construction with XOR combination.";
      this.inventor = "IETF TLS Working Group";
      this.year = 1999;
      this.category = CategoryType.KDF;
      this.subCategory = "Key Derivation Function";
      this.securityStatus = SecurityStatus.DEPRECATED; // Uses MD5 and SHA-1
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // KDF-specific properties
      this.SaltRequired = true; // Salt is used for seed
      this.SupportedOutputSizes = [new KeySize(1, 1024, 1)]; // Arbitrary output length

      // Documentation links
      this.documentation = [
        new LinkItem("RFC 2246 - TLS 1.0 Protocol", "https://tools.ietf.org/rfc/rfc2246.txt"),
        new LinkItem("RFC 4346 - TLS 1.1 Protocol", "https://tools.ietf.org/rfc/rfc4346.txt"),
        new LinkItem("Botan TLS-PRF Implementation", "https://github.com/randombit/botan/blob/master/src/lib/kdf/prf_tls/prf_tls.cpp")
      ];

      this.references = [
        new LinkItem("OpenSSL TLS1 PRF", "https://github.com/openssl/openssl/blob/master/ssl/t1_enc.c"),
        new LinkItem("RFC 5246 - TLS 1.2 (supersedes TLS-PRF)", "https://tools.ietf.org/rfc/rfc5246.txt")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Weak Hash Functions",
          "Uses MD5 and SHA-1 which are cryptographically weak. Use TLS 1.2+ with SHA-256 or better."
        ),
        new Vulnerability(
          "Deprecated Protocol",
          "TLS 1.0/1.1 are deprecated. Modern applications should use TLS 1.2+ (TLS-12-PRF)."
        )
      ];

      // Test vectors from Botan test suite
      // Reference: https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec
      this.tests = [
        {
          text: "Botan TLS-PRF Vector 1",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec",
          input: OpCodes.Hex8ToBytes('6C81AF87ABD86BE83C37CE981F6BFE11BD53A8'),
          salt: OpCodes.Hex8ToBytes('A6D455CB1B2929E43D63CCE55CE89D66F252549729C19C1511'),
          outputSize: 1,
          expected: OpCodes.Hex8ToBytes('A8')
        },
        {
          text: "Botan TLS-PRF Vector 2",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec",
          input: OpCodes.Hex8ToBytes('6BB61D34AF2BCCF45A850850BCDE35E55A92BA'),
          salt: OpCodes.Hex8ToBytes('510194C9C9F90D98452FB914F636D5E5297C'),
          outputSize: 2,
          expected: OpCodes.Hex8ToBytes('5E75')
        },
        {
          text: "Botan TLS-PRF Vector 3",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec",
          input: OpCodes.Hex8ToBytes('3CC54F5F3EF82C93CE60EB62DC9DF005280DD1'),
          salt: OpCodes.Hex8ToBytes('7FC24D382379A9CD54D53458947CB28E298A1DCC5EB2556F71ACAC1B'),
          outputSize: 3,
          expected: OpCodes.Hex8ToBytes('706F52')
        },
        {
          text: "Botan TLS-PRF Vector 4",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec",
          input: OpCodes.Hex8ToBytes('BD3462DC587DFA992AE48BD7643B62A9971928'),
          salt: OpCodes.Hex8ToBytes('9F6FAFED1F241A1E40ADEAF2AD80'),
          outputSize: 4,
          expected: OpCodes.Hex8ToBytes('841D7339')
        },
        {
          text: "Botan TLS-PRF Vector 5",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec",
          input: OpCodes.Hex8ToBytes('1235A061FA3867B8E51511D1E672CE141E2FA6'),
          salt: OpCodes.Hex8ToBytes('1026B9224FC59706BEADAE58EBD161FD2EAC'),
          outputSize: 5,
          expected: OpCodes.Hex8ToBytes('D856787D41')
        },
        {
          text: "Botan TLS-PRF Vector 6",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec",
          input: OpCodes.Hex8ToBytes('63A22C3C7C5651103648F5CFC9764A7BDE821F'),
          salt: OpCodes.Hex8ToBytes('512FBF47D9DA2915'),
          outputSize: 6,
          expected: OpCodes.Hex8ToBytes('F13096FEED6E')
        },
        {
          text: "Botan TLS-PRF Vector 7",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec",
          input: OpCodes.Hex8ToBytes('AA15082F10F25EC4F96DFFE9DC3D80BBA6361B'),
          salt: OpCodes.Hex8ToBytes('519B87DB85FBE92FB4070F3BEF6E3D97DF69B66061EB83B4A334E8EEDC0F8E'),
          outputSize: 7,
          expected: OpCodes.Hex8ToBytes('B637FCADE57896')
        },
        {
          text: "Botan TLS-PRF Vector 8",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec",
          input: OpCodes.Hex8ToBytes('775B727CE679B8696171C7BE60FC2E3F4DE516'),
          salt: OpCodes.Hex8ToBytes('453C2549058B063C83E8B85E5CEF3570DF51B7D79B486F4F33'),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes('3431016193616501')
        },
        {
          text: "Botan TLS-PRF Vector 9",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec",
          input: OpCodes.Hex8ToBytes('AB299AD69DC581F13D86562AE2BE8B08015FF8'),
          salt: OpCodes.Hex8ToBytes('5569FC'),
          outputSize: 9,
          expected: OpCodes.Hex8ToBytes('A624CC363499B1EA64')
        },
        {
          text: "Botan TLS-PRF Vector 10",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec",
          input: OpCodes.Hex8ToBytes('AE4947624D877916E5B01EDDAB8E4CDC817630'),
          salt: OpCodes.Hex8ToBytes('7FDE51EFB4044017C95E3608F8FB6F'),
          outputSize: 10,
          expected: OpCodes.Hex8ToBytes('5B908EB5B2A7F115CF57')
        },
        {
          text: "Botan TLS-PRF Vector 16",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec",
          input: OpCodes.Hex8ToBytes('77BF131D53997B1FB2ACE2137E26992B36BF3E'),
          salt: OpCodes.Hex8ToBytes('859D1EE9A694865ECC1830C361D24485AC1026'),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes('60D0A09FCFDE24AB73F62A7C9F594766')
        },
        {
          text: "Botan TLS-PRF Vector 20",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec",
          input: OpCodes.Hex8ToBytes('BCBD1EFDA490B9D541BA9DF50FE9A451DD0313'),
          salt: OpCodes.Hex8ToBytes('255230A341E671BC31B1'),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes('2291E19459725562F106F63FE2F81E73BA23F04A')
        },
        {
          text: "Botan TLS-PRF Vector 31 (Empty Salt)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec",
          input: OpCodes.Hex8ToBytes('0AE876A7BB96C24CEFA6ED53CEE7B0A41B8FF7B3'),
          salt: OpCodes.Hex8ToBytes(''),
          outputSize: 31,
          expected: OpCodes.Hex8ToBytes('881B99C3E43B1A42F096CF556D3143D5C5DBC4E984D26C5F3075BCB08B73DA')
        },
        {
          text: "Botan TLS-PRF Vector 32",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec",
          input: OpCodes.Hex8ToBytes('2212169D33FADC6FF94A3E5E0020587953CF1964'),
          salt: OpCodes.Hex8ToBytes('FCD5C9637A21E43F3CFF6ECF65B6E2F97933779F101AD6'),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes('1E1C646C2BFBDC62FA4C81F1D0781F5F269D3F45E5C33CAC8A2640226C8C5D16')
        }
      ];
    }

    /**
   * Create new TLS 1.0/1.1 PRF instance
   * @param {boolean} [isInverse=false] - True returns null: the PRF has no inverse
   * @returns {TLSPRFInstance} New instance, or null for isInverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // KDF cannot be reversed
      }
      return new TLSPRFInstance(this);
    }
  }

  // TLS 1.0/1.1 PRF Instance
  /**
 * TLS 1.0/1.1 PRF instance implementing the Feed/Result pattern
 * @class
 * @extends {IKdfInstance}
 */

  class TLSPRFInstance extends IKdfInstance {
    /**
     * Initialize a TLS 1.0/1.1 PRF instance
     * @param {TLSPRFAlgorithm} algorithm - Parent algorithm instance
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {uint8[]} Secret (null until fed or set) */
      this._secret = null;
      /** @type {uint8[]} Seed (null until set; required) */
      this._salt = null;
      /** @type {uint8[]} */
      this._label = []; // Empty by default (not used in basic TLS-PRF)
      /** @type {int32} */
      this._outputSize = 32;
    }

    /** @returns {uint8[]} Copy of the secret, or null */
    get secret() {
      if (this._secret) { return this._secret.slice(); }
      return null;
    }

    /**
     * @param {uint8[]} value - Secret (copied)
     * @throws {Error} If it is not a byte array
     */
    set secret(value) {
      if (!value || !Array.isArray(value)) {
        throw new Error('Invalid secret - must be byte array');
      }
      this._secret = value.slice();
    }

    /** @returns {uint8[]} Copy of the seed, or null */
    get salt() {
      if (this._salt) { return this._salt.slice(); }
      return null;
    }

    /**
     * @param {uint8[]} value - Seed (copied)
     * @throws {Error} If it is not a byte array
     */
    set salt(value) {
      if (!Array.isArray(value)) {
        throw new Error('Invalid salt - must be byte array');
      }
      this._salt = value.slice();
    }

    /** @returns {uint8[]} Copy of the label */
    get label() {
      return this._label.slice();
    }

    /**
     * @param {uint8[]} value - Label (copied)
     * @throws {Error} If it is not a byte array
     */
    set label(value) {
      if (!Array.isArray(value)) {
        throw new Error('Invalid label - must be byte array');
      }
      this._label = value.slice();
    }

    /** @returns {int32} Output size in bytes */
    get outputSize() {
      return this._outputSize;
    }

    /**
     * @param {int32} value - Output size in bytes
     * @throws {Error} If it is not a positive number
     */
    set outputSize(value) {
      if (typeof value !== 'number' || value < 1) {
        throw new Error('Invalid output size');
      }
      this._outputSize = value;
    }

    /**
   * Feed secret bytes
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If the input is not a byte array
   */

    Feed(data) {
      if (!data || !Array.isArray(data)) {
        throw new Error('Invalid input data - must be byte array');
      }
      // Feed is a streaming interface: successive calls extend the input rather
      // than replace it, so Feed(a); Feed(b) derives from the same octet string
      // as Feed(a || b).
      if (!this._secret) this._secret = [];
      for (let i = 0; i < data.length; i++) this._secret.push(data[i]);
    }

    /**
   * Derive: P_MD5(S1, label + seed) XOR P_SHA-1(S2, label + seed)
   * @returns {uint8[]} Derived bytes
   * @throws {Error} If secret or seed is missing, or HMAC is unavailable
   */

    Result() {
      if (!this._secret) {
        throw new Error('Secret not set');
      }
      if (!this._salt) {
        throw new Error('Salt not set');
      }

      // TLS 1.0/1.1 PRF uses MD5 and SHA-1 in parallel
      // PRF(secret, label, seed) = P_MD5(S1, label + seed) XOR P_SHA-1(S2, label + seed)

      const secret = this._secret;
      const labelSeed = this._label.concat(this._salt);

      // Split secret in half (with overlap if odd length)
      const halfLen = Math.ceil(secret.length / 2);
      const s1 = secret.slice(0, halfLen);
      const s2 = secret.slice(secret.length - halfLen);

      // Compute P_hash for MD5 and SHA-1
      const md5Result = this._pHash(s1, labelSeed, this._outputSize, 'MD5');
      const sha1Result = this._pHash(s2, labelSeed, this._outputSize, 'SHA-1');

      // XOR the results
      const result = OpCodes.XorArrays(md5Result, sha1Result);

      return result;
    }


    /**
     * P_hash (RFC 2246 / RFC 5246):
     * HMAC_hash(secret, A(1) + seed) + HMAC_hash(secret, A(2) + seed) + ...,
     * A(0) = seed, A(i) = HMAC_hash(secret, A(i-1))
     * @param {uint8[]} secret - HMAC key
     * @param {uint8[]} seed - Label || seed
     * @param {int32} outputLength - Output length in bytes
     * @param {string} hashName - Hash name for HMAC
     * @returns {uint8[]} Output
     * @throws {Error} If HMAC is not available
     */
    _pHash(secret, seed, outputLength, hashName) {
      this._getHMAC();
      /** @type {uint8[]} */
      const output = [];

      // A(0) = seed
      let a = seed.slice();

      while (output.length < outputLength) {
        // A(i) = HMAC_hash(secret, A(i-1))
        a = this._hmac(secret, a, hashName);

        // HMAC_hash(secret, A(i) + seed)
        const chunk = this._hmac(secret, a.concat(seed), hashName);

        for (let _i = 0; _i < chunk.length; _i++) output.push(chunk[_i]);
      }

      // Truncate to exact output length
      return output.slice(0, outputLength);
    }

    /**
     * HMAC with the registered HMAC algorithm
     * @param {uint8[]} key - HMAC key
     * @param {uint8[]} data - Message
     * @param {string} hashName - Hash name
     * @returns {uint8[]} MAC
     */
    _hmac(key, data, hashName) {
      const hmacAlgo = AlgorithmFramework.Find('HMAC');
      /** @type {IMacInstance} */
      const instance = hmacAlgo.CreateInstance();
      instance.key = key;
      instance.hashFunction = hashName;
      instance.Feed(data);
      /** @type {uint8[]} */
      const mac = instance.Result();
      return mac;
    }

    /**
     * Get the HMAC algorithm from the framework, loading it under CommonJS
     * when it is not registered yet (an AMD or browser loader cannot require
     * synchronously)
     * @returns {Algorithm} The HMAC algorithm
     * @throws {Error} If HMAC is not available
     */
    _getHMAC() {
      let hmacAlgo = AlgorithmFramework.Find('HMAC');

      if (!hmacAlgo && typeof module !== 'undefined' && typeof require !== 'undefined') {
        require('../mac/hmac.js');
        hmacAlgo = AlgorithmFramework.Find('HMAC');
      }

      if (!hmacAlgo) {
        throw new Error('HMAC algorithm not found in framework');
      }

      return hmacAlgo;
    }
  }

  // ===== TLS 1.2 PRF IMPLEMENTATION =====

  class TLS12PRFAlgorithm extends KdfAlgorithm {
    /**
     * TLS 1.2 PRF over one HMAC hash
     * @param {string} hashName - SHA-224, SHA-256, SHA-384 or SHA-512 (empty selects SHA-256)
     */
    constructor(hashName) {
      super();

      /** @type {string} */
      this._hashName = 'SHA-256';
      if (hashName) { this._hashName = hashName; }

      // Required metadata
      this.name = 'TLS-12-PRF(HMAC(' + this._hashName + '))';
      this.description = 'TLS 1.2 Pseudorandom Function using HMAC-' + this._hashName + '. Modern TLS key derivation supporting arbitrary hash functions. Uses P_hash construction with single PRF instead of dual MD5+SHA-1.';
      this.inventor = "IETF TLS Working Group";
      this.year = 2008;
      this.category = CategoryType.KDF;
      this.subCategory = "Key Derivation Function";
      this.securityStatus = this._hashName === 'SHA-256' || this._hashName === 'SHA-384' || this._hashName === 'SHA-512'
        ? SecurityStatus.SECURE
        : SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // KDF-specific properties
      this.SaltRequired = true;
      this.SupportedOutputSizes = [new KeySize(1, 1024, 1)];

      // Documentation links
      this.documentation = [
        new LinkItem("RFC 5246 - TLS 1.2 Protocol", "https://tools.ietf.org/rfc/rfc5246.txt"),
        new LinkItem("Botan TLS-12-PRF Implementation", "https://github.com/randombit/botan/blob/master/src/lib/kdf/prf_tls/prf_tls.cpp"),
        new LinkItem("IETF Mail Archive - Test Vectors", "https://www.ietf.org/mail-archive/web/tls/current/msg03416.html")
      ];

      this.references = [
        new LinkItem("OpenSSL TLS1.2 PRF", "https://github.com/openssl/openssl/blob/master/ssl/t1_enc.c"),
        new LinkItem("RFC 8446 - TLS 1.3", "https://tools.ietf.org/rfc/rfc8446.txt")
      ];

      this.knownVulnerabilities = [];

      // Test vectors from RFC and IETF archives
      // Test vectors from https://www.ietf.org/mail-archive/web/tls/current/msg03416.html
      if (this._hashName === 'SHA-224') {
        this.tests = [{
          text: "IETF TLS 1.2 SHA-224 Test Vector",
          uri: "https://www.ietf.org/mail-archive/web/tls/current/msg03416.html",
          input: OpCodes.Hex8ToBytes('e18828740352b530d69b34c6597dea2e'),
          salt: OpCodes.Hex8ToBytes('f5a3fe6d34e2e28560fdcaf6823f9091'),
          label: OpCodes.Hex8ToBytes('74657374206c6162656c'), // "test label"
          outputSize: 88,
          expected: OpCodes.Hex8ToBytes('224d8af3c0453393a9779789d21cf7da5ee62ae6b617873d489428efc8dd58d1566e7029e2ca3a5ecd355dc64d4d927e2fbd78c4233e8604b14749a77a92a70fddf614bc0df623d798604e4ca5512794d802a258e82f86cf')
        }];
      } else if (this._hashName === 'SHA-256') {
        this.tests = [{
          text: "IETF TLS 1.2 SHA-256 Test Vector",
          uri: "https://www.ietf.org/mail-archive/web/tls/current/msg03416.html",
          input: OpCodes.Hex8ToBytes('9bbe436ba940f017b17652849a71db35'),
          salt: OpCodes.Hex8ToBytes('a0ba9f936cda311827a6f796ffd5198c'),
          label: OpCodes.Hex8ToBytes('74657374206c6162656c'), // "test label"
          outputSize: 100,
          expected: OpCodes.Hex8ToBytes('e3f229ba727be17b8d122620557cd453c2aab21d07c3d495329b52d4e61edb5a6b301791e90d35c9c9a46b4e14baf9af0fa022f7077def17abfd3797c0564bab4fbc91666e9def9b97fce34f796789baa48082d122ee42c5a72e5a5110fff70187347b66')
        }];
      } else if (this._hashName === 'SHA-384') {
        this.tests = [{
          text: "IETF TLS 1.2 SHA-384 Test Vector",
          uri: "https://www.ietf.org/mail-archive/web/tls/current/msg03416.html",
          input: OpCodes.Hex8ToBytes('b80b733d6ceefcdc71566ea48e5567df'),
          salt: OpCodes.Hex8ToBytes('cd665cf6a8447dd6ff8b27555edb7465'),
          label: OpCodes.Hex8ToBytes('74657374206c6162656c'), // "test label"
          outputSize: 148,
          expected: OpCodes.Hex8ToBytes('7b0c18e9ced410ed1804f2cfa34a336a1c14dffb4900bb5fd7942107e81c83cde9ca0faa60be9fe34f82b1233c9146a0e534cb400fed2700884f9dc236f80edd8bfa961144c9e8d792eca722a7b32fc3d416d473ebc2c5fd4abfdad05d9184259b5bf8cd4d90fa0d31e2dec479e4f1a26066f2eea9a69236a3e52655c9e9aee691c8f3a26854308d5eaa3be85e0990703d73e56f')
        }];
      } else if (this._hashName === 'SHA-512') {
        this.tests = [{
          text: "IETF TLS 1.2 SHA-512 Test Vector",
          uri: "https://www.ietf.org/mail-archive/web/tls/current/msg03416.html",
          input: OpCodes.Hex8ToBytes('b0323523c1853599584d88568bbb05eb'),
          salt: OpCodes.Hex8ToBytes('d4640e12e4bcdbfb437f03e6ae418ee5'),
          label: OpCodes.Hex8ToBytes('74657374206c6162656c'), // "test label"
          outputSize: 196,
          expected: OpCodes.Hex8ToBytes('1261f588c798c5c201ff036e7a9cb5edcd7fe3f94c669a122a4638d7d508b283042df6789875c7147e906d868bc75c45e20eb40c1cf4a1713b27371f68432592f7dc8ea8ef223e12ea8507841311bf68653d0cfc4056d811f025c45ddfa6e6fec702f054b409d6f28dd0a3233e498da41a3e75c5630eedbe22fe254e33a1b0e9f6b9826675bec7d01a845658dc9c397545401d40b9f46c7a400ee1b8f81ca0a60d1a397a1028bff5d2ef5066126842fb8da4197632bdb54ff6633f86bbc836e640d4d898')
        }];
      } else {
        this.tests = [];
      }
    }


    /**
   * Create new TLS 1.2 PRF instance
   * @param {boolean} [isInverse=false] - True returns null: the PRF has no inverse
   * @returns {TLS12PRFInstance} New instance, or null for isInverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // KDF cannot be reversed
      }
      return new TLS12PRFInstance(this, this._hashName);
    }
  }

  // TLS 1.2 PRF Instance
  /**
 * TLS 1.2 PRF instance implementing the Feed/Result pattern
 * @class
 * @extends {IKdfInstance}
 */

  class TLS12PRFInstance extends IKdfInstance {
    /**
     * Initialize a TLS 1.2 PRF instance
     * @param {TLS12PRFAlgorithm} algorithm - Parent algorithm instance
     * @param {string} hashName - Hash name for HMAC
     */
    constructor(algorithm, hashName) {
      super(algorithm);
      /** @type {string} */
      this._hashName = hashName;
      /** @type {uint8[]} Secret (null until fed or set) */
      this._secret = null;
      /** @type {uint8[]} Seed (null until set; required) */
      this._salt = null;
      /** @type {uint8[]} */
      this._label = [];
      /** @type {int32} */
      this._outputSize = 32;
    }

    /** @returns {uint8[]} Copy of the secret, or null */
    get secret() {
      if (this._secret) { return this._secret.slice(); }
      return null;
    }

    /**
     * @param {uint8[]} value - Secret (copied)
     * @throws {Error} If it is not a byte array
     */
    set secret(value) {
      if (!value || !Array.isArray(value)) {
        throw new Error('Invalid secret - must be byte array');
      }
      this._secret = value.slice();
    }

    /** @returns {uint8[]} Copy of the seed, or null */
    get salt() {
      if (this._salt) { return this._salt.slice(); }
      return null;
    }

    /**
     * @param {uint8[]} value - Seed (copied)
     * @throws {Error} If it is not a byte array
     */
    set salt(value) {
      if (!Array.isArray(value)) {
        throw new Error('Invalid salt - must be byte array');
      }
      this._salt = value.slice();
    }

    /** @returns {uint8[]} Copy of the label */
    get label() {
      return this._label.slice();
    }

    /**
     * @param {uint8[]} value - Label (copied)
     * @throws {Error} If it is not a byte array
     */
    set label(value) {
      if (!Array.isArray(value)) {
        throw new Error('Invalid label - must be byte array');
      }
      this._label = value.slice();
    }

    /** @returns {int32} Output size in bytes */
    get outputSize() {
      return this._outputSize;
    }

    /**
     * @param {int32} value - Output size in bytes
     * @throws {Error} If it is not a positive number
     */
    set outputSize(value) {
      if (typeof value !== 'number' || value < 1) {
        throw new Error('Invalid output size');
      }
      this._outputSize = value;
    }

    /**
   * Feed secret bytes
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If the input is not a byte array
   */

    Feed(data) {
      if (!data || !Array.isArray(data)) {
        throw new Error('Invalid input data - must be byte array');
      }
      // Feed is a streaming interface: successive calls extend the input rather
      // than replace it, so Feed(a); Feed(b) derives from the same octet string
      // as Feed(a || b).
      if (!this._secret) this._secret = [];
      for (let i = 0; i < data.length; i++) this._secret.push(data[i]);
    }

    /**
   * Derive: P_<hash>(secret, label + seed)
   * @returns {uint8[]} Derived bytes
   * @throws {Error} If secret or seed is missing, or HMAC is unavailable
   */

    Result() {
      if (!this._secret) {
        throw new Error('Secret not set');
      }
      if (!this._salt) {
        throw new Error('Salt not set');
      }

      // TLS 1.2 PRF(secret, label, seed) = P_<hash>(secret, label + seed)
      const labelSeed = this._label.concat(this._salt);
      return this._pHash(this._secret, labelSeed, this._outputSize, this._hashName);
    }


    /**
     * P_hash (RFC 2246 / RFC 5246):
     * HMAC_hash(secret, A(1) + seed) + HMAC_hash(secret, A(2) + seed) + ...,
     * A(0) = seed, A(i) = HMAC_hash(secret, A(i-1))
     * @param {uint8[]} secret - HMAC key
     * @param {uint8[]} seed - Label || seed
     * @param {int32} outputLength - Output length in bytes
     * @param {string} hashName - Hash name for HMAC
     * @returns {uint8[]} Output
     * @throws {Error} If HMAC is not available
     */
    _pHash(secret, seed, outputLength, hashName) {
      this._getHMAC();
      /** @type {uint8[]} */
      const output = [];

      // A(0) = seed
      let a = seed.slice();

      while (output.length < outputLength) {
        // A(i) = HMAC_hash(secret, A(i-1))
        a = this._hmac(secret, a, hashName);

        // HMAC_hash(secret, A(i) + seed)
        const chunk = this._hmac(secret, a.concat(seed), hashName);

        for (let _i = 0; _i < chunk.length; _i++) output.push(chunk[_i]);
      }

      // Truncate to exact output length
      return output.slice(0, outputLength);
    }

    /**
     * HMAC with the registered HMAC algorithm
     * @param {uint8[]} key - HMAC key
     * @param {uint8[]} data - Message
     * @param {string} hashName - Hash name
     * @returns {uint8[]} MAC
     */
    _hmac(key, data, hashName) {
      const hmacAlgo = AlgorithmFramework.Find('HMAC');
      /** @type {IMacInstance} */
      const instance = hmacAlgo.CreateInstance();
      instance.key = key;
      instance.hashFunction = hashName;
      instance.Feed(data);
      /** @type {uint8[]} */
      const mac = instance.Result();
      return mac;
    }

    /**
     * Get the HMAC algorithm from the framework, loading it under CommonJS
     * when it is not registered yet (an AMD or browser loader cannot require
     * synchronously)
     * @returns {Algorithm} The HMAC algorithm
     * @throws {Error} If HMAC is not available
     */
    _getHMAC() {
      let hmacAlgo = AlgorithmFramework.Find('HMAC');

      if (!hmacAlgo && typeof module !== 'undefined' && typeof require !== 'undefined') {
        require('../mac/hmac.js');
        hmacAlgo = AlgorithmFramework.Find('HMAC');
      }

      if (!hmacAlgo) {
        throw new Error('HMAC algorithm not found in framework');
      }

      return hmacAlgo;
    }
  }

  // ===== REGISTRATION =====

  // Register TLS 1.0/1.1 PRF
  const tlsPrfInstance = new TLSPRFAlgorithm();
  if (!AlgorithmFramework.Find(tlsPrfInstance.name)) {
    RegisterAlgorithm(tlsPrfInstance);
  }

  // Register TLS 1.2 PRF variants
  /** @type {string[]} */
  const hashFunctions = ['SHA-224', 'SHA-256', 'SHA-384', 'SHA-512'];
  for (let i = 0; i < hashFunctions.length; i++) {
    const tls12Instance = new TLS12PRFAlgorithm(hashFunctions[i]);
    if (!AlgorithmFramework.Find(tls12Instance.name)) {
      RegisterAlgorithm(tls12Instance);
    }
  }

  // ===== EXPORTS =====

  return {
    TLSPRFAlgorithm,
    TLSPRFInstance,
    TLS12PRFAlgorithm,
    TLS12PRFInstance
  };
}));
