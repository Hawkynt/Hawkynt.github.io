/*
 * CRC64 Checksum Implementation with Multiple Variants
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * 64-bit Cyclic Redundancy Check algorithm with support for multiple
 * standard parameter configurations used in compression and storage
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

// Base CRC64 algorithm class that accepts configuration parameters
class CRC64Algorithm extends Algorithm {
  constructor(variant = 'XZ') {
    super();
    
    // Get configuration for this variant
    this.config = this._getVariantConfig(variant);
    
    // Required metadata
    this.name = `CRC-64-${variant}`;
    this.description = `${this.config.description} Uses 64-bit polynomial with ${this.config.inputReflected ? 'reflected' : 'normal'} input processing.`;
    this.inventor = "W. Wesley Peterson";
    this.year = 1961;
    this.category = CategoryType.CHECKSUM;
    this.subCategory = "Cyclic Redundancy Check";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;

    // Documentation and references
    this.documentation = [
      new LinkItem("CRC Theory", "https://en.wikipedia.org/wiki/Cyclic_redundancy_check"),
      new LinkItem("CRC64 Applications", "https://users.ece.cmu.edu/~koopman/crc/"),
      new LinkItem("XZ Format Specification", "https://tukaani.org/xz/xz-file-format.txt")
    ];

    this.references = [
      new LinkItem("Peterson & Brown Paper", "https://dl.acm.org/doi/10.1145/321075.321076"),
      new LinkItem("ECMA-182 Standard", "https://www.ecma-international.org/publications/standards/Ecma-182.htm"),
      new LinkItem("CRC Parameter Database", "https://reveng.sourceforge.io/crc-catalogue/")
    ];

    // Test vectors specific to this variant
    this.tests = this.config.tests;
  }

  _getVariantConfig(variant) {
    const configs = {
      'XZ': {
        description: 'CRC-64 used in XZ compression format and file integrity verification',
        // Polynomial: 0x42f0e1eba9ea3693
        polynomialHigh: 0x42f0e1eb,
        polynomialLow: 0xa9ea3693,
        initialValueHigh: 0xffffffff,
        initialValueLow: 0xffffffff,
        inputReflected: true,
        resultReflected: true,
        finalXorHigh: 0xffffffff,
        finalXorLow: 0xffffffff,
        tests: [
          new TestCase(OpCodes.AnsiToBytes(""), OpCodes.Hex8ToBytes("0000000000000000"), "Empty string", "https://reveng.sourceforge.io/crc-catalogue/"),
          new TestCase(OpCodes.AnsiToBytes("a"), OpCodes.Hex8ToBytes("4a819af217e73925"), "Single byte 'a'", "https://reveng.sourceforge.io/crc-catalogue/"),
          new TestCase(OpCodes.AnsiToBytes("123456789"), OpCodes.Hex8ToBytes("3acc808c53481abd"), "String '123456789'", "https://reveng.sourceforge.io/crc-catalogue/")
        ]
      },
      'ECMA182': {
        description: 'CRC-64 ECMA-182 standard used in DLT-1 tape cartridges',
        // Polynomial: 0x42f0e1eba9ea3693
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
      'WE': {
        description: 'CRC-64/WE variant used in some applications with different initialization',
        // Polynomial: 0x42f0e1eba9ea3693
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
      }
    };
    
    return configs[variant] || configs['XZ'];
  }

  CreateInstance(isInverse = false) {
    if (isInverse) {
      return null; // Checksums do not support inverse operations
    }
    return new CRC64Instance(this, this.config);
  }
}

class CRC64Instance extends IAlgorithmInstance {
  constructor(algorithm, config) {
    super(algorithm);
    this.config = config;
    this.crcHigh = config.initialValueHigh;
    this.crcLow = config.initialValueLow;
    
    // Pre-computed lookup table for this configuration
    this.crcTable = this._generateTable();
  }

  Feed(data) {
    if (!data || data.length === 0) return;
    
    // Process each byte
    for (let i = 0; i < data.length; ++i) {
      this._updateCRC(data[i]);
    }
  }

  Result() {
    // Apply final XOR if specified
    let finalCrcHigh = (this.crcHigh ^ this.config.finalXorHigh) >>> 0;
    let finalCrcLow = (this.crcLow ^ this.config.finalXorLow) >>> 0;
    
    // Apply result reflection if specified (complex for 64-bit)
    if (this.config.resultReflected) {
      const temp = this._reflect64(finalCrcHigh, finalCrcLow);
      finalCrcHigh = temp.high;
      finalCrcLow = temp.low;
    }
    
    // Return CRC as 8-byte array (big-endian)
    const result = [
      (finalCrcHigh >>> 24) & 0xFF,
      (finalCrcHigh >>> 16) & 0xFF,
      (finalCrcHigh >>> 8) & 0xFF,
      finalCrcHigh & 0xFF,
      (finalCrcLow >>> 24) & 0xFF,
      (finalCrcLow >>> 16) & 0xFF,
      (finalCrcLow >>> 8) & 0xFF,
      finalCrcLow & 0xFF
    ];
    
    // Reset for next calculation
    this.crcHigh = this.config.initialValueHigh;
    this.crcLow = this.config.initialValueLow;
    
    return result;
  }

  _updateCRC(byte) {
    let inputByte = byte;
    
    // Apply input reflection if specified
    if (this.config.inputReflected) {
      inputByte = this._reflect8(inputByte);
    }
    
    if (this.config.inputReflected) {
      // Reflected algorithm (LSB first) - simplified for 64-bit
      const tblIdx = (this.crcLow ^ inputByte) & 0xFF;
      const tableEntry = this.crcTable[tblIdx];
      
      this.crcLow = ((this.crcLow >>> 8) | ((this.crcHigh & 0xFF) << 24)) ^ tableEntry.low;
      this.crcHigh = (this.crcHigh >>> 8) ^ tableEntry.high;
    } else {
      // Normal algorithm (MSB first)
      const tblIdx = ((this.crcHigh >>> 24) ^ inputByte) & 0xFF;
      const tableEntry = this.crcTable[tblIdx];
      
      this.crcHigh = ((this.crcHigh << 8) | ((this.crcLow >>> 24) & 0xFF)) ^ tableEntry.high;
      this.crcLow = (this.crcLow << 8) ^ tableEntry.low;
      
      // Ensure 32-bit values
      this.crcHigh = this.crcHigh >>> 0;
      this.crcLow = this.crcLow >>> 0;
    }
  }

  _generateTable() {
    const table = new Array(256);
    
    for (let i = 0; i < 256; i++) {
      let crcHigh, crcLow;
      
      if (this.config.inputReflected) {
        // Generate reflected table (simplified)
        crcLow = i;
        crcHigh = 0;
        for (let j = 0; j < 8; j++) {
          const carry = crcLow & 1;
          crcLow = (crcLow >>> 1) | ((crcHigh & 1) << 31);
          crcHigh = crcHigh >>> 1;
          
          if (carry) {
            crcHigh ^= this.config.polynomialHigh;
            crcLow ^= this.config.polynomialLow;
          }
        }
      } else {
        // Generate normal table
        crcHigh = i << 24;
        crcLow = 0;
        for (let j = 0; j < 8; j++) {
          const carry = crcHigh & 0x80000000;
          crcHigh = ((crcHigh << 1) | ((crcLow >>> 31) & 1)) >>> 0;
          crcLow = (crcLow << 1) >>> 0;
          
          if (carry) {
            crcHigh ^= this.config.polynomialHigh;
            crcLow ^= this.config.polynomialLow;
          }
        }
      }
      
      table[i] = { high: crcHigh >>> 0, low: crcLow >>> 0 };
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

  _reflect64(high, low) {
    // Reflect 64-bit value by swapping and reflecting each 32-bit part
    const reflectedHigh = this._reflect32(low);
    const reflectedLow = this._reflect32(high);
    return { high: reflectedHigh, low: reflectedLow };
  }

  _reflect32(value) {
    let reflected = 0;
    for (let i = 0; i < 32; i++) {
      reflected = (reflected << 1) | (value & 1);
      value >>>= 1;
    }
    return reflected >>> 0;
  }
}

// Register all CRC64 variants
RegisterAlgorithm(new CRC64Algorithm('XZ'));
RegisterAlgorithm(new CRC64Algorithm('ECMA182'));
RegisterAlgorithm(new CRC64Algorithm('WE'));

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CRC64Algorithm, CRC64Instance };
}