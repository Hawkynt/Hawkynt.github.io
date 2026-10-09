/*
 * AlgorithmFramework Two-Square Cipher
 * Compatible with both Browser and Node.js environments
 * Classical polygraphic substitution cipher using two 5x5 squares
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

  class TwoSquareCipher extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Two-Square Cipher";
      this.description = "Classical polygraphic substitution cipher using two 5x5 Polybius squares for digraph encryption with enhanced security.";
      this.category = CategoryType.CLASSICAL;
      this.subCategory = "Polygraphic Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.inventor = "Unknown";
      this.year = 1850;
      this.country = CountryCode.UNKNOWN;

      // Documentation
      this.documentation = [
        new LinkItem('Two-Square Cipher Information', 'https://en.wikipedia.org/wiki/Two-square_cipher'),
        new LinkItem('Classical Cryptography Guide', 'http://practicalcryptography.com/ciphers/classical-era/two-square/')
      ];

      this.references = [
        new LinkItem('Two-Square (Double Playfair) Cipher Reference Implementation (Python)', 'https://github.com/scottmilton1/two-square-cipher')
      ];

      // Test vectors in plain format (recommended).
      //
      // This is the vertical two-square: the first letter of a digraph is
      // found in the top square and the second in the bottom one, and each is
      // replaced by the letter in its own square in the other's column. A
      // digraph whose letters share a column therefore comes through
      // unchanged, and the cipher is its own inverse.
      //
      // Like the four-square this file folds J onto I, where the Wikipedia
      // article leaves Q out, so the article's worked example - EXAMPLE and
      // KEYWORD over "helpmeobiwankenobi" giving HEDLXWSDJYANHOTKDG - cannot
      // be reproduced here and neither value below is taken from it.
      this.tests = [
        {
          text: 'Keywords SECRET and CIPHER, odd-length message padded with X. No published source carries this value',
          uri: 'https://en.wikipedia.org/wiki/Two-square_cipher',
          input: OpCodes.AnsiToBytes('HELLO'),
          key: OpCodes.AnsiToBytes('SECRET,CIPHER'),
          expected: OpCodes.AnsiToBytes('MCKMPW')
        },
        {
          text: 'Keywords EXAMPLE and KEYWORD, J folded onto I. No published source carries this value',
          uri: 'https://en.wikipedia.org/wiki/Two-square_cipher',
          input: OpCodes.AnsiToBytes('ATTACKATDAWN'),
          key: OpCodes.AnsiToBytes('EXAMPLE,KEYWORD'),
          expected: OpCodes.AnsiToBytes('EVRCLYEVCBVP')
        }
      ];

      // For test suite compatibility
      /** @type {TestCase[]} */
      this.testVectors = this.tests;

      // Standard alphabet without J (merged with I)
      /** @type {string} */
      this.ALPHABET = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {TwoSquareInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new TwoSquareInstance(this, isInverse);
    }

  }

  /**
   * The two keywords of a Two-Square key
   * @class
   */
  class TwoSquareKeywords {
    /**
     * @param {string} key1 - Keyword of the first square
     * @param {string} key2 - Keyword of the second square
     */
    constructor(key1, key2) {
      /** @type {string} */
      this.key1 = key1;
      /** @type {string} */
      this.key2 = key2;
    }
  }

  /**
   * Row and column of a letter in a square
   * @class
   */
  class SquarePosition {
    /**
     * @param {int32} row - Row 0..4
     * @param {int32} col - Column 0..4
     */
    constructor(row, col) {
      /** @type {int32} */
      this.row = row;
      /** @type {int32} */
      this.col = col;
    }
  }

  /**
 * TwoSquare cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class TwoSquareInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {TwoSquareCipher} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {uint8[]|null} */
      this._keyBytes = null;
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {string|null} */
      this._key = null;
      /** @type {string} */
      this.alphabet = algorithm.ALPHABET;

      // Initialize with default squares
      /** @type {string[][]} */
      this.square1 = this.createStandardSquare();
      /** @type {string[][]} */
      this.square2 = this.createStandardSquare();
    }

    /**
     * Two keywords separated by comma, colon, space or semicolon
     * @param {uint8[]} keyData - Key text or its bytes
     */
    set key(keyData) {
      this._keyBytes = keyData ? keyData.slice() : null;
      /** @type {string} */
      let keyString = keyData ? String.fromCharCode(...keyData) : '';

      // Use default test key if none provided or invalid format
      if (!keyString || keyString.length === 0 ||
          (!keyString.includes(',') && !keyString.includes(':') &&
           !keyString.includes(' ') && !keyString.includes(';'))) {
        keyString = 'EXAMPLE,KEYWORD'; // Default key pair for testing
      }

      /** @type {TwoSquareKeywords} */
      const parsed = this.parseKey(keyString);

      this.square1 = this.createKeySquare(parsed.key1);
      this.square2 = this.createKeySquare(parsed.key2);

      this._key = keyString;
    }

    /**
     * Get a copy of the key bytes last set
     * @returns {uint8[]|null} Copy of the key bytes, or null when none were set
     */

    get key() {
      return this._keyBytes ? this._keyBytes.slice() : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {string|uint8[]} data - Input text, or its bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Collect octets; a string is taken as its character codes, one octet each
      if (typeof data === 'string') {
        for (let i = 0; i < data.length; i++) this.inputBuffer.push(OpCodes.ToByte(data.charCodeAt(i)));
      } else {
        for (let i = 0; i < data.length; i++) this.inputBuffer.push(data[i]);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      /** @type {uint8[]} */
      const output = [];
      if (this.inputBuffer.length === 0) return output;

      /** @type {string} */
      let text = '';
      for (let i = 0; i < this.inputBuffer.length; i++) text += String.fromCharCode(this.inputBuffer[i]);
      this.inputBuffer = [];

      /** @type {string} */
      const result = this.isInverse ?
        this.decryptText(text) :
        this.encryptText(text);

      // Convert string result to bytes (all letters)
      for (let i = 0; i < result.length; i++) output.push(result.charCodeAt(i));
      return output;
    }

    /**
     * Create 5x5 key square from keyword
     * @param {string} keyword - Keyword
     * @returns {string[][]} Square
     */
    createKeySquare(keyword) {
      // Remove duplicates and J (merge with I)
      /** @type {string} */
      const upper = keyword.toUpperCase();
      /** @type {string} */
      const letters = upper.replace(/[^A-Z]/g, '').replace(/J/g, 'I');
      /** @type {string} */
      let cleanKey = '';
      for (let i = 0; i < letters.length; i++) {
        /** @type {string} */
        const letter = letters.charAt(i);
        // keep the first occurrence of each letter
        if (letters.indexOf(letter) === i) cleanKey += letter;
      }

      // Create alphabet without used letters
      /** @type {string} */
      let remainingAlphabet = this.alphabet;
      for (let i = 0; i < cleanKey.length; i++) {
        remainingAlphabet = remainingAlphabet.replace(cleanKey.charAt(i), '');
      }

      // Combine key with remaining alphabet
      /** @type {string} */
      const fullAlphabet = cleanKey + remainingAlphabet;

      // Create 5x5 matrix
      /** @type {string[][]} */
      const square = [];
      for (let row = 0; row < 5; row++) {
        /** @type {string[]} */
        const cells = [];
        for (let col = 0; col < 5; col++) {
          /** @type {string} */
          const cell = fullAlphabet[row * 5 + col];
          cells.push(cell);
        }
        square.push(cells);
      }

      return square;
    }

    /**
     * Create standard alphabet square
     * @returns {string[][]} Square
     */
    createStandardSquare() {
      /** @type {string[][]} */
      const square = [];
      for (let row = 0; row < 5; row++) {
        /** @type {string[]} */
        const cells = [];
        for (let col = 0; col < 5; col++) {
          /** @type {string} */
          const cell = this.alphabet[row * 5 + col];
          cells.push(cell);
        }
        square.push(cells);
      }
      return square;
    }

    /**
     * Find position of character in square
     * @param {string[][]} square - Square
     * @param {string} char - Character
     * @returns {SquarePosition|null} Its position, or null when absent
     */
    findPosition(square, char) {
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          if (square[row][col] === char) {
            return new SquarePosition(row, col);
          }
        }
      }
      return null;
    }

    /**
     * Parse key string to extract two keywords
     * Support formats: "key1,key2", "key1:key2", "key1 key2", or "key1;key2"
     * @param {string} text - Key text
     * @returns {TwoSquareKeywords} The two keywords
     */
    parseKey(text) {
      /** @type {string[]} */
      const parts = text.split(/[\s,:;]+/);
      if (parts.length < 2) {
        throw new Error('Two-Square cipher requires two keywords separated by comma, space, colon, or semicolon');
      }

      return new TwoSquareKeywords(parts[0], parts[1]);
    }

    /**
     * Normalize text to uppercase letters only, merge J with I
     * @param {string} text - Text
     * @returns {string} Normalized letters
     */
    normalizeText(text) {
      /** @type {string} */
      const upper = text.toUpperCase();
      return upper.replace(/[^A-Z]/g, '').replace(/J/g, 'I');
    }

    /**
     * Prepare text for digraph processing
     * @param {string} text - Text
     * @returns {string} Normalized letters, padded with X to an even length
     */
    prepareText(text) {
      /** @type {string} */
      const normalized = this.normalizeText(text);

      // Add X if odd length
      if (normalized.length % 2 === 1) {
        return normalized + 'X';
      }

      return normalized;
    }

    /**
     * @param {string} plaintext - Text
     * @returns {string} Ciphertext
     */
    encryptText(plaintext) {
      /** @type {string} */
      const preparedText = this.prepareText(plaintext);
      /** @type {string} */
      let result = '';

      // Process text in digraphs (pairs)
      for (let i = 0; i < preparedText.length; i += 2) {
        /** @type {string} */
        const char1 = preparedText.charAt(i);
        /** @type {string} */
        const char2 = preparedText.charAt(i + 1);

        // Find positions in squares
        /** @type {SquarePosition|null} */
        const pos1 = this.findPosition(this.square1, char1);
        /** @type {SquarePosition|null} */
        const pos2 = this.findPosition(this.square2, char2);

        if (!pos1 || !pos2) {
          // Should not happen with normalized text, but defensive programming
          result += char1 + char2;
          continue;
        }

        // Two-square rule: use same row, opposite square's column
        /** @type {string} */
        const cipher1 = this.square1[pos1.row][pos2.col];
        /** @type {string} */
        const cipher2 = this.square2[pos2.row][pos1.col];

        result += cipher1 + cipher2;
      }

      return result;
    }

    /**
     * @param {string} ciphertext - Text
     * @returns {string} Plaintext
     */
    decryptText(ciphertext) {
      /** @type {string} */
      const normalizedText = this.normalizeText(ciphertext);
      /** @type {string} */
      let result = '';

      // Process text in digraphs (pairs)
      for (let i = 0; i < normalizedText.length; i += 2) {
        /** @type {string} */
        const cipher1 = normalizedText.charAt(i);
        /** @type {string} */
        const next = normalizedText.charAt(i + 1);
        /** @type {string} */
        const cipher2 = next ? next : 'X'; // Handle odd length

        // Find positions in squares
        /** @type {SquarePosition|null} */
        const pos1 = this.findPosition(this.square1, cipher1);
        /** @type {SquarePosition|null} */
        const pos2 = this.findPosition(this.square2, cipher2);

        if (!pos1 || !pos2) {
          // Should not happen with normalized text, but defensive programming
          result += cipher1 + cipher2;
          continue;
        }

        // Reverse the encryption process
        /** @type {string} */
        const plain1 = this.square1[pos1.row][pos2.col];
        /** @type {string} */
        const plain2 = this.square2[pos2.row][pos1.col];

        result += plain1 + plain2;
      }

      return result;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new TwoSquareCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { TwoSquareCipher, TwoSquareInstance };
}));