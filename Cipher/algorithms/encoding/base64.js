/*
 * Base64 Encoding Implementation
 * Educational implementation of Base64 encoding (RFC 4648)
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

  /**
   * Base64 encoding - RFC 4648 standard implementation
   * Encodes binary data to ASCII text using 64-character alphabet
   * @class
   * @extends {EncodingAlgorithm}
   */
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

    /**
     * Create new Base64 encoding/decoding instance
     * @param {boolean} [isInverse=false] - True for decoding, false for encoding
     * @returns {Base64Instance} New Base64 instance
     */
    CreateInstance(isInverse = false) {
      return new Base64Instance(this, isInverse);
    }
  }

  /**
   * Base64 encoding instance implementing Feed/Result pattern
   * @class
   * @extends {IAlgorithmInstance}
   */
  class Base64Instance extends IAlgorithmInstance {
    /**
     * Initialize Base64 instance
     * @param {Base64Algorithm} algorithm - Parent algorithm instance
     * @param {boolean} [isInverse=false] - Decoding mode flag
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      this.paddingChar = "=";
      this.processedData = null;

      // Create decode lookup table
      this.decodeTable = {};
      for (let i = 0; i < this.alphabet.length; i++) {
        this.decodeTable[this.alphabet[i]] = i;
      }
    }

    /**
     * Feed data for encoding or decoding
     * @param {uint8[]} data - Input byte array
     * @throws {Error} If input is not byte array
     */
    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('Base64Instance.Feed: Input must be byte array');
      }

      if (this.isInverse) {
        this.processedData = this.decode(data);
      } else {
        this.processedData = this.encode(data);
      }
    }

    /**
     * Get encoding/decoding result
     * @returns {uint8[]} Processed output bytes
     * @throws {Error} If no data processed
     */
    Result() {
      if (this.processedData === null) {
        throw new Error('Base64Instance.Result: No data processed. Call Feed() first.');
      }
      return this.processedData;
    }

    /**
     * Encode binary data to Base64
     * @param {uint8[]} data - Input byte array
     * @returns {uint8[]} Base64-encoded bytes
     */
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

      const resultBytes = [];
      for (let i = 0; i < result.length; i++) {
        resultBytes.push(result.charCodeAt(i));
      }
      return resultBytes;
    }

    /**
     * Decode Base64 to binary data
     * @param {uint8[]} data - Base64-encoded byte array
     * @returns {uint8[]} Decoded binary bytes
     */
    decode(data) {
      if (data.length === 0) {
        return [];
      }

      const input = String.fromCharCode(...data);
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
        const a = this.decodeTable[cleanInput[i++]] || 0;
        const b = this.decodeTable[cleanInput[i++]] || 0;
        const c = this.decodeTable[cleanInput[i++]] || 0;
        const d = this.decodeTable[cleanInput[i++]] || 0;

        const combined = (a << 18) | (b << 12) | (c << 6) | d;

        result.push((combined >> 16) & 255);
        result.push((combined >> 8) & 255);
        result.push(combined & 255);
      }

      // Handle remaining characters (incomplete group)
      if (i < cleanInput.length) {
        const a = this.decodeTable[cleanInput[i++]] || 0;
        const b = i < cleanInput.length ? (this.decodeTable[cleanInput[i++]] || 0) : 0;
        const c = i < cleanInput.length ? (this.decodeTable[cleanInput[i++]] || 0) : 0;
        const d = i < cleanInput.length ? (this.decodeTable[cleanInput[i++]] || 0) : 0;

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

    /**
     * Encode string to Base64 string
     * @param {string} str - Input ASCII string
     * @returns {string} Base64-encoded string
     */
    encodeString(str) {
      const bytes = OpCodes.AnsiToBytes(str);
      const encoded = this.encode(bytes);
      return OpCodes.BytesToAnsi(encoded);
    }

    /**
     * Decode Base64 string to original string
     * @param {string} str - Base64-encoded string
     * @returns {string} Decoded ASCII string
     */
    decodeString(str) {
      const bytes = OpCodes.AnsiToBytes(str);
      const decoded = this.decode(bytes);
      return OpCodes.BytesToAnsi(decoded);
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new Base64Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Base64Algorithm, Base64Instance };
}));