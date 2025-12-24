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

  const PITHY_LITERAL = 0;          // Tag type 00: literal bytes
  const PITHY_COPY_1_BYTE = 1;      // Tag type 01: copy with 1-byte offset
  const PITHY_COPY_2_BYTE = 2;      // Tag type 10: copy with 2-byte offset
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

      // Test vectors based on Pithy format specification
      // Format: varint(uncompressed_length) + compressed_data
      // Tag byte lower 2 bits: 00=literal, 01=copy1byte, 10=copy2byte, 11=copy3byte
      // Upper 6 bits encode length-1 for literals, or copy parameters
      this.tests = [
        {
          text: "Empty input - edge case",
          uri: "https://github.com/johnezang/pithy/blob/master/pithy.c",
          input: [],
          expected: []
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
          // Tag: (OpCodes.Shl32((59 + extraBytes), 2))|0 where extraBytes=1 for 60+5=65 bytes
          // Tag = (60 << 2) = 240 = 0xF0
          input: Array.from({length: 65}, (_, i) => i&0xFF),
          expected: (() => {
            const result = [0x41]; // varint: 65
            result.push(0xF0); // literal tag: (60 << 2)|0 = 240
            result.push(0x05); // extra length byte: 60 + 5 = 65
            result.push(...Array.from({length: 65}, (_, i) => i&0xFF));
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

  // Pithy compression instance - production implementation
  /**
 * Pithy cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PithyInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];

      // Pithy parameters based on reference implementation
      this.MAX_HASH_TABLE_BITS = 14;
      this.MAX_HASH_TABLE_SIZE = OpCodes.Shl32(1, this.MAX_HASH_TABLE_BITS);
      this.MIN_MATCH_LENGTH = 4;       // Pithy minimum match is 4 bytes
      this.MAX_OFFSET_1BYTE = 2048;    // 11-bit offset (5 bits high + 8 bits low - 3 bits for len)
      this.MAX_OFFSET_2BYTE = 65536;   // 16-bit offset
      this.MAX_LITERAL_LENGTH_SHORT = 60; // Switch to extended encoding at 60
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
     * Compress data using Pithy algorithm
     * Format: varint(uncompressed_length) + compressed_stream
     */
    _compress(input) {
      if (input.length === 0) {
        return new Uint8Array([]);
      }

      const output = [];

      // Write uncompressed length as varint
      this._writeVarint(output, input.length);

      // For very small inputs, just use literals
      if (input.length < this.MIN_MATCH_LENGTH) {
        this._emitLiteral(output, input, 0, input.length);
        return new Uint8Array(output);
      }

      // Hash table for match finding (stores positions)
      const hashTable = new Int32Array(this.MAX_HASH_TABLE_SIZE);
      hashTable.fill(-1);

      let ip = 0; // Input pointer
      let literalStart = 0; // Start of pending literal run

      while (ip < input.length) {
        // Try to find a match
        let bestMatchLength = 0;
        let bestMatchOffset = 0;

        // Only try matching if we have enough bytes left
        if (ip + this.MIN_MATCH_LENGTH <= input.length) {
          const hash = this._hash4(input, ip);
          const candidate = hashTable[hash];

          // Update hash table for next time
          hashTable[hash] = ip;

          // Check if we found a valid match
          if (candidate >= 0 && candidate < ip && ip - candidate < this.MAX_OFFSET_2BYTE) {
            const matchLength = this._findMatchLength(input, candidate, ip);
            if (matchLength >= this.MIN_MATCH_LENGTH) {
              bestMatchLength = matchLength;
              bestMatchOffset = ip - candidate;
            }
          }
        }

        if (bestMatchLength >= this.MIN_MATCH_LENGTH) {
          // Emit pending literals before the match
          if (literalStart < ip) {
            this._emitLiteral(output, input, literalStart, ip - literalStart);
          }

          // Emit copy instruction
          this._emitCopy(output, bestMatchOffset, bestMatchLength);

          // Update hash table for positions within the match (except last position)
          for (let i = 1; i < bestMatchLength - 1; i++) {
            if (ip + i + this.MIN_MATCH_LENGTH <= input.length) {
              const h = this._hash4(input, ip + i);
              hashTable[h] = ip + i;
            }
          }

          ip += bestMatchLength;
          literalStart = ip;
        } else {
          ip++;
        }
      }

      // Emit remaining literals
      if (literalStart < input.length) {
        this._emitLiteral(output, input, literalStart, input.length - literalStart);
      }

      return new Uint8Array(output);
    }

    /**
     * Decompress Pithy-compressed data
     */
    _decompress(input) {
      if (input.length === 0) {
        return new Uint8Array([]);
      }

      let ip = 0; // Input pointer

      // Read uncompressed length
      const [uncompressedLength, varintLen] = this._readVarint(input, ip);
      ip += varintLen;

      const output = new Uint8Array(uncompressedLength);
      let op = 0; // Output pointer

      while (ip < input.length && op < uncompressedLength) {
        const tag = input[ip++];
        const tagType = OpCodes.And32(tag, 0x03);

        if (tagType === PITHY_LITERAL) {
          // Literal bytes
          let literalLen = OpCodes.Shr32(tag, 2);

          if (literalLen >= 60) {
            // Extended literal length
            const extraBytes = literalLen - 59;
            literalLen = 60;
            for (let i = 0; i < extraBytes; i++) {
              literalLen += OpCodes.Shl32(input[ip++], i * 8);
            }
          } else {
            literalLen += 1; // Length is encoded as len-1
          }

          // Copy literal bytes
          for (let i = 0; i < literalLen; i++) {
            output[op++] = input[ip++];
          }
        } else {
          // Copy operation
          let copyLen;
          let copyOffset;

          if (tagType === PITHY_COPY_1_BYTE) {
            // 1-byte offset (11 bits total: 3 bits length, 5 bits offset high, 8 bits offset low - 3 bits for type)
            const lenBits = OpCodes.And32(OpCodes.Shr32(tag, 2), 0x07); // 3 bits for length-4
            copyLen = lenBits + 4;
            const offsetHigh = OpCodes.Shr32(tag, 5); // 5 bits
            const offsetLow = input[ip++];
            copyOffset = OpCodes.Or32(OpCodes.Shl32(offsetHigh, 8), offsetLow);
          } else if (tagType === PITHY_COPY_2_BYTE) {
            // 2-byte offset
            copyLen = OpCodes.Shr32(tag, 2) + 1;
            if (copyLen >= 64) {
              // Extended copy length
              const extraBytes = copyLen - 63;
              copyLen = 64;
              for (let i = 0; i < extraBytes; i++) {
                copyLen += OpCodes.Shl32(input[ip++], i * 8);
              }
            }
            copyOffset = OpCodes.Or32(input[ip++], OpCodes.Shl32(input[ip++], 8));
          } else { // PITHY_COPY_3_BYTE
            // 3-byte offset
            copyLen = OpCodes.Shr32(tag, 2) + 1;
            if (copyLen >= 64) {
              // Extended copy length
              const extraBytes = copyLen - 63;
              copyLen = 64;
              for (let i = 0; i < extraBytes; i++) {
                copyLen += OpCodes.Shl32(input[ip++], i * 8);
              }
            }
            copyOffset = OpCodes.Or32(OpCodes.Or32(input[ip++], OpCodes.Shl32(input[ip++], 8)), OpCodes.Shl32(input[ip++], 16));
          }

          // Copy from earlier in output
          const copyStart = op - copyOffset;
          for (let i = 0; i < copyLen; i++) {
            output[op++] = output[copyStart + i];
          }
        }
      }

      return output.slice(0, op);
    }

    /**
     * Emit literal bytes to output stream
     */
    _emitLiteral(output, input, start, length) {
      while (length > 0) {
        const chunkLen = Math.min(length, 65535);

        if (chunkLen < 60) {
          // Short literal: encode length-1 in upper 6 bits
          const tag = OpCodes.Or32(OpCodes.Shl32(chunkLen - 1, 2), PITHY_LITERAL);
          output.push(tag);
        } else {
          // Long literal: tag indicates extended length
          const lenMinusBase = chunkLen - 60;
          let extraBytes = 0;
          let temp = lenMinusBase;

          // Count extra bytes needed
          do {
            extraBytes++;
            temp = OpCodes.Shr32(temp, 8);
          } while (temp > 0);

          // Emit tag with extra byte count
          const tag = OpCodes.Or32(OpCodes.Shl32(59 + extraBytes, 2), PITHY_LITERAL);
          output.push(tag);

          // Emit extra length bytes (little-endian)
          temp = lenMinusBase;
          for (let i = 0; i < extraBytes; i++) {
            output.push(OpCodes.And32(temp, 0xFF));
            temp = OpCodes.Shr32(temp, 8);
          }
        }

        // Copy literal bytes
        for (let i = 0; i < chunkLen; i++) {
          output.push(input[start + i]);
        }

        start += chunkLen;
        length -= chunkLen;
      }
    }

    /**
     * Emit copy instruction to output stream
     */
    _emitCopy(output, offset, length) {
      // Handle long copies in chunks
      while (length > 0) {
        const chunkLen = Math.min(length, 65535);

        if (offset < this.MAX_OFFSET_1BYTE && chunkLen < 12) {
          // 1-byte offset encoding (short copies)
          // 3 bits for length-4, 5 bits for offset high, 8 bits for offset low
          const lenBits = OpCodes.And32(chunkLen - 4, 0x07);
          const offsetHigh = OpCodes.And32(OpCodes.Shr32(offset, 8), 0x1F);
          const tag = OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(offsetHigh, 5), OpCodes.Shl32(lenBits, 2)), PITHY_COPY_1_BYTE);
          output.push(tag);
          output.push(OpCodes.And32(offset, 0xFF));
        } else if (offset < this.MAX_OFFSET_2BYTE) {
          // 2-byte offset encoding
          if (chunkLen < 64) {
            const tag = OpCodes.Or32(OpCodes.Shl32(chunkLen - 1, 2), PITHY_COPY_2_BYTE);
            output.push(tag);
          } else {
            // Extended length
            const lenMinusBase = chunkLen - 64;
            let extraBytes = 0;
            let temp = lenMinusBase;

            do {
              extraBytes++;
              temp = OpCodes.Shr32(temp, 8);
            } while (temp > 0);

            const tag = OpCodes.Or32(OpCodes.Shl32(63 + extraBytes, 2), PITHY_COPY_2_BYTE);
            output.push(tag);

            temp = lenMinusBase;
            for (let i = 0; i < extraBytes; i++) {
              output.push(OpCodes.And32(temp, 0xFF));
              temp = OpCodes.Shr32(temp, 8);
            }
          }

          output.push(OpCodes.And32(offset, 0xFF));
          output.push(OpCodes.And32(OpCodes.Shr32(offset, 8), 0xFF));
        } else {
          // 3-byte offset encoding
          if (chunkLen < 64) {
            const tag = OpCodes.Or32(OpCodes.Shl32(chunkLen - 1, 2), PITHY_COPY_3_BYTE);
            output.push(tag);
          } else {
            // Extended length
            const lenMinusBase = chunkLen - 64;
            let extraBytes = 0;
            let temp = lenMinusBase;

            do {
              extraBytes++;
              temp = OpCodes.Shr32(temp, 8);
            } while (temp > 0);

            const tag = OpCodes.Or32(OpCodes.Shl32(63 + extraBytes, 2), PITHY_COPY_3_BYTE);
            output.push(tag);

            temp = lenMinusBase;
            for (let i = 0; i < extraBytes; i++) {
              output.push(OpCodes.And32(temp, 0xFF));
              temp = OpCodes.Shr32(temp, 8);
            }
          }

          output.push(OpCodes.And32(offset, 0xFF));
          output.push(OpCodes.And32(OpCodes.Shr32(offset, 8), 0xFF));
          output.push(OpCodes.And32(OpCodes.Shr32(offset, 16), 0xFF));
        }

        length -= chunkLen;
      }
    }

    /**
     * Hash 4 bytes for hash table lookup
     */
    _hash4(data, pos) {
      if (pos + 3 >= data.length) {
        return 0;
      }

      // Use OpCodes for bit operations
      const v = OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(data[pos], OpCodes.Shl32(data[pos + 1], 8)), OpCodes.Shl32(data[pos + 2], 16)), OpCodes.Shl32(data[pos + 3], 24));

      // Simple hash function
      const hash = OpCodes.ToDWord(v * 0x1E35A7BD);
      return OpCodes.Shr32(hash, 32 - this.MAX_HASH_TABLE_BITS);
    }

    /**
     * Find length of match between two positions
     */
    _findMatchLength(data, pos1, pos2) {
      let length = 0;
      const maxLen = Math.min(data.length - pos2, 65535);

      while (length < maxLen && data[pos1 + length] === data[pos2 + length]) {
        length++;
      }

      return length;
    }

    /**
     * Write variable-length integer (varint) to output
     * 7 bits per byte, LSB first, continuation bit
     */
    _writeVarint(output, value) {
      while (value >= 128) {
        output.push(OpCodes.Or32(OpCodes.And32(value, 0x7F), 0x80));
        value = OpCodes.Shr32(value, 7);
      }
      output.push(OpCodes.And32(value, 0x7F));
    }

    /**
     * Read variable-length integer (varint) from input
     * Returns [value, bytesRead]
     */
    _readVarint(input, pos) {
      let result = 0;
      let shift = 0;
      let bytesRead = 0;

      while (pos < input.length) {
        const byte = input[pos++];
        bytesRead++;
        result = OpCodes.Or32(result, OpCodes.Shl32(OpCodes.And32(byte, 0x7F), shift));

        if (OpCodes.And32(byte, 0x80) === 0) {
          break;
        }

        shift += 7;
      }

      return [result, bytesRead];
    }
  }

  // Register algorithm
  RegisterAlgorithm(new PithyCompression());

  // Return for module systems
  return PithyCompression;
}));
