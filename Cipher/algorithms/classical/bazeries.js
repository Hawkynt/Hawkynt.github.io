/*
 * Bazeries Cylinder Cipher Implementation
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const Bazeries = {
    name: "Bazeries Cylinder Cipher",
    description: "Mechanical transposition cipher using cylindrical device with rotating disks. Text written horizontally around cylinder, read vertically. Invented for French military communications.",
    inventor: "Étienne Bazeries",
    year: 1891,
    country: "FR",
    category: "cipher",
    subCategory: "Classical Cipher",
    securityStatus: "educational",
    securityNotes: "Revolutionary mechanical device for its era. Vulnerable to frequency analysis as pure transposition cipher. Historically significant but cryptographically weak by modern standards.",
    
    documentation: [
      {text: "Wikipedia Article", uri: "https://en.wikipedia.org/wiki/Bazeries_cylinder"},
      {text: "Original Work (French)", uri: "https://archive.org/details/leschiffressecr00bazegoog"},
      {text: "Crypto Museum", uri: "https://cryptomuseum.com/crypto/bazeries/"}
    ],
    
    references: [
      {text: "NSA Cryptologic Heritage", uri: "https://www.nsa.gov/about/cryptologic-heritage/"},
      {text: "DCode Implementation", uri: "https://www.dcode.fr/bazeries-cipher"},
      {text: "Historical Analysis", uri: "https://www.ciphermachinesandcryptology.com/en/bazeries.htm"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Frequency Analysis",
        text: "As transposition cipher, preserves letter frequencies making frequency analysis effective",
        mitigation: "Historical significance only - not suitable for modern security applications"
      },
      {
        type: "Known Plaintext Attack",
        text: "Knowledge of plaintext portion reveals transposition pattern and allows key recovery",
        mitigation: "Avoid predictable message formats and standard headers"
      }
    ],
    
    tests: [
      {
        text: "Historical Bazeries Example",
        uri: "https://archive.org/details/leschiffressecr00bazegoog",
        input: ANSIToBytes("DEFENDTHEEASTWALLOFTHECASTLE"),
        key: ANSIToBytes("CIPHER"),
        expected: ANSIToBytes("FEDEFNADHEEATSTWOLALTFHLEETSCA")
      },
      {
        text: "Educational Demonstration",
        uri: "https://cryptomuseum.com/crypto/bazeries/",
        input: ANSIToBytes("HELLO"),
        key: ANSIToBytes("KEY"),
        expected: ANSIToBytes("HLLOE")
      },
      {
        text: "Matrix Transposition Test",
        uri: "https://www.dcode.fr/bazeries-cipher",
        input: ANSIToBytes("CRYPTOGRAPHY"),
        key: ANSIToBytes("SECRET"),
        expected: ANSIToBytes("COTGRRAHPYC")
      }
    ],

    // Legacy interface properties
    internalName: 'Bazeries',
    comment: '19th century mechanical transposition cipher (1891)',
    minKeyLength: 1,
    maxKeyLength: 50,
    stepKeyLength: 1,
    minBlockSize: 1,
    maxBlockSize: 100,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,


    
    isInitialized: false,
    
    
    // Initialize cipher
    Init: function() {
      Bazeries.isInitialized = true;
    },
    
    // Set up key (permutation key)
    KeySetup: function(optional_key) {
      let id;
      do {
        id = 'Bazeries[' + global.generateUniqueID() + ']';
      } while (Bazeries.instances[id] || global.objectInstances[id]);
      
      Bazeries.instances[id] = new Bazeries.BazeriesInstance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Bazeries.instances[id]) {
        delete Bazeries.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Bazeries', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (perform transposition)
    encryptBlock: function(id, plaintext) {
      return Bazeries.processBlock(id, plaintext, true);
    },
    
    // Decrypt block (reverse transposition)
    decryptBlock: function(id, ciphertext) {
      return Bazeries.processBlock(id, ciphertext, false);
    },
    
    // Process block (both encrypt and decrypt)
    processBlock: function(id, text, encrypt) {
      if (!Bazeries.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Bazeries', 'processBlock');
        return text;
      }
      
      const instance = Bazeries.instances[id];
      const key = instance.key;
      
      if (!key || key.length === 0) {
        return text; // No key, no processing
      }
      
      // Extract only letters for processing
      const letters = Bazeries.extractLetters(text);
      if (letters.length === 0) {
        return text;
      }
      
      // Determine matrix dimensions
      const keyLength = key.length;
      const textLength = letters.length;
      const rows = Math.ceil(textLength / keyLength);
      const cols = keyLength;
      
      // Create and fill matrix
      const matrix = [];
      for (let r = 0; r < rows; r++) {
        matrix[r] = [];
        for (let c = 0; c < cols; c++) {
          const index = r * cols + c;
          matrix[r][c] = (index < textLength) ? letters.charAt(index) : '';
        }
      }
      
      // Get column order from key
      const columnOrder = Bazeries.getColumnOrder(key, encrypt);
      
      // Read matrix in column order
      let result = '';
      for (let i = 0; i < columnOrder.length; i++) {
        const col = columnOrder[i];
        for (let row = 0; row < rows; row++) {
          if (matrix[row][col]) {
            result += matrix[row][col];
          }
        }
      }
      
      // Reinsert non-letter characters
      return Bazeries.reinsertNonLetters(text, result);
    },
    
    // Extract only letters from text
    extractLetters: function(text) {
      let letters = '';
      for (let i = 0; i < text.length; i++) {
        const char = text.charAt(i);
        if (Bazeries.isLetter(char)) {
          letters += char;
        }
      }
      return letters;
    },
    
    // Reinsert non-letter characters in their original positions
    reinsertNonLetters: function(originalText, processedLetters) {
      let result = '';
      let letterIndex = 0;
      
      for (let i = 0; i < originalText.length; i++) {
        const char = originalText.charAt(i);
        if (Bazeries.isLetter(char)) {
          if (letterIndex < processedLetters.length) {
            result += processedLetters.charAt(letterIndex++);
          } else {
            result += char; // Fallback
          }
        } else {
          result += char; // Preserve non-letters
        }
      }
      
      return result;
    },
    
    // Get column order from key
    getColumnOrder: function(key, encrypt) {
      // Create array of indices with their corresponding key characters
      const keyArray = [];
      for (let i = 0; i < key.length; i++) {
        keyArray.push({ char: key.charAt(i).toLowerCase(), index: i });
      }
      
      // Sort by character to get alphabetic order
      keyArray.sort((a, b) => {
        if (a.char < b.char) return -1;
        if (a.char > b.char) return 1;
        return a.index - b.index; // Stable sort for duplicate characters
      });
      
      if (encrypt) {
        // For encryption, use the sorted order
        return keyArray.map(item => item.index);
      } else {
        // For decryption, reverse the permutation
        const decryptOrder = new Array(key.length);
        for (let i = 0; i < keyArray.length; i++) {
          decryptOrder[keyArray[i].index] = i;
        }
        return decryptOrder;
      }
    },
    
    // Check if character is a letter
    isLetter: function(char) {
      return /[A-Za-z]/.test(char);
    },
    
    // Validate and clean key
    validateKey: function(keyString) {
      if (!keyString) return '';
      
      // Remove non-alphabetic characters
      return keyString.replace(/[^A-Za-z]/g, '');
    },
    
    // Instance class
    BazeriesInstance: function(keyString) {
      this.rawKey = keyString || '';
      this.key = Bazeries.validateKey(keyString);
      
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
    global.Cipher.Add(Bazeries);
  
  global.Bazeries = Bazeries;
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);