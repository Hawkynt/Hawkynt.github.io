/*
 * Parity Check Algorithms Implementation with Multiple Variants
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Fundamental parity check algorithms for basic error detection.
 * Simple Parity: Single bit XOR for odd/even parity
 * Longitudinal Parity: Multi-byte XOR checksum
 * Educational implementations showing basic error detection principles.
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

  class ParityAlgorithm extends Algorithm {
    constructor(variant = 'Even') {
      super();

      // Get configuration for this variant
      this.config = this._getVariantConfig(variant);

      // Required metadata
      this.name = `${variant}-Parity`;
      this.description = `${this.config.description} Fundamental error detection using XOR operations.`;
      this.inventor = "Richard Hamming";
      this.year = 1950;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Parity Check";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Parity Check Wikipedia", "https://en.wikipedia.org/wiki/Parity_bit"),
        new LinkItem("Error Detection Theory", "https://en.wikipedia.org/wiki/Error_detection_and_correction"),
        new LinkItem("Hamming Code", "https://en.wikipedia.org/wiki/Hamming_code")
      ];

      this.references = [
        new LinkItem("Claude Shannon Papers", "https://www.bell-labs.com/usr/dmr/www/shannondp.html"),
        new LinkItem("Richard Hamming Biography", "https://history.computer.org/pioneers/hamming.html"),
        new LinkItem("Error Correction Codes", "https://www.cambridge.org/core/books/introduction-to-coding-theory/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Single Error Detection Only", 
          "Can only detect odd numbers of bit errors, not even numbers"
        ),
        new Vulnerability(
          "No Correction Capability", 
          "Can detect errors but cannot correct them"
        ),
        new Vulnerability(
          "Weak Against Burst Errors", 
          "Poor performance against consecutive bit errors"
        )
      ];

      // Test vectors specific to this variant
      this.tests = this.config.tests;
    }

    _getVariantConfig(variant) {
      const configs = {
        'Even': {
          description: 'Even parity check ensuring total number of 1 bits is even',
          parityType: 'even',
          tests: [
            new TestCase(
              [],
              OpCodes.Hex8ToBytes("00"),
              "Empty data",
              "Even parity of empty data is 0"
            ),
            new TestCase(
              [0xFF], // 11111111 (8 bits set) - even count
              OpCodes.Hex8ToBytes("00"),
              "Single byte 0xFF",
              "8 bits set - even parity"
            ),
            new TestCase(
              [0x0F], // 00001111 (4 bits set) - even count
              OpCodes.Hex8ToBytes("00"),
              "Single byte 0x0F",
              "4 bits set - even parity"
            ),
            new TestCase(
              [0x07], // 00000111 (3 bits set) - odd count
              OpCodes.Hex8ToBytes("01"),
              "Single byte 0x07",
              "3 bits set - odd parity needs correction"
            )
          ]
        },
        'Odd': {
          description: 'Odd parity check ensuring total number of 1 bits is odd',
          parityType: 'odd',
          tests: [
            new TestCase(
              [],
              OpCodes.Hex8ToBytes("01"),
              "Empty data",
              "Odd parity of empty data is 1"
            ),
            new TestCase(
              [0xFF], // 11111111 (8 bits set) - even count
              OpCodes.Hex8ToBytes("01"),
              "Single byte 0xFF",
              "8 bits set - needs odd parity bit"
            ),
            new TestCase(
              [0x0F], // 00001111 (4 bits set) - even count
              OpCodes.Hex8ToBytes("01"),
              "Single byte 0x0F",
              "4 bits set - needs odd parity bit"
            ),
            new TestCase(
              [0x07], // 00000111 (3 bits set) - odd count
              OpCodes.Hex8ToBytes("00"),
              "Single byte 0x07",
              "3 bits set - already odd"
            )
          ]
        },
        'Longitudinal': {
          description: 'Longitudinal parity check using XOR of all bytes for multi-byte error detection',
          parityType: 'longitudinal',
          tests: [
            new TestCase(
              [],
              OpCodes.Hex8ToBytes("00"),
              "Empty data",
              "XOR of empty data is 0"
            ),
            new TestCase(
              [0xAA, 0x55], // 10101010 XOR 01010101 = 11111111
              OpCodes.Hex8ToBytes("ff"),
              "Bytes 0xAA, 0x55",
              "XOR result is 0xFF"
            ),
            new TestCase(
              [0x12, 0x34, 0x56], // 0x12 XOR 0x34 XOR 0x56 = 0x70
              OpCodes.Hex8ToBytes("70"),
              "Bytes 0x12, 0x34, 0x56",
              "XOR result is 0x70"
            ),
            new TestCase(
              [0xFF, 0xFF, 0xFF, 0xFF], // All 0xFF XOR together = 0x00
              OpCodes.Hex8ToBytes("00"),
              "Four bytes of 0xFF",
              "Even number of identical bytes XOR to 0"
            )
          ]
        }
      };

      return configs[variant] || configs['Even'];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      if (isInverse) {
        return null; // Parity checks do not support inverse operations
      }
      return new ParityInstance(this, this.config);
    }
  }

  /**
 * Parity cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ParityInstance extends IAlgorithmInstance {
    constructor(algorithm, config) {
      super(algorithm);
      this.config = config;
      this.variant = algorithm.name.split('-')[0]; // Extract 'Even', 'Odd', 'Longitudinal'
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('ParityInstance.Feed: Input must be byte array');
      }

      // Validate that all elements are valid bytes (0-255)
      for (let byte of data) {
        if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
          throw new Error('ParityInstance.Feed: All elements must be bytes (0-255)');
        }
      }

      this.data = data.slice(); // Store a copy
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.data) {
        this.data = []; // Handle empty case
      }

      let result;

      if (this.variant === 'Longitudinal') {
        result = this._calculateLongitudinalParity();
      } else {
        result = this._calculateBitParity();
      }

      // Reset for next calculation
      this.data = null;

      return result;
    }

    _calculateBitParity() {
      // Count total number of 1 bits across all bytes
      let totalBits = 0;

      for (let byte of this.data) {
        // Count bits in this byte
        let temp = byte;
        while (temp > 0) {
          totalBits += OpCodes.AndN(temp, 1);
          temp = OpCodes.Shr32(temp, 1);
        }
      }

      let parityBit;
      if (this.variant === 'Even') {
        // Even parity: parity bit is 1 if total bits is odd
        parityBit = totalBits % 2;
      } else { // Odd parity
        // Odd parity: parity bit is 0 if total bits is odd
        parityBit = (totalBits % 2) === 0 ? 1 : 0;
      }

      return [parityBit];
    }

    _calculateLongitudinalParity() {
      // XOR all bytes together
      let checksum = 0;

      for (let byte of this.data) {
        checksum = OpCodes.XorN(checksum, byte);
      }

      return [checksum];
    }
  }

  // Register all Parity variants
  RegisterAlgorithm(new ParityAlgorithm('Even'));
  RegisterAlgorithm(new ParityAlgorithm('Odd'));
  RegisterAlgorithm(new ParityAlgorithm('Longitudinal'));

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ParityAlgorithm, ParityInstance };
  }

  // ===== REGISTRATION =====

    const algorithmInstance = new ParityAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ParityAlgorithm, ParityInstance };
}));