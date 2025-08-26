/*
 * ROT Encoding Implementation (ROT13/ROT47)
 * Educational implementation of ROT (rotate) character substitution
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

  class ROTAlgorithm extends EncodingAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ROT";
      this.description = "ROT (rotate) character substitution cipher that shifts characters by a fixed offset. ROT13 shifts letters by 13 positions, ROT47 shifts printable ASCII by 47. Self-inverting cipher for educational purposes.";
      this.inventor = "Unknown (folklore origin)";
      this.year = 1980;
      this.category = CategoryType.ENCODING;
      this.subCategory = "Character Substitution";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.INTL;

      // Documentation and references
      this.documentation = [
        new LinkItem("ROT13 - Wikipedia", "https://en.wikipedia.org/wiki/ROT13"),
        new LinkItem("Caesar Cipher Family", "https://en.wikipedia.org/wiki/Caesar_cipher"),
        new LinkItem("RFC 1036 - Usenet ROT13", "https://tools.ietf.org/html/rfc1036#section-5.2")
      ];

      this.references = [
        new LinkItem("UNIX tr Command", "https://www.gnu.org/software/coreutils/manual/html_node/tr-invocation.html"),
        new LinkItem("Python ROT13 Codec", "https://docs.python.org/3/library/codecs.html#text-encodings"),
        new LinkItem("ROT47 Specification", "https://en.wikipedia.org/wiki/ROT13#Variants")
      ];

      this.knownVulnerabilities = [
        "Provides no cryptographic security",
        "Trivially broken by frequency analysis", 
        "Preserves word boundaries and punctuation",
        "Educational use only - not for actual data protection"
      ];

      // Test vectors for ROT13 (most common variant)
      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes(""),
          OpCodes.AnsiToBytes(""),
          "ROT13 empty string test",
          "https://en.wikipedia.org/wiki/ROT13"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("A"),
          OpCodes.AnsiToBytes("N"),
          "ROT13 single uppercase letter test",
          "https://en.wikipedia.org/wiki/ROT13"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("a"),
          OpCodes.AnsiToBytes("n"),
          "ROT13 single lowercase letter test", 
          "https://en.wikipedia.org/wiki/ROT13"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("HELLO"),
          OpCodes.AnsiToBytes("URYYB"),
          "ROT13 uppercase word test",
          "https://en.wikipedia.org/wiki/ROT13"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("hello"),
          OpCodes.AnsiToBytes("uryyb"),
          "ROT13 lowercase word test",
          "https://en.wikipedia.org/wiki/ROT13"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("Hello, World!"),
          OpCodes.AnsiToBytes("Uryyb, Jbeyq!"),
          "ROT13 mixed case with punctuation test",
          "https://en.wikipedia.org/wiki/ROT13"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog."),
          OpCodes.AnsiToBytes("Gur dhvpx oebja sbk whzcf bire gur ynml qbt."),
          "ROT13 pangram test",
          "https://en.wikipedia.org/wiki/ROT13"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new ROTInstance(this, isInverse);
    }
  }

  class ROTInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.processedData = null;
      // ROT13 is self-inverting, so isInverse doesn't change behavior
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('ROTInstance.Feed: Input must be byte array');
      }

      // ROT13 is self-inverting, so encode and decode are the same operation
      this.processedData = this.rot13(data);
    }

    Result() {
      if (this.processedData === null) {
        throw new Error('ROTInstance.Result: No data processed. Call Feed() first.');
      }
      return this.processedData;
    }

    rot13(data) {
      if (data.length === 0) {
        return [];
      }

      const result = [];

      for (let i = 0; i < data.length; i++) {
        const byte = data[i];
        let transformed = byte;

        // Handle uppercase letters (A-Z)
        if (byte >= 65 && byte <= 90) {
          transformed = ((byte - 65 + 13) % 26) + 65;
        }
        // Handle lowercase letters (a-z)  
        else if (byte >= 97 && byte <= 122) {
          transformed = ((byte - 97 + 13) % 26) + 97;
        }
        // Non-alphabetic characters remain unchanged

        result.push(transformed);
      }

      return result;
    }

    // ROT47 variant for printable ASCII (33-126)
    rot47(data) {
      if (data.length === 0) {
        return [];
      }

      const result = [];

      for (let i = 0; i < data.length; i++) {
        const byte = data[i];
        let transformed = byte;

        // Handle printable ASCII characters (33-126)
        if (byte >= 33 && byte <= 126) {
          transformed = ((byte - 33 + 47) % 94) + 33;
        }
        // Non-printable characters remain unchanged

        result.push(transformed);
      }

      return result;
    }

    // Utility methods
    encodeString(str) {
      const bytes = OpCodes.AnsiToBytes(str);
      const encoded = this.rot13(bytes);
      return String.fromCharCode(...encoded);
    }

    decodeString(str) {
      // ROT13 is self-inverting
      return this.encodeString(str);
    }

    // ROT47 utility methods
    rot47EncodeString(str) {
      const bytes = OpCodes.AnsiToBytes(str);
      const encoded = this.rot47(bytes);
      return String.fromCharCode(...encoded);
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new ROTAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ROTAlgorithm, ROTInstance };
}));