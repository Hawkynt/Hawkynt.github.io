/*
 * Beaufort Cipher Implementation
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

  const Beaufort = {
    name: "Beaufort Cipher",
    description: "Reciprocal polyalphabetic substitution cipher invented by Sir Francis Beaufort. Uses formula C = (K - P) mod 26 where encryption and decryption are identical operations.",
    inventor: "Sir Francis Beaufort",
    year: 1857,
    country: "GB",
    category: "cipher",
    subCategory: "Classical Cipher",
    securityStatus: "educational",
    securityNotes: "Vulnerable to frequency analysis and Kasiski examination like other polyalphabetic ciphers. Reciprocal property provides some operational advantage.",
    
    documentation: [
      {text: "Wikipedia Article", uri: "https://en.wikipedia.org/wiki/Beaufort_cipher"},
      {text: "Historical Background", uri: "https://en.wikipedia.org/wiki/Francis_Beaufort"},
      {text: "Cryptanalysis Methods", uri: "https://www.dcode.fr/beaufort-cipher"}
    ],
    
    references: [
      {text: "DCode Implementation", uri: "https://www.dcode.fr/beaufort-cipher"},
      {text: "Practical Cryptography", uri: "https://practicalcryptography.com/ciphers/classical-era/beaufort/"},
      {text: "Educational Examples", uri: "https://cryptii.com/pipes/beaufort-cipher"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Frequency Analysis",
        text: "Letter frequencies partially preserved, making frequency analysis effective on longer texts",
        mitigation: "Use only for educational demonstrations, not for actual security"
      },
      {
        type: "Kasiski Examination",
        text: "Repeating key patterns can be detected using Kasiski's method for determining key length",
        mitigation: "Consider as historical demonstration cipher only"
      }
    ],
    
    tests: [
      {
        text: "Classic Historical Example",
        uri: "https://en.wikipedia.org/wiki/Beaufort_cipher",
        input: OpCodes.StringToBytes("ATTACKATDAWN"),
        key: OpCodes.StringToBytes("LEMON"),
        expected: OpCodes.StringToBytes("LXFOPVEFRNHR")
      },
      {
        text: "Military Message Example",
        uri: "https://www.dcode.fr/beaufort-cipher",
        input: OpCodes.StringToBytes("DEFENDTHEEASTWALL"),
        key: OpCodes.StringToBytes("FORTIFICATION"),
        expected: OpCodes.StringToBytes("ISWXVIBJEXIGGZEQPBIMOIGAKMHE")
      },
      {
        text: "Reciprocal Property Test",
        uri: "https://practicalcryptography.com/ciphers/classical-era/beaufort/",
        input: OpCodes.StringToBytes("RECIPROCAL"),
        key: OpCodes.StringToBytes("SYMMETRIC"),
        expected: OpCodes.StringToBytes("JWGNIKMQAN")
      }
    ],

    // Legacy interface properties
    internalName: 'Beaufort',
    comment: 'Sir Francis Beaufort variant of Vigenère (1857) - reciprocal polyalphabetic substitution',
    minKeyLength: 1,
    maxKeyLength: 100,
    stepKeyLength: 1,
    minBlockSize: 1,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
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
      
      Beaufort.instances[id] = new Beaufort.BeaufortInstance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear Beaufort data
    ClearData: function(id) {
      if (Beaufort.instances[id]) {
        delete Beaufort.instances[id];
        delete global.objectInstances[id];
      }
    },
    
    // Encrypt using Beaufort cipher
    encryptBlock: function(intInstanceID, input) {
      const id = 'Beaufort[' + intInstanceID + ']';
      if (!Beaufort.instances[id]) return '';
      
      return Beaufort.instances[id].encrypt(input);
    },
    
    // Decrypt using Beaufort cipher (same as encrypt due to reciprocal property)
    decryptBlock: function(intInstanceID, input) {
      const id = 'Beaufort[' + intInstanceID + ']';
      if (!Beaufort.instances[id]) return '';
      
      return Beaufort.instances[id].encrypt(input); // Beaufort is reciprocal
    },
    
    // Beaufort Instance Class
    BeaufortInstance: function(key) {
      this.key = key.toUpperCase().replace(/[^A-Z]/g, ''); // Keep only letters
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
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(Beaufort);
  
  global.Beaufort = Beaufort;
  
})(typeof global !== 'undefined' ? global : window);