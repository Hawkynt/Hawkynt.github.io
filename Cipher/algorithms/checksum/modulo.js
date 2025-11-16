/*
 * Modulo Checksum Implementations (10, 11, 97)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Consolidated modulo checksum algorithms:
 * - Modulo-10: Simple digit sum for basic validation
 * - Modulo-11: Weighted checksum for ISBN-10/ISSN
 * - Modulo-97: IBAN validation per ISO 7064
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

  // ============================================================================
  // MODULO-10 CHECKSUM
  // ============================================================================

  class Modulo10ChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "Modulo-10";
      this.description = "Simple modulo-10 checksum for digit sequences. Sums all digits and returns remainder when divided by 10. Basic error detection for barcodes and identification numbers.";
      this.inventor = "Unknown (fundamental technique)";
      this.year = 1960;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Modular Arithmetic";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null;

      this.checksumSize = 8; // Returns single digit (0-9)

      this.documentation = [
        new LinkItem("Check Digit Algorithms", "https://en.wikipedia.org/wiki/Check_digit"),
        new LinkItem("Modulo Checksums", "https://www.geeksforgeeks.org/check-digit/")
      ];

      this.notes = [
        "Algorithm: sum all digits, result mod 10",
        "Check digit: (10 - sum mod 10) mod 10",
        "Very simple, weak error detection",
        "Used in: Simple barcodes, basic validation",
        "Cannot detect digit transposition errors",
        "Output: single digit 0-9"
      ];

      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes("123"), // 1+2+3 = 6
          [6],
          "Simple digit sum",
          "Modulo-10 calculation"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("987"), // 9+8+7 = 24, 24 mod 10 = 4
          [4],
          "Sum with overflow",
          "Modulo-10 with carry"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("1234567890"), // Sum = 45, mod 10 = 5
          [5],
          "Long digit sequence",
          "Modulo-10 calculation"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new Modulo10ChecksumInstance(this, isInverse);
    }
  }

  /**
 * Modulo10Checksum cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Modulo10ChecksumInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.sum = 0;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Sum all ASCII digits
      for (let i = 0; i < data.length; i++) {
        const char = String.fromCharCode(data[i]);
        if (char >= '0' && char <= '9') {
          this.sum += (data[i] - 0x30); // '0' = 0x30
        }
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      const result = this.sum % 10;
      this.sum = 0;
      return [result];
    }
  }

  // ============================================================================
  // MODULO-11 CHECKSUM
  // ============================================================================

  class Modulo11ChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "Modulo-11";
      this.description = "Modulo-11 weighted checksum used in ISBN-10, ISSN, and various identification systems. Uses position-based weights to detect single-digit errors and most transposition errors. Check digit can be 0-9 or X (representing 10).";
      this.inventor = "ISBN/ISSN standard";
      this.year = 1970;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Modular Arithmetic";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null;

      this.checksumSize = 8; // Returns 0-10 (X)

      this.documentation = [
        new LinkItem("ISBN Check Digit", "https://en.wikipedia.org/wiki/International_Standard_Book_Number"),
        new LinkItem("Modulo 11 Algorithm", "https://www.geeksforgeeks.org/program-check-isbn/"),
        new LinkItem("Check Digit Systems", "https://en.wikipedia.org/wiki/Check_digit")
      ];

      this.notes = [
        "Algorithm: weighted sum with position-based weights",
        "Standard weights: (n+1), n, (n-1), ..., 2 from LEFT to RIGHT",
        "For ISBN-10 (9 digits): weights are 10, 9, 8, 7, 6, 5, 4, 3, 2",
        "Check digit: (11 - sum mod 11) mod 11",
        "Result 10 represented as 'X' in ISBN",
        "Used in: ISBN-10, ISSN, bank routing numbers",
        "Detects: All single-digit errors",
        "Detects: Most adjacent transposition errors",
        "Output: 0-9 or 10 (for 'X')"
      ];

      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes("012000008"), // ISBN-10 example without check digit
          [3], // Check digit: (11 - (0*10 + 1*9 + 2*8 + 0*7 + 0*6 + 0*5 + 0*4 + 0*3 + 8*2) mod 11) mod 11 = (11 - 41 mod 11) mod 11 = (11 - 8) mod 11 = 3
          "ISBN-10 format",
          "https://en.wikipedia.org/wiki/International_Standard_Book_Number"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("123456789"), // Simple sequence
          [10], // Weighted sum: 1*10 + 2*9 + 3*8 + 4*7 + 5*6 + 6*5 + 7*4 + 8*3 + 9*2 = 210; 210 mod 11 = 1; (11 - 1) mod 11 = 10 (X)
          "Simple digit sequence",
          "Modulo-11 weighted checksum"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("00"), // Simple test
          [0], // (11 - (0*2 + 0*1) mod 11) mod 11 = 0
          "Zero digits",
          "Modulo-11 edge case"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new Modulo11ChecksumInstance(this, isInverse);
    }
  }

  /**
 * Modulo11Checksum cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Modulo11ChecksumInstance extends IAlgorithmInstance {
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

      // Collect ASCII digits
      for (let i = 0; i < data.length; i++) {
        const char = String.fromCharCode(data[i]);
        if (char >= '0' && char <= '9') {
          this.digits.push(data[i] - 0x30); // '0' = 0x30
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

      // Calculate weighted sum (weights from left to right: 10, 9, 8, ..., 2)
      // For ISBN-10: first digit × 10 + second digit × 9 + ... + ninth digit × 2
      let sum = 0;
      const n = this.digits.length;

      for (let i = 0; i < n; i++) {
        const weight = n + 1 - i; // For n=9: weights are 10, 9, 8, 7, 6, 5, 4, 3, 2
        sum += this.digits[i] * weight;
      }

      // Check digit calculation: (11 - sum mod 11) mod 11
      const checkDigit = (11 - (sum % 11)) % 11;

      this.digits = [];
      return [checkDigit];
    }
  }

  // ============================================================================
  // MODULO-97 CHECKSUM
  // ============================================================================

  class Modulo97ChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "Modulo-97";
      this.description = "Modulo-97 checksum algorithm used in IBAN (International Bank Account Number) validation per ISO 7064. Detects up to 99% of single-digit errors and all transposition errors. Uses mod-97-10 check digit calculation.";
      this.inventor = "ISO 7064 standard";
      this.year = 1983;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Modular Arithmetic";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null;

      this.checksumSize = 8; // Returns 1-byte value (0-96)

      this.documentation = [
        new LinkItem("ISO 7064:1983 Standard", "https://en.wikipedia.org/wiki/ISO_7064"),
        new LinkItem("IBAN Validation", "https://en.wikipedia.org/wiki/International_Bank_Account_Number"),
        new LinkItem("Modulo 97 Algorithm", "https://www.geeksforgeeks.org/iban-validator/")
      ];

      this.notes = [
        "Algorithm: Convert digits to number, compute mod 97",
        "Used in: IBAN validation (mod-97-10)",
        "Check digit calculation: 98 - (number mod 97)",
        "Validation: (number with check digits) mod 97 == 1",
        "Detects: ~99% single-digit errors",
        "Detects: All adjacent transposition errors",
        "For IBAN: letters converted A=10, B=11, ..., Z=35",
        "Output: remainder (0-96), or check digits (02-98)"
      ];

      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes("123456"), // Simple digit sequence
          [72], // 123456 mod 97 = 72 (step-by-step: 1→1, 12→12, 123→26, 1234→70, 12345→26, 123456→72)
          "Simple digit sequence",
          "Modulo-97 calculation"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("98"), // Check digit test
          [1], // 98 mod 97 = 1 (valid IBAN check verification)
          "IBAN check digit validation",
          "Valid IBAN check digit"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("999999"), // Large number
          [26], // 999999 mod 97 = 26 (sequential modulo calculation to prevent overflow)
          "Large digit sequence",
          "Modulo-97 overflow handling"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new Modulo97ChecksumInstance(this, isInverse);
    }
  }

  /**
 * Modulo97Checksum cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Modulo97ChecksumInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.digitString = '';
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Convert bytes to ASCII digits
      for (let i = 0; i < data.length; i++) {
        const char = String.fromCharCode(data[i]);
        // Accept digits 0-9
        if (char >= '0' && char <= '9') {
          this.digitString += char;
        }
        // Accept letters A-Z (for IBAN: A=10, B=11, ..., Z=35)
        else if (char >= 'A' && char <= 'Z') {
          const value = char.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
          this.digitString += value.toString();
        }
        else if (char >= 'a' && char <= 'z') {
          const value = char.charCodeAt(0) - 'a'.charCodeAt(0) + 10;
          this.digitString += value.toString();
        }
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.digitString.length === 0) {
        this.digitString = '';
        return [0];
      }

      // Calculate mod 97 using sequential digit processing
      // (avoids overflow for very long numbers)
      let remainder = 0;

      for (let i = 0; i < this.digitString.length; i++) {
        const digit = parseInt(this.digitString[i], 10);
        remainder = (remainder * 10 + digit) % 97;
      }

      this.digitString = '';
      return [remainder];
    }
  }

  // ============================================================================
  // REGISTER ALL ALGORITHMS
  // ============================================================================

  RegisterAlgorithm(new Modulo10ChecksumAlgorithm());
  RegisterAlgorithm(new Modulo11ChecksumAlgorithm());
  RegisterAlgorithm(new Modulo97ChecksumAlgorithm());

  return {
    Modulo10ChecksumAlgorithm,
    Modulo10ChecksumInstance,
    Modulo11ChecksumAlgorithm,
    Modulo11ChecksumInstance,
    Modulo97ChecksumAlgorithm,
    Modulo97ChecksumInstance
  };
}));
