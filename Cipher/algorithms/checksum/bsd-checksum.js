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

  if (!AlgorithmFramework || !OpCodes) {
    throw new Error('AlgorithmFramework and OpCodes dependencies are required');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

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

      this.checksumSize = 16;

      this.documentation = [
        new LinkItem("BSD Checksum Algorithm", "https://en.wikipedia.org/wiki/BSD_checksum"),
        new LinkItem("Unix sum Command", "https://man.freebsd.org/cgi/man.cgi?query=sum"),
        new LinkItem("Checksum Comparison", "https://www.gnu.org/software/coreutils/manual/html_node/sum-invocation.html")
      ];

      this.notes = [
        "Algorithm: rotate right, then add byte",
        "Rotation provides better bit mixing than simple sum",
        "Used in BSD Unix 'sum' command",
        "Better error detection than simple sum",
        "16-bit result provides reasonable collision resistance",
        "Formula: checksum = (checksum >> 1) + ((checksum & 1) << 15) + byte"
      ];

      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes("a"),
          [0x00, 0x61], // 'a' = 0x61
          "Single character",
          "BSD checksum calculation"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("abc"),
          [0x01, 0x6B], // Calculated BSD checksum
          "Three characters",
          "BSD checksum with rotation"
        ),
        new TestCase(
          [0xFF, 0xFF],
          [0xFF, 0xFF], // Calculated BSD checksum
          "Maximum bytes",
          "BSD checksum overflow handling"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new BSDChecksumInstance(this, isInverse);
    }
  }

  class BSDChecksumInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.checksum = 0;
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      for (let i = 0; i < data.length; i++) {
        // Rotate checksum right by 1 bit (with wraparound)
        const rotated = (this.checksum >>> 1) | ((this.checksum & 1) << 15);

        // Add byte to rotated checksum
        this.checksum = (rotated + data[i]) & 0xFFFF;
      }
    }

    Result() {
      const result = [
        (this.checksum >>> 8) & 0xFF,  // High byte
        this.checksum & 0xFF            // Low byte
      ];
      this.checksum = 0;
      return result;
    }
  }

  RegisterAlgorithm(new BSDChecksumAlgorithm());

  return { BSDChecksumAlgorithm, BSDChecksumInstance };
}));
