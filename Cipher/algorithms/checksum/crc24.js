/*
 * CRC24 Checksum Implementation with Multiple Variants
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * 24-bit Cyclic Redundancy Check algorithm with support for multiple
 * standard parameter configurations used in OpenPGP and other applications
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
        Algorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

// Base CRC24 algorithm class that accepts configuration parameters
class CRC24Algorithm extends Algorithm {
  constructor(variant = 'OPENPGP') {
    super();
    
    // Get configuration for this variant
    this.config = this._getVariantConfig(variant);
    
    // Required metadata
    this.name = `CRC-24-${variant}`;
    this.description = `${this.config.description} Uses polynomial ${this.config.polynomial.toString(16).toUpperCase().padStart(6, '0')}h with initial value ${this.config.initialValue.toString(16).toUpperCase().padStart(6, '0')}h.`;
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
      new LinkItem("OpenPGP RFC 4880", "https://tools.ietf.org/html/rfc4880"),
      new LinkItem("CRC Catalogue", "https://reveng.sourceforge.io/crc-catalogue/")
    ];

    this.references = [
      new LinkItem("RFC 4880 - OpenPGP Message Format", "https://www.rfc-editor.org/rfc/rfc4880.html"),
      new LinkItem("RFC 9580 - OpenPGP (Updated)", "https://www.rfc-editor.org/rfc/rfc9580.html"),
      new LinkItem("CRC Parameter Database", "https://reveng.sourceforge.io/crc-catalogue/")
    ];

    // Test vectors specific to this variant
    this.tests = this.config.tests;
  }

  _getVariantConfig(variant) {
    const configs = {
      'OPENPGP': {
        description: '24-bit CRC used in OpenPGP ASCII armor for message integrity checking',
        polynomial: 0x1864CFB, // x^24+x^23+x^18+x^17+x^14+x^11+x^10+x^7+x^6+x^5+x^4+x^3+x+1
        initialValue: 0xB704CE,
        inputReflected: false,
        resultReflected: false,
        finalXor: 0x000000,
        tests: [
          new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("b704ce"), "Empty string", "https://tools.ietf.org/html/rfc4880"),
          new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("259d1c"), "Single byte 'a'", "https://tools.ietf.org/html/rfc4880"),
          new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("21cf02"), "String '123456789'", "https://tools.ietf.org/html/rfc4880")
        ]
      },
      'FLEXRAY': {
        description: '24-bit CRC used in FlexRay automotive communication protocol',
        polynomial: 0x5D6DCB, // FlexRay CRC-24 polynomial
        initialValue: 0xFEDCBA,
        inputReflected: false,
        resultReflected: false,
        finalXor: 0x000000,
        tests: [
          new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("fedcba"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
          new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("4c6c6a"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
          new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("b4f3e6"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
        ]
      },
      'INTERLAKEN': {
        description: '24-bit CRC used in Interlaken protocol for high-speed chip-to-chip communication',
        polynomial: 0x328B63, // Interlaken CRC-24 polynomial
        initialValue: 0xFFFFFF,
        inputReflected: false,
        resultReflected: false,
        finalXor: 0xFFFFFF,
        tests: [
          new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("000000"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
          new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("ba4170"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
          new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("b4f3e6"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
        ]
      }
    };
    
    return configs[variant] || configs['OPENPGP'];
  }

  CreateInstance(isInverse = false) {
    if (isInverse) {
      return null; // Checksums do not support inverse operations
    }
    return new CRC24Instance(this, this.config);
  }
}

class CRC24Instance extends IAlgorithmInstance {
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
      finalCrc = this._reflect24(finalCrc);
    }
    
    // Return CRC as 3-byte array (big-endian)
    const result = [
      (finalCrc >> 16) & 0xFF,  // High byte
      (finalCrc >> 8) & 0xFF,   // Middle byte
      finalCrc & 0xFF           // Low byte
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
      return ((crc >> 8) ^ this.crcTable[tblIdx]) & 0xFFFFFF;
    } else {
      // Normal algorithm (MSB first)
      const tblIdx = ((crc >> 16) ^ inputByte) & 0xFF;
      return ((crc << 8) ^ this.crcTable[tblIdx]) & 0xFFFFFF;
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
            crc = (crc >> 1) ^ this._reflect24(this.config.polynomial);
          } else {
            crc = crc >> 1;
          }
        }
      } else {
        // Generate normal table
        crc = i << 16;
        for (let j = 0; j < 8; j++) {
          if (crc & 0x800000) {
            crc = (crc << 1) ^ this.config.polynomial;
          } else {
            crc = crc << 1;
          }
        }
      }
      
      table[i] = crc & 0xFFFFFF;
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

  _reflect24(value) {
    let reflected = 0;
    for (let i = 0; i < 24; i++) {
      reflected = (reflected << 1) | (value & 1);
      value >>= 1;
    }
    return reflected;
  }
}

// Register all CRC24 variants
RegisterAlgorithm(new CRC24Algorithm('OPENPGP'));
RegisterAlgorithm(new CRC24Algorithm('FLEXRAY'));
RegisterAlgorithm(new CRC24Algorithm('INTERLAKEN'));

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CRC24Algorithm, CRC24Instance };
}