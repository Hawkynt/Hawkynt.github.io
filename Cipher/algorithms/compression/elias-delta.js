/*
 * Universal Elias Delta Coding
 * Compatible with both Browser and Node.js environments
 * Educational implementation of Peter Elias's improved universal integer encoding
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
  
  class EliasDeltaAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();
      
      // Required metadata
      this.name = "Elias Delta Coding";
      this.description = "Peter Elias improved universal integer encoding, more efficient than Gamma for larger numbers using variable-length prefix codes.";
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Universal";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.inventor = "Peter Elias";
      this.year = 1975;
      this.country = CountryCode.US;
      
      this.documentation = [
        new LinkItem("Universal codeword sets and representations of the integers", "https://ieeexplore.ieee.org/document/1054906"),
        new LinkItem("Elias Delta Coding - Wikipedia", "https://en.wikipedia.org/wiki/Elias_delta_coding"),
        new LinkItem("Information Theory and Coding", "https://web.stanford.edu/class/ee376a/")
      ];
      
      this.references = [
        new LinkItem("Elements of Information Theory", "https://www.wiley.com/en-us/Elements+of+Information+Theory%2C+2nd+Edition-p-9780471241959"),
        new LinkItem("Introduction to Data Compression", "https://www.elsevier.com/books/introduction-to-data-compression/sayood/978-0-12-620862-7")
      ];
      
      // Convert existing tests to new format
      this.tests = [
        new TestCase(
          [0x01, 0x02, 0x03, 0x04, 0x05],
          [0, 0, 0, 5, 0, 0, 0, 23, 69, 99, 92],
          "Small integer sequence",
          "Educational test case"
        ),
        new TestCase(
          [0x7F, 0x80, 0x81, 0xFF],
          [0, 0, 0, 4, 0, 0, 0, 57, 16, 0, 64, 17, 0, 132, 128, 0],
          "Mixed small and large values",
          "Boundary value test"
        )
      ];
      
      // For test suite compatibility
      this.testVectors = this.tests;
    }
    
    CreateInstance(isInverse = false) {
      return new EliasDeltaInstance(this, isInverse);
    }
  }
  
  class EliasDeltaInstance extends IAlgorithmInstance {
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
      
      let bitStream = '';
      
      // Encode each byte using Elias Delta
      for (const byte of data) {
        // Elias Delta cannot encode 0, so we use byte + 1
        const value = byte + 1;
        const deltaCode = this._encodeDelta(value);
        bitStream += deltaCode;
      }
      
      // Store original length and convert to bytes
      const compressed = this._packBitStream(bitStream, data.length);
      
      return this._stringToBytes(compressed);
    }
    
    decompress(data) {
      if (!data || data.length === 0) return [];
      
      const compressedString = this._bytesToString(data);
      
      // Unpack bit stream and get original length
      const { bitStream, originalLength } = this._unpackBitStream(compressedString);
      
      const decodedBytes = [];
      let pos = 0;
      
      // Decode until we have the expected number of bytes
      while (decodedBytes.length < originalLength && pos < bitStream.length) {
        const { value, bitsConsumed } = this._decodeDelta(bitStream, pos);
        
        if (value === null) {
          throw new Error('Invalid Elias Delta code in compressed data');
        }
        
        // Convert back to byte (subtract 1 since we added 1 during encoding)
        const byte = value - 1;
        if (byte < 0 || byte > 255) {
          throw new Error('Invalid byte value in compressed data');
        }
        
        decodedBytes.push(byte);
        pos += bitsConsumed;
      }
      
      if (decodedBytes.length !== originalLength) {
        throw new Error('Decompressed length mismatch');
      }
      
      return decodedBytes;
    }
    
    
    
    
    
    /**
     * Encode a positive integer using Elias Delta coding
     * Format: gamma(1 + floor(log2(n))) + binary(n - 2^floor(log2(n)))
     * @private
     */
    _encodeDelta(value) {
      if (value <= 0) {
        throw new Error('Elias Delta can only encode positive integers');
      }
      
      // Special case for 1
      if (value === 1) {
        return '1';
      }
      
      // Calculate number of bits needed for binary representation
      const bitsNeeded = Math.floor(Math.log2(value));
      
      // Encode length using Elias Gamma (length + 1)
      const lengthCode = this._encodeGamma(bitsNeeded + 1);
      
      // Create binary representation without leading 1
      const binaryValue = value.toString(2);
      const binarySuffix = binaryValue.substring(1); // Remove leading '1'
      
      return lengthCode + binarySuffix;
    }
    
    /**
     * Decode an Elias Delta code from bit stream
     * @private
     */
    _decodeDelta(bitStream, startPos) {
      if (startPos >= bitStream.length) {
        return { value: null, bitsConsumed: 0 };
      }
      
      // First decode the length using Elias Gamma
      const gammaResult = this._decodeGamma(bitStream, startPos);
      if (gammaResult.value === null) {
        return { value: null, bitsConsumed: 0 };
      }
      
      const length = gammaResult.value - 1; // Subtract 1 to get actual length
      let pos = startPos + gammaResult.bitsConsumed;
      
      // Special case for length 0 (value is 1)
      if (length === 0) {
        return { value: 1, bitsConsumed: gammaResult.bitsConsumed };
      }
      
      // Read binary suffix
      if (pos + length > bitStream.length) {
        return { value: null, bitsConsumed: 0 };
      }
      
      const binarySuffix = bitStream.substring(pos, pos + length);
      const value = parseInt('1' + binarySuffix, 2);
      
      return { 
        value: value, 
        bitsConsumed: gammaResult.bitsConsumed + length 
      };
    }
    
    /**
     * Encode using Elias Gamma (helper function)
     * @private
     */
    _encodeGamma(value) {
      if (value <= 0) {
        throw new Error('Elias Gamma can only encode positive integers');
      }
      
      // Special case for 1
      if (value === 1) {
        return '1';
      }
      
      // Calculate number of bits needed
      const bitsNeeded = Math.floor(Math.log2(value));
      
      // Create unary prefix (bitsNeeded zeros followed by 1)
      const unaryPrefix = '0'.repeat(bitsNeeded) + '1';
      
      // Create binary suffix (value without leading 1)
      const binaryValue = value.toString(2);
      const binarySuffix = binaryValue.substring(1); // Remove leading '1'
      
      return unaryPrefix + binarySuffix;
    }
    
    /**
     * Decode Elias Gamma (helper function)
     * @private
     */
    _decodeGamma(bitStream, startPos) {
      if (startPos >= bitStream.length) {
        return { value: null, bitsConsumed: 0 };
      }
      
      // Count leading zeros (unary part)
      let zeros = 0;
      let pos = startPos;
      
      while (pos < bitStream.length && bitStream[pos] === '0') {
        zeros++;
        pos++;
      }
      
      // Check for terminating '1'
      if (pos >= bitStream.length || bitStream[pos] !== '1') {
        return { value: null, bitsConsumed: 0 };
      }
      
      pos++; // Skip the '1'
      
      // Read binary suffix
      if (zeros === 0) {
        // Special case: value is 1
        return { value: 1, bitsConsumed: 1 };
      }
      
      if (pos + zeros > bitStream.length) {
        return { value: null, bitsConsumed: 0 };
      }
      
      const binarySuffix = bitStream.substring(pos, pos + zeros);
      const value = parseInt('1' + binarySuffix, 2);
      
      return { value: value, bitsConsumed: zeros + 1 + zeros };
    }
    
    /**
     * Pack bit stream into bytes with header
     * @private
     */
    _packBitStream(bitStream, originalLength) {
      const bytes = [];
      
      // Store original length (4 bytes, big-endian)
      bytes.push((originalLength >>> 24) & 0xFF);
      bytes.push((originalLength >>> 16) & 0xFF);
      bytes.push((originalLength >>> 8) & 0xFF);
      bytes.push(originalLength & 0xFF);
      
      // Store bit stream length (4 bytes, big-endian)
      const bitLength = bitStream.length;
      bytes.push((bitLength >>> 24) & 0xFF);
      bytes.push((bitLength >>> 16) & 0xFF);
      bytes.push((bitLength >>> 8) & 0xFF);
      bytes.push(bitLength & 0xFF);
      
      // Pad bit stream to byte boundary
      const padding = (8 - (bitStream.length % 8)) % 8;
      const paddedBits = bitStream + '0'.repeat(padding);
      
      // Convert to bytes
      for (let i = 0; i < paddedBits.length; i += 8) {
        const byte = paddedBits.substr(i, 8);
        bytes.push(parseInt(byte, 2));
      }
      
      return this._bytesToString(bytes);
    }
    
    /**
     * Unpack bit stream from bytes
     * @private
     */
    _unpackBitStream(compressedData) {
      const bytes = this._stringToBytes(compressedData);
      
      if (bytes.length < 8) {
        throw new Error('Invalid compressed data: header too short');
      }
      
      // Read original length
      const originalLength = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
      
      // Read bit stream length
      const bitLength = (bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7];
      
      // Convert bytes back to bit stream
      let bitStream = '';
      for (let i = 8; i < bytes.length; i++) {
        bitStream += bytes[i].toString(2).padStart(8, '0');
      }
      
      // Trim to actual bit length
      bitStream = bitStream.substring(0, bitLength);
      
      return { bitStream, originalLength };
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
  RegisterAlgorithm(new EliasDeltaAlgorithm());
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EliasDeltaAlgorithm;
  }
  
})(typeof global !== 'undefined' ? global : window);