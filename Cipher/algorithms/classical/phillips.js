/*
 * AlgorithmFramework Phillips Cipher
 * Compatible with both Browser and Node.js environments
 * 5x5 grid cipher with coordinate system and block transposition
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

class PhillipsCipher extends CryptoAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Phillips Cipher";
    this.description = "5x5 grid cipher with coordinate system and block transposition for educational cryptography study.";
    this.category = CategoryType.CLASSICAL;
    this.subCategory = "Grid Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.inventor = "Unknown";
    this.year = null;
    this.country = CountryCode.UNKNOWN;
    
    // Documentation
    this.documentation = [
      new LinkItem('Phillips Cipher Information', 'https://cryptii.com/pipes/phillips-cipher')
    ];
    
    // Convert test vectors to new format (strings to byte arrays)
    this.tests = [
      new TestCase(
        OpCodes.AnsiToBytes('HELLO'), 
        OpCodes.AnsiToBytes('23 15 31 31 34'),
        'Basic Phillips example using standard Polybius square'
      ),
      new TestCase(
        OpCodes.AnsiToBytes('WORLD'),
        OpCodes.AnsiToBytes('52 34 42 31 14'),
        'Another Phillips example using standard Polybius square'
      )
    ];
    
    // For test suite compatibility
    this.testVectors = this.tests;
    
    // Standard 5x5 grid (I/J combined)
    this.STANDARD_GRID = [
      ['A', 'B', 'C', 'D', 'E'],
      ['F', 'G', 'H', 'I', 'K'],
      ['L', 'M', 'N', 'O', 'P'],
      ['Q', 'R', 'S', 'T', 'U'],
      ['V', 'W', 'X', 'Y', 'Z']
    ];
  }
  
  CreateInstance(isInverse = false) {
    return new PhillipsInstance(this, isInverse);
  }
}

class PhillipsInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this.grid = this.algorithm.STANDARD_GRID.map(row => [...row]);
    this.blockSize = 5;
  }
  
  set key(keyData) {
    let keyString = '';
    if (typeof keyData === 'string') {
      keyString = keyData;
    } else if (Array.isArray(keyData)) {
      keyString = String.fromCharCode(...keyData);
    }
    
    if (keyString && keyString.length > 0) {
      this.grid = this.createCustomGrid(keyString);
    }
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
  
  createCustomGrid(keyword) {
    const cleanKey = keyword.toUpperCase()
      .replace(/[^A-Z]/g, '')
      .replace(/J/g, 'I')
      .split('')
      .filter((char, index, arr) => arr.indexOf(char) === index)
      .join('');
    
    const alphabet = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';
    let remaining = alphabet;
    for (let i = 0; i < cleanKey.length; i++) {
      remaining = remaining.replace(cleanKey[i], '');
    }
    
    const fullAlphabet = cleanKey + remaining;
    const grid = [];
    for (let row = 0; row < 5; row++) {
      grid[row] = [];
      for (let col = 0; col < 5; col++) {
        grid[row][col] = fullAlphabet[row * 5 + col];
      }
    }
    
    return grid;
  }
  
  encryptText(plaintext) {
    const text = plaintext.toUpperCase().replace(/[^A-Z]/g, '').replace(/J/g, 'I');
    const result = [];
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      // Find position in grid
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          if (this.grid[row][col] === char) {
            result.push(((row + 1) * 10 + (col + 1)).toString());
            break;
          }
        }
      }
    }
    
    return result.join(' ');
  }
  
  decryptText(ciphertext) {
    const numbers = ciphertext.trim().split(/\s+/).map(n => parseInt(n));
    let result = '';
    
    for (const num of numbers) {
      const row = Math.floor(num / 10) - 1;
      const col = (num % 10) - 1;
      
      if (row >= 0 && row < 5 && col >= 0 && col < 5) {
        result += this.grid[row][col];
      } else {
        result += '?';
      }
    }
    
    return result;
  }
}

// Register the algorithm
RegisterAlgorithm(new PhillipsCipher());

})(typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);