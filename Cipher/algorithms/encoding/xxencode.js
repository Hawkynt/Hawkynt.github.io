/*
 * XXencoding Implementation
 * Educational implementation of XXencoding (alternative to UUencoding)
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

  class XXEncodeAlgorithm extends EncodingAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "XXencoding";
      this.description = "Binary-to-text encoding similar to UUencoding but uses a different character set designed to avoid problematic characters in some communication systems. Alternative encoding method for transmitting binary data over text-based protocols. Educational implementation for learning purposes.";
      this.inventor = "Unix Community";
      this.year = 1980;
      this.category = CategoryType.ENCODING;
      this.subCategory = "Mail Encoding";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("XXencode Specification", "https://en.wikipedia.org/wiki/Xxencoding"),
        new LinkItem("UUencoding Alternatives", "https://tools.ietf.org/html/rfc1341"),
        new LinkItem("Binary Encoding History", "https://www.unix.org/what_is_unix/history_timeline.html")
      ];

      this.references = [
        new LinkItem("Unix Mail Systems", "https://tools.ietf.org/html/rfc822"),
        new LinkItem("Text-based Binary Transfer", "https://www.ietf.org/rfc/rfc2045.txt"),
        new LinkItem("Character Set Standards", "https://www.ascii-code.com/")
      ];

      this.knownVulnerabilities = [];

      // Test vectors for XXencoding
      this.tests = [
        new TestCase(
          [],
          [],
          "XXencode empty data test",
          "Educational standard"
        ),
        new TestCase(
          [0, 0, 0], // Three zero bytes -> should encode to "++++", 4 chars
          [43, 43, 43, 43], // "++++", 
          "Basic 3-byte zero test - XXencode",
          "Educational example"
        ),
        new TestCase(
          [1, 2, 3], // Simple test bytes
          [43, 69, 54, 49], // "+E61"
          "Simple pattern encoding test - XXencode",
          "Educational standard"
        ),
        new TestCase(
          [77], // "M" - a lone 1-byte group
          [72, 69], // "HE"
          "XXencode 1-byte group - eight data bits need exactly two 6-bit symbols",
          "https://en.wikipedia.org/wiki/Xxencoding"
        ),
        new TestCase(
          [77, 97], // "Ma" - a lone 2-byte group
          [72, 75, 50], // "HK2"
          "XXencode 2-byte group - sixteen data bits need exactly three 6-bit symbols",
          "https://en.wikipedia.org/wiki/Xxencoding"
        ),
        new TestCase(
          [1, 2, 3, 0], // Full group plus a 1-byte tail that is itself a NUL
          [43, 69, 54, 49, 43, 43], // "+E61++"
          "XXencode trailing NUL regression test - the old decoder stripped trailing zero bytes as if they were padding, so any payload ending in NUL decoded short and could not be re-encoded",
          "https://en.wikipedia.org/wiki/Xxencoding"
        ),
        new TestCase(
          [0, 0, 0, 0, 0], // All-NUL payload with a 2-byte tail
          [43, 43, 43, 43, 43, 43, 43], // "+++++++"
          "XXencode all-NUL payload regression test - the old decoder returned an empty array for any all-zero payload",
          "https://en.wikipedia.org/wiki/Xxencoding"
        )
      ];

      // XXencode alphabet (64 characters) - different from UUencode
      this.alphabet = "+-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

      this.decodeTable = null;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new XXEncodeInstance(this, isInverse);
    }

    init() {
      // Build decode lookup table
      this.decodeTable = {};
      for (let i = 0; i < this.alphabet.length; i++) {
        this.decodeTable[this.alphabet[i]] = i;
      }
    }
  }

  /**
 * XXEncode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class XXEncodeInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.processedData = null;

      this.algorithm.init();
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('XXEncodeInstance.Feed: Input must be byte array');
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
        throw new Error('XXEncodeInstance.Result: No data processed. Call Feed() first.');
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
        const groupSize = Math.min(3, data.length - i);

        const byte1 = data[i];
        const byte2 = i + 1 < data.length ? data[i + 1] : 0;
        const byte3 = i + 2 < data.length ? data[i + 2] : 0;

        // Pack 3 bytes into 24-bit value
        const packed = OpCodes.OrN(OpCodes.OrN(OpCodes.Shl32(byte1, 16), OpCodes.Shl32(byte2, 8)), byte3);

        // Convert to 4 base-64 characters
        const char4 = this.algorithm.alphabet[OpCodes.AndN(packed, 0x3F)];
        const char3 = this.algorithm.alphabet[OpCodes.AndN(OpCodes.Shr32(packed, 6), 0x3F)];
        const char2 = this.algorithm.alphabet[OpCodes.AndN(OpCodes.Shr32(packed, 12), 0x3F)];
        const char1 = this.algorithm.alphabet[OpCodes.AndN(OpCodes.Shr32(packed, 18), 0x3F)];

        // A partial trailing group emits only the characters its data bits
        // actually occupy: 1 byte needs two 6-bit symbols, 2 bytes need three,
        // 3 bytes need four. Emitting a full quartet for a short tail would
        // make the group length the only record of how many bytes were real,
        // and that record is not recoverable on decode.
        result.push(char1.charCodeAt(0));
        result.push(char2.charCodeAt(0));
        if (groupSize >= 2) {
          result.push(char3.charCodeAt(0));
        }
        if (groupSize === 3) {
          result.push(char4.charCodeAt(0));
        }
      }

      return result;
    }

    decode(data) {
      if (data.length === 0) {
        return [];
      }

      const encoded = OpCodes.BytesToChars(data);

      const result = [];

      const lookup = (ch) => {
        const value = this.algorithm.decodeTable[ch];
        if (value === undefined) {
          throw new Error('XXencode: Invalid character in encoded data');
        }
        return value;
      };

      for (let i = 0; i < encoded.length; i += 4) {
        const groupSize = Math.min(4, encoded.length - i);

        // A lone trailing character carries only six bits, which is not enough
        // to have come from any whole byte, so it cannot be a valid encoding.
        if (groupSize === 1) {
          throw new Error('XXencode: Invalid encoded length (trailing single character)');
        }

        if (groupSize === 2) {
          // Two characters carry one byte in their top eight bits
          const packed = OpCodes.OrN(OpCodes.Shl32(lookup(encoded[i]), 6), lookup(encoded[i + 1]));
          result.push(OpCodes.AndN(OpCodes.Shr32(packed, 4), 0xFF));
        } else if (groupSize === 3) {
          // Three characters carry two bytes in their top sixteen bits
          const packed = OpCodes.OrN(OpCodes.OrN(OpCodes.Shl32(lookup(encoded[i]), 12), OpCodes.Shl32(lookup(encoded[i + 1]), 6)), lookup(encoded[i + 2]));
          result.push(OpCodes.AndN(OpCodes.Shr32(packed, 10), 0xFF));
          result.push(OpCodes.AndN(OpCodes.Shr32(packed, 2), 0xFF));
        } else {
          // Four characters carry a full three-byte group
          const packed = OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(OpCodes.Shl32(lookup(encoded[i]), 18), OpCodes.Shl32(lookup(encoded[i + 1]), 12)), OpCodes.Shl32(lookup(encoded[i + 2]), 6)), lookup(encoded[i + 3]));
          result.push(OpCodes.AndN(OpCodes.Shr32(packed, 16), 0xFF));
          result.push(OpCodes.AndN(OpCodes.Shr32(packed, 8), 0xFF));
          result.push(OpCodes.AndN(packed, 0xFF));
        }
      }

      return result;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new XXEncodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { XXEncodeAlgorithm, XXEncodeInstance };
}));