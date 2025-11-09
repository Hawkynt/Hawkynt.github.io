/*
 * BriefLZ - Small Fast Lempel-Ziv Compression Algorithm
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * BriefLZ is a small and fast LZ77-based compression using gamma2 universal codes.
 * Created by Joergen Ibsen, it achieves good compression ratios with minimal code footprint.
 *
 * Format:
 * - Bit stream with 16-bit tags (little-endian)
 * - Initial virtual state: tag=0x4000, bits_left=1 (first bit=0 for first literal)
 * - Gamma2-encoded match lengths (actual_length = gamma_value + 2)
 * - Gamma2-encoded match offsets (actual_offset = ((gamma_value-2) * 256) + byte + 1)
 * - Literal bytes for unmatched data
 *
 * References:
 * - Original C implementation: https://github.com/jibsen/brieflz
 * - Decompression is 61 LOC in C (103 bytes in x86 machine code)
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

  // ===== GAMMA2 ENCODING/DECODING UTILITIES =====

  /**
   * Gamma2 lookup table for fast decoding (same as BriefLZ reference)
   * Format: [value, bits_consumed]
   * Entry with bits_consumed=0 means need more bits (continue with bit-by-bit)
   */
  const GAMMA_LOOKUP = [
    // 00xxxxxx = 2 (64 entries)
    [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2],
    [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2],
    [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2],
    [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2],
    [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2],
    [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2],
    [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2],
    [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2],

    // 0100xxxx = 4 (16 entries)
    [4, 4], [4, 4], [4, 4], [4, 4], [4, 4], [4, 4], [4, 4], [4, 4],
    [4, 4], [4, 4], [4, 4], [4, 4], [4, 4], [4, 4], [4, 4], [4, 4],

    // 010100xx = 8 (4 entries)
    [8, 6], [8, 6], [8, 6], [8, 6],

    // 01010100 = 16, 01010101 = 16+, 01010110 = 17, 01010111 = 17+
    [16, 8], [16, 0], [17, 8], [17, 0],

    // 010110xx = 9 (4 entries)
    [9, 6], [9, 6], [9, 6], [9, 6],

    // 01011100 = 18, 01011101 = 18+, 01011110 = 19, 01011111 = 19+
    [18, 8], [18, 0], [19, 8], [19, 0],

    // 0110xxxx = 5 (16 entries)
    [5, 4], [5, 4], [5, 4], [5, 4], [5, 4], [5, 4], [5, 4], [5, 4],
    [5, 4], [5, 4], [5, 4], [5, 4], [5, 4], [5, 4], [5, 4], [5, 4],

    // 011100xx = 10 (4 entries)
    [10, 6], [10, 6], [10, 6], [10, 6],

    // 01110100 = 20, 01110101 = 20+, 01110110 = 21, 01110111 = 21+
    [20, 8], [20, 0], [21, 8], [21, 0],

    // 011110xx = 11 (4 entries)
    [11, 6], [11, 6], [11, 6], [11, 6],

    // 01111100 = 22, 01111101 = 22+, 01111110 = 23, 01111111 = 23+
    [22, 8], [22, 0], [23, 8], [23, 0],

    // 10xxxxxx = 3 (64 entries)
    [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2],
    [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2],
    [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2],
    [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2],
    [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2],
    [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2],
    [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2],
    [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2], [3, 2],

    // 1100xxxx = 6 (16 entries)
    [6, 4], [6, 4], [6, 4], [6, 4], [6, 4], [6, 4], [6, 4], [6, 4],
    [6, 4], [6, 4], [6, 4], [6, 4], [6, 4], [6, 4], [6, 4], [6, 4],

    // 110100xx = 12 (4 entries)
    [12, 6], [12, 6], [12, 6], [12, 6],

    // 11010100 = 24, 11010101 = 24+, 11010110 = 25, 11010111 = 25+
    [24, 8], [24, 0], [25, 8], [25, 0],

    // 110110xx = 13 (4 entries)
    [13, 6], [13, 6], [13, 6], [13, 6],

    // 11011100 = 26, 11011101 = 26+, 11011110 = 27, 11011111 = 27+
    [26, 8], [26, 0], [27, 8], [27, 0],

    // 1110xxxx = 7 (16 entries)
    [7, 4], [7, 4], [7, 4], [7, 4], [7, 4], [7, 4], [7, 4], [7, 4],
    [7, 4], [7, 4], [7, 4], [7, 4], [7, 4], [7, 4], [7, 4], [7, 4],

    // 111100xx = 14 (4 entries)
    [14, 6], [14, 6], [14, 6], [14, 6],

    // 11110100 = 28, 11110101 = 28+, 11110110 = 29, 11110111 = 29+
    [28, 8], [28, 0], [29, 8], [29, 0],

    // 111110xx = 15 (4 entries)
    [15, 6], [15, 6], [15, 6], [15, 6],

    // 11111100 = 30, 11111101 = 30+, 11111110 = 31, 11111111 = 31+
    [30, 8], [30, 0], [31, 8], [31, 0]
  ];

  // ===== BIT STREAM DECOMPRESSION =====

  class BitStreamReader {
    constructor(data) {
      this.data = data;
      this.pos = 0;
      // Initialize to one bit left in tag; that bit is zero (a literal)
      this.tag = 0x4000;
      this.bitsLeft = 1;
    }

    getBit() {
      // Check if tag is empty (decrement happens FIRST in C code)
      if (this.bitsLeft === 0) {
        // Load next tag (little-endian 16-bit)
        if (this.pos + 1 >= this.data.length) {
          return 0; // Safety
        }
        this.tag = this.data[this.pos] + OpCodes.Shl16(this.data[this.pos + 1], 8);
        this.pos += 2;
        this.bitsLeft = 16;
      }

      // Decrement bits left
      this.bitsLeft--;

      // Shift bit out of tag (MSB first) - check if bit 15 is set
      // Bit 15 is set if value >= 0x8000 (32768)
      const bit = (this.tag >= OpCodes.Shl16(1, 15)) ? 1 : 0;
      this.tag = OpCodes.Shl16(this.tag, 1);

      return bit;
    }

    getGamma() {
      let result = 1;

      // Try lookup table optimization if we have 8+ bits
      if (this.bitsLeft >= 8) {
        const top8 = OpCodes.Shr16(this.tag, 8);
        const [value, shift] = GAMMA_LOOKUP[top8];

        if (shift > 0) {
          this.tag = OpCodes.Shl16(this.tag, shift);
          this.bitsLeft -= shift;
          return value;
        }

        // Shift consumed 8 bits from lookup but need more
        this.tag = OpCodes.Shl16(this.tag, 8);
        this.bitsLeft -= 8;
      }

      // Gamma2 decoding: read bits until terminating 0
      do {
        result = OpCodes.Shl32(result, 1) + this.getBit();
      } while (this.getBit());

      return result;
    }

    getByte() {
      if (this.pos >= this.data.length) {
        return 0;
      }
      return this.data[this.pos++];
    }
  }

  // ===== BIT STREAM COMPRESSION =====

  class BitStreamWriter {
    constructor() {
      this.output = [];
      this.tag = 0;
      this.bitCount = 0;
      this.tagPos = -1;
      this.isFirstBit = true; // First bit is virtual (handled by decompressor init)
    }

    putBit(bit) {
      // Skip the virtual first bit (decompressor starts with it set to 0)
      if (this.isFirstBit) {
        this.isFirstBit = false;
        if (bit === 0) {
          return; // Don't output virtual first literal bit
        }
        // If first bit is 1, we need to output tags now
      }

      // Start new tag if needed
      if (this.bitCount === 0) {
        this.tagPos = this.output.length;
        this.output.push(0, 0); // Reserve space for 16-bit tag
        this.tag = 0;
      }

      // Add bit to tag (MSB first)
      const bitValue = bit ? 1 : 0;
      this.tag = OpCodes.Shl16(this.tag, 1) + bitValue; // OR equivalent for adding single bit
      this.bitCount++;

      // Flush tag if full
      if (this.bitCount === 16) {
        this.flushTag();
      }
    }

    putGamma(value) {
      // Encode value in gamma2 format
      // Format: interleaved bits from value's binary (minus leading 1) with continue flags
      // Decoder: result=1; do { result=(result<<1)+bit } while(getBit())

      // Find bit length (position of MSB)
      let bitLen = 0;
      let v = value;
      while (v > 0) {
        bitLen++;
        v = OpCodes.Shr32(v, 1);
      }

      // Output bits from MSB-1 down to LSB, each with continue flag
      for (let i = bitLen - 2; i >= 0; i--) {
        const bit = OpCodes.Shr32(value, i) - OpCodes.Shl32(OpCodes.Shr32(value, i + 1), 1); // Extract single bit
        this.putBit(bit);

        // Continue flag: 1 if more bits, 0 if last
        this.putBit(i > 0 ? 1 : 0);
      }
    }

    putByte(byte) {
      // Ensure byte is in 0-255 range
      this.output.push(byte % 256);
    }

    flushTag() {
      if (this.bitCount > 0) {
        // Pad remaining bits with zeros (shift left to fill 16 bits)
        const shift = 16 - this.bitCount;
        this.tag = OpCodes.Shl16(this.tag, shift);

        // Write tag to reserved position (little-endian: low byte first)
        this.output[this.tagPos] = this.tag % 256;           // Low byte
        this.output[this.tagPos + 1] = OpCodes.Shr16(this.tag, 8); // High byte

        this.bitCount = 0;
        this.tag = 0;
      }
    }

    getOutput() {
      this.flushTag();
      return this.output;
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class BriefLZCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BriefLZ";
      this.description = "Small fast Lempel-Ziv compression using gamma2 universal codes. Achieves good compression ratios with minimal code footprint (61 LOC decompression in C). Places itself between entropy-encoded and pure LZ77 approaches.";
      this.inventor = "Joergen Ibsen";
      this.year = 2002;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.DK; // Denmark

      // Algorithm parameters
      this.WINDOW_SIZE = 65536;      // 64KB sliding window
      this.MIN_MATCH_LENGTH = 4;     // Minimum match length (gamma2 minimum is 2, so len=gamma+2=4)
      this.MAX_MATCH_LENGTH = 255;   // Practical maximum

      // Documentation and references
      this.documentation = [
        new LinkItem("BriefLZ GitHub Repository", "https://github.com/jibsen/brieflz"),
        new LinkItem("BriefLZ Format Description", "https://www.ibsensoftware.com/"),
        new LinkItem("Universal Codes - Wikipedia", "https://en.wikipedia.org/wiki/Universal_code_(data_compression)")
      ];

      this.references = [
        new LinkItem("Original C Implementation", "https://github.com/jibsen/brieflz/blob/master/src/depack.c"),
        new LinkItem("BriefLZ README", "https://github.com/jibsen/brieflz/blob/master/README.md"),
        new LinkItem("Gamma Coding", "https://en.wikipedia.org/wiki/Elias_gamma_coding")
      ];

      // Test vectors based on actual BriefLZ format
      // Format: first literal is free (virtual bit=0), then tags start
      // NOTE: BriefLZ requires known output size for decompression
      this.tests = [
        {
          text: "Single literal byte",
          uri: "https://github.com/jibsen/brieflz",
          input: OpCodes.AnsiToBytes("A"),
          expected: [0x41], // Just the byte (first bit is virtual 0)
          outputSize: 1
        },
        {
          text: "Two literal bytes",
          uri: "https://github.com/jibsen/brieflz",
          input: OpCodes.AnsiToBytes("AB"),
          expected: [0x41, 0x00, 0x00, 0x42], // A, tag 0x0000 (16 bits all 0=literals), B
          outputSize: 2
        },
        {
          text: "Three literal bytes",
          uri: "https://github.com/jibsen/brieflz",
          input: OpCodes.AnsiToBytes("ABC"),
          expected: [0x41, 0x00, 0x00, 0x42, 0x43], // A, tag (0,0 for B,C), B, C
          outputSize: 3
        },
        {
          text: "Four A's - minimum match",
          uri: "https://github.com/jibsen/brieflz",
          input: OpCodes.AnsiToBytes("AAAA"),
          // A (literal), then match len=3: gamma(3-2)=gamma(1) - WAIT gamma min is 2!
          // Actually: len=4, gamma=2, but we already output 1 A, so match copies remaining 3
          // Let me recalculate: A literal, then at pos=1, match 3 bytes (rest of input)
          // But match length in format is total match length, not remaining
          // Match: start at output pos 0, copy 3 bytes -> gives us 3 more A's -> total AAAA
          // Stored: len=3, gamma(3-2)=gamma(1) - invalid!
          // So we can't compress AAAA efficiently. Need AAAAA (5 A's)
          expected: [0x41, 0x00, 0x00, 0x41, 0x41, 0x41], // All literals (can't make min match of 4)
          outputSize: 4
        },
        {
          text: "Five A's - viable match",
          uri: "https://github.com/jibsen/brieflz",
          input: OpCodes.AnsiToBytes("AAAAA"),
          // A (literal at pos 0), then match at pos 1: length=4, distance=1
          // Encoded: bit=1, gamma(4-2)=gamma(2)=00, gamma(off)
          // off=(1-1)>>8=0, gamma(0+2)=gamma(2)=00, byte=(1-1)&0xFF=0
          // Bits: 1,0,0,0,0 then padding -> 10000_00000000000 = 0x8000 (little-endian: 0x00, 0x80)
          // Format: [A] [tag_low, tag_high] [offset_byte]
          expected: [0x41, 0x00, 0x80, 0x00], // A, tag 0x8000 (LE), offset byte 0x00
          outputSize: 5
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new BriefLZInstance(this, isInverse);
    }
  }

  class BriefLZInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._outputSize = null; // Required for decompression
    }

    // Property setter for output size (used by test framework)
    set outputSize(size) {
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

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

    _decompress() {
      const bs = new BitStreamReader(this.inputBuffer);
      const output = [];

      // Use outputSize if provided, otherwise use safety limit
      const targetSize = this._outputSize || (this.inputBuffer.length * 10);

      while (output.length < targetSize) {
        const bit = bs.getBit();

        if (bit === 1) {
          // Match: read length and offset
          const len = bs.getGamma() + 2;
          const off = bs.getGamma() - 2;
          const offset = OpCodes.Shl32(off, 8) + bs.getByte() + 1;

          // Copy match
          const startPos = output.length - offset;
          if (startPos < 0) break; // Invalid offset

          for (let i = 0; i < len; i++) {
            output.push(output[startPos + i]);
            if (output.length >= targetSize) break; // Stop at exact size
          }
        } else {
          // Literal
          const byte = bs.getByte();
          if (byte === undefined) break;
          output.push(byte);
        }

        // Stop if we reached target size
        if (output.length >= targetSize) {
          break;
        }
      }

      this.inputBuffer = [];
      return output;
    }

    _compress() {
      const writer = new BitStreamWriter();
      let pos = 0;

      while (pos < this.inputBuffer.length) {
        // Find longest match in sliding window
        const match = this._findMatch(pos);

        if (match.length >= this.algorithm.MIN_MATCH_LENGTH) {
          // Output match
          writer.putBit(1);
          writer.putGamma(match.length - 2);

          const distMinus1 = match.distance - 1;
          const off = OpCodes.Shr32(distMinus1, 8);
          writer.putGamma(off + 2);
          writer.putByte(distMinus1 % 256); // Low byte

          pos += match.length;
        } else {
          // Output literal
          writer.putBit(0);
          writer.putByte(this.inputBuffer[pos]);
          pos++;
        }
      }

      this.inputBuffer = [];
      return writer.getOutput();
    }

    _findMatch(pos) {
      const windowStart = Math.max(0, pos - this.algorithm.WINDOW_SIZE);
      let bestLength = 0;
      let bestDistance = 0;

      // Search for matches in sliding window
      for (let i = windowStart; i < pos; i++) {
        let length = 0;
        const maxLen = Math.min(
          this.algorithm.MAX_MATCH_LENGTH,
          this.inputBuffer.length - pos
        );

        // Count matching bytes
        while (length < maxLen &&
               this.inputBuffer[i + length] === this.inputBuffer[pos + length]) {
          length++;
        }

        // Update best match
        if (length > bestLength) {
          bestLength = length;
          bestDistance = pos - i;
        }
      }

      return { length: bestLength, distance: bestDistance };
    }
  }

  // Register algorithm
  RegisterAlgorithm(new BriefLZCompression());

  return BriefLZCompression;
}));
