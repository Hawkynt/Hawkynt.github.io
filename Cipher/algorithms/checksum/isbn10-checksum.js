/*
 * ISBN-10 Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * ISBN-10 (10-digit International Standard Book Number) check digit.
 * Uses modulo-11 weighted sum for books published before 2007.
 * Position 10 check digit can be 0-9 or X (representing 10).
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

  class ISBN10ChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "ISBN-10";
      this.description = "ISBN-10 (International Standard Book Number) check digit calculation. 10-digit identifier for books using modulo-11 weighted sum. Weights: 10,9,8,7,6,5,4,3,2. Check digit X represents 10. Used for books published before 2007, superseded by ISBN-13.";
      this.inventor = "International ISBN Agency";
      this.year = 1970;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Book Identifier";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null; // International

      this.checksumSize = 8; // Single digit 0-9 or X

      this.documentation = [
        new LinkItem("ISBN on Wikipedia", "https://en.wikipedia.org/wiki/International_Standard_Book_Number"),
        new LinkItem("ISBN Agency", "https://www.isbn-international.org/"),
        new LinkItem("ISBN-10 Format", "https://www.isbn-international.org/content/what-isbn")
      ];

      this.notes = [
        "Format: 10 digits (9 data + 1 check)",
        "Weights: 10,9,8,7,6,5,4,3,2 for positions 1-9",
        "Algorithm: Σ(digit × weight) mod 11",
        "Check digit: (11 - sum mod 11) mod 11, where 10 = 'X'",
        "Example: 0-306-40615-2 (Einstein biography)",
        "Superseded by ISBN-13 in 2007",
        "Detects: All single-digit errors",
        "Detects: Most transposition errors"
      ];

      this.tests = [
        {
          text: "Classic book example",
          uri: "https://en.wikipedia.org/wiki/International_Standard_Book_Number",
          input: OpCodes.AnsiToBytes("030640615"),
          expected: [0x02] // Check digit 2
        },
        {
          text: "Check digit X",
          uri: "ISBN-10 validation",
          input: OpCodes.AnsiToBytes("043942089"),
          expected: [0x0A] // Check digit X (10)
        },
        {
          text: "Simple sequence",
          uri: "ISBN-10 test",
          input: OpCodes.AnsiToBytes("123456789"),
          expected: [0x00] // Check digit 0
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new ISBN10ChecksumInstance(this, isInverse);
    }
  }

  class ISBN10ChecksumInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.digits = [];
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      // Extract digits
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

      // Calculate weighted sum (weights: 10,9,8,7,6,5,4,3,2)
      let sum = 0;
      for (let i = 0; i < Math.min(this.digits.length, 9); i++) {
        sum += this.digits[i] * (10 - i);
      }

      // Check digit: (11 - sum mod 11) mod 11
      const checkDigit = (11 - (sum % 11)) % 11;

      this.digits = [];
      return [checkDigit]; // 0-9 or 10 (X)
    }
  }

  const isbn10Instance = new ISBN10ChecksumAlgorithm();
  if (!AlgorithmFramework.Find(isbn10Instance.name)) {
    RegisterAlgorithm(isbn10Instance);
  }

  return { ISBN10ChecksumAlgorithm, ISBN10ChecksumInstance };
}));
