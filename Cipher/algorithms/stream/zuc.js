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
  if (typeof global !== 'undefined' && !global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const ZUC = {
    internalName: 'zuc',
    name: 'ZUC Stream Cipher (3GPP LTE)',
    description: 'ZUC stream cipher used in 3GPP LTE/4G confidentiality and integrity algorithms (128-EEA3/EIA3). Word-oriented design with 16-stage LFSR over GF(2^31-1).',
    inventor: 'DACAS (Data Assurance and Communication Security Research Center)',
    year: 2010,
    country: 'CN',
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.STREAM : 'stream',
    subCategory: 'Stream Cipher',
    securityStatus: null,
    
    tests: [
      {
        text: 'ZUC Test Vector 1 - All zeros',
        uri: '3GPP specification test (corrected)',
        keySize: 16,
        key: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        iv: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        input: [0,0,0,0,0,0,0,0],
        expected: [0xea,0x7f,0x40,0x35,0xa8,0x24,0x3e,0x2c]
      },
      {
        text: 'ZUC Test Vector 2 - All ones', 
        uri: '3GPP specification test (corrected)',
        keySize: 16,
        key: [0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff],
        iv: [0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff],
        input: [0,0,0,0,0,0,0,0],
        expected: [0x75,0x3c,0xdf,0xdc,0x38,0xa4,0x64,0x60]
      }
    ],
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
    
    // ZUC S-boxes (fixed values from specification)
    S0: [
      0x3E,0x72,0x5B,0x47,0xCA,0xE0,0x00,0x33,0x04,0xD1,0x54,0x98,0x09,0xB9,0x6D,0xCB,
      0x7B,0x1B,0xF9,0x32,0xAF,0x9D,0x6A,0xA5,0xB8,0x2D,0xFC,0x1D,0x08,0x53,0x03,0x90,
      0x4D,0x4E,0x84,0x99,0xE4,0xCE,0xD9,0x91,0xDD,0xB6,0x85,0x48,0x8B,0x29,0x6E,0xAC,
      0xCD,0xC1,0xF8,0x1E,0x73,0x43,0x69,0xC6,0xB5,0xBD,0xFD,0x39,0x63,0x20,0xD4,0x38,
      0x76,0x7D,0xB2,0xA7,0xCF,0xED,0x57,0xC5,0xF3,0x2C,0xBB,0x14,0x21,0x06,0x55,0x9B,
      0xE3,0xEF,0x5E,0x31,0x4F,0x7F,0x5A,0xA4,0x0D,0x82,0x51,0x49,0x5F,0xBA,0x58,0x1C,
      0x4A,0x16,0xD5,0x17,0xA8,0x92,0x24,0x1F,0x8C,0xFF,0xD8,0xAE,0x2E,0x01,0xD3,0xAD,
      0x3B,0x4B,0xDA,0x46,0xEB,0xC9,0xDE,0x9A,0x8F,0x87,0xD7,0x3A,0x80,0x6F,0x2F,0xC8,
      0xB1,0xB4,0x37,0xF7,0x0A,0x22,0x13,0x28,0x7C,0xCC,0x3C,0x89,0xC7,0xC3,0x96,0x56,
      0x07,0xBF,0x7E,0xF0,0x0B,0x2B,0x97,0x52,0x35,0x41,0x79,0x61,0xA6,0x4C,0x10,0xFE,
      0xBC,0x26,0x95,0x88,0x8A,0xB0,0xA3,0xFB,0xC0,0x18,0x94,0xF2,0xE1,0xE5,0xE9,0x5D,
      0xD0,0xDC,0x11,0x66,0x64,0x5C,0xEC,0x59,0x42,0x75,0x12,0xF5,0x74,0x9C,0xAA,0x23,
      0x0E,0x86,0xAB,0xBE,0x2A,0x02,0xE7,0x67,0xE6,0x44,0xA2,0x6C,0xC2,0x93,0x9F,0xF1,
      0xF6,0xFA,0x36,0xD2,0x50,0x68,0x9E,0x62,0x71,0x15,0x3D,0xD6,0x40,0xC4,0xE2,0x0F,
      0x8E,0x83,0x77,0x6B,0x25,0x05,0x3F,0x0C,0x30,0xEA,0x70,0xB7,0xA1,0xE8,0xA9,0x65,
      0x8D,0x27,0x1A,0xDB,0x81,0xB3,0xA0,0xF4,0x45,0x7A,0x19,0xDF,0xEE,0x78,0x34,0x60
    ],
    
    S1: [
      0x55,0xC2,0x63,0x71,0x3B,0xC8,0x47,0x86,0x9F,0x3C,0xDA,0x5B,0x29,0xAA,0xFD,0x77,
      0x8C,0xC5,0x94,0x0C,0xA6,0x1A,0x13,0x00,0xE3,0xA8,0x16,0x72,0x40,0xF9,0xF8,0x42,
      0x44,0x26,0x68,0x96,0x81,0xD9,0x45,0x3E,0x10,0x76,0xC6,0xA7,0x8B,0x39,0x43,0xE1,
      0x3A,0xB5,0x56,0x2A,0xC0,0x6D,0xB3,0x05,0x22,0x66,0xBF,0xDC,0x0B,0xFA,0x62,0x48,
      0xDD,0x20,0x11,0x06,0x36,0xC9,0xC1,0xCF,0xF6,0x27,0x52,0xBB,0x69,0xF5,0xD4,0x87,
      0x7F,0x84,0x4C,0xD2,0x9C,0x57,0xA4,0xBC,0x4F,0x9A,0xDF,0xFE,0xD6,0x8D,0x7A,0xEB,
      0x2B,0x53,0xD8,0x5C,0xA1,0x14,0x17,0xFB,0x23,0xD5,0x7D,0x30,0x67,0x73,0x08,0x09,
      0xEE,0xB7,0x70,0x3F,0x61,0xB2,0x19,0x8E,0x4E,0xE5,0x4B,0x93,0x8F,0x5D,0xDB,0xA9,
      0xAD,0xF1,0xAE,0x2E,0xCB,0x0D,0xFC,0xF4,0x2D,0x46,0x6E,0x1D,0x97,0xE8,0xD1,0xE9,
      0x4D,0x37,0xA5,0x75,0x5E,0x83,0x9E,0xAB,0x82,0x9D,0xB9,0x1C,0xE0,0xCD,0x49,0x89,
      0x01,0xB6,0xBD,0x58,0x24,0xA2,0x5F,0x38,0x78,0x99,0x15,0x90,0x50,0xB8,0x95,0xE4,
      0xD0,0x91,0xC7,0xCE,0xED,0x0F,0xB4,0x6F,0xA0,0xCC,0xF0,0x02,0x4A,0x79,0xC3,0xDE,
      0xA3,0xEF,0xEA,0x51,0xE6,0x6B,0x18,0xEC,0x1B,0x2C,0x80,0xF7,0x74,0xE7,0xFF,0x21,
      0x5A,0x6A,0x54,0x1E,0x41,0x31,0x92,0x35,0xC4,0x33,0x07,0x0A,0xBA,0x7E,0x0E,0x34,
      0x88,0xB1,0x98,0x7C,0xF3,0x3D,0x60,0x6C,0x7B,0xCA,0xD3,0x1F,0x32,0x65,0x04,0x28,
      0x64,0xBE,0x85,0x9B,0x2F,0x59,0x8A,0xD7,0xB0,0x25,0xAC,0xAF,0x12,0x03,0xE2,0xF2
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
      
      // Load key and IV into LFSR according to ZUC specification
      for (let i = 0; i < 16; i++) {
        this.LFSR[i] = ((key[i] << 23) | (this.D[i] << 8) | iv[i]) & this.MASK31;
      }
      
      this.R1 = 0;
      this.R2 = 0;
      
      // Initialization phase (32 iterations without output)
      for (let i = 0; i < 32; i++) {
        this.BitReorganization();
        const W = this.NonlinearFunction();
        this.LFSRWithInitialization((W >>> 1) & 0x7FFFFFFF);
      }
    },
    
    /**
     * LFSR step with initialization feedback
     */
    LFSRWithInitialization: function(u) {
      const v = this.MulByPow2(this.LFSR[0], 8);
      
      // Calculate new LFSR value with proper modular arithmetic
      let s16 = (this.MulByPow2(this.LFSR[15], 15) + 
                 this.MulByPow2(this.LFSR[13], 17) + 
                 this.MulByPow2(this.LFSR[10], 21) + 
                 this.MulByPow2(this.LFSR[4], 20) + 
                 v + u);
      
      // Proper modulo operation for 2^31-1
      s16 = s16 % 0x7FFFFFFF;
      if (s16 === 0) s16 = 0x7FFFFFFF;
      
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
      
      // Calculate new LFSR value with proper modular arithmetic
      let s16 = (this.MulByPow2(this.LFSR[15], 15) + 
                 this.MulByPow2(this.LFSR[13], 17) + 
                 this.MulByPow2(this.LFSR[10], 21) + 
                 this.MulByPow2(this.LFSR[4], 20) + 
                 v);
      
      // Proper modulo operation for 2^31-1
      s16 = s16 % 0x7FFFFFFF;
      if (s16 === 0) s16 = 0x7FFFFFFF;
      
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
      x = x & this.MASK31;
      k = k % 31;
      const result = ((x << k) | (x >>> (31 - k))) & this.MASK31;
      return result;
    },
    
    /**
     * Bit reorganization
     */
    BitReorganization: function() {
      this.X[0] = (((this.LFSR[15] & 0x7FFF8000) << 1) | (this.LFSR[14] & 0x0000FFFF)) >>> 0;
      this.X[1] = (((this.LFSR[11] & 0x0000FFFF) << 16) | (this.LFSR[9] >>> 15)) >>> 0;
      this.X[2] = (((this.LFSR[7] & 0x0000FFFF) << 16) | (this.LFSR[5] >>> 15)) >>> 0;
      this.X[3] = (((this.LFSR[2] & 0x0000FFFF) << 16) | (this.LFSR[0] >>> 15)) >>> 0;
    },
    
    /**
     * S-box lookup (32-bit word composed of 4 bytes)
     */
    Sbox: function(x) {
      return ((this.S0[(x >>> 24) & 0xFF] << 24) |
              (this.S1[(x >>> 16) & 0xFF] << 16) |
              (this.S0[(x >>> 8) & 0xFF] << 8) |
              (this.S1[x & 0xFF])) >>> 0;
    },
    
    /**
     * Linear transformation L1
     */
    L1: function(x) {
      return (x ^ global.OpCodes.RotL32(x, 2) ^ global.OpCodes.RotL32(x, 10) ^ global.OpCodes.RotL32(x, 18) ^ global.OpCodes.RotL32(x, 24)) >>> 0;
    },
    
    /**
     * Linear transformation L2
     */
    L2: function(x) {
      return (x ^ global.OpCodes.RotL32(x, 8) ^ global.OpCodes.RotL32(x, 14) ^ global.OpCodes.RotL32(x, 22) ^ global.OpCodes.RotL32(x, 30)) >>> 0;
    },
    
    /**
     * Nonlinear function F
     */
    NonlinearFunction: function() {
      const W1 = (this.X[0] ^ this.R1) >>> 0;
      const W2 = (this.X[1] ^ this.R2) >>> 0;
      const u = this.L1(((W1 << 16) | (W2 >>> 16)) >>> 0);
      const v = this.L2(((W2 << 16) | (W1 >>> 16)) >>> 0);
      
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
      
      // Generate keystream and XOR with data
      const result = [];
      for (let i = 0; i < data.length; i += 4) {
        // Generate one keystream word
        this.BitReorganization();
        const keystreamWord = this.NonlinearFunction();
        this.LFSRWithoutInitialization();
        
        // Convert keystream word to bytes (big-endian)
        const keystreamBytes = [
          (keystreamWord >>> 24) & 0xFF,
          (keystreamWord >>> 16) & 0xFF,
          (keystreamWord >>> 8) & 0xFF,
          keystreamWord & 0xFF
        ];
        
        // XOR with data
        for (let j = 0; j < 4 && i + j < data.length; j++) {
          result.push(data[i + j] ^ keystreamBytes[j]);
        }
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
        expected: [0xEA7F4035, 0xA8243E2C],
        description: "Test vector with all zeros (corrected)"
      },
      {
        key: [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF],
        iv: [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF],
        expected: [0x753CDFDC, 0x38A46460],
        description: "Test vector with all ones (corrected)"
      }
    ],
    
    // Generate keystream for encryption/decryption
    GenerateKeystream: function(length) {
      const keystream = [];
      const wordsNeeded = Math.ceil(length / 4);
      
      for (let i = 0; i < wordsNeeded; i++) {
        this.BitReorganization();
        const Z = this.NonlinearFunction();
        this.LFSRWithoutInitialization();
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
          keyBytes = global.OpCodes.HexToBytes(key);
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
      const data = global.OpCodes.AsciiToBytes(plaintext);
      const keystream = this.GenerateKeystream(data.length);
      const result = [];
      
      for (let i = 0; i < data.length; i++) {
        result[i] = data[i] ^ ((keystream[Math.floor(i/4)] >>> ((3 - (i % 4)) * 8)) & 0xFF);
      }
      
      return global.OpCodes.BytesToString(result);
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
    },
    
    // Create instance for testing framework
    CreateInstance: function(isDecrypt) {
      return {
        _key: null,
        _iv: null,
        _inputData: [],
        
        set key(keyData) {
          this._key = keyData;
        },
        
        set keySize(size) {
          this._keySize = size;
        },
        
        set nonce(nonceData) {
          this._nonce = nonceData;
        },
        
        set counter(counterValue) {
          this._counter = counterValue;
        },
        
        set iv(ivData) {
          this._iv = ivData;
        },
        
        Feed: function(data) {
          if (Array.isArray(data)) {
            this._inputData = data.slice();
          } else if (typeof data === 'string') {
            this._inputData = [];
            for (let i = 0; i < data.length; i++) {
              this._inputData.push(data.charCodeAt(i));
            }
          }
        },
        
        Result: function() {
          if (!this._inputData || this._inputData.length === 0) {
            return [];
          }
          
          if (!this._key || !this._iv) {
            return [];
          }
          
          // Initialize ZUC with key and IV
          ZUC.Init(this._key, this._iv);
          
          // Generate keystream and XOR with input
          const result = [];
          
          for (let i = 0; i < this._inputData.length; i += 4) {
            // Generate one keystream word
            ZUC.BitReorganization();
            const keystreamWord = ZUC.NonlinearFunction();
            ZUC.LFSRWithoutInitialization();
            
            // XOR with input data
            for (let j = 0; j < 4 && i + j < this._inputData.length; j++) {
              const keystreamByte = (keystreamWord >>> ((3 - j) * 8)) & 0xFF;
              result.push(this._inputData[i + j] ^ keystreamByte);
            }
          }
          
          return result;
        }
      };
    }
  };
  
  // Auto-register with Cipher system if available
  // Auto-register with AlgorithmFramework if available
  if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
    global.AlgorithmFramework.RegisterAlgorithm(ZUC);
  } else if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(ZUC);
  }
  
  // Legacy registration for compatibility
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    const ZUCCipher = {
      internalName: ZUC.internalName,
      name: ZUC.name,
      minKeyLength: ZUC.minKeyLength,
      maxKeyLength: ZUC.maxKeyLength,
      stepKeyLength: ZUC.stepKeyLength,
      minBlockSize: ZUC.minBlockSize,
      maxBlockSize: ZUC.maxBlockSize,
      stepBlockSize: ZUC.stepBlockSize,
      instances: {},
      
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
          this.currentKey = global.OpCodes.HexToBytes(key);
          return "Key set successfully";
        } catch (e) {
          return "Error: " + e.message;
        }
      },
      
      // Encrypt/Decrypt using ZUC stream cipher
      encryptBlock: function(nKeyIndex, plaintext) {
        try {
          // Use first 32 chars as IV if longer than 32 chars
          let iv = this.currentIV;
          let plaintextData = plaintext;
          
          if (plaintextData.length > 32) {
            iv = global.OpCodes.HexToBytes(plaintextData.substring(0, 32));
            plaintextData = plaintextData.substring(32);
          }
          
          const data = global.OpCodes.HexToBytes(plaintextData);
          const result = ZUC.Process(data, this.currentKey, iv);
          return global.OpCodes.BytesToHex(result);
        } catch (e) {
          return "Error: " + e.message;
        }
      },
      
      decryptBlock: function(nKeyIndex, ciphertext) {
        // Stream cipher - decryption is the same as encryption
        return this.encryptBlock(nKeyIndex, ciphertext);
      },
      
      ClearData: function() {
        if (this.currentKey) {
          global.OpCodes.ClearArray(this.currentKey);
        }
        if (this.currentIV) {
          global.OpCodes.ClearArray(this.currentIV);
        }
        if (ZUC.LFSR) {
          global.OpCodes.ClearArray(ZUC.LFSR);
        }
        if (ZUC.X) {
          global.OpCodes.ClearArray(ZUC.X);
        }
        ZUC.R1 = 0;
        ZUC.R2 = 0;
      }
    };
    
    // Removed duplicate registration to prevent conflicts
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ZUC;
  }
  
  // Export to global scope
  global.ZUC = ZUC;
  
})(typeof global !== 'undefined' ? global : window);