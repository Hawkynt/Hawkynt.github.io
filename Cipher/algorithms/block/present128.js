#!/usr/bin/env node
/*
 * PRESENT-128 Block Cipher - Universal Implementation
 * 
 * PRESENT-128 is a variant of the PRESENT lightweight block cipher
 * with 128-bit key size instead of the standard 80-bit key.
 * 
 * Key features:
 * - Block size: 64 bits (8 bytes)
 * - Key size: 128 bits (16 bytes) 
 * - Rounds: 31 rounds
 * - Structure: Substitution-Permutation Network (SPN)
 * - S-box: 4-bit substitution table
 * - P-layer: Bit permutation for diffusion
 * 
 * Based on ISO/IEC 29192-2 specification with extended key schedule.
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
  
  const PRESENT128 = {
    
    // Cipher identification
    internalName: 'present-128',
    name: 'PRESENT-128 (64-bit block, 128-bit key)',
    // Required Cipher interface properties
    minKeyLength: 16,        // Minimum key length in bytes
    maxKeyLength: 32,        // Maximum key length in bytes
    stepKeyLength: 8,       // Key length step size
    minBlockSize: 8,        // Minimum block size in bytes
    maxBlockSize: 16,        // Maximum block size (0 = unlimited)
    stepBlockSize: 8,       // Block size step
    instances: {},          // Instance tracking
    
    // Algorithm parameters
    BLOCK_SIZE: 8,       // 64 bits = 8 bytes
    KEY_SIZE: 16,        // 128 bits = 16 bytes
    ROUNDS: 31,          // Number of rounds
    
    // PRESENT S-Box (4-bit substitution table)
    SBOX: [
      0xC, 0x5, 0x6, 0xB, 0x9, 0x0, 0xA, 0xD,
      0x3, 0xE, 0xF, 0x8, 0x4, 0x7, 0x1, 0x2
    ],
    
    // PRESENT Inverse S-Box 
    SBOX_INV: [
      0x5, 0xE, 0xF, 0x8, 0xC, 0x1, 0x2, 0xD,
      0xB, 0x4, 0x6, 0x3, 0x0, 0x7, 0x9, 0xA
    ],
    
    // PRESENT Bit Permutation Table
    // P[i] = position where bit i goes to
    PERM: [
       0, 16, 32, 48,  1, 17, 33, 49,  2, 18, 34, 50,  3, 19, 35, 51,
       4, 20, 36, 52,  5, 21, 37, 53,  6, 22, 38, 54,  7, 23, 39, 55,
       8, 24, 40, 56,  9, 25, 41, 57, 10, 26, 42, 58, 11, 27, 43, 59,
      12, 28, 44, 60, 13, 29, 45, 61, 14, 30, 46, 62, 15, 31, 47, 63
    ],
    
    // Inverse permutation table (computed from PERM)
    PERM_INV: null,
    
    // Current state
    roundKeys: null,
    
    /**
     * Initialize cipher instance
     */
    Init: function() {
      this.roundKeys = null;
      
      // Compute inverse permutation table
      if (!this.PERM_INV) {
        this.PERM_INV = new Array(64);
        for (let i = 0; i < 64; i++) {
          this.PERM_INV[this.PERM[i]] = i;
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
     * Generate round keys for PRESENT-128
     * @param {Array} key - 16-byte master key
     * @returns {Array} Array of round keys
     */
    generateRoundKeys: function(key) {
      const roundKeys = [];
      
      // Convert key to 64-bit words (big-endian)
      let keyHigh = 0;
      let keyLow = 0;
      
      for (let i = 0; i < 8; i++) {
        keyHigh = (keyHigh << 8) | key[i];
        keyLow = (keyLow << 8) | key[i + 8];
      }
      
      // Store initial round key (leftmost 64 bits)
      roundKeys[0] = keyHigh;
      
      // Generate 31 round keys using PRESENT key schedule
      for (let round = 1; round <= this.ROUNDS; round++) {
        // Rotate key register left by 61 positions
        // For 128-bit key: [K127, K126, ..., K0] → [K66, K65, ..., K0, K127, K126, ..., K67]
        const temp = keyHigh;
        keyHigh = ((keyHigh << 61) | (keyLow >>> 3)) >>> 0;
        keyLow = ((keyLow << 61) | (temp >>> 3)) >>> 0;
        
        // Apply S-box to leftmost 4 bits of key
        const leftmost4 = (keyHigh >>> 28) & 0xF;
        const sboxed = this.SBOX[leftmost4];
        keyHigh = (keyHigh & 0x0FFFFFFF) | (sboxed << 28);
        
        // XOR round counter to bits 19-15 of key
        const roundCounter = round & 0x1F; // 5-bit round counter
        keyHigh ^= (roundCounter << 15);
        
        // Store round key (leftmost 64 bits)
        roundKeys[round] = keyHigh;
      }
      
      return roundKeys;
    },
    
    /**
     * Clear sensitive key material
     */
    ClearData: function() {
      if (this.roundKeys) {
        OpCodes.ClearArray(this.roundKeys);
        this.roundKeys = null;
      }
    },
    
    /**
     * Apply S-box layer
     * @param {number} state - 64-bit state as number
     * @returns {number} State after S-box substitution
     */
    sboxLayer: function(state) {
      let result = 0;
      
      // Apply S-box to each 4-bit nibble
      for (let i = 0; i < 16; i++) {
        const nibble = (state >>> (i * 4)) & 0xF;
        const sboxed = this.SBOX[nibble];
        result |= (sboxed << (i * 4));
      }
      
      return result >>> 0; // Ensure unsigned 32-bit
    },
    
    /**
     * Apply inverse S-box layer
     * @param {number} state - 64-bit state as number
     * @returns {number} State after inverse S-box substitution
     */
    invSboxLayer: function(state) {
      let result = 0;
      
      // Apply inverse S-box to each 4-bit nibble
      for (let i = 0; i < 16; i++) {
        const nibble = (state >>> (i * 4)) & 0xF;
        const invSboxed = this.SBOX_INV[nibble];
        result |= (invSboxed << (i * 4));
      }
      
      return result >>> 0; // Ensure unsigned 32-bit
    },
    
    /**
     * Apply bit permutation layer
     * @param {number} state - 64-bit state as number
     * @returns {number} State after bit permutation
     */
    permLayer: function(state) {
      let result = 0;
      
      // Apply bit permutation
      for (let i = 0; i < 64; i++) {
        if (state & (1 << i)) {
          result |= (1 << this.PERM[i]);
        }
      }
      
      return result >>> 0; // Ensure unsigned 32-bit
    },
    
    /**
     * Apply inverse bit permutation layer
     * @param {number} state - 64-bit state as number
     * @returns {number} State after inverse bit permutation
     */
    invPermLayer: function(state) {
      let result = 0;
      
      // Apply inverse bit permutation
      for (let i = 0; i < 64; i++) {
        if (state & (1 << i)) {
          result |= (1 << this.PERM_INV[i]);
        }
      }
      
      return result >>> 0; // Ensure unsigned 32-bit
    },
    
    /**
     * Convert byte array to 64-bit number (big-endian)
     * @param {Array} bytes - 8-byte array
     * @returns {number} 64-bit number
     */
    bytesToState: function(bytes) {
      let state = 0;
      for (let i = 0; i < 8; i++) {
        state = (state * 256) + bytes[i];
      }
      return state >>> 0; // Ensure unsigned
    },
    
    /**
     * Convert 64-bit number to byte array (big-endian)
     * @param {number} state - 64-bit number
     * @returns {Array} 8-byte array
     */
    stateToBytes: function(state) {
      const bytes = new Array(8);
      for (let i = 7; i >= 0; i--) {
        bytes[i] = state & 0xFF;
        state = Math.floor(state / 256);
      }
      return bytes;
    },
    
    /**
     * Encrypt a single block
     * @param {Array} block - 8-byte input block
     * @returns {Array} 8-byte encrypted block
     */
    encryptBlock: function(unused, block) {
      if (!this.roundKeys || !block || block.length !== this.BLOCK_SIZE) {
        return null;
      }
      
      // Convert block to state
      let state = this.bytesToState(block);
      
      // Initial round key addition
      state ^= this.roundKeys[0];
      
      // 30 full rounds
      for (let round = 1; round < this.ROUNDS; round++) {
        state = this.sboxLayer(state);
        state = this.permLayer(state);
        state ^= this.roundKeys[round];
      }
      
      // Final round (no permutation)
      state = this.sboxLayer(state);
      state ^= this.roundKeys[this.ROUNDS];
      
      // Convert state back to bytes
      return this.stateToBytes(state);
    },
    
    /**
     * Decrypt a single block
     * @param {Array} block - 8-byte encrypted block
     * @returns {Array} 8-byte decrypted block
     */
    decryptBlock: function(unused, block) {
      if (!this.roundKeys || !block || block.length !== this.BLOCK_SIZE) {
        return null;
      }
      
      // Convert block to state
      let state = this.bytesToState(block);
      
      // Initial round key addition
      state ^= this.roundKeys[this.ROUNDS];
      
      // Inverse S-box layer for final round
      state = this.invSboxLayer(state);
      
      // 30 full inverse rounds
      for (let round = this.ROUNDS - 1; round >= 1; round--) {
        state ^= this.roundKeys[round];
        state = this.invPermLayer(state);
        state = this.invSboxLayer(state);
      }
      
      // Final round key addition
      state ^= this.roundKeys[0];
      
      // Convert state back to bytes
      return this.stateToBytes(state);
    }
  };
  
  // Auto-register with global Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(PRESENT128);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PRESENT128;
  }
  
  // Make available globally
  global.PRESENT128 = PRESENT128;
  
})(typeof global !== 'undefined' ? global : window);