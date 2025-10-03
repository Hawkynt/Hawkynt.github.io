/*
 * LZ77 Sliding Window Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * LZ77 dictionary-based compression using sliding window technique.
 * Encodes data as (distance, length, literal) tuples by finding matches in history buffer.
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

        // Test vectors with binary LZ77 encoding format: [FLAG][DATA]
        this.tests = [
          new TestCase(
            OpCodes.AnsiToBytes("ABCD"), // "ABCD" - No repetition, all literals
            [0, 65, 0, 66, 0, 67, 0, 68], // [0,A][0,B][0,C][0,D] - all literals
            "No repeated patterns - worst case",
            "https://en.wikipedia.org/wiki/LZ77_and_LZ78"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("AAAA"), // "AAAA" - Length 4, compresses well
            [0, 65, 2, 0, 1, 3], // [0,A][2,dist=1,len=3] - A + end match 3 A's
            "Repetition compression - AAAA",
            "https://en.wikipedia.org/wiki/LZ77_and_LZ78"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("ABCABC"), // "ABCABC" - Length 6, ABC repeats (len=3)
            [0, 65, 0, 66, 0, 67, 2, 0, 3, 3], // [0,A][0,B][0,C][2,dist=3,len=3] - ABC + end match ABC
            "Pattern repetition - ABCABC",
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
            // Check if match extends to end of input
            const nextLiteralPos = pos + match.length;

            if (nextLiteralPos >= this.inputBuffer.length) {
              // Match extends to end - encode without next literal
              // Format: [FLAG=2][DISTANCE_HIGH][DISTANCE_LOW][LENGTH] (no literal)
              result.push(2); // End-match flag
              result.push((match.distance >> 8) & 0xFF);
              result.push(match.distance & 0xFF);
              result.push(match.length);
              pos = nextLiteralPos;
            } else {
              // Normal match with next literal
              const nextLiteral = this.inputBuffer[nextLiteralPos];

              // Format: [FLAG=1][DISTANCE_HIGH][DISTANCE_LOW][LENGTH][LITERAL]
              result.push(1); // Match flag
              result.push((match.distance >> 8) & 0xFF);
              result.push(match.distance & 0xFF);
              result.push(match.length);
              result.push(nextLiteral);

              pos = nextLiteralPos + 1; // Skip the literal we just encoded
            }
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

          if (flag === 1 && i + 4 <= this.inputBuffer.length) {
            // Match with literal: (distance, length, literal)
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
          } else if (flag === 2 && i + 3 <= this.inputBuffer.length) {
            // End match: (distance, length) - no literal
            const distance = (this.inputBuffer[i++] << 8) | this.inputBuffer[i++];
            const length = this.inputBuffer[i++];

            // Copy from history
            for (let j = 0; j < length; j++) {
              const copyPos = result.length - distance;
              if (copyPos >= 0 && copyPos < result.length) {
                result.push(result[copyPos]);
              } else {
                result.push(0); // Fallback for invalid references
              }
            }
            // No literal to add
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

  // ===== REGISTRATION =====

    const algorithmInstance = new LZ77Compression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZ77Compression, LZ77Instance };
}));