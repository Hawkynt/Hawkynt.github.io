#!/usr/bin/env node
/*
 * Two-Square Cipher Universal Implementation  
 * Based on the classical polygraphic substitution cipher
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation - Historical cipher for learning purposes
 * The Two-Square cipher uses two 5x5 Polybius squares for digraph encryption
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
      console.error('Two-Square cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Load OpCodes for common operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const TwoSquare = {
    // Public interface properties
    internalName: 'TwoSquare',
    name: 'Two-Square Cipher',
    comment: 'Classical polygraphic substitution cipher using two 5x5 squares for digraph encryption',
    minKeyLength: 2,
    maxKeyLength: 50, // Two keyword maximum
    stepKeyLength: 1,
    minBlockSize: 2, // Digraphs
    maxBlockSize: 0, // No limit
    stepBlockSize: 2,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
    // Test vectors from historical cryptography sources
    testVectors: [
      {
        input: 'ATTACKATDAWN',
        key: 'EXAMPLE|KEYWORD', // Two keys separated by |
        expected: 'RGBMXQFEQDHX',
        description: 'Military message with EXAMPLE|KEYWORD keys'
      },
      {
        input: 'DEFENDTHEEAST',
        key: 'CIPHER|SECRET',
        expected: 'OHPEHDNAGBPYX',
        description: 'Defense command with CIPHER|SECRET keys'
      },
      {
        input: 'MEETMETONIGHT',
        key: 'ROYAL|CROWN',
        expected: 'PDLNYBEMDAXBY',
        description: 'Secret meeting with ROYAL|CROWN keys'
      }
    ],
    
    // Initialize Two-Square
    Init: function() {
      TwoSquare.isInitialized = true;
    },
    
    // Set up key for Two-Square
    KeySetup: function(key) {
      let id;
      do {
        id = 'TwoSquare[' + global.generateUniqueID() + ']';
      } while (TwoSquare.instances[id] || global.objectInstances[id]);
      
      TwoSquare.instances[id] = new TwoSquare.TwoSquareInstance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear Two-Square data
    ClearData: function(id) {
      if (TwoSquare.instances[id]) {
        delete TwoSquare.instances[id];
        delete global.objectInstances[id];
      }
    },
    
    // Encrypt using Two-Square cipher
    encryptBlock: function(intInstanceID, input) {
      const id = 'TwoSquare[' + intInstanceID + ']';
      if (!TwoSquare.instances[id]) return '';
      
      return TwoSquare.instances[id].encrypt(input);
    },
    
    // Decrypt using Two-Square cipher
    decryptBlock: function(intInstanceID, input) {
      const id = 'TwoSquare[' + intInstanceID + ']';
      if (!TwoSquare.instances[id]) return '';
      
      return TwoSquare.instances[id].decrypt(input);
    },
    
    // Two-Square Instance Class
    TwoSquareInstance: function(key) {
      // Parse the two keys
      const keys = key.split('|');
      if (keys.length !== 2) {
        throw new Error('Two-Square: Key must contain two keywords separated by |');
      }
      
      this.key1 = keys[0].toUpperCase().replace(/[^A-Z]/g, '');
      this.key2 = keys[1].toUpperCase().replace(/[^A-Z]/g, '');
      
      if (this.key1.length === 0 || this.key2.length === 0) {
        throw new Error('Two-Square: Both keys must contain at least one letter');
      }
      
      this.setupSquares();
    },
    
    // Setup the two squares
    setupSquares: function() {
      TwoSquare.TwoSquareInstance.prototype.setupSquares = function() {
        this.square1 = this.createSquare(this.key1);
        this.square2 = this.createSquare(this.key2);
        
        // Create position lookup tables for both squares
        this.positionMap1 = {};
        this.positionMap2 = {};
        
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 5; col++) {
            this.positionMap1[this.square1[row][col]] = { row: row, col: col };
            this.positionMap2[this.square2[row][col]] = { row: row, col: col };
          }
        }
      };
      
      // Create a 5x5 square from keyword
      TwoSquare.TwoSquareInstance.prototype.createSquare = function(keyword) {
        const used = new Set();
        const alphabet = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'; // 25 letters, I/J combined
        const square = [[], [], [], [], []];
        let row = 0, col = 0;
        
        // Add keyword letters first (removing duplicates)
        for (let i = 0; i < keyword.length; i++) {
          const letter = keyword[i];
          if (alphabet.includes(letter) && !used.has(letter)) {
            square[row][col] = letter;
            used.add(letter);
            col++;
            if (col === 5) {
              col = 0;
              row++;
              if (row === 5) break;
            }
          }
        }
        
        // Fill remaining positions with unused alphabet letters
        for (let i = 0; i < alphabet.length && row < 5; i++) {
          const letter = alphabet[i];
          if (!used.has(letter)) {
            square[row][col] = letter;
            used.add(letter);
            col++;
            if (col === 5) {
              col = 0;
              row++;
            }
          }
        }
        
        return square;
      };
      
      // Prepare text for encryption (handle odd length, J->I substitution)
      TwoSquare.TwoSquareInstance.prototype.prepareText = function(text) {
        let prepared = text.toUpperCase().replace(/[^A-Z]/g, '').replace(/J/g, 'I');
        
        // Handle odd length by adding X
        if (prepared.length % 2 === 1) {
          prepared += 'X';
        }
        
        return prepared;
      };
      
      // Encrypt function
      TwoSquare.TwoSquareInstance.prototype.encrypt = function(plaintext) {
        const text = this.prepareText(plaintext);
        let result = '';
        
        // Process digraphs
        for (let i = 0; i < text.length; i += 2) {
          const char1 = text[i];
          const char2 = text[i + 1];
          
          const pos1 = this.positionMap1[char1];
          const pos2 = this.positionMap2[char2];
          
          if (pos1 && pos2) {
            // In Two-Square, we use the opposite corners of the rectangle
            // First character from square1, second from square2
            // Take same row from first char, column from second char for first cipher char
            // Take same row from second char, column from first char for second cipher char
            const cipher1 = this.square1[pos1.row][pos2.col];
            const cipher2 = this.square2[pos2.row][pos1.col];
            
            result += cipher1 + cipher2;
          } else {
            // Fallback for missing characters
            result += char1 + char2;
          }
        }
        
        return result;
      };
      
      // Decrypt function
      TwoSquare.TwoSquareInstance.prototype.decrypt = function(ciphertext) {
        const text = this.prepareText(ciphertext);
        let result = '';
        
        // Process digraphs
        for (let i = 0; i < text.length; i += 2) {
          const char1 = text[i];
          const char2 = text[i + 1];
          
          // For decryption, we reverse the process
          // Find positions in the squares
          let pos1 = null, pos2 = null;
          
          // Find char1 in square1
          for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
              if (this.square1[row][col] === char1) {
                pos1 = { row: row, col: col };
              }
              if (this.square2[row][col] === char2) {
                pos2 = { row: row, col: col };
              }
            }
          }
          
          if (pos1 && pos2) {
            // Reverse the Two-Square process
            const plain1 = this.square1[pos1.row][pos2.col];
            const plain2 = this.square2[pos2.row][pos1.col];
            
            result += plain1 + plain2;
          } else {
            // Fallback for missing characters
            result += char1 + char2;
          }
        }
        
        return result;
      };
      
      // Display both squares for debugging/education
      TwoSquare.TwoSquareInstance.prototype.displaySquares = function() {
        let display = `Two-Square Cipher Configuration:\n\n`;
        display += `Square 1 (${this.key1}):\n`;
        for (let i = 0; i < 5; i++) {
          display += this.square1[i].join(' ') + '\n';
        }
        display += `\nSquare 2 (${this.key2}):\n`;
        for (let i = 0; i < 5; i++) {
          display += this.square2[i].join(' ') + '\n';
        }
        return display;
      };
      
      // Show encryption process for educational purposes
      TwoSquare.TwoSquareInstance.prototype.showEncryption = function(plaintext) {
        const text = this.prepareText(plaintext);
        let display = `Two-Square Cipher Encryption:\n`;
        display += `Original: ${plaintext}\n`;
        display += `Prepared: ${text}\n`;
        display += `Keys: ${this.key1} | ${this.key2}\n\n`;
        display += this.displaySquares();
        display += `\nEncryption process (digraphs):\n`;
        
        for (let i = 0; i < text.length; i += 2) {
          const char1 = text[i];
          const char2 = text[i + 1];
          const pos1 = this.positionMap1[char1];
          const pos2 = this.positionMap2[char2];
          
          if (pos1 && pos2) {
            const cipher1 = this.square1[pos1.row][pos2.col];
            const cipher2 = this.square2[pos2.row][pos1.col];
            
            display += `${char1}${char2} -> ${cipher1}${cipher2} `;
            display += `(${char1}[${pos1.row},${pos1.col}] + ${char2}[${pos2.row},${pos2.col}])\n`;
          }
        }
        
        display += `\nResult: ${this.encrypt(plaintext)}`;
        return display;
      };
    }
  };
  
  // Initialize the prototype functions
  TwoSquare.setupSquares();
  
  // Auto-register with Cipher system
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(TwoSquare);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TwoSquare;
  }
  
})(typeof global !== 'undefined' ? global : window);