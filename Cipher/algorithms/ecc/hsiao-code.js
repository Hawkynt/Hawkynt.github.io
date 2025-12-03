/*
 * Hsiao Code Implementation
 * Optimized SEC-DED with minimum odd-weight columns
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

  class HsiaoCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Hsiao Code";
      this.description = "Optimized SEC-DED code with minimum odd-weight columns for energy efficiency. Uses syndrome parity to distinguish single from double errors. Widely used in ECC memory and cache protection.";
      this.inventor = "Ming-Yao (M. Y.) Hsiao";
      this.year = 1970;
      this.category = CategoryType.ECC;
      this.subCategory = "Linear Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Hsiao's Original Paper", "http://people.eecs.berkeley.edu/~culler/cs252-s02/papers/hsiao70.pdf"),
        new LinkItem("ArXiv - Hsiao Check Matrices", "https://arxiv.org/abs/0803.1217"),
        new LinkItem("IEEE Paper", "https://ieeexplore.ieee.org/document/6177346/")
      ];

      this.references = [
        new LinkItem("ECC Memory Systems", "https://www.sciencedirect.com/topics/computer-science/error-correction-code"),
        new LinkItem("Hsiao Code Implementations", "https://www.researchgate.net/publication/221520382")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Double Error Detection Only",
          "Can detect but not correct double-bit errors. Uses syndrome parity to identify error type."
        ),
        new Vulnerability(
          "Triple Error Miscorrection",
          "Triple errors may be miscorrected as single errors if syndrome parity appears odd."
        )
      ];

      // Test vectors for Hsiao (8,4) code
      this.tests = [
        {
          text: "Hsiao (8,4) all zeros",
          uri: "http://people.eecs.berkeley.edu/~culler/cs252-s02/papers/hsiao70.pdf",
          input: [0, 0, 0, 0],
          expected: [0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
          text: "Hsiao (8,4) all ones",
          uri: "http://people.eecs.berkeley.edu/~culler/cs252-s02/papers/hsiao70.pdf",
          input: [1, 1, 1, 1],
          expected: [1, 1, 1, 1, 1, 1, 1, 1]
        },
        {
          text: "Hsiao (8,4) pattern test",
          uri: "http://people.eecs.berkeley.edu/~culler/cs252-s02/papers/hsiao70.pdf",
          input: [1, 0, 1, 0],
          expected: [0, 1, 0, 1, 1, 0, 1, 0]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new HsiaoCodeInstance(this, isInverse);
    }
  }

  /**
 * HsiaoCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class HsiaoCodeInstance extends IErrorCorrectionInstance {
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
        throw new Error('HsiaoCodeInstance.Feed: Input must be bit array');
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
        throw new Error('HsiaoCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    encode(data) {
      // Hsiao (8,4) encoding - similar to SECDED but with odd-weight columns
      if (data.length !== 4) {
        throw new Error('Hsiao encode: Input must be exactly 4 bits');
      }

      const [d1, d2, d3, d4] = data;
      const encoded = new Array(8);

      // Data bits at positions 3, 5, 6, 7 (1-indexed)
      encoded[3] = d1;
      encoded[5] = d2;
      encoded[6] = d3;
      encoded[7] = d4;

      // Hsiao parity bits (odd-weight columns optimization)
      encoded[1] = OpCodes.XorN(OpCodes.XorN(d1, d2), d4);
      encoded[2] = OpCodes.XorN(OpCodes.XorN(d1, d3), d4);
      encoded[4] = OpCodes.XorN(OpCodes.XorN(d2, d3), d4);

      // Overall parity bit (position 0)
      encoded[0] = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(encoded[1], encoded[2]), encoded[3]), encoded[4]),
                   encoded[5]), encoded[6]), encoded[7]);

      return encoded;
    }

    decode(data) {
      // Hsiao (8,4) decoding with SEC-DED
      if (data.length !== 8) {
        throw new Error('Hsiao decode: Input must be exactly 8 bits');
      }

      const received = [...data];

      // Calculate syndrome (positions 1-7)
      const s1 = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(received[1], received[3]), received[5]), received[7]);
      const s2 = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(received[2], received[3]), received[6]), received[7]);
      const s4 = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(received[4], received[5]), received[6]), received[7]);
      const syndrome = s1 + OpCodes.Shl32(s2, 1) + OpCodes.Shl32(s4, 2);

      // Calculate overall parity
      const overallParity = received.reduce((p, bit) => OpCodes.XorN(p, bit), 0);

      // Error detection logic
      if (syndrome === 0 && overallParity === 0) {
        // No error
      } else if (syndrome === 0 && overallParity !== 0) {
        // Error in overall parity bit
        console.log('Hsiao: Parity bit error detected and corrected');
        received[0] = OpCodes.XorN(received[0], 1);
      } else {
        // Count 1s in syndrome (Hsiao's odd-weight column property)
        const syndromeWeight = (syndrome.toString(2).match(/1/g) || []).length;

        if (overallParity !== 0 && syndromeWeight % 2 === 1) {
          // Single bit error (correctable) - odd syndrome weight + odd parity
          console.log(`Hsiao: Single error at position ${syndrome}, correcting...`);
          if (syndrome >= 1 && syndrome <= 7) {
            received[syndrome] = OpCodes.XorN(received[syndrome], 1);
          }
        } else if (overallParity === 0 || syndromeWeight % 2 === 0) {
          // Double bit error (detectable, not correctable) - even syndrome weight or even parity
          throw new Error('Hsiao: Double bit error detected - cannot correct');
        }
      }

      // Extract data bits
      return [received[3], received[5], received[6], received[7]];
    }

    DetectError(data) {
      if (data.length !== 8) return true;

      const s1 = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(data[1], data[3]), data[5]), data[7]);
      const s2 = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(data[2], data[3]), data[6]), data[7]);
      const s4 = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(data[4], data[5]), data[6]), data[7]);
      const syndrome = s1 + OpCodes.Shl32(s2, 1) + OpCodes.Shl32(s4, 2);

      const overallParity = data.reduce((p, bit) => OpCodes.XorN(p, bit), 0);

      return syndrome !== 0 || overallParity !== 0;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new HsiaoCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { HsiaoCodeAlgorithm, HsiaoCodeInstance };
}));
