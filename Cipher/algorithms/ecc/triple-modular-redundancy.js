/*
 * Triple Modular Redundancy (TMR) Implementation
 * Simplest fault-tolerant voting system with three copies
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

  class TripleModularRedundancyAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Triple Modular Redundancy";
      this.description = "Simplest fault-tolerant system replicating data three times and using majority voting for error correction. Can correct single-bit errors per triplicate. Code rate 1/3. Widely used in safety-critical systems including spacecraft, nuclear reactors, and medical devices. Simple but effective.";
      this.inventor = "Unknown (classical technique)";
      this.year = 1950;
      this.category = CategoryType.ECC;
      this.subCategory = "Redundancy Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - TMR", "https://en.wikipedia.org/wiki/Triple_modular_redundancy"),
        new LinkItem("Fault Tolerance", "https://www.tutorialspoint.com/fault-tolerant-systems"),
        new LinkItem("Redundancy Techniques", "https://www.ece.cmu.edu/~koopman/des_s99/tmr/")
      ];

      this.references = [
        new LinkItem("TMR in Space Systems", "https://ntrs.nasa.gov/citations/19830013696"),
        new LinkItem("Voting Systems", "https://ieeexplore.ieee.org/document/1675745"),
        new LinkItem("Safety-Critical Applications", "https://www.sciencedirect.com/topics/engineering/triple-modular-redundancy")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Low Code Rate",
          "Code rate is only 1/3 (200% overhead), extremely inefficient."
        ),
        new Vulnerability(
          "Single Point of Failure",
          "The voter itself can be a single point of failure requiring voter redundancy."
        )
      ];

      // Test vectors for TMR
      this.tests = [
        {
          text: "TMR all zeros",
          uri: "https://en.wikipedia.org/wiki/Triple_modular_redundancy",
          input: [0, 0, 0, 0],
          expected: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
          text: "TMR all ones",
          uri: "https://en.wikipedia.org/wiki/Triple_modular_redundancy",
          input: [1, 1, 1, 1],
          expected: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        },
        {
          text: "TMR pattern 1010",
          uri: "https://en.wikipedia.org/wiki/Triple_modular_redundancy",
          input: [1, 0, 1, 0],
          expected: [1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0]
        },
        {
          text: "TMR single bit",
          uri: "https://en.wikipedia.org/wiki/Triple_modular_redundancy",
          input: [1],
          expected: [1, 1, 1]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new TripleModularRedundancyInstance(this, isInverse);
    }
  }

  class TripleModularRedundancyInstance extends IErrorCorrectionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('TripleModularRedundancyInstance.Feed: Input must be bit array');
      }

      if (this.isInverse) {
        this.result = this.decode(data);
      } else {
        this.result = this.encode(data);
      }
    }

    Result() {
      if (this.result === null) {
        throw new Error('TripleModularRedundancyInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    encode(data) {
      // Simply replicate each bit three times
      const encoded = [];
      for (let i = 0; i < data.length; ++i) {
        encoded.push(data[i], data[i], data[i]);
      }
      return encoded;
    }

    decode(data) {
      // Must have length divisible by 3
      if (data.length % 3 !== 0) {
        throw new Error('TMR decode: Input length must be divisible by 3');
      }

      const decoded = [];
      const k = data.length / 3;

      // Majority voting for each triplet
      for (let i = 0; i < k; ++i) {
        const bit0 = data[i * 3];
        const bit1 = data[i * 3 + 1];
        const bit2 = data[i * 3 + 2];

        // Count ones
        const onesCount = bit0 + bit1 + bit2;

        // Majority vote (2 or 3 ones -> 1, otherwise 0)
        const voted = (onesCount >= 2) ? 1 : 0;

        // Log correction if needed
        if (onesCount === 2 || onesCount === 1) {
          const errors = [bit0, bit1, bit2].filter(b => b !== voted).length;
          if (errors > 0) {
            console.log(`TMR: Corrected ${errors} error(s) in position ${i}`);
          }
        }

        decoded.push(voted);
      }

      return decoded;
    }

    DetectError(data) {
      if (data.length % 3 !== 0) return true;

      const k = data.length / 3;

      // Check each triplet for disagreement
      for (let i = 0; i < k; ++i) {
        const bit0 = data[i * 3];
        const bit1 = data[i * 3 + 1];
        const bit2 = data[i * 3 + 2];

        // If all three don't agree, there's an error
        if (!(bit0 === bit1 && bit1 === bit2)) {
          return true;
        }
      }

      return false;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new TripleModularRedundancyAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { TripleModularRedundancyAlgorithm, TripleModularRedundancyInstance };
}));
