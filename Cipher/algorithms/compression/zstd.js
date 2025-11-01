/*
 * Zstandard Compression Algorithm Implementation  
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of Zstandard compression concepts.
 * Real Zstd is extremely complex - this is a simplified version for learning.
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

  class ZstdCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Zstandard (Simplified)";
        this.description = "Educational implementation of Zstandard compression concepts. Real Zstd uses complex finite state entropy, dictionaries, and advanced matching. This version demonstrates basic principles for learning.";
        this.inventor = "Yann Collet (Facebook)";
        this.year = 2016;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary";
        this.securityStatus = SecurityStatus.EDUCATIONAL; // Simplified version for learning
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.US;

        // Documentation and references
        this.documentation = [
          new LinkItem("Zstandard RFC 8878", "https://tools.ietf.org/html/rfc8878"),
          new LinkItem("Zstd Official Repository", "https://github.com/facebook/zstd"),
          new LinkItem("Zstd Wikipedia", "https://en.wikipedia.org/wiki/Zstd")
        ];

        this.references = [
          new LinkItem("Facebook Zstd", "https://github.com/facebook/zstd"),
          new LinkItem("Zstd Format Specification", "https://tools.ietf.org/html/rfc8878"),
          new LinkItem("Finite State Entropy", "https://github.com/Cyan4973/FiniteStateEntropy")
        ];

        // Test vectors with proper compressed output format
        this.tests = [
          new TestCase(
            OpCodes.AnsiToBytes("ABCD"), // Simple uncompressible data
            [0, 0, 0, 4, 0, 65, 0, 66, 0, 67, 0, 68], // 4-byte header + compressed literals
            "Simple data - no compression possible",
            "Educational test"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("AAAA"), // Repeated data that compresses well
            [0, 0, 0, 4, 0, 65, 1, 1, 3], // 4-byte header + [literal A] + [match distance=1, length=3] 
            "Repeated data - good compression",
            "Educational test"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("ABCABC"), // Pattern repetition
            [0, 0, 0, 6, 0, 65, 0, 66, 0, 67, 1, 3, 3], // Header + ABC + match distance=3, length=3
            "Pattern repetition - ABCABC",
            "Educational test"
          )
        ];
      }

      CreateInstance(isInverse = false) {
        return new ZstdInstance(this, isInverse);
      }
    }

    class ZstdInstance extends IAlgorithmInstance {
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
        // Simplified Zstd-style compression
        if (this.inputBuffer.length === 0) {
          return [0, 0, 0, 0]; // Empty frame header
        }

        const result = [];

        // Simplified Zstd frame header (4 bytes)
        const uncompressedSize = this.inputBuffer.length;
        const [b0, b1, b2, b3] = OpCodes.Unpack32BE(uncompressedSize);
        result.push(b0, b1, b2, b3);

        // Simple block compression using LZ77-style matching
        const compressed = this._simpleBlockCompress(this.inputBuffer);
        result.push(...compressed);

        this.inputBuffer = [];
        return result;
      }

      _decompress() {
        if (this.inputBuffer.length < 4) {
          this.inputBuffer = [];
          return [];
        }

        // Read uncompressed size from header
        const uncompressedSize = OpCodes.Pack32BE(
          this.inputBuffer[0],
          this.inputBuffer[1],
          this.inputBuffer[2],
          this.inputBuffer[3]
        );

        if (uncompressedSize === 0) {
          this.inputBuffer = [];
          return []; // Empty data
        }

        // Decompress block data
        const blockData = this.inputBuffer.slice(4);
        const result = this._simpleBlockDecompress(blockData);

        this.inputBuffer = [];
        return result;
      }

      _simpleBlockCompress(data) {
        // Very simple compression using distance-length pairs
        const result = [];
        let i = 0;

        while (i < data.length) {
          // Simple dictionary search (last 256 bytes)
          const searchStart = Math.max(0, i - 256);
          let bestMatch = { distance: 0, length: 0 };

          // Find longest match
          for (let j = searchStart; j < i; j++) {
            let matchLength = 0;

            while (i + matchLength < data.length &&
                   data[j + (matchLength % (i - j))] === data[i + matchLength] &&
                   matchLength < 255) {
              matchLength++;
            }

            if (matchLength > bestMatch.length) {
              bestMatch.distance = i - j;
              bestMatch.length = matchLength;
            }
          }

          if (bestMatch.length >= 3) {
            // Encode as match: [FLAG=1][DISTANCE][LENGTH]
            result.push(1);
            result.push(bestMatch.distance);
            result.push(bestMatch.length);
            i += bestMatch.length;
          } else {
            // Encode as literal: [FLAG=0][BYTE]
            result.push(0);
            result.push(data[i]);
            i++;
          }
        }

        return result;
      }

      _simpleBlockDecompress(data) {
        const result = [];
        let i = 0;

        while (i < data.length) {
          const flag = data[i++];

          if (flag === 1 && i + 1 < data.length) {
            // Match: copy from dictionary
            const distance = data[i++];
            const length = data[i++];

            for (let j = 0; j < length; j++) {
              const copyPos = result.length - distance;
              if (copyPos >= 0) {
                result.push(result[copyPos]);
              } else {
                result.push(0); // Fallback for invalid references
              }
            }
          } else if (flag === 0 && i < data.length) {
            // Literal byte
            result.push(data[i++]);
          } else {
            break; // Invalid format
          }
        }

        return result;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new ZstdCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ZstdCompression, ZstdInstance };
}));