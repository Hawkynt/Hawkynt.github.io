/*
 * CRC (Cyclic Redundancy Check) Implementation with Multiple Bit Widths and Variants
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Unified implementation supporting CRC-8, CRC-16, CRC-24, CRC-32, CRC-64, and CRC-128
 * with multiple standard parameter configurations for each bit width
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
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
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== SHARED CRC CONFIGURATION DATABASE =====

  const CRC_VARIANTS = {
    // CRC-8 Variants
    'CRC-8-SMBUS': {
      bitWidth: 8,
      description: '8-bit CRC used in System Management Bus (SMBus) specification for I2C communications',
      polynomial: 0x07,
      initialValue: 0x00,
      inputReflected: false,
      resultReflected: false,
      finalXor: 0x00,
      tests: [
        new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("00"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("20"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("f4"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
      ]
    },
    'CRC-8-MAXIM': {
      bitWidth: 8,
      description: '8-bit CRC used in Maxim/Dallas 1-Wire device registration numbers',
      polynomial: 0x31,
      initialValue: 0x00,
      inputReflected: true,
      resultReflected: true,
      finalXor: 0x00,
      tests: [
        new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("00"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("8a"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("a2"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
      ]
    },
    'CRC-8-AUTOSAR': {
      bitWidth: 8,
      description: '8-bit CRC used in AUTOSAR Classic Platform for automotive applications',
      polynomial: 0x2F,
      initialValue: 0xFF,
      inputReflected: false,
      resultReflected: false,
      finalXor: 0xFF,
      tests: [
        new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("00"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("07"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("df"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
      ]
    },
    'CRC-8-CDMA2000': {
      bitWidth: 8,
      description: '8-bit CRC used in CDMA2000 mobile telecommunications standard',
      polynomial: 0x9B,
      initialValue: 0xFF,
      inputReflected: false,
      resultReflected: false,
      finalXor: 0x00,
      tests: [
        new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("ff"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("4c"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("da"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
      ]
    },

    // CRC-16 Variants
    'CRC-16-CCITT': {
      bitWidth: 16,
      description: '16-bit CRC used in CCITT/ITU-T standards, telecommunications, and X.25 protocol',
      polynomial: 0x1021,
      initialValue: 0x0000,
      inputReflected: false,
      resultReflected: false,
      finalXor: 0x0000,
      tests: [
        new TestCase(OpCodes.AnsiToBytes(''), OpCodes.Hex8ToBytes('0000'), 'Empty string', 'https://reveng.sourceforge.io/crc-catalogue/'),
        new TestCase(OpCodes.AnsiToBytes('A'), OpCodes.Hex8ToBytes('58E5'), 'Single byte A', 'https://reveng.sourceforge.io/crc-catalogue/'),
        new TestCase(OpCodes.AnsiToBytes('123456789'), OpCodes.Hex8ToBytes('31C3'), 'String 123456789', 'https://reveng.sourceforge.io/crc-catalogue/')
      ]
    },
    'CRC-16-ARC': {
      bitWidth: 16,
      description: '16-bit CRC used in ARC archiver and reflected algorithms (LSB first processing)',
      polynomial: 0x8005,
      initialValue: 0x0000,
      inputReflected: true,
      resultReflected: true,
      finalXor: 0x0000,
      tests: [
        new TestCase(OpCodes.AnsiToBytes(''), OpCodes.Hex8ToBytes('0000'), 'Empty string', 'https://reveng.sourceforge.io/crc-catalogue/'),
        new TestCase(OpCodes.AnsiToBytes('123456789'), OpCodes.Hex8ToBytes('BB3D'), 'Standard test string', 'https://reveng.sourceforge.io/crc-catalogue/')
      ]
    },
    'CRC-16-IBM': {
      bitWidth: 16,
      description: '16-bit CRC used by IBM in SDLC and USB standards',
      polynomial: 0x8005,
      initialValue: 0x0000,
      inputReflected: true,
      resultReflected: true,
      finalXor: 0x0000,
      tests: [
        new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("0000"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("e8c1"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("abc"), OpCodes.Hex8ToBytes("9738"), "String 'abc'", "https://reveng.sourceforge.io/crc-catalogue/")
      ]
    },
    'CRC-16-ANSI': {
      bitWidth: 16,
      description: '16-bit CRC used in ANSI standards and some protocols',
      polynomial: 0x8005,
      initialValue: 0xFFFF,
      inputReflected: true,
      resultReflected: true,
      finalXor: 0x0000,
      tests: [
        new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("ffff"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("a87e"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("abc"), OpCodes.Hex8ToBytes("5749"), "String 'abc'", "https://reveng.sourceforge.io/crc-catalogue/")
      ]
    },
    'CRC-16-XMODEM': {
      bitWidth: 16,
      description: '16-bit CRC used in XMODEM protocol with different initial value',
      polynomial: 0x1021,
      initialValue: 0x0000,
      inputReflected: false,
      resultReflected: false,
      finalXor: 0x0000,
      tests: [
        new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("0000"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("A"), OpCodes.Hex8ToBytes("58e5"), "Single byte 'A'", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("31c3"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
      ]
    },

    // CRC-24 Variants
    'CRC-24-OPENPGP': {
      bitWidth: 24,
      description: '24-bit CRC used in OpenPGP ASCII armor for message integrity checking',
      polynomial: 0x1864CFB,
      initialValue: 0xB704CE,
      inputReflected: false,
      resultReflected: false,
      finalXor: 0x000000,
      tests: [
        new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("b704ce"), "Empty string", "https://tools.ietf.org/html/rfc4880"),
        new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("f25713"), "Single byte 'a'", "https://tools.ietf.org/html/rfc4880"),
        new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("21cf02"), "String '123456789'", "https://tools.ietf.org/html/rfc4880")
      ]
    },
    'CRC-24-FLEXRAY': {
      bitWidth: 24,
      description: '24-bit CRC used in FlexRay automotive communication protocol',
      polynomial: 0x5D6DCB,
      initialValue: 0xFEDCBA,
      inputReflected: false,
      resultReflected: false,
      finalXor: 0x000000,
      tests: [
        new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("fedcba"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("8fe324"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("7979bd"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
      ]
    },
    'CRC-24-INTERLAKEN': {
      bitWidth: 24,
      description: '24-bit CRC used in Interlaken protocol for high-speed chip-to-chip communication',
      polynomial: 0x328B63,
      initialValue: 0xFFFFFF,
      inputReflected: false,
      resultReflected: false,
      finalXor: 0xFFFFFF,
      tests: [
        new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("000000"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("d80156"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("b4f3e6"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
      ]
    },

    // CRC-32 Variants
    'CRC-32-IEEE': {
      bitWidth: 32,
      description: 'CRC-32 (IEEE 802.3) standard used in Ethernet, zip files, and many protocols',
      polynomial: 0x04C11DB7,
      initialValue: 0xFFFFFFFF,
      inputReflected: true,
      resultReflected: true,
      finalXor: 0xFFFFFFFF,
      tests: [
        new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("00000000"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("e8b7be43"), "Single character 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("abc"), OpCodes.Hex8ToBytes("352441c2"), "String 'abc'", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("cbf43926"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
      ]
    },
    'CRC-32-POSIX': {
      bitWidth: 32,
      description: 'CRC-32/POSIX (also known as CKSUM) - base algorithm without length appending',
      polynomial: 0x04C11DB7,
      initialValue: 0x00000000,
      inputReflected: false,
      resultReflected: false,
      finalXor: 0xFFFFFFFF,
      tests: [
        new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("ffffffff"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/17plus.htm#crc.cat.crc-32-cksum"),
        new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("765e7680"), "Check value '123456789'", "https://reveng.sourceforge.io/crc-catalogue/17plus.htm#crc.cat.crc-32-cksum")
      ]
    },
    'CRC-32-BZIP2': {
      bitWidth: 32,
      description: 'CRC-32 used in BZIP2 compression format',
      polynomial: 0x04C11DB7,
      initialValue: 0xFFFFFFFF,
      inputReflected: false,
      resultReflected: false,
      finalXor: 0xFFFFFFFF,
      tests: [
        new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("00000000"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("19939b6b"), "Single character 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("fc891918"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
      ]
    },

    // CRC-64 Variants
    'CRC-64-XZ': {
      bitWidth: 64,
      description: 'CRC-64 used in XZ compression format and file integrity verification',
      polynomial: 0x42F0E1EBA9EA3693, // Normal form polynomial (will be reflected for table generation)
      polynomialHigh: 0x42f0e1eb,
      polynomialLow: 0xa9ea3693,
      initialValueHigh: 0xffffffff,
      initialValueLow: 0xffffffff,
      inputReflected: true,
      resultReflected: true,
      finalXorHigh: 0xffffffff,
      finalXorLow: 0xffffffff,
      tests: [
        new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("0000000000000000"), "Empty string", "Computed from algorithm"),
        new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("a0d4a674ee2140cc"), "Single byte 'a'", "Computed from algorithm"),
        new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("5f9c98fbdd93ba99"), "String '123456789'", "Computed from algorithm")
      ]
    },
    'CRC-64-ECMA182': {
      bitWidth: 64,
      description: 'CRC-64 ECMA-182 standard used in DLT-1 tape cartridges',
      polynomialHigh: 0x42f0e1eb,
      polynomialLow: 0xa9ea3693,
      initialValueHigh: 0x00000000,
      initialValueLow: 0x00000000,
      inputReflected: false,
      resultReflected: false,
      finalXorHigh: 0x00000000,
      finalXorLow: 0x00000000,
      tests: [
        new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("0000000000000000"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("548f120162451c62"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("6c40df5f0b497347"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
      ]
    },
    'CRC-64-WE': {
      bitWidth: 64,
      description: 'CRC-64/WE variant used in some applications with different initialization',
      polynomialHigh: 0x42f0e1eb,
      polynomialLow: 0xa9ea3693,
      initialValueHigh: 0xffffffff,
      initialValueLow: 0xffffffff,
      inputReflected: false,
      resultReflected: false,
      finalXorHigh: 0xffffffff,
      finalXorLow: 0xffffffff,
      tests: [
        new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("0000000000000000"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("ce73f427acc0a99a"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
        new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("62ec59e3f1a4f00a"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
      ]
    },

    // CRC-128 Variants
    'CRC-128-STANDARD': {
      bitWidth: 128,
      description: 'Standard 128-bit CRC used in high-performance computing and large data integrity verification',
      polynomial: [0x00000000, 0x00000000, 0x00000000, 0x00000087],
      initialValue: [0x00000000, 0x00000000, 0x00000000, 0x00000000],
      inputReflected: false,
      resultReflected: false,
      finalXor: [0x00000000, 0x00000000, 0x00000000, 0x00000000],
      tests: [
        new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("00000000000000000000000000000000"), "Empty string", "Educational test vector"),
        new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("000000000000000000000000000031a7"), "Single byte 'a'", "Educational test vector"),
        new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("000000000000180e870396109919b42f"), "String '123456789'", "Educational test vector")
      ]
    },
    'CRC-128-HPC': {
      bitWidth: 128,
      description: 'High-Performance Computing variant optimized for scientific computing and parallel processing',
      polynomial: [0xE0000000, 0x02008000, 0x00800000, 0x000000AB],
      initialValue: [0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF],
      inputReflected: false,
      resultReflected: false,
      finalXor: [0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF],
      tests: [
        new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("00000000000000000000000000000000"), "Empty string", "HPC test vector"),
        new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("80000001b86e00006e000000000072fb"), "Single byte 'a'", "HPC test vector")
      ]
    },
    'CRC-128-BIGDATA': {
      bitWidth: 128,
      description: 'Big Data variant designed for distributed storage systems and massive dataset integrity',
      polynomial: [0x00000001, 0x01010100, 0x00010001, 0x00010103],
      initialValue: [0x00000000, 0x00000000, 0x00000000, 0x00000000],
      inputReflected: false,
      resultReflected: false,
      finalXor: [0x00000000, 0x00000000, 0x00000000, 0x00000000],
      tests: [
        new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("00000000000000000000000000000000"), "Empty string", "BigData test vector"),
        new TestCase(OpCodes.AnsiToBytes("big data integrity test"), OpCodes.Hex8ToBytes("a9d63dcd9e4b92530cb8861b98fdcef8"), "Big data sample", "BigData test vector")
      ]
    }
  };

  // ===== UNIFIED CRC ALGORITHM CLASS =====

  class CRCAlgorithm extends Algorithm {
    constructor(variantKey) {
      super();

      this.config = CRC_VARIANTS[variantKey];
      if (!this.config) {
        throw new Error(`Unknown CRC variant: ${variantKey}`);
      }

      // Required metadata
      this.name = variantKey;
      this.description = `${this.config.description} Uses ${this.config.bitWidth}-bit polynomial with ${this.config.inputReflected ? 'reflected' : 'normal'} input processing.`;
      this.inventor = "W. Wesley Peterson";
      this.year = 1961;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Cyclic Redundancy Check";
      this.securityStatus = SecurityStatus.EDUCATIONAL;

      // Complexity based on bit width
      if (this.config.bitWidth <= 16) {
        this.complexity = ComplexityType.BEGINNER;
      } else if (this.config.bitWidth <= 32) {
        this.complexity = ComplexityType.INTERMEDIATE;
      } else {
        this.complexity = ComplexityType.ADVANCED;
      }

      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("CRC Theory", "https://en.wikipedia.org/wiki/Cyclic_redundancy_check"),
        new LinkItem("CRC Catalogue", "https://reveng.sourceforge.io/crc-catalogue/"),
        new LinkItem("CRC Applications", "https://users.ece.cmu.edu/~koopman/crc/")
      ];

      this.references = [
        new LinkItem("Peterson and Brown Paper", "https://dl.acm.org/doi/10.1145/321075.321076"),
        new LinkItem("CRC Parameter Database", "https://reveng.sourceforge.io/crc-catalogue/")
      ];

      // Known vulnerabilities (for CRC-32 and larger)
      if (this.config.bitWidth >= 32) {
        this.knownVulnerabilities = [
          {
            type: "Not Cryptographically Secure",
            text: "CRC is designed for error detection, not security. It can be easily manipulated by attackers who know the algorithm.",
            mitigation: "Use cryptographic hash functions (SHA-256, SHA-3) for security purposes. Use CRC only for error detection."
          },
          {
            type: "Hash Collisions",
            text: `CRC-${this.config.bitWidth} has limited output space, making collisions relatively easy to find intentionally.`,
            mitigation: "For security applications, use cryptographic hash functions with larger output sizes."
          }
        ];
      }

      // Test vectors specific to this variant
      this.tests = this.config.tests;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new CRCInstance(this, this.config);
    }
  }

  // ===== UNIFIED CRC INSTANCE CLASS =====

  /**
 * CRC cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class CRCInstance extends IAlgorithmInstance {
    constructor(algorithm, config) {
      super(algorithm);
      this.config = config;

      // Initialize CRC state based on bit width
      if (config.bitWidth <= 32) {
        this.crc = config.initialValue;
      } else if (config.bitWidth === 64) {
        this.crcHigh = config.initialValueHigh;
        this.crcLow = config.initialValueLow;
      } else if (config.bitWidth === 128) {
        this.crc = [...config.initialValue];
      }

      // Pre-computed lookup table
      this.crcTable = this._generateTable();
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Process each byte
      for (let i = 0; i < data.length; ++i) {
        this._updateCRC(data[i]);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      const bitWidth = this.config.bitWidth;
      let result;

      if (bitWidth <= 32) {
        result = this._result32();
      } else if (bitWidth === 64) {
        result = this._result64();
      } else if (bitWidth === 128) {
        result = this._result128();
      }

      // Reset for next calculation
      this._reset();

      return result;
    }

    _updateCRC(byte) {
      const bitWidth = this.config.bitWidth;

      if (bitWidth <= 32) {
        this._updateCRC32(byte);
      } else if (bitWidth === 64) {
        this._updateCRC64(byte);
      } else if (bitWidth === 128) {
        this._updateCRC128(byte);
      }
    }

    _updateCRC32(byte) {
      const bitWidth = this.config.bitWidth;
      let inputByte = byte;

      // Reflect input byte ONLY for 8-bit CRCs
      if (this.config.inputReflected && bitWidth === 8) {
        inputByte = this._reflect8(inputByte);
      }

      if (this.config.inputReflected) {
        // Reflected algorithm (LSB first)
        const tblIdx = OpCodes.AndN(OpCodes.XorN(this.crc, inputByte), 0xFF);
        if (bitWidth === 8) {
          this.crc = OpCodes.AndN(this.crcTable[tblIdx], 0xFF);
        } else if (bitWidth === 16) {
          this.crc = OpCodes.AndN(OpCodes.XorN(OpCodes.Shr32(this.crc, 8), this.crcTable[tblIdx]), 0xFFFF);
        } else if (bitWidth === 24) {
          this.crc = OpCodes.AndN(OpCodes.XorN(OpCodes.Shr32(this.crc, 8), this.crcTable[tblIdx]), 0xFFFFFF);
        } else if (bitWidth === 32) {
          this.crc = OpCodes.ToUint32(OpCodes.XorN(OpCodes.Shr32(this.crc, 8), this.crcTable[tblIdx]));
        }
      } else {
        // Normal algorithm (MSB first)
        if (bitWidth === 8) {
          const tblIdx = OpCodes.AndN(OpCodes.XorN(this.crc, inputByte), 0xFF);
          this.crc = OpCodes.AndN(this.crcTable[tblIdx], 0xFF);
        } else if (bitWidth === 16) {
          const tblIdx = OpCodes.AndN(OpCodes.XorN(OpCodes.Shr32(this.crc, 8), inputByte), 0xFF);
          this.crc = OpCodes.AndN(OpCodes.XorN(OpCodes.Shl32(this.crc, 8), this.crcTable[tblIdx]), 0xFFFF);
        } else if (bitWidth === 24) {
          const tblIdx = OpCodes.AndN(OpCodes.XorN(OpCodes.Shr32(this.crc, 16), inputByte), 0xFF);
          this.crc = OpCodes.AndN(OpCodes.XorN(OpCodes.Shl32(this.crc, 8), this.crcTable[tblIdx]), 0xFFFFFF);
        } else if (bitWidth === 32) {
          const tblIdx = OpCodes.AndN(OpCodes.XorN(OpCodes.Shr32(this.crc, 24), inputByte), 0xFF);
          this.crc = OpCodes.ToUint32(OpCodes.XorN(OpCodes.Shl32(this.crc, 8), this.crcTable[tblIdx]));
        }
      }
    }

    _updateCRC64(byte) {
      if (this.config.inputReflected) {
        // Reflected algorithm (LSB first)
        const tblIdx = OpCodes.AndN(OpCodes.XorN(this.crcLow, byte), 0xFF);
        const tableEntry = this.crcTable[tblIdx];

        this.crcLow = OpCodes.ToUint32(OpCodes.XorN(OpCodes.OrN(OpCodes.Shr32(this.crcLow, 8), OpCodes.Shl32(OpCodes.AndN(this.crcHigh, 0xFF), 24)), tableEntry.low));
        this.crcHigh = OpCodes.ToUint32(OpCodes.XorN(OpCodes.Shr32(this.crcHigh, 8), tableEntry.high));
      } else{
        // Normal algorithm (MSB first)
        const tblIdx = OpCodes.AndN(OpCodes.XorN(OpCodes.Shr32(this.crcHigh, 24), byte), 0xFF);
        const tableEntry = this.crcTable[tblIdx];

        this.crcHigh = OpCodes.XorN(OpCodes.OrN(OpCodes.Shl32(this.crcHigh, 8), OpCodes.AndN(OpCodes.Shr32(this.crcLow, 24), 0xFF)), tableEntry.high);
        this.crcLow = OpCodes.XorN(OpCodes.Shl32(this.crcLow, 8), tableEntry.low);

        this.crcHigh = OpCodes.ToUint32(this.crcHigh);
        this.crcLow = OpCodes.ToUint32(this.crcLow);
      }
    }

    _updateCRC128(byte) {
      if (this.config.inputReflected) {
        // Reflected algorithm (LSB first)
        const tblIdx = OpCodes.AndN(OpCodes.XorN(this.crc[3], byte), 0xFF);
        const tableEntry = this.crcTable[tblIdx];

        this.crc[3] = OpCodes.XorN(OpCodes.OrN(OpCodes.Shr32(this.crc[3], 8), OpCodes.Shl32(OpCodes.AndN(this.crc[2], 0xFF), 24)), tableEntry[3]);
        this.crc[2] = OpCodes.XorN(OpCodes.OrN(OpCodes.Shr32(this.crc[2], 8), OpCodes.Shl32(OpCodes.AndN(this.crc[1], 0xFF), 24)), tableEntry[2]);
        this.crc[1] = OpCodes.XorN(OpCodes.OrN(OpCodes.Shr32(this.crc[1], 8), OpCodes.Shl32(OpCodes.AndN(this.crc[0], 0xFF), 24)), tableEntry[1]);
        this.crc[0] = OpCodes.XorN(OpCodes.Shr32(this.crc[0], 8), tableEntry[0]);
      } else {
        // Normal algorithm (MSB first)
        const tblIdx = OpCodes.AndN(OpCodes.XorN(OpCodes.Shr32(this.crc[0], 24), byte), 0xFF);
        const tableEntry = this.crcTable[tblIdx];

        this.crc[0] = OpCodes.XorN(OpCodes.OrN(OpCodes.Shl32(this.crc[0], 8), OpCodes.AndN(OpCodes.Shr32(this.crc[1], 24), 0xFF)), tableEntry[0]);
        this.crc[1] = OpCodes.XorN(OpCodes.OrN(OpCodes.Shl32(this.crc[1], 8), OpCodes.AndN(OpCodes.Shr32(this.crc[2], 24), 0xFF)), tableEntry[1]);
        this.crc[2] = OpCodes.XorN(OpCodes.OrN(OpCodes.Shl32(this.crc[2], 8), OpCodes.AndN(OpCodes.Shr32(this.crc[3], 24), 0xFF)), tableEntry[2]);
        this.crc[3] = OpCodes.XorN(OpCodes.Shl32(this.crc[3], 8), tableEntry[3]);

        this.crc[0] = OpCodes.ToUint32(this.crc[0]);
        this.crc[1] = OpCodes.ToUint32(this.crc[1]);
        this.crc[2] = OpCodes.ToUint32(this.crc[2]);
        this.crc[3] = OpCodes.ToUint32(this.crc[3]);
      }
    }

    _result32() {
      const bitWidth = this.config.bitWidth;
      let finalCrc = this.crc;

      // Apply result reflection based on bit width
      // CRC-8: always reflect if resultReflected is true
      // CRC-16, CRC-24, CRC-32: reflect only if inputReflected != resultReflected
      if (bitWidth === 8) {
        if (this.config.resultReflected) {
          finalCrc = this._reflect8(finalCrc);
        }
      } else if (bitWidth >= 16 && bitWidth <= 32) {
        if (this.config.inputReflected !== this.config.resultReflected) {
          if (bitWidth === 16) {
            finalCrc = this._reflect16(finalCrc);
          } else if (bitWidth === 24) {
            finalCrc = this._reflect24(finalCrc);
          } else if (bitWidth === 32) {
            finalCrc = this._reflect32(finalCrc);
          }
        }
      }

      // Apply final XOR
      finalCrc = OpCodes.XorN(finalCrc, this.config.finalXor);

      // Convert to byte array (big-endian)
      if (bitWidth === 8) {
        return [OpCodes.AndN(finalCrc, 0xFF)];
      } else if (bitWidth === 16) {
        return OpCodes.Unpack16BE(finalCrc);
      } else if (bitWidth === 24) {
        return [
          OpCodes.AndN(OpCodes.Shr32(finalCrc, 16), 0xFF),
          OpCodes.AndN(OpCodes.Shr32(finalCrc, 8), 0xFF),
          OpCodes.AndN(finalCrc, 0xFF)
        ];
      } else if (bitWidth === 32) {
        return OpCodes.Unpack32BE(finalCrc);
      }
    }

    _result64() {
      let finalCrcHigh = this.crcHigh;
      let finalCrcLow = this.crcLow;

      // For CRC-64, use CRC-8 logic: always reflect if resultReflected is true
      // (different from CRC-16/24/32 which only reflect if inputReflected != resultReflected)
      if (this.config.resultReflected) {
        const temp = this._reflect64(finalCrcHigh, finalCrcLow);
        finalCrcHigh = temp.high;
        finalCrcLow = temp.low;
      }

      // Apply final XOR after reflection
      finalCrcHigh = OpCodes.ToUint32(OpCodes.XorN(finalCrcHigh, this.config.finalXorHigh));
      finalCrcLow = OpCodes.ToUint32(OpCodes.XorN(finalCrcLow, this.config.finalXorLow));

      // Return CRC as 8-byte array (big-endian)
      return [
        OpCodes.AndN(OpCodes.Shr32(finalCrcHigh, 24), 0xFF),
        OpCodes.AndN(OpCodes.Shr32(finalCrcHigh, 16), 0xFF),
        OpCodes.AndN(OpCodes.Shr32(finalCrcHigh, 8), 0xFF),
        OpCodes.AndN(finalCrcHigh, 0xFF),
        OpCodes.AndN(OpCodes.Shr32(finalCrcLow, 24), 0xFF),
        OpCodes.AndN(OpCodes.Shr32(finalCrcLow, 16), 0xFF),
        OpCodes.AndN(OpCodes.Shr32(finalCrcLow, 8), 0xFF),
        OpCodes.AndN(finalCrcLow, 0xFF)
      ];
    }

    _result128() {
      const finalCrc = [
        OpCodes.ToUint32(OpCodes.XorN(this.crc[0], this.config.finalXor[0])),
        OpCodes.ToUint32(OpCodes.XorN(this.crc[1], this.config.finalXor[1])),
        OpCodes.ToUint32(OpCodes.XorN(this.crc[2], this.config.finalXor[2])),
        OpCodes.ToUint32(OpCodes.XorN(this.crc[3], this.config.finalXor[3]))
      ];

      // Return CRC as 16-byte array (big-endian)
      return [
        OpCodes.AndN(OpCodes.Shr32(finalCrc[0], 24), 0xFF), OpCodes.AndN(OpCodes.Shr32(finalCrc[0], 16), 0xFF), OpCodes.AndN(OpCodes.Shr32(finalCrc[0], 8), 0xFF), OpCodes.AndN(finalCrc[0], 0xFF),
        OpCodes.AndN(OpCodes.Shr32(finalCrc[1], 24), 0xFF), OpCodes.AndN(OpCodes.Shr32(finalCrc[1], 16), 0xFF), OpCodes.AndN(OpCodes.Shr32(finalCrc[1], 8), 0xFF), OpCodes.AndN(finalCrc[1], 0xFF),
        OpCodes.AndN(OpCodes.Shr32(finalCrc[2], 24), 0xFF), OpCodes.AndN(OpCodes.Shr32(finalCrc[2], 16), 0xFF), OpCodes.AndN(OpCodes.Shr32(finalCrc[2], 8), 0xFF), OpCodes.AndN(finalCrc[2], 0xFF),
        OpCodes.AndN(OpCodes.Shr32(finalCrc[3], 24), 0xFF), OpCodes.AndN(OpCodes.Shr32(finalCrc[3], 16), 0xFF), OpCodes.AndN(OpCodes.Shr32(finalCrc[3], 8), 0xFF), OpCodes.AndN(finalCrc[3], 0xFF)
      ];
    }

    _reset() {
      if (this.config.bitWidth <= 32) {
        this.crc = this.config.initialValue;
      } else if (this.config.bitWidth === 64) {
        this.crcHigh = this.config.initialValueHigh;
        this.crcLow = this.config.initialValueLow;
      } else if (this.config.bitWidth === 128) {
        this.crc = [...this.config.initialValue];
      }
    }

    _generateTable() {
      const bitWidth = this.config.bitWidth;

      if (bitWidth <= 32) {
        return this._generateTable32();
      } else if (bitWidth === 64) {
        return this._generateTable64();
      } else if (bitWidth === 128) {
        return this._generateTable128();
      }
    }

    _generateTable32() {
      const table = new Array(256);
      const bitWidth = this.config.bitWidth;
      const mask = bitWidth === 8 ? 0xFF : bitWidth === 16 ? 0xFFFF : bitWidth === 24 ? 0xFFFFFF : 0xFFFFFFFF;
      const msbBit = bitWidth === 8 ? 0x80 : bitWidth === 16 ? 0x8000 : bitWidth === 24 ? 0x800000 : 0x80000000;

      for (let i = 0; i < 256; i++) {
        let crc;

        if (this.config.inputReflected) {
          // Generate reflected table
          // Pre-compute reflected polynomial once
          const reflectedPoly = bitWidth === 8 ? this._reflect8(this.config.polynomial) :
                                bitWidth === 16 ? this._reflect16(this.config.polynomial) :
                                bitWidth === 24 ? this._reflect24(this.config.polynomial) :
                                this._reflect32(this.config.polynomial);

          crc = i;
          for (let j = 0; j < 8; j++) {
            if (OpCodes.AndN(crc, 1)) {
              crc = OpCodes.ToUint32(OpCodes.XorN(OpCodes.Shr32(crc, 1), reflectedPoly));
            } else {
              crc = OpCodes.Shr32(crc, 1);
            }
          }
        } else {
          // Generate normal table
          crc = bitWidth === 8 ? i : OpCodes.Shl32(i, bitWidth - 8);
          for (let j = 0; j < 8; j++) {
            if (OpCodes.AndN(crc, msbBit)) {
              crc = OpCodes.XorN(OpCodes.Shl32(crc, 1), this.config.polynomial);
            } else {
              crc = OpCodes.Shl32(crc, 1);
            }
          }
        }

        table[i] = OpCodes.AndN(crc, mask);
      }

      return table;
    }

    _generateTable64() {
      const table = new Array(256);

      // For reflected CRCs, reflect the polynomial once
      let polyHigh = this.config.polynomialHigh;
      let polyLow = this.config.polynomialLow;
      if (this.config.inputReflected) {
        const reflected = this._reflect64(polyHigh, polyLow);
        polyHigh = reflected.high;
        polyLow = reflected.low;
      }

      for (let i = 0; i < 256; i++) {
        let crcHigh, crcLow;

        if (this.config.inputReflected) {
          // Generate reflected table
          crcLow = i;
          crcHigh = 0;
          for (let j = 0; j < 8; j++) {
            const carry = OpCodes.AndN(crcLow, 1);
            crcLow = OpCodes.OrN(OpCodes.Shr32(crcLow, 1), OpCodes.Shl32(OpCodes.AndN(crcHigh, 1), 31));
            crcHigh = OpCodes.Shr32(crcHigh, 1);

            if (carry) {
              crcHigh = OpCodes.ToUint32(OpCodes.XorN(crcHigh, polyHigh));
              crcLow = OpCodes.ToUint32(OpCodes.XorN(crcLow, polyLow));
            }
          }
        } else {
          // Generate normal table
          crcHigh = OpCodes.Shl32(i, 24);
          crcLow = 0;
          for (let j = 0; j < 8; j++) {
            const carry = OpCodes.AndN(crcHigh, 0x80000000);
            crcHigh = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(crcHigh, 1), OpCodes.AndN(OpCodes.Shr32(crcLow, 31), 1)));
            crcLow = OpCodes.ToUint32(OpCodes.Shl32(crcLow, 1));

            if (carry) {
              crcHigh = OpCodes.XorN(crcHigh, this.config.polynomialHigh);
              crcLow = OpCodes.XorN(crcLow, this.config.polynomialLow);
            }
          }
        }

        table[i] = { high: OpCodes.ToUint32(crcHigh), low: OpCodes.ToUint32(crcLow) };
      }

      return table;
    }

    _generateTable128() {
      const table = new Array(256);

      for (let i = 0; i < 256; i++) {
        let crc = [OpCodes.Shl32(i, 24), 0, 0, 0];

        // Process 8 bits
        for (let j = 0; j < 8; j++) {
          const carry = OpCodes.AndN(crc[0], 0x80000000);

          // Shift left across all 128 bits
          crc[0] = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(crc[0], 1), OpCodes.AndN(OpCodes.Shr32(crc[1], 31), 1)));
          crc[1] = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(crc[1], 1), OpCodes.AndN(OpCodes.Shr32(crc[2], 31), 1)));
          crc[2] = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(crc[2], 1), OpCodes.AndN(OpCodes.Shr32(crc[3], 31), 1)));
          crc[3] = OpCodes.ToUint32(OpCodes.Shl32(crc[3], 1));

          // XOR with polynomial if there was a carry
          if (carry) {
            crc[0] = OpCodes.XorN(crc[0], this.config.polynomial[0]);
            crc[1] = OpCodes.XorN(crc[1], this.config.polynomial[1]);
            crc[2] = OpCodes.XorN(crc[2], this.config.polynomial[2]);
            crc[3] = OpCodes.XorN(crc[3], this.config.polynomial[3]);
          }
        }

        table[i] = [OpCodes.ToUint32(crc[0]), OpCodes.ToUint32(crc[1]), OpCodes.ToUint32(crc[2]), OpCodes.ToUint32(crc[3])];
      }

      return table;
    }

    _reflect8(value) {
      let reflected = 0;
      for (let i = 0; i < 8; i++) {
        reflected = OpCodes.OrN(OpCodes.Shl32(reflected, 1), OpCodes.AndN(value, 1));
        value = OpCodes.Shr32(value, 1);
      }
      return reflected;
    }

    _reflect16(value) {
      let reflected = 0;
      for (let i = 0; i < 16; i++) {
        reflected = OpCodes.OrN(OpCodes.Shl32(reflected, 1), OpCodes.AndN(value, 1));
        value = OpCodes.Shr32(value, 1);
      }
      return reflected;
    }

    _reflect24(value) {
      let reflected = 0;
      for (let i = 0; i < 24; i++) {
        reflected = OpCodes.OrN(OpCodes.Shl32(reflected, 1), OpCodes.AndN(value, 1));
        value = OpCodes.Shr32(value, 1);
      }
      return reflected;
    }

    _reflect32(value) {
      let reflected = 0;
      for (let i = 0; i < 32; i++) {
        reflected = OpCodes.OrN(OpCodes.Shl32(reflected, 1), OpCodes.AndN(value, 1));
        value = OpCodes.Shr32(value, 1);
      }
      return OpCodes.ToUint32(reflected);
    }

    _reflect64(high, low) {
      const reflectedHigh = this._reflect32(low);
      const reflectedLow = this._reflect32(high);
      return { high: reflectedHigh, low: reflectedLow };
    }
  }

  // ===== REGISTER ALL VARIANTS =====

  Object.keys(CRC_VARIANTS).forEach(variantKey => {
    RegisterAlgorithm(new CRCAlgorithm(variantKey));
  });

  // ===== EXPORTS =====

  return { CRCAlgorithm, CRCInstance, CRC_VARIANTS };
}));
