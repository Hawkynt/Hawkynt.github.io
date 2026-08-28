/*
 * BALZ Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * BALZ (Ilya Muravyov) is a ROLZ - reduced-offset Lempel-Ziv - compressor:
 * match candidates are looked up in a small per-context table instead of the
 * full sliding window, so an offset never has to be transmitted (only the slot
 * index), and every symbol is entropy coded with a binary adaptive arithmetic
 * coder.
 *
 * Written from the published format description, not derived from Muravyov's
 * reference balz.cpp; the uncompressed length travels in a 4-byte little-endian
 * header rather than in BALZ's own container.
 *
 * References:
 *   BALZ v1.00 release thread - https://encode.su/threads/1038-balz-v1-00-new-LZ77-encoder-is-here!
 *   ROLZ                      - https://en.wikipedia.org/wiki/LZ77_and_LZ78
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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== FORMAT CONSTANTS =====

  const CONTEXT_COUNT = 256;   // one match table per preceding byte value
  const TABLE_SIZE = 64;       // entries per context, a power of two
  const TABLE_MASK = TABLE_SIZE - 1;
  const TABLE_INDEX_BITS = 6;  // log2(TABLE_SIZE)
  const MIN_MATCH = 3;
  const MAX_MATCH = MIN_MATCH + 255;

  const PROB_BITS = 12;
  const PROB_MAX = OpCodes.Shl32(1, PROB_BITS);
  const PROB_INIT = PROB_MAX / 2;
  const ADAPT_SHIFT = 5;

  const NORMALIZE_LIMIT = OpCodes.Shl32(1, 24);

  // ===== BINARY ARITHMETIC CODER =====

  /**
   * 32-bit binary arithmetic encoder with 12-bit adaptive probabilities. A
   * probability tracks the likelihood of a 0-bit; a 0-bit narrows the interval
   * to its upper part, a 1-bit to its lower part, and every observed bit nudges
   * the estimate by 1/32 of the remaining distance to its extreme.
   */
  class ArithmeticEncoder {
    constructor(output) {
      this.output = output;
      this.low = 0;
      this.high = 0xFFFFFFFF;
    }

    encodeBit(bit, probs, index) {
      const range = OpCodes.ToUint32(this.high - this.low + 1);
      let mid = OpCodes.ToUint32(this.low + Math.floor(range * probs[index] / PROB_MAX) - 1);
      if (mid >= this.high)
        mid = OpCodes.ToUint32(this.high - 1);

      if (bit === 0) {
        this.high = mid;
        probs[index] += OpCodes.Shr32(PROB_MAX - probs[index], ADAPT_SHIFT);
      } else {
        this.low = OpCodes.ToUint32(mid + 1);
        probs[index] -= OpCodes.Shr32(probs[index], ADAPT_SHIFT);
      }

      while (OpCodes.Xor32(this.low, this.high) < NORMALIZE_LIMIT) {
        this.output.push(OpCodes.Shr32(this.high, 24)&0xFF);
        this.low = OpCodes.Shl32(this.low, 8);
        this.high = OpCodes.Or32(OpCodes.Shl32(this.high, 8), 0xFF);
      }
    }

    encodeBits(value, bitCount, probs) {
      for (let b = bitCount - 1; b >= 0; --b)
        this.encodeBit(OpCodes.And32(OpCodes.Shr32(value, b), 1), probs, bitCount - 1 - b);
    }

    flush() {
      for (let i = 0; i < 4; ++i) {
        this.output.push(OpCodes.Shr32(this.high, 24)&0xFF);
        this.high = OpCodes.Shl32(this.high, 8);
      }
    }
  }

  /** Decoder counterpart of ArithmeticEncoder. */
  class ArithmeticDecoder {
    constructor(input, offset) {
      this.input = input;
      this.pos = offset;
      this.low = 0;
      this.high = 0xFFFFFFFF;
      this.code = 0;

      // The priming bytes pad with zero past the end of the stream, whereas
      // the renormalization refill pads with 0xFF.
      for (let i = 0; i < 4; ++i) {
        const next = this.pos < this.input.length ? this.input[this.pos++] : 0;
        this.code = OpCodes.Or32(OpCodes.Shl32(this.code, 8), next);
      }
    }

    decodeBit(probs, index) {
      const range = OpCodes.ToUint32(this.high - this.low + 1);
      let mid = OpCodes.ToUint32(this.low + Math.floor(range * probs[index] / PROB_MAX) - 1);
      if (mid >= this.high)
        mid = OpCodes.ToUint32(this.high - 1);

      let bit;
      if (this.code <= mid) {
        bit = 0;
        this.high = mid;
        probs[index] += OpCodes.Shr32(PROB_MAX - probs[index], ADAPT_SHIFT);
      } else {
        bit = 1;
        this.low = OpCodes.ToUint32(mid + 1);
        probs[index] -= OpCodes.Shr32(probs[index], ADAPT_SHIFT);
      }

      while (OpCodes.Xor32(this.low, this.high) < NORMALIZE_LIMIT) {
        const next = this.pos < this.input.length ? this.input[this.pos++] : 0xFF;
        this.code = OpCodes.Or32(OpCodes.Shl32(this.code, 8), next);
        this.low = OpCodes.Shl32(this.low, 8);
        this.high = OpCodes.Or32(OpCodes.Shl32(this.high, 8), 0xFF);
      }

      return bit;
    }

    decodeBits(bitCount, probs) {
      let value = 0;
      for (let b = bitCount - 1; b >= 0; --b)
        value = OpCodes.Or32(OpCodes.Shl32(value, 1), this.decodeBit(probs, bitCount - 1 - b));
      return value;
    }
  }

  /** Adaptive bit probabilities, one positional array per symbol kind. */
  class ProbabilityModel {
    constructor() {
      this.isMatch = ProbabilityModel._create(1);
      this.slotBits = ProbabilityModel._create(TABLE_INDEX_BITS);
      this.lengthBits = ProbabilityModel._create(8);
      this.literalBits = ProbabilityModel._create(8);
    }

    static _create(count) {
      const probs = new Array(count);
      for (let i = 0; i < count; ++i) probs[i] = PROB_INIT;
      return probs;
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class BALZCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BALZ";
      this.description = "ROLZ (reduced-offset Lempel-Ziv) compressor by Ilya Muravyov: matches are drawn from a 64-entry table selected by the previous byte, so only a slot index is transmitted, and every bit is coded by a 12-bit adaptive binary arithmetic coder.";
      this.inventor = "Ilya Muravyov";
      this.year = 2008;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based (ROLZ)";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU; // Russia

      // Documentation and references
      this.documentation = [
        new LinkItem("BALZ v1.00 Release Thread", "https://encode.su/threads/1038-balz-v1-00-new-LZ77-encoder-is-here!"),
        new LinkItem("BALZ SourceForge Project", "https://sourceforge.net/projects/balz/"),
        new LinkItem("ROLZ Wikipedia", "https://en.wikipedia.org/wiki/LZ77_and_LZ78")
      ];

      this.references = [
        new LinkItem("Ilya Muravyov GitHub", "https://github.com/encode84"),
        new LinkItem("Arithmetic coding", "https://en.wikipedia.org/wiki/Arithmetic_coding"),
        new LinkItem("Matt Mahoney's Compression Benchmark", "https://mattmahoney.net/dc/text.html")
      ];

      // Wire format (byte-identical to CompressionWorkbench's BB_Balz):
      //   4 bytes uncompressed size (little-endian); if 0, no payload follows.
      //   Otherwise an arithmetic-coded bit stream, one token per position:
      //     bit 1, 6-bit slot index, 8-bit (length - 3)  -- match
      //     bit 0, 8-bit literal byte                    -- literal
      //   Multi-bit fields are coded most significant bit first, each bit
      //   position carrying its own adaptive probability. The coder is flushed
      //   with the four bytes of the interval's upper bound.
      this.tests = [
        {
          input: [],
          expected: [0, 0, 0, 0],
          text: "Empty input - header only",
          uri: "https://encode.su/threads/1038-balz-v1-00-new-LZ77-encoder-is-here!"
        },
        {
          input: OpCodes.AnsiToBytes("A"),
          expected: [1, 0, 0, 0, 65, 255, 255, 254],
          text: "Single byte literal",
          uri: "https://encode.su/threads/1038-balz-v1-00-new-LZ77-encoder-is-here!"
        },
        {
          input: OpCodes.AnsiToBytes("AAAAAAAAAA"),
          expected: [10, 0, 0, 0, 65, 33, 240, 0, 134, 120],
          text: "Run of one byte - literal then a single ROLZ match",
          uri: "https://encode.su/threads/1038-balz-v1-00-new-LZ77-encoder-is-here!"
        },
        {
          input: OpCodes.AnsiToBytes("ABAB"),
          expected: [4, 0, 0, 0, 65, 34, 83, 103, 63, 180, 110],
          text: "Alternating pattern",
          uri: "https://encode.su/threads/1038-balz-v1-00-new-LZ77-encoder-is-here!"
        },
        {
          input: OpCodes.AnsiToBytes("ABCABCABCABC"),
          expected: [12, 0, 0, 0, 65, 34, 84, 72, 248, 249, 121, 79, 63],
          text: "Repeating sequence - reduced-offset advantage",
          uri: "https://encode.su/threads/1038-balz-v1-00-new-LZ77-encoder-is-here!"
        },
        {
          input: OpCodes.AnsiToBytes("Hello World"),
          expected: [11, 0, 0, 0, 72, 53, 235, 215, 87, 122, 183, 104, 202, 152, 40, 61, 59, 134, 242],
          text: "Natural text",
          uri: "https://encode.su/threads/1038-balz-v1-00-new-LZ77-encoder-is-here!"
        }
      ];

      // For test suite compatibility
      this.testVectors = this.tests;
    }

    CreateInstance(isInverse = false) {
      return new BALZInstance(this, isInverse);
    }
  }

  class BALZInstance extends IAlgorithmInstance {
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

      const encoder = new ArithmeticEncoder(output);
      const model = new ProbabilityModel();

      const tables = new Array(CONTEXT_COUNT);
      const heads = new Int32Array(CONTEXT_COUNT);
      for (let c = 0; c < CONTEXT_COUNT; ++c) {
        const table = new Int32Array(TABLE_SIZE);
        table.fill(-1);
        tables[c] = table;
      }

      let ctx = 0;
      let i = 0;
      while (i < n) {
        const table = tables[ctx];
        let bestLen = 0;
        let bestSlot = 0;
        const maxLen = Math.min(MAX_MATCH, n - i);

        for (let slot = 0; slot < TABLE_SIZE; ++slot) {
          const cand = table[slot];
          if (cand < 0)
            continue;

          let len = 0;
          while (len < maxLen && src[cand + len] === src[i + len])
            ++len;

          if (len > bestLen) {
            bestLen = len;
            bestSlot = slot;
            if (bestLen === maxLen)
              break;
          }
        }

        table[heads[ctx]] = i;
        heads[ctx] = OpCodes.And32(heads[ctx] + 1, TABLE_MASK);

        if (bestLen >= MIN_MATCH) {
          encoder.encodeBit(1, model.isMatch, 0);
          encoder.encodeBits(bestSlot, TABLE_INDEX_BITS, model.slotBits);
          encoder.encodeBits(bestLen - MIN_MATCH, 8, model.lengthBits);
          ctx = src[i + bestLen - 1];
          i += bestLen;
        } else {
          encoder.encodeBit(0, model.isMatch, 0);
          encoder.encodeBits(src[i], 8, model.literalBits);
          ctx = src[i];
          ++i;
        }
      }

      encoder.flush();
      return output;
    }

    decompress(data) {
      const bytes = data || [];
      if (bytes.length < 4)
        return [];

      const originalSize = OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
      if (originalSize === 0)
        return [];

      const decoder = new ArithmeticDecoder(bytes, 4);
      const model = new ProbabilityModel();

      const tables = new Array(CONTEXT_COUNT);
      const heads = new Int32Array(CONTEXT_COUNT);
      for (let c = 0; c < CONTEXT_COUNT; ++c) {
        const table = new Int32Array(TABLE_SIZE);
        table.fill(-1);
        tables[c] = table;
      }

      const dst = new Array(originalSize);
      let ctx = 0;
      let pos = 0;

      while (pos < originalSize) {
        const table = tables[ctx];
        const isMatch = decoder.decodeBit(model.isMatch, 0);

        if (isMatch === 1) {
          const slot = decoder.decodeBits(TABLE_INDEX_BITS, model.slotBits);
          const len = decoder.decodeBits(8, model.lengthBits) + MIN_MATCH;
          const srcPos = table[slot];
          if (srcPos < 0)
            throw new Error('BALZ: empty ROLZ slot ' + slot + ' referenced at position ' + pos);

          table[heads[ctx]] = pos;
          heads[ctx] = OpCodes.And32(heads[ctx] + 1, TABLE_MASK);

          let lastByte = 0;
          for (let k = 0; k < len && pos < originalSize; ++k, ++pos)
            lastByte = dst[pos] = dst[srcPos + k];
          ctx = lastByte;
        } else {
          const literal = decoder.decodeBits(8, model.literalBits)&0xFF;
          table[heads[ctx]] = pos;
          heads[ctx] = OpCodes.And32(heads[ctx] + 1, TABLE_MASK);
          dst[pos++] = literal;
          ctx = literal;
        }
      }

      return dst;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new BALZCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BALZCompression, BALZInstance };
}));
