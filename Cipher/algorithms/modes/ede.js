/*
 * EDE (Encrypt-Decrypt-Encrypt) Mode of Operation
 * Triple operation mode that encrypts, decrypts, then encrypts again
 * Supports both 2-key (K1-K2-K1) and 3-key (K1-K2-K3) variants
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
    root.EDE = factory(root.AlgorithmFramework, root.OpCodes);
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

  class EdeAlgorithm extends CipherModeAlgorithm {
    constructor() {
      super();

      this.name = "EDE";
      this.description = "EDE (Encrypt-Decrypt-Encrypt) mode applies Encrypt-Decrypt-Encrypt operations using the underlying block cipher. Supports both 2-key mode (K1-K2-K1) and 3-key mode (K1-K2-K3). This is the standard triple operation mode used in 3DES and provides compatibility with single encryption when K1=K2=K3.";
      this.inventor = "IBM (Walter Tuchman)";
      this.year = 1978;
      this.category = CategoryType.MODE;
      this.subCategory = "Block Cipher Mode";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.RequiresIV = false;
      this.SupportedIVSizes = []; // EDE doesn't use IV

      this.documentation = [
        new LinkItem("NIST SP 800-67", "https://csrc.nist.gov/publications/detail/sp/800-67/rev-2/final"),
        new LinkItem("Triple DES", "https://en.wikipedia.org/wiki/Triple_DES"),
        new LinkItem("Applied Cryptography", "Bruce Schneier - Multiple Encryption")
      ];

      this.references = [
        new LinkItem("FIPS 46-3", "https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25"),
        new LinkItem("Cryptography Engineering", "Ferguson, Schneier, Kohno - EDE construction"),
        new LinkItem("ANSI X9.52", "Triple DES Encryption Algorithm")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Meet-in-the-middle", "Effective security reduced to 2n bits for 2-key variant"),
        new Vulnerability("Sweet32", "Birthday attacks on 64-bit block ciphers after 2^32 blocks"),
        new Vulnerability("Key reuse", "2-key variant (K1-K2-K1) has lower effective security than 3-key")
      ];

      // Test vectors based on NIST SP 800-67 (Triple-DES)
      this.tests = [
        {
          text: "EDE round-trip test - 2-key mode with DES (8-byte block)",
          uri: "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-67Rev2.pdf",
          cipher: "DES",
          input: OpCodes.Hex8ToBytes("0123456789ABCDEF"), // 8-byte block
          key: OpCodes.Hex8ToBytes("0123456789ABCDEF23456789ABCDEF01") // 2-key mode (16 bytes)
        },
        {
          text: "EDE round-trip test - 3-key mode with DES (16-byte input)",
          uri: "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-67Rev2.pdf",
          cipher: "DES",
          input: OpCodes.Hex8ToBytes("6BC1BEE22E409F96E93D7E117393172A"), // 16-byte input (2 blocks)
          key: OpCodes.Hex8ToBytes("0123456789ABCDEF23456789ABCDEF01456789ABCDEF0123") // 3-key mode (24 bytes)
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new EdeModeInstance(this, isInverse);
    }
  }

  class EdeModeInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.blockCipherAlgorithm = null;
      this.inputBuffer = [];
      this._key = null;
      this._keyParts = null;
      this._mode = null; // 'EDE2' or 'EDE3'
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
     * Set the key - supports both 2-key and 3-key variants
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
      if (keyLength === singleKeySize * 2) {
        // EDE2 mode: K1-K2-K1
        this._mode = 'EDE2';
        this._keyParts = {
          k1: keyBytes.slice(0, singleKeySize),
          k2: keyBytes.slice(singleKeySize, singleKeySize * 2),
          k3: keyBytes.slice(0, singleKeySize) // K3 = K1
        };
      } else if (keyLength === singleKeySize * 3) {
        // EDE3 mode: K1-K2-K3
        this._mode = 'EDE3';
        this._keyParts = {
          k1: keyBytes.slice(0, singleKeySize),
          k2: keyBytes.slice(singleKeySize, singleKeySize * 2),
          k3: keyBytes.slice(singleKeySize * 2, singleKeySize * 3)
        };
      } else if (keyLength === singleKeySize) {
        // Single key mode: all three keys are the same (compatible with single encryption)
        this._mode = 'EDE1';
        this._keyParts = {
          k1: keyBytes,
          k2: keyBytes,
          k3: keyBytes
        };
      } else {
        // Try to adapt: if key is longer, use first portion for 3-key mode
        if (keyLength > singleKeySize * 2) {
          // Treat as 3-key, pad if necessary
          this._mode = 'EDE3';
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
          throw new Error(`Key length ${keyLength} is not compatible with EDE mode. Expected ${singleKeySize}, ${singleKeySize * 2}, or ${singleKeySize * 3} bytes.`);
        }
      }
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

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

      // For EDE mode, we need to create three separate cipher instances
      // We use the algorithm from the provided cipher instance
      const algorithm = this.blockCipherAlgorithm || this.blockCipher.algorithm;
      if (!algorithm || !algorithm.CreateInstance) {
        throw new Error("Cannot access block cipher algorithm for EDE mode");
      }

      // EDE operations
      if (this.isInverse) {
        // For decryption: D1(E2(D3(ciphertext)))
        const decipher1 = algorithm.CreateInstance(true);  // Decrypt with K1
        const encipher2 = algorithm.CreateInstance(false); // Encrypt with K2
        const decipher3 = algorithm.CreateInstance(true);  // Decrypt with K3

        decipher3.key = this._keyParts.k3;
        encipher2.key = this._keyParts.k2;
        decipher1.key = this._keyParts.k1;

        // Process: D1(E2(D3(ciphertext)))
        decipher3.Feed(this.inputBuffer);
        const temp1 = decipher3.Result();

        encipher2.Feed(temp1);
        const temp2 = encipher2.Result();

        decipher1.Feed(temp2);
        const result = decipher1.Result();

        this.inputBuffer = [];
        return result;
      } else {
        // For encryption: E3(D2(E1(plaintext)))
        const encipher1 = algorithm.CreateInstance(false); // Encrypt with K1
        const decipher2 = algorithm.CreateInstance(true);  // Decrypt with K2
        const encipher3 = algorithm.CreateInstance(false); // Encrypt with K3

        encipher1.key = this._keyParts.k1;
        decipher2.key = this._keyParts.k2;
        encipher3.key = this._keyParts.k3;

        // Process: E3(D2(E1(plaintext)))
        encipher1.Feed(this.inputBuffer);
        const temp1 = encipher1.Result();

        decipher2.Feed(temp1);
        const temp2 = decipher2.Result();

        encipher3.Feed(temp2);
        const result = encipher3.Result();

        this.inputBuffer = [];
        return result;
      }
    }
  }

  // Register the algorithm
  const algorithmInstance = new EdeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====
  return { EdeAlgorithm, EdeModeInstance };
}));