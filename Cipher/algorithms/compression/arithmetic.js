/*
 * Arithmetic Coding Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Arithmetic coding is a form of entropy encoding used in lossless data compression.
 * Unlike traditional prefix codes, arithmetic coding represents the entire message
 * as a single fraction in the range [0, 1).
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

  class ArithmeticCoding extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Arithmetic Coding";
      this.description = "Arithmetic coding represents the entire message as a single fraction in the range [0,1) using probability models. Unlike prefix codes, achieves optimal compression ratios approaching the Shannon entropy limit.";
      this.inventor = "Jorma Rissanen, Glen Langdon";
      this.year = 1976;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Statistical";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Arithmetic Coding - Wikipedia", "https://en.wikipedia.org/wiki/Arithmetic_coding"),
        new LinkItem("Introduction to Data Compression by Khalid Sayood", "http://rahult.com/bookdc/"),
        new LinkItem("Mark Nelson's Data Compression Tutorial", "https://marknelson.us/posts/2014/10/19/data-compression-with-arithmetic-coding.html")
      ];

      this.references = [
        new LinkItem("Nayuki Reference Implementation", "https://github.com/nayuki/Reference-arithmetic-coding"),
        new LinkItem("CABAC in H.264 Standard", "https://en.wikipedia.org/wiki/Context-adaptive_binary_arithmetic_coding"),
        new LinkItem("JPEG 2000 Arithmetic Coding", "https://www.jpeg.org/jpeg2000/")
      ];

      // Test vectors - round-trip compression tests
      this.tests = [
        {
          text: "Empty data compression test",
          uri: "Educational test vector",
          input: [],
          expected: [] // Empty input produces empty output
        },
        {
          text: "Single byte 'A' compression", 
          uri: "Basic compression test",
          input: [65], // 'A'
          expected: [65,189,64] // Compressed output
        },
        {
          text: "Two byte 'AB' compression",
          uri: "Simple pattern test", 
          input: [65, 66], // "AB"
          expected: [65,2,51,64] // Compressed output
        }
      ];

    }

    CreateInstance(isInverse = false) {
      return new ArithmeticCodingInstance(this, isInverse);

    }
  }

  class ArithmeticCodingInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];

    }

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);

    }

    Result() {
      if (this.inputBuffer.length === 0) {
        return [];
      }

      if (this.isInverse) {
        return this._decompress();
      } else {
        return this._compress();
      }

    }

    _compress() {
      // Create fresh encoder for this compression
      const encoder = new ArithmeticEncoder();
      const compressedBits = encoder.encode(this.inputBuffer);

      // Convert bits to bytes for output
      const output = [];
      for (let i = 0; i < compressedBits.length; i += 8) {
        let byte = 0;
        for (let j = 0; j < 8 && i + j < compressedBits.length; j++) {
          byte |= global.OpCodes ? global.OpCodes.ShiftLeft32(compressedBits[i + j], (7 - j)) : (compressedBits[i + j] << (7 - j));
        }
        output.push(byte);
      }

      // Clear input buffer
      this.inputBuffer = [];

      return output;

    }

    _decompress() {
      // Convert bytes to bits
      const bits = [];
      for (let i = 0; i < this.inputBuffer.length; i++) {
        for (let j = 7; j >= 0; j--) {
          bits.push(global.OpCodes ? (global.OpCodes.ShiftRight32(this.inputBuffer[i], j) & 1) : ((this.inputBuffer[i] >> j) & 1));
        }
      }

      // Create fresh decoder for this decompression
      const decoder = new ArithmeticDecoder();
      const decompressedBytes = decoder.decode(bits);

      // Clear input buffer
      this.inputBuffer = [];

      return decompressedBytes;

    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new ArithmeticCoding();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ArithmeticCoding, ArithmeticCodingInstance };
}));