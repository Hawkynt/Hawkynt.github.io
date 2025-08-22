/*
 * CRC-32 Implementation
 * Educational implementation of Cyclic Redundancy Check (IEEE 802.3 standard)
 * (c)2006-2025 Hawkynt
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

class CRC32Algorithm extends Algorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "CRC-32";
    this.description = "CRC-32 (IEEE 802.3) cyclic redundancy check algorithm for error detection in data transmission and storage. Uses polynomial 0xEDB88320 (reversed 0x04C11DB7). Educational implementation demonstrating polynomial mathematics in error detection.";
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

    // Test vectors
    this.tests = [
      new TestCase(
        OpCodes.AnsiToBytes(""),
        OpCodes.Hex8ToBytes("00000000"),
        "CRC-32 Empty String Test - IEEE 802.3 standard",
        "https://reveng.sourceforge.io/crc-catalogue/17plus.htm#crc.cat.crc-32-ieee-802.3"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("a"),
        OpCodes.Hex8ToBytes("e8b7be43"),
        "CRC-32 Single Character Test",
        "https://reveng.sourceforge.io/crc-catalogue/17plus.htm#crc.cat.crc-32-ieee-802.3"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("abc"),
        OpCodes.Hex8ToBytes("352441c2"),
        "CRC-32 ABC Test Vector",
        "https://reveng.sourceforge.io/crc-catalogue/17plus.htm#crc.cat.crc-32-ieee-802.3"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("message digest"),
        OpCodes.Hex8ToBytes("20159d7f"),
        "CRC-32 Message Digest Test",
        "https://reveng.sourceforge.io/crc-catalogue/17plus.htm#crc.cat.crc-32-ieee-802.3"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("abcdefghijklmnopqrstuvwxyz"),
        OpCodes.Hex8ToBytes("4c2750bd"),
        "CRC-32 Alphabet Test Vector",
        "https://reveng.sourceforge.io/crc-catalogue/17plus.htm#crc.cat.crc-32-ieee-802.3"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
        OpCodes.Hex8ToBytes("414fa339"),
        "CRC-32 Classic Pangram Test",
        "https://reveng.sourceforge.io/crc-catalogue/17plus.htm#crc.cat.crc-32-ieee-802.3"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("1234567890"),
        OpCodes.Hex8ToBytes("261daee5"),
        "CRC-32 Numeric Test Vector",
        "https://reveng.sourceforge.io/crc-catalogue/17plus.htm#crc.cat.crc-32-ieee-802.3"
      )
    ];
  }

  CreateInstance(isInverse = false) {
    if (isInverse) {
      return null; // Checksums do not support inverse operations
    }
    return new CRC32Instance(this);
  }
}

class CRC32Instance extends IAlgorithmInstance {
  constructor(algorithm) {
    super(algorithm);
    this.polynomial = 0xEDB88320; // IEEE 802.3 polynomial (reversed)
    this.table = this.generateTable();
    this.crc = 0xFFFFFFFF; // Initial value
  }

  generateTable() {
    const table = new Array(256);
    
    for (let i = 0; i < 256; i++) {
      let crc = i;
      for (let j = 0; j < 8; j++) {
        if (crc & 1) {
          crc = (crc >>> 1) ^ this.polynomial;
        } else {
          crc = crc >>> 1;
        }
      }
      table[i] = crc;
    }
    
    return table;
  }

  Feed(data) {
    if (!Array.isArray(data)) {
      throw new Error('CRC32Instance.Feed: Input must be byte array');
    }

    // Process each byte
    for (let i = 0; i < data.length; i++) {
      const byte = data[i] & 0xFF;
      const tableIndex = (this.crc ^ byte) & 0xFF;
      this.crc = (this.crc >>> 8) ^ this.table[tableIndex];
    }
  }

  Result() {
    // Final XOR and convert to byte array (big-endian)
    const finalCrc = this.crc ^ 0xFFFFFFFF;
    const result = OpCodes.Unpack32BE(finalCrc >>> 0);
    
    // Reset for next calculation
    this.crc = 0xFFFFFFFF;
    
    return result;
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

// Register the algorithm
RegisterAlgorithm(new CRC32Algorithm());

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CRC32Algorithm, CRC32Instance };
}