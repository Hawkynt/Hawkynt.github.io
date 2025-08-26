/*
 * Rule30 Cellular Automata Stream Cipher Implementation
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes:', e.message);
      return;
    }
  }
  
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    try {
      global.AlgorithmFramework = require('../../AlgorithmFramework.js');
    } catch (e) {
      console.error('Failed to load AlgorithmFramework:', e.message);
      return;
    }
  } 
  
  const Rule30 = {
    name: "Rule30",
    description: "Elementary cellular automaton-based pseudorandom number generator using Rule 30 pattern. Exhibits chaotic behavior suitable for simple random number generation but not cryptographically secure.",
    inventor: "Stephen Wolfram",
    year: 1983,
    country: "GB",
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.STREAM : 'stream',
    subCategory: "Stream Cipher",
    securityStatus: "educational",
    securityNotes: "Cellular automaton not designed for cryptographic use. Predictable with sufficient state knowledge and lacks proper cryptographic properties. Educational use only.",
    
    documentation: [
      {text: "Rule 30 Wikipedia", uri: "https://en.wikipedia.org/wiki/Rule_30"},
      {text: "A New Kind of Science", uri: "https://www.wolframscience.com/nks/"}
    ],
    
    references: [
      {text: "Wolfram's Original Paper", uri: "https://www.stephenwolfram.com/publications/cellular-automata-irreversibility/"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Predictability", 
        text: "State can be reconstructed from sufficient keystream output, not cryptographically secure",
        mitigation: "Use only for educational purposes, never for actual cryptography"
      }
    ],
    
    tests: [
      {
        text: "Rule30 Deterministic Test - Simple Key",
        uri: "Educational deterministic test case",
        keySize: 8,
        key: global.OpCodes.Hex8ToBytes("0102030405060708"),
        input: global.OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: global.OpCodes.Hex8ToBytes("75ba7afe575d87a4484b50e3cbb6ba7e")
      }
    ],

    // Required by cipher system
    minKeyLength: 1,
    maxKeyLength: 1024,
    stepKeyLength: 1,
    minBlockSize: 1,
    maxBlockSize: 1024,
    stepBlockSize: 1,
    instances: {},
    
    // Cipher parameters
    nBlockSizeInBits: 8,     // Generate 8 bits at a time
    nKeySizeInBits: 256,     // Use key to initialize the CA state
    
    // Constants
    DEFAULT_SIZE: 127,       // CA array size (odd number for central cell)
    
    // Internal state
    isInitialized: false,
    cantDecode: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    /**
     * Initialize cipher with empty state
     */
    Init: function() {
      this.isInitialized = true;
      return true;
    },
    
    /**
     * Setup key for Rule30 stream cipher
     * @param {Array} key - Key as byte array
     */
    KeySetup: function(key) {
      let id;
      do {
        id = 'Rule30[' + global.generateUniqueID() + ']';
      } while (Rule30.instances[id] || global.objectInstances[id]);
      
      Rule30.instances[id] = new Rule30.Rule30Instance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    /**
     * Clear cipher data
     */
    ClearData: function(id) {
      if (Rule30.instances[id]) {
        const instance = Rule30.instances[id];
        if (instance.cells && global.OpCodes) {
          global.OpCodes.ClearArray(instance.cells);
        }
        delete Rule30.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Rule30', 'ClearData');
        return false;
      }
    },
    
    /**
     * Encrypt block using Rule30 stream cipher
     */
    encryptBlock: function(id, input) {
      if (!Rule30.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Rule30', 'encryptBlock');
        return input;
      }
      
      const instance = Rule30.instances[id];
      const result = [];
      
      for (let n = 0; n < input.length; n++) {
        const keystreamByte = instance.generateByte();
        let inputByte;
        if (typeof input === 'string') {
          inputByte = input.charCodeAt(n) & 0xFF;
        } else {
          inputByte = input[n] & 0xFF;
        }
        const outputByte = inputByte ^ keystreamByte;
        result.push(outputByte);
      }
      
      return result;
    },
    
    /**
     * Decrypt block (same as encrypt for stream cipher)
     */
    decryptBlock: function(id, input) {
      return Rule30.encryptBlock(id, input);
    },

    // Create instance for testing framework
    CreateInstance: function(isDecrypt) {
      return {
        _instance: null,
        _inputData: [],
        
        set key(keyData) {
          this._key = keyData;
          this._instance = new Rule30.Rule30Instance(keyData);
        },
        
        set keySize(size) {
          this._keySize = size;
        },
        
        Feed: function(data) {
          if (Array.isArray(data)) {
            this._inputData = data.slice();
          } else if (typeof data === 'string') {
            this._inputData = [];
            for (let i = 0; i < data.length; i++) {
              this._inputData.push(data.charCodeAt(i));
            }
          }
        },
        
        Result: function() {
          if (!this._inputData || this._inputData.length === 0) {
            return [];
          }
          
          if (!this._key) {
            this._key = new Array(32).fill(0);
          }
          
          const freshInstance = new Rule30.Rule30Instance(this._key);
          
          const result = [];
          for (let i = 0; i < this._inputData.length; i++) {
            const keystreamByte = freshInstance.generateByte();
            result.push(this._inputData[i] ^ keystreamByte);
          }
          return result;
        }
      };
    },

    // Required interface method for stream ciphers
    encrypt: function(id, plaintext) {
      const result = this.encryptBlock(id, plaintext);
      return Array.isArray(result) ? result : [];
    },

    decrypt: function(id, ciphertext) {
      const result = this.decryptBlock(id, ciphertext);
      return Array.isArray(result) ? result : [];
    },
    
    /**
     * Rule30 Instance class
     */
    Rule30Instance: function(key) {
      this.cells = null;
      this.size = Rule30.DEFAULT_SIZE;
      this.centerIndex = Math.floor(this.size / 2);
      
      // Initialize CA state from key
      this.initializeFromKey(key);
    }
  };
  
  // Add methods to Rule30Instance prototype
  Rule30.Rule30Instance.prototype = {
    
    initializeFromKey: function(key) {
      // Ensure we have a key
      if (!key || !Array.isArray(key)) {
        key = new Array(32).fill(0);
      }
      
      // Pad or truncate key to 32 bytes
      if (key.length < 32) {
        while (key.length < 32) {
          key.push(0);
        }
      } else if (key.length > 32) {
        key = key.slice(0, 32);
      }
      
      this.cells = new Array(this.size).fill(0);
      
      // Use key bytes to set initial cell states
      for (let i = 0; i < this.size; i++) {
        const keyIndex = i % key.length;
        const bitIndex = i % 8;
        this.cells[i] = (key[keyIndex] >>> bitIndex) & 1;
      }
      
      // Ensure at least one cell is set
      if (this.cells.every(cell => cell === 0)) {
        this.cells[this.centerIndex] = 1;
      }
      
      // Perform initial evolution steps
      for (let step = 0; step < 100; step++) {
        this.evolveCA();
      }
    },
    
    evolveCA: function() {
      const newCells = new Array(this.size);
      
      for (let i = 0; i < this.size; i++) {
        const left = this.cells[(i - 1 + this.size) % this.size];
        const center = this.cells[i];
        const right = this.cells[(i + 1) % this.size];
        
        // Apply Rule 30: XOR of left neighbor and (center OR right neighbor)
        newCells[i] = left ^ (center | right);
      }
      
      this.cells = newCells;
    },
    
    generateBit: function() {
      this.evolveCA();
      return this.cells[this.centerIndex];
    },
    
    generateByte: function() {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const bitValue = this.generateBit();
        byte |= (bitValue << bit);
      }
      return byte;
    }
  };
  
  // Auto-register with AlgorithmFramework if available
  if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
    global.AlgorithmFramework.RegisterAlgorithm(Rule30);
  }
  
  // Legacy registration
  if (typeof global.RegisterAlgorithm === 'function') {
    global.RegisterAlgorithm(Rule30);
  }
  
  // Auto-register with Cipher system if available
  if (global.Cipher) {
    global.Cipher.Add(Rule30);
  }
  
  // Export to global scope
  global.Rule30 = Rule30;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Rule30;
  }
  
})(typeof global !== 'undefined' ? global : window);