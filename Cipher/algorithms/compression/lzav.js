/*
 * LZAV Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZAV - Fast general-purpose in-memory LZ77 data compression
 * Based on specification from https://github.com/avaneev/lzav
 * Educational implementation focusing on core algorithm concepts
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, LinkItem } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class LZAVCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "LZAV";
      this.description = "Fast general-purpose in-memory LZ77 compression algorithm. Achieves 480-600 MB/s compression and 2800-3800 MB/s decompression with better ratios than LZ4. Educational implementation of the hash-table-based approach.";
      this.inventor = "Aleksey Vaneev";
      this.year = 2023;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based (LZ77)";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU; // Russia

      this.documentation = [
        new LinkItem("LZAV GitHub Repository", "https://github.com/avaneev/lzav"),
        new LinkItem("LZAV Performance Benchmarks", "https://github.com/avaneev/lzav#benchmark"),
        new LinkItem("LZ77 Algorithm", "https://en.wikipedia.org/wiki/LZ77_and_LZ78")
      ];

      this.references = [
        new LinkItem("LZAV Source Code", "https://github.com/avaneev/lzav/blob/main/lzav.h"),
        new LinkItem("Compression Benchmark", "https://github.com/inikep/lzbench")
      ];

      // Test vectors - educational implementation
      this.tests = [
        {
          text: "Empty input",
          uri: "https://github.com/avaneev/lzav",
          input: [],
          expected: []
        },
        {
          text: "Single byte",
          uri: "https://github.com/avaneev/lzav",
          input: OpCodes.AnsiToBytes("A")
          // Round-trip only - format may vary
        },
        {
          text: "Simple repetition - AAAA",
          uri: "https://github.com/avaneev/lzav",
          input: OpCodes.AnsiToBytes("AAAA")
          // Round-trip only
        },
        {
          text: "Pattern repetition - ABCABC",
          uri: "https://github.com/avaneev/lzav",
          input: OpCodes.AnsiToBytes("ABCABC")
          // Round-trip only
        },
        {
          text: "Real text - Hello World",
          uri: "https://github.com/avaneev/lzav",
          input: OpCodes.AnsiToBytes("Hello World!")
          // Round-trip only
        },
        {
          text: "Highly repetitive - 300x 'a' (exercises self-referential matches and match-length wrap-around)",
          uri: "https://github.com/avaneev/lzav",
          input: new Array(300).fill(0x61)
          // Round-trip only
        },
        {
          text: "Alternating pattern - 200x 'ab' (exercises match/literal-run boundary handling)",
          uri: "https://github.com/avaneev/lzav",
          input: (() => { const a = []; for (let i = 0; i < 400; ++i) a.push(i % 2 ? 0x62 : 0x61); return a; })()
        },
        {
          text: "Binary/pseudo-random sample (exercises literal bytes with the high bit set)",
          uri: "https://github.com/avaneev/lzav",
          input: (() => {
            let seed = 0x2A2A2A2A, a = [];
            for (let i = 0; i < 256; ++i) { seed = OpCodes.AndN(seed * 1103515245 + 12345, 0x7fffffff); a.push(OpCodes.AndN(seed, 0xFF)); }
            return a;
          })()
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LZAVInstance(this, isInverse);
    }
  }

  // LZAV instance - educational implementation
  /**
 * LZAV cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LZAVInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];

      // LZAV parameters (educational simplified version)
      this.HASH_TABLE_SIZE = 8192; // 8K hash table
      this.MIN_MATCH = 4;          // 4-byte minimum match
      this.MAX_MATCH = 0x7F;       // Maximum match length - 7 bits (top bit of the
                                    // token byte is reserved for the match/literal-run flag)
      this.WINDOW_SIZE = 32768;    // 32KB window (simplified from 8MB)
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
        this.inputBuffer = [];
        return [];
      }

      try {
        let result;
        if (this.isInverse) {
          result = this._decompress(this.inputBuffer);
        } else {
          result = this._compress(this.inputBuffer);
        }
        this.inputBuffer = [];
        return result;
      } catch (error) {
        this.inputBuffer = [];
        throw new Error(`LZAV ${this.isInverse ? 'decompression' : 'compression'} failed: ${error.message}`);
      }
    }

    _compress(input) {
      if (input.length === 0) return [];

      const output = [];
      const hashTable = new Array(this.HASH_TABLE_SIZE).fill(-1);
      let pos = 0;
      let litStart = 0;

      // Flush any pending literal bytes [litStart, end) as one or more
      // count-prefixed literal runs (run length 1..127, top bit clear so it
      // can never be confused with a match token).
      const flushLiterals = (end) => {
        let start = litStart;
        while (start < end) {
          const chunk = Math.min(this.MAX_MATCH, end - start);
          output.push(OpCodes.ToByte(chunk));
          for (let i = 0; i < chunk; i++) output.push(input[start + i]);
          start += chunk;
        }
      };

      while (pos < input.length) {
        let bestLen = 0;
        let bestDist = 0;

        // Find longest match using hash table
        if (pos + this.MIN_MATCH <= input.length) {
          const hash = this._hash(input, pos);
          const matchPos = hashTable[hash];

          if (matchPos >= 0 && matchPos < pos && (pos - matchPos) <= this.WINDOW_SIZE) {
            const maxLen = Math.min(this.MAX_MATCH, input.length - pos);
            let len = 0;

            while (len < maxLen && input[matchPos + len] === input[pos + len]) {
              len++;
            }

            if (len >= this.MIN_MATCH) {
              bestLen = len;
              bestDist = pos - matchPos;
            }
          }

          // Update hash table
          hashTable[hash] = pos;
        }

        if (bestLen >= this.MIN_MATCH) {
          // Encode match: [0x80|length] [distance_low] [distance_high]
          flushLiterals(pos);
          output.push(OpCodes.ToByte(OpCodes.OrN(0x80, bestLen)));
          const [low, high] = OpCodes.Unpack16LE(bestDist);
          output.push(low);
          output.push(high);
          pos += bestLen;
          litStart = pos;
        } else {
          pos++;
        }
      }

      flushLiterals(input.length);

      return output;
    }

    _decompress(input) {
      const output = [];
      let pos = 0;

      while (pos < input.length) {
        const byte = input[pos++];

        if (OpCodes.AndN(byte, 0x80) === 0x80) {
          // Match reference
          const length = OpCodes.AndN(byte, 0x7F);
          const distLow = input[pos++];
          const distHigh = input[pos++];
          const distance = OpCodes.Pack16LE(distLow, distHigh);

          // Copy from history. sourcePos is recomputed every iteration
          // (rather than offset by i) because output.length itself already
          // advances by one on every push - this is what makes overlapping
          // self-referential copies (distance < length) work correctly.
          for (let i = 0; i < length; i++) {
            const sourcePos = output.length - distance;
            output.push(output[sourcePos]);
          }
        } else {
          // Literal run: byte itself is the run length (never 0)
          const runLength = byte;
          for (let i = 0; i < runLength; i++) {
            output.push(input[pos++]);
          }
        }
      }

      return output;
    }

    _hash(input, pos) {
      if (pos + 3 >= input.length) return 0;

      // Simple multiplicative hash (educational version)
      const b0 = input[pos];
      const b1 = input[pos + 1];
      const b2 = input[pos + 2];
      const b3 = input[pos + 3];

      const value = OpCodes.Pack32LE(b0, b1, b2, b3);
      const prime = 2654435761; // Knuth's multiplicative hash prime
      const hash = OpCodes.AndN(value * prime, this.HASH_TABLE_SIZE - 1);

      return hash;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZAVCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { LZAVCompression, LZAVInstance };
}));
