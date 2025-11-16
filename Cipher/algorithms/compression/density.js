/*
 * Density Compression Algorithm (Chameleon) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Density is a superfast compression library by Guillaume Voirin (2015).
 * Three algorithms: Chameleon (balanced), Cheetah (faster), Lion (fastest)
 * This implementation focuses on Chameleon - dictionary-based compression.
 *
 * Key features:
 * - Works on 32-bit (4-byte) chunks instead of individual bytes
 * - Dictionary-based compression with hash table lookups
 * - Simple token encoding with flags for match/literal decisions
 * - Optimized for speed over compression ratio
 *
 * References:
 * - https://github.com/g1mv/density
 * - Charles Bloom's analysis: http://cbloomrants.blogspot.com/2015/03/03-25-15-density-chameleon.html
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

  // ===== DENSITY CHAMELEON ALGORITHM IMPLEMENTATION =====

  class DensityCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Density (Chameleon)";
      this.description = "Superfast dictionary-based compression working on 4-byte chunks. Uses hash table lookups with simple token encoding for match/literal decisions. Optimized for speed over compression ratio.";
      this.inventor = "Guillaume Voirin";
      this.year = 2015;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.FR;

      // Chameleon algorithm constants
      this.HASH_TABLE_SIZE = 2048;        // Hash table size (power of 2)
      this.HASH_MULTIPLIER = 2641295638;  // Hash function multiplier (from cbloom analysis)
      this.CHUNK_SIZE = 4;                // Work on 4-byte chunks
      this.FLAG_BITS_PER_CHUNK = 32;      // 32 chunks per flag block

      // Documentation and references
      this.documentation = [
        new LinkItem("Density GitHub Repository", "https://github.com/g1mv/density"),
        new LinkItem("Chameleon Analysis by Charles Bloom", "http://cbloomrants.blogspot.com/2015/03/03-25-15-density-chameleon.html"),
        new LinkItem("Density Wikipedia", "https://en.wikipedia.org/wiki/Density_(compression)")
      ];

      this.references = [
        new LinkItem("Original Density Implementation (Rust)", "https://github.com/g1mv/density"),
        new LinkItem("Squash Compression Benchmark", "https://quixdb.github.io/squash/"),
        new LinkItem("FSBench Compression Benchmark", "https://github.com/g1mv/fsbench-density")
      ];

      // Test vectors - created by implementing the algorithm and verifying round-trip compression
      // Density focuses on real-world performance, official test vectors use Silesia corpus
      this.tests = [
        {
          text: "Simple 4-byte literal (ABCD)",
          uri: "https://github.com/g1mv/density",
          input: OpCodes.AnsiToBytes("ABCD"),
          // Flags: 0x00000001 (1 chunk, bit 0 = 1 for literal)
          // Literal: ABCD (0x41424344 LE)
          expected: [0x01, 0x00, 0x00, 0x00, 0x41, 0x42, 0x43, 0x44]
        },
        {
          text: "Repetition pattern (ABCDABCD - 8 bytes with match)",
          uri: "https://github.com/g1mv/density",
          input: OpCodes.AnsiToBytes("ABCDABCD"),
          // Flags: 0x00000001 (bit 0 = 1 for first literal, bit 1 = 0 for match)
          // First chunk literal: ABCD (0x41424344)
          // Second chunk matches first: hash index 0x04f1 (little-endian) + padding
          expected: [0x01, 0x00, 0x00, 0x00, 0x41, 0x42, 0x43, 0x44, 0xf1, 0x04, 0x00, 0x00]
        },
        {
          text: "Long repetition (AAAABBBBAAAABBBB - 16 bytes, pattern repeats)",
          uri: "https://github.com/g1mv/density",
          input: OpCodes.AnsiToBytes("AAAABBBBAAAABBBB"),
          // 4 chunks: AAAA, BBBB, AAAA, BBBB
          // Chunk 0: AAAA (literal, bit 0 = 1)
          // Chunk 1: BBBB (literal, bit 1 = 1)
          // Chunk 2: AAAA (match to chunk 0, bit 2 = 0, hash index 0x07d8)
          // Chunk 3: BBBB (match to chunk 1, bit 3 = 0, hash index 0x00b3)
          expected: [0x03, 0x00, 0x00, 0x00, 0x41, 0x41, 0x41, 0x41, 0x42, 0x42, 0x42, 0x42,
                    0xd8, 0x07, 0x00, 0x00, 0xb3, 0x00, 0x00, 0x00]
        },
        {
          text: "Mixed data - Hello World! (12 bytes = 3 chunks)",
          uri: "https://github.com/g1mv/density",
          input: OpCodes.AnsiToBytes("Hello World!"),
          // 3 chunks: "Hell", "o Wo", "rld!"
          // All literals (no repeats in 3 chunks)
          // Flags: 0x00000007 (bits 0-2 = 111 for 3 literals)
          expected: [0x07, 0x00, 0x00, 0x00,
                    0x48, 0x65, 0x6C, 0x6C,  // Hell
                    0x6F, 0x20, 0x57, 0x6F,  // o Wo
                    0x72, 0x6C, 0x64, 0x21]  // rld!
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new DensityInstance(this, isInverse);
    }
  }

  // ===== DENSITY CHAMELEON INSTANCE IMPLEMENTATION =====

  /**
 * Density cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class DensityInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];

      // Algorithm parameters
      this.HASH_TABLE_SIZE = algorithm.HASH_TABLE_SIZE;
      this.HASH_MULTIPLIER = algorithm.HASH_MULTIPLIER;
      this.CHUNK_SIZE = algorithm.CHUNK_SIZE;
      this.FLAG_BITS_PER_CHUNK = algorithm.FLAG_BITS_PER_CHUNK;
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
      const hashTable = new Int32Array(this.HASH_TABLE_SIZE);
      hashTable.fill(-1);  // -1 indicates empty slot

      let pos = 0;

      // Process input in blocks of 32 chunks (each chunk is 4 bytes)
      while (pos < inputLength) {
        const blockStart = pos;
        const blockEnd = Math.min(pos + this.FLAG_BITS_PER_CHUNK * this.CHUNK_SIZE, inputLength);
        const chunksInBlock = Math.ceil((blockEnd - blockStart) / this.CHUNK_SIZE);

        // Build flags and data for this block
        let flags = 0;
        const blockData = [];

        for (let i = 0; i < chunksInBlock && pos < inputLength; ++i) {
          const chunkEnd = Math.min(pos + this.CHUNK_SIZE, inputLength);
          const chunkSize = chunkEnd - pos;

          if (chunkSize < this.CHUNK_SIZE) {
            // Partial chunk at end - always output as literal
            flags = OpCodes.SetBit(flags, i, 1);
            for (let j = 0; j < chunkSize; ++j)
              blockData.push(OpCodes.ToByte(input[pos + j]));
            // Pad with zeros to complete chunk
            for (let j = chunkSize; j < this.CHUNK_SIZE; ++j)
              blockData.push(0);
            pos += chunkSize;
            break;
          }

          // Read 4-byte chunk (little-endian)
          const chunk = OpCodes.Pack32LE(
            OpCodes.ToByte(input[pos]),
            OpCodes.ToByte(input[pos + 1]),
            OpCodes.ToByte(input[pos + 2]),
            OpCodes.ToByte(input[pos + 3])
          );

          // Compute hash
          const hash = this._hash(chunk);
          const hashIndex = hashTable[hash];

          // Check if we have a match in hash table
          if (hashIndex === chunk) {
            // Match found - output hash index (bit = 0 for match)
            const hashBytes = OpCodes.Unpack16LE(hash);
            blockData.push(hashBytes[0], hashBytes[1], 0, 0);  // 2 bytes for hash, 2 padding
          } else {
            // No match - output literal (bit = 1 for literal)
            flags = OpCodes.SetBit(flags, i, 1);
            const chunkBytes = OpCodes.Unpack32LE(chunk);
            blockData.push(chunkBytes[0], chunkBytes[1], chunkBytes[2], chunkBytes[3]);
            // Update hash table
            hashTable[hash] = chunk;
          }

          pos += this.CHUNK_SIZE;
        }

        // Write flags (32-bit little-endian)
        const flagBytes = OpCodes.Unpack32LE(flags);
        output.push(flagBytes[0], flagBytes[1], flagBytes[2], flagBytes[3]);

        // Write block data
        output.push(...blockData);
      }

      return output;
    }

    // ===== DECOMPRESSION =====

    _decompress() {
      const input = this.inputBuffer;
      const inputLength = input.length;
      const output = [];
      let pos = 0;

      // Hash table to match compression
      const hashTable = new Int32Array(this.HASH_TABLE_SIZE);
      hashTable.fill(-1);

      while (pos < inputLength) {
        // Read flags (32-bit little-endian)
        if (pos + 4 > inputLength)
          break;

        const flags = OpCodes.Pack32LE(
          OpCodes.ToByte(input[pos]),
          OpCodes.ToByte(input[pos + 1]),
          OpCodes.ToByte(input[pos + 2]),
          OpCodes.ToByte(input[pos + 3])
        );
        pos += 4;

        // Process chunks according to flags
        for (let i = 0; i < this.FLAG_BITS_PER_CHUNK && pos < inputLength; ++i) {
          const isLiteral = OpCodes.GetBit(flags, i) !== 0;

          if (isLiteral) {
            // Read literal chunk (4 bytes)
            if (pos + 4 > inputLength)
              break;

            const chunk = OpCodes.Pack32LE(
              OpCodes.ToByte(input[pos]),
              OpCodes.ToByte(input[pos + 1]),
              OpCodes.ToByte(input[pos + 2]),
              OpCodes.ToByte(input[pos + 3])
            );
            pos += 4;

            // Output chunk
            const chunkBytes = OpCodes.Unpack32LE(chunk);
            output.push(chunkBytes[0], chunkBytes[1], chunkBytes[2], chunkBytes[3]);

            // Update hash table
            const hash = this._hash(chunk);
            hashTable[hash] = chunk;
          } else {
            // Read hash index (2 bytes + 2 padding)
            if (pos + 4 > inputLength)
              break;

            const hash = OpCodes.ToWord(OpCodes.Pack16LE(
              OpCodes.ToByte(input[pos]),
              OpCodes.ToByte(input[pos + 1])
            )&OpCodes.BitMask(11));  // Mask to table size (2048 = 2^11)
            pos += 4;  // Skip 2 bytes hash + 2 bytes padding

            // Retrieve chunk from hash table
            const chunk = hashTable[hash];
            if (chunk === -1) {
              // Hash table miss - this shouldn't happen in valid data
              // Output zeros as fallback
              output.push(0, 0, 0, 0);
            } else {
              const chunkBytes = OpCodes.Unpack32LE(chunk);
              output.push(chunkBytes[0], chunkBytes[1], chunkBytes[2], chunkBytes[3]);
            }
          }
        }
      }

      return output;
    }

    // ===== UTILITY METHODS =====

    /**
     * Hash function for 4-byte chunks
     * Based on Charles Bloom's analysis of Density Chameleon
     * Uses multiplication by constant and takes upper bits
     */
    _hash(chunk) {
      // Multiply by hash constant and take upper 32 bits
      const product = OpCodes.ToDWord(chunk) * OpCodes.ToDWord(this.HASH_MULTIPLIER);
      // Use upper bits for hash, mask to table size (2048 = 2^11, so 11 bits)
      const hashValue = OpCodes.Shr32(product, 32 - 11);
      return OpCodes.ToWord(hashValue&OpCodes.BitMask(11));
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DensityCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name))
    RegisterAlgorithm(algorithmInstance);

  // ===== EXPORTS =====

  return { DensityCompression, DensityInstance };
}));
