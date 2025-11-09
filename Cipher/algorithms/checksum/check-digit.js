/*
 * Check Digit Algorithms Implementation with Multiple Variants
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Check digit algorithms for validating identification numbers.
 * Luhn: Credit cards, modulo 10 validation
 * Verhoeff: Advanced error detection using dihedral group D5
 * Damm: Modern algorithm detecting all single-digit and transposition errors
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

  class CheckDigitAlgorithm extends Algorithm {
    constructor(variant = 'Luhn') {
      super();

      // Get configuration for this variant
      this.config = this._getVariantConfig(variant);

      // Required metadata
      this.name = `${variant}-Check-Digit`;
      this.description = `${this.config.description} Validates identification numbers to detect transcription errors.`;
      this.inventor = this.config.inventor;
      this.year = this.config.year;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Check Digit Validation";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = this.config.complexity;
      this.country = this.config.country;

      // Documentation and references
      this.documentation = this.config.documentation;
      this.references = this.config.references;

      this.knownVulnerabilities = [
        new Vulnerability(
          "Not Cryptographically Secure", 
          "Designed only for detecting accidental errors, not malicious attacks"
        ),
        new Vulnerability(
          "Limited Security", 
          "Cannot protect against intentional manipulation by knowledgeable attackers"
        )
      ];

      // Test vectors specific to this variant
      this.tests = this.config.tests;
    }

    _getVariantConfig(variant) {
      const configs = {
        'Luhn': {
          description: 'Luhn algorithm (modulo 10) used for credit card validation and many ID numbers',
          inventor: "Hans Peter Luhn (IBM)",
          year: 1954,
          complexity: ComplexityType.BEGINNER,
          country: CountryCode.US,
          documentation: [
            new LinkItem("Luhn Algorithm Wikipedia", "https://en.wikipedia.org/wiki/Luhn_algorithm"),
            new LinkItem("Credit Card Validation", "https://www.paypal.com/us/webapps/mpp/security/luhn-algorithm"),
            new LinkItem("ISO/IEC 7812", "https://www.iso.org/standard/70484.html")
          ],
          references: [
            new LinkItem("Original IBM Paper", "https://dl.acm.org/doi/10.1145/1464291.1464316"),
            new LinkItem("Payment Card Industry", "https://www.pcisecuritystandards.org/"),
            new LinkItem("Mathematical Analysis", "https://mathworld.wolfram.com/LuhnFormula.html")
          ],
          tests: [
            new TestCase(
              [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2], // Valid test Visa card
              [1], // Check digit result: valid (1 for valid, 0 for invalid)
              "Valid test Visa card number",
              "Educational test vector"
            ),
            new TestCase(
              [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3], // Invalid Visa card
              [0], // Check digit result: invalid
              "Invalid test Visa card number",
              "Educational test vector"
            ),
            new TestCase(
              [7, 9, 9, 2, 7, 3, 9, 8, 7, 1, 3, 8], // Valid number with check digit
              [1], // Valid
              "Valid 12-digit number",
              "Educational test vector"
            )
          ]
        },
        'Verhoeff': {
          description: 'Verhoeff algorithm using dihedral group D5 for superior error detection',
          inventor: "Jacobus Verhoeff",
          year: 1969,
          complexity: ComplexityType.INTERMEDIATE,
          country: CountryCode.NL,
          documentation: [
            new LinkItem("Verhoeff Algorithm Wikipedia", "https://en.wikipedia.org/wiki/Verhoeff_algorithm"),
            new LinkItem("Original Paper", "https://dl.acm.org/doi/10.1145/364096.364100"),
            new LinkItem("Dihedral Group D5", "https://en.wikipedia.org/wiki/Dihedral_group")
          ],
          references: [
            new LinkItem("Indian Aadhaar System", "https://uidai.gov.in/"),
            new LinkItem("Mathematical Foundation", "https://mathworld.wolfram.com/DihedralGroup.html"),
            new LinkItem("Error Detection Analysis", "https://www.scientificamerican.com/article/bring-science-home-luhn-algorithm/")
          ],
          tests: [
            new TestCase(
              [2, 3, 6, 4, 0, 7, 1], // Valid number with Verhoeff check digit
              [1], // Valid
              "Valid 7-digit number",
              "Educational test vector"
            ),
            new TestCase(
              [2, 3, 6, 4, 0, 7, 2], // Invalid number
              [0], // Invalid
              "Invalid 7-digit number",
              "Educational test vector"
            ),
            new TestCase(
              [7, 9, 9, 2, 7, 3, 9, 8, 7, 1, 3, 8, 5], // Valid longer number
              [1], // Valid
              "Valid 13-digit number",
              "Educational test vector"
            )
          ]
        },
        'Damm': {
          description: 'Damm algorithm using anti-symmetric quasigroups for optimal single-digit error detection',
          inventor: "H. Michael Damm",
          year: 2004,
          complexity: ComplexityType.ADVANCED,
          country: CountryCode.DE,
          documentation: [
            new LinkItem("Damm Algorithm Wikipedia", "https://en.wikipedia.org/wiki/Damm_algorithm"),
            new LinkItem("PhD Thesis", "https://www.diva-portal.org/smash/get/diva2:831173/FULLTEXT01.pdf"),
            new LinkItem("Quasigroup Theory", "https://en.wikipedia.org/wiki/Quasigroup")
          ],
          references: [
            new LinkItem("Singapore IPOS", "https://www.ipos.gov.sg/"),
            new LinkItem("Anti-symmetric Operations", "https://mathworld.wolfram.com/Quasigroup.html"),
            new LinkItem("Error Detection Theory", "https://link.springer.com/article/10.1007/s00200-003-0143-1")
          ],
          tests: [
            new TestCase(
              [5, 7, 2, 4, 3, 4, 3], // Valid number with Damm check digit
              [1], // Valid
              "Valid 7-digit number",
              "Educational test vector"
            ),
            new TestCase(
              [5, 7, 2, 4, 3, 4, 4], // Invalid number
              [0], // Invalid
              "Invalid 7-digit number", 
              "Educational test vector"
            ),
            new TestCase(
              [9, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 9], // Valid longer number
              [1], // Valid
              "Valid 12-digit number",
              "Educational test vector"
            )
          ]
        }
      };

      return configs[variant] || configs['Luhn'];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      if (isInverse) {
        return null; // Check digit algorithms do not support inverse operations
      }
      return new CheckDigitInstance(this, this.config);
    }
  }

  class CheckDigitInstance extends IAlgorithmInstance {
    constructor(algorithm, config) {
      super(algorithm);
      this.config = config;
      this.algorithmName = algorithm.name.split('-')[0]; // Extract 'Luhn', 'Verhoeff', etc.
      this.initializeTables();
    }

    initializeTables() {
      if (this.algorithmName === 'Verhoeff') {
        // Verhoeff multiplication table (dihedral group D5)
        this.multiTable = [
          [0,1,2,3,4,5,6,7,8,9], [1,2,3,4,0,6,7,8,9,5],
          [2,3,4,0,1,7,8,9,5,6], [3,4,0,1,2,8,9,5,6,7],
          [4,0,1,2,3,9,5,6,7,8], [5,9,8,7,6,0,4,3,2,1],
          [6,5,9,8,7,1,0,4,3,2], [7,6,5,9,8,2,1,0,4,3],
          [8,7,6,5,9,3,2,1,0,4], [9,8,7,6,5,4,3,2,1,0]
        ];

        // Verhoeff inverse table
        this.invTable = [0,4,3,2,1,5,6,7,8,9];

        // Verhoeff permutation table
        this.permTable = [
          [0,1,2,3,4,5,6,7,8,9], [1,5,7,6,2,8,3,0,9,4],
          [5,8,0,3,7,9,6,1,4,2], [8,9,1,6,0,4,3,5,2,7],
          [9,4,5,3,1,2,6,8,7,0], [4,2,8,6,5,7,3,9,0,1],
          [2,7,9,3,8,0,6,4,1,5], [7,0,4,6,9,1,3,2,5,8]
        ];
      } else if (this.algorithmName === 'Damm') {
        // Damm operation table (anti-symmetric quasigroup)
        this.operationTable = [
          [0,3,1,7,5,9,8,6,4,2], [7,0,9,2,1,5,4,8,6,3],
          [4,2,0,6,8,7,1,3,5,9], [1,7,5,0,9,8,3,4,2,6],
          [6,1,2,3,0,4,5,9,7,8], [3,6,7,4,2,0,9,5,8,1],
          [5,8,6,9,7,2,0,1,3,4], [8,9,4,5,3,6,2,0,1,7],
          [9,4,3,8,6,1,7,2,0,5], [2,5,8,1,4,3,6,7,9,0]
        ];
      }
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('CheckDigitInstance.Feed: Input must be array of digits (0-9)');
      }

      // Validate that all elements are digits
      for (let digit of data) {
        if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
          throw new Error('CheckDigitInstance.Feed: All elements must be digits 0-9');
        }
      }

      this.digits = data.slice(); // Store a copy
    }

    Result() {
      if (!this.digits || this.digits.length === 0) {
        return [0]; // Invalid for empty input
      }

      let isValid = false;

      try {
        if (this.algorithmName === 'Luhn') {
          isValid = this._validateLuhn();
        } else if (this.algorithmName === 'Verhoeff') {
          isValid = this._validateVerhoeff();
        } else if (this.algorithmName === 'Damm') {
          isValid = this._validateDamm();
        }
      } catch (error) {
        isValid = false;
      }

      // Reset for next calculation
      this.digits = null;

      return [isValid ? 1 : 0];
    }

    _validateLuhn() {
      let sum = 0;
      let alternate = false;

      // Process digits from right to left
      for (let i = this.digits.length - 1; i >= 0; i--) {
        let digit = this.digits[i];

        if (alternate) {
          digit *= 2;
          if (digit > 9) {
            digit = (digit % 10) + 1; // Same as digit - 9
          }
        }

        sum += digit;
        alternate = !alternate;
      }

      return (sum % 10) === 0;
    }

    _validateVerhoeff() {
      let checksum = 0;

      for (let i = 0; i < this.digits.length; i++) {
        const pos = this.digits.length - i - 1; // Position from right
        const permutedDigit = this.permTable[pos % 8][this.digits[i]];
        checksum = this.multiTable[checksum][permutedDigit];
      }

      return checksum === 0;
    }

    _validateDamm() {
      let interim = 0;

      for (let digit of this.digits) {
        interim = this.operationTable[interim][digit];
      }

      return interim === 0;
    }
  }

  // Register all Check Digit variants
  RegisterAlgorithm(new CheckDigitAlgorithm('Luhn'));
  RegisterAlgorithm(new CheckDigitAlgorithm('Verhoeff'));
  RegisterAlgorithm(new CheckDigitAlgorithm('Damm'));

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CheckDigitAlgorithm, CheckDigitInstance };
  }

  // ===== EXPORTS =====

  return { CheckDigitAlgorithm, CheckDigitInstance };
}));