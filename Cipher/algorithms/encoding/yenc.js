/*
 * yEnc (yEncoding) Implementation
 * Educational implementation of yEncoding binary-to-text encoding for Usenet
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

  class YEncAlgorithm extends EncodingAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "yEnc (Usenet Binary Encoding)";
      this.description = "Binary-to-text encoding scheme developed by Jürgen Helbing for Usenet newsgroup postings. More efficient than UUEncoding and Base64 for binary data transmission over 8-bit clean channels, achieving only ~2% overhead. Educational implementation following yEnc specification 1.2.";
      this.inventor = "Jürgen Helbing";
      this.year = 2001;
      this.category = CategoryType.ENCODING;
      this.subCategory = "Binary-to-Text Encoding";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.DE;

      // Documentation and references
      this.documentation = [
        new LinkItem("yEnc Specification 1.2", "http://www.yenc.org/yenc-draft.1.2.txt"),
        new LinkItem("yEnc Efficiency Analysis", "http://www.yenc.org/efficiency.html"),
        new LinkItem("Usenet Binary Encoding Standards", "https://tools.ietf.org/html/rfc1036")
      ];

      this.references = [
        new LinkItem("yEnc.org - Original Implementation", "http://www.yenc.org/"),
        new LinkItem("Usenet Binary Tools", "https://github.com/topics/usenet"),
        new LinkItem("Binary Encoding Comparison Study", "https://www.researchgate.net/publication/binary-encoding-efficiency")
      ];

      this.knownVulnerabilities = [];

      // Test vectors from yEnc specification
      this.tests = [
        new TestCase(
          [],
          [],
          "yEnc empty data test",
          "http://www.yenc.org/yenc-draft.1.2.txt"
        ),
        new TestCase(
          [65], // 'A'
          [107], // (65 + 42) % 256 = 107
          "Single byte encoding test - yEnc",
          "http://www.yenc.org/yenc-draft.1.2.txt"
        ),
        new TestCase(
          [0], // NULL byte - needs escaping
          [0x3D, 106], // escape + (0+42+64)%256 = escape + 106
          "NULL byte escaping test - yEnc",
          "http://www.yenc.org/yenc-draft.1.2.txt"
        )
      ];

      // yEnc constants per specification
      /** @type {uint8} */
      this.ESCAPE_CHAR = 0x3D;        // '=' character for escaping
      /** @type {uint8} */
      this.OFFSET = 42;               // Offset value added to each byte
      /** @type {uint8[]} */
      this.CRITICAL_CHARS = [0x00, 0x0A, 0x0D, 0x3D]; // NULL, LF, CR, =
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {YEncInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new YEncInstance(this, isInverse);
    }
  }

  /**
 * YEnc cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class YEncInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {YEncAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this.processedData = null;
      /** @type {uint8[]|null} */
      this._feedBuffer = null;
      /** @type {uint8} */
      this.escapeChar = algorithm.ESCAPE_CHAR;
      /** @type {uint8} */
      this.offset = algorithm.OFFSET;
      /** @type {uint8[]} */
      this.criticalChars = algorithm.CRITICAL_CHARS;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('YEncInstance.Feed: Input must be byte array');
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
        throw new Error('YEncInstance.Result: No data processed. Call Feed() first.');
      }
      if (this.isInverse) {
        this.processedData = this.decode(this._feedBuffer);
      } else {
        this.processedData = this.encode(this._feedBuffer);
      }
      return this.processedData;
    }

    /**
     * yEnc-encode bytes (no line framing)
     * @param {uint8[]} data - Input bytes
     * @returns {uint8[]} Encoded bytes
     */
    encode(data) {
      /** @type {uint8[]} */
      const encoded = [];
      if (data.length === 0) {
        return encoded;
      }

      for (let i = 0; i < data.length; i++) {
        /** @type {uint8} */
        const originalByte = data[i];
        /** @type {uint8} */
        let encodedByte = OpCodes.And32(OpCodes.Add32(originalByte, this.offset), 255);

        // Check if the original byte or encoded byte needs escaping
        if (this.needsEscaping(originalByte) || this.needsEscaping(encodedByte)) {
          encoded.push(this.escapeChar);
          encodedByte = OpCodes.And32(OpCodes.Add32(encodedByte, 64), 255);
        }

        encoded.push(encodedByte);
      }

      return encoded;
    }

    /**
     * Decode yEnc bytes (no line framing)
     * @param {uint8[]} data - Encoded bytes
     * @returns {uint8[]} Decoded bytes
     */
    decode(data) {
      /** @type {uint8[]} */
      const decoded = [];
      if (data.length === 0) {
        return decoded;
      }

      /** @type {int32} */
      let i = 0;

      while (i < data.length) {
        /** @type {uint8} */
        let byte = data[i];

        if (byte === this.escapeChar && i + 1 < data.length) {
          // Escaped character
          i++;
          byte = OpCodes.And32(OpCodes.Sub32(data[i], 64 + this.offset), 255);
        } else {
          // Normal character
          byte = OpCodes.And32(OpCodes.Sub32(byte, this.offset), 255);
        }

        decoded.push(byte);
        i++;
      }

      return decoded;
    }

    /**
     * Whether a byte is one of the critical characters
     * @param {uint8} byte - Byte value
     * @returns {boolean} True when it must be escaped
     */
    needsEscaping(byte) {
      return this.criticalChars.indexOf(byte) >= 0;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new YEncAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { YEncAlgorithm, YEncInstance };
}));