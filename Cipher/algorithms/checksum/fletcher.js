/*
 * Fletcher Checksum Implementation with Multiple Variants
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Fletcher checksum algorithm family providing better error detection than simple checksums.
 * Uses two running sums with different weights to detect errors.
 * Supports 8, 16, 32, and 64-bit variants for different applications.
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

// Base Fletcher algorithm class that accepts configuration parameters
class FletcherAlgorithm extends Algorithm {
  constructor(variant = '32') {
    super();
    
    // Get configuration for this variant
    this.config = this._getVariantConfig(variant);
    
    // Required metadata
    this.name = `Fletcher-${variant}`;
    this.description = `${this.config.description} Uses two ${this.config.sumBits}-bit running sums with modulo ${this.config.modulo} for enhanced error detection.`;
    this.inventor = "John G. Fletcher";
    this.year = 1982;
    this.category = CategoryType.CHECKSUM;
    this.subCategory = "Simple Checksum";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = this.config.complexity;
    this.country = CountryCode.US;

    // Documentation and references
    this.documentation = [
      new LinkItem("Wikipedia - Fletcher's checksum", "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"),
      new LinkItem("RFC 1146 - TCP Alternative Checksum Options", "https://tools.ietf.org/rfc/rfc1146.txt"),
      new LinkItem("Original Fletcher Paper", "https://ieeexplore.ieee.org/document/1094155")
    ];
    
    this.references = [
      new LinkItem("Linux Kernel Fletcher Implementation", "https://github.com/torvalds/linux/blob/master/lib/checksum.c"),
      new LinkItem("BSD Socket Implementation", "https://github.com/freebsd/freebsd-src/blob/main/sys/netinet/in_cksum.c"),
      new LinkItem("Fletcher Checksum Analysis", "https://www.zlib.net/tech_report_96.pdf")
    ];
    
    this.knownVulnerabilities = [
      new Vulnerability(
        "Not Cryptographically Secure", 
        "Use cryptographic hash functions (SHA-256, SHA-3) for security purposes"
      ),
      new Vulnerability(
        "Collision Vulnerability", 
        "Use for error detection only, not for data integrity in security contexts"
      )
    ];

    // Test vectors specific to this variant
    this.tests = this.config.tests;
  }

  _getVariantConfig(variant) {
    const configs = {
      '8': {
        description: 'Fletcher-8 checksum for small data integrity checking in embedded systems',
        sumBits: 4,
        modulo: 15,        // 2^4 - 1
        blockSize: 15,     // Safe block size to prevent overflow
        resultBytes: 1,
        complexity: ComplexityType.BEGINNER,
        tests: [
          new TestCase(
            [],
            OpCodes.Hex8ToBytes("00"),
            "Empty string",
            "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("a"),
            OpCodes.Hex8ToBytes("77"),
            "Single byte 'a'",
            "Educational test vector"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("abc"),
            OpCodes.Hex8ToBytes("19"),
            "String 'abc'",
            "Educational test vector"
          )
        ]
      },
      '16': {
        description: 'Fletcher-16 checksum used in network protocols and data transmission',
        sumBits: 8,
        modulo: 255,       // 2^8 - 1  
        blockSize: 255,    // Safe block size to prevent overflow
        resultBytes: 2,
        complexity: ComplexityType.BEGINNER,
        tests: [
          new TestCase(
            [],
            OpCodes.Hex8ToBytes("0000"),
            "Empty string",
            "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("a"),
            OpCodes.Hex8ToBytes("6161"),
            "Single byte 'a'", 
            "Educational test vector"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("abcde"),
            OpCodes.Hex8ToBytes("c8f0"),
            "String 'abcde'",
            "Educational test vector"
          )
        ]
      },
      '32': {
        description: 'Fletcher-32 checksum providing robust error detection for medium-sized data',
        sumBits: 16,
        modulo: 65535,     // 2^16 - 1
        blockSize: 359,    // Safe block size to prevent overflow  
        resultBytes: 4,
        complexity: ComplexityType.BEGINNER,
        tests: [
          new TestCase(
            [],
            OpCodes.Hex8ToBytes("00000000"),
            "Empty string",
            "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("a"),
            OpCodes.Hex8ToBytes("00610061"),
            "Single byte 'a'",
            "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("abcde"),
            OpCodes.Hex8ToBytes("05c301ef"),
            "String 'abcde'",
            "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("123456789"),
            OpCodes.Hex8ToBytes("091501dd"),
            "String '123456789'",
            "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"
          )
        ]
      },
      '64': {
        description: 'Fletcher-64 checksum for large datasets and high-performance applications',
        sumBits: 32,
        modulo: 4294967295, // 2^32 - 1
        blockSize: 65536,    // Safe block size to prevent overflow
        resultBytes: 8,
        complexity: ComplexityType.INTERMEDIATE,
        tests: [
          new TestCase(
            [],
            OpCodes.Hex8ToBytes("0000000000000000"),
            "Empty string",
            "Educational test vector"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("a"),
            OpCodes.Hex8ToBytes("0000006100000061"),
            "Single byte 'a'",
            "Educational test vector"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("large data integrity test"),
            OpCodes.Hex8ToBytes("00007acd000009a4"),
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
    return new FletcherInstance(this, this.config);
  }
}

class FletcherInstance extends IAlgorithmInstance {
  constructor(algorithm, config) {
    super(algorithm);
    this.config = config;
    this.sum1 = 0;
    this.sum2 = 0;
    this.blockIndex = 0;
  }

  Feed(data) {
    if (!Array.isArray(data)) {
      throw new Error('FletcherInstance.Feed: Input must be byte array');
    }

    // Process data in blocks to prevent overflow
    for (let i = 0; i < data.length; i++) {
      this.sum1 += data[i];
      this.sum2 += this.sum1;
      
      this.blockIndex++;
      
      // Reduce modulo periodically to prevent overflow
      if (this.blockIndex >= this.config.blockSize) {
        this.sum1 %= this.config.modulo;
        this.sum2 %= this.config.modulo;
        this.blockIndex = 0;
      }
    }
  }

  Result() {
    // Final modulo reduction
    this.sum1 %= this.config.modulo;
    this.sum2 %= this.config.modulo;
    
    let result;
    
    // Generate result based on variant bit width
    switch (this.config.resultBytes) {
      case 1: // Fletcher-8
        result = [(this.sum2 << 4) | this.sum1];
        break;
        
      case 2: // Fletcher-16
        const checksum16 = ((this.sum2 << 8) | this.sum1) >>> 0;
        result = [(checksum16 >>> 8) & 0xFF, checksum16 & 0xFF];
        break;
        
      case 4: // Fletcher-32  
        result = OpCodes.Unpack32BE(((this.sum2 << 16) | this.sum1) >>> 0);
        break;
        
      case 8: // Fletcher-64
        // Handle 64-bit result as two 32-bit parts
        const high = this.sum2 >>> 0;
        const low = this.sum1 >>> 0;
        result = [
          (high >>> 24) & 0xFF, (high >>> 16) & 0xFF, (high >>> 8) & 0xFF, high & 0xFF,
          (low >>> 24) & 0xFF, (low >>> 16) & 0xFF, (low >>> 8) & 0xFF, low & 0xFF
        ];
        break;
        
      default:
        throw new Error(`Unsupported Fletcher result size: ${this.config.resultBytes} bytes`);
    }
    
    // Reset for next calculation
    this.sum1 = 0;
    this.sum2 = 0;
    this.blockIndex = 0;
    
    return result;
  }
}

// Register all Fletcher variants
RegisterAlgorithm(new FletcherAlgorithm('8'));
RegisterAlgorithm(new FletcherAlgorithm('16'));
RegisterAlgorithm(new FletcherAlgorithm('32'));
RegisterAlgorithm(new FletcherAlgorithm('64'));

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FletcherAlgorithm, FletcherInstance };
}