/*
 * Base58 Encoding Implementation
 * Educational implementation of Base58 encoding used in Bitcoin addresses
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

class Base58Algorithm extends EncodingAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Base58";
    this.description = "Base58 encoding scheme using 58-character alphabet that excludes visually similar characters (0, O, I, l). Created by Satoshi Nakamoto for Bitcoin addresses to reduce transcription errors. Educational implementation.";
    this.inventor = "Satoshi Nakamoto";
    this.year = 2009;
    this.category = CategoryType.ENCODING;
    this.subCategory = "Base Encoding";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.INTL;

    // Documentation and references
    this.documentation = [
      new LinkItem("Base58 Internet Draft", "https://datatracker.ietf.org/doc/html/draft-msporny-base58-03"),
      new LinkItem("Bitcoin Wiki - Base58Check", "https://en.bitcoin.it/wiki/Base58Check_encoding"),
      new LinkItem("Base58 Alphabet", "https://github.com/bitcoin/bitcoin/blob/master/src/base58.cpp")
    ];

    this.references = [
      new LinkItem("Bitcoin Source Code", "https://github.com/bitcoin/bitcoin"),
      new LinkItem("Cryptocurrency Address Formats", "https://en.bitcoin.it/wiki/List_of_address_prefixes"),
      new LinkItem("Base58 Online Converter", "https://www.appdevtools.com/base58-encoder-decoder")
    ];

    this.knownVulnerabilities = [];

    // Test vectors verified with implementation
    this.tests = [
      new TestCase(
        OpCodes.AnsiToBytes(""),
        OpCodes.AnsiToBytes(""),
        "Base58 empty string test",
        "https://datatracker.ietf.org/doc/html/draft-msporny-base58-03"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("f"),
        OpCodes.AnsiToBytes("2m"),
        "Base58 single character test",
        "https://datatracker.ietf.org/doc/html/draft-msporny-base58-03"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("fo"),
        OpCodes.AnsiToBytes("8o8"),
        "Base58 two character test",
        "https://datatracker.ietf.org/doc/html/draft-msporny-base58-03"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("foo"),
        OpCodes.AnsiToBytes("bQbp"),
        "Base58 three character test",
        "https://datatracker.ietf.org/doc/html/draft-msporny-base58-03"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("foob"),
        OpCodes.AnsiToBytes("3csAg9"),
        "Base58 four character test",
        "https://datatracker.ietf.org/doc/html/draft-msporny-base58-03"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("fooba"),
        OpCodes.AnsiToBytes("CZJRhmz"),
        "Base58 five character test",
        "https://datatracker.ietf.org/doc/html/draft-msporny-base58-03"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("foobar"),
        OpCodes.AnsiToBytes("t1Zv2yaZ"),
        "Base58 six character test",
        "https://datatracker.ietf.org/doc/html/draft-msporny-base58-03"
      )
    ];
  }

  CreateInstance(isInverse = false) {
    return new Base58Instance(this, isInverse);
  }
}

class Base58Instance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    // Bitcoin Base58 alphabet - excludes 0, O, I, l
    this.alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    this.processedData = null;
    
    // Create decode lookup table
    this.decodeTable = {};
    for (let i = 0; i < this.alphabet.length; i++) {
      this.decodeTable[this.alphabet[i]] = i;
    }
  }

  Feed(data) {
    if (!Array.isArray(data)) {
      throw new Error('Base58Instance.Feed: Input must be byte array');
    }

    if (this.isInverse) {
      this.processedData = this.decode(data);
    } else {
      this.processedData = this.encode(data);
    }
  }

  Result() {
    if (this.processedData === null) {
      throw new Error('Base58Instance.Result: No data processed. Call Feed() first.');
    }
    return this.processedData;
  }

  encode(data) {
    if (data.length === 0) {
      return [];
    }

    // Count leading zero bytes (they become '1' characters in Base58)
    let leadingZeros = 0;
    for (let i = 0; i < data.length && data[i] === 0; i++) {
      leadingZeros++;
    }

    // Convert to big integer using base-256 arithmetic
    let num = BigInt(0);
    for (let i = 0; i < data.length; i++) {
      num = num * BigInt(256) + BigInt(data[i]);
    }

    // Convert to Base58 using repeated division
    let result = '';
    while (num > 0) {
      const remainder = num % BigInt(58);
      result = this.alphabet[Number(remainder)] + result;
      num = num / BigInt(58);
    }

    // Add leading '1's for leading zero bytes
    result = '1'.repeat(leadingZeros) + result;

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

    const input = String.fromCharCode(...data);

    // Count leading '1's (they represent leading zero bytes)
    let leadingOnes = 0;
    for (let i = 0; i < input.length && input[i] === '1'; i++) {
      leadingOnes++;
    }

    // Convert from Base58 to big integer
    let num = BigInt(0);
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      if (!(char in this.decodeTable)) {
        throw new Error(`Base58Instance.decode: Invalid character '${char}' in Base58 string`);
      }
      num = num * BigInt(58) + BigInt(this.decodeTable[char]);
    }

    // Convert big integer back to bytes
    const result = [];
    while (num > 0) {
      result.unshift(Number(num % BigInt(256)));
      num = num / BigInt(256);
    }

    // Add leading zeros for leading '1's
    for (let i = 0; i < leadingOnes; i++) {
      result.unshift(0);
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
RegisterAlgorithm(new Base58Algorithm());

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Base58Algorithm, Base58Instance };
}