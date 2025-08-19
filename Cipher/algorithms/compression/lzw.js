/*
 * Universal LZW (Lempel-Ziv-Welch) Compression Algorithm
 * Compatible with both Browser and Node.js environments
 * Educational implementation of Terry Welch's variant - used in GIF/TIFF
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
  
  const LZW = {
    name: "LZW (Lempel-Ziv-Welch)",
    description: "Dictionary compression algorithm that builds a table of frequently occurring strings. Pre-initializes dictionary with all single bytes and adds new patterns dynamically during compression.",
    inventor: "Terry Welch", 
    year: 1984,
    country: "US",
    category: "compression",
    subCategory: "Dictionary",
    securityStatus: null,
    securityNotes: "Compression algorithm - no security properties.",
    
    documentation: [
      {text: "A Technique for High-Performance Data Compression", uri: "https://ieeexplore.ieee.org/document/1659158"},
      {text: "LZW - Wikipedia", uri: "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch"},
      {text: "GIF Format Specification", uri: "https://www.w3.org/Graphics/GIF/spec-gif89a.txt"},
      {text: "TIFF LZW Compression", uri: "https://www.adobe.io/open/standards/TIFF.html"}
    ],
    
    references: [
      {text: "Original IEEE Paper by Terry Welch", uri: "https://ieeexplore.ieee.org/document/1659158"},
      {text: "libgif LZW Implementation", uri: "https://github.com/lecram/gifenc"},
      {text: "TIFF LZW Reference", uri: "https://github.com/vadimkantorov/pytiff"},
      {text: "Educational LZW Implementation", uri: "https://rosettacode.org/wiki/LZW_compression"}
    ],
    
    knownVulnerabilities: [],
    
    tests: [
      {
        text: "Simple repeated pattern",
        uri: "Basic LZW test", 
        input: OpCodes.StringToBytes("ABABABAB"),
        expected: OpCodes.Hex8ToBytes("010041424101010258")
      },
      {
        text: "Text with common substrings",
        uri: "Text compression test",
        input: OpCodes.StringToBytes("TOBEORNOTTOBEORTOBEORNOT"),
        expected: null
      },
      {
        text: "GIF-style compression",
        uri: "Image data test",
        input: OpCodes.Hex8ToBytes("474946"),
        expected: null
      }
    ],

    // Legacy interface properties
    internalName: 'LZW',
    category: 'Dictionary',
    instances: {},
    isInitialized: false,
    
    // LZW Configuration parameters
    INITIAL_CODE_SIZE: 9,       // Starting code size in bits
    MAX_CODE_SIZE: 12,          // Maximum code size in bits (4096 entries)
    CLEAR_CODE: 256,            // Clear dictionary code
    EOF_CODE: 257,              // End of file code
    FIRST_CODE: 258,            // First available code for dictionary
    
    /**
     * Initialize the algorithm
     */
    Init: function() {
      this.isInitialized = true;
      console.log('LZW algorithm initialized');
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
     * Compress data using LZW algorithm
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
      
      // Initialize dictionary with all single bytes (0-255)
      const dictionary = new Map();
      for (let i = 0; i < 256; i++) {
        dictionary.set(String.fromCharCode(i), i);
      }
      
      let nextCode = this.FIRST_CODE;
      let codeSize = this.INITIAL_CODE_SIZE;
      const codes = [];
      
      // Add clear code at the beginning
      codes.push(this.CLEAR_CODE);
      
      let currentString = '';
      
      for (let i = 0; i < input.length; i++) {
        const char = String.fromCharCode(input[i]);
        const testString = currentString + char;
        
        if (dictionary.has(testString)) {
          // String found in dictionary, continue building
          currentString = testString;
        } else {
          // String not in dictionary
          // Output code for current string
          codes.push(dictionary.get(currentString));
          
          // Add new string to dictionary if there's room
          if (nextCode < (1 << this.MAX_CODE_SIZE)) {
            dictionary.set(testString, nextCode);
            nextCode++;
            
            // Increase code size if needed
            if (nextCode >= (1 << codeSize) && codeSize < this.MAX_CODE_SIZE) {
              codeSize++;
            }
          }
          
          // Start new string with current character
          currentString = char;
        }
      }
      
      // Output code for final string
      if (currentString !== '') {
        codes.push(dictionary.get(currentString));
      }
      
      // Add EOF code
      codes.push(this.EOF_CODE);
      
      // Pack codes into bit stream
      const compressed = this._packCodes(codes);
      
      // Update statistics
      instance.lastInputSize = data.length;
      instance.lastOutputSize = compressed.length;
      instance.compressionRatio = data.length / compressed.length;
      
      return compressed;
    },
    
    /**
     * Decompress LZW-encoded data
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
      
      // Unpack codes from bit stream
      const codes = this._unpackCodes(compressedData);
      
      if (codes.length === 0) {
        return '';
      }
      
      // Initialize dictionary with all single bytes (0-255)
      const dictionary = new Map();
      for (let i = 0; i < 256; i++) {
        dictionary.set(i, String.fromCharCode(i));
      }
      
      let nextCode = this.FIRST_CODE;
      const output = [];
      
      let i = 0;
      
      // Skip clear code if present
      if (codes[i] === this.CLEAR_CODE) {
        i++;
      }
      
      if (i >= codes.length || codes[i] === this.EOF_CODE) {
        return '';
      }
      
      // First code must be in initial dictionary
      let currentCode = codes[i++];
      if (currentCode >= 256) {
        throw new Error('Invalid first code in LZW data');
      }
      
      let currentString = dictionary.get(currentCode);
      output.push(currentString);
      
      while (i < codes.length && codes[i] !== this.EOF_CODE) {
        const code = codes[i++];
        let newString;
        
        if (dictionary.has(code)) {
          // Code exists in dictionary
          newString = dictionary.get(code);
        } else if (code === nextCode) {
          // Special case: code being defined
          newString = currentString + currentString.charAt(0);
        } else {
          throw new Error('Invalid code in LZW data');
        }
        
        output.push(newString);
        
        // Add new string to dictionary
        if (currentString !== '' && nextCode < (1 << this.MAX_CODE_SIZE)) {
          dictionary.set(nextCode, currentString + newString.charAt(0));
          nextCode++;
        }
        
        currentString = newString;
      }
      
      const result = output.join('');
      return result;
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
     * Pack codes into bit stream with variable code sizes
     * @private
     */
    _packCodes: function(codes) {
      let bitStream = '';
      let codeSize = this.INITIAL_CODE_SIZE;
      let nextCodeSizeIncrease = 1 << codeSize;
      let codeCount = this.FIRST_CODE;
      
      for (const code of codes) {
        // Convert code to binary with current code size
        const binaryCode = code.toString(2).padStart(codeSize, '0');
        bitStream += binaryCode;
        
        // Increase code size if needed (after adding to dictionary)
        if (code >= this.FIRST_CODE) {
          codeCount++;
          if (codeCount >= nextCodeSizeIncrease && codeSize < this.MAX_CODE_SIZE) {
            codeSize++;
            nextCodeSizeIncrease = 1 << codeSize;
          }
        }
      }
      
      // Pad bit stream to byte boundary
      const padding = (8 - (bitStream.length % 8)) % 8;
      bitStream += '0'.repeat(padding);
      
      // Convert bit stream to bytes
      const bytes = [];
      
      // Store original bit length first (4 bytes)
      const originalLength = bitStream.length - padding;
      bytes.push((originalLength >>> 24) & 0xFF);
      bytes.push((originalLength >>> 16) & 0xFF);
      bytes.push((originalLength >>> 8) & 0xFF);
      bytes.push(originalLength & 0xFF);
      
      // Convert bits to bytes
      for (let i = 0; i < bitStream.length; i += 8) {
        const byte = bitStream.substr(i, 8);
        bytes.push(parseInt(byte, 2));
      }
      
      return this._bytesToString(bytes);
    },
    
    /**
     * Unpack codes from bit stream
     * @private
     */
    _unpackCodes: function(compressedData) {
      const bytes = this._stringToBytes(compressedData);
      
      if (bytes.length < 4) {
        throw new Error('Invalid LZW compressed data: too short');
      }
      
      // Read original bit length
      const originalLength = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
      
      // Convert bytes back to bit stream
      let bitStream = '';
      for (let i = 4; i < bytes.length; i++) {
        bitStream += bytes[i].toString(2).padStart(8, '0');
      }
      
      // Trim to original length
      bitStream = bitStream.substr(0, originalLength);
      
      // Extract codes with variable lengths
      const codes = [];
      let codeSize = this.INITIAL_CODE_SIZE;
      let nextCodeSizeIncrease = 1 << codeSize;
      let codeCount = this.FIRST_CODE;
      let pos = 0;
      
      while (pos + codeSize <= bitStream.length) {
        const codeBits = bitStream.substr(pos, codeSize);
        const code = parseInt(codeBits, 2);
        codes.push(code);
        pos += codeSize;
        
        // Increase code size if needed
        if (code >= this.FIRST_CODE) {
          codeCount++;
          if (codeCount >= nextCodeSizeIncrease && codeSize < this.MAX_CODE_SIZE) {
            codeSize++;
            nextCodeSizeIncrease = 1 << codeSize;
          }
        }
        
        // Stop at EOF code
        if (code === this.EOF_CODE) {
          break;
        }
      }
      
      return codes;
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
        maxCodeSize: this.MAX_CODE_SIZE,
        maxDictionarySize: 1 << this.MAX_CODE_SIZE
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
  
  // Auto-register with Compression system if available
  if (typeof global.Compression !== 'undefined' && global.Compression.Add) {
    LZW.Init();
    global.Compression.Add(LZW);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LZW;
  }
  
  // Make globally available
  global.LZW = LZW;
  
})(typeof global !== 'undefined' ? global : window);