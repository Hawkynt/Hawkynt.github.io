/*
 * aPLib Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * aPLib is Joergen Ibsen's LZSS-based compression library (Ibsen Software,
 * first released 1998), well known for extremely small and fast decompressors
 * and widely reused in executable packers and malware.
 *
 * Wire format: a 4-byte little-endian original length, followed (unless that
 * length is zero) by the bare aPLib stream body. The bare stream is a single
 * MSB-first tag-bit stream interleaved in place with raw literal/offset
 * bytes: whenever a new group of up to eight tag bits starts, one byte is
 * reserved at the current output position to hold those bits, and literal or
 * offset bytes that follow are appended directly (byte-aligned), not folded
 * into the bit accumulator. This differs from a classic LZSS flag-byte
 * grouping, where the flag byte is buffered and only appended once eight
 * tokens have been produced.
 *
 *   - The very first output byte is always a literal, written unconditionally
 *     before any tag bit is read.
 *   - Every following symbol starts with a capped-depth tag-bit prefix:
 *       0    -> Literal:      one literal byte follows.
 *       10   -> Normal match: a gamma-coded value picks the offset's high
 *                              part (value 2 while the previous symbol was a
 *                              literal or single-byte copy reuses the
 *                              previous match's offset with a fresh
 *                              gamma-coded length; otherwise the value minus
 *                              2 or 3 forms the offset's high part, combined
 *                              with one raw low byte), followed by a
 *                              gamma-coded length, bumped by +1/+1/+2
 *                              depending on whether the offset is at least
 *                              1280, at least 32000, or below 128
 *                              respectively.
 *       110  -> Short match:  one raw byte; its upper seven bits are a 1..127
 *                              offset (zero signals end of stream) and its
 *                              lowest bit selects a length of 2 or 3.
 *       111  -> Single byte:  four raw bits pick an offset 0..15; offset 0
 *                              emits a literal zero byte, otherwise one byte
 *                              is copied from that offset back.
 *   - Gamma coding reconstructs values of two or more: start with an
 *     accumulator of one, then repeatedly double it and add a data bit, for
 *     as long as the following continuation bit is set.
 *
 * The compressor here is a spec-faithful greedy LZ (hash-chain match finder,
 * 64-candidate chain depth, unbounded window) that emits only literals,
 * normal matches, and the end marker; the decompressor implements the full
 * grammar above, including offset reuse, short matches and single-byte
 * copies, so that it also accepts streams produced by other encoders.
 *
 * References:
 * - Ibsen Software aPLib product page: https://ibsensoftware.com/products_aPLib.html
 * - "The malware analyst's guide to aPLib decompression" (independent format
 *   write-up): https://0xc0decafe.com/malware-analysts-guide-to-aplib-decompression
 * - aPLib Wikipedia-style overview via malduck's decompressor: https://malduck.readthedocs.io/en/v4.0.0/_modules/malduck/compression/aplib.html
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

  /** @type {int32} */
  const MIN_NORMAL_MATCH = 2;
  /** @type {int32} */
  const MAX_CHAIN = 64;
  /** @type {int32} */
  const MAX_MATCH = 0x10000;
  /** @type {int32} */
  const HASH_SIZE = 0x10000;

  // ===== BIT/BYTE STREAM HELPERS (interleaved tag stream, MSB first) =====

  class AplibWriter {
    constructor() {
      /** @type {uint8[]} */
      this.out = [];
      /** @type {int32} */
      this.tagPos = -1;
      /** @type {int32} */
      this.bitsInTag = 0;
    }

    /**
     * @param {int32} bit - Bit (any non-zero value is a 1)
     */
    putBit(bit) {
      if (this.bitsInTag === 0) {
        this.tagPos = this.out.length;
        this.out.push(0);
      }
      if (bit !== 0) {
        /** @type {uint8} */
        const mask = OpCodes.Shl8(1, 7 - this.bitsInTag);
        this.out[this.tagPos] = OpCodes.Or8(this.out[this.tagPos], mask);
      }
      this.bitsInTag = (this.bitsInTag + 1) % 8;
    }

    /**
     * @param {uint8} value - Byte appended at the current position
     */
    putByte(value) {
      this.out.push(OpCodes.And8(value, 0xFF));
    }

    /**
     * @param {int32} value - Value, at least 2
     */
    putGamma(value) {
      if (value < 2) {
        throw new Error('aPLib gamma coding requires a value of at least 2.');
      }

      /** @type {int32} */
      let msb = 0;
      /** @type {int32} */
      let v = value;
      while (v > 1) {
        msb++;
        v = Math.floor(v / 2);
      }

      for (let i = msb - 1; i >= 0; --i) {
        this.putBit(OpCodes.And32(OpCodes.Shr32(value, i), 1));
        this.putBit(i > 0 ? 1 : 0);
      }
    }

    /**
     * @returns {uint8[]} Copy of the stream
     */
    toArray() {
      return this.out.slice();
    }
  }

  class AplibReader {
    /**
     * @param {uint8[]} data - Stream
     */
    constructor(data) {
      /** @type {uint8[]} */
      this.data = data;
      /** @type {int32} */
      this.pos = 0;
      /** @type {uint32} */
      this.tag = 0;
      /** @type {int32} */
      this.bitsLeft = 0;
    }

    /**
     * @returns {uint8} Next byte
     */
    readByte() {
      if (this.pos >= this.data.length) {
        throw new Error('aPLib: unexpected end of stream.');
      }
      return this.data[this.pos++];
    }

    /**
     * @returns {uint32} Next tag bit
     */
    readBit() {
      if (this.bitsLeft === 0) {
        this.tag = this.readByte();
        this.bitsLeft = 8;
      }
      /** @type {uint32} */
      const bit = OpCodes.And32(OpCodes.Shr32(this.tag, 7), 1);
      this.tag = OpCodes.And32(OpCodes.Shl32(this.tag, 1), 0xFF);
      this.bitsLeft--;
      return bit;
    }

    /**
     * Interlaced gamma value; a corrupt stream can make it arbitrarily
     * large, so it is accumulated as an exact float64
     * @returns {float64} Value, at least 2
     */
    readGamma() {
      /** @type {float64} */
      let result = 1;
      /** @type {uint32} */
      let more = 0;
      do {
        /** @type {uint32} */
        const bit = this.readBit();
        result = result * 2 + bit;
        more = this.readBit();
      } while (more === 1);
      return result;
    }
  }

  // ===== HASH-CHAIN MATCH FINDER =====

  /**
   * @param {uint8[]} data - Bytes
   * @param {int32} pos - Position of the three hashed bytes
   * @returns {uint32} Bucket
   */
  function hash3(data, pos) {
    /** @type {uint32} */
    const h = OpCodes.Xor32(
      OpCodes.Xor32(OpCodes.Shl32(data[pos], 8), OpCodes.Shl32(data[pos + 1], 4)),
      data[pos + 2]
    );
    return OpCodes.And32(h, 0xFFFF);
  }

  /**
   * @param {uint8[]} data - Bytes
   * @param {int32} pos - Position to insert
   * @param {int32[]} head - Chain heads
   * @param {int32[]} prev - Chain links
   */
  function insertPos(data, pos, head, prev) {
    if (pos + 2 >= data.length) {
      return;
    }
    /** @type {uint32} */
    const h = hash3(data, pos);
    prev[pos] = head[h];
    head[h] = pos;
  }

  /**
   * Longest match found at a position
   */
  class AplibMatch {
    /**
     * @param {int32} bestOff - Distance back to the match source
     * @param {int32} bestLen - Match length (0 when none)
     */
    constructor(bestOff, bestLen) {
      /** @type {int32} */
      this.bestOff = bestOff;
      /** @type {int32} */
      this.bestLen = bestLen;
    }
  }

  /**
   * @param {uint8[]} data - Bytes
   * @param {int32} pos - Position to match
   * @param {int32[]} head - Chain heads
   * @param {int32[]} prev - Chain links
   * @returns {AplibMatch} Longest match
   */
  function findMatch(data, pos, head, prev) {
    /** @type {int32} */
    let bestOff = 0;
    /** @type {int32} */
    let bestLen = 0;
    if (pos + 2 >= data.length) {
      return new AplibMatch(bestOff, bestLen);
    }

    /** @type {int32} */
    let idx = head[hash3(data, pos)];
    /** @type {int32} */
    let chain = 0;
    /** @type {int32} */
    const maxLen = Math.min(data.length - pos, MAX_MATCH);

    while (idx >= 0 && chain < MAX_CHAIN) {
      /** @type {int32} */
      const off = pos - idx;
      if (data[idx] === data[pos] && data[idx + bestLen] === data[pos + bestLen]) {
        /** @type {int32} */
        let len = 0;
        while (len < maxLen && data[idx + len] === data[pos + len]) {
          ++len;
        }
        if (len > bestLen) {
          bestLen = len;
          bestOff = off;
          if (len >= maxLen) {
            break;
          }
        }
      }
      idx = prev[idx];
      chain++;
    }

    return new AplibMatch(bestOff, bestLen);
  }

  // aPLib's normal-match length carries decode-time bumps depending on the
  // offset magnitude; the encoded gamma length must be the actual length
  // minus those bumps and stay at least 2 (the gamma minimum). Returns -1
  // when a match is too short to encode at the given offset.
  /**
   * @param {int32} offset - Match distance
   * @param {int32} length - Match length
   * @returns {int32} Gamma length to write, or -1
   */
  function tryEncodableLength(offset, length) {
    /** @type {int32} */
    let adjust = 0;
    if (offset >= 32000) {
      adjust += 1;
    }
    if (offset >= 1280) {
      adjust += 1;
    }
    if (offset < 128) {
      adjust += 2;
    }
    /** @type {int32} */
    const encodedLen = length - adjust;
    return encodedLen >= 2 ? encodedLen : -1;
  }

  /**
   * @param {uint8[]} output - Decoded bytes (fixed size)
   * @param {int32} op - Write position
   * @param {float64} offs - Match distance
   * @param {float64} len - Match length
   * @returns {int32} New write position
   */
  function copyMatch(output, op, offs, len) {
    if (offs <= 0 || offs > op) {
      throw new Error('aPLib: match offset points before start of output.');
    }
    /** @type {int32} */
    const src = op - offs;
    /** @type {int32} */
    let o = op;
    for (let i = 0; i < len && o < output.length; ++i) {
      output[o] = output[src + i];
      o++;
    }
    return o;
  }

  // ===== BARE STREAM CODEC =====

  /**
   * @param {uint8[]} data - Input bytes
   * @returns {uint8[]} Bare aPLib stream
   */
  function compressBare(data) {
    /** @type {AplibWriter} */
    const writer = new AplibWriter();
    if (data.length === 0) {
      /** @type {uint8[]} */
      const nothing = writer.toArray();
      return nothing;
    }

    // First byte verbatim, matching the depacker's pre-loop copy.
    writer.putByte(data[0]);

    /** @type {int32[]} */
    const head = new Int32Array(HASH_SIZE).fill(-1);
    /** @type {int32[]} */
    const prev = new Int32Array(data.length);
    insertPos(data, 0, head, prev);

    /** @type {int32} */
    let lwm = 0;
    /** @type {int32} */
    let pos = 1;
    while (pos < data.length) {
      /** @type {AplibMatch} */
      const found = findMatch(data, pos, head, prev);
      /** @type {int32} */
      const bestOff = found.bestOff;
      /** @type {int32} */
      const bestLen = found.bestLen;
      /** @type {int32} */
      let encodedLen = -1;
      if (bestLen >= MIN_NORMAL_MATCH) {
        encodedLen = tryEncodableLength(bestOff, bestLen);
      }

      if (encodedLen >= 2) {
        writer.putBit(1);
        writer.putBit(0);
        /** @type {int32} */
        const high = OpCodes.Shr32(bestOff, 8);
        /** @type {int32} */
        const gammaOff = high + (lwm === 0 ? 3 : 2);
        writer.putGamma(gammaOff);
        writer.putByte(OpCodes.And32(bestOff, 0xFF));
        writer.putGamma(encodedLen);
        lwm = 1;

        /** @type {int32} */
        const end = pos + bestLen;
        for (let j = pos; j < end && j < data.length; ++j) {
          insertPos(data, j, head, prev);
        }
        pos = end;
      } else {
        writer.putBit(0);
        writer.putByte(data[pos]);
        lwm = 0;
        insertPos(data, pos, head, prev);
        pos++;
      }
    }

    // End-of-stream: "110" short match with a zero offset byte.
    writer.putBit(1);
    writer.putBit(1);
    writer.putBit(0);
    writer.putByte(0);

    /** @type {uint8[]} */
    const stream = writer.toArray();
    return stream;
  }

  /**
   * @param {uint8[]} compressed - Bare aPLib stream
   * @param {uint32} maxOutputSize - Decompressed size
   * @returns {uint8[]} Decoded bytes
   */
  function decompressRaw(compressed, maxOutputSize) {
    if (maxOutputSize < 0) {
      throw new Error('aPLib: negative decompressed size.');
    }
    if (compressed.length === 0 || maxOutputSize === 0) {
      /** @type {uint8[]} */
      const empty = [];
      return empty;
    }

    /** @type {uint8[]} */
    const output = new Array(maxOutputSize);
    /** @type {AplibReader} */
    const reader = new AplibReader(compressed);

    // aPLib copies the first byte verbatim before the token loop starts.
    /** @type {int32} */
    let op = 0;
    /** @type {uint8} */
    const firstByte = reader.readByte();
    output[op++] = firstByte;
    /** @type {int32} */
    let lwm = 0;
    /** @type {float64} */
    let r0 = 0;

    while (op < output.length) {
      /** @type {uint32} */
      const first = reader.readBit();
      if (first === 0) {
        // Literal.
        /** @type {uint8} */
        const literal = reader.readByte();
        output[op++] = literal;
        lwm = 0;
        continue;
      }

      /** @type {uint32} */
      const second = reader.readBit();
      if (second === 0) {
        // "10" - normal match.
        /** @type {float64} */
        let offs = reader.readGamma();
        /** @type {float64} */
        let len = 0;
        if (lwm === 0 && offs === 2) {
          offs = r0;
          len = reader.readGamma();
        } else {
          offs -= lwm === 0 ? 3 : 2;
          /** @type {uint8} */
          const low = reader.readByte();
          offs = offs * 256 + low;
          len = reader.readGamma();
          if (offs >= 32000) {
            len++;
          }
          if (offs >= 1280) {
            len++;
          }
          if (offs < 128) {
            len += 2;
          }
          r0 = offs;
        }
        op = copyMatch(output, op, offs, len);
        lwm = 1;
        continue;
      }

      /** @type {uint32} */
      const third = reader.readBit();
      if (third === 0) {
        // "110" - short match, or end-of-stream when offset is zero.
        /** @type {uint8} */
        const b = reader.readByte();
        if (b === 0) {
          break;
        }

        /** @type {int32} */
        const len = 2 + OpCodes.And32(b, 1);
        /** @type {int32} */
        const offs = OpCodes.Shr32(b, 1);
        op = copyMatch(output, op, offs, len);
        r0 = offs;
        lwm = 1;
        continue;
      }

      // "111" - 4-bit offset single byte, or literal zero.
      /** @type {int32} */
      let shortOffs = 0;
      for (let i = 0; i < 4; ++i) {
        /** @type {uint32} */
        const bit = reader.readBit();
        shortOffs = shortOffs * 2 + bit;
      }
      if (shortOffs === 0) {
        output[op++] = 0;
      } else {
        if (shortOffs > op) {
          throw new Error('aPLib: single-byte back-reference before start of output.');
        }
        output[op] = output[op - shortOffs];
        op++;
      }
      lwm = 0;
    }

    if (op === output.length) {
      return output;
    }
    return output.slice(0, op);
  }


  // ===== ALGORITHM IMPLEMENTATION =====

  class APLibCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "aPLib";
      this.description = "Joergen Ibsen's LZSS-based compression library, known for very small and fast decompressors. A 4-byte little-endian length header precedes a bare stream whose single MSB-first tag-bit sequence is interleaved in place (byte-aligned) with literal bytes and back-references (normal match, short match, single byte), selected by a tag-bit prefix, with gamma-coded numbers for offsets and lengths.";
      this.inventor = "Joergen Ibsen";
      this.year = 1998;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.DK;

      this.documentation = [
        new LinkItem("Ibsen Software - aPLib product page", "https://ibsensoftware.com/products_aPLib.html"),
        new LinkItem("The malware analyst's guide to aPLib decompression", "https://0xc0decafe.com/malware-analysts-guide-to-aplib-decompression")
      ];

      this.references = [
        new LinkItem("malduck aplib decompressor (independent reimplementation)", "https://malduck.readthedocs.io/en/v4.0.0/_modules/malduck/compression/aplib.html"),
        new LinkItem("apultra (aPLib-compatible optimal-parse compressor)", "https://github.com/emmanuel-marty/apultra")
      ];

      this.tests = [
        {
          text: "Empty input",
          uri: "https://ibsensoftware.com/products_aPLib.html",
          input: [],
          expected: [0, 0, 0, 0]
        },
        {
          text: "Single byte",
          uri: "https://ibsensoftware.com/products_aPLib.html",
          input: [0x41],
          expected: [1, 0, 0, 0, 65, 192, 0]
        },
        {
          text: "Repeated phrase (4x 'the quick brown fox jumps over the lazy dog. ')",
          uri: "https://ibsensoftware.com/products_aPLib.html",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. ".repeat(4)),
          expected: [180, 0, 0, 0, 116, 0, 104, 101, 32, 113, 117, 105, 99, 107, 0, 32, 98, 114, 111, 119, 110, 32, 102, 0, 111, 120, 32, 106, 117, 109, 112, 115, 2, 32, 111, 118, 101, 114, 32, 128, 31, 108, 97, 122, 121, 5, 32, 100, 111, 103, 46, 80, 14, 45, 170, 182, 0]
        },
        {
          text: "256 repeated bytes of 0x61",
          uri: "https://ibsensoftware.com/products_aPLib.html",
          input: new Array(256).fill(0x61),
          expected: [0, 1, 0, 0, 97, 175, 1, 253, 176, 0]
        },
        {
          text: "All 256 byte values, in order",
          uri: "https://ibsensoftware.com/products_aPLib.html",
          input: (function() { const a = new Array(256); for (let i = 0; i < 256; ++i) a[i] = i; return a; })(),
          expected: [0, 1, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 9, 10, 11, 12, 13, 14, 15, 16, 0, 17, 18, 19, 20, 21, 22, 23, 24, 0, 25, 26, 27, 28, 29, 30, 31, 32, 0, 33, 34, 35, 36, 37, 38, 39, 40, 0, 41, 42, 43, 44, 45, 46, 47, 48, 0, 49, 50, 51, 52, 53, 54, 55, 56, 0, 57, 58, 59, 60, 61, 62, 63, 64, 0, 65, 66, 67, 68, 69, 70, 71, 72, 0, 73, 74, 75, 76, 77, 78, 79, 80, 0, 81, 82, 83, 84, 85, 86, 87, 88, 0, 89, 90, 91, 92, 93, 94, 95, 96, 0, 97, 98, 99, 100, 101, 102, 103, 104, 0, 105, 106, 107, 108, 109, 110, 111, 112, 0, 113, 114, 115, 116, 117, 118, 119, 120, 0, 121, 122, 123, 124, 125, 126, 127, 128, 0, 129, 130, 131, 132, 133, 134, 135, 136, 0, 137, 138, 139, 140, 141, 142, 143, 144, 0, 145, 146, 147, 148, 149, 150, 151, 152, 0, 153, 154, 155, 156, 157, 158, 159, 160, 0, 161, 162, 163, 164, 165, 166, 167, 168, 0, 169, 170, 171, 172, 173, 174, 175, 176, 0, 177, 178, 179, 180, 181, 182, 183, 184, 0, 185, 186, 187, 188, 189, 190, 191, 192, 0, 193, 194, 195, 196, 197, 198, 199, 200, 0, 201, 202, 203, 204, 205, 206, 207, 208, 0, 209, 210, 211, 212, 213, 214, 215, 216, 0, 217, 218, 219, 220, 221, 222, 223, 224, 0, 225, 226, 227, 228, 229, 230, 231, 232, 0, 233, 234, 235, 236, 237, 238, 239, 240, 0, 241, 242, 243, 244, 245, 246, 247, 248, 1, 249, 250, 251, 252, 253, 254, 255, 128, 0]
        }
      ];
    }

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - True to decompress
     * @returns {APLibInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new APLibInstance(this, isInverse);
    }
  }

  class APLibInstance extends IAlgorithmInstance {
    /**
     * @param {APLibCompression} algorithm - Parent algorithm
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
      let result;
      if (this.isInverse) {
        result = this._decompress(this.inputBuffer);
      } else {
        result = this._compress(this.inputBuffer);
      }
      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;
      return result;
    }

    /**
     * @param {uint8[]} input - Input bytes
     * @returns {uint8[]} Size header and aPLib stream
     */
    _compress(input) {
      /** @type {uint8[]} */
      const header = OpCodes.Unpack32LE(input.length);
      if (input.length === 0) {
        return header;
      }
      /** @type {uint8[]} */
      const body = compressBare(input);
      for (let i = 0; i < body.length; i++) {
        header.push(body[i]);
      }
      return header;
    }

    /**
     * @param {uint8[]} input - Size header and aPLib stream
     * @returns {uint8[]} Decoded bytes
     */
    _decompress(input) {
      if (input.length < 4) {
        throw new Error('aPLib: input smaller than 4-byte header.');
      }
      /** @type {uint32} */
      const targetSize = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      if (targetSize === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }
      /** @type {uint8[]} */
      const decoded = decompressRaw(input.slice(4), targetSize);
      return decoded;
    }
  }


  // ===== REGISTRATION =====

  const algorithmInstance = new APLibCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { APLibCompression, APLibInstance };
}));
