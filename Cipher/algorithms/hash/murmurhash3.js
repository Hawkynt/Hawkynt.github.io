
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

  class MurmurHash3Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "MurmurHash3";
      this.description = "Fast non-cryptographic hash function with excellent distribution properties. Designed for hash tables, bloom filters, and general purpose hashing.";
      this.category = CategoryType.HASH;
      this.subCategory = "Fast Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL; // Non-cryptographic
      this.complexity = ComplexityType.LOW;

      // Algorithm properties
      this.inventor = "Austin Appleby";
      this.year = 2008;
      this.country = CountryCode.US;

      // Hash-specific properties
      this.SupportedOutputSizes = [4]; // 32 bits = 4 bytes
      this.outputSize = 4; // 32 bits = 4 bytes
      this.blockSize = 4; // Process in 4-byte chunks

      // Documentation
      this.documentation = [
        new LinkItem("MurmurHash3 Original Repository", "https://github.com/aappleby/MurmurHash"),
        new LinkItem("SMHasher Test Suite", "https://github.com/aappleby/smhasher"),
        new LinkItem("Wikipedia MurmurHash", "https://en.wikipedia.org/wiki/MurmurHash")
      ];

      // Test vectors (official MurmurHash3 test vectors with seed 0)
      this.tests = [
        {
          text: "MurmurHash3 Empty String",
          uri: "https://github.com/aappleby/smhasher",
          input: [],
          expected: OpCodes.Hex8ToBytes("00000000")
        },
        {
          text: "MurmurHash3 Single character 'a'",
          uri: "https://github.com/aappleby/smhasher",
          input: [97], // "a"
          expected: OpCodes.Hex8ToBytes("3c2569b2")
        },
        {
          text: "MurmurHash3 Short string 'abc'",
          uri: "https://github.com/aappleby/smhasher",
          input: [97, 98, 99], // "abc"
          expected: OpCodes.Hex8ToBytes("b3dd93fa")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new MurmurHash3Instance(this, isInverse);
    }
  }

  class MurmurHash3Instance extends IHashFunctionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 4; // 32 bits = 4 bytes

      // MurmurHash3 32-bit constants (official values)
      this.c1 = 0xcc9e2d51;
      this.c2 = 0x1b873593;
      this.r1 = 15;
      this.r2 = 13;
      this.m = 5;
      this.n = 0xe6546b64;

      this.seed = 0;
    }

    Init() {
      this.seed = 0;
      return true;
    }

    // Read 32-bit little endian value from byte array
    readLE32(data, offset) {
      offset = offset || 0;
      if (offset + 4 > data.length) return 0;
      return OpCodes.Pack32LE(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
    }

    // MurmurHash3 32-bit implementation (official specification)
    murmurHash32(input, seed) {
      seed = seed || this.seed;
      const len = input.length;
      let h1 = seed >>> 0;  // Ensure unsigned 32-bit
      let offset = 0;

      // Process 4-byte chunks
      while (offset + 4 <= len) {
        let k1 = this.readLE32(input, offset);

        // Apply MurmurHash3 mixing function
        k1 = Math.imul(k1, this.c1);
        k1 = OpCodes.RotL32(k1, this.r1);
        k1 = Math.imul(k1, this.c2);

        h1 ^= k1;
        h1 = OpCodes.RotL32(h1, this.r2);
        h1 = (Math.imul(h1, this.m) + this.n) >>> 0;

        offset += 4;
      }

      // Handle remaining bytes (1-3 bytes)
      let k1 = 0;
      const remaining = len & 3; // len % 4

      if (remaining >= 3) k1 ^= input[offset + 2] << 16;
      if (remaining >= 2) k1 ^= input[offset + 1] << 8;
      if (remaining >= 1) {
        k1 ^= input[offset];
        k1 = Math.imul(k1, this.c1);
        k1 = OpCodes.RotL32(k1, this.r1);
        k1 = Math.imul(k1, this.c2);
        h1 ^= k1;
      }

      // Finalization
      h1 ^= len;

      // Apply final mixing (avalanche)
      h1 ^= h1 >>> 16;
      h1 = Math.imul(h1, 0x85ebca6b);
      h1 ^= h1 >>> 13;
      h1 = Math.imul(h1, 0xc2b2ae35);
      h1 ^= h1 >>> 16;

      return h1 >>> 0; // Ensure unsigned 32-bit result
    }

    Hash(input) {
      // Convert string to byte array if needed
      if (typeof input === 'string') {
        const bytes = [];
        for (let i = 0; i < input.length; i++) {
          bytes.push(input.charCodeAt(i) & 0xFF);
        }
        input = bytes;
      }

      if (!input || input.length === 0) {
        // Handle empty input
        const hash = this.murmurHash32([], this.seed);
        return OpCodes.Unpack32BE(hash);
      }

      const hash = this.murmurHash32(input, this.seed);
      return OpCodes.Unpack32BE(hash);
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

    EncryptBlock(blockIndex, plaintext) {
      // Return hash of the plaintext
      return this.Hash(plaintext);
    }

    DecryptBlock(blockIndex, ciphertext) {
      // Hash functions are one-way
      throw new Error('MurmurHash3 is a one-way hash function - decryption not possible');
    }

    ClearData() {
      this.seed = 0;
      this._inputData = [];
    }
  }

  // ===== REGISTRATION =====

    const algorithmInstance = new MurmurHash3Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { MurmurHash3Algorithm, MurmurHash3Instance };
}));