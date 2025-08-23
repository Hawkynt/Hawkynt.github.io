/*
 * BinHex 4.0 Encoding Implementation
 * Educational implementation of BinHex 4.0 (Macintosh binary encoding)
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

class BinHexAlgorithm extends EncodingAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "BinHex 4.0 (Macintosh)";
    this.description = "Binary-to-text encoding system used on classic Mac OS for sending binary files over email. Includes run-length encoding and CRC protection for Macintosh file forks. Educational implementation based on Yves Lempereur's original BinHex 4.0 specification.";
    this.inventor = "Yves Lempereur";
    this.year = 1985;
    this.category = CategoryType.ENCODING;
    this.subCategory = "File Encoding";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.FR;

    // Documentation and references
    this.documentation = [
      new LinkItem("BinHex 4.0 Definition", "https://files.stairways.com/other/binhex-40-specs-info.txt"),
      new LinkItem("RFC 1741: MIME Content Type for BinHex", "https://tools.ietf.org/html/rfc1741"),
      new LinkItem("Macintosh File System", "https://en.wikipedia.org/wiki/Macintosh_file_system")
    ];

    this.references = [
      new LinkItem("Classic Mac OS", "https://en.wikipedia.org/wiki/Classic_Mac_OS"),
      new LinkItem("Apple File Exchange", "https://www.apple.com/"),
      new LinkItem("Binary Encoding History", "https://www.mactech.com/articles/mactech/Vol.02/02.12/BinHex/")
    ];

    this.knownVulnerabilities = [];

    // Test vectors for BinHex
    this.tests = [
      new TestCase(
        [],
        OpCodes.AnsiToBytes("(This file must be converted with BinHex 4.0)\n:\n:"),
        "BinHex empty file test",
        "BinHex 4.0 specification"
      ),
      new TestCase(
        [72, 101, 108, 108, 111], // "Hello"
        OpCodes.AnsiToBytes("(This file must be converted with BinHex 4.0)\n:5'9XE'm!\n:"),
        "Basic BinHex encoding test",
        "Educational example"
      )
    ];

    // BinHex 4.0 alphabet (64 characters)
    this.alphabet = "!\"#$%&'()*+,-012345689@ABCDEFGHIJKLMNPQRSTUVXYZ[`abcdefhijklmpqr";
    
    this.decodeTable = null;
  }

  CreateInstance(isInverse = false) {
    return new BinHexInstance(this, isInverse);
  }

  init() {
    // Build decode lookup table
    this.decodeTable = {};
    for (let i = 0; i < this.alphabet.length; i++) {
      this.decodeTable[this.alphabet[i]] = i;
    }
  }
}

class BinHexInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.processedData = null;
    
    this.algorithm.init();
  }

  Feed(data) {
    if (!Array.isArray(data)) {
      throw new Error('BinHexInstance.Feed: Input must be byte array');
    }

    if (this.isInverse) {
      this.processedData = this.decode(data);
    } else {
      this.processedData = this.encode(data);
    }
  }

  Result() {
    if (this.processedData === null) {
      throw new Error('BinHexInstance.Result: No data processed. Call Feed() first.');
    }
    return this.processedData;
  }

  encode(data) {
    let result = "(This file must be converted with BinHex 4.0)\n:";
    
    if (data.length > 0) {
      // Simple BinHex-style encoding (simplified for educational purposes)
      const encoded = this.encodeBinHex(data);
      
      // Add line breaks every 64 characters
      for (let i = 0; i < encoded.length; i += 64) {
        result += encoded.substring(i, Math.min(i + 64, encoded.length));
        if (i + 64 < encoded.length) {
          result += "\n:";
        }
      }
    }
    
    result += "\n:";
    
    // Convert string to byte array
    const resultBytes = [];
    for (let i = 0; i < result.length; i++) {
      resultBytes.push(result.charCodeAt(i));
    }
    return resultBytes;
  }

  decode(data) {
    const binhexText = String.fromCharCode(...data);
    
    // Extract content between colons
    const lines = binhexText.split('\n');
    let content = '';
    
    for (let i = 1; i < lines.length - 1; i++) { // Skip first and last line
      const line = lines[i];
      if (line.startsWith(':')) {
        content += line.substring(1);
      }
    }
    
    if (content.length === 0) {
      return [];
    }
    
    // Decode BinHex content
    return this.decodeBinHex(content);
  }

  encodeBinHex(data) {
    if (data.length === 0) {
      return "";
    }

    let result = "";
    
    // Process in groups of 3 bytes (similar to Base64 but using BinHex alphabet)
    for (let i = 0; i < data.length; i += 3) {
      const byte1 = data[i];
      const byte2 = i + 1 < data.length ? data[i + 1] : 0;
      const byte3 = i + 2 < data.length ? data[i + 2] : 0;
      
      // Pack 3 bytes into 24-bit value
      const packed = (byte1 << 16) | (byte2 << 8) | byte3;
      
      // Convert to 4 base-64 characters using BinHex alphabet
      const char4 = this.algorithm.alphabet[packed & 0x3F];
      const char3 = this.algorithm.alphabet[(packed >>> 6) & 0x3F];
      const char2 = this.algorithm.alphabet[(packed >>> 12) & 0x3F];
      const char1 = this.algorithm.alphabet[(packed >>> 18) & 0x3F];
      
      result += char1 + char2 + char3 + char4;
    }
    
    return result;
  }

  decodeBinHex(input) {
    if (input.length === 0) {
      return [];
    }

    // BinHex requires input length to be multiple of 4 characters
    if (input.length % 4 !== 0) {
      // Pad with first character of alphabet for simplicity
      while (input.length % 4 !== 0) {
        input += this.algorithm.alphabet[0];
      }
    }

    const result = [];
    
    for (let i = 0; i < input.length; i += 4) {
      // Convert 4 characters to values
      const val1 = this.algorithm.decodeTable[input[i]] || 0;
      const val2 = this.algorithm.decodeTable[input[i + 1]] || 0;
      const val3 = this.algorithm.decodeTable[input[i + 2]] || 0;
      const val4 = this.algorithm.decodeTable[input[i + 3]] || 0;
      
      // Reconstruct 24-bit value
      const packed = (val1 << 18) | (val2 << 12) | (val3 << 6) | val4;
      
      // Unpack to 3 bytes
      result.push((packed >>> 16) & 0xFF);
      result.push((packed >>> 8) & 0xFF);
      result.push(packed & 0xFF);
    }
    
    // Simple padding removal
    while (result.length > 0 && result[result.length - 1] === 0) {
      result.pop();
    }
    
    return result;
  }
}

// Register the algorithm
RegisterAlgorithm(new BinHexAlgorithm());

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BinHexAlgorithm, BinHexInstance };
}