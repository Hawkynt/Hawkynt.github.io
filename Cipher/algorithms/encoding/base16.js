/*
 * Base16 (Hexadecimal) Encoding Implementation
 * Educational implementation of Base16 encoding (RFC 4648)
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

class Base16Algorithm extends EncodingAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Base16";
    this.description = "Base16 (hexadecimal) encoding using 16-character alphabet to represent binary data. Each byte is represented by two hex digits (0-9, A-F). Educational implementation following RFC 4648 standard.";
    this.inventor = "RFC Working Group";
    this.year = 1969;
    this.category = CategoryType.ENCODING;
    this.subCategory = "Base Encoding";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.BEGINNER;
    this.country = CountryCode.INTL;

    // Documentation and references
    this.documentation = [
      new LinkItem("RFC 4648 - The Base16, Base32, and Base64 Data Encodings", "https://tools.ietf.org/html/rfc4648"),
      new LinkItem("Wikipedia - Hexadecimal", "https://en.wikipedia.org/wiki/Hexadecimal"),
      new LinkItem("Base16 Online Converter", "https://base64.guru/converter/encode/hex")
    ];

    this.references = [
      new LinkItem("IEEE Standard 754", "https://ieeexplore.ieee.org/document/8766229"),
      new LinkItem("ASCII Hex Representation", "https://www.asciitable.com/"),
      new LinkItem("Binary to Hex Conversion", "https://www.rapidtables.com/convert/number/binary-to-hex.html")
    ];

    this.knownVulnerabilities = [];

    // Test vectors from RFC 4648 Section 10
    this.tests = [
      new TestCase(
        OpCodes.AnsiToBytes(""),
        OpCodes.AnsiToBytes(""),
        "Base16 empty string test - RFC 4648",
        "https://tools.ietf.org/html/rfc4648#section-10"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("f"),
        OpCodes.AnsiToBytes("66"),
        "Base16 single character test - RFC 4648",
        "https://tools.ietf.org/html/rfc4648#section-10"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("fo"),
        OpCodes.AnsiToBytes("666F"),
        "Base16 two character test - RFC 4648",
        "https://tools.ietf.org/html/rfc4648#section-10"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("foo"),
        OpCodes.AnsiToBytes("666F6F"),
        "Base16 three character test - RFC 4648",
        "https://tools.ietf.org/html/rfc4648#section-10"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("foob"),
        OpCodes.AnsiToBytes("666F6F62"),
        "Base16 four character test - RFC 4648",
        "https://tools.ietf.org/html/rfc4648#section-10"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("fooba"),
        OpCodes.AnsiToBytes("666F6F6261"),
        "Base16 five character test - RFC 4648",
        "https://tools.ietf.org/html/rfc4648#section-10"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("foobar"),
        OpCodes.AnsiToBytes("666F6F626172"),
        "Base16 six character test - RFC 4648",
        "https://tools.ietf.org/html/rfc4648#section-10"
      )
    ];
  }

  CreateInstance(isInverse = false) {
    return new Base16Instance(this, isInverse);
  }
}

class Base16Instance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    // Use OpCodes for alphabet definition but keep as bytes for lookup efficiency
    this.alphabetBytes = OpCodes.AnsiToBytes ? OpCodes.AnsiToBytes("0123456789ABCDEF") : [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 65, 66, 67, 68, 69, 70];
    this.alphabet = String.fromCharCode(...this.alphabetBytes);
    this.processedData = null;
    
    // Create decode lookup table
    this.decodeTable = {};
    for (let i = 0; i < this.alphabet.length; i++) {
      this.decodeTable[this.alphabet[i]] = i;
      this.decodeTable[this.alphabet[i].toLowerCase()] = i;
    }
  }

  Feed(data) {
    if (!Array.isArray(data)) {
      throw new Error('Base16Instance.Feed: Input must be byte array');
    }

    if (this.isInverse) {
      this.processedData = this.decode(data);
    } else {
      this.processedData = this.encode(data);
    }
  }

  Result() {
    if (this.processedData === null) {
      throw new Error('Base16Instance.Result: No data processed. Call Feed() first.');
    }
    return this.processedData;
  }

  encode(data) {
    if (data.length === 0) {
      return [];
    }

    const result = [];
    
    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      // Extract high and low nibbles (4 bits each)
      const high_nibble = (byte >> 4) & 0x0F;
      const low_nibble = byte & 0x0F;
      result.push(this.alphabet.charCodeAt(high_nibble));
      result.push(this.alphabet.charCodeAt(low_nibble));
    }

    return result;
  }

  decode(data) {
    if (data.length === 0) {
      return [];
    }

    const input = String.fromCharCode(...data);
    const cleanInput = input.split('').filter(c => /[0-9A-Fa-f]/.test(c)).join('');
    
    if (cleanInput.length % 2 !== 0) {
      throw new Error('Base16Instance.decode: Invalid hex string length');
    }

    const result = [];
    
    for (let i = 0; i < cleanInput.length; i += 2) {
      const high = this.decodeTable[cleanInput[i]];
      const low = this.decodeTable[cleanInput[i + 1]];
      
      if (high === undefined || low === undefined) {
        throw new Error('Base16Instance.decode: Invalid hex character');
      }
      
      result.push((high << 4) | low);
    }

    return result;
  }

  // Utility methods
  encodeString(str) {
    const bytes = OpCodes?.AnsiToBytes ? OpCodes.AnsiToBytes(str) : str.split('').map(c => c.charCodeAt(0));
    const encoded = this.encode(bytes);
    return String.fromCharCode(...encoded);
  }

  decodeString(str) {
    const bytes = OpCodes?.AnsiToBytes ? OpCodes.AnsiToBytes(str) : str.split('').map(c => c.charCodeAt(0));
    const decoded = this.decode(bytes);
    return String.fromCharCode(...decoded);
  }
}

// Register the algorithm
RegisterAlgorithm(new Base16Algorithm());

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Base16Algorithm, Base16Instance };
}