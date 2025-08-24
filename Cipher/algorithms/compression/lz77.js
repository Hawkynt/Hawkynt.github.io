/*
 * LZ77 Sliding Window Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * LZ77 dictionary-based compression using sliding window technique.
 * Encodes data as (distance, length, literal) tuples by finding matches in history buffer.
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
    
  class LZ77Compression extends CompressionAlgorithm {
    constructor() {
      super();
      
      // Required metadata
      this.name = "LZ77";
      this.description = "Dictionary-based compression using sliding window technique. Encodes data as (distance, length, literal) tuples by finding matches in a sliding history buffer. Foundation for many modern compression formats like DEFLATE.";
      this.inventor = "Abraham Lempel, Jacob Ziv";
      this.year = 1977;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.IL;

      // Configuration parameters
      this.WINDOW_SIZE = 4096;      // Size of sliding window (search buffer)
      this.LOOKAHEAD_SIZE = 18;     // Size of lookahead buffer
      this.MIN_MATCH_LENGTH = 3;    // Minimum match length to encode
      this.MAX_MATCH_LENGTH = 258;  // Maximum match length
      
      // Documentation and references
      this.documentation = [
        new LinkItem("Original LZ77 Paper", "https://ieeexplore.ieee.org/document/1055714"),
        new LinkItem("RFC 1951 - DEFLATE Specification", "https://tools.ietf.org/html/rfc1951"),
        new LinkItem("LZ77 and LZ78 - Wikipedia", "https://en.wikipedia.org/wiki/LZ77_and_LZ78")
      ];

      this.references = [
        new LinkItem("GZIP/zlib Implementation", "https://github.com/madler/zlib"),
        new LinkItem("Educational Implementation", "https://www.cs.duke.edu/csed/curious/compression/lz77.html"),
        new LinkItem("LZSS Variant Analysis", "https://web.archive.org/web/20070823091851/http://www.cs.bell-labs.com/who/sjk/data/lzss.ps")
      ];
      
      // Test vectors with proper LZ77 encoding (distance, length, literal) tuples
      this.tests = [
        new TestCase(
          global.OpCodes.AnsiToBytes("AABCBBABC"), // "AABCBBABC" - Microsoft standard test case
          [0, 0, 65,  // (0,0,A) - First A, no match
           1, 1, 66,  // (1,1,B) - Second A matched at distance 1, length 1, followed by B
           0, 0, 67,  // (0,0,C) - C, no match  
           2, 1, 66,  // (2,1,B) - B matched at distance 2, length 1, followed by B
           1, 1, 65,  // (1,1,A) - B matched at distance 1, length 1, followed by A
           3, 2],     // (3,2) - AB matched at distance 3, length 2
          "Microsoft standard test case - AABCBBABC",
          "https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-wusp/fb98aa28-5cd7-407f-8869-a6cef1ff1ccb"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("ABCABC"), // "ABCABC" - Simple repeated pattern
          [0, 0, 65,  // (0,0,A)
           0, 0, 66,  // (0,0,B)  
           0, 0, 67,  // (0,0,C)
           3, 3],     // (3,3) - ABC matched at distance 3, length 3
          "Simple repeated pattern - ABCABC",
          "https://en.wikipedia.org/wiki/LZ77_and_LZ78"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("ABCD"), // "ABCD" - No repetition
          [0, 0, 65,  // (0,0,A)
           0, 0, 66,  // (0,0,B)
           0, 0, 67,  // (0,0,C)
           0, 0, 68], // (0,0,D)
          "No repeated patterns - worst case",
          "https://en.wikipedia.org/wiki/LZ77_and_LZ78"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new LZ77Instance(this, isInverse);
    }
  }

  class LZ77Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this.windowSize = algorithm.WINDOW_SIZE;
      this.lookaheadSize = algorithm.LOOKAHEAD_SIZE;
      this.minMatchLength = algorithm.MIN_MATCH_LENGTH;
      this.maxMatchLength = algorithm.MAX_MATCH_LENGTH;
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
      const result = [];
      let pos = 0;

      while (pos < this.inputBuffer.length) {
        // Find the longest match in the sliding window
        const match = this._findLongestMatch(pos);

        if (match.length >= this.minMatchLength) {
          // Encode as (distance, length, next_literal)
          const nextLiteral = pos + match.length < this.inputBuffer.length ? 
                              this.inputBuffer[pos + match.length] : 0;
          
          // Format: [FLAG=1][DISTANCE_HIGH][DISTANCE_LOW][LENGTH][LITERAL]
          result.push(1); // Match flag
          result.push((match.distance >> 8) & 0xFF);
          result.push(match.distance & 0xFF);
          result.push(match.length);
          result.push(nextLiteral);
          
          pos += match.length + 1; // Skip matched bytes + literal
        } else {
          // Encode as literal
          // Format: [FLAG=0][LITERAL]
          result.push(0); // Literal flag
          result.push(this.inputBuffer[pos]);
          pos++;
        }
      }

      this.inputBuffer = [];
      return result;
    }

    _decompress() {
      const result = [];
      let i = 0;

      while (i < this.inputBuffer.length) {
        const flag = this.inputBuffer[i++];

        if (flag === 1 && i + 4 < this.inputBuffer.length) {
          // Match: (distance, length, literal)
          const distance = (this.inputBuffer[i++] << 8) | this.inputBuffer[i++];
          const length = this.inputBuffer[i++];
          const literal = this.inputBuffer[i++];

          // Copy from history
          for (let j = 0; j < length; j++) {
            const copyPos = result.length - distance;
            if (copyPos >= 0 && copyPos < result.length) {
              result.push(result[copyPos]);
            } else {
              result.push(0); // Fallback for invalid references
            }
          }

          // Add literal
          result.push(literal);
        } else if (flag === 0 && i < this.inputBuffer.length) {
          // Literal byte
          result.push(this.inputBuffer[i++]);
        } else {
          break; // Invalid format
        }
      }

      this.inputBuffer = [];
      return result;
    }

    _findLongestMatch(pos) {
      let bestDistance = 0;
      let bestLength = 0;
      
      const searchStart = Math.max(0, pos - this.windowSize);
      const lookaheadEnd = Math.min(this.inputBuffer.length, pos + this.lookaheadSize);

      // Search for matches in the sliding window
      for (let searchPos = searchStart; searchPos < pos; searchPos++) {
        let matchLength = 0;
        
        // Count matching bytes
        while (pos + matchLength < lookaheadEnd &&
               this.inputBuffer[searchPos + matchLength] === this.inputBuffer[pos + matchLength] &&
               matchLength < this.maxMatchLength) {
          matchLength++;
        }

        // Update best match if this is longer
        if (matchLength > bestLength) {
          bestLength = matchLength;
          bestDistance = pos - searchPos;
        }
      }

      return {
        distance: bestDistance,
        length: bestLength
      };
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new LZ77Compression());

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LZ77Compression;
  }

})(typeof global !== 'undefined' ? global : window);