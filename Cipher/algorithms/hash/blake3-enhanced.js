/*
 * BLAKE3 Implementation - High-Performance Cryptographic Hash Function
 * Next-generation hash function designed for speed and security
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
          CryptoAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = global.AlgorithmFramework;

  class BLAKE3Enhanced extends CryptoAlgorithm {
    constructor() {
      super();
      
      // Required metadata
      this.name = "BLAKE3-Enhanced";
      this.description = "High-performance cryptographic hash function designed as the successor to BLAKE2. Features extreme parallelism, variable output length, and multiple modes (hash, KDF, MAC, PRF).";
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = null; // Modern secure hash - no specific status needed
      this.complexity = ComplexityType.MEDIUM;
      
      // Algorithm properties
      this.inventor = "Jack O'Connor, Jean-Philippe Aumasson, Samuel Neves, Zooko Wilcox-O'Hearn";
      this.year = 2020;
      this.country = CountryCode.MULTI;
      
      // Hash-specific properties
      this.hashSize = 256; // bits (32 bytes default)
      this.blockSize = 512; // bits (64 bytes)
      
      // Documentation
      this.documentation = [
        new LinkItem("BLAKE3 Specification", "https://github.com/BLAKE3-team/BLAKE3-specs/blob/master/blake3.pdf"),
        new LinkItem("Official Website", "https://blake3.io/"),
        new LinkItem("Design Paper", "https://eprint.iacr.org/2019/026")
      ];
      
      this.references = [
        new LinkItem("Reference Implementation", "https://github.com/BLAKE3-team/BLAKE3"),
        new LinkItem("Performance Benchmarks", "https://blake3.io/performance.html"),
        new LinkItem("Security Analysis", "https://eprint.iacr.org/2019/026")
      ];
      
      // Convert tests to new format
      this.tests = [
        new TestCase(
          "BLAKE3 Test Vector 1 (Empty)",
          "Official test vectors",
          OpCodes.Hex8ToBytes(""),
          null,
          OpCodes.Hex8ToBytes("AF1349B9F5F9A1A6A0404DEA36DCC9499BCB25C9ADC112B7CC9A93CAE41F3262")
        ),
        new TestCase(
          "BLAKE3 Test Vector 2 (abc)",
          "Official test vectors", 
          OpCodes.AnsiToBytes("abc"),
          null,
          OpCodes.Hex8ToBytes("6437B3AC38465133FFB63B75273A8DB548C558465D79DB03FD359C6CD5BD9D85")
        )
      ];
      
      // For test suite compatibility
      this.testVectors = this.tests;
      
      // BLAKE3 constants
      this.IV = [
        0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
        0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19
      ];
    }
    
    CreateInstance(isInverse = false) {
      return new BLAKE3EnhancedInstance(this, isInverse);
    }
  }

  class BLAKE3EnhancedInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.inputBuffer = [];
      this.hashSize = algorithm.hashSize;
      this.blockSize = algorithm.blockSize;
      this.key = null;
      this.keyScheduled = false;
      this.IV = algorithm.IV;
    }
    
    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }
    
    Result() {
      if (this.inputBuffer.length === 0) return [];
      
      // Process using existing hash logic
      const result = this.hash(this.inputBuffer, 32);
      
      this.inputBuffer = [];
      return result;
    }
    
    // Key setup for BLAKE3 keyed mode
    KeySetup(key) {
      if (key && key.length > 0) {
        if (key.length !== 32) {
          throw new Error('BLAKE3 key must be exactly 32 bytes');
        }
        this.key = OpCodes.CopyArray(key);
      } else {
        this.key = null;
      }
      
      this.keyScheduled = true;
      return 'blake3-enhanced-' + Math.random().toString(36).substr(2, 9);
    }
    
    // Simplified BLAKE3 hash (educational implementation)
    hash(input, outputLen) {
      outputLen = outputLen || 32;
      
      // Initialize state with IV or key
      let state = this.key ? this.wordsFromKey(this.key) : OpCodes.CopyArray(this.IV);
      
      // Process input in 64-byte blocks
      for (let i = 0; i < input.length; i += 64) {
        const block = input.slice(i, i + 64);
        while (block.length < 64) {
          block.push(0);
        }
        
        state = this.compressBlock(state, block, i / 64);
      }
      
      // Generate output
      return this.extractOutput(state, outputLen);
    }
    
    // Convert key to words
    wordsFromKey(key) {
      const words = [];
      for (let i = 0; i < 8; i++) {
        words.push(OpCodes.Pack32LE(
          key[i * 4] || 0, key[i * 4 + 1] || 0,
          key[i * 4 + 2] || 0, key[i * 4 + 3] || 0
        ));
      }
      return words;
    }
    
    // Compress block (simplified)
    compressBlock(state, block, blockCounter) {
      const newState = OpCodes.CopyArray(state);
      
      // Simple compression using block data
      for (let i = 0; i < 8; i++) {
        const blockWord = OpCodes.Pack32LE(
          block[i * 8] || 0, block[i * 8 + 1] || 0,
          block[i * 8 + 2] || 0, block[i * 8 + 3] || 0
        );
        
        newState[i] ^= blockWord;
        newState[i] = OpCodes.RotL32(newState[i], 7 + i);
        newState[i] += blockCounter;
        newState[i] >>>= 0;
      }
      
      return newState;
    }
    
    // Extract output
    extractOutput(state, outputLen) {
      const output = [];
      
      for (let i = 0; i < outputLen; i += 4) {
        const wordIndex = Math.floor(i / 4) % 8;
        const bytes = OpCodes.Unpack32LE(state[wordIndex]);
        
        for (let j = 0; j < 4 && output.length < outputLen; j++) {
          output.push(bytes[j]);
        }
      }
      
      return output.slice(0, outputLen);
    }
    
    // Legacy cipher interface
    szEncryptBlock(blockIndex, plaintext) {
      return this.hash(plaintext, 32);
    }
    
    szDecryptBlock(blockIndex, ciphertext) {
      throw new Error('BLAKE3 is a one-way hash function and cannot be decrypted');
    }
    
    ClearData() {
      if (this.key) {
        OpCodes.ClearArray(this.key);
      }
      this.keyScheduled = false;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new BLAKE3Enhanced());
  
})(typeof global !== 'undefined' ? global : window);