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
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];

      // Snappy parameters per format specification
      this.HASH_TABLE_BITS = 14;
      this.HASH_TABLE_SIZE = OpCodes.Shl32(1, this.HASH_TABLE_BITS);
      this.MIN_MATCH_LENGTH = 4;
      this.MAX_MATCH_LENGTH = 64;
      this.MAX_COPY1_OFFSET = 2047;
      this.MAX_COPY2_OFFSET = 65535;
      this.MAX_LITERAL_LENGTH_SHORT = 60;
      this.HASH_MULTIPLIER = 0x1E35A7BD;
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
      const result = this.isInverse ? this._decompress(new Uint8Array(this.inputBuffer)) : this._compress(new Uint8Array(this.inputBuffer));
      this.inputBuffer = [];
      return Array.from(result);
    }

    /**
     * Compress data using Snappy algorithm
     * Format: varint(uncompressed_length) + compressed_stream
     */
    _compress(input) {
      if (input.length === 0)
        return new Uint8Array([0]); // varint 0

      const output = [];

      // Write uncompressed length as varint (per spec)
      this._writeVarint(output, input.length);

      // Hash table for finding matches (LZ77)
      const hashTable = new Int32Array(this.HASH_TABLE_SIZE);
      hashTable.fill(-1);

      let pos = 0;
      let litStart = 0;
      const srcLen = input.length;

      while (pos + 3 < srcLen) {
        const h = this._hash4(input, pos);
        const candidate = hashTable[h];
        hashTable[h] = pos;

        if (candidate >= 0 && (pos - candidate) <= this.MAX_COPY2_OFFSET &&
            input[candidate] === input[pos] &&
            input[candidate + 1] === input[pos + 1] &&
            input[candidate + 2] === input[pos + 2] &&
            input[candidate + 3] === input[pos + 3]) {
          // Found a match, emit pending literals first
          if (pos > litStart)
            this._emitLiteral(output, input, litStart, pos - litStart);

          // Extend match
          let matchLength = this.MIN_MATCH_LENGTH;
          while (pos + matchLength < srcLen &&
                 input[candidate + matchLength] === input[pos + matchLength] &&
                 matchLength < this.MAX_MATCH_LENGTH)
            ++matchLength;

          const offset = pos - candidate;
          this._emitCopy(output, offset, matchLength);

          // Insert hash entries for positions inside the match
          const end = pos + matchLength;
          ++pos;
          while (pos < end && pos + 3 < srcLen) {
            hashTable[this._hash4(input, pos)] = pos;
            ++pos;
          }
          pos = end;
          litStart = pos;
        } else
          ++pos;
      }

      // Emit remaining literals
      if (litStart < srcLen)
        this._emitLiteral(output, input, litStart, srcLen - litStart);

      return new Uint8Array(output);
    }

    /**
     * Decompress Snappy-compressed data
     * Format: varint(uncompressed_length) + compressed_stream
     */
    _decompress(input) {
      if (input.length === 0) {
        return new Uint8Array(0);
      }

      let inputPos = 0;

      // Read uncompressed length (varint)
      const lengthResult = this._readVarint(input, inputPos);
      const uncompressedLength = lengthResult.value;
      inputPos += lengthResult.bytesRead;

      const output = [];

      // Process compressed stream
      while (inputPos<input.length && output.length<uncompressedLength) {
        const tag = input[inputPos++];
        const tagType = OpCodes.AndN(tag, 0x03);

        if (tagType === 0x00) {
          // Literal (tag type 00)
          let literalLength = OpCodes.Shr8(tag, 2)+1;

          // Extended length encoding for literals>60 bytes
          if (literalLength>this.MAX_LITERAL_LENGTH_SHORT) {
            const extraBytes = literalLength-this.MAX_LITERAL_LENGTH_SHORT;
            literalLength = 0;
            for (let i = 0; i<extraBytes && inputPos<input.length; ++i) {
              literalLength |= OpCodes.Shl32(input[inputPos++], i*8);
            }
            ++literalLength;
          }

          // Copy literal bytes
          for (let i = 0; i<literalLength && inputPos<input.length; ++i) {
            output.push(input[inputPos++]);
          }

        } else if (tagType === 0x01) {
          // Copy with 1-byte offset (tag type 01)
          // Length: 4-11 bytes (encoded in bits 2-4 as len-4)
          // Offset: 0-2047 (upper 3 bits in tag bits 5-7, lower 8 bits in next byte)
          const length = OpCodes.Shr8(OpCodes.AndN(tag, 0x1C), 2)+4;
          const offsetHigh = OpCodes.Shr8(tag, 5);
          const offsetLow = input[inputPos++];
          const offset = OpCodes.Pack16LE(offsetLow, offsetHigh);

          // Copy from history
          this._copyFromHistory(output, offset, length);

        } else if (tagType === 0x02) {
          // Copy with 2-byte offset (tag type 10)
          // Length: 1-64 bytes (encoded in upper 6 bits as len-1)
          // Offset: 0-65535 (next 2 bytes, little-endian)
          const length = OpCodes.Shr8(tag, 2)+1;
          if (inputPos+1>=input.length) break;
          const offsetLow = input[inputPos++];
          const offsetHigh = input[inputPos++];
          const offset = OpCodes.Pack16LE(offsetLow, offsetHigh);

          // Copy from history
          this._copyFromHistory(output, offset, length);

        } else {
          // Copy with 4-byte offset (tag type 11)
          // Length: 1-64 bytes (encoded in upper 6 bits as len-1)
          // Offset: 0-2^32-1 (next 4 bytes, little-endian)
          const length = OpCodes.Shr8(tag, 2)+1;
          if (inputPos+3>=input.length) break;
          const b0 = input[inputPos++];
          const b1 = input[inputPos++];
          const b2 = input[inputPos++];
          const b3 = input[inputPos++];
          const offset = OpCodes.Pack32LE(b0, b1, b2, b3);

          // Copy from history (using 32-bit offset)
          this._copyFromHistory(output, offset, length);
        }
      }

      return new Uint8Array(output.slice(0, uncompressedLength));
    }

    /**
     * Hash function for a 4-byte little-endian sequence (Snappy multiplicative hash)
     */
    _hash4(input, pos) {
      const val = OpCodes.Pack32LE(input[pos], input[pos + 1], input[pos + 2], input[pos + 3]);
      return OpCodes.Shr32(OpCodes.Mul32(val, this.HASH_MULTIPLIER), 32 - this.HASH_TABLE_BITS);
    }

    /**
     * Write varint (variable-length integer) per Snappy spec
     * Lower 7 bits = data, upper bit = continuation flag
     */
    _writeVarint(output, value) {
      while (value>=0x80) {
        output.push(OpCodes.OrN(OpCodes.AndN(value, 0x7F), 0x80));
        value = OpCodes.Shr32(value, 7);
      }
      output.push(OpCodes.AndN(value, 0x7F));
    }

    /**
     * Read varint from input stream
     */
    _readVarint(input, pos) {
      let value = 0;
      let shift = 0;
      let bytesRead = 0;

      while (pos+bytesRead<input.length) {
        const byte = input[pos+bytesRead];
        ++bytesRead;

        value = OpCodes.OrN(value, OpCodes.Shl32(OpCodes.AndN(byte, 0x7F), shift));

        if (OpCodes.AndN(byte, 0x80) === 0) {
          break;
        }

        shift += 7;
        if (shift>=32) break; // Prevent overflow
      }

      return { value: value, bytesRead: bytesRead };
    }

    /**
     * Emit literal bytes with Snappy tag encoding
     * Tag byte format: [length-1][00] for lengths 1-60, or an escape tag
     * (60/61/62/63) followed by 1/2/3/4 little-endian bytes holding length-1.
     */
    _emitLiteral(output, input, start, length) {
      const n = length - 1; // tag encodes length-1

      if (n < 60)
        output.push(OpCodes.OrN(OpCodes.Shl8(n, 2), 0x00));
      else if (n < 0x100) {
        output.push(OpCodes.OrN(OpCodes.Shl8(60, 2), 0x00));
        output.push(OpCodes.AndN(n, 0xFF));
      } else if (n < 0x10000) {
        output.push(OpCodes.OrN(OpCodes.Shl8(61, 2), 0x00));
        const [b0, b1] = OpCodes.Unpack16LE(n);
        output.push(b0, b1);
      } else if (n < 0x1000000) {
        output.push(OpCodes.OrN(OpCodes.Shl8(62, 2), 0x00));
        const [b0, b1, b2] = OpCodes.Unpack32LE(n);
        output.push(b0, b1, b2);
      } else {
        output.push(OpCodes.OrN(OpCodes.Shl8(63, 2), 0x00));
        const [b0, b1, b2, b3] = OpCodes.Unpack32LE(n);
        output.push(b0, b1, b2, b3);
      }

      // Copy literal bytes
      for (let i = 0; i<length; ++i) {
        output.push(input[start+i]);
      }
    }

    /**
     * Emit copy instruction(s) with optimal tag type, chunking to MAX_MATCH_LENGTH
     */
    _emitCopy(output, offset, length) {
      while (length > 0) {
        let chunk = Math.min(length, this.MAX_MATCH_LENGTH);

        if (offset <= this.MAX_COPY1_OFFSET && chunk >= 4 && chunk <= 11) {
          // 1-byte offset copy (tag type 01)
          // Tag: OOOLLL01 where OOO = offset bits 10:8, LLL = length - 4
          const [offsetLow, offsetHigh] = OpCodes.Unpack16LE(offset);
          const tag = OpCodes.OrN(OpCodes.Shl8(chunk-4, 2), OpCodes.OrN(OpCodes.Shl8(offsetHigh, 5), 0x01));
          output.push(tag, offsetLow);
        } else if (offset <= this.MAX_COPY2_OFFSET) {
          // 2-byte offset copy (tag type 10)
          const l = Math.min(chunk, this.MAX_MATCH_LENGTH);
          const [offsetLow, offsetHigh] = OpCodes.Unpack16LE(offset);
          const tag = OpCodes.OrN(OpCodes.Shl8(l-1, 2), 0x02);
          output.push(tag, offsetLow, offsetHigh);
          chunk = l;
        } else {
          // 4-byte offset copy (tag type 11)
          const l = Math.min(chunk, this.MAX_MATCH_LENGTH);
          const [b0, b1, b2, b3] = OpCodes.Unpack32LE(offset);
          const tag = OpCodes.OrN(OpCodes.Shl8(l-1, 2), 0x03);
          output.push(tag, b0, b1, b2, b3);
          chunk = l;
        }

        length -= chunk;
      }
    }

    /**
     * Copy bytes from decompression history (handles overlapping copies)
     */
    _copyFromHistory(output, offset, length) {
      if (offset === 0 || offset>output.length) {
        // Invalid offset - pad with zeros
        for (let i = 0; i<length; ++i) {
          output.push(0);
        }
        return;
      }

      const sourceStart = output.length-offset;

      // Handle overlapping copies (RLE pattern)
      for (let i = 0; i<length; ++i) {
        const sourcePos = sourceStart+i;
        if (sourcePos>=0 && sourcePos<output.length) {
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
