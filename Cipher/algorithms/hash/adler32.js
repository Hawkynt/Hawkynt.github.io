#!/usr/bin/env node
/*
 * Adler-32 Checksum Implementation
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

  const Adler32 = {
    name: "Adler-32",
    description: "Fast checksum algorithm used in zlib compression. Creates 32-bit checksums with good error detection.",
    inventor: "Mark Adler",
    year: 1995,
    country: "US",
    category: "checksum",
    subCategory: "Non-Cryptographic",
    securityStatus: null,
    securityNotes: "Adler-32 is designed for error detection, not cryptographic security. Vulnerable to intentional tampering.",
    
    documentation: [
      {text: "RFC 1950 - ZLIB Compressed Data Format", uri: "https://tools.ietf.org/html/rfc1950"},
      {text: "Adler-32 Algorithm Description", uri: "https://en.wikipedia.org/wiki/Adler-32"}
    ],
    
    references: [
      {text: "zlib Reference Implementation", uri: "https://github.com/madler/zlib"}
    ],
    
    knownVulnerabilities: [
      "Not suitable for cryptographic integrity verification",
      "Can be easily forged by attackers"
    ],
    
    tests: [
      {
        text: "RFC 1950 Test Vector - Empty",
        uri: "https://tools.ietf.org/html/rfc1950",
        input: OpCodes.Hex8ToBytes(""),
        key: null,
        expected: OpCodes.Hex8ToBytes("00000001")
      },
      {
        text: "RFC 1950 Test Vector - Single byte",
        uri: "https://tools.ietf.org/html/rfc1950",
        input: OpCodes.StringToBytes("a"),
        key: null,
        expected: OpCodes.Hex8ToBytes("00620062")
      },
      {
        text: "RFC 1950 Test Vector - Wikipedia example",
        uri: "https://en.wikipedia.org/wiki/Adler-32",
        input: OpCodes.StringToBytes("Wikipedia"),
        key: null,
        expected: OpCodes.Hex8ToBytes("11E60398")
      }
    ],

    // Algorithm constants
    MOD_ADLER: 65521,  // Largest prime less than 2^16
    
    Init: function() {
      return true;
    },

    // Core Adler-32 computation
    compute: function(data) {
      const bytes = Array.isArray(data) ? data : OpCodes.StringToBytes(data);
      let a = 1, b = 0;
      
      for (let i = 0; i < bytes.length; i++) {
        a = (a + (bytes[i] & 0xFF)) % this.MOD_ADLER;
        b = (b + a) % this.MOD_ADLER;
      }
      
      // Return as 4-byte array (big-endian)
      const checksum = ((b << 16) | a) >>> 0;
      return [
        (checksum >>> 24) & 0xFF,
        (checksum >>> 16) & 0xFF, 
        (checksum >>> 8) & 0xFF,
        checksum & 0xFF
      ];
    }
  };

  // Auto-register with Subsystem (according to category) if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(Adler32);
  


  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Adler32;
  }
  
  // Export to global scope
  global.Adler32 = Adler32;

})(typeof global !== 'undefined' ? global : window);