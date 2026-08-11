/*
 * Deflate64 (Enhanced Deflate) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Deflate64 extends RFC 1951 DEFLATE (as used by ZIP compression method 9) with:
 *   - a 64 KB sliding window (instead of 32 KB)
 *   - two additional distance codes 30-31, reaching distances up to 65536
 *   - length code 285 reinterpreted as base 3 with 16 extra bits, covering
 *     match lengths 3-65538 (instead of the fixed length-258 code)
 * There is no standard "fixed" Huffman table for the extended alphabet, so
 * Deflate64 streams always use dynamic Huffman blocks (or stored/uncompressed
 * blocks) - never static ones. Output is Deflate64-specific: NOT decodable by
 * a standard RFC 1951 DEFLATE reader such as zlib.
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== DEFLATE64 CONSTANTS =====

  // Length codes 257-285 (extra bits). Code 285 is base 3 with 16 extra bits
  // in Deflate64 (covers lengths 259-65538), unlike standard Deflate's fixed 258.
  const LENGTH_CODES = [
    {base: 3, extra: 0}, {base: 4, extra: 0}, {base: 5, extra: 0}, {base: 6, extra: 0},
    {base: 7, extra: 0}, {base: 8, extra: 0}, {base: 9, extra: 0}, {base: 10, extra: 0},
    {base: 11, extra: 1}, {base: 13, extra: 1}, {base: 15, extra: 1}, {base: 17, extra: 1},
    {base: 19, extra: 2}, {base: 23, extra: 2}, {base: 27, extra: 2}, {base: 31, extra: 2},
    {base: 35, extra: 3}, {base: 43, extra: 3}, {base: 51, extra: 3}, {base: 59, extra: 3},
    {base: 67, extra: 4}, {base: 83, extra: 4}, {base: 99, extra: 4}, {base: 115, extra: 4},
    {base: 131, extra: 5}, {base: 163, extra: 5}, {base: 195, extra: 5}, {base: 227, extra: 5},
    {base: 3, extra: 16}
  ];

  // Distance codes 0-31 (extra bits). Codes 30-31 extend standard Deflate to
  // reach distances up to 65536.
  const DISTANCE_CODES = [
    {base: 1, extra: 0}, {base: 2, extra: 0}, {base: 3, extra: 0}, {base: 4, extra: 0},
    {base: 5, extra: 1}, {base: 7, extra: 1}, {base: 9, extra: 2}, {base: 13, extra: 2},
    {base: 17, extra: 3}, {base: 25, extra: 3}, {base: 33, extra: 4}, {base: 49, extra: 4},
    {base: 65, extra: 5}, {base: 97, extra: 5}, {base: 129, extra: 6}, {base: 193, extra: 6},
    {base: 257, extra: 7}, {base: 385, extra: 7}, {base: 513, extra: 8}, {base: 769, extra: 8},
    {base: 1025, extra: 9}, {base: 1537, extra: 9}, {base: 2049, extra: 10}, {base: 3073, extra: 10},
    {base: 4097, extra: 11}, {base: 6145, extra: 11}, {base: 8193, extra: 12}, {base: 12289, extra: 12},
    {base: 16385, extra: 13}, {base: 24577, extra: 13}, {base: 32769, extra: 14}, {base: 49153, extra: 14}
  ];

  const LIT_LEN_ALPHABET_SIZE = 286;
  const DIST_ALPHABET_SIZE = 32;
  const CL_ALPHABET_SIZE = 19;
  const MAX_CODE_BITS = 15;
  const MAX_CL_CODE_BITS = 7;
  const END_OF_BLOCK = 256;
  const WINDOW_SIZE = 65536;
  const MAX_MATCH_LENGTH = 65538;
  const MIN_MATCH = 3;
  const MAX_UNCOMPRESSED_BLOCK_SIZE = 65535;
  const DEFAULT_BLOCK_SIZE = 32768;
  const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  // Lengths 3-258 resolve to codes 257-284 (code 284's own range covers up to
  // 258, since its base 227 + 2^5-1 extra reaches 258). Code 285 is reserved
  // for lengths 259-65538 exclusively (Deflate64Constants.GetLengthCode: the
  // search deliberately excludes the reinterpreted last entry).
  function getLengthCode(length) {
    if (length > 258) return 285;
    for (let i = 0; i < LENGTH_CODES.length - 2; ++i) {
      const maxLen = LENGTH_CODES[i + 1].base - 1;
      if (length <= maxLen) return 257 + i;
    }
    return 257 + (LENGTH_CODES.length - 2); // code 284: covers up to length 258
  }

  function getDistanceCode(distance) {
    for (let i = 0; i < DISTANCE_CODES.length; ++i) {
      const info = DISTANCE_CODES[i];
      const maxDist = i < DISTANCE_CODES.length - 1 ?
        DISTANCE_CODES[i + 1].base - 1 : OpCodes.ToUint32(info.base + OpCodes.Shl32(1, info.extra) - 1);
      if (distance <= maxDist) return i;
    }
    return 31;
  }

  // ===== BIT STREAM HELPERS (LSB-first, matches RFC 1951 / Deflate64) =====

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

  // ===== CANONICAL HUFFMAN TREE (RFC 1951 code assignment) =====

  class HuffmanTree {
    constructor() {
      this.root = null;
    }

    static buildFromLengths(lengths) {
      const tree = new HuffmanTree();
      const maxLen = Math.max(...lengths.filter(l => l > 0));
      if (maxLen === 0) return tree;

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

      const codes = new Array(lengths.length);
      for (let n = 0; n < lengths.length; ++n) {
        const len = lengths[n];
        if (len !== 0) {
          codes[n] = {code: nextCode[len], length: len};
          nextCode[len]++;
        }
      }

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

  // ===== HUFFMAN CODE LENGTHS =====

  // Code lengths come from the shared deterministic builder in
  // huffman-code-lengths.data.js. Its tie-break among equally likely symbols is a
  // written rule - lighter first, then leaves before internal nodes, leaves by
  // ascending symbol, internal nodes oldest first - and CompressionWorkbench's
  // DeterministicHuffman follows the same rule, so the two produce the same tree
  // because the algorithm says so and not because either copies the other's heap.

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

  function buildHuffmanCodeLengths(frequencies, alphabetSize, maxBits) {
    const lengths = HuffmanCodeLengths.buildCodeLengths(frequencies, alphabetSize);
    limitHuffmanCodeLengths(lengths, maxBits);
    return lengths;
  }

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

  // ===== DEFLATE64 COMPRESSION ALGORITHM =====

  class Deflate64Algorithm extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Deflate64";
      this.description = "Enhanced DEFLATE (ZIP compression method 9) with a 64KB sliding window, distance codes up to 65536, and a 16-bit extended length code reaching matches up to 65538 bytes. Always uses dynamic Huffman blocks - no fixed table is defined for the extended alphabet.";
      this.inventor = "PKWARE";
      this.year = 2001;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Hybrid";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.WINDOW_SIZE = WINDOW_SIZE;
      this.MAX_MATCH_LENGTH = MAX_MATCH_LENGTH;
      this.MIN_MATCH = MIN_MATCH;

      // Documentation
      this.documentation = [
        new LinkItem(".ZIP File Format Specification (APPNOTE.TXT)", "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT"),
        new LinkItem("RFC 1951 - DEFLATE Specification (base algorithm)", "https://www.rfc-editor.org/rfc/rfc1951")
      ];

      this.references = [
        new LinkItem(".NET Deflate64Stream", "https://learn.microsoft.com/en-us/dotnet/api/system.io.compression.deflate64stream"),
        new LinkItem("DEFLATE Wikipedia", "https://en.wikipedia.org/wiki/Deflate")
      ];

      // Test vectors - Round-trip compression tests (wire format differs from
      // standard DEFLATE, so only round-trip behaviour is pinned here)
      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes("hello"),
          [],
          "Deflate64 round-trip - hello",
          "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AAAA"),
          [],
          "Deflate64 round-trip - AAAA",
          "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("ABCABCABC"),
          [],
          "Deflate64 round-trip - ABCABCABC",
          "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT"
        )
      ];
    }

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
      // Like DEFLATE, an empty input is not a no-op for compression: it still
      // requires a minimal final block. Decompression of a genuinely empty
      // buffer has nothing to read and legitimately yields [].
      if (this.isInverse && this.inputBuffer.length === 0) return [];

      const result = this.isInverse ?
        this._decompress(this.inputBuffer) :
        this._compress(this.inputBuffer);

      this.inputBuffer = [];
      return result;
    }

    // ===== COMPRESSION =====

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

    // Deflate64 never emits static Huffman blocks (no fixed table exists for
    // the extended alphabet): only uncompressed vs. dynamic are compared.
    _emitCompressedBlock(stream, blockData, isFinal) {
      const tokens = this._findMatches(blockData, 128);

      const litLenFreqs = new Array(LIT_LEN_ALPHABET_SIZE).fill(0);
      const distFreqs = new Array(DIST_ALPHABET_SIZE).fill(0);
      for (const token of tokens) {
        if (token.isLiteral) ++litLenFreqs[token.literal];
        else {
          ++litLenFreqs[getLengthCode(token.length)];
          ++distFreqs[getDistanceCode(token.distance)];
        }
      }
      litLenFreqs[END_OF_BLOCK] = 1;

      const numSubBlocks = Math.max(1, Math.ceil(blockData.length / MAX_UNCOMPRESSED_BLOCK_SIZE));
      const uncompressedBits = 3 + numSubBlocks * 5 * 8 + blockData.length * 8;

      const dynamicSize = this._estimateDynamicSize(litLenFreqs.slice(), distFreqs.slice(), tokens);

      if (uncompressedBits < dynamicSize) this._emitUncompressedBlock(stream, blockData, isFinal);
      else this._emitDynamicHuffmanBlock(stream, litLenFreqs, distFreqs, tokens, isFinal);
    }

    _findMatches(data, chainDepth) {
      const result = [];
      if (data.length === 0) return result;

      const maxMatchLen = Math.min(MAX_MATCH_LENGTH, data.length);
      const matcher = new HashChainMatchFinder(WINDOW_SIZE, chainDepth);
      let pos = 0;

      while (pos < data.length) {
        const maxLen = Math.min(maxMatchLen, data.length - pos);
        const match = matcher.findMatch(data, pos, WINDOW_SIZE, maxLen, MIN_MATCH);

        if (match.length >= MIN_MATCH) {
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

    _estimateDynamicSize(litLenFreqs, distFreqs, tokens) {
      const litLenLengths = buildHuffmanCodeLengths(litLenFreqs, LIT_LEN_ALPHABET_SIZE, MAX_CODE_BITS);

      if (!distFreqs.some(f => f > 0)) distFreqs[0] = 1;
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
      if (!clFreqs.some(f => f > 0)) clFreqs[0] = 1;
      const clLengths = buildHuffmanCodeLengths(clFreqs, CL_ALPHABET_SIZE, MAX_CL_CODE_BITS);

      let hclen = CL_ALPHABET_SIZE;
      while (hclen > 4 && clLengths[CODE_LENGTH_ORDER[hclen - 1]] === 0) --hclen;
      bits += hclen * 3;

      for (const [symbol, extraBits] of rle) bits += clLengths[symbol] + extraBits;

      for (const token of tokens) {
        if (token.isLiteral) bits += litLenLengths[token.literal];
        else {
          const lengthCode = getLengthCode(token.length);
          bits += litLenLengths[lengthCode];
          bits += LENGTH_CODES[lengthCode - 257].extra;
          const distCode = getDistanceCode(token.distance);
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
          const lengthCode = getLengthCode(token.length);
          const lengthInfo = LENGTH_CODES[lengthCode - 257];
          const {code: lenCode, length: lenCodeLen} = literalTree.encode(lengthCode);
          stream.writeHuffmanCode(lenCode, lenCodeLen);
          if (lengthInfo.extra > 0) stream.writeBits(token.length - lengthInfo.base, lengthInfo.extra);

          const distCode = getDistanceCode(token.distance);
          const distInfo = DISTANCE_CODES[distCode];
          const {code: distC, length: distCodeLen} = distanceTree.encode(distCode);
          stream.writeHuffmanCode(distC, distCodeLen);
          if (distInfo.extra > 0) stream.writeBits(token.distance - distInfo.base, distInfo.extra);
        }
      }
    }

    _emitDynamicHuffmanBlock(stream, litLenFreqs, distFreqs, tokens, isFinal) {
      if (!distFreqs.some(f => f > 0)) distFreqs[0] = 1;

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
      if (!clFreqs.some(f => f > 0)) clFreqs[0] = 1;
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

    // ===== DECOMPRESSION =====

    _decompress(data) {
      const reader = new BitReader(data);
      const output = [];

      while (reader.hasMore()) {
        const bfinal = reader.readBits(1);
        const btype = reader.readBits(2);

        if (btype === 0) {
          reader.alignToByte();
          const len = reader.readBits(16);
          const nlen = reader.readBits(16);

          if (OpCodes.XorN(len, nlen) !== 0xFFFF) {
            throw new Error('Invalid uncompressed block length');
          }

          for (let i = 0; i < len; ++i) output.push(reader.readBits(8));
        } else if (btype === 1 || btype === 2) {
          let literalTree, distanceTree;

          if (btype === 1) {
            // Standard-Deflate fixed tables (decoder accepts them for
            // completeness, even though this encoder never emits them).
            const fixedLit = new Array(288);
            for (let i = 0; i <= 143; ++i) fixedLit[i] = 8;
            for (let i = 144; i <= 255; ++i) fixedLit[i] = 9;
            for (let i = 256; i <= 279; ++i) fixedLit[i] = 7;
            for (let i = 280; i <= 287; ++i) fixedLit[i] = 8;
            literalTree = HuffmanTree.buildFromLengths(fixedLit);
            distanceTree = HuffmanTree.buildFromLengths(new Array(DIST_ALPHABET_SIZE).fill(5));
          } else {
            const trees = this._readDynamicTrees(reader);
            literalTree = trees.literal;
            distanceTree = trees.distance;
          }

          while (true) {
            const symbol = literalTree.decode(reader);

            if (symbol === END_OF_BLOCK) {
              break;
            } else if (symbol < 256) {
              output.push(symbol);
            } else {
              const lengthCode = symbol - 257;
              const lengthInfo = LENGTH_CODES[lengthCode];
              let length = lengthInfo.base;
              if (lengthInfo.extra > 0) length += reader.readBits(lengthInfo.extra);

              const distCode = distanceTree.decode(reader);
              const distInfo = DISTANCE_CODES[distCode];
              let distance = distInfo.base;
              if (distInfo.extra > 0) distance += reader.readBits(distInfo.extra);

              const startPos = output.length - distance;
              for (let i = 0; i < length; ++i) output.push(output[startPos + i]);
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

      const codeLengthLengths = new Array(19).fill(0);
      for (let i = 0; i < hclen; ++i) codeLengthLengths[CODE_LENGTH_ORDER[i]] = reader.readBits(3);

      const codeLengthTree = HuffmanTree.buildFromLengths(codeLengthLengths);

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

  const algorithmInstance = new Deflate64Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Deflate64Algorithm, Deflate64Instance };
}));
