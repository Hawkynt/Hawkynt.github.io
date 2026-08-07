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
      this.HASH_SIZE_U32 = 65536;   // Hash table size (64K entries)
      this.HASH_LOG = 16;
      this.LAST_LITERALS = 5;       // Bytes always kept as literals at end of input
      this.MF_LIMIT = 12;           // Distance from end within which no match may start

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

      // Test vectors - cross-checked byte-for-byte against CompressionWorkbench's
      // Lz4BlockCompressor (BB_Lz4), which is the authoritative reference for this
      // container: 4-byte little-endian original length, then the LZ4 block payload.
      // No match may start within MF_LIMIT (12) bytes of the input end, so short
      // inputs always encode as a single all-literals sequence.
      this.tests = [
        {
          text: "Empty input",
          uri: "https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md",
          input: [],
          expected: [0x00, 0x00, 0x00, 0x00]
        },
        {
          text: "Single byte 0x41",
          uri: "https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md",
          input: [0x41],
          expected: [0x01, 0x00, 0x00, 0x00, 0x10, 0x41]
        },
        {
          text: "All literals, too short for a match - AAAAA",
          uri: "https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md",
          input: OpCodes.AnsiToBytes("AAAAA"),
          expected: [0x05, 0x00, 0x00, 0x00, 0x50, 0x41, 0x41, 0x41, 0x41, 0x41]
        },
        {
          text: "All literals, too short for a match - ABCDABCD",
          uri: "https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md",
          input: OpCodes.AnsiToBytes("ABCDABCD"),
          expected: [0x08, 0x00, 0x00, 0x00, 0x80, 0x41, 0x42, 0x43, 0x44, 0x41, 0x42, 0x43, 0x44]
        },
        {
          text: "Text sample with a real match - 'the quick brown fox...' x4",
          uri: "https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. ".repeat(4)),
          expected: [
            0xb4, 0x00, 0x00, 0x00, 0xf0, 0x10, 0x74, 0x68, 0x65, 0x20, 0x71, 0x75, 0x69, 0x63, 0x6b, 0x20,
            0x62, 0x72, 0x6f, 0x77, 0x6e, 0x20, 0x66, 0x6f, 0x78, 0x20, 0x6a, 0x75, 0x6d, 0x70, 0x73, 0x20,
            0x6f, 0x76, 0x65, 0x72, 0x20, 0x1f, 0x00, 0x91, 0x6c, 0x61, 0x7a, 0x79, 0x20, 0x64, 0x6f, 0x67,
            0x2e, 0x0e, 0x00, 0x0f, 0x2d, 0x00, 0x6b, 0x50, 0x64, 0x6f, 0x67, 0x2e, 0x20
          ]
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
      this.LAST_LITERALS = algorithm.LAST_LITERALS;
      this.MF_LIMIT = algorithm.MF_LIMIT;
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

      // Container: 4-byte little-endian original length, then the LZ4 block payload
      const header = OpCodes.Unpack32LE(inputLength);
      const payload = inputLength === 0 ? [] : this._compressBlock(input);
      return header.concat(payload);
    }

    _compressBlock(input) {
      const inputLength = input.length;
      const output = [];
      let pos = 0;
      let anchor = 0;  // Start of current literal run
      const hashTable = new Int32Array(this.HASH_SIZE_U32);
      hashTable.fill(-1);

      // No match may start within MF_LIMIT bytes of the end; matches may not
      // extend into the final LAST_LITERALS bytes, which must stay literals.
      const searchLimit = inputLength - this.MF_LIMIT;
      const matchLimit = inputLength - this.LAST_LITERALS;

      while (pos < searchLimit) {
        let matchOffset = 0;
        let matchLength = 0;

        const h = this._hash(input, pos);
        const candidate = hashTable[h];
        hashTable[h] = pos;

        if (candidate >= 0 && (pos - candidate) <= this.MAX_DISTANCE &&
            input[candidate] === input[pos] &&
            input[candidate + 1] === input[pos + 1] &&
            input[candidate + 2] === input[pos + 2] &&
            input[candidate + 3] === input[pos + 3]) {
          matchOffset = pos - candidate;
          matchLength = this.MIN_MATCH;
          while (pos + matchLength < matchLimit &&
                 input[candidate + matchLength] === input[pos + matchLength])
            ++matchLength;
        }

        if (matchLength < this.MIN_MATCH) {
          ++pos;
          continue;
        }

        // Emit sequence: literal length + match
        const literalCount = pos - anchor;
        this._writeSequence(output, input, anchor, literalCount,
                            matchOffset, matchLength - this.MIN_MATCH);

        // Advance past the match, inserting hash entries for skipped positions
        const end = pos + matchLength;
        ++pos;
        while (pos < end && pos + 3 < inputLength) {
          hashTable[this._hash(input, pos)] = pos;
          ++pos;
        }
        pos = end;
        anchor = pos;
      }

      // Final literal sequence
      const finalLiterals = inputLength - anchor;
      this._writeFinalLiterals(output, input, anchor, finalLiterals);

      return output;
    }

    _hash(data, pos) {
      // Hash of 4 bytes (little-endian) using the LZ4 multiplicative constant
      const val = OpCodes.Pack32LE(
        OpCodes.ToByte(data[pos]),
        OpCodes.ToByte(data[pos+1]),
        OpCodes.ToByte(data[pos+2]),
        OpCodes.ToByte(data[pos+3])
      );
      return OpCodes.Shr32(OpCodes.Mul32(val, 2654435761), 32 - this.HASH_LOG);
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
      if (input.length < 4)
        return [];

      // Container: 4-byte little-endian original length, then the LZ4 block payload
      const originalLength = OpCodes.Pack32LE(
        OpCodes.ToByte(input[0]), OpCodes.ToByte(input[1]),
        OpCodes.ToByte(input[2]), OpCodes.ToByte(input[3])
      );
      const output = this._decompressBlock(input.slice(4));
      return output.length === originalLength ? output : output.slice(0, originalLength);
    }

    _decompressBlock(input) {
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
        const offset = OpCodes.Pack16LE(OpCodes.ToByte(input[ip]), OpCodes.ToByte(input[ip+1]));
        ip += 2;

        // Decode match length
        const matchLenField = OpCodes.And8(token, 0x0F);
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
