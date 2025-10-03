/*
 * RLE (Run-Length Encoding) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Simple compression algorithm that replaces consecutive identical bytes
 * with a count-value pair. Most effective on data with long runs of repeated values.
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

  class RLECompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "RLE";
        this.description = "Simple compression algorithm that replaces consecutive identical bytes with a count-value pair. Most effective on data with long runs of repeated values. Fundamental technique used in many image formats.";
        this.inventor = "Unknown (fundamental technique)";
        this.year = 1967;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Transform";
        this.securityStatus = null;
        this.complexity = ComplexityType.ELEMENTARY;
        this.country = CountryCode.US;

        // Configuration
        this.MAX_RUN_LENGTH = 255; // Maximum run length in a single encoding
        this.ESCAPE_CHAR = 0x1B;   // Escape character (ESC)

        // Documentation and references
        this.documentation = [
          new LinkItem("Run-Length Encoding - Wikipedia", "https://en.wikipedia.org/wiki/Run-length_encoding"),
          new LinkItem("PCX Image Format Specification", "https://web.archive.org/web/20100206055706/http://www.qzx.com/pc-gpe/pcx.txt"),
          new LinkItem("TIFF PackBits Algorithm", "https://www.adobe.io/open/standards/TIFF.html")
        ];

        this.references = [
          new LinkItem("Mark Nelson RLE Article", "https://web.archive.org/web/20071013094925/http://www.dogma.net/markn/articles/rle/rle.htm"),
          new LinkItem("Stanford CS106B Compression", "https://web.stanford.edu/class/cs106b/lectures/compression/"),
          new LinkItem("ITU-T T.4 Fax Standard", "https://www.itu.int/rec/T-REC-T.4/en")
        ];

        // Test vectors with proper RLE encoding
        this.tests = [
          new TestCase(
            OpCodes.AnsiToBytes("AAABBBCCC"), // "AAABBBCCC" 
            [3, 65, 3, 66, 3, 67], // RLE encoded: count-value pairs
            "Simple repeated pattern - AAABBBCCC",
            "https://en.wikipedia.org/wiki/Run-length_encoding"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("AAAAABBC"), // "AAAAABBC"
            [5, 65, 2, 66, 1, 67], // RLE encoded: count-value pairs  
            "Mixed run lengths",
            "https://www.numberanalytics.com/blog/mastering-run-length-encoding-rle-for-data-compression"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("ABCDEF"), // "ABCDEF" - no repetition
            [1, 65, 1, 66, 1, 67, 1, 68, 1, 69, 1, 70], // Each character appears once
            "No repeated characters",
            "https://en.wikipedia.org/wiki/Run-length_encoding"
          )
        ];
      }

      CreateInstance(isInverse = false) {
        return new RLEInstance(this, isInverse);
      }
    }

    class RLEInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
        this.maxRunLength = algorithm.MAX_RUN_LENGTH;
        this.escapeChar = algorithm.ESCAPE_CHAR;
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
        if (this.inputBuffer.length === 0) {
          return [];
        }

        const result = [];
        let i = 0;

        while (i < this.inputBuffer.length) {
          const currentByte = this.inputBuffer[i];
          let runLength = 1;

          // Count consecutive identical bytes
          while (i + runLength < this.inputBuffer.length && 
                 this.inputBuffer[i + runLength] === currentByte && 
                 runLength < this.maxRunLength) {
            runLength++;
          }

          // Simple RLE format: LENGTH + VALUE
          result.push(runLength);
          result.push(currentByte);

          i += runLength;
        }

        // Clear input buffer
        this.inputBuffer = [];

        return result;
      }

      _decompress() {
        if (this.inputBuffer.length === 0) {
          return [];
        }

        const result = [];
        let i = 0;

        while (i + 1 < this.inputBuffer.length) {
          // Decode run: LENGTH + VALUE
          const runLength = this.inputBuffer[i];
          const value = this.inputBuffer[i + 1];

          for (let j = 0; j < runLength; j++) {
            result.push(value);
          }

          i += 2;
        }

        // Clear input buffer
        this.inputBuffer = [];

        return result;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new RLECompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RLECompression, RLEInstance };
}));