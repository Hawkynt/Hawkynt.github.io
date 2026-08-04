/*
 * CTW (Context Tree Weighting building block) Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * This building block carries the "CTW" name for wire-compatibility with the
 * CompressionWorkbench reference, but is NOT the textbook Context Tree
 * Weighting algorithm (KT-estimator weighted binary context tree with
 * arithmetic coding). It is a much simpler byte-level context model with
 * depth 2: for each byte it predicts the most-frequent symbol seen so far in
 * the order-2, then order-1, then order-0 context, records a hit/miss flag,
 * and falls back to storing the literal byte on a miss. The bitstream is a
 * bit-packed hit/miss flag array followed by the miss literal bytes.
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
 * CTWAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class CTWAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Context Tree Weighting (CTW)";
        this.description = "Order-2/1/0 most-frequent-symbol predictor with a hit/miss bitmap. For each byte, predicts the most frequent symbol seen so far in the order-2, then order-1, then order-0 context; a bit-packed flag records hit/miss and misses are stored as literal bytes. Named after, but not the textbook, Context Tree Weighting algorithm.";
        this.inventor = "Frans Willems, Yuri Shtarkov, Tjalling Tjalkens";
        this.year = 1995;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Statistical";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.NL; // Netherlands

        // Documentation and references
        this.documentation = [
          new LinkItem("Context Tree Weighting - Wikipedia", "https://en.wikipedia.org/wiki/Context_tree_weighting"),
          new LinkItem("CTW Original Paper", "https://ieeexplore.ieee.org/document/392378")
        ];

        this.references = [
          new LinkItem("The Context-Tree Weighting Method", "https://pure.tue.nl/ws/portalfiles/portal/1134430/200411859.pdf"),
          new LinkItem("Statistical Compression Survey", "https://homepages.cwi.nl/~paulv/papers/statsmodcourse.pdf"),
          new LinkItem("Data Compression Course", "https://web.stanford.edu/class/ee398a/")
        ];

        // Test vectors - round-trip compression tests only (no specific compressed outputs)
        this.tests = [
          new TestCase([], [], "Empty data round-trip test", "Educational test vector"),
          new TestCase(OpCodes.AnsiToBytes("0"), [], "Single character round-trip test", "Educational test vector"),
          new TestCase(OpCodes.AnsiToBytes("01"), [], "Two symbols round-trip test", "Educational test vector"),
          new TestCase(OpCodes.AnsiToBytes("0101"), [], "Alternating pattern round-trip test", "Educational test vector"),
          new TestCase(OpCodes.AnsiToBytes("00110011"), [], "Structured pattern round-trip test", "Educational test vector"),
          new TestCase(OpCodes.AnsiToBytes("abcabc"), [], "Repeating sequence round-trip test", "Educational test vector"),
          new TestCase(Array.from({ length: 256 }, (_, i) => i), [], "All 256 byte values round-trip test", "Regression test for decoder/model desync")
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new CTWInstance(this, isInverse);
      }
    }

    // Fixed context depth used by the header and by GetContext2.
    const MAX_DEPTH = 2;

    // Bit masks for the MSB-first flag byte packing (bit 0 -> 0x80 ... bit 7 -> 0x01).
    const FLAG_BIT_MASKS = [0x80, 0x40, 0x20, 0x10, 0x08, 0x04, 0x02, 0x01];

    /**
     * Context model tracking symbol frequencies per context, mirroring the
     * reference's Dictionary<int, Dictionary<byte,int>>. Each per-context
     * Map preserves insertion order, which is required for correct tie
     * breaking in GetMostFrequent.
     */
    class ContextModel {
      constructor() {
        this.contexts = new Map();
      }

      // Returns the most frequent symbol in the given context, or -1 if no data.
      getMostFrequent(contextId) {
        const freqs = this.contexts.get(contextId);
        if (!freqs || freqs.size === 0) return -1;

        let bestSymbol = -1;
        let bestCount = 0;
        for (const [symbol, count] of freqs) {
          if (count > bestCount) {
            bestCount = count;
            bestSymbol = symbol;
          }
        }
        return bestSymbol;
      }

      update(contextId, symbol) {
        let freqs = this.contexts.get(contextId);
        if (!freqs) {
          freqs = new Map();
          this.contexts.set(contextId, freqs);
        }
        freqs.set(symbol, (freqs.get(symbol) || 0) + 1);
      }
    }

    // Context id helpers. `data` may be the full source array (compression)
    // or the growing decoded output array (decompression); `pos` must only
    // reference indices strictly before itself (pos-1, pos-2).
    function getContext1(data, pos) {
      return 0x100 + data[pos - 1];
    }

    function getContext2(data, pos) {
      return 0x10100 + (data[pos - 2] * 256) + data[pos - 1];
    }

    // Predicts the next byte using the context hierarchy (order 2, 1, 0, fallback 0).
    function predict(model, data, pos) {
      if (pos >= 2) {
        const pred = model.getMostFrequent(getContext2(data, pos));
        if (pred >= 0) return pred;
      }
      if (pos >= 1) {
        const pred = model.getMostFrequent(getContext1(data, pos));
        if (pred >= 0) return pred;
      }
      {
        const pred = model.getMostFrequent(0);
        if (pred >= 0) return pred;
      }
      return 0;
    }

    // Applies the encoder's/decoder's shared context updates for the symbol
    // just placed at index `idx` of `data`.
    function updateModel(model, data, idx, symbol) {
      model.update(0, symbol);
      if (idx >= 1) model.update(getContext1(data, idx), symbol);
      if (idx >= 2) model.update(getContext2(data, idx), symbol);
    }

    // Two-pass block compressor: determine hit/miss flags against the
    // predictor, then bit-pack the flags (MSB first) followed by the miss
    // literal bytes.
    function compressBlock(src) {
      const model = new ContextModel();
      const hits = new Array(src.length);
      const missSymbols = [];

      for (let i = 0; i < src.length; i++) {
        const symbol = src[i];
        const predicted = predict(model, src, i);

        if (predicted === symbol) {
          hits[i] = true;
        } else {
          hits[i] = false;
          missSymbols.push(symbol);
        }

        updateModel(model, src, i, symbol);
      }

      const result = [];

      const flagByteCount = Math.ceil(src.length / 8);
      for (let byteIdx = 0; byteIdx < flagByteCount; byteIdx++) {
        let flagByte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const srcIdx = byteIdx * 8 + bit;
          if (srcIdx < src.length && hits[srcIdx])
            flagByte = OpCodes.SetBit(flagByte, 7 - bit, true);
        }
        result.push(flagByte);
      }

      for (let i = 0; i < missSymbols.length; i++) result.push(missSymbols[i]);

      return result;
    }

    // Decodes a block produced by compressBlock back into originalSize bytes.
    function decompressBlock(src, originalSize) {
      const dst = [];
      const model = new ContextModel();

      const flagByteCount = Math.ceil(originalSize / 8);
      if (src.length < flagByteCount)
        throw new Error('Unexpected end of CTW flag data.');

      let missPos = flagByteCount;

      for (let i = 0; i < originalSize; i++) {
        const byteIdx = Math.floor(i / 8);
        const bitIdx = i - byteIdx * 8;
        const isHit = OpCodes.GetBit(src[byteIdx], 7 - bitIdx);

        let symbol;
        if (isHit) {
          symbol = predict(model, dst, dst.length);
        } else {
          if (missPos >= src.length)
            throw new Error('Unexpected end of CTW miss data.');
          symbol = src[missPos++];
        }

        dst.push(symbol);

        const idx = dst.length - 1;
        updateModel(model, dst, idx, symbol);
      }

      if (dst.length !== originalSize)
        throw new Error(`CTW decompressed size mismatch: expected ${originalSize}, got ${dst.length}.`);

      return dst;
    }

    class CTWInstance extends IAlgorithmInstance {
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
        if (this.isInverse) {
          // A compressed stream always carries at least the 5-byte header, so
          // an empty buffer here is not a valid compressed empty message.
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

        // Header: 4-byte LE original length, 1-byte max depth.
        const result = OpCodes.Unpack32LE(OpCodes.ToUint32(data.length));
        result.push(MAX_DEPTH);

        if (data.length === 0) return result;

        const encoded = compressBlock(data);
        for (let i = 0; i < encoded.length; i++) result.push(encoded[i]);

        return result;
      }

      _decompress() {
        const data = this.inputBuffer;
        this.inputBuffer = [];

        // Header: 4-byte LE original length, 1-byte max depth (informational, unused here).
        const originalSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
        const offset = 5;

        if (originalSize === 0) return [];

        const src = data.slice(offset);
        return decompressBlock(src, originalSize);
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new CTWAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { CTWAlgorithm, CTWInstance };
}));
