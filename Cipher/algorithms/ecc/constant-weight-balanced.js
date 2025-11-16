/*
 * Constant Weight Code Implementation
 * All codewords have same Hamming weight (number of 1s)
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
      this.name = "Balanced Constant Weight Code";
      this.description = "All codewords have same Hamming weight (constant number of 1s). Parameters A(n,d,w) denote maximum codewords of length n, minimum distance d, and constant weight w. Used in optical communications, magnetic recording, and frequency-hopping systems. Can correct errors by exploiting weight property.";
      this.inventor = "Various (classical construction)";
      this.year = 1960;
      this.category = CategoryType.ECC;
      this.subCategory = "Constant Weight Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = null;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Constant Weight", "https://en.wikipedia.org/wiki/Constant-weight_code"),
        new LinkItem("Error Correction Zoo", "https://errorcorrectionzoo.org/c/constant_weight"),
        new LinkItem("Bounds Tables", "http://www.mi.ic.ac.uk/~dmartin/cwcodes.html")
      ];

      this.references = [
        new LinkItem("Combinatorial Bounds", "https://ieeexplore.ieee.org/document/1054245"),
        new LinkItem("Optical Communications", "https://ieeexplore.ieee.org/document/1055187"),
        new LinkItem("Construction Methods", "https://link.springer.com/article/10.1007/BF01072842")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Limited Message Space",
          "Number of valid codewords limited to C(n,w), restricting information capacity."
        ),
        new Vulnerability(
          "Weight Requirement",
          "Input messages must be encoded to maintain constant weight property."
        )
      ];

      // Test vectors for Constant Weight codes
      // Using (5,3,2) code: length 5, weight 2, distance 2
      this.tests = [
        {
          text: "CW (5,2) weight-2 pattern 11000",
          uri: "https://en.wikipedia.org/wiki/Constant-weight_code",
          n: 5,
          w: 2,
          input: [1, 1, 0, 0, 0],
          expected: [1, 1, 0, 0, 0]
        },
        {
          text: "CW (5,2) weight-2 pattern 10100",
          uri: "https://en.wikipedia.org/wiki/Constant-weight_code",
          n: 5,
          w: 2,
          input: [1, 0, 1, 0, 0],
          expected: [1, 0, 1, 0, 0]
        },
        {
          text: "CW (6,3) weight-3 pattern 111000",
          uri: "https://en.wikipedia.org/wiki/Constant-weight_code",
          n: 6,
          w: 3,
          input: [1, 1, 1, 0, 0, 0],
          expected: [1, 1, 1, 0, 0, 0]
        },
        {
          text: "CW (6,3) weight-3 pattern 101010",
          uri: "https://en.wikipedia.org/wiki/Constant-weight_code",
          n: 6,
          w: 3,
          input: [1, 0, 1, 0, 1, 0],
          expected: [1, 0, 1, 0, 1, 0]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
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
      this._n = 5; // Default length
      this._w = 2; // Default weight
    }

    set n(value) {
      if (value < 1) {
        throw new Error('ConstantWeightCodeInstance.n: Must be at least 1');
      }
      this._n = value;
    }

    get n() {
      return this._n;
    }

    set w(value) {
      if (value < 0 || value > this._n) {
        throw new Error(`ConstantWeightCodeInstance.w: Must be between 0 and ${this._n}`);
      }
      this._w = value;
    }

    get w() {
      return this._w;
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
        throw new Error('ConstantWeightCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    calculateWeight(data) {
      let weight = 0;
      for (let i = 0; i < data.length; ++i) {
        weight += data[i];
      }
      return weight;
    }

    encode(data) {
      if (data.length !== this._n) {
        throw new Error(`Constant Weight encode: Input must be exactly ${this._n} bits`);
      }

      const weight = this.calculateWeight(data);

      if (weight !== this._w) {
        throw new Error(`Constant Weight encode: Input weight ${weight} doesn't match required weight ${this._w}`);
      }

      // Constant weight codes are systematic - codeword equals message
      return [...data];
    }

    decode(data) {
      if (data.length !== this._n) {
        throw new Error(`Constant Weight decode: Input must be exactly ${this._n} bits`);
      }

      const weight = this.calculateWeight(data);

      if (weight !== this._w) {
        console.warn(`Constant Weight: Weight ${weight} doesn't match expected ${this._w} - error detected`);
      }

      // Return received word (real decoder would correct to nearest valid codeword)
      return [...data];
    }

    DetectError(data) {
      if (data.length !== this._n) return true;

      const weight = this.calculateWeight(data);
      return (weight !== this._w);
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
