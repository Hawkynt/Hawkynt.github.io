/*
 * Adler Checksum Implementation with Multiple Variants
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Adler checksum algorithm family providing fast error detection for data integrity.
 * Similar to Fletcher but with different modular arithmetic optimized for speed.
 * Widely used in compression algorithms like zlib and gzip.
 * Supports 16, 32, and 64-bit variants for different applications.
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
        Algorithm, IAlgorithmInstance, TestCase, LinkItem, Vulnerability } = AlgorithmFramework;

// Base Adler algorithm class that accepts configuration parameters
class AdlerAlgorithm extends Algorithm {
  constructor(variant = '32') {
    super();
    
    // Get configuration for this variant
    this.config = this._getVariantConfig(variant);
    
    // Required metadata
    this.name = `Adler-${variant}`;
    this.description = `${this.config.description} Uses two ${this.config.sumBits}-bit running sums with modulo ${this.config.modulo} for fast error detection.`;
    this.inventor = "Mark Adler";
    this.year = 1995;
    this.category = CategoryType.CHECKSUM;
    this.subCategory = "Simple Checksum";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = this.config.complexity;
    this.country = CountryCode.US;

    // Documentation and references
    this.documentation = [
      new LinkItem("RFC 1950 - ZLIB Compressed Data Format", "https://tools.ietf.org/rfc/rfc1950.txt"),
      new LinkItem("Adler-32 Algorithm Description", "https://en.wikipedia.org/wiki/Adler-32"),
      new LinkItem("zlib Library Documentation", "https://zlib.net/manual.html")
    ];
    
    this.references = [
      new LinkItem("zlib Source Code", "https://github.com/madler/zlib"),
      new LinkItem("Adler-32 in Compression", "https://tools.ietf.org/rfc/rfc1951.txt"),
      new LinkItem("Performance Analysis", "https://create.stephan-brumme.com/crc32/")
    ];
    
    this.knownVulnerabilities = [
      new Vulnerability(
        "Not Cryptographically Secure", 
        "Use cryptographic hash functions (SHA-256, SHA-3) for security purposes"
      ),
      new Vulnerability(
        "Weak for Short Messages", 
        "Adler checksums can have poor distribution for very short inputs"
      ),
      new Vulnerability(
        "Zero Byte Weakness", 
        "Sequences of zero bytes can produce predictable patterns"
      )
    ];

    // Test vectors specific to this variant
    this.tests = this.config.tests;
  }

  _getVariantConfig(variant) {
    const configs = {
      '16': {
        description: 'Adler-16 checksum for lightweight error detection in embedded systems',
        sumBits: 8,
        modulo: 251,         // Largest prime less than 2^8
        base: 1,             // Starting value for sum1
        resultBytes: 2,
        complexity: ComplexityType.BEGINNER,
        tests: [
          new TestCase(
            [],
            [0x00, 0x01],
            "Empty string",
            "RFC 1950 style - empty gives base value"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("a"),
            [0x62, 0x62],
            "Single byte 'a'",
            "Educational test vector"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("abc"),
            [0x57, 0x2C],
            "String 'abc'",
            "Educational test vector"
          )
        ]
      },
      '32': {
        description: 'Adler-32 checksum used in zlib, gzip and other compression formats',
        sumBits: 16,
        modulo: 65521,       // Largest prime less than 2^16 (65536)
        base: 1,             // Starting value for sum1
        resultBytes: 4,
        complexity: ComplexityType.BEGINNER,
        tests: [
          new TestCase(
            [],
            [0x00, 0x00, 0x00, 0x01],
            "Empty string",
            "RFC 1950 - empty string gives 1"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("a"),
            [0x00, 0x62, 0x00, 0x62],
            "Single byte 'a'",
            "RFC 1950 test vector"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("abc"),
            [0x02, 0x4D, 0x01, 0x27],
            "String 'abc'",
            "RFC 1950 test vector"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("message digest"),
            [0x29, 0x75, 0x05, 0x86],
            "String 'message digest'",
            "Educational test vector"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("abcdefghijklmnopqrstuvwxyz"),
            [0x90, 0x86, 0x0B, 0x20],
            "Alphabet string",
            "Educational test vector"
          )
        ]
      },
      '64': {
        description: 'Adler-64 checksum for high-performance applications and large datasets',
        sumBits: 32,
        modulo: 4294967291,  // Largest prime less than 2^32
        base: 1,             // Starting value for sum1
        resultBytes: 8,
        complexity: ComplexityType.INTERMEDIATE,
        tests: [
          new TestCase(
            [],
            [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01],
            "Empty string",
            "Educational test vector"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("a"),
            [0x00, 0x00, 0x00, 0x62, 0x00, 0x00, 0x00, 0x62],
            "Single byte 'a'",
            "Educational test vector"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("large data integrity verification"),
            [0x00, 0x00, 0xD6, 0x56, 0x00, 0x00, 0x0C, 0xE8],
            "Large data sample",
            "Educational test vector"
          )
        ]
      }
    };
    
    return configs[variant] || configs['32'];
  }

  CreateInstance(isInverse = false) {
    if (isInverse) {
      return null; // Checksums do not support inverse operations
    }
    return new AdlerInstance(this, this.config);
  }
}

class AdlerInstance extends IAlgorithmInstance {
  constructor(algorithm, config) {
    super(algorithm);
    this.config = config;
    this.a = config.base;  // sum1 - starts at base value (usually 1)
    this.b = 0;            // sum2 - starts at 0
  }

  Feed(data) {
    if (!Array.isArray(data)) {
      throw new Error('AdlerInstance.Feed: Input must be byte array');
    }

    // Adler checksum algorithm:
    // a = 1 + D1 + D2 + ... + Dn (mod 65521)
    // b = (1 + D1) + (1 + D1 + D2) + ... + (1 + D1 + D2 + ... + Dn) (mod 65521)
    // where D1, D2, ..., Dn are the data bytes
    
    for (let i = 0; i < data.length; i++) {
      this.a = (this.a + data[i]) % this.config.modulo;
      this.b = (this.b + this.a) % this.config.modulo;
    }
  }

  Result() {
    let result;
    
    // Generate result based on variant bit width
    switch (this.config.resultBytes) {
      case 2: // Adler-16
        const checksum16 = ((this.b << 8) | this.a) >>> 0;
        result = OpCodes.Unpack16BE(checksum16);
        break;
        
      case 4: // Adler-32  
        result = OpCodes.Unpack32BE(((this.b << 16) | this.a) >>> 0);
        break;
        
      case 8: // Adler-64
        // Handle 64-bit result as two 32-bit parts
        const high = this.b >>> 0;
        const low = this.a >>> 0;
        result = [...OpCodes.Unpack32BE(high), ...OpCodes.Unpack32BE(low)];
        break;
        
      default:
        throw new Error(`Unsupported Adler result size: ${this.config.resultBytes} bytes`);
    }
    
    // Reset for next calculation
    this.a = this.config.base;
    this.b = 0;
    
    return result;
  }
}

// Register all Adler variants
RegisterAlgorithm(new AdlerAlgorithm('16'));
RegisterAlgorithm(new AdlerAlgorithm('32'));
RegisterAlgorithm(new AdlerAlgorithm('64'));

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AdlerAlgorithm, AdlerInstance };
}