/*
 * CFB (Cipher Feedback) Mode of Operation
 * Converts a block cipher into a stream cipher using feedback mechanism
 * The block cipher is always used in encryption mode for both encryption and decryption
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
    root.CFB = factory(root.AlgorithmFramework, root.OpCodes);
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

  class CfbAlgorithm extends CipherModeAlgorithm {
    constructor() {
      super();

      this.name = "CFB";
      this.description = "Cipher Feedback mode converts a block cipher into a stream cipher by encrypting the previous ciphertext block (or IV) and XORing the result with plaintext. Self-synchronizing mode with error propagation properties. Both encryption and decryption use the block cipher in encryption mode only.";
      this.inventor = "IBM/NIST";
      this.year = 1981;
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
        new LinkItem("FIPS 81", "https://csrc.nist.gov/csrc/media/publications/fips/81/archive/1980-12-02/documents/fips81.pdf"),
        new LinkItem("ISO/IEC 10116", "ISO standard for modes of operation")
      ];

      this.references = [
        new LinkItem("Handbook of Applied Cryptography", "Chapter 7 - Block Ciphers"),
        new LinkItem("OpenSSL CFB Implementation", "https://github.com/openssl/openssl/blob/master/crypto/modes/cfb128.c")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Error Propagation", "Single bit error in ciphertext affects one block plus corresponding bit in next block. Not always a vulnerability but important characteristic."),
        new Vulnerability("IV Reuse", "Reusing IV with same key creates keystream reuse vulnerability. Always use unique IVs."),
        new Vulnerability("Short Cycle Risk", "In degenerate cases, feedback register might enter short cycle, though extremely unlikely with good block ciphers")
      ];

      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"), // Single block
          OpCodes.Hex8ToBytes("3b3fd92eb72dad20333449f8e83cfb4a"), // Expected CFB output
          "NIST SP 800-38A CFB128 test vector",
          "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411e5fbc1191a0a52eff69f2445df4f9b17ad2b417be66c3710"), // Multi-block
          OpCodes.Hex8ToBytes("3b3fd92eb72dad20333449f8e83cfb4ac8a64537a0b3a93fcde3cdad9f1ce58b26751f67a3cbb140b1808cf187a4f4dfc04b05357c5d1c0eeac4c66f9ff7f2e6"), // Expected CFB128 multi-block
          "NIST SP 800-38A CFB128 multi-block",
          "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf"
        )
      ];

      // Add common test parameters
      this.tests.forEach(test => {
        test.cipher = "AES";  // Use AES cipher for NIST test vectors
        test.key = OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"); // AES-128 test key
        test.iv = OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f");  // Test IV
      });
    }

    CreateInstance(isInverse = false) {
      return new CfbModeInstance(this, isInverse);
    }
  }

  class CfbModeInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.blockCipher = null;
      this.inputBuffer = [];
      this.iv = null;
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
     * Set the initialization vector (IV)
     * @param {Array} iv - Initialization vector (must match block size)
     */
    setIV(iv) {
      if (!this.blockCipher) {
        throw new Error("Block cipher must be set before IV");
      }
      if (!iv || iv.length !== this.blockCipher.BlockSize) {
        throw new Error(`IV must be ${this.blockCipher.BlockSize} bytes`);
      }
      this.iv = [...iv]; // Copy IV
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      if (!this.iv) {
        throw new Error("IV not set. Call setIV() first.");
      }
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      if (!this.iv) {
        throw new Error("IV not set. Call setIV() first.");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      const blockSize = this.blockCipher.BlockSize;
      const output = [];
      let feedbackRegister = [...this.iv]; // Initialize with IV

      if (this.isInverse) {
        // CFB Decryption: P_i = C_i XOR E_K(C_{i-1})
        // Note: Block cipher is always used in encryption mode
        for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
          const remainingBytes = Math.min(blockSize, this.inputBuffer.length - i);
          const cipherBlock = this.inputBuffer.slice(i, i + remainingBytes);

          // Encrypt the feedback register to create keystream
          const encryptCipher = this.blockCipher.algorithm.CreateInstance(false);
          encryptCipher.key = this.blockCipher.key;
          encryptCipher.Feed(feedbackRegister);
          const keystream = encryptCipher.Result();

          // XOR ciphertext with keystream to get plaintext
          const plainBlock = [];
          for (let j = 0; j < remainingBytes; j++) {
            plainBlock[j] = cipherBlock[j] ^ keystream[j];
          }
          output.push(...plainBlock);

          // Update feedback register for next iteration
          // Shift left by block size and insert current ciphertext
          if (remainingBytes === blockSize) {
            feedbackRegister = [...cipherBlock]; // Full block replacement
          } else {
            // Partial block: shift existing content and insert new bytes
            feedbackRegister = [...feedbackRegister.slice(remainingBytes), ...cipherBlock];
          }
        }
      } else {
        // CFB Encryption: C_i = P_i XOR E_K(C_{i-1})
        // Note: Block cipher is always used in encryption mode
        for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
          const remainingBytes = Math.min(blockSize, this.inputBuffer.length - i);
          const plainBlock = this.inputBuffer.slice(i, i + remainingBytes);

          // Encrypt the feedback register to create keystream
          const encryptCipher = this.blockCipher.algorithm.CreateInstance(false);
          encryptCipher.key = this.blockCipher.key;
          encryptCipher.Feed(feedbackRegister);
          const keystream = encryptCipher.Result();

          // XOR plaintext with keystream to get ciphertext
          const cipherBlock = [];
          for (let j = 0; j < remainingBytes; j++) {
            cipherBlock[j] = plainBlock[j] ^ keystream[j];
          }
          output.push(...cipherBlock);

          // Update feedback register for next iteration
          // Shift left by block size and insert current ciphertext
          if (remainingBytes === blockSize) {
            feedbackRegister = [...cipherBlock]; // Full block replacement
          } else {
            // Partial block: shift existing content and insert new bytes
            feedbackRegister = [...feedbackRegister.slice(remainingBytes), ...cipherBlock];
          }
        }
      }

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      OpCodes.ClearArray(feedbackRegister);
      this.inputBuffer = [];

      return output;
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new CfbAlgorithm());

  // ===== EXPORTS =====

  return { CfbAlgorithm, CfbModeInstance };
}));