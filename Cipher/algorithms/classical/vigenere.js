/*
 * Vigenère Cipher Implementation
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

  /** @type {int32} */
  const UPPER_A = 65;
  /** @type {int32} */
  const UPPER_Z = 90;
  /** @type {int32} */
  const LOWER_A = 97;
  /** @type {int32} */
  const LOWER_Z = 122;

  /**
   * Alphabet origin of a byte: 65 for A-Z, 97 for a-z, -1 for anything else.
   * @param {uint8} byte - Input byte
   * @returns {int32} Character code of the letter's own 'A', or -1
   */
  function LetterCaseBase(byte) {
    if (byte >= UPPER_A && byte <= UPPER_Z) return UPPER_A;
    if (byte >= LOWER_A && byte <= LOWER_Z) return LOWER_A;
    return -1;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class VigenereCipher extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Vigenère Cipher";
      this.description = "Classical polyalphabetic substitution cipher using repeating keyword to shift letters. Developed by Blaise de Vigenère in 16th century, considered unbreakable for centuries until Kasiski examination was developed. Uses Caesar cipher with different shift for each position. Input domain: every byte is accepted. A-Z and a-z are enciphered in place with their case preserved and advance the keyword; every other byte - digit, punctuation, whitespace, control or high-bit - is carried through unchanged and leaves the keyword position alone, which is the usual pen-and-paper convention and makes the round trip exact for arbitrary input. Nothing is ever discarded.";
      this.inventor = "Blaise de Vigenère";
      this.year = 1553;
      this.category = CategoryType.CLASSICAL;
      this.subCategory = "Classical Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.FR;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Vigen%C3%A8re_cipher"),
        new LinkItem("Historical Context", "https://en.wikipedia.org/wiki/Blaise_de_Vigen%C3%A8re"),
        new LinkItem("Cryptanalysis Methods", "https://en.wikipedia.org/wiki/Kasiski_examination")
      ];

      this.references = [
        new LinkItem("Educational Implementation", "https://www.dcode.fr/vigenere-cipher"),
        new LinkItem("Interactive Tutorial", "https://cryptii.com/pipes/vigenere-cipher"),
        new LinkItem("Practical Cryptography", "https://practicalcryptography.com/ciphers/classical-era/vigenere-gronsfeld-and-autokey/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Kasiski Examination",
          "Repeated patterns in ciphertext reveal keyword length, enabling frequency analysis",
          "None - fundamental weakness of polyalphabetic substitution",
          "https://en.wikipedia.org/wiki/Kasiski_examination"
        ),
        new Vulnerability(
          "Index of Coincidence",
          "Statistical analysis can determine keyword length and enable cryptanalysis",
          "Use only for educational demonstrations",
          "https://en.wikipedia.org/wiki/Index_of_coincidence"
        )
      ];

      // Test vectors using byte arrays - classical educational examples
      this.tests = [
        {
          text: "Classic Vigenère example from textbooks",
          uri: "https://www.dcode.fr/vigenere-cipher",
          input: OpCodes.AnsiToBytes("ATTACKATDAWN"),
          key: OpCodes.AnsiToBytes("LEMON"),
          expected: OpCodes.AnsiToBytes("LXFOPVEFRNHR")
        },
        {
          text: "GeeksforGeeks educational example",
          uri: "https://www.geeksforgeeks.org/vigenere-cipher/",
          input: OpCodes.AnsiToBytes("GEEKSFORGEEKS"),
          key: OpCodes.AnsiToBytes("AYUSH"),
          expected: OpCodes.AnsiToBytes("GCYCZFMLYLEIM")
        },
        {
          text: "Trinity College Computer Science example",
          uri: "https://www.cs.tcd.ie/courses/bacsf/4ba2.05/crypto/vigenere.html",
          input: OpCodes.AnsiToBytes("TOBEORNOTTOBETHATISTHEQUESTION"),
          key: OpCodes.AnsiToBytes("RELATIONS"),
          expected: OpCodes.AnsiToBytes("KSMEHZBBLKSMEMPOGAJXSEJCSFLZSY")
        },
        {
          text: "Short key pattern test",
          uri: "https://practicalcryptography.com/ciphers/classical-era/vigenere-gronsfeld-and-autokey/",
          input: OpCodes.AnsiToBytes("CRYPTOISSHORTFORCRYPTOGRAPHY"),
          key: OpCodes.AnsiToBytes("ABCD"),
          expected: OpCodes.AnsiToBytes("CSASTPKVSIQUTGQUCSASTPIUAQJB")
        },
        {
          text: "Classic pangram with simple key",
          uri: "https://www.dcode.fr/vigenere-cipher",
          input: OpCodes.AnsiToBytes("THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG"),
          key: OpCodes.AnsiToBytes("KEY"),
          expected: OpCodes.AnsiToBytes("DLCAYGMOZBSUXJMHNSWTQYZCBXFOPYJCBYK")
        }
      ];

      // For the test suite compatibility
      /** @type {TestCase[]} */
      this.testVectors = this.tests;
    }

    // Create instance for this algorithm
    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {VigenereCipherInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new VigenereCipherInstance(this, isInverse);
    }
  }

  // Instance class - handles the actual encryption/decryption
  /**
 * VigenereCipher cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class VigenereCipherInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {VigenereCipher} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {string} */
      this._processedKey = "A";
      /** @type {uint8[]} */
      const noKey = [];
      this.key = noKey;

      // Character sets
      /** @type {string} */
      this.ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    }

    /**
     * Keyword; only its letters count, upper-cased
     * @param {uint8[]|null} keyData - Key bytes, or null/empty for "A"
     */
    set key(keyData) {
      this._keyBytes = keyData ? Array.from(keyData) : null;
      if (!keyData || keyData.length === 0) {
        this._processedKey = "A"; // Default key
      } else {
        // Convert key bytes to uppercase letters only
        /** @type {string} */
        const keyStr = String.fromCharCode.apply(null, keyData);
        /** @type {string} */
        const upper = keyStr.toUpperCase();
        this._processedKey = upper.replace(/[^A-Z]/g, '');
        if (this._processedKey.length === 0) {
          this._processedKey = "A"; // Fallback
        }
      }
    }

    /**
   * @returns {uint8[]|null} The key bytes as set
   */

    get key() {
      return this._keyBytes || null;
    }

    // Feed data to the cipher

    // Get the result of the transformation
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.inputBuffer.length === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      /** @type {uint8[]} */
      const output = new Array(this.inputBuffer.length);
      /** @type {string} */
      const processedKey = this._processedKey ? this._processedKey : "A";

      // Every byte is accounted for. A letter is enciphered in its own case
      // and consumes one keyword position; anything else is copied through
      // untouched and does not move the keyword on, which is how the cipher
      // has always been worked by hand over a text that carries punctuation.
      // The earlier "uppercase and strip everything but A-Z" normalisation
      // silently shortened the message - five binary bytes came back as none.
      /** @type {int32} */
      let keyPosition = 0;
      for (let i = 0; i < this.inputBuffer.length; i++) {
        /** @type {uint8} */
        const byte = this.inputBuffer[i];
        /** @type {int32} */
        const caseBase = LetterCaseBase(byte);

        if (caseBase < 0) {
          output[i] = byte;
          continue;
        }

        /** @type {int32} */
        const textIndex = byte - caseBase;
        /** @type {int32} */
        const keyIndex = this.ALPHABET.indexOf(processedKey.charAt(keyPosition % processedKey.length));
        ++keyPosition;

        // Vigenère: encryption (text + key) mod 26, decryption (cipher - key) mod 26
        /** @type {int32} */
        const resultIndex = this.isInverse
          ? (textIndex - keyIndex + 26) % 26
          : (textIndex + keyIndex) % 26;

        output[i] = caseBase + resultIndex;
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }
  }

  // Register the algorithm immediately

  // ===== REGISTRATION =====

    const algorithmInstance = new VigenereCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { VigenereCipher, VigenereCipherInstance };
}));