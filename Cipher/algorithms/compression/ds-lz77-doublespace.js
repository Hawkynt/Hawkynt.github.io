/*
 * DS LZ77 - Microsoft DoubleSpace/DriveSpace LZ77 grammar as a standalone
 * building block
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * "DS" here stands for DoubleSpace/DriveSpace, the real-time disk compression
 * drivers shipped with MS-DOS 6.x and Windows 95. This is NOT the Nintendo
 * GBA/NDS BIOS LZSS variant that is also abbreviated "DS-LZ77" (see
 * ds-lz77.js); the two formats are unrelated and share only the abbreviation.
 *
 * DS LZ77 is the effort-0 (greedy, 4 KiB window) parse of the DoubleSpace
 * token grammar, exposed on its own so it can be benchmarked and reused
 * independently of the DoubleSpace and DriveSpace container codecs. The token
 * stream is a 4-byte little-endian original-size header followed by LSB-first
 * tokens:
 *   - literal: flag bit 0, then 8 bits of raw byte value
 *   - match:   flag bit 1, then a 2-bit length class (00=2, 01=3, 10=4,
 *              11=extended: 6 more bits, and if those are all ones a further
 *              8 bits added to a base of 68, capping length at 323), then a
 *              2-bit distance class selecting one of four fixed-width offset
 *              tiers (6 bits for 1..64, 8 bits for 65..320, 12 bits for
 *              321..4416, 13 bits for 4417..12608).
 * The 4 KiB search window means the widest distance tier is never emitted at
 * the default settings; the DriveSpace 8 KiB variant reaches into it.
 *
 * Microsoft never published a bitstream specification - TechNet describes the
 * driver behaviour and the MRCI hardware API, not the codec bit layout - so
 * this is a documented-subset, from-scratch implementation built to the
 * parameters described in secondary sources, not a byte-exact clone of
 * DBLSPACE.BIN. No cluster/sector container framing is implemented: this is a
 * building block only.
 *
 * References:
 * - Microsoft TechNet Archive, "What is DoubleSpace and How Does It Work?"
 * - Storer and Szymanski, "Data compression via textual substitution", 1982
 *   (LZSS - the flag-bit sliding-window family this belongs to)
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

  if (!AlgorithmFramework)
    throw new Error('AlgorithmFramework dependency is required');

  if (!OpCodes)
    throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== BIT STREAM HELPERS (LSB-first) =====

  class DsBitWriter {
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

  class DsBitReader {
    constructor(bytes, start) {
      this.bytes = bytes;
      this.pos = start;
      this.buf = 0;
      this.nBits = 0;
    }

    readBits(width) {
      while (this.nBits < width) {
        if (this.pos >= this.bytes.length) throw new Error('DS LZ77: unexpected end of stream');
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

  // ===== TOKEN GRAMMAR =====

  const MIN_MATCH = 2;
  const MAX_MATCH = 323;          // 68 base + 255 from the widest length extension
  const MAX_DISTANCE = 4096;      // DoubleSpace 4 KiB sliding window
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
    return 68 + reader.readBits(8);
  }

  function writeDistance(writer, distance) {
    for (let cls = 0; cls < DISTANCE_CLASSES.length; ++cls) {
      const entry = DISTANCE_CLASSES[cls];
      if (distance <= entry.max) {
        writer.writeBits(cls, 2);
        writer.writeBits(distance - entry.base, entry.bits);
        return;
      }
    }
    throw new Error('DS LZ77: distance exceeds maximum class range');
  }

  function readDistance(reader) {
    const entry = DISTANCE_CLASSES[reader.readBits(2)];
    return entry.base + reader.readBits(entry.bits);
  }

  function hash2(input, pos) {
    return OpCodes.AndN(OpCodes.XorN(OpCodes.Shl32(input[pos], 6), input[pos + 1]), HASH_MASK);
  }

  function findBestMatch(input, pos, n, maxDistance, hashHead, hashNext) {
    if (pos + MIN_MATCH > n) return { length: 0, offset: 0 };

    let bestLen = 0;
    let bestOff = 0;
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

  function dsCompress(input, maxDistance) {
    const n = input.length;
    const out = [];

    // 4-byte little-endian original-size header.
    const len32 = OpCodes.ToUint32(n);
    out.push(OpCodes.AndN(len32, 0xFF));
    out.push(OpCodes.AndN(OpCodes.Shr32(len32, 8), 0xFF));
    out.push(OpCodes.AndN(OpCodes.Shr32(len32, 16), 0xFF));
    out.push(OpCodes.AndN(OpCodes.Shr32(len32, 24), 0xFF));

    if (n === 0) return out;

    const writer = new DsBitWriter();
    const hashHead = new Int32Array(HASH_SIZE).fill(-1);
    const hashNext = new Int32Array(n).fill(-1);

    let pos = 0;
    while (pos < n) {
      // Insert the current position before matching, so skipped-over positions
      // inside a match can be updated with the same operation.
      if (pos + 1 < n) {
        const h = hash2(input, pos);
        hashNext[pos] = hashHead[h];
        hashHead[h] = pos;
      }

      const best = findBestMatch(input, pos, n, maxDistance, hashHead, hashNext);

      if (best.length >= MIN_MATCH) {
        writer.writeBits(1, 1);
        writeLength(writer, best.length);
        writeDistance(writer, best.offset);

        for (let j = 1; j < best.length && pos + j + 1 < n; ++j) {
          const h = hash2(input, pos + j);
          hashNext[pos + j] = hashHead[h];
          hashHead[h] = pos + j;
        }
        pos += best.length;
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

  function dsDecompress(input) {
    if (input.length < 4) return [];

    const originalLength = OpCodes.ToUint32(
      OpCodes.OrN(
        OpCodes.OrN(OpCodes.OrN(input[0], OpCodes.Shl32(input[1], 8)), OpCodes.Shl32(input[2], 16)),
        OpCodes.Shl32(input[3], 24)
      )
    );

    const output = [];
    if (originalLength === 0) return output;

    const reader = new DsBitReader(input, 4);

    while (output.length < originalLength) {
      const flag = reader.readBits(1);
      if (flag === 0) {
        output.push(reader.readBits(8));
        continue;
      }

      const length = readLength(reader);
      const distance = readDistance(reader);
      if (distance < 1 || distance > output.length)
        throw new Error('DS LZ77: invalid back-reference distance');

      const src = output.length - distance;
      for (let i = 0; i < length; ++i) output.push(output[src + i]);
    }

    return output;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class DsLz77Compression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "DS LZ77";
      this.description = "Microsoft DoubleSpace/DriveSpace LZ77 grammar as a standalone building block: variable-bit length and distance codes over a 4KB sliding window, minimum match length 2, greedy hash-chain parse, prefixed by a 4-byte little-endian original-size header. Unrelated to the Nintendo GBA/NDS BIOS LZSS variant that shares the DS-LZ77 abbreviation. Documented-subset reimplementation; Microsoft never published a bitstream specification.";
      this.inventor = "Microsoft Corporation";
      this.year = 1993;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("Microsoft TechNet Archive - What is DoubleSpace and How Does It Work?", "https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10)"),
        new LinkItem("Wikipedia - DriveSpace", "https://en.wikipedia.org/wiki/DriveSpace"),
        new LinkItem("Wikipedia - LZ77 and LZ78", "https://en.wikipedia.org/wiki/LZ77_and_LZ78")
      ];

      this.references = [
        new LinkItem("Storer and Szymanski, Data compression via textual substitution, 1982", "https://dl.acm.org/doi/10.1145/322344.322346"),
        new LinkItem("Stac Electronics, Inc. v. Microsoft Corp. (1994)", "https://en.wikipedia.org/wiki/Stac_Electronics_v._Microsoft_Corporation"),
        new LinkItem("Wikipedia - Nintendo DS/GBA BIOS LZSS, the unrelated format sharing the DS-LZ77 name", "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Storer%E2%80%93Szymanski")
      ];

      // Test vectors cross-checked byte-for-byte against CompressionWorkbench's
      // BB_DsLz77 reference implementation (effort 0, 4 KiB window).
      this.tests = [
        new TestCase(
          [],
          [0x00, 0x00, 0x00, 0x00],
          "Empty input - size header only",
          "https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10)"
        ),
        new TestCase(
          [0x41],
          [0x01, 0x00, 0x00, 0x00, 0x82, 0x00],
          "Single byte - one literal token",
          "https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10)"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. ".repeat(4)),
          [
            0xb4, 0x00, 0x00, 0x00, 0xe8, 0xa0, 0x29, 0x03, 0x22, 0x4e, 0x9d, 0x34, 0x63, 0xd6, 0x80, 0x10,
            0x23, 0xe7, 0xcd, 0x1d, 0x37, 0x20, 0xcc, 0xbc, 0xc1, 0x03, 0x42, 0x4d, 0x9d, 0x36, 0x70, 0xe6,
            0x80, 0x78, 0x63, 0xa7, 0x8c, 0x1c, 0x90, 0xe2, 0x61, 0x13, 0x46, 0x4f, 0x1e, 0x10, 0x64, 0xde,
            0x9c, 0x71, 0x39, 0x40, 0xf3, 0xff, 0x07, 0x16
          ],
          "Text sample repeated 4x",
          "https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10)"
        ),
        new TestCase(
          new Array(256).fill(0x61),
          [0x00, 0x01, 0x00, 0x00, 0xc2, 0xfe, 0xef, 0x02, 0x00],
          "Long repetitive run - 256 identical bytes",
          "https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10)"
        ),
        new TestCase(
          [0x41, 0x42, 0x41, 0x42, 0x41, 0x42, 0x41, 0x42, 0x41, 0x42, 0x41, 0x42],
          [0x0c, 0x00, 0x00, 0x00, 0x82, 0x08, 0xbd, 0x20, 0x00],
          "Alternating two-byte pattern - ABABABABABAB",
          "https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10)"
        ),
        new TestCase(
          [
            0x9e, 0x1f, 0xd2, 0x4b, 0x6a, 0x0c, 0xf7, 0x83, 0x21, 0x55, 0xbe, 0x08, 0x3d, 0xc4, 0x71, 0xaa,
            0x9e, 0x1f, 0xd2, 0x4b, 0x6a, 0x0c, 0xf7, 0x83, 0x11, 0x62, 0xef, 0x90, 0x4d, 0x7c, 0x38, 0xa1
          ],
          [
            0x20, 0x00, 0x00, 0x00, 0x3c, 0x7d, 0x90, 0xb6, 0x44, 0x0d, 0x83, 0x7b, 0x83, 0x42, 0x54, 0xf1,
            0x85, 0xa0, 0x07, 0xb1, 0x38, 0xaa, 0x1f, 0x78, 0x44, 0x10, 0xf3, 0x0e, 0x52, 0x13, 0x3e, 0x38,
            0x42, 0x01
          ],
          "Pseudo-random binary sample with one repeated run",
          "https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10)"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("Optimal parsing minimises the total token cost, not the local match length."),
          [
            0x4b, 0x00, 0x00, 0x00, 0x9e, 0xc0, 0xa1, 0x93, 0xa6, 0x4d, 0x18, 0x36, 0x20, 0xe0, 0x84, 0x91,
            0x33, 0x27, 0x8d, 0x9b, 0x33, 0x20, 0xda, 0x02, 0x11, 0x1e, 0x69, 0xe6, 0x94, 0x99, 0x03, 0x82,
            0x0e, 0x9a, 0xb2, 0x30, 0x78, 0x43, 0x37, 0xb6, 0x50, 0x58, 0x53, 0xc6, 0x0d, 0x88, 0x31, 0x6f,
            0xe6, 0xd0, 0x61, 0x01, 0xc2, 0x2d, 0x44, 0x07, 0xc8, 0xb0, 0x79, 0x33, 0x36, 0xb2, 0x90, 0xa3,
            0x33, 0x06, 0x2d, 0x2c, 0xa1, 0x73, 0x16, 0x26, 0x2e
          ],
          "English text with short interior repeats",
          "https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10)"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new DsLz77Instance(this, isInverse);
    }
  }

  class DsLz77Instance extends IAlgorithmInstance {
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
      if (this.isInverse) return dsDecompress(data);
      return dsCompress(data, MAX_DISTANCE);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DsLz77Compression();
  if (!AlgorithmFramework.Find(algorithmInstance.name))
    RegisterAlgorithm(algorithmInstance);

  // ===== EXPORTS =====

  return { DsLz77Compression, DsLz77Instance };
}));
