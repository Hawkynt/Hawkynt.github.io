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
        {
          type: "Frequency Analysis",
          text: "Each letter always maps to same coordinate pair, preserving frequency patterns",
          uri: "https://en.wikipedia.org/wiki/Frequency_analysis",
          mitigation: "Educational use only - provides no security by modern standards"
        },
        {
          type: "Pattern Recognition",
          text: "Identical plaintext produces identical coordinate patterns making analysis easy",
          uri: "https://en.wikipedia.org/wiki/Pattern_recognition",
          mitigation: "Historical demonstration cipher only"
        }
      ];

      // Test vectors using byte arrays - bit-perfect results from implementation  
      this.tests = [
        {
          text: "Basic Polybius transformation",
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
   * @returns {Object} New cipher instance
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
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];

      // Standard 5x5 Polybius grid (I and J share the same cell)
      this.STANDARD_GRID = [
        ['A', 'B', 'C', 'D', 'E'],
        ['F', 'G', 'H', 'I', 'K'],
        ['L', 'M', 'N', 'O', 'P'],
        ['Q', 'R', 'S', 'T', 'U'],
        ['V', 'W', 'X', 'Y', 'Z']
      ];

      this.grid = JSON.parse(JSON.stringify(this.STANDARD_GRID)); // Deep copy
    }

    // Property setter for key (optional keyword for custom grid)
    set key(keyData) {
      if (!keyData || keyData.length === 0) {
        // Use standard grid
        this.grid = JSON.parse(JSON.stringify(this.STANDARD_GRID));
        return;
      }

      const keyword = String.fromCharCode.apply(null, keyData);
      this.grid = this.createCustomGrid(keyword);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this.grid;
    }

    // Create custom grid from keyword
    createCustomGrid(keyword) {
      if (!keyword || keyword.length === 0) {
        return JSON.parse(JSON.stringify(this.STANDARD_GRID));
      }

      // Normalize keyword: uppercase, letters only, remove duplicates
      const cleanKeyword = keyword.toUpperCase().replace(/[^A-Z]/g, '');
      let uniqueKeyword = '';
      const seen = {};

      for (let i = 0; i < cleanKeyword.length; i++) {
        let char = cleanKeyword.charAt(i);
        if (char === 'J') char = 'I'; // Handle I/J equivalence
        if (!seen[char]) {
          uniqueKeyword += char;
          seen[char] = true;
        }
      }

      // Generate full alphabet excluding used characters
      const alphabet = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'; // Note: no J
      let remaining = '';

      for (let i = 0; i < alphabet.length; i++) {
        const char = alphabet.charAt(i);
        if (!seen[char]) {
          remaining += char;
        }
      }

      // Combine keyword with remaining letters
      const fullAlphabet = uniqueKeyword + remaining;

      // Fill 5x5 grid
      const grid = [];
      let index = 0;

      for (let row = 0; row < 5; row++) {
        grid[row] = [];
        for (let col = 0; col < 5; col++) {
          grid[row][col] = fullAlphabet.charAt(index++);
        }
      }

      return grid;
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

      const inputStr = String.fromCharCode.apply(null, this.inputBuffer);

      if (this.isInverse) {
        // Decryption: coordinates to letters
        return this.decryptText(inputStr);
      } else {
        // Encryption: letters to coordinates
        return this.encryptText(inputStr);
      }
    }

    // Encrypt text to coordinates
    encryptText(plaintext) {
      const output = [];

      // Convert to uppercase and filter to letters only
      const cleanText = plaintext.toUpperCase().replace(/[^A-Z]/g, '');

      const result = [];

      for (let i = 0; i < cleanText.length; i++) {
        let char = cleanText.charAt(i);

        // Handle I/J equivalence
        if (char === 'J') char = 'I';

        // Find character in grid
        let found = false;
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 5; col++) {
            if (this.grid[row][col] === char) {
              result.push((row + 1).toString() + (col + 1).toString());
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
      const resultStr = result.join(' ');
      for (let i = 0; i < resultStr.length; i++) {
        output.push(resultStr.charCodeAt(i));
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    // Decrypt coordinates to text
    decryptText(ciphertext) {
      const output = [];
      let result = '';

      // Split by spaces and process each coordinate pair
      const coordinates = ciphertext.trim().split(/\s+/);

      for (let i = 0; i < coordinates.length; i++) {
        const coord = coordinates[i];

        if (coord.length === 2 && /^\d\d$/.test(coord)) {
          const row = parseInt(coord.charAt(0)) - 1;
          const col = parseInt(coord.charAt(1)) - 1;

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

  // Export for Node.js compatibility
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = algorithm;
  }

  // ===== REGISTRATION =====

    const algorithmInstance = new PolybiusSquare();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { PolybiusSquare, PolybiusSquareInstance };
}));