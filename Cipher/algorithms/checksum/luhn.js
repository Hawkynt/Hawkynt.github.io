/*
 * Luhn Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Luhn algorithm (mod 10 algorithm) used for credit card validation.
 * Invented by Hans Peter Luhn in 1954 at IBM.
 * Used in credit cards, IMEI numbers, Canadian Social Insurance Numbers.
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
   * Luhn algorithm
   * @class
   * @extends {Algorithm}
   */
  class LuhnAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "Luhn";
      this.description = "Luhn algorithm (mod 10 algorithm) for validating identification numbers. Invented by Hans Peter Luhn at IBM in 1954. Used in credit cards, IMEI, Canadian SIN. Detects all single-digit errors and most adjacent transpositions.";
      this.inventor = "Hans Peter Luhn (IBM)";
      this.year = 1954;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Check Digit";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      /** @type {int32} */
      this.checksumSize = 8; // Single digit 0-9

      this.documentation = [
        new LinkItem("Luhn Algorithm on Wikipedia", "https://en.wikipedia.org/wiki/Luhn_algorithm"),
        new LinkItem("US Patent 2,950,048", "https://patents.google.com/patent/US2950048A/en"),
        new LinkItem("Credit Card Validation", "https://www.creditcardvalidator.org/articles/luhn-algorithm")
      ];

      this.references = [
        new LinkItem("python-stdnum Luhn implementation", "https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/luhn.py")
      ];

      /** @type {string[]} */
      this.notes = [
        "Algorithm: From right to left, double every second digit",
        "If doubled digit > 9, subtract 9 (equivalent to adding digits: 16→1+6=7)",
        "Sum all digits, check digit = (10 - sum % 10) % 10",
        "Validation: sum of all digits including check digit ≡ 0 (mod 10)",
        "Detects: All single-digit errors",
        "Detects: Most (but not all) adjacent transpositions",
        "Used in: Visa, MasterCard, American Express, IMEI numbers",
        "Not cryptographically secure - only for error detection"
      ];

      this.tests = [
        {
          text: "Rosetta Code test vector 49927398716",
          uri: "https://rosettacode.org/wiki/Luhn_test_of_credit_card_numbers",
          input: OpCodes.AnsiToBytes("4992739871"), // Valid Luhn number without check digit
          expected: [6] // Check digit making 49927398716
        },
        {
          text: "Rosetta Code test vector 1234567812345670",
          uri: "https://rosettacode.org/wiki/Luhn_test_of_credit_card_numbers",
          input: OpCodes.AnsiToBytes("123456781234567"), // Valid without check digit
          expected: [0] // Check digit making 1234567812345670
        },
        {
          text: "Simple Luhn test 12345674",
          uri: "https://rosettacode.org/wiki/Luhn_test_of_credit_card_numbers",
          input: OpCodes.AnsiToBytes("1234567"), // Simple test case
          expected: [4] // Check digit making 12345674
        }
      ];
    }

    /**
   * Create new checksum instance
   * @param {boolean} [isInverse=false] - Checksums have no inverse
   * @returns {LuhnInstance} New instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new LuhnInstance(this, isInverse);
    }
  }

  /**
 * Luhn instance implementing the Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class LuhnInstance extends IAlgorithmInstance {
    /**
   * Initialize a checksum instance
   * @param {LuhnAlgorithm} algorithm - Parent algorithm instance
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

      // Extract ASCII digits
      for (let i = 0; i < data.length; i++) {
        const char = String.fromCharCode(data[i]);
        if (char >= '0' && char <= '9') {
          /** @type {int32} */
          const code = data[i];
          this.digits.push(code - 0x30); // Convert ASCII to digit
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

      // Luhn algorithm: process from right to left, double at odd positions
      let sum = 0;

      for (let i = 0; i < this.digits.length; i++) {
        let digit = this.digits[this.digits.length - 1 - i];

        // Double at odd positions (1,3,5... from right)
        if ((i + 1) % 2 === 1) {
          digit *= 2;
          if (digit > 9) {
            digit -= 9; // Equivalent to summing digits: 16→1+6=7
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

  RegisterAlgorithm(new LuhnAlgorithm());

  return { LuhnAlgorithm, LuhnInstance };
}));
