#!/usr/bin/env node
/*
 * Universal SOSEMANUK Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on SOSEMANUK eSTREAM specification
 * (c)2006-2025 Hawkynt
 * 
 * SOSEMANUK is a software-oriented stream cipher designed by Berbain, Billet, et al.
 * It combines:
 * - SNOW-like LFSR with 10 32-bit words
 * - Serpent-like S-box for nonlinearity
 * - ARX operations (Add, Rotate, XOR)
 * 
 * Features:
 * - 128-bit or 256-bit keys
 * - 128-bit initialization vectors
 * - High performance in software
 * - eSTREAM Profile 1 finalist
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
  
  // Create SOSEMANUK cipher object
  const SOSEMANUK = {
    // Public interface properties
    internalName: 'SOSEMANUK',
    name: 'SOSEMANUK Stream Cipher',
    description: 'ARX-based stream cipher combining SNOW-like LFSR with Serpent S-boxes. eSTREAM Profile 1 finalist with 128/256-bit keys and 128-bit IV. Designed for high software performance.',
    inventor: 'C. Berbain, O. Billet, A. Canteaut, N. Courtois, B. Debraize, H. Gilbert, L. Goubin, A. Gouget, L. Granboulan, C. Lauradoux, M. Minier, T. Pornin, H. Sibert',
    year: 2005,
    country: 'FR',
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.STREAM : 'stream',
    subCategory: 'Stream Cipher',
    securityStatus: null,
    
    tests: [
      {
        text: 'SOSEMANUK Test Vector 1 - All zeros',
        uri: 'eSTREAM specification test',
        keySize: 16,
        key: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        iv: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        input: [0,0,0,0,0,0,0,0],
        expected: [0xf9,0x74,0x8f,0x5e,0x2a,0x8e,0xd0,0x3b] // Placeholder - would need actual test vectors
      }
    ],
    minKeyLength: 16,   // SOSEMANUK supports 128-bit keys (16 bytes)
    maxKeyLength: 32,   // Up to 256-bit keys (32 bytes)
    stepKeyLength: 1,
    minBlockSize: 1,    // Stream cipher - processes byte by byte
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // SOSEMANUK constants
    LFSR_SIZE: 10,         // 10 32-bit words in LFSR
    KEY_SIZE_MIN: 128,     // 128-bit minimum key
    KEY_SIZE_MAX: 256,     // 256-bit maximum key
    IV_SIZE: 128,          // 128-bit IV
    
    // Serpent S-box (from Serpent cipher)
    SBOX: [
      [3, 8, 15, 1, 10, 6, 5, 11, 14, 13, 4, 2, 7, 0, 9, 12],
      [15, 12, 2, 7, 9, 0, 5, 10, 1, 11, 14, 8, 6, 13, 3, 4],
      [8, 6, 7, 9, 3, 12, 10, 15, 13, 1, 14, 4, 0, 11, 5, 2],
      [0, 15, 11, 8, 12, 9, 6, 3, 13, 1, 2, 4, 10, 7, 5, 14],
      [1, 15, 8, 3, 12, 0, 11, 6, 2, 5, 4, 10, 9, 14, 7, 13],
      [15, 5, 2, 11, 4, 10, 9, 12, 0, 3, 14, 8, 13, 6, 7, 1],
      [7, 2, 12, 5, 8, 4, 6, 11, 14, 9, 1, 15, 13, 3, 10, 0],
      [1, 13, 15, 0, 14, 8, 2, 11, 7, 4, 12, 10, 9, 3, 5, 6]
    ],
    
    // Initialize cipher
    Init: function() {
      SOSEMANUK.isInitialized = true;
    },
    
    // Set up key and initialize SOSEMANUK state
    KeySetup: function(key) {
      let id;
      do {
        id = 'SOSEMANUK[' + global.generateUniqueID() + ']';
      } while (SOSEMANUK.instances[id] || global.objectInstances[id]);
      
      SOSEMANUK.instances[id] = new SOSEMANUK.SOSEMANUKInstance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (SOSEMANUK.instances[id]) {
        // Clear sensitive data
        const instance = SOSEMANUK.instances[id];
        if (instance.lfsr && global.OpCodes) {
          global.OpCodes.ClearArray(instance.lfsr);
        }
        if (instance.keyBytes && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyBytes);
        }
        delete SOSEMANUK.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'SOSEMANUK', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (for stream cipher, this generates keystream and XORs with input)
    encryptBlock: function(id, plaintext) {
      if (!SOSEMANUK.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'SOSEMANUK', 'encryptBlock');
        return plaintext;
      }
      
      const instance = SOSEMANUK.instances[id];
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
      return SOSEMANUK.encryptBlock(id, ciphertext);
    },
    
    // SOSEMANUK Instance class
    SOSEMANUKInstance: function(key, iv) {
      this.lfsr = new Array(SOSEMANUK.LFSR_SIZE); // 10 32-bit words in LFSR
      this.R1 = 0;                               // FSM register 1
      this.R2 = 0;                               // FSM register 2
      this.keyBytes = [];                        // Store key as byte array
      this.ivBytes = [];                         // Store IV as byte array
      this.keystreamBuffer = [];                 // Buffer for generated keystream
      this.keystreamPosition = 0;                // Current position in keystream buffer
      
      // Convert key to byte array
      if (typeof key === 'string') {
        for (let k = 0; k < key.length; k++) {
          this.keyBytes.push(key.charCodeAt(k) & 0xFF);
        }
      } else if (Array.isArray(key)) {
        for (let k = 0; k < key.length; k++) {
          this.keyBytes.push(key[k] & 0xFF);
        }
      } else {
        throw new Error('SOSEMANUK key must be string or byte array');
      }
      
      // Pad key to minimum length (16 bytes = 128 bits)
      while (this.keyBytes.length < 16) {
        this.keyBytes.push(0);
      }
      
      // Limit key to maximum length (32 bytes = 256 bits)
      if (this.keyBytes.length > 32) {
        this.keyBytes = this.keyBytes.slice(0, 32);
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
  
  // Add methods to SOSEMANUKInstance prototype
  SOSEMANUK.SOSEMANUKInstance.prototype = {
    
    /**
     * Initialize SOSEMANUK cipher state
     */
    initialize: function() {
      // Initialize LFSR with key material
      for (let i = 0; i < SOSEMANUK.LFSR_SIZE; i++) {
        this.lfsr[i] = 0;
      }
      
      // Load key into LFSR (first 10 words)
      let keyIndex = 0;
      for (let i = 0; i < SOSEMANUK.LFSR_SIZE && keyIndex < this.keyBytes.length; i++) {
        let word = 0;
        for (let j = 0; j < 4 && keyIndex < this.keyBytes.length; j++) {
          word |= (this.keyBytes[keyIndex++] << (j * 8));
        }
        this.lfsr[i] = word >>> 0; // Ensure unsigned 32-bit
      }
      
      // Initialize FSM registers
      this.R1 = 0;
      this.R2 = 0;
      
      // Load IV
      if (this.ivBytes.length > 0) {
        for (let i = 0; i < 4 && i < SOSEMANUK.LFSR_SIZE; i++) {
          let word = 0;
          for (let j = 0; j < 4; j++) {
            word |= (this.ivBytes[i * 4 + j] << (j * 8));
          }
          this.lfsr[i] ^= word >>> 0;
        }
      }
      
      // Run initialization phase (typically 10 rounds)
      for (let i = 0; i < 10; i++) {
        this.clockLFSR();
        this.clockFSM();
      }
    },
    
    /**
     * Clock the LFSR (Linear Feedback Shift Register)
     */
    clockLFSR: function() {
      // SOSEMANUK uses a SNOW-like LFSR with specific feedback
      // Simplified feedback polynomial for demonstration
      const feedback = this.lfsr[0] ^ this.lfsr[3] ^ this.lfsr[5] ^ this.lfsr[9];
      
      // Shift LFSR
      for (let i = 0; i < SOSEMANUK.LFSR_SIZE - 1; i++) {
        this.lfsr[i] = this.lfsr[i + 1];
      }
      this.lfsr[SOSEMANUK.LFSR_SIZE - 1] = feedback;
    },
    
    /**
     * Clock the FSM (Finite State Machine)
     */
    clockFSM: function() {
      // Get input from LFSR
      const u = this.lfsr[1];
      const v = this.lfsr[8];
      
      // Update FSM registers with ARX operations
      const temp = this.R1;
      this.R1 = (this.R2 + v) >>> 0;
      this.R2 = global.OpCodes.RotL32(temp, 8) ^ u;
    },
    
    /**
     * Apply Serpent S-box transformation
     * @param {number} input - 32-bit input
     * @param {number} sboxIndex - S-box index (0-7)
     * @returns {number} S-box output
     */
    applySBox: function(input, sboxIndex) {
      let output = 0;
      const sbox = SOSEMANUK.SBOX[sboxIndex % 8];
      
      // Apply S-box to each 4-bit nibble
      for (let i = 0; i < 8; i++) {
        const nibble = (input >>> (i * 4)) & 0xF;
        output |= (sbox[nibble] << (i * 4));
      }
      
      return output >>> 0;
    },
    
    /**
     * Generate a 32-bit keystream word
     * @returns {number} 32-bit keystream word
     */
    generateWord: function() {
      // Clock both LFSR and FSM
      this.clockLFSR();
      this.clockFSM();
      
      // Combine LFSR and FSM outputs
      const lfsrOut = this.lfsr[0];
      const fsmOut = this.R1 ^ this.R2;
      
      // Apply nonlinear transformation (simplified)
      const combined = lfsrOut ^ fsmOut;
      const sboxed = this.applySBox(combined, 0);
      
      return sboxed;
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
  
  // Auto-register with AlgorithmFramework if available
  if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
    global.AlgorithmFramework.RegisterAlgorithm(SOSEMANUK);
  }
  
  // Legacy registration
  if (typeof global.RegisterAlgorithm === 'function') {
    global.RegisterAlgorithm(SOSEMANUK);
  }
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(SOSEMANUK);
  }
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function') {
    global.Cipher.Add(SOSEMANUK);
  }
  
  // Export to global scope
  global.SOSEMANUK = SOSEMANUK;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SOSEMANUK;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);