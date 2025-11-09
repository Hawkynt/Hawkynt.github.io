/*
 * PLANET Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * PLANET (Postal Alpha Numeric Encoding Technique) check digit.
 * US Postal Service tracking system for Confirm Service mailings.
 * Similar to POSTNET but with different encoding for tracking numbers.
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

  class PLANETChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "PLANET";
      this.description = "PLANET (Postal Alpha Numeric Encoding Technique) check digit for US Postal Service Confirm Service. 12 or 14 digits for tracking business reply mail and other tracked mailings. Uses same modulo-10 algorithm as POSTNET but different barcode format.";
      this.inventor = "United States Postal Service";
      this.year = 1993;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Postal Tracking";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      this.checksumSize = 8; // Single digit 0-9

      this.documentation = [
        new LinkItem("PLANET Code on Wikipedia", "https://en.wikipedia.org/wiki/PLANET_Code"),
        new LinkItem("USPS Confirm Service", "https://postalpro.usps.com/mailing/confirm-service"),
        new LinkItem("Postal Barcodes", "https://postalpro.usps.com/mailing/barcode-systems")
      ];

      this.notes = [
        "Format: 12 or 14 digits + 1 check digit",
        "Used for: Business reply mail, tracking",
        "Algorithm: Same as POSTNET (sum mod 10)",
        "Barcode: Height-encoded bars (different from POSTNET)",
        "Service ID: 2 digits identifying mail class",
        "Mailer ID: 6-8 digits",
        "Sequence: 0-6 digits",
        "Check digit: (10 - sum mod 10) mod 10",
        "Used: 1993-2013",
        "Superseded by: Intelligent Mail Barcode"
      ];

      this.tests = [
        {
          text: "PLANET 12-digit",
          uri: "https://en.wikipedia.org/wiki/PLANET_Code",
          input: OpCodes.AnsiToBytes("123456789012"),
          expected: [0x02] // Sum=48, check=(10-48%10)%10=2
        },
        {
          text: "PLANET 14-digit",
          uri: "https://en.wikipedia.org/wiki/PLANET_Code",
          input: OpCodes.AnsiToBytes("12345678901234"),
          expected: [0x05] // Sum=55, check=(10-55%10)%10=5
        },
        {
          text: "Simple sequence",
          uri: "https://en.wikipedia.org/wiki/PLANET_Code",
          input: OpCodes.AnsiToBytes("000000000000"),
          expected: [0x00] // Sum=0, check=0
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new PLANETChecksumInstance(this, isInverse);
    }
  }

  class PLANETChecksumInstance extends IAlgorithmInstance {
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

      // Sum all digits (same algorithm as POSTNET)
      let sum = 0;
      for (let i = 0; i < this.digits.length; i++) {
        sum += this.digits[i];
      }

      // Check digit: (10 - sum mod 10) mod 10
      const checkDigit = (10 - (sum % 10)) % 10;

      this.digits = [];
      return [checkDigit];
    }
  }

  RegisterAlgorithm(new PLANETChecksumAlgorithm());

  return { PLANETChecksumAlgorithm, PLANETChecksumInstance };
}));
