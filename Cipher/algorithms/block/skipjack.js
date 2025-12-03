/*
 * Skipjack Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Skipjack Algorithm by NSA (Declassified June 24, 1998)
 * - 64-bit block size, 80-bit key size (10 bytes)
 * - Uses unbalanced Feistel network with 32 rounds
 * - Originally designed for Clipper chip (Escrowed Encryption Standard)
 * - Historical significance as first declassified NSA block cipher
 */

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
 * SkipjackAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class SkipjackAlgorithm extends AlgorithmFramework.BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Skipjack";
      this.description = "Declassified NSA block cipher from 1998, originally designed for the Clipper chip. Uses unbalanced Feistel network with 32 rounds, 64-bit blocks, and 80-bit keys. Historical significance only.";
      this.inventor = "NSA (National Security Agency)";
      this.year = 1987;
      this.category = AlgorithmFramework.CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = AlgorithmFramework.SecurityStatus.BROKEN;
      this.complexity = AlgorithmFramework.ComplexityType.INTERMEDIATE;
      this.country = AlgorithmFramework.CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new AlgorithmFramework.KeySize(10, 10, 1) // Fixed 80-bit key
      ];
      this.SupportedBlockSizes = [
        new AlgorithmFramework.KeySize(8, 8, 1) // Fixed 64-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new AlgorithmFramework.LinkItem("Skipjack and KEA Algorithm Specifications", "https://csrc.nist.gov/csrc/media/projects/cryptographic-algorithm-validation-program/documents/skipjack/skipjack.pdf"),
        new AlgorithmFramework.LinkItem("NIST Special Publication 800-17", "https://csrc.nist.gov/publications/detail/sp/800-17/archive/1998-02-01"),
        new AlgorithmFramework.LinkItem("Declassification of SkipJack", "https://www.nsa.gov/news-features/declassified-documents/")
      ];

      this.references = [
        new AlgorithmFramework.LinkItem("Original NSA Reference Implementation", "https://github.com/coruus/nist-testvectors"),
        new AlgorithmFramework.LinkItem("Cryptanalysis of SkipJack", "https://www.schneier.com/academic/archives/1998/09/cryptanalysis_of_ski.html"),
        new AlgorithmFramework.LinkItem("SkipJack Cryptanalysis Papers", "https://eprint.iacr.org/")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new AlgorithmFramework.Vulnerability("NIST Withdrawal", "https://csrc.nist.gov/publications/detail/sp/800-17/archive/1998-02-01", "NIST approval withdrawn in 2015. Not approved for new cryptographic protection", "Use modern standardized ciphers like AES"),
        new AlgorithmFramework.Vulnerability("Differential Cryptanalysis", "https://www.schneier.com/academic/archives/1998/09/cryptanalysis_of_ski.html", "Vulnerable to differential attacks with reduced complexity", "Algorithm is deprecated - do not use for any security applications"),
        new AlgorithmFramework.Vulnerability("Related-key attacks", "https://eprint.iacr.org/", "Weak key schedule allows related-key attacks", "Historical and educational interest only")
      ];

      // Test vectors verified with BouncyCastle reference implementation
      this.tests = [
        {
          text: "Skipjack test vector - all zeros key and plaintext",
          uri: "Verified with BouncyCastle implementation",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000"),
          expected: OpCodes.Hex8ToBytes("aaae8ede6764143d")
        },
        {
          text: "Skipjack test vector - pattern key and plaintext", 
          uri: "Verified with BouncyCastle implementation",
          input: OpCodes.Hex8ToBytes("3322110033ccbbaa"),
          key: OpCodes.Hex8ToBytes("00776655443322110088"),
          expected: OpCodes.Hex8ToBytes("8643bc24c71c4a60")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SkipjackInstance(this, isInverse);
    }
  }

  /**
 * Skipjack cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SkipjackInstance extends AlgorithmFramework.IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.keyBytes = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
      this.key0 = null;
      this.key1 = null;
      this.key2 = null;
      this.key3 = null;

      // Initialize F-table (S-box) - Official from NSA specification
      this._initFTable();
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.keyBytes = null;
        this.KeySize = 0;
        this.key0 = null;
        this.key1 = null;
        this.key2 = null;
        this.key3 = null;
        return;
      }

      // Validate key size
      if (keyBytes.length !== 10) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (must be 10)`);
      }

      this._key = [...keyBytes];
      this.keyBytes = [...keyBytes];
      this.KeySize = keyBytes.length;

      // Expand the key to 128 bytes in 4 parts (following BouncyCastle)
      this.key0 = new Array(32);
      this.key1 = new Array(32);
      this.key2 = new Array(32);
      this.key3 = new Array(32);
      
      for (let i = 0; i < 32; i++) {
        this.key0[i] = keyBytes[(i * 4 + 0) % 10];
        this.key1[i] = keyBytes[(i * 4 + 1) % 10];
        this.key2[i] = keyBytes[(i * 4 + 2) % 10];
        this.key3[i] = keyBytes[(i * 4 + 3) % 10];
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

    /**
     * Initialize Skipjack F-table (S-box) - Official from NSA specification
     */
    _initFTable() {
      this.FTABLE = new Uint8Array([
        0xa3,0xd7,0x09,0x83,0xf8,0x48,0xf6,0xf4,0xb3,0x21,0x15,0x78,0x99,0xb1,0xaf,0xf9,
        0xe7,0x2d,0x4d,0x8a,0xce,0x4c,0xca,0x2e,0x52,0x95,0xd9,0x1e,0x4e,0x38,0x44,0x28,
        0x0a,0xdf,0x02,0xa0,0x17,0xf1,0x60,0x68,0x12,0xb7,0x7a,0xc3,0xe9,0xfa,0x3d,0x53,
        0x96,0x84,0x6b,0xba,0xf2,0x63,0x9a,0x19,0x7c,0xae,0xe5,0xf5,0xf7,0x16,0x6a,0xa2,
        0x39,0xb6,0x7b,0x0f,0xc1,0x93,0x81,0x1b,0xee,0xb4,0x1a,0xea,0xd0,0x91,0x2f,0xb8,
        0x55,0xb9,0xda,0x85,0x3f,0x41,0xbf,0xe0,0x5a,0x58,0x80,0x5f,0x66,0x0b,0xd8,0x90,
        0x35,0xd5,0xc0,0xa7,0x33,0x06,0x65,0x69,0x45,0x00,0x94,0x56,0x6d,0x98,0x9b,0x76,
        0x97,0xfc,0xb2,0xc2,0xb0,0xfe,0xdb,0x20,0xe1,0xeb,0xd6,0xe4,0xdd,0x47,0x4a,0x1d,
        0x42,0xed,0x9e,0x6e,0x49,0x3c,0xcd,0x43,0x27,0xd2,0x07,0xd4,0xde,0xc7,0x67,0x18,
        0x89,0xcb,0x30,0x1f,0x8d,0xc6,0x8f,0xaa,0xc8,0x74,0xdc,0xc9,0x5d,0x5c,0x31,0xa4,
        0x70,0x88,0x61,0x2c,0x9f,0x0d,0x2b,0x87,0x50,0x82,0x54,0x64,0x26,0x7d,0x03,0x40,
        0x34,0x4b,0x1c,0x73,0xd1,0xc4,0xfd,0x3b,0xcc,0xfb,0x7f,0xab,0xe6,0x3e,0x5b,0xa5,
        0xad,0x04,0x23,0x9c,0x14,0x51,0x22,0xf0,0x29,0x79,0x71,0x7e,0xff,0x8c,0x0e,0xe2,
        0x0c,0xef,0xbc,0x72,0x75,0x6f,0x37,0xa1,0xec,0xd3,0x8e,0x62,0x8b,0x86,0x10,0xe8,
        0x08,0x77,0x11,0xbe,0x92,0x4f,0x24,0xc5,0x32,0x36,0x9d,0xcf,0xf3,0xa6,0xbb,0xac,
        0x5e,0x6c,0xa9,0x13,0x57,0x25,0xb5,0xe3,0xbd,0xa8,0x3a,0x01,0x05,0x59,0x2a,0x46
      ]);
    }

    /**
     * The G permutation (following BouncyCastle implementation)
     */
    _G(k, w) {
      let g1 = OpCodes.AndN(OpCodes.Shr32(w, 8), 0xFF);
      let g2 = OpCodes.AndN(w, 0xFF);

      let g3 = OpCodes.XorN(this.FTABLE[OpCodes.XorN(g2, this.key0[k])], g1);
      let g4 = OpCodes.XorN(this.FTABLE[OpCodes.XorN(g3, this.key1[k])], g2);
      let g5 = OpCodes.XorN(this.FTABLE[OpCodes.XorN(g4, this.key2[k])], g3);
      let g6 = OpCodes.XorN(this.FTABLE[OpCodes.XorN(g5, this.key3[k])], g4);
      
      return OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(g5, 8), g6));
    }
    
    /**
     * The inverse of the G permutation (H function)
     */
    _H(k, w) {
      let h1 = OpCodes.AndN(w, 0xFF);
      let h2 = OpCodes.AndN(OpCodes.Shr32(w, 8), 0xFF);

      let h3 = OpCodes.XorN(this.FTABLE[OpCodes.XorN(h2, this.key3[k])], h1);
      let h4 = OpCodes.XorN(this.FTABLE[OpCodes.XorN(h3, this.key2[k])], h2);
      let h5 = OpCodes.XorN(this.FTABLE[OpCodes.XorN(h4, this.key1[k])], h3);
      let h6 = OpCodes.XorN(this.FTABLE[OpCodes.XorN(h5, this.key0[k])], h4);

      return OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(h6, 8), h5));
    }

    /**
     * Encrypt 64-bit block (following BouncyCastle implementation)
     */
    _encryptBlock(block) {
      if (block.length !== 8) {
        throw new Error('Skipjack block size must be exactly 8 bytes');
      }

      if (!this.key0) {
        throw new Error('Key not properly initialized');
      }

      // Convert plaintext to 4 16-bit words (big-endian)
      let w1 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(block[0], 8), OpCodes.AndN(block[1], 0xFF)));
      let w2 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(block[2], 8), OpCodes.AndN(block[3], 0xFF)));
      let w3 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(block[4], 8), OpCodes.AndN(block[5], 0xFF)));
      let w4 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(block[6], 8), OpCodes.AndN(block[7], 0xFF)));

      let k = 0;

      // Two major rounds
      for (let t = 0; t < 2; t++) {
        // First type of round (Rule A - 8 rounds)
        for (let i = 0; i < 8; i++) {
          const tmp = w4;
          w4 = w3;
          w3 = w2;
          w2 = this._G(k, w1);
          w1 = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(w2, tmp), (k + 1)));
          k++;
        }

        // Second type of round (Rule B - 8 rounds)
        for (let i = 0; i < 8; i++) {
          const tmp = w4;
          w4 = w3;
          w3 = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(w1, w2), (k + 1)));
          w2 = this._G(k, w1);
          w1 = tmp;
          k++;
        }
      }

      // Pack back to bytes
      const cipherBytes = [
        OpCodes.AndN(OpCodes.Shr32(w1, 8), 0xFF), OpCodes.AndN(w1, 0xFF),
        OpCodes.AndN(OpCodes.Shr32(w2, 8), 0xFF), OpCodes.AndN(w2, 0xFF),
        OpCodes.AndN(OpCodes.Shr32(w3, 8), 0xFF), OpCodes.AndN(w3, 0xFF),
        OpCodes.AndN(OpCodes.Shr32(w4, 8), 0xFF), OpCodes.AndN(w4, 0xFF)
      ];

      return cipherBytes;
    }

    /**
     * Decrypt 64-bit block (following BouncyCastle implementation)
     */
    _decryptBlock(block) {
      if (block.length !== 8) {
        throw new Error('Skipjack block size must be exactly 8 bytes');
      }

      if (!this.key0) {
        throw new Error('Key not properly initialized');
      }

      // Convert ciphertext to 4 16-bit words (big-endian)
      // Note: BouncyCastle uses different order for decryption input
      let w2 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(block[0], 8), OpCodes.AndN(block[1], 0xFF)));
      let w1 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(block[2], 8), OpCodes.AndN(block[3], 0xFF)));
      let w4 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(block[4], 8), OpCodes.AndN(block[5], 0xFF)));
      let w3 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(block[6], 8), OpCodes.AndN(block[7], 0xFF)));

      let k = 31;

      // Two major rounds (in reverse)
      for (let t = 0; t < 2; t++) {
        // First type of round (reverse of Rule B - 8 rounds)
        for (let i = 0; i < 8; i++) {
          const tmp = w4;
          w4 = w3;
          w3 = w2;
          w2 = this._H(k, w1);
          w1 = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(w2, tmp), (k + 1)));
          k--;
        }

        // Second type of round (reverse of Rule A - 8 rounds)
        for (let i = 0; i < 8; i++) {
          const tmp = w4;
          w4 = w3;
          w3 = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(w1, w2), (k + 1)));
          w2 = this._H(k, w1);
          w1 = tmp;
          k--;
        }
      }

      // Pack back to bytes (different order for decryption output)
      const plainBytes = [
        OpCodes.AndN(OpCodes.Shr32(w2, 8), 0xFF), OpCodes.AndN(w2, 0xFF),
        OpCodes.AndN(OpCodes.Shr32(w1, 8), 0xFF), OpCodes.AndN(w1, 0xFF),
        OpCodes.AndN(OpCodes.Shr32(w4, 8), 0xFF), OpCodes.AndN(w4, 0xFF),
        OpCodes.AndN(OpCodes.Shr32(w3, 8), 0xFF), OpCodes.AndN(w3, 0xFF)
      ];

      return plainBytes;
    }
  }

  // ===== REGISTRATION =====

    const algorithmInstance = new SkipjackAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SkipjackAlgorithm, SkipjackInstance };
}));