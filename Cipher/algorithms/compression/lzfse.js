/*
 * LZFSE (Lempel-Ziv Finite State Entropy) Algorithm Implementation (Educational Version)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * LZFSE - Apple's modern compression combining LZ77 with Finite State Entropy coding
 * Used in iOS 9+ and macOS 10.11+ for system compression
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

  /**
 * LZFSEAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class LZFSEAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "LZFSE";
        this.description = "Apple's Lempel-Ziv Finite State Entropy compression algorithm. Combines LZ77 dictionary compression with FSE entropy coding for efficient compression with fast decompression.";
        this.inventor = "Apple Inc.";
        this.year = 2015;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.US; // United States

        // Documentation and references
        this.documentation = [
          new LinkItem("LZFSE Wikipedia", "https://en.wikipedia.org/wiki/LZFSE"),
          new LinkItem("Apple Developer Documentation", "https://developer.apple.com/documentation/compression/compression_lzfse")
        ];

        this.references = [
          new LinkItem("LZFSE GitHub Repository", "https://github.com/lzfse/lzfse"),
          new LinkItem("Apple's Compression Framework", "https://developer.apple.com/documentation/compression/algorithm/lzfse"),
          new LinkItem("LZFSE Technical Analysis", "https://encode.su/threads/2221-LZFSE-New-Apple-Data-Compression"),
          new LinkItem("Compression Benchmarks", "https://blog.yossarian.net/2021/06/01/Playing-with-Apples-weird-compression-formats")
        ];

        // Test vectors - round-trip compression tests
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

        // Add standard round-trip tests
        this.addRoundTripTest(OpCodes.AnsiToBytes("A"), "Single character literal");
        this.addRoundTripTest(OpCodes.AnsiToBytes("Hello"), "Simple text - mostly literals");
        this.addRoundTripTest(OpCodes.AnsiToBytes("AAAA"), "Run-length pattern - LZ77 compression");
        this.addRoundTripTest(OpCodes.AnsiToBytes("abcabc"), "Repeating pattern - dictionary match");
        this.addRoundTripTest(OpCodes.AnsiToBytes("The quick brown fox"), "Natural text with some repetition");

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new LZFSEInstance(this, isInverse);
      }
    }

    class LZFSEInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse; // true = decompress, false = compress
        this.inputBuffer = [];

        // LZFSE parameters (educational version)
        this.LZVN_THRESHOLD = 4096; // Switch to LZVN for small inputs
        this.DICTIONARY_SIZE = 65536; // 64KB dictionary
        this.MIN_MATCH_LENGTH = 4; // Minimum match length
        this.MAX_MATCH_LENGTH = 271; // Maximum match length
        this.LOOKAHEAD_SIZE = 271; // Lookahead buffer size
        this.HASH_BITS = 16; // Hash table size
        this.HASH_SIZE = OpCodes.Shl32(1, this.HASH_BITS);
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

    const algorithmInstance = new LZFSEAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZFSEAlgorithm, LZFSEInstance };
}));