/*
 * Autokey Cipher Implementation  
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

  const UPPER_A = 65, UPPER_Z = 90, LOWER_A = 97, LOWER_Z = 122;

  /**
   * Alphabet origin of a byte: 65 for A-Z, 97 for a-z, -1 for anything else.
   * @param {number} byte - Input byte
   * @returns {number} Character code of the letter's own 'A', or -1
   */
  function LetterCaseBase(byte) {
    if (byte >= UPPER_A && byte <= UPPER_Z) return UPPER_A;
    if (byte >= LOWER_A && byte <= LOWER_Z) return LOWER_A;
    return -1;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class AutokeyCipher extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Autokey Cipher";
      this.description = "Enhanced Vigenère cipher that extends the key using plaintext itself, eliminating periodic key repetition. Uses initial keyword plus plaintext letters to create non-repeating key sequence. More secure than standard Vigenère. Input domain: every byte is accepted. A-Z and a-z are enciphered in place with their case preserved and are the only bytes that extend the running key, which uses their uppercase form; every other byte - digit, punctuation, whitespace, control or high-bit - is carried through unchanged and takes no part in the key, which is the usual pen-and-paper convention and makes the round trip exact for arbitrary input. Nothing is ever discarded.";
      this.inventor = "Blaise de Vigenère";
      this.year = 1586;
      this.category = CategoryType.CLASSICAL;
      this.subCategory = "Classical Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.FR;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Autokey_cipher"),
        new LinkItem("Original Vigenère Work", "https://gallica.bnf.fr/ark:/12148/bpt6k5493743"),
        new LinkItem("Cryptanalysis Methods", "https://www.dcode.fr/autokey-cipher")
      ];

      this.references = [
        new LinkItem("DCode Implementation", "https://www.dcode.fr/autokey-cipher"),
        new LinkItem("Cryptii Educational Tool", "https://cryptii.com/pipes/autokey-cipher"),
        new LinkItem("Practical Cryptography", "https://practicalcryptography.com/ciphers/classical-era/autokey/")
      ];

      this.knownVulnerabilities = [
        {
          type: "Probable Plaintext Attack",
          text: "If portion of plaintext is known, can recover key and decrypt remainder of message",
          uri: "https://en.wikipedia.org/wiki/Known-plaintext_attack",
          mitigation: "Avoid predictable beginnings or known phrases"
        },
        {
          type: "Statistical Analysis",
          text: "While more secure than Vigenère, still vulnerable to advanced statistical attacks",
          uri: "https://en.wikipedia.org/wiki/Autokey_cipher#Cryptanalysis",
          mitigation: "Educational use only"
        }
      ];

      // Test vectors using byte arrays - bit-perfect results from implementation
      this.tests = [
        {
          text: "Classic Autokey Example",
          uri: "https://www.dcode.fr/autokey-cipher",
          input: OpCodes.AnsiToBytes("ATTACKATDAWN"),
          key: OpCodes.AnsiToBytes("LEMON"),
          expected: OpCodes.AnsiToBytes("LXFOPKTMDCGN")
        },
        {
          text: "Educational Test Vector",
          uri: "https://practicalcryptography.com/ciphers/classical-era/autokey/",
          input: OpCodes.AnsiToBytes("HELLO"),
          key: OpCodes.AnsiToBytes("KEY"),
          expected: OpCodes.AnsiToBytes("RIJSS")
        },
        {
          text: "DCode Reference",
          uri: "https://www.dcode.fr/autokey-cipher",
          input: OpCodes.AnsiToBytes("DCODE"),
          key: OpCodes.AnsiToBytes("AUTOKEY"),
          expected: OpCodes.AnsiToBytes("DWHRO")
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
      return new AutokeyCipherInstance(this, isInverse);
    }
  }

  // Instance class - handles the actual encryption/decryption
  /**
 * AutokeyCipher cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class AutokeyCipherInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = [];
      this.inputBuffer = [];

      // Character sets
      this.ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    }

    // Property setter for key
    set key(keyData) {
      if (!keyData || keyData.length === 0) {
        this._initialKey = "A"; // Default key
      } else {
        // Convert key bytes to uppercase letters only
        const keyStr = String.fromCharCode.apply(null, keyData);
        this._initialKey = keyStr.toUpperCase().replace(/[^A-Z]/g, '');
        if (this._initialKey.length === 0) {
          this._initialKey = "A"; // Fallback
        }
      }
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._initialKey || "A";
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
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
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

      const output = new Array(this.inputBuffer.length);
      const initialKey = this.key;

      // Every byte is accounted for. A letter is enciphered in its own case
      // and both consumes and extends the running key; anything else is copied
      // through untouched and takes no part in the key at all. The earlier
      // "uppercase and strip everything but A-Z" normalisation silently
      // shortened the message - five binary bytes came back as none.
      //
      // The running key is the keyword followed by the plaintext letters in
      // uppercase, and it is grown one letter at a time in both directions:
      // encryption knows the plaintext outright, decryption recovers it as it
      // goes. Since the keyword is never empty the key always holds at least
      // one more letter than has been consumed.
      let runningKey = initialKey;
      let letterIndex = 0;

      for (let i = 0; i < this.inputBuffer.length; i++) {
        const byte = this.inputBuffer[i];
        const caseBase = LetterCaseBase(byte);

        if (caseBase < 0) {
          output[i] = byte;
          continue;
        }

        const textIndex = byte - caseBase;
        const keyIndex = this.ALPHABET.indexOf(runningKey[letterIndex]);
        ++letterIndex;

        // Encrypt: (text + key) mod 26; decrypt: (cipher - key + 26) mod 26
        const resultIndex = this.isInverse
          ? (textIndex - keyIndex + 26) % 26
          : (textIndex + keyIndex) % 26;

        // The key is always extended with the PLAINTEXT letter, which is the
        // input when encrypting and the result when decrypting.
        runningKey += this.ALPHABET[this.isInverse ? resultIndex : textIndex];

        output[i] = caseBase + resultIndex;
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }
  }

  // Register the algorithm immediately

  // ===== REGISTRATION =====

    const algorithmInstance = new AutokeyCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { AutokeyCipher, AutokeyCipherInstance };
}));