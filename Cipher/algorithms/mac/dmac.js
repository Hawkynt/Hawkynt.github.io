/*
 * DMAC (Double MAC) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * DMAC is a CBC-MAC variant that uses two-key derivation to provide
 * stronger security guarantees. It was designed by Petrank and Rackoff
 * to address CBC-MAC vulnerabilities for real-time data sources.
 *
 * Algorithm Overview:
 *   1. Generate two subkeys K1 and K2 from master key K:
 *      - K1 = E(K, 0^n)
 *      - K2 = E(K, 0^(n-1) || 1)
 *   2. Compute CBC-MAC using K1
 *   3. Apply padding to ensure message length is multiple of block size
 *   4. Apply second encryption with K2: MAC = E(K2, CBC-MAC(K1, M || pad))
 *
 * Reference: Crypto++ dmac.h and dmac.cpp
 */

// Load AlgorithmFramework (REQUIRED)

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes', '../block/des'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('../block/des')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes, root.DES);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, DESModule) {
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

  class DMACAlgorithm extends MacAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "DMAC";
      this.description = "Double MAC (DMAC) using two-key derivation for enhanced CBC-MAC security. Designed for real-time data sources with variable-length messages.";
      this.inventor = "Erez Petrank, Charles Rackoff";
      this.year = 1997;
      this.category = CategoryType.MAC;
      this.subCategory = "Block Cipher MAC";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.INT;

      // MAC-specific configuration
      this.SupportedMacSizes = [
        new KeySize(8, 8, 0)  // 8 bytes (64 bits) for DES
      ];
      this.NeedsKey = true;

      // Documentation links
      this.documentation = [
        new LinkItem("CBC MAC for Real-Time Data Sources (IACR ePrint 1997/010)", "https://eprint.iacr.org/1997/010"),
        new LinkItem("Crypto++ DMAC Implementation", "https://github.com/weidai11/cryptopp/blob/master/dmac.h")
      ];

      this.references = [
        new LinkItem("Crypto++ Validation Tests", "https://github.com/weidai11/cryptopp/blob/master/validat4.cpp"),
        new LinkItem("NIST SP 800-38B - CMAC (modern successor)", "https://csrc.nist.gov/publications/detail/sp/800-38b/final")
      ];

      // Test vector from Crypto++ validat4.cpp
      // https://github.com/weidai11/cryptopp/blob/master/validat4.cpp
      this.tests = [
        {
          text: "Crypto++ DMAC<DES> Test Vector",
          uri: "https://github.com/weidai11/cryptopp/blob/master/validat4.cpp",
          input: OpCodes.Hex8ToBytes("37363534333231204e6f77206973207468652074696d6520666f7220"), // "7654321 Now is the time for "
          key: OpCodes.Hex8ToBytes("0123456789abcdef"),
          expected: OpCodes.Hex8ToBytes("3580C5C46B8124E2")
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
        return null; // MAC cannot be reversed
      }
      return new DMACInstance(this);
    }
  }

  // Instance class - handles the actual DMAC computation
  /**
 * DMAC cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class DMACInstance extends IMacInstance {
    constructor(algorithm) {
      super(algorithm);
      this._key = null;
      this._blockSize = 8; // DES block size
      this.inputBuffer = [];
      this.counter = 0; // Track bytes processed modulo block size
      this.cipherInstance = null;
      this.cipher2Instance = null;
      this.subkeys = null; // K1 and K2
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.cipherInstance = null;
        this.cipher2Instance = null;
        this.subkeys = null;
        return;
      }

      // Validate key size (DES uses 8-byte keys)
      if (keyBytes.length !== 8) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 8 for DES)`);
      }

      this._key = [...keyBytes];

      // Generate subkeys K1 and K2
      this.subkeys = this._generateSubkeys(keyBytes);

      // Create DES cipher instances
      if (!DESModule || !DESModule.DESAlgorithm) {
        throw new Error('DES module not loaded');
      }

      const desAlgorithm = new DESModule.DESAlgorithm();

      // CBC-MAC cipher using K1
      this.cipherInstance = desAlgorithm.CreateInstance(false);
      this.cipherInstance.key = this.subkeys.k1;

      // Final encryption cipher using K2
      this.cipher2Instance = desAlgorithm.CreateInstance(false);
      this.cipher2Instance.key = this.subkeys.k2;

      // Reset counter
      this.counter = 0;
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
      if (!this._key) throw new Error("Key not set");

      this.inputBuffer.push(...data);
      // Update counter (modulo block size to track partial blocks)
      this.counter = (this.counter + data.length) % this._blockSize;
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Step 1: Apply DMAC-specific padding
      // Crypto++ uses padByte = blockSize - counter
      // Then pads with that many bytes of value padByte
      const padByte = this._blockSize - this.counter;
      const padding = new Array(padByte).fill(padByte);
      const paddedMessage = [...this.inputBuffer, ...padding];

      // Step 2: Compute CBC-MAC with K1
      const cbcMac = this._computeCBCMAC(paddedMessage, this.cipherInstance);

      // Step 3: Encrypt the CBC-MAC result with K2
      this.cipher2Instance.Feed(cbcMac);
      const mac = this.cipher2Instance.Result();

      // Clear for next operation
      this.inputBuffer = [];
      this.counter = 0;

      return mac;
    }

    /**
     * Generate DMAC subkeys K1 and K2 from master key
     * K1 = E(K, 0^n)
     * K2 = E(K, 0^(n-1) || 1)
     *
     * @param {Array<number>} key - Master key
     * @returns {Object} Object with k1 and k2 properties
     */
    _generateSubkeys(key) {
      if (!DESModule || !DESModule.DESAlgorithm) {
        throw new Error('DES module not loaded');
      }

      const desAlgorithm = new DESModule.DESAlgorithm();
      const cipher = desAlgorithm.CreateInstance(false);
      cipher.key = key;

      // K1 = E(K, 0^n) - encrypt all zeros
      const zeros = new Array(this._blockSize).fill(0);
      cipher.Feed(zeros);
      const k1 = cipher.Result();

      // K2 = E(K, 0^(n-1) || 1) - encrypt zeros with last byte = 1
      const zerosWithOne = new Array(this._blockSize).fill(0);
      zerosWithOne[this._blockSize - 1] = 1;
      cipher.Feed(zerosWithOne);
      const k2 = cipher.Result();

      return { k1, k2 };
    }

    /**
     * Compute CBC-MAC over message (already padded)
     *
     * @param {Array<number>} message - Padded message
     * @param {Object} cipher - DES cipher instance
     * @returns {Array<number>} CBC-MAC tag
     */
    _computeCBCMAC(message, cipher) {
      // Initialize CBC state with zeros
      let state = new Array(this._blockSize).fill(0);

      // Process each block in CBC mode
      for (let i = 0; i < message.length; i += this._blockSize) {
        const messageBlock = message.slice(i, i + this._blockSize);

        // XOR with previous state (CBC mode)
        const xorBlock = OpCodes.XorArrays(state, messageBlock);

        // Encrypt the XOR result
        cipher.Feed(xorBlock);
        state = cipher.Result();
      }

      // Return final state as MAC
      return state;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new DMACAlgorithm());

  return DMACAlgorithm;
}));
