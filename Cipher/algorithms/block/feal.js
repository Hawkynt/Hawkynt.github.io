#!/usr/bin/env node
/*
 * Universal FEAL Cipher
 * Compatible with both Browser and Node.js environments
 * Based on NTT's FEAL-8 specification (Fast data Encipherment Algorithm)
 * (c)2006-2025 Hawkynt
 * 
 * FEAL Algorithm by NTT (Akihiro Shimizu and Shoji Miyaguchi, 1987)
 * Block size: 64 bits, Key size: 64 bits, Rounds: 8
 * Uses Feistel network with fast software implementation
 * 
 * NOTE: This is an educational implementation for learning purposes only.
 * FEAL is considered cryptographically broken and should not be used for security.
 * 
 * References:
 * - Shimizu, A. and Miyaguchi, S. "Fast data encipherment algorithm FEAL" (EUROCRYPT 1987)
 * - FEAL-8 specification with 8 rounds for improved security
 * - Differential cryptanalysis by Biham and Shamir showed weaknesses
 */

(function(global) {
  'use strict';
  
  // Load OpCodes for common operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  // Ensure environment dependencies are available
  if (!global.Cipher) {
    if (typeof require !== 'undefined') {
      try {
        require('../../universal-cipher-env.js');
        require('../../cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('FEAL cipher requires Cipher system to be loaded first');
      return;
    }
  }

  // FEAL cipher object
  const FEAL = {
    
    // Public interface properties
    internalName: 'FEAL',
    name: 'FEAL-8',
    comment: 'NTT FEAL-8 cipher - 64-bit blocks, 64-bit key, 8 rounds',
    minKeyLength: 8,
    maxKeyLength: 8,
    stepKeyLength: 1,
    minBlockSize: 8,
    maxBlockSize: 8,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,

    // Initialize cipher
    Init: function() {
      FEAL.isInitialized = true;
    },

    // Set up key
    KeySetup: function(key) {
      // Validate key length (8 bytes for FEAL-8)
      if (!key || key.length !== 8) {
        global.throwException('Invalid Key Length Exception', key ? key.length : 0, 'FEAL', 'KeySetup');
        return null;
      }
      
      let id;
      do {
        id = 'FEAL[' + global.generateUniqueID() + ']';
      } while (FEAL.instances[id] || global.objectInstances[id]);
      
      FEAL.instances[id] = new FEAL.Instance(key);
      global.objectInstances[id] = true;
      return id;
    },

    // Clear cipher data
    ClearData: function(id) {
      if (FEAL.instances[id]) {
        // Secure cleanup
        const instance = FEAL.instances[id];
        if (instance.roundKeys) {
          global.OpCodes && global.OpCodes.ClearArray && global.OpCodes.ClearArray(instance.roundKeys);
        }
        delete FEAL.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'FEAL', 'ClearData');
        return false;
      }
    },

    // FEAL S-box function (addition modulo 256 with rotation)
    S0: function(a, b) {
      return global.OpCodes.RotL8((a + b) & 0xFF, 2);
    },

    S1: function(a, b) {
      return global.OpCodes.RotL8((a + b + 1) & 0xFF, 2);
    },

    // FEAL F-function
    F: function(data, key) {
      // Split 32-bit data into bytes
      const d = global.OpCodes.Unpack32BE(data);
      const k = global.OpCodes.Unpack32BE(key);
      
      // Apply S-boxes
      const t0 = d[1] ^ d[0];
      const t1 = d[2] ^ d[3];
      const f1 = FEAL.S1(t0 ^ k[0], t1 ^ k[1]);
      const f2 = FEAL.S0(f1 ^ t0, t1 ^ k[2]);
      const f3 = FEAL.S1(f2 ^ t1, f1 ^ k[3]);
      const f4 = FEAL.S0(f3 ^ f1, f2);
      
      // Pack result
      return global.OpCodes.Pack32BE(f4, f3, f2, f1);
    },

    // Generate round keys
    generateRoundKeys: function(key) {
      const roundKeys = [];
      const keyBytes = global.OpCodes.StringToBytes(key);
      
      // Split key into two 32-bit halves
      let KL = global.OpCodes.Pack32BE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3]);
      let KR = global.OpCodes.Pack32BE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]);
      
      // Generate 16 round keys for FEAL-8
      for (let i = 0; i < 16; i++) {
        if (i % 2 === 0) {
          roundKeys[i] = KL;
          KL = global.OpCodes.RotL32(KL, 1);
        } else {
          roundKeys[i] = KR;
          KR = global.OpCodes.RotL32(KR, 1);
        }
      }
      
      return roundKeys;
    },

    // Encrypt block
    encryptBlock: function(id, plaintext) {
      if (!FEAL.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'FEAL', 'encryptBlock');
        return plaintext;
      }

      const instance = FEAL.instances[id];
      
      // Convert input to bytes
      const plainBytes = global.OpCodes.StringToBytes(plaintext);
      
      // Process complete 8-byte blocks
      let result = '';
      for (let i = 0; i < plainBytes.length; i += 8) {
        const block = plainBytes.slice(i, i + 8);
        
        // Pad incomplete blocks with PKCS#7
        if (block.length < 8) {
          const padded = global.OpCodes.PKCS7Padding(8, block.length);
          for (let j = block.length; j < 8; j++) {
            block[j] = padded[j - block.length];
          }
        }
        
        const encrypted = FEAL.encryptBlock(block, instance.roundKeys);
        result += global.OpCodes.BytesToString(encrypted);
      }
      
      return result;
    },

    // Decrypt block
    decryptBlock: function(id, ciphertext) {
      if (!FEAL.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'FEAL', 'decryptBlock');
        return ciphertext;
      }

      const instance = FEAL.instances[id];
      
      // Convert input to bytes
      const cipherBytes = global.OpCodes.StringToBytes(ciphertext);
      
      if (cipherBytes.length % 8 !== 0) {
        global.throwException('Invalid cipher text length for FEAL', ciphertext.length, 'FEAL', 'decryptBlock');
        return ciphertext;
      }
      
      // Process 8-byte blocks
      let result = '';
      for (let i = 0; i < cipherBytes.length; i += 8) {
        const block = cipherBytes.slice(i, i + 8);
        const decrypted = FEAL.decryptBlock(block, instance.roundKeys);
        result += global.OpCodes.BytesToString(decrypted);
      }
      
      // Remove PKCS#7 padding
      try {
        const resultBytes = global.OpCodes.StringToBytes(result);
        const unpadded = global.OpCodes.RemovePKCS7Padding(resultBytes);
        return global.OpCodes.BytesToString(unpadded);
      } catch (e) {
        // If padding removal fails, return raw result
        return result;
      }
    },

    // Encrypt 8-byte block
    encryptBlock: function(block, roundKeys) {
      // Split block into two 32-bit halves (big-endian)
      let left = global.OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      let right = global.OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
      
      // 8 rounds of Feistel encryption
      for (let round = 0; round < 8; round++) {
        const temp = left;
        left = right;
        right = temp ^ FEAL.F(right, roundKeys[round]);
      }
      
      // Swap halves for final result
      const temp = left;
      left = right;
      right = temp;
      
      // Convert back to bytes (big-endian)
      const leftBytes = global.OpCodes.Unpack32BE(left);
      const rightBytes = global.OpCodes.Unpack32BE(right);
      
      return leftBytes.concat(rightBytes);
    },

    // Decrypt 8-byte block
    decryptBlock: function(block, roundKeys) {
      // Split block into two 32-bit halves (big-endian)
      let left = global.OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      let right = global.OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
      
      // 8 rounds of Feistel decryption (reverse order)
      for (let round = 7; round >= 0; round--) {
        const temp = left;
        left = right;
        right = temp ^ FEAL.F(right, roundKeys[round]);
      }
      
      // Swap halves for final result
      const temp = left;
      left = right;
      right = temp;
      
      // Convert back to bytes (big-endian)
      const leftBytes = global.OpCodes.Unpack32BE(left);
      const rightBytes = global.OpCodes.Unpack32BE(right);
      
      return leftBytes.concat(rightBytes);
    },

    // Instance class
    Instance: function(key) {
      this.key = key;
      this.roundKeys = FEAL.generateRoundKeys(key);
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(FEAL);
  }
  
  // Export to global scope
  global.FEAL = FEAL;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FEAL;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);