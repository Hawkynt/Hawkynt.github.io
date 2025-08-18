#!/usr/bin/env node
/*
 * CRC16 Universal Checksum Implementation
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * CRC16 (Cyclic Redundancy Check 16-bit) is a popular error-detecting code.
 * Multiple variants exist with different polynomials and parameters.
 * 
 * Common variants: CRC-16-CCITT, CRC-16-IBM, CRC-16-ANSI
 * Reference: Various ITU-T, ANSI, and IEEE standards
 * 
 * NOTE: This is an educational implementation for learning purposes only.
 * Use proven libraries for production systems.
 */

(function(global) {
  'use strict';
  
  // Load OpCodes library for common operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  // CRC16 variants with their parameters
  const CRC16_VARIANTS = {
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
  };
  
  /**
   * Reflect bits in a value
   * @param {number} value - Input value
   * @param {number} bits - Number of bits to reflect
   * @returns {number} Reflected value
   */
  function reflect(value, bits) {
    let result = 0;
    for (let i = 0; i < bits; i++) {
      if (value & (1 << i)) {
        result |= (1 << (bits - 1 - i));
      }
    }
    return result;
  }
  
  /**
   * Generate CRC16 lookup table
   * @param {number} polynomial - CRC polynomial
   * @param {boolean} refIn - Reflect input bytes
   * @returns {Array} Lookup table
   */
  function generateCrc16Table(polynomial, refIn) {
    const table = new Array(256);
    
    for (let i = 0; i < 256; i++) {
      let crc = refIn ? reflect(i, 8) << 8 : i << 8;
      
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) {
          crc = ((crc << 1) ^ polynomial) & 0xFFFF;
        } else {
          crc = (crc << 1) & 0xFFFF;
        }
      }
      
      table[i] = refIn ? reflect(crc, 16) : crc;
    }
    
    return table;
  }
  
  /**
   * CRC16 hasher class
   */
  function Crc16Hasher(variant) {
    this.variant = variant || 'CCITT';
    this.params = CRC16_VARIANTS[this.variant];
    
    if (!this.params) {
      throw new Error('Unknown CRC16 variant: ' + this.variant);
    }
    
    this.table = generateCrc16Table(this.params.polynomial, this.params.refIn);
    this.crc = this.params.initial;
  }
  
  Crc16Hasher.prototype.update = function(data) {
    if (typeof data === 'string') {
      data = OpCodes.StringToBytes(data);
    }
    
    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      
      if (this.params.refIn) {
        const tableIndex = (this.crc ^ byte) & 0xFF;
        this.crc = ((this.crc >>> 8) ^ this.table[tableIndex]) & 0xFFFF;
      } else {
        const tableIndex = ((this.crc >>> 8) ^ byte) & 0xFF;
        this.crc = ((this.crc << 8) ^ this.table[tableIndex]) & 0xFFFF;
      }
    }
  };
  
  Crc16Hasher.prototype.finalize = function() {
    let result = this.crc ^ this.params.xorOut;
    
    if (this.params.refOut) {
      result = reflect(result, 16);
    }
    
    // Return as 2-byte array (big-endian)
    return new Uint8Array([
      (result >>> 8) & 0xFF,
      result & 0xFF
    ]);
  };
  
  /**
   * Direct CRC16 calculation
   * @param {Uint8Array|string} data - Input data
   * @param {string} variant - CRC variant
   * @returns {number} CRC16 value
   */
  function crc16(data, variant) {
    const hasher = new Crc16Hasher(variant);
    hasher.update(data);
    const result = hasher.finalize();
    return (result[0] << 8) | result[1];
  }
  
  // CRC16 Universal Cipher Interface
  const Crc16 = {
    internalName: 'crc16',
    name: 'CRC16',
    // Required Cipher interface properties
    minKeyLength: 0,        // Minimum key length in bytes
    maxKeyLength: 64,        // Maximum key length in bytes
    stepKeyLength: 1,       // Key length step size
    minBlockSize: 0,        // Minimum block size in bytes
    maxBlockSize: 0,        // Maximum block size (0 = unlimited)
    stepBlockSize: 1,       // Block size step
    instances: {},          // Instance tracking
    
    // Checksum interface
    Init: function() {
      this.hasher = new Crc16Hasher('CCITT'); // Default to CCITT
      this.bKey = false;
    },
    
    KeySetup: function(key) {
      // Use key to select variant if provided
      let variant = 'CCITT';
      if (key && key.length > 0) {
        const keyStr = OpCodes.BytesToString(key).toUpperCase();
        if (CRC16_VARIANTS[keyStr]) {
          variant = keyStr;
        }
      }
      this.hasher = new Crc16Hasher(variant);
      this.bKey = key && key.length > 0;
    },
    
    encryptBlock: function(blockIndex, data) {
      if (typeof data === 'string') {
        this.hasher.update(data);
        const result = this.hasher.finalize();
        return OpCodes.BytesToHex(result);
      }
      return '';
    },
    
    decryptBlock: function(blockIndex, data) {
      // Checksum functions don't decrypt
      return this.encryptBlock(blockIndex, data);
    },
    
    // Direct checksum interface
    checksum: function(data, variant) {
      return crc16(data, variant);
    },
    
    // Get available variants
    getVariants: function() {
      return Object.keys(CRC16_VARIANTS);
    },
    
    ClearData: function() {
      if (this.hasher) {
        this.hasher.crc = this.hasher.params.initial;
      }
      this.bKey = false;
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(Crc16);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Crc16;
  }
  
  // Make available globally
  global.Crc16 = Crc16;
  
})(typeof global !== 'undefined' ? global : window);