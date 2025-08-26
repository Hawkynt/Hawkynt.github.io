/*
 * EAX (Encrypt-then-Authenticate-then-Translate) Mode of Operation
 * Authenticated encryption mode using CTR and OMAC
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

  class EaxAlgorithm extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "EAX";
      this.description = "EAX (Encrypt-then-Authenticate-then-Translate) is an authenticated encryption mode that combines CTR mode encryption with OMAC authentication. It provides both confidentiality and authenticity, supporting arbitrary-length nonces and associated authenticated data (AAD).";
      this.inventor = "Bellare, Rogaway, Wagner";
      this.year = 2003;
      this.category = CategoryType.MODE;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.SupportedTagSizes = [new KeySize(1, 16, 1)]; // Variable tag size up to block size
      this.SupportsDetached = true;

      this.documentation = [
        new LinkItem("EAX Original Paper", "https://web.cs.ucdavis.edu/~rogaway/papers/eax.html"),
        new LinkItem("ANSI C12.22 Standard", "https://webstore.ansi.org/standards/ansi/ansic1222008"),
        new LinkItem("IEEE 1703 Standard", "https://standards.ieee.org/standard/1703-2012.html")
      ];

      this.references = [
        new LinkItem("Handbook of Applied Cryptography", "Chapter 9 - Authenticated Encryption"),
        new LinkItem("OMAC Specification", "http://www.nuee.nagoya-u.ac.jp/labs/tiwata/omac/omac.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Nonce Reuse", "Reusing nonce with same key breaks confidentiality and authenticity. Always use unique nonces."),
        new Vulnerability("Implementation Attacks", "Vulnerable to timing attacks if not implemented with constant-time operations.")
      ];

      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("6bfb914fd07eae6b"), // Plaintext
          OpCodes.Hex8ToBytes("e037830e8389f27b025a2d6527e79d01"), // Expected ciphertext+tag
          "EAX test vector from original paper",
          "https://web.cs.ucdavis.edu/~rogaway/papers/eax.html"
        )
      ];

      // Add test parameters
      this.tests.forEach(test => {
        test.key = OpCodes.Hex8ToBytes("233952dee4d5ed5f9b9c6d6ff80ff478"); // AES-128 test key
        test.nonce = OpCodes.Hex8ToBytes("62ec67f9c3a4a407fcb2a8c49031a8b3"); // Test nonce
        test.aad = OpCodes.Hex8ToBytes("6bfb914fd07eae6b"); // Associated data
        test.tagSize = 8; // 8-byte tag
      });
    }

    CreateInstance(isInverse = false) {
      return new EaxModeInstance(this, isInverse);
    }
  }

  class EaxModeInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.blockCipher = null;
      this.key = null;
      this.nonce = null;
      this.aad = [];
      this.tagSize = 16; // Default tag size
      this.inputBuffer = [];
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
      this.key = cipher.key;
    }

    /**
     * Set the nonce for EAX mode
     * @param {Array} nonce - Nonce (arbitrary length)
     */
    setNonce(nonce) {
      if (!nonce || nonce.length === 0) {
        throw new Error("Nonce cannot be empty");
      }
      this.nonce = [...nonce];
    }

    /**
     * Set associated authenticated data
     * @param {Array} aad - Associated data to authenticate (optional)
     */
    setAAD(aad) {
      this.aad = aad ? [...aad] : [];
    }

    /**
     * Set authentication tag size
     * @param {number} size - Tag size in bytes (1-16)
     */
    setTagSize(size) {
      if (size < 1 || size > 16) {
        throw new Error("Tag size must be 1-16 bytes");
      }
      this.tagSize = size;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      if (!this.nonce) {
        throw new Error("Nonce not set. Call setNonce() first.");
      }
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      if (!this.nonce) {
        throw new Error("Nonce not set. Call setNonce() first.");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      const blockSize = this.blockCipher.BlockSize;

      if (!this.isInverse) {
        // Encryption mode
        return this._encrypt();
      } else {
        // Decryption mode - expect tag at end
        if (this.inputBuffer.length < this.tagSize) {
          throw new Error("Input too short for authentication tag");
        }
        return this._decrypt();
      }
    }

    _encrypt() {
      const blockSize = this.blockCipher.BlockSize;

      // Step 1: Compute N = OMAC(0, nonce)
      const N = this._omac(0, this.nonce);

      // Step 2: Compute H = OMAC(1, aad) 
      const H = this._omac(1, this.aad);

      // Step 3: CTR mode encryption
      const ciphertext = this._ctrMode(this.inputBuffer, N);

      // Step 4: Compute C' = OMAC(2, ciphertext)
      const CPrime = this._omac(2, ciphertext);

      // Step 5: Compute tag = N XOR H XOR C'
      const tag = [];
      for (let i = 0; i < this.tagSize; i++) {
        tag[i] = N[i] ^ H[i] ^ CPrime[i];
      }

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      OpCodes.ClearArray(N);
      OpCodes.ClearArray(H);
      OpCodes.ClearArray(CPrime);
      this.inputBuffer = [];

      return { ciphertext: ciphertext, tag: tag };
    }

    _decrypt() {
      const blockSize = this.blockCipher.BlockSize;

      // Extract ciphertext and tag
      const ciphertext = this.inputBuffer.slice(0, -this.tagSize);
      const receivedTag = this.inputBuffer.slice(-this.tagSize);

      // Step 1: Compute N = OMAC(0, nonce)
      const N = this._omac(0, this.nonce);

      // Step 2: Compute H = OMAC(1, aad)
      const H = this._omac(1, this.aad);

      // Step 3: Compute C' = OMAC(2, ciphertext)
      const CPrime = this._omac(2, ciphertext);

      // Step 4: Compute expected tag = N XOR H XOR C'
      const expectedTag = [];
      for (let i = 0; i < this.tagSize; i++) {
        expectedTag[i] = N[i] ^ H[i] ^ CPrime[i];
      }

      // Step 5: Verify tag
      if (!OpCodes.SecureCompare(receivedTag, expectedTag)) {
        throw new Error("EAX authentication failed - tag mismatch");
      }

      // Step 6: CTR mode decryption
      const plaintext = this._ctrMode(ciphertext, N);

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      OpCodes.ClearArray(N);
      OpCodes.ClearArray(H);
      OpCodes.ClearArray(CPrime);
      OpCodes.ClearArray(expectedTag);
      this.inputBuffer = [];

      return plaintext;
    }

    /**
     * OMAC (One-Key CBC-MAC) implementation
     * @param {number} tag - Tag byte (0, 1, or 2)
     * @param {Array} data - Data to authenticate
     * @returns {Array} OMAC output
     */
    _omac(tag, data) {
      const blockSize = this.blockCipher.BlockSize;

      // Prefix with tag byte
      const taggedData = [tag, ...data];

      // OMAC = CBC-MAC with final block handling
      let mac = new Array(blockSize).fill(0);

      // Process complete blocks
      for (let i = 0; i < Math.floor(taggedData.length / blockSize) * blockSize; i += blockSize) {
        const block = taggedData.slice(i, i + blockSize);

        // XOR with previous MAC
        for (let j = 0; j < blockSize; j++) {
          mac[j] ^= block[j];
        }

        // Encrypt
        const cipher = this.blockCipher.algorithm.CreateInstance(false);
        cipher.key = this.key;
        cipher.Feed(mac);
        mac = cipher.Result();
      }

      // Handle final partial block if any
      const remaining = taggedData.length % blockSize;
      if (remaining > 0) {
        const finalBlock = taggedData.slice(-remaining);

        // Pad with 10* padding
        const paddedBlock = [...finalBlock, 0x80];
        while (paddedBlock.length < blockSize) {
          paddedBlock.push(0x00);
        }

        // XOR with MAC and encrypt
        for (let j = 0; j < blockSize; j++) {
          mac[j] ^= paddedBlock[j];
        }

        const cipher = this.blockCipher.algorithm.CreateInstance(false);
        cipher.key = this.key;
        cipher.Feed(mac);
        mac = cipher.Result();
      }

      return mac;
    }

    /**
     * CTR mode implementation
     * @param {Array} data - Data to encrypt/decrypt
     * @param {Array} iv - Initial counter value
     * @returns {Array} Output data
     */
    _ctrMode(data, iv) {
      const blockSize = this.blockCipher.BlockSize;
      const output = [];
      let counter = [...iv];

      for (let i = 0; i < data.length; i += blockSize) {
        const remainingBytes = Math.min(blockSize, data.length - i);
        const inputBlock = data.slice(i, i + remainingBytes);

        // Encrypt counter
        const cipher = this.blockCipher.algorithm.CreateInstance(false);
        cipher.key = this.key;
        cipher.Feed(counter);
        const keystream = cipher.Result();

        // XOR with data
        for (let j = 0; j < remainingBytes; j++) {
          output.push(inputBlock[j] ^ keystream[j]);
        }

        // Increment counter
        this._incrementCounter(counter);
      }

      OpCodes.ClearArray(counter);
      return output;
    }

    /**
     * Increment counter for CTR mode
     * @param {Array} counter - Counter to increment (modified in place)
     */
    _incrementCounter(counter) {
      for (let i = counter.length - 1; i >= 0; i--) {
        counter[i] = (counter[i] + 1) & 0xFF;
        if (counter[i] !== 0) break; // No carry
      }
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new EaxAlgorithm());

  // ===== EXPORTS =====

  return { EaxAlgorithm, EaxModeInstance };
}));