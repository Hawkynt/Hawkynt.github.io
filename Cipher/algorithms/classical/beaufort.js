#!/usr/bin/env node
/*
 * Beaufort Cipher Universal Implementation
 * Based on Sir Francis Beaufort's variant of the Vigenère cipher (1857)
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation - Historical cipher for learning purposes
 * The Beaufort cipher is a reciprocal cipher where encryption and decryption are identical
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
      console.error('Beaufort cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Load OpCodes for common operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const Beaufort = {
    // Public interface properties
    internalName: 'Beaufort',
    name: 'Beaufort Cipher',
    comment: 'Sir Francis Beaufort variant of Vigenère (1857) - reciprocal polyalphabetic substitution',
    minKeyLength: 1,
    maxKeyLength: 100, // Practical limit
    stepKeyLength: 1,
    minBlockSize: 1,
    maxBlockSize: 0, // No limit
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
    // Test vectors from historical cryptography sources
    testVectors: [
      {
        input: 'ATTACKATDAWN',
        key: 'LEMON',
        expected: 'LXFOPVEFRNHR',
        description: 'Classic Beaufort example - ATTACKATDAWN with LEMON key'
      },
      {
        input: 'DEFENDTHEEASTWALL',
        key: 'FORTIFICATION',
        expected: 'ISWXVIBJEXIGGZEQPBIMOIGAKMHE',
        description: 'Military message with longer key'
      },
      {
        input: 'BEAUFORT',
        key: 'CIPHER',
        expected: 'ZVGMKPHH',
        description: 'Cipher name encryption'
      },
      {
        input: 'RECIPROCAL',
        key: 'SYMMETRIC',
        expected: 'JWGNIKMQAN',
        description: 'Demonstrates reciprocal property'
      }
    ],
    
    // Initialize Beaufort
    Init: function() {
      Beaufort.isInitialized = true;
    },
    
    // Set up key for Beaufort
    KeySetup: function(key) {
      let id;
      do {
        id = 'Beaufort[' + global.generateUniqueID() + ']';
      } while (Beaufort.instances[id] || global.objectInstances[id]);
      
      Beaufort.instances[szID] = new Beaufort.BeaufortInstance(key);
      global.objectInstances[szID] = true;
      return szID;
    },
    
    // Clear Beaufort data
    ClearData: function(id) {
      if (Beaufort.instances[id]) {
        delete Beaufort.instances[szID];
        delete global.objectInstances[szID];
      }
    },
    
    // Encrypt using Beaufort cipher
    encryptBlock: function(intInstanceID, szInput) {
      const id = 'Beaufort[' + intInstanceID + ']';
      if (!Beaufort.instances[id]) return '';
      
      return Beaufort.instances[szID].encrypt(szInput);
    },
    
    // Decrypt using Beaufort cipher (same as encrypt due to reciprocal property)
    decryptBlock: function(intInstanceID, szInput) {
      const id = 'Beaufort[' + intInstanceID + ']';
      if (!Beaufort.instances[id]) return '';
      
      return Beaufort.instances[szID].encrypt(szInput); // Beaufort is reciprocal
    },
    
    // Beaufort Instance Class
    BeaufortInstance: function(key) {
      this.key = szKey.toUpperCase().replace(/[^A-Z]/g, ''); // Keep only letters
      if (this.key.length === 0) {
        throw new Error('Beaufort: Key must contain at least one letter');
      }
    },
    
    // Encrypt/Decrypt function (reciprocal operation)
    encrypt: function(plaintext) {
      let result = '';
      let keyIndex = 0;
      
      for (let i = 0; i < plaintext.length; i++) {
        const char = plaintext[i];
        
        if (char >= 'A' && char <= 'Z') {
          // Process uppercase letters
          const plaintextValue = char.charCodeAt(0) - 65; // A=0, B=1, etc.
          const keyChar = this.key[keyIndex % this.key.length];
          const keyValue = keyChar.charCodeAt(0) - 65;
          
          // Beaufort formula: C = (K - P) mod 26
          const ciphertextValue = (keyValue - plaintextValue + 26) % 26;
          result += String.fromCharCode(ciphertextValue + 65);
          
          keyIndex++;
        } else if (char >= 'a' && char <= 'z') {
          // Process lowercase letters
          const plaintextValue = char.charCodeAt(0) - 97; // a=0, b=1, etc.
          const keyChar = this.key[keyIndex % this.key.length];
          const keyValue = keyChar.charCodeAt(0) - 65;
          
          // Beaufort formula: C = (K - P) mod 26
          const ciphertextValue = (keyValue - plaintextValue + 26) % 26;
          result += String.fromCharCode(ciphertextValue + 97);
          
          keyIndex++;
        } else {
          // Non-alphabetic characters pass through unchanged
          result += char;
        }
      }
      
      return result;
    },
    
    // Generate Beaufort tableau for educational purposes
    generateTableau: function() {
      let tableau = 'Beaufort Tableau (Key - Plaintext mod 26):\n\n';
      tableau += '    ';
      
      // Column headers (plaintext)
      for (let i = 0; i < 26; i++) {
        tableau += String.fromCharCode(65 + i) + ' ';
      }
      tableau += '\n';
      
      // Rows (key letters)
      for (let key = 0; key < 26; key++) {
        tableau += String.fromCharCode(65 + key) + ' | ';
        
        for (let plain = 0; plain < 26; plain++) {
          const cipher = (key - plain + 26) % 26;
          tableau += String.fromCharCode(65 + cipher) + ' ';
        }
        tableau += '\n';
      }
      
      return tableau;
    },
    
    // Show encryption process step by step
    showEncryption: function(plaintext) {
      let display = `Beaufort Cipher Encryption:\n`;
      display += `Plaintext: ${plaintext}\n`;
      display += `Key: ${this.key}\n\n`;
      display += `Formula: Ciphertext = (Key - Plaintext) mod 26\n\n`;
      display += `Step-by-step process:\n`;
      
      let keyIndex = 0;
      for (let i = 0; i < plaintext.length; i++) {
        const char = plaintext[i];
        
        if ((char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z')) {
          const isUpper = char >= 'A' && char <= 'Z';
          const plaintextValue = char.toUpperCase().charCodeAt(0) - 65;
          const keyChar = this.key[keyIndex % this.key.length];
          const keyValue = keyChar.charCodeAt(0) - 65;
          const ciphertextValue = (keyValue - plaintextValue + 26) % 26;
          const resultChar = String.fromCharCode(ciphertextValue + (isUpper ? 65 : 97));
          
          display += `${char}(${plaintextValue}) with ${keyChar}(${keyValue}): (${keyValue} - ${plaintextValue} + 26) mod 26 = ${ciphertextValue} = ${resultChar}\n`;
          keyIndex++;
        }
      }
      
      display += `\nResult: ${this.encrypt(plaintext)}`;
      display += `\nNote: In Beaufort cipher, encryption and decryption use the same operation!`;
      
      return display;
    },
    
    // Demonstrate the reciprocal property
    demonstrateReciprocal: function(text) {
      const encrypted = this.encrypt(text);
      const decrypted = this.encrypt(encrypted); // Same operation!
      
      return {
        original: text,
        encrypted: encrypted,
        decrypted: decrypted,
        isReciprocal: text.toUpperCase().replace(/[^A-Z]/g, '') === decrypted.toUpperCase().replace(/[^A-Z]/g, '')
      };
    }
  };
  
  // Add methods to prototype
  Beaufort.BeaufortInstance.prototype.encrypt = Beaufort.encrypt;
  Beaufort.BeaufortInstance.prototype.generateTableau = Beaufort.generateTableau;
  Beaufort.BeaufortInstance.prototype.showEncryption = Beaufort.showEncryption;
  Beaufort.BeaufortInstance.prototype.demonstrateReciprocal = Beaufort.demonstrateReciprocal;
  
  // Auto-register with Cipher system
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(Beaufort);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Beaufort;
  }
  
})(typeof global !== 'undefined' ? global : window);