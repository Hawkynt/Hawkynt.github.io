/*
 * CRC-32 Implementation with Multiple Variants
 * Educational implementation of Cyclic Redundancy Check with support for
 * multiple standard parameter configurations
 * (c)2006-2025 Hawkynt
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
    root.CRC32 = factory(root.AlgorithmFramework, root.OpCodes);
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

  class CRC32Algorithm extends Algorithm {
    constructor(variant = 'IEEE') {
      super();

      // Get configuration for this variant
      this.config = this._getVariantConfig(variant);

      // Required metadata
      this.name = `CRC-32-${variant}`;
      this.description = `${this.config.description} Uses polynomial ${this.config.polynomial.toString(16).toUpperCase().padStart(8, '0')}h with initial value ${this.config.initialValue.toString(16).toUpperCase().padStart(8, '0')}h.`;
      this.inventor = "W. Wesley Peterson";
      this.year = 1961;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Cyclic Redundancy Check";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("IEEE 802.3 Standard", "https://standards.ieee.org/standard/802_3-2018.html"),
        new LinkItem("Wikipedia - CRC", "https://en.wikipedia.org/wiki/Cyclic_redundancy_check"),
        new LinkItem("RFC 3720 - Internet Small Computer Systems Interface (iSCSI)", "https://tools.ietf.org/html/rfc3720")
      ];

      this.references = [
        new LinkItem("NIST SP 800-107 - Cryptographic Algorithms and Key Sizes", "https://csrc.nist.gov/publications/detail/sp/800-107/rev-1/final"),
        new LinkItem("zlib CRC-32 Implementation", "https://github.com/madler/zlib/blob/master/crc32.c"),
        new LinkItem("PNG Specification CRC", "http://www.libpng.org/pub/png/spec/1.2/PNG-Structure.html")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        {
          type: "Not Cryptographically Secure",
          text: "CRC-32 is designed for error detection, not security. It can be easily manipulated by attackers who know the algorithm.",
          mitigation: "Use cryptographic hash functions (SHA-256, SHA-3) for security purposes. Use CRC only for error detection."
        },
        {
          type: "Hash Collisions",
          text: "CRC-32 has only 32-bit output space, making collisions relatively easy to find intentionally.",
          mitigation: "For security applications, use cryptographic hash functions with larger output sizes."
        }
      ];

      // Test vectors specific to this variant
      this.tests = this.config.tests;
    }

    _getVariantConfig(variant) {
      const configs = {
        'IEEE': {
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
        'POSIX': {
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
        'BZIP2': {
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
        }
      };

      return configs[variant] || configs['IEEE'];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      if (isInverse) {
        return null; // Checksums do not support inverse operations
      }
      return new CRC32Instance(this, this.config);
    }
  }

  class CRC32Instance extends IAlgorithmInstance {
    constructor(algorithm, config) {
      super(algorithm);
      this.config = config;
      this.table = this.generateTable();
      this.crc = config.initialValue;
    }

    generateTable() {
      const table = new Array(256);

      for (let i = 0; i < 256; i++) {
        let crc;

        if (this.config.inputReflected) {
          // Generate reflected table
          crc = i;
          for (let j = 0; j < 8; j++) {
            if (crc & 1) {
              crc = (crc >>> 1) ^ this._reflect32(this.config.polynomial);
            } else {
              crc = crc >>> 1;
            }
          }
        } else {
          // Generate normal table
          crc = i << 24;
          for (let j = 0; j < 8; j++) {
            if (crc & 0x80000000) {
              crc = (crc << 1) ^ this.config.polynomial;
            } else {
              crc = crc << 1;
            }
          }
        }

        table[i] = crc >>> 0; // Ensure unsigned 32-bit
      }

      return table;
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('CRC32Instance.Feed: Input must be byte array');
      }

      // Process each byte
      for (let i = 0; i < data.length; i++) {
        let byte = data[i] & 0xFF;

        if (this.config.inputReflected) {
          // Reflected algorithm (LSB first)
          const tableIndex = (this.crc ^ byte) & 0xFF;
          this.crc = ((this.crc >>> 8) ^ this.table[tableIndex]) >>> 0;
        } else {
          // Normal algorithm (MSB first)
          const tableIndex = ((this.crc >>> 24) ^ byte) & 0xFF;
          this.crc = ((this.crc << 8) ^ this.table[tableIndex]) >>> 0;
        }
      }
    }

    Result() {
      let finalCrc = this.crc;

      // Apply result reflection if specified and differs from input reflection
      // When both inputReflected and resultReflected are the same, no reflection is needed
      // When they differ, we need to reflect the output
      if (this.config.inputReflected !== this.config.resultReflected) {
        finalCrc = this._reflect32(finalCrc);
      }

      // Apply final XOR
      finalCrc = (finalCrc ^ this.config.finalXor) >>> 0;

      // Convert to byte array (big-endian)
      const result = OpCodes.Unpack32BE(finalCrc);

      // Reset for next calculation
      this.crc = this.config.initialValue;

      return result;
    }

    _reflect32(value) {
      let reflected = 0;
      for (let i = 0; i < 32; i++) {
        reflected = (reflected << 1) | (value & 1);
        value >>>= 1;
      }
      return reflected >>> 0;
    }

    // Additional utility methods
    calculateString(str) {
      const bytes = OpCodes.AnsiToBytes(str);
      this.Feed(bytes);
      return this.Result();
    }

    calculateHex(hexString) {
      const bytes = OpCodes.Hex8ToBytes(hexString);
      this.Feed(bytes);
      return this.Result();
    }

    verify(data, expectedCrc) {
      this.Feed(data);
      const calculatedCrc = this.Result();
      return OpCodes.SecureCompare(calculatedCrc, expectedCrc);
    }
  }

  // Register all CRC32 variants
  RegisterAlgorithm(new CRC32Algorithm('IEEE'));
  RegisterAlgorithm(new CRC32Algorithm('POSIX'));
  RegisterAlgorithm(new CRC32Algorithm('BZIP2'));

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CRC32Algorithm, CRC32Instance };
  }

  // ===== EXPORTS =====

  return { CRC32Algorithm, CRC32Instance };
}));