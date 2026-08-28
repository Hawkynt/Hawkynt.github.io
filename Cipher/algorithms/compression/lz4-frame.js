/*
 * LZ4 Frame Format Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The LZ4 frame format is the interchange container around LZ4 compressed
 * blocks: a 4-byte magic number (0x184D2204, little-endian), a frame
 * descriptor (FLG/BD bytes, optional 8-byte content size, header checksum
 * byte), a sequence of length-prefixed blocks, a zero end-mark and an optional
 * 4-byte content checksum. Both checksums are xxHash32 values; the header
 * checksum is the second byte of the digest of the descriptor bytes.
 *
 * This is distinct from the raw LZ4 *block* format (see lz4.js), which carries
 * no magic, no framing and no checksums. Blocks here are emitted at the 4 MB
 * maximum-block-size setting, block-independent, with the content size and the
 * content checksum both present; a block whose compressed form is not smaller
 * than its input is stored uncompressed and flagged by the high bit of the
 * block size field.
 *
 * References:
 * - LZ4 Frame Format Description
 *   https://github.com/lz4/lz4/blob/dev/doc/lz4_Frame_format.md
 * - LZ4 Block Format Description
 *   https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md
 * - xxHash32 specification
 *   https://github.com/Cyan4973/xxHash/blob/dev/doc/xxhash_spec.md
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

  if (!AlgorithmFramework)
    throw new Error('AlgorithmFramework dependency is required');

  if (!OpCodes)
    throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== xxHash32 (https://github.com/Cyan4973/xxHash/blob/dev/doc/xxhash_spec.md) =====

  const XXH_PRIME1 = 0x9E3779B1;
  const XXH_PRIME2 = 0x85EBCA77;
  const XXH_PRIME3 = 0xC2B2AE3D;
  const XXH_PRIME4 = 0x27D4EB2F;
  const XXH_PRIME5 = 0x165667B1;

  function readU32LE(data, offset) {
    return OpCodes.ToUint32(
      OpCodes.OrN(
        OpCodes.OrN(
          OpCodes.OrN(data[offset], OpCodes.Shl32(data[offset + 1], 8)),
          OpCodes.Shl32(data[offset + 2], 16)
        ),
        OpCodes.Shl32(data[offset + 3], 24)
      )
    );
  }

  function xxhRound(acc, input) {
    acc = OpCodes.ToUint32(acc + OpCodes.Mul32(input, XXH_PRIME2));
    acc = OpCodes.RotL32(acc, 13);
    return OpCodes.Mul32(acc, XXH_PRIME1);
  }

  function xxhAvalanche(hash) {
    hash = OpCodes.Xor32(hash, OpCodes.Shr32(hash, 15));
    hash = OpCodes.Mul32(hash, XXH_PRIME2);
    hash = OpCodes.Xor32(hash, OpCodes.Shr32(hash, 13));
    hash = OpCodes.Mul32(hash, XXH_PRIME3);
    hash = OpCodes.Xor32(hash, OpCodes.Shr32(hash, 16));
    return OpCodes.ToUint32(hash);
  }

  function xxhFinalizeTail(hash, data, offset, end) {
    let pos = offset;
    while (pos + 4 <= end) {
      hash = OpCodes.ToUint32(hash + OpCodes.Mul32(readU32LE(data, pos), XXH_PRIME3));
      hash = OpCodes.Mul32(OpCodes.RotL32(hash, 17), XXH_PRIME4);
      pos += 4;
    }
    while (pos < end) {
      hash = OpCodes.ToUint32(hash + OpCodes.Mul32(data[pos], XXH_PRIME5));
      hash = OpCodes.Mul32(OpCodes.RotL32(hash, 11), XXH_PRIME1);
      ++pos;
    }
    return xxhAvalanche(hash);
  }

  function xxHash32(data, offset, end) {
    const length = end - offset;
    if (length < 16)
      return xxhFinalizeTail(OpCodes.ToUint32(XXH_PRIME5 + length), data, offset, end);

    let v1 = OpCodes.ToUint32(XXH_PRIME1 + XXH_PRIME2);
    let v2 = OpCodes.ToUint32(XXH_PRIME2);
    let v3 = 0;
    let v4 = OpCodes.ToUint32(-XXH_PRIME1);

    let pos = offset;
    while (pos + 16 <= end) {
      v1 = xxhRound(v1, readU32LE(data, pos));
      v2 = xxhRound(v2, readU32LE(data, pos + 4));
      v3 = xxhRound(v3, readU32LE(data, pos + 8));
      v4 = xxhRound(v4, readU32LE(data, pos + 12));
      pos += 16;
    }

    let hash = OpCodes.ToUint32(
      OpCodes.RotL32(v1, 1) + OpCodes.RotL32(v2, 7) + OpCodes.RotL32(v3, 12) + OpCodes.RotL32(v4, 18)
    );
    hash = OpCodes.ToUint32(hash + length);
    return xxhFinalizeTail(hash, data, pos, end);
  }

  // ===== LZ4 BLOCK CODEC (https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md) =====

  const MIN_MATCH = 4;
  const RUN_MASK = 15;
  const MAX_DISTANCE = 65535;
  const HASH_LOG = 16;
  const HASH_SIZE_U32 = 65536;
  const LAST_LITERALS = 5;
  const MF_LIMIT = 12;

  function blockHash(data, pos) {
    const value = readU32LE(data, pos);
    return OpCodes.Shr32(OpCodes.Mul32(value, 2654435761), 32 - HASH_LOG);
  }

  function emitSequence(output, input, literalStart, literalCount, offset, matchLength) {
    const matchCode = matchLength - MIN_MATCH;
    const tokenLit = Math.min(literalCount, RUN_MASK);
    const tokenMatch = Math.min(matchCode, RUN_MASK);
    output.push(OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(tokenLit, 4), tokenMatch), 0xFF));

    if (literalCount >= RUN_MASK) {
      let remaining = literalCount - RUN_MASK;
      while (remaining >= 255) { output.push(255); remaining -= 255; }
      output.push(OpCodes.AndN(remaining, 0xFF));
    }

    for (let i = 0; i < literalCount; ++i) output.push(input[literalStart + i]);

    output.push(OpCodes.AndN(offset, 0xFF));
    output.push(OpCodes.AndN(OpCodes.Shr32(offset, 8), 0xFF));

    if (matchCode >= RUN_MASK) {
      let remaining = matchCode - RUN_MASK;
      while (remaining >= 255) { output.push(255); remaining -= 255; }
      output.push(OpCodes.AndN(remaining, 0xFF));
    }
  }

  function emitLastLiterals(output, input, literalStart, literalCount) {
    output.push(OpCodes.AndN(OpCodes.Shl32(Math.min(literalCount, RUN_MASK), 4), 0xFF));

    if (literalCount >= RUN_MASK) {
      let remaining = literalCount - RUN_MASK;
      while (remaining >= 255) { output.push(255); remaining -= 255; }
      output.push(OpCodes.AndN(remaining, 0xFF));
    }

    for (let i = 0; i < literalCount; ++i) output.push(input[literalStart + i]);
  }

  function compressBlock(input) {
    const n = input.length;
    const output = [];
    if (n === 0) return output;

    const hashTable = new Int32Array(HASH_SIZE_U32).fill(-1);
    let pos = 0;
    let anchor = 0;

    // No match may start within MF_LIMIT bytes of the end; matches may not
    // extend into the final LAST_LITERALS bytes, which must stay literals.
    const searchLimit = n - MF_LIMIT;
    const matchLimit = n - LAST_LITERALS;

    while (pos < searchLimit) {
      let matchOffset = 0;
      let matchLength = 0;

      const h = blockHash(input, pos);
      const candidate = hashTable[h];
      hashTable[h] = pos;

      if (candidate >= 0 && (pos - candidate) <= MAX_DISTANCE &&
          input[candidate] === input[pos] &&
          input[candidate + 1] === input[pos + 1] &&
          input[candidate + 2] === input[pos + 2] &&
          input[candidate + 3] === input[pos + 3]) {
        matchOffset = pos - candidate;
        matchLength = MIN_MATCH;
        while (pos + matchLength < matchLimit &&
               input[candidate + matchLength] === input[pos + matchLength])
          ++matchLength;
      }

      if (matchLength < MIN_MATCH) { ++pos; continue; }

      emitSequence(output, input, anchor, pos - anchor, matchOffset, matchLength);

      const end = pos + matchLength;
      ++pos;
      while (pos < end && pos + 3 < n) {
        hashTable[blockHash(input, pos)] = pos;
        ++pos;
      }
      pos = end;
      anchor = pos;
    }

    emitLastLiterals(output, input, anchor, n - anchor);
    return output;
  }

  function decompressBlock(input, start, length, output) {
    const end = start + length;
    let ip = start;

    while (ip < end) {
      const token = input[ip++];

      let literalLength = OpCodes.Shr32(token, 4);
      if (literalLength === 15) {
        let extra;
        do {
          if (ip >= end) break;
          extra = input[ip++];
          literalLength += extra;
        } while (extra === 255);
      }

      for (let i = 0; i < literalLength; ++i) {
        if (ip >= end) break;
        output.push(input[ip++]);
      }

      if (ip >= end) break;
      if (ip + 1 >= end) break;

      const offset = OpCodes.OrN(input[ip], OpCodes.Shl32(input[ip + 1], 8));
      ip += 2;

      const matchField = OpCodes.AndN(token, 0x0F);
      let matchLength = matchField + MIN_MATCH;
      if (matchField === 15) {
        let extra;
        do {
          if (ip >= end) break;
          extra = input[ip++];
          matchLength += extra;
        } while (extra === 255);
      }

      const matchPos = output.length - offset;
      if (matchPos < 0) throw new Error('LZ4 Frame: invalid match offset');
      for (let i = 0; i < matchLength; ++i) output.push(output[matchPos + i]);
    }
  }

  // ===== FRAME CODEC =====

  const FRAME_MAGIC = [0x04, 0x22, 0x4D, 0x18];   // 0x184D2204 little-endian
  const BLOCK_MAX_SIZE = 4 * 1024 * 1024;         // BD block-max-size code 7
  const BLOCK_MAX_SIZE_BITS = 7;

  function frameCompress(data) {
    const out = [];

    // ---- frame header ----
    for (let i = 0; i < FRAME_MAGIC.length; ++i) out.push(FRAME_MAGIC[i]);

    // FLG: version 01, block independence, content size present, content checksum.
    const flg = OpCodes.OrN(
      OpCodes.OrN(OpCodes.Shl32(1, 6), OpCodes.Shl32(1, 5)),
      OpCodes.OrN(OpCodes.Shl32(1, 3), OpCodes.Shl32(1, 2))
    );
    out.push(flg);
    out.push(OpCodes.AndN(OpCodes.Shl32(BLOCK_MAX_SIZE_BITS, 4), 0xFF));

    // Content size, 8 bytes little-endian.
    let remaining = data.length;
    for (let i = 0; i < 8; ++i) {
      out.push(OpCodes.AndN(remaining, 0xFF));
      remaining = Math.floor(remaining / 256);
    }

    // Header checksum: second byte of xxHash32 over the descriptor bytes.
    const headerChecksum = xxHash32(out, 4, 14);
    out.push(OpCodes.AndN(OpCodes.Shr32(headerChecksum, 8), 0xFF));

    // ---- data blocks ----
    let offset = 0;
    while (offset < data.length) {
      const blockLength = Math.min(BLOCK_MAX_SIZE, data.length - offset);
      const block = data.slice(offset, offset + blockLength);
      const compressed = compressBlock(block);

      if (compressed.length >= blockLength) {
        // Store uncompressed; the high bit of the size field flags this.
        const header = OpCodes.ToUint32(OpCodes.OrN(blockLength, 0x80000000));
        out.push(OpCodes.AndN(header, 0xFF));
        out.push(OpCodes.AndN(OpCodes.Shr32(header, 8), 0xFF));
        out.push(OpCodes.AndN(OpCodes.Shr32(header, 16), 0xFF));
        out.push(OpCodes.AndN(OpCodes.Shr32(header, 24), 0xFF));
        for (let i = 0; i < blockLength; ++i) out.push(block[i]);
      } else {
        const header = compressed.length;
        out.push(OpCodes.AndN(header, 0xFF));
        out.push(OpCodes.AndN(OpCodes.Shr32(header, 8), 0xFF));
        out.push(OpCodes.AndN(OpCodes.Shr32(header, 16), 0xFF));
        out.push(OpCodes.AndN(OpCodes.Shr32(header, 24), 0xFF));
        for (let i = 0; i < compressed.length; ++i) out.push(compressed[i]);
      }

      offset += blockLength;
    }

    // ---- end mark and content checksum ----
    out.push(0, 0, 0, 0);
    const contentChecksum = xxHash32(data, 0, data.length);
    out.push(OpCodes.AndN(contentChecksum, 0xFF));
    out.push(OpCodes.AndN(OpCodes.Shr32(contentChecksum, 8), 0xFF));
    out.push(OpCodes.AndN(OpCodes.Shr32(contentChecksum, 16), 0xFF));
    out.push(OpCodes.AndN(OpCodes.Shr32(contentChecksum, 24), 0xFF));

    return out;
  }

  function frameDecompress(data) {
    if (data.length < 4) throw new Error('LZ4 Frame: frame too short');
    for (let i = 0; i < FRAME_MAGIC.length; ++i)
      if (data[i] !== FRAME_MAGIC[i]) throw new Error('LZ4 Frame: invalid frame magic');

    let pos = 4;
    if (pos + 2 > data.length) throw new Error('LZ4 Frame: truncated frame header');
    const flg = data[pos++];
    ++pos; // BD byte: block max size only bounds the decode buffer, not needed here

    const contentSizePresent = OpCodes.AndN(OpCodes.Shr32(flg, 3), 1) === 1;
    const contentChecksumPresent = OpCodes.AndN(OpCodes.Shr32(flg, 2), 1) === 1;
    const blockChecksumPresent = OpCodes.AndN(OpCodes.Shr32(flg, 4), 1) === 1;

    if (contentSizePresent) {
      if (pos + 8 > data.length) throw new Error('LZ4 Frame: truncated content size');
      pos += 8;
    }

    if (pos >= data.length) throw new Error('LZ4 Frame: truncated header checksum');
    ++pos; // header checksum byte

    const output = [];
    while (pos + 4 <= data.length) {
      const blockHeader = OpCodes.ToUint32(
        OpCodes.OrN(
          OpCodes.OrN(
            OpCodes.OrN(data[pos], OpCodes.Shl32(data[pos + 1], 8)),
            OpCodes.Shl32(data[pos + 2], 16)
          ),
          OpCodes.Shl32(data[pos + 3], 24)
        )
      );
      pos += 4;

      if (blockHeader === 0) break; // end mark

      const isUncompressed = OpCodes.AndN(blockHeader, 0x80000000) !== 0;
      const dataSize = OpCodes.AndN(blockHeader, 0x7FFFFFFF);

      if (pos + dataSize > data.length) throw new Error('LZ4 Frame: truncated block data');

      if (isUncompressed)
        for (let i = 0; i < dataSize; ++i) output.push(data[pos + i]);
      else
        decompressBlock(data, pos, dataSize, output);

      pos += dataSize;
      if (blockChecksumPresent) pos += 4;
    }

    if (contentChecksumPresent && pos + 4 <= data.length) {
      const expected = OpCodes.ToUint32(
        OpCodes.OrN(
          OpCodes.OrN(
            OpCodes.OrN(data[pos], OpCodes.Shl32(data[pos + 1], 8)),
            OpCodes.Shl32(data[pos + 2], 16)
          ),
          OpCodes.Shl32(data[pos + 3], 24)
        )
      );
      if (expected !== xxHash32(output, 0, output.length))
        throw new Error('LZ4 Frame: content checksum mismatch');
    }

    return output;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class LZ4FrameCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "LZ4 Frame";
      this.description = "LZ4 frame format with content size, checksums and multi-block support. Wraps LZ4 compressed blocks in the interchange container defined by the LZ4 frame specification: magic number 0x184D2204, a frame descriptor with FLG/BD bytes and an xxHash32-derived header checksum byte, length-prefixed independent blocks (4MB maximum, stored verbatim when compression does not help), a zero end-mark and a trailing xxHash32 content checksum.";
      this.inventor = "Yann Collet";
      this.year = 2013;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.FR;

      this.documentation = [
        new LinkItem("LZ4 Frame Format Description", "https://github.com/lz4/lz4/blob/dev/doc/lz4_Frame_format.md"),
        new LinkItem("LZ4 Block Format Description", "https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md"),
        new LinkItem("LZ4 Official Website", "https://lz4.org/")
      ];

      this.references = [
        new LinkItem("Official LZ4 Implementation", "https://github.com/lz4/lz4"),
        new LinkItem("xxHash Specification", "https://github.com/Cyan4973/xxHash/blob/dev/doc/xxhash_spec.md"),
        new LinkItem("RFC 8878 - Zstandard (uses the same xxHash32 checksum family)", "https://www.rfc-editor.org/rfc/rfc8878")
      ];

      // Test vectors cross-checked byte-for-byte against CompressionWorkbench's
      // BB_Lz4Frame reference implementation.
      this.tests = [
        new TestCase(
          [],
          [
            0x04, 0x22, 0x4d, 0x18, 0x6c, 0x70, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x00,
            0x00, 0x00, 0x00, 0x05, 0x5d, 0xcc, 0x02
          ],
          "Empty input - header, end mark and content checksum only",
          "https://github.com/lz4/lz4/blob/dev/doc/lz4_Frame_format.md"
        ),
        new TestCase(
          [0x41],
          [
            0x04, 0x22, 0x4d, 0x18, 0x6c, 0x70, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x74, 0x01,
            0x00, 0x00, 0x80, 0x41, 0x00, 0x00, 0x00, 0x00, 0x4d, 0x9a, 0x65, 0x10
          ],
          "Single byte - block stored uncompressed",
          "https://github.com/lz4/lz4/blob/dev/doc/lz4_Frame_format.md"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. ".repeat(4)),
          [
            0x04, 0x22, 0x4d, 0x18, 0x6c, 0x70, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f, 0x39,
            0x00, 0x00, 0x00, 0xf0, 0x10, 0x74, 0x68, 0x65, 0x20, 0x71, 0x75, 0x69, 0x63, 0x6b, 0x20, 0x62,
            0x72, 0x6f, 0x77, 0x6e, 0x20, 0x66, 0x6f, 0x78, 0x20, 0x6a, 0x75, 0x6d, 0x70, 0x73, 0x20, 0x6f,
            0x76, 0x65, 0x72, 0x20, 0x1f, 0x00, 0x91, 0x6c, 0x61, 0x7a, 0x79, 0x20, 0x64, 0x6f, 0x67, 0x2e,
            0x0e, 0x00, 0x0f, 0x2d, 0x00, 0x6b, 0x50, 0x64, 0x6f, 0x67, 0x2e, 0x20, 0x00, 0x00, 0x00, 0x00,
            0xb5, 0x47, 0x77, 0xdf
          ],
          "Text sample repeated 4x - compressed block",
          "https://github.com/lz4/lz4/blob/dev/doc/lz4_Frame_format.md"
        ),
        new TestCase(
          new Array(256).fill(0x61),
          [
            0x04, 0x22, 0x4d, 0x18, 0x6c, 0x70, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x5a, 0x0b,
            0x00, 0x00, 0x00, 0x1f, 0x61, 0x01, 0x00, 0xe7, 0x50, 0x61, 0x61, 0x61, 0x61, 0x61, 0x00, 0x00,
            0x00, 0x00, 0x48, 0xae, 0x2a, 0x39
          ],
          "Long repetitive run - 256 identical bytes",
          "https://github.com/lz4/lz4/blob/dev/doc/lz4_Frame_format.md"
        ),
        new TestCase(
          [0x41, 0x42, 0x41, 0x42, 0x41, 0x42, 0x41, 0x42, 0x41, 0x42, 0x41, 0x42],
          [
            0x04, 0x22, 0x4d, 0x18, 0x6c, 0x70, 0x0c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x19, 0x0c,
            0x00, 0x00, 0x80, 0x41, 0x42, 0x41, 0x42, 0x41, 0x42, 0x41, 0x42, 0x41, 0x42, 0x41, 0x42, 0x00,
            0x00, 0x00, 0x00, 0x6c, 0xa2, 0x3e, 0x8c
          ],
          "Alternating two-byte pattern - too short for a match",
          "https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md"
        ),
        new TestCase(
          [
            0x9e, 0x1f, 0xd2, 0x4b, 0x6a, 0x0c, 0xf7, 0x83, 0x21, 0x55, 0xbe, 0x08, 0x3d, 0xc4, 0x71, 0xaa,
            0x9e, 0x1f, 0xd2, 0x4b, 0x6a, 0x0c, 0xf7, 0x83, 0x11, 0x62, 0xef, 0x90, 0x4d, 0x7c, 0x38, 0xa1
          ],
          [
            0x04, 0x22, 0x4d, 0x18, 0x6c, 0x70, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xc6, 0x1d,
            0x00, 0x00, 0x00, 0xf4, 0x01, 0x9e, 0x1f, 0xd2, 0x4b, 0x6a, 0x0c, 0xf7, 0x83, 0x21, 0x55, 0xbe,
            0x08, 0x3d, 0xc4, 0x71, 0xaa, 0x10, 0x00, 0x80, 0x11, 0x62, 0xef, 0x90, 0x4d, 0x7c, 0x38, 0xa1,
            0x00, 0x00, 0x00, 0x00, 0xa5, 0xd3, 0xa3, 0xf5
          ],
          "Pseudo-random binary sample with one repeated run",
          "https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("Optimal parsing minimises the total token cost, not the local match length."),
          [
            0x04, 0x22, 0x4d, 0x18, 0x6c, 0x70, 0x4b, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0e, 0x4b,
            0x00, 0x00, 0x80, 0x4f, 0x70, 0x74, 0x69, 0x6d, 0x61, 0x6c, 0x20, 0x70, 0x61, 0x72, 0x73, 0x69,
            0x6e, 0x67, 0x20, 0x6d, 0x69, 0x6e, 0x69, 0x6d, 0x69, 0x73, 0x65, 0x73, 0x20, 0x74, 0x68, 0x65,
            0x20, 0x74, 0x6f, 0x74, 0x61, 0x6c, 0x20, 0x74, 0x6f, 0x6b, 0x65, 0x6e, 0x20, 0x63, 0x6f, 0x73,
            0x74, 0x2c, 0x20, 0x6e, 0x6f, 0x74, 0x20, 0x74, 0x68, 0x65, 0x20, 0x6c, 0x6f, 0x63, 0x61, 0x6c,
            0x20, 0x6d, 0x61, 0x74, 0x63, 0x68, 0x20, 0x6c, 0x65, 0x6e, 0x67, 0x74, 0x68, 0x2e, 0x00, 0x00,
            0x00, 0x00, 0x51, 0xb2, 0x8b, 0x5e
          ],
          "English text - block stored uncompressed",
          "https://github.com/lz4/lz4/blob/dev/doc/lz4_Frame_format.md"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new LZ4FrameInstance(this, isInverse);
    }
  }

  class LZ4FrameInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }


    Result() {
      const data = this.inputBuffer;
      this.inputBuffer = [];
      if (this.isInverse) return frameDecompress(data);
      return frameCompress(data);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZ4FrameCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name))
    RegisterAlgorithm(algorithmInstance);

  // ===== EXPORTS =====

  return { LZ4FrameCompression, LZ4FrameInstance };
}));
