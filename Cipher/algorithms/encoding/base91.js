#!/usr/bin/env node
/*
 * Universal Base91 Encoder/Decoder
 * Based on basE91 algorithm by Joachim Henke (2000-2006)
 * Compatible with both Browser and Node.js environments
 * 
 * Base91 is an advanced binary-to-text encoding that achieves
 * only 23% overhead (vs 33% for Base64) by encoding 13-bit
 * packets using a 91-character alphabet.
 * 
 * Reference: http://base91.sourceforge.net/
 * Copyright (c) 2000-2006 Joachim Henke
 * Algorithm ported under BSD license terms
 * 
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
  
  if (!global.Cipher && typeof require !== 'undefined') {
    try {
      require('../../universal-cipher-env.js');
      require('../../cipher.js');
    } catch (e) {
      console.error('Failed to load cipher dependencies:', e.message);
      return;
    }
  }
  
  const Base91 = {
    internalName: 'base91',
    name: 'Base91 (basE91)',
    version: '1.0.0',
        comment: 'Educational implementation for learning purposes',
    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,

    
    // Base91 alphabet: 91 printable ASCII characters excluding: - \ '
    alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~',
    
    // Decode table for efficient lookup
    decodeTable: null,
    
    /**
     * Initialize the cipher and build decode table
     */
    Init: function() {
      // Build decode table for fast character lookup
      this.decodeTable = new Array(256).fill(-1);
      for (let i = 0; i < this.alphabet.length; i++) {
        this.decodeTable[this.alphabet.charCodeAt(i)] = i;
      }
    },
    
    /**
     * Set up encoding parameters (Base91 has no key)
     * @param {any} key - Not used for Base91
     */
    KeySetup: function(key) {
      // Base91 encoding doesn't use keys
      this.Init(); // Ensure decode table is built
    },
    
    /**
     * Encode binary data to Base91 string
     * @param {number} mode - Encoding mode (0 = encode)
     * @param {string|Array} data - Input data to encode
     * @returns {string} Base91 encoded string
     */
    encryptBlock: function(mode, data) {
      if (mode !== 0) {
        throw new Error('Base91: Invalid mode for encoding');
      }
      
      // Convert input to byte array
      let bytes;
      if (typeof data === 'string') {
        bytes = OpCodes.StringToBytes(data);
      } else if (Array.isArray(data)) {
        bytes = data.slice();
      } else {
        throw new Error('Base91: Invalid input data type');
      }
      
      if (bytes.length === 0) {
        return '';
      }
      
      // Base91 encoding state
      let accumulator = 0;  // Bit accumulator
      let bitsInAccumulator = 0;  // Number of bits in accumulator
      let result = '';
      
      for (let i = 0; i < bytes.length; i++) {
        // Add 8 bits to accumulator
        accumulator |= (bytes[i] << bitsInAccumulator);
        bitsInAccumulator += 8;
        
        // Extract 13-bit values when possible
        if (bitsInAccumulator > 13) {
          // Extract 13 bits
          const value = accumulator & 8191; // 0x1FFF = 8191 = 2^13 - 1
          accumulator >>>= 13;
          bitsInAccumulator -= 13;
          
          // Encode 13-bit value as 2 characters
          result += this.alphabet[value % 91];
          result += this.alphabet[Math.floor(value / 91)];
        }
      }
      
      // Handle remaining bits
      if (bitsInAccumulator > 0) {
        result += this.alphabet[accumulator % 91];
        if (bitsInAccumulator > 6 || accumulator > 90) {
          result += this.alphabet[Math.floor(accumulator / 91)];
        }
      }
      
      return result;
    },
    
    /**
     * Decode Base91 string to binary data
     * @param {number} mode - Decoding mode (0 = decode)
     * @param {string} data - Base91 string to decode
     * @returns {Array} Decoded byte array
     */
    decryptBlock: function(mode, data) {
      if (mode !== 0) {
        throw new Error('Base91: Invalid mode for decoding');
      }
      
      if (typeof data !== 'string' || data.length === 0) {
        return [];
      }
      
      // Ensure decode table is initialized
      if (!this.decodeTable) {
        this.Init();
      }
      
      // Base91 decoding state
      let accumulator = 0;  // Bit accumulator
      let bitsInAccumulator = 0;  // Number of bits in accumulator
      let value = -1;  // Current 13-bit value being constructed
      const bytes = [];
      
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        const digit = this.decodeTable[char];
        
        if (digit === -1) {
          throw new Error('Base91: Invalid character in input: ' + data[i]);
        }
        
        if (value === -1) {
          // Start new 13-bit value
          value = digit;
        } else {
          // Complete 13-bit value
          value += digit * 91;
          
          // Add to accumulator
          accumulator |= ((value & 8191) << bitsInAccumulator);
          bitsInAccumulator += (value > 8191) ? 13 : 14;
          value = -1;
          
          // Extract complete bytes
          while (bitsInAccumulator > 7) {
            bytes.push(accumulator & 0xFF);
            accumulator >>>= 8;
            bitsInAccumulator -= 8;
          }
        }
      }
      
      // Handle final incomplete value
      if (value !== -1) {
        accumulator |= (value << bitsInAccumulator);
        bitsInAccumulator += 6;
        
        // Extract final bytes
        while (bitsInAccumulator > 7) {
          bytes.push(accumulator & 0xFF);
          accumulator >>>= 8;
          bitsInAccumulator -= 8;
        }
      }
      
      return bytes;
    },
    
    /**
     * Clear sensitive data
     */
    ClearData: function() {
      // Clear decode table
      if (this.decodeTable) {
        this.decodeTable.fill(-1);
      }
    },
    
    /**
     * Get cipher information
     * @returns {Object} Cipher information
     */
    GetInfo: function() {
      return {
        name: this.name,
        version: this.version,
        type: 'Encoding',
        blockSize: 'Variable (13-bit packets)',
        keySize: 'None',
        description: 'Base91 encoding with 23% overhead (vs 33% for Base64)',
        efficiency: '14-23% overhead (variable)',
        inventor: 'Joachim Henke (2000-2006)'
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(Base91);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Base91;
  }
  
  // Make available globally
  global.Base91 = Base91;
  
})(typeof global !== 'undefined' ? global : window);