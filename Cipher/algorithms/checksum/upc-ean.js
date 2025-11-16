/*
 * UPC/EAN Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * UPC (Universal Product Code) and EAN (European Article Number) checksum.
 * Used in product barcodes worldwide (UPC-A, EAN-13, EAN-8).
 * Alternating weight sum algorithm for retail product identification.
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

  class UPCEANAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "UPC-EAN";
      this.description = "UPC/EAN checksum algorithm for product barcodes. Uses alternating weights (3,1,3,1...) from right to left. Used in UPC-A (12 digits), EAN-13 (13 digits), EAN-8 (8 digits) for retail product identification worldwide.";
      this.inventor = "George Laurer (IBM) / GS1";
      this.year = 1973;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Product Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      this.checksumSize = 8; // Single digit 0-9

      this.documentation = [
        new LinkItem("UPC on Wikipedia", "https://en.wikipedia.org/wiki/Universal_Product_Code"),
        new LinkItem("EAN on Wikipedia", "https://en.wikipedia.org/wiki/International_Article_Number"),
        new LinkItem("GS1 Standards", "https://www.gs1.org/standards/barcodes")
      ];

      this.notes = [
        "Algorithm: Alternating weights 3,1,3,1... from right to left",
        "Sum = Σ(digit × weight), check = (10 - sum % 10) % 10",
        "UPC-A: 12 digits (11 data + 1 check)",
        "EAN-13: 13 digits (12 data + 1 check)",
        "EAN-8: 8 digits (7 data + 1 check)",
        "Detects: All single-digit errors",
        "Detects: Most adjacent transposition errors",
        "Used in: Retail products worldwide",
        "Barcode scanning: high reliability in practice"
      ];

      this.tests = [
        {
          text: "UPC-A validation",
          uri: "https://en.wikipedia.org/wiki/Universal_Product_Code",
          input: OpCodes.AnsiToBytes("03600029145"), // Coca-Cola UPC
          expected: [2] // Check digit
        },
        {
          text: "EAN-13 validation",
          uri: "https://www.gs1.org/standards/barcodes",
          input: OpCodes.AnsiToBytes("400638133393"), // EAN-13 example
          expected: [1]
        },
        {
          text: "Simple test",
          uri: "UPC calculation",
          input: OpCodes.AnsiToBytes("12345"),
          expected: [7] // (1*3 + 2*1 + 3*3 + 4*1 + 5*3) % 10 = 3, check = 7
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
      return new UPCEANInstance(this, isInverse);
    }
  }

  /**
 * UPCEAN cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class UPCEANInstance extends IAlgorithmInstance {
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

      // Extract ASCII digits
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

      // UPC/EAN algorithm: alternating weights 3,1 from right to left
      let sum = 0;
      let weight = 3; // Start with weight 3 for rightmost digit

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

  RegisterAlgorithm(new UPCEANAlgorithm());

  return { UPCEANAlgorithm, UPCEANInstance };
}));
