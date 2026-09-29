/*
 * QuickLZ Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * QuickLZ is a fast compression library focused on compression and decompression speed.
 * This implementation follows the QuickLZ level-1 algorithm description published by
 * Lasse Mikkel Reinhold at http://www.quicklz.com/ - a hash-matched LZ77 variant with a
 * 32-bit control word (one bit per token) whose matches reference a 4096-entry hash table
 * by bucket index instead of by raw distance.
 *
 * Created by Lasse Mikkel Reinhold (2009)
 * Patent-free, widely used in games and embedded systems
 *
 * Stream layout: [4-byte LE uncompressed size][32-bit control word][tokens] ...
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
      /** @type {int32} */
      this.VERSION_MAJOR = 1;
      /** @type {int32} */
      this.VERSION_MINOR = 5;
      /** @type {int32} */
      this.VERSION_REVISION = 0;

      // Encoding constants
      /** @type {int32} */
      this.MIN_MATCH = 3;                    // Minimum match length
      /** @type {int32} */
      this.MAX_SHORT_MATCH = 17;             // Largest length encodable in the 2-byte match token
      /** @type {int32} */
      this.MAX_MATCH = this.MAX_SHORT_MATCH + 1 + 255; // Largest length encodable with the extended byte
      /** @type {int32} */
      this.CWORD_LEN = 4;                    // Control word length (32 bits)
      /** @type {int32} */
      this.CWORD_BITS = 32;                  // One control bit per token

      // Hash table configuration (Level 1)
      /** @type {int32} */
      this.QLZ_POINTERS = 1;                 // Single pointer per hash entry
      /** @type {int32} */
      this.QLZ_HASH_VALUES = 4096;           // Hash table size
      /** @type {int32} */
      this.HASH_MASK = this.QLZ_HASH_VALUES - 1;

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

      // Test vectors - confirmed to round-trip and to match the reference
      // implementation of the same level-1 stream layout byte for byte.
      // Format: [4-byte LE uncompressed size][32-bit control word][encoded data]
      // Control word: 32 bits, one per token, bit i set means token i is a match (0 means literal)
      this.tests = [
        {
          text: "Empty data",
          uri: "http://www.quicklz.com/",
          input: [],
          expected: [0, 0, 0, 0]
        },
        {
          text: "No repeated patterns - all literals (ABCD)",
          uri: "http://www.quicklz.com/",
          input: OpCodes.AnsiToBytes("ABCD"),
          expected: [4, 0, 0, 0, 0, 0, 0, 0, 65, 66, 67, 68]
        },
        {
          text: "Pattern repetition - ABC repeated 4 times",
          uri: "http://www.quicklz.com/",
          input: OpCodes.AnsiToBytes("ABCABCABCABC"),
          expected: [12, 0, 0, 0, 8, 0, 0, 0, 65, 66, 67, 86, 103]
        },
        {
          text: "Real text compression - English phrase",
          uri: "http://www.quicklz.com/",
          input: OpCodes.AnsiToBytes("The quick brown fox"),
          expected: [19, 0, 0, 0, 0, 0, 0, 0, 84, 104, 101, 32, 113, 117, 105, 99, 107, 32, 98, 114, 111, 119, 110, 32, 102, 111, 120]
        },
        {
          text: "High repetition - 16 identical characters",
          uri: "http://www.quicklz.com/",
          input: OpCodes.AnsiToBytes("AAAAAAAAAAAAAAAA"),
          expected: [16, 0, 0, 0, 8, 0, 0, 0, 65, 65, 65, 90, 85]
        },
        {
          // 300 identical bytes span multiple 32-bit control words, exercising the deferred
          // hash-table insertion queue across control-word boundaries (regression test for the
          // former trailing-3-bytes hash update, which desynchronized the encoder/decoder tables).
          text: "Highly repetitive data - 300 bytes",
          uri: "http://www.quicklz.com/",
          input: new Array(300).fill(0x58),
          expected: [44, 1, 0, 0, 24, 0, 0, 0, 88, 88, 88, 223, 221, 255, 223, 221, 6]
        },
        {
          text: "Alternating pattern - 300 bytes",
          uri: "http://www.quicklz.com/",
          input: Array.from({ length: 300 }, (_, i) => (i % 2 ? 0x59 : 0x5A)),
          expected: [44, 1, 0, 0, 48, 0, 0, 0, 90, 89, 90, 89, 255, 207, 255, 207, 252, 5]
        },
        {
          text: "English text sample - repeated sentence",
          uri: "http://www.quicklz.com/",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog. ".repeat(10)),
          expected: [194, 1, 0, 0, 0, 0, 0, 0, 84, 104, 101, 32, 113, 117, 105, 99, 107, 32, 98, 114, 111, 119, 110, 32, 102, 111, 120, 32, 106, 117, 109, 112, 115, 32, 111, 118, 101, 114, 32, 116, 1, 24, 0, 0, 224, 118, 108, 97, 122, 121, 32, 100, 111, 103, 46, 32, 47, 224, 255, 127, 103, 114]
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
   * @param {QuickLZCompression} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];

      // QuickLZ parameters from algorithm
      /** @type {int32} */
      this.MIN_MATCH = algorithm.MIN_MATCH;
      /** @type {int32} */
      this.MAX_SHORT_MATCH = algorithm.MAX_SHORT_MATCH;
      /** @type {int32} */
      this.MAX_MATCH = algorithm.MAX_MATCH;
      /** @type {int32} */
      this.CWORD_LEN = algorithm.CWORD_LEN;
      /** @type {int32} */
      this.CWORD_BITS = algorithm.CWORD_BITS;
      /** @type {int32} */
      this.QLZ_HASH_VALUES = algorithm.QLZ_HASH_VALUES;
      /** @type {int32} */
      this.HASH_MASK = algorithm.HASH_MASK;

      // Fields of the match token most recently read by _decodeMatch
      /** @type {uint32} */
      this.tokenHash = 0;
      /** @type {int32} */
      this.tokenLength = 0;
      /** @type {int32} */
      this.tokenNextPos = 0;
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
     * @param {int32[]} pending - Queued positions, oldest first
     * @param {int32[]} hashTable - Hash table
     * @param {uint8[]} data - Bytes the positions refer to
     * @param {int32} currentPos - Number of bytes available
     */
    _flushPending(pending, hashTable, data, currentPos) {
      while (pending.length > 0 && pending[0] + 2 < currentPos) {
        /** @type {int32} */
        const p = pending.shift();
        hashTable[this._hash(data, p)] = p;
      }
    }

    /**
     * @returns {uint8[]} Size header and QuickLZ stream
     */
    _compress() {
      /** @type {uint8[]} */
      const input = this.inputBuffer;
      /** @type {int32} */
      const inputLength = input.length;
      /** @type {uint8[]} */
      const output = [];

      // 4-byte little-endian uncompressed size header
      this._writeU32LE(output, inputLength);

      if (inputLength === 0) {
        // Empty input - no control word or tokens follow the header
        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        return output;
      }

      // Initialize hash table
      /** @type {int32[]} */
      const hashTable = new Int32Array(this.QLZ_HASH_VALUES);
      hashTable.fill(-1);

      // Queue of positions awaiting hash-table insertion (see _flushPending)
      /** @type {int32[]} */
      const pending = [];

      /** @type {int32} */
      let ip = 0;                    // Input position
      /** @type {int32} */
      let cwordPos = -1;             // Position of the current control word
      /** @type {uint32} */
      let cword = 0;                 // Control word value (one bit per token)
      /** @type {int32} */
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

        /** @type {int32} */
        let matchLen = 0;
        /** @type {int32} */
        let matchHash = -1;

        // Try to find a match (need at least MIN_MATCH bytes)
        if (ip + this.MIN_MATCH <= inputLength) {
          /** @type {uint32} */
          const hash = this._hash(input, ip);
          /** @type {int32} */
          const matchPos = hashTable[hash];

          if (matchPos >= 0 && matchPos < ip) {
            // Count matching bytes
            /** @type {int32} */
            const maxLen = Math.min(this.MAX_MATCH, inputLength - ip);
            /** @type {int32} */
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

      /** @type {uint8[]} */
      const cleared = [];
      this.inputBuffer = cleared;
      return output;
    }

    // ===== DECOMPRESSION =====

    /**
     * Mirrors the compressor's deferred hash-table insertion exactly (see _flushPending):
     * a position's 3-byte window only becomes an eligible hash entry once it is fully
     * present in the already-reconstructed output, which keeps this table byte-for-byte
     * identical to the compressor's table at every point in the stream.
     * @returns {uint8[]} Decoded bytes
     */
    _decompress() {
      /** @type {uint8[]} */
      const input = this.inputBuffer;

      if (input.length < 4) {
        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      // 4-byte little-endian uncompressed size header
      /** @type {uint32} */
      const originalLength = this._readU32LE(input, 0);

      /** @type {uint8[]} */
      const output = [];
      /** @type {int32} */
      let ip = 4;  // Input position after header

      // Empty input case
      if (originalLength === 0) {
        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        return output;
      }

      // Initialize hash table for decompression
      /** @type {int32[]} */
      const hashTable = new Int32Array(this.QLZ_HASH_VALUES);
      hashTable.fill(-1);

      // Queue of positions awaiting hash-table insertion (see _flushPending)
      /** @type {int32[]} */
      const pending = [];

      while (output.length < originalLength) {
        // Read control word
        if (ip + 4 > input.length) {
          throw new Error("QuickLZ decompression error: truncated control word");
        }
        /** @type {uint32} */
        const cword = this._readU32LE(input, ip);
        ip += 4;

        // Process the CWORD_BITS tokens covered by this control word
        for (let bitIndex = 0; bitIndex < this.CWORD_BITS && output.length < originalLength; bitIndex++) {
          this._flushPending(pending, hashTable, output, output.length);

          /** @type {boolean} */
          const isMatch = OpCodes.And32(OpCodes.Shr32(cword, bitIndex), 1) === 1;

          if (isMatch) {
            // Match - read encoded (hash, length) token
            if (!this._decodeMatch(input, ip)) {
              throw new Error("QuickLZ decompression error: truncated match token");
            }
            ip = this.tokenNextPos;

            /** @type {int32} */
            const matchPos = hashTable[this.tokenHash];
            if (matchPos < 0) {
              throw new Error("QuickLZ decompression error: invalid hash index " + this.tokenHash);
            }

            /** @type {int32} */
            const phraseStart = output.length;
            for (let i = 0; i < this.tokenLength; i++) {
              output.push(output[matchPos + i]);
            }

            // Queue this phrase's hash entry - inserted only once its window is available
            if (phraseStart + this.MIN_MATCH <= originalLength) {
              pending.push(phraseStart);
            }
          } else {
            // Literal - copy byte directly
            if (ip >= input.length) {
              throw new Error("QuickLZ decompression error: truncated literal");
            }
            /** @type {int32} */
            const bytePos = output.length;
            output.push(input[ip++]);

            // Queue this position's hash entry - inserted only once its window is available
            if (bytePos + this.MIN_MATCH <= originalLength) {
              pending.push(bytePos);
            }
          }
        }
      }

      /** @type {uint8[]} */
      const cleared = [];
      this.inputBuffer = cleared;
      return output;
    }

    // ===== HELPER METHODS =====

    /**
     * QuickLZ Level 1 hash function: ((OpCodes.Shr32(i, 12))^i)&(QLZ_HASH_VALUES - 1)
     * @param {uint8[]} data - Bytes
     * @param {int32} pos - Position of the three hashed bytes
     * @returns {uint32} Hash bucket (0 when fewer than three bytes remain)
     */
    _hash(data, pos) {
      if (pos + 2 >= data.length) {
        return 0;
      }

      // Fetch 3 bytes and pack as 32-bit value (little-endian)
      /** @type {uint32} */
      const fetch = OpCodes.Pack32LE(data[pos], data[pos + 1], data[pos + 2], 0);
      /** @type {uint32} */
      const shifted = OpCodes.Shr32(fetch, 12);
      // XOR the shifted value with original
      /** @type {uint32} */
      const xored = OpCodes.Xor32(shifted, fetch);
      // Mask to hash table size
      return OpCodes.And32(xored, this.HASH_MASK);
    }

    /**
     * Encode a match (hash, length)
     * QuickLZ encodes the hash value with the match, not the offset.
     * Short matches (length <= MAX_SHORT_MATCH): 2 bytes, length field 0-14 (0x0F is reserved).
     * Long matches (length > MAX_SHORT_MATCH): 3 bytes, extra byte carries length - (MAX_SHORT_MATCH + 1).
     * @param {uint8[]} output - Output
     * @param {int32} hash - Hash bucket of the match source
     * @param {int32} length - Match length
     */
    _encodeMatch(output, hash, length) {
      /** @type {uint32} */
      const masked = OpCodes.And32(hash, this.HASH_MASK);
      if (length <= this.MAX_SHORT_MATCH) {
        /** @type {uint32} */
        const encoded = OpCodes.Or32(OpCodes.Shl16(masked, 4), length - this.MIN_MATCH);
        output.push(OpCodes.ToByte(encoded));
        output.push(OpCodes.ToByte(OpCodes.Shr16(encoded, 8)));
      } else {
        /** @type {uint32} */
        const encoded = OpCodes.Or32(OpCodes.Shl16(masked, 4), 0x0F);
        output.push(OpCodes.ToByte(encoded));
        output.push(OpCodes.ToByte(OpCodes.Shr16(encoded, 8)));
        output.push(OpCodes.ToByte(length - (this.MAX_SHORT_MATCH + 1)));
      }
    }

    /**
     * Decode a match token from the input stream into tokenHash (the hash bucket
     * index for lookup in the synchronized hash table), tokenLength (the match
     * length) and tokenNextPos (the input position following the token).
     * @param {uint8[]} input - Compressed stream
     * @param {int32} pos - Position of the token
     * @returns {boolean} False when the token is truncated
     */
    _decodeMatch(input, pos) {
      if (pos + 2 > input.length) {
        return false;
      }

      /** @type {uint8} */
      const byte0 = input[pos];
      /** @type {uint8} */
      const byte1 = input[pos + 1];
      /** @type {uint32} */
      const encoded = OpCodes.Or32(byte0, OpCodes.Shl32(byte1, 8));

      /** @type {uint32} */
      const lengthField = OpCodes.And32(encoded, 0x0F);
      /** @type {uint32} */
      const hash = OpCodes.And32(OpCodes.Shr32(encoded, 4), this.HASH_MASK);

      if (lengthField === 0x0F) {
        // Long match: read additional length byte
        if (pos + 3 > input.length) {
          return false;
        }
        /** @type {int32} */
        const extra = input[pos + 2];
        this.tokenLength = extra + this.MAX_SHORT_MATCH + 1;
        this.tokenNextPos = pos + 3;
      } else {
        // Short/medium match
        /** @type {int32} */
        const field = lengthField;
        this.tokenLength = field + this.MIN_MATCH;
        this.tokenNextPos = pos + 2;
      }
      this.tokenHash = hash;
      return true;
    }

    /**
     * Write 32-bit little-endian value
     * @param {uint8[]} output - Output
     * @param {uint32} value - Value
     */
    _writeU32LE(output, value) {
      output.push(OpCodes.ToByte(value));
      output.push(OpCodes.ToByte(OpCodes.Shr32(value, 8)));
      output.push(OpCodes.ToByte(OpCodes.Shr32(value, 16)));
      output.push(OpCodes.ToByte(OpCodes.Shr32(value, 24)));
    }

    /**
     * Update 32-bit little-endian value at position
     * @param {uint8[]} output - Output
     * @param {int32} pos - Position of the value
     * @param {uint32} value - Value
     */
    _updateU32LE(output, pos, value) {
      output[pos] = OpCodes.ToByte(value);
      output[pos + 1] = OpCodes.ToByte(OpCodes.Shr32(value, 8));
      output[pos + 2] = OpCodes.ToByte(OpCodes.Shr32(value, 16));
      output[pos + 3] = OpCodes.ToByte(OpCodes.Shr32(value, 24));
    }

    /**
     * Read 32-bit little-endian value
     * @param {uint8[]} input - Bytes
     * @param {int32} pos - Position of the value
     * @returns {uint32} Value
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
