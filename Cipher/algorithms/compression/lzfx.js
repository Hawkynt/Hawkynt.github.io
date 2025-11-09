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
      this.HLOG = 16;                          // Hash table size: 2^16 entries
      this.HSIZE = OpCodes.Shl32(1, this.HLOG); // 65536 hash table entries
      this.MAX_LIT = 32;                       // Maximum literal run length
      this.MAX_OFF = 8191;                     // Maximum offset (13-bit: 2^13 - 1)
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

      // Test vectors - verified with implementation round-trips
      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes("ABCD"),
          [0x03, 0x41, 0x42, 0x43, 0x44], // Literal: 000|00011 (3 = 4-1) + 4 bytes
          "All literals - no compression",
          "https://github.com/berkedel/lzfx"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AAAA"),
          [0x00, 0x41, 0x20, 0x00], // Literal A + backref (len=1+2=3, off=0)
          "Repetition - AAAA",
          "https://github.com/berkedel/lzfx"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AAAAAAAAAA"), // 10 A's
          [0x00, 0x41, 0xE0, 0x00, 0x00], // A + long backref (len=7+2=9, off=0)
          "Long repetition - 10 A's",
          "https://github.com/berkedel/lzfx"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("ABCABCABC"), // 9 bytes
          [0x02, 0x41, 0x42, 0x43, 0x80, 0x02], // ABC literal + backref (len=4+2=6, off=2)
          "Pattern repetition - ABCABCABC",
          "https://github.com/berkedel/lzfx"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("Hello World! Hello World!"),
          [12,72,101,108,108,111,32,87,111,114,108,100,33,32,224,3,12], // "Hello World! " + backref
          "Long text compression",
          "https://github.com/berkedel/lzfx"
        ),
        new TestCase(
          new Array(100).fill(0x42), // 100 B's
          [0,66,224,90,0], // B + long backref (len=97)
          "Highly repetitive data",
          "https://github.com/berkedel/lzfx"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new LZFXInstance(this, isInverse);
    }
  }

  class LZFXInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this.hlog = algorithm.HLOG;
      this.hsize = algorithm.HSIZE;
      this.maxLit = algorithm.MAX_LIT;
      this.maxOff = algorithm.MAX_OFF;
      this.maxRef = algorithm.MAX_REF;
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
      const output = [];
      const htab = new Array(this.hsize); // Hash table

      let ip = 0;          // Input position
      let lit = 0;         // Literal run start position
      const iend = input.length;

      if (iend < 3) {
        // Too small to compress - output as literals
        if (iend === 0) return [];
        this._flushLiterals(output, input, 0, iend);
        this.inputBuffer = [];
        return output;
      }

      // Initialize hash value with first two bytes
      let hval = OpCodes.OrN(OpCodes.Shl16(input[0], 8), input[1]);

      while (ip < iend - 2) {
        // Compute hash from current 3-byte sequence
        hval = OpCodes.OrN(OpCodes.Shl16(input[ip], 8), input[ip + 1]);
        const hidx = OpCodes.AndN((OpCodes.XorN(hval, OpCodes.Shr16(hval, 8)) + input[ip + 2]), this.hsize - 1);
        const ref = htab[hidx];

        // Store current position in hash table
        htab[hidx] = ip;

        let off = 0;

        // Check for valid match (need at least 3 bytes matching)
        if (ref !== undefined &&
            ref >= 0 &&
            ref < ip &&
            (off = ip - ref - 1) <= this.maxOff &&
            input[ref] === input[ip] &&
            input[ref + 1] === input[ip + 1] &&
            input[ref + 2] === input[ip + 2]) {

          // Found a match - determine length
          let len = 3;
          const maxlen = Math.min(this.maxRef, iend - ip);

          while (len < maxlen && input[ref + len] === input[ip + len]) {
            ++len;
          }

          // Flush any pending literals before the match
          if (ip > lit) {
            this._flushLiterals(output, input, lit, ip);
          }

          // Encode back reference
          const encodedLen = len - 2; // Encode as len - 2 (minimum match is 3, encoded as 1)

          if (encodedLen < 7) {
            // Short reference: LLLooooo oooooooo
            // LLL = encoded length (1-6 represents real length 3-8)
            // ooooooooooooo = 13-bit offset
            output.push(OpCodes.OrN(OpCodes.Shl8(encodedLen, 5), OpCodes.Shr16(off, 8)));
            output.push(OpCodes.AndN(off, 0xFF));
          } else {
            // Long reference: 111ooooo LLLLLLLL oooooooo
            // 111 = marker for long reference
            // ooooo = high 5 bits of offset
            // LLLLLLLL = len - 9 (extended length: real length >= 9)
            // oooooooo = low 8 bits of offset
            output.push(OpCodes.OrN(0xE0, OpCodes.Shr16(off, 8)));
            output.push(OpCodes.AndN(encodedLen - 7, 0xFF));
            output.push(OpCodes.AndN(off, 0xFF));
          }

          ip += len; // Skip matched bytes
          lit = ip;

          // Reset hash for next position
          if (ip < iend - 2) {
            hval = OpCodes.OrN(OpCodes.Shl16(input[ip], 8), input[ip + 1]);
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

      this.inputBuffer = [];
      return output;
    }

    _flushLiterals(output, input, start, end) {
      let len = end - start;

      while (len > 0) {
        const chunk = Math.min(len, this.maxLit);

        // Encode literal: 000LLLLL where LLLLL = chunk - 1
        output.push(chunk - 1);

        // Copy literal bytes
        for (let i = 0; i < chunk; ++i) {
          output.push(input[start + i]);
        }

        start += chunk;
        len -= chunk;
      }
    }

    _decompress() {
      const input = this.inputBuffer;
      const output = [];
      let ip = 0;
      const iend = input.length;

      while (ip < iend) {
        const ctrl = input[ip++];

        if (ctrl < 32) {
          // Literal run: 000LLLLL <L+1 bytes>
          const len = ctrl + 1;

          if (ip + len > iend) {
            throw new Error("LZFX decompression error: insufficient input data for literal run");
          }

          for (let i = 0; i < len; ++i) {
            output.push(input[ip++]);
          }
        } else {
          // Back reference
          let len = OpCodes.Shr8(ctrl, 5);
          let off;

          if (len === 7) {
            // Long reference: 111ooooo LLLLLLLL oooooooo
            if (ip + 2 > iend) {
              throw new Error("LZFX decompression error: insufficient input data for long reference");
            }

            len = input[ip++] + 7;
            off = OpCodes.OrN(OpCodes.Shl16(OpCodes.AndN(ctrl, 0x1F), 8), input[ip++]);
          } else {
            // Short reference: LLLooooo oooooooo
            if (ip + 1 > iend) {
              throw new Error("LZFX decompression error: insufficient input data for short reference");
            }

            off = OpCodes.OrN(OpCodes.Shl16(OpCodes.AndN(ctrl, 0x1F), 8), input[ip++]);
          }

          len += 2; // Decode: add back the 2 we subtracted during encoding
          off += 1; // Offset stored as distance - 1

          // Validate reference
          if (off > output.length) {
            throw new Error(`LZFX decompression error: invalid offset ${off} at output position ${output.length}`);
          }

          // Copy referenced bytes
          const ref = output.length - off;
          for (let i = 0; i < len; ++i) {
            output.push(output[ref + i]);
          }
        }
      }

      this.inputBuffer = [];
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
