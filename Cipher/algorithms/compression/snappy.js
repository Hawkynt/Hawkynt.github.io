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
          input: [],
          expected: []
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
      this.MAX_HASH_TABLE_BITS = 14;
      this.MAX_HASH_TABLE_SIZE = OpCodes.Shl32(1, this.MAX_HASH_TABLE_BITS);
      this.MIN_MATCH_LENGTH = 4;
      this.MAX_OFFSET_1BYTE = 2048;
      this.MAX_OFFSET_2BYTE = 65536;
      this.MAX_LITERAL_LENGTH_SHORT = 60;
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
      if (this.inputBuffer.length === 0) {
        return [];
      }

      if (this.isInverse) {
        const result = this._decompress(new Uint8Array(this.inputBuffer));
        this.inputBuffer = [];
        return Array.from(result);
      } else {
        const result = this._compress(new Uint8Array(this.inputBuffer));
        this.inputBuffer = [];
        return Array.from(result);
      }
    }

    /**
     * Compress data using Snappy algorithm
     * Format: varint(uncompressed_length) + compressed_stream
     */
    _compress(input) {
      if (input.length === 0) {
        return new Uint8Array([]);
      }

      const output = [];

      // Write uncompressed length as varint (per spec)
      this._writeVarint(output, input.length);

      // For very small inputs, just use literals
      if (input.length<this.MIN_MATCH_LENGTH) {
        this._emitLiteral(output, input, 0, input.length);
        return new Uint8Array(output);
      }

      // Hash table for finding matches (LZ77)
      const hashTable = new Int32Array(this.MAX_HASH_TABLE_SIZE);
      hashTable.fill(-1);

      let inputPos = 0;
      let lastLiteralStart = 0;

      while (inputPos<input.length) {
        // Try to find a match at current position
        const match = this._findBestMatch(input, inputPos, hashTable);

        if (match.length>=this.MIN_MATCH_LENGTH && match.offset>0) {
          // Emit pending literals before the match
          if (inputPos>lastLiteralStart) {
            this._emitLiteral(output, input, lastLiteralStart, inputPos-lastLiteralStart);
          }

          // Emit copy instruction
          this._emitCopy(output, match.offset, match.length);

          // Update hash table for all matched positions
          const endPos = Math.min(inputPos+match.length, input.length);
          for (let i = inputPos; i<endPos-3; ++i) {
            const hash = this._hash4(input, i);
            hashTable[hash] = i;
          }

          inputPos += match.length;
          lastLiteralStart = inputPos;
        } else {
          // No good match, update hash and advance
          if (inputPos+3<input.length) {
            const hash = this._hash4(input, inputPos);
            hashTable[hash] = inputPos;
          }
          ++inputPos;
        }
      }

      // Emit remaining literals
      if (lastLiteralStart<input.length) {
        this._emitLiteral(output, input, lastLiteralStart, input.length-lastLiteralStart);
      }

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
        const tagType = tag&0x03;

        if (tagType === 0x00) {
          // Literal (tag type 00)
          let literalLength = OpCodes.Shr8(tag, 2)+1;

          // Extended length encoding for literals>60 bytes
          if (literalLength>this.MAX_LITERAL_LENGTH_SHORT+1) {
            const extraBytes = literalLength-this.MAX_LITERAL_LENGTH_SHORT-1;
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
          const length = OpCodes.Shr8(tag&0x1C, 2)+4;
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
     * Find best match at current position using hash table
     */
    _findBestMatch(input, pos, hashTable) {
      if (pos+this.MIN_MATCH_LENGTH>input.length) {
        return { offset: 0, length: 0 };
      }

      const hash = this._hash4(input, pos);
      const candidate = hashTable[hash];

      if (candidate<0 || candidate>=pos) {
        return { offset: 0, length: 0 };
      }

      const offset = pos-candidate;

      // Check if offset is in valid range
      if (offset === 0 || offset>this.MAX_OFFSET_2BYTE) {
        return { offset: 0, length: 0 };
      }

      // Match length - compare bytes
      let length = 0;
      const maxLength = Math.min(64, input.length-pos); // Max copy length is 64

      while (length<maxLength && input[candidate+length] === input[pos+length]) {
        ++length;
      }

      return { offset: offset, length: length };
    }

    /**
     * Hash function for 4-byte sequence (LZ77 hash)
     */
    _hash4(input, pos) {
      if (pos+3>=input.length) return 0;

      // Simple hash combining 4 bytes
      const hash = OpCodes.Shl32(input[pos], 8)^
                   OpCodes.Shl32(input[pos+1], 4)^
                   OpCodes.Shl32(input[pos+2], 2)^
                   input[pos+3];

      return hash&OpCodes.ToDWord(this.MAX_HASH_TABLE_SIZE-1);
    }

    /**
     * Write varint (variable-length integer) per Snappy spec
     * Lower 7 bits = data, upper bit = continuation flag
     */
    _writeVarint(output, value) {
      while (value>=0x80) {
        output.push((value&0x7F)|0x80);
        value = OpCodes.Shr32(value, 7);
      }
      output.push(value&0x7F);
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

        value |= OpCodes.Shl32(byte&0x7F, shift);

        if ((byte&0x80) === 0) {
          break;
        }

        shift += 7;
        if (shift>=32) break; // Prevent overflow
      }

      return { value: value, bytesRead: bytesRead };
    }

    /**
     * Emit literal bytes with Snappy tag encoding
     * Tag byte format: [length-1][00] for lengths 1-60
     */
    _emitLiteral(output, input, start, length) {
      if (length === 0) return;

      if (length<=this.MAX_LITERAL_LENGTH_SHORT) {
        // Short literal: tag = ((length-1) << 2) | 0x00
        output.push(OpCodes.Shl8(length-1, 2)|0x00);
      } else {
        // Extended literal length encoding
        const extraBytes = this._varintSize(length-1);
        output.push(OpCodes.Shl8(this.MAX_LITERAL_LENGTH_SHORT+extraBytes, 2)|0x00);

        // Write length-1 as little-endian bytes
        let remaining = length-1;
        for (let i = 0; i<extraBytes; ++i) {
          output.push(remaining&0xFF);
          remaining = OpCodes.Shr32(remaining, 8);
        }
      }

      // Copy literal bytes
      for (let i = 0; i<length; ++i) {
        output.push(input[start+i]);
      }
    }

    /**
     * Emit copy instruction with optimal tag type
     */
    _emitCopy(output, offset, length) {
      // Choose tag type based on offset size and length constraints
      if (offset<this.MAX_OFFSET_1BYTE && length>=4 && length<=11) {
        // 1-byte offset copy (tag type 01)
        // Length encoded as len-4 in bits 2-4
        // Offset upper 3 bits in bits 5-7, lower 8 bits in next byte
        const [offsetLow, offsetHigh] = OpCodes.Unpack16LE(offset);
        const tag = OpCodes.Shl8(length-4, 2)|OpCodes.Shl8(offsetHigh, 5)|0x01;
        output.push(tag, offsetLow);

      } else if (offset<this.MAX_OFFSET_2BYTE) {
        // 2-byte offset copy (tag type 10)
        // Length encoded as len-1 in upper 6 bits
        const [offsetLow, offsetHigh] = OpCodes.Unpack16LE(offset);
        const tag = OpCodes.Shl8(length-1, 2)|0x02;
        output.push(tag, offsetLow, offsetHigh);

      } else {
        // 4-byte offset copy (tag type 11)
        const [b0, b1, b2, b3] = OpCodes.Unpack32LE(offset);
        const tag = OpCodes.Shl8(length-1, 2)|0x03;
        output.push(tag, b0, b1, b2, b3);
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

    /**
     * Calculate minimum bytes needed for varint encoding
     */
    _varintSize(value) {
      if (value<OpCodes.Shl32(1, 8)) return 1;
      if (value<OpCodes.Shl32(1, 16)) return 2;
      if (value<OpCodes.Shl32(1, 24)) return 3;
      return 4;
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
