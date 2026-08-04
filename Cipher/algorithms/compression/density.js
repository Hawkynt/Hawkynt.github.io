/*
 * Density Compression Algorithm (Chameleon) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Density is a superfast compression library by Guillaume Voirin (2015).
 * Three algorithms: Chameleon (balanced), Cheetah (faster), Lion (fastest)
 * This implementation focuses on Chameleon - a predictive 4-byte-chunk
 * dictionary coder: a hash of the PREVIOUS chunk predicts the next one, and
 * when the prediction is correct it costs a single flag bit and zero payload
 * bytes (unlike a conventional LZ77 matcher, it never transmits a match
 * distance at all). Wire format matches CompressionWorkbench's BB_Density
 * block (Compression.Core.Dictionary.Density.DensityChameleonCompressor),
 * the authoritative reference this implementation is byte-identical to.
 *
 * Key features:
 * - Works on 32-bit (4-byte) chunks instead of individual bytes
 * - 65536-entry (16-bit hash) prediction dictionary, keyed by a hash of the
 *   chunk immediately before the one being coded
 * - A correct prediction costs zero payload bytes - only a signature bit
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
      this.description = "Predictive 4-byte-chunk dictionary coder: a hash of the previous chunk predicts the next one, and a correct prediction costs zero payload bytes - only a signature bit. Optimized for speed over compression ratio.";
      this.inventor = "Guillaume Voirin";
      this.year = 2015;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.FR;

      // Chameleon algorithm constants - match CompressionWorkbench's
      // DensityConstants exactly (hash table size/bits and multiplier are
      // this implementation's own tuned choice, not values transcribed from
      // Density's own C source; see DensityConstants.cs for provenance).
      this.HASH_BITS = 16;                  // log2 of the prediction dictionary size
      this.HASH_TABLE_SIZE = OpCodes.Shl32(1, this.HASH_BITS); // 65536 entries
      this.HASH_MULTIPLIER = 2654435761;    // Knuth's 32-bit golden-ratio constant
      this.CHUNK_SIZE = 4;                  // Work on 4-byte chunks
      this.CHUNKS_PER_BLOCK = 32;           // Chunks covered by one signature word

      // Documentation and references
      this.documentation = [
        new LinkItem("Density GitHub Repository", "https://github.com/g1mv/density"),
        new LinkItem("Chameleon Analysis by Charles Bloom", "http://cbloomrants.blogspot.com/2015/03/03-25-15-density-chameleon.html"),
        new LinkItem("Density Wikipedia", "https://en.wikipedia.org/wiki/Density_(compression)")
      ];

      this.references = [
        new LinkItem("Original Density Implementation (Rust)", "https://github.com/g1mv/density"),
        new LinkItem("Squash Compression Benchmark", "https://quixdb.github.io/squash/"),
        new LinkItem("CompressionWorkbench DensityChameleonCompressor (reference implementation)", "https://github.com/Hawkynt")
      ];

      // Test vectors verified against CompressionWorkbench's BB_Density
      // (DensityChameleonCompressor.Compress), the authoritative reference
      // this wire format is byte-identical to.
      //
      // Format: [OriginalLength(4 bytes LE)][Block]... where each Block is
      // [Signature(4 bytes LE)][literal chunk data (4 bytes per set bit)].
      // A clear signature bit means "prediction was correct" and consumes
      // zero payload bytes; a set bit means "literal" and is followed by the
      // raw 4-byte chunk. OriginalLength is required because a trailing
      // partial chunk is zero-padded up to CHUNK_SIZE on encode.
      this.tests = [
        {
          text: "Empty input - still emits the 4-byte length header",
          uri: "https://github.com/g1mv/density",
          input: [],
          expected: [0x00, 0x00, 0x00, 0x00]
        },
        {
          text: "Simple 4-byte literal (ABCD)",
          uri: "https://github.com/g1mv/density",
          input: OpCodes.AnsiToBytes("ABCD"),
          expected: [0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x41, 0x42, 0x43, 0x44]
        },
        {
          text: "Repetition pattern (ABCDABCD) - the prediction hash comes from the PREVIOUS chunk, so an immediate repeat is not itself a hit: both chunks are literals",
          uri: "https://github.com/g1mv/density",
          input: OpCodes.AnsiToBytes("ABCDABCD"),
          expected: [0x08, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x41, 0x42, 0x43, 0x44, 0x41, 0x42, 0x43, 0x44]
        },
        {
          text: "Long repetition (AAAABBBBAAAABBBB) - the AAAA->BBBB transition recurs, so the 4th chunk (following a BBBB, same as when the 2nd chunk followed AAAA) is a correct zero-payload prediction",
          uri: "https://github.com/g1mv/density",
          input: OpCodes.AnsiToBytes("AAAABBBBAAAABBBB"),
          expected: [0x10, 0x00, 0x00, 0x00, 0x07, 0x00, 0x00, 0x00, 0x41, 0x41, 0x41, 0x41, 0x42, 0x42, 0x42, 0x42, 0x41, 0x41, 0x41, 0x41]
        },
        {
          text: "Mixed data - Hello World! (12 bytes = 3 chunks, all literals)",
          uri: "https://github.com/g1mv/density",
          input: OpCodes.AnsiToBytes("Hello World!"),
          expected: [0x0C, 0x00, 0x00, 0x00, 0x07, 0x00, 0x00, 0x00,
                    0x48, 0x65, 0x6C, 0x6C,  // Hell
                    0x6F, 0x20, 0x57, 0x6F,  // o Wo
                    0x72, 0x6C, 0x64, 0x21]  // rld!
        },
        {
          text: "Regression: 256 repeated bytes - zero-payload matches after the first literal",
          uri: "Regression test for correct-prediction zero-payload encoding",
          input: new Array(256).fill(0x61),
          expected: [0x00, 0x01, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x61, 0x61, 0x61, 0x61, 0x61, 0x61, 0x61, 0x61, 0x00, 0x00, 0x00, 0x00]
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
      this.HASH_BITS = algorithm.HASH_BITS;
      this.HASH_TABLE_SIZE = algorithm.HASH_TABLE_SIZE;
      this.HASH_MULTIPLIER = algorithm.HASH_MULTIPLIER;
      this.CHUNK_SIZE = algorithm.CHUNK_SIZE;
      this.CHUNKS_PER_BLOCK = algorithm.CHUNKS_PER_BLOCK;
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
      const result = this.isInverse ? this._decompress() : this._compress();
      this.inputBuffer = [];
      return result;
    }

    // ===== COMPRESSION =====

    _compress() {
      const input = this.inputBuffer;
      const inputLength = input.length;

      const output = [];

      // Store the true input length up front - even for empty input, which
      // still emits this 4-byte header and nothing else. The chunk loop
      // below always works in whole 4-byte units and zero-pads a trailing
      // partial chunk, so without recording the real length the decoder
      // cannot tell genuine trailing zero bytes apart from that padding.
      const lengthBytes = OpCodes.Unpack32LE(inputLength);
      output.push(lengthBytes[0], lengthBytes[1], lengthBytes[2], lengthBytes[3]);

      if (inputLength === 0)
        return output;

      const totalChunks = Math.ceil(inputLength / this.CHUNK_SIZE);
      const table = new Uint32Array(this.HASH_TABLE_SIZE); // zero-initialized: an unseen hash bucket predicts chunk 0

      let prevChunk = 0;
      let pos = 0;
      let chunkIndex = 0;

      while (chunkIndex < totalChunks) {
        const chunksInBlock = Math.min(this.CHUNKS_PER_BLOCK, totalChunks - chunkIndex);
        let signature = 0;
        const blockData = [];

        for (let i = 0; i < chunksInBlock; ++i) {
          const chunk = this._readChunkPadded(input, pos);
          const hash = this._hash(prevChunk);
          const predicted = table[hash];

          if (predicted !== chunk) {
            signature = OpCodes.SetBit(signature, i, 1);
            const chunkBytes = OpCodes.Unpack32LE(chunk);
            blockData.push(chunkBytes[0], chunkBytes[1], chunkBytes[2], chunkBytes[3]);
          }

          table[hash] = chunk;
          prevChunk = chunk;
          pos += this.CHUNK_SIZE;
          ++chunkIndex;
        }

        const signatureBytes = OpCodes.Unpack32LE(OpCodes.ToUint32(signature));
        output.push(signatureBytes[0], signatureBytes[1], signatureBytes[2], signatureBytes[3]);

        for (let _i = 0; _i < blockData.length; _i++) output.push(blockData[_i]);
      }

      return output;
    }

    // ===== DECOMPRESSION =====

    _decompress() {
      const input = this.inputBuffer;
      const inputLength = input.length;

      if (inputLength < 4)
        return [];

      const originalLength = OpCodes.Pack32LE(
        OpCodes.ToByte(input[0]),
        OpCodes.ToByte(input[1]),
        OpCodes.ToByte(input[2]),
        OpCodes.ToByte(input[3])
      );

      if (originalLength === 0)
        return [];

      const data = input.slice(4);
      const totalChunks = Math.ceil(originalLength / this.CHUNK_SIZE);
      const buffer = new Array(totalChunks * this.CHUNK_SIZE).fill(0);
      const table = new Uint32Array(this.HASH_TABLE_SIZE);

      let prevChunk = 0;
      let pos = 0;
      let outPos = 0;
      let chunkIndex = 0;

      while (chunkIndex < totalChunks) {
        if (pos + 4 > data.length) break;

        const signature = OpCodes.Pack32LE(
          OpCodes.ToByte(data[pos]),
          OpCodes.ToByte(data[pos + 1]),
          OpCodes.ToByte(data[pos + 2]),
          OpCodes.ToByte(data[pos + 3])
        );
        pos += 4;

        const chunksInBlock = Math.min(this.CHUNKS_PER_BLOCK, totalChunks - chunkIndex);
        for (let i = 0; i < chunksInBlock; ++i) {
          const hash = this._hash(prevChunk);
          let chunk;

          if (OpCodes.GetBit(signature, i)) {
            if (pos + 4 > data.length) break;

            chunk = OpCodes.Pack32LE(
              OpCodes.ToByte(data[pos]),
              OpCodes.ToByte(data[pos + 1]),
              OpCodes.ToByte(data[pos + 2]),
              OpCodes.ToByte(data[pos + 3])
            );
            pos += 4;
            table[hash] = chunk;
          } else
            chunk = table[hash];

          const chunkBytes = OpCodes.Unpack32LE(chunk);
          buffer[outPos] = chunkBytes[0];
          buffer[outPos + 1] = chunkBytes[1];
          buffer[outPos + 2] = chunkBytes[2];
          buffer[outPos + 3] = chunkBytes[3];
          outPos += this.CHUNK_SIZE;

          prevChunk = chunk;
          ++chunkIndex;
        }
      }

      return buffer.slice(0, originalLength);
    }

    // ===== UTILITY METHODS =====

    /**
     * Reads one 4-byte little-endian chunk starting at pos, zero-padding any
     * bytes past the end of data (a trailing partial chunk).
     */
    _readChunkPadded(data, pos) {
      let chunk = 0;
      for (let i = 0; i < this.CHUNK_SIZE; ++i) {
        const p = pos + i;
        if (p < data.length)
          chunk = OpCodes.Or32(chunk, OpCodes.Shl32(OpCodes.ToByte(data[p]), 8 * i));
      }
      return OpCodes.ToUint32(chunk);
    }

    /**
     * Hash function for 4-byte chunks: multiply by the hash constant modulo
     * 2^32 and take the upper HASH_BITS bits as the table index.
     */
    _hash(chunk) {
      const product = OpCodes.Mul32(chunk, this.HASH_MULTIPLIER);
      return OpCodes.Shr32(product, 32 - this.HASH_BITS);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DensityCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name))
    RegisterAlgorithm(algorithmInstance);

  // ===== EXPORTS =====

  return { DensityCompression, DensityInstance };
}));
