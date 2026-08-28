/*
 * LZ77-Optimal (cost-based shortest-path parse) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZ77-Optimal keeps the plain LZ77 token grammar (a flag byte, then either a
 * raw literal byte or a little-endian distance+length pair) but replaces the
 * greedy match walk with a forward cost-based shortest-path parse: every byte
 * position is a node, a literal is an edge of length 1 and a match of length L
 * is an edge of length L, and the parse that minimises the summed token cost is
 * recovered by traceback. Because the serialization is fixed-width (2 bytes per
 * literal, 5 bytes per match), pricing a literal at 16 bits and a match at 40
 * bits makes the shortest path exactly the smallest possible output for this
 * coder. Matches at or above a "nice length" are taken whole to bound the
 * search; below it every sub-length down to the minimum match is priced, so a
 * short cheap match can beat a long expensive one.
 *
 * This is the classic shortest-path formulation of optimal LZ parsing described
 * by Schuegraf & Heaps and used by LZMA and Zopfli; it is a different building
 * block from the greedy LZ77 coder even though both emit the same token stream.
 *
 * References:
 * - J. Ziv and A. Lempel, "A Universal Algorithm for Sequential Data
 *   Compression", IEEE Trans. Inf. Theory 23(3), 1977
 * - LZMA SDK documentation (optimal parsing / price-based match selection)
 * - Zopfli, a shortest-path LZ77 parser for DEFLATE
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

  if (!AlgorithmFramework)
    throw new Error('AlgorithmFramework dependency is required');

  if (!OpCodes)
    throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== PARAMETERS =====

  const WINDOW_SIZE = 32768;      // Maximum back-reference distance
  const MIN_MATCH = 3;            // Shortest encodable match
  const MAX_MATCH = 258;          // Longest encodable match
  const NICE_LENGTH = 128;        // Matches this long are accepted whole
  const MAX_CHAIN_DEPTH = 128;    // Hash-chain nodes visited per search

  const LITERAL_COST = 16.0;      // 2 serialized bytes
  const MATCH_COST = 40.0;        // 5 serialized bytes

  // 15-bit hash table, independent of the sliding-window size.
  const HASH_BITS = 15;
  const HASH_SIZE = OpCodes.Shl32(1, HASH_BITS);
  const HASH_MASK = HASH_SIZE - 1;

  // ===== HASH-CHAIN MATCH FINDER =====

  class HashChainMatchFinder {
    constructor(windowSize, maxChainDepth) {
      this.maxChainDepth = maxChainDepth;
      this.head = new Int32Array(HASH_SIZE).fill(-1);
      this.prev = new Int32Array(windowSize);
      this.prevMask = windowSize - 1;
    }

    _hash(data, position) {
      return OpCodes.AndN(
        OpCodes.XorN(
          OpCodes.XorN(OpCodes.Shl32(data[position], 10), OpCodes.Shl32(data[position + 1], 5)),
          data[position + 2]
        ),
        HASH_MASK
      );
    }

    findMatch(data, position, maxDistance, maxLength, minLength) {
      if (position + 2 >= data.length) return { distance: 0, length: 0 };

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

        // Quick reject: the byte just past the current best must still match.
        if (bestLength === 0 ||
            (bestLength < limit && data[candidate + bestLength] === data[position + bestLength])) {
          let length = 0;
          while (length < limit && data[candidate + length] === data[position + length]) ++length;

          if (length >= minLength && length > bestLength) {
            bestLength = length;
            bestDistance = distance;
            if (bestLength >= maxLength) break;
          }
        }

        candidate = this.prev[OpCodes.AndN(candidate, this.prevMask)];
        if (candidate <= windowStart) break;
        ++chainCount;
      }

      this.prev[OpCodes.AndN(position, this.prevMask)] = this.head[hash];
      this.head[hash] = position;

      return bestLength >= minLength
        ? { distance: bestDistance, length: bestLength }
        : { distance: 0, length: 0 };
    }
  }

  // ===== OPTIMAL (SHORTEST-PATH) PARSER =====

  function optimalParse(data) {
    const n = data.length;
    const tokens = [];
    if (n === 0) return tokens;

    const finder = new HashChainMatchFinder(WINDOW_SIZE, MAX_CHAIN_DEPTH);

    const cost = new Float64Array(n + 1);
    const lengths = new Int32Array(n + 1);
    const distances = new Int32Array(n + 1);
    for (let i = 1; i <= n; ++i) cost[i] = Infinity;
    cost[0] = 0.0;

    for (let i = 0; i < n; ++i) {
      const baseCost = cost[i];
      if (!isFinite(baseCost)) continue;

      // Literal edge i -> i+1.
      const literalCost = baseCost + LITERAL_COST;
      if (literalCost < cost[i + 1]) {
        cost[i + 1] = literalCost;
        lengths[i + 1] = 1;
        distances[i + 1] = 0;
      }

      // Match edges i -> i+len.
      const match = finder.findMatch(data, i, WINDOW_SIZE, MAX_MATCH, MIN_MATCH);
      const bestLen = Math.min(match.length, Math.min(MAX_MATCH, n - i));
      if (match.distance <= 0 || bestLen < MIN_MATCH) continue;

      const matchCost = baseCost + MATCH_COST;

      // Greedy shortcut: a long match dominates, take it whole.
      if (bestLen >= NICE_LENGTH) {
        if (matchCost < cost[i + bestLen]) {
          cost[i + bestLen] = matchCost;
          lengths[i + bestLen] = bestLen;
          distances[i + bestLen] = match.distance;
        }
        continue;
      }

      for (let len = MIN_MATCH; len <= bestLen; ++len) {
        if (matchCost < cost[i + len]) {
          cost[i + len] = matchCost;
          lengths[i + len] = len;
          distances[i + len] = match.distance;
        }
      }
    }

    // Traceback from the end.
    let pos = n;
    while (pos > 0) {
      if (distances[pos] === 0) {
        tokens.push({ isLiteral: true, literal: data[pos - 1], distance: 0, length: 0 });
        pos -= 1;
      } else {
        tokens.push({ isLiteral: false, literal: 0, distance: distances[pos], length: lengths[pos] });
        pos -= lengths[pos];
      }
    }

    tokens.reverse();
    return tokens;
  }

  // ===== TOKEN SERIALIZATION =====

  function serializeTokens(tokens) {
    const out = [];
    for (let i = 0; i < tokens.length; ++i) {
      const token = tokens[i];
      if (token.isLiteral) {
        out.push(0);
        out.push(OpCodes.AndN(token.literal, 0xFF));
      } else {
        out.push(1);
        out.push(OpCodes.AndN(token.distance, 0xFF));
        out.push(OpCodes.AndN(OpCodes.Shr32(token.distance, 8), 0xFF));
        out.push(OpCodes.AndN(token.length, 0xFF));
        out.push(OpCodes.AndN(OpCodes.Shr32(token.length, 8), 0xFF));
      }
    }
    return out;
  }

  function deserializeAndExpand(data) {
    const output = [];
    let pos = 0;

    while (pos < data.length) {
      const flag = data[pos++];
      if (flag === 0) {
        if (pos >= data.length) throw new Error('LZ77-Optimal: truncated literal token');
        output.push(OpCodes.AndN(data[pos++], 0xFF));
        continue;
      }

      if (pos + 3 >= data.length) throw new Error('LZ77-Optimal: truncated match token');
      const distance = OpCodes.OrN(data[pos], OpCodes.Shl32(data[pos + 1], 8));
      const length = OpCodes.OrN(data[pos + 2], OpCodes.Shl32(data[pos + 3], 8));
      pos += 4;

      const start = output.length - distance;
      if (start < 0) throw new Error('LZ77-Optimal: invalid back-reference distance');
      for (let i = 0; i < length; ++i) output.push(output[start + i]);
    }

    return output;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class LZ77OptimalCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "LZ77-Optimal";
      this.description = "LZ77 with cost-based optimal (shortest-path) parsing. Keeps the flat literal/match token stream of plain LZ77 but chooses the parse by a forward dynamic program over byte positions, pricing a literal at its serialized 2 bytes and a match at its serialized 5 bytes, so the emitted stream is the smallest this token grammar can produce. Matches are supplied by a 15-bit hash-chain finder over a 32KB window.";
      this.inventor = "Abraham Lempel, Jacob Ziv";
      this.year = 1977;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.IL;

      this.documentation = [
        new LinkItem("Ziv and Lempel, A Universal Algorithm for Sequential Data Compression (1977)", "https://ieeexplore.ieee.org/document/1055714"),
        new LinkItem("LZ77 and LZ78 - Wikipedia", "https://en.wikipedia.org/wiki/LZ77_and_LZ78"),
        new LinkItem("LZMA SDK - price-based optimal parsing", "https://www.7-zip.org/sdk.html")
      ];

      this.references = [
        new LinkItem("Zopfli - shortest-path LZ77 parser for DEFLATE", "https://github.com/google/zopfli"),
        new LinkItem("RFC 1951 - DEFLATE Compressed Data Format", "https://www.rfc-editor.org/rfc/rfc1951"),
        new LinkItem("Shortest-path optimal parsing overview", "https://en.wikipedia.org/wiki/LZ77_and_LZ78#Optimal_parsing")
      ];

      // Test vectors: flat token stream, [0,literal] or [1,distLo,distHi,lenLo,lenHi].
      // Cross-checked byte-for-byte against CompressionWorkbench's BB_Lz77Optimal.
      this.tests = [
        new TestCase(
          [],
          [],
          "Empty input - zero-byte output",
          "https://en.wikipedia.org/wiki/LZ77_and_LZ78"
        ),
        new TestCase(
          [0x41],
          [0x00, 0x41],
          "Single byte - one literal token",
          "https://en.wikipedia.org/wiki/LZ77_and_LZ78"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. ".repeat(4)),
          [
            0x00, 0x74, 0x00, 0x68, 0x00, 0x65, 0x00, 0x20, 0x00, 0x71, 0x00, 0x75, 0x00, 0x69, 0x00, 0x63,
            0x00, 0x6b, 0x00, 0x20, 0x00, 0x62, 0x00, 0x72, 0x00, 0x6f, 0x00, 0x77, 0x00, 0x6e, 0x00, 0x20,
            0x00, 0x66, 0x00, 0x6f, 0x00, 0x78, 0x00, 0x20, 0x00, 0x6a, 0x00, 0x75, 0x00, 0x6d, 0x00, 0x70,
            0x00, 0x73, 0x00, 0x20, 0x00, 0x6f, 0x00, 0x76, 0x00, 0x65, 0x00, 0x72, 0x00, 0x20, 0x01, 0x1f,
            0x00, 0x04, 0x00, 0x00, 0x6c, 0x00, 0x61, 0x00, 0x7a, 0x00, 0x79, 0x00, 0x20, 0x00, 0x64, 0x00,
            0x6f, 0x00, 0x67, 0x00, 0x2e, 0x00, 0x20, 0x00, 0x74, 0x01, 0x2d, 0x00, 0x86, 0x00
          ],
          "Text sample repeated 4x - literals then a long back-reference",
          "https://en.wikipedia.org/wiki/LZ77_and_LZ78"
        ),
        new TestCase(
          new Array(256).fill(0x61),
          [0x00, 0x61, 0x01, 0x01, 0x00, 0xff, 0x00],
          "Long repetitive run - 256 identical bytes",
          "https://en.wikipedia.org/wiki/LZ77_and_LZ78"
        ),
        new TestCase(
          [0x41, 0x42, 0x41, 0x42, 0x41, 0x42, 0x41, 0x42, 0x41, 0x42, 0x41, 0x42],
          [0x00, 0x41, 0x00, 0x42, 0x01, 0x02, 0x00, 0x0a, 0x00],
          "Alternating two-byte pattern - ABABABABABAB",
          "https://en.wikipedia.org/wiki/LZ77_and_LZ78"
        ),
        new TestCase(
          [
            0x9e, 0x1f, 0xd2, 0x4b, 0x6a, 0x0c, 0xf7, 0x83, 0x21, 0x55, 0xbe, 0x08, 0x3d, 0xc4, 0x71, 0xaa,
            0x9e, 0x1f, 0xd2, 0x4b, 0x6a, 0x0c, 0xf7, 0x83, 0x11, 0x62, 0xef, 0x90, 0x4d, 0x7c, 0x38, 0xa1
          ],
          [
            0x00, 0x9e, 0x00, 0x1f, 0x00, 0xd2, 0x00, 0x4b, 0x00, 0x6a, 0x00, 0x0c, 0x00, 0xf7, 0x00, 0x83,
            0x00, 0x21, 0x00, 0x55, 0x00, 0xbe, 0x00, 0x08, 0x00, 0x3d, 0x00, 0xc4, 0x00, 0x71, 0x00, 0xaa,
            0x01, 0x10, 0x00, 0x08, 0x00, 0x00, 0x11, 0x00, 0x62, 0x00, 0xef, 0x00, 0x90, 0x00, 0x4d, 0x00,
            0x7c, 0x00, 0x38, 0x00, 0xa1
          ],
          "Pseudo-random binary sample with one repeated run",
          "https://en.wikipedia.org/wiki/LZ77_and_LZ78"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("Optimal parsing minimises the total token cost, not the local match length."),
          [
            0x00, 0x4f, 0x00, 0x70, 0x00, 0x74, 0x00, 0x69, 0x00, 0x6d, 0x00, 0x61, 0x00, 0x6c, 0x00, 0x20,
            0x00, 0x70, 0x00, 0x61, 0x00, 0x72, 0x00, 0x73, 0x00, 0x69, 0x00, 0x6e, 0x00, 0x67, 0x00, 0x20,
            0x00, 0x6d, 0x00, 0x69, 0x00, 0x6e, 0x00, 0x69, 0x00, 0x6d, 0x00, 0x69, 0x00, 0x73, 0x00, 0x65,
            0x00, 0x73, 0x00, 0x20, 0x00, 0x74, 0x00, 0x68, 0x00, 0x65, 0x00, 0x20, 0x00, 0x74, 0x00, 0x6f,
            0x00, 0x74, 0x00, 0x61, 0x00, 0x6c, 0x01, 0x06, 0x00, 0x03, 0x00, 0x00, 0x6b, 0x00, 0x65, 0x00,
            0x6e, 0x00, 0x20, 0x00, 0x63, 0x00, 0x6f, 0x00, 0x73, 0x00, 0x74, 0x00, 0x2c, 0x00, 0x20, 0x00,
            0x6e, 0x00, 0x6f, 0x00, 0x74, 0x01, 0x1a, 0x00, 0x05, 0x00, 0x00, 0x6c, 0x00, 0x6f, 0x00, 0x63,
            0x01, 0x1a, 0x00, 0x03, 0x00, 0x00, 0x6d, 0x00, 0x61, 0x00, 0x74, 0x00, 0x63, 0x00, 0x68, 0x00,
            0x20, 0x00, 0x6c, 0x00, 0x65, 0x00, 0x6e, 0x00, 0x67, 0x00, 0x74, 0x00, 0x68, 0x00, 0x2e
          ],
          "English text with short interior repeats",
          "https://en.wikipedia.org/wiki/LZ77_and_LZ78"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new LZ77OptimalInstance(this, isInverse);
    }
  }

  class LZ77OptimalInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }


    Result() {
      const data = this.inputBuffer;
      this.inputBuffer = [];
      if (this.isInverse) return deserializeAndExpand(data);
      return serializeTokens(optimalParse(data));
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZ77OptimalCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name))
    RegisterAlgorithm(algorithmInstance);

  // ===== EXPORTS =====

  return { LZ77OptimalCompression, LZ77OptimalInstance };
}));
