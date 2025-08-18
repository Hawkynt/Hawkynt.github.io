/*
 * Simplified Phelix-inspired Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Educational implementation with clear security warnings
 * (c)2025 Hawkynt - Educational purposes only
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
      console.error('Phelix Simple cipher requires Cipher system to be loaded first');
      return;
    }
  }

  const PhelixSimple = {
    name: "Phelix Simple",
    description: "Educational implementation inspired by Phelix stream cipher. Uses XOR, addition mod 2^32, and rotation operations for demonstration purposes. This is a simplified version with known security flaws.",
    inventor: "Doug Whiting, Bruce Schneier, Stefan Lucks, Frédéric Muller",
    year: 2004,
    country: "US",
    category: "cipher",
    subCategory: "Stream Cipher",
    securityStatus: "educational",
    securityNotes: "Educational implementation with known security flaws. Original Phelix also has documented vulnerabilities. Never use for production.",
    
    documentation: [
      {text: "Phelix Wikipedia", uri: "https://en.wikipedia.org/wiki/Phelix"},
      {text: "eSTREAM Project", uri: "https://www.ecrypt.eu.org/stream/"}
    ],
    
    references: [
      {text: "Original Phelix Paper", uri: "https://www.schneier.com/academic/paperfiles/paper-phelix.pdf"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Differential Attack", 
        text: "Original Phelix vulnerable to differential cryptanalysis by Wu and Preneel",
        mitigation: "Educational use only, never use in production"
      }
    ],
    
    tests: [
      {
        text: "Educational Test Vector",
        uri: "Educational test case",
        keySize: 16,
        key: Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        input: Hex8ToBytes("00000000000000000000000000000000"),
        expected: [] // Educational implementation, no official test vectors
      }
    ],

    // Public interface properties
    minKeyLength: 16,
    maxKeyLength: 32,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,

    // Initialize cipher
    Init: function() {
      this.isInitialized = true;
      return true;
    },

    // Convert string to 32-bit words
    stringToWords: function(str) {
      const words = [];
      for (let i = 0; i < str.length; i += 4) {
        let word = 0;
        for (let j = 0; j < 4 && i + j < str.length; j++) {
          word |= (str.charCodeAt(i + j) & 0xFF) << (j * 8);
        }
        words.push(word >>> 0); // Convert to unsigned 32-bit
      }
      return words;
    },

    // Convert 32-bit words to string
    wordsToString: function(words) {
      let result = '';
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        for (let j = 0; j < 4; j++) {
          result += String.fromCharCode((word >>> (j * 8)) & 0xFF);
        }
      }
      return result;
    },

    // Rotate left
    rotateLeft: function(value, positions) {
      return ((value << positions) | (value >>> (32 - positions))) >>> 0;
    },

    // Set up key and nonce
    KeySetup: function(optional_key) {
      let id;
      do {
        id = 'PhelixSimple[' + global.generateUniqueID() + ']';
      } while (PhelixSimple.instances[id] || global.objectInstances[id]);
      
      try {
        PhelixSimple.instances[id] = new PhelixSimple.PhelixSimpleInstance(optional_key);
        global.objectInstances[id] = true;
        return id;
      } catch (e) {
        global.throwException('Key Setup Exception', e.message, 'PhelixSimple', 'KeySetup');
        return null;
      }
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (PhelixSimple.instances[id]) {
        // Secure cleanup
        const instance = PhelixSimple.instances[id];
        if (instance.key) {
          for (let i = 0; i < instance.key.length; i++) {
            instance.key[i] = 0;
          }
        }
        if (instance.state) {
          for (let i = 0; i < instance.state.length; i++) {
            instance.state[i] = 0;
          }
        }
        delete PhelixSimple.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'PhelixSimple', 'ClearData');
        return false;
      }
    },
    
    // Generate keystream and XOR with input
    encryptBlock: function(id, plaintext) {
      if (!PhelixSimple.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'PhelixSimple', 'encryptBlock');
        return plaintext;
      }
      
      const instance = PhelixSimple.instances[id];
      const inputWords = PhelixSimple.stringToWords(plaintext);
      const outputWords = [];
      
      for (let i = 0; i < inputWords.length; i++) {
        const keystream = instance.generateKeystreamWord();
        outputWords.push((inputWords[i] ^ keystream) >>> 0);
      }
      
      // Handle remaining bytes
      const remainder = plaintext.length % 4;
      if (remainder > 0) {
        const keystream = instance.generateKeystreamWord();
        let lastWord = 0;
        for (let j = 0; j < remainder; j++) {
          const charCode = plaintext.charCodeAt(plaintext.length - remainder + j);
          lastWord |= (charCode << (j * 8));
        }
        outputWords[outputWords.length - 1] = (lastWord ^ keystream) >>> 0;
      }
      
      return PhelixSimple.wordsToString(outputWords).substring(0, plaintext.length);
    },
    
    // Decrypt (same as encrypt for stream cipher)
    decryptBlock: function(id, ciphertext) {
      return this.encryptBlock(id, ciphertext);
    },
    
    // Add uppercase aliases for compatibility with test runner
    EncryptBlock: function(id, plaintext) {
      return this.encryptBlock(id, plaintext);
    },
    
    DecryptBlock: function(id, ciphertext) {
      return this.decryptBlock(id, ciphertext);
    },
    
    // Instance class
    PhelixSimpleInstance: function(key) {
      if (!key || key.length < 16) {
        throw new Error('PhelixSimple requires at least 16-byte key');
      }
      
      // Convert key to words
      this.key = PhelixSimple.stringToWords(key.substring(0, 32));
      
      // Initialize state with key material (simplified)
      this.state = [];
      for (let i = 0; i < 8; i++) {
        this.state[i] = this.key[i % this.key.length] ^ (i * 0x9E3779B9);
      }
      
      // Simple initialization rounds
      for (let round = 0; round < 16; round++) {
        this.updateState();
      }
      
      // Reset position counter
      this.position = 0;
    }
  };

  // Add methods to instance prototype
  PhelixSimple.PhelixSimpleInstance.prototype.updateState = function() {
    // Simplified Phelix-inspired state update
    for (let i = 0; i < this.state.length; i++) {
      const prev = this.state[(i + this.state.length - 1) % this.state.length];
      const next = this.state[(i + 1) % this.state.length];
      
      // Mix with addition, XOR, and rotation
      this.state[i] = (this.state[i] + prev) >>> 0;
      this.state[i] ^= PhelixSimple.rotateLeft(next, 7);
      this.state[i] = PhelixSimple.rotateLeft(this.state[i], 13);
      this.state[i] = (this.state[i] + 0x9E3779B9) >>> 0;
    }
  };

  PhelixSimple.PhelixSimpleInstance.prototype.generateKeystreamWord = function() {
    // Update state
    this.updateState();
    
    // Generate output word from state
    const output = (this.state[0] ^ this.state[3] ^ this.state[6]) >>> 0;
    
    this.position++;
    return output;
  };
  
  // Auto-register with Subsystem (according to category) if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(PhelixSimple);
  
  // Export to global scope
  global.PhelixSimple = PhelixSimple;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PhelixSimple;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);