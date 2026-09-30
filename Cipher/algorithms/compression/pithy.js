/*
 * Pithy Compression Algorithm - Production Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Pithy - Fast compression/decompression library originally developed by John Engelhart
 * Inspired by Google's Snappy but with incompatible format
 * Based on LZ77 with hash-based match finding, optimized for speed
 *
 * Reference: https://github.com/johnezang/pithy
 * Format: varint(uncompressed_length) + tag/data stream
 * Tags: 2-bit type (00=literal, 01=copy1byte, 10=copy2byte, 11=copy3byte)
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
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== PITHY FORMAT CONSTANTS =====
  // Matches CompressionWorkbench's PithyBuildingBlock (the authoritative reference):
  // Snappy-shaped literal tags plus a 3-byte-offset copy tier with 62/63 length-escape
  // values in place of Snappy's 4-byte tier.

  /** @type {int32} */
  const PITHY_LITERAL = 0;          // Tag type 00: literal bytes
  /** @type {int32} */
  const PITHY_COPY_1_BYTE = 1;      // Tag type 01: copy with 1-byte offset
  /** @type {int32} */
  const PITHY_COPY_2_BYTE = 2;      // Tag type 10: copy with 2-byte offset
  /** @type {int32} */
  const PITHY_COPY_3_BYTE = 3;      // Tag type 11: copy with 3-byte offset

  // ===== ALGORITHM IMPLEMENTATION =====

  class PithyCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Pithy";
      this.description = "Fast LZ77-based compression library by John Engelhart, inspired by Google's Snappy but with incompatible format. Uses hash-based match finding with 4-byte minimum matches. Achieves compression speeds of 100-700 MB/s and decompression speeds over 1 GB/s.";
      this.inventor = "John Engelhart";
      this.year = 2011;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "LZ77 Dictionary-based";
      this.securityStatus = null; // Compression algorithm, not cryptographic
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Pithy GitHub Repository", "https://github.com/johnezang/pithy"),
        new LinkItem("Pithy Source Code", "https://github.com/johnezang/pithy/blob/master/pithy.c"),
        new LinkItem("Pithy Header File", "https://github.com/johnezang/pithy/blob/master/pithy.h")
      ];

      this.references = [
        new LinkItem("Squash Compression Benchmark - Pithy", "https://quixdb.github.io/squash/api/c/md_plugins_pithy_pithy.html"),
        new LinkItem("lzbench - Fast Compression Benchmark", "https://github.com/inikep/lzbench")
      ];

      // Test vectors - cross-checked byte-for-byte against CompressionWorkbench's
      // PithyBuildingBlock (BB_Pithy), the authoritative reference for this format:
      // varint(uncompressed_length) + compressed_data. Tag byte lower 2 bits:
      // 00=literal, 01=copy1byte, 10=copy2byte, 11=copy3byte (Pithy's real
      // 62/63 length-escape copy tags, not Snappy's).
      this.tests = [
        {
          text: "Empty input - edge case",
          uri: "https://github.com/johnezang/pithy/blob/master/pithy.c",
          // Compressed: 0x00 (varint: length=0), no payload
          input: [],
          expected: [0x00]
        },
        {
          text: "Single byte 'A' - literal tag with length 1",
          uri: "https://github.com/johnezang/pithy/blob/master/pithy.c",
          // Compressed: 0x01 (varint: length=1), 0x00 (tag: (0 << 2)|0), 0x41 ('A')
          input: OpCodes.AnsiToBytes("A"),
          expected: [0x01, 0x00, 0x41]
        },
        {
          text: "Three bytes 'abc' - literal tag with length 3",
          uri: "https://github.com/johnezang/pithy/blob/master/pithy.c",
          // Compressed: 0x03 (varint), 0x08 (tag: (2 << 2)|0 = 8), 'abc'
          input: OpCodes.AnsiToBytes("abc"),
          expected: [0x03, 0x08, 0x61, 0x62, 0x63]
        },
        {
          text: "Short text 'Hello' - all literals",
          uri: "https://github.com/johnezang/pithy/blob/master/pithy.c",
          // Compressed: 0x05 (varint), 0x10 (tag: (4 << 2)|0), 'Hello'
          input: OpCodes.AnsiToBytes("Hello"),
          expected: [0x05, 0x10, 0x48, 0x65, 0x6C, 0x6C, 0x6F]
        },
        {
          text: "Repeated data 'AAAAAAAAAA' (10 A's) - tests match finding",
          uri: "https://github.com/johnezang/pithy/blob/master/pithy.c",
          // Round-trip test only - compressed format depends on implementation strategy
          input: Array.from({length: 10}, () => 0x41)
        },
        {
          text: "Pattern 'abcdefabcdef' - tests longer matches",
          uri: "https://github.com/johnezang/pithy/blob/master/pithy.c",
          // Round-trip test only
          input: OpCodes.AnsiToBytes("abcdefabcdef")
        },
        {
          text: "Mixed data with repetition - real-world test",
          uri: "https://github.com/johnezang/pithy/blob/master/pithy.c",
          // Round-trip test only
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the lazy dog.")
        },
        {
          text: "Long literal sequence (65 bytes) - extended length encoding",
          uri: "https://github.com/johnezang/pithy/blob/master/pithy.c",
          // Tag: literal | (60 << 2) = 0xF0 signals "1 following byte holds length-1"
          input: Array.from({length: 65}, (_, i) => i&0xFF),
          expected: (() => {
            const result = [0x41]; // varint: 65
            result.push(0xF0); // literal tag: (60 << 2)|0 = 240
            result.push(0x40); // extra length byte: length-1 = 64
            { const _src = Array.from({length: 65}, (_, i) => i&0xFF); for (let _i = 0; _i < _src.length; _i++) result.push(_src[_i]); }
            return result;
          })()
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new PithyInstance(this, isInverse);
    }
  }

  /**
   * Match found by the hash-chain search
   */
  class PithyMatch {
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

  // Pithy compression instance - production implementation
  /**
 * Pithy cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PithyInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {PithyCompression} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];

      // Pithy parameters, matching CompressionWorkbench's PithyBuildingBlock
      /** @type {int32} */
      this.MIN_MATCH = 4;
      /** @type {int32} */
      this.MAX_COPY1_OFFSET = 2047;       // 11-bit offset
      /** @type {int32} */
      this.MAX_COPY1_LENGTH = 11;
      /** @type {int32} */
      this.MAX_COPY2_OFFSET = 65535;      // 16-bit offset
      /** @type {int32} */
      this.MAX_COPY3_OFFSET = 16777215;   // 24-bit offset
      /** @type {int32} */
      this.COPY23_LEN_ESCAPE1 = 62;       // Field value: one more byte holds (length - 63)
      /** @type {int32} */
      this.COPY23_LEN_ESCAPE2 = 63;       // Field value: two more bytes hold the raw 16-bit length
      /** @type {int32} */
      this.MAX_COPY23_ESCAPE1_LENGTH = 63 + 255;
      /** @type {int32} */
      this.MAX_COPY23_LENGTH = 65535;
      /** @type {int32} */
      this.HASH_BITS = 16;
      /** @type {int32} */
      this.HASH_SIZE = OpCodes.Shl32(1, this.HASH_BITS);
      /** @type {int32} */
      this.MAX_CHAIN_STEPS = 64;

      // Read position in the stream being decompressed
      /** @type {int32} */
      this.readPos = 0;
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
        result = this._decompress(new Uint8Array(this.inputBuffer));
      } else {
        result = this._compress(new Uint8Array(this.inputBuffer));
      }
      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;
      /** @type {uint8[]} */
      const bytes = [];
      for (let i = 0; i < result.length; i++) {
        bytes.push(result[i]);
      }
      return bytes;
    }

    // ===== COMPRESSION =====

    /**
     * @param {uint8[]} input - Input bytes
     * @returns {uint8[]} Varint size and tagged stream
     */
    _compress(input) {
      /** @type {uint8[]} */
      const output = [];
      this._writeVarint(output, input.length);

      /** @type {int32} */
      const n = input.length;
      if (n === 0) {
        /** @type {uint8[]} */
        const header = new Uint8Array(output);
        return header;
      }

      /** @type {int32[]} */
      const hashHead = new Int32Array(this.HASH_SIZE).fill(-1);
      /** @type {int32[]} */
      const chain = new Int32Array(n);

      /** @type {int32} */
      let pos = 0;
      /** @type {int32} */
      let litStart = 0;

      while (pos + this.MIN_MATCH <= n) {
        /** @type {PithyMatch} */
        const match = this._findMatch(input, pos, hashHead, chain);
        this._insertHash(input, pos, hashHead, chain);

        if (match.length < this.MIN_MATCH) {
          ++pos;
          continue;
        }

        if (pos > litStart) {
          this._emitLiterals(output, input, litStart, pos - litStart);
        }

        /** @type {int32} */
        const end = Math.min(pos + match.length, n - 2);
        for (let i = pos + 1; i < end; ++i) {
          this._insertHash(input, i, hashHead, chain);
        }

        this._emitCopy(output, match.offset, match.length);
        pos += match.length;
        litStart = pos;
      }

      if (litStart < n) {
        this._emitLiterals(output, input, litStart, n - litStart);
      }

      /** @type {uint8[]} */
      const packed = new Uint8Array(output);
      return packed;
    }

    /**
     * @param {uint8[]} src - Input bytes
     * @param {int32} pos - Position to match
     * @param {int32[]} hashHead - Chain heads
     * @param {int32[]} chain - Chain links
     * @returns {PithyMatch} Longest match (length 0 when none)
     */
    _findMatch(src, pos, hashHead, chain) {
      /** @type {uint32} */
      const h = this._hash4(src, pos);
      /** @type {int32} */
      let candidate = hashHead[h];
      /** @type {int32} */
      const minPos = Math.max(0, pos - this.MAX_COPY3_OFFSET);
      /** @type {int32} */
      const maxLen = src.length - pos;
      /** @type {int32} */
      let bestLen = 0;
      /** @type {int32} */
      let bestOff = 0;
      /** @type {int32} */
      let steps = this.MAX_CHAIN_STEPS;

      while (candidate >= minPos && steps-- > 0) {
        /** @type {boolean} */
        let worthMeasuring = bestLen === 0;
        if (!worthMeasuring && candidate + bestLen < src.length) {
          worthMeasuring = src[candidate + bestLen] === src[pos + bestLen];
        }
        if (worthMeasuring) {
          /** @type {int32} */
          let len = 0;
          while (len < maxLen && src[candidate + len] === src[pos + len]) {
            ++len;
          }

          if (len > bestLen) {
            bestLen = len;
            bestOff = pos - candidate;
            if (bestLen >= maxLen) {
              break;
            }
          }
        }

        /** @type {int32} */
        const prev = chain[candidate];
        if (prev >= candidate) {
          break;
        }
        candidate = prev;
      }

      if (bestLen >= this.MIN_MATCH) {
        return new PithyMatch(bestLen, bestOff);
      }
      return new PithyMatch(0, 0);
    }

    /**
     * @param {uint8[]} src - Input bytes
     * @param {int32} pos - Position to insert
     * @param {int32[]} hashHead - Chain heads
     * @param {int32[]} chain - Chain links
     */
    _insertHash(src, pos, hashHead, chain) {
      if (pos + 4 > src.length) {
        return;
      }
      /** @type {uint32} */
      const h = this._hash4(src, pos);
      chain[pos] = hashHead[h];
      hashHead[h] = pos;
    }

    /**
     * @param {uint8[]} data - Bytes
     * @param {int32} pos - Position of the four hashed bytes
     * @returns {uint32} Bucket
     */
    _hash4(data, pos) {
      /** @type {uint32} */
      const val = OpCodes.Pack32LE(
        OpCodes.ToByte(data[pos]), OpCodes.ToByte(data[pos + 1]),
        OpCodes.ToByte(data[pos + 2]), OpCodes.ToByte(data[pos + 3])
      );
      return OpCodes.Shr32(OpCodes.Mul32(val, 2654435761), 32 - this.HASH_BITS);
    }

    /**
     * @param {uint8[]} output - Output
     * @param {uint8[]} bytes - Bytes appended in order
     * @param {int32} count - Number of leading bytes appended
     */
    _pushSome(output, bytes, count) {
      for (let i = 0; i < count; i++) {
        output.push(bytes[i]);
      }
    }

    /**
     * @param {uint8[]} output - Output
     * @param {uint8[]} src - Input bytes
     * @param {int32} start - First literal
     * @param {int32} length - Number of literals
     */
    _emitLiterals(output, src, start, length) {
      /** @type {int32} */
      const n = length - 1;
      if (n < 60) {
        output.push(OpCodes.ToByte(OpCodes.Or8(PITHY_LITERAL, OpCodes.Shl8(n, 2))));
      } else if (n < 0x100) {
        output.push(OpCodes.ToByte(OpCodes.Or8(PITHY_LITERAL, OpCodes.Shl8(60, 2))));
        output.push(OpCodes.ToByte(n));
      } else if (n < 0x10000) {
        output.push(OpCodes.ToByte(OpCodes.Or8(PITHY_LITERAL, OpCodes.Shl8(61, 2))));
        this._pushSome(output, OpCodes.Unpack16LE(n), 2);
      } else if (n < 0x1000000) {
        output.push(OpCodes.ToByte(OpCodes.Or8(PITHY_LITERAL, OpCodes.Shl8(62, 2))));
        this._pushSome(output, OpCodes.Unpack32LE(n), 3);
      } else {
        output.push(OpCodes.ToByte(OpCodes.Or8(PITHY_LITERAL, OpCodes.Shl8(63, 2))));
        this._pushSome(output, OpCodes.Unpack32LE(n), 4);
      }

      for (let i = 0; i < length; ++i) {
        output.push(OpCodes.ToByte(src[start + i]));
      }
    }

    // Matches the reference's chunking: 63+-byte runs use the "greater than 63"
    // tag shape (62/63 length-escape values); the final remainder under 63 bytes
    // uses the "less than 63" shape, preferring the compact copy-1 tag.
    /**
     * @param {uint8[]} output - Output
     * @param {int32} offset - Match distance
     * @param {int32} length - Match length
     */
    _emitCopy(output, offset, length) {
      /** @type {int32} */
      let remaining = length;
      while (remaining >= 63) {
        /** @type {int32} */
        let chunk = this.MAX_COPY23_LENGTH;
        if (remaining <= this.MAX_COPY23_LENGTH) {
          chunk = remaining;
        } else if (remaining - this.MAX_COPY23_LENGTH < this.MIN_MATCH) {
          chunk = remaining - this.MIN_MATCH;
        }

        this._emitCopyGreaterThan63(output, offset, chunk);
        remaining -= chunk;
      }

      if (remaining > 0) {
        this._emitCopyLessThan63(output, offset, remaining);
      }
    }

    /**
     * @param {uint8[]} output - Output
     * @param {int32} offset - Match distance
     * @param {int32} length - Match length (below 63)
     */
    _emitCopyLessThan63(output, offset, length) {
      if (length < this.MAX_COPY1_LENGTH + 1 && offset <= this.MAX_COPY1_OFFSET) {
        output.push(OpCodes.ToByte(OpCodes.Or32(OpCodes.Or32(PITHY_COPY_1_BYTE, OpCodes.Shl32(length - 4, 2)), OpCodes.Shl32(OpCodes.Shr32(offset, 8), 5))));
        output.push(OpCodes.ToByte(offset));
        return;
      }

      /** @type {int32} */
      const type = offset <= this.MAX_COPY2_OFFSET ? PITHY_COPY_2_BYTE : PITHY_COPY_3_BYTE;
      output.push(OpCodes.ToByte(OpCodes.Or32(type, OpCodes.Shl32(length - 1, 2))));
      this._writeCopyOffset(output, offset, type);
    }

    /**
     * @param {uint8[]} output - Output
     * @param {int32} offset - Match distance
     * @param {int32} length - Match length (63 or more)
     */
    _emitCopyGreaterThan63(output, offset, length) {
      /** @type {int32} */
      const type = offset <= this.MAX_COPY2_OFFSET ? PITHY_COPY_2_BYTE : PITHY_COPY_3_BYTE;

      if (length <= this.MAX_COPY23_ESCAPE1_LENGTH) {
        output.push(OpCodes.ToByte(OpCodes.Or32(type, OpCodes.Shl32(this.COPY23_LEN_ESCAPE1, 2))));
        this._writeCopyOffset(output, offset, type);
        output.push(OpCodes.ToByte(length - 63));
      } else {
        output.push(OpCodes.ToByte(OpCodes.Or32(type, OpCodes.Shl32(this.COPY23_LEN_ESCAPE2, 2))));
        this._writeCopyOffset(output, offset, type);
        output.push(OpCodes.ToByte(length));
        output.push(OpCodes.ToByte(OpCodes.Shr16(length, 8)));
      }
    }

    /**
     * @param {uint8[]} output - Output
     * @param {int32} offset - Match distance
     * @param {int32} type - Copy tag type (2 or 3 offset bytes)
     */
    _writeCopyOffset(output, offset, type) {
      output.push(OpCodes.ToByte(offset));
      output.push(OpCodes.ToByte(OpCodes.Shr32(offset, 8)));
      if (type === PITHY_COPY_3_BYTE) {
        output.push(OpCodes.ToByte(OpCodes.Shr32(offset, 16)));
      }
    }

    // ===== DECOMPRESSION =====

    /**
     * @returns {uint8} Next byte of the stream (0 past the end), advancing readPos
     * @param {uint8[]} input - Compressed bytes
     */
    _nextByte(input) {
      return OpCodes.ToByte(input[this.readPos++]);
    }

    /**
     * @param {uint8[]} input - Varint size and tagged stream
     * @returns {uint8[]} Decoded bytes
     */
    _decompress(input) {
      this.readPos = 0;
      /** @type {uint32} */
      const originalSize = this._readVarint(input);

      /** @type {uint8[]} */
      const output = [];
      // Lengths can reach 2^32 on a corrupt stream, so positions are float64.
      /** @type {float64} */
      let pos = 0;

      while (pos < originalSize) {
        /** @type {uint8} */
        const tag = this._nextByte(input);
        /** @type {uint8} */
        const type = OpCodes.And8(tag, 0x3);

        if (type === PITHY_LITERAL) {
          /** @type {float64} */
          const len = this._readLiteralLength(input, OpCodes.Shr8(tag, 2));
          for (let k = 0; k < len; ++k) {
            output.push(OpCodes.ToByte(input[this.readPos + k]));
          }
          this.readPos += len;
          pos += len;
        } else if (type === PITHY_COPY_1_BYTE) {
          /** @type {int32} */
          const len = OpCodes.And32(OpCodes.Shr8(tag, 2), 0x7) + 4;
          /** @type {uint8} */
          const low = this._nextByte(input);
          /** @type {uint32} */
          const offset = OpCodes.Or32(OpCodes.Shl32(OpCodes.Shr8(tag, 5), 8), low);
          pos = this._copyMatch(output, pos, offset, len, originalSize);
        } else if (type === PITHY_COPY_2_BYTE) {
          /** @type {uint16} */
          const offset = OpCodes.Pack16LE(OpCodes.ToByte(input[this.readPos]), OpCodes.ToByte(input[this.readPos + 1]));
          this.readPos += 2;
          /** @type {int32} */
          const len = this._readCopy23Length(input, OpCodes.Shr8(tag, 2));
          pos = this._copyMatch(output, pos, offset, len, originalSize);
        } else { // PITHY_COPY_3_BYTE
          /** @type {uint32} */
          const offset = OpCodes.Or32(OpCodes.Or32(OpCodes.ToByte(input[this.readPos]), OpCodes.Shl32(OpCodes.ToByte(input[this.readPos + 1]), 8)), OpCodes.Shl32(OpCodes.ToByte(input[this.readPos + 2]), 16));
          this.readPos += 3;
          /** @type {int32} */
          const len = this._readCopy23Length(input, OpCodes.Shr8(tag, 2));
          pos = this._copyMatch(output, pos, offset, len, originalSize);
        }
      }

      return output;
    }

    /**
     * @param {uint8[]} output - Decoded bytes so far
     * @param {float64} pos - Current output position
     * @param {uint32} offset - Match distance
     * @param {int32} length - Match length
     * @param {uint32} limit - Output size
     * @returns {float64} New output position
     */
    _copyMatch(output, pos, offset, length, limit) {
      if (offset <= 0 || offset > pos) {
        throw new Error("Pithy: match offset " + offset + " invalid at position " + pos + ".");
      }

      /** @type {float64} */
      let at = pos;
      for (let k = 0; k < length && at < limit; ++k) {
        output.push(output[at - offset]);
        ++at;
      }

      return at;
    }

    /**
     * @param {uint8[]} input - Compressed bytes
     * @param {int32} n - Literal length field of the tag
     * @returns {float64} Literal run length
     */
    _readLiteralLength(input, n) {
      if (n < 60) {
        return n + 1;
      }
      if (n === 60) {
        /** @type {int32} */
        const one = this._nextByte(input);
        return one + 1;
      }
      if (n === 61) {
        /** @type {int32} */
        const v = OpCodes.Pack16LE(OpCodes.ToByte(input[this.readPos]), OpCodes.ToByte(input[this.readPos + 1]));
        this.readPos += 2;
        return v + 1;
      }
      if (n === 62) {
        /** @type {uint32} */
        const v = OpCodes.Or32(OpCodes.Or32(OpCodes.ToByte(input[this.readPos]), OpCodes.Shl32(OpCodes.ToByte(input[this.readPos + 1]), 8)), OpCodes.Shl32(OpCodes.ToByte(input[this.readPos + 2]), 16));
        this.readPos += 3;
        /** @type {float64} */
        const wide = v;
        return wide + 1;
      }
      /** @type {uint32} */
      const v = OpCodes.Pack32LE(
        OpCodes.ToByte(input[this.readPos]), OpCodes.ToByte(input[this.readPos + 1]),
        OpCodes.ToByte(input[this.readPos + 2]), OpCodes.ToByte(input[this.readPos + 3])
      );
      this.readPos += 4;
      /** @type {float64} */
      const wide = v;
      return wide + 1;
    }

    /**
     * @param {uint8[]} input - Compressed bytes
     * @param {int32} field - Length field of the tag
     * @returns {int32} Copy length
     */
    _readCopy23Length(input, field) {
      if (field < this.COPY23_LEN_ESCAPE1) {
        return field + 1;
      }
      if (field === this.COPY23_LEN_ESCAPE1) {
        /** @type {int32} */
        const one = this._nextByte(input);
        return one + 63;
      }
      /** @type {uint16} */
      const v = OpCodes.Pack16LE(OpCodes.ToByte(input[this.readPos]), OpCodes.ToByte(input[this.readPos + 1]));
      this.readPos += 2;
      return v;
    }

    /**
     * Write variable-length integer (varint) to output
     * 7 bits per byte, LSB first, continuation bit
     * @param {uint8[]} output - Output
     * @param {uint32} value - Value
     */
    _writeVarint(output, value) {
      /** @type {uint32} */
      let rest = value;
      while (rest >= 128) {
        output.push(OpCodes.Or32(OpCodes.And32(rest, 0x7F), 0x80));
        rest = OpCodes.Shr32(rest, 7);
      }
      output.push(OpCodes.And32(rest, 0x7F));
    }

    /**
     * Read a variable-length integer (varint), advancing readPos
     * @param {uint8[]} input - Compressed bytes
     * @returns {uint32} Value
     */
    _readVarint(input) {
      /** @type {uint32} */
      let result = 0;
      /** @type {int32} */
      let shift = 0;

      for (;;) {
        /** @type {uint8} */
        const byte = this._nextByte(input);
        result = OpCodes.Or32(result, OpCodes.Shl32(OpCodes.And32(byte, 0x7F), shift));
        if (OpCodes.And32(byte, 0x80) === 0) {
          return result;
        }
        shift += 7;
      }
    }
  }

  // Register algorithm
  RegisterAlgorithm(new PithyCompression());

  // Return for module systems
  return PithyCompression;
}));
