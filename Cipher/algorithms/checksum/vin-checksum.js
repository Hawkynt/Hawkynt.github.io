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

  if (!AlgorithmFramework || !OpCodes) {
    throw new Error('AlgorithmFramework and OpCodes dependencies are required');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

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
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new VINChecksumInstance(this, isInverse);
    }
  }

  /**
 * VINChecksum cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class VINChecksumInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.chars = [];

      // Character value mapping
      this.charValues = {
        'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
        'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
        'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9,
        '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9
      };

      // Position weights (1-17)
      this.weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Extract alphanumeric characters
      for (let i = 0; i < data.length; i++) {
        const char = String.fromCharCode(data[i]).toUpperCase();
        if (this.charValues[char] !== undefined) {
          this.chars.push(char);
        }
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.chars.length === 0) {
        this.chars = [];
        return [0];
      }

      // Calculate weighted sum
      let sum = 0;
      for (let i = 0; i < Math.min(this.chars.length, 17); i++) {
        const value = this.charValues[this.chars[i]] || 0;
        sum += value * this.weights[i];
      }

      // Check digit is sum mod 11
      const checkDigit = sum % 11;

      this.chars = [];
      return [checkDigit]; // 0-9 or 10 (X)
    }
  }

  RegisterAlgorithm(new VINChecksumAlgorithm());

  return { VINChecksumAlgorithm, VINChecksumInstance };
}));
