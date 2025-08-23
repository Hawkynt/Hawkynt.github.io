#!/usr/bin/env node
/*
 * Universal Geffe Generator Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on the classical Geffe generator design
 * (c)2006-2025 Hawkynt
 * 
 * The Geffe generator is a classical stream cipher using three Linear Feedback
 * Shift Registers (LFSRs) and a combining function. The algorithm uses:
 * - Three LFSRs of different lengths (typically coprime lengths)
 * - Boolean combining function: f(x1,x2,x3) = (x1 ∧ x2) ⊕ (¬x1 ∧ x3)
 * - Simple key setup distributing key bits across LFSRs
 * 
 * WARNING: The Geffe generator has known correlation weaknesses and is
 * vulnerable to correlation attacks. This implementation is for educational
 * purposes only and should not be used for actual security applications.
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
      console.error('Geffe generator requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create Geffe generator cipher object
  const Geffe = {
    internalName: 'geffe',
    name: 'Geffe Generator',
    version: '1.0',
    author: 'Classical Design',
    description: 'Three-LFSR combining generator with known vulnerabilities',

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
    nKeySizeInBits: 128,     // 128-bit key
    
    // LFSR parameters (use coprime lengths)
    LFSR1_LENGTH: 11,        // First LFSR length
    LFSR2_LENGTH: 13,        // Second LFSR length  
    LFSR3_LENGTH: 17,        // Third LFSR length
    
    // Internal state
    lfsr1: null,             // First LFSR state
    lfsr2: null,             // Second LFSR state
    lfsr3: null,             // Third LFSR state
    isInitialized: false,
    
    /**
     * Initialize cipher with empty state
     */
    Init: function() {
      this.lfsr1 = new Array(this.LFSR1_LENGTH).fill(0);
      this.lfsr2 = new Array(this.LFSR2_LENGTH).fill(0);
      this.lfsr3 = new Array(this.LFSR3_LENGTH).fill(0);
      this.isInitialized = false;
      return true;
    },
    
    /**
     * Setup key for Geffe generator
     * @param {Array} key - 128-bit key as byte array (16 bytes)
     */
    KeySetup: function(key) {
      if (!key || key.length !== 16) {
        throw new Error('Geffe generator requires 128-bit (16 byte) key');
      }
      
      // Initialize state
      this.Init();
      
      // Distribute key bits across the three LFSRs
      let bitIndex = 0;
      
      // Initialize LFSR1
      for (let i = 0; i < this.LFSR1_LENGTH && bitIndex < 128; i++) {
        const byteIndex = Math.floor(bitIndex / 8);
        const bitPos = bitIndex % 8;
        this.lfsr1[i] = (key[byteIndex] >>> bitPos) & 1;
        bitIndex++;
      }
      
      // Initialize LFSR2
      for (let i = 0; i < this.LFSR2_LENGTH && bitIndex < 128; i++) {
        const byteIndex = Math.floor(bitIndex / 8);
        const bitPos = bitIndex % 8;
        this.lfsr2[i] = (key[byteIndex] >>> bitPos) & 1;
        bitIndex++;
      }
      
      // Initialize LFSR3
      for (let i = 0; i < this.LFSR3_LENGTH && bitIndex < 128; i++) {
        const byteIndex = Math.floor(bitIndex / 8);
        const bitPos = bitIndex % 8;
        this.lfsr3[i] = (key[byteIndex] >>> bitPos) & 1;
        bitIndex++;
      }
      
      // Use remaining key bits to modify existing LFSR states
      while (bitIndex < 128) {
        const byteIndex = Math.floor(bitIndex / 8);
        const bitPos = bitIndex % 8;
        const keyBit = (key[byteIndex] >>> bitPos) & 1;
        
        // XOR with existing LFSR states in round-robin fashion
        const lfsrChoice = bitIndex % 3;
        if (lfsrChoice === 0) {
          this.lfsr1[bitIndex % this.LFSR1_LENGTH] ^= keyBit;
        } else if (lfsrChoice === 1) {
          this.lfsr2[bitIndex % this.LFSR2_LENGTH] ^= keyBit;
        } else {
          this.lfsr3[bitIndex % this.LFSR3_LENGTH] ^= keyBit;
        }
        bitIndex++;
      }
      
      // Ensure no LFSR is all zeros
      if (this.lfsr1.every(bit => bit === 0)) {
        this.lfsr1[0] = 1;
      }
      if (this.lfsr2.every(bit => bit === 0)) {
        this.lfsr2[0] = 1;
      }
      if (this.lfsr3.every(bit => bit === 0)) {
        this.lfsr3[0] = 1;
      }
      
      this.isInitialized = true;
      return true;
    },
    
    /**
     * Update LFSR1 (polynomial: x^11 + x^2 + 1)
     * @returns {number} Output bit
     */
    updateLFSR1: function() {
      const output = this.lfsr1[0];
      const feedback = this.lfsr1[0] ^ this.lfsr1[2];
      
      // Shift register
      for (let i = 0; i < this.LFSR1_LENGTH - 1; i++) {
        this.lfsr1[i] = this.lfsr1[i + 1];
      }
      this.lfsr1[this.LFSR1_LENGTH - 1] = feedback;
      
      return output;
    },
    
    /**
     * Update LFSR2 (polynomial: x^13 + x^4 + x^3 + x^1 + 1)
     * @returns {number} Output bit
     */
    updateLFSR2: function() {
      const output = this.lfsr2[0];
      const feedback = this.lfsr2[0] ^ this.lfsr2[1] ^ this.lfsr2[3] ^ this.lfsr2[4];
      
      // Shift register
      for (let i = 0; i < this.LFSR2_LENGTH - 1; i++) {
        this.lfsr2[i] = this.lfsr2[i + 1];
      }
      this.lfsr2[this.LFSR2_LENGTH - 1] = feedback;
      
      return output;
    },
    
    /**
     * Update LFSR3 (polynomial: x^17 + x^3 + 1)
     * @returns {number} Output bit
     */
    updateLFSR3: function() {
      const output = this.lfsr3[0];
      const feedback = this.lfsr3[0] ^ this.lfsr3[3];
      
      // Shift register
      for (let i = 0; i < this.LFSR3_LENGTH - 1; i++) {
        this.lfsr3[i] = this.lfsr3[i + 1];
      }
      this.lfsr3[this.LFSR3_LENGTH - 1] = feedback;
      
      return output;
    },
    
    /**
     * Geffe combining function: f(x1,x2,x3) = (x1 ∧ x2) ⊕ (¬x1 ∧ x3)
     * @param {number} x1 - First LFSR output
     * @param {number} x2 - Second LFSR output
     * @param {number} x3 - Third LFSR output
     * @returns {number} Combined output bit
     */
    combiningFunction: function(x1, x2, x3) {
      return (x1 & x2) ^ ((1 - x1) & x3);
    },
    
    /**
     * Generate a single output bit
     * @returns {number} Output bit (0 or 1)
     */
    generateBit: function() {
      if (!this.isInitialized) {
        throw new Error('Cipher not initialized - call KeySetup first');
      }
      
      // Update all three LFSRs and get their outputs
      const x1 = this.updateLFSR1();
      const x2 = this.updateLFSR2();
      const x3 = this.updateLFSR3();
      
      // Apply combining function
      return this.combiningFunction(x1, x2, x3);
    },
    
    /**
     * Generate a byte (8 bits)
     * @returns {number} Byte value (0-255)
     */
    generateByte: function() {
      let byte = 0;
      
      for (let bit = 0; bit < 8; bit++) {
        const bitValue = this.generateBit();
        byte |= (bitValue << bit);
      }
      
      return byte;
    },
    
    /**
     * Generate keystream bytes
     * @param {number} length - Number of bytes to generate
     * @returns {Array} Array of keystream bytes
     */
    generateKeystream: function(length) {
      const keystream = [];
      
      for (let i = 0; i < length; i++) {
        keystream.push(this.generateByte());
      }
      
      return keystream;
    },
    
    /**
     * Encrypt block using Geffe generator
     * @param {number} position - Block position (unused for stream cipher)
     * @param {string} input - Input data as string
     * @returns {string} Encrypted data as string
     */
    encryptBlock: function(position, input) {
      if (!this.isInitialized) {
        throw new Error('Cipher not initialized');
      }
      
      const inputBytes = OpCodes.AsciiToBytes(input);
      const keystream = this.generateKeystream(inputBytes.length);
      const outputBytes = OpCodes.XorArrays(inputBytes, keystream);
      
      return OpCodes.BytesToString(outputBytes);
    },
    
    /**
     * Decrypt block (same as encrypt for stream cipher)
     * @param {number} position - Block position
     * @param {string} input - Input data as string
     * @returns {string} Decrypted data as string
     */
    decryptBlock: function(position, input) {
      return this.encryptBlock(position, input);
    },
    
    /**
     * Get current LFSR states for debugging
     * @returns {Object} Current states of all LFSRs
     */
    getStates: function() {
      return {
        lfsr1: this.lfsr1 ? this.lfsr1.slice() : null,
        lfsr2: this.lfsr2 ? this.lfsr2.slice() : null,
        lfsr3: this.lfsr3 ? this.lfsr3.slice() : null
      };
    },
    
    /**
     * Clear sensitive data
     */
    ClearData: function() {
      if (this.lfsr1) {
        OpCodes.ClearArray(this.lfsr1);
        this.lfsr1 = null;
      }
      if (this.lfsr2) {
        OpCodes.ClearArray(this.lfsr2);
        this.lfsr2 = null;
      }
      if (this.lfsr3) {
        OpCodes.ClearArray(this.lfsr3);
        this.lfsr3 = null;
      }
      this.isInitialized = false;
    }
  };
  
  // Auto-register with Cipher system
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(Geffe);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Geffe;
  }
  
  // Make available globally
  global.Geffe = Geffe;
  
})(typeof global !== 'undefined' ? global : window);