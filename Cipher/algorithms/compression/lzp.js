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
   * @returns {LZPInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LZPInstance(this, isInverse);
    }
  }

  /**
 * LZP cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class LZPInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {LZPCompression} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {int32} */
      this.order = algorithm.ORDER;
      /** @type {uint32} */
      this.hashSize = OpCodes.Shl32(1, algorithm.HASH_BITS);
    }


    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      /** @type {uint8[]} */
      let result;
      if (this.isInverse) {
        result = this._decompress();
      } else {
        result = this._compress();
      }
      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;
      return result;
    }

    /**
     * 20-bit FNV-1a hash of the `order` bytes immediately before `pos`,
     * matching the reference encoder's ComputeHash exactly (32-bit
     * unsigned offset basis/prime, masked down to the hash table width).
     * @param {uint8[]} data - Bytes
     * @param {int32} pos - Position after the context
     * @param {int32} order - Context length
     * @returns {uint32} Hash table index
     */
    _computeHash(data, pos, order) {
      /** @type {uint32} */
      let h = 2166136261;
      for (let i = pos - order; i < pos; ++i) {
        h = OpCodes.Xor32(h, data[i]);
        h = OpCodes.Mul32(h, 16777619);
      }
      return OpCodes.And32(h, this.hashSize - 1);
    }

    /**
     * Compress: 4-byte LE original size, the order byte, then groups of a
     * flag byte (bit set = predicted correctly) followed by the literals.
     * @returns {uint8[]} Compressed bytes
     */
    _compress() {
      /** @type {uint8[]} */
      const input = this.inputBuffer;
      /** @type {int32} */
      const n = input.length;
      /** @type {uint8[]} */
      const result = OpCodes.Unpack32LE(n);
      result.push(this.order);
      if (n === 0) {
        return result;
      }

      /** @type {uint8[]} */
      const hashTable = new Uint8Array(this.hashSize);
      /** @type {int32} */
      let pos = 0;

      while (pos < n) {
        /** @type {uint32} */
        let flags = 0;
        /** @type {uint8[]} */
        const literals = [];
        /** @type {int32} */
        const count = Math.min(8, n - pos);

        for (let bit = 0; bit < count; ++bit) {
          /** @type {uint8} */
          const current = input[pos];

          if (pos < this.order) {
            literals.push(current);
            ++pos;
            continue;
          }

          /** @type {uint32} */
          const hash = this._computeHash(input, pos, this.order);
          /** @type {uint8} */
          const predicted = hashTable[hash];

          if (predicted === current) {
            flags = OpCodes.SetBit(flags, bit, true);
          } else {
            literals.push(current);
          }

          hashTable[hash] = current;
          ++pos;
        }

        result.push(flags);
        for (let i = 0; i < literals.length; ++i) {
          result.push(literals[i]);
        }
      }

      return result;
    }

    /**
     * Decompress the format written by _compress()
     * @returns {uint8[]} Original bytes
     */
    _decompress() {
      /** @type {uint8[]} */
      const input = this.inputBuffer;
      if (input.length < 5) {
        throw new Error("LZP compressed data is too short (missing header).");
      }

      /** @type {uint32} */
      const originalSize = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      /** @type {int32} */
      const order = input[4];
      if (originalSize === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      /** @type {uint8[]} */
      const hashTable = new Uint8Array(this.hashSize);
      /** @type {uint8[]} */
      const output = new Array(originalSize);
      /** @type {int32} */
      let srcPos = 5;
      /** @type {int32} */
      let dstPos = 0;

      while (dstPos < originalSize) {
        if (srcPos >= input.length) {
          throw new Error("Unexpected end of LZP compressed data.");
        }

        /** @type {uint8} */
        const flags = input[srcPos++];
        /** @type {int32} */
        const count = Math.min(8, OpCodes.Sub32(originalSize, dstPos));

        for (let bit = 0; bit < count; ++bit) {
          /** @type {uint8} */
          let byte = 0;

          if (dstPos < order) {
            if (srcPos >= input.length) {
              throw new Error("Unexpected end of LZP compressed data.");
            }
            byte = input[srcPos++];
          } else {
            /** @type {uint32} */
            const hash = this._computeHash(output, dstPos, order);
            /** @type {boolean} */
            const isMatch = OpCodes.GetBit(flags, bit);

            if (isMatch) {
              byte = hashTable[hash];
            } else {
              if (srcPos >= input.length) {
                throw new Error("Unexpected end of LZP compressed data.");
              }
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
