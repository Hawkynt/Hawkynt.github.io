/*
 * F8 Mode of Operation (3GPP Confidentiality Mode)
 * Stream cipher mode for block ciphers used in 3GPP/UMTS telecommunications
 * Similar to CTR mode but with salt key modification for enhanced security
 * (c)2006-2025 Hawkynt
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
    root.F8 = factory(root.AlgorithmFramework, root.OpCodes);
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

  class F8Algorithm extends CipherModeAlgorithm {
    constructor() {
      super();

      this.name = "F8";
      this.description = "F8 mode (3GPP confidentiality mode) is a stream cipher mode designed for mobile telecommunications. It uses a block cipher with a salt key to derive a modified IV, then applies a counter-based keystream generation similar to CTR mode. The salt key prevents related-key attacks in multi-user environments. Used in UMTS and LTE networks for user data encryption.";
      this.inventor = "3GPP Security Algorithms Group of Experts";
      this.year = 2002;
      this.category = CategoryType.MODE;
      this.subCategory = "Stream Cipher Mode";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.EU;

      this.RequiresIV = true;
      this.SupportedIVSizes = [
        new KeySize(8, 32, 8) // Common block sizes: 8 (DES), 16 (AES), 32 (256-bit blocks)
      ];

      // F8 also requires a salt key
      this.RequiresSaltKey = true;
      this.SupportedSaltKeySizes = [
        new KeySize(4, 32, 1) // Salt key can be smaller than main key, extended with 0x55
      ];

      this.documentation = [
        new LinkItem("3GPP TS 35.201", "https://www.3gpp.org/ftp/Specs/archive/35_series/35.201/"),
        new LinkItem("3GPP TS 35.202", "https://www.3gpp.org/ftp/Specs/archive/35_series/35.202/"),
        new LinkItem("LibTomCrypt F8 Implementation", "https://github.com/libtom/libtomcrypt/tree/develop/src/modes/f8")
      ];

      this.references = [
        new LinkItem("LibTomCrypt F8 Mode", "https://github.com/libtom/libtomcrypt/blob/develop/src/modes/f8/f8_encrypt.c"),
        new LinkItem("3GPP Security", "https://www.3gpp.org/technologies/keywords-acronyms/101-security")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("IV Reuse", "Reusing the same IV with the same key and salt reveals XOR of plaintexts. Always use unique IVs for each encryption session."),
        new Vulnerability("Counter Overflow", "If block counter overflows during a session, keystream may repeat. Use appropriate message size limits."),
        new Vulnerability("No Authentication", "F8 provides confidentiality only, not integrity or authentication. Combine with authentication mechanisms in practice.")
      ];

      // Round-trip test vectors based on LibTomCrypt
      this.tests = [
        {
          text: "F8 round-trip test (39 bytes)",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/modes/f8/f8_test_mode.c",
          input: OpCodes.Hex8ToBytes("70736575646f72616e646f6d6e65737320697320746865206e6578742062657374207468696e67")
        }
      ];

      // Add test parameters
      this.tests.forEach(test => {
        test.key = OpCodes.Hex8ToBytes("234829008467be186c3de14aae72d62c"); // AES-128 key
        test.saltKey = OpCodes.Hex8ToBytes("32f2870d"); // 4-byte salt key
        test.iv = OpCodes.Hex8ToBytes("006e5cba50681de55c621599d462564a"); // 16-byte IV
      });
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new F8ModeInstance(this, isInverse);
    }
  }

  /**
 * F8Mode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class F8ModeInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.blockCipher = null;
      this.inputBuffer = [];

      // F8 state
      this._key = null;
      this._saltKey = null;
      this._iv = null;
      this.MIV = null; // Modified IV (encrypted with key XOR salt_key)
      this.currentIV = null; // Current keystream state
      this.blockCounter = 0;
      this.padlen = 0; // Position in current keystream block
      this.keystreamBlock = null;
    }

    /**
     * Set the main encryption key
     * @param {Array} keyBytes - Main key bytes
     */
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }
      this._key = [...keyBytes];
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
     * Set the salt key (used for IV derivation)
     * @param {Array} saltKeyBytes - Salt key bytes
     */
    set saltKey(saltKeyBytes) {
      if (!saltKeyBytes) {
        this._saltKey = null;
        return;
      }
      this._saltKey = [...saltKeyBytes];
    }

    get saltKey() {
      return this._saltKey ? [...this._saltKey] : null;
    }

    /**
     * Set the initialization vector
     * @param {Array} ivBytes - IV bytes (must match block size)
     */
    set iv(ivBytes) {
      if (!ivBytes) {
        this._iv = null;
        return;
      }
      this._iv = [...ivBytes];
    }

    /**
   * Get copy of current IV
   * @returns {uint8[]|null} Copy of IV bytes or null
   */

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    /**
     * Set the underlying block cipher instance
     * @param {IBlockCipherInstance} cipher - The block cipher to use
     */
    setBlockCipher(cipher) {
      if (!cipher || !cipher.BlockSize) {
        throw new Error("Invalid block cipher instance");
      }
      this.blockCipher = cipher;
    }

    /**
     * Initialize F8 mode with key, salt key, and IV
     * This must be called before Feed/Result
     */
    _initialize() {
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._saltKey) {
        throw new Error("Salt key not set");
      }
      if (!this._iv) {
        throw new Error("IV not set");
      }

      const blockSize = this.blockCipher.BlockSize;
      const keyLen = this._key.length;

      if (this._iv.length !== blockSize) {
        throw new Error(`IV must be ${blockSize} bytes (got ${this._iv.length})`);
      }

      // F8 initialization: compute tkey = key XOR salt_key (extended with 0x55)
      const tkey = new Array(keyLen);

      // Copy key
      for (let i = 0; i < keyLen; i++) {
        tkey[i] = this._key[i];
      }

      // XOR with salt_key
      for (let i = 0; i < this._saltKey.length && i < keyLen; i++) {
        tkey[i] ^= this._saltKey[i];
      }

      // XOR remaining bytes with 0x55 if salt_key is shorter than key
      for (let i = this._saltKey.length; i < keyLen; i++) {
        tkey[i] ^= 0x55;
      }

      // Encrypt IV with tkey to get MIV (Modified IV)
      const tempCipher = this.blockCipher.algorithm.CreateInstance(false);
      tempCipher.key = tkey;
      tempCipher.Feed(this._iv);
      this.MIV = tempCipher.Result();

      // Clear temporary key from memory
      OpCodes.ClearArray(tkey);

      // Initialize state - currentIV starts as a copy of MIV (encrypted original IV)
      this.currentIV = [...this.MIV];
      this.blockCounter = 0;
      this.padlen = blockSize; // Force generation of first keystream block
      this.keystreamBlock = new Array(blockSize);
    }

    /**
     * Generate next keystream block
     * F8: IV' = E_K(IV XOR MIV XOR [counter]_last4bytes)
     */
    _generateKeystreamBlock() {
      const blockSize = this.blockCipher.BlockSize;

      // Create counter block (counter in last 4 bytes, big-endian)
      const counterBlock = new Array(blockSize).fill(0);
      const counterBytes = OpCodes.Unpack32BE(this.blockCounter);
      counterBlock[blockSize - 4] = counterBytes[0];
      counterBlock[blockSize - 3] = counterBytes[1];
      counterBlock[blockSize - 2] = counterBytes[2];
      counterBlock[blockSize - 1] = counterBytes[3];

      // Increment counter for next block
      this.blockCounter = (this.blockCounter + 1) >>> 0;

      // XOR: currentIV = currentIV XOR MIV XOR counterBlock
      for (let i = 0; i < blockSize; i++) {
        this.currentIV[i] ^= this.MIV[i] ^ counterBlock[i];
      }

      // Encrypt to get keystream block
      const cipher = this.blockCipher.algorithm.CreateInstance(false);
      cipher.key = this._key;
      cipher.Feed(this.currentIV);
      this.keystreamBlock = cipher.Result();

      // Update currentIV for next iteration (it's the output of encryption)
      this.currentIV = [...this.keystreamBlock];

      this.padlen = 0; // Reset position in keystream block
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Lazy initialization - only initialize when first data is fed
      if (this.MIV === null) {
        this._initialize();
      }

      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.MIV === null) {
        throw new Error("F8 mode not initialized. Set key, saltKey, and iv before feeding data.");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      const blockSize = this.blockCipher.BlockSize;
      const output = [];

      // F8 encryption/decryption are identical (stream cipher property)
      for (let i = 0; i < this.inputBuffer.length; i++) {
        // Generate new keystream block if current one is exhausted
        if (this.padlen === blockSize) {
          this._generateKeystreamBlock();
        }

        // XOR input byte with keystream byte
        output.push(this.inputBuffer[i] ^ this.keystreamBlock[this.padlen]);
        this.padlen++;
      }

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return output;
    }
  }

  // ===== REGISTRATION =====

  RegisterAlgorithm(new F8Algorithm());

  // ===== EXPORTS =====

  return { F8Algorithm, F8ModeInstance };
}));
