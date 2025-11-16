/*
 * EAN-13 Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * EAN-13 (European Article Number) check digit for standard product barcodes.
 * 13-digit barcode using alternating weights 1,3 from left.
 * Most common barcode worldwide, standard for retail products.
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

  class EAN13ChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "EAN-13";
      this.description = "EAN-13 (European Article Number) check digit for retail product barcodes. 13-digit identifier (12 data + 1 check) using alternating weights 1,3 from left. Most widely used barcode standard worldwide, found on virtually all retail products globally.";
      this.inventor = "GS1 (formerly EAN International)";
      this.year = 1976;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Product Barcode";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null; // International

      this.checksumSize = 8; // Single digit 0-9

      this.documentation = [
        new LinkItem("EAN-13 on Wikipedia", "https://en.wikipedia.org/wiki/International_Article_Number"),
        new LinkItem("GS1 Standards", "https://www.gs1.org/standards/barcodes/ean-upc"),
        new LinkItem("Barcode Generator", "https://www.gs1.org/services/barcodes/generator")
      ];

      this.notes = [
        "Format: 13 digits (12 data + 1 check)",
        "Country/company code: 7-9 digits",
        "Product code: 3-5 digits",
        "Check digit: 1 digit",
        "Weights: 1,3,1,3,1,3... from left to right",
        "Algorithm: Σ(digit × weight) mod 10, check = (10 - sum) mod 10",
        "Most common barcode globally",
        "Used on: Books, groceries, electronics, etc.",
        "Compatible with: ISBN-13 (prefix 978/979)",
        "Example: 5901234123457"
      ];

      this.tests = [
        {
          text: "Standard EAN-13",
          uri: "https://en.wikipedia.org/wiki/International_Article_Number",
          input: OpCodes.AnsiToBytes("590123412345"),
          expected: [0x07] // Check digit 7 (5901234123457)
        },
        {
          text: "Product barcode",
          uri: "EAN-13 validation",
          input: OpCodes.AnsiToBytes("400638133393"),
          expected: [0x01] // Check digit 1
        },
        {
          text: "Simple test",
          uri: "EAN-13 check",
          input: OpCodes.AnsiToBytes("123456789012"),
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
      return new EAN13ChecksumInstance(this, isInverse);
    }
  }

  /**
 * EAN13Checksum cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class EAN13ChecksumInstance extends IAlgorithmInstance {
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

      // Calculate sum with alternating weights 1,3 from left
      let sum = 0;
      for (let i = 0; i < Math.min(this.digits.length, 12); i++) {
        const weight = (i % 2 === 0) ? 1 : 3;
        sum += this.digits[i] * weight;
      }

      const checkDigit = (10 - (sum % 10)) % 10;
      this.digits = [];
      return [checkDigit];
    }
  }

  RegisterAlgorithm(new EAN13ChecksumAlgorithm());

  return { EAN13ChecksumAlgorithm, EAN13ChecksumInstance };
}));
