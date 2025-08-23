/*
 * RLE (Run-Length Encoding) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Simple compression algorithm that replaces consecutive identical bytes
 * with a count-value pair. Most effective on data with long runs of repeated values.
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
      
      // Test vectors - round-trip compression tests
      this.tests = [
        {
          text: "Simple repeated pattern",
          uri: "https://en.wikipedia.org/wiki/Run-length_encoding",
          input: [65, 65, 65, 66, 66, 66, 67, 67, 67], // "AAABBBCCC"
          expected: [65, 65, 65, 66, 66, 66, 67, 67, 67] // Should decompress to original
        },
        {
          text: "Long run compression",
          uri: "https://en.wikipedia.org/wiki/Run-length_encoding",
          input: [65, 65, 65, 65, 65, 65, 65, 65, 65, 65], // "AAAAAAAAAA"
          expected: [65, 65, 65, 65, 65, 65, 65, 65, 65, 65] // Should decompress to original
        },
        {
          text: "No repeated characters",
          uri: "https://en.wikipedia.org/wiki/Run-length_encoding",
          input: [65, 66, 67, 68, 69, 70], // "ABCDEF"
          expected: [65, 66, 67, 68, 69, 70] // Should decompress to original
        }
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

        if (runLength >= 3 || currentByte === this.escapeChar) {
          // Encode as run: ESCAPE + LENGTH + VALUE
          result.push(this.escapeChar);
          result.push(runLength);
          result.push(currentByte);
        } else {
          // Store literally (runs of length 1-2 unless it's escape char)
          for (let j = 0; j < runLength; j++) {
            result.push(currentByte);
          }
        }

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

      while (i < this.inputBuffer.length) {
        if (this.inputBuffer[i] === this.escapeChar && i + 2 < this.inputBuffer.length) {
          // Decode run: ESCAPE + LENGTH + VALUE
          const runLength = this.inputBuffer[i + 1];
          const value = this.inputBuffer[i + 2];
          
          for (let j = 0; j < runLength; j++) {
            result.push(value);
          }
          
          i += 3;
        } else {
          // Literal byte
          result.push(this.inputBuffer[i]);
          i++;
        }
      }

      // Clear input buffer
      this.inputBuffer = [];

      return result;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new RLECompression());

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RLECompression;
  }

})(typeof global !== 'undefined' ? global : window);