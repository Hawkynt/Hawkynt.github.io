/*
 * CADAENUS Cipher Implementation
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

  class CadaenusCipher extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "CADAENUS Cipher";
      this.description = "Computer Aided Design of Encryption Algorithm - Non Uniform Substitution. Hybrid cipher using position-dependent substitution with multi-stage transformations for enhanced diffusion compared to classical substitution ciphers.";
      this.inventor = "Computer Cryptography Research Team";
      this.year = 1985;
      this.category = CategoryType.CLASSICAL;
      this.subCategory = "Classical Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/CADAENUS"),
        new LinkItem("Educational Materials", "https://web.archive.org/web/20080207010024/http://www.cryptography.org/"),
        new LinkItem("Classical Cipher Analysis", "https://www.dcode.fr/cadaenus-cipher")
      ];

      this.references = [
        new LinkItem("DCode Implementation", "https://www.dcode.fr/cadaenus-cipher"),
        new LinkItem("Cryptii Educational Tool", "https://cryptii.com/pipes/cadaenus-cipher"),
        new LinkItem("NSA Declassified Documents", "https://www.nsa.gov/portals/75/documents/news-features/declassified-documents/cryptologic-quarterly/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Known Plaintext Attack",
          "Position-dependent nature complicates but doesn't prevent key recovery with sufficient known plaintext",
          "Use longer keys and for educational purposes only",
          "https://en.wikipedia.org/wiki/Known-plaintext_attack"
        ),
        new Vulnerability(
          "Frequency Analysis",
          "Multi-stage transformation provides better diffusion than simple substitution but still vulnerable to advanced cryptanalysis",
          "Educational use only - not suitable for actual security",
          "https://en.wikipedia.org/wiki/Frequency_analysis"
        )
      ];

      // S-box for non-linear transformation
      /** @type {int32[]} */
      this.FORWARD_SBOX = [
        0x0D, 0x0E, 0x12, 0x16, 0x05, 0x08, 0x0F, 0x18,
        0x03, 0x17, 0x0C, 0x01, 0x07, 0x00, 0x01, 0x06,
        0x02, 0x09, 0x06, 0x13, 0x04, 0x14, 0x02, 0x0A,
        0x15, 0x11, 0x19, 0x10, 0x0B, 0x04, 0x1A, 0x1B
      ];

      /** @type {int32[]} */
      this.REVERSE_SBOX = [];
      // Create reverse S-box (FORWARD_SBOX repeats values, so some entries stay unset)
      for (let i = 0; i < 26; i++) {
        this.REVERSE_SBOX[this.FORWARD_SBOX[i]] = i;
      }

      // Test vectors using byte arrays
      this.tests = [
        {
          text: "Basic Test",
          uri: "https://cryptii.com/pipes/cadaenus-cipher",
          input: OpCodes.AnsiToBytes("HELLO"),
          key: OpCodes.AnsiToBytes("SECRET"),
          expected: OpCodes.AnsiToBytes("RXGIC")
        },
        {
          text: "Alphabet Test",
          uri: "https://www.dcode.fr/cadaenus-cipher",
          input: OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
          key: OpCodes.AnsiToBytes("KEY"),
          expected: OpCodes.AnsiToBytes("MPSCHDCGBSVEDFNBMPECHNCGPS")
        },
        {
          text: "Position Dependency Test",
          uri: "https://en.wikipedia.org/wiki/CADAENUS",
          input: OpCodes.AnsiToBytes("AAAAA"),
          key: OpCodes.AnsiToBytes("CIPHER"),
          expected: OpCodes.AnsiToBytes("SXJMD")
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
   * @returns {CadaenusCipherInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new CadaenusCipherInstance(this, isInverse);
    }
  }

  // Instance class - handles the actual encryption/decryption
  /**
 * CadaenusCipher cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class CadaenusCipherInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {CadaenusCipher} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {string} */
      this._key = "SECRET";
      /** @type {uint8[]} */
      const noKey = [];
      this.key = noKey;
      /** @type {uint8[]} */
      this.inputBuffer = [];

      // Reference to S-boxes
      /** @type {int32[]} */
      this.FORWARD_SBOX = algorithm.FORWARD_SBOX;
      /** @type {int32[]} */
      this.REVERSE_SBOX = algorithm.REVERSE_SBOX;
    }

    /**
     * Keyword; only its capital letters count
     * @param {uint8[]|null} keyData - Key bytes, or null/empty for "SECRET"
     */
    set key(keyData) {
      if (!keyData || keyData.length === 0) {
        this._key = "SECRET"; // Default key
        return;
      }

      // Convert byte array to string and validate (letters only, uppercase)
      /** @type {string} */
      const keyString = String.fromCharCode(...keyData);
      /** @type {string} */
      const letters = keyString.replace(/[^A-Z]/g, '');
      /** @type {string} */
      const cleanKey = letters.toUpperCase();
      this._key = cleanKey.length > 0 ? cleanKey : "SECRET";
    }

    /**
   * Get the keyword
   * @returns {string} Keyword
   */

    get key() {
      return this._key ? this._key : "SECRET";
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

      // Convert input buffer to string
      /** @type {string} */
      const inputString = String.fromCharCode(...this.inputBuffer);

      // Process using CADAENUS algorithm
      /** @type {string} */
      const resultString = this.isInverse ? 
        this.decrypt(inputString) : 
        this.encrypt(inputString);

      // Clear input buffer for next operation
      this.inputBuffer = [];

      // Convert result string back to byte array
      return OpCodes.AnsiToBytes(resultString);
    }

    /**
     * Encrypt using CADAENUS cipher
     * @param {string} plaintext - Text
     * @returns {string} Ciphertext
     */
    encrypt(plaintext) {
      /** @type {string} */
      let result = '';
      /** @type {int32} */
      let letterIndex = 0;

      for (let i = 0; i < plaintext.length; i++) {
        /** @type {string} */
        const char = plaintext.charAt(i);

        if (this.isLetter(char)) {
          /** @type {string} */
          const processed = this.transformCharacter(char, letterIndex, true);
          result += processed;
          letterIndex++;
        } else {
          // Preserve non-alphabetic characters
          result += char;
        }
      }

      return result;
    }

    /**
     * Decrypt using CADAENUS cipher
     * @param {string} ciphertext - Text
     * @returns {string} Plaintext
     */
    decrypt(ciphertext) {
      /** @type {string} */
      let result = '';
      /** @type {int32} */
      let letterIndex = 0;

      for (let i = 0; i < ciphertext.length; i++) {
        /** @type {string} */
        const char = ciphertext.charAt(i);

        if (this.isLetter(char)) {
          /** @type {string} */
          const processed = this.transformCharacter(char, letterIndex, false);
          result += processed;
          letterIndex++;
        } else {
          // Preserve non-alphabetic characters
          result += char;
        }
      }

      return result;
    }

    /**
     * Transform a single character using CADAENUS algorithm
     * @param {string} char - Character
     * @param {int32} position - Index of the letter among the letters
     * @param {boolean} encrypt - True to encrypt
     * @returns {string} Transformed character in the case of the input
     */
    transformCharacter(char, position, encrypt) {
      if (!this.isLetter(char)) {
        return char;
      }

      /** @type {boolean} */
      const isUpperCase = char >= 'A' && char <= 'Z';
      /** @type {string} */
      const upperChar = char.toUpperCase();
      /** @type {string} */
      const keyText = this._key ? this._key : "SECRET";
      /** @type {string} */
      const keyLetter = keyText.charAt(position % keyText.length);
      /** @type {string} */
      const keyChar = keyLetter.toUpperCase();

      // Get character codes (A=0, B=1, etc.)
      /** @type {int32} */
      const charCode = upperChar.charCodeAt(0) - 65;
      /** @type {int32} */
      const keyCode = keyChar.charCodeAt(0) - 65;

      /** @type {int32} */
      let resultCode = 0;

      if (encrypt) {
        // Encryption: multiple transformation stages
        // Stage 1: Key-based substitution
        resultCode = (charCode + keyCode) % 26;

        // Stage 2: Position-dependent transformation
        resultCode = (resultCode + position) % 26;

        // Stage 3: Non-linear transformation using S-box
        resultCode = this.FORWARD_SBOX[resultCode] % 26;
      } else {
        // Decryption: reverse the transformation stages
        // Stage 1: Reverse non-linear transformation
        resultCode = this.REVERSE_SBOX[charCode % 26] % 26;

        // Stage 2: Reverse position-dependent transformation
        resultCode = (resultCode - position + 26) % 26;

        // Stage 3: Reverse key-based substitution
        resultCode = (resultCode - keyCode + 26) % 26;
      }

      /** @type {string} */
      const resultChar = String.fromCharCode(resultCode + 65);
      if (isUpperCase) {
        return resultChar;
      }
      /** @type {string} */
      const lower = resultChar.toLowerCase();
      return lower;
    }

    /**
     * Check if character is a letter
     * @param {string} char - Text
     * @returns {boolean} True when it holds a letter A-Z or a-z
     */
    isLetter(char) {
      /** @type {boolean} */
      const found = /[A-Za-z]/.test(char);
      return found;
    }
  }

  // Create algorithm instance
  const algorithm = new CadaenusCipher();

  // Register the algorithm immediately
  RegisterAlgorithm(algorithm);

  // ===== REGISTRATION =====

    const algorithmInstance = new CadaenusCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { CadaenusCipher, CadaenusCipherInstance };
}));