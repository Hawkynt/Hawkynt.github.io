/*
 * ISIN Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * ISIN (International Securities Identification Number) check digit.
 * 12-character alphanumeric code identifying securities globally.
 * Uses modified Luhn algorithm per ISO 6166 standard.
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

  class ISINChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "ISIN";
      this.description = "ISIN (International Securities Identification Number) check digit per ISO 6166. 12-character alphanumeric code (2 country + 9 identifier + 1 check) for global securities. Uses modified Luhn algorithm with letter-to-number conversion (A=10, B=11, ..., Z=35).";
      this.inventor = "International Organization for Standardization";
      this.year = 1989;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Securities Identifier";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = null; // International

      this.checksumSize = 8; // Single digit 0-9

      this.documentation = [
        new LinkItem("ISIN on Wikipedia", "https://en.wikipedia.org/wiki/International_Securities_Identification_Number"),
        new LinkItem("ISO 6166 Standard", "https://www.iso.org/standard/78502.html"),
        new LinkItem("ISIN Organization", "https://www.isin.org/")
      ];

      this.notes = [
        "Format: CC123456789D (2 country + 9 ID + 1 check)",
        "Country codes: ISO 3166-1 alpha-2 (e.g., US, GB, DE)",
        "Letter conversion: A=10, B=11, ..., Z=35",
        "Algorithm: Modified Luhn on converted numeric string",
        "Double every second digit from right to left",
        "Sum individual digits if result > 9",
        "Check digit: (10 - sum mod 10) mod 10",
        "Example: US0378331005 (Apple Inc.)",
        "Used in: Trading, clearing, settlement globally",
        "Detects: All single-digit errors"
      ];

      this.tests = [
        {
          text: "Apple Inc.",
          uri: "https://en.wikipedia.org/wiki/International_Securities_Identification_Number",
          input: OpCodes.AnsiToBytes("US037833100"),
          expected: [0x05] // Check digit 5 (US0378331005)
        },
        {
          text: "British Airways GB0009753368",
          uri: "https://www.isin.org/",
          input: OpCodes.AnsiToBytes("GB000975336"),
          expected: [0x08] // Check digit 8
        },
        {
          text: "German security",
          uri: "ISIN check",
          input: OpCodes.AnsiToBytes("DE000BAY001"),
          expected: [0x07] // Check digit 7
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
      return new ISINChecksumInstance(this, isInverse);
    }
  }

  /**
 * ISINChecksum cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ISINChecksumInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.chars = [];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Extract alphanumeric characters
      for (let i = 0; i < data.length; i++) {
        const char = String.fromCharCode(data[i]).toUpperCase();
        if ((char >= '0' && char <= '9') || (char >= 'A' && char <= 'Z')) {
          this.chars.push(char);
        }
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.chars.length === 0) {
        this.chars = [];
        return [0];
      }

      // Convert to numeric string (letters: A=10, B=11, ..., Z=35)
      let numericString = '';
      for (let i = 0; i < this.chars.length; i++) {
        const char = this.chars[i];
        if (char >= '0' && char <= '9') {
          numericString += char;
        } else if (char >= 'A' && char <= 'Z') {
          numericString += (char.charCodeAt(0) - 'A'.charCodeAt(0) + 10).toString();
        }
      }

      // Convert to array of digits
      const digits = [];
      for (let i = 0; i < numericString.length; i++) {
        digits.push(numericString.charCodeAt(i) - 0x30);
      }

      // Modified Luhn algorithm (double at odd positions from right)
      let sum = 0;

      for (let i = 0; i < digits.length; i++) {
        let digit = digits[digits.length - 1 - i];

        // Double at odd positions (1,3,5... from right)
        if ((i + 1) % 2 === 1) {
          digit *= 2;
          if (digit > 9) {
            digit -= 9;
          }
        }

        sum += digit;
      }

      // Check digit calculation
      const checkDigit = (10 - (sum % 10)) % 10;

      this.chars = [];
      return [checkDigit];
    }
  }

  RegisterAlgorithm(new ISINChecksumAlgorithm());

  return { ISINChecksumAlgorithm, ISINChecksumInstance };
}));
