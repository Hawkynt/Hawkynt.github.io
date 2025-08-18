/*
 * Universal Simplified Deflate
 * Compatible with both Browser and Node.js environments
 * Educational implementation combining LZ77 + Huffman (core of ZIP/GZIP)
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
  
  const DeflateSimple = {
    internalName: 'DeflateSimple',
    name: 'Simplified Deflate',
    comment: 'Educational LZ77 + Huffman hybrid - core algorithm of ZIP/GZIP',
    category: 'Hybrid',
    instances: {},
    isInitialized: false,
    
    // Configuration
    WINDOW_SIZE: 1024,    // Smaller than full LZ77 for simplicity
    LOOKAHEAD_SIZE: 15,   // Smaller lookahead
    MIN_MATCH_LENGTH: 3,
    
    /**
     * Initialize the algorithm
     */
    Init: function() {
      this.isInitialized = true;
      console.log('Simplified Deflate algorithm initialized');
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
     * Compress data using Simplified Deflate
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
      
      // Step 1: Apply LZ77 compression
      const lz77Tokens = this._applyLZ77(data);
      
      // Step 2: Convert tokens to symbol stream
      const symbolStream = this._tokensToSymbols(lz77Tokens);
      
      // Step 3: Apply Huffman coding to symbols
      const huffmanResult = this._applyHuffman(symbolStream);
      
      // Step 4: Pack compressed data
      const compressed = this._packCompressedData(huffmanResult, data.length);
      
      // Update statistics
      instance.lastInputSize = data.length;
      instance.lastOutputSize = compressed.length;
      instance.compressionRatio = data.length / compressed.length;
      
      return compressed;
    },
    
    /**
     * Decompress Simplified Deflate data
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
      
      // Step 1: Unpack compressed data
      const { huffmanResult, originalLength } = this._unpackCompressedData(compressedData);
      
      // Step 2: Decompress Huffman to get symbol stream
      const symbolStream = this._decompressHuffman(huffmanResult);
      
      // Step 3: Convert symbols back to LZ77 tokens
      const lz77Tokens = this._symbolsToTokens(symbolStream);
      
      // Step 4: Decompress LZ77 tokens
      const decompressed = this._decompressLZ77(lz77Tokens);
      
      if (decompressed.length !== originalLength) {
        throw new Error('Decompressed length mismatch');
      }
      
      return decompressed;
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
     * Apply LZ77 compression (simplified version)
     * @private
     */
    _applyLZ77: function(data) {
      const tokens = [];
      let position = 0;
      
      while (position < data.length) {
        const match = this._findLongestMatch(data, position);
        
        if (match.length >= this.MIN_MATCH_LENGTH) {
          // Encode as match + literal
          const nextChar = position + match.length < data.length ? 
                           data.charAt(position + match.length) : '';
          
          tokens.push({
            type: 'match',
            distance: match.distance,
            length: match.length,
            literal: nextChar
          });
          
          position += match.length + (nextChar ? 1 : 0);
        } else {
          // Encode as literal
          tokens.push({
            type: 'literal',
            literal: data.charAt(position)
          });
          
          position++;
        }
      }
      
      return tokens;
    },
    
    /**
     * Find longest match in sliding window
     * @private
     */
    _findLongestMatch: function(data, position) {
      const windowStart = Math.max(0, position - this.WINDOW_SIZE);
      const windowEnd = position;
      const lookaheadEnd = Math.min(data.length, position + this.LOOKAHEAD_SIZE);
      
      let bestMatch = { distance: 0, length: 0 };
      
      for (let i = windowStart; i < windowEnd; i++) {
        let matchLength = 0;
        
        while (i + matchLength < windowEnd && 
               position + matchLength < lookaheadEnd &&
               data.charAt(i + matchLength) === data.charAt(position + matchLength)) {
          matchLength++;
        }
        
        if (matchLength > bestMatch.length) {
          bestMatch = {
            distance: position - i,
            length: matchLength
          };
        }
      }
      
      return bestMatch;
    },
    
    /**
     * Convert LZ77 tokens to symbol stream for Huffman
     * @private
     */
    _tokensToSymbols: function(tokens) {
      const symbols = [];
      
      for (const token of tokens) {
        if (token.type === 'literal') {
          symbols.push({
            type: 'literal',
            value: token.literal.charCodeAt(0)
          });
        } else {
          symbols.push({
            type: 'length',
            value: token.length
          });
          symbols.push({
            type: 'distance',
            value: token.distance
          });
          if (token.literal) {
            symbols.push({
              type: 'literal',
              value: token.literal.charCodeAt(0)
            });
          }
        }
      }
      
      return symbols;
    },
    
    /**
     * Convert symbols back to LZ77 tokens
     * @private
     */
    _symbolsToTokens: function(symbols) {
      const tokens = [];
      let i = 0;
      
      while (i < symbols.length) {
        const symbol = symbols[i];
        
        if (symbol.type === 'literal') {
          tokens.push({
            type: 'literal',
            literal: String.fromCharCode(symbol.value)
          });
          i++;
        } else if (symbol.type === 'length') {
          // Match token: length + distance + optional literal
          const length = symbol.value;
          const distance = symbols[i + 1] ? symbols[i + 1].value : 0;
          
          let literal = '';
          let nextIndex = i + 2;
          
          if (nextIndex < symbols.length && symbols[nextIndex].type === 'literal') {
            literal = String.fromCharCode(symbols[nextIndex].value);
            nextIndex++;
          }
          
          tokens.push({
            type: 'match',
            distance: distance,
            length: length,
            literal: literal
          });
          
          i = nextIndex;
        } else {
          i++; // Skip unexpected symbols
        }
      }
      
      return tokens;
    },
    
    /**
     * Apply simplified Huffman coding
     * @private
     */
    _applyHuffman: function(symbols) {
      // Build frequency table
      const frequencies = {};
      for (const symbol of symbols) {
        const key = `${symbol.type}:${symbol.value}`;
        frequencies[key] = (frequencies[key] || 0) + 1;
      }
      
      // Build simple Huffman codes (simplified version)
      const codes = this._buildSimpleHuffmanCodes(frequencies);
      
      // Encode symbols
      let encodedBits = '';
      for (const symbol of symbols) {
        const key = `${symbol.type}:${symbol.value}`;
        encodedBits += codes[key] || '0';
      }
      
      return { codes, encodedBits };
    },
    
    /**
     * Build simplified Huffman codes
     * @private
     */
    _buildSimpleHuffmanCodes: function(frequencies) {
      const symbols = Object.keys(frequencies);
      const codes = {};
      
      if (symbols.length === 1) {
        codes[symbols[0]] = '0';
        return codes;
      }
      
      // Simple fixed-length coding for simplicity
      const bitsNeeded = Math.ceil(Math.log2(symbols.length));
      
      for (let i = 0; i < symbols.length; i++) {
        codes[symbols[i]] = i.toString(2).padStart(bitsNeeded, '0');
      }
      
      return codes;
    },
    
    /**
     * Decompress Huffman encoded data
     * @private
     */
    _decompressHuffman: function(huffmanResult) {
      const { codes, encodedBits } = huffmanResult;
      
      // Build reverse mapping
      const reverseMap = {};
      for (const [symbol, code] of Object.entries(codes)) {
        reverseMap[code] = symbol;
      }
      
      // Decode bit stream
      const symbols = [];
      const codeLength = Object.values(codes)[0].length; // All codes same length in simple version
      
      for (let i = 0; i < encodedBits.length; i += codeLength) {
        const code = encodedBits.substr(i, codeLength);
        const symbolKey = reverseMap[code];
        
        if (symbolKey) {
          const [type, value] = symbolKey.split(':');
          symbols.push({
            type: type,
            value: parseInt(value)
          });
        }
      }
      
      return symbols;
    },
    
    /**
     * Decompress LZ77 tokens
     * @private
     */
    _decompressLZ77: function(tokens) {
      let output = '';
      
      for (const token of tokens) {
        if (token.type === 'literal') {
          output += token.literal;
        } else if (token.type === 'match') {
          const startPos = output.length - token.distance;
          
          for (let i = 0; i < token.length; i++) {
            output += output.charAt(startPos + i);
          }
          
          if (token.literal) {
            output += token.literal;
          }
        }
      }
      
      return output;
    },
    
    /**
     * Pack compressed data
     * @private
     */
    _packCompressedData: function(huffmanResult, originalLength) {
      // Simplified packing - just store the basics
      const data = JSON.stringify({
        huffmanResult: huffmanResult,
        originalLength: originalLength
      });
      
      return data;
    },
    
    /**
     * Unpack compressed data
     * @private
     */
    _unpackCompressedData: function(compressedData) {
      try {
        const data = JSON.parse(compressedData);
        return {
          huffmanResult: data.huffmanResult,
          originalLength: data.originalLength
        };
      } catch (e) {
        throw new Error('Invalid Deflate compressed data format');
      }
    },
    
    /**
     * Get compression statistics
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
        windowSize: this.WINDOW_SIZE,
        lookaheadSize: this.LOOKAHEAD_SIZE,
        description: 'Simplified Deflate: LZ77 dictionary compression + Huffman entropy coding'
      };
    },
    
    // Utility functions
    _stringToBytes: function(str) {
      const bytes = [];
      for (let i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i) & 0xFF);
      }
      return bytes;
    },
    
    _bytesToString: function(bytes) {
      let str = '';
      for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
      }
      return str;
    }
  };
  
  // Auto-register with compression system
  if (global.Compression) {
    DeflateSimple.Init();
    global.Compression.AddAlgorithm(DeflateSimple);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeflateSimple;
  }
  
  // Make globally available
  global.DeflateSimple = DeflateSimple;
  
})(typeof global !== 'undefined' ? global : window);