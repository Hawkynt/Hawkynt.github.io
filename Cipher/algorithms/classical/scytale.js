/*
 * AlgorithmFramework Scytale Cipher
 * Compatible with both Browser and Node.js environments
 * Ancient Spartan transposition cipher using a staff
 * (c)2025 Hawkynt - Educational Implementation
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

  class ScytaleCipher extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Scytale Cipher";
      this.description = "Ancient Spartan transposition cipher using a staff for military communications in classical antiquity.";
      this.category = CategoryType.CLASSICAL;
      this.subCategory = "Transposition Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.inventor = "Ancient Spartans";
      this.year = -500; // 5th century BC
      this.country = CountryCode.ANCIENT;

      // Documentation
      this.documentation = [
        new LinkItem('Scytale Cipher Wikipedia', 'https://en.wikipedia.org/wiki/Scytale'),
        new LinkItem('Ancient Cryptography', 'http://practicalcryptography.com/ciphers/classical-era/scytale/')
      ];

      // Test vectors in plain format (recommended)
      this.tests = [
        {
          text: 'Basic Scytale example with circumference 3',
          uri: 'https://en.wikipedia.org/wiki/Scytale',
          input: OpCodes.AnsiToBytes('WEAREFOUNDOUT'), 
          key: OpCodes.AnsiToBytes('3'),
          expected: OpCodes.AnsiToBytes('WRODTEEUOAFNU')
        },
        {
          text: 'Military message with circumference 4',
          uri: 'https://en.wikipedia.org/wiki/Scytale',
          input: OpCodes.AnsiToBytes('ATTACKATDAWN'),
          key: OpCodes.AnsiToBytes('4'),
          expected: OpCodes.AnsiToBytes('ACDTKATAWATN')
        }
      ];

      // For test suite compatibility
      this.testVectors = this.tests;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new ScytaleInstance(this, isInverse);
    }
  }

  /**
 * Scytale cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ScytaleInstance extends IAlgorithmInstance {
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
      this.circumference = 3; // Default circumference
    }

    set key(keyData) {
      let keyString = '';
      if (typeof keyData === 'string') {
        keyString = keyData;
      } else if (Array.isArray(keyData)) {
        keyString = String.fromCharCode(...keyData);
      }

      const circumference = parseInt(keyString) || 3;
      this.circumference = Math.max(1, circumference);
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
        this.decryptText(text) : 
        this.encryptText(text);

      // Convert string result to bytes
      return Array.from(result).map(c => c.charCodeAt(0));
    }

    encryptText(plaintext) {
      const text = plaintext.toUpperCase().replace(/[^A-Z]/g, '');
      if (text.length === 0) return '';

      // Calculate rows needed
      const rows = Math.ceil(text.length / this.circumference);
      const grid = [];

      // Fill grid row by row
      for (let r = 0; r < rows; r++) {
        grid[r] = [];
        for (let c = 0; c < this.circumference; c++) {
          const index = r * this.circumference + c;
          grid[r][c] = index < text.length ? text[index] : '';
        }
      }

      // Read column by column
      let result = '';
      for (let c = 0; c < this.circumference; c++) {
        for (let r = 0; r < rows; r++) {
          if (grid[r][c]) {
            result += grid[r][c];
          }
        }
      }

      return result;
    }

    decryptText(ciphertext) {
      const text = ciphertext.toUpperCase().replace(/[^A-Z]/g, '');
      if (text.length === 0) return '';

      const rows = Math.ceil(text.length / this.circumference);
      const grid = [];

      // Initialize grid
      for (let r = 0; r < rows; r++) {
        grid[r] = new Array(this.circumference).fill('');
      }

      // Calculate how many characters each column should have
      // When text.length is not divisible by circumference, 
      // some columns will have one less character
      const charsPerColumn = [];
      const fullRows = Math.floor(text.length / this.circumference);
      const remainder = text.length % this.circumference;

      for (let c = 0; c < this.circumference; c++) {
        // First 'remainder' columns get an extra character
        charsPerColumn[c] = fullRows + (c < remainder ? 1 : 0);
      }

      // Fill the grid column by column with the correct number of characters
      let cipherIndex = 0;
      for (let c = 0; c < this.circumference; c++) {
        for (let r = 0; r < charsPerColumn[c]; r++) {
          if (cipherIndex < text.length) {
            grid[r][c] = text[cipherIndex++];
          }
        }
      }

      // Read row by row to get original plaintext
      let result = '';
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < this.circumference; c++) {
          if (grid[r][c] && grid[r][c] !== '') {
            result += grid[r][c];
          }
        }
      }

      return result;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new ScytaleCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ScytaleCipher, ScytaleInstance };
}));