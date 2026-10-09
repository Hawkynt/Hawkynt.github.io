/*
 * Playfair Cipher Implementation
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

  class PlayfairCipher extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Playfair Cipher";
      this.description = "Classical digraph substitution cipher using 5x5 key grid. Encrypts pairs of letters according to position rules. Invented by Charles Wheatstone but popularized by Lord Playfair. More secure than simple substitution ciphers.";
      this.inventor = "Charles Wheatstone";
      this.year = 1854;
      this.category = CategoryType.CLASSICAL;
      this.subCategory = "Classical Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.GB;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Playfair_cipher"),
        new LinkItem("Historical Background", "https://en.wikipedia.org/wiki/Charles_Wheatstone"),
        new LinkItem("Cryptanalysis Methods", "https://www.dcode.fr/playfair-cipher")
      ];

      this.references = [
        new LinkItem("DCode Implementation", "https://www.dcode.fr/playfair-cipher"),
        new LinkItem("Educational Tutorial", "https://cryptii.com/pipes/playfair-cipher"),
        new LinkItem("Practical Cryptography", "https://practicalcryptography.com/ciphers/classical-era/playfair/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Digraph Frequency Analysis",
          "Common digraph patterns in plaintext create patterns in ciphertext, enabling cryptanalysis",
          "Educational use only - use modern ciphers for real security",
          "https://en.wikipedia.org/wiki/Frequency_analysis"
        ),
        new Vulnerability(
          "Known Plaintext Attack",
          "If plaintext-ciphertext pairs are known, key matrix can be reconstructed",
          "Avoid using with predictable or repeated messages",
          "https://en.wikipedia.org/wiki/Known-plaintext_attack"
        )
      ];

      // Test vectors using byte arrays - bit-perfect results from implementation
      this.tests = [
        {
          text: "Lord Playfair Demonstration",
          uri: "https://en.wikipedia.org/wiki/Playfair_cipher#History",
          input: OpCodes.AnsiToBytes("HIDETHEGOLDINTHETREESTUMP"),
          key: OpCodes.AnsiToBytes("PLAYFAIREXAMPLE"),
          expected: OpCodes.AnsiToBytes("BMODZBXDNABEKUDMUIXMMOUVIF")
        },
        {
          text: "Standard Educational Example", 
          uri: "https://www.dcode.fr/playfair-cipher",
          input: OpCodes.AnsiToBytes("INSTRUMENTS"),
          key: OpCodes.AnsiToBytes("MONARCHY"),
          expected: OpCodes.AnsiToBytes("GATLMZCLRQXA")
        },
        {
          text: "Hello World Test",
          uri: "https://practicalcryptography.com/ciphers/classical-era/playfair/",
          input: OpCodes.AnsiToBytes("HELLO"),
          key: OpCodes.AnsiToBytes("KEYWORD"),
          expected: OpCodes.AnsiToBytes("GYIZSC")
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
   * @returns {PlayfairCipherInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new PlayfairCipherInstance(this, isInverse);
    }
  }

  /**
   * Row and column of a letter in the key matrix
   * @class
   */
  class MatrixPosition {
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

  // Instance class - handles the actual encryption/decryption
  /**
 * PlayfairCipher cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PlayfairCipherInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {PlayfairCipher} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {uint8[]|null} */
      this._keyBytes = null;
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {string[][]} */
      this._keyMatrix = [];
      /** @type {uint8[]} */
      const noKey = [];
      this.key = noKey;
      /** @type {uint8[]} */
      this.inputBuffer = [];

      // Playfair uses 5x5 grid (I=J)
      /** @type {string} */
      this.ALPHABET = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'; // Note: no J
    }

    /**
     * Keyword; only its letters count, upper-cased, J as I
     * @param {uint8[]|null} keyData - Key bytes, or null/empty for "KEYWORD"
     */
    set key(keyData) {
      this._keyBytes = keyData ? keyData.slice() : null;
      if (!keyData || keyData.length === 0) {
        this._keyMatrix = this.createMatrix("KEYWORD"); // Default key
      } else {
        // Convert key bytes to uppercase letters only
        /** @type {string} */
        const keyStr = String.fromCharCode.apply(null, keyData);
        /** @type {string} */
        const upper = keyStr.toUpperCase();
        /** @type {string} */
        const processedKey = upper.replace(/[^A-Z]/g, '').replace(/J/g, 'I');
        this._keyMatrix = this.createMatrix(processedKey.length > 0 ? processedKey : "KEYWORD");
      }
    }

    /**
     * Get a copy of the key bytes last set
     * @returns {uint8[]|null} Copy of the key bytes, or null when none were set
     */

    get key() {
      return this._keyBytes ? this._keyBytes.slice() : null;
    }

    /**
     * Create 5x5 Playfair key matrix
     * @param {string} keyword - Keyword
     * @returns {string[][]} Matrix
     */
    createMatrix(keyword) {
      /** @type {string} */
      const alphabet = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'; // Note: no J
      /** @type {string[]} */
      const matrix = [];

      // Add unique characters from key first
      for (let i = 0; i < keyword.length; i++) {
        /** @type {string} */
        const char = keyword.charAt(i);
        if (alphabet.includes(char) && matrix.indexOf(char) < 0) {
          matrix.push(char);
        }
      }

      // Fill remaining positions with unused alphabet letters
      for (let i = 0; i < alphabet.length; i++) {
        /** @type {string} */
        const char = alphabet.charAt(i);
        if (matrix.indexOf(char) < 0) {
          matrix.push(char);
        }
      }

      // Convert to 5x5 grid
      /** @type {string[][]} */
      const grid = [];
      for (let i = 0; i < 5; i++) {
        grid.push(matrix.slice(i * 5, (i + 1) * 5));
      }

      return grid;
    }

    /**
     * Find position of character in matrix
     * @param {string} char - Letter
     * @param {string[][]} matrix - Key matrix
     * @returns {MatrixPosition|null} Its position, or null when absent
     */
    findPosition(char, matrix) {
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          if (matrix[row][col] === char) {
            return new MatrixPosition(row, col);
          }
        }
      }
      return null;
    }

    /**
     * Process digraph according to Playfair rules
     * @param {string} char1 - First letter
     * @param {string} char2 - Second letter
     * @param {string[][]} matrix - Key matrix
     * @param {boolean} [encrypt=true] - True to encrypt
     * @returns {string} Transformed digraph
     */
    processDigraph(char1, char2, matrix, encrypt = true) {
      /** @type {MatrixPosition|null} */
      const pos1 = this.findPosition(char1, matrix);
      /** @type {MatrixPosition|null} */
      const pos2 = this.findPosition(char2, matrix);

      if (!pos1 || !pos2) return char1 + char2; // Fallback

      /** @type {int32} */
      let row1 = pos1.row;
      /** @type {int32} */
      let col1 = pos1.col;
      /** @type {int32} */
      let row2 = pos2.row;
      /** @type {int32} */
      let col2 = pos2.col;

      if (pos1.row === pos2.row) {
        // Same row - move horizontally
        /** @type {int32} */
        const shift = encrypt ? 1 : -1;
        col1 = (pos1.col + shift + 5) % 5;
        col2 = (pos2.col + shift + 5) % 5;
      } else if (pos1.col === pos2.col) {
        // Same column - move vertically
        /** @type {int32} */
        const shift = encrypt ? 1 : -1;
        row1 = (pos1.row + shift + 5) % 5;
        row2 = (pos2.row + shift + 5) % 5;
      } else {
        // Rectangle - swap columns
        col1 = pos2.col;
        col2 = pos1.col;
      }

      return matrix[row1][col1] + matrix[row2][col2];
    }

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

      /** @type {string[][]} */
      const matrix = this._keyMatrix;
      /** @type {string} */
      const inputStr = String.fromCharCode.apply(null, this.inputBuffer);

      // Normalize input to uppercase letters only, replace J with I
      /** @type {string} */
      const upper = inputStr.toUpperCase();
      /** @type {string} */
      const normalizedInput = upper.replace(/[^A-Z]/g, '').replace(/J/g, 'I');

      if (!this.isInverse) {
        // ENCRYPTION - Prepare text for digraph processing (handle duplicate letters)
        /** @type {string} */
        let processedText = '';
        /** @type {int32} */
        let i = 0;
        while (i < normalizedInput.length) {
          /** @type {string} */
          const char1 = normalizedInput.charAt(i);

          if (i + 1 >= normalizedInput.length) {
            // Odd length - pad with X
            processedText += char1 + 'X';
            break;
          }

          /** @type {string} */
          const char2 = normalizedInput.charAt(i + 1);
          if (char1 === char2) {
            // Same characters - insert X between them
            processedText += char1 + 'X';
            i++; // Move to next character (the duplicate will be processed in next iteration)
          } else {
            // Different characters - process normally
            processedText += char1 + char2;
            i += 2; // Move to next pair
          }
        }

        // Process each digraph
        for (let p = 0; p < processedText.length; p += 2) {
          /** @type {string} */
          const result = this.processDigraph(processedText.charAt(p), processedText.charAt(p + 1), matrix, true);

          for (let k = 0; k < result.length; k++) {
            output.push(result.charCodeAt(k));
          }
        }
      } else {
        // DECRYPTION - Process digraphs directly, then clean up
        /** @type {string} */
        let decryptedText = '';

        // Process each digraph
        for (let p = 0; p < normalizedInput.length; p += 2) {
          /** @type {string} */
          const char1 = normalizedInput.charAt(p);
          /** @type {string} */
          const next = normalizedInput.charAt(p + 1);
          /** @type {string} */
          const char2 = next ? next : 'X'; // Handle odd length

          decryptedText += this.processDigraph(char1, char2, matrix, false);
        }

        // Clean up decrypted text - remove inserted X's intelligently
        /** @type {string} */
        let cleanedText = '';
        /** @type {int32} */
        let i = 0;
        while (i < decryptedText.length) {
          /** @type {string} */
          const char = decryptedText.charAt(i);
          /** @type {string} */
          const nextChar = decryptedText.charAt(i + 1);
          /** @type {string} */
          const prevChar = i > 0 ? decryptedText.charAt(i - 1) : '';

          if (char === 'X') {
            // Check if this X was likely inserted during encryption
            // 1. If X is at odd position and next char equals previous char
            // 2. If X is at the end and was padding
            if (i === decryptedText.length - 1) {
              // X at end - likely padding, skip it
              break;
            } else if (i > 0 && nextChar && prevChar === nextChar) {
              // X between duplicate letters - likely inserted, skip it
              i++;
              continue;
            }
          }

          cleanedText += char;
          i++;
        }

        // Convert cleaned text to byte array
        for (let k = 0; k < cleanedText.length; k++) {
          output.push(cleanedText.charCodeAt(k));
        }
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }
  }

  // Create algorithm instance
  const algorithm = new PlayfairCipher();

  // Register the algorithm immediately
  RegisterAlgorithm(algorithm);

  // ===== REGISTRATION =====

    const algorithmInstance = new PlayfairCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { PlayfairCipher, PlayfairCipherInstance };
}));