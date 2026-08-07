/*
 * Zopfli Compression Algorithm Implementation (RFC 1951 DEFLATE, optimal parsing)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Zopfli is an iterative-optimal DEFLATE encoder: it repeatedly re-parses the
 * input with a shortest-path search driven by the previous iteration's Huffman
 * code lengths, then splits the result into cost-minimizing blocks. The output
 * is standard RFC 1951 DEFLATE - smaller than greedy/lazy DEFLATE on typical
 * inputs, but decodable by any conforming DEFLATE reader (including zlib).
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
  const MAX_ITERATIONS = 15;
  const MAX_SPLIT_BLOCKS = 15;
  const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

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

  // ===== HUFFMAN TREE FROM FREQUENCIES (binary min-heap construction, matching
  // CompressionWorkbench's HuffmanTree.BuildFromFrequencies tie-break exactly) =====

  function compareFrequencyNodes(a, b) {
    if (a.frequency !== b.frequency) return a.frequency < b.frequency ? -1 : 1;
    return a.symbol - b.symbol;
  }

  class FrequencyMinHeap {
    constructor() {
      this.items = [];
    }

    get count() {
      return this.items.length;
    }

    insert(item) {
      this.items.push(item);
      this._siftUp(this.items.length - 1);
    }

    extractMin() {
      const min = this.items[0];
      const last = this.items.length - 1;
      this.items[0] = this.items[last];
      this.items.pop();
      if (this.items.length > 0) this._siftDown(0);
      return min;
    }

    _siftUp(index) {
      while (index > 0) {
        const parent = OpCodes.Shr32(index - 1, 1);
        if (compareFrequencyNodes(this.items[index], this.items[parent]) < 0) {
          const tmp = this.items[index];
          this.items[index] = this.items[parent];
          this.items[parent] = tmp;
          index = parent;
        } else break;
      }
    }

    _siftDown(index) {
      const count = this.items.length;
      for (;;) {
        const left = 2 * index + 1;
        const right = 2 * index + 2;
        let smallest = index;
        if (left < count && compareFrequencyNodes(this.items[left], this.items[smallest]) < 0) smallest = left;
        if (right < count && compareFrequencyNodes(this.items[right], this.items[smallest]) < 0) smallest = right;
        if (smallest !== index) {
          const tmp = this.items[index];
          this.items[index] = this.items[smallest];
          this.items[smallest] = tmp;
          index = smallest;
        } else break;
      }
    }
  }

  function buildHuffmanTreeFromFrequencies(frequencies) {
    const heap = new FrequencyMinHeap();
    for (let i = 0; i < frequencies.length; ++i)
      if (frequencies[i] > 0) heap.insert({symbol: i, frequency: frequencies[i], left: null, right: null});

    if (heap.count === 0) throw new Error('At least one symbol must have a non-zero frequency.');

    if (heap.count === 1) {
      const single = heap.extractMin();
      return {symbol: -1, left: single, right: {symbol: -2, frequency: 0, left: null, right: null}, frequency: single.frequency};
    }

    while (heap.count > 1) {
      const left = heap.extractMin();
      const right = heap.extractMin();
      heap.insert({symbol: -1, left: left, right: right, frequency: left.frequency + right.frequency});
    }

    return heap.extractMin();
  }

  function assignHuffmanLengths(node, depth, lengths) {
    if (node.left === null && node.right === null) {
      if (node.symbol >= 0 && node.symbol < lengths.length) lengths[node.symbol] = depth;
      return;
    }

    if (node.left) assignHuffmanLengths(node.left, depth + 1, lengths);
    if (node.right) assignHuffmanLengths(node.right, depth + 1, lengths);
  }

  function getHuffmanCodeLengths(root, maxSymbol) {
    const lengths = new Array(maxSymbol).fill(0);
    assignHuffmanLengths(root, 0, lengths);
    return lengths;
  }

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
    const root = buildHuffmanTreeFromFrequencies(frequencies);
    const lengths = getHuffmanCodeLengths(root, alphabetSize);
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

  function getLengthCode(length) {
    for (let i = 0; i < LENGTH_CODES.length; ++i) {
      const info = LENGTH_CODES[i];
      const maxLen = i < LENGTH_CODES.length - 1 ? LENGTH_CODES[i + 1].base - 1 : info.base;
      if (length <= maxLen) return 257 + i;
    }
    return 285;
  }

  function getDistanceCode(distance) {
    for (let i = 0; i < DISTANCE_CODES.length; ++i) {
      const info = DISTANCE_CODES[i];
      const maxDist = i < DISTANCE_CODES.length - 1 ?
        DISTANCE_CODES[i + 1].base - 1 : OpCodes.ToUint32(info.base + OpCodes.Shl32(1, info.extra) - 1);
      if (distance <= maxDist) return i;
    }
    return 29;
  }

  // ===== ZOPFLI HASH CHAIN (returns every achievable match length at each
  // position, matching CompressionWorkbench's ZopfliHashChain.FindAllMatches) =====

  class ZopfliHashChain {
    constructor(windowSize) {
      this.windowSize = windowSize;
      this.hashBits = 15;
      this.hashSize = OpCodes.Shl32(1, this.hashBits);
      this.hashMask = this.hashSize - 1;
      this.head = new Int32Array(this.hashSize).fill(-1);
      this.prev = new Int32Array(windowSize);
    }

    _hash(data, pos) {
      const h = OpCodes.XorN(OpCodes.XorN(OpCodes.Shl32(data[pos], 10), OpCodes.Shl32(data[pos + 1], 5)), data[pos + 2]);
      return OpCodes.AndN(h, this.hashMask);
    }

    findAllMatches(data, position, maxDistance, maxLength) {
      const result = [];
      if (position + 2 >= data.length) return result;

      const hash = this._hash(data, position);
      let candidate = this.head[hash];
      const windowStart = Math.max(0, position - maxDistance);
      const chainDepth = this._computeChainDepth(data, position);
      let chainCount = 0;

      const effectiveMaxLen = Math.min(maxLength, data.length - position);
      const bestDistByLen = new Array(effectiveMaxLen + 1).fill(-1);
      const mask = this.windowSize - 1;

      while (candidate >= windowStart && chainCount < chainDepth) {
        const distance = position - candidate;
        const limit = Math.min(effectiveMaxLen, data.length - candidate);

        let length = 0;
        while (length < limit && data[candidate + length] === data[position + length]) ++length;

        if (length >= MIN_MATCH)
          for (let l = MIN_MATCH; l <= length; ++l)
            if (bestDistByLen[l] < 0 || distance < bestDistByLen[l]) bestDistByLen[l] = distance;

        candidate = this.prev[OpCodes.AndN(candidate, mask)];
        if (candidate <= windowStart) break;
        ++chainCount;
      }

      this.prev[OpCodes.AndN(position, mask)] = this.head[hash];
      this.head[hash] = position;

      for (let l = MIN_MATCH; l <= effectiveMaxLen; ++l)
        if (bestDistByLen[l] >= 0) result.push({distance: bestDistByLen[l], length: l});

      return result;
    }

    _computeChainDepth(data, position) {
      const windowLen = Math.min(64, data.length - position);
      if (windowLen <= 0) return 512;

      const seen = new Array(256).fill(false);
      let unique = 0;
      for (let i = 0; i < windowLen; ++i) {
        const dataByte = data[position + i];
        if (seen[dataByte]) continue;
        seen[dataByte] = true;
        ++unique;
      }

      const diversity = unique / windowLen;
      if (diversity < 0.1) return 2048;
      if (diversity > 0.6) return 128;
      return 512;
    }
  }

  // ===== OPTIMAL PARSER (forward-DP shortest path over the current Huffman cost model) =====

  function getLitLenCost(symbol, litLenLengths, unseenPenalty) {
    return (symbol < litLenLengths.length && litLenLengths[symbol] > 0) ? litLenLengths[symbol] : unseenPenalty;
  }

  function getMatchCost(length, distance, litLenLengths, distLengths, unseenPenalty) {
    const lengthCode = getLengthCode(length);
    const lengthIdx = lengthCode - 257;

    let cost = 0;
    cost += (lengthCode < litLenLengths.length && litLenLengths[lengthCode] > 0) ? litLenLengths[lengthCode] : unseenPenalty;
    cost += LENGTH_CODES[lengthIdx].extra;

    const distCode = getDistanceCode(distance);
    cost += (distCode < distLengths.length && distLengths[distCode] > 0) ? distLengths[distCode] : unseenPenalty;
    cost += DISTANCE_CODES[distCode].extra;

    return cost;
  }

  function optimalParse(data, hashChain, litLenLengths, distLengths) {
    if (data.length === 0) return [];

    const length = data.length;
    const dpCost = new Float64Array(length + 1).fill(Number.MAX_VALUE);
    const dpLength = new Uint16Array(length + 1);
    const dpDistance = new Uint16Array(length + 1);
    dpCost[0] = 0;

    const UNSEEN_PENALTY = 15.0;

    for (let i = 0; i < length; ++i) {
      if (dpCost[i] >= Number.MAX_VALUE) continue;

      const litCost = getLitLenCost(data[i], litLenLengths, UNSEEN_PENALTY);
      const newLitCost = dpCost[i] + litCost;
      if (newLitCost < dpCost[i + 1]) {
        dpCost[i + 1] = newLitCost;
        dpLength[i + 1] = 1;
        dpDistance[i + 1] = 0;
      }

      const matches = hashChain.findAllMatches(data, i, WINDOW_SIZE, MAX_MATCH);
      for (const match of matches) {
        const dest = i + match.length;
        if (dest > length) continue;

        const matchCost = getMatchCost(match.length, match.distance, litLenLengths, distLengths, UNSEEN_PENALTY);
        const newCost = dpCost[i] + matchCost;
        if (!(newCost < dpCost[dest])) continue;

        dpCost[dest] = newCost;
        dpLength[dest] = match.length;
        dpDistance[dest] = match.distance;
      }
    }

    const symbols = [];
    let pos = length;
    while (pos > 0) {
      const len = dpLength[pos];
      const dist = dpDistance[pos];
      if (dist === 0) {
        symbols.push({isLiteral: true, literal: data[pos - 1]});
        pos -= 1;
      } else {
        symbols.push({isLiteral: false, length: len, distance: dist});
        pos -= len;
      }
    }

    symbols.reverse();
    return symbols;
  }

  // ===== BLOCK SPLITTER (DP over candidate cut points minimizing estimated bit cost) =====

  function estimateBlockBits(symbols) {
    if (symbols.length === 0) return 0;

    const litLenFreqs = new Array(LIT_LEN_ALPHABET_SIZE).fill(0);
    const distFreqs = new Array(DIST_ALPHABET_SIZE).fill(0);
    for (const sym of symbols) {
      if (sym.isLiteral) ++litLenFreqs[sym.literal];
      else {
        ++litLenFreqs[getLengthCode(sym.length)];
        ++distFreqs[getDistanceCode(sym.distance)];
      }
    }
    litLenFreqs[END_OF_BLOCK] = 1;
    if (!distFreqs.some(f => f > 0)) distFreqs[0] = 1;

    const litLenLengths = buildHuffmanCodeLengths(litLenFreqs, LIT_LEN_ALPHABET_SIZE, MAX_CODE_BITS);
    const distLengths = buildHuffmanCodeLengths(distFreqs, DIST_ALPHABET_SIZE, MAX_CODE_BITS);

    let bits = 3 + 5 + 5 + 4;

    let hlit = litLenLengths.length;
    while (hlit > 257 && litLenLengths[hlit - 1] === 0) --hlit;
    let hdist = distLengths.length;
    while (hdist > 1 && distLengths[hdist - 1] === 0) --hdist;

    bits += (hlit + hdist) * 3.0;

    for (const sym of symbols) {
      if (sym.isLiteral) bits += litLenLengths[sym.literal];
      else {
        const lengthCode = getLengthCode(sym.length);
        bits += litLenLengths[lengthCode];
        bits += LENGTH_CODES[lengthCode - 257].extra;
        const distCode = getDistanceCode(sym.distance);
        bits += distLengths[distCode];
        bits += DISTANCE_CODES[distCode].extra;
      }
    }

    bits += litLenLengths[END_OF_BLOCK];
    return bits;
  }

  function splitBlocks(symbols, maxBlocks) {
    if (symbols.length < 1024 || maxBlocks <= 1) return [{start: 0, end: symbols.length}];

    const interval = Math.max(Math.floor(symbols.length / (maxBlocks * 3)), 128);
    const candidates = [0];
    for (let i = interval; i < symbols.length; i += interval) candidates.push(i);
    candidates.push(symbols.length);

    const n = candidates.length;
    const cost = [];
    for (let i = 0; i < n; ++i) {
      cost.push(new Array(n).fill(0));
      for (let j = i + 1; j < n; ++j) cost[i][j] = estimateBlockBits(symbols.slice(candidates[i], candidates[j]));
    }

    const dp = new Array(n).fill(Number.MAX_VALUE);
    const prev = new Array(n).fill(0);
    dp[0] = 0;

    for (let j = 1; j < n; ++j)
      for (let i = 0; i < j; ++i) {
        if (dp[i] >= Number.MAX_VALUE) continue;
        const total = dp[i] + cost[i][j];
        if (!(total < dp[j])) continue;
        dp[j] = total;
        prev[j] = i;
      }

    const splitPoints = [];
    let idx = n - 1;
    while (idx > 0) {
      splitPoints.push(idx);
      idx = prev[idx];
    }
    splitPoints.push(0);
    splitPoints.reverse();

    while (splitPoints.length - 1 > maxBlocks) {
      let bestMergeCost = Number.MAX_VALUE;
      let bestMergeIdx = 1;

      for (let i = 1; i < splitPoints.length - 1; ++i) {
        const a = splitPoints[i - 1];
        const b = splitPoints[i];
        const c = splitPoints[i + 1];
        const delta = cost[a][c] - (cost[a][b] + cost[b][c]);
        if (!(delta < bestMergeCost)) continue;
        bestMergeCost = delta;
        bestMergeIdx = i;
      }

      splitPoints.splice(bestMergeIdx, 1);
    }

    const result = [];
    for (let i = 0; i < splitPoints.length - 1; ++i)
      result.push({start: candidates[splitPoints[i]], end: candidates[splitPoints[i + 1]]});

    return result;
  }

  // ===== ITERATIVE OPTIMAL PARSE + BLOCK SPLIT ORCHESTRATOR (ZopfliDeflate.CompressOptimal) =====

  function computeSymbolHash(symbols) {
    let hash = 0n;
    for (const sym of symbols) {
      const litLen = sym.isLiteral ? sym.literal : sym.length;
      const distance = sym.isLiteral ? 0 : sym.distance;
      hash = BigInt.asIntN(64, hash * 31n + BigInt(litLen));
      hash = BigInt.asIntN(64, hash * 31n + BigInt(distance));
    }
    return hash;
  }

  function compressOptimal(data) {
    if (data.length === 0)
      return [{symbols: [], litLenLengths: FIXED_LITERAL_LENGTHS, distLengths: FIXED_DISTANCE_LENGTHS}];

    let litLenLengths = FIXED_LITERAL_LENGTHS;
    let distLengths = FIXED_DISTANCE_LENGTHS;
    let bestSymbols = [];
    let prevHash = 0n;

    for (let iteration = 0; iteration < MAX_ITERATIONS; ++iteration) {
      const hashChain = new ZopfliHashChain(WINDOW_SIZE);
      const symbols = optimalParse(data, hashChain, litLenLengths, distLengths);
      bestSymbols = symbols;

      const litLenFreqs = new Array(LIT_LEN_ALPHABET_SIZE).fill(0);
      const distFreqs = new Array(DIST_ALPHABET_SIZE).fill(0);
      for (const sym of symbols) {
        if (sym.isLiteral) ++litLenFreqs[sym.literal];
        else {
          ++litLenFreqs[getLengthCode(sym.length)];
          ++distFreqs[getDistanceCode(sym.distance)];
        }
      }
      litLenFreqs[END_OF_BLOCK] = 1;
      if (!distFreqs.some(f => f > 0)) distFreqs[0] = 1;

      litLenLengths = buildHuffmanCodeLengths(litLenFreqs, LIT_LEN_ALPHABET_SIZE, MAX_CODE_BITS);
      if (litLenLengths.length < 288) {
        const padded = new Array(288).fill(0);
        for (let i = 0; i < litLenLengths.length; ++i) padded[i] = litLenLengths[i];
        litLenLengths = padded;
      }
      distLengths = buildHuffmanCodeLengths(distFreqs, DIST_ALPHABET_SIZE, MAX_CODE_BITS);

      const currentHash = computeSymbolHash(symbols);
      if (currentHash === prevHash && iteration > 0) break;
      prevHash = currentHash;
    }

    const blocks = splitBlocks(bestSymbols, MAX_SPLIT_BLOCKS);
    const result = [];

    for (const {start, end} of blocks) {
      const blockSymbols = bestSymbols.slice(start, end);

      const blockLitLenFreqs = new Array(LIT_LEN_ALPHABET_SIZE).fill(0);
      const blockDistFreqs = new Array(DIST_ALPHABET_SIZE).fill(0);
      for (const sym of blockSymbols) {
        if (sym.isLiteral) ++blockLitLenFreqs[sym.literal];
        else {
          ++blockLitLenFreqs[getLengthCode(sym.length)];
          ++blockDistFreqs[getDistanceCode(sym.distance)];
        }
      }
      blockLitLenFreqs[END_OF_BLOCK] = 1;
      if (!blockDistFreqs.some(f => f > 0)) blockDistFreqs[0] = 1;

      const blockLitLenLengths = buildHuffmanCodeLengths(blockLitLenFreqs, LIT_LEN_ALPHABET_SIZE, MAX_CODE_BITS);
      const blockDistLengths = buildHuffmanCodeLengths(blockDistFreqs, DIST_ALPHABET_SIZE, MAX_CODE_BITS);

      result.push({symbols: blockSymbols, litLenLengths: blockLitLenLengths, distLengths: blockDistLengths});
    }

    return result;
  }

  // ===== BLOCK EMISSION (uncompressed/static/dynamic selection by exact bit cost,
  // matching DeflateCompressor.EmitOptimalBlocks) =====

  function estimateStaticSize(tokens) {
    let bits = 3;
    for (const token of tokens) {
      if (token.isLiteral) bits += FIXED_LITERAL_LENGTHS[token.literal];
      else {
        const lengthCode = getLengthCode(token.length);
        bits += FIXED_LITERAL_LENGTHS[lengthCode];
        bits += LENGTH_CODES[lengthCode - 257].extra;
        const distCode = getDistanceCode(token.distance);
        bits += FIXED_DISTANCE_LENGTHS[distCode];
        bits += DISTANCE_CODES[distCode].extra;
      }
    }
    bits += FIXED_LITERAL_LENGTHS[END_OF_BLOCK];
    return bits;
  }

  function estimateDynamicSize(litLenFreqs, distFreqs, tokens) {
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

  function writeTokens(stream, tokens, literalTree, distanceTree) {
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

  function emitStaticHuffmanBlock(stream, tokens, isFinal) {
    const literalTree = HuffmanTree.buildFromLengths(FIXED_LITERAL_LENGTHS);
    const distanceTree = HuffmanTree.buildFromLengths(FIXED_DISTANCE_LENGTHS);

    stream.writeBits(isFinal ? 1 : 0, 1);
    stream.writeBits(1, 2); // BTYPE = 01 (static Huffman)

    writeTokens(stream, tokens, literalTree, distanceTree);

    const {code, length} = literalTree.encode(END_OF_BLOCK);
    stream.writeHuffmanCode(code, length);
  }

  function emitDynamicHuffmanBlock(stream, litLenFreqs, distFreqs, tokens, isFinal) {
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

    writeTokens(stream, tokens, literalTree, distanceTree);

    const {code, length} = literalTree.encode(END_OF_BLOCK);
    stream.writeHuffmanCode(code, length);
  }

  // ===== ZOPFLI COMPRESSION ALGORITHM =====

  class ZopfliCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Zopfli";
      this.description = "Iterative-optimal DEFLATE encoder from Google (2013). Repeatedly re-parses the input using a shortest-path search over the previous iteration's Huffman code lengths, then splits the result into cost-minimizing blocks. Output is standard RFC 1951 DEFLATE, decodable by any conforming reader.";
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

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
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
        const {symbols} = blocks[i];
        const isLastBlock = i === blocks.length - 1;

        const tokens = symbols.map(sym => sym.isLiteral ?
          {isLiteral: true, literal: sym.literal} :
          {isLiteral: false, distance: sym.distance, length: sym.length});

        const litLenFreqs = new Array(LIT_LEN_ALPHABET_SIZE).fill(0);
        const distFreqs = new Array(DIST_ALPHABET_SIZE).fill(0);
        for (const sym of symbols) {
          if (sym.isLiteral) ++litLenFreqs[sym.literal];
          else {
            ++litLenFreqs[getLengthCode(sym.length)];
            ++distFreqs[getDistanceCode(sym.distance)];
          }
        }
        litLenFreqs[END_OF_BLOCK] = 1;

        const staticSize = estimateStaticSize(tokens);
        const dynamicSize = estimateDynamicSize(litLenFreqs.slice(), distFreqs.slice(), tokens);

        if (staticSize <= dynamicSize) emitStaticHuffmanBlock(stream, tokens, isLastBlock);
        else emitDynamicHuffmanBlock(stream, litLenFreqs, distFreqs, tokens, isLastBlock);
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
