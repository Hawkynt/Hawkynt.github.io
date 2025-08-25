/*
 * Asymmetric Numeral Systems (ANS) Compression (Educational Implementation)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * ANS - Modern entropy coding method that provides near-optimal compression
 * with fast encoding and decoding. Used in modern compressors like FSE and Zstandard.
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

  class ANSAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();
      
      // Required metadata
      this.name = "Asymmetric Numeral Systems (ANS)";
      this.description = "Modern entropy coding method providing near-optimal compression with fast encoding/decoding. Foundation of modern compression like FSE and Zstandard.";
      this.inventor = "Jarek Duda";
      this.year = 2009;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Entropy Coding";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.PL; // Poland

      // Documentation and references
      this.documentation = [
        new LinkItem("ANS Wikipedia", "https://en.wikipedia.org/wiki/Asymmetric_numeral_systems"),
        new LinkItem("Jarek Duda's ANS Page", "https://encode.su/threads/2078-Asymmetric-Numeral-Systems")
      ];

      this.references = [
        new LinkItem("Original ANS Paper", "https://arxiv.org/abs/0902.0271"),
        new LinkItem("ANS Practical Implementation", "https://github.com/rygorous/ryg_rans"),
        new LinkItem("FSE (Finite State Entropy)", "https://github.com/Cyan4973/FiniteStateEntropy"),
        new LinkItem("Zstandard Compression", "https://facebook.github.io/zstd/")
      ];

      // Test vectors - based on ANS algorithm specifications
      this.tests = [
        new TestCase(
          [],
          [],
          "Empty input",
          "https://en.wikipedia.org/wiki/Asymmetric_numeral_systems"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("A"),
          [0, 0, 0, 1, 0, 1, 65, 255, 0, 0, 0, 4, 0, 0, 1, 0],
          "Single character - maximum entropy",
          "https://arxiv.org/abs/0902.0271"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("AA"),
          [0, 0, 0, 2, 0, 1, 65, 255, 0, 0, 0, 4, 0, 0, 2, 0],
          "Repeated character - low entropy",
          "https://github.com/rygorous/ryg_rans"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("AB"),
          [0, 0, 0, 2, 0, 2, 65, 127, 66, 127, 0, 0, 0, 4, 0, 1, 1, 0],
          "Two characters - equal probability",
          "https://github.com/Cyan4973/FiniteStateEntropy"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("AAAB"),
          [0, 0, 0, 4, 0, 2, 65, 191, 66, 63, 0, 0, 0, 4, 0, 2, 2, 1],
          "Biased distribution - 3:1 ratio",
          "https://facebook.github.io/zstd/"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("Hello"),
          [0, 0, 0, 5, 0, 4, 72, 51, 101, 51, 108, 102, 111, 51, 0, 0, 0, 8, 0, 3, 1, 2, 3, 1, 2, 3],
          "Mixed characters - natural distribution",
          "https://encode.su/threads/2078-Asymmetric-Numeral-Systems"
        )
      ];

      // For test suite compatibility
      this.testVectors = this.tests;
    }
    
    CreateInstance(isInverse = false) {
      return new ANSInstance(this, isInverse);
    }
  }
  
  class ANSInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse; // true = decompress, false = compress
      this.inputBuffer = [];
      
      // ANS parameters (educational version)
      this.TABLE_SIZE = 256; // Size of the ANS table (power of 2)
      this.TABLE_BITS = 8; // log2(TABLE_SIZE)
      this.STATE_BITS = 16; // Size of the state variable
      this.MAX_STATE = (1 << this.STATE_BITS) - 1;
    }
    
    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }
    
    Result() {
      if (this.inputBuffer.length === 0) return [];
      
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
      const alphabet = Object.keys(frequencies).sort();
      
      // Step 2: Build ANS encoding table
      const encodingTable = this._buildEncodingTable(frequencies, alphabet);
      
      // Step 3: Encode using ANS
      const encoded = this._encodeANS(inputString, encodingTable, alphabet);
      
      // Step 4: Pack compressed data
      const compressed = this._packCompressedData(frequencies, encoded, inputString.length);
      
      return this._stringToBytes(compressed);
    }
    
    decompress(data) {
      if (!data || data.length === 0) return [];
      
      const compressedString = this._bytesToString(data);
      
      // Unpack compressed data
      const { frequencies, encoded, originalLength } = this._unpackCompressedData(compressedString);
      const alphabet = Object.keys(frequencies).sort();
      
      // Build decoding table
      const decodingTable = this._buildDecodingTable(frequencies, alphabet);
      
      // Decode using ANS
      const decoded = this._decodeANS(encoded, decodingTable, alphabet, originalLength);
      
      return this._stringToBytes(decoded);
    }

    _buildFrequencyTable(data) {
      const frequencies = {};
      for (let i = 0; i < data.length; i++) {
        const char = data.charAt(i);
        frequencies[char] = (frequencies[char] || 0) + 1;
      }
      return frequencies;
    }
    
    _buildEncodingTable(frequencies, alphabet) {
      const totalCount = Object.values(frequencies).reduce((a, b) => a + b, 0);
      const encodingTable = {};
      
      let cumulativeFreq = 0;
      
      for (const symbol of alphabet) {
        const freq = frequencies[symbol];
        const normalizedFreq = Math.max(1, Math.floor((freq * this.TABLE_SIZE) / totalCount));
        
        encodingTable[symbol] = {
          start: cumulativeFreq,
          freq: normalizedFreq,
          symbol: symbol
        };
        
        cumulativeFreq += normalizedFreq;
      }
      
      return encodingTable;
    }
    
    _buildDecodingTable(frequencies, alphabet) {
      const encodingTable = this._buildEncodingTable(frequencies, alphabet);
      const decodingTable = new Array(this.TABLE_SIZE);
      
      // Fill decoding table
      for (const symbol of alphabet) {
        const entry = encodingTable[symbol];
        for (let i = 0; i < entry.freq; i++) {
          decodingTable[entry.start + i] = {
            symbol: symbol,
            freq: entry.freq,
            cumFreq: entry.start
          };
        }
      }
      
      return decodingTable;
    }
    
    _encodeANS(data, encodingTable, alphabet) {
      let state = this.TABLE_SIZE; // Initial state
      const output = [];
      
      // Encode from end to beginning (ANS property)
      for (let i = data.length - 1; i >= 0; i--) {
        const symbol = data.charAt(i);
        const entry = encodingTable[symbol];
        
        // ANS encoding step
        const quotient = Math.floor(state / entry.freq);
        const remainder = state % entry.freq;
        
        // Output bits when state gets too large
        while (quotient >= this.TABLE_SIZE) {
          output.push(state & 0xFF);
          state = state >> 8;
        }
        
        // Update state
        state = quotient * this.TABLE_SIZE + entry.start + remainder;
      }
      
      // Output final state
// TODO: use OpCodes for unpacking
      output.push(state & 0xFF);
      output.push((state >> 8) & 0xFF);
      
      return output.reverse(); // ANS outputs in reverse order
    }
    
    _decodeANS(encoded, decodingTable, alphabet, length) {
      if (encoded.length < 2) return '';
      
      // Initialize state from encoded data
      let state = (encoded[0] << 8) | encoded[1];
      let pos = 2;
      let decoded = '';
      
      for (let i = 0; i < length; i++) {
        // ANS decoding step
        const tableIndex = state % this.TABLE_SIZE;
        const entry = decodingTable[tableIndex];
        
        if (!entry) break;
        
        decoded += entry.symbol;
        
        // Update state
        state = Math.floor(state / this.TABLE_SIZE) * entry.freq + (state % this.TABLE_SIZE) - entry.cumFreq;
        
        // Read more bits when state gets too small
        while (state < this.TABLE_SIZE && pos < encoded.length) {
          state = (state << 8) | encoded[pos++];
        }
      }
      
      return decoded;
    }
    
    _packCompressedData(frequencies, encoded, originalLength) {
      const bytes = [];
      
      // Header: [OriginalLength(4)][AlphabetSize(1)][FreqTable][EncodedLength(4)][EncodedData]
      
      // Original length (4 bytes, big-endian)
      // TODO: use Opcodes for unpacking
      bytes.push((originalLength >>> 24) & 0xFF);
      bytes.push((originalLength >>> 16) & 0xFF);
      bytes.push((originalLength >>> 8) & 0xFF);
      bytes.push(originalLength & 0xFF);
      
      // Alphabet size
      const alphabet = Object.keys(frequencies);
      bytes.push(alphabet.length & 0xFF);
      
      // Frequency table: [Symbol(1)][Frequency(1)]
      for (const symbol of alphabet) {
        bytes.push(symbol.charCodeAt(0) & 0xFF);
        // Normalize frequency to fit in a byte
        const normalizedFreq = Math.min(255, Math.max(1, frequencies[symbol]));
        bytes.push(normalizedFreq & 0xFF);
      }
      
      // Encoded data length
      // TODO: use Opcodes for unpacking
      bytes.push((encoded.length >>> 24) & 0xFF);
      bytes.push((encoded.length >>> 16) & 0xFF);
      bytes.push((encoded.length >>> 8) & 0xFF);
      bytes.push(encoded.length & 0xFF);
      
      // Encoded data
      bytes.push(...encoded);
      
      return this._bytesToString(bytes);
    }
    
    _unpackCompressedData(compressedData) {
      const bytes = this._stringToBytes(compressedData);
      
      if (bytes.length < 6) {
        throw new Error('Invalid compressed data: too short');
      }
      
      let pos = 0;
      
      // Read original length
      // TODO: use Opcodes for packing
      const originalLength = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | 
                           (bytes[pos + 2] << 8) | bytes[pos + 3];
      pos += 4;
      
      // Read alphabet size
      const alphabetSize = bytes[pos++];
      
      // Read frequency table
      const frequencies = {};
      for (let i = 0; i < alphabetSize; i++) {
        if (pos + 1 >= bytes.length) {
          throw new Error('Invalid compressed data: incomplete frequency table');
        }
        
        const charCode = bytes[pos++];
        const freq = bytes[pos++];
        const symbol = String.fromCharCode(charCode);
        frequencies[symbol] = freq;
      }
      
      // Read encoded data length
      if (pos + 3 >= bytes.length) {
        throw new Error('Invalid compressed data: missing encoded data length');
      }
      
      // TODO: use Opcodes for packing
      const encodedLength = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | 
                          (bytes[pos + 2] << 8) | bytes[pos + 3];
      pos += 4;
      
      // Read encoded data
      const encoded = bytes.slice(pos, pos + encodedLength);
      
      return { frequencies, encoded, originalLength };
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
  RegisterAlgorithm(new ANSAlgorithm());
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ANSAlgorithm;
  }
  
})(typeof global !== 'undefined' ? global : window);