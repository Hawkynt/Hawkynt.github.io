/*
 * Modulo-10 Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Simple modulo-10 checksum for digit sequences.
 * Sum all digits and take result modulo 10.
 * Used in basic barcode systems and simple validation schemes.
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

  class Modulo10ChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "Modulo-10";
      this.description = "Simple modulo-10 checksum for digit sequences. Sums all digits and returns remainder when divided by 10. Basic error detection for barcodes and identification numbers.";
      this.inventor = "Unknown (fundamental technique)";
      this.year = 1960;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Modular Arithmetic";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null;

      this.checksumSize = 8; // Returns single digit (0-9)

      this.documentation = [
        new LinkItem("Check Digit Algorithms", "https://en.wikipedia.org/wiki/Check_digit"),
        new LinkItem("Modulo Checksums", "https://www.geeksforgeeks.org/check-digit/")
      ];

      this.notes = [
        "Algorithm: sum all digits, result mod 10",
        "Check digit: (10 - sum mod 10) mod 10",
        "Very simple, weak error detection",
        "Used in: Simple barcodes, basic validation",
        "Cannot detect digit transposition errors",
        "Output: single digit 0-9"
      ];

      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes("123"), // 1+2+3 = 6
          [6],
          "Simple digit sum",
          "Modulo-10 calculation"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("987"), // 9+8+7 = 24, 24 mod 10 = 4
          [4],
          "Sum with overflow",
          "Modulo-10 with carry"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("1234567890"), // Sum = 45, mod 10 = 5
          [5],
          "Long digit sequence",
          "Modulo-10 calculation"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new Modulo10ChecksumInstance(this, isInverse);
    }
  }

  class Modulo10ChecksumInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.sum = 0;
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      // Sum all ASCII digits
      for (let i = 0; i < data.length; i++) {
        const char = String.fromCharCode(data[i]);
        if (char >= '0' && char <= '9') {
          this.sum += (data[i] - 0x30); // '0' = 0x30
        }
      }
    }

    Result() {
      const result = this.sum % 10;
      this.sum = 0;
      return [result];
    }
  }

  RegisterAlgorithm(new Modulo10ChecksumAlgorithm());

  return { Modulo10ChecksumAlgorithm, Modulo10ChecksumInstance };
}));
