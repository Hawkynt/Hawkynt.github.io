/*
 * Fibonacci Coding Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * Educational implementation of Fibonacci number representation coding
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

  class FibonacciCompression extends CompressionAlgorithm {
    constructor() {
      super();
      
      // Required metadata
      this.name = "Fibonacci Coding";
      this.description = "Universal integer encoding using Fibonacci number representation. Each number is represented as a sum of non-consecutive Fibonacci numbers, terminated with '11'. More efficient than unary for larger numbers.";
      this.inventor = "Edouard Zeckendorf";
      this.year = 1972;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Universal";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      // Pre-computed Fibonacci numbers for efficiency (first 32 numbers)
      this.fibNumbers = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 
                         2584, 4181, 6765, 10946, 17711, 28657, 46368, 75025, 121393, 
                         196418, 317811, 514229, 832040, 1346269, 2178309, 3524578];

      // Documentation and references
      this.documentation = [
        new LinkItem("Fibonacci Coding - Wikipedia", "https://en.wikipedia.org/wiki/Fibonacci_coding"),
        new LinkItem("Zeckendorf's Theorem", "https://en.wikipedia.org/wiki/Zeckendorf%27s_theorem"),
        new LinkItem("Universal Codes Tutorial", "https://web.stanford.edu/class/ee398a/handouts/lectures/05-UniversalCoding.pdf")
      ];

      this.references = [
        new LinkItem("Elements of Information Theory", "https://www.wiley.com/en-us/Elements+of+Information+Theory%2C+2nd+Edition-p-9780471241959"),
        new LinkItem("Data Compression Book", "https://www.elsevier.com/books/introduction-to-data-compression/sayood/978-0-12-809474-7"),
        new LinkItem("Fibonacci Applications", "https://www.mathsisfun.com/numbers/fibonacci-sequence.html")
      ];

      // Test vectors with proper Fibonacci coding representations
      this.tests = [
        new TestCase(
          [1], // Number 1
          [1, 1], // Fibonacci code: "11" (binary bits as array)
          "Fibonacci coding of number 1",
          "https://en.wikipedia.org/wiki/Fibonacci_coding"
        ),
        new TestCase(
          [2], // Number 2  
          [0, 1, 1], // Fibonacci code: "011" (binary bits as array)
          "Fibonacci coding of number 2",
          "https://en.wikipedia.org/wiki/Fibonacci_coding"
        ),
        new TestCase(
          [6], // Number 6 = F₅ + F₂ = 5 + 1
          [1, 0, 0, 1, 1], // Fibonacci code: "10011" (binary bits as array)
          "Fibonacci coding of number 6 (5+1)",
          "https://cp-algorithms.com/algebra/fibonacci-numbers.html"
        ),
        new TestCase(
          [8], // Number 8 = F₆
          [0, 0, 0, 0, 1, 1], // Fibonacci code: "000011" (binary bits as array)
          "Fibonacci coding of number 8",
          "https://cp-algorithms.com/algebra/fibonacci-numbers.html"
        ),
        new TestCase(
          [11], // Number 11 = F₇ + F₅ = 8 + 3
          [0, 0, 1, 0, 1, 1], // Fibonacci code: "001011" (binary bits as array)  
          "Fibonacci coding of number 11 (8+3)",
          "https://www.geeksforgeeks.org/fibonacci-coding/"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new FibonacciInstance(this, isInverse);
    }
  }

  class FibonacciInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this.fibNumbers = algorithm.fibNumbers;
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
      let bitString = '';
      
      // Encode each byte using Fibonacci coding
      for (const byte of this.inputBuffer) {
        if (byte === 0) {
          // Special case: 0 is encoded as "11" 
          bitString += '11';
        } else {
          bitString += this._encodeFibonacci(byte);
        }
      }
      
      // Convert bit string to bytes
      const bytes = this._bitStringToBytes(bitString);
      
      // Clear input buffer
      this.inputBuffer = [];
      
      return bytes;
    }

    _decompress() {
      // Convert bytes to bit string
      const bitString = this._bytesToBitString(this.inputBuffer);
      
      // Decode Fibonacci codes
      const result = [];
      let i = 0;
      
      while (i < bitString.length - 1) {
        const { value, nextIndex } = this._decodeFibonacci(bitString, i);
        if (nextIndex === -1) break; // Invalid code
        result.push(value);
        i = nextIndex;
      }
      
      // Clear input buffer
      this.inputBuffer = [];
      
      return result;
    }

    _encodeFibonacci(num) {
      if (num <= 0) return '11'; // Special case for 0
      
      // Find Fibonacci representation using greedy algorithm
      const bits = new Array(this.fibNumbers.length).fill(0);
      let remaining = num;
      
      // Work backwards from largest Fibonacci number
      for (let i = this.fibNumbers.length - 1; i >= 0 && remaining > 0; i--) {
        if (this.fibNumbers[i] <= remaining) {
          bits[i] = 1;
          remaining -= this.fibNumbers[i];
        }
      }
      
      // Build bit string (reverse order) and add terminating "11"
      let result = '';
      for (let i = 0; i < bits.length; i++) {
        result = bits[i] + result;
      }
      
      // Remove leading zeros and add terminating 1
      result = result.replace(/^0+/, '') + '1';
      
      return result;
    }

    _decodeFibonacci(bitString, startIndex) {
      let i = startIndex;
      let prevBit = '0';
      let fibBits = '';
      
      // Read until we find "11" terminator
      while (i < bitString.length) {
        const currentBit = bitString[i];
        fibBits += currentBit;
        
        if (prevBit === '1' && currentBit === '1') {
          // Found terminator "11", decode the number
          const value = this._fibBitsToNumber(fibBits.slice(0, -1)); // Remove last '1'
          return { value, nextIndex: i + 1 };
        }
        
        prevBit = currentBit;
        i++;
      }
      
      return { value: 0, nextIndex: -1 }; // Invalid code
    }

    _fibBitsToNumber(bits) {
      if (bits.length === 0) return 0;
      
      let result = 0;
      // Process bits from right to left (least significant first)
      for (let i = 0; i < bits.length && i < this.fibNumbers.length; i++) {
        if (bits[bits.length - 1 - i] === '1') {
          result += this.fibNumbers[i];
        }
      }
      
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
  RegisterAlgorithm(new FibonacciCompression());

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FibonacciCompression;
  }

})(typeof global !== 'undefined' ? global : window);