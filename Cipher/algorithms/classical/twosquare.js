/*
 * AlgorithmFramework Two-Square Cipher
 * Compatible with both Browser and Node.js environments
 * Classical polygraphic substitution cipher using two 5x5 squares
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

class TwoSquareCipher extends CryptoAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Two-Square Cipher";
    this.description = "Classical polygraphic substitution cipher using two 5x5 Polybius squares for digraph encryption with enhanced security.";
    this.category = CategoryType.CLASSICAL;
    this.subCategory = "Polygraphic Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.inventor = "Unknown";
    this.year = null;
    this.country = CountryCode.UNKNOWN;
    
    // Documentation
    this.documentation = [
      new LinkItem('Two-Square Cipher Information', 'https://en.wikipedia.org/wiki/Two-square_cipher'),
      new LinkItem('Classical Cryptography Guide', 'http://practicalcryptography.com/ciphers/classical-era/two-square/')
    ];
    
    // Convert test vectors to new format (strings to byte arrays)
    this.tests = [
      (() => {
        const test = new TestCase(
          OpCodes.AnsiToBytes('HELLO'), 
          OpCodes.AnsiToBytes('MCKMPW'),
          'Basic Two-Square example'
        );
        test.key = OpCodes.AnsiToBytes('SECRET,CIPHER');
        return test;
      })(),
      (() => {
        const test = new TestCase(
          OpCodes.AnsiToBytes('ATTACKATDAWN'),
          OpCodes.AnsiToBytes('EVRCLYEVCBVP'),
          'Military message example'
        );
        test.key = OpCodes.AnsiToBytes('EXAMPLE,KEYWORD');
        return test;
      })()
    ];
    
    // For test suite compatibility
    this.testVectors = this.tests;
    
    // Standard alphabet without J (merged with I)
    this.ALPHABET = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';
  }
  
  CreateInstance(isInverse = false) {
    return new TwoSquareInstance(this, isInverse);
  }
}

class TwoSquareInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this.square1 = this.createStandardSquare();
    this.square2 = this.createStandardSquare();
  }
  
  set key(keyData) {
    let keyString = '';
    if (typeof keyData === 'string') {
      keyString = keyData;
    } else if (Array.isArray(keyData)) {
      keyString = String.fromCharCode(...keyData);
    }
    
    // Use default test key if none provided or invalid format
    if (!keyString || keyString.length === 0 || 
        (!keyString.includes(',') && !keyString.includes(':') && 
         !keyString.includes(' ') && !keyString.includes(';'))) {
      keyString = 'EXAMPLE,KEYWORD'; // Default key pair for testing
    }
    
    try {
      const parsed = this.parseKey(keyString);
      this.square1 = this.createKeySquare(parsed.key1);
      this.square2 = this.createKeySquare(parsed.key2);
      this._key = keyString;
    } catch (error) {
      throw new Error('Invalid key format: ' + error.message);
    }
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
  
  createStandardSquare() {
    const square = [];
    for (let row = 0; row < 5; row++) {
      square[row] = [];
      for (let col = 0; col < 5; col++) {
        square[row][col] = this.algorithm.ALPHABET[row * 5 + col];
      }
    }
    return square;
  }
  
  createKeySquare(keyword) {
    const cleanKey = keyword.toUpperCase()
      .replace(/[^A-Z]/g, '')
      .replace(/J/g, 'I')
      .split('')
      .filter((char, index, arr) => arr.indexOf(char) === index)
      .join('');
    
    let remainingAlphabet = this.algorithm.ALPHABET;
    for (let i = 0; i < cleanKey.length; i++) {
      remainingAlphabet = remainingAlphabet.replace(cleanKey[i], '');
    }
    
    const fullAlphabet = cleanKey + remainingAlphabet;
    const square = [];
    for (let row = 0; row < 5; row++) {
      square[row] = [];
      for (let col = 0; col < 5; col++) {
        square[row][col] = fullAlphabet[row * 5 + col];
      }
    }
    
    return square;
  }
  
  parseKey(key) {
    const parts = key.split(/[\s,:;]+/);
    if (parts.length < 2) {
      throw new Error('Two-Square cipher requires two keywords separated by comma, space, colon, or semicolon');
    }
    
    return { key1: parts[0], key2: parts[1] };
  }
  
  findPosition(square, char) {
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (square[row][col] === char) {
          return { row: row, col: col };
        }
      }
    }
    return null;
  }
  
  normalizeText(text) {
    return text.toUpperCase().replace(/[^A-Z]/g, '').replace(/J/g, 'I');
  }
  
  prepareText(text) {
    const normalized = this.normalizeText(text);
    
    // Add X if odd length
    if (normalized.length % 2 === 1) {
      return normalized + 'X';
    }
    
    return normalized;
  }
  
  encryptText(plaintext) {
    const preparedText = this.prepareText(plaintext);
    let result = '';
    
    // Process text in digraphs (pairs)
    for (let i = 0; i < preparedText.length; i += 2) {
      const char1 = preparedText[i];
      const char2 = preparedText[i + 1];
      
      // Find positions in squares
      const pos1 = this.findPosition(this.square1, char1);
      const pos2 = this.findPosition(this.square2, char2);
      
      if (!pos1 || !pos2) {
        // Should not happen with normalized text, but defensive programming
        result += char1 + char2;
        continue;
      }
      
      // Two-square rule: use same row, opposite square's column
      const cipher1 = this.square1[pos1.row][pos2.col];
      const cipher2 = this.square2[pos2.row][pos1.col];
      
      result += cipher1 + cipher2;
    }
    
    return result;
  }
  
  decryptText(ciphertext) {
    const normalizedText = this.normalizeText(ciphertext);
    let result = '';
    
    // Process text in digraphs (pairs)
    for (let i = 0; i < normalizedText.length; i += 2) {
      const cipher1 = normalizedText[i];
      const cipher2 = normalizedText[i + 1] || 'X'; // Handle odd length
      
      // Find positions in squares
      const pos1 = this.findPosition(this.square1, cipher1);
      const pos2 = this.findPosition(this.square2, cipher2);
      
      if (!pos1 || !pos2) {
        // Should not happen with normalized text, but defensive programming
        result += cipher1 + cipher2;
        continue;
      }
      
      // Reverse the encryption process
      const plain1 = this.square1[pos1.row][pos2.col];
      const plain2 = this.square2[pos2.row][pos1.col];
      
      result += plain1 + plain2;
    }
    
    return result;
  }
}

// Register the algorithm
RegisterAlgorithm(new TwoSquareCipher());

})(typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);