/*
 * Porta Cipher Implementation
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

  class PortaCipher extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Porta Cipher";
      this.description = "Reciprocal polyalphabetic substitution cipher invented by Giovan Battista Bellaso in 1563. Uses 13-row substitution tableau where same operation encrypts and decrypts. Key feature is reciprocal property making it self-inverse.";
      this.inventor = "Giovan Battista Bellaso";
      this.year = 1563;
      this.category = CategoryType.CLASSICAL;
      this.subCategory = "Classical Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.IT;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Porta_cipher"),
        new LinkItem("Historical Context", "https://archive.org/details/lacifradelsiggio00bell"),
        new LinkItem("Educational Tutorial", "https://cryptii.com/pipes/porta-cipher")
      ];

      this.references = [
        new LinkItem("dCode Implementation", "https://www.dcode.fr/porta-cipher"),
        new LinkItem("Practical Cryptography", "https://practicalcryptography.com/ciphers/classical-era/porta/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Period Analysis",
          "Short keys create detectable repeating patterns vulnerable to Kasiski examination",
          "Use longer, non-repeating keys",
          "https://en.wikipedia.org/wiki/Kasiski_examination"
        ),
        new Vulnerability(
          "Limited Alphabets",
          "Only 13 effective substitution alphabets vs 26 in full polyalphabetic ciphers",
          "Educational use only - not suitable for actual security",
          "https://en.wikipedia.org/wiki/Porta_cipher#Security"
        )
      ];

      // Porta tableau - the 13 reciprocal substitution alphabets as printed in
      // the classical table. Each row pairs the first half of the alphabet A-M
      // with the second half N-Z; going down the table the N-Z half is rotated
      // one place further left while A-M stays put, which is what makes every
      // row an involution and the whole cipher self-inverse.
      //
      // Rotating all 26 letters instead - a Caesar shift of 13+row - looks
      // similar and agrees with this table on the first row only. Every other
      // row then failed to be reciprocal, contradicting the description above,
      // and the cipher disagreed with the published tableau from the second
      // key letter onwards.
      /** @type {string[]} */
      this.PORTA_TABLEAU = [
        'NOPQRSTUVWXYZABCDEFGHIJKLM', // A,B
        'OPQRSTUVWXYZNMABCDEFGHIJKL', // C,D
        'PQRSTUVWXYZNOLMABCDEFGHIJK', // E,F
        'QRSTUVWXYZNOPKLMABCDEFGHIJ', // G,H
        'RSTUVWXYZNOPQJKLMABCDEFGHI', // I,J
        'STUVWXYZNOPQRIJKLMABCDEFGH', // K,L
        'TUVWXYZNOPQRSHIJKLMABCDEFG', // M,N
        'UVWXYZNOPQRSTGHIJKLMABCDEF', // O,P
        'VWXYZNOPQRSTUFGHIJKLMABCDE', // Q,R
        'WXYZNOPQRSTUVEFGHIJKLMABCD', // S,T
        'XYZNOPQRSTUVWDEFGHIJKLMABC', // U,V
        'YZNOPQRSTUVWXCDEFGHIJKLMAB', // W,X
        'ZNOPQRSTUVWXYBCDEFGHIJKLMA'  // Y,Z
      ];

      // Test vectors using byte arrays
      this.tests = [
        {
          text: "Practical Cryptography worked example - DEFENDTHEEASTWALLOFTHECASTLE under FORTIFICATION",
          uri: "http://practicalcryptography.com/ciphers/porta-cipher/",
          input: OpCodes.AnsiToBytes("DEFENDTHEEASTWALLOFTHECASTLE"),
          key: OpCodes.AnsiToBytes("FORTIFICATION"),
          expected: OpCodes.AnsiToBytes("SYNNJSCVRNRLAHUTUKUCVRYRLANY")
        },
        {
          text: "Reciprocity - the same worked example run again on its own ciphertext returns the plaintext",
          uri: "http://practicalcryptography.com/ciphers/porta-cipher/",
          input: OpCodes.AnsiToBytes("SYNNJSCVRNRLAHUTUKUCVRYRLANY"),
          key: OpCodes.AnsiToBytes("FORTIFICATION"),
          expected: OpCodes.AnsiToBytes("DEFENDTHEEASTWALLOFTHECASTLE")
        },
        {
          text: "First row of the published tableau read straight off - key letter A pairs A-M with N-Z",
          uri: "http://practicalcryptography.com/ciphers/porta-cipher/",
          input: OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
          key: OpCodes.AnsiToBytes("A"),
          expected: OpCodes.AnsiToBytes("NOPQRSTUVWXYZABCDEFGHIJKLM")
        }
      ];

      // For the test suite compatibility 
      this.testVectors = this.tests;
    }

    // Create instance for this algorithm
    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {PortaCipherInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new PortaCipherInstance(this, isInverse);
    }
  }

  // Instance class - handles the actual encryption/decryption
  /**
 * PortaCipher cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PortaCipherInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {PortaCipher} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this._key = OpCodes.AnsiToBytes("CIPHER");
      this.key = OpCodes.AnsiToBytes("CIPHER"); // Default key
      /** @type {uint8[]} */
      this.inputBuffer = [];

      // Reference to Porta tableau
      /** @type {string[]} */
      this.PORTA_TABLEAU = algorithm.PORTA_TABLEAU;
    }

    /**
     * Keyword; only its letters count, upper-cased
     * @param {uint8[]|null} keyData - Key bytes, or null/empty for "CIPHER"
     */
    set key(keyData) {
      if (!keyData || keyData.length === 0) {
        this._key = OpCodes.AnsiToBytes("CIPHER");
        return;
      }

      // Convert byte array to string and validate/clean alphabetic characters only
      /** @type {string} */
      const keyString = String.fromCharCode(...keyData);
      /** @type {string} */
      const letters = keyString.replace(/[^A-Za-z]/g, '');
      /** @type {string} */
      const cleanKey = letters.toUpperCase();
      this._key = OpCodes.AnsiToBytes(cleanKey.length > 0 ? cleanKey : "CIPHER");
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? this._key : OpCodes.AnsiToBytes("CIPHER");
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

      /** @type {uint8[]} */
      const keyBytes = this._key ? this._key : OpCodes.AnsiToBytes("CIPHER");
      /** @type {string} */
      const keyString = String.fromCharCode(...keyBytes);
      /** @type {int32} */
      let keyIndex = 0;

      // Process each byte
      for (let b = 0; b < this.inputBuffer.length; b++) {
        /** @type {uint8} */
        const byte = this.inputBuffer[b];
        /** @type {string} */
        const char = String.fromCharCode(byte);

        if (this.isLetter(char)) {
          /** @type {string} */
          const keyChar = keyString.charAt(keyIndex % keyString.length);
          /** @type {string} */
          const processed = this.substituteChar(char, keyChar);
          output.push(processed.charCodeAt(0));
          keyIndex++;
        } else {
          // Preserve non-alphabetic characters
          output.push(byte);
        }
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    /**
     * Check if character is a letter
     * @param {string} char - One character
     * @returns {boolean} True for A-Z and a-z
     */
    isLetter(char) {
      /** @type {boolean} */
      const found = /[A-Za-z]/.test(char);
      return found;
    }

    /**
     * Substitute character using Porta tableau
     * @param {string} char - Character to substitute
     * @param {string} keyChar - Key letter selecting the tableau row
     * @returns {string} Substituted character in the case of the input
     */
    substituteChar(char, keyChar) {
      if (!this.isLetter(char)) {
        return char;
      }

      /** @type {boolean} */
      const isUpperCase = char >= 'A' && char <= 'Z';
      /** @type {string} */
      const upperChar = char.toUpperCase();
      /** @type {string} */
      const upperKeyChar = keyChar.toUpperCase();

      // Determine which row of the tableau to use
      /** @type {int32} */
      const keyCharCode = upperKeyChar.charCodeAt(0) - 65; // A=0, B=1, etc.
      /** @type {int32} */
      const tableRow = Math.floor(keyCharCode / 2); // A,B→0, C,D→1, etc.
      /** @type {string} */
      const row = this.PORTA_TABLEAU[tableRow];

      /** @type {string} */
      let substitution = '';

      if (!this.isInverse) {
        // ENCRYPTION: Find position of character in alphabet, get substitution from tableau
        /** @type {int32} */
        const charPos = upperChar.charCodeAt(0) - 65; // A=0, B=1, etc.
        substitution = row.charAt(charPos);
      } else {
        // DECRYPTION: Find position of character in tableau row, convert back to alphabet position
        /** @type {int32} */
        const charPosInTableau = row.indexOf(upperChar);
        if (charPosInTableau === -1) {
          // Fallback if character not found (shouldn't happen with valid input)
          substitution = upperChar;
        } else {
          substitution = String.fromCharCode(charPosInTableau + 65);
        }
      }

      // Preserve original case
      if (isUpperCase) {
        return substitution;
      }
      /** @type {string} */
      const lower = substitution.toLowerCase();
      return lower;
    }
  }

  // Create algorithm instance
  const algorithm = new PortaCipher();

  // Register the algorithm immediately
  RegisterAlgorithm(algorithm);

  // ===== REGISTRATION =====

    const algorithmInstance = new PortaCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { PortaCipher, PortaCipherInstance };
}));