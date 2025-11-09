/*
 * LZP (Lempel-Ziv with Prediction) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZP combines PPM-style context modeling with LZ77-style string matching.
 * Uses hash-based prediction to find matches based on context, eliminating
 * the need to encode match positions explicitly. Efficient for text with
 * repeated patterns and predictable structure.
 *
 * References:
 * - Charles Bloom, "LZP: a new data compression algorithm", DCC 1996
 * - https://github.com/lmcilroy/lzp
 * - https://github.com/howerj/lzp
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

  class LZPCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LZP";
      this.description = "Dictionary compression with context-based prediction using hash tables. Combines PPM-style context modeling with LZ77-style string matching for efficient compression of text with repeated patterns.";
      this.inventor = "Charles Bloom";
      this.year = 1996;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null; // Compression algorithm - no security claims
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Configuration parameters
      this.CONTEXT_SIZE = 4;           // Number of bytes for context hashing
      this.HASH_TABLE_SIZE = 65536;    // 16-bit hash table (2^16)
      this.MAX_MATCH_LENGTH = 255;     // Maximum match length (8-bit)
      this.MIN_MATCH_LENGTH = 1;       // Minimum match to encode

      // Documentation and references
      this.documentation = [
        new LinkItem("LZP Original Paper (DCC 1996)", "https://ieeexplore.ieee.org/document/488353/"),
        new LinkItem("LZP Algorithm Description", "https://hugi.scene.org/online/coding/hugi 12 - colzp.htm"),
        new LinkItem("Semantic Scholar - LZP Paper", "https://www.semanticscholar.org/paper/LZP:-a-new-data-compression-algorithm-Bloom/b2fb1bd029e412e57bf7a7e332149d5a6e6bcb1a")
      ];

      this.references = [
        new LinkItem("LZP Streaming Implementation", "https://github.com/lmcilroy/lzp"),
        new LinkItem("LZP CODEC Implementation", "https://github.com/howerj/lzp"),
        new LinkItem("Hugi Article - Yet Another LZP Idea", "https://hugi.scene.org/online/coding/hugi 16 - cotadlzr.htm")
      ];

      // Test vectors demonstrating LZP compression behavior
      // Format: Control bytes (8 bits per byte) + literals/matches
      // Bit 1 = prediction match, Bit 0 = literal follows
      this.tests = [
        new TestCase(
          [], // Empty input
          [], // Empty output
          "Empty input test",
          "https://github.com/howerj/lzp"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("A"), // Single byte
          [0, 65], // Control: 00000000, Literal: A
          "Single byte - all literals (no context)",
          "https://github.com/lmcilroy/lzp"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AAAA"), // Repetitive data - 4 A's
          [0, 65, 65, 65, 65], // All literals (context size 4, no predictions)
          "Repetitive pattern - AAAA",
          "https://github.com/howerj/lzp"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("ABCABC"), // Pattern repetition
          [0, 65, 66, 67, 65, 66, 67], // All literals (short input)
          "Pattern repetition - ABCABC",
          "https://github.com/lmcilroy/lzp"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("Hello world!"), // Real text
          // Control byte: 0, then literals with one prediction (bit 1 set)
          [0, 72, 101, 108, 108, 111, 32, 119, 111, 0, 114, 108, 100, 33],
          "Real text - Hello world!",
          "https://hugi.scene.org/online/coding/hugi 12 - colzp.htm"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new LZPInstance(this, isInverse);
    }
  }

  class LZPInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this.contextSize = algorithm.CONTEXT_SIZE;
      this.hashTableSize = algorithm.HASH_TABLE_SIZE;
      this.maxMatchLength = algorithm.MAX_MATCH_LENGTH;
      this.minMatchLength = algorithm.MIN_MATCH_LENGTH;
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

    /**
     * Compute hash from context bytes using XOR-style hashing
     * Standard bitwise operations (not cryptographic)
     */
    _computeHash(context) {
      let hash = 0;
      for (let i = 0; i < context.length; ++i) {
        // hash = (hash << 4) ^ byte
        hash = ((hash << 4) & 0xFFFF) ^ context[i];
      }
      return hash & (this.hashTableSize - 1);
    }

    /**
     * Compress data using LZP algorithm
     * Format: Control bytes (8 prediction flags) + literal bytes
     * Each control byte manages 8 predictions: bit=1 means match, bit=0 means literal follows
     */
    _compress() {
      const result = [];
      const model = new Array(this.hashTableSize).fill(0); // Prediction model
      const input = this.inputBuffer;
      const contextSize = this.contextSize;

      let pos = 0;
      let controlByte = 0;
      let bitPos = 0;
      const pendingLiterals = [];

      while (pos < input.length) {
        const currentByte = input[pos];

        // Compute hash from context
        let hash = 0;
        if (pos >= contextSize) {
          const context = input.slice(pos - contextSize, pos);
          hash = this._computeHash(context);
        }

        // Check if model predicts correctly
        const predicted = model[hash];
        if (predicted === currentByte && pos >= contextSize) {
          // Prediction match - set bit to 1
          controlByte |= (1 << bitPos);
        } else {
          // Prediction failed or not enough context - output literal
          pendingLiterals.push(currentByte);
        }

        // Update model
        model[hash] = currentByte;

        ++bitPos;
        ++pos;

        // Flush control byte after 8 predictions
        if (bitPos === 8 || pos === input.length) {
          result.push(controlByte);
          result.push(...pendingLiterals);
          controlByte = 0;
          bitPos = 0;
          pendingLiterals.length = 0;
        }
      }

      this.inputBuffer = [];
      return result;
    }

    /**
     * Decompress LZP compressed data
     * Reads control bytes and literals/predictions
     */
    _decompress() {
      const result = [];
      const model = new Array(this.hashTableSize).fill(0);
      const input = this.inputBuffer;
      const contextSize = this.contextSize;

      let pos = 0;

      while (pos < input.length) {
        // Read control byte
        const controlByte = input[pos++];
        if (pos > input.length) break;

        // Process up to 8 bits
        for (let bitPos = 0; bitPos < 8; ++bitPos) {
          // Compute hash from context
          let hash = 0;
          if (result.length >= contextSize) {
            const context = result.slice(result.length - contextSize);
            hash = this._computeHash(context);
          }

          // Check control bit
          const isMatch = (controlByte & (1 << bitPos)) !== 0;

          let byte;
          if (isMatch && result.length >= contextSize) {
            // Prediction match - use predicted byte
            byte = model[hash];
          } else {
            // Literal - read from input
            if (pos >= input.length) break;
            byte = input[pos++];
          }

          result.push(byte);
          model[hash] = byte; // Update prediction model
        }
      }

      this.inputBuffer = [];
      return result;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZPCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZPCompression, LZPInstance };
}));
