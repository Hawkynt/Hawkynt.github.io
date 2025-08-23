/*
 * XXencoding Implementation
 * Educational implementation of XXencoding (alternative to UUencoding)
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

class XXEncodeAlgorithm extends EncodingAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "XXencoding";
    this.description = "Binary-to-text encoding similar to UUencoding but uses a different character set designed to avoid problematic characters in some communication systems. Alternative encoding method for transmitting binary data over text-based protocols. Educational implementation for learning purposes.";
    this.inventor = "Unix Community";
    this.year = 1980;
    this.category = CategoryType.ENCODING;
    this.subCategory = "Mail Encoding";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.BEGINNER;
    this.country = CountryCode.US;

    // Documentation and references
    this.documentation = [
      new LinkItem("XXencode Specification", "https://en.wikipedia.org/wiki/Xxencoding"),
      new LinkItem("UUencoding Alternatives", "https://tools.ietf.org/html/rfc1341"),
      new LinkItem("Binary Encoding History", "https://www.unix.org/what_is_unix/history_timeline.html")
    ];

    this.references = [
      new LinkItem("Unix Mail Systems", "https://tools.ietf.org/html/rfc822"),
      new LinkItem("Text-based Binary Transfer", "https://www.ietf.org/rfc/rfc2045.txt"),
      new LinkItem("Character Set Standards", "https://www.ascii-code.com/")
    ];

    this.knownVulnerabilities = [];

    // Test vectors for XXencoding
    this.tests = [
      new TestCase(
        [],
        [],
        "XXencode empty data test",
        "Educational standard"
      ),
      new TestCase(
        [0, 0, 0], // Three zero bytes -> should encode to "++++", 4 chars
        [43, 43, 43, 43], // "++++", 
        "Basic 3-byte zero test - XXencode",
        "Educational example"
      ),
      new TestCase(
        [1, 2, 3], // Simple test bytes
        [43, 69, 54, 49], // "+E61"
        "Simple pattern encoding test - XXencode",
        "Educational standard"
      )
    ];

    // XXencode alphabet (64 characters) - different from UUencode
    this.alphabet = "+-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    
    this.decodeTable = null;
  }

  CreateInstance(isInverse = false) {
    return new XXEncodeInstance(this, isInverse);
  }

  init() {
    // Build decode lookup table
    this.decodeTable = {};
    for (let i = 0; i < this.alphabet.length; i++) {
      this.decodeTable[this.alphabet[i]] = i;
    }
  }
}

class XXEncodeInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.processedData = null;
    
    this.algorithm.init();
  }

  Feed(data) {
    if (!Array.isArray(data)) {
      throw new Error('XXEncodeInstance.Feed: Input must be byte array');
    }

    if (this.isInverse) {
      this.processedData = this.decode(data);
    } else {
      this.processedData = this.encode(data);
    }
  }

  Result() {
    if (this.processedData === null) {
      throw new Error('XXEncodeInstance.Result: No data processed. Call Feed() first.');
    }
    return this.processedData;
  }

  encode(data) {
    if (data.length === 0) {
      return [];
    }

    const result = [];
    
    // Process in groups of 3 bytes
    for (let i = 0; i < data.length; i += 3) {
      const byte1 = data[i];
      const byte2 = i + 1 < data.length ? data[i + 1] : 0;
      const byte3 = i + 2 < data.length ? data[i + 2] : 0;
      
      // Pack 3 bytes into 24-bit value
      const packed = (byte1 << 16) | (byte2 << 8) | byte3;
      
      // Convert to 4 base-64 characters
      const char4 = this.algorithm.alphabet[packed & 0x3F];
      const char3 = this.algorithm.alphabet[(packed >>> 6) & 0x3F];
      const char2 = this.algorithm.alphabet[(packed >>> 12) & 0x3F];
      const char1 = this.algorithm.alphabet[(packed >>> 18) & 0x3F];
      
      result.push(char1.charCodeAt(0));
      result.push(char2.charCodeAt(0));
      result.push(char3.charCodeAt(0));
      result.push(char4.charCodeAt(0));
    }
    
    return result;
  }

  decode(data) {
    if (data.length === 0) {
      return [];
    }

    const encoded = String.fromCharCode(...data);
    
    // XXencode requires input length to be multiple of 4 characters
    if (encoded.length % 4 !== 0) {
      throw new Error('XXencode: Invalid encoded length (must be multiple of 4)');
    }

    const result = [];
    
    for (let i = 0; i < encoded.length; i += 4) {
      // Convert 4 characters to values
      const val1 = this.algorithm.decodeTable[encoded[i]];
      const val2 = this.algorithm.decodeTable[encoded[i + 1]];
      const val3 = this.algorithm.decodeTable[encoded[i + 2]];
      const val4 = this.algorithm.decodeTable[encoded[i + 3]];
      
      if (val1 === undefined || val2 === undefined || 
          val3 === undefined || val4 === undefined) {
        throw new Error('XXencode: Invalid character in encoded data');
      }
      
      // Reconstruct 24-bit value
      const packed = (val1 << 18) | (val2 << 12) | (val3 << 6) | val4;
      
      // Unpack to 3 bytes
      result.push((packed >>> 16) & 0xFF);
      result.push((packed >>> 8) & 0xFF);
      result.push(packed & 0xFF);
    }
    
    // Remove trailing zeros (simple padding removal for educational purposes)
    while (result.length > 0 && result[result.length - 1] === 0) {
      result.pop();
    }
    
    return result;
  }
}

// Register the algorithm
RegisterAlgorithm(new XXEncodeAlgorithm());

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { XXEncodeAlgorithm, XXEncodeInstance };
}