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

  if (!AlgorithmFramework || !OpCodes) {
    throw new Error('AlgorithmFramework and OpCodes dependencies are required');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== SUM8 =====

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

      this.checksumSize = 8;

      this.documentation = [
        new LinkItem("Checksum Algorithms", "https://en.wikipedia.org/wiki/Checksum"),
        new LinkItem("Sum Checksums Explained", "https://stackoverflow.com/questions/71162153/")
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
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new Sum8Instance(this, isInverse);
    }
  }

  /**
 * Sum8 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Sum8Instance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.sum = 0;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let i = 0; i < data.length; i++) {
        this.sum = OpCodes.AndN(this.sum + data[i], 0xFF);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      const result = [this.sum];
      this.sum = 0;
      return result;
    }
  }

  // ===== SUM16 =====

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

      this.checksumSize = 16;

      this.documentation = [
        new LinkItem("Checksum Algorithms", "https://en.wikipedia.org/wiki/Checksum")
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
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new Sum16Instance(this, isInverse);
    }
  }

  /**
 * Sum16 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Sum16Instance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.sum = 0;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let i = 0; i < data.length; i++) {
        this.sum = OpCodes.AndN(this.sum + data[i], 0xFFFF);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      const result = [
        OpCodes.AndN(OpCodes.Shr32(this.sum, 8), 0xFF),  // High byte
        OpCodes.AndN(this.sum, 0xFF)                      // Low byte
      ];
      this.sum = 0;
      return result;
    }
  }

  // ===== SUM32 =====

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

      this.checksumSize = 32;

      this.documentation = [
        new LinkItem("Checksum Algorithms", "https://en.wikipedia.org/wiki/Checksum")
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
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new Sum32Instance(this, isInverse);
    }
  }

  /**
 * Sum32 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Sum32Instance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.sum = 0;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let i = 0; i < data.length; i++) {
        this.sum = OpCodes.Shr32(this.sum + data[i], 0); // Unsigned 32-bit
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      const result = [
        OpCodes.AndN(OpCodes.Shr32(this.sum, 24), 0xFF),
        OpCodes.AndN(OpCodes.Shr32(this.sum, 16), 0xFF),
        OpCodes.AndN(OpCodes.Shr32(this.sum, 8), 0xFF),
        OpCodes.AndN(this.sum, 0xFF)
      ];
      this.sum = 0;
      return result;
    }
  }

  RegisterAlgorithm(new Sum8Algorithm());
  RegisterAlgorithm(new Sum16Algorithm());
  RegisterAlgorithm(new Sum32Algorithm());

  return { Sum8Algorithm, Sum8Instance, Sum16Algorithm, Sum16Instance, Sum32Algorithm, Sum32Instance };
}));
