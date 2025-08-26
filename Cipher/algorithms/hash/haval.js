
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

  class Haval extends HashFunctionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "HAVAL";
        this.description = "HAVAL (HAsh of Variable Length) is a cryptographic hash function with variable output length (128, 160, 192, 224, 256 bits) and variable passes (3, 4, 5).";
        this.category = CategoryType.HASH;
        this.subCategory = "Variable Hash";
        this.securityStatus = SecurityStatus.INSECURE; // Known vulnerabilities
        this.complexity = ComplexityType.HIGH;

        // Algorithm properties
        this.inventor = "Yuliang Zheng, Josef Pieprzyk, Jennifer Seberry";
        this.year = 1992;
        this.country = CountryCode.AU;

        // Hash-specific properties
        this.hashSize = 256; // bits (default)
        this.blockSize = 1024; // bits

        // Documentation
        this.documentation = [
          new LinkItem("HAVAL - A One-Way Hashing Algorithm with Variable Length of Output", "https://web.archive.org/web/20171129084214/http://labs.calyptix.com/haval.php"),
          new LinkItem("US Patent 5,351,310 - HAVAL", "https://patents.google.com/patent/US5351310A/en"),
          new LinkItem("Cryptanalysis of HAVAL", "https://link.springer.com/chapter/10.1007/3-540-48329-2_24")
        ];

        this.references = [
          new LinkItem("Hash Function Cryptanalysis", "https://csrc.nist.gov/projects/hash-functions")
        ];

        // Test vectors from HAVAL specification
        this.tests = [
          {
            text: "Empty string - HAVAL-256/5",
            uri: "HAVAL test vectors",
            input: [],
            expected: OpCodes.Hex8ToBytes("be417bb4dd5cfb76c7126f4f8eeb1553a449039307b1a3cd451dbfdc0fbbe330")
          },
          {
            text: "Single letter 'a' - HAVAL-256/5",
            uri: "HAVAL test vectors",
            input: OpCodes.AnsiToBytes("a"),
            expected: OpCodes.Hex8ToBytes("de8fd5ee72a5e4265af0a756f4e1a1f65c9b2b2f06c63aa04eae9914ca7e8025")
          },
          {
            text: "String 'abc' - HAVAL-128/3",
            uri: "HAVAL test vectors",
            input: OpCodes.AnsiToBytes("abc"),
            expected: OpCodes.Hex8ToBytes("0cd40739683e15f01ca5dbceef4059f1")
          }
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new HavalInstance(this, isInverse);
      }
    }

    class HavalInstance extends IHashFunctionInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.inputBuffer = [];
        this.hashSize = algorithm.hashSize;
        this.blockSize = algorithm.blockSize;
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
      }

      Result() {
        if (this.inputBuffer.length === 0) return [];

        // Process using HAVAL hasher
        const hasher = new HavalHasher(5, 256); // Default: 5 passes, 256 bits
        hasher.update(this.inputBuffer);
        const result = hasher.finalize();

        this.inputBuffer = [];
        return Array.from(result);
      }

      // Direct hash interface with configurable parameters
      hash(data, passes, outputBits) {
        const hasher = new HavalHasher(passes || 5, outputBits || 256);
        hasher.update(data);
        return hasher.finalize();
      }

      // Convenient preset variants
      hash128(data, passes) {
        return this.hash(data, passes || 3, 128);
      }

      hash160(data, passes) {
        return this.hash(data, passes || 4, 160);
      }

      hash192(data, passes) {
        return this.hash(data, passes || 4, 192);
      }

      hash224(data, passes) {
        return this.hash(data, passes || 4, 224);
      }

      hash256(data, passes) {
        return this.hash(data, passes || 5, 256);
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new Haval();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Haval, HavalInstance };
}));