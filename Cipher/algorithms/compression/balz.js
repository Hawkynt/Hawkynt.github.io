/*
 * BALZ Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * BALZ (by Ilya Muravyov) is an LZ77-based compression algorithm featuring:
 * - Reduced Offset Lempel-Ziv (ROLZ) dictionary matching
 * - Arithmetic coding for entropy encoding
 * - Modified Storer&Szymanski parsing
 * - 512KB-1MB sliding window dictionary
 *
 * Educational implementation with 64KB dictionary for practical JavaScript performance.
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

  class BALZCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BALZ";
      this.description = "LZ77-based compression using ROLZ (Reduced Offset Lempel-Ziv) dictionary matching with hash chains. Created by Ilya Muravyov for fast compression with good ratios. Educational implementation with simplified encoding.";
      this.inventor = "Ilya Muravyov";
      this.year = 2008;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based (ROLZ)";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU; // Russia

      // Configuration parameters (educational implementation)
      this.WINDOW_SIZE = 65536;      // 64KB window (original: 512KB-1MB)
      this.MIN_MATCH_LENGTH = 3;     // Minimum match length
      this.MAX_MATCH_LENGTH = 255;   // Maximum match length
      this.HASH_SIZE = 65536;        // Hash table size
      this.HASH_SHIFT = 5;           // Hash shift value

      // Documentation and references
      this.documentation = [
        new LinkItem("BALZ v1.00 Release Thread", "https://encode.su/threads/1038-balz-v1-00-new-LZ77-encoder-is-here!"),
        new LinkItem("BALZ SourceForge Project", "https://sourceforge.net/projects/balz/"),
        new LinkItem("Ilya Muravyov GitHub", "https://github.com/encode84"),
        new LinkItem("ROLZ Wikipedia", "https://en.wikipedia.org/wiki/LZ77_and_LZ78")
      ];

      this.references = [
        new LinkItem("stdpack.c Collection", "https://github.com/r-lyeh/stdpack.c"),
        new LinkItem("CompressMe.net", "https://compressme.net/"),
        new LinkItem("Matt Mahoney's Compression Benchmark", "https://mattmahoney.net/dc/text.html")
      ];

      // Test vectors - BALZ uses dynamic encoding with specific compressed output format
      this.tests = [
        {
          text: "Empty data test",
          uri: "Educational test vector",
          input: [],
          expected: [] // Empty input produces empty output
        },
        {
          text: "Single byte literal",
          uri: "Educational test vector - literal encoding",
          input: [65], // 'A'
          expected: [1, 0, 0, 0, 1, 0, 0, 0, 0, 65] // size=1, stream_len=1, type=0 (literal), byte=65
        },
        {
          text: "Repeated bytes (compression)",
          uri: "Educational test vector - match encoding",
          input: [65, 65, 65, 65, 65, 65, 65, 65, 65, 65], // 'AAAAAAAAAA'
          expected: [10, 0, 0, 0, 2, 0, 0, 0, 0, 65, 1, 1, 0, 9] // size=10, stream_len=2, literal 'A' + match (dist=1, len=9)
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new BALZInstance(this, isInverse);
    }
  }

  /**
 * BALZ cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class BALZInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this.windowSize = algorithm.WINDOW_SIZE;
      this.minMatchLength = algorithm.MIN_MATCH_LENGTH;
      this.maxMatchLength = algorithm.MAX_MATCH_LENGTH;
      this.hashSize = algorithm.HASH_SIZE;
      this.hashShift = algorithm.HASH_SHIFT;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

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
      const data = this.inputBuffer;
      const output = [];

      // Header: original size (4 bytes, little-endian)
      output.push(data.length&0xFF);
      output.push(OpCodes.Shr32(data.length, 8)&0xFF);
      output.push(OpCodes.Shr32(data.length, 16)&0xFF);
      output.push(OpCodes.Shr32(data.length, 24)&0xFF);

      if (data.length === 0) {
        this.inputBuffer = [];
        return output;
      }

      // LZ77 encoding: produce (literal, match) stream
      const lzStream = this._lz77Encode(data);

      // Encode LZ stream directly (simplified - no arithmetic coding for educational version)
      const encoded = this._encodeLZStream(lzStream);

      // Append encoded data
      output.push(...encoded);

      this.inputBuffer = [];
      return output;
    }

    _decompress() {
      const data = this.inputBuffer;

      if (data.length < 4) {
        this.inputBuffer = [];
        return [];
      }

      // Read original size from header
      const originalSize = data[0] |
                          OpCodes.Shl32(data[1], 8) |
                          OpCodes.Shl32(data[2], 16) |
                          OpCodes.Shl32(data[3], 24);

      if (originalSize === 0) {
        this.inputBuffer = [];
        return [];
      }

      // Decode LZ stream directly
      const lzStream = this._decodeLZStream(data.slice(4));

      // LZ77 decode to recover original data
      const decoded = this._lz77Decode(lzStream, originalSize);

      this.inputBuffer = [];
      return decoded;
    }

    // ===== LZ77 ENCODING =====

    _lz77Encode(data) {
      const stream = [];
      const hashTable = new Array(this.hashSize);

      // Initialize hash table
      for (let i = 0; i < this.hashSize; ++i) {
        hashTable[i] = [];
      }

      let pos = 0;

      while (pos < data.length) {
        // Find longest match using hash table
        const match = this._findMatch(data, pos, hashTable);

        if (match.length >= this.minMatchLength) {
          // Encode as match: [type=1, distance (2 bytes), length (1 byte)]
          stream.push({
            type: 1, // Match token
            distance: match.distance,
            length: match.length
          });

          // Update hash table for matched positions
          for (let i = 0; i < match.length; ++i) {
            if (pos + i + 2 < data.length) {
              const hash = this._hash(data, pos + i);
              hashTable[hash].push(pos + i);

              // Limit hash chain length
              if (hashTable[hash].length > 256) {
                hashTable[hash].shift();
              }
            }
          }

          pos += match.length;
        } else {
          // Encode as literal: [type=0, byte]
          stream.push({
            type: 0, // Literal token
            byte: data[pos]
          });

          // Update hash table
          if (pos + 2 < data.length) {
            const hash = this._hash(data, pos);
            hashTable[hash].push(pos);

            if (hashTable[hash].length > 256) {
              hashTable[hash].shift();
            }
          }

          ++pos;
        }
      }

      return stream;
    }

    _findMatch(data, pos, hashTable) {
      let bestDistance = 0;
      let bestLength = 0;

      if (pos + 2 >= data.length) {
        return { distance: 0, length: 0 };
      }

      const hash = this._hash(data, pos);
      const positions = hashTable[hash];

      if (!positions || positions.length === 0) {
        return { distance: 0, length: 0 };
      }

      // Search hash chain for best match
      for (let i = positions.length - 1; i >= 0; --i) {
        const matchPos = positions[i];

        // Validate match position
        if (matchPos >= pos) continue;
        if (pos - matchPos > this.windowSize) break;

        // Count matching bytes
        let matchLength = 0;
        const maxLen = Math.min(this.maxMatchLength, data.length - pos);

        while (matchLength < maxLen &&
               data[matchPos + matchLength] === data[pos + matchLength]) {
          ++matchLength;
        }

        // Update best match
        if (matchLength > bestLength) {
          bestLength = matchLength;
          bestDistance = pos - matchPos;
        }

        // Early exit if we found a good match
        if (bestLength >= 64) break;
      }

      return { distance: bestDistance, length: bestLength };
    }

    _hash(data, pos) {
      if (pos + 2 >= data.length) return 0;

      let hash = data[pos];
      hash = OpCodes.Shl32(hash, this.hashShift);
      hash = OpCodes.XorN(hash, data[pos + 1]);
      hash = OpCodes.Shl32(hash, this.hashShift);
      hash = OpCodes.XorN(hash, data[pos + 2]);
      return hash&(this.hashSize - 1);
    }

    // ===== LZ77 DECODING =====

    _lz77Decode(stream, expectedSize) {
      const output = [];

      for (const token of stream) {
        if (token.type === 0) {
          // Literal
          output.push(token.byte);
        } else {
          // Match
          const distance = token.distance;
          const length = token.length;

          for (let i = 0; i < length; ++i) {
            const copyPos = output.length - distance;
            if (copyPos >= 0 && copyPos < output.length) {
              output.push(output[copyPos]);
            } else {
              output.push(0); // Fallback
            }
          }
        }

        // Safety check
        if (output.length >= expectedSize) break;
      }

      return output.slice(0, expectedSize);
    }

    // ===== LZ STREAM ENCODING (Simplified - no arithmetic coding) =====

    _encodeLZStream(stream) {
      const bytes = [];

      // Encode stream length (4 bytes)
      const len = stream.length;
      bytes.push(len&0xFF);
      bytes.push(OpCodes.Shr32(len, 8)&0xFF);
      bytes.push(OpCodes.Shr32(len, 16)&0xFF);
      bytes.push(OpCodes.Shr32(len, 24)&0xFF);

      // Encode each token
      for (const token of stream) {
        if (token.type === 0) {
          // Literal: [type=0] + [byte]
          bytes.push(0);
          bytes.push(token.byte);
        } else {
          // Match: [type=1] + [distance_low] + [distance_high] + [length]
          bytes.push(1);
          bytes.push(token.distance&0xFF);
          bytes.push(OpCodes.Shr32(token.distance, 8)&0xFF);
          bytes.push(token.length);
        }
      }

      return bytes;
    }

    _decodeLZStream(data) {
      if (data.length < 4) return [];

      // Read stream length
      const len = data[0] |
                  OpCodes.Shl32(data[1], 8) |
                  OpCodes.Shl32(data[2], 16) |
                  OpCodes.Shl32(data[3], 24);

      const stream = [];
      let pos = 4;

      // Decode tokens
      for (let i = 0; i < len && pos < data.length; ++i) {
        const type = data[pos++];

        if (type === 0) {
          // Literal
          if (pos >= data.length) break;
          stream.push({ type: 0, byte: data[pos++] });
        } else {
          // Match
          if (pos + 3 > data.length) break;
          const distLow = data[pos++];
          const distHigh = data[pos++];
          const length = data[pos++];
          const distance = OpCodes.OrN(distLow, OpCodes.Shl32(distHigh, 8));
          stream.push({ type: 1, distance: distance, length: length });
        }
      }

      return stream;
    }

  }

  // ===== REGISTRATION =====

  const algorithmInstance = new BALZCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BALZCompression, BALZInstance };
}));
