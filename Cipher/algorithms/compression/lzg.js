/*
 * LZG (Lempel-Ziv-Geelnard) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZG is a minimal implementation of an LZ77-class compression algorithm.
 * Designed by Marcus Geelnard for embedded systems with simple, fast decoder.
 * Uses marker symbols to distinguish literals from back-references.
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

  // ===== CONSTANTS =====

  // LZG Methods
  const LZG_METHOD_COPY = 0;  // Uncompressed copy
  const LZG_METHOD_LZG1 = 1;  // LZG1 compression

  // Header size
  const LZG_HEADER_SIZE = 16;

  // Length decode table (maps encoded values to actual lengths)
  const LENGTH_DECODE_LUT = [
    2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
    18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 35, 48, 72, 128
  ];

  // Marker types
  const MARKER_M1 = 0; // Distant copy (offset 2056+)
  const MARKER_M2 = 1; // Medium copy (offset 8-2055)
  const MARKER_M3 = 2; // Short copy (offset 8-71)
  const MARKER_M4 = 3; // Near copy/RLE (offset 1-8)

  // ===== ALGORITHM IMPLEMENTATION =====

  class LZGCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LZG";
      this.description = "Minimal LZ77-based compression with simple decoder. Uses marker symbols to distinguish literals from back-references. Designed for embedded systems requiring fast decompression with minimal memory.";
      this.inventor = "Marcus Geelnard";
      this.year = 2004;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.SE;

      // Documentation and references
      this.documentation = [
        new LinkItem("liblzg GitHub Repository", "https://github.com/mbitsnbites/liblzg"),
        new LinkItem("liblzg Project Site", "https://liblzg.bitsnbites.eu/"),
        new LinkItem("Wikipedia - liblzg", "https://en.wikipedia.org/wiki/Liblzg")
      ];

      this.references = [
        new LinkItem("GitLab Mirror", "https://gitlab.com/mbitsnbites/liblzg"),
        new LinkItem("Node.js Port", "https://github.com/dlvoy/lzg"),
        new LinkItem("LZ77 and LZ78", "https://en.wikipedia.org/wiki/LZ77_and_LZ78")
      ];

      // Test vectors - Format: LZG header (16 bytes) + 4 marker bytes + compressed data
      // NOTE: Markers are selected as 4 least frequent bytes in the input
      // For short strings, markers will be unused bytes (0-3 for "ABCD")
      this.tests = [
        // Test 1: Simple literal-only data "ABCD" (worst case)
        // Input bytes: A=65, B=66, C=67, D=68
        // Markers chosen: 0, 1, 2, 3 (least frequent - not in input)
        // Data: A, B, C, D (all literals, no escaping needed)
        new TestCase(
          OpCodes.AnsiToBytes("ABCD"),
          [
            // Header: "LZG" + sizes + checksum + method
            0x4C, 0x5A, 0x47,           // Magic "LZG"
            0x00, 0x00, 0x00, 0x04,     // Decoded size: 4
            0x00, 0x00, 0x00, 0x08,     // Encoded size: 8 (4 markers + 4 data)
            0x02, 0xBE, 0x01, 0x11,     // Checksum (Adler-32 variant: 0x02BE0111)
            0x01,                        // Method: LZG1
            // Markers (selected by algorithm)
            0x00, 0x01, 0x02, 0x03,
            // Data (all literals)
            0x41, 0x42, 0x43, 0x44      // "ABCD"
          ],
          "Literal-only compression - no matches",
          "https://github.com/mbitsnbites/liblzg"
        ),

        // Test 2: Simple repetition "AAAA" (RLE case)
        // Markers: 0, 1, 2, 3 (least frequent - not in input)
        // Data: A (literal) + M4 match (offset=1, length=3)
        new TestCase(
          OpCodes.AnsiToBytes("AAAA"),
          [
            // Header
            0x4C, 0x5A, 0x47,           // Magic "LZG"
            0x00, 0x00, 0x00, 0x04,     // Decoded size: 4
            0x00, 0x00, 0x00, 0x07,     // Encoded size: 7
            0x00, 0xED, 0x00, 0x4C,     // Checksum
            0x01,                        // Method: LZG1
            // Markers
            0x00, 0x01, 0x02, 0x03,
            // Data: A + M4(offset=1,len=3)
            0x41,                        // 'A' literal
            0x03, 0x01                   // M4: length_code=1(len=3), offset=0(offset=1)
          ],
          "Repetition pattern - near copy",
          "https://github.com/mbitsnbites/liblzg"
        ),

        // Test 3: Pattern "ABCABC"
        // Markers: 0, 1, 2, 3 (least frequent - not in input)
        // Data: ABC (literals) + M4 match (offset=3, length=3)
        new TestCase(
          OpCodes.AnsiToBytes("ABCABC"),
          [
            // Header
            0x4C, 0x5A, 0x47,           // Magic "LZG"
            0x00, 0x00, 0x00, 0x06,     // Decoded size: 6
            0x00, 0x00, 0x00, 0x09,     // Encoded size: 9
            0x03, 0x8E, 0x01, 0x11,     // Checksum
            0x01,                        // Method: LZG1
            // Markers
            0x00, 0x01, 0x02, 0x03,
            // Data: ABC + M4(offset=3,len=3)
            0x41, 0x42, 0x43,            // "ABC" literals
            0x03, 0x41                   // M4: length_code=1(len=3), offset=2(offset=3)
          ],
          "Pattern repetition - medium copy",
          "https://github.com/mbitsnbites/liblzg"
        ),

        // Test 4: Empty input - returns empty array
        new TestCase(
          [],
          [],
          "Empty data",
          "https://github.com/mbitsnbites/liblzg"
        ),

        // Test 5: Single byte "A"
        new TestCase(
          OpCodes.AnsiToBytes("A"),
          [
            // Header
            0x4C, 0x5A, 0x47,           // Magic "LZG"
            0x00, 0x00, 0x00, 0x01,     // Decoded size: 1
            0x00, 0x00, 0x00, 0x05,     // Encoded size: 5
            0x00, 0x56, 0x00, 0x48,     // Checksum
            0x01,                        // Method: LZG1
            // Markers
            0x00, 0x01, 0x02, 0x03,
            // Data
            0x41                         // 'A'
          ],
          "Single byte",
          "https://github.com/mbitsnbites/liblzg"
        )
      ];
    }


    CreateInstance(isInverse = false) {
      return new LZGInstance(this, isInverse);
    }
  }

  class LZGInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
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

    _compress() {
      const input = this.inputBuffer;
      this.inputBuffer = [];

      // Calculate marker symbols (4 least frequent bytes)
      const markers = this._selectMarkers(input);

      // Build result with header
      const result = [];

      // Add header placeholder
      const header = this._createHeader(input.length, 0, LZG_METHOD_LZG1);
      result.push(...header);

      // Add marker symbols
      result.push(...markers);

      // Build marker lookup table
      const markerLookup = new Array(256).fill(-1);
      for (let i = 0; i < markers.length; ++i) {
        markerLookup[markers[i]] = i;
      }

      // Compress data
      let pos = 0;
      while (pos < input.length) {
        // Find longest match
        const match = this._findMatch(input, pos, 2048);

        if (match.length >= 3 && match.offset > 0) {
          // Encode as back-reference
          this._encodeMatch(result, match, markers);
          pos += match.length;
        } else {
          // Encode as literal
          const byte = input[pos];
          if (markerLookup[byte] >= 0) {
            // Escape marker symbol
            result.push(byte, 0);
          } else {
            // Regular literal
            result.push(byte);
          }
          ++pos;
        }
      }

      // Update header with final sizes
      const encodedSize = result.length - LZG_HEADER_SIZE;
      const sizeBytes = OpCodes.Unpack32BE(encodedSize);
      result[7] = sizeBytes[0];
      result[8] = sizeBytes[1];
      result[9] = sizeBytes[2];
      result[10] = sizeBytes[3];

      // Calculate and update checksum
      const checksum = this._calculateChecksum(result.slice(LZG_HEADER_SIZE));
      const checksumBytes = OpCodes.Unpack32BE(checksum);
      result[11] = checksumBytes[0];
      result[12] = checksumBytes[1];
      result[13] = checksumBytes[2];
      result[14] = checksumBytes[3];

      return result;
    }

    _decompress() {
      const input = this.inputBuffer;
      this.inputBuffer = [];

      // Validate minimum size
      if (input.length < LZG_HEADER_SIZE + 4) {
        return [];
      }

      // Parse header
      const header = this._parseHeader(input);
      if (!header.valid) {
        return [];
      }

      // Handle copy method
      if (header.method === LZG_METHOD_COPY) {
        return input.slice(LZG_HEADER_SIZE);
      }

      // Handle LZG1 method
      if (header.method !== LZG_METHOD_LZG1) {
        return [];
      }

      // Read marker symbols
      const markers = input.slice(LZG_HEADER_SIZE, LZG_HEADER_SIZE + 4);

      // Build marker lookup
      const markerType = new Array(256).fill(-1);
      for (let i = 0; i < 4; ++i) {
        markerType[markers[i]] = i;
      }

      // Decompress
      const result = [];
      let pos = LZG_HEADER_SIZE + 4;

      while (pos < input.length && result.length < header.decodedSize) {
        const symbol = input[pos++];
        const mType = markerType[symbol];

        if (mType < 0) {
          // Literal byte
          result.push(symbol);
        } else {
          // Marker symbol - decode match
          if (pos >= input.length) break;

          const byte1 = input[pos++];

          // Check for escaped marker
          if (byte1 === 0) {
            result.push(symbol);
            continue;
          }

          // Decode match based on marker type
          let offset, length;

          if (mType === MARKER_M1) {
            // M1: Distant copy (3 bytes: length, offset_high, offset_low)
            if (pos >= input.length) break;
            const byte2 = input[pos++];
            const byte3 = pos < input.length ? input[pos++] : 0;
            length = LENGTH_DECODE_LUT[OpCodes.AndN(byte1, 0x1F)];
            const offsetHigh = OpCodes.Shl32(OpCodes.AndN(byte1, 0xE0), 11);
            const offsetMid = OpCodes.Shl32(byte2, 8);
            offset = 2056 + OpCodes.OrN(OpCodes.OrN(offsetHigh, offsetMid), byte3);
          } else if (mType === MARKER_M2) {
            // M2: Medium copy (2 bytes: length, offset)
            const byte2 = pos < input.length ? input[pos++] : 0;
            length = LENGTH_DECODE_LUT[OpCodes.AndN(byte1, 0x1F)];
            const offsetHigh = OpCodes.Shl32(OpCodes.AndN(byte1, 0xE0), 3);
            offset = 8 + OpCodes.OrN(offsetHigh, byte2);
          } else if (mType === MARKER_M3) {
            // M3: Short copy (1 byte: length in bits 0-1, offset in bits 2-7)
            length = 3 + OpCodes.AndN(byte1, 0x03);
            offset = 8 + OpCodes.AndN(OpCodes.Shr8(byte1, 2), 0x3F);
          } else {
            // M4: Near copy (1 byte: length in bits 0-4, offset in bits 5-7)
            length = LENGTH_DECODE_LUT[OpCodes.AndN(byte1, 0x1F)];
            offset = 1 + OpCodes.AndN(OpCodes.Shr8(byte1, 5), 0x07);
          }

          // Copy from history
          const copyStart = result.length - offset;
          if (copyStart >= 0) {
            for (let i = 0; i < length; ++i) {
              result.push(result[copyStart + i]);
            }
          }
        }
      }

      return result;
    }

    _parseHeader(data) {
      if (data.length < LZG_HEADER_SIZE) {
        return { valid: false };
      }

      // Check magic
      if (data[0] !== 0x4C || data[1] !== 0x5A || data[2] !== 0x47) {
        return { valid: false };
      }

      // Read sizes using OpCodes
      const decodedSize = OpCodes.Pack32BE(data[3], data[4], data[5], data[6]);
      const encodedSize = OpCodes.Pack32BE(data[7], data[8], data[9], data[10]);
      const checksum = OpCodes.Pack32BE(data[11], data[12], data[13], data[14]);
      const method = data[15];

      return {
        valid: true,
        decodedSize,
        encodedSize,
        checksum,
        method
      };
    }

    _selectMarkers(data) {
      // Build frequency table
      const freq = new Array(256).fill(0);
      for (const byte of data) {
        ++freq[byte];
      }

      // Find 4 least frequent bytes
      const sorted = freq.map((count, byte) => ({ byte, count }))
        .sort((a, b) => a.count - b.count);

      return [
        sorted[0].byte,
        sorted[1].byte,
        sorted[2].byte,
        sorted[3].byte
      ];
    }

    _findMatch(data, pos, maxOffset) {
      let bestLength = 0;
      let bestOffset = 0;

      const searchStart = Math.max(0, pos - maxOffset);
      const maxLength = Math.min(128, data.length - pos);

      for (let searchPos = searchStart; searchPos < pos; ++searchPos) {
        let length = 0;
        while (length < maxLength && data[searchPos + length] === data[pos + length]) {
          ++length;
        }

        if (length > bestLength) {
          bestLength = length;
          bestOffset = pos - searchPos;
        }
      }

      return { length: bestLength, offset: bestOffset };
    }

    _encodeMatch(result, match, markers) {
      // Select marker and encoding based on offset and length
      const offset = match.offset;
      const length = match.length;

      // Find length code
      let lengthCode = 0;
      for (let i = 0; i < LENGTH_DECODE_LUT.length; ++i) {
        if (LENGTH_DECODE_LUT[i] >= length) {
          lengthCode = i;
          break;
        }
      }

      if (offset >= 2056) {
        // M1: Distant copy
        const adjustedOffset = offset - 2056;
        result.push(markers[MARKER_M1]);
        const byte1 = OpCodes.OrN(
          OpCodes.AndN(lengthCode, 0x1F),
          OpCodes.AndN(OpCodes.Shr32(adjustedOffset, 11), 0xE0)
        );
        const byte2 = OpCodes.AndN(OpCodes.Shr32(adjustedOffset, 8), 0xFF);
        const byte3 = OpCodes.AndN(adjustedOffset, 0xFF);
        result.push(byte1, byte2, byte3);
      } else if (offset >= 8 && length >= 3) {
        if (length <= 6 && offset < 72) {
          // M3: Short copy
          result.push(markers[MARKER_M3]);
          const byte = OpCodes.OrN(
            OpCodes.Shl8(offset - 8, 2),
            length - 3
          );
          result.push(byte);
        } else {
          // M2: Medium copy
          const adjustedOffset = offset - 8;
          result.push(markers[MARKER_M2]);
          const byte1 = OpCodes.OrN(
            OpCodes.AndN(lengthCode, 0x1F),
            OpCodes.AndN(OpCodes.Shr32(adjustedOffset, 3), 0xE0)
          );
          const byte2 = OpCodes.AndN(adjustedOffset, 0xFF);
          result.push(byte1, byte2);
        }
      } else if (offset >= 1 && offset <= 8) {
        // M4: Near copy
        result.push(markers[MARKER_M4]);
        const byte = OpCodes.OrN(
          OpCodes.AndN(lengthCode, 0x1F),
          OpCodes.Shl8(OpCodes.AndN(offset - 1, 0x07), 5)
        );
        result.push(byte);
      }
    }

    _createHeader(decodedSize, encodedSize, method) {
      const header = new Array(LZG_HEADER_SIZE);

      // Magic bytes "LZG"
      header[0] = 0x4C; // 'L'
      header[1] = 0x5A; // 'Z'
      header[2] = 0x47; // 'G'

      // Decoded size (32-bit big-endian)
      const decodedBytes = OpCodes.Unpack32BE(decodedSize);
      header[3] = decodedBytes[0];
      header[4] = decodedBytes[1];
      header[5] = decodedBytes[2];
      header[6] = decodedBytes[3];

      // Encoded size (32-bit big-endian)
      const encodedBytes = OpCodes.Unpack32BE(encodedSize);
      header[7] = encodedBytes[0];
      header[8] = encodedBytes[1];
      header[9] = encodedBytes[2];
      header[10] = encodedBytes[3];

      // Checksum placeholder
      header[11] = 0;
      header[12] = 0;
      header[13] = 0;
      header[14] = 0;

      // Method
      header[15] = method;

      return header;
    }

    _calculateChecksum(data) {
      let a = 1;
      let b = 0;

      for (const byte of data) {
        a = (a + byte) % 65521;
        b = (b + a) % 65521;
      }

      return OpCodes.OrN(OpCodes.Shl32(b, 16), a);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZGCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZGCompression, LZGInstance };
}));
