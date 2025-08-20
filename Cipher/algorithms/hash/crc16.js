#!/usr/bin/env node
/*
 * CRC16 Implementation
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
  
  // Load Cipher system
  if (!global.Cipher) {
    if (typeof require !== 'undefined') {
      try {
        require('../../universal-cipher-env.js');
        require('../../cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    }
  }

  const CRC16 = {
    name: "CRC-16",
    description: "16-bit Cyclic Redundancy Check for error detection. Multiple variants with different polynomials and parameters.",
    inventor: "W. Wesley Peterson",
    year: 1961,
    country: "US",
    category: "hash",
    subCategory: "Specialized Hash",
    securityStatus: null,
    securityNotes: "CRC-16 is designed for error detection, not cryptographic security. Can be easily manipulated by attackers.",
    
    documentation: [
      {text: "ITU-T Recommendation V.41", uri: "https://www.itu.int/rec/T-REC-V.41"},
      {text: "Wikipedia CRC", uri: "https://en.wikipedia.org/wiki/Cyclic_redundancy_check"},
      {text: "CRC Catalogue", uri: "http://reveng.sourceforge.net/crc-catalogue/"}
    ],
    
    references: [
      {text: "A Painless Guide to CRC Error Detection Algorithms", uri: "http://www.ross.net/crc/"},
      {text: "CRC RevEng Tool", uri: "http://reveng.sourceforge.net/"}
    ],
    
    knownVulnerabilities: [
      "Not cryptographically secure",
      "Can be easily forged by attackers",
      "Vulnerable to intentional bit manipulation"
    ],
    
    tests: [
      {
        text: "CRC-16-CCITT Test Vector - '123456789'",
        uri: "http://www.ross.net/crc/",
        input: OpCodes.StringToBytes("123456789"),
        key: null,
        expected: OpCodes.Hex8ToBytes("29B1")
      },
      {
        text: "CRC-16-IBM Test Vector - Empty",
        uri: "http://reveng.sourceforge.net/crc-catalogue/",
        input: OpCodes.StringToBytes(""),
        key: null,
        expected: OpCodes.Hex8ToBytes("0000")
      },
      {
        text: "CRC-16-CCITT Test Vector - 'A'",
        uri: "http://www.ross.net/crc/",
        input: OpCodes.StringToBytes("A"),
        key: null,
        expected: OpCodes.Hex8ToBytes("B915")
      }
    ],

    Init: function() {
      return true;
    },

    // CRC16 variants
    VARIANTS: {
      'CCITT': {
        polynomial: 0x1021,
        initial: 0xFFFF,
        xorOut: 0x0000,
        refIn: false,
        refOut: false,
        name: 'CRC-16-CCITT'
      },
      'IBM': {
        polynomial: 0x8005,
        initial: 0x0000,
        xorOut: 0x0000,
        refIn: true,
        refOut: true,
        name: 'CRC-16-IBM'
      },
      'ANSI': {
        polynomial: 0x8005,
        initial: 0xFFFF,
        xorOut: 0xFFFF,
        refIn: true,
        refOut: true,
        name: 'CRC-16-ANSI'
      },
      'XMODEM': {
        polynomial: 0x1021,
        initial: 0x0000,
        xorOut: 0x0000,
        refIn: false,
        refOut: false,
        name: 'CRC-16-XMODEM'
      }
    },

    // Core CRC16 computation
    compute: function(data, variant) {
      variant = variant || 'CCITT';
      const params = this.VARIANTS[variant];
      if (!params) {
        throw new Error('Unknown CRC16 variant: ' + variant);
      }

      const bytes = Array.isArray(data) ? data : OpCodes.StringToBytes(data);
      const table = this.generateTable(params.polynomial, params.refIn);
      let crc = params.initial;

      for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i];
        
        if (params.refIn) {
          const tableIndex = (crc ^ byte) & 0xFF;
          crc = ((crc >>> 8) ^ table[tableIndex]) & 0xFFFF;
        } else {
          const tableIndex = ((crc >>> 8) ^ byte) & 0xFF;
          crc = ((crc << 8) ^ table[tableIndex]) & 0xFFFF;
        }
      }

      let result = crc ^ params.xorOut;
      
      if (params.refOut && !params.refIn) {
        result = this.reflect(result, 16);
      }

      // Return as 2-byte array (big-endian)
      return [
        (result >>> 8) & 0xFF,
        result & 0xFF
      ];
    },

    generateTable: function(polynomial, refIn) {
      const table = new Array(256);
      
      for (let i = 0; i < 256; i++) {
        let crc = refIn ? this.reflect(i, 8) << 8 : i << 8;
        
        for (let j = 0; j < 8; j++) {
          if (crc & 0x8000) {
            crc = ((crc << 1) ^ polynomial) & 0xFFFF;
          } else {
            crc = (crc << 1) & 0xFFFF;
          }
        }
        
        table[i] = refIn ? this.reflect(crc, 16) : crc;
      }
      
      return table;
    },

    reflect: function(value, bits) {
      let result = 0;
      for (let i = 0; i < bits; i++) {
        if (value & (1 << i)) {
          result |= (1 << (bits - 1 - i));
        }
      }
      return result;
      },
      
      // Required interface methods
      Hash: function(input) {
      return this.compute ? this.compute(input) : input;
    },

    ClearData: function() {
      // No persistent state to clear
      return true;
    }
  };

  // Auto-register with Subsystem (according to category) if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(CRC16);
  


  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CRC16;
  }
  
  // Export to global scope
  global.CRC16 = CRC16;

})(typeof global !== 'undefined' ? global : window);