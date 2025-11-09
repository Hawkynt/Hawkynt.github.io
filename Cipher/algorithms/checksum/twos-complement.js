/*
 * Twos Complement Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Two's complement checksum for error detection.
 * Sums all bytes and returns the two's complement (negation) of the result.
 * Used in serial protocols and embedded systems.
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

  // ===== TWOS COMPLEMENT 8-BIT =====

  class TwosComplement8Algorithm extends Algorithm {
    constructor() {
      super();

      this.name = "Twos-Complement-8";
      this.description = "8-bit two's complement checksum. Sums all bytes modulo 256, then returns two's complement (negate). Verification: sum of all data bytes plus checksum equals zero (mod 256).";
      this.inventor = "Unknown (fundamental technique)";
      this.year = 1960;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Twos Complement";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null;

      this.checksumSize = 8;

      this.documentation = [
        new LinkItem("Two's Complement on Wikipedia", "https://en.wikipedia.org/wiki/Two%27s_complement"),
        new LinkItem("Checksum Algorithms", "https://en.wikipedia.org/wiki/Checksum"),
        new LinkItem("Serial Protocol Checksums", "https://www.lammertbies.nl/comm/info/serial-checksum")
      ];

      this.notes = [
        "Algorithm: sum all bytes, then negate (two's complement)",
        "Two's complement: (~sum + 1) & 0xFF",
        "Verification: (sum of all bytes + checksum) & 0xFF == 0",
        "Used in: Serial protocols, embedded systems",
        "Better than simple sum for zero-sum validation",
        "Similar to LRC but uses summation instead of XOR"
      ];

      this.tests = [
        new TestCase(
          [0x01, 0x02, 0x03], // Sum = 6, -6 = 0xFA
          [0xFA],
          "Simple sequence",
          "Two's complement checksum"
        ),
        new TestCase(
          [0x25, 0x62, 0x3F, 0x52], // Sum = 0x118 = 0x18, -0x18 = 0xE8
          [0xE8],
          "Serial protocol example",
          "https://www.lammertbies.nl/comm/info/serial-checksum"
        ),
        new TestCase(
          [0xFF], // Sum = 0xFF, -0xFF = 0x01
          [0x01],
          "Maximum byte value",
          "Two's complement calculation"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new TwosComplement8Instance(this, isInverse);
    }
  }

  class TwosComplement8Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.sum = 0;
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      for (let i = 0; i < data.length; i++) {
        this.sum = (this.sum + data[i]) & 0xFF;
      }
    }

    Result() {
      // Two's complement: negate the sum
      const checksum = ((~this.sum) + 1) & 0xFF;
      this.sum = 0;
      return [checksum];
    }
  }

  // ===== TWOS COMPLEMENT 16-BIT =====

  class TwosComplement16Algorithm extends Algorithm {
    constructor() {
      super();

      this.name = "Twos-Complement-16";
      this.description = "16-bit two's complement checksum. Sums all bytes modulo 65536, then returns two's complement. Better error detection than 8-bit version for larger data blocks.";
      this.inventor = "Unknown";
      this.year = 1970;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Twos Complement";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null;

      this.checksumSize = 16;

      this.documentation = [
        new LinkItem("Two's Complement on Wikipedia", "https://en.wikipedia.org/wiki/Two%27s_complement"),
        new LinkItem("Checksum Algorithms", "https://en.wikipedia.org/wiki/Checksum")
      ];

      this.notes = [
        "Algorithm: sum all bytes (16-bit), then negate",
        "Verification: (sum + checksum) & 0xFFFF == 0",
        "Better collision resistance than 8-bit",
        "Used in network protocols and data integrity"
      ];

      this.tests = [
        new TestCase(
          [0x01, 0x02, 0x03, 0x04], // Sum = 10, -10 = 0xFFF6
          [0xFF, 0xF6],
          "Simple sequence",
          "16-bit two's complement"
        ),
        new TestCase(
          [0xFF, 0xFF], // Sum = 510 = 0x01FE, -0x01FE = 0xFE02
          [0xFE, 0x02],
          "Large values",
          "16-bit two's complement"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new TwosComplement16Instance(this, isInverse);
    }
  }

  class TwosComplement16Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.sum = 0;
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      for (let i = 0; i < data.length; i++) {
        this.sum = (this.sum + data[i]) & 0xFFFF;
      }
    }

    Result() {
      // Two's complement: negate the sum
      const checksum = ((~this.sum) + 1) & 0xFFFF;
      this.sum = 0;
      return [
        (checksum >>> 8) & 0xFF,  // High byte
        checksum & 0xFF            // Low byte
      ];
    }
  }

  RegisterAlgorithm(new TwosComplement8Algorithm());
  RegisterAlgorithm(new TwosComplement16Algorithm());

  return { TwosComplement8Algorithm, TwosComplement8Instance,
           TwosComplement16Algorithm, TwosComplement16Instance };
}));
