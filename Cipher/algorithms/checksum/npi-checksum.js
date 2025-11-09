/*
 * NPI Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * NPI (National Provider Identifier) check digit for US healthcare providers.
 * 10-digit identifier using Luhn algorithm for physicians, pharmacies, hospitals.
 * Required by HIPAA for electronic healthcare transactions.
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

  class NPIChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "NPI";
      this.description = "NPI (National Provider Identifier) check digit for US healthcare providers using Luhn algorithm. 10-digit unique identifier required by HIPAA for physicians, pharmacies, hospitals in electronic healthcare transactions. Administered by CMS (Centers for Medicare & Medicaid Services).";
      this.inventor = "US Department of Health and Human Services";
      this.year = 2007;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Healthcare Identifier";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      this.checksumSize = 8; // Single digit 0-9

      this.documentation = [
        new LinkItem("NPI on Wikipedia", "https://en.wikipedia.org/wiki/National_Provider_Identifier"),
        new LinkItem("NPI Registry", "https://npiregistry.cms.hhs.gov/"),
        new LinkItem("HIPAA NPI Requirements", "https://www.cms.gov/Regulations-and-Guidance/Administrative-Simplification/NationalProvIdentStand")
      ];

      this.notes = [
        "Format: 10 digits (9 data + 1 check)",
        "All NPIs: First digit is always '1' or '2'",
        "Type 1: Individual providers (1...)",
        "Type 2: Organizations (2...)",
        "Algorithm: Luhn with constant prefix '80840'",
        "Check digit: Luhn('80840' + 9 digits)",
        "Required for: Medicare, Medicaid, HIPAA transactions",
        "Public registry: Available online for lookups",
        "Example: 1234567893",
        "Mandatory since: May 23, 2007"
      ];

      this.tests = [
        {
          text: "Example NPI 1234567893",
          uri: "https://en.wikipedia.org/wiki/National_Provider_Identifier",
          input: OpCodes.AnsiToBytes("123456789"),
          expected: [0x03] // Check digit 3 (1234567893)
        },
        {
          text: "CMS Registry NPI 1993999998",
          uri: "https://npiregistry.cms.hhs.gov/",
          input: OpCodes.AnsiToBytes("199399999"),
          expected: [0x08] // Check digit 8 (1993999998)
        },
        {
          text: "Type 2 Organization NPI",
          uri: "https://www.cms.gov/Regulations-and-Guidance/Administrative-Simplification/NationalProvIdentStand",
          input: OpCodes.AnsiToBytes("234567890"),
          expected: [0x00] // Check digit 0 (2345678900)
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new NPIChecksumInstance(this, isInverse);
    }
  }

  class NPIChecksumInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.digits = [];
      this.prefix = '80840'; // NPI constant prefix for Luhn
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

      // Prepend constant prefix '80840' to NPI digits
      const fullNumber = [];
      for (let i = 0; i < this.prefix.length; i++) {
        fullNumber.push(this.prefix.charCodeAt(i) - 0x30);
      }
      fullNumber.push(...this.digits);

      // Apply Luhn algorithm to full number (double at odd positions from right)
      let sum = 0;

      for (let i = 0; i < fullNumber.length; i++) {
        let digit = fullNumber[fullNumber.length - 1 - i];

        // Double at odd positions (1,3,5... from right)
        if ((i + 1) % 2 === 1) {
          digit *= 2;
          if (digit > 9) {
            digit -= 9;
          }
        }

        sum += digit;
      }

      const checkDigit = (10 - (sum % 10)) % 10;
      this.digits = [];
      return [checkDigit];
    }
  }

  RegisterAlgorithm(new NPIChecksumAlgorithm());

  return { NPIChecksumAlgorithm, NPIChecksumInstance };
}));
