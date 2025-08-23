/*
 * Base32 Encoding Implementation
 * Educational implementation of Base32 encoding (RFC 4648)
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

class Base32Algorithm extends EncodingAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Base32";
    this.description = "Base32 encoding scheme using 32-character alphabet for case-insensitive encoding. More human-readable than Base64 and commonly used in authentication systems like TOTP. Educational implementation following RFC 4648 standard.";
    this.inventor = "Privacy-Enhanced Mail (PEM) Working Group";
    this.year = 2006;
    this.category = CategoryType.ENCODING;
    this.subCategory = "Base Encoding";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.BEGINNER;
    this.country = CountryCode.INTL;

    // Documentation and references
    this.documentation = [
      new LinkItem("RFC 4648 - The Base16, Base32, and Base64 Data Encodings", "https://tools.ietf.org/html/rfc4648"),
      new LinkItem("Wikipedia - Base32", "https://en.wikipedia.org/wiki/Base32"),
      new LinkItem("Base32 Crockford", "https://www.crockford.com/base32.html")
    ];

    this.references = [
      new LinkItem("Google Authenticator", "https://github.com/google/google-authenticator"),
      new LinkItem("TOTP Specification", "https://tools.ietf.org/html/rfc6238"),
      new LinkItem("Base32 Online Decoder", "https://base32decode.org/")
    ];

    this.knownVulnerabilities = [];

    // Test vectors from RFC 4648
    this.tests = [
      new TestCase(
        OpCodes.AnsiToBytes(""),
        OpCodes.AnsiToBytes(""),
        "Base32 empty string test - RFC 4648",
        "https://tools.ietf.org/html/rfc4648#section-10"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("f"),
        OpCodes.AnsiToBytes("MY======"),
        "Base32 single character test - RFC 4648", 
        "https://tools.ietf.org/html/rfc4648#section-10"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("fo"),
        OpCodes.AnsiToBytes("MZXQ===="),
        "Base32 two character test - RFC 4648",
        "https://tools.ietf.org/html/rfc4648#section-10"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("foo"),
        OpCodes.AnsiToBytes("MZXW6==="),
        "Base32 three character test - RFC 4648",
        "https://tools.ietf.org/html/rfc4648#section-10"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("foob"),
        OpCodes.AnsiToBytes("MZXW6YQ="),
        "Base32 four character test - RFC 4648",
        "https://tools.ietf.org/html/rfc4648#section-10"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("fooba"),
        OpCodes.AnsiToBytes("MZXW6YTB"),
        "Base32 five character test - RFC 4648",
        "https://tools.ietf.org/html/rfc4648#section-10"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("foobar"),
        OpCodes.AnsiToBytes("MZXW6YTBOI======"),
        "Base32 six character test - RFC 4648",
        "https://tools.ietf.org/html/rfc4648#section-10"
      )
    ];
  }

  CreateInstance(isInverse = false) {
    return new Base32Instance(this, isInverse);
  }
}

class Base32Instance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    this.paddingChar = "=";
    this.processedData = null;
    
    // Create decode lookup table
    this.decodeTable = {};
    for (let i = 0; i < this.alphabet.length; i++) {
      this.decodeTable[this.alphabet[i]] = i;
    }
  }

  Feed(data) {
    if (!Array.isArray(data)) {
      throw new Error('Base32Instance.Feed: Input must be byte array');
    }

    if (this.isInverse) {
      this.processedData = this.decode(data);
    } else {
      this.processedData = this.encode(data);
    }
  }

  Result() {
    if (this.processedData === null) {
      throw new Error('Base32Instance.Result: No data processed. Call Feed() first.');
    }
    return this.processedData;
  }

  encode(data) {
    if (data.length === 0) {
      return [];
    }

    let result = "";
    let buffer = 0;
    let bufferBits = 0;

    for (let i = 0; i < data.length; i++) {
      buffer = (buffer << 8) | data[i];
      bufferBits += 8;

      while (bufferBits >= 5) {
        result += this.alphabet[(buffer >>> (bufferBits - 5)) & 31];
        bufferBits -= 5;
      }
    }

    // Handle remaining bits
    if (bufferBits > 0) {
      result += this.alphabet[(buffer << (5 - bufferBits)) & 31];
    }

    // Add padding
    const padding = (8 - (result.length % 8)) % 8;
    for (let i = 0; i < padding; i++) {
      result += this.paddingChar;
    }

    const resultBytes = [];
    for (let i = 0; i < result.length; i++) {
      resultBytes.push(result.charCodeAt(i));
    }
    return resultBytes;
  }

  decode(data) {
    if (data.length === 0) {
      return [];
    }

    const input = String.fromCharCode(...data).toUpperCase();
    let cleanInput = input.replace(/[^A-Z2-7]/g, "");
    
    // Remove padding
    cleanInput = cleanInput.replace(/=+$/, "");

    const result = [];
    let buffer = 0;
    let bufferBits = 0;

    for (let i = 0; i < cleanInput.length; i++) {
      const value = this.decodeTable[cleanInput[i]];
      if (value === undefined) {
        throw new Error(`Invalid Base32 character: ${cleanInput[i]}`);
      }

      buffer = (buffer << 5) | value;
      bufferBits += 5;

      if (bufferBits >= 8) {
        result.push((buffer >>> (bufferBits - 8)) & 255);
        bufferBits -= 8;
      }
    }

    return result;
  }

  // Utility methods
  encodeString(str) {
    const bytes = OpCodes.AnsiToBytes(str);
    const encoded = this.encode(bytes);
    return String.fromCharCode(...encoded);
  }

  decodeString(str) {
    const bytes = OpCodes.AnsiToBytes(str);
    const decoded = this.decode(bytes);
    return String.fromCharCode(...decoded);
  }
}

// Register the algorithm
RegisterAlgorithm(new Base32Algorithm());

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Base32Algorithm, Base32Instance };
}