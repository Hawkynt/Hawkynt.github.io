/*
 * ICCID Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * ICCID (Integrated Circuit Card Identifier) check digit for SIM cards.
 * 18-20 digit unique identifier using Luhn algorithm.
 * Standard identifier for cellular SIM cards worldwide per ITU-T E.118.
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

  class ICCIDChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "ICCID";
      this.description = "ICCID (Integrated Circuit Card Identifier) check digit for SIM cards using Luhn algorithm. 18-20 digit identifier per ITU-T E.118 standard. Format: 89 (telecom) + CC (country) + issuer + account + check digit. Used in GSM, UMTS, LTE SIM cards worldwide.";
      this.inventor = "ITU-T (International Telecommunication Union)";
      this.year = 1998;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Telecom Identifier";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null; // International

      this.checksumSize = 8; // Single digit 0-9

      this.documentation = [
        new LinkItem("ICCID on Wikipedia", "https://en.wikipedia.org/wiki/SIM_card"),
        new LinkItem("ITU-T E.118", "https://www.itu.int/rec/T-REC-E.118/en"),
        new LinkItem("SIM Card Numbering", "https://www.gsma.com/aboutus/wp-content/uploads/2014/12/ts.06-v5.0.pdf")
      ];

      this.notes = [
        "Format: 89 CC II... (18-20 digits)",
        "89: Major industry identifier (Telecom)",
        "CC: Country code (ISO 3166-1 numeric)",
        "II: Issuer identifier",
        "Account/serial number + check digit",
        "Algorithm: Luhn (same as credit cards)",
        "Usually printed on SIM card",
        "Command: AT+CCID or AT+ICCID",
        "Example: 89014103211234567890",
        "Detects: All single-digit errors"
      ];

      this.tests = [
        {
          text: "Official ICCID 89148000005339755555",
          uri: "https://www.itu.int/rec/T-REC-E.118/en",
          input: OpCodes.AnsiToBytes("8914800000533975555"),
          expected: [0x05] // Check digit 5 (89148000005339755555)
        },
        {
          text: "US AT&T ICCID pattern",
          uri: "https://www.gsma.com/aboutus/wp-content/uploads/2014/12/ts.06-v5.0.pdf",
          input: OpCodes.AnsiToBytes("8901410123456789012"),
          expected: [0x02] // Check digit 2
        },
        {
          text: "DE Vodafone ICCID pattern",
          uri: "https://www.itu.int/rec/T-REC-E.118/en",
          input: OpCodes.AnsiToBytes("8949101234567890123"),
          expected: [0x02] // Check digit 2
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
      return new ICCIDChecksumInstance(this, isInverse);
    }
  }

  /**
 * ICCIDChecksum cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ICCIDChecksumInstance extends IAlgorithmInstance {
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

      const checkDigit = (10 - (sum % 10)) % 10;
      this.digits = [];
      return [checkDigit];
    }
  }

  RegisterAlgorithm(new ICCIDChecksumAlgorithm());

  return { ICCIDChecksumAlgorithm, ICCIDChecksumInstance };
}));
