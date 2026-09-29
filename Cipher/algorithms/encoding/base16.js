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
          OpCodes.AnsiToBytes("f"), // "f"
          [54, 54], // "66"
          "Base16 single character test - RFC 4648",
          "https://tools.ietf.org/html/rfc4648#section-10"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("fo"), // "fo"
          [54, 54, 54, 70], // "666F"
          "Base16 two character test - RFC 4648",
          "https://tools.ietf.org/html/rfc4648#section-10"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("foo"), // "foo"
          [54, 54, 54, 70, 54, 70], // "666F6F"
          "Base16 three character test - RFC 4648",
          "https://tools.ietf.org/html/rfc4648#section-10"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("foob"), // "foob"
          [54, 54, 54, 70, 54, 70, 54, 50], // "666F6F62"
          "Base16 four character test - RFC 4648",
          "https://tools.ietf.org/html/rfc4648#section-10"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("fooba"), // "fooba"
          [54, 54, 54, 70, 54, 70, 54, 50, 54, 49], // "666F6F6261"
          "Base16 five character test - RFC 4648",
          "https://tools.ietf.org/html/rfc4648#section-10"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("foobar"), // "foobar"
          [54, 54, 54, 70, 54, 70, 54, 50, 54, 49, 55, 50], // "666F6F626172"
          "Base16 six character test - RFC 4648",
          "https://tools.ietf.org/html/rfc4648#section-10"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Base16Instance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Base16Instance(this, isInverse);
    }
  }

  /**
 * Base16 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Base16Instance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Base16Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      // Use OpCodes for alphabet definition
      /** @type {uint8[]} */
      this.alphabetBytes = OpCodes.AnsiToBytes("0123456789ABCDEF");
      /** @type {string} */
      this.alphabet = "0123456789ABCDEF";
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
        throw new Error('Base16Instance.Feed: Input must be byte array');
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
        throw new Error('Base16Instance.Result: No data processed. Call Feed() first.');
      }
      if (this.isInverse) {
        this.processedData = this.decode(this._feedBuffer);
      } else {
        this.processedData = this.encode(this._feedBuffer);
      }
      return this.processedData;
    }

    /**
     * Encode bytes as uppercase hex digits
     * @param {uint8[]} data - Input bytes
     * @returns {uint8[]} ASCII hex digits
     */
    encode(data) {
      /** @type {uint8[]} */
      const result = [];
      if (data.length === 0) {
        return result;
      }

      for (let i = 0; i < data.length; i++) {
        /** @type {uint8} */
        const byte = data[i];
        // Extract high and low nibbles (4 bits each)
        /** @type {uint32} */
        const high_nibble = OpCodes.And32(OpCodes.Shr32(byte, 4), 0x0F);
        /** @type {uint32} */
        const low_nibble = OpCodes.And32(byte, 0x0F);
        result.push(this.alphabetBytes[high_nibble]);
        result.push(this.alphabetBytes[low_nibble]);
      }

      return result;
    }

    /**
     * Value of a hex digit character code (0-9, A-F or a-f)
     * @param {int32} code - Character code of a hex digit
     * @returns {int32} Its value 0..15
     */
    hexValue(code) {
      if (code <= 57) {
        return code - 48;
      }
      if (code <= 70) {
        return code - 55;
      }
      return code - 87;
    }

    /**
     * Decode hex digits to bytes (case-insensitive, other characters ignored)
     * @param {uint8[]} data - ASCII hex digits
     * @returns {uint8[]} Decoded bytes
     */
    decode(data) {
      /** @type {uint8[]} */
      const result = [];
      if (data.length === 0) {
        return result;
      }

      // Keep only the hex digits: 0-9, A-F, a-f
      /** @type {int32[]} */
      const digits = [];
      for (let i = 0; i < data.length; ++i) {
        /** @type {int32} */
        const code = data[i];
        if ((code >= 48 && code <= 57) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102)) {
          digits.push(this.hexValue(code));
        }
      }

      if (digits.length % 2 !== 0) {
        throw new Error('Base16Instance.decode: Invalid hex string length');
      }

      for (let i = 0; i < digits.length; i += 2) {
        result.push(OpCodes.Or32(OpCodes.Shl32(digits[i], 4), digits[i + 1]));
      }

      return result;
    }

    // Utility methods

    /**
     * Encode a string (one byte per character) as hex text
     * @param {string} str - Input text
     * @returns {string} Hex text
     */
    encodeString(str) {
      /** @type {uint8[]} */
      const bytes = OpCodes.AnsiToBytes(str);
      /** @type {uint8[]} */
      const encoded = this.encode(bytes);
      return OpCodes.BytesToChars(encoded);
    }

    /**
     * Decode hex text to a string (one character per byte)
     * @param {string} str - Hex text
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

    const algorithmInstance = new Base16Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Base16Algorithm, Base16Instance };
}));