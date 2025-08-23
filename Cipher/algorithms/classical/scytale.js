/*
 * AlgorithmFramework Scytale Cipher
 * Compatible with both Browser and Node.js environments
 * Ancient Spartan transposition cipher using a staff
 * (c)2025 Hawkynt - Educational Implementation
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

class ScytaleCipher extends CryptoAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Scytale Cipher";
    this.description = "Ancient Spartan transposition cipher using a staff for military communications in classical antiquity.";
    this.category = CategoryType.CLASSICAL;
    this.subCategory = "Transposition Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.BEGINNER;
    this.inventor = "Ancient Spartans";
    this.year = -500; // 5th century BC
    this.country = CountryCode.ANCIENT;
    
    // Documentation
    this.documentation = [
      new LinkItem('Scytale Cipher Wikipedia', 'https://en.wikipedia.org/wiki/Scytale'),
      new LinkItem('Ancient Cryptography', 'http://practicalcryptography.com/ciphers/classical-era/scytale/')
    ];
    
    // Convert test vectors to new format (strings to byte arrays)
    this.tests = [
      (() => {
        const test = new TestCase(
          Array.from('WEAREFOUNDOUT').map(c => c.charCodeAt(0)), 
          Array.from('WRODTEEUOAFNU').map(c => c.charCodeAt(0)),
          'Basic Scytale example with circumference 3'
        );
        test.key = Array.from('3').map(c => c.charCodeAt(0));
        return test;
      })(),
      (() => {
        const test = new TestCase(
          Array.from('ATTACKATDAWN').map(c => c.charCodeAt(0)),
          Array.from('ACDTKATAWATN').map(c => c.charCodeAt(0)),
          'Military message with circumference 4'
        );
        test.key = Array.from('4').map(c => c.charCodeAt(0));
        return test;
      })()
    ];
    
    // For test suite compatibility
    this.testVectors = this.tests;
  }
  
  CreateInstance(isInverse = false) {
    return new ScytaleInstance(this, isInverse);
  }
}

class ScytaleInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this.circumference = 3; // Default circumference
  }
  
  set key(keyData) {
    let keyString = '';
    if (typeof keyData === 'string') {
      keyString = keyData;
    } else if (Array.isArray(keyData)) {
      keyString = String.fromCharCode(...keyData);
    }
    
    const circumference = parseInt(keyString) || 3;
    this.circumference = Math.max(1, circumference);
    this._key = keyString;
  }
  
  get key() {
    return this._key;
  }
  
  Feed(data) {
    if (!data || data.length === 0) return;
    
    // Convert bytes to string for classical cipher
    let text = '';
    if (typeof data === 'string') {
      text = data;
    } else {
      text = String.fromCharCode(...data);
    }
    
    this.inputBuffer.push(text);
  }
  
  Result() {
    if (this.inputBuffer.length === 0) return [];
    
    const text = this.inputBuffer.join('');
    this.inputBuffer = [];
    
    const result = this.isInverse ? 
      this.decryptText(text) : 
      this.encryptText(text);
    
    // Convert string result to bytes
    return Array.from(result).map(c => c.charCodeAt(0));
  }
  
  encryptText(plaintext) {
    const text = plaintext.toUpperCase().replace(/[^A-Z]/g, '');
    if (text.length === 0) return '';
    
    // Calculate rows needed
    const rows = Math.ceil(text.length / this.circumference);
    const grid = [];
    
    // Fill grid row by row
    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < this.circumference; c++) {
        const index = r * this.circumference + c;
        grid[r][c] = index < text.length ? text[index] : '';
      }
    }
    
    // Read column by column
    let result = '';
    for (let c = 0; c < this.circumference; c++) {
      for (let r = 0; r < rows; r++) {
        if (grid[r][c]) {
          result += grid[r][c];
        }
      }
    }
    
    return result;
  }
  
  decryptText(ciphertext) {
    const text = ciphertext.toUpperCase().replace(/[^A-Z]/g, '');
    if (text.length === 0) return '';
    
    const rows = Math.ceil(text.length / this.circumference);
    const grid = [];
    
    // Initialize grid
    for (let r = 0; r < rows; r++) {
      grid[r] = new Array(this.circumference).fill('');
    }
    
    // Calculate how many characters each column should have
    // When text.length is not divisible by circumference, 
    // some columns will have one less character
    const charsPerColumn = [];
    const fullRows = Math.floor(text.length / this.circumference);
    const remainder = text.length % this.circumference;
    
    for (let c = 0; c < this.circumference; c++) {
      // First 'remainder' columns get an extra character
      charsPerColumn[c] = fullRows + (c < remainder ? 1 : 0);
    }
    
    // Fill the grid column by column with the correct number of characters
    let cipherIndex = 0;
    for (let c = 0; c < this.circumference; c++) {
      for (let r = 0; r < charsPerColumn[c]; r++) {
        if (cipherIndex < text.length) {
          grid[r][c] = text[cipherIndex++];
        }
      }
    }
    
    // Read row by row to get original plaintext
    let result = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < this.circumference; c++) {
        if (grid[r][c] && grid[r][c] !== '') {
          result += grid[r][c];
        }
      }
    }
    
    return result;
  }
}

// Register the algorithm
RegisterAlgorithm(new ScytaleCipher());

})(typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);