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

  class ISBNAlgorithm extends Algorithm {
    constructor(variant = '10') {
      super();

      // Get configuration for this variant
      this.config = this._getVariantConfig(variant);

      // Required metadata
      this.name = `ISBN-${variant}`;
      this.description = `${this.config.description} Standard book identifier validation used worldwide in publishing.`;
      this.inventor = "International Organization for Standardization (ISO)";
      this.year = this.config.year;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Publication Identifier";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = this.config.complexity;
      this.country = CountryCode.INTERNATIONAL;

      // Documentation and references
      this.documentation = [
        new LinkItem("ISO 2108 Standard", "https://www.iso.org/standard/36563.html"),
        new LinkItem("ISBN User's Manual", "https://www.isbn-international.org/content/user-manual"),
        new LinkItem("Library of Congress ISBN", "https://www.loc.gov/publish/isbn/")
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

      // Test vectors specific to this variant
      this.tests = this.config.tests;
    }

    _getVariantConfig(variant) {
      const configs = {
        '10': {
          description: 'ISBN-10 checksum using modulo 11 with weighted positions and possible X check digit',
          year: 1970,
          complexity: ComplexityType.INTERMEDIATE,
          tests: [
            new TestCase(
              [0, 3, 0, 6, 4, 0, 6, 1, 5, 9], // Valid ISBN-10: 0-306-40615-9
              [1], // Valid
              "Valid ISBN-10: 0-306-40615-9",
              "Educational test vector"
            ),
            new TestCase(
              [0, 3, 0, 6, 4, 0, 6, 1, 5, 3], // Invalid ISBN-10
              [0], // Invalid
              "Invalid ISBN-10: 0-306-40615-3",
              "Educational test vector"
            ),
            new TestCase(
              [0, 1, 9, 6, 0, 5, 6, 8, 8, 3], // Valid ISBN-10: 0-19-605688-3
              [1], // Valid
              "Valid ISBN-10: 0-19-605688-3",
              "Educational test vector"
            )
          ]
        },
        '13': {
          description: 'ISBN-13 checksum using modulo 10 (EAN-13 based) for modern book identification',
          year: 2007,
          complexity: ComplexityType.BEGINNER,
          tests: [
            new TestCase(
              [9, 7, 8, 0, 3, 0, 6, 4, 0, 6, 1, 5, 7], // Valid ISBN-13: 978-0-306-40615-7
              [1], // Valid
              "Valid ISBN-13: 978-0-306-40615-7",
              "Educational test vector"
            ),
            new TestCase(
              [9, 7, 8, 0, 3, 0, 6, 4, 0, 6, 1, 5, 3], // Invalid ISBN-13
              [0], // Invalid
              "Invalid ISBN-13: 978-0-306-40615-3",
              "Educational test vector"
            ),
            new TestCase(
              [9, 7, 9, 0, 1, 9, 6, 0, 5, 6, 8, 8, 2], // Valid ISBN-13: 979-0-19-605688-2
              [1], // Valid
              "Valid ISBN-13: 979-0-19-605688-2",
              "Educational test vector"
            )
          ]
        }
      };

      return configs[variant] || configs['10'];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      if (isInverse) {
        return null; // ISBN checksums do not support inverse operations
      }
      return new ISBNInstance(this, this.config);
    }
  }

  /**
 * ISBN cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ISBNInstance extends IAlgorithmInstance {
    constructor(algorithm, config) {
      super(algorithm);
      this.config = config;
      this.variant = algorithm.name.split('-')[1]; // Extract '10' or '13'
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
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

        for (let digit of data) {
          if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
            throw new Error('ISBNInstance.Feed: All digits must be 0-9');
          }
        }
      }

      this.digits = data.slice(); // Store a copy
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.digits) {
        return [0]; // Invalid for empty input
      }

      let isValid = false;

      try {
        if (this.variant === '10') {
          isValid = this._validateISBN10();
        } else {
          isValid = this._validateISBN13();
        }
      } catch (error) {
        isValid = false;
      }

      // Reset for next calculation
      this.digits = null;

      return [isValid ? 1 : 0];
    }

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
        sum += this.digits[i] * (i + 1);
      }

      const remainder = sum % 11;
      let expectedCheckDigit;

      if (remainder === 0) {
        expectedCheckDigit = 0;
      } else if (remainder === 1) {
        expectedCheckDigit = 10; // X
      } else {
        expectedCheckDigit = 11 - remainder;
      }

      return this.digits[9] === expectedCheckDigit;
    }

    _validateISBN13() {
      // ISBN-13 algorithm (EAN-13 based):
      // Multiply digits by alternating weights (1, 3, 1, 3, ...)
      // Sum all products
      // Take sum modulo 10
      // Check digit = (10 - remainder) mod 10

      let sum = 0;
      for (let i = 0; i < 12; i++) {
        const weight = (i % 2 === 0) ? 1 : 3;
        sum += this.digits[i] * weight;
      }

      const remainder = sum % 10;
      const expectedCheckDigit = (10 - remainder) % 10;

      return this.digits[12] === expectedCheckDigit;
    }
  }

  // Register all ISBN variants
  RegisterAlgorithm(new ISBNAlgorithm('10'));
  RegisterAlgorithm(new ISBNAlgorithm('13'));

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ISBNAlgorithm, ISBNInstance };
  }

  // ===== EXPORTS =====

  return { ISBNAlgorithm, ISBNInstance };
}));