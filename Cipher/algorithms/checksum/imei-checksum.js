/*
 * IMEI Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * IMEI (International Mobile Equipment Identity) check digit.
 * 15-digit unique identifier for mobile phones using Luhn algorithm.
 * Required by GSM networks for device identification and tracking.
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

  class IMEIChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "IMEI";
      this.description = "IMEI (International Mobile Equipment Identity) check digit using Luhn algorithm. 15-digit unique identifier for mobile phones (14 digits + 1 check). Used by GSM, WCDMA, LTE networks for device identification, tracking, and blocking stolen phones.";
      this.inventor = "GSMA (GSM Association)";
      this.year = 1992;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Device Identifier";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null; // International

      this.checksumSize = 8; // Single digit 0-9

      this.documentation = [
        new LinkItem("IMEI on Wikipedia", "https://en.wikipedia.org/wiki/International_Mobile_Equipment_Identity"),
        new LinkItem("GSMA IMEI Database", "https://www.gsma.com/services/gsma-device-check/"),
        new LinkItem("IMEI Calculator", "https://www.imei.info/calc/")
      ];

      this.notes = [
        "Format: AA-BBBBBB-CCCCCC-D (TAC-FAC-SNR-CD)",
        "TAC: Type Allocation Code (8 digits)",
        "FAC: Final Assembly Code (2 digits) - deprecated",
        "SNR: Serial Number (6 digits)",
        "CD: Check Digit (1 digit) using Luhn algorithm",
        "Dial *#06# on most phones to see IMEI",
        "Used for: Device tracking, theft reporting, network blocking",
        "Example: 490154203237518",
        "Detects: All single-digit errors",
        "Detects: Most adjacent transposition errors"
      ];

      this.tests = [
        {
          text: "Example IMEI",
          uri: "https://en.wikipedia.org/wiki/International_Mobile_Equipment_Identity",
          input: OpCodes.AnsiToBytes("49015420323751"),
          expected: [0x08] // Check digit 8
        },
        {
          text: "Another IMEI",
          uri: "IMEI validation",
          input: OpCodes.AnsiToBytes("35209900176148"),
          expected: [0x01] // Check digit 1
        },
        {
          text: "IMEI test 864586030236528",
          uri: "https://www.imei.info/calc/",
          input: OpCodes.AnsiToBytes("86458603023652"),
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
      return new IMEIChecksumInstance(this, isInverse);
    }
  }

  /**
 * IMEIChecksum cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class IMEIChecksumInstance extends IAlgorithmInstance {
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

      // Luhn algorithm (double at odd positions from right)
      let sum = 0;

      for (let i = 0; i < this.digits.length; i++) {
        let digit = this.digits[this.digits.length - 1 - i];

        // Double at odd positions (1,3,5... from right)
        if ((i + 1) % 2 === 1) {
          digit *= 2;
          if (digit > 9) {
            digit -= 9;
          }
        }

        sum += digit;
      }

      // Check digit calculation
      const checkDigit = (10 - (sum % 10)) % 10;

      this.digits = [];
      return [checkDigit];
    }
  }

  RegisterAlgorithm(new IMEIChecksumAlgorithm());

  return { IMEIChecksumAlgorithm, IMEIChecksumInstance };
}));
