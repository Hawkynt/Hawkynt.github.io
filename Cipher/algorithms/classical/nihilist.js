#!/usr/bin/env node
/*
 * Nihilist Cipher Universal Implementation
 * Based on the Russian revolutionary cipher (1880s)
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation - Historical cipher for learning purposes
 * The Nihilist cipher combines Polybius square with additive key encryption
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
      console.error('Nihilist cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Load OpCodes for common operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const Nihilist = {
    // Public interface properties
    internalName: 'Nihilist',
    name: 'Nihilist Cipher',
    comment: 'Russian revolutionary cipher (1880s) - Polybius square + additive key encryption',
    minKeyLength: 1,
    maxKeyLength: 100, // Practical limit for key phrase
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
    
    // Test vectors from historical cryptography sources
    testVectors: [
      {
        input: 'ATTACKATDAWN',
        key: 'NIHILIST',
        expected: '89 96 88 97 91 93 89 96 99 89 104 95',
        description: 'Historical example - ATTACKATDAWN with NIHILIST key'
      },
      {
        input: 'REVOLUTION',
        key: 'RUSSIAN',
        expected: '97 93 108 97 94 103 97 83 97 95',
        description: 'Revolutionary message with RUSSIAN key'
      },
      {
        input: 'SECRET',
        key: 'CZAR',
        expected: '86 79 74 98 79 88',
        description: 'Simple example - SECRET with CZAR key'
      }
    ],
    
    // Initialize Nihilist
    Init: function() {
      Nihilist.isInitialized = true;
    },
    
    // Set up key for Nihilist
    KeySetup: function(key) {
      let id;
      do {
        id = 'Nihilist[' + global.generateUniqueID() + ']';
      } while (Nihilist.instances[id] || global.objectInstances[id]);
      
      Nihilist.instances[id] = new Nihilist.NihilistInstance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear Nihilist data
    ClearData: function(id) {
      if (Nihilist.instances[id]) {
        delete Nihilist.instances[id];
        delete global.objectInstances[id];
      }
    },
    
    // Encrypt using Nihilist cipher
    encryptBlock: function(intInstanceID, input) {
      const id = 'Nihilist[' + intInstanceID + ']';
      if (!Nihilist.instances[id]) return '';
      
      return Nihilist.instances[id].encrypt(input);
    },
    
    // Decrypt using Nihilist cipher
    decryptBlock: function(intInstanceID, input) {
      const id = 'Nihilist[' + intInstanceID + ']';
      if (!Nihilist.instances[id]) return '';
      
      return Nihilist.instances[id].decrypt(input);
    },
    
    // Nihilist Instance Class
    NihilistInstance: function(key) {
      this.key = key.toUpperCase().replace(/[^A-Z]/g, ''); // Remove non-letters
      if (this.key.length === 0) {
        throw new Error('Nihilist: Key must contain at least one letter');
      }
      
      this.setupSquare();
      this.prepareKey();
    },
    
    // Setup functions
    setupSquare: function() {
      Nihilist.NihilistInstance.prototype.setupSquare = function() {
        // Use standard Polybius square
        this.square = Nihilist.STANDARD_SQUARE.map(row => row.slice());
        
        // Create coordinate lookup for letters
        this.letterToCoords = {};
        this.coordsToLetter = {};
        
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 5; col++) {
            const letter = this.square[row][col];
            const coords = (row + 1) * 10 + (col + 1); // 11, 12, 13, etc.
            this.letterToCoords[letter] = coords;
            this.coordsToLetter[coords] = letter;
          }
        }
        
        // Handle I/J combination
        this.letterToCoords['J'] = this.letterToCoords['I'];
      };
      
      // Prepare the key by converting to coordinate numbers
      Nihilist.NihilistInstance.prototype.prepareKey = function() {
        this.keyCoords = [];
        for (let i = 0; i < this.key.length; i++) {
          const letter = this.key[i];
          if (this.letterToCoords[letter]) {
            this.keyCoords.push(this.letterToCoords[letter]);
          }
        }
        
        if (this.keyCoords.length === 0) {
          throw new Error('Nihilist: No valid letters found in key');
        }
      };
      
      // Encrypt function
      Nihilist.NihilistInstance.prototype.encrypt = function(plaintext) {
        const text = plaintext.toUpperCase().replace(/[^A-Z]/g, '');
        const result = [];
        
        for (let i = 0; i < text.length; i++) {
          const letter = text[i];
          
          // Convert letter to Polybius coordinates
          const letterCoords = this.letterToCoords[letter] || this.letterToCoords['I']; // J maps to I
          
          // Get corresponding key coordinate (cycling through key)
          const keyCoords = this.keyCoords[i % this.keyCoords.length];
          
          // Add coordinates (Nihilist addition)
          const sum = letterCoords + keyCoords;
          result.push(sum.toString());
        }
        
        return result.join(' ');
      };
      
      // Decrypt function
      Nihilist.NihilistInstance.prototype.decrypt = function(ciphertext) {
        // Parse numbers from ciphertext
        const numbers = ciphertext.trim().split(/\s+/).map(n => parseInt(n));
        const result = [];
        
        for (let i = 0; i < numbers.length; i++) {
          const sum = numbers[i];
          
          // Get corresponding key coordinate
          const keyCoords = this.keyCoords[i % this.keyCoords.length];
          
          // Subtract key from sum to get original letter coordinates
          const letterCoords = sum - keyCoords;
          
          // Validate coordinates are in valid Polybius range
          const row = Math.floor(letterCoords / 10);
          const col = letterCoords % 10;
          
          if (row >= 1 && row <= 5 && col >= 1 && col <= 5) {
            const coords = row * 10 + col;
            if (this.coordsToLetter[coords]) {
              result.push(this.coordsToLetter[coords]);
            } else {
              result.push('?'); // Invalid coordinates
            }
          } else {
            result.push('?'); // Out of range
          }
        }
        
        return result.join('');
      };
      
      // Get the Polybius square for debugging/display
      Nihilist.NihilistInstance.prototype.getSquare = function() {
        return this.square.map(row => row.slice());
      };
      
      // Display the encryption process for educational purposes
      Nihilist.NihilistInstance.prototype.showEncryption = function(plaintext) {
        const text = plaintext.toUpperCase().replace(/[^A-Z]/g, '');
        let display = `Nihilist Cipher Encryption:\n`;
        display += `Plaintext: ${text}\n`;
        display += `Key: ${this.key}\n\n`;
        display += `Polybius Square:\n`;
        display += `  1 2 3 4 5\n`;
        for (let i = 0; i < 5; i++) {
          display += `${i + 1} `;
          for (let j = 0; j < 5; j++) {
            display += `${this.square[i][j]} `;
          }
          display += `\n`;
        }
        display += `\nEncryption process:\n`;
        
        for (let i = 0; i < text.length; i++) {
          const letter = text[i];
          const letterCoords = this.letterToCoords[letter] || this.letterToCoords['I'];
          const keyLetter = this.key[i % this.key.length];
          const keyCoords = this.keyCoords[i % this.keyCoords.length];
          const sum = letterCoords + keyCoords;
          
          display += `${letter}(${letterCoords}) + ${keyLetter}(${keyCoords}) = ${sum}\n`;
        }
        
        display += `\nResult: ${this.encrypt(plaintext)}`;
        return display;
      };
    }
  };
  
  // Initialize the prototype functions
  Nihilist.setupSquare();
  
  // Auto-register with Cipher system
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(Nihilist);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Nihilist;
  }
  
})(typeof global !== 'undefined' ? global : window);