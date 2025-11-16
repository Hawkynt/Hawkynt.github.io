/*
 * Base62 Encoding Implementation
 * Educational implementation of Base62 encoding for URL shortening and ID generation
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

  class Base62Algorithm extends EncodingAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Base62";
      this.description = "Base62 encoding using 62-character alphabet (A-Z, a-z, 0-9) for URL-safe, compact encoding. Commonly used in URL shortening services like bit.ly and for generating user-friendly database IDs. No padding required.";
      this.inventor = "URL Shortening Industry";
      this.year = 2000;
      this.category = CategoryType.ENCODING;
      this.subCategory = "Base Encoding";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.INTL;

      // Documentation and references
      this.documentation = [
        new LinkItem("Base62 Wikipedia Article", "https://en.wikipedia.org/wiki/Base62"),
        new LinkItem("URL Shortening Best Practices", "https://developers.google.com/url-shortener/v1/getting_started"),
        new LinkItem("RFC 4648 - Base Encodings Background", "https://tools.ietf.org/html/rfc4648")
      ];

      this.references = [
        new LinkItem("Base62 Online Encoder/Decoder", "https://base62.io/"),
        new LinkItem("Instagram Engineering - Sharding IDs", "https://instagram-engineering.com/sharding-ids-at-instagram-1cf5a71e5a5c"),
        new LinkItem("System Design - URL Shortener", "https://www.educative.io/courses/grokking-the-system-design-interview/m2ygV4E81AR")
      ];

      this.knownVulnerabilities = [];

      // Test vectors with bit-perfect accuracy - initialize after OpCodes is available
      this.tests = this.createTestVectors();
    }

    createTestVectors() {
      // Ensure OpCodes is available
      if (!global.OpCodes) {
        return [];
      }

      return [
        new TestCase(
          OpCodes.AnsiToBytes(""),
          OpCodes.AnsiToBytes(""),
          "Base62 empty string test",
          "https://en.wikipedia.org/wiki/Base62"
        ),
        new TestCase(
          [0],
          OpCodes.AnsiToBytes("A"),
          "Base62 zero byte test - maps to first alphabet character",
          "https://en.wikipedia.org/wiki/Base62"
        ),
        new TestCase(
          [255],
          OpCodes.AnsiToBytes("EH"),
          "Base62 maximum byte test - 255 in Base62",
          "https://en.wikipedia.org/wiki/Base62"
        ),
        new TestCase(
          [72],
          OpCodes.AnsiToBytes("BK"),
          "Base62 single byte - 72 ('H' ASCII)",
          "https://en.wikipedia.org/wiki/Base62"
        ),
        new TestCase(
          [1, 2, 3],
          OpCodes.AnsiToBytes("RLV"),
          "Base62 three byte array test",
          "https://en.wikipedia.org/wiki/Base62"
        ),
        new TestCase(
          [0, 1],
          OpCodes.AnsiToBytes("AB"),
          "Base62 leading zero byte test",
          "https://en.wikipedia.org/wiki/Base62"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Base62Instance(this, isInverse);
    }
  }

  /**
 * Base62 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Base62Instance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.alphabet = OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789");
      this.base = 62;
      this.processedData = null;

      // Create decode lookup table
      this.decodeTable = {};
      const alphabetStr = String.fromCharCode(...this.alphabet);
      for (let i = 0; i < alphabetStr.length; i++) {
        this.decodeTable[alphabetStr[i]] = i;
      }
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('Base62Instance.Feed: Input must be byte array');
      }

      if (this.isInverse) {
        this.processedData = this.decode(data);
      } else {
        this.processedData = this.encode(data);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.processedData === null) {
        throw new Error('Base62Instance.Result: No data processed. Call Feed() first.');
      }
      return this.processedData;
    }

    encode(data) {
      if (data.length === 0) {
        return [];
      }

      // Convert byte array to big integer
      let num = 0n;
      for (let i = 0; i < data.length; i++) {
        num = num * 256n + BigInt(data[i]);
      }

      // Handle zero case
      if (num === 0n) {
        return [this.alphabet[0]];
      }

      // Convert to base62
      const alphabetStr = String.fromCharCode(...this.alphabet);
      const result = [];
      const base = BigInt(this.base);

      while (num > 0n) {
        const remainder = Number(num % base);
        result.unshift(alphabetStr.charCodeAt(remainder));
        num = num / base;
      }

      // Handle leading zero bytes
      let leadingZeros = 0;
      for (let i = 0; i < data.length && data[i] === 0; i++) {
        leadingZeros++;
      }

      // Add leading 'A' characters for leading zero bytes
      const leadingChars = new Array(leadingZeros).fill(this.alphabet[0]);
      return leadingChars.concat(result);
    }

    decode(data) {
      if (data.length === 0) {
        return [];
      }

      const input = String.fromCharCode(...data);

      // Validate input contains only Base62 characters
      for (let i = 0; i < input.length; i++) {
        if (!(input[i] in this.decodeTable)) {
          throw new Error(`Base62Instance.decode: Invalid character '${input[i]}'`);
        }
      }

      // Count leading 'A' characters (representing zero bytes)
      let leadingZeros = 0;
      const alphabetStr = String.fromCharCode(...this.alphabet);
      for (let i = 0; i < input.length && input[i] === alphabetStr[0]; i++) {
        leadingZeros++;
      }

      // Convert Base62 to big integer
      let num = 0n;
      const base = BigInt(this.base);
      for (let i = leadingZeros; i < input.length; i++) {
        const value = this.decodeTable[input[i]];
        num = num * base + BigInt(value);
      }

      // Convert big integer to bytes
      const bytes = [];
      while (num > 0n) {
        bytes.unshift(Number(num % 256n));
        num = num / 256n;
      }

      // Add leading zero bytes
      for (let i = 0; i < leadingZeros; i++) {
        bytes.unshift(0);
      }

      return bytes.length > 0 ? bytes : [0];
    }

    // Utility methods for number encoding (common use case for URL shortening)
    encodeNumber(num) {
      if (num === 0) {
        return String.fromCharCode(this.alphabet[0]);
      }

      const alphabetStr = String.fromCharCode(...this.alphabet);
      let result = "";
      let n = num;

      while (n > 0) {
        result = alphabetStr[n % this.base] + result;
        n = Math.floor(n / this.base);
      }

      return result;
    }

    decodeNumber(encoded) {
      if (!encoded || encoded.length === 0) {
        return 0;
      }

      let num = 0;
      for (let i = 0; i < encoded.length; i++) {
        const value = this.decodeTable[encoded[i]];
        if (value === undefined) {
          throw new Error(`Base62Instance.decodeNumber: Invalid character '${encoded[i]}'`);
        }
        num = num * this.base + value;
      }

      return num;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new Base62Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Base62Algorithm, Base62Instance };
}));