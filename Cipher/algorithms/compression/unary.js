/*
 * Unary Coding Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * Educational implementation of unary number representation
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

  class UnaryCompression extends CompressionAlgorithm {
    constructor() {
      super();
      
      // Required metadata
      this.name = "Unary Coding";
      this.description = "Universal integer coding where number n is represented by n-1 ones followed by a zero. Simple but inefficient for large numbers, mainly used in combination with other codes or for very small values.";
      this.inventor = "Information Theory (fundamental)";
      this.year = 1940;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Universal";
      this.securityStatus = null;
      this.complexity = ComplexityType.ELEMENTARY;
      this.country = CountryCode.UNKNOWN;

      // Documentation and references
      this.documentation = [
        new LinkItem("Unary Coding - Wikipedia", "https://en.wikipedia.org/wiki/Unary_coding"),
        new LinkItem("Universal Codes Tutorial", "https://web.stanford.edu/class/ee398a/handouts/lectures/05-UniversalCoding.pdf"),
        new LinkItem("Information Theory Basics", "https://www.inference.org.uk/itprnn/book.pdf")
      ];

      this.references = [
        new LinkItem("Elements of Information Theory", "https://www.wiley.com/en-us/Elements+of+Information+Theory%2C+2nd+Edition-p-9780471241959"),
        new LinkItem("Data Compression Book", "https://www.data-compression.com/theory.html"),
        new LinkItem("Coding Theory Reference", "https://www.cambridge.org/core/books/introduction-to-coding-theory/")
      ];

      // Test vectors with expected compressed output
      this.tests = [
        {
          text: "Small values - optimal for unary",
          uri: "https://en.wikipedia.org/wiki/Unary_coding",
          input: [1, 2, 3, 4], // Small numbers
          expected: global.OpCodes.Hex8ToBytes("000A5B80") // Compressed form
        },
        {
          text: "Single small value", 
          uri: "Educational test",
          input: [5], // Single number: 11110
          expected: global.OpCodes.Hex8ToBytes("0005F0") // Compressed form
        },
        {
          text: "Mixed small values",
          uri: "Educational test", 
          input: [1, 3, 2, 1], // Various small numbers
          expected: global.OpCodes.Hex8ToBytes("000768") // Compressed form
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new UnaryInstance(this, isInverse);
    }
  }

  class UnaryInstance extends IAlgorithmInstance {
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
      
      // TODO: use Opcodes for bitstream
      let bitString = '';
      
      // Encode each byte using unary coding (standard: n -> n-1 ones followed by zero)
      for (const byte of this.inputBuffer) {
        if (byte === 0) {
          // Special case: encode 0 as "00" to distinguish from 1
          bitString += '00';
        } else {
          // n is encoded as (n-1) ones followed by a zero
          bitString += '1'.repeat(byte - 1) + '0';
        }
      }
      
      // Store original bit length for decompression
      const originalBitLength = bitString.length;
      
      // Convert bit string to bytes
      const bytes = this._bitStringToBytes(bitString);
      
      // Prepend the original bit length as two bytes (length up to 65535 bits)
// TODO: use OpCodes for unpacking
      const lengthBytes = [(originalBitLength >> 8) & 0xFF, originalBitLength & 0xFF];
      
      // Clear input buffer
      this.inputBuffer = [];
      
      return lengthBytes.concat(bytes);
    }

    _decompress() {
      if (this.inputBuffer.length < 2) {
        this.inputBuffer = [];
        return [];
      }
      
      // Read original bit length from first two bytes
// TODO: use OpCodes for packing
      const originalBitLength = (this.inputBuffer[0] << 8) | this.inputBuffer[1];
      const dataBytes = this.inputBuffer.slice(2);
      
      // Convert bytes to bit string
      const fullBitString = this._bytesToBitString(dataBytes);
      
      // Truncate to original length
      const bitString = fullBitString.substring(0, originalBitLength);
      
      // Decode unary codes
      const result = [];
      let i = 0;
      
      while (i < bitString.length) {
        let count = 0;
        
        // Count consecutive 1s
        while (i < bitString.length && bitString[i] === '1') {
          count++;
          i++;
        }
        
        // Look for terminating 0
        if (i < bitString.length && bitString[i] === '0') {
          i++;
          
          // Check if this is the special case for 0 (encoded as "00")
          if (count === 0 && i < bitString.length && bitString[i] === '0') {
            i++; // Skip second 0
            result.push(0);
          } else {
            // Standard unary: n = count + 1
            result.push(count + 1);
          }
        } else if (count > 0) {
          // No terminating 0 found - treat as incomplete
          break;
        } else {
          // All zeros at end - stop processing
          break;
        }
      }
      
      // Clear input buffer
      this.inputBuffer = [];
      
      return result;
    }

    _bitStringToBytes(bitString) {
      const bytes = [];
      
      // Pad to multiple of 8 bits
      while (bitString.length % 8 !== 0) {
        bitString += '0';
      }
      
      // Convert each 8-bit group to a byte
      for (let i = 0; i < bitString.length; i += 8) {
        const byteStr = bitString.substr(i, 8);
        const byteVal = parseInt(byteStr, 2);
        bytes.push(byteVal);
      }
      
      return bytes;
    }

    _bytesToBitString(bytes) {
      let bitString = '';
      
      for (const byte of bytes) {
        // Convert each byte to 8-bit binary string
        bitString += byte.toString(2).padStart(8, '0');
      }
      
      return bitString;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new UnaryCompression());

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = UnaryCompression;
  }

})(typeof global !== 'undefined' ? global : window);