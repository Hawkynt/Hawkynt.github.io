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

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework and OpCodes dependencies are required');
  }

  if (!OpCodes) {
    throw new Error('AlgorithmFramework and OpCodes dependencies are required');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  /**
   * LRC algorithm
   * @class
   * @extends {Algorithm}
   */
  class LRCAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "LRC";
      this.description = "Longitudinal Redundancy Check used in serial communications, as specified for Modbus ASCII. Sums all bytes modulo 256 and takes the two's complement. Verification: sum of all data bytes plus LRC equals zero (modulo 256).";
      this.inventor = "Unknown (telecommunications standard)";
      this.year = 1960;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Redundancy Check";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null;

      /** @type {int32} */
      this.checksumSize = 8;

      this.documentation = [
        new LinkItem("Longitudinal Redundancy Check", "https://en.wikipedia.org/wiki/Longitudinal_redundancy_check"),
        new LinkItem("LRC Checksum Calculator", "https://forums.ni.com/t5/Example-Code/Checksum-generator-XOR-8-bit-8-bit-sum-LRC-8-bit-16-bit-sum/ta-p/4116999")
      ];

      this.references = [
        new LinkItem("minimalmodbus Modbus ASCII LRC implementation", "https://github.com/pyhys/minimalmodbus/blob/master/minimalmodbus.py")
      ];

      /** @type {string[]} */
      this.notes = [
        "LRC = ((sum of all bytes) XOR 0xFF) + 1 = two's complement of the 8-bit sum",
        "Verification: (sum of all bytes + LRC) AND 0xFF == 0",
        "Simple error detection for serial protocols",
        "Can detect single-bit errors and some multi-bit errors",
        "Used in ASCII-based protocols and legacy systems"
      ];

      this.tests = [
        {
          text: "Wikipedia LRC worked example - STX 0 0 1 # ETX",
          uri: "https://en.wikipedia.org/wiki/Longitudinal_redundancy_check",
          input: OpCodes.Hex8ToBytes("023030312303"),
          expected: OpCodes.Hex8ToBytes("47") // sum = 0xB9, two's complement = 0x47
        },
        {
          text: "minimalmodbus known value - 'ABCDE'",
          uri: "https://github.com/pyhys/minimalmodbus/blob/master/tests/test_minimalmodbus.py",
          input: OpCodes.Hex8ToBytes("4142434445"),
          expected: OpCodes.Hex8ToBytes("b1") // sum = 0x14F, low byte 0x4F, two's complement = 0xB1
        }
      ];
    }

    /**
   * Create new checksum instance
   * @param {boolean} [isInverse=false] - Checksums have no inverse
   * @returns {LRCInstance} New instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new LRCInstance(this, isInverse);
    }
  }

  /**
 * LRC instance implementing the Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class LRCInstance extends IAlgorithmInstance {
    /**
   * Initialize a checksum instance
   * @param {LRCAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint32} Byte sum modulo 256 */
      this.lrc = 0;
    }

    /**
   * Feed data to the checksum
   * @param {uint8[]} data - Input data bytes
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      for (let i = 0; i < data.length; i++) {
        this.lrc = OpCodes.And32(OpCodes.Add32(this.lrc, data[i]), 0xFF);
      }
    }

    /**
   * Get the checksum of everything fed so far and reset for the next message
   * @returns {uint8[]} Checksum bytes
   */

    Result() {
      // Two's complement: flip bits and add 1
      const result = [OpCodes.ToUint8(OpCodes.Add32(OpCodes.Not32(this.lrc), 1))];
      this.lrc = 0;
      return result;
    }
  }

  RegisterAlgorithm(new LRCAlgorithm());

  return { LRCAlgorithm, LRCInstance };
}));
