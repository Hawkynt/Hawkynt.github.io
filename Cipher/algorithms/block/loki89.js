#!/usr/bin/env node
/*
 * LOKI89 Block Cipher - Universal Implementation
 * 
 * LOKI89 is the predecessor to LOKI97, designed by Lawrie Brown and Josef Pieprzyk.
 * It's a 64-bit block cipher with a 64-bit key using a 16-round Feistel structure.
 * 
 * Key features:
 * - Block size: 64 bits (8 bytes)
 * - Key size: 64 bits (8 bytes)
 * - Rounds: 16 rounds
 * - Structure: Feistel network with complex F-function
 * - Operations: S-box substitution, permutation, expansion, compression
 * 
 * Based on the original LOKI89 specification by Brown and Pieprzyk.
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
  
  const LOKI89 = {
    
    // Cipher identification
    internalName: 'loki89',
    name: 'LOKI89 (64-bit predecessor to LOKI97)',
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
    KEY_SIZE: 8,         // 64 bits = 8 bytes
    ROUNDS: 16,          // Number of rounds
    
    // LOKI89 S-boxes (4-bit to 4-bit substitution tables)
    SBOX: [
      // S-box 0
      [0xE, 0x4, 0xD, 0x1, 0x2, 0xF, 0xB, 0x8, 0x3, 0xA, 0x6, 0xC, 0x5, 0x9, 0x0, 0x7],
      // S-box 1  
      [0x0, 0xF, 0x7, 0x4, 0xE, 0x2, 0xD, 0x1, 0xA, 0x6, 0xC, 0xB, 0x9, 0x5, 0x3, 0x8],
      // S-box 2
      [0x4, 0x1, 0xE, 0x8, 0xD, 0x6, 0x2, 0xB, 0xF, 0xC, 0x9, 0x7, 0x3, 0xA, 0x5, 0x0],
      // S-box 3
      [0xF, 0xC, 0x8, 0x2, 0x4, 0x9, 0x1, 0x7, 0x5, 0xB, 0x3, 0xE, 0xA, 0x0, 0x6, 0xD]
    ],
    
    // Expansion permutation E (32 bits to 48 bits)
    E_TABLE: [
      32,  1,  2,  3,  4,  5,
       4,  5,  6,  7,  8,  9,
       8,  9, 10, 11, 12, 13,
      12, 13, 14, 15, 16, 17,
      16, 17, 18, 19, 20, 21,
      20, 21, 22, 23, 24, 25,
      24, 25, 26, 27, 28, 29,
      28, 29, 30, 31, 32,  1
    ],
    
    // Permutation P (32 bits permutation)
    P_TABLE: [
      16,  7, 20, 21, 29, 12, 28, 17,
       1, 15, 23, 26,  5, 18, 31, 10,
       2,  8, 24, 14, 32, 27,  3,  9,
      19, 13, 30,  6, 22, 11,  4, 25
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
     * @param {Array} key - 8-byte key array
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
     * Generate round keys for LOKI89
     * @param {Array} key - 8-byte master key
     * @returns {Array} Array of round keys
     */
    generateRoundKeys: function(key) {
      const roundKeys = [];
      
      // Convert key to 64-bit value
      let keyValue = 0;
      for (let i = 0; i < 8; i++) {
        keyValue = (keyValue * 256) + key[i];
      }
      
      // Generate 16 round keys
      for (let round = 0; round < this.ROUNDS; round++) {
        // LOKI89 key schedule: circular left shift by round-dependent amount
        const shiftAmount = ((round % 4) + 1) * 3;
        keyValue = this.rotateLeft64(keyValue, shiftAmount);
        
        // XOR with round constant
        const roundConstant = this.generateRoundConstant(round);
        keyValue ^= roundConstant;
        
        // Extract 48-bit round key from middle bits
        const roundKey = (keyValue >>> 8) & 0xFFFFFFFFFFFF;
        roundKeys[round] = this.splitToBytes(roundKey, 6);
      }
      
      return roundKeys;
    },
    
    /**
     * Generate round constant for key schedule
     * @param {number} round - Round number
     * @returns {number} Round constant
     */
    generateRoundConstant: function(round) {
      // Simple round constant generation
      let constant = 0x0123456789ABCDEF;
      for (let i = 0; i < round; i++) {
        constant = this.rotateLeft64(constant, 7) ^ (i + 1);
      }
      return constant;
    },
    
    /**
     * 64-bit left rotation (JavaScript implementation)
     * @param {number} value - Value to rotate
     * @param {number} positions - Positions to rotate
     * @returns {number} Rotated value
     */
    rotateLeft64: function(value, positions) {
      positions = positions % 64;
      // Split into two 32-bit halves for JavaScript number handling
      const high = Math.floor(value / 0x100000000);
      const low = value % 0x100000000;
      
      if (positions === 0) return value;
      if (positions === 32) return (low * 0x100000000) + high;
      
      // General case - simplified for this implementation
      const shifted = (value * Math.pow(2, positions)) % Math.pow(2, 64);
      const overflow = Math.floor(value / Math.pow(2, 64 - positions));
      return shifted + overflow;
    },
    
    /**
     * Split number into byte array
     * @param {number} value - Value to split
     * @param {number} bytes - Number of bytes
     * @returns {Array} Byte array
     */
    splitToBytes: function(value, bytes) {
      const result = new Array(bytes);
      for (let i = bytes - 1; i >= 0; i--) {
        result[i] = value & 0xFF;
        value = Math.floor(value / 256);
      }
      return result;
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
     * Expansion function E (32 bits to 48 bits)
     * @param {number} input - 32-bit input
     * @returns {Array} 48-bit output as 6-byte array
     */
    expansionE: function(input) {
      const result = new Array(6);
      let output = 0;
      
      // Apply expansion permutation
      for (let i = 0; i < 48; i++) {
        const bit = (input >>> (32 - this.E_TABLE[i])) & 1;
        output |= (bit << (47 - i));
      }
      
      // Convert to byte array
      return this.splitToBytes(output, 6);
    },
    
    /**
     * Permutation P (32-bit permutation)
     * @param {number} input - 32-bit input
     * @returns {number} 32-bit permuted output
     */
    permutationP: function(input) {
      let output = 0;
      
      // Apply permutation
      for (let i = 0; i < 32; i++) {
        const bit = (input >>> (32 - this.P_TABLE[i])) & 1;
        output |= (bit << (31 - i));
      }
      
      return output >>> 0; // Ensure unsigned
    },
    
    /**
     * LOKI89 F-function
     * @param {number} input - 32-bit input
     * @param {Array} roundKey - 6-byte round key
     * @returns {number} 32-bit output
     */
    fFunction: function(input, roundKey) {
      // Expansion E: 32 bits → 48 bits
      const expanded = this.expansionE(input);
      
      // XOR with round key
      for (let i = 0; i < 6; i++) {
        expanded[i] ^= roundKey[i];
      }
      
      // S-box substitution: 48 bits → 32 bits
      let sboxOutput = 0;
      for (let i = 0; i < 8; i++) {
        // Extract 6-bit chunk
        const chunk6 = (expanded[Math.floor(i * 6 / 8)] >>> (2 - (i * 6) % 8)) & 0x3F;
        
        // Split into row (2 bits) and column (4 bits)
        const row = (chunk6 & 0x20) | (chunk6 & 0x01);
        const col = (chunk6 >>> 1) & 0x0F;
        
        // Apply S-box
        const sboxValue = this.SBOX[i % 4][col];
        sboxOutput |= (sboxValue << (28 - i * 4));
      }
      
      // Permutation P: 32 bits → 32 bits
      return this.permutationP(sboxOutput);
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
      
      // Convert bytes to 32-bit words
      let left = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      let right = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
      
      // 16-round Feistel structure
      for (let round = 0; round < this.ROUNDS; round++) {
        const temp = right;
        right = left ^ this.fFunction(right, this.roundKeys[round]);
        left = temp;
      }
      
      // Final swap
      [left, right] = [right, left];
      
      // Convert back to bytes
      const leftBytes = OpCodes.Unpack32BE(left);
      const rightBytes = OpCodes.Unpack32BE(right);
      
      return leftBytes.concat(rightBytes);
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
      
      // Convert bytes to 32-bit words
      let left = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      let right = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
      
      // Initial swap (reverse of final encryption swap)
      [left, right] = [right, left];
      
      // 16-round reverse Feistel structure
      for (let round = this.ROUNDS - 1; round >= 0; round--) {
        const temp = right;
        right = left ^ this.fFunction(right, this.roundKeys[round]);
        left = temp;
      }
      
      // Convert back to bytes
      const leftBytes = OpCodes.Unpack32BE(left);
      const rightBytes = OpCodes.Unpack32BE(right);
      
      return leftBytes.concat(rightBytes);
    }
  };
  
  // Auto-register with global Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(LOKI89);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LOKI89;
  }
  
  // Make available globally
  global.LOKI89 = LOKI89;
  
})(typeof global !== 'undefined' ? global : window);