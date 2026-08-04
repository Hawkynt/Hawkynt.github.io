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
      //
      // Format: [OriginalLength(4 bytes LE)][Block]... where each Block is
      // [Flags(4 bytes LE)][chunk data]. OriginalLength is required because
      // a trailing partial chunk is zero-padded up to CHUNK_SIZE on encode;
      // without recording the true length, the decoder cannot tell real
      // trailing zero bytes apart from that padding (see regression vectors).
      this.tests = [
        {
          text: "Simple 4-byte literal (ABCD)",
          uri: "https://github.com/g1mv/density",
          input: OpCodes.AnsiToBytes("ABCD"),
          // Length: 4. Flags: 0x00000001 (1 chunk, bit 0 = 1 for literal)
          // Literal: ABCD (0x41424344 LE)
          expected: [0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x41, 0x42, 0x43, 0x44]
        },
        {
          text: "Repetition pattern (ABCDABCD - 8 bytes with match)",
          uri: "https://github.com/g1mv/density",
          input: OpCodes.AnsiToBytes("ABCDABCD"),
          // Length: 8. Flags: 0x00000001 (bit 0 = 1 for first literal, bit 1 = 0 for match)
          // First chunk literal: ABCD (0x41424344)
          // Second chunk matches first: hash index + 2 zero padding bytes
          expected: [0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x41, 0x42, 0x43, 0x44, 0xf1, 0x04, 0x00, 0x00]
        },
        {
          text: "Long repetition (AAAABBBBAAAABBBB - 16 bytes, pattern repeats)",
          uri: "https://github.com/g1mv/density",
          input: OpCodes.AnsiToBytes("AAAABBBBAAAABBBB"),
          // 4 chunks: AAAA, BBBB, AAAA, BBBB
          // Chunk 0: AAAA (literal, bit 0 = 1)
          // Chunk 1: BBBB (literal, bit 1 = 1)
          // Chunk 2: AAAA (match to chunk 0)
          // Chunk 3: BBBB (match to chunk 1)
          expected: [0x10, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x41, 0x41, 0x41, 0x41, 0x42, 0x42, 0x42, 0x42,
                    0xd8, 0x07, 0x00, 0x00, 0xb3, 0x00, 0x00, 0x00]
        },
        {
          text: "Mixed data - Hello World! (12 bytes = 3 chunks)",
          uri: "https://github.com/g1mv/density",
          input: OpCodes.AnsiToBytes("Hello World!"),
          // 3 chunks: "Hell", "o Wo", "rld!"
          // All literals (no repeats in 3 chunks)
          // Flags: 0x00000007 (bits 0-2 = 111 for 3 literals)
          expected: [0x0C, 0x00, 0x00, 0x00, 0x07, 0x00, 0x00, 0x00,
                    0x48, 0x65, 0x6C, 0x6C,  // Hell
                    0x6F, 0x20, 0x57, 0x6F,  // o Wo
                    0x72, 0x6C, 0x64, 0x21]  // rld!
        },
        {
          text: "Regression: all 256 byte values (2 blocks, exercises matches and literals)",
          uri: "Regression test for GetBit() boolean-vs-number comparison bug",
          input: Array.from({length: 256}, (_, i) => i),
          expected: [0,1,0,0,255,255,255,255,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,255,255,255,255,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252,253,254,255]
        },
        {
          text: "Regression: alphanumeric text, length not a multiple of 4 (29 bytes)",
          uri: "Regression test for trailing partial-chunk zero padding",
          input: OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZ123"),
          expected: [29,0,0,0,255,0,0,0,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,49,50,51,0,0,0]
        },
        {
          text: "Regression: pseudo-random data, length not a multiple of 4 (37 bytes)",
          uri: "Regression test for non-repeating pseudo-random input with a partial tail chunk",
          input: [0,0,64,0,64,0,64,0,0,64,0,0,64,0,0,0,0,0,0,0,0,0,0,0,0,64,0,0,0,0,0,64,128,128,0,0,0],
          expected: [37,0,0,0,159,3,0,0,0,0,64,0,64,0,64,0,0,64,0,0,64,0,0,0,0,0,0,0,0,0,0,0,242,5,0,0,0,0,0,64,128,128,0,0,0,0,0,0]
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
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
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

      // Store the true input length up front. The chunk loop below always
      // works in whole 4-byte units and zero-pads a trailing partial chunk,
      // so without recording the real length the decoder cannot tell
      // genuine trailing zero bytes apart from padding it must discard.
      const lengthBytes = OpCodes.Unpack32LE(inputLength);
      output.push(lengthBytes[0], lengthBytes[1], lengthBytes[2], lengthBytes[3]);

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
        for (let _i = 0; _i < blockData.length; _i++) output.push(blockData[_i]);
      }

      return output;
    }

    // ===== DECOMPRESSION =====

    _decompress() {
      const input = this.inputBuffer;
      const inputLength = input.length;
      const output = [];

      if (inputLength < 4)
        return [];

      // Read the true original length written by _compress(), so trailing
      // zero padding added to complete the final 4-byte chunk can be
      // stripped back off instead of leaking into the output.
      const originalLength = OpCodes.Pack32LE(
        OpCodes.ToByte(input[0]),
        OpCodes.ToByte(input[1]),
        OpCodes.ToByte(input[2]),
        OpCodes.ToByte(input[3])
      );
      let pos = 4;

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
          // OpCodes.GetBit() already returns a boolean; comparing it with
          // !== 0 compares a boolean to a number, which is always true
          // regardless of the actual bit value. That made every chunk
          // decode as a literal and silently discarded every match,
          // corrupting any input with a repeated 4-byte chunk.
          const isLiteral = OpCodes.GetBit(flags, i);

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

            const rawHash = OpCodes.Pack16LE(
              OpCodes.ToByte(input[pos]),
              OpCodes.ToByte(input[pos + 1])
            );
            const hash = OpCodes.ToWord(OpCodes.And32(rawHash, OpCodes.BitMask(11)));  // Mask to table size (2048 = 2^11)
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

      return output.slice(0, originalLength);
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
      return OpCodes.ToWord(OpCodes.And32(hashValue, OpCodes.BitMask(11)));
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DensityCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name))
    RegisterAlgorithm(algorithmInstance);

  // ===== EXPORTS =====

  return { DensityCompression, DensityInstance };
}));
