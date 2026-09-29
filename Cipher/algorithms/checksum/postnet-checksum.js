/*
 * POSTNET Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * POSTNET (Postal Numeric Encoding Technique) check digit.
 * US Postal Service barcode system for automated mail sorting.
 * Simple modulo-10 sum for ZIP codes and delivery point codes.
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
   * POSTNETChecksum algorithm
   * @class
   * @extends {Algorithm}
   */
  class POSTNETChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "POSTNET";
      this.description = "POSTNET (Postal Numeric Encoding Technique) check digit for US Postal Service barcodes. Simple modulo-10 sum algorithm for ZIP codes and delivery point codes. Used in automated mail sorting from 1982-2013, superseded by Intelligent Mail Barcode.";
      this.inventor = "United States Postal Service";
      this.year = 1982;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Postal Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      /** @type {int32} */
      this.checksumSize = 8; // Single digit 0-9

      this.documentation = [
        new LinkItem("POSTNET on Wikipedia", "https://en.wikipedia.org/wiki/POSTNET"),
        new LinkItem("USPS Publication 25", "https://pe.usps.com/text/pub25/welcome.htm"),
        new LinkItem("Postal Barcodes", "https://postalpro.usps.com/mailing/barcode-systems")
      ];

      this.references = [
        new LinkItem("tc-lib-barcode POSTNET implementation", "https://github.com/tecnickcom/tc-lib-barcode/blob/main/src/Type/Linear/Postnet.php")
      ];

      /** @type {string[]} */
      this.notes = [
        "Format: 5, 9, or 11 digits + 1 check digit",
        "ZIP: 5 digits (12345)",
        "ZIP+4: 9 digits (12345-6789)",
        "ZIP+4+2: 11 digits (12345-6789-01)",
        "Algorithm: Sum all digits, check = (10 - sum mod 10) mod 10",
        "Barcode: Vertical bars (tall = 1, short = 0)",
        "Used: 1982-2013 in US mail",
        "Superseded by: Intelligent Mail Barcode (IMb)",
        "Simple error detection only"
      ];

      this.tests = [
        {
          text: "ZIP code",
          uri: "https://en.wikipedia.org/wiki/POSTNET",
          input: OpCodes.AnsiToBytes("12345"),
          expected: [0x05] // Sum=15, check=5
        },
        {
          text: "ZIP+4",
          uri: "POSTNET validation",
          input: OpCodes.AnsiToBytes("123456789"),
          expected: [0x05] // Sum=45, check=5
        },
        {
          text: "ZIP+4+2",
          uri: "https://en.wikipedia.org/wiki/POSTNET",
          input: OpCodes.AnsiToBytes("12345678901"),
          expected: [0x04] // Sum=46, check=(10-46%10)%10=4
        }
      ];
    }

    /**
   * Create new checksum instance
   * @param {boolean} [isInverse=false] - Checksums have no inverse
   * @returns {POSTNETChecksumInstance} New instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new POSTNETChecksumInstance(this, isInverse);
    }
  }

  /**
 * POSTNETChecksum instance implementing the Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class POSTNETChecksumInstance extends IAlgorithmInstance {
    /**
   * Initialize a checksum instance
   * @param {POSTNETChecksumAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {int32[]} Decimal digits fed since the last Result() */
      this.digits = [];
    }

    /**
   * Feed data to the checksum
   * @param {uint8[]} data - Input data bytes
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Extract digits
      for (let i = 0; i < data.length; i++) {
        const char = String.fromCharCode(data[i]);
        if (char >= '0' && char <= '9') {
          /** @type {int32} */
          const code = data[i];
          this.digits.push(code - 0x30);
        }
      }
    }

    /**
   * Get the checksum of everything fed so far and reset for the next message
   * @returns {uint8[]} Checksum bytes
   */

    Result() {
      if (this.digits.length === 0) {
        this.digits = [];
        /** @type {uint8[]} */
        const none = [0];
        return none;
      }

      // Sum all digits
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

  RegisterAlgorithm(new POSTNETChecksumAlgorithm());

  return { POSTNETChecksumAlgorithm, POSTNETChecksumInstance };
}));
