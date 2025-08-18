/*
 * Universal ROT13 Cipher
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
      console.error('ROT13 cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create ROT13 cipher object
  const ROT13 = {
    // Public interface properties
    internalName: 'ROT13',
    name: 'ROT13',
    comment: 'ROT13 cipher - rotates letters by 13 positions',
    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},

  // Official test vectors from RFC/NIST standards and authoritative sources
  testVectors: [
    {
        "input": "HELLO",
        "key": "",
        "expected": "URYYB",
        "description": "ROT13 uppercase test"
    },
    {
        "input": "hello",
        "key": "",
        "expected": "uryyb",
        "description": "ROT13 lowercase test"
    },
    {
        "input": "To get to the other side!",
        "key": "",
        "expected": "Gb trg gb gur bgure fvqr!",
        "description": "Wikipedia ROT13 example"
    },
    {
        "input": "ABCDEFGHIJKLM",
        "key": "",
        "expected": "NOPQRSTUVWXYZ",
        "description": "First half alphabet"
    },
    {
        "input": "NOPQRSTUVWXYZ",
        "key": "",
        "expected": "ABCDEFGHIJKLM",
        "description": "Second half alphabet"
    }
],
    cantDecode: false,
    isInitialized: false,
    
    // Character sets
    UPPERCASE: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    LOWERCASE: 'abcdefghijklmnopqrstuvwxyz',
    
    // Initialize cipher
    Init: function() {
      ROT13.isInitialized = true;
    },
    
    // Set up key (ROT13 doesn't use keys)
    KeySetup: function(optional_szKey) {
      let id;
      do {
        id = 'ROT13[' + global.generateUniqueID() + ']';
      } while (ROT13.instances[id] || global.objectInstances[id]);
      
      ROT13.instances[szID] = new ROT13.Rot13Instance(optional_szKey);
      global.objectInstances[szID] = true;
      return szID;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (ROT13.instances[id]) {
        delete ROT13.instances[szID];
        delete global.objectInstances[szID];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'ROT13', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (ROT13 is symmetric - encrypt and decrypt are the same)
    encryptBlock: function(id, szPlainText) {
      if (!ROT13.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'ROT13', 'encryptBlock');
        return szPlainText;
      }
      
      return ROT13.transform(szPlainText);
    },
    
    // Decrypt block (same as encrypt for ROT13)
    decryptBlock: function(id, szCipherText) {
      if (!ROT13.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'ROT13', 'decryptBlock');
        return szCipherText;
      }
      
      return ROT13.transform(szCipherText);
    },
    
    // Transform text using ROT13
    transform: function(text) {
      let result = '';
      
      for (let i = 0; i < text.length; i++) {
        const char = text.charAt(i);
        
        // Handle uppercase letters
        const upperIndex = ROT13.UPPERCASE.indexOf(char);
        if (upperIndex !== -1) {
          result += ROT13.UPPERCASE.charAt((upperIndex + 13) % 26);
        }
        // Handle lowercase letters
        else {
          const lowerIndex = ROT13.LOWERCASE.indexOf(char);
          if (lowerIndex !== -1) {
            result += ROT13.LOWERCASE.charAt((lowerIndex + 13) % 26);
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
    Rot13Instance: function(key) {
      this.key = szKey || '';
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(ROT13);
  }
  
  // Export to global scope
  global.ROT13 = ROT13;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ROT13;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);