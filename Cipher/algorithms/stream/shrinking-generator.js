#!/usr/bin/env node
/*
 * Universal Shrinking Generator Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on the Shrinking Generator design by Coppersmith, Krawczyk, and Mansour
 * (c)2006-2025 Hawkynt
 * 
 * The Shrinking Generator is a stream cipher using two Linear Feedback Shift
 * Registers (LFSRs) where one controls the selection of bits from the other.
 * The algorithm uses:
 * - LFSR A (selection sequence): controls when to output bits
 * - LFSR S (data sequence): provides the actual output bits
 * - Selection rule: output S bit only when A bit = 1
 * - Variable output rate depending on A sequence
 * 
 * This design provides good cryptographic properties through irregular decimation.
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
  
  // Create Shrinking Generator cipher object
  const ShrinkingGenerator = {
    internalName: 'shrinking-generator',
    name: 'Shrinking Generator',
    version: '1.0',
    author: 'Coppersmith, Krawczyk, Mansour (1993)',
    description: 'LFSR-based stream cipher with irregular decimation',

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
    
    // LFSR parameters (use coprime lengths for good period)
    LFSR_A_LENGTH: 17,       // Selection LFSR length
    LFSR_S_LENGTH: 19,       // Data LFSR length
    
    // Internal state
    lfsrA: null,             // Selection LFSR (A sequence)
    lfsrS: null,             // Data LFSR (S sequence)
    outputBuffer: [],        // Buffer for generated bits
    isInitialized: false,
    
    /**
     * Initialize cipher with empty state
     */
    Init: function() {
      this.lfsrA = new Array(this.LFSR_A_LENGTH).fill(0);
      this.lfsrS = new Array(this.LFSR_S_LENGTH).fill(0);
      this.outputBuffer = [];
      this.isInitialized = false;
      return true;
    },
    
    /**
     * Setup key for Shrinking Generator
     * @param {Array} key - 128-bit key as byte array (16 bytes)
     */
    KeySetup: function(key) {
      if (!key || key.length !== 16) {
        throw new Error('Shrinking Generator requires 128-bit (16 byte) key');
      }
      
      // Initialize state
      this.Init();
      
      // Distribute key bits across the two LFSRs
      let bitIndex = 0;
      
      // Initialize LFSR A (selection)
      for (let i = 0; i < this.LFSR_A_LENGTH && bitIndex < 128; i++) {
        const byteIndex = Math.floor(bitIndex / 8);
        const bitPos = bitIndex % 8;
        this.lfsrA[i] = (key[byteIndex] >>> bitPos) & 1;
        bitIndex++;
      }
      
      // Initialize LFSR S (data)
      for (let i = 0; i < this.LFSR_S_LENGTH && bitIndex < 128; i++) {
        const byteIndex = Math.floor(bitIndex / 8);
        const bitPos = bitIndex % 8;
        this.lfsrS[i] = (key[byteIndex] >>> bitPos) & 1;
        bitIndex++;
      }
      
      // Use remaining key bits to modify existing LFSR states
      while (bitIndex < 128) {
        const byteIndex = Math.floor(bitIndex / 8);
        const bitPos = bitIndex % 8;
        const keyBit = (key[byteIndex] >>> bitPos) & 1;
        
        // XOR with existing LFSR states alternately
        if ((bitIndex % 2) === 0) {
          this.lfsrA[bitIndex % this.LFSR_A_LENGTH] ^= keyBit;
        } else {
          this.lfsrS[bitIndex % this.LFSR_S_LENGTH] ^= keyBit;
        }
        bitIndex++;
      }
      
      // Ensure no LFSR is all zeros (would create bad periods)
      if (this.lfsrA.every(bit => bit === 0)) {
        this.lfsrA[0] = 1;
      }
      if (this.lfsrS.every(bit => bit === 0)) {
        this.lfsrS[0] = 1;
      }
      
      this.isInitialized = true;
      return true;
    },
    
    /**
     * Update LFSR A (selection) - polynomial: x^17 + x^3 + 1
     * @returns {number} Output bit for selection
     */
    updateLFSRA: function() {
      const output = this.lfsrA[0];
      const feedback = this.lfsrA[0] ^ this.lfsrA[3];
      
      // Shift register
      for (let i = 0; i < this.LFSR_A_LENGTH - 1; i++) {
        this.lfsrA[i] = this.lfsrA[i + 1];
      }
      this.lfsrA[this.LFSR_A_LENGTH - 1] = feedback;
      
      return output;
    },
    
    /**
     * Update LFSR S (data) - polynomial: x^19 + x^5 + x^2 + x + 1
     * @returns {number} Output bit for data
     */
    updateLFSRS: function() {
      const output = this.lfsrS[0];
      const feedback = this.lfsrS[0] ^ this.lfsrS[1] ^ this.lfsrS[2] ^ this.lfsrS[5];
      
      // Shift register
      for (let i = 0; i < this.LFSR_S_LENGTH - 1; i++) {
        this.lfsrS[i] = this.lfsrS[i + 1];
      }
      this.lfsrS[this.LFSR_S_LENGTH - 1] = feedback;
      
      return output;
    },
    
    /**
     * Generate a single output bit using shrinking rule
     * @returns {number} Output bit (0 or 1)
     */
    generateBit: function() {
      if (!this.isInitialized) {
        throw new Error('Cipher not initialized - call KeySetup first');
      }
      
      // Keep generating until we get a valid output
      while (true) {
        // Update both LFSRs
        const aBit = this.updateLFSRA();
        const sBit = this.updateLFSRS();
        
        // Shrinking rule: output S bit only when A bit = 1
        if (aBit === 1) {
          return sBit;
        }
        // If A bit = 0, discard this S bit and continue
      }
    },
    
    /**
     * Generate multiple bits and buffer them
     * @param {number} count - Number of bits to generate
     */
    generateBitsToBuffer: function(count) {
      for (let i = 0; i < count; i++) {
        this.outputBuffer.push(this.generateBit());
      }
    },
    
    /**
     * Get a bit from buffer, generating more if needed
     * @returns {number} Output bit (0 or 1)
     */
    getBufferedBit: function() {
      if (this.outputBuffer.length === 0) {
        this.generateBitsToBuffer(32); // Generate a batch for efficiency
      }
      return this.outputBuffer.shift();
    },
    
    /**
     * Generate a byte (8 bits)
     * @returns {number} Byte value (0-255)
     */
    generateByte: function() {
      let byte = 0;
      
      for (let bit = 0; bit < 8; bit++) {
        const bitValue = this.getBufferedBit();
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
     * Encrypt block using Shrinking Generator
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
     * @returns {Object} Current states of both LFSRs
     */
    getStates: function() {
      return {
        lfsrA: this.lfsrA ? this.lfsrA.slice() : null,
        lfsrS: this.lfsrS ? this.lfsrS.slice() : null,
        bufferSize: this.outputBuffer.length
      };
    },
    
    /**
     * Get statistics about decimation behavior
     * @param {number} samples - Number of samples to analyze
     * @returns {Object} Decimation statistics
     */
    getDecimationStats: function(samples = 1000) {
      const stats = {
        totalSteps: 0,
        outputBits: 0,
        decimationRatio: 0
      };
      
      if (!this.isInitialized) {
        return stats;
      }
      
      // Save current state
      const savedLfsrA = this.lfsrA.slice();
      const savedLfsrS = this.lfsrS.slice();
      
      // Analyze decimation
      for (let i = 0; i < samples; i++) {
        const aBit = this.updateLFSRA();
        const sBit = this.updateLFSRS();
        stats.totalSteps++;
        
        if (aBit === 1) {
          stats.outputBits++;
        }
      }
      
      stats.decimationRatio = stats.outputBits / stats.totalSteps;
      
      // Restore state
      this.lfsrA = savedLfsrA;
      this.lfsrS = savedLfsrS;
      
      return stats;
    },
    
    /**
     * Clear sensitive data
     */
    ClearData: function() {
      if (this.lfsrA) {
        OpCodes.ClearArray(this.lfsrA);
        this.lfsrA = null;
      }
      if (this.lfsrS) {
        OpCodes.ClearArray(this.lfsrS);
        this.lfsrS = null;
      }
      if (this.outputBuffer) {
        OpCodes.ClearArray(this.outputBuffer);
        this.outputBuffer = [];
      }
      this.isInitialized = false;
    }
  };
  
  // Auto-register with Cipher system
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(ShrinkingGenerator);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShrinkingGenerator;
  }
  
  // Make available globally
  global.ShrinkingGenerator = ShrinkingGenerator;
  
})(typeof global !== 'undefined' ? global : window);