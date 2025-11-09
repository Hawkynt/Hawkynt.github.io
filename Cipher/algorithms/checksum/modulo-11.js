/*
 * Modulo-11 Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Modulo-11 checksum with weighted sum.
 * Used in ISBN-10, ISSN, and other identification systems.
 * Detects most single-digit and transposition errors.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
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

  if (!AlgorithmFramework || !OpCodes) {
    throw new Error('AlgorithmFramework and OpCodes dependencies are required');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  class Modulo11ChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "Modulo-11";
      this.description = "Modulo-11 weighted checksum used in ISBN-10, ISSN, and various identification systems. Uses position-based weights to detect single-digit errors and most transposition errors. Check digit can be 0-9 or X (representing 10).";
      this.inventor = "ISBN/ISSN standard";
      this.year = 1970;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Modular Arithmetic";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null;

      this.checksumSize = 8; // Returns 0-10 (X)

      this.documentation = [
        new LinkItem("ISBN Check Digit", "https://en.wikipedia.org/wiki/International_Standard_Book_Number"),
        new LinkItem("Modulo 11 Algorithm", "https://www.geeksforgeeks.org/program-check-isbn/"),
        new LinkItem("Check Digit Systems", "https://en.wikipedia.org/wiki/Check_digit")
      ];

      this.notes = [
        "Algorithm: weighted sum with position-based weights",
        "Standard weights: position * digit (from right to left)",
        "Check digit: (11 - sum mod 11) mod 11",
        "Result 10 represented as 'X' in ISBN",
        "Used in: ISBN-10, ISSN, bank routing numbers",
        "Detects: All single-digit errors",
        "Detects: Most adjacent transposition errors",
        "Output: 0-9 or 10 (for 'X')"
      ];

      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes("012000008"), // ISBN-10 example without check digit
          [10], // Check digit = X (10)
          "ISBN-10 format",
          "https://en.wikipedia.org/wiki/International_Standard_Book_Number"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("123456789"), // Simple sequence
          [3], // Weighted sum calculation
          "Simple digit sequence",
          "Modulo-11 weighted checksum"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("00"), // Simple test
          [0], // (11 - (0*2 + 0*1) mod 11) mod 11 = 0
          "Zero digits",
          "Modulo-11 edge case"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new Modulo11ChecksumInstance(this, isInverse);
    }
  }

  class Modulo11ChecksumInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.digits = [];
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      // Collect ASCII digits
      for (let i = 0; i < data.length; i++) {
        const char = String.fromCharCode(data[i]);
        if (char >= '0' && char <= '9') {
          this.digits.push(data[i] - 0x30); // '0' = 0x30
        }
      }
    }

    Result() {
      if (this.digits.length === 0) {
        this.digits = [];
        return [0];
      }

      // Calculate weighted sum (weights from right to left: 1, 2, 3, ...)
      let sum = 0;
      let weight = 1;

      for (let i = this.digits.length - 1; i >= 0; i--) {
        sum += this.digits[i] * weight;
        weight++;
      }

      // Check digit calculation
      const checkDigit = (11 - (sum % 11)) % 11;

      this.digits = [];
      return [checkDigit];
    }
  }

  RegisterAlgorithm(new Modulo11ChecksumAlgorithm());

  return { Modulo11ChecksumAlgorithm, Modulo11ChecksumInstance };
}));
