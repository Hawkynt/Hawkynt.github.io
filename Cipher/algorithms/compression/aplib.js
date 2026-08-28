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

  const MIN_NORMAL_MATCH = 2;
  const MAX_CHAIN = 64;
  const MAX_MATCH = 0x10000;
  const HASH_SIZE = 0x10000;

  // ===== BIT/BYTE STREAM HELPERS (interleaved tag stream, MSB first) =====

  class AplibWriter {
    constructor() {
      this.out = [];
      this.tagPos = -1;
      this.bitsInTag = 0;
    }

    putBit(bit) {
      if (this.bitsInTag === 0) {
        this.tagPos = this.out.length;
        this.out.push(0);
      }
      if (bit) {
        const mask = OpCodes.Shl8(1, 7 - this.bitsInTag);
        this.out[this.tagPos] = OpCodes.Or8(this.out[this.tagPos], mask);
      }
      this.bitsInTag = (this.bitsInTag + 1) % 8;
    }

    putByte(value) {
      this.out.push(OpCodes.And8(value, 0xFF));
    }

    putGamma(value) {
      if (value < 2) throw new Error('aPLib gamma coding requires a value of at least 2.');

      let msb = 0;
      let v = value;
      while (v > 1) { msb++; v = Math.floor(v / 2); }

      for (let i = msb - 1; i >= 0; --i) {
        this.putBit(OpCodes.And32(OpCodes.Shr32(value, i), 1));
        this.putBit(i > 0 ? 1 : 0);
      }
    }

    toArray() {
      return this.out.slice();
    }
  }

  class AplibReader {
    constructor(data) {
      this.data = data;
      this.pos = 0;
      this.tag = 0;
      this.bitsLeft = 0;
    }

    readByte() {
      if (this.pos >= this.data.length) throw new Error('aPLib: unexpected end of stream.');
      return this.data[this.pos++];
    }

    readBit() {
      if (this.bitsLeft === 0) {
        this.tag = this.readByte();
        this.bitsLeft = 8;
      }
      const bit = OpCodes.And32(OpCodes.Shr32(this.tag, 7), 1);
      this.tag = OpCodes.And32(OpCodes.Shl32(this.tag, 1), 0xFF);
      this.bitsLeft--;
      return bit;
    }

    readGamma() {
      let result = 1;
      do {
        result = result * 2 + this.readBit();
      } while (this.readBit() === 1);
      return result;
    }
  }

  // ===== HASH-CHAIN MATCH FINDER =====

  function hash3(data, pos) {
    const h = OpCodes.Xor32(
      OpCodes.Xor32(OpCodes.Shl32(data[pos], 8), OpCodes.Shl32(data[pos + 1], 4)),
      data[pos + 2]
    );
    return OpCodes.And32(h, 0xFFFF);
  }

  function insertPos(data, pos, head, prev) {
    if (pos + 2 >= data.length) return;
    const h = hash3(data, pos);
    prev[pos] = head[h];
    head[h] = pos;
  }

  function findMatch(data, pos, head, prev) {
    let bestOff = 0;
    let bestLen = 0;
    if (pos + 2 >= data.length) return { bestOff, bestLen };

    let idx = head[hash3(data, pos)];
    let chain = 0;
    const maxLen = Math.min(data.length - pos, MAX_MATCH);

    while (idx >= 0 && chain < MAX_CHAIN) {
      const off = pos - idx;
      if (data[idx] === data[pos] && data[idx + bestLen] === data[pos + bestLen]) {
        let len = 0;
        while (len < maxLen && data[idx + len] === data[pos + len]) ++len;
        if (len > bestLen) {
          bestLen = len;
          bestOff = off;
          if (len >= maxLen) break;
        }
      }
      idx = prev[idx];
      chain++;
    }

    return { bestOff, bestLen };
  }

  // aPLib's normal-match length carries decode-time bumps depending on the
  // offset magnitude; the encoded gamma length must be the actual length
  // minus those bumps and stay at least 2 (the gamma minimum). Returns null
  // when a match is too short to encode at the given offset.
  function tryEncodableLength(offset, length) {
    const adjust = (offset >= 32000 ? 1 : 0) + (offset >= 1280 ? 1 : 0) + (offset < 128 ? 2 : 0);
    const encodedLen = length - adjust;
    return encodedLen >= 2 ? encodedLen : -1;
  }

  function copyMatch(output, op, offs, len) {
    if (offs <= 0 || offs > op) throw new Error('aPLib: match offset points before start of output.');
    const src = op - offs;
    let o = op;
    for (let i = 0; i < len && o < output.length; ++i) {
      output[o] = output[src + i];
      o++;
    }
    return o;
  }

  // ===== BARE STREAM CODEC =====

  function compressBare(data) {
    const writer = new AplibWriter();
    if (data.length === 0) return writer.toArray();

    // First byte verbatim, matching the depacker's pre-loop copy.
    writer.putByte(data[0]);

    const head = new Array(HASH_SIZE).fill(-1);
    const prev = new Array(data.length);
    insertPos(data, 0, head, prev);

    let lwm = 0;
    let pos = 1;
    while (pos < data.length) {
      const { bestOff, bestLen } = findMatch(data, pos, head, prev);
      const encodedLen = bestLen >= MIN_NORMAL_MATCH ? tryEncodableLength(bestOff, bestLen) : -1;

      if (encodedLen >= 2) {
        writer.putBit(1);
        writer.putBit(0);
        const gammaOff = OpCodes.Shr32(bestOff, 8) + (lwm === 0 ? 3 : 2);
        writer.putGamma(gammaOff);
        writer.putByte(OpCodes.And32(bestOff, 0xFF));
        writer.putGamma(encodedLen);
        lwm = 1;

        const end = pos + bestLen;
        for (let j = pos; j < end && j < data.length; ++j) insertPos(data, j, head, prev);
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

    return writer.toArray();
  }

  function decompressRaw(compressed, maxOutputSize) {
    if (maxOutputSize < 0) throw new Error('aPLib: negative decompressed size.');
    if (compressed.length === 0 || maxOutputSize === 0) return [];

    const output = new Array(maxOutputSize);
    const reader = new AplibReader(compressed);

    // aPLib copies the first byte verbatim before the token loop starts.
    let op = 0;
    output[op++] = reader.readByte();
    let lwm = 0;
    let r0 = 0;

    while (op < output.length) {
      if (reader.readBit() === 0) {
        // Literal.
        output[op++] = reader.readByte();
        lwm = 0;
        continue;
      }

      if (reader.readBit() === 0) {
        // "10" - normal match.
        let offs = reader.readGamma();
        let len;
        if (lwm === 0 && offs === 2) {
          offs = r0;
          len = reader.readGamma();
        } else {
          offs -= lwm === 0 ? 3 : 2;
          offs = offs * 256 + reader.readByte();
          len = reader.readGamma();
          if (offs >= 32000) len++;
          if (offs >= 1280) len++;
          if (offs < 128) len += 2;
          r0 = offs;
        }
        op = copyMatch(output, op, offs, len);
        lwm = 1;
        continue;
      }

      if (reader.readBit() === 0) {
        // "110" - short match, or end-of-stream when offset is zero.
        const b = reader.readByte();
        if (b === 0) break;

        const len = 2 + OpCodes.And32(b, 1);
        const offs = OpCodes.Shr32(b, 1);
        op = copyMatch(output, op, offs, len);
        r0 = offs;
        lwm = 1;
        continue;
      }

      // "111" - 4-bit offset single byte, or literal zero.
      let shortOffs = 0;
      for (let i = 0; i < 4; ++i) shortOffs = shortOffs * 2 + reader.readBit();
      if (shortOffs === 0) {
        output[op++] = 0;
      } else {
        if (shortOffs > op) throw new Error('aPLib: single-byte back-reference before start of output.');
        output[op] = output[op - shortOffs];
        op++;
      }
      lwm = 0;
    }

    return op === output.length ? output : output.slice(0, op);
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

    CreateInstance(isInverse = false) {
      return new APLibInstance(this, isInverse);
    }
  }

  class APLibInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }


    Result() {
      const result = this.isInverse ? this._decompress(this.inputBuffer) : this._compress(this.inputBuffer);
      this.inputBuffer = [];
      return result;
    }

    _compress(input) {
      const header = OpCodes.Unpack32LE(input.length);
      if (input.length === 0) return header;
      const body = compressBare(input);
      return header.concat(body);
    }

    _decompress(input) {
      if (input.length < 4) throw new Error('aPLib: input smaller than 4-byte header.');
      const targetSize = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      if (targetSize === 0) return [];
      return decompressRaw(input.slice(4), targetSize);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new APLibCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { APLibCompression, APLibInstance };
}));
