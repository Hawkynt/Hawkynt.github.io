/*
 * Damm Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Damm algorithm - check digit using quasigroup operations.
 * Detects ALL single-digit errors and ALL adjacent transposition errors.
 * Invented by H. Michael Damm in 2004.
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

  class DammAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "Damm";
      this.description = "Damm algorithm using quasigroup of order 10 for check digit calculation. Detects ALL single-digit errors and ALL adjacent transposition errors. Simpler than Verhoeff with same error detection. Invented by H. Michael Damm in 2004.";
      this.inventor = "H. Michael Damm";
      this.year = 2004;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Check Digit";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.DE; // Germany

      this.checksumSize = 8; // Single digit 0-9

      this.documentation = [
        new LinkItem("Damm Algorithm on Wikipedia", "https://en.wikipedia.org/wiki/Damm_algorithm"),
        new LinkItem("Original Paper (2004)", "https://archiv.ub.uni-marburg.de/diss/z2004/0516/pdf/dhmd.pdf"),
        new LinkItem("Check Digit Systems", "https://www.nayuki.io/page/java-checksum-algorithms")
      ];

      this.notes = [
        "Uses single quasigroup operation table",
        "Totally anti-symmetric quasigroup of order 10",
        "Detects: 100% of single-digit errors",
        "Detects: 100% of adjacent transposition errors",
        "Detects: 100% of phonetic errors",
        "Simpler than Verhoeff (one table vs three)",
        "Check digit: final interim value equals 0 for valid number",
        "Used in: Various European identification systems"
      ];

      this.tests = [
        {
          text: "Damm validation",
          uri: "https://en.wikipedia.org/wiki/Damm_algorithm",
          input: OpCodes.AnsiToBytes("572"),
          expected: [4] // Damm check digit for "572"
        },
        {
          text: "Simple sequence",
          uri: "Damm calculation",
          input: OpCodes.AnsiToBytes("123"),
          expected: [4] // Damm check digit
        },
        {
          text: "All zeros",
          uri: "Edge case",
          input: OpCodes.AnsiToBytes("000"),
          expected: [0]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new DammInstance(this, isInverse);
    }
  }

  class DammInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.digits = [];

      // Quasigroup operation table (totally anti-symmetric)
      this.table = [
        [0,3,1,7,5,9,8,6,4,2],
        [7,0,9,2,1,5,4,8,6,3],
        [4,2,0,6,8,7,1,3,5,9],
        [1,7,5,0,9,8,3,4,2,6],
        [6,1,2,3,0,4,5,9,7,8],
        [3,6,7,4,2,0,9,5,8,1],
        [5,8,6,9,7,2,0,1,3,4],
        [8,9,4,5,3,6,2,0,1,7],
        [9,4,3,8,6,1,7,2,0,5],
        [2,5,8,1,4,3,6,7,9,0]
      ];
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      // Extract ASCII digits
      for (let i = 0; i < data.length; i++) {
        const char = String.fromCharCode(data[i]);
        if (char >= '0' && char <= '9') {
          this.digits.push(data[i] - 0x30);
        }
      }
    }

    Result() {
      if (this.digits.length === 0) {
        this.digits = [];
        return [0];
      }

      // Damm algorithm: process from left to right
      let interim = 0;

      for (let i = 0; i < this.digits.length; i++) {
        interim = this.table[interim][this.digits[i]];
      }

      // Check digit is the interim value
      const checkDigit = interim;

      this.digits = [];
      return [checkDigit];
    }
  }

  RegisterAlgorithm(new DammAlgorithm());

  return { DammAlgorithm, DammInstance };
}));
