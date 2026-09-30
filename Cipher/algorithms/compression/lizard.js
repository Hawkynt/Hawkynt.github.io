/*
 * Lizard (formerly LZ5) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Lizard is an efficient compressor with very fast decompression, achieving compression
 * ratios comparable to zip/zlib at low/medium levels with fast decompression speed.
 * It belongs to the LZ77 family with improved entropy utilization over LZ4.
 * Developed by Przemysław Skibiński (2016-2017) based on Yann Collet's LZ4 (2011-2015).
 *
 * This implementation focuses on Lizard Level 10 (fast mode) compression.
 * Format specification: https://github.com/inikep/lizard/blob/lizard/doc/lizard_Block_format.md
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

  // ===== LIZARD ALGORITHM IMPLEMENTATION =====

  class LizardCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Lizard";
      this.description = "Efficient compressor with very fast decompression and compression ratios comparable to zip/zlib at fast decompression speed. Successor to LZ4 with improved entropy utilization and four compression levels (10, 20, 30, 40).";
      this.inventor = "Przemysław Skibiński, Yann Collet";
      this.year = 2016;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.PL;

      // Lizard Block format constants, matching CompressionWorkbench's LizardBuildingBlock
      // (the authoritative reference): an LZ4-style token stream with a 65536-byte window.
      /** @type {int32} */
      this.MIN_MATCH = 4;              // Minimum match length
      /** @type {int32} */
      this.HASH_SIZE_U32 = 65536;      // Hash table size (must be power of 2)
      /** @type {int32} */
      this.HASH_LOG = 16;              // Log2 of hash size
      /** @type {int32} */
      this.LAST_LITERALS_MIN = 5;      // Match search may not start within this many bytes of the end
      /** @type {int32} */
      this.MAX_WINDOW = 65536;         // Maximum backward distance

      // Documentation and references
      this.documentation = [
        new LinkItem("Lizard GitHub Repository", "https://github.com/inikep/lizard"),
        new LinkItem("Lizard Block Format Specification", "https://github.com/inikep/lizard/blob/lizard/doc/lizard_Block_format.md"),
        new LinkItem("Lizard Frame Format Specification", "https://github.com/inikep/lizard/blob/lizard/doc/lizard_Frame_format.md")
      ];

      this.references = [
        new LinkItem("Official Lizard Implementation", "https://github.com/inikep/lizard/tree/lizard/lib"),
        new LinkItem("LZ4 Compression (predecessor)", "https://github.com/lz4/lz4"),
        new LinkItem("Compression Benchmark", "https://github.com/inikep/lzbench")
      ];

      // Test vectors - cross-checked byte-for-byte against CompressionWorkbench's
      // LizardBuildingBlock (BB_Lizard), which is the authoritative reference for
      // this container: 4-byte little-endian original length, then an LZ4-style
      // token stream (token byte: high nibble = literal length, low nibble = match
      // length - MIN_MATCH; a match search may not start within the last 5 bytes
      // of input, but an accepted match may still extend into them).
      this.tests = [
        {
          text: "Empty input",
          uri: "https://github.com/inikep/lizard/blob/lizard/doc/lizard_Block_format.md",
          input: [],
          expected: [0x00, 0x00, 0x00, 0x00]
        },
        {
          text: "All literals - no matches (ABCD)",
          uri: "https://github.com/inikep/lizard/blob/lizard/doc/lizard_Block_format.md",
          input: OpCodes.AnsiToBytes("ABCD"),
          expected: [0x04, 0x00, 0x00, 0x00, 0x40, 0x41, 0x42, 0x43, 0x44]
        },
        {
          text: "Simple repetition - AAAAA (5 A's, too short to search for a match)",
          uri: "https://github.com/inikep/lizard/blob/lizard/doc/lizard_Block_format.md",
          input: OpCodes.AnsiToBytes("AAAAA"),
          expected: [0x05, 0x00, 0x00, 0x00, 0x50, 0x41, 0x41, 0x41, 0x41, 0x41]
        },
        {
          text: "Pattern ABCABC (6 bytes, too short to search for a match)",
          uri: "https://github.com/inikep/lizard/blob/lizard/doc/lizard_Block_format.md",
          input: OpCodes.AnsiToBytes("ABCABC"),
          expected: [0x06, 0x00, 0x00, 0x00, 0x60, 0x41, 0x42, 0x43, 0x41, 0x42, 0x43]
        },
        {
          text: "Text sample with a real match - 'the quick brown fox...' x4",
          uri: "https://github.com/inikep/lizard/blob/lizard/doc/lizard_Block_format.md",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. ".repeat(4)),
          expected: [
            0xb4, 0x00, 0x00, 0x00, 0xf0, 0x10, 0x74, 0x68, 0x65, 0x20, 0x71, 0x75, 0x69, 0x63, 0x6b, 0x20,
            0x62, 0x72, 0x6f, 0x77, 0x6e, 0x20, 0x66, 0x6f, 0x78, 0x20, 0x6a, 0x75, 0x6d, 0x70, 0x73, 0x20,
            0x6f, 0x76, 0x65, 0x72, 0x20, 0x1f, 0x00, 0x91, 0x6c, 0x61, 0x7a, 0x79, 0x20, 0x64, 0x6f, 0x67,
            0x2e, 0x0e, 0x00, 0x0f, 0x2d, 0x00, 0x70
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
      return new LizardInstance(this, isInverse);
    }
  }

  // ===== LIZARD INSTANCE IMPLEMENTATION =====

  /**
   * Match found at a position
   */
  class LizardMatch {
    /**
     * @param {int32} length - Match length (0 when none)
     * @param {int32} offset - Distance back to the match source
     */
    constructor(length, offset) {
      /** @type {int32} */
      this.length = length;
      /** @type {int32} */
      this.offset = offset;
    }
  }

  /**
 * Lizard cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LizardInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {LizardCompression} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];

      // Lizard parameters from algorithm
      /** @type {int32} */
      this.MIN_MATCH = algorithm.MIN_MATCH;
      /** @type {int32} */
      this.HASH_SIZE_U32 = algorithm.HASH_SIZE_U32;
      /** @type {int32} */
      this.HASH_LOG = algorithm.HASH_LOG;
      /** @type {int32} */
      this.LAST_LITERALS_MIN = algorithm.LAST_LITERALS_MIN;
      /** @type {int32} */
      this.MAX_WINDOW = algorithm.MAX_WINDOW;
    }


    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      /** @type {uint8[]} */
      let result;
      if (this.isInverse) {
        result = this._decompress();
      } else {
        result = this._compress();
      }
      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;
      return result;
    }

    // ===== COMPRESSION (LZ4-compatible fast parser) =====

    /**
     * @returns {uint8[]} Length header and token stream
     */
    _compress() {
      /** @type {uint8[]} */
      const input = this.inputBuffer;
      /** @type {int32} */
      const inputLength = input.length;

      // Container: 4-byte little-endian original length, then the payload
      /** @type {uint8[]} */
      const header = OpCodes.Unpack32LE(inputLength);
      if (inputLength === 0) {
        return header;
      }
      /** @type {uint8[]} */
      const payload = this._compressBlock(input);
      for (let i = 0; i < payload.length; ++i) {
        header.push(payload[i]);
      }
      return header;
    }

    /**
     * @param {uint8[]} input - Bytes to compress
     * @returns {uint8[]} Token stream
     */
    _compressBlock(input) {
      /** @type {int32} */
      const n = input.length;
      /** @type {uint8[]} */
      const output = [];
      /** @type {int32[]} */
      const hashHead = new Int32Array(this.HASH_SIZE_U32);
      hashHead.fill(-1);

      /** @type {int32} */
      let anchor = 0;
      /** @type {int32} */
      let pos = 0;
      /** @type {int32} */
      const matchLimit = n - this.LAST_LITERALS_MIN;

      while (pos < matchLimit) {
        /** @type {LizardMatch} */
        const match = this._findMatch(input, pos, hashHead, matchLimit + this.LAST_LITERALS_MIN);

        if (match.length < this.MIN_MATCH) {
          this._insertHash(input, pos, hashHead);
          ++pos;
          continue;
        }

        this._emitSequence(output, input, anchor, pos, match.offset, match.length);

        /** @type {int32} */
        const end = pos + match.length;
        for (let i = pos; i < end && i + 3 < n; ++i) {
          this._insertHash(input, i, hashHead);
        }

        pos = end;
        anchor = pos;
      }

      this._emitFinalLiterals(output, input, anchor, n);
      return output;
    }

    /**
     * @param {uint8[]} src - Bytes
     * @param {int32} a - First position
     * @param {int32} b - Second position
     * @returns {boolean} True when the four bytes at a and b are equal
     */
    _sameFour(src, a, b) {
      return src[a] === src[b] && src[a + 1] === src[b + 1] &&
        src[a + 2] === src[b + 2] && src[a + 3] === src[b + 3];
    }

    /**
     * @param {uint8[]} src - Bytes
     * @param {int32} pos - Position to match
     * @param {int32[]} hashHead - Last position per hash
     * @param {int32} limit - End of the matchable area
     * @returns {LizardMatch} Match (length 0 when none)
     */
    _findMatch(src, pos, hashHead, limit) {
      if (pos + this.MIN_MATCH > src.length) {
        return new LizardMatch(0, 0);
      }

      /** @type {uint32} */
      const h = this._hash(src, pos);
      /** @type {int32} */
      const candidate = hashHead[h];

      if (candidate < 0 || (pos - candidate) > this.MAX_WINDOW) {
        return new LizardMatch(0, 0);
      }
      if (!this._sameFour(src, candidate, pos)) {
        return new LizardMatch(0, 0);
      }

      /** @type {int32} */
      const maxLen = Math.min(limit, src.length) - pos;
      /** @type {int32} */
      let len = this.MIN_MATCH;
      while (len < maxLen && src[candidate + len] === src[pos + len]) {
        ++len;
      }

      return new LizardMatch(len, pos - candidate);
    }

    /**
     * @param {uint8[]} src - Bytes
     * @param {int32} pos - Position to insert
     * @param {int32[]} hashHead - Last position per hash
     */
    _insertHash(src, pos, hashHead) {
      if (pos + 4 > src.length) {
        return;
      }
      hashHead[this._hash(src, pos)] = pos;
    }

    /**
     * @param {uint8[]} data - Bytes
     * @param {int32} pos - Position of the four hashed bytes
     * @returns {uint32} Hash table index
     */
    _hash(data, pos) {
      /** @type {uint32} */
      const val = OpCodes.Pack32LE(
        OpCodes.ToByte(data[pos]),
        OpCodes.ToByte(data[pos+1]),
        OpCodes.ToByte(data[pos+2]),
        OpCodes.ToByte(data[pos+3])
      );
      return OpCodes.Shr32(OpCodes.Mul32(val, 2654435761), 32 - this.HASH_LOG);
    }

    /**
     * @param {uint8[]} output - Token stream
     * @param {uint8[]} src - Source bytes
     * @param {int32} litStart - First literal
     * @param {int32} matchStart - Match position (end of the literals)
     * @param {int32} offset - Match distance
     * @param {int32} matchLen - Match length
     */
    _emitSequence(output, src, litStart, matchStart, offset, matchLen) {
      /** @type {int32} */
      const litLen = matchStart - litStart;
      /** @type {int32} */
      const mlCode = matchLen - this.MIN_MATCH;

      /** @type {int32} */
      const litNibble = Math.min(litLen, 15);
      /** @type {int32} */
      const mlNibble = Math.min(mlCode, 15);
      output.push(OpCodes.ToByte(OpCodes.Or32(OpCodes.Shl8(litNibble, 4), mlNibble)));

      this._writeExtendedLength(output, litLen, litNibble);
      for (let i = 0; i < litLen; ++i) {
        output.push(OpCodes.ToByte(src[litStart + i]));
      }

      output.push(OpCodes.ToByte(offset));
      output.push(OpCodes.ToByte(OpCodes.Shr16(offset, 8)));

      this._writeExtendedLength(output, mlCode, mlNibble);
    }

    /**
     * @param {uint8[]} output - Token stream
     * @param {uint8[]} src - Source bytes
     * @param {int32} start - First literal
     * @param {int32} end - End of the literals
     */
    _emitFinalLiterals(output, src, start, end) {
      /** @type {int32} */
      const litLen = end - start;
      if (litLen === 0) {
        return;
      }

      /** @type {int32} */
      const litNibble = Math.min(litLen, 15);
      output.push(OpCodes.ToByte(OpCodes.Shl8(litNibble, 4)));
      this._writeExtendedLength(output, litLen, litNibble);
      for (let i = 0; i < litLen; ++i) {
        output.push(OpCodes.ToByte(src[start + i]));
      }
    }

    /**
     * @param {uint8[]} output - Token stream
     * @param {int32} actual - Full length
     * @param {int32} nibble - Part held by the token
     */
    _writeExtendedLength(output, actual, nibble) {
      if (nibble < 15) {
        return;
      }

      /** @type {int32} */
      let remaining = actual - 15;
      while (remaining >= 255) {
        output.push(255);
        remaining -= 255;
      }
      output.push(OpCodes.ToByte(remaining));
    }

    // ===== DECOMPRESSION =====

    /**
     * @returns {uint8[]} Decoded bytes (cut to the header length)
     */
    _decompress() {
      /** @type {uint8[]} */
      const input = this.inputBuffer;
      if (input.length < 4) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      /** @type {uint32} */
      const originalLength = OpCodes.Pack32LE(
        OpCodes.ToByte(input[0]), OpCodes.ToByte(input[1]),
        OpCodes.ToByte(input[2]), OpCodes.ToByte(input[3])
      );
      if (originalLength === 0) {
        /** @type {uint8[]} */
        const none = [];
        return none;
      }

      /** @type {uint8[]} */
      const output = this._decompressBlock(input.slice(4));
      if (output.length === originalLength) {
        return output;
      }
      return output.slice(0, originalLength);
    }

    /**
     * @param {uint8[]} input - Token stream
     * @returns {uint8[]} Decoded bytes
     */
    _decompressBlock(input) {
      /** @type {int32} */
      const inputLength = input.length;
      /** @type {uint8[]} */
      const output = [];
      /** @type {int32} */
      let ip = 0;

      while (ip < inputLength) {
        /** @type {uint8} */
        const token = OpCodes.ToByte(input[ip++]);

        /** @type {int32} */
        let literalLength = OpCodes.ToByte(OpCodes.Shr8(token, 4));
        if (literalLength === 15) {
          /** @type {uint8} */
          let len = 0;
          do {
            if (ip >= inputLength) {
              break;
            }
            len = OpCodes.ToByte(input[ip++]);
            literalLength += len;
          } while (len === 255);
        }

        for (let i = 0; i < literalLength; ++i) {
          if (ip >= inputLength) {
            break;
          }
          output.push(OpCodes.ToByte(input[ip++]));
        }

        // Final, match-less sequence: no more input follows the literals.
        if (ip >= inputLength) {
          break;
        }

        if (ip + 1 >= inputLength) {
          break;
        }
        /** @type {uint16} */
        const offset = OpCodes.Pack16LE(OpCodes.ToByte(input[ip]), OpCodes.ToByte(input[ip+1]));
        ip += 2;

        /** @type {uint8} */
        const matchLenField = OpCodes.And8(token, 0x0F);
        /** @type {int32} */
        let matchLength = matchLenField + this.MIN_MATCH;
        if (matchLenField === 15) {
          /** @type {uint8} */
          let len = 0;
          do {
            if (ip >= inputLength) {
              break;
            }
            len = OpCodes.ToByte(input[ip++]);
            matchLength += len;
          } while (len === 255);
        }

        /** @type {int32} */
        const matchPos = output.length - offset;
        if (matchPos < 0) {
          break;
        }

        for (let i = 0; i < matchLength; ++i) {
          output.push(OpCodes.ToByte(output[matchPos + i]));
        }
      }

      return output;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LizardCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name))
    RegisterAlgorithm(algorithmInstance);

  // ===== EXPORTS =====

  return { LizardCompression, LizardInstance };
}));
