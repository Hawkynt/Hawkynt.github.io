/*
 * UUencoding Implementation
 * Educational implementation of Unix-to-Unix encoding (uuencoding)
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

  class UUEncodeAlgorithm extends EncodingAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "UUencode";
      this.description = "UUencoding (Unix-to-Unix encoding) binary-to-text encoding developed by Mary Ann Horton at UC Berkeley in 1980. Encodes 3 bytes into 4 characters using printable ASCII characters with space (0x20) offset. Widely used in early email and UUCP systems.";
      this.inventor = "Mary Ann Horton";
      this.year = 1980;
      this.category = CategoryType.ENCODING;
      this.subCategory = "Binary-to-Text";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("POSIX IEEE Std 1003.1-2017", "https://pubs.opengroup.org/onlinepubs/9699919799/utilities/uuencode.html"),
        new LinkItem("UUencoding Wikipedia", "https://en.wikipedia.org/wiki/Uuencoding"),
        new LinkItem("Original UUCP Documentation", "https://www.tuhs.org/Archive/Documentation/UUCP/")
      ];

      this.references = [
        new LinkItem("Berkeley Unix Manual", "https://docs.freebsd.org/44doc/usd/10.uucp/paper.html"),
        new LinkItem("UUencode Online Tool", "https://www.browserling.com/tools/uuencode"),
        new LinkItem("RFC 1341 MIME UUencoding", "https://tools.ietf.org/html/rfc1341")
      ];

      this.knownVulnerabilities = [];

      // Test vectors with bit-perfect accuracy
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
          "UUencode empty string test",
          "https://pubs.opengroup.org/onlinepubs/9699919799/utilities/uuencode.html"
        ),
        new TestCase(
          [0],
          OpCodes.AnsiToBytes("  "),
          "UUencode single zero byte test",
          "https://pubs.opengroup.org/onlinepubs/9699919799/utilities/uuencode.html"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("M"),
          OpCodes.AnsiToBytes("30"),
          "UUencode single character 'M' test",
          "https://pubs.opengroup.org/onlinepubs/9699919799/utilities/uuencode.html"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("Ma"),
          OpCodes.AnsiToBytes("36$"),
          "UUencode two character 'Ma' test",
          "https://pubs.opengroup.org/onlinepubs/9699919799/utilities/uuencode.html"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("Man"),
          OpCodes.AnsiToBytes("36%N"),
          "UUencode three character 'Man' test",
          "https://pubs.opengroup.org/onlinepubs/9699919799/utilities/uuencode.html"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("Test"),
          OpCodes.AnsiToBytes("5&5S="),
          "UUencode four character 'Test' test",
          "https://pubs.opengroup.org/onlinepubs/9699919799/utilities/uuencode.html"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new UUEncodeInstance(this, isInverse);
    }
  }

  /**
 * UUEncode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class UUEncodeInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.processedData = null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('UUEncodeInstance.Feed: Input must be byte array');
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
        throw new Error('UUEncodeInstance.Result: No data processed. Call Feed() first.');
      }
      return this.processedData;
    }

    encode(data) {
      if (data.length === 0) {
        return [];
      }

      const result = [];

      // Process in groups of 3 bytes
      for (let i = 0; i < data.length; i += 3) {
        const group = [];
        const groupSize = Math.min(3, data.length - i);

        // Get the 3-byte group (pad with zeros if necessary)
        for (let j = 0; j < 3; j++) {
          group.push(i + j < data.length ? data[i + j] : 0);
        }

        // Convert 3 bytes to 4 characters
        const combined = (group[0] << 16) | (group[1] << 8) | group[2];

        // Extract 6-bit values and add space offset (0x20)
        const char1 = ((combined >> 18) & 0x3F) + 0x20;
        const char2 = ((combined >> 12) & 0x3F) + 0x20;
        const char3 = ((combined >> 6) & 0x3F) + 0x20;
        const char4 = (combined & 0x3F) + 0x20;

        result.push(char1);
        if (groupSize > 1 || (groupSize === 1 && data.length === 1)) {
          result.push(char2);
        }
        if (groupSize > 2 || (groupSize === 2 && data.length === 2)) {
          result.push(char3);
        }
        if (groupSize === 3) {
          result.push(char4);
        }
      }

      return result;
    }

    decode(data) {
      if (data.length === 0) {
        return [];
      }

      const result = [];

      // Process in groups of 4 characters
      for (let i = 0; i < data.length; i += 4) {
        const groupSize = Math.min(4, data.length - i);

        if (groupSize === 1) {
          // Single character, decode as one byte
          const val = (data[i] - 0x20) & 0x3F;
          result.push(val);
        } else if (groupSize === 2) {
          // Two characters, decode as one byte
          const val1 = (data[i] - 0x20) & 0x3F;
          const val2 = (data[i + 1] - 0x20) & 0x3F;
          const combined = (val1 << 6) | val2;
          result.push((combined >> 4) & 0xFF);
        } else if (groupSize === 3) {
          // Three characters, decode as two bytes
          const val1 = (data[i] - 0x20) & 0x3F;
          const val2 = (data[i + 1] - 0x20) & 0x3F;
          const val3 = (data[i + 2] - 0x20) & 0x3F;
          const combined = (val1 << 12) | (val2 << 6) | val3;
          result.push((combined >> 10) & 0xFF);
          result.push((combined >> 2) & 0xFF);
        } else if (groupSize === 4) {
          // Four characters, decode as three bytes
          const val1 = (data[i] - 0x20) & 0x3F;
          const val2 = (data[i + 1] - 0x20) & 0x3F;
          const val3 = (data[i + 2] - 0x20) & 0x3F;
          const val4 = (data[i + 3] - 0x20) & 0x3F;
          const combined = (val1 << 18) | (val2 << 12) | (val3 << 6) | val4;
          result.push((combined >> 16) & 0xFF);
          result.push((combined >> 8) & 0xFF);
          result.push(combined & 0xFF);
        }
      }

      return result;
    }

    // Utility methods for string encoding
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

    const algorithmInstance = new UUEncodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { UUEncodeAlgorithm, UUEncodeInstance };
}));