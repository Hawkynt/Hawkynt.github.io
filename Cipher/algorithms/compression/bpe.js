/*
 * Universal Byte-Pair Encoding (BPE)
 * Compatible with both Browser and Node.js environments
 * Educational implementation of Philip Gage's pair replacement algorithm
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
  
  const BPE = {
    internalName: 'BPE',
    name: 'Byte-Pair Encoding',
    comment: 'Philip Gage pair replacement algorithm - simple and effective compression',
    category: 'Simple',
    instances: {},
    isInitialized: false,
    
    /**
     * Initialize the algorithm
     */
    Init: function() {
      this.isInitialized = true;
      console.log('Byte-Pair Encoding algorithm initialized');
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
        lastOutputSize: 0,
        dictionary: {},
        maxIterations: 256 // Limit iterations to prevent infinite loops
      };
      return id;
    },
    
    /**
     * Compress data using Byte-Pair Encoding
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
      let workingData = this._stringToBytes(data);
      instance.dictionary = {};
      
      let replacementCode = 256; // Start after regular byte values
      let iteration = 0;
      
      // Iteratively find and replace most frequent byte pairs
      while (iteration < instance.maxIterations) {
        // Find most frequent byte pair
        const pairCounts = this._countBytePairs(workingData);
        
        if (Object.keys(pairCounts).length === 0) {
          break; // No pairs found
        }
        
        // Find most frequent pair
        let maxCount = 0;
        let bestPair = null;
        
        for (const [pair, count] of Object.entries(pairCounts)) {
          if (count > maxCount && count > 1) { // Only replace if appears more than once
            maxCount = count;
            bestPair = pair;
          }
        }
        
        if (!bestPair || maxCount <= 1) {
          break; // No beneficial replacements found
        }
        
        // Parse the pair
        const [byte1, byte2] = bestPair.split(',').map(x => parseInt(x));
        
        // Replace all occurrences of the pair
        const newData = [];
        let i = 0;
        let replacements = 0;
        
        while (i < workingData.length) {
          if (i < workingData.length - 1 && 
              workingData[i] === byte1 && 
              workingData[i + 1] === byte2) {
            // Found pair, replace with new code
            newData.push(replacementCode);
            i += 2;
            replacements++;
          } else {
            // Copy single byte
            newData.push(workingData[i]);
            i++;
          }
        }
        
        // Only accept replacement if it actually saves space
        if (newData.length < workingData.length) {
          // Store replacement in dictionary
          instance.dictionary[replacementCode] = [byte1, byte2];
          workingData = newData;
          replacementCode++;
          
          // Stop if we've used all available codes
          if (replacementCode > 65535) break;
        } else {
          break; // No more beneficial replacements
        }
        
        iteration++;
      }
      
      // Create compressed format: [DictSize][Dictionary][CompressedData]
      const compressed = this._packCompressedData(instance.dictionary, workingData);
      
      // Update statistics
      instance.lastInputSize = data.length;
      instance.lastOutputSize = compressed.length;
      instance.compressionRatio = data.length / compressed.length;
      
      return compressed;
    },
    
    /**
     * Decompress BPE-encoded data
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
      
      // Unpack compressed data
      const { dictionary, data } = this._unpackCompressedData(compressedData);
      
      // Expand using dictionary (reverse order of compression)
      let workingData = [...data];
      
      // Get replacement codes in reverse order (highest to lowest)
      const replacementCodes = Object.keys(dictionary)
        .map(x => parseInt(x))
        .sort((a, b) => b - a);
      
      // Apply replacements in reverse order
      for (const code of replacementCodes) {
        const replacement = dictionary[code];
        const newData = [];
        
        for (const byte of workingData) {
          if (byte === code) {
            // Replace code with original pair
            newData.push(...replacement);
          } else {
            newData.push(byte);
          }
        }
        
        workingData = newData;
      }
      
      return this._bytesToString(workingData);
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
     * Count occurrences of all byte pairs
     * @private
     */
    _countBytePairs: function(data) {
      const pairCounts = {};
      
      for (let i = 0; i < data.length - 1; i++) {
        const pair = `${data[i]},${data[i + 1]}`;
        pairCounts[pair] = (pairCounts[pair] || 0) + 1;
      }
      
      return pairCounts;
    },
    
    /**
     * Pack compressed data with dictionary
     * @private
     */
    _packCompressedData: function(dictionary, data) {
      const bytes = [];
      
      // Dictionary size (2 bytes, big-endian)
      const dictSize = Object.keys(dictionary).length;
      bytes.push((dictSize >>> 8) & 0xFF);
      bytes.push(dictSize & 0xFF);
      
      // Dictionary entries: [Code(2 bytes)][Byte1][Byte2]
      for (const [code, replacement] of Object.entries(dictionary)) {
        const codeNum = parseInt(code);
        bytes.push((codeNum >>> 8) & 0xFF);
        bytes.push(codeNum & 0xFF);
        bytes.push(replacement[0] & 0xFF);
        bytes.push(replacement[1] & 0xFF);
      }
      
      // Data length (4 bytes, big-endian)
      const dataLength = data.length;
      bytes.push((dataLength >>> 24) & 0xFF);
      bytes.push((dataLength >>> 16) & 0xFF);
      bytes.push((dataLength >>> 8) & 0xFF);
      bytes.push(dataLength & 0xFF);
      
      // Compressed data (may contain codes > 255, so use 2 bytes per value)
      for (const value of data) {
        bytes.push((value >>> 8) & 0xFF);
        bytes.push(value & 0xFF);
      }
      
      return this._bytesToString(bytes);
    },
    
    /**
     * Unpack compressed data
     * @private
     */
    _unpackCompressedData: function(compressedData) {
      const bytes = this._stringToBytes(compressedData);
      
      if (bytes.length < 6) {
        throw new Error('Invalid BPE compressed data: too short');
      }
      
      let pos = 0;
      
      // Read dictionary size
      const dictSize = (bytes[pos] << 8) | bytes[pos + 1];
      pos += 2;
      
      // Read dictionary
      const dictionary = {};
      for (let i = 0; i < dictSize; i++) {
        if (pos + 4 > bytes.length) {
          throw new Error('Invalid BPE compressed data: incomplete dictionary');
        }
        
        const code = (bytes[pos] << 8) | bytes[pos + 1];
        const byte1 = bytes[pos + 2];
        const byte2 = bytes[pos + 3];
        
        dictionary[code] = [byte1, byte2];
        pos += 4;
      }
      
      // Read data length
      if (pos + 4 > bytes.length) {
        throw new Error('Invalid BPE compressed data: missing data length');
      }
      
      const dataLength = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | 
                        (bytes[pos + 2] << 8) | bytes[pos + 3];
      pos += 4;
      
      // Read compressed data
      const data = [];
      for (let i = 0; i < dataLength; i++) {
        if (pos + 2 > bytes.length) {
          throw new Error('Invalid BPE compressed data: incomplete data');
        }
        
        const value = (bytes[pos] << 8) | bytes[pos + 1];
        data.push(value);
        pos += 2;
      }
      
      return { dictionary, data };
    },
    
    /**
     * Get compression statistics for instance
     */
    GetStats: function(keyId) {
      const instance = this.instances[keyId];
      if (!instance) {
        throw new Error('Invalid instance ID');
      }
      
      return {
        inputSize: instance.lastInputSize,
        outputSize: instance.lastOutputSize,
        compressionRatio: instance.compressionRatio,
        spaceSavings: ((instance.lastInputSize - instance.lastOutputSize) / instance.lastInputSize * 100).toFixed(2) + '%',
        dictionarySize: Object.keys(instance.dictionary).length,
        maxIterations: instance.maxIterations,
        description: 'Replaces most frequent byte pairs iteratively - simple but effective'
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
    BPE.Init();
    global.Compression.AddAlgorithm(BPE);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BPE;
  }
  
  // Make globally available
  global.BPE = BPE;
  
})(typeof global !== 'undefined' ? global : window);