/*
 * SYSV Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Unix System V checksum algorithm.
 * Used by System V 'sum' command for file integrity verification.
 * Simple circular sum with byte count for basic error detection.
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
   * SYSVChecksum algorithm
   * @class
   * @extends {Algorithm}
   */
  class SYSVChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "SYSV-Checksum";
      this.description = "Unix System V checksum algorithm used by the 'sum' command. Simple sum of all bytes with modulo 32-bit arithmetic. Historical Unix utility for basic file integrity verification. Compatible with System V sum -s option.";
      this.inventor = "AT&T Bell Labs";
      this.year = 1983;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Unix Utility";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      /** @type {int32} */
      this.checksumSize = 32; // Returns 32-bit sum

      this.documentation = [
        new LinkItem("sum Command Manual", "https://man7.org/linux/man-pages/man1/sum.1.html"),
        new LinkItem("Unix Checksum Algorithms", "https://en.wikipedia.org/wiki/Sum_(Unix)"),
        new LinkItem("System V Documentation", "https://docs.oracle.com/cd/E19253-01/816-5165/sum-1/index.html")
      ];

      this.references = [
        new LinkItem("GNU coreutils sum.c (sysv_sum_file) reference implementation", "https://github.com/coreutils/coreutils/blob/master/src/sum.c")
      ];

      /** @type {string[]} */
      this.notes = [
        "Algorithm: Sum all bytes, result mod 2^16",
        "Output: 16-bit checksum (0-65535)",
        "Used in: System V Unix 'sum -s' command",
        "Simple and fast but weak error detection",
        "Does not detect reordering of blocks",
        "Superseded by stronger checksums (CRC, MD5, SHA)",
        "Historical significance in Unix systems"
      ];

      this.tests = [
        {
          text: "Simple ASCII",
          uri: "SYSV checksum",
          input: OpCodes.AnsiToBytes("hello"),
          expected: [0x02, 0x14] // Sum = 532 = 0x214, no folding needed
        },
        {
          text: "Single byte",
          uri: "SYSV checksum",
          input: [0x42],
          expected: [0x00, 0x42]
        },
        {
          text: "Multiple bytes",
          uri: "SYSV checksum",
          input: [0x01, 0x02, 0x03, 0x04],
          expected: [0x00, 0x0A] // 1+2+3+4 = 10 = 0x000A
        }
      ];
    }

    /**
   * Create new checksum instance
   * @param {boolean} [isInverse=false] - Checksums have no inverse
   * @returns {SYSVChecksumInstance} New instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new SYSVChecksumInstance(this, isInverse);
    }
  }

  /**
 * SYSVChecksum instance implementing the Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class SYSVChecksumInstance extends IAlgorithmInstance {
    /**
   * Initialize a checksum instance
   * @param {SYSVChecksumAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint32} Running 16-bit sum */
      this.sum = 0;
    }

    /**
   * Feed data to the checksum
   * @param {uint8[]} data - Input data bytes
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Sum all bytes, keeping 16-bit result
      const mask16 = OpCodes.BitMask(16);
      for (let i = 0; i < data.length; i++) {
        this.sum = OpCodes.And32(OpCodes.Add32(this.sum, data[i]), mask16);
      }
    }

    /**
   * Get the checksum of everything fed so far and reset for the next message
   * @returns {uint8[]} Checksum bytes
   */

    Result() {
      const result = OpCodes.Unpack16BE(this.sum);
      this.sum = 0;
      return result;
    }
  }

  RegisterAlgorithm(new SYSVChecksumAlgorithm());

  return { SYSVChecksumAlgorithm, SYSVChecksumInstance };
}));
