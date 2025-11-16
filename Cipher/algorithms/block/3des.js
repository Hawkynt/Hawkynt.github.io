/*
 * 3DES (Triple DES) Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Migrated from legacy Cipher.js API to modern AlgorithmFramework
 * Implements Triple Data Encryption Standard in EDE mode
 * Educational implementation - DEPRECATED by NIST in 2019
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

  /**
 * TripleDESAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class TripleDESAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "3DES (Triple DES)";
      this.description = "Triple Data Encryption Standard applies DES encryption three times in EDE mode. Supports both EDE2 (112-bit effective security) and EDE3 (168-bit key) modes. Deprecated by NIST in 2019.";
      this.inventor = "IBM (based on DES)";
      this.year = 1978;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 24, 8)  // EDE2 (16 bytes) or EDE3 (24 bytes)
      ];
      this.SupportedBlockSizes = [
        new KeySize(8, 8, 0)    // 64-bit blocks only
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("NIST SP 800-67 Rev 2 - Triple DES Guidelines", "https://csrc.nist.gov/publications/detail/sp/800-67/rev-2/final"),
        new LinkItem("FIPS 46-3 - Data Encryption Standard", "https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25"),
        new LinkItem("Wikipedia - Triple DES", "https://en.wikipedia.org/wiki/Triple_DES")
      ];

      this.references = [
        new LinkItem("OpenSSL 3DES Implementation", "https://github.com/openssl/openssl/blob/master/crypto/des/"),
        new LinkItem("NIST CAVP 3DES Test Vectors", "https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program/block-ciphers"),
        new LinkItem("Crypto++ 3DES Implementation", "https://github.com/weidai11/cryptopp/blob/master/3des.cpp"),
        new LinkItem("libgcrypt 3DES Implementation", "https://github.com/gpg/libgcrypt/blob/master/cipher/des.c"),
        new LinkItem('Bouncy Castle 3DES Implementation', 'https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines'),
        new LinkItem('Microsoft .NET 3DES Implementation','https://docs.microsoft.com/en-us/dotnet/api/system.security.cryptography.tripledes')
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability(
          "Meet-in-the-middle attack",
          "Effective security reduced to 112 bits instead of theoretical 168 bits",
          "Use AES-128 or higher for new applications"
        ),
        new Vulnerability(
          "Small block size",
          "64-bit block size vulnerable to birthday attacks",
          "Avoid encrypting large amounts of data with single key"
        )
      ];

      // Test vectors using OpCodes byte arrays
      this.tests = [
        {
          text: "3DES EDE2 mode - educational test vector",
          uri: "https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25",
          input: OpCodes.Hex8ToBytes("0123456789abcdef"),
          key: OpCodes.Hex8ToBytes("0123456789abcdef23456789abcdef01"),
          expected: OpCodes.Hex8ToBytes("A6BB373E196B375E")
        },
        {
          text: "3DES EDE3 mode - educational test vector", 
          uri: "https://csrc.nist.gov/publications/detail/sp/800-67/rev-2/final",
          input: OpCodes.Hex8ToBytes("0123456789abcdef"),
          key: OpCodes.Hex8ToBytes("0123456789abcdef23456789abcdef01456789abcdef0123"),
          expected: OpCodes.Hex8ToBytes("F2AFD84EE809E2B5")
        },
        {
          text: "3DES EDE2 mode - all zeros plaintext",
          uri: "https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program/block-ciphers",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("01010101010101010101010101010101"),
          expected: OpCodes.Hex8ToBytes("8CA64DE9C1B123A7")
        },
        {
          text: "3DES EDE2 mode - FIPS 46-3 test vector",
          uri: "https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25",
          KeySize: 16,
          input: OpCodes.Hex8ToBytes("0123456789abcdef"),
          key: OpCodes.Hex8ToBytes("0123456789abcdef23456789abcdef01"),
          expected: OpCodes.Hex8ToBytes("A6BB373E196B375E")
        },
        {
          text: "3DES EDE3 mode - three distinct keys",
          uri: "https://csrc.nist.gov/publications/detail/sp/800-67/rev-2/final",
          KeySize: 24,
          input: OpCodes.Hex8ToBytes("0123456789abcdef"),
          key: OpCodes.Hex8ToBytes("0123456789abcdef23456789abcdef01456789abcdef0123"),
          expected: OpCodes.Hex8ToBytes("F2AFD84EE809E2B5")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new TripleDESInstance(this, isInverse);
    }
  }

  /**
 * TripleDES cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class TripleDESInstance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;

      // 3DES-specific state
      this._subKeys = null;
      this._mode = null; // 'EDE2' or 'EDE3'

      // Cache for DES algorithm
      this._desAlgorithm = null;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this._subKeys = null;
        this._mode = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size (16 or 24 bytes)
      if (keyBytes.length !== 16 && keyBytes.length !== 24) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. 3DES requires 16 bytes (EDE2) or 24 bytes (EDE3)`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;

      // Set up 3DES mode and sub-keys
      if (keyBytes.length === 16) {
        // EDE2 mode: K1-K2-K1
        this._mode = 'EDE2';
        this._subKeys = {
          k1: keyBytes.slice(0, 8),
          k2: keyBytes.slice(8, 16),
          k3: keyBytes.slice(0, 8)  // K1 reused
        };
      } else {
        // EDE3 mode: K1-K2-K3
        this._mode = 'EDE3';
        this._subKeys = {
          k1: keyBytes.slice(0, 8),
          k2: keyBytes.slice(8, 16),
          k3: keyBytes.slice(16, 24)
        };
      }
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Validate input length for block cipher
      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
      }

      const output = [];
      const blockSize = this.BlockSize;

      // Process each block
      for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
        const block = this.inputBuffer.slice(i, i + blockSize);
        const processedBlock = this.isInverse 
          ? this._decryptBlock(block) 
          : this._encryptBlock(block);
        output.push(...processedBlock);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    _encryptBlock(block) {
      if (block.length !== 8) {
        throw new Error("3DES requires exactly 8 bytes per block");
      }

      // Triple DES EDE encryption: E_K3(D_K2(E_K1(P)))
      let result = [...block];

      // Step 1: Encrypt with K1
      result = this._desEncrypt(result, this._subKeys.k1);

      // Step 2: Decrypt with K2  
      result = this._desDecrypt(result, this._subKeys.k2);

      // Step 3: Encrypt with K3
      result = this._desEncrypt(result, this._subKeys.k3);

      return result;
    }

    _decryptBlock(block) {
      if (block.length !== 8) {
        throw new Error("3DES requires exactly 8 bytes per block");
      }

      // Triple DES EDE decryption: D_K1(E_K2(D_K3(C)))
      let result = [...block];

      // Step 1: Decrypt with K3
      result = this._desDecrypt(result, this._subKeys.k3);

      // Step 2: Encrypt with K2
      result = this._desEncrypt(result, this._subKeys.k2);

      // Step 3: Decrypt with K1
      result = this._desDecrypt(result, this._subKeys.k1);

      return result;
    }

    // Use real DES algorithm for proper 3DES implementation
    _desEncrypt(block, key) {
      return this._callDES(block, key, false);
    }

    _desDecrypt(block, key) {
      return this._callDES(block, key, true);
    }

    // Use DES implementation with lazy loading and fallback strategies
    _callDES(data, key, decrypt = false) {
      if (data.length !== 8 || key.length !== 8) {
        throw new Error("DES requires 8-byte blocks and keys");
      }

      // Lazy load DES algorithm if not already cached
      if (!this._desAlgorithm) {
        this._desAlgorithm = this._loadDESAlgorithm();
      }

      // Create a DES instance
      const desInstance = this._desAlgorithm.CreateInstance(decrypt);

      // Set the DES key
      desInstance.key = key;

      // Process the data
      desInstance.Feed(data);
      const result = desInstance.Result();

      return result;
    }

    // Load DES algorithm using multiple fallback strategies
    _loadDESAlgorithm() {
      // Strategy 1: Try to require DES directly (works in Node.js/TestSuite)
      if (typeof require !== 'undefined') {
        try {
          // Try relative path first
          const desPath = require.resolve('./des.js');
          delete require.cache[desPath]; // Clear cache to ensure fresh load
          require(desPath);
        } catch (e1) {
          try {
            // Try alternative path
            require('../../algorithms/block/des.js');
          } catch (e2) {
            // Require failed, will fall back to registry lookup
          }
        }
      }

      // Strategy 2: Look up in AlgorithmFramework registry (works in browser/web UI)
      const framework = (typeof AlgorithmFramework !== 'undefined') ? AlgorithmFramework :
                       (typeof global !== 'undefined' && global.AlgorithmFramework) ? global.AlgorithmFramework :
                       (typeof window !== 'undefined' && window.AlgorithmFramework) ? window.AlgorithmFramework : null;

      if (framework) {
        const algorithms = framework.Algorithms || [];
        const desAlgorithm = algorithms.find(alg => alg.name === 'DES');
        if (desAlgorithm) {
          return desAlgorithm;
        }
      }

      // Strategy 3: Final fallback - detailed error with helpful message
      throw new Error(
        "DES algorithm not found. 3DES requires DES to be available. " +
        "In Node.js environments, ensure DES is required before 3DES. " +
        "In browser environments, ensure des.js is loaded before 3des.js in index.html."
      );
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new TripleDESAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { TripleDESAlgorithm, TripleDESInstance };
}));