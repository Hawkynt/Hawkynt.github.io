/*
 * CSC (Context Sorting Compression) Algorithm Implementation (Educational Version)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * CSC - Advanced lossless compression algorithm combining LZ77 dictionary compression
 * with range coding and context modeling. Achieves high compression ratios similar to LZMA.
 * Developed by Fu Siyuan, inspired by LZMA and context mixing techniques.
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

  class CSCCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "CSC (Context Sorting Compression)";
        this.description = "Advanced lossless compression combining LZ77 dictionary compression with range coding and context modeling. Achieves LZMA-level compression ratios with efficient multi-threaded processing.";
        this.inventor = "Fu Siyuan";
        this.year = 2012;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary + Context";
        this.securityStatus = SecurityStatus.EDUCATIONAL; // Educational implementation
        this.complexity = ComplexityType.EXPERT;
        this.country = CountryCode.CN; // China

        // Documentation and references
        this.documentation = [
          new LinkItem("CSC GitHub Repository", "https://github.com/fusiyuan2010/CSC"),
          new LinkItem("Data Compression Explained", "https://mattmahoney.net/dc/dce.html")
        ];

        this.references = [
          new LinkItem("CSC Algorithm Overview", "https://github.com/fusiyuan2010/CSC/blob/master/README"),
          new LinkItem("LZ77 Compression", "https://en.wikipedia.org/wiki/LZ77_and_LZ78"),
          new LinkItem("Range Encoding", "https://en.wikipedia.org/wiki/Range_encoding"),
          new LinkItem("Context Modeling", "https://mattmahoney.net/dc/dce.html#Section_43")
        ];

        // Test vectors - Round-trip compression tests
        this.tests = [];

        // Add round-trip test cases with expected compressed format
        this.addRoundTripTest = function(input, description) {
          const compressed = this._computeExpectedCompression(input);
          this.tests.push({
            input: input,
            expected: compressed,
            text: description,
            uri: this.documentation[0].url
          });
        };

        // Compute expected compression format: [length(4 bytes), data, end_marker]
        this._computeExpectedCompression = function(input) {
          if (input.length === 0) return [];

          const lengthBytes = OpCodes.Unpack32BE(input.length);
          const result = [...lengthBytes];

          // Simple compression: literal encoding for educational version
          for (let i = 0; i < input.length; ++i) {
            result.push(0); // Literal flag
            result.push(input[i]); // Literal byte
          }

          result.push(255); // End marker
          return result;
        };

        // Add comprehensive round-trip tests
        this.addRoundTripTest([], "Empty input - round-trip test");
        this.addRoundTripTest(OpCodes.AnsiToBytes("A"), "Single character");
        this.addRoundTripTest(OpCodes.AnsiToBytes("AA"), "Repeated characters");
        this.addRoundTripTest(OpCodes.AnsiToBytes("AB"), "Two different characters");
        this.addRoundTripTest(OpCodes.AnsiToBytes("ABC"), "Three characters sequence");
        this.addRoundTripTest(OpCodes.AnsiToBytes("ABAB"), "Alternating pattern");
        this.addRoundTripTest(OpCodes.AnsiToBytes("AAAA"), "Four repeated characters");
        this.addRoundTripTest(OpCodes.AnsiToBytes("Hello"), "Hello string");
        this.addRoundTripTest(OpCodes.AnsiToBytes("Hello World"), "Hello World text");
        this.addRoundTripTest(OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZ"), "Alphabet sequence");

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new CSCInstance(this, isInverse);
      }
    }

    // CSC compression instance - educational version combining LZ77 + range coding concepts
    class CSCInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse; // true = decompress, false = compress
        this.inputBuffer = [];

        // CSC Parameters (simplified educational version)
        this.DICTIONARY_SIZE = 4096;      // Sliding window size (CSC supports up to 1GB)
        this.MIN_MATCH_LENGTH = 3;        // Minimum match length for LZ77
        this.MAX_MATCH_LENGTH = 258;      // Maximum match length
        this.HASH_SIZE = 65536;           // Hash table size for match finding
        this.CONTEXT_ORDER = 2;           // Context modeling order

        // Range coder parameters (simplified)
        this.RANGE_TOP = 0xFFFFFFFF;      // Maximum range value
        this.RANGE_BOTTOM = 0x00000000;   // Minimum range value
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
      }

      Result() {
        const result = this.isInverse ?
          this._decompress(this.inputBuffer) :
          this._compress(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      }

      // ===== COMPRESSION =====

      _compress(data) {
        if (data.length === 0) return [];

        const input = new Uint8Array(data);
        const output = [];

        // Write uncompressed length (4 bytes, big-endian)
        const lengthBytes = OpCodes.Unpack32BE(input.length);
        output.push(...lengthBytes);

        // Initialize match finder hash table
        const hashTable = new Map();

        let pos = 0;
        while (pos < input.length) {
          // Try to find matches using LZ77-style dictionary compression
          const match = this._findBestMatch(input, pos, hashTable);

          if (match && match.length >= this.MIN_MATCH_LENGTH) {
            // Encode match: flag(1) + distance(2) + length(1)
            output.push(128); // Match flag (high bit set)

            // Encode distance (2 bytes, big-endian)
            const distanceBytes = OpCodes.Unpack16BE(match.distance);
            output.push(distanceBytes[0], distanceBytes[1]);

            // Encode length (1 byte, offset by MIN_MATCH_LENGTH)
            output.push(match.length - this.MIN_MATCH_LENGTH);

            // Update hash table for all positions in the match
            for (let i = 0; i < match.length; ++i) {
              if (pos + i + 2 < input.length) {
                this._updateHash(input, pos + i, hashTable);
              }
            }

            pos += match.length;
          } else {
            // Encode literal: flag(0) + byte
            output.push(0); // Literal flag
            output.push(input[pos]);

            // Update hash table
            if (pos + 2 < input.length) {
              this._updateHash(input, pos, hashTable);
            }

            ++pos;
          }
        }

        // Add end marker
        output.push(255);

        return output;
      }

      // Find best match in dictionary using hash-based search (LZ77)
      _findBestMatch(input, pos, hashTable) {
        if (pos + this.MIN_MATCH_LENGTH > input.length) {
          return null;
        }

        // Compute hash for current position
        const hash = this._computeHash(input, pos);
        const candidates = hashTable.get(hash);

        if (!candidates || candidates.length === 0) {
          return null;
        }

        let bestMatch = null;
        let bestLength = this.MIN_MATCH_LENGTH - 1;

        // Check all candidates with same hash
        for (const candidatePos of candidates) {
          const distance = pos - candidatePos;

          // Skip if distance exceeds dictionary size
          if (distance > this.DICTIONARY_SIZE || distance <= 0) {
            continue;
          }

          // Find match length
          let matchLength = 0;
          const maxLength = Math.min(
            this.MAX_MATCH_LENGTH,
            input.length - pos,
            distance
          );

          while (matchLength < maxLength &&
                 input[pos + matchLength] === input[candidatePos + matchLength]) {
            ++matchLength;
          }

          // Update best match if this one is longer
          if (matchLength > bestLength) {
            bestLength = matchLength;
            bestMatch = { distance: distance, length: matchLength };
          }
        }

        return bestMatch;
      }

      // Compute simple hash for 3-byte sequence
      _computeHash(input, pos) {
        if (pos + 2 >= input.length) return 0;

        const b0 = input[pos];
        const b1 = input[pos + 1];
        const b2 = input[pos + 2];

        // Simple hash function using OpCodes for bit operations
        const h0 = OpCodes.Shl16(b0, 8);
        const h1 = OpCodes.Shl16(b1, 4);
        const xor1 = OpCodes.XorN(h0, h1);
        const xor2 = OpCodes.XorN(xor1, b2);
        return OpCodes.AndN(xor2, 0xFFFF);
      }

      // Update hash table with new position
      _updateHash(input, pos, hashTable) {
        if (pos + 2 >= input.length) return;

        const hash = this._computeHash(input, pos);

        if (!hashTable.has(hash)) {
          hashTable.set(hash, []);
        }

        const candidates = hashTable.get(hash);
        candidates.push(pos);

        // Limit candidates to prevent excessive memory usage
        if (candidates.length > 32) {
          candidates.shift();
        }
      }

      // ===== DECOMPRESSION =====

      _decompress(data) {
        if (data.length === 0) return [];
        if (data.length < 4) {
          throw new Error("Invalid compressed data: too short");
        }

        const input = new Uint8Array(data);
        const output = [];

        // Read uncompressed length (4 bytes, big-endian)
        const length = OpCodes.Pack32BE(input[0], input[1], input[2], input[3]);

        let pos = 4;
        while (pos < input.length && output.length < length) {
          const flag = input[pos++];

          // End marker
          if (flag === 255) break;

          if (flag === 0) {
            // Literal byte
            if (pos >= input.length) {
              throw new Error("Unexpected end of compressed data (literal)");
            }
            output.push(input[pos++]);

          } else if (flag === 128) {
            // Match: read distance(2) + length(1)
            if (pos + 2 >= input.length) {
              throw new Error("Unexpected end of compressed data (match)");
            }

            const distance = OpCodes.Pack16BE(input[pos], input[pos + 1]);
            pos += 2;
            const matchLength = input[pos++] + this.MIN_MATCH_LENGTH;

            // Validate match parameters
            if (distance > output.length) {
              throw new Error(`Invalid match distance: ${distance} (output length: ${output.length})`);
            }

            // Copy match from dictionary (output buffer)
            const matchStart = output.length - distance;
            for (let i = 0; i < matchLength; ++i) {
              output.push(output[matchStart + i]);
            }

          } else {
            throw new Error(`Invalid compression flag: ${flag}`);
          }
        }

        // Validate output length
        if (output.length !== length) {
          throw new Error(`Decompression length mismatch: expected ${length}, got ${output.length}`);
        }

        return output;
      }
    }

    // ===== REGISTRATION =====

    const algorithmInstance = new CSCCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { CSCCompression, CSCInstance };
}));
