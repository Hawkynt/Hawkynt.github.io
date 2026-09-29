/*
 * BSD Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * BSD checksum algorithm used in BSD Unix systems.
 * Rotating 16-bit sum with right rotation before each addition.
 * Used by BSD 'sum' command for file integrity checking.
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
   * BSDChecksum algorithm
   * @class
   * @extends {Algorithm}
   */
  class BSDChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "BSD-Checksum";
      this.description = "BSD Unix checksum algorithm using rotating 16-bit sum. Rotates checksum right by 1 bit before adding each byte. Used by BSD 'sum' command for file integrity verification.";
      this.inventor = "BSD Unix developers";
      this.year = 1977;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Rotating Sum";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      /** @type {int32} */
      this.checksumSize = 16;

      this.documentation = [
        new LinkItem("BSD Checksum Algorithm", "https://en.wikipedia.org/wiki/BSD_checksum"),
        new LinkItem("Unix sum Command", "https://man.freebsd.org/cgi/man.cgi?query=sum"),
        new LinkItem("Checksum Comparison", "https://www.gnu.org/software/coreutils/manual/html_node/sum-invocation.html")
      ];

      this.references = [
        new LinkItem("GNU coreutils sum.c (bsd_sum_stream)", "https://github.com/coreutils/coreutils/blob/master/src/sum.c")
      ];

      /** @type {string[]} */
      this.notes = [
        "Algorithm: rotate right, then add byte",
        "Rotation provides better bit mixing than simple sum",
        "Used in BSD Unix 'sum' command",
        "Better error detection than simple sum",
        "16-bit result provides reasonable collision resistance",
        "Formula: rotate right by 1 bit, add byte, mask to 16 bits"
      ];

      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes("a"),
          [0x00, 0x61], // 'a' = 0x61, checksum = 0x0061
          "Single character",
          "BSD checksum calculation"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("abc"),
          [0x40, 0xAC], // Calculated BSD checksum = 0x40AC
          "Three characters",
          "BSD checksum with rotation"
        ),
        new TestCase(
          [0xFF, 0xFF],
          [0x81, 0x7E], // Calculated BSD checksum = 0x817E
          "Maximum bytes",
          "BSD checksum overflow handling"
        )
      ];
    }

    /**
   * Create new checksum instance
   * @param {boolean} [isInverse=false] - Checksums have no inverse
   * @returns {BSDChecksumInstance} New instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new BSDChecksumInstance(this, isInverse);
    }
  }

  /**
 * BSDChecksum instance implementing the Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class BSDChecksumInstance extends IAlgorithmInstance {
    /**
   * Initialize a checksum instance
   * @param {BSDChecksumAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint32} Running 16-bit checksum */
      this.checksum = 0;
    }

    /**
   * Feed data to the checksum
   * @param {uint8[]} data - Input data bytes
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      const mask16 = OpCodes.BitMask(16);
      for (let i = 0; i < data.length; i++) {
        // Rotate checksum right by 1 bit (with wraparound)
        this.checksum = OpCodes.RotR16(this.checksum, 1);

        // Add byte to rotated checksum and mask to 16 bits
        this.checksum = OpCodes.And32(OpCodes.Add32(this.checksum, data[i]), mask16);
      }
    }

    /**
   * Get the checksum of everything fed so far and reset for the next message
   * @returns {uint8[]} Checksum bytes
   */

    Result() {
      const result = OpCodes.Unpack16BE(this.checksum);
      this.checksum = 0;
      return result;
    }
  }

  RegisterAlgorithm(new BSDChecksumAlgorithm());

  return { BSDChecksumAlgorithm, BSDChecksumInstance };
}));
