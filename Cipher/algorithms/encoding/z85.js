/*
 * Z85 (ZeroMQ Base85) Encoding Implementation
 * Educational implementation of ZeroMQ's Z85 encoding
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
        EncodingAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

class Z85Algorithm extends EncodingAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Z85 (ZeroMQ Base85)";
    this.description = "Variant of Base85 encoding developed for ZeroMQ that provides more efficient binary-to-text encoding than Base64. Uses 85 printable ASCII characters and avoids problematic characters like quotes and backslashes. Educational implementation following ZeroMQ RFC 32.";
    this.inventor = "ZeroMQ Community";
    this.year = 2013;
    this.category = CategoryType.ENCODING;
    this.subCategory = "Base Encoding";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.INTL;

    // Documentation and references
    this.documentation = [
      new LinkItem("ZeroMQ RFC 32: Z85 Encoding", "https://rfc.zeromq.org/spec/32/"),
      new LinkItem("Z85 Specification", "https://github.com/zeromq/rfc/blob/master/src/spec_32.c"),
      new LinkItem("Base85 Encoding Wikipedia", "https://en.wikipedia.org/wiki/Ascii85")
    ];

    this.references = [
      new LinkItem("ZeroMQ Protocol Documentation", "https://zeromq.org/"),
      new LinkItem("Base85 vs Base64 Comparison", "https://tools.ietf.org/html/rfc1924"),
      new LinkItem("Binary Encoding Standards", "https://www.iana.org/assignments/character-sets/character-sets.xhtml")
    ];

    this.knownVulnerabilities = [];

    // Test vectors from Z85 specification
    this.tests = [
      new TestCase(
        [],
        [],
        "Z85 empty data test",
        "https://rfc.zeromq.org/spec/32/"
      ),
      new TestCase(
        [0x00, 0x00, 0x00, 0x01], // Simple 4-byte test
        OpCodes.AnsiToBytes("00001"), // Should encode to 00001
        "Basic 4-byte encoding test - Z85",
        "ZeroMQ RFC 32"
      )
    ];

    // Z85 alphabet (85 characters)
    this.alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#";
    
    this.decodeTable = null;
  }

  CreateInstance(isInverse = false) {
    return new Z85Instance(this, isInverse);
  }

  init() {
    // Build decode lookup table
    this.decodeTable = {};
    for (let i = 0; i < this.alphabet.length; i++) {
      this.decodeTable[this.alphabet[i]] = i;
    }
  }
}

class Z85Instance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.processedData = null;
    
    this.algorithm.init();
  }

  Feed(data) {
    if (!Array.isArray(data)) {
      throw new Error('Z85Instance.Feed: Input must be byte array');
    }

    if (this.isInverse) {
      this.processedData = this.decode(data);
    } else {
      this.processedData = this.encode(data);
    }
  }

  Result() {
    if (this.processedData === null) {
      throw new Error('Z85Instance.Result: No data processed. Call Feed() first.');
    }
    return this.processedData;
  }

  encode(data) {
    if (data.length === 0) {
      return [];
    }

    // Z85 requires input length to be multiple of 4 bytes
    if (data.length % 4 !== 0) {
      // Pad with zeros for educational purposes
      const padded = [...data];
      while (padded.length % 4 !== 0) {
        padded.push(0);
      }
      data = padded;
    }

    const result = [];
    
    for (let i = 0; i < data.length; i += 4) {
      // Pack 4 bytes into 32-bit value (big-endian)
      const value = (data[i] << 24) | 
                   (data[i + 1] << 16) | 
                   (data[i + 2] << 8) | 
                   data[i + 3];
      
      // Convert to 5 base-85 characters
      let temp = value;
      const chars = [];
      for (let j = 0; j < 5; j++) {
        chars.unshift(this.algorithm.alphabet[temp % 85]);
        temp = Math.floor(temp / 85);
      }
      
      result.push(...chars.map(c => c.charCodeAt(0)));
    }
    
    return result;
  }

  decode(data) {
    if (data.length === 0) {
      return [];
    }

    const encoded = String.fromCharCode(...data);
    
    // Z85 requires input length to be multiple of 5 characters
    if (encoded.length % 5 !== 0) {
      throw new Error('Z85: Invalid encoded length (must be multiple of 5)');
    }

    const result = [];
    
    for (let i = 0; i < encoded.length; i += 5) {
      // Convert 5 characters to 32-bit value
      let value = 0;
      for (let j = 0; j < 5; j++) {
        const char = encoded[i + j];
        const charValue = this.algorithm.decodeTable[char];
        if (charValue === undefined) {
          throw new Error(`Z85: Invalid character '${char}' in encoded data`);
        }
        value = value * 85 + charValue;
      }
      
      // Unpack 32-bit value to 4 bytes (big-endian)
      result.push((value >>> 24) & 0xFF);
      result.push((value >>> 16) & 0xFF);
      result.push((value >>> 8) & 0xFF);
      result.push(value & 0xFF);
    }
    
    return result;
  }
}

// Register the algorithm
RegisterAlgorithm(new Z85Algorithm());

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Z85Algorithm, Z85Instance };
}