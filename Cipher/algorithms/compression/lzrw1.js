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
      /** @type {int32} */
      this.HASH_TABLE_SIZE = 4096;    // 2^12 hash table entries
      /** @type {int32} */
      this.MIN_MATCH_LENGTH = 3;      // Minimum match length
      /** @type {int32} */
      this.MAX_MATCH_LENGTH = 18;     // Maximum match length (3 + 15)
      /** @type {int32} */
      this.MAX_OFFSET = 4095;         // Maximum backward offset
      /** @type {int32} */
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

      // Test vectors cross-checked byte-for-byte against CompressionWorkbench's
      // BB_Lzrw1 building block (Compression.Core.Dictionary.Lzrw1), which is
      // the authoritative wire format: a 4-byte little-endian original-length
      // header, then 16-bit control words (big-endian) + items (literal bytes
      // or 16-bit copy words).
      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes("ABCD"),
          [4, 0, 0, 0, 0, 0, 65, 66, 67, 68], // header(4) + control word 0x0000 (all literals) + 4 literal bytes
          "No repetition - all literals",
          "https://github.com/Hawkynt/Cipher"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AAAAAAAAAAAAAAAA"), // 16 A's
          [16, 0, 0, 0, 0, 2, 65, 192, 0], // header(16) + control 0x0002 (bit 1 set): literal A, then copy 15 bytes from offset 1
          "High repetition - 16 identical characters",
          "https://github.com/Hawkynt/Cipher"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("ABCABCABCABC"), // 12 bytes: ABC repeated 4 times
          [12, 0, 0, 0, 0, 8, 65, 66, 67, 96, 2], // header(12) + control 0x0008 (bit 3 set): ABC literals, then copy 9 bytes
          "Pattern repetition - ABC repeated 4 times",
          "https://github.com/Hawkynt/Cipher"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("The quick brown fox"),
          [19, 0, 0, 0, 0, 0, 84, 104, 101, 32, 113, 117, 105, 99, 107, 32, 98, 114, 111, 119, 110, 32, 0, 0, 102, 111, 120],
          "Real text compression - English phrase",
          "https://github.com/Hawkynt/Cipher"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {LZRW1Instance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LZRW1Instance(this, isInverse);
    }
  }

  /**
 * LZRW1 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class LZRW1Instance extends IAlgorithmInstance {
    /**
     * @param {LZRW1Compression} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - True to decompress
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {int32} */
      this.hashTableSize = algorithm.HASH_TABLE_SIZE;
      /** @type {int32} */
      this.minMatchLength = algorithm.MIN_MATCH_LENGTH;
      /** @type {int32} */
      this.maxMatchLength = algorithm.MAX_MATCH_LENGTH;
      /** @type {int32} */
      this.maxOffset = algorithm.MAX_OFFSET;
      /** @type {int32} */
      this.itemsPerGroup = algorithm.ITEMS_PER_GROUP;
    }

    /**
     * Compress or decompress the collected input
     * @returns {uint8[]} Output bytes
     */
    Result() {
      if (this.isInverse) {
        if (this.inputBuffer.length === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }
        return this._decompress();
      }

      // Compression (always emits a 4-byte length header, even for empty
      // input, so decompression can distinguish empty from missing data)
      return this._compress();
    }

    /**
     * Hash of three bytes into the 12-bit table index
     * @param {uint8} p0 - First byte
     * @param {uint8} p1 - Second byte
     * @param {uint8} p2 - Third byte
     * @returns {uint32} Table index 0..4095
     */
    _hash(p0, p1, p2) {
      /** @type {uint32} */
      const value = OpCodes.Or32(OpCodes.Or32(p0, OpCodes.Shl32(p1, 8)), OpCodes.Shl32(p2, 16));
      /** @type {uint32} */
      const h = OpCodes.Mul32(value, 2654435761);
      return OpCodes.And32(OpCodes.Shr32(h, 20), 0xFFF);
    }

    /**
     * Compress: 4-byte LE length, then groups of a 16-bit control word
     * followed by up to 16 literal bytes or 16-bit copy words.
     * @returns {uint8[]} Compressed bytes
     */
    _compress() {
      /** @type {uint8[]} */
      const input = this.inputBuffer;
      /** @type {uint8[]} */
      const header = OpCodes.Unpack32LE(input.length);
      /** @type {uint8[]} */
      const result = [];

      if (input.length === 0) {
        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        return header;
      }

      // Hash table: stores the position of the last occurrence of each hash
      /** @type {int32[]} */
      const hashTable = new Array(this.hashTableSize);
      for (let i = 0; i < this.hashTableSize; i++) {
        hashTable[i] = -1;
      }

      /** @type {int32} */
      let pos = 0;

      while (pos < input.length) {
        // Reserve space for control word (16 bits = 2 bytes)
        /** @type {int32} */
        const controlWordPos = result.length;
        result.push(0); // Placeholder for 16-bit control word
        result.push(0);
        /** @type {uint32} */
        let controlWord = 0;
        /** @type {int32} */
        let itemsInGroup = 0;

        while (itemsInGroup < this.itemsPerGroup && pos < input.length) {
          /** @type {boolean} */
          let matchFound = false;
          /** @type {int32} */
          let matchLength = 0;
          /** @type {int32} */
          let matchOffset = 0;

          // Try to find a match (need at least MIN_MATCH_LENGTH bytes)
          if (pos + this.minMatchLength - 1 < input.length) {
            /** @type {uint8} */
            const p0 = input[pos];
            /** @type {uint8} */
            const p1 = input[pos + 1];
            /** @type {uint8} */
            const p2 = input[pos + 2];

            // Only hash if we have enough bytes
            if (pos + this.minMatchLength <= input.length) {
              /** @type {uint32} */
              const hashValue = this._hash(p0, p1, p2);
              /** @type {int32} */
              const hashPos = hashTable[hashValue];

              // Check if we have a valid match
              if (hashPos >= 0 && pos - hashPos <= this.maxOffset) {
                // Verify match and find length
                /** @type {int32} */
                let len = 0;
                /** @type {int32} */
                const maxLen = Math.min(this.maxMatchLength, input.length - pos);

                while (len < maxLen && input[hashPos + len] === input[pos + len]) {
                  len++;
                }

                if (len >= this.minMatchLength) {
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
            // Set bit in control word (copy item)
            controlWord = OpCodes.Or32(controlWord, OpCodes.Shl16(1, itemsInGroup));

            // Encode copy item as 16-bit word:
            // Bits 15-12: length - 3 (0-15, representing lengths 3-18)
            // Bits 11-0: offset - 1 (0-4095, representing offsets 1-4096)
            /** @type {uint32} */
            const lengthCode = OpCodes.And32(matchLength - this.minMatchLength, 0x0F);
            /** @type {uint32} */
            const offsetCode = OpCodes.And32(matchOffset - 1, 0x0FFF);
            /** @type {uint32} */
            const copyWord = OpCodes.Or32(OpCodes.Shl16(lengthCode, 12), offsetCode);

            result.push(OpCodes.And32(OpCodes.Shr16(copyWord, 8), 0xFF));
            result.push(OpCodes.And32(copyWord, 0xFF));

            pos += matchLength;
          } else {
            // Literal item (control bit = 0)
            result.push(input[pos]);
            pos++;
          }

          itemsInGroup++;
        }

        // Write control word (big-endian for compatibility)
        result[controlWordPos] = OpCodes.And32(OpCodes.Shr16(controlWord, 8), 0xFF);
        result[controlWordPos + 1] = OpCodes.And32(controlWord, 0xFF);
      }

      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;
      return header.concat(result);
    }

    /**
     * Decompress the format written by _compress()
     * @returns {uint8[]} Original bytes
     */
    _decompress() {
      /** @type {uint8[]} */
      const input = this.inputBuffer;
      /** @type {uint8[]} */
      const result = [];
      if (input.length < 4) {
        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        return result;
      }

      /** @type {uint32} */
      const originalLength = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      if (originalLength === 0) {
        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        return result;
      }

      /** @type {int32} */
      let pos = 4;

      while (result.length < originalLength) {
        // Read control word (16 bits, big-endian)
        if (pos + 1 >= input.length) {
          break;
        }
        /** @type {uint16} */
        const controlWord = OpCodes.Pack16BE(input[pos], input[pos + 1]);
        pos += 2;

        // Process up to ITEMS_PER_GROUP items
        for (let i = 0; i < this.itemsPerGroup && result.length < originalLength; i++) {
          /** @type {boolean} */
          const isCopyItem = OpCodes.And32(controlWord, OpCodes.Shl16(1, i)) !== 0;

          if (isCopyItem) {
            // Copy item: read 16-bit copy word
            if (pos + 1 >= input.length) {
              break;
            }

            /** @type {uint16} */
            const copyWord = OpCodes.Pack16BE(input[pos], input[pos + 1]);
            pos += 2;

            /** @type {int32} */
            const length = OpCodes.And32(OpCodes.Shr16(copyWord, 12), 0x0F) + this.minMatchLength;
            /** @type {int32} */
            const offset = OpCodes.And32(copyWord, 0x0FFF) + 1;

            // Copy from previous output
            /** @type {int32} */
            const copyStart = result.length - offset;
            for (let j = 0; j < length; j++) {
              // An offset reaching back before the start of the output is corrupt
              // input, not a zero byte: substituting 0 (the old `|| 0`) silently
              // fabricated data. The source is always behind the write position,
              // so overlapping copies stay well defined.
              if (copyStart + j < 0 || copyStart + j >= result.length) {
                throw new Error('LZRW1: match at offset ' + offset
                  + ' points outside the ' + result.length + ' bytes decoded so far');
              }
              result.push(result[copyStart + j]);
            }
          } else {
            // Literal item
            if (pos >= input.length) {
              break;
            }
            result.push(input[pos++]);
          }
        }
      }

      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;
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
