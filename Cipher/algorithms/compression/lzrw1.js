/*
 * LZRW1 (Lempel-Ziv Ross Williams 1) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZRW1 is an extremely fast LZ77-based compression algorithm created by Ross Williams.
 * Features hash-based dictionary matching with 4096-entry hash table.
 * Uses control bytes for 16-item groups (literal vs copy items).
 * Match length: 3-16 bytes, offset: 1-4095 bytes.
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
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class LZRW1Compression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LZRW1";
      this.description = "Extremely fast LZ77-based compression algorithm with hash table dictionary matching. Uses control bytes for 16-item groups to indicate literal or copy items. Designed for real-time compression with minimal overhead.";
      this.inventor = "Ross N. Williams";
      this.year = 1991;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.AU;

      // LZRW1 constants
      this.HASH_TABLE_SIZE = 4096;    // 2^12 hash table entries
      this.MIN_MATCH_LENGTH = 3;      // Minimum match length
      this.MAX_MATCH_LENGTH = 18;     // Maximum match length (3 + 15)
      this.MAX_OFFSET = 4095;         // Maximum backward offset
      this.ITEMS_PER_GROUP = 16;      // Items per control byte

      // Documentation and references
      this.documentation = [
        new LinkItem("LZRW1 Paper", "http://ross.net/compression/lzrw1.html"),
        new LinkItem("Data Compression Conference 1991", "https://ieeexplore.ieee.org/xpl/conhome/1000160/all-proceedings"),
        new LinkItem("LZRW Wikipedia", "https://en.wikipedia.org/wiki/LZRW")
      ];

      this.references = [
        new LinkItem("Ross Williams Compression", "http://ross.net/compression/"),
        new LinkItem("LZRW Implementation Analysis", "https://www.heliontech.com/comp_info.htm"),
        new LinkItem("lzbench LZRW Collection", "https://github.com/inikep/lzbench")
      ];

      // Test vectors - validated through round-trip compression/decompression
      // Format: 16-bit control word (big-endian) + items (literal bytes or 16-bit copy words)
      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes("ABCD"),
          [0, 0, 65, 66, 67, 68], // Control word 0x0000 (all literals) + 4 literal bytes
          "No repetition - all literals",
          "Round-trip validated"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AAAAAAAAAAAAAAAA"), // 16 A's
          [0, 2, 65, 192, 0], // Control 0x0002 (bit 1 set): literal A, then copy 15 bytes from offset 1
          "High repetition - 16 identical characters",
          "Round-trip validated"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("ABCABCABCABC"), // 12 bytes: ABC repeated 4 times
          [0, 8, 65, 66, 67, 96, 2], // Control 0x0008 (bit 3 set): ABC literals, then copy 9 bytes
          "Pattern repetition - ABC repeated 4 times",
          "Round-trip validated"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("The quick brown fox"),
          [0, 0, 84, 104, 101, 32, 113, 117, 105, 99, 107, 32, 98, 114, 111, 119, 110, 32, 0, 0, 102, 111, 120],
          "Real text compression - English phrase",
          "Round-trip validated"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LZRW1Instance(this, isInverse);
    }
  }

  /**
 * LZRW1 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LZRW1Instance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
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

    /**
     * Hash function for 3-byte sequences
     * Uses simple XOR-shift hash for speed
     */
    _hash(p0, p1, p2) {
      const h = (OpCodes.Shl16(p0, 8) ^ OpCodes.Shl16(p1, 4) ^ p2) & 0xFFF;
      return h;
    }

    /**
     * Compress data using LZRW1 algorithm
     */
    _compress() {
      const input = this.inputBuffer;
      const result = [];

      // Hash table stores positions of 3-byte sequences
      const hashTable = new Array(this.algorithm.HASH_TABLE_SIZE).fill(-1);

      let pos = 0;

      while (pos < input.length) {
        // Process items in groups of 16 for control word (16 bits)
        const controlWordPos = result.length;
        result.push(0, 0); // Placeholder for 16-bit control word
        let controlWord = 0;
        let itemsInGroup = 0;

        while (itemsInGroup < this.algorithm.ITEMS_PER_GROUP && pos < input.length) {
          let matchFound = false;
          let matchLength = 0;
          let matchOffset = 0;

          // Try to find a match if we have at least 3 bytes remaining
          if (pos + this.algorithm.MIN_MATCH_LENGTH - 1 < input.length) {
            const p0 = input[pos];
            const p1 = input[pos + 1] || 0;
            const p2 = input[pos + 2] || 0;

            // Only try to match if we actually have 3 bytes
            if (pos + this.algorithm.MIN_MATCH_LENGTH <= input.length) {
              const hashValue = this._hash(p0, p1, p2);
              const hashPos = hashTable[hashValue];

              // Check if hash entry is valid and within range
              if (hashPos >= 0 && pos - hashPos <= this.algorithm.MAX_OFFSET) {
                // Calculate match length
                let len = 0;
                const maxLen = Math.min(
                  this.algorithm.MAX_MATCH_LENGTH,
                  input.length - pos
                );

                while (len < maxLen && input[hashPos + len] === input[pos + len]) {
                  len++;
                }

                if (len >= this.algorithm.MIN_MATCH_LENGTH) {
                  matchFound = true;
                  matchLength = len;
                  matchOffset = pos - hashPos;
                }
              }

              // Update hash table with current position
              hashTable[hashValue] = pos;
            }
          }

          if (matchFound) {
            // Set control bit for copy item
            controlWord |= OpCodes.Shl16(1, itemsInGroup);

            // Encode copy item: 16-bit word
            // High 4 bits: length - 3 (0-15 represents 3-18 bytes)
            // Low 12 bits: offset - 1 (0-4094 represents 1-4095)
            const lengthCode = (matchLength - this.algorithm.MIN_MATCH_LENGTH) & 0x0F;
            const offsetCode = (matchOffset - 1) & 0x0FFF;
            const copyWord = OpCodes.Shl16(lengthCode, 12) | offsetCode;

            result.push(OpCodes.Shr16(copyWord, 8) & 0xFF);
            result.push(copyWord & 0xFF);

            pos += matchLength;
          } else {
            // Literal byte (control bit already 0)
            result.push(input[pos]);
            pos++;
          }

          itemsInGroup++;
        }

        // Write 16-bit control word (big-endian)
        result[controlWordPos] = OpCodes.Shr16(controlWord, 8) & 0xFF;
        result[controlWordPos + 1] = controlWord & 0xFF;
      }

      this.inputBuffer = [];
      return result;
    }

    /**
     * Decompress LZRW1 compressed data
     */
    _decompress() {
      const input = this.inputBuffer;
      const result = [];
      let pos = 0;

      while (pos < input.length) {
        // Read 16-bit control word (big-endian)
        if (pos + 1 >= input.length) break;
        const controlWord = OpCodes.Pack16BE(input[pos], input[pos + 1]);
        pos += 2;

        // Process up to 16 items based on control word
        for (let i = 0; i < this.algorithm.ITEMS_PER_GROUP && pos < input.length; i++) {
          const isCopyItem = (controlWord & OpCodes.Shl16(1, i)) !== 0;

          if (isCopyItem) {
            // Copy item: read 16-bit word
            if (pos + 1 >= input.length) break;

            const copyWord = OpCodes.Pack16BE(input[pos], input[pos + 1]);
            pos += 2;

            const length = (OpCodes.Shr16(copyWord, 12) & 0x0F) + this.algorithm.MIN_MATCH_LENGTH;
            const offset = (copyWord & 0x0FFF) + 1;

            // Copy bytes from history
            const copyStart = result.length - offset;
            for (let j = 0; j < length; j++) {
              if (copyStart + j >= 0 && copyStart + j < result.length) {
                result.push(result[copyStart + j]);
              } else {
                // Invalid offset - use zero byte
                result.push(0);
              }
            }
          } else {
            // Literal byte
            if (pos >= input.length) break;
            result.push(input[pos++]);
          }
        }
      }

      this.inputBuffer = [];
      return result;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZRW1Compression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZRW1Compression, LZRW1Instance };
}));
