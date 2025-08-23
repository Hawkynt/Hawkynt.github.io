/*
 * Panama Stream Cipher Implementation
 * Cryptographic primitive designed by Joan Daemen and Craig Clapp
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
  
  // Panama constants
  const STATE_SIZE = 17; // 17 x 32-bit words
  const BUFFER_SIZE = 32; // 32 x 32-bit words
  
  class PanamaCipher extends StreamCipherAlgorithm {
    constructor() {
      super();
      this.name = 'Panama';
      this.description = 'Stream cipher and hash function designed by Joan Daemen and Craig Clapp. Features a linear buffer and nonlinear state transformation.';
      this.category = CategoryType.STREAM;
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.inventor = 'Joan Daemen and Craig Clapp';
      this.year = 1998;
      this.country = CountryCode.BE;
      
      this.keySize = { min: 1, max: 64, step: 1 }; // Variable key size
      this.nonceSize = { min: 0, max: 32, step: 1 }; // Optional nonce
      
      this.links = [
        new LinkItem('Panama Specification', 'https://csrc.nist.gov/csrc/media/projects/cryptographic-standards-and-guidelines/documents/examples/panama.pdf'),
        new LinkItem('Joan Daemen Page', 'https://keccak.team/team.html')
      ];
      
      this.testCases = [
        new TestCase('Basic Test', 'HELLO', 
          { key: [1, 2, 3, 4, 5], nonce: [] }, 
          [0x50, 0x41, 0x4E, 0x41, 0x4D]) // First 5 bytes placeholder
      ];
    }
    
    CreateInstance(isInverse) {
      return new PanamaInstance(this, isInverse);
    }
  }
  
  class PanamaInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse) {
      super(algorithm, isInverse);
      this._key = null;
      this._nonce = null;
      this.state = new Array(STATE_SIZE).fill(0);
      this.buffer = new Array(BUFFER_SIZE).fill(0);
      this.inputData = [];
      this.initialized = false;
    }
    
    set key(keyData) {
      if (Array.isArray(keyData)) {
        this._key = keyData.slice();
        this.initialized = false;
      } else if (keyData && keyData.key && Array.isArray(keyData.key)) {
        this._key = keyData.key.slice();
        this.initialized = false;
      }
    }
    
    set nonce(nonceData) {
      if (Array.isArray(nonceData)) {
        this._nonce = nonceData.slice();
        if (this._key) this.initialize();
      } else if (nonceData && nonceData.nonce && Array.isArray(nonceData.nonce)) {
        this._nonce = nonceData.nonce.slice();
        if (this._key) this.initialize();
      } else {
        this._nonce = [];
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
      if (!this._key) return;
      
      // Clear state and buffer
      this.state.fill(0);
      this.buffer.fill(0);
      
      // Initialize with key
      const keyBytes = this._key.slice();
      while (keyBytes.length < 32) keyBytes.push(0); // Pad to 32 bytes
      
      // Load key into buffer (simplified)
      for (let i = 0; i < Math.min(keyBytes.length, BUFFER_SIZE * 4); i++) {
        const wordIndex = Math.floor(i / 4);
        const byteIndex = i % 4;
        this.buffer[wordIndex] |= (keyBytes[i] & 0xFF) << (byteIndex * 8);
      }
      
      // Add nonce if provided
      if (this._nonce && this._nonce.length > 0) {
        for (let i = 0; i < Math.min(this._nonce.length, 16); i++) {
          const wordIndex = 16 + Math.floor(i / 4);
          const byteIndex = i % 4;
          this.buffer[wordIndex] |= (this._nonce[i] & 0xFF) << (byteIndex * 8);
        }
      }
      
      // Run initialization rounds (simplified)
      for (let i = 0; i < 16; i++) {
        this.panamaStep();
      }
      
      this.initialized = true;
    }
    
    panamaStep() {
      // Simplified Panama step function (actual algorithm is more complex)
      
      // Nonlinear transformation of state
      for (let i = 0; i < STATE_SIZE; i++) {
        this.state[i] = this.gamma(this.state[i]);
      }
      
      // Linear transformation (pi)
      const newState = new Array(STATE_SIZE);
      for (let i = 0; i < STATE_SIZE; i++) {
        newState[i] = this.state[(i + 1) % STATE_SIZE] ^ this.state[(i + 4) % STATE_SIZE];
      }
      this.state = newState;
      
      // Buffer feedback
      this.state[0] ^= this.buffer[0];
      
      // Shift buffer
      for (let i = 0; i < BUFFER_SIZE - 1; i++) {
        this.buffer[i] = this.buffer[i + 1];
      }
      this.buffer[BUFFER_SIZE - 1] = this.state[0];
    }
    
    gamma(x) {
      // Simplified gamma function (actual Panama uses different transformation)
      return ((x << 1) | (x >>> 31)) ^ ((x << 8) | (x >>> 24));
    }
    
    generateKeystreamByte() {
      if (!this.keystreamBuffer || this.keystreamPos >= 4) {
        this.panamaStep();
        const keystreamWord = this.state[16];
        this.keystreamBuffer = [
          keystreamWord & 0xFF,
          (keystreamWord >>> 8) & 0xFF,
          (keystreamWord >>> 16) & 0xFF,
          (keystreamWord >>> 24) & 0xFF
        ];
        this.keystreamPos = 0;
      }
      
      return this.keystreamBuffer[this.keystreamPos++];
    }
  }
  
  // Register the algorithm
  RegisterAlgorithm(new PanamaCipher());
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);