
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

  class MurmurHash3Algorithm extends CryptoAlgorithm {
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
          this.hashSize = 32; // bits (default, also supports 128-bit)
          this.blockSize = 4; // bytes

          // Documentation
          this.documentation = [
            new LinkItem("MurmurHash3 Original Repository", "https://github.com/aappleby/MurmurHash"),
            new LinkItem("SMHasher Test Suite", "https://github.com/aappleby/smhasher"),
            new LinkItem("Wikipedia MurmurHash", "https://en.wikipedia.org/wiki/MurmurHash")
          ];

          // Convert test vectors to AlgorithmFramework format
          this.tests = [
            new TestCase(
              OpCodes.AnsiToBytes(""),
              OpCodes.Hex8ToBytes("00000000"),
              "Empty input with seed 0",
              "https://github.com/aappleby/smhasher"
            ),
            new TestCase(
              OpCodes.AnsiToBytes("a"),
              OpCodes.Hex8ToBytes("3c2569b2"),
              "Single character 'a'",
              "https://github.com/aappleby/smhasher"
            ),
            new TestCase(
              OpCodes.AnsiToBytes("abc"),
              OpCodes.Hex8ToBytes("b3dd93fa"),
              "Short string 'abc'",
              "https://github.com/aappleby/smhasher"
            )
          ];

          // For test suite compatibility
          this.testVectors = this.tests;
        }

        CreateInstance(isInverse = false) {
          return new MurmurHash3Instance(this, isInverse);
        }
      }

      class MurmurHash3Instance extends IAlgorithmInstance {
        constructor(algorithm, isInverse = false) {
          super(algorithm);
          this.inputBuffer = [];
          this.seed = 0;
        }

        Feed(data) {
          if (!data || data.length === 0) return;
          this.inputBuffer.push(...data);
        }

        Result() {
          if (this.inputBuffer.length === 0) return OpCodes.Hex8ToBytes("00000000");

          // Convert input buffer to string for MurmurHash3 API
          const inputString = OpCodes.BytesToAnsi(this.inputBuffer);
          const hashHex = MurmurHash3.hash32(inputString, this.seed);
          const result = OpCodes.Hex8ToBytes(hashHex);

          this.inputBuffer = [];
          return result;
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