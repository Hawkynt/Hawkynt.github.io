/*
 * CTR (Counter) Mode of Operation
 * Converts a block cipher into a stream cipher by encrypting counter values
 * Supports parallel processing and random access
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

  class CtrAlgorithm extends CipherModeAlgorithm {
    constructor() {
      super();

      this.name = "CTR";
      this.description = "Counter mode converts a block cipher into a stream cipher by encrypting successive counter values to generate a keystream. Allows parallel processing and random access. The counter typically combines a nonce (number used once) with an incrementing counter value. Both encryption and decryption use the block cipher in encryption mode only.";
      this.inventor = "Whitfield Diffie, Martin Hellman";
      this.year = 1979;
      this.category = CategoryType.MODE;
      this.subCategory = "Stream Cipher Mode";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.RequiresIV = true;
      this.SupportedIVSizes = [
        new KeySize(8, 32, 8) // Common block sizes: 8 (DES), 16 (AES), 32 (256-bit blocks)
      ];

      this.documentation = [
        new LinkItem("NIST SP 800-38A", "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf"),
        new LinkItem("RFC 3686 - AES-CTR", "https://tools.ietf.org/rfc/rfc3686.txt"),
        new LinkItem("Applied Cryptography", "Bruce Schneier - Chapter 9")
      ];

      this.references = [
        new LinkItem("OpenSSL CTR Implementation", "https://github.com/openssl/openssl/blob/master/crypto/modes/ctr128.c"),
        new LinkItem("Crypto++ CTR Mode", "https://github.com/weidai11/cryptopp/blob/master/modes.cpp")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Nonce Reuse", "Reusing nonce/counter combination reveals XOR of plaintexts. Ensure unique nonces and proper counter management."),
        new Vulnerability("Counter Overflow", "If counter overflows and wraps around, keystream may repeat. Use sufficiently large counter space."),
        new Vulnerability("No Authentication", "CTR provides no integrity protection. Use AEAD modes or combine with MAC for authentication.")
      ];

      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"), // Single block
          OpCodes.Hex8ToBytes("874d6191b620e3261bef6864990db6ce"), // Expected CTR output
          "NIST SP 800-38A CTR test vector",
          "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411e5fbc1191a0a52eff69f2445df4f9b17ad2b417be66c3710"), // Multi-block
          OpCodes.Hex8ToBytes("874d6191b620e3261bef6864990db6ce9806f66b7970fdff8617187bb9fffdff5ae4df3edbd5d35e5b4f09020db03eab1e031dda2fbe03d1792170a0f3009cee"), // Expected CTR multi-block
          "NIST SP 800-38A CTR multi-block",
          "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf"
        )
      ];

      // Add common test parameters
      this.tests.forEach(test => {
        test.key = OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"); // AES-128 test key
        test.iv = OpCodes.Hex8ToBytes("f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff"); // Test nonce/IV
      });
    }

    CreateInstance(isInverse = false) {
      return new CtrModeInstance(this, isInverse);
    }
  }

  class CtrModeInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.blockCipher = null;
      this.inputBuffer = [];
      this.nonce = null;
      this.counter = 0;
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
     * Set the nonce (IV for counter mode)
     * @param {Array} nonce - Nonce value (must match block size)
     */
    setNonce(nonce) {
      if (!this.blockCipher) {
        throw new Error("Block cipher must be set before nonce");
      }
      if (!nonce || nonce.length !== this.blockCipher.BlockSize) {
        throw new Error(`Nonce must be ${this.blockCipher.BlockSize} bytes`);
      }
      this.nonce = [...nonce]; // Copy nonce
      this.counter = 0; // Reset counter when setting new nonce
    }

    /**
     * Alternative method for compatibility with IV-based interfaces
     */
    setIV(iv) {
      this.setNonce(iv);
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

    /**
     * Increment counter in big-endian format
     * @param {Array} counterBlock - Counter block to increment
     * @param {number} increment - Value to add to counter
     */
    _incrementCounter(counterBlock, increment = 1) {
      const result = [...counterBlock];
      let carry = increment;

      // Add from least significant byte (right to left)
      for (let i = result.length - 1; i >= 0 && carry > 0; i--) {
        const sum = result[i] + carry;
        result[i] = sum & 0xFF;
        carry = Math.floor(sum / 256);
      }

      return result;
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
      const output = [];
      let counterBlock = [...this.nonce]; // Start with nonce as initial counter

      // NOTE: CTR encryption and decryption are identical operations
      // Both use the block cipher in encryption mode only
      for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
        const remainingBytes = Math.min(blockSize, this.inputBuffer.length - i);
        const inputBlock = this.inputBuffer.slice(i, i + remainingBytes);

        // Encrypt the counter block to create keystream
        const encryptCipher = this.blockCipher.algorithm.CreateInstance(false);
        encryptCipher.key = this.blockCipher.key;
        encryptCipher.Feed(counterBlock);
        const keystream = encryptCipher.Result();

        // XOR input with keystream to get output
        const outputBlock = [];
        for (let j = 0; j < remainingBytes; j++) {
          outputBlock[j] = inputBlock[j] ^ keystream[j];
        }
        output.push(...outputBlock);

        // Increment counter for next block
        counterBlock = this._incrementCounter(counterBlock, 1);
      }

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      OpCodes.ClearArray(counterBlock);
      this.inputBuffer = [];

      return output;
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new CtrAlgorithm());

  // ===== EXPORTS =====

  return { CtrAlgorithm, CtrModeInstance };
}));