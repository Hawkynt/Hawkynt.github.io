/*
 * OFB (Output Feedback) Mode of Operation
 * Converts a block cipher into a stream cipher with no error propagation
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

  class OfbAlgorithm extends CipherModeAlgorithm {
    constructor() {
      super();

      this.name = "OFB";
      this.description = "Output Feedback mode converts a block cipher into a stream cipher by encrypting the previous output block (or IV) to generate a keystream. Unlike CFB, errors do not propagate since the feedback uses the cipher output, not the ciphertext. Both encryption and decryption use the block cipher in encryption mode only.";
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
        new LinkItem("OpenSSL OFB Implementation", "https://github.com/openssl/openssl/blob/master/crypto/modes/ofb128.c")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("IV Reuse", "Reusing IV with same key creates identical keystream, enabling two-time pad attacks. Always use unique IVs."),
        new Vulnerability("Short Cycle Risk", "In theory, output register could enter short cycle, but extremely unlikely with good block ciphers and proper IV selection."),
        new Vulnerability("No Authentication", "OFB provides no authentication - use AEAD modes for applications requiring integrity protection.")
      ];

      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"), // Single block
          OpCodes.Hex8ToBytes("3b3fd92eb72dad20333449f8e83cfb4a"), // Expected OFB output
          "NIST SP 800-38A OFB test vector",
          "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411e5fbc1191a0a52eff69f2445df4f9b17ad2b417be66c3710"), // Multi-block
          OpCodes.Hex8ToBytes("3b3fd92eb72dad20333449f8e83cfb4a7789508d16918f03f53c52dac54ed8259740051e9c5fecf64344f7a82260edcc304c6528f659c77866a510d9c1d6ae5e"), // Expected OFB multi-block
          "NIST SP 800-38A OFB multi-block",
          "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf"
        )
      ];

      // Add common test parameters
      this.tests.forEach(test => {
        test.key = OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"); // AES-128 test key
        test.iv = OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f");  // Test IV
      });
    }

    CreateInstance(isInverse = false) {
      return new OfbModeInstance(this, isInverse);
    }
  }

  class OfbModeInstance extends IAlgorithmInstance {
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
      let outputRegister = [...this.iv]; // Initialize with IV

      // NOTE: OFB encryption and decryption are identical operations
      // Both use the block cipher in encryption mode only
      for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
        const remainingBytes = Math.min(blockSize, this.inputBuffer.length - i);
        const inputBlock = this.inputBuffer.slice(i, i + remainingBytes);

        // Encrypt the output register to create keystream
        const encryptCipher = this.blockCipher.algorithm.CreateInstance(false);
        encryptCipher.key = this.blockCipher.key;
        encryptCipher.Feed(outputRegister);
        const keystream = encryptCipher.Result();

        // XOR input with keystream to get output
        const outputBlock = [];
        for (let j = 0; j < remainingBytes; j++) {
          outputBlock[j] = inputBlock[j] ^ keystream[j];
        }
        output.push(...outputBlock);

        // Update output register for next iteration
        // In OFB, feedback comes from cipher output, not from plaintext/ciphertext
        outputRegister = [...keystream]; // Full keystream becomes next input
      }

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      OpCodes.ClearArray(outputRegister);
      this.inputBuffer = [];

      return output;
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new OfbAlgorithm());

  // ===== EXPORTS =====

  return { OfbAlgorithm, OfbModeInstance };
}));