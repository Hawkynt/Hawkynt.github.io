/*
 * IBAN Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * IBAN (International Bank Account Number) checksum validation.
 * Uses modulo-97 algorithm per ISO 13616.
 * Standard international bank account number format with check digits.
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

  class IBANChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "IBAN";
      this.description = "IBAN (International Bank Account Number) checksum using modulo-97 algorithm per ISO 13616. Validates international bank accounts with 2-digit check digits. Format: CC12BANK-ACCOUNT where CC is country code, 12 is check digits. Used in SEPA transactions worldwide.";
      this.inventor = "European Committee for Banking Standards";
      this.year = 1997;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Banking Standard";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = null; // International

      this.checksumSize = 16; // 2 check digits

      this.documentation = [
        new LinkItem("IBAN on Wikipedia", "https://en.wikipedia.org/wiki/International_Bank_Account_Number"),
        new LinkItem("ISO 13616 Standard", "https://www.iso.org/standard/81090.html"),
        new LinkItem("SWIFT IBAN Registry", "https://www.swift.com/standards/data-standards/iban")
      ];

      this.notes = [
        "Format: CC12BBBBSSSSAAAA... (Country, Check, Bank, Branch, Account)",
        "Algorithm: Move first 4 chars to end, replace letters with numbers (A=10...Z=35)",
        "Calculate: mod 97 of resulting number should equal 1 for valid IBAN",
        "Check digit calculation: 98 - (mod 97 of account with check=00)",
        "Length varies by country: 15-34 characters",
        "Detects: 97.3% of all errors",
        "Detects: All single character errors",
        "Detects: All double transposition errors",
        "Used in: SEPA payments, international transfers"
      ];

      this.tests = [
        {
          text: "German IBAN",
          uri: "https://en.wikipedia.org/wiki/International_Bank_Account_Number",
          input: OpCodes.AnsiToBytes("DE89370400440532013000"),
          expected: [0x00, 0x01] // Valid IBAN returns 1 (mod 97 = 1)
        },
        {
          text: "UK IBAN",
          uri: "IBAN validation",
          input: OpCodes.AnsiToBytes("GB82WEST12345698765432"),
          expected: [0x00, 0x01] // Valid IBAN
        },
        {
          text: "Check digit calculation - Invalid IBAN",
          uri: "https://en.wikipedia.org/wiki/International_Bank_Account_Number",
          input: OpCodes.AnsiToBytes("GB00WEST12345698765432"),
          expected: [0x00, 0x10] // Invalid IBAN with check=00 returns remainder 16 (check digits would be 98-16=82)
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new IBANChecksumInstance(this, isInverse);
    }
  }

  class IBANChecksumInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.data = '';
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      // Convert bytes to ASCII string
      for (let i = 0; i < data.length; i++) {
        const char = String.fromCharCode(data[i]);
        this.data += char.toUpperCase();
      }
    }

    Result() {
      if (this.data.length < 4) {
        this.data = '';
        return [0, 0];
      }

      // IBAN algorithm: move first 4 characters to end
      const rearranged = this.data.substring(4) + this.data.substring(0, 4);

      // Convert letters to numbers (A=10, B=11, ..., Z=35)
      let numericString = '';
      for (let i = 0; i < rearranged.length; i++) {
        const char = rearranged[i];
        if (char >= 'A' && char <= 'Z') {
          numericString += (char.charCodeAt(0) - 'A'.charCodeAt(0) + 10).toString();
        } else if (char >= '0' && char <= '9') {
          numericString += char;
        }
      }

      // Calculate mod 97 using sequential processing to avoid overflow
      let remainder = 0;
      for (let i = 0; i < numericString.length; i++) {
        remainder = (remainder * 10 + parseInt(numericString[i], 10)) % 97;
      }

      this.data = '';

      // Return remainder as 2 bytes (big-endian) using OpCodes
      return OpCodes.Unpack16BE(remainder);
    }
  }

  RegisterAlgorithm(new IBANChecksumAlgorithm());

  return { IBANChecksumAlgorithm, IBANChecksumInstance };
}));
