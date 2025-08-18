#!/usr/bin/env node
/*
 * Universal Adler-32 Checksum
 * Compatible with both Browser and Node.js environments
 * Based on RFC 1950 specification (used in zlib)
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of the Adler-32 checksum algorithm.
 * Produces 32-bit checksum values from input data.
 * 
 * IMPLEMENTATION NOTES:
 * - Used by zlib/gzip compression
 * - Fast and simple checksum with good error detection
 * - Not cryptographically secure
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
      console.error('Adler-32 requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create Adler-32 object
  const Adler32 = {
    // Public interface properties
    internalName: 'Adler32',
    name: 'Adler-32',
    comment: 'Adler-32 Checksum (RFC 1950) - Educational Implementation',
    
    // Cipher interface properties (required for registration)
    minKeyLength: 0,    // Checksums don't use keys
    maxKeyLength: 0,    // Checksums don't use keys
    stepKeyLength: 1,   // Not applicable
    minBlockSize: 1,    // Can process any amount of data
    maxBlockSize: 0,    // No maximum block size (0 = unlimited)
    stepBlockSize: 1,   // Can process byte by byte
    instances: {},      // Instance tracking
    
    // Adler-32 state variables
    _a: 1,    // Low part (starts at 1)
    _b: 0,    // High part (starts at 0)
    
    // Adler-32 modulus (largest prime less than 2^16)
    MOD_ADLER: 65521,
    
    /**
     * Initialize the checksum state
     */
    Init: function() {
      this._a = 1;
      this._b = 0;
    },
    
    /**
     * Update checksum with new data
     * @param {string|Array} data - Input data to checksum
     */
    Update: function(data) {
      // Convert input to byte array
      const bytes = (typeof data === 'string') ? OpCodes.StringToBytes(data) : data;
      
      for (let i = 0; i < bytes.length; i++) {
        this._a = (this._a + (bytes[i] & 0xFF)) % this.MOD_ADLER;
        this._b = (this._b + this._a) % this.MOD_ADLER;
      }
    },
    
    /**
     * Finalize checksum computation and return result
     * @returns {string} Hexadecimal checksum
     */
    Final: function() {
      // Combine high and low parts: (b << 16) | a
      const result = ((this._b << 16) | this._a) >>> 0;
      return result.toString(16).padStart(8, '0');
    },
    
    /**
     * Compute checksum of complete message in one operation
     * @param {string|Array} message - Message to checksum
     * @returns {string} Hexadecimal checksum
     */
    Hash: function(message) {
      this.Init();
      this.Update(message);
      return this.Final();
    },
    
    /**
     * Required cipher interface methods (Adler-32 is a checksum, not encryption)
     */
    KeySetup: function(key) {
      // Checksums don't use keys
      return true;
    },
    
    encryptBlock: function(blockType, plaintext) {
      return this.Hash(plaintext);
    },
    
    decryptBlock: function(blockType, ciphertext) {
      // Checksums are one-way
      throw new Error('Adler-32 is a one-way checksum - decryption not possible');
    },
    
    ClearData: function() {
      this._a = 1;
      this._b = 0;
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(Adler32);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Adler32;
  }
  
  // Export to global scope
  global.Adler32 = Adler32;
  
})(typeof global !== 'undefined' ? global : window);