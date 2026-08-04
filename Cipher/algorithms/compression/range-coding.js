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

      CreateInstance(isInverse = false) {
        return new RangeCodingInstance(this, isInverse);
      }
    }

    // Byte-oriented carryless range coder constants.
    const NUM_SYMBOLS = 256;
    const TOP = 0x1000000;     // 1 << 24
    const BOTTOM = 0x10000;    // 1 << 16
    const FREQ_TOTAL = 0x4000; // 1 << 14

    // Scales raw (exact) symbol frequencies to sum to exactly targetTotal,
    // giving every symbol that occurs at least one slot, then nudging the
    // largest/least-accurate entries up or down until the sum matches.
    function scaleFrequencies(rawFreq, targetTotal) {
      const freq = new Array(NUM_SYMBOLS).fill(0);
      let rawTotal = 0;
      for (let i = 0; i < NUM_SYMBOLS; i++) rawTotal += rawFreq[i];

      let total = 0;
      for (let i = 0; i < NUM_SYMBOLS; i++) {
        freq[i] = Math.max(1, Math.floor(rawFreq[i] * targetTotal / rawTotal));
        total += freq[i];
      }

      while (total > targetTotal) {
        let maxIdx = 0;
        for (let i = 1; i < NUM_SYMBOLS; i++) if (freq[i] > freq[maxIdx]) maxIdx = i;
        if (freq[maxIdx] <= 1) break;
        freq[maxIdx]--;
        total--;
      }

      while (total < targetTotal) {
        let bestIdx = 0;
        let bestRatio = Number.MAX_VALUE;
        for (let i = 0; i < NUM_SYMBOLS; i++) {
          if (rawFreq[i] > 0) {
            const ratio = freq[i] / rawFreq[i];
            if (ratio < bestRatio) { bestRatio = ratio; bestIdx = i; }
          }
        }
        freq[bestIdx]++;
        total++;
      }

      return freq;
    }

    function buildCumulativeFrequencies(freq) {
      const cumFreq = new Array(NUM_SYMBOLS + 1).fill(0);
      for (let i = 0; i < NUM_SYMBOLS; i++) cumFreq[i + 1] = cumFreq[i] + freq[i];
      return cumFreq;
    }

    // Carryless (Subbotin-style) range coder normalization test/shift, shared
    // in shape by encoder and decoder: while the top byte of [low, low+range)
    // isn't settled, force the range small enough near a low boundary, then
    // shift a byte out (encoder) or in (decoder).
    function needsRenormalize(low, range) {
      const sum = OpCodes.ToUint32(low + range);
      return OpCodes.ToUint32(OpCodes.XorN(low, sum)) >= TOP;
    }

    class RangeCodingInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse; // true = decompress, false = compress
        this.inputBuffer = [];
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
      }

      Result() {
        const result = this.isInverse ?
          this.decompress(this.inputBuffer) :
          this.compress(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      }

      compress(data) {
        data = data || [];
        const output = OpCodes.Unpack32LE(OpCodes.ToUint32(data.length));

        if (data.length === 0) return output;

        const rawFreq = new Array(NUM_SYMBOLS).fill(0);
        for (let i = 0; i < data.length; i++) rawFreq[data[i]]++;

        const freq = scaleFrequencies(rawFreq, FREQ_TOTAL);
        const cumFreq = buildCumulativeFrequencies(freq);

        // Frequency table: 256 x 4-byte LE.
        for (let i = 0; i < NUM_SYMBOLS; i++) {
          const fb = OpCodes.Unpack32LE(freq[i]);
          output.push(fb[0], fb[1], fb[2], fb[3]);
        }

        // Carryless range coder encoder.
        const bytes = [];
        let low = 0;
        let range = 0xFFFFFFFF;

        for (let i = 0; i < data.length; i++) {
          const sym = data[i];
          range = Math.floor(range / FREQ_TOTAL);
          low = OpCodes.ToUint32(low + range * cumFreq[sym]);
          range = OpCodes.ToUint32(range * freq[sym]);

          while (true) {
            if (needsRenormalize(low, range)) {
              if (range >= BOTTOM) break;
              range = OpCodes.AndN(OpCodes.ToUint32(-low), BOTTOM - 1);
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

        for (let i = 0; i < bytes.length; i++) output.push(bytes[i]);
        return output;
      }

      decompress(data) {
        data = data || [];
        let offset = 0;

        const originalSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
        offset += 4;

        if (originalSize === 0) return [];

        const freq = new Array(NUM_SYMBOLS);
        for (let i = 0; i < NUM_SYMBOLS; i++) {
          freq[i] = OpCodes.Pack32LE(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
          offset += 4;
        }

        const cumFreq = buildCumulativeFrequencies(freq);

        const src = data.slice(offset);
        let srcPos = 0;
        const nextByte = () => srcPos < src.length ? src[srcPos++] : 0;

        let code = 0;
        for (let i = 0; i < 4; i++) code = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(code, 8), nextByte()));

        const result = new Array(originalSize);
        let low = 0;
        let range = 0xFFFFFFFF;

        for (let i = 0; i < originalSize; i++) {
          range = Math.floor(range / FREQ_TOTAL);
          let target = Math.floor(OpCodes.ToUint32(code - low) / range);
          if (target >= FREQ_TOTAL) target = FREQ_TOTAL - 1;

          // Binary search for symbol.
          let lo = 0, hi = NUM_SYMBOLS - 1;
          while (lo < hi) {
            const mid = Math.floor((lo + hi) / 2);
            if (cumFreq[mid + 1] <= target) lo = mid + 1;
            else hi = mid;
          }

          result[i] = lo;

          low = OpCodes.ToUint32(low + range * cumFreq[lo]);
          range = OpCodes.ToUint32(range * freq[lo]);

          while (true) {
            if (needsRenormalize(low, range)) {
              if (range >= BOTTOM) break;
              range = OpCodes.AndN(OpCodes.ToUint32(-low), BOTTOM - 1);
            }
            code = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(code, 8), nextByte()));
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