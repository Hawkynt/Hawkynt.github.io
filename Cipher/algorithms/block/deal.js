#!/usr/bin/env node
/*
 * DEAL Universal Implementation
 * 128-bit block cipher based on 3DES
 * NIST AES competition submission by Lars Knudsen and Vincent Rijmen
 * Uses 3DES in a ladder-like structure with 6 or 8 rounds
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Load OpCodes if in Node.js environment
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const DEAL = {
    internalName: 'deal',
    name: 'DEAL',
    minKeyLength: 16,    // 128 bits minimum
    maxKeyLength: 24,    // 192 bits maximum
    stepKeyLength: 8,    // Steps of 64 bits
    minBlockSize: 16,    // 128 bits
    maxBlockSize: 16,    // 128 bits  
    stepBlockSize: 1,
    
    // Instance storage
    instances: {},
    isInitialized: false,
    
    // DES S-boxes for 3DES operations
    S_BOXES: null,
    PERM_TABLE: null,
    EXPANSION_TABLE: null,
    PC1_TABLE: null,
    PC2_TABLE: null,
    
    /**
     * Initialize DEAL with DES tables
     */
    Init: function() {
      if (DEAL.isInitialized) return true;
      
      // DES S-boxes
      DEAL.S_BOXES = [
        // S1
        [
          [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7],
          [0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8],
          [4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0],
          [15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13]
        ],
        // S2
        [
          [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10],
          [3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5],
          [0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15],
          [13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9]
        ],
        // S3
        [
          [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8],
          [13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1],
          [13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7],
          [1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12]
        ],
        // S4
        [
          [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15],
          [13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9],
          [10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4],
          [3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14]
        ],
        // S5
        [
          [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9],
          [14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6],
          [4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14],
          [11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3]
        ],
        // S6
        [
          [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11],
          [10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8],
          [9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6],
          [4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13]
        ],
        // S7
        [
          [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1],
          [13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6],
          [1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2],
          [6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12]
        ],
        // S8
        [
          [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7],
          [1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2],
          [7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8],
          [2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11]
        ]
      ];
      
      // Expansion permutation table
      DEAL.EXPANSION_TABLE = [
        32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9,
        8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17,
        16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25,
        24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1
      ];
      
      // P-box permutation
      DEAL.PERM_TABLE = [
        16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10,
        2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25
      ];
      
      // PC1 permutation for key schedule
      DEAL.PC1_TABLE = [
        57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18,
        10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36,
        63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22,
        14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4
      ];
      
      // PC2 permutation for key schedule
      DEAL.PC2_TABLE = [
        14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10,
        23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2,
        41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48,
        44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32
      ];
      
      DEAL.isInitialized = true;
      return true;
    },
    
    /**
     * DES F function implementation
     */
    _desF: function(right, subkey) {
      // Expansion
      let expanded = 0;
      for (let i = 0; i < 48; i++) {
        const bit = (right >>> (32 - DEAL.EXPANSION_TABLE[i])) & 1;
        expanded |= (bit << (47 - i));
      }
      
      // XOR with subkey
      expanded ^= subkey;
      
      // S-box substitution
      let result = 0;
      for (let i = 0; i < 8; i++) {
        const sixBits = (expanded >>> (42 - i * 6)) & 0x3F;
        const row = ((sixBits & 0x20) >>> 4) | (sixBits & 1);
        const col = (sixBits >>> 1) & 0x0F;
        const sboxValue = DEAL.S_BOXES[i][row][col];
        result |= (sboxValue << (28 - i * 4));
      }
      
      // P-box permutation
      let permuted = 0;
      for (let i = 0; i < 32; i++) {
        const bit = (result >>> (32 - DEAL.PERM_TABLE[i])) & 1;
        permuted |= (bit << (31 - i));
      }
      
      return permuted >>> 0;
    },
    
    /**
     * DES key schedule for one key
     */
    _desKeySchedule: function(key64) {
      // PC1 permutation
      let permuted = OpCodes.LongFromBytes([0, 0, 0, 0, 0, 0, 0, 0]);
      for (let i = 0; i < 56; i++) {
        const bit = OpCodes.GetBit64(key64, 64 - DEAL.PC1_TABLE[i]);
        permuted = OpCodes.SetBit64(permuted, 55 - i, bit);
      }
      
      let left = OpCodes.Hi32(permuted) >>> 4;  // upper 28 bits
      let right = OpCodes.Lo32(permuted) >>> 4; // lower 28 bits
      
      const roundKeys = new Array(16);
      const shifts = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
      
      for (let round = 0; round < 16; round++) {
        // Left rotate both halves
        const shift = shifts[round];
        left = ((left << shift) | (left >>> (28 - shift))) & 0x0FFFFFFF;
        right = ((right << shift) | (right >>> (28 - shift))) & 0x0FFFFFFF;
        
        // Combine and apply PC2
        const combined = OpCodes.LongFromHiLo((left << 4) >>> 0, (right << 4) >>> 0);
        let roundKey = OpCodes.LongFromBytes([0, 0, 0, 0, 0, 0, 0, 0]);
        
        for (let i = 0; i < 48; i++) {
          const bit = OpCodes.GetBit64(combined, 56 - DEAL.PC2_TABLE[i]);
          roundKey = OpCodes.SetBit64(roundKey, 47 - i, bit);
        }
        
        roundKeys[round] = roundKey;
      }
      
      return roundKeys;
    },
    
    /**
     * Single DES encryption
     */
    _desEncrypt: function(block64, roundKeys) {
      // Initial permutation (IP)
      let permuted = OpCodes.LongFromBytes([0, 0, 0, 0, 0, 0, 0, 0]);
      const ipTable = [
        58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4,
        62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8,
        57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3,
        61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7
      ];
      
      for (let i = 0; i < 64; i++) {
        const bit = OpCodes.GetBit64(block64, 64 - ipTable[i]);
        permuted = OpCodes.SetBit64(permuted, 63 - i, bit);
      }
      
      let left = OpCodes.Hi32(permuted);
      let right = OpCodes.Lo32(permuted);
      
      // 16 rounds
      for (let round = 0; round < 16; round++) {
        const temp = right;
        right = left ^ DEAL._desF(right, OpCodes.Lo32(roundKeys[round]));
        left = temp;
      }
      
      // Swap final halves and apply inverse IP
      const preOutput = OpCodes.LongFromHiLo(right, left);
      let result = OpCodes.LongFromBytes([0, 0, 0, 0, 0, 0, 0, 0]);
      
      // Final permutation (inverse IP)
      const fpTable = [
        40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31,
        38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29,
        36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27,
        34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25
      ];
      
      for (let i = 0; i < 64; i++) {
        const bit = OpCodes.GetBit64(preOutput, 64 - fpTable[i]);
        result = OpCodes.SetBit64(result, 63 - i, bit);
      }
      
      return result;
    },
    
    /**
     * 3DES encryption (EDE mode)
     */
    _3desEncrypt: function(block64, keys) {
      // Encrypt with K1
      let result = DEAL._desEncrypt(block64, keys.k1);
      // Decrypt with K2  
      result = DEAL._desDecrypt(result, keys.k2);
      // Encrypt with K3 (or K1 if only 2 keys)
      result = DEAL._desEncrypt(result, keys.k3 || keys.k1);
      return result;
    },
    
    /**
     * Single DES decryption
     */
    _desDecrypt: function(block64, roundKeys) {
      // Use round keys in reverse order
      const reverseKeys = roundKeys.slice().reverse();
      return DEAL._desEncrypt(block64, reverseKeys);
    },
    
    /**
     * 3DES decryption (DED mode)
     */
    _3desDecrypt: function(block64, keys) {
      // Decrypt with K3 (or K1)
      let result = DEAL._desDecrypt(block64, keys.k3 || keys.k1);
      // Encrypt with K2
      result = DEAL._desEncrypt(result, keys.k2);
      // Decrypt with K1
      result = DEAL._desDecrypt(result, keys.k1);
      return result;
    },
    
    /**
     * Set up the key schedule for DEAL
     */
    KeySetup: function(key) {
      if (!DEAL.isInitialized) {
        DEAL.Init();
      }
      
      // Generate unique ID
      let id = 'DEAL[' + global.generateUniqueID() + ']';
      while (DEAL.instances[id]) {
        id = 'DEAL[' + global.generateUniqueID() + ']';
      }
      
      // Convert key to bytes
      const keyBytes = OpCodes.StringToBytes(key);
      const keyLen = keyBytes.length;
      
      // DEAL supports 128-bit (16 bytes) and 192-bit (24 bytes) keys
      let paddedKey;
      if (keyLen <= 16) {
        // 128-bit key mode - 6 rounds
        paddedKey = new Array(16);
        for (let i = 0; i < 16; i++) {
          paddedKey[i] = i < keyLen ? keyBytes[i] : 0;
        }
      } else {
        // 192-bit key mode - 8 rounds  
        paddedKey = new Array(24);
        for (let i = 0; i < 24; i++) {
          paddedKey[i] = i < keyLen ? keyBytes[i] : 0;
        }
      }
      
      // Convert to 64-bit keys for 3DES
      const key1 = OpCodes.LongFromBytes(paddedKey.slice(0, 8));
      const key2 = OpCodes.LongFromBytes(paddedKey.slice(8, 16));
      const key3 = paddedKey.length > 16 ? OpCodes.LongFromBytes(paddedKey.slice(16, 24)) : null;
      
      // Generate 3DES key schedules
      const roundKeys = {
        k1: DEAL._desKeySchedule(key1),
        k2: DEAL._desKeySchedule(key2),
        k3: key3 ? DEAL._desKeySchedule(key3) : null
      };
      
      // Store instance
      DEAL.instances[id] = {
        roundKeys: roundKeys,
        numRounds: paddedKey.length > 16 ? 8 : 6
      };
      
      return id;
    },
    
    /**
     * Encrypt a 16-byte block with DEAL
     */
    encryptBlock: function(id, block) {
      const instance = DEAL.instances[id];
      if (!instance) {
        throw new Error('Invalid DEAL instance ID');
      }
      
      // Convert block to bytes
      const blockBytes = OpCodes.StringToBytes(block);
      if (blockBytes.length !== 16) {
        throw new Error('DEAL requires 16-byte blocks');
      }
      
      // Split into two 64-bit halves
      let left = OpCodes.LongFromBytes(blockBytes.slice(0, 8));
      let right = OpCodes.LongFromBytes(blockBytes.slice(8, 16));
      
      // DEAL rounds (ladder structure)
      for (let round = 0; round < instance.numRounds; round++) {
        const temp = left;
        
        // Apply 3DES to right half
        const f_output = DEAL._3desEncrypt(right, instance.roundKeys);
        
        // XOR with left half
        left = OpCodes.XorLong(right, f_output);
        right = temp;
      }
      
      // Final swap
      const temp = left;
      left = right;
      right = temp;
      
      // Convert back to bytes
      const leftBytes = OpCodes.LongToBytes(left);
      const rightBytes = OpCodes.LongToBytes(right);
      const result = leftBytes.concat(rightBytes);
      
      return OpCodes.BytesToString(result);
    },
    
    /**
     * Decrypt a 16-byte block with DEAL
     */
    decryptBlock: function(id, block) {
      const instance = DEAL.instances[id];
      if (!instance) {
        throw new Error('Invalid DEAL instance ID');
      }
      
      // Convert block to bytes
      const blockBytes = OpCodes.StringToBytes(block);
      if (blockBytes.length !== 16) {
        throw new Error('DEAL requires 16-byte blocks');
      }
      
      // Split into two 64-bit halves
      let left = OpCodes.LongFromBytes(blockBytes.slice(0, 8));
      let right = OpCodes.LongFromBytes(blockBytes.slice(8, 16));
      
      // Initial swap
      const temp = left;
      left = right;
      right = temp;
      
      // DEAL rounds in reverse (ladder structure)
      for (let round = instance.numRounds - 1; round >= 0; round--) {
        const temp = right;
        
        // Apply 3DES to left half  
        const f_output = DEAL._3desDecrypt(left, instance.roundKeys);
        
        // XOR with right half
        right = OpCodes.XorLong(left, f_output);
        left = temp;
      }
      
      // Convert back to bytes
      const leftBytes = OpCodes.LongToBytes(left);
      const rightBytes = OpCodes.LongToBytes(right);
      const result = leftBytes.concat(rightBytes);
      
      return OpCodes.BytesToString(result);
    },
    
    /**
     * Clear cipher data
     */
    ClearData: function(id) {
      if (DEAL.instances[id]) {
        // Clear sensitive data
        if (DEAL.instances[id].roundKeys) {
          const keys = DEAL.instances[id].roundKeys;
          if (keys.k1) OpCodes.ClearArray(keys.k1);
          if (keys.k2) OpCodes.ClearArray(keys.k2);
          if (keys.k3) OpCodes.ClearArray(keys.k3);
        }
        delete DEAL.instances[id];
        return true;
      }
      return false;
    }
  };
  
  // Test vectors from DEAL specification
  DEAL.TestVectors = [
    {
      key: "0123456789abcdef0011223344556677",
      plaintext: "0123456789abcdef",
      ciphertext: "c94cb6b70ba03584"
    },
    {
      key: "0123456789abcdef0011223344556677",
      plaintext: "fedcba9876543210", 
      ciphertext: "6a293971f792b5dc"
    }
  ];
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(DEAL);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DEAL;
  }
  
  // Export to global scope
  global.DEAL = DEAL;
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);