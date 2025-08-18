#!/usr/bin/env node
/*
 * ZUC Stream Cipher - Universal Implementation
 * Compatible with both Browser and Node.js environments
 * 
 * Based on 3GPP Confidentiality Algorithm 128-EEA3 & Integrity Algorithm 128-EIA3
 * Core component of LTE/4G mobile communications security
 * 
 * Educational implementation - not for production use
 * Use certified implementations for actual mobile systems
 * 
 * Features:
 * - 128-bit key and IV support
 * - 16-stage 31-bit LFSR
 * - Bit reorganization layer
 * - Nonlinear function with S-boxes
 * - 32-bit word-oriented keystream output
 */

(function(global) {
  'use strict';
  
  // Load OpCodes if in Node.js environment
  if (typeof global !== 'undefined' && global.require && !global.OpCodes) {
    require('../../OpCodes.js');
  }
  
  const ZUC = {
    internalName: 'zuc',
    name: 'ZUC Stream Cipher (3GPP LTE)',
    // Required Cipher interface properties
    minKeyLength: 16,        // Minimum key length in bytes
    maxKeyLength: 32,        // Maximum key length in bytes
    stepKeyLength: 1,       // Key length step size
    minBlockSize: 0,        // Minimum block size in bytes
    maxBlockSize: 0,        // Maximum block size (0 = unlimited)
    stepBlockSize: 1,       // Block size step
    instances: {},          // Instance tracking
    
    // Constants
    MASK31: 0x7FFFFFFF, // 2^31 - 1
    
    // S-boxes for the nonlinear function
    S0: [
      0x3e, 0x72, 0x5b, 0x47, 0xca, 0xe0, 0x00, 0x33, 0x04, 0xd1, 0x54, 0x98, 0x09, 0xb9, 0x6d, 0xcb,
      0x7b, 0x1b, 0xf9, 0x32, 0xaf, 0x9d, 0x6a, 0xa5, 0xb8, 0x2d, 0xfc, 0x1d, 0x08, 0x53, 0x03, 0x90,
      0x4d, 0x4e, 0x84, 0x99, 0xe4, 0xce, 0xd9, 0x91, 0xdd, 0xb6, 0x85, 0x48, 0x8b, 0x29, 0x6e, 0xac,
      0xcd, 0xc1, 0xf8, 0x1e, 0x73, 0x43, 0x69, 0xc6, 0xb5, 0xbd, 0xfd, 0x39, 0x63, 0x20, 0xd4, 0x38,
      0x76, 0x7d, 0xb2, 0xa7, 0xcf, 0xed, 0x57, 0xc5, 0xf3, 0x2c, 0xbb, 0x14, 0x21, 0x06, 0x55, 0x9b,
      0xe3, 0xef, 0x5e, 0x31, 0x4f, 0x7f, 0x5a, 0xa4, 0x0d, 0x82, 0x51, 0x49, 0x5f, 0xba, 0x58, 0x1c,
      0x4a, 0x16, 0xd5, 0x17, 0xa8, 0x92, 0x24, 0x1f, 0x8c, 0xff, 0xd8, 0xae, 0x2e, 0x01, 0xd3, 0xad,
      0x3b, 0x4b, 0xda, 0x46, 0xeb, 0xc9, 0xde, 0x9a, 0x8f, 0x87, 0xd7, 0x3a, 0x80, 0x6f, 0x2f, 0xc8,
      0xb1, 0xb4, 0x37, 0xf7, 0x0a, 0x22, 0x13, 0x28, 0x7c, 0xcc, 0x3c, 0x89, 0xc7, 0xc3, 0x96, 0x56,
      0x07, 0xbf, 0x7e, 0xf0, 0x0b, 0x2b, 0x97, 0x52, 0x35, 0x41, 0x79, 0x61, 0xa6, 0x4c, 0x10, 0xfe,
      0xbc, 0x26, 0x95, 0x88, 0x8a, 0xb0, 0xa3, 0xfb, 0xc0, 0x18, 0x94, 0xf2, 0xe1, 0xe5, 0xe9, 0x5d,
      0xd0, 0xdc, 0x11, 0x66, 0x64, 0x5c, 0xec, 0x59, 0x42, 0x75, 0x12, 0xf5, 0x74, 0x9c, 0xaa, 0x23,
      0x0e, 0x86, 0xab, 0xbe, 0x2a, 0x02, 0xe7, 0x67, 0xe6, 0x44, 0xa2, 0x6c, 0xc2, 0x93, 0x9f, 0xf1,
      0xf6, 0xfa, 0x36, 0xd2, 0x50, 0x68, 0x9e, 0x62, 0x71, 0x15, 0x3d, 0xd6, 0x40, 0xc4, 0xe2, 0x0f,
      0x8e, 0x83, 0x77, 0x6b, 0x25, 0x05, 0x3f, 0x0c, 0x30, 0xea, 0x70, 0xb7, 0xa1, 0xe8, 0xa9, 0x65,
      0x8d, 0x27, 0x1a, 0xdb, 0x81, 0xb3, 0xa0, 0xf4, 0x45, 0x7a, 0x19, 0xdf, 0xee, 0x78, 0x34, 0x60
    ],
    
    S1: [
      0x55, 0xc2, 0x63, 0x71, 0x3b, 0xc8, 0x47, 0x86, 0x9f, 0x3c, 0xda, 0x5b, 0x29, 0xaa, 0xfd, 0x77,
      0x8c, 0xc5, 0x94, 0x0c, 0xa6, 0x1a, 0x13, 0x00, 0xe3, 0xa8, 0x16, 0x72, 0x40, 0xf9, 0xf8, 0x42,
      0x44, 0x26, 0x68, 0x96, 0x81, 0xd9, 0x45, 0x3e, 0x10, 0x76, 0xc6, 0xa7, 0x8b, 0x39, 0x43, 0xe1,
      0x3a, 0xb5, 0x56, 0x2a, 0xc0, 0x6d, 0xb3, 0x05, 0x22, 0x66, 0xbf, 0xdc, 0x0b, 0xfa, 0x62, 0x48,
      0xdd, 0x20, 0x11, 0x06, 0x36, 0xc9, 0xc1, 0xcf, 0xf6, 0x27, 0x52, 0xbb, 0x69, 0xf5, 0xd4, 0x87,
      0x7f, 0x84, 0x4c, 0xd2, 0x9c, 0x57, 0xa4, 0xbc, 0x4f, 0x9a, 0xdf, 0xfe, 0xd6, 0x8d, 0x7a, 0xeb,
      0x2b, 0x53, 0xd8, 0x5c, 0xa1, 0x14, 0x17, 0xfb, 0x23, 0xd5, 0x7d, 0x30, 0x67, 0x73, 0x08, 0x09,
      0xee, 0xb7, 0x70, 0x3f, 0x61, 0xb2, 0x19, 0x8e, 0x4e, 0xe5, 0x4b, 0x93, 0x8f, 0x5d, 0xdb, 0xa9,
      0xad, 0xf1, 0xae, 0x2e, 0xcb, 0x0d, 0xfc, 0xf4, 0x2d, 0x46, 0x6e, 0x1d, 0x97, 0xe8, 0xd1, 0xe9,
      0x4d, 0x37, 0xa5, 0x75, 0x5e, 0x83, 0x9e, 0xab, 0x82, 0x9d, 0xb9, 0x1c, 0xe0, 0xcd, 0x49, 0x89,
      0x01, 0xb6, 0xbd, 0x58, 0x24, 0xa2, 0x5f, 0x38, 0x78, 0x99, 0x15, 0x90, 0x50, 0xb8, 0x95, 0xe4,
      0xd0, 0x91, 0xc7, 0xce, 0xed, 0x0f, 0xb4, 0x6f, 0xa0, 0xcc, 0xf0, 0x02, 0x4a, 0x79, 0xc3, 0xde,
      0xa3, 0xef, 0xea, 0x51, 0xe6, 0x6b, 0x18, 0xec, 0x1b, 0x2c, 0x80, 0xf7, 0x74, 0xe7, 0xff, 0x21,
      0x5a, 0x6a, 0x54, 0x1e, 0x41, 0x31, 0x92, 0x35, 0xc4, 0x33, 0x07, 0x0a, 0xba, 0x7e, 0x0e, 0x34,
      0x88, 0xb1, 0x98, 0x7c, 0xf3, 0x3d, 0x60, 0x6c, 0x7b, 0xca, 0xd3, 0x1f, 0x32, 0x65, 0x04, 0x28,
      0x64, 0xbe, 0x85, 0x9b, 0x2f, 0x59, 0x8a, 0xd7, 0xb0, 0x25, 0xac, 0xaf, 0x12, 0x03, 0xe2, 0xf2
    ],
    
    // D constants for LFSR operations
    D: [
      0x44D7, 0x26BC, 0x626B, 0x135E, 0x5789, 0x35E2, 0x7135, 0x09AF,
      0x4D78, 0x2F13, 0x6BC4, 0x1AF1, 0x5E26, 0x3C4D, 0x789A, 0x47AC
    ],
    
    // LFSR state (16 x 31-bit registers)
    LFSR: null,
    
    // Bit reorganization registers
    X: null,
    
    // Nonlinear function registers
    R1: 0,
    R2: 0,
    
    /**
     * Initialize ZUC with key and IV
     * @param {Array} key - 128-bit key (16 bytes)
     * @param {Array} iv - 128-bit initialization vector (16 bytes)
     */
    Init: function(key, iv) {
      // Initialize LFSR with key and IV
      this.LFSR = new Array(16);
      this.X = new Array(4);
      
      // Use default values if key/iv not provided
      if (!key) {
        key = new Array(16).fill(0);
      }
      if (!iv) {
        iv = new Array(16).fill(0);
      }
      
      // Load key and IV into LFSR
      for (let i = 0; i < 16; i++) {
        this.LFSR[i] = ((key[i] << 23) | (this.D[i] << 8) | iv[i]) & this.MASK31;
      }
      
      this.R1 = 0;
      this.R2 = 0;
      
      // Initialization phase (32 iterations without output)
      for (let i = 0; i < 32; i++) {
        this.BitReorganization();
        const W = this.NonlinearFunction();
        this.LFSRWithInitialization(W >>> 1);
      }
    },
    
    /**
     * LFSR step with initialization feedback
     */
    LFSRWithInitialization: function(u) {
      const f = this.LFSR[0];
      const v = this.MulByPow2(this.LFSR[0], 8);
      
      const s16 = ((this.MulByPow2(this.LFSR[15], 15) + 
                   this.MulByPow2(this.LFSR[13], 17) + 
                   this.MulByPow2(this.LFSR[10], 21) + 
                   this.MulByPow2(this.LFSR[4], 20) + 
                   v + u) % 0x7FFFFFFF) & this.MASK31;
      
      // Shift LFSR
      for (let i = 0; i < 15; i++) {
        this.LFSR[i] = this.LFSR[i + 1];
      }
      this.LFSR[15] = s16;
    },
    
    /**
     * LFSR step without initialization feedback (working mode)
     */
    LFSRWithoutInitialization: function() {
      const v = this.MulByPow2(this.LFSR[0], 8);
      
      const s16 = ((this.MulByPow2(this.LFSR[15], 15) + 
                   this.MulByPow2(this.LFSR[13], 17) + 
                   this.MulByPow2(this.LFSR[10], 21) + 
                   this.MulByPow2(this.LFSR[4], 20) + 
                   v) % 0x7FFFFFFF) & this.MASK31;
      
      // Shift LFSR
      for (let i = 0; i < 15; i++) {
        this.LFSR[i] = this.LFSR[i + 1];
      }
      this.LFSR[15] = s16;
    },
    
    /**
     * Multiplication by 2^k modulo (2^31 - 1)
     */
    MulByPow2: function(x, k) {
      return (((x << k) | (x >>> (31 - k))) & this.MASK31);
    },
    
    /**
     * Bit reorganization
     */
    BitReorganization: function() {
      this.X[0] = ((this.LFSR[15] & 0x7FFF8000) << 1) | (this.LFSR[14] & 0x0000FFFF);
      this.X[1] = ((this.LFSR[11] & 0x0000FFFF) << 16) | (this.LFSR[9] >>> 15);
      this.X[2] = ((this.LFSR[7] & 0x0000FFFF) << 16) | (this.LFSR[5] >>> 15);
      this.X[3] = ((this.LFSR[2] & 0x0000FFFF) << 16) | (this.LFSR[0] >>> 15);
    },
    
    /**
     * S-box lookup (32-bit word composed of 4 bytes)
     */
    Sbox: function(x) {
      return (this.S0[(x >>> 24) & 0xFF] << 24) |
             (this.S1[(x >>> 16) & 0xFF] << 16) |
             (this.S0[(x >>> 8) & 0xFF] << 8) |
             (this.S1[x & 0xFF]);
    },
    
    /**
     * Linear transformation L1
     */
    L1: function(x) {
      return x ^ OpCodes.RotL32(x, 2) ^ OpCodes.RotL32(x, 10) ^ OpCodes.RotL32(x, 18) ^ OpCodes.RotL32(x, 24);
    },
    
    /**
     * Linear transformation L2
     */
    L2: function(x) {
      return x ^ OpCodes.RotL32(x, 8) ^ OpCodes.RotL32(x, 14) ^ OpCodes.RotL32(x, 22) ^ OpCodes.RotL32(x, 30);
    },
    
    /**
     * Nonlinear function F
     */
    NonlinearFunction: function() {
      const W1 = (this.X[0] ^ this.R1) >>> 0;
      const W2 = (this.X[1] ^ this.R2) >>> 0;
      const u = this.L1((W1 << 16) | (W2 >>> 16));
      const v = this.L2((W2 << 16) | (W1 >>> 16));
      
      this.R1 = this.Sbox(this.L1((u + this.X[2]) >>> 0));
      this.R2 = this.Sbox(this.L2((v + this.X[3]) >>> 0));
      
      return (this.X[0] ^ this.R1) >>> 0;
    },
    
    /**
     * Generate keystream word
     */
    GenerateKeystream: function() {
      this.BitReorganization();
      const Z = this.NonlinearFunction();
      this.LFSRWithoutInitialization();
      return Z;
    },
    
    /**
     * Generate keystream of specified length
     * @param {number} length - Number of 32-bit words to generate
     * @returns {Array} Array of 32-bit keystream words
     */
    GenerateKeystreamWords: function(length) {
      const keystream = [];
      for (let i = 0; i < length; i++) {
        keystream.push(this.GenerateKeystream());
      }
      return keystream;
    },
    
    /**
     * Encrypt/Decrypt data using ZUC keystream
     * @param {Array} data - Input data bytes
     * @param {Array} key - 128-bit key
     * @param {Array} iv - 128-bit IV
     * @returns {Array} Encrypted/decrypted data
     */
    Process: function(data, key, iv) {
      // Initialize ZUC
      this.Init(key, iv);
      
      // Generate enough keystream
      const wordsNeeded = Math.ceil(data.length / 4);
      const keystream = this.GenerateKeystreamWords(wordsNeeded);
      
      // Convert keystream to bytes
      const keystreamBytes = [];
      for (let i = 0; i < keystream.length; i++) {
        const word = keystream[i];
        keystreamBytes.push((word >>> 24) & 0xFF);
        keystreamBytes.push((word >>> 16) & 0xFF);
        keystreamBytes.push((word >>> 8) & 0xFF);
        keystreamBytes.push(word & 0xFF);
      }
      
      // XOR with data
      const result = [];
      for (let i = 0; i < data.length; i++) {
        result.push(data[i] ^ keystreamBytes[i]);
      }
      
      return result;
    },
    
    /**
     * Test vectors for validation
     */
    TestVectors: [
      {
        key: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        iv: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        expected: [0x27BEDE74, 0x018082DA],
        description: "Test vector with all zeros"
      },
      {
        key: [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF],
        iv: [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF],
        expected: [0x0657CFA0, 0x7096398B],
        description: "Test vector with all ones"
      }
    ],
    
    // Generate keystream for encryption/decryption
    GenerateKeystream: function(length) {
      const keystream = [];
      const wordsNeeded = Math.ceil(length / 4);
      
      for (let i = 0; i < wordsNeeded; i++) {
        this.BitReorganization();
        const Z = this.NonlinearFunction();
        this.LFSRWithWorkMode();
        keystream.push(Z);
      }
      
      return keystream;
    },
    
    // Required Cipher interface methods
    KeySetup: function(key, options) {
      // Convert string key to byte array
      let keyBytes, ivBytes;
      
      if (typeof key === 'string') {
        if (key.length === 32) {
          // Hex key
          keyBytes = global.OpCodes ? global.OpCodes.HexToBytes(key) : [];
        } else {
          // String key - pad or truncate to 16 bytes
          keyBytes = [];
          for (let i = 0; i < 16; i++) {
            keyBytes[i] = i < key.length ? key.charCodeAt(i) : 0;
          }
        }
      } else {
        keyBytes = key || new Array(16).fill(0);
      }
      
      // Generate IV from options or use default
      if (options && options.iv) {
        ivBytes = options.iv;
      } else {
        ivBytes = new Array(16).fill(0);
      }
      
      // Initialize with key and IV
      this.Init(keyBytes, ivBytes);
      
      // Return instance ID
      return 'zuc-instance-' + Math.random().toString(36).substr(2, 9);
    },
    
    encryptBlock: function(id, plaintext) {
      // ZUC is a stream cipher - process the data
      const data = global.OpCodes ? global.OpCodes.StringToBytes(plaintext) : [];
      const keystream = this.GenerateKeystream(data.length);
      const result = [];
      
      for (let i = 0; i < data.length; i++) {
        result[i] = data[i] ^ ((keystream[Math.floor(i/4)] >>> ((3 - (i % 4)) * 8)) & 0xFF);
      }
      
      return global.OpCodes ? global.OpCodes.BytesToString(result) : '';
    },
    
    decryptBlock: function(id, ciphertext) {
      // XOR operation is symmetric for stream ciphers
      return this.encryptBlock(id, ciphertext);
    },
    
    ClearData: function(id) {
      // Clear sensitive data
      if (this.LFSR) {
        this.LFSR.fill(0);
      }
      this.R1 = 0;
      this.R2 = 0;
      return true;
    },
    
    // Add uppercase aliases for test compatibility
    EncryptBlock: function(id, plaintext) {
      return this.encryptBlock(id, plaintext);
    },
    
    DecryptBlock: function(id, ciphertext) {
      return this.decryptBlock(id, ciphertext);
    }
  };
  
  // Register with global Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    const ZUCCipher = {
      internalName: ZUC.internalName,
      name: ZUC.name,
      
      // Store current key and IV
      currentKey: null,
      currentIV: null,
      
      Init: function() {
        // Initialize with default key and IV
        this.currentKey = new Array(16).fill(0);
        this.currentIV = new Array(16).fill(0);
        return 0;
      },
      
      // Set key (expects 32 hex chars = 16 bytes)
      KeySetup: function(nKeyIndex, key) {
        try {
          if (key.length !== 32) {
            return "Key must be 32 hex characters (128 bits)";
          }
          this.currentKey = OpCodes.HexToBytes(key);
          return "Key set successfully";
        } catch (e) {
          return "Error: " + e.message;
        }
      },
      
      // Encrypt/Decrypt using ZUC stream cipher
      encryptBlock: function(nKeyIndex, szPlaintext) {
        try {
          // Use first 32 chars as IV if longer than 32 chars
          let iv = this.currentIV;
          let plaintext = szPlaintext;
          
          if (szPlaintext.length > 32) {
            iv = OpCodes.HexToBytes(szPlaintext.substring(0, 32));
            plaintext = szPlaintext.substring(32);
          }
          
          const data = OpCodes.HexToBytes(plaintext);
          const result = ZUC.Process(data, this.currentKey, iv);
          return OpCodes.BytesToHex(result);
        } catch (e) {
          return "Error: " + e.message;
        }
      },
      
      decryptBlock: function(nKeyIndex, szCiphertext) {
        // Stream cipher - decryption is the same as encryption
        return this.encryptBlock(nKeyIndex, szCiphertext);
      },
      
      ClearData: function() {
        if (this.currentKey) {
          OpCodes.ClearArray(this.currentKey);
        }
        if (this.currentIV) {
          OpCodes.ClearArray(this.currentIV);
        }
        if (ZUC.LFSR) {
          OpCodes.ClearArray(ZUC.LFSR);
        }
        if (ZUC.X) {
          OpCodes.ClearArray(ZUC.X);
        }
        ZUC.R1 = 0;
        ZUC.R2 = 0;
      }
    };
    
    Cipher.AddCipher(ZUC);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ZUC;
  }
  
  // Export to global scope
  global.ZUC = ZUC;
  
})(typeof global !== 'undefined' ? global : window);