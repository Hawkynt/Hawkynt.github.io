#!/usr/bin/env node
/*
 * Universal BinHex 4.0 Encoder/Decoder
 * Based on original BinHex 4.0 specification by Yves Lempereur (1985)
 * Compatible with both Browser and Node.js environments
 * 
 * BinHex 4.0 is a binary-to-text encoding system used on classic Mac OS
 * for sending binary files over email. It includes run-length encoding,
 * CRC protection, and handles Macintosh file forks.
 * 
 * References:
 * - BinHex 4.0 Definition by Yves Lempereur
 * - RFC 1741: MIME Content Type for BinHex Encoded Files
 * 
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes:', e.message);
      return;
    }
  }
  
  if (!global.Cipher && typeof require !== 'undefined') {
    try {
      require('../../universal-cipher-env.js');
      require('../../cipher.js');
    } catch (e) {
      console.error('Failed to load cipher dependencies:', e.message);
      return;
    }
  }
  
  const BinHex = {
    internalName: 'binhex',
    name: 'BinHex 4.0 (Macintosh)',
    version: '1.0.0',
    description: 'Educational implementation for learning purposes',
    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,

    
    // BinHex 4.0 alphabet for 6-bit encoding
    alphabet: '!"#$%&\'()*+,-012345689@ABCDEFGHIJKLMNPQRSTUVXYZ[`abcdefhijklmpqr',
    
    // Reverse lookup table
    decodeTable: null,
    
    // File information
    filename: 'data.bin',
    fileType: 'TEXT',
    fileCreator: 'UNIX',
    
    /**
     * Initialize the encoder and build decode table
     */
    Init: function() {
      // Build decode table for fast character lookup
      this.decodeTable = new Array(256).fill(-1);
      for (let i = 0; i < this.alphabet.length; i++) {
        this.decodeTable[this.alphabet.charCodeAt(i)] = i;
      }
      
      // Default file parameters
      this.filename = 'data.bin';
      this.fileType = 'TEXT';
      this.fileCreator = 'UNIX';
    },
    
    /**
     * Set up file parameters
     * @param {string|Object} key - Filename or file info object
     */
    KeySetup: function(key) {
      this.Init(); // Ensure decode table is built
      
      if (typeof key === 'string') {
        this.filename = key;
      } else if (typeof key === 'object' && key !== null) {
        this.filename = key.filename || 'data.bin';
        this.fileType = key.type || 'TEXT';
        this.fileCreator = key.creator || 'UNIX';
      }
    },
    
    /**
     * Calculate BinHex CRC-16 (polynomial 0x1021, initial 0x0000)
     * @param {Array} data - Data bytes
     * @param {number} start - Start index
     * @param {number} length - Length of data
     * @returns {number} 16-bit CRC
     */
    calculateCRC: function(data, start = 0, length = null) {
      if (length === null) length = data.length - start;
      
      let crc = 0x0000;
      const polynomial = 0x1021;
      
      for (let i = start; i < start + length; i++) {
        crc ^= (data[i] << 8);
        
        for (let bit = 0; bit < 8; bit++) {
          if (crc & 0x8000) {
            crc = ((crc << 1) ^ polynomial) & 0xFFFF;
          } else {
            crc = (crc << 1) & 0xFFFF;
          }
        }
      }
      
      return crc;
    },
    
    /**
     * Apply run-length encoding
     * @param {Array} data - Input data
     * @returns {Array} RLE encoded data
     */
    runLengthEncode: function(data) {
      const encoded = [];
      let i = 0;
      
      while (i < data.length) {
        const currentByte = data[i];
        let count = 1;
        
        // Count consecutive identical bytes
        while (i + count < data.length && data[i + count] === currentByte && count < 255) {
          count++;
        }
        
        if (count === 1) {
          // Single byte
          encoded.push(currentByte);
          if (currentByte === 0x90) {
            // Escape marker byte
            encoded.push(0x00);
          }
        } else if (count === 2) {
          // Two identical bytes - just output them
          encoded.push(currentByte, currentByte);
          if (currentByte === 0x90) {
            // Escape both marker bytes
            encoded.push(0x00, 0x00);
          }
        } else {
          // Three or more - use RLE
          encoded.push(currentByte, 0x90, count);
        }
        
        i += count;
      }
      
      return encoded;
    },
    
    /**
     * Decode run-length encoding
     * @param {Array} data - RLE encoded data
     * @returns {Array} Decoded data
     */
    runLengthDecode: function(data) {
      const decoded = [];
      let i = 0;
      
      while (i < data.length) {
        const byte = data[i];
        
        if (byte === 0x90 && i + 1 < data.length) {
          const next = data[i + 1];
          if (next === 0x00) {
            // Escaped 0x90
            decoded.push(0x90);
            i += 2;
          } else {
            // RLE sequence - previous byte repeated 'next' times
            const prevByte = decoded[decoded.length - 1];
            for (let j = 1; j < next; j++) {
              decoded.push(prevByte);
            }
            i += 2;
          }
        } else {
          decoded.push(byte);
          i++;
        }
      }
      
      return decoded;
    },
    
    /**
     * Encode binary data to BinHex 4.0 format
     * @param {number} mode - Encoding mode (0 = encode)
     * @param {string|Array} data - Input data to encode
     * @returns {string} BinHex 4.0 encoded text
     */
    encryptBlock: function(mode, data) {
      if (mode !== 0) {
        throw new Error('BinHex: Invalid mode for encoding');
      }
      
      // Convert input to byte array
      let bytes;
      if (typeof data === 'string') {
        bytes = OpCodes.StringToBytes(data);
      } else if (Array.isArray(data)) {
        bytes = data.slice();
      } else {
        throw new Error('BinHex: Invalid input data type');
      }
      
      // Build header
      const header = [];
      
      // Filename length and name
      const filenameBytes = OpCodes.StringToBytes(this.filename);
      header.push(filenameBytes.length);
      header.push(...filenameBytes);
      header.push(0); // Null terminator
      
      // File type (4 bytes)
      header.push(...OpCodes.StringToBytes(this.fileType.padEnd(4, ' ').substring(0, 4)));
      
      // File creator (4 bytes)  
      header.push(...OpCodes.StringToBytes(this.fileCreator.padEnd(4, ' ').substring(0, 4)));
      
      // Flags (2 bytes) - default 0
      header.push(0, 0);
      
      // Data fork length (4 bytes, big-endian)
      const dataLength = bytes.length;
      header.push((dataLength >>> 24) & 0xFF, (dataLength >>> 16) & 0xFF, 
                  (dataLength >>> 8) & 0xFF, dataLength & 0xFF);
      
      // Resource fork length (4 bytes) - 0 for simple encoding
      header.push(0, 0, 0, 0);
      
      // Calculate header CRC
      const headerCRC = this.calculateCRC(header);
      header.push((headerCRC >>> 8) & 0xFF, headerCRC & 0xFF);
      
      // Calculate data CRC
      const dataCRC = this.calculateCRC(bytes);
      const dataWithCRC = bytes.concat([(dataCRC >>> 8) & 0xFF, dataCRC & 0xFF]);
      
      // No resource fork, so just add empty resource CRC
      const resourceCRC = 0;
      const resourceWithCRC = [(resourceCRC >>> 8) & 0xFF, resourceCRC & 0xFF];
      
      // Combine all parts
      const combined = header.concat(dataWithCRC, resourceWithCRC);
      
      // Apply run-length encoding
      const rleEncoded = this.runLengthEncode(combined);
      
      // Apply 6-bit encoding
      const encoded = this.encode6Bit(rleEncoded);
      
      // Format output with standard BinHex structure
      let result = '(This file must be converted with BinHex 4.0)\\n\\n:';
      
      // Add encoded data in 64-character lines
      for (let i = 0; i < encoded.length; i += 64) {
        result += encoded.substring(i, i + 64) + '\\n';
      }
      
      result += ':';
      
      return result;
    },
    
    /**
     * Encode bytes to 6-bit BinHex alphabet
     * @param {Array} data - Input bytes
     * @returns {string} 6-bit encoded string
     */
    encode6Bit: function(data) {
      let result = '';
      let buffer = 0;
      let bitsInBuffer = 0;
      
      for (const byte of data) {
        buffer = (buffer << 8) | byte;
        bitsInBuffer += 8;
        
        while (bitsInBuffer >= 6) {
          const index = (buffer >>> (bitsInBuffer - 6)) & 0x3F;
          result += this.alphabet[index];
          bitsInBuffer -= 6;
        }
      }
      
      // Handle remaining bits
      if (bitsInBuffer > 0) {
        const index = (buffer << (6 - bitsInBuffer)) & 0x3F;
        result += this.alphabet[index];
      }
      
      return result;
    },
    
    /**
     * Decode BinHex 4.0 format to binary data
     * @param {number} mode - Decoding mode (0 = decode)
     * @param {string} data - BinHex encoded text
     * @returns {Array} Decoded byte array
     */
    decryptBlock: function(mode, data) {
      if (mode !== 0) {
        throw new Error('BinHex: Invalid mode for decoding');
      }
      
      if (typeof data !== 'string' || data.length === 0) {
        return [];
      }
      
      // Extract encoded portion between colons
      const startMarker = data.indexOf(':');
      const endMarker = data.lastIndexOf(':');
      
      if (startMarker === -1 || endMarker === -1 || startMarker === endMarker) {
        throw new Error('BinHex: Invalid format - missing colon markers');
      }
      
      const encodedData = data.substring(startMarker + 1, endMarker)
        .replace(/\\s/g, ''); // Remove whitespace
      
      // Decode from 6-bit alphabet
      const decoded6Bit = this.decode6Bit(encodedData);
      
      // Decode run-length encoding
      const rleDecoded = this.runLengthDecode(decoded6Bit);
      
      // Parse header to find data fork
      let pos = 0;
      
      // Skip filename
      const filenameLength = rleDecoded[pos++];
      pos += filenameLength + 1; // +1 for null terminator
      
      // Skip file type and creator (8 bytes)
      pos += 8;
      
      // Skip flags (2 bytes)
      pos += 2;
      
      // Read data fork length
      const dataLength = (rleDecoded[pos] << 24) | (rleDecoded[pos + 1] << 16) |
                        (rleDecoded[pos + 2] << 8) | rleDecoded[pos + 3];
      pos += 4;
      
      // Skip resource fork length (4 bytes)
      pos += 4;
      
      // Skip header CRC (2 bytes)
      pos += 2;
      
      // Extract data fork (excluding CRC)
      return rleDecoded.slice(pos, pos + dataLength);
    },
    
    /**
     * Decode 6-bit BinHex alphabet to bytes
     * @param {string} data - 6-bit encoded string
     * @returns {Array} Decoded bytes
     */
    decode6Bit: function(data) {
      if (!this.decodeTable) {
        this.Init();
      }
      
      const bytes = [];
      let buffer = 0;
      let bitsInBuffer = 0;
      
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        const value = this.decodeTable[char];
        
        if (value === -1) {
          throw new Error('BinHex: Invalid character: ' + data[i]);
        }
        
        buffer = (buffer << 6) | value;
        bitsInBuffer += 6;
        
        if (bitsInBuffer >= 8) {
          bytes.push((buffer >>> (bitsInBuffer - 8)) & 0xFF);
          bitsInBuffer -= 8;
        }
      }
      
      return bytes;
    },
    
    /**
     * Clear sensitive data
     */
    ClearData: function() {
      this.filename = 'data.bin';
      this.fileType = 'TEXT';
      this.fileCreator = 'UNIX';
    },
    
    /**
     * Get cipher information
     * @returns {Object} Cipher information
     */
    GetInfo: function() {
      return {
        name: this.name,
        version: this.version,
        type: 'Encoding',
        blockSize: '3 bytes → 4 characters',
        keySize: 'File metadata',
        description: 'BinHex 4.0 encoding for Macintosh file transfer',
        features: ['Run-length encoding', 'CRC protection', 'File fork handling'],
        standard: 'BinHex 4.0 specification',
        inventor: 'Yves Lempereur (1985)',
        applications: ['Classic Mac OS email', 'File archiving', 'Cross-platform transfer']
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(BinHex);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BinHex;
  }
  
  // Make available globally
  global.BinHex = BinHex;
  
})(typeof global !== 'undefined' ? global : window);