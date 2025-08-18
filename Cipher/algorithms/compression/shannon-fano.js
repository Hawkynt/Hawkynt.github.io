/*
 * Universal Shannon-Fano Coding
 * Compatible with both Browser and Node.js environments
 * Educational implementation of Shannon-Fano algorithm - predecessor to Huffman
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
  
  const ShannonFano = {
    internalName: 'ShannonFano',
    name: 'Shannon-Fano Coding',
    comment: 'Claude Shannon and Robert Fano variable-length coding - predecessor to Huffman',
    category: 'Entropy',
    instances: {},
    isInitialized: false,
    
    /**
     * Initialize the algorithm
     */
    Init: function() {
      this.isInitialized = true;
      console.log('Shannon-Fano coding algorithm initialized');
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
        codeTable: {}
      };
      return id;
    },
    
    /**
     * Compress data using Shannon-Fano coding
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
      
      // Step 1: Build frequency table
      const frequencies = this._buildFrequencyTable(data);
      
      // Step 2: Sort symbols by frequency (descending)
      const sortedSymbols = Object.keys(frequencies).sort((a, b) => frequencies[b] - frequencies[a]);
      
      // Step 3: Build Shannon-Fano codes
      instance.codeTable = {};
      this._buildShannonFanoCodes(sortedSymbols, frequencies, instance.codeTable, '');
      
      // Step 4: Encode the data
      let encodedBits = '';
      for (let i = 0; i < data.length; i++) {
        const char = data.charAt(i);
        if (instance.codeTable[char]) {
          encodedBits += instance.codeTable[char];
        } else {
          throw new Error(`Character '${char}' not found in code table`);
        }
      }
      
      // Step 5: Create compressed format
      const compressed = this._packCompressedData(instance.codeTable, encodedBits, data.length);
      
      // Update statistics
      instance.lastInputSize = data.length;
      instance.lastOutputSize = compressed.length;
      instance.compressionRatio = data.length / compressed.length;
      
      return compressed;
    },
    
    /**
     * Decompress Shannon-Fano encoded data
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
      const { codeTable, encodedBits, originalLength } = this._unpackCompressedData(compressedData);
      
      // Create reverse mapping (code -> symbol)
      const reverseTable = {};
      for (const [symbol, code] of Object.entries(codeTable)) {
        reverseTable[code] = symbol;
      }
      
      // Decode bit stream
      let decoded = '';
      let currentCode = '';
      
      for (let i = 0; i < encodedBits.length; i++) {
        currentCode += encodedBits[i];
        
        if (reverseTable[currentCode]) {
          decoded += reverseTable[currentCode];
          currentCode = '';
          
          // Stop if we've reached the expected length
          if (decoded.length >= originalLength) {
            break;
          }
        }
      }
      
      if (decoded.length !== originalLength) {
        throw new Error('Decompressed length mismatch');
      }
      
      return decoded;
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
     * Build frequency table for characters
     * @private
     */
    _buildFrequencyTable: function(data) {
      const frequencies = {};
      for (let i = 0; i < data.length; i++) {
        const char = data.charAt(i);
        frequencies[char] = (frequencies[char] || 0) + 1;
      }
      return frequencies;
    },
    
    /**
     * Build Shannon-Fano codes recursively
     * @private
     */
    _buildShannonFanoCodes: function(symbols, frequencies, codeTable, prefix) {
      if (symbols.length === 1) {
        // Single symbol - assign code (or '0' if it's the only symbol)
        codeTable[symbols[0]] = prefix || '0';
        return;
      }
      
      if (symbols.length === 0) {
        return;
      }
      
      // Find split point that balances frequencies as much as possible
      const totalFreq = symbols.reduce((sum, sym) => sum + frequencies[sym], 0);
      let leftFreq = 0;
      let splitIndex = 0;
      let bestDiff = Infinity;
      
      for (let i = 0; i < symbols.length - 1; i++) {
        leftFreq += frequencies[symbols[i]];
        const rightFreq = totalFreq - leftFreq;
        const diff = Math.abs(leftFreq - rightFreq);
        
        if (diff < bestDiff) {
          bestDiff = diff;
          splitIndex = i;
        }
      }
      
      // Split symbols into two groups
      const leftSymbols = symbols.slice(0, splitIndex + 1);
      const rightSymbols = symbols.slice(splitIndex + 1);
      
      // Recursively build codes for each group
      this._buildShannonFanoCodes(leftSymbols, frequencies, codeTable, prefix + '0');
      this._buildShannonFanoCodes(rightSymbols, frequencies, codeTable, prefix + '1');
    },
    
    /**
     * Pack compressed data with header containing code table
     * @private
     */
    _packCompressedData: function(codeTable, encodedBits, originalLength) {
      const bytes = [];
      
      // Header: [OriginalLength(4)][TableSize(2)][Table][PaddingBits(1)][EncodedData]
      
      // Original length (4 bytes, big-endian)
      bytes.push((originalLength >>> 24) & 0xFF);
      bytes.push((originalLength >>> 16) & 0xFF);
      bytes.push((originalLength >>> 8) & 0xFF);
      bytes.push(originalLength & 0xFF);
      
      // Serialize code table
      const tableEntries = Object.entries(codeTable);
      const tableSize = tableEntries.length;
      
      // Table size (2 bytes, big-endian)
      bytes.push((tableSize >>> 8) & 0xFF);
      bytes.push(tableSize & 0xFF);
      
      // Table entries: [CharCode(1)][CodeLength(1)][CodeBits(variable)]
      for (const [char, code] of tableEntries) {
        bytes.push(char.charCodeAt(0) & 0xFF); // Character
        bytes.push(code.length & 0xFF); // Code length
        
        // Pack code bits into bytes
        const paddedCode = code + '0'.repeat((8 - (code.length % 8)) % 8);
        for (let i = 0; i < paddedCode.length; i += 8) {
          const byte = paddedCode.substr(i, 8);
          bytes.push(parseInt(byte, 2));
        }
      }
      
      // Padding bits for encoded data
      const paddingBits = (8 - (encodedBits.length % 8)) % 8;
      bytes.push(paddingBits);
      
      // Encoded data
      const paddedBits = encodedBits + '0'.repeat(paddingBits);
      for (let i = 0; i < paddedBits.length; i += 8) {
        const byte = paddedBits.substr(i, 8);
        bytes.push(parseInt(byte, 2));
      }
      
      return this._bytesToString(bytes);
    },
    
    /**
     * Unpack compressed data
     * @private
     */
    _unpackCompressedData: function(compressedData) {
      const bytes = this._stringToBytes(compressedData);
      
      if (bytes.length < 7) {
        throw new Error('Invalid compressed data: too short');
      }
      
      let pos = 0;
      
      // Read original length
      const originalLength = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | 
                           (bytes[pos + 2] << 8) | bytes[pos + 3];
      pos += 4;
      
      // Read table size
      const tableSize = (bytes[pos] << 8) | bytes[pos + 1];
      pos += 2;
      
      // Read code table
      const codeTable = {};
      for (let i = 0; i < tableSize; i++) {
        if (pos >= bytes.length) {
          throw new Error('Invalid compressed data: incomplete table');
        }
        
        const charCode = bytes[pos++];
        const codeLength = bytes[pos++];
        
        // Read code bits
        const codeBytesNeeded = Math.ceil(codeLength / 8);
        if (pos + codeBytesNeeded > bytes.length) {
          throw new Error('Invalid compressed data: incomplete code');
        }
        
        let codeBits = '';
        for (let j = 0; j < codeBytesNeeded; j++) {
          codeBits += bytes[pos++].toString(2).padStart(8, '0');
        }
        
        const code = codeBits.substr(0, codeLength);
        const char = String.fromCharCode(charCode);
        codeTable[char] = code;
      }
      
      // Read padding bits
      if (pos >= bytes.length) {
        throw new Error('Invalid compressed data: missing padding info');
      }
      const paddingBits = bytes[pos++];
      
      // Read encoded data
      let encodedBits = '';
      for (let i = pos; i < bytes.length; i++) {
        encodedBits += bytes[i].toString(2).padStart(8, '0');
      }
      
      // Remove padding
      if (paddingBits > 0) {
        encodedBits = encodedBits.substr(0, encodedBits.length - paddingBits);
      }
      
      return { codeTable, encodedBits, originalLength };
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
        codeTableSize: Object.keys(instance.codeTable).length,
        codeTable: { ...instance.codeTable },
        description: 'Top-down approach - may not be optimal like Huffman but simpler to implement'
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
    ShannonFano.Init();
    global.Compression.AddAlgorithm(ShannonFano);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShannonFano;
  }
  
  // Make globally available
  global.ShannonFano = ShannonFano;
  
})(typeof global !== 'undefined' ? global : window);