/*
 * LZFX Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZFX: Improved LZF variant by Andrew Collette (2008).
 * Fast LZ77-based compression with simple hash table matching.
 * Better compression ratio than original LZF while maintaining high speed.
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

  // ===== ALGORITHM IMPLEMENTATION =====

  class LZFXCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LZFX";
      this.description = "Improved LZF variant with better compression ratios while maintaining high speed. Uses hash-based LZ77 matching with 13-bit offset encoding and simple token format. Designed for applications requiring fast compression with minimal memory overhead.";
      this.inventor = "Andrew Collette";
      this.year = 2008;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // LZFX Configuration Constants
      /** @type {int32} */
      this.HLOG = 16;                          // Hash table size: 2^16 entries
      /** @type {int32} */
      this.HSIZE = OpCodes.Shl32(1, this.HLOG); // 65536 hash table entries
      /** @type {int32} */
      this.MAX_LIT = 32;                       // Maximum literal run length
      /** @type {int32} */
      this.MAX_OFF = 8191;                     // Maximum offset (13-bit: 2^13 - 1)
      /** @type {int32} */
      this.MAX_REF = 264;                      // Maximum reference length (256 + 8)

      // Documentation and references
      this.documentation = [
        new LinkItem("LZFX Original Project", "https://code.google.com/archive/p/lzfx/"),
        new LinkItem("LZFX GitHub Repository", "https://github.com/berkedel/lzfx"),
        new LinkItem("LZF Compression Filter for HDF5", "http://www.h5py.org/lzf/"),
        new LinkItem("pcompress LZFX Implementation", "https://github.com/moinakg/pcompress/blob/master/lzfx/lzfx.c")
      ];

      this.references = [
        new LinkItem("Original LZF by Marc Lehmann", "http://oldhome.schmorp.de/marc/liblzf.html"),
        new LinkItem("LZ77 Algorithm", "https://en.wikipedia.org/wiki/LZ77_and_LZ78"),
        new LinkItem("LZFX Format Specification", "https://code.google.com/archive/p/lzfx/wikis/CompressedFormat.wiki")
      ];

      // Test vectors cross-checked byte-for-byte against CompressionWorkbench's
      // BB_Lzfx building block (Compression.Core.Dictionary.Lzfx), which is the
      // authoritative wire format: a 4-byte little-endian original-length
      // header followed by the LZFX token stream (literals < 32, backrefs >= 32).
      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes("ABCD"),
          [4, 0, 0, 0, 0x03, 0x41, 0x42, 0x43, 0x44], // header(4) + literal: 000|00011 (3 = 4-1) + 4 bytes
          "All literals - no compression",
          "https://github.com/berkedel/lzfx"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AAAA"),
          [4, 0, 0, 0, 0x00, 0x41, 0x20, 0x00], // header(4) + literal A + backref (len=1+2=3, off=0)
          "Repetition - AAAA",
          "https://github.com/berkedel/lzfx"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AAAAAAAAAA"), // 10 A's
          [10, 0, 0, 0, 0x00, 0x41, 0xE0, 0x00, 0x00], // header(10) + A + long backref (len=7+2=9, off=0)
          "Long repetition - 10 A's",
          "https://github.com/berkedel/lzfx"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("ABCABCABC"), // 9 bytes
          [9, 0, 0, 0, 0x02, 0x41, 0x42, 0x43, 0x80, 0x02], // header(9) + ABC literal + backref (len=4+2=6, off=2)
          "Pattern repetition - ABCABCABC",
          "https://github.com/berkedel/lzfx"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("Hello World! Hello World!"),
          [25, 0, 0, 0, 12,72,101,108,108,111,32,87,111,114,108,100,33,32,224,3,12], // header(25) + "Hello World! " + backref
          "Long text compression",
          "https://github.com/berkedel/lzfx"
        ),
        new TestCase(
          new Array(100).fill(0x42), // 100 B's
          [100, 0, 0, 0, 0,66,224,90,0], // header(100) + B + long backref (len=97)
          "Highly repetitive data",
          "https://github.com/berkedel/lzfx"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {LZFXInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LZFXInstance(this, isInverse);
    }
  }

  /**
 * LZFX cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class LZFXInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {LZFXCompression} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {int32} */
      this.hlog = algorithm.HLOG;
      /** @type {int32} */
      this.hsize = algorithm.HSIZE;
      /** @type {int32} */
      this.maxLit = algorithm.MAX_LIT;
      /** @type {int32} */
      this.maxOff = algorithm.MAX_OFF;
      /** @type {int32} */
      this.maxRef = algorithm.MAX_REF;
    }


    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.isInverse) {
        if (this.inputBuffer.length === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }
        return this._decompress();
      }

      // Compression always emits the 4-byte length header, even for empty
      // input (matching the CompressionWorkbench reference building block).
      return this._compress();
    }

    /**
     * @returns {uint8[]} 4-byte LE length followed by LZFX literal runs and references
     */
    _compress() {
      /** @type {uint8[]} */
      const input = this.inputBuffer;
      /** @type {uint8[]} */
      const header = OpCodes.Unpack32LE(input.length);
      /** @type {uint8[]} */
      const output = [];
      // Hash table (-1 = empty slot)
      /** @type {int32[]} */
      const htab = new Array(this.hsize);
      for (let i = 0; i < this.hsize; i++) {
        htab[i] = -1;
      }

      /** @type {int32} */
      let ip = 0;          // Input position
      /** @type {int32} */
      let lit = 0;         // Literal run start position
      /** @type {int32} */
      const iend = input.length;

      /** @type {uint8[]} */
      const fresh = [];
      if (iend < 3) {
        // Too small to compress - output as literals
        this._flushLiterals(output, input, 0, iend);
        this.inputBuffer = fresh;
        return header.concat(output);
      }

      // Initialize hash value with first two bytes
      /** @type {uint32} */
      let hval = OpCodes.Or32(OpCodes.Shl16(input[0], 8), input[1]);

      while (ip < iend - 2) {
        // Compute hash from current 3-byte sequence
        hval = OpCodes.Or32(OpCodes.Shl16(input[ip], 8), input[ip + 1]);
        /** @type {uint32} */
        const hidx = OpCodes.And32(OpCodes.Add32(OpCodes.Xor32(hval, OpCodes.Shr16(hval, 8)), input[ip + 2]), this.hsize - 1);
        /** @type {int32} */
        const ref = htab[hidx];

        // Store current position in hash table
        htab[hidx] = ip;

        /** @type {int32} */
        let off = 0;

        // Check for valid match (need at least 3 bytes matching)
        /** @type {boolean} */
        let isMatch = false;
        if (ref >= 0 && ref < ip) {
          off = ip - ref - 1;
          isMatch = off <= this.maxOff &&
            input[ref] === input[ip] &&
            input[ref + 1] === input[ip + 1] &&
            input[ref + 2] === input[ip + 2];
        }

        if (isMatch) {
          // Found a match - determine length
          /** @type {int32} */
          let len = 3;
          /** @type {int32} */
          const maxlen = Math.min(this.maxRef, iend - ip);

          while (len < maxlen && input[ref + len] === input[ip + len]) {
            ++len;
          }

          // Flush any pending literals before the match
          if (ip > lit) {
            this._flushLiterals(output, input, lit, ip);
          }

          // Encode back reference
          /** @type {int32} */
          const encodedLen = len - 2; // Encode as len - 2 (minimum match is 3, encoded as 1)

          if (encodedLen < 7) {
            // Short reference: LLLooooo oooooooo
            // LLL = encoded length (1-6 represents real length 3-8)
            // ooooooooooooo = 13-bit offset
            output.push(OpCodes.Or32(OpCodes.Shl8(encodedLen, 5), OpCodes.Shr16(off, 8)));
            output.push(OpCodes.And32(off, 0xFF));
          } else {
            // Long reference: 111ooooo LLLLLLLL oooooooo
            // 111 = marker for long reference
            // ooooo = high 5 bits of offset
            // LLLLLLLL = len - 9 (extended length: real length >= 9)
            // oooooooo = low 8 bits of offset
            output.push(OpCodes.Or32(0xE0, OpCodes.Shr16(off, 8)));
            output.push(OpCodes.And32(encodedLen - 7, 0xFF));
            output.push(OpCodes.And32(off, 0xFF));
          }

          ip += len; // Skip matched bytes
          lit = ip;

          // Reset hash for next position
          if (ip < iend - 2) {
            hval = OpCodes.Or32(OpCodes.Shl16(input[ip], 8), input[ip + 1]);
          }
        } else {
          ++ip;

          // Flush literals if run gets too long
          if (ip - lit >= this.maxLit) {
            this._flushLiterals(output, input, lit, ip);
            lit = ip;
          }
        }
      }

      // Flush remaining input as literals
      if (lit < iend) {
        this._flushLiterals(output, input, lit, iend);
      }

      this.inputBuffer = fresh;
      return header.concat(output);
    }

    /**
     * Emit input[start..end) as literal runs of at most maxLit bytes
     * @param {uint8[]} output - Destination
     * @param {uint8[]} input - Source
     * @param {int32} start - First literal
     * @param {int32} end - End of the literals (exclusive)
     */
    _flushLiterals(output, input, start, end) {
      /** @type {int32} */
      let len = end - start;
      /** @type {int32} */
      let at = start;

      while (len > 0) {
        /** @type {int32} */
        const chunk = Math.min(len, this.maxLit);

        // Encode literal: 000LLLLL where LLLLL = chunk - 1
        output.push(chunk - 1);

        // Copy literal bytes
        for (let i = 0; i < chunk; ++i) {
          output.push(input[at + i]);
        }

        at += chunk;
        len -= chunk;
      }
    }

    /**
     * @returns {uint8[]} Decoded bytes
     */
    _decompress() {
      /** @type {uint8[]} */
      const input = this.inputBuffer;
      /** @type {uint8[]} */
      const output = [];
      /** @type {uint8[]} */
      const fresh = [];
      if (input.length < 4) {
        this.inputBuffer = fresh;
        return output;
      }

      /** @type {uint32} */
      const originalLength = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      if (originalLength === 0) {
        this.inputBuffer = fresh;
        return output;
      }

      /** @type {int32} */
      let ip = 4;
      /** @type {int32} */
      const iend = input.length;

      while (output.length < originalLength) {
        /** @type {uint8} */
        const ctrl = input[ip++];

        if (ctrl < 32) {
          // Literal run: 000LLLLL <L+1 bytes>
          /** @type {int32} */
          const len = ctrl + 1;

          if (ip + len > iend) {
            throw new Error("LZFX decompression error: insufficient input data for literal run");
          }

          for (let i = 0; i < len; ++i) {
            output.push(input[ip++]);
          }
        } else {
          // Back reference
          /** @type {int32} */
          let len = OpCodes.Shr8(ctrl, 5);
          /** @type {int32} */
          let off = 0;

          if (len === 7) {
            // Long reference: 111ooooo LLLLLLLL oooooooo
            if (ip + 2 > iend) {
              throw new Error("LZFX decompression error: insufficient input data for long reference");
            }

            len = input[ip++] + 7;
            off = OpCodes.Or32(OpCodes.Shl16(OpCodes.And32(ctrl, 0x1F), 8), input[ip++]);
          } else {
            // Short reference: LLLooooo oooooooo
            if (ip + 1 > iend) {
              throw new Error("LZFX decompression error: insufficient input data for short reference");
            }

            off = OpCodes.Or32(OpCodes.Shl16(OpCodes.And32(ctrl, 0x1F), 8), input[ip++]);
          }

          len += 2; // Decode: add back the 2 we subtracted during encoding
          off += 1; // Offset stored as distance - 1

          // Validate reference
          if (off > output.length) {
            throw new Error("LZFX decompression error: invalid offset " + off + " at output position " + output.length);
          }

          // Copy referenced bytes
          /** @type {int32} */
          const ref = output.length - off;
          for (let i = 0; i < len; ++i) {
            output.push(output[ref + i]);
          }
        }
      }

      this.inputBuffer = fresh;
      return output;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZFXCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZFXCompression, LZFXInstance };
}));
