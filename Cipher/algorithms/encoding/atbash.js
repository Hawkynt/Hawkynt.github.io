/*
 * Atbash Cipher Implementation
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

  class AtbashCipher extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Atbash Cipher";
      this.description = "Ancient Hebrew substitution cipher that reverses the alphabet. Maps each letter to its opposite position (A↔Z, B↔Y, etc.). Simple monoalphabetic substitution cipher with fixed key that is its own inverse.";
      this.inventor = "Ancient Hebrew scholars";
      this.year = -500;
      this.category = CategoryType.ENCODING;
      this.subCategory = "Text Encoding";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.IL;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Atbash"),
        new LinkItem("Biblical Usage", "https://en.wikipedia.org/wiki/Hebrew_alphabet"),
        new LinkItem("Historical Context", "https://www.britannica.com/topic/cryptology/Early-cryptographic-systems")
      ];

      this.references = [
        new LinkItem("DCode Implementation", "https://www.dcode.fr/atbash-cipher"),
        new LinkItem("Educational Tutorial", "https://cryptii.com/pipes/atbash-cipher"),
        new LinkItem("Bible Code Examples", "https://www.bible-codes.org/Atbash.htm")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Frequency Analysis",
          "Simple substitution cipher vulnerable to frequency analysis - letter frequencies preserved",
          "Educational use only - easily broken by frequency analysis",
          "https://en.wikipedia.org/wiki/Frequency_analysis"
        ),
        new Vulnerability(
          "Pattern Recognition",
          "Fixed transformation pattern makes it vulnerable to pattern recognition attacks",
          "Combine with other techniques or use for educational purposes only",
          "https://en.wikipedia.org/wiki/Substitution_cipher"
        )
      ];

      // Test vectors using byte arrays - bit-perfect results from implementation
      this.tests = [
        {
          text: "Basic Atbash transformation",
          uri: "https://www.dcode.fr/atbash-cipher",
          input: OpCodes.AnsiToBytes("HELLO"),
          key: OpCodes.AnsiToBytes(""),
          expected: OpCodes.AnsiToBytes("SVOOL")
        },
        {
          text: "Full alphabet test",
          uri: "https://en.wikipedia.org/wiki/Atbash",
          input: OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
          key: OpCodes.AnsiToBytes(""),
          expected: OpCodes.AnsiToBytes("ZYXWVUTSRQPONMLKJIHGFEDCBA")
        },
        {
          text: "Mixed case preservation",
          uri: "https://cryptii.com/pipes/atbash-cipher",
          input: OpCodes.AnsiToBytes("Hello World"),
          key: OpCodes.AnsiToBytes(""),
          expected: OpCodes.AnsiToBytes("Svool Dliow")
        }
      ];

      // For the test suite compatibility 
      this.testVectors = this.tests;
    }

    // Create instance for this algorithm
    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {AtbashCipherInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new AtbashCipherInstance(this, isInverse);
    }
  }

  // Instance class - handles the actual encoding/decoding
  /**
 * AtbashCipher cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class AtbashCipherInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {AtbashCipher} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse; // Not used for Atbash as it's self-inverse
      /** @type {uint8[]} */
      this.inputBuffer = [];

      // Character sets
      /** @type {string} */
      this.UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      /** @type {string} */
      this.LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
      /** @type {string} */
      this.UPPER_REVERSE = 'ZYXWVUTSRQPONMLKJIHGFEDCBA';
      /** @type {string} */
      this.LOWER_REVERSE = 'zyxwvutsrqponmlkjihgfedcba';
    }

    // Property setter for key (Atbash doesn't use keys)
    /** @param {uint8[]|null} keyData - Ignored */
    set key(keyData) {
      // Atbash doesn't use keys - ignore the key data
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return null; // Atbash has no key
    }

    // Feed data to the cipher

    // Get the result of the transformation
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      /** @type {uint8[]} */
      const output = [];
      if (this.inputBuffer.length === 0) {
        return output;
      }

      // Process each byte
      for (let i = 0; i < this.inputBuffer.length; i++) {
        /** @type {string} */
        const char = String.fromCharCode(this.inputBuffer[i]);
        /** @type {string} */
        let transformedChar = char; // Default: don't change non-alphabetic characters

        // Handle uppercase letters
        /** @type {int32} */
        const upperIndex = this.UPPERCASE.indexOf(char);
        if (upperIndex !== -1) {
          transformedChar = this.UPPER_REVERSE.charAt(upperIndex);
        } else {
          // Handle lowercase letters
          /** @type {int32} */
          const lowerIndex = this.LOWERCASE.indexOf(char);
          if (lowerIndex !== -1) {
            transformedChar = this.LOWER_REVERSE.charAt(lowerIndex);
          }
          // Non-alphabetic characters pass through unchanged
        }

        output.push(transformedChar.charCodeAt(0));
      }

      // Clear input buffer for next operation
      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;

      return output;
    }
  }

  // Register the algorithm immediately

  // ===== REGISTRATION =====

    const algorithmInstance = new AtbashCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { AtbashCipher, AtbashCipherInstance };
}));