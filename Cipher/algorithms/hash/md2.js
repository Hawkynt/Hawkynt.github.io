#!/usr/bin/env node
/*
 * Universal MD2 Hash Function
 * Compatible with both Browser and Node.js environments
 * Based on RFC 1319 specification
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of the MD2 message-digest algorithm.
 * Produces 128-bit (16-byte) hash values from input data.
 * 
 * WARNING: MD2 is cryptographically broken and should not be used for security purposes.
 * This implementation is for educational purposes only.
 */

(function(global) {
  'use strict';
  
  // Load OpCodes for cryptographic operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes.js:', e.message);
      return;
    }
  }
  
  // Ensure environment dependencies are available
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
      console.error('MD2 requires Cipher system to be loaded first');
      return;
    }
  }
  
  // MD2 S-box (RFC 1319 Appendix A)
  const S = [
    0x29, 0x2E, 0x43, 0xC9, 0xA2, 0xD8, 0x7C, 0x01, 0x3D, 0x36, 0x54, 0xA1, 0xEC, 0xF0, 0x06, 0x13,
    0x62, 0xA7, 0x05, 0xF3, 0xC0, 0xC7, 0x73, 0x8C, 0x98, 0x93, 0x2B, 0xD9, 0xBC, 0x4C, 0x82, 0xCA,
    0x1E, 0x9B, 0x57, 0x3C, 0xFD, 0xD4, 0xE0, 0x16, 0x67, 0x42, 0x6F, 0x18, 0x8A, 0x17, 0xE5, 0x12,
    0xBE, 0x4E, 0xC4, 0xD6, 0xDA, 0x9E, 0xDE, 0x49, 0xA0, 0xFB, 0xF5, 0x8E, 0xBB, 0x2F, 0xEE, 0x7A,
    0xA9, 0x68, 0x79, 0x91, 0x15, 0xB2, 0x07, 0x3F, 0x94, 0xC2, 0x10, 0x89, 0x0B, 0x22, 0x5F, 0x21,
    0x80, 0x7F, 0x5D, 0x9A, 0x5A, 0x90, 0x32, 0x27, 0x35, 0x3E, 0xCC, 0xE7, 0xBF, 0xF7, 0x97, 0x03,
    0xFF, 0x19, 0x30, 0xB3, 0x48, 0xA5, 0xB5, 0xD1, 0xD7, 0x5E, 0x92, 0x2A, 0xAC, 0x56, 0xAA, 0xC6,
    0x4F, 0xB8, 0x38, 0xD2, 0x96, 0xA4, 0x7D, 0xB6, 0x76, 0xFC, 0x6B, 0xE2, 0x9C, 0x74, 0x04, 0xF1,
    0x45, 0x9D, 0x70, 0x59, 0x64, 0x71, 0x87, 0x20, 0x86, 0x5B, 0xCF, 0x65, 0xE6, 0x2D, 0xA8, 0x02,
    0x1B, 0x60, 0x25, 0xAD, 0xAE, 0xB0, 0xB9, 0xF6, 0x1C, 0x46, 0x61, 0x69, 0x34, 0x40, 0x7E, 0x0F,
    0x55, 0x47, 0xA3, 0x23, 0xDD, 0x51, 0xAF, 0x3A, 0xC3, 0x5C, 0xF9, 0xCE, 0xBA, 0xC5, 0xEA, 0x26,
    0x2C, 0x53, 0x0D, 0x6E, 0x85, 0x28, 0x84, 0x09, 0xD3, 0xDF, 0xCD, 0xF4, 0x41, 0x81, 0x4D, 0x52,
    0x6A, 0xDC, 0x37, 0xC8, 0x6C, 0xC1, 0xAB, 0xFA, 0x24, 0xE1, 0x7B, 0x08, 0x0C, 0xBD, 0xB1, 0x4A,
    0x78, 0x88, 0x95, 0x8B, 0xE3, 0x63, 0xE8, 0x6D, 0xE9, 0xCB, 0xD5, 0xFE, 0x3B, 0x00, 0x1D, 0x39,
    0xF2, 0xEF, 0xB7, 0x0E, 0x66, 0x58, 0xD0, 0xE4, 0xA6, 0x77, 0x72, 0xF8, 0xEB, 0x75, 0x4B, 0x0A,
    0x31, 0x44, 0x50, 0xB4, 0x8F, 0xED, 0x1F, 0x1A, 0xDB, 0x99, 0x8D, 0x33, 0x9F, 0x11, 0x83, 0x14
  ];
  
  // Create MD2 hash object
  const MD2 = {
    // Public interface properties
    internalName: 'MD2',
    name: 'MD2',
    comment: 'MD2 Message-Digest Algorithm (RFC 1319) - Educational Implementation',
    
    // Cipher interface properties (required for registration)
    minKeyLength: 0,    // Hash functions don't use keys
    maxKeyLength: 0,    // Hash functions don't use keys
    stepKeyLength: 1,   // Not applicable for hash functions
    minBlockSize: 1,    // Can hash any amount of data
    maxBlockSize: 0,    // No maximum block size (0 = unlimited)
    stepBlockSize: 1,   // Can process byte by byte
    instances: {},      // Instance tracking
    
    // Hash state variables
    _X: null,       // 48-byte checksum and buffer
    _C: null,       // 16-byte checksum
    _length: 0,
    _bufferLength: 0,
    
    /**
     * Initialize the hash state
     * RFC 1319 Section 3.2
     */
    Init: function() {
      // Initialize with zeros
      this._X = new Array(48);
      this._C = new Array(16);
      this._length = 0;
      this._bufferLength = 0;
      
      // Clear arrays
      OpCodes.ClearArray(this._X);
      OpCodes.ClearArray(this._C);
    },
    
    /**
     * Process a single 128-bit (16-byte) message block
     * RFC 1319 Section 3.2
     * @param {Array} block - 16-byte message block
     */
    _processBlock: function(block) {
      // Step 1: Copy block into X
      for (let i = 0; i < 16; i++) {
        this._X[16 + i] = block[i];
        this._X[32 + i] = this._X[16 + i] ^ this._X[i];
      }
      
      // Step 2: Do 18 rounds
      let t = 0;
      for (let j = 0; j < 18; j++) {
        for (let k = 0; k < 48; k++) {
          t = this._X[k] = (this._X[k] ^ S[t]) & 0xFF;
        }
        t = (t + j) & 0xFF;
      }
      
      // Step 3: Update checksum
      let L = this._C[15];
      for (let i = 0; i < 16; i++) {
        this._C[i] = (this._C[i] ^ S[block[i] ^ L]) & 0xFF;
        L = this._C[i];
      }
    },
    
    /**
     * Update hash with new data
     * @param {string|Array} data - Input data to hash
     */
    Update: function(data) {
      // Convert input to byte array
      const bytes = (typeof data === 'string') ? OpCodes.StringToBytes(data) : data;
      
      for (let i = 0; i < bytes.length; i++) {
        // Buffer the bytes until we have a complete 16-byte block
        if (this._bufferLength === 0) {
          this._buffer = new Array(16);
        }
        
        this._buffer[this._bufferLength++] = bytes[i] & 0xFF;
        this._length++;
        
        // Process complete 16-byte blocks
        if (this._bufferLength === 16) {
          this._processBlock(this._buffer);
          this._bufferLength = 0;
        }
      }
    },
    
    /**
     * Finalize hash computation and return digest
     * @returns {string} Hexadecimal hash digest
     */
    Final: function() {
      // Step 1: Pad the message
      const padLength = 16 - this._bufferLength;
      const padding = new Array(padLength);
      for (let i = 0; i < padLength; i++) {
        padding[i] = padLength;
      }
      
      // Initialize buffer if needed
      if (this._bufferLength === 0) {
        this._buffer = new Array(16);
        OpCodes.ClearArray(this._buffer);
      }
      
      // Add padding to current buffer
      for (let i = 0; i < padLength; i++) {
        this._buffer[this._bufferLength + i] = padding[i];
      }
      
      // Process padded block
      this._processBlock(this._buffer);
      
      // Step 2: Append checksum
      this._processBlock(this._C);
      
      // Step 3: Return first 16 bytes of X as digest
      let result = '';
      for (let i = 0; i < 16; i++) {
        result += OpCodes.ByteToHex(this._X[i]);
      }
      
      return result.toLowerCase();
    },
    
    /**
     * Hash a complete message in one operation
     * @param {string|Array} message - Message to hash
     * @returns {string} Hexadecimal hash digest
     */
    Hash: function(message) {
      this.Init();
      this.Update(message);
      return this.Final();
    },
    
    /**
     * Required cipher interface methods (MD2 is a hash, not encryption)
     */
    KeySetup: function(key) {
      // Hashes don't use keys - this is for HMAC compatibility
      return true;
    },
    
    encryptBlock: function(blockType, plaintext) {
      return this.Hash(plaintext);
    },
    
    decryptBlock: function(blockType, ciphertext) {
      // Hash functions are one-way
      throw new Error('MD2 is a one-way hash function - decryption not possible');
    },
    
    ClearData: function() {
      if (this._X) OpCodes.ClearArray(this._X);
      if (this._C) OpCodes.ClearArray(this._C);
      if (this._buffer) OpCodes.ClearArray(this._buffer);
      this._length = 0;
      this._bufferLength = 0;
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(MD2);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MD2;
  }
  
  // Export to global scope
  global.MD2 = MD2;
  
})(typeof global !== 'undefined' ? global : window);