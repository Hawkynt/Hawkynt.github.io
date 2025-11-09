/*
 * Dual Hamming Code (Simplex Code) Implementation
 * Dual of Hamming (7,4) code yields Simplex (7,3) code
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

  class DualHammingAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Dual Hamming Code";
      this.description = "Dual code of Hamming (7,4) yielding Simplex (7,3) code. Generator matrix of dual is parity-check matrix of original. All non-zero codewords have constant Hamming weight 4. Demonstrates duality principle: dual of [n,k,d] code is [n,n-k,d_perp]. Educational example of code duality.";
      this.inventor = "Richard Hamming (original), Dual concept classical";
      this.year = 1950;
      this.category = CategoryType.ECC;
      this.subCategory = "Dual Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Dual Code", "https://en.wikipedia.org/wiki/Dual_code"),
        new LinkItem("Error Correction Zoo", "https://errorcorrectionzoo.org/c/dual"),
        new LinkItem("Linear Code Duality", "https://users.physics.ox.ac.uk/~Steane/qec/qec_ams_6.html")
      ];

      this.references = [
        new LinkItem("Self-Dual Codes", "https://errorcorrectionzoo.org/c/self_dual"),
        new LinkItem("Hamming Code", "https://en.wikipedia.org/wiki/Hamming_code"),
        new LinkItem("Code Theory Basics", "https://cs-people.bu.edu/mbun/courses/599_S22/notes/lec19.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Lower Rate",
          "Dual code has rate k/n where original has (n-k)/n. Hamming (7,4) rate 4/7 → Dual rate 3/7."
        ),
        new Vulnerability(
          "Different Properties",
          "Dual may have different error correction capabilities than original code."
        )
      ];

      // Test vectors for Dual Hamming (7,3) - which is Simplex (7,3)
      this.tests = [
        {
          text: "Dual Hamming (7,3) all zeros",
          uri: "https://en.wikipedia.org/wiki/Dual_code",
          input: [0, 0, 0],
          expected: [0, 0, 0, 0, 0, 0, 0]
        },
        {
          text: "Dual Hamming (7,3) pattern 001",
          uri: "https://en.wikipedia.org/wiki/Dual_code",
          input: [0, 0, 1],
          expected: [0, 0, 0, 1, 1, 1, 1]
        },
        {
          text: "Dual Hamming (7,3) pattern 010",
          uri: "https://en.wikipedia.org/wiki/Dual_code",
          input: [0, 1, 0],
          expected: [0, 1, 1, 0, 0, 1, 1]
        },
        {
          text: "Dual Hamming (7,3) pattern 100",
          uri: "https://en.wikipedia.org/wiki/Dual_code",
          input: [1, 0, 0],
          expected: [1, 0, 1, 0, 1, 0, 1]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DualHammingInstance(this, isInverse);
    }
  }

  class DualHammingInstance extends IErrorCorrectionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;

      // Generator matrix for Dual Hamming (7,3)
      // This is the parity-check matrix of Hamming (7,4)
      this.generator = [
        [1, 0, 1, 0, 1, 0, 1],  // Positions with bit 0 set
        [0, 1, 1, 0, 0, 1, 1],  // Positions with bit 1 set
        [0, 0, 0, 1, 1, 1, 1]   // Positions with bit 2 set
      ];
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('DualHammingInstance.Feed: Input must be bit array');
      }

      if (this.isInverse) {
        this.result = this.decode(data);
      } else {
        this.result = this.encode(data);
      }
    }

    Result() {
      if (this.result === null) {
        throw new Error('DualHammingInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    encode(data) {
      if (data.length !== 3) {
        throw new Error('Dual Hamming encode: Input must be exactly 3 bits');
      }

      // Matrix multiplication: c = m * G
      const codeword = new Array(7).fill(0);

      for (let i = 0; i < 7; ++i) {
        let sum = 0;
        for (let j = 0; j < 3; ++j) {
          sum ^= (data[j] & this.generator[j][i]);
        }
        codeword[i] = sum;
      }

      return codeword;
    }

    decode(data) {
      if (data.length !== 7) {
        throw new Error('Dual Hamming decode: Input must be exactly 7 bits');
      }

      // Decoding using correlation (maximum likelihood)
      // Try all 2^3 = 8 possible messages
      let maxCorr = -Infinity;
      let bestMessage = [0, 0, 0];

      for (let m = 0; m < 8; ++m) {
        const message = [(m >> 2) & 1, (m >> 1) & 1, m & 1];

        // Encode this message
        const testCodeword = this.encode(message);

        // Calculate correlation (Hamming distance)
        let correlation = 0;
        for (let i = 0; i < 7; ++i) {
          correlation += (data[i] === testCodeword[i]) ? 1 : -1;
        }

        if (correlation > maxCorr) {
          maxCorr = correlation;
          bestMessage = message;
        }
      }

      return bestMessage;
    }

    DetectError(data) {
      if (data.length !== 7) return true;

      try {
        const decoded = this.decode(data);
        const reencoded = this.encode(decoded);

        for (let i = 0; i < 7; ++i) {
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

  const algorithmInstance = new DualHammingAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DualHammingAlgorithm, DualHammingInstance };
}));
