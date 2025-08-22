/*
 * Internet Checksum Implementation (RFC 1071)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Internet checksum algorithm used in IPv4, TCP, UDP, and ICMP protocols.
 * Uses 16-bit one's complement arithmetic for network packet integrity.
 * Fundamental to understanding how the Internet works at the protocol level.
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

class InternetChecksumAlgorithm extends Algorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Internet-Checksum";
    this.description = "Internet checksum algorithm (RFC 1071) used in IPv4, TCP, UDP protocols. Uses 16-bit one's complement arithmetic for network packet header integrity verification.";
    this.inventor = "Internet Engineering Task Force (IETF)";
    this.year = 1988;
    this.category = CategoryType.CHECKSUM;
    this.subCategory = "Network Protocol Checksum";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;

    // Documentation and references
    this.documentation = [
      new LinkItem("RFC 1071 - Computing the Internet Checksum", "https://tools.ietf.org/rfc/rfc1071.txt"),
      new LinkItem("Internet Protocol Specification", "https://tools.ietf.org/rfc/rfc791.txt"),
      new LinkItem("TCP Specification", "https://tools.ietf.org/rfc/rfc793.txt")
    ];
    
    this.references = [
      new LinkItem("IPv4 Header Format", "https://en.wikipedia.org/wiki/IPv4#Header"),
      new LinkItem("TCP Header Format", "https://en.wikipedia.org/wiki/Transmission_Control_Protocol#TCP_segment_structure"),
      new LinkItem("UDP Header Format", "https://en.wikipedia.org/wiki/User_Datagram_Protocol#UDP_datagram_structure")
    ];
    
    this.knownVulnerabilities = [
      new Vulnerability(
        "Not Cryptographically Secure", 
        "Designed for error detection only, not security - can be easily forged"
      ),
      new Vulnerability(
        "Collision Prone", 
        "16-bit checksum provides limited collision resistance"
      ),
      new Vulnerability(
        "No Protection Against Reordering", 
        "Cannot detect packet reordering or replay attacks"
      )
    ];

    // Test vectors from RFC 1071 and networking examples
    this.tests = [
      new TestCase(
        [],
        OpCodes.Hex8ToBytes("ffff"),
        "Empty data",
        "RFC 1071 - empty data gives all 1s checksum"
      ),
      new TestCase(
        OpCodes.Hex8ToBytes("4500003044224000800600008c7053548c70545f"),
        OpCodes.Hex8ToBytes("f611"),
        "IPv4 header example",
        "RFC 1071 style IPv4 header checksum"
      ),
      new TestCase(
        OpCodes.Hex8ToBytes("0001000200030004"),
        OpCodes.Hex8ToBytes("fff5"),
        "Sequential bytes 1-4",
        "Educational test vector"
      ),
      new TestCase(
        OpCodes.Hex8ToBytes("45000020000040004006"),
        OpCodes.Hex8ToBytes("3ad9"),
        "Partial IPv4 header",
        "Educational test vector"
      )
    ];
  }

  CreateInstance(isInverse = false) {
    if (isInverse) {
      return null; // Checksums do not support inverse operations
    }
    return new InternetChecksumInstance(this);
  }
}

class InternetChecksumInstance extends IAlgorithmInstance {
  constructor(algorithm) {
    super(algorithm);
    this.sum = 0;
  }

  Feed(data) {
    if (!Array.isArray(data)) {
      throw new Error('InternetChecksumInstance.Feed: Input must be byte array');
    }

    // Internet checksum algorithm (RFC 1071):
    // 1. Adjacent octets are paired to form 16-bit integers
    // 2. Compute the 1's complement sum of these 16-bit integers
    // 3. Take the 1's complement of the result
    
    for (let i = 0; i < data.length; i += 2) {
      let word;
      if (i + 1 < data.length) {
        // Normal case: pair of bytes (big-endian)
        word = (data[i] << 8) | data[i + 1];
      } else {
        // Odd number of bytes: pad with zero
        word = data[i] << 8;
      }
      
      // Add to sum
      this.sum += word;
      
      // Handle carry (convert to 1's complement arithmetic)
      while (this.sum > 0xFFFF) {
        this.sum = (this.sum & 0xFFFF) + (this.sum >>> 16);
      }
    }
  }

  Result() {
    // Take 1's complement of the final sum
    const checksum = (~this.sum) & 0xFFFF;
    
    // Return as 2-byte array (big-endian)
    const result = [
      (checksum >>> 8) & 0xFF,
      checksum & 0xFF
    ];
    
    // Reset for next calculation
    this.sum = 0;
    
    return result;
  }
}

// Register the Internet Checksum algorithm
RegisterAlgorithm(new InternetChecksumAlgorithm());

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { InternetChecksumAlgorithm, InternetChecksumInstance };
}