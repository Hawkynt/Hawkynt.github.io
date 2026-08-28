/*
 * DS-LZ77 (Nintendo GBA/DS BIOS LZSS, type 0x10) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The "type 0x10" LZSS variant used by the Game Boy Advance and Nintendo DS BIOS
 * decompression routines (GBA SWI 0x11 "LZ77UnCompReadNormalWrite8bit", reused
 * unchanged by the NDS BIOS/ARM9 loader). Widely used to compress files inside
 * commercial GBA/NDS ROMs.
 *
 * Container layout:
 *   Byte 0        : type ID, always 0x10
 *   Bytes 1..3    : decompressed size, 24-bit little-endian
 *   Bytes 4..     : compressed block stream
 *
 * Compressed block stream: a sequence of groups. Each group starts with one
 * "flag" byte whose bits are consumed MSB-first, one bit per unit (up to 8
 * units per flag byte):
 *   flag bit = 0 -> copy one raw literal byte from the stream
 *   flag bit = 1 -> copy a back-reference, encoded in the next 2 bytes B0,B1:
 *                     length = 3 + (B0 >> 4)
 *                     disp   = 1 + ((B0 & 0x0F) << 8) + B1
 *                   `length` bytes are copied from `disp` bytes before the
 *                   current output position (copies may overlap, i.e. RLE).
 * Decompression stops once the declared decompressed size has been produced;
 * any unused bits in the final flag byte are ignored.
 *
 * References:
 * - GBATEK, "LZ Decompression Functions" (type 0x10 header/flag/code layout)
 *   https://problemkaputt.de/gbatek-lz-decompression-functions.htm
 * - GBATEK, "BIOS Decompression Functions" (SWI 0x11 LZ77UnCompReadNormalWrite8bit)
 *   https://problemkaputt.de/gbatek-bios-decompression-functions.htm
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

  // ===== FORMAT CONSTANTS =====

  const TYPE_ID = 0x10;
  const MIN_MATCH = 3;
  const MAX_MATCH = 3 + 0x0F;      // length nibble is 4 bits -> 3..18
  const MAX_DISP = 1 + 0x0FFF;     // 12-bit displacement field -> 1..4096

  // ===== ALGORITHM IMPLEMENTATION =====

  class DSLZ77Compression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "DS-LZ77";
      this.description = "LZSS variant used by the Game Boy Advance and Nintendo DS BIOS decompression routines (type 0x10 header). Flag bytes select between literal bytes and 12-bit-displacement/4-bit-length back-references, with the total decompressed size stored in the header.";
      this.inventor = "Nintendo";
      this.year = 2001;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.JP;

      this.documentation = [
        new LinkItem("GBATEK - LZ Decompression Functions", "https://problemkaputt.de/gbatek-lz-decompression-functions.htm"),
        new LinkItem("GBATEK - BIOS Decompression Functions", "https://problemkaputt.de/gbatek-bios-decompression-functions.htm")
      ];

      this.references = [
        new LinkItem("GBATEK main index", "https://problemkaputt.de/gbatek.htm"),
        new LinkItem("GBATemp - Nintendo DS/GBA Compressors", "https://gbatemp.net/threads/nintendo-ds-gba-compressors.313278/")
      ];

      this.tests = [
        {
          text: "Empty input",
          uri: "https://problemkaputt.de/gbatek-lz-decompression-functions.htm",
          input: [],
          expected: []
        },
        {
          text: "Highly repetitive input (48 zero bytes)",
          uri: "https://problemkaputt.de/gbatek-lz-decompression-functions.htm",
          input: new Array(48).fill(0),
          expected: [16, 48, 0, 0, 112, 0, 240, 0, 240, 18, 128, 36]
        },
        {
          text: "Text sample",
          uri: "https://problemkaputt.de/gbatek-lz-decompression-functions.htm",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox."),
          expected: [16, 65, 0, 0, 0, 116, 104, 101, 32, 113, 117, 105, 99, 0, 107, 32, 98, 114, 111, 119, 110, 32, 0, 102, 111, 120, 32, 106, 117, 109, 112, 1, 115, 32, 111, 118, 101, 114, 32, 16, 30, 0, 108, 97, 122, 121, 32, 100, 111, 103, 96, 46, 32, 13, 192, 44, 46]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DSLZ77Instance(this, isInverse);
    }
  }

  class DSLZ77Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }


    Result() {
      const result = this.isInverse ? this._decompress(this.inputBuffer) : this._compress(this.inputBuffer);
      this.inputBuffer = [];
      return result;
    }

    _compress(input) {
      const n = input.length;
      if (n === 0) return [];

      const sizeBytes = OpCodes.Unpack32LE(n);
      const output = [TYPE_ID, sizeBytes[0], sizeBytes[1], sizeBytes[2]];

      let pos = 0;
      while (pos < n) {
        let flag = 0;
        const units = [];

        for (let i = 0; i < 8 && pos < n; ++i) {
          const match = this._findMatch(input, pos);

          if (match.length >= MIN_MATCH) {
            flag = OpCodes.SetBit(flag, 7 - i, true);
            const lenField = match.length - MIN_MATCH;
            const dispField = match.distance - 1;
            const byte0 = OpCodes.Or32(OpCodes.Shl32(lenField, 4), OpCodes.And32(OpCodes.Shr32(dispField, 8), 0x0F));
            const byte1 = OpCodes.And32(dispField, 0xFF);
            units.push(byte0, byte1);
            pos += match.length;
          } else {
            flag = OpCodes.SetBit(flag, 7 - i, false);
            units.push(input[pos]);
            pos += 1;
          }
        }

        output.push(flag);
        for (let i = 0; i < units.length; ++i) output.push(units[i]);
      }

      return output;
    }

    _decompress(input) {
      if (input.length === 0) return [];
      if (input[0] !== TYPE_ID) throw new Error('DS-LZ77: invalid type byte in header');

      const size = OpCodes.Pack32LE(input[1], input[2], input[3], 0);
      const output = [];
      let pos = 4;

      while (output.length < size && pos < input.length) {
        const flag = input[pos++];

        for (let i = 0; i < 8 && output.length < size; ++i) {
          const bit = OpCodes.GetBit(flag, 7 - i);

          if (bit) {
            const byte0 = input[pos++];
            const byte1 = input[pos++];
            const length = MIN_MATCH + OpCodes.Shr32(byte0, 4);
            const dispHigh = OpCodes.And32(byte0, 0x0F);
            const disp = 1 + OpCodes.Or32(OpCodes.Shl32(dispHigh, 8), byte1);
            const start = output.length - disp;

            for (let k = 0; k < length; ++k) output.push(output[start + k]);
          } else {
            output.push(input[pos++]);
          }
        }
      }

      return output;
    }

    _findMatch(input, pos) {
      const n = input.length;
      const maxLen = Math.min(MAX_MATCH, n - pos);
      let bestLen = 0;
      let bestDist = 0;

      if (maxLen < MIN_MATCH) return { length: 0, distance: 0 };

      const windowStart = Math.max(0, pos - MAX_DISP);

      for (let cand = windowStart; cand < pos; ++cand) {
        let len = 0;
        while (len < maxLen && input[cand + len] === input[pos + len]) ++len;

        if (len > bestLen) {
          bestLen = len;
          bestDist = pos - cand;
        }
      }

      return { length: bestLen, distance: bestDist };
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DSLZ77Compression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DSLZ77Compression, DSLZ77Instance };
}));
