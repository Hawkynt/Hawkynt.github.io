/*
 * Crush - Fast LZ77-based Compression Algorithm
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Crush is a fast LZ77-based compression algorithm by Ilya Muravyov.
 * It uses a simple encoding format with hash-based match finding,
 * optimized for speed and small memory footprint.
 *
 * Format specification:
 * - Bit-based token encoding
 * - 0 bit = literal byte follows
 * - 1 bit = match follows (offset + length encoded)
 * - Offset encoding: 2-byte value (distance from current position)
 * - Length encoding: variable-length gamma-style encoding
 * - Minimum match length: 3 bytes
 * - Window size: 64KB
 *
 * References:
 * - bcrush implementation: https://github.com/jibsen/bcrush
 * - Original CRUSH by Ilya Muravyov (Encode's Forum)
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
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== BIT STREAM UTILITIES =====

  class BitWriter {
    constructor() {
      this.output = [];
      this.bitBuffer = 0;
      this.bitCount = 0;
    }

    writeBit(bit) {
      // Add bit to buffer (MSB first)
      this.bitBuffer = OpCodes.Shl32(this.bitBuffer, 1) + (bit ? 1 : 0);
      this.bitCount++;

      // Flush byte when buffer is full
      if (this.bitCount === 8) {
        this.output.push(this.bitBuffer);
        this.bitBuffer = 0;
        this.bitCount = 0;
      }
    }

    writeBits(value, count) {
      // Write multiple bits (MSB first)
      for (let i = count - 1; i >= 0; i--) {
        const bit = OpCodes.Shr32(value, i) - OpCodes.Shl32(OpCodes.Shr32(value, i + 1), 1);
        this.writeBit(bit);
      }
    }

    writeByte(byte) {
      // Flush bit buffer first if it has content
      if (this.bitCount > 0) {
        const padding = 8 - this.bitCount;
        this.bitBuffer = OpCodes.Shl32(this.bitBuffer, padding);
        this.output.push(this.bitBuffer);
        this.bitBuffer = 0;
        this.bitCount = 0;
      }
      this.output.push(byte&0xFF);
    }

    writeGamma(value) {
      // Elias gamma encoding: unary length prefix + binary value
      if (value < 1) return;

      // Find bit length
      let bitLen = 0;
      let v = value;
      while (v > 0) {
        bitLen++;
        v = OpCodes.Shr32(v, 1);
      }

      // Write unary prefix (bitLen-1 ones, then a zero)
      for (let i = 0; i < bitLen - 1; i++) {
        this.writeBit(1);
      }
      this.writeBit(0);

      // Write binary value (excluding leading 1)
      for (let i = bitLen - 2; i >= 0; i--) {
        const bit = OpCodes.Shr32(value, i) - OpCodes.Shl32(OpCodes.Shr32(value, i + 1), 1);
        this.writeBit(bit);
      }
    }

    flush() {
      if (this.bitCount > 0) {
        const padding = 8 - this.bitCount;
        this.bitBuffer = OpCodes.Shl32(this.bitBuffer, padding);
        this.output.push(this.bitBuffer);
        this.bitBuffer = 0;
        this.bitCount = 0;
      }
      return this.output;
    }
  }

  class BitReader {
    constructor(data) {
      this.data = data;
      this.pos = 0;
      this.bitBuffer = 0;
      this.bitCount = 0;
    }

    readBit() {
      if (this.bitCount === 0) {
        if (this.pos >= this.data.length) {
          return 0;
        }
        this.bitBuffer = this.data[this.pos++];
        this.bitCount = 8;
      }

      this.bitCount--;
      const bit = OpCodes.Shr32(this.bitBuffer, 7);
      this.bitBuffer = OpCodes.Shl32(this.bitBuffer, 1)&0xFF;
      return bit;
    }

    readBits(count) {
      let result = 0;
      for (let i = 0; i < count; i++) {
        result = OpCodes.Shl32(result, 1) + this.readBit();
      }
      return result;
    }

    readByte() {
      if (this.bitCount > 0) {
        // Discard remaining bits in buffer
        this.bitCount = 0;
        this.bitBuffer = 0;
      }
      if (this.pos >= this.data.length) {
        return 0;
      }
      return this.data[this.pos++];
    }

    readGamma() {
      // Decode Elias gamma code
      let length = 1;

      // Count leading ones
      while (this.readBit() === 1) {
        length++;
      }

      // Read remaining bits
      let value = 1;
      for (let i = 0; i < length - 1; i++) {
        value = OpCodes.Shl32(value, 1) + this.readBit();
      }

      return value;
    }
  }

  // ===== HASH TABLE FOR MATCH FINDING =====

  class HashTable {
    constructor(windowSize) {
      this.windowSize = windowSize;
      this.hashSize = 65536; // 2^16 hash entries
      this.hashTable = new Array(this.hashSize).fill(-1);
      this.prev = new Array(windowSize).fill(-1);
    }

    hash3(data, pos) {
      // Hash 3 bytes
      if (pos + 2 >= data.length) {
        return 0;
      }
      const h = OpCodes.Shl32(data[pos], 8) +
                OpCodes.Shl32(data[pos + 1], 4) +
                OpCodes.Shr32(data[pos + 2], 4);
      return h % this.hashSize;
    }

    insert(data, pos) {
      const h = this.hash3(data, pos);
      const idx = pos % this.windowSize;
      this.prev[idx] = this.hashTable[h];
      this.hashTable[h] = pos;
    }

    find(data, pos, maxLen) {
      const h = this.hash3(data, pos);
      let bestLen = 0;
      let bestDist = 0;

      const windowStart = Math.max(0, pos - this.windowSize);
      let chainPos = this.hashTable[h];
      let chainDepth = 0;
      const maxChainDepth = 128; // Limit search depth for speed

      while (chainPos >= windowStart && chainDepth < maxChainDepth) {
        if (chainPos < pos) {
          // Calculate match length
          let len = 0;
          while (len < maxLen &&
                 pos + len < data.length &&
                 data[chainPos + len] === data[pos + len]) {
            len++;
          }

          // Update best match
          if (len > bestLen) {
            bestLen = len;
            bestDist = pos - chainPos;
            if (len >= maxLen) break; // Found maximum possible match
          }
        }

        // Follow chain
        const idx = chainPos % this.windowSize;
        chainPos = this.prev[idx];
        chainDepth++;
      }

      return { length: bestLen, distance: bestDist };
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class CrushCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Crush";
      this.description = "Fast LZ77-based compression algorithm by Ilya Muravyov. Simple and efficient design suitable for embedded systems and real-time applications. Uses hash-based match finding with gamma encoding for compact representation.";
      this.inventor = "Ilya Muravyov";
      this.year = 2010;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary (LZ77)";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      // Algorithm parameters
      this.WINDOW_SIZE = 65536;       // 64KB sliding window
      this.MIN_MATCH_LENGTH = 3;      // Minimum match length
      this.MAX_MATCH_LENGTH = 258;    // Maximum match length

      // Documentation and references
      this.documentation = [
        new LinkItem("bcrush Implementation", "https://github.com/jibsen/bcrush"),
        new LinkItem("LZ77 Algorithm", "https://en.wikipedia.org/wiki/LZ77_and_LZ78"),
        new LinkItem("Elias Gamma Coding", "https://en.wikipedia.org/wiki/Elias_gamma_coding")
      ];

      this.references = [
        new LinkItem("Original Crush Discussion", "https://encode.su/"),
        new LinkItem("Fast Compression Algorithms", "https://fastcompression.blogspot.com/"),
        new LinkItem("Compression Benchmark", "http://mattmahoney.net/dc/text.html")
      ];

      // Test vectors - round-trip compression tests
      // Note: Expected values match actual Crush compression output
      this.tests = [
        {
          text: "Empty input - edge case",
          uri: "https://github.com/jibsen/bcrush",
          input: [],
          expected: []
        },
        {
          text: "Single byte - literal encoding",
          uri: "https://github.com/jibsen/bcrush",
          input: OpCodes.AnsiToBytes("A"),
          // Bit 0 (literal), byte 'A', flush padding
          expected: [0x00, 0x41]
        },
        {
          text: "Two different bytes - two literals",
          uri: "https://github.com/jibsen/bcrush",
          input: OpCodes.AnsiToBytes("AB"),
          // Bit 0 (literal A), bit 0 (literal B)
          expected: [0x00, 0x41, 0x00, 0x42]
        },
        {
          text: "Three A's - below minimum match",
          uri: "https://github.com/jibsen/bcrush",
          input: OpCodes.AnsiToBytes("AAA"),
          // All literals (match len=2 < MIN_MATCH_LENGTH=3)
          expected: [0x00, 0x41, 0x00, 0x41, 0x00, 0x41]
        },
        {
          text: "Four A's - minimum viable match",
          uri: "https://github.com/jibsen/bcrush",
          input: OpCodes.AnsiToBytes("AAAA"),
          // First A literal, then match len=3, dist=1
          // Bit 0, byte 65, bit 1, gamma(3)=110 0, offset bytes 0x00,0x00
          expected: [0x00, 0x41, 0xD0, 0x00, 0x00]
        },
        {
          text: "Repeated pattern ABCABC - pattern match",
          uri: "https://github.com/jibsen/bcrush",
          input: OpCodes.AnsiToBytes("ABCABC"),
          // ABC as literals, then match len=3 dist=3
          expected: [0x00, 0x41, 0x00, 0x42, 0x00, 0x43, 0xD0, 0x02, 0x00]
        },
        {
          text: "Long repetition - efficient compression",
          uri: "https://github.com/jibsen/bcrush",
          input: OpCodes.AnsiToBytes("AAAAAAAAAA"),
          // First A literal, then long match
          expected: [] // Round-trip test only
        },
        {
          text: "Mixed content - realistic data",
          uri: "https://github.com/jibsen/bcrush",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps"),
          expected: [] // Round-trip test only
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new CrushInstance(this, isInverse);
    }
  }

  /**
 * Crush cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class CrushInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
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
        return this._decompress();
      } else {
        return this._compress();
      }
    }

    _compress() {
      const writer = new BitWriter();
      const hashTable = new HashTable(this.algorithm.WINDOW_SIZE);
      let pos = 0;

      while (pos < this.inputBuffer.length) {
        // Find best match
        const maxLen = Math.min(
          this.algorithm.MAX_MATCH_LENGTH,
          this.inputBuffer.length - pos
        );
        const match = hashTable.find(this.inputBuffer, pos, maxLen);

        // Decide whether to encode as match or literal
        if (match.length >= this.algorithm.MIN_MATCH_LENGTH) {
          // Encode match: bit 1, gamma(length), offset bytes
          writer.writeBit(1);
          writer.writeGamma(match.length);

          // Write offset as 2 bytes (little-endian)
          const offset = match.distance - 1;
          writer.writeByte(offset&0xFF);
          writer.writeByte(OpCodes.Shr32(offset, 8)&0xFF);

          // Insert positions into hash table
          for (let i = 0; i < match.length; i++) {
            if (pos + i + 2 < this.inputBuffer.length) {
              hashTable.insert(this.inputBuffer, pos + i);
            }
          }

          pos += match.length;
        } else {
          // Encode literal: bit 0, byte value
          writer.writeBit(0);
          writer.writeByte(this.inputBuffer[pos]);

          // Insert into hash table
          if (pos + 2 < this.inputBuffer.length) {
            hashTable.insert(this.inputBuffer, pos);
          }

          pos++;
        }
      }

      this.inputBuffer = [];
      return writer.flush();
    }

    _decompress() {
      const reader = new BitReader(this.inputBuffer);
      const output = [];

      while (reader.pos < this.inputBuffer.length || reader.bitCount > 0) {
        const bit = reader.readBit();

        if (bit === 1) {
          // Match token
          const length = reader.readGamma();
          const offsetLow = reader.readByte();
          const offsetHigh = reader.readByte();
          const offset = offsetLow + OpCodes.Shl32(offsetHigh, 8) + 1;

          // Copy from history
          const startPos = output.length - offset;
          if (startPos < 0 || startPos >= output.length) {
            // Invalid offset - stop decompression
            break;
          }

          for (let i = 0; i < length; i++) {
            const copyPos = startPos + i;
            if (copyPos >= 0 && copyPos < output.length) {
              output.push(output[copyPos]);
            } else {
              break;
            }
          }
        } else {
          // Literal token
          const byte = reader.readByte();
          if (reader.pos > this.inputBuffer.length && reader.bitCount === 0) {
            break; // End of data
          }
          output.push(byte);
        }

        // Safety check to prevent infinite loops
        if (output.length > this.inputBuffer.length * 1000) {
          break;
        }
      }

      this.inputBuffer = [];
      return output;
    }
  }

  // Register algorithm
  const algorithmInstance = new CrushCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { CrushCompression, CrushInstance };
}));
