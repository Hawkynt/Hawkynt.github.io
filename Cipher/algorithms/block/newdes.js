#!/usr/bin/env node
/*
 * NewDES Block Cipher - Universal Implementation
 * 
 * NewDES (New Data Encryption Standard) is a block cipher designed by Robert Scott.
 * Published in Cryptologia, Volume 9, Number 1 (January 1985).
 * 
 * Key features:
 * - Block size: 64 bits (8 bytes)
 * - Key size: 120 bits (15 bytes)
 * - Structure: Feistel-like with 8 rounds + final transformation
 * - Operations: XOR with S-box substitution using a 256-byte rotor
 * 
 * NewDES was designed to be easier to implement in software than DES
 * and supposedly more secure, though it has since been cryptanalyzed.
 * 
 * Based on Mark Riordan's reference implementation from August 1990.
 * 
 * Educational implementation - not for production use.
 * Compatible with both Browser and Node.js environments.
 * 
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Load OpCodes if in Node.js environment
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const NewDES = {
    
    // Cipher identification
    internalName: 'newdes',
    name: 'NewDES (64-bit block, 120-bit key)',
    // Required Cipher interface properties
    minKeyLength: 16,        // Minimum key length in bytes
    maxKeyLength: 32,        // Maximum key length in bytes
    stepKeyLength: 8,       // Key length step size
    minBlockSize: 8,        // Minimum block size in bytes
    maxBlockSize: 16,        // Maximum block size (0 = unlimited)
    stepBlockSize: 8,       // Block size step
    instances: {},          // Instance tracking
    
    // Algorithm parameters
    BLOCK_SIZE: 8,           // 64 bits = 8 bytes
    KEY_SIZE: 15,            // 120 bits = 15 bytes
    UNRAVELLED_KEY_SIZE: 60, // 15 * 4 = 60 bytes for key schedule
    ROTOR_SIZE: 256,         // S-box size
    ROUNDS: 8,               // Number of main rounds
    
    // NewDES S-box (rotor) - fixed substitution table
    rotor: [
      32, 137, 239, 188, 102, 125, 221,  72, 212,  68,  81,  37,  86, 237, 147, 149,
      70, 229,  17, 124, 115, 207,  33,  20, 122, 143,  25, 215,  51, 183, 138, 142,
     146, 211, 110, 173,   1, 228, 189,  14, 103,  78, 162,  36, 253, 167, 116, 255,
     158,  45, 185,  50,  98, 168, 250, 235,  54, 141, 195, 247, 240,  63, 148,   2,
     224, 169, 214, 180,  62,  22, 117, 108,  19, 172, 161, 159, 160,  47,  43, 171,
     194, 175, 178,  56, 196, 112,  23, 220,  89,  21, 164, 130, 157,   8,  85, 251,
     216,  44,  94, 179, 226,  38,  90, 119,  40, 202,  34, 206,  35,  69, 231, 246,
      29, 109,  74,  71, 176,   6,  60, 145,  65,  13,  77, 151,  12, 127,  95, 199,
      57, 101,   5, 232, 150, 210, 129,  24, 181,  10, 121, 187,  48, 193, 139, 252,
     219,  64,  88, 233,  96, 128,  80,  53, 191, 144, 218,  11, 106, 132, 155, 104,
      91, 136,  31,  42, 243,  66, 126, 135,  30,  26,  87, 186, 182, 154, 242, 123,
      82, 166, 208,  39, 152, 190, 113, 205, 114, 105, 225,  84,  73, 163,  99, 111,
     204,  61, 200, 217, 170,  15, 198,  28, 192, 254, 134, 234, 222,   7, 236, 248,
     201,  41, 177, 156,  92, 131,  67, 249, 245, 184, 203,   9, 241,   0,  27,  46,
     133, 174,  75,  18,  93, 209, 100, 120,  76, 213,  16,  83,   4, 107, 140,  52,
      58,  55,   3, 244,  97, 197, 238, 227, 118,  49,  79, 230, 223, 165, 153,  59
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
     * @param {Array} key - 15-byte key array
     * @returns {boolean} Success status
     */
    KeySetup: function(key) {
      if (!key || key.length !== this.KEY_SIZE) {
        return false;
      }
      
      // Set up encryption key (simple repetition)
      this.encryptionKey = this.setupEncryptionKey(key);
      
      // Set up decryption key (different pattern)
      this.decryptionKey = this.setupDecryptionKey(key);
      
      return true;
    },
    
    /**
     * Create encryption key schedule
     * @param {Array} key - 15-byte user key
     * @returns {Array} 60-byte unravelled key for encryption
     */
    setupEncryptionKey: function(key) {
      const unravelledKey = new Array(this.UNRAVELLED_KEY_SIZE);
      
      // For encryption: simply repeat the 15-byte key 4 times
      for (let i = 0; i < this.UNRAVELLED_KEY_SIZE; i++) {
        unravelledKey[i] = key[i % this.KEY_SIZE];
      }
      
      return unravelledKey;
    },
    
    /**
     * Create decryption key schedule 
     * @param {Array} key - 15-byte user key
     * @returns {Array} 60-byte unravelled key for decryption
     */
    setupDecryptionKey: function(key) {
      const unravelledKey = new Array(this.UNRAVELLED_KEY_SIZE);
      let keyPos = 0;
      let userKeyIdx = 11; // Start at position 11
      
      while (true) {
        // Copy 4 bytes with wrapping
        unravelledKey[keyPos++] = key[userKeyIdx];
        userKeyIdx = (userKeyIdx + 1) % this.KEY_SIZE;
        
        unravelledKey[keyPos++] = key[userKeyIdx];
        userKeyIdx = (userKeyIdx + 1) % this.KEY_SIZE;
        
        unravelledKey[keyPos++] = key[userKeyIdx];
        userKeyIdx = (userKeyIdx + 1) % this.KEY_SIZE;
        
        unravelledKey[keyPos++] = key[userKeyIdx];
        userKeyIdx = (userKeyIdx + 9) % this.KEY_SIZE;
        
        if (userKeyIdx === 12) break;
        
        // Copy 3 more bytes
        unravelledKey[keyPos++] = key[userKeyIdx++];
        unravelledKey[keyPos++] = key[userKeyIdx++];
        unravelledKey[keyPos++] = key[userKeyIdx];
        
        userKeyIdx = (userKeyIdx + 9) % this.KEY_SIZE;
      }
      
      return unravelledKey;
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
     * Core NewDES block transformation
     * @param {Array} block - 8-byte block to transform
     * @param {Array} unravelledKey - 60-byte key schedule
     */
    newdesBlock: function(block, unravelledKey) {
      let keyPtr = 0;
      
      // 8 main rounds
      for (let round = 0; round < this.ROUNDS; round++) {
        // First half of round: B4-B7 = B4-B7 XOR rotor[B0-B3 XOR key]
        block[4] ^= this.rotor[block[0] ^ unravelledKey[keyPtr++]];
        block[5] ^= this.rotor[block[1] ^ unravelledKey[keyPtr++]];
        block[6] ^= this.rotor[block[2] ^ unravelledKey[keyPtr++]];
        block[7] ^= this.rotor[block[3] ^ unravelledKey[keyPtr++]];
        
        // Second half of round: B0-B3 transformation
        block[1] ^= this.rotor[block[4] ^ unravelledKey[keyPtr++]];
        block[2] ^= this.rotor[block[4] ^ block[5]];  // Note: uses B4 XOR B5, not key
        block[3] ^= this.rotor[block[6] ^ unravelledKey[keyPtr++]];
        block[0] ^= this.rotor[block[7] ^ unravelledKey[keyPtr++]];
      }
      
      // Final transformation (partial round)
      block[4] ^= this.rotor[block[0] ^ unravelledKey[keyPtr++]];
      block[5] ^= this.rotor[block[1] ^ unravelledKey[keyPtr++]];
      block[6] ^= this.rotor[block[2] ^ unravelledKey[keyPtr++]];
      block[7] ^= this.rotor[block[3] ^ unravelledKey[keyPtr++]];
    },
    
    /**
     * Encrypt a single block
     * @param {Array} block - 8-byte input block
     * @returns {Array} 8-byte encrypted block
     */
    encryptBlock: function(unused, block) {
      if (!this.encryptionKey || !block || block.length !== this.BLOCK_SIZE) {
        return null;
      }
      
      // Copy input block
      const result = block.slice();
      
      // Apply NewDES encryption
      this.newdesBlock(result, this.encryptionKey);
      
      return result;
    },
    
    /**
     * Decrypt a single block
     * @param {Array} block - 8-byte encrypted block
     * @returns {Array} 8-byte decrypted block
     */
    decryptBlock: function(unused, block) {
      if (!this.decryptionKey || !block || block.length !== this.BLOCK_SIZE) {
        return null;
      }
      
      // Copy input block
      const result = block.slice();
      
      // Apply NewDES decryption (uses different key schedule)
      this.newdesBlock(result, this.decryptionKey);
      
      return result;
    }
  };
  
  // Auto-register with global Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(NewDES);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = NewDES;
  }
  
  // Make available globally
  global.NewDES = NewDES;
  
})(typeof global !== 'undefined' ? global : window);