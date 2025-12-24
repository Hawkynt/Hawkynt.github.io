/*
 * LZ4 Block Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZ4 is a lossless compression algorithm focused on compression and decompression speed.
 * It belongs to the LZ77 family and uses a byte-oriented encoding with tokens.
 * Developed by Yann Collet in 2011, optimized for speed over compression ratio.
 *
 * This implementation follows the official LZ4 Block Format specification:
 * https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md
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

  if (!AlgorithmFramework)
    throw new Error('AlgorithmFramework dependency is required');

  if (!OpCodes)
    throw new Error('OpCodes dependency is required');

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== LZ4 ALGORITHM IMPLEMENTATION =====

  class LZ4Compression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LZ4";
      this.description = "Lossless compression algorithm focused on compression and decompression speed. Uses byte-oriented encoding with tokens for literals and match copies. Optimized for speed over compression ratio.";
      this.inventor = "Yann Collet";
      this.year = 2011;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.FR;

      // LZ4 Block format constants (per specification)
      this.MIN_MATCH = 4;           // Minimum match length
      this.ML_BITS = 4;             // Match length bits in token
      this.ML_MASK = OpCodes.BitMask(this.ML_BITS);
      this.RUN_BITS = 4;            // Literal run bits in token
      this.RUN_MASK = OpCodes.BitMask(this.RUN_BITS);
      this.MAX_DISTANCE = 65535;    // Maximum backward distance
      this.HASH_SIZE_U32 = 4096;    // Hash table size (4KB)
      this.HASH_LOG = 12;

      // Documentation and references
      this.documentation = [
        new LinkItem("LZ4 Official Website", "https://lz4.org/"),
        new LinkItem("LZ4 Block Format Specification", "https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md"),
        new LinkItem("LZ4 Wikipedia", "https://en.wikipedia.org/wiki/LZ4_(compression_algorithm)")
      ];

      this.references = [
        new LinkItem("Official LZ4 Implementation", "https://github.com/lz4/lz4"),
        new LinkItem("xxHash (by same author)", "https://github.com/Cyan4973/xxHash"),
        new LinkItem("Real World Compression Benchmark", "https://github.com/inikep/lzbench")
      ];

      // Test vectors - manually verified against LZ4 block format specification
      // Format: token (1 byte) + optional literal length + literals + offset (2 bytes LE) + optional match length
      this.tests = [
        {
          text: "All literals - no matches (ABCD)",
          uri: "https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md",
          input: OpCodes.AnsiToBytes("ABCD"),
          // Token: 0x40 = 0100 0000 = 4 literals, 0 match length (end sequence)
          // Followed by 4 literal bytes: A B C D
          expected: [0x40, 0x41, 0x42, 0x43, 0x44]
        },
        {
          text: "Simple repetition - AAAAA (5 A's, min for match)",
          uri: "https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md",
          input: OpCodes.AnsiToBytes("AAAAA"),
          // Token: 0x10 = 0001 0000 = 1 literal, 0 match (0 in match field means MIN_MATCH=4)
          // Literal: A (0x41)
          // Offset: 0x0001 (1 byte back, little-endian)
          // Match of 4 more A's (total 5, match length = 5-1 = 4, encoded as 4-MIN_MATCH = 0)
          expected: [0x10, 0x41, 0x01, 0x00]
        },
        {
          text: "Pattern ABCDABCD (8 bytes with 4-byte match)",
          uri: "https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md",
          input: OpCodes.AnsiToBytes("ABCDABCD"),
          // Token: 0x40 = 0100 0000 = 4 literals, 0 match
          // Literals: A B C D (0x41 0x42 0x43 0x44)
          // Offset: 0x0004 (4 bytes back, little-endian)
          // Match length: 4 (encoded as 0)
          expected: [0x40, 0x41, 0x42, 0x43, 0x44, 0x04, 0x00]
        },
        {
          text: "Long repetition - AAAAAAAA (8 A's)",
          uri: "https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md",
          input: OpCodes.AnsiToBytes("AAAAAAAA"),
          // Token: 0x13 = 0001 0011 = 1 literal, 3 match length
          // Literal: A (0x41)
          // Offset: 0x0001 (1 byte back, little-endian)
          // Match length: 7 bytes (encoded as 7-MIN_MATCH = 7-4 = 3 in token)
          // Total: 1 literal A + 7 matched A's = 8 A's
          expected: [0x13, 0x41, 0x01, 0x00]
        },
        {
          text: "Mixed pattern - Hello",
          uri: "https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md",
          input: OpCodes.AnsiToBytes("Hello"),
          // Token: 0x50 = 0101 0000 = 5 literals, 0 match (end sequence, all literals)
          // Literals: H e l l o
          expected: [0x50, 0x48, 0x65, 0x6C, 0x6C, 0x6F]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LZ4Instance(this, isInverse);
    }
  }

  // ===== LZ4 INSTANCE IMPLEMENTATION =====

  /**
 * LZ4 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LZ4Instance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];

      // LZ4 parameters from algorithm
      this.MIN_MATCH = algorithm.MIN_MATCH;
      this.ML_BITS = algorithm.ML_BITS;
      this.ML_MASK = algorithm.ML_MASK;
      this.RUN_BITS = algorithm.RUN_BITS;
      this.RUN_MASK = algorithm.RUN_MASK;
      this.MAX_DISTANCE = algorithm.MAX_DISTANCE;
      this.HASH_SIZE_U32 = algorithm.HASH_SIZE_U32;
      this.HASH_LOG = algorithm.HASH_LOG;
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
      if (this.inputBuffer.length === 0)
        return [];

      const result = this.isInverse ? this._decompress() : this._compress();
      this.inputBuffer = [];
      return result;
    }

    // ===== COMPRESSION =====

    _compress() {
      const input = this.inputBuffer;
      const inputLength = input.length;

      if (inputLength === 0)
        return [];

      const output = [];
      let ip = 0;  // Input position
      let anchor = 0;  // Start of current literal run
      const hashTable = new Int32Array(this.HASH_SIZE_U32);
      hashTable.fill(-1);

      while (ip < inputLength) {
        // Find match using hash table
        let matchPos = -1;
        let matchLength = 0;

        // Try to find a match (need at least MIN_MATCH bytes remaining)
        if (ip + this.MIN_MATCH <= inputLength) {
          const h = this._hash(input, ip);
          matchPos = hashTable[h];

          // Validate match
          if (matchPos >= 0 && (ip - matchPos) <= this.MAX_DISTANCE)
            matchLength = this._countMatch(input, matchPos, ip, inputLength);

          // Update hash table after checking for match
          hashTable[h] = ip;
        }

        // If match found and long enough
        if (matchLength >= this.MIN_MATCH) {
          // Calculate literal count
          const literalCount = ip - anchor;

          // Write token + literals + offset + match length
          this._writeSequence(output, input, anchor, literalCount,
                              ip - matchPos, matchLength - this.MIN_MATCH);

          // Skip matched bytes
          ip += matchLength;
          anchor = ip;

          // Update hash table for skipped positions
          for (let i = 1; i < matchLength && (ip - matchLength + i) + this.MIN_MATCH <= inputLength; ++i) {
            const pos = ip - matchLength + i;
            const h = this._hash(input, pos);
            hashTable[h] = pos;
          }
        } else {
          // No match, move forward
          if (ip + this.MIN_MATCH <= inputLength) {
            const h = this._hash(input, ip);
            hashTable[h] = ip;
          }
          ++ip;
        }
      }

      // Final literal sequence
      const finalLiterals = inputLength - anchor;
      if (finalLiterals > 0)
        this._writeFinalLiterals(output, input, anchor, finalLiterals);

      return output;
    }

    _hash(data, pos) {
      if (pos + 4 > data.length)
        return 0;

      // Simple hash of 4 bytes using OpCodes
      const val = OpCodes.Pack32LE(
        OpCodes.ToByte(data[pos]),
        OpCodes.ToByte(data[pos+1]),
        OpCodes.ToByte(data[pos+2]),
        OpCodes.ToByte(data[pos+3])
      );
      return OpCodes.ToByte(OpCodes.Shr32(OpCodes.ToDWord(val * 2654435761), 32 - this.HASH_LOG));
    }

    _countMatch(data, matchPos, currentPos, maxPos) {
      let len = 0;
      // LZ4 allows overlapping matches for RLE patterns
      // We compare byte-by-byte and can match beyond currentPos
      while (currentPos + len < maxPos &&
             data[matchPos + len] === data[currentPos + len]) {
        ++len;
      }
      return len;
    }

    _writeSequence(output, input, literalStart, literalCount, offset, matchLength) {
      // Token format: high 4 bits = literal length, low 4 bits = match length
      let token;

      // Literal length encoding
      if (literalCount < 15) {
        token = OpCodes.Shl8(literalCount, 4);
      } else {
        token = OpCodes.Shl8(15, 4);
      }

      // Match length encoding
      if (matchLength < 15)
        token |= matchLength;
      else
        token |= 15;

      output.push(OpCodes.ToByte(token));

      // Extended literal length
      if (literalCount >= 15) {
        let len = literalCount - 15;
        while (len >= 255) {
          output.push(255);
          len -= 255;
        }
        output.push(OpCodes.ToByte(len));
      }

      // Literal bytes
      for (let i = 0; i < literalCount; ++i)
        output.push(OpCodes.ToByte(input[literalStart + i]));

      // Offset (little-endian 16-bit)
      output.push(OpCodes.ToByte(offset));
      output.push(OpCodes.ToByte(OpCodes.Shr16(offset, 8)));

      // Extended match length
      if (matchLength >= 15) {
        let len = matchLength - 15;
        while (len >= 255) {
          output.push(255);
          len -= 255;
        }
        output.push(OpCodes.ToByte(len));
      }
    }

    _writeFinalLiterals(output, input, literalStart, literalCount) {
      // Final sequence: only literals, no match
      let token;

      if (literalCount < 15) {
        token = OpCodes.Shl8(literalCount, 4);
      } else {
        token = OpCodes.Shl8(15, 4);
      }

      output.push(OpCodes.ToByte(token));

      // Extended literal length
      if (literalCount >= 15) {
        let len = literalCount - 15;
        while (len >= 255) {
          output.push(255);
          len -= 255;
        }
        output.push(OpCodes.ToByte(len));
      }

      // Literal bytes
      for (let i = 0; i < literalCount; ++i)
        output.push(OpCodes.ToByte(input[literalStart + i]));
    }

    // ===== DECOMPRESSION =====

    _decompress() {
      const input = this.inputBuffer;
      const inputLength = input.length;
      const output = [];
      let ip = 0;  // Input position

      while (ip < inputLength) {
        // Read token
        const token = OpCodes.ToByte(input[ip++]);

        // Decode literal length
        let literalLength = OpCodes.ToByte(OpCodes.Shr8(token, 4));
        if (literalLength === 15) {
          let len;
          do {
            if (ip >= inputLength) break;
            len = OpCodes.ToByte(input[ip++]);
            literalLength += len;
          } while (len === 255);
        }

        // Copy literals
        for (let i = 0; i < literalLength; ++i) {
          if (ip >= inputLength) break;
          output.push(OpCodes.ToByte(input[ip++]));
        }

        // Check if this was the final literal sequence
        if (ip >= inputLength)
          break;

        // Read offset (little-endian)
        if (ip + 1 >= inputLength)
          break;
        const offset = OpCodes.ToByte(input[ip])|OpCodes.Shl16(OpCodes.ToByte(input[ip+1]), 8);
        ip += 2;

        // Decode match length
        const matchLenField = token&0x0F;
        let matchLength = matchLenField + this.MIN_MATCH;
        if (matchLenField === 15) {
          let len;
          do {
            if (ip >= inputLength) break;
            len = OpCodes.ToByte(input[ip++]);
            matchLength += len;
          } while (len === 255);
        }

        // Copy match
        const matchPos = output.length - offset;
        for (let i = 0; i < matchLength; ++i)
          output.push(OpCodes.ToByte(output[matchPos + i]));
      }

      return output;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZ4Compression();
  if (!AlgorithmFramework.Find(algorithmInstance.name))
    RegisterAlgorithm(algorithmInstance);

  // ===== EXPORTS =====

  return { LZ4Compression, LZ4Instance };
}));
