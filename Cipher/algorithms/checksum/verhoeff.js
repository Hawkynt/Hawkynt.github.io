/*
 * Verhoeff Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Verhoeff algorithm - advanced check digit system invented by Jacobus Verhoeff.
 * Detects ALL single-digit errors and ALL adjacent transposition errors.
 * Uses dihedral group D5 for superior error detection compared to Luhn.
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

  class VerhoeffAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "Verhoeff";
      this.description = "Verhoeff algorithm using dihedral group D5 for superior error detection. Detects ALL single-digit errors and ALL adjacent transposition errors, unlike Luhn. Invented by Dutch mathematician Jacobus Verhoeff in 1969.";
      this.inventor = "Jacobus Verhoeff";
      this.year = 1969;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Check Digit";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.NL; // Netherlands

      this.checksumSize = 8; // Single digit 0-9

      this.documentation = [
        new LinkItem("Verhoeff Algorithm on Wikipedia", "https://en.wikipedia.org/wiki/Verhoeff_algorithm"),
        new LinkItem("Error Detecting Decimal Codes (1969)", "https://pure.tue.nl/ws/files/1951436/597473.pdf"),
        new LinkItem("Verhoeff Calculator", "https://planetcalc.com/2464/")
      ];

      this.notes = [
        "Uses three mathematical tables: multiplication, permutation, inverse",
        "Based on dihedral group D5 (symmetries of pentagon)",
        "Detects: 100% of single-digit errors",
        "Detects: 100% of adjacent transposition errors",
        "Detects: 95.3% of twin errors (e.g., 22→33)",
        "Detects: 94.2% of jump transpositions (e.g., abc→cba)",
        "Superior to Luhn but more complex",
        "Used in: German Betriebsnummer, SIM card serial numbers"
      ];

      this.tests = [
        {
          text: "Rosetta Code test vector 236",
          uri: "https://rosettacode.org/wiki/Verhoeff_algorithm",
          input: OpCodes.AnsiToBytes("236"),
          expected: [3] // Verhoeff check digit for "236" is 3
        },
        {
          text: "Rosetta Code test vector 12345",
          uri: "https://rosettacode.org/wiki/Verhoeff_algorithm",
          input: OpCodes.AnsiToBytes("12345"),
          expected: [1] // Verhoeff check digit for "12345" is 1
        },
        {
          text: "Rosetta Code test vector 123456789012",
          uri: "https://rosettacode.org/wiki/Verhoeff_algorithm",
          input: OpCodes.AnsiToBytes("123456789012"),
          expected: [0] // Verhoeff check digit for "123456789012" is 0
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
      return new VerhoeffInstance(this, isInverse);
    }
  }

  /**
 * Verhoeff cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class VerhoeffInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.digits = [];

      // Multiplication table (dihedral group D5)
      this.d = [
        [0,1,2,3,4,5,6,7,8,9],
        [1,2,3,4,0,6,7,8,9,5],
        [2,3,4,0,1,7,8,9,5,6],
        [3,4,0,1,2,8,9,5,6,7],
        [4,0,1,2,3,9,5,6,7,8],
        [5,9,8,7,6,0,4,3,2,1],
        [6,5,9,8,7,1,0,4,3,2],
        [7,6,5,9,8,2,1,0,4,3],
        [8,7,6,5,9,3,2,1,0,4],
        [9,8,7,6,5,4,3,2,1,0]
      ];

      // Permutation table
      this.p = [
        [0,1,2,3,4,5,6,7,8,9],
        [1,5,7,6,2,8,3,0,9,4],
        [5,8,0,3,7,9,6,1,4,2],
        [8,9,1,6,0,4,3,5,2,7],
        [9,4,5,3,1,2,6,8,7,0],
        [4,2,8,6,5,7,3,9,0,1],
        [2,7,9,3,8,0,6,4,1,5],
        [7,0,4,6,9,1,3,2,5,8]
      ];

      // Inverse table
      this.inv = [0,4,3,2,1,5,6,7,8,9];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Extract ASCII digits
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

      // Verhoeff algorithm: process from right to left
      let c = 0;

      for (let i = 0; i < this.digits.length; i++) {
        const digit = this.digits[this.digits.length - 1 - i]; // Right to left
        const permutedDigit = this.p[(i + 1) % 8][digit];
        c = this.d[c][permutedDigit];
      }

      // Check digit is the inverse of c
      const checkDigit = this.inv[c];

      this.digits = [];
      return [checkDigit];
    }
  }

  RegisterAlgorithm(new VerhoeffAlgorithm());

  return { VerhoeffAlgorithm, VerhoeffInstance };
}));
