/*
 * Deflate64 (PKWARE Enhanced Deflate) Compression Algorithm
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Deflate64 is PKWARE's proprietary extension of RFC 1951 DEFLATE, exposed
 * as ZIP compression method 9 ("Enhanced Deflating using Deflate64").
 * It keeps DEFLATE's LZ77 + Huffman design but changes three parameters:
 *   - the sliding window grows from 32 KiB to 64 KiB (65536 bytes),
 *   - length code 285 no longer means a fixed length of 258: it instead
 *     carries 16 extra bits on top of a base of 3, covering lengths from
 *     3 up to 65538 so a single symbol can express very long matches,
 *   - two distance codes (30 and 31) are added beyond DEFLATE's 0-29,
 *     with bases 32769 and 49153 and 14 extra bits each, so matches can
 *     reach anywhere inside the enlarged window.
 * The two extra distance codes were already reserved-but-unused slots in
 * the standard fixed Huffman distance alphabet (5 bits, 32 symbols), so
 * the fixed Huffman code tables themselves are unchanged from RFC 1951 -
 * only the *meaning* of symbol 285 and of distance symbols 30/31 differs.
 *
 * This implementation only emits/reads fixed Huffman blocks (BTYPE=01)
 * plus stored blocks (BTYPE=00); dynamic Huffman blocks (BTYPE=10) are not
 * required for a faithful round trip and are therefore not produced.
 *
 * Parameter values (window size, extra-bit counts, base values) were
 * confirmed against:
 *   - Wikipedia, "Deflate - Enhanced Deflate (Deflate64)":
 *     https://en.wikipedia.org/wiki/Deflate#Enhanced_Deflate_(Deflate64)
 *   - RFC 1951, "DEFLATE Compressed Data Format Specification version 1.3":
 *     https://www.rfc-editor.org/rfc/rfc1951
 * No code was copied from any source; the bitstream and Huffman logic
 * below is an independent implementation derived from the RFC text.
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

  // ===== DEFLATE64 CONSTANTS =====

  // Length codes 257-285 (extra bits). Codes 257-284 are identical to
  // plain DEFLATE; code 285 is the Deflate64 extension: base 3, 16 extra
  // bits, so it alone can represent any length from 3 to 65538 and is used
  // for every match longer than 258 bytes.
  const LENGTH_CODES = [
    {base: 3, extra: 0},    // 257
    {base: 4, extra: 0},    // 258
    {base: 5, extra: 0},    // 259
    {base: 6, extra: 0},    // 260
    {base: 7, extra: 0},    // 261
    {base: 8, extra: 0},    // 262
    {base: 9, extra: 0},    // 263
    {base: 10, extra: 0},   // 264
    {base: 11, extra: 1},   // 265
    {base: 13, extra: 1},   // 266
    {base: 15, extra: 1},   // 267
    {base: 17, extra: 1},   // 268
    {base: 19, extra: 2},   // 269
    {base: 23, extra: 2},   // 270
    {base: 27, extra: 2},   // 271
    {base: 31, extra: 2},   // 272
    {base: 35, extra: 3},   // 273
    {base: 43, extra: 3},   // 274
    {base: 51, extra: 3},   // 275
    {base: 59, extra: 3},   // 276
    {base: 67, extra: 4},   // 277
    {base: 83, extra: 4},   // 278
    {base: 99, extra: 4},   // 279
    {base: 115, extra: 4},  // 280
    {base: 131, extra: 5},  // 281
    {base: 163, extra: 5},  // 282
    {base: 195, extra: 5},  // 283
    {base: 227, extra: 5},  // 284
    {base: 3, extra: 16}    // 285 (Deflate64: base 3, 16 extra bits, up to 65538)
  ];

  // Distance codes 0-31 (extra bits). Codes 0-29 are identical to plain
  // DEFLATE; codes 30 and 31 are the Deflate64 extension reaching into the
  // enlarged 64 KiB window.
  const DISTANCE_CODES = [
    {base: 1, extra: 0},     // 0
    {base: 2, extra: 0},     // 1
    {base: 3, extra: 0},     // 2
    {base: 4, extra: 0},     // 3
    {base: 5, extra: 1},     // 4
    {base: 7, extra: 1},     // 5
    {base: 9, extra: 2},     // 6
    {base: 13, extra: 2},    // 7
    {base: 17, extra: 3},    // 8
    {base: 25, extra: 3},    // 9
    {base: 33, extra: 4},    // 10
    {base: 49, extra: 4},    // 11
    {base: 65, extra: 5},    // 12
    {base: 97, extra: 5},    // 13
    {base: 129, extra: 6},   // 14
    {base: 193, extra: 6},   // 15
    {base: 257, extra: 7},   // 16
    {base: 385, extra: 7},   // 17
    {base: 513, extra: 8},   // 18
    {base: 769, extra: 8},   // 19
    {base: 1025, extra: 9},  // 20
    {base: 1537, extra: 9},  // 21
    {base: 2049, extra: 10}, // 22
    {base: 3073, extra: 10}, // 23
    {base: 4097, extra: 11}, // 24
    {base: 6145, extra: 11}, // 25
    {base: 8193, extra: 12}, // 26
    {base: 12289, extra: 12},// 27
    {base: 16385, extra: 13},// 28
    {base: 24577, extra: 13},// 29
    {base: 32769, extra: 14},// 30 (Deflate64 extension)
    {base: 49153, extra: 14} // 31 (Deflate64 extension)
  ];

  // Fixed Huffman code lengths (RFC 1951 section 3.2.6). Deflate64 reuses
  // these unchanged: the literal/length alphabet still assigns 8/9/7/8 bit
  // codes to symbols 0-287 (symbols 286-287 stay unused), and the distance
  // alphabet still assigns 5 bits to all 32 symbols - codes 30/31 were
  // already reserved slots that Deflate64 now puts to use.
  const FIXED_LITERAL_LENGTHS = (() => {
    const lengths = new Array(288);
    for (let i = 0; i <= 143; ++i) lengths[i] = 8;
    for (let i = 144; i <= 255; ++i) lengths[i] = 9;
    for (let i = 256; i <= 279; ++i) lengths[i] = 7;
    for (let i = 280; i <= 287; ++i) lengths[i] = 8;
    return lengths;
  })();

  const FIXED_DISTANCE_LENGTHS = new Array(32).fill(5);

  // ===== BIT STREAM HELPER =====

  class BitStream {
    constructor() {
      this.bytes = [];
      this.bitBuffer = 0;
      this.bitCount = 0;
    }

    writeBits(value, numBits) {
      this.bitBuffer = OpCodes.ToUint32(OpCodes.OrN(this.bitBuffer, OpCodes.Shl32(value, this.bitCount)));
      this.bitCount += numBits;

      while (this.bitCount >= 8) {
        this.bytes.push(OpCodes.AndN(this.bitBuffer, 0xFF));
        this.bitBuffer = OpCodes.Shr32(this.bitBuffer, 8);
        this.bitCount -= 8;
      }
    }

    // Write Huffman code in reversed bit order (RFC 1951 requirement)
    writeHuffmanCode(code, length) {
      let reversed = 0;
      for (let i = 0; i < length; ++i) {
        const bit = OpCodes.AndN(OpCodes.Shr16(code, i), 1);
        reversed = OpCodes.AndN(OpCodes.OrN(reversed, OpCodes.Shl16(bit, length - 1 - i)), 0xFFFF);
      }
      this.writeBits(reversed, length);
    }

    flush() {
      if (this.bitCount > 0) {
        this.bytes.push(OpCodes.AndN(this.bitBuffer, 0xFF));
        this.bitBuffer = 0;
        this.bitCount = 0;
      }
      return this.bytes;
    }

    getBytes() {
      return this.bytes.slice();
    }
  }

  class BitReader {
    constructor(bytes) {
      this.bytes = bytes;
      this.bytePos = 0;
      this.bitBuffer = 0;
      this.bitCount = 0;
    }

    readBits(numBits) {
      while (this.bitCount < numBits) {
        if (this.bytePos >= this.bytes.length) {
          throw new Error('Unexpected end of compressed data');
        }
        this.bitBuffer = OpCodes.ToUint32(OpCodes.OrN(this.bitBuffer, OpCodes.Shl32(this.bytes[this.bytePos++], this.bitCount)));
        this.bitCount += 8;
      }

      const mask = OpCodes.ToUint32(OpCodes.Shl32(1, numBits) - 1);
      const value = OpCodes.AndN(this.bitBuffer, mask);
      this.bitBuffer = OpCodes.Shr32(this.bitBuffer, numBits);
      this.bitCount -= numBits;
      return value;
    }

    alignToByte() {
      this.bitBuffer = 0;
      this.bitCount = 0;
    }

    hasMore() {
      return this.bytePos < this.bytes.length || this.bitCount > 0;
    }
  }

  // ===== HUFFMAN TREE =====

  class HuffmanTree {
    constructor() {
      this.root = null;
    }

    static buildFromLengths(lengths) {
      const tree = new HuffmanTree();
      const maxLen = Math.max(...lengths.filter(l => l > 0));
      if (maxLen === 0) return tree;

      // RFC 1951 algorithm for generating codes from lengths
      const blCount = new Array(maxLen + 1).fill(0);
      for (const len of lengths) {
        if (len > 0) blCount[len]++;
      }

      const nextCode = new Array(maxLen + 1);
      let code = 0;
      blCount[0] = 0;

      for (let bits = 1; bits <= maxLen; ++bits) {
        code = OpCodes.Shl16(code + blCount[bits - 1], 1);
        nextCode[bits] = code;
      }

      // Assign codes to symbols
      const codes = new Array(lengths.length);
      for (let n = 0; n < lengths.length; ++n) {
        const len = lengths[n];
        if (len !== 0) {
          codes[n] = {code: nextCode[len], length: len};
          nextCode[len]++;
        }
      }

      // Build tree from codes
      tree.root = {};
      for (let symbol = 0; symbol < codes.length; ++symbol) {
        if (!codes[symbol]) continue;

        let node = tree.root;
        const {code, length} = codes[symbol];

        for (let i = length - 1; i >= 0; --i) {
          const bit = OpCodes.AndN(OpCodes.Shr16(code, i), 1);
          const key = bit ? 'one' : 'zero';

          if (i === 0) {
            node[key] = {symbol: symbol};
          } else {
            if (!node[key]) node[key] = {};
            node = node[key];
          }
        }
      }

      tree.codes = codes;
      return tree;
    }

    decode(bitReader) {
      let node = this.root;
      if (!node) throw new Error('Invalid Huffman tree');

      while (node.symbol === undefined) {
        const bit = bitReader.readBits(1);
        node = bit ? node.one : node.zero;
        if (!node) throw new Error('Invalid Huffman code');
      }

      return node.symbol;
    }

    encode(symbol) {
      if (!this.codes || !this.codes[symbol]) {
        throw new Error(`No Huffman code for symbol ${symbol}`);
      }
      return this.codes[symbol];
    }
  }

  // ===== DEFLATE64 ALGORITHM =====

  class Deflate64Algorithm extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Deflate64";
      this.description = "PKWARE's Enhanced Deflate variant, exposed as ZIP compression method 9. Extends RFC 1951 DEFLATE with a 64 KiB sliding window, a 16-bit extended length code (up to 65538 bytes) replacing the fixed length-258 code 285, and two additional distance codes reaching the larger window.";
      this.inventor = "PKWARE, Inc.";
      this.year = 2001;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Hybrid";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Deflate64 configuration (64 KiB window, extended length/distance ranges)
      this.WINDOW_SIZE = 65536;      // 64K window (vs 32K in plain DEFLATE)
      this.MAX_MATCH = 65538;        // Maximum match length (base 3 + 16 extra bits)
      this.MIN_MATCH = 3;            // Minimum match length
      this.HASH_BITS = 15;           // Hash table size
      this.HASH_SIZE = OpCodes.Shl32(1, this.HASH_BITS);
      this.HASH_MASK = OpCodes.ToUint32(this.HASH_SIZE - 1);

      // Documentation
      this.documentation = [
        new LinkItem("Wikipedia - Deflate: Enhanced Deflate (Deflate64)", "https://en.wikipedia.org/wiki/Deflate#Enhanced_Deflate_(Deflate64)"),
        new LinkItem("RFC 1951 - DEFLATE Compressed Data Format Specification", "https://www.rfc-editor.org/rfc/rfc1951")
      ];

      this.references = [
        new LinkItem("PKWARE APPNOTE.TXT - .ZIP File Format Specification (method 9)", "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT"),
        new LinkItem("DEFLATE Wikipedia", "https://en.wikipedia.org/wiki/Deflate"),
        new LinkItem("zlib Library", "https://github.com/madler/zlib")
      ];

      // Test vectors - Round-trip compression tests (Deflate64 may legally
      // produce different bit-exact output than reference implementations,
      // so correctness is verified by round-trip, not fixed ciphertext).
      this.tests = [
        new TestCase(
          [],
          [], // Empty expected for round-trip test
          "Deflate64 round-trip - empty input",
          "https://en.wikipedia.org/wiki/Deflate#Enhanced_Deflate_(Deflate64)"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("A"),
          [], // Empty expected for round-trip test
          "Deflate64 round-trip - single byte",
          "https://en.wikipedia.org/wiki/Deflate#Enhanced_Deflate_(Deflate64)"
        ),
        new TestCase(
          new Array(2000).fill(0x61),
          [], // Empty expected for round-trip test
          "Deflate64 round-trip - 2000-byte repetitive run (exercises extended length code 285 beyond 258)",
          "https://www.rfc-editor.org/rfc/rfc1951"
        ),
        new TestCase(
          (() => { const a = []; for (let i = 0; i < 600; ++i) a.push(i % 2 === 0 ? 0x41 : 0x42); return a; })(),
          [], // Empty expected for round-trip test
          "Deflate64 round-trip - alternating AB byte pattern",
          "https://www.rfc-editor.org/rfc/rfc1951"
        ),
        new TestCase(
          (() => { let s = 0x2A5F3C81; const a = []; for (let i = 0; i < 512; ++i) { s = OpCodes.ToUint32(OpCodes.XorN(OpCodes.Shl32(s, 13), s)); s = OpCodes.ToUint32(OpCodes.XorN(OpCodes.Shr32(s, 17), s)); s = OpCodes.ToUint32(OpCodes.XorN(OpCodes.Shl32(s, 5), s)); a.push(OpCodes.AndN(s, 0xFF)); } return a; })(),
          [], // Empty expected for round-trip test
          "Deflate64 round-trip - pseudo-random binary sample",
          "https://www.rfc-editor.org/rfc/rfc1951"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("Deflate64 is DEFLATE (RFC 1951) with a 64 KiB window, extended length code 285, and distance codes 30-31."),
          [], // Empty expected for round-trip test
          "Deflate64 round-trip - descriptive text",
          "https://www.rfc-editor.org/rfc/rfc1951"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Deflate64Instance(this, isInverse);
    }
  }

  /**
 * Deflate64 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class Deflate64Instance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (compressed or decompressed data)
   * @returns {uint8[]} Processed output bytes
   */

    Result() {
      if (this.inputBuffer.length === 0) return [];

      const result = this.isInverse ?
        this._decompress(this.inputBuffer) :
        this._compress(this.inputBuffer);

      this.inputBuffer = [];
      return result;
    }

    // ===== COMPRESSION =====

    _compress(data) {
      if (data.length === 0) return [];

      const stream = new BitStream();

      // Write final block with fixed Huffman codes
      stream.writeBits(1, 1); // BFINAL = 1 (last block)
      stream.writeBits(1, 2); // BTYPE = 01 (fixed Huffman)

      // Build fixed Huffman trees (identical tables to plain DEFLATE)
      const literalTree = HuffmanTree.buildFromLengths(FIXED_LITERAL_LENGTHS);
      const distanceTree = HuffmanTree.buildFromLengths(FIXED_DISTANCE_LENGTHS);

      // LZ77 compression with hash table, using the 64K Deflate64 window
      const matches = this._findMatches(data);

      // Encode matches
      for (const match of matches) {
        if (match.type === 'literal') {
          // Encode literal byte
          const {code, length} = literalTree.encode(match.value);
          stream.writeHuffmanCode(code, length);
        } else {
          // Encode length using the Deflate64 length code table
          const lengthCode = this._getLengthCode(match.length);
          const lengthInfo = LENGTH_CODES[lengthCode - 257];
          const {code: lenCode, length: lenCodeLen} = literalTree.encode(lengthCode);
          stream.writeHuffmanCode(lenCode, lenCodeLen);

          if (lengthInfo.extra > 0) {
            const extraBits = match.length - lengthInfo.base;
            stream.writeBits(extraBits, lengthInfo.extra);
          }

          // Encode distance using the Deflate64 distance code table (0-31)
          const distCode = this._getDistanceCode(match.distance);
          const distInfo = DISTANCE_CODES[distCode];
          const {code: dstCode, length: dstCodeLen} = distanceTree.encode(distCode);
          stream.writeHuffmanCode(dstCode, dstCodeLen);

          if (distInfo.extra > 0) {
            const extraBits = match.distance - distInfo.base;
            stream.writeBits(extraBits, distInfo.extra);
          }
        }
      }

      // Write end-of-block symbol (256)
      const {code, length} = literalTree.encode(256);
      stream.writeHuffmanCode(code, length);

      return stream.flush();
    }

    _findMatches(data) {
      const matches = [];
      const hashTable = new Map();
      let pos = 0;

      while (pos < data.length) {
        let bestMatch = null;

        // Try to find match within the 64K Deflate64 window
        if (pos + this.algorithm.MIN_MATCH <= data.length) {
          const hash = this._hash3(data, pos);
          const positions = hashTable.get(hash);

          if (positions) {
            for (let i = positions.length - 1; i >= 0; --i) {
              const matchPos = positions[i];
              if (pos - matchPos > this.algorithm.WINDOW_SIZE) break;

              const len = this._matchLength(data, matchPos, pos);
              if (len >= this.algorithm.MIN_MATCH) {
                if (!bestMatch || len > bestMatch.length) {
                  bestMatch = {
                    type: 'match',
                    distance: pos - matchPos,
                    length: len
                  };
                  if (len >= this.algorithm.MAX_MATCH) break;
                }
              }
            }
          }

          // Update hash table
          if (!hashTable.has(hash)) hashTable.set(hash, []);
          hashTable.get(hash).push(pos);
        }

        if (bestMatch) {
          matches.push(bestMatch);
          pos += bestMatch.length;
        } else {
          matches.push({type: 'literal', value: data[pos]});
          ++pos;
        }
      }

      return matches;
    }

    _hash3(data, pos) {
      if (pos + 3 > data.length) return 0;
      const hash1 = OpCodes.Shl16(data[pos], 10);
      const hash2 = OpCodes.Shl16(data[pos + 1], 5);
      const hash3 = data[pos + 2];
      const combined = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(hash1, hash2), hash3), 0xFFFF);
      return OpCodes.AndN(combined, this.algorithm.HASH_MASK);
    }

    _matchLength(data, pos1, pos2) {
      let len = 0;
      const maxLen = Math.min(this.algorithm.MAX_MATCH, data.length - pos2);

      while (len < maxLen && data[pos1 + len] === data[pos2 + len]) {
        ++len;
      }

      return len;
    }

    // Map a match length (3-65538) to its Deflate64 length code (257-285).
    // Lengths 3-258 use codes 257-284 (same table as plain DEFLATE);
    // lengths above 258 can only be expressed by code 285's 16 extra bits.
    _getLengthCode(length) {
      if (length > 258) return 285;

      for (let i = 0; i < LENGTH_CODES.length - 1; ++i) {
        const info = LENGTH_CODES[i];
        const maxLen = i < LENGTH_CODES.length - 2 ?
          LENGTH_CODES[i + 1].base - 1 : 258;
        if (length <= maxLen) return 257 + i;
      }
      return 285;
    }

    // Map a match distance (1-65536) to its Deflate64 distance code (0-31).
    _getDistanceCode(distance) {
      for (let i = 0; i < DISTANCE_CODES.length; ++i) {
        const info = DISTANCE_CODES[i];
        const maxDist = i < DISTANCE_CODES.length - 1 ?
          DISTANCE_CODES[i + 1].base - 1 : OpCodes.ToUint32(info.base + OpCodes.Shl32(1, info.extra) - 1);
        if (distance <= maxDist) return i;
      }
      return DISTANCE_CODES.length - 1;
    }

    // ===== DECOMPRESSION =====

    _decompress(data) {
      const reader = new BitReader(data);
      const output = [];

      while (reader.hasMore()) {
        // Read block header
        const bfinal = reader.readBits(1);
        const btype = reader.readBits(2);

        if (btype === 0) {
          // Uncompressed (stored) block
          reader.alignToByte();
          const len = reader.readBits(16);
          const nlen = reader.readBits(16);

          if (OpCodes.XorN(len, nlen) !== 0xFFFF) {
            throw new Error('Invalid uncompressed block length');
          }

          for (let i = 0; i < len; ++i) {
            output.push(reader.readBits(8));
          }
        } else if (btype === 1) {
          // Fixed Huffman codes (the only compressed block type this
          // implementation produces; the Deflate64 length/distance
          // extensions apply here exactly as in compression)
          const literalTree = HuffmanTree.buildFromLengths(FIXED_LITERAL_LENGTHS);
          const distanceTree = HuffmanTree.buildFromLengths(FIXED_DISTANCE_LENGTHS);

          while (true) {
            const symbol = literalTree.decode(reader);

            if (symbol === 256) {
              // End of block
              break;
            } else if (symbol < 256) {
              // Literal byte
              output.push(symbol);
            } else {
              // Length/distance pair using the Deflate64 tables
              const lengthCode = symbol - 257;
              const lengthInfo = LENGTH_CODES[lengthCode];
              let length = lengthInfo.base;

              if (lengthInfo.extra > 0) {
                length += reader.readBits(lengthInfo.extra);
              }

              const distCode = distanceTree.decode(reader);
              const distInfo = DISTANCE_CODES[distCode];
              let distance = distInfo.base;

              if (distInfo.extra > 0) {
                distance += reader.readBits(distInfo.extra);
              }

              // Copy from history (may overlap, byte by byte)
              const startPos = output.length - distance;
              for (let i = 0; i < length; ++i) {
                output.push(output[startPos + i]);
              }
            }
          }
        } else {
          throw new Error('Unsupported Deflate64 block type (dynamic Huffman blocks are not produced by this implementation)');
        }

        if (bfinal) break;
      }

      return output;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new Deflate64Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Deflate64Algorithm, Deflate64Instance };
}));
