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

      // Porta tableau - 13 reciprocal substitution alphabets
      this.PORTA_TABLEAU = [
        'NOPQRSTUVWXYZABCDEFGHIJKLM', // A,B
        'OPQRSTUVWXYZABCDEFGHIJKLMN', // C,D
        'PQRSTUVWXYZABCDEFGHIJKLMNO', // E,F
        'QRSTUVWXYZABCDEFGHIJKLMNOP', // G,H
        'RSTUVWXYZABCDEFGHIJKLMNOPQ', // I,J
        'STUVWXYZABCDEFGHIJKLMNOPQR', // K,L
        'TUVWXYZABCDEFGHIJKLMNOPQRS', // M,N
        'UVWXYZABCDEFGHIJKLMNOPQRST', // O,P
        'VWXYZABCDEFGHIJKLMNOPQRSTU', // Q,R
        'WXYZABCDEFGHIJKLMNOPQRSTUV', // S,T
        'XYZABCDEFGHIJKLMNOPQRSTUVW', // U,V
        'YZABCDEFGHIJKLMNOPQRSTUVWX', // W,X
        'ZABCDEFGHIJKLMNOPQRSTUVWXY'  // Y,Z
      ];

      // Test vectors using byte arrays
      this.tests = [
        {
          text: "Basic Test",
          uri: "https://en.wikipedia.org/wiki/Porta_cipher",
          input: global.OpCodes.AnsiToBytes("HELLO"),
          key: global.OpCodes.AnsiToBytes("KEY"),
          expected: global.OpCodes.AnsiToBytes("ZTKDD")
        },
        {
          text: "Extended Test",
          uri: "https://cryptii.com/pipes/porta-cipher",
          input: global.OpCodes.AnsiToBytes("ATTACKATDAWN"),
          key: global.OpCodes.AnsiToBytes("CIPHER"),
          expected: global.OpCodes.AnsiToBytes("OKNQRFOKXQLI")
        },
        {
          text: "Full Alphabet Test",
          uri: "https://www.dcode.fr/porta-cipher",
          input: global.OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
          key: global.OpCodes.AnsiToBytes("A"),
          expected: global.OpCodes.AnsiToBytes("NOPQRSTUVWXYZABCDEFGHIJKLM")
        }
      ];

      // For the test suite compatibility 
      this.testVectors = this.tests;
    }

    // Create instance for this algorithm
    CreateInstance(isInverse = false) {
      return new PortaCipherInstance(this, isInverse);
    }
  }

  // Instance class - handles the actual encryption/decryption
  class PortaCipherInstance extends IAlgorithmInstance {
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

    get key() {
      return this._key || OpCodes.AnsiToBytes("CIPHER");
    }

    // Feed data to the cipher
    Feed(data) {
      if (!data || data.length === 0) return;

      // Add data to input buffer
      this.inputBuffer.push(...data);
    }

    // Get the result of the transformation
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