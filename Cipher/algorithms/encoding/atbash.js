/*
 * Universal Atbash Cipher
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
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
      console.error('Atbash cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create Atbash cipher object
  const Atbash = {
    // Public interface properties
    internalName: 'Atbash',
    name: 'Atbash',
    comment: 'Atbash cipher - reverses the alphabet (A=Z, B=Y, etc.)',
    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
    // Character sets
    UPPERCASE: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    LOWERCASE: 'abcdefghijklmnopqrstuvwxyz',
    UPPER_REVERSE: 'ZYXWVUTSRQPONMLKJIHGFEDCBA',
    LOWER_REVERSE: 'zyxwvutsrqponmlkjihgfedcba',
    
    // Official test vectors for Atbash cipher
    testVectors: [
      { input: 'HELLO', key: '', expected: 'SVOOL', description: 'Atbash cipher test' },
      { input: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', key: '', expected: 'ZYXWVUTSRQPONMLKJIHGFEDCBA', description: 'Full alphabet Atbash' },
      { input: 'atbash', key: '', expected: 'zgyzhs', description: 'Atbash lowercase test' },
      { input: 'GEEKS FOR GEEKS', key: '', expected: 'TVVPH ULI TVVPH', description: 'Common example with spaces' }
    ],
    
    // Initialize cipher
    Init: function() {
      Atbash.isInitialized = true;
    },
    
    // Set up key (Atbash doesn't use keys)
    KeySetup: function(optional_key) {
      let id;
      do {
        id = 'Atbash[' + global.generateUniqueID() + ']';
      } while (Atbash.instances[id] || global.objectInstances[id]);
      
      Atbash.instances[id] = new Atbash.AtbashInstance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Atbash.instances[id]) {
        delete Atbash.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Atbash', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (Atbash is symmetric - encrypt and decrypt are the same)
    encryptBlock: function(id, plaintext) {
      if (!Atbash.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Atbash', 'encryptBlock');
        return plaintext;
      }
      
      return Atbash.transform(plaintext);
    },
    
    // Decrypt block (same as encrypt for Atbash)
    decryptBlock: function(id, ciphertext) {
      if (!Atbash.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Atbash', 'decryptBlock');
        return ciphertext;
      }
      
      return Atbash.transform(ciphertext);
    },
    
    // Transform text using Atbash
    transform: function(text) {
      let result = '';
      
      for (let i = 0; i < text.length; i++) {
        const char = text.charAt(i);
        
        // Handle uppercase letters
        const upperIndex = Atbash.UPPERCASE.indexOf(char);
        if (upperIndex !== -1) {
          result += Atbash.UPPER_REVERSE.charAt(upperIndex);
        }
        // Handle lowercase letters
        else {
          const lowerIndex = Atbash.LOWERCASE.indexOf(char);
          if (lowerIndex !== -1) {
            result += Atbash.LOWER_REVERSE.charAt(lowerIndex);
          }
          // Non-alphabetic characters pass through unchanged
          else {
            result += char;
          }
        }
      }
      
      return result;
    },
    
    // Instance class
    AtbashInstance: function(key) {
      this.key = key || '';
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(Atbash);
  }
  
  // Export to global scope
  global.Atbash = Atbash;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Atbash;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);