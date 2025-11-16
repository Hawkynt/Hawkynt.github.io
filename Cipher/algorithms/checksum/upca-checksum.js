/*
 * UPC-A Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * UPC-A (Universal Product Code) check digit for North American products.
 * 12-digit barcode using alternating weights 3,1 from right.
 * Standard retail barcode in USA and Canada, precursor to EAN-13.
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

  class UPCAChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "UPC-A";
      this.description = "UPC-A (Universal Product Code) check digit for North American retail products. 12-digit identifier (11 data + 1 check) using alternating weights 3,1 from right. Developed by IBM in 1973, first scanned in 1974 on Wrigley's gum. Standard barcode in USA and Canada.";
      this.inventor = "George Laurer (IBM)";
      this.year = 1973;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Product Barcode";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      this.checksumSize = 8; // Single digit 0-9

      this.documentation = [
        new LinkItem("UPC-A on Wikipedia", "https://en.wikipedia.org/wiki/Universal_Product_Code"),
        new LinkItem("GS1 US Standards", "https://www.gs1us.org/upcs-barcodes-prefixes"),
        new LinkItem("UPC History", "https://www.smithsonianmag.com/innovation/history-of-bar-code-180956704/")
      ];

      this.notes = [
        "Format: 12 digits (11 data + 1 check)",
        "Number system digit: 1 digit (0-9)",
        "Manufacturer code: 5 digits",
        "Product code: 5 digits",
        "Check digit: 1 digit",
        "Weights: 3,1,3,1,3,1,3,1,3,1,3 from left to right",
        "First product scanned: Wrigley's gum (1974)",
        "Used primarily in: USA and Canada",
        "Subset of: GTIN-12",
        "Example: 036000291452 (Coca-Cola)"
      ];

      this.tests = [
        {
          text: "Coca-Cola Classic UPC",
          uri: "https://en.wikipedia.org/wiki/Universal_Product_Code",
          input: OpCodes.AnsiToBytes("03600029145"),
          expected: [0x02] // Check digit 2 (036000291452)
        },
        {
          text: "Coke 12oz Can UPC",
          uri: "https://www.upcdatabase.com/item/012000181788",
          input: OpCodes.AnsiToBytes("01200018178"),
          expected: [0x08] // Check digit 8 (012000181788)
        },
        {
          text: "Campbell's Soup UPC",
          uri: "https://www.upcdatabase.com/item/051000012234",
          input: OpCodes.AnsiToBytes("05100001223"),
          expected: [0x04] // Check digit 4 (051000012234)
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
      return new UPCAChecksumInstance(this, isInverse);
    }
  }

  /**
 * UPCAChecksum cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class UPCAChecksumInstance extends IAlgorithmInstance {
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

      // Calculate sum with alternating weights 3,1 from left
      let sum = 0;
      let weight = 3;

      for (let i = 0; i < this.digits.length; i++) {
        sum += this.digits[i] * weight;
        weight = (weight === 3) ? 1 : 3;
      }

      const checkDigit = (10 - (sum % 10)) % 10;
      this.digits = [];
      return [checkDigit];
    }
  }

  RegisterAlgorithm(new UPCAChecksumAlgorithm());

  return { UPCAChecksumAlgorithm, UPCAChecksumInstance };
}));
