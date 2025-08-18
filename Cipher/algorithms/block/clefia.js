#!/usr/bin/env node
/*
 * Universal CLEFIA Cipher
 * Compatible with both Browser and Node.js environments  
 * Based on Sony's CLEFIA Specification - RFC 6114
 * (c)2006-2025 Hawkynt
 * 
 * CLEFIA Algorithm by Sony Corporation (2007)
 * Block size: 128 bits, Key size: 128/192/256 bits
 * Uses Generalized Feistel Network with F-functions
 * 
 * NOTE: This is an educational implementation for learning purposes only.
 * Use established cryptographic libraries for production systems.
 * 
 * References:
 * - RFC 6114: The 128-Bit Blockcipher CLEFIA
 * - CLEFIA: A New 128-bit Block Cipher (FSE 2007)
 * - ISO/IEC 29192-2:2012 Lightweight Cryptography
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
      console.error('CLEFIA cipher requires Cipher system to be loaded first');
      return;
    }
  }

  // CLEFIA S-boxes S0 and S1 from RFC 6114
  const S0 = [
    0x57, 0x49, 0xd1, 0xc6, 0x2f, 0x33, 0x74, 0xfb, 0x95, 0x6d, 0x82, 0xea, 0x0e, 0xb0, 0xa8, 0x1c,
    0x28, 0xd0, 0x4b, 0x92, 0x5c, 0xee, 0x85, 0xb1, 0xc4, 0x0a, 0x76, 0x3d, 0x63, 0xf9, 0x17, 0xaf,
    0xbf, 0xa1, 0x19, 0x65, 0xf7, 0x7a, 0x32, 0x20, 0x06, 0xce, 0xe4, 0x83, 0x9d, 0x5b, 0x4c, 0xd8,
    0x42, 0x5d, 0x2e, 0xe8, 0xd4, 0x9b, 0x0f, 0x13, 0x3c, 0x89, 0x67, 0xc0, 0x71, 0xaa, 0xb6, 0xf5,
    0xa4, 0xbe, 0xfd, 0x8c, 0x12, 0x00, 0x97, 0xda, 0x78, 0xe1, 0xcf, 0x6b, 0x39, 0x43, 0x55, 0x26,
    0x30, 0x98, 0xcc, 0xdd, 0xeb, 0x54, 0xb3, 0x8f, 0x4e, 0x16, 0xfa, 0x22, 0xa5, 0x77, 0x09, 0x61,
    0xd6, 0x2a, 0x53, 0x37, 0x45, 0xc1, 0x6c, 0xae, 0xef, 0x70, 0x08, 0x99, 0x8b, 0x1d, 0xf2, 0xb4,
    0xe9, 0xc7, 0x9f, 0x4a, 0x31, 0x25, 0xfe, 0x7c, 0xd3, 0xa2, 0xbd, 0x56, 0x14, 0x88, 0x60, 0x0b,
    0xcd, 0xe2, 0x34, 0x50, 0x9e, 0xdc, 0x11, 0x05, 0x2b, 0xb7, 0xa9, 0x48, 0xff, 0x66, 0x8a, 0x73,
    0x03, 0x75, 0x86, 0xf1, 0x6a, 0xa7, 0x40, 0xc2, 0xb9, 0x2c, 0xdb, 0x1f, 0x58, 0x94, 0x3e, 0xed,
    0xfc, 0x1b, 0xa0, 0x04, 0xb8, 0x8d, 0xe6, 0x59, 0x62, 0x93, 0x35, 0x7e, 0xca, 0x21, 0xdf, 0x47,
    0x15, 0xf3, 0xba, 0x7f, 0xa6, 0x69, 0xc8, 0x4d, 0x87, 0x3b, 0x9c, 0x01, 0xe0, 0xde, 0x24, 0x52,
    0x7b, 0x0c, 0x68, 0x1e, 0x80, 0xb2, 0x5a, 0xe7, 0xad, 0xd5, 0x23, 0xf4, 0x46, 0x3f, 0x91, 0xc9,
    0x6e, 0x84, 0x72, 0xbb, 0x0d, 0x18, 0xd9, 0x96, 0xf0, 0x5f, 0x41, 0xac, 0x27, 0xc5, 0xe3, 0x3a,
    0x81, 0x6f, 0x07, 0xa3, 0x79, 0xf6, 0x2d, 0x38, 0x1a, 0x44, 0x5e, 0xb5, 0xd2, 0xec, 0xcb, 0x90,
    0x9a, 0x36, 0xe5, 0x29, 0xc3, 0x4f, 0xab, 0x64, 0x51, 0xf8, 0x10, 0xd7, 0xbc, 0x02, 0x7d, 0x8e
  ];

  const S1 = [
    0x6c, 0xda, 0xc3, 0xe9, 0x4e, 0x9d, 0x0a, 0x3d, 0xb8, 0x36, 0xb4, 0x38, 0x13, 0x34, 0x0c, 0xd9,
    0xbf, 0x74, 0x94, 0x8f, 0xb7, 0x9c, 0xe5, 0xdc, 0x9e, 0x07, 0x49, 0x4f, 0x98, 0x2c, 0xb0, 0x93,
    0x12, 0xeb, 0xcd, 0xb3, 0x92, 0xe7, 0x41, 0x60, 0xe3, 0x21, 0x27, 0x3b, 0xe6, 0x19, 0xd2, 0x0e,
    0x91, 0x11, 0xc7, 0x3f, 0x2a, 0x8e, 0xa1, 0xbc, 0x2b, 0xc8, 0xc5, 0x0f, 0x5b, 0xf3, 0x87, 0x8b,
    0xfb, 0xf5, 0xde, 0x20, 0xc6, 0xa7, 0x84, 0xce, 0xd8, 0x65, 0x51, 0xc9, 0xa4, 0xef, 0x43, 0x53,
    0x25, 0x5d, 0x9b, 0x31, 0xe8, 0x3e, 0x0d, 0xd7, 0x80, 0xff, 0x69, 0x8a, 0xba, 0x0b, 0x73, 0x5c,
    0x6e, 0x54, 0x15, 0x62, 0xf6, 0x35, 0x30, 0x52, 0xa3, 0x16, 0xd3, 0x28, 0x32, 0xfa, 0xaa, 0x5e,
    0xcf, 0xea, 0xed, 0x78, 0x33, 0x58, 0x09, 0x7b, 0x63, 0xc0, 0xc1, 0x46, 0x1e, 0xdf, 0xa9, 0x99,
    0x55, 0x04, 0xc4, 0x86, 0x39, 0x77, 0x82, 0xec, 0x40, 0x18, 0x90, 0x97, 0x59, 0xdd, 0x83, 0x1f,
    0x9a, 0x37, 0x06, 0x24, 0x64, 0x7c, 0xa5, 0x56, 0x48, 0x08, 0x85, 0xd0, 0x61, 0x26, 0xca, 0x6f,
    0x7e, 0x6a, 0xb6, 0x71, 0xa0, 0x70, 0x05, 0xd1, 0x45, 0x8c, 0x23, 0x1c, 0xf0, 0xee, 0x89, 0xad,
    0x7a, 0x4b, 0xc2, 0x2f, 0xdb, 0x5a, 0x4d, 0x76, 0x67, 0x17, 0x2d, 0xf4, 0xcb, 0xb1, 0x4a, 0xa8,
    0xb5, 0x22, 0x47, 0x3a, 0xd5, 0x10, 0x4c, 0x72, 0xcc, 0x00, 0xf9, 0xe0, 0xfd, 0xe2, 0xfe, 0xae,
    0xf8, 0x5f, 0xab, 0xf1, 0x1b, 0x42, 0x81, 0xd6, 0xbe, 0x44, 0x29, 0xa6, 0x57, 0xb9, 0xaf, 0xf2,
    0xd4, 0x75, 0x66, 0xbb, 0x68, 0x9f, 0x50, 0x02, 0x01, 0x3c, 0x7f, 0x8d, 0x1a, 0x88, 0xbd, 0xac,
    0xf7, 0xe4, 0x79, 0x96, 0xa2, 0xfc, 0x6d, 0xb2, 0x6b, 0x03, 0xe1, 0x2e, 0x7d, 0x14, 0x95, 0x1d
  ];

  // CLEFIA diffusion matrices M0 and M1 from RFC 6114
  const M0 = [
    [0x01, 0x02, 0x04, 0x06],
    [0x02, 0x01, 0x06, 0x04],
    [0x04, 0x06, 0x01, 0x02],
    [0x06, 0x04, 0x02, 0x01]
  ];

  const M1 = [
    [0x01, 0x08, 0x02, 0x0a],
    [0x08, 0x01, 0x0a, 0x02],
    [0x02, 0x0a, 0x01, 0x08],
    [0x0a, 0x02, 0x08, 0x01]
  ];

  // CLEFIA cipher object
  const CLEFIA = {
    
    // Public interface properties
    internalName: 'CLEFIA',
    name: 'CLEFIA',
    comment: 'Sony CLEFIA cipher - 128-bit blocks, 128/192/256-bit keys',
    minKeyLength: 16,
    maxKeyLength: 32,
    stepKeyLength: 8,
    minBlockSize: 16,
    maxBlockSize: 16,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,

    // Initialize cipher
    Init: function() {
      CLEFIA.isInitialized = true;
    },

    // Set up key
    KeySetup: function(key) {
      // Validate key length (16, 24, or 32 bytes)
      if (!key || (key.length !== 16 && key.length !== 24 && key.length !== 32)) {
        global.throwException('Invalid Key Length Exception', key ? key.length : 0, 'CLEFIA', 'KeySetup');
        return null;
      }
      
      let id;
      do {
        id = 'CLEFIA[' + global.generateUniqueID() + ']';
      } while (CLEFIA.instances[id] || global.objectInstances[id]);
      
      CLEFIA.instances[szID] = new CLEFIA.Instance(key);
      global.objectInstances[szID] = true;
      return szID;
    },

    // Clear cipher data
    ClearData: function(id) {
      if (CLEFIA.instances[id]) {
        // Secure cleanup
        const instance = CLEFIA.instances[szID];
        if (instance.roundKeys) {
          global.OpCodes && global.OpCodes.ClearArray && global.OpCodes.ClearArray(instance.roundKeys);
        }
        if (instance.whiteningKeys) {
          global.OpCodes && global.OpCodes.ClearArray && global.OpCodes.ClearArray(instance.whiteningKeys);
        }
        delete CLEFIA.instances[szID];
        delete global.objectInstances[szID];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'CLEFIA', 'ClearData');
        return false;
      }
    },

    // Galois Field multiplication for diffusion matrix
    gfMul: function(a, b) {
      let result = 0;
      for (let i = 0; i < 8; i++) {
        if (b & 1) {
          result ^= a;
        }
        const msb = a & 0x80;
        a <<= 1;
        if (msb) {
          a ^= 0x87; // Irreducible polynomial for AES
        }
        b >>>= 1;
      }
      return result & 0xFF;
    },

    // F-function F0 using S0 and M0
    F0: function(input, rk) {
      const y = [];
      // XOR with round key
      for (let i = 0; i < 4; i++) {
        y[i] = input[i] ^ rk[i];
      }
      
      // S-box substitution using S0
      for (let i = 0; i < 4; i++) {
        y[i] = S0[y[i]];
      }
      
      // Diffusion using M0
      const output = [];
      for (let i = 0; i < 4; i++) {
        output[i] = 0;
        for (let j = 0; j < 4; j++) {
          output[i] ^= CLEFIA.gfMul(M0[i][j], y[j]);
        }
      }
      
      return output;
    },

    // F-function F1 using S1 and M1
    F1: function(input, rk) {
      const y = [];
      // XOR with round key
      for (let i = 0; i < 4; i++) {
        y[i] = input[i] ^ rk[i];
      }
      
      // S-box substitution using S1
      for (let i = 0; i < 4; i++) {
        y[i] = S1[y[i]];
      }
      
      // Diffusion using M1
      const output = [];
      for (let i = 0; i < 4; i++) {
        output[i] = 0;
        for (let j = 0; j < 4; j++) {
          output[i] ^= CLEFIA.gfMul(M1[i][j], y[j]);
        }
      }
      
      return output;
    },

    // Encrypt block
    encryptBlock: function(id, szPlainText) {
      if (!CLEFIA.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'CLEFIA', 'encryptBlock');
        return szPlainText;
      }

      const instance = CLEFIA.instances[szID];
      
      // Convert input to bytes
      const plainBytes = global.OpCodes.StringToBytes(szPlainText);
      
      // Process complete 16-byte blocks
      let result = '';
      for (let i = 0; i < plainBytes.length; i += 16) {
        const block = plainBytes.slice(i, i + 16);
        
        // Pad incomplete blocks with PKCS#7
        if (block.length < 16) {
          const padded = global.OpCodes.PKCS7Padding(16, block.length);
          for (let j = block.length; j < 16; j++) {
            block[j] = padded[j - block.length];
          }
        }
        
        const encrypted = CLEFIA.encryptBlock(block, instance);
        result += global.OpCodes.BytesToString(encrypted);
      }
      
      return result;
    },

    // Decrypt block
    decryptBlock: function(id, szCipherText) {
      if (!CLEFIA.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'CLEFIA', 'decryptBlock');
        return szCipherText;
      }

      const instance = CLEFIA.instances[szID];
      
      // Convert input to bytes
      const cipherBytes = global.OpCodes.StringToBytes(szCipherText);
      
      if (cipherBytes.length % 16 !== 0) {
        global.throwException('Invalid cipher text length for CLEFIA', szCipherText.length, 'CLEFIA', 'decryptBlock');
        return szCipherText;
      }
      
      // Process 16-byte blocks
      let result = '';
      for (let i = 0; i < cipherBytes.length; i += 16) {
        const block = cipherBytes.slice(i, i + 16);
        const decrypted = CLEFIA.decryptBlock(block, instance);
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

    // Encrypt 16-byte block
    encryptBlock: function(block, instance) {
      // Split block into four 32-bit words
      let P = [];
      for (let i = 0; i < 4; i++) {
        P[i] = [];
        for (let j = 0; j < 4; j++) {
          P[i][j] = block[i * 4 + j];
        }
      }
      
      // Pre-whitening
      for (let i = 0; i < 4; i++) {
        P[0][i] ^= instance.whiteningKeys[0][i];
        P[1][i] ^= instance.whiteningKeys[1][i];
      }
      
      // Main rounds
      for (let round = 0; round < instance.rounds; round++) {
        const T0 = CLEFIA.F0(P[1], instance.roundKeys[round * 2]);
        const T1 = CLEFIA.F1(P[3], instance.roundKeys[round * 2 + 1]);
        
        // XOR results
        for (let i = 0; i < 4; i++) {
          P[0][i] ^= T0[i];
          P[2][i] ^= T1[i];
        }
        
        // Rotate state
        const temp = P[0];
        P[0] = P[1];
        P[1] = P[2];
        P[2] = P[3];
        P[3] = temp;
      }
      
      // Post-whitening
      for (let i = 0; i < 4; i++) {
        P[0][i] ^= instance.whiteningKeys[2][i];
        P[1][i] ^= instance.whiteningKeys[3][i];
      }
      
      // Flatten to byte array
      const result = [];
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          result[i * 4 + j] = P[i][j];
        }
      }
      
      return result;
    },

    // Decrypt 16-byte block
    decryptBlock: function(block, instance) {
      // Split block into four 32-bit words
      let C = [];
      for (let i = 0; i < 4; i++) {
        C[i] = [];
        for (let j = 0; j < 4; j++) {
          C[i][j] = block[i * 4 + j];
        }
      }
      
      // Pre-whitening (inverse)
      for (let i = 0; i < 4; i++) {
        C[0][i] ^= instance.whiteningKeys[2][i];
        C[1][i] ^= instance.whiteningKeys[3][i];
      }
      
      // Main rounds (inverse)
      for (let round = instance.rounds - 1; round >= 0; round--) {
        // Inverse rotate state
        const temp = C[3];
        C[3] = C[2];
        C[2] = C[1];
        C[1] = C[0];
        C[0] = temp;
        
        const T0 = CLEFIA.F0(C[1], instance.roundKeys[round * 2]);
        const T1 = CLEFIA.F1(C[3], instance.roundKeys[round * 2 + 1]);
        
        // XOR results
        for (let i = 0; i < 4; i++) {
          C[0][i] ^= T0[i];
          C[2][i] ^= T1[i];
        }
      }
      
      // Post-whitening (inverse)
      for (let i = 0; i < 4; i++) {
        C[0][i] ^= instance.whiteningKeys[0][i];
        C[1][i] ^= instance.whiteningKeys[1][i];
      }
      
      // Flatten to byte array
      const result = [];
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          result[i * 4 + j] = C[i][j];
        }
      }
      
      return result;
    },

    // Instance class
    Instance: function(key) {
      this.keyBytes = global.OpCodes.StringToBytes(key);
      this.keyLength = szKey.length;
      
      // Determine number of rounds based on key length
      if (this.keyLength === 16) {
        this.rounds = 18;
      } else if (this.keyLength === 24) {
        this.rounds = 22;
      } else if (this.keyLength === 32) {
        this.rounds = 26;
      }
      
      // Generate round keys and whitening keys
      this.generateKeys();
    }
  };

  // Add key generation method to Instance prototype
  CLEFIA.Instance.prototype.generateKeys = function() {
    // Simplified key schedule - in real implementation, this would follow RFC 6114 exactly
    this.roundKeys = [];
    this.whiteningKeys = [];
    
    // Initialize whitening keys
    for (let i = 0; i < 4; i++) {
      this.whiteningKeys[i] = [];
      for (let j = 0; j < 4; j++) {
        this.whiteningKeys[i][j] = this.keyBytes[(i * 4 + j) % this.keyLength];
      }
    }
    
    // Generate round keys (simplified - real implementation uses complex key schedule)
    for (let round = 0; round < this.rounds * 2; round++) {
      this.roundKeys[round] = [];
      for (let i = 0; i < 4; i++) {
        this.roundKeys[round][i] = this.keyBytes[(round * 4 + i) % this.keyLength] ^ round;
      }
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(CLEFIA);
  }
  
  // Export to global scope
  global.CLEFIA = CLEFIA;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CLEFIA;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);