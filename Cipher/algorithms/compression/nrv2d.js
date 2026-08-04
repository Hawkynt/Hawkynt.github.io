/*
 * NRV2D (UCL / "Not Really Vanished" family) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * NRV2D is one of three "Not Really Vanished" LZ77 variants (alongside NRV2B and
 * NRV2E) shipped in Markus F.X.J. Oberhumer's UCL (Universal Compression Library),
 * later reused by the UPX executable packer. All three share the same overall
 * shape: a single MSB-first bit stream that alternates literal runs with
 * back-references, an exponential-Golomb-coded offset with a one-symbol
 * "repeat last offset" shortcut, and a length bonus for far-away matches.
 * NRV2D and NRV2E differ from each other (and from NRV2B) in the offset base
 * and in how the match length is coded; see nrv2e.js for the sibling variant.
 *
 * Bit stream (this implementation, reconstructed from published descriptions
 * of the UCL decompressors, not from Oberhumer's source code):
 *   control bit = 1            -> one literal byte follows
 *   control bit = 0            -> a back-reference follows:
 *     offset:  off = 1; repeat { off = off*2 + valueBit; } until stopBit == 1
 *              (each iteration reads a value bit then a stop bit)
 *              if off == 2:  reuse the previous match's offset
 *              else:         distance = (off - 3) * 256 + nextByte(); remember it
 *     length:  bit = nextBit();
 *              if bit == 1:  length = 2
 *              else:         val = 1; repeat { val = val*2 + valueBit; } until stopBit == 1
 *                             length = val + 2   (val >= 2, so length >= 4 -- a
 *                             length of exactly 3 is therefore never emitted by
 *                             this encoder, matching a real limitation of the
 *                             NRV2D code space)
 *              if distance > 0x500: length += 1  (far-match bonus)
 *
 * Because this reconstruction does not carry the original block length out of
 * band the way UCL's block API does, the compressed stream is prefixed with a
 * 4-byte little-endian original length so decompression is self-contained.
 *
 * References:
 * - UCL homepage: http://www.oberhumer.com/opensource/ucl/
 * - UCL source mirror (decompressor structure studied, not copied):
 *   https://github.com/korczis/ucl/blob/master/src/n2d_d.c
 * - UPX (uses UCL's NRV algorithms): https://upx.github.io/
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

  const OFFSET_BASE = 3;
  const FAR_OFFSET_THRESHOLD = 0x500;
  const WINDOW_SIZE = 0x3FFFF;
  const MAX_MATCH = 2048;

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

  // ===== GOLOMB-STYLE OFFSET CODE (shared shape for the whole NRV family) =====

  function writeGolomb(bw, value) {
    // value >= 2; emits (valueBit, stopBit) pairs, MSB first, matching readGolomb()
    let bitLen = 0;
    let v = value;
    while (v > 1) { bitLen++; v = OpCodes.Shr32(v, 1); }

    for (let i = bitLen - 1; i >= 0; --i) {
      bw.writeBit(OpCodes.And32(OpCodes.Shr32(value, i), 1));
      bw.writeBit(i === 0 ? 1 : 0);
    }
  }

  function readGolomb(br) {
    let value = 1;
    let stop;
    do {
      value = OpCodes.Or32(OpCodes.Shl32(value, 1), br.readBit());
      stop = br.readBit();
    } while (stop === 0);
    return value;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class NRV2DCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "NRV2D";
      this.description = "UCL library \"Not Really Vanished\" LZ77 variant 2D. Bit-tagged literal/match stream with an exponential-Golomb offset (with single-symbol repeat-offset shortcut) and a two-tier length code, used inside the UPX executable packer.";
      this.inventor = "Markus F.X.J. Oberhumer";
      this.year = 1999;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.AT;

      this.documentation = [
        new LinkItem("Official UCL Homepage", "http://www.oberhumer.com/opensource/ucl/"),
        new LinkItem("UCL Wikipedia", "https://en.wikipedia.org/wiki/UCL_(data_compression_software)")
      ];

      this.references = [
        new LinkItem("UCL Source Code Repository", "https://github.com/korczis/ucl"),
        new LinkItem("NRV2D Decompressor (structure reference only)", "https://github.com/korczis/ucl/blob/master/src/n2d_d.c"),
        new LinkItem("UPX Homepage", "https://upx.github.io/")
      ];

      this.tests = [
        {
          text: "Empty input",
          uri: "http://www.oberhumer.com/opensource/ucl/",
          input: [],
          expected: [0, 0, 0, 0]
        },
        {
          text: "Highly repetitive input (64 'A' bytes)",
          uri: "http://www.oberhumer.com/opensource/ucl/",
          input: new Array(64).fill(0x41),
          expected: [64, 0, 0, 0, 160, 149, 70]
        },
        {
          text: "Text sample",
          uri: "http://www.oberhumer.com/opensource/ucl/",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox."),
          expected: [65, 0, 0, 0, 186, 90, 44, 178, 11, 141, 214, 211, 99, 181, 200, 44, 87, 43, 125, 222, 221, 32, 179, 91, 239, 18, 11, 85, 214, 219, 112, 185, 200, 45, 247, 107, 45, 202, 64, 199, 205, 178, 195, 122, 188, 200, 44, 150, 251, 60, 185, 135, 54, 90, 142, 92]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new NRV2DInstance(this, isInverse);
    }
  }

  class NRV2DInstance extends IAlgorithmInstance {
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
      const n = input.length;
      const header = OpCodes.Unpack32LE(n);
      if (n === 0) return header;

      const bw = new BitWriter();
      let lastOffset = 1;
      let pos = 0;

      while (pos < n) {
        const match = this._findMatch(input, pos, lastOffset);

        if (match.length >= 2) {
          bw.writeBit(0);

          const reuse = match.distance === lastOffset;
          if (reuse) {
            writeGolomb(bw, 2);
          } else {
            const rawOff = OpCodes.Shr32(match.distance, 8) + OFFSET_BASE;
            writeGolomb(bw, rawOff);
            bw.writeBits(OpCodes.And32(match.distance, 0xFF), 8);
            lastOffset = match.distance;
          }

          const bonus = match.distance > FAR_OFFSET_THRESHOLD ? 1 : 0;
          const encLen = match.length - bonus;

          if (encLen === 2) {
            bw.writeBit(1);
          } else {
            bw.writeBit(0);
            writeGolomb(bw, encLen - 2);
          }

          pos += match.length;
        } else {
          bw.writeBit(1);
          bw.writeBits(input[pos], 8);
          pos += 1;
        }
      }

      return header.concat(bw.finish());
    }

    _decompress(input) {
      if (input.length < 4) return [];
      const size = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      if (size === 0) return [];

      const br = new BitReader(input.slice(4));
      const output = [];
      let lastOffset = 1;

      while (output.length < size) {
        const bit = br.readBit();

        if (bit === 1) {
          output.push(br.readBits(8));
          continue;
        }

        const off = readGolomb(br);
        let distance;

        if (off === 2) {
          distance = lastOffset;
        } else {
          distance = OpCodes.Shl32(off - OFFSET_BASE, 8) + br.readBits(8);
          lastOffset = distance;
        }

        let length;
        if (br.readBit() === 1) {
          length = 2;
        } else {
          length = readGolomb(br) + 2;
        }
        if (distance > FAR_OFFSET_THRESHOLD) length += 1;

        const start = output.length - distance;
        for (let k = 0; k < length && output.length < size; ++k) output.push(output[start + k]);
      }

      return output;
    }

    _findMatch(input, pos, lastOffset) {
      const n = input.length;
      const maxLen = Math.min(MAX_MATCH, n - pos);
      let bestLen = 0;
      let bestDist = 0;

      if (maxLen < 2) return { length: 0, distance: 0 };

      const windowStart = Math.max(0, pos - WINDOW_SIZE);

      for (let cand = windowStart; cand < pos; ++cand) {
        let len = 0;
        while (len < maxLen && input[cand + len] === input[pos + len]) ++len;
        if (len < 2) continue;

        const distance = pos - cand;
        const bonus = distance > FAR_OFFSET_THRESHOLD ? 1 : 0;
        const encLen = len - bonus;
        // The shortcut path only encodes exactly 2; the extended path only
        // encodes values >= 2 (i.e. length >= 4). A raw encoded length of 3
        // (actual length 3, or 4 for a far match) cannot be represented.
        if (encLen < 2 || encLen === 3) continue;

        const isReuse = distance === lastOffset;
        const better = len > bestLen || (len === bestLen && isReuse && bestDist !== lastOffset);
        if (better) {
          bestLen = len;
          bestDist = distance;
        }
      }

      return { length: bestLen, distance: bestDist };
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new NRV2DCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { NRV2DCompression, NRV2DInstance };
}));
