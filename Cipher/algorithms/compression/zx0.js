/*
 * ZX0 Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * ZX0 is a modern optimal-parsing LZ77 compressor for 8-bit targets (Z80,
 * 6502, etc.) designed by Einar Saukas. Its compressed format uses only
 * three block types and needs a single bit to distinguish between them,
 * because literal blocks can never be consecutive and reusing the previous
 * match's offset can only happen immediately after a literal block:
 *
 *   Literal block         : [0] Elias(length) byte[1..length]
 *   Last-offset match     : [0] Elias(length)              (only directly
 *                                                             after a literal
 *                                                             block)
 *   New-offset match      : [1] Elias(MSB(offset)+1) LSB(offset:7 bits)
 *                                Elias(length-1)
 *
 * The very first block is always a literal block, so its leading control bit
 * is omitted entirely. Offset MSB and every length are coded with interlaced
 * Elias gamma coding; end of stream is signalled by an offset MSB of 256
 * (i.e. Elias value 257) inside what would otherwise be a new-offset match.
 * This implementation uses the "modern" (v2) bit convention, where each
 * Elias-coded value's continuation bit is inverted (0 = more bits follow,
 * 1 = stop) relative to the original ("classic"/v1) ZX0 format -- see
 * salvador.js, which implements the classic convention instead.
 *
 * References:
 * - ZX0 official repository and format description:
 *   https://github.com/einar-saukas/ZX0
 * - Note on the v1/v2 Elias-bit inversion (compared across ZX0 variants):
 *   https://github.com/dmsc/zx0-6502
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, LinkItem } = AlgorithmFramework;

  const MAX_MATCH = 65536;

  // ===== BIT-LEVEL STREAM HELPERS (MSB first) =====

  class BitWriter {
    constructor() {
      this.bytes = [];
      this.cur = 0;
      this.nBits = 0;
    }

    writeBit(bit) {
      this.cur = OpCodes.Or32(OpCodes.Shl32(this.cur, 1), bit ? 1 : 0);
      this.nBits++;
      if (this.nBits === 8) {
        this.bytes.push(OpCodes.And32(this.cur, 0xFF));
        this.cur = 0;
        this.nBits = 0;
      }
    }

    writeBits(value, count) {
      for (let i = count - 1; i >= 0; --i)
        this.writeBit(OpCodes.And32(OpCodes.Shr32(value, i), 1));
    }

    finish() {
      if (this.nBits > 0) {
        this.cur = OpCodes.Shl32(this.cur, 8 - this.nBits);
        this.bytes.push(OpCodes.And32(this.cur, 0xFF));
        this.cur = 0;
        this.nBits = 0;
      }
      return this.bytes;
    }
  }

  class BitReader {
    constructor(bytes) {
      this.bytes = bytes;
      this.pos = 0;
      this.cur = 0;
      this.nBits = 0;
    }

    readBit() {
      if (this.nBits === 0) {
        this.cur = this.pos < this.bytes.length ? this.bytes[this.pos++] : 0;
        this.nBits = 8;
      }
      this.nBits--;
      return OpCodes.And32(OpCodes.Shr32(this.cur, this.nBits), 1);
    }

    readBits(count) {
      let value = 0;
      for (let i = 0; i < count; ++i)
        value = OpCodes.Or32(OpCodes.Shl32(value, 1), this.readBit());
      return value;
    }
  }

  // ===== INTERLACED ELIAS GAMMA CODING (value >= 1), "modern" v2 convention =====
  // Continuation bit is inverted relative to the classic format: 0 = more
  // bits follow, 1 = stop.

  function writeElias(bw, value) {
    let bitLen = 0;
    let v = value;
    while (v > 1) { bitLen++; v = OpCodes.Shr32(v, 1); }

    for (let i = bitLen - 1; i >= 0; --i) {
      bw.writeBit(0); // continue
      bw.writeBit(OpCodes.And32(OpCodes.Shr32(value, i), 1));
    }
    bw.writeBit(1); // stop
  }

  function readElias(br) {
    let value = 1;
    for (;;) {
      if (br.readBit() === 1) break; // stop
      value = OpCodes.Or32(OpCodes.Shl32(value, 1), br.readBit());
    }
    return value;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class ZX0Compression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "ZX0";
      this.description = "Modern optimal-parsing LZ77 compressor for 8-bit targets designed by Einar Saukas. Uses only three block types (literal, last-offset match, new-offset match) distinguished by a single context-dependent bit, with interlaced Elias gamma coding for offsets and lengths.";
      this.inventor = "Einar Saukas";
      this.year = 2021;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BR;

      this.documentation = [
        new LinkItem("ZX0 official repository", "https://github.com/einar-saukas/ZX0"),
        new LinkItem("ZX0 README (format overview)", "https://github.com/einar-saukas/ZX0/blob/main/README.md")
      ];

      this.references = [
        new LinkItem("dzx0_standard.asm reference decompressor", "https://github.com/einar-saukas/ZX0/blob/main/z80/dzx0_standard.asm"),
        new LinkItem("v1/v2 format comparison notes (zx0-6502)", "https://github.com/dmsc/zx0-6502")
      ];

      this.tests = [
        {
          text: "Empty input",
          uri: "https://github.com/einar-saukas/ZX0",
          input: [],
          expected: []
        },
        {
          text: "Highly repetitive input (64 'A' bytes)",
          uri: "https://github.com/einar-saukas/ZX0",
          input: new Array(64).fill(0x41),
          expected: [160, 149, 92, 0, 6]
        },
        {
          text: "Text sample",
          uri: "https://github.com/einar-saukas/ZX0",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox."),
          expected: [85, 186, 52, 50, 144, 56, 186, 180, 177, 181, 144, 49, 57, 55, 187, 183, 16, 51, 55, 188, 16, 53, 58, 182, 184, 57, 144, 55, 187, 50, 185, 16, 103, 152, 27, 99, 11, 211, 201, 3, 35, 123, 57, 118, 52, 58, 197, 41, 116, 0, 6]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new ZX0Instance(this, isInverse);
    }
  }

  class ZX0Instance extends IAlgorithmInstance {
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
      const result = this.isInverse ? this._decompress(this.inputBuffer) : this._compress(this.inputBuffer);
      this.inputBuffer = [];
      return result;
    }

    _compress(input) {
      const n = input.length;
      if (n === 0) return [];

      const bw = new BitWriter();
      let pos = 0;
      let lastOffset = 1;
      let lastWasLiteral = false;
      let isFirstBlock = true;

      while (pos < n) {
        const match = isFirstBlock ? null : this._findMatch(input, pos);

        if (match && match.length >= 2) {
          const reuse = lastWasLiteral && match.distance === lastOffset;
          bw.writeBit(reuse ? 0 : 1);

          if (reuse) {
            writeElias(bw, match.length);
          } else {
            const off0 = match.distance - 1;
            const offsetMsb = Math.floor(off0 / 128);
            const lsb = off0 % 128;
            writeElias(bw, offsetMsb + 1);
            bw.writeBits(lsb, 7);
            writeElias(bw, match.length - 1);
            lastOffset = match.distance;
          }

          pos += match.length;
          lastWasLiteral = false;
        } else {
          const runStart = pos;
          pos += 1;

          while (pos < n) {
            const next = this._findMatch(input, pos);
            if (next && next.length >= 2) break;
            pos += 1;
          }

          if (!isFirstBlock) bw.writeBit(0);
          const length = pos - runStart;
          writeElias(bw, length);
          for (let i = runStart; i < pos; ++i) bw.writeBits(input[i], 8);
          lastWasLiteral = true;
        }

        isFirstBlock = false;
      }

      // EOF: a new-offset match whose offset MSB is the sentinel value 256
      bw.writeBit(1);
      writeElias(bw, 257);

      return bw.finish();
    }

    _decompress(input) {
      if (input.length === 0) return [];

      const br = new BitReader(input);
      const output = [];
      let lastOffset = 1;
      let lastWasLiteral = false;

      // First block is always a literal block; its control bit is omitted.
      let length = readElias(br);
      for (let i = 0; i < length; ++i) output.push(br.readBits(8));
      lastWasLiteral = true;

      for (;;) {
        const bit = br.readBit();

        if (bit === 1) {
          const eliasVal = readElias(br);
          const offsetMsb = eliasVal - 1;
          if (offsetMsb === 256) break; // EOF marker

          const lsb = br.readBits(7);
          const distance = offsetMsb * 128 + lsb + 1;
          lastOffset = distance;

          length = readElias(br) + 1;
          const start = output.length - distance;
          for (let k = 0; k < length; ++k) output.push(output[start + k]);
          lastWasLiteral = false;
        } else if (lastWasLiteral) {
          length = readElias(br);
          const start = output.length - lastOffset;
          for (let k = 0; k < length; ++k) output.push(output[start + k]);
          lastWasLiteral = false;
        } else {
          length = readElias(br);
          for (let i = 0; i < length; ++i) output.push(br.readBits(8));
          lastWasLiteral = true;
        }
      }

      return output;
    }

    _findMatch(input, pos) {
      const n = input.length;
      const maxLen = Math.min(MAX_MATCH, n - pos);
      let bestLen = 0;
      let bestDist = 0;

      if (maxLen < 2) return null;

      for (let cand = 0; cand < pos; ++cand) {
        let len = 0;
        while (len < maxLen && input[cand + len] === input[pos + len]) ++len;

        if (len > bestLen) {
          bestLen = len;
          bestDist = pos - cand;
        }
      }

      return bestLen >= 2 ? { length: bestLen, distance: bestDist } : null;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new ZX0Compression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { ZX0Compression, ZX0Instance };
}));
