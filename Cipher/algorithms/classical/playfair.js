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
        {
          type: "Digraph Frequency Analysis",
          text: "Common digraph patterns in plaintext create patterns in ciphertext, enabling cryptanalysis",
          uri: "https://en.wikipedia.org/wiki/Frequency_analysis",
          mitigation: "Educational use only - use modern ciphers for real security"
        },
        {
          type: "Known Plaintext Attack",
          text: "If plaintext-ciphertext pairs are known, key matrix can be reconstructed",
          uri: "https://en.wikipedia.org/wiki/Known-plaintext_attack",
          mitigation: "Avoid using with predictable or repeated messages"
        }
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
      this.testVectors = this.tests;
    }

    // Create instance for this algorithm
    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new PlayfairCipherInstance(this, isInverse);
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
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = [];
      this.inputBuffer = [];

      // Playfair uses 5x5 grid (I=J)
      this.ALPHABET = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'; // Note: no J
    }

    // Property setter for key
    set key(keyData) {
      if (!keyData || keyData.length === 0) {
        this._keyMatrix = this.createMatrix("KEYWORD"); // Default key
      } else {
        // Convert key bytes to uppercase letters only
        const keyStr = String.fromCharCode.apply(null, keyData);
        const processedKey = keyStr.toUpperCase().replace(/[^A-Z]/g, '').replace(/J/g, 'I');
        this._keyMatrix = this.createMatrix(processedKey || "KEYWORD");
      }
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._keyMatrix;
    }

    // Create 5x5 Playfair key matrix
    createMatrix(key) {
      const alphabet = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'; // Note: no J
      const used = new Set();
      const matrix = [];

      // Add unique characters from key first
      for (const char of key) {
        if (alphabet.includes(char) && !used.has(char)) {
          matrix.push(char);
          used.add(char);
        }
      }

      // Fill remaining positions with unused alphabet letters
      for (const char of alphabet) {
        if (!used.has(char)) {
          matrix.push(char);
        }
      }

      // Convert to 5x5 grid
      const grid = [];
      for (let i = 0; i < 5; i++) {
        grid[i] = matrix.slice(i * 5, (i + 1) * 5);
      }

      return grid;
    }

    // Find position of character in matrix
    findPosition(char, matrix) {
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          if (matrix[row][col] === char) {
            return {row, col};
          }
        }
      }
      return null;
    }

    // Process digraph according to Playfair rules
    processDigraph(char1, char2, matrix, encrypt = true) {
      const pos1 = this.findPosition(char1, matrix);
      const pos2 = this.findPosition(char2, matrix);

      if (!pos1 || !pos2) return char1 + char2; // Fallback

      let newPos1, newPos2;

      if (pos1.row === pos2.row) {
        // Same row - move horizontally
        const shift = encrypt ? 1 : -1;
        newPos1 = {row: pos1.row, col: (pos1.col + shift + 5) % 5};
        newPos2 = {row: pos2.row, col: (pos2.col + shift + 5) % 5};
      } else if (pos1.col === pos2.col) {
        // Same column - move vertically
        const shift = encrypt ? 1 : -1;
        newPos1 = {row: (pos1.row + shift + 5) % 5, col: pos1.col};
        newPos2 = {row: (pos2.row + shift + 5) % 5, col: pos2.col};
      } else {
        // Rectangle - swap columns
        newPos1 = {row: pos1.row, col: pos2.col};
        newPos2 = {row: pos2.row, col: pos1.col};
      }

      return matrix[newPos1.row][newPos1.col] + matrix[newPos2.row][newPos2.col];
    }

    // Feed data to the cipher
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Add data to input buffer
      this.inputBuffer.push(...data);
    }

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
      const matrix = this.key;
      const inputStr = String.fromCharCode.apply(null, this.inputBuffer);

      // Normalize input to uppercase letters only, replace J with I
      let normalizedInput = inputStr.toUpperCase().replace(/[^A-Z]/g, '').replace(/J/g, 'I');

      if (!this.isInverse) {
        // ENCRYPTION - Prepare text for digraph processing (handle duplicate letters)
        let processedText = '';
        let i = 0;
        while (i < normalizedInput.length) {
          let char1 = normalizedInput[i];
          let char2 = normalizedInput[i + 1];

          if (char2 === undefined) {
            // Odd length - pad with X
            processedText += char1 + 'X';
            break;
          } else if (char1 === char2) {
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
        for (let i = 0; i < processedText.length; i += 2) {
          const char1 = processedText[i];
          const char2 = processedText[i + 1];

          const result = this.processDigraph(char1, char2, matrix, true);

          for (const char of result) {
            output.push(char.charCodeAt(0));
          }
        }
      } else {
        // DECRYPTION - Process digraphs directly, then clean up
        let decryptedText = '';

        // Process each digraph
        for (let i = 0; i < normalizedInput.length; i += 2) {
          const char1 = normalizedInput[i];
          const char2 = normalizedInput[i + 1] || 'X'; // Handle odd length

          const result = this.processDigraph(char1, char2, matrix, false);
          decryptedText += result;
        }

        // Clean up decrypted text - remove inserted X's intelligently
        let cleanedText = '';
        let i = 0;
        while (i < decryptedText.length) {
          const char = decryptedText[i];
          const nextChar = decryptedText[i + 1];
          const prevChar = i > 0 ? decryptedText[i - 1] : '';

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
        for (const char of cleanedText) {
          output.push(char.charCodeAt(0));
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

  // Export for Node.js compatibility
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = algorithm;
  }

  // ===== REGISTRATION =====

    const algorithmInstance = new PlayfairCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { PlayfairCipher, PlayfairCipherInstance };
}));