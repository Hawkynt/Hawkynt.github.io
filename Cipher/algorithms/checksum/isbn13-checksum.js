/*
 * ISBN-13 Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * ISBN-13 (13-digit International Standard Book Number) check digit.
 * Modern book identifier using EAN-13 format with alternating weights.
 * Standard for all books published after 2007.
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

  class ISBN13ChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "ISBN-13";
      this.description = "ISBN-13 (International Standard Book Number) check digit calculation. 13-digit identifier using EAN-13 format with alternating weights (1,3). Prefix 978 or 979 for books. Standard for all books published after January 1, 2007, replacing ISBN-10.";
      this.inventor = "International ISBN Agency";
      this.year = 2007;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Book Identifier";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null; // International

      this.checksumSize = 8; // Single digit 0-9

      this.documentation = [
        new LinkItem("ISBN on Wikipedia", "https://en.wikipedia.org/wiki/International_Standard_Book_Number"),
        new LinkItem("ISBN Agency", "https://www.isbn-international.org/"),
        new LinkItem("ISBN-13 Format", "https://www.isbn-international.org/content/what-isbn")
      ];

      this.notes = [
        "Format: 13 digits (12 data + 1 check)",
        "Prefix: 978 (Bookland) or 979 (additional capacity)",
        "Weights: Alternating 1,3,1,3... from left to right",
        "Algorithm: Σ(digit × weight) mod 10",
        "Check digit: (10 - sum mod 10) mod 10",
        "Example: 978-0-306-40615-7",
        "Compatible with EAN-13 barcode system",
        "Supersedes ISBN-10 since 2007",
        "Detects: All single-digit errors",
        "Detects: Most adjacent transposition errors"
      ];

      this.tests = [
        {
          text: "Standard ISBN-13",
          uri: "https://en.wikipedia.org/wiki/International_Standard_Book_Number",
          input: OpCodes.AnsiToBytes("978030640615"),
          expected: [0x07] // Check digit 7
        },
        {
          text: "ISBN-13 with 979",
          uri: "ISBN-13 validation",
          input: OpCodes.AnsiToBytes("979012345678"),
          expected: [0x09] // Check digit 9
        },
        {
          text: "Simple test",
          uri: "ISBN-13 calculation",
          input: OpCodes.AnsiToBytes("978000000000"),
          expected: [0x01] // Check digit 1
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new ISBN13ChecksumInstance(this, isInverse);
    }
  }

  /**
 * ISBN13Checksum cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ISBN13ChecksumInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.digits = [];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

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

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.digits.length === 0) {
        this.digits = [];
        return [0];
      }

      // Calculate sum with alternating weights 1,3
      let sum = 0;
      for (let i = 0; i < Math.min(this.digits.length, 12); i++) {
        const weight = (i % 2 === 0) ? 1 : 3;
        sum += this.digits[i] * weight;
      }

      // Check digit calculation
      const checkDigit = (10 - (sum % 10)) % 10;

      this.digits = [];
      return [checkDigit];
    }
  }

  const isbn13Instance = new ISBN13ChecksumAlgorithm();
  if (!AlgorithmFramework.Find(isbn13Instance.name)) {
    RegisterAlgorithm(isbn13Instance);
  }

  return { ISBN13ChecksumAlgorithm, ISBN13ChecksumInstance };
}));
