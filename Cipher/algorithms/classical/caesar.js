/*
 * Caesar Cipher Implementation
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

  class CaesarCipher extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Caesar Cipher";
      this.description = "Ancient Roman substitution cipher shifting each letter by fixed number of positions in alphabet. Used by Julius Caesar for military communications with standard shift of 3. One of the oldest known encryption techniques.";
      this.inventor = "Julius Caesar";
      this.year = -50;
      this.category = CategoryType.CLASSICAL;
      this.subCategory = "Classical Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.IT;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Caesar_cipher"),
        new LinkItem("Historical Context", "https://en.wikipedia.org/wiki/Julius_Caesar"),
        new LinkItem("Cryptanalysis Methods", "https://www.dcode.fr/caesar-cipher")
      ];

      this.references = [
        new LinkItem("DCode Implementation", "https://www.dcode.fr/caesar-cipher"),
        new LinkItem("Educational Tutorial", "https://cryptii.com/pipes/caesar-cipher"),
        new LinkItem("Practical Cryptography", "https://practicalcryptography.com/ciphers/classical-era/caesar/")
      ];

      this.knownVulnerabilities = [
        {
          type: "Brute Force Attack",
          text: "Only 25 possible keys (shifts 1-25), making brute force trivial even by hand",
          uri: "https://en.wikipedia.org/wiki/Caesar_cipher#Breaking_the_cipher",
          mitigation: "None - cipher is fundamentally insecure"
        },
        {
          type: "Frequency Analysis", 
          text: "Letter frequencies preserved, making frequency analysis immediately effective",
          uri: "https://en.wikipedia.org/wiki/Frequency_analysis",
          mitigation: "Use only for educational demonstrations of cryptanalysis"
        }
      ];

      // Test vectors using byte arrays - both formats for compatibility
      this.tests = [
        {
          text: "Historical Caesar Example",
          uri: "https://en.wikipedia.org/wiki/Caesar_cipher",
          input: OpCodes.AnsiToBytes("HELLO"),
          shift: 3,
          expected: OpCodes.AnsiToBytes("KHOOR")
        },
        {
          text: "Classic Educational Test",
          uri: "https://www.dcode.fr/caesar-cipher", 
          input: OpCodes.AnsiToBytes("ATTACKATDAWN"),
          shift: 3,
          expected: OpCodes.AnsiToBytes("DWWDFNDWGDZQ")
        },
        {
          text: "Full Alphabet Shift",
          uri: "https://practicalcryptography.com/ciphers/classical-era/caesar/",
          input: OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
          shift: 3,
          expected: OpCodes.AnsiToBytes("DEFGHIJKLMNOPQRSTUVWXYZABC")
        },
        {
          text: "Mixed case text",
          uri: "https://www.dcode.fr/caesar-cipher",
          input: OpCodes.AnsiToBytes("Hello World"),
          shift: 3,
          expected: OpCodes.AnsiToBytes("Khoor Zruog")
        },
        {
          text: "Text with numbers",
          uri: "https://www.dcode.fr/caesar-cipher",
          input: OpCodes.AnsiToBytes("Test123"),
          shift: 3,
          expected: OpCodes.AnsiToBytes("Whvw123")
        }
      ];

      // For the test suite compatibility 
      this.testVectors = this.tests;
    }

    // Create instance for this algorithm
    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new CaesarCipherInstance(this, isInverse);
    }
  }

  // Instance class - handles the actual encryption/decryption
  /**
 * CaesarCipher cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class CaesarCipherInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.shift = 3; // Default Caesar shift
      this.inputBuffer = [];

      // Character sets
      this.UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      this.LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
    }

    // Property setter for shift amount
    set shift(shiftAmount) {
      if (typeof shiftAmount === 'number') {
        this._shift = ((shiftAmount % 26) + 26) % 26; // Normalize to 0-25
      } else if (Array.isArray(shiftAmount) && shiftAmount.length > 0) {
        // If shift is provided as byte array, XOR all bytes to get shift value
        let shift = 0;
        for (const byte of shiftAmount) {
          shift = OpCodes.Xor32(shift, byte);
        }
        this._shift = ((shift % 26) + 26) % 26;
      } else {
        this._shift = 3; // Default
      }
    }

    get shift() {
      return this._shift || 3;
    }

    // Feed data to the cipher
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Add data to input buffer
      this.inputBuffer.push(...data);
    }

    // Get the result of the transformation
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.inputBuffer.length === 0) {
        return [];
      }

      const output = [];
      const effectiveShift = this.isInverse ? -this.shift : this.shift;

      // Process each byte
      for (const byte of this.inputBuffer) {
        const char = String.fromCharCode(byte);
        let newChar = char; // Default: don't change non-alphabetic characters

        // Handle uppercase letters
        const upperIndex = this.UPPERCASE.indexOf(char);
        if (upperIndex !== -1) {
          newChar = this.UPPERCASE.charAt((upperIndex + effectiveShift + 26) % 26);
        } else {
          // Handle lowercase letters
          const lowerIndex = this.LOWERCASE.indexOf(char);
          if (lowerIndex !== -1) {
            newChar = this.LOWERCASE.charAt((lowerIndex + effectiveShift + 26) % 26);
          }
          // Non-alphabetic characters pass through unchanged
        }

        output.push(newChar.charCodeAt(0));
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }
  }

  // Register the algorithm immediately

  // ===== REGISTRATION =====

    const algorithmInstance = new CaesarCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { CaesarCipher, CaesarCipherInstance };
}));