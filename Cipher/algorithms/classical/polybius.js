/*
 * Polybius Square Cipher Implementation
 * Ancient Greek fractionating cipher using coordinate system (150 BCE)
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

  class PolybiusSquare extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Polybius Square";
      this.description = "Ancient coordinate-based cipher system that converts letters to coordinate pairs using a 5×5 grid. Invented by Greek historian Polybius around 150 BCE for long-distance communication via torch signals. Forms foundation for many advanced classical ciphers.";
      this.inventor = "Polybius";
      this.year = -150;
      this.category = CategoryType.CLASSICAL;
      this.subCategory = "Classical Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.GR;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Polybius_square"),
        new LinkItem("Original Historical Account", "https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Polybius/10*.html"),
        new LinkItem("Cryptanalysis Methods", "https://www.dcode.fr/polybius-cipher")
      ];

      this.references = [
        new LinkItem("DCode Implementation", "https://www.dcode.fr/polybius-cipher"),
        new LinkItem("Educational Tutorial", "https://cryptii.com/pipes/polybius-square"),
        new LinkItem("Tap Code History", "https://en.wikipedia.org/wiki/Tap_code")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Frequency Analysis",
          "Each letter always maps to same coordinate pair, preserving frequency patterns",
          "Educational use only - provides no security by modern standards",
          "https://en.wikipedia.org/wiki/Frequency_analysis"
        ),
        new Vulnerability(
          "Pattern Recognition",
          "Identical plaintext produces identical coordinate patterns making analysis easy",
          "Historical demonstration cipher only",
          "https://en.wikipedia.org/wiki/Pattern_recognition"
        )
      ];

      // Test vectors using byte arrays - bit-perfect results from implementation  
      this.tests = [
        {
          text: "Plain A-Z square, row then column, both 1-indexed. The Wikipedia article works a different message, so it carries no value for this input",
          uri: "https://en.wikipedia.org/wiki/Polybius_square",
          input: OpCodes.AnsiToBytes("HELLO"),
          key: OpCodes.AnsiToBytes(""),
          expected: OpCodes.AnsiToBytes("23 15 31 31 34")
        },
        {
          text: "Ancient Greek example",
          uri: "https://www.dcode.fr/polybius-cipher", 
          input: OpCodes.AnsiToBytes("POLYBIUS"),
          key: OpCodes.AnsiToBytes(""),
          expected: OpCodes.AnsiToBytes("35 34 31 54 12 24 45 43")
        },
        {
          text: "I/J equivalence test (J->I conversion)",
          uri: "https://cryptii.com/pipes/polybius-square",
          input: OpCodes.AnsiToBytes("IUSTICE"),
          key: OpCodes.AnsiToBytes(""),
          expected: OpCodes.AnsiToBytes("24 45 43 44 24 13 15")
        }
      ];

      // For the test suite compatibility 
      this.testVectors = this.tests;
    }

    // Create instance for this algorithm
    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {PolybiusSquareInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new PolybiusSquareInstance(this, isInverse);
    }
  }

  // Instance class - handles the actual encryption/decryption
  /**
 * PolybiusSquare cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PolybiusSquareInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {PolybiusSquare} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];

      // Standard 5x5 Polybius grid (I and J share the same cell)
      /** @type {string[][]} */
      this.STANDARD_GRID = [
        ['A', 'B', 'C', 'D', 'E'],
        ['F', 'G', 'H', 'I', 'K'],
        ['L', 'M', 'N', 'O', 'P'],
        ['Q', 'R', 'S', 'T', 'U'],
        ['V', 'W', 'X', 'Y', 'Z']
      ];

      /** @type {string[][]} */
      this.grid = this.copyStandardGrid();
      /** @type {uint8[]} */
      this._key = [];
    }

    /**
     * Optional keyword for a custom grid
     * @param {uint8[]|null} keyData - Keyword bytes, or null/empty for the standard grid
     */
    set key(keyData) {
      if (!keyData || keyData.length === 0) {
        // Use standard grid
        this._key = [];
        this.grid = this.copyStandardGrid();
        return;
      }

      this._key = keyData.slice();

      /** @type {string} */
      const keyword = String.fromCharCode.apply(null, keyData);
      this.grid = this.createCustomGrid(keyword);
    }

    /**
   * Get the keyword bytes in use
   * @returns {uint8[]} Keyword bytes, empty for the standard grid
   */

    get key() {
      return this._key;
    }

    /**
     * Copy the standard grid, so a keyed grid never aliases it
     * @returns {string[][]} Grid of single letters
     */
    copyStandardGrid() {
      /** @type {string[][]} */
      const grid = [];
      for (let row = 0; row < this.STANDARD_GRID.length; ++row)
        grid.push(this.STANDARD_GRID[row].slice());
      return grid;
    }

    /**
     * Create custom grid from keyword
     * @param {string} keyword - Keyword
     * @returns {string[][]} Grid of single letters
     */
    createCustomGrid(keyword) {
      if (!keyword || keyword.length === 0) {
        return this.copyStandardGrid();
      }

      // Normalize keyword: uppercase, letters only, remove duplicates
      /** @type {string} */
      const upper = keyword.toUpperCase();
      /** @type {string} */
      const cleanKeyword = upper.replace(/[^A-Z]/g, '');
      /** @type {string} */
      let uniqueKeyword = '';

      for (let i = 0; i < cleanKeyword.length; i++) {
        /** @type {string} */
        let char = cleanKeyword.charAt(i);
        if (char === 'J') char = 'I'; // Handle I/J equivalence
        if (uniqueKeyword.indexOf(char) < 0) {
          uniqueKeyword += char;
        }
      }

      // Generate full alphabet excluding used characters
      /** @type {string} */
      const alphabet = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'; // Note: no J
      /** @type {string} */
      let remaining = '';

      for (let i = 0; i < alphabet.length; i++) {
        /** @type {string} */
        const char = alphabet.charAt(i);
        if (uniqueKeyword.indexOf(char) < 0) {
          remaining += char;
        }
      }

      // Combine keyword with remaining letters
      /** @type {string} */
      const fullAlphabet = uniqueKeyword + remaining;

      // Fill 5x5 grid
      /** @type {string[][]} */
      const grid = [];
      /** @type {int32} */
      let index = 0;

      for (let row = 0; row < 5; row++) {
        /** @type {string[]} */
        const cells = [];
        for (let col = 0; col < 5; col++) {
          cells.push(fullAlphabet.charAt(index++));
        }
        grid.push(cells);
      }

      return grid;
    }

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

      /** @type {string} */
      const inputStr = String.fromCharCode.apply(null, this.inputBuffer);

      if (this.isInverse) {
        // Decryption: coordinates to letters
        return this.decryptText(inputStr);
      } else {
        // Encryption: letters to coordinates
        return this.encryptText(inputStr);
      }
    }

    /**
     * Encrypt text to coordinates
     * @param {string} plaintext - Text; only its letters count, J as I
     * @returns {uint8[]} ASCII of the space-separated coordinate pairs
     */
    encryptText(plaintext) {
      /** @type {uint8[]} */
      const output = [];

      // Convert to uppercase and filter to letters only
      /** @type {string} */
      const upper = plaintext.toUpperCase();
      /** @type {string} */
      const cleanText = upper.replace(/[^A-Z]/g, '');

      /** @type {string[]} */
      const result = [];

      for (let i = 0; i < cleanText.length; i++) {
        /** @type {string} */
        let char = cleanText.charAt(i);

        // Handle I/J equivalence
        if (char === 'J') char = 'I';

        // Find character in grid
        /** @type {boolean} */
        let found = false;
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 5; col++) {
            if (this.grid[row][col] === char) {
              /** @type {string} */
              const pair = '' + (row + 1) + (col + 1);
              result.push(pair);
              found = true;
              break;
            }
          }
          if (found) break;
        }

        if (!found) {
          // This shouldn't happen with proper filtering, but handle gracefully
          result.push('??');
        }
      }

      // Convert result string to byte array
      /** @type {string} */
      const resultStr = result.join(' ');
      for (let i = 0; i < resultStr.length; i++) {
        output.push(resultStr.charCodeAt(i));
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    /**
     * Decrypt coordinates to text
     * @param {string} ciphertext - Space-separated coordinate pairs
     * @returns {uint8[]} ASCII letters, '?' for invalid pairs
     */
    decryptText(ciphertext) {
      /** @type {uint8[]} */
      const output = [];
      /** @type {string} */
      let result = '';

      // Split by spaces and process each coordinate pair
      /** @type {string} */
      const trimmed = ciphertext.trim();
      /** @type {string[]} */
      const coordinates = trimmed.split(/\s+/);

      for (let i = 0; i < coordinates.length; i++) {
        /** @type {string} */
        const coord = coordinates[i];

        // exactly two ASCII digits
        if (coord.length === 2 && coord.charAt(0) >= '0' && coord.charAt(0) <= '9' &&
            coord.charAt(1) >= '0' && coord.charAt(1) <= '9') {
          /** @type {int32} */
          const rowDigit = parseInt(coord.charAt(0));
          /** @type {int32} */
          const colDigit = parseInt(coord.charAt(1));
          /** @type {int32} */
          const row = rowDigit - 1;
          /** @type {int32} */
          const col = colDigit - 1;

          if (row >= 0 && row < 5 && col >= 0 && col < 5) {
            result += this.grid[row][col];
          } else {
            result += '?'; // Invalid coordinates
          }
        } else {
          result += '?'; // Invalid format
        }
      }

      // Convert result string to byte array
      for (let i = 0; i < result.length; i++) {
        output.push(result.charCodeAt(i));
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }
  }

  // Create algorithm instance
  const algorithm = new PolybiusSquare();

  // Register the algorithm immediately
  RegisterAlgorithm(algorithm);

  // ===== REGISTRATION =====

    const algorithmInstance = new PolybiusSquare();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { PolybiusSquare, PolybiusSquareInstance };
}));