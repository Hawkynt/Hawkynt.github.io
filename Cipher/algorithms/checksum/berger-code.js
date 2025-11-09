/*
 * Berger Code Implementation
 * Asymmetric error detection code
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

  class BergerCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Berger Code";
      this.description = "Asymmetric error detection code that detects all unidirectional errors. Appends binary representation of the count of zeros in the data. Optimal for detecting transitions in one direction (0→1 or 1→0).";
      this.inventor = "J. M. Berger";
      this.year = 1961;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Unidirectional Error Detection";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Berger Code", "https://en.wikipedia.org/wiki/Berger_code"),
        new LinkItem("Unidirectional Error Detection", "https://ieeexplore.ieee.org/document/1054965"),
        new LinkItem("Error Detection Techniques", "https://www.sciencedirect.com/topics/computer-science/error-detection")
      ];

      this.references = [
        new LinkItem("Berger's Original Paper", "https://ieeexplore.ieee.org/document/1054965"),
        new LinkItem("Asymmetric Error Detection", "https://en.wikipedia.org/wiki/Error_detection_and_correction")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "No Error Correction",
          "Berger codes can only detect unidirectional errors, not correct them."
        ),
        new Vulnerability(
          "Symmetric Error Weakness",
          "Cannot detect errors where equal numbers of 0→1 and 1→0 transitions occur."
        )
      ];

      // Test vectors for Berger code
      this.tests = [
        {
          text: "Berger code all zeros",
          uri: "https://en.wikipedia.org/wiki/Berger_code",
          input: [0, 0, 0, 0], // 4 zeros
          expected: [0, 0, 0, 0, 1, 0, 0] // Data + binary(4) = 100
        },
        {
          text: "Berger code all ones",
          uri: "https://en.wikipedia.org/wiki/Berger_code",
          input: [1, 1, 1, 1], // 0 zeros
          expected: [1, 1, 1, 1, 0, 0, 0] // Data + binary(0) = 000
        },
        {
          text: "Berger code mixed pattern",
          uri: "https://en.wikipedia.org/wiki/Berger_code",
          input: [1, 0, 1, 0, 1, 0], // 3 zeros
          expected: [1, 0, 1, 0, 1, 0, 0, 1, 1] // Data + binary(3) = 011
        },
        {
          text: "Berger code single bit",
          uri: "https://en.wikipedia.org/wiki/Berger_code",
          input: [1], // 0 zeros
          expected: [1, 0] // Data + binary(0) = 0
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new BergerCodeInstance(this, isInverse);
    }
  }

  class BergerCodeInstance extends IErrorCorrectionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('BergerCodeInstance.Feed: Input must be bit array');
      }

      if (this.isInverse) {
        this.result = this.decode(data);
      } else {
        this.result = this.encode(data);
      }
    }

    Result() {
      if (this.result === null) {
        throw new Error('BergerCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    encode(data) {
      // Count zeros in data
      const zeroCount = data.reduce((count, bit) => count + (bit === 0 ? 1 : 0), 0);

      // Calculate check bits needed (log2 of data length, rounded up)
      const checkBits = Math.max(1, Math.ceil(Math.log2(data.length + 1)));

      // Convert zero count to binary
      const checkBitArray = [];
      for (let i = checkBits - 1; i >= 0; --i) {
        checkBitArray.push((zeroCount >> i) & 1);
      }

      // Return data + check bits
      return [...data, ...checkBitArray];
    }

    decode(data) {
      if (data.length === 0) {
        throw new Error('Berger code decode: Empty data');
      }

      // Determine check bit length
      const totalBits = data.length;
      let checkBits = 1;
      while ((1 << checkBits) < totalBits) {
        ++checkBits;
      }

      const messageLength = totalBits - checkBits;
      const message = data.slice(0, messageLength);
      const receivedCheck = data.slice(messageLength);

      // Count zeros in message
      const zeroCount = message.reduce((count, bit) => count + (bit === 0 ? 1 : 0), 0);

      // Convert received check bits to number
      let receivedCount = 0;
      for (let i = 0; i < receivedCheck.length; ++i) {
        receivedCount = (receivedCount << 1) | receivedCheck[i];
      }

      // Verify
      if (zeroCount !== receivedCount) {
        console.warn(`Berger code: Unidirectional error detected (expected ${zeroCount}, got ${receivedCount})`);
      }

      return message;
    }

    DetectError(data) {
      if (data.length === 0) return true;

      try {
        const totalBits = data.length;
        let checkBits = 1;
        while ((1 << checkBits) < totalBits) {
          ++checkBits;
        }

        const messageLength = totalBits - checkBits;
        const message = data.slice(0, messageLength);
        const receivedCheck = data.slice(messageLength);

        const zeroCount = message.reduce((count, bit) => count + (bit === 0 ? 1 : 0), 0);

        let receivedCount = 0;
        for (let i = 0; i < receivedCheck.length; ++i) {
          receivedCount = (receivedCount << 1) | receivedCheck[i];
        }

        return zeroCount !== receivedCount;
      } catch (e) {
        return true;
      }
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new BergerCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BergerCodeAlgorithm, BergerCodeInstance };
}));
