#!/usr/bin/env node
/*
 * Polybius Square Universal Implementation
 * Based on the ancient Greek cryptographic device (~200 BCE)
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation - Historical cipher for learning purposes
 * The Polybius Square encodes letters as pairs of coordinates in a 5x5 grid
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
      console.error('Polybius cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Load OpCodes for common operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const Polybius = {
    // Public interface properties
    internalName: 'Polybius',
    name: 'Polybius Square',
    comment: 'Ancient Greek cipher (~200 BCE) - letters encoded as coordinate pairs in 5x5 grid',
    minKeyLength: 0,
    maxKeyLength: 25, // Custom alphabet
    stepKeyLength: 1,
    minBlockSize: 1,
    maxBlockSize: 0, // No limit
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
    // Standard Polybius Square (I/J combined)
    STANDARD_SQUARE: [
      ['A', 'B', 'C', 'D', 'E'],
      ['F', 'G', 'H', 'I', 'K'], // I/J combined as I
      ['L', 'M', 'N', 'O', 'P'],
      ['Q', 'R', 'S', 'T', 'U'],
      ['V', 'W', 'X', 'Y', 'Z']
    ],
    
    // Test vectors from historical sources
    testVectors: [
      {
        input: 'HELLO',
        key: '',
        expected: '2351134313',
        description: 'Basic Polybius encoding - HELLO'
      },
      {
        input: 'ATTACK',
        key: '',
        expected: '114444112411',
        description: 'Military example - ATTACK'
      },
      {
        input: 'POLYBIUS',
        key: '',
        expected: '3534315412244543',
        description: 'Historical - POLYBIUS name encoding'
      },
      {
        input: 'SECRET',
        key: '',
        expected: '433151344551',
        description: 'Common word - SECRET'
      }
    ],
    
    // Initialize Polybius
    Init: function() {
      Polybius.isInitialized = true;
    },
    
    // Set up key for Polybius
    KeySetup: function(key) {
      let id;
      do {
        id = 'Polybius[' + global.generateUniqueID() + ']';
      } while (Polybius.instances[id] || global.objectInstances[id]);
      
      Polybius.instances[szID] = new Polybius.PolybiusInstance(key);
      global.objectInstances[szID] = true;
      return szID;
    },
    
    // Clear Polybius data
    ClearData: function(id) {
      if (Polybius.instances[id]) {
        delete Polybius.instances[szID];
        delete global.objectInstances[szID];
      }
    },
    
    // Encrypt using Polybius Square
    encryptBlock: function(intInstanceID, szInput) {
      const id = 'Polybius[' + intInstanceID + ']';
      if (!Polybius.instances[id]) return '';
      
      return Polybius.instances[szID].encrypt(szInput);
    },
    
    // Decrypt using Polybius Square
    decryptBlock: function(intInstanceID, szInput) {
      const id = 'Polybius[' + intInstanceID + ']';
      if (!Polybius.instances[id]) return '';
      
      return Polybius.instances[szID].decrypt(szInput);
    },
    
    // Polybius Instance Class
    PolybiusInstance: function(key) {
      this.setupSquare(key);
    },
    
    // Setup the Polybius square
    setupSquare: function() {
      Polybius.PolybiusInstance.prototype.setupSquare = function(key) {
        if (!key || key.length === 0) {
          // Use standard square
          this.square = Polybius.STANDARD_SQUARE.map(row => row.slice());
        } else {
          // Create custom square from key
          this.square = this.createCustomSquare(key.toUpperCase());
        }
        
        // Create lookup tables for fast encoding/decoding
        this.encodeMap = {};
        this.decodeMap = {};
        
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 5; col++) {
            const letter = this.square[row][col];
            const coords = '' + (row + 1) + (col + 1);
            this.encodeMap[letter] = coords;
            this.decodeMap[coords] = letter;
          }
        }
        
        // Handle I/J combination
        if (!this.encodeMap['J']) {
          this.encodeMap['J'] = this.encodeMap['I'];
        }
      };
      
      // Create custom square from keyword
      Polybius.PolybiusInstance.prototype.createCustomSquare = function(keyword) {
        const used = new Set();
        const alphabet = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'; // Standard 25 letters (I/J combined)
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
      
      // Encrypt function
      Polybius.PolybiusInstance.prototype.encrypt = function(plaintext) {
        let result = '';
        
        for (let i = 0; i < plaintext.length; i++) {
          const char = plaintext[i].toUpperCase();
          
          // Handle letters
          if (this.encodeMap[char]) {
            result += this.encodeMap[char];
          }
          // Handle J as I in standard square
          else if (char === 'J' && this.encodeMap['I']) {
            result += this.encodeMap['I'];
          }
          // Skip non-alphabetic characters or include them as-is
          else if (char.match(/[A-Z]/)) {
            // Unknown letter - should not happen with standard alphabet
            result += '??';
          }
          // Non-alphabetic characters can be preserved or skipped
          // For historical accuracy, typically only letters were encoded
        }
        
        return result;
      };
      
      // Decrypt function
      Polybius.PolybiusInstance.prototype.decrypt = function(ciphertext) {
        let result = '';
        
        // Process pairs of digits
        for (let i = 0; i < ciphertext.length - 1; i += 2) {
          const coords = ciphertext.substr(i, 2);
          
          // Validate coordinates
          if (coords.match(/^[1-5][1-5]$/)) {
            if (this.decodeMap[coords]) {
              result += this.decodeMap[coords];
            } else {
              result += '?'; // Invalid coordinates
            }
          } else {
            // Handle non-digit characters
            if (coords.length === 2 && !coords.match(/\d/)) {
              // Non-numeric characters - might be preserved text
              result += coords;
            } else {
              // Invalid format
              result += coords;
            }
          }
        }
        
        // Handle odd-length input
        if (ciphertext.length % 2 === 1) {
          result += ciphertext[ciphertext.length - 1];
        }
        
        return result;
      };
      
      // Get the current square for debugging/display
      Polybius.PolybiusInstance.prototype.getSquare = function() {
        return this.square.map(row => row.slice()); // Return copy
      };
      
      // Display square in readable format
      Polybius.PolybiusInstance.prototype.displaySquare = function() {
        let display = '  1 2 3 4 5\n';
        for (let i = 0; i < 5; i++) {
          display += (i + 1) + ' ';
          for (let j = 0; j < 5; j++) {
            display += this.square[i][j] + ' ';
          }
          display += '\n';
        }
        return display;
      };
    }
  };
  
  // Initialize the prototype functions
  Polybius.setupSquare();
  
  // Auto-register with Cipher system
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(Polybius);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Polybius;
  }
  
})(typeof global !== 'undefined' ? global : window);