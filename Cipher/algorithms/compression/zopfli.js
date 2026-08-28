/*
 * Zopfli Compression Algorithm Implementation (RFC 1951 DEFLATE, optimal parsing)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Zopfli exists to spend a great deal of time producing an ordinary RFC 1951 stream
 * that happens to be smaller. Its one idea is that the parse and the Huffman trees are
 * circular: what a match costs depends on the trees, and the trees depend on which
 * matches the parse chose. Neither can be settled first, so it guesses, solves the
 * other exactly, and repeats - parse greedily for realistic symbol counts, price every
 * symbol by the entropy of those counts, find the cheapest parse under that pricing by
 * shortest path, take the counts of that parse, and go round again. Every round is
 * measured exactly and the smallest is what gets emitted.
 *
 * The output is standard DEFLATE, readable by any conforming decoder including zlib.
 *
 * Every decision here is made with integer arithmetic, so the CompressionWorkbench
 * implementation of the same design (Compression.Core/Deflate) produces the same bytes.
 *
 * References:
 *   RFC 1951, "DEFLATE Compressed Data Format Specification version 1.3"
 *   L. Vandevenne and J. Alakuijala, "Compress data more densely with Zopfli",
 *     Google Open Source Blog, 2013
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

  // ===== RFC 1951 CONSTANTS (shared shape with algorithms/compression/deflate.js) =====

  const LENGTH_CODES = [
    {base: 3, extra: 0}, {base: 4, extra: 0}, {base: 5, extra: 0}, {base: 6, extra: 0},
    {base: 7, extra: 0}, {base: 8, extra: 0}, {base: 9, extra: 0}, {base: 10, extra: 0},
    {base: 11, extra: 1}, {base: 13, extra: 1}, {base: 15, extra: 1}, {base: 17, extra: 1},
    {base: 19, extra: 2}, {base: 23, extra: 2}, {base: 27, extra: 2}, {base: 31, extra: 2},
    {base: 35, extra: 3}, {base: 43, extra: 3}, {base: 51, extra: 3}, {base: 59, extra: 3},
    {base: 67, extra: 4}, {base: 83, extra: 4}, {base: 99, extra: 4}, {base: 115, extra: 4},
    {base: 131, extra: 5}, {base: 163, extra: 5}, {base: 195, extra: 5}, {base: 227, extra: 5},
    {base: 258, extra: 0}
  ];

  const DISTANCE_CODES = [
    {base: 1, extra: 0}, {base: 2, extra: 0}, {base: 3, extra: 0}, {base: 4, extra: 0},
    {base: 5, extra: 1}, {base: 7, extra: 1}, {base: 9, extra: 2}, {base: 13, extra: 2},
    {base: 17, extra: 3}, {base: 25, extra: 3}, {base: 33, extra: 4}, {base: 49, extra: 4},
    {base: 65, extra: 5}, {base: 97, extra: 5}, {base: 129, extra: 6}, {base: 193, extra: 6},
    {base: 257, extra: 7}, {base: 385, extra: 7}, {base: 513, extra: 8}, {base: 769, extra: 8},
    {base: 1025, extra: 9}, {base: 1537, extra: 9}, {base: 2049, extra: 10}, {base: 3073, extra: 10},
    {base: 4097, extra: 11}, {base: 6145, extra: 11}, {base: 8193, extra: 12}, {base: 12289, extra: 12},
    {base: 16385, extra: 13}, {base: 24577, extra: 13}
  ];

  const FIXED_LITERAL_LENGTHS = (() => {
    const lengths = new Array(288);
    for (let i = 0; i <= 143; ++i) lengths[i] = 8;
    for (let i = 144; i <= 255; ++i) lengths[i] = 9;
    for (let i = 256; i <= 279; ++i) lengths[i] = 7;
    for (let i = 280; i <= 287; ++i) lengths[i] = 8;
    return lengths;
  })();

  const FIXED_DISTANCE_LENGTHS = new Array(30).fill(5);

  const LIT_LEN_ALPHABET_SIZE = 286;
  const DIST_ALPHABET_SIZE = 30;
  const CL_ALPHABET_SIZE = 19;
  const MAX_CODE_BITS = 15;
  const MAX_CL_CODE_BITS = 7;
  const END_OF_BLOCK = 256;
  const WINDOW_SIZE = 32768;
  const MAX_MATCH = 258;
  const MIN_MATCH = 3;
  const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  const BLOCK_TYPE_STORED = 0;
  const BLOCK_TYPE_STATIC = 1;
  const BLOCK_TYPE_DYNAMIC = 2;

  // Costs are carried in units of 1/BIT_SCALE bit, so the shortest-path search never
  // touches a floating-point number and its answer depends on the input alone.
  const BIT_SCALE = 65536;

  // ===== BIT STREAM HELPERS (LSB-first, matches RFC 1951) =====

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

    alignToByte() {
      if (this.bitCount > 0) {
        this.bytes.push(OpCodes.AndN(this.bitBuffer, 0xFF));
        this.bitBuffer = 0;
        this.bitCount = 0;
      }
    }

    flush() {
      this.alignToByte();
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

  // ===== CANONICAL HUFFMAN TREE (RFC 1951 code assignment, used for both directions) =====

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
  //
  // Code lengths come from the shared deterministic builder, whose tie-break among
  // equally likely symbols is written down rather than inherited from a container's
  // internals; the depth limit RFC 1951 imposes is then repaired here.

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

  function buildHuffmanCodeLengths(counts, maxBits) {
    const lengths = HuffmanCodeLengths.buildCodeLengths(counts);
    limitHuffmanCodeLengths(lengths, maxBits);
    return lengths;
  }

  // Encodes the concatenated literal/length and distance code lengths with the
  // run-length alphabet of RFC 1951 section 3.2.7.
  function encodeCodeLengthRuns(lengths) {
    const result = [];
    let i = 0;

    while (i < lengths.length) {
      const value = lengths[i];

      if (value === 0) {
        let zeros = 1;
        while (i + zeros < lengths.length && lengths[i + zeros] === 0) ++zeros;

        let remaining = zeros;
        while (remaining > 0) {
          if (remaining >= 11) {
            // Symbol 18 repeats a zero 11 to 138 times.
            const run = Math.min(remaining, 138);
            result.push([18, 7, run - 11]);
            remaining -= run;
          } else if (remaining >= 3) {
            // Symbol 17 repeats a zero 3 to 10 times.
            result.push([17, 3, remaining - 3]);
            remaining = 0;
          } else {
            result.push([0, 0, 0]);
            --remaining;
          }
        }

        i += zeros;
        continue;
      }

      // Symbol 16 repeats the previous length 3 to 6 times, so the length itself is
      // written once first.
      result.push([value, 0, 0]);
      ++i;

      let repeats = 0;
      while (i + repeats < lengths.length && lengths[i + repeats] === value) ++repeats;

      let left = repeats;
      while (left >= 3) {
        const run = Math.min(left, 6);
        result.push([16, 2, run - 3]);
        left -= run;
      }
      while (left > 0) {
        result.push([value, 0, 0]);
        --left;
      }

      i += repeats;
    }

    return result;
  }

  // Both mappings are asked for millions of times per parse, so RFC 1951 table 3.2.5 is
  // walked once at load and answered from a lookup afterwards.

  const LENGTH_CODE_TABLE = (() => {
    const table = new Uint16Array(MAX_MATCH + 1);
    for (let length = MIN_MATCH; length <= MAX_MATCH; ++length) {
      let code = 285;
      for (let i = 0; i < LENGTH_CODES.length; ++i) {
        const info = LENGTH_CODES[i];
        const maxLen = i < LENGTH_CODES.length - 1 ? LENGTH_CODES[i + 1].base - 1 : info.base;
        if (length <= maxLen) { code = 257 + i; break; }
      }
      table[length] = code;
    }
    return table;
  })();

  const DISTANCE_CODE_TABLE = (() => {
    const table = new Uint8Array(WINDOW_SIZE + 1);
    for (let distance = 1; distance <= WINDOW_SIZE; ++distance) {
      let code = 29;
      for (let i = 0; i < DISTANCE_CODES.length; ++i) {
        const info = DISTANCE_CODES[i];
        const maxDist = i < DISTANCE_CODES.length - 1 ?
          DISTANCE_CODES[i + 1].base - 1 : OpCodes.ToUint32(info.base + OpCodes.Shl32(1, info.extra) - 1);
        if (distance <= maxDist) { code = i; break; }
      }
      table[distance] = code;
    }
    return table;
  })();

  function getLengthCode(length) {
    return LENGTH_CODE_TABLE[length];
  }

  function getDistanceCode(distance) {
    return DISTANCE_CODE_TABLE[distance];
  }

  // ===== COST MODEL =====
  //
  // The published Zopfli method drives its shortest-path search with the entropy of the
  // symbol counts produced by the previous parse, not with the integer Huffman code
  // lengths those counts would yield. Entropy is the better guide because Huffman lengths
  // are rounded to whole bits: a symbol carrying 1.2 bits of information and one carrying
  // 1.9 both get a one-bit code, so a parse steered by code lengths cannot tell them apart
  // and systematically over-values the commonest symbols. A symbol with a count of zero is
  // priced as if it occurred once - it is not forbidden, it merely did not appear last
  // time, and a fixed large penalty would wrongly rule it out for good.

  // Base-2 logarithm of a positive integer, in units of 1/BIT_SCALE.
  //
  // The value is first halved until it lies in [1,2), each halving contributing one whole
  // bit. Squaring a number in [1,2) either leaves it there or moves it into [2,4); which
  // of the two happens is exactly the next fractional bit of the logarithm, so sixteen
  // squarings yield sixteen fractional bits. Only integer multiplication and division are
  // involved and the largest intermediate stays below 2^34, so every machine agrees.
  function log2Fixed(value) {
    if (value <= 1) return 0;

    let scaled = value * BIT_SCALE;
    let result = 0;
    while (scaled >= 2 * BIT_SCALE) {
      scaled = Math.floor(scaled / 2);
      result += BIT_SCALE;
    }

    let bit = BIT_SCALE / 2;
    for (let i = 0; i < 16; ++i) {
      scaled = Math.floor(scaled * scaled / BIT_SCALE);
      if (scaled >= 2 * BIT_SCALE) {
        scaled = Math.floor(scaled / 2);
        result += bit;
      }
      bit = Math.floor(bit / 2);
    }

    return result;
  }

  function entropyCosts(counts) {
    const result = new Array(counts.length);

    let total = 0;
    for (let i = 0; i < counts.length; ++i) total += counts[i];

    // An empty alphabet has no observations to learn from; pricing every symbol at
    // log2(alphabet size) is the uniform distribution, which is the honest prior.
    const log2Total = log2Fixed(total === 0 ? counts.length : total);

    for (let i = 0; i < counts.length; ++i) {
      const cost = counts[i] === 0 ? log2Total : log2Total - log2Fixed(counts[i]);
      result[i] = cost < 0 ? 0 : cost;
    }

    return result;
  }

  class ZopfliCostModel {
    constructor(litLenCounts, distCounts) {
      const litLenCost = entropyCosts(litLenCounts);
      const distCost = entropyCosts(distCounts);
      this.litLenCost = litLenCost;

      // The shortest-path search asks for these millions of times, and both are functions
      // of the model alone, so they are worked out once here rather than per edge.
      this.lengthCost = new Float64Array(MAX_MATCH + 1);
      for (let length = MIN_MATCH; length <= MAX_MATCH; ++length) {
        const code = LENGTH_CODE_TABLE[length];
        this.lengthCost[length] = litLenCost[code] + LENGTH_CODES[code - 257].extra * BIT_SCALE;
      }

      this.distanceCost = new Float64Array(DIST_ALPHABET_SIZE);
      for (let code = 0; code < DIST_ALPHABET_SIZE; ++code)
        this.distanceCost[code] = distCost[code] + DISTANCE_CODES[code].extra * BIT_SCALE;
    }

    // The two halves of a back-reference are read separately because the parser walks
    // every length that shares one distance in a row, so the distance's cost is paid for
    // once per run rather than once per edge.
    literalCost(literal) {
      return this.litLenCost[literal];
    }
  }

  // ===== MATCH FINDING =====
  //
  // A shortest-path parse needs more than the single longest match at a position: a
  // shorter match may leave the remaining input in a cheaper state, so every reachable
  // length is a candidate edge, and RFC 1951 allows up to 256 distinct ones.
  //
  // The chain is walked newest-first, so candidate distances only ever grow as the walk
  // proceeds. The first candidate to reach a given length therefore reaches it at the
  // shortest distance available, and no later candidate can improve on it. That turns the
  // answer into a short list of runs: lengths 3 up to the first candidate's length share
  // its distance, the next lengths up to the second candidate's length share the second
  // candidate's distance, and so on. Shorter distances also cost fewer bits, so preferring
  // them is never wrong.

  // How many chain links a single position may examine. The walk also stops as soon as a
  // maximal match is in hand, which is what keeps runs of one repeated byte cheap, so the
  // cap only bites on input whose three-byte prefixes collide often without the matches
  // themselves getting long. Four thousand links is where the ratio stops improving
  // measurably on such input; it is also the depth zlib's own strongest setting uses.
  const MAX_CHAIN_HITS = 4096;

  class ZopfliHashChain {
    constructor(windowSize) {
      this.windowSize = windowSize;
      this.hashBits = 15;
      this.hashSize = OpCodes.Shl32(1, this.hashBits);
      this.hashMask = this.hashSize - 1;
      this.head = new Int32Array(this.hashSize).fill(-1);
      this.prev = new Int32Array(windowSize).fill(-1);
    }

    _hash(data, pos) {
      const h = OpCodes.XorN(OpCodes.XorN(OpCodes.Shl32(data[pos], 10), OpCodes.Shl32(data[pos + 1], 5)), data[pos + 2]);
      return OpCodes.AndN(h, this.hashMask);
    }

    // Appends the match runs available at the position and inserts it into the chain.
    // Run k covers the lengths from runMaxLength[k-1]+1 (or 3 for the first run) through
    // runMaxLength[k], all at distance runDistance[k].
    findMatchRuns(data, position, maxDistance, maxLength, runMaxLength, runDistance) {
      // The hash covers three bytes, so the last two positions can neither be searched
      // for nor entered into the chain.
      if (position + 2 >= data.length) return;

      const hash = this._hash(data, position);
      let candidate = this.head[hash];
      const windowStart = Math.max(0, position - maxDistance);
      const effectiveMaxLength = Math.min(maxLength, data.length - position);

      const mask = this.windowSize - 1;
      let hits = 0;
      let bestLength = 2; // one below the shortest match RFC 1951 can express

      while (candidate >= windowStart && hits < MAX_CHAIN_HITS) {
        const distance = position - candidate;

        let length = 0;
        while (length < effectiveMaxLength && data[candidate + length] === data[position + length]) ++length;

        if (length > bestLength) {
          runMaxLength.push(length);
          runDistance.push(distance);
          bestLength = length;

          // Nothing further back can beat a maximal match, and no shorter length is left
          // uncovered, so the walk is done.
          if (bestLength >= effectiveMaxLength) break;
        }

        const next = this.prev[OpCodes.AndN(candidate, mask)];

        // The chain runs strictly backwards; anything else is an entry from a previous
        // trip round the window and must not be followed.
        if (next < 0 || next >= candidate) break;

        candidate = next;
        ++hits;
      }

      this.prev[OpCodes.AndN(position, mask)] = this.head[hash];
      this.head[hash] = position;
    }
  }

  // Holds the match runs of every position, searched once and read many times. Zopfli
  // parses the same input over and over, each pass differing only in how it prices
  // symbols; the matches themselves never change, since they depend on the bytes and the
  // window rather than on the cost model. Searching them once is what makes a dozen
  // passes affordable and lets the splitter and every block's parse share one search.
  class ZopfliMatchCache {
    constructor(data) {
      const chain = new ZopfliHashChain(WINDOW_SIZE);
      const runStart = new Int32Array(data.length + 1);
      const maxLengths = [];
      const distances = [];

      for (let position = 0; position < data.length; ++position) {
        runStart[position] = maxLengths.length;
        chain.findMatchRuns(data, position, WINDOW_SIZE, MAX_MATCH, maxLengths, distances);
      }

      runStart[data.length] = maxLengths.length;

      this.runStart = runStart;
      this.runMaxLength = Uint16Array.from(maxLengths);
      this.runDistance = Uint16Array.from(distances);
    }

    longestMatch(position) {
      const end = this.runStart[position + 1];
      if (end === this.runStart[position]) return {length: 0, distance: 0};
      return {length: this.runMaxLength[end - 1], distance: this.runDistance[end - 1]};
    }
  }

  // ===== OPTIMAL PARSER =====
  //
  // Every position is a node; a literal is an edge one byte long and a match of length l
  // is an edge l bytes long, each weighted by what the current cost model says the
  // corresponding symbols cost. Because every edge moves strictly forward, one sweep in
  // increasing position order relaxes the graph in topological order and the result is
  // the true minimum, not the greedy or lazy approximation an ordinary encoder settles for.

  const UNREACHABLE = Number.MAX_VALUE;

  function optimalParse(data, start, end, cache, model) {
    const span = end - start;
    if (span <= 0) return [];

    const cost = new Float64Array(span + 1).fill(UNREACHABLE);
    const length = new Uint16Array(span + 1);
    const distance = new Uint16Array(span + 1);
    cost[0] = 0;

    for (let i = 0; i < span; ++i) {
      const here = cost[i];
      if (here === UNREACHABLE) continue;

      const position = start + i;

      const literalCost = here + model.literalCost(data[position]);
      if (literalCost < cost[i + 1]) {
        cost[i + 1] = literalCost;
        length[i + 1] = 1;
        distance[i + 1] = 0;
      }

      const runEnd = cache.runStart[position + 1];
      const lengthCost = model.lengthCost;
      let matchLength = MIN_MATCH;
      for (let run = cache.runStart[position]; run < runEnd; ++run) {
        const runDistance = cache.runDistance[run];
        const runMax = cache.runMaxLength[run];
        const distanceCost = here + model.distanceCost[DISTANCE_CODE_TABLE[runDistance]];

        // A match may not reach past the end of the range being parsed: the next block
        // starts there and would decode the overlap twice.
        while (matchLength <= runMax && i + matchLength <= span) {
          const candidate = distanceCost + lengthCost[matchLength];
          if (candidate < cost[i + matchLength]) {
            cost[i + matchLength] = candidate;
            length[i + matchLength] = matchLength;
            distance[i + matchLength] = runDistance;
          }
          ++matchLength;
        }

        if (i + matchLength > span) break;
      }
    }

    const symbols = [];
    let pos = span;
    while (pos > 0) {
      if (distance[pos] === 0) {
        symbols.push({isLiteral: true, literal: data[start + pos - 1]});
        --pos;
        continue;
      }

      symbols.push({isLiteral: false, length: length[pos], distance: distance[pos]});
      pos -= length[pos];
    }

    symbols.reverse();
    return symbols;
  }

  // The ordinary lazy-matching parse of a plain DEFLATE encoder. Zopfli runs it once
  // before the first shortest-path pass, purely to have realistic symbol counts to seed
  // the cost model with: starting from the RFC 1951 fixed tables instead would spend the
  // first pass, and often several after it, discovering what the input looks like.
  function greedyParse(data, start, end, cache) {
    const symbols = [];
    let position = start;

    while (position < end) {
      const match = cache.longestMatch(position);
      let length = match.length;
      if (length > end - position) length = end - position;

      if (length >= MIN_MATCH && position + 1 < end) {
        let nextLength = cache.longestMatch(position + 1).length;
        if (nextLength > end - position - 1) nextLength = end - position - 1;

        // A longer match one byte later is worth the literal it costs to wait for.
        if (nextLength > length) {
          symbols.push({isLiteral: true, literal: data[position]});
          ++position;
          continue;
        }
      }

      if (length < MIN_MATCH) {
        symbols.push({isLiteral: true, literal: data[position]});
        ++position;
        continue;
      }

      symbols.push({isLiteral: false, length: length, distance: match.distance});
      position += length;
    }

    return symbols;
  }

  // ===== BLOCK COST =====
  //
  // What a block of symbols actually costs in each of the three block types RFC 1951
  // offers, so that the splitter and the emitter decide from the same numbers. The cost is
  // derived from symbol histograms rather than from the symbols themselves, so the cost of
  // any range is available in time proportional to the alphabet instead of to the range -
  // which is what makes an exhaustive search over split points affordable. For a dynamic
  // block the figure is exact, code-length table and all; approximating that table (for
  // instance at three bits per symbol) inflates it several-fold and biases the splitter
  // towards blocks that are far too large.

  function ensureDistanceCode(distCounts) {
    for (let i = 0; i < distCounts.length; ++i)
      if (distCounts[i] > 0) return;

    distCounts[0] = 1;
  }

  function trimTrees(litLenLengths, distLengths) {
    let hlit = litLenLengths.length;
    while (hlit > 257 && litLenLengths[hlit - 1] === 0) --hlit;

    let hdist = distLengths.length;
    while (hdist > 1 && distLengths[hdist - 1] === 0) --hdist;

    return {hlit, hdist};
  }

  function tokenBits(litLenCounts, distCounts, litLenLengths, distLengths) {
    let bits = 0;

    for (let symbol = 0; symbol < litLenCounts.length; ++symbol) {
      const count = litLenCounts[symbol];
      if (count === 0) continue;

      bits += count * litLenLengths[symbol];
      if (symbol > END_OF_BLOCK) bits += count * LENGTH_CODES[symbol - 257].extra;
    }

    for (let symbol = 0; symbol < distCounts.length; ++symbol) {
      const count = distCounts[symbol];
      if (count === 0) continue;

      bits += count * (distLengths[symbol] + DISTANCE_CODES[symbol].extra);
    }

    return bits;
  }

  // Size in bits of a dynamic block's header, including the run-length-coded description
  // of both trees.
  function headerBits(litLenLengths, distLengths) {
    const {hlit, hdist} = trimTrees(litLenLengths, distLengths);

    const combined = new Array(hlit + hdist);
    for (let i = 0; i < hlit; ++i) combined[i] = litLenLengths[i];
    for (let i = 0; i < hdist; ++i) combined[hlit + i] = distLengths[i];

    const runs = encodeCodeLengthRuns(combined);
    const clCounts = new Array(CL_ALPHABET_SIZE).fill(0);
    for (const run of runs) ++clCounts[run[0]];

    const clLengths = buildHuffmanCodeLengths(clCounts, MAX_CL_CODE_BITS);

    let hclen = CL_ALPHABET_SIZE;
    while (hclen > 4 && clLengths[CODE_LENGTH_ORDER[hclen - 1]] === 0) --hclen;

    let bits = 3 + 5 + 5 + 4 + hclen * 3;
    for (const run of runs) bits += clLengths[run[0]] + run[1];

    return bits;
  }

  // Flattens stretches of nearly equal counts so that the code lengths they produce come
  // out exactly equal.
  //
  // A dynamic block spends real bits describing its trees, and RFC 1951 describes them
  // with a run-length alphabet whose symbol 16 repeats the previous code length. Two
  // symbols whose counts differ by one may land on different code lengths and break a run
  // that would otherwise have been free; giving them the same count costs a fraction of a
  // bit in the data and can save several in the header. The published Zopfli method does
  // the same and keeps whichever of the two tables comes out smaller, which is why this
  // only ever produces a candidate, never a decision.
  //
  // A stretch is flattened only when it is at least four symbols long, every count in it
  // is non-zero, and the largest and smallest differ by at most three. Excluding zeros
  // matters: a long run of unused symbols is already described in a handful of bits by
  // symbols 17 and 18, and raising those counts to one would be a large loss.
  function smoothCountsForRuns(counts) {
    const result = counts.slice();

    let end = counts.length;
    while (end > 0 && counts[end - 1] === 0) --end;

    let i = 0;
    while (i < end) {
      if (counts[i] === 0) {
        ++i;
        continue;
      }

      let low = counts[i];
      let high = counts[i];
      let j = i + 1;
      while (j < end && counts[j] !== 0) {
        const nextLow = Math.min(low, counts[j]);
        const nextHigh = Math.max(high, counts[j]);
        if (nextHigh - nextLow > 3) break;

        low = nextLow;
        high = nextHigh;
        ++j;
      }

      const run = j - i;
      if (run >= 4 && high !== low) {
        let sum = 0;
        for (let k = i; k < j; ++k) sum += counts[k];

        let mean = Math.floor((sum + Math.floor(run / 2)) / run);
        if (mean < 1) mean = 1;

        for (let k = i; k < j; ++k) result[k] = mean;
      }

      i = j;
    }

    return result;
  }

  // Chooses the trees a dynamic block should use and reports what the block costs with
  // them. Two candidate tree pairs are costed and the cheaper wins: the one the counts
  // imply directly, and the one implied by the smoothed histogram. Both are measured
  // against the real symbol counts, since smoothing changes only how the trees are shaped
  // and described, never what the block actually contains.
  function buildDynamicBlock(litLenCounts, distCounts) {
    // The header must describe a distance tree even for a block that holds no
    // back-reference, so one is invented for the tree; it is not counted as an emitted
    // symbol, because it is not one.
    const distForTree = distCounts.slice();
    ensureDistanceCode(distForTree);

    const plainLitLen = buildHuffmanCodeLengths(litLenCounts, MAX_CODE_BITS);
    const plainDist = buildHuffmanCodeLengths(distForTree, MAX_CODE_BITS);
    const plainBits = headerBits(plainLitLen, plainDist)
      + tokenBits(litLenCounts, distCounts, plainLitLen, plainDist);

    const smoothLitLen = buildHuffmanCodeLengths(smoothCountsForRuns(litLenCounts), MAX_CODE_BITS);
    const smoothDist = buildHuffmanCodeLengths(smoothCountsForRuns(distForTree), MAX_CODE_BITS);
    const smoothBits = headerBits(smoothLitLen, smoothDist)
      + tokenBits(litLenCounts, distCounts, smoothLitLen, smoothDist);

    return smoothBits < plainBits
      ? {litLenLengths: smoothLitLen, distLengths: smoothDist, bits: smoothBits}
      : {litLenLengths: plainLitLen, distLengths: plainDist, bits: plainBits};
  }

  function dynamicBlockBits(litLenCounts, distCounts) {
    return buildDynamicBlock(litLenCounts, distCounts).bits;
  }

  function staticBlockBits(litLenCounts, distCounts) {
    return 3 + tokenBits(litLenCounts, distCounts, FIXED_LITERAL_LENGTHS, FIXED_DISTANCE_LENGTHS);
  }

  // A stored block is byte-aligned, so its true cost depends on where in the byte the
  // preceding block ended. The worst case of seven padding bits is charged here rather
  // than tracking the writer's position, because the choice this figure feeds into is
  // never that close and a cost that does not depend on emission order is far easier to
  // keep identical across implementations. Each stored block carries a 16-bit length and
  // its complement, and RFC 1951 caps one at 65535 bytes, so a long run of raw data needs
  // several.
  function storedBlockBits(byteCount) {
    const chunks = Math.max(1, Math.floor((byteCount + 65534) / 65535));
    return chunks * (3 + 7 + 32) + byteCount * 8;
  }

  function cheapestBlock(litLenCounts, distCounts, byteCount) {
    const stored = storedBlockBits(byteCount);
    const fixedHuffman = staticBlockBits(litLenCounts, distCounts);
    const dynamicHuffman = dynamicBlockBits(litLenCounts, distCounts);

    // Ties go to the simpler type, which keeps the choice stable and the output smaller
    // to describe.
    if (stored <= fixedHuffman && stored <= dynamicHuffman)
      return {blockType: BLOCK_TYPE_STORED, bits: stored};

    return fixedHuffman <= dynamicHuffman
      ? {blockType: BLOCK_TYPE_STATIC, bits: fixedHuffman}
      : {blockType: BLOCK_TYPE_DYNAMIC, bits: dynamicHuffman};
  }

  // ===== BLOCK SPLITTING =====
  //
  // A block carries its own Huffman trees, so a boundary buys the encoder a fresh
  // description of the data on either side and costs it a second header. Where the input
  // changes character that trade is strongly worth making, and where it does not, it is
  // not. Zopfli therefore searches for the split points instead of imposing a fixed block
  // size. The published method places one split at a time, greedily; this does a proper
  // dynamic program over a grid of candidate boundaries instead, finding the cheapest
  // partition into at most MAX_BLOCKS blocks outright, which can never do worse. It is
  // affordable because the histogram of any range is the difference of two prefix
  // histograms, so evaluating a candidate takes time proportional to the alphabet rather
  // than to the block.

  const MAX_BLOCKS = 15;
  const MIN_SYMBOLS_TO_SPLIT = 512;
  const MAX_CANDIDATES = 128;

  function splitBlocks(symbols, maxBlocks) {
    if (symbols.length < MIN_SYMBOLS_TO_SPLIT || maxBlocks <= 1)
      return [{start: 0, end: symbols.length}];

    // Candidate boundaries on a regular grid. Finer than this buys almost nothing: a
    // boundary a few symbols out of place costs a handful of bits, while the header it
    // saves or spends is hundreds.
    const interval = Math.max(1, Math.floor(symbols.length / MAX_CANDIDATES));
    const candidates = [0];
    for (let i = interval; i < symbols.length; i += interval) candidates.push(i);
    if (candidates[candidates.length - 1] !== symbols.length) candidates.push(symbols.length);

    const count = candidates.length;

    // Prefix histograms at the candidate boundaries, plus the input bytes consumed, so
    // that any candidate block's statistics are one subtraction away.
    const litLenPrefix = new Array(count);
    const distPrefix = new Array(count);
    const bytePrefix = new Array(count).fill(0);
    litLenPrefix[0] = new Array(LIT_LEN_ALPHABET_SIZE).fill(0);
    distPrefix[0] = new Array(DIST_ALPHABET_SIZE).fill(0);

    for (let c = 1; c < count; ++c) {
      const litLen = litLenPrefix[c - 1].slice();
      const dist = distPrefix[c - 1].slice();
      let bytes = bytePrefix[c - 1];

      for (let s = candidates[c - 1]; s < candidates[c]; ++s) {
        const symbol = symbols[s];
        if (symbol.isLiteral) {
          ++litLen[symbol.literal];
          ++bytes;
          continue;
        }

        ++litLen[getLengthCode(symbol.length)];
        ++dist[getDistanceCode(symbol.distance)];
        bytes += symbol.length;
      }

      litLenPrefix[c] = litLen;
      distPrefix[c] = dist;
      bytePrefix[c] = bytes;
    }

    const rangeCost = (from, to) => {
      const litLen = new Array(LIT_LEN_ALPHABET_SIZE);
      for (let s = 0; s < LIT_LEN_ALPHABET_SIZE; ++s) litLen[s] = litLenPrefix[to][s] - litLenPrefix[from][s];

      const dist = new Array(DIST_ALPHABET_SIZE);
      for (let s = 0; s < DIST_ALPHABET_SIZE; ++s) dist[s] = distPrefix[to][s] - distPrefix[from][s];

      litLen[END_OF_BLOCK] = 1;

      return cheapestBlock(litLen, dist, bytePrefix[to] - bytePrefix[from]).bits;
    };

    const cost = new Array(count);
    for (let i = 0; i < count; ++i) {
      cost[i] = new Float64Array(count);
      for (let j = i + 1; j < count; ++j) cost[i][j] = rangeCost(i, j);
    }

    // best[b][j] is the cheapest way to cover the first j candidate intervals with
    // exactly b blocks; from[b][j] remembers where that partition's last block began.
    const best = new Array(maxBlocks + 1);
    const from = new Array(maxBlocks + 1);
    for (let b = 0; b <= maxBlocks; ++b) {
      best[b] = new Float64Array(count).fill(UNREACHABLE);
      from[b] = new Int32Array(count);
    }

    for (let j = 1; j < count; ++j) {
      best[1][j] = cost[0][j];
      from[1][j] = 0;
    }

    for (let b = 2; b <= maxBlocks; ++b)
      for (let j = b; j < count; ++j)
        for (let i = b - 1; i < j; ++i) {
          if (best[b - 1][i] === UNREACHABLE) continue;

          const total = best[b - 1][i] + cost[i][j];
          if (total >= best[b][j]) continue;

          best[b][j] = total;
          from[b][j] = i;
        }

    let bestBlocks = 1;
    for (let b = 2; b <= maxBlocks; ++b)
      if (best[b][count - 1] < best[bestBlocks][count - 1]) bestBlocks = b;

    const boundaries = [];
    let node = count - 1;
    for (let b = bestBlocks; b >= 1; --b) {
      boundaries.push(node);
      node = from[b][node];
    }

    boundaries.push(0);
    boundaries.reverse();

    const result = [];
    for (let i = 0; i + 1 < boundaries.length; ++i)
      result.push({start: candidates[boundaries[i]], end: candidates[boundaries[i + 1]]});

    return result;
  }

  // ===== ITERATIVE SEARCH =====

  // How many rounds of re-parsing a block gets. Each round costs about as much as one
  // pass of the shortest-path search over the block, so the budget shrinks as the input
  // grows; the returns diminish sharply after the first few rounds in any case.
  function iterationsFor(totalLength) {
    if (totalLength <= 16384) return 60;
    if (totalLength <= 131072) return 40;
    if (totalLength <= 524288) return 30;
    return 25;
  }

  // Counts the symbols of a parse, with the end-of-block symbol included.
  function countSymbols(symbols) {
    const litLen = new Array(LIT_LEN_ALPHABET_SIZE).fill(0);
    const dist = new Array(DIST_ALPHABET_SIZE).fill(0);

    for (const symbol of symbols) {
      if (symbol.isLiteral) {
        ++litLen[symbol.literal];
        continue;
      }

      ++litLen[getLengthCode(symbol.length)];
      ++dist[getDistanceCode(symbol.distance)];
    }

    litLen[END_OF_BLOCK] = 1;
    return {litLen, dist};
  }

  function blockBits(litLenCounts, distCounts, byteCount) {
    return cheapestBlock(litLenCounts, distCounts, byteCount).bits;
  }

  // Replaces about a third of the counts with another count drawn from the same table.
  // The point is to move the cost model somewhere the loop has not been, cheaply, without
  // losing the shape of the distribution: every value written is a value the table already
  // held. The generator is the linear congruential one of Knuth's The Art of Computer
  // Programming volume 2, taken modulo 2^32; only its high bits are consulted, since the
  // low bits of such a generator cycle far too quickly to be useful.
  function perturbCounts(counts, state) {
    for (let i = 0; i < counts.length; ++i) {
      state = OpCodes.ToUint32(OpCodes.Mul32(state, 1664525) + 1013904223);
      if (Math.floor(state / 256) % 3 !== 0) continue;

      state = OpCodes.ToUint32(OpCodes.Mul32(state, 1664525) + 1013904223);
      counts[i] = counts[state % counts.length];
    }

    return state;
  }

  // Weights the current counts at one and the previous round's at one half. Halving the
  // older term keeps the blend bounded no matter how many rounds run, which integer counts
  // need and floating-point ones can ignore.
  function blendCounts(current, previous) {
    const result = new Array(current.length);
    for (let i = 0; i < current.length; ++i) result[i] = current[i] + Math.floor(previous[i] / 2);
    return result;
  }

  // The loop is not a contraction and need not improve every round, which is why the size
  // of each round's parse is measured exactly and the smallest is what gets emitted. When
  // two consecutive rounds land on the same size the search has settled, and it is nudged
  // off that fixed point by perturbing the counts, so that the remaining rounds explore
  // instead of recomputing an answer already in hand.
  function optimizeBlock(data, start, end, cache, iterations) {
    const byteCount = end - start;

    const seed = greedyParse(data, start, end, cache);
    const seedCounts = countSymbols(seed);

    let best = seed;
    let bestBits = blockBits(seedCounts.litLen, seedCounts.dist, byteCount);
    let bestLitLen = seedCounts.litLen;
    let bestDist = seedCounts.dist;

    let modelLitLen = seedCounts.litLen;
    let modelDist = seedCounts.dist;

    let lastLitLen = null;
    let lastDist = null;
    let lastBits = -1;
    let perturbed = false;
    let random = 0x5A17E1F1;

    for (let iteration = 0; iteration < iterations; ++iteration) {
      const model = new ZopfliCostModel(modelLitLen, modelDist);
      const parsed = optimalParse(data, start, end, cache, model);
      const parsedCounts = countSymbols(parsed);
      const bits = blockBits(parsedCounts.litLen, parsedCounts.dist, byteCount);

      if (bits < bestBits) {
        best = parsed;
        bestBits = bits;
        bestLitLen = parsedCounts.litLen;
        bestDist = parsedCounts.dist;
      }

      let nextLitLen = parsedCounts.litLen;
      let nextDist = parsedCounts.dist;

      // Two rounds of the same size means the loop has reached a fixed point. Restarting
      // from the best counts seen, perturbed, is what turns the remaining rounds into a
      // wider search rather than a repetition.
      if (iteration >= 5 && bits === lastBits) {
        nextLitLen = bestLitLen.slice();
        nextDist = bestDist.slice();
        random = perturbCounts(nextLitLen, random);
        random = perturbCounts(nextDist, random);
        perturbed = true;
      }

      // Once the search is exploring, blending in the previous round's counts damps the
      // swing between rounds; converging slowly on a better answer beats oscillating.
      if (perturbed && lastLitLen !== null && lastDist !== null) {
        nextLitLen = blendCounts(nextLitLen, lastLitLen);
        nextDist = blendCounts(nextDist, lastDist);
      }

      lastLitLen = modelLitLen;
      lastDist = modelDist;
      lastBits = bits;
      modelLitLen = nextLitLen;
      modelDist = nextDist;
    }

    return best;
  }

  // Plans how to encode the input: where the blocks go and what symbols each holds.
  function compressOptimal(data) {
    if (data.length === 0) return [{start: 0, end: 0, symbols: []}];

    const cache = new ZopfliMatchCache(data);
    const seed = greedyParse(data, 0, data.length, cache);

    // Split on the seed parse. The split points are input positions, so each block can
    // then be parsed on its own terms, with its own cost model - which is the whole point
    // of splitting. Matches inside a block may still reach back into earlier blocks.
    const ranges = splitBlocks(seed, MAX_BLOCKS);
    const byteStart = new Array(ranges.length + 1);
    let consumed = 0;
    let symbolIndex = 0;
    for (let r = 0; r < ranges.length; ++r) {
      byteStart[r] = consumed;
      for (; symbolIndex < ranges[r].end; ++symbolIndex)
        consumed += seed[symbolIndex].isLiteral ? 1 : seed[symbolIndex].length;
    }

    byteStart[ranges.length] = data.length;

    const iterations = iterationsFor(data.length);
    const result = [];
    for (let r = 0; r < ranges.length; ++r) {
      const start = byteStart[r];
      const end = byteStart[r + 1];
      result.push({start, end, symbols: optimizeBlock(data, start, end, cache, iterations)});
    }

    return result;
  }

  // ===== BLOCK EMISSION =====

  function writeTokens(stream, symbols, literalTree, distanceTree) {
    for (const token of symbols) {
      if (token.isLiteral) {
        const {code, length} = literalTree.encode(token.literal);
        stream.writeHuffmanCode(code, length);
        continue;
      }

      const lengthCode = getLengthCode(token.length);
      const lengthInfo = LENGTH_CODES[lengthCode - 257];
      const lenEntry = literalTree.encode(lengthCode);
      stream.writeHuffmanCode(lenEntry.code, lenEntry.length);
      if (lengthInfo.extra > 0) stream.writeBits(token.length - lengthInfo.base, lengthInfo.extra);

      const distCode = getDistanceCode(token.distance);
      const distInfo = DISTANCE_CODES[distCode];
      const distEntry = distanceTree.encode(distCode);
      stream.writeHuffmanCode(distEntry.code, distEntry.length);
      if (distInfo.extra > 0) stream.writeBits(token.distance - distInfo.base, distInfo.extra);
    }
  }

  function emitStoredBlock(stream, data, start, end, isFinal) {
    let offset = start;
    while (offset < end) {
      const chunkSize = Math.min(end - offset, 65535);
      const isLastChunk = (offset + chunkSize >= end) && isFinal;

      stream.writeBits(isLastChunk ? 1 : 0, 1);
      stream.writeBits(BLOCK_TYPE_STORED, 2);
      stream.alignToByte();

      stream.writeBits(chunkSize, 16);
      stream.writeBits(OpCodes.AndN(OpCodes.ToUint32(-chunkSize - 1), 0xFFFF), 16);

      for (let i = 0; i < chunkSize; ++i) stream.writeBits(data[offset + i], 8);

      offset += chunkSize;
    }
  }

  function emitStaticHuffmanBlock(stream, symbols, isFinal) {
    const literalTree = HuffmanTree.buildFromLengths(FIXED_LITERAL_LENGTHS);
    const distanceTree = HuffmanTree.buildFromLengths(FIXED_DISTANCE_LENGTHS);

    stream.writeBits(isFinal ? 1 : 0, 1);
    stream.writeBits(BLOCK_TYPE_STATIC, 2);

    writeTokens(stream, symbols, literalTree, distanceTree);

    const {code, length} = literalTree.encode(END_OF_BLOCK);
    stream.writeHuffmanCode(code, length);
  }

  function emitDynamicHuffmanBlock(stream, litLenCounts, distCounts, symbols, isFinal) {
    // The trees are the ones the block's measured cost was based on, which may be the
    // run-friendly variant, and which already invents the distance code a block without
    // back-references needs.
    const chosen = buildDynamicBlock(litLenCounts, distCounts);
    const litLenLengths = chosen.litLenLengths;
    const distLengths = chosen.distLengths;
    const {hlit, hdist} = trimTrees(litLenLengths, distLengths);

    const combined = new Array(hlit + hdist);
    for (let i = 0; i < hlit; ++i) combined[i] = litLenLengths[i];
    for (let i = 0; i < hdist; ++i) combined[hlit + i] = distLengths[i];
    const runs = encodeCodeLengthRuns(combined);

    const clCounts = new Array(CL_ALPHABET_SIZE).fill(0);
    for (const run of runs) ++clCounts[run[0]];
    if (!clCounts.some(f => f > 0)) clCounts[0] = 1;
    const clLengths = buildHuffmanCodeLengths(clCounts, MAX_CL_CODE_BITS);

    let hclen = CL_ALPHABET_SIZE;
    while (hclen > 4 && clLengths[CODE_LENGTH_ORDER[hclen - 1]] === 0) --hclen;

    const clTree = HuffmanTree.buildFromLengths(clLengths);

    stream.writeBits(isFinal ? 1 : 0, 1);
    stream.writeBits(BLOCK_TYPE_DYNAMIC, 2);
    stream.writeBits(hlit - 257, 5);
    stream.writeBits(hdist - 1, 5);
    stream.writeBits(hclen - 4, 4);

    for (let i = 0; i < hclen; ++i) stream.writeBits(clLengths[CODE_LENGTH_ORDER[i]], 3);

    for (const run of runs) {
      const {code, length} = clTree.encode(run[0]);
      stream.writeHuffmanCode(code, length);
      if (run[1] > 0) stream.writeBits(run[2], run[1]);
    }

    const literalTree = HuffmanTree.buildFromLengths(litLenLengths.slice(0, hlit));
    const distanceTree = HuffmanTree.buildFromLengths(distLengths.slice(0, hdist));

    writeTokens(stream, symbols, literalTree, distanceTree);

    const {code, length} = literalTree.encode(END_OF_BLOCK);
    stream.writeHuffmanCode(code, length);
  }

  // ===== ZOPFLI COMPRESSION ALGORITHM =====

  class ZopfliCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Zopfli";
      this.description = "Iterative-optimal DEFLATE encoder from Google (2013). Parses the input by shortest path over the entropy of the previous parse's symbol counts, repeats until the size stops falling, and searches for the block boundaries that minimise the total. Output is standard RFC 1951 DEFLATE, decodable by any conforming reader.";
      this.inventor = "Lode Vandevenne, Jyrki Alakuijala (Google)";
      this.year = 2013;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Deflate Optimizer (LZ77 + Huffman)";
      this.securityStatus = null;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Zopfli Announcement (2013)", "https://opensource.googleblog.com/2013/02/compress-data-more-densely-with-zopfli.html"),
        new LinkItem("RFC 1951 - Deflate Format", "https://datatracker.ietf.org/doc/html/rfc1951"),
        new LinkItem("Zopfli Wikipedia", "https://en.wikipedia.org/wiki/Zopfli")
      ];

      this.references = [
        new LinkItem("Official Google Zopfli Repository (C reference implementation)", "https://github.com/google/zopfli")
      ];

      // Test vectors - Round-trip compression tests (Zopfli output varies with
      // iteration/block-splitting heuristics, so exact bytes aren't pinned here)
      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes("hello"),
          [],
          "Zopfli RFC 1951 round-trip - hello",
          "https://datatracker.ietf.org/doc/html/rfc1951"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AAAA"),
          [],
          "Zopfli RFC 1951 round-trip - AAAA",
          "https://datatracker.ietf.org/doc/html/rfc1951"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("ABCABCABC"),
          [],
          "Zopfli RFC 1951 round-trip - ABCABCABC",
          "https://datatracker.ietf.org/doc/html/rfc1951"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new ZopfliInstance(this, isInverse);
    }
  }

  /**
   * Zopfli cipher instance implementing Feed/Result pattern
   * @class
   * @extends {IAlgorithmInstance}
   */
  class ZopfliInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }


    Result() {
      // Like DEFLATE, an empty input is not a no-op for compression: RFC 1951
      // still requires a minimal final block. Decompression of a genuinely
      // empty buffer has nothing to read and legitimately yields [].
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
      const blocks = compressOptimal(data);

      for (let i = 0; i < blocks.length; ++i) {
        const {start, end, symbols} = blocks[i];
        const isLastBlock = i === blocks.length - 1;

        const counts = countSymbols(symbols);

        // Data that will not compress must still be handed on unharmed: without the
        // stored block type an incompressible block grows by roughly a byte per hundred
        // instead of by five bytes per 64 KB.
        const choice = cheapestBlock(counts.litLen, counts.dist, end - start);
        if (choice.blockType === BLOCK_TYPE_STORED) emitStoredBlock(stream, data, start, end, isLastBlock);
        else if (choice.blockType === BLOCK_TYPE_STATIC) emitStaticHuffmanBlock(stream, symbols, isLastBlock);
        else emitDynamicHuffmanBlock(stream, counts.litLen, counts.dist, symbols, isLastBlock);
      }

      return stream.flush();
    }

    // ===== DECOMPRESSION (standard RFC 1951 reader) =====

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
            literalTree = HuffmanTree.buildFromLengths(FIXED_LITERAL_LENGTHS);
            distanceTree = HuffmanTree.buildFromLengths(FIXED_DISTANCE_LENGTHS);
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

  const algorithmInstance = new ZopfliCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ZopfliCompression, ZopfliInstance };
}));
