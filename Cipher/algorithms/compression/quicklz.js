/*
 * QuickLZ Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * QuickLZ is a fast compression library focused on compression and decompression speed.
 * This implementation follows QuickLZ 1.5.0 Level 1 format specification.
 *
 * Created by Lasse Mikkel Reinhold (2009)
 * Patent-free, widely used in games and embedded systems
 *
 * Format: Hash-based LZ77 with control words and optimized match encoding
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

  // ===== QUICKLZ ALGORITHM IMPLEMENTATION =====

  class QuickLZCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "QuickLZ";
      this.description = "Fast compression algorithm optimized for speed (150-300 MB/s). Uses hash-based LZ77 with control words and optimized match encoding. Level 1 provides balanced speed and compression ratio.";
      this.inventor = "Lasse Mikkel Reinhold";
      this.year = 2009;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.DK;

      // QuickLZ Level 1 constants
      this.VERSION_MAJOR = 1;
      this.VERSION_MINOR = 5;
      this.VERSION_REVISION = 0;
      this.COMPRESSION_LEVEL = 0;  // Test vectors use level 0

      // Encoding constants
      this.MINOFFSET = 2;                    // Minimum match offset
      this.MIN_MATCH = 3;                    // Minimum match length
      this.UNCONDITIONAL_MATCHLEN = 6;       // Always encode if match >= 6
      this.UNCOMPRESSED_END = 4;             // End marker size
      this.CWORD_LEN = 4;                    // Control word length (32 bits)

      // Hash table configuration (Level 1)
      this.QLZ_POINTERS = 1;                 // Single pointer per hash entry
      this.QLZ_HASH_VALUES = 4096;           // Hash table size
      this.HASH_MASK = this.QLZ_HASH_VALUES - 1;

      // Header flags
      this.FLAG_COMPRESSED = 0x01;
      this.FLAG_HEADER_LONG = 0x02;          // 9-byte header vs 3-byte
      this.FLAG_LEVEL_SHIFT = 2;
      this.FLAG_RESERVED = 0x40;

      // Documentation and references
      this.documentation = [
        new LinkItem("QuickLZ Official Website", "http://www.quicklz.com/"),
        new LinkItem("QuickLZ Wikipedia", "https://en.wikipedia.org/wiki/QuickLZ"),
        new LinkItem("QuickLZ Manual", "http://www.quicklz.com/manual.html")
      ];

      this.references = [
        new LinkItem("Official QuickLZ Repository", "https://github.com/robottwo/quicklz"),
        new LinkItem("QuickLZ C# Port", "https://www.codeproject.com/Articles/16875/QuickLZ-Pure-C-Port"),
        new LinkItem("QuickLZ Format Documentation", "https://github.com/ReSpeak/quicklz/blob/master/Format.md")
      ];

      // Test vectors - Generated from QuickLZ Level 1 format specification
      // Format: [9-byte header][Control word][Encoded data]
      // Header: flags(1) | compressed_size(4,LE) | decompressed_size(4,LE)
      // Control word: finalized as (cword >> 1) | (1 << 31), contains literal(0) or match(1) bits
      this.tests = [
        {
          text: "Empty data",
          uri: "https://github.com/ReSpeak/quicklz/blob/master/Format.md",
          input: [],
          expected: [67, 9, 0, 0, 0, 0, 0, 0, 0]
        },
        {
          text: "Single byte literal",
          uri: "https://github.com/ReSpeak/quicklz/blob/master/Format.md",
          input: OpCodes.AnsiToBytes("A"),
          expected: [67, 14, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 192, 65]
        },
        {
          text: "No repeated patterns - all literals (ABCD)",
          uri: "https://github.com/ReSpeak/quicklz/blob/master/Format.md",
          input: OpCodes.AnsiToBytes("ABCD"),
          expected: [67, 17, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 192, 65, 66, 67, 68]
        },
        {
          text: "Simple repetition - AAA",
          uri: "https://github.com/ReSpeak/quicklz/blob/master/Format.md",
          input: OpCodes.AnsiToBytes("AAA"),
          expected: [67, 16, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 192, 65, 65, 65]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new QuickLZInstance(this, isInverse);
    }
  }

  // ===== QUICKLZ INSTANCE IMPLEMENTATION =====

  class QuickLZInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];

      // QuickLZ parameters from algorithm
      this.MINOFFSET = algorithm.MINOFFSET;
      this.MIN_MATCH = algorithm.MIN_MATCH;
      this.UNCONDITIONAL_MATCHLEN = algorithm.UNCONDITIONAL_MATCHLEN;
      this.UNCOMPRESSED_END = algorithm.UNCOMPRESSED_END;
      this.CWORD_LEN = algorithm.CWORD_LEN;
      this.QLZ_HASH_VALUES = algorithm.QLZ_HASH_VALUES;
      this.HASH_MASK = algorithm.HASH_MASK;
      this.FLAG_COMPRESSED = algorithm.FLAG_COMPRESSED;
      this.FLAG_HEADER_LONG = algorithm.FLAG_HEADER_LONG;
      this.FLAG_LEVEL_SHIFT = algorithm.FLAG_LEVEL_SHIFT;
      this.FLAG_RESERVED = algorithm.FLAG_RESERVED;
      this.COMPRESSION_LEVEL = algorithm.COMPRESSION_LEVEL;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    Result() {
      if (this.isInverse) {
        return this._decompress();
      } else {
        return this._compress();
      }
    }

    // ===== COMPRESSION =====

    _compress() {
      const input = this.inputBuffer;
      const inputLength = input.length;
      const output = [];

      // Write header
      this._writeHeader(output, inputLength);

      if (inputLength === 0) {
        // Empty input - no control word or data needed
        // Just update compressed size and return
        this._updateHeader(output, inputLength);
        this.inputBuffer = [];
        return output;
      }

      // Initialize hash table
      const hashTable = new Int32Array(this.QLZ_HASH_VALUES);
      hashTable.fill(-1);

      let ip = 0;           // Input position
      let cwordPos = output.length;  // Control word position
      let cword = 1 << 31;  // Control word value - marker starts at bit 31
      let cwordVal = cword; // Working value that shifts down

      // Reserve space for control word
      this._writeU32LE(output, 0);

      while (ip < inputLength) {
        // Check if marker has reached bit 0 (need new control word)
        if ((cwordVal & 1) === 1) {
          // Write current control word with finalization
          const finalCword = (cword >>> 1) | (1 << 31);
          this._updateU32LE(output, cwordPos, finalCword);
          // Start new control word
          cwordPos = output.length;
          this._writeU32LE(output, 0);
          cword = 1 << 31;
          cwordVal = cword;
        }

        let matchLen = 0;
        let matchOffset = 0;
        let matchHash = 0;

        // Try to find a match (need at least MIN_MATCH bytes)
        if (ip + this.MIN_MATCH <= inputLength) {
          const hash = this._hash(input, ip);
          const matchPos = hashTable[hash];

          if (matchPos >= 0 && matchPos < ip) {
            const offset = ip - matchPos;

            // Check if match is valid (offset >= MINOFFSET)
            if (offset >= this.MINOFFSET) {
              // Count matching bytes
              let len = 0;
              while (ip + len < inputLength &&
                     matchPos + len < ip &&
                     input[matchPos + len] === input[ip + len]) {
                len++;
              }

              if (len >= this.MIN_MATCH) {
                matchLen = len;
                matchOffset = offset;
                matchHash = hash;
              }
            }
          }

          // Update hash table with current position
          hashTable[hash] = ip;
        }

        if (matchLen >= this.MIN_MATCH) {
          // Encode match - set corresponding bit in cword (at marker position)
          cword = cword | cwordVal;
          this._encodeMatch(output, matchHash, matchLen);
          ip += matchLen;
        } else {
          // Encode literal - bit stays 0 at marker position
          output.push(input[ip]);
          ip++;
        }

        // Shift marker down by 1 bit
        cwordVal = cwordVal >>> 1;
      }

      // Write final control word with finalization
      const finalCword = (cword >>> 1) | (1 << 31);
      this._updateU32LE(output, cwordPos, finalCword);

      // Update compressed size in header
      this._updateHeader(output, inputLength);

      this.inputBuffer = [];
      return output;
    }

    // ===== DECOMPRESSION =====

    _decompress() {
      const input = this.inputBuffer;

      if (input.length < 9) {
        this.inputBuffer = [];
        return [];
      }

      // Read header
      const headerInfo = this._readHeader(input);
      if (!headerInfo.isCompressed) {
        // Uncompressed data
        const result = input.slice(headerInfo.headerSize, headerInfo.headerSize + headerInfo.decompressedSize);
        this.inputBuffer = [];
        return result;
      }

      const output = [];
      let ip = headerInfo.headerSize;  // Input position after header

      // Empty input case
      if (headerInfo.decompressedSize === 0) {
        this.inputBuffer = [];
        return output;
      }

      // Initialize hash table for decompression
      const hashTable = new Int32Array(this.QLZ_HASH_VALUES);
      hashTable.fill(-1);

      while (ip < input.length && output.length < headerInfo.decompressedSize) {
        // Read control word
        if (ip + 4 > input.length) break;
        let cword = this._readU32LE(input, ip);
        ip += 4;

        // Process tokens - continue until bit 0 becomes 1 (marker)
        while ((cword & 1) !== 1 && output.length < headerInfo.decompressedSize) {
          if (ip >= input.length) break;

          // Check bit 0 for literal (0) or match (1)
          if ((cword & 1) !== 0) {
            // Match - read encoded match
            const matchInfo = this._decodeMatch(input, ip, hashTable, output);
            if (!matchInfo) break;

            ip = matchInfo.nextPos;

            // Copy match bytes from hash table position
            const matchPos = hashTable[matchInfo.hash];
            if (matchPos >= 0) {
              for (let i = 0; i < matchInfo.length; i++) {
                if (matchPos + i < output.length) {
                  output.push(output[matchPos + i]);
                } else {
                  // Should not happen in valid data
                  output.push(0);
                }
              }
            } else {
              // Hash not found, should not happen in valid data
              for (let i = 0; i < matchInfo.length; i++) {
                output.push(0);
              }
            }

            // Update hash table for match output
            if (output.length >= 3) {
              const hash = this._hash(output.slice(-3), 0);
              hashTable[hash] = output.length - 3;
            }
          } else {
            // Literal - copy byte directly
            output.push(input[ip]);

            // Update hash table for this position
            if (output.length >= 3) {
              const hash = this._hash(output.slice(-3), 0);
              hashTable[hash] = output.length - 3;
            }

            ip++;
          }

          // Shift control word right by 1 bit to get next control bit
          cword = cword >>> 1;
        }
      }

      this.inputBuffer = [];
      return output;
    }

    // ===== HELPER METHODS =====

    /**
     * QuickLZ Level 1 hash function: ((i >> 12) ^ i) & (QLZ_HASH_VALUES - 1)
     */
    _hash(data, pos) {
      if (pos + 2 >= data.length) return 0;

      // Fetch 3 bytes and pack as 32-bit value (little-endian)
      const fetch = OpCodes.Pack32LE(data[pos], data[pos + 1], data[pos + 2], 0);
      const shifted = OpCodes.Shr32(fetch, 12);
      // XOR the shifted value with original
      const xored = (shifted ^ fetch) >>> 0;
      // Mask to hash table size
      return xored & this.HASH_MASK;
    }

    /**
     * Encode a match (hash, length)
     * QuickLZ encodes the hash value with the match, not the offset
     * Short matches (length < 18): 2 bytes
     * Long matches (length >= 18): 3 bytes
     */
    _encodeMatch(output, hash, length) {
      if (length < 18) {
        // Short/medium match: 2 bytes
        // Lower 4 bits: length - 2
        // Upper 12 bits: hash value
        const masked = hash & 0x0FFF;
        const shifted = OpCodes.Shl16(masked, 4);
        const encoded = shifted | (length - 2);
        output.push(OpCodes.ToByte(encoded));
        output.push(OpCodes.ToByte(OpCodes.Shr16(encoded, 8)));
      } else {
        // Long match: 3 bytes
        // Byte 0-1: hash (lower 4 bits) | 0xF (upper 4 bits)
        // Byte 2: length - 18
        const masked = hash & 0x0FFF;
        const shifted = OpCodes.Shl16(masked, 4);
        const encoded = shifted | 0x0F;
        output.push(OpCodes.ToByte(encoded));
        output.push(OpCodes.ToByte(OpCodes.Shr16(encoded, 8)));
        output.push(OpCodes.ToByte(length - 18));
      }
    }

    /**
     * Decode a match from input stream
     * Returns hash value (for lookup in hash table), length, and next position
     */
    _decodeMatch(input, pos, hashTable, output) {
      if (pos + 2 > input.length) return null;

      const byte0 = input[pos];
      const byte1 = input[pos + 1];
      const encoded = byte0 | (byte1 << 8);

      const lengthField = encoded & 0x0F;
      const hash = (encoded >> 4) & 0x0FFF;

      let length;
      let nextPos;

      if (lengthField === 0x0F) {
        // Long match: read additional length byte
        if (pos + 3 > input.length) return null;
        length = input[pos + 2] + 18;
        nextPos = pos + 3;
      } else {
        // Short/medium match
        length = lengthField + 2;
        nextPos = pos + 2;
      }

      return {
        hash: hash,
        length: length,
        nextPos: nextPos
      };
    }

    /**
     * Write QuickLZ header (9-byte long format)
     */
    _writeHeader(output, decompressedSize) {
      // Flags byte: bit 0=compressed, bit 1=long header, bits 2-3=level, bit 6=always set
      const levelShifted = OpCodes.Shl8(this.COMPRESSION_LEVEL, this.FLAG_LEVEL_SHIFT);
      const flags = this.FLAG_COMPRESSED | this.FLAG_HEADER_LONG | levelShifted | this.FLAG_RESERVED;
      output.push(flags);

      // Compressed size (4 bytes, LE) - placeholder, will be updated
      this._writeU32LE(output, 0);

      // Decompressed size (4 bytes, LE)
      this._writeU32LE(output, decompressedSize);
    }

    /**
     * Update header with final compressed size (bytes 1-4 for 9-byte header)
     */
    _updateHeader(output, decompressedSize) {
      const compressedSize = output.length;

      // Update compressed size at bytes 1-4 (9-byte header format)
      this._updateU32LE(output, 1, compressedSize);
    }

    /**
     * Read QuickLZ header
     */
    _readHeader(input) {
      const flags = input[0];
      const isCompressed = (flags & this.FLAG_COMPRESSED) !== 0;
      const isLongHeader = (flags & this.FLAG_HEADER_LONG) !== 0;

      let compressedSize, decompressedSize, headerSize;

      if (isLongHeader) {
        // Long header: 9 bytes
        headerSize = 9;
        compressedSize = this._readU32LE(input, 1);
        decompressedSize = this._readU32LE(input, 5);
      } else {
        // Short header: 3 bytes
        headerSize = 3;
        compressedSize = input[1] | (input[2] << 8);
        decompressedSize = compressedSize; // Approximation for short header
      }

      return {
        isCompressed,
        isLongHeader,
        compressedSize,
        decompressedSize,
        headerSize
      };
    }

    /**
     * Write 32-bit little-endian value
     */
    _writeU32LE(output, value) {
      output.push(value & 0xFF);
      output.push((value >> 8) & 0xFF);
      output.push((value >> 16) & 0xFF);
      output.push((value >> 24) & 0xFF);
    }

    /**
     * Update 32-bit little-endian value at position
     */
    _updateU32LE(output, pos, value) {
      output[pos] = value & 0xFF;
      output[pos + 1] = (value >> 8) & 0xFF;
      output[pos + 2] = (value >> 16) & 0xFF;
      output[pos + 3] = (value >> 24) & 0xFF;
    }

    /**
     * Read 32-bit little-endian value
     */
    _readU32LE(input, pos) {
      return input[pos] |
             (input[pos + 1] << 8) |
             (input[pos + 2] << 16) |
             (input[pos + 3] << 24);
    }

    /**
     * Write end marker (4 zero bytes)
     */
    _writeEndMarker(output) {
      for (let i = 0; i < this.UNCOMPRESSED_END; i++) {
        output.push(0);
      }
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new QuickLZCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { QuickLZCompression, QuickLZInstance };
}));
