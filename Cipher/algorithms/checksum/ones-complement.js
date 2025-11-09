/*
 * Ones Complement Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * One's complement checksum used in Internet protocols.
 * Sum all 16-bit words with end-around carry, then take one's complement.
 * Used in IP, TCP, UDP, ICMP headers for error detection.
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

  class OnesComplementChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "Ones-Complement";
      this.description = "Internet protocol checksum using one's complement arithmetic. Sums 16-bit words with end-around carry, then inverts all bits. Used in IP, TCP, UDP, and ICMP headers for packet integrity verification.";
      this.inventor = "Internet Protocol designers";
      this.year = 1974;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Internet Protocol";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      this.checksumSize = 16;

      this.documentation = [
        new LinkItem("RFC 1071 - Computing Internet Checksum", "https://tools.ietf.org/html/rfc1071"),
        new LinkItem("Internet Checksum on Wikipedia", "https://en.wikipedia.org/wiki/IPv4_header_checksum"),
        new LinkItem("TCP/IP Checksum Calculation", "https://www.rfc-editor.org/rfc/rfc1624.html")
      ];

      this.notes = [
        "Algorithm: sum 16-bit words, add carry back (end-around carry), then NOT",
        "Used in: IPv4, TCP, UDP, ICMP headers",
        "Verification: sum of data + checksum should be 0xFFFF",
        "Handles odd-length data by padding with zero byte",
        "End-around carry: carry bits are added back to sum",
        "One's complement: invert all bits (~sum)",
        "Detects most common errors but not all reordering"
      ];

      this.tests = [
        new TestCase(
          [0x00, 0x01, 0x00, 0x02], // Two 16-bit words: 0x0001, 0x0002
          [0xFF, 0xFC], // ~(0x0001 + 0x0002) = ~0x0003 = 0xFFFC
          "Simple two words",
          "RFC 1071 example"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("0001F203F4F5F6F7"), // IP header example
          OpCodes.Hex8ToBytes("220D"), // Calculated checksum
          "IP header fragment",
          "https://tools.ietf.org/html/rfc1071"
        ),
        new TestCase(
          [0xFF, 0xFF], // Maximum word
          [0x00, 0x00], // ~0xFFFF = 0x0000
          "Maximum value",
          "One's complement checksum"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new OnesComplementChecksumInstance(this, isInverse);
    }
  }

  class OnesComplementChecksumInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.sum = 0;
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      // Process 16-bit words (big-endian)
      for (let i = 0; i < data.length; i += 2) {
        let word;
        if (i + 1 < data.length) {
          // Full 16-bit word (big-endian)
          word = (data[i] << 8) | data[i + 1];
        } else {
          // Odd byte: pad with zero
          word = data[i] << 8;
        }

        // Add to sum
        this.sum += word;

        // End-around carry: add carry bits back
        if (this.sum > 0xFFFF) {
          this.sum = (this.sum & 0xFFFF) + (this.sum >>> 16);
        }
      }
    }

    Result() {
      // Final end-around carry
      while (this.sum > 0xFFFF) {
        this.sum = (this.sum & 0xFFFF) + (this.sum >>> 16);
      }

      // One's complement (invert all bits)
      const checksum = (~this.sum) & 0xFFFF;

      // Reset state
      this.sum = 0;

      // Return as big-endian bytes
      return [
        (checksum >>> 8) & 0xFF,
        checksum & 0xFF
      ];
    }
  }

  RegisterAlgorithm(new OnesComplementChecksumAlgorithm());

  return { OnesComplementChecksumAlgorithm, OnesComplementChecksumInstance };
}));
