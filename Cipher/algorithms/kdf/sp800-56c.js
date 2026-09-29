/*
 * NIST SP 800-56C KDF Implementation
 * Compatible with AlgorithmFramework
 * (c)2025 Hawkynt
 *
 * Implements Two-Step Key Derivation Function as defined in NIST SP 800-56C Rev. 2
 * Similar to HKDF (RFC 5869) with Extract-and-Expand pattern
 * Reference: https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-56Cr2.pdf
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
          KdfAlgorithm, IKdfInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class SP80056CAlgorithm extends KdfAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SP800-56C";
      this.description = "NIST SP 800-56C Two-Step Key Derivation Function. Extract-and-Expand pattern using HMAC for deriving cryptographic keys from shared secrets, similar to HKDF but following NIST standardized specification.";
      this.inventor = "NIST";
      this.year = 2018;
      this.category = CategoryType.KDF;
      this.subCategory = "Two-Step KDF (Extract-and-Expand)";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // KDF-specific configuration
      this.SupportedKeyDerivationSizes = [
        new KeySize(1, 16320, 1)  // 1 byte to 255*64 bytes (max with SHA-512)
      ];
      this.NeedsKey = true;  // Requires input key material (shared secret)

      // Documentation links
      this.documentation = [
        new LinkItem(
          "NIST SP 800-56C Revision 2 - Recommendation for Key-Derivation Methods in Key-Establishment Schemes",
          "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-56Cr2.pdf"
        ),
        new LinkItem(
          "RFC 5869 - HMAC-based Extract-and-Expand Key Derivation Function (HKDF)",
          "https://tools.ietf.org/rfc/rfc5869.txt"
        )
      ];

      // Reference links
      this.references = [
        new LinkItem(
          "PyCryptodome SP800-56C Implementation",
          "https://github.com/Legrandin/pycryptodome"
        ),
        new LinkItem(
          "Botan SP800-56C Test Vectors",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56c.vec"
        )
      ];

      // Official test vectors from Botan (generated using PyCryptodome)
      this.tests = [
        {
          text: "SP 800-56C - HMAC-SHA1 Test Vector 1 (2 bytes)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56c.vec",
          input: OpCodes.Hex8ToBytes("52f4676023946c7307b5e8148d97f312623a6e88"),
          salt: OpCodes.Hex8ToBytes("97ca00eac481e8b3556a"),
          label: OpCodes.Hex8ToBytes("ae8cf2e46773a68098ea53b3"),
          outputLength: 2,
          hashAlgorithm: "SHA-1",
          expected: OpCodes.Hex8ToBytes("1bcd")
        },
        {
          text: "SP 800-56C - HMAC-SHA1 Test Vector 2 (4 bytes)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56c.vec",
          input: OpCodes.Hex8ToBytes("eecb51e6d59a6fe688fb591799891d9211745a13"),
          salt: OpCodes.Hex8ToBytes("76b026053771b88e4e833962a10083835a33ddd9"),
          label: OpCodes.Hex8ToBytes("f2d44c1b59d725ad7c662ca6"),
          outputLength: 4,
          hashAlgorithm: "SHA-1",
          expected: OpCodes.Hex8ToBytes("bc3d9b22")
        },
        {
          text: "SP 800-56C - HMAC-SHA256 Test Vector 1 (3 bytes)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56c.vec",
          input: OpCodes.Hex8ToBytes("b3dad1f46a18430ea0c8fbe2172922a5a42c47af40046db24d38cb11eff4ce44"),
          salt: OpCodes.Hex8ToBytes("28e12e410d501368b3e8"),
          label: OpCodes.Hex8ToBytes("94d91d500177efafdc93e8b6"),
          outputLength: 3,
          hashAlgorithm: "SHA-256",
          expected: OpCodes.Hex8ToBytes("d4c1fb")
        }
      ];
    }

    /**
   * Create new SP 800-56C two-step KDF instance
   * @param {boolean} [isInverse=false] - True returns null: the KDF has no inverse
   * @returns {SP80056CInstance} New instance, or null for isInverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null;  // KDF cannot be reversed
      }
      return new SP80056CInstance(this);
    }
  }

  // Instance class - handles the actual KDF computation
  /**
 * SP 800-56C two-step KDF instance implementing the Feed/Result pattern
 * @class
 * @extends {IKdfInstance}
 */

  class SP80056CInstance extends IKdfInstance {
    /**
     * Initialize an SP 800-56C two-step KDF instance
     * @param {SP80056CAlgorithm} algorithm - Parent algorithm instance
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {uint8[]} Input key material Z (null until fed or set) */
      this._keyInput = null;
      /** @type {uint8[]} Salt (null or empty selects HashLen zero bytes) */
      this._salt = null;
      /** @type {uint8[]} FixedInfo (null means empty) */
      this._label = null;
      /** @type {int32} */
      this._outputLength = 32;  // Default output length
      /** @type {string} */
      this._hashAlgorithm = 'SHA-256';  // Default hash function for HMAC
    }

    // Property setter for input key material (shared secret) - matches test vector 'input' field
    /**
     * @param {uint8[]} keyBytes - Input key material (copied)
     * @throws {Error} If it is not a byte array
     */
    set input(keyBytes) {
      if (!keyBytes || !Array.isArray(keyBytes)) {
        throw new Error("Key input must be a byte array");
      }
      this._keyInput = keyBytes.slice();
    }

    /** @returns {uint8[]} Copy of the input key material, or null */
    get input() {
      if (this._keyInput) { return this._keyInput.slice(); }
      return null;
    }

    // Alias for compatibility
    /**
     * @param {uint8[]} keyBytes - Input key material (copied)
     * @throws {Error} If it is not a byte array
     */
    set keyInput(keyBytes) {
      this.input = keyBytes;
    }

    /** @returns {uint8[]} Copy of the input key material, or null */
    get keyInput() {
      if (this._keyInput) { return this._keyInput.slice(); }
      return null;
    }

    // Property setter for salt (optional)
    /** @param {uint8[]} saltBytes - Salt (copied; anything but an array clears it) */
    set salt(saltBytes) {
      if (saltBytes && Array.isArray(saltBytes)) { this._salt = saltBytes.slice(); } else { this._salt = []; }
    }

    /** @returns {uint8[]} Copy of the salt */
    get salt() {
      /** @type {uint8[]} */
      let copy = [];
      if (this._salt) { copy = this._salt.slice(); }
      return copy;
    }

    // Property setter for label (application-specific context information)
    /** @param {uint8[]} labelBytes - FixedInfo (copied; anything but an array clears it) */
    set label(labelBytes) {
      if (labelBytes && Array.isArray(labelBytes)) { this._label = labelBytes.slice(); } else { this._label = []; }
    }

    /** @returns {uint8[]} Copy of the FixedInfo */
    get label() {
      /** @type {uint8[]} */
      let copy = [];
      if (this._label) { copy = this._label.slice(); }
      return copy;
    }

    // Output length in bytes
    /**
     * @param {int32} value - Output length, 1..16320
     * @throws {Error} If it is not an integer in range
     */
    set outputLength(value) {
      if (!Number.isInteger(value) || value < 1 || value > 16320) {
        throw new Error("Output length must be between 1 and 16320 bytes");
      }
      this._outputLength = value;
    }

    /** @returns {int32} Output length in bytes */
    get outputLength() {
      return this._outputLength;
    }

    // Hash algorithm used for HMAC (SHA-1, SHA-256, SHA-512)
    /**
     * @param {string} value - SHA-1, SHA-256 or SHA-512 (any case, dash optional)
     * @throws {Error} If it is not a non-empty string
     */
    set hashAlgorithm(value) {
      if (!value || typeof value !== 'string') {
        throw new Error("Hash algorithm must be a valid string");
      }
      this._hashAlgorithm = value.toUpperCase();
    }

    /** @returns {string} Hash name (upper case) */
    get hashAlgorithm() {
      return this._hashAlgorithm;
    }

    // Main derivation method
    // For KDFs, Feed() is used to provide the input key material
    /**
   * Feed input key material (anything but an array is ignored)
   * @param {uint8[]} data - Input data bytes
   */

    Feed(data) {
      if (data && Array.isArray(data)) {
        // Feed is a streaming interface: successive calls extend the input rather
        // than replace it, so Feed(a); Feed(b) derives from the same octet string
        // as Feed(a || b).
        if (!this._keyInput) this._keyInput = [];
        for (let i = 0; i < data.length; i++) this._keyInput.push(data[i]);
      }
    }

    /**
   * Derive the key
   * @returns {uint8[]} Derived key bytes
   * @throws {Error} If no key material was given, or the hash is unsupported or unavailable
   */

    Result() {
      if (!this._keyInput || this._keyInput.length === 0) {
        throw new Error("Key input not set");
      }

      if (this._outputLength < 1) {
        throw new Error("Output length must be at least 1 byte");
      }

      const hashName = this._normalizeHashName(this._hashAlgorithm);

      // Step 1 (Randomness Extraction, SP 800-56C section 4):
      //   K_DK (PRK) = HMAC-hash(salt, Z)
      // If salt is empty, use a string of zeros equal to the HMAC output length.
      const hmacOutputBytes = this._hmacOutputSize(hashName);
      /** @type {uint8[]} */
      let actualSalt = this._salt;
      if (!(this._salt && this._salt.length > 0)) {
        actualSalt = [];
        for (let i = 0; i < hmacOutputBytes; i++) actualSalt.push(0);
      }

      const prk = this._hmac(actualSalt, this._keyInput, hashName);

      // Step 2 (Key Expansion, SP 800-56C section 4 via SP 800-108 Counter Mode):
      //   K(i) = HMAC-hash(K_DK, [i]_32 || FixedInfo || 0x00 || [L]_32)
      //   Output = K(1) || K(2) || ... || K(n), truncated to outputLength bytes
      const numBlocks = Math.ceil(this._outputLength / prk.length);

      if (numBlocks > 0xFFFFFFFF) {
        throw new Error("Output length too large for SP800-56C");
      }

      const outputBits = OpCodes.Unpack32BE(OpCodes.ToUint32(this._outputLength * 8));
      /** @type {uint8[]} */
      let label = this._label;
      if (!label) { label = OpCodes.Hex8ToBytes(''); }
      const separator = OpCodes.Hex8ToBytes('00');

      /** @type {uint8[]} */
      let output = [];
      for (let i = 1; i <= numBlocks; i++) {
        const counterBytes = OpCodes.Unpack32BE(OpCodes.ToUint32(i));
        const blockInput = OpCodes.ConcatArrays([counterBytes, label, separator, outputBits]);
        const blockOutput = this._hmac(prk, blockInput, hashName);
        output = OpCodes.ConcatArrays([output, blockOutput]);
      }

      // Truncate to requested output length
      return output.slice(0, this._outputLength);
    }

    /**
     * Normalize hash algorithm aliases to the AlgorithmFramework-registered names
     * @param {string} hashAlgo - Hash name (empty selects SHA-256)
     * @returns {string} SHA-1, SHA-256 or SHA-512
     * @throws {Error} If the hash is unsupported
     */
    _normalizeHashName(hashAlgo) {
      let name = 'SHA-256';
      if (hashAlgo) { name = hashAlgo.toUpperCase(); }
      switch (name) {
        case 'SHA-1': case 'SHA1': return 'SHA-1';
        case 'SHA-256': case 'SHA256': return 'SHA-256';
        case 'SHA-512': case 'SHA512': return 'SHA-512';
        default: throw new Error('Unsupported hash algorithm: ' + hashAlgo);
      }
    }

    /**
     * HMAC output size for the selected hash, in bytes
     * @param {string} hashName - SHA-1, SHA-256 or SHA-512
     * @returns {int32} Output size
     */
    _hmacOutputSize(hashName) {
      if (hashName === 'SHA-512') return 64;
      if (hashName === 'SHA-1') return 20;
      return 32; // SHA-256
    }

    /**
     * Compute HMAC-hash(key, message) using the registered HMAC algorithm.
     * Registry-first: Find() is checked before require() falls back to loading
     * the module (CommonJS only; an AMD or browser loader cannot require
     * synchronously).
     * @param {uint8[]} key - HMAC key
     * @param {uint8[]} message - Message
     * @param {string} hashName - Registered hash name
     * @returns {uint8[]} MAC
     * @throws {Error} If HMAC is not available
     */
    _hmac(key, message, hashName) {
      let hmacAlgorithm = AlgorithmFramework.Find('HMAC');

      if (!hmacAlgorithm && typeof module !== 'undefined' && typeof require !== 'undefined') {
        require('../mac/hmac.js');
        hmacAlgorithm = AlgorithmFramework.Find('HMAC');
      }

      if (!hmacAlgorithm) {
        throw new Error('HMAC algorithm not available - required for SP800-56C key derivation');
      }

      /** @type {IMacInstance} */
      const hmacInstance = hmacAlgorithm.CreateInstance(false);
      hmacInstance.key = key;
      hmacInstance.hashFunction = hashName;
      hmacInstance.Feed(message);
      /** @type {uint8[]} */
      const mac = hmacInstance.Result();
      return mac;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new SP80056CAlgorithm());

  return {
    SP80056CAlgorithm,
    SP80056CInstance
  };
}));
