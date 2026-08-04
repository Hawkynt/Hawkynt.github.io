/*
 * LZMA2-style Toy LZ77 Compression Algorithm Implementation (Educational Version)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * NOT compatible with XZ Utils, the .xz container format, or real LZMA2. This is a
 * from-scratch, byte-tagged literal/match LZ77 scheme loosely inspired by LZMA2's
 * chunked-processing idea (splitting input into independently handled blocks and
 * choosing per-block whether to "compress" or store raw). It implements none of the
 * real LZMA2 range coder, control-byte chunk format, or the .xz container/CRC/filters,
 * and cannot decode real .xz/LZMA2 streams nor produce output any real xz tool can read.
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
 * XZAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class XZAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "LZMA2-style (custom LZ77 tagging, not .xz compatible)";
        this.description = "Educational, from-scratch byte-tagged literal/match LZ77 compressor loosely inspired by LZMA2's chunked-processing idea. NOT compatible with XZ Utils, the .xz container format, or real LZMA2 — it implements no range coder, no real LZMA2 chunk/control-byte format, and no .xz container/CRC/filters, so it cannot read real .xz/LZMA2 data and its output cannot be read by real xz tools.";
        this.inventor = "Lasse Collin, Igor Pavlov";
        this.year = 2009;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary";
        this.securityStatus = SecurityStatus.EDUCATIONAL; // Educational version for learning
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.INTL; // Finland (XZ Utils) / Russia (LZMA) - International collaboration

        // Documentation and references
        this.documentation = [
          new LinkItem("XZ Utils Wikipedia", "https://en.wikipedia.org/wiki/XZ_Utils"),
          new LinkItem("Official XZ Utils", "https://tukaani.org/xz/")
        ];

        this.references = [
          new LinkItem("XZ Format Specification", "https://tukaani.org/xz/xz-file-format.txt"),
          new LinkItem("LZMA2 vs LZMA1", "https://en.wikipedia.org/wiki/LZMA"),
          new LinkItem("Linux Man Page", "https://linux.die.net/man/1/xz"),
          new LinkItem("GeeksforGeeks XZ Tutorial", "https://www.geeksforgeeks.org/linux-unix/xz-lossless-data-compression-tool-in-linux-with-examples/")
        ];

        // Test vectors - round-trip validation only. This is a self-generated toy format
        // (not the real .xz/LZMA2 format), so hand-guessed exact output bytes would not be
        // meaningful; only "compress then decompress reproduces the input" is asserted.
        this.tests = [
          new TestCase(
            [],
            [],
            "Empty input",
            "https://en.wikipedia.org/wiki/XZ_Utils"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("A"),
            [],
            "Single character round-trip",
            "https://tukaani.org/xz/"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("Hello"),
            [],
            "Short text with literals round-trip",
            "https://tukaani.org/xz/xz-file-format.txt"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("AAAAAAAAAA"),
            [],
            "Repeated pattern round-trip",
            "https://en.wikipedia.org/wiki/LZMA"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("ABCABCABC"),
            [],
            "Repeating sequence round-trip",
            "https://linux.die.net/man/1/xz"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("Hello World! This is a test of LZMA2 compression."),
            [],
            "Natural text round-trip",
            "https://www.geeksforgeeks.org/linux-unix/xz-lossless-data-compression-tool-in-linux-with-examples/"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
            [],
            "Pangram text round-trip",
            "https://tukaani.org/xz/xz-file-format.txt"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new XZInstance(this, isInverse);
      }
    }

    class XZInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse; // true = decompress, false = compress
        this.inputBuffer = [];

        // LZMA2 parameters
        this.DICTIONARY_SIZE = 1024 * 1024; // 1MB dictionary (adjustable)
        this.MIN_MATCH_LENGTH = 2; // Minimum match length
        this.MAX_MATCH_LENGTH = 255; // Maximum match length (must fit the single-byte length field written by _compressChunk)
        this.CHUNK_SIZE = 2048; // Chunk size for LZMA2 processing
        this.COMPRESSION_THRESHOLD = 0.95; // When to use uncompressed chunks
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
      }

      Result() {
        if (this.inputBuffer.length === 0) return [];

        const result = this.isInverse ? 
          this.decompress(this.inputBuffer) : 
          this.compress(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      }

      compress(data) {
        if (!data || data.length === 0) return [];

        const input = new Uint8Array(data);

        // Process data in chunks (LZMA2 improvement)
        const chunks = this._splitIntoChunks(input);
        const compressedChunks = [];

        for (const chunk of chunks) {
          // Analyze chunk compressibility
          if (this._shouldCompress(chunk)) {
            // Apply LZMA compression
            const compressed = this._compressChunk(chunk);
            compressedChunks.push({
              type: 'compressed',
              data: compressed,
              originalSize: chunk.length
            });
          } else {
            // Store uncompressed (LZMA2 feature for incompressible data)
            compressedChunks.push({
              type: 'uncompressed',
              data: Array.from(chunk),
              originalSize: chunk.length
            });
          }
        }

        // Pack all chunks into final format
        return this._packLZMA2Data(compressedChunks, input.length);
      }

      decompress(data) {
        if (!data || data.length < 8) return [];

        // Unpack LZMA2 data
        const { chunks, originalLength } = this._unpackLZMA2Data(data);

        // Decompress each chunk
        const output = [];

        for (const chunk of chunks) {
          if (chunk.type === 'compressed') {
            const decompressed = this._decompressChunk(chunk.data);
            for (let _i = 0; _i < decompressed.length; _i++) output.push(decompressed[_i]);
          } else {
            // Uncompressed chunk
            output.push(...chunk.data);
          }
        }

        return output.slice(0, originalLength);
      }

      _splitIntoChunks(data) {
        const chunks = [];
        for (let i = 0; i < data.length; i += this.CHUNK_SIZE) {
          chunks.push(data.slice(i, i + this.CHUNK_SIZE));
        }
        return chunks;
      }

      _shouldCompress(chunk) {
        // Simple heuristic: check for repetition patterns
        const uniqueBytes = new Set(chunk);
        const compressionRatio = uniqueBytes.size / chunk.length;

        // If data is very random (high entropy), don't compress
        return compressionRatio < this.COMPRESSION_THRESHOLD;
      }

      _compressChunk(chunk) {
        // Simplified LZMA-style compression
        const dictionary = new Map();
        const output = [];
        let pos = 0;

        while (pos < chunk.length) {
          const match = this._findBestMatch(chunk, pos, dictionary);

          if (match.length >= this.MIN_MATCH_LENGTH) {
            // Output match: [type=2][length][offset_high][offset_low]
            output.push(2); // Match marker
            output.push(Math.min(255, match.length));
            const offsetBytes = OpCodes.Unpack16BE(match.offset);
            output.push(offsetBytes[0]);
            output.push(offsetBytes[1]);

            pos += match.length;
          } else {
            // Output literal: [type=1][byte]
            output.push(1); // Literal marker
            output.push(chunk[pos]);
            pos++;
          }

          // Update dictionary
          this._updateDictionary(dictionary, chunk, pos - 1);
        }

        return output;
      }

      _decompressChunk(compressedData) {
        const output = [];
        let pos = 0;

        while (pos < compressedData.length) {
          const type = compressedData[pos++];

          if (type === 1) {
            // Literal
            if (pos < compressedData.length) {
              output.push(compressedData[pos++]);
            }
          } else if (type === 2) {
            // Match
            if (pos + 2 < compressedData.length) {
              const length = compressedData[pos++];
              const offsetHigh = compressedData[pos++];
              const offsetLow = compressedData[pos++];
              const offset = OpCodes.Pack16BE(offsetHigh, offsetLow);

              // Copy from dictionary
              for (let i = 0; i < length; i++) {
                const sourcePos = output.length - offset;
                if (sourcePos >= 0 && sourcePos < output.length) {
                  output.push(output[sourcePos]);
                } else {
                  output.push(0); // Padding for invalid references
                }
              }
            }
          }
        }

        return output;
      }

      _findBestMatch(chunk, pos, dictionary) {
        let bestMatch = { length: 0, offset: 0 };

        if (pos + this.MIN_MATCH_LENGTH > chunk.length) {
          return bestMatch;
        }

        // Simple dictionary search
        const searchKey = chunk.slice(pos, pos + 3).join(',');
        const candidates = dictionary.get(searchKey) || [];

        for (const candidatePos of candidates) {
          if (pos - candidatePos > this.DICTIONARY_SIZE) continue;

          let length = 0;
          const maxLength = Math.min(this.MAX_MATCH_LENGTH, chunk.length - pos);

          while (length < maxLength && 
                 chunk[pos + length] === chunk[candidatePos + length]) {
            length++;
          }

          if (length >= this.MIN_MATCH_LENGTH && length > bestMatch.length) {
            bestMatch = { length, offset: pos - candidatePos };
          }
        }

        return bestMatch;
      }

      _updateDictionary(dictionary, chunk, pos) {
        if (pos + 2 < chunk.length) {
          const key = chunk.slice(pos, pos + 3).join(',');
          if (!dictionary.has(key)) {
            dictionary.set(key, []);
          }
          dictionary.get(key).push(pos);

          // Limit dictionary entries to prevent memory bloat
          if (dictionary.get(key).length > 100) {
            dictionary.get(key).shift();
          }
        }
      }

      _packLZMA2Data(chunks, originalLength) {
        const result = [];

        // Header: [OriginalLength(4)][ChunkCount(4)][ChunkData...]

        // Original length
        const originalLengthBytes = OpCodes.Unpack32BE(originalLength);
        result.push(originalLengthBytes[0]);
        result.push(originalLengthBytes[1]);
        result.push(originalLengthBytes[2]);
        result.push(originalLengthBytes[3]);

        // Chunk count
        const chunkCountBytes = OpCodes.Unpack32BE(chunks.length);
        result.push(chunkCountBytes[0]);
        result.push(chunkCountBytes[1]);
        result.push(chunkCountBytes[2]);
        result.push(chunkCountBytes[3]);

        // Pack each chunk: [Type(1)][OriginalSize(4)][CompressedSize(4)][Data...]
        for (const chunk of chunks) {
          result.push(chunk.type === 'compressed' ? 2 : 1);

          // Original size
          const originalSizeBytes = OpCodes.Unpack32BE(chunk.originalSize);
          result.push(originalSizeBytes[0]);
          result.push(originalSizeBytes[1]);
          result.push(originalSizeBytes[2]);
          result.push(originalSizeBytes[3]);

          // Compressed size
          const compressedSizeBytes = OpCodes.Unpack32BE(chunk.data.length);
          result.push(compressedSizeBytes[0]);
          result.push(compressedSizeBytes[1]);
          result.push(compressedSizeBytes[2]);
          result.push(compressedSizeBytes[3]);

          // Data
          result.push(...chunk.data);
        }

        return result;
      }

      _unpackLZMA2Data(data) {
        let pos = 0;

        // Read original length
        const originalLength = OpCodes.Pack32BE(data[pos], data[pos + 1], data[pos + 2], data[pos + 3]);
        pos += 4;

        // Read chunk count
        const chunkCount = OpCodes.Pack32BE(data[pos], data[pos + 1], data[pos + 2], data[pos + 3]);
        pos += 4;

        // Read chunks
        const chunks = [];
        for (let i = 0; i < chunkCount; i++) {
          if (pos >= data.length) break;

          const type = data[pos++];

          // Read original size
          const originalSize = OpCodes.Pack32BE(data[pos], data[pos + 1], data[pos + 2], data[pos + 3]);
          pos += 4;

          // Read compressed size
          const compressedSize = OpCodes.Pack32BE(data[pos], data[pos + 1], data[pos + 2], data[pos + 3]);
          pos += 4;

          // Read data
          const chunkData = data.slice(pos, pos + compressedSize);
          pos += compressedSize;

          chunks.push({
            type: type === 2 ? 'compressed' : 'uncompressed',
            data: Array.from(chunkData),
            originalSize: originalSize
          });
        }

        return { chunks, originalLength };
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new XZAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { XZAlgorithm, XZInstance };
}));