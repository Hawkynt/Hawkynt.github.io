/*
 * BinHex 4.0 Encoding Implementation
 * Educational implementation of BinHex 4.0 (Macintosh binary encoding)
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
      /** @type {string} */
      this.alphabet = "!\"#$%&'()*+,-012345689@ABCDEFGHIJKLMNPQRSTUVXYZ[`abcdefhijklmpqr";

      /** @type {int32[]|null} */
      this.decodeTable = null;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {BinHexInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new BinHexInstance(this, isInverse);
    }

    /**
     * Build the decode lookup table: the 6-bit value of each character code,
     * or -1 for a character outside the alphabet
     */
    init() {
      /** @type {int32[]} */
      const table = new Array(256);
      for (let i = 0; i < 256; i++) {
        table[i] = -1;
      }
      for (let i = 0; i < this.alphabet.length; i++) {
        table[this.alphabet.charCodeAt(i)] = i;
      }
      this.decodeTable = table;
    }
  }

  /**
 * BinHex cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class BinHexInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {BinHexAlgorithm} algorithm - Parent algorithm instance
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

      algorithm.init();
      /** @type {string} */
      this.alphabet = algorithm.alphabet;
      /** @type {int32[]} */
      this.decodeTable = algorithm.decodeTable;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('BinHexInstance.Feed: Input must be byte array');
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
        throw new Error('BinHexInstance.Result: No data processed. Call Feed() first.');
      }
      if (this.isInverse) {
        this.processedData = this.decode(this._feedBuffer);
      } else {
        this.processedData = this.encode(this._feedBuffer);
      }
      return this.processedData;
    }

    /**
     * Wrap bytes in BinHex-style text
     * @param {uint8[]} data - Input bytes
     * @returns {uint8[]} ASCII text
     */
    encode(data) {
      /** @type {string} */
      let result = "(This file must be converted with BinHex 4.0)\n:";

      if (data.length > 0) {
        // Simple BinHex-style encoding (simplified for educational purposes)
        /** @type {string} */
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
      /** @type {uint8[]} */
      const resultBytes = [];
      for (let i = 0; i < result.length; i++) {
        resultBytes.push(result.charCodeAt(i));
      }
      return resultBytes;
    }

    /**
     * Extract the bytes of BinHex-style text
     * @param {uint8[]} data - ASCII text
     * @returns {uint8[]} Decoded bytes
     */
    decode(data) {
      /** @type {string} */
      const binhexText = OpCodes.BytesToChars(data);

      // Extract content between colons
      /** @type {string[]} */
      const lines = binhexText.split('\n');
      /** @type {string} */
      let content = '';

      for (let i = 1; i < lines.length - 1; i++) { // Skip first and last line
        /** @type {string} */
        const line = lines[i];
        if (line.startsWith(':')) {
          content += line.substring(1);
        }
      }

      if (content.length === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      // Decode BinHex content
      return this.decodeBinHex(content);
    }

    /**
     * Six-bit groups of some bytes, spelled in the BinHex alphabet
     * @param {uint8[]} data - Input bytes
     * @returns {string} Encoded text
     */
    encodeBinHex(data) {
      if (data.length === 0) {
        return "";
      }

      /** @type {string} */
      let result = "";

      // Process in groups of 3 bytes (similar to Base64 but using BinHex alphabet)
      for (let i = 0; i < data.length; i += 3) {
        /** @type {uint8} */
        const byte1 = data[i];
        /** @type {uint8} */
        const byte2 = i + 1 < data.length ? data[i + 1] : 0;
        /** @type {uint8} */
        const byte3 = i + 2 < data.length ? data[i + 2] : 0;

        // Pack 3 bytes into 24-bit value
        /** @type {uint32} */
        const packed = OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(byte1, 16), OpCodes.Shl32(byte2, 8)), byte3);

        // Convert to 4 base-64 characters using BinHex alphabet
        /** @type {string} */
        const char4 = this.alphabet.charAt(OpCodes.And32(packed, 0x3F));
        /** @type {string} */
        const char3 = this.alphabet.charAt(OpCodes.And32(OpCodes.Shr32(packed, 6), 0x3F));
        /** @type {string} */
        const char2 = this.alphabet.charAt(OpCodes.And32(OpCodes.Shr32(packed, 12), 0x3F));
        /** @type {string} */
        const char1 = this.alphabet.charAt(OpCodes.And32(OpCodes.Shr32(packed, 18), 0x3F));

        result += char1 + char2 + char3 + char4;
      }

      return result;
    }

    /**
     * Value of a BinHex character; anything outside the alphabet counts as 0
     * @param {string} text - Text
     * @param {int32} index - Position of the character
     * @returns {int32} Its 6-bit value
     */
    charValue(text, index) {
      /** @type {int32} */
      const code = text.charCodeAt(index);
      if (code >= 256) {
        return 0;
      }
      /** @type {int32} */
      const value = this.decodeTable[code];
      return value < 0 ? 0 : value;
    }

    /**
     * Bytes of BinHex-style text
     * @param {string} input - Encoded text
     * @returns {uint8[]} Decoded bytes
     */
    decodeBinHex(input) {
      /** @type {uint8[]} */
      const result = [];
      if (input.length === 0) {
        return result;
      }

      // BinHex requires input length to be multiple of 4 characters
      /** @type {string} */
      let text = input;
      if (text.length % 4 !== 0) {
        // Pad with first character of alphabet for simplicity
        while (text.length % 4 !== 0) {
          text += this.alphabet.charAt(0);
        }
      }

      for (let i = 0; i < text.length; i += 4) {
        // Convert 4 characters to values
        /** @type {int32} */
        const val1 = this.charValue(text, i);
        /** @type {int32} */
        const val2 = this.charValue(text, i + 1);
        /** @type {int32} */
        const val3 = this.charValue(text, i + 2);
        /** @type {int32} */
        const val4 = this.charValue(text, i + 3);

        // Reconstruct 24-bit value
        /** @type {uint32} */
        const packed = OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(val1, 18), OpCodes.Shl32(val2, 12)), OpCodes.Shl32(val3, 6)), val4);

        // Unpack to 3 bytes
        result.push(OpCodes.And32(OpCodes.Shr32(packed, 16), 0xFF));
        result.push(OpCodes.And32(OpCodes.Shr32(packed, 8), 0xFF));
        result.push(OpCodes.And32(packed, 0xFF));
      }

      // Simple padding removal
      while (result.length > 0 && result[result.length - 1] === 0) {
        result.pop();
      }

      return result;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new BinHexAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BinHexAlgorithm, BinHexInstance };
}));