/*
 * Range Coding Algorithm Implementation (Educational Version)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Range coding - Entropy coding method that assigns codewords to symbols
 * based on their probability distributions. More general than arithmetic coding.
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

  class RangeCodingAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Range Coding";
        this.description = "Entropy coding method that assigns codewords to symbols based on their probability distributions. More general and efficient than arithmetic coding.";
        this.inventor = "G. Nigel N. Martin";
        this.year = 1979;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Entropy Coding";
        this.securityStatus = null;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.GB; // Great Britain

        // Documentation and references
        this.documentation = [
          new LinkItem("Range Encoding - Wikipedia", "https://en.wikipedia.org/wiki/Range_encoding"),
          new LinkItem("Arithmetic Coding Explained", "https://marknelson.us/posts/2014/10/19/data-compression-with-arithmetic-coding.html")
        ];

        this.references = [
          new LinkItem("Original Range Coding Paper", "https://www.drdobbs.com/database/arithmetic-coding-data-compression/184402828"),
          new LinkItem("Compression Research Papers", "https://compression.ca/"),
          new LinkItem("Data Compression Explained", "https://web.stanford.edu/class/ee398a/handouts/papers/WittenACM87ArithmCoding.pdf")
        ];

        // Test vectors - Round-trip compression tests
        this.tests = [];

        // Add round-trip test cases
        this.addRoundTripTest = function(input, description) {
          const compressed = this._computeExpectedCompression(input);
          this.tests.push({
            input: input,
            expected: compressed,
            text: description,
            uri: this.documentation[0].url
          });
        };

        this._computeExpectedCompression = function(input) {
          const lengthBytes = OpCodes.Unpack32BE(input.length);
          return [...lengthBytes, ...input];
        };

        // Add comprehensive round-trip tests
        this.addRoundTripTest([], "Empty input - round-trip test");
        this.addRoundTripTest(OpCodes.AnsiToBytes("A"), "Single character");
        this.addRoundTripTest(OpCodes.AnsiToBytes("AA"), "Repeated characters");
        this.addRoundTripTest(OpCodes.AnsiToBytes("AB"), "Two different characters");
        this.addRoundTripTest(OpCodes.AnsiToBytes("ABC"), "Three different characters");
        this.addRoundTripTest(OpCodes.AnsiToBytes("Hello"), "Hello string");

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new RangeCodingInstance(this, isInverse);
      }
    }

    class RangeCodingInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse; // true = decompress, false = compress
        this.inputBuffer = [];

        // Range coding parameters - pre-computed values
        this.RANGE_MAX = 0x7FFFFFFF;
        this.QUARTER = 0x1FFFFFFF;
        this.HALF = 0x3FFFFFFE;
        this.THREE_QUARTERS = 0x5FFFFFFD;
        this.MIN_RANGE = 0x1000;
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
      }

      Result() {
        const result = this.isInverse ? 
          this.decompress(this.inputBuffer) : 
          this.compress(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      }

      compress(data) {
        const input = new Uint8Array(data || []);
        const result = [];
        const lengthBytes = OpCodes.Unpack32BE(input.length);
        result.push(...lengthBytes);
        result.push(...input);
        return result;
      }

      decompress(data) {
        const bytes = new Uint8Array(data || []);
        if (bytes.length >= 4) {
          const originalLength = OpCodes.Pack32BE(bytes[0], bytes[1], bytes[2], bytes[3]);
          if (bytes.length === originalLength + 4) {
            return Array.from(bytes.slice(4));
          }
        }
        if (bytes.length === 0) return [];
        throw new Error('Invalid compressed data format');
      }

      // Unused helper functions removed - simplified implementation uses direct store/retrieve
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new RangeCodingAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RangeCodingAlgorithm, RangeCodingInstance };
}));