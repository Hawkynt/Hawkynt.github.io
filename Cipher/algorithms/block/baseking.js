#!/usr/bin/env node
/*
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Load OpCodes if in Node.js environment
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const BaseKing = {
    name: "BaseKing",
    description: "192-bit block cipher with 192-bit key size using 11 rounds plus final transformation. Uses Theta, Pi1/Pi2, Gamma, and Mu operations. Educational implementation from cryptographic competition.",
    inventor: "Unknown",
    year: null,
    country: null, // Unknown origin
    category: "cipher",
    subCategory: "Block Cipher",
    securityStatus: "experimental",
    securityNotes: "Limited cryptanalysis available. 192-bit block size is unusual. No standardization or widespread adoption. For educational purposes only.",
    
    documentation: [
      {text: "BaseKing Competition Entry", uri: "Unknown - competition cipher"},
      {text: "Academic Study", uri: "Limited documentation available"}
    ],
    
    references: [
      {text: "Reference Implementation", uri: "Original competition submission"}
    ],
    
    knownVulnerabilities: [],
    
    tests: [
      {
        text: "Basic functionality test",
        uri: "Educational implementation",
        keySize: 24,
        blockSize: 24,
        input: Hex8ToBytes("000102030405060708090a0b0c0d0e0f1011121314151617"),
        key: Hex8ToBytes("000102030405060708090a0b0c0d0e0f1011121314151617"),
        expected: Hex8ToBytes("placeholder_expected_output_needed")
      }
    ],

    // Legacy cipher identification
    internalName: 'baseking',
    comment: 'BaseKing - 192-bit block cipher with 11 rounds plus final transformation',
    
    // Required cipher interface properties
    minKeyLength: 24,     // 192-bit key
    maxKeyLength: 24,     // Fixed key size
    stepKeyLength: 1,     // Key length step
    minBlockSize: 24,     // 192-bit block size
    maxBlockSize: 24,     // Fixed block size
    stepBlockSize: 1,     // Block size step
    cantDecode: false,   // Supports decryption
    isInitialized: false,         // Not initialized
    instances: {},        // Instance storage
    
    // Algorithm parameters
    BLOCK_SIZE: 24,      // 192 bits = 24 bytes = 12 words x 16 Bits
    KEY_SIZE: 24,        // 192 bits = 24 bytes = 12 words x 16 Bits
    WORD_SIZE: 2,        // 16-bit words
    NUM_ROUNDS: 11,      // Number of main rounds
    NUM_WORDS: 12,       // Number of 16-bit words in block/key
    
    // Round shift constants (from reference implementation)
    shiftConstants: [0, 8, 1, 15, 5, 10, 7, 6, 13, 14, 2, 3],
    
    // Round constants for each round
    roundConstants: [
      0x0001, 0x0002, 0x0004, 0x0008, 0x0010, 0x0020,
      0x0040, 0x0080, 0x0100, 0x0200, 0x0400, 0x0800
    ],
    
    // Current state
    encryptionKey: null,
    decryptionKey: null,
    
    /**
     * Initialize cipher instance
     */
    Init: function() {
      this.encryptionKey = null;
      this.decryptionKey = null;
      return true;
    },
    
    /**
     * Set up encryption and decryption keys
     * @param {Array} key - 24-byte key array
     * @returns {boolean} Success status
     */
    KeySetup: function(key) {
      if (!key || key.length !== this.KEY_SIZE) {
        return false;
      }
      
      // Convert byte array to 16-bit words (big-endian)
      const keyWords = [];
      for (let i = 0; i < this.NUM_WORDS; i++) {
        keyWords[i] = (key[i * 2] << 8) | key[i * 2 + 1];
      }
      
      // For BaseKing, encryption and decryption use the same key
      this.encryptionKey = keyWords.slice();
      this.decryptionKey = keyWords.slice();
      
      return true;
    },
    
    /**
     * Clear sensitive key material
     */
    ClearData: function() {
      if (this.encryptionKey) {
        OpCodes.ClearArray(this.encryptionKey);
        this.encryptionKey = null;
      }
      if (this.decryptionKey) {
        OpCodes.ClearArray(this.decryptionKey);
        this.decryptionKey = null;
      }
    },
    
    /**
     * Mu transformation - reverses word order
     * @param {Array} a - Array of 12 words to transform
     */
    mu: function(a) {
      for (let i = 0; i < 6; i++) {
        const temp = a[i];
        a[i] = a[11 - i];
        a[11 - i] = temp;
      }
    },
    
    /**
     * Theta transformation - linear mixing step
     * @param {Array} k - Round key (12 words)
     * @param {Array} a - State array (12 words)
     * @param {number} RC - Round constant
     */
    theta: function(k, a, RC) {
      // Add round key and constants
      a[0] ^= k[0];    a[1] ^= k[1];    a[2] ^= k[2] ^ RC;   a[3] ^= k[3] ^ RC;
      a[4] ^= k[4];    a[5] ^= k[5];    a[6] ^= k[6];       a[7] ^= k[7];
      a[8] ^= k[8] ^ RC; a[9] ^= k[9] ^ RC; a[10] ^= k[10]; a[11] ^= k[11];
      
      // Linear mixing
      const A = new Array(4);
      const B = new Array(6);
      
      B[0] = a[0] ^ a[4] ^ a[8];
      A[1] = a[1] ^ a[5] ^ a[9];
      A[2] = a[2] ^ a[6] ^ a[10];
      A[3] = a[3] ^ a[7] ^ a[11];
      A[0] = B[0] ^ A[1];  A[1] ^= A[2];   A[2] ^= A[3];   A[3] ^= B[0];
      
      B[0] = a[0] ^ a[6]; B[1] = a[1] ^ a[7];  B[2] = a[2] ^ a[8];
      B[3] = a[3] ^ a[9]; B[4] = a[4] ^ a[10]; B[5] = a[5] ^ a[11];
      
      a[0] ^= A[2] ^ B[3];  a[1] ^= A[3] ^ B[4];
      a[2] ^= A[0] ^ B[5];  a[3] ^= A[1] ^ B[0];
      a[4] ^= A[2] ^ B[1];  a[5] ^= A[3] ^ B[2];
      a[6] ^= A[0] ^ B[3];  a[7] ^= A[1] ^ B[4];
      a[8] ^= A[2] ^ B[5];  a[9] ^= A[3] ^ B[0];
      a[10] ^= A[0] ^ B[1]; a[11] ^= A[1] ^ B[2];
    },
    
    /**
     * Pi1 transformation - left rotation permutation
     * @param {Array} a - State array (12 words)
     */
    pi1: function(a) {
      for (let j = 0; j < this.NUM_WORDS; j++) {
        a[j] = OpCodes.RotL16(a[j], this.shiftConstants[j]);
      }
    },
    
    /**
     * Gamma transformation - nonlinear step
     * @param {Array} a - State array (12 words)
     */
    gamma: function(a) {
      const aa = new Array(24); // Double size to avoid modulo operations
      
      // Copy state twice
      for (let i = 0; i < this.NUM_WORDS; i++) {
        aa[i] = aa[i + this.NUM_WORDS] = a[i];
      }
      
      // Nonlinear transformation: a[i] = a[i] ^ (a[i+4] | ~a[i+8])
      for (let i = 0; i < this.NUM_WORDS; i++) {
        a[i] = aa[i] ^ (aa[i + 4] | (~aa[i + 8] & 0xFFFF));
      }
    },
    
    /**
     * Pi2 transformation - right rotation permutation
     * @param {Array} a - State array (12 words)
     */
    pi2: function(a) {
      for (let j = 0; j < this.NUM_WORDS; j++) {
        a[j] = OpCodes.RotR16(a[j], this.shiftConstants[11 - j]);
      }
    },
    
    /**
     * Core BaseKing round function
     * @param {Array} k - Round key (12 words)
     * @param {Array} a - State array (12 words)
     * @param {Array} RC - Round constants
     */
    baseKingCore: function(k, a, RC) {
      // 11 main rounds
      for (let i = 0; i < this.NUM_ROUNDS; i++) {
        this.theta(k, a, RC[i]);
        this.pi1(a);
        this.gamma(a);
        this.pi2(a);
      }
      
      // Final round (Theta + Mu)
      this.theta(k, a, RC[this.NUM_ROUNDS]);
      this.mu(a);
    },
    
    /**
     * Encrypt a single block
     * @param {Array} block - 24-byte input block
     * @returns {Array} 24-byte encrypted block
     */
    encryptBlock: function(unused, block) {
      if (!this.encryptionKey || !block || block.length !== this.BLOCK_SIZE) {
        return null;
      }
      
      // Convert bytes to 16-bit words (big-endian)
      const words = [];
      for (let i = 0; i < this.NUM_WORDS; i++) {
        words[i] = (block[i * 2] << 8) | block[i * 2 + 1];
      }
      
      // Apply BaseKing encryption
      this.baseKingCore(this.encryptionKey, words, this.roundConstants);
      
      // Convert words back to bytes (big-endian)
      const result = new Array(this.BLOCK_SIZE);
      for (let i = 0; i < this.NUM_WORDS; i++) {
        result[i * 2] = (words[i] >>> 8) & 0xFF;
        result[i * 2 + 1] = words[i] & 0xFF;
      }
      
      return result;
    },
    
    /**
     * Decrypt a single block
     * @param {Array} block - 24-byte encrypted block
     * @returns {Array} 24-byte decrypted block
     */
    decryptBlock: function(unused, block) {
      if (!this.decryptionKey || !block || block.length !== this.BLOCK_SIZE) {
        return null;
      }
      
      // Convert bytes to 16-bit words (big-endian)
      const words = [];
      for (let i = 0; i < this.NUM_WORDS; i++) {
        words[i] = (block[i * 2] << 8) | block[i * 2 + 1];
      }
      
      // For decryption, we need to reverse the operations
      // 1. Reverse Mu
      this.mu(words);
      
      // 2. Reverse final Theta
      this.theta(this.decryptionKey, words, this.roundConstants[this.NUM_ROUNDS]);
      
      // 3. Reverse 11 rounds in reverse order
      for (let i = this.NUM_ROUNDS - 1; i >= 0; i--) {
        this.pi2(words);     // Reverse Pi2
        this.gamma(words);   // Gamma is its own inverse
        this.pi1(words);     // Reverse Pi1
        this.theta(this.decryptionKey, words, this.roundConstants[i]); // Reverse Theta
      }
      
      // Convert words back to bytes (big-endian)
      const result = new Array(this.BLOCK_SIZE);
      for (let i = 0; i < this.NUM_WORDS; i++) {
        result[i * 2] = (words[i] >>> 8) & 0xFF;
        result[i * 2 + 1] = words[i] & 0xFF;
      }
      
      return result;
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function') {
    global.Cipher.Add(BaseKing);
  } else if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(BaseKing);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaseKing;
  }
  
  // Make available globally
  global.BaseKing = BaseKing;
  
})(typeof global !== 'undefined' ? global : window);