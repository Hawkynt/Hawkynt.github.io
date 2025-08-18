/*
 * Affine Cipher Implementation
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const Affine = {
    name: "Affine Cipher",
    description: "Classical mathematical cipher using linear transformation f(x) = (ax + b) mod 26. Requires coefficient 'a' to be coprime with 26 for reversibility. One of the oldest mathematical ciphers.",
    inventor: "Unknown (Ancient)",
    year: null,
    country: null,
    category: "cipher",
    subCategory: "Classical Cipher",
    securityStatus: "educational",
    securityNotes: "Easily broken with frequency analysis or brute force. Only 312 possible keys. For educational purposes only.",
    
    documentation: [
      {text: "Wikipedia Article", uri: "https://en.wikipedia.org/wiki/Affine_cipher"},
      {text: "Mathematical Foundation", uri: "https://mathworld.wolfram.com/AffineCipher.html"},
      {text: "Cryptography Theory", uri: "https://www.cs.uri.edu/cryptography/classicalaffine.htm"}
    ],
    
    references: [
      {text: "DCode Implementation", uri: "https://www.dcode.fr/affine-cipher"},
      {text: "Educational Example", uri: "https://github.com/geeksforgeeks/affine-cipher"},
      {text: "University Tutorial", uri: "https://www.cs.uregina.ca/Links/class-info/425/Affine/"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Frequency Analysis",
        text: "Letter frequencies preserved, making frequency analysis effective against longer texts",
        mitigation: "Use only for educational purposes, never for actual security"
      },
      {
        type: "Small Key Space",
        text: "Only 312 possible keys (12 valid 'a' values × 26 'b' values), vulnerable to brute force",
        mitigation: "Consider as demonstration cipher only"
      }
    ],
    
    tests: [
      {
        text: "Standard Academic Example",
        uri: "https://www.dcode.fr/affine-cipher",
        input: ANSIToBytes("AFFINECIPHER"),
        key: ANSIToBytes("5,8"),
        expected: ANSIToBytes("IHHWVCCSWHCP")
      },
      {
        text: "DCode Reference Test", 
        uri: "https://www.dcode.fr/affine-cipher",
        input: ANSIToBytes("DCODE"),
        key: ANSIToBytes("5,3"),
        expected: ANSIToBytes("SNVSX")
      },
      {
        text: "GeeksforGeeks Example",
        uri: "https://www.geeksforgeeks.org/affine-cipher/",
        input: ANSIToBytes("HELLO"),
        key: ANSIToBytes("17,20"),
        expected: ANSIToBytes("JKZZY")
      },
      {
        text: "Identity Transformation",
        uri: "https://en.wikipedia.org/wiki/Affine_cipher",
        input: ANSIToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
        key: ANSIToBytes("1,0"),
        expected: ANSIToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
      }
    ],

    // Legacy interface properties
    internalName: 'Affine',
    comment: 'Classical mathematical cipher: f(x) = (ax + b) mod 26',
    minKeyLength: 3,
    maxKeyLength: 20,
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
    
    // Initialize cipher
    Init: function() {
      Affine.isInitialized = true;
    },
    
    // Parse key string to extract a and b values
    parseKey: function(key) {
      // Support formats: "a,b", "a:b", "a b", or "a;b"
      const parts = key.replace(/[^\d,\-]/g, ' ').split(/[\s,:;]+/);
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
        Affine.instances[id] = new Affine.AffineInstance(key);
        global.objectInstances[id] = true;
        return id;
      } catch (error) {
        global.throwException('Invalid Key Exception', error.message, 'Affine', 'KeySetup');
        return null;
      }
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Affine.instances[id]) {
        // Secure cleanup - clear the key values
        const instance = Affine.instances[id];
        instance.a = 0;
        instance.b = 0;
        instance.aInverse = 0;
        instance.originalKey = '';
        delete Affine.instances[id];
        delete global.objectInstances[id];
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
    encryptBlock: function(id, plaintext) {
      if (!Affine.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Affine', 'encryptBlock');
        return plaintext;
      }
      
      const instance = Affine.instances[id];
      const normalizedText = Affine.normalizeText(plaintext);
      let result = '';
      
      for (let i = 0; i < normalizedText.length; i++) {
        const char = normalizedText[i];
        const x = Affine.ALPHABET.indexOf(char);
        
        if (x !== -1) {
          // Apply affine transformation: y = (ax + b) mod 26
          const y = OpCodes.AddMod(OpCodes.MulMod(instance.a, x, 26), instance.b, 26);
          result += Affine.ALPHABET[y];
        } else {
          // Should not happen with normalized text, but defensive programming
          result += char;
        }
      }
      
      return result;
    },
    
    // Decrypt block
    decryptBlock: function(id, ciphertext) {
      if (!Affine.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Affine', 'decryptBlock');
        return ciphertext;
      }
      
      const instance = Affine.instances[id];
      const normalizedText = Affine.normalizeText(ciphertext);
      let result = '';
      
      for (let i = 0; i < normalizedText.length; i++) {
        const char = normalizedText[i];
        const y = Affine.ALPHABET.indexOf(char);
        
        if (y !== -1) {
          // Apply inverse affine transformation: x = a^(-1)(y - b) mod 26
          const x = OpCodes.MulMod(instance.aInverse, OpCodes.SubMod(y, instance.b, 26), 26);
          result += Affine.ALPHABET[x];
        } else {
          // Should not happen with normalized text, but defensive programming
          result += char;
        }
      }
      
      return result;
    },
    
    // Instance class
    AffineInstance: function(key) {
      this.originalKey = key;
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
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(Affine);
  
  // Export to global scope
  global.Affine = Affine;
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);