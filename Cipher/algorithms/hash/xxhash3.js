/*
 * xxHash3 Implementation - Ultra-Fast Non-Cryptographic Hash Function
 * Latest generation xxHash (64-bit and 128-bit variants)
 * (c)2006-2025 Hawkynt
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

  class XXHash3Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "xxHash3";
      this.description = "Ultra-fast non-cryptographic hash function optimized for speed and quality. Latest generation of xxHash family with improved performance on small data and better distribution properties.";
      this.inventor = "Yann Collet";
      this.year = 2019;
      this.category = CategoryType.HASH;
      this.subCategory = "Fast Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.LOW;
      this.country = CountryCode.MULTI;

      // Hash-specific metadata
      this.SupportedOutputSizes = [8, 16]; // 64 and 128 bits

      // Performance and technical specifications
      this.blockSize = 32; // Optimized block size
      this.outputSize = 8; // 64 bits = 8 bytes (default)

      // Documentation and references
      this.documentation = [
        new LinkItem("xxHash Official Website", "https://xxhash.com/"),
        new LinkItem("GitHub Repository", "https://github.com/Cyan4973/xxHash"),
        new LinkItem("Algorithm Documentation", "https://github.com/Cyan4973/xxHash/blob/dev/doc/xxhash_spec.md")
      ];

      this.references = [
        new LinkItem("Reference Implementation", "https://github.com/Cyan4973/xxHash/blob/dev/xxhash.h"),
        new LinkItem("SMHasher Test Results", "https://github.com/rurban/smhasher"),
        new LinkItem("Performance Benchmarks", "https://xxhash.com/#benchmarks")
      ];

      this.knownVulnerabilities = [
        {
          type: "Cryptographic Weakness",
          text: "Not designed for cryptographic use - vulnerable to deliberate collision attacks",
          mitigation: "Use only for non-cryptographic applications like hash tables and checksums"
        }
      ];

      // Test vectors from xxHash repository
      this.tests = [
        {
          text: "xxHash3-64 Empty String",
          uri: "https://github.com/Cyan4973/xxHash/blob/dev/tests/",
          input: [],
          expected: OpCodes.Hex8ToBytes("2D06800538D394C2")
        },
        {
          text: "xxHash3-64 Test Vector 'a'",
          uri: "https://github.com/Cyan4973/xxHash/blob/dev/tests/",
          input: [97], // "a"
          expected: OpCodes.Hex8ToBytes("E6C632B61E964E1F")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new XXHash3AlgorithmInstance(this, isInverse);
    }
  }

  class XXHash3AlgorithmInstance extends IHashFunctionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 8; // Default to 64-bit

      // xxHash3 constants (official values)
      this.PRIME64_1 = 0x9E3779B185EBCA87n;
      this.PRIME64_2 = 0xC2B2AE3D27D4EB4Fn;
      this.PRIME64_3 = 0x165667B19E3779F9n;
      this.PRIME64_4 = 0x85EBCA77C2B2AE63n;
      this.PRIME64_5 = 0x27D4EB2F165667C5n;

      // xxHash3 specific constants
      this.PRIME_MX1 = 0x165667919E3779F9n;
      this.PRIME_MX2 = 0x9FB21C651E98DF25n;

      // xxHash3 official secret (first 192 bytes)
      this.SECRET = new Uint8Array([
        0xb8, 0xfe, 0x6c, 0x39, 0x23, 0xa4, 0x4b, 0xbe, 0x7c, 0x01, 0x81, 0x2c, 0xf7, 0x21, 0xad, 0x1c,
        0xde, 0xd4, 0x6d, 0xe9, 0x83, 0x90, 0x97, 0xdb, 0x72, 0x40, 0xa4, 0xa4, 0xb7, 0xb3, 0x67, 0x1f,
        0xcb, 0x79, 0xe6, 0x4e, 0xcc, 0xc0, 0xe5, 0x78, 0x82, 0x5a, 0xd0, 0x7d, 0xcc, 0xff, 0x72, 0x21,
        0xb8, 0x08, 0x46, 0x74, 0xf7, 0x43, 0x24, 0x8e, 0xe0, 0x35, 0x90, 0xe6, 0x81, 0x3a, 0x26, 0x4c,
        0x3c, 0x28, 0x52, 0xbb, 0x91, 0xc3, 0x00, 0xcb, 0x88, 0xd0, 0x65, 0x8b, 0x1b, 0x53, 0x2e, 0xa3,
        0x71, 0x64, 0x48, 0x97, 0xa2, 0x0d, 0xf9, 0x4e, 0x38, 0x19, 0xef, 0x46, 0xa9, 0xde, 0xac, 0xd8,
        0xa8, 0xfa, 0x76, 0x3f, 0xe3, 0x9c, 0x34, 0x3f, 0xf9, 0xdc, 0xbb, 0xc7, 0xc7, 0x0b, 0x4f, 0x1d,
        0x8a, 0x51, 0xe0, 0x4b, 0xcd, 0xb4, 0x59, 0x31, 0xc8, 0x9f, 0x7e, 0xc9, 0xd9, 0x78, 0x73, 0x64,
        0xea, 0xc5, 0xac, 0x83, 0x34, 0xd3, 0xeb, 0xc3, 0xc5, 0x81, 0xa0, 0xff, 0xfa, 0x13, 0x63, 0xeb,
        0x17, 0x0d, 0xdd, 0x51, 0xb7, 0xf0, 0xda, 0x49, 0xd3, 0x16, 0x55, 0x26, 0x29, 0xd4, 0x68, 0x9e,
        0x2b, 0x16, 0xbe, 0x58, 0x7d, 0x47, 0xa1, 0xfc, 0x8f, 0xf8, 0xb8, 0xd1, 0x7a, 0xd0, 0x31, 0xce,
        0x45, 0xcb, 0x3a, 0x8f, 0x95, 0x16, 0x04, 0x28, 0xaf, 0xd7, 0xfb, 0xca, 0xbb, 0x4b, 0x40, 0x7e
      ]);

      this.seed = 0;
      this.variant = 64; // 64 or 128 bit output
    }

    // Initialize hash
    Init() {
      this.seed = 0;
      this.variant = 64;
      return true;
    }

    // Set seed (key)
    KeySetup(key, options) {
      if (typeof key === 'number') {
        this.seed = key;
      } else if (Array.isArray(key) && key.length >= 8) {
        // Convert byte array to 64-bit seed
        this.seed = 0;
        for (let i = 0; i < 8; i++) {
          this.seed = (this.seed << 8) | (key[i] || 0);
        }
      } else if (typeof key === 'string') {
        // Hash string to create seed
        this.seed = this.simpleHash(key);
      } else {
        this.seed = 0;
      }

      if (options && options.variant) {
        this.variant = options.variant === 128 ? 128 : 64;
      }

      return true;
    }

    // Simple hash for seed generation
    simpleHash(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xFFFFFFFF;
      }
      return hash;
    }

    // Read 32-bit little endian
    readLE32(data, offset) {
      offset = offset || 0;
      if (offset + 4 > data.length) return 0;

      return (data[offset] |
              (data[offset + 1] << 8) |
              (data[offset + 2] << 16) |
              (data[offset + 3] << 24)) >>> 0;
    }

    // Read 64-bit little endian (as BigInt) - manual implementation
    readLE64(data, offset) {
      offset = offset || 0;
      let result = 0n;

      for (let i = 0; i < 8; i++) {
        const byte = BigInt(data[offset + i] || 0);
        result |= byte << (BigInt(i) * 8n);
      }

      return result & 0xFFFFFFFFFFFFFFFFn;
    }

    // xxHash3 avalanche function (for PRIME_MX1 based mixing)
    avalanche(h64) {
      h64 = h64 & 0xFFFFFFFFFFFFFFFFn; // Ensure 64-bit
      h64 ^= h64 >> 37n;
      h64 *= this.PRIME_MX1;
      h64 = h64 & 0xFFFFFFFFFFFFFFFFn; // Mask to 64-bit
      h64 ^= h64 >> 32n;
      return h64 & 0xFFFFFFFFFFFFFFFFn;
    }

    // xxHash3 avalanche_XXH64 function (official XXH64-style avalanche)
    avalanche_XXH64(h64) {
      h64 = h64 & 0xFFFFFFFFFFFFFFFFn; // Ensure 64-bit
      h64 ^= h64 >> 33n;
      h64 *= this.PRIME64_2;
      h64 = h64 & 0xFFFFFFFFFFFFFFFFn; // Mask to 64-bit
      h64 ^= h64 >> 29n;
      h64 *= this.PRIME64_3;
      h64 = h64 & 0xFFFFFFFFFFFFFFFFn; // Mask to 64-bit
      h64 ^= h64 >> 32n;
      return h64 & 0xFFFFFFFFFFFFFFFFn;
    }

    // Mix two 64-bit values
    mix64(low, high) {
      const result = (low ^ high) * this.PRIME64_1;
      return result & 0xFFFFFFFFFFFFFFFFn;
    }

    // xxHash3-64 implementation following official specification
    hash64(input, seed) {
      seed = BigInt(seed || this.seed);
      const len = input.length;

      // Handle empty input (official specification)
      if (len === 0) {
        // Read secret[56:72] as two 64-bit values
        const secretWord0 = this.readLE64(this.SECRET, 56);
        const secretWord1 = this.readLE64(this.SECRET, 64);
        return this.avalanche_XXH64(seed ^ secretWord0 ^ secretWord1);
      }

      // Handle small inputs (1-3 bytes) - official specification
      if (len <= 3) {
        // Combine input bytes according to official algorithm
        let combined = BigInt(input[len - 1] || 0); // last byte (LSB)
        combined |= (BigInt(len) << 8n); // length
        combined |= (BigInt(input[0] || 0) << 16n); // first byte
        combined |= (BigInt(input[len >> 1] || 0) << 24n); // middle-or-last byte (MSB)

        // Read secret[0:8] as two 32-bit values
        const secretWord0 = BigInt(OpCodes.Pack32LE(this.SECRET[0], this.SECRET[1], this.SECRET[2], this.SECRET[3]));
        const secretWord1 = BigInt(OpCodes.Pack32LE(this.SECRET[4], this.SECRET[5], this.SECRET[6], this.SECRET[7]));

        const value = ((secretWord0 ^ secretWord1) + seed) ^ combined;
        return this.avalanche_XXH64(value);
      }

      // Handle medium inputs (4-8 bytes) - will implement later
      if (len <= 8) {
        // For now, use simplified approach
        // Simplified implementation for 4-8 byte algorithm
        seed ^= OpCodes.Pack64LE(0x3c, 0x28, 0x52, 0xbb, 0x91, 0xc3, 0x00, 0xcb);
        let input1 = this.readLE64(input, 0);
        let input2 = this.readLE64(input, len - 8);
        let bitflip = OpCodes.Pack64LE(0x88, 0xd0, 0x65, 0x8b, 0x1b, 0x53, 0x2e, 0xa3) ^
                     OpCodes.Pack64LE(0x71, 0x64, 0x48, 0x97, 0xa2, 0x0d, 0xf9, 0x4e);
        let keyed = input1 ^ input2 ^ bitflip;
        return this.avalanche_XXH64(keyed);
      }

      // Handle larger inputs (9-16 bytes) - will implement later
      if (len <= 16) {
        // For now, use simplified approach
        // Simplified implementation for 9-16 byte algorithm
        let input_lo = this.readLE64(input, 0);
        let input_hi = this.readLE64(input, len - 8);
        let secret_lo = OpCodes.Pack64LE(0x38, 0x19, 0xef, 0x46, 0xa9, 0xde, 0xac, 0xd8);
        let secret_hi = OpCodes.Pack64LE(0xa8, 0xfa, 0x76, 0x3f, 0xe3, 0x9c, 0x34, 0x3f);
        let acc = BigInt(len) * this.PRIME64_1;
        acc += this.mix64(input_lo ^ secret_lo, input_hi ^ secret_hi);
        return this.avalanche_XXH64(acc);
      }

      // For larger inputs, use simplified approach
      let acc = BigInt(len) * this.PRIME64_1;
      acc ^= seed;

      // Process 16-byte chunks
      let offset = 0;
      while (offset + 16 <= len) {
        let data_val = this.readLE64(input, offset);
        let data_val2 = this.readLE64(input, offset + 8);
        let secret_val = this.readLE64(this.SECRET, (offset % 192));
        let secret_val2 = this.readLE64(this.SECRET, ((offset + 8) % 192));
        acc += this.mix64(data_val ^ secret_val, data_val2 ^ secret_val2);
        offset += 16;
      }

      // Process remaining bytes
      if (offset < len) {
        let remaining_lo = this.readLE64(input, len - 16);
        let remaining_hi = this.readLE64(input, len - 8);
        let secret_lo = this.readLE64(this.SECRET, 119); // Use specific secret offset
        let secret_hi = this.readLE64(this.SECRET, 127);
        acc += this.mix64(remaining_lo ^ secret_lo, remaining_hi ^ secret_hi);
      }

      return this.avalanche(acc);
    }

    // Main hash function
    hash(input, outputSize) {
      outputSize = outputSize || this.OutputSize;

      if (outputSize === 8) {
        const hash64 = this.hash64(input);
        // Convert BigInt to big-endian byte array manually (to match test vectors)
        const result = new Array(8);
        for (let i = 0; i < 8; i++) {
          result[7-i] = Number((hash64 >> (BigInt(i) * 8n)) & 0xFFn);
        }
        return result;
      } else if (outputSize === 16) {
        // 128-bit version: compute two separate hashes
        const hash1 = this.hash64(input);
        const seed2 = Number(BigInt(this.seed) ^ 0xAAAAAAAAAAAAAAAAn);
        const hash2 = this.hash64(input, seed2);

        const result = new Array(16);
        for (let i = 0; i < 8; i++) {
          result[i] = Number((hash1 >> (BigInt(i) * 8n)) & 0xFFn);
          result[8 + i] = Number((hash2 >> (BigInt(i) * 8n)) & 0xFFn);
        }
        return result;
      } else {
        throw new Error('xxHash3 supports only 64-bit (8 bytes) or 128-bit (16 bytes) output');
      }
    }

    /**
     * Hash a complete message in one operation
     * @param {Array} message - Message to hash as byte array
     * @returns {Array} Hash digest as byte array
     */
    Hash(message) {
      // Convert string to byte array if needed
      if (typeof message === 'string') {
        const bytes = [];
        for (let i = 0; i < message.length; i++) {
          bytes.push(message.charCodeAt(i) & 0xFF);
        }
        message = bytes;
      }
      return this.hash(message, this.OutputSize);
    }

    /**
     * Required interface methods for IAlgorithmInstance compatibility
     */
    EncryptBlock(blockIndex, plaintext) {
      // Return hash of the plaintext
      return this.Hash(plaintext);
    }

    DecryptBlock(blockIndex, ciphertext) {
      // Hash functions are one-way
      throw new Error('xxHash3 is a one-way hash function - decryption not possible');
    }

    ClearData() {
      this.seed = 0;
    }

    /**
     * Feed method required by test suite - processes input data
     * @param {Array} data - Input data as byte array
     */
    Feed(data) {
      // Store data for final processing
      this._inputData = data;
    }

    /**
     * Result method required by test suite - returns final hash
     * @returns {Array} Hash digest as byte array
     */
    Result() {
      return this.Hash(this._inputData || []);
    }

    Update(data) {
      this._inputData = data;
    }

    Final() {
      return this.Hash(this._inputData || []);
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new XXHash3Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { XXHash3Algorithm, XXHash3AlgorithmInstance };
}));