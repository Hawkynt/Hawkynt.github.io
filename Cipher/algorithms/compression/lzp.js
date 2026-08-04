/*
 * LZP (Lempel-Ziv with Prediction) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZP combines PPM-style context modeling with LZ77-style string matching.
 * A hash of the `order` bytes preceding each position predicts the next
 * byte; if the prediction is right, only a flag bit is emitted, otherwise
 * the actual byte follows inline. This mirrors the reference
 * CompressionWorkbench encoder byte-for-byte:
 *
 *   <Stream> := <size:4 LE> <order:1> [<Group>]*
 *   <Group>  := <flags:1> [<literal byte>]*   (up to 8 decisions per group;
 *                                              flag bit i = 1 -> prediction
 *                                              hit, no literal byte emitted)
 *
 * The context hash is a 20-bit FNV-1a hash (offset basis 2166136261, prime
 * 16777619) of the `order` bytes immediately before the current position,
 * mapping into a 2^20-entry table of predicted byte values. The first
 * `order` positions of the stream have no context and are always literals.
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

      // Configuration parameters (matches CompressionWorkbench's BB_Lzp defaults)
      this.ORDER = 3;                  // Number of preceding bytes used as context
      this.HASH_BITS = 20;             // 20-bit FNV-1a hash table (2^20 entries)

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
      // Format: 4-byte LE original size + 1-byte order, then per-group flag
      // bytes (bit i = 1 -> prediction hit) followed by that group's literals.
      // With order 3, the first 3 positions of every stream are always literal.
      this.tests = [
        new TestCase(
          [], // Empty input
          [0, 0, 0, 0, 3], // Header only: size 0, order 3
          "Empty input test",
          "https://github.com/howerj/lzp"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("A"), // Single byte
          [1, 0, 0, 0, 3, 0, 65], // size=1, order=3, flags=0, literal A
          "Single byte - all literals (no context)",
          "https://github.com/lmcilroy/lzp"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AAAA"), // Repetitive data - 4 A's
          [4, 0, 0, 0, 3, 0, 65, 65, 65, 65], // all literals (order 3, no predictions yet)
          "Repetitive pattern - AAAA",
          "https://github.com/howerj/lzp"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("ABCABC"), // Pattern repetition
          [6, 0, 0, 0, 3, 0, 65, 66, 67, 65, 66, 67], // all literals (short input)
          "Pattern repetition - ABCABC",
          "https://github.com/lmcilroy/lzp"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("Hello world!"), // Real text
          // size=12, order=3, flags=0 (8 literals), flags=0 (4 more literals) - too
          // short/varied a sample for any context hash to repeat a prediction
          [12, 0, 0, 0, 3, 0, 72, 101, 108, 108, 111, 32, 119, 111, 0, 114, 108, 100, 33],
          "Real text - Hello world!",
          "https://hugi.scene.org/online/coding/hugi 12 - colzp.htm"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LZPInstance(this, isInverse);
    }
  }

  /**
 * LZP cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LZPInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this.order = algorithm.ORDER;
      this.hashSize = OpCodes.Shl32(1, algorithm.HASH_BITS);
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      const result = this.isInverse ? this._decompress() : this._compress();
      this.inputBuffer = [];
      return result;
    }

    /**
     * 20-bit FNV-1a hash of the `order` bytes immediately before `pos`,
     * matching the reference encoder's ComputeHash exactly (32-bit
     * unsigned offset basis/prime, masked down to the hash table width).
     */
    _computeHash(data, pos, order) {
      let h = 2166136261;
      for (let i = pos - order; i < pos; ++i) {
        h = OpCodes.Xor32(h, data[i]);
        h = OpCodes.Mul32(h, 16777619);
      }
      return OpCodes.And32(h, this.hashSize - 1);
    }

    /**
     * Compress data using LZP.
     * Format: 4-byte LE original size + 1-byte order, then groups of up to
     * 8 decisions: a flag byte (bit i = 1 -> prediction hit) followed by
     * the literal bytes for any misses in that group, in order.
     */
    _compress() {
      const input = this.inputBuffer;
      const n = input.length;
      const header = OpCodes.Unpack32LE(n).concat([this.order]);
      if (n === 0) return header;

      const hashTable = new Uint8Array(this.hashSize);
      const result = header;
      let pos = 0;

      while (pos < n) {
        let flags = 0;
        const literals = [];
        const count = Math.min(8, n - pos);

        for (let bit = 0; bit < count; ++bit) {
          const current = input[pos];

          if (pos < this.order) {
            literals.push(current);
            ++pos;
            continue;
          }

          const hash = this._computeHash(input, pos, this.order);
          const predicted = hashTable[hash];

          if (predicted === current)
            flags = OpCodes.SetBit(flags, bit, true);
          else
            literals.push(current);

          hashTable[hash] = current;
          ++pos;
        }

        result.push(flags);
        for (let i = 0; i < literals.length; ++i) result.push(literals[i]);
      }

      return result;
    }

    /**
     * Decompress LZP compressed data.
     */
    _decompress() {
      const input = this.inputBuffer;
      if (input.length < 5)
        throw new Error("LZP compressed data is too short (missing header).");

      const originalSize = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      const order = input[4];
      if (originalSize === 0) return [];

      const hashTable = new Uint8Array(this.hashSize);
      const output = new Array(originalSize);
      let srcPos = 5, dstPos = 0;

      while (dstPos < originalSize) {
        if (srcPos >= input.length)
          throw new Error("Unexpected end of LZP compressed data.");

        const flags = input[srcPos++];
        const count = Math.min(8, originalSize - dstPos);

        for (let bit = 0; bit < count; ++bit) {
          let byte;

          if (dstPos < order) {
            if (srcPos >= input.length)
              throw new Error("Unexpected end of LZP compressed data.");
            byte = input[srcPos++];
          } else {
            const hash = this._computeHash(output, dstPos, order);
            const isMatch = OpCodes.GetBit(flags, bit);

            if (isMatch) {
              byte = hashTable[hash];
            } else {
              if (srcPos >= input.length)
                throw new Error("Unexpected end of LZP compressed data.");
              byte = input[srcPos++];
            }

            hashTable[hash] = byte;
          }

          output[dstPos] = byte;
          ++dstPos;
        }
      }

      return output;
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
