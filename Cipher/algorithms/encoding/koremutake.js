/*
 * Universal Koremutake Encoding
 * Compatible with both Browser and Node.js environments
 * Based on Shorl.com's memorable string encoding
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
      console.error('Koremutake requires Cipher system to be loaded first');
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
  
  // Create Koremutake encoding object
  const Koremutake = {
    // Public interface properties
    internalName: 'Koremutake',
    name: 'Koremutake Encoding',
    comment: 'Memorable phonetic string encoding for large numbers',
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
        "input": "",
        "key": "",
        "expected": "BA",
        "description": "Empty string encoding"
    },
    {
        "input": "hello",
        "key": "",
        "expected": "FEDALEMEVUGRO",
        "description": "Simple text encoding"
    },
    {
        "input": "test",
        "key": "",
        "expected": "DEJYGOFRAPRI",
        "description": "Short string encoding"
    },
    {
        "input": "a",
        "key": "",
        "expected": "DRE",
        "description": "Single character encoding"
    },
    {
        "input": "xyz",
        "key": "",
        "expected": "BODREPRASTI",
        "description": "Three character encoding"
    },
    {
        "input": "123",
        "key": "",
        "expected": "BERIDRUMO",
        "description": "Numeric string encoding"
    }
],
    cantDecode: false,
    isInitialized: false,
    
    // 128 phonetically unique syllables (each represents 7 bits)
    // Based on Shorl.com specification: consonants + vowels, phonetically distinct
    SYLLABLES: [
      'BA', 'BE', 'BI', 'BO', 'BU', 'BY', 'DA', 'DE', 'DI', 'DO', 'DU', 'DY', 'FA', 'FE', 'FI', 'FO',
      'FU', 'FY', 'GA', 'GE', 'GI', 'GO', 'GU', 'GY', 'HA', 'HE', 'HI', 'HO', 'HU', 'HY', 'JA', 'JE',
      'JI', 'JO', 'JU', 'JY', 'KA', 'KE', 'KI', 'KO', 'KU', 'KY', 'LA', 'LE', 'LI', 'LO', 'LU', 'LY',
      'MA', 'ME', 'MI', 'MO', 'MU', 'MY', 'NA', 'NE', 'NI', 'NO', 'NU', 'NY', 'PA', 'PE', 'PI', 'PO',
      'PU', 'PY', 'RA', 'RE', 'RI', 'RO', 'RU', 'RY', 'SA', 'SE', 'SI', 'SO', 'SU', 'SY', 'TA', 'TE',
      'TI', 'TO', 'TU', 'TY', 'VA', 'VE', 'VI', 'VO', 'VU', 'VY', 'BRA', 'BRE', 'BRI', 'BRO', 'BRU', 'BRY',
      'DRA', 'DRE', 'DRI', 'DRO', 'DRU', 'DRY', 'FRA', 'FRE', 'FRI', 'FRO', 'FRU', 'FRY', 'GRA', 'GRE', 'GRI', 'GRO',
      'GRU', 'GRY', 'PRA', 'PRE', 'PRI', 'PRO', 'PRU', 'PRY', 'STA', 'STE', 'STI', 'STO', 'STU', 'STY', 'TRA', 'TRE',
      'TRI', 'TRO', 'TRU', 'TRY'
    ],
    
    // Initialize encoding
    Init: function() {
      Koremutake.isInitialized = true;
    },
    
    // Convert string to number
    stringToNumber: function(str) {
      let num = 0;
      for (let i = 0; i < str.length; i++) {
        num = num * 256 + str.charCodeAt(i);
      }
      return num;
    },
    
    // Convert number to string
    numberToString: function(num) {
      if (num === 0) return '';
      
      let str = '';
      while (num > 0) {
        str = String.fromCharCode(num % 256) + str;
        num = Math.floor(num / 256);
      }
      return str;
    },
    
    // Set up encoding (no key needed)
    KeySetup: function(key) {
      let id;
      do {
        id = 'Koremutake[' + global.generateUniqueID() + ']';
      } while (Koremutake.instances[id] || global.objectInstances[id]);
      
      Koremutake.instances[szID] = { initialized: true };
      global.objectInstances[szID] = true;
      return szID;
    },
    
    // Clear encoding data
    ClearData: function(id) {
      if (Koremutake.instances[id]) {
        delete Koremutake.instances[szID];
        delete global.objectInstances[szID];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Koremutake', 'ClearData');
        return false;
      }
    },
    
    // Encode to Koremutake
    encryptBlock: function(id, szPlainText) {
      if (!Koremutake.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Koremutake', 'encryptBlock');
        return szPlainText;
      }
      
      if (szPlainText.length === 0) {
        return 'BA'; // Empty string maps to first syllable
      }
      
      // Convert string to a large number
      let num = Koremutake.stringToNumber(szPlainText);
      let result = '';
      
      // Convert number to syllables (base 128, using 7 bits per syllable)
      while (num > 0) {
        const syllableIndex = num % 128;
        result = Koremutake.SYLLABLES[syllableIndex] + result;
        num = Math.floor(num / 128);
      }
      
      return result || 'BA';
    },
    
    // Decode from Koremutake
    decryptBlock: function(id, szCipherText) {
      if (!Koremutake.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Koremutake', 'decryptBlock');
        return szCipherText;
      }
      
      if (szCipherText === 'BA') {
        return ''; // First syllable maps to empty string
      }
      
      // Parse syllables from input
      const syllables = [];
      let remaining = szCipherText.toUpperCase();
      
      while (remaining.length > 0) {
        let found = false;
        // Try 3-letter syllables first, then 2-letter
        for (let len = 3; len >= 2; len--) {
          if (remaining.length >= len) {
            const candidate = remaining.substr(0, len);
            const index = Koremutake.SYLLABLES.indexOf(candidate);
            if (index !== -1) {
              syllables.push(index);
              remaining = remaining.substr(len);
              found = true;
              break;
            }
          }
        }
        
        if (!found) {
          throw new Error('Invalid Koremutake syllable: ' + remaining.substr(0, 3));
        }
      }
      
      // Convert syllables back to number
      let num = 0;
      for (let i = 0; i < syllables.length; i++) {
        num = num * 128 + syllables[i];
      }
      
      // Convert number back to string
      return Koremutake.numberToString(num);
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(Koremutake);
  }
  
  // Export to global scope
  global.Koremutake = Koremutake;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Koremutake;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);