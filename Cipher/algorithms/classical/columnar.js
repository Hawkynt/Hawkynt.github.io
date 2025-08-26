/*
 * Columnar Transposition Cipher Implementation
 * Classical transposition cipher using keyword-ordered columns
 * Educational Implementation - For learning purposes only
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

  class ColumnarCipher extends CryptoAlgorithm {
      constructor() {
        super();
        this.name = 'Columnar Transposition';
        this.description = 'Classical transposition cipher that arranges plaintext in a grid and reads columns in keyword-alphabetical order.';
        this.category = CategoryType.CLASSICAL;
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.inventor = 'Unknown (Classical)';
        this.year = 1500;
        this.country = CountryCode.INTERNATIONAL;

        this.keySize = { min: 1, max: 50, step: 1 };
        this.blockSize = { variable: true };

        this.links = [
          new LinkItem('Wikipedia: Transposition Cipher', 'https://en.wikipedia.org/wiki/Transposition_cipher'),
          new LinkItem('Educational Tool', 'https://www.dcode.fr/columnar-transposition-cipher')
        ];

        // Test vectors using byte arrays
        this.tests = [
          {
            text: "Basic Test",
            uri: "https://en.wikipedia.org/wiki/Transposition_cipher",
            input: global.OpCodes.AnsiToBytes("HELLO"),
            key: global.OpCodes.AnsiToBytes("KEY"),
            expected: global.OpCodes.AnsiToBytes("EOHLLX")
          },
          {
            text: "Longer Text",
            uri: "https://www.dcode.fr/columnar-transposition-cipher",
            input: global.OpCodes.AnsiToBytes("ATTACKATDAWN"),
            key: global.OpCodes.AnsiToBytes("SECRET"),
            expected: global.OpCodes.AnsiToBytes("TTXTANADXAKWCAX")
          },
          {
            text: "Edge Case", 
            uri: "https://en.wikipedia.org/wiki/Transposition_cipher",
            input: global.OpCodes.AnsiToBytes("A"),
            key: global.OpCodes.AnsiToBytes("Z"),
            expected: global.OpCodes.AnsiToBytes("A")
          }
        ];

        // For the test suite compatibility 
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse) {
        return new ColumnarInstance(this, isInverse);
      }
    }

    class ColumnarInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse) {
        super(algorithm);
        this.isInverse = isInverse || false;
        this._key = '';
        this._cleanKey = '';
        this._columnOrder = [];
      }

      set key(keyData) {
        if (typeof keyData === 'string') {
          this._key = keyData;
          this.setupKey(keyData);
        } else if (Array.isArray(keyData)) {
          // Convert byte array to string
          const keyString = String.fromCharCode(...keyData);
          this._key = keyString;
          this.setupKey(keyString);
        } else if (keyData && keyData.key) {
          this.key = keyData.key;
        }
      }

      get key() {
        return this._key;
      }

      setupKey(keyString) {
        // Clean keyword: remove non-letters, convert to uppercase, remove duplicates
        let cleanKeyword = '';
        const used = {};
        for (let i = 0; i < keyString.length; i++) {
          const char = keyString.charAt(i).toUpperCase();
          if (char >= 'A' && char <= 'Z' && !used[char]) {
            cleanKeyword += char;
            used[char] = true;
          }
        }

        if (cleanKeyword.length === 0) {
          cleanKeyword = 'KEYWORD'; // Default keyword
        }

        this._cleanKey = cleanKeyword;
        this._columnOrder = this.generateColumnOrder(cleanKeyword);
      }

      generateColumnOrder(keyword) {
        const columns = [];

        // Create array of {letter, position} objects
        for (let i = 0; i < keyword.length; i++) {
          columns.push({
            letter: keyword.charAt(i),
            originalPos: i,
            sortedPos: 0
          });
        }

        // Sort by letter, then by original position for duplicates
        columns.sort((a, b) => {
          if (a.letter === b.letter) {
            return a.originalPos - b.originalPos;
          }
          return a.letter.localeCompare(b.letter);
        });

        // Assign sorted positions
        for (let i = 0; i < columns.length; i++) {
          columns[i].sortedPos = i;
        }

        // Create ordering array
        const order = new Array(keyword.length);
        for (let i = 0; i < columns.length; i++) {
          order[columns[i].originalPos] = columns[i].sortedPos;
        }

        return order;
      }

      EncryptBlock(blockIndex, plaintext) {
        if (!this._cleanKey || this._cleanKey.length === 0) {
          return plaintext;
        }

        const numCols = this._cleanKey.length;

        // Remove non-alphabetic chars, convert to uppercase
        let cleanText = '';
        for (let i = 0; i < plaintext.length; i++) {
          const char = plaintext.charAt(i).toUpperCase();
          if (char >= 'A' && char <= 'Z') {
            cleanText += char;
          }
        }

        if (cleanText.length === 0) {
          return '';
        }

        // Pad text to fill complete rows
        const numRows = Math.ceil(cleanText.length / numCols);
        while (cleanText.length < numRows * numCols) {
          cleanText += 'X'; // Padding character
        }

        // Create grid
        const grid = [];
        for (let row = 0; row < numRows; row++) {
          grid[row] = [];
          for (let col = 0; col < numCols; col++) {
            const charIndex = row * numCols + col;
            grid[row][col] = charIndex < cleanText.length ? cleanText.charAt(charIndex) : '';
          }
        }

        // Read columns in sorted order
        let result = '';
        for (let sortedPos = 0; sortedPos < numCols; sortedPos++) {
          // Find which original column position has this sorted position
          let originalCol = -1;
          for (let col = 0; col < numCols; col++) {
            if (this._columnOrder[col] === sortedPos) {
              originalCol = col;
              break;
            }
          }

          // Read this column
          for (let row = 0; row < numRows; row++) {
            if (grid[row][originalCol]) {
              result += grid[row][originalCol];
            }
          }
        }

        return result;
      }

      DecryptBlock(blockIndex, ciphertext) {
        if (!this._cleanKey || this._cleanKey.length === 0) {
          return ciphertext;
        }

        const numCols = this._cleanKey.length;
        const cleanText = ciphertext.toUpperCase();
        const numRows = Math.ceil(cleanText.length / numCols);

        if (cleanText.length === 0) {
          return '';
        }

        // Create empty grid
        const grid = [];
        for (let row = 0; row < numRows; row++) {
          grid[row] = new Array(numCols).fill('');
        }

        // Calculate how many characters each column should get
        const baseColLength = Math.floor(cleanText.length / numCols);
        const remainder = cleanText.length % numCols;
        const colLengths = new Array(numCols).fill(baseColLength);

        // First 'remainder' columns in alphabetical order get an extra character
        for (let i = 0; i < remainder; i++) {
          colLengths[i] = baseColLength + 1;
        }

        // Fill grid column by column in alphabetical order
        let textPos = 0;
        for (let alphabeticalOrder = 0; alphabeticalOrder < numCols; alphabeticalOrder++) {
          // Find which original column position has this alphabetical order
          let originalCol = -1;
          for (let col = 0; col < numCols; col++) {
            if (this._columnOrder[col] === alphabeticalOrder) {
              originalCol = col;
              break;
            }
          }

          // Fill this column with the appropriate number of characters
          for (let row = 0; row < colLengths[alphabeticalOrder]; row++) {
            if (textPos < cleanText.length) {
              grid[row][originalCol] = cleanText.charAt(textPos++);
            }
          }
        }

        // Read grid row by row to get the original text
        let result = '';
        for (let row = 0; row < numRows; row++) {
          for (let col = 0; col < numCols; col++) {
            if (grid[row][col]) {
              result += grid[row][col];
            }
          }
        }

        // Remove padding (trailing X characters that were likely added during encryption)
        result = result.replace(/X+$/, '');

        return result;
      }

      // Modern AlgorithmFramework interface - Feed/Result pattern
      Feed(data) {
        if (!data || data.length === 0) return;

        // Store input data as buffer
        if (!this.inputBuffer) {
          this.inputBuffer = [];
        }
        this.inputBuffer.push(...data);
      }

      Result() {
        if (!this.inputBuffer || this.inputBuffer.length === 0) {
          return [];
        }

        // Convert input buffer to string
        const inputString = String.fromCharCode(...this.inputBuffer);

        // Process using the block method
        const resultString = this.isInverse ? 
          this.DecryptBlock(0, inputString) : 
          this.EncryptBlock(0, inputString);

        // Clear input buffer for next operation
        this.inputBuffer = [];

        // Convert result string back to byte array
        return OpCodes.AnsiToBytes(resultString);
      }
    }

  // ===== REGISTRATION =====

    const algorithmInstance = new ColumnarCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ColumnarCipher, ColumnarInstance };
}));