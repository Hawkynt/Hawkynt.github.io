/*
 * PEM (Privacy-Enhanced Mail) Encoding Implementation
 * Educational implementation of PEM encoding (RFC 7468)
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

class PEMAlgorithm extends EncodingAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "PEM (Privacy-Enhanced Mail)";
    this.description = "Text encoding format for cryptographic objects like certificates and keys. Uses Base64 encoding wrapped with header and footer lines for email transmission. Educational implementation following RFC 7468 textual encodings of PKIX, PKCS, and CMS structures.";
    this.inventor = "Privacy-Enhanced Mail Working Group";
    this.year = 1993;
    this.category = CategoryType.ENCODING;
    this.subCategory = "Cryptographic Encoding";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.BEGINNER;
    this.country = CountryCode.US;

    // Documentation and references
    this.documentation = [
      new LinkItem("RFC 7468 - Textual Encodings of PKIX, PKCS, and CMS Structures", "https://tools.ietf.org/html/rfc7468"),
      new LinkItem("RFC 1421 - Privacy Enhancement for Internet Electronic Mail", "https://tools.ietf.org/html/rfc1421"),
      new LinkItem("PEM Format Wikipedia", "https://en.wikipedia.org/wiki/Privacy-Enhanced_Mail")
    ];

    this.references = [
      new LinkItem("OpenSSL PEM Format", "https://www.openssl.org/docs/man1.1.1/man5/pem.html"),
      new LinkItem("X.509 Certificate Format", "https://tools.ietf.org/html/rfc5280"),
      new LinkItem("PKCS Standards", "https://www.rsa.com/en-us/company/standards/pkcs")
    ];

    this.knownVulnerabilities = [];

    // Test vectors for PEM encoding
    this.tests = [
      new TestCase(
        [],
        OpCodes.AnsiToBytes("-----BEGIN CERTIFICATE-----\n\n-----END CERTIFICATE-----\n"),
        "PEM empty certificate test",
        "RFC 7468 standard"
      ),
      new TestCase(
        [72, 101, 108, 108, 111], // "Hello"
        OpCodes.AnsiToBytes("-----BEGIN CERTIFICATE-----\nSGVsbG8=\n-----END CERTIFICATE-----\n"),
        "Basic PEM encoding test",
        "Educational example"
      )
    ];

    // Base64 alphabet for encoding
    this.alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    this.paddingChar = "=";
  }

  CreateInstance(isInverse = false) {
    return new PEMInstance(this, isInverse);
  }
}

class PEMInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.processedData = null;
  }

  Feed(data) {
    if (!Array.isArray(data)) {
      throw new Error('PEMInstance.Feed: Input must be byte array');
    }

    if (this.isInverse) {
      this.processedData = this.decode(data);
    } else {
      this.processedData = this.encode(data);
    }
  }

  Result() {
    if (this.processedData === null) {
      throw new Error('PEMInstance.Result: No data processed. Call Feed() first.');
    }
    return this.processedData;
  }

  encode(data) {
    let result = "-----BEGIN CERTIFICATE-----\n";
    
    if (data.length > 0) {
      // Encode using Base64
      const base64 = this.encodeBase64(data);
      
      // Add line breaks every 64 characters (PEM standard)
      for (let i = 0; i < base64.length; i += 64) {
        result += base64.substring(i, Math.min(i + 64, base64.length)) + "\n";
      }
    } else {
      result += "\n";
    }
    
    result += "-----END CERTIFICATE-----\n";
    
    // Convert string to byte array
    const resultBytes = [];
    for (let i = 0; i < result.length; i++) {
      resultBytes.push(result.charCodeAt(i));
    }
    return resultBytes;
  }

  decode(data) {
    const pemText = String.fromCharCode(...data);
    
    // Extract content between BEGIN and END markers
    const beginMarker = "-----BEGIN CERTIFICATE-----";
    const endMarker = "-----END CERTIFICATE-----";
    
    const beginIndex = pemText.indexOf(beginMarker);
    const endIndex = pemText.indexOf(endMarker);
    
    if (beginIndex === -1 || endIndex === -1) {
      throw new Error('PEM: Invalid format - missing BEGIN/END markers');
    }
    
    let content = pemText.substring(beginIndex + beginMarker.length, endIndex);
    content = content.replace(/\s+/g, ''); // Remove all whitespace
    
    if (content.length === 0) {
      return [];
    }
    
    // Decode Base64 content
    return this.decodeBase64(content);
  }

  encodeBase64(data) {
    if (data.length === 0) {
      return "";
    }

    let result = "";
    let i = 0;

    while (i < data.length) {
      const a = data[i++];
      const b = i < data.length ? data[i++] : 0;
      const c = i < data.length ? data[i++] : 0;

      const combined = (a << 16) | (b << 8) | c;

      result += this.algorithm.alphabet[(combined >> 18) & 63];
      result += this.algorithm.alphabet[(combined >> 12) & 63];
      result += this.algorithm.alphabet[(combined >> 6) & 63];
      result += this.algorithm.alphabet[combined & 63];
    }

    // Add padding
    const padding = data.length % 3;
    if (padding === 1) {
      result = result.slice(0, -2) + this.algorithm.paddingChar + this.algorithm.paddingChar;
    } else if (padding === 2) {
      result = result.slice(0, -1) + this.algorithm.paddingChar;
    }

    return result;
  }

  decodeBase64(input) {
    if (input.length === 0) {
      return [];
    }

    // Build decode table
    const decodeTable = {};
    for (let i = 0; i < this.algorithm.alphabet.length; i++) {
      decodeTable[this.algorithm.alphabet[i]] = i;
    }

    let cleanInput = input.replace(/[^A-Za-z0-9+\/=]/g, "");
    
    // Count padding characters
    const paddingMatch = cleanInput.match(/=+$/);
    const paddingCount = paddingMatch ? paddingMatch[0].length : 0;
    
    // Remove padding for processing
    cleanInput = cleanInput.replace(/=+$/, "");

    const result = [];
    let i = 0;

    // Process in groups of 4 characters
    while (i + 3 < cleanInput.length) {
      const a = decodeTable[cleanInput[i++]] || 0;
      const b = decodeTable[cleanInput[i++]] || 0;
      const c = decodeTable[cleanInput[i++]] || 0;
      const d = decodeTable[cleanInput[i++]] || 0;

      const combined = (a << 18) | (b << 12) | (c << 6) | d;

      result.push((combined >> 16) & 255);
      result.push((combined >> 8) & 255);
      result.push(combined & 255);
    }

    // Handle remaining characters
    if (i < cleanInput.length) {
      const a = decodeTable[cleanInput[i++]] || 0;
      const b = i < cleanInput.length ? (decodeTable[cleanInput[i++]] || 0) : 0;
      const c = i < cleanInput.length ? (decodeTable[cleanInput[i++]] || 0) : 0;
      const d = i < cleanInput.length ? (decodeTable[cleanInput[i++]] || 0) : 0;

      const combined = (a << 18) | (b << 12) | (c << 6) | d;

      result.push((combined >> 16) & 255);
      
      if (paddingCount < 2) {
        result.push((combined >> 8) & 255);
      }
      
      if (paddingCount === 0) {
        result.push(combined & 255);
      }
    }

    return result;
  }
}

// Register the algorithm
RegisterAlgorithm(new PEMAlgorithm());

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PEMAlgorithm, PEMInstance };
}