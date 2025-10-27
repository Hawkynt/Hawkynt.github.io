/*
 * Triple DES Key Wrap (RFC 3217) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Implements Triple-DES key wrapping as specified in RFC 3217.
 * Uses Triple-DES in CBC mode with CMS Key Checksum for integrity.
 *
 * Algorithm:
 * - Wrapping: Compute SHA-1 checksum, encrypt with 3DES-CBC twice
 * - Unwrapping: Decrypt with 3DES-CBC twice, verify checksum
 *
 * DEPRECATED: Use AES Key Wrap (RFC 3394) for modern applications
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

  // ===== CONSTANTS =====

  // RFC 3217 - Fixed IV for second encryption pass
  const IV2 = Object.freeze([0x4a, 0xdd, 0xa2, 0x2c, 0x79, 0xe8, 0x21, 0x05]);

  // ===== ALGORITHM IMPLEMENTATION =====

  class DESedeWrapAlgorithm extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Triple DES Key Wrap";
      this.description = "RFC 3217 key wrapping using Triple-DES in CBC mode with CMS key checksum. Wraps cryptographic keys for secure transport using 3DES encryption and SHA-1 integrity checking.";
      this.inventor = "IETF S/MIME Working Group";
      this.year = 2001;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Key Wrapping";
      this.securityStatus = SecurityStatus.DEPRECATED;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.INTL;

      // Algorithm capabilities
      this.SupportedKeySizes = [
        new KeySize(24, 24, 1)  // 192-bit (24-byte) 3DES keys only
      ];

      // Documentation with direct links to specifications
      this.documentation = [
        new LinkItem("RFC 3217 - Triple-DES Key Wrap", "https://www.rfc-editor.org/rfc/rfc3217.txt"),
        new LinkItem("CMS Key Checksum Algorithm", "https://www.w3.org/TR/xmlenc-core/#sec-CMSKeyChecksum"),
        new LinkItem("NIST SP 800-38F - Block Cipher Modes (Key Wrap)", "https://csrc.nist.gov/publications/detail/sp/800-38f/final")
      ];

      this.references = [
        new LinkItem("Bouncy Castle DESedeWrapEngine", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/DESedeWrapEngine.java"),
        new LinkItem("RFC 3217 Specification", "https://www.rfc-editor.org/rfc/rfc3217.txt")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability(
          "Deprecated Algorithm",
          "Triple-DES is deprecated by NIST. SHA-1 checksum is cryptographically broken.",
          "Use AES Key Wrap (RFC 3394) for modern applications"
        ),
        new Vulnerability(
          "Small Block Size",
          "64-bit block size limits the amount of data that can be safely wrapped",
          "Use AES-based key wrapping for larger keys"
        )
      ];

      // Test vectors from RFC 3217
      this.tests = [
        {
          text: "RFC 3217 Example - Triple-DES Key Wrap",
          uri: "https://www.rfc-editor.org/rfc/rfc3217.txt",
          input: OpCodes.Hex8ToBytes("2923bf85e06dd6ae529149f1f1bae9eab3a7da3d860d3e98"),
          key: OpCodes.Hex8ToBytes("255e0d1c07b646dfb3134cc843ba8aa71f025b7c0838251f"),
          iv: OpCodes.Hex8ToBytes("5dd4cbfc96f5453b"),
          expected: OpCodes.Hex8ToBytes("690107618ef092b3b48ca1796b234ae9fa33ebb415960403" +
                                        "7db5d6a84eb3aac2768c632775a467d4")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DESedeWrapInstance(this, isInverse);
    }
  }

  // ===== INSTANCE IMPLEMENTATION =====

  class DESedeWrapInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._iv = null;

      // Cache for 3DES and SHA-1 algorithms
      this._tripleDesAlgorithm = null;
      this._sha1Algorithm = null;
    }

    // Property: key (KEK - Key Encryption Key)
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      // Validate key size (must be 24 bytes for 3DES EDE3)
      if (keyBytes.length !== 24) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Triple-DES Key Wrap requires 24-byte (192-bit) keys`);
      }

      this._key = [...keyBytes];
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property: iv (Initialization Vector for wrapping)
    set iv(ivBytes) {
      if (!ivBytes) {
        this._iv = null;
        return;
      }

      // Validate IV size (must be 8 bytes for DES block size)
      if (ivBytes.length !== 8) {
        throw new Error(`Invalid IV size: ${ivBytes.length} bytes. IV must be 8 bytes`);
      }

      this._iv = [...ivBytes];
    }

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    // Feed/Result pattern implementation
    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      const result = this.isInverse
        ? this._unwrap(this.inputBuffer)
        : this._wrap(this.inputBuffer);

      this.inputBuffer = []; // Clear for next operation
      return result;
    }

    // ===== WRAPPING ALGORITHM =====

    _wrap(keyToWrap) {
      if (!this._iv) {
        throw new Error("IV not set. Wrapping requires an 8-byte IV");
      }

      // Step 1: Compute CMS Key Checksum (first 8 bytes of SHA-1)
      const checksum = this._calculateCMSKeyChecksum(keyToWrap);

      // Step 2: Concatenate key and checksum: WKCKS = WK || CKS
      const wkcks = [...keyToWrap, ...checksum];

      // Step 3: Pad to multiple of 8 bytes if needed
      const blockSize = 8;
      if (wkcks.length % blockSize !== 0) {
        throw new Error("WKCKS length must be multiple of 8 bytes");
      }

      // Step 4: Encrypt WKCKS in CBC mode using KEK and IV -> TEMP1
      const temp1 = this._cbcEncrypt(wkcks, this._key, this._iv);

      // Step 5: Concatenate IV and TEMP1: TEMP2 = IV || TEMP1
      const temp2 = [...this._iv, ...temp1];

      // Step 6: Reverse the order of octets in TEMP2
      const temp3 = [...temp2].reverse();

      // Step 7: Encrypt TEMP3 in CBC mode using KEK and IV2 -> result
      const result = this._cbcEncrypt(temp3, this._key, IV2);

      return result;
    }

    // ===== UNWRAPPING ALGORITHM =====

    _unwrap(wrappedKey) {
      const blockSize = 8;

      // Validate wrapped key length
      if (wrappedKey.length % blockSize !== 0) {
        throw new Error(`Wrapped key length must be multiple of ${blockSize} bytes`);
      }

      // Step 1: Decrypt with KEK and IV2 -> TEMP3
      const temp3 = this._cbcDecrypt(wrappedKey, this._key, IV2);

      // Step 2: Reverse the order of octets in TEMP3 -> TEMP2
      const temp2 = [...temp3].reverse();

      // Step 3: Decompose TEMP2 into IV (first 8 bytes) and TEMP1 (remaining)
      const extractedIV = temp2.slice(0, 8);
      const temp1 = temp2.slice(8);

      // Step 4: Decrypt TEMP1 using KEK and extracted IV -> WKCKS
      const wkcks = this._cbcDecrypt(temp1, this._key, extractedIV);

      // Step 5: Decompose WKCKS: key is all but last 8 bytes, checksum is last 8 bytes
      if (wkcks.length < 8) {
        throw new Error("Invalid wrapped key: too short");
      }

      const unwrappedKey = wkcks.slice(0, wkcks.length - 8);
      const receivedChecksum = wkcks.slice(wkcks.length - 8);

      // Step 6: Verify CMS Key Checksum
      const computedChecksum = this._calculateCMSKeyChecksum(unwrappedKey);

      if (!OpCodes.ArraysEqual(computedChecksum, receivedChecksum)) {
        throw new Error("Checksum verification failed: wrapped key is corrupted or tampered");
      }

      return unwrappedKey;
    }

    // ===== CMS KEY CHECKSUM =====

    /**
     * Calculate CMS Key Checksum as specified in RFC 3217:
     * 1. Compute SHA-1 hash of the key
     * 2. Use first 8 octets as checksum
     */
    _calculateCMSKeyChecksum(key) {
      const sha1 = this._getSHA1Algorithm();
      const sha1Instance = sha1.CreateInstance();

      sha1Instance.Feed(key);
      const hash = sha1Instance.Result();

      // Return first 8 bytes of SHA-1 hash
      return hash.slice(0, 8);
    }

    // ===== CBC MODE ENCRYPTION/DECRYPTION =====

    /**
     * Encrypt data using 3DES in CBC mode
     */
    _cbcEncrypt(plaintext, key, iv) {
      const blockSize = 8;
      const result = [];
      let previousBlock = [...iv];

      const tripleDesInstance = this._getTripleDESAlgorithm().CreateInstance(false);
      tripleDesInstance.key = key;

      for (let i = 0; i < plaintext.length; i += blockSize) {
        const block = plaintext.slice(i, i + blockSize);

        // XOR with previous ciphertext block (CBC mode)
        const xored = OpCodes.XorArrays(block, previousBlock);

        // Encrypt the XORed block
        tripleDesInstance.Feed(xored);
        const encrypted = tripleDesInstance.Result();

        result.push(...encrypted);
        previousBlock = encrypted;
      }

      return result;
    }

    /**
     * Decrypt data using 3DES in CBC mode
     */
    _cbcDecrypt(ciphertext, key, iv) {
      const blockSize = 8;
      const result = [];
      let previousBlock = [...iv];

      const tripleDesInstance = this._getTripleDESAlgorithm().CreateInstance(true);
      tripleDesInstance.key = key;

      for (let i = 0; i < ciphertext.length; i += blockSize) {
        const block = ciphertext.slice(i, i + blockSize);

        // Decrypt the block
        tripleDesInstance.Feed(block);
        const decrypted = tripleDesInstance.Result();

        // XOR with previous ciphertext block (CBC mode)
        const xored = OpCodes.XorArrays(decrypted, previousBlock);

        result.push(...xored);
        previousBlock = block;
      }

      return result;
    }

    // ===== ALGORITHM LOADING =====

    /**
     * Load Triple-DES algorithm with fallback strategies
     */
    _getTripleDESAlgorithm() {
      if (this._tripleDesAlgorithm) {
        return this._tripleDesAlgorithm;
      }

      // Strategy 1: Try to require 3DES directly (Node.js/TestSuite)
      if (typeof require !== 'undefined') {
        try {
          require('../block/3des.js');
        } catch (e) {
          // Require failed, will fall back to registry lookup
        }
      }

      // Strategy 2: Look up in AlgorithmFramework registry
      const framework = (typeof AlgorithmFramework !== 'undefined') ? AlgorithmFramework :
                       (typeof global !== 'undefined' && global.AlgorithmFramework) ? global.AlgorithmFramework :
                       (typeof window !== 'undefined' && window.AlgorithmFramework) ? window.AlgorithmFramework : null;

      if (framework) {
        const algorithms = framework.Algorithms || [];
        const tripleDesAlgorithm = algorithms.find(alg =>
          alg.name === '3DES (Triple DES)' || alg.name === '3DES' || alg.name === 'Triple DES'
        );

        if (tripleDesAlgorithm) {
          this._tripleDesAlgorithm = tripleDesAlgorithm;
          return tripleDesAlgorithm;
        }
      }

      throw new Error(
        "Triple-DES algorithm not found. DESedeWrap requires 3DES to be available. " +
        "Ensure 3des.js is loaded before desedewrap.js"
      );
    }

    /**
     * Load SHA-1 algorithm with fallback strategies
     */
    _getSHA1Algorithm() {
      if (this._sha1Algorithm) {
        return this._sha1Algorithm;
      }

      // Strategy 1: Try to require SHA-1 directly (Node.js/TestSuite)
      if (typeof require !== 'undefined') {
        try {
          require('../hash/sha1.js');
        } catch (e) {
          // Require failed, will fall back to registry lookup
        }
      }

      // Strategy 2: Look up in AlgorithmFramework registry
      const framework = (typeof AlgorithmFramework !== 'undefined') ? AlgorithmFramework :
                       (typeof global !== 'undefined' && global.AlgorithmFramework) ? global.AlgorithmFramework :
                       (typeof window !== 'undefined' && window.AlgorithmFramework) ? window.AlgorithmFramework : null;

      if (framework) {
        const algorithms = framework.Algorithms || [];
        const sha1Algorithm = algorithms.find(alg => alg.name === 'SHA-1' || alg.name === 'SHA1');

        if (sha1Algorithm) {
          this._sha1Algorithm = sha1Algorithm;
          return sha1Algorithm;
        }
      }

      throw new Error(
        "SHA-1 algorithm not found. DESedeWrap requires SHA-1 for CMS key checksum. " +
        "Ensure sha1.js is loaded before desedewrap.js"
      );
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DESedeWrapAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DESedeWrapAlgorithm, DESedeWrapInstance };
}));
