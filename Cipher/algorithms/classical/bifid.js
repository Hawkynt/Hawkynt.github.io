/*
 * Bifid Cipher Implementation
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

  class BifidCipher extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Bifid Cipher";
      this.description = "Fractionating cipher invented by Félix Delastelle in 1901. Combines Polybius square with transposition, replacing each letter with two coordinates then rearranging them in blocks. Significantly stronger than simple substitution ciphers.";
      this.inventor = "Félix Delastelle";
      this.year = 1901;
      this.category = CategoryType.CLASSICAL;
      this.subCategory = "Classical Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.FR;

      // Standard Polybius square (5x5 grid, I/J combined)
      /** @type {string[][]} */
      this.STANDARD_GRID = [
        ['A', 'B', 'C', 'D', 'E'],
        ['F', 'G', 'H', 'I', 'K'],
        ['L', 'M', 'N', 'O', 'P'],
        ['Q', 'R', 'S', 'T', 'U'],
        ['V', 'W', 'X', 'Y', 'Z']
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Bifid_cipher"),
        new LinkItem("Historical Context", "https://en.wikipedia.org/wiki/F%C3%A9lix_Delastelle"),
        new LinkItem("Educational Tutorial", "https://www.dcode.fr/bifid-cipher")
      ];

      this.references = [
        new LinkItem("dCode Implementation", "https://www.dcode.fr/bifid-cipher"),
        new LinkItem("Practical Cryptography", "https://practicalcryptography.com/ciphers/classical-era/bifid/"),
        new LinkItem("CrypTool Portal", "https://www.cryptool.org/en/cto/bifid")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Frequency Analysis",
          "While more resistant than monoalphabetic ciphers, still vulnerable to frequency analysis with sufficient text",
          "Use variable block sizes and longer keywords",
          "https://en.wikipedia.org/wiki/Bifid_cipher#Cryptanalysis"
        ),
        new Vulnerability(
          "Grid Recovery",
          "Custom keyword grids can sometimes be recovered through cryptanalysis",
          "Educational use only - not suitable for actual security",
          "https://practicalcryptography.com/ciphers/classical-era/bifid/"
        )
      ];

      // Test vectors using byte arrays
      this.tests = [
        {
          // Wikipedia's square is given outright rather than derived from a
          // keyword; feeding all 25 of its letters in as the keyword lays the
          // same square out.
          text: "Wikipedia worked example - square BGWKZ/QPNDS/IOAXE/FCLUM/THYVR, FLEEATONCE taken as one block",
          uri: "https://en.wikipedia.org/wiki/Bifid_cipher",
          input: OpCodes.AnsiToBytes("FLEEATONCE"),
          key: OpCodes.AnsiToBytes("BGWKZQPNDSIOAXEFCLUMTHYVR,10"),
          expected: OpCodes.AnsiToBytes("UAEOLWRINS")
        },
        {
          text: "Plain A-Z square, period 5. The Wikipedia article carries no value for this input; the vector covers the unkeyed square",
          uri: "https://en.wikipedia.org/wiki/Bifid_cipher",
          input: OpCodes.AnsiToBytes("HELLO"),
          key: OpCodes.AnsiToBytes("5"), // period of 5
          expected: OpCodes.AnsiToBytes("FNNVD")
        },
        {
          text: "Keyword CIPHER, period 3. dCode carries no value for this input; the vector covers a keyed square and a block shorter than the message",
          uri: "https://www.dcode.fr/bifid-cipher",
          input: OpCodes.AnsiToBytes("ATTACK"),
          key: OpCodes.AnsiToBytes("CIPHER,3"), // keyword CIPHER, period 3
          expected: OpCodes.AnsiToBytes("DQTRKI")
        },
        {
          text: "Period 1 - a single-letter block is its own coordinate pair, so one letter passes through unchanged",
          uri: "https://en.wikipedia.org/wiki/Bifid_cipher",
          input: OpCodes.AnsiToBytes("A"),
          key: OpCodes.AnsiToBytes("1"), // period of 1
          expected: OpCodes.AnsiToBytes("A")
        }
      ];

      // For the test suite compatibility 
      this.testVectors = this.tests;
    }

    // Create instance for this algorithm
    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {BifidCipherInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new BifidCipherInstance(this, isInverse);
    }
  }

  // Instance class - handles the actual encryption/decryption
  /**
 * BifidCipher cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class BifidCipherInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {BifidCipher} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {string[][]} */
      this.standardGrid = algorithm.STANDARD_GRID;
      /** @type {string} */
      this.keyword = "";
      /** @type {int32} */
      this.period = 5; // Default period
      /** @type {string[][]} */
      this.grid = this._standardGridCopy(); // Copy standard grid
      /** @type {uint8[]} */
      this.inputBuffer = [];
    }

    /**
     * @returns {string[][]} Deep copy of the standard grid
     */
    _standardGridCopy() {
      /** @type {string[][]} */
      const copy = [];
      for (let r = 0; r < this.standardGrid.length; r++) copy.push(this.standardGrid[r].slice());
      return copy;
    }

    /**
     * Key as "keyword,period", just "period", or just a keyword
     * @param {uint8[]|null} keyData - Key bytes, or null/empty for the standard grid and period 5
     */
    set key(keyData) {
      this._keyBytes = keyData ? Array.from(keyData) : null;
      if (!keyData || keyData.length === 0) {
        this.keyword = "";
        this.period = 5;
        this.grid = this._standardGridCopy();
        return;
      }

      // Convert byte array to string
      /** @type {string} */
      const keyString = String.fromCharCode(...keyData);

      // Parse key string (format: "keyword,period" or just "period")
      /** @type {string[]} */
      const parts = keyString.split(',');

      if (parts.length === 2) {
        // Has keyword and period
        /** @type {string} */
        const upper = parts[0].toUpperCase();
        this.keyword = upper.replace(/[^A-Z]/g, '');
        /** @type {int32} */
        const parsed = parseInt(parts[1]);
        this.period = parsed ? parsed : 5;
      } else if (parts.length === 1) {
        // Check if it's just a number (period) or keyword
        /** @type {int32} */
        const num = parseInt(parts[0]);
        /** @type {boolean} */
        const notANumber = isNaN(num);
        if (!notANumber && num > 0) {
          // It's just a period
          this.keyword = "";
          this.period = num;
        } else {
          // It's just a keyword
          /** @type {string} */
          const upper = parts[0].toUpperCase();
          this.keyword = upper.replace(/[^A-Z]/g, '');
          this.period = 5; // Default period
        }
      }

      // Ensure period is at least 1
      if (this.period < 1) this.period = 1;

      // Create custom grid if keyword provided
      if (this.keyword.length > 0) {
        this.grid = this.createCustomGrid(this.keyword);
      } else {
        this.grid = this._standardGridCopy();
      }
    }

    /**
   * @returns {uint8[]|null} The key bytes as set
   */

    get key() {
      return this._keyBytes || null;
    }

    /**
     * Create custom Polybius grid from keyword
     * @param {string} keyword - Keyword; only A-Z except J counts
     * @returns {string[][]} 5x5 grid
     */
    createCustomGrid(keyword) {
      if (!keyword || keyword.length === 0) {
        return this._standardGridCopy();
      }

      // Start with empty grid
      /** @type {string[][]} */
      const grid = [];
      for (let r = 0; r < 5; r++) {
        /** @type {string[]} */
        const cells = [];
        grid.push(cells);
      }
      /** @type {string} */
      let used = '';
      /** @type {int32} */
      let row = 0;
      /** @type {int32} */
      let col = 0;

      // Add keyword letters first (removing duplicates)
      for (let i = 0; i < keyword.length; i++) {
        /** @type {string} */
        const char = keyword.charAt(i);
        if (char >= 'A' && char <= 'Z' && used.indexOf(char) < 0 && char !== 'J') {
          grid[row][col] = char;
          used += char;
          col++;
          if (col >= 5) {
            col = 0;
            row++;
          }
          if (row >= 5) break;
        }
      }

      // Fill remaining positions with unused letters (I/J treated as I)
      /** @type {string} */
      const alphabet = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'; // Note: no J
      for (let i = 0; i < alphabet.length; i++) {
        /** @type {string} */
        const char = alphabet.charAt(i);
        if (used.indexOf(char) < 0 && row < 5) {
          grid[row][col] = char;
          used += char;
          col++;
          if (col >= 5) {
            col = 0;
            row++;
          }
        }
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

      // Convert input buffer to string and clean (letters only, uppercase)
      /** @type {string} */
      const inputString = String.fromCharCode(...this.inputBuffer);
      /** @type {string} */
      const upper = inputString.toUpperCase();
      /** @type {string} */
      const cleanText = upper.replace(/[^A-Z]/g, '');

      // Process using Bifid algorithm
      /** @type {string} */
      const resultString = this.isInverse ?
        this.decrypt(cleanText) :
        this.encrypt(cleanText);

      // Clear input buffer for next operation
      this.inputBuffer = [];

      // Convert result string back to byte array
      return OpCodes.AnsiToBytes(resultString);
    }

    /**
     * Encrypt using Bifid cipher
     * @param {string} plaintext - Upper-case letters
     * @returns {string} Ciphertext
     */
    encrypt(plaintext) {
      if (plaintext.length === 0) return '';

      /** @type {string} */
      let result = '';

      // Process text in blocks of 'period' length
      for (let blockStart = 0; blockStart < plaintext.length; blockStart += this.period) {
        /** @type {int32} */
        const blockEnd = Math.min(blockStart + this.period, plaintext.length);
        /** @type {string} */
        const block = plaintext.substring(blockStart, blockEnd);
        result += this.processBlock(block, true);
      }

      return result;
    }

    /**
     * Decrypt using Bifid cipher
     * @param {string} ciphertext - Upper-case letters
     * @returns {string} Plaintext
     */
    decrypt(ciphertext) {
      if (ciphertext.length === 0) return '';

      /** @type {string} */
      let result = '';

      // Process text in blocks of 'period' length
      for (let blockStart = 0; blockStart < ciphertext.length; blockStart += this.period) {
        /** @type {int32} */
        const blockEnd = Math.min(blockStart + this.period, ciphertext.length);
        /** @type {string} */
        const block = ciphertext.substring(blockStart, blockEnd);
        result += this.processBlock(block, false);
      }

      return result;
    }

    /**
     * Process a single block (encrypt or decrypt)
     * @param {string} block - Upper-case letters
     * @param {boolean} encrypt - True to encrypt
     * @returns {string} Transformed block (letters missing from the grid are dropped)
     */
    processBlock(block, encrypt) {
      if (block.length === 0) {
        return '';
      }

      // Coordinates of the block's letters, as rows and columns
      /** @type {int32[]} */
      let rows = [];
      /** @type {int32[]} */
      let cols = [];

      // Convert characters to coordinates
      for (let i = 0; i < block.length; i++) {
        /** @type {string} */
        let char = block.charAt(i);
        if (char === 'J') char = 'I'; // Handle I/J equivalence

        // Find character in grid
        /** @type {boolean} */
        let found = false;
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 5; col++) {
            if (this.grid[row][col] === char) {
              rows.push(row);
              cols.push(col);
              found = true;
              break;
            }
          }
          if (found) break;
        }
        // A character not found in the grid is skipped
      }

      if (rows.length === 0) {
        return '';
      }

      /** @type {int32[]} */
      const newRows = [];
      /** @type {int32[]} */
      const newCols = [];

      if (encrypt) {
        // For encryption: concatenate rows then columns, then pair them up
        /** @type {int32[]} */
        const combined = rows.concat(cols);
        for (let i = 0; i < combined.length; i += 2) {
          if (i + 1 < combined.length) {
            newRows.push(combined[i]);
            newCols.push(combined[i + 1]);
          } else {
            // Odd number of coordinates, use same value for both
            newRows.push(combined[i]);
            newCols.push(combined[i]);
          }
        }
      } else {
        // For decryption: extract alternating elements back into rows and columns
        /** @type {int32[]} */
        const combined = [];
        for (let i = 0; i < rows.length; i++) {
          combined.push(rows[i]);
          combined.push(cols[i]);
        }

        /** @type {int32} */
        const halfLen = Math.floor(combined.length / 2);
        rows = combined.slice(0, halfLen);
        cols = combined.slice(halfLen);

        for (let i = 0; i < rows.length; i++) {
          newRows.push(rows[i]);
          newCols.push(cols[i]);
        }
      }

      // Convert coordinates back to characters
      /** @type {string} */
      let result = '';
      for (let i = 0; i < newRows.length; i++) {
        /** @type {int32} */
        const r = newRows[i];
        /** @type {int32} */
        const c = newCols[i];
        if (r >= 0 && r < 5 && c >= 0 && c < 5) {
          result += this.grid[r][c];
        }
      }

      return result;
    }
  }

  // Register the algorithm immediately

  // ===== REGISTRATION =====

    const algorithmInstance = new BifidCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BifidCipher, BifidCipherInstance };
}));