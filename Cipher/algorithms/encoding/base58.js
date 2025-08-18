#!/usr/bin/env node
/*
 * Universal Base58 Encoder/Decoder
 * Based on Bitcoin's Base58 specification (draft-msporny-base58-03)
 * Compatible with both Browser and Node.js environments
 * 
 * Base58 is a binary-to-text encoding scheme created by Satoshi Nakamoto
 * for Bitcoin addresses. It uses a 58-character alphabet that excludes
 * visually similar characters (0, O, I, l) to reduce transcription errors.
 * 
 * Reference: https://datatracker.ietf.org/doc/html/draft-msporny-base58-03
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
  
  const Base58 = {
    internalName: 'base58',
    name: 'Base58 (Bitcoin)',
    version: '1.0.0',
    comment: 'Base58 encoding as used in Bitcoin addresses',
    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
    // Bitcoin Base58 alphabet (excludes 0, O, I, l to avoid visual confusion)
    alphabet: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
    
    /**
     * Initialize the cipher (no initialization needed for Base58)
     */
    Init: function() {
      // No initialization required
    },
    
    /**
     * Set up encoding/decoding parameters (Base58 has no key)
     * @param {any} key - Not used for Base58
     */
    KeySetup: function(key) {
      // Base58 encoding doesn't use keys
    },
    
    /**
     * Encode binary data to Base58 string
     * @param {number} mode - Encoding mode (0 = encode)
     * @param {string|Array} data - Input data to encode
     * @returns {string} Base58 encoded string
     */
    encryptBlock: function(mode, data) {
      if (mode !== 0) {
        throw new Error('Base58: Invalid mode for encoding');
      }
      
      // Convert input to byte array
      let bytes;
      if (typeof data === 'string') {
        bytes = OpCodes.StringToBytes(data);
      } else if (Array.isArray(data)) {
        bytes = data.slice();
      } else {
        throw new Error('Base58: Invalid input data type');
      }
      
      if (bytes.length === 0) {
        return '';
      }
      
      // Count leading zero bytes (they become '1' characters in Base58)
      let leadingZeros = 0;
      for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
        leadingZeros++;
      }
      
      // Convert to big integer using base-256 arithmetic
      let num = BigInt(0);
      for (let i = 0; i < bytes.length; i++) {
        num = num * BigInt(256) + BigInt(bytes[i]);
      }
      
      // Convert to Base58 using repeated division
      let result = '';
      while (num > 0) {
        const remainder = num % BigInt(58);
        result = this.alphabet[Number(remainder)] + result;
        num = num / BigInt(58);
      }
      
      // Add leading '1's for leading zero bytes
      return '1'.repeat(leadingZeros) + result;
    },
    
    /**
     * Decode Base58 string to binary data
     * @param {number} mode - Decoding mode (0 = decode)
     * @param {string} data - Base58 string to decode
     * @returns {Array} Decoded byte array
     */
    decryptBlock: function(mode, data) {
      if (mode !== 0) {
        throw new Error('Base58: Invalid mode for decoding');
      }
      
      if (typeof data !== 'string' || data.length === 0) {
        return [];
      }
      
      // Count leading '1' characters (they represent zero bytes)
      let leadingOnes = 0;
      for (let i = 0; i < data.length && data[i] === '1'; i++) {
        leadingOnes++;
      }
      
      // Convert from Base58 to big integer
      let num = BigInt(0);
      for (let i = 0; i < data.length; i++) {
        const char = data[i];
        const value = this.alphabet.indexOf(char);
        if (value === -1) {
          throw new Error('Base58: Invalid character in input: ' + char);
        }
        num = num * BigInt(58) + BigInt(value);
      }
      
      // Convert big integer to byte array
      const bytes = [];
      while (num > 0) {
        bytes.unshift(Number(num % BigInt(256)));
        num = num / BigInt(256);
      }
      
      // Add leading zero bytes for leading '1' characters
      return new Array(leadingOnes).fill(0).concat(bytes);
    },
    
    /**
     * Clear sensitive data (no sensitive data in Base58)
     */
    ClearData: function() {
      // No sensitive data to clear
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
        blockSize: 'Variable',
        keySize: 'None',
        description: 'Base58 encoding as used in Bitcoin addresses'
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(Base58);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Base58;
  }
  
  // Make available globally
  global.Base58 = Base58;
  
})(typeof global !== 'undefined' ? global : window);