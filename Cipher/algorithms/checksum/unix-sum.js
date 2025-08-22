/*
 * Unix Sum Checksum Implementation with Multiple Variants
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Classic Unix sum(1) command checksum algorithms.
 * BSD variant uses circular rotation for order-dependency.
 * SYSV variant uses simple summation with overflow handling.
 * Legacy algorithms still used for compatibility and educational purposes.
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

// Base Unix Sum algorithm class that accepts configuration parameters
class UnixSumAlgorithm extends Algorithm {
  constructor(variant = 'BSD') {
    super();
    
    // Get configuration for this variant
    this.config = this._getVariantConfig(variant);
    
    // Required metadata
    this.name = `Unix-Sum-${variant}`;
    this.description = `${this.config.description} Classic Unix sum(1) algorithm for basic file integrity verification.`;
    this.inventor = "Bell Labs";
    this.year = 1971;
    this.category = CategoryType.CHECKSUM;
    this.subCategory = "Legacy Checksum";
    this.securityStatus = SecurityStatus.INSECURE;
    this.complexity = ComplexityType.BEGINNER;
    this.country = CountryCode.US;

    // Documentation and references
    this.documentation = [
      new LinkItem("Unix sum(1) manual", "https://man7.org/linux/man-pages/man1/sum.1.html"),
      new LinkItem("BSD Checksum Algorithm", "https://en.wikipedia.org/wiki/BSD_checksum"),
      new LinkItem("SYSV Checksum Algorithm", "https://en.wikipedia.org/wiki/SYSV_checksum")
    ];
    
    this.references = [
      new LinkItem("Unix History", "https://www.unix.org/what_is_unix/history_timeline.html"),
      new LinkItem("BSD vs SYSV Comparison", "https://www.unix.com/man-page/FreeBSD/1/sum/"),
      new LinkItem("Legacy Checksum Analysis", "https://www.openwall.com/lists/oss-security/")
    ];
    
    this.knownVulnerabilities = [
      new Vulnerability(
        "Cryptographically Insecure", 
        "Trivially broken - use for compatibility only, never for security"
      ),
      new Vulnerability(
        "Weak Error Detection", 
        "Poor error detection compared to CRC - many collisions possible"
      ),
      new Vulnerability(
        "Predictable Output", 
        "Output can be easily predicted and manipulated by attackers"
      )
    ];

    // Test vectors specific to this variant
    this.tests = this.config.tests;
  }

  _getVariantConfig(variant) {
    const configs = {
      'BSD': {
        description: 'BSD checksum with circular right rotation providing order-dependent error detection',
        useRotation: true,
        resultBytes: 2,
        tests: [
          new TestCase(
            [],
            OpCodes.Hex8ToBytes("0000"),
            "Empty string",
            "BSD sum(1) standard test"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("a"),
            OpCodes.Hex8ToBytes("0061"),
            "Single byte 'a'",
            "Educational test vector"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("abc"),
            OpCodes.Hex8ToBytes("40ac"),
            "String 'abc'",
            "Educational test vector"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
            OpCodes.Hex8ToBytes("c56e"),
            "Standard test phrase",
            "Educational test vector"
          )
        ]
      },
      'SYSV': {
        description: 'SYSV checksum using simple summation with order-independent calculation',
        useRotation: false,
        resultBytes: 2,
        tests: [
          new TestCase(
            [],
            OpCodes.Hex8ToBytes("0000"),
            "Empty string",
            "SYSV sum(1) standard test"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("a"),
            OpCodes.Hex8ToBytes("0061"),
            "Single byte 'a'",
            "Educational test vector"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("abc"),
            OpCodes.Hex8ToBytes("0126"),
            "String 'abc'",
            "Educational test vector"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
            OpCodes.Hex8ToBytes("0fd9"),
            "Standard test phrase",
            "Educational test vector"
          )
        ]
      }
    };
    
    return configs[variant] || configs['BSD'];
  }

  CreateInstance(isInverse = false) {
    if (isInverse) {
      return null; // Checksums do not support inverse operations
    }
    return new UnixSumInstance(this, this.config);
  }
}

class UnixSumInstance extends IAlgorithmInstance {
  constructor(algorithm, config) {
    super(algorithm);
    this.config = config;
    this.checksum = 0;
  }

  Feed(data) {
    if (!Array.isArray(data)) {
      throw new Error('UnixSumInstance.Feed: Input must be byte array');
    }

    // Process each byte according to the variant
    for (let i = 0; i < data.length; i++) {
      if (this.config.useRotation) {
        // BSD algorithm: circular right rotation
        this.checksum = ((this.checksum >>> 1) | ((this.checksum & 1) << 15)) + data[i];
        this.checksum = this.checksum & 0xFFFF; // Keep it 16-bit
      } else {
        // SYSV algorithm: simple addition with overflow
        this.checksum = (this.checksum + data[i]) & 0xFFFF;
      }
    }
  }

  Result() {
    // Return checksum as 2-byte array (big-endian)
    const result = [
      (this.checksum >>> 8) & 0xFF,
      this.checksum & 0xFF
    ];
    
    // Reset for next calculation
    this.checksum = 0;
    
    return result;
  }
}

// Register all Unix Sum variants
RegisterAlgorithm(new UnixSumAlgorithm('BSD'));
RegisterAlgorithm(new UnixSumAlgorithm('SYSV'));

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UnixSumAlgorithm, UnixSumInstance };
}