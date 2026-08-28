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

  // LZAV instance - educational implementation
  /**
 * LZAV cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LZAVInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];

      // LZAV data-format-3 parameters (see CompressionWorkbench's LzavBuildingBlock,
      // the authoritative reference for this container/payload).
      this.FORMAT_ID = 3;
      this.MREF = 6;             // Minimum reference (match) length
      this.OFS_MIN = 8;          // Smallest permitted reference offset
      this.OFS_TH1 = OpCodes.Shl32(1, 10) - 1;  // Largest offset for the 1-offset-byte tier
      this.OFS_TH2 = OpCodes.Shl32(1, 15) - 1;  // Largest offset for the 2-offset-byte tier
      this.OFS_TH3 = OpCodes.Shl32(1, 21) - 1;  // Largest offset for the 3-offset-byte tier (window cap)
      this.HASH_BITS = 16;
      this.HASH_SIZE = OpCodes.Shl32(1, this.HASH_BITS);
      this.MAX_CHAIN_STEPS = 64;
    }


    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      try {
        const result = this.isInverse ? this._decompress(this.inputBuffer) : this._compress(this.inputBuffer);
        this.inputBuffer = [];
        return result;
      } catch (error) {
        this.inputBuffer = [];
        throw new Error(`LZAV ${this.isInverse ? 'decompression' : 'compression'} failed: ${error.message}`);
      }
    }

    // ===== COMPRESSION (LZAV data format 3) =====

    _compress(input) {
      // Container: 4-byte little-endian original length, then (if non-empty)
      // the format/mref prefix byte and the block stream.
      const header = OpCodes.Unpack32LE(input.length);
      if (input.length === 0)
        return header;

      const output = [OpCodes.ToByte(OpCodes.Or8(OpCodes.Shl8(this.FORMAT_ID, 4), this.MREF))];

      const src = input;
      const hashHead = new Int32Array(this.HASH_SIZE).fill(-1);
      const chain = new Int32Array(src.length);

      let pos = 0;
      let litStart = 0;

      while (pos < src.length) {
        const match = this._findMatch(src, pos, hashHead, chain);

        if (pos + 3 <= src.length)
          this._insertHash(src, pos, hashHead, chain);

        if (match.length >= this.MREF) {
          if (pos > litStart)
            this._emitLiteralBlock(output, src, litStart, pos - litStart);

          this._emitReferenceBlock(output, match.length, match.offset);

          const end = Math.min(pos + match.length, src.length - 2);
          for (let i = pos + 1; i < end; ++i)
            this._insertHash(src, i, hashHead, chain);

          pos += match.length;
          litStart = pos;
        } else
          ++pos;
      }

      if (litStart < src.length)
        this._emitLiteralBlock(output, src, litStart, src.length - litStart);

      return header.concat(output);
    }

    _findMatch(src, pos, hashHead, chain) {
      if (pos + this.MREF > src.length)
        return { length: 0, offset: 0 };

      const h = this._hash3(src, pos);
      let candidate = hashHead[h];
      const minPos = Math.max(0, pos - this.OFS_TH3);
      const maxLen = src.length - pos;
      let bestLen = 0;
      let bestOff = 0;
      let steps = this.MAX_CHAIN_STEPS;

      while (candidate >= minPos && steps-- > 0) {
        const offset = pos - candidate;
        if (offset >= this.OFS_MIN && (bestLen === 0 || src[candidate + bestLen] === src[pos + bestLen])) {
          let len = 0;
          while (len < maxLen && src[candidate + len] === src[pos + len])
            ++len;

          if (len > bestLen) {
            bestLen = len;
            bestOff = offset;
            if (bestLen >= maxLen)
              break;
          }
        }

        const prev = chain[candidate];
        if (prev >= candidate)
          break;
        candidate = prev;
      }

      return bestLen >= this.MREF ? { length: bestLen, offset: bestOff } : { length: 0, offset: 0 };
    }

    _insertHash(src, pos, hashHead, chain) {
      const h = this._hash3(src, pos);
      chain[pos] = hashHead[h];
      hashHead[h] = pos;
    }

    _hash3(data, pos) {
      const val = OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(data[pos], 16), OpCodes.Shl32(data[pos + 1], 8)), data[pos + 2]);
      return OpCodes.Shr32(OpCodes.Mul32(val, 2654435761), 32 - this.HASH_BITS);
    }

    _emitLiteralBlock(output, src, start, length) {
      const nibble = length <= 15 ? length : 0;
      output.push(OpCodes.ToByte(nibble));
      this._writeLengthContinuation(output, length);
      for (let i = 0; i < length; ++i)
        output.push(OpCodes.ToByte(src[start + i]));
    }

    _emitReferenceBlock(output, length, offset) {
      const type = offset <= this.OFS_TH1 ? 1 : (offset <= this.OFS_TH2 ? 2 : 3);
      const oo = OpCodes.And32(offset, 3);
      const field = length - this.MREF + 1;
      const nibble = field <= 15 ? field : 0;

      output.push(OpCodes.ToByte(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(oo, 6), OpCodes.Shl32(type, 4)), nibble)));

      let bytesVal = OpCodes.Shr32(offset, 2);
      for (let k = 0; k < type; ++k) {
        output.push(OpCodes.ToByte(bytesVal));
        bytesVal = OpCodes.Shr32(bytesVal, 8);
      }

      this._writeLengthContinuation(output, field);
    }

    // Base-128 continuation chain for a length field that overflowed the header's
    // 4-bit nibble (field > 15): low-7-bits-first, high bit set means "more follows".
    _writeLengthContinuation(output, field) {
      if (field <= 15)
        return;

      let remaining = field - 16;
      while (remaining > 127) {
        output.push(OpCodes.ToByte(OpCodes.Or32(0x80, OpCodes.And32(remaining, 0x7F))));
        remaining = OpCodes.Shr32(remaining, 7);
      }
      output.push(OpCodes.ToByte(remaining));
    }

    // ===== DECOMPRESSION (LZAV data format 3) =====

    _decompress(input) {
      if (input.length < 4)
        return [];

      const originalSize = OpCodes.Pack32LE(
        OpCodes.ToByte(input[0]), OpCodes.ToByte(input[1]),
        OpCodes.ToByte(input[2]), OpCodes.ToByte(input[3])
      );
      if (originalSize === 0)
        return [];

      const payload = input.slice(4);
      const prefix = OpCodes.ToByte(payload[0]);
      const mref = OpCodes.And8(prefix, 0x0F);

      const dst = [];
      let pos = 0;
      const iRef = { i: 1 };

      while (pos < originalSize) {
        const b = OpCodes.ToByte(payload[iRef.i++]);
        const type = OpCodes.And8(OpCodes.Shr8(b, 4), 3);
        const nibble = OpCodes.And8(b, 0x0F);

        if (type === 0) {
          const length = this._readLengthField(payload, iRef, nibble);
          for (let k = 0; k < length; ++k)
            dst.push(OpCodes.ToByte(payload[iRef.i + k]));
          iRef.i += length;
          pos += length;
        } else {
          const oo = OpCodes.And8(OpCodes.Shr8(b, 6), 3);
          let bytesVal = 0;
          for (let k = 0; k < type; ++k)
            bytesVal = OpCodes.Or32(bytesVal, OpCodes.Shl32(OpCodes.ToByte(payload[iRef.i++]), 8 * k));
          const offset = OpCodes.Or32(OpCodes.Shl32(bytesVal, 2), oo);

          const field = this._readLengthField(payload, iRef, nibble);
          const length = field + mref - 1;

          if (offset <= 0 || offset > pos)
            throw new Error(`LZAV: match offset ${offset} invalid at position ${pos}.`);

          for (let k = 0; k < length && pos < originalSize; ++k, ++pos)
            dst.push(dst[pos - offset]);
        }
      }

      return dst;
    }

    _readLengthField(payload, iRef, nibble) {
      if (nibble !== 0)
        return nibble;

      let value = 0;
      let shift = 0;
      for (;;) {
        const b = OpCodes.ToByte(payload[iRef.i++]);
        value = OpCodes.Or32(value, OpCodes.Shl32(OpCodes.And8(b, 0x7F), shift));
        if (OpCodes.And8(b, 0x80) === 0)
          break;
        shift += 7;
      }
      return 16 + value;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZAVCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { LZAVCompression, LZAVInstance };
}));
