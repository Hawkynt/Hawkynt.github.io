/*
 * LZJB Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZJB is a lossless compression algorithm designed by Jeff Bonwick for ZFS filesystem.
 * It's a simple and fast LZ77 variant optimized for speed over compression ratio.
 * Used extensively in Solaris, FreeBSD, illumos, and other ZFS implementations.
 *
 * Algorithm characteristics:
 * - Fixed 1024-byte sliding window
 * - 3-byte minimum match length
 * - Simple encoding without entropy coding
 * - Control byte with 8 operation flags
 * - Optimized for speed and simplicity
 *
 * Reference implementations:
 * - https://github.com/nemequ/lzjb (Portable C implementation)
 * - https://github.com/illumos/illumos-gate (Original Solaris source)
 * - FreeBSD ZFS: sys/cddl/contrib/opensolaris/uts/common/fs/zfs/lzjb.c
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

  // ===== LZJB ALGORITHM IMPLEMENTATION =====

  class LZJBCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LZJB";
      this.description = "Fast lossless compression algorithm designed for ZFS filesystem. Simple LZ77 variant with fixed 1024-byte sliding window and 3-byte minimum match. Optimized for speed over compression ratio.";
      this.inventor = "Jeff Bonwick";
      this.year = 2005;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // LZJB constants (from reference implementation)
      /** @type {int32} */
      this.MATCH_BITS = 6;           // Bits for match length encoding
      /** @type {int32} */
      this.MATCH_MIN = 3;            // Minimum match length
      /** @type {int32} */
      this.MATCH_MAX = OpCodes.Shl16(1, this.MATCH_BITS) + (this.MATCH_MIN - 1); // 67 bytes
      /** @type {int32} */
      this.OFFSET_MASK = OpCodes.Shl16(1, 16 - this.MATCH_BITS) - 1; // 1023 (10 bits)
      /** @type {int32} */
      this.LEMPEL_SIZE = 1024;       // Hash table size

      // Documentation and references
      this.documentation = [
        new LinkItem("ZFS Documentation", "https://docs.oracle.com/cd/E19253-01/819-5461/gbchx/index.html"),
        new LinkItem("LZJB Wikipedia", "https://en.wikipedia.org/wiki/LZJB"),
        new LinkItem("ZFS Compression Overview", "https://www.brendangregg.com/blog/2008-11-19/zfs-compression.html")
      ];

      this.references = [
        new LinkItem("FreeBSD LZJB Implementation", "https://people.freebsd.org/~gibbs/zfs_doxygenation/html/df/d48/lzjb_8c.html"),
        new LinkItem("Portable LZJB (nemequ)", "https://github.com/nemequ/lzjb"),
        new LinkItem("illumos-gate Repository", "https://github.com/illumos/illumos-gate")
      ];

      // Test vectors cross-checked byte-for-byte against CompressionWorkbench's
      // BB_Lzjb building block (Compression.Core.Dictionary.Lzjb), which is the
      // authoritative wire format: a 4-byte little-endian original-length
      // header, then the copymap-byte-prefixed stream (8 flags per copymap).
      this.tests = [
        {
          text: "All literals - no compression (ABCD)",
          uri: "https://github.com/nemequ/lzjb/blob/master/lzjb.c",
          input: OpCodes.AnsiToBytes("ABCD"),
          // header(4) + copymap 0x00 (all 8 operations are literals) + A B C D
          expected: [4, 0, 0, 0, 0x00, 0x41, 0x42, 0x43, 0x44]
        },
        {
          text: "Simple repetition - AAAA (4 A's)",
          uri: "https://github.com/nemequ/lzjb/blob/master/lzjb.c",
          input: OpCodes.AnsiToBytes("AAAA"),
          // header(4) + copymap 0x02 (op0=literal 'A', op1=match) +
          // literal A (0x41) + match code offset=1,length=3-3=0 -> 0x0040 (LE: 0x40,0x00)
          expected: [4, 0, 0, 0, 0x02, 0x41, 0x40, 0x00]
        },
        {
          text: "Pattern ABCABC (6 bytes with match)",
          uri: "https://github.com/nemequ/lzjb/blob/master/lzjb.c",
          input: OpCodes.AnsiToBytes("ABCABC"),
          // header(6) + copymap 0x08 (ops0-2=literals ABC, op3=match) +
          // literals A B C + match code offset=3,length=3-3=0 -> 0x00C0 (LE: 0xC0,0x00)
          expected: [6, 0, 0, 0, 0x08, 0x41, 0x42, 0x43, 0xC0, 0x00]
        },
        {
          text: "Long repetition - AAAAAAAA (8 A's)",
          uri: "https://github.com/nemequ/lzjb/blob/master/lzjb.c",
          input: OpCodes.AnsiToBytes("AAAAAAAA"),
          // header(8) + copymap 0x02 (op0=literal 'A', op1=match of 7 more) +
          // literal A + match code offset=1,length=7-3=4 -> 0x0044 (LE: 0x44,0x00)
          expected: [8, 0, 0, 0, 0x02, 0x41, 0x44, 0x00]
        },
        {
          text: "Mixed pattern - Hello",
          uri: "https://github.com/nemequ/lzjb/blob/master/lzjb.c",
          input: OpCodes.AnsiToBytes("Hello"),
          // header(5) + copymap 0x00 (no 3-byte matches exist in "Hello", all literals)
          expected: [5, 0, 0, 0, 0x00, 0x48, 0x65, 0x6C, 0x6C, 0x6F]
        },
        {
          text: "Repetitive data showing compression (ABABABABAB)",
          uri: "https://github.com/nemequ/lzjb/blob/master/lzjb.c",
          input: OpCodes.AnsiToBytes("ABABABABAB"),
          // header(10) + copymap 0x04 (ops0-1=literals AB, op2=match of 8 bytes) +
          // literals A B + match code offset=2,length=8-3=5 -> 0x0085 (LE: 0x85,0x00)
          expected: [10, 0, 0, 0, 0x04, 0x41, 0x42, 0x85, 0x00]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {LZJBInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LZJBInstance(this, isInverse);
    }
  }

  // ===== LZJB INSTANCE IMPLEMENTATION =====

  /**
 * LZJB cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class LZJBInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {LZJBCompression} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];

      // LZJB parameters from algorithm
      /** @type {int32} */
      this.MATCH_BITS = algorithm.MATCH_BITS;
      /** @type {int32} */
      this.MATCH_MIN = algorithm.MATCH_MIN;
      /** @type {int32} */
      this.MATCH_MAX = algorithm.MATCH_MAX;
      /** @type {int32} */
      this.OFFSET_MASK = algorithm.OFFSET_MASK;
      /** @type {int32} */
      this.LEMPEL_SIZE = algorithm.LEMPEL_SIZE;
    }


    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      /** @type {uint8[]} */
      const fresh = [];
      if (this.isInverse) {
        if (this.inputBuffer.length === 0) {
          return fresh;
        }
        /** @type {uint8[]} */
        const decoded = this._decompress();
        this.inputBuffer = fresh;
        return decoded;
      }

      // Compression always emits the 4-byte length header, even for empty
      // input (matching the CompressionWorkbench reference building block).
      /** @type {uint8[]} */
      const result = this._compress();
      this.inputBuffer = fresh;
      return result;
    }

    // ===== COMPRESSION =====

    /**
     * @returns {uint8[]} 4-byte LE length, then copymap-grouped literals and matches
     */
    _compress() {
      /** @type {uint8[]} */
      const src = this.inputBuffer;
      /** @type {int32} */
      const slen = src.length;
      /** @type {uint8[]} */
      const header = OpCodes.Unpack32LE(slen);

      if (slen === 0) {
        return header;
      }

      /** @type {uint8[]} */
      const dst = [];
      /** @type {int32} */
      let src_pos = 0;
      /** @type {uint32} */
      let copymap = 0;
      /** @type {uint8} */
      let copymask = 1; // Start with bit 0
      /** @type {int32} */
      let mlen = 0;
      /** @type {int32} */
      let offset = 0;
      /** @type {uint32} */
      let hash = 0;
      /** @type {int32[]} */
      const lempel = new Int32Array(this.LEMPEL_SIZE);
      lempel.fill(-1);

      // Reserve space for first copymap
      /** @type {int32} */
      let copymap_pos = 0;
      dst.push(0);

      while (src_pos < slen) {
        // Reset copymap byte every 8 operations
        if (copymask === OpCodes.Shl8(1, 8)) {
          // Write previous copymap
          dst[copymap_pos] = OpCodes.ToByte(copymap);
          copymap = 0;
          copymask = 1;
          // Reserve space for next copymap
          copymap_pos = dst.length;
          dst.push(0);
        }

        // Try to find a match
        if (src_pos + this.MATCH_MIN <= slen) {
          // Calculate hash from 3 bytes
          hash = this._hash(src, src_pos);
          offset = src_pos - lempel[hash];
          lempel[hash] = src_pos;

          // Check if offset is valid and within window
          if (offset > 0 && offset <= this.OFFSET_MASK && src_pos - offset >= 0) {
            // Count match length
            mlen = this._findMatchLength(src, src_pos - offset, src_pos, slen);

            // If match is long enough, encode it
            if (mlen >= this.MATCH_MIN) {
              // Set bit in copymap to indicate this is a copy operation
              copymap = OpCodes.Or32(copymap, copymask);

              // Encode: high 10 bits = offset, low 6 bits = (mlen - MATCH_MIN)
              /** @type {uint16} */
              const match_code = OpCodes.Or16(OpCodes.Shl16(offset, this.MATCH_BITS), OpCodes.ToWord(mlen - this.MATCH_MIN));
              dst.push(OpCodes.ToByte(match_code)); // Low byte
              dst.push(OpCodes.ToByte(OpCodes.Shr16(match_code, 8))); // High byte

              // Update position
              src_pos += mlen;

              // Shift copymask for next operation
              copymask = OpCodes.Shl8(copymask, 1);
              continue;
            }
          }
        }

        // No match found or match too short - emit literal
        // Update hash table even for literals
        if (src_pos + this.MATCH_MIN <= slen) {
          hash = this._hash(src, src_pos);
          lempel[hash] = src_pos;
        }

        dst.push(OpCodes.ToByte(src[src_pos]));
        ++src_pos;

        // Shift copymask for next operation
        copymask = OpCodes.Shl8(copymask, 1);
      }

      // Write final copymap
      dst[copymap_pos] = OpCodes.ToByte(copymap);

      return header.concat(dst);
    }

    /**
     * Hash function for 3-byte sequences
     * Same as reference implementation: data[0] * 2^16 + data[1] * 2^8 + data[2]
     * @param {uint8[]} data - Bytes
     * @param {int32} pos - Position of the three bytes
     * @returns {uint32} Table index
     */
    _hash(data, pos) {
      if (pos + 3 > data.length) {
        return 0;
      }

      /** @type {uint32} */
      const val = OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(OpCodes.ToByte(data[pos]), 16), OpCodes.Shl32(OpCodes.ToByte(data[pos+1]), 8)), OpCodes.ToByte(data[pos+2]));
      return OpCodes.And32(OpCodes.Xor32(val, OpCodes.Shr32(val, 9)), this.LEMPEL_SIZE - 1);
    }

    /**
     * @param {uint8[]} data - Bytes
     * @param {int32} matchPos - Match source
     * @param {int32} currentPos - Current position
     * @param {int32} maxPos - End of the data
     * @returns {int32} Number of equal bytes, at most MATCH_MAX
     */
    _findMatchLength(data, matchPos, currentPos, maxPos) {
      /** @type {int32} */
      let len = 0;
      /** @type {int32} */
      const maxLen = Math.min(this.MATCH_MAX, maxPos - currentPos);

      // Count matching bytes
      while (len < maxLen && data[matchPos + len] === data[currentPos + len]) {
        ++len;
      }

      return len;
    }

    // ===== DECOMPRESSION =====

    /**
     * @returns {uint8[]} Decoded bytes
     */
    _decompress() {
      /** @type {uint8[]} */
      const src = this.inputBuffer;
      /** @type {uint8[]} */
      const dst = [];
      if (src.length < 4) {
        return dst;
      }

      /** @type {uint32} */
      const originalLength = OpCodes.Pack32LE(src[0], src[1], src[2], src[3]);
      if (originalLength === 0) {
        return dst;
      }

      /** @type {int32} */
      const slen = src.length;
      /** @type {int32} */
      let src_pos = 4;
      /** @type {uint8} */
      let copymap = 0;
      /** @type {uint8} */
      let copymask = OpCodes.Shl8(1, 8); // Start with overflow value to trigger read

      while (dst.length < originalLength) {
        // Read new copymap every 8 operations
        if (copymask === OpCodes.Shl8(1, 8)) {
          if (src_pos >= slen) {
            break;
          }
          copymap = OpCodes.ToByte(src[src_pos++]);
          copymask = 1;
        }

        // Check if this is a copy operation or literal
        if (OpCodes.And32(copymap, copymask) !== 0) {
          // Copy operation - read match code (2 bytes)
          if (src_pos + 2 > slen) {
            break;
          }

          /** @type {uint16} */
          const match_code = OpCodes.Or16(OpCodes.ToByte(src[src_pos]), OpCodes.Shl16(OpCodes.ToByte(src[src_pos+1]), 8));
          src_pos += 2;

          // Decode offset and length
          /** @type {int32} */
          const mlen = OpCodes.And16(match_code, OpCodes.BitMask(this.MATCH_BITS)) + this.MATCH_MIN;
          /** @type {int32} */
          const offset = OpCodes.Shr16(match_code, this.MATCH_BITS);

          // Validate offset
          if (offset === 0 || offset > dst.length) {
            throw new Error("Invalid offset in compressed data");
          }

          // Copy from history
          /** @type {int32} */
          const match_pos = dst.length - offset;
          for (let i = 0; i < mlen; ++i) {
            dst.push(OpCodes.ToByte(dst[match_pos + i]));
          }

        } else {
          // Literal byte
          if (src_pos >= slen) {
            break;
          }
          dst.push(OpCodes.ToByte(src[src_pos++]));
        }

        // Shift copymask for next operation
        copymask = OpCodes.Shl8(copymask, 1);
      }

      return dst;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZJBCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name))
    RegisterAlgorithm(algorithmInstance);

  // ===== EXPORTS =====

  return { LZJBCompression, LZJBInstance };
}));
