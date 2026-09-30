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

  /** @type {uint32} */
  const XXH_PRIME1 = 0x9E3779B1;
  /** @type {uint32} */
  const XXH_PRIME2 = 0x85EBCA77;
  /** @type {uint32} */
  const XXH_PRIME3 = 0xC2B2AE3D;
  /** @type {uint32} */
  const XXH_PRIME4 = 0x27D4EB2F;
  /** @type {uint32} */
  const XXH_PRIME5 = 0x165667B1;
  // Lane seeds for seed 0: PRIME1 + PRIME2 and 0 - PRIME1, both mod 2^32.
  /** @type {uint32} */
  const XXH_SEED_V1 = 0x24234428;
  /** @type {uint32} */
  const XXH_SEED_V4 = 0x61C8864F;

  /**
   * @param {uint8[]} data - Bytes
   * @param {int32} offset - Position of the word
   * @returns {uint32} Little-endian 32-bit word
   */
  function readU32LE(data, offset) {
    return OpCodes.Or32(
      OpCodes.Or32(
        OpCodes.Or32(data[offset], OpCodes.Shl32(data[offset + 1], 8)),
        OpCodes.Shl32(data[offset + 2], 16)
      ),
      OpCodes.Shl32(data[offset + 3], 24)
    );
  }

  /**
   * @param {uint32} acc - Lane accumulator
   * @param {uint32} input - Lane input word
   * @returns {uint32} New accumulator
   */
  function xxhRound(acc, input) {
    /** @type {uint32} */
    let lane = OpCodes.Add32(acc, OpCodes.Mul32(input, XXH_PRIME2));
    lane = OpCodes.RotL32(lane, 13);
    return OpCodes.Mul32(lane, XXH_PRIME1);
  }

  /**
   * @param {uint32} value - Hash before avalanche
   * @returns {uint32} Final hash
   */
  function xxhAvalanche(value) {
    /** @type {uint32} */
    let hash = OpCodes.Xor32(value, OpCodes.Shr32(value, 15));
    hash = OpCodes.Mul32(hash, XXH_PRIME2);
    hash = OpCodes.Xor32(hash, OpCodes.Shr32(hash, 13));
    hash = OpCodes.Mul32(hash, XXH_PRIME3);
    hash = OpCodes.Xor32(hash, OpCodes.Shr32(hash, 16));
    return hash;
  }

  /**
   * @param {uint32} value - Hash so far
   * @param {uint8[]} data - Bytes
   * @param {int32} offset - First remaining byte
   * @param {int32} end - End of the hashed range
   * @returns {uint32} Final hash
   */
  function xxhFinalizeTail(value, data, offset, end) {
    /** @type {uint32} */
    let hash = value;
    /** @type {int32} */
    let pos = offset;
    while (pos + 4 <= end) {
      hash = OpCodes.Add32(hash, OpCodes.Mul32(readU32LE(data, pos), XXH_PRIME3));
      hash = OpCodes.Mul32(OpCodes.RotL32(hash, 17), XXH_PRIME4);
      pos += 4;
    }
    while (pos < end) {
      hash = OpCodes.Add32(hash, OpCodes.Mul32(data[pos], XXH_PRIME5));
      hash = OpCodes.Mul32(OpCodes.RotL32(hash, 11), XXH_PRIME1);
      ++pos;
    }
    return xxhAvalanche(hash);
  }

  /**
   * @param {uint8[]} data - Bytes
   * @param {int32} offset - Start of the hashed range
   * @param {int32} end - End of the hashed range
   * @returns {uint32} xxHash32 with seed 0
   */
  function xxHash32(data, offset, end) {
    /** @type {int32} */
    const length = end - offset;
    if (length < 16) {
      return xxhFinalizeTail(OpCodes.Add32(XXH_PRIME5, length), data, offset, end);
    }

    /** @type {uint32} */
    let v1 = XXH_SEED_V1;
    /** @type {uint32} */
    let v2 = XXH_PRIME2;
    /** @type {uint32} */
    let v3 = 0;
    /** @type {uint32} */
    let v4 = XXH_SEED_V4;

    /** @type {int32} */
    let pos = offset;
    while (pos + 16 <= end) {
      v1 = xxhRound(v1, readU32LE(data, pos));
      v2 = xxhRound(v2, readU32LE(data, pos + 4));
      v3 = xxhRound(v3, readU32LE(data, pos + 8));
      v4 = xxhRound(v4, readU32LE(data, pos + 12));
      pos += 16;
    }

    /** @type {uint32} */
    let hash = OpCodes.Add32(
      OpCodes.Add32(OpCodes.RotL32(v1, 1), OpCodes.RotL32(v2, 7)),
      OpCodes.Add32(OpCodes.RotL32(v3, 12), OpCodes.RotL32(v4, 18))
    );
    hash = OpCodes.Add32(hash, length);
    return xxhFinalizeTail(hash, data, pos, end);
  }

  // ===== LZ4 BLOCK CODEC (https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md) =====

  /** @type {int32} */
  const MIN_MATCH = 4;
  /** @type {int32} */
  const RUN_MASK = 15;
  /** @type {int32} */
  const MAX_DISTANCE = 65535;
  /** @type {int32} */
  const HASH_LOG = 16;
  /** @type {int32} */
  const HASH_SIZE_U32 = 65536;
  /** @type {int32} */
  const LAST_LITERALS = 5;
  /** @type {int32} */
  const MF_LIMIT = 12;

  /**
   * @param {uint8[]} data - Bytes
   * @param {int32} pos - Position of the four hashed bytes
   * @returns {uint32} Hash table index
   */
  function blockHash(data, pos) {
    /** @type {uint32} */
    const value = readU32LE(data, pos);
    return OpCodes.Shr32(OpCodes.Mul32(value, 2654435761), 32 - HASH_LOG);
  }

  /**
   * @param {uint8[]} output - Block being written
   * @param {int32} extra - Length beyond the 15 held by the token
   */
  function writeLengthExtension(output, extra) {
    /** @type {int32} */
    let remaining = extra;
    while (remaining >= 255) {
      output.push(255);
      remaining -= 255;
    }
    output.push(OpCodes.And32(remaining, 0xFF));
  }

  /**
   * @param {uint8[]} output - Block being written
   * @param {uint8[]} input - Source bytes
   * @param {int32} literalStart - First literal
   * @param {int32} literalCount - Number of literals
   * @param {int32} offset - Match distance
   * @param {int32} matchLength - Match length
   */
  function emitSequence(output, input, literalStart, literalCount, offset, matchLength) {
    /** @type {int32} */
    const matchCode = matchLength - MIN_MATCH;
    /** @type {int32} */
    const tokenLit = Math.min(literalCount, RUN_MASK);
    /** @type {int32} */
    const tokenMatch = Math.min(matchCode, RUN_MASK);
    output.push(OpCodes.And32(OpCodes.Or32(OpCodes.Shl32(tokenLit, 4), tokenMatch), 0xFF));

    if (literalCount >= RUN_MASK) {
      writeLengthExtension(output, literalCount - RUN_MASK);
    }

    for (let i = 0; i < literalCount; ++i) {
      output.push(input[literalStart + i]);
    }

    output.push(OpCodes.And32(offset, 0xFF));
    output.push(OpCodes.And32(OpCodes.Shr32(offset, 8), 0xFF));

    if (matchCode >= RUN_MASK) {
      writeLengthExtension(output, matchCode - RUN_MASK);
    }
  }

  /**
   * @param {uint8[]} output - Block being written
   * @param {uint8[]} input - Source bytes
   * @param {int32} literalStart - First literal
   * @param {int32} literalCount - Number of literals
   */
  function emitLastLiterals(output, input, literalStart, literalCount) {
    output.push(OpCodes.And32(OpCodes.Shl32(Math.min(literalCount, RUN_MASK), 4), 0xFF));

    if (literalCount >= RUN_MASK) {
      writeLengthExtension(output, literalCount - RUN_MASK);
    }

    for (let i = 0; i < literalCount; ++i) {
      output.push(input[literalStart + i]);
    }
  }

  /**
   * @param {uint8[]} input - Bytes
   * @param {int32} a - First position
   * @param {int32} b - Second position
   * @returns {boolean} True when the four bytes at a and b are equal
   */
  function sameFour(input, a, b) {
    return input[a] === input[b] &&
      input[a + 1] === input[b + 1] &&
      input[a + 2] === input[b + 2] &&
      input[a + 3] === input[b + 3];
  }

  /**
   * @param {uint8[]} input - Block bytes
   * @returns {uint8[]} LZ4 block
   */
  function compressBlock(input) {
    /** @type {int32} */
    const n = input.length;
    /** @type {uint8[]} */
    const output = [];
    if (n === 0) {
      return output;
    }

    /** @type {int32[]} */
    const hashTable = new Int32Array(HASH_SIZE_U32).fill(-1);
    /** @type {int32} */
    let pos = 0;
    /** @type {int32} */
    let anchor = 0;

    // No match may start within MF_LIMIT bytes of the end; matches may not
    // extend into the final LAST_LITERALS bytes, which must stay literals.
    /** @type {int32} */
    const searchLimit = n - MF_LIMIT;
    /** @type {int32} */
    const matchLimit = n - LAST_LITERALS;

    while (pos < searchLimit) {
      /** @type {int32} */
      let matchOffset = 0;
      /** @type {int32} */
      let matchLength = 0;

      /** @type {uint32} */
      const h = blockHash(input, pos);
      /** @type {int32} */
      const candidate = hashTable[h];
      hashTable[h] = pos;

      if (candidate >= 0 && (pos - candidate) <= MAX_DISTANCE && sameFour(input, candidate, pos)) {
        matchOffset = pos - candidate;
        matchLength = MIN_MATCH;
        while (pos + matchLength < matchLimit &&
               input[candidate + matchLength] === input[pos + matchLength]) {
          ++matchLength;
        }
      }

      if (matchLength < MIN_MATCH) {
        ++pos;
        continue;
      }

      emitSequence(output, input, anchor, pos - anchor, matchOffset, matchLength);

      /** @type {int32} */
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

  /**
   * @param {uint8[]} input - Frame bytes
   * @param {int32} start - Start of the block
   * @param {int32} length - Block size
   * @param {uint8[]} output - Decoded bytes (appended to)
   */
  function decompressBlock(input, start, length, output) {
    /** @type {int32} */
    const end = start + length;
    /** @type {int32} */
    let ip = start;

    while (ip < end) {
      /** @type {uint8} */
      const token = input[ip++];

      /** @type {int32} */
      let literalLength = OpCodes.Shr32(token, 4);
      if (literalLength === 15) {
        /** @type {uint8} */
        let extra = 0;
        do {
          if (ip >= end) {
            break;
          }
          extra = input[ip++];
          literalLength += extra;
        } while (extra === 255);
      }

      for (let i = 0; i < literalLength; ++i) {
        if (ip >= end) {
          break;
        }
        output.push(input[ip++]);
      }

      if (ip >= end) {
        break;
      }
      if (ip + 1 >= end) {
        break;
      }

      /** @type {uint32} */
      const offset = OpCodes.Or32(input[ip], OpCodes.Shl32(input[ip + 1], 8));
      ip += 2;

      /** @type {uint32} */
      const matchField = OpCodes.And32(token, 0x0F);
      /** @type {int32} */
      let matchLength = matchField + MIN_MATCH;
      if (matchField === 15) {
        /** @type {uint8} */
        let extra = 0;
        do {
          if (ip >= end) {
            break;
          }
          extra = input[ip++];
          matchLength += extra;
        } while (extra === 255);
      }

      /** @type {int32} */
      const matchPos = output.length - offset;
      if (matchPos < 0) {
        throw new Error('LZ4 Frame: invalid match offset');
      }
      for (let i = 0; i < matchLength; ++i) {
        output.push(output[matchPos + i]);
      }
    }
  }

  // ===== FRAME CODEC =====

  /** @type {uint8[]} */
  const FRAME_MAGIC = [0x04, 0x22, 0x4D, 0x18];   // 0x184D2204 little-endian
  /** @type {int32} */
  const BLOCK_MAX_SIZE = 4 * 1024 * 1024;         // BD block-max-size code 7
  /** @type {int32} */
  const BLOCK_MAX_SIZE_BITS = 7;

  /**
   * @param {uint8[]} out - Frame being written
   * @param {uint32} value - Value appended as four little-endian bytes
   */
  function pushU32LE(out, value) {
    out.push(OpCodes.And32(value, 0xFF));
    out.push(OpCodes.And32(OpCodes.Shr32(value, 8), 0xFF));
    out.push(OpCodes.And32(OpCodes.Shr32(value, 16), 0xFF));
    out.push(OpCodes.And32(OpCodes.Shr32(value, 24), 0xFF));
  }

  /**
   * @param {uint8[]} data - Input bytes
   * @returns {uint8[]} LZ4 frame
   */
  function frameCompress(data) {
    /** @type {uint8[]} */
    const out = [];

    // ---- frame header ----
    for (let i = 0; i < FRAME_MAGIC.length; ++i) {
      out.push(FRAME_MAGIC[i]);
    }

    // FLG: version 01, block independence, content size present, content checksum.
    /** @type {uint32} */
    const flg = OpCodes.Or32(
      OpCodes.Or32(OpCodes.Shl32(1, 6), OpCodes.Shl32(1, 5)),
      OpCodes.Or32(OpCodes.Shl32(1, 3), OpCodes.Shl32(1, 2))
    );
    out.push(flg);
    out.push(OpCodes.And32(OpCodes.Shl32(BLOCK_MAX_SIZE_BITS, 4), 0xFF));

    // Content size, 8 bytes little-endian.
    /** @type {float64} */
    let remaining = data.length;
    for (let i = 0; i < 8; ++i) {
      out.push(OpCodes.And32(OpCodes.ToUint32(remaining), 0xFF));
      remaining = Math.floor(remaining / 256);
    }

    // Header checksum: second byte of xxHash32 over the descriptor bytes.
    /** @type {uint32} */
    const headerChecksum = xxHash32(out, 4, 14);
    out.push(OpCodes.And32(OpCodes.Shr32(headerChecksum, 8), 0xFF));

    // ---- data blocks ----
    /** @type {int32} */
    let offset = 0;
    while (offset < data.length) {
      /** @type {int32} */
      const blockLength = Math.min(BLOCK_MAX_SIZE, data.length - offset);
      /** @type {uint8[]} */
      const block = data.slice(offset, offset + blockLength);
      /** @type {uint8[]} */
      const compressed = compressBlock(block);

      if (compressed.length >= blockLength) {
        // Store uncompressed; the high bit of the size field flags this.
        pushU32LE(out, OpCodes.Or32(blockLength, 0x80000000));
        for (let i = 0; i < blockLength; ++i) {
          out.push(block[i]);
        }
      } else {
        pushU32LE(out, compressed.length);
        for (let i = 0; i < compressed.length; ++i) {
          out.push(compressed[i]);
        }
      }

      offset += blockLength;
    }

    // ---- end mark and content checksum ----
    pushU32LE(out, 0);
    pushU32LE(out, xxHash32(data, 0, data.length));

    return out;
  }

  /**
   * @param {uint8[]} data - LZ4 frame
   * @returns {uint8[]} Decoded bytes
   */
  function frameDecompress(data) {
    if (data.length < 4) {
      throw new Error('LZ4 Frame: frame too short');
    }
    for (let i = 0; i < FRAME_MAGIC.length; ++i) {
      if (data[i] !== FRAME_MAGIC[i]) {
        throw new Error('LZ4 Frame: invalid frame magic');
      }
    }

    /** @type {int32} */
    let pos = 4;
    if (pos + 2 > data.length) {
      throw new Error('LZ4 Frame: truncated frame header');
    }
    /** @type {uint8} */
    const flg = data[pos++];
    ++pos; // BD byte: block max size only bounds the decode buffer, not needed here

    /** @type {boolean} */
    const contentSizePresent = OpCodes.And32(OpCodes.Shr32(flg, 3), 1) === 1;
    /** @type {boolean} */
    const contentChecksumPresent = OpCodes.And32(OpCodes.Shr32(flg, 2), 1) === 1;
    /** @type {boolean} */
    const blockChecksumPresent = OpCodes.And32(OpCodes.Shr32(flg, 4), 1) === 1;

    if (contentSizePresent) {
      if (pos + 8 > data.length) {
        throw new Error('LZ4 Frame: truncated content size');
      }
      pos += 8;
    }

    if (pos >= data.length) {
      throw new Error('LZ4 Frame: truncated header checksum');
    }
    ++pos; // header checksum byte

    /** @type {uint8[]} */
    const output = [];
    while (pos + 4 <= data.length) {
      /** @type {uint32} */
      const blockHeader = readU32LE(data, pos);
      pos += 4;

      if (blockHeader === 0) {
        break; // end mark
      }

      /** @type {boolean} */
      const isUncompressed = OpCodes.And32(blockHeader, 0x80000000) !== 0;
      /** @type {uint32} */
      const dataSize = OpCodes.And32(blockHeader, 0x7FFFFFFF);

      /** @type {float64} */
      const blockEnd = pos + dataSize;
      if (blockEnd > data.length) {
        throw new Error('LZ4 Frame: truncated block data');
      }

      if (isUncompressed) {
        for (let i = 0; i < dataSize; ++i) {
          output.push(data[pos + i]);
        }
      } else {
        decompressBlock(data, pos, dataSize, output);
      }

      pos += dataSize;
      if (blockChecksumPresent) {
        pos += 4;
      }
    }

    if (contentChecksumPresent && pos + 4 <= data.length) {
      /** @type {uint32} */
      const expected = readU32LE(data, pos);
      /** @type {uint32} */
      const actual = xxHash32(output, 0, output.length);
      if (expected !== actual) {
        throw new Error('LZ4 Frame: content checksum mismatch');
      }
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

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - True to decompress
     * @returns {LZ4FrameInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new LZ4FrameInstance(this, isInverse);
    }
  }

  class LZ4FrameInstance extends IAlgorithmInstance {
    /**
     * @param {LZ4FrameCompression} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - True to decompress
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
    }

    /**
     * Compress or decompress the collected input
     * @returns {uint8[]} Output bytes
     */
    Result() {
      /** @type {uint8[]} */
      const data = this.inputBuffer;
      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;
      if (this.isInverse) {
        return frameDecompress(data);
      }
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
