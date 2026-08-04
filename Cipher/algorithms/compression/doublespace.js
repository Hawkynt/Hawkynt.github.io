/*
 * DoubleSpace (SVDC) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * DoubleSpace was the real-time disk-compression driver (DBLSPACE.BIN) shipped
 * with MS-DOS 6.0/6.2. Its on-disk "SVDC" cluster format used a sliding-window
 * LZ77-style token stream: a per-token literal/match flag, a tiered fixed-width
 * offset field, and a match length encoded with a static (non-transmitted)
 * prefix code. No official bitstream specification was ever published by
 * Microsoft (its TechNet material describes the driver's behavior and MRCI
 * hardware API only, not the codec bit layout); Microsoft's compression scheme
 * became the subject of Stac Electronics, Inc. v. Microsoft Corp. (1994) because
 * of its closeness to Stac's patented LZS algorithm.
 *
 * This is a documented-subset, from-scratch reimplementation of the general
 * technique described in secondary sources: a sliding window covering roughly
 * 4KB of back-reference distance split into three fixed-width offset tiers, a
 * short static prefix code for match lengths, and a minimum match length of 2
 * bytes (as reported for the original DoubleSpace "DS" variant, versus 3 bytes
 * for the post-lawsuit DriveSpace "JM" redesign - see drivespace.js). It is a
 * self-consistent LZ77 coder built to the documented parameters, not a
 * byte-exact clone of DBLSPACE.BIN's cluster format, and does not implement any
 * cluster/sector container framing (out of scope: building blocks only).
 *
 * References:
 * - Microsoft TechNet Archive, "What is DoubleSpace and How Does It Work?"
 *   https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10)
 * - Stac Electronics, Inc. v. Microsoft Corp., 38 F.3d 1126 (Fed. Cir. 1994)
 * - Storer and Szymanski, "Data compression via textual substitution", 1982
 *   (LZSS - the general sliding-window/flag-bit family this belongs to)
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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== BIT STREAM HELPERS (LSB-first) =====

  class SvdcBitWriter {
    constructor() {
      this.bytes = [];
      this.buf = 0;
      this.nBits = 0;
    }

    writeBits(value, width) {
      this.buf = OpCodes.ToUint32(OpCodes.OrN(this.buf, OpCodes.Shl32(value, this.nBits)));
      this.nBits += width;
      while (this.nBits >= 8) {
        this.bytes.push(OpCodes.AndN(this.buf, 0xFF));
        this.buf = OpCodes.Shr32(this.buf, 8);
        this.nBits -= 8;
      }
    }

    flush() {
      if (this.nBits > 0) {
        this.bytes.push(OpCodes.AndN(this.buf, 0xFF));
        this.buf = 0;
        this.nBits = 0;
      }
      return this.bytes;
    }
  }

  class SvdcBitReader {
    constructor(bytes, start) {
      this.bytes = bytes;
      this.pos = start;
      this.buf = 0;
      this.nBits = 0;
    }

    readBits(width) {
      while (this.nBits < width) {
        if (this.pos >= this.bytes.length) throw new Error('DoubleSpace: unexpected end of stream');
        this.buf = OpCodes.ToUint32(OpCodes.OrN(this.buf, OpCodes.Shl32(this.bytes[this.pos++], this.nBits)));
        this.nBits += 8;
      }
      const mask = OpCodes.ToUint32(OpCodes.Shl32(1, width) - 1);
      const value = OpCodes.AndN(this.buf, mask);
      this.buf = OpCodes.Shr32(this.buf, width);
      this.nBits -= width;
      return value;
    }
  }

  // ===== SLIDING-WINDOW LZ CODEC SHARED BY DOUBLESPACE/DRIVESPACE VARIANTS =====
  // MIN_MATCH differs per format: DoubleSpace ("DS") = 2, DriveSpace ("JM") = 3.

  const OFFSET_TIER1_BITS = 6;   // offsets 1..64
  const OFFSET_TIER2_BITS = 8;   // offsets 65..320
  const OFFSET_TIER3_BITS = 12;  // offsets 321..4416
  const OFFSET_TIER1_MAX = OpCodes.Shl32(1, OFFSET_TIER1_BITS);         // 64
  const OFFSET_TIER2_MAX = OFFSET_TIER1_MAX + OpCodes.Shl32(1, OFFSET_TIER2_BITS); // 320
  const OFFSET_TIER3_MAX = OFFSET_TIER2_MAX + OpCodes.Shl32(1, OFFSET_TIER3_BITS); // 4416
  const MAX_LENGTH_EXTRA = 276; // largest addend from the 8-bit length tier

  function writeOffset(writer, offset) {
    if (offset <= OFFSET_TIER1_MAX) {
      writer.writeBits(0, 2);
      writer.writeBits(offset - 1, OFFSET_TIER1_BITS);
    } else if (offset <= OFFSET_TIER2_MAX) {
      writer.writeBits(1, 2);
      writer.writeBits(offset - OFFSET_TIER1_MAX - 1, OFFSET_TIER2_BITS);
    } else {
      writer.writeBits(2, 2);
      writer.writeBits(offset - OFFSET_TIER2_MAX - 1, OFFSET_TIER3_BITS);
    }
  }

  function readOffset(reader) {
    const tier = reader.readBits(2);
    if (tier === 0) return reader.readBits(OFFSET_TIER1_BITS) + 1;
    if (tier === 1) return reader.readBits(OFFSET_TIER2_BITS) + OFFSET_TIER1_MAX + 1;
    if (tier === 2) return reader.readBits(OFFSET_TIER3_BITS) + OFFSET_TIER2_MAX + 1;
    throw new Error('DoubleSpace: invalid offset tier');
  }

  function writeLength(writer, extra) {
    // extra = matchLength - MIN_MATCH, always >= 0
    // Prefix bits are written one at a time (in reading order) since the
    // decoder inspects them individually to select the branch.
    if (extra === 0) {
      writer.writeBits(0, 1);
    } else if (extra <= 4) {
      writer.writeBits(1, 1);
      writer.writeBits(0, 1);
      writer.writeBits(extra - 1, 2);
    } else if (extra <= 20) {
      writer.writeBits(1, 1);
      writer.writeBits(1, 1);
      writer.writeBits(0, 1);
      writer.writeBits(extra - 5, 4);
    } else {
      writer.writeBits(1, 1);
      writer.writeBits(1, 1);
      writer.writeBits(1, 1);
      writer.writeBits(extra - 21, 8);
    }
  }

  function readLength(reader) {
    if (reader.readBits(1) === 0) return 0;
    if (reader.readBits(1) === 0) return reader.readBits(2) + 1;
    if (reader.readBits(1) === 0) return reader.readBits(4) + 5;
    return reader.readBits(8) + 21;
  }

  function svdcCompress(input, minMatch) {
    const maxMatch = minMatch + MAX_LENGTH_EXTRA;
    const out = [];
    const len32 = OpCodes.ToUint32(input.length);
    out.push(OpCodes.AndN(len32, 0xFF));
    out.push(OpCodes.AndN(OpCodes.Shr32(len32, 8), 0xFF));
    out.push(OpCodes.AndN(OpCodes.Shr32(len32, 16), 0xFF));
    out.push(OpCodes.AndN(OpCodes.Shr32(len32, 24), 0xFF));

    const writer = new SvdcBitWriter();
    let pos = 0;
    const n = input.length;

    while (pos < n) {
      let bestLen = 0, bestOffset = 0;
      const searchStart = Math.max(0, pos - OFFSET_TIER3_MAX);
      const maxLen = Math.min(maxMatch, n - pos);

      if (maxLen >= minMatch) {
        for (let s = pos - 1; s >= searchStart; --s) {
          let l = 0;
          while (l < maxLen && input[s + l] === input[pos + l]) ++l;
          if (l > bestLen) {
            bestLen = l;
            bestOffset = pos - s;
            if (bestLen === maxLen) break;
          }
        }
      }

      if (bestLen >= minMatch) {
        writer.writeBits(1, 1);
        writeOffset(writer, bestOffset);
        writeLength(writer, bestLen - minMatch);
        pos += bestLen;
      } else {
        writer.writeBits(0, 1);
        writer.writeBits(input[pos], 8);
        pos += 1;
      }
    }

    const body = writer.flush();
    for (let i = 0; i < body.length; ++i) out.push(body[i]);
    return out;
  }

  function svdcDecompress(input, minMatch) {
    if (input.length < 4) return [];
    const originalLength = OpCodes.OrN(
      OpCodes.OrN(OpCodes.OrN(input[0], OpCodes.Shl32(input[1], 8)), OpCodes.Shl32(input[2], 16)),
      OpCodes.Shl32(input[3], 24)
    );

    const output = [];
    if (originalLength === 0) return output;

    const reader = new SvdcBitReader(input, 4);

    while (output.length < originalLength) {
      const flag = reader.readBits(1);
      if (flag === 0) {
        output.push(reader.readBits(8));
      } else {
        const offset = readOffset(reader);
        const extra = readLength(reader);
        const length = minMatch + extra;
        let src = output.length - offset;
        if (src < 0) throw new Error('DoubleSpace: invalid back-reference offset');
        for (let i = 0; i < length; ++i) {
          output.push(output[src + i]);
        }
      }
    }

    return output;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  const DS_MIN_MATCH = 2;

  class DoubleSpaceCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "DoubleSpace";
      this.description = "MS-DOS 6.0/6.2 real-time disk compression codec (DBLSPACE.BIN, SVDC cluster format). Sliding-window LZ77 with a tiered fixed-width offset field and a static prefix code for match lengths; minimum match length 2 bytes. Documented-subset reimplementation - no official bitstream spec exists.";
      this.inventor = "Microsoft Corporation";
      this.year = 1993;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("Microsoft TechNet Archive - What is DoubleSpace and How Does It Work?", "https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10)"),
        new LinkItem("Wikipedia - DriveSpace", "https://en.wikipedia.org/wiki/DriveSpace")
      ];

      this.references = [
        new LinkItem("Stac Electronics, Inc. v. Microsoft Corp., 38 F.3d 1126 (Fed. Cir. 1994)", "https://en.wikipedia.org/wiki/Stac_Electronics_v._Microsoft_Corporation"),
        new LinkItem("Storer and Szymanski, Data compression via textual substitution, 1982", "https://dl.acm.org/doi/10.1145/322344.322346")
      ];

      this.tests = [
        {
          text: "Empty input",
          uri: "https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10)",
          input: [],
          expected: [0, 0, 0, 0]
        },
        {
          text: "Repeated byte run",
          uri: "https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10)",
          input: [97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97],
          expected: [32,0,0,0,194,2,28,1]
        },
        {
          text: "Mixed literal/match text",
          uri: "https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10)",
          input: [116,104,101,32,113,117,105,99,107,32,98,114,111,119,110,32,102,111,120,32,116,104,101,32,113,117,105,99,107,32,98,114,111,119,110,32,102,111,120],
          expected: [39,0,0,0,232,160,41,3,34,78,157,52,99,214,128,16,35,231,205,29,55,32,204,188,193,3,146,105,12]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DoubleSpaceInstance(this, isInverse);
    }
  }

  class DoubleSpaceInstance extends IAlgorithmInstance {
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
      const data = this.inputBuffer;
      this.inputBuffer = [];
      if (this.isInverse) return svdcDecompress(data, DS_MIN_MATCH);
      return svdcCompress(data, DS_MIN_MATCH);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DoubleSpaceCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DoubleSpaceCompression, DoubleSpaceInstance };
}));
