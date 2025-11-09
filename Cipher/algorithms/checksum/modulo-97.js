/*
 * Modulo-97 Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Modulo-97 checksum used in IBAN (International Bank Account Number).
 * Validates bank account numbers using mod-97 algorithm per ISO 7064.
 * Detects up to 99% of single-digit errors and transposition errors.
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

  class Modulo97ChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "Modulo-97";
      this.description = "Modulo-97 checksum algorithm used in IBAN (International Bank Account Number) validation per ISO 7064. Detects up to 99% of single-digit errors and all transposition errors. Uses mod-97-10 check digit calculation.";
      this.inventor = "ISO 7064 standard";
      this.year = 1983;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Modular Arithmetic";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null;

      this.checksumSize = 8; // Returns 1-byte value (0-96)

      this.documentation = [
        new LinkItem("ISO 7064:1983 Standard", "https://en.wikipedia.org/wiki/ISO_7064"),
        new LinkItem("IBAN Validation", "https://en.wikipedia.org/wiki/International_Bank_Account_Number"),
        new LinkItem("Modulo 97 Algorithm", "https://www.geeksforgeeks.org/iban-validator/")
      ];

      this.notes = [
        "Algorithm: Convert digits to number, compute mod 97",
        "Used in: IBAN validation (mod-97-10)",
        "Check digit calculation: 98 - (number mod 97)",
        "Validation: (number with check digits) mod 97 == 1",
        "Detects: ~99% single-digit errors",
        "Detects: All adjacent transposition errors",
        "For IBAN: letters converted A=10, B=11, ..., Z=35",
        "Output: remainder (0-96), or check digits (02-98)"
      ];

      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes("123456"), // Simple digit sequence
          [88], // 123456 mod 97 = 88
          "Simple digit sequence",
          "Modulo-97 calculation"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("98"), // Check digit test
          [1], // 98 mod 97 = 1
          "IBAN check digit validation",
          "Valid IBAN check digit"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("999999"), // Large number
          [63], // 999999 mod 97 = 63
          "Large digit sequence",
          "Modulo-97 overflow handling"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new Modulo97ChecksumInstance(this, isInverse);
    }
  }

  class Modulo97ChecksumInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.digitString = '';
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      // Convert bytes to ASCII digits
      for (let i = 0; i < data.length; i++) {
        const char = String.fromCharCode(data[i]);
        // Accept digits 0-9
        if (char >= '0' && char <= '9') {
          this.digitString += char;
        }
        // Accept letters A-Z (for IBAN: A=10, B=11, ..., Z=35)
        else if (char >= 'A' && char <= 'Z') {
          const value = char.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
          this.digitString += value.toString();
        }
        else if (char >= 'a' && char <= 'z') {
          const value = char.charCodeAt(0) - 'a'.charCodeAt(0) + 10;
          this.digitString += value.toString();
        }
      }
    }

    Result() {
      if (this.digitString.length === 0) {
        this.digitString = '';
        return [0];
      }

      // Calculate mod 97 using sequential digit processing
      // (avoids overflow for very long numbers)
      let remainder = 0;

      for (let i = 0; i < this.digitString.length; i++) {
        const digit = parseInt(this.digitString[i], 10);
        remainder = (remainder * 10 + digit) % 97;
      }

      this.digitString = '';
      return [remainder];
    }
  }

  RegisterAlgorithm(new Modulo97ChecksumAlgorithm());

  return { Modulo97ChecksumAlgorithm, Modulo97ChecksumInstance };
}));
