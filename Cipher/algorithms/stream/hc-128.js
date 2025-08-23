#!/usr/bin/env node
/*
 * Universal HC-128 Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on HC-128 specification by Hongjun Wu
 * (c)2006-2025 Hawkynt
 * 
 * HC-128 is a software-efficient stream cipher designed by Hongjun Wu.
 * It features:
 * - Two 512-word tables (P and Q)
 * - 128-bit keys and 128-bit initialization vectors
 * - High performance in software implementations
 * - eSTREAM Profile 1 finalist
 * 
 * The cipher generates keystream by updating and combining
 * values from the two tables using nonlinear functions.
 * 
 * This implementation is for educational purposes only.
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
  } else {
      console.error('HC-128 cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create HC-128 cipher object
  const HC128 = {
    // Public interface properties
    internalName: 'HC-128',
    name: 'HC-128 Stream Cipher',
    comment: 'HC-128 eSTREAM Stream Cipher - Table-based with 128-bit key and IV',
    minKeyLength: 16,   // HC-128 uses 128-bit keys (16 bytes)
    maxKeyLength: 16,
    stepKeyLength: 1,
    minBlockSize: 1,    // Stream cipher - processes byte by byte
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // HC-128 constants
    TABLE_SIZE: 512,       // Each table has 512 32-bit words
    KEY_SIZE: 128,         // 128-bit key
    IV_SIZE: 128,          // 128-bit IV
    INIT_STEPS: 1024,      // Initialization steps
    
    // Initialize cipher
    Init: function() {
      HC128.isInitialized = true;
    },
    
    // Set up key and initialize HC-128 state
    KeySetup: function(key) {
      let id;
      do {
        id = 'HC-128[' + global.generateUniqueID() + ']';
      } while (HC128.instances[id] || global.objectInstances[id]);
      
      HC128.instances[id] = new HC128.HC128Instance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (HC128.instances[id]) {
        // Clear sensitive data
        const instance = HC128.instances[id];
        if (instance.P && global.OpCodes) {
          global.OpCodes.ClearArray(instance.P);
        }
        if (instance.Q && global.OpCodes) {
          global.OpCodes.ClearArray(instance.Q);
        }
        if (instance.keyBytes && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyBytes);
        }
        delete HC128.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'HC-128', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (for stream cipher, this generates keystream and XORs with input)
    encryptBlock: function(id, plaintext) {
      if (!HC128.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'HC-128', 'encryptBlock');
        return plaintext;
      }
      
      const instance = HC128.instances[id];
      let result = '';
      
      for (let n = 0; n < plaintext.length; n++) {
        const keystreamByte = instance.getNextKeystreamByte();
        const plaintextByte = plaintext.charCodeAt(n) & 0xFF;
        const ciphertextByte = plaintextByte ^ keystreamByte;
        result += String.fromCharCode(ciphertextByte);
      }
      
      return result;
    },
    
    // Decrypt block (same as encrypt for stream cipher)
    decryptBlock: function(id, ciphertext) {
      // For stream ciphers, decryption is identical to encryption
      return HC128.encryptBlock(id, ciphertext);
    },
    
    // HC-128 Instance class
    HC128Instance: function(key, iv) {
      this.P = new Array(HC128.TABLE_SIZE);     // P table (512 32-bit words)
      this.Q = new Array(HC128.TABLE_SIZE);     // Q table (512 32-bit words)
      this.counter = 0;                         // Step counter
      this.keyBytes = [];                       // Store key as byte array
      this.ivBytes = [];                        // Store IV as byte array
      this.keystreamBuffer = [];                // Buffer for generated keystream
      this.keystreamPosition = 0;               // Current position in keystream buffer
      
      // Convert key to byte array
      if (typeof key === 'string') {
        for (let k = 0; k < key.length && this.keyBytes.length < 16; k++) {
          this.keyBytes.push(key.charCodeAt(k) & 0xFF);
        }
      } else if (Array.isArray(key)) {
        for (let k = 0; k < key.length && this.keyBytes.length < 16; k++) {
          this.keyBytes.push(key[k] & 0xFF);
        }
      } else {
        throw new Error('HC-128 key must be string or byte array');
      }
      
      // Pad key to required length (16 bytes = 128 bits)
      while (this.keyBytes.length < 16) {
        this.keyBytes.push(0);
      }
      
      // Process IV (default to zero IV if not provided)
      if (iv) {
        if (typeof iv === 'string') {
          for (let n = 0; n < iv.length && this.ivBytes.length < 16; n++) {
            this.ivBytes.push(iv.charCodeAt(n) & 0xFF);
          }
        } else if (Array.isArray(iv)) {
          for (let n = 0; n < iv.length && this.ivBytes.length < 16; n++) {
            this.ivBytes.push(iv[n] & 0xFF);
          }
        }
      }
      
      // Pad IV to required length (16 bytes = 128 bits)
      while (this.ivBytes.length < 16) {
        this.ivBytes.push(0);
      }
      
      // Initialize the cipher
      this.initialize();
    }
  };
  
  // Add methods to HC128Instance prototype
  HC128.HC128Instance.prototype = {
    
    /**
     * Initialize HC-128 cipher state
     */
    initialize: function() {
      // Convert key and IV to 32-bit words
      const K = [];
      const IV = [];
      
      for (let i = 0; i < 4; i++) {
        K[i] = global.OpCodes.Pack32LE(
          this.keyBytes[i * 4],
          this.keyBytes[i * 4 + 1],
          this.keyBytes[i * 4 + 2],
          this.keyBytes[i * 4 + 3]
        );
        
        IV[i] = global.OpCodes.Pack32LE(
          this.ivBytes[i * 4],
          this.ivBytes[i * 4 + 1],
          this.ivBytes[i * 4 + 2],
          this.ivBytes[i * 4 + 3]
        );
      }
      
      // Initialize arrays with expanded key and IV
      const W = new Array(1280); // Temporary array for initialization
      
      // Load key and IV into W
      for (let i = 0; i < 4; i++) {
        W[i] = K[i];
        W[i + 4] = IV[i];
      }
      
      // Expand key and IV to fill W
      for (let i = 8; i < 16; i++) {
        W[i] = K[i - 8];
      }
      
      // Key expansion using linear recurrence
      for (let i = 16; i < 1280; i++) {
        W[i] = (W[i - 16] ^ W[i - 13] ^ W[i - 6] ^ W[i - 3] ^ 
                0x6ed9eba1 ^ (i - 16)) >>> 0;
        W[i] = global.OpCodes.RotL32(W[i], 7);
      }
      
      // Initialize P and Q tables
      for (let i = 0; i < HC128.TABLE_SIZE; i++) {
        this.P[i] = W[i + 256];
        this.Q[i] = W[i + 768];
      }
      
      // Run initialization algorithm
      for (let i = 0; i < HC128.INIT_STEPS; i++) {
        this.generateWord();
      }
      
      // Reset counter for keystream generation
      this.counter = 0;
    },
    
    /**
     * f1 function (based on g1 in HC-128 specification)
     * @param {number} x - Input value
     * @returns {number} Transformed value
     */
    f1: function(x) {
      return global.OpCodes.RotR32(x, 7) ^ global.OpCodes.RotR32(x, 18) ^ (x >>> 3);
    },
    
    /**
     * f2 function (based on g2 in HC-128 specification)
     * @param {number} x - Input value
     * @returns {number} Transformed value
     */
    f2: function(x) {
      return global.OpCodes.RotR32(x, 17) ^ global.OpCodes.RotR32(x, 19) ^ (x >>> 10);
    },
    
    /**
     * h1 function for P table updates
     * @param {number} x - Input value
     * @returns {number} Transformed value
     */
    h1: function(x) {
      const a = x & 0xFF;
      const b = (x >>> 8) & 0xFF;
      return this.Q[a] + this.Q[256 + b];
    },
    
    /**
     * h2 function for Q table updates
     * @param {number} x - Input value
     * @returns {number} Transformed value
     */
    h2: function(x) {
      const a = x & 0xFF;
      const b = (x >>> 8) & 0xFF;
      return this.P[a] + this.P[256 + b];
    },
    
    /**
     * Generate one 32-bit keystream word
     * @returns {number} 32-bit keystream word
     */
    generateWord: function() {
      const i = this.counter % 1024;
      const j = i % HC128.TABLE_SIZE;
      let s;
      
      if (i < HC128.TABLE_SIZE) {
        // Update P table
        this.P[j] = (this.P[j] + this.f2(this.P[(j - 2) & 0x1FF]) + 
                     this.P[(j - 511) & 0x1FF]) >>> 0;
        s = (this.h1(this.P[(j - 12) & 0x1FF]) ^ this.P[j]) >>> 0;
      } else {
        // Update Q table
        this.Q[j] = (this.Q[j] + this.f1(this.Q[(j - 2) & 0x1FF]) + 
                     this.Q[(j - 511) & 0x1FF]) >>> 0;
        s = (this.h2(this.Q[(j - 12) & 0x1FF]) ^ this.Q[j]) >>> 0;
      }
      
      this.counter = (this.counter + 1) % 1024;
      return s;
    },
    
    /**
     * Generate a block of keystream (16 bytes)
     * @returns {Array} 16 bytes of keystream
     */
    generateBlock: function() {
      const keystream = [];
      
      // Generate 4 32-bit words (16 bytes total)
      for (let i = 0; i < 4; i++) {
        const word = this.generateWord();
        const bytes = global.OpCodes.Unpack32LE(word);
        keystream.push(bytes[0], bytes[1], bytes[2], bytes[3]);
      }
      
      return keystream;
    },
    
    /**
     * Get the next keystream byte
     * @returns {number} Next keystream byte (0-255)
     */
    getNextKeystreamByte: function() {
      // Check if we need to generate a new block
      if (this.keystreamPosition >= this.keystreamBuffer.length) {
        this.keystreamBuffer = this.generateBlock();
        this.keystreamPosition = 0;
      }
      
      return this.keystreamBuffer[this.keystreamPosition++];
    },
    
    /**
     * Generate multiple keystream bytes
     * @param {number} length - Number of bytes to generate
     * @returns {Array} Array of keystream bytes
     */
    generateKeystream: function(length) {
      const keystream = [];
      for (let n = 0; n < length; n++) {
        keystream.push(this.getNextKeystreamByte());
      }
      return keystream;
    },
    
    /**
     * Reset the cipher to initial state with optional new IV
     * @param {Array|string} newIV - Optional new IV
     */
    reset: function(newIV) {
      if (newIV !== undefined) {
        this.ivBytes = [];
        if (typeof newIV === 'string') {
          for (let n = 0; n < newIV.length && this.ivBytes.length < 16; n++) {
            this.ivBytes.push(newIV.charCodeAt(n) & 0xFF);
          }
        } else if (Array.isArray(newIV)) {
          for (let n = 0; n < newIV.length && this.ivBytes.length < 16; n++) {
            this.ivBytes.push(newIV[n] & 0xFF);
          }
        }
        // Pad IV to required length
        while (this.ivBytes.length < 16) {
          this.ivBytes.push(0);
        }
      }
      
      this.keystreamBuffer = [];
      this.keystreamPosition = 0;
      this.counter = 0;
      this.initialize();
    },
    
    /**
     * Set a new IV and reinitialize
     * @param {Array|string} newIV - New IV value
     */
    setIV: function(newIV) {
      this.reset(newIV);
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(HC128);
  }
  
  // Export to global scope
  global.HC128 = HC128;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HC128;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);