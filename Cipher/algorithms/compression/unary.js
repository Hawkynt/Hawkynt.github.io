/*
 * Universal Unary Coding
 * Compatible with both Browser and Node.js environments
 * Educational implementation of simple unary integer representation
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Load dependencies
  if (!global.Compression && typeof require !== 'undefined') {
    try {
      require('../../compression.js');
    } catch (e) {
      console.error('Failed to load compression framework:', e.message);
      return;
    }
  }
  
  const Unary = {
    internalName: 'Unary',
    name: 'Unary Coding',
    comment: 'Simple unary integer representation - N zeros followed by one 1',
    category: 'Universal',
    instances: {},
    isInitialized: false,
    
    MAX_VALUE: 1000, // Limit to prevent excessive expansion
    
    /**
     * Initialize the algorithm
     */
    Init: function() {
      this.isInitialized = true;
      console.log('Unary coding algorithm initialized');
    },
    
    /**
     * Create a new instance
     */
    KeySetup: function() {
      const id = this.internalName + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
      this.instances[id] = {
        initialized: true,
        compressionRatio: 0,
        lastInputSize: 0,
        lastOutputSize: 0
      };
      return id;
    },
    
    /**
     * Compress data using Unary coding
     * @param {string} keyId - Instance identifier
     * @param {string} data - Input data to compress
     * @returns {string} Compressed data
     */
    Compress: function(keyId, data) {
      if (!this.instances[keyId]) {
        throw new Error('Invalid instance ID');
      }
      
      if (!data || data.length === 0) {
        return '';
      }
      
      const instance = this.instances[keyId];
      const input = this._stringToBytes(data);
      
      let bitStream = '';
      
      // Encode each byte using Unary coding
      for (const byte of input) {
        if (byte > this.MAX_VALUE) {
          throw new Error(`Value ${byte} exceeds maximum ${this.MAX_VALUE} for Unary coding`);
        }
        
        const unaryCode = this._encodeUnary(byte);
        bitStream += unaryCode;
        
        // Safety check to prevent excessive expansion
        if (bitStream.length > input.length * 8 * 10) {
          throw new Error('Unary encoding would cause excessive expansion');
        }
      }
      
      // Pack bit stream
      const compressed = this._packBitStream(bitStream, input.length);
      
      // Update statistics
      instance.lastInputSize = data.length;
      instance.lastOutputSize = compressed.length;
      instance.compressionRatio = data.length / compressed.length;
      
      return compressed;
    },
    
    /**
     * Decompress Unary-encoded data
     * @param {string} keyId - Instance identifier
     * @param {string} compressedData - Compressed data
     * @returns {string} Decompressed data
     */
    Decompress: function(keyId, compressedData) {
      if (!this.instances[keyId]) {
        throw new Error('Invalid instance ID');
      }
      
      if (!compressedData || compressedData.length === 0) {
        return '';
      }
      
      // Unpack bit stream
      const { bitStream, originalLength } = this._unpackBitStream(compressedData);
      
      const decodedBytes = [];
      let pos = 0;
      
      // Decode until we have the expected number of bytes
      while (decodedBytes.length < originalLength && pos < bitStream.length) {
        const { value, bitsConsumed } = this._decodeUnary(bitStream, pos);
        
        if (value === null) {
          throw new Error('Invalid Unary code in compressed data');
        }
        
        if (value < 0 || value > 255) {
          throw new Error('Invalid byte value in compressed data');
        }
        
        decodedBytes.push(value);
        pos += bitsConsumed;
      }
      
      if (decodedBytes.length !== originalLength) {
        throw new Error('Decompressed length mismatch');
      }
      
      return this._bytesToString(decodedBytes);
    },
    
    /**
     * Clear instance data
     */
    ClearData: function(keyId) {
      if (this.instances[keyId]) {
        delete this.instances[keyId];
        return true;
      }
      return false;
    },
    
    /**
     * Encode an integer using Unary coding
     * Format: N zeros followed by one 1 (for value N)
     * @private
     */
    _encodeUnary: function(value) {
      if (value < 0) {
        throw new Error('Unary coding can only encode non-negative integers');
      }
      
      // N zeros followed by one 1
      return '0'.repeat(value) + '1';
    },
    
    /**
     * Decode a Unary code from bit stream
     * @private
     */
    _decodeUnary: function(bitStream, startPos) {
      if (startPos >= bitStream.length) {
        return { value: null, bitsConsumed: 0 };
      }
      
      // Count zeros until we find a 1
      let zeros = 0;
      let pos = startPos;
      
      while (pos < bitStream.length && bitStream[pos] === '0') {
        zeros++;
        pos++;
        
        // Safety check
        if (zeros > this.MAX_VALUE) {
          return { value: null, bitsConsumed: 0 };
        }
      }
      
      // Check for terminating '1'
      if (pos >= bitStream.length || bitStream[pos] !== '1') {
        return { value: null, bitsConsumed: 0 };
      }
      
      // Value is the number of zeros
      return { value: zeros, bitsConsumed: zeros + 1 };
    },
    
    /**
     * Pack bit stream into bytes with header
     * @private
     */
    _packBitStream: function(bitStream, originalLength) {
      const bytes = [];
      
      // Store original length (4 bytes, big-endian)
      bytes.push((originalLength >>> 24) & 0xFF);
      bytes.push((originalLength >>> 16) & 0xFF);
      bytes.push((originalLength >>> 8) & 0xFF);
      bytes.push(originalLength & 0xFF);
      
      // Store bit stream length (4 bytes, big-endian)
      const bitLength = bitStream.length;
      bytes.push((bitLength >>> 24) & 0xFF);
      bytes.push((bitLength >>> 16) & 0xFF);
      bytes.push((bitLength >>> 8) & 0xFF);
      bytes.push(bitLength & 0xFF);
      
      // Pad bit stream to byte boundary
      const padding = (8 - (bitStream.length % 8)) % 8;
      const paddedBits = bitStream + '0'.repeat(padding);
      
      // Convert to bytes
      for (let i = 0; i < paddedBits.length; i += 8) {
        const byte = paddedBits.substr(i, 8);
        bytes.push(parseInt(byte, 2));
      }
      
      return this._bytesToString(bytes);
    },
    
    /**
     * Unpack bit stream from bytes
     * @private
     */
    _unpackBitStream: function(compressedData) {
      const bytes = this._stringToBytes(compressedData);
      
      if (bytes.length < 8) {
        throw new Error('Invalid compressed data: header too short');
      }
      
      // Read original length
      const originalLength = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
      
      // Read bit stream length
      const bitLength = (bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7];
      
      // Convert bytes back to bit stream
      let bitStream = '';
      for (let i = 8; i < bytes.length; i++) {
        bitStream += bytes[i].toString(2).padStart(8, '0');
      }
      
      // Trim to actual bit length
      bitStream = bitStream.substring(0, bitLength);
      
      return { bitStream, originalLength };
    },
    
    /**
     * Get compression statistics and example encodings
     */
    GetStats: function(keyId) {
      const instance = this.instances[keyId];
      if (!instance) {
        throw new Error('Invalid instance ID');
      }
      
      // Generate example encodings for small values
      const examples = {};
      for (let i = 0; i <= 5; i++) {
        examples[i] = this._encodeUnary(i);
      }
      
      return {
        inputSize: instance.lastInputSize,
        outputSize: instance.lastOutputSize,
        compressionRatio: instance.compressionRatio,
        spaceSavings: ((instance.lastInputSize - instance.lastOutputSize) / instance.lastInputSize * 100).toFixed(2) + '%',
        examples: examples,
        maxValue: this.MAX_VALUE,
        description: 'Simple but inefficient - only useful for very small values or as building block'
      };
    },
    
    // Utility functions
    _stringToBytes: function(str) {
      if (global.OpCodes && OpCodes.StringToBytes) {
        return OpCodes.StringToBytes(str);
      }
      
      const bytes = [];
      for (let i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i) & 0xFF);
      }
      return bytes;
    },
    
    _bytesToString: function(bytes) {
      if (global.OpCodes && OpCodes.BytesToString) {
        return OpCodes.BytesToString(bytes);
      }
      
      let str = '';
      for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
      }
      return str;
    }
  };
  
  // Auto-register with compression system
  if (global.Compression) {
    Unary.Init();
    global.Compression.AddAlgorithm(Unary);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Unary;
  }
  
  // Make globally available
  global.Unary = Unary;
  
})(typeof global !== 'undefined' ? global : window);