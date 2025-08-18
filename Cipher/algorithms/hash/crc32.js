/*
 * CRC32 Implementation
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CRC32 = {
    name: "CRC-32",
    description: "32-bit Cyclic Redundancy Check for error detection. IEEE 802.3 standard used in ZIP, PNG, and Ethernet.",
    inventor: "W. Wesley Peterson",
    year: 1961,
    country: "US",
    category: "checksum",
    subCategory: "CRC Family",
    securityStatus: null,
    securityNotes: "CRC-32 is designed for error detection, not cryptographic security. Can be easily manipulated by attackers.",
    
    documentation: [
      {text: "IEEE 802.3 Ethernet Standard", uri: "https://standards.ieee.org/standard/802_3-2018.html"},
      {text: "RFC 1952 - GZIP File Format", uri: "https://tools.ietf.org/html/rfc1952"},
      {text: "Wikipedia CRC-32", uri: "https://en.wikipedia.org/wiki/Cyclic_redundancy_check"}
    ],
    
    references: [
      {text: "PNG Specification CRC", uri: "https://www.w3.org/TR/PNG/#D-CRCAppendix"},
      {text: "ZIP File Format CRC", uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT"}
    ],
    
    knownVulnerabilities: [
      "Not cryptographically secure",
      "Vulnerable to intentional collision attacks",
      "Can be easily forged with specific bit patterns"
    ],
    
    tests: [
      {
        text: "CRC-32 Test Vector - '123456789'",
        uri: "https://www.w3.org/TR/PNG/#D-CRCAppendix",
        input: OpCodes.ANSIToBytes("123456789"),
        key: null,
        expected: OpCodes.Hex8ToBytes("CBF43926")
      },
      {
        text: "CRC-32 Test Vector - Empty",
        uri: "https://tools.ietf.org/html/rfc1952",
        input: OpCodes.ANSIToBytes(""),
        key: null,
        expected: OpCodes.Hex8ToBytes("00000000")
      },
      {
        text: "CRC-32 Test Vector - 'A'",
        uri: "https://www.w3.org/TR/PNG/#D-CRCAppendix",
        input: OpCodes.ANSIToBytes("A"),
        key: null,
        expected: OpCodes.Hex8ToBytes("D3D99E8B")
      }
    ],

    Init: function() {
      return true;
    },

    // CRC-32 constants (IEEE 802.3)
    POLYNOMIAL: 0xEDB88320, // Reflected IEEE 802.3 polynomial
    INITIAL_CRC: 0xFFFFFFFF,
    FINAL_XOR: 0xFFFFFFFF,

    // Core CRC32 computation
    compute: function(data) {
      const bytes = Array.isArray(data) ? data : OpCodes.ANSIToBytes(data);
      const table = this.getTable();
      let crc = this.INITIAL_CRC;
      
      // Process each byte
      for (let i = 0; i < bytes.length; i++) {
        const tableIndex = (crc ^ bytes[i]) & 0xFF;
        crc = ((crc >>> 8) ^ table[tableIndex]) >>> 0;
      }
      
      // Final XOR and ensure unsigned 32-bit
      crc = (crc ^ this.FINAL_XOR) >>> 0;
      
      // Return as 4-byte array (big-endian)
      return [
        (crc >>> 24) & 0xFF,
        (crc >>> 16) & 0xFF,
        (crc >>> 8) & 0xFF,
        crc & 0xFF
      ];
    },

    // Generate or return cached CRC table
    getTable: function() {
      if (!this._table) {
        this._table = this.generateTable();
      }
      return this._table;
    },

    generateTable: function() {
      const table = new Array(256);
      
      for (let i = 0; i < 256; i++) {
        let crc = i;
        for (let j = 0; j < 8; j++) {
          if (crc & 1) {
            crc = (crc >>> 1) ^ this.POLYNOMIAL;
          } else {
            crc = crc >>> 1;
          }
        }
        table[i] = crc >>> 0; // Ensure unsigned 32-bit
      }
      
      return table;
    }
  };

  // Auto-register with Subsystem (according to category) if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(CRC32);
  

})(typeof global !== 'undefined' ? global : window);