/*
 * Autokey Cipher Implementation  
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const Autokey = {
    name: "Autokey Cipher",
    description: "Enhanced Vigenère cipher that extends the key using plaintext itself, eliminating periodic key repetition. Uses initial keyword plus plaintext letters to create non-repeating key sequence.",
    inventor: "Blaise de Vigenère",
    year: 1586,
    country: "FR", 
    category: "cipher",
    subCategory: "Classical Cipher",
    securityStatus: "educational",
    securityNotes: "More secure than basic Vigenère due to non-repeating key, but vulnerable to probable plaintext attacks and modern cryptanalysis.",
    
    documentation: [
      {text: "Wikipedia Article", uri: "https://en.wikipedia.org/wiki/Autokey_cipher"},
      {text: "Original Vigenère Work", uri: "https://gallica.bnf.fr/ark:/12148/bpt6k5493743"},
      {text: "Cryptanalysis Methods", uri: "https://www.dcode.fr/autokey-cipher"}
    ],
    
    references: [
      {text: "DCode Implementation", uri: "https://www.dcode.fr/autokey-cipher"},
      {text: "Cryptii Educational Tool", uri: "https://cryptii.com/pipes/autokey-cipher"},
      {text: "Practical Cryptography", uri: "https://practicalcryptography.com/ciphers/classical-era/autokey/"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Probable Plaintext Attack",
        text: "If portion of plaintext is known, can recover key and decrypt remainder of message",
        mitigation: "Avoid using with predictable message formats or known text patterns"
      },
      {
        type: "Frequency Analysis", 
        text: "Advanced frequency analysis can still break longer messages despite non-repeating key",
        mitigation: "Consider only for educational demonstrations, not real security"
      }
    ],
    
    tests: [
      {
        text: "Vigenère's Historical Example",
        uri: "https://en.wikipedia.org/wiki/Autokey_cipher", 
        input: ANSIToBytes("ATTACKATDAWN"),
        key: ANSIToBytes("QUEENLY"),
        expected: ANSIToBytes("QNXEPVYTWTWP")
      },
      {
        text: "Educational Standard Example",
        uri: "https://cryptii.com/pipes/autokey-cipher",
        input: ANSIToBytes("HELLO"),
        key: ANSIToBytes("KEY"), 
        expected: ANSIToBytes("RIJVS")
      },
      {
        text: "Cryptanalysis Demonstration",
        uri: "https://www.dcode.fr/autokey-cipher",
        input: ANSIToBytes("DEFENDTHECASTLE"),
        key: ANSIToBytes("ROYAL"),
        expected: ANSIToBytes("VYXZMPZGUCAVNXR")
      }
    ],

    // Legacy interface properties
    internalName: 'Autokey',
    comment: 'Vigenère variant using plaintext to extend the key (1586)',
    minKeyLength: 1,
    maxKeyLength: 50,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,


    
    isInitialized: false,
    
    
    // Initialize cipher
    Init: function() {
      Autokey.isInitialized = true;
    },
    
    // Set up key (initial alphabetic string)
    KeySetup: function(optional_key) {
      let id;
      do {
        id = 'Autokey[' + global.generateUniqueID() + ']';
      } while (Autokey.instances[id] || global.objectInstances[id]);
      
      Autokey.instances[id] = new Autokey.AutokeyInstance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Autokey.instances[id]) {
        delete Autokey.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Autokey', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block
    encryptBlock: function(id, plaintext) {
      if (!Autokey.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Autokey', 'encryptBlock');
        return plaintext;
      }
      
      const instance = Autokey.instances[id];
      const initialKey = instance.key;
      
      if (!initialKey || initialKey.length === 0) {
        return plaintext; // No key, no encryption
      }
      
      // Build extended key: initial key + plaintext letters
      const plaintextLetters = Autokey.extractLetters(plaintext);
      const extendedKey = initialKey + plaintextLetters;
      
      let result = '';
      let keyIndex = 0;
      
      for (let i = 0; i < plaintext.length; i++) {
        const char = plaintext.charAt(i);
        
        if (Autokey.isLetter(char)) {
          if (keyIndex < extendedKey.length) {
            const keyChar = extendedKey.charAt(keyIndex);
            const encrypted = Autokey.vigenereShift(char, keyChar);
            result += encrypted;
            keyIndex++;
          } else {
            // Should not happen if key is built correctly
            result += char;
          }
        } else {
          // Preserve non-alphabetic characters
          result += char;
        }
      }
      
      return result;
    },
    
    // Decrypt block
    decryptBlock: function(id, ciphertext) {
      if (!Autokey.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Autokey', 'decryptBlock');
        return ciphertext;
      }
      
      const instance = Autokey.instances[id];
      const initialKey = instance.key;
      
      if (!initialKey || initialKey.length === 0) {
        return ciphertext; // No key, no decryption
      }
      
      let result = '';
      let keyIndex = 0;
      let plaintextSoFar = '';
      
      for (let i = 0; i < ciphertext.length; i++) {
        const char = ciphertext.charAt(i);
        
        if (Autokey.isLetter(char)) {
          // Determine current key character
          let keyChar;
          if (keyIndex < initialKey.length) {
            // Use initial key
            keyChar = initialKey.charAt(keyIndex);
          } else {
            // Use previously decrypted plaintext
            const plaintextIndex = keyIndex - initialKey.length;
            if (plaintextIndex < plaintextSoFar.length) {
              keyChar = plaintextSoFar.charAt(plaintextIndex);
            } else {
              // Should not happen
              keyChar = 'A';
            }
          }
          
          const decrypted = Autokey.vigenereShift(char, keyChar, true);
          result += decrypted;
          
          // Add decrypted letter to plaintext for future key extension
          if (Autokey.isLetter(decrypted)) {
            plaintextSoFar += decrypted.toUpperCase();
          }
          
          keyIndex++;
        } else {
          // Preserve non-alphabetic characters
          result += char;
        }
      }
      
      return result;
    },
    
    // Check if character is a letter
    isLetter: function(char) {
      return /[A-Za-z]/.test(char);
    },
    
    // Extract only letters from text (for key extension)
    extractLetters: function(text) {
      let letters = '';
      for (let i = 0; i < text.length; i++) {
        const char = text.charAt(i);
        if (Autokey.isLetter(char)) {
          letters += char.toUpperCase();
        }
      }
      return letters;
    },
    
    // Perform Vigenère shift
    vigenereShift: function(char, keyChar, decrypt) {
      if (!Autokey.isLetter(char) || !Autokey.isLetter(keyChar)) {
        return char;
      }
      
      const isUpperCase = char >= 'A' && char <= 'Z';
      const baseCode = isUpperCase ? 65 : 97; // 'A' or 'a'
      
      const charCode = char.toUpperCase().charCodeAt(0) - 65; // A=0, B=1, etc.
      const keyCode = keyChar.toUpperCase().charCodeAt(0) - 65;
      
      let resultCode;
      if (decrypt) {
        resultCode = (charCode - keyCode + 26) % 26;
      } else {
        resultCode = (charCode + keyCode) % 26;
      }
      
      const resultChar = String.fromCharCode(resultCode + 65); // Convert back to uppercase
      return isUpperCase ? resultChar : resultChar.toLowerCase();
    },
    
    // Validate and clean alphabetic key
    validateKey: function(keyString) {
      if (!keyString) return '';
      
      // Remove non-alphabetic characters and convert to uppercase
      return keyString.replace(/[^A-Za-z]/g, '').toUpperCase();
    },
    
    // Instance class
    AutokeyInstance: function(keyString) {
      this.rawKey = keyString || '';
      this.key = Autokey.validateKey(keyString);
      
      if (this.key.length === 0) {
        // Default key if none provided
        this.key = 'CIPHER';
      }
    },
    
    // Add uppercase aliases for compatibility with test runner
    EncryptBlock: function(id, plaintext) {
      return this.encryptBlock(id, plaintext);
    },
    
    DecryptBlock: function(id, ciphertext) {
      return this.decryptBlock(id, ciphertext);
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(Autokey);
  
  global.Autokey = Autokey;
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);