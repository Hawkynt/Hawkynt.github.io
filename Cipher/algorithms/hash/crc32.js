#!/usr/bin/env node
/*
 * Universal CRC-32 Checksum Algorithm
 * Compatible with both Browser and Node.js environments
 * Based on IEEE 802.3 CRC-32 standard (used in ZIP, PNG, etc.)
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of the CRC-32 cyclic redundancy check algorithm.
 * Produces 32-bit checksums for error detection in data transmission.
 * 
 * Uses polynomial 0x04C11DB7 (IEEE 802.3 standard)
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
      console.error('CRC-32 requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create CRC-32 checksum object
  const CRC32 = {
    // Public interface properties
    internalName: 'CRC32',
    name: 'CRC-32',
    comment: 'CRC-32 Cyclic Redundancy Check (IEEE 802.3) - Educational Implementation',
    minKeyLength: 0,    // Checksum functions don't use keys
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,    // Can checksum any length input
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: true,  // Checksum functions are one-way
    isInitialized: false,
    
    // CRC-32 constants
    POLYNOMIAL: 0xEDB88320, // Reflected IEEE 802.3 polynomial
    INITIAL_CRC: 0xFFFFFFFF,
    FINAL_XOR: 0xFFFFFFFF,
    
    // Pre-computed CRC table for fast calculation
    crcTable: null,
    
    // Initialize cipher and build CRC table
    Init: function() {
      CRC32.buildCrcTable();
      CRC32.isInitialized = true;
    },
    
    // Build the CRC lookup table
    buildCrcTable: function() {
      if (CRC32.crcTable) return; // Already built
      
      CRC32.crcTable = new Array(256);
      
      for (let i = 0; i < 256; i++) {
        let crc = i;
        for (let j = 0; j < 8; j++) {
          if (crc & 1) {
            crc = (crc >>> 1) ^ CRC32.POLYNOMIAL;
          } else {
            crc = crc >>> 1;
          }
        }
        CRC32.crcTable[i] = crc >>> 0; // Ensure unsigned 32-bit
      }
    },
    
    // Set up instance (checksum functions don't use keys)
    KeySetup: function(optional_szKey) {
      let id;
      do {
        id = 'CRC32[' + global.generateUniqueID() + ']';
      } while (CRC32.instances[id] || global.objectInstances[id]);
      
      CRC32.instances[szID] = new CRC32.CRC32Instance();
      global.objectInstances[szID] = true;
      return szID;
    },
    
    // Clear checksum data
    ClearData: function(id) {
      if (CRC32.instances[id]) {
        delete CRC32.instances[szID];
        delete global.objectInstances[szID];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'CRC32', 'ClearData');
        return false;
      }
    },
    
    // Calculate checksum (encryption interface)
    encryptBlock: function(id, szPlainText) {
      if (!CRC32.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'CRC32', 'encryptBlock');
        return '';
      }
      
      return CRC32.checksum(szPlainText);
    },
    
    // Checksum function is one-way (no decryption)
    decryptBlock: function(id, szCipherText) {
      global.throwException('Operation Not Supported Exception', 'CRC-32 checksum function cannot be reversed', 'CRC32', 'decryptBlock');
      return szCipherText;
    },
    
    /**
     * Core CRC-32 checksum function
     * @param {string} data - Input data to checksum
     * @returns {string} Hex-encoded CRC-32 checksum (8 characters)
     */
    checksum: function(data) {
      if (!CRC32.crcTable) {
        CRC32.buildCrcTable();
      }
      
      // Convert data to byte array
      const dataBytes = OpCodes.StringToBytes(data);
      
      // Initialize CRC
      let crc = CRC32.INITIAL_CRC;
      
      // Process each byte
      for (let i = 0; i < dataBytes.length; i++) {
        const tableIndex = (crc ^ dataBytes[i]) & 0xFF;
        crc = ((crc >>> 8) ^ CRC32.crcTable[tableIndex]) >>> 0;
      }
      
      // Final XOR and ensure unsigned 32-bit
      crc = (crc ^ CRC32.FINAL_XOR) >>> 0;
      
      // Convert to hex string
      return CRC32.crcToHex(crc);
    },
    
    /**
     * Convert CRC value to hexadecimal string
     * @param {number} crc - CRC-32 value
     * @returns {string} 8-character hex string
     */
    crcToHex: function(crc) {
      const bytes = OpCodes.Unpack32BE(crc);
      let hex = '';
      for (let i = 0; i < bytes.length; i++) {
        hex += OpCodes.ByteToHex(bytes[i]);
      }
      return hex.toLowerCase();
    },
    
    /**
     * Calculate CRC-32 incrementally (for streaming data)
     * @param {Array} dataBytes - Input data as byte array
     * @param {number} previousCrc - Previous CRC value (optional)
     * @returns {number} CRC-32 value
     */
    calculateIncremental: function(dataBytes, previousCrc) {
      if (!CRC32.crcTable) {
        CRC32.buildCrcTable();
      }
      
      let crc = previousCrc !== undefined ? previousCrc : CRC32.INITIAL_CRC;
      
      for (let i = 0; i < dataBytes.length; i++) {
        const tableIndex = (crc ^ dataBytes[i]) & 0xFF;
        crc = ((crc >>> 8) ^ CRC32.crcTable[tableIndex]) >>> 0;
      }
      
      return crc;
    },
    
    // Instance class
    CRC32Instance: function() {
      this.crc = CRC32.INITIAL_CRC;
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(CRC32);
  }
  
  // Export to global scope
  global.CRC32 = CRC32;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CRC32;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);