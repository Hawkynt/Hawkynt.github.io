/*
 * Columnar Transposition Cipher Implementation
 * Classical transposition cipher using keyword-ordered columns
 * Educational Implementation - For learning purposes only
 */

(function(global) {
  'use strict';
  
  // Load AlgorithmFramework
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    global.AlgorithmFramework = require('../../AlgorithmFramework.js');
  }
  
  // Load OpCodes for cryptographic operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    global.OpCodes = require('../../OpCodes.js');
  }
  
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
          CryptoAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = global.AlgorithmFramework;
  
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
          input: global.OpCodes ? global.OpCodes.AnsiToBytes("HELLO") : [72, 69, 76, 76, 79],
          key: global.OpCodes ? global.OpCodes.AnsiToBytes("KEY") : [75, 69, 89],
          expected: global.OpCodes ? global.OpCodes.AnsiToBytes("EOHLLX") : [69, 79, 72, 76, 76, 88]
        },
        {
          text: "Longer Text",
          uri: "https://www.dcode.fr/columnar-transposition-cipher",
          input: global.OpCodes ? global.OpCodes.AnsiToBytes("ATTACKATDAWN") : [65, 84, 84, 65, 67, 75, 65, 84, 68, 65, 87, 78],
          key: global.OpCodes ? global.OpCodes.AnsiToBytes("SECRET") : [83, 69, 67, 82, 69, 84],
          expected: global.OpCodes ? global.OpCodes.AnsiToBytes("TTXTANADXAKWCAX") : [84, 84, 88, 84, 65, 78, 65, 68, 88, 65, 75, 87, 67, 65, 88]
        },
        {
          text: "Edge Case", 
          uri: "https://en.wikipedia.org/wiki/Transposition_cipher",
          input: global.OpCodes ? global.OpCodes.AnsiToBytes("A") : [65],
          key: global.OpCodes ? global.OpCodes.AnsiToBytes("Z") : [90],
          expected: global.OpCodes ? global.OpCodes.AnsiToBytes("A") : [65]
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
      super(algorithm, isInverse);
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
      
      // Calculate column lengths
      const colLengths = new Array(numCols).fill(numRows);
      const remainder = cleanText.length % numCols;
      if (remainder > 0) {
        for (let col = 0; col < numCols; col++) {
          // Determine which columns get the extra character
          let originalCol = -1;
          for (let c = 0; c < numCols; c++) {
            if (this._columnOrder[c] === col) {
              originalCol = c;
              break;
            }
          }
          if (originalCol >= remainder) {
            colLengths[col] = numRows - 1;
          }
        }
      }
      
      // Fill grid from ciphertext
      let textPos = 0;
      for (let sortedPos = 0; sortedPos < numCols; sortedPos++) {
        // Find which original column has this sorted position
        let originalCol = -1;
        for (let col = 0; col < numCols; col++) {
          if (this._columnOrder[col] === sortedPos) {
            originalCol = col;
            break;
          }
        }
        
        // Fill this column
        for (let row = 0; row < colLengths[sortedPos]; row++) {
          if (textPos < cleanText.length) {
            grid[row][originalCol] = cleanText.charAt(textPos++);
          }
        }
      }
      
      // Read grid row by row
      let result = '';
      for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
          if (grid[row][col]) {
            result += grid[row][col];
          }
        }
      }
      
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
      return [...resultString].map(c => c.charCodeAt(0));
    }
  }
  
  // Register the algorithm
  RegisterAlgorithm(new ColumnarCipher());
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);