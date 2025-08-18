#!/usr/bin/env node
/*
 * Universal FNV Hash Functions
 * Compatible with both Browser and Node.js environments
 * Based on Fowler-Noll-Vo hash algorithm
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of FNV-1 and FNV-1a hash algorithms.
 * Supports 32-bit and 64-bit variants.
 * 
 * IMPLEMENTATION NOTES:
 * - Very fast non-cryptographic hash function
 * - Good distribution properties for hash tables
 * - Simple multiply and XOR operations
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
      console.error('FNV requires Cipher system to be loaded first');
      return;
    }
  }
  
  // FNV constants
  const FNV_32_PRIME = 0x01000193;
  const FNV_32_OFFSET_BASIS = 0x811c9dc5;
  
  // Create FNV-1a 32-bit hash object
  const FNV1a32 = {
    // Public interface properties
    internalName: 'FNV1a32',
    name: 'FNV-1a 32-bit',
    comment: 'Fowler-Noll-Vo 1a Hash Function (32-bit) - Educational Implementation',
    
    // Cipher interface properties (required for registration)
    minKeyLength: 0,    // Hash functions don't use keys
    maxKeyLength: 0,    // Hash functions don't use keys
    stepKeyLength: 1,   // Not applicable
    minBlockSize: 1,    // Can process any amount of data
    maxBlockSize: 0,    // No maximum block size (0 = unlimited)
    stepBlockSize: 1,   // Can process byte by byte
    instances: {},      // Instance tracking
    
    // FNV state
    _hash: FNV_32_OFFSET_BASIS,
    
    /**
     * Initialize the hash state
     */
    Init: function() {
      this._hash = FNV_32_OFFSET_BASIS;
    },
    
    /**
     * Update hash with new data (FNV-1a algorithm)
     * @param {string|Array} data - Input data to hash
     */
    Update: function(data) {
      // Convert input to byte array
      const bytes = (typeof data === 'string') ? OpCodes.StringToBytes(data) : data;
      
      for (let i = 0; i < bytes.length; i++) {
        // FNV-1a: XOR byte first, then multiply
        this._hash = (this._hash ^ (bytes[i] & 0xFF)) >>> 0;
        this._hash = Math.imul(this._hash, FNV_32_PRIME) >>> 0;
      }
    },
    
    /**
     * Finalize hash computation and return result
     * @returns {string} Hexadecimal hash
     */
    Final: function() {
      return this._hash.toString(16).padStart(8, '0');
    },
    
    /**
     * Compute hash of complete message in one operation
     * @param {string|Array} message - Message to hash
     * @returns {string} Hexadecimal hash
     */
    Hash: function(message) {
      this.Init();
      this.Update(message);
      return this.Final();
    },
    
    /**
     * Required cipher interface methods
     */
    KeySetup: function(key) {
      return true;
    },
    
    encryptBlock: function(blockType, plaintext) {
      return this.Hash(plaintext);
    },
    
    decryptBlock: function(blockType, ciphertext) {
      throw new Error('FNV-1a is a one-way hash function - decryption not possible');
    },
    
    ClearData: function() {
      this._hash = FNV_32_OFFSET_BASIS;
    }
  };
  
  // Create FNV-1 32-bit hash object (different from FNV-1a)
  const FNV1_32 = {
    // Public interface properties
    internalName: 'FNV1_32',
    name: 'FNV-1 32-bit',
    comment: 'Fowler-Noll-Vo 1 Hash Function (32-bit) - Educational Implementation',
    
    // Cipher interface properties (required for registration)
    minKeyLength: 0,    // Hash functions don't use keys
    maxKeyLength: 0,    // Hash functions don't use keys
    stepKeyLength: 1,   // Not applicable
    minBlockSize: 1,    // Can process any amount of data
    maxBlockSize: 0,    // No maximum block size (0 = unlimited)
    stepBlockSize: 1,   // Can process byte by byte
    instances: {},      // Instance tracking
    
    // FNV state
    _hash: FNV_32_OFFSET_BASIS,
    
    /**
     * Initialize the hash state
     */
    Init: function() {
      this._hash = FNV_32_OFFSET_BASIS;
    },
    
    /**
     * Update hash with new data (FNV-1 algorithm)
     * @param {string|Array} data - Input data to hash
     */
    Update: function(data) {
      // Convert input to byte array
      const bytes = (typeof data === 'string') ? OpCodes.StringToBytes(data) : data;
      
      for (let i = 0; i < bytes.length; i++) {
        // FNV-1: Multiply first, then XOR byte
        this._hash = Math.imul(this._hash, FNV_32_PRIME) >>> 0;
        this._hash = (this._hash ^ (bytes[i] & 0xFF)) >>> 0;
      }
    },
    
    /**
     * Finalize hash computation and return result
     * @returns {string} Hexadecimal hash
     */
    Final: function() {
      return this._hash.toString(16).padStart(8, '0');
    },
    
    /**
     * Compute hash of complete message in one operation
     * @param {string|Array} message - Message to hash
     * @returns {string} Hexadecimal hash
     */
    Hash: function(message) {
      this.Init();
      this.Update(message);
      return this.Final();
    },
    
    /**
     * Required cipher interface methods
     */
    KeySetup: function(key) {
      return true;
    },
    
    encryptBlock: function(blockType, plaintext) {
      return this.Hash(plaintext);
    },
    
    decryptBlock: function(blockType, ciphertext) {
      throw new Error('FNV-1 is a one-way hash function - decryption not possible');
    },
    
    ClearData: function() {
      this._hash = FNV_32_OFFSET_BASIS;
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(FNV1a32);
    Cipher.AddCipher(FNV1_32);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FNV1a32, FNV1_32 };
  }
  
  // Export to global scope
  global.FNV1a32 = FNV1a32;
  global.FNV1_32 = FNV1_32;
  
})(typeof global !== 'undefined' ? global : window);