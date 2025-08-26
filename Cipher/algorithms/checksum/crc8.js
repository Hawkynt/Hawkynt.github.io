/*
 * CRC8 Checksum Implementation with Multiple Variants
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * 8-bit Cyclic Redundancy Check algorithm with support for multiple
 * standard parameter configurations used in embedded systems and protocols
 */

// Load AlgorithmFramework (REQUIRED)

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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class CRC8Algorithm extends Algorithm {
    constructor(variant = 'SMBUS') {
      super();

      // Get configuration for this variant
      this.config = this._getVariantConfig(variant);

      // Required metadata
      this.name = `CRC-8-${variant}`;
      this.description = `${this.config.description} Uses polynomial ${this.config.polynomial.toString(16).toUpperCase().padStart(2, '0')}h with initial value ${this.config.initialValue.toString(16).toUpperCase().padStart(2, '0')}h.`;
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
        new LinkItem("CRC8 Applications", "https://users.ece.cmu.edu/~koopman/crc/"),
        new LinkItem("CRC Catalogue", "https://reveng.sourceforge.io/crc-catalogue/")
      ];

      this.references = [
        new LinkItem("Peterson & Brown Paper", "https://dl.acm.org/doi/10.1145/321075.321076"),
        new LinkItem("SMBus Specification", "https://www.smbus.org/faq/crc8Applet.htm"),
        new LinkItem("CRC Parameter Database", "https://reveng.sourceforge.io/crc-catalogue/")
      ];

      // Test vectors specific to this variant
      this.tests = this.config.tests;
    }

    _getVariantConfig(variant) {
      const configs = {
        'SMBUS': {
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
        'MAXIM': {
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
        'AUTOSAR': {
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
        'CDMA2000': {
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
        }
      };

      return configs[variant] || configs['SMBUS'];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // Checksums do not support inverse operations
      }
      return new CRC8Instance(this, this.config);
    }
  }

  class CRC8Instance extends IAlgorithmInstance {
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
        finalCrc = this._reflect8(finalCrc);
      }

      // Return CRC as 1-byte array
      const result = [finalCrc & 0xFF];

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
        return this.crcTable[tblIdx] & 0xFF;
      } else {
        // Normal algorithm (MSB first)
        const tblIdx = (crc ^ inputByte) & 0xFF;
        return this.crcTable[tblIdx] & 0xFF;
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
              crc = (crc >> 1) ^ this._reflect8(this.config.polynomial);
            } else {
              crc = crc >> 1;
            }
          }
        } else {
          // Generate normal table
          crc = i;
          for (let j = 0; j < 8; j++) {
            if (crc & 0x80) {
              crc = (crc << 1) ^ this.config.polynomial;
            } else {
              crc = crc << 1;
            }
          }
        }

        table[i] = crc & 0xFF;
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
  }

  // Register all CRC8 variants
  RegisterAlgorithm(new CRC8Algorithm('SMBUS'));
  RegisterAlgorithm(new CRC8Algorithm('MAXIM'));
  RegisterAlgorithm(new CRC8Algorithm('AUTOSAR'));
  RegisterAlgorithm(new CRC8Algorithm('CDMA2000'));

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CRC8Algorithm, CRC8Instance };
  }

  // ===== REGISTRATION =====

    const algorithmInstance = new CRC8Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { CRC8Algorithm, CRC8Instance };
}));