/*
 * XOR Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Simple XOR-based checksum for error detection.
 * Commonly used in NMEA GPS sentences and serial protocols.
 * XORs all bytes together to produce single-byte checksum.
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
   * XORChecksum algorithm
   * @class
   * @extends {Algorithm}
   */
  class XORChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "XOR-8";
      this.description = "Simple XOR-based checksum used in NMEA GPS sentences and serial communication protocols. XORs all input bytes to produce a single-byte error detection value.";
      this.inventor = "Unknown (ancient technique)";
      this.year = 1960;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "XOR-based";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null;

      /** @type {int32} */
      this.checksumSize = 8; // bits

      this.documentation = [
        new LinkItem("XOR Checksum on Wikipedia", "https://en.wikipedia.org/wiki/Checksum"),
        new LinkItem("NMEA Checksum Calculation", "https://nmeachecksum.eqth.net/"),
        new LinkItem("Serial Protocol Checksums", "https://en.wikibooks.org/wiki/Algorithm_Implementation/Checksums")
      ];

      this.references = [
        new LinkItem("pynmea2 XOR checksum implementation", "https://github.com/Knio/pynmea2/blob/master/pynmea2/nmea.py")
      ];

      /** @type {string[]} */
      this.notes = [
        "Very simple: XOR all bytes together",
        "Used in NMEA GPS sentences (between $ and *)",
        "Can detect odd number of bit errors",
        "Cannot detect even number of identical bit errors",
        "Fast and lightweight for embedded systems",
        "Often displayed as 2-digit hexadecimal"
      ];

      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes("GPRMC"),
          [OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(0x47, 0x50), 0x52), 0x4D), 0x43)], // G^P^R^M^C
          "NMEA sentence type",
          "https://nmeachecksum.eqth.net/"
        ),
        new TestCase(
          [0x01, 0x02, 0x03, 0x04],
          [OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(0x01, 0x02), 0x03), 0x04)], // = 0x04
          "Simple sequence",
          "XOR checksum calculation"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("ABC"),
          [OpCodes.XorN(OpCodes.XorN(0x41, 0x42), 0x43)], // = 0x00
          "ASCII test",
          "XOR checksum test"
        )
      ];
    }

    /**
   * Create new checksum instance
   * @param {boolean} [isInverse=false] - Checksums have no inverse
   * @returns {XORChecksumInstance} New instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new XORChecksumInstance(this, isInverse);
    }
  }

  /**
 * XORChecksum instance implementing the Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class XORChecksumInstance extends IAlgorithmInstance {
    /**
   * Initialize a checksum instance
   * @param {XORChecksumAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint32} XOR of all bytes */
      this.checksum = 0;
    }

    /**
   * Feed data to the checksum
   * @param {uint8[]} data - Input data bytes
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      for (let i = 0; i < data.length; i++) {
        this.checksum = OpCodes.Xor32(this.checksum, data[i]);
      }
    }

    /**
   * Get the checksum of everything fed so far and reset for the next message
   * @returns {uint8[]} Checksum bytes
   */

    Result() {
      const result = [OpCodes.ToUint8(this.checksum)];
      this.checksum = 0;
      return result;
    }
  }

  RegisterAlgorithm(new XORChecksumAlgorithm());

  return { XORChecksumAlgorithm, XORChecksumInstance };
}));
