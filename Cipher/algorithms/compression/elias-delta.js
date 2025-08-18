/*
 * Universal Elias Delta Coding
 * Compatible with both Browser and Node.js environments
 * Educational implementation of Peter Elias's improved universal integer encoding
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
  
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes.js:', e.message);
      return;
    }
  }
  
  const EliasDelta = {
    internalName: 'EliasDelta',
    name: 'Elias Delta Coding',
    comment: 'Peter Elias improved universal integer encoding - more efficient for larger numbers',
    category: 'Universal',
    instances: {},
    isInitialized: false,
    
    /**
     * Initialize the algorithm
     */
    Init: function() {
      this.isInitialized = true;
      console.log('Elias Delta coding algorithm initialized');
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
     * Compress data using Elias Delta coding
     * Treats input as sequence of integers (byte values)
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
      
      // Encode each byte using Elias Delta
      for (const byte of input) {
        // Elias Delta cannot encode 0, so we use byte + 1
        const value = byte + 1;
        const deltaCode = this._encodeDelta(value);
        bitStream += deltaCode;
      }
      
      // Store original length and convert to bytes
      const compressed = this._packBitStream(bitStream, input.length);
      
      // Update statistics
      instance.lastInputSize = data.length;
      instance.lastOutputSize = compressed.length;
      instance.compressionRatio = data.length / compressed.length;
      
      return compressed;
    },
    
    /**
     * Decompress Elias Delta-encoded data
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
      
      // Unpack bit stream and get original length
      const { bitStream, originalLength } = this._unpackBitStream(compressedData);
      
      const decodedBytes = [];
      let pos = 0;
      
      // Decode until we have the expected number of bytes
      while (decodedBytes.length < originalLength && pos < bitStream.length) {
        const { value, bitsConsumed } = this._decodeDelta(bitStream, pos);
        
        if (value === null) {
          throw new Error('Invalid Elias Delta code in compressed data');
        }
        
        // Convert back to byte (subtract 1 since we added 1 during encoding)
        const byte = value - 1;
        if (byte < 0 || byte > 255) {
          throw new Error('Invalid byte value in compressed data');
        }
        
        decodedBytes.push(byte);
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
     * Encode a positive integer using Elias Delta coding
     * Format: gamma(1 + floor(log2(n))) + binary(n - 2^floor(log2(n)))
     * @private
     */
    _encodeDelta: function(value) {
      if (value <= 0) {
        throw new Error('Elias Delta can only encode positive integers');
      }
      
      // Special case for 1
      if (value === 1) {
        return '1';
      }
      
      // Calculate number of bits needed for binary representation
      const bitsNeeded = Math.floor(Math.log2(value));
      
      // Encode length using Elias Gamma (length + 1)
      const lengthCode = this._encodeGamma(bitsNeeded + 1);
      
      // Create binary representation without leading 1
      const binaryValue = value.toString(2);
      const binarySuffix = binaryValue.substring(1); // Remove leading '1'
      
      return lengthCode + binarySuffix;
    },
    
    /**
     * Decode an Elias Delta code from bit stream
     * @private
     */
    _decodeDelta: function(bitStream, startPos) {
      if (startPos >= bitStream.length) {
        return { value: null, bitsConsumed: 0 };
      }
      
      // First decode the length using Elias Gamma
      const gammaResult = this._decodeGamma(bitStream, startPos);
      if (gammaResult.value === null) {
        return { value: null, bitsConsumed: 0 };
      }
      
      const length = gammaResult.value - 1; // Subtract 1 to get actual length
      let pos = startPos + gammaResult.bitsConsumed;
      
      // Special case for length 0 (value is 1)
      if (length === 0) {
        return { value: 1, bitsConsumed: gammaResult.bitsConsumed };
      }
      
      // Read binary suffix
      if (pos + length > bitStream.length) {
        return { value: null, bitsConsumed: 0 };
      }
      
      const binarySuffix = bitStream.substring(pos, pos + length);
      const value = parseInt('1' + binarySuffix, 2);
      
      return { 
        value: value, 
        bitsConsumed: gammaResult.bitsConsumed + length 
      };
    },
    
    /**
     * Encode using Elias Gamma (helper function)
     * @private
     */
    _encodeGamma: function(value) {
      if (value <= 0) {
        throw new Error('Elias Gamma can only encode positive integers');
      }
      
      // Special case for 1
      if (value === 1) {
        return '1';
      }
      
      // Calculate number of bits needed
      const bitsNeeded = Math.floor(Math.log2(value));
      
      // Create unary prefix (bitsNeeded zeros followed by 1)
      const unaryPrefix = '0'.repeat(bitsNeeded) + '1';
      
      // Create binary suffix (value without leading 1)
      const binaryValue = value.toString(2);
      const binarySuffix = binaryValue.substring(1); // Remove leading '1'
      
      return unaryPrefix + binarySuffix;
    },
    
    /**
     * Decode Elias Gamma (helper function)
     * @private
     */
    _decodeGamma: function(bitStream, startPos) {
      if (startPos >= bitStream.length) {
        return { value: null, bitsConsumed: 0 };
      }
      
      // Count leading zeros (unary part)
      let zeros = 0;
      let pos = startPos;
      
      while (pos < bitStream.length && bitStream[pos] === '0') {
        zeros++;
        pos++;
      }
      
      // Check for terminating '1'
      if (pos >= bitStream.length || bitStream[pos] !== '1') {
        return { value: null, bitsConsumed: 0 };
      }
      
      pos++; // Skip the '1'
      
      // Read binary suffix
      if (zeros === 0) {
        // Special case: value is 1
        return { value: 1, bitsConsumed: 1 };
      }
      
      if (pos + zeros > bitStream.length) {
        return { value: null, bitsConsumed: 0 };
      }
      
      const binarySuffix = bitStream.substring(pos, pos + zeros);
      const value = parseInt('1' + binarySuffix, 2);
      
      return { value: value, bitsConsumed: zeros + 1 + zeros };
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
      
      // Generate example encodings for common values
      const examples = {};
      for (let i = 1; i <= 10; i++) {
        examples[i] = this._encodeDelta(i);
      }
      
      return {
        inputSize: instance.lastInputSize,
        outputSize: instance.lastOutputSize,
        compressionRatio: instance.compressionRatio,
        spaceSavings: ((instance.lastInputSize - instance.lastOutputSize) / instance.lastInputSize * 100).toFixed(2) + '%',
        examples: examples,
        description: 'More efficient than Gamma for larger numbers - encodes length using Gamma'
      };
    },
    
    // Utility functions using OpCodes if available
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
    EliasDelta.Init();
    global.Compression.AddAlgorithm(EliasDelta);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EliasDelta;
  }
  
  // Make globally available
  global.EliasDelta = EliasDelta;
  
})(typeof global !== 'undefined' ? global : window);