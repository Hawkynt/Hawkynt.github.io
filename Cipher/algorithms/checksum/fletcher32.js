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
        OpCodes.Hex8ToBytes("028002aa"),
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
        OpCodes.Hex8ToBytes("19de1a87"),
        "Fletcher-32 Numeric Test",
        "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"
      )
    ];
  }

  CreateInstance(isInverse = false) {
    return new Fletcher32Instance(this, isInverse);
  }
}

class Fletcher32Instance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.MODULO = 65535;
    this.BLOCK_SIZE = 359;
  }

  Feed(data) {
    if (!Array.isArray(data)) {
      throw new Error('Fletcher32Instance.Feed: Input must be byte array');
    }

    if (this.isInverse) {
      throw new Error('Fletcher32Instance.Feed: Fletcher-32 cannot be reversed (one-way function)');
    }

    return this.calculate(data);
  }

  Result() {
    // Fletcher-32 is calculated in Feed method
    throw new Error('Fletcher32Instance.Result: Use Feed() method to calculate Fletcher-32');
  }

  /**
   * Core Fletcher-32 checksum calculation
   * @param {Array} bytes - Byte array to checksum
   * @returns {Array} 32-bit checksum as 4-byte array
   */
  calculate(bytes) {
    let sum1 = 0;
    let sum2 = 0;
    
    // Process data in blocks to prevent overflow
    let index = 0;
    while (index < bytes.length) {
      const blockEnd = Math.min(index + this.BLOCK_SIZE, bytes.length);
      
      // Process one block
      for (let i = index; i < blockEnd; i++) {
        sum1 += bytes[i];
        sum2 += sum1;
      }
      
      // Reduce modulo 65535 to prevent overflow
      sum1 %= this.MODULO;
      sum2 %= this.MODULO;
      
      index = blockEnd;
    }
    
    // Combine the two 16-bit sums into a 32-bit checksum
    const checksum = (sum2 << 16) | sum1;
    
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