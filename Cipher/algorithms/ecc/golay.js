/*
 * Binary Golay Code [23,12,7] Implementation
 * Perfect error-correcting code capable of correcting up to 3 bit errors
 * Used in NASA Voyager missions and MIL-STD-188
 * (c)2006-2025 Hawkynt
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
          ErrorCorrectionAlgorithm, IErrorCorrectionInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== GOLAY CODE CONSTANTS =====

  const GENPOL = 0x00000C75; // Generator polynomial: X^11 + X^10 + X^6 + X^5 + X^4 + X^2 + 1
  const X11 = 0x00000800;    // X^11
  const X22 = 0x00400000;    // X^22
  const MASK12 = 0xFFF;      // 12-bit mask
  const MASK23 = 0x7FFFFF;   // 23-bit mask

  // ===== ALGORITHM IMPLEMENTATION =====

  class GolayCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Golay";
      this.description = "Binary Golay code [23,12,7] is a perfect error-correcting code capable of correcting up to 3 bit errors or detecting up to 7 errors. Achieves the Hamming bound with 12 data bits encoded into 23-bit codewords. Used in NASA Voyager deep space missions and military communications (MIL-STD-188).";
      this.inventor = "Marcel J. E. Golay";
      this.year = 1949;
      this.category = CategoryType.ECC;
      this.subCategory = "Perfect Codes";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Algorithm capabilities
      this.SupportedBlockSizes = [new KeySize(12, 12, 1)]; // 12-bit blocks only
      this.supportsErrorDetection = true;
      this.supportsErrorCorrection = true;
      this.errorCorrectionCapability = 3; // Can correct up to 3 errors
      this.codeLength = 23;
      this.dataLength = 12;
      this.minDistance = 7;

      // Documentation
      this.documentation = [
        new LinkItem("Binary Golay Code - Wikipedia", "https://en.wikipedia.org/wiki/Binary_Golay_code"),
        new LinkItem("Golay Code - MathWorld", "https://mathworld.wolfram.com/GolayCode.html"),
        new LinkItem("Reference Implementation", "https://github.com/crorvick/outguess/blob/master/golay.c"),
        new LinkItem("Voyager Implementation", "https://sourceforge.isae.fr/projects/simplified-communications-schemes-of-voyager-i-probe/wiki/Golay_Code_Implementation_%E2%80%93_Encoding")
      ];

      // Test vectors (systematic encoding: data in upper 12 bits, parity in lower 11 bits)
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("0000"), // All zeros
          OpCodes.Hex8ToBytes("000000"), // Encoded: 0x000000
          "All zeros test",
          "https://en.wikipedia.org/wiki/Binary_Golay_code"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("0001"), // Data: 0x001
          OpCodes.Hex8ToBytes("000C75"), // Encoded: 0x001 << 11 | syndrome = 0x800 | 0x475 = 0x000C75
          "Single bit pattern",
          "Systematic encoding with generator polynomial 0xC75"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("0FFF"), // All data bits set (12 bits)
          OpCodes.Hex8ToBytes("7FFFFF"), // Encoded: systematic encoding result
          "All data bits set",
          "https://github.com/crorvick/outguess/blob/master/golay.c"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("0AAA"), // Alternating pattern: 101010101010
          OpCodes.Hex8ToBytes("555179"), // Computed systematic encoding
          "Alternating bit pattern",
          "Systematic encoding test"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new GolayCodeInstance(this, isInverse);
    }
  }

  /**
 * GolayCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class GolayCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('GolayCodeInstance.Feed: Input must be byte array');
      }
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.inputBuffer.length === 0) {
        throw new Error('No data fed');
      }

      if (this.isInverse) {
        return this._decode();
      } else {
        return this._encode();
      }
    }

    // Convert byte array to 23-bit integer (big-endian: MSB first)
    _bytesToInt23(bytes) {
      let value = 0;
      for (let i = 0; i < Math.min(bytes.length, 3); i++) {
        value = (value << 8) | (bytes[i] & 0xFF);
      }
      return value & MASK23;
    }

    // Convert 23-bit integer to byte array (big-endian: MSB first)
    _int23ToBytes(value) {
      return [
        (value >>> 16) & 0x7F,
        (value >>> 8) & 0xFF,
        (value) & 0xFF
      ];
    }

    // Convert byte array to 12-bit integer (big-endian: MSB first)
    _bytesToInt12(bytes) {
      let value = 0;
      for (let i = 0; i < Math.min(bytes.length, 2); i++) {
        value = (value << 8) | (bytes[i] & 0xFF);
      }
      return value & MASK12;
    }

    // Convert 12-bit integer to byte array (big-endian: MSB first)
    _int12ToBytes(value) {
      return [
        (value >>> 8) & 0x0F,
        (value) & 0xFF
      ];
    }

    // Calculate syndrome (remainder after division by generator polynomial)
    _getSyndrome(codeword) {
      let syndrome = codeword;

      // Perform modulo-2 division (XOR-based)
      for (let i = 22; i >= 11; i--) {
        if (syndrome & (1 << i)) {
          syndrome ^= (GENPOL << (i - 11));
        }
      }

      return syndrome & ((1 << 11) - 1); // Return 11-bit syndrome
    }

    // Count number of 1-bits (Hamming weight)
    _hammingWeight(value) {
      let count = 0;
      while (value) {
        count += value & 1;
        value >>>= 1;
      }
      return count;
    }

    // Find error pattern from syndrome
    _getErrorPattern(syndrome) {
      if (syndrome === 0) return 0; // No error

      // Try single-bit errors (23 patterns)
      for (let i = 0; i < 23; i++) {
        const pattern = 1 << i;
        if (this._getSyndrome(pattern) === syndrome) {
          return pattern;
        }
      }

      // Try two-bit errors (253 patterns)
      for (let i = 0; i < 23; i++) {
        for (let j = i + 1; j < 23; j++) {
          const pattern = (1 << i) | (1 << j);
          if (this._getSyndrome(pattern) === syndrome) {
            return pattern;
          }
        }
      }

      // Try three-bit errors (1771 patterns)
      for (let i = 0; i < 23; i++) {
        for (let j = i + 1; j < 23; j++) {
          for (let k = j + 1; k < 23; k++) {
            const pattern = (1 << i) | (1 << j) | (1 << k);
            if (this._getSyndrome(pattern) === syndrome) {
              return pattern;
            }
          }
        }
      }

      // Cannot correct - too many errors
      return null;
    }

    _encode() {
      if (this.inputBuffer.length < 2) {
        throw new Error('Golay code requires at least 12 bits (2 bytes) of data');
      }

      // Convert input to 12-bit data
      const data12 = this._bytesToInt12(this.inputBuffer.slice(0, 2));

      // Systematic encoding: multiply data by X^11
      const shifted = (data12 << 11) & MASK23;

      // Calculate syndrome (parity bits)
      const syndrome = this._getSyndrome(shifted);

      // Combine data and parity: codeword = data * X^11 + syndrome
      const codeword = shifted | syndrome;

      this.inputBuffer = [];
      return this._int23ToBytes(codeword);
    }

    _decode() {
      if (this.inputBuffer.length < 3) {
        throw new Error('Golay code requires 23 bits (3 bytes) of encoded data');
      }

      // Convert input to 23-bit codeword
      const received = this._bytesToInt23(this.inputBuffer.slice(0, 3));

      // Calculate syndrome
      const syndrome = this._getSyndrome(received);

      // If syndrome is zero, no errors detected
      if (syndrome === 0) {
        const data12 = (received >>> 11) & MASK12;
        this.inputBuffer = [];
        return this._int12ToBytes(data12);
      }

      // Find error pattern
      const errorPattern = this._getErrorPattern(syndrome);

      if (errorPattern === null) {
        throw new Error('Golay code: Too many errors to correct (>3 bits)');
      }

      // Correct errors
      const corrected = received ^ errorPattern;

      // Extract data bits (upper 12 bits)
      const data12 = (corrected >>> 11) & MASK12;

      this.inputBuffer = [];
      return this._int12ToBytes(data12);
    }

    DetectError(data) {
      if (!data || data.length < 3) return false;

      const received = this._bytesToInt23(data.slice(0, 3));
      const syndrome = this._getSyndrome(received);

      return syndrome !== 0;
    }

    // Get error correction capability
    getMaxCorrectableErrors() {
      return 3;
    }

    // Get code parameters
    getCodeParameters() {
      return {
        n: 23, // Codeword length
        k: 12, // Data length
        d: 7,  // Minimum distance
        t: 3   // Error correction capability
      };
    }
  }

  // Register the algorithm
  const algorithmInstance = new GolayCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return algorithmInstance;

}));
