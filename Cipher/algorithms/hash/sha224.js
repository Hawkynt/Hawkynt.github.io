#!/usr/bin/env node
/*
 * SHA-224 Implementation
 * (c)2006-2025 Hawkynt
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
  
  const SHA224 = {
    name: "SHA-224",
    description: "Truncated version of SHA-256 producing 224-bit digest. Part of the SHA-2 family with identical security properties to SHA-256 but shorter output. Widely supported and standardized.",
    inventor: "National Security Agency (NSA)",
    year: 2001,
    country: "US",
    category: "hash",
    subCategory: "Cryptographic Hash",
    securityStatus: null,
    securityNotes: "Considered secure with no known practical attacks. Provides equivalent security to SHA-256 with shorter output.",
    
    documentation: [
      {text: "NIST FIPS 180-4: Secure Hash Standard", uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf"},
      {text: "RFC 6234: US Secure Hash Algorithms", uri: "https://tools.ietf.org/html/rfc6234"},
      {text: "Wikipedia: SHA-2", uri: "https://en.wikipedia.org/wiki/SHA-2"}
    ],
    
    references: [
      {text: "OpenSSL Implementation", uri: "https://github.com/openssl/openssl/blob/master/crypto/sha/sha256.c"},
      {text: "NIST CAVP Test Vectors", uri: "https://csrc.nist.gov/Projects/Cryptographic-Algorithm-Validation-Program/Secure-Hashing"},
      {text: "RFC 6234 Specification", uri: "https://tools.ietf.org/html/rfc6234"}
    ],
    
    knownVulnerabilities: [],
    
    tests: [
      {
        text: "Empty string test vector",
        uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf",
        input: [],
        expected: OpCodes.Hex8ToBytes("d14a028c2a3a2bc9476102bb288234c415a2b01f828ea62ac5b3e42f")
      },
      {
        text: "String 'abc' test vector",
        uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf",
        input: OpCodes.StringToBytes("abc"),
        expected: OpCodes.Hex8ToBytes("23097d223405d8228642a477bda255b32aadbce4bda0b3f7e36c9da7")
      },
      {
        text: "Alphabet test vector",
        uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf",
        input: OpCodes.StringToBytes("abcdefghijklmnopqrstuvwxyz"),
        expected: OpCodes.Hex8ToBytes("45a5f72c39c5cff2522eb3429799e49e5f44b356ef926bcf390dccc2")
      }
    ],

    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 1,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    
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
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(SHA224);
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SHA224;
  }
  
  // Export to global scope
  global.SHA224 = SHA224;
  
})(typeof global !== 'undefined' ? global : window);