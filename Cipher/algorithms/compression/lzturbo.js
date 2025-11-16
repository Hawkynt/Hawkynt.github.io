/*
 * LZTURBO Educational Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Educational implementation inspired by ultra-fast LZ compression principles.
 * LZTURBO by powturbo is a proprietary closed-source algorithm - this is an
 * educational approximation demonstrating fast LZ77-style compression techniques.
 *
 * Features:
 * - Hash-based fast matching (similar to LZ4)
 * - Simple token encoding for literals and matches
 * - 16-bit offset support for efficient dictionary lookups
 * - Optimized for speed over compression ratio
 *
 * NOTE: This is NOT the official LZTURBO implementation. The actual LZTURBO
 * format is proprietary and unavailable. This implementation demonstrates
 * comparable fast compression concepts for educational purposes.
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

  // ===== LZTURBO EDUCATIONAL IMPLEMENTATION =====

  class LZTurboCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LZTURBO";
      this.description = "Educational implementation inspired by ultra-fast LZ compression principles. Demonstrates hash-based fast matching with simple token encoding optimized for speed. Based on concepts similar to LZ4 and other high-performance LZ codecs.";
      this.inventor = "powturbo (Original), Educational Implementation";
      this.year = 2013;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.PT; // Portugal (powturbo)

      // LZTURBO-Educational format constants
      this.MIN_MATCH = 4;           // Minimum match length
      this.MAX_MATCH = 18;          // Maximum match length (fits in 4 bits)
      this.MAX_LITERAL = 15;        // Maximum literal run in token (4 bits)
      this.MAX_DISTANCE = 65535;    // 16-bit offset
      this.HASH_SIZE = 8192;        // Hash table size (8K entries)
      this.HASH_LOG = 13;

      // Documentation and references
      this.documentation = [
        new LinkItem("powturbo Website", "https://sites.google.com/site/powturbo/"),
        new LinkItem("TurboBench Repository", "https://github.com/powturbo/TurboBench"),
        new LinkItem("Fast Compression Overview", "https://en.wikipedia.org/wiki/LZ4_(compression_algorithm)")
      ];

      this.references = [
        new LinkItem("LZ77 Foundation", "https://en.wikipedia.org/wiki/LZ77_and_LZ78"),
        new LinkItem("Fast Compression Techniques", "https://fastcompression.blogspot.com/"),
        new LinkItem("Compression Benchmarks", "https://github.com/inikep/lzbench")
      ];

      // Educational test vectors demonstrating the format
      // Format: Token (1 byte) + [literal bytes] + [offset 2 bytes LE] + [extra match length if needed]
      // Token: high 4 bits = literal count, low 4 bits = match length (0-14), 15 = end match
      this.tests = [
        {
          text: "Simple literals - ABCD (no matches)",
          uri: "Educational test vector",
          input: OpCodes.AnsiToBytes("ABCD"),
          // Token: 0x4F = 0100 1111 = 4 literals, 15=end flag (no match follows)
          // Literals: A B C D
          expected: [0x4F, 0x41, 0x42, 0x43, 0x44]
        },
        {
          text: "Simple repetition - AAAAA (5 A's)",
          uri: "Educational test vector",
          input: OpCodes.AnsiToBytes("AAAAA"),
          // Token: 0x10 = 0001 0000 = 1 literal, 0 match length (0 means MIN_MATCH=4)
          // Literal: A
          // Offset: 0x01 0x00 (1 byte back, little-endian)
          // Match: 4 more A's
          expected: [0x10, 0x41, 0x01, 0x00]
        },
        {
          text: "Pattern repetition - ABCDABCD (8 bytes, 4-byte match)",
          uri: "Educational test vector",
          input: OpCodes.AnsiToBytes("ABCDABCD"),
          // Token: 0x40 = 0100 0000 = 4 literals, 0 match (MIN_MATCH=4)
          // Literals: A B C D
          // Offset: 0x04 0x00 (4 bytes back, little-endian)
          // Match: 4 bytes (ABCD)
          expected: [0x40, 0x41, 0x42, 0x43, 0x44, 0x04, 0x00]
        },
        {
          text: "Long repetition - AAAAAAAA (8 A's)",
          uri: "Educational test vector",
          input: OpCodes.AnsiToBytes("AAAAAAAA"),
          // Token: 0x13 = 0001 0011 = 1 literal, 3 match length (MIN_MATCH + 3 = 7 total match)
          // Literal: A
          // Offset: 0x01 0x00 (1 byte back)
          expected: [0x13, 0x41, 0x01, 0x00]
        },
        {
          text: "No compression - Hello",
          uri: "Educational test vector",
          input: OpCodes.AnsiToBytes("Hello"),
          // Token: 0x5F = 0101 1111 = 5 literals, 15=end flag
          // Literals: H e l l o
          expected: [0x5F, 0x48, 0x65, 0x6C, 0x6C, 0x6F]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LZTurboInstance(this, isInverse);
    }
  }

  // ===== LZTURBO INSTANCE IMPLEMENTATION =====

  /**
 * LZTurbo cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LZTurboInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];

      // LZTURBO parameters from algorithm
      this.MIN_MATCH = algorithm.MIN_MATCH;
      this.MAX_MATCH = algorithm.MAX_MATCH;
      this.MAX_LITERAL = algorithm.MAX_LITERAL;
      this.MAX_DISTANCE = algorithm.MAX_DISTANCE;
      this.HASH_SIZE = algorithm.HASH_SIZE;
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
      const hashTable = new Int32Array(this.HASH_SIZE);
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

          // Update hash table
          hashTable[h] = ip;
        }

        // If match found and long enough
        if (matchLength >= this.MIN_MATCH) {
          // Calculate literal count
          const literalCount = ip - anchor;

          // Write sequence (literals + match)
          this._writeSequence(output, input, anchor, literalCount,
                              ip - matchPos, matchLength - this.MIN_MATCH, false);

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
          ++ip;
        }
      }

      // Final literal sequence (if any remaining)
      const finalLiterals = inputLength - anchor;
      if (finalLiterals > 0)
        this._writeFinalLiterals(output, input, anchor, finalLiterals);

      return output;
    }

    _hash(data, pos) {
      if (pos + 4 > data.length)
        return 0;

      // Fast hash of 4 bytes using OpCodes
      const val = OpCodes.Pack32LE(
        OpCodes.ToByte(data[pos]),
        OpCodes.ToByte(data[pos+1]),
        OpCodes.ToByte(data[pos+2]),
        OpCodes.ToByte(data[pos+3])
      );

      // Simple multiplicative hash
      return OpCodes.ToByte(OpCodes.Shr32(OpCodes.ToDWord(val * 2654435761), 32 - this.HASH_LOG));
    }

    _countMatch(data, matchPos, currentPos, maxPos) {
      let len = 0;
      const maxLen = Math.min(this.MAX_MATCH + this.MIN_MATCH, maxPos - currentPos);

      // Count matching bytes (allow overlapping for RLE)
      while (len < maxLen &&
             data[matchPos + len] === data[currentPos + len]) {
        ++len;
      }
      return len;
    }

    _writeSequence(output, input, literalStart, literalCount, offset, matchLength, isEnd) {
      // Token format: high 4 bits = literal length (0-15), low 4 bits = match info
      // Match info: 0-14 = match length beyond MIN_MATCH, 15 = end flag (no offset follows)
      // Note: isEnd parameter is not used - we always write the match data

      // Process literals in chunks if > 15
      let remainingLiterals = literalCount;

      while (remainingLiterals > this.MAX_LITERAL) {
        // Full literal chunk (15 literals, no match)
        let token = OpCodes.Shl8(this.MAX_LITERAL, 4) | 0x0F; // 15 literals, end flag
        output.push(OpCodes.ToByte(token));

        // Write 15 literal bytes
        for (let i = 0; i < this.MAX_LITERAL; ++i)
          output.push(OpCodes.ToByte(input[literalStart + i]));

        literalStart += this.MAX_LITERAL;
        remainingLiterals -= this.MAX_LITERAL;
      }

      // Write sequence: literals + match
      const matchField = Math.min(matchLength, 14);
      const token = OpCodes.Shl8(remainingLiterals, 4) | matchField;
      output.push(OpCodes.ToByte(token));

      // Write remaining literals
      for (let i = 0; i < remainingLiterals; ++i)
        output.push(OpCodes.ToByte(input[literalStart + i]));

      // Write offset (little-endian 16-bit)
      output.push(OpCodes.ToByte(offset));
      output.push(OpCodes.ToByte(OpCodes.Shr16(offset, 8)));

      // Extended match length if needed
      if (matchLength >= 15) {
        let extraLen = matchLength - 14;
        while (extraLen >= 255) {
          output.push(255);
          extraLen -= 255;
        }
        output.push(OpCodes.ToByte(extraLen));
      }
    }

    _writeFinalLiterals(output, input, literalStart, literalCount) {
      // Write only literals with end flag
      while (literalCount > this.MAX_LITERAL) {
        // Full chunk
        let token = OpCodes.Shl8(this.MAX_LITERAL, 4) | 0x0F;
        output.push(OpCodes.ToByte(token));

        for (let i = 0; i < this.MAX_LITERAL; ++i)
          output.push(OpCodes.ToByte(input[literalStart + i]));

        literalStart += this.MAX_LITERAL;
        literalCount -= this.MAX_LITERAL;
      }

      // Final chunk
      let token = OpCodes.Shl8(literalCount, 4) | 0x0F;
      output.push(OpCodes.ToByte(token));

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

        // Decode literal count (high 4 bits)
        const literalCount = OpCodes.ToByte(OpCodes.Shr8(token, 4));

        // Decode match info (low 4 bits) - simple masking
        const matchField = token&0x0F;

        // Copy literals
        for (let i = 0; i < literalCount; ++i) {
          if (ip >= inputLength) break;
          output.push(OpCodes.ToByte(input[ip++]));
        }

        // Check if end flag (15 means no match follows, continue to next token)
        if (matchField === 15)
          continue;

        // Read offset (little-endian 16-bit)
        if (ip + 1 >= inputLength)
          break;
        const offset = OpCodes.ToByte(input[ip]) | OpCodes.Shl16(OpCodes.ToByte(input[ip+1]), 8);
        ip += 2;

        // Decode match length
        let matchLength = matchField + this.MIN_MATCH;

        // Extended match length if matchField was 14
        if (matchField === 14) {
          let extraLen;
          do {
            if (ip >= inputLength) break;
            extraLen = OpCodes.ToByte(input[ip++]);
            matchLength += extraLen;
          } while (extraLen === 255);
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

  const algorithmInstance = new LZTurboCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name))
    RegisterAlgorithm(algorithmInstance);

  // ===== EXPORTS =====

  return { LZTurboCompression, LZTurboInstance };
}));
