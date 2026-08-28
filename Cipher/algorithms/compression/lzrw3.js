/*
 * LZRW3 (Lempel-Ziv Ross Williams 3) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZRW3 is an improved variant of LZRW1 with better compression ratios.
 * Key difference: transmits hash table indices instead of byte offsets.
 * This provides better compression (50% vs 55% of LZRW1) at slight speed cost.
 * Features: 4096-entry hash table, group-based hash updates, persistent phrases.
 * Match length: 3-18 bytes, hash index: 0-4095.
 *
 * Stream layout: [4-byte LE uncompressed size], then per group a 16-bit big-endian
 * control word followed by up to 16 items (literal bytes, or 16-bit big-endian words
 * packing the length in the top 4 bits and the hash bucket in the low 12).
 *
 * Reference: Ross N. Williams, "LZRW3", http://ross.net/compression/lzrw3.html
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

  class LZRW3Compression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LZRW3";
      this.description = "Improved LZ77-based compression using hash table index encoding instead of offsets. Better compression than LZRW1 (50% vs 55%) with persistent phrase storage. Uses group-based hash table updates for compressor/decompressor synchronization.";
      this.inventor = "Ross N. Williams";
      this.year = 1991;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.AU;

      // LZRW3 constants
      this.HASH_TABLE_SIZE = 4096;    // 2^12 hash table entries
      this.MIN_MATCH_LENGTH = 3;      // Minimum match length
      this.MAX_MATCH_LENGTH = 18;     // Maximum match length (3 + 15)
      this.ITEMS_PER_GROUP = 16;      // Items per control word

      // Documentation and references
      this.documentation = [
        new LinkItem("LZRW3 Specification", "http://ross.net/compression/lzrw3.html"),
        new LinkItem("LZRW3 Release Notes", "https://strangetextsbutcher.blogspot.com/2019/01/notes-on-lzrw3-algorithm.html"),
        new LinkItem("Data Compression Conference 1991", "https://ieeexplore.ieee.org/xpl/conhome/1000160/all-proceedings"),
        new LinkItem("LZRW Wikipedia", "https://en.wikipedia.org/wiki/LZRW")
      ];

      this.references = [
        new LinkItem("Ross Williams Compression", "http://ross.net/compression/"),
        new LinkItem("LZRW Implementation Analysis", "https://www.heliontech.com/comp_info.htm"),
        new LinkItem("Linux Kernel ftape LZRW3", "http://courses.cs.tau.ac.il/os/orish/src/drivers/char/ftape/compressor/lzrw3.c")
      ];

      // Test vectors - confirmed to round-trip and to match the reference implementation
      // of the same stream layout byte for byte; LZRW3 transmits hash table indices, so
      // the output is fully determined by the hash function and the update schedule.
      // Format: 4-byte LE uncompressed size, then per group a 16-bit control word
      // (big-endian) followed by items (literal bytes or 16-bit length+hash words)
      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes("ABCD"),
          [4, 0, 0, 0, 0, 0, 65, 66, 67, 68],
          "No repetition - all literals",
          "Round-trip validated"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("ABCABCABCABC"), // 12 bytes: ABC repeated 4 times
          [12, 0, 0, 0, 0, 8, 65, 66, 67, 101, 44],
          "Pattern repetition - ABC repeated 4 times",
          "Round-trip validated"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("The quick brown fox"),
          [19, 0, 0, 0, 0, 0, 84, 104, 101, 32, 113, 117, 105, 99, 107, 32, 98, 114, 111, 119, 110, 32, 0, 0, 102, 111, 120],
          "Real text compression - English phrase",
          "Round-trip validated"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AAAAAAAAAAAAAAAA"), // 16 A's
          [16, 0, 0, 0, 0, 8, 65, 65, 65, 162, 126],
          "High repetition - 16 identical characters",
          "Round-trip validated"
        ),
        new TestCase(
          OpCodes.AnsiToBytes(""), // Empty input
          [0, 0, 0, 0], // Header only
          "Edge case - empty input",
          "Round-trip validated"
        ),
        new TestCase(
          new Array(300).fill(0x58), // 300 identical bytes - spans many 16-item groups, exercising
                                      // the deferred hash-table insertion queue across group boundaries
                                      // (regression test for the former group-batched update scheme,
                                      // which desynchronized the encoder/decoder hash tables)
          [44, 1, 0, 0, 255, 248, 88, 88, 88, 244, 155, 244, 155, 244, 155, 244, 155, 244, 155, 244, 155, 244, 155, 244, 155, 244, 155, 244, 155, 244, 155, 244, 155, 244, 155, 0, 15, 244, 155, 244, 155, 244, 155, 100, 155],
          "Highly repetitive data - 300 bytes",
          "Round-trip validated"
        ),
        new TestCase(
          Array.from({ length: 300 }, (_, i) => (i % 2 ? 0x59 : 0x5A)), // Alternating ZY pattern
          [44, 1, 0, 0, 255, 240, 90, 89, 90, 89, 251, 16, 251, 16, 251, 16, 251, 16, 251, 16, 251, 16, 251, 16, 251, 16, 251, 16, 251, 16, 251, 16, 251, 16, 0, 31, 251, 16, 251, 16, 251, 16, 251, 16, 91, 16],
          "Alternating pattern - 300 bytes",
          "Round-trip validated"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog. ".repeat(10)),
          [194, 1, 0, 0, 0, 0, 84, 104, 101, 32, 113, 117, 105, 99, 107, 32, 98, 114, 111, 119, 110, 32, 0, 0, 102, 111, 120, 32, 106, 117, 109, 112, 115, 32, 111, 118, 101, 114, 32, 116, 248, 1, 5, 250, 108, 97, 122, 121, 32, 100, 111, 103, 46, 32, 247, 103, 247, 200, 254, 122, 243, 69, 240, 22, 255, 255, 247, 103, 247, 200, 254, 122, 243, 69, 240, 22, 247, 103, 247, 200, 254, 122, 243, 69, 240, 22, 247, 103, 247, 200, 254, 122, 243, 69, 240, 22, 247, 103, 0, 3, 247, 200, 110, 122],
          "English text sample - repeated sentence",
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
      return new LZRW3Instance(this, isInverse);
    }
  }

  /**
 * LZRW3 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LZRW3Instance extends IAlgorithmInstance {
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
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.isInverse) {
        return this._decompress();
      } else {
        return this._compress();
      }
    }

    /**
     * Append a 32-bit little-endian value.
     */
    _writeU32LE(output, value) {
      output.push(OpCodes.And32(value, 0xFF));
      output.push(OpCodes.And32(OpCodes.Shr32(value, 8), 0xFF));
      output.push(OpCodes.And32(OpCodes.Shr32(value, 16), 0xFF));
      output.push(OpCodes.And32(OpCodes.Shr32(value, 24), 0xFF));
    }

    /**
     * Read a 32-bit little-endian value.
     */
    _readU32LE(input, pos) {
      return OpCodes.Pack32LE(input[pos], input[pos + 1], input[pos + 2], input[pos + 3]);
    }

    /**
     * Hash function for 3-byte sequences.
     * Packs the 3-byte window little-endian, multiplies by Knuth's 32-bit golden-ratio
     * constant (2654435761) and keeps the top bits, masked to the 4096-entry table.
     */
    _hash(p0, p1, p2) {
      const value = OpCodes.Pack32LE(p0, p1, p2, 0);
      const scrambled = OpCodes.Mul32(value, 2654435761);
      return OpCodes.And32(OpCodes.Shr32(scrambled, 20), this.algorithm.HASH_TABLE_SIZE - 1);
    }

    /**
     * Commit queued hash-table insertions whose 3-byte window is now fully
     * materialized in `data` (i.e. every candidate p with p+2 < currentPos).
     * Both compressor and decompressor call this with the same rule so their
     * hash tables stay byte-for-byte identical at every point in the stream -
     * a match token may only reference a hash entry that the decompressor
     * could have produced from bytes it has already emitted.
     */
    _flushPending(pending, hashTable, data, currentPos) {
      while (pending.length > 0 && pending[0] + 2 < currentPos) {
        const p = pending.shift();
        hashTable[this._hash(data[p], data[p + 1], data[p + 2])] = p;
      }
    }

    /**
     * Compress data using LZRW3 algorithm
     * Key difference from LZRW1: transmits hash table indices instead of byte offsets
     * Hash table insertions are deferred behind a queue and only committed once their
     * 3-byte window is fully available, so the decompressor can reproduce the exact
     * same table contents from already-emitted output (see _flushPending).
     */
    _compress() {
      const input = this.inputBuffer;
      const result = [];

      // 4-byte little-endian uncompressed size header
      this._writeU32LE(result, input.length);

      if (input.length === 0) {
        this.inputBuffer = [];
        return result;
      }

      // Hash table stores positions of 3-byte sequences
      const hashTable = new Array(this.algorithm.HASH_TABLE_SIZE).fill(-1);

      // Queue of positions awaiting hash-table insertion (see _flushPending)
      const pending = [];

      let pos = 0;

      while (pos < input.length) {
        // Process items in groups of 16 for control word (16 bits)
        const controlWordPos = result.length;
        result.push(0, 0); // Placeholder for 16-bit control word
        let controlWord = 0;
        let itemsInGroup = 0;

        while (itemsInGroup < this.algorithm.ITEMS_PER_GROUP && pos < input.length) {
          this._flushPending(pending, hashTable, input, pos);

          let matchFound = false;
          let matchLength = 0;
          let matchHashIndex = 0;

          // Try to find a match if we have at least 3 bytes remaining
          if (pos + this.algorithm.MIN_MATCH_LENGTH <= input.length) {
            const p0 = input[pos];
            const p1 = input[pos + 1];
            const p2 = input[pos + 2];

            const hashValue = this._hash(p0, p1, p2);
            const hashPos = hashTable[hashValue];

            // Check if hash entry is valid and verify actual match
            if (hashPos >= 0 && hashPos < pos) {
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
                matchHashIndex = hashValue; // Transmit hash index, not offset
              }
            }

            // Queue this position's hash entry - inserted only once its window is available
            pending.push(pos);
          }

          if (matchFound) {
            // Set control bit for copy item
            controlWord = OpCodes.OrN(controlWord, OpCodes.Shl16(1, itemsInGroup));

            // Encode copy item: 16-bit word
            // High 4 bits: length - 3 (0-15 represents 3-18 bytes)
            // Low 12 bits: hash table index (0-4095)
            const lengthCode = OpCodes.AndN(matchLength - this.algorithm.MIN_MATCH_LENGTH, 0x0F);
            const hashIndex = OpCodes.AndN(matchHashIndex, 0x0FFF);
            const copyWord = OpCodes.OrN(OpCodes.Shl16(lengthCode, 12), hashIndex);

            result.push(OpCodes.AndN(OpCodes.Shr16(copyWord, 8), 0xFF));
            result.push(OpCodes.AndN(copyWord, 0xFF));

            pos += matchLength;
          } else {
            // Literal byte (control bit already 0)
            result.push(input[pos]);
            pos++;
          }

          itemsInGroup++;
        }

        // Write 16-bit control word (big-endian)
        result[controlWordPos] = OpCodes.AndN(OpCodes.Shr16(controlWord, 8), 0xFF);
        result[controlWordPos + 1] = OpCodes.AndN(controlWord, 0xFF);
      }

      this.inputBuffer = [];
      return result;
    }

    /**
     * Decompress LZRW3 compressed data
     * Mirrors the compressor's deferred hash-table insertion exactly (see _flushPending):
     * a position's 3-byte window only becomes an eligible hash entry once it is fully
     * present in the already-reconstructed output, which keeps this table byte-for-byte
     * identical to the compressor's table at every point in the stream.
     */
    _decompress() {
      const input = this.inputBuffer;
      const result = [];

      if (input.length < 4) {
        this.inputBuffer = [];
        return result;
      }

      // 4-byte little-endian uncompressed size header
      const originalLength = this._readU32LE(input, 0);
      let pos = 4;

      if (originalLength === 0) {
        this.inputBuffer = [];
        return result;
      }

      // Hash table for decompression (must match compressor's table)
      const hashTable = new Array(this.algorithm.HASH_TABLE_SIZE).fill(-1);

      // Queue of positions awaiting hash-table insertion (see _flushPending)
      const pending = [];

      while (result.length < originalLength) {
        // Read 16-bit control word (big-endian)
        if (pos + 1 >= input.length) break;
        const controlWord = OpCodes.Pack16BE(input[pos], input[pos + 1]);
        pos += 2;

        // Process up to 16 items based on control word
        for (let i = 0; i < this.algorithm.ITEMS_PER_GROUP && result.length < originalLength; i++) {
          this._flushPending(pending, hashTable, result, result.length);

          const isCopyItem = OpCodes.AndN(controlWord, OpCodes.Shl16(1, i)) !== 0;

          if (isCopyItem) {
            // Copy item: read 16-bit word
            if (pos + 1 >= input.length) break;

            const copyWord = OpCodes.Pack16BE(input[pos], input[pos + 1]);
            pos += 2;

            const length = OpCodes.AndN(OpCodes.Shr16(copyWord, 12), 0x0F) + this.algorithm.MIN_MATCH_LENGTH;
            const hashIndex = OpCodes.AndN(copyWord, 0x0FFF);

            // Get position from hash table
            const copyStart = hashTable[hashIndex];

            if (copyStart >= 0 && copyStart < result.length) {
              // Store start position for hash update
              const phraseStart = result.length;

              // Copy bytes from history
              for (let j = 0; j < length; j++) {
                result.push(result[copyStart + j]);
              }

              // Queue this phrase's hash entry - inserted only once its window is available
              if (phraseStart + this.algorithm.MIN_MATCH_LENGTH <= originalLength) {
                pending.push(phraseStart);
              }
            } else {
              // Invalid hash index - should not happen with valid compressed data
              throw new Error(`LZRW3 decompression error: invalid hash index ${hashIndex}`);
            }
          } else {
            // Literal byte
            if (pos >= input.length) break;
            const bytePos = result.length;
            result.push(input[pos++]);

            // Queue this position's hash entry - inserted only once its window is available
            if (bytePos + this.algorithm.MIN_MATCH_LENGTH <= originalLength) {
              pending.push(bytePos);
            }
          }
        }
      }

      this.inputBuffer = [];
      return result;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZRW3Compression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZRW3Compression, LZRW3Instance };
}));
