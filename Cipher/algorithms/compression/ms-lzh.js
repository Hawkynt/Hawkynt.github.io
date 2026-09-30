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
  /** @type {int32[]} */
  const LENGTH_BASE = [
    3, 4, 5, 6, 7, 8,
    9, 10,
    11, 13, 15, 17,
    19, 23, 27, 31,
    35, 43, 51, 59,
    67,
    67, 67, 67,
    67, 67, 67, 67,
    64
  ];
  /** @type {int32[]} */
  const LENGTH_EXTRA = [
    0, 0, 0, 0, 0, 0,
    0, 0,
    1, 1, 1, 1,
    2, 2, 2, 2,
    3, 3, 3, 3,
    0,
    0, 0, 0,
    0, 0, 0, 0,
    0
  ];

  // RFC 1951 section 3.2.5 distance codes: base distance and extra-bit count
  // for symbols 0..29. The 4 KiB window only ever reaches symbol 23.
  /** @type {int32[]} */
  const DISTANCE_BASE = [
    1, 2, 3, 4,
    5, 7, 9, 13,
    17, 25, 33, 49,
    65, 97, 129, 193,
    257, 385, 513, 769,
    1025, 1537, 2049, 3073,
    4097, 6145, 8193, 12289,
    16385, 24577
  ];
  /** @type {int32[]} */
  const DISTANCE_EXTRA = [
    0, 0, 0, 0,
    1, 1, 2, 2,
    3, 3, 4, 4,
    5, 5, 6, 6,
    7, 7, 8, 8,
    9, 9, 10, 10,
    11, 11, 12, 12,
    13, 13
  ];

  // RFC 1951 section 3.2.7 permutation for the code-length alphabet.
  /** @type {int32[]} */
  const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  /**
   * @param {int32} size - Number of entries
   * @returns {int32[]} Plain array of zeros
   */
  function zeroArray(size) {
    /** @type {int32[]} */
    const arr = new Array(size);
    for (let i = 0; i < size; ++i) {
      arr[i] = 0;
    }
    return arr;
  }

  /**
   * Symbol plus extra bits encoding one length or distance.
   */
  class SymbolCode {
    /**
     * @param {int32} symbol - Alphabet symbol
     * @param {int32} extraBits - Extra-bit count
     * @param {int32} extraValue - Extra-bit value
     */
    constructor(symbol, extraBits, extraValue) {
      /** @type {int32} */
      this.symbol = symbol;
      /** @type {int32} */
      this.extraBits = extraBits;
      /** @type {int32} */
      this.extraValue = extraValue;
    }
  }

  /**
   * @param {int32} length - Match length
   * @returns {SymbolCode} Length symbol and extra bits
   */
  function encodeLength(length) {
    if (length === MAX_MATCH) {
      return new SymbolCode(285, 0, 0);
    }

    for (let s = 0; s < LENGTH_BASE.length - 1; ++s) {
      /** @type {int32} */
      const baseLen = LENGTH_BASE[s];
      /** @type {int32} */
      const extraBits = LENGTH_EXTRA[s];
      /** @type {int32} */
      const span = OpCodes.Shl32(1, extraBits);
      /** @type {int32} */
      const maxLen = baseLen + span - 1;
      if (length >= baseLen && length <= maxLen) {
        return new SymbolCode(FIRST_LENGTH_SYMBOL + s, extraBits, length - baseLen);
      }
    }

    return new SymbolCode(285, 0, 0);
  }

  /**
   * @param {int32} distance - Match distance
   * @returns {SymbolCode} Distance symbol and extra bits
   */
  function encodeDistance(distance) {
    for (let s = 0; s < DISTANCE_BASE.length; ++s) {
      /** @type {int32} */
      const baseDist = DISTANCE_BASE[s];
      /** @type {int32} */
      const extraBits = DISTANCE_EXTRA[s];
      /** @type {int32} */
      const span = OpCodes.Shl32(1, extraBits);
      /** @type {int32} */
      const maxDist = baseDist + span - 1;
      if (distance >= baseDist && distance <= maxDist) {
        return new SymbolCode(s, extraBits, distance - baseDist);
      }
    }

    return new SymbolCode(0, 0, 0);
  }

  /**
   * @param {int32} symbol - Length symbol 257..285
   * @param {uint32} extraValue - Extra-bit value
   * @returns {float64} Match length, capped at MAX_MATCH
   */
  function decodeLength(symbol, extraValue) {
    if (symbol === 285) {
      return MAX_MATCH;
    }

    /** @type {float64} */
    const len = LENGTH_BASE[symbol - FIRST_LENGTH_SYMBOL] + extraValue;
    return len > MAX_MATCH ? MAX_MATCH : len;
  }

  // ===== BIT STREAM HELPERS (most-significant-bit first) =====

  class MsbBitWriter {
    constructor() {
      /** @type {uint8[]} */
      this.bytes = [];
      /** @type {uint32} */
      this.buffer = 0;
      /** @type {int32} */
      this.bitsInBuffer = 0;
    }

    /**
     * @param {uint32} bit - Bit to append (low bit used)
     */
    writeBit(bit) {
      this.buffer = OpCodes.Or32(this.buffer, OpCodes.Shl32(OpCodes.And32(bit, 1), 7 - this.bitsInBuffer));
      ++this.bitsInBuffer;
      if (this.bitsInBuffer !== 8) {
        return;
      }

      this.bytes.push(OpCodes.And32(this.buffer, 0xFF));
      this.buffer = 0;
      this.bitsInBuffer = 0;
    }

    /**
     * @param {uint32} value - Value whose low count bits are written
     * @param {int32} count - Bit count, most significant first
     */
    writeBits(value, count) {
      for (let i = 0; i < count; ++i) {
        this.writeBit(OpCodes.And32(OpCodes.Shr32(value, count - 1 - i), 1));
      }
    }

    flush() {
      if (this.bitsInBuffer <= 0) {
        return;
      }

      this.bytes.push(OpCodes.And32(this.buffer, 0xFF));
      this.buffer = 0;
      this.bitsInBuffer = 0;
    }
  }

  class MsbBitReader {
    /**
     * @param {uint8[]} bytes - Input
     * @param {int32} start - First byte of the bit stream
     */
    constructor(bytes, start) {
      /** @type {uint8[]} */
      this.bytes = bytes;
      /** @type {int32} */
      this.pos = start;
      /** @type {uint32} */
      this.buffer = 0;
      /** @type {int32} */
      this.bitsInBuffer = 0;
    }

    /**
     * @returns {uint32} Next bit; zero past the end of input
     */
    readBit() {
      if (this.bitsInBuffer === 0) {
        /** @type {uint32} */
        let next = 0;
        if (this.pos < this.bytes.length) {
          next = this.bytes[this.pos++];
        }
        this.buffer = next;
        this.bitsInBuffer = 8;
      }
      /** @type {uint32} */
      const bit = OpCodes.And32(OpCodes.Shr32(this.buffer, this.bitsInBuffer - 1), 1);
      --this.bitsInBuffer;
      return bit;
    }

    /**
     * @param {int32} count - Bit count, most significant first
     * @returns {uint32} Bits read
     */
    readBits(count) {
      /** @type {uint32} */
      let result = 0;
      for (let i = 0; i < count; ++i) {
        /** @type {uint32} */
        const bit = this.readBit();
        result = OpCodes.Or32(OpCodes.Shl32(result, 1), bit);
      }
      return result;
    }
  }

  // ===== CANONICAL HUFFMAN =====

  // Canonical assignment per RFC 1951 section 3.2.2: shortest codes first,
  // symbols of equal length in ascending symbol order.
  class CanonicalHuffman {
    /**
     * @param {int32[]} codeLengths - Code length per symbol, 0 when unused
     */
    constructor(codeLengths) {
      /** @type {int32[]} */
      this.lengths = codeLengths;
      /** @type {int32} */
      this.maxCodeLength = 0;
      for (let i = 0; i < codeLengths.length; ++i) {
        if (codeLengths[i] > this.maxCodeLength) {
          this.maxCodeLength = codeLengths[i];
        }
      }

      /** @type {int32[]} */
      this.codes = zeroArray(codeLengths.length);
      /** @type {int32[]} */
      this.firstCode = [];
      /** @type {int32[][]} */
      this.symbolsByLength = [];
      if (this.maxCodeLength === 0) {
        return;
      }

      /** @type {int32[]} */
      const blCount = zeroArray(this.maxCodeLength + 1);
      for (let i = 0; i < codeLengths.length; ++i) {
        if (codeLengths[i] > 0) {
          ++blCount[codeLengths[i]];
        }
      }

      /** @type {int32[]} */
      const nextCode = zeroArray(this.maxCodeLength + 1);
      /** @type {int32} */
      let code = 0;
      for (let b = 1; b <= this.maxCodeLength; ++b) {
        code = OpCodes.Shl32(code + blCount[b - 1], 1);
        nextCode[b] = code;
      }

      this.firstCode = nextCode.slice();
      for (let b = 0; b <= this.maxCodeLength; ++b) {
        /** @type {int32[]} */
        const bucket = [];
        this.symbolsByLength.push(bucket);
      }

      for (let sym = 0; sym < codeLengths.length; ++sym) {
        /** @type {int32} */
        const len = codeLengths[sym];
        if (len <= 0) {
          continue;
        }
        this.codes[sym] = nextCode[len]++;
        this.symbolsByLength[len].push(sym);
      }
    }

    /**
     * @param {MsbBitReader} reader - Input bit stream
     * @returns {int32} Decoded symbol
     */
    decodeSymbol(reader) {
      if (this.maxCodeLength === 0) {
        throw new Error('MS LZH: empty Huffman table');
      }

      /** @type {int32} */
      let code = 0;
      for (let len = 1; len <= this.maxCodeLength; ++len) {
        /** @type {uint32} */
        const bit = reader.readBit();
        code = OpCodes.Or32(OpCodes.Shl32(code, 1), bit);
        /** @type {int32[]} */
        const list = this.symbolsByLength[len];
        if (list.length > 0) {
          /** @type {int32} */
          const index = code - this.firstCode[len];
          if (index >= 0 && index < list.length) {
            return list[index];
          }
        }
      }
      throw new Error('MS LZH: invalid Huffman code');
    }
  }

  // Fixed tables: RFC 1951 section 3.2.6 shape over this codec's 286-symbol
  // literal/length alphabet and a flat 5-bit distance alphabet.
  /**
   * @returns {int32[]} Fixed literal/length code lengths
   */
  function buildFixedLitLenLengths() {
    /** @type {int32[]} */
    const lengths = zeroArray(LITLEN_ALPHABET_SIZE);
    for (let i = 0; i <= 143; ++i) {
      lengths[i] = 8;
    }
    for (let i = 144; i <= 255; ++i) {
      lengths[i] = 9;
    }
    for (let i = 256; i <= 279; ++i) {
      lengths[i] = 7;
    }
    for (let i = 280; i <= 285; ++i) {
      lengths[i] = 8;
    }
    return lengths;
  }

  /**
   * @returns {int32[]} Fixed distance code lengths
   */
  function buildFixedDistanceLengths() {
    /** @type {int32[]} */
    const lengths = zeroArray(DISTANCE_ALPHABET_SIZE);
    for (let i = 0; i < DISTANCE_ALPHABET_SIZE; ++i) {
      lengths[i] = 5;
    }
    return lengths;
  }

  /** @type {CanonicalHuffman} */
  const FIXED_LITLEN = new CanonicalHuffman(buildFixedLitLenLengths());
  /** @type {CanonicalHuffman} */
  const FIXED_DISTANCE = new CanonicalHuffman(buildFixedDistanceLengths());

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

  /**
   * Best match found by the greedy parser.
   */
  class MatchCandidate {
    /**
     * @param {int32} length - Match length, 0 when none
     * @param {int32} offset - Backward distance
     */
    constructor(length, offset) {
      /** @type {int32} */
      this.length = length;
      /** @type {int32} */
      this.offset = offset;
    }
  }

  /**
   * Huffman tables announced by a dynamic block header.
   */
  class DynamicTables {
    /**
     * @param {CanonicalHuffman} litLen - Literal/length table
     * @param {CanonicalHuffman} distance - Distance table
     */
    constructor(litLen, distance) {
      /** @type {CanonicalHuffman} */
      this.litLen = litLen;
      /** @type {CanonicalHuffman} */
      this.distance = distance;
    }
  }

  class MSLZHInstance extends IAlgorithmInstance {
    /**
     * @param {MSLZHAlgorithm} algorithm - Owning algorithm
     * @param {boolean} isInverse - True for decompression
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
    }


    /**
     * @returns {uint8[]} Compressed or decompressed bytes
     */
    Result() {
      if (this.isInverse) {
        if (this.inputBuffer.length === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }
        /** @type {uint8[]} */
        const decoded = this._decompress();
        this.inputBuffer = [];
        return decoded;
      }

      /** @type {uint8[]} */
      const encoded = this._compress();
      this.inputBuffer = [];
      return encoded;
    }

    // ===== COMPRESSION (greedy parse, fixed tables) =====

    /**
     * @returns {uint8[]} Size header followed by one fixed block
     */
    _compress() {
      /** @type {uint8[]} */
      const data = this.inputBuffer;
      /** @type {uint8[]} */
      const out = OpCodes.Unpack32LE(data.length);
      if (data.length === 0) {
        return out;
      }

      /** @type {MsbBitWriter} */
      const writer = new MsbBitWriter();
      writer.writeBit(BLOCK_TYPE_FIXED);
      MSLZHInstance._encodeBodyGreedyFixed(data, writer);

      writer.writeBits(FIXED_LITLEN.codes[END_OF_BLOCK_SYMBOL], FIXED_LITLEN.lengths[END_OF_BLOCK_SYMBOL]);
      writer.flush();

      for (let i = 0; i < writer.bytes.length; ++i) {
        out.push(writer.bytes[i]);
      }
      return out;
    }

    /**
     * @param {uint8[]} data - Input
     * @param {int32} pos - Position of the three hashed bytes
     * @returns {uint32} Hash bucket
     */
    static _hash3(data, pos) {
      return OpCodes.And32(
        OpCodes.Xor32(
          OpCodes.Xor32(OpCodes.Shl32(data[pos], 10), OpCodes.Shl32(data[pos + 1], 5)),
          data[pos + 2]
        ),
        HASH_MASK_GREEDY
      );
    }

    /**
     * @param {uint8[]} data - Input
     * @param {MsbBitWriter} writer - Output bit stream
     */
    static _encodeBodyGreedyFixed(data, writer) {
      /** @type {int32[]} */
      const hashHead = new Int32Array(HASH_SIZE_GREEDY).fill(-1);
      /** @type {int32[]} */
      const hashNext = new Int32Array(data.length).fill(-1);

      /** @type {int32} */
      let pos = 0;
      while (pos < data.length) {
        if (pos + 2 < data.length) {
          /** @type {int32} */
          const h = MSLZHInstance._hash3(data, pos);
          hashNext[pos] = hashHead[h];
          hashHead[h] = pos;
        }

        /** @type {MatchCandidate} */
        const best = MSLZHInstance._findBestMatch(data, pos, hashHead, hashNext, MIN_MATCH, MAX_CHAIN_GREEDY);

        if (best.length >= MIN_MATCH) {
          MSLZHInstance._writeMatchFixed(writer, best.length, best.offset);

          /** @type {int32} */
          const insertEnd = Math.min(pos + best.length, data.length - 2);
          for (let j = pos + 1; j < insertEnd; ++j) {
            /** @type {int32} */
            const h = MSLZHInstance._hash3(data, j);
            hashNext[j] = hashHead[h];
            hashHead[h] = j;
          }
          pos += best.length;
        } else {
          /** @type {uint8} */
          const literal = data[pos];
          writer.writeBits(FIXED_LITLEN.codes[literal], FIXED_LITLEN.lengths[literal]);
          ++pos;
        }
      }
    }

    /**
     * @param {uint8[]} data - Input
     * @param {int32} pos - Current position
     * @param {int32[]} hashHead - Bucket heads
     * @param {int32[]} hashNext - Chain links
     * @param {int32} minMatch - Shortest usable match
     * @param {int32} maxChainLen - Chain walk limit
     * @returns {MatchCandidate} Longest (earliest on ties) match
     */
    static _findBestMatch(data, pos, hashHead, hashNext, minMatch, maxChainLen) {
      if (pos + minMatch > data.length) {
        return new MatchCandidate(0, 0);
      }

      /** @type {int32} */
      let bestLen = 0;
      /** @type {int32} */
      let bestOff = 0;
      /** @type {int32} */
      const minPos = Math.max(0, pos - WINDOW_SIZE);
      /** @type {int32} */
      let idx = hashNext[pos];
      /** @type {int32} */
      let chainLen = 0;
      /** @type {int32} */
      const maxLen = Math.min(data.length - pos, MAX_MATCH);

      while (idx >= minPos && idx < pos && chainLen < maxChainLen) {
        if (data[idx] === data[pos]
            && data[idx + 1] === data[pos + 1]
            && data[idx + 2] === data[pos + 2]) {
          /** @type {int32} */
          let len = 3;
          while (len < maxLen && data[idx + len] === data[pos + len]) {
            ++len;
          }
          if (len > bestLen && len >= minMatch) {
            bestLen = len;
            bestOff = pos - idx;
            if (bestLen >= maxLen) {
              break;
            }
          }
        }
        idx = hashNext[idx];
        ++chainLen;
      }

      return new MatchCandidate(bestLen, bestOff);
    }

    /**
     * @param {MsbBitWriter} writer - Output bit stream
     * @param {int32} length - Match length
     * @param {int32} distance - Match distance
     */
    static _writeMatchFixed(writer, length, distance) {
      /** @type {SymbolCode} */
      const len = encodeLength(length);
      writer.writeBits(FIXED_LITLEN.codes[len.symbol], FIXED_LITLEN.lengths[len.symbol]);
      if (len.extraBits > 0) {
        writer.writeBits(len.extraValue, len.extraBits);
      }

      /** @type {SymbolCode} */
      const dist = encodeDistance(distance);
      writer.writeBits(FIXED_DISTANCE.codes[dist.symbol], FIXED_DISTANCE.lengths[dist.symbol]);
      if (dist.extraBits > 0) {
        writer.writeBits(dist.extraValue, dist.extraBits);
      }
    }

    // ===== DECOMPRESSION =====

    /**
     * @returns {uint8[]} Decompressed bytes
     */
    _decompress() {
      /** @type {uint8[]} */
      const data = this.inputBuffer;
      if (data.length < 4) {
        throw new Error('MS LZH: input too small for header');
      }

      /** @type {uint32} */
      const originalSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      if (originalSize === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      /** @type {MsbBitReader} */
      const reader = new MsbBitReader(data, 4);
      /** @type {uint8[]} */
      const output = new Array(originalSize);
      /** @type {float64} */
      let pos = 0;
      /** @type {float64} */
      const sizeValue = originalSize;
      /** @type {float64} */
      let safety = sizeValue * 8 + 1024;

      while (pos < originalSize) {
        /** @type {uint32} */
        const blockType = reader.readBit();
        /** @type {CanonicalHuffman} */
        let litLenHuf = FIXED_LITLEN;
        /** @type {CanonicalHuffman} */
        let distHuf = FIXED_DISTANCE;
        if (blockType === BLOCK_TYPE_FIXED) {
          litLenHuf = FIXED_LITLEN;
          distHuf = FIXED_DISTANCE;
        } else if (blockType === BLOCK_TYPE_DYNAMIC) {
          /** @type {DynamicTables} */
          const tables = MSLZHInstance._readDynamicHeader(reader);
          litLenHuf = tables.litLen;
          distHuf = tables.distance;
        } else {
          throw new Error('MS LZH: invalid block-type bit ' + blockType);
        }

        while (pos < originalSize && safety-- > 0) {
          /** @type {int32} */
          const symbol = litLenHuf.decodeSymbol(reader);
          if (symbol < 256) {
            output[pos++] = symbol;
            continue;
          }
          if (symbol === END_OF_BLOCK_SYMBOL) {
            break;
          }
          if (symbol > 285) {
            throw new Error('MS LZH: invalid literal/length symbol ' + symbol);
          }

          /** @type {int32} */
          const lenExtraBits = LENGTH_EXTRA[symbol - FIRST_LENGTH_SYMBOL];
          /** @type {uint32} */
          let lenExtraValue = 0;
          if (lenExtraBits > 0) {
            lenExtraValue = reader.readBits(lenExtraBits);
          }
          /** @type {float64} */
          const length = decodeLength(symbol, lenExtraValue);

          /** @type {int32} */
          const distSym = distHuf.decodeSymbol(reader);
          if (distSym < 0 || distSym >= DISTANCE_ALPHABET_SIZE) {
            throw new Error('MS LZH: invalid distance symbol ' + distSym);
          }

          /** @type {int32} */
          const distExtraBits = DISTANCE_EXTRA[distSym];
          /** @type {uint32} */
          let distExtraValue = 0;
          if (distExtraBits > 0) {
            distExtraValue = reader.readBits(distExtraBits);
          }
          /** @type {float64} */
          const distance = DISTANCE_BASE[distSym] + distExtraValue;

          if (distance < 1 || distance > pos) {
            throw new Error('MS LZH: invalid distance ' + distance + ' at pos ' + pos);
          }
          if (pos + length > originalSize) {
            throw new Error('MS LZH: match would overrun output');
          }

          /** @type {float64} */
          const srcPos = pos - distance;
          for (let j = 0; j < length; ++j) {
            output[pos + j] = output[srcPos + j];
          }
          pos += length;
        }

        if (safety <= 0) {
          throw new Error('MS LZH: decoder safety counter exhausted');
        }
      }

      if (pos !== originalSize) {
        throw new Error('MS LZH: output underrun');
      }

      return output;
    }

    // Reads the RFC 1951 section 3.2.7 style dynamic-block header.
    /**
     * @param {MsbBitReader} reader - Input bit stream
     * @returns {DynamicTables} Literal/length and distance tables
     */
    static _readDynamicHeader(reader) {
      /** @type {int32} */
      const hlitField = reader.readBits(5);
      /** @type {int32} */
      const hdistField = reader.readBits(5);
      /** @type {int32} */
      const hclenField = reader.readBits(4);
      /** @type {int32} */
      const hlit = hlitField + 257;
      /** @type {int32} */
      const hdist = hdistField + 1;
      /** @type {int32} */
      const hclen = hclenField + 4;

      if (hlit > LITLEN_ALPHABET_SIZE) {
        throw new Error('MS LZH: dynamic block HLIT ' + hlit + ' exceeds literal/length alphabet');
      }
      if (hdist > DISTANCE_ALPHABET_SIZE) {
        throw new Error('MS LZH: dynamic block HDIST ' + hdist + ' exceeds distance alphabet');
      }
      if (hclen > CODE_LENGTH_ALPHABET_SIZE) {
        throw new Error('MS LZH: dynamic block HCLEN ' + hclen + ' exceeds code-length alphabet');
      }

      /** @type {int32[]} */
      const clLengths = zeroArray(CODE_LENGTH_ALPHABET_SIZE);
      for (let k = 0; k < hclen; ++k) {
        /** @type {int32} */
        const bits = reader.readBits(3);
        clLengths[CODE_LENGTH_ORDER[k]] = bits;
      }

      /** @type {CanonicalHuffman} */
      const clHuf = new CanonicalHuffman(clLengths);
      if (clHuf.maxCodeLength === 0) {
        throw new Error('MS LZH: dynamic block code-length table is empty');
      }

      /** @type {int32[]} */
      const merged = zeroArray(hlit + hdist);
      /** @type {int32} */
      let idx = 0;
      while (idx < merged.length) {
        /** @type {int32} */
        const sym = clHuf.decodeSymbol(reader);
        if (sym <= 15) {
          merged[idx++] = sym;
        } else if (sym === 16) {
          if (idx === 0) {
            throw new Error('MS LZH: dynamic block code-length symbol 16 at start of list');
          }
          /** @type {int32} */
          const repeatField = reader.readBits(2);
          /** @type {int32} */
          let repeat = repeatField + 3;
          /** @type {int32} */
          const prev = merged[idx - 1];
          while (repeat-- > 0 && idx < merged.length) {
            merged[idx++] = prev;
          }
        } else if (sym === 17) {
          /** @type {int32} */
          const repeatField = reader.readBits(3);
          /** @type {int32} */
          let repeat = repeatField + 3;
          while (repeat-- > 0 && idx < merged.length) {
            merged[idx++] = 0;
          }
        } else if (sym === 18) {
          /** @type {int32} */
          const repeatField = reader.readBits(7);
          /** @type {int32} */
          let repeat = repeatField + 11;
          while (repeat-- > 0 && idx < merged.length) {
            merged[idx++] = 0;
          }
        } else {
          throw new Error('MS LZH: dynamic block code-length symbol ' + sym + ' unrecognised');
        }
      }

      /** @type {int32[]} */
      const litLenLengths = zeroArray(LITLEN_ALPHABET_SIZE);
      for (let i = 0; i < hlit; ++i) {
        litLenLengths[i] = merged[i];
      }
      /** @type {int32[]} */
      const distLengths = zeroArray(DISTANCE_ALPHABET_SIZE);
      for (let i = 0; i < hdist; ++i) {
        distLengths[i] = merged[hlit + i];
      }

      return new DynamicTables(new CanonicalHuffman(litLenLengths), new CanonicalHuffman(distLengths));
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
