/*
 * Complement Checksum Implementations
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Implements one's complement and two's complement checksums.
 * - One's complement: Used in Internet protocols (IP, TCP, UDP, ICMP)
 * - Two's complement: Used in serial protocols and embedded systems
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

  // ===== ONES COMPLEMENT 16-BIT =====

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

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new OnesComplementChecksumInstance(this, isInverse);
    }
  }

  /**
 * OnesComplementChecksum cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class OnesComplementChecksumInstance extends IAlgorithmInstance {
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

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

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

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new TwosComplement8Instance(this, isInverse);
    }
  }

  /**
 * TwosComplement8 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class TwosComplement8Instance extends IAlgorithmInstance {
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
        this.sum = (this.sum + data[i]) & 0xFF;
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

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

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new TwosComplement16Instance(this, isInverse);
    }
  }

  /**
 * TwosComplement16 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class TwosComplement16Instance extends IAlgorithmInstance {
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
        this.sum = (this.sum + data[i]) & 0xFFFF;
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

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

  RegisterAlgorithm(new OnesComplementChecksumAlgorithm());
  RegisterAlgorithm(new TwosComplement8Algorithm());
  RegisterAlgorithm(new TwosComplement16Algorithm());

  return {
    OnesComplementChecksumAlgorithm,
    OnesComplementChecksumInstance,
    TwosComplement8Algorithm,
    TwosComplement8Instance,
    TwosComplement16Algorithm,
    TwosComplement16Instance
  };
}));
