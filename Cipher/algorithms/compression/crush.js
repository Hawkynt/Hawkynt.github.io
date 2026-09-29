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

  /** @type {int32} */
  const MIN_MATCH = 3;
  /** @type {int32} */
  const MAX_WINDOW = 65536;
  /** @type {int32} */
  const OFFSET_BITS = 16;
  /** @type {int32} */
  const HASH_BITS = 16;
  /** @type {int32} */
  const HASH_SIZE = OpCodes.Shl32(1, HASH_BITS);
  /** @type {int32} */
  const MAX_CHAIN_STEPS = 128;
  /** @type {uint32} */
  const KNUTH_MULTIPLIER = 2654435761;

  // ===== BIT STREAM UTILITIES =====

  /** MSB-first bit writer; a partial final byte is zero padded on flush. */
  class BitWriter {
    /**
     * @param {uint8[]} output - Byte array the completed bytes are appended to
     */
    constructor(output) {
      /** @type {uint8[]} */
      this.output = output;
      /** @type {uint32} */
      this.buffer = 0;
      /** @type {int32} */
      this.bitsInBuffer = 0;
    }

    /**
     * @param {uint32} bit - Bit (only the lowest bit is used)
     */
    writeBit(bit) {
      this.buffer = OpCodes.Or32(this.buffer, OpCodes.Shl32(OpCodes.And32(bit, 1), 7 - this.bitsInBuffer));
      ++this.bitsInBuffer;

      if (this.bitsInBuffer !== 8) {
        return;
      }

      this.output.push(OpCodes.And32(this.buffer, 0xFF));
      this.buffer = 0;
      this.bitsInBuffer = 0;
    }

    /**
     * @param {uint32} value - Value
     * @param {int32} count - Number of low bits written, most significant first
     */
    writeBits(value, count) {
      for (let i = 0; i < count; ++i) {
        this.writeBit(OpCodes.And32(OpCodes.Shr32(value, count - 1 - i), 1));
      }
    }

    /** Append the partial last byte, if any */
    flushBits() {
      if (this.bitsInBuffer <= 0) {
        return;
      }

      this.output.push(OpCodes.And32(this.buffer, 0xFF));
      this.buffer = 0;
      this.bitsInBuffer = 0;
    }
  }

  /** MSB-first bit reader. */
  class BitReader {
    /**
     * @param {uint8[]} data - Bytes to read
     * @param {int32} offset - Index of the first byte
     */
    constructor(data, offset) {
      /** @type {uint8[]} */
      this.data = data;
      /** @type {int32} */
      this.pos = offset;
      /** @type {uint32} */
      this.buffer = 0;
      /** @type {int32} */
      this.bitsInBuffer = 0;
    }

    /**
     * @returns {uint32} Next bit
     */
    readBit() {
      if (this.bitsInBuffer === 0) {
        if (this.pos >= this.data.length) {
          throw new Error('Crush: unexpected end of stream while reading bits');
        }
        this.buffer = this.data[this.pos++];
        this.bitsInBuffer = 8;
      }

      /** @type {uint32} */
      const bit = OpCodes.And32(OpCodes.Shr32(this.buffer, 7), 1);
      this.buffer = OpCodes.And32(OpCodes.Shl32(this.buffer, 1), 0xFF);
      --this.bitsInBuffer;
      return bit;
    }

    /**
     * @param {int32} count - Number of bits
     * @returns {uint32} Their value, first bit most significant
     */
    readBits(count) {
      /** @type {uint32} */
      let result = 0;
      for (let i = 0; i < count; ++i) {
        result = OpCodes.Or32(OpCodes.Shl32(result, 1), this.readBit());
      }
      return result;
    }
  }

  /**
   * Index of the most significant set bit of a positive integer.
   * @param {uint32} value - Value
   * @returns {int32} floor(log2(value)), 0 for 0 and 1
   */
  function highestBitIndex(value) {
    /** @type {int32} */
    let index = 0;
    /** @type {uint32} */
    let v = OpCodes.Shr32(value, 1);
    while (v !== 0) {
      ++index;
      v = OpCodes.Shr32(v, 1);
    }
    return index;
  }

  /**
   * Number of bits an Elias-gamma code for value occupies: 2*floor(log2(v)) + 1.
   * @param {uint32} value - Value >= 1
   * @returns {int32} Code length
   */
  function gammaBits(value) {
    return 2 * highestBitIndex(value) + 1;
  }

  /**
   * @param {BitWriter} writer - Output bits
   * @param {uint32} value - Value >= 1
   */
  function writeGamma(writer, value) {
    /** @type {int32} */
    const bits = highestBitIndex(value);
    for (let i = 0; i < bits; ++i) {
      writer.writeBit(0);
    }
    for (let i = bits; i >= 0; --i) {
      writer.writeBit(OpCodes.And32(OpCodes.Shr32(value, i), 1));
    }
  }

  /**
   * @param {BitReader} reader - Input bits
   * @returns {uint32} Decoded value
   */
  function readGamma(reader) {
    /** @type {int32} */
    let zeros = 0;
    /** @type {uint32} */
    let bit = reader.readBit();
    while (bit === 0) {
      ++zeros;
      bit = reader.readBit();
    }

    /** @type {uint32} */
    let value = 1;
    for (let i = 0; i < zeros; ++i) {
      value = OpCodes.Or32(OpCodes.Shl32(value, 1), reader.readBit());
    }

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

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - True to decompress
     * @returns {CrushInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new CrushInstance(this, isInverse);
    }
  }

  /**
   * Longest match (length, offset) found for every position
   */
  class CrushMatches {
    /**
     * @param {int32[]} length - Match length per position (0 = none)
     * @param {int32[]} offset - Match offset per position
     */
    constructor(length, offset) {
      /** @type {int32[]} */
      this.length = length;
      /** @type {int32[]} */
      this.offset = offset;
    }
  }

  class CrushInstance extends IAlgorithmInstance {
    /**
     * @param {CrushCompression} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - True to decompress
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse; // true = decompress, false = compress
      /** @type {uint8[]} */
      this.inputBuffer = [];
    }

    /**
     * Compress or decompress the collected input
     * @returns {uint8[]} Output bytes
     */
    Result() {
      /** @type {uint8[]} */
      const fresh = [];
      if (this.isInverse) {
        if (this.inputBuffer.length === 0) {
          return fresh;
        }
        /** @type {uint8[]} */
        const decoded = this.decompress(this.inputBuffer);
        this.inputBuffer = fresh;
        return decoded;
      }

      // Even empty input yields the fixed 4-byte size header.
      /** @type {uint8[]} */
      const result = this.compress(this.inputBuffer);
      this.inputBuffer = fresh;
      return result;
    }

    /**
     * @param {uint8[]} data - Input bytes (a missing array counts as empty)
     * @returns {uint8[]} Size header and token bit stream
     */
    compress(data) {
      /** @type {uint8[]} */
      let src = data;
      if (!src) {
        src = [];
      }
      /** @type {int32} */
      const n = src.length;
      /** @type {uint8[]} */
      const output = OpCodes.Unpack32LE(n);

      if (n === 0) {
        return output;
      }

      /** @type {CrushMatches} */
      const matches = this._findAllMatches(src);
      /** @type {int32[]} */
      const choiceLen = this._optimalParse(matches.length, n);

      /** @type {BitWriter} */
      const writer = new BitWriter(output);
      /** @type {int32} */
      let i = 0;
      while (i < n) {
        /** @type {int32} */
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

    /**
     * @param {uint8[]} data - Size header and token bit stream
     * @returns {uint8[]} Decoded bytes
     */
    decompress(data) {
      /** @type {uint8[]} */
      let bytes = data;
      if (!bytes) {
        bytes = [];
      }
      if (bytes.length < 4) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      /** @type {uint32} */
      const originalSize = OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
      if (originalSize === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      /** @type {BitReader} */
      const reader = new BitReader(bytes, 4);
      /** @type {uint8[]} */
      const dst = new Array(originalSize);
      /** @type {int32} */
      let pos = 0;

      while (pos < originalSize) {
        /** @type {uint32} */
        const tag = reader.readBit();
        if (tag === 0) {
          /** @type {uint32} */
          const literal = reader.readBits(8);
          dst[pos++] = OpCodes.And32(literal, 0xFF);
        } else {
          /** @type {float64} */
          const lengthCode = readGamma(reader);
          /** @type {float64} */
          const len = lengthCode + MIN_MATCH - 1;
          /** @type {uint32} */
          const offsetCode = reader.readBits(OFFSET_BITS);
          /** @type {int32} */
          const off = offsetCode + 1;

          if (off > pos) {
            throw new Error('Crush: match offset ' + off + ' invalid at position ' + pos);
          }

          for (let k = 0; k < len && pos < originalSize; ++k, ++pos) {
            dst[pos] = dst[pos - off];
          }
        }
      }

      return dst;
    }

    /**
     * Longest match reachable within the window for every position.
     * @param {uint8[]} src - Input bytes
     * @returns {CrushMatches} Match length and offset per position
     */
    _findAllMatches(src) {
      /** @type {int32} */
      const n = src.length;
      /** @type {int32[]} */
      const length = new Int32Array(n);
      /** @type {int32[]} */
      const offset = new Int32Array(n);

      /** @type {int32[]} */
      const hashHead = new Int32Array(HASH_SIZE);
      hashHead.fill(-1);
      /** @type {int32[]} */
      const chain = new Int32Array(n);

      for (let i = 0; i < n; ++i) {
        if (i + MIN_MATCH <= n) {
          /** @type {uint32} */
          const h = this._hash3(src, i);
          /** @type {int32} */
          let candidate = hashHead[h];
          /** @type {int32} */
          const minPos = Math.max(0, i - MAX_WINDOW);
          /** @type {int32} */
          const maxLen = n - i;
          /** @type {int32} */
          let bestLen = 0;
          /** @type {int32} */
          let bestOff = 0;
          /** @type {int32} */
          let steps = MAX_CHAIN_STEPS;

          while (candidate >= minPos && steps-- > 0) {
            if (bestLen === 0 || src[candidate + bestLen] === src[i + bestLen]) {
              /** @type {int32} */
              let len = 0;
              while (len < maxLen && src[candidate + len] === src[i + len]) {
                ++len;
              }

              if (len > bestLen) {
                bestLen = len;
                bestOff = i - candidate;
                if (bestLen >= maxLen) {
                  break;
                }
              }
            }

            /** @type {int32} */
            const prev = chain[candidate];
            if (prev >= candidate) {
              break;
            }
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

      return new CrushMatches(length, offset);
    }

    /**
     * Backward dynamic program over literal-versus-match choices. The candidate
     * lengths at each position are the longest length reachable in each
     * Elias-gamma cost bracket, since all lengths inside a bracket cost the
     * same number of bits.
     * @param {int32[]} matchLen - Longest match length per position
     * @param {int32} n - Input length
     * @returns {int32[]} Chosen match length per position (0 = literal)
     */
    _optimalParse(matchLen, n) {
      /** @type {int32} */
      const literalCost = 1 + 8;
      /** @type {int32[]} */
      const cost = new Int32Array(n + 1);
      /** @type {int32[]} */
      const choiceLen = new Int32Array(n);

      for (let i = n - 1; i >= 0; --i) {
        /** @type {int32} */
        let best = literalCost + cost[i + 1];
        /** @type {int32} */
        let bestLen = 0;

        /** @type {int32} */
        const maxLen = matchLen[i];
        if (maxLen >= MIN_MATCH) {
          /** @type {int32} */
          const maxV = maxLen - MIN_MATCH + 1;
          /** @type {int32} */
          let upper = 1;
          for (;;) {
            /** @type {int32} */
            const v = Math.min(maxV, upper);
            /** @type {int32} */
            const len = v + MIN_MATCH - 1;
            /** @type {int32} */
            const candidateCost = 1 + gammaBits(v) + OFFSET_BITS + cost[i + len];
            if (candidateCost < best) {
              best = candidateCost;
              bestLen = len;
            }
            if (v === maxV) {
              break;
            }
            upper = upper * 2 + 1;
          }
        }

        cost[i] = best;
        choiceLen[i] = bestLen;
      }

      return choiceLen;
    }

    /**
     * Knuth multiplicative hash over the three bytes at pos, folded to 16 bits.
     * @param {uint8[]} data - Bytes
     * @param {int32} pos - Position of the three bytes
     * @returns {uint32} Bucket
     */
    _hash3(data, pos) {
      /** @type {int32} */
      const b0 = data[pos];
      /** @type {int32} */
      const b1 = data[pos + 1];
      /** @type {int32} */
      const b2 = data[pos + 2];
      /** @type {int32} */
      const key = b0 * 65536 + b1 * 256 + b2;
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
