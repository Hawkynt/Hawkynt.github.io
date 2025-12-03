/*
 * XTEA (Extended TEA) Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * XTEA Algorithm by David Wheeler and Roger Needham (1997)
 * - 64-bit block cipher with 128-bit keys
 * - 64 rounds (32 cycles) using improved key schedule over TEA
 * - Magic constant: 2^32 / golden ratio
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

  /**
 * XTEAAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

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
      this.SupportedBlockSizes = [
        new KeySize(8, 8, 0) // Fixed 64-bit blocks
      ];
      this.SupportedKeySizes = [
        new AlgorithmFramework.KeySize(16, 16, 0) // Fixed 128-bit key
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
      this.tests = [
        {
          text: "XTEA All Zeros Test Vector",
          uri: "https://www.cix.co.uk/~klockstone/xtea.htm",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("dee9d4d8f7131ed9")
        },
        {
          text: "XTEA Pattern Test Vector",
          uri: "https://www.cix.co.uk/~klockstone/xtea.htm",
          input: OpCodes.Hex8ToBytes("0123456789abcdef"),
          key: OpCodes.Hex8ToBytes("0123456789abcdef0123456789abcdef"),
          expected: OpCodes.Hex8ToBytes("27e795e076b2b537")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new XTEAInstance(this, isInverse);
    }
  }

  /**
 * XTEA cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class XTEAInstance extends AlgorithmFramework.IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;

      // XTEA constants
      this.CYCLES = 32;                          // XTEA uses 32 cycles (64 rounds)
      this.DELTA = OpCodes.Pack32BE(...OpCodes.Hex8ToBytes('9E3779B9')); // Magic constant: 2^32 / golden ratio
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.keyWords = null;
        this.sum0 = null;
        this.sum1 = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size
      if (keyBytes.length !== 16) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (must be 16)`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;

      // Convert 128-bit key to four 32-bit words (big-endian) - Bouncy Castle format
      this.keyWords = [
        OpCodes.Pack32BE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3]),
        OpCodes.Pack32BE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]),
        OpCodes.Pack32BE(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11]),
        OpCodes.Pack32BE(keyBytes[12], keyBytes[13], keyBytes[14], keyBytes[15])
      ];

      // Precompute sum arrays as per Bouncy Castle C# reference
      this.sum0 = new Array(this.CYCLES);
      this.sum1 = new Array(this.CYCLES);
      
      let j = 0;
      for (let i = 0; i < this.CYCLES; i++) {
        this.sum0[i] = OpCodes.ToUint32(j + this.keyWords[OpCodes.AndN(j, 3)]);
        j = OpCodes.ToUint32(j + this.DELTA);
        this.sum1[i] = OpCodes.ToUint32(j + this.keyWords[OpCodes.AndN(OpCodes.Shr32(j, 11), 3)]);
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
      if (!this.key) throw new Error("Key not set");

      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */
    Result() {
      if (!this.key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Validate input length
      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
      }

      const output = [];

      // Process each 8-byte block
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        const processedBlock = this.isInverse 
          ? this._decryptBlock(block) 
          : this._encryptBlock(block);
        output.push(...processedBlock);
      }

      // Clear input buffer
      this.inputBuffer = [];

      return output;
    }

    // Encrypt 64-bit block - Bouncy Castle C# reference implementation
    _encryptBlock(block) {
      if (block.length !== 8) {
        throw new Error('XTEA block size must be exactly 8 bytes');
      }

      // Pack to 32-bit words (big-endian)
      let v0 = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      let v1 = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);

      // XTEA encryption using precomputed sum arrays (Bouncy Castle method)
      for (let i = 0; i < this.CYCLES; i++) {
        v0 = OpCodes.ToUint32(v0 + OpCodes.XorN(
          OpCodes.ToUint32(OpCodes.XorN(OpCodes.Shl32(v1, 4), OpCodes.Shr32(v1, 5)) + v1),
          this.sum0[i]));
        v1 = OpCodes.ToUint32(v1 + OpCodes.XorN(
          OpCodes.ToUint32(OpCodes.XorN(OpCodes.Shl32(v0, 4), OpCodes.Shr32(v0, 5)) + v0),
          this.sum1[i]));
      }

      // Unpack to bytes (big-endian)
      return [
        ...OpCodes.Unpack32BE(v0),
        ...OpCodes.Unpack32BE(v1)
      ];
    }

    // Decrypt 64-bit block - Bouncy Castle C# reference implementation
    _decryptBlock(block) {
      if (block.length !== 8) {
        throw new Error('XTEA block size must be exactly 8 bytes');
      }

      // Pack to 32-bit words (big-endian)
      let v0 = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      let v1 = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);

      // XTEA decryption using precomputed sum arrays (reverse order)
      for (let i = this.CYCLES - 1; i >= 0; i--) {
        v1 = OpCodes.ToUint32(v1 - OpCodes.XorN(
          OpCodes.ToUint32(OpCodes.XorN(OpCodes.Shl32(v0, 4), OpCodes.Shr32(v0, 5)) + v0),
          this.sum1[i]));
        v0 = OpCodes.ToUint32(v0 - OpCodes.XorN(
          OpCodes.ToUint32(OpCodes.XorN(OpCodes.Shl32(v1, 4), OpCodes.Shr32(v1, 5)) + v1),
          this.sum0[i]));
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