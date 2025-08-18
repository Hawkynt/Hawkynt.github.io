#!/usr/bin/env node
/*
 * Brotli Compression Algorithm - Universal Implementation
 * Compatible with both Browser and Node.js environments
 * 
 * Based on RFC 7932 - Brotli Compressed Data Format
 * Developed by Google (Jyrki Alakuijala, Zoltán Szabadka)
 * 
 * Educational implementation - not for production use
 * Use official google/brotli library for production systems
 * 
 * Features:
 * - Simplified LZ77 + Huffman coding approach
 * - Basic meta-block structure
 * - Cross-platform compatibility
 * - Educational focus on core concepts
 */

(function(global) {
  'use strict';
  
  // Load OpCodes if in Node.js environment
  if (typeof global !== 'undefined' && global.require && !global.OpCodes) {
    require('../../OpCodes.js');
  }
  
  const Brotli = {
    internalName: 'brotli',
    name: 'Brotli Compression (RFC 7932)',
    // Required Cipher interface properties
    minKeyLength: 0,        // Minimum key length in bytes
    maxKeyLength: 0,        // Maximum key length in bytes
    stepKeyLength: 1,       // Key length step size
    minBlockSize: 0,        // Minimum block size in bytes
    maxBlockSize: 0,        // Maximum block size (0 = unlimited)
    stepBlockSize: 1,       // Block size step
    instances: {},          // Instance tracking
    
    // Constants from RFC 7932
    MIN_WINDOW_BITS: 10,
    MAX_WINDOW_BITS: 24,
    MIN_BLOCK_BITS: 16,
    MAX_BLOCK_BITS: 24,
    
    // Dictionary for common patterns (simplified static dictionary)
    STATIC_DICT: [
      ' ', 'e', 't', 'a', 'o', 'i', 'n', 's', 'h', 'r',
      'd', 'l', 'u', 'c', 'm', 'w', 'f', 'g', 'y', 'p',
      'b', 'v', 'k', 'j', 'x', 'q', 'z', 'the', 'and',
      'for', 'are', 'but', 'not', 'you', 'all', 'can',
      'had', 'her', 'was', 'one', 'our', 'out', 'day',
      'get', 'has', 'him', 'his', 'how', 'man', 'new',
      'now', 'old', 'see', 'two', 'way', 'who', 'boy',
      'did', 'its', 'let', 'put', 'say', 'she', 'too',
      'use'
    ],
    
    /**
     * Simple Huffman coding implementation
     */
    Huffman: {
      /**
       * Build Huffman tree from frequencies
       */
      buildTree: function(frequencies) {
        const nodes = [];
        
        // Create leaf nodes
        for (let i = 0; i < frequencies.length; i++) {
          if (frequencies[i] > 0) {
            nodes.push({
              symbol: i,
              freq: frequencies[i],
              left: null,
              right: null
            });
          }
        }
        
        // Build tree bottom-up
        while (nodes.length > 1) {
          // Sort by frequency
          nodes.sort((a, b) => a.freq - b.freq);
          
          // Combine two lowest frequency nodes
          const left = nodes.shift();
          const right = nodes.shift();
          
          nodes.push({
            symbol: -1,
            freq: left.freq + right.freq,
            left: left,
            right: right
          });
        }
        
        return nodes[0];
      },
      
      /**
       * Generate codes from Huffman tree
       */
      generateCodes: function(root) {
        const codes = {};
        
        function traverse(node, code) {
          if (node.symbol !== -1) {
            // Leaf node
            codes[node.symbol] = code || '0';
          } else {
            if (node.left) traverse(node.left, code + '0');
            if (node.right) traverse(node.right, code + '1');
          }
        }
        
        if (root) traverse(root, '');
        return codes;
      },
      
      /**
       * Encode data using Huffman codes
       */
      encode: function(data) {
        // Calculate frequencies
        const frequencies = new Array(256).fill(0);
        for (let i = 0; i < data.length; i++) {
          frequencies[data[i]]++;
        }
        
        // Build tree and generate codes
        const tree = this.buildTree(frequencies);
        const codes = this.generateCodes(tree);
        
        // Encode data
        let encoded = '';
        for (let i = 0; i < data.length; i++) {
          encoded += codes[data[i]] || '0';
        }
        
        return { encoded, tree, codes };
      },
      
      /**
       * Decode Huffman-encoded data
       */
      decode: function(encoded, tree) {
        const result = [];
        let current = tree;
        
        for (let i = 0; i < encoded.length; i++) {
          if (encoded[i] === '0') {
            current = current.left;
          } else {
            current = current.right;
          }
          
          if (current && current.symbol !== -1) {
            result.push(current.symbol);
            current = tree;
          }
        }
        
        return result;
      }
    },
    
    /**
     * LZ77 compression implementation
     */
    LZ77: {
      /**
       * Find the longest match in the sliding window
       */
      findLongestMatch: function(data, pos, windowSize) {
        let bestLength = 0;
        let bestDistance = 0;
        const maxLength = Math.min(258, data.length - pos); // Brotli max match length
        
        const start = Math.max(0, pos - windowSize);
        
        for (let i = start; i < pos; i++) {
          let length = 0;
          
          // Find match length
          while (length < maxLength && 
                 pos + length < data.length && 
                 data[i + length] === data[pos + length]) {
            length++;
          }
          
          if (length > bestLength && length >= 3) {
            bestLength = length;
            bestDistance = pos - i;
          }
        }
        
        return { length: bestLength, distance: bestDistance };
      },
      
      /**
       * Compress data using LZ77 algorithm
       */
      compress: function(data, windowSize = 32768) {
        const result = [];
        let pos = 0;
        
        while (pos < data.length) {
          const match = this.findLongestMatch(data, pos, windowSize);
          
          if (match.length >= 3) {
            // Found a match - encode as (distance, length)
            result.push({
              type: 'match',
              distance: match.distance,
              length: match.length
            });
            pos += match.length;
          } else {
            // No match - encode literal
            result.push({
              type: 'literal',
              value: data[pos]
            });
            pos++;
          }
        }
        
        return result;
      },
      
      /**
       * Decompress LZ77-compressed data
       */
      decompress: function(compressed) {
        const result = [];
        
        for (let i = 0; i < compressed.length; i++) {
          const item = compressed[i];
          
          if (item.type === 'literal') {
            result.push(item.value);
          } else if (item.type === 'match') {
            // Copy from previous position
            const start = result.length - item.distance;
            for (let j = 0; j < item.length; j++) {
              result.push(result[start + j]);
            }
          }
        }
        
        return result;
      }
    },
    
    /**
     * Simple bit stream for encoding/decoding
     */
    BitStream: {
      /**
       * Convert byte array to bit string
       */
      toBitString: function(data) {
        let bits = '';
        for (let i = 0; i < data.length; i++) {
          bits += data[i].toString(2).padStart(8, '0');
        }
        return bits;
      },
      
      /**
       * Convert bit string to byte array
       */
      fromBitString: function(bits) {
        const result = [];
        for (let i = 0; i < bits.length; i += 8) {
          const byte = bits.substr(i, 8).padEnd(8, '0');
          result.push(parseInt(byte, 2));
        }
        return result;
      }
    },
    
    /**
     * Compress data using simplified Brotli algorithm
     */
    Compress: function(data) {
      // Convert string to byte array if needed
      if (typeof data === 'string') {
        data = OpCodes.StringToBytes(data);
      }
      
      // Step 1: LZ77 compression
      const lz77Compressed = this.LZ77.compress(data);
      
      // Step 2: Convert to simple format for Huffman coding
      const symbols = [];
      for (let i = 0; i < lz77Compressed.length; i++) {
        const item = lz77Compressed[i];
        if (item.type === 'literal') {
          symbols.push(item.value);
        } else {
          // Encode match as special symbols
          symbols.push(256); // Match marker
          symbols.push(item.distance & 0xFF);
          symbols.push((item.distance >>> 8) & 0xFF);
          symbols.push(item.length & 0xFF);
        }
      }
      
      // Step 3: Huffman encode the symbols
      const huffmanResult = this.Huffman.encode(symbols);
      
      // Step 4: Create simple header and combine
      const header = [
        0x42, 0x52, // "BR" magic
        0x01, 0x00, // Version
        data.length & 0xFF, (data.length >>> 8) & 0xFF, // Original length
        (data.length >>> 16) & 0xFF, (data.length >>> 24) & 0xFF
      ];
      
      // Convert encoded bits to bytes
      const compressedData = this.BitStream.fromBitString(huffmanResult.encoded);
      
      return {
        compressed: header.concat(compressedData),
        originalLength: data.length,
        compressedLength: header.length + compressedData.length,
        huffmanTree: huffmanResult.tree
      };
    },
    
    /**
     * Decompress Brotli-compressed data
     */
    Decompress: function(compressed, huffmanTree) {
      // Extract header
      if (compressed.length < 8 || compressed[0] !== 0x42 || compressed[1] !== 0x52) {
        throw new Error("Invalid Brotli header");
      }
      
      const originalLength = compressed[4] | (compressed[5] << 8) | 
                           (compressed[6] << 16) | (compressed[7] << 24);
      
      // Extract compressed data
      const compressedData = compressed.slice(8);
      
      // Convert to bit string and decode with Huffman
      const bits = this.BitStream.toBitString(compressedData);
      const symbols = this.Huffman.decode(bits, huffmanTree);
      
      // Convert symbols back to LZ77 format
      const lz77Data = [];
      for (let i = 0; i < symbols.length; i++) {
        if (symbols[i] === 256) {
          // Match marker
          const distance = symbols[i + 1] | (symbols[i + 2] << 8);
          const length = symbols[i + 3];
          lz77Data.push({
            type: 'match',
            distance: distance,
            length: length
          });
          i += 3;
        } else {
          lz77Data.push({
            type: 'literal',
            value: symbols[i]
          });
        }
      }
      
      // LZ77 decompress
      return this.LZ77.decompress(lz77Data);
    },
    
    /**
     * Test vectors for validation
     */
    TestVectors: [
      {
        input: "Hello, World!",
        description: "Simple test string"
      },
      {
        input: "The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the lazy dog.",
        description: "Repeated text for LZ77 testing"
      },
      {
        input: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        description: "Highly repetitive data"
      }
    ]
  };
  
  // Register with global Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    const BrotliCipher = {
      internalName: Brotli.internalName,
      name: Brotli.name,
      
      // Store compression state
      lastCompressedData: null,
      lastHuffmanTree: null,
      
      Init: function() {
        this.lastCompressedData = null;
        this.lastHuffmanTree = null;
        return 0;
      },
      
      // Compression
      encryptBlock: function(nKeyIndex, plaintext) {
        try {
          const result = Brotli.Compress(plaintext);
          this.lastCompressedData = result.compressed;
          this.lastHuffmanTree = result.huffmanTree;
          
          const compressionRatio = ((1 - result.compressedLength / result.originalLength) * 100).toFixed(1);
          
          return `Compressed: ${OpCodes.BytesToHex(result.compressed)} (${compressionRatio}% reduction)`;
        } catch (e) {
          return "Error: " + e.message;
        }
      },
      
      // Decompression
      decryptBlock: function(nKeyIndex, ciphertext) {
        try {
          if (!this.lastCompressedData || !this.lastHuffmanTree) {
            return "Error: No compression data available. Compress first.";
          }
          
          const decompressed = Brotli.Decompress(this.lastCompressedData, this.lastHuffmanTree);
          return OpCodes.BytesToString(decompressed);
        } catch (e) {
          return "Error: " + e.message;
        }
      },
      
      ClearData: function() {
        this.lastCompressedData = null;
        this.lastHuffmanTree = null;
      }
    };
    
    Cipher.AddCipher(Brotli);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Brotli;
  }
  
  // Export to global scope
  global.Brotli = Brotli;
  
})(typeof global !== 'undefined' ? global : window);