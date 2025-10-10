/*
 * HKDF Implementation
 * Educational implementation of HMAC-based Key Derivation Function (RFC 5869)
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

  // Load required hash functions for HMAC
  if (typeof require !== 'undefined') {
    try {
      require('../hash/sha256.js');
      require('../hash/sha512.js');
      require('../hash/sha1.js');
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

  class HKDFAlgorithm extends KdfAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "HKDF";
      this.description = "HMAC-based Key Derivation Function (HKDF) as defined in RFC 5869. Two-step Extract-and-Expand process for deriving cryptographic keys from input keying material using salt and application-specific info parameters.";
      this.inventor = "Hugo Krawczyk, Pasi Eronen";
      this.year = 2010;
      this.category = CategoryType.KDF;
      this.subCategory = "Extract-and-Expand KDF";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // KDF-specific properties
      this.SaltRequired = false; // Salt is optional in HKDF
      this.SupportedOutputSizes = [1, 255 * 64]; // 1 to 255*hash_len bytes

      // HKDF constants
      this.DEFAULT_HASH = 'SHA256';
      this.DEFAULT_OUTPUT_LENGTH = 32;
      this.HASH_FUNCTIONS = {
        'SHA1': { size: 20, name: 'SHA-1' },
        'SHA256': { size: 32, name: 'SHA-256' },
        'SHA512': { size: 64, name: 'SHA-512' }
      };

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 5869 - HMAC-based Extract-and-Expand Key Derivation Function (HKDF)", "https://tools.ietf.org/html/rfc5869"),
        new LinkItem("NIST SP 800-56C - Recommendation for Key Derivation Methods", "https://csrc.nist.gov/publications/detail/sp/800-56c/rev-2/final"),
        new LinkItem("Wikipedia - HKDF", "https://en.wikipedia.org/wiki/HKDF")
      ];

      this.references = [
        new LinkItem("OpenSSL EVP_PKEY_derive", "https://github.com/openssl/openssl/blob/master/crypto/kdf/hkdf.c"),
        new LinkItem("Python cryptography.hazmat.primitives.kdf.hkdf", "https://cryptography.io/en/latest/hazmat/primitives/key-derivation-functions/#hkdf"),
        new LinkItem("Go crypto/hkdf", "https://golang.org/pkg/golang.org/x/crypto/hkdf/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Weak Hash Function",
          "Use secure hash functions like SHA-256 or SHA-512 instead of SHA-1 or MD5"
        ),
        new Vulnerability(
          "Insufficient Input Entropy",
          "Ensure input keying material has sufficient entropy for cryptographic security"
        )
      ];

      // Test vectors from RFC 5869
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b"),
          OpCodes.Hex8ToBytes("3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865"),
          "HKDF-SHA256 RFC 5869 Test Case 1",
          "https://tools.ietf.org/html/rfc5869"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f"),
          OpCodes.Hex8ToBytes("b11e398dc80327a1c8e7f78c596a49344f012eda2d4efad8a050cc4c19afa97c59045a99cac7827271cb41c65e590e09da3275600c2f09b8367793a9aca3db71cc30c58179ec3e87c14c01d5c1f3434f1d87"),
          "HKDF-SHA256 RFC 5869 Test Case 2 - longer inputs",
          "https://tools.ietf.org/html/rfc5869"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b"),
          OpCodes.Hex8ToBytes("8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d9d201395faa4b61a96c8"),
          "HKDF-SHA256 RFC 5869 Test Case 3 - zero-length salt",
          "https://tools.ietf.org/html/rfc5869"
        )
      ];

      // Add test parameters for each test vector
      this.tests[0].salt = OpCodes.Hex8ToBytes("000102030405060708090a0b0c");
      this.tests[0].info = OpCodes.Hex8ToBytes("f0f1f2f3f4f5f6f7f8f9");
      this.tests[0].outputSize = 42;
      this.tests[0].hashFunction = 'SHA256';

      this.tests[1].salt = OpCodes.Hex8ToBytes("606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeaf");
      this.tests[1].info = OpCodes.Hex8ToBytes("b0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff");
      this.tests[1].outputSize = 82;
      this.tests[1].hashFunction = 'SHA256';

      this.tests[2].salt = [];
      this.tests[2].info = [];
      this.tests[2].outputSize = 42;
      this.tests[2].hashFunction = 'SHA256';
    }

    CreateInstance(isInverse = false) {
      return new HKDFInstance(this, isInverse);
    }
  }

  class HKDFInstance extends IKdfInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 32; // Default 256-bit output
      this._salt = [];
      this._info = [];
      this._hashFunction = 'SHA256';
    }

    // Property getters and setters
    get salt() { return this._salt; }
    set salt(value) { this._salt = value; }

    get info() { return this._info; }
    set info(value) { this._info = value; }

    get outputSize() { return this.OutputSize; }
    set outputSize(value) { this.OutputSize = value; }

    get hashFunction() { return this._hashFunction; }
    set hashFunction(value) { this._hashFunction = value; }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('HKDFInstance.Feed: Input must be byte array (input keying material)');
      }

      if (this.isInverse) {
        throw new Error('HKDFInstance.Feed: HKDF cannot be reversed (one-way function)');
      }

      // Store input data for Result() method
      this._inputData = data;
    }

    Result() {
      // HKDF can work with pre-set parameters or fed data
      if (!this.ikm && !this._inputData) {
        throw new Error('HKDFInstance.Result: Input Keying Material required - use Feed() method or set ikm directly');
      }

      const ikm = this.ikm || this._inputData;
      const salt = this._salt || [];
      const info = this._info || [];
      const outputSize = this.OutputSize || 32;
      const hashFunc = this._hashFunction || 'SHA256';

      return this.deriveKey(ikm, salt, info, outputSize, hashFunc);
    }

    deriveKey(ikm, salt, info, outputLength, hashFunction) {
      // Step 1: Extract - PRK = HMAC-Hash(salt, IKM)
      const prk = this.extract(ikm, salt, hashFunction);

      // Step 2: Expand - OKM = HKDF-Expand(PRK, info, L)
      const okm = this.expand(prk, info, outputLength, hashFunction);

      return okm;
    }

    extract(ikm, salt, hashFunction) {
      // Convert byte array to string if needed
      const hashName = Array.isArray(hashFunction) ? String.fromCharCode(...hashFunction) : hashFunction;
      const hashInfo = this.algorithm.HASH_FUNCTIONS[hashName];
      if (!hashInfo) {
        throw new Error('Unsupported hash function: ' + hashName);
      }

      // If salt is empty, use string of zeros of hash length
      const actualSalt = salt.length > 0 ? salt : new Array(hashInfo.size).fill(0);

      // PRK = HMAC-Hash(salt, IKM)
      return this.calculateHMAC(actualSalt, ikm, hashFunction);
    }

    expand(prk, info, outputLength, hashFunction) {
      // Convert byte array to string if needed
      const hashName = Array.isArray(hashFunction) ? String.fromCharCode(...hashFunction) : hashFunction;
      const hashInfo = this.algorithm.HASH_FUNCTIONS[hashName];
      if (!hashInfo) {
        throw new Error('Unsupported hash function: ' + hashName);
      }

      const hashLen = hashInfo.size;
      const numBlocks = Math.ceil(outputLength / hashLen);

      // Check output length constraint
      if (numBlocks > 255) {
        throw new Error('Output length too large for HKDF-Expand');
      }

      let okm = [];
      let previousBlock = [];

      // Generate each block: T(i) = HMAC-Hash(PRK, T(i-1) | info | i)
      for (let i = 1; i <= numBlocks; i++) {
        const blockInput = previousBlock.concat(info).concat([i]);
        const blockHash = this.calculateHMAC(prk, blockInput, hashFunction);

        okm = okm.concat(blockHash);

        // T(i-1) for next iteration
        previousBlock = blockHash.slice();
      }

      // Truncate to desired length
      return okm.slice(0, outputLength);
    }

    calculateHMAC(key, message, hashFunction) {
      // Standalone HMAC implementation (RFC 2104)
      // HMAC(K, m) = H((K' XOR opad) || H((K' XOR ipad) || m))
      // where K' is the key padded to block size

      const hashName = Array.isArray(hashFunction)
        ? String.fromCharCode(...hashFunction)
        : hashFunction;

      const hashInfo = this.algorithm.HASH_FUNCTIONS[hashName];
      if (!hashInfo) {
        throw new Error('Unsupported hash function: ' + hashName);
      }

      const blockSize = 64; // SHA-256 and SHA-512 both use 64-byte blocks
      const hashLen = hashInfo.size;

      // Get hash algorithm from framework
      const hashAlg = AlgorithmFramework.Find(hashInfo.name);
      if (!hashAlg) {
        throw new Error('Hash function not found: ' + hashInfo.name);
      }

      // Prepare key - pad or hash if needed
      let keyPrime = [...key];
      if (keyPrime.length > blockSize) {
        // If key is longer than block size, hash it first
        const hashInst = hashAlg.CreateInstance();
        hashInst.Feed(keyPrime);
        keyPrime = hashInst.Result();
      }

      // Pad key to block size
      while (keyPrime.length < blockSize) {
        keyPrime.push(0);
      }

      // HMAC constants
      const ipad = 0x36;
      const opad = 0x5c;

      // Inner hash: H((K' XOR ipad) || message)
      const innerKey = keyPrime.map(b => b ^ ipad);
      const innerInput = innerKey.concat(message);
      const innerHashInst = hashAlg.CreateInstance();
      const innerHash = innerHashInst.Hash(innerInput);

      // Outer hash: H((K' XOR opad) || innerHash)
      const outerKey = keyPrime.map(b => b ^ opad);
      const outerInput = outerKey.concat(innerHash);
      const outerHashInst = hashAlg.CreateInstance();
      const result = outerHashInst.Hash(outerInput);

      return result;
    }

  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new HKDFAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { HKDFAlgorithm, HKDFInstance };
}));