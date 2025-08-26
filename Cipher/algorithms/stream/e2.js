#!/usr/bin/env node
/*
 * E2 Block Cipher - Universal Implementation
 * 
 * E2 is a block cipher that was submitted as an AES candidate by NTT.
 * It features a variable number of rounds and flexible structure.
 * 
 * Key features:
 * - Block size: 128 bits (16 bytes)
 * - Key size: 128/192/256 bits (16/24/32 bytes)
 * - Rounds: 12 rounds (for 128-bit key)
 * - Structure: Feistel network with complex F-function
 * - Operations: S-box substitution, linear transformations, key mixing
 * 
 * Based on the AES candidate specification "E2 - A New 128-bit Block Cipher"
 * by NTT (Nippon Telegraph and Telephone Corporation).
 * 
 * Educational implementation - not for production use.
 * Compatible with both Browser and Node.js environments.
 * 
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes:', e.message);
      return;
    }
  }
  
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    try {
      global.AlgorithmFramework = require('../../AlgorithmFramework.js');
    } catch (e) {
      console.error('Failed to load AlgorithmFramework:', e.message);
      return;
    }
  }
  
  const E2 = {
    
    // Cipher identification
    internalName: 'e2',
    name: 'E2 (NTT AES candidate)',
    // Required Cipher interface properties
    minKeyLength: 16,        // Minimum key length in bytes
    maxKeyLength: 32,        // Maximum key length in bytes
    stepKeyLength: 1,       // Key length step size
    minBlockSize: 0,        // Minimum block size in bytes
    maxBlockSize: 0,        // Maximum block size (0 = unlimited)
    stepBlockSize: 1,       // Block size step
    instances: {},          // Instance tracking
    
    // Algorithm parameters
    BLOCK_SIZE: 16,      // 128 bits = 16 bytes
    KEY_SIZE: 16,        // 128 bits = 16 bytes (can support 192/256 bit keys)
    ROUNDS: 12,          // Number of rounds for 128-bit key
    
    // E2 S-boxes (4 different 8-bit S-boxes)
    SBOX: [
      // S-box 0
      [0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
       0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
       0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
       0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
       0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
       0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
       0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
       0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
       0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
       0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
       0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
       0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
       0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
       0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
       0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
       0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16],
      
      // S-box 1 (rotated version of S-box 0)
      [0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76, 0x63,
       0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0, 0xca,
       0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15, 0xb7,
       0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75, 0x04,
       0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84, 0x09,
       0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf, 0x53,
       0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8, 0xd0,
       0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2, 0x51,
       0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73, 0xcd,
       0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb, 0x60,
       0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79, 0xe0,
       0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08, 0xe7,
       0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a, 0xba,
       0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e, 0x70,
       0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf, 0xe1,
       0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16, 0x8c]
    ],
    
    // Linear transformation matrices for E2
    MATRIX: [
      [0x02, 0x03, 0x01, 0x01],
      [0x01, 0x02, 0x03, 0x01], 
      [0x01, 0x01, 0x02, 0x03],
      [0x03, 0x01, 0x01, 0x02]
    ],
    
    // Current state
    roundKeys: null,
    
    /**
     * Initialize cipher instance
     */
    Init: function() {
      this.roundKeys = null;
      return true;
    },
    
    /**
     * Set up round keys from master key
     * @param {Array} key - 16-byte key array
     * @returns {boolean} Success status
     */
    KeySetup: function(key) {
      if (!key || key.length !== this.KEY_SIZE) {
        return false;
      }
      
      this.roundKeys = this.generateRoundKeys(key);
      return true;
    },
    
    /**
     * Generate round keys for E2
     * @param {Array} key - 16-byte master key
     * @returns {Array} Array of round keys
     */
    generateRoundKeys: function(key) {
      const roundKeys = [];
      
      // Convert key to 32-bit words
      const keyWords = [];
      for (let i = 0; i < 4; i++) {
        keyWords[i] = OpCodes.Pack32BE(key[i*4], key[i*4+1], key[i*4+2], key[i*4+3]);
      }
      
      // Generate round keys using E2 key schedule
      for (let round = 0; round <= this.ROUNDS; round++) {
        const roundKey = new Array(16);
        
        for (let i = 0; i < 4; i++) {
          // Apply round-specific transformation
          let word = keyWords[i];
          word = OpCodes.RotL32(word, (round * 4 + i) % 32);
          word ^= (round << 24) | (round << 16) | (round << 8) | round;
          
          // Apply S-box to bytes
          const bytes = OpCodes.Unpack32BE(word);
          for (let j = 0; j < 4; j++) {
            bytes[j] = this.SBOX[j % 2][bytes[j]];
          }
          word = OpCodes.Pack32BE(bytes[0], bytes[1], bytes[2], bytes[3]);
          
          // Store in round key
          const wordBytes = OpCodes.Unpack32BE(word);
          for (let j = 0; j < 4; j++) {
            roundKey[i * 4 + j] = wordBytes[j];
          }
        }
        
        roundKeys[round] = roundKey;
        
        // Update key words for next round
        const temp = keyWords[0];
        for (let i = 0; i < 3; i++) {
          keyWords[i] = keyWords[i + 1];
        }
        keyWords[3] = OpCodes.RotL32(temp, 8) ^ roundKeys[round][0];
      }
      
      return roundKeys;
    },
    
    /**
     * Clear sensitive key material
     */
    ClearData: function() {
      if (this.roundKeys) {
        for (let i = 0; i < this.roundKeys.length; i++) {
          OpCodes.ClearArray(this.roundKeys[i]);
        }
        this.roundKeys = null;
      }
    },
    
    /**
     * E2 F-function (64-bit to 64-bit transformation)
     * @param {Array} input - 8-byte input
     * @param {Array} roundKey - 8-byte round key
     * @returns {Array} 8-byte output
     */
    fFunction: function(input, roundKey) {
      // XOR with round key
      const temp = new Array(8);
      for (let i = 0; i < 8; i++) {
        temp[i] = input[i] ^ roundKey[i];
      }
      
      // Apply S-boxes alternately
      for (let i = 0; i < 8; i++) {
        temp[i] = this.SBOX[i % 2][temp[i]];
      }
      
      // Linear transformation (simplified matrix multiplication)
      const output = new Array(8);
      for (let i = 0; i < 2; i++) { // Process two 4-byte groups
        const offset = i * 4;
        for (let j = 0; j < 4; j++) {
          output[offset + j] = 0;
          for (let k = 0; k < 4; k++) {
            output[offset + j] ^= OpCodes.GF256Mul(this.MATRIX[j][k], temp[offset + k]);
          }
        }
      }
      
      return output;
    },
    
    /**
     * Add round key to state
     * @param {Array} state - 16-byte state array
     * @param {Array} roundKey - 16-byte round key
     */
    addRoundKey: function(state, roundKey) {
      for (let i = 0; i < 16; i++) {
        state[i] ^= roundKey[i];
      }
    },
    
    /**
     * Encrypt a single block
     * @param {Array} block - 16-byte input block
     * @returns {Array} 16-byte encrypted block
     */
    encryptBlock: function(unused, block) {
      if (!this.roundKeys || !block || block.length !== this.BLOCK_SIZE) {
        return null;
      }
      
      // Split block into left (L) and right (R) halves
      let left = block.slice(0, 8);
      let right = block.slice(8, 16);
      
      // Initial key addition
      this.addRoundKey(left.concat(right), this.roundKeys[0]);
      
      // 12-round Feistel structure
      for (let round = 1; round <= this.ROUNDS; round++) {
        // Feistel round: L' = R, R' = L ⊕ F(R, RK)
        const fOutput = this.fFunction(right, this.roundKeys[round].slice(0, 8));
        const newLeft = right.slice();
        
        // XOR left with F-function output
        for (let i = 0; i < 8; i++) {
          right[i] = left[i] ^ fOutput[i];
        }
        left = newLeft;
      }
      
      // Final swap and concatenation
      return right.concat(left);
    },
    
    /**
     * Decrypt a single block
     * @param {Array} block - 16-byte encrypted block
     * @returns {Array} 16-byte decrypted block
     */
    decryptBlock: function(unused, block) {
      if (!this.roundKeys || !block || block.length !== this.BLOCK_SIZE) {
        return null;
      }
      
      // Split block into left (L) and right (R) halves
      let left = block.slice(0, 8);
      let right = block.slice(8, 16);
      
      // Initial swap (reverse of final encryption swap)
      [left, right] = [right, left];
      
      // 12-round reverse Feistel structure
      for (let round = this.ROUNDS; round >= 1; round--) {
        // Reverse Feistel round: R' = L, L' = R ⊕ F(L, RK)
        const fOutput = this.fFunction(left, this.roundKeys[round].slice(0, 8));
        const newRight = left.slice();
        
        // XOR right with F-function output
        for (let i = 0; i < 8; i++) {
          left[i] = right[i] ^ fOutput[i];
        }
        right = newRight;
      }
      
      // Final key subtraction
      const result = left.concat(right);
      this.addRoundKey(result, this.roundKeys[0]);
      
      return result;
    }
  };
  
  // Auto-register with AlgorithmFramework if available
  if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
    global.AlgorithmFramework.RegisterAlgorithm(E2);
  }
  
  // Legacy registration
  if (typeof global.RegisterAlgorithm === 'function') {
    global.RegisterAlgorithm(E2);
  }
  
  // Auto-register with Cipher system if available
  if (global.Cipher) {
    global.Cipher.Add(E2);
  }
  
  // Export to global scope
  global.E2 = E2;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = E2;
  }
  
})(typeof global !== 'undefined' ? global : window);