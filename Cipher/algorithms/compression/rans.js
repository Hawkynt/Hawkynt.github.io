/*
 * rANS (Range Asymmetric Numeral Systems) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Order-0 range-variant ANS: symbol frequencies are counted over the whole
 * message, normalized to a fixed total (2^12), transmitted in a header, then
 * used unchanged to encode the message backwards into a single rANS state
 * (classic ryg_rans byte-stream layout: 4-byte state header followed by
 * renormalization bytes, decoded forward from the front of the stream).
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

  // rANS constants (match the CompressionWorkbench reference exactly).
  /** @type {int32} */
  const SCALE_BITS = 12;
  /** @type {int32} */
  const SCALE = 4096;         // 1 << 12: normalized frequency total
  /** @type {int32} */
  const RANS_L = 8388608;     // 1 << 23: renormalization lower bound
  /** @type {int32} */
  const RENORM_SHIFT = 2048;  // RansL >> ScaleBits (8388608 >> 12), kept as its
                               // own constant so the renormalization threshold
                               // is computed the same way as the reference
                               // (f * RENORM_SHIFT * 256) rather than simplified
                               // algebraically.
  /** @type {int32} */
  const RENORM_BYTE = 256;    // 1 << 8

  // Scales raw (exact) symbol frequencies to sum to exactly SCALE, giving
  // every symbol that occurs at least one slot, then nudging the
  // largest/smallest-error entries up or down until the sum matches exactly.
  // This is a mechanical port of RansEncoder.NormalizeFrequencies: iteration
  // order (ascending byte value via the `used` list), tie-breaking (strict
  // > / < comparisons keep the first-found index), and floating-point operand
  // order are all preserved so the result matches bit-for-bit.
  /**
   * @param {int32[]} freq - Symbol counts
   * @param {int32} totalCount - Sum of the counts
   * @returns {int32[]} Frequencies summing to SCALE
   */
  function normalizeFrequencies(freq, totalCount) {
    /** @type {int32[]} */
    const norm = new Int32Array(256);
    /** @type {int32} */
    let assigned = 0;
    /** @type {int32[]} */
    const used = [];

    for (let i = 0; i < 256; i++) {
      if (freq[i] === 0) {
        continue;
      }
      used.push(i);
      /** @type {int32} */
      let nf = Math.floor(freq[i] * SCALE / totalCount);
      if (nf < 1) {
        nf = 1;
      }
      norm[i] = nf;
      assigned += nf;
    }

    while (assigned !== SCALE) {
      if (assigned < SCALE) {
        /** @type {int32} */
        let bestIdx = used[0];
        /** @type {float64} */
        let bestError = -Infinity;
        for (let u = 0; u < used.length; u++) {
          /** @type {int32} */
          const idx = used[u];
          /** @type {float64} */
          const ideal = freq[idx] * SCALE / totalCount;
          /** @type {float64} */
          const error = ideal - norm[idx];
          if (error > bestError) {
            bestError = error;
            bestIdx = idx;
          }
        }
        norm[bestIdx]++;
        assigned++;
      } else {
        /** @type {int32} */
        let bestIdx = used[0];
        /** @type {float64} */
        let bestError = Infinity;
        for (let u = 0; u < used.length; u++) {
          /** @type {int32} */
          const idx = used[u];
          if (norm[idx] <= 1) {
            continue;
          }
          /** @type {float64} */
          const ideal = freq[idx] * SCALE / totalCount;
          /** @type {float64} */
          const error = ideal - norm[idx];
          if (error < bestError) {
            bestError = error;
            bestIdx = idx;
          }
        }
        if (norm[bestIdx] > 1) {
          norm[bestIdx]--;
          assigned--;
        } else {
          break;
        }
      }
    }

    return norm;
  }

  /**
   * @param {int32[]} normFreq - Symbol frequencies
   * @returns {int32[]} cumFreq[i] = sum of normFreq[0..i-1], for i = 0..256
   */
  function buildCumulativeFrequencies(normFreq) {
    /** @type {int32[]} */
    const cumFreq = new Int32Array(257);
    for (let i = 0; i < 256; i++) {
      cumFreq[i + 1] = cumFreq[i] + normFreq[i];
    }
    return cumFreq;
  }

  // Encodes data backwards (last byte first) into a single rANS state,
  // flushing renormalization bytes as the state grows too large, then
  // appends the final 4-byte state (little-endian) and reverses the whole
  // byte list so the decoder can read the state from the front and consume
  // renormalization bytes forward. Mirrors RansEncoder.Encode.
  // The state transition is computed in float64 (exact below 2^53) and
  // reduced by ToUint32, as the plain JavaScript arithmetic always was.
  /**
   * @param {uint8[]} data - Input bytes
   * @param {int32[]} normFreq - Normalized symbol frequencies
   * @returns {uint8[]} State and renormalization bytes, front to back
   */
  function encodeRans(data, normFreq) {
    /** @type {int32[]} */
    const cumFreq = buildCumulativeFrequencies(normFreq);

    /** @type {uint8[]} */
    const outputBytes = [];
    /** @type {uint32} */
    let state = RANS_L;

    for (let i = data.length - 1; i >= 0; i--) {
      /** @type {uint8} */
      const sym = data[i];
      /** @type {int32} */
      const f = normFreq[sym];
      /** @type {int32} */
      const c = cumFreq[sym];

      /** @type {float64} */
      const xMax = f * RENORM_SHIFT * RENORM_BYTE;
      while (state >= xMax) {
        outputBytes.push(OpCodes.GetByte(state, 0));
        state = OpCodes.Shr32(state, 8);
      }

      /** @type {float64} */
      const s = state;
      /** @type {float64} */
      const next = Math.floor(s / f) * SCALE + (s % f) + c;
      state = OpCodes.ToUint32(next);
    }

    /** @type {uint8[]} */
    const stateBytes = OpCodes.Unpack32LE(state);
    for (let i = 0; i < 4; i++) {
      outputBytes.push(stateBytes[i]);
    }

    outputBytes.reverse();
    return outputBytes;
  }

  // Decodes a rANS-encoded byte stream. Builds a direct cumulative-frequency
  // to symbol lookup table (size SCALE), reads the initial state from the
  // first 4 bytes big-endian (matching the encoder's front-loaded state),
  // then repeatedly extracts a symbol from state % SCALE, updates state, and
  // renormalizes by reading more bytes while state is below RANS_L. Mirrors
  // RansDecoder.Decode.
  /**
   * @param {uint8[]} encoded - State and renormalization bytes
   * @param {uint32} originalSize - Number of symbols to decode
   * @param {int32[]} normFreq - Normalized symbol frequencies
   * @returns {uint8[]} Decoded bytes
   */
  function decodeRans(encoded, originalSize, normFreq) {
    /** @type {int32[]} */
    const cumFreq = buildCumulativeFrequencies(normFreq);

    /** @type {uint8[]} */
    const lookup = new Array(SCALE);
    for (let sym = 0; sym < 256; sym++) {
      for (let j = cumFreq[sym]; j < cumFreq[sym + 1]; j++) {
        lookup[j] = sym;
      }
    }

    /** @type {int32} */
    let pos = 0;
    /** @type {uint32} */
    let state = OpCodes.Pack32BE(encoded[pos], encoded[pos + 1], encoded[pos + 2], encoded[pos + 3]);
    pos += 4;

    /** @type {uint8[]} */
    const output = new Array(originalSize);

    for (let i = 0; i < originalSize; i++) {
      /** @type {float64} */
      const s = state;
      /** @type {int32} */
      const cumVal = s % SCALE;
      /** @type {uint8} */
      const sym = lookup[cumVal];
      output[i] = sym;

      /** @type {float64} */
      const f = normFreq[sym];
      /** @type {float64} */
      const c = cumFreq[sym];

      /** @type {float64} */
      const next = f * Math.floor(s / SCALE) + (s % SCALE) - c;
      state = OpCodes.ToUint32(next);

      while (state < RANS_L && pos < encoded.length) {
        state = OpCodes.Or32(OpCodes.Shl32(state, 8), encoded[pos++]);
      }
    }

    return output;
  }

  /**
 * RANSAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class RANSAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "rANS (Range Asymmetric Numeral Systems)";
        this.description = "Advanced entropy coding using range-based asymmetric numeral systems for optimal compression efficiency. Provides arithmetic coding quality with faster processing through range-based state management and renormalization.";
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Entropy Coding";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.ADVANCED;
        this.inventor = "Jarek Duda, Fabian Giesen";
        this.year = 2011;
        this.country = CountryCode.INTL;

        this.documentation = [
          new LinkItem("rANS Implementation", "https://github.com/rygorous/ryg_rans"),
          new LinkItem("ANS Entropy Coding", "https://arxiv.org/abs/1311.2540"),
          new LinkItem("Fabian Giesen Blog", "https://fgiesen.wordpress.com/2014/02/02/rans-notes/")
        ];

        this.references = [
          new LinkItem("Asymmetric Numeral Systems", "https://en.wikipedia.org/wiki/Asymmetric_numeral_systems"),
          new LinkItem("Range Coding Theory", "https://marknelson.us/posts/2014/10/19/data-compression-with-arithmetic-coding.html"),
          new LinkItem("rANS vs tANS Comparison", "https://encode.su/threads/2648-Asymmetric-Numeral-Systems"),
          new LinkItem("Practical ANS Implementation", "https://github.com/Cyan4973/FiniteStateEntropy")
        ];

        // Test vectors - round-trip compression tests only (no specific
        // compressed outputs): the wire format is a two-pass order-0 model
        // with a normalized frequency table header, so verifying exact
        // compressed bytes here would just duplicate the normalization
        // logic; RoundTripSuite validates correctness by compressing then
        // decompressing back to the original input.
        this.tests = [
          new TestCase([], [], "Empty input - boundary case", "https://github.com/rygorous/ryg_rans"),
          new TestCase(OpCodes.AnsiToBytes("A"), [], "Single character round-trip test", "https://arxiv.org/abs/1311.2540"),
          new TestCase(OpCodes.AnsiToBytes("AAAA"), [], "Repeated characters round-trip test", "https://fgiesen.wordpress.com/2014/02/02/rans-notes/"),
          new TestCase(OpCodes.AnsiToBytes("ABAB"), [], "Alternating characters round-trip test", "https://en.wikipedia.org/wiki/Asymmetric_numeral_systems"),
          new TestCase(OpCodes.AnsiToBytes("ABC"), [], "Three symbols round-trip test", "https://marknelson.us/posts/2014/10/19/data-compression-with-arithmetic-coding.html"),
          new TestCase(OpCodes.AnsiToBytes("AAB"), [], "Skewed distribution round-trip test", "https://encode.su/threads/2648-Asymmetric-Numeral-Systems"),
          new TestCase(OpCodes.AnsiToBytes("ABABABAB"), [], "Longer alternating input round-trip test (exercises renormalization)", "https://github.com/rygorous/ryg_rans"),
          new TestCase(Array.from({ length: 256 }, (_, i) => i), [], "All 256 byte values round-trip test", "Regression test for decoder/model desync"),
          new TestCase(OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. ".repeat(4)), [], "Repeated phrase round-trip test", "Regression test for decoder/model desync")
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      /**
       * Create a new instance
       * @param {boolean} [isInverse=false] - True to decompress
       * @returns {RANSInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new RANSInstance(this, isInverse);
      }
    }

    class RANSInstance extends IAlgorithmInstance {
      /**
       * @param {RANSAlgorithm} algorithm - Parent algorithm
       * @param {boolean} [isInverse=false] - True to decompress
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        /** @type {boolean} */
        this.isInverse = isInverse;
        /** @type {uint8[]} */
        this.inputBuffer = [];
      }

      /**
       * Compress or decompress the collected input
       * @returns {uint8[]} Output bytes
       */
      Result() {
        if (this.isInverse) {
          // A compressed stream always carries at least the 4-byte length
          // header, so an empty buffer here is not a valid compressed
          // empty message.
          if (this.inputBuffer.length === 0) {
            /** @type {uint8[]} */
            const empty = [];
            return empty;
          }
          return this._decompress();
        }

        // Compressing empty input still emits the header (matches
        // CompressionWorkbench, which never skips the container).
        return this._compress();
      }

      /**
       * @returns {uint8[]} Length, frequency table and rANS payload
       */
      _compress() {
        /** @type {uint8[]} */
        const data = this.inputBuffer;
        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;

        // Header: 4-byte LE original length.
        /** @type {uint8[]} */
        const output = OpCodes.Unpack32LE(OpCodes.ToUint32(data.length));

        if (data.length === 0) {
          return output;
        }

        // Count frequencies and normalize to sum to SCALE.
        /** @type {int32[]} */
        const freq = new Int32Array(256);
        for (let i = 0; i < data.length; i++) {
          freq[data[i]]++;
        }

        /** @type {int32[]} */
        const normFreq = normalizeFrequencies(freq, data.length);

        // Frequency table: 2-byte LE used-symbol count, then (symbol byte,
        // 2-byte LE normFreq) pairs in ascending byte order.
        /** @type {int32} */
        let used = 0;
        for (let i = 0; i < 256; i++) {
          if (normFreq[i] > 0) {
            used++;
          }
        }

        /** @type {uint8[]} */
        const usedBytes = OpCodes.Unpack16LE(used);
        output.push(usedBytes[0]);
        output.push(usedBytes[1]);

        for (let i = 0; i < 256; i++) {
          if (normFreq[i] === 0) {
            continue;
          }
          output.push(i);
          /** @type {uint8[]} */
          const fb = OpCodes.Unpack16LE(normFreq[i]);
          output.push(fb[0]);
          output.push(fb[1]);
        }

        // Encode, then write 4-byte LE encoded length + encoded bytes.
        /** @type {uint8[]} */
        const encoded = encodeRans(data, normFreq);

        /** @type {uint8[]} */
        const lenBytes = OpCodes.Unpack32LE(OpCodes.ToUint32(encoded.length));
        for (let i = 0; i < 4; i++) {
          output.push(lenBytes[i]);
        }
        for (let i = 0; i < encoded.length; i++) {
          output.push(encoded[i]);
        }

        return output;
      }

      /**
       * @returns {uint8[]} Decoded bytes
       */
      _decompress() {
        /** @type {uint8[]} */
        const data = this.inputBuffer;
        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        /** @type {int32} */
        let offset = 0;

        // Header: 4-byte LE original length.
        /** @type {uint32} */
        const originalSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
        offset += 4;

        if (originalSize === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }

        // Frequency table: 2-byte LE used-symbol count, then (symbol byte,
        // 2-byte LE normFreq) pairs.
        /** @type {int32} */
        const usedCount = OpCodes.Pack16LE(data[offset], data[offset + 1]);
        offset += 2;

        /** @type {int32[]} */
        const normFreq = new Array(256);
        for (let i = 0; i < 256; i++) {
          normFreq[i] = 0;
        }
        for (let i = 0; i < usedCount; i++) {
          /** @type {uint8} */
          const sym = data[offset++];
          normFreq[sym] = OpCodes.Pack16LE(data[offset], data[offset + 1]);
          offset += 2;
        }

        // Encoded payload: 4-byte LE length + that many bytes.
        /** @type {uint32} */
        const encodedLen = OpCodes.Pack32LE(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
        offset += 4;

        // float64: a corrupt length may run past 2^31
        /** @type {float64} */
        const payloadEnd = offset + encodedLen;
        /** @type {uint8[]} */
        const encoded = data.slice(offset, payloadEnd);

        return decodeRans(encoded, originalSize, normFreq);
      }
    }

  // ===== REGISTRATION =====

    const algorithmInstance = new RANSAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RANSAlgorithm, RANSInstance };
}));
