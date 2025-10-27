/*
 * CBC (Cipher Block Chaining) Mode of Operation
 * Each plaintext block is XORed with the previous ciphertext block before encryption
 * Requires initialization vector (IV) for the first block
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
    root.CBC = factory(root.AlgorithmFramework, root.OpCodes);
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

  class CbcAlgorithm extends CipherModeAlgorithm {
    constructor() {
      super();

      this.name = "CBC";
      this.description = "Cipher Block Chaining mode XORs each plaintext block with the previous ciphertext block before encryption. The first block is XORed with an initialization vector (IV). Provides confidentiality but requires padding and is vulnerable to padding oracle attacks without proper implementation.";
      this.inventor = "IBM";
      this.year = 1976;
      this.category = CategoryType.MODE;
      this.subCategory = "Block Cipher Mode";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.RequiresIV = true;
      this.SupportedIVSizes = [
        new KeySize(8, 32, 8) // Common block sizes: 8 (DES), 16 (AES), 32 (256-bit blocks)
      ];

      this.documentation = [
        new LinkItem("NIST SP 800-38A", "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf"),
        new LinkItem("RFC 3602 - AES-CBC", "https://tools.ietf.org/rfc/rfc3602.txt"),
        new LinkItem("Applied Cryptography", "Bruce Schneier - Chapter 9")
      ];

      this.references = [
        new LinkItem("OpenSSL CBC Implementation", "https://github.com/openssl/openssl/blob/master/crypto/modes/cbc128.c"),
        new LinkItem("Crypto++ CBC Mode", "https://github.com/weidai11/cryptopp/blob/master/modes.cpp")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Padding Oracle Attack", "CBC with PKCS#7 padding vulnerable when decryption errors are distinguishable. Use authenticated encryption or proper error handling."),
        new Vulnerability("IV Predictability", "Predictable IVs leak information about first block. Always use cryptographically random IVs."),
        new Vulnerability("Bit-flipping Attack", "Modification of ciphertext block affects next plaintext block in predictable way")
      ];

      this.tests = [
        {
          text: "NIST SP 800-38A CBC single block",
          uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"),
          expected: OpCodes.Hex8ToBytes("7649abac8119b246cee98e9b12e9197d"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          iv: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f")
        },
        {
          text: "NIST SP 800-38A CBC multi-block",
          uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411e5fbc1191a0a52eff69f2445df4f9b17ad2b417be66c3710"),
          expected: OpCodes.Hex8ToBytes("7649abac8119b246cee98e9b12e9197d5086cb9b507219ee95db113a917678b273bed6b8e3c1743b7116e69e222295163ff1caa1681fac09120eca307586e1a7"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          iv: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new CbcModeInstance(this, isInverse);
    }
  }

  class CbcModeInstance extends IAlgorithmInstance {
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
      if (this.inputBuffer.length % blockSize !== 0) {
        throw new Error(`Input length must be multiple of ${blockSize} bytes for CBC mode`);
      }

      const output = [];
      let chainBlock = [...this.iv]; // Start with IV for chaining

      if (this.isInverse) {
        // CBC Decryption: C_i = E_K^-1(ciphertext_i) XOR C_{i-1}
        for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
          const cipherBlock = this.inputBuffer.slice(i, i + blockSize);

          // Decrypt the current ciphertext block
          const decryptCipher = this.blockCipher.algorithm.CreateInstance(true);
          decryptCipher.key = this.blockCipher.key;
          decryptCipher.Feed(cipherBlock);
          const decrypted = decryptCipher.Result();

          // XOR with previous ciphertext block (or IV for first block)
          const plainBlock = OpCodes.XorArrays(decrypted, chainBlock);
          output.push(...plainBlock);

          // Update chain for next iteration (current ciphertext becomes previous)
          chainBlock = [...cipherBlock];
        }
      } else {
        // CBC Encryption: C_i = E_K(P_i XOR C_{i-1})
        for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
          const plainBlock = this.inputBuffer.slice(i, i + blockSize);

          // XOR plaintext with previous ciphertext block (or IV for first block)
          const xorBlock = OpCodes.XorArrays(plainBlock, chainBlock);

          // Encrypt the XORed block
          const encryptCipher = this.blockCipher.algorithm.CreateInstance(false);
          encryptCipher.key = this.blockCipher.key;
          encryptCipher.Feed(xorBlock);
          const cipherBlock = encryptCipher.Result();

          output.push(...cipherBlock);

          // Update chain for next iteration (current ciphertext becomes previous)
          chainBlock = [...cipherBlock];
        }
      }

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      OpCodes.ClearArray(chainBlock);
      this.inputBuffer = [];

      return output;
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new CbcAlgorithm());

  // ===== EXPORTS =====

  return { CbcAlgorithm, CbcModeInstance };
}));