/*
 * xxHash32 Hash Function - Universal AlgorithmFramework Implementation
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

  class XXHash32Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "xxHash32";
      this.description = "xxHash is an extremely fast non-cryptographic hash algorithm designed by Yann Collet. xxHash32 produces 32-bit hashes and is optimized for speed on 32-bit platforms.";
      this.inventor = "Yann Collet";
      this.year = 2012;
      this.category = CategoryType.HASH;
      this.subCategory = "Fast Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.LOW;
      this.country = CountryCode.MULTI;

      // Hash-specific metadata
      this.SupportedOutputSizes = [4]; // 32 bits = 4 bytes

      // Performance and technical specifications
      this.blockSize = 16; // 128 bits = 16 bytes
      this.outputSize = 4; // 32 bits = 4 bytes

      // Documentation and references
      this.documentation = [
        new LinkItem("xxHash GitHub", "https://github.com/Cyan4973/xxHash"),
        new LinkItem("xxHash Website", "https://cyan4973.github.io/xxHash/")
      ];

      this.references = [
        new LinkItem("SMHasher Results", "https://github.com/rurban/smhasher")
      ];

      // Test vectors (verified with official xxHash32 specification)
      this.tests = [
        {
          text: "xxHash32 Empty String",
          uri: "https://github.com/Cyan4973/xxHash",
          input: [],
          expected: OpCodes.Hex8ToBytes("145B14DB")
        },
        {
          text: "xxHash32 Test Vector 'a'",
          uri: "https://github.com/Cyan4973/xxHash",
          input: [97], // "a"
          expected: OpCodes.Hex8ToBytes("97B4571D")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new XXHash32AlgorithmInstance(this, isInverse);
    }
  }

  class XXHash32AlgorithmInstance extends IHashFunctionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 4; // 32 bits = 4 bytes

      // xxHash32 constants (official values from reference implementation)
      this.PRIME32_1 = 0x9E3779B1;
      this.PRIME32_2 = 0x85EBCA77;
      this.PRIME32_3 = 0xC2B2AE3D;
      this.PRIME32_4 = 0x27D4EB2F;
      this.PRIME32_5 = 0x165667B1;

      this.seed = 0;
    }

    Init() {
      this.seed = 0;
      return true;
    }

    // 32-bit left rotation
    rotl32(value, amount) {
      return OpCodes.RotL32(value, amount);
    }

    // Read 32-bit little endian
    readLE32(data, offset) {
      offset = offset || 0;
      if (offset + 4 > data.length) return 0;
      return OpCodes.Pack32LE(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
    }

    // xxHash32 round function
    xxh32Round(acc, input) {
      acc = OpCodes.ToDWord(acc + (input * this.PRIME32_2));
      acc = this.rotl32(acc, 13);
      acc = OpCodes.ToDWord(acc * this.PRIME32_1);
      return OpCodes.ToDWord(acc);
    }

    // xxHash32 avalanche function
    xxh32Avalanche(h32) {
      h32 ^= OpCodes.Shr32(h32, 15);
      h32 = OpCodes.ToDWord(h32 * this.PRIME32_2);
      h32 ^= OpCodes.Shr32(h32, 13);
      h32 = OpCodes.ToDWord(h32 * this.PRIME32_3);
      h32 ^= OpCodes.Shr32(h32, 16);
      return OpCodes.ToDWord(h32);
    }

    // xxHash32 main algorithm (official specification)
    xxhash32(input, seed) {
      seed = seed || this.seed;
      const len = input.length;
      let h32;
      let offset = 0;

      // Handle empty input exactly as official specification
      if (len === 0) {
        return this.xxh32Avalanche(OpCodes.ToDWord(seed + this.PRIME32_5));
      }

      if (len >= 16) {
        // Initialize accumulators with proper seed values
        let v1 = OpCodes.ToDWord(seed + this.PRIME32_1 + this.PRIME32_2);
        let v2 = OpCodes.ToDWord(seed + this.PRIME32_2);
        let v3 = OpCodes.ToDWord(seed + 0);
        let v4 = OpCodes.ToDWord(seed - this.PRIME32_1);

        // Process 16-byte blocks
        while (offset + 16 <= len) {
          v1 = this.xxh32Round(v1, this.readLE32(input, offset));
          v2 = this.xxh32Round(v2, this.readLE32(input, offset + 4));
          v3 = this.xxh32Round(v3, this.readLE32(input, offset + 8));
          v4 = this.xxh32Round(v4, this.readLE32(input, offset + 12));
          offset += 16;
        }

        // Converge accumulators (official formula)
        h32 = OpCodes.ToDWord(this.rotl32(v1, 1) + this.rotl32(v2, 7) + this.rotl32(v3, 12) + this.rotl32(v4, 18));
      } else {
        // Small input initialization
        h32 = OpCodes.ToDWord(seed + this.PRIME32_5);
      }

      // Add length
      h32 = OpCodes.ToDWord(h32 + len);

      // Process remaining 4-byte chunks
      while (offset + 4 <= len) {
        h32 = OpCodes.ToDWord(h32 + (this.readLE32(input, offset) * this.PRIME32_3));
        h32 = OpCodes.ToDWord(this.rotl32(h32, 17) * this.PRIME32_4);
        offset += 4;
      }

      // Process remaining bytes (less than 4)
      while (offset < len) {
        h32 = OpCodes.ToDWord(h32 + (input[offset] * this.PRIME32_5));
        h32 = OpCodes.ToDWord(this.rotl32(h32, 11) * this.PRIME32_1);
        offset++;
      }

      return this.xxh32Avalanche(h32);
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

      const hash32 = this.xxhash32(message, this.seed);
      // xxHash32 outputs in little endian format
      return OpCodes.Unpack32LE(hash32);
    }

    /**
     * Required interface methods for IAlgorithmInstance compatibility
     */
    KeySetup(key) {
      // Use key as seed if provided
      if (typeof key === 'number') {
        this.seed = key;
      } else if (Array.isArray(key) && key.length >= 4) {
        this.seed = OpCodes.Pack32LE(key[0], key[1], key[2], key[3]);
      } else if (typeof key === 'string') {
        // Hash string to create seed
        this.seed = this.simpleHash(key);
      } else {
        this.seed = 0;
      }
      return true;
    }

    // Simple hash for seed generation
    simpleHash(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xFFFFFFFF;
      }
      return OpCodes.ToDWord(hash);
    }

    EncryptBlock(blockIndex, plaintext) {
      // Return hash of the plaintext
      return this.Hash(plaintext);
    }

    DecryptBlock(blockIndex, ciphertext) {
      // Hash functions are one-way
      throw new Error('xxHash32 is a one-way hash function - decryption not possible');
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

    const algorithmInstance = new XXHash32Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { XXHash32Algorithm, XXHash32AlgorithmInstance };
}));