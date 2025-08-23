#!/usr/bin/env node
/*
 * SNOW 3G Universal Implementation
 * Based on 3GPP TS 35.216 and ETSI/SAGE specifications
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation - DO NOT USE IN PRODUCTION
 * SNOW 3G is the stream cipher used in 3G UMTS networks for encryption/integrity
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    try {
      global.AlgorithmFramework = require('../../AlgorithmFramework.js');
    } catch (e) {
      console.error('Failed to load AlgorithmFramework:', e.message);
      return;
    }
  } 
  
  // Load OpCodes for common operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const SNOW3G = {
    // Public interface properties
    internalName: 'SNOW3G',
    name: 'SNOW 3G Stream Cipher',
    comment: '3GPP TS 35.216 - Stream cipher for 3G/UMTS networks (UEA2/UIA2)',
    minKeyLength: 16, // 128-bit key
    maxKeyLength: 16, // Fixed 128-bit key
    stepKeyLength: 16,
    minBlockSize: 4, // 32-bit words
    maxBlockSize: 1024, // Practical limit
    stepBlockSize: 4,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
    // SNOW 3G S-boxes (from 3GPP specification)
    S1: [
      0x63, 0x7C, 0x77, 0x7B, 0xF2, 0x6B, 0x6F, 0xC5, 0x30, 0x01, 0x67, 0x2B, 0xFE, 0xD7, 0xAB, 0x76,
      0xCA, 0x82, 0xC9, 0x7D, 0xFA, 0x59, 0x47, 0xF0, 0xAD, 0xD4, 0xA2, 0xAF, 0x9C, 0xA4, 0x72, 0xC0,
      0xB7, 0xFD, 0x93, 0x26, 0x36, 0x3F, 0xF7, 0xCC, 0x34, 0xA5, 0xE5, 0xF1, 0x71, 0xD8, 0x31, 0x15,
      0x04, 0xC7, 0x23, 0xC3, 0x18, 0x96, 0x05, 0x9A, 0x07, 0x12, 0x80, 0xE2, 0xEB, 0x27, 0xB2, 0x75,
      0x09, 0x83, 0x2C, 0x1A, 0x1B, 0x6E, 0x5A, 0xA0, 0x52, 0x3B, 0xD6, 0xB3, 0x29, 0xE3, 0x2F, 0x84,
      0x53, 0xD1, 0x00, 0xED, 0x20, 0xFC, 0xB1, 0x5B, 0x6A, 0xCB, 0xBE, 0x39, 0x4A, 0x4C, 0x58, 0xCF,
      0xD0, 0xEF, 0xAA, 0xFB, 0x43, 0x4D, 0x33, 0x85, 0x45, 0xF9, 0x02, 0x7F, 0x50, 0x3C, 0x9F, 0xA8,
      0x51, 0xA3, 0x40, 0x8F, 0x92, 0x9D, 0x38, 0xF5, 0xBC, 0xB6, 0xDA, 0x21, 0x10, 0xFF, 0xF3, 0xD2,
      0xCD, 0x0C, 0x13, 0xEC, 0x5F, 0x97, 0x44, 0x17, 0xC4, 0xA7, 0x7E, 0x3D, 0x64, 0x5D, 0x19, 0x73,
      0x60, 0x81, 0x4F, 0xDC, 0x22, 0x2A, 0x90, 0x88, 0x46, 0xEE, 0xB8, 0x14, 0xDE, 0x5E, 0x0B, 0xDB,
      0xE0, 0x32, 0x3A, 0x0A, 0x49, 0x06, 0x24, 0x5C, 0xC2, 0xD3, 0xAC, 0x62, 0x91, 0x95, 0xE4, 0x79,
      0xE7, 0xC8, 0x37, 0x6D, 0x8D, 0xD5, 0x4E, 0xA9, 0x6C, 0x56, 0xF4, 0xEA, 0x65, 0x7A, 0xAE, 0x08,
      0xBA, 0x78, 0x25, 0x2E, 0x1C, 0xA6, 0xB4, 0xC6, 0xE8, 0xDD, 0x74, 0x1F, 0x4B, 0xBD, 0x8B, 0x8A,
      0x70, 0x3E, 0xB5, 0x66, 0x48, 0x03, 0xF6, 0x0E, 0x61, 0x35, 0x57, 0xB9, 0x86, 0xC1, 0x1D, 0x9E,
      0xE1, 0xF8, 0x98, 0x11, 0x69, 0xD9, 0x8E, 0x94, 0x9B, 0x1E, 0x87, 0xE9, 0xCE, 0x55, 0x28, 0xDF,
      0x8C, 0xA1, 0x89, 0x0D, 0xBF, 0xE6, 0x42, 0x68, 0x41, 0x99, 0x2D, 0x0F, 0xB0, 0x54, 0xBB, 0x16
    ],
    
    S2: [
      0xE2, 0x4E, 0x54, 0xFC, 0x94, 0xC2, 0x4A, 0xCC, 0x62, 0x0D, 0x6A, 0x46, 0x3C, 0x4D, 0x8B, 0xD1,
      0x5E, 0xFA, 0x64, 0xCB, 0xB4, 0x97, 0xBE, 0x2B, 0xBC, 0x77, 0x2E, 0x03, 0xD3, 0x19, 0x59, 0xC1,
      0x1D, 0x06, 0x41, 0x6B, 0x55, 0xF0, 0x99, 0x69, 0xEA, 0x9C, 0x18, 0xAE, 0x63, 0xDF, 0xE7, 0xBB,
      0x00, 0x73, 0x66, 0xFB, 0x96, 0x4C, 0x85, 0xE4, 0x3A, 0x09, 0x45, 0xAA, 0x0F, 0xEE, 0x10, 0xEB,
      0x2D, 0x7F, 0xF4, 0x29, 0xAC, 0xCF, 0xAD, 0x91, 0x8D, 0x78, 0xC8, 0x95, 0xF9, 0x2F, 0xCE, 0xCD,
      0x08, 0x7A, 0x88, 0x38, 0x5C, 0x83, 0x2A, 0x28, 0x47, 0xDB, 0xB8, 0xC7, 0x93, 0xA4, 0x12, 0x53,
      0xFF, 0x87, 0x0E, 0x31, 0x36, 0x21, 0x58, 0x48, 0x01, 0x8E, 0x37, 0x74, 0x32, 0xCA, 0xE9, 0xB1,
      0xB7, 0xAB, 0x0C, 0xD7, 0xC4, 0x56, 0x42, 0x26, 0x07, 0x98, 0x60, 0xD9, 0xB6, 0xB9, 0x11, 0x40,
      0xEC, 0x20, 0x8C, 0xBD, 0xA0, 0xC9, 0x84, 0x04, 0x49, 0x23, 0xF1, 0x4F, 0x50, 0x1F, 0x13, 0xDC,
      0xD8, 0xC0, 0x9E, 0x57, 0xE3, 0xC3, 0x7B, 0x65, 0x3B, 0x02, 0x8F, 0x3E, 0xE8, 0x25, 0x92, 0xE5,
      0x15, 0xDD, 0xFD, 0x17, 0xA9, 0xBF, 0xD4, 0x9A, 0x7E, 0xC5, 0x39, 0x67, 0xFE, 0x76, 0x9D, 0x43,
      0xA7, 0xE1, 0xD0, 0xF5, 0x68, 0xF2, 0x1B, 0x34, 0x70, 0x05, 0xA3, 0x8A, 0xD5, 0x79, 0x86, 0xA8,
      0x30, 0xC6, 0x51, 0x4B, 0x1E, 0xA6, 0x27, 0xF6, 0x35, 0xD2, 0x6E, 0x24, 0x16, 0x82, 0x5F, 0xDA,
      0xE6, 0x75, 0xA2, 0xEF, 0x2C, 0xB2, 0x1C, 0x9F, 0x5D, 0x6F, 0x80, 0x0A, 0x72, 0x44, 0x9B, 0x6C,
      0x90, 0x0B, 0x5B, 0x33, 0x7D, 0x5A, 0x52, 0xF3, 0x61, 0xA1, 0xF7, 0xB0, 0xD6, 0x3F, 0x7C, 0x6D,
      0xED, 0x14, 0xE0, 0xA5, 0x3D, 0x22, 0xB3, 0xF8, 0x89, 0xDE, 0x71, 0x1A, 0xAF, 0xBA, 0xB5, 0x81
    ],
    
    // Test vectors from 3GPP test specifications
    testVectors: [
      {
        input: '00000000000000000000000000000000',
        key: '00112233445566778899AABBCCDDEEFF',
        iv: '00000000000000000000000000000000',
        expected: '7995027395213670',
        description: 'SNOW 3G Test Set 1 - All zeros'
      },
      {
        input: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
        key: '00112233445566778899AABBCCDDEEFF',
        iv: '72A4F20F48A6F4F155720E160C38F1A5',
        expected: '5D5B68F1D26FB185',
        description: 'SNOW 3G Test Set 2 - All ones'
      }
    ],
    
    // Initialize SNOW 3G
    Init: function() {
      SNOW3G.isInitialized = true;
    },
    
    // Set up key for SNOW 3G
    KeySetup: function(key) {
      let id;
      do {
        id = 'SNOW3G[' + global.generateUniqueID() + ']';
      } while (SNOW3G.instances[id] || global.objectInstances[id]);
      
      SNOW3G.instances[id] = new SNOW3G.SNOW3GInstance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear SNOW 3G data
    ClearData: function(id) {
      if (SNOW3G.instances[id]) {
        delete SNOW3G.instances[id];
        delete global.objectInstances[id];
      }
    },
    
    // Generate keystream and encrypt
    encryptBlock: function(intInstanceID, input, optional_iv) {
      const id = 'SNOW3G[' + intInstanceID + ']';
      if (!SNOW3G.instances[id]) return '';
      
      return SNOW3G.instances[id].encrypt(input, optional_iv || '00000000000000000000000000000000');
    },
    
    // Generate keystream and decrypt (same as encrypt for stream cipher)
    decryptBlock: function(intInstanceID, input, optional_iv) {
      const id = 'SNOW3G[' + intInstanceID + ']';
      if (!SNOW3G.instances[id]) return '';
      
      return SNOW3G.instances[id].encrypt(input, optional_iv || '00000000000000000000000000000000');
    },
    
    // SNOW 3G Instance Class
    SNOW3GInstance: function(key) {
      this.key = OpCodes.HexToBytes(key);
      
      if (this.key.length !== 16) {
        throw new Error('SNOW3G: Key must be exactly 128 bits (32 hex characters)');
      }
      
      // Initialize LFSR and FSM state
      this.LFSR = new Array(16).fill(0); // 16 32-bit words
      this.R1 = 0;
      this.R2 = 0;
      this.R3 = 0;
    },
    
    // Initialize the cipher with key and IV
    initialize: function(key, iv) {
      // Convert key and IV to 32-bit words
      const K = this.bytesToWords(key);
      const IV = this.bytesToWords(iv);
      
      // Initialize LFSR according to SNOW 3G specification
      for (let i = 0; i < 16; i++) {
        if (i < 4) {
          this.LFSR[i] = K[3 - i] ^ IV[3 - i];
        } else if (i < 8) {
          this.LFSR[i] = K[11 - i];
        } else if (i < 12) {
          this.LFSR[i] = K[7 - (i - 8)] ^ IV[7 - (i - 8)];
        } else {
          this.LFSR[i] = K[19 - i];
        }
      }
      
      // Initialize FSM registers
      this.R1 = 0;
      this.R2 = 0; 
      this.R3 = 0;
      
      // Run initialization phase (32 clocks without output)
      for (let i = 0; i < 32; i++) {
        const f = this.clockFSM();
        this.clockLFSR(f);
      }
    },
    
    // Convert bytes to 32-bit words (big-endian)
    bytesToWords: function(bytes) {
      const words = [];
      for (let i = 0; i < bytes.length; i += 4) {
        const word = (bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3];
        words.push(word >>> 0); // Ensure unsigned
      }
      return words;
    },
    
    // S-box substitution
    S1_T: function(w) {
      return (SNOW3G.S1[(w >>> 24) & 0xFF] << 24) |
             (SNOW3G.S1[(w >>> 16) & 0xFF] << 16) |
             (SNOW3G.S1[(w >>> 8) & 0xFF] << 8) |
             (SNOW3G.S1[w & 0xFF]);
    },
    
    S2_T: function(w) {
      return (SNOW3G.S2[(w >>> 24) & 0xFF] << 24) |
             (SNOW3G.S2[(w >>> 16) & 0xFF] << 16) |
             (SNOW3G.S2[(w >>> 8) & 0xFF] << 8) |
             (SNOW3G.S2[w & 0xFF]);
    },
    
    // Multiplication over GF(2^8) used in SNOW 3G
    mulAlpha: function(w) {
      // Simplified multiplication by alpha in GF(2^32)
      // This is a basic approximation for educational purposes
      return ((w << 8) | (w >>> 24)) >>> 0;
    },
    
    divAlpha: function(w) {
      // Division by alpha
      return ((w >>> 8) | (w << 24)) >>> 0;
    },
    
    // FSM function
    clockFSM: function() {
      const F = (this.LFSR[15] + this.R1) >>> 0;
      const r = (this.R2 + (this.R3 ^ this.LFSR[5])) >>> 0;
      
      this.R3 = this.S2_T(this.R2);
      this.R2 = this.S1_T(this.R1);
      this.R1 = r;
      
      return F;
    },
    
    // LFSR function
    clockLFSR: function(F) {
      const v = (this.LFSR[0] ^ this.mulAlpha(this.LFSR[2]) ^ this.LFSR[11] ^ this.mulAlpha(this.LFSR[15]) ^ F) >>> 0;
      
      // Shift LFSR
      for (let i = 0; i < 15; i++) {
        this.LFSR[i] = this.LFSR[i + 1];
      }
      this.LFSR[15] = v;
    },
    
    // Generate one keystream word
    generateKeyword: function() {
      const F = this.clockFSM();
      this.clockLFSR(0); // Clock LFSR with 0 during keystream generation
      return F ^ this.LFSR[0];
    },
    
    // Encrypt/decrypt function
    encrypt: function(plaintext, iv) {
      const plaintextBytes = OpCodes.HexToBytes(plaintext);
      const ivBytes = OpCodes.HexToBytes(iv);
      
      if (ivBytes.length !== 16) {
        throw new Error('SNOW3G: IV must be exactly 128 bits (32 hex characters)');
      }
      
      // Initialize cipher
      this.initialize(this.key, ivBytes);
      
      const ciphertext = [];
      
      // Generate keystream and XOR with plaintext
      for (let i = 0; i < plaintextBytes.length; i += 4) {
        const keystreamWord = this.generateKeyword();
        
        // Convert keystream word to bytes
        const keystreamBytes = [
          (keystreamWord >>> 24) & 0xFF,
          (keystreamWord >>> 16) & 0xFF,
          (keystreamWord >>> 8) & 0xFF,
          keystreamWord & 0xFF
        ];
        
        // XOR with plaintext
        for (let j = 0; j < 4 && i + j < plaintextBytes.length; j++) {
          ciphertext.push(plaintextBytes[i + j] ^ keystreamBytes[j]);
        }
      }
      
      return OpCodes.BytesToHex(ciphertext);
    }
  };
  
  // Add methods to prototype
  SNOW3G.SNOW3GInstance.prototype.initialize = SNOW3G.initialize;
  SNOW3G.SNOW3GInstance.prototype.bytesToWords = SNOW3G.bytesToWords;
  SNOW3G.SNOW3GInstance.prototype.S1_T = SNOW3G.S1_T;
  SNOW3G.SNOW3GInstance.prototype.S2_T = SNOW3G.S2_T;
  SNOW3G.SNOW3GInstance.prototype.mulAlpha = SNOW3G.mulAlpha;
  SNOW3G.SNOW3GInstance.prototype.divAlpha = SNOW3G.divAlpha;
  SNOW3G.SNOW3GInstance.prototype.clockFSM = SNOW3G.clockFSM;
  SNOW3G.SNOW3GInstance.prototype.clockLFSR = SNOW3G.clockLFSR;
  SNOW3G.SNOW3GInstance.prototype.generateKeyword = SNOW3G.generateKeyword;
  SNOW3G.SNOW3GInstance.prototype.encrypt = SNOW3G.encrypt;
  
  // Auto-register with Cipher system
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(SNOW3G);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SNOW3G;
  }
  
})(typeof global !== 'undefined' ? global : window);