/*
 * AlgorithmFramework Four-Square Cipher
 * Compatible with both Browser and Node.js environments
 * Based on four 5x5 squares for digraph encryption
 * (c)2006-2025 Hawkynt
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

  class FourSquareCipher extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Four-Square Cipher";
      this.description = "Classical polygraphic cipher using four 5x5 squares for digraph encryption, offering enhanced security over simple substitution ciphers.";
      this.category = CategoryType.CLASSICAL;
      this.subCategory = "Polygraphic Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.inventor = "Felix Marie Delastelle";
      this.year = 1902;
      this.country = CountryCode.FR;

      // Documentation
      this.documentation = [
        new LinkItem('Four-Square Cipher Wikipedia', 'https://en.wikipedia.org/wiki/Four-square_cipher'),
        new LinkItem('Practical Cryptography Tutorial', 'http://practicalcryptography.com/ciphers/classical-era/four-square/')
      ];

      this.references = [
        new LinkItem('Classical Cryptography Guide', 'http://practicalcryptography.com/ciphers/classical-era/four-square/'),
        new LinkItem('Delastelle Cipher Systems', 'https://en.wikipedia.org/wiki/F%C3%A9lix_Delastelle')
      ];

      // Test vectors in plain format (recommended).
      //
      // The four-square has two long-standing ways of squeezing 26 letters
      // into 25 cells: fold J onto I, or leave Q out. This file folds J onto I
      // throughout, which is the commoner convention. The Wikipedia article
      // leaves Q out instead, so its worked example - EXAMPLE and KEYWORD over
      // "helpmeobiwankenobi" giving FYGMKYHOBXMFKKKIMD - cannot be reproduced
      // here and none of the values below are taken from it. The first digraph
      // agrees either way, HE giving FY; they part company at the second.
      this.tests = [
        {
          text: 'Keywords EXAMPLE and KEYWORD over one digraph pair, J folded onto I. No published source carries this value',
          uri: 'https://en.wikipedia.org/wiki/Four-square_cipher',
          input: OpCodes.AnsiToBytes('HELP'),
          key: OpCodes.AnsiToBytes('EXAMPLE,KEYWORD'),
          expected: OpCodes.AnsiToBytes('FYNF')
        },
        {
          text: 'Keywords with repeated letters - FORTIFICATION and BATTLE both dedupe. No published source carries this value',
          uri: 'https://en.wikipedia.org/wiki/Four-square_cipher',
          input: OpCodes.AnsiToBytes('ATTACKATDAWN'),
          key: OpCodes.AnsiToBytes('FORTIFICATION,BATTLE'),
          expected: OpCodes.AnsiToBytes('TPMLIFTPFLXK')
        },
        {
          text: 'Odd-length message padded to an even number of digraphs with X. No published source carries this value',
          uri: 'https://en.wikipedia.org/wiki/Four-square_cipher',
          input: OpCodes.AnsiToBytes('BEATLES'),
          key: OpCodes.AnsiToBytes('JOHN,PAUL'),
          expected: OpCodes.AnsiToBytes('AANOPPSX')
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
   * @returns {FourSquareInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new FourSquareInstance(this, isInverse);
    }

  }

  /**
   * The two keywords of a Four-Square key
   * @class
   */
  class FourSquareKeywords {
    /**
     * @param {string} key1 - Keyword of the top-right square
     * @param {string} key2 - Keyword of the bottom-left square
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
 * FourSquare cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class FourSquareInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {FourSquareCipher} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
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
      /** @type {string[][]} */
      this.square3 = this.createStandardSquare();
      /** @type {string[][]} */
      this.square4 = this.createStandardSquare();
    }

    /**
     * Two keywords separated by comma, colon, space or semicolon
     * @param {uint8[]} keyData - Key text or its bytes
     */
    set key(keyData) {
      this._keyBytes = keyData ? Array.from(keyData) : null;
      /** @type {string} */
      let keyString = keyData ? String.fromCharCode(...keyData) : '';

      // Use default test key if none provided or invalid format
      if (!keyString || keyString.length === 0 ||
          (!keyString.includes(',') && !keyString.includes(':') &&
           !keyString.includes(' ') && !keyString.includes(';'))) {
        keyString = 'EXAMPLE,KEYWORD'; // Default key pair for testing
      }

      /** @type {FourSquareKeywords} */
      const parsed = this.parseKey(keyString);

      // Create the four squares
      // Square 1 (top-left): Standard alphabet
      this.square1 = this.createStandardSquare();

      // Square 2 (top-right): First keyword
      this.square2 = this.createKeySquare(parsed.key1);

      // Square 3 (bottom-left): Second keyword
      this.square3 = this.createKeySquare(parsed.key2);

      // Square 4 (bottom-right): Standard alphabet
      this.square4 = this.createStandardSquare();

      this._key = keyString;
    }

    /**
   * @returns {uint8[]|null} The key bytes as set
   */

    get key() {
      return this._keyBytes || null;
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
     * @returns {FourSquareKeywords} The two keywords
     */
    parseKey(text) {
      /** @type {string[]} */
      const parts = text.split(/[\s,:;]+/);
      if (parts.length < 2) {
        throw new Error('Four-Square cipher requires two keywords separated by comma, space, colon, or semicolon');
      }

      return new FourSquareKeywords(parts[0], parts[1]);
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

        // Find positions in plaintext squares (square1 and square4)
        /** @type {SquarePosition|null} */
        const pos1 = this.findPosition(this.square1, char1);
        /** @type {SquarePosition|null} */
        const pos2 = this.findPosition(this.square4, char2);

        if (!pos1 || !pos2) {
          // Should not happen with normalized text, but defensive programming
          result += char1 + char2;
          continue;
        }

        // Get corresponding positions in ciphertext squares (square2 and square3)
        // The cipher uses the same row as char1 but column from square2, and same row as char2 but column from square3
        /** @type {string} */
        const cipher1 = this.square2[pos1.row][pos2.col];
        /** @type {string} */
        const cipher2 = this.square3[pos2.row][pos1.col];

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

        // Find positions in ciphertext squares (square2 and square3)
        /** @type {SquarePosition|null} */
        const pos1 = this.findPosition(this.square2, cipher1);
        /** @type {SquarePosition|null} */
        const pos2 = this.findPosition(this.square3, cipher2);

        if (!pos1 || !pos2) {
          // Should not happen with normalized text, but defensive programming
          result += cipher1 + cipher2;
          continue;
        }

        // Get corresponding positions in plaintext squares (square1 and square4)
        // Reverse the encryption process
        /** @type {string} */
        const plain1 = this.square1[pos1.row][pos2.col];
        /** @type {string} */
        const plain2 = this.square4[pos2.row][pos1.col];

        result += plain1 + plain2;
      }

      return result;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new FourSquareCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { FourSquareCipher, FourSquareInstance };
}));