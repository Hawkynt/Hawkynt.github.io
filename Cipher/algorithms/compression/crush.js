/*
 * Crush Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Crush (Ilya Muravyov) is a fast LZ77 coder whose tokens are prefixed by a
 * single MSB-first tag bit: 0 introduces a literal byte, 1 introduces a
 * back-reference carrying an Elias-gamma coded length followed by a fixed
 * 16-bit offset.
 *
 * Because the offset field costs a fixed number of bits, the cost of a match
 * depends only on its length, and that cost is a step function of the
 * Elias-gamma brackets [1,1], [2,3], [4,7], [8,15], ... - every length inside a
 * bracket costs the same. The parser therefore runs a backward dynamic program
 * that considers, at each position, a literal or the longest length reachable in
 * each bracket, and keeps whichever minimizes the total bit cost to the end.
 *
 * Written from the published format description, not derived from a reference
 * implementation; the uncompressed length travels in a 4-byte little-endian
 * header.
 *
 * References:
 *   bcrush (CRUSH format notes) - https://github.com/jibsen/bcrush
 *   Elias gamma coding          - https://en.wikipedia.org/wiki/Elias_gamma_coding
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
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== FORMAT CONSTANTS =====

  const MIN_MATCH = 3;
  const MAX_WINDOW = 65536;
  const OFFSET_BITS = 16;
  const HASH_BITS = 16;
  const HASH_SIZE = OpCodes.Shl32(1, HASH_BITS);
  const MAX_CHAIN_STEPS = 128;
  const KNUTH_MULTIPLIER = 2654435761;

  // ===== BIT STREAM UTILITIES =====

  /** MSB-first bit writer; a partial final byte is zero padded on flush. */
  class BitWriter {
    constructor(output) {
      this.output = output;
      this.buffer = 0;
      this.bitsInBuffer = 0;
    }

    writeBit(bit) {
      this.buffer = OpCodes.Or32(this.buffer, OpCodes.Shl32(OpCodes.And32(bit, 1), 7 - this.bitsInBuffer));
      ++this.bitsInBuffer;

      if (this.bitsInBuffer !== 8)
        return;

      this.output.push(this.buffer&0xFF);
      this.buffer = 0;
      this.bitsInBuffer = 0;
    }

    writeBits(value, count) {
      for (let i = 0; i < count; ++i)
        this.writeBit(OpCodes.And32(OpCodes.Shr32(value, count - 1 - i), 1));
    }

    flushBits() {
      if (this.bitsInBuffer <= 0)
        return;

      this.output.push(this.buffer&0xFF);
      this.buffer = 0;
      this.bitsInBuffer = 0;
    }
  }

  /** MSB-first bit reader. */
  class BitReader {
    constructor(data, offset) {
      this.data = data;
      this.pos = offset;
      this.buffer = 0;
      this.bitsInBuffer = 0;
    }

    readBit() {
      if (this.bitsInBuffer === 0) {
        if (this.pos >= this.data.length)
          throw new Error('Crush: unexpected end of stream while reading bits');
        this.buffer = this.data[this.pos++];
        this.bitsInBuffer = 8;
      }

      const bit = OpCodes.And32(OpCodes.Shr32(this.buffer, 7), 1);
      this.buffer = OpCodes.And32(OpCodes.Shl32(this.buffer, 1), 0xFF);
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

  /** Index of the most significant set bit of a positive integer. */
  function highestBitIndex(value) {
    let index = 0;
    let v = OpCodes.Shr32(value, 1);
    while (v !== 0) {
      ++index;
      v = OpCodes.Shr32(v, 1);
    }
    return index;
  }

  /** Number of bits an Elias-gamma code for value occupies: 2*floor(log2(v)) + 1. */
  function gammaBits(value) {
    return 2 * highestBitIndex(value) + 1;
  }

  function writeGamma(writer, value) {
    const bits = highestBitIndex(value);
    for (let i = 0; i < bits; ++i)
      writer.writeBit(0);
    for (let i = bits; i >= 0; --i)
      writer.writeBit(OpCodes.And32(OpCodes.Shr32(value, i), 1));
  }

  function readGamma(reader) {
    let zeros = 0;
    while (reader.readBit() === 0)
      ++zeros;

    let value = 1;
    for (let i = 0; i < zeros; ++i)
      value = OpCodes.Or32(OpCodes.Shl32(value, 1), reader.readBit());

    return value;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class CrushCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Crush";
      this.description = "Fast LZ77 coder by Ilya Muravyov. Every token carries a single tag bit; matches add an Elias-gamma coded length and a fixed 16-bit offset. The parse is a backward dynamic program over the gamma cost brackets rather than a greedy longest-match choice.";
      this.inventor = "Ilya Muravyov";
      this.year = 2010;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary (LZ77)";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      // Documentation and references
      this.documentation = [
        new LinkItem("bcrush Implementation", "https://github.com/jibsen/bcrush"),
        new LinkItem("LZ77 Algorithm", "https://en.wikipedia.org/wiki/LZ77_and_LZ78"),
        new LinkItem("Elias Gamma Coding", "https://en.wikipedia.org/wiki/Elias_gamma_coding")
      ];

      this.references = [
        new LinkItem("Original Crush Discussion", "https://encode.su/"),
        new LinkItem("Fast Compression Algorithms", "https://fastcompression.blogspot.com/"),
        new LinkItem("Compression Benchmark", "http://mattmahoney.net/dc/text.html")
      ];

      // Wire format (byte-identical to CompressionWorkbench's BB_Crush):
      //   4 bytes uncompressed size (little-endian); if 0, no payload follows.
      //   Otherwise an MSB-first bitstream of tokens:
      //     bit 0, 8-bit literal byte                             -- literal
      //     bit 1, Elias-gamma (length - 2), 16-bit (offset - 1)   -- match
      //   The trailing partial byte is zero padded.
      this.tests = [
        {
          input: [],
          expected: [0, 0, 0, 0],
          text: "Empty input - header only",
          uri: "https://github.com/jibsen/bcrush"
        },
        {
          input: OpCodes.AnsiToBytes("A"),
          expected: [1, 0, 0, 0, 32, 128],
          text: "Single byte literal",
          uri: "https://github.com/jibsen/bcrush"
        },
        {
          input: OpCodes.AnsiToBytes("AAAAAAAAAA"),
          expected: [10, 0, 0, 0, 32, 206, 0, 0],
          text: "Run of one byte - literal then an overlapping match",
          uri: "https://github.com/jibsen/bcrush"
        },
        {
          input: OpCodes.AnsiToBytes("ABAB"),
          expected: [4, 0, 0, 0, 32, 144, 136, 36, 32],
          text: "Alternating pattern",
          uri: "https://github.com/jibsen/bcrush"
        },
        {
          input: OpCodes.AnsiToBytes("ABCABCABCABC"),
          expected: [12, 0, 0, 0, 32, 144, 136, 115, 128, 1, 0],
          text: "Repeating sequence",
          uri: "https://github.com/jibsen/bcrush"
        },
        {
          input: OpCodes.AnsiToBytes("Hello World"),
          expected: [11, 0, 0, 0, 36, 25, 77, 134, 195, 120, 128, 174, 111, 57, 27, 12, 128],
          text: "Natural text without repeats",
          uri: "https://github.com/jibsen/bcrush"
        }
      ];

      // For test suite compatibility
      this.testVectors = this.tests;
    }

    CreateInstance(isInverse = false) {
      return new CrushInstance(this, isInverse);
    }
  }

  class CrushInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse; // true = decompress, false = compress
      this.inputBuffer = [];
    }


    Result() {
      if (this.isInverse) {
        if (this.inputBuffer.length === 0) return [];
        const result = this.decompress(this.inputBuffer);
        this.inputBuffer = [];
        return result;
      }

      // Even empty input yields the fixed 4-byte size header.
      const result = this.compress(this.inputBuffer);
      this.inputBuffer = [];
      return result;
    }

    compress(data) {
      const src = data || [];
      const n = src.length;
      const output = [];

      output.push(n&0xFF);
      output.push(OpCodes.Shr32(n, 8)&0xFF);
      output.push(OpCodes.Shr32(n, 16)&0xFF);
      output.push(OpCodes.Shr32(n, 24)&0xFF);

      if (n === 0)
        return output;

      const matches = this._findAllMatches(src);
      const choiceLen = this._optimalParse(matches.length, n);

      const writer = new BitWriter(output);
      let i = 0;
      while (i < n) {
        const len = choiceLen[i];
        if (len >= MIN_MATCH) {
          writer.writeBit(1);
          writeGamma(writer, len - MIN_MATCH + 1);
          writer.writeBits(matches.offset[i] - 1, OFFSET_BITS);
          i += len;
        } else {
          writer.writeBit(0);
          writer.writeBits(src[i], 8);
          ++i;
        }
      }

      writer.flushBits();
      return output;
    }

    decompress(data) {
      const bytes = data || [];
      if (bytes.length < 4)
        return [];

      const originalSize = OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
      if (originalSize === 0)
        return [];

      const reader = new BitReader(bytes, 4);
      const dst = new Array(originalSize);
      let pos = 0;

      while (pos < originalSize) {
        const tag = reader.readBit();
        if (tag === 0) {
          dst[pos++] = reader.readBits(8)&0xFF;
        } else {
          const len = readGamma(reader) + MIN_MATCH - 1;
          const off = reader.readBits(OFFSET_BITS) + 1;

          if (off > pos)
            throw new Error('Crush: match offset ' + off + ' invalid at position ' + pos);

          for (let k = 0; k < len && pos < originalSize; ++k, ++pos)
            dst[pos] = dst[pos - off];
        }
      }

      return dst;
    }

    /** Longest match reachable within the window for every position. */
    _findAllMatches(src) {
      const n = src.length;
      const length = new Int32Array(n);
      const offset = new Int32Array(n);

      const hashHead = new Int32Array(HASH_SIZE);
      hashHead.fill(-1);
      const chain = new Int32Array(n);

      for (let i = 0; i < n; ++i) {
        if (i + MIN_MATCH <= n) {
          const h = this._hash3(src, i);
          let candidate = hashHead[h];
          const minPos = Math.max(0, i - MAX_WINDOW);
          const maxLen = n - i;
          let bestLen = 0;
          let bestOff = 0;
          let steps = MAX_CHAIN_STEPS;

          while (candidate >= minPos && steps-- > 0) {
            if (bestLen === 0 || src[candidate + bestLen] === src[i + bestLen]) {
              let len = 0;
              while (len < maxLen && src[candidate + len] === src[i + len])
                ++len;

              if (len > bestLen) {
                bestLen = len;
                bestOff = i - candidate;
                if (bestLen >= maxLen)
                  break;
              }
            }

            const prev = chain[candidate];
            if (prev >= candidate)
              break;
            candidate = prev;
          }

          if (bestLen >= MIN_MATCH) {
            length[i] = bestLen;
            offset[i] = bestOff;
          }

          chain[i] = hashHead[h];
          hashHead[h] = i;
        }
      }

      return { length: length, offset: offset };
    }

    /**
     * Backward dynamic program over literal-versus-match choices. The candidate
     * lengths at each position are the longest length reachable in each
     * Elias-gamma cost bracket, since all lengths inside a bracket cost the
     * same number of bits.
     */
    _optimalParse(matchLen, n) {
      const literalCost = 1 + 8;
      const cost = new Int32Array(n + 1);
      const choiceLen = new Int32Array(n);

      for (let i = n - 1; i >= 0; --i) {
        let best = literalCost + cost[i + 1];
        let bestLen = 0;

        const maxLen = matchLen[i];
        if (maxLen >= MIN_MATCH) {
          const maxV = maxLen - MIN_MATCH + 1;
          let upper = 1;
          for (;;) {
            const v = Math.min(maxV, upper);
            const len = v + MIN_MATCH - 1;
            const candidateCost = 1 + gammaBits(v) + OFFSET_BITS + cost[i + len];
            if (candidateCost < best) {
              best = candidateCost;
              bestLen = len;
            }
            if (v === maxV)
              break;
            upper = upper * 2 + 1;
          }
        }

        cost[i] = best;
        choiceLen[i] = bestLen;
      }

      return choiceLen;
    }

    /** Knuth multiplicative hash over the three bytes at pos, folded to 16 bits. */
    _hash3(data, pos) {
      const key = data[pos] * 65536 + data[pos + 1] * 256 + data[pos + 2];
      return OpCodes.Shr32(OpCodes.Mul32(key, KNUTH_MULTIPLIER), 32 - HASH_BITS);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new CrushCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { CrushCompression, CrushInstance };
}));
