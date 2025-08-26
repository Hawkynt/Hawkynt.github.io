/*
 * XTEA (Extended TEA) Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * XTEA Algorithm by David Wheeler and Roger Needham (1997)
 * - 64-bit block cipher with 128-bit keys
 * - 64 rounds (32 cycles) using improved key schedule over TEA
 * - Magic constant: 0x9E3779B9 (derived from golden ratio)
 * - Addresses equivalent key problem and other weaknesses in TEA
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

  class XTEAAlgorithm extends AlgorithmFramework.BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "XTEA";
      this.description = "Extended TEA cipher by Wheeler and Needham with improved key schedule and better security than TEA. Uses 64 rounds with 64-bit blocks and 128-bit keys. Educational cipher for understanding Feistel networks.";
      this.inventor = "David Wheeler, Roger Needham";
      this.year = 1997;
      this.category = AlgorithmFramework.CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = AlgorithmFramework.SecurityStatus.EDUCATIONAL;
      this.complexity = AlgorithmFramework.ComplexityType.BEGINNER;
      this.country = AlgorithmFramework.CountryCode.GB;

      // Block and key specifications
      this.blockSize = 8; // 64-bit blocks
      this.keySizes = [
        new AlgorithmFramework.KeySize(16, 16, 1) // Fixed 128-bit key
      ];

      // Documentation and references
      this.documentation = [
        new AlgorithmFramework.LinkItem("TEA extensions and corrections", "https://www.cix.co.uk/~klockstone/xtea.htm"),
        new AlgorithmFramework.LinkItem("Cambridge Computer Laboratory", "https://www.cl.cam.ac.uk/teaching/1415/SecurityII/"),
        new AlgorithmFramework.LinkItem("Block TEA improvements", "https://link.springer.com/chapter/10.1007/3-540-60590-8_29")
      ];

      this.references = [
        new AlgorithmFramework.LinkItem("Crypto++ XTEA Implementation", "https://github.com/weidai11/cryptopp/blob/master/xtea.cpp"),
        new AlgorithmFramework.LinkItem("Bouncy Castle XTEA Implementation", "https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines"),
        new AlgorithmFramework.LinkItem("Python XTEA Implementation", "https://pypi.org/project/xtea/")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new AlgorithmFramework.Vulnerability("Limited analysis", "https://www.schneier.com/academic/", "Less cryptanalysis compared to modern ciphers, potential unknown weaknesses exist", "Use modern standardized ciphers like AES for production applications"),
        new AlgorithmFramework.Vulnerability("Related-key attacks", "https://eprint.iacr.org/", "While improved over TEA, XTEA may still be vulnerable to certain related-key attacks", "Avoid key reuse and use proper key management practices")
      ];

      // Test vectors from various sources
      this.testCases = [
        new AlgorithmFramework.TestCase(
          "XTEA all-zeros test vector",
          OpCodes.Hex8ToBytes("0000000000000000"),
          OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          OpCodes.Hex8ToBytes("dee9d4d8f7131ed9"),
          [new AlgorithmFramework.LinkItem("Educational test vector", "")]
        ),
        new AlgorithmFramework.TestCase(
          "XTEA pattern test vector",
          OpCodes.Hex8ToBytes("0123456789abcdef"),
          OpCodes.Hex8ToBytes("0123456789abcdef0123456789abcdef"),
          OpCodes.Hex8ToBytes("dd59ce6b8f15d1cd"),
          [new AlgorithmFramework.LinkItem("Educational test vector", "")]
        )
      ];
    }

    CreateInstance(key) {
      return new XTEAInstance(key);
    }
  }

  class XTEAInstance extends AlgorithmFramework.IBlockCipherInstance {
    constructor(key) {
      super();

      // XTEA constants
      this.CYCLES = 32;                          // XTEA uses 32 cycles (64 rounds)
      this.DELTA = 0x9E3779B9;                   // Magic constant: 2^32 / golden ratio

      this._setupKey(key);
    }

    _setupKey(keyBytes) {
      if (!keyBytes) {
        throw new Error("Key is required");
      }

      // Validate key size
      if (keyBytes.length !== 16) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (must be 16)`);
      }

      // Convert 128-bit key to four 32-bit words (big-endian)
      this.keyWords = [
        OpCodes.Pack32BE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3]),
        OpCodes.Pack32BE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]),
        OpCodes.Pack32BE(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11]),
        OpCodes.Pack32BE(keyBytes[12], keyBytes[13], keyBytes[14], keyBytes[15])
      ];
    }

    EncryptBlock(blockIndex, data) {
      if (data.length !== 8) {
        throw new Error('XTEA requires exactly 8 bytes per block');
      }
      return this._encryptBlock(data);
    }

    DecryptBlock(blockIndex, data) {
      if (data.length !== 8) {
        throw new Error('XTEA requires exactly 8 bytes per block');
      }
      return this._decryptBlock(data);
    }

    // Encrypt 64-bit block
    _encryptBlock(block) {
      if (block.length !== 8) {
        throw new Error('XTEA block size must be exactly 8 bytes');
      }

      // Pack to 32-bit words (big-endian)
      let v0 = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      let v1 = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);

      let sum = 0;
      const delta = this.DELTA;

      // XTEA encryption using explicit unsigned arithmetic
      for (let i = 0; i < this.CYCLES; i++) {
        // First operation: v0 += ...
        const term1 = (((v1 << 4) ^ (v1 >>> 5)) + v1) >>> 0;
        const term2 = (sum + this.keyWords[sum & 3]) >>> 0;
        const xor_result = (term1 ^ term2) >>> 0;
        v0 = (v0 + xor_result) >>> 0;

        // Second operation: sum += delta
        sum = (sum + delta) >>> 0;

        // Third operation: v1 += ...
        const term3 = (((v0 << 4) ^ (v0 >>> 5)) + v0) >>> 0;
        const term4 = (sum + this.keyWords[(sum >>> 11) & 3]) >>> 0;
        const xor_result2 = (term3 ^ term4) >>> 0;
        v1 = (v1 + xor_result2) >>> 0;
      }

      // Unpack to bytes (big-endian)
      return [
        ...OpCodes.Unpack32BE(v0),
        ...OpCodes.Unpack32BE(v1)
      ];
    }

    // Decrypt 64-bit block
    _decryptBlock(block) {
      if (block.length !== 8) {
        throw new Error('XTEA block size must be exactly 8 bytes');
      }

      // Pack to 32-bit words (big-endian)
      let v0 = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      let v1 = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);

      const delta = this.DELTA;
      let sum = (delta * this.CYCLES) >>> 0;

      // XTEA decryption using explicit unsigned arithmetic (reverse of encryption)
      for (let i = 0; i < this.CYCLES; i++) {
        // First operation: v1 -= ...
        const term1 = (((v0 << 4) ^ (v0 >>> 5)) + v0) >>> 0;
        const term2 = (sum + this.keyWords[(sum >>> 11) & 3]) >>> 0;
        const xor_result = (term1 ^ term2) >>> 0;
        v1 = (v1 - xor_result) >>> 0;

        // Second operation: sum -= delta
        sum = (sum - delta) >>> 0;

        // Third operation: v0 -= ...
        const term3 = (((v1 << 4) ^ (v1 >>> 5)) + v1) >>> 0;
        const term4 = (sum + this.keyWords[sum & 3]) >>> 0;
        const xor_result2 = (term3 ^ term4) >>> 0;
        v0 = (v0 - xor_result2) >>> 0;
      }

      // Unpack to bytes (big-endian)
      return [
        ...OpCodes.Unpack32BE(v0),
        ...OpCodes.Unpack32BE(v1)
      ];
    }
  }

  // ===== REGISTRATION =====

    const algorithmInstance = new XTEAAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { XTEAAlgorithm, XTEAInstance };
}));