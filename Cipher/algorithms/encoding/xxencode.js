#!/usr/bin/env node
/*
 * Universal XXencoding Encoder/Decoder
 * Alternative to UUencoding with different character set
 * Compatible with both Browser and Node.js environments
 * 
 * XXencoding is similar to UUencoding but uses a different alphabet
 * designed to avoid characters that might be problematic in some
 * communication systems.
 * 
 * References:
 * - XXencode specification (alternative to UUencode)
 * - Compatible with various Unix mail systems
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
  
  const XXEncode = {
    internalName: 'xxencode',
    name: 'XXencoding',
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

    
    // XX alphabet: uses +, -, 0-9, A-Z, a-z (64 characters total)
    alphabet: '+-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    
    // Default file parameters
    filename: 'data.bin',
    
    /**
     * Initialize the cipher
     */
    Init: function() {
      this.filename = 'data.bin';
    },
    
    /**
     * Set up file parameters
     * @param {string} key - Filename
     */
    KeySetup: function(key) {
      if (typeof key === 'string') {
        this.filename = key;
      } else {
        this.filename = 'data.bin';
      }
    },
    
    /**
     * Encode binary data to XXencoded text
     * @param {number} mode - Encoding mode (0 = encode)
     * @param {string|Array} data - Input data to encode
     * @returns {string} XXencoded text with headers
     */
    encryptBlock: function(mode, data) {
      if (mode !== 0) {
        throw new Error('XXencode: Invalid mode for encoding');
      }
      
      // Convert input to byte array
      let bytes;
      if (typeof data === 'string') {
        bytes = OpCodes.StringToBytes(data);
      } else if (Array.isArray(data)) {
        bytes = data.slice();
      } else {
        throw new Error('XXencode: Invalid input data type');
      }
      
      if (bytes.length === 0) {
        return 'begin 644 ' + this.filename + '\\n+\\nend\\n';
      }
      
      let result = 'begin 644 ' + this.filename + '\\n';
      
      // Process data in 45-byte lines (standard XX line length)
      for (let lineStart = 0; lineStart < bytes.length; lineStart += 45) {
        const lineBytes = bytes.slice(lineStart, lineStart + 45);
        const lineLength = lineBytes.length;
        
        // Add line length character
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
          
          // Convert to characters
          result += this.alphabet[c1];
          result += this.alphabet[c2];
          
          // Only add remaining characters if we have actual data
          const actualBytes = Math.min(3, lineBytes.length - i);
          if (actualBytes >= 2) result += this.alphabet[c3];
          if (actualBytes >= 3) result += this.alphabet[c4];
        }
        
        result += '\\n';
      }
      
      // Add end marker
      result += '+\\nend\\n';
      
      return result;
    },
    
    /**
     * Decode XXencoded text to binary data
     * @param {number} mode - Decoding mode (0 = decode)
     * @param {string} data - XXencoded text to decode
     * @returns {Array} Decoded byte array
     */
    decryptBlock: function(mode, data) {
      if (mode !== 0) {
        throw new Error('XXencode: Invalid mode for decoding');
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
          const lineLength = this.alphabet.indexOf(line[0]);
          
          if (lineLength === -1) {
            throw new Error('XXencode: Invalid length character: ' + line[0]);
          }
          
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
            const c1 = this.alphabet.indexOf(group[0]);
            const c2 = this.alphabet.indexOf(group[1]);
            const c3 = group.length > 2 ? this.alphabet.indexOf(group[2]) : 0;
            const c4 = group.length > 3 ? this.alphabet.indexOf(group[3]) : 0;
            
            if (c1 === -1 || c2 === -1 || (group.length > 2 && c3 === -1) || 
                (group.length > 3 && c4 === -1)) {
              throw new Error('XXencode: Invalid character in line: ' + group);
            }
            
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
        throw new Error('XXencode: Missing begin line');
      }
      
      return bytes;
    },
    
    /**
     * Clear sensitive data
     */
    ClearData: function() {
      this.filename = 'data.bin';
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
        keySize: 'Filename',
        description: 'XXencoding - alternative to UUencoding with different alphabet',
        alphabet: this.alphabet,
        lineLength: '45 bytes (60 characters)',
        features: ['Compatible with email', 'Avoids problematic characters', 'File metadata'],
        applications: ['Email attachments', 'Binary file transfer', 'Newsgroup postings']
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(XXEncode);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = XXEncode;
  }
  
  // Make available globally
  global.XXEncode = XXEncode;
  
})(typeof global !== 'undefined' ? global : window);