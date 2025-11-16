/*
 * CUSIP Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * CUSIP (Committee on Uniform Securities Identification Procedures) check digit.
 * 9-character alphanumeric code for North American securities.
 * Standard identifier for stocks, bonds, and other financial instruments.
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

  class CUSIPChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "CUSIP";
      this.description = "CUSIP (Committee on Uniform Securities Identification Procedures) check digit calculation. 9-character alphanumeric identifier for North American securities. Uses modified Luhn algorithm with position-based doubling. Standard for stocks, bonds, mutual funds in US and Canada.";
      this.inventor = "American Bankers Association";
      this.year = 1968;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Financial Identifier";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.checksumSize = 8; // Single digit 0-9

      this.documentation = [
        new LinkItem("CUSIP on Wikipedia", "https://en.wikipedia.org/wiki/CUSIP"),
        new LinkItem("CUSIP Global Services", "https://www.cusip.com/"),
        new LinkItem("SEC EDGAR Search", "https://www.sec.gov/edgar/searchedgar/companysearch.html")
      ];

      this.notes = [
        "Format: 6 issuer ID + 2 issue ID + 1 check digit",
        "Character values: 0-9 = numeric, A-Z = 10-35, * = 36, @ = 37, # = 38",
        "Algorithm: Similar to Luhn, but doubles even positions (2,4,6,8)",
        "If doubled value > 9, sum its digits (e.g., 16 → 1+6 = 7)",
        "Check digit: (10 - sum mod 10) mod 10",
        "Used in: US and Canadian financial markets",
        "Mandatory for: SEC filings, trade reporting",
        "Example: 037833100 (Apple Inc.)",
        "Detects: All single-digit errors"
      ];

      this.tests = [
        {
          text: "Apple Inc. (037833100)",
          uri: "https://rosettacode.org/wiki/CUSIP",
          input: OpCodes.AnsiToBytes("03783310"),
          expected: [0x00] // Check digit 0 (CUSIP: 037833100)
        },
        {
          text: "Cisco Systems (17275R102)",
          uri: "https://rosettacode.org/wiki/CUSIP",
          input: OpCodes.AnsiToBytes("17275R10"),
          expected: [0x02] // Check digit 2
        },
        {
          text: "Google Inc. (38259P508)",
          uri: "https://rosettacode.org/wiki/CUSIP",
          input: OpCodes.AnsiToBytes("38259P50"),
          expected: [0x08] // Check digit 8
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
      return new CUSIPChecksumInstance(this, isInverse);
    }
  }

  /**
 * CUSIPChecksum cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class CUSIPChecksumInstance extends IAlgorithmInstance {
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

      // Extract alphanumeric characters and special chars
      for (let i = 0; i < data.length; i++) {
        const char = String.fromCharCode(data[i]).toUpperCase();
        this.chars.push(char);
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

      // Calculate sum using modified Luhn algorithm
      let sum = 0;

      for (let i = 0; i < Math.min(this.chars.length, 8); i++) {
        let value;
        const char = this.chars[i];

        // Convert character to numeric value
        if (char >= '0' && char <= '9') {
          value = char.charCodeAt(0) - '0'.charCodeAt(0);
        } else if (char >= 'A' && char <= 'Z') {
          value = char.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
        } else if (char === '*') {
          value = 36;
        } else if (char === '@') {
          value = 37;
        } else if (char === '#') {
          value = 38;
        } else {
          value = 0;
        }

        // Double even positions (2,4,6,8 in 1-indexed)
        if ((i + 1) % 2 === 0) {
          value *= 2;
        }

        // If doubled value > 9, sum its digits
        if (value > 9) {
          value = Math.floor(value / 10) + (value % 10);
        }

        sum += value;
      }

      // Check digit calculation
      const checkDigit = (10 - (sum % 10)) % 10;

      this.chars = [];
      return [checkDigit];
    }
  }

  RegisterAlgorithm(new CUSIPChecksumAlgorithm());

  return { CUSIPChecksumAlgorithm, CUSIPChecksumInstance };
}));
