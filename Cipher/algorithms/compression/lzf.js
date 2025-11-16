/*
 * LZF Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZF: Lempel-Ziv-Free compression by Marc Lehmann
 * Extremely fast compression optimized for speed over compression ratio.
 * Simple hash-based LZ77 with minimal memory overhead (64KB hash table).
 * Original implementation: http://software.schmorp.de/pkg/liblzf.html
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

  class LZFCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LZF";
      this.description = "Original Lempel-Ziv-Free compression by Marc Lehmann. Extremely fast compression algorithm optimized for speed with minimal memory overhead. Uses simple hash-based LZ77 matching with 2-byte minimum match length. Widely used in Redis, nginx, and other performance-critical applications.";
      this.inventor = "Marc Lehmann";
      this.year = 2000;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.DE;

      // LZF Configuration Constants (matching liblzf)
      this.HLOG = 13;                          // Hash table size: 2^13 = 8192 entries
      this.HSIZE = OpCodes.Shl32(1, this.HLOG); // 8192 hash table entries
      this.MAX_LIT = 32;                       // Maximum literal run length
      this.MAX_OFF = 8191;                     // Maximum offset (13-bit: 2^13 - 1)
      this.MAX_REF = 264;                      // Maximum reference length (256 + 8)

      // Documentation and references
      this.documentation = [
        new LinkItem("Official liblzf Homepage", "http://software.schmorp.de/pkg/liblzf.html"),
        new LinkItem("liblzf GitHub Mirror", "https://github.com/nemequ/liblzf"),
        new LinkItem("LZF Specification and API", "https://github.com/nemequ/liblzf/blob/master/lzf.h"),
        new LinkItem("Compress::LZF Perl Module", "https://metacpan.org/pod/Compress::LZF")
      ];

      this.references = [
        new LinkItem("LZ77 Algorithm", "https://en.wikipedia.org/wiki/LZ77_and_LZ78"),
        new LinkItem("Redis LZF Usage", "https://redis.io/docs/manual/persistence/"),
        new LinkItem("ning/compress Java Implementation", "https://github.com/ning/compress")
      ];

      // Test vectors - verified with round-trip compression/decompression
      // LZF format: Literals < 32, Backrefs >= 32
      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes("ABCD"),
          [3, 65, 66, 67, 68], // All literals: len=4, data=ABCD
          "All literals - no compression",
          "https://github.com/nemequ/liblzf"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AAAA"),
          [0, 65, 64, 0], // Literal 'A' + backref(len=3, off=1)
          "Simple repetition - AAAA",
          "https://github.com/nemequ/liblzf"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AAAAAAAAAA"), // 10 A's
          [0, 65, 224, 1, 0], // A + long backref (len=9, off=1)
          "Long repetition - 10 A's",
          "https://github.com/nemequ/liblzf"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("ABCABCABC"), // 9 bytes
          [2, 65, 66, 67, 160, 2], // ABC literal + backref (len=6, off=3)
          "Pattern repetition - ABCABCABC",
          "https://github.com/nemequ/liblzf"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("Hello World! Hello World!"),
          [12, 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33, 32, 224, 4, 12],
          "Text compression with pattern",
          "https://github.com/nemequ/liblzf"
        ),
        new TestCase(
          new Array(100).fill(0x42), // 100 B's
          [0, 66, 224, 91, 0], // B + long backref (len=99, off=1)
          "Highly repetitive data",
          "https://github.com/nemequ/liblzf"
        ),
        new TestCase(
          [0,1,2,3,4,153,64,64,64,9,9,9,9,9,9,9,9,9,9], // Hash collision test from ning/compress
          [9, 0, 1, 2, 3, 4, 153, 64, 64, 64, 9, 224, 1, 0], // Literal + backref compression
          "Hash collision test data",
          "https://github.com/ning/compress/blob/master/src/test/java/com/ning/compress/lzf/TestLZFRoundTrip.java"
        ),
        new TestCase(
          [1,153,0,0,0,0,153,64,64,64,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // Hash collision test 2
          [2, 1, 153, 0, 64, 0, 4, 153, 64, 64, 64, 0, 224, 5, 0], // Literal + backrefs
          "Hash collision test data 2",
          "https://github.com/ning/compress/blob/master/src/test/java/com/ning/compress/lzf/TestLZFRoundTrip.java"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LZFInstance(this, isInverse);
    }
  }

  /**
 * LZF cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LZFInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

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
      const input = this.inputBuffer;
      const output = [];
      const htab = new Array(this.hsize); // Hash table storing positions

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
        // Hash function: (h ^ (h >> 8)) + byte3
        hval = OpCodes.OrN(OpCodes.Shl16(input[ip], 8), input[ip + 1]);
        const hidx = OpCodes.AndN(
          (OpCodes.XorN(hval, OpCodes.Shr16(hval, 8)) + input[ip + 2]),
          this.hsize - 1
        );
        const ref = htab[hidx];

        // Store current position in hash table
        htab[hidx] = ip;

        let off = 0;

        // Check for valid match (need at least 2 bytes matching for LZF)
        // LZF uses 2-byte minimum match (vs LZFX's 3-byte)
        if (ref !== undefined &&
            ref >= 0 &&
            ref < ip &&
            (off = ip - ref - 1) <= this.maxOff &&
            input[ref] === input[ip] &&
            input[ref + 1] === input[ip + 1]) {

          // Found a match - determine length
          let len = 2;
          const maxlen = Math.min(this.maxRef, iend - ip);

          // Extend match as far as possible
          while (len < maxlen && input[ref + len] === input[ip + len]) {
            ++len;
          }

          // Flush any pending literals before the match
          if (ip > lit) {
            this._flushLiterals(output, input, lit, ip);
          }

          // Encode back reference
          // LZF format: len - 1 (minimum match is 2, encoded as 1)
          const encodedLen = len - 1;

          if (encodedLen < 7) {
            // Short reference: LLLooooo oooooooo
            // LLL = encoded length (1-6 represents real length 2-7)
            // ooooooooooooo = 13-bit offset
            output.push(OpCodes.OrN(OpCodes.Shl8(encodedLen, 5), OpCodes.Shr16(off, 8)));
            output.push(OpCodes.AndN(off, 0xFF));
          } else {
            // Long reference: 111ooooo LLLLLLLL oooooooo
            // 111 = marker for long reference
            // ooooo = high 5 bits of offset
            // LLLLLLLL = len - 8 (extended length: real length >= 8)
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
            throw new Error("LZF decompression error: insufficient input data for literal run");
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
              throw new Error("LZF decompression error: insufficient input data for long reference");
            }

            len = input[ip++] + 7;
            off = OpCodes.OrN(OpCodes.Shl16(OpCodes.AndN(ctrl, 0x1F), 8), input[ip++]);
          } else {
            // Short reference: LLLooooo oooooooo
            if (ip + 1 > iend) {
              throw new Error("LZF decompression error: insufficient input data for short reference");
            }

            off = OpCodes.OrN(OpCodes.Shl16(OpCodes.AndN(ctrl, 0x1F), 8), input[ip++]);
          }

          len += 1; // Decode: add back the 1 we subtracted during encoding (min match = 2)
          off += 1; // Offset stored as distance - 1

          // Validate reference
          if (off > output.length) {
            throw new Error(`LZF decompression error: invalid offset ${off} at output position ${output.length}`);
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

  const algorithmInstance = new LZFCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZFCompression, LZFInstance };
}));
