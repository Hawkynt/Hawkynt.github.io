/*
 * Sum Checksum Implementation (Sum8, Sum16, Sum32)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Simple summation checksums ignoring overflow.
 * Sum8/16/32 refer to the word size of the result.
 * Widely used in embedded systems and network protocols.
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

  // ===== SUM8 =====

  /**
   * Sum8 algorithm
   * @class
   * @extends {Algorithm}
   */
  class Sum8Algorithm extends Algorithm {
    constructor() {
      super();

      this.name = "Sum-8";
      this.description = "Simple 8-bit summation checksum. Adds all bytes and keeps only the lowest 8 bits (modulo 256). Fast and lightweight, commonly used in embedded systems.";
      this.inventor = "Unknown (fundamental technique)";
      this.year = 1950;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Summation";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null;

      /** @type {int32} */
      this.checksumSize = 8;

      this.documentation = [
        new LinkItem("Checksum Algorithms", "https://en.wikipedia.org/wiki/Checksum"),
        new LinkItem("Sum Checksums Explained", "https://stackoverflow.com/questions/71162153/")
      ];

      this.references = [
        new LinkItem("GNU coreutils sum.c reference implementation", "https://github.com/coreutils/coreutils/blob/master/src/sum.c")
      ];

      this.tests = [
        new TestCase(
          [0x01, 0x02, 0x03, 0x04],
          [0x0A], // (1+2+3+4)&0xFF
          "Simple sequence",
          "Sum8 calculation"
        ),
        new TestCase(
          [0xFF, 0xFF],
          [0xFE], // (255+255)&0xFF = 254
          "Overflow test",
          "Sum8 with overflow"
        )
      ];
    }

    /**
   * Create new checksum instance
   * @param {boolean} [isInverse=false] - Checksums have no inverse
   * @returns {Sum8Instance} New instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new Sum8Instance(this, isInverse);
    }
  }

  /**
 * Sum8 instance implementing the Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class Sum8Instance extends IAlgorithmInstance {
    /**
   * Initialize a checksum instance
   * @param {Sum8Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint32} Running sum */
      this.sum = 0;
    }

    /**
   * Feed data to the checksum
   * @param {uint8[]} data - Input data bytes
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let i = 0; i < data.length; i++) {
        this.sum = OpCodes.And32(OpCodes.Add32(this.sum, data[i]), 0xFF);
      }
    }

    /**
   * Get the checksum of everything fed so far and reset for the next message
   * @returns {uint8[]} Checksum bytes
   */

    Result() {
      const result = [this.sum];
      this.sum = 0;
      return result;
    }
  }

  // ===== SUM16 =====

  /**
   * Sum16 algorithm
   * @class
   * @extends {Algorithm}
   */
  class Sum16Algorithm extends Algorithm {
    constructor() {
      super();

      this.name = "Sum-16";
      this.description = "16-bit summation checksum. Adds all bytes and keeps only the lowest 16 bits (modulo 65536). Better error detection than Sum-8.";
      this.inventor = "Unknown";
      this.year = 1960;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Summation";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null;

      /** @type {int32} */
      this.checksumSize = 16;

      this.documentation = [
        new LinkItem("Checksum Algorithms", "https://en.wikipedia.org/wiki/Checksum")
      ];

      this.references = [
        new LinkItem("GNU coreutils sum.c reference implementation", "https://github.com/coreutils/coreutils/blob/master/src/sum.c")
      ];

      this.tests = [
        new TestCase(
          [0x01, 0x02, 0x03, 0x04],
          [0x00, 0x0A], // Big-endian: 0x000A
          "Simple sequence",
          "Sum16 calculation"
        ),
        new TestCase(
          [0xFF, 0xFF, 0xFF],
          [0x02, 0xFD], // (255+255+255) = 765 = 0x02FD
          "Multi-byte sum",
          "Sum16 test"
        )
      ];
    }

    /**
   * Create new checksum instance
   * @param {boolean} [isInverse=false] - Checksums have no inverse
   * @returns {Sum16Instance} New instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new Sum16Instance(this, isInverse);
    }
  }

  /**
 * Sum16 instance implementing the Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class Sum16Instance extends IAlgorithmInstance {
    /**
   * Initialize a checksum instance
   * @param {Sum16Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint32} Running sum */
      this.sum = 0;
    }

    /**
   * Feed data to the checksum
   * @param {uint8[]} data - Input data bytes
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let i = 0; i < data.length; i++) {
        this.sum = OpCodes.And32(OpCodes.Add32(this.sum, data[i]), 0xFFFF);
      }
    }

    /**
   * Get the checksum of everything fed so far and reset for the next message
   * @returns {uint8[]} Checksum bytes
   */

    Result() {
      const result = OpCodes.Unpack16BE(this.sum); // High byte, low byte
      this.sum = 0;
      return result;
    }
  }

  // ===== SUM32 =====

  /**
   * Sum32 algorithm
   * @class
   * @extends {Algorithm}
   */
  class Sum32Algorithm extends Algorithm {
    constructor() {
      super();

      this.name = "Sum-32";
      this.description = "32-bit summation checksum. Adds all bytes and keeps only the lowest 32 bits. Good error detection for larger data blocks.";
      this.inventor = "Unknown";
      this.year = 1970;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Summation";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null;

      /** @type {int32} */
      this.checksumSize = 32;

      this.documentation = [
        new LinkItem("Checksum Algorithms", "https://en.wikipedia.org/wiki/Checksum")
      ];

      this.references = [
        new LinkItem("GNU coreutils sum.c reference implementation", "https://github.com/coreutils/coreutils/blob/master/src/sum.c")
      ];

      this.tests = [
        new TestCase(
          [0x01, 0x02, 0x03, 0x04],
          [0x00, 0x00, 0x00, 0x0A], // 0x0000000A
          "Simple sequence",
          "Sum32 calculation"
        )
      ];
    }

    /**
   * Create new checksum instance
   * @param {boolean} [isInverse=false] - Checksums have no inverse
   * @returns {Sum32Instance} New instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new Sum32Instance(this, isInverse);
    }
  }

  /**
 * Sum32 instance implementing the Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class Sum32Instance extends IAlgorithmInstance {
    /**
   * Initialize a checksum instance
   * @param {Sum32Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint32} Running sum */
      this.sum = 0;
    }

    /**
   * Feed data to the checksum
   * @param {uint8[]} data - Input data bytes
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let i = 0; i < data.length; i++) {
        this.sum = OpCodes.Add32(this.sum, data[i]); // Unsigned 32-bit
      }
    }

    /**
   * Get the checksum of everything fed so far and reset for the next message
   * @returns {uint8[]} Checksum bytes
   */

    Result() {
      const result = OpCodes.Unpack32BE(this.sum);
      this.sum = 0;
      return result;
    }
  }

  RegisterAlgorithm(new Sum8Algorithm());
  RegisterAlgorithm(new Sum16Algorithm());
  RegisterAlgorithm(new Sum32Algorithm());

  return { Sum8Algorithm, Sum8Instance, Sum16Algorithm, Sum16Instance, Sum32Algorithm, Sum32Instance };
}));
