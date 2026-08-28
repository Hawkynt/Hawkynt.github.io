/*
 * DPCM (Differential Pulse-Code Modulation) Transform Implementation
 * Compatible with AlgorithmFramework
 * Reversible predictive transform: each sample after the first is replaced by
 * its difference (modulo 256) from the previous sample, converting a smoothly
 * varying signal into small residuals that an entropy coder can compress far
 * better than the raw samples. The first sample is stored verbatim.
 * Spec/origin: C. Chapin Cutler, "Differential Quantization of Communication
 * Signals", U.S. Patent 2,605,361, filed 1950 (Bell Telephone Laboratories).
 * The order-1 predictor implemented here (no quantization/entropy stage) is
 * the building block underlying later standards such as ITU-T G.726 ADPCM.
 * References:
 *   https://patents.google.com/patent/US2605361A
 *   https://www.itu.int/rec/T-REC-G.726
 *   https://en.wikipedia.org/wiki/Differential_pulse-code_modulation
 * (c)2006-2025 Hawkynt
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
   * DpcmTransform - Compression (transform) algorithm implementation
   * @class
   * @extends {CompressionAlgorithm}
   */
  class DpcmTransform extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "DPCM";
      this.description = "Differential Pulse-Code Modulation, an order-1 predictive transform that stores each sample as its difference (modulo 256) from the immediately preceding sample, with the first sample stored verbatim. Effective for correlated signal data such as audio samples or slowly varying sensor readings, where residuals cluster near zero and compress well with an entropy coder.";
      this.inventor = "C. Chapin Cutler";
      this.year = 1950;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Transform";
      this.securityStatus = null;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("US Patent 2,605,361 - Differential Quantization of Communication Signals", "https://patents.google.com/patent/US2605361A"),
        new LinkItem("ITU-T G.726 - 40, 32, 24, 16 kbit/s Adaptive Differential PCM", "https://www.itu.int/rec/T-REC-G.726"),
        new LinkItem("Differential pulse-code modulation - Wikipedia", "https://en.wikipedia.org/wiki/Differential_pulse-code_modulation")
      ];

      this.references = [
        new LinkItem("Jayant and Noll, Digital Coding of Waveforms", "https://en.wikipedia.org/wiki/Differential_pulse-code_modulation"),
        new LinkItem("PNG Delta Filters (related order-1 predictive transform)", "http://libpng.org/pub/png/spec/1.2/PNG-Filters.html")
      ];

      // Test vectors with actual DPCM-encoded outputs.
      this.tests = [
        {
          text: "Empty data test",
          uri: "Edge case test",
          input: [],
          expected: []
        },
        {
          text: "Single sample test",
          uri: "Minimal DPCM test",
          input: [65],
          expected: [65]
        },
        {
          text: "Incrementing sequence, ideal for DPCM",
          uri: "https://en.wikipedia.org/wiki/Differential_pulse-code_modulation",
          input: [10, 12, 14, 16],
          expected: [10, 2, 2, 2]
        },
        {
          text: "Wraparound across the 0/255 boundary (modulo-256 residual)",
          uri: "https://patents.google.com/patent/US2605361A",
          input: [250, 10, 5],
          expected: [250, 16, 251]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DpcmInstance(this, isInverse);
    }
  }

  class DpcmInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }


    Result() {
      if (this.inputBuffer.length === 0) {
        return [];
      }

      const output = this.isInverse ? this._decode(this.inputBuffer) : this._encode(this.inputBuffer);
      this.inputBuffer = [];
      return output;
    }

    // Forward transform: replaces each sample (after the first) with its
    // modulo-256 difference from the previous original sample.
    _encode(samples) {
      const result = new Array(samples.length);
      result[0] = OpCodes.ToByte(samples[0]);

      for (let i = 1; i < samples.length; i++) {
        result[i] = OpCodes.ToByte(samples[i] - samples[i - 1]);
      }

      return result;
    }

    // Inverse transform: reconstructs each sample by accumulating residuals
    // (modulo 256) onto the previously reconstructed sample.
    _decode(residuals) {
      const result = new Array(residuals.length);
      result[0] = OpCodes.ToByte(residuals[0]);

      for (let i = 1; i < residuals.length; i++) {
        result[i] = OpCodes.ToByte(result[i - 1] + residuals[i]);
      }

      return result;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DpcmTransform();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DpcmTransform, DpcmInstance };
}));
