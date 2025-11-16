/*
 * Base91 Encoding Implementation
 * Educational implementation of Base91 encoding by Joachim Henke
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

  class Base91Algorithm extends EncodingAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Base91";
      this.description = "Base91 (basE91) encoding using 91-character alphabet for efficient binary-to-text encoding. Achieves only 23% overhead compared to Base64's 33% by using variable-length bit packing. Developed by Joachim Henke for maximum efficiency.";
      this.inventor = "Joachim Henke";
      this.year = 2000;
      this.category = CategoryType.ENCODING;
      this.subCategory = "Base Encoding";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.DE;

      // Documentation and references
      this.documentation = [
        new LinkItem("Base91 Official Site", "http://base91.sourceforge.net/"),
        new LinkItem("Base91 Algorithm Description", "http://base91.sourceforge.net/base91.html"),
        new LinkItem("Base91 Wikipedia Article", "https://en.wikipedia.org/wiki/Base91")
      ];

      this.references = [
        new LinkItem("Base91 Source Code", "http://base91.sourceforge.net/base91.c"),
        new LinkItem("Base91 Online Encoder", "https://base91.io/"),
        new LinkItem("Binary-to-Text Encoding Comparison", "https://en.wikipedia.org/wiki/Binary-to-text_encoding")
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
          "Base91 empty string test",
          "https://github.com/bwaldvogel/base91/blob/main/src/test/java/de/bwaldvogel/base91/Base91Test.java"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("a"),
          OpCodes.AnsiToBytes("GB"),
          "Base91 single character test - 'a'",
          "https://github.com/bwaldvogel/base91/blob/main/src/test/java/de/bwaldvogel/base91/Base91Test.java"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("test"),
          OpCodes.AnsiToBytes("fPNKd"),
          "Base91 word test - 'test'",
          "https://github.com/bwaldvogel/base91/blob/main/src/test/java/de/bwaldvogel/base91/Base91Test.java"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("Never odd or even\n"),
          OpCodes.AnsiToBytes("_O^gp@J`7RztjblLA#_1eHA"),
          "Base91 palindrome test with newline",
          "https://github.com/bwaldvogel/base91/blob/main/src/test/java/de/bwaldvogel/base91/Base91Test.java"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("May a moody baby doom a yam?\n"),
          OpCodes.AnsiToBytes("8D9Kc)=/2$WzeFui#G9Km+<{VT2u9MZil}[A"),
          "Base91 sentence test with newline",
          "https://github.com/bwaldvogel/base91/blob/main/src/test/java/de/bwaldvogel/base91/Base91Test.java"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Base91Instance(this, isInverse);
    }
  }

  /**
 * Base91 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Base91Instance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;

      // Base91 alphabet (91 printable ASCII characters excluding whitespace and quotes)
      this.alphabet = OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~");
      this.base = 91;
      this.processedData = null;

      // Create decode lookup table
      this.decodeTable = {};
      const alphabetStr = String.fromCharCode(...this.alphabet);
      for (let i = 0; i < alphabetStr.length; i++) {
        this.decodeTable[alphabetStr[i]] = i;
      }

      // Initialize encoder/decoder state
      this.resetState();
    }

    resetState() {
      // Encoder state
      this.ebq = 0;      // Bit queue
      this.en = 0;       // Number of bits in queue

      // Decoder state
      this.dq = 0;       // Decode queue
      this.dn = 0;       // Number of bits
      this.dv = -1;      // Decode value
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('Base91Instance.Feed: Input must be byte array');
      }

      this.resetState();

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
        throw new Error('Base91Instance.Result: No data processed. Call Feed() first.');
      }
      return this.processedData;
    }

    encode(data) {
      if (data.length === 0) {
        return [];
      }

      const result = [];
      const alphabetStr = String.fromCharCode(...this.alphabet);

      for (let i = 0; i < data.length; i++) {
        this.ebq |= (data[i] & 255) << this.en;
        this.en += 8;

        if (this.en > 13) {
          let ev = this.ebq & 8191;

          if (ev > 88) {
            this.ebq >>= 13;
            this.en -= 13;
          } else {
            ev = this.ebq & 16383;
            this.ebq >>= 14;
            this.en -= 14;
          }

          const idx1 = ev % 91;
          const idx2 = Math.floor(ev / 91);
          result.push(alphabetStr.charCodeAt(idx1));
          result.push(alphabetStr.charCodeAt(idx2));
        }
      }

      // Encode remaining bits
      if (this.en > 0) {
        result.push(alphabetStr.charCodeAt(this.ebq % 91));

        if (this.en > 7 || this.ebq > 90) {
          const idx = Math.floor(this.ebq / 91);
          result.push(alphabetStr.charCodeAt(idx));
        }
      }

      return result;
    }

    decode(data) {
      if (data.length === 0) {
        return [];
      }

      const input = String.fromCharCode(...data);
      const result = [];

      for (let i = 0; i < input.length; i++) {
        const c = input[i];

        if (!(c in this.decodeTable)) {
          throw new Error(`Base91Instance.decode: Invalid character '${c}'`);
        }

        const charValue = this.decodeTable[c];

        if (this.dv === -1) {
          this.dv = charValue;
          continue;
        }

        this.dv += charValue * 91;
        this.dq |= (this.dv << this.dn);

        if (this.dv > 88) {
          this.dn += 13;
        } else {
          this.dn += 14;
        }

        this.dv = -1;

        while (this.dn > 7) {
          result.push(this.dq & 255);
          this.dq >>= 8;
          this.dn -= 8;
        }
      }

      if (this.dv >= 0) {
        this.dq |= (this.dv << this.dn);
        if (this.dn > 0) {
          result.push(this.dq & 255);
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

    const algorithmInstance = new Base91Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Base91Algorithm, Base91Instance };
}));