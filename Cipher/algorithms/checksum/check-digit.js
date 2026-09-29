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

  // ===== TABLES =====

  /** @type {uint8[][]} Verhoeff multiplication table (dihedral group D5) */
  const VERHOEFF_MULTIPLICATION = [
    [0,1,2,3,4,5,6,7,8,9], [1,2,3,4,0,6,7,8,9,5],
    [2,3,4,0,1,7,8,9,5,6], [3,4,0,1,2,8,9,5,6,7],
    [4,0,1,2,3,9,5,6,7,8], [5,9,8,7,6,0,4,3,2,1],
    [6,5,9,8,7,1,0,4,3,2], [7,6,5,9,8,2,1,0,4,3],
    [8,7,6,5,9,3,2,1,0,4], [9,8,7,6,5,4,3,2,1,0]
  ];

  /** @type {uint8[]} Verhoeff inverse table */
  const VERHOEFF_INVERSE = [0,4,3,2,1,5,6,7,8,9];

  /** @type {uint8[][]} Verhoeff permutation table */
  const VERHOEFF_PERMUTATION = [
    [0,1,2,3,4,5,6,7,8,9], [1,5,7,6,2,8,3,0,9,4],
    [5,8,0,3,7,9,6,1,4,2], [8,9,1,6,0,4,3,5,2,7],
    [9,4,5,3,1,2,6,8,7,0], [4,2,8,6,5,7,3,9,0,1],
    [2,7,9,3,8,0,6,4,1,5], [7,0,4,6,9,1,3,2,5,8]
  ];

  /** @type {uint8[][]} Damm operation table (anti-symmetric quasigroup) */
  const DAMM_OPERATION = [
    [0,3,1,7,5,9,8,6,4,2], [7,0,9,2,1,5,4,8,6,3],
    [4,2,0,6,8,7,1,3,5,9], [1,7,5,0,9,8,3,4,2,6],
    [6,1,2,3,0,4,5,9,7,8], [3,6,7,4,2,0,9,5,8,1],
    [5,8,6,9,7,2,0,1,3,4], [8,9,4,5,3,6,2,0,1,7],
    [9,4,3,8,6,1,7,2,0,5], [2,5,8,1,4,3,6,7,9,0]
  ];

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * Check digit validation, one registered algorithm per variant
   * @class
   * @extends {Algorithm}
   */
  class CheckDigitAlgorithm extends Algorithm {
    /**
     * Configure one check digit variant
     * @param {string} [variant='Luhn'] - 'Luhn', 'Verhoeff' or 'Damm' (anything else gets the Luhn metadata)
     */
    constructor(variant = 'Luhn') {
      super();

      /** @type {string} What the variant is used for */
      this.variantDescription = '';

      switch (variant) {
        case 'Verhoeff':
          this.variantDescription = 'Verhoeff algorithm using dihedral group D5 for superior error detection';
          this.inventor = "Jacobus Verhoeff";
          this.year = 1969;
          this.complexity = ComplexityType.INTERMEDIATE;
          this.country = CountryCode.NL;
          this.documentation = [
            new LinkItem("Verhoeff Algorithm Wikipedia", "https://en.wikipedia.org/wiki/Verhoeff_algorithm"),
            new LinkItem("Original Paper", "https://dl.acm.org/doi/10.1145/364096.364100"),
            new LinkItem("Dihedral Group D5", "https://en.wikipedia.org/wiki/Dihedral_group")
          ];
          this.references = [
            new LinkItem("Indian Aadhaar System", "https://uidai.gov.in/"),
            new LinkItem("Mathematical Foundation", "https://mathworld.wolfram.com/DihedralGroup.html"),
            new LinkItem("Error Detection Analysis", "https://www.scientificamerican.com/article/bring-science-home-luhn-algorithm/")
          ];
          this.tests = [
            new TestCase(
              [2, 3, 6, 3], // 236 with its published check digit 3
              [1], // Valid
              "Rosetta Code: 2363 validates",
              "https://rosettacode.org/wiki/Verhoeff_algorithm"
            ),
            new TestCase(
              [2, 3, 6, 9], // 236 with check digit 9 instead of 3
              [0], // Invalid
              "Rosetta Code: 2369 does not validate",
              "https://rosettacode.org/wiki/Verhoeff_algorithm"
            ),
            new TestCase(
              [1, 2, 3, 4, 5, 1], // 12345 with its published check digit 1
              [1], // Valid
              "Rosetta Code: 123451 validates",
              "https://rosettacode.org/wiki/Verhoeff_algorithm"
            ),
            new TestCase(
              [1, 2, 3, 4, 5, 9], // 12345 with check digit 9 instead of 1
              [0], // Invalid
              "Rosetta Code: 123459 does not validate",
              "https://rosettacode.org/wiki/Verhoeff_algorithm"
            ),
            new TestCase(
              [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 0], // 123456789012 with check digit 0
              [1], // Valid
              "Rosetta Code: 1234567890120 validates",
              "https://rosettacode.org/wiki/Verhoeff_algorithm"
            ),
            new TestCase(
              [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 9], // same payload, check digit 9
              [0], // Invalid
              "Rosetta Code: 1234567890129 does not validate",
              "https://rosettacode.org/wiki/Verhoeff_algorithm"
            )
          ];
          break;
        case 'Damm':
          this.variantDescription = 'Damm algorithm using anti-symmetric quasigroups for optimal single-digit error detection';
          this.inventor = "H. Michael Damm";
          this.year = 2004;
          this.complexity = ComplexityType.ADVANCED;
          this.country = CountryCode.DE;
          this.documentation = [
            new LinkItem("Damm Algorithm Wikipedia", "https://en.wikipedia.org/wiki/Damm_algorithm"),
            new LinkItem("PhD Thesis", "https://www.diva-portal.org/smash/get/diva2:831173/FULLTEXT01.pdf"),
            new LinkItem("Quasigroup Theory", "https://en.wikipedia.org/wiki/Quasigroup")
          ];
          this.references = [
            new LinkItem("Singapore IPOS", "https://www.ipos.gov.sg/"),
            new LinkItem("Anti-symmetric Operations", "https://mathworld.wolfram.com/Quasigroup.html"),
            new LinkItem("Error Detection Theory", "https://link.springer.com/article/10.1007/s00200-003-0143-1")
          ];
          this.tests = [
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
          ];
          break;
        default: // 'Luhn'
          this.variantDescription = 'Luhn algorithm (modulo 10) used for credit card validation and many ID numbers';
          this.inventor = "Hans Peter Luhn (IBM)";
          this.year = 1954;
          this.complexity = ComplexityType.BEGINNER;
          this.country = CountryCode.US;
          this.documentation = [
            new LinkItem("Luhn Algorithm Wikipedia", "https://en.wikipedia.org/wiki/Luhn_algorithm"),
            new LinkItem("Credit Card Validation", "https://www.paypal.com/us/webapps/mpp/security/luhn-algorithm"),
            new LinkItem("ISO/IEC 7812", "https://www.iso.org/standard/70484.html")
          ];
          this.references = [
            new LinkItem("Original IBM Paper", "https://dl.acm.org/doi/10.1145/1464291.1464316"),
            new LinkItem("Payment Card Industry", "https://www.pcisecuritystandards.org/"),
            new LinkItem("Mathematical Analysis", "https://mathworld.wolfram.com/LuhnFormula.html")
          ];
          this.tests = [
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
          ];
          break;
      }

      // Required metadata
      this.name = variant + '-Check-Digit';
      this.description = this.variantDescription + ' Validates identification numbers to detect transcription errors.';
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Check Digit Validation";
      this.securityStatus = SecurityStatus.EDUCATIONAL;

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
    }

    /**
   * Create new check digit instance
   * @param {boolean} [isInverse=false] - Check digit algorithms have no inverse
   * @returns {CheckDigitInstance} New instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new CheckDigitInstance(this);
    }
  }

  /**
 * CheckDigit instance implementing the Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class CheckDigitInstance extends IAlgorithmInstance {
    /**
     * Select the variant's validation rule
     * @param {CheckDigitAlgorithm} algorithm - Parent algorithm (the variant)
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {string} Variant name: 'Luhn', 'Verhoeff' or 'Damm' */
      this.algorithmName = algorithm.name.split('-')[0]; // Extract 'Luhn', 'Verhoeff', etc.
      /** @type {uint8[]} Digits fed since the last Result() */
      this.digits = [];

      /** @type {uint8[][]} */
      this.multiTable = VERHOEFF_MULTIPLICATION;
      /** @type {uint8[]} */
      this.invTable = VERHOEFF_INVERSE;
      /** @type {uint8[][]} */
      this.permTable = VERHOEFF_PERMUTATION;
      /** @type {uint8[][]} */
      this.operationTable = DAMM_OPERATION;
    }

    /**
   * Feed digits to validate
   * @param {uint8[]} data - Digits 0-9
   * @throws {Error} If the input is not an array of digits
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('CheckDigitInstance.Feed: Input must be array of digits (0-9)');
      }

      // Validate that all elements are digits
      for (let i = 0; i < data.length; i++) {
        const digit = data[i];
        if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
          throw new Error('CheckDigitInstance.Feed: All elements must be digits 0-9');
        }
      }

      // Feed is a streaming interface: successive calls extend the digit string
      // rather than replace it. A check digit is positional, so a chunk cannot
      // be validated on its own and the digits are collected for Result().
      for (let i = 0; i < data.length; i++) this.digits.push(data[i]);
    }

    /**
   * Validate the digits fed so far and reset for the next number
   * @returns {uint8[]} [1] if the check digit is valid, [0] otherwise (also for no input)
   */

    Result() {
      // Empty input is invalid. Feed admits only the digits 0-9, so every
      // table lookup below stays in range.
      let isValid = false;

      if (this.digits.length > 0) {
        if (this.algorithmName === 'Luhn') {
          isValid = this._validateLuhn();
        } else if (this.algorithmName === 'Verhoeff') {
          isValid = this._validateVerhoeff();
        } else if (this.algorithmName === 'Damm') {
          isValid = this._validateDamm();
        }

        // Reset for next calculation
        this.digits = [];
      }

      return [isValid ? 1 : 0];
    }

    /**
     * Luhn (modulo 10) check
     * @returns {boolean} True if the digits carry a valid Luhn check digit
     */
    _validateLuhn() {
      let sum = 0;
      let alternate = false;

      // Process digits from right to left
      for (let i = this.digits.length - 1; i >= 0; i--) {
        /** @type {int32} */
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

    /**
     * Verhoeff check
     * @returns {boolean} True if the digits carry a valid Verhoeff check digit
     */
    _validateVerhoeff() {
      /** @type {uint8} */
      let checksum = 0;

      // The dihedral group D5 is not commutative, so the order the digits are
      // folded in is part of the algorithm and not a detail: the rightmost
      // digit must be applied first. Walking the digits left to right while
      // merely indexing the permutation table from the right applies the same
      // factors in the opposite order and silently rejects valid numbers.
      for (let pos = 0; pos < this.digits.length; pos++) {
        const digit = this.digits[this.digits.length - 1 - pos];
        const permutedDigit = this.permTable[pos % 8][digit];
        checksum = this.multiTable[checksum][permutedDigit];
      }

      return checksum === 0;
    }

    /**
     * Damm check
     * @returns {boolean} True if the digits carry a valid Damm check digit
     */
    _validateDamm() {
      /** @type {uint8} */
      let interim = 0;

      for (let i = 0; i < this.digits.length; i++) {
        interim = this.operationTable[interim][this.digits[i]];
      }

      return interim === 0;
    }
  }

  // Register all Check Digit variants
  RegisterAlgorithm(new CheckDigitAlgorithm('Luhn'));
  RegisterAlgorithm(new CheckDigitAlgorithm('Verhoeff'));
  RegisterAlgorithm(new CheckDigitAlgorithm('Damm'));

  // ===== EXPORTS =====

  return { CheckDigitAlgorithm, CheckDigitInstance };
}));
