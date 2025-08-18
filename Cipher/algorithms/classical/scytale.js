#!/usr/bin/env node
/*
 * Scytale Transposition Cipher Universal Implementation
 * Based on the ancient Spartan military cipher (~7th century BCE)
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation - Historical cipher for learning purposes
 * The Scytale uses a transposition method with a rod of specific diameter
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
      console.error('Scytale cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Load OpCodes for common operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const Scytale = {
    // Public interface properties
    internalName: 'Scytale',
    name: 'Scytale Transposition Cipher',
    comment: 'Ancient Spartan cipher (~7th century BCE) - columnar transposition using rod diameter',
    minKeyLength: 1, // Number of turns/columns
    maxKeyLength: 50, // Practical limit
    stepKeyLength: 1,
    minBlockSize: 1,
    maxBlockSize: 0, // No limit
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
    // Test vectors from historical reconstructions
    testVectors: [
      {
        input: 'IAMHURTVERYBADLYHELP',
        key: '5', // 5 turns around the rod
        expected: 'IRYYATBH MLHUPERVELD',
        description: 'Classic Scytale example - military message'
      },
      {
        input: 'ATTACKATDAWN',
        key: '4',
        expected: 'ACKTAWNT TAKA D',
        description: 'Military command with 4 turns'
      },
      {
        input: 'DEFENDTHEEAST',
        key: '3',
        expected: 'DFEEH ENTTS EDEA',
        description: 'Defense command with 3 turns'
      },
      {
        input: 'SPARTAN',
        key: '7',
        expected: 'SPARTAN',
        description: 'Text length equals key - no transposition'
      }
    ],
    
    // Initialize Scytale
    Init: function() {
      Scytale.isInitialized = true;
    },
    
    // Set up key for Scytale
    KeySetup: function(key) {
      let id;
      do {
        id = 'Scytale[' + global.generateUniqueID() + ']';
      } while (Scytale.instances[id] || global.objectInstances[id]);
      
      Scytale.instances[szID] = new Scytale.ScytaleInstance(key);
      global.objectInstances[szID] = true;
      return szID;
    },
    
    // Clear Scytale data
    ClearData: function(id) {
      if (Scytale.instances[id]) {
        delete Scytale.instances[szID];
        delete global.objectInstances[szID];
      }
    },
    
    // Encrypt using Scytale
    encryptBlock: function(intInstanceID, szInput) {
      const id = 'Scytale[' + intInstanceID + ']';
      if (!Scytale.instances[id]) return '';
      
      return Scytale.instances[szID].encrypt(szInput);
    },
    
    // Decrypt using Scytale
    decryptBlock: function(intInstanceID, szInput) {
      const id = 'Scytale[' + intInstanceID + ']';
      if (!Scytale.instances[id]) return '';
      
      return Scytale.instances[szID].decrypt(szInput);
    },
    
    // Scytale Instance Class
    ScytaleInstance: function(key) {
      // Parse the key as number of turns (columns)
      this.turns = parseInt(key) || 3; // Default to 3 turns
      
      if (this.turns < 1 || this.turns > 50) {
        throw new Error('Scytale: Number of turns must be between 1 and 50');
      }
    },
    
    // Encrypt function (write down columns, read across rows)
    encrypt: function(plaintext) {
      // Remove spaces for historical accuracy, preserve case
      const text = plaintext.replace(/\s/g, '');
      
      if (text.length === 0) return '';
      if (this.turns === 1) return text; // No transposition needed
      
      // Calculate number of rows needed
      const rows = Math.ceil(text.length / this.turns);
      
      // Create grid and fill by columns
      const grid = [];
      for (let r = 0; r < rows; r++) {
        grid[r] = new Array(this.turns).fill(' '); // Fill with spaces for padding
      }
      
      // Fill grid column by column (writing down the scytale)
      let textIndex = 0;
      for (let col = 0; col < this.turns; col++) {
        for (let row = 0; row < rows; row++) {
          if (textIndex < text.length) {
            grid[row][col] = text[textIndex];
            textIndex++;
          }
        }
      }
      
      // Read grid row by row (reading across when unwrapped)
      let result = '';
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < this.turns; col++) {
          result += grid[row][col];
        }
        // Add space between rows for readability (historical texts often had word breaks)
        if (row < rows - 1) {
          result += ' ';
        }
      }
      
      return result;
    },
    
    // Decrypt function (write down rows, read across columns)
    decrypt: function(ciphertext) {
      // Remove extra spaces added during encryption
      const text = ciphertext.replace(/\s+/g, '');
      
      if (text.length === 0) return '';
      if (this.turns === 1) return text;
      
      // Calculate dimensions
      const rows = Math.ceil(text.length / this.turns);
      
      // Create grid and fill by rows
      const grid = [];
      for (let r = 0; r < rows; r++) {
        grid[r] = new Array(this.turns).fill('');
      }
      
      // Fill grid row by row (writing across when wrapped around scytale)
      let textIndex = 0;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < this.turns; col++) {
          if (textIndex < text.length) {
            grid[row][col] = text[textIndex];
            textIndex++;
          }
        }
      }
      
      // Read grid column by column (reading down the scytale)
      let result = '';
      for (let col = 0; col < this.turns; col++) {
        for (let row = 0; row < rows; row++) {
          if (grid[row][col] && grid[row][col] !== ' ') {
            result += grid[row][col];
          }
        }
      }
      
      return result;
    },
    
    // Visualize the scytale process for educational purposes
    visualizeEncryption: function(plaintext) {
      const text = plaintext.replace(/\s/g, '');
      if (text.length === 0) return 'Empty input';
      
      const rows = Math.ceil(text.length / this.turns);
      let visualization = `Scytale with ${this.turns} turns (${rows} rows):\n\n`;
      
      // Show the grid
      const grid = [];
      for (let r = 0; r < rows; r++) {
        grid[r] = new Array(this.turns).fill('·'); // Use · for empty spaces
      }
      
      // Fill grid column by column
      let textIndex = 0;
      for (let col = 0; col < this.turns; col++) {
        for (let row = 0; row < rows; row++) {
          if (textIndex < text.length) {
            grid[row][col] = text[textIndex];
            textIndex++;
          }
        }
      }
      
      // Display grid with column headers
      visualization += '   ';
      for (let col = 0; col < this.turns; col++) {
        visualization += (col + 1) + ' ';
      }
      visualization += '\n';
      
      for (let row = 0; row < rows; row++) {
        visualization += (row + 1) + ': ';
        for (let col = 0; col < this.turns; col++) {
          visualization += grid[row][col] + ' ';
        }
        visualization += '\n';
      }
      
      visualization += '\nReading across rows gives: ' + this.encrypt(plaintext);
      
      return visualization;
    }
  };
  
  // Add the methods to the prototype
  Scytale.ScytaleInstance.prototype.encrypt = Scytale.encrypt;
  Scytale.ScytaleInstance.prototype.decrypt = Scytale.decrypt;
  Scytale.ScytaleInstance.prototype.visualizeEncryption = Scytale.visualizeEncryption;
  
  // Auto-register with Cipher system
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(Scytale);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Scytale;
  }
  
})(typeof global !== 'undefined' ? global : window);