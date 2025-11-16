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
          CryptoAlgorithm, IAlgorithmInstance,
          TestCase, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;

  // GOST 28147-89 Key Wrap Algorithm
  class GOST28147WrapAlgorithm extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "GOST 28147-89 Key Wrap";
      this.description = "Key wrapping algorithm using GOST 28147-89 block cipher with MAC authentication. Wraps keys by encrypting blocks and appending a 4-byte MAC for integrity verification.";
      this.inventor = "Soviet/Russian standard committee";
      this.year = 1989;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Key Wrapping";
      this.securityStatus = SecurityStatus.DEPRECATED;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(32, 32, 0) // GOST 28147-89 uses 256-bit keys only
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("GOST 28147-89 Standard (TC26)", "https://www.tc26.ru/en/standard/gost/"),
        new LinkItem("RFC 4357 - Additional Cryptographic Algorithms for GOST 28147-89", "https://www.rfc-editor.org/rfc/rfc4357"),
        new LinkItem("GOST R 34.12-2015 Block Ciphers", "https://www.tc26.ru/en/standard/gost/GOST_R_3412-2015.pdf")
      ];

      this.references = [
        new LinkItem("BouncyCastle GOST28147WrapEngine.java", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/GOST28147WrapEngine.java"),
        new LinkItem("GOST 28147-89 Block Cipher", "https://en.wikipedia.org/wiki/GOST_(block_cipher)")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Deprecated standard",
          "GOST 28147-89 has been superseded by newer Russian standards (Kuznyechik/Magma in GOST R 34.12-2015).",
          "Use modern key wrap algorithms like AES Key Wrap (RFC 3394) for new applications."
        ),
        new Vulnerability(
          "Fixed key size requirement",
          "GOST 28147-89 Key Wrap requires exactly 32 bytes (256 bits) of key material for wrapping. Plaintext must be exactly 32 bytes (4 blocks).",
          "Ensure proper key derivation and size validation before wrapping operations."
        )
      ];

      // Test vectors generated using reference GOST 28147-89 implementation
      // The algorithm wraps 32-byte keys by encrypting 4 blocks and appending 4-byte MAC
      // Test vector verified against BouncyCastle GOST28147WrapEngine structure
      this.tests = [
        {
          text: 'GOST 28147-89 Key Wrap - 32-byte key material with UKM',
          uri: 'https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/GOST28147WrapEngine.java',
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("546d203368656c326973652073736e62206167796967747473656865202c3d73"),
          ukm: OpCodes.Hex8ToBytes("1234567890abcdef"),
          expected: OpCodes.Hex8ToBytes("c38aa7f55384318ae9cf31fd318321eb9b8c95186ecfb5daec6b76079ddbea7c37650afa")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new GOST28147WrapInstance(this, isInverse);
    }
  }

  // GOST 28147-89 Key Wrap Instance
  /**
 * GOST28147Wrap cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class GOST28147WrapInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._ukm = null; // User Keying Material (used as IV for MAC)
      this.gostCipherEngine = null;
      this.gostMacEngine = null;
    }

    // Property setter for key
    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.gostCipherEngine = null;
        this.gostMacEngine = null;
        return;
      }

      // Validate key size
      if (keyBytes.length !== 32) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (must be exactly 32 bytes)`);
      }

      this._key = [...keyBytes];

      // Create cipher engine for wrap/unwrap
      const GOST28147Algorithm = this._getGOST28147Algorithm();
      this.gostCipherEngine = GOST28147Algorithm.CreateInstance(this.isInverse);
      this.gostCipherEngine.key = keyBytes;

      // Create MAC engine for authentication
      const GOST28147MACAlgorithm = this._getGOST28147MACAlgorithm();
      this.gostMacEngine = GOST28147MACAlgorithm.CreateInstance(false);
      this.gostMacEngine.key = keyBytes;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property setter for UKM (User Keying Material - used as MAC IV)
    set ukm(ukmBytes) {
      if (!ukmBytes) {
        this._ukm = null;
        return;
      }

      if (ukmBytes.length !== 8) {
        throw new Error("UKM must be exactly 8 bytes");
      }

      this._ukm = [...ukmBytes];

      // Update MAC engine with UKM as IV
      if (this.gostMacEngine) {
        this.gostMacEngine.iv = ukmBytes;
      }
    }

    get ukm() {
      return this._ukm ? [...this._ukm] : null;
    }

    // Feed data to wrap/unwrap
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      if (!this._ukm) throw new Error("UKM not set");

      this.inputBuffer.push(...data);
    }

    // Get wrapped/unwrapped result
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._ukm) throw new Error("UKM not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      const result = this.isInverse
        ? this._unwrap(this.inputBuffer)
        : this._wrap(this.inputBuffer);

      this.inputBuffer = []; // Clear buffer
      return result;
    }

    // GOST 28147-89 Key Wrap implementation
    _wrap(plaintext) {
      // Validate input length (must be exactly 32 bytes = 4 blocks of 8 bytes)
      if (plaintext.length !== 32) {
        throw new Error("Plaintext must be exactly 32 bytes (4 blocks) for GOST 28147-89 Key Wrap");
      }

      const MAC_SIZE = 4;
      const BLOCK_SIZE = 8;
      const wrappedKey = new Array(plaintext.length + MAC_SIZE);

      // Step 1: Compute MAC over the plaintext
      this.gostMacEngine.Feed(plaintext);
      const macBytes = this.gostMacEngine.Result();

      // Step 2: Encrypt all 4 blocks of plaintext
      for (let i = 0; i < 4; ++i) {
        const block = plaintext.slice(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE);
        this.gostCipherEngine.Feed(block);
        const encryptedBlock = this.gostCipherEngine.Result();

        // Copy encrypted block to output
        for (let j = 0; j < BLOCK_SIZE; ++j) {
          wrappedKey[i * BLOCK_SIZE + j] = encryptedBlock[j];
        }
      }

      // Step 3: Append MAC (4 bytes) to the end
      for (let i = 0; i < MAC_SIZE; ++i) {
        wrappedKey[plaintext.length + i] = macBytes[i];
      }

      return wrappedKey;
    }

    // GOST 28147-89 Key Unwrap implementation
    _unwrap(ciphertext) {
      // Validate input length (must be exactly 36 bytes = 4 blocks + 4-byte MAC)
      const MAC_SIZE = 4;
      const BLOCK_SIZE = 8;
      const expectedLength = 32 + MAC_SIZE; // 4 blocks + MAC

      if (ciphertext.length !== expectedLength) {
        throw new Error(`Ciphertext must be exactly ${expectedLength} bytes for GOST 28147-89 Key Unwrap`);
      }

      const decKey = new Array(ciphertext.length - MAC_SIZE);

      // Step 1: Decrypt all 4 blocks
      for (let i = 0; i < 4; ++i) {
        const block = ciphertext.slice(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE);
        this.gostCipherEngine.Feed(block);
        const decryptedBlock = this.gostCipherEngine.Result();

        // Copy decrypted block to output
        for (let j = 0; j < BLOCK_SIZE; ++j) {
          decKey[i * BLOCK_SIZE + j] = decryptedBlock[j];
        }
      }

      // Step 2: Compute MAC over decrypted plaintext
      this.gostMacEngine.Feed(decKey);
      const macResult = this.gostMacEngine.Result();

      // Step 3: Extract expected MAC from ciphertext (last 4 bytes)
      const macExpected = ciphertext.slice(ciphertext.length - MAC_SIZE);

      // Step 4: Verify MAC using constant-time comparison
      if (!OpCodes.ConstantTimeCompare(macResult.slice(0, MAC_SIZE), macExpected)) {
        throw new Error("MAC verification failed: authentication check failed");
      }

      return decKey;
    }

    // Helper: Load GOST 28147-89 cipher with fallback strategies
    _getGOST28147Algorithm() {
      // Return cached instance if available
      if (this._cachedGOSTAlgorithm) {
        return this._cachedGOSTAlgorithm;
      }

      // Strategy 1: Try to require GOST directly (Node.js/TestSuite)
      if (typeof require !== 'undefined') {
        try {
          require('../block/gost28147.js');
        } catch (e) {
          // Silently fail and try registry
        }
      }

      // Strategy 2: Search in AlgorithmFramework registry
      const algorithms = AlgorithmFramework.GetAll ? AlgorithmFramework.GetAll() : [];
      const gostAlgorithm = algorithms.find(alg =>
        alg.name === 'GOST 28147-89'
      );

      if (gostAlgorithm) {
        this._cachedGOSTAlgorithm = gostAlgorithm;
        return gostAlgorithm;
      }

      // Strategy 3: Try direct Find
      const foundAlgorithm = AlgorithmFramework.Find("GOST 28147-89");
      if (foundAlgorithm) {
        this._cachedGOSTAlgorithm = foundAlgorithm;
        return foundAlgorithm;
      }

      throw new Error(
        "GOST 28147-89 algorithm not found. GOST28147Wrap requires GOST 28147-89 to be available. " +
        "Ensure gost28147.js is loaded before using this wrap algorithm."
      );
    }

    // Helper: Load GOST 28147-89 MAC with fallback strategies
    _getGOST28147MACAlgorithm() {
      // Return cached instance if available
      if (this._cachedGOSTMACAlgorithm) {
        return this._cachedGOSTMACAlgorithm;
      }

      // Strategy 1: Try to require GOST MAC directly (Node.js/TestSuite)
      if (typeof require !== 'undefined') {
        try {
          require('../mac/gost28147mac.js');
        } catch (e) {
          // Silently fail and try registry
        }
      }

      // Strategy 2: Search in AlgorithmFramework registry
      const algorithms = AlgorithmFramework.GetAll ? AlgorithmFramework.GetAll() : [];
      const gostMacAlgorithm = algorithms.find(alg =>
        alg.name === 'GOST 28147-89 MAC'
      );

      if (gostMacAlgorithm) {
        this._cachedGOSTMACAlgorithm = gostMacAlgorithm;
        return gostMacAlgorithm;
      }

      // Strategy 3: Try direct Find
      const foundAlgorithm = AlgorithmFramework.Find("GOST 28147-89 MAC");
      if (foundAlgorithm) {
        this._cachedGOSTMACAlgorithm = foundAlgorithm;
        return foundAlgorithm;
      }

      throw new Error(
        "GOST 28147-89 MAC algorithm not found. GOST28147Wrap requires GOST 28147-89 MAC to be available. " +
        "Ensure gost28147mac.js is loaded before using this wrap algorithm."
      );
    }
  }

  // Register the algorithm
  const algorithmInstance = new GOST28147WrapAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // Export
  return { GOST28147WrapAlgorithm, GOST28147WrapInstance };
}));
