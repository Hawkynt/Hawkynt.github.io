#!/usr/bin/env node
/*
 * Universal LZ4 Compression/Decompression (Basic Implementation)
 * Based on LZ4 Block Format specification by Yann Collet
 * Compatible with both Browser and Node.js environments
 * 
 * LZ4 is a lossless data compression algorithm focused on compression
 * and decompression speed. It belongs to the LZ77 family and uses
 * dictionary matching without entropy coding.
 * 
 * References:
 * - LZ4 Block Format specification (GitHub: lz4/lz4)
 * - LZ4 Frame Format specification
 * 
 * Note: This is a simplified educational implementation.
 * Use the official LZ4 library for production systems.
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
  
  const LZ4 = {
    internalName: 'lz4',
    name: 'LZ4 Compression',
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

    
    // LZ4 constants
    MIN_MATCH: 4,        // Minimum match length
    MAX_DISTANCE: 65536, // Maximum backward distance (64KB)
    HASH_SIZE: 65536,    // Hash table size
    
    /**
     * Initialize the compressor
     */
    Init: function() {
      // No initialization required
    },
    
    /**
     * Set up compression parameters
     * @param {Object} key - Configuration options
     */
    KeySetup: function(key) {
      // LZ4 has no configurable keys in basic implementation
    },
    
    /**
     * Compress or decompress data
     * @param {number} mode - Operation mode (0 = compress, 1 = decompress)
     * @param {string|Array} data - Input data
     * @returns {Array|string} Compressed/decompressed data
     */
    encryptBlock: function(mode, data) {
      if (mode === 0) {
        return this.compress(data);
      } else if (mode === 1) {
        return this.decompress(data);
      } else {
        throw new Error('LZ4: Invalid mode');
      }
    },
    
    /**
     * Alias for szEncryptBlock (compression doesn't "decrypt")
     */
    decryptBlock: function(mode, data) {
      return this.encryptBlock(mode, data);
    },
    
    /**
     * Compress data using LZ4 algorithm
     * @param {string|Array} data - Input data
     * @returns {Array} Compressed data
     */
    compress: function(data) {
      // Convert input to byte array
      let input;
      if (typeof data === 'string') {
        input = OpCodes.StringToBytes(data);
      } else if (Array.isArray(data)) {
        input = data.slice();
      } else {
        throw new Error('LZ4: Invalid input data type');
      }
      
      if (input.length === 0) {
        return [];
      }
      
      const output = [];
      const hashTable = new Array(this.HASH_SIZE).fill(-1);
      let pos = 0;
      
      while (pos < input.length) {
        // Find the longest match
        const match = this.findMatch(input, pos, hashTable);
        
        if (match.length >= this.MIN_MATCH && match.distance <= this.MAX_DISTANCE) {
          // Encode match
          this.encodeMatch(output, match.literalLength, match.length, match.distance);
          
          // Copy literals before match
          for (let i = 0; i < match.literalLength; i++) {
            output.push(input[pos - match.literalLength + i]);
          }
          
          pos += match.length;
        } else {
          // No good match found, treat as literal
          const literalStart = pos - (match.literalLength || 0);
          const literalEnd = Math.min(pos + 1, input.length);
          const literalLength = literalEnd - literalStart;
          
          // Encode literals only
          this.encodeLiterals(output, literalLength);
          
          // Copy literals
          for (let i = literalStart; i < literalEnd; i++) {
            output.push(input[i]);
          }
          
          pos = literalEnd;
        }
        
        // Update hash table
        this.updateHashTable(input, Math.max(0, pos - 4), pos, hashTable);
      }
      
      return output;
    },
    
    /**
     * Decompress LZ4 compressed data
     * @param {Array} data - Compressed data
     * @returns {Array} Decompressed data
     */
    decompress: function(data) {
      if (!Array.isArray(data) || data.length === 0) {
        return [];
      }
      
      const output = [];
      let pos = 0;
      
      while (pos < data.length) {
        // Read token
        const token = data[pos++];
        const literalLength = this.decodeLiteralLength(data, pos, token);
        pos += this.getLengthBytes(literalLength.extraBytes);
        
        // Copy literals
        for (let i = 0; i < literalLength.value; i++) {
          if (pos >= data.length) break;
          output.push(data[pos++]);
        }
        
        if (pos >= data.length) break;
        
        // Read match offset (little-endian)
        if (pos + 1 >= data.length) break;
        const offset = data[pos] | (data[pos + 1] << 8);
        pos += 2;
        
        // Read match length
        const matchLength = this.decodeMatchLength(data, pos, token);
        pos += this.getLengthBytes(matchLength.extraBytes);
        
        // Copy match
        const matchStart = output.length - offset;
        if (matchStart >= 0) {
          for (let i = 0; i < matchLength.value; i++) {
            output.push(output[matchStart + i]);
          }
        }
      }
      
      return output;
    },
    
    /**
     * Find the best match for current position
     * @param {Array} input - Input data
     * @param {number} pos - Current position
     * @param {Array} hashTable - Hash table for fast lookup
     * @returns {Object} Match information
     */
    findMatch: function(input, pos, hashTable) {
      if (pos + this.MIN_MATCH > input.length) {
        return { length: 0, distance: 0, literalLength: input.length - pos };
      }
      
      // Calculate hash for current position
      const hash = this.calculateHash(input, pos);
      const candidatePos = hashTable[hash];
      
      // Update hash table
      hashTable[hash] = pos;
      
      if (candidatePos === -1 || pos - candidatePos > this.MAX_DISTANCE) {
        return { length: 0, distance: 0, literalLength: 1 };
      }
      
      // Check for match
      let matchLength = 0;
      const maxLength = Math.min(255 + this.MIN_MATCH, input.length - pos);
      
      while (matchLength < maxLength && 
             pos + matchLength < input.length &&
             candidatePos + matchLength < pos &&
             input[pos + matchLength] === input[candidatePos + matchLength]) {
        matchLength++;
      }
      
      if (matchLength >= this.MIN_MATCH) {
        return {
          length: matchLength,
          distance: pos - candidatePos,
          literalLength: 0
        };
      }
      
      return { length: 0, distance: 0, literalLength: 1 };
    },
    
    /**
     * Calculate hash for 4 bytes at position
     * @param {Array} input - Input data
     * @param {number} pos - Position
     * @returns {number} Hash value
     */
    calculateHash: function(input, pos) {
      if (pos + 3 >= input.length) return 0;
      
      const value = (input[pos] << 24) | (input[pos + 1] << 16) | 
                   (input[pos + 2] << 8) | input[pos + 3];
      return (value * 2654435761) >>> 16; // Simple hash function
    },
    
    /**
     * Update hash table with recent positions
     */
    updateHashTable: function(input, start, end, hashTable) {
      for (let i = start; i < end && i + 3 < input.length; i++) {
        const hash = this.calculateHash(input, i);
        hashTable[hash] = i;
      }
    },
    
    /**
     * Encode match in LZ4 format
     */
    encodeMatch: function(output, literalLength, matchLength, distance) {
      // Create token (4 bits literal length + 4 bits match length)
      const litLen = Math.min(literalLength, 15);
      const matLen = Math.min(matchLength - this.MIN_MATCH, 15);
      const token = (litLen << 4) | matLen;
      
      output.push(token);
      
      // Encode extended literal length
      if (literalLength >= 15) {
        this.encodeLength(output, literalLength - 15);
      }
    },
    
    /**
     * Encode literals only
     */
    encodeLiterals: function(output, literalLength) {
      const litLen = Math.min(literalLength, 15);
      const token = litLen << 4; // No match length
      
      output.push(token);
      
      if (literalLength >= 15) {
        this.encodeLength(output, literalLength - 15);
      }
    },
    
    /**
     * Encode variable-length integer
     */
    encodeLength: function(output, length) {
      while (length >= 255) {
        output.push(255);
        length -= 255;
      }
      output.push(length);
    },
    
    /**
     * Decode literal length from token and data
     */
    decodeLiteralLength: function(data, pos, token) {
      let length = (token >>> 4) & 0x0F;
      let extraBytes = 0;
      
      if (length === 15) {
        while (pos + extraBytes < data.length && data[pos + extraBytes] === 255) {
          length += 255;
          extraBytes++;
        }
        if (pos + extraBytes < data.length) {
          length += data[pos + extraBytes];
          extraBytes++;
        }
      }
      
      return { value: length, extraBytes: extraBytes };
    },
    
    /**
     * Decode match length from token and data
     */
    decodeMatchLength: function(data, pos, token) {
      let length = (token & 0x0F) + this.MIN_MATCH;
      let extraBytes = 0;
      
      if ((token & 0x0F) === 15) {
        while (pos + extraBytes < data.length && data[pos + extraBytes] === 255) {
          length += 255;
          extraBytes++;
        }
        if (pos + extraBytes < data.length) {
          length += data[pos + extraBytes];
          extraBytes++;
        }
      }
      
      return { value: length, extraBytes: extraBytes };
    },
    
    /**
     * Get number of bytes used for length encoding
     */
    getLengthBytes: function(extraBytes) {
      return extraBytes;
    },
    
    /**
     * Clear sensitive data
     */
    ClearData: function() {
      // No sensitive data to clear
    },
    
    /**
     * Get cipher information
     * @returns {Object} Cipher information
     */
    GetInfo: function() {
      return {
        name: this.name,
        version: this.version,
        type: 'Compression',
        blockSize: 'Variable',
        keySize: 'None',
        description: 'LZ4 fast compression algorithm (educational implementation)',
        algorithm: 'LZ77 dictionary matching',
        features: ['Fast compression', 'Fast decompression', 'Low memory usage'],
        inventor: 'Yann Collet',
        applications: ['Real-time compression', 'Database storage', 'Network protocols']
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(LZ4);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LZ4;
  }
  
  // Make available globally
  global.LZ4 = LZ4;
  
})(typeof global !== 'undefined' ? global : window);