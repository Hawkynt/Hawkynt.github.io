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

        result.push(char1.charCodeAt(0));
        result.push(char2.charCodeAt(0));
        result.push(char3.charCodeAt(0));
        result.push(char4.charCodeAt(0));
      }

      return result;
    }

    decode(data) {
      if (data.length === 0) {
        return [];
      }

      const encoded = String.fromCharCode(...data);

      // XXencode requires input length to be multiple of 4 characters
      if (encoded.length % 4 !== 0) {
        throw new Error('XXencode: Invalid encoded length (must be multiple of 4)');
      }

      const result = [];

      for (let i = 0; i < encoded.length; i += 4) {
        // Convert 4 characters to values
        const val1 = this.algorithm.decodeTable[encoded[i]];
        const val2 = this.algorithm.decodeTable[encoded[i + 1]];
        const val3 = this.algorithm.decodeTable[encoded[i + 2]];
        const val4 = this.algorithm.decodeTable[encoded[i + 3]];

        if (val1 === undefined || val2 === undefined || 
            val3 === undefined || val4 === undefined) {
          throw new Error('XXencode: Invalid character in encoded data');
        }

        // Reconstruct 24-bit value
        const packed = OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(OpCodes.Shl32(val1, 18), OpCodes.Shl32(val2, 12)), OpCodes.Shl32(val3, 6)), val4);

        // Unpack to 3 bytes
        result.push(OpCodes.AndN(OpCodes.Shr32(packed, 16), 0xFF));
        result.push(OpCodes.AndN(OpCodes.Shr32(packed, 8), 0xFF));
        result.push(OpCodes.AndN(packed, 0xFF));
      }

      // Remove trailing zeros (simple padding removal for educational purposes)
      while (result.length > 0 && result[result.length - 1] === 0) {
        result.pop();
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