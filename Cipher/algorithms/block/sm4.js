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
   * @returns {Sm4Instance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Sm4Instance(this, isInverse);
    }
  }

  // SM4 constants and S-box
  // SM4 S-box (from GB/T 32907-2016)
  const SM4_SBOX = OpCodes.Hex8ToBytes(
    "d690e9fecce13db716b614c228fb2c052b679a762abe04c3aa44132649860699" +
    "9c4250f491ef987a33540b43edcfac62e4b31ca9c908e89580df94fa758f3fa6" +
    "4707a7fcf37317ba83593c19e6854fa8686b81b27164da8bf8eb0f4b70569d35" +
    "1e240e5e6358d1a225227c3b01217887d40046579fd327524c3602e7a0c4c89e" +
    "eabf8ad240c738b5a3f7f2cef96115a1e0ae5da49b341a55ad933230f58cb1e3" +
    "1df6e22e8266ca60c02923ab0d534e6fd5db3745defd8e2f03ff6a726d6c5b51" +
    "8d1baf92bbddbc7f11d95c411f105ad80ac13188a5cd7bbd2d74d012b8e5b4b0" +
    "8969974a0c96777e65b9f109c56ec68418f07dec3adc4d2079ee5f3ed7cb3948"
  );

  // System constants for key expansion (fixed constants FK)
  /** @type {uint32[]} */
  const SM4_FK = [0xa3b1bac6, 0x56aa3350, 0x677d9197, 0xb27022dc];

  // Round constants for key expansion (constant CK)
  /** @type {uint32[]} */
  const SM4_CK = [
    0x00070e15, 0x1c232a31, 0x383f464d, 0x545b6269,
    0x70777e85, 0x8c939aa1, 0xa8afb6bd, 0xc4cbd2d9,
    0xe0e7eef5, 0xfc030a11, 0x181f262d, 0x343b4249,
    0x50575e65, 0x6c737a81, 0x888f969d, 0xa4abb2b9,
    0xc0c7ced5, 0xdce3eaf1, 0xf8ff060d, 0x141b2229,
    0x30373e45, 0x4c535a61, 0x686f767d, 0x848b9299,
    0xa0a7aeb5, 0xbcc3cad1, 0xd8dfe6ed, 0xf4fb0209,
    0x10171e25, 0x2c333a41, 0x484f565d, 0x646b7279
  ];

  class Sm4Constants {
    static BLOCK_SIZE = 16;
    static KEY_SIZE = 16;
    static ROUNDS = 32;
  }

  /**
 * Sm4 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Sm4Instance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Sm4Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.roundKeys = null;
      /** @type {uint8[]} */
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
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. SM4 requires 128-bit (16 byte) keys.");
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
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
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
      /** @type {uint8[]} */
      const output = [];
      const blockSize = this.BlockSize;

      // Validate input length for block cipher
      if (this.inputBuffer.length % blockSize !== 0) {
        throw new Error("Input length must be multiple of " + blockSize + " bytes");
      }

      // Process each block
      for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
        const block = this.inputBuffer.slice(i, i + blockSize);
        const processedBlock = this.isInverse 
          ? this._decryptBlock(block) 
          : this._encryptBlock(block);
        for (let _i = 0; _i < processedBlock.length; _i++) output.push(processedBlock[_i]);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    // Generate SM4 key schedule (following Bouncy Castle C# reference exactly)
    /**
     * @param {uint8[]} masterKey - 16-byte key
     * @returns {uint32[]} 32 round-key words
     */
    _generateKeySchedule(masterKey) {
      /** @type {uint32[]} */
      const rk = new Array(32);

      // Convert master key to 32-bit words (big-endian)
      const K0 = OpCodes.Xor32(OpCodes.Pack32BE(masterKey[0], masterKey[1], masterKey[2], masterKey[3]), SM4_FK[0]);
      const K1 = OpCodes.Xor32(OpCodes.Pack32BE(masterKey[4], masterKey[5], masterKey[6], masterKey[7]), SM4_FK[1]);
      const K2 = OpCodes.Xor32(OpCodes.Pack32BE(masterKey[8], masterKey[9], masterKey[10], masterKey[11]), SM4_FK[2]);
      const K3 = OpCodes.Xor32(OpCodes.Pack32BE(masterKey[12], masterKey[13], masterKey[14], masterKey[15]), SM4_FK[3]);

      // Generate round keys following C# reference pattern
      rk[0] = OpCodes.Xor32(K0, this._tPrime(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(K1, K2), K3), SM4_CK[0])));
      rk[1] = OpCodes.Xor32(K1, this._tPrime(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(K2, K3), rk[0]), SM4_CK[1])));
      rk[2] = OpCodes.Xor32(K2, this._tPrime(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(K3, rk[0]), rk[1]), SM4_CK[2])));
      rk[3] = OpCodes.Xor32(K3, this._tPrime(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(rk[0], rk[1]), rk[2]), SM4_CK[3])));

      for (let i = 4; i < 32; i++) {
        rk[i] = OpCodes.Xor32(rk[i - 4], this._tPrime(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(rk[i - 3], rk[i - 2]), rk[i - 1]), SM4_CK[i])));
      }

      return rk;
    }

    // SM4 S-box transformation (τ function)
    /**
     * @param {uint32} input - Word
     * @returns {uint32} S-box applied to each byte
     */
    _tau(input) {
      const bytes = OpCodes.Unpack32BE(input);
      /** @type {uint8[]} */
      const output = [];

      for (let i = 0; i < 4; i++) {
        output[i] = SM4_SBOX[bytes[i]];
      }

      return OpCodes.Pack32BE(output[0], output[1], output[2], output[3]);
    }

    // SM4 linear transformation L for encryption (L function)
    /**
     * @param {uint32} input - Word
     * @returns {uint32} L(input)
     */
    _L(input) {
      return OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(input, OpCodes.RotL32(input, 2)), OpCodes.RotL32(input, 10)), OpCodes.RotL32(input, 18)), OpCodes.RotL32(input, 24));
    }

    // SM4 linear transformation L' for key expansion (L' function)
    /**
     * @param {uint32} input - Word
     * @returns {uint32} L'(input)
     */
    _LPrime(input) {
      return OpCodes.Xor32(OpCodes.Xor32(input, OpCodes.RotL32(input, 13)), OpCodes.RotL32(input, 23));
    }

    // SM4 combined transformation T for encryption
    /**
     * @param {uint32} input - Word
     * @returns {uint32} T(input)
     */
    _T(input) {
      return this._L(this._tau(input));
    }

    // SM4 combined transformation T' for key expansion
    /**
     * @param {uint32} input - Word
     * @returns {uint32} T'(input)
     */
    _tPrime(input) {
      return this._LPrime(this._tau(input));
    }

    // Encrypt 128-bit block (following Bouncy Castle C# reference exactly)
    /**
     * @param {uint8[]} plaintext - Input block
     * @returns {uint8[]} Output block
     */
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
        X0 = OpCodes.Xor32(X0, this._T(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(X1, X2), X3), this.roundKeys[i    ])));  // F0
        X1 = OpCodes.Xor32(X1, this._T(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(X2, X3), X0), this.roundKeys[i + 1])));  // F1
        X2 = OpCodes.Xor32(X2, this._T(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(X3, X0), X1), this.roundKeys[i + 2])));  // F2
        X3 = OpCodes.Xor32(X3, this._T(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(X0, X1), X2), this.roundKeys[i + 3])));  // F3
      }

      // Output transformation - reverse order (X3, X2, X1, X0)
      /** @type {uint8[]} */
      const result = [];
      result.push(...OpCodes.Unpack32BE(X3));
      result.push(...OpCodes.Unpack32BE(X2));
      result.push(...OpCodes.Unpack32BE(X1));
      result.push(...OpCodes.Unpack32BE(X0));

      return result;
    }

    // Decrypt 128-bit block (SM4 is symmetric - use encryption with reversed key schedule)
    /**
     * @param {uint8[]} ciphertext - Input block
     * @returns {uint8[]} Output block
     */
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
        X3 = OpCodes.Xor32(X3, this._T(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(X0, X1), X2), this.roundKeys[i + 3])));  // F3
        X2 = OpCodes.Xor32(X2, this._T(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(X3, X0), X1), this.roundKeys[i + 2])));  // F2
        X1 = OpCodes.Xor32(X1, this._T(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(X2, X3), X0), this.roundKeys[i + 1])));  // F1
        X0 = OpCodes.Xor32(X0, this._T(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(X1, X2), X3), this.roundKeys[i    ])));  // F0
      }

      // Convert back to bytes (normal order)
      /** @type {uint8[]} */
      const result = [];
      result.push(...OpCodes.Unpack32BE(X0));
      result.push(...OpCodes.Unpack32BE(X1));
      result.push(...OpCodes.Unpack32BE(X2));
      result.push(...OpCodes.Unpack32BE(X3));

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