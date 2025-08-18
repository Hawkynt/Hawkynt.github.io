/*
 * Universal Vigenère Cipher
 * Compatible with both Browser and Node.js environments
 * Based on classical polyalphabetic substitution cipher
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.Cipher) {
    if (typeof require !== 'undefined') {
      // Node.js environment - load dependencies
      try {
        require('../../universal-cipher-env.js');
        require('../../cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('Vigenère cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Load OpCodes for cryptographic operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes:', e.message);
    }
  }
  
  // Create Vigenère cipher object
  const Vigenere = {
    // Public interface properties
    internalName: 'Vigenere',
    name: 'Vigenère Cipher',
    comment: 'Classical polyalphabetic substitution cipher using keyword',
    minKeyLength: 1,
    maxKeyLength: 256,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},

  // Official test vectors from RFC/NIST standards and authoritative sources
  testVectors: [
    {
        "input": "ATTACKATDAWN",
        "key": "LEMON",
        "expected": "LXFOPVEFRNHR",
        "description": "Classic Vigenère example from textbooks"
    },
    {
        "input": "GEEKSFORGEEKS",
        "key": "AYUSH",
        "expected": "GCYCZFMLYLEIM",
        "description": "GeeksforGeeks educational example"
    },
    {
        "input": "TOBEORNOTTOBETHATISTHEQUESTION",
        "key": "RELATIONS",
        "expected": "KSMEHZBBLKSMEMPOGAJXSEJCSFLZSY",
        "description": "Trinity College Computer Science example"
    },
    {
        "input": "CRYPTOISSHORTFORCRYPTOGRAPHY",
        "key": "ABCD",
        "expected": "CSASTPKVSIQUTGQUCSASTPIUAQJB",
        "description": "Short key pattern test"
    },
    {
        "input": "THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG",
        "key": "KEY",
        "expected": "DLCAYGMOZBSUXJMHNSWTQYZCBXFOPYJCBYK",
        "description": "Classic pangram with simple key"
    }
],
    cantDecode: false,
    isInitialized: false,
    
    // Character set
    ALPHABET: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    
    // Initialize cipher
    Init: function() {
      Vigenere.isInitialized = true;
    },
    
    // Set up key
    KeySetup: function(key) {
      if (!key || key.length === 0) {
        global.throwException('Key Required Exception', key, 'Vigenere', 'KeySetup');
        return null;
      }
      
      let id;
      do {
        id = 'Vigenere[' + global.generateUniqueID() + ']';
      } while (Vigenere.instances[id] || global.objectInstances[id]);
      
      Vigenere.instances[id] = new Vigenere.VigenereInstance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Vigenere.instances[id]) {
        // Secure cleanup - clear the key from memory
        const instance = Vigenere.instances[id];
        instance.originalKey = '';
        instance.processedKey = '';
        delete Vigenere.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Vigenere', 'ClearData');
        return false;
      }
    },
    
    // Normalize text to uppercase letters only
    normalizeText: function(text) {
      return text.toUpperCase().replace(/[^A-Z]/g, '');
    },
    
    // Encrypt block
    encryptBlock: function(id, plaintext) {
      if (!Vigenere.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Vigenere', 'encryptBlock');
        return plaintext;
      }
      
      const instance = Vigenere.instances[id];
      const normalizedText = Vigenere.normalizeText(plaintext);
      let result = '';
      
      for (let i = 0; i < normalizedText.length; i++) {
        const textChar = normalizedText[i];
        const keyChar = instance.processedKey[i % instance.processedKey.length];
        
        const textIndex = Vigenere.ALPHABET.indexOf(textChar);
        const keyIndex = Vigenere.ALPHABET.indexOf(keyChar);
        
        if (textIndex !== -1 && keyIndex !== -1) {
          // Vigenère encryption: (text + key) mod 26
          const encryptedIndex = (textIndex + keyIndex) % 26;
          result += Vigenere.ALPHABET[encryptedIndex];
        } else {
          // Should not happen with normalized text, but defensive programming
          result += textChar;
        }
      }
      
      return result;
    },
    
    // Decrypt block
    decryptBlock: function(id, ciphertext) {
      if (!Vigenere.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Vigenere', 'decryptBlock');
        return ciphertext;
      }
      
      const instance = Vigenere.instances[id];
      const normalizedText = Vigenere.normalizeText(ciphertext);
      let result = '';
      
      for (let i = 0; i < normalizedText.length; i++) {
        const cipherChar = normalizedText[i];
        const keyChar = instance.processedKey[i % instance.processedKey.length];
        
        const cipherIndex = Vigenere.ALPHABET.indexOf(cipherChar);
        const keyIndex = Vigenere.ALPHABET.indexOf(keyChar);
        
        if (cipherIndex !== -1 && keyIndex !== -1) {
          // Vigenère decryption: (cipher - key + 26) mod 26
          const decryptedIndex = (cipherIndex - keyIndex + 26) % 26;
          result += Vigenere.ALPHABET[decryptedIndex];
        } else {
          // Should not happen with normalized text, but defensive programming
          result += cipherChar;
        }
      }
      
      return result;
    },
    
    // Instance class
    VigenereInstance: function(key) {
      // Normalize and store the key
      this.originalKey = key;
      this.processedKey = Vigenere.normalizeText(key);
      
      if (this.processedKey.length === 0) {
        throw new Error('Key must contain at least one alphabetic character');
      }
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(Vigenere);
  }
  
  // Export to global scope
  global.Vigenere = Vigenere;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Vigenere;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);