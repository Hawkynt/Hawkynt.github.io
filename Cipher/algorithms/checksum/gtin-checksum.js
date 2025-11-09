/*
 * GTIN Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * GTIN (Global Trade Item Number) check digit calculation.
 * Unified standard for UPC, EAN, and other product codes.
 * Supports GTIN-8, GTIN-12, GTIN-13, GTIN-14 per GS1 standards.
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

  class GTINChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "GTIN";
      this.description = "GTIN (Global Trade Item Number) check digit calculation per GS1 standards. Unified format for product identification supporting GTIN-8, GTIN-12 (UPC), GTIN-13 (EAN), GTIN-14. Uses alternating weights (3,1) from right to left for global supply chain compatibility.";
      this.inventor = "GS1 (formerly EAN/UCC)";
      this.year = 2004;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Product Identifier";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null; // International

      this.checksumSize = 8; // Single digit 0-9

      this.documentation = [
        new LinkItem("GTIN on Wikipedia", "https://en.wikipedia.org/wiki/Global_Trade_Item_Number"),
        new LinkItem("GS1 GTIN Standard", "https://www.gs1.org/standards/id-keys/gtin"),
        new LinkItem("GTIN Validation", "https://www.gs1.org/services/check-digit-calculator")
      ];

      this.notes = [
        "GTIN-8: 8 digits (EAN-8, RCN-8)",
        "GTIN-12: 12 digits (UPC-A)",
        "GTIN-13: 13 digits (EAN-13)",
        "GTIN-14: 14 digits (shipping containers)",
        "Algorithm: Alternating weights 3,1,3,1... from right to left",
        "Sum odd positions (×3) + even positions (×1)",
        "Check digit: (10 - sum mod 10) mod 10",
        "Detects: All single-digit errors",
        "Detects: Most adjacent transposition errors",
        "Used globally in: Retail, logistics, e-commerce"
      ];

      this.tests = [
        {
          text: "GTIN-13 example (9780201379624)",
          uri: "https://www.gs1.org/standards/id-keys/gtin",
          input: OpCodes.AnsiToBytes("978020137962"),
          expected: [0x04] // Check digit 4
        },
        {
          text: "GTIN-12 (UPC-A) example",
          uri: "https://www.gs1.org/services/check-digit-calculator",
          input: OpCodes.AnsiToBytes("04963406385"),
          expected: [0x02] // Check digit 2 (UPC 049634063852)
        },
        {
          text: "GTIN-8 example (96385074)",
          uri: "https://www.gs1.org/standards/id-keys/gtin",
          input: OpCodes.AnsiToBytes("9638507"),
          expected: [0x04] // Check digit 4
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new GTINChecksumInstance(this, isInverse);
    }
  }

  class GTINChecksumInstance extends IAlgorithmInstance {
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

      // GTIN algorithm: alternating weights 3,1 from right to left
      let sum = 0;
      let weight = 3; // Start with 3 for rightmost digit

      for (let i = this.digits.length - 1; i >= 0; i--) {
        sum += this.digits[i] * weight;
        weight = (weight === 3) ? 1 : 3; // Alternate between 3 and 1
      }

      // Check digit calculation
      const checkDigit = (10 - (sum % 10)) % 10;

      this.digits = [];
      return [checkDigit];
    }
  }

  RegisterAlgorithm(new GTINChecksumAlgorithm());

  return { GTINChecksumAlgorithm, GTINChecksumInstance };
}));
