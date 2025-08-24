/*
 * Brotli Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of Brotli compression concepts.
 * Real Brotli is extremely complex - this is a simplified version for learning.
 */

(function(global) {
  'use strict';

  // Load AlgorithmFramework (REQUIRED)
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    global.AlgorithmFramework = require('../../AlgorithmFramework.js');
  }

  // Load OpCodes for cryptographic operations (RECOMMENDED)
  if (!global.OpCodes && typeof require !== 'undefined') {
    global.OpCodes = require('../../OpCodes.js');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem, KeySize } = global.AlgorithmFramework;

  class BrotliCompression extends CompressionAlgorithm {
    constructor() {
      super();
      
      // Required metadata
      this.name = "Brotli (Simplified)";
      this.description = "Educational implementation of Brotli compression concepts. Real Brotli uses complex dictionary, transforms, and entropy coding. This version demonstrates basic principles for learning purposes.";
      this.inventor = "Google (Jyrki Alakuijala, Zoltan Szabadka)";
      this.year = 2013;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Brotli RFC 7932", "https://tools.ietf.org/html/rfc7932"),
        new LinkItem("Brotli Official Repository", "https://github.com/google/brotli"),
        new LinkItem("Brotli Wikipedia", "https://en.wikipedia.org/wiki/Brotli")
      ];

      this.references = [
        new LinkItem("Google Brotli", "https://github.com/google/brotli"),
        new LinkItem("Brotli Format Specification", "https://tools.ietf.org/html/rfc7932"),
        new LinkItem("Compression Benchmarks", "https://quixdb.github.io/squash-benchmark/")
      ];

      // Test vectors with actual compressed outputs
      this.tests = [
        {
          text: "Empty data test",
          uri: "Edge case test",
          input: [], 
          expected: [] // Empty input produces empty output
        },
        {
          text: "Single byte test",
          uri: "Minimal compression test",
          input: [65], // "A"
          expected: [1,65] // Simplified Brotli format
        },
        {
          text: "Two bytes test",
          uri: "Basic compression test",
          input: [65, 66], // "AB"
          expected: [1,65,66] // Simplified Brotli format
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new BrotliInstance(this, isInverse);
    }
  }

  class BrotliInstance extends IAlgorithmInstance {
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
      // Simplified Brotli-style compression using basic LZ77 + RLE
      if (this.inputBuffer.length === 0) {
        return [0]; // Empty marker
      }

      const result = [];
      result.push(1); // Non-empty marker
      
      // Very basic dictionary compression (educational only)
      const compressed = this._basicCompress(this.inputBuffer);
      result.push(...compressed);

      this.inputBuffer = [];
      return result;
    }

    _decompress() {
      if (this.inputBuffer.length === 0 || this.inputBuffer[0] === 0) {
        this.inputBuffer = [];
        return []; // Empty data
      }

      const compressed = this.inputBuffer.slice(1);
      const result = this._basicDecompress(compressed);

      this.inputBuffer = [];
      return result;
    }

    _basicCompress(data) {
      // Super simplified compression using run-length encoding
      const result = [];
      let i = 0;

      while (i < data.length) {
        const currentByte = data[i];
        let runLength = 1;

        // Count consecutive identical bytes
        while (i + runLength < data.length && 
               data[i + runLength] === currentByte && 
               runLength < 255) {
          runLength++;
        }

        if (runLength >= 3) {
          // RLE: [ESCAPE=255][LENGTH][VALUE]
          result.push(255);
          result.push(runLength);
          result.push(currentByte);
        } else {
          // Literal bytes
          for (let j = 0; j < runLength; j++) {
            if (currentByte === 255) {
              // Escape literal 255
              result.push(255, 1, 255);
            } else {
              result.push(currentByte);
            }
          }
        }

        i += runLength;
      }

      return result;
    }

    _basicDecompress(data) {
      const result = [];
      let i = 0;

      while (i < data.length) {
        if (data[i] === 255 && i + 2 < data.length) {
          // RLE: [ESCAPE=255][LENGTH][VALUE]
          const runLength = data[i + 1];
          const value = data[i + 2];

          for (let j = 0; j < runLength; j++) {
            result.push(value);
          }

          i += 3;
        } else {
          // Literal byte
          result.push(data[i]);
          i++;
        }
      }

      return result;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new BrotliCompression());

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BrotliCompression;
  }

})(typeof global !== 'undefined' ? global : window);