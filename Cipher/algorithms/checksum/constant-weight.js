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

      this.notes = [
        "Result() returns the codeword unchanged; this class checks a codeword, it does not encode one.",
        "A weight violation is only reported on the console, so callers cannot act on it - use DetectError() instead, which does return a verdict.",
        "Because Result() carries no verdict, an invalid codeword cannot be expressed as a test vector."
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

      // Test vectors for constant weight codes.
      //
      // These previously carried expected: true / expected: false. A boolean has
      // no length, so the test engine classified every one of them as having no
      // expected value and passed it unconditionally - the vectors asserted
      // nothing at all. They now carry the codeword that Result() is defined to
      // hand back, so a length or weight violation is actually caught.
      //
      // The former "3-of-5 code invalid" vector has been dropped rather than
      // silently kept: this implementation only inspects the weight, it does not
      // report a verdict a vector could compare against, so an invalid codeword
      // cannot be expressed as a test at all. See the notes below.
      this.tests = [
        {
          text: "3-of-5 codeword with weight 3 (0 1 0 1 1)",
          uri: "https://en.wikipedia.org/wiki/Constant-weight_code",
          weight: 3,
          length: 5,
          input: [0, 1, 0, 1, 1],
          expected: [0, 1, 0, 1, 1]
        },
        {
          text: "3-of-5 codeword with weight 3 (1 1 1 0 0)",
          uri: "https://en.wikipedia.org/wiki/Constant-weight_code",
          weight: 3,
          length: 5,
          input: [1, 1, 1, 0, 0],
          expected: [1, 1, 1, 0, 0]
        },
        {
          text: "2-of-4 codeword with weight 2 (1 0 1 0)",
          uri: "https://errorcorrectionzoo.org/c/constant_weight",
          weight: 2,
          length: 4,
          input: [1, 0, 1, 0],
          expected: [1, 0, 1, 0]
        },
        {
          text: "2-of-4 codeword with weight 2 (0 1 0 1)",
          uri: "https://errorcorrectionzoo.org/c/constant_weight",
          weight: 2,
          length: 4,
          input: [0, 1, 0, 1],
          expected: [0, 1, 0, 1]
        }
      ];
    }

    /**
   * Create new checking instance
   * @param {boolean} [isInverse=false] - Checking has no inverse
   * @returns {ConstantWeightCodeInstance} New instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new ConstantWeightCodeInstance(this, isInverse);
    }
  }

  /**
 * ConstantWeightCode instance implementing the Feed/Result pattern
 * @class
 * @extends {IErrorCorrectionInstance}
 */

  class ConstantWeightCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize a checking instance for the 3-of-5 code
   * @param {ConstantWeightCodeAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]} The codeword fed last, null before the first Feed */
      this.result = null;

      // Default: 3-of-5 code
      /** @type {int32} */
      this._weight = 3; // Required number of 1-bits
      /** @type {int32} */
      this._length = 5; // Total codeword length
    }

    /**
     * Required number of 1-bits
     * @param {int32} w - Weight, 0..32
     * @throws {Error} If the weight is out of range
     */
    set weight(w) {
      if (w < 0 || w > 32) {
        throw new Error('ConstantWeightCodeInstance.weight: Must be between 0 and 32');
      }
      this._weight = w;
    }

    /**
     * Required number of 1-bits
     * @returns {int32} Weight
     */
    get weight() {
      return this._weight;
    }

    /**
     * Codeword length in bits
     * @param {int32} len - Length, 1..64
     * @throws {Error} If the length is out of range
     */
    set length(len) {
      if (len < 1 || len > 64) {
        throw new Error('ConstantWeightCodeInstance.length: Must be between 1 and 64');
      }
      this._length = len;
    }

    /**
     * Codeword length in bits
     * @returns {int32} Length
     */
    get length() {
      return this._length;
    }

    /**
   * Feed one codeword to check
   * @param {uint8[]} data - Codeword bits (0/1)
   * @throws {Error} If the input is not an array or has the wrong length
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
   * Get the codeword fed last (unchanged)
   * @returns {uint8[]} The codeword
   * @throws {Error} If no data was fed
   */

    Result() {
      if (this.result === null) {
        throw new Error('ConstantWeightCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    /**
     * Number of 1-bits in a codeword
     * @param {uint8[]} data - Codeword bits
     * @returns {int32} Sum of the elements
     */
    _hammingWeight(data) {
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      return sum;
    }

    /**
     * Check a codeword's length and weight; a weight violation is only logged
     * @param {uint8[]} data - Codeword bits
     * @returns {uint8[]} The codeword, unchanged
     * @throws {Error} If the length is wrong
     */
    validate(data) {
      // Check if codeword has correct weight
      if (data.length !== this._length) {
        throw new Error('Constant weight code: Expected length ' + this._length + ', got ' + data.length);
      }

      const hammingWeight = this._hammingWeight(data);
      const isValid = hammingWeight === this._weight;

      if (!isValid) {
        console.warn('Constant weight code: Invalid weight ' + hammingWeight + ', expected ' + this._weight);
      }

      return data; // Return original data with validation status
    }

    /**
     * Alias for validate in inverse mode
     * @param {uint8[]} data - Codeword bits
     * @returns {uint8[]} The codeword, unchanged
     */
    verify(data) {
      // Alias for validate in inverse mode
      return this.validate(data);
    }

    /**
     * Whether a codeword violates the code
     * @param {uint8[]} data - Codeword bits
     * @returns {boolean} True if the length or the weight is wrong
     */
    DetectError(data) {
      if (data.length !== this._length) return true;

      const hammingWeight = this._hammingWeight(data);
      return hammingWeight !== this._weight;
    }

    /**
     * Generate all valid m-of-n codewords
     * @returns {uint8[][]} Every codeword, in lexicographic order of the 1-bit positions
     */
    generateCodewords() {
      // Generate all combinations of m positions out of n
      /** @type {int32[]} */
      const none = new Array(0);
      return this._generateCodewords(none, 0, 0);
    }

    /**
     * All codewords whose first 1-bit positions are the given ones
     * @param {int32[]} current - Positions chosen so far
     * @param {int32} start - First position still available
     * @param {int32} count - Number of positions chosen so far
     * @returns {uint8[][]} The completed codewords, in lexicographic order of the positions
     */
    _generateCodewords(current, start, count) {
      const len = this._length;
      const weight = this._weight;
      /** @type {uint8[][]} */
      let found = new Array(0);

      if (count === weight) {
        /** @type {uint8[]} */
        const bits = new Array(len);
        for (let i = 0; i < len; ++i) bits[i] = 0;
        for (let i = 0; i < current.length; ++i) {
          bits[current[i]] = 1;
        }
        found.push(bits);
        return found;
      }

      for (let i = start; i <= len - (weight - count); ++i) {
        /** @type {int32[]} */
        const next = current.concat([i]);
        found = found.concat(this._generateCodewords(next, i + 1, count + 1));
      }
      return found;
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
