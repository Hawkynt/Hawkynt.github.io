/*
 * CRC16 Checksum Implementation with Multiple Variants
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * 16-bit Cyclic Redundancy Check algorithm with support for multiple
 * standard parameter configurations (polynomial, initial value, etc.)
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        Algorithm, IAlgorithmInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

// Base CRC16 algorithm class that accepts configuration parameters
class CRC16Algorithm extends Algorithm {
  constructor(variant = 'CCITT') {
    super();
    
    // Get configuration for this variant
    this.config = this._getVariantConfig(variant);
    
    // Required metadata
    this.name = `CRC-16-${variant}`;
    this.description = `${this.config.description} Uses polynomial ${this.config.polynomial.toString(16).toUpperCase().padStart(4, '0')}h with initial value ${this.config.initialValue.toString(16).toUpperCase().padStart(4, '0')}h.`;
    this.inventor = "W. Wesley Peterson";
    this.year = 1961;
    this.category = CategoryType.CHECKSUM;
    this.subCategory = "Cyclic Redundancy Check";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.BEGINNER;
    this.country = CountryCode.US;

    // Documentation and references
    this.documentation = [
      new LinkItem("CRC Theory", "https://en.wikipedia.org/wiki/Cyclic_redundancy_check"),
      new LinkItem("CRC16 Variants", "https://en.wikipedia.org/wiki/Cyclic_redundancy_check#CRC-16"),
      new LinkItem("CRC Catalogue", "https://reveng.sourceforge.io/crc-catalogue/")
    ];

    this.references = [
      new LinkItem("Peterson & Brown Paper", "https://dl.acm.org/doi/10.1145/321075.321076"),
      new LinkItem("ITU-T Recommendation", "https://www.itu.int/rec/T-REC-V.41"),
      new LinkItem("CRC Parameter Database", "https://reveng.sourceforge.io/crc-catalogue/")
    ];

    // Test vectors specific to this variant
    this.tests = this.config.tests;
  }

  _getVariantConfig(variant) {
    const configs = {
      'CCITT': {
        description: '16-bit CRC used in CCITT/ITU-T standards, telecommunications, and X.25 protocol',
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
      'IBM': {
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
      'ANSI': {
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
      'XMODEM': {
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
      }
    };
    
    return configs[variant] || configs['CCITT'];
  }

  CreateInstance(isInverse = false) {
    if (isInverse) {
      return null; // Checksums do not support inverse operations
    }
    return new CRC16Instance(this, this.config);
  }
}

class CRC16Instance extends IAlgorithmInstance {
  constructor(algorithm, config) {
    super(algorithm);
    this.config = config;
    this.crc = config.initialValue;
    
    // Pre-computed lookup table for this configuration
    this.crcTable = this._generateTable();
  }

  Feed(data) {
    if (!data || data.length === 0) return;
    
    // Process each byte
    for (let i = 0; i < data.length; ++i) {
      this.crc = this._updateCRC(this.crc, data[i]);
    }
  }

  Result() {
    // Apply final XOR if specified
    let finalCrc = this.crc ^ this.config.finalXor;
    
    // Apply result reflection if specified
    if (this.config.resultReflected) {
      finalCrc = this._reflect16(finalCrc);
    }
    
    // Return CRC as 2-byte array (big-endian)
    const result = [
      (finalCrc >> 8) & 0xFF,  // High byte
      finalCrc & 0xFF          // Low byte
    ];
    
    // Reset for next calculation
    this.crc = this.config.initialValue;
    
    return result;
  }

  _updateCRC(crc, byte) {
    let inputByte = byte;
    
    // Apply input reflection if specified
    if (this.config.inputReflected) {
      inputByte = this._reflect8(inputByte);
    }
    
    if (this.config.inputReflected) {
      // Reflected algorithm (LSB first)
      const tblIdx = (crc ^ inputByte) & 0xFF;
      return ((crc >> 8) ^ this.crcTable[tblIdx]) & 0xFFFF;
    } else {
      // Normal algorithm (MSB first)
      const tblIdx = ((crc >> 8) ^ inputByte) & 0xFF;
      return ((crc << 8) ^ this.crcTable[tblIdx]) & 0xFFFF;
    }
  }

  _generateTable() {
    const table = new Array(256);
    
    for (let i = 0; i < 256; i++) {
      let crc;
      
      if (this.config.inputReflected) {
        // Generate reflected table
        crc = i;
        for (let j = 0; j < 8; j++) {
          if (crc & 1) {
            crc = (crc >> 1) ^ this._reflect16(this.config.polynomial);
          } else {
            crc = crc >> 1;
          }
        }
      } else {
        // Generate normal table
        crc = i << 8;
        for (let j = 0; j < 8; j++) {
          if (crc & 0x8000) {
            crc = (crc << 1) ^ this.config.polynomial;
          } else {
            crc = crc << 1;
          }
        }
      }
      
      table[i] = crc & 0xFFFF;
    }
    
    return table;
  }

  _reflect8(value) {
    let reflected = 0;
    for (let i = 0; i < 8; i++) {
      reflected = (reflected << 1) | (value & 1);
      value >>= 1;
    }
    return reflected;
  }

  _reflect16(value) {
    let reflected = 0;
    for (let i = 0; i < 16; i++) {
      reflected = (reflected << 1) | (value & 1);
      value >>= 1;
    }
    return reflected;
  }
}

// Register all CRC16 variants
RegisterAlgorithm(new CRC16Algorithm('CCITT'));
RegisterAlgorithm(new CRC16Algorithm('IBM'));
RegisterAlgorithm(new CRC16Algorithm('ANSI'));
RegisterAlgorithm(new CRC16Algorithm('XMODEM'));

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CRC16Algorithm, CRC16Instance };
}
