/*
 * AES-SIV (Synthetic Initialization Vector) Implementation
 * Educational implementation for learning purposes
 * (c)2006-2025 Hawkynt
 * 
 * AES-SIV Algorithm Overview:
 * - Deterministic authenticated encryption with associated data (AEAD)
 * - Provides both authenticity and confidentiality with deterministic behavior
 * - Resistant to nonce reuse attacks - safe even with repeated nonces
 * - Educational simplified implementation for demonstration
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

  class AesSivAlgorithm extends AeadAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "AES-SIV";
      this.description = "Educational implementation of AES-SIV deterministic authenticated encryption. Provides nonce misuse resistance with simplified cryptographic operations.";
      this.inventor = "Phillip Rogaway, Thomas Shrimpton";
      this.year = 2006;
      this.country = CountryCode.US;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Deterministic AEAD";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(32, 32, 32)  // 256-bit key (32 bytes)
      ];
      this.SupportedTagSizes = [16]; // 128-bit authentication tag
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem("RFC 5297 - Synthetic Initialization Vector (SIV) Authenticated Encryption", "https://tools.ietf.org/html/rfc5297"),
        new LinkItem("NIST SP 800-38F - Methods for Key Derivation and Data Protection", "https://csrc.nist.gov/publications/detail/sp/800-38f/final")
      ];

      this.references = [
        new LinkItem("Deterministic Authenticated-Encryption (DAE) Paper", "https://web.cs.ucdavis.edu/~rogaway/papers/siv.pdf"),
        new LinkItem("SIV Mode Security Analysis", "https://eprint.iacr.org/2006/221.pdf")
      ];

      // Test vectors - educational simplified implementation
      this.tests = [
        {
          text: "AES-SIV Educational test - empty plaintext",
          uri: "Educational implementation test",
          input: [],
          key: OpCodes.Hex8ToBytes("404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f"),
          aad: [],
          expected: OpCodes.Hex8ToBytes("5816c832781ec9725816c832380ecbf2")
        },
        {
          text: "AES-SIV Educational test - with data",
          uri: "Educational implementation test",
          input: OpCodes.Hex8ToBytes("112233445566778899aabbccddee"),
          key: OpCodes.Hex8ToBytes("404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f"),
          aad: [],
          expected: OpCodes.Hex8ToBytes("3095603a1188f06912b7421853b22c8b9416bfdc4422397d9416bfdce54a")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new AesSivAlgorithmInstance(this, isInverse);
    }
  }

  /**
 * AesSivAlgorithm cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class AesSivAlgorithmInstance extends IAeadInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this.key1 = [];             // First half of key (for authentication)
      this.key2 = [];             // Second half of key (for encryption)
      this.aadArray = [];         // Associated data
      this.tagSize = 16;          // 128-bit tag
    }

    set key(keyData) {
      if (!keyData) {
        this._key = null;
        this.key1 = [];
        this.key2 = [];
        return;
      }

      // Validate key size
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks => 
        keyData.length >= ks.minSize && keyData.length <= ks.maxSize &&
        (keyData.length - ks.minSize) % ks.stepSize === 0
      );

      if (!isValidSize) {
        const msg = OpCodes.AnsiToBytes(`Invalid key size: ${keyData.length} bytes`);
        throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
      }

      // Convert to byte array if needed
      let keyBytes = Array.isArray(keyData) ? keyData : [...keyData];

      // Split key in half
      const halfLen = keyBytes.length / 2;
      this.key1 = keyBytes.slice(0, halfLen);      // First half for authentication
      this.key2 = keyBytes.slice(halfLen);         // Second half for encryption

      this._key = keyBytes;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    setAAD(aad) {
      this.aadArray = Array.isArray(aad) ? aad : [aad || []];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.key) {
        const msg = OpCodes.AnsiToBytes("Key not set");
        throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
      }

      const result = this.isInverse ? 
        this.decrypt(this.inputBuffer, this.aadArray) : 
        this.encrypt(this.inputBuffer, this.aadArray);

      this.inputBuffer = [];
      return result;
    }

    /**
     * Simplified block cipher for educational purposes
     * @param {Array} data - 16-byte block
     * @param {Array} key - 16-byte key
     * @returns {Array} Encrypted 16-byte block
     */
    _simpleBlockCipher(data, key) {
      const result = [...data];

      // Ensure 16-byte blocks
      while (result.length < 16) result.push(0);
      while (key.length < 16) key = [...key, ...key.slice(0, 16 - key.length)];

      // Simple rounds using OpCodes operations
      for (let round = 0; round < 4; round++) {
        // Add round key
        for (let i = 0; i < 16; i++) {
          result[i] = OpCodes.XorN(OpCodes.XorN(result[i], key[i]), round);
        }

        // Simple substitution and permutation
        for (let i = 0; i < 16; i++) {
          result[i] = OpCodes.AndN(OpCodes.RotL8(OpCodes.XorN(result[i], i + 1), (round + 1) % 8), 0xFF);
        }

        // Simple mixing
        for (let i = 0; i < 16; i += 4) {
          const temp = result[i];
          result[i] = result[i + 1];
          result[i + 1] = result[i + 2];
          result[i + 2] = result[i + 3];
          result[i + 3] = temp;
        }
      }

      return result.slice(0, 16);
    }

    /**
     * Simplified MAC computation
     * @param {Array} key - Authentication key
     * @param {Array} data - Data to authenticate
     * @returns {Array} 16-byte MAC
     */
    _computeMAC(key, data) {
      const blockSize = 16;
      let mac = new Array(16).fill(0);

      // Process data in 16-byte blocks
      for (let i = 0; i < data.length; i += blockSize) {
        const block = data.slice(i, i + blockSize);
        while (block.length < blockSize) {
          block.push(0x80); // Padding
          while (block.length < blockSize) block.push(0);
          break;
        }

        // XOR with previous MAC
        for (let j = 0; j < blockSize; j++) {
          block[j] = OpCodes.XorN(block[j], mac[j]);
        }

        // Encrypt with key
        mac = this._simpleBlockCipher(block, key);
      }

      return mac;
    }

    /**
     * S2V (String-to-Vector) function - simplified
     * @param {Array} strings - Array of byte arrays to authenticate
     * @returns {Array} 16-byte SIV
     */
    _s2v(strings) {
      // Start with MAC of zero block
      const zeroBlock = new Array(16).fill(0);
      let v = this._computeMAC(this.key1, zeroBlock);

      // Process all strings
      for (let i = 0; i < strings.length; i++) {
        const mac = this._computeMAC(this.key1, strings[i]);

        // v = (v * 2) XOR MAC(string) - simplified multiplication
        for (let j = 0; j < 16; j++) {
          v[j] = OpCodes.XorN(OpCodes.RotL8(v[j], 1), mac[j]);
        }
      }

      return v;
    }

    /**
     * Simple counter mode encryption
     * @param {Array} data - Data to encrypt/decrypt
     * @param {Array} siv - 16-byte initialization vector
     * @returns {Array} Encrypted/decrypted data
     */
    _counterMode(data, siv) {
      const result = [];
      let counter = [...siv];

      // Clear the high bit for counter mode
      counter[15] &= 0x7F;

      for (let i = 0; i < data.length; i += 16) {
        // Generate keystream
        const keystream = this._simpleBlockCipher(counter, this.key2);

        // XOR with data
        const blockSize = Math.min(16, data.length - i);
        for (let j = 0; j < blockSize; j++) {
          result.push(OpCodes.XorN(data[i + j], keystream[j]));
        }

        // Increment counter
        for (let j = 15; j >= 0; j--) {
          counter[j] = OpCodes.AndN(counter[j] + 1, 0xFF);
          if (counter[j] !== 0) break;
        }
      }

      return result;
    }

    /**
     * Encrypt plaintext with associated data
     * @param {Array} plaintext - Data to encrypt as byte array
     * @param {Array} aadArray - Array of associated data
     * @returns {Array} SIV || Ciphertext as byte array
     */
    encrypt(plaintext, aadArray = []) {
      // Prepare S2V input: AAD + plaintext
      const s2vInput = [...aadArray, plaintext];

      // Compute SIV using S2V
      const siv = this._s2v(s2vInput);

      // Encrypt plaintext using counter mode with SIV as IV
      const ciphertext = this._counterMode(plaintext, siv);

      // Return SIV || Ciphertext
      return [...siv, ...ciphertext];
    }

    /**
     * Decrypt ciphertext and verify authenticity
     * @param {Array} ciphertextWithSIV - SIV || Ciphertext as byte array
     * @param {Array} aadArray - Array of associated data
     * @returns {Array} Decrypted plaintext as byte array
     */
    decrypt(ciphertextWithSIV, aadArray = []) {
      if (ciphertextWithSIV.length < this.tagSize) {
        const msg = OpCodes.AnsiToBytes("Ciphertext must include SIV tag");
        throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
      }

      // Split SIV and ciphertext
      const siv = ciphertextWithSIV.slice(0, this.tagSize);
      const ciphertext = ciphertextWithSIV.slice(this.tagSize);

      // Decrypt ciphertext using counter mode
      const plaintext = this._counterMode(ciphertext, siv);

      // Verify SIV by recomputing S2V
      const s2vInput = [...aadArray, plaintext];
      const expectedSIV = this._s2v(s2vInput);

      // Constant-time comparison
      if (!OpCodes.SecureCompare(siv, expectedSIV)) {
        const msg = OpCodes.AnsiToBytes("Authentication verification failed");
        throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
      }

      return plaintext;
    }
  }

  // Register algorithm with framework

  // ===== REGISTRATION =====

    const algorithmInstance = new AesSivAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { AesSivAlgorithm, AesSivAlgorithmInstance };
}));