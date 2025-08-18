/*
 * Universal Affine Cipher
 * Compatible with both Browser and Node.js environments
 * Based on mathematical transformation: f(x) = (ax + b) mod 26
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
      console.error('Affine cipher requires Cipher system to be loaded first');
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
  
  // Create Affine cipher object
  const Affine = {
    // Public interface properties
    internalName: 'Affine',
    name: 'Affine Cipher',
    comment: 'Classical mathematical cipher: f(x) = (ax + b) mod 26',
    minKeyLength: 3,  // "a,b" format minimum
    maxKeyLength: 20, // Allow descriptive formats
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
    // Character set
    ALPHABET: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    
    // Valid values for 'a' (coprime with 26)
    VALID_A_VALUES: [1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25],
    
    // Multiplicative inverses for valid 'a' values modulo 26
    INVERSE_A: {
      1: 1, 3: 9, 5: 21, 7: 15, 9: 3, 11: 19,
      15: 7, 17: 23, 19: 11, 21: 5, 23: 17, 25: 25
    },
    
    // Official test vectors from academic sources
    testVectors: [
      { input: 'AFFINEECIPHER', key: '5,8', expected: 'IHHWVCCSWFRCP', description: 'Standard academic example: a=5, b=8' },
      { input: 'DCODE', key: '5,3', expected: 'SNVSX', description: 'DCode reference example: a=5, b=3' },
      { input: 'HELLO', key: '17,20', expected: 'JKZZY', description: 'GeeksforGeeks implementation: a=17, b=20' },
      { input: 'MATHEMATICS', key: '7,3', expected: 'JDGAFJDGHRZ', description: 'University of Regina example: a=7, b=3' },
      { input: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', key: '1,0', expected: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', description: 'Identity transformation: a=1, b=0' }
    ],
    
    // Initialize cipher
    Init: function() {
      Affine.isInitialized = true;
    },
    
    // Parse key string to extract a and b values
    parseKey: function(key) {
      // Support formats: "a,b", "a:b", "a b", or "a;b"
      const parts = szKey.replace(/[^\d,\-]/g, ' ').split(/[\s,:;]+/);
      if (parts.length < 2) {
        throw new Error('Affine key must contain two values: a and b (e.g., "5,8")');
      }
      
      const a = parseInt(parts[0], 10);
      const b = parseInt(parts[1], 10);
      
      if (isNaN(a) || isNaN(b)) {
        throw new Error('Affine key values must be numbers');
      }
      
      if (Affine.VALID_A_VALUES.indexOf(a) === -1) {
        throw new Error('Value a must be coprime with 26. Valid values: ' + Affine.VALID_A_VALUES.join(', '));
      }
      
      return { a: a, b: ((b % 26) + 26) % 26 };
    },
    
    // Set up key
    KeySetup: function(key) {
      if (!key || key.length === 0) {
        global.throwException('Key Required Exception', key, 'Affine', 'KeySetup');
        return null;
      }
      
      let id;
      do {
        id = 'Affine[' + global.generateUniqueID() + ']';
      } while (Affine.instances[id] || global.objectInstances[id]);
      
      try {
        Affine.instances[szID] = new Affine.AffineInstance(key);
        global.objectInstances[szID] = true;
        return szID;
      } catch (error) {
        global.throwException('Invalid Key Exception', error.message, 'Affine', 'KeySetup');
        return null;
      }
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Affine.instances[id]) {
        // Secure cleanup - clear the key values
        const instance = Affine.instances[szID];
        instance.a = 0;
        instance.b = 0;
        instance.aInverse = 0;
        instance.originalKey = '';
        delete Affine.instances[szID];
        delete global.objectInstances[szID];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Affine', 'ClearData');
        return false;
      }
    },
    
    // Normalize text to uppercase letters only
    normalizeText: function(text) {
      return text.toUpperCase().replace(/[^A-Z]/g, '');
    },
    
    // Encrypt block
    encryptBlock: function(id, szPlainText) {
      if (!Affine.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Affine', 'encryptBlock');
        return szPlainText;
      }
      
      const instance = Affine.instances[szID];
      const normalizedText = Affine.normalizeText(szPlainText);
      let szRet = '';
      
      for (let i = 0; i < normalizedText.length; i++) {
        const char = normalizedText[i];
        const x = Affine.ALPHABET.indexOf(char);
        
        if (x !== -1) {
          // Apply affine transformation: y = (ax + b) mod 26
          const y = OpCodes.AddMod(OpCodes.MulMod(instance.a, x, 26), instance.b, 26);
          szRet += Affine.ALPHABET[y];
        } else {
          // Should not happen with normalized text, but defensive programming
          szRet += char;
        }
      }
      
      return szRet;
    },
    
    // Decrypt block
    decryptBlock: function(id, szCipherText) {
      if (!Affine.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Affine', 'decryptBlock');
        return szCipherText;
      }
      
      const instance = Affine.instances[szID];
      const normalizedText = Affine.normalizeText(szCipherText);
      let szRet = '';
      
      for (let i = 0; i < normalizedText.length; i++) {
        const char = normalizedText[i];
        const y = Affine.ALPHABET.indexOf(char);
        
        if (y !== -1) {
          // Apply inverse affine transformation: x = a^(-1)(y - b) mod 26
          const x = OpCodes.MulMod(instance.aInverse, OpCodes.SubMod(y, instance.b, 26), 26);
          szRet += Affine.ALPHABET[x];
        } else {
          // Should not happen with normalized text, but defensive programming
          szRet += char;
        }
      }
      
      return szRet;
    },
    
    // Instance class
    AffineInstance: function(key) {
      this.originalKey = szKey;
      const parsed = Affine.parseKey(key);
      this.a = parsed.a;
      this.b = parsed.b;
      this.aInverse = Affine.INVERSE_A[this.a];
      
      if (!this.aInverse) {
        throw new Error('No multiplicative inverse found for a = ' + this.a);
      }
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(Affine);
  }
  
  // Export to global scope
  global.Affine = Affine;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Affine;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);