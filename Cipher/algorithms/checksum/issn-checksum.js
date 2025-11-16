/*
 * ISSN Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * ISSN (International Standard Serial Number) check digit calculation.
 * 8-digit code for periodical publications (journals, magazines).
 * Uses modulo-11 weighted sum algorithm per ISO 3297.
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

  class ISSNChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "ISSN";
      this.description = "ISSN (International Standard Serial Number) check digit calculation per ISO 3297. 8-digit identifier for periodical publications with modulo-11 weighted sum. Format: XXXX-XXXX where last digit is check digit (0-9 or X). Used for journals, magazines, newspapers worldwide.";
      this.inventor = "International Organization for Standardization";
      this.year = 1975;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Publication Identifier";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null; // International

      this.checksumSize = 8; // Single digit 0-9 or X

      this.documentation = [
        new LinkItem("ISSN on Wikipedia", "https://en.wikipedia.org/wiki/International_Standard_Serial_Number"),
        new LinkItem("ISO 3297 Standard", "https://www.iso.org/standard/39601.html"),
        new LinkItem("ISSN Portal", "https://portal.issn.org/")
      ];

      this.notes = [
        "Format: 8 digits, often written as XXXX-XXXX",
        "Position 8: Check digit (0-9 or X for 10)",
        "Weights: 8,7,6,5,4,3,2 (positions 1-7)",
        "Algorithm: Σ(digit × weight) mod 11",
        "Check digit: (11 - sum mod 11) mod 11, where 10 = 'X'",
        "Example: ISSN 0378-5955 (Audiology journal)",
        "Detects: All single-digit errors",
        "Detects: Most transposition errors",
        "Used by: Libraries, databases, citation systems"
      ];

      this.tests = [
        {
          text: "Nature journal (0028-0836)",
          uri: "https://portal.issn.org/resource/ISSN/0028-0836",
          input: OpCodes.AnsiToBytes("0028083"),
          expected: [0x06] // Check digit 6 (ISSN 0028-0836)
        },
        {
          text: "Science journal (0036-8075)",
          uri: "https://portal.issn.org/resource/ISSN/0036-8075",
          input: OpCodes.AnsiToBytes("0036807"),
          expected: [0x05] // Check digit 5 (ISSN 0036-8075)
        },
        {
          text: "Library of Congress example (0317-8471)",
          uri: "https://www.loc.gov/issn/basics/basics-checkdigit.html",
          input: OpCodes.AnsiToBytes("0317847"),
          expected: [0x01] // Check digit 1 (ISSN 0317-8471)
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
      return new ISSNChecksumInstance(this, isInverse);
    }
  }

  /**
 * ISSNChecksum cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ISSNChecksumInstance extends IAlgorithmInstance {
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

      // Calculate weighted sum (weights: 8,7,6,5,4,3,2 for positions 1-7)
      let sum = 0;
      for (let i = 0; i < Math.min(this.digits.length, 7); i++) {
        sum += this.digits[i] * (8 - i);
      }

      // Check digit: (11 - sum mod 11) mod 11
      const checkDigit = (11 - (sum % 11)) % 11;

      this.digits = [];
      return [checkDigit]; // 0-9 or 10 (X)
    }
  }

  RegisterAlgorithm(new ISSNChecksumAlgorithm());

  return { ISSNChecksumAlgorithm, ISSNChecksumInstance };
}));
