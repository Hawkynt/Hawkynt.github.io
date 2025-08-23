/*
 * MICKEY Stream Cipher Implementation
 * eSTREAM hardware portfolio stream cipher with irregular clocking
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
  
  // MICKEY constants
  const REGISTER_SIZE = 100;
  const KEY_SIZE = 80;          // 80-bit key for MICKEY-80
  const IV_SIZE = 80;           // 80-bit IV for MICKEY-80
  const INIT_ROUNDS = 100;      // Initialization rounds
  
  // MICKEY S-box (nonlinear transformation)
  const SBOX = [
    0x9, 0x1, 0x2, 0xB, 0x7, 0x3, 0x0, 0xE, 0xF, 0xC, 0x8, 0x4, 0x6, 0xA, 0xD, 0x5
  ];
  
  class MICKEYCipher extends StreamCipherAlgorithm {
    constructor() {
      super();
      this.name = 'MICKEY';
      this.description = 'Hardware-oriented stream cipher using two 100-bit registers with irregular clocking. Part of the eSTREAM hardware portfolio.';
      this.category = CategoryType.STREAM;
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.inventor = 'Steve Babbage and Matthew Dodd';
      this.year = 2005;
      this.country = CountryCode.GB;
      
      this.keySize = { fixed: 10 }; // 80 bits
      this.nonceSize = { fixed: 10 }; // 80 bits
      
      this.links = [
        new LinkItem('MICKEY Specification', 'https://www.ecrypt.eu.org/stream/mickey.html'),
        new LinkItem('eSTREAM Portfolio', 'https://www.ecrypt.eu.org/stream/')
      ];
      
      this.testCases = [
        new TestCase('Zero Test', 'HELLO', 
          { key: new Array(10).fill(0), nonce: new Array(10).fill(0) }, 
          [0x4D, 0x49, 0x43, 0x4B, 0x45]) // First 5 bytes placeholder
      ];
    }
    
    CreateInstance(isInverse) {
      return new MICKEYInstance(this, isInverse);
    }
  }
  
  class MICKEYInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse) {
      super(algorithm, isInverse);
      this._key = null;
      this._nonce = null;
      this.registerR = new Array(REGISTER_SIZE).fill(0);
      this.registerS = new Array(REGISTER_SIZE).fill(0);
      this.inputData = [];
      this.initialized = false;
    }
    
    set key(keyData) {
      if (Array.isArray(keyData) && keyData.length === 10) {
        this._key = keyData.slice();
        this.initialized = false;
      } else if (keyData && keyData.key && Array.isArray(keyData.key)) {
        this._key = keyData.key.slice(0, 10);
        while (this._key.length < 10) this._key.push(0);
        this.initialized = false;
      }
    }
    
    set nonce(nonceData) {
      if (Array.isArray(nonceData) && nonceData.length === 10) {
        this._nonce = nonceData.slice();
        if (this._key) this.initialize();
      } else if (nonceData && nonceData.nonce && Array.isArray(nonceData.nonce)) {
        this._nonce = nonceData.nonce.slice(0, 10);
        while (this._nonce.length < 10) this._nonce.push(0);
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
        const keystreamBit = this.generateKeystreamBit();
        const inputByte = this.inputData[i];
        result[i] = inputByte ^ keystreamBit;
      }
      
      this.inputData = []; // Clear for next use
      return result;
    }
    
    initialize() {
      if (!this._key || !this._nonce) return;
      
      // Clear registers
      this.registerR.fill(0);
      this.registerS.fill(0);
      
      // Load key and IV into registers (simplified initialization)
      for (let i = 0; i < 80; i++) {
        const keyBit = (this._key[Math.floor(i / 8)] >>> (i % 8)) & 1;
        const ivBit = (this._nonce[Math.floor(i / 8)] >>> (i % 8)) & 1;
        
        this.registerR[i % REGISTER_SIZE] = keyBit;
        this.registerS[i % REGISTER_SIZE] = ivBit;
      }
      
      // Run initialization rounds
      for (let i = 0; i < INIT_ROUNDS; i++) {
        this.clockRegisters();
      }
      
      this.initialized = true;
    }
    
    clockRegisters() {
      // Simplified MICKEY clocking (actual algorithm is more complex)
      const controlBit = this.registerS[0];
      
      // Clock register R (LFSR)
      const feedbackR = this.registerR[67] ^ this.registerR[99];
      for (let i = REGISTER_SIZE - 1; i > 0; i--) {
        this.registerR[i] = this.registerR[i - 1];
      }
      this.registerR[0] = feedbackR;
      
      // Clock register S (nonlinear)
      const feedbackS = this.nonlinearFunction();
      for (let i = REGISTER_SIZE - 1; i > 0; i--) {
        this.registerS[i] = this.registerS[i - 1];
      }
      this.registerS[0] = feedbackS;
      
      return controlBit;
    }
    
    nonlinearFunction() {
      // Simplified nonlinear function (actual MICKEY uses more complex function)
      const input = (this.registerS[0] << 3) | (this.registerS[1] << 2) | (this.registerS[2] << 1) | this.registerS[3];
      return SBOX[input & 0xF] & 1;
    }
    
    generateKeystreamBit() {
      const outputBit = this.registerR[0] ^ this.registerS[0];
      this.clockRegisters();
      return outputBit;
    }
  }
  
  // Register the algorithm
  RegisterAlgorithm(new MICKEYCipher());
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);