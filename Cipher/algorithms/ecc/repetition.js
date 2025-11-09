/*
 * Repetition Code (Triple Modular Redundancy) Implementation
 * Simple error correction using bit replication and majority voting
 * Each bit is repeated N times (default 3) for redundancy
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
          ErrorCorrectionAlgorithm, IErrorCorrectionInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class RepetitionCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Repetition";
      this.description = "Repetition codes use triple modular redundancy (TMR) or N-modular redundancy to correct errors. Each bit is repeated N times, and majority voting recovers the original data. Can correct up to (N-1)/2 bit errors per N-bit group. Simple but inefficient, widely used in critical systems like spacecraft.";
      this.inventor = "John von Neumann";
      this.year = 1956;
      this.category = CategoryType.ECC;
      this.subCategory = "Linear Codes";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // Algorithm capabilities
      this.SupportedBlockSizes = [new KeySize(1, 1048576, 1)]; // 1 byte to 1MB blocks
      this.supportsErrorDetection = true;
      this.supportsErrorCorrection = true;
      this.defaultRepetition = 3; // Triple modular redundancy

      // Documentation
      this.documentation = [
        new LinkItem("Triple Modular Redundancy - Wikipedia", "https://en.wikipedia.org/wiki/Triple_modular_redundancy"),
        new LinkItem("Repetition Code - Wikipedia", "https://en.wikipedia.org/wiki/Repetition_code"),
        new LinkItem("Error Correction Tutorial", "https://www.electronicshub.org/error-correction-and-detection-codes/")
      ];

      // Test vectors based on majority voting truth table
      this.tests = [
        new TestCase(
          [0x00], // Single bit: 0
          [0x00, 0x00, 0x00], // Encoded: 000
          "Triple repetition: bit 0",
          "https://en.wikipedia.org/wiki/Triple_modular_redundancy"
        ),
        new TestCase(
          [0x01], // Single bit: 1
          [0x01, 0x01, 0x01], // Encoded: 111
          "Triple repetition: bit 1",
          "https://en.wikipedia.org/wiki/Triple_modular_redundancy"
        ),
        new TestCase(
          [0x01, 0x00, 0x01, 0x01], // Pattern: 1011
          [0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01], // 111 000 111 111
          "Triple repetition: 1011 pattern",
          "https://en.wikipedia.org/wiki/Triple_modular_redundancy"
        ),
        new TestCase(
          [0x01, 0x00, 0x00, 0x01, 0x01, 0x00, 0x01, 0x00], // Byte pattern
          [0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x01, 0x01,
           0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00],
          "Triple repetition: byte pattern",
          "https://en.wikipedia.org/wiki/Triple_modular_redundancy"
        )
      ];

      // Set repetition count for test vectors
      this.tests[0].repetitionCount = 3;
      this.tests[1].repetitionCount = 3;
      this.tests[2].repetitionCount = 3;
      this.tests[3].repetitionCount = 3;
    }

    CreateInstance(isInverse = false) {
      return new RepetitionCodeInstance(this, isInverse);
    }
  }

  class RepetitionCodeInstance extends IErrorCorrectionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this.repetitionCount = 3; // Default: triple modular redundancy
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('RepetitionCodeInstance.Feed: Input must be byte array');
      }
      this.inputBuffer.push(...data);
    }

    Result() {
      if (this.inputBuffer.length === 0) {
        throw new Error('No data fed');
      }

      if (this.isInverse) {
        return this._decode();
      } else {
        return this._encode();
      }
    }

    DetectError(data) {
      if (!data || data.length === 0) return false;
      if (data.length % this.repetitionCount !== 0) return true;

      // Check each repetition group for inconsistencies
      for (let i = 0; i < data.length; i += this.repetitionCount) {
        const group = data.slice(i, i + this.repetitionCount);

        // Count ones and zeros
        let onesCount = 0;
        for (let j = 0; j < group.length; j++) {
          if (group[j] & 1) onesCount++;
        }

        // If votes are tied or corrupted beyond correction capability
        const zerosCount = group.length - onesCount;
        if (onesCount === zerosCount) return true; // Tie - cannot determine
      }

      return false;
    }

    _encode() {
      const data = this.inputBuffer;
      const result = [];

      // Repeat each bit N times
      for (let i = 0; i < data.length; i++) {
        const bit = data[i] & 1; // Get least significant bit
        for (let j = 0; j < this.repetitionCount; j++) {
          result.push(bit);
        }
      }

      this.inputBuffer = [];
      return result;
    }

    _decode() {
      const data = this.inputBuffer;

      if (data.length % this.repetitionCount !== 0) {
        throw new Error(`Encoded data length must be multiple of ${this.repetitionCount}`);
      }

      const result = [];

      // Process each repetition group using majority voting
      for (let i = 0; i < data.length; i += this.repetitionCount) {
        const group = data.slice(i, i + this.repetitionCount);

        // Count ones
        let onesCount = 0;
        for (let j = 0; j < group.length; j++) {
          if (group[j] & 1) onesCount++;
        }

        // Majority vote: Q = AB ∨ BC ∨ AC
        // Simplified: if more than half are 1, output 1
        const majority = onesCount > (this.repetitionCount / 2) ? 1 : 0;
        result.push(majority);
      }

      this.inputBuffer = [];
      return result;
    }

    // Set repetition count (must be odd number >= 3)
    setRepetitionCount(count) {
      if (count < 1 || count % 2 === 0) {
        throw new Error('Repetition count must be odd number (1, 3, 5, 7, ...)');
      }
      this.repetitionCount = count;
    }

    // Calculate code rate (efficiency)
    getCodeRate() {
      return 1.0 / this.repetitionCount;
    }

    // Calculate error correction capability
    getErrorCorrectionCapability() {
      return Math.floor((this.repetitionCount - 1) / 2);
    }
  }

  // Register the algorithm
  const algorithmInstance = new RepetitionCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return algorithmInstance;

}));
