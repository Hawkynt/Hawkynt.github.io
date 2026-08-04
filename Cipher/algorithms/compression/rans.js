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
  const SCALE_BITS = 12;
  const SCALE = 4096;         // 1 << 12: normalized frequency total
  const RANS_L = 8388608;     // 1 << 23: renormalization lower bound
  const RENORM_SHIFT = 2048;  // RansL >> ScaleBits (8388608 >> 12), kept as its
                               // own constant so the renormalization threshold
                               // is computed the same way as the reference
                               // (f * RENORM_SHIFT * 256) rather than simplified
                               // algebraically.
  const RENORM_BYTE = 256;    // 1 << 8

  // Scales raw (exact) symbol frequencies to sum to exactly SCALE, giving
  // every symbol that occurs at least one slot, then nudging the
  // largest/smallest-error entries up or down until the sum matches exactly.
  // This is a mechanical port of RansEncoder.NormalizeFrequencies: iteration
  // order (ascending byte value via the `used` list), tie-breaking (strict
  // > / < comparisons keep the first-found index), and floating-point operand
  // order are all preserved so the result matches bit-for-bit.
  function normalizeFrequencies(freq, totalCount) {
    const norm = new Array(256).fill(0);
    let assigned = 0;
    const used = [];

    for (let i = 0; i < 256; i++) {
      if (freq[i] === 0) continue;
      used.push(i);
      let nf = Math.floor(freq[i] * SCALE / totalCount);
      if (nf < 1) nf = 1;
      norm[i] = nf;
      assigned += nf;
    }

    while (assigned !== SCALE) {
      if (assigned < SCALE) {
        let bestIdx = used[0];
        let bestError = -Infinity;
        for (const idx of used) {
          const ideal = freq[idx] * SCALE / totalCount;
          const error = ideal - norm[idx];
          if (error > bestError) { bestError = error; bestIdx = idx; }
        }
        norm[bestIdx]++;
        assigned++;
      } else {
        let bestIdx = used[0];
        let bestError = Infinity;
        for (const idx of used) {
          if (norm[idx] <= 1) continue;
          const ideal = freq[idx] * SCALE / totalCount;
          const error = ideal - norm[idx];
          if (error < bestError) { bestError = error; bestIdx = idx; }
        }
        if (norm[bestIdx] > 1) { norm[bestIdx]--; assigned--; }
        else break;
      }
    }

    return norm;
  }

  function buildCumulativeFrequencies(normFreq) {
    const cumFreq = new Array(257).fill(0);
    for (let i = 0; i < 256; i++) cumFreq[i + 1] = cumFreq[i] + normFreq[i];
    return cumFreq;
  }

  // Encodes data backwards (last byte first) into a single rANS state,
  // flushing renormalization bytes as the state grows too large, then
  // appends the final 4-byte state (little-endian) and reverses the whole
  // byte list so the decoder can read the state from the front and consume
  // renormalization bytes forward. Mirrors RansEncoder.Encode.
  function encodeRans(data, normFreq) {
    const cumFreq = buildCumulativeFrequencies(normFreq);

    const outputBytes = [];
    let state = RANS_L;

    for (let i = data.length - 1; i >= 0; i--) {
      const sym = data[i];
      const f = normFreq[sym];
      const c = cumFreq[sym];

      const xMax = f * RENORM_SHIFT * RENORM_BYTE;
      while (state >= xMax) {
        outputBytes.push(OpCodes.GetByte(state, 0));
        state = OpCodes.Shr32(state, 8);
      }

      state = OpCodes.ToUint32(Math.floor(state / f) * SCALE + (state % f) + c);
    }

    const stateBytes = OpCodes.Unpack32LE(state);
    for (let i = 0; i < 4; i++) outputBytes.push(stateBytes[i]);

    outputBytes.reverse();
    return outputBytes;
  }

  // Decodes a rANS-encoded byte stream. Builds a direct cumulative-frequency
  // to symbol lookup table (size SCALE), reads the initial state from the
  // first 4 bytes big-endian (matching the encoder's front-loaded state),
  // then repeatedly extracts a symbol from state % SCALE, updates state, and
  // renormalizes by reading more bytes while state is below RANS_L. Mirrors
  // RansDecoder.Decode.
  function decodeRans(encoded, originalSize, normFreq) {
    const cumFreq = buildCumulativeFrequencies(normFreq);

    const lookup = new Array(SCALE);
    for (let sym = 0; sym < 256; sym++)
      for (let j = cumFreq[sym]; j < cumFreq[sym + 1]; j++) lookup[j] = sym;

    let pos = 0;
    let state = OpCodes.Pack32BE(encoded[pos], encoded[pos + 1], encoded[pos + 2], encoded[pos + 3]);
    pos += 4;

    const output = new Array(originalSize);

    for (let i = 0; i < originalSize; i++) {
      const cumVal = state % SCALE;
      const sym = lookup[cumVal];
      output[i] = sym;

      const f = normFreq[sym];
      const c = cumFreq[sym];

      state = OpCodes.ToUint32(f * Math.floor(state / SCALE) + (state % SCALE) - c);

      while (state < RANS_L && pos < encoded.length) {
        state = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(state, 8), encoded[pos++]));
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

      CreateInstance(isInverse = false) {
        return new RANSInstance(this, isInverse);
      }
    }

    class RANSInstance extends IAlgorithmInstance {
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
        if (this.isInverse) {
          // A compressed stream always carries at least the 4-byte length
          // header, so an empty buffer here is not a valid compressed
          // empty message.
          if (this.inputBuffer.length === 0) return [];
          return this._decompress();
        }

        // Compressing empty input still emits the header (matches
        // CompressionWorkbench, which never skips the container).
        return this._compress();
      }

      _compress() {
        const data = this.inputBuffer;
        this.inputBuffer = [];

        // Header: 4-byte LE original length.
        const output = OpCodes.Unpack32LE(OpCodes.ToUint32(data.length));

        if (data.length === 0) return output;

        // Count frequencies and normalize to sum to SCALE.
        const freq = new Array(256).fill(0);
        for (let i = 0; i < data.length; i++) freq[data[i]]++;

        const normFreq = normalizeFrequencies(freq, data.length);

        // Frequency table: 2-byte LE used-symbol count, then (symbol byte,
        // 2-byte LE normFreq) pairs in ascending byte order.
        let used = 0;
        for (let i = 0; i < 256; i++) if (normFreq[i] > 0) used++;

        const usedBytes = OpCodes.Unpack16LE(used);
        output.push(usedBytes[0], usedBytes[1]);

        for (let i = 0; i < 256; i++) {
          if (normFreq[i] === 0) continue;
          output.push(i);
          const fb = OpCodes.Unpack16LE(normFreq[i]);
          output.push(fb[0], fb[1]);
        }

        // Encode, then write 4-byte LE encoded length + encoded bytes.
        const encoded = encodeRans(data, normFreq);

        const lenBytes = OpCodes.Unpack32LE(OpCodes.ToUint32(encoded.length));
        output.push(lenBytes[0], lenBytes[1], lenBytes[2], lenBytes[3]);
        for (let i = 0; i < encoded.length; i++) output.push(encoded[i]);

        return output;
      }

      _decompress() {
        const data = this.inputBuffer;
        this.inputBuffer = [];
        let offset = 0;

        // Header: 4-byte LE original length.
        const originalSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
        offset += 4;

        if (originalSize === 0) return [];

        // Frequency table: 2-byte LE used-symbol count, then (symbol byte,
        // 2-byte LE normFreq) pairs.
        const usedCount = OpCodes.Pack16LE(data[offset], data[offset + 1]);
        offset += 2;

        const normFreq = new Array(256).fill(0);
        for (let i = 0; i < usedCount; i++) {
          const sym = data[offset++];
          normFreq[sym] = OpCodes.Pack16LE(data[offset], data[offset + 1]);
          offset += 2;
        }

        // Encoded payload: 4-byte LE length + that many bytes.
        const encodedLen = OpCodes.Pack32LE(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
        offset += 4;

        const encoded = data.slice(offset, offset + encodedLen);

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
