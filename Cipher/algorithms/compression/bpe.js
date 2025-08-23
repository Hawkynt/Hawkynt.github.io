/*
 * Byte-Pair Encoding (BPE) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * Educational implementation of Philip Gage's pair replacement algorithm
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
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem, KeySize } = global.AlgorithmFramework;
  
  class BPECompression extends CompressionAlgorithm {
    constructor() {
      super();
      
      // Required metadata
      this.name = "Byte-Pair Encoding (BPE)";
      this.description = "Iteratively replaces the most frequently occurring byte pairs with unused byte values. Simple greedy approach that can achieve good compression on structured data with repeated patterns.";
      this.inventor = "Philip Gage";
      this.year = 1994;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Transform";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("A New Algorithm for Data Compression - Philip Gage", "http://www.cbloom.com/papers/gage_bpe.pdf"),
        new LinkItem("Byte Pair Encoding - Wikipedia", "https://en.wikipedia.org/wiki/Byte_pair_encoding"),
        new LinkItem("BPE Algorithm Explanation", "https://leimao.github.io/blog/Byte-Pair-Encoding/")
      ];

      this.references = [
        new LinkItem("Philip Gage Original Implementation", "http://www.cbloom.com/src/index_lz.html"),
        new LinkItem("sentencepiece BPE Implementation", "https://github.com/google/sentencepiece"),
        new LinkItem("Modern BPE in NLP", "https://github.com/rsennrich/subword-nmt")
      ];

      // Test vectors - round-trip compression tests
      this.tests = [
        {
          text: "Simple repeated pattern",
          uri: "Educational test case", 
          input: [97, 98, 97, 98, 97, 98], // "ababab"
          expected: [97, 98, 97, 98, 97, 98] // Should decompress to original
        },
        {
          text: "Text with common pairs",
          uri: "Text compression test",
          input: [104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100, 32, 104, 101, 108, 108, 111], // "hello world hello"
          expected: [104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100, 32, 104, 101, 108, 108, 111] // Should decompress to original
        },
        {
          text: "No repeated pairs",
          uri: "Worst case test",
          input: [97, 98, 99, 100, 101, 102], // "abcdef"
          expected: [97, 98, 99, 100, 101, 102] // Should decompress to original
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new BPEInstance(this, isInverse);
    }
  }

  class BPEInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this.maxIterations = 256; // Limit iterations to prevent infinite loops
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    Result() {
      if (this.inputBuffer.length === 0) {
        return [];
      }

      if (this.isInverse) {
        return this._decompress();
      } else {
        return this._compress();
      }
    }

    _compress() {
      let workingData = [...this.inputBuffer];
      const dictionary = {};
      
      let replacementCode = 256; // Start after regular byte values
      let iteration = 0;
      
      // Iteratively find and replace most frequent byte pairs
      while (iteration < this.maxIterations) {
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
        
        while (i < workingData.length) {
          if (i < workingData.length - 1 && 
              workingData[i] === byte1 && 
              workingData[i + 1] === byte2) {
            // Found pair, replace with new code
            newData.push(replacementCode);
            i += 2;
          } else {
            // Copy single byte
            newData.push(workingData[i]);
            i++;
          }
        }
        
        // Only accept replacement if it actually saves space
        if (newData.length < workingData.length) {
          // Store replacement in dictionary
          dictionary[replacementCode] = [byte1, byte2];
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
      const compressed = this._packCompressedData(dictionary, workingData);
      
      // Clear input buffer
      this.inputBuffer = [];
      
      return compressed;
    }

    _decompress() {
      // Unpack compressed data
      const { dictionary, data } = this._unpackCompressedData(this.inputBuffer);
      
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
      
      // Clear input buffer
      this.inputBuffer = [];
      
      return workingData;
    }

    /**
     * Count occurrences of all byte pairs
     * @private
     */
    _countBytePairs(data) {
      const pairCounts = {};
      
      for (let i = 0; i < data.length - 1; i++) {
        const pair = `${data[i]},${data[i + 1]}`;
        pairCounts[pair] = (pairCounts[pair] || 0) + 1;
      }
      
      return pairCounts;
    }
    
    /**
     * Pack compressed data with dictionary
     * @private
     */
    _packCompressedData(dictionary, data) {
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
      
      return bytes;
    }
    
    /**
     * Unpack compressed data
     * @private
     */
    _unpackCompressedData(bytes) {
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
    }
  }
  
  // Register the algorithm
  RegisterAlgorithm(new BPECompression());

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BPECompression;
  }

})(typeof global !== 'undefined' ? global : window);