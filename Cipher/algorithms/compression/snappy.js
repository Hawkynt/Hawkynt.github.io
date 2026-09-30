/*
 * Snappy Compression Algorithm - Production Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Snappy - Fast compression/decompression library developed by Google
 * Based on LZ77 with no entropy encoding, optimized for speed over compression ratio
 *
 * Reference: https://github.com/google/snappy/blob/main/format_description.txt
 * Specification: Snappy Format Description (Last revised: 2011-10-05)
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

  // ===== ALGORITHM IMPLEMENTATION =====

  class SnappyCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Snappy";
      this.description = "Fast LZ77-based compression algorithm developed by Google in 2011. Optimizes for speed over compression ratio with typical compression speeds of 250-500 MB/s and decompression speeds over 1 GB/s. Uses byte-oriented encoding without entropy coding.";
      this.inventor = "Google (Jeff Dean, Steinar H. Gunderson)";
      this.year = 2011;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "LZ77 Dictionary-based";
      this.securityStatus = null; // Compression algorithm, not cryptographic
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Snappy GitHub Repository", "https://github.com/google/snappy"),
        new LinkItem("Snappy Format Description", "https://github.com/google/snappy/blob/main/format_description.txt"),
        new LinkItem("Snappy Framing Format", "https://github.com/google/snappy/blob/main/framing_format.txt")
      ];

      this.references = [
        new LinkItem("Wikipedia - Snappy", "https://en.wikipedia.org/wiki/Snappy_(compression)"),
        new LinkItem("Google Official Page", "http://google.github.io/snappy/")
      ];

      // Official test vectors based on Snappy format specification
      // Format: varint(uncompressed_length) + compressed_data
      // Tag byte lower 2 bits: 00=literal, 01=copy1byte, 10=copy2byte, 11=copy4byte
      this.tests = [
        {
          text: "Empty input - edge case",
          uri: "https://github.com/google/snappy/blob/main/format_description.txt",
          // Compressed: 0x00 (varint: length=0), no payload
          input: [],
          expected: [0x00]
        },
        {
          text: "Single byte 'A' - literal tag 0x00, length 1",
          uri: "https://github.com/google/snappy/blob/main/format_description.txt",
          // Compressed: 0x01 (varint: length=1), 0x00 (tag: literal len=1), 0x41 ('A')
          input: OpCodes.AnsiToBytes("A"),
          expected: [0x01, 0x00, 0x41]
        },
        {
          text: "Two bytes 'AB' - literal tag, length 2",
          uri: "https://github.com/google/snappy/blob/main/format_description.txt",
          // Compressed: 0x02 (varint: length=2), 0x04 (tag: literal len=2), 0x41, 0x42
          input: OpCodes.AnsiToBytes("AB"),
          expected: [0x02, 0x04, 0x41, 0x42]
        },
        {
          text: "Three bytes 'abc' - literal tag, length 3",
          uri: "https://github.com/google/snappy/blob/main/format_description.txt",
          // Compressed: 0x03 (varint: length=3), 0x08 (tag: literal len=3), 0x61, 0x62, 0x63
          input: OpCodes.AnsiToBytes("abc"),
          expected: [0x03, 0x08, 0x61, 0x62, 0x63]
        },
        {
          text: "Repeated pattern 'AAAAAAAA' - literal + copy1 encoding",
          uri: "https://github.com/google/snappy/blob/main/snappy_unittest.cc",
          // Input: 8 'A's (0x41)
          // Compressed: 0x08 (varint: length=8)
          //   0x00 (literal len=1), 0x41 ('A')
          //   0x0D (copy1: len-4=3, so len=7, offset_high=0), 0x01 (offset_low=1)
          // Tag 0x0D = 13 = 0b00001101: bits[2-4]=3 (len-4), bits[5-7]=0 (offset_high), bits[0-1]=01 (copy1)
          input: [0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41],
          expected: [0x08, 0x00, 0x41, 0x0D, 0x01]
        },
        {
          text: "Pattern 'abcabcabc' - literal + copy1 with offset 3",
          uri: "https://github.com/golang/snappy/blob/master/snappy_test.go",
          // Input: "abcabcabc" (9 bytes)
          // Compressed: 0x09 (varint: length=9)
          //   0x08 (literal len=3), 0x61, 0x62, 0x63 ('abc')
          //   0x09 (copy1: len-4=2, so len=6, offset_high=0), 0x03 (offset_low=3)
          // Tag 0x09 = 9 = 0b00001001: bits[2-4]=2 (len-4), bits[5-7]=0 (offset_high), bits[0-1]=01 (copy1)
          input: OpCodes.AnsiToBytes("abcabcabc"),
          expected: [0x09, 0x08, 0x61, 0x62, 0x63, 0x09, 0x03]
        },
        {
          text: "Short text 'blah blah blah' - copy1 encoding",
          uri: "https://github.com/google/snappy/blob/main/format_description.txt",
          // Input: "blah blah blah" (14 bytes with spaces)
          // Compressed: 0x0E (varint: length=14)
          //   0x10 (literal len=5), 'b','l','a','h',' '
          //   0x15 (copy1: len-4=5, so len=9, offset_high=0), 0x05 (offset_low=5)
          // Tag 0x15 = 21 = 0b00010101: bits[2-4]=5 (len-4), bits[5-7]=0 (offset_high), bits[0-1]=01 (copy1)
          input: OpCodes.AnsiToBytes("blah blah blah"),
          expected: [0x0E, 0x10, 0x62, 0x6C, 0x61, 0x68, 0x20, 0x15, 0x05]
        },
        {
          text: "Text sample with real copy matches - 'the quick brown fox...' x4",
          uri: "https://github.com/google/snappy/blob/main/format_description.txt",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. ".repeat(4)),
          expected: [
            0xb4, 0x01, 0x78, 0x74, 0x68, 0x65, 0x20, 0x71, 0x75, 0x69, 0x63, 0x6b, 0x20, 0x62, 0x72, 0x6f,
            0x77, 0x6e, 0x20, 0x66, 0x6f, 0x78, 0x20, 0x6a, 0x75, 0x6d, 0x70, 0x73, 0x20, 0x6f, 0x76, 0x65,
            0x72, 0x20, 0x01, 0x1f, 0x20, 0x6c, 0x61, 0x7a, 0x79, 0x20, 0x64, 0x6f, 0x67, 0x2e, 0x05, 0x0e,
            0xfe, 0x2d, 0x00, 0xfe, 0x2d, 0x00, 0x08, 0x67, 0x2e, 0x20
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
      return new SnappyInstance(this, isInverse);
    }
  }

  // Snappy compression instance - production implementation
  /**
 * Snappy cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SnappyInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {SnappyCompression} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];

      // Snappy parameters per format specification
      /** @type {int32} */
      this.HASH_TABLE_BITS = 14;
      /** @type {int32} */
      this.HASH_TABLE_SIZE = OpCodes.Shl32(1, this.HASH_TABLE_BITS);
      /** @type {int32} */
      this.MIN_MATCH_LENGTH = 4;
      /** @type {int32} */
      this.MAX_MATCH_LENGTH = 64;
      /** @type {int32} */
      this.MAX_COPY1_OFFSET = 2047;
      /** @type {int32} */
      this.MAX_COPY2_OFFSET = 65535;
      /** @type {int32} */
      this.MAX_LITERAL_LENGTH_SHORT = 60;
      /** @type {uint32} */
      this.HASH_MULTIPLIER = 0x1E35A7BD;

      // Number of bytes the last _readVarint call consumed
      /** @type {int32} */
      this.varintConsumed = 0;
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

    /**
     * Compress data using Snappy algorithm
     * Format: varint(uncompressed_length) + compressed_stream
     * @param {uint8[]} input - Input bytes
     * @returns {uint8[]} Compressed bytes
     */
    _compress(input) {
      if (input.length === 0) {
        /** @type {uint8[]} */
        const zeroLength = new Uint8Array(1); // varint 0
        return zeroLength;
      }

      /** @type {uint8[]} */
      const output = [];

      // Write uncompressed length as varint (per spec)
      this._writeVarint(output, input.length);

      // Hash table for finding matches (LZ77)
      /** @type {int32[]} */
      const hashTable = new Int32Array(this.HASH_TABLE_SIZE);
      hashTable.fill(-1);

      /** @type {int32} */
      let pos = 0;
      /** @type {int32} */
      let litStart = 0;
      /** @type {int32} */
      const srcLen = input.length;

      while (pos + 3 < srcLen) {
        /** @type {uint32} */
        const h = this._hash4(input, pos);
        /** @type {int32} */
        const candidate = hashTable[h];
        hashTable[h] = pos;

        if (candidate >= 0 && (pos - candidate) <= this.MAX_COPY2_OFFSET &&
            this._sameFour(input, candidate, pos)) {
          // Found a match, emit pending literals first
          if (pos > litStart) {
            this._emitLiteral(output, input, litStart, pos - litStart);
          }

          // Extend match
          /** @type {int32} */
          let matchLength = this.MIN_MATCH_LENGTH;
          while (pos + matchLength < srcLen &&
                 input[candidate + matchLength] === input[pos + matchLength] &&
                 matchLength < this.MAX_MATCH_LENGTH) {
            ++matchLength;
          }

          /** @type {int32} */
          const offset = pos - candidate;
          this._emitCopy(output, offset, matchLength);

          // Insert hash entries for positions inside the match
          /** @type {int32} */
          const end = pos + matchLength;
          ++pos;
          while (pos < end && pos + 3 < srcLen) {
            hashTable[this._hash4(input, pos)] = pos;
            ++pos;
          }
          pos = end;
          litStart = pos;
        } else {
          ++pos;
        }
      }

      // Emit remaining literals
      if (litStart < srcLen) {
        this._emitLiteral(output, input, litStart, srcLen - litStart);
      }

      /** @type {uint8[]} */
      const packed = new Uint8Array(output);
      return packed;
    }

    /**
     * @param {uint8[]} input - Bytes
     * @param {int32} a - First position
     * @param {int32} b - Second position
     * @returns {boolean} True when the four bytes at a and b are equal
     */
    _sameFour(input, a, b) {
      return input[a] === input[b] &&
        input[a + 1] === input[b + 1] &&
        input[a + 2] === input[b + 2] &&
        input[a + 3] === input[b + 3];
    }

    /**
     * Decompress Snappy-compressed data
     * Format: varint(uncompressed_length) + compressed_stream
     * @param {uint8[]} input - Compressed bytes
     * @returns {uint8[]} Decoded bytes
     */
    _decompress(input) {
      if (input.length === 0) {
        /** @type {uint8[]} */
        const empty = new Uint8Array(0);
        return empty;
      }

      /** @type {int32} */
      let inputPos = 0;

      // Read uncompressed length (varint); like the reference, a length with
      // bit 31 set reads as negative and nothing is decoded.
      /** @type {int32} */
      const uncompressedLength = this._readVarint(input, inputPos);
      inputPos += this.varintConsumed;

      /** @type {uint8[]} */
      const output = [];

      // Process compressed stream
      while (inputPos < input.length && output.length < uncompressedLength) {
        /** @type {uint8} */
        const tag = input[inputPos++];
        /** @type {uint32} */
        const tagType = OpCodes.And32(tag, 0x03);

        if (tagType === 0x00) {
          // Literal (tag type 00)
          /** @type {int32} */
          let literalLength = OpCodes.Shr8(tag, 2) + 1;

          // Extended length encoding for literals>60 bytes; the OR is a signed
          // 32-bit one, so a four-byte length with bit 31 set is negative
          if (literalLength > this.MAX_LITERAL_LENGTH_SHORT) {
            /** @type {int32} */
            const extraBytes = literalLength - this.MAX_LITERAL_LENGTH_SHORT;
            literalLength = 0;
            for (let i = 0; i < extraBytes && inputPos < input.length; ++i) {
              literalLength = OpCodes.ToInt(OpCodes.Or32(literalLength, OpCodes.Shl32(input[inputPos++], i * 8)));
            }
            ++literalLength;
          }

          // Copy literal bytes
          for (let i = 0; i < literalLength && inputPos < input.length; ++i) {
            output.push(input[inputPos++]);
          }

        } else if (tagType === 0x01) {
          // Copy with 1-byte offset (tag type 01)
          // Length: 4-11 bytes (encoded in bits 2-4 as len-4)
          // Offset: 0-2047 (upper 3 bits in tag bits 5-7, lower 8 bits in next byte)
          /** @type {int32} */
          const length = OpCodes.Shr8(OpCodes.And32(tag, 0x1C), 2) + 4;
          /** @type {uint8} */
          const offsetHigh = OpCodes.Shr8(tag, 5);
          /** @type {uint8} */
          const offsetLow = input[inputPos++];
          /** @type {uint16} */
          const offset = OpCodes.Pack16LE(offsetLow, offsetHigh);

          // Copy from history
          this._copyFromHistory(output, offset, length);

        } else if (tagType === 0x02) {
          // Copy with 2-byte offset (tag type 10)
          // Length: 1-64 bytes (encoded in upper 6 bits as len-1)
          // Offset: 0-65535 (next 2 bytes, little-endian)
          /** @type {int32} */
          const length = OpCodes.Shr8(tag, 2) + 1;
          if (inputPos + 1 >= input.length) {
            break;
          }
          /** @type {uint8} */
          const offsetLow = input[inputPos++];
          /** @type {uint8} */
          const offsetHigh = input[inputPos++];
          /** @type {uint16} */
          const offset = OpCodes.Pack16LE(offsetLow, offsetHigh);

          // Copy from history
          this._copyFromHistory(output, offset, length);

        } else {
          // Copy with 4-byte offset (tag type 11)
          // Length: 1-64 bytes (encoded in upper 6 bits as len-1)
          // Offset: 0-2^32-1 (next 4 bytes, little-endian)
          /** @type {int32} */
          const length = OpCodes.Shr8(tag, 2) + 1;
          if (inputPos + 3 >= input.length) {
            break;
          }
          /** @type {uint8} */
          const b0 = input[inputPos++];
          /** @type {uint8} */
          const b1 = input[inputPos++];
          /** @type {uint8} */
          const b2 = input[inputPos++];
          /** @type {uint8} */
          const b3 = input[inputPos++];
          /** @type {uint32} */
          const offset = OpCodes.Pack32LE(b0, b1, b2, b3);

          // Copy from history (using 32-bit offset)
          this._copyFromHistory(output, offset, length);
        }
      }

      /** @type {uint8[]} */
      const decoded = new Uint8Array(output.slice(0, uncompressedLength));
      return decoded;
    }

    /**
     * Hash function for a 4-byte little-endian sequence (Snappy multiplicative hash)
     * @param {uint8[]} input - Bytes
     * @param {int32} pos - Position of the four hashed bytes
     * @returns {uint32} Hash table index
     */
    _hash4(input, pos) {
      /** @type {uint32} */
      const val = OpCodes.Pack32LE(input[pos], input[pos + 1], input[pos + 2], input[pos + 3]);
      return OpCodes.Shr32(OpCodes.Mul32(val, this.HASH_MULTIPLIER), 32 - this.HASH_TABLE_BITS);
    }

    /**
     * Write varint (variable-length integer) per Snappy spec
     * Lower 7 bits = data, upper bit = continuation flag
     * @param {uint8[]} output - Output
     * @param {uint32} value - Value
     */
    _writeVarint(output, value) {
      /** @type {uint32} */
      let rest = value;
      while (rest >= 0x80) {
        output.push(OpCodes.Or32(OpCodes.And32(rest, 0x7F), 0x80));
        rest = OpCodes.Shr32(rest, 7);
      }
      output.push(OpCodes.And32(rest, 0x7F));
    }

    /**
     * Read varint from input stream (at most five bytes). The value is
     * assembled with a signed 32-bit OR, so bit 31 makes it negative. The
     * number of bytes consumed is left in varintConsumed.
     * @param {uint8[]} input - Bytes
     * @param {int32} pos - Position of the varint
     * @returns {int32} Value
     */
    _readVarint(input, pos) {
      /** @type {int32} */
      let value = 0;
      /** @type {int32} */
      let shift = 0;
      /** @type {int32} */
      let consumed = 0;

      while (pos + consumed < input.length) {
        /** @type {uint8} */
        const byte = input[pos + consumed];
        ++consumed;

        value = OpCodes.ToInt(OpCodes.Or32(value, OpCodes.Shl32(OpCodes.And32(byte, 0x7F), shift)));

        if (OpCodes.And32(byte, 0x80) === 0) {
          break;
        }

        shift += 7;
        if (shift >= 32) {
          break; // Prevent overflow
        }
      }

      this.varintConsumed = consumed;
      return value;
    }

    /**
     * Emit literal bytes with Snappy tag encoding
     * Tag byte format: [length-1][00] for lengths 1-60, or an escape tag
     * (60/61/62/63) followed by 1/2/3/4 little-endian bytes holding length-1.
     * @param {uint8[]} output - Output
     * @param {uint8[]} input - Source bytes
     * @param {int32} start - First literal
     * @param {int32} length - Number of literals
     */
    _emitLiteral(output, input, start, length) {
      /** @type {int32} */
      const n = length - 1; // tag encodes length-1

      if (n < 60) {
        output.push(OpCodes.Shl8(n, 2));
      } else if (n < 0x100) {
        output.push(OpCodes.Shl8(60, 2));
        output.push(OpCodes.And32(n, 0xFF));
      } else if (n < 0x10000) {
        output.push(OpCodes.Shl8(61, 2));
        /** @type {uint8[]} */
        const two = OpCodes.Unpack16LE(n);
        output.push(two[0]);
        output.push(two[1]);
      } else if (n < 0x1000000) {
        output.push(OpCodes.Shl8(62, 2));
        /** @type {uint8[]} */
        const three = OpCodes.Unpack32LE(n);
        output.push(three[0]);
        output.push(three[1]);
        output.push(three[2]);
      } else {
        output.push(OpCodes.Shl8(63, 2));
        /** @type {uint8[]} */
        const four = OpCodes.Unpack32LE(n);
        output.push(four[0]);
        output.push(four[1]);
        output.push(four[2]);
        output.push(four[3]);
      }

      // Copy literal bytes
      for (let i = 0; i < length; ++i) {
        output.push(input[start + i]);
      }
    }

    /**
     * Emit copy instruction(s) with optimal tag type, chunking to MAX_MATCH_LENGTH
     * @param {uint8[]} output - Output
     * @param {int32} offset - Match distance
     * @param {int32} length - Match length
     */
    _emitCopy(output, offset, length) {
      /** @type {int32} */
      let remaining = length;
      while (remaining > 0) {
        /** @type {int32} */
        let chunk = Math.min(remaining, this.MAX_MATCH_LENGTH);

        if (offset <= this.MAX_COPY1_OFFSET && chunk >= 4 && chunk <= 11) {
          // 1-byte offset copy (tag type 01)
          // Tag: OOOLLL01 where OOO = offset bits 10:8, LLL = length - 4
          /** @type {uint8[]} */
          const offsetBytes = OpCodes.Unpack16LE(offset);
          /** @type {uint32} */
          const tag = OpCodes.Or32(OpCodes.Shl8(chunk - 4, 2), OpCodes.Or32(OpCodes.Shl8(offsetBytes[1], 5), 0x01));
          output.push(tag);
          output.push(offsetBytes[0]);
        } else if (offset <= this.MAX_COPY2_OFFSET) {
          // 2-byte offset copy (tag type 10)
          /** @type {int32} */
          const l = Math.min(chunk, this.MAX_MATCH_LENGTH);
          /** @type {uint8[]} */
          const offsetBytes = OpCodes.Unpack16LE(offset);
          /** @type {uint32} */
          const tag = OpCodes.Or32(OpCodes.Shl8(l - 1, 2), 0x02);
          output.push(tag);
          output.push(offsetBytes[0]);
          output.push(offsetBytes[1]);
          chunk = l;
        } else {
          // 4-byte offset copy (tag type 11)
          /** @type {int32} */
          const l = Math.min(chunk, this.MAX_MATCH_LENGTH);
          /** @type {uint8[]} */
          const offsetBytes = OpCodes.Unpack32LE(offset);
          /** @type {uint32} */
          const tag = OpCodes.Or32(OpCodes.Shl8(l - 1, 2), 0x03);
          output.push(tag);
          output.push(offsetBytes[0]);
          output.push(offsetBytes[1]);
          output.push(offsetBytes[2]);
          output.push(offsetBytes[3]);
          chunk = l;
        }

        remaining -= chunk;
      }
    }

    /**
     * Copy bytes from decompression history (handles overlapping copies)
     * @param {uint8[]} output - Decoded bytes so far
     * @param {uint32} offset - Distance back
     * @param {int32} length - Number of bytes
     */
    _copyFromHistory(output, offset, length) {
      if (offset === 0 || offset > output.length) {
        // Invalid offset - pad with zeros
        for (let i = 0; i < length; ++i) {
          output.push(0);
        }
        return;
      }

      /** @type {int32} */
      const sourceStart = output.length - offset;

      // Handle overlapping copies (RLE pattern)
      for (let i = 0; i < length; ++i) {
        /** @type {int32} */
        const sourcePos = sourceStart + i;
        if (sourcePos >= 0 && sourcePos < output.length) {
          output.push(output[sourcePos]);
        } else {
          output.push(0);
        }
      }
    }
  }


  // ===== REGISTRATION =====

  const algorithmInstance = new SnappyCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SnappyCompression, SnappyInstance };
}));
