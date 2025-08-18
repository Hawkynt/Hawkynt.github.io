/*
 * Universal Columnar Transposition Cipher
 * Compatible with both Browser and Node.js environments
 * Classical transposition cipher using keyword-ordered columns
 * (c)2025 Hawkynt - Educational implementation
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.Cipher) {
    if (typeof require !== 'undefined') {
      try {
        require('../../universal-cipher-env.js');
        require('../../cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('Columnar Transposition cipher requires Cipher system to be loaded first');
      return;
    }
  }

  // Create Columnar Transposition cipher object
  const Columnar = {
    // Public interface properties
    internalName: 'Columnar',
    name: 'Columnar Transposition Cipher',
    comment: 'Classical transposition cipher using keyword-ordered columns',
    minKeyLength: 1,
    maxKeyLength: 50,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,

    // ===== COMPREHENSIVE METADATA =====
    metadata: {
      description: 'The Columnar Transposition cipher arranges plaintext in a grid, then reads columns in keyword-alphabetical order to create ciphertext.',
      country: 'INTERNATIONAL',
      countryName: 'International',
      nYear: 1500, // Approximate historical usage
      inventor: 'Unknown (Classical)',
      
      category: 'classical',
      categoryName: 'Classical Cipher',
      type: 'transposition',
      securityLevel: 'obsolete',
      complexity: 'intermediate',
      
      blockSize: 0, // Variable length
      keySizes: [1], // Keyword length
      keyType: 'text',
      symmetric: true,
      deterministic: true,
      
      tags: ['historical', 'educational', 'broken', 'transposition', 'columns'],
      educationalLevel: 'intermediate',
      prerequisites: ['basic_transposition', 'alphabetical_ordering'],
      learningObjectives: 'Understanding columnar transposition and keyword-based ordering',
      
      secure: false,
      deprecated: true,
      securityWarning: 'OBSOLETE: Vulnerable to frequency analysis and statistical attacks. For educational purposes only.',
      vulnerabilities: ['frequency_analysis', 'anagramming', 'known_plaintext', 'statistical_analysis']
    },

    // Initialize cipher
    Init: function() {
      this.isInitialized = true;
      return true;
    },

    // Generate column order from keyword
    generateColumnOrder: function(keyword) {
      const keywordUpper = keyword.toUpperCase();
      const columns = [];
      
      // Create array of {letter, position} objects
      for (let i = 0; i < keywordUpper.length; i++) {
        columns.push({
          letter: keywordUpper.charAt(i),
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
      const order = new Array(keywordUpper.length);
      for (let i = 0; i < columns.length; i++) {
        order[columns[i].originalPos] = columns[i].sortedPos;
      }
      
      return order;
    },

    // Set up key
    KeySetup: function(optional_key) {
      let id;
      do {
        id = 'Columnar[' + global.generateUniqueID() + ']';
      } while (Columnar.instances[id] || global.objectInstances[id]);
      
      try {
        Columnar.instances[id] = new Columnar.ColumnarInstance(optional_key);
        global.objectInstances[id] = true;
        return id;
      } catch (e) {
        global.throwException('Key Setup Exception', e.message, 'Columnar', 'KeySetup');
        return null;
      }
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Columnar.instances[id]) {
        delete Columnar.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Columnar', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block
    encryptBlock: function(id, plaintext) {
      if (!Columnar.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Columnar', 'encryptBlock');
        return plaintext;
      }
      
      const instance = Columnar.instances[id];
      const keyword = instance.keyword;
      const columnOrder = instance.columnOrder;
      const numCols = keyword.length;
      
      if (plaintext.length === 0) {
        return '';
      }
      
      // Remove spaces and non-alphabetic chars, convert to uppercase
      let cleanText = '';
      for (let i = 0; i < plaintext.length; i++) {
        const char = plaintext.charAt(i).toUpperCase();
        if (char >= 'A' && char <= 'Z') {
          cleanText += char;
        }
      }
      
      // Pad text to fill complete rows (optional - could leave incomplete)
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
          if (columnOrder[col] === sortedPos) {
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
    },
    
    // Decrypt block
    decryptBlock: function(id, ciphertext) {
      if (!Columnar.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Columnar', 'decryptBlock');
        return ciphertext;
      }
      
      const instance = Columnar.instances[id];
      const keyword = instance.keyword;
      const columnOrder = instance.columnOrder;
      const numCols = keyword.length;
      
      if (ciphertext.length === 0) {
        return '';
      }
      
      const cleanText = ciphertext.toUpperCase();
      const numRows = Math.ceil(cleanText.length / numCols);
      
      // Create empty grid
      const grid = [];
      for (let row = 0; row < numRows; row++) {
        grid[row] = new Array(numCols).fill('');
      }
      
      // Calculate column lengths (some may be shorter if text doesn't fill grid)
      const colLengths = new Array(numCols).fill(numRows);
      const remainder = cleanText.length % numCols;
      if (remainder > 0) {
        for (let col = 0; col < numCols; col++) {
          // Determine which columns get the extra character
          let originalCol = -1;
          for (let c = 0; c < numCols; c++) {
            if (columnOrder[c] === col) {
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
          if (columnOrder[col] === sortedPos) {
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
    },
    
    // Add uppercase aliases for compatibility with test runner
    EncryptBlock: function(id, plaintext) {
      return this.encryptBlock(id, plaintext);
    },
    
    DecryptBlock: function(id, ciphertext) {
      return this.decryptBlock(id, ciphertext);
    },
    
    // Instance class
    ColumnarInstance: function(key) {
      // Use default keyword if none provided
      this.keyword = (key && key.length > 0) ? key.toUpperCase() : 'KEYWORD';
      
      // Remove duplicates from keyword
      let cleanKeyword = '';
      const used = {};
      for (let i = 0; i < this.keyword.length; i++) {
        const char = this.keyword.charAt(i);
        if (char >= 'A' && char <= 'Z' && !used[char]) {
          cleanKeyword += char;
          used[char] = true;
        }
      }
      
      if (cleanKeyword.length === 0) {
        throw new Error('Invalid keyword: must contain at least one letter');
      }
      
      this.keyword = cleanKeyword;
      this.columnOrder = Columnar.generateColumnOrder(this.keyword);
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(Columnar);
  
  global.Columnar = Columnar;
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);