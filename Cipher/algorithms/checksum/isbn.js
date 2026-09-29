/*
 * ISBN Checksum Implementation with Multiple Variants
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * International Standard Book Number (ISBN) checksum algorithms.
 * ISBN-10: Uses modulo 11 with possible 'X' check digit
 * ISBN-13: Uses modulo 10 (modified EAN-13) checksum
 * Critical for book publishing and library systems worldwide.
 */

// Load AlgorithmFramework (REQUIRED)

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
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
    throw new Error('AlgorithmFramework dependency is required');
  }
  
  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * ISBN check digit validation, one registered algorithm per format
   * @class
   * @extends {Algorithm}
   */
  class ISBNAlgorithm extends Algorithm {
    /**
     * Configure one ISBN format
     * @param {string} [variant='10'] - '10' or '13' (anything else gets the ISBN-10 metadata)
     */
    constructor(variant = '10') {
      super();

      /** @type {string} What the variant validates */
      this.variantDescription = '';
      /** @type {string[]} Algorithm notes */
      this.notes = [];

      switch (variant) {
        case '13':
          this.variantDescription = 'ISBN-13 checksum using modulo 10 (EAN-13 based) for modern book identification';
          this.year = 2007;
          this.complexity = ComplexityType.BEGINNER;
          this.notes = [
            "Format: 13 digits (12 data + 1 check)",
            "Prefix: 978 (Bookland) or 979 (additional capacity)",
            "Weights: alternating 1,3,1,3,... from left to right",
            "Algorithm: sum(digit * weight) mod 10",
            "Check digit: (10 - sum mod 10) mod 10",
            "Example: 978-0-306-40615-7",
            "Compatible with the EAN-13/GTIN-13 barcode system",
            "Supersedes ISBN-10 since 2007",
            "Detects: all single-digit errors and most adjacent transposition errors"
          ];
          this.tests = [
            new TestCase(
              [9, 7, 8, 0, 3, 0, 6, 4, 0, 6, 1, 5, 7], // Valid ISBN-13: 978-0-306-40615-7
              [1], // Valid
              "Valid ISBN-13: 978-0-306-40615-7",
              "https://en.wikipedia.org/wiki/International_Standard_Book_Number"
            ),
            new TestCase(
              [9, 7, 8, 0, 3, 0, 6, 4, 0, 6, 1, 5, 3], // Invalid ISBN-13
              [0], // Invalid
              "Invalid ISBN-13: 978-0-306-40615-3",
              "https://en.wikipedia.org/wiki/International_Standard_Book_Number"
            ),
            new TestCase(
              [9, 7, 9, 0, 1, 9, 6, 0, 5, 6, 8, 8, 2], // Valid ISBN-13: 979-0-19-605688-2
              [1], // Valid
              "Valid ISBN-13: 979-0-19-605688-2",
              "https://en.wikipedia.org/wiki/International_Standard_Book_Number"
            )
          ];
          break;
        default: // '10'
          this.variantDescription = 'ISBN-10 checksum using modulo 11 with weighted positions and possible X check digit';
          this.year = 1970;
          this.complexity = ComplexityType.INTERMEDIATE;
          this.notes = [
            "Format: 10 digits (9 data + 1 check)",
            "Weights: 1,2,3,4,5,6,7,8,9 applied left to right (equivalently 10,9,...,2 read right to left)",
            "Algorithm: check digit d10 chosen so that sum(i=1..10, i * digit_i) ≡ 0 (mod 11)",
            "Check digit: 0 if remainder is 0, 'X' (=10) if remainder is 1, otherwise 11 minus the remainder",
            "Example: 0-306-40615-9 (Structured Computer Organization, Tanenbaum)",
            "Superseded by ISBN-13 in 2007",
            "Detects: all single-digit errors and most transposition errors"
          ];
          this.tests = [
            new TestCase(
              [0, 3, 0, 6, 4, 0, 6, 1, 5, 9], // Valid ISBN-10: 0-306-40615-9
              [1], // Valid
              "Valid ISBN-10: 0-306-40615-9",
              "https://en.wikipedia.org/wiki/International_Standard_Book_Number"
            ),
            new TestCase(
              [0, 3, 0, 6, 4, 0, 6, 1, 5, 3], // Invalid ISBN-10
              [0], // Invalid
              "Invalid ISBN-10: 0-306-40615-3",
              "https://en.wikipedia.org/wiki/International_Standard_Book_Number"
            ),
            new TestCase(
              [0, 1, 9, 6, 0, 5, 6, 8, 8, 3], // Valid ISBN-10: 0-19-605688-3
              [1], // Valid
              "Valid ISBN-10: 0-19-605688-3",
              "https://en.wikipedia.org/wiki/International_Standard_Book_Number"
            )
          ];
          break;
      }

      // Required metadata
      this.name = 'ISBN-' + variant;
      this.description = this.variantDescription + ' Standard book identifier validation used worldwide in publishing.';
      this.inventor = "International Organization for Standardization (ISO)";
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Publication Identifier";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.country = CountryCode.INTERNATIONAL;
      /** @type {int32} */
      this.checksumSize = 8; // Single check digit (0-9, or 'X'=10 for ISBN-10), fits in a byte

      // Documentation and references
      this.documentation = [
        new LinkItem("ISO 2108 Standard", "https://www.iso.org/standard/36563.html"),
        new LinkItem("ISBN User's Manual", "https://www.isbn-international.org/content/user-manual"),
        new LinkItem("Library of Congress ISBN", "https://www.loc.gov/publish/isbn/"),
        new LinkItem("ISBN on Wikipedia", "https://en.wikipedia.org/wiki/International_Standard_Book_Number")
      ];

      this.references = [
        new LinkItem("International ISBN Agency", "https://www.isbn-international.org/"),
        new LinkItem("Publisher Guidelines", "https://www.isbn.org/"),
        new LinkItem("WorldCat Library Database", "https://www.worldcat.org/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Not Cryptographically Secure", 
          "Designed for accidental error detection only, not security"
        ),
        new Vulnerability(
          "Limited Error Detection", 
          "Cannot detect all types of transcription errors"
        )
      ];
    }

    /**
   * Create new ISBN instance
   * @param {boolean} [isInverse=false] - ISBN checksums have no inverse
   * @returns {ISBNInstance} New instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new ISBNInstance(this);
    }
  }

  /**
 * ISBN instance implementing the Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class ISBNInstance extends IAlgorithmInstance {
    /**
     * Select the format's validation rule
     * @param {ISBNAlgorithm} algorithm - Parent algorithm (the format)
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {string} Format: '10' or '13' */
      this.variant = algorithm.name.split('-')[1]; // Extract '10' or '13'
      /** @type {uint8[]} The number fed last, empty when none is pending */
      this.digits = [];
    }

    /**
   * Feed one complete ISBN (replaces any number fed before)
   * @param {uint8[]} data - 10 digits (the last may be 10 for X) or 13 digits
   * @throws {Error} If the input is not a well-formed ISBN digit array
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('ISBNInstance.Feed: Input must be array of digits (0-10 for ISBN-10, 0-9 for ISBN-13)');
      }

      // Validate input based on variant
      if (this.variant === '10') {
        if (data.length !== 10) {
          throw new Error('ISBNInstance.Feed: ISBN-10 must have exactly 10 digits');
        }

        // For ISBN-10, digits can be 0-9, and last digit can be 0-10 (where 10 = X)
        for (let i = 0; i < data.length; i++) {
          if (!Number.isInteger(data[i]) || data[i] < 0) {
            throw new Error('ISBNInstance.Feed: All digits must be non-negative integers');
          }
          if (i < 9 && data[i] > 9) {
            throw new Error('ISBNInstance.Feed: First 9 digits must be 0-9');
          }
          if (i === 9 && data[i] > 10) {
            throw new Error('ISBNInstance.Feed: Check digit must be 0-10 (where 10 = X)');
          }
        }
      } else { // ISBN-13
        if (data.length !== 13) {
          throw new Error('ISBNInstance.Feed: ISBN-13 must have exactly 13 digits');
        }

        for (let i = 0; i < data.length; i++) {
          const digit = data[i];
          if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
            throw new Error('ISBNInstance.Feed: All digits must be 0-9');
          }
        }
      }

      this.digits = data.slice(); // Store a copy
    }

    /**
   * Validate the number fed last and reset
   * @returns {uint8[]} [1] if the check digit is valid, [0] otherwise (also when nothing was fed)
   */

    Result() {
      // Nothing fed is invalid. Feed admits only well-formed digit arrays of
      // the exact length, so the validators below stay in range.
      let isValid = false;

      if (this.digits.length > 0) {
        if (this.variant === '10') {
          isValid = this._validateISBN10();
        } else {
          isValid = this._validateISBN13();
        }

        // Reset for next calculation
        this.digits = [];
      }

      return [isValid ? 1 : 0];
    }

    /**
     * ISBN-10 check (weighted modulo 11)
     * @returns {boolean} True if the check digit matches
     */
    _validateISBN10() {
      // ISBN-10 algorithm:
      // Multiply each of the first 9 digits by its position (1, 2, 3, ..., 9)
      // Sum these products
      // Take the sum modulo 11
      // If remainder is 0, check digit is 0
      // If remainder is 1, check digit is X (represented as 10)
      // Otherwise, check digit is 11 minus the remainder

      let sum = 0;
      for (let i = 0; i < 9; i++) {
        /** @type {int32} */
        const digit = this.digits[i];
        sum += digit * (i + 1);
      }

      const remainder = sum % 11;
      /** @type {int32} */
      let expectedCheckDigit = 0;

      if (remainder === 0) {
        expectedCheckDigit = 0;
      } else if (remainder === 1) {
        expectedCheckDigit = 10; // X
      } else {
        expectedCheckDigit = 11 - remainder;
      }

      return this.digits[9] === expectedCheckDigit;
    }

    /**
     * ISBN-13 check (EAN-13 weights 1, 3, modulo 10)
     * @returns {boolean} True if the check digit matches
     */
    _validateISBN13() {
      // ISBN-13 algorithm (EAN-13 based):
      // Multiply digits by alternating weights (1, 3, 1, 3, ...)
      // Sum all products
      // Take sum modulo 10
      // Check digit = (10 - remainder) mod 10

      let sum = 0;
      for (let i = 0; i < 12; i++) {
        const weight = (i % 2 === 0) ? 1 : 3;
        /** @type {int32} */
        const digit = this.digits[i];
        sum += digit * weight;
      }

      const remainder = sum % 10;
      const expectedCheckDigit = (10 - remainder) % 10;

      return this.digits[12] === expectedCheckDigit;
    }
  }

  // Register all ISBN variants
  RegisterAlgorithm(new ISBNAlgorithm('10'));
  RegisterAlgorithm(new ISBNAlgorithm('13'));

  // ===== EXPORTS =====

  return { ISBNAlgorithm, ISBNInstance };
}));
