/*
 * LEA (Lightweight Encryption Algorithm) Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * LEA - Korean national standard (KS X 3246)
 * 128-bit blocks with 128/192/256-bit keys, ARX structure
 * High-speed software implementation optimized cipher
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
 * LEAAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class LEAAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LEA";
      this.description = "Lightweight Encryption Algorithm, Korean national standard (KS X 3246). ARX-based block cipher with 128-bit blocks, optimized for high-speed software implementation.";
      this.inventor = "Deukjo Hong, Jung-Keun Lee, Dong-Chan Kim, Daesung Kwon, Kwon Ho Ryu, Dong-Geon Lee";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = null; // Korean standard, no known breaks
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.KR;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 32, 8) // 128, 192, 256-bit keys (16, 24, 32 bytes)
      ];
      this.SupportedBlockSizes = [
        new KeySize(16, 16, 0) // Fixed 128-bit (16-byte) blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("LEA Specification", "https://seed.kisa.or.kr/kisa/algorithm/EgovLeaInfo.do"),
        new LinkItem("ISO/IEC 29192-2:2019", "https://www.iso.org/standard/56552.html"),
        new LinkItem("LEA Design Paper", "https://eprint.iacr.org/2013/794.pdf")
      ];

      this.references = [
        new LinkItem("KISA Reference Implementation", "https://seed.kisa.or.kr/kisa/algorithm/EgovLeaInfo.do"),
        new LinkItem("LEA GitHub Repository", "https://github.com/hkscy/LEA")
      ];

      // Test vectors from Korean standard
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"), // input
          OpCodes.Hex8ToBytes("9fc84e3528c6c6185532c7a704648bfd"), // expected (CORRECTED)
          "LEA-128 Test Vector - KS X 3246",
          "https://seed.kisa.or.kr/kisa/algorithm/EgovLeaInfo.do"
        )
      ];
      // Additional property for key in test vector
      this.tests[0].key = OpCodes.Hex8ToBytes("0f1e2d3c4b5a69788796a5b4c3d2e1f0");

      // LEA Constants - Key schedule constants δ[i]
      // These are the 8 base delta values from Crypto++ reference implementation
      // Each delta[i] contains 36 rotations for key schedule
      this.DELTA = [
        [0xc3efe9db, 0x87dfd3b7, 0x0fbfa76f, 0x1f7f4ede, 0x3efe9dbc, 0x7dfd3b78, 0xfbfa76f0, 0xf7f4ede1,
         0xefe9dbc3, 0xdfd3b787, 0xbfa76f0f, 0x7f4ede1f, 0xfe9dbc3e, 0xfd3b787d, 0xfa76f0fb, 0xf4ede1f7,
         0xe9dbc3ef, 0xd3b787df, 0xa76f0fbf, 0x4ede1f7f, 0x9dbc3efe, 0x3b787dfd, 0x76f0fbfa, 0xede1f7f4,
         0xdbc3efe9, 0xb787dfd3, 0x6f0fbfa7, 0xde1f7f4e, 0xbc3efe9d, 0x787dfd3b, 0xf0fbfa76, 0xe1f7f4ed,
         0xc3efe9db, 0x87dfd3b7, 0x0fbfa76f, 0x1f7f4ede],
        [0x44626b02, 0x88c4d604, 0x1189ac09, 0x23135812, 0x4626b024, 0x8c4d6048, 0x189ac091, 0x31358122,
         0x626b0244, 0xc4d60488, 0x89ac0911, 0x13581223, 0x26b02446, 0x4d60488c, 0x9ac09118, 0x35812231,
         0x6b024462, 0xd60488c4, 0xac091189, 0x58122313, 0xb0244626, 0x60488c4d, 0xc091189a, 0x81223135,
         0x0244626b, 0x0488c4d6, 0x091189ac, 0x12231358, 0x244626b0, 0x488c4d60, 0x91189ac0, 0x22313581,
         0x44626b02, 0x88c4d604, 0x1189ac09, 0x23135812],
        [0x79e27c8a, 0xf3c4f914, 0xe789f229, 0xcf13e453, 0x9e27c8a7, 0x3c4f914f, 0x789f229e, 0xf13e453c,
         0xe27c8a79, 0xc4f914f3, 0x89f229e7, 0x13e453cf, 0x27c8a79e, 0x4f914f3c, 0x9f229e78, 0x3e453cf1,
         0x7c8a79e2, 0xf914f3c4, 0xf229e789, 0xe453cf13, 0xc8a79e27, 0x914f3c4f, 0x229e789f, 0x453cf13e,
         0x8a79e27c, 0x14f3c4f9, 0x29e789f2, 0x53cf13e4, 0xa79e27c8, 0x4f3c4f91, 0x9e789f22, 0x3cf13e45,
         0x79e27c8a, 0xf3c4f914, 0xe789f229, 0xcf13e453],
        [0x78df30ec, 0xf1be61d8, 0xe37cc3b1, 0xc6f98763, 0x8df30ec7, 0x1be61d8f, 0x37cc3b1e, 0x6f98763c,
         0xdf30ec78, 0xbe61d8f1, 0x7cc3b1e3, 0xf98763c6, 0xf30ec78d, 0xe61d8f1b, 0xcc3b1e37, 0x98763c6f,
         0x30ec78df, 0x61d8f1be, 0xc3b1e37c, 0x8763c6f9, 0x0ec78df3, 0x1d8f1be6, 0x3b1e37cc, 0x763c6f98,
         0xec78df30, 0xd8f1be61, 0xb1e37cc3, 0x63c6f987, 0xc78df30e, 0x8f1be61d, 0x1e37cc3b, 0x3c6f9876,
         0x78df30ec, 0xf1be61d8, 0xe37cc3b1, 0xc6f98763],
        [0x715ea49e, 0xe2bd493c, 0xc57a9279, 0x8af524f3, 0x15ea49e7, 0x2bd493ce, 0x57a9279c, 0xaf524f38,
         0x5ea49e71, 0xbd493ce2, 0x7a9279c5, 0xf524f38a, 0xea49e715, 0xd493ce2b, 0xa9279c57, 0x524f38af,
         0xa49e715e, 0x493ce2bd, 0x9279c57a, 0x24f38af5, 0x49e715ea, 0x93ce2bd4, 0x279c57a9, 0x4f38af52,
         0x9e715ea4, 0x3ce2bd49, 0x79c57a92, 0xf38af524, 0xe715ea49, 0xce2bd493, 0x9c57a927, 0x38af524f,
         0x715ea49e, 0xe2bd493c, 0xc57a9279, 0x8af524f3],
        [0xc785da0a, 0x8f0bb415, 0x1e17682b, 0x3c2ed056, 0x785da0ac, 0xf0bb4158, 0xe17682b1, 0xc2ed0563,
         0x85da0ac7, 0x0bb4158f, 0x17682b1e, 0x2ed0563c, 0x5da0ac78, 0xbb4158f0, 0x7682b1e1, 0xed0563c2,
         0xda0ac785, 0xb4158f0b, 0x682b1e17, 0xd0563c2e, 0xa0ac785d, 0x4158f0bb, 0x82b1e176, 0x0563c2ed,
         0x0ac785da, 0x158f0bb4, 0x2b1e1768, 0x563c2ed0, 0xac785da0, 0x58f0bb41, 0xb1e17682, 0x63c2ed05,
         0xc785da0a, 0x8f0bb415, 0x1e17682b, 0x3c2ed056],
        [0xe04ef22a, 0xc09de455, 0x813bc8ab, 0x02779157, 0x04ef22ae, 0x09de455c, 0x13bc8ab8, 0x27791570,
         0x4ef22ae0, 0x9de455c0, 0x3bc8ab81, 0x77915702, 0xef22ae04, 0xde455c09, 0xbc8ab813, 0x79157027,
         0xf22ae04e, 0xe455c09d, 0xc8ab813b, 0x91570277, 0x22ae04ef, 0x455c09de, 0x8ab813bc, 0x15702779,
         0x2ae04ef2, 0x55c09de4, 0xab813bc8, 0x57027791, 0xae04ef22, 0x5c09de45, 0xb813bc8a, 0x70277915,
         0xe04ef22a, 0xc09de455, 0x813bc8ab, 0x02779157],
        [0xe5c40957, 0xcb8812af, 0x9710255f, 0x2e204abf, 0x5c40957e, 0xb8812afc, 0x710255f9, 0xe204abf2,
         0xc40957e5, 0x8812afcb, 0x10255f97, 0x204abf2e, 0x40957e5c, 0x812afcb8, 0x0255f971, 0x04abf2e2,
         0x0957e5c4, 0x12afcb88, 0x255f9710, 0x4abf2e20, 0x957e5c40, 0x2afcb881, 0x55f97102, 0xabf2e204,
         0x57e5c409, 0xafcb8812, 0x5f971025, 0xbf2e204a, 0x7e5c4095, 0xfcb8812a, 0xf9710255, 0xf2e204ab,
         0xe5c40957, 0xcb8812af, 0x9710255f, 0x2e204abf]
      ];
    }

    // Required: Create instance for this algorithm
    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LEAInstance(this, isInverse);
    }
  }

  // Instance class - handles the actual encryption/decryption
  /**
 * LEA cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LEAInstance extends IBlockCipherInstance {
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
      this.rounds = 0;
      this.inputBuffer = [];
      this.BlockSize = 16; // 128-bit blocks
      this.KeySize = 0;    // will be set when key is assigned
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
        this.rounds = 0;
        this.KeySize = 0;
        return;
      }

      // Validate key size
      const validSizes = [16, 24, 32];
      if (!validSizes.includes(keyBytes.length)) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (must be 16, 24, or 32 bytes)`);
      }

      this._key = [...keyBytes]; // Copy the key
      this.KeySize = keyBytes.length;

      // Determine number of rounds based on key length
      if (this.KeySize === 16) {
        this.rounds = 24;
      } else if (this.KeySize === 24) {
        this.rounds = 28;
      } else if (this.KeySize === 32) {
        this.rounds = 32;
      }

      // Generate round keys
      this._generateRoundKeys();
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

    // Generate round keys based on key length - following Crypto++ reference exactly
    _generateRoundKeys() {
      this.roundKeys = [];
      const keyWords = this.KeySize / 4;

      // Convert key bytes to 32-bit words (little-endian for LEA)
      const key = [];
      for (let i = 0; i < keyWords; i++) {
        const offset = i * 4;
        key[i] = OpCodes.Pack32LE(
          this._key[offset],
          this._key[offset + 1],
          this._key[offset + 2],
          this._key[offset + 3]
        );
      }

      // Create flat round key array (6 words per round)
      const rkey = new Array(this.rounds * 6);

      if (keyWords === 4) { // 128-bit key - LEA-128
        // Following Crypto++ SetKey128 exactly
        const delta = this.algorithm.DELTA;

        // Generate rkey[0], rkey[6], rkey[12], ... (indices 0, 6, 12, 18, ...)
        rkey[0] = OpCodes.RotL32((key[0] + delta[0][0]) >>> 0, 1);
        for (let i = 1; i < 24; i++) {
          rkey[i * 6] = OpCodes.RotL32((rkey[(i - 1) * 6] + delta[i % 4][i]) >>> 0, 1);
        }

        // Generate rkey[1], rkey[3], rkey[5], rkey[7], ... (tripled values)
        rkey[1] = rkey[3] = rkey[5] = OpCodes.RotL32((key[1] + delta[0][1]) >>> 0, 3);
        for (let i = 1; i < 24; i++) {
          rkey[i * 6 + 1] = rkey[i * 6 + 3] = rkey[i * 6 + 5] = OpCodes.RotL32((rkey[(i - 1) * 6 + 1] + delta[i % 4][i + 1]) >>> 0, 3);
        }

        // Generate rkey[2], rkey[8], rkey[14], ... (indices 2, 8, 14, 20, ...)
        rkey[2] = OpCodes.RotL32((key[2] + delta[0][2]) >>> 0, 6);
        for (let i = 1; i < 24; i++) {
          rkey[i * 6 + 2] = OpCodes.RotL32((rkey[(i - 1) * 6 + 2] + delta[i % 4][i + 2]) >>> 0, 6);
        }

        // Generate rkey[4], rkey[10], rkey[16], ... (indices 4, 10, 16, 22, ...)
        rkey[4] = OpCodes.RotL32((key[3] + delta[0][3]) >>> 0, 11);
        for (let i = 1; i < 24; i++) {
          rkey[i * 6 + 4] = OpCodes.RotL32((rkey[(i - 1) * 6 + 4] + delta[i % 4][i + 3]) >>> 0, 11);
        }

      } else if (keyWords === 6) { // 192-bit key - LEA-192
        // Simplified for now - needs full Crypto++ implementation
        throw new Error("LEA-192 not fully implemented yet");
      } else if (keyWords === 8) { // 256-bit key - LEA-256
        // Simplified for now - needs full Crypto++ implementation
        throw new Error("LEA-256 not fully implemented yet");
      }

      // Convert flat array to round key structure
      for (let i = 0; i < this.rounds; i++) {
        this.roundKeys[i] = [
          rkey[i * 6],
          rkey[i * 6 + 1],
          rkey[i * 6 + 2],
          rkey[i * 6 + 3],
          rkey[i * 6 + 4],
          rkey[i * 6 + 5]
        ];
      }
    }

    // Encrypt 128-bit block
    _encryptBlock(block) {
      // Convert input to 32-bit words using OpCodes (little-endian for LEA)
      let X = [
        OpCodes.Pack32LE(block[0], block[1], block[2], block[3]),
        OpCodes.Pack32LE(block[4], block[5], block[6], block[7]),
        OpCodes.Pack32LE(block[8], block[9], block[10], block[11]),
        OpCodes.Pack32LE(block[12], block[13], block[14], block[15])
      ];

      // LEA encryption rounds - implementing correct round function
      // Based on specification:
      // X[i+1][0] ← ((X[i][0] ⊕ K[i][0]) ⊞ (X[i][1] ⊕ K[i][1])) ≪ 9
      // X[i+1][1] ← ((X[i][1] ⊕ K[i][2]) ⊞ (X[i][2] ⊕ K[i][3])) ≫ 5
      // X[i+1][2] ← ((X[i][2] ⊕ K[i][4]) ⊞ (X[i][3] ⊕ K[i][5])) ≫ 3
      // X[i+1][3] ← X[i][0] (circular shift)
      for (let i = 0; i < this.rounds; i++) {
        const RK = this.roundKeys[i];

        // Store old values for circular shift
        const oldX = [...X];

        // Apply LEA round function according to specification
        X[0] = OpCodes.RotL32(((oldX[0] ^ RK[0]) + (oldX[1] ^ RK[1])) >>> 0, 9);
        X[1] = OpCodes.RotR32(((oldX[1] ^ RK[2]) + (oldX[2] ^ RK[3])) >>> 0, 5);
        X[2] = OpCodes.RotR32(((oldX[2] ^ RK[4]) + (oldX[3] ^ RK[5])) >>> 0, 3);
        X[3] = oldX[0]; // Circular shift
      }

      // Convert back to byte array using OpCodes (little-endian)
      const result = [];
      for (let i = 0; i < 4; i++) {
        const wordBytes = OpCodes.Unpack32LE(X[i]);
        result.push(...wordBytes);
      }

      return result;
    }

    // Decrypt 128-bit block
    _decryptBlock(block) {
      // Convert input to 32-bit words using OpCodes (little-endian for LEA)
      let X = [
        OpCodes.Pack32LE(block[0], block[1], block[2], block[3]),
        OpCodes.Pack32LE(block[4], block[5], block[6], block[7]),
        OpCodes.Pack32LE(block[8], block[9], block[10], block[11]),
        OpCodes.Pack32LE(block[12], block[13], block[14], block[15])
      ];

      // LEA decryption rounds (reverse order and inverse operations)
      // Inverse of:
      // X[i+1][0] ← ((X[i][0] ⊕ K[i][0]) ⊞ (X[i][1] ⊕ K[i][1])) ≪ 9
      // X[i+1][1] ← ((X[i][1] ⊕ K[i][2]) ⊞ (X[i][2] ⊕ K[i][3])) ≫ 5
      // X[i+1][2] ← ((X[i][2] ⊕ K[i][4]) ⊞ (X[i][3] ⊕ K[i][5])) ≫ 3
      // X[i+1][3] ← X[i][0] (circular shift)
      for (let i = this.rounds - 1; i >= 0; i--) {
        const RK = this.roundKeys[i];

        // Store current state
        const oldX = [...X];

        // Correct inverse operations:
        // From X[i+1][3] = X[i][0], we get X[i][0] = X[i+1][3]
        X[0] = oldX[3];

        // From X[i+1][0] = ((X[i][0] ⊕ RK[0]) + (X[i][1] ⊕ RK[1])) <<< 9
        // We get: X[i][1] = ((X[i+1][0] >>> 9) - (X[i][0] ⊕ RK[0])) ⊕ RK[1]
        let temp = OpCodes.RotR32(oldX[0], 9); // Inverse left rotation
        temp = (temp - (X[0] ^ RK[0])) >>> 0; // Inverse addition
        X[1] = temp ^ RK[1]; // Inverse XOR

        // From X[i+1][1] = ((X[i][1] ⊕ RK[2]) + (X[i][2] ⊕ RK[3])) >>> 5
        // We get: X[i][2] = ((X[i+1][1] <<< 5) - (X[i][1] ⊕ RK[2])) ⊕ RK[3]
        temp = OpCodes.RotL32(oldX[1], 5); // Inverse right rotation
        temp = (temp - (X[1] ^ RK[2])) >>> 0; // Inverse addition
        X[2] = temp ^ RK[3]; // Inverse XOR

        // From X[i+1][2] = ((X[i][2] ⊕ RK[4]) + (X[i][3] ⊕ RK[5])) >>> 3
        // We get: X[i][3] = ((X[i+1][2] <<< 3) - (X[i][2] ⊕ RK[4])) ⊕ RK[5]
        temp = OpCodes.RotL32(oldX[2], 3); // Inverse right rotation
        temp = (temp - (X[2] ^ RK[4])) >>> 0; // Inverse addition
        X[3] = temp ^ RK[5]; // Inverse XOR
      }

      // Convert back to byte array using OpCodes (little-endian)
      const result = [];
      for (let i = 0; i < 4; i++) {
        const wordBytes = OpCodes.Unpack32LE(X[i]);
        result.push(...wordBytes);
      }

      return result;
    }
  }

  // Register the algorithm immediately

  // ===== REGISTRATION =====

    const algorithmInstance = new LEAAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LEAAlgorithm, LEAInstance };
}));