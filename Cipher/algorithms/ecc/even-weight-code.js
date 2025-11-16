/*
 * Even Weight Code Implementation
 * All codewords have even Hamming weight (even number of 1s)
 * (c)2006-2025 Hawkynt
 */

// Load AlgorithmFramework (REQUIRED)

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
          ErrorCorrectionAlgorithm, IErrorCorrectionInstance,
          TestCase, LinkItem, Vulnerability } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class EvenWeightCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Even Weight Code";
      this.description = "Code where all codewords have even Hamming weight (even number of 1s). Equivalent to single parity check code. Parameters (n, n-1, 2) with minimum distance 2. Can detect single-bit errors. Used in Type I self-dual codes and error detection. Dual of repetition code of length n.";
      this.inventor = "Unknown (classical technique)";
      this.year = 1950;
      this.category = CategoryType.ECC;
      this.subCategory = "Linear Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Hamming Weight", "https://en.wikipedia.org/wiki/Hamming_weight"),
        new LinkItem("Even Weight Codes", "https://www.sciencedirect.com/topics/mathematics/self-dual-code"),
        new LinkItem("Self-Dual Codes", "https://errorcorrectionzoo.org/c/self_dual")
      ];

      this.references = [
        new LinkItem("Type I Self-Dual", "https://en.wikipedia.org/wiki/Dual_code"),
        new LinkItem("Weight Properties", "https://mathworld.wolfram.com/Error-CorrectingCode.html"),
        new LinkItem("Constant Weight Codes", "https://en.wikipedia.org/wiki/Constant-weight_code")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Detection Only",
          "Can only detect errors, not correct them. Minimum distance d=2 insufficient for correction."
        ),
        new Vulnerability(
          "Even Error Blindness",
          "Cannot detect even number of errors (e.g., 2, 4, 6 bit errors)."
        )
      ];

      // Test vectors for Even Weight Code
      this.tests = [
        {
          text: "Even Weight (6,5) all zeros",
          uri: "https://en.wikipedia.org/wiki/Hamming_weight",
          input: [0, 0, 0, 0, 0],
          expected: [0, 0, 0, 0, 0, 0]
        },
        {
          text: "Even Weight (6,5) pattern 10000",
          uri: "https://en.wikipedia.org/wiki/Hamming_weight",
          input: [1, 0, 0, 0, 0],
          expected: [1, 0, 0, 0, 0, 1]
        },
        {
          text: "Even Weight (6,5) pattern 11000",
          uri: "https://en.wikipedia.org/wiki/Hamming_weight",
          input: [1, 1, 0, 0, 0],
          expected: [1, 1, 0, 0, 0, 0]
        },
        {
          text: "Even Weight (6,5) pattern 10101",
          uri: "https://en.wikipedia.org/wiki/Hamming_weight",
          input: [1, 0, 1, 0, 1],
          expected: [1, 0, 1, 0, 1, 1]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new EvenWeightCodeInstance(this, isInverse);
    }
  }

  /**
 * EvenWeightCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class EvenWeightCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('EvenWeightCodeInstance.Feed: Input must be bit array');
      }

      if (this.isInverse) {
        this.result = this.decode(data);
      } else {
        this.result = this.encode(data);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.result === null) {
        throw new Error('EvenWeightCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    encode(data) {
      // Count ones (Hamming weight)
      let weight = 0;
      for (let i = 0; i < data.length; ++i) {
        weight += data[i];
      }

      // Add parity bit to make weight even
      const parityBit = weight % 2;

      return [...data, parityBit];
    }

    decode(data) {
      if (data.length < 2) {
        throw new Error('Even Weight decode: Input must have at least 2 bits');
      }

      // Check if weight is even
      let weight = 0;
      for (let i = 0; i < data.length; ++i) {
        weight += data[i];
      }

      if (weight % 2 !== 0) {
        console.warn('Even Weight Code: Odd weight detected - error present');
      }

      // Remove parity bit
      return data.slice(0, -1);
    }

    DetectError(data) {
      if (data.length < 2) return true;

      // Check if weight is even
      let weight = 0;
      for (let i = 0; i < data.length; ++i) {
        weight += data[i];
      }

      return (weight % 2 !== 0);
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new EvenWeightCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { EvenWeightCodeAlgorithm, EvenWeightCodeInstance };
}));
