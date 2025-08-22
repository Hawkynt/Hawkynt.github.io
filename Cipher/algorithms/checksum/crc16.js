/*
 * CRC16 Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * 16-bit Cyclic Redundancy Check algorithm
 * Standard polynomial: 0x1021 (CRC-16-CCITT)
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

class CRC16Algorithm extends Algorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "CRC16";
    this.description = "16-bit Cyclic Redundancy Check algorithm using polynomial 0x1021. Commonly used for error detection in telecommunications and data storage. Fast and simple integrity verification.";
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
      new LinkItem("CRC16-CCITT", "https://en.wikipedia.org/wiki/Cyclic_redundancy_check#CRC-16"),
      new LinkItem("Error Detection Codes", "https://web.archive.org/web/20180820004844/http://www.cs.jhu.edu/~scheideler/courses/600.344_S02/CRC.html")
    ];

    this.references = [
      new LinkItem("Peterson & Brown Paper", "https://dl.acm.org/doi/10.1145/321075.321076"),
      new LinkItem("ITU-T Recommendation", "https://www.itu.int/rec/T-REC-V.41"),
      new LinkItem("CRC Catalogue", "http://reveng.sourceforge.net/crc-catalogue/")
    ];

    // Test vectors
    this.tests = [
      new TestCase(
        OpCodes.AnsiToBytes(""),
        OpCodes.Hex8ToBytes("0000"),
        "Empty string CRC16-CCITT",
        "http://reveng.sourceforge.net/crc-catalogue/"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("A"),
        OpCodes.Hex8ToBytes("b915"),
        "Single byte 'A' CRC16-CCITT",
        "http://reveng.sourceforge.net/crc-catalogue/"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("123456789"),
        OpCodes.Hex8ToBytes("29b1"),
        "String '123456789' CRC16-CCITT",
        "http://reveng.sourceforge.net/crc-catalogue/"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("Hello World"),
        OpCodes.Hex8ToBytes("8b13"),
        "String 'Hello World' CRC16-CCITT",
        "http://reveng.sourceforge.net/crc-catalogue/"
      )
    ];
  }

  CreateInstance(isInverse = false) {
    if (isInverse) {
      return null; // Checksums do not support inverse operations
    }
    return new CRC16Instance(this);
  }
}

class CRC16Instance extends IAlgorithmInstance {
  constructor(algorithm) {
    super(algorithm);
    this.crc = 0x0000; // Initial value
    
    // Pre-computed CRC16-CCITT lookup table (polynomial 0x1021)
    this.crcTable = this._generateTable();
  }

  Feed(data) {
    if (!data || data.length === 0) return;
    
    // Process each byte
    for (let i = 0; i < data.length; ++i)
      this.crc = this._updateCRC(this.crc, data[i]);
  }

  Result() {
    // Return CRC as 2-byte array (big-endian)
    const result = [
      (this.crc >> 8) & 0xFF,  // High byte
      this.crc & 0xFF          // Low byte
    ];
    
    // Reset for next calculation
    this.crc = 0x0000;
    
    return result;
  }

  _updateCRC(crc, byte) {
    // CRC16-CCITT algorithm using lookup table
    const tblIdx = ((crc >> 8) ^ byte) & 0xFF;
    return ((crc << 8) ^ this.crcTable[tblIdx]) & 0xFFFF;
  }

  _generateTable() {
    const table = new Array(256);
    const polynomial = 0x1021; // CRC16-CCITT polynomial
    
    for (let i = 0; i < 256; i++) {
      let crc = i << 8;
      
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) {
          crc = (crc << 1) ^ polynomial;
        } else {
          crc = crc << 1;
        }
      }
      
      table[i] = crc & 0xFFFF;
    }
    
    return table;
  }
}

// Register the algorithm
RegisterAlgorithm(new CRC16Algorithm());

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CRC16Algorithm, CRC16Instance };
}
