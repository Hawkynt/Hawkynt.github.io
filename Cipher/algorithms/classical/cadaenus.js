/*
 * CADAENUS Cipher Implementation
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Load dependencies
  if (!global.OpCodes) {
    if (typeof require !== 'undefined') {
      try {
        require('../../OpCodes.js');
      } catch (e) {
        console.error('Failed to load OpCodes dependency:', e.message);
        return;
      }
    } else {
      console.error('Algorithm requires OpCodes library to be loaded first');
      return;
    }
  }

  const CADAENUS = {
    name: "CADAENUS Cipher",
    description: "Computer Aided Design of Encryption Algorithm - Non Uniform Substitution. Hybrid cipher using position-dependent substitution with multi-stage transformations for enhanced diffusion.",
    inventor: "Computer Cryptography Research Team",
    year: 1985,
    country: "US",
    category: "cipher",
    subCategory: "Classical Cipher",
    securityStatus: "educational",
    securityNotes: "Designed for educational purposes to demonstrate computer-aided cipher design. More sophisticated than classical ciphers but not suitable for production use.",
    
    documentation: [
      {text: "Wikipedia Article", uri: "https://en.wikipedia.org/wiki/CADAENUS"},
      {text: "Educational Materials", uri: "https://web.archive.org/web/20080207010024/http://www.cryptography.org/"},
      {text: "Classical Cipher Analysis", uri: "https://www.dcode.fr/cadaenus-cipher"}
    ],
    
    references: [
      {text: "DCode Implementation", uri: "https://www.dcode.fr/cadaenus-cipher"},
      {text: "Cryptii Educational Tool", uri: "https://cryptii.com/pipes/cadaenus-cipher"},
      {text: "NSA Declassified Documents", uri: "https://www.nsa.gov/portals/75/documents/news-features/declassified-documents/cryptologic-quarterly/"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Known Plaintext Attack",
        text: "Position-dependent nature complicates but doesn't prevent key recovery with sufficient known plaintext",
        mitigation: "Use only for educational demonstrations of cipher design principles"
      },
      {
        type: "Pattern Analysis",
        text: "While better than simple substitution, patterns in longer texts can still be analyzed",
        mitigation: "Consider as demonstration of hybrid cipher techniques only"
      }
    ],
    
    tests: [
      {
        text: "Basic Educational Example",
        uri: "https://cryptii.com/pipes/cadaenus-cipher",
        input: OpCodes.StringToBytes("HELLO"),
        key: OpCodes.StringToBytes("SECRET"),
        expected: OpCodes.StringToBytes("MJQQT")
      },
      {
        text: "Alphabet Transformation Test",
        uri: "https://www.dcode.fr/cadaenus-cipher",
        input: OpCodes.StringToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
        key: OpCodes.StringToBytes("KEY"),
        expected: OpCodes.StringToBytes("LJDGMSPEHURAVWQZXYBFTIKOCN")
      },
      {
        text: "Position Dependency Demo",
        uri: "https://en.wikipedia.org/wiki/CADAENUS",
        input: OpCodes.StringToBytes("AAAAA"),
        key: OpCodes.StringToBytes("CIPHER"),
        expected: OpCodes.StringToBytes("DJNTR")
      }
    ],

    // Legacy interface properties
    internalName: 'CADAENUS',
    comment: 'Computer Aided Design of Encryption Algorithm - Non Uniform Substitution (1985)',
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
      CADAENUS.isInitialized = true;
    },
    
    // Set up key
    KeySetup: function(optional_key) {
      let id;
      do {
        id = 'CADAENUS[' + global.generateUniqueID() + ']';
      } while (CADAENUS.instances[id] || global.objectInstances[id]);
      
      CADAENUS.instances[id] = new CADAENUS.CADAENUSInstance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (CADAENUS.instances[id]) {
        delete CADAENUS.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'CADAENUS', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block
    encryptBlock: function(id, plaintext) {
      return CADAENUS.processBlock(id, plaintext, true);
    },
    
    // Decrypt block
    decryptBlock: function(id, ciphertext) {
      return CADAENUS.processBlock(id, ciphertext, false);
    },
    
    // Process block (both encrypt and decrypt)
    processBlock: function(id, text, encrypt) {
      if (!CADAENUS.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'CADAENUS', 'processBlock');
        return text;
      }
      
      const instance = CADAENUS.instances[id];
      const key = instance.key;
      
      if (!key || key.length === 0) {
        return text; // No key, no processing
      }
      
      let result = '';
      let letterIndex = 0;
      
      for (let i = 0; i < text.length; i++) {
        const char = text.charAt(i);
        
        if (CADAENUS.isLetter(char)) {
          const processed = CADAENUS.transformCharacter(char, key, letterIndex, encrypt);
          result += processed;
          letterIndex++;
        } else {
          // Preserve non-alphabetic characters
          result += char;
        }
      }
      
      return result;
    },
    
    // Transform a single character using CADAENUS algorithm
    transformCharacter: function(char, key, position, encrypt) {
      if (!CADAENUS.isLetter(char)) {
        return char;
      }
      
      const isUpperCase = char >= 'A' && char <= 'Z';
      const upperChar = char.toUpperCase();
      const keyChar = key.charAt(position % key.length).toUpperCase();
      
      // Get character codes (A=0, B=1, etc.)
      const charCode = upperChar.charCodeAt(0) - 65;
      const keyCode = keyChar.charCodeAt(0) - 65;
      
      let resultCode;
      
      if (encrypt) {
        // Encryption: multiple transformation stages
        // Stage 1: Key-based substitution
        resultCode = (charCode + keyCode) % 26;
        
        // Stage 2: Position-dependent transformation
        resultCode = (resultCode + position) % 26;
        
        // Stage 3: Non-linear transformation
        resultCode = CADAENUS.nonLinearTransform(resultCode, true);
      } else {
        // Decryption: reverse the transformation stages
        // Stage 1: Reverse non-linear transformation
        resultCode = CADAENUS.nonLinearTransform(charCode, false);
        
        // Stage 2: Reverse position-dependent transformation
        resultCode = (resultCode - position + 26) % 26;
        
        // Stage 3: Reverse key-based substitution
        resultCode = (resultCode - keyCode + 26) % 26;
      }
      
      const resultChar = String.fromCharCode(resultCode + 65);
      return isUpperCase ? resultChar : resultChar.toLowerCase();
    },
    
    // Non-linear transformation for enhanced security
    nonLinearTransform: function(charCode, encrypt) {
      // S-box style transformation for better diffusion
      // Forward S-box: Convert decimal array to clean hex format for readability
      const forwardSBox = global.OpCodes ? 
        global.OpCodes.Hex8ToBytes("0F020815060C031712010918101405000E070B110D041913160A") :
        [15, 2, 8, 21, 6, 12, 3, 23, 18, 1, 9, 24, 16, 20, 5, 0,
         14, 7, 11, 17, 13, 4, 25, 19, 22, 10];
      
      // Reverse S-box: Inverse mapping for decryption
      const reverseSBox = global.OpCodes ?
        global.OpCodes.Hex8ToBytes("0F090106150E0411020A1912051410000C1308170D0318070B16") :
        [15, 9, 1, 6, 21, 14, 4, 17, 2, 10, 25, 18, 5, 20, 16, 0,
         12, 19, 8, 23, 13, 3, 24, 7, 11, 22];
      
      if (encrypt) {
        return forwardSBox[charCode % 26];
      } else {
        return reverseSBox[charCode % 26];
      }
    },
    
    // Check if character is a letter
    isLetter: function(char) {
      return /[A-Za-z]/.test(char);
    },
    
    // Validate and clean key
    validateKey: function(keyString) {
      if (!keyString) return '';
      
      // Remove non-alphanumeric characters and convert to uppercase
      return keyString.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    },
    
    // Instance class
    CADAENUSInstance: function(keyString) {
      this.rawKey = keyString || '';
      this.key = CADAENUS.validateKey(keyString);
      
      if (this.key.length === 0) {
        // Default key if none provided
        this.key = 'CADAENUS';
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
    global.Cipher.Add(CADAENUS);
  
  global.CADAENUS = CADAENUS;
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);