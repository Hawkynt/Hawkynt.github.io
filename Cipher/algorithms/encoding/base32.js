/*
 * Base32 Encoding Implementation
 * Educational implementation of Base32 encoding (RFC 4648)
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

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Base32Instance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Base32Instance(this, isInverse);
    }
  }

  /**
 * Base32 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Base32Instance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Base32Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {string} */
      this.alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
      /** @type {string} */
      this.paddingChar = "=";
      /** @type {uint8[]|null} */
      this.processedData = null;
      /** @type {uint8[]|null} */
      this._feedBuffer = null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('Base32Instance.Feed: Input must be byte array');
      }

      // Feed is a streaming interface: successive calls extend the message
      // rather than replace it. A single chunk also cannot be converted on its
      // own, because the coder groups whole units of input and emits padding and
      // framing at the end of the message, so the bytes are collected here and
      // converted once, in Result().
      if (!this._feedBuffer) {
        /** @type {uint8[]} */
        const fresh = [];
        this._feedBuffer = fresh;
      }
      for (let i = 0; i < data.length; i++) {
        this._feedBuffer.push(data[i]);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._feedBuffer) {
        throw new Error('Base32Instance.Result: No data processed. Call Feed() first.');
      }
      if (this.isInverse) {
        this.processedData = this.decode(this._feedBuffer);
      } else {
        this.processedData = this.encode(this._feedBuffer);
      }
      return this.processedData;
    }

    /**
     * Encode bytes as padded Base32 text
     * @param {uint8[]} data - Input bytes
     * @returns {uint8[]} ASCII Base32 characters
     */
    encode(data) {
      /** @type {uint8[]} */
      const resultBytes = [];
      if (data.length === 0) {
        return resultBytes;
      }

      /** @type {string} */
      let result = "";
      // Bit buffer: only its low bits are ever read, so it may wrap
      /** @type {uint32} */
      let buffer = 0;
      /** @type {int32} */
      let bufferBits = 0;

      for (let i = 0; i < data.length; i++) {
        buffer = OpCodes.Or32(OpCodes.Shl32(buffer, 8), data[i]);
        bufferBits += 8;

        while (bufferBits >= 5) {
          result += this.alphabet.charAt(OpCodes.And32(OpCodes.Shr32(buffer, bufferBits - 5), 31));
          bufferBits -= 5;
        }
      }

      // Handle remaining bits
      if (bufferBits > 0) {
        result += this.alphabet.charAt(OpCodes.And32(OpCodes.Shl32(buffer, 5 - bufferBits), 31));
      }

      // Add padding
      /** @type {int32} */
      const padding = (8 - (result.length % 8)) % 8;
      for (let i = 0; i < padding; i++) {
        result += this.paddingChar;
      }

      for (let i = 0; i < result.length; i++) {
        resultBytes.push(result.charCodeAt(i));
      }
      return resultBytes;
    }

    /**
     * Decode Base32 text to bytes (case-insensitive, other characters ignored)
     * @param {uint8[]} data - ASCII Base32 characters
     * @returns {uint8[]} Decoded bytes
     */
    decode(data) {
      /** @type {uint8[]} */
      const result = [];
      if (data.length === 0) {
        return result;
      }

      /** @type {string} */
      const input = OpCodes.BytesToChars(data).toUpperCase();
      /** @type {string} */
      let cleanInput = input.replace(/[^A-Z2-7]/g, "");

      // Remove padding
      cleanInput = cleanInput.replace(/=+$/, "");

      /** @type {uint32} */
      let buffer = 0;
      /** @type {int32} */
      let bufferBits = 0;

      for (let i = 0; i < cleanInput.length; i++) {
        /** @type {int32} */
        const value = this.alphabet.indexOf(cleanInput.charAt(i));
        if (value < 0) {
          throw new Error("Invalid Base32 character: " + cleanInput.charAt(i));
        }

        buffer = OpCodes.Or32(OpCodes.Shl32(buffer, 5), value);
        bufferBits += 5;

        if (bufferBits >= 8) {
          result.push(OpCodes.And32(OpCodes.Shr32(buffer, bufferBits - 8), 255));
          bufferBits -= 8;
        }
      }

      return result;
    }

    // Utility methods

    /**
     * Encode a string (one byte per character) as Base32 text
     * @param {string} str - Input text
     * @returns {string} Base32 text
     */
    encodeString(str) {
      /** @type {uint8[]} */
      const bytes = OpCodes.AnsiToBytes(str);
      /** @type {uint8[]} */
      const encoded = this.encode(bytes);
      return OpCodes.BytesToChars(encoded);
    }

    /**
     * Decode Base32 text to a string (one character per byte)
     * @param {string} str - Base32 text
     * @returns {string} Decoded text
     */
    decodeString(str) {
      /** @type {uint8[]} */
      const bytes = OpCodes.AnsiToBytes(str);
      /** @type {uint8[]} */
      const decoded = this.decode(bytes);
      return OpCodes.BytesToChars(decoded);
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new Base32Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Base32Algorithm, Base32Instance };
}));