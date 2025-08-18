#!/usr/bin/env node
/*
 * Universal SHA-224 Hash Function
 * Compatible with both Browser and Node.js environments
 * Based on NIST FIPS 180-4 specification
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of the SHA-224 secure hash algorithm.
 * Produces 224-bit (28-byte) hash values from input data.
 * 
 * IMPLEMENTATION NOTES:
 * - Uses SHA-256 algorithm with different initial values and truncated output
 * - Based on NIST FIPS 180-4 Section 6.3
 * - Optimized with OpCodes for cross-platform portability
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
  
  // Load SHA-256 implementation to reuse core algorithm
  if (!global.SHA256 && typeof require !== 'undefined') {
    try {
      require('./sha256.js');
    } catch (e) {
      console.error('Failed to load SHA-256 implementation:', e.message);
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
      console.error('SHA-224 requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create SHA-224 hash object
  const SHA224 = {
    // Public interface properties
    internalName: 'SHA224',
    name: 'SHA-224',
    comment: 'SHA-224 Secure Hash Algorithm (NIST FIPS 180-4) - Educational Implementation',
    
    // Cipher interface properties (required for registration)
    minKeyLength: 0,    // Hash functions don't use keys
    maxKeyLength: 0,    // Hash functions don't use keys
    stepKeyLength: 1,   // Not applicable for hash functions
    minBlockSize: 1,    // Can hash any amount of data
    maxBlockSize: 0,    // No maximum block size (0 = unlimited)
    stepBlockSize: 1,   // Can process byte by byte
    instances: {},      // Instance tracking
    
    // Inherit SHA-256 implementation
    _sha256: null,
    
    /**
     * Initialize the hash state with SHA-224 specific initial values
     * NIST FIPS 180-4 Section 5.3.2
     */
    Init: function() {
      // Create SHA-256 instance for internal use
      this._sha256 = Object.create(global.SHA256);
      this._sha256.Init();
      
      // Override with SHA-224 initial hash values
      // (first 32 bits of fractional parts of square roots of 9th through 16th primes)
      this._sha256._h = [
        0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939,
        0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4
      ];
    },
    
    /**
     * Update hash with new data
     * @param {string|Array} data - Input data to hash
     */
    Update: function(data) {
      this._sha256.Update(data);
    },
    
    /**
     * Finalize hash computation and return truncated digest
     * @returns {string} Hexadecimal hash digest (224 bits = 28 bytes)
     */
    Final: function() {
      const sha256Result = this._sha256.Final();
      // Truncate to first 224 bits (56 hex characters)
      return sha256Result.substring(0, 56);
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
     * Required cipher interface methods (SHA-224 is a hash, not encryption)
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
      throw new Error('SHA-224 is a one-way hash function - decryption not possible');
    },
    
    ClearData: function() {
      if (this._sha256) {
        this._sha256.ClearData();
      }
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(SHA224);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SHA224;
  }
  
  // Export to global scope
  global.SHA224 = SHA224;
  
})(typeof global !== 'undefined' ? global : window);