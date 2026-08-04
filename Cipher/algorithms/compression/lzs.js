/*
 * LZS (Stac Lempel-Ziv-Stac) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZS as specified for PPP by RFC 1974 "PPP Stac LZS Compression Protocol"
 * (Friend & Simpson, August 1996), originally developed by Stac Electronics.
 * A single, continuous bit stream (MSB first) with no byte alignment between
 * fields:
 *
 *   <Compressed Stream>  := [<Compressed String>]* <End Marker>
 *   <Compressed String>  := 0 <Raw Byte>            (8-bit literal)
 *                         | 1 <Offset> <Length>      (back-reference)
 *   <Offset>             := 1 <7 bits>                (7-bit offset, 1..127)
 *                         | 0 <11 bits>               (11-bit offset, 1..2047)
 *   <End Marker>         := 110000000                 (9 bits; a "match" whose
 *                                                       7-bit offset is zero)
 *
 * Length is coded with a nested nibble/escape scheme (RFC 1974 section 2.5.5):
 *   00 = 2, 01 = 3, 10 = 4, 11 escapes to a further 2 bits:
 *   00 = 5, 01 = 6, 10 = 7, 11 escapes to a further 4 bits (base 8):
 *   0000..1110 = 8..22, 1111 escapes to a further 4 bits (base 23), and so on
 *   (each all-ones nibble extends the code by another 4-bit tier, base += 15).
 *
 * The sliding window covers the last 2 KB of data, matching the 11-bit
 * maximum offset.
 *
 * References:
 * - RFC 1974, "PPP Stac LZS Compression Protocol": https://www.rfc-editor.org/rfc/rfc1974
 * - Lempel-Ziv-Stac (Wikipedia): https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Stac
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

  const WINDOW_SIZE = 2048;    // last 2 KB of history (11-bit offset)
  const MIN_MATCH = 2;
  const MAX_MATCH = 2048;      // practical cap; length code has no hard limit

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

  // ===== LENGTH CODE (RFC 1974 section 2.5.5) =====

  function writeLength(bw, length) {
    if (length <= 4) {
      bw.writeBits(length - 2, 2);
      return;
    }
    if (length <= 7) {
      bw.writeBits(3, 2);
      bw.writeBits(length - 5, 2);
      return;
    }

    bw.writeBits(3, 2);
    bw.writeBits(3, 2);

    let base = 8;
    for (;;) {
      if (length < base + 15) {
        bw.writeBits(length - base, 4);
        return;
      }
      bw.writeBits(15, 4);
      base += 15;
    }
  }

  function readLength(br) {
    let v = br.readBits(2);
    if (v < 3) return 2 + v;

    v = br.readBits(2);
    if (v < 3) return 5 + v;

    let base = 8;
    for (;;) {
      v = br.readBits(4);
      if (v < 15) return base + v;
      base += 15;
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class LZSCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "LZS";
      this.description = "Stac Lempel-Ziv-Stac compression as specified for PPP by RFC 1974. A continuous MSB-first bit stream mixes 8-bit literals with back-references whose offset is coded as either 7 or 11 bits and whose length uses a nested nibble/escape code, terminated by a fixed 9-bit end marker.";
      this.inventor = "Stac Electronics";
      this.year = 1996;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("RFC 1974 - PPP Stac LZS Compression Protocol", "https://www.rfc-editor.org/rfc/rfc1974"),
        new LinkItem("Lempel-Ziv-Stac (Wikipedia)", "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Stac")
      ];

      this.references = [
        new LinkItem("RFC 1974 text", "https://www.ietf.org/rfc/rfc1974.txt"),
        new LinkItem("RFC Editor info page", "https://www.rfc-editor.org/info/rfc1974")
      ];

      this.tests = [
        {
          text: "Empty input",
          uri: "https://www.rfc-editor.org/rfc/rfc1974",
          input: [],
          expected: [0xC0, 0x00]
        },
        {
          text: "Highly repetitive input (40 'A' bytes)",
          uri: "https://www.rfc-editor.org/rfc/rfc1974",
          input: new Array(40).fill(0x41),
          expected: [32, 224, 127, 252, 112, 0]
        },
        {
          text: "Text sample",
          uri: "https://www.rfc-editor.org/rfc/rfc1974",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox."),
          expected: [58, 26, 12, 162, 3, 137, 212, 210, 99, 53, 136, 12, 71, 35, 121, 220, 220, 32, 51, 27, 207, 2, 3, 81, 212, 218, 112, 57, 136, 13, 231, 99, 41, 200, 65, 159, 141, 134, 19, 209, 228, 64, 100, 55, 153, 197, 216, 236, 214, 251, 139, 176, 0]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new LZSInstance(this, isInverse);
    }
  }

  class LZSInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      const result = this.isInverse ? this._decompress(this.inputBuffer) : this._compress(this.inputBuffer);
      this.inputBuffer = [];
      return result;
    }

    _compress(input) {
      const bw = new BitWriter();
      const n = input.length;
      let pos = 0;

      while (pos < n) {
        const match = this._findMatch(input, pos);

        if (match.length >= MIN_MATCH) {
          bw.writeBit(1);

          if (match.distance <= 127) {
            bw.writeBit(1);
            bw.writeBits(match.distance, 7);
          } else {
            bw.writeBit(0);
            bw.writeBits(match.distance, 11);
          }

          writeLength(bw, match.length);
          pos += match.length;
        } else {
          bw.writeBit(0);
          bw.writeBits(input[pos], 8);
          pos += 1;
        }
      }

      // End Marker: 1 <match> 1 <7-bit offset selector> 0000000 (offset = 0)
      bw.writeBit(1);
      bw.writeBit(1);
      bw.writeBits(0, 7);

      return bw.finish();
    }

    _decompress(input) {
      const br = new BitReader(input);
      const output = [];

      for (;;) {
        const type = br.readBit();

        if (type === 0) {
          output.push(br.readBits(8));
          continue;
        }

        const sel = br.readBit();
        let distance;

        if (sel === 1) {
          distance = br.readBits(7);
          if (distance === 0) break; // End Marker
        } else {
          distance = br.readBits(11);
        }

        const length = readLength(br);
        const start = output.length - distance;

        for (let k = 0; k < length; ++k) output.push(output[start + k]);
      }

      return output;
    }

    _findMatch(input, pos) {
      const n = input.length;
      const maxLen = Math.min(MAX_MATCH, n - pos);
      let bestLen = 0;
      let bestDist = 0;

      if (maxLen < MIN_MATCH) return { length: 0, distance: 0 };

      const windowStart = Math.max(0, pos - WINDOW_SIZE);

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

  const algorithmInstance = new LZSCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { LZSCompression, LZSInstance };
}));
