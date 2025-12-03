/*
 * SM4 Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * Based on GB/T 32907-2016 - SM4 Block Cipher Algorithm
 * (c)2006-2025 Hawkynt
 * 
 * SM4 is the Chinese national standard block cipher also known as SMS4.
 * Features 128-bit blocks and keys with 32-round substitution-permutation network.
 * Developed by Lu Shuiwang et al. and standardized in China in 2016.
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
 * Sm4Algorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class Sm4Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SM4";
      this.description = "Chinese national standard block cipher (GB/T 32907-2016, also known as SMS4). Features 128-bit blocks and keys with 32-round substitution-permutation network for high security.";
      this.inventor = "Lu Shuiwang, et al.";
      this.year = 2006;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.CN;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0) // Fixed 128-bit keys
      ];
      this.SupportedBlockSizes = [
        new KeySize(16, 16, 0) // Fixed 128-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("GB/T 32907-2016 - SM4 Block Cipher Algorithm", "https://tools.ietf.org/rfc/rfc8018.txt"),
        new LinkItem("IETF RFC 8018 - SMS4 Encryption Algorithm", "https://tools.ietf.org/rfc/rfc8018.txt"),
        new LinkItem("Wikipedia - SM4 cipher", "https://en.wikipedia.org/wiki/SM4_(cipher)")
      ];

      this.references = [
        new LinkItem("Original SM4 Specification", "http://www.oscca.gov.cn/sca/xxgk/2016-08/17/content_1002386.shtml"),
        new LinkItem("OpenSSL SM4 Implementation", "https://github.com/openssl/openssl/tree/master/crypto/sm4"),
        new LinkItem("GmSSL Implementation", "https://github.com/guanzhi/GmSSL")
      ];

      // Test vectors from official specifications
      this.tests = [
        {
          text: "SM4 Official Test Vector - GB/T 32907-2016",
          uri: "GB/T 32907-2016",
          input: OpCodes.Hex8ToBytes("0123456789abcdeffedcba9876543210"),
          key: OpCodes.Hex8ToBytes("0123456789abcdeffedcba9876543210"),
          expected: OpCodes.Hex8ToBytes("681edf34d206965e86b3e94f536e4246")
        },
        {
          text: "SM4 Zero Key Test",
          uri: "Round-trip test",
          input: OpCodes.Hex8ToBytes("0123456789abcdeffedcba9876543210"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("29c8bccac865d43db25596e2b59be9af")
        },
        {
          text: "SM4 Pattern Test", 
          uri: "Round-trip test",
          input: OpCodes.Hex8ToBytes("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
          key: OpCodes.Hex8ToBytes("55555555555555555555555555555555"),
          expected: OpCodes.Hex8ToBytes("039846fc490d67c56ed9c036842de4bb")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Sm4Instance(this, isInverse);
    }
  }

  // SM4 constants and S-box
  class Sm4Constants {
    static BLOCK_SIZE = 16;
    static KEY_SIZE = 16;
    static ROUNDS = 32;

    // SM4 S-box (from GB/T 32907-2016)
    static SBOX = [
      0xd6, 0x90, 0xe9, 0xfe, 0xcc, 0xe1, 0x3d, 0xb7, 0x16, 0xb6, 0x14, 0xc2, 0x28, 0xfb, 0x2c, 0x05,
      0x2b, 0x67, 0x9a, 0x76, 0x2a, 0xbe, 0x04, 0xc3, 0xaa, 0x44, 0x13, 0x26, 0x49, 0x86, 0x06, 0x99,
      0x9c, 0x42, 0x50, 0xf4, 0x91, 0xef, 0x98, 0x7a, 0x33, 0x54, 0x0b, 0x43, 0xed, 0xcf, 0xac, 0x62,
      0xe4, 0xb3, 0x1c, 0xa9, 0xc9, 0x08, 0xe8, 0x95, 0x80, 0xdf, 0x94, 0xfa, 0x75, 0x8f, 0x3f, 0xa6,
      0x47, 0x07, 0xa7, 0xfc, 0xf3, 0x73, 0x17, 0xba, 0x83, 0x59, 0x3c, 0x19, 0xe6, 0x85, 0x4f, 0xa8,
      0x68, 0x6b, 0x81, 0xb2, 0x71, 0x64, 0xda, 0x8b, 0xf8, 0xeb, 0x0f, 0x4b, 0x70, 0x56, 0x9d, 0x35,
      0x1e, 0x24, 0x0e, 0x5e, 0x63, 0x58, 0xd1, 0xa2, 0x25, 0x22, 0x7c, 0x3b, 0x01, 0x21, 0x78, 0x87,
      0xd4, 0x00, 0x46, 0x57, 0x9f, 0xd3, 0x27, 0x52, 0x4c, 0x36, 0x02, 0xe7, 0xa0, 0xc4, 0xc8, 0x9e,
      0xea, 0xbf, 0x8a, 0xd2, 0x40, 0xc7, 0x38, 0xb5, 0xa3, 0xf7, 0xf2, 0xce, 0xf9, 0x61, 0x15, 0xa1,
      0xe0, 0xae, 0x5d, 0xa4, 0x9b, 0x34, 0x1a, 0x55, 0xad, 0x93, 0x32, 0x30, 0xf5, 0x8c, 0xb1, 0xe3,
      0x1d, 0xf6, 0xe2, 0x2e, 0x82, 0x66, 0xca, 0x60, 0xc0, 0x29, 0x23, 0xab, 0x0d, 0x53, 0x4e, 0x6f,
      0xd5, 0xdb, 0x37, 0x45, 0xde, 0xfd, 0x8e, 0x2f, 0x03, 0xff, 0x6a, 0x72, 0x6d, 0x6c, 0x5b, 0x51,
      0x8d, 0x1b, 0xaf, 0x92, 0xbb, 0xdd, 0xbc, 0x7f, 0x11, 0xd9, 0x5c, 0x41, 0x1f, 0x10, 0x5a, 0xd8,
      0x0a, 0xc1, 0x31, 0x88, 0xa5, 0xcd, 0x7b, 0xbd, 0x2d, 0x74, 0xd0, 0x12, 0xb8, 0xe5, 0xb4, 0xb0,
      0x89, 0x69, 0x97, 0x4a, 0x0c, 0x96, 0x77, 0x7e, 0x65, 0xb9, 0xf1, 0x09, 0xc5, 0x6e, 0xc6, 0x84,
      0x18, 0xf0, 0x7d, 0xec, 0x3a, 0xdc, 0x4d, 0x20, 0x79, 0xee, 0x5f, 0x3e, 0xd7, 0xcb, 0x39, 0x48
    ];

    // System constants for key expansion (fixed constants FK)
    static FK = [0xa3b1bac6, 0x56aa3350, 0x677d9197, 0xb27022dc];

    // Round constants for key expansion (constant CK)
    static CK = [
      0x00070e15, 0x1c232a31, 0x383f464d, 0x545b6269,
      0x70777e85, 0x8c939aa1, 0xa8afb6bd, 0xc4cbd2d9,
      0xe0e7eef5, 0xfc030a11, 0x181f262d, 0x343b4249,
      0x50575e65, 0x6c737a81, 0x888f969d, 0xa4abb2b9,
      0xc0c7ced5, 0xdce3eaf1, 0xf8ff060d, 0x141b2229,
      0x30373e45, 0x4c535a61, 0x686f767d, 0x848b9299,
      0xa0a7aeb5, 0xbcc3cad1, 0xd8dfe6ed, 0xf4fb0209,
      0x10171e25, 0x2c333a41, 0x484f565d, 0x646b7279
    ];
  }

  /**
 * Sm4 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Sm4Instance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.roundKeys = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    // Property setter for key - validates and sets up key schedule
    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.roundKeys = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size (SM4 only supports 128-bit keys)
      if (keyBytes.length !== 16) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. SM4 requires 128-bit (16 byte) keys.`);
      }

      this._key = [...keyBytes]; // Copy the key
      this.KeySize = keyBytes.length;
      this.roundKeys = this._generateKeySchedule(keyBytes);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null; // Return copy
    }

    // Feed data to the cipher (accumulates until we have complete blocks)
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      // Add data to input buffer
      this.inputBuffer.push(...data);
    }

    // Get the result of the transformation
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Process complete blocks
      const output = [];
      const blockSize = this.BlockSize;

      // Validate input length for block cipher
      if (this.inputBuffer.length % blockSize !== 0) {
        throw new Error(`Input length must be multiple of ${blockSize} bytes`);
      }

      // Process each block
      for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
        const block = this.inputBuffer.slice(i, i + blockSize);
        const processedBlock = this.isInverse 
          ? this._decryptBlock(block) 
          : this._encryptBlock(block);
        output.push(...processedBlock);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    // Generate SM4 key schedule (following Bouncy Castle C# reference exactly)
    _generateKeySchedule(masterKey) {
      const rk = new Array(32);

      // Convert master key to 32-bit words (big-endian)
      const K0 = OpCodes.XorN(OpCodes.Pack32BE(masterKey[0], masterKey[1], masterKey[2], masterKey[3]), Sm4Constants.FK[0]);
      const K1 = OpCodes.XorN(OpCodes.Pack32BE(masterKey[4], masterKey[5], masterKey[6], masterKey[7]), Sm4Constants.FK[1]);
      const K2 = OpCodes.XorN(OpCodes.Pack32BE(masterKey[8], masterKey[9], masterKey[10], masterKey[11]), Sm4Constants.FK[2]);
      const K3 = OpCodes.XorN(OpCodes.Pack32BE(masterKey[12], masterKey[13], masterKey[14], masterKey[15]), Sm4Constants.FK[3]);

      // Generate round keys following C# reference pattern
      rk[0] = OpCodes.XorN(K0, this._tPrime(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(K1, K2), K3), Sm4Constants.CK[0])));
      rk[1] = OpCodes.XorN(K1, this._tPrime(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(K2, K3), rk[0]), Sm4Constants.CK[1])));
      rk[2] = OpCodes.XorN(K2, this._tPrime(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(K3, rk[0]), rk[1]), Sm4Constants.CK[2])));
      rk[3] = OpCodes.XorN(K3, this._tPrime(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(rk[0], rk[1]), rk[2]), Sm4Constants.CK[3])));

      for (let i = 4; i < 32; i++) {
        rk[i] = OpCodes.XorN(rk[i - 4], this._tPrime(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(rk[i - 3], rk[i - 2]), rk[i - 1]), Sm4Constants.CK[i])));
      }

      return rk;
    }

    // SM4 S-box transformation (τ function)
    _tau(input) {
      const bytes = OpCodes.Unpack32BE(input);
      const output = [];

      for (let i = 0; i < 4; i++) {
        output[i] = Sm4Constants.SBOX[bytes[i]];
      }

      return OpCodes.Pack32BE(output[0], output[1], output[2], output[3]);
    }

    // SM4 linear transformation L for encryption (L function)
    _L(input) {
      return OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(input, OpCodes.RotL32(input, 2)), OpCodes.RotL32(input, 10)), OpCodes.RotL32(input, 18)), OpCodes.RotL32(input, 24));
    }

    // SM4 linear transformation L' for key expansion (L' function)
    _LPrime(input) {
      return OpCodes.XorN(OpCodes.XorN(input, OpCodes.RotL32(input, 13)), OpCodes.RotL32(input, 23));
    }

    // SM4 combined transformation T for encryption
    _T(input) {
      return this._L(this._tau(input));
    }

    // SM4 combined transformation T' for key expansion
    _tPrime(input) {
      return this._LPrime(this._tau(input));
    }

    // Encrypt 128-bit block (following Bouncy Castle C# reference exactly)
    _encryptBlock(plaintext) {
      if (plaintext.length !== 16) {
        throw new Error('Input must be exactly 16 bytes');
      }

      // Convert to 32-bit words (big-endian)
      let X0 = OpCodes.Pack32BE(plaintext[0], plaintext[1], plaintext[2], plaintext[3]);
      let X1 = OpCodes.Pack32BE(plaintext[4], plaintext[5], plaintext[6], plaintext[7]);
      let X2 = OpCodes.Pack32BE(plaintext[8], plaintext[9], plaintext[10], plaintext[11]);
      let X3 = OpCodes.Pack32BE(plaintext[12], plaintext[13], plaintext[14], plaintext[15]);

      // 32 rounds of SM4 transformation using C# unrolled loop pattern
      for (let i = 0; i < 32; i += 4) {
        X0 = OpCodes.XorN(X0, this._T(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(X1, X2), X3), this.roundKeys[i    ])));  // F0
        X1 = OpCodes.XorN(X1, this._T(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(X2, X3), X0), this.roundKeys[i + 1])));  // F1
        X2 = OpCodes.XorN(X2, this._T(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(X3, X0), X1), this.roundKeys[i + 2])));  // F2
        X3 = OpCodes.XorN(X3, this._T(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(X0, X1), X2), this.roundKeys[i + 3])));  // F3
      }

      // Output transformation - reverse order (X3, X2, X1, X0)
      const result = [];
      OpCodes.Unpack32BE(X3).forEach(b => result.push(b));
      OpCodes.Unpack32BE(X2).forEach(b => result.push(b));
      OpCodes.Unpack32BE(X1).forEach(b => result.push(b));
      OpCodes.Unpack32BE(X0).forEach(b => result.push(b));

      return result;
    }

    // Decrypt 128-bit block (SM4 is symmetric - use encryption with reversed key schedule)
    _decryptBlock(ciphertext) {
      if (ciphertext.length !== 16) {
        throw new Error('Input must be exactly 16 bytes');
      }

      // Convert to 32-bit words (big-endian)
      let X0 = OpCodes.Pack32BE(ciphertext[0], ciphertext[1], ciphertext[2], ciphertext[3]);
      let X1 = OpCodes.Pack32BE(ciphertext[4], ciphertext[5], ciphertext[6], ciphertext[7]);
      let X2 = OpCodes.Pack32BE(ciphertext[8], ciphertext[9], ciphertext[10], ciphertext[11]);
      let X3 = OpCodes.Pack32BE(ciphertext[12], ciphertext[13], ciphertext[14], ciphertext[15]);

      // Apply reverse final transformation first (undo the byte reordering from encryption)
      [X0, X1, X2, X3] = [X3, X2, X1, X0];

      // 32 rounds of SM4 transformation using reversed round keys (C# unrolled loop pattern)
      for (let i = 28; i >= 0; i -= 4) {
        X3 = OpCodes.XorN(X3, this._T(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(X0, X1), X2), this.roundKeys[i + 3])));  // F3
        X2 = OpCodes.XorN(X2, this._T(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(X3, X0), X1), this.roundKeys[i + 2])));  // F2
        X1 = OpCodes.XorN(X1, this._T(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(X2, X3), X0), this.roundKeys[i + 1])));  // F1
        X0 = OpCodes.XorN(X0, this._T(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(X1, X2), X3), this.roundKeys[i    ])));  // F0
      }

      // Convert back to bytes (normal order)
      const result = [];
      OpCodes.Unpack32BE(X0).forEach(b => result.push(b));
      OpCodes.Unpack32BE(X1).forEach(b => result.push(b));
      OpCodes.Unpack32BE(X2).forEach(b => result.push(b));
      OpCodes.Unpack32BE(X3).forEach(b => result.push(b));

      return result;
    }
  }

  // Register the algorithm immediately

  // ===== REGISTRATION =====

    const algorithmInstance = new Sm4Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Sm4Algorithm, SM4Algorithm: Sm4Algorithm, Sm4Instance };
}));