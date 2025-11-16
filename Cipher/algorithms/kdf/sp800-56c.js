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
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
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
 * SP80056C cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SP80056CInstance extends IKdfInstance {
    constructor(algorithm) {
      super(algorithm);
      this._keyInput = null;
      this._salt = null;
      this._label = null;
      this._outputLength = 32;  // Default output length
      this._hashAlgorithm = 'SHA-256';  // Default hash function for HMAC
    }

    // Property setter for input key material (shared secret) - matches test vector 'input' field
    set input(keyBytes) {
      if (!keyBytes || !Array.isArray(keyBytes)) {
        throw new Error("Key input must be a byte array");
      }
      this._keyInput = [...keyBytes];
    }

    get input() {
      return this._keyInput ? [...this._keyInput] : null;
    }

    // Alias for compatibility
    set keyInput(keyBytes) {
      this.input = keyBytes;
    }

    get keyInput() {
      return this.input;
    }

    // Property setter for salt (optional)
    set salt(saltBytes) {
      this._salt = saltBytes && Array.isArray(saltBytes) ? [...saltBytes] : [];
    }

    get salt() {
      return this._salt ? [...this._salt] : [];
    }

    // Property setter for label (application-specific context information)
    set label(labelBytes) {
      this._label = labelBytes && Array.isArray(labelBytes) ? [...labelBytes] : [];
    }

    get label() {
      return this._label ? [...this._label] : [];
    }

    // Output length in bytes
    set outputLength(bytes) {
      if (!Number.isInteger(bytes) || bytes < 1 || bytes > 16320) {
        throw new Error("Output length must be between 1 and 16320 bytes");
      }
      this._outputLength = bytes;
    }

    get outputLength() {
      return this._outputLength;
    }

    // Hash algorithm used for HMAC (SHA-1, SHA-256, SHA-512)
    set hashAlgorithm(algo) {
      if (!algo || typeof algo !== 'string') {
        throw new Error("Hash algorithm must be a valid string");
      }
      this._hashAlgorithm = algo.toUpperCase();
    }

    get hashAlgorithm() {
      return this._hashAlgorithm;
    }

    // Main derivation method
    // For KDFs, Feed() is used to provide the input key material
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (data && Array.isArray(data)) {
        this._keyInput = [...data];
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._keyInput || this._keyInput.length === 0) {
        throw new Error("Key input not set");
      }

      if (this._outputLength < 1) {
        throw new Error("Output length must be at least 1 byte");
      }

      // Get HMAC function for the specified hash algorithm
      const hmacFunc = this._getHMACFunction();
      const hmacOutputBytes = this._getHMACOutputSize();

      // Step 1: Extract - PRK = HMAC(salt, secret)
      // If salt is empty, use string of zeros of hash length
      const actualSalt = (this._salt && this._salt.length > 0)
        ? this._salt
        : new Array(hmacOutputBytes).fill(0);

      const prk = hmacFunc(actualSalt, this._keyInput);

      // Step 2: Expand - Similar to HKDF expand but with label instead of info
      // T(0) = empty string
      // T(i) = HMAC(PRK, T(i-1) || label || i)
      // Output = T(1) || T(2) || ... || T(n) (truncated to outputLength)

      const numBlocks = Math.ceil(this._outputLength / hmacOutputBytes);

      if (numBlocks > 255) {
        throw new Error("Output length too large for SP800-56C");
      }

      const output = [];
      let previousBlock = [];

      for (let i = 1; i <= numBlocks; i++) {
        const blockInput = [];

        // Add T(i-1)
        if (previousBlock.length > 0) {
          blockInput.push(...previousBlock);
        }

        // Add label
        if (this._label && this._label.length > 0) {
          blockInput.push(...this._label);
        }

        // Add counter (single byte)
        blockInput.push(i);

        // Compute T(i) = HMAC(PRK, T(i-1) || label || i)
        const blockHash = hmacFunc(prk, blockInput);
        output.push(...blockHash);
        previousBlock = blockHash;
      }

      // Truncate to requested output length
      return output.slice(0, this._outputLength);
    }

    // Get HMAC function for the specified hash algorithm
    _getHMACFunction() {
      const hashAlgo = this._hashAlgorithm.toUpperCase();

      if (hashAlgo === 'SHA-256' || hashAlgo === 'SHA256') {
        return (key, message) => this._hmacSHA256(key, message);
      } else if (hashAlgo === 'SHA-512' || hashAlgo === 'SHA512') {
        return (key, message) => this._hmacSHA512(key, message);
      } else if (hashAlgo === 'SHA-1' || hashAlgo === 'SHA1') {
        return (key, message) => this._hmacSHA1(key, message);
      } else {
        throw new Error(`Unsupported hash algorithm: ${this._hashAlgorithm}`);
      }
    }

    // Get HMAC output size for the selected hash
    _getHMACOutputSize() {
      const hashAlgo = this._hashAlgorithm.toUpperCase();
      if (hashAlgo === 'SHA-256' || hashAlgo === 'SHA256') return 32;
      if (hashAlgo === 'SHA-512' || hashAlgo === 'SHA512') return 64;
      if (hashAlgo === 'SHA-1' || hashAlgo === 'SHA1') return 20;
      return 32;  // Default to SHA-256 output size
    }

    // Implementation of HMAC-SHA256
    _hmacSHA256(key, message) {
      return this._hmacCompute(key, message, 'SHA-256');
    }

    // Implementation of HMAC-SHA512
    _hmacSHA512(key, message) {
      return this._hmacCompute(key, message, 'SHA-512');
    }

    // Implementation of HMAC-SHA1
    _hmacSHA1(key, message) {
      return this._hmacCompute(key, message, 'SHA-1');
    }

    // Generic HMAC computation
    _hmacCompute(key, message, hashName) {
      // Try using Node.js crypto if available
      if (typeof require !== 'undefined') {
        try {
          const crypto = require('crypto');
          const hmac = crypto.createHmac(
            hashName.replace('-', '').toLowerCase(),
            Buffer.from(key)
          );
          hmac.update(Buffer.from(message));
          return Array.from(hmac.digest());
        } catch (e) {
          // Fall through to alternate implementation
        }
      }

      // Check if we have HMAC in OpCodes
      if (OpCodes && OpCodes.HMAC) {
        return OpCodes.HMAC(key, message, hashName);
      }

      throw new Error(
        `Cannot compute HMAC: No crypto library available (requires Node.js crypto or Web Crypto API)`
      );
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new SP80056CAlgorithm());

  return {
    SP80056CAlgorithm,
    SP80056CInstance
  };
}));
