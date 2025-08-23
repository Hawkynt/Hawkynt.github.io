/*
 * LZW (Lempel-Ziv-Welch) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Dictionary-based compression algorithm developed by Terry Welch in 1984.
 * Used in GIF images, TIFF files, and early Unix compress utility.
 * Builds dictionary dynamically during compression/decompression.
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

  // LZW Compression Algorithm Implementation

  class LZWCompression extends CompressionAlgorithm {
    constructor() {
      super();
      
      // Required metadata
      this.name = "LZW (Lempel-Ziv-Welch)";
      this.description = "Dictionary-based compression algorithm that builds a table of frequently occurring strings. Pre-initializes dictionary with all single bytes and adds new patterns dynamically during compression. Used in GIF/TIFF formats.";
      this.inventor = "Terry Welch";
      this.year = 1984;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("A Technique for High-Performance Data Compression", "https://ieeexplore.ieee.org/document/1659158"),
        new LinkItem("LZW - Wikipedia", "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch"),
        new LinkItem("GIF Format Specification", "https://www.w3.org/Graphics/GIF/spec-gif89a.txt")
      ];

      this.references = [
        new LinkItem("Original IEEE Paper by Terry Welch", "https://ieeexplore.ieee.org/document/1659158"),
        new LinkItem("TIFF LZW Reference", "https://github.com/vadimkantorov/pytiff"),
        new LinkItem("Educational LZW Implementation", "https://rosettacode.org/wiki/LZW_compression")
      ];

      // Test vectors - compression tests with expected compressed outputs
      this.tests = [
        new TestCase(
          [65, 66, 65, 66, 65, 66, 65, 66], // Repeated pattern
          [0, 0, 0, 5, 0, 65, 0, 66, 1, 2, 1, 4, 0, 66],
          "Simple repeated pattern",
          "Basic LZW test"
        ),
        new TestCase(
          [84, 79, 66, 69, 79, 82, 78, 79, 84, 84, 79, 66, 69, 79, 82, 84, 79, 66, 69, 79, 82, 78, 79, 84], // "TOBEORNOTTOBEORTOBEORNOT"
          [0, 0, 0, 16, 0, 84, 0, 79, 0, 66, 0, 69, 0, 79, 0, 82, 0, 78, 0, 79, 0, 84, 1, 2, 1, 4, 1, 6, 1, 11, 1, 5, 1, 7, 1, 9],
          "Text with common substrings",
          "Text compression test"
        ),
        new TestCase(
          [0x47, 0x49, 0x46], // "GIF" header
          [0, 0, 0, 3, 0, 71, 0, 73, 0, 70],
          "Binary data compression",
          "Binary data test"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new LZWCompressionInstance(this, isInverse);
    }
  }

  class LZWCompressionInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
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
      try {
        const input = this.inputBuffer.slice();
        this.inputBuffer = [];
        
        if (input.length === 0) return [];
        
        // Initialize dictionary with all single bytes (0-255)
        const dictionary = new Map();
        for (let i = 0; i < 256; i++) {
          dictionary.set(String.fromCharCode(i), i);
        }
        
        let nextCode = 258; // 256=CLEAR, 257=EOF in some variants
        const codes = [];
        
        let currentString = '';
        
        for (let i = 0; i < input.length; i++) {
          const char = String.fromCharCode(input[i]);
          const testString = currentString + char;
          
          if (dictionary.has(testString)) {
            currentString = testString;
          } else {
            // Output code for current string
            codes.push(dictionary.get(currentString));
            
            // Add new string to dictionary if there's room
            if (nextCode < 4096) { // 12-bit max
              dictionary.set(testString, nextCode);
              nextCode++;
            }
            
            currentString = char;
          }
        }
        
        // Output code for final string
        if (currentString !== '') {
          codes.push(dictionary.get(currentString));
        }
        
        return this._packCodes(codes);
      } catch (e) {
        this.inputBuffer = [];
        return [];
      }
    }

    _decompress() {
      try {
        const input = this.inputBuffer.slice();
        this.inputBuffer = [];
        
        if (input.length === 0) return [];
        
        const codes = this._unpackCodes(input);
        if (codes.length === 0) return [];
        
        // Initialize dictionary with all single bytes
        const dictionary = new Map();
        for (let i = 0; i < 256; i++) {
          dictionary.set(i, String.fromCharCode(i));
        }
        
        let nextCode = 258;
        const result = [];
        let prevString = '';
        
        for (let i = 0; i < codes.length; i++) {
          const code = codes[i];
          let currentString;
          
          if (dictionary.has(code)) {
            currentString = dictionary.get(code);
          } else if (code === nextCode) {
            // Special case: code not yet in dictionary
            currentString = prevString + prevString.charAt(0);
          } else {
            throw new Error('Invalid LZW code sequence');
          }
          
          result.push(currentString);
          
          if (prevString !== '' && nextCode < 4096) {
            const newEntry = prevString + currentString.charAt(0);
            dictionary.set(nextCode, newEntry);
            nextCode++;
          }
          
          prevString = currentString;
        }
        
        const output = result.join('');
        const bytes = [];
        for (let i = 0; i < output.length; i++) {
          bytes.push(output.charCodeAt(i) & 0xFF);
        }
        return bytes;
      } catch (e) {
        this.inputBuffer = [];
        return [];
      }
    }

    _packCodes(codes) {
      // Simple packing: store each code as 2 bytes (16-bit)
      const bytes = [];
      
      // Store number of codes first (4 bytes)
      const count = codes.length;
      bytes.push((count >>> 24) & 0xFF);
      bytes.push((count >>> 16) & 0xFF);
      bytes.push((count >>> 8) & 0xFF);
      bytes.push(count & 0xFF);
      
      // Store codes as 16-bit values
      for (const code of codes) {
        bytes.push((code >>> 8) & 0xFF);
        bytes.push(code & 0xFF);
      }
      
      return bytes;
    }

    _unpackCodes(bytes) {
      if (bytes.length < 4) return [];
      
      // Read number of codes
      const count = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
      
      if (bytes.length !== 4 + count * 2) return [];
      
      const codes = [];
      let pos = 4;
      
      for (let i = 0; i < count; i++) {
        const code = (bytes[pos] << 8) | bytes[pos + 1];
        codes.push(code);
        pos += 2;
      }
      
      return codes;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new LZWCompression());

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LZWCompression;
  }

})(typeof global !== 'undefined' ? global : window);