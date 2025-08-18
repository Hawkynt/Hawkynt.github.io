#!/usr/bin/env node
/*
 * Universal MD4 Hash Function
 * Compatible with both Browser and Node.js environments
 * Based on RFC 1320 specification
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of the MD4 message-digest algorithm.
 * Produces 128-bit (16-byte) hash values from input data.
 * 
 * WARNING: MD4 is cryptographically broken and should not be used for security purposes.
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
      console.error('MD4 requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create MD4 hash object
  const MD4 = {
    // Public interface properties
    internalName: 'MD4',
    name: 'MD4',
    comment: 'MD4 Message-Digest Algorithm (RFC 1320) - Educational Implementation',
    
    // Cipher interface properties (required for registration)
    minKeyLength: 0,    // Hash functions don't use keys
    maxKeyLength: 0,    // Hash functions don't use keys
    stepKeyLength: 1,   // Not applicable for hash functions
    minBlockSize: 1,    // Can hash any amount of data
    maxBlockSize: 0,    // No maximum block size (0 = unlimited)
    stepBlockSize: 1,   // Can process byte by byte
    instances: {},      // Instance tracking
    
    // Hash state variables
    _h: null,
    _buffer: null,
    _length: 0,
    _bufferLength: 0,
    
    /**
     * Initialize the hash state with standard MD4 initial values
     * RFC 1320 Section 3.3
     */
    Init: function() {
      // Initial hash values (RFC 1320)
      this._h = [
        0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476
      ];
      
      this._buffer = new Array(64);
      this._length = 0;
      this._bufferLength = 0;
      
      // Clear buffer
      OpCodes.ClearArray(this._buffer);
    },
    
    /**
     * MD4 auxiliary functions - RFC 1320 Section 3.4
     */
    _F: function(x, y, z) {
      return (x & y) | (~x & z);
    },
    
    _G: function(x, y, z) {
      return (x & y) | (x & z) | (y & z);
    },
    
    _H: function(x, y, z) {
      return x ^ y ^ z;
    },
    
    /**
     * Process a single 512-bit (64-byte) message block
     * RFC 1320 Section 3.5
     * @param {Array} block - 64-byte message block
     */
    _processBlock: function(block) {
      // Copy block into 16 32-bit words (little-endian)
      const X = new Array(16);
      for (let i = 0; i < 16; i++) {
        X[i] = OpCodes.Pack32LE(block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]);
      }
      
      // Initialize working variables
      let A = this._h[0], B = this._h[1], C = this._h[2], D = this._h[3];
      
      // Round 1 (16 operations)
      const round1 = [
        [0, 3], [1, 7], [2, 11], [3, 19], [4, 3], [5, 7], [6, 11], [7, 19],
        [8, 3], [9, 7], [10, 11], [11, 19], [12, 3], [13, 7], [14, 11], [15, 19]
      ];
      
      for (let i = 0; i < 16; i++) {
        const [k, s] = round1[i];
        const temp = (A + this._F(B, C, D) + X[k]) >>> 0;
        A = D; D = C; C = B;
        B = OpCodes.RotL32(temp, s);
      }
      
      // Round 2 (16 operations)
      const round2 = [
        [0, 3], [4, 5], [8, 9], [12, 13], [1, 3], [5, 5], [9, 9], [13, 13],
        [2, 3], [6, 5], [10, 9], [14, 13], [3, 3], [7, 5], [11, 9], [15, 13]
      ];
      
      for (let i = 0; i < 16; i++) {
        const [k, s] = round2[i];
        const temp = (A + this._G(B, C, D) + X[k] + 0x5A827999) >>> 0;
        A = D; D = C; C = B;
        B = OpCodes.RotL32(temp, s);
      }
      
      // Round 3 (16 operations)
      const round3 = [
        [0, 3], [8, 9], [4, 11], [12, 15], [2, 3], [10, 9], [6, 11], [14, 15],
        [1, 3], [9, 9], [5, 11], [13, 15], [3, 3], [11, 9], [7, 11], [15, 15]
      ];
      
      for (let i = 0; i < 16; i++) {
        const [k, s] = round3[i];
        const temp = (A + this._H(B, C, D) + X[k] + 0x6ED9EBA1) >>> 0;
        A = D; D = C; C = B;
        B = OpCodes.RotL32(temp, s);
      }
      
      // Add to hash values
      this._h[0] = (this._h[0] + A) >>> 0;
      this._h[1] = (this._h[1] + B) >>> 0;
      this._h[2] = (this._h[2] + C) >>> 0;
      this._h[3] = (this._h[3] + D) >>> 0;
    },
    
    /**
     * Update hash with new data
     * @param {string|Array} data - Input data to hash
     */
    Update: function(data) {
      // Convert input to byte array
      const bytes = (typeof data === 'string') ? OpCodes.StringToBytes(data) : data;
      
      for (let i = 0; i < bytes.length; i++) {
        this._buffer[this._bufferLength++] = bytes[i] & 0xFF;
        this._length++;
        
        // Process complete 64-byte blocks
        if (this._bufferLength === 64) {
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
      // Add padding bit
      this._buffer[this._bufferLength++] = 0x80;
      
      // Check if we need an additional block for length
      if (this._bufferLength > 56) {
        // Pad current block and process
        while (this._bufferLength < 64) {
          this._buffer[this._bufferLength++] = 0x00;
        }
        this._processBlock(this._buffer);
        this._bufferLength = 0;
      }
      
      // Pad to 56 bytes
      while (this._bufferLength < 56) {
        this._buffer[this._bufferLength++] = 0x00;
      }
      
      // Append length in bits as 64-bit little-endian
      const lengthBits = this._length * 8;
      // Low 32 bits first (little-endian)
      this._buffer[56] = lengthBits & 0xFF;
      this._buffer[57] = (lengthBits >>> 8) & 0xFF;
      this._buffer[58] = (lengthBits >>> 16) & 0xFF;
      this._buffer[59] = (lengthBits >>> 24) & 0xFF;
      // High 32 bits (for messages under 2^32 bits, this is 0)
      this._buffer[60] = 0; this._buffer[61] = 0; this._buffer[62] = 0; this._buffer[63] = 0;
      
      // Process final block
      this._processBlock(this._buffer);
      
      // Convert hash to hex string (little-endian output)
      let result = '';
      for (let i = 0; i < 4; i++) {
        const bytes = OpCodes.Unpack32LE(this._h[i]);
        for (let j = 0; j < 4; j++) {
          result += OpCodes.ByteToHex(bytes[j]);
        }
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
     * Required cipher interface methods (MD4 is a hash, not encryption)
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
      throw new Error('MD4 is a one-way hash function - decryption not possible');
    },
    
    ClearData: function() {
      if (this._h) OpCodes.ClearArray(this._h);
      if (this._buffer) OpCodes.ClearArray(this._buffer);
      this._length = 0;
      this._bufferLength = 0;
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(MD4);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MD4;
  }
  
  // Export to global scope
  global.MD4 = MD4;
  
})(typeof global !== 'undefined' ? global : window);