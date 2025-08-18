#!/usr/bin/env node
/*
 * Universal UUencoding Encoder/Decoder
 * Based on POSIX IEEE Std 1003.1-2017 specification
 * Compatible with both Browser and Node.js environments
 * 
 * UUencoding is a binary-to-text encoding developed by Mary Ann Horton
 * at UC Berkeley in 1980. It encodes 3 bytes into 4 characters using
 * a 64-character alphabet with space (0x20) offset.
 * 
 * References:
 * - POSIX IEEE Std 1003.1-2017 (uuencode utility)
 * - Original Unix-to-Unix Copy (UUCP) specification
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
  
  const UUEncode = {
    internalName: 'uuencode',
    name: 'UUencoding (Unix-to-Unix)',
    version: '1.0.0',
        comment: 'Educational implementation for learning purposes',
    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,

    
    // UU alphabet: characters 0x20-0x5F (space to underscore)
    alphabet: ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_',
    
    // Default file parameters
    filename: 'data.bin',
    mode: '644',
    
    /**
     * Initialize the cipher
     */
    Init: function() {
      this.filename = 'data.bin';
      this.mode = '644';
    },
    
    /**
     * Set up file parameters
     * @param {string|Object} key - Filename or {filename: string, mode: string}
     */
    KeySetup: function(key) {
      if (typeof key === 'string') {
        this.filename = key;
        this.mode = '644';
      } else if (typeof key === 'object' && key !== null) {
        this.filename = key.filename || 'data.bin';
        this.mode = key.mode || '644';
      } else {
        this.filename = 'data.bin';
        this.mode = '644';
      }
    },
    
    /**
     * Encode binary data to UUencoded text
     * @param {number} mode - Encoding mode (0 = encode)
     * @param {string|Array} data - Input data to encode
     * @returns {string} UUencoded text with headers
     */
    encryptBlock: function(mode, data) {
      if (mode !== 0) {
        throw new Error('UUencode: Invalid mode for encoding');
      }
      
      // Convert input to byte array
      let bytes;
      if (typeof data === 'string') {
        bytes = OpCodes.StringToBytes(data);
      } else if (Array.isArray(data)) {
        bytes = data.slice();
      } else {
        throw new Error('UUencode: Invalid input data type');
      }
      
      if (bytes.length === 0) {
        return 'begin ' + this.mode + ' ' + this.filename + '\\n`\\nend\\n';
      }
      
      let result = 'begin ' + this.mode + ' ' + this.filename + '\\n';
      
      // Process data in 45-byte lines (standard UU line length)
      for (let lineStart = 0; lineStart < bytes.length; lineStart += 45) {
        const lineBytes = bytes.slice(lineStart, lineStart + 45);
        const lineLength = lineBytes.length;
        
        // Add line length character (length + 0x20)
        result += this.alphabet[lineLength];
        
        // Process line in 3-byte groups
        for (let i = 0; i < lineBytes.length; i += 3) {
          const group = lineBytes.slice(i, i + 3);
          
          // Pad group to 3 bytes if necessary
          while (group.length < 3) {
            group.push(0);
          }
          
          // Convert 3 bytes to 24-bit value
          const value = (group[0] << 16) | (group[1] << 8) | group[2];
          
          // Extract four 6-bit values
          const c1 = (value >>> 18) & 0x3F;
          const c2 = (value >>> 12) & 0x3F;
          const c3 = (value >>> 6) & 0x3F;
          const c4 = value & 0x3F;
          
          // Convert to characters (add 0x20, map 0x20 to grave accent)
          result += this.encodeChar(c1);
          result += this.encodeChar(c2);
          
          // Only add remaining characters if we have actual data
          const actualBytes = Math.min(3, lineBytes.length - i);
          if (actualBytes >= 2) result += this.encodeChar(c3);
          if (actualBytes >= 3) result += this.encodeChar(c4);
        }
        
        result += '\\n';
      }
      
      // Add end marker
      result += '`\\nend\\n';
      
      return result;
    },
    
    /**
     * Decode UUencoded text to binary data
     * @param {number} mode - Decoding mode (0 = decode)
     * @param {string} data - UUencoded text to decode
     * @returns {Array} Decoded byte array
     */
    decryptBlock: function(mode, data) {
      if (mode !== 0) {
        throw new Error('UUencode: Invalid mode for decoding');
      }
      
      if (typeof data !== 'string' || data.length === 0) {
        return [];
      }
      
      // Split into lines and remove Windows line endings
      const lines = data.replace(/\\r\\n/g, '\\n').split('\\n');
      const bytes = [];
      let foundBegin = false;
      let foundEnd = false;
      
      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum].trim();
        
        // Skip empty lines
        if (line.length === 0) continue;
        
        // Handle begin line
        if (line.startsWith('begin ')) {
          foundBegin = true;
          const parts = line.split(' ');
          if (parts.length >= 3) {
            this.mode = parts[1];
            this.filename = parts.slice(2).join(' ');
          }
          continue;
        }
        
        // Handle end line
        if (line === 'end') {
          foundEnd = true;
          break;
        }
        
        // Skip lines before begin
        if (!foundBegin) continue;
        
        // Decode data line
        if (line.length > 0) {
          const lineLength = this.decodeChar(line[0]);
          
          // Handle empty line (length 0)
          if (lineLength === 0) continue;
          
          // Decode line data
          let lineData = line.substring(1);
          let bytesDecoded = 0;
          
          // Process in 4-character groups
          for (let i = 0; i < lineData.length && bytesDecoded < lineLength; i += 4) {
            const group = lineData.substring(i, i + 4);
            
            if (group.length < 2) break;
            
            // Decode 4 characters to 6-bit values
            const c1 = this.decodeChar(group[0]);
            const c2 = this.decodeChar(group[1]);
            const c3 = group.length > 2 ? this.decodeChar(group[2]) : 0;
            const c4 = group.length > 3 ? this.decodeChar(group[3]) : 0;
            
            // Combine to 24-bit value
            const value = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;
            
            // Extract bytes
            if (bytesDecoded < lineLength) {
              bytes.push((value >>> 16) & 0xFF);
              bytesDecoded++;
            }
            if (bytesDecoded < lineLength) {
              bytes.push((value >>> 8) & 0xFF);
              bytesDecoded++;
            }
            if (bytesDecoded < lineLength) {
              bytes.push(value & 0xFF);
              bytesDecoded++;
            }
          }
        }
      }
      
      if (!foundBegin) {
        throw new Error('UUencode: Missing begin line');
      }
      
      return bytes;
    },
    
    /**
     * Encode a 6-bit value to UU character
     * @param {number} value - 6-bit value (0-63)
     * @returns {string} UU character
     */
    encodeChar: function(value) {
      // Space (0x20) is encoded as grave accent (0x60)
      return value === 0 ? '`' : this.alphabet[value];
    },
    
    /**
     * Decode UU character to 6-bit value
     * @param {string} char - UU character
     * @returns {number} 6-bit value (0-63)
     */
    decodeChar: function(char) {
      // Grave accent represents space (value 0)
      if (char === '`') return 0;
      
      const value = this.alphabet.indexOf(char);
      if (value === -1) {
        throw new Error('UUencode: Invalid character: ' + char);
      }
      return value;
    },
    
    /**
     * Clear sensitive data
     */
    ClearData: function() {
      this.filename = 'data.bin';
      this.mode = '644';
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
        keySize: 'Filename and mode',
        description: 'POSIX UUencoding for binary file transfer',
        standard: 'IEEE Std 1003.1-2017',
        lineLength: '45 bytes (60 characters)',
        inventor: 'Mary Ann Horton (UC Berkeley, 1980)'
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(UUEncode);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = UUEncode;
  }
  
  // Make available globally
  global.UUEncode = UUEncode;
  
})(typeof global !== 'undefined' ? global : window);