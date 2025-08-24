/*
 * AlgorithmFramework Trifid Cipher
 * Compatible with both Browser and Node.js environments
 * Félix Delastelle's three-dimensional fractionating cipher (1901)
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

class TrifidCipher extends CryptoAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Trifid Cipher";
    this.description = "Félix Delastelle's three-dimensional fractionating cipher extending the Bifid concept to three dimensions for enhanced security.";
    this.category = CategoryType.CLASSICAL;
    this.subCategory = "Fractionating Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.ADVANCED;
    this.inventor = "Félix Marie Delastelle";
    this.year = 1901;
    this.country = CountryCode.FR;
    
    // Documentation
    this.documentation = [
      new LinkItem('Trifid Cipher Wikipedia', 'https://en.wikipedia.org/wiki/Trifid_cipher'),
      new LinkItem('Delastelle Ciphers', 'http://practicalcryptography.com/ciphers/classical-era/trifid/')
    ];
    
    // Convert test vectors to new format (strings to byte arrays)
    this.tests = [
      (() => {
        const test = new TestCase(
          OpCodes.AnsiToBytes('HELLO'), 
          OpCodes.AnsiToBytes('BOJN+'),
          'Basic Trifid example with period 5'
        );
        test.key = OpCodes.AnsiToBytes('5');
        return test;
      })(),
      (() => {
        const test = new TestCase(
          OpCodes.AnsiToBytes('ATTACKATDAWN'),
          OpCodes.AnsiToBytes('IBAAEHGHBEDE'),
          'Military message with period 6'
        );
        test.key = OpCodes.AnsiToBytes('6');
        return test;
      })()
    ];
    
    // For test suite compatibility
    this.testVectors = this.tests;
    
    // Standard 3x3x3 cube arrangement (27 letters + digits)
    this.STANDARD_CUBE = this.createStandardCube();
  }
  
  createStandardCube() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ+';
    const cube = [];
    let index = 0;
    
    for (let layer = 0; layer < 3; layer++) {
      cube[layer] = [];
      for (let row = 0; row < 3; row++) {
        cube[layer][row] = [];
        for (let col = 0; col < 3; col++) {
          cube[layer][row][col] = alphabet[index++];
        }
      }
    }
    return cube;
  }
  
  CreateInstance(isInverse = false) {
    return new TrifidInstance(this, isInverse);
  }
}

class TrifidInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this.period = 5; // Default period
    this.cube = JSON.parse(JSON.stringify(this.algorithm.STANDARD_CUBE));
  }
  
  set key(keyData) {
    let keyString = '';
    if (typeof keyData === 'string') {
      keyString = keyData;
    } else if (Array.isArray(keyData)) {
      keyString = String.fromCharCode(...keyData);
    }
    
    const period = parseInt(keyString) || 5;
    this.period = Math.max(1, Math.min(period, 25));
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
  
  findPosition(char) {
    for (let layer = 0; layer < 3; layer++) {
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          if (this.cube[layer][row][col] === char) {
            return { layer, row, col };
          }
        }
      }
    }
    return null;
  }
  
  encryptText(plaintext) {
    const text = plaintext.toUpperCase().replace(/[^A-Z]/g, '').replace(/J/g, 'I');
    let result = '';
    
    // Process text in blocks of 'period' length
    for (let blockStart = 0; blockStart < text.length; blockStart += this.period) {
      const block = text.substring(blockStart, Math.min(blockStart + this.period, text.length));
      result += this.processBlock(block, true);
    }
    
    return result;
  }
  
  decryptText(ciphertext) {
    const text = ciphertext.toUpperCase().replace(/[^A-Z]/g, '');
    let result = '';
    
    // Process text in blocks of 'period' length
    for (let blockStart = 0; blockStart < text.length; blockStart += this.period) {
      const block = text.substring(blockStart, Math.min(blockStart + this.period, text.length));
      result += this.processBlock(block, false);
    }
    
    return result;
  }
  
  processBlock(block, encrypt) {
    const coordinates = [];
    
    // Convert characters to coordinates
    for (let i = 0; i < block.length; i++) {
      const char = block[i];
      const pos = this.findPosition(char);
      if (pos) {
        coordinates.push(pos);
      } else {
        coordinates.push({ layer: 0, row: 0, col: 0 }); // Default
      }
    }
    
    let result = '';
    
    if (encrypt) {
      // Encryption: separate layers, rows, and columns, then combine
      const layers = coordinates.map(coord => coord.layer);
      const rows = coordinates.map(coord => coord.row);
      const cols = coordinates.map(coord => coord.col);
      const combined = layers.concat(rows).concat(cols);
      
      // Group into triplets
      for (let i = 0; i < combined.length; i += 3) {
        const layer = combined[i] || 0;
        const row = combined[i + 1] || 0;
        const col = combined[i + 2] || 0;
        
        if (this.cube[layer] && this.cube[layer][row] && this.cube[layer][row][col]) {
          result += this.cube[layer][row][col];
        } else {
          result += 'A'; // Fallback
        }
      }
    } else {
      // Decryption: convert back to coordinates and separate
      const combined = [];
      
      for (let i = 0; i < block.length; i++) {
        const char = block[i];
        const pos = this.findPosition(char);
        if (pos) {
          combined.push(pos.layer, pos.row, pos.col);
        } else {
          combined.push(0, 0, 0);
        }
      }
      
      // Split back into layers, rows, cols
      const third = Math.ceil(combined.length / 3);
      const layers = combined.slice(0, third);
      const rows = combined.slice(third, third * 2);
      const cols = combined.slice(third * 2);
      
      // Recombine
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i] || 0;
        const row = (i < rows.length) ? rows[i] : 0;
        const col = (i < cols.length) ? cols[i] : 0;
        
        if (this.cube[layer] && this.cube[layer][row] && this.cube[layer][row][col]) {
          result += this.cube[layer][row][col];
        } else {
          result += 'A'; // Fallback
        }
      }
    }
    
    return result;
  }
}

// Register the algorithm
RegisterAlgorithm(new TrifidCipher());

})(typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);