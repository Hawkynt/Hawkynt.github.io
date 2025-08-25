/*
 * Move-to-Front (MTF) Transform Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * MTF - Data transformation that restructures data for better compressibility
 * Core component of BZIP2 compression algorithm
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

  class MTFAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();
      
      // Required metadata
      this.name = "Move-to-Front (MTF)";
      this.description = "Data transformation algorithm that restructures data for better compressibility by moving recently seen symbols to the front of the alphabet. Core component of BZIP2.";
      this.inventor = "Bentley, Sleator, Tarjan, Wei";
      this.year = 1986;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Transform";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US; // United States

      // Documentation and references
      this.documentation = [
        new LinkItem("Move-to-Front Transform - Wikipedia", "https://en.wikipedia.org/wiki/Move-to-front_transform"),
        new LinkItem("Data Compression Guide - MTF", "https://sites.google.com/view/datacompressionguide/data-transformation-methods/move-to-front-coding-mtf")
      ];

      this.references = [
        new LinkItem("A Locally Adaptive Data Compression Scheme", "https://www.cs.cmu.edu/~sleator/papers/self-organizing-lists.pdf"),
        new LinkItem("BZIP2 Algorithm Description", "https://en.wikipedia.org/wiki/Bzip2"),
        new LinkItem("GeeksforGeeks MTF Implementation", "https://www.geeksforgeeks.org/dsa/move-front-data-transform-algorithm/"),
        new LinkItem("MTF in Practice", "https://michaeldipperstein.github.io/mtf.html")
      ];

      // Test vectors - based on MTF transform specifications
      this.tests = [
        new TestCase(
          [],
          [],
          "Empty input",
          "https://en.wikipedia.org/wiki/Move-to-front_transform"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("A"),
          [65],
          "Single character - position 65 in initial alphabet",
          "https://sites.google.com/view/datacompressionguide/data-transformation-methods/move-to-front-coding-mtf"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("AA"),
          [65, 0],
          "Repeated character - second occurrence becomes 0",
          "https://www.cs.cmu.edu/~sleator/papers/self-organizing-lists.pdf"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("AB"),
          [65, 66],
          "Two different characters - both at original positions",
          "https://www.geeksforgeeks.org/dsa/move-front-data-transform-algorithm/"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("ABA"),
          [65, 66, 1],
          "Pattern ABA - A moves to front after first occurrence",
          "https://michaeldipperstein.github.io/mtf.html"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("ABACA"),
          [65, 66, 2, 67, 3],
          "ABACA pattern - shows MTF ordering dynamics",
          "https://en.wikipedia.org/wiki/Bzip2"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("banana"),
          [98, 97, 1, 2, 1, 2],
          "Classic banana example - demonstrates compression potential",
          "https://sites.google.com/view/datacompressionguide/data-transformation-methods/move-to-front-coding-mtf"
        )
      ];

      // For test suite compatibility
      this.testVectors = this.tests;
    }
    
    CreateInstance(isInverse = false) {
      return new MTFInstance(this, isInverse);
    }
  }
  
  class MTFInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse; // true = inverse transform, false = forward transform
      this.inputBuffer = [];
      
      // MTF parameters
      this.ALPHABET_SIZE = 256; // Standard byte alphabet
    }
    
    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }
    
    Result() {
      if (this.inputBuffer.length === 0) return [];
      
      const result = this.isInverse ? 
        this.inverseTransform(this.inputBuffer) : 
        this.forwardTransform(this.inputBuffer);
      
      this.inputBuffer = [];
      return result;
    }
    
    forwardTransform(data) {
      if (!data || data.length === 0) return [];
      
      // Initialize alphabet with all possible byte values in order
      const alphabet = [];
      for (let i = 0; i < this.ALPHABET_SIZE; i++) {
        alphabet.push(i);
      }
      
      const output = [];
      
      for (let i = 0; i < data.length; i++) {
        const symbol = data[i];
        
        // Find position of symbol in current alphabet
        const position = alphabet.indexOf(symbol);
        
        if (position === -1) {
          // This shouldn't happen for valid byte data
          throw new Error(`Symbol ${symbol} not found in alphabet`);
        }
        
        // Output the position
        output.push(position);
        
        // Move symbol to front of alphabet
        if (position > 0) {
          alphabet.splice(position, 1); // Remove from current position
          alphabet.unshift(symbol); // Add to front
        }
      }
      
      return output;
    }
    
    inverseTransform(data) {
      if (!data || data.length === 0) return [];
      
      // Initialize alphabet with all possible byte values in order
      const alphabet = [];
      for (let i = 0; i < this.ALPHABET_SIZE; i++) {
        alphabet.push(i);
      }
      
      const output = [];
      
      for (let i = 0; i < data.length; i++) {
        const position = data[i];
        
        // Validate position
        if (position < 0 || position >= this.ALPHABET_SIZE) {
          throw new Error(`Invalid MTF position: ${position}`);
        }
        
        // Get symbol at this position
        const symbol = alphabet[position];
        output.push(symbol);
        
        // Move symbol to front of alphabet
        if (position > 0) {
          alphabet.splice(position, 1); // Remove from current position
          alphabet.unshift(symbol); // Add to front
        }
      }
      
      return output;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new MTFAlgorithm());
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MTFAlgorithm;
  }
  
})(typeof global !== 'undefined' ? global : window);