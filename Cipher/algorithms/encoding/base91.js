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
        ),
        new TestCase(
          Array.from({length: 256}, (_, i) => i),
          [58,67,35,40,58,67,63,104,86,66,36,77,83,105,86,69,119,110,100,66,65,77,90,82,120,119,70,102,66,66,59,73,87,60,125,89,81,86,33,65,95,118,36,89,95,99,37,122,114,52,99,89,81,80,70,108,48,44,64,104,101,77,65,74,60,58,78,91,42,84,43,47,83,70,71,114,42,96,98,52,80,68,125,118,103,89,113,85,62,99,87,48,80,42,49,78,119,86,44,79,123,99,81,53,117,48,109,57,48,48,91,56,64,110,52,44,119,104,63,68,80,60,50,43,126,106,81,83,87,54,110,109,76,109,49,111,46,74,44,63,106,84,115,37,50,60,87,70,37,113,98,61,111,104,124,125,46,67,43,87,96,69,73,33,98,118,34,88,74,53,75,73,86,60,71,43,97,88,93,99,91,122,36,56,41,64,97,82,54,55,103,98,55,112,40,96,114,52,107,72,106,79,114,97,69,114,56,58,65,56,121,48,71,57,75,115,68,109,55,106,112,97,123,102,104,62,104,84,56,37,59,64,33,57,59,115,62,74,88,63,35,71,84,60,87,43,118,98,102,96,65,50,97,94,119,107,70,90,67,114,60,58,86,36,125,83,82,35,35,38,60,94,108,114,60,74,110,63,95,75,53,113,104,46,74,121,76,112,43,57,57,38,66,95,54,118,90,38,120,91,117,104,110,125,76,64,115,104,51,125,103,95,95,126,35],
          "Base91 all 256 byte values regression test - exercises the 91st alphabet symbol (double quote)",
          "https://github.com/bwaldvogel/base91/blob/main/src/main/java/de/bwaldvogel/base91/Base91OutputStream.java"
        ),
        new TestCase(
          [97,77,19,248,160,96,190,166,178,137,44,193,38,99,200,67,70,76,191,232,31,94,253,46,125,118,46,79,236,47,189,72,183,231,216,213,235,184,104,113,84,127,28,90,125,215,95,138,180,30,92,189,3,110,0,113,54,164,246,224,219,91,172,7,60,241,76,162,102,128,195,44,37,229,189,226,5,187,165,192,81,96,168,130,22,238,178,164,32,66,111,97,250,247,74,182,242,106,112,95,18,184,205,215,38,186,13,91,188,15,155,231,30,17,164,55,89,222,20,199,57,79,151,210,74,3,153,85],
          [54,108,35,66,82,88,91,64,99,100,54,78,84,78,53,78,50,88,125,121,54,49,84,120,51,70,100,123,100,54,56,112,36,113,97,125,67,114,126,111,40,111,38,101,104,75,59,107,117,53,82,76,105,35,77,113,61,81,93,47,103,117,49,38,109,110,120,87,97,109,104,108,122,95,81,110,102,123,74,86,108,107,90,55,98,34,93,106,43,90,119,114,75,104,91,61,95,34,46,66,51,100,56,102,125,103,94,53,126,70,97,103,71,123,36,57,69,103,108,56,36,94,112,71,50,109,126,35,91,111,82,33,76,62,70,109,35,61,66,71,117,38,61,48,57,79,66,51,96,54,78,97,69,108,47,49,96,65],
          "Base91 pseudo-random 128-byte regression test - exercises the decode bit-queue-length branch for a decode value above the 13-bit mask (8191)",
          "https://github.com/bwaldvogel/base91/blob/main/src/main/java/de/bwaldvogel/base91/Base91.java"
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

      // Base91 alphabet (91 printable ASCII characters excluding space and the
      // single quote/apostrophe). The canonical basE91 table (Joachim Henke's
      // reference implementation) ends with a double quote as its 91st
      // symbol - omitting it (as this array previously did, leaving only 90
      // entries) means the encoder's highest digit value has no character to
      // map to, producing an out-of-range array read that silently becomes
      // NaN and corrupts the output stream.
      this.alphabet = OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~\"");
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
        this.ebq = OpCodes.OrN(this.ebq, OpCodes.Shl32(OpCodes.AndN(data[i], 255), this.en));
        this.en += 8;

        if (this.en > 13) {
          let ev = OpCodes.AndN(this.ebq, 8191);

          if (ev > 88) {
            this.ebq = OpCodes.Shr32(this.ebq, 13);
            this.en -= 13;
          } else {
            ev = OpCodes.AndN(this.ebq, 16383);
            this.ebq = OpCodes.Shr32(this.ebq, 14);
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
        this.dq = OpCodes.OrN(this.dq, OpCodes.Shl32(this.dv, this.dn));

        // Must branch on the low 13 bits of dv, not dv itself: dv ranges up
        // to 8280 (90 + 90*91), which can exceed the 8191 (13-bit) mask
        // encode() used to pick this same branch. Comparing raw dv against
        // 88 disagrees with encode()'s "AND ebq with 8191, then compare to
        // 88" test whenever dv exceeds 8191, desynchronizing the bit queue
        // length and corrupting every byte decoded from that point on.
        if (OpCodes.And32(this.dv, 8191) > 88) {
          this.dn += 13;
        } else {
          this.dn += 14;
        }

        this.dv = -1;

        while (this.dn > 7) {
          result.push(OpCodes.AndN(this.dq, 255));
          this.dq = OpCodes.Shr32(this.dq, 8);
          this.dn -= 8;
        }
      }

      if (this.dv >= 0) {
        this.dq = OpCodes.OrN(this.dq, OpCodes.Shl32(this.dv, this.dn));
        if (this.dn > 0) {
          result.push(OpCodes.AndN(this.dq, 255));
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