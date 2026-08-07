/*
 * FastLZ Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * FastLZ - Small&portable byte-aligned LZ77 compression
 * By Ariya Hidayat (2007)
 *
 * Fast LZ77 compression with two optimization levels:
 * - Level 1: Ultra-fast with 8KB window, optimized for short data
 * - Level 2: Better compression with extended 64KB+ window
 *
 * Used in: Death Stranding, Godot Engine, Facebook HHVM, Apache Traffic Server,
 * Calligra Office, OSv, Netty, and many other production systems.
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

  class FastLZCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "FastLZ";
      this.description = "Portable byte-aligned LZ77 compression optimized for speed. Features two compression levels: Level 1 (8KB window, ultra-fast) and Level 2 (64KB+ window, better compression). Widely used in games, middleware, and embedded systems.";
      this.inventor = "Ariya Hidayat";
      this.year = 2007;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null; // Compression algorithm, not a security primitive
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.ID; // Indonesia (creator's nationality)

      // Algorithm constants matching FastLZ specification
      this.HASH_LOG = 13;
      this.HASH_SIZE = OpCodes.Shl32(1, this.HASH_LOG); // 8192
      this.HASH_MASK = this.HASH_SIZE - 1;

      // Distance limits
      this.MAX_L1_DISTANCE = 8192;
      this.MAX_L2_DISTANCE = 8191;
      this.MAX_FARDISTANCE = 65535 + this.MAX_L2_DISTANCE - 1;

      // Match constraints
      this.MAX_COPY = 32;  // Maximum literal run
      this.MAX_LEN = 264;  // Maximum match length (9 + 255)
      this.MIN_MATCH_LENGTH = 3;
      this.MAX_SHORT_MATCH = 8; // Matches up to this length use the 2-byte token

      // Documentation and references
      this.documentation = [
        new LinkItem("FastLZ Official Website", "https://ariya.github.io/FastLZ/"),
        new LinkItem("FastLZ GitHub Repository", "https://github.com/ariya/FastLZ"),
        new LinkItem("FastLZ Block Format Specification", "https://ariya.github.io/FastLZ/#block-format")
      ];

      this.references = [
        new LinkItem("FastLZ Source Code (fastlz.c)", "https://github.com/ariya/FastLZ/blob/master/fastlz.c"),
        new LinkItem("FastLZ Header (fastlz.h)", "https://github.com/ariya/FastLZ/blob/master/fastlz.h"),
        new LinkItem("LZ77 Algorithm - Wikipedia", "https://en.wikipedia.org/wiki/LZ77_and_LZ78")
      ];

      // Test vectors cross-checked byte-for-byte against CompressionWorkbench's
      // BB_FastLz building block (Compression.Core.Dictionary.FastLz), which is
      // the authoritative wire format: a 4-byte little-endian original-length
      // header followed by the FastLZ level-1 block stream.
      // Format: TestCase(uncompressed_input, expected_compressed_output, description, uri)
      this.tests = [
        new TestCase(
          [0x41, 0x42, 0x43], // Uncompressed: "ABC"
          [0x03, 0x00, 0x00, 0x00, 0x02, 0x41, 0x42, 0x43], // header(3) + literal run of 3 bytes
          "Literal run - 3 bytes (FastLZ spec example)",
          "https://ariya.github.io/FastLZ/#block-format"
        ),
        new TestCase(
          [0x44, 0x45], // Uncompressed: "DE"
          [0x02, 0x00, 0x00, 0x00, 0x01, 0x44, 0x45], // header(2) + literal run of 2 bytes
          "Literal run - 2 bytes (no match possible)",
          "https://ariya.github.io/FastLZ/#block-format"
        ),
        new TestCase(
          [0x44, 0x45, 0x44, 0x45, 0x44, 0x45, 0x44, 0x45, 0x44, 0x45, 0x44, 0x45], // 12 bytes: DEDEDEDE...
          [0x0C, 0x00, 0x00, 0x00, 0x01, 0x44, 0x45, 0xE0, 0x01, 0x01], // header(12) + literal DE + long match (len=10, dist=2)
          "Long match with repeating pattern (DEDEDEDE...)",
          "https://ariya.github.io/FastLZ/#block-format"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AAAA"), // "AAAA" - simple repetition
          [0x04, 0x00, 0x00, 0x00, 0x00, 0x41, 0x20, 0x00], // header(4) + literal A + short match (len=3, dist=1)
          "Simple repetition - AAAA",
          "https://github.com/ariya/FastLZ"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("ABCABC"), // "ABCABC" - pattern repetition
          [0x06, 0x00, 0x00, 0x00, 0x02, 0x41, 0x42, 0x43, 0x20, 0x02], // header(6) + literal ABC + short match (len=3, dist=3)
          "Pattern repetition - ABCABC",
          "https://github.com/ariya/FastLZ"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("ABCD"), // "ABCD" - no repetition
          [0x04, 0x00, 0x00, 0x00, 0x03, 0x41, 0x42, 0x43, 0x44], // header(4) + all literals
          "No repetition - worst case",
          "https://github.com/ariya/FastLZ"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new FastLZInstance(this, isInverse);
    }
  }

  /**
 * FastLZ cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class FastLZInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];

      // Compression parameters
      this._level = 1; // Default to level 1 (ultra-fast)

      // Constants from algorithm
      this.HASH_LOG = algorithm.HASH_LOG;
      this.HASH_SIZE = algorithm.HASH_SIZE;
      this.HASH_MASK = algorithm.HASH_MASK;
      this.MAX_L1_DISTANCE = algorithm.MAX_L1_DISTANCE;
      this.MAX_L2_DISTANCE = algorithm.MAX_L2_DISTANCE;
      this.MAX_FARDISTANCE = algorithm.MAX_FARDISTANCE;
      this.MAX_COPY = algorithm.MAX_COPY;
      this.MAX_LEN = algorithm.MAX_LEN;
      this.MIN_MATCH_LENGTH = algorithm.MIN_MATCH_LENGTH;
      this.MAX_SHORT_MATCH = algorithm.MAX_SHORT_MATCH;
    }

    // Compression level property (1 or 2)
    set level(value) {
      if (value !== 1 && value !== 2) {
        throw new Error("Invalid compression level. Must be 1 or 2.");
      }
      this._level = value;
    }

    get level() {
      return this._level;
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
      if (this.isInverse) {
        if (this.inputBuffer.length === 0) {
          return [];
        }
        return this._decompress();
      }

      // Compression always emits the 4-byte length header, even for empty
      // input (matching the CompressionWorkbench reference building block).
      return this._compress();
    }

    /**
     * FastLZ hash function: h = (v * 2654435769) right-shift (32 - HASH_LOG)
     * Uses golden ratio multiplier for good distribution
     */
    _hash(value) {
      // Multiply by golden ratio constant (2654435769 = 0x9E3779B9)
      const h = Math.imul(value&0xFFFFFF, 0x9E3779B9);
      return OpCodes.Shr32(h, (32 - this.HASH_LOG))&this.HASH_MASK;
    }

    /**
     * Read 3-byte sequence for hash calculation
     */
    _read24(data, pos) {
      if (pos + 2 >= data.length) return 0;
      return OpCodes.Shl32(data[pos], 16)|OpCodes.Shl32(data[pos + 1], 8)|data[pos + 2];
    }

    /**
     * Count matching bytes at two positions, up to maxLength
     */
    _matchLength(data, a, b, maxLength) {
      let len = 0;
      while (len < maxLength && data[a + len] === data[b + len]) {
        len++;
      }
      return len;
    }

    /**
     * FastLZ Level 1 compression - ultra-fast, 8KB window
     * Ported from CompressionWorkbench's FastLzCompressor (BB_FastLz) so the
     * wire format is byte-identical: single-candidate hash table (no chaining),
     * greedy matching, hash table refreshed across the whole matched span.
     */
    _compressLevel1() {
      const input = this.inputBuffer;
      const n = input.length;
      const output = [];
      if (n === 0) return output;

      const hashTable = new Int32Array(this.HASH_SIZE).fill(-1);

      let ip = 0; // Input position
      let anchor = 0; // Start of current literal run

      while (ip + this.MIN_MATCH_LENGTH <= n) {
        const hash = this._hash(this._read24(input, ip));
        const candidate = hashTable[hash];
        hashTable[hash] = ip;

        let matchLength = 0;
        if (candidate >= 0 &&
            input[candidate] === input[ip] &&
            input[candidate + 1] === input[ip + 1] &&
            input[candidate + 2] === input[ip + 2] &&
            ip - candidate <= this.MAX_L1_DISTANCE) {
          matchLength = this._matchLength(input, candidate, ip, Math.min(this.MAX_LEN, n - ip));
        }

        if (matchLength >= this.MIN_MATCH_LENGTH) {
          this._outputLiterals(output, input, anchor, ip - anchor);
          this._outputMatch(output, matchLength, ip - candidate);

          const matchEnd = ip + matchLength;
          ip++;
          while (ip < matchEnd) {
            if (ip + this.MIN_MATCH_LENGTH <= n) hashTable[this._hash(this._read24(input, ip))] = ip;
            ip++;
          }

          anchor = ip;
        } else {
          ip++;
        }
      }

      this._outputLiterals(output, input, anchor, n - anchor);
      return output;
    }

    /**
     * FastLZ Level 2 compression - CompressionWorkbench's reference building
     * block only exposes the level-1 block format, so level 2 mirrors it.
     */
    _compressLevel2() {
      return this._compressLevel1();
    }

    /**
     * Main compression dispatcher. Always prepends the 4-byte little-endian
     * original-length header used by the CompressionWorkbench building block.
     */
    _compress() {
      const originalLength = this.inputBuffer.length;
      const header = OpCodes.Unpack32LE(originalLength);
      const body = this._level === 2 ? this._compressLevel2() : this._compressLevel1();
      this.inputBuffer = [];
      return header.concat(body);
    }

    /**
     * Output literal run in FastLZ format
     * Format: [length-1] [byte1] [byte2] ... [byteN]
     * Length field: 0-31 represents 1-32 bytes
     */
    _outputLiterals(output, input, start, length) {
      let pos = start;
      let remaining = length;

      while (remaining > 0) {
        const chunkLen = Math.min(remaining, this.MAX_COPY);
        output.push(chunkLen - 1); // Length encoding: 0 = 1 byte, 31 = 32 bytes

        for (let i = 0; i < chunkLen; i++) {
          output.push(input[pos++]);
        }

        remaining -= chunkLen;
      }
    }

    /**
     * Output match token in FastLZ Level 1 format
     *
     * Short match (length 3-8):
     *   [(len-2 left-shift 5) OR right-shift(dist-1, 8)] [(dist-1) & 0xFF]
     *
     * Long match (length 9-264):
     *   [(7 left-shift 5) OR right-shift(dist-1, 8)] [(dist-1) & 0xFF] [len - 9]
     */
    _outputMatch(output, length, distance) {
      const encodedDistance = distance - 1;
      if (length <= this.MAX_SHORT_MATCH) {
        // Short match: 3-8 bytes
        const type = length - 2;
        output.push(OpCodes.Shl32(type, 5)|OpCodes.Shr32(encodedDistance, 8));
        output.push(OpCodes.ToByte(encodedDistance));
      } else {
        // Long match: 9-264 bytes
        output.push(OpCodes.Shl32(7, 5)|OpCodes.Shr32(encodedDistance, 8));
        output.push(OpCodes.ToByte(encodedDistance));
        output.push(length - 9); // Length byte: 0 = 9 bytes, 255 = 264 bytes
      }
    }

    /**
     * FastLZ decompression. Reads the 4-byte little-endian original-length
     * header written by _compress(), then decodes the level-1 block stream.
     */
    _decompress() {
      const input = this.inputBuffer;
      if (input.length < 4) {
        this.inputBuffer = [];
        return [];
      }

      const originalLength = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      if (originalLength === 0) {
        this.inputBuffer = [];
        return [];
      }

      const output = [];
      let ip = 4;

      while (output.length < originalLength) {
        const opcode = input[ip++];
        const type = OpCodes.Shr32(opcode, 5);

        if (type === 0) {
          // Literal run: copy (opcode + 1) bytes
          const litLen = (opcode&0x1F) + 1;
          for (let i = 0; i < litLen; i++) output.push(input[ip++]);
          continue;
        }

        const distHigh = opcode&0x1F;
        const distLow = input[ip++];
        const encodedDistance = OpCodes.Shl32(distHigh, 8)|distLow;

        let length;
        if (type === 7) {
          const extra = input[ip++];
          length = extra + 9; // Long match: 9-264 bytes
        } else {
          length = type + 2; // Short match: 3-8 bytes
        }

        const distance = encodedDistance + 1;
        const refPos = output.length - distance;
        for (let i = 0; i < length; i++) output.push(output[refPos + i]);
      }

      this.inputBuffer = [];
      return output;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new FastLZCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { FastLZCompression, FastLZInstance };
}));
