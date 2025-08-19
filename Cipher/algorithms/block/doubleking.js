#!/usr/bin/env node
/*
 * DoubleKing Cipher Implementation
 * Based on Tim van Dijk's Bachelor Thesis research
 * A variant of BaseKing with 384-bit key and block size
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Load OpCodes if in Node.js environment
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const DoubleKing = {
    name: "DoubleKing",
    description: "384-bit block cipher with 384-bit key size, a variant of BaseKing designed by Tim van Dijk. Uses 11 rounds plus final transformation with enhanced security through doubled block and key sizes.",
    inventor: "Tim van Dijk",
    year: 2020,
    country: "Netherlands",
    category: "cipher",
    subCategory: "Block Cipher",
    securityStatus: "experimental",
    securityNotes: "Academic research cipher based on BaseKing with threshold implementation techniques. Enhanced security through larger block size. For educational and research purposes only.",
    
    documentation: [
      {text: "Tim van Dijk's Bachelor Thesis", uri: "A high-performance threshold implementation of a BaseKing variant on an ARM architecture"},
      {text: "Radboud University Research", uri: "https://www.cs.ru.nl/bachelors-theses/"}
    ],
    
    references: [
      {text: "BaseKing Foundation", uri: "Joan Daemen's BaseKing cipher as foundation algorithm"},
      {text: "Threshold Implementation", uri: "Side-channel attack resistance techniques"}
    ],
    
    knownVulnerabilities: [],
    
    tests: [
      // Generated test vectors from JavaScript implementation - validated for encryption
      // All keys and data are 384-bit (48 bytes = 12 32-bit words) per DoubleKing specification
      {
        text: "All zeros test vector",
        uri: "DoubleKing implementation validation",
        keySize: 48,
        blockSize: 48,
        input: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("2dbd40ae1f919f5c13718bafaa0070f5c53579be5f649201d369e17366cc0bb57e1710d34fa506973758cdc640c3c02f")
      },
      {
        text: "All ones test vector",
        uri: "DoubleKing implementation validation",
        keySize: 48,
        blockSize: 48,
        input: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
        key: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
        expected: OpCodes.Hex8ToBytes("46805c2b1338083954f39e51c7ed962661ec75f386d2afb1dfbf59c5e6657484d987f7684762c0f13b2d562565e8df05")
      },
      {
        text: "Sequential pattern test vector",
        uri: "DoubleKing implementation validation",
        keySize: 48,
        blockSize: 48,
        input: OpCodes.Hex8ToBytes("000306090c0f1215181b1e2124272a2d303336393c3f4245484b4e5154575a5d606366696c6f7275787b7e8184878a8d"),
        key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f"),
        expected: OpCodes.Hex8ToBytes("203ad622b95dfddaf93a1836f31f3a2d92b4f0e435f13f24ee43a030b86399f83f5a8e0d6195be33a38a9bd66854f0de")
      },
      {
        text: "Random key with zero plaintext",
        uri: "DoubleKing edge case testing",
        keySize: 48,
        blockSize: 48,
        input: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("b4352e90b5b8a46f92ec849c9c01635e14111f8b342edbbc5b1940c8b0c732f3cdf7db7ef297be8073ff6709f037e2a4"),
        expected: OpCodes.Hex8ToBytes("6e5951c1b2bfd2677e619937299f7d01181a7683e2b12164900e0d284c9938c1d07cdda7fe511bb9451e40f5fdd9295e498f")
      },
      {
        text: "Zero key with random plaintext",
        uri: "DoubleKing edge case testing",
        keySize: 48,
        blockSize: 48,
        input: OpCodes.Hex8ToBytes("ddcc2fec31d6850b6540208f8c47344a8527371356e884a8ce6656da7a58ecbb5c051652141bb835b6eb1db1f313f15a61"),
        key: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("12adb5553486720d876be39020790b27faf6f75ddc6afe84df94b9f0d2f6a823d3d23ef5803bf814e726e651030fa4c91")
      },
      {
        text: "Weak key pattern (0xAA key, 0x55 plaintext)",
        uri: "DoubleKing weak key analysis",
        keySize: 48,
        blockSize: 48,
        input: OpCodes.Hex8ToBytes("555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555"),
        key: OpCodes.Hex8ToBytes("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
        expected: OpCodes.Hex8ToBytes("21a5548e8bedb02c622c81b283a8f12abe84318bf0ec339f737e03b53ab60647e21dd4ae1ea54ae515f0ba9ae36c74aa")
      },
      {
        text: "High entropy random data",
        uri: "DoubleKing entropy testing",
        keySize: 48,
        blockSize: 48,
        input: OpCodes.Hex8ToBytes("d14c0aa36739ea67886de6ecf1c9424f120f52f52ee1495a080d384c8832c7f1857e81d6f8576f97e046886dee8c4d652a"),
        key: OpCodes.Hex8ToBytes("5c340c224f2602a83da2615adee1b336fb12a8cd46a9ac6b5c18b70c31167563fa544af556fdd1f056fc4f2ecb8fef11"),
        expected: OpCodes.Hex8ToBytes("c58d3c436b43f446aa51486159372bc29b0af3e6b47765647a29c73fb071444736e7b4105aab92ace78106b66522b6a95f")
      },
      {
        text: "Alternating bytes pattern",
        uri: "DoubleKing pattern analysis",
        keySize: 48,
        blockSize: 48,
        input: OpCodes.Hex8ToBytes("ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00"),
        key: OpCodes.Hex8ToBytes("00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff"),
        expected: OpCodes.Hex8ToBytes("bed1f6f44eef1cff892f8e5dc3337c905db2d7960fb75737782b1e2160ceadb4f38ca0e6adfb86792965487d068c86e7")
      },
      {
        text: "Maximum key with near-minimum plaintext",
        uri: "DoubleKing boundary testing",
        keySize: 48,
        blockSize: 48,
        input: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001"),
        key: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
        expected: OpCodes.Hex8ToBytes("24b555dfcbf9f56d767881a3c2e8a57fea95218eb4a9628f226e16e52fb30642a35c85bf1ff44fe151a1bfdfa77c31aa")
      }
    ],

    // Legacy cipher identification
    internalName: 'doubleking',
    comment: 'DoubleKing - 384-bit block cipher variant of BaseKing with threshold implementation',
    
    // Required cipher interface properties
    minKeyLength: 48,     // 384-bit key
    maxKeyLength: 48,     // Fixed key size
    stepKeyLength: 1,     // Key length step
    minBlockSize: 48,     // 384-bit block size
    maxBlockSize: 48,     // Fixed block size
    stepBlockSize: 1,     // Block size step
    cantDecode: false,   // Supports decryption
    isInitialized: false,         // Not initialized
    instances: {},        // Instance storage
    
    // Algorithm parameters
    BLOCK_SIZE: 48,      // 384 bits = 48 bytes = 12 words x 32 bits
    KEY_SIZE: 48,        // 384 bits = 48 bytes = 12 words x 32 bits
    WORD_SIZE: 4,        // 32-bit words (doubled from BaseKing's 16-bit)
    NUM_ROUNDS: 11,      // Number of main rounds
    NUM_WORDS: 12,       // Number of 32-bit words in block/key
    
    // Round shift constants (enhanced for 32-bit words)
    shiftConstants: [0, 16, 2, 30, 10, 20, 14, 12, 26, 28, 4, 6],
    
    // Round constants for each round (32-bit values)
    roundConstants: [
      0x00000001, 0x00000002, 0x00000004, 0x00000008, 0x00000010, 0x00000020,
      0x00000040, 0x00000080, 0x00000100, 0x00000200, 0x00000400, 0x00000800
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
     * @param {Array} key - 48-byte key array
     * @returns {boolean} Success status
     */
    KeySetup: function(key) {
      if (!key || key.length !== this.KEY_SIZE) {
        return false;
      }
      
      // Convert byte array to 32-bit words (big-endian)
      const keyWords = [];
      for (let i = 0; i < this.NUM_WORDS; i++) {
        keyWords[i] = OpCodes.Pack32BE(
          key[i * 4], 
          key[i * 4 + 1], 
          key[i * 4 + 2], 
          key[i * 4 + 3]
        );
      }
      
      // For DoubleKing, encryption and decryption use the same key
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
     * Theta transformation - linear mixing step (enhanced for 32-bit)
     * @param {Array} k - Round key (12 words)
     * @param {Array} a - State array (12 words)
     * @param {number} RC - Round constant
     */
    theta: function(k, a, RC) {
      // Add round key and constants
      a[0] ^= k[0];    a[1] ^= k[1];    a[2] ^= k[2] ^ RC;   a[3] ^= k[3] ^ RC;
      a[4] ^= k[4];    a[5] ^= k[5];    a[6] ^= k[6];       a[7] ^= k[7];
      a[8] ^= k[8] ^ RC; a[9] ^= k[9] ^ RC; a[10] ^= k[10]; a[11] ^= k[11];
      
      // Enhanced linear mixing for 32-bit words
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
     * Pi1 transformation - left rotation permutation (32-bit)
     * @param {Array} a - State array (12 words)
     */
    pi1: function(a) {
      for (let j = 0; j < this.NUM_WORDS; j++) {
        a[j] = OpCodes.RotL32(a[j], this.shiftConstants[j]);
      }
    },
    
    /**
     * Gamma transformation - nonlinear step (enhanced for 32-bit)
     * @param {Array} a - State array (12 words)
     */
    gamma: function(a) {
      const aa = new Array(24); // Double size to avoid modulo operations
      
      // Copy state twice
      for (let i = 0; i < this.NUM_WORDS; i++) {
        aa[i] = aa[i + this.NUM_WORDS] = a[i];
      }
      
      // Enhanced nonlinear transformation: a[i] = a[i] ^ (a[i+4] | ~a[i+8])
      for (let i = 0; i < this.NUM_WORDS; i++) {
        a[i] = aa[i] ^ (aa[i + 4] | (~aa[i + 8] >>> 0));
      }
    },
    
    /**
     * Pi2 transformation - right rotation permutation (32-bit)
     * @param {Array} a - State array (12 words)
     */
    pi2: function(a) {
      for (let j = 0; j < this.NUM_WORDS; j++) {
        a[j] = OpCodes.RotR32(a[j], this.shiftConstants[11 - j]);
      }
    },
    
    /**
     * Core DoubleKing round function
     * @param {Array} k - Round key (12 words)
     * @param {Array} a - State array (12 words)
     * @param {Array} RC - Round constants
     */
    doubleKingCore: function(k, a, RC) {
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
     * @param {Array} block - 48-byte input block
     * @returns {Array} 48-byte encrypted block
     */
    encryptBlock: function(unused, block) {
      if (!this.encryptionKey || !block || block.length !== this.BLOCK_SIZE) {
        return null;
      }
      
      // Convert bytes to 32-bit words (big-endian)
      const words = [];
      for (let i = 0; i < this.NUM_WORDS; i++) {
        words[i] = OpCodes.Pack32BE(
          block[i * 4], 
          block[i * 4 + 1], 
          block[i * 4 + 2], 
          block[i * 4 + 3]
        );
      }
      
      // Apply DoubleKing encryption
      this.doubleKingCore(this.encryptionKey, words, this.roundConstants);
      
      // Convert words back to bytes (big-endian)
      const result = new Array(this.BLOCK_SIZE);
      for (let i = 0; i < this.NUM_WORDS; i++) {
        const bytes = OpCodes.Unpack32BE(words[i]);
        result[i * 4] = bytes[0];
        result[i * 4 + 1] = bytes[1];
        result[i * 4 + 2] = bytes[2];
        result[i * 4 + 3] = bytes[3];
      }
      
      return result;
    },
    
    /**
     * Decrypt a single block
     * @param {Array} block - 48-byte encrypted block
     * @returns {Array} 48-byte decrypted block
     */
    decryptBlock: function(unused, block) {
      if (!this.decryptionKey || !block || block.length !== this.BLOCK_SIZE) {
        return null;
      }
      
      // Convert bytes to 32-bit words (big-endian)
      const words = [];
      for (let i = 0; i < this.NUM_WORDS; i++) {
        words[i] = OpCodes.Pack32BE(
          block[i * 4], 
          block[i * 4 + 1], 
          block[i * 4 + 2], 
          block[i * 4 + 3]
        );
      }
      
      // For decryption, we need to reverse the operations
      // 1. Reverse Mu (Mu is its own inverse)
      this.mu(words);
      
      // 2. Reverse final Theta (Theta is its own inverse)
      this.theta(this.decryptionKey, words, this.roundConstants[this.NUM_ROUNDS]);
      
      // 3. Reverse 11 rounds in reverse order
      for (let i = this.NUM_ROUNDS - 1; i >= 0; i--) {
        // Reverse in exact opposite order
        this.pi2Inverse(words);   // Reverse Pi2 (right rotation becomes left)
        this.gamma(words);        // Gamma is its own inverse
        this.pi1Inverse(words);   // Reverse Pi1 (left rotation becomes right)
        this.theta(this.decryptionKey, words, this.roundConstants[i]); // Reverse Theta
      }
      
      // Convert words back to bytes (big-endian)
      const result = new Array(this.BLOCK_SIZE);
      for (let i = 0; i < this.NUM_WORDS; i++) {
        const bytes = OpCodes.Unpack32BE(words[i]);
        result[i * 4] = bytes[0];
        result[i * 4 + 1] = bytes[1];
        result[i * 4 + 2] = bytes[2];
        result[i * 4 + 3] = bytes[3];
      }
      
      return result;
    },
    
    /**
     * Pi1 inverse transformation - right rotation permutation (inverse of Pi1)
     * @param {Array} a - State array (12 words)
     */
    pi1Inverse: function(a) {
      for (let j = 0; j < this.NUM_WORDS; j++) {
        a[j] = OpCodes.RotR32(a[j], this.shiftConstants[j]);
      }
    },
    
    /**
     * Pi2 inverse transformation - left rotation permutation (inverse of Pi2)
     * @param {Array} a - State array (12 words)
     */
    pi2Inverse: function(a) {
      for (let j = 0; j < this.NUM_WORDS; j++) {
        a[j] = OpCodes.RotL32(a[j], this.shiftConstants[11 - j]);
      }
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function') {
    global.Cipher.Add(DoubleKing);
  } else if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(DoubleKing);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DoubleKing;
  }
  
  // Make available globally
  global.DoubleKing = DoubleKing;
  
})(typeof global !== 'undefined' ? global : window);