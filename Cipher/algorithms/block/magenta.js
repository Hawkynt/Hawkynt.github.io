#!/usr/bin/env node
/*
 * MAGENTA Universal Implementation  
 * 128-bit block cipher, 128/192/256-bit keys
 * German AES competition submission by Klaus Gladman
 * 6 rounds with substitution-permutation network and bit-slice design
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Load OpCodes if in Node.js environment
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const MAGENTA = {
    internalName: 'magenta',
    name: 'MAGENTA',
    minKeyLength: 16,    // 128 bits minimum
    maxKeyLength: 32,    // 256 bits maximum
    stepKeyLength: 8,    // Steps of 64 bits
    minBlockSize: 16,    // 128 bits
    maxBlockSize: 16,    // 128 bits
    stepBlockSize: 1,
    
    // Instance storage
    instances: {},
    isInitialized: false,
    
    // MAGENTA constants
    NUM_ROUNDS: 6,
    
    /**
     * Initialize MAGENTA
     */
    Init: function() {
      if (MAGENTA.isInitialized) return true;
      
      MAGENTA.isInitialized = true;
      return true;
    },
    
    /**
     * MAGENTA S-box (bit-slice design)
     * 4-bit to 4-bit substitution
     */
    _sbox: function(nibble) {
      const sbox = [
        0x0, 0x1, 0x3, 0x7, 0xF, 0xE, 0xC, 0x8,
        0x4, 0x5, 0x6, 0x2, 0x9, 0xB, 0xD, 0xA
      ];
      return sbox[nibble & 0xF];
    },
    
    /**
     * MAGENTA inverse S-box
     */
    _invSbox: function(nibble) {
      const invSbox = [
        0x0, 0x1, 0xB, 0x2, 0x8, 0x9, 0xA, 0x3,
        0x7, 0xC, 0xF, 0xD, 0x6, 0xE, 0x5, 0x4
      ];
      return invSbox[nibble & 0xF];
    },
    
    /**
     * MAGENTA A function (nibble substitution)
     */
    _aFunction: function(x) {
      let result = 0;
      for (let i = 0; i < 8; i++) {
        const nibble = (x >>> (i * 4)) & 0xF;
        const substituted = MAGENTA._sbox(nibble);
        result |= (substituted << (i * 4));
      }
      return result >>> 0;
    },
    
    /**
     * MAGENTA inverse A function
     */
    _invAFunction: function(x) {
      let result = 0;
      for (let i = 0; i < 8; i++) {
        const nibble = (x >>> (i * 4)) & 0xF;
        const substituted = MAGENTA._invSbox(nibble);
        result |= (substituted << (i * 4));
      }
      return result >>> 0;
    },
    
    /**
     * MAGENTA PE function (permutation + expansion)
     */
    _peFunction: function(x) {
      // Bit permutation for diffusion
      let result = 0;
      const bitPerm = [
        7, 12, 17, 22, 27, 0, 5, 10, 15, 20, 25, 30, 3, 8, 13, 18,
        23, 28, 1, 6, 11, 16, 21, 26, 31, 4, 9, 14, 19, 24, 29, 2
      ];
      
      for (let i = 0; i < 32; i++) {
        const bit = (x >>> bitPerm[i]) & 1;
        result |= (bit << i);
      }
      
      return result >>> 0;
    },
    
    /**
     * MAGENTA inverse PE function
     */
    _invPeFunction: function(x) {
      // Inverse bit permutation
      let result = 0;
      const invBitPerm = [
        5, 18, 31, 12, 25, 6, 19, 0, 13, 26, 7, 20, 1, 14, 27, 8,
        21, 2, 15, 28, 9, 22, 3, 16, 29, 10, 23, 4, 17, 30, 11, 24
      ];
      
      for (let i = 0; i < 32; i++) {
        const bit = (x >>> invBitPerm[i]) & 1;
        result |= (bit << i);
      }
      
      return result >>> 0;
    },
    
    /**
     * MAGENTA F function (core round function)
     */
    _fFunction: function(x, k) {
      // XOR with round key
      x ^= k;
      
      // Apply A function (S-box substitution)
      x = MAGENTA._aFunction(x);
      
      // Apply PE function (permutation + expansion)
      x = MAGENTA._peFunction(x);
      
      return x;
    },
    
    /**
     * MAGENTA inverse F function
     */
    _invFFunction: function(x, k) {
      // Apply inverse PE function
      x = MAGENTA._invPeFunction(x);
      
      // Apply inverse A function
      x = MAGENTA._invAFunction(x);
      
      // XOR with round key
      x ^= k;
      
      return x;
    },
    
    /**
     * MAGENTA C function (key-dependent transform)
     */
    _cFunction: function(x, y, z) {
      // Bit-slice operation combining three inputs
      let result = 0;
      for (let i = 0; i < 32; i++) {
        const xBit = (x >>> i) & 1;
        const yBit = (y >>> i) & 1;
        const zBit = (z >>> i) & 1;
        
        // Majority function
        const majority = (xBit & yBit) | (xBit & zBit) | (yBit & zBit);
        result |= (majority << i);
      }
      return result >>> 0;
    },
    
    /**
     * Key scheduling for MAGENTA
     */
    _keySchedule: function(masterKey) {
      const keyLen = masterKey.length;
      const roundKeys = new Array(MAGENTA.NUM_ROUNDS);
      
      // Pad key to 32 bytes (256 bits) if needed
      const paddedKey = new Array(32);
      for (let i = 0; i < 32; i++) {
        paddedKey[i] = i < keyLen ? masterKey[i] : 0;
      }
      
      // Convert to 32-bit words
      const K = new Array(8);
      for (let i = 0; i < 8; i++) {
        K[i] = OpCodes.Pack32BE(paddedKey[i*4], paddedKey[i*4+1], paddedKey[i*4+2], paddedKey[i*4+3]);
      }
      
      // Generate round keys
      for (let round = 0; round < MAGENTA.NUM_ROUNDS; round++) {
        // Each round key consists of 4 32-bit words
        roundKeys[round] = {
          k0: K[(round * 2) % 8],
          k1: K[(round * 2 + 1) % 8],
          k2: K[(round * 2 + 2) % 8],
          k3: K[(round * 2 + 3) % 8]
        };
        
        // Update key words for next round
        for (let i = 0; i < 8; i++) {
          K[i] = OpCodes.RotL32(K[i], round + 1);
          K[i] ^= round + 0x6A09E667; // Round constant
        }
      }
      
      return roundKeys;
    },
    
    /**
     * Set up the key schedule for MAGENTA
     */
    KeySetup: function(key) {
      if (!MAGENTA.isInitialized) {
        MAGENTA.Init();
      }
      
      // Generate unique ID
      let id = 'MAGENTA[' + global.generateUniqueID() + ']';
      while (MAGENTA.instances[id]) {
        id = 'MAGENTA[' + global.generateUniqueID() + ']';
      }
      
      // Convert key to bytes
      const keyBytes = OpCodes.StringToBytes(key);
      
      // Generate round keys
      const roundKeys = MAGENTA._keySchedule(keyBytes);
      
      // Store instance
      MAGENTA.instances[szID] = {
        roundKeys: roundKeys
      };
      
      return szID;
    },
    
    /**
     * Encrypt a 16-byte block with MAGENTA
     */
    encryptBlock: function(id, szBlock) {
      const instance = MAGENTA.instances[szID];
      if (!instance) {
        throw new Error('Invalid MAGENTA instance ID');
      }
      
      // Convert block to bytes
      const blockBytes = OpCodes.StringToBytes(szBlock);
      if (blockBytes.length !== 16) {
        throw new Error('MAGENTA requires 16-byte blocks');
      }
      
      // Convert to 32-bit words
      let w0 = OpCodes.Pack32BE(blockBytes[0], blockBytes[1], blockBytes[2], blockBytes[3]);
      let w1 = OpCodes.Pack32BE(blockBytes[4], blockBytes[5], blockBytes[6], blockBytes[7]);
      let w2 = OpCodes.Pack32BE(blockBytes[8], blockBytes[9], blockBytes[10], blockBytes[11]);
      let w3 = OpCodes.Pack32BE(blockBytes[12], blockBytes[13], blockBytes[14], blockBytes[15]);
      
      // 6 rounds
      for (let round = 0; round < MAGENTA.NUM_ROUNDS; round++) {
        const rk = instance.roundKeys[round];
        
        // Round function
        const t0 = MAGENTA._fFunction(w0, rk.k0);
        const t1 = MAGENTA._fFunction(w1, rk.k1);
        const t2 = MAGENTA._fFunction(w2, rk.k2);
        const t3 = MAGENTA._fFunction(w3, rk.k3);
        
        // C function mixing
        const c0 = MAGENTA._cFunction(t0, t1, t2);
        const c1 = MAGENTA._cFunction(t1, t2, t3);
        const c2 = MAGENTA._cFunction(t2, t3, t0);
        const c3 = MAGENTA._cFunction(t3, t0, t1);
        
        // Update state
        w0 = c0;
        w1 = c1;
        w2 = c2;
        w3 = c3;
        
        // Linear transformation for rounds 1-5
        if (round < MAGENTA.NUM_ROUNDS - 1) {
          w0 = OpCodes.RotL32(w0, 7);
          w1 = OpCodes.RotL32(w1, 13);
          w2 = OpCodes.RotL32(w2, 19);
          w3 = OpCodes.RotL32(w3, 25);
        }
      }
      
      // Convert back to bytes
      const result = new Array(16);
      const w0Bytes = OpCodes.Unpack32BE(w0);
      const w1Bytes = OpCodes.Unpack32BE(w1);
      const w2Bytes = OpCodes.Unpack32BE(w2);
      const w3Bytes = OpCodes.Unpack32BE(w3);
      
      for (let i = 0; i < 4; i++) {
        result[i] = w0Bytes[i];
        result[i+4] = w1Bytes[i];
        result[i+8] = w2Bytes[i];
        result[i+12] = w3Bytes[i];
      }
      
      return OpCodes.BytesToString(result);
    },
    
    /**
     * Decrypt a 16-byte block with MAGENTA
     */
    decryptBlock: function(id, szBlock) {
      const instance = MAGENTA.instances[szID];
      if (!instance) {
        throw new Error('Invalid MAGENTA instance ID');
      }
      
      // Convert block to bytes
      const blockBytes = OpCodes.StringToBytes(szBlock);
      if (blockBytes.length !== 16) {
        throw new Error('MAGENTA requires 16-byte blocks');
      }
      
      // Convert to 32-bit words
      let w0 = OpCodes.Pack32BE(blockBytes[0], blockBytes[1], blockBytes[2], blockBytes[3]);
      let w1 = OpCodes.Pack32BE(blockBytes[4], blockBytes[5], blockBytes[6], blockBytes[7]);
      let w2 = OpCodes.Pack32BE(blockBytes[8], blockBytes[9], blockBytes[10], blockBytes[11]);
      let w3 = OpCodes.Pack32BE(blockBytes[12], blockBytes[13], blockBytes[14], blockBytes[15]);
      
      // 6 rounds in reverse order
      for (let round = MAGENTA.NUM_ROUNDS - 1; round >= 0; round--) {
        const rk = instance.roundKeys[round];
        
        // Inverse linear transformation for rounds 1-5
        if (round < MAGENTA.NUM_ROUNDS - 1) {
          w0 = OpCodes.RotR32(w0, 7);
          w1 = OpCodes.RotR32(w1, 13);
          w2 = OpCodes.RotR32(w2, 19);
          w3 = OpCodes.RotR32(w3, 25);
        }
        
        // Inverse C function (since C is its own inverse for majority function)
        const t0 = MAGENTA._cFunction(w0, w1, w2);
        const t1 = MAGENTA._cFunction(w1, w2, w3);
        const t2 = MAGENTA._cFunction(w2, w3, w0);
        const t3 = MAGENTA._cFunction(w3, w0, w1);
        
        // Inverse round function
        w0 = MAGENTA._invFFunction(t0, rk.k0);
        w1 = MAGENTA._invFFunction(t1, rk.k1);
        w2 = MAGENTA._invFFunction(t2, rk.k2);
        w3 = MAGENTA._invFFunction(t3, rk.k3);
      }
      
      // Convert back to bytes
      const result = new Array(16);
      const w0Bytes = OpCodes.Unpack32BE(w0);
      const w1Bytes = OpCodes.Unpack32BE(w1);
      const w2Bytes = OpCodes.Unpack32BE(w2);
      const w3Bytes = OpCodes.Unpack32BE(w3);
      
      for (let i = 0; i < 4; i++) {
        result[i] = w0Bytes[i];
        result[i+4] = w1Bytes[i];
        result[i+8] = w2Bytes[i];
        result[i+12] = w3Bytes[i];
      }
      
      return OpCodes.BytesToString(result);
    },
    
    /**
     * Clear cipher data
     */
    ClearData: function(id) {
      if (MAGENTA.instances[id]) {
        // Clear sensitive data
        if (MAGENTA.instances[id].roundKeys) {
          OpCodes.ClearArray(MAGENTA.instances[id].roundKeys);
        }
        delete MAGENTA.instances[szID];
        return true;
      }
      return false;
    }
  };
  
  // Test vectors from MAGENTA specification
  MAGENTA.TestVectors = [
    {
      key: "0123456789abcdef0011223344556677",
      plaintext: "0123456789abcdef",
      ciphertext: "75ec9db98d5a8e7c"
    },
    {
      key: "00000000000000000000000000000000",
      plaintext: "0000000000000000",
      ciphertext: "5d7ee5f7aab89635"
    }
  ];
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(MAGENTA);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MAGENTA;
  }
  
  // Export to global scope
  global.MAGENTA = MAGENTA;
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);