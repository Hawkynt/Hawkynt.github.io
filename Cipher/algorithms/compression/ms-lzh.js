/*
 * MS-LZH Compression Algorithm (Microsoft DriveSpace 3 LZ77 + Huffman)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The codec Microsoft shipped with DriveSpace 3 (Windows 95 Plus! Pack,
 * 1995) is an LZ77 matcher over a 4 KiB window whose token stream is
 * entropy-coded with a DEFLATE-shaped alphabet: 286 literal/length symbols
 * with the end-of-block marker at 256, plus 30 distance symbols. The length
 * and distance extra-bit conventions follow RFC 1951 section 3.2.5.
 *
 * Stream layout produced here:
 *   - 4-byte little-endian uncompressed length
 *   - then, per block, one block-type bit written most-significant-bit
 *     first: 0 selects the fixed Huffman tables (RFC 1951 section 3.2.6
 *     shape - literals 0..143 are 8 bits, 144..255 are 9 bits, symbols
 *     256..279 are 7 bits, 280..285 are 8 bits, and every distance symbol
 *     is a flat 5 bits), 1 selects per-block dynamic tables laid out as in
 *     RFC 1951 section 3.2.7 (HLIT / HDIST / HCLEN, the 19-symbol
 *     code-length alphabet in permutation order, then the run-length coded
 *     literal/length and distance code-length lists)
 *   - the token payload, terminated by the end-of-block symbol 256
 *
 * The encoder emits fixed-table blocks from a greedy parse (hash-chain
 * depth 64, minimum match 3, maximum match 64); the decoder understands
 * both block types.
 *
 * Documentation and background:
 *   - RFC 1951, DEFLATE Compressed Data Format Specification
 *     (https://www.rfc-editor.org/rfc/rfc1951) - the length/distance code
 *     tables, fixed-table shape and dynamic header layout reused here.
 *   - libmspack notes on Microsoft's compression family
 *     (https://www.cabextract.org.uk/libmspack/doc/szdd_kwaj_format.html).
 *   - https://en.wikipedia.org/wiki/DriveSpace - the product this codec
 *     shipped in.
 *
 * The per-cluster framing of a real DRVSPACE.000 image (block-count bytes,
 * dictionary initialisation) is not part of this building block, so the
 * stream is self-contained rather than a drop-in for a DriveSpace volume.
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
  const { RegisterAlgorithm, CategoryType, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== CONSTANTS =====

  const WINDOW_SIZE = 4096;
  const MIN_MATCH = 3;
  const MAX_MATCH = 64;
  const LITLEN_ALPHABET_SIZE = 286;
  const END_OF_BLOCK_SYMBOL = 256;
  const FIRST_LENGTH_SYMBOL = 257;
  const DISTANCE_ALPHABET_SIZE = 30;
  const CODE_LENGTH_ALPHABET_SIZE = 19;

  const BLOCK_TYPE_FIXED = 0;
  const BLOCK_TYPE_DYNAMIC = 1;

  const HASH_SIZE_GREEDY = 8192;
  const HASH_MASK_GREEDY = 0x1FFF;
  const MAX_CHAIN_GREEDY = 64;

  // RFC 1951 section 3.2.5 length codes: base length and extra-bit count for
  // symbols 257..285. Symbol 285 is special-cased to exactly MAX_MATCH.
  const LENGTH_CODES = [
    [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0],
    [9, 0], [10, 0],
    [11, 1], [13, 1], [15, 1], [17, 1],
    [19, 2], [23, 2], [27, 2], [31, 2],
    [35, 3], [43, 3], [51, 3], [59, 3],
    [67, 0],
    [67, 0], [67, 0], [67, 0],
    [67, 0], [67, 0], [67, 0], [67, 0],
    [64, 0]
  ];

  // RFC 1951 section 3.2.5 distance codes: base distance and extra-bit count
  // for symbols 0..29. The 4 KiB window only ever reaches symbol 23.
  const DISTANCE_CODES = [
    [1, 0], [2, 0], [3, 0], [4, 0],
    [5, 1], [7, 1], [9, 2], [13, 2],
    [17, 3], [25, 3], [33, 4], [49, 4],
    [65, 5], [97, 5], [129, 6], [193, 6],
    [257, 7], [385, 7], [513, 8], [769, 8],
    [1025, 9], [1537, 9], [2049, 10], [3073, 10],
    [4097, 11], [6145, 11], [8193, 12], [12289, 12],
    [16385, 13], [24577, 13]
  ];

  // RFC 1951 section 3.2.7 permutation for the code-length alphabet.
  const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  function encodeLength(length) {
    if (length === MAX_MATCH)
      return { symbol: 285, extraBits: 0, extraValue: 0 };

    for (let s = 0; s < LENGTH_CODES.length - 1; ++s) {
      const baseLen = LENGTH_CODES[s][0], extraBits = LENGTH_CODES[s][1];
      const maxLen = baseLen + OpCodes.Shl32(1, extraBits) - 1;
      if (length >= baseLen && length <= maxLen)
        return { symbol: FIRST_LENGTH_SYMBOL + s, extraBits: extraBits, extraValue: length - baseLen };
    }

    return { symbol: 285, extraBits: 0, extraValue: 0 };
  }

  function encodeDistance(distance) {
    for (let s = 0; s < DISTANCE_CODES.length; ++s) {
      const baseDist = DISTANCE_CODES[s][0], extraBits = DISTANCE_CODES[s][1];
      const maxDist = baseDist + OpCodes.Shl32(1, extraBits) - 1;
      if (distance >= baseDist && distance <= maxDist)
        return { symbol: s, extraBits: extraBits, extraValue: distance - baseDist };
    }

    return { symbol: 0, extraBits: 0, extraValue: 0 };
  }

  function decodeLength(symbol, extraValue) {
    if (symbol === 285)
      return MAX_MATCH;

    const len = LENGTH_CODES[symbol - FIRST_LENGTH_SYMBOL][0] + extraValue;
    return len > MAX_MATCH ? MAX_MATCH : len;
  }

  // ===== BIT STREAM HELPERS (most-significant-bit first) =====

  class MsbBitWriter {
    constructor() {
      this.bytes = [];
      this.buffer = 0;
      this.bitsInBuffer = 0;
    }

    writeBit(bit) {
      this.buffer = OpCodes.Or32(this.buffer, OpCodes.Shl32(OpCodes.And32(bit, 1), 7 - this.bitsInBuffer));
      ++this.bitsInBuffer;
      if (this.bitsInBuffer !== 8)
        return;

      this.bytes.push(OpCodes.And32(this.buffer, 0xFF));
      this.buffer = 0;
      this.bitsInBuffer = 0;
    }

    writeBits(value, count) {
      for (let i = 0; i < count; ++i)
        this.writeBit(OpCodes.And32(OpCodes.Shr32(value, count - 1 - i), 1));
    }

    flush() {
      if (this.bitsInBuffer <= 0)
        return;

      this.bytes.push(OpCodes.And32(this.buffer, 0xFF));
      this.buffer = 0;
      this.bitsInBuffer = 0;
    }
  }

  class MsbBitReader {
    constructor(bytes, start) {
      this.bytes = bytes;
      this.pos = start;
      this.buffer = 0;
      this.bitsInBuffer = 0;
    }

    readBit() {
      if (this.bitsInBuffer === 0) {
        this.buffer = this.pos < this.bytes.length ? this.bytes[this.pos++] : 0;
        this.bitsInBuffer = 8;
      }
      const bit = OpCodes.And32(OpCodes.Shr32(this.buffer, this.bitsInBuffer - 1), 1);
      --this.bitsInBuffer;
      return bit;
    }

    readBits(count) {
      let result = 0;
      for (let i = 0; i < count; ++i)
        result = OpCodes.Or32(OpCodes.Shl32(result, 1), this.readBit());
      return result;
    }
  }

  // ===== CANONICAL HUFFMAN =====

  // Canonical assignment per RFC 1951 section 3.2.2: shortest codes first,
  // symbols of equal length in ascending symbol order.
  class CanonicalHuffman {
    constructor(codeLengths) {
      this.lengths = codeLengths;
      this.maxCodeLength = 0;
      for (let i = 0; i < codeLengths.length; ++i)
        if (codeLengths[i] > this.maxCodeLength) this.maxCodeLength = codeLengths[i];

      this.codes = new Array(codeLengths.length).fill(0);
      this.firstCode = [];
      this.symbolsByLength = [];
      if (this.maxCodeLength === 0)
        return;

      const blCount = new Array(this.maxCodeLength + 1).fill(0);
      for (let i = 0; i < codeLengths.length; ++i)
        if (codeLengths[i] > 0) ++blCount[codeLengths[i]];

      const nextCode = new Array(this.maxCodeLength + 1).fill(0);
      let code = 0;
      for (let b = 1; b <= this.maxCodeLength; ++b) {
        code = OpCodes.Shl32(code + blCount[b - 1], 1);
        nextCode[b] = code;
      }

      this.firstCode = nextCode.slice();
      for (let b = 0; b <= this.maxCodeLength; ++b) this.symbolsByLength.push([]);

      for (let sym = 0; sym < codeLengths.length; ++sym) {
        const len = codeLengths[sym];
        if (len <= 0) continue;
        this.codes[sym] = nextCode[len]++;
        this.symbolsByLength[len].push(sym);
      }
    }

    getCode(symbol) {
      return { code: this.codes[symbol], length: this.lengths[symbol] };
    }

    decodeSymbol(reader) {
      if (this.maxCodeLength === 0)
        throw new Error('MS LZH: empty Huffman table');

      let code = 0;
      for (let len = 1; len <= this.maxCodeLength; ++len) {
        code = OpCodes.Or32(OpCodes.Shl32(code, 1), reader.readBit());
        const list = this.symbolsByLength[len];
        if (list.length > 0) {
          const index = code - this.firstCode[len];
          if (index >= 0 && index < list.length)
            return list[index];
        }
      }
      throw new Error('MS LZH: invalid Huffman code');
    }
  }

  // Fixed tables: RFC 1951 section 3.2.6 shape over this codec's 286-symbol
  // literal/length alphabet and a flat 5-bit distance alphabet.
  const FIXED_LITLEN_LENGTHS = (() => {
    const lengths = new Array(LITLEN_ALPHABET_SIZE).fill(0);
    for (let i = 0; i <= 143; ++i) lengths[i] = 8;
    for (let i = 144; i <= 255; ++i) lengths[i] = 9;
    for (let i = 256; i <= 279; ++i) lengths[i] = 7;
    for (let i = 280; i <= 285; ++i) lengths[i] = 8;
    return lengths;
  })();

  const FIXED_DISTANCE_LENGTHS = new Array(DISTANCE_ALPHABET_SIZE).fill(5);

  const FIXED_LITLEN = new CanonicalHuffman(FIXED_LITLEN_LENGTHS);
  const FIXED_DISTANCE = new CanonicalHuffman(FIXED_DISTANCE_LENGTHS);

  // ===== ALGORITHM =====

  class MSLZHAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "MS-LZH";
      this.description = "Microsoft DriveSpace 3 codec: LZ77 over a 4 KiB window feeding a DEFLATE-shaped alphabet of 286 literal/length symbols and 30 distance symbols. Blocks carry a leading type bit selecting the fixed Huffman tables or per-block dynamic tables in the RFC 1951 dynamic-header layout.";
      this.inventor = "Microsoft Corporation";
      this.year = 1995;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Hybrid";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("RFC 1951 - DEFLATE Compressed Data Format", "https://www.rfc-editor.org/rfc/rfc1951"),
        new LinkItem("DriveSpace", "https://en.wikipedia.org/wiki/DriveSpace"),
        new LinkItem("SZDD and KWAJ Compression Formats (libmspack)", "https://www.cabextract.org.uk/libmspack/doc/szdd_kwaj_format.html")
      ];

      this.references = [
        new LinkItem("libmspack", "https://github.com/kyz/libmspack"),
        new LinkItem("Canonical Huffman code", "https://en.wikipedia.org/wiki/Canonical_Huffman_code")
      ];

      // Test vectors cross-checked byte-for-byte against CompressionWorkbench's
      // BB_MsLzh building block (Compression.Core.Dictionary.MsLzh), the
      // authoritative wire format.
      this.tests = [
        {
          text: "Empty input - header only",
          uri: "https://www.rfc-editor.org/rfc/rfc1951",
          input: [],
          expected: [0x00, 0x00, 0x00, 0x00]
        },
        {
          text: "Single byte 'A' - one literal then end-of-block",
          uri: "https://www.rfc-editor.org/rfc/rfc1951",
          input: [0x41],
          expected: [
            0x01, 0x00, 0x00, 0x00, 0x38, 0x80
          ]
        },
        {
          text: "All literals (ABCD)",
          uri: "https://www.rfc-editor.org/rfc/rfc1951",
          input: OpCodes.AnsiToBytes("ABCD"),
          expected: [
            0x04, 0x00, 0x00, 0x00, 0x38, 0xB9, 0x39, 0xBA, 0x00
          ]
        },
        {
          text: "Simple repetition - AAAA",
          uri: "https://www.rfc-editor.org/rfc/rfc1951",
          input: OpCodes.AnsiToBytes("AAAA"),
          expected: [
            0x04, 0x00, 0x00, 0x00, 0x38, 0x81, 0x00, 0x00
          ]
        },
        {
          text: "Pattern ABCABC",
          uri: "https://www.rfc-editor.org/rfc/rfc1951",
          input: OpCodes.AnsiToBytes("ABCABC"),
          expected: [
            0x06, 0x00, 0x00, 0x00, 0x38, 0xB9, 0x39, 0x81, 0x10, 0x00
          ]
        },
        {
          text: "English text with repeats",
          uri: "https://www.rfc-editor.org/rfc/rfc1951",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. "),
          expected: [
            0x5A, 0x00, 0x00, 0x00, 0x52, 0x4C, 0x4A, 0xA8, 0x50, 0xD2, 0xCC, 0xC9,
            0xCD, 0xA8, 0x49, 0x51, 0x4F, 0xD3, 0xCF, 0x28, 0x4B, 0x4F, 0xD4, 0x28,
            0x4D, 0x52, 0xCE, 0xD0, 0x51, 0xA8, 0x4F, 0xD3, 0x4A, 0xD1, 0x28, 0x02,
            0x4E, 0x9C, 0x91, 0xAA, 0xA9, 0x50, 0x94, 0x9F, 0x97, 0x5E, 0x06, 0x74,
            0x8E, 0x56, 0x00
          ]
        },
        {
          text: "Long run - 256 bytes of 'a' (match length capped at 64)",
          uri: "https://www.rfc-editor.org/rfc/rfc1951",
          input: new Array(256).fill(0x61),
          expected: [
            0x00, 0x01, 0x00, 0x00, 0x48, 0xE2, 0x83, 0x14, 0x18, 0xA0, 0x29, 0x00,
            0x00
          ]
        },
        {
          text: "All 256 byte values in order",
          uri: "https://www.rfc-editor.org/rfc/rfc1951",
          input: (() => { const a = []; for (let i = 0; i < 256; ++i) a.push(i); return a; })(),
          expected: [
            0x00, 0x01, 0x00, 0x00, 0x18, 0x18, 0x99, 0x19, 0x9A, 0x1A, 0x9B, 0x1B,
            0x9C, 0x1C, 0x9D, 0x1D, 0x9E, 0x1E, 0x9F, 0x1F, 0xA0, 0x20, 0xA1, 0x21,
            0xA2, 0x22, 0xA3, 0x23, 0xA4, 0x24, 0xA5, 0x25, 0xA6, 0x26, 0xA7, 0x27,
            0xA8, 0x28, 0xA9, 0x29, 0xAA, 0x2A, 0xAB, 0x2B, 0xAC, 0x2C, 0xAD, 0x2D,
            0xAE, 0x2E, 0xAF, 0x2F, 0xB0, 0x30, 0xB1, 0x31, 0xB2, 0x32, 0xB3, 0x33,
            0xB4, 0x34, 0xB5, 0x35, 0xB6, 0x36, 0xB7, 0x37, 0xB8, 0x38, 0xB9, 0x39,
            0xBA, 0x3A, 0xBB, 0x3B, 0xBC, 0x3C, 0xBD, 0x3D, 0xBE, 0x3E, 0xBF, 0x3F,
            0xC0, 0x40, 0xC1, 0x41, 0xC2, 0x42, 0xC3, 0x43, 0xC4, 0x44, 0xC5, 0x45,
            0xC6, 0x46, 0xC7, 0x47, 0xC8, 0x48, 0xC9, 0x49, 0xCA, 0x4A, 0xCB, 0x4B,
            0xCC, 0x4C, 0xCD, 0x4D, 0xCE, 0x4E, 0xCF, 0x4F, 0xD0, 0x50, 0xD1, 0x51,
            0xD2, 0x52, 0xD3, 0x53, 0xD4, 0x54, 0xD5, 0x55, 0xD6, 0x56, 0xD7, 0x57,
            0xD8, 0x58, 0xD9, 0x59, 0xDA, 0x5A, 0xDB, 0x5B, 0xDC, 0x5C, 0xDD, 0x5D,
            0xDE, 0x5E, 0xDF, 0x5F, 0xE3, 0x31, 0xB8, 0xEC, 0x7E, 0x43, 0x23, 0x92,
            0xC9, 0xE5, 0x32, 0xB9, 0x6C, 0xBE, 0x63, 0x33, 0x9A, 0xCD, 0xE7, 0x33,
            0xB9, 0xEC, 0xFE, 0x83, 0x43, 0xA2, 0xD1, 0xE9, 0x34, 0xBA, 0x6D, 0x3E,
            0xA3, 0x53, 0xAA, 0xD5, 0xEB, 0x35, 0xBA, 0xED, 0x7E, 0xC3, 0x63, 0xB2,
            0xD9, 0xED, 0x36, 0xBB, 0x6D, 0xBE, 0xE3, 0x73, 0xBA, 0xDD, 0xEF, 0x37,
            0xBB, 0xED, 0xFF, 0x03, 0x83, 0xC2, 0xE1, 0xF1, 0x38, 0xBC, 0x6E, 0x3F,
            0x23, 0x93, 0xCA, 0xE5, 0xF3, 0x39, 0xBC, 0xEE, 0x7F, 0x43, 0xA3, 0xD2,
            0xE9, 0xF5, 0x3A, 0xBD, 0x6E, 0xBF, 0x63, 0xB3, 0xDA, 0xED, 0xF7, 0x3B,
            0xBD, 0xEE, 0xFF, 0x83, 0xC3, 0xE2, 0xF1, 0xF9, 0x3C, 0xBE, 0x6F, 0x3F,
            0xA3, 0xD3, 0xEA, 0xF5, 0xFB, 0x3D, 0xBE, 0xEF, 0x7F, 0xC3, 0xE3, 0xF2,
            0xF9, 0xFD, 0x3E, 0xBF, 0x6F, 0xBF, 0xE3, 0xF3, 0xFA, 0xFD, 0x80
          ]
        }
      ];

    }

    CreateInstance(isInverse = false) {
      return new MSLZHInstance(this, isInverse);
    }
  }

  class MSLZHInstance extends IAlgorithmInstance {
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
      if (this.isInverse) {
        if (this.inputBuffer.length === 0)
          return [];
        const decoded = this._decompress();
        this.inputBuffer = [];
        return decoded;
      }

      const encoded = this._compress();
      this.inputBuffer = [];
      return encoded;
    }

    // ===== COMPRESSION (greedy parse, fixed tables) =====

    _compress() {
      const data = this.inputBuffer;
      const out = OpCodes.Unpack32LE(data.length);
      if (data.length === 0)
        return out;

      const writer = new MsbBitWriter();
      writer.writeBit(BLOCK_TYPE_FIXED);
      MSLZHInstance._encodeBodyGreedyFixed(data, writer);

      const eof = FIXED_LITLEN.getCode(END_OF_BLOCK_SYMBOL);
      writer.writeBits(eof.code, eof.length);
      writer.flush();

      for (let i = 0; i < writer.bytes.length; ++i) out.push(writer.bytes[i]);
      return out;
    }

    static _hash3(data, pos) {
      return OpCodes.And32(
        OpCodes.Xor32(
          OpCodes.Xor32(OpCodes.Shl32(data[pos], 10), OpCodes.Shl32(data[pos + 1], 5)),
          data[pos + 2]
        ),
        HASH_MASK_GREEDY
      );
    }

    static _encodeBodyGreedyFixed(data, writer) {
      const hashHead = new Int32Array(HASH_SIZE_GREEDY).fill(-1);
      const hashNext = new Int32Array(data.length).fill(-1);

      let pos = 0;
      while (pos < data.length) {
        if (pos + 2 < data.length) {
          const h = MSLZHInstance._hash3(data, pos);
          hashNext[pos] = hashHead[h];
          hashHead[h] = pos;
        }

        const best = MSLZHInstance._findBestMatch(data, pos, hashHead, hashNext, MIN_MATCH, MAX_CHAIN_GREEDY);

        if (best.length >= MIN_MATCH) {
          MSLZHInstance._writeMatchFixed(writer, best.length, best.offset);

          const insertEnd = Math.min(pos + best.length, data.length - 2);
          for (let j = pos + 1; j < insertEnd; ++j) {
            const h = MSLZHInstance._hash3(data, j);
            hashNext[j] = hashHead[h];
            hashHead[h] = j;
          }
          pos += best.length;
        } else {
          const lit = FIXED_LITLEN.getCode(data[pos]);
          writer.writeBits(lit.code, lit.length);
          ++pos;
        }
      }
    }

    static _findBestMatch(data, pos, hashHead, hashNext, minMatch, maxChainLen) {
      if (pos + minMatch > data.length)
        return { length: 0, offset: 0 };

      let bestLen = 0;
      let bestOff = 0;
      const minPos = Math.max(0, pos - WINDOW_SIZE);
      let idx = hashNext[pos];
      let chainLen = 0;
      const maxLen = Math.min(data.length - pos, MAX_MATCH);

      while (idx >= minPos && idx < pos && chainLen < maxChainLen) {
        if (data[idx] === data[pos]
            && data[idx + 1] === data[pos + 1]
            && data[idx + 2] === data[pos + 2]) {
          let len = 3;
          while (len < maxLen && data[idx + len] === data[pos + len])
            ++len;
          if (len > bestLen && len >= minMatch) {
            bestLen = len;
            bestOff = pos - idx;
            if (bestLen >= maxLen)
              break;
          }
        }
        idx = hashNext[idx];
        ++chainLen;
      }

      return { length: bestLen, offset: bestOff };
    }

    static _writeMatchFixed(writer, length, distance) {
      const len = encodeLength(length);
      const lenCode = FIXED_LITLEN.getCode(len.symbol);
      writer.writeBits(lenCode.code, lenCode.length);
      if (len.extraBits > 0)
        writer.writeBits(len.extraValue, len.extraBits);

      const dist = encodeDistance(distance);
      const distCode = FIXED_DISTANCE.getCode(dist.symbol);
      writer.writeBits(distCode.code, distCode.length);
      if (dist.extraBits > 0)
        writer.writeBits(dist.extraValue, dist.extraBits);
    }

    // ===== DECOMPRESSION =====

    _decompress() {
      const data = this.inputBuffer;
      if (data.length < 4)
        throw new Error('MS LZH: input too small for header');

      const originalSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      if (originalSize === 0)
        return [];

      const reader = new MsbBitReader(data, 4);
      const output = new Array(originalSize);
      let pos = 0;
      let safety = originalSize * 8 + 1024;

      while (pos < originalSize) {
        const blockType = reader.readBit();
        let litLenHuf, distHuf;
        if (blockType === BLOCK_TYPE_FIXED) {
          litLenHuf = FIXED_LITLEN;
          distHuf = FIXED_DISTANCE;
        } else if (blockType === BLOCK_TYPE_DYNAMIC) {
          const tables = MSLZHInstance._readDynamicHeader(reader);
          litLenHuf = tables.litLen;
          distHuf = tables.distance;
        } else {
          throw new Error('MS LZH: invalid block-type bit ' + blockType);
        }

        while (pos < originalSize && safety-- > 0) {
          const symbol = litLenHuf.decodeSymbol(reader);
          if (symbol < 256) {
            output[pos++] = symbol;
            continue;
          }
          if (symbol === END_OF_BLOCK_SYMBOL)
            break;
          if (symbol > 285)
            throw new Error('MS LZH: invalid literal/length symbol ' + symbol);

          const lenExtraBits = LENGTH_CODES[symbol - FIRST_LENGTH_SYMBOL][1];
          const lenExtraValue = lenExtraBits > 0 ? reader.readBits(lenExtraBits) : 0;
          const length = decodeLength(symbol, lenExtraValue);

          const distSym = distHuf.decodeSymbol(reader);
          if (distSym < 0 || distSym >= DISTANCE_ALPHABET_SIZE)
            throw new Error('MS LZH: invalid distance symbol ' + distSym);

          const distExtraBits = DISTANCE_CODES[distSym][1];
          const distExtraValue = distExtraBits > 0 ? reader.readBits(distExtraBits) : 0;
          const distance = DISTANCE_CODES[distSym][0] + distExtraValue;

          if (distance < 1 || distance > pos)
            throw new Error('MS LZH: invalid distance ' + distance + ' at pos ' + pos);
          if (pos + length > originalSize)
            throw new Error('MS LZH: match would overrun output');

          const srcPos = pos - distance;
          for (let j = 0; j < length; ++j)
            output[pos + j] = output[srcPos + j];
          pos += length;
        }

        if (safety <= 0)
          throw new Error('MS LZH: decoder safety counter exhausted');
      }

      if (pos !== originalSize)
        throw new Error('MS LZH: output underrun');

      return output;
    }

    // Reads the RFC 1951 section 3.2.7 style dynamic-block header.
    static _readDynamicHeader(reader) {
      const hlit = reader.readBits(5) + 257;
      const hdist = reader.readBits(5) + 1;
      const hclen = reader.readBits(4) + 4;

      if (hlit > LITLEN_ALPHABET_SIZE)
        throw new Error('MS LZH: dynamic block HLIT ' + hlit + ' exceeds literal/length alphabet');
      if (hdist > DISTANCE_ALPHABET_SIZE)
        throw new Error('MS LZH: dynamic block HDIST ' + hdist + ' exceeds distance alphabet');
      if (hclen > CODE_LENGTH_ALPHABET_SIZE)
        throw new Error('MS LZH: dynamic block HCLEN ' + hclen + ' exceeds code-length alphabet');

      const clLengths = new Array(CODE_LENGTH_ALPHABET_SIZE).fill(0);
      for (let k = 0; k < hclen; ++k)
        clLengths[CODE_LENGTH_ORDER[k]] = reader.readBits(3);

      const clHuf = new CanonicalHuffman(clLengths);
      if (clHuf.maxCodeLength === 0)
        throw new Error('MS LZH: dynamic block code-length table is empty');

      const merged = new Array(hlit + hdist).fill(0);
      let idx = 0;
      while (idx < merged.length) {
        const sym = clHuf.decodeSymbol(reader);
        if (sym <= 15) {
          merged[idx++] = sym;
        } else if (sym === 16) {
          if (idx === 0)
            throw new Error('MS LZH: dynamic block code-length symbol 16 at start of list');
          let repeat = reader.readBits(2) + 3;
          const prev = merged[idx - 1];
          while (repeat-- > 0 && idx < merged.length) merged[idx++] = prev;
        } else if (sym === 17) {
          let repeat = reader.readBits(3) + 3;
          while (repeat-- > 0 && idx < merged.length) merged[idx++] = 0;
        } else if (sym === 18) {
          let repeat = reader.readBits(7) + 11;
          while (repeat-- > 0 && idx < merged.length) merged[idx++] = 0;
        } else {
          throw new Error('MS LZH: dynamic block code-length symbol ' + sym + ' unrecognised');
        }
      }

      const litLenLengths = new Array(LITLEN_ALPHABET_SIZE).fill(0);
      for (let i = 0; i < hlit; ++i) litLenLengths[i] = merged[i];
      const distLengths = new Array(DISTANCE_ALPHABET_SIZE).fill(0);
      for (let i = 0; i < hdist; ++i) distLengths[i] = merged[hlit + i];

      return { litLen: new CanonicalHuffman(litLenLengths), distance: new CanonicalHuffman(distLengths) };
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new MSLZHAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { MSLZHAlgorithm, MSLZHInstance };
}));
