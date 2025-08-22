/*
 * Base64 Encoding Implementation
 * Educational implementation of Base64 encoding (RFC 4648)
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

class Base64Algorithm extends EncodingAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Base64";
    this.description = "Base64 encoding scheme using 64-character alphabet to represent binary data in ASCII string format. Commonly used for email attachments, data URLs, and web APIs. Educational implementation following RFC 4648 standard.";
    this.inventor = "Privacy-Enhanced Mail (PEM) Working Group";
    this.year = 1993;
    this.category = CategoryType.ENCODING;
    this.subCategory = "Base Encoding";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.BEGINNER;
    this.country = CountryCode.INTL;

    // Documentation and references
    this.documentation = [
      new LinkItem("RFC 4648 - The Base16, Base32, and Base64 Data Encodings", "https://tools.ietf.org/html/rfc4648"),
      new LinkItem("Wikipedia - Base64", "https://en.wikipedia.org/wiki/Base64"),
      new LinkItem("Mozilla Base64 Guide", "https://developer.mozilla.org/en-US/docs/Web/API/btoa")
    ];

    this.references = [
      new LinkItem("RFC 2045 - MIME Part One", "https://tools.ietf.org/html/rfc2045"),
      new LinkItem("Base64 Online Decoder", "https://www.base64decode.org/"),
      new LinkItem("Data URL Specification", "https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs")
    ];

    this.knownVulnerabilities = [];

    // Test vectors from RFC 4648
    this.tests = [
      new TestCase(
        OpCodes.AnsiToBytes(""),
        OpCodes.AnsiToBytes(""),
        "Base64 empty string test - RFC 4648",
        "https://tools.ietf.org/html/rfc4648#section-10"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("f"),
        OpCodes.AnsiToBytes("Zg=="),
        "Base64 single character test - RFC 4648", 
        "https://tools.ietf.org/html/rfc4648#section-10"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("fo"),
        OpCodes.AnsiToBytes("Zm8="),
        "Base64 two character test - RFC 4648",
        "https://tools.ietf.org/html/rfc4648#section-10"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("foo"),
        OpCodes.AnsiToBytes("Zm9v"),
        "Base64 three character test - RFC 4648",
        "https://tools.ietf.org/html/rfc4648#section-10"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("foob"),
        OpCodes.AnsiToBytes("Zm9vYg=="),
        "Base64 four character test - RFC 4648",
        "https://tools.ietf.org/html/rfc4648#section-10"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("fooba"),
        OpCodes.AnsiToBytes("Zm9vYmE="),
        "Base64 five character test - RFC 4648",
        "https://tools.ietf.org/html/rfc4648#section-10"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("foobar"),
        OpCodes.AnsiToBytes("Zm9vYmFy"),
        "Base64 six character test - RFC 4648",
        "https://tools.ietf.org/html/rfc4648#section-10"
      )
    ];
  }

  CreateInstance(isInverse = false) {
    return new Base64Instance(this, isInverse);
  }
}

class Base64Instance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    this.paddingChar = "=";
    
    // Create decode lookup table
    this.decodeTable = {};
    for (let i = 0; i < this.alphabet.length; i++) {
      this.decodeTable[this.alphabet[i]] = i;
    }
  }

  Feed(data) {
    if (!Array.isArray(data)) {
      throw new Error('Base64Instance.Feed: Input must be byte array');
    }

    if (this.isInverse) {
      return this.decode(data);
    } else {
      return this.encode(data);
    }
  }

  Result() {
    // Base64 processing is done in Feed method
    throw new Error('Base64Instance.Result: Use Feed() method to encode/decode data');
  }

  encode(data) {
    if (data.length === 0) {
      return [];
    }

    let result = "";
    let i = 0;

    while (i < data.length) {
      const a = data[i++];
      const b = i < data.length ? data[i++] : 0;
      const c = i < data.length ? data[i++] : 0;

      const combined = (a << 16) | (b << 8) | c;

      result += this.alphabet[(combined >> 18) & 63];
      result += this.alphabet[(combined >> 12) & 63];
      result += this.alphabet[(combined >> 6) & 63];
      result += this.alphabet[combined & 63];
    }

    // Add padding
    const padding = data.length % 3;
    if (padding === 1) {
      result = result.slice(0, -2) + this.paddingChar + this.paddingChar;
    } else if (padding === 2) {
      result = result.slice(0, -1) + this.paddingChar;
    }

    return OpCodes.AnsiToBytes(result);
  }

  decode(data) {
    if (data.length === 0) {
      return [];
    }

    const input = OpCodes.BytesToAnsi(data);
    let cleanInput = input.replace(/[^A-Za-z0-9+\/]/g, "");
    
    // Remove padding
    cleanInput = cleanInput.replace(/=+$/, "");

    const result = [];
    let i = 0;

    while (i < cleanInput.length) {
      const a = this.decodeTable[cleanInput[i++]] || 0;
      const b = this.decodeTable[cleanInput[i++]] || 0;
      const c = this.decodeTable[cleanInput[i++]] || 0;
      const d = this.decodeTable[cleanInput[i++]] || 0;

      const combined = (a << 18) | (b << 12) | (c << 6) | d;

      result.push((combined >> 16) & 255);
      if (i - 2 < cleanInput.length) {
        result.push((combined >> 8) & 255);
      }
      if (i - 1 < cleanInput.length) {
        result.push(combined & 255);
      }
    }

    return result;
  }

  // Utility methods
  encodeString(str) {
    const bytes = OpCodes.AnsiToBytes(str);
    const encoded = this.encode(bytes);
    return OpCodes.BytesToAnsi(encoded);
  }

  decodeString(str) {
    const bytes = OpCodes.AnsiToBytes(str);
    const decoded = this.decode(bytes);
    return OpCodes.BytesToAnsi(decoded);
  }
}

// Register the algorithm
RegisterAlgorithm(new Base64Algorithm());

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Base64Algorithm, Base64Instance };
}