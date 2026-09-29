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

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework and OpCodes dependencies are required');
  }

  if (!OpCodes) {
    throw new Error('AlgorithmFramework and OpCodes dependencies are required');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  /**
   * IBANChecksum algorithm
   * @class
   * @extends {Algorithm}
   */
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

      /** @type {int32} */
      this.checksumSize = 16; // 2 check digits

      this.documentation = [
        new LinkItem("IBAN on Wikipedia", "https://en.wikipedia.org/wiki/International_Bank_Account_Number"),
        new LinkItem("ISO 13616 Standard", "https://www.iso.org/standard/81090.html"),
        new LinkItem("SWIFT IBAN Registry", "https://www.swift.com/standards/data-standards/iban")
      ];

      this.references = [
        new LinkItem("python-stdnum IBAN implementation", "https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/iban.py")
      ];

      /** @type {string[]} */
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

    /**
   * Create new checksum instance
   * @param {boolean} [isInverse=false] - Checksums have no inverse
   * @returns {IBANChecksumInstance} New instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new IBANChecksumInstance(this, isInverse);
    }
  }

  /**
 * IBANChecksum instance implementing the Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class IBANChecksumInstance extends IAlgorithmInstance {
    /**
   * Initialize a checksum instance
   * @param {IBANChecksumAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {string} Upper-cased text fed so far */
      this.data = '';
    }

    /**
   * Feed data to the checksum
   * @param {uint8[]} data - Input data bytes
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Convert bytes to ASCII string
      for (let i = 0; i < data.length; i++) {
        const char = String.fromCharCode(data[i]);
        this.data += char.toUpperCase();
      }
    }

    /**
   * Get the IBAN mod-97 remainder of everything fed so far and reset
   * @returns {uint8[]} Remainder as 2 bytes, big-endian (0 for fewer than 4 characters)
   */

    Result() {
      if (this.data.length < 4) {
        this.data = '';
        return OpCodes.Unpack16BE(0);
      }

      // IBAN algorithm: move first 4 characters to end
      const rearranged = this.data.substring(4) + this.data.substring(0, 4);

      // Convert letters to numbers (A=10, B=11, ..., Z=35)
      let numericString = '';
      for (let i = 0; i < rearranged.length; i++) {
        const code = rearranged.charCodeAt(i);
        if (code >= 0x41 && code <= 0x5A) {        // 'A'..'Z'
          const value = code - 0x41 + 10;
          numericString = numericString + value;
        } else if (code >= 0x30 && code <= 0x39) { // '0'..'9'
          numericString = numericString + rearranged.charAt(i);
        }
      }

      // Calculate mod 97 using sequential processing to avoid overflow
      let remainder = 0;
      for (let i = 0; i < numericString.length; i++) {
        remainder = (remainder * 10 + (numericString.charCodeAt(i) - 0x30)) % 97;
      }

      this.data = '';

      // Return remainder as 2 bytes (big-endian) using OpCodes
      return OpCodes.Unpack16BE(remainder);
    }
  }

  RegisterAlgorithm(new IBANChecksumAlgorithm());

  return { IBANChecksumAlgorithm, IBANChecksumInstance };
}));
