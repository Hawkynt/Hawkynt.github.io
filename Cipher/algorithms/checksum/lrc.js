/*
 * LRC (Longitudinal Redundancy Check) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LRC is a form of redundancy check used for data transmission.
 * Calculates XOR of all bytes, then takes twos-complement.
 * When summed with all data bytes and LRC, result should be zero.
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

  class LRCAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "LRC";
      this.description = "Longitudinal Redundancy Check used in serial communications. XORs all bytes and takes twos-complement. Verification: sum of all data bytes plus LRC equals zero (modulo 256).";
      this.inventor = "Unknown (telecommunications standard)";
      this.year = 1960;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Redundancy Check";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null;

      this.checksumSize = 8;

      this.documentation = [
        new LinkItem("Longitudinal Redundancy Check", "https://en.wikipedia.org/wiki/Longitudinal_redundancy_check"),
        new LinkItem("LRC Checksum Calculator", "https://forums.ni.com/t5/Example-Code/Checksum-generator-XOR-8-bit-8-bit-sum-LRC-8-bit-16-bit-sum/ta-p/4116999")
      ];

      this.notes = [
        "LRC = ((XOR of all bytes) XOR 0xFF) + 1 = two's complement of XOR",
        "Verification: (sum of all bytes + LRC) & 0xFF == 0",
        "Simple error detection for serial protocols",
        "Can detect single-bit errors and some multi-bit errors",
        "Used in ASCII-based protocols and legacy systems"
      ];

      this.tests = [
        {
          text: "Simple LRC",
          uri: "LRC calculation",
          input: [0x02, 0x03, 0x04],
          expected: [0xFB] // 0x02 XOR 0x03 XOR 0x04 = 0x05, two's complement = 0xFB
        },
        {
          text: "ASCII LRC",
          uri: "LRC for text",
          input: OpCodes.AnsiToBytes("ABC"),
          expected: [0xC0] // 0x41 XOR 0x42 XOR 0x43 = 0x40, two's complement = 0xC0
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
      return new LRCInstance(this, isInverse);
    }
  }

  /**
 * LRC cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LRCInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.lrc = 0;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      for (let i = 0; i < data.length; i++) {
        this.lrc ^= data[i];
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Two's complement: flip bits and add 1
      const result = [(~this.lrc + 1) & 0xFF];
      this.lrc = 0;
      return result;
    }
  }

  RegisterAlgorithm(new LRCAlgorithm());

  return { LRCAlgorithm, LRCInstance };
}));
