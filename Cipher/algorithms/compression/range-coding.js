/*
 * Range Coding Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Range coding - Entropy coding method that assigns codewords to symbols
 * based on their probability distributions. This is a static (two-pass),
 * byte-oriented, carryless range coder: symbol frequencies are counted over
 * the whole message and scaled to a fixed total (2^14), transmitted in a
 * header, then used unchanged for encoding/decoding (Subbotin-style
 * carryless renormalization).
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

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * RangeCodingAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class RangeCodingAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Range Coding";
        this.description = "Entropy coding method that assigns codewords to symbols based on their probability distributions. More general and efficient than arithmetic coding.";
        this.inventor = "G. Nigel N. Martin";
        this.year = 1979;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Entropy Coding";
        this.securityStatus = null;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.GB; // Great Britain

        // Documentation and references
        this.documentation = [
          new LinkItem("Range Encoding - Wikipedia", "https://en.wikipedia.org/wiki/Range_encoding"),
          new LinkItem("Arithmetic Coding Explained", "https://marknelson.us/posts/2014/10/19/data-compression-with-arithmetic-coding.html")
        ];

        this.references = [
          new LinkItem("Original Range Coding Paper", "https://www.drdobbs.com/database/arithmetic-coding-data-compression/184402828"),
          new LinkItem("Compression Research Papers", "https://compression.ca/"),
          new LinkItem("Data Compression Explained", "https://web.stanford.edu/class/ee398a/handouts/papers/WittenACM87ArithmCoding.pdf")
        ];

        // Test vectors - round-trip compression tests only (no specific compressed outputs)
        this.tests = [
          new TestCase([], [], "Empty data round-trip test", "Educational test vector"),
          new TestCase(OpCodes.AnsiToBytes("A"), [], "Single character round-trip test", "Educational test vector"),
          new TestCase(OpCodes.AnsiToBytes("AA"), [], "Repeated characters round-trip test", "Educational test vector"),
          new TestCase(OpCodes.AnsiToBytes("AB"), [], "Two different characters round-trip test", "Educational test vector"),
          new TestCase(OpCodes.AnsiToBytes("ABC"), [], "Three different characters round-trip test", "Educational test vector"),
          new TestCase(OpCodes.AnsiToBytes("Hello"), [], "Hello string round-trip test", "Educational test vector"),
          new TestCase(Array.from({ length: 256 }, (_, i) => i), [], "All 256 byte values round-trip test", "Regression test for decoder/model desync")
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      /**
       * Create a new instance
       * @param {boolean} [isInverse=false] - True to decompress
       * @returns {RangeCodingInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new RangeCodingInstance(this, isInverse);
      }
    }

    // Byte-oriented carryless range coder constants.
    /** @type {int32} */
    const NUM_SYMBOLS = 256;
    /** @type {int32} */
    const TOP = 0x1000000;     // 1 << 24
    /** @type {int32} */
    const BOTTOM = 0x10000;    // 1 << 16
    /** @type {int32} */
    const FREQ_TOTAL = 0x4000; // 1 << 14

    // The coder keeps low and range below 2^32, but the decoder reads its
    // frequency table from the stream: a corrupt table makes the cumulative
    // frequencies, and so range * cumFreq, exceed 2^32 (even 2^53, where the
    // product rounds). Those products were always float64 arithmetic reduced
    // by ToUint32, and still are, so corrupt streams decode as before.

    /**
     * Scales raw (exact) symbol frequencies to sum to exactly targetTotal,
     * giving every symbol that occurs at least one slot, then nudging the
     * largest/least-accurate entries up or down until the sum matches.
     * @param {int32[]} rawFreq - Symbol counts
     * @param {int32} targetTotal - Required sum
     * @returns {int32[]} Scaled frequencies
     */
    function scaleFrequencies(rawFreq, targetTotal) {
      /** @type {int32[]} */
      const freq = new Array(NUM_SYMBOLS);
      /** @type {int32} */
      let rawTotal = 0;
      for (let i = 0; i < NUM_SYMBOLS; i++) {
        freq[i] = 0;
        rawTotal += rawFreq[i];
      }

      /** @type {int32} */
      let total = 0;
      for (let i = 0; i < NUM_SYMBOLS; i++) {
        freq[i] = Math.max(1, Math.floor(rawFreq[i] * targetTotal / rawTotal));
        total += freq[i];
      }

      while (total > targetTotal) {
        /** @type {int32} */
        let maxIdx = 0;
        for (let i = 1; i < NUM_SYMBOLS; i++) {
          if (freq[i] > freq[maxIdx]) {
            maxIdx = i;
          }
        }
        if (freq[maxIdx] <= 1) {
          break;
        }
        freq[maxIdx]--;
        total--;
      }

      while (total < targetTotal) {
        /** @type {int32} */
        let bestIdx = 0;
        /** @type {float64} */
        let bestRatio = Number.MAX_VALUE;
        for (let i = 0; i < NUM_SYMBOLS; i++) {
          if (rawFreq[i] > 0) {
            /** @type {float64} */
            const ratio = freq[i] / rawFreq[i];
            if (ratio < bestRatio) {
              bestRatio = ratio;
              bestIdx = i;
            }
          }
        }
        freq[bestIdx]++;
        total++;
      }

      return freq;
    }

    /**
     * @param {int32[]} freq - Symbol frequencies (summing to FREQ_TOTAL)
     * @returns {int32[]} cumFreq[i] = sum of freq[0..i-1], for i = 0..256
     */
    function buildCumulativeFrequencies(freq) {
      /** @type {int32[]} */
      const cumFreq = new Array(NUM_SYMBOLS + 1);
      cumFreq[0] = 0;
      for (let i = 0; i < NUM_SYMBOLS; i++) {
        cumFreq[i + 1] = cumFreq[i] + freq[i];
      }
      return cumFreq;
    }

    // Carryless (Subbotin-style) range coder normalization test/shift, shared
    // in shape by encoder and decoder: while the top byte of [low, low+range)
    // isn't settled, force the range small enough near a low boundary, then
    // shift a byte out (encoder) or in (decoder).
    /**
     * @param {uint32} low - Low end of the interval
     * @param {float64} range - Interval width
     * @returns {boolean} True while the top byte is not settled
     */
    function needsRenormalize(low, range) {
      /** @type {uint32} */
      const sum = OpCodes.ToUint32(low + range);
      return OpCodes.Xor32(low, sum) >= TOP;
    }

    class RangeCodingInstance extends IAlgorithmInstance {
      /**
       * @param {RangeCodingAlgorithm} algorithm - Parent algorithm
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
        let result;
        if (this.isInverse) {
          result = this.decompress(this.inputBuffer);
        } else {
          result = this.compress(this.inputBuffer);
        }

        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        return result;
      }

      /**
       * @param {uint8[]} data - Input bytes (a missing array counts as empty)
       * @returns {uint8[]} Size, frequency table and range-coded bytes
       */
      compress(data) {
        /** @type {uint8[]} */
        let input = data;
        if (!input) {
          input = [];
        }
        /** @type {uint8[]} */
        const output = OpCodes.Unpack32LE(OpCodes.ToUint32(input.length));

        if (input.length === 0) {
          return output;
        }

        /** @type {int32[]} */
        const rawFreq = new Array(NUM_SYMBOLS);
        for (let i = 0; i < NUM_SYMBOLS; i++) {
          rawFreq[i] = 0;
        }
        for (let i = 0; i < input.length; i++) {
          rawFreq[input[i]]++;
        }

        /** @type {int32[]} */
        const freq = scaleFrequencies(rawFreq, FREQ_TOTAL);
        /** @type {int32[]} */
        const cumFreq = buildCumulativeFrequencies(freq);

        // Frequency table: 256 x 4-byte LE.
        for (let i = 0; i < NUM_SYMBOLS; i++) {
          /** @type {uint8[]} */
          const fb = OpCodes.Unpack32LE(freq[i]);
          output.push(fb[0]);
          output.push(fb[1]);
          output.push(fb[2]);
          output.push(fb[3]);
        }

        // Carryless range coder encoder.
        /** @type {uint8[]} */
        const bytes = [];
        /** @type {uint32} */
        let low = 0;
        /** @type {float64} */
        let range = 0xFFFFFFFF;

        for (let i = 0; i < input.length; i++) {
          /** @type {uint8} */
          const sym = input[i];
          range = Math.floor(range / FREQ_TOTAL);
          low = OpCodes.ToUint32(low + range * cumFreq[sym]);
          range = OpCodes.ToUint32(range * freq[sym]);

          while (true) {
            if (needsRenormalize(low, range)) {
              if (range >= BOTTOM) {
                break;
              }
              range = OpCodes.And32(OpCodes.ToUint32(-low), BOTTOM - 1);
            }
            bytes.push(OpCodes.GetByte(low, 3));
            low = OpCodes.ToUint32(OpCodes.Shl32(low, 8));
            range = OpCodes.ToUint32(OpCodes.Shl32(range, 8));
          }
        }

        // Flush 4 bytes.
        for (let i = 0; i < 4; i++) {
          bytes.push(OpCodes.GetByte(low, 3));
          low = OpCodes.ToUint32(OpCodes.Shl32(low, 8));
        }

        for (let i = 0; i < bytes.length; i++) {
          output.push(bytes[i]);
        }
        return output;
      }

      /**
       * @param {uint8[]} data - Size, frequency table and range-coded bytes
       * @returns {uint8[]} Decoded bytes
       */
      decompress(data) {
        /** @type {uint8[]} */
        let input = data;
        if (!input) {
          input = [];
        }
        if (input.length === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }

        // The header is a 4-byte original size, and for a non-empty stream one
        // 4-byte frequency per symbol after it. Reading either without checking
        // the length first took bytes that were not there: Pack32LE of undefined
        // yielded a huge count, and the decode loop then ran that many times, so
        // a three-byte input cost unbounded time instead of being rejected.
        if (input.length < 4) {
          throw new Error('Range Coding: stream is ' + input.length
            + ' bytes, shorter than the 4-byte size header');
        }

        /** @type {int32} */
        let offset = 0;

        /** @type {uint32} */
        const originalSize = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
        offset += 4;

        // Empty input is encoded as the size alone, with no frequency table.
        if (originalSize === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }

        /** @type {int32} */
        const HEADER_BYTES = 4 + NUM_SYMBOLS * 4;
        if (input.length < HEADER_BYTES) {
          throw new Error('Range Coding: stream declares ' + originalSize
            + ' bytes but is ' + input.length + ' long, shorter than the '
            + HEADER_BYTES + '-byte header');
        }

        /** @type {float64[]} */
        const freq = new Array(NUM_SYMBOLS);
        for (let i = 0; i < NUM_SYMBOLS; i++) {
          freq[i] = OpCodes.Pack32LE(input[offset], input[offset + 1], input[offset + 2], input[offset + 3]);
          offset += 4;
        }

        // Cumulative frequencies of the stream's table, as in
        // buildCumulativeFrequencies but in float64: the table is untrusted
        /** @type {float64[]} */
        const cumFreq = new Array(NUM_SYMBOLS + 1);
        cumFreq[0] = 0;
        for (let i = 0; i < NUM_SYMBOLS; i++) {
          cumFreq[i + 1] = cumFreq[i] + freq[i];
        }

        /** @type {uint8[]} */
        const src = input.slice(offset);
        /** @type {int32} */
        let srcPos = 0;

        /** @type {uint32} */
        let code = 0;
        for (let i = 0; i < 4; i++) {
          /** @type {uint8} */
          const nextByte = srcPos < src.length ? src[srcPos++] : 0;
          code = OpCodes.Or32(OpCodes.Shl32(code, 8), nextByte);
        }

        /** @type {uint8[]} */
        const result = new Array(originalSize);
        /** @type {uint32} */
        let low = 0;
        /** @type {float64} */
        let range = 0xFFFFFFFF;

        for (let i = 0; i < originalSize; i++) {
          range = Math.floor(range / FREQ_TOTAL);
          /** @type {float64} */
          let target = Math.floor(OpCodes.ToUint32(code - low) / range);
          if (target >= FREQ_TOTAL) {
            target = FREQ_TOTAL - 1;
          }

          // Binary search for symbol.
          /** @type {int32} */
          let lo = 0;
          /** @type {int32} */
          let hi = NUM_SYMBOLS - 1;
          while (lo < hi) {
            /** @type {int32} */
            const mid = Math.floor((lo + hi) / 2);
            if (cumFreq[mid + 1] <= target) {
              lo = mid + 1;
            } else {
              hi = mid;
            }
          }

          result[i] = lo;

          low = OpCodes.ToUint32(low + range * cumFreq[lo]);
          range = OpCodes.ToUint32(range * freq[lo]);

          while (true) {
            if (needsRenormalize(low, range)) {
              if (range >= BOTTOM) {
                break;
              }
              range = OpCodes.And32(OpCodes.ToUint32(-low), BOTTOM - 1);
            }
            /** @type {uint8} */
            const nextByte = srcPos < src.length ? src[srcPos++] : 0;
            code = OpCodes.Or32(OpCodes.Shl32(code, 8), nextByte);
            low = OpCodes.ToUint32(OpCodes.Shl32(low, 8));
            range = OpCodes.ToUint32(OpCodes.Shl32(range, 8));
          }
        }

        return result;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new RangeCodingAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RangeCodingAlgorithm, RangeCodingInstance };
}));