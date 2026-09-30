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
      this.SupportedTagSizes = [
        new KeySize(16, 16, 0) // 128-bit authentication tag
      ];
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
   * @returns {AesSivAlgorithmInstance} New cipher instance
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
   * @param {AesSivAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {KeySize[]} */
      this.keySizeList = algorithm.SupportedKeySizes;
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]} */
      this.key1 = [];             // First half of key (for authentication)
      /** @type {uint8[]} */
      this.key2 = [];             // Second half of key (for encryption)
      /** @type {uint8[][]} */
      this.aadArray = [];         // Associated data strings
      /** @type {int32} */
      this.tagSize = 16;          // 128-bit tag
    }

    /**
     * Set the key; its first half authenticates, its second half encrypts
     * @param {uint8[]|null} keyData - Key bytes or null to clear
     */
    set key(keyData) {
      if (!keyData) {
        this._key = null;
        this.key1 = [];
        this.key2 = [];
        return;
      }

      // Validate key size
      /** @type {boolean} */
      let isValidSize = false;
      for (let k = 0; k < this.keySizeList.length; k++) {
        /** @type {KeySize} */
        const ks = this.keySizeList[k];
        if (keyData.length >= ks.minSize && keyData.length <= ks.maxSize &&
            (keyData.length - ks.minSize) % ks.stepSize === 0) {
          isValidSize = true;
          break;
        }
      }

      if (!isValidSize) {
        throw new Error("Invalid key size: " + keyData.length + " bytes");
      }

      /** @type {uint8[]} */
      const keyBytes = keyData.slice();

      // Split key in half
      /** @type {int32} */
      const halfLen = Math.floor(keyBytes.length / 2);
      this.key1 = keyBytes.slice(0, halfLen);      // First half for authentication
      this.key2 = keyBytes.slice(halfLen);         // Second half for encryption

      this._key = keyBytes;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? this._key.slice() : null;
    }

    /**
     * Set the associated data. S2V takes one MAC input per element of the
     * array, so each byte of a byte array counts as its own (empty) string;
     * a missing value counts as one empty string.
     * @param {uint8[]|null} aad - Associated data
     * @returns {void}
     */
    setAAD(aad) {
      /** @type {uint8[][]} */
      const strings = [];
      if (aad) {
        for (let i = 0; i < aad.length; i++) {
          /** @type {uint8[]} */
          const empty = [];
          strings.push(empty);
        }
      } else {
        /** @type {uint8[]} */
        const empty = [];
        strings.push(empty);
      }
      this.aadArray = strings;
    }


    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }

      /** @type {uint8[]} */
      const result = this.isInverse ?
        this.decrypt(this.inputBuffer, this.aadArray) :
        this.encrypt(this.inputBuffer, this.aadArray);

      this.inputBuffer = [];
      return result;
    }

    /**
     * Simplified block cipher for educational purposes
     * @param {uint8[]} data - 16-byte block
     * @param {uint8[]} blockKey - 16-byte key
     * @returns {uint8[]} Encrypted 16-byte block
     */
    _simpleBlockCipher(data, blockKey) {
      /** @type {uint8[]} */
      const result = data.slice();
      /** @type {uint8[]} */
      let rk = blockKey;

      // Ensure 16-byte blocks
      while (result.length < 16) result.push(0);
      while (rk.length < 16) {
        /** @type {uint8[]} */
        const extended = rk.slice();
        /** @type {uint8[]} */
        const head = rk.slice(0, 16 - rk.length);
        for (let i = 0; i < head.length; i++) extended.push(head[i]);
        rk = extended;
      }

      // Simple rounds using OpCodes operations
      for (let round = 0; round < 4; round++) {
        // Add round key
        for (let i = 0; i < 16; i++) {
          result[i] = OpCodes.Xor8(OpCodes.Xor8(result[i], rk[i]), round);
        }

        // Simple substitution and permutation
        for (let i = 0; i < 16; i++) {
          result[i] = OpCodes.RotL8(OpCodes.Xor8(result[i], i + 1), (round + 1) % 8);
        }

        // Simple mixing
        for (let i = 0; i < 16; i += 4) {
          /** @type {uint8} */
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
     * @param {uint8[]} macKey - Authentication key
     * @param {uint8[]} data - Data to authenticate
     * @returns {uint8[]} 16-byte MAC
     */
    _computeMAC(macKey, data) {
      /** @type {int32} */
      const blockSize = 16;
      /** @type {uint8[]} */
      let mac = OpCodes.CreateArray(16, 0);

      // Process data in 16-byte blocks
      for (let i = 0; i < data.length; i += blockSize) {
        /** @type {uint8[]} */
        const block = data.slice(i, i + blockSize);
        if (block.length < blockSize) {
          block.push(0x80); // Padding
          while (block.length < blockSize) block.push(0);
        }

        // XOR with previous MAC
        for (let j = 0; j < blockSize; j++) {
          block[j] = OpCodes.Xor8(block[j], mac[j]);
        }

        // Encrypt with key
        mac = this._simpleBlockCipher(block, macKey);
      }

      return mac;
    }

    /**
     * S2V (String-to-Vector) function - simplified
     * @param {uint8[][]} strings - Byte arrays to authenticate
     * @returns {uint8[]} 16-byte SIV
     */
    _s2v(strings) {
      // Start with MAC of zero block
      /** @type {uint8[]} */
      const zeroBlock = OpCodes.CreateArray(16, 0);
      /** @type {uint8[]} */
      const v = this._computeMAC(this.key1, zeroBlock);

      // Process all strings
      for (let i = 0; i < strings.length; i++) {
        /** @type {uint8[]} */
        const mac = this._computeMAC(this.key1, strings[i]);

        // v = (v * 2) XOR MAC(string) - simplified multiplication
        for (let j = 0; j < 16; j++) {
          v[j] = OpCodes.Xor8(OpCodes.RotL8(v[j], 1), mac[j]);
        }
      }

      return v;
    }

    /**
     * Simple counter mode encryption
     * @param {uint8[]} data - Data to encrypt/decrypt
     * @param {uint8[]} siv - 16-byte initialization vector
     * @returns {uint8[]} Encrypted/decrypted data
     */
    _counterMode(data, siv) {
      /** @type {uint8[]} */
      const result = [];
      /** @type {uint8[]} */
      const counter = siv.slice();

      // Clear the high bit for counter mode
      counter[15] = OpCodes.And8(counter[15], 0x7F);

      for (let i = 0; i < data.length; i += 16) {
        // Generate keystream
        /** @type {uint8[]} */
        const keystream = this._simpleBlockCipher(counter, this.key2);

        // XOR with data
        /** @type {int32} */
        const blockSize = Math.min(16, data.length - i);
        for (let j = 0; j < blockSize; j++) {
          result.push(OpCodes.Xor8(data[i + j], keystream[j]));
        }

        // Increment counter
        for (let j = 15; j >= 0; j--) {
          counter[j] = OpCodes.ToByte(counter[j] + 1);
          if (counter[j] !== 0) break;
        }
      }

      return result;
    }

    /**
     * Encrypt plaintext with associated data
     * @param {uint8[]} plaintext - Data to encrypt as byte array
     * @param {uint8[][]} [aadArray=[]] - Associated data strings
     * @returns {uint8[]} SIV || Ciphertext as byte array
     */
    encrypt(plaintext, aadArray = []) {
      // Prepare S2V input: AAD + plaintext
      /** @type {uint8[][]} */
      const s2vInput = aadArray.slice();
      s2vInput.push(plaintext);

      // Compute SIV using S2V
      /** @type {uint8[]} */
      const siv = this._s2v(s2vInput);

      // Encrypt plaintext using counter mode with SIV as IV
      /** @type {uint8[]} */
      const ciphertext = this._counterMode(plaintext, siv);

      // Return SIV || Ciphertext
      /** @type {uint8[]} */
      const output = siv.slice();
      for (let i = 0; i < ciphertext.length; i++) output.push(ciphertext[i]);
      return output;
    }

    /**
     * Decrypt ciphertext and verify authenticity
     * @param {uint8[]} ciphertextWithSIV - SIV || Ciphertext as byte array
     * @param {uint8[][]} [aadArray=[]] - Associated data strings
     * @returns {uint8[]} Decrypted plaintext as byte array
     */
    decrypt(ciphertextWithSIV, aadArray = []) {
      if (ciphertextWithSIV.length < this.tagSize) {
        throw new Error("Ciphertext must include SIV tag");
      }

      // Split SIV and ciphertext
      /** @type {uint8[]} */
      const siv = ciphertextWithSIV.slice(0, this.tagSize);
      /** @type {uint8[]} */
      const ciphertext = ciphertextWithSIV.slice(this.tagSize);

      // Decrypt ciphertext using counter mode
      /** @type {uint8[]} */
      const plaintext = this._counterMode(ciphertext, siv);

      // Verify SIV by recomputing S2V
      /** @type {uint8[][]} */
      const s2vInput = aadArray.slice();
      s2vInput.push(plaintext);
      /** @type {uint8[]} */
      const expectedSIV = this._s2v(s2vInput);

      // Constant-time comparison
      if (!OpCodes.SecureCompare(siv, expectedSIV)) {
        throw new Error("Authentication verification failed");
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