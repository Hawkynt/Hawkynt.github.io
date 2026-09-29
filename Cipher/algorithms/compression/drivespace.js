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
      /** @type {uint8[]} */
      this.bytes = [];
      /** @type {uint32} */
      this.buf = 0;
      /** @type {int32} */
      this.nBits = 0;
    }

    /**
     * @param {uint32} value - Value (below 2^width)
     * @param {int32} width - Number of bits
     */
    writeBits(value, width) {
      this.buf = OpCodes.Or32(this.buf, OpCodes.Shl32(value, this.nBits));
      this.nBits += width;
      while (this.nBits >= 8) {
        this.bytes.push(OpCodes.And32(this.buf, 0xFF));
        this.buf = OpCodes.Shr32(this.buf, 8);
        this.nBits -= 8;
      }
    }

    /**
     * @returns {uint8[]} All bytes, the last one zero-padded
     */
    flush() {
      if (this.nBits > 0) {
        this.bytes.push(OpCodes.And32(this.buf, 0xFF));
        this.buf = 0;
        this.nBits = 0;
      }
      return this.bytes;
    }
  }

  class JmBitReader {
    /**
     * @param {uint8[]} bytes - Source bytes
     * @param {int32} start - Position of the first bit's byte
     */
    constructor(bytes, start) {
      /** @type {uint8[]} */
      this.bytes = bytes;
      /** @type {int32} */
      this.pos = start;
      /** @type {uint32} */
      this.buf = 0;
      /** @type {int32} */
      this.nBits = 0;
    }

    /**
     * @param {int32} width - Number of bits
     * @returns {uint32} Value read
     */
    readBits(width) {
      while (this.nBits < width) {
        if (this.pos >= this.bytes.length) {
          throw new Error('DriveSpace: unexpected end of stream');
        }
        this.buf = OpCodes.Or32(this.buf, OpCodes.Shl32(this.bytes[this.pos++], this.nBits));
        this.nBits += 8;
      }
      /** @type {uint32} */
      const mask = OpCodes.Sub32(OpCodes.Shl32(1, width), 1);
      /** @type {uint32} */
      const value = OpCodes.And32(this.buf, mask);
      this.buf = OpCodes.Shr32(this.buf, width);
      this.nBits -= width;
      return value;
    }
  }

  // ===== SLIDING-WINDOW LZ CODEC (see doublespace.js for the DS sibling) =====
  // Both variants share the same token grammar and MIN_MATCH=2; only the
  // sliding-window search cap differs (DoubleSpace 4KB, DriveSpace 8KB).

  /** @type {int32} */
  const MIN_MATCH = 2;
  /** @type {int32} */
  const MAX_MATCH = 323;          // 68 base + 255 from the widest length extension
  /** @type {int32} */
  const HASH_BITS = 14;
  /** @type {int32} */
  const HASH_SIZE = OpCodes.Shl32(1, HASH_BITS);
  /** @type {int32} */
  const HASH_MASK = HASH_SIZE - 1;
  /** @type {int32} */
  const MAX_CHAIN_LENGTH = 128;

  // Distance class layout (bits, base, max). A distance is placed in the
  // lowest class whose range covers it.
  /** @type {int32[]} */
  const DISTANCE_CLASS_BITS = [6, 8, 12, 13];
  /** @type {int32[]} */
  const DISTANCE_CLASS_BASE = [1, 65, 321, 4417];
  /** @type {int32[]} */
  const DISTANCE_CLASS_MAX = [64, 320, 4416, 12608];

  /**
   * Longest match found at a position
   */
  class JmMatch {
    /**
     * @param {int32} length - Match length (0 when none)
     * @param {int32} offset - Distance back to the match source
     */
    constructor(length, offset) {
      /** @type {int32} */
      this.length = length;
      /** @type {int32} */
      this.offset = offset;
    }
  }

  /**
   * @param {JmBitWriter} writer - Output bits
   * @param {int32} length - Match length (2..323)
   */
  function writeLength(writer, length) {
    if (length === 2) {
      writer.writeBits(0, 2);
      return;
    }
    if (length === 3) {
      writer.writeBits(1, 2);
      return;
    }
    if (length === 4) {
      writer.writeBits(2, 2);
      return;
    }

    writer.writeBits(3, 2);
    /** @type {int32} */
    const extended = length - 5;
    if (extended < 63) {
      writer.writeBits(extended, 6);
      return;
    }
    writer.writeBits(63, 6);
    writer.writeBits(length - 68, 8);
  }

  /**
   * @param {JmBitReader} reader - Input bits
   * @returns {int32} Match length
   */
  function readLength(reader) {
    /** @type {int32} */
    const code = reader.readBits(2);
    if (code < 3) {
      return code + 2;
    }
    /** @type {int32} */
    const extended = reader.readBits(6);
    if (extended < 63) {
      return 5 + extended;
    }
    /** @type {int32} */
    const extra = reader.readBits(8);
    return 68 + extra;
  }

  /**
   * @param {JmBitWriter} writer - Output bits
   * @param {int32} distance - Match distance
   */
  function writeDistance(writer, distance) {
    for (let cls = 0; cls < DISTANCE_CLASS_MAX.length; ++cls) {
      if (distance <= DISTANCE_CLASS_MAX[cls]) {
        writer.writeBits(cls, 2);
        writer.writeBits(distance - DISTANCE_CLASS_BASE[cls], DISTANCE_CLASS_BITS[cls]);
        return;
      }
    }
    throw new Error('DriveSpace: distance exceeds maximum class range');
  }

  /**
   * @param {JmBitReader} reader - Input bits
   * @returns {int32} Match distance
   */
  function readDistance(reader) {
    /** @type {int32} */
    const cls = reader.readBits(2);
    /** @type {int32} */
    const offset = reader.readBits(DISTANCE_CLASS_BITS[cls]);
    return DISTANCE_CLASS_BASE[cls] + offset;
  }

  /**
   * @param {uint8[]} input - Bytes
   * @param {int32} pos - Position of the two hashed bytes
   * @returns {uint32} Bucket
   */
  function hash2(input, pos) {
    return OpCodes.And32(OpCodes.Xor32(OpCodes.Shl32(input[pos], 6), input[pos + 1]), HASH_MASK);
  }

  /**
   * @param {uint8[]} input - Bytes
   * @param {int32} pos - Position to match
   * @param {int32} n - Input length
   * @param {int32} maxDistance - Largest distance
   * @param {int32[]} hashHead - Chain heads
   * @param {int32[]} hashNext - Chain links
   * @returns {JmMatch} Longest match (length 0 when none)
   */
  function findBestMatch(input, pos, n, maxDistance, hashHead, hashNext) {
    if (pos + MIN_MATCH > n) {
      return new JmMatch(0, 0);
    }

    /** @type {int32} */
    let bestLen = 0;
    /** @type {int32} */
    let bestOff = 0;
    /** @type {int32} */
    const minPos = Math.max(0, pos - maxDistance);
    /** @type {int32} */
    let idx = hashNext[pos];
    /** @type {int32} */
    let chainLen = 0;
    /** @type {int32} */
    const maxLen = Math.min(n - pos, MAX_MATCH);

    while (idx >= minPos && idx < pos && chainLen < MAX_CHAIN_LENGTH) {
      if (input[idx] === input[pos] && input[idx + 1] === input[pos + 1]) {
        /** @type {int32} */
        let l = 2;
        while (l < maxLen && input[idx + l] === input[pos + l]) {
          ++l;
        }
        if (l > bestLen) {
          bestLen = l;
          bestOff = pos - idx;
          if (bestLen >= maxLen) {
            break;
          }
        }
      }
      idx = hashNext[idx];
      ++chainLen;
    }

    return new JmMatch(bestLen, bestOff);
  }

  /**
   * @param {uint8[]} input - Input bytes
   * @param {int32} maxDistance - Largest distance
   * @returns {uint8[]} Size header and bitstream
   */
  function jmCompress(input, maxDistance) {
    /** @type {int32} */
    const n = input.length;
    /** @type {uint8[]} */
    const out = [];

    // 4-byte little-endian original-size header.
    /** @type {uint32} */
    const len32 = OpCodes.ToUint32(n);
    out.push(OpCodes.And32(len32, 0xFF));
    out.push(OpCodes.And32(OpCodes.Shr32(len32, 8), 0xFF));
    out.push(OpCodes.And32(OpCodes.Shr32(len32, 16), 0xFF));
    out.push(OpCodes.And32(OpCodes.Shr32(len32, 24), 0xFF));

    if (n === 0) {
      return out;
    }

    /** @type {JmBitWriter} */
    const writer = new JmBitWriter();
    /** @type {int32[]} */
    const hashHead = new Int32Array(HASH_SIZE).fill(-1);
    /** @type {int32[]} */
    const hashNext = new Int32Array(n).fill(-1);

    /** @type {int32} */
    let pos = 0;
    while (pos < n) {
      // Insert the current position before matching, so skipped-over positions
      // inside a match can be updated with the same operation.
      if (pos + 1 < n) {
        /** @type {uint32} */
        const h = hash2(input, pos);
        hashNext[pos] = hashHead[h];
        hashHead[h] = pos;
      }

      /** @type {JmMatch} */
      const best = findBestMatch(input, pos, n, maxDistance, hashHead, hashNext);

      if (best.length >= MIN_MATCH) {
        writer.writeBits(1, 1);
        writeLength(writer, best.length);
        writeDistance(writer, best.offset);

        for (let j = 1; j < best.length && pos + j + 1 < n; ++j) {
          /** @type {uint32} */
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

    /** @type {uint8[]} */
    const body = writer.flush();
    for (let i = 0; i < body.length; ++i) {
      out.push(body[i]);
    }
    return out;
  }

  /**
   * @param {uint8[]} input - Size header and bitstream
   * @returns {uint8[]} Decoded bytes
   */
  function jmDecompress(input) {
    /** @type {uint8[]} */
    const output = [];
    if (input.length < 4) {
      return output;
    }

    // The stored size is read as a signed 32-bit value: a set top bit makes it
    // negative, and nothing is decoded.
    /** @type {int32} */
    const originalLength = OpCodes.ToInt(OpCodes.Or32(
      OpCodes.Or32(OpCodes.Or32(input[0], OpCodes.Shl32(input[1], 8)), OpCodes.Shl32(input[2], 16)),
      OpCodes.Shl32(input[3], 24)
    ));

    if (originalLength === 0) {
      return output;
    }

    /** @type {JmBitReader} */
    const reader = new JmBitReader(input, 4);

    while (output.length < originalLength) {
      /** @type {uint32} */
      const flag = reader.readBits(1);
      if (flag === 0) {
        /** @type {uint8} */
        const literal = reader.readBits(8);
        output.push(literal);
        continue;
      }

      /** @type {int32} */
      const length = readLength(reader);
      /** @type {int32} */
      const distance = readDistance(reader);
      if (distance < 1 || distance > output.length) {
        throw new Error('DriveSpace: invalid back-reference distance');
      }

      /** @type {int32} */
      const src = output.length - distance;
      for (let i = 0; i < length; ++i) {
        output.push(output[src + i]);
      }
    }

    return output;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /** @type {int32} */
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

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - True to decompress
     * @returns {DriveSpaceInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new DriveSpaceInstance(this, isInverse);
    }
  }

  class DriveSpaceInstance extends IAlgorithmInstance {
    /**
     * @param {DriveSpaceCompression} algorithm - Parent algorithm
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
        return jmDecompress(data);
      }
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
