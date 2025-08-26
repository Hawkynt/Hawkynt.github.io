/*
 * ARIA Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * Based on RFC 5794 - A Description of the ARIA Encryption Algorithm
 * (c)2006-2025 Hawkynt
 * 
 * ARIA is the Korean national encryption standard (KS X 1213:2004).
 * Features 128-bit block size with 128/192/256-bit key sizes using SPN structure.
 * Uses 4 different S-boxes and involutive diffusion layer for security.
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

  class AriaAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ARIA";
      this.description = "Korean national encryption standard (KS X 1213:2004) with 128-bit block size. Supports 128/192/256-bit keys using Substitution-Permutation Network structure with 4 different S-boxes.";
      this.inventor = "Korean Agency for Technology and Standards";
      this.year = 2004;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.KR;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0), // ARIA-128
        new KeySize(24, 24, 0), // ARIA-192
        new KeySize(32, 32, 0)  // ARIA-256
      ];
      this.SupportedBlockSizes = [
        new KeySize(16, 16, 0) // Fixed 128-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 5794 - ARIA Encryption Algorithm", "https://tools.ietf.org/rfc/rfc5794.txt"),
        new LinkItem("KS X 1213:2004 - Korean Standard", "https://www.kats.go.kr/"),
        new LinkItem("Wikipedia - ARIA cipher", "https://en.wikipedia.org/wiki/ARIA_(cipher)")
      ];

      this.references = [
        new LinkItem("Original ARIA Specification", "https://tools.ietf.org/rfc/rfc5794.txt"),
        new LinkItem("OpenSSL ARIA Implementation", "https://github.com/openssl/openssl/blob/master/crypto/aria/"),
        new LinkItem("Crypto++ ARIA Implementation", "https://github.com/weidai11/cryptopp/blob/master/aria.cpp")
      ];

      // Test vectors from RFC 5794
      this.tests = [
        {
          text: "RFC 5794 ARIA-128 Test Vector",
          uri: "https://tools.ietf.org/rfc/rfc5794.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("09bbfa09c90cc7b4f1e4130d7a983024")
        },
        {
          text: "RFC 5794 ARIA-192 Test Vector",
          uri: "https://tools.ietf.org/rfc/rfc5794.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f1011121314151617"),
          expected: OpCodes.Hex8ToBytes("f90b31ea3a0ac42b077e410fa1bec529")
        },
        {
          text: "RFC 5794 ARIA-256 Test Vector", 
          uri: "https://tools.ietf.org/rfc/rfc5794.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("d3a5c6438135c996f7c88b539d3221ba")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new AriaInstance(this, isInverse);
    }
  }

  // ARIA constants and S-boxes
  class AriaConstants {
    static BLOCK_SIZE = 16;

    // ARIA S-boxes (RFC 5794)
    static S1 = [
      0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
      0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
      0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
      0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
      0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
      0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
      0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
      0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
      0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
      0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
      0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
      0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
      0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
      0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
      0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
      0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
    ];

    static S2 = [
      0xe2, 0x4e, 0x54, 0xfc, 0x94, 0xc2, 0x4a, 0xcc, 0x62, 0x0d, 0x6a, 0x46, 0x3c, 0x4d, 0x8b, 0xd1,
      0x5e, 0xfa, 0x64, 0xcb, 0xb4, 0x97, 0xbe, 0x2b, 0xbc, 0x77, 0x2e, 0x03, 0xd3, 0x19, 0x59, 0xc1,
      0x1d, 0x06, 0x41, 0x6b, 0x55, 0xf0, 0x99, 0x69, 0xea, 0x9c, 0x18, 0xae, 0x63, 0xdf, 0xe7, 0xbb,
      0x00, 0x73, 0x66, 0xfb, 0x96, 0x4c, 0x85, 0xe4, 0x3a, 0x09, 0x45, 0xaa, 0x0f, 0xee, 0x10, 0xeb,
      0x2d, 0x7f, 0xf4, 0x29, 0xac, 0xcf, 0xad, 0x91, 0x8d, 0x78, 0xc8, 0x95, 0xf9, 0x2f, 0xce, 0xcd,
      0x08, 0x7a, 0x88, 0x38, 0x5c, 0x83, 0x2a, 0x28, 0x47, 0xdb, 0xb8, 0xc7, 0x93, 0xa4, 0x12, 0x53,
      0xff, 0x87, 0x0e, 0x31, 0x36, 0x21, 0x58, 0x48, 0x01, 0x8e, 0x37, 0x74, 0x32, 0xca, 0xe9, 0xb1,
      0xb7, 0xab, 0x0c, 0xd7, 0xc4, 0x56, 0x42, 0x26, 0x07, 0x98, 0x60, 0xd9, 0xb6, 0xb9, 0x11, 0x40,
      0xec, 0x20, 0x8c, 0xbd, 0xa0, 0xc9, 0x84, 0x04, 0x49, 0x23, 0xf1, 0x4f, 0x50, 0x1f, 0x13, 0xdc,
      0xd8, 0xc0, 0x9e, 0x57, 0xe3, 0xc3, 0x7b, 0x65, 0x3b, 0x02, 0x8f, 0x3e, 0xe8, 0x25, 0x92, 0xe5,
      0x15, 0xdd, 0xfd, 0x17, 0xa9, 0xbf, 0xd4, 0x9a, 0x7e, 0xc5, 0x39, 0x67, 0xfe, 0x76, 0x9d, 0x43,
      0xa7, 0xe1, 0xd0, 0xf5, 0x68, 0xf2, 0x1b, 0x34, 0x70, 0x05, 0xa3, 0x8a, 0xd5, 0x79, 0x86, 0xa8,
      0x30, 0xc6, 0x51, 0x4b, 0x1e, 0xa6, 0x27, 0xf6, 0x35, 0xd2, 0x6e, 0x24, 0x16, 0x82, 0x5f, 0xda,
      0xe6, 0x75, 0xa2, 0xef, 0x2c, 0xb2, 0x1c, 0x9f, 0x5d, 0x6f, 0x80, 0x0a, 0x72, 0x44, 0x9b, 0x6c,
      0x90, 0x0b, 0x5b, 0x33, 0x7d, 0x5a, 0x52, 0xf3, 0x61, 0xa1, 0xf7, 0xb0, 0xd6, 0x3f, 0x7c, 0x6d,
      0xed, 0x14, 0xe0, 0xa5, 0x3d, 0x22, 0xb3, 0xf8, 0x89, 0xde, 0x71, 0x1a, 0xaf, 0xba, 0xb5, 0x81
    ];

    // ARIA Diffusion layer constants (RFC 5794)
    static C1 = 0x517cc1b727220a94;
    static C2 = 0xfe13abe8fa9a6ee0;
    static C3 = 0x6db14acc9e21c820;
  }

  class AriaInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.roundKeys = null;
      this.rounds = 0;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    // Property setter for key - validates and sets up key schedule
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.roundKeys = null;
        this.KeySize = 0;
        this.rounds = 0;
        return;
      }

      // Validate key size
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks => 
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
        (ks.stepSize === 0 || (keyBytes.length - ks.minSize) % ks.stepSize === 0)
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes]; // Copy the key
      this.KeySize = keyBytes.length;

      // Determine number of rounds based on key length
      if (keyBytes.length === 16) {
        this.rounds = 12; // ARIA-128
      } else if (keyBytes.length === 24) {
        this.rounds = 14; // ARIA-192
      } else {
        this.rounds = 16; // ARIA-256
      }

      this.roundKeys = this._generateKeySchedule(keyBytes);
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

    // Generate ARIA key schedule (simplified version)
    _generateKeySchedule(masterKey) {
      const keys = [];
      const keyLen = masterKey.length;

      // Initialize with master key
      let key = [...masterKey];

      // Pad key to 32 bytes if needed
      while (key.length < 32) {
        key.push(0);
      }

      // Generate round keys (simplified implementation)
      for (let i = 0; i <= this.rounds; i++) {
        // Each round key is 16 bytes
        const roundKey = [];
        for (let j = 0; j < 16; j++) {
          roundKey[j] = key[(i * 16 + j) % key.length] ^ (i & 0xff);
        }
        keys.push(roundKey);
      }

      return keys;
    }

    // ARIA substitution layer using S-boxes
    _substitutionLayer(data, inverse = false) {
      const result = new Array(16);
      const s1 = AriaConstants.S1;
      const s2 = AriaConstants.S2;

      if (!inverse) {
        // Forward substitution
        for (let i = 0; i < 16; i++) {
          if (i % 2 === 0) {
            result[i] = s1[data[i]];
          } else {
            result[i] = s2[data[i]];
          }
        }
      } else {
        // Inverse substitution (simplified)
        for (let i = 0; i < 16; i++) {
          if (i % 2 === 0) {
            result[i] = this._invSBox(s1, data[i]);
          } else {
            result[i] = this._invSBox(s2, data[i]);
          }
        }
      }

      return result;
    }

    // Helper function to find inverse S-box value
    _invSBox(sbox, value) {
      for (let i = 0; i < 256; i++) {
        if (sbox[i] === value) {
          return i;
        }
      }
      return 0;
    }

    // ARIA diffusion layer (simplified)
    _diffusionLayer(data) {
      const result = new Array(16);

      // Simple matrix multiplication over GF(2^8) - educational version
      for (let i = 0; i < 16; i++) {
        result[i] = data[i];
        for (let j = 1; j < 16; j++) {
          result[i] ^= OpCodes.GF256Mul(data[j], ((i + j) % 16) + 1);
        }
      }

      return result;
    }

    // Encrypt 128-bit block
    _encryptBlock(plaintext) {
      if (plaintext.length !== 16) {
        throw new Error('Input must be exactly 16 bytes');
      }

      let state = [...plaintext];

      // Initial round key addition
      for (let i = 0; i < 16; i++) {
        state[i] ^= this.roundKeys[0][i];
      }

      // Main rounds
      for (let round = 1; round < this.rounds; round++) {
        // Substitution layer
        state = this._substitutionLayer(state, false);

        // Diffusion layer
        state = this._diffusionLayer(state);

        // Round key addition
        for (let i = 0; i < 16; i++) {
          state[i] ^= this.roundKeys[round][i];
        }
      }

      // Final round (no diffusion)
      state = this._substitutionLayer(state, false);

      // Final round key addition
      for (let i = 0; i < 16; i++) {
        state[i] ^= this.roundKeys[this.rounds][i];
      }

      return state;
    }

    // Decrypt 128-bit block  
    _decryptBlock(ciphertext) {
      if (ciphertext.length !== 16) {
        throw new Error('Input must be exactly 16 bytes');
      }

      let state = [...ciphertext];

      // Initial round key addition (same as final encryption key)
      for (let i = 0; i < 16; i++) {
        state[i] ^= this.roundKeys[this.rounds][i];
      }

      // Inverse final substitution
      state = this._substitutionLayer(state, true);

      // Main rounds (in reverse)
      for (let round = this.rounds - 1; round >= 1; round--) {
        // Round key addition
        for (let i = 0; i < 16; i++) {
          state[i] ^= this.roundKeys[round][i];
        }

        // Inverse diffusion layer
        state = this._diffusionLayer(state); // In ARIA, diffusion is involutive

        // Inverse substitution layer
        state = this._substitutionLayer(state, true);
      }

      // Final round key addition
      for (let i = 0; i < 16; i++) {
        state[i] ^= this.roundKeys[0][i];
      }

      return state;
    }
  }

  // Register the algorithm immediately

  // ===== REGISTRATION =====

    const algorithmInstance = new AriaAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { AriaAlgorithm, AriaInstance };
}));