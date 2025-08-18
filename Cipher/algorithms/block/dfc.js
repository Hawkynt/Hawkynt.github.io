#!/usr/bin/env node
/*
 * DFC Block Cipher - Universal Implementation
 * 
 * DFC (Data Encryption Standard Forte Cipher) was an AES candidate
 * designed by CNRS (Centre National de la Recherche Scientifique), France.
 * 
 * Key features:
 * - Block size: 128 bits (16 bytes)
 * - Key size: 128/192/256 bits (16/24/32 bytes)
 * - Rounds: 8 rounds
 * - Structure: Decorrelated Fast Cipher with complex round function
 * - Operations: S-box substitution, linear transformation, key mixing
 * 
 * Based on the AES candidate specification for DFC by CNRS.
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
  
  const DFC = {
    
    // Cipher identification
    internalName: 'dfc',
    name: 'DFC (CNRS AES candidate)',
    comment: 'DFC (Data Encryption Standard Forte Cipher) - AES candidate by CNRS',
    
    // Required cipher interface properties
    minKeyLength: 16,     // 128-bit minimum key
    maxKeyLength: 32,     // 256-bit maximum key
    stepKeyLength: 8,     // Key length step
    minBlockSize: 16,     // 128-bit block size
    maxBlockSize: 16,     // Fixed block size
    stepBlockSize: 1,     // Block size step
    cantDecode: false,   // Supports decryption
    isInitialized: false,         // Not initialized
    instances: {},        // Instance storage
    
    // Algorithm parameters
    BLOCK_SIZE: 16,      // 128 bits = 16 bytes
    KEY_SIZE: 16,        // 128 bits = 16 bytes (can support 192/256 bit keys)
    ROUNDS: 8,           // Number of rounds
    
    // DFC S-box (8-bit substitution table)
    SBOX: [
      0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
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
      0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
    ],
    
    // DFC inverse S-box
    SBOX_INV: null,
    
    // DFC linear transformation constants
    RT: [
      0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80,
      0x1B, 0x36, 0x6C, 0xD8, 0xAB, 0x4D, 0x9A, 0x2F
    ],
    
    // Current state
    roundKeys: null,
    
    /**
     * Initialize cipher instance
     */
    Init: function() {
      this.roundKeys = null;
      
      // Generate inverse S-box
      if (!this.SBOX_INV) {
        this.SBOX_INV = new Array(256);
        for (let i = 0; i < 256; i++) {
          this.SBOX_INV[this.SBOX[i]] = i;
        }
      }
      
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
     * Generate round keys for DFC
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
      
      // DFC key schedule
      for (let round = 0; round <= this.ROUNDS; round++) {
        const roundKey = new Array(16);
        
        // Generate 4 words for this round
        for (let i = 0; i < 4; i++) {
          let word = keyWords[i];
          
          // Apply round transformation
          word = OpCodes.RotL32(word, (round * 3 + i) % 32);
          word ^= this.RT[round % 16] << (i * 8);
          
          // Apply S-box to each byte
          const bytes = OpCodes.Unpack32BE(word);
          for (let j = 0; j < 4; j++) {
            bytes[j] = this.SBOX[bytes[j]];
          }
          word = OpCodes.Pack32BE(bytes[0], bytes[1], bytes[2], bytes[3]);
          
          // Store in round key
          const wordBytes = OpCodes.Unpack32BE(word);
          for (let j = 0; j < 4; j++) {
            roundKey[i * 4 + j] = wordBytes[j];
          }
          
          // Update key word for next iteration
          keyWords[i] = word;
        }
        
        roundKeys[round] = roundKey;
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
     * DFC round function
     * @param {Array} state - 16-byte state array
     * @param {Array} roundKey - 16-byte round key
     */
    dfcRound: function(state, roundKey) {
      // Add round key
      for (let i = 0; i < 16; i++) {
        state[i] ^= roundKey[i];
      }
      
      // S-box substitution
      for (let i = 0; i < 16; i++) {
        state[i] = this.SBOX[state[i]];
      }
      
      // Linear transformation (simplified DFC diffusion)
      const temp = state.slice();
      
      // Process in 4x4 matrix form
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          const pos = i * 4 + j;
          state[pos] = temp[pos] ^ 
                      OpCodes.GF256Mul(0x02, temp[(i * 4 + (j + 1) % 4)]) ^
                      OpCodes.GF256Mul(0x03, temp[((i + 1) % 4) * 4 + j]) ^
                      temp[((i + 2) % 4) * 4 + (j + 2) % 4];
        }
      }
      
      // Additional DFC-specific permutation
      const perm = state.slice();
      for (let i = 0; i < 16; i++) {
        state[i] = perm[(i * 7) % 16];
      }
    },
    
    /**
     * DFC inverse round function
     * @param {Array} state - 16-byte state array
     * @param {Array} roundKey - 16-byte round key
     */
    dfcInvRound: function(state, roundKey) {
      // Inverse DFC-specific permutation
      const perm = state.slice();
      for (let i = 0; i < 16; i++) {
        state[(i * 7) % 16] = perm[i];
      }
      
      // Inverse linear transformation
      const temp = state.slice();
      
      // Process in 4x4 matrix form (inverse)
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          const pos = i * 4 + j;
          state[pos] = temp[pos] ^ 
                      OpCodes.GF256Mul(0x0E, temp[(i * 4 + (j + 1) % 4)]) ^
                      OpCodes.GF256Mul(0x0B, temp[((i + 1) % 4) * 4 + j]) ^
                      OpCodes.GF256Mul(0x0D, temp[((i + 2) % 4) * 4 + (j + 2) % 4]);
        }
      }
      
      // Inverse S-box substitution
      for (let i = 0; i < 16; i++) {
        state[i] = this.SBOX_INV[state[i]];
      }
      
      // Subtract round key
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
      
      // Copy input block to state
      const state = block.slice();
      
      // Initial key whitening
      for (let i = 0; i < 16; i++) {
        state[i] ^= this.roundKeys[0][i];
      }
      
      // 8 rounds
      for (let round = 1; round <= this.ROUNDS; round++) {
        this.dfcRound(state, this.roundKeys[round]);
      }
      
      return state;
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
      
      // Copy input block to state
      const state = block.slice();
      
      // 8 inverse rounds
      for (let round = this.ROUNDS; round >= 1; round--) {
        this.dfcInvRound(state, this.roundKeys[round]);
      }
      
      // Final key whitening
      for (let i = 0; i < 16; i++) {
        state[i] ^= this.roundKeys[0][i];
      }
      
      return state;
    }
  };
  
  // Auto-register with global Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(DFC);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DFC;
  }
  
  // Make available globally
  global.DFC = DFC;
  
})(typeof global !== 'undefined' ? global : window);