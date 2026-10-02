/*
 * AlgorithmFramework Phillips Cipher
 * Compatible with both Browser and Node.js environments
 * 5x5 grid cipher with coordinate system and block transposition
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

  class PhillipsCipher extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Phillips Cipher";
      this.description = "5x5 grid cipher with coordinate system and block transposition for educational cryptography study.";
      this.category = CategoryType.CLASSICAL;
      this.subCategory = "Grid Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.inventor = "Unknown";
      this.year = 1850;
      this.country = CountryCode.UNKNOWN;

      // Documentation
      this.documentation = [
        new LinkItem('CryptoCrack: Phillips Cipher User Guide', 'https://sites.google.com/site/cryptocrackprogram/user-guide/cipher-types/substitution/phillips'),
        new LinkItem('CWU Kryptos Challenge: Phillips Cipher (PDF)', 'https://www.cwu.edu/academics/math/_documents/kryptos-challenges/cwu-kryptos-challenge-phillips-cipher.pdf')
      ];

      // Reference implementations/tools (no open-source reference code is publicly available for
      // this WWI-era cipher; these are the most authoritative interactive implementations)
      this.references = [
        new LinkItem('dcode.fr: Phillips Cipher (online encoder/decoder)', 'https://www.dcode.fr/phillips-cipher'),
        new LinkItem('CryptoPrograms: Phillips Cipher Generator', 'https://www.cryptoprograms.com/substitution-create/phillips')
      ];

      // Convert test vectors to new format (strings to byte arrays)
      // No official published test vectors are available for this WWI-era cipher; these
      // vectors are self-computed against this implementation's single-square Polybius
      // coordinate encoding (row/column, 1-indexed) for self-consistency/round-trip checking.
      // Note: this implementation is simplified and does not implement the full 8-grid
      // shifting-square scheme of the historical Phillips cipher described in the references above.
      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes('HELLO'),
          OpCodes.AnsiToBytes('23 15 31 31 34'),
          'Self-computed vector (standard Polybius square, self-consistency check - not an official Phillips cipher test vector)',
          'https://sites.google.com/site/cryptocrackprogram/user-guide/cipher-types/substitution/phillips'
        ),
        new TestCase(
          OpCodes.AnsiToBytes('WORLD'),
          OpCodes.AnsiToBytes('52 34 42 31 14'),
          'Self-computed vector (standard Polybius square, self-consistency check - not an official Phillips cipher test vector)',
          'https://sites.google.com/site/cryptocrackprogram/user-guide/cipher-types/substitution/phillips'
        )
      ];

      // For test suite compatibility
      this.testVectors = this.tests;

      // Standard 5x5 grid (I/J combined)
      /** @type {string[][]} */
      this.STANDARD_GRID = [
        ['A', 'B', 'C', 'D', 'E'],
        ['F', 'G', 'H', 'I', 'K'],
        ['L', 'M', 'N', 'O', 'P'],
        ['Q', 'R', 'S', 'T', 'U'],
        ['V', 'W', 'X', 'Y', 'Z']
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {PhillipsInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new PhillipsInstance(this, isInverse);
    }
  }

  /**
 * Phillips cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PhillipsInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {PhillipsCipher} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {string[]} */
      this.inputBuffer = [];
      /** @type {string|null} */
      this._key = null;
      /** @type {string[][]} */
      this.grid = [];
      for (let r = 0; r < algorithm.STANDARD_GRID.length; r++) {
        this.grid.push(algorithm.STANDARD_GRID[r].slice());
      }
      /** @type {int32} */
      this.blockSize = 5;
    }

    /**
     * Keyword for the grid, given as a string or as its ASCII bytes
     * @param {uint8[]} keyData - Keyword; empty keeps the standard grid
     */
    set key(keyData) {
      /** @type {string} */
      const keyString = keyData ? String.fromCharCode(...keyData) : '';

      if (keyString && keyString.length > 0) {
        this.grid = this.createCustomGrid(keyString);
      }
      this._key = keyString;
    }

    /**
   * Get the keyword
   * @returns {string|null} Keyword or null
   */

    get key() {
      return this._key;
    }

    /**
   * Feed data to cipher for processing
   * @param {string|uint8[]} data - Input text, or its bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Convert bytes to string for classical cipher
      /** @type {string} */
      let text = '';
      if (typeof data === 'string') {
        text = data;
      } else {
        /** @type {uint8[]} */
        const bytes = data;
        text = String.fromCharCode(...bytes);
      }

      this.inputBuffer.push(text);
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
      const text = this.inputBuffer.join('');
      this.inputBuffer = [];

      /** @type {string} */
      const result = this.isInverse ?
        this.decryptText(text) :
        this.encryptText(text);

      // Convert string result to bytes (all characters are ASCII)
      for (let i = 0; i < result.length; i++) output.push(result.charCodeAt(i));
      return output;
    }

    /**
     * Build a 5x5 grid from a keyword (I and J share a cell)
     * @param {string} keyword - Keyword
     * @returns {string[][]} Grid of single letters
     */
    createCustomGrid(keyword) {
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

      /** @type {string} */
      const alphabet = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';
      /** @type {string} */
      let remaining = alphabet;
      for (let i = 0; i < cleanKey.length; i++) {
        remaining = remaining.replace(cleanKey.charAt(i), '');
      }

      /** @type {string} */
      const fullAlphabet = cleanKey + remaining;
      /** @type {string[][]} */
      const grid = [];
      for (let row = 0; row < 5; row++) {
        /** @type {string[]} */
        const cells = [];
        for (let col = 0; col < 5; col++) {
          cells.push(fullAlphabet.charAt(row * 5 + col));
        }
        grid.push(cells);
      }

      return grid;
    }

    /**
     * @param {string} plaintext - Text; only its letters count, J as I
     * @returns {string} Space-separated two-digit cell numbers
     */
    encryptText(plaintext) {
      /** @type {string} */
      const upper = plaintext.toUpperCase();
      /** @type {string} */
      const text = upper.replace(/[^A-Z]/g, '').replace(/J/g, 'I');
      /** @type {string[]} */
      const result = [];

      for (let i = 0; i < text.length; i++) {
        /** @type {string} */
        const char = text.charAt(i);
        // Find position in grid
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 5; col++) {
            if (this.grid[row][col] === char) {
              /** @type {int32} */
              const cell = (row + 1) * 10 + (col + 1);
              /** @type {string} */
              const cellText = String(cell);
              result.push(cellText);
              break;
            }
          }
        }
      }

      return result.join(' ');
    }

    /**
     * @param {string} ciphertext - Space-separated cell numbers
     * @returns {string} Letters, '?' for numbers outside the grid
     */
    decryptText(ciphertext) {
      /** @type {string} */
      const trimmed = ciphertext.trim();
      /** @type {string[]} */
      const numbers = trimmed.split(/\s+/);
      /** @type {string} */
      let result = '';

      for (let i = 0; i < numbers.length; i++) {
        /** @type {int32} */
        const num = parseInt(numbers[i]);
        /** @type {int32} */
        const row = Math.floor(num / 10) - 1;
        /** @type {int32} */
        const col = (num % 10) - 1;

        if (row >= 0 && row < 5 && col >= 0 && col < 5) {
          result += this.grid[row][col];
        } else {
          result += '?';
        }
      }

      return result;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new PhillipsCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { PhillipsCipher, PhillipsInstance };
}));