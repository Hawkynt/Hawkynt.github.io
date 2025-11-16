/*
 * AlgorithmFramework Nihilist Cipher
 * Based on the Russian revolutionary cipher (1880s)
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation - Historical cipher for learning purposes
 * The Nihilist cipher combines Polybius square with additive key encryption
 */


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

  class NihilistCipher extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Nihilist Cipher";
      this.description = "Russian revolutionary cipher combining Polybius square with additive key encryption for historical cryptography study.";
      this.category = CategoryType.CLASSICAL;
      this.subCategory = "Additive Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.inventor = "Russian Revolutionaries";
      this.year = 1880;
      this.country = CountryCode.RU;

      // Documentation
      this.documentation = [
        new LinkItem('Nihilist Cipher Wikipedia', 'https://en.wikipedia.org/wiki/Nihilist_cipher'),
        new LinkItem('Classical Cryptography Guide', 'http://practicalcryptography.com/ciphers/classical-era/nihilist/')
      ];

      this.references = [
        new LinkItem('Historical Cryptography', 'https://en.wikipedia.org/wiki/Nihilist_cipher'),
        new LinkItem('Russian Revolutionary Ciphers', 'http://www.cryptomuseum.com/crypto/nihilist.htm')
      ];

      // Test vectors in plain format (recommended)
      this.tests = [
        {
          text: 'Historical example - ATTACKATDAWN with NIHILIST key',
          uri: 'https://en.wikipedia.org/wiki/Nihilist_cipher',
          input: OpCodes.AnsiToBytes('ATTACKATDAWN'), 
          key: OpCodes.AnsiToBytes('NIHILIST'),
          expected: OpCodes.AnsiToBytes('44 68 67 35 44 49 54 88 47 35 75 57')
        },
        {
          text: 'Revolutionary message with RUSSIAN key',
          uri: 'https://en.wikipedia.org/wiki/Nihilist_cipher',
          input: OpCodes.AnsiToBytes('REVOLUTION'),
          key: OpCodes.AnsiToBytes('RUSSIAN'),
          expected: OpCodes.AnsiToBytes('84 60 94 77 55 56 77 66 79 76')
        },
        {
          text: 'Simple example - SECRET with CZAR key',
          uri: 'https://en.wikipedia.org/wiki/Nihilist_cipher',
          input: OpCodes.AnsiToBytes('SECRET'),
          key: OpCodes.AnsiToBytes('CZAR'),
          expected: OpCodes.AnsiToBytes('56 70 24 84 28 99')
        }
      ];

      // For test suite compatibility
      this.testVectors = this.tests;

      // Standard Polybius Square (I/J combined)
      this.STANDARD_SQUARE = [
        ['A', 'B', 'C', 'D', 'E'],
        ['F', 'G', 'H', 'I', 'K'], // I/J combined as I
        ['L', 'M', 'N', 'O', 'P'],
        ['Q', 'R', 'S', 'T', 'U'],
        ['V', 'W', 'X', 'Y', 'Z']
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new NihilistInstance(this, isInverse);
    }
  }

  /**
 * Nihilist cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class NihilistInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;

      this.setupSquare();
    }

    set key(keyData) {
      let keyString = '';
      if (typeof keyData === 'string') {
        keyString = keyData;
      } else if (Array.isArray(keyData)) {
        keyString = String.fromCharCode(...keyData);
      }

      this.keyText = keyString.toUpperCase().replace(/[^A-Z]/g, ''); // Remove non-letters
      if (this.keyText.length === 0) {
        throw new Error('Nihilist: Key must contain at least one letter');
      }

      this.prepareKey();
      this._key = keyString;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Convert bytes to string for classical cipher
      let text = '';
      if (typeof data === 'string') {
        text = data;
      } else {
        text = String.fromCharCode(...data);
      }

      this.inputBuffer.push(text);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.inputBuffer.length === 0) return [];

      const text = this.inputBuffer.join('');
      this.inputBuffer = [];

      const result = this.isInverse ? 
        this.decrypt(text) : 
        this.encrypt(text);

      // Convert string result to bytes
      return Array.from(result).map(c => c.charCodeAt(0));
    }

    setupSquare() {
      // Use standard Polybius square
      this.square = this.algorithm.STANDARD_SQUARE.map(row => row.slice());

      // Create coordinate lookup for letters
      this.letterToCoords = {};
      this.coordsToLetter = {};

      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          const letter = this.square[row][col];
          const coords = (row + 1) * 10 + (col + 1); // 11, 12, 13, etc.
          this.letterToCoords[letter] = coords;
          this.coordsToLetter[coords] = letter;
        }
      }

      // Handle I/J combination
      this.letterToCoords['J'] = this.letterToCoords['I'];
    }

    // Prepare the key by converting to coordinate numbers
    prepareKey() {
      this.keyCoords = [];
      for (let i = 0; i < this.keyText.length; i++) {
        const letter = this.keyText[i];
        if (this.letterToCoords[letter]) {
          this.keyCoords.push(this.letterToCoords[letter]);
        }
      }

      if (this.keyCoords.length === 0) {
        throw new Error('Nihilist: No valid letters found in key');
      }
    }

    // Encrypt function
    encrypt(plaintext) {
      const text = plaintext.toUpperCase().replace(/[^A-Z]/g, '');
      const result = [];

      for (let i = 0; i < text.length; i++) {
        const letter = text[i];

        // Convert letter to Polybius coordinates
        const letterCoords = this.letterToCoords[letter] || this.letterToCoords['I']; // J maps to I

        // Get corresponding key coordinate (cycling through key)
        const keyCoords = this.keyCoords[i % this.keyCoords.length];

        // Add coordinates (Nihilist addition)
        const sum = letterCoords + keyCoords;
        result.push(sum.toString());
      }

      return result.join(' ');
    }

    // Decrypt function
    decrypt(ciphertext) {
      // Parse numbers from ciphertext
      const numbers = ciphertext.trim().split(/\s+/).map(n => parseInt(n));
      const result = [];

      for (let i = 0; i < numbers.length; i++) {
        const sum = numbers[i];

        // Get corresponding key coordinate
        const keyCoords = this.keyCoords[i % this.keyCoords.length];

        // Subtract key from sum to get original letter coordinates
        const letterCoords = sum - keyCoords;

        // Validate coordinates are in valid Polybius range
        const row = Math.floor(letterCoords / 10);
        const col = letterCoords % 10;

        if (row >= 1 && row <= 5 && col >= 1 && col <= 5) {
          const coords = row * 10 + col;
          if (this.coordsToLetter[coords]) {
            result.push(this.coordsToLetter[coords]);
          } else {
            result.push('?'); // Invalid coordinates
          }
        } else {
          result.push('?'); // Out of range
        }
      }

      return result.join('');
    }

    // Return the Polybius square for educational purposes
    getSquare() {
      return this.square.map(row => row.slice());
    }

    // Display the encryption process for educational purposes
    showEncryption(plaintext) {
      const text = plaintext.toUpperCase().replace(/[^A-Z]/g, '');
      let display = `Nihilist Cipher Encryption:\n`;
      display += `Plaintext: ${text}\n`;
      display += `Key: ${this.keyText}\n\n`;
      display += `Polybius Square:\n`;
      display += `  1 2 3 4 5\n`;
      for (let i = 0; i < 5; i++) {
        display += `${i + 1} `;
        for (let j = 0; j < 5; j++) {
          display += `${this.square[i][j]} `;
        }
        display += `\n`;
      }
      display += `\nEncryption process:\n`;

      for (let i = 0; i < text.length; i++) {
        const letter = text[i];
        const letterCoords = this.letterToCoords[letter] || this.letterToCoords['I'];
        const keyLetter = this.keyText[i % this.keyText.length];
        const keyCoords = this.keyCoords[i % this.keyCoords.length];
        const sum = letterCoords + keyCoords;

        display += `${letter}(${letterCoords}) + ${keyLetter}(${keyCoords}) = ${sum}\n`;
      }

      display += `\nResult: ${this.encrypt(plaintext)}`;
      return display;
    }
  }
  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new NihilistCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { NihilistCipher, NihilistInstance };
}));