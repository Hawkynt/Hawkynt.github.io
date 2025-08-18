#!/usr/bin/env node
/*
 * Universal SHA-384 Hash Function
 * Compatible with both Browser and Node.js environments
 * Based on NIST FIPS 180-4 specification
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of the SHA-384 secure hash algorithm.
 * Produces 384-bit (48-byte) hash values from input data.
 * 
 * IMPLEMENTATION NOTES:
 * - Uses SHA-512 algorithm with different initial values and truncated output
 * - Based on NIST FIPS 180-4 Section 6.5
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
  
  // Load SHA-512 implementation to reuse core algorithm
  if (!global.SHA512 && typeof require !== 'undefined') {
    try {
      require('./sha512.js');
    } catch (e) {
      console.error('Failed to load SHA-512 implementation:', e.message);
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
      console.error('SHA-384 requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create SHA-384 hash object
  const SHA384 = {
    // Public interface properties
    internalName: 'SHA384',
    name: 'SHA-384',
    comment: 'SHA-384 Secure Hash Algorithm (NIST FIPS 180-4) - Educational Implementation',
    
    // Cipher interface properties (required for registration)
    minKeyLength: 0,    // Hash functions don't use keys
    maxKeyLength: 0,    // Hash functions don't use keys
    stepKeyLength: 1,   // Not applicable for hash functions
    minBlockSize: 1,    // Can hash any amount of data
    maxBlockSize: 0,    // No maximum block size (0 = unlimited)
    stepBlockSize: 1,   // Can process byte by byte
    instances: {},      // Instance tracking
    
    // Inherit SHA-512 implementation
    _sha512: null,
    
    /**
     * Initialize the hash state with SHA-384 specific initial values
     * NIST FIPS 180-4 Section 5.3.4
     */
    Init: function() {
      // Create SHA-512 instance for internal use
      this._sha512 = Object.create(global.SHA512);
      this._sha512.Init();
      
      // Override with SHA-384 initial hash values
      // (first 64 bits of fractional parts of square roots of 9th through 16th primes)
      this._sha512._h = [
        [0xcbbb9d5d, 0xc1059ed8], [0x629a292a, 0x367cd507], [0x9159015a, 0x3070dd17], [0x152fecd8, 0xf70e5939],
        [0x67332667, 0xffc00b31], [0x8eb44a87, 0x68581511], [0xdb0c2e0d, 0x64f98fa7], [0x47b5481d, 0xbefa4fa4]
      ];
    },
    
    /**
     * Update hash with new data
     * @param {string|Array} data - Input data to hash
     */
    Update: function(data) {
      this._sha512.Update(data);
    },
    
    /**
     * Finalize hash computation and return truncated digest
     * @returns {string} Hexadecimal hash digest (384 bits = 48 bytes)
     */
    Final: function() {
      const sha512Result = this._sha512.Final();
      // Truncate to first 384 bits (96 hex characters)
      return sha512Result.substring(0, 96);
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
     * Required cipher interface methods (SHA-384 is a hash, not encryption)
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
      throw new Error('SHA-384 is a one-way hash function - decryption not possible');
    },
    
    ClearData: function() {
      if (this._sha512) {
        this._sha512.ClearData();
      }
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(SHA384);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SHA384;
  }
  
  // Export to global scope
  global.SHA384 = SHA384;
  
})(typeof global !== 'undefined' ? global : window);