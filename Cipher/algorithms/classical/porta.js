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
        {
          type: "Period Analysis",
          text: "Short keys create detectable repeating patterns vulnerable to Kasiski examination",
          uri: "https://en.wikipedia.org/wiki/Kasiski_examination",
          mitigation: "Use longer, non-repeating keys"
        },
        {
          type: "Limited Alphabets", 
          text: "Only 13 effective substitution alphabets vs 26 in full polyalphabetic ciphers",
          uri: "https://en.wikipedia.org/wiki/Porta_cipher#Security",
          mitigation: "Educational use only - not suitable for actual security"
        }
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
   * @returns {Object} New cipher instance
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
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = OpCodes.AnsiToBytes("CIPHER"); // Default key
      this.inputBuffer = [];

      // Reference to Porta tableau
      this.PORTA_TABLEAU = algorithm.PORTA_TABLEAU;
    }

    // Property setter for key 
    set key(keyData) {
      if (!keyData || keyData.length === 0) {
        this._key = OpCodes.AnsiToBytes("CIPHER");
        return;
      }

      // Convert byte array to string and validate/clean alphabetic characters only
      const keyString = String.fromCharCode(...keyData);
      const cleanKey = keyString.replace(/[^A-Za-z]/g, '').toUpperCase();
      this._key = OpCodes.AnsiToBytes(cleanKey || "CIPHER");
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key || OpCodes.AnsiToBytes("CIPHER");
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
        return [];
      }

      const output = [];
      const keyString = String.fromCharCode(...this.key);
      let keyIndex = 0;

      // Process each byte
      for (const byte of this.inputBuffer) {
        const char = String.fromCharCode(byte);

        if (this.isLetter(char)) {
          const keyChar = keyString.charAt(keyIndex % keyString.length);
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

    // Check if character is a letter
    isLetter(char) {
      return /[A-Za-z]/.test(char);
    }

    // Substitute character using Porta tableau
    substituteChar(char, keyChar) {
      if (!this.isLetter(char)) {
        return char;
      }

      const isUpperCase = char >= 'A' && char <= 'Z';
      const upperChar = char.toUpperCase();
      const upperKeyChar = keyChar.toUpperCase();

      // Determine which row of the tableau to use
      const keyCharCode = upperKeyChar.charCodeAt(0) - 65; // A=0, B=1, etc.
      const tableRow = Math.floor(keyCharCode / 2); // A,B→0, C,D→1, etc.

      let substitution;

      if (!this.isInverse) {
        // ENCRYPTION: Find position of character in alphabet, get substitution from tableau
        const charPos = upperChar.charCodeAt(0) - 65; // A=0, B=1, etc.
        substitution = this.PORTA_TABLEAU[tableRow].charAt(charPos);
      } else {
        // DECRYPTION: Find position of character in tableau row, convert back to alphabet position
        const charPosInTableau = this.PORTA_TABLEAU[tableRow].indexOf(upperChar);
        if (charPosInTableau === -1) {
          // Fallback if character not found (shouldn't happen with valid input)
          substitution = upperChar;
        } else {
          substitution = String.fromCharCode(charPosInTableau + 65);
        }
      }

      // Preserve original case
      return isUpperCase ? substitution : substitution.toLowerCase();
    }
  }

  // Create algorithm instance
  const algorithm = new PortaCipher();

  // Register the algorithm immediately
  RegisterAlgorithm(algorithm);

  // Export for Node.js compatibility
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = algorithm;
  }

  // ===== REGISTRATION =====

    const algorithmInstance = new PortaCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { PortaCipher, PortaCipherInstance };
}));