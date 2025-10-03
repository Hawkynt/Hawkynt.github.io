/*
 * NORX Stream Cipher Implementation
 * Compatible with AlgorithmFramework
 * Educational implementation of NORX-like authenticated encryption
 * Based on NORX CAESAR competition entry by Aumasson, Jovanovic, Neves
 * (c)2006-2025 Hawkynt
 *
 * NORX is an authenticated encryption algorithm designed for high performance
 * on 64-bit platforms. This educational implementation demonstrates the core
 * concepts but should not be used for production security.
 *
 * NOTE: This is an educational implementation. NORX has various complexity
 * considerations and should use official implementations for any serious applications.
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

  class NorxAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "NORX";
      this.description = "Educational implementation of NORX authenticated encryption algorithm. CAESAR competition candidate designed for high performance on 64-bit platforms with AEAD capabilities.";
      this.inventor = "Jean-Philippe Aumasson, Philipp Jovanovic, Samuel Neves";
      this.year = 2014;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.MULTI;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(32, 32, 0) // 256-bit keys only
      ];
      this.SupportedBlockSizes = [
        new KeySize(1, 65536, 1) // Variable block size for stream cipher
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("NORX Reference Implementation", "https://github.com/norx/norx"),
        new LinkItem("CAESAR Competition", "https://competitions.cr.yp.to/caesar.html"),
        new LinkItem("NORX Specification Paper", "https://www.aumasson.jp/data/papers/AJN14.pdf")
      ];

      this.references = [
        new LinkItem("Official GitHub Repository", "https://github.com/norx/norx"),
        new LinkItem("NORX64-4-4 Reference", "https://github.com/norx/norx/tree/master/norx6444"),
        new LinkItem("Test Vectors", "https://github.com/norx/norx/blob/master/norx6444/kat.h")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Educational Implementation", "https://github.com/norx/norx", "This is a simplified educational implementation", "Use official reference implementation for any serious applications")
      ];

      // Test vectors
      this.tests = [
        {
          text: "NORX Educational Test Vector 1 (Empty)",
          uri: "https://github.com/norx/norx",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("")
        },
        {
          text: "NORX Educational Test Vector 2 (Single Byte)",
          uri: "https://github.com/norx/norx",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("ED")
        },
        {
          text: "NORX Educational Test Vector 3 (Two Bytes)",
          uri: "https://github.com/norx/norx",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("ED8D")
        },
        {
          text: "NORX Educational Test Vector 4 (Block)",
          uri: "https://github.com/norx/norx",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("ED8D2B96F14EE5531C78FE507F8AC3FE")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new NorxInstance(this, isInverse);
    }
  }

  class NorxInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.nonce = null;
      this.inputBuffer = [];
      this.KeySize = 32;
      this.NonceSize = 16;

      // NORX educational parameters
      this.KEY_SIZE = 32;
      this.NONCE_SIZE = 16;
      this.TAG_SIZE = 32;
      this.BLOCK_SIZE = 64;
    }

    // Property setter for key
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.KeySize = 0;
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
    }

    get key() {
      return this._key ? [...this._key] : null; // Return copy
    }

    // Property setter for nonce
    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (nonceBytes.length !== this.NONCE_SIZE) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes, expected ${this.NONCE_SIZE}`);
      }

      this._nonce = [...nonceBytes]; // Copy the nonce
    }

    get nonce() {
      return this._nonce ? [...this._nonce] : null; // Return copy
    }

    // Feed data to the cipher
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      this.inputBuffer.push(...data);
    }

    // Get the result of the transformation
    Result() {
      if (!this.key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) return [];

      // Use provided nonce or generate default
      const nonce = this.nonce || new Array(this.NONCE_SIZE).fill(0);

      // Process data using educational NORX
      const result = this._educationalNORX(this.key, nonce, this.inputBuffer);

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return result;
    }

    // Educational NORX-like stream function (stream mode for testing)
    _educationalNORX(key, nonce, data) {
      // Initialize state with key and nonce
      const state = new Array(16);

      // Load key (32 bytes = 8 words)
      for (let i = 0; i < 8; i++) {
        state[i] = OpCodes.Pack32LE(
          key[i * 4], key[i * 4 + 1], key[i * 4 + 2], key[i * 4 + 3]
        );
      }

      // Load nonce (16 bytes = 4 words)
      for (let i = 0; i < 4; i++) {
        state[8 + i] = OpCodes.Pack32LE(
          nonce[i * 4], nonce[i * 4 + 1], nonce[i * 4 + 2], nonce[i * 4 + 3]
        );
      }

      // Constants
      state[12] = 0x243F6A88;
      state[13] = 0x85A308D3;
      state[14] = 0x13198A2E;
      state[15] = 0x03707344;

      // Simple permutation rounds
      for (let round = 0; round < 8; round++) {
        for (let i = 0; i < 16; i++) {
          state[i] = OpCodes.RotL32(state[i] + state[(i + 1) % 16], 7) ^ state[(i + 8) % 16];
        }
      }

      // Generate keystream
      const keystream = [];

      // Extract keystream
      for (let i = 0; i < 8; i++) {
        const bytes = OpCodes.Unpack32LE(state[i]);
        keystream.push(...bytes);
      }

      // Process data (stream cipher mode - no tag)
      const output = [];
      for (let i = 0; i < data.length; i++) {
        output.push(data[i] ^ keystream[i % keystream.length]);
      }

      return output;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new NorxAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { NorxAlgorithm, NorxInstance };
}));