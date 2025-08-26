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
          OpCodes.Hex8ToBytes("9fc84e3528c6c61832554f45b80de94f"), // expected
          "LEA-128 Test Vector - KS X 3246",
          "https://seed.kisa.or.kr/kisa/algorithm/EgovLeaInfo.do"
        )
      ];
      // Additional property for key in test vector
      this.tests[0].key = OpCodes.Hex8ToBytes("0f1e2d3c4b5a69788796a5b4c3d2e1f0");

      // LEA Constants - Key schedule constants δ[i] (sqrt(766965) where 766965 = "LEA" in ASCII)
      // These are the actual constants from the Linux kernel implementation
      this.DELTA = [
        0xc3efe9db, 0x88c4d604, 0xe789f229, 0xc6f98763,
        0x15ea49e7, 0xf0bb4158, 0x13bc8ab8, 0xe204abf2
      ];
    }

    // Required: Create instance for this algorithm
    CreateInstance(isInverse = false) {
      return new LEAInstance(this, isInverse);
    }
  }

  // Instance class - handles the actual encryption/decryption
  class LEAInstance extends IBlockCipherInstance {
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

    get key() {
      return this._key ? [...this._key] : null; // Return copy
    }

    // Feed data to the cipher (accumulates until we have complete blocks)
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      // Add data to input buffer
      this.inputBuffer.push(...data);
    }

    // Get the result of the transformation
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

    // Generate round keys based on key length
    _generateRoundKeys() {
      this.roundKeys = [];
      const K = [];
      const keyWords = this.KeySize / 4;

      // Convert key bytes to 32-bit words (little-endian)
      for (let i = 0; i < keyWords; i++) {
        const offset = i * 4;
        K[i] = OpCodes.Pack32BE(
          this._key[offset], 
          this._key[offset + 1], 
          this._key[offset + 2], 
          this._key[offset + 3]
        );
      }

      // Generate round keys based on key length
      for (let i = 0; i < this.rounds; i++) {
        const roundKey = new Array(6);

        if (keyWords === 4) { // 128-bit key
          const T = [
            ((K[0] + OpCodes.RotL32(this.algorithm.DELTA[i % 8], i)) >>> 0),
            ((K[1] + OpCodes.RotL32(this.algorithm.DELTA[i % 8], i + 1)) >>> 0),
            ((K[2] + OpCodes.RotL32(this.algorithm.DELTA[i % 8], i + 2)) >>> 0),
            ((K[3] + OpCodes.RotL32(this.algorithm.DELTA[i % 8], i + 3)) >>> 0)
          ];

          // Update key words for next round
          K[0] = OpCodes.RotL32(T[0], 1);
          K[1] = OpCodes.RotL32(T[1], 3);
          K[2] = OpCodes.RotL32(T[2], 6);
          K[3] = OpCodes.RotL32(T[3], 11);

          // Round key is 6 words (192 bits)
          roundKey[0] = K[0];
          roundKey[1] = K[1];
          roundKey[2] = K[2];
          roundKey[3] = K[3];
          roundKey[4] = K[1];
          roundKey[5] = K[3];

        } else if (keyWords === 6) { // 192-bit key
          const T = [
            ((K[0] + OpCodes.RotL32(this.algorithm.DELTA[i % 8], i)) >>> 0),
            ((K[1] + OpCodes.RotL32(this.algorithm.DELTA[i % 8], i + 1)) >>> 0),
            ((K[2] + OpCodes.RotL32(this.algorithm.DELTA[i % 8], i + 2)) >>> 0),
            ((K[3] + OpCodes.RotL32(this.algorithm.DELTA[i % 8], i + 3)) >>> 0),
            ((K[4] + OpCodes.RotL32(this.algorithm.DELTA[i % 8], i + 4)) >>> 0),
            ((K[5] + OpCodes.RotL32(this.algorithm.DELTA[i % 8], i + 5)) >>> 0)
          ];

          // Update key words for next round
          K[0] = OpCodes.RotL32(T[0], 1);
          K[1] = OpCodes.RotL32(T[1], 3);
          K[2] = OpCodes.RotL32(T[2], 6);
          K[3] = OpCodes.RotL32(T[3], 11);
          K[4] = OpCodes.RotL32(T[4], 13);
          K[5] = OpCodes.RotL32(T[5], 17);

          // Round key is 6 words (192 bits)
          roundKey[0] = K[0];
          roundKey[1] = K[1];
          roundKey[2] = K[2];
          roundKey[3] = K[3];
          roundKey[4] = K[4];
          roundKey[5] = K[5];

        } else if (keyWords === 8) { // 256-bit key
          const T = [
            ((K[(6 * i) % 8] + OpCodes.RotL32(this.algorithm.DELTA[i % 8], i)) >>> 0),
            ((K[(6 * i + 1) % 8] + OpCodes.RotL32(this.algorithm.DELTA[i % 8], i + 1)) >>> 0),
            ((K[(6 * i + 2) % 8] + OpCodes.RotL32(this.algorithm.DELTA[i % 8], i + 2)) >>> 0),
            ((K[(6 * i + 3) % 8] + OpCodes.RotL32(this.algorithm.DELTA[i % 8], i + 3)) >>> 0),
            ((K[(6 * i + 4) % 8] + OpCodes.RotL32(this.algorithm.DELTA[i % 8], i + 4)) >>> 0),
            ((K[(6 * i + 5) % 8] + OpCodes.RotL32(this.algorithm.DELTA[i % 8], i + 5)) >>> 0)
          ];

          // Update key words for next round
          for (let j = 0; j < 6; j++) {
            K[(6 * i + j) % 8] = OpCodes.RotL32(T[j], [1, 3, 6, 11, 13, 17][j]);
          }

          // Round key is 6 words (192 bits)
          for (let j = 0; j < 6; j++) {
            roundKey[j] = T[j];
          }
        }

        this.roundKeys[i] = roundKey;
      }
    }

    // Encrypt 128-bit block
    _encryptBlock(block) {
      // Convert input to 32-bit words using OpCodes (little-endian for LEA)
      let X = [
        OpCodes.Pack32BE(block[0], block[1], block[2], block[3]),
        OpCodes.Pack32BE(block[4], block[5], block[6], block[7]),
        OpCodes.Pack32BE(block[8], block[9], block[10], block[11]),
        OpCodes.Pack32BE(block[12], block[13], block[14], block[15])
      ];

      // LEA encryption rounds - implementing the correct round function
      for (let i = 0; i < this.rounds; i++) {
        const RK = this.roundKeys[i];

        // Store original values before transformation
        const X0 = X[0], X1 = X[1], X2 = X[2], X3 = X[3];

        // LEA round function (ARX operations) - according to specification
        // X[0] = ((X[0] ^ RK[0]) + (X[1] ^ RK[1])) <<< 9
        X[0] = OpCodes.RotL32(((X0 ^ RK[0]) + (X1 ^ RK[1])) >>> 0, 9);

        // X[1] = ((X[1] ^ RK[2]) + (X[2] ^ RK[3])) >>> 5
        X[1] = OpCodes.RotR32(((X1 ^ RK[2]) + (X2 ^ RK[3])) >>> 0, 5);

        // X[2] = ((X[2] ^ RK[4]) + (X[3] ^ RK[5])) >>> 3
        X[2] = OpCodes.RotR32(((X2 ^ RK[4]) + (X3 ^ RK[5])) >>> 0, 3);

        // X[3] = X[0] (circular shift of state) - this should be the NEW X[0]
        X[3] = X[0];
      }

      // Convert back to byte array using OpCodes (little-endian)
      const result = [];
      for (let i = 0; i < 4; i++) {
        const wordBytes = OpCodes.Unpack32BE(X[i]);
        result.push(...wordBytes);
      }

      return result;
    }

    // Decrypt 128-bit block
    _decryptBlock(block) {
      // Convert input to 32-bit words using OpCodes (big-endian for LEA)
      let X = [
        OpCodes.Pack32BE(block[0], block[1], block[2], block[3]),
        OpCodes.Pack32BE(block[4], block[5], block[6], block[7]),
        OpCodes.Pack32BE(block[8], block[9], block[10], block[11]),
        OpCodes.Pack32BE(block[12], block[13], block[14], block[15])
      ];

      // LEA decryption rounds (reverse order and inverse operations)
      for (let i = this.rounds - 1; i >= 0; i--) {
        const RK = this.roundKeys[i];

        // Store original values - in decryption, X[3] contains the old X[0]
        const X0_orig = X[3]; // X[3] was the NEW X[0] from encryption
        const X1_orig = X[1];
        const X2_orig = X[2]; 
        const X3_orig = X[0]; // X[0] is now what used to be X[3] before rotation

        // Inverse LEA round function - reverse the arithmetic operations
        // Reverse: X[0] = ((X[0] ^ RK[0]) + (X[1] ^ RK[1])) <<< 9
        X[0] = OpCodes.RotR32(X0_orig, 9);
        X[0] = (X[0] - (X1_orig ^ RK[1])) >>> 0;
        X[0] = X[0] ^ RK[0];

        // Reverse: X[1] = ((X[1] ^ RK[2]) + (X[2] ^ RK[3])) >>> 5  
        X[1] = OpCodes.RotL32(X1_orig, 5);
        X[1] = (X[1] - (X2_orig ^ RK[3])) >>> 0;
        X[1] = X[1] ^ RK[2];

        // Reverse: X[2] = ((X[2] ^ RK[4]) + (X[3] ^ RK[5])) >>> 3
        X[2] = OpCodes.RotL32(X2_orig, 3);
        X[2] = (X[2] - (X3_orig ^ RK[5])) >>> 0;
        X[2] = X[2] ^ RK[4];

        // X[3] gets the original X[0] (before transformation)
        X[3] = X[0];
      }

      // Convert back to byte array using OpCodes (big-endian)
      const result = [];
      for (let i = 0; i < 4; i++) {
        const wordBytes = OpCodes.Unpack32BE(X[i]);
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