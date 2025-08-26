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

      // Test vectors
      this.tests = [
        {
          text: "xxHash32 Empty String",
          uri: "https://github.com/Cyan4973/xxHash",
          input: [],
          expected: OpCodes.Hex8ToBytes("02CC5D05")
        },
        {
          text: "xxHash32 Test Vector 'a'",
          uri: "https://github.com/Cyan4973/xxHash",
          input: [97], // "a"
          expected: OpCodes.Hex8ToBytes("550D7456")
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

      this.hasher = new XxHash32Hasher();
    }

    Init() {
      this.hasher = new XxHash32Hasher();
    }

    /**
     * Hash a complete message in one operation
     * @param {Array} message - Message to hash as byte array
     * @returns {Array} Hash digest as byte array
     */
    Hash(message) {
      // Convert string to byte array if needed
      if (typeof message === 'string') {
        message = OpCodes.AnsiToBytes(message);
      }

      const hash32 = xxhash32(message, XXHASH32_SEED);
      return OpCodes.Unpack32BE(hash32);
    }

    /**
     * Required interface methods for IAlgorithmInstance compatibility
     */
    KeySetup(key) {
      // Use key as seed if provided
      const seed = key && key.length >= 4 ? 
        OpCodes.Pack32LE(key[0], key[1], key[2], key[3]) : XXHASH32_SEED;
      this.hasher = new XxHash32Hasher(seed);
      return true;
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
      if (this.hasher) {
        this.hasher.acc1 = 0;
        this.hasher.acc2 = 0;
        this.hasher.acc3 = 0;
        this.hasher.acc4 = 0;
        if (this.hasher.buffer) {
          OpCodes.ClearArray(this.hasher.buffer);
        }
      }
    }

    /**
     * Feed method required by test suite - processes input data
     * @param {Array} data - Input data as byte array
     */
    Feed(data) {
      if (!this.hasher) this.Init();
      this.Update(data);
    }

    /**
     * Result method required by test suite - returns final hash
     * @returns {Array} Hash digest as byte array
     */
    Result() {
      return this.Final();
    }

    Update(data) {
      this.hasher.update(data);
    }

    Final() {
      const hash32 = this.hasher.finalize();
      return OpCodes.Unpack32BE(hash32);
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