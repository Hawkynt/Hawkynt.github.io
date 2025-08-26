/*
 * Base16 (Hexadecimal) Encoding Implementation
 * Educational implementation of Base16 encoding (RFC 4648)
 * (c)2006-2025 Hawkynt
 */

// Load AlgorithmFramework (REQUIRED)

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }
  
  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

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
          global.OpCodes.AnsiToBytes("f"), // "f"
          [54, 54], // "66"
          "Base16 single character test - RFC 4648",
          "https://tools.ietf.org/html/rfc4648#section-10"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("fo"), // "fo"
          [54, 54, 54, 70], // "666F"
          "Base16 two character test - RFC 4648",
          "https://tools.ietf.org/html/rfc4648#section-10"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("foo"), // "foo"
          [54, 54, 54, 70, 54, 70], // "666F6F"
          "Base16 three character test - RFC 4648",
          "https://tools.ietf.org/html/rfc4648#section-10"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("foob"), // "foob"
          [54, 54, 54, 70, 54, 70, 54, 50], // "666F6F62"
          "Base16 four character test - RFC 4648",
          "https://tools.ietf.org/html/rfc4648#section-10"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("fooba"), // "fooba"
          [54, 54, 54, 70, 54, 70, 54, 50, 54, 49], // "666F6F6261"
          "Base16 five character test - RFC 4648",
          "https://tools.ietf.org/html/rfc4648#section-10"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("foobar"), // "foobar"
          [54, 54, 54, 70, 54, 70, 54, 50, 54, 49, 55, 50], // "666F6F626172"
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
      // Use OpCodes for alphabet definition
      this.alphabetBytes = OpCodes.AnsiToBytes("0123456789ABCDEF");
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
      let cleanInput = '';
      for (let i = 0; i < input.length; ++i) {
        const code = input.charCodeAt(i);
        if ((code >= 48 && code <= 57) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102)) { // 0-9, A-F, a-f
          cleanInput += input[i];
        }
      }

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

  // ===== REGISTRATION =====

    const algorithmInstance = new Base16Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Base16Algorithm, Base16Instance };
}));