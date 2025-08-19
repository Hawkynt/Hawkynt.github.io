#!/usr/bin/env node
/*
 * FNV Hash Implementation
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

  const FNV = {
    name: "FNV-1a",
    description: "Fast non-cryptographic hash function with good distribution. Simple multiply and XOR operations.",
    inventor: "Glenn Fowler, Landon Curt Noll, Phong Vo",
    year: 1991,
    country: "US",
    category: "hash",
    subCategory: "Fast Hash",
    securityStatus: null,
    securityNotes: "FNV is designed for speed and good distribution, not cryptographic security. Not suitable for security-sensitive applications.",
    
    documentation: [
      {text: "FNV Hash Official Website", uri: "http://www.isthe.com/chongo/tech/comp/fnv/index.html"},
      {text: "Wikipedia FNV Hash", uri: "https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function"},
      {text: "FNV Hash Specification", uri: "http://www.isthe.com/chongo/tech/comp/fnv/"}
    ],
    
    references: [
      {text: "FNV Reference Implementation", uri: "http://www.isthe.com/chongo/src/fnv/"},
      {text: "Hash Function Performance Tests", uri: "https://github.com/aappleby/smhasher"}
    ],
    
    knownVulnerabilities: [
      "Not cryptographically secure",
      "Vulnerable to hash flooding attacks",
      "Can be reversed with precomputed tables for small inputs"
    ],
    
    tests: [
      {
        text: "FNV-1a Test Vector - Empty string",
        uri: "http://www.isthe.com/chongo/tech/comp/fnv/",
        input: OpCodes.StringToBytes(""),
        key: null,
        expected: OpCodes.Hex8ToBytes("811c9dc5")
      },
      {
        text: "FNV-1a Test Vector - 'a'",
        uri: "http://www.isthe.com/chongo/tech/comp/fnv/",
        input: OpCodes.StringToBytes("a"),
        key: null,
        expected: OpCodes.Hex8ToBytes("e40c292c")
      },
      {
        text: "FNV-1a Test Vector - 'foobar'",
        uri: "http://www.isthe.com/chongo/tech/comp/fnv/",
        input: OpCodes.StringToBytes("foobar"),
        key: null,
        expected: OpCodes.Hex8ToBytes("a9f37ed7")
      }
    ],

    Init: function() {
      return true;
    },

    // FNV-1a 32-bit constants
    FNV_32_PRIME: 0x01000193,
    FNV_32_OFFSET_BASIS: 0x811c9dc5,

    // Core FNV-1a computation
    compute: function(data) {
      const bytes = Array.isArray(data) ? data : OpCodes.StringToBytes(data);
      let hash = this.FNV_32_OFFSET_BASIS;
      
      for (let i = 0; i < bytes.length; i++) {
        // FNV-1a: XOR byte first, then multiply
        hash = (hash ^ (bytes[i] & 0xFF)) >>> 0;
        hash = Math.imul(hash, this.FNV_32_PRIME) >>> 0;
      }
      
      // Return as 4-byte array (big-endian)
      return [
        (hash >>> 24) & 0xFF,
        (hash >>> 16) & 0xFF,
        (hash >>> 8) & 0xFF,
        hash & 0xFF
      ];
    },

    // FNV-1 (different from FNV-1a) - multiply first, then XOR
    computeFNV1: function(data) {
      const bytes = Array.isArray(data) ? data : OpCodes.StringToBytes(data);
      let hash = this.FNV_32_OFFSET_BASIS;
      
      for (let i = 0; i < bytes.length; i++) {
        // FNV-1: Multiply first, then XOR byte
        hash = Math.imul(hash, this.FNV_32_PRIME) >>> 0;
        hash = (hash ^ (bytes[i] & 0xFF)) >>> 0;
      }
      
      // Return as 4-byte array (big-endian)
      return [
        (hash >>> 24) & 0xFF,
        (hash >>> 16) & 0xFF,
        (hash >>> 8) & 0xFF,
        hash & 0xFF
      ];
    }
  };

  // Auto-register with Subsystem (according to category) if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(FNV);
  


  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FNV;
  }
  
  // Export to global scope
  global.FNV = FNV;

})(typeof global !== 'undefined' ? global : window);