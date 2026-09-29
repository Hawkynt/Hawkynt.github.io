/*
 * VIN Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * VIN (Vehicle Identification Number) check digit calculation.
 * Used in automotive industry per ISO 3779 and SAE J853.
 * 17-character alphanumeric code with weighted sum algorithm.
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

  /** @type {int32[]} Transliteration value of 'A'..'Z' (-1 for I, O and Q, which a VIN never contains) */
  const LETTER_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, -1, 1, 2, 3, 4, 5, -1, 7, -1, 9, 2, 3, 4, 5, 6, 7, 8, 9];

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  /**
   * VIN check digit computation (ISO 3779)
   * @class
   * @extends {Algorithm}
   */
  class VINChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "VIN";
      this.description = "VIN (Vehicle Identification Number) check digit calculation per ISO 3779 and SAE J853. 17-character alphanumeric code using weighted sum modulo 11. Position 9 is check digit (0-9 or X). Used for automotive vehicle identification worldwide.";
      this.inventor = "National Highway Traffic Safety Administration (NHTSA)";
      this.year = 1981;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Vehicle Identification";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.checksumSize = 8; // Single character (0-9 or X)

      this.documentation = [
        new LinkItem("VIN on Wikipedia", "https://en.wikipedia.org/wiki/Vehicle_identification_number"),
        new LinkItem("ISO 3779 Standard", "https://www.iso.org/standard/52200.html"),
        new LinkItem("NHTSA VIN Decoder", "https://www.nhtsa.gov/vin-decoder")
      ];

      this.references = [
        new LinkItem("vininfo - VIN parsing and checksum verification library", "https://github.com/idlesign/vininfo")
      ];

      this.notes = [
        "Format: 17 alphanumeric characters (excludes I, O, Q to avoid confusion with 1, 0)",
        "Position 9: Check digit (0-9 or X for 10)",
        "Weights: 8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2 (position 1-17)",
        "Letter values: A=1, B=2, C=3, D=4, E=5, F=6, G=7, H=8, J=1, K=2, L=3, M=4, N=5, P=7, R=9, S=2, T=3, U=4, V=5, W=6, X=7, Y=8, Z=9",
        "Algorithm: Σ(character_value × weight) mod 11",
        "Check digit: result of mod 11 (10 represented as 'X')",
        "Used in: North America (mandatory), many other countries",
        "Detects: Most transcription errors"
      ];

      this.tests = [
        {
          text: "VIN with check digit X (1M8GDM9AXKP042788)",
          uri: "https://en.wikibooks.org/wiki/Vehicle_Identification_Numbers_(VIN_codes)/Check_digit",
          input: OpCodes.AnsiToBytes("1M8GDM9AXKP042788"),
          expected: [0x0A] // Check digit X (10) - position 9
        },
        {
          text: "VIN all ones (11111111111111111)",
          uri: "https://scientificgems.wordpress.com/2018/04/27/mathematics-in-action-vehicle-identifications-numbers/",
          input: OpCodes.AnsiToBytes("11111111111111111"),
          expected: [0x01] // Check digit 1 - position 9
        },
        {
          text: "VIN example (5YJ3E1EAXHF000316)",
          uri: "https://vpic.nhtsa.dot.gov/decoder/CheckDigit/Index/5yj3e1eaxhf000316",
          input: OpCodes.AnsiToBytes("5YJ3E1EAXHF000316"),
          expected: [0x0A] // Check digit X (10) - position 9
        }
      ];
    }

    /**
   * Create new checksum instance
   * @param {boolean} [isInverse=false] - Checksums have no inverse
   * @returns {VINChecksumInstance} New instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new VINChecksumInstance(this, isInverse);
    }
  }

  /**
 * VINChecksum instance implementing the Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class VINChecksumInstance extends IAlgorithmInstance {
    /**
   * Initialize a VIN checksum instance
   * @param {VINChecksumAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]} Transliterated values of the VIN characters fed so far */
      this.values = [];

      // Position weights (1-17)
      /** @type {int32[]} */
      this.weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
    }

    /**
   * Feed ASCII text; VIN characters (digits and letters except I, O, Q, either case) are collected
   * @param {uint8[]} data - Input data bytes
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Extract alphanumeric characters
      for (let i = 0; i < data.length; i++) {
        const value = this._charValue(data[i]);
        if (value >= 0) {
          this.values.push(value);
        }
      }
    }

    /**
     * Transliteration value of one ASCII character
     * @param {int32} code - Character code
     * @returns {int32} 0..9, or -1 if the character is not part of a VIN
     */
    _charValue(code) {
      if (code >= 0x30 && code <= 0x39) return code - 0x30;   // '0'..'9'
      if (code >= 0x61 && code <= 0x7A) code = code - 0x20;   // 'a'..'z' as 'A'..'Z'
      if (code >= 0x41 && code <= 0x5A) return LETTER_VALUES[code - 0x41];
      return -1;
    }

    /**
   * Compute the check digit over the first 17 VIN characters fed and reset
   * @returns {uint8[]} One byte: the check digit 0..10 (10 = X; 0 when nothing was fed)
   */

    Result() {
      // Calculate weighted sum (no character leaves it at 0)
      let sum = 0;
      for (let i = 0; i < this.values.length && i < 17; i++) {
        /** @type {int32} */
        const value = this.values[i];
        sum += value * this.weights[i];
      }

      // Check digit is sum mod 11
      const checkDigit = sum % 11;

      this.values = [];
      return [checkDigit]; // 0-9 or 10 (X)
    }
  }

  RegisterAlgorithm(new VINChecksumAlgorithm());

  return { VINChecksumAlgorithm, VINChecksumInstance };
}));
