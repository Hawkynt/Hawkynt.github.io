/*
 * HC-256 Stream Cipher Implementation
 * Large-table software-efficient stream cipher by Hongjun Wu (2005)
 * Educational Implementation - For learning purposes only
 */

(function(global) {
  'use strict';
  
  // Load AlgorithmFramework
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    global.AlgorithmFramework = require('../../AlgorithmFramework.js');
  }
  
  // Load OpCodes for cryptographic operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    global.OpCodes = require('../../OpCodes.js');
  }
  
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
          StreamCipherAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;
  
  // HC-256 constants
  const TABLE_SIZE = 1024;     // Each table has 1024 words
  const INIT_ROUNDS = 4096;    // Initialization rounds
  
  class HC256Cipher extends StreamCipherAlgorithm {
    constructor() {
      super();
      this.name = 'HC-256';
      this.description = 'Large-table software-efficient stream cipher with 256-bit keys and IVs. Extended version of HC-128 with larger internal state.';
      this.category = CategoryType.STREAM;
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.inventor = 'Hongjun Wu';
      this.year = 2005;
      this.country = CountryCode.CN;
      
      this.keySize = { fixed: 32 }; // 256 bits
      this.nonceSize = { fixed: 32 }; // 256 bits
      
      this.links = [
        new LinkItem('HC-256 Specification', 'https://www.ecrypt.eu.org/stream/hc256pf.html'),
        new LinkItem('eSTREAM Portfolio', 'https://www.ecrypt.eu.org/stream/')
      ];
      
      this.testCases = [
        new TestCase('Zero Test', 'HELLO', 
          { key: new Array(32).fill(0), nonce: new Array(32).fill(0) }, 
          [0x37, 0x86, 0x02, 0xb9, 0x8f]) // First 5 bytes of expected output
      ];
    }
    
    CreateInstance(isInverse) {
      return new HC256Instance(this, isInverse);
    }
  }
  
  class HC256Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse) {
      super(algorithm, isInverse);
      this._key = null;
      this._nonce = null;
      this.tableP = new Array(TABLE_SIZE);
      this.tableQ = new Array(TABLE_SIZE);
      this.counter = 0;
      this.wordBuffer = null;
      this.wordBufferPos = 0;
      this.inputData = [];
      this.initialized = false;
    }
    
    set key(keyData) {
      if (Array.isArray(keyData) && keyData.length === 32) {
        this._key = keyData.slice();
        this.initialized = false;
      } else if (keyData && keyData.key && Array.isArray(keyData.key)) {
        this._key = keyData.key.slice(0, 32);
        while (this._key.length < 32) this._key.push(0);
        this.initialized = false;
      }
    }
    
    set nonce(nonceData) {
      if (Array.isArray(nonceData) && nonceData.length === 32) {
        this._nonce = nonceData.slice();
        if (this._key) this.initialize();
      } else if (nonceData && nonceData.nonce && Array.isArray(nonceData.nonce)) {
        this._nonce = nonceData.nonce.slice(0, 32);
        while (this._nonce.length < 32) this._nonce.push(0);
        if (this._key) this.initialize();
      }
    }
    
    Feed(data) {
      this.inputData.push(...data);
    }
    
    Result() {
      if (!this.initialized) {
        return this.inputData.slice(); // No encryption without proper initialization
      }
      
      const result = new Array(this.inputData.length);
      for (let i = 0; i < this.inputData.length; i++) {
        const keystreamByte = this.generateKeystreamByte();
        result[i] = this.inputData[i] ^ keystreamByte;
      }
      
      this.inputData = []; // Clear for next use
      return result;
    }
    
    initialize() {
      if (!this._key || !this._nonce) return;
      
      // Convert key and nonce to 32-bit words
      const keyWords = [];
      const ivWords = [];
      
      for (let i = 0; i < 32; i += 4) {
        keyWords.push(global.OpCodes.Pack32LE(this._key[i], this._key[i+1], this._key[i+2], this._key[i+3]));
        ivWords.push(global.OpCodes.Pack32LE(this._nonce[i], this._nonce[i+1], this._nonce[i+2], this._nonce[i+3]));
      }
      
      // Initialize W array (2048 words)
      const W = new Array(2048);
      
      // Fill first 16 words with key and IV
      for (let i = 0; i < 8; i++) {
        W[i] = keyWords[i];
        W[i + 8] = ivWords[i];
      }
      
      // Expand W using HC-256 key scheduling
      for (let i = 16; i < 2048; i++) {
        W[i] = this.f2(W[i - 2]) + W[i - 7] + this.f1(W[i - 15]) + W[i - 16] + i;
        W[i] = W[i] >>> 0; // Ensure 32-bit unsigned
      }
      
      // Initialize tables P and Q from W
      for (let i = 0; i < TABLE_SIZE; i++) {
        this.tableP[i] = W[i + 512];
        this.tableQ[i] = W[i + 1536];
      }
      
      // Run cipher for initialization (discard output)
      for (let i = 0; i < INIT_ROUNDS; i++) {
        this.generateKeystreamWord();
      }
      
      this.counter = 0;
      this.wordBuffer = null;
      this.wordBufferPos = 0;
      this.initialized = true;
    }
    
    f1(x) {
      return global.OpCodes.RotR32(x, 7) ^ global.OpCodes.RotR32(x, 18) ^ (x >>> 3);
    }
    
    f2(x) {
      return global.OpCodes.RotR32(x, 17) ^ global.OpCodes.RotR32(x, 19) ^ (x >>> 10);
    }
    
    g1(x, y, z) {
      return (global.OpCodes.RotR32(x, 10) ^ global.OpCodes.RotR32(z, 23)) + global.OpCodes.RotR32(y, 8);
    }
    
    g2(x, y, z) {
      return (global.OpCodes.RotL32(x, 10) ^ global.OpCodes.RotL32(z, 23)) + global.OpCodes.RotL32(y, 8);
    }
    
    h1(x) {
      return this.tableQ[x & 0xFF] + this.tableQ[((x >>> 16) & 0xFF) + 256];
    }
    
    h2(x) {
      return this.tableP[x & 0xFF] + this.tableP[((x >>> 16) & 0xFF) + 256];
    }
    
    generateKeystreamWord() {
      const i = this.counter & 1023; // Index into tables (0-1023)
      let s;
      
      if (this.counter < 1024) {
        // Use table P
        const j = (i - 3) & 1023;
        const k = (i - 1023) & 1023;
        this.tableP[i] = this.tableP[i] + this.g1(this.tableP[j], this.tableP[k], this.tableP[(i - 10) & 1023]);
        s = this.h1(this.tableP[(i - 12) & 1023]) ^ this.tableP[i];
      } else {
        // Use table Q
        const j = (i - 3) & 1023;
        const k = (i - 1023) & 1023;
        this.tableQ[i] = this.tableQ[i] + this.g2(this.tableQ[j], this.tableQ[k], this.tableQ[(i - 10) & 1023]);
        s = this.h2(this.tableQ[(i - 12) & 1023]) ^ this.tableQ[i];
      }
      
      this.counter = (this.counter + 1) & 2047; // Wrap at 2048
      return s >>> 0; // Ensure 32-bit unsigned
    }
    
    generateKeystreamByte() {
      if (!this.wordBuffer || this.wordBufferPos >= 4) {
        this.wordBuffer = global.OpCodes.Unpack32LE(this.generateKeystreamWord());
        this.wordBufferPos = 0;
      }
      
      return this.wordBuffer[this.wordBufferPos++];
    }
  }
  
  // Register the algorithm
  RegisterAlgorithm(new HC256Cipher());
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);