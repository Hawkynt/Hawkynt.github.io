/*
 * EAN-8 Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * EAN-8 (European Article Number) check digit for small product barcodes.
 * 8-digit barcode for products with limited space using alternating weights.
 * Subset of EAN/GTIN family, commonly used worldwide for small items.
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

  class EAN8ChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "EAN-8";
      this.description = "EAN-8 (European Article Number) check digit for compact product barcodes. 8-digit identifier (7 data + 1 check) using alternating weights 3,1 from right. Subset of GTIN family for small products like cigarettes, cosmetics, chewing gum where space is limited.";
      this.inventor = "GS1 (formerly EAN International)";
      this.year = 1977;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Product Barcode";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null; // International

      this.checksumSize = 8; // Single digit 0-9

      this.documentation = [
        new LinkItem("EAN-8 on Wikipedia", "https://en.wikipedia.org/wiki/EAN-8"),
        new LinkItem("GS1 Barcodes", "https://www.gs1.org/standards/barcodes/ean-upc"),
        new LinkItem("Barcode Standards", "https://www.gs1.org/standards/id-keys/gtin")
      ];

      this.notes = [
        "Format: 8 digits (7 data + 1 check)",
        "Country/company code: 2-3 digits",
        "Product code: 4-5 digits",
        "Check digit: 1 digit",
        "Weights: 3,1,3,1,3,1,3 from right to left",
        "Algorithm: Same as UPC/EAN-13",
        "Used for: Small products with limited space",
        "Common on: Cigarettes, cosmetics, gum",
        "Barcode: Compact vertical bars",
        "Example: 96385074"
      ];

      this.tests = [
        {
          text: "Standard EAN-8",
          uri: "https://en.wikipedia.org/wiki/EAN-8",
          input: OpCodes.AnsiToBytes("9638507"),
          expected: [0x04] // Check digit 4 (96385074)
        },
        {
          text: "EAN-8 product",
          uri: "EAN-8 validation",
          input: OpCodes.AnsiToBytes("2012345"),
          expected: [0x01] // Check digit 1
        },
        {
          text: "Simple test",
          uri: "EAN-8 check",
          input: OpCodes.AnsiToBytes("1234567"),
          expected: [0x00] // Check digit 0
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new EAN8ChecksumInstance(this, isInverse);
    }
  }

  class EAN8ChecksumInstance extends IAlgorithmInstance {
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

      // Calculate sum with alternating weights 3,1 from right
      let sum = 0;
      let weight = 3;

      for (let i = this.digits.length - 1; i >= 0; i--) {
        sum += this.digits[i] * weight;
        weight = (weight === 3) ? 1 : 3;
      }

      const checkDigit = (10 - (sum % 10)) % 10;
      this.digits = [];
      return [checkDigit];
    }
  }

  RegisterAlgorithm(new EAN8ChecksumAlgorithm());

  return { EAN8ChecksumAlgorithm, EAN8ChecksumInstance };
}));
