/*
 * Constant Weight Code (m-of-n) Implementation
 * Error detection using fixed Hamming weight
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

  class ConstantWeightCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Constant Weight Code";
      this.description = "Error detection code where all valid codewords have the same Hamming weight (m-of-n codes). Can detect all unidirectional errors by verifying constant number of 1-bits. Used in balanced transmission and self-checking circuits.";
      this.inventor = "Unknown (Coding Theory Concept)";
      this.year = 1960;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Unidirectional Error Detection";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Constant Weight Code", "https://en.wikipedia.org/wiki/Constant-weight_code"),
        new LinkItem("Error Correction Zoo", "https://errorcorrectionzoo.org/c/constant_weight"),
        new LinkItem("IEEE Paper on CW Codes", "https://ieeexplore.ieee.org/document/669415")
      ];

      this.references = [
        new LinkItem("Single Error Correction", "https://ieeexplore.ieee.org/abstract/document/1053719"),
        new LinkItem("Classification of CW Codes", "https://www.researchgate.net/publication/224155507_Classification_of_Binary_Constant_Weight_Codes")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "No Error Correction",
          "Constant weight codes can only detect errors, not correct them (basic variant)."
        ),
        new Vulnerability(
          "Limited Code Space",
          "Only C(n,m) valid codewords exist, limiting information capacity."
        )
      ];

      // Test vectors for constant weight codes
      this.tests = [
        {
          text: "3-of-5 code example 1",
          uri: "https://en.wikipedia.org/wiki/Constant-weight_code",
          weight: 3,
          length: 5,
          input: [0, 1, 0, 1, 1], // Valid: 3 ones
          expected: true
        },
        {
          text: "3-of-5 code example 2",
          uri: "https://en.wikipedia.org/wiki/Constant-weight_code",
          weight: 3,
          length: 5,
          input: [1, 1, 1, 0, 0], // Valid: 3 ones
          expected: true
        },
        {
          text: "3-of-5 code invalid",
          uri: "https://en.wikipedia.org/wiki/Constant-weight_code",
          weight: 3,
          length: 5,
          input: [1, 1, 0, 0, 0], // Invalid: 2 ones
          expected: false
        },
        {
          text: "2-of-4 code valid",
          uri: "https://errorcorrectionzoo.org/c/constant_weight",
          weight: 2,
          length: 4,
          input: [1, 0, 1, 0], // Valid: 2 ones
          expected: true
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new ConstantWeightCodeInstance(this, isInverse);
    }
  }

  /**
 * ConstantWeightCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ConstantWeightCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;

      // Default: 3-of-5 code
      this._weight = 3; // Required number of 1-bits
      this._length = 5; // Total codeword length
    }

    set weight(w) {
      if (w < 0 || w > 32) {
        throw new Error('ConstantWeightCodeInstance.weight: Must be between 0 and 32');
      }
      this._weight = w;
    }

    get weight() {
      return this._weight;
    }

    set length(len) {
      if (len < 1 || len > 64) {
        throw new Error('ConstantWeightCodeInstance.length: Must be between 1 and 64');
      }
      this._length = len;
    }

    get length() {
      return this._length;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('ConstantWeightCodeInstance.Feed: Input must be bit array');
      }

      if (this.isInverse) {
        this.result = this.verify(data);
      } else {
        this.result = this.validate(data);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.result === null) {
        throw new Error('ConstantWeightCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    validate(data) {
      // Check if codeword has correct weight
      if (data.length !== this._length) {
        throw new Error(`Constant weight code: Expected length ${this._length}, got ${data.length}`);
      }

      const hammingWeight = data.reduce((sum, bit) => sum + bit, 0);
      const isValid = hammingWeight === this._weight;

      if (!isValid) {
        console.warn(`Constant weight code: Invalid weight ${hammingWeight}, expected ${this._weight}`);
      }

      return data; // Return original data with validation status
    }

    verify(data) {
      // Alias for validate in inverse mode
      return this.validate(data);
    }

    DetectError(data) {
      if (data.length !== this._length) return true;

      const hammingWeight = data.reduce((sum, bit) => sum + bit, 0);
      return hammingWeight !== this._weight;
    }

    // Helper: Generate all valid m-of-n codewords
    generateCodewords() {
      const codewords = [];
      const n = this._length;
      const m = this._weight;

      // Generate all combinations of m positions out of n
      const generate = (current, start, count) => {
        if (count === m) {
          const codeword = new Array(n).fill(0);
          for (const pos of current) {
            codeword[pos] = 1;
          }
          codewords.push(codeword);
          return;
        }

        for (let i = start; i <= n - (m - count); ++i) {
          generate([...current, i], i + 1, count + 1);
        }
      };

      generate([], 0, 0);
      return codewords;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new ConstantWeightCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ConstantWeightCodeAlgorithm, ConstantWeightCodeInstance };
}));
