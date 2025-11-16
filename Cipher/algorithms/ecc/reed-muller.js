/*
 * Reed-Muller Code Implementation
 * First-order Reed-Muller codes (biorthogonal codes)
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

  class ReedMullerAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Reed-Muller Code";
      this.description = "First-order Reed-Muller codes RM(1,m) with parameters [2^m, 1+m, 2^(m-1)]. Closely related to Hadamard codes and biorthogonal codes. Simple decoding using majority logic. Used in wireless communications and deep-space missions.";
      this.inventor = "David E. Muller, Irving S. Reed";
      this.year = 1954;
      this.category = CategoryType.ECC;
      this.subCategory = "Linear Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Reed-Muller Code", "https://en.wikipedia.org/wiki/Reed–Muller_code"),
        new LinkItem("Error Correction Zoo", "https://errorcorrectionzoo.org/c/reed_muller"),
        new LinkItem("Tutorial PDF", "http://pfister.ee.duke.edu/courses/ece590_ecc/rm.pdf")
      ];

      this.references = [
        new LinkItem("ArXiv - Theory and Algorithms", "https://arxiv.org/pdf/2002.03317"),
        new LinkItem("Testing Reed-Muller Codes", "https://www.researchgate.net/publication/3084486_Testing_Reed-Muller_Codes"),
        new LinkItem("MAP Decoding", "https://www.researchgate.net/publication/3085113_Simple_MAP_Decoding_of_First-Order_Reed-Muller_and_Hamming_Codes")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Low Code Rate",
          "First-order RM codes have low code rate (1+m)/2^m, decreasing with larger m."
        ),
        new Vulnerability(
          "Fixed Block Lengths",
          "Block length must be a power of 2, limiting flexibility."
        )
      ];

      // Test vectors for RM(1,3) - [8, 4, 4] code
      this.tests = [
        {
          text: "RM(1,3) all zeros",
          uri: "https://en.wikipedia.org/wiki/Reed–Muller_code",
          input: [0, 0, 0, 0],
          expected: [0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
          text: "RM(1,3) all ones",
          uri: "https://en.wikipedia.org/wiki/Reed–Muller_code",
          input: [1, 1, 1, 1],
          expected: [1, 0, 0, 1, 0, 1, 1, 0]
        },
        {
          text: "RM(1,3) pattern test",
          uri: "https://en.wikipedia.org/wiki/Reed–Muller_code",
          input: [1, 0, 0, 0],
          expected: [1, 1, 1, 1, 1, 1, 1, 1]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new ReedMullerInstance(this, isInverse);
    }
  }

  /**
 * ReedMuller cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ReedMullerInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;
      this._m = 3; // Default RM(1,3) - [8,4,4] code
    }

    set m(value) {
      if (value < 2 || value > 5) {
        throw new Error('ReedMullerInstance.m: Must be between 2 and 5');
      }
      this._m = value;
    }

    get m() {
      return this._m;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('ReedMullerInstance.Feed: Input must be bit array');
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
        throw new Error('ReedMullerInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    encode(data) {
      const m = this._m;
      const n = 1 << m; // 2^m
      const k = 1 + m; // First-order RM has k = 1 + m data bits

      if (data.length !== k) {
        throw new Error(`Reed-Muller encode: Input must be exactly ${k} bits for RM(1,${m})`);
      }

      // RM(1,m) generator matrix construction
      // First row is all ones (constant term)
      // Remaining rows are indicator functions for each variable

      const codeword = new Array(n).fill(0);

      // Constant term (data[0])
      if (data[0] === 1) {
        for (let i = 0; i < n; ++i) {
          codeword[i] ^= 1;
        }
      }

      // Linear terms (data[1] through data[m])
      for (let var_idx = 0; var_idx < m; ++var_idx) {
        if (data[1 + var_idx] === 1) {
          // For variable var_idx, set bits where that variable is 1
          for (let i = 0; i < n; ++i) {
            if ((i >> (m - 1 - var_idx)) & 1) {
              codeword[i] ^= 1;
            }
          }
        }
      }

      return codeword;
    }

    decode(data) {
      const m = this._m;
      const n = 1 << m;
      const k = 1 + m;

      if (data.length !== n) {
        throw new Error(`Reed-Muller decode: Input must be exactly ${n} bits for RM(1,${m})`);
      }

      const decoded = new Array(k).fill(0);

      // Majority logic decoding
      // Decode constant term (sum all bits)
      let sum = data.reduce((acc, bit) => acc + bit, 0);
      decoded[0] = sum > (n / 2) ? 1 : 0;

      // Decode each variable using indicator functions
      for (let var_idx = 0; var_idx < m; ++var_idx) {
        let count0 = 0, count1 = 0;

        for (let i = 0; i < n; ++i) {
          if ((i >> (m - 1 - var_idx)) & 1) {
            count1 += data[i];
          } else {
            count0 += data[i];
          }
        }

        // Majority vote
        const diff = count1 - count0;
        decoded[1 + var_idx] = diff > 0 ? 1 : 0;
      }

      return decoded;
    }

    DetectError(data) {
      const n = 1 << this._m;
      if (data.length !== n) return true;

      try {
        const decoded = this.decode(data);
        const tempInstance = new ReedMullerInstance(this.algorithm, false);
        tempInstance.m = this._m;
        tempInstance.Feed(decoded);
        const reencoded = tempInstance.Result();

        for (let i = 0; i < n; ++i) {
          if (data[i] !== reencoded[i]) {
            return true;
          }
        }
        return false;
      } catch (e) {
        return true;
      }
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new ReedMullerAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ReedMullerAlgorithm, ReedMullerInstance };
}));
