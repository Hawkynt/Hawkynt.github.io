/*
 * SEDOL Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * SEDOL (Stock Exchange Daily Official List) check digit calculation.
 * 7-character alphanumeric code for securities traded in UK and Ireland.
 * Used in London Stock Exchange for stock identification.
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

  class SEDOLChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "SEDOL";
      this.description = "SEDOL (Stock Exchange Daily Official List) check digit calculation. 7-character alphanumeric identifier for securities on London Stock Exchange. Uses weighted sum modulo 10 with specific character mappings. Position 7 is check digit (0-9).";
      this.inventor = "London Stock Exchange";
      this.year = 1979;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Financial Identifier";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.GB; // United Kingdom

      this.checksumSize = 8; // Single digit 0-9

      this.documentation = [
        new LinkItem("SEDOL on Wikipedia", "https://en.wikipedia.org/wiki/SEDOL"),
        new LinkItem("London Stock Exchange", "https://www.londonstockexchange.com/"),
        new LinkItem("SEDOL Masterfile", "https://www.lseg.com/en/data-indices-analytics/sedol")
      ];

      this.notes = [
        "Format: 6 alphanumeric + 1 check digit",
        "Character values: 0-9 = numeric value, A-Z = 10-35 (excluding vowels)",
        "Weights: 1,3,1,7,3,9 (positions 1-6)",
        "Algorithm: Σ(character_value × weight) mod 10",
        "Check digit: (10 - sum mod 10) mod 10",
        "Used for: UK and Irish securities",
        "Complements: ISIN (international), CUSIP (North America)",
        "Detects: All single-character errors",
        "Example: 0263494 (Barclays Bank)"
      ];

      this.tests = [
        {
          text: "BAE Systems (0263494)",
          uri: "https://rosettacode.org/wiki/SEDOLs",
          input: OpCodes.AnsiToBytes("026349"),
          expected: [0x04] // Check digit 4 (SEDOL: 0263494)
        },
        {
          text: "SEDOL 406566 (4065663)",
          uri: "https://rosettacode.org/wiki/SEDOLs",
          input: OpCodes.AnsiToBytes("406566"),
          expected: [0x03] // Check digit 3
        },
        {
          text: "SEDOL B0YBKJ (B0YBKJ7)",
          uri: "https://rosettacode.org/wiki/SEDOLs",
          input: OpCodes.AnsiToBytes("B0YBKJ"),
          expected: [0x07] // Check digit 7 (B0YBKJ7)
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new SEDOLChecksumInstance(this, isInverse);
    }
  }

  class SEDOLChecksumInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.chars = [];

      // Weights for positions 1-6
      this.weights = [1, 3, 1, 7, 3, 9];
    }

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

    Result() {
      if (this.chars.length === 0) {
        this.chars = [];
        return [0];
      }

      // Calculate weighted sum
      let sum = 0;
      for (let i = 0; i < Math.min(this.chars.length, 6); i++) {
        let value;
        const char = this.chars[i];

        if (char >= '0' && char <= '9') {
          value = char.charCodeAt(0) - '0'.charCodeAt(0);
        } else if (char >= 'A' && char <= 'Z') {
          value = char.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
        } else {
          value = 0;
        }

        sum += value * this.weights[i];
      }

      // Check digit calculation
      const checkDigit = (10 - (sum % 10)) % 10;

      this.chars = [];
      return [checkDigit];
    }
  }

  RegisterAlgorithm(new SEDOLChecksumAlgorithm());

  return { SEDOLChecksumAlgorithm, SEDOLChecksumInstance };
}));
