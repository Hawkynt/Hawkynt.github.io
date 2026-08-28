/*
 * DEFLATE Compression Algorithm (RFC 1951)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Production-quality DEFLATE implementation combining LZ77 and Huffman coding.
 * Full RFC 1951 compliance with dynamic/fixed Huffman codes.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes', './huffman-code-lengths.data'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('./huffman-code-lengths.data')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes, root.HuffmanCodeLengths);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, HuffmanCodeLengths) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  if (!HuffmanCodeLengths) {
    throw new Error('HuffmanCodeLengths dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== RFC 1951 CONSTANTS =====

  // Length codes 257-285 (extra bits)
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
    {base: 258, extra: 0}   // 285
  ];

  // Distance codes 0-29 (extra bits)
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
    {base: 24577, extra: 13} // 29
  ];

  // Fixed Huffman code lengths (RFC 1951 section 3.2.6)
  const FIXED_LITERAL_LENGTHS = (() => {
    const lengths = new Array(288);
    for (let i = 0; i <= 143; ++i) lengths[i] = 8;
    for (let i = 144; i <= 255; ++i) lengths[i] = 9;
    for (let i = 256; i <= 279; ++i) lengths[i] = 7;
    for (let i = 280; i <= 287; ++i) lengths[i] = 8;
    return lengths;
  })();

  const FIXED_DISTANCE_LENGTHS = new Array(30).fill(5);

  // Alphabet sizes / limits (RFC 1951)
  const LIT_LEN_ALPHABET_SIZE = 286;
  const DIST_ALPHABET_SIZE = 30;
  const CL_ALPHABET_SIZE = 19;
  const MAX_CODE_BITS = 15;
  const MAX_CL_CODE_BITS = 7;
  const END_OF_BLOCK = 256;
  const MAX_UNCOMPRESSED_BLOCK_SIZE = 65535;
  const DEFAULT_BLOCK_SIZE = 32768;
  const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  // ===== HUFFMAN CODE LENGTHS =====

  // Code lengths come from the shared deterministic builder in
  // huffman-code-lengths.data.js. Its tie-break among equally likely symbols is a
  // written rule - lighter first, then leaves before internal nodes, leaves by
  // ascending symbol, internal nodes oldest first - and CompressionWorkbench's
  // DeterministicHuffman follows the same rule, so the two produce the same tree
  // because the algorithm says so and not because either copies the other's heap.

  // Redistributes code lengths so none exceed maxLength while keeping the Kraft
  // inequality satisfied. Ported 1:1 from CompressionWorkbench's HuffmanTree.LimitCodeLengths.
  function limitHuffmanCodeLengths(codeLengths, maxLength) {
    const needsAdjustment = codeLengths.some(len => len > maxLength);
    if (!needsAdjustment) return;

    const symbols = [];
    for (let i = 0; i < codeLengths.length; ++i)
      if (codeLengths[i] > 0) symbols.push({symbol: i, length: codeLengths[i]});

    for (let i = 0; i < symbols.length; ++i)
      if (symbols[i].length > maxLength) symbols[i].length = maxLength;

    const kraftMax = OpCodes.Shl32(1, maxLength);

    for (;;) {
      let kraftSum = 0;
      for (let i = 0; i < symbols.length; ++i) kraftSum += OpCodes.Shl32(1, maxLength - symbols[i].length);
      if (kraftSum <= kraftMax) break;

      let shortestIdx = -1;
      let shortestLen = Infinity;
      for (let i = 0; i < symbols.length; ++i)
        if (symbols[i].length < maxLength && symbols[i].length < shortestLen) {
          shortestLen = symbols[i].length;
          shortestIdx = i;
        }

      if (shortestIdx < 0) break;
      ++symbols[shortestIdx].length;
    }

    for (;;) {
      let kraftSum = 0;
      for (let i = 0; i < symbols.length; ++i) kraftSum += OpCodes.Shl32(1, maxLength - symbols[i].length);
      const excess = kraftMax - kraftSum;
      if (excess <= 0) break;

      let longestIdx = -1;
      let longestLen = 0;
      for (let i = 0; i < symbols.length; ++i)
        if (symbols[i].length > longestLen) {
          longestLen = symbols[i].length;
          longestIdx = i;
        }

      if (longestIdx < 0 || longestLen <= 1) break;

      const added = OpCodes.Shl32(1, maxLength - longestLen);
      if (added <= excess) symbols[longestIdx].length = longestLen - 1;
      else break;
    }

    codeLengths.fill(0);
    for (let i = 0; i < symbols.length; ++i) codeLengths[symbols[i].symbol] = symbols[i].length;
  }

  // Builds RFC-1951-limited code lengths from frequencies in one call.
  function buildHuffmanCodeLengths(frequencies, alphabetSize, maxBits) {
    const lengths = HuffmanCodeLengths.buildCodeLengths(frequencies, alphabetSize);
    limitHuffmanCodeLengths(lengths, maxBits);
    return lengths;
  }

  // Run-length encodes combined code-length arrays for the dynamic-Huffman header
  // (RFC 1951 section 3.2.7 symbols 16/17/18). Ported from DeflateCompressor.RunLengthEncode.
  function runLengthEncodeCodeLengths(lengths) {
    const result = [];
    let i = 0;

    while (i < lengths.length) {
      const value = lengths[i];

      if (value === 0) {
        let zeroCount = 1;
        while (i + zeroCount < lengths.length && lengths[i + zeroCount] === 0) ++zeroCount;

        let count = zeroCount;
        while (count > 0) {
          if (count >= 11) {
            const run = Math.min(count, 138);
            result.push([18, 7, run - 11]);
            count -= run;
          } else if (count >= 3) {
            result.push([17, 3, count - 3]);
            count = 0;
          } else {
            result.push([0, 0, 0]);
            --count;
          }
        }

        i += zeroCount;
      } else {
        result.push([value, 0, 0]);
        ++i;

        let repeatCount = 0;
        while (i + repeatCount < lengths.length && lengths[i + repeatCount] === value) ++repeatCount;

        let count = repeatCount;
        while (count >= 3) {
          const run = Math.min(count, 6);
          result.push([16, 2, run - 3]);
          count -= run;
        }
        while (count > 0) {
          result.push([value, 0, 0]);
          --count;
        }

        i += repeatCount;
      }
    }

    return result;
  }

  // ===== HASH-CHAIN MATCH FINDER (matches CompressionWorkbench's HashChainMatchFinder) =====

  class HashChainMatchFinder {
    constructor(windowSize, maxChainDepth) {
      this.maxChainDepth = maxChainDepth === undefined ? 128 : maxChainDepth;
      this.hashBits = 15;
      this.hashSize = OpCodes.Shl32(1, this.hashBits);
      this.hashMask = this.hashSize - 1;
      this.head = new Int32Array(this.hashSize).fill(-1);
      this.prev = new Int32Array(windowSize);
      this.prevMask = windowSize - 1;
    }

    _hash(data, pos) {
      const h = OpCodes.XorN(OpCodes.XorN(OpCodes.Shl32(data[pos], 10), OpCodes.Shl32(data[pos + 1], 5)), data[pos + 2]);
      return OpCodes.AndN(h, this.hashMask);
    }

    findMatch(data, position, maxDistance, maxLength, minLength) {
      minLength = minLength === undefined ? 3 : minLength;
      if (position + 2 >= data.length) return {distance: 0, length: 0};

      let bestDistance = 0;
      let bestLength = 0;

      const hash = this._hash(data, position);
      let candidate = this.head[hash];
      let chainCount = 0;
      const windowStart = Math.max(0, position - maxDistance);

      while (candidate >= windowStart && chainCount < this.maxChainDepth) {
        if (candidate === position) {
          candidate = this.prev[OpCodes.AndN(candidate, this.prevMask)];
          ++chainCount;
          continue;
        }

        const distance = position - candidate;
        const limit = Math.min(maxLength, Math.min(data.length - position, data.length - candidate));

        let length = 0;
        while (length < limit && data[candidate + length] === data[position + length]) ++length;

        if (length >= minLength && length > bestLength) {
          bestLength = length;
          bestDistance = distance;
          if (bestLength >= maxLength) break;
        }

        candidate = this.prev[OpCodes.AndN(candidate, this.prevMask)];
        if (candidate <= windowStart) break;
        ++chainCount;
      }

      this.prev[OpCodes.AndN(position, this.prevMask)] = this.head[hash];
      this.head[hash] = position;

      return bestLength >= minLength ? {distance: bestDistance, length: bestLength} : {distance: 0, length: 0};
    }

    insertPosition(data, position) {
      if (position + 2 >= data.length) return;
      const hash = this._hash(data, position);
      this.prev[OpCodes.AndN(position, this.prevMask)] = this.head[hash];
      this.head[hash] = position;
    }
  }

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

  // ===== DEFLATE ALGORITHM =====

  class DeflateAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "DEFLATE";
      this.description = "Industry-standard lossless compression combining LZ77 and Huffman coding. Used in ZIP, gzip, PNG, and HTTP compression. Full RFC 1951 implementation.";
      this.inventor = "Phil Katz";
      this.year = 1993;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Hybrid";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // DEFLATE configuration (RFC 1951 limits)
      this.WINDOW_SIZE = 32768;      // 32K window
      this.MAX_MATCH = 258;          // Maximum match length
      this.MIN_MATCH = 3;            // Minimum match length
      this.HASH_BITS = 15;           // Hash table size
      this.HASH_SIZE = OpCodes.Shl32(1, this.HASH_BITS);
      this.HASH_MASK = OpCodes.ToUint32(this.HASH_SIZE - 1);

      // Documentation
      this.documentation = [
        new LinkItem("RFC 1951 - DEFLATE Specification", "https://www.rfc-editor.org/rfc/rfc1951"),
        new LinkItem("RFC 1950 - zlib Format", "https://www.rfc-editor.org/rfc/rfc1950"),
        new LinkItem("RFC 1952 - gzip Format", "https://www.rfc-editor.org/rfc/rfc1952")
      ];

      this.references = [
        new LinkItem("zlib Library", "https://github.com/madler/zlib"),
        new LinkItem("DEFLATE Wikipedia", "https://en.wikipedia.org/wiki/Deflate"),
        new LinkItem("PNG Specification", "https://www.w3.org/TR/PNG/")
      ];

      // Test vectors - Round-trip compression tests
      // Note: Compression may produce different valid outputs, so we test round-trip behavior
      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes("hello"),
          [], // Empty expected for round-trip test
          "RFC 1951 DEFLATE round-trip - hello",
          "https://www.rfc-editor.org/rfc/rfc1951.txt"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AAAA"),
          [], // Empty expected for round-trip test
          "RFC 1951 DEFLATE round-trip - AAAA",
          "https://www.rfc-editor.org/rfc/rfc1951.txt"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("ABCABCABC"),
          [], // Empty expected for round-trip test
          "RFC 1951 DEFLATE round-trip - ABCABCABC",
          "https://www.rfc-editor.org/rfc/rfc1951.txt"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new DeflateInstance(this, isInverse);
    }
  }

  /**
 * Deflate cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class DeflateInstance extends IAlgorithmInstance {
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
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Unlike ciphers, an empty DEFLATE input is not a no-op: RFC 1951 still
      // requires a minimal final block (BFINAL + an empty Huffman block), so
      // compression must run even when nothing was fed. Decompression of a
      // genuinely empty buffer has nothing to read and legitimately yields [].
      if (this.isInverse && this.inputBuffer.length === 0) return [];

      const result = this.isInverse ?
        this._decompress(this.inputBuffer) :
        this._compress(this.inputBuffer);

      this.inputBuffer = [];
      return result;
    }

    // ===== COMPRESSION =====

    // Mirrors CompressionWorkbench's DeflateCompressor at Default level: buffer the
    // whole input, split into DEFAULT_BLOCK_SIZE chunks when large, and for each
    // chunk pick whichever of {uncompressed, static Huffman, dynamic Huffman}
    // produces the fewest bits (Fast/Best-only behaviours - shallow chain depth,
    // lazy matching - are not exercised at Default level, so they are omitted).
    _compress(data) {
      const stream = new BitStream();

      if (data.length === 0) {
        this._emitCompressedBlock(stream, [], true);
        return stream.flush();
      }

      let offset = 0;
      while (data.length - offset > DEFAULT_BLOCK_SIZE) {
        this._emitCompressedBlock(stream, data.slice(offset, offset + DEFAULT_BLOCK_SIZE), false);
        offset += DEFAULT_BLOCK_SIZE;
      }
      this._emitCompressedBlock(stream, data.slice(offset), true);

      return stream.flush();
    }

    _emitCompressedBlock(stream, blockData, isFinal) {
      const tokens = this._findMatches(blockData, 128);

      const litLenFreqs = new Array(LIT_LEN_ALPHABET_SIZE).fill(0);
      const distFreqs = new Array(DIST_ALPHABET_SIZE).fill(0);
      for (const token of tokens) {
        if (token.isLiteral) ++litLenFreqs[token.literal];
        else {
          ++litLenFreqs[this._getLengthCode(token.length)];
          ++distFreqs[this._getDistanceCode(token.distance)];
        }
      }
      litLenFreqs[END_OF_BLOCK] = 1;

      const numSubBlocks = Math.max(1, Math.ceil(blockData.length / MAX_UNCOMPRESSED_BLOCK_SIZE));
      const uncompressedBits = 3 + numSubBlocks * 5 * 8 + blockData.length * 8;

      const staticSize = this._estimateStaticSize(tokens);
      const dynamicSize = this._estimateDynamicSize(litLenFreqs.slice(), distFreqs.slice(), tokens);
      const bestCompressed = Math.min(staticSize, dynamicSize);

      if (uncompressedBits < bestCompressed) this._emitUncompressedBlock(stream, blockData, isFinal);
      else if (staticSize <= dynamicSize) this._emitStaticHuffmanBlock(stream, tokens, isFinal);
      else this._emitDynamicHuffmanBlock(stream, litLenFreqs, distFreqs, tokens, isFinal);
    }

    _findMatches(data, chainDepth) {
      const result = [];
      if (data.length === 0) return result;

      const matcher = new HashChainMatchFinder(this.algorithm.WINDOW_SIZE, chainDepth);
      let pos = 0;

      while (pos < data.length) {
        const match = matcher.findMatch(data, pos, this.algorithm.WINDOW_SIZE, this.algorithm.MAX_MATCH, this.algorithm.MIN_MATCH);

        if (match.length >= this.algorithm.MIN_MATCH) {
          result.push({isLiteral: false, distance: match.distance, length: match.length});
          for (let i = 1; i < match.length; ++i)
            if (pos + i < data.length) matcher.insertPosition(data, pos + i);
          pos += match.length;
        } else {
          result.push({isLiteral: true, literal: data[pos]});
          ++pos;
        }
      }

      return result;
    }

    _estimateStaticSize(tokens) {
      let bits = 3;
      for (const token of tokens) {
        if (token.isLiteral) bits += FIXED_LITERAL_LENGTHS[token.literal];
        else {
          const lengthCode = this._getLengthCode(token.length);
          bits += FIXED_LITERAL_LENGTHS[lengthCode];
          bits += LENGTH_CODES[lengthCode - 257].extra;
          const distCode = this._getDistanceCode(token.distance);
          bits += FIXED_DISTANCE_LENGTHS[distCode];
          bits += DISTANCE_CODES[distCode].extra;
        }
      }
      bits += FIXED_LITERAL_LENGTHS[END_OF_BLOCK];
      return bits;
    }

    _estimateDynamicSize(litLenFreqs, distFreqs, tokens) {
      const litLenLengths = buildHuffmanCodeLengths(litLenFreqs, LIT_LEN_ALPHABET_SIZE, MAX_CODE_BITS);

      const hasDistCodes = distFreqs.some(f => f > 0);
      if (!hasDistCodes) distFreqs[0] = 1;
      const distLengths = buildHuffmanCodeLengths(distFreqs, DIST_ALPHABET_SIZE, MAX_CODE_BITS);

      let bits = 3 + 5 + 5 + 4;

      let hlit = litLenLengths.length;
      while (hlit > 257 && litLenLengths[hlit - 1] === 0) --hlit;
      let hdist = distLengths.length;
      while (hdist > 1 && distLengths[hdist - 1] === 0) --hdist;

      const combined = new Array(hlit + hdist);
      for (let i = 0; i < hlit; ++i) combined[i] = litLenLengths[i];
      for (let i = 0; i < hdist; ++i) combined[hlit + i] = distLengths[i];
      const rle = runLengthEncodeCodeLengths(combined);

      const clFreqs = new Array(CL_ALPHABET_SIZE).fill(0);
      for (const [symbol] of rle) ++clFreqs[symbol];
      const hasClCodes = clFreqs.some(f => f > 0);
      if (!hasClCodes) clFreqs[0] = 1;
      const clLengths = buildHuffmanCodeLengths(clFreqs, CL_ALPHABET_SIZE, MAX_CL_CODE_BITS);

      let hclen = CL_ALPHABET_SIZE;
      while (hclen > 4 && clLengths[CODE_LENGTH_ORDER[hclen - 1]] === 0) --hclen;
      bits += hclen * 3;

      for (const [symbol, extraBits] of rle) bits += clLengths[symbol] + extraBits;

      for (const token of tokens) {
        if (token.isLiteral) bits += litLenLengths[token.literal];
        else {
          const lengthCode = this._getLengthCode(token.length);
          bits += litLenLengths[lengthCode];
          bits += LENGTH_CODES[lengthCode - 257].extra;
          const distCode = this._getDistanceCode(token.distance);
          bits += distLengths[distCode];
          bits += DISTANCE_CODES[distCode].extra;
        }
      }
      bits += litLenLengths[END_OF_BLOCK];
      return bits;
    }

    _writeTokens(stream, tokens, literalTree, distanceTree) {
      for (const token of tokens) {
        if (token.isLiteral) {
          const {code, length} = literalTree.encode(token.literal);
          stream.writeHuffmanCode(code, length);
        } else {
          const lengthCode = this._getLengthCode(token.length);
          const lengthInfo = LENGTH_CODES[lengthCode - 257];
          const {code: lenCode, length: lenCodeLen} = literalTree.encode(lengthCode);
          stream.writeHuffmanCode(lenCode, lenCodeLen);
          if (lengthInfo.extra > 0) stream.writeBits(token.length - lengthInfo.base, lengthInfo.extra);

          const distCode = this._getDistanceCode(token.distance);
          const distInfo = DISTANCE_CODES[distCode];
          const {code: distC, length: distCodeLen} = distanceTree.encode(distCode);
          stream.writeHuffmanCode(distC, distCodeLen);
          if (distInfo.extra > 0) stream.writeBits(token.distance - distInfo.base, distInfo.extra);
        }
      }
    }

    _emitStaticHuffmanBlock(stream, tokens, isFinal) {
      const literalTree = HuffmanTree.buildFromLengths(FIXED_LITERAL_LENGTHS);
      const distanceTree = HuffmanTree.buildFromLengths(FIXED_DISTANCE_LENGTHS);

      stream.writeBits(isFinal ? 1 : 0, 1);
      stream.writeBits(1, 2); // BTYPE = 01 (static Huffman)

      this._writeTokens(stream, tokens, literalTree, distanceTree);

      const {code, length} = literalTree.encode(END_OF_BLOCK);
      stream.writeHuffmanCode(code, length);
    }

    _emitDynamicHuffmanBlock(stream, litLenFreqs, distFreqs, tokens, isFinal) {
      const hasDistCodes = distFreqs.some(f => f > 0);
      if (!hasDistCodes) distFreqs[0] = 1;

      const litLenLengths = buildHuffmanCodeLengths(litLenFreqs, LIT_LEN_ALPHABET_SIZE, MAX_CODE_BITS);
      const distLengths = buildHuffmanCodeLengths(distFreqs, DIST_ALPHABET_SIZE, MAX_CODE_BITS);

      let hlit = litLenLengths.length;
      while (hlit > 257 && litLenLengths[hlit - 1] === 0) --hlit;
      let hdist = distLengths.length;
      while (hdist > 1 && distLengths[hdist - 1] === 0) --hdist;

      const combined = new Array(hlit + hdist);
      for (let i = 0; i < hlit; ++i) combined[i] = litLenLengths[i];
      for (let i = 0; i < hdist; ++i) combined[hlit + i] = distLengths[i];
      const rleSymbols = runLengthEncodeCodeLengths(combined);

      const clFreqs = new Array(CL_ALPHABET_SIZE).fill(0);
      for (const [symbol] of rleSymbols) ++clFreqs[symbol];
      const hasClCodes = clFreqs.some(f => f > 0);
      if (!hasClCodes) clFreqs[0] = 1;
      const clLengths = buildHuffmanCodeLengths(clFreqs, CL_ALPHABET_SIZE, MAX_CL_CODE_BITS);

      let hclen = CL_ALPHABET_SIZE;
      while (hclen > 4 && clLengths[CODE_LENGTH_ORDER[hclen - 1]] === 0) --hclen;

      const clTree = HuffmanTree.buildFromLengths(clLengths);

      stream.writeBits(isFinal ? 1 : 0, 1);
      stream.writeBits(2, 2); // BTYPE = 10 (dynamic Huffman)
      stream.writeBits(hlit - 257, 5);
      stream.writeBits(hdist - 1, 5);
      stream.writeBits(hclen - 4, 4);

      for (let i = 0; i < hclen; ++i) stream.writeBits(clLengths[CODE_LENGTH_ORDER[i]], 3);

      for (const [symbol, extraBits, extraValue] of rleSymbols) {
        const {code, length} = clTree.encode(symbol);
        stream.writeHuffmanCode(code, length);
        if (extraBits > 0) stream.writeBits(extraValue, extraBits);
      }

      const literalTree = HuffmanTree.buildFromLengths(litLenLengths.slice(0, hlit));
      const distanceTree = HuffmanTree.buildFromLengths(distLengths.slice(0, hdist));

      this._writeTokens(stream, tokens, literalTree, distanceTree);

      const {code, length} = literalTree.encode(END_OF_BLOCK);
      stream.writeHuffmanCode(code, length);
    }

    _emitUncompressedBlock(stream, data, isFinal) {
      let offset = 0;
      while (offset < data.length) {
        const chunkSize = Math.min(data.length - offset, MAX_UNCOMPRESSED_BLOCK_SIZE);
        const isLastChunk = (offset + chunkSize >= data.length) && isFinal;

        stream.writeBits(isLastChunk ? 1 : 0, 1);
        stream.writeBits(0, 2); // BTYPE = 00 (uncompressed)
        stream.flush();

        const len = OpCodes.AndN(chunkSize, 0xFFFF);
        const nlen = OpCodes.AndN(OpCodes.XorN(len, 0xFFFF), 0xFFFF);
        stream.writeBits(len, 16);
        stream.writeBits(nlen, 16);

        for (let i = 0; i < chunkSize; ++i) stream.writeBits(data[offset + i], 8);

        offset += chunkSize;
      }

      if (data.length !== 0 || !isFinal) return;

      stream.writeBits(1, 1);
      stream.writeBits(0, 2);
      stream.flush();
      stream.writeBits(0, 16);
      stream.writeBits(0xFFFF, 16);
    }

    _getLengthCode(length) {
      for (let i = 0; i < LENGTH_CODES.length; ++i) {
        const info = LENGTH_CODES[i];
        const maxLen = i < LENGTH_CODES.length - 1 ?
          LENGTH_CODES[i + 1].base - 1 : info.base;
        if (length <= maxLen) return 257 + i;
      }
      return 285;
    }

    _getDistanceCode(distance) {
      for (let i = 0; i < DISTANCE_CODES.length; ++i) {
        const info = DISTANCE_CODES[i];
        const maxDist = i < DISTANCE_CODES.length - 1 ?
          DISTANCE_CODES[i + 1].base - 1 : OpCodes.ToUint32(info.base + OpCodes.Shl32(1, info.extra) - 1);
        if (distance <= maxDist) return i;
      }
      return 29;
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
          // Uncompressed block
          reader.alignToByte();
          const len = reader.readBits(16);
          const nlen = reader.readBits(16);

          if (OpCodes.XorN(len, nlen) !== 0xFFFF) {
            throw new Error('Invalid uncompressed block length');
          }

          for (let i = 0; i < len; ++i) {
            output.push(reader.readBits(8));
          }
        } else if (btype === 1 || btype === 2) {
          // Fixed or dynamic Huffman
          let literalTree, distanceTree;

          if (btype === 1) {
            // Fixed Huffman codes
            literalTree = HuffmanTree.buildFromLengths(FIXED_LITERAL_LENGTHS);
            distanceTree = HuffmanTree.buildFromLengths(FIXED_DISTANCE_LENGTHS);
          } else {
            // Dynamic Huffman codes
            const trees = this._readDynamicTrees(reader);
            literalTree = trees.literal;
            distanceTree = trees.distance;
          }

          // Decode compressed data
          while (true) {
            const symbol = literalTree.decode(reader);

            if (symbol === 256) {
              // End of block
              break;
            } else if (symbol < 256) {
              // Literal byte
              output.push(symbol);
            } else {
              // Length/distance pair
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

              // Copy from history
              const startPos = output.length - distance;
              for (let i = 0; i < length; ++i) {
                output.push(output[startPos + i]);
              }
            }
          }
        } else {
          throw new Error('Invalid block type');
        }

        if (bfinal) break;
      }

      return output;
    }

    _readDynamicTrees(reader) {
      const hlit = reader.readBits(5) + 257;
      const hdist = reader.readBits(5) + 1;
      const hclen = reader.readBits(4) + 4;

      // Code length alphabet order (RFC 1951 section 3.2.7)
      const clOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

      // Read code length codes
      const codeLengthLengths = new Array(19).fill(0);
      for (let i = 0; i < hclen; ++i) {
        codeLengthLengths[clOrder[i]] = reader.readBits(3);
      }

      const codeLengthTree = HuffmanTree.buildFromLengths(codeLengthLengths);

      // Decode literal/length and distance code lengths
      const lengths = [];
      while (lengths.length < hlit + hdist) {
        const symbol = codeLengthTree.decode(reader);

        if (symbol < 16) {
          lengths.push(symbol);
        } else if (symbol === 16) {
          const repeat = reader.readBits(2) + 3;
          const value = lengths[lengths.length - 1] || 0;
          for (let i = 0; i < repeat; ++i) lengths.push(value);
        } else if (symbol === 17) {
          const repeat = reader.readBits(3) + 3;
          for (let i = 0; i < repeat; ++i) lengths.push(0);
        } else if (symbol === 18) {
          const repeat = reader.readBits(7) + 11;
          for (let i = 0; i < repeat; ++i) lengths.push(0);
        }
      }

      const literalLengths = lengths.slice(0, hlit);
      const distanceLengths = lengths.slice(hlit, hlit + hdist);

      return {
        literal: HuffmanTree.buildFromLengths(literalLengths),
        distance: HuffmanTree.buildFromLengths(distanceLengths)
      };
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DeflateAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DeflateAlgorithm, DeflateInstance };
}));
