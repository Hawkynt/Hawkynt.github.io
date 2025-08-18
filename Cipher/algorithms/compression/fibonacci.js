/*
 * Universal Fibonacci Coding
 * Compatible with both Browser and Node.js environments
 * Educational implementation of Fibonacci number representation coding
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
  
  const Fibonacci = {
    internalName: 'Fibonacci',
    name: 'Fibonacci Coding',
    comment: 'Universal integer encoding using Fibonacci number representation',
    category: 'Universal',
    instances: {},
    isInitialized: false,
    
    // Pre-computed Fibonacci numbers for efficiency
    fibNumbers: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765, 10946, 17711, 28657, 46368, 75025, 121393, 196418, 317811, 514229, 832040, 1346269, 2178309, 3524578, 5702887, 9227465, 14930352, 24157817, 39088169, 63245986, 102334155, 165580141, 267914296, 433494437, 701408733, 1134903170, 1836311903],
    
    /**
     * Initialize the algorithm
     */
    Init: function() {
      this.isInitialized = true;
      console.log('Fibonacci coding algorithm initialized');
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
     * Compress data using Fibonacci coding
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
      
      // Encode each byte using Fibonacci coding
      for (const byte of input) {
        // Fibonacci coding cannot encode 0, so we use byte + 1
        const value = byte + 1;
        const fibCode = this._encodeFibonacci(value);
        bitStream += fibCode;
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
     * Decompress Fibonacci-encoded data
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
        const { value, bitsConsumed } = this._decodeFibonacci(bitStream, pos);
        
        if (value === null) {
          throw new Error('Invalid Fibonacci code in compressed data');
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
     * Encode a positive integer using Fibonacci representation
     * Format: Zeckendorf representation + trailing '1' as terminator
     * @private
     */
    _encodeFibonacci: function(value) {
      if (value <= 0) {
        throw new Error('Fibonacci coding can only encode positive integers');
      }
      
      // Find Fibonacci representation (Zeckendorf's theorem)
      const representation = [];
      let remaining = value;
      
      // Work backwards from largest Fibonacci number that fits
      for (let i = this.fibNumbers.length - 1; i >= 0; i--) {
        if (this.fibNumbers[i] <= remaining) {
          representation[i] = 1;
          remaining -= this.fibNumbers[i];
          
          if (remaining === 0) break;
        } else {
          representation[i] = 0;
        }
      }
      
      if (remaining > 0) {
        throw new Error('Value too large for Fibonacci encoding');
      }
      
      // Convert to bit string (reverse order) and add terminating '1'
      let bitString = '';
      for (let i = 0; i < representation.length; i++) {
        if (representation[i]) {
          bitString = '1' + bitString;
        } else if (bitString.length > 0) {
          bitString = '0' + bitString;
        }
      }
      
      // Add terminating '1' (this ensures no two consecutive 1s in the middle)
      return bitString + '1';
    },
    
    /**
     * Decode a Fibonacci code from bit stream
     * @private
     */
    _decodeFibonacci: function(bitStream, startPos) {
      if (startPos >= bitStream.length) {
        return { value: null, bitsConsumed: 0 };
      }
      
      // Find the terminating "11" pattern
      let pos = startPos;
      let codeLength = 0;
      
      while (pos + 1 < bitStream.length) {
        if (bitStream[pos] === '1' && bitStream[pos + 1] === '1') {
          // Found terminating pattern
          codeLength = pos - startPos + 1; // Include first '1' of "11"
          break;
        }
        pos++;
      }
      
      if (codeLength === 0) {
        return { value: null, bitsConsumed: 0 };
      }
      
      // Extract the code (without the terminating '1')
      const code = bitStream.substring(startPos, startPos + codeLength);
      
      // Decode using Fibonacci numbers
      let value = 0;
      for (let i = 0; i < code.length; i++) {
        if (code[i] === '1') {
          const fibIndex = code.length - 1 - i;
          if (fibIndex < this.fibNumbers.length) {
            value += this.fibNumbers[fibIndex];
          }
        }
      }
      
      return { 
        value: value, 
        bitsConsumed: codeLength + 1 // Include the terminating '1'
      };
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
        examples[i] = this._encodeFibonacci(i);
      }
      
      return {
        inputSize: instance.lastInputSize,
        outputSize: instance.lastOutputSize,
        compressionRatio: instance.compressionRatio,
        spaceSavings: ((instance.lastInputSize - instance.lastOutputSize) / instance.lastInputSize * 100).toFixed(2) + '%',
        examples: examples,
        maxEncodableValue: this.fibNumbers[this.fibNumbers.length - 1],
        description: 'Uses Zeckendorf representation - every positive integer has unique Fibonacci representation'
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
    Fibonacci.Init();
    global.Compression.AddAlgorithm(Fibonacci);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Fibonacci;
  }
  
  // Make globally available
  global.Fibonacci = Fibonacci;
  
})(typeof global !== 'undefined' ? global : window);