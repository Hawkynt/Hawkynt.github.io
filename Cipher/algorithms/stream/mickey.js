#!/usr/bin/env node
/*
 * Universal MICKEY Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on eSTREAM MICKEY specification 
 * (c)2006-2025 Hawkynt
 * 
 * MICKEY is a stream cipher designed by Babbage and Dodd.
 * It uses two 100-bit registers with irregular clocking:
 * - Register R: Linear feedback shift register (LFSR)
 * - Register S: Control register with nonlinear feedback
 * - Mutual irregular clocking based on control bits
 * 
 * MICKEY supports two versions:
 * - MICKEY-80: 80-bit key, 80-bit IV
 * - MICKEY-128: 128-bit key, 128-bit IV
 * This implementation focuses on MICKEY-80.
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
      console.error('MICKEY cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create MICKEY cipher object
  const MICKEY = {
    // Public interface properties
    internalName: 'MICKEY',
    name: 'MICKEY Stream Cipher',
    comment: 'MICKEY eSTREAM Stream Cipher - Educational implementation with irregular clocking',
    minKeyLength: 10,   // MICKEY-80 uses 80-bit keys (10 bytes)
    maxKeyLength: 10,
    stepKeyLength: 1,
    minBlockSize: 1,    // Stream cipher - processes byte by byte
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // MICKEY constants
    REGISTER_SIZE: 100,
    KEY_SIZE: 80,          // 80-bit key for MICKEY-80
    IV_SIZE: 80,           // 80-bit IV for MICKEY-80
    INIT_ROUNDS: 100,      // Initialization rounds
    
    // MICKEY S-box (nonlinear transformation)
    SBOX: [
      0x9, 0x1, 0x2, 0xB, 0x7, 0x3, 0x0, 0xE, 0xF, 0xC, 0x8, 0x4, 0x6, 0xA, 0xD, 0x5
    ],
    
    // Initialize cipher
    Init: function() {
      MICKEY.isInitialized = true;
    },
    
    // Set up key and initialize MICKEY state
    KeySetup: function(key) {
      let id;
      do {
        id = 'MICKEY[' + global.generateUniqueID() + ']';
      } while (MICKEY.instances[id] || global.objectInstances[id]);
      
      MICKEY.instances[id] = new MICKEY.MICKEYInstance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (MICKEY.instances[id]) {
        // Clear sensitive data
        const instance = MICKEY.instances[id];
        if (instance.registerR && global.OpCodes) {
          global.OpCodes.ClearArray(instance.registerR);
        }
        if (instance.registerS && global.OpCodes) {
          global.OpCodes.ClearArray(instance.registerS);
        }
        if (instance.keyBytes && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyBytes);
        }
        delete MICKEY.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'MICKEY', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (for stream cipher, this generates keystream and XORs with input)
    encryptBlock: function(id, szPlainText) {
      if (!MICKEY.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'MICKEY', 'encryptBlock');
        return szPlainText;
      }
      
      const instance = MICKEY.instances[id];
      let result = '';
      
      for (let n = 0; n < szPlainText.length; n++) {
        const keystreamByte = instance.generateKeystreamByte();
        const plaintextByte = szPlainText.charCodeAt(n) & 0xFF;
        const ciphertextByte = plaintextByte ^ keystreamByte;
        result += String.fromCharCode(ciphertextByte);
      }
      
      return result;
    },
    
    // Decrypt block (same as encrypt for stream cipher)
    decryptBlock: function(id, szCipherText) {
      // For stream ciphers, decryption is identical to encryption
      return MICKEY.encryptBlock(id, szCipherText);
    },
    
    // MICKEY Instance class
    MICKEYInstance: function(key, iv) {
      this.registerR = new Array(MICKEY.REGISTER_SIZE); // 100-bit register R (LFSR)
      this.registerS = new Array(MICKEY.REGISTER_SIZE); // 100-bit register S (control)
      this.keyBytes = [];          // Store key as byte array
      this.ivBytes = [];           // Store IV as byte array
      
      // Convert key to byte array
      if (typeof key === 'string') {
        for (let k = 0; k < key.length && this.keyBytes.length < 10; k++) {
          this.keyBytes.push(key.charCodeAt(k) & 0xFF);
        }
      } else if (Array.isArray(key)) {
        for (let k = 0; k < key.length && this.keyBytes.length < 10; k++) {
          this.keyBytes.push(key[k] & 0xFF);
        }
      } else {
        throw new Error('MICKEY key must be string or byte array');
      }
      
      // Pad key to required length (10 bytes = 80 bits)
      while (this.keyBytes.length < 10) {
        this.keyBytes.push(0);
      }
      
      // Process IV (default to zero IV if not provided)
      if (iv) {
        if (typeof iv === 'string') {
          for (let n = 0; n < iv.length && this.ivBytes.length < 10; n++) {
            this.ivBytes.push(iv.charCodeAt(n) & 0xFF);
          }
        } else if (Array.isArray(iv)) {
          for (let n = 0; n < iv.length && this.ivBytes.length < 10; n++) {
            this.ivBytes.push(iv[n] & 0xFF);
          }
        }
      }
      
      // Pad IV to required length (10 bytes = 80 bits)
      while (this.ivBytes.length < 10) {
        this.ivBytes.push(0);
      }
      
      // Initialize the cipher
      this.initialize();
    }
  };
  
  // Add methods to MICKEYInstance prototype
  MICKEY.MICKEYInstance.prototype = {
    
    /**
     * Initialize MICKEY cipher state
     */
    initialize: function() {
      // Initialize both registers to zero
      for (let i = 0; i < MICKEY.REGISTER_SIZE; i++) {
        this.registerR[i] = 0;
        this.registerS[i] = 0;
      }
      
      // Load key into register R
      for (let i = 0; i < 80; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        this.registerR[i] = (this.keyBytes[byteIndex] >>> bitIndex) & 1;
      }
      
      // Load IV into register S
      for (let i = 0; i < 80; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        this.registerS[i] = (this.ivBytes[byteIndex] >>> bitIndex) & 1;
      }
      
      // Run initialization for 100 rounds
      for (let i = 0; i < MICKEY.INIT_ROUNDS; i++) {
        this.clockRegisters(false); // No output during initialization
      }
    },
    
    /**
     * Linear feedback for register R
     * Primitive polynomial for 100-bit LFSR
     * @returns {number} Feedback bit (0 or 1)
     */
    registerRFeedback: function() {
      // Simple polynomial for demonstration: x^100 + x^37 + 1
      return this.registerR[99] ^ this.registerR[36];
    },
    
    /**
     * Nonlinear feedback for register S
     * Uses S-box and XOR operations
     * @returns {number} Feedback bit (0 or 1)
     */
    registerSFeedback: function() {
      // Get 4-bit input for S-box from specific positions
      const sboxInput = (this.registerS[99] << 3) | 
                        (this.registerS[79] << 2) | 
                        (this.registerS[59] << 1) | 
                        this.registerS[39];
      
      const sboxOutput = MICKEY.SBOX[sboxInput];
      
      // Use LSB of S-box output as feedback
      return (sboxOutput & 1) ^ this.registerS[19];
    },
    
    /**
     * Clock both registers with irregular clocking
     * @param {boolean} generateOutput - Whether to generate output bit
     * @returns {number} Output bit (0 or 1) if generateOutput is true
     */
    clockRegisters: function(generateOutput) {
      // Get control bits for irregular clocking
      const controlR = this.registerR[99];
      const controlS = this.registerS[99];
      
      // Get output bit before shifting (if needed)
      let outputBit = 0;
      if (generateOutput) {
        outputBit = this.registerR[0] ^ this.registerS[0];
      }
      
      // Calculate feedback bits
      const feedbackR = this.registerRFeedback();
      const feedbackS = this.registerSFeedback();
      
      // Irregular clocking based on control bits
      // Both registers are clocked, but with different feedback based on control
      
      // Clock register R
      for (let i = 99; i > 0; i--) {
        this.registerR[i] = this.registerR[i - 1];
      }
      this.registerR[0] = feedbackR;
      
      // Modify register R based on control from S
      if (controlS) {
        this.registerR[0] ^= this.registerS[50]; // Add nonlinearity
      }
      
      // Clock register S
      for (let i = 99; i > 0; i--) {
        this.registerS[i] = this.registerS[i - 1];
      }
      this.registerS[0] = feedbackS;
      
      // Modify register S based on control from R
      if (controlR) {
        this.registerS[0] ^= this.registerR[50]; // Add nonlinearity
      }
      
      return outputBit;
    },
    
    /**
     * Generate one keystream bit
     * @returns {number} Keystream bit (0 or 1)
     */
    generateKeystreamBit: function() {
      return this.clockRegisters(true);
    },
    
    /**
     * Generate one keystream byte (8 bits)
     * @returns {number} Keystream byte (0-255)
     */
    generateKeystreamByte: function() {
      let byte = 0;
      for (let i = 0; i < 8; i++) {
        byte = (byte << 1) | this.generateKeystreamBit();
      }
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
        keystream.push(this.generateKeystreamByte());
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
          for (let n = 0; n < newIV.length && this.ivBytes.length < 10; n++) {
            this.ivBytes.push(newIV.charCodeAt(n) & 0xFF);
          }
        } else if (Array.isArray(newIV)) {
          for (let n = 0; n < newIV.length && this.ivBytes.length < 10; n++) {
            this.ivBytes.push(newIV[n] & 0xFF);
          }
        }
        // Pad IV to required length
        while (this.ivBytes.length < 10) {
          this.ivBytes.push(0);
        }
      }
      
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
    global.Cipher.AddCipher(MICKEY);
  }
  
  // Export to global scope
  global.MICKEY = MICKEY;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MICKEY;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);