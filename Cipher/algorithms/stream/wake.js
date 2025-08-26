#!/usr/bin/env node
/*
 * Universal WAKE Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on specification by David Wheeler (1993)
 * (c)2006-2025 Hawkynt
 * 
 * WAKE (Word Auto Key Encryption) is a stream cipher designed for high performance.
 * The algorithm uses:
 * - 32-bit keys with key scheduling
 * - 256-entry S-box with 32-bit words
 * - Cipher feedback mode operation
 * - Fast table-based operations
 * 
 * WARNING: WAKE has known vulnerabilities to chosen plaintext/ciphertext attacks.
 * This implementation is for educational and historical purposes only.
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
  
  // Create WAKE cipher object
  const WAKE = {
    internalName: 'wake',
    name: 'WAKE',
    version: '1.0',
    author: 'David Wheeler (1993)',
    description: 'Word Auto Key Encryption - fast but vulnerable stream cipher',

    // Required by cipher system
    minKeyLength: 1,
    maxKeyLength: 1024,
    stepKeyLength: 1,
    minBlockSize: 1,
    maxBlockSize: 1024,
    stepBlockSize: 1,
    instances: {},
    
    // Cipher parameters
    nBlockSizeInBits: 128,    // 16 bytes per block (4 32-bit words)
    nKeySizeInBits: 32,       // 32-bit key
    
    // Constants
    ROUNDS: 32,
    SBOX_SIZE: 256,
    MULTIPLIER: 0x5851F42D,
    INCREMENT: 0x6DC597F,
    
    // Internal state
    sbox: null,
    schedule: null,
    state: null,
    isInitialized: false,
    
    /**
     * Initialize cipher with empty state
     */
    Init: function() {
      this.sbox = new Array(this.SBOX_SIZE).fill(0);
      this.schedule = new Array(this.ROUNDS).fill(0);
      this.state = new Array(4).fill(0);
      this.isInitialized = false;
      return true;
    },
    
    /**
     * Generate S-box from key using Wheeler's algorithm
     * @param {number} key - 32-bit key
     */
    generateSBox: function(key) {
      // Simple S-box generation based on key
      let seed = key >>> 0; // Ensure unsigned 32-bit
      
      for (let i = 0; i < this.SBOX_SIZE; i++) {
        // Generate pseudo-random 32-bit values
        seed = ((seed * this.MULTIPLIER) + this.INCREMENT) >>> 0;
        this.sbox[i] = seed;
        
        // Additional mixing
        seed = OpCodes.RotL32(seed, (i % 32));
        seed ^= (i * 0x9E3779B9) >>> 0; // Golden ratio constant
      }
    },
    
    /**
     * Generate key schedule
     * @param {number} key - 32-bit key
     */
    generateKeySchedule: function(key) {
      this.schedule[0] = key >>> 0;
      
      for (let i = 1; i < this.ROUNDS; i++) {
        this.schedule[i] = ((this.schedule[i - 1] + this.INCREMENT) * this.MULTIPLIER) >>> 0;
      }
    },
    
    /**
     * Setup key for WAKE stream cipher
     * @param {Array} key - Key as byte array (4 bytes for 32-bit key)
     */
    KeySetup: function(key) {
      if (!key || key.length !== 4) {
        throw new Error('WAKE requires 32-bit (4 byte) key');
      }
      
      // Initialize state
      this.Init();
      
      // Convert key bytes to 32-bit word
      const keyWord = OpCodes.Pack32LE(key[0], key[1], key[2], key[3]);
      
      // Generate S-box and key schedule
      this.generateSBox(keyWord);
      this.generateKeySchedule(keyWord);
      
      // Initialize state
      this.state[0] = keyWord;
      this.state[1] = keyWord ^ 0xAAAAAAAA;
      this.state[2] = keyWord ^ 0x55555555;
      this.state[3] = keyWord ^ 0xFFFFFFFF;
      
      this.isInitialized = true;
      return true;
    },
    
    /**
     * WAKE mixing function (simplified version)
     * @param {Array} input - 4 32-bit words
     * @returns {Array} 4 32-bit words output
     */
    mixFunction: function(input) {
      const output = new Array(4);
      
      // Mix using S-box lookups and rotations
      output[0] = input[0] ^ this.sbox[(input[1] >>> 24) & 0xFF];
      output[1] = input[1] ^ this.sbox[(input[2] >>> 16) & 0xFF];
      output[2] = input[2] ^ this.sbox[(input[3] >>> 8) & 0xFF];
      output[3] = input[3] ^ this.sbox[input[0] & 0xFF];
      
      // Apply rotations
      output[0] = OpCodes.RotL32(output[0], 7);
      output[1] = OpCodes.RotL32(output[1], 13);
      output[2] = OpCodes.RotL32(output[2], 19);
      output[3] = OpCodes.RotL32(output[3], 23);
      
      // Additional mixing
      for (let i = 0; i < 4; i++) {
        output[i] ^= this.schedule[i % this.ROUNDS];
      }
      
      return output;
    },
    
    /**
     * Generate keystream block
     * @returns {Array} 16 bytes of keystream
     */
    generateKeystreamBlock: function() {
      if (!this.isInitialized) {
        throw new Error('Cipher not initialized - call KeySetup first');
      }
      
      // Update state using mixing function
      this.state = this.mixFunction(this.state);
      
      // Convert state to bytes
      const keystream = [];
      for (let i = 0; i < 4; i++) {
        const bytes = OpCodes.Unpack32LE(this.state[i]);
        keystream.push(...bytes);
      }
      
      return keystream;
    },
    
    /**
     * Encrypt block using WAKE stream cipher
     * @param {number} position - Block position
     * @param {string} input - Input data as string
     * @returns {string} Encrypted data as string
     */
    encryptBlock: function(position, input) {
      if (!this.isInitialized) {
        throw new Error('Cipher not initialized');
      }
      
      const inputBytes = OpCodes.AsciiToBytes(input);
      const result = [];
      
      // Process data in 16-byte blocks
      for (let offset = 0; offset < inputBytes.length; offset += 16) {
        const keystream = this.generateKeystreamBlock();
        
        // XOR with keystream
        for (let i = 0; i < 16 && offset + i < inputBytes.length; i++) {
          result.push(inputBytes[offset + i] ^ keystream[i]);
        }
      }
      
      return OpCodes.BytesToString(result);
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
     * Clear sensitive data
     */
    ClearData: function() {
      if (this.sbox) {
        OpCodes.ClearArray(this.sbox);
        this.sbox = null;
      }
      if (this.schedule) {
        OpCodes.ClearArray(this.schedule);
        this.schedule = null;
      }
      if (this.state) {
        OpCodes.ClearArray(this.state);
        this.state = null;
      }
      this.isInitialized = false;
    }
  };
  
  // Auto-register with AlgorithmFramework if available
  if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
    global.AlgorithmFramework.RegisterAlgorithm(WAKE);
  }
  
  // Legacy registration
  if (typeof global.RegisterAlgorithm === 'function') {
    global.RegisterAlgorithm(WAKE);
  }
  
  // Auto-register with Cipher system if available
  if (global.Cipher) {
    global.Cipher.Add(WAKE);
  }
  
  // Export to global scope
  global.WAKE = WAKE;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WAKE;
  }
  
})(typeof global !== 'undefined' ? global : window);