/*
 * HMAC-SHA256 (Hash-based Message Authentication Code with SHA-256)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * RFC 2104 & RFC 4231 compliant HMAC implementation with SHA-256
 * Provides cryptographic authentication and integrity verification
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

  // ===== ALGORITHM IMPLEMENTATION =====

  class HMACSHA256Algorithm extends MacAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "HMAC-SHA256";
      this.description = "Hash-based Message Authentication Code using SHA-256 as defined in RFC 2104 and RFC 4231. Combines cryptographic hashing with a secret key to provide authentication and integrity verification.";
      this.inventor = "Mihir Bellare, Ran Canetti, Hugo Krawczyk";
      this.year = 1996;
      this.category = CategoryType.MAC;
      this.subCategory = "HMAC";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // MAC-specific configuration
      this.SupportedMacSizes = [
        new KeySize(1, 64, 1)  // Key can be 1-64 bytes (block size)
      ];
      this.SupportedOutputSizes = [
        new KeySize(1, 32, 1)  // Output can be truncated from 1-32 bytes
      ];
      this.NeedsKey = true;

      // Technical specifications
      this.blockSize = 64;    // SHA-256 block size in bytes
      this.outputSize = 32;   // SHA-256 output size in bytes

      // Documentation links
      this.documentation = [
        new LinkItem("RFC 2104 - HMAC: Keyed-Hashing for Message Authentication", "https://tools.ietf.org/html/rfc2104"),
        new LinkItem("RFC 4231 - Identifiers and Test Vectors for HMAC-SHA-224/256/384/512", "https://tools.ietf.org/html/rfc4231"),
        new LinkItem("NIST FIPS 198-1 - The Keyed-Hash Message Authentication Code (HMAC)", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.198-1.pdf")
      ];

      // Reference implementations
      this.references = [
        new LinkItem("OpenSSL HMAC Implementation", "https://github.com/openssl/openssl/blob/master/crypto/hmac/hmac.c"),
        new LinkItem("libsodium HMAC-SHA256", "https://github.com/jedisct1/libsodium/blob/master/src/libsodium/crypto_auth/hmacsha256/auth_hmacsha256.c"),
        new LinkItem("Botan HMAC Implementation", "https://github.com/randombit/botan/blob/master/src/lib/mac/hmac/hmac.cpp")
      ];

      // Test vectors from RFC 4231
      this.tests = [
        // Test Case 1: Short key, short message
        {
          text: "RFC 4231 Test Case 1 - 'Hi There'",
          uri: "https://tools.ietf.org/html/rfc4231#section-4.2",
          input: OpCodes.Hex8ToBytes('4869205468657265'), // "Hi There"
          key: OpCodes.Hex8ToBytes('0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b'),
          expected: OpCodes.Hex8ToBytes('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7')
        },
        // Test Case 2: Short key, longer message
        {
          text: "RFC 4231 Test Case 2 - 'what do ya want for nothing?'",
          uri: "https://tools.ietf.org/html/rfc4231#section-4.3",
          input: OpCodes.Hex8ToBytes('7768617420646f2079612077616e7420666f72206e6f7468696e673f'), // "what do ya want for nothing?"
          key: OpCodes.Hex8ToBytes('4a656665'), // "Jefe"
          expected: OpCodes.Hex8ToBytes('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843')
        },
        // Test Case 3: Key and data longer than block size
        {
          text: "RFC 4231 Test Case 3 - 50 bytes of 0xDD",
          uri: "https://tools.ietf.org/html/rfc4231#section-4.4",
          input: OpCodes.Hex8ToBytes('dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'),
          key: OpCodes.Hex8ToBytes('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
          expected: OpCodes.Hex8ToBytes('773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe')
        },
        // Test Case 4: Long key (25 bytes), longer message
        {
          text: "RFC 4231 Test Case 4 - 50 bytes of 0xCD",
          uri: "https://tools.ietf.org/html/rfc4231#section-4.5",
          input: OpCodes.Hex8ToBytes('cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd'),
          key: OpCodes.Hex8ToBytes('0102030405060708090a0b0c0d0e0f10111213141516171819'),
          expected: OpCodes.Hex8ToBytes('82558a389a443c0ea4cc819899f2083a85f0faa3e578f8077a2e3ff46729665b')
        },
        // Test Case 6: Very large key (> block size), message
        {
          text: "RFC 4231 Test Case 6 - Key > Block Size",
          uri: "https://tools.ietf.org/html/rfc4231#section-4.7",
          input: OpCodes.Hex8ToBytes('54657374205573696e67204c6172676572205468616e20426c6f636b2d53697a65204b6579202d2048617368204b6579204669727374'), // "Test Using Larger Than Block-Size Key - Hash Key First"
          key: OpCodes.Hex8ToBytes('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
          expected: OpCodes.Hex8ToBytes('60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54')
        },
        // Test Case 7: Very large key and data
        {
          text: "RFC 4231 Test Case 7 - Large Key and Data",
          uri: "https://tools.ietf.org/html/rfc4231#section-4.8",
          input: OpCodes.Hex8ToBytes('5468697320697320612074657374207573696e672061206c6172676572207468616e20626c6f636b2d73697a65206b657920616e642061206c6172676572207468616e20626c6f636b2d73697a6520646174612e20546865206b6579206e6565647320746f20626520686173686564206265666f7265206265696e6720757365642062792074686520484d414320616c676f726974686d2e'), // "This is a test using a larger than block-size key and a larger than block-size data. The key needs to be hashed before being used by the HMAC algorithm."
          key: OpCodes.Hex8ToBytes('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
          expected: OpCodes.Hex8ToBytes('9b09ffa71b942fcb27635fbcd5b0e944bfdc63644f0713938a7f51535c3a35e2')
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
        return null; // HMAC cannot be reversed
      }
      return new HMACSHA256Instance(this);
    }
  }

  // Instance class - handles the actual HMAC-SHA256 computation
  /**
 * HMACSHA256 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class HMACSHA256Instance extends IMacInstance {
    constructor(algorithm) {
      super(algorithm);
      this._key = null;
      this._outputSize = 32; // Default full SHA-256 output
      this.inputBuffer = [];

      // HMAC constants (RFC 2104)
      this.IPAD = 0x36;
      this.OPAD = 0x5C;
      this.BLOCK_SIZE = 64; // SHA-256 block size in bytes

      // SHA-256 algorithm reference
      this._sha256Algorithm = null;
    }

    // Property setter for key
    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes || !Array.isArray(keyBytes)) {
        throw new Error('Invalid key - must be byte array');
      }
      this._key = [...keyBytes]; // Store copy
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property setter for output size (allows truncation)
    set outputSize(size) {
      if (typeof size !== 'number' || size < 1 || size > 32) {
        throw new Error('Invalid output size - must be 1-32 bytes');
      }
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize;
    }

    /**
     * Get SHA-256 algorithm from framework
     * @returns {object} SHA-256 algorithm instance
     */
    _getSHA256Algorithm() {
      if (this._sha256Algorithm) {
        return this._sha256Algorithm;
      }

      // Find SHA-256 in the framework
      this._sha256Algorithm = AlgorithmFramework.Find('SHA-256');

      // If not found, try to load it dynamically (for testing environments)
      if (!this._sha256Algorithm && typeof require !== 'undefined') {
        try {
          require('../hash/sha256.js');
          this._sha256Algorithm = AlgorithmFramework.Find('SHA-256');
        } catch (loadError) {
          // Ignore load errors, will throw below if still not found
        }
      }

      if (!this._sha256Algorithm) {
        throw new Error('SHA-256 hash function not found in framework');
      }

      return this._sha256Algorithm;
    }

    /**
     * Hash byte array using SHA-256
     * @param {Array} data - Data to hash
     * @returns {Array} SHA-256 hash (32 bytes)
     */
    _hashSHA256(data) {
      const sha256 = this._getSHA256Algorithm();
      const hashInstance = sha256.CreateInstance();

      if (!hashInstance) {
        throw new Error('Cannot create SHA-256 instance');
      }

      hashInstance.Feed(data);
      return hashInstance.Result();
    }

    /**
     * Feed data to the HMAC
     * @param {Array} data - Input data as byte array
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error('Invalid input data - must be byte array');
      }
      this.inputBuffer.push(...data);
    }

    /**
     * Get the HMAC result
     * @returns {Array} HMAC-SHA256 digest (32 bytes or truncated)
     */
    Result() {
      if (!this._key) {
        throw new Error('Key not set');
      }
      // Note: Empty input is valid for HMAC

      const hmac = this._computeHMAC(this.inputBuffer, this._key);
      this.inputBuffer = []; // Clear buffer for next use

      // Truncate if needed
      if (this._outputSize < 32) {
        return hmac.slice(0, this._outputSize);
      }
      return hmac;
    }

    /**
     * Compute MAC (IMacInstance interface)
     * @param {Array} data - Data to authenticate
     * @returns {Array} HMAC-SHA256 digest
     */
    ComputeMac(data) {
      if (!this._key) {
        throw new Error('Key not set');
      }
      if (!Array.isArray(data)) {
        throw new Error('Invalid input data - must be byte array');
      }

      const hmac = this._computeHMAC(data, this._key);

      // Truncate if needed
      if (this._outputSize < 32) {
        return hmac.slice(0, this._outputSize);
      }
      return hmac;
    }

    /**
     * Core HMAC computation
     * RFC 2104: HMAC(K, m) = H((K ⊕ opad) || H((K ⊕ ipad) || m))
     *
     * @param {Array} message - Message to authenticate
     * @param {Array} key - Secret key
     * @returns {Array} HMAC digest (32 bytes)
     */
    _computeHMAC(message, key) {
      // Step 1: Prepare key (hash if too long, pad if too short)
      let processedKey = [...key];

      // If key is longer than block size, hash it first
      if (processedKey.length > this.BLOCK_SIZE) {
        processedKey = this._hashSHA256(processedKey);
      }

      // Pad key to block size with zeros
      while (processedKey.length < this.BLOCK_SIZE) {
        processedKey.push(0);
      }

      // Step 2: Create inner and outer padded keys
      // K ⊕ ipad and K ⊕ opad
      const innerKey = new Array(this.BLOCK_SIZE);
      const outerKey = new Array(this.BLOCK_SIZE);

      for (let i = 0; i < this.BLOCK_SIZE; i++) {
        innerKey[i] = processedKey[i] ^ this.IPAD;
        outerKey[i] = processedKey[i] ^ this.OPAD;
      }

      // Step 3: Inner hash - H((K ⊕ ipad) || message)
      const innerData = [...innerKey, ...message];
      const innerHash = this._hashSHA256(innerData);

      // Step 4: Outer hash - H((K ⊕ opad) || innerHash)
      const outerData = [...outerKey, ...innerHash];
      const finalHash = this._hashSHA256(outerData);

      // Clear sensitive data
      OpCodes.ClearArray(processedKey);
      OpCodes.ClearArray(innerKey);
      OpCodes.ClearArray(outerKey);

      return finalHash;
    }

    /**
     * Clear sensitive data
     */
    ClearData() {
      if (this._key) {
        OpCodes.ClearArray(this._key);
        this._key = null;
      }
      if (this.inputBuffer) {
        OpCodes.ClearArray(this.inputBuffer);
        this.inputBuffer = [];
      }
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new HMACSHA256Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { HMACSHA256Algorithm, HMACSHA256Instance };
}));
