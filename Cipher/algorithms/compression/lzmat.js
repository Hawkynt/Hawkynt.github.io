/*
 * LZMAT Match Table Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZMAT is a real-time compression algorithm using match tables instead of hash chains.
 * Developed by Vitaly Evseenko, it balances speed and compression ratio.
 * Uses a match table for efficient pattern finding with multiple match lengths.
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
 * LZMATCompression - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class LZMATCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "LZMAT";
        this.description = "Real-time compression using match tables instead of hash chains. Developed by Vitaly Evseenko, LZMAT balances fast compression/decompression speed with good compression ratios. Uses efficient match table lookups for pattern finding.";
        this.inventor = "Vitaly Evseenko";
        this.year = 2007;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary";
        this.securityStatus = null;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.country = CountryCode.RU;

        // Configuration parameters - LZMAT specific
        this.MATCH_TABLE_SIZE = 4096;    // Match table size
        this.WINDOW_SIZE = 8192;         // Sliding window size
        this.MIN_MATCH_LENGTH = 3;       // Minimum match length
        this.MAX_MATCH_LENGTH = 273;     // Maximum match length (3 + 270)
        this.MAX_DISTANCE = 8191;        // Maximum backward distance

        // Documentation and references
        this.documentation = [
          new LinkItem("LZMAT Official Page", "http://www.matcode.com/lzmat.htm"),
          new LinkItem("LZMAT GitHub Mirror", "https://github.com/nemequ/lzmat"),
          new LinkItem("LZ77 and LZ78 Algorithms", "https://en.wikipedia.org/wiki/LZ77_and_LZ78")
        ];

        this.references = [
          new LinkItem("LZMAT C Implementation", "https://github.com/nemequ/lzmat/blob/master/lzmat_enc.c"),
          new LinkItem("LZMAT Header File", "https://github.com/nemequ/lzmat/blob/master/lzmat.h"),
          new LinkItem("LZ Compression Benchmark", "https://github.com/inikep/lzbench")
        ];

        // Test vectors - Educational format with known input/output pairs
        // Format: [FLAG][DATA] where FLAG indicates literal (0) or match (1)
        // Match format: [FLAG=1][DISTANCE_HIGH][DISTANCE_LOW][LENGTH]
        // Literal format: [FLAG=0][BYTE]
        this.tests = [
          new TestCase(
            OpCodes.AnsiToBytes("ABCD"), // Simple literal sequence
            [0, 65, 0, 66, 0, 67, 0, 68], // All literals, no matches
            "No repetition - all literals",
            "https://github.com/nemequ/lzmat"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("AAAA"), // Repeated character
            [0, 65, 1, 0, 1, 3], // Literal A + match (distance=1 -> [0,1], length=3)
            "Single character repetition",
            "https://github.com/nemequ/lzmat"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("ABCABC"), // Pattern repetition
            [0, 65, 0, 66, 0, 67, 1, 0, 3, 3], // ABC literals + match (dist=3 -> [0,3], len=3)
            "Pattern repetition - ABCABC",
            "https://github.com/nemequ/lzmat"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("ABABABAB"), // Overlapping pattern
            [0, 65, 0, 66, 1, 0, 2, 6], // AB + match (dist=2 -> [0,2], len=6)
            "Overlapping pattern - ABABABAB",
            "https://github.com/nemequ/lzmat"
          ),
          {
            text: "English sentence compression",
            uri: "https://github.com/nemequ/lzmat",
            input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog")
            // No expected - round-trip test only
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new LZMATInstance(this, isInverse);
      }
    }

    class LZMATInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
        this.matchTableSize = algorithm.MATCH_TABLE_SIZE;
        this.windowSize = algorithm.WINDOW_SIZE;
        this.minMatchLength = algorithm.MIN_MATCH_LENGTH;
        this.maxMatchLength = algorithm.MAX_MATCH_LENGTH;
        this.maxDistance = algorithm.MAX_DISTANCE;
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

        // Build match table for efficient lookups
        const matchTable = this._buildMatchTable();

        while (pos < this.inputBuffer.length) {
          // Find the longest match using match table
          const match = this._findLongestMatch(pos, matchTable);

          if (match.length >= this.minMatchLength) {
            // Encode as match: [FLAG=1][DISTANCE_HIGH][DISTANCE_LOW][LENGTH]
            result.push(1); // Match flag
            const distanceBytes = OpCodes.Unpack16BE(match.distance);
            result.push(distanceBytes[0]); // High byte
            result.push(distanceBytes[1]); // Low byte
            result.push(match.length);
            pos += match.length;
          } else {
            // Encode as literal: [FLAG=0][LITERAL]
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

          if (flag === 1 && i + 3 <= this.inputBuffer.length) {
            // Match: [DISTANCE_HIGH][DISTANCE_LOW][LENGTH]
            const distHigh = this.inputBuffer[i++];
            const distLow = this.inputBuffer[i++];
            const distance = OpCodes.Pack16BE(distHigh, distLow);
            const length = this.inputBuffer[i++];

            // Copy from history buffer
            for (let j = 0; j < length; j++) {
              const copyPos = result.length - distance;
              if (copyPos >= 0 && copyPos < result.length) {
                result.push(result[copyPos]);
              } else {
                // Invalid reference - use zero as fallback
                result.push(0);
              }
            }
          } else if (flag === 0 && i < this.inputBuffer.length) {
            // Literal byte
            result.push(this.inputBuffer[i++]);
          } else {
            break; // Invalid format or end of data
          }
        }

        this.inputBuffer = [];
        return result;
      }

      /**
       * Build match table for efficient pattern finding
       * Uses hash-based indexing of 3-byte sequences
       */
      _buildMatchTable() {
        const table = new Map();

        // Build table entries for all positions
        for (let i = 0; i < this.inputBuffer.length - 2; i++) {
          const hash = this._hashBytes(i);

          if (!table.has(hash)) {
            table.set(hash, []);
          }

          // Store position in match table
          const positions = table.get(hash);
          positions.push(i);

          // Limit entries per hash to maintain performance
          if (positions.length > 16) {
            positions.shift(); // Remove oldest entry
          }
        }

        return table;
      }

      /**
       * Hash 3 bytes at position for match table indexing
       */
      _hashBytes(pos) {
        if (pos + 2 >= this.inputBuffer.length) {
          return 0;
        }

        const b0 = this.inputBuffer[pos];
        const b1 = this.inputBuffer[pos + 1];
        const b2 = this.inputBuffer[pos + 2];

        // Simple hash function for 3-byte sequences using multiplication instead of shifts
        // Equivalent to: ((b0 << 16) | (b1 << 8) | b2)
        return (b0 * 65536 + b1 * 256 + b2) % this.matchTableSize;
      }

      /**
       * Find longest match at current position using match table
       */
      _findLongestMatch(pos, matchTable) {
        let bestDistance = 0;
        let bestLength = 0;

        if (pos + 2 >= this.inputBuffer.length) {
          return { distance: 0, length: 0 };
        }

        const hash = this._hashBytes(pos);
        const candidates = matchTable.get(hash) || [];

        // Search candidates from match table
        for (const candidatePos of candidates) {
          // Skip if outside window or same position
          if (candidatePos >= pos || pos - candidatePos > this.maxDistance) {
            continue;
          }

          // Count matching bytes
          let matchLength = 0;
          const maxLen = Math.min(
            this.maxMatchLength,
            this.inputBuffer.length - pos
          );

          while (matchLength < maxLen &&
                 this.inputBuffer[candidatePos + matchLength] === this.inputBuffer[pos + matchLength]) {
            matchLength++;
          }

          // Update best match if this is longer
          if (matchLength > bestLength) {
            bestLength = matchLength;
            bestDistance = pos - candidatePos;
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

    const algorithmInstance = new LZMATCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZMATCompression, LZMATInstance };
}));
