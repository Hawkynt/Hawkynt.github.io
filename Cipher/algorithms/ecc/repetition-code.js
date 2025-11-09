/*
 * Repetition Code Implementation
 * Simplest error correction code - repeats each bit n times
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

  class RepetitionCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Repetition Code";
      this.description = "Simplest error correction code that repeats each bit n times. Decoding uses majority voting to recover the original bit. Can correct up to floor((n-1)/2) errors per codeword. Very low code rate but simple implementation.";
      this.inventor = "Unknown (Fundamental Concept)";
      this.year = 1940;
      this.category = CategoryType.ECC;
      this.subCategory = "Block Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Repetition Code", "https://en.wikipedia.org/wiki/Repetition_code"),
        new LinkItem("Error Correction Zoo", "https://errorcorrectionzoo.org/c/repetition"),
        new LinkItem("MIT Lecture Notes", "https://web.mit.edu/6.02/www/f2011/handouts/7.pdf")
      ];

      this.references = [
        new LinkItem("Majority Logic Decoding", "https://en.wikipedia.org/wiki/Majority_logic_decoding"),
        new LinkItem("Code Rate Analysis", "https://www.sciencedirect.com/topics/computer-science/repetition-code")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Very Low Code Rate",
          "For n=3 repetition, code rate is only 1/3, wasting significant bandwidth."
        ),
        new Vulnerability(
          "Limited Error Correction",
          "Can only correct minority errors. If majority of bits are corrupted, decoding fails."
        )
      ];

      // Test vectors for (3,1) repetition code
      this.tests = [
        {
          text: "Repetition (3,1) bit 0",
          uri: "https://en.wikipedia.org/wiki/Repetition_code",
          repetitions: 3,
          input: [0],
          expected: [0, 0, 0]
        },
        {
          text: "Repetition (3,1) bit 1",
          uri: "https://en.wikipedia.org/wiki/Repetition_code",
          repetitions: 3,
          input: [1],
          expected: [1, 1, 1]
        },
        {
          text: "Repetition (3,1) multi-bit",
          uri: "https://en.wikipedia.org/wiki/Repetition_code",
          repetitions: 3,
          input: [1, 0, 1],
          expected: [1, 1, 1, 0, 0, 0, 1, 1, 1]
        },
        {
          text: "Repetition (5,1) bit 1",
          uri: "https://en.wikipedia.org/wiki/Repetition_code",
          repetitions: 5,
          input: [1],
          expected: [1, 1, 1, 1, 1]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new RepetitionCodeInstance(this, isInverse);
    }
  }

  class RepetitionCodeInstance extends IErrorCorrectionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;
      this._repetitions = 3; // Default (3,1) code
    }

    set repetitions(n) {
      if (n < 3 || n > 15 || n % 2 === 0) {
        throw new Error('RepetitionCodeInstance.repetitions: Must be odd number between 3 and 15');
      }
      this._repetitions = n;
    }

    get repetitions() {
      return this._repetitions;
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('RepetitionCodeInstance.Feed: Input must be bit array');
      }

      if (this.isInverse) {
        this.result = this.decode(data);
      } else {
        this.result = this.encode(data);
      }
    }

    Result() {
      if (this.result === null) {
        throw new Error('RepetitionCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    encode(data) {
      // Repeat each bit n times
      const encoded = [];
      for (let i = 0; i < data.length; ++i) {
        for (let j = 0; j < this._repetitions; ++j) {
          encoded.push(data[i]);
        }
      }
      return encoded;
    }

    decode(data) {
      // Majority voting decoding
      const n = this._repetitions;

      if (data.length % n !== 0) {
        throw new Error(`Repetition decode: Input length must be multiple of ${n}`);
      }

      const decoded = [];
      const threshold = Math.floor(n / 2) + 1;

      for (let i = 0; i < data.length; i += n) {
        // Count ones in this block
        let onesCount = 0;
        for (let j = 0; j < n; ++j) {
          if (data[i + j] === 1) {
            ++onesCount;
          }
        }

        // Majority vote
        decoded.push(onesCount >= threshold ? 1 : 0);

        // Error detection
        if (onesCount !== 0 && onesCount !== n) {
          console.log(`Repetition: Error detected in block ${i / n} (${onesCount}/${n} ones)`);
        }
      }

      return decoded;
    }

    DetectError(data) {
      const n = this._repetitions;
      if (data.length % n !== 0) return true;

      // Check if any block has mixed bits (not all 0s or all 1s)
      for (let i = 0; i < data.length; i += n) {
        let onesCount = 0;
        for (let j = 0; j < n; ++j) {
          if (data[i + j] === 1) {
            ++onesCount;
          }
        }

        // If not all zeros and not all ones, error detected
        if (onesCount !== 0 && onesCount !== n) {
          return true;
        }
      }

      return false;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new RepetitionCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RepetitionCodeAlgorithm, RepetitionCodeInstance };
}));
