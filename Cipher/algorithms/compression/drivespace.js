/*
 * DriveSpace (JM) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * DriveSpace was the real-time disk-compression driver (DRVSPACE.BIN) shipped
 * with MS-DOS 6.21/6.22, replacing DoubleSpace after Stac Electronics, Inc. v.
 * Microsoft Corp. (1994) found DoubleSpace's "SVDC" codec too close to Stac's
 * patented LZS algorithm. Microsoft redesigned the software fallback path
 * (its on-disk cluster tag is "JM") specifically to route around that ruling.
 * No official bitstream specification was ever published - Microsoft's own
 * TechNet material documents the driver's behavior and MRCI hardware-
 * acceleration API only, not the codec bit layout.
 *
 * This is a documented-subset, from-scratch reimplementation sharing the same
 * token grammar as DoubleSpace (see doublespace.js): a per-token literal/match
 * flag, a 2-bit length class (with 6/8-bit extensions), and a 2-bit distance
 * class selecting one of four fixed-width offset tiers, minimum match length
 * 2 bytes. DriveSpace differs from DoubleSpace only in its sliding-window
 * size - 8KB instead of 4KB, which lets the widest (13-bit) distance tier
 * come into play. It is a self-consistent LZ77 coder, not a byte-exact clone
 * of DRVSPACE.BIN's cluster format, and does not implement any cluster/sector
 * container framing (out of scope: building blocks only).
 *
 * References:
 * - Microsoft TechNet Archive, "What is DoubleSpace and How Does It Work?"
 *   https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10)
 * - Wikipedia, "DriveSpace"
 *   https://en.wikipedia.org/wiki/DriveSpace
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

  class JmBitWriter {
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

  class JmBitReader {
    constructor(bytes, start) {
      this.bytes = bytes;
      this.pos = start;
      this.buf = 0;
      this.nBits = 0;
    }

    readBits(width) {
      while (this.nBits < width) {
        if (this.pos >= this.bytes.length) throw new Error('DriveSpace: unexpected end of stream');
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

  // ===== SLIDING-WINDOW LZ CODEC (see doublespace.js for the DS sibling) =====
  // Both variants share the same token grammar and MIN_MATCH=2; only the
  // sliding-window search cap differs (DoubleSpace 4KB, DriveSpace 8KB).

  const MIN_MATCH = 2;
  const MAX_MATCH = 323;          // 68 base + 255 from the widest length extension
  const HASH_BITS = 14;
  const HASH_SIZE = OpCodes.Shl32(1, HASH_BITS);
  const HASH_MASK = HASH_SIZE - 1;
  const MAX_CHAIN_LENGTH = 128;

  // Distance class layout: {bits, base, max}. A distance is placed in the
  // lowest class whose range covers it.
  const DISTANCE_CLASSES = [
    { bits: 6, base: 1, max: 64 },
    { bits: 8, base: 65, max: 320 },
    { bits: 12, base: 321, max: 4416 },
    { bits: 13, base: 4417, max: 12608 }
  ];

  function writeLength(writer, length) {
    // length in [MIN_MATCH, MAX_MATCH]
    if (length === 2) { writer.writeBits(0, 2); return; }
    if (length === 3) { writer.writeBits(1, 2); return; }
    if (length === 4) { writer.writeBits(2, 2); return; }

    writer.writeBits(3, 2);
    const extended = length - 5;
    if (extended < 63) {
      writer.writeBits(extended, 6);
      return;
    }
    writer.writeBits(63, 6);
    writer.writeBits(length - 68, 8);
  }

  function readLength(reader) {
    const code = reader.readBits(2);
    if (code < 3) return code + 2;
    const extended = reader.readBits(6);
    if (extended < 63) return 5 + extended;
    const tail = reader.readBits(8);
    return 68 + tail;
  }

  function writeDistance(writer, distance) {
    for (let cls = 0; cls < DISTANCE_CLASSES.length; ++cls) {
      const { bits, base, max } = DISTANCE_CLASSES[cls];
      if (distance <= max) {
        writer.writeBits(cls, 2);
        writer.writeBits(distance - base, bits);
        return;
      }
    }
    throw new Error('DriveSpace: distance exceeds maximum class range');
  }

  function readDistance(reader) {
    const cls = reader.readBits(2);
    const { bits, base } = DISTANCE_CLASSES[cls];
    return base + reader.readBits(bits);
  }

  function hash2(input, pos) {
    return OpCodes.AndN(OpCodes.XorN(OpCodes.Shl32(input[pos], 6), input[pos + 1]), HASH_MASK);
  }

  function findBestMatch(input, pos, n, maxDistance, hashHead, hashNext) {
    if (pos + MIN_MATCH > n) return { length: 0, offset: 0 };

    let bestLen = 0, bestOff = 0;
    const minPos = Math.max(0, pos - maxDistance);
    let idx = hashNext[pos];
    let chainLen = 0;
    const maxLen = Math.min(n - pos, MAX_MATCH);

    while (idx >= minPos && idx < pos && chainLen < MAX_CHAIN_LENGTH) {
      if (input[idx] === input[pos] && input[idx + 1] === input[pos + 1]) {
        let l = 2;
        while (l < maxLen && input[idx + l] === input[pos + l]) ++l;
        if (l > bestLen) {
          bestLen = l;
          bestOff = pos - idx;
          if (bestLen >= maxLen) break;
        }
      }
      idx = hashNext[idx];
      ++chainLen;
    }
    return { length: bestLen, offset: bestOff };
  }

  function jmCompress(input, maxDistance) {
    const n = input.length;
    const out = [];
    const len32 = OpCodes.ToUint32(n);
    out.push(OpCodes.AndN(len32, 0xFF));
    out.push(OpCodes.AndN(OpCodes.Shr32(len32, 8), 0xFF));
    out.push(OpCodes.AndN(OpCodes.Shr32(len32, 16), 0xFF));
    out.push(OpCodes.AndN(OpCodes.Shr32(len32, 24), 0xFF));

    if (n === 0) return out;

    const writer = new JmBitWriter();
    const hashHead = new Array(HASH_SIZE).fill(-1);
    const hashNext = new Array(n).fill(-1);

    let pos = 0;
    while (pos < n) {
      if (pos + 1 < n) {
        const h = hash2(input, pos);
        hashNext[pos] = hashHead[h];
        hashHead[h] = pos;
      }

      const { length: bestLen, offset: bestOff } = findBestMatch(input, pos, n, maxDistance, hashHead, hashNext);

      if (bestLen >= MIN_MATCH) {
        writer.writeBits(1, 1);
        writeLength(writer, bestLen);
        writeDistance(writer, bestOff);

        for (let j = 1; j < bestLen && pos + j + 1 < n; ++j) {
          const h = hash2(input, pos + j);
          hashNext[pos + j] = hashHead[h];
          hashHead[h] = pos + j;
        }
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

  function jmDecompress(input) {
    if (input.length < 4) return [];
    const originalLength = OpCodes.OrN(
      OpCodes.OrN(OpCodes.OrN(input[0], OpCodes.Shl32(input[1], 8)), OpCodes.Shl32(input[2], 16)),
      OpCodes.Shl32(input[3], 24)
    );

    const output = [];
    if (originalLength === 0) return output;

    const reader = new JmBitReader(input, 4);

    while (output.length < originalLength) {
      const flag = reader.readBits(1);
      if (flag === 0) {
        output.push(reader.readBits(8));
      } else {
        const length = readLength(reader);
        const distance = readDistance(reader);
        if (distance < 1 || distance > output.length) throw new Error('DriveSpace: invalid back-reference distance');
        const src = output.length - distance;
        for (let i = 0; i < length; ++i) {
          output.push(output[src + i]);
        }
      }
    }

    return output;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  const JM_MAX_DISTANCE = 8192;

  class DriveSpaceCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "DriveSpace";
      this.description = "MS-DOS 6.21/6.22 real-time disk compression codec (DRVSPACE.BIN, JM cluster format). Sliding-window LZ77 sharing DoubleSpace's token grammar with an 8KB window; minimum match length 2 bytes. Documented-subset reimplementation - no official bitstream spec exists.";
      this.inventor = "Microsoft Corporation";
      this.year = 1993;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("Wikipedia - DriveSpace", "https://en.wikipedia.org/wiki/DriveSpace"),
        new LinkItem("Microsoft TechNet Archive - What is DoubleSpace and How Does It Work?", "https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10)")
      ];

      this.references = [
        new LinkItem("Stac Electronics, Inc. v. Microsoft Corp., 38 F.3d 1126 (Fed. Cir. 1994)", "https://en.wikipedia.org/wiki/Stac_Electronics_v._Microsoft_Corporation"),
        new LinkItem("Storer and Szymanski, Data compression via textual substitution, 1982", "https://dl.acm.org/doi/10.1145/322344.322346")
      ];

      this.tests = [
        {
          text: "Empty input",
          uri: "https://en.wikipedia.org/wiki/DriveSpace",
          input: [],
          expected: [0, 0, 0, 0]
        },
        {
          text: "Single byte",
          uri: "https://en.wikipedia.org/wiki/DriveSpace",
          input: [0x41],
          expected: [1, 0, 0, 0, 130, 0]
        },
        {
          text: "Text sample repeated 4x",
          uri: "https://en.wikipedia.org/wiki/DriveSpace",
          input: OpCodes.AsciiToBytes("the quick brown fox jumps over the lazy dog. ".repeat(4)),
          expected: [180, 0, 0, 0, 232, 160, 41, 3, 34, 78, 157, 52, 99, 214, 128, 16, 35, 231, 205, 29, 55, 32, 204, 188, 193, 3, 66, 77, 157, 54, 112, 230, 128, 120, 99, 167, 140, 28, 144, 226, 97, 19, 70, 79, 30, 16, 100, 222, 156, 113, 57, 64, 243, 255, 7, 22]
        },
        {
          text: "256 repeated bytes",
          uri: "https://en.wikipedia.org/wiki/DriveSpace",
          input: new Array(256).fill(0x61),
          expected: [0, 1, 0, 0, 194, 254, 239, 2, 0]
        },
        {
          text: "All 256 byte values",
          uri: "https://en.wikipedia.org/wiki/DriveSpace",
          input: Array.from({ length: 256 }, (_, i) => i),
          expected: [0, 1, 0, 0, 0, 4, 16, 48, 128, 64, 1, 3, 7, 16, 36, 80, 176, 128, 65, 3, 7, 15, 32, 68, 144, 48, 129, 66, 5, 11, 23, 48, 100, 208, 176, 129, 67, 7, 15, 31, 64, 132, 16, 49, 130, 68, 9, 19, 39, 80, 164, 80, 177, 130, 69, 11, 23, 47, 96, 196, 144, 49, 131, 70, 13, 27, 55, 112, 228, 208, 177, 131, 71, 15, 31, 63, 128, 4, 17, 50, 132, 72, 17, 35, 71, 144, 36, 81, 178, 132, 73, 19, 39, 79, 160, 68, 145, 50, 133, 74, 21, 43, 87, 176, 100, 209, 178, 133, 75, 23, 47, 95, 192, 132, 17, 51, 134, 76, 25, 51, 103, 208, 164, 81, 179, 134, 77, 27, 55, 111, 224, 196, 145, 51, 135, 78, 29, 59, 119, 240, 228, 209, 179, 135, 79, 31, 63, 127, 0, 5, 18, 52, 136, 80, 33, 67, 135, 16, 37, 82, 180, 136, 81, 35, 71, 143, 32, 69, 146, 52, 137, 82, 37, 75, 151, 48, 101, 210, 180, 137, 83, 39, 79, 159, 64, 133, 18, 53, 138, 84, 41, 83, 167, 80, 165, 82, 181, 138, 85, 43, 87, 175, 96, 197, 146, 53, 139, 86, 45, 91, 183, 112, 229, 210, 181, 139, 87, 47, 95, 191, 128, 5, 19, 54, 140, 88, 49, 99, 199, 144, 37, 83, 182, 140, 89, 51, 103, 207, 160, 69, 147, 54, 141, 90, 53, 107, 215, 176, 101, 211, 182, 141, 91, 55, 111, 223, 192, 133, 19, 55, 142, 92, 57, 115, 231, 208, 165, 83, 183, 142, 93, 59, 119, 239, 224, 197, 147, 55, 143, 94, 61, 123, 247, 240, 229, 211, 183, 143, 95, 63, 127, 255]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DriveSpaceInstance(this, isInverse);
    }
  }

  class DriveSpaceInstance extends IAlgorithmInstance {
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
      if (this.isInverse) return jmDecompress(data);
      return jmCompress(data, JM_MAX_DISTANCE);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DriveSpaceCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DriveSpaceCompression, DriveSpaceInstance };
}));
