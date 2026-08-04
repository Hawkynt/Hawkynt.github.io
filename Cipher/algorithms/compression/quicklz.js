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
      this.MIN_MATCH = 3;                    // Minimum match length
      this.MAX_SHORT_MATCH = 17;             // Largest length encodable in the 2-byte match token
      this.MAX_MATCH = this.MAX_SHORT_MATCH + 1 + 255; // Largest length encodable with the extended byte
      this.CWORD_LEN = 4;                    // Control word length (32 bits)
      this.CWORD_BITS = 32;                  // One control bit per token

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

      // Test vectors - generated from this implementation and confirmed to round-trip.
      // Format: [9-byte header][32-bit control word][encoded data]
      // Header: flags(1)|compressed_size(4,LE)|decompressed_size(4,LE)
      // Control word: 32 bits, one per token, bit i set means token i is a match (0 means literal)
      this.tests = [
        {
          text: "Empty data",
          uri: "http://www.quicklz.com/",
          input: [],
          expected: [67, 9, 0, 0, 0, 0, 0, 0, 0]
        },
        {
          text: "No repeated patterns - all literals (ABCD)",
          uri: "http://www.quicklz.com/",
          input: OpCodes.AnsiToBytes("ABCD"),
          expected: [67, 17, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 65, 66, 67, 68]
        },
        {
          text: "Pattern repetition - ABC repeated 4 times",
          uri: "http://www.quicklz.com/",
          input: OpCodes.AnsiToBytes("ABCABCABCABC"),
          expected: [67, 18, 0, 0, 0, 12, 0, 0, 0, 8, 0, 0, 0, 65, 66, 67, 86, 103]
        },
        {
          text: "Real text compression - English phrase",
          uri: "http://www.quicklz.com/",
          input: OpCodes.AnsiToBytes("The quick brown fox"),
          expected: [67, 32, 0, 0, 0, 19, 0, 0, 0, 0, 0, 0, 0, 84, 104, 101, 32, 113, 117, 105, 99, 107, 32, 98, 114, 111, 119, 110, 32, 102, 111, 120]
        },
        {
          text: "High repetition - 16 identical characters",
          uri: "http://www.quicklz.com/",
          input: OpCodes.AnsiToBytes("AAAAAAAAAAAAAAAA"),
          expected: [67, 18, 0, 0, 0, 16, 0, 0, 0, 8, 0, 0, 0, 65, 65, 65, 90, 85]
        },
        {
          // 300 identical bytes span multiple 32-bit control words, exercising the deferred
          // hash-table insertion queue across control-word boundaries (regression test for the
          // former trailing-3-bytes hash update, which desynchronized the encoder/decoder tables).
          text: "Highly repetitive data - 300 bytes",
          uri: "http://www.quicklz.com/",
          input: new Array(300).fill(0x58),
          expected: [67, 22, 0, 0, 0, 44, 1, 0, 0, 24, 0, 0, 0, 88, 88, 88, 223, 221, 255, 223, 221, 6]
        },
        {
          text: "Alternating pattern - 300 bytes",
          uri: "http://www.quicklz.com/",
          input: Array.from({ length: 300 }, (_, i) => (i % 2 ? 0x59 : 0x5A)),
          expected: [67, 23, 0, 0, 0, 44, 1, 0, 0, 48, 0, 0, 0, 90, 89, 90, 89, 255, 207, 255, 207, 252, 5]
        },
        {
          text: "English text sample - repeated sentence",
          uri: "http://www.quicklz.com/",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog. ".repeat(10)),
          expected: [67, 67, 0, 0, 0, 194, 1, 0, 0, 0, 0, 0, 0, 84, 104, 101, 32, 113, 117, 105, 99, 107, 32, 98, 114, 111, 119, 110, 32, 102, 111, 120, 32, 106, 117, 109, 112, 115, 32, 111, 118, 101, 114, 32, 116, 1, 24, 0, 0, 224, 118, 108, 97, 122, 121, 32, 100, 111, 103, 46, 32, 47, 224, 255, 127, 103, 114]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new QuickLZInstance(this, isInverse);
    }
  }

  // ===== QUICKLZ INSTANCE IMPLEMENTATION =====

  /**
 * QuickLZ cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class QuickLZInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];

      // QuickLZ parameters from algorithm
      this.MIN_MATCH = algorithm.MIN_MATCH;
      this.MAX_SHORT_MATCH = algorithm.MAX_SHORT_MATCH;
      this.MAX_MATCH = algorithm.MAX_MATCH;
      this.CWORD_LEN = algorithm.CWORD_LEN;
      this.CWORD_BITS = algorithm.CWORD_BITS;
      this.QLZ_HASH_VALUES = algorithm.QLZ_HASH_VALUES;
      this.HASH_MASK = algorithm.HASH_MASK;
      this.FLAG_COMPRESSED = algorithm.FLAG_COMPRESSED;
      this.FLAG_HEADER_LONG = algorithm.FLAG_HEADER_LONG;
      this.FLAG_LEVEL_SHIFT = algorithm.FLAG_LEVEL_SHIFT;
      this.FLAG_RESERVED = algorithm.FLAG_RESERVED;
      this.COMPRESSION_LEVEL = algorithm.COMPRESSION_LEVEL;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.isInverse) {
        return this._decompress();
      } else {
        return this._compress();
      }
    }

    // ===== COMPRESSION =====

    /**
     * Commit queued hash-table insertions whose 3-byte window is now fully
     * materialized in `data` (i.e. every candidate p with p+2 < currentPos).
     * Both compressor and decompressor call this with the same rule so their
     * hash tables stay byte-for-byte identical at every point in the stream -
     * a match token may only reference a hash entry the decompressor could
     * have produced from bytes it has already emitted. Inserting a hash entry
     * eagerly (as soon as a token is coded) would let the compressor find
     * matches built from bytes the decompressor has not reconstructed yet,
     * desynchronizing the two tables.
     */
    _flushPending(pending, hashTable, data, currentPos) {
      while (pending.length > 0 && pending[0] + 2 < currentPos) {
        const p = pending.shift();
        hashTable[this._hash(data, p)] = p;
      }
    }

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

      // Queue of positions awaiting hash-table insertion (see _flushPending)
      const pending = [];

      let ip = 0;                    // Input position
      let cwordPos = -1;             // Position of the current control word
      let cword = 0;                 // Control word value (one bit per token)
      let bitIndex = this.CWORD_BITS; // Forces allocation of a control word on first iteration

      while (ip < inputLength) {
        if (bitIndex === this.CWORD_BITS) {
          if (cwordPos >= 0) {
            this._updateU32LE(output, cwordPos, cword);
          }
          cwordPos = output.length;
          this._writeU32LE(output, 0);
          cword = 0;
          bitIndex = 0;
        }

        this._flushPending(pending, hashTable, input, ip);

        let matchLen = 0;
        let matchHash = -1;

        // Try to find a match (need at least MIN_MATCH bytes)
        if (ip + this.MIN_MATCH <= inputLength) {
          const hash = this._hash(input, ip);
          const matchPos = hashTable[hash];

          if (matchPos >= 0 && matchPos < ip) {
            // Count matching bytes
            const maxLen = Math.min(this.MAX_MATCH, inputLength - ip);
            let len = 0;
            while (len < maxLen && input[matchPos + len] === input[ip + len]) {
              len++;
            }

            if (len >= this.MIN_MATCH) {
              matchLen = len;
              matchHash = hash;
            }
          }

          // Queue this position's hash entry - inserted only once its window is available
          pending.push(ip);
        }

        if (matchLen >= this.MIN_MATCH) {
          // Encode match - set corresponding control bit
          cword = OpCodes.Or32(cword, OpCodes.Shl32(1, bitIndex));
          this._encodeMatch(output, matchHash, matchLen);
          ip += matchLen;
        } else {
          // Encode literal - control bit stays 0
          output.push(input[ip]);
          ip++;
        }

        bitIndex++;
      }

      // Write final control word
      if (cwordPos >= 0) {
        this._updateU32LE(output, cwordPos, cword);
      }

      // Update compressed size in header
      this._updateHeader(output, inputLength);

      this.inputBuffer = [];
      return output;
    }

    // ===== DECOMPRESSION =====

    /**
     * Mirrors the compressor's deferred hash-table insertion exactly (see _flushPending):
     * a position's 3-byte window only becomes an eligible hash entry once it is fully
     * present in the already-reconstructed output, which keeps this table byte-for-byte
     * identical to the compressor's table at every point in the stream.
     */
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

      // Queue of positions awaiting hash-table insertion (see _flushPending)
      const pending = [];

      while (ip < input.length && output.length < headerInfo.decompressedSize) {
        // Read control word
        if (ip + 4 > input.length) {
          throw new Error("QuickLZ decompression error: truncated control word");
        }
        const cword = this._readU32LE(input, ip);
        ip += 4;

        // Process the CWORD_BITS tokens covered by this control word
        for (let bitIndex = 0; bitIndex < this.CWORD_BITS && output.length < headerInfo.decompressedSize; bitIndex++) {
          this._flushPending(pending, hashTable, output, output.length);

          const isMatch = OpCodes.And32(OpCodes.Shr32(cword, bitIndex), 1) === 1;

          if (isMatch) {
            // Match - read encoded (hash, length) token
            const matchInfo = this._decodeMatch(input, ip);
            if (!matchInfo) {
              throw new Error("QuickLZ decompression error: truncated match token");
            }
            ip = matchInfo.nextPos;

            const matchPos = hashTable[matchInfo.hash];
            if (matchPos < 0) {
              throw new Error(`QuickLZ decompression error: invalid hash index ${matchInfo.hash}`);
            }

            const phraseStart = output.length;
            for (let i = 0; i < matchInfo.length; i++) {
              output.push(output[matchPos + i]);
            }

            // Queue this phrase's hash entry - inserted only once its window is available
            pending.push(phraseStart);
          } else {
            // Literal - copy byte directly
            if (ip >= input.length) {
              throw new Error("QuickLZ decompression error: truncated literal");
            }
            const bytePos = output.length;
            output.push(input[ip++]);

            // Queue this position's hash entry - inserted only once its window is available
            pending.push(bytePos);
          }
        }
      }

      this.inputBuffer = [];
      return output;
    }

    // ===== HELPER METHODS =====

    /**
     * QuickLZ Level 1 hash function: ((OpCodes.Shr32(i, 12))^i)&(QLZ_HASH_VALUES - 1)
     */
    _hash(data, pos) {
      if (pos + 2 >= data.length) return 0;

      // Fetch 3 bytes and pack as 32-bit value (little-endian)
      const fetch = OpCodes.Pack32LE(data[pos], data[pos + 1], data[pos + 2], 0);
      const shifted = OpCodes.Shr32(fetch, 12);
      // XOR the shifted value with original
      const xored = OpCodes.Xor32(shifted, fetch);
      // Mask to hash table size
      return OpCodes.And32(xored, this.HASH_MASK);
    }

    /**
     * Encode a match (hash, length)
     * QuickLZ encodes the hash value with the match, not the offset.
     * Short matches (length <= MAX_SHORT_MATCH): 2 bytes, length field 0-14 (0x0F is reserved).
     * Long matches (length > MAX_SHORT_MATCH): 3 bytes, extra byte carries length - (MAX_SHORT_MATCH + 1).
     */
    _encodeMatch(output, hash, length) {
      const masked = OpCodes.And32(hash, this.HASH_MASK);
      if (length <= this.MAX_SHORT_MATCH) {
        const encoded = OpCodes.Or32(OpCodes.Shl16(masked, 4), length - this.MIN_MATCH);
        output.push(OpCodes.ToByte(encoded));
        output.push(OpCodes.ToByte(OpCodes.Shr16(encoded, 8)));
      } else {
        const encoded = OpCodes.Or32(OpCodes.Shl16(masked, 4), 0x0F);
        output.push(OpCodes.ToByte(encoded));
        output.push(OpCodes.ToByte(OpCodes.Shr16(encoded, 8)));
        output.push(OpCodes.ToByte(length - (this.MAX_SHORT_MATCH + 1)));
      }
    }

    /**
     * Decode a match token from the input stream.
     * Returns the hash bucket index (for lookup in the synchronized hash table), the
     * match length, and the input position following the token.
     */
    _decodeMatch(input, pos) {
      if (pos + 2 > input.length) return null;

      const byte0 = input[pos];
      const byte1 = input[pos + 1];
      const encoded = OpCodes.Or32(byte0, OpCodes.Shl32(byte1, 8));

      const lengthField = OpCodes.And32(encoded, 0x0F);
      const hash = OpCodes.And32(OpCodes.Shr32(encoded, 4), this.HASH_MASK);

      let length;
      let nextPos;

      if (lengthField === 0x0F) {
        // Long match: read additional length byte
        if (pos + 3 > input.length) return null;
        length = input[pos + 2] + this.MAX_SHORT_MATCH + 1;
        nextPos = pos + 3;
      } else {
        // Short/medium match
        length = lengthField + this.MIN_MATCH;
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
      const flags = OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(this.FLAG_COMPRESSED, this.FLAG_HEADER_LONG), levelShifted), this.FLAG_RESERVED);
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
      const isCompressed = OpCodes.And32(flags, this.FLAG_COMPRESSED) !== 0;
      const isLongHeader = OpCodes.And32(flags, this.FLAG_HEADER_LONG) !== 0;

      let compressedSize, decompressedSize, headerSize;

      if (isLongHeader) {
        // Long header: 9 bytes
        headerSize = 9;
        compressedSize = this._readU32LE(input, 1);
        decompressedSize = this._readU32LE(input, 5);
      } else {
        // Short header: 3 bytes
        headerSize = 3;
        compressedSize = OpCodes.Or32(input[1], OpCodes.Shl32(input[2], 8));
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
      output.push(OpCodes.ToByte(value));
      output.push(OpCodes.ToByte(OpCodes.Shr32(value, 8)));
      output.push(OpCodes.ToByte(OpCodes.Shr32(value, 16)));
      output.push(OpCodes.ToByte(OpCodes.Shr32(value, 24)));
    }

    /**
     * Update 32-bit little-endian value at position
     */
    _updateU32LE(output, pos, value) {
      output[pos] = OpCodes.ToByte(value);
      output[pos + 1] = OpCodes.ToByte(OpCodes.Shr32(value, 8));
      output[pos + 2] = OpCodes.ToByte(OpCodes.Shr32(value, 16));
      output[pos + 3] = OpCodes.ToByte(OpCodes.Shr32(value, 24));
    }

    /**
     * Read 32-bit little-endian value
     */
    _readU32LE(input, pos) {
      return OpCodes.Pack32LE(input[pos], input[pos + 1], input[pos + 2], input[pos + 3]);
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
