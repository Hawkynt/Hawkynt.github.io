/*
 * Single Parity Check (SPC) Code Implementation
 * Simplest error detection code - dual of repetition code
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

  class SingleParityCheckAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Single Parity Check";
      this.description = "Simplest error correction code adding single parity bit to detect odd number of errors. Parameters (n, n-1, 2) giving code rate (n-1)/n. Can detect single-bit errors but cannot correct them. Dual of repetition code. Used in RAM, network packets (Ethernet CRC), serial communications. Extremely efficient for error detection.";
      this.inventor = "Unknown (classical technique)";
      this.year = 1948;
      this.category = CategoryType.ECC;
      this.subCategory = "Linear Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Parity Bit", "https://en.wikipedia.org/wiki/Parity_bit"),
        new LinkItem("Single Parity Check", "https://www.tutorialspoint.com/single-parity-check"),
        new LinkItem("Error Detection", "https://www.cs.cornell.edu/courses/cs6114/2018sp/Handouts/Lec2.pdf")
      ];

      this.references = [
        new LinkItem("SPC in Communications", "https://ieeexplore.ieee.org/document/10106461"),
        new LinkItem("Soft-Decision Decoding", "https://digital-library.theiet.org/doi/10.1049/el%3A19971092"),
        new LinkItem("Concatenated FEC", "https://arxiv.org/abs/2212.10523")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Cannot Correct Errors",
          "Can only detect odd number of errors, cannot correct any errors. Even number of errors goes undetected."
        ),
        new Vulnerability(
          "Minimum Distance 2",
          "With d=2, can only detect single-bit errors, not correct them."
        )
      ];

      // Test vectors for SPC
      this.tests = [
        {
          text: "SPC (5,4) all zeros",
          uri: "https://en.wikipedia.org/wiki/Parity_bit",
          input: [0, 0, 0, 0],
          expected: [0, 0, 0, 0, 0]
        },
        {
          text: "SPC (5,4) all ones",
          uri: "https://en.wikipedia.org/wiki/Parity_bit",
          input: [1, 1, 1, 1],
          expected: [1, 1, 1, 1, 0]
        },
        {
          text: "SPC (5,4) pattern 1010",
          uri: "https://en.wikipedia.org/wiki/Parity_bit",
          input: [1, 0, 1, 0],
          expected: [1, 0, 1, 0, 0]
        },
        {
          text: "SPC (5,4) pattern 1011",
          uri: "https://en.wikipedia.org/wiki/Parity_bit",
          input: [1, 0, 1, 1],
          expected: [1, 0, 1, 1, 1]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new SingleParityCheckInstance(this, isInverse);
    }
  }

  class SingleParityCheckInstance extends IErrorCorrectionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;
      this._evenParity = true; // Even parity by default
    }

    set evenParity(value) {
      this._evenParity = !!value;
    }

    get evenParity() {
      return this._evenParity;
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('SingleParityCheckInstance.Feed: Input must be bit array');
      }

      if (this.isInverse) {
        this.result = this.decode(data);
      } else {
        this.result = this.encode(data);
      }
    }

    Result() {
      if (this.result === null) {
        throw new Error('SingleParityCheckInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    encode(data) {
      // Count ones in data
      let onesCount = 0;
      for (let i = 0; i < data.length; ++i) {
        onesCount += data[i];
      }

      // Calculate parity bit
      let parityBit;
      if (this._evenParity) {
        // Even parity: parity bit makes total ones even
        parityBit = onesCount % 2;
      } else {
        // Odd parity: parity bit makes total ones odd
        parityBit = (onesCount + 1) % 2;
      }

      // Append parity bit
      return [...data, parityBit];
    }

    decode(data) {
      if (data.length < 2) {
        throw new Error('SPC decode: Input must have at least 2 bits');
      }

      // Count ones in received data
      let onesCount = 0;
      for (let i = 0; i < data.length; ++i) {
        onesCount += data[i];
      }

      // Check parity
      const parityOk = this._evenParity ? (onesCount % 2 === 0) : (onesCount % 2 === 1);

      if (!parityOk) {
        console.warn('SPC: Parity check failed - odd number of errors detected');
      }

      // Return data without parity bit (cannot correct errors)
      return data.slice(0, -1);
    }

    DetectError(data) {
      if (data.length < 2) return true;

      // Count ones in received data
      let onesCount = 0;
      for (let i = 0; i < data.length; ++i) {
        onesCount += data[i];
      }

      // Check parity
      const parityOk = this._evenParity ? (onesCount % 2 === 0) : (onesCount % 2 === 1);

      return !parityOk;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new SingleParityCheckAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SingleParityCheckAlgorithm, SingleParityCheckInstance };
}));
