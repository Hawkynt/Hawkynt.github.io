/*
 * Universal Simplified Deflate
 * Compatible with both Browser and Node.js environments
 * Educational implementation combining LZ77 + Huffman (core of ZIP/GZIP)
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Load AlgorithmFramework (REQUIRED)
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    global.AlgorithmFramework = require('../../AlgorithmFramework.js');
  }
  
  // Load OpCodes for cryptographic operations (RECOMMENDED)
  if (!global.OpCodes && typeof require !== 'undefined') {
    global.OpCodes = require('../../OpCodes.js');
  }
  
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = global.AlgorithmFramework;
  
  class DeflateSimpleAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();
      
      // Required metadata
      this.name = "Simplified Deflate";
      this.description = "Educational LZ77 + Huffman hybrid implementation demonstrating core algorithm of ZIP/GZIP compression.";
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Hybrid";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.inventor = "Jacob Ziv, Abraham Lempel, David Huffman";
      this.year = 1977;
      this.country = CountryCode.US;
      
      // Configuration
      this.WINDOW_SIZE = 1024;    // Smaller than full LZ77 for simplicity
      this.LOOKAHEAD_SIZE = 15;   // Smaller lookahead
      this.MIN_MATCH_LENGTH = 3;
      
      this.documentation = [
        new LinkItem("DEFLATE Compressed Data Format Specification", "https://tools.ietf.org/html/rfc1951"),
        new LinkItem("LZ77 Algorithm Description", "https://en.wikipedia.org/wiki/LZ77_and_LZ78"),
        new LinkItem("Huffman Coding Tutorial", "https://web.stanford.edu/class/archive/cs/cs106b/cs106b.1126/")
      ];
      
      this.references = [
        new LinkItem("Data Compression: The Complete Reference", "https://www.springer.com/gp/book/9781846286025"),
        new LinkItem("Introduction to Data Compression", "https://www.elsevier.com/books/introduction-to-data-compression/sayood/978-0-12-620862-7")
      ];
      
      // Convert existing tests to new format
      this.tests = [
        new TestCase(
          global.OpCodes.AnsiToBytes("ABCABCABC"),
          [123, 34, 104, 117, 102, 102, 109, 97, 110, 82, 101, 115, 117, 108, 116, 34, 58, 123, 34, 99, 111, 100, 101, 115, 34, 58, 123, 34, 108, 105, 116, 101, 114, 97, 108, 58, 54, 53, 34, 58, 34, 48, 48, 48, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 54, 54, 34, 58, 34, 48, 48, 49, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 54, 55, 34, 58, 34, 48, 49, 48, 34, 44, 34, 108, 101, 110, 103, 116, 104, 58, 51, 34, 58, 34, 48, 49, 49, 34, 44, 34, 100, 105, 115, 116, 97, 110, 99, 101, 58, 51, 34, 58, 34, 49, 48, 48, 34, 125, 44, 34, 101, 110, 99, 111, 100, 101, 100, 66, 105, 116, 115, 34, 58, 34, 48, 48, 48, 48, 48, 49, 48, 49, 48, 48, 49, 49, 49, 48, 48, 48, 48, 48, 48, 48, 49, 48, 49, 48, 34, 125, 44, 34, 111, 114, 105, 103, 105, 110, 97, 108, 76, 101, 110, 103, 116, 104, 34, 58, 57, 125],
          "Basic string with repeated substrings",
          "https://tools.ietf.org/rfc/rfc1951.txt"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
          [123, 34, 104, 117, 102, 102, 109, 97, 110, 82, 101, 115, 117, 108, 116, 34, 58, 123, 34, 99, 111, 100, 101, 115, 34, 58, 123, 34, 108, 105, 116, 101, 114, 97, 108, 58, 56, 52, 34, 58, 34, 48, 48, 48, 48, 48, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 49, 48, 52, 34, 58, 34, 48, 48, 48, 48, 49, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 49, 48, 49, 34, 58, 34, 48, 48, 48, 49, 48, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 51, 50, 34, 58, 34, 48, 48, 48, 49, 49, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 49, 49, 51, 34, 58, 34, 48, 48, 49, 48, 48, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 49, 49, 55, 34, 58, 34, 48, 48, 49, 48, 49, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 49, 48, 53, 34, 58, 34, 48, 48, 49, 49, 48, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 57, 57, 34, 58, 34, 48, 48, 49, 49, 49, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 49, 48, 55, 34, 58, 34, 48, 49, 48, 48, 48, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 57, 56, 34, 58, 34, 48, 49, 48, 48, 49, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 49, 49, 52, 34, 58, 34, 48, 49, 48, 49, 48, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 49, 49, 49, 34, 58, 34, 48, 49, 48, 49, 49, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 49, 49, 57, 34, 58, 34, 48, 49, 49, 48, 48, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 49, 49, 48, 34, 58, 34, 48, 49, 49, 48, 49, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 49, 48, 50, 34, 58, 34, 48, 49, 49, 49, 48, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 49, 50, 48, 34, 58, 34, 48, 49, 49, 49, 49, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 49, 48, 54, 34, 58, 34, 49, 48, 48, 48, 48, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 49, 48, 57, 34, 58, 34, 49, 48, 48, 48, 49, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 49, 49, 50, 34, 58, 34, 49, 48, 48, 49, 48, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 49, 49, 53, 34, 58, 34, 49, 48, 48, 49, 49, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 49, 49, 56, 34, 58, 34, 49, 48, 49, 48, 48, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 49, 49, 54, 34, 58, 34, 49, 48, 49, 48, 49, 34, 44, 34, 108, 101, 110, 103, 116, 104, 58, 51, 34, 58, 34, 49, 48, 49, 49, 48, 34, 44, 34, 100, 105, 115, 116, 97, 110, 99, 101, 58, 51, 49, 34, 58, 34, 49, 48, 49, 49, 49, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 49, 48, 56, 34, 58, 34, 49, 49, 48, 48, 48, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 57, 55, 34, 58, 34, 49, 49, 48, 48, 49, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 49, 50, 50, 34, 58, 34, 49, 49, 48, 49, 48, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 49, 50, 49, 34, 58, 34, 49, 49, 48, 49, 49, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 49, 48, 48, 34, 58, 34, 49, 49, 49, 48, 48, 34, 44, 34, 108, 105, 116, 101, 114, 97, 108, 58, 49, 48, 51, 34, 58, 34, 49, 49, 49, 48, 49, 34, 125, 44, 34, 101, 110, 99, 111, 100, 101, 100, 66, 105, 116, 115, 34, 58, 34, 48, 48, 48, 48, 48, 48, 48, 48, 48, 49, 48, 48, 48, 49, 48, 48, 48, 48, 49, 49, 48, 48, 49, 48, 48, 48, 48, 49, 48, 49, 48, 48, 49, 49, 48, 48, 48, 49, 49, 49, 48, 49, 48, 48, 48, 48, 48, 48, 49, 49, 48, 49, 48, 48, 49, 48, 49, 48, 49, 48, 48, 49, 48, 49, 49, 48, 49, 49, 48, 48, 48, 49, 49, 48, 49, 48, 48, 48, 49, 49, 48, 49, 49, 49, 48, 48, 49, 48, 49, 49, 48, 49, 49, 49, 49, 48, 48, 48, 49, 49, 49, 48, 48, 48, 48, 48, 48, 49, 48, 49, 49, 48, 48, 48, 49, 49, 48, 48, 49, 48, 49, 48, 48, 49, 49, 48, 48, 48, 49, 49, 48, 49, 48, 49, 49, 49, 48, 49, 48, 48, 48, 48, 48, 49, 48, 48, 49, 48, 49, 48, 48, 48, 48, 49, 49, 49, 48, 49, 48, 49, 49, 48, 49, 49, 48, 49, 48, 49, 49, 49, 49, 49, 48, 48, 48, 49, 49, 48, 48, 49, 49, 49, 48, 49, 48, 49, 49, 48, 49, 49, 48, 48, 48, 49, 49, 49, 49, 49, 48, 48, 48, 49, 48, 49, 49, 49, 49, 49, 48, 49, 34, 125, 44, 34, 111, 114, 105, 103, 105, 110, 97, 108, 76, 101, 110, 103, 116, 104, 34, 58, 52, 51, 125],
          "English text compression test",
          "Standard text compression benchmark"
        )
      ];
      
      // For test suite compatibility
      this.testVectors = this.tests;
    }
    
    CreateInstance(isInverse = false) {
      return new DeflateSimpleInstance(this, isInverse);
    }
  }
  
  class DeflateSimpleInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse; // true = decompress, false = compress
      this.inputBuffer = [];
    }
    
    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }
    
    Result() {
      if (this.inputBuffer.length === 0) return [];
      
      // Process using existing compression logic
      const result = this.isInverse ? 
        this.decompress(this.inputBuffer) : 
        this.compress(this.inputBuffer);
      
      this.inputBuffer = [];
      return result;
    }
    
    compress(data) {
      if (!data || data.length === 0) return [];
      
      const inputString = this._bytesToString(data);
      
      // Step 1: Apply LZ77 compression
      const lz77Tokens = this._applyLZ77(inputString);
      
      // Step 2: Convert tokens to symbol stream
      const symbolStream = this._tokensToSymbols(lz77Tokens);
      
      // Step 3: Apply Huffman coding to symbols
      const huffmanResult = this._applyHuffman(symbolStream);
      
      // Step 4: Pack compressed data
      const compressed = this._packCompressedData(huffmanResult, inputString.length);
      
      return this._stringToBytes(compressed);
    }
    
    decompress(data) {
      if (!data || data.length === 0) return [];
      
      const compressedString = this._bytesToString(data);
      
      // Step 1: Unpack compressed data
      const { huffmanResult, originalLength } = this._unpackCompressedData(compressedString);
      
      // Step 2: Decompress Huffman to get symbol stream
      const symbolStream = this._decompressHuffman(huffmanResult);
      
      // Step 3: Convert symbols back to LZ77 tokens
      const lz77Tokens = this._symbolsToTokens(symbolStream);
      
      // Step 4: Decompress LZ77 tokens
      const decompressed = this._decompressLZ77(lz77Tokens);
      
      if (decompressed.length !== originalLength) {
        throw new Error('Decompressed length mismatch');
      }
      
      return this._stringToBytes(decompressed);
    }
    
    /**
     * Apply LZ77 compression (simplified version)
     * @private
     */
    _applyLZ77(data) {
      const tokens = [];
      let position = 0;
      
      while (position < data.length) {
        const match = this._findLongestMatch(data, position);
        
        if (match.length >= this.algorithm.MIN_MATCH_LENGTH) {
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
    }
    
    /**
     * Find longest match in sliding window
     * @private
     */
    _findLongestMatch(data, position) {
      const windowStart = Math.max(0, position - this.algorithm.WINDOW_SIZE);
      const windowEnd = position;
      const lookaheadEnd = Math.min(data.length, position + this.algorithm.LOOKAHEAD_SIZE);
      
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
    }
    
    /**
     * Convert LZ77 tokens to symbol stream for Huffman
     * @private
     */
    _tokensToSymbols(tokens) {
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
    }
    
    /**
     * Convert symbols back to LZ77 tokens
     * @private
     */
    _symbolsToTokens(symbols) {
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
    }
    
    /**
     * Apply simplified Huffman coding
     * @private
     */
    _applyHuffman(symbols) {
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
    }
    
    /**
     * Build simplified Huffman codes
     * @private
     */
    _buildSimpleHuffmanCodes(frequencies) {
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
    }
    
    /**
     * Decompress Huffman encoded data
     * @private
     */
    _decompressHuffman(huffmanResult) {
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
    }
    
    /**
     * Decompress LZ77 tokens
     * @private
     */
    _decompressLZ77(tokens) {
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
    }
    
    /**
     * Pack compressed data
     * @private
     */
    _packCompressedData(huffmanResult, originalLength) {
      // Simplified packing - just store the basics
      const data = JSON.stringify({
        huffmanResult: huffmanResult,
        originalLength: originalLength
      });
      
      return data;
    }
    
    /**
     * Unpack compressed data
     * @private
     */
    _unpackCompressedData(compressedData) {
      try {
        const data = JSON.parse(compressedData);
        return {
          huffmanResult: data.huffmanResult,
          originalLength: data.originalLength
        };
      } catch (e) {
        throw new Error('Invalid Deflate compressed data format');
      }
    }
    
    // Utility functions
    _stringToBytes(str) {
      const bytes = [];
      for (let i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i) & 0xFF);
      }
      return bytes;
    }
    
    _bytesToString(bytes) {
      let str = '';
      for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
      }
      return str;
    }
  }
    
  
  // Register the algorithm
  RegisterAlgorithm(new DeflateSimpleAlgorithm());
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeflateSimpleAlgorithm;
  }
  
})(typeof global !== 'undefined' ? global : window);