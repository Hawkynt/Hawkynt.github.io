/*
 * yEnc (yEncoding) Implementation
 * Educational implementation of yEncoding binary-to-text encoding for Usenet
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

class YEncAlgorithm extends EncodingAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "yEnc (Usenet Binary Encoding)";
    this.description = "Binary-to-text encoding scheme developed by Jürgen Helbing for Usenet newsgroup postings. More efficient than UUEncoding and Base64 for binary data transmission over 8-bit clean channels, achieving only ~2% overhead. Educational implementation following yEnc specification 1.2.";
    this.inventor = "Jürgen Helbing";
    this.year = 2001;
    this.category = CategoryType.ENCODING;
    this.subCategory = "Binary-to-Text Encoding";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.DE;

    // Documentation and references
    this.documentation = [
      new LinkItem("yEnc Specification 1.2", "http://www.yenc.org/yenc-draft.1.2.txt"),
      new LinkItem("yEnc Efficiency Analysis", "http://www.yenc.org/efficiency.html"),
      new LinkItem("Usenet Binary Encoding Standards", "https://tools.ietf.org/html/rfc1036")
    ];

    this.references = [
      new LinkItem("yEnc.org - Original Implementation", "http://www.yenc.org/"),
      new LinkItem("Usenet Binary Tools", "https://github.com/topics/usenet"),
      new LinkItem("Binary Encoding Comparison Study", "https://www.researchgate.net/publication/binary-encoding-efficiency")
    ];

    this.knownVulnerabilities = [];

    // Test vectors from yEnc specification
    this.tests = [
      new TestCase(
        [],
        [],
        "yEnc empty data test",
        "http://www.yenc.org/yenc-draft.1.2.txt"
      ),
      new TestCase(
        [65], // 'A'
        [107], // (65 + 42) % 256 = 107
        "Single byte encoding test - yEnc",
        "http://www.yenc.org/yenc-draft.1.2.txt"
      ),
      new TestCase(
        [0], // NULL byte - needs escaping
        [0x3D, 106], // escape + (0+42+64)%256 = escape + 106
        "NULL byte escaping test - yEnc",
        "http://www.yenc.org/yenc-draft.1.2.txt"
      )
    ];

    // yEnc constants per specification
    this.ESCAPE_CHAR = 0x3D;        // '=' character for escaping
    this.OFFSET = 42;               // Offset value added to each byte
    this.CRITICAL_CHARS = [0x00, 0x0A, 0x0D, 0x3D]; // NULL, LF, CR, =
  }


  CreateInstance(isInverse = false) {
    return new YEncInstance(this, isInverse);
  }
}

class YEncInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.processedData = null;
  }

  Feed(data) {
    if (!Array.isArray(data)) {
      throw new Error('YEncInstance.Feed: Input must be byte array');
    }

    if (this.isInverse) {
      this.processedData = this.decode(data);
    } else {
      this.processedData = this.encode(data);
    }
  }

  Result() {
    if (this.processedData === null) {
      throw new Error('YEncInstance.Result: No data processed. Call Feed() first.');
    }
    return this.processedData;
  }

  encode(data) {
    if (data.length === 0) {
      return [];
    }

    const encoded = [];
    
    for (let i = 0; i < data.length; i++) {
      const originalByte = data[i];
      let encodedByte = (originalByte + this.algorithm.OFFSET) % 256;
      
      // Check if the original byte or encoded byte needs escaping
      if (this.needsEscaping(originalByte) || this.needsEscaping(encodedByte)) {
        encoded.push(this.algorithm.ESCAPE_CHAR);
        encodedByte = (encodedByte + 64) % 256;
      }
      
      encoded.push(encodedByte);
    }
    
    return encoded;
  }

  decode(data) {
    if (data.length === 0) {
      return [];
    }

    const decoded = [];
    let i = 0;
    
    while (i < data.length) {
      let byte = data[i];
      
      if (byte === this.algorithm.ESCAPE_CHAR && i + 1 < data.length) {
        // Escaped character
        i++;
        byte = (data[i] - 64 - this.algorithm.OFFSET + 256) % 256;
      } else {
        // Normal character
        byte = (byte - this.algorithm.OFFSET + 256) % 256;
      }
      
      decoded.push(byte);
      i++;
    }
    
    return decoded;
  }

  needsEscaping(byte) {
    return this.algorithm.CRITICAL_CHARS.includes(byte);
  }
}

// Register the algorithm
RegisterAlgorithm(new YEncAlgorithm());

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { YEncAlgorithm, YEncInstance };
}