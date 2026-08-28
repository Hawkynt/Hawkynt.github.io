/*
 * Reduce (ZIP Methods 2-5) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * PKWARE's ZIP "Reducing" method (based on SEA's algorithm from the ARC
 * archiver) combines two passes. Pass 1 is a DLE-escaped LZ77 variant: matches
 * of length >=3 within a sliding window are written as DLE (0x90), a value
 * byte V packing a length field and the low distance bits, a high-distance
 * byte, and (only when the length field is saturated) one extra length byte;
 * the compression "factor" (1-4) controls the split between the length field
 * width and the distance-low-bits width. A literal DLE byte in the source is
 * escaped as DLE,0x00. Pass 2 is a static probabilistic substitution coder:
 * for every possible "previous byte" context it builds, from one pass over
 * the pass-1 output, a follower set of up to 32 candidate successor bytes
 * ranked by observed frequency (most frequent first); the coder then emits
 * either a short index into that context's fixed follower set (flag bit 0)
 * or a raw literal byte (flag bit 1) - the follower sets themselves are part
 * of the compressed stream and are not re-ranked or move-to-front adapted
 * during coding.
 *
 * Reference:
 *   PKWARE, Inc., ".ZIP File Format Specification" (APPNOTE.TXT), section
 *   describing compression methods 2-5 "Reducing" (factors 1-4).
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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  const DLE = 0x90;
  const FACTOR = 4; // methods 2-5 == factor 1-4; 4 (strongest) is what ZIP method 5 uses.
  const MAX_FOLLOWER_SET = 32;

  // ----- Bit-level stream helpers (LSB-first within each byte) -----

  class BitWriter {
    constructor() {
      this.bytes = [];
      this.cur = 0;
      this.bitPos = 0;
    }

    writeBits(value, count) {
      for (let i = 0; i < count; ++i) {
        const bit = OpCodes.AndN(OpCodes.Shr32(value, i), 1);
        if (bit === 1) this.cur = OpCodes.OrN(this.cur, OpCodes.Shl32(1, this.bitPos));
        ++this.bitPos;
        if (this.bitPos === 8) {
          this.bytes.push(this.cur);
          this.cur = 0;
          this.bitPos = 0;
        }
      }
    }

    finish() {
      if (this.bitPos > 0) {
        this.bytes.push(this.cur);
        this.cur = 0;
        this.bitPos = 0;
      }
      return this.bytes;
    }
  }

  class BitReader {
    constructor(bytes) {
      this.bytes = bytes;
      this.pos = 0; // bit position
      this.totalBits = bytes.length * 8;
    }

    // Mirrors the reference's ReadBits: silently stops (without advancing
    // past the end) once the underlying byte array is exhausted, returning
    // whatever bits were assembled so far rather than throwing.
    readBits(count) {
      let result = 0;
      for (let i = 0; i < count; ++i) {
        const byteIdx = Math.floor(this.pos / 8);
        if (byteIdx >= this.bytes.length) return result;
        const bitIdx = this.pos % 8;
        const bit = OpCodes.AndN(OpCodes.Shr32(this.bytes[byteIdx], bitIdx), 1);
        result = OpCodes.OrN(result, OpCodes.Shl32(bit, i));
        ++this.pos;
      }
      return result;
    }
  }

  // Minimal number of bits needed to represent values 0..(n-1).
  function bitsFor(n) {
    if (n <= 1) return 0;
    let bits = 0;
    let val = n - 1;
    while (val > 0) { val = OpCodes.Shr32(val, 1); ++bits; }
    return bits;
  }

  /**
 * ReduceCompression - PKZIP "Reducing" (RLE + probabilistic follower sets)
 * @class
 * @extends {CompressionAlgorithm}
 */

  class ReduceCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Reduce";
        this.description = "PKZIP methods 2-5 (Reducing): a DLE-escaped LZ77 pre-pass (factor-controlled length/distance bit split) followed by a static, frequency-ranked probabilistic substitution stage using per-byte follower sets of up to 32 candidate successor bytes.";
        this.inventor = "Systems Enhancement Associates (SEA); adapted by PKWARE, Inc.";
        this.year = 1989;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary + RLE";
        this.securityStatus = null;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.US;

        // Documentation and references
        this.documentation = [
          new LinkItem(".ZIP File Format Specification (APPNOTE.TXT)", "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT"),
          new LinkItem("ZIP (file format) - Wikipedia (Reducing method)", "https://en.wikipedia.org/wiki/ZIP_(file_format)"),
          new LinkItem("Move-to-front transform - Wikipedia (adaptive list technique)", "https://en.wikipedia.org/wiki/Move-to-front_transform")
        ];

        this.references = [
          new LinkItem("Info-ZIP unreduce.c (historical decoder notes)", "https://github.com/LuaDist/zziplib"),
          new LinkItem("ARC archiver history (original SEA reducing algorithm)", "https://en.wikipedia.org/wiki/ARC_(file_format)")
        ];

        this.tests = [
          {
            text: "Empty input",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: [],
            expected: [0, 0, 0, 0, 4]
          },
          {
            text: "Single byte",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: [0x41],
            expected: [1,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,65]
          },
          {
            text: "256 repeated bytes",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: new Array(256).fill(0x61),
            expected: [0,1,0,0,4,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,240,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,64,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,237,195,0]
          },
          {
            text: "Text sample repeated 4x",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: OpCodes.AsciiToBytes("the quick brown fox jumps over the lazy dog. ".repeat(4)),
            expected: [180,0,0,0,4,0,0,4,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,30,45,252,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,64,144,23,128,4,32,129,91,80,38,164,181,5,104,1,136,0,242,22,212,5,115,196,153,221,29,94,0,18,192,5,97,1,72,80,23,140,5,101,129,75,240,38,128,200,5,111,193,90,32,23,232,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,64,0,25,0,0,0,0,0,0,0,0,0,0,28,98,100,102,106,111,113,144,64,16,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,64,16,23,176,5,144,233,64,1,32,33,102,4,138,48,0,1,4,1]
          },
          {
            text: "All 256 byte values",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: Array.from({ length: 256 }, (_, i) => i),
            expected: [0,1,0,0,4,64,240,31,248,7,253,1,127,176,31,232,7,249,1,126,112,31,216,7,245,1,125,48,31,200,7,241,1,124,240,30,184,7,237,1,123,176,30,168,7,233,1,122,112,30,152,7,229,1,121,48,30,136,7,225,1,120,240,29,120,7,221,1,119,176,29,104,7,217,1,118,112,29,88,7,213,1,117,48,29,72,7,209,1,116,240,28,56,7,205,1,115,176,28,40,7,201,1,114,112,28,24,7,197,1,113,48,28,8,7,193,1,112,240,27,248,6,189,1,111,176,27,232,6,185,1,110,112,27,216,6,181,1,109,48,27,200,6,177,1,108,240,26,184,6,173,1,107,176,26,168,6,169,1,106,112,26,152,6,165,1,105,48,26,136,6,161,1,104,240,25,120,6,157,1,103,176,25,104,6,153,1,102,112,25,88,6,149,1,101,48,25,72,6,0,1,100,240,24,56,6,141,1,99,176,24,40,6,137,1,98,112,24,24,6,133,1,97,48,24,8,6,129,1,96,240,23,248,5,125,1,95,176,23,232,5,121,1,94,112,23,216,5,117,1,93,48,23,200,5,113,1,92,240,22,184,5,109,1,91,176,22,168,5,105,1,90,112,22,152,5,101,1,89,48,22,136,5,97,1,88,240,21,120,5,93,1,87,176,21,104,5,89,1,86,112,21,88,5,85,1,85,48,21,72,5,81,1,84,240,20,56,5,77,1,83,176,20,40,5,73,1,82,112,20,24,5,69,1,81,48,20,8,5,65,1,80,240,19,248,4,61,1,79,176,19,232,4,57,1,78,112,19,216,4,53,1,77,48,19,200,4,49,1,76,240,18,184,4,45,1,75,176,18,168,4,41,1,74,112,18,152,4,37,1,73,48,18,136,4,33,1,72,240,17,120,4,29,1,71,176,17,104,4,25,1,70,112,17,88,4,21,1,69,48,17,72,4,17,1,68,240,16,56,4,13,1,67,176,16,40,4,9,1,66,112,16,24,4,5,1,65,48,16,8,8,1,145,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new ReduceInstance(this, isInverse);
      }
    }

    class ReduceInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
      }


      Result() {
        const data = this.inputBuffer;
        this.inputBuffer = [];
        return this.isInverse ? this._decompress(data) : this._compress(data);
      }

      // ----- Stage 1: DLE-escaped LZ77 pre-pass -----

      _dleEncode(data, factor) {
        const out = [];
        const distanceBits = 8 - factor;
        const lenBits = factor;
        const maxLenField = OpCodes.Shl32(1, lenBits) - 1;
        const windowSize = OpCodes.Shl32(1, 8 + distanceBits);
        const distanceMask = OpCodes.Shl32(1, distanceBits) - 1;

        let i = 0;
        while (i < data.length) {
          let bestLen = 0, bestDist = 0;
          const searchStart = Math.max(0, i - windowSize);
          const maxMatchLen = maxLenField + 255 + 3;

          for (let j = searchStart; j < i; ++j) {
            let len = 0;
            const maxLen = Math.min(data.length - i, maxMatchLen);
            const span = i - j;
            while (len < maxLen && data[j + (len % span)] === data[i + len]) ++len;
            if (len > bestLen && len >= 3) {
              bestLen = len;
              bestDist = i - j - 1;
            }
          }

          if (bestLen >= 3) {
            let adjLen = bestLen - 3;
            let lenField = Math.min(adjLen, maxLenField);
            let extraLen = adjLen - lenField;

            if (lenField === maxLenField && extraLen > 255) {
              extraLen = 255;
              bestLen = maxLenField + extraLen + 3;
            }

            const lowBits = OpCodes.AndN(bestDist, distanceMask);
            const highBits = OpCodes.Shr32(bestDist, distanceBits);
            const v = OpCodes.OrN(OpCodes.Shl32(lenField, distanceBits), lowBits);

            if (v === 0) {
              // V=0 is reserved for the literal-DLE escape; skip this match.
              out.push(data[i]);
              if (data[i] === DLE) out.push(0);
              ++i;
              continue;
            }

            out.push(DLE);
            out.push(v);
            out.push(highBits);
            if (lenField === maxLenField) out.push(extraLen);

            i += bestLen;
          } else {
            const b = data[i];
            out.push(b);
            if (b === DLE) out.push(0);
            ++i;
          }
        }

        return out;
      }

      _dleDecode(intermediate, originalSize, factor) {
        const distanceBits = 8 - factor;
        const maxLenField = OpCodes.Shl32(1, factor) - 1;
        const distanceMask = OpCodes.Shl32(1, distanceBits) - 1;

        const output = [];
        let inPos = 0;

        while (output.length < originalSize && inPos < intermediate.length) {
          const cur = intermediate[inPos++];
          if (cur !== DLE) { output.push(cur); continue; }

          if (inPos >= intermediate.length) break;
          const v = intermediate[inPos++];
          if (v === 0) { output.push(DLE); continue; }

          if (inPos >= intermediate.length) break;
          const distHigh = intermediate[inPos++];

          const distLow = OpCodes.AndN(v, distanceMask);
          const distance = OpCodes.OrN(OpCodes.Shl32(distHigh, distanceBits), distLow);
          let lenField = OpCodes.Shr32(v, distanceBits);
          let length = lenField;

          if (lenField === maxLenField) {
            if (inPos >= intermediate.length) break;
            length += intermediate[inPos++];
          }
          length += 3;

          const srcBase = output.length - distance - 1;
          for (let j = 0; j < length && output.length < originalSize; ++j) {
            const src = srcBase + j;
            output.push(src >= 0 && src < output.length ? output[src] : 0);
          }
        }

        return output;
      }

      // ----- Stage 2: static frequency-ranked follower sets -----

      _buildFollowerSets(data) {
        const pairCount = [];
        for (let i = 0; i < 256; ++i) pairCount.push(new Array(256).fill(0));
        for (let i = 1; i < data.length; ++i) ++pairCount[data[i - 1]][data[i]];

        const followers = [];
        for (let i = 0; i < 256; ++i) {
          const entries = [];
          for (let j = 0; j < 256; ++j) if (pairCount[i][j] > 0) entries.push({ count: pairCount[i][j], value: j });
          // Most frequent follower first. Followers of equal count are ordered
          // by ascending byte value, so which 32 followers survive the cut and
          // the index each one gets are a function of the data alone. The
          // comparison never returns 0 for two different followers, so the
          // result does not depend on whether the host sort is stable.
          entries.sort((a, b) => a.count !== b.count ? b.count - a.count : a.value - b.value);
          const setSize = Math.min(entries.length, MAX_FOLLOWER_SET);
          const set = new Array(setSize);
          for (let k = 0; k < setSize; ++k) set[k] = entries[k].value;
          followers.push(set);
        }
        return followers;
      }

      _writeFollowerSets(writer, followers) {
        for (let ctx = 255; ctx >= 0; --ctx) {
          const set = followers[ctx];
          writer.writeBits(set.length, 6);
          for (let i = 0; i < set.length; ++i) writer.writeBits(set[i], 8);
        }
      }

      _readFollowerSets(reader) {
        const followers = new Array(256);
        for (let ctx = 255; ctx >= 0; --ctx) {
          const count = reader.readBits(6);
          const set = new Array(count);
          for (let i = 0; i < count; ++i) set[i] = reader.readBits(8);
          followers[ctx] = set;
        }
        return followers;
      }

      _probEncode(intermediate, followers, writer) {
        let last = 0;
        for (let i = 0; i < intermediate.length; ++i) {
          const b = intermediate[i];
          const set = followers[last];
          if (set.length === 0) {
            writer.writeBits(b, 8);
          } else {
            const idx = set.indexOf(b);
            if (idx < 0) {
              writer.writeBits(1, 1);
              writer.writeBits(b, 8);
            } else {
              writer.writeBits(0, 1);
              writer.writeBits(idx, bitsFor(set.length));
            }
          }
          last = b;
        }
      }

      _probDecode(reader, followers) {
        const intermediate = [];
        let last = 0;

        while (reader.pos < reader.totalBits) {
          const set = followers[last];
          let b;
          if (set.length === 0) {
            if (reader.pos + 8 > reader.totalBits) break;
            b = reader.readBits(8);
          } else {
            const bit = reader.readBits(1);
            if (bit === 1) {
              if (reader.pos + 8 > reader.totalBits) break;
              b = reader.readBits(8);
            } else {
              const bitsNeeded = bitsFor(set.length);
              if (bitsNeeded > 0 && reader.pos + bitsNeeded > reader.totalBits) break;
              const idx = bitsNeeded > 0 ? reader.readBits(bitsNeeded) : 0;
              if (idx >= set.length) break;
              b = set[idx];
            }
          }
          intermediate.push(b);
          last = b;
        }

        return intermediate;
      }

      // ----- Compression -----

      _compress(data) {
        const body = data.length === 0 ? [] : (() => {
          const intermediate = this._dleEncode(data, FACTOR);
          const followers = this._buildFollowerSets(intermediate);

          const writer = new BitWriter();
          this._writeFollowerSets(writer, followers);
          this._probEncode(intermediate, followers, writer);
          return writer.finish();
        })();

        const output = [];
        const len32 = OpCodes.ToUint32(data.length);
        output.push(OpCodes.AndN(len32, 0xFF));
        output.push(OpCodes.AndN(OpCodes.Shr32(len32, 8), 0xFF));
        output.push(OpCodes.AndN(OpCodes.Shr32(len32, 16), 0xFF));
        output.push(OpCodes.AndN(OpCodes.Shr32(len32, 24), 0xFF));
        output.push(FACTOR);
        for (let i = 0; i < body.length; ++i) output.push(body[i]);
        return output;
      }

      // ----- Decompression -----

      _decompress(data) {
        if (data.length < 5) throw new Error('Reduce: input smaller than 5-byte header');
        const size = OpCodes.OrN(
          OpCodes.OrN(OpCodes.OrN(data[0], OpCodes.Shl32(data[1], 8)), OpCodes.Shl32(data[2], 16)),
          OpCodes.Shl32(data[3], 24)
        );
        const factor = data[4];
        if (size === 0) return [];

        const reader = new BitReader(data.slice(5));
        const followers = this._readFollowerSets(reader);
        const intermediate = this._probDecode(reader, followers);

        return this._dleDecode(intermediate, size, factor);
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new ReduceCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ReduceCompression, ReduceInstance };
}));
