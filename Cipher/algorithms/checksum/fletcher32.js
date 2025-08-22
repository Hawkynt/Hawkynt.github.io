/*
 * Fletcher-32 Implementation
 * Educational implementation of Fletcher checksum algorithm
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
        Algorithm, IAlgorithmInstance, TestCase, LinkItem, Vulnerability } = AlgorithmFramework;

class Fletcher32Algorithm extends Algorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Fletcher-32";
    this.description = "Fletcher-32 checksum algorithm providing better error detection than simple checksums. Uses two running sums with different weights to detect errors. Educational implementation demonstrating checksum mathematics.";
    this.inventor = "John G. Fletcher";
    this.year = 1982;
    this.category = CategoryType.CHECKSUM;
    this.subCategory = "Simple Checksum";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.BEGINNER;
    this.country = CountryCode.US;

    // Documentation and references
    this.documentation = [
      new LinkItem("Wikipedia - Fletcher's checksum", "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"),
      new LinkItem("RFC 1146 - TCP Alternative Checksum Options", "https://tools.ietf.org/rfc/rfc1146.txt"),
      new LinkItem("Original Fletcher Paper", "https://ieeexplore.ieee.org/document/1094155")
    ];
    
    this.references = [
      new LinkItem("Linux Kernel Fletcher Implementation", "https://github.com/torvalds/linux/blob/master/lib/checksum.c"),
      new LinkItem("BSD Socket Implementation", "https://github.com/freebsd/freebsd-src/blob/main/sys/netinet/in_cksum.c")
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
    
    this.tests = [
      new TestCase(
        [],
        OpCodes.Hex8ToBytes("00000000"),
        "Fletcher-32 Empty Input Test",
        "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("abcde"),
        OpCodes.Hex8ToBytes("05c301ef"),
        "Fletcher-32 Simple String Test",
        "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("a"),
        OpCodes.Hex8ToBytes("00610061"),
        "Fletcher-32 Single Character Test",
        "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("123456789"),
        OpCodes.Hex8ToBytes("091501dd"),
        "Fletcher-32 Numeric Test",
        "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"
      )
    ];
  }

  CreateInstance(isInverse = false) {
    if (isInverse) {
      return null; // Checksums do not support inverse operations
    }
    return new Fletcher32Instance(this);
  }
}

class Fletcher32Instance extends IAlgorithmInstance {
  constructor(algorithm) {
    super(algorithm);
    this.MODULO = 65535;
    this.BLOCK_SIZE = 359;
    this.sum1 = 0;
    this.sum2 = 0;
    this.blockIndex = 0;
  }

  Feed(data) {
    if (!Array.isArray(data)) {
      throw new Error('Fletcher32Instance.Feed: Input must be byte array');
    }

    // Process data in blocks to prevent overflow
    for (let i = 0; i < data.length; i++) {
      this.sum1 += data[i];
      this.sum2 += this.sum1;
      
      this.blockIndex++;
      
      // Reduce modulo periodically to prevent overflow
      if (this.blockIndex >= this.BLOCK_SIZE) {
        this.sum1 %= this.MODULO;
        this.sum2 %= this.MODULO;
        this.blockIndex = 0;
      }
    }
  }

  Result() {
    // Final modulo reduction
    this.sum1 %= this.MODULO;
    this.sum2 %= this.MODULO;
    
    // Combine the two 16-bit sums into a 32-bit checksum
    const checksum = (this.sum2 << 16) | this.sum1;
    
    // Reset for next calculation
    this.sum1 = 0;
    this.sum2 = 0;
    this.blockIndex = 0;
    
    // Return as 4-byte array (big-endian)
    return OpCodes.Unpack32BE(checksum >>> 0);
  }

}

// Register the algorithm
RegisterAlgorithm(new Fletcher32Algorithm());

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Fletcher32Algorithm, Fletcher32Instance };
}