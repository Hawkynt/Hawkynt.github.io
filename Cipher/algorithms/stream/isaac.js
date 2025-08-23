#!/usr/bin/env node
/*
 * Universal ISAAC Stream Cipher / PRNG
 * Compatible with both Browser and Node.js environments
 * Based on ISAAC (Indirection, Shift, Accumulate, Add, Count) by Bob Jenkins
 * (c)2006-2025 Hawkynt
 * 
 * ISAAC is a cryptographically secure pseudorandom number generator and stream cipher.
 * It maintains 8KB of state and is designed to be:
 * - Fast (generates 32-bit random values efficiently)
 * - Cryptographically secure
 * - Unbiased and uniformly distributed
 * 
 * State consists of:
 * - Memory array: 256 32-bit words (1KB)
 * - Accumulator: aa (32-bit)
 * - Last result: bb (32-bit)  
 * - Counter: cc (32-bit)
 * - Results array: 256 32-bit words (1KB)
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
  }
  
  // Create ISAAC cipher object
  const ISAAC = {
    // Public interface properties
    internalName: 'ISAAC',
    name: 'ISAAC Stream Cipher',
    comment: 'ISAAC (Jenkins) Stream Cipher - Table-based PRNG with 8KB state',
    minKeyLength: 0,    // ISAAC supports variable key length
    maxKeyLength: 1024, // Up to 1KB of key material
    stepKeyLength: 1,
    minBlockSize: 1,    // Stream cipher - processes byte by byte
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // ISAAC constants
    MEMORY_SIZE: 256,      // 256 32-bit words in memory array
    RESULTS_SIZE: 256,     // 256 32-bit words in results array
    GOLDEN_RATIO: 0x9e3779b9, // Golden ratio in hex
    
    // Initialize cipher
    Init: function() {
      ISAAC.isInitialized = true;
    },
    
    // Set up key and initialize ISAAC state
    KeySetup: function(key) {
      let id;
      do {
        id = 'ISAAC[' + global.generateUniqueID() + ']';
      } while (ISAAC.instances[id] || global.objectInstances[id]);
      
      ISAAC.instances[id] = new ISAAC.ISAACInstance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (ISAAC.instances[id]) {
        // Clear sensitive data
        const instance = ISAAC.instances[id];
        if (instance.mem && global.OpCodes) {
          global.OpCodes.ClearArray(instance.mem);
        }
        if (instance.rsl && global.OpCodes) {
          global.OpCodes.ClearArray(instance.rsl);
        }
        if (instance.keyBytes && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyBytes);
        }
        delete ISAAC.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'ISAAC', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (for stream cipher, this generates keystream and XORs with input)
    encryptBlock: function(id, plaintext) {
      if (!ISAAC.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'ISAAC', 'encryptBlock');
        return plaintext;
      }
      
      const instance = ISAAC.instances[id];
      let result = '';
      
      for (let n = 0; n < plaintext.length; n++) {
        const keystreamByte = instance.getNextByte();
        const plaintextByte = plaintext.charCodeAt(n) & 0xFF;
        const ciphertextByte = plaintextByte ^ keystreamByte;
        result += String.fromCharCode(ciphertextByte);
      }
      
      return result;
    },
    
    // Decrypt block (same as encrypt for stream cipher)
    decryptBlock: function(id, ciphertext) {
      // For stream ciphers, decryption is identical to encryption
      return ISAAC.encryptBlock(id, ciphertext);
    },
    
    // ISAAC Instance class
    ISAACInstance: function(key) {
      this.mem = new Array(ISAAC.MEMORY_SIZE);     // Memory array (256 32-bit words)
      this.rsl = new Array(ISAAC.RESULTS_SIZE);    // Results array (256 32-bit words)
      this.aa = 0;                                 // Accumulator
      this.bb = 0;                                 // Last result
      this.cc = 0;                                 // Counter
      this.keyBytes = [];                          // Store key as byte array
      this.resultIndex = ISAAC.RESULTS_SIZE;       // Force initial generation
      
      // Convert key to byte array
      if (typeof key === 'string') {
        for (let k = 0; k < key.length; k++) {
          this.keyBytes.push(key.charCodeAt(k) & 0xFF);
        }
      } else if (Array.isArray(key)) {
        for (let k = 0; k < key.length; k++) {
          this.keyBytes.push(key[k] & 0xFF);
        }
      } else if (key) {
        throw new Error('ISAAC key must be string or byte array');
      }
      
      // Initialize the cipher
      this.initialize();
    }
  };
  
  // Add methods to ISAACInstance prototype
  ISAAC.ISAACInstance.prototype = {
    
    /**
     * Initialize ISAAC cipher state
     */
    initialize: function() {
      // Initialize memory and results arrays to zero
      for (let i = 0; i < ISAAC.MEMORY_SIZE; i++) {
        this.mem[i] = 0;
        this.rsl[i] = 0;
      }
      
      // Load key into results array if provided
      if (this.keyBytes.length > 0) {
        let keyIndex = 0;
        for (let i = 0; i < ISAAC.RESULTS_SIZE && keyIndex < this.keyBytes.length; i++) {
          let word = 0;
          for (let j = 0; j < 4 && keyIndex < this.keyBytes.length; j++) {
            word |= (this.keyBytes[keyIndex++] << (j * 8));
          }
          this.rsl[i] = word >>> 0; // Ensure unsigned 32-bit
        }
      }
      
      // Perform initial mixing
      this.randinit();
    },
    
    /**
     * Initialize the ISAAC state using the key
     */
    randinit: function() {
      // Initialize mixing variables with golden ratio
      let a = ISAAC.GOLDEN_RATIO;
      let b = ISAAC.GOLDEN_RATIO;
      let c = ISAAC.GOLDEN_RATIO;
      let d = ISAAC.GOLDEN_RATIO;
      let e = ISAAC.GOLDEN_RATIO;
      let f = ISAAC.GOLDEN_RATIO;
      let g = ISAAC.GOLDEN_RATIO;
      let h = ISAAC.GOLDEN_RATIO;
      
      // Mix the golden ratio 4 times
      for (let i = 0; i < 4; i++) {
        [a, b, c, d, e, f, g, h] = this.mix(a, b, c, d, e, f, g, h);
      }
      
      // Fill memory array with mixed values
      for (let i = 0; i < ISAAC.MEMORY_SIZE; i += 8) {
        // Add results to mixing variables if available
        a = (a + this.rsl[i]) >>> 0;
        b = (b + this.rsl[i + 1]) >>> 0;
        c = (c + this.rsl[i + 2]) >>> 0;
        d = (d + this.rsl[i + 3]) >>> 0;
        e = (e + this.rsl[i + 4]) >>> 0;
        f = (f + this.rsl[i + 5]) >>> 0;
        g = (g + this.rsl[i + 6]) >>> 0;
        h = (h + this.rsl[i + 7]) >>> 0;
        
        [a, b, c, d, e, f, g, h] = this.mix(a, b, c, d, e, f, g, h);
        
        // Store mixed values in memory
        this.mem[i] = a;
        this.mem[i + 1] = b;
        this.mem[i + 2] = c;
        this.mem[i + 3] = d;
        this.mem[i + 4] = e;
        this.mem[i + 5] = f;
        this.mem[i + 6] = g;
        this.mem[i + 7] = h;
      }
      
      // Do a second pass if we have key material
      if (this.keyBytes.length > 0) {
        for (let i = 0; i < ISAAC.MEMORY_SIZE; i += 8) {
          a = (a + this.mem[i]) >>> 0;
          b = (b + this.mem[i + 1]) >>> 0;
          c = (c + this.mem[i + 2]) >>> 0;
          d = (d + this.mem[i + 3]) >>> 0;
          e = (e + this.mem[i + 4]) >>> 0;
          f = (f + this.mem[i + 5]) >>> 0;
          g = (g + this.mem[i + 6]) >>> 0;
          h = (h + this.mem[i + 7]) >>> 0;
          
          [a, b, c, d, e, f, g, h] = this.mix(a, b, c, d, e, f, g, h);
          
          this.mem[i] = a;
          this.mem[i + 1] = b;
          this.mem[i + 2] = c;
          this.mem[i + 3] = d;
          this.mem[i + 4] = e;
          this.mem[i + 5] = f;
          this.mem[i + 6] = g;
          this.mem[i + 7] = h;
        }
      }
      
      // Initialize counters
      this.aa = 0;
      this.bb = 0;
      this.cc = 0;
      
      // Generate first set of results
      this.isaac();
      this.resultIndex = 0;
    },
    
    /**
     * Mixing function for ISAAC initialization
     * @param {number} a-h - Eight 32-bit mixing variables
     * @returns {Array} Mixed values [a, b, c, d, e, f, g, h]
     */
    mix: function(a, b, c, d, e, f, g, h) {
      a ^= b << 11; d = (d + a) >>> 0; b = (b + c) >>> 0;
      b ^= c >>> 2; e = (e + b) >>> 0; c = (c + d) >>> 0;
      c ^= d << 8; f = (f + c) >>> 0; d = (d + e) >>> 0;
      d ^= e >>> 16; g = (g + d) >>> 0; e = (e + f) >>> 0;
      e ^= f << 10; h = (h + e) >>> 0; f = (f + g) >>> 0;
      f ^= g >>> 4; a = (a + f) >>> 0; g = (g + h) >>> 0;
      g ^= h << 8; b = (b + g) >>> 0; h = (h + a) >>> 0;
      h ^= a >>> 9; c = (c + h) >>> 0; a = (a + b) >>> 0;
      
      return [a >>> 0, b >>> 0, c >>> 0, d >>> 0, e >>> 0, f >>> 0, g >>> 0, h >>> 0];
    },
    
    /**
     * Generate 256 32-bit random results
     */
    isaac: function() {
      this.cc = (this.cc + 1) >>> 0;    // Increment counter
      this.bb = (this.bb + this.cc) >>> 0; // Add counter to bb
      
      for (let i = 0; i < ISAAC.MEMORY_SIZE; i++) {
        let x = this.mem[i];
        
        // Calculate aa based on position
        switch (i % 4) {
          case 0: this.aa ^= this.aa << 13; break;
          case 1: this.aa ^= this.aa >>> 6; break;
          case 2: this.aa ^= this.aa << 2; break;
          case 3: this.aa ^= this.aa >>> 16; break;
        }
        
        this.aa = (this.mem[(i + 128) % ISAAC.MEMORY_SIZE] + this.aa) >>> 0;
        
        let y = (this.mem[(x >>> 2) % ISAAC.MEMORY_SIZE] + this.aa + this.bb) >>> 0;
        this.mem[i] = y;
        
        this.bb = (this.mem[(y >>> 10) % ISAAC.MEMORY_SIZE] + x) >>> 0;
        this.rsl[i] = this.bb;
      }
    },
    
    /**
     * Get next 32-bit random value
     * @returns {number} 32-bit random value
     */
    getNext32: function() {
      if (this.resultIndex >= ISAAC.RESULTS_SIZE) {
        this.isaac();
        this.resultIndex = 0;
      }
      
      return this.rsl[this.resultIndex++];
    },
    
    /**
     * Get next random byte
     * @returns {number} Random byte (0-255)
     */
    getNextByte: function() {
      if (!this.currentWord || this.byteIndex >= 4) {
        this.currentWord = this.getNext32();
        this.byteIndex = 0;
      }
      
      const byte = (this.currentWord >>> (this.byteIndex * 8)) & 0xFF;
      this.byteIndex++;
      return byte;
    },
    
    /**
     * Generate multiple keystream bytes
     * @param {number} length - Number of bytes to generate
     * @returns {Array} Array of keystream bytes
     */
    generateKeystream: function(length) {
      const keystream = [];
      for (let n = 0; n < length; n++) {
        keystream.push(this.getNextByte());
      }
      return keystream;
    },
    
    /**
     * Reset the cipher to initial state
     */
    reset: function() {
      this.resultIndex = ISAAC.RESULTS_SIZE; // Force regeneration
      this.byteIndex = 4; // Force new word generation
      this.currentWord = 0;
      this.initialize();
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(ISAAC);
  }
  
  // Export to global scope
  global.ISAAC = ISAAC;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ISAAC;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);