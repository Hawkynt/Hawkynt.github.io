/*
 * EEE (Encrypt-Encrypt-Encrypt) Mode of Operation
 * Triple encryption mode that applies the same block cipher three times with three different keys
 * Provides enhanced security through multiple encryption passes
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
    root.EEE = factory(root.AlgorithmFramework, root.OpCodes);
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

  class EeeAlgorithm extends CipherModeAlgorithm {
    constructor() {
      super();

      this.name = "EEE";
      this.description = "EEE (Triple Encrypt) mode applies the underlying block cipher three times in encryption mode with three independent keys (K1, K2, K3). This provides enhanced security through cascade encryption. Can be used with any block cipher to increase effective key length.";
      this.inventor = "Generic cascade cipher construction";
      this.year = 1978;
      this.category = CategoryType.MODE;
      this.subCategory = "Block Cipher Mode";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.RequiresIV = false;
      this.SupportedIVSizes = []; // EEE doesn't use IV
      this.RequiresTripleKey = true; // Requires 3x the normal key size

      this.documentation = [
        new LinkItem("Cascade Ciphers", "https://en.wikipedia.org/wiki/Multiple_encryption"),
        new LinkItem("Applied Cryptography", "Bruce Schneier - Multiple Encryption"),
        new LinkItem("NIST SP 800-67", "https://csrc.nist.gov/publications/detail/sp/800-67/rev-2/final")
      ];

      this.references = [
        new LinkItem("Cryptography Engineering", "Ferguson, Schneier, Kohno - Cascade constructions"),
        new LinkItem("Handbook of Applied Cryptography", "Chapter 7 - Multiple encryption")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Meet-in-the-middle", "If attacker can store 2^n encryptions, effective security may be reduced from 3n to 2n bits"),
        new Vulnerability("Key scheduling", "Poor key scheduling in underlying cipher may reduce effective security"),
        new Vulnerability("Related keys", "If keys are related, security may be significantly reduced")
      ];

      // Test vectors based on NIST SP 800-67 (Triple-Encryption)
      this.tests = [
        {
          text: "EEE round-trip test - 3-key mode with DES (8-byte block)",
          uri: "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-67Rev2.pdf",
          cipher: "DES",
          input: OpCodes.Hex8ToBytes("0123456789ABCDEF"), // 8-byte block
          key: OpCodes.Hex8ToBytes("0123456789ABCDEF23456789ABCDEF01456789ABCDEF0123") // 3-key mode (24 bytes)
        },
        {
          text: "EEE round-trip test - 3-key mode with DES (16-byte input)",
          uri: "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-67Rev2.pdf",
          cipher: "DES",
          input: OpCodes.Hex8ToBytes("54686520717569636B2062726F776E20"), // "The quick brown " (16 bytes, 2 blocks)
          key: OpCodes.Hex8ToBytes("0123456789ABCDEF23456789ABCDEF01456789ABCDEF0123") // 3-key mode (24 bytes)
        },
        {
          text: "EEE round-trip test - 3-key mode with DES (alternate keys)",
          uri: "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-67Rev2.pdf",
          cipher: "DES",
          input: OpCodes.Hex8ToBytes("6BC1BEE22E409F96E93D7E117393172A"), // 16-byte input (2 blocks)
          key: OpCodes.Hex8ToBytes("ABCDEF0123456789BCDEF01234567890CDEF012345678901") // Different 3-key mode
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new EeeModeInstance(this, isInverse);
    }
  }

  /**
 * EeeMode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class EeeModeInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.blockCipherAlgorithm = null;
      this.inputBuffer = [];
      this._key = null;
      this._keyParts = null;
      this._mode = null; // 'EEE1', 'EEE2' or 'EEE3'
    }

    /**
     * Set the underlying block cipher instance to use
     * @param {IBlockCipherInstance} cipher - The block cipher instance
     */
    setBlockCipher(cipher) {
      if (!cipher || typeof cipher.Feed !== 'function' || typeof cipher.Result !== 'function') {
        throw new Error("Invalid block cipher instance");
      }
      this.blockCipher = cipher;
      this.blockCipherAlgorithm = cipher.algorithm;
    }

    /**
     * Determine the expected single key size for the underlying cipher
     * This is a heuristic based on common key sizes
     */
    _determineSingleKeySize(totalKeyLength) {
      // Common single key sizes for block ciphers
      const commonKeySizes = [8, 16, 24, 32]; // DES, AES-128, AES-192, AES-256

      // First check if it's exactly 2x or 3x a common size (prefer multi-key modes)
      // This handles cases like 16 bytes = 2x8 (2-key DES) vs 1x16 (single AES-128)

      // Check if it's exactly 3x a common size (3-key mode)
      for (const size of commonKeySizes) {
        if (totalKeyLength === size * 3) {
          return size;
        }
      }

      // Check if it's exactly 2x a common size (2-key mode)
      for (const size of commonKeySizes) {
        if (totalKeyLength === size * 2) {
          return size;
        }
      }

      // Finally, check if it IS a common single key size (1-key mode)
      if (commonKeySizes.includes(totalKeyLength)) {
        return totalKeyLength;
      }

      // Default: assume 3-key mode and divide by 3
      const assumedSize = Math.floor(totalKeyLength / 3);
      if (assumedSize * 3 === totalKeyLength) {
        return assumedSize;
      }

      // Fallback: assume 2-key mode
      return Math.floor(totalKeyLength / 2);
    }

    /**
     * Set the key - supports 1-key, 2-key and 3-key variants
     * 1-key: All three operations use the same key (K1-K1-K1)
     * 2-key: Key length = 2x single key size, uses K1-K2-K1
     * 3-key: Key length = 3x single key size, uses K1-K2-K3
     */
    set key(keyBytes) {
      if (!keyBytes || keyBytes.length === 0) {
        throw new Error("Key cannot be empty");
      }

      this._key = [...keyBytes];
      const keyLength = keyBytes.length;

      // Determine single key size
      const singleKeySize = this._determineSingleKeySize(keyLength);

      // Determine mode based on key length
      if (keyLength === singleKeySize) {
        // EEE1 mode: K1-K1-K1 (triple encryption with same key)
        this._mode = 'EEE1';
        this._keyParts = {
          k1: keyBytes,
          k2: keyBytes,
          k3: keyBytes
        };
      } else if (keyLength === singleKeySize * 2) {
        // EEE2 mode: K1-K2-K1
        this._mode = 'EEE2';
        this._keyParts = {
          k1: keyBytes.slice(0, singleKeySize),
          k2: keyBytes.slice(singleKeySize, singleKeySize * 2),
          k3: keyBytes.slice(0, singleKeySize) // K3 = K1
        };
      } else if (keyLength === singleKeySize * 3) {
        // EEE3 mode: K1-K2-K3
        this._mode = 'EEE3';
        this._keyParts = {
          k1: keyBytes.slice(0, singleKeySize),
          k2: keyBytes.slice(singleKeySize, singleKeySize * 2),
          k3: keyBytes.slice(singleKeySize * 2, singleKeySize * 3)
        };
      } else {
        // Try to adapt: if key is longer, use first portion for 3-key mode
        if (keyLength > singleKeySize * 2) {
          // Treat as 3-key, pad if necessary
          this._mode = 'EEE3';
          const k1Size = singleKeySize;
          const k2Size = Math.min(singleKeySize, keyLength - singleKeySize);
          const k3Size = Math.min(singleKeySize, keyLength - singleKeySize * 2);

          this._keyParts = {
            k1: keyBytes.slice(0, k1Size),
            k2: keyBytes.slice(k1Size, k1Size + k2Size),
            k3: keyBytes.slice(k1Size + k2Size, k1Size + k2Size + k3Size)
          };

          // Pad k2 and k3 if necessary by repeating k1
          if (k2Size < singleKeySize) {
            this._keyParts.k2 = this._keyParts.k1;
          }
          if (k3Size < singleKeySize) {
            this._keyParts.k3 = this._keyParts.k1;
          }
        } else {
          throw new Error(`Key length ${keyLength} is not compatible with EEE mode. Expected ${singleKeySize}, ${singleKeySize * 2}, or ${singleKeySize * 3} bytes.`);
        }
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
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      if (!this._key) {
        throw new Error("Key not set");
      }
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      // For EEE mode, we need to create three separate cipher instances
      // We use the algorithm from the provided cipher instance
      const algorithm = this.blockCipherAlgorithm || this.blockCipher.algorithm;
      if (!algorithm || !algorithm.CreateInstance) {
        throw new Error("Cannot access block cipher algorithm for EEE mode");
      }

      // For decryption in EEE mode, we need to reverse the order and decrypt
      // D(EEE) = D3(D2(D1(ciphertext)))
      if (this.isInverse) {
        // For decryption, all three operations are decrypt, but in reverse order
        const decipher1 = algorithm.CreateInstance(true); // Decrypt
        const decipher2 = algorithm.CreateInstance(true); // Decrypt
        const decipher3 = algorithm.CreateInstance(true); // Decrypt

        // Set keys in reverse order for decryption
        decipher1.key = this._keyParts.k3;
        decipher2.key = this._keyParts.k2;
        decipher3.key = this._keyParts.k1;

        // Process: D1(D2(D3(ciphertext)))
        decipher1.Feed(this.inputBuffer);
        const temp1 = decipher1.Result();

        decipher2.Feed(temp1);
        const temp2 = decipher2.Result();

        decipher3.Feed(temp2);
        const result = decipher3.Result();

        this.inputBuffer = [];
        return result;
      } else {
        // For encryption: E3(E2(E1(plaintext)))
        const cipher1 = algorithm.CreateInstance(false); // Always encrypt for E1
        const cipher2 = algorithm.CreateInstance(false); // Always encrypt for E2
        const cipher3 = algorithm.CreateInstance(false); // Always encrypt for E3

        cipher1.key = this._keyParts.k1;
        cipher2.key = this._keyParts.k2;
        cipher3.key = this._keyParts.k3;

        // Process: E3(E2(E1(plaintext)))
        cipher1.Feed(this.inputBuffer);
        const temp1 = cipher1.Result();

        cipher2.Feed(temp1);
        const temp2 = cipher2.Result();

        cipher3.Feed(temp2);
        const result = cipher3.Result();

        this.inputBuffer = [];
        return result;
      }
    }
  }

  // Register the algorithm
  const algorithmInstance = new EeeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====
  return { EeeAlgorithm, EeeModeInstance };
}));