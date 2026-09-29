/*
 * LZAV Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZAV - Fast general-purpose in-memory LZ77 data compression
 * Based on specification from https://github.com/avaneev/lzav
 * Educational implementation focusing on core algorithm concepts
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, LinkItem } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class LZAVCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "LZAV";
      this.description = "Fast general-purpose in-memory LZ77 compression algorithm. Achieves 480-600 MB/s compression and 2800-3800 MB/s decompression with better ratios than LZ4. Educational implementation of the hash-table-based approach.";
      this.inventor = "Aleksey Vaneev";
      this.year = 2023;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based (LZ77)";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU; // Russia

      this.documentation = [
        new LinkItem("LZAV GitHub Repository", "https://github.com/avaneev/lzav"),
        new LinkItem("LZAV Performance Benchmarks", "https://github.com/avaneev/lzav#benchmark"),
        new LinkItem("LZ77 Algorithm", "https://en.wikipedia.org/wiki/LZ77_and_LZ78")
      ];

      this.references = [
        new LinkItem("LZAV Source Code", "https://github.com/avaneev/lzav/blob/main/lzav.h"),
        new LinkItem("Compression Benchmark", "https://github.com/inikep/lzbench")
      ];

      // Test vectors - cross-checked byte-for-byte against CompressionWorkbench's
      // LzavBuildingBlock (BB_Lzav), a clean-room implementation of LZAV's real
      // "data format 3" block layout (see lzav_write_blk_3/lzav_decompress_3 in
      // https://github.com/avaneev/lzav/blob/main/lzav.h): a 4-byte little-endian
      // original-length header, then (for non-empty input) a 1-byte format/mref
      // prefix (0x36 = format 3, mref 6) followed by OOTTLLLL-headed blocks with
      // 10/15/21-bit tiered offsets and base-128 length continuation.
      this.tests = [
        {
          text: "Empty input",
          uri: "https://github.com/avaneev/lzav/blob/main/lzav.h",
          input: [],
          expected: [0x00, 0x00, 0x00, 0x00]
        },
        {
          text: "Single byte 0x41",
          uri: "https://github.com/avaneev/lzav/blob/main/lzav.h",
          input: [0x41],
          expected: [0x01, 0x00, 0x00, 0x00, 0x36, 0x01, 0x41]
        },
        {
          text: "Simple repetition - AAAA (too short for mref=6 match)",
          uri: "https://github.com/avaneev/lzav/blob/main/lzav.h",
          input: OpCodes.AnsiToBytes("AAAA")
          // Round-trip only
        },
        {
          text: "Pattern repetition - ABCABC (too short for mref=6 match)",
          uri: "https://github.com/avaneev/lzav/blob/main/lzav.h",
          input: OpCodes.AnsiToBytes("ABCABC")
          // Round-trip only
        },
        {
          text: "Real text - Hello World! (no match, too short)",
          uri: "https://github.com/avaneev/lzav/blob/main/lzav.h",
          input: OpCodes.AnsiToBytes("Hello World!")
          // Round-trip only
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LZAVInstance(this, isInverse);
    }
  }

  /**
   * Match found by the hash-chain search
   */
  class LzavMatch {
    /**
     * @param {int32} length - Match length (0 when none)
     * @param {int32} offset - Distance back to the match source
     */
    constructor(length, offset) {
      /** @type {int32} */
      this.length = length;
      /** @type {int32} */
      this.offset = offset;
    }
  }

  // LZAV instance - educational implementation
  /**
 * LZAV cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LZAVInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {LZAVCompression} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];

      // LZAV data-format-3 parameters (see CompressionWorkbench's LzavBuildingBlock,
      // the authoritative reference for this container/payload).
      /** @type {int32} */
      this.FORMAT_ID = 3;
      /** @type {int32} */
      this.MREF = 6;             // Minimum reference (match) length
      /** @type {int32} */
      this.OFS_MIN = 8;          // Smallest permitted reference offset
      /** @type {int32} */
      this.OFS_TH1 = OpCodes.Shl32(1, 10) - 1;  // Largest offset for the 1-offset-byte tier
      /** @type {int32} */
      this.OFS_TH2 = OpCodes.Shl32(1, 15) - 1;  // Largest offset for the 2-offset-byte tier
      /** @type {int32} */
      this.OFS_TH3 = OpCodes.Shl32(1, 21) - 1;  // Largest offset for the 3-offset-byte tier (window cap)
      /** @type {int32} */
      this.HASH_BITS = 16;
      /** @type {int32} */
      this.HASH_SIZE = OpCodes.Shl32(1, this.HASH_BITS);
      /** @type {int32} */
      this.MAX_CHAIN_STEPS = 64;

      // Read position in the payload while decompressing
      /** @type {int32} */
      this.readPos = 0;
    }


    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // The only failure is a corrupt back-reference while decompressing;
      // _decompress clears the buffer and raises it as
      // "LZAV decompression failed: ...".
      /** @type {uint8[]} */
      let result;
      if (this.isInverse) {
        result = this._decompress(this.inputBuffer);
      } else {
        result = this._compress(this.inputBuffer);
      }
      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;
      return result;
    }

    // ===== COMPRESSION (LZAV data format 3) =====

    /**
     * @param {uint8[]} input - Input bytes
     * @returns {uint8[]} Size header, prefix byte and block stream
     */
    _compress(input) {
      // Container: 4-byte little-endian original length, then (if non-empty)
      // the format/mref prefix byte and the block stream.
      /** @type {uint8[]} */
      const header = OpCodes.Unpack32LE(input.length);
      if (input.length === 0) {
        return header;
      }

      /** @type {uint8[]} */
      const output = [];
      output.push(OpCodes.ToByte(OpCodes.Or8(OpCodes.Shl8(this.FORMAT_ID, 4), this.MREF)));

      /** @type {uint8[]} */
      const src = input;
      /** @type {int32[]} */
      const hashHead = new Int32Array(this.HASH_SIZE).fill(-1);
      /** @type {int32[]} */
      const chain = new Int32Array(src.length);

      /** @type {int32} */
      let pos = 0;
      /** @type {int32} */
      let litStart = 0;

      while (pos < src.length) {
        /** @type {LzavMatch} */
        const match = this._findMatch(src, pos, hashHead, chain);

        if (pos + 3 <= src.length) {
          this._insertHash(src, pos, hashHead, chain);
        }

        if (match.length >= this.MREF) {
          if (pos > litStart) {
            this._emitLiteralBlock(output, src, litStart, pos - litStart);
          }

          this._emitReferenceBlock(output, match.length, match.offset);

          /** @type {int32} */
          const end = Math.min(pos + match.length, src.length - 2);
          for (let i = pos + 1; i < end; ++i) {
            this._insertHash(src, i, hashHead, chain);
          }

          pos += match.length;
          litStart = pos;
        } else {
          ++pos;
        }
      }

      if (litStart < src.length) {
        this._emitLiteralBlock(output, src, litStart, src.length - litStart);
      }

      for (let i = 0; i < output.length; ++i) {
        header.push(output[i]);
      }
      return header;
    }

    /**
     * @param {uint8[]} src - Input bytes
     * @param {int32} pos - Position to match
     * @param {int32[]} hashHead - Chain heads
     * @param {int32[]} chain - Chain links
     * @returns {LzavMatch} Longest match (length 0 when none)
     */
    _findMatch(src, pos, hashHead, chain) {
      if (pos + this.MREF > src.length) {
        return new LzavMatch(0, 0);
      }

      /** @type {uint32} */
      const h = this._hash3(src, pos);
      /** @type {int32} */
      let candidate = hashHead[h];
      /** @type {int32} */
      const minPos = Math.max(0, pos - this.OFS_TH3);
      /** @type {int32} */
      const maxLen = src.length - pos;
      /** @type {int32} */
      let bestLen = 0;
      /** @type {int32} */
      let bestOff = 0;
      /** @type {int32} */
      let steps = this.MAX_CHAIN_STEPS;

      while (candidate >= minPos && steps-- > 0) {
        /** @type {int32} */
        const offset = pos - candidate;
        if (offset >= this.OFS_MIN && (bestLen === 0 || src[candidate + bestLen] === src[pos + bestLen])) {
          /** @type {int32} */
          let len = 0;
          while (len < maxLen && src[candidate + len] === src[pos + len]) {
            ++len;
          }

          if (len > bestLen) {
            bestLen = len;
            bestOff = offset;
            if (bestLen >= maxLen) {
              break;
            }
          }
        }

        /** @type {int32} */
        const prev = chain[candidate];
        if (prev >= candidate) {
          break;
        }
        candidate = prev;
      }

      if (bestLen >= this.MREF) {
        return new LzavMatch(bestLen, bestOff);
      }
      return new LzavMatch(0, 0);
    }

    /**
     * @param {uint8[]} src - Input bytes
     * @param {int32} pos - Position to insert
     * @param {int32[]} hashHead - Chain heads
     * @param {int32[]} chain - Chain links
     */
    _insertHash(src, pos, hashHead, chain) {
      /** @type {uint32} */
      const h = this._hash3(src, pos);
      chain[pos] = hashHead[h];
      hashHead[h] = pos;
    }

    /**
     * @param {uint8[]} data - Bytes
     * @param {int32} pos - Position of the three hashed bytes
     * @returns {uint32} Bucket
     */
    _hash3(data, pos) {
      /** @type {uint32} */
      const val = OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(data[pos], 16), OpCodes.Shl32(data[pos + 1], 8)), data[pos + 2]);
      return OpCodes.Shr32(OpCodes.Mul32(val, 2654435761), 32 - this.HASH_BITS);
    }

    /**
     * @param {uint8[]} output - Block stream
     * @param {uint8[]} src - Input bytes
     * @param {int32} start - First literal
     * @param {int32} length - Number of literals
     */
    _emitLiteralBlock(output, src, start, length) {
      /** @type {int32} */
      const nibble = length <= 15 ? length : 0;
      output.push(OpCodes.ToByte(nibble));
      this._writeLengthContinuation(output, length);
      for (let i = 0; i < length; ++i) {
        output.push(OpCodes.ToByte(src[start + i]));
      }
    }

    /**
     * @param {uint8[]} output - Block stream
     * @param {int32} length - Match length
     * @param {int32} offset - Match distance
     */
    _emitReferenceBlock(output, length, offset) {
      /** @type {int32} */
      let type = 3;
      if (offset <= this.OFS_TH1) {
        type = 1;
      } else if (offset <= this.OFS_TH2) {
        type = 2;
      }
      /** @type {uint32} */
      const oo = OpCodes.And32(offset, 3);
      /** @type {int32} */
      const field = length - this.MREF + 1;
      /** @type {int32} */
      const nibble = field <= 15 ? field : 0;

      output.push(OpCodes.ToByte(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(oo, 6), OpCodes.Shl32(type, 4)), nibble)));

      /** @type {uint32} */
      let bytesVal = OpCodes.Shr32(offset, 2);
      for (let k = 0; k < type; ++k) {
        output.push(OpCodes.ToByte(bytesVal));
        bytesVal = OpCodes.Shr32(bytesVal, 8);
      }

      this._writeLengthContinuation(output, field);
    }

    // Base-128 continuation chain for a length field that overflowed the header's
    // 4-bit nibble (field > 15): low-7-bits-first, high bit set means "more follows".
    /**
     * @param {uint8[]} output - Block stream
     * @param {int32} field - Length field
     */
    _writeLengthContinuation(output, field) {
      if (field <= 15) {
        return;
      }

      /** @type {uint32} */
      let remaining = field - 16;
      while (remaining > 127) {
        output.push(OpCodes.ToByte(OpCodes.Or32(0x80, OpCodes.And32(remaining, 0x7F))));
        remaining = OpCodes.Shr32(remaining, 7);
      }
      output.push(OpCodes.ToByte(remaining));
    }

    // ===== DECOMPRESSION (LZAV data format 3) =====

    /**
     * @param {uint8[]} input - Size header, prefix byte and block stream
     * @returns {uint8[]} Decoded bytes
     */
    _decompress(input) {
      /** @type {uint8[]} */
      const dst = [];
      if (input.length < 4) {
        return dst;
      }

      /** @type {uint32} */
      const originalSize = OpCodes.Pack32LE(
        OpCodes.ToByte(input[0]), OpCodes.ToByte(input[1]),
        OpCodes.ToByte(input[2]), OpCodes.ToByte(input[3])
      );
      if (originalSize === 0) {
        return dst;
      }

      /** @type {uint8[]} */
      const payload = input.slice(4);
      /** @type {uint8} */
      const prefix = OpCodes.ToByte(payload[0]);
      /** @type {uint8} */
      const mref = OpCodes.And8(prefix, 0x0F);

      /** @type {float64} */
      let pos = 0;
      this.readPos = 1;

      while (pos < originalSize) {
        /** @type {uint8} */
        const b = OpCodes.ToByte(payload[this.readPos++]);
        /** @type {uint8} */
        const type = OpCodes.And8(OpCodes.Shr8(b, 4), 3);
        /** @type {uint8} */
        const nibble = OpCodes.And8(b, 0x0F);

        if (type === 0) {
          /** @type {float64} */
          const length = this._readLengthField(payload, nibble);
          for (let k = 0; k < length; ++k) {
            dst.push(OpCodes.ToByte(payload[this.readPos + k]));
          }
          this.readPos += length;
          pos += length;
        } else {
          /** @type {uint8} */
          const oo = OpCodes.And8(OpCodes.Shr8(b, 6), 3);
          /** @type {uint32} */
          let bytesVal = 0;
          for (let k = 0; k < type; ++k) {
            bytesVal = OpCodes.Or32(bytesVal, OpCodes.Shl32(OpCodes.ToByte(payload[this.readPos++]), 8 * k));
          }
          /** @type {uint32} */
          const offset = OpCodes.Or32(OpCodes.Shl32(bytesVal, 2), oo);

          /** @type {float64} */
          const field = this._readLengthField(payload, nibble);
          /** @type {float64} */
          const length = field + mref - 1;

          if (offset <= 0 || offset > pos) {
            /** @type {uint8[]} */
            const cleared = [];
            this.inputBuffer = cleared;
            throw new Error("LZAV decompression failed: LZAV: match offset " + offset + " invalid at position " + pos + ".");
          }

          for (let k = 0; k < length && pos < originalSize; ++k) {
            dst.push(dst[pos - offset]);
            ++pos;
          }
        }
      }

      return dst;
    }

    /**
     * Length of a block: the header nibble, or (nibble 0) 16 plus a base-128
     * continuation chain read from readPos
     * @param {uint8[]} payload - Block stream
     * @param {uint8} nibble - Header nibble
     * @returns {float64} Length
     */
    _readLengthField(payload, nibble) {
      if (nibble !== 0) {
        return nibble;
      }

      /** @type {uint32} */
      let value = 0;
      /** @type {int32} */
      let shift = 0;
      for (;;) {
        /** @type {uint8} */
        const b = OpCodes.ToByte(payload[this.readPos++]);
        value = OpCodes.Or32(value, OpCodes.Shl32(OpCodes.And8(b, 0x7F), shift));
        if (OpCodes.And8(b, 0x80) === 0) {
          break;
        }
        shift += 7;
      }
      /** @type {float64} */
      const wide = value;
      return 16 + wide;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZAVCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { LZAVCompression, LZAVInstance };
}));
