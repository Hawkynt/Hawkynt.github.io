/*
 * Universal Shannon-Fano Coding
 * Compatible with both Browser and Node.js environments
 * Educational implementation of Shannon-Fano algorithm - predecessor to Huffman
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

  class ShannonFanoAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();
      
      // Required metadata
      this.name = "Shannon-Fano Coding";
      this.description = "Variable-length prefix-free coding algorithm that predates Huffman coding. Divides symbols recursively by frequency to create binary codes, though not always optimal.";
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Statistical";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.inventor = "Claude Shannon, Robert Fano";
      this.year = 1948;
      this.country = CountryCode.US;
      
      this.documentation = [
        new LinkItem("A Mathematical Theory of Communication", "https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf"),
        new LinkItem("Shannon-Fano Coding - Wikipedia", "https://en.wikipedia.org/wiki/Shannon%E2%80%93Fano_coding"),
        new LinkItem("Information Theory Primer", "https://web.stanford.edu/class/ee276/"),
        new LinkItem("Data Compression History", "https://www.data-compression.com/theory.shtml")
      ];
      
      this.references = [
        new LinkItem("MIT Information Theory Course", "https://ocw.mit.edu/courses/electrical-engineering-and-computer-science/"),
        new LinkItem("Shannon-Fano vs Huffman Analysis", "https://www.cs.cmu.edu/~ckingsf/bioinfo-lectures/shannon.pdf"),
        new LinkItem("Rosetta Code Implementation", "https://rosettacode.org/wiki/Shannon-Fano_coding"),
        new LinkItem("Educational Examples", "https://www2.cs.duke.edu/csed/poop/huff/info/")
      ];
      
      this.knownVulnerabilities = [];
      
      this.tests = [
        new TestCase(
          Array.from("AAABBC").map(c => c.charCodeAt(0)),
          [0, 0, 0, 6, 0, 3, 65, 1, 0, 66, 2, 128, 67, 2, 192, 7, 21, 128],
          "Basic frequency encoding",
          "Educational test case"
        ),
        new TestCase(
          Array.from("ABCDEF").map(c => c.charCodeAt(0)),
          [0, 0, 0, 6, 0, 6, 65, 2, 0, 66, 3, 64, 67, 3, 96, 68, 2, 128, 69, 3, 192, 70, 3, 224, 0, 19, 183],
          "Alphabet frequency test",
          "Character distribution test"
        ),
        new TestCase(
          Array.from("ABABAB").map(c => c.charCodeAt(0)),
          [0, 0, 0, 6, 0, 2, 65, 1, 0, 66, 1, 128, 2, 84],
          "Repeated pattern encoding",
          "Pattern recognition test"
        )
      ];

      // For test suite compatibility
      this.testVectors = this.tests;
    }
    
    CreateInstance(isInverse = false) {
      return new ShannonFanoInstance(this, isInverse);
    }
  }
  
  class ShannonFanoInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse; // true = decompress, false = compress
      this.inputBuffer = [];
      this.codeTable = {};
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
      
      // Step 1: Build frequency table
      const frequencies = this._buildFrequencyTable(inputString);
      
      // Step 2: Sort symbols by frequency (descending)
      const sortedSymbols = Object.keys(frequencies).sort((a, b) => frequencies[b] - frequencies[a]);
      
      // Step 3: Build Shannon-Fano codes
      this.codeTable = {};
      this._buildShannonFanoCodes(sortedSymbols, frequencies, this.codeTable, '');
      
      // Step 4: Encode the data
      let encodedBits = '';
      for (let i = 0; i < inputString.length; i++) {
        const char = inputString.charAt(i);
        if (this.codeTable[char]) {
          encodedBits += this.codeTable[char];
        } else {
          throw new Error(`Character '${char}' not found in code table`);
        }
      }
      
      // Step 5: Create compressed format
      const compressed = this._packCompressedData(this.codeTable, encodedBits, inputString.length);
      
      return this._stringToBytes(compressed);
    }
    
    decompress(data) {
      if (!data || data.length === 0) return [];
      
      const compressedString = this._bytesToString(data);
      
      // Unpack compressed data
      const { codeTable, encodedBits, originalLength } = this._unpackCompressedData(compressedString);
      
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
      
      return this._stringToBytes(decoded);
    }

    /**
     * Build frequency table for characters
     * @private
     */
    _buildFrequencyTable(data) {
      const frequencies = {};
      for (let i = 0; i < data.length; i++) {
        const char = data.charAt(i);
        frequencies[char] = (frequencies[char] || 0) + 1;
      }
      return frequencies;
    }
    
    /**
     * Build Shannon-Fano codes recursively
     * @private
     */
    _buildShannonFanoCodes(symbols, frequencies, codeTable, prefix) {
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
    }
    
    /**
     * Pack compressed data with header containing code table
     * @private
     */
    _packCompressedData(codeTable, encodedBits, originalLength) {
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
    }
    
    /**
     * Unpack compressed data
     * @private
     */
    _unpackCompressedData(compressedData) {
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
      let str = "";
      for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
      }
      return str;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new ShannonFanoAlgorithm());
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShannonFanoAlgorithm;
  }
  
})(typeof global !== 'undefined' ? global : window);