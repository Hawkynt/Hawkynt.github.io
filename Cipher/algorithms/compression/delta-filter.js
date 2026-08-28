/*
 * Delta Filter Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The pure delta filter: a size-preserving reversible transform that stores
 * each byte as the difference from the byte a fixed distance behind it. This
 * is the byte-relative "predictor" step used ahead of an entropy coder or
 * general-purpose compressor (PNG, TIFF, and CompressionWorkbench's BB_Delta
 * block all use exactly this shape); it performs no compression on its own -
 * output length always equals input length. Not to be confused with
 * "Delta + RLE" (see delta.js), which applies this same transform and then
 * run-length encodes the result, making it an actual compressor.
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

  // Encodes data using the delta filter: each output byte is the difference
  // between the input byte and the input byte `distance` positions earlier.
  // The first `distance` bytes are copied unchanged. Matches
  // CompressionWorkbench's DeltaFilter.Encode(data, distance) exactly.
  function deltaFilterEncode(data, distance) {
    const n = data.length;
    if (n === 0) return [];

    const result = new Array(n);
    const copyLen = Math.min(distance, n);
    for (let i = 0; i < copyLen; i++) result[i] = OpCodes.ToByte(data[i]);

    for (let i = distance; i < n; i++)
      result[i] = OpCodes.ToByte(data[i] - data[i - distance]);

    return result;
  }

  // Decodes delta-filtered data back to the original. Matches
  // CompressionWorkbench's DeltaFilter.Decode(data, distance) exactly.
  function deltaFilterDecode(data, distance) {
    const n = data.length;
    if (n === 0) return [];

    const result = new Array(n);
    const copyLen = Math.min(distance, n);
    for (let i = 0; i < copyLen; i++) result[i] = OpCodes.ToByte(data[i]);

    for (let i = distance; i < n; i++)
      result[i] = OpCodes.ToByte(data[i] + result[i - distance]);

    return result;
  }

  /**
 * DeltaFilterCompression - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class DeltaFilterCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Delta Filter";
        this.description = "Pure, size-preserving delta transform: each byte is stored as the difference from the byte a fixed distance behind it (distance=1 here), with no entropy coding or run-length pass. Used as a predictor step ahead of a general-purpose compressor. Generalizes to any fixed distance (e.g. sample width or pixel stride); this instance fixes distance=1 to match CompressionWorkbench's BB_Delta default.";
        this.inventor = "Various (general technique)";
        this.year = 1950;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Transform";
        this.securityStatus = null;
        this.complexity = ComplexityType.SIMPLE;
        this.country = CountryCode.UNKNOWN;

        // Documentation and references
        this.documentation = [
          new LinkItem("Delta Encoding - Wikipedia", "https://en.wikipedia.org/wiki/Delta_encoding"),
          new LinkItem("PNG Delta Filters", "http://libpng.org/pub/png/spec/1.2/PNG-Filters.html"),
          new LinkItem("Time Series Compression", "https://www.vldb.org/pvldb/vol8/p1816-pelkonen.pdf")
        ];

        this.references = [
          new LinkItem("PNG Reference Implementation", "http://libpng.org/pub/png/libpng.html"),
          new LinkItem("TIFF Differencing Predictor", "https://www.adobe.io/open/standards/TIFF.html"),
          new LinkItem("CompressionWorkbench DeltaFilter (reference implementation)", "https://github.com/Hawkynt")
        ];

        // Test vectors verified against CompressionWorkbench's BB_Delta
        // (Compression.Core.Transforms.DeltaFilter.Encode/Decode with the
        // default distance=1), the authoritative reference this transform is
        // byte-identical to.
        this.tests = [
          {
            text: "Empty data test",
            uri: "Edge case test",
            input: [],
            expected: [] // Empty input produces empty output
          },
          {
            text: "Single byte test - first `distance` bytes are copied unchanged",
            uri: "Minimal delta test",
            input: [65], // "A"
            expected: [65]
          },
          {
            text: "Incrementing sequence - pure delta, no compression",
            uri: "https://en.wikipedia.org/wiki/Delta_encoding",
            input: [10, 12, 14, 16],
            expected: [10, 2, 2, 2]
          },
          {
            text: "Regression: 256 repeated bytes - output length equals input length (no RLE)",
            uri: "Regression test distinguishing this from the Delta + RLE compressor",
            input: new Array(256).fill(0x61),
            expected: [0x61].concat(new Array(255).fill(0))
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new DeltaFilterInstance(this, isInverse);
      }
    }

    class DeltaFilterInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
        this.distance = 1;
      }


      Result() {
        const data = this.inputBuffer;
        this.inputBuffer = [];

        return this.isInverse
          ? deltaFilterDecode(data, this.distance)
          : deltaFilterEncode(data, this.distance);
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new DeltaFilterCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DeltaFilterCompression, DeltaFilterInstance };
}));
