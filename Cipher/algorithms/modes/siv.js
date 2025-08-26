/*
 * SIV (Synthetic IV) Mode of Operation  
 * Authenticated encryption with synthetic initialization vectors
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

  class SivAlgorithm extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "SIV";
      this.description = "Synthetic IV (SIV) mode provides deterministic authenticated encryption by first computing an authentication tag (synthetic IV) using S2V, then encrypting with CTR mode using the synthetic IV. This mode is nonce-misuse resistant and supports key-commitment, making it safe even when nonces are reused or generated incorrectly.";
      this.inventor = "Rogaway, Shrimpton";
      this.year = 2006;
      this.category = CategoryType.MODE;
      this.subCategory = "Deterministic AEAD";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      this.SupportedTagSizes = [new KeySize(16, 16, 0)]; // Fixed 128-bit synthetic IV
      this.SupportsDetached = true;

      this.documentation = [
        new LinkItem("RFC 5297 - SIV Mode", "https://tools.ietf.org/rfc/rfc5297.txt"),
        new LinkItem("SIV Original Paper", "https://web.cs.ucdavis.edu/~rogaway/papers/siv.html"),
        new LinkItem("NIST Recommendation", "https://csrc.nist.gov/publications/detail/sp/800-38f/final")
      ];

      this.references = [
        new LinkItem("Deterministic Encryption", "Bellare et al. - DAE Security Model"),
        new LinkItem("S2V Construction", "https://tools.ietf.org/rfc/rfc5297.txt#section-2.4")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Nonce Reuse Safe", "SIV is specifically designed to be safe against nonce reuse, unlike most AEAD modes."),
        new Vulnerability("Deterministic", "Same plaintext with same AAD produces same ciphertext - may leak information patterns."),
        new Vulnerability("Performance", "Requires two passes over data (S2V then CTR), making it slower than single-pass AEAD modes.")
      ];

      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("112233445566778899aabbccddee"), // Plaintext
          OpCodes.Hex8ToBytes("40c02b9690c4dc04daef7f6afe5c85aab4ad09ed6c67089b7b3bb6e78e0e5c5f0b5c03f9c91d7e"), // Expected SIV output
          "SIV test vector from RFC 5297",
          "https://tools.ietf.org/rfc/rfc5297.txt"
        )
      ];

      // Add test parameters
      this.tests.forEach(test => {
        test.key = OpCodes.Hex8ToBytes("fffefdfc fbfaf9f8 f7f6f5f4 f3f2f1f0 6f6e6d6c 6b6a6968 67666564 63626160".replace(/\s/g, '')); // Double-length key for SIV
        test.aad = [OpCodes.Hex8ToBytes("10111213 14151617 18191a1b 1c1d1e1f 20212223 24252627".replace(/\s/g, ''))]; // AAD array
      });
    }

    CreateInstance(isInverse = false) {
      return new SivModeInstance(this, isInverse);
    }
  }

  class SivModeInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.blockCipher = null;
      this.key1 = null; // First half of key for MAC
      this.key2 = null; // Second half of key for CTR
      this.aad = []; // Array of associated data strings
      this.inputBuffer = [];
    }

    /**
     * Set the underlying block cipher instance and derive sub-keys
     * @param {IBlockCipherInstance} cipher - The block cipher to use
     */
    setBlockCipher(cipher) {
      if (!cipher || !cipher.BlockSize || !cipher.key) {
        throw new Error("Invalid block cipher instance");
      }

      // SIV requires double-length key
      if (cipher.key.length < 32) {
        throw new Error("SIV requires at least 256-bit key (double the block cipher key)");
      }

      this.blockCipher = cipher;
      const keyLen = cipher.key.length / 2;

      // Split key into two equal parts
      this.key1 = cipher.key.slice(0, keyLen);        // MAC key
      this.key2 = cipher.key.slice(keyLen, keyLen * 2); // CTR key
    }

    /**
     * Set associated authenticated data
     * @param {Array} aadArray - Array of AAD byte arrays
     */
    setAAD(aadArray) {
      this.aad = aadArray || [];
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      if (!this.isInverse) {
        // Encryption: S2V then CTR
        return this._encrypt();
      } else {
        // Decryption: extract IV, verify with S2V, then CTR decrypt
        if (this.inputBuffer.length < 16) {
          throw new Error("SIV ciphertext too short (missing synthetic IV)");
        }
        return this._decrypt();
      }
    }

    _encrypt() {
      // Step 1: Compute synthetic IV using S2V
      const syntheticIV = this._s2v([...this.aad, this.inputBuffer]);

      // Step 2: Encrypt plaintext using CTR mode with synthetic IV
      const ciphertext = this._ctr(this.inputBuffer, syntheticIV);

      // Step 3: Prepend synthetic IV to ciphertext
      const result = [...syntheticIV, ...ciphertext];

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return result;
    }

    _decrypt() {
      // Step 1: Extract synthetic IV and ciphertext
      const syntheticIV = this.inputBuffer.slice(0, 16);
      const ciphertext = this.inputBuffer.slice(16);

      // Step 2: Decrypt ciphertext using CTR mode
      const plaintext = this._ctr(ciphertext, syntheticIV);

      // Step 3: Compute expected synthetic IV using S2V
      const expectedIV = this._s2v([...this.aad, plaintext]);

      // Step 4: Verify synthetic IV
      if (!OpCodes.SecureCompare(syntheticIV, expectedIV)) {
        throw new Error("SIV authentication failed - synthetic IV mismatch");
      }

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return plaintext;
    }

    /**
     * S2V (String-to-Vector) construction for synthetic IV generation
     * @param {Array} strings - Array of byte arrays to authenticate
     * @returns {Array} 128-bit synthetic IV
     */
    _s2v(strings) {
      const blockSize = this.blockCipher.BlockSize;
      let d = new Array(blockSize).fill(0);

      if (strings.length === 0) {
        // RFC 5297: S2V([]) = CMAC(K1, <one>)
        d[blockSize - 1] = 1; // <one> = 0...01
        return this._cmac(d);
      }

      // Compute CMAC for all but the last string
      for (let i = 0; i < strings.length - 1; i++) {
        const cmacResult = this._cmac(strings[i]);

        // XOR with 2 * d (doubling in GF(2^128))
        d = this._gfDouble(d);
        for (let j = 0; j < blockSize; j++) {
          d[j] ^= cmacResult[j];
        }
      }

      const lastString = strings[strings.length - 1];

      if (lastString.length >= blockSize) {
        // T = dbl(d) XOR last string[0...n-1]
        d = this._gfDouble(d);
        const xorlen = Math.min(blockSize, lastString.length - blockSize + 1);
        const xorpos = lastString.length - blockSize;

        for (let j = 0; j < xorlen; j++) {
          d[j] ^= lastString[xorpos + j];
        }

        // Append remaining part and compute CMAC
        const finalInput = [...d];
        if (lastString.length > blockSize) {
          finalInput.push(...lastString.slice(0, lastString.length - blockSize));
        }

        return this._cmac(finalInput);
      } else {
        // T = dbl(d) XOR pad(last string)
        d = this._gfDouble(d);

        // Pad last string with 10* padding
        const paddedLast = [...lastString, 0x80];
        while (paddedLast.length < blockSize) {
          paddedLast.push(0x00);
        }

        for (let j = 0; j < blockSize; j++) {
          d[j] ^= paddedLast[j];
        }

        return this._cmac(d);
      }
    }

    /**
     * CMAC (Cipher-based Message Authentication Code)
     * @param {Array} data - Data to authenticate
     * @returns {Array} CMAC result
     */
    _cmac(data) {
      const blockSize = this.blockCipher.BlockSize;
      let mac = new Array(blockSize).fill(0);

      // Process complete blocks
      for (let i = 0; i < Math.floor(data.length / blockSize) * blockSize; i += blockSize) {
        const block = data.slice(i, i + blockSize);

        // XOR with previous MAC
        for (let j = 0; j < blockSize; j++) {
          mac[j] ^= block[j];
        }

        // Encrypt using MAC key
        const cipher = this.blockCipher.algorithm.CreateInstance(false);
        cipher.key = this.key1;
        cipher.Feed(mac);
        mac = cipher.Result();
      }

      // Handle final partial block if any
      const remaining = data.length % blockSize;
      if (remaining > 0) {
        const finalBlock = data.slice(-remaining);

        // Pad with 10* padding
        const paddedBlock = [...finalBlock, 0x80];
        while (paddedBlock.length < blockSize) {
          paddedBlock.push(0x00);
        }

        // XOR and encrypt
        for (let j = 0; j < blockSize; j++) {
          mac[j] ^= paddedBlock[j];
        }

        const cipher = this.blockCipher.algorithm.CreateInstance(false);
        cipher.key = this.key1;
        cipher.Feed(mac);
        mac = cipher.Result();
      }

      return mac;
    }

    /**
     * CTR mode encryption/decryption
     * @param {Array} data - Data to encrypt/decrypt
     * @param {Array} iv - Counter initialization vector
     * @returns {Array} Output data
     */
    _ctr(data, iv) {
      const blockSize = this.blockCipher.BlockSize;
      const output = [];

      // Clear the most significant bit of IV for CTR mode
      let counter = [...iv];
      counter[0] &= 0x7F;

      for (let i = 0; i < data.length; i += blockSize) {
        const remainingBytes = Math.min(blockSize, data.length - i);
        const inputBlock = data.slice(i, i + remainingBytes);

        // Encrypt counter with CTR key
        const cipher = this.blockCipher.algorithm.CreateInstance(false);
        cipher.key = this.key2;
        cipher.Feed(counter);
        const keystream = cipher.Result();

        // XOR with data
        for (let j = 0; j < remainingBytes; j++) {
          output.push(inputBlock[j] ^ keystream[j]);
        }

        // Increment counter
        this._incrementCounter(counter);
      }

      return output;
    }

    /**
     * GF(2^128) field doubling
     * @param {Array} block - 128-bit block to double
     * @returns {Array} Doubled block
     */
    _gfDouble(block) {
      const result = new Array(block.length);
      let carry = 0;

      // Process from right to left
      for (let i = block.length - 1; i >= 0; i--) {
        const newCarry = (block[i] & 0x80) ? 1 : 0;
        result[i] = ((block[i] << 1) | carry) & 0xFF;
        carry = newCarry;
      }

      // XOR with reduction polynomial if carry
      if (carry) {
        result[result.length - 1] ^= 0x87; // x^128 + x^7 + x^2 + x + 1
      }

      return result;
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

    RegisterAlgorithm(new SivAlgorithm());

  // ===== EXPORTS =====

  return { SivAlgorithm, SivModeInstance };
}));