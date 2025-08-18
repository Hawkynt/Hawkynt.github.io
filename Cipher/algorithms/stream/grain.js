#!/usr/bin/env node
/*
 * Universal Grain Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on eSTREAM Grain specification 
 * (c)2006-2025 Hawkynt
 * 
 * Grain is a stream cipher designed by Hell, Johansson, and Meier.
 * It combines an 80-bit LFSR with an 80-bit NLFSR:
 * - LFSR: 80 bits with primitive polynomial
 * - NLFSR: 80 bits with nonlinear feedback function
 * - Output: combines LFSR and NLFSR bits with nonlinear filter
 * 
 * Key size: 80 bits, IV size: 64 bits
 * Initialization: 160 clock cycles
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
      console.error('Grain cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create Grain cipher object
  const Grain = {
    // Public interface properties
    internalName: 'Grain',
    name: 'Grain Stream Cipher',
    comment: 'Grain eSTREAM Stream Cipher - Educational implementation with LFSR/NLFSR combination',
    minKeyLength: 10,   // Grain uses 80-bit keys (10 bytes)
    maxKeyLength: 10,
    stepKeyLength: 1,
    minBlockSize: 1,    // Stream cipher - processes byte by byte
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // Grain constants
    LFSR_SIZE: 80,
    NLFSR_SIZE: 80,
    KEY_SIZE: 80,          // 80-bit key
    IV_SIZE: 64,           // 64-bit IV
    INIT_ROUNDS: 160,      // Initialization rounds (2 * 80)
    
    // Initialize cipher
    Init: function() {
      Grain.isInitialized = true;
    },
    
    // Set up key and initialize Grain state
    KeySetup: function(key) {
      let id;
      do {
        id = 'Grain[' + global.generateUniqueID() + ']';
      } while (Grain.instances[id] || global.objectInstances[id]);
      
      Grain.instances[szID] = new Grain.GrainInstance(key);
      global.objectInstances[szID] = true;
      return szID;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Grain.instances[id]) {
        // Clear sensitive data
        const instance = Grain.instances[szID];
        if (instance.lfsr && global.OpCodes) {
          global.OpCodes.ClearArray(instance.lfsr);
        }
        if (instance.nlfsr && global.OpCodes) {
          global.OpCodes.ClearArray(instance.nlfsr);
        }
        if (instance.keyBytes && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyBytes);
        }
        delete Grain.instances[szID];
        delete global.objectInstances[szID];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Grain', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (for stream cipher, this generates keystream and XORs with input)
    encryptBlock: function(id, szPlainText) {
      if (!Grain.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Grain', 'encryptBlock');
        return szPlainText;
      }
      
      const instance = Grain.instances[szID];
      let result = '';
      
      for (let n = 0; n < szPlainText.length; n++) {
        const keystreamByte = instance.generateKeystreamByte();
        const plaintextByte = szPlainText.charCodeAt(n) & 0xFF;
        const ciphertextByte = plaintextByte ^ keystreamByte;
        szResult += String.fromCharCode(ciphertextByte);
      }
      
      return szResult;
    },
    
    // Decrypt block (same as encrypt for stream cipher)
    decryptBlock: function(id, szCipherText) {
      // For stream ciphers, decryption is identical to encryption
      return Grain.encryptBlock(id, szCipherText);
    },
    
    // Grain Instance class
    GrainInstance: function(key, iv) {
      this.lfsr = new Array(Grain.LFSR_SIZE);   // 80-bit LFSR
      this.nlfsr = new Array(Grain.NLFSR_SIZE); // 80-bit NLFSR
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
        throw new Error('Grain key must be string or byte array');
      }
      
      // Pad key to required length (10 bytes = 80 bits)
      while (this.keyBytes.length < 10) {
        this.keyBytes.push(0);
      }
      
      // Process IV (default to zero IV if not provided)
      if (iv) {
        if (typeof iv === 'string') {
          for (let n = 0; n < iv.length && this.ivBytes.length < 8; n++) {
            this.ivBytes.push(iv.charCodeAt(n) & 0xFF);
          }
        } else if (Array.isArray(iv)) {
          for (let n = 0; n < iv.length && this.ivBytes.length < 8; n++) {
            this.ivBytes.push(iv[n] & 0xFF);
          }
        }
      }
      
      // Pad IV to required length (8 bytes = 64 bits)
      while (this.ivBytes.length < 8) {
        this.ivBytes.push(0);
      }
      
      // Initialize the cipher
      this.initialize();
    }
  };
  
  // Add methods to GrainInstance prototype
  Grain.GrainInstance.prototype = {
    
    /**
     * Initialize Grain cipher state
     */
    initialize: function() {
      // Load NLFSR with 80-bit key
      for (let i = 0; i < 80; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        this.nlfsr[i] = (this.keyBytes[byteIndex] >>> bitIndex) & 1;
      }
      
      // Load LFSR with 64-bit IV followed by 16 ones
      for (let i = 0; i < 64; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        this.lfsr[i] = (this.ivBytes[byteIndex] >>> bitIndex) & 1;
      }
      
      // Set remaining 16 bits of LFSR to 1
      for (let i = 64; i < 80; i++) {
        this.lfsr[i] = 1;
      }
      
      // Run initialization for 160 rounds
      for (let i = 0; i < Grain.INIT_ROUNDS; i++) {
        const output = this.clockCipher();
        // During initialization, feedback output to both registers
        this.lfsr[0] ^= output;
        this.nlfsr[0] ^= output;
      }
    },
    
    /**
     * LFSR feedback function
     * Primitive polynomial: x^80 + x^43 + x^42 + x^38 + x^33 + x^28 + x^21 + x^14 + x^9 + x^8 + x^6 + x^5 + 1
     * @returns {number} Feedback bit (0 or 1)
     */
    lfsrFeedback: function() {
      return this.lfsr[79] ^ this.lfsr[42] ^ this.lfsr[41] ^ this.lfsr[37] ^ 
             this.lfsr[32] ^ this.lfsr[27] ^ this.lfsr[20] ^ this.lfsr[13] ^ 
             this.lfsr[8] ^ this.lfsr[7] ^ this.lfsr[5] ^ this.lfsr[4];
    },
    
    /**
     * NLFSR feedback function
     * g(x) = x0 + x13 + x23 + x38 + x51 + x62 + x0x1 + x17x20 + x43x47 + x65x68 + x70x78
     * @returns {number} Feedback bit (0 or 1)
     */
    nlfsrFeedback: function() {
      const linear = this.nlfsr[79] ^ this.nlfsr[66] ^ this.nlfsr[56] ^ this.nlfsr[41] ^ 
                     this.nlfsr[28] ^ this.nlfsr[17];
      
      const nonlinear = (this.nlfsr[79] & this.nlfsr[78]) ^ 
                        (this.nlfsr[62] & this.nlfsr[59]) ^ 
                        (this.nlfsr[36] & this.nlfsr[32]) ^ 
                        (this.nlfsr[14] & this.nlfsr[11]) ^ 
                        (this.nlfsr[9] & this.nlfsr[1]);
      
      return linear ^ nonlinear;
    },
    
    /**
     * Output filter function
     * h(x) = x1 + x4 + x0x3 + x2x3 + x3x4 + x0x1x2 + x0x2x3 + x0x2x4 + x1x2x4 + x2x3x4
     * @param {Array} x - Array of 5 LFSR bits
     * @returns {number} Filter output (0 or 1)
     */
    outputFilter: function(x) {
      return x[1] ^ x[4] ^ (x[0] & x[3]) ^ (x[2] & x[3]) ^ (x[3] & x[4]) ^
             (x[0] & x[1] & x[2]) ^ (x[0] & x[2] & x[3]) ^ (x[0] & x[2] & x[4]) ^
             (x[1] & x[2] & x[4]) ^ (x[2] & x[3] & x[4]);
    },
    
    /**
     * Clock the Grain cipher one step
     * @returns {number} Output bit (0 or 1)
     */
    clockCipher: function() {
      // Get output bit before shifting
      const lfsrOut = this.lfsrFeedback();
      const nlfsrOut = this.nlfsrFeedback();
      
      // Get bits for output filter (specific positions from LFSR)
      const filterBits = [
        this.lfsr[2],   // x0
        this.lfsr[15],  // x1  
        this.lfsr[36],  // x2
        this.lfsr[45],  // x3
        this.lfsr[64]   // x4
      ];
      
      // Calculate output
      const output = this.outputFilter(filterBits) ^ 
                     this.lfsr[1] ^ this.lfsr[2] ^ this.lfsr[4] ^ this.lfsr[10] ^
                     this.lfsr[31] ^ this.lfsr[43] ^ this.lfsr[56] ^
                     this.nlfsr[9] ^ this.nlfsr[20] ^ this.nlfsr[29] ^ this.nlfsr[38] ^
                     this.nlfsr[47] ^ this.nlfsr[56] ^ this.nlfsr[59] ^ this.nlfsr[61] ^
                     this.nlfsr[65] ^ this.nlfsr[68] ^ this.nlfsr[70];
      
      // Shift LFSR
      for (let i = 79; i > 0; i--) {
        this.lfsr[i] = this.lfsr[i - 1];
      }
      this.lfsr[0] = lfsrOut;
      
      // Shift NLFSR  
      for (let i = 79; i > 0; i--) {
        this.nlfsr[i] = this.nlfsr[i - 1];
      }
      this.nlfsr[0] = nlfsrOut ^ this.lfsr[0]; // NLFSR input includes LFSR output
      
      return output;
    },
    
    /**
     * Generate one keystream bit
     * @returns {number} Keystream bit (0 or 1)
     */
    generateKeystreamBit: function() {
      return this.clockCipher();
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
          for (let n = 0; n < newIV.length && this.ivBytes.length < 8; n++) {
            this.ivBytes.push(newIV.charCodeAt(n) & 0xFF);
          }
        } else if (Array.isArray(newIV)) {
          for (let n = 0; n < newIV.length && this.ivBytes.length < 8; n++) {
            this.ivBytes.push(newIV[n] & 0xFF);
          }
        }
        // Pad IV to required length
        while (this.ivBytes.length < 8) {
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
    global.Cipher.AddCipher(Grain);
  }
  
  // Export to global scope
  global.Grain = Grain;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Grain;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);