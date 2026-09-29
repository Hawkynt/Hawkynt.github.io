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
          Algorithm, IAlgorithmInstance, TestCase, LinkItem, Vulnerability } = AlgorithmFramework;

  // ===== SHARED CRC VARIANT LIST =====

  /** @type {string[]} Names of all registered CRC variants, in registration order */
  const CRC_VARIANT_NAMES = [
    'CRC-8-SMBUS', 'CRC-8-MAXIM', 'CRC-8-AUTOSAR', 'CRC-8-CDMA2000',
    'CRC-16-CCITT', 'CRC-16-ARC', 'CRC-16-IBM', 'CRC-16-ANSI',
    'CRC-16-XMODEM', 'CRC-24-OPENPGP', 'CRC-24-FLEXRAY', 'CRC-24-INTERLAKEN',
    'CRC-32-IEEE', 'CRC-32-POSIX', 'CRC-32-BZIP2', 'CRC-64-XZ',
    'CRC-64-ECMA182', 'CRC-64-WE', 'CRC-128-STANDARD', 'CRC-128-HPC',
    'CRC-128-BIGDATA'
  ];

  // ===== UNIFIED CRC ALGORITHM CLASS =====

  /**
   * CRC parameter set (bit width, polynomial, initial value, reflection, final XOR)
   * @class
   * @extends {Algorithm}
   */
  class CRCAlgorithm extends Algorithm {
    /**
     * Configure one CRC variant from the catalogue
     * @param {string} variantName - One of CRC_VARIANT_NAMES
     */
    constructor(variantName) {
      super();

      /** @type {int32} Register width in bits (8, 16, 24, 32, 64 or 128) */
      this.bitWidth = 0;
      /** @type {boolean} Input bytes are processed LSB first */
      this.inputReflected = false;
      /** @type {boolean} The register is reflected before the final XOR */
      this.resultReflected = false;
      /** @type {uint32} Polynomial (widths up to 32) */
      this.polynomial = 0;
      /** @type {uint32} Initial register value (widths up to 32) */
      this.initialValue = 0;
      /** @type {uint32} Final XOR value (widths up to 32) */
      this.finalXor = 0;
      /** @type {uint32} Polynomial, high word (64-bit width) */
      this.polynomialHigh = 0;
      /** @type {uint32} Polynomial, low word (64-bit width) */
      this.polynomialLow = 0;
      /** @type {uint32} Initial register value, high word (64-bit width) */
      this.initialValueHigh = 0;
      /** @type {uint32} Initial register value, low word (64-bit width) */
      this.initialValueLow = 0;
      /** @type {uint32} Final XOR value, high word (64-bit width) */
      this.finalXorHigh = 0;
      /** @type {uint32} Final XOR value, low word (64-bit width) */
      this.finalXorLow = 0;
      /** @type {uint32[]} Polynomial, most significant word first (128-bit width) */
      this.polynomial128 = new Array(0);
      /** @type {uint32[]} Initial register value, most significant word first (128-bit width) */
      this.initialValue128 = new Array(0);
      /** @type {uint32[]} Final XOR value, most significant word first (128-bit width) */
      this.finalXor128 = new Array(0);
      /** @type {string} What the variant is used for */
      this.variantDescription = '';

      switch (variantName) {
        case 'CRC-8-SMBUS':
          this.variantDescription = '8-bit CRC used in System Management Bus (SMBus) specification for I2C communications';
          this.bitWidth = 8;
          this.polynomial = 0x07;
          this.initialValue = 0x00;
          this.inputReflected = false;
          this.resultReflected = false;
          this.finalXor = 0x00;
          this.tests = [
            new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("00"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("20"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("f4"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
          ];
          break;
        case 'CRC-8-MAXIM':
          this.variantDescription = '8-bit CRC used in Maxim/Dallas 1-Wire device registration numbers';
          this.bitWidth = 8;
          this.polynomial = 0x31;
          this.initialValue = 0x00;
          this.inputReflected = true;
          this.resultReflected = true;
          this.finalXor = 0x00;
          this.tests = [
            new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("00"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/all.htm#crc.cat.crc-8-maxim-dow"),
            new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("3b"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/all.htm#crc.cat.crc-8-maxim-dow"),
            new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("a1"), "Catalogue check value for CRC-8/MAXIM-DOW", "https://reveng.sourceforge.io/crc-catalogue/all.htm#crc.cat.crc-8-maxim-dow")
          ];
          break;
        case 'CRC-8-AUTOSAR':
          this.variantDescription = '8-bit CRC used in AUTOSAR Classic Platform for automotive applications';
          this.bitWidth = 8;
          this.polynomial = 0x2F;
          this.initialValue = 0xFF;
          this.inputReflected = false;
          this.resultReflected = false;
          this.finalXor = 0xFF;
          this.tests = [
            new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("00"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("07"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("df"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
          ];
          break;
        case 'CRC-8-CDMA2000':
          this.variantDescription = '8-bit CRC used in CDMA2000 mobile telecommunications standard';
          this.bitWidth = 8;
          this.polynomial = 0x9B;
          this.initialValue = 0xFF;
          this.inputReflected = false;
          this.resultReflected = false;
          this.finalXor = 0x00;
          this.tests = [
            new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("ff"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("4c"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("da"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
          ];
          break;
        case 'CRC-16-CCITT':
          this.variantDescription = '16-bit CRC used in CCITT/ITU-T standards, telecommunications, and X.25 protocol';
          this.bitWidth = 16;
          this.polynomial = 0x1021;
          this.initialValue = 0x0000;
          this.inputReflected = false;
          this.resultReflected = false;
          this.finalXor = 0x0000;
          this.tests = [
            new TestCase(OpCodes.AnsiToBytes(''), OpCodes.Hex8ToBytes('0000'), 'Empty string', 'https://reveng.sourceforge.io/crc-catalogue/'),
            new TestCase(OpCodes.AnsiToBytes('A'), OpCodes.Hex8ToBytes('58E5'), 'Single byte A', 'https://reveng.sourceforge.io/crc-catalogue/'),
            new TestCase(OpCodes.AnsiToBytes('123456789'), OpCodes.Hex8ToBytes('31C3'), 'String 123456789', 'https://reveng.sourceforge.io/crc-catalogue/')
          ];
          break;
        case 'CRC-16-ARC':
          this.variantDescription = '16-bit CRC used in ARC archiver and reflected algorithms (LSB first processing)';
          this.bitWidth = 16;
          this.polynomial = 0x8005;
          this.initialValue = 0x0000;
          this.inputReflected = true;
          this.resultReflected = true;
          this.finalXor = 0x0000;
          this.tests = [
            new TestCase(OpCodes.AnsiToBytes(''), OpCodes.Hex8ToBytes('0000'), 'Empty string', 'https://reveng.sourceforge.io/crc-catalogue/'),
            new TestCase(OpCodes.AnsiToBytes('123456789'), OpCodes.Hex8ToBytes('BB3D'), 'Standard test string', 'https://reveng.sourceforge.io/crc-catalogue/')
          ];
          break;
        case 'CRC-16-IBM':
          this.variantDescription = '16-bit CRC used by IBM in SDLC and USB standards';
          this.bitWidth = 16;
          this.polynomial = 0x8005;
          this.initialValue = 0x0000;
          this.inputReflected = true;
          this.resultReflected = true;
          this.finalXor = 0x0000;
          this.tests = [
            new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("0000"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("e8c1"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("abc"), OpCodes.Hex8ToBytes("9738"), "String 'abc'", "https://reveng.sourceforge.io/crc-catalogue/")
          ];
          break;
        case 'CRC-16-ANSI':
          this.variantDescription = '16-bit CRC used in ANSI standards and some protocols';
          this.bitWidth = 16;
          this.polynomial = 0x8005;
          this.initialValue = 0xFFFF;
          this.inputReflected = true;
          this.resultReflected = true;
          this.finalXor = 0x0000;
          this.tests = [
            new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("ffff"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("a87e"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("abc"), OpCodes.Hex8ToBytes("5749"), "String 'abc'", "https://reveng.sourceforge.io/crc-catalogue/")
          ];
          break;
        case 'CRC-16-XMODEM':
          this.variantDescription = '16-bit CRC used in XMODEM protocol with different initial value';
          this.bitWidth = 16;
          this.polynomial = 0x1021;
          this.initialValue = 0x0000;
          this.inputReflected = false;
          this.resultReflected = false;
          this.finalXor = 0x0000;
          this.tests = [
            new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("0000"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("A"), OpCodes.Hex8ToBytes("58e5"), "Single byte 'A'", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("31c3"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
          ];
          break;
        case 'CRC-24-OPENPGP':
          this.variantDescription = '24-bit CRC used in OpenPGP ASCII armor for message integrity checking';
          this.bitWidth = 24;
          this.polynomial = 0x1864CFB;
          this.initialValue = 0xB704CE;
          this.inputReflected = false;
          this.resultReflected = false;
          this.finalXor = 0x000000;
          this.tests = [
            new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("b704ce"), "Empty string", "https://tools.ietf.org/html/rfc4880"),
            new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("f25713"), "Single byte 'a'", "https://tools.ietf.org/html/rfc4880"),
            new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("21cf02"), "String '123456789'", "https://tools.ietf.org/html/rfc4880")
          ];
          break;
        case 'CRC-24-FLEXRAY':
          this.variantDescription = '24-bit CRC used in FlexRay automotive communication protocol';
          this.bitWidth = 24;
          this.polynomial = 0x5D6DCB;
          this.initialValue = 0xFEDCBA;
          this.inputReflected = false;
          this.resultReflected = false;
          this.finalXor = 0x000000;
          this.tests = [
            new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("fedcba"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("8fe324"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("7979bd"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
          ];
          break;
        case 'CRC-24-INTERLAKEN':
          this.variantDescription = '24-bit CRC used in Interlaken protocol for high-speed chip-to-chip communication';
          this.bitWidth = 24;
          this.polynomial = 0x328B63;
          this.initialValue = 0xFFFFFF;
          this.inputReflected = false;
          this.resultReflected = false;
          this.finalXor = 0xFFFFFF;
          this.tests = [
            new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("000000"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("d80156"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("b4f3e6"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
          ];
          break;
        case 'CRC-32-IEEE':
          this.variantDescription = 'CRC-32 (IEEE 802.3) standard used in Ethernet, zip files, and many protocols';
          this.bitWidth = 32;
          this.polynomial = 0x04C11DB7;
          this.initialValue = 0xFFFFFFFF;
          this.inputReflected = true;
          this.resultReflected = true;
          this.finalXor = 0xFFFFFFFF;
          this.tests = [
            new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("00000000"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("e8b7be43"), "Single character 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("abc"), OpCodes.Hex8ToBytes("352441c2"), "String 'abc'", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("cbf43926"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
          ];
          break;
        case 'CRC-32-POSIX':
          this.variantDescription = 'CRC-32/POSIX (also known as CKSUM) - base algorithm without length appending';
          this.bitWidth = 32;
          this.polynomial = 0x04C11DB7;
          this.initialValue = 0x00000000;
          this.inputReflected = false;
          this.resultReflected = false;
          this.finalXor = 0xFFFFFFFF;
          this.tests = [
            new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("ffffffff"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/17plus.htm#crc.cat.crc-32-cksum"),
            new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("765e7680"), "Check value '123456789'", "https://reveng.sourceforge.io/crc-catalogue/17plus.htm#crc.cat.crc-32-cksum")
          ];
          break;
        case 'CRC-32-BZIP2':
          this.variantDescription = 'CRC-32 used in BZIP2 compression format';
          this.bitWidth = 32;
          this.polynomial = 0x04C11DB7;
          this.initialValue = 0xFFFFFFFF;
          this.inputReflected = false;
          this.resultReflected = false;
          this.finalXor = 0xFFFFFFFF;
          this.tests = [
            new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("00000000"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("19939b6b"), "Single character 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("fc891918"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
          ];
          break;
        case 'CRC-64-XZ':
          this.variantDescription = 'CRC-64 used in XZ compression format and file integrity verification';
          this.bitWidth = 64;
          this.polynomialHigh = 0x42f0e1eb;
          this.polynomialLow = 0xa9ea3693;
          this.initialValueHigh = 0xffffffff;
          this.initialValueLow = 0xffffffff;
          this.inputReflected = true;
          this.resultReflected = true;
          this.finalXorHigh = 0xffffffff;
          this.finalXorLow = 0xffffffff;
          this.tests = [
            new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("0000000000000000"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/17plus.htm#crc.cat.crc-64-xz"),
            new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("330284772e652b05"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/17plus.htm#crc.cat.crc-64-xz"),
            new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("995dc9bbdf1939fa"), "Catalogue check value for CRC-64/XZ", "https://reveng.sourceforge.io/crc-catalogue/17plus.htm#crc.cat.crc-64-xz")
          ];
          break;
        case 'CRC-64-ECMA182':
          this.variantDescription = 'CRC-64 ECMA-182 standard used in DLT-1 tape cartridges';
          this.bitWidth = 64;
          this.polynomialHigh = 0x42f0e1eb;
          this.polynomialLow = 0xa9ea3693;
          this.initialValueHigh = 0x00000000;
          this.initialValueLow = 0x00000000;
          this.inputReflected = false;
          this.resultReflected = false;
          this.finalXorHigh = 0x00000000;
          this.finalXorLow = 0x00000000;
          this.tests = [
            new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("0000000000000000"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("548f120162451c62"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("6c40df5f0b497347"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
          ];
          break;
        case 'CRC-64-WE':
          this.variantDescription = 'CRC-64/WE variant used in some applications with different initialization';
          this.bitWidth = 64;
          this.polynomialHigh = 0x42f0e1eb;
          this.polynomialLow = 0xa9ea3693;
          this.initialValueHigh = 0xffffffff;
          this.initialValueLow = 0xffffffff;
          this.inputReflected = false;
          this.resultReflected = false;
          this.finalXorHigh = 0xffffffff;
          this.finalXorLow = 0xffffffff;
          this.tests = [
            new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("0000000000000000"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("ce73f427acc0a99a"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
            new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("62ec59e3f1a4f00a"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
          ];
          break;
        case 'CRC-128-STANDARD':
          this.variantDescription = 'Standard 128-bit CRC used in high-performance computing and large data integrity verification';
          this.bitWidth = 128;
          this.polynomial128 = [0x00000000, 0x00000000, 0x00000000, 0x00000087];
          this.initialValue128 = [0x00000000, 0x00000000, 0x00000000, 0x00000000];
          this.inputReflected = false;
          this.resultReflected = false;
          this.finalXor128 = [0x00000000, 0x00000000, 0x00000000, 0x00000000];
          this.tests = [
            new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("00000000000000000000000000000000"), "Empty string", "Educational test vector"),
            new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("000000000000000000000000000031a7"), "Single byte 'a'", "Educational test vector"),
            new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("000000000000180e870396109919b42f"), "String '123456789'", "Educational test vector")
          ];
          break;
        case 'CRC-128-HPC':
          this.variantDescription = 'High-Performance Computing variant optimized for scientific computing and parallel processing';
          this.bitWidth = 128;
          this.polynomial128 = [0xE0000000, 0x02008000, 0x00800000, 0x000000AB];
          this.initialValue128 = [0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF];
          this.inputReflected = false;
          this.resultReflected = false;
          this.finalXor128 = [0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF];
          this.tests = [
            new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("00000000000000000000000000000000"), "Empty string", "HPC test vector"),
            new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("80000001b86e00006e000000000072fb"), "Single byte 'a'", "HPC test vector")
          ];
          break;
        case 'CRC-128-BIGDATA':
          this.variantDescription = 'Big Data variant designed for distributed storage systems and massive dataset integrity';
          this.bitWidth = 128;
          this.polynomial128 = [0x00000001, 0x01010100, 0x00010001, 0x00010103];
          this.initialValue128 = [0x00000000, 0x00000000, 0x00000000, 0x00000000];
          this.inputReflected = false;
          this.resultReflected = false;
          this.finalXor128 = [0x00000000, 0x00000000, 0x00000000, 0x00000000];
          this.tests = [
            new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("00000000000000000000000000000000"), "Empty string", "BigData test vector"),
            new TestCase(OpCodes.AnsiToBytes("big data integrity test"), OpCodes.Hex8ToBytes("a9d63dcd9e4b92530cb8861b98fdcef8"), "Big data sample", "BigData test vector")
          ];
          break;
        default:
          throw new Error('Unknown CRC variant: ' + variantName);
      }

      // Required metadata
      this.name = variantName;
      this.description = this.variantDescription + ' Uses ' + this.bitWidth + '-bit polynomial with ' + (this.inputReflected ? 'reflected' : 'normal') + ' input processing.';
      this.inventor = "W. Wesley Peterson";
      this.year = 1961;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Cyclic Redundancy Check";
      this.securityStatus = SecurityStatus.EDUCATIONAL;

      // Complexity based on bit width
      if (this.bitWidth <= 16) {
        this.complexity = ComplexityType.BEGINNER;
      } else if (this.bitWidth <= 32) {
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
      if (this.bitWidth >= 32) {
        this.knownVulnerabilities = [
          new Vulnerability(
            "Not Cryptographically Secure",
            "CRC is designed for error detection, not security. It can be easily manipulated by attackers who know the algorithm.",
            "Use cryptographic hash functions (SHA-256, SHA-3) for security purposes. Use CRC only for error detection."
          ),
          new Vulnerability(
            "Hash Collisions",
            "CRC-" + this.bitWidth + " has limited output space, making collisions relatively easy to find intentionally.",
            "For security applications, use cryptographic hash functions with larger output sizes."
          )
        ];
      }
    }

    /**
   * Create new checksum instance
   * @param {boolean} [isInverse=false] - Checksums have no inverse
   * @returns {CRCInstance} New checksum instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new CRCInstance(this);
    }
  }

  // ===== UNIFIED CRC INSTANCE CLASS =====

  /**
 * CRC instance implementing the Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class CRCInstance extends IAlgorithmInstance {
    /**
     * Copy the variant parameters and build the lookup table
     * @param {CRCAlgorithm} algorithm - Parent algorithm (the variant)
     */
    constructor(algorithm) {
      super(algorithm);

      /** @type {int32} */
      this.bitWidth = algorithm.bitWidth;
      /** @type {boolean} */
      this.inputReflected = algorithm.inputReflected;
      /** @type {boolean} */
      this.resultReflected = algorithm.resultReflected;
      /** @type {uint32} */
      this.polynomial = algorithm.polynomial;
      /** @type {uint32} */
      this.initialValue = algorithm.initialValue;
      /** @type {uint32} */
      this.finalXor = algorithm.finalXor;
      /** @type {uint32} */
      this.polynomialHigh = algorithm.polynomialHigh;
      /** @type {uint32} */
      this.polynomialLow = algorithm.polynomialLow;
      /** @type {uint32} */
      this.initialValueHigh = algorithm.initialValueHigh;
      /** @type {uint32} */
      this.initialValueLow = algorithm.initialValueLow;
      /** @type {uint32} */
      this.finalXorHigh = algorithm.finalXorHigh;
      /** @type {uint32} */
      this.finalXorLow = algorithm.finalXorLow;
      /** @type {uint32[]} */
      this.polynomial128 = algorithm.polynomial128;
      /** @type {uint32[]} */
      this.initialValue128 = algorithm.initialValue128;
      /** @type {uint32[]} */
      this.finalXor128 = algorithm.finalXor128;

      // CRC state: one word for widths up to 32, a high/low pair for 64,
      // four words (most significant first) for 128
      /** @type {uint32} */
      this.crc = 0;
      /** @type {uint32} */
      this.crcHigh = 0;
      /** @type {uint32} */
      this.crcLow = 0;
      /** @type {uint32[]} */
      this.crc128 = new Array(0);

      // Pre-computed lookup tables (only the one matching the width is filled)
      /** @type {uint32[]} */
      this.crcTable = new Array(0);
      /** @type {uint32[]} */
      this.crcTableHigh = new Array(0);
      /** @type {uint32[]} */
      this.crcTableLow = new Array(0);
      /** @type {uint32[]} 256 entries of four words each, most significant word first */
      this.crcTable128 = new Array(0);

      this._reset();

      if (this.bitWidth <= 32) {
        this.crcTable = this._generateTable32();
      } else if (this.bitWidth === 64) {
        this._generateTable64();
      } else if (this.bitWidth === 128) {
        this.crcTable128 = this._generateTable128();
      }
    }

    /**
   * Feed data to the checksum
   * @param {uint8[]} data - Input data bytes
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Process each byte
      for (let i = 0; i < data.length; ++i) {
        this._updateCRC(data[i]);
      }
    }

    /**
   * Get the checksum of everything fed so far and reset for the next message
   * @returns {uint8[]} CRC value, big-endian
   */

    Result() {
      const bitWidth = this.bitWidth;
      /** @type {uint8[]} */
      let result = null;

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

    /**
     * Process one input byte
     * @param {uint8} byte - Input byte
     * @returns {void}
     */
    _updateCRC(byte) {
      const bitWidth = this.bitWidth;

      if (bitWidth <= 32) {
        this._updateCRC32(byte);
      } else if (bitWidth === 64) {
        this._updateCRC64(byte);
      } else if (bitWidth === 128) {
        this._updateCRC128(byte);
      }
    }

    /**
     * Process one input byte for widths up to 32
     * @param {uint8} byte - Input byte
     * @returns {void}
     */
    _updateCRC32(byte) {
      const bitWidth = this.bitWidth;
      // The reflected table is built from the reflected polynomial and consumed
      // LSB-first, which already accounts for inputReflected. Reflecting the
      // incoming byte on top of that would apply the reflection twice.
      const inputByte = byte;

      if (this.inputReflected) {
        // Reflected algorithm (LSB first)
        const tblIdx = OpCodes.And32(OpCodes.Xor32(this.crc, inputByte), 0xFF);
        if (bitWidth === 8) {
          this.crc = OpCodes.And32(this.crcTable[tblIdx], 0xFF);
        } else if (bitWidth === 16) {
          this.crc = OpCodes.And32(OpCodes.Xor32(OpCodes.Shr32(this.crc, 8), this.crcTable[tblIdx]), 0xFFFF);
        } else if (bitWidth === 24) {
          this.crc = OpCodes.And32(OpCodes.Xor32(OpCodes.Shr32(this.crc, 8), this.crcTable[tblIdx]), 0xFFFFFF);
        } else if (bitWidth === 32) {
          this.crc = OpCodes.Xor32(OpCodes.Shr32(this.crc, 8), this.crcTable[tblIdx]);
        }
      } else {
        // Normal algorithm (MSB first)
        if (bitWidth === 8) {
          const tblIdx = OpCodes.And32(OpCodes.Xor32(this.crc, inputByte), 0xFF);
          this.crc = OpCodes.And32(this.crcTable[tblIdx], 0xFF);
        } else if (bitWidth === 16) {
          const tblIdx = OpCodes.And32(OpCodes.Xor32(OpCodes.Shr32(this.crc, 8), inputByte), 0xFF);
          this.crc = OpCodes.And32(OpCodes.Xor32(OpCodes.Shl32(this.crc, 8), this.crcTable[tblIdx]), 0xFFFF);
        } else if (bitWidth === 24) {
          const tblIdx = OpCodes.And32(OpCodes.Xor32(OpCodes.Shr32(this.crc, 16), inputByte), 0xFF);
          this.crc = OpCodes.And32(OpCodes.Xor32(OpCodes.Shl32(this.crc, 8), this.crcTable[tblIdx]), 0xFFFFFF);
        } else if (bitWidth === 32) {
          const tblIdx = OpCodes.And32(OpCodes.Xor32(OpCodes.Shr32(this.crc, 24), inputByte), 0xFF);
          this.crc = OpCodes.Xor32(OpCodes.Shl32(this.crc, 8), this.crcTable[tblIdx]);
        }
      }
    }

    /**
     * Process one input byte for the 64-bit width
     * @param {uint8} byte - Input byte
     * @returns {void}
     */
    _updateCRC64(byte) {
      if (this.inputReflected) {
        // Reflected algorithm (LSB first)
        const tblIdx = OpCodes.And32(OpCodes.Xor32(this.crcLow, byte), 0xFF);

        this.crcLow = OpCodes.Xor32(OpCodes.Or32(OpCodes.Shr32(this.crcLow, 8), OpCodes.Shl32(OpCodes.And32(this.crcHigh, 0xFF), 24)), this.crcTableLow[tblIdx]);
        this.crcHigh = OpCodes.Xor32(OpCodes.Shr32(this.crcHigh, 8), this.crcTableHigh[tblIdx]);
      } else {
        // Normal algorithm (MSB first)
        const tblIdx = OpCodes.And32(OpCodes.Xor32(OpCodes.Shr32(this.crcHigh, 24), byte), 0xFF);

        this.crcHigh = OpCodes.Xor32(OpCodes.Or32(OpCodes.Shl32(this.crcHigh, 8), OpCodes.And32(OpCodes.Shr32(this.crcLow, 24), 0xFF)), this.crcTableHigh[tblIdx]);
        this.crcLow = OpCodes.Xor32(OpCodes.Shl32(this.crcLow, 8), this.crcTableLow[tblIdx]);
      }
    }

    /**
     * Process one input byte for the 128-bit width
     * @param {uint8} byte - Input byte
     * @returns {void}
     */
    _updateCRC128(byte) {
      const crc = this.crc128;
      if (this.inputReflected) {
        // Reflected algorithm (LSB first)
        /** @type {int32} */
        const entry = OpCodes.And32(OpCodes.Xor32(crc[3], byte), 0xFF) * 4;

        crc[3] = OpCodes.Xor32(OpCodes.Or32(OpCodes.Shr32(crc[3], 8), OpCodes.Shl32(OpCodes.And32(crc[2], 0xFF), 24)), this.crcTable128[entry + 3]);
        crc[2] = OpCodes.Xor32(OpCodes.Or32(OpCodes.Shr32(crc[2], 8), OpCodes.Shl32(OpCodes.And32(crc[1], 0xFF), 24)), this.crcTable128[entry + 2]);
        crc[1] = OpCodes.Xor32(OpCodes.Or32(OpCodes.Shr32(crc[1], 8), OpCodes.Shl32(OpCodes.And32(crc[0], 0xFF), 24)), this.crcTable128[entry + 1]);
        crc[0] = OpCodes.Xor32(OpCodes.Shr32(crc[0], 8), this.crcTable128[entry + 0]);
      } else {
        // Normal algorithm (MSB first)
        /** @type {int32} */
        const entry = OpCodes.And32(OpCodes.Xor32(OpCodes.Shr32(crc[0], 24), byte), 0xFF) * 4;

        crc[0] = OpCodes.Xor32(OpCodes.Or32(OpCodes.Shl32(crc[0], 8), OpCodes.And32(OpCodes.Shr32(crc[1], 24), 0xFF)), this.crcTable128[entry + 0]);
        crc[1] = OpCodes.Xor32(OpCodes.Or32(OpCodes.Shl32(crc[1], 8), OpCodes.And32(OpCodes.Shr32(crc[2], 24), 0xFF)), this.crcTable128[entry + 1]);
        crc[2] = OpCodes.Xor32(OpCodes.Or32(OpCodes.Shl32(crc[2], 8), OpCodes.And32(OpCodes.Shr32(crc[3], 24), 0xFF)), this.crcTable128[entry + 2]);
        crc[3] = OpCodes.Xor32(OpCodes.Shl32(crc[3], 8), this.crcTable128[entry + 3]);
      }
    }

    /**
     * Finish a CRC of at most 32 bits
     * @returns {uint8[]} CRC value, big-endian, bitWidth / 8 bytes
     */
    _result32() {
      const bitWidth = this.bitWidth;
      let finalCrc = this.crc;

      // Result reflection. Running the reflected table already leaves the
      // register in reflected form, so a further reflection is only needed when
      // inputReflected and resultReflected disagree. This rule is uniform over
      // every width.
      if (this.inputReflected !== this.resultReflected) {
        if (bitWidth === 8) {
          finalCrc = this._reflect8(finalCrc);
        } else if (bitWidth === 16) {
          finalCrc = this._reflect16(finalCrc);
        } else if (bitWidth === 24) {
          finalCrc = this._reflect24(finalCrc);
        } else if (bitWidth === 32) {
          finalCrc = this._reflect32(finalCrc);
        }
      }

      // Apply final XOR
      finalCrc = OpCodes.Xor32(finalCrc, this.finalXor);

      // Convert to byte array (big-endian): the last bitWidth / 8 bytes of the word
      const bytes = OpCodes.Unpack32BE(finalCrc);
      return bytes.slice(4 - bitWidth / 8);
    }

    /**
     * Finish a 64-bit CRC
     * @returns {uint8[]} CRC value, big-endian, 8 bytes
     */
    _result64() {
      let finalCrcHigh = this.crcHigh;
      let finalCrcLow = this.crcLow;

      // Same rule as the narrower widths: the reflected table leaves the
      // register reflected already, so reflect again only on disagreement.
      // Reflecting 64 bits swaps the words and reflects each.
      if (this.inputReflected !== this.resultReflected) {
        const oldHigh = finalCrcHigh;
        finalCrcHigh = this._reflect32(finalCrcLow);
        finalCrcLow = this._reflect32(oldHigh);
      }

      // Apply final XOR after reflection
      finalCrcHigh = OpCodes.Xor32(finalCrcHigh, this.finalXorHigh);
      finalCrcLow = OpCodes.Xor32(finalCrcLow, this.finalXorLow);

      // Return CRC as 8-byte array (big-endian)
      return OpCodes.Unpack32BE(finalCrcHigh).concat(OpCodes.Unpack32BE(finalCrcLow));
    }

    /**
     * Finish a 128-bit CRC
     * @returns {uint8[]} CRC value, big-endian, 16 bytes
     */
    _result128() {
      /** @type {uint32[]} */
      const finalCrc = [];
      for (let i = 0; i < 4; ++i) {
        finalCrc.push(OpCodes.Xor32(this.crc128[i], this.finalXor128[i]));
      }

      // Return CRC as 16-byte array (big-endian)
      return OpCodes.Words32ToBytesBE(finalCrc);
    }

    /**
     * Load the initial register value
     * @returns {void}
     */
    _reset() {
      if (this.bitWidth <= 32) {
        this.crc = this.initialValue;
      } else if (this.bitWidth === 64) {
        this.crcHigh = this.initialValueHigh;
        this.crcLow = this.initialValueLow;
      } else if (this.bitWidth === 128) {
        this.crc128 = this.initialValue128.slice();
      }
    }

    /**
     * Reflect the polynomial over the register width (widths up to 32)
     * @returns {uint32} Reflected polynomial
     */
    _reflectedPolynomial32() {
      if (this.bitWidth === 8) return this._reflect8(this.polynomial);
      if (this.bitWidth === 16) return this._reflect16(this.polynomial);
      if (this.bitWidth === 24) return this._reflect24(this.polynomial);
      return this._reflect32(this.polynomial);
    }

    /**
     * Build the byte-indexed lookup table for widths up to 32
     * @returns {uint32[]} 256 table entries
     */
    _generateTable32() {
      /** @type {uint32[]} */
      const table = new Array(256);
      const bitWidth = this.bitWidth;
      /** @type {uint32} */
      const mask = bitWidth === 8 ? 0xFF : bitWidth === 16 ? 0xFFFF : bitWidth === 24 ? 0xFFFFFF : 0xFFFFFFFF;
      /** @type {uint32} */
      const msbBit = bitWidth === 8 ? 0x80 : bitWidth === 16 ? 0x8000 : bitWidth === 24 ? 0x800000 : 0x80000000;

      for (let i = 0; i < 256; i++) {
        /** @type {uint32} */
        let crc = 0;

        if (this.inputReflected) {
          // Generate reflected table
          const reflectedPoly = this._reflectedPolynomial32();

          crc = i;
          for (let j = 0; j < 8; j++) {
            if (OpCodes.And32(crc, 1) !== 0) {
              crc = OpCodes.Xor32(OpCodes.Shr32(crc, 1), reflectedPoly);
            } else {
              crc = OpCodes.Shr32(crc, 1);
            }
          }
        } else {
          // Generate normal table
          crc = bitWidth === 8 ? i : OpCodes.Shl32(i, bitWidth - 8);
          for (let j = 0; j < 8; j++) {
            if (OpCodes.And32(crc, msbBit) !== 0) {
              crc = OpCodes.Xor32(OpCodes.Shl32(crc, 1), this.polynomial);
            } else {
              crc = OpCodes.Shl32(crc, 1);
            }
          }
        }

        table[i] = OpCodes.And32(crc, mask);
      }

      return table;
    }

    /**
     * Build the byte-indexed lookup table for the 64-bit width into
     * crcTableHigh / crcTableLow
     * @returns {void}
     */
    _generateTable64() {
      /** @type {uint32[]} */
      const tableHigh = new Array(256);
      /** @type {uint32[]} */
      const tableLow = new Array(256);

      // For reflected CRCs, reflect the polynomial once
      let polyHigh = this.polynomialHigh;
      let polyLow = this.polynomialLow;
      if (this.inputReflected) {
        polyHigh = this._reflect32(this.polynomialLow);
        polyLow = this._reflect32(this.polynomialHigh);
      }

      for (let i = 0; i < 256; i++) {
        /** @type {uint32} */
        let crcHigh = 0;
        /** @type {uint32} */
        let crcLow = 0;

        if (this.inputReflected) {
          // Generate reflected table
          crcLow = i;
          crcHigh = 0;
          for (let j = 0; j < 8; j++) {
            const carry = OpCodes.And32(crcLow, 1);
            crcLow = OpCodes.Or32(OpCodes.Shr32(crcLow, 1), OpCodes.Shl32(OpCodes.And32(crcHigh, 1), 31));
            crcHigh = OpCodes.Shr32(crcHigh, 1);

            if (carry !== 0) {
              crcHigh = OpCodes.Xor32(crcHigh, polyHigh);
              crcLow = OpCodes.Xor32(crcLow, polyLow);
            }
          }
        } else {
          // Generate normal table
          crcHigh = OpCodes.Shl32(i, 24);
          crcLow = 0;
          for (let j = 0; j < 8; j++) {
            const carry = OpCodes.And32(crcHigh, 0x80000000);
            crcHigh = OpCodes.Or32(OpCodes.Shl32(crcHigh, 1), OpCodes.And32(OpCodes.Shr32(crcLow, 31), 1));
            crcLow = OpCodes.Shl32(crcLow, 1);

            if (carry !== 0) {
              crcHigh = OpCodes.Xor32(crcHigh, this.polynomialHigh);
              crcLow = OpCodes.Xor32(crcLow, this.polynomialLow);
            }
          }
        }

        tableHigh[i] = OpCodes.ToUint32(crcHigh);
        tableLow[i] = OpCodes.ToUint32(crcLow);
      }

      this.crcTableHigh = tableHigh;
      this.crcTableLow = tableLow;
    }

    /**
     * Build the byte-indexed lookup table for the 128-bit width
     * @returns {uint32[]} 256 entries of four words each, most significant word first
     */
    _generateTable128() {
      /** @type {uint32[]} */
      const table = new Array(1024);

      for (let i = 0; i < 256; i++) {
        /** @type {uint32[]} */
        const crc = [OpCodes.Shl32(i, 24), 0, 0, 0];

        // Process 8 bits
        for (let j = 0; j < 8; j++) {
          const carry = OpCodes.And32(crc[0], 0x80000000);

          // Shift left across all 128 bits
          crc[0] = OpCodes.Or32(OpCodes.Shl32(crc[0], 1), OpCodes.And32(OpCodes.Shr32(crc[1], 31), 1));
          crc[1] = OpCodes.Or32(OpCodes.Shl32(crc[1], 1), OpCodes.And32(OpCodes.Shr32(crc[2], 31), 1));
          crc[2] = OpCodes.Or32(OpCodes.Shl32(crc[2], 1), OpCodes.And32(OpCodes.Shr32(crc[3], 31), 1));
          crc[3] = OpCodes.ToUint32(OpCodes.Shl32(crc[3], 1));

          // XOR with polynomial if there was a carry
          if (carry !== 0) {
            crc[0] = OpCodes.Xor32(crc[0], this.polynomial128[0]);
            crc[1] = OpCodes.Xor32(crc[1], this.polynomial128[1]);
            crc[2] = OpCodes.Xor32(crc[2], this.polynomial128[2]);
            crc[3] = OpCodes.Xor32(crc[3], this.polynomial128[3]);
          }
        }

        for (let k = 0; k < 4; k++) {
          table[i * 4 + k] = crc[k];
        }
      }

      return table;
    }

    /**
     * Reverse the low 8 bits
     * @param {uint32} value - Value to reflect
     * @returns {uint32} Reflected value
     */
    _reflect8(value) {
      /** @type {uint32} */
      let reflected = 0;
      for (let i = 0; i < 8; i++) {
        reflected = OpCodes.Or32(OpCodes.Shl32(reflected, 1), OpCodes.And32(value, 1));
        value = OpCodes.Shr32(value, 1);
      }
      return reflected;
    }

    /**
     * Reverse the low 16 bits
     * @param {uint32} value - Value to reflect
     * @returns {uint32} Reflected value
     */
    _reflect16(value) {
      /** @type {uint32} */
      let reflected = 0;
      for (let i = 0; i < 16; i++) {
        reflected = OpCodes.Or32(OpCodes.Shl32(reflected, 1), OpCodes.And32(value, 1));
        value = OpCodes.Shr32(value, 1);
      }
      return reflected;
    }

    /**
     * Reverse the low 24 bits
     * @param {uint32} value - Value to reflect
     * @returns {uint32} Reflected value
     */
    _reflect24(value) {
      /** @type {uint32} */
      let reflected = 0;
      for (let i = 0; i < 24; i++) {
        reflected = OpCodes.Or32(OpCodes.Shl32(reflected, 1), OpCodes.And32(value, 1));
        value = OpCodes.Shr32(value, 1);
      }
      return reflected;
    }

    /**
     * Reverse all 32 bits
     * @param {uint32} value - Value to reflect
     * @returns {uint32} Reflected value
     */
    _reflect32(value) {
      /** @type {uint32} */
      let reflected = 0;
      for (let i = 0; i < 32; i++) {
        reflected = OpCodes.Or32(OpCodes.Shl32(reflected, 1), OpCodes.And32(value, 1));
        value = OpCodes.Shr32(value, 1);
      }
      return reflected;
    }
  }

  // ===== REGISTER ALL VARIANTS =====

  for (let i = 0; i < CRC_VARIANT_NAMES.length; ++i) {
    RegisterAlgorithm(new CRCAlgorithm(CRC_VARIANT_NAMES[i]));
  }

  // ===== EXPORTS =====

  return { CRCAlgorithm, CRCInstance, CRC_VARIANT_NAMES };
}));
