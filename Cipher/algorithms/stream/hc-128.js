#!/usr/bin/env node
/*
 * Universal HC-128 Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on HC-128 specification by Hongjun Wu
 * (c)2006-2025 Hawkynt
 * 
 * HC-128 is a software-efficient stream cipher designed by Hongjun Wu.
 * It features:
 * - Two 512-word tables (P and Q)
 * - 128-bit keys and 128-bit initialization vectors
 * - High performance in software implementations
 * - eSTREAM Profile 1 finalist
 * 
 * The cipher generates keystream by updating and combining
 * values from the two tables using nonlinear functions.
 * 
 * This implementation is for educational purposes only.
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes:', e.message);
      return;
    }
  }
  
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    try {
      global.AlgorithmFramework = require('../../AlgorithmFramework.js');
    } catch (e) {
      console.error('Failed to load AlgorithmFramework:', e.message);
      return;
    }
  } 
  
  // Create HC-128 cipher object
  const HC128 = {
    // Public interface properties
    internalName: 'HC-128',
    name: 'HC-128 Stream Cipher',
    description: 'HC-128 eSTREAM stream cipher with table-based design using 128-bit key and IV. Part of the eSTREAM portfolio for software optimization.',
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.STREAM : 'stream',
    comment: 'HC-128 eSTREAM Stream Cipher - Table-based with 128-bit key and IV',
    minKeyLength: 16,   // HC-128 uses 128-bit keys (16 bytes)
    maxKeyLength: 16,
    stepKeyLength: 1,
    minBlockSize: 1,    // Stream cipher - processes byte by byte
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // HC-128 constants
    TABLE_SIZE: 512,       // Each table has 512 32-bit words
    KEY_SIZE: 128,         // 128-bit key
    IV_SIZE: 128,          // 128-bit IV
    INIT_STEPS: 1024,      // Initialization steps
    
    // Official eSTREAM test vectors
    tests: [
      {
        text: "HC-128 eSTREAM Test Vector 1",
        uri: "https://github.com/neoeinstein/bouncycastle/blob/master/crypto/test/data/hc256/hc128/ecrypt_HC-128.txt",
        keySize: 16,
        key: global.OpCodes.Hex8ToBytes("80000000000000000000000000000000"),
        iv: global.OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        input: global.OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
        expected: global.OpCodes.Hex8ToBytes("378602B98F32A74847515654AE0DE7ED8F72BC34776A065103E51595521FFE47")
      }
    ],
    
    // Initialize cipher
    Init: function() {
      HC128.isInitialized = true;
    },
    
    // Set up key and initialize HC-128 state
    KeySetup: function(key) {
      let id;
      do {
        id = 'HC-128[' + global.generateUniqueID() + ']';
      } while (HC128.instances[id] || global.objectInstances[id]);
      
      HC128.instances[id] = new HC128.HC128Instance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Create instance for testing framework
    CreateInstance: function(isDecrypt) {
      return {
        _instance: null,
        _inputData: [],
        
        set key(keyData) {
          this._key = keyData;
          this._instance = new HC128.HC128Instance(keyData, this._iv || this._nonce);
        },
        
        set keySize(size) {
          this._keySize = size;
        },
        
        set nonce(nonceData) {
          this._nonce = nonceData;
          if (this._instance && this._instance.setNonce) {
            this._instance.setNonce(nonceData);
          }
        },
        
        set counter(counterValue) {
          this._counter = counterValue;
          if (this._instance && this._instance.setCounter) {
            this._instance.setCounter(counterValue);
          }
        },
        
        set iv(ivData) {
          this._iv = ivData;
          if (this._instance && this._instance.setIV) {
            this._instance.setIV(ivData);
          }
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
          
          // Create fresh instance if needed with all parameters
          if (!this._instance && this._key) {
            this._instance = new HC128.HC128Instance(this._key, this._iv || this._nonce);
          }
          
          if (!this._instance) {
            return [];
          }
          
          const result = [];
          for (let i = 0; i < this._inputData.length; i++) {
            // Try different keystream methods that stream ciphers might use
            let keystreamByte;
            if (this._instance.getNextKeystreamByte) {
              keystreamByte = this._instance.getNextKeystreamByte();
            } else if (this._instance.generateKeystreamByte) {
              keystreamByte = this._instance.generateKeystreamByte();
            } else if (this._instance.getKeystream) {
              const keystream = this._instance.getKeystream(1);
              keystreamByte = keystream[0];
            } else if (this._instance.nextByte) {
              keystreamByte = this._instance.nextByte();
            } else {
              // Fallback - return input unchanged
              keystreamByte = 0;
            }
            result.push(this._inputData[i] ^ keystreamByte);
          }
          return result;
        }
      };
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (HC128.instances[id]) {
        // Clear sensitive data
        const instance = HC128.instances[id];
        if (instance.P && global.OpCodes) {
          global.OpCodes.ClearArray(instance.P);
        }
        if (instance.Q && global.OpCodes) {
          global.OpCodes.ClearArray(instance.Q);
        }
        if (instance.keyBytes && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyBytes);
        }
        delete HC128.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'HC-128', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (for stream cipher, this generates keystream and XORs with input)
    encryptBlock: function(id, plaintext) {
      if (!HC128.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'HC-128', 'encryptBlock');
        return plaintext;
      }
      
      const instance = HC128.instances[id];
      let result = '';
      
      for (let n = 0; n < plaintext.length; n++) {
        const keystreamByte = instance.getNextKeystreamByte();
        const plaintextByte = plaintext.charCodeAt(n) & 0xFF;
        const ciphertextByte = plaintextByte ^ keystreamByte;
        result += String.fromCharCode(ciphertextByte);
      }
      
      return result;
    },
    
    // Decrypt block (same as encrypt for stream cipher)
    decryptBlock: function(id, ciphertext) {
      // For stream ciphers, decryption is identical to encryption
      return HC128.encryptBlock(id, ciphertext);
    },
    
    // HC-128 Instance class
    HC128Instance: function(key, iv) {
      this.P = new Array(HC128.TABLE_SIZE);     // P table (512 32-bit words)
      this.Q = new Array(HC128.TABLE_SIZE);     // Q table (512 32-bit words)
      this.counter = 0;                         // Step counter
      this.keyBytes = [];                       // Store key as byte array
      this.ivBytes = [];                        // Store IV as byte array
      this.keystreamBuffer = [];                // Buffer for generated keystream
      this.keystreamPosition = 0;               // Current position in keystream buffer
      
      // Convert key to byte array
      if (typeof key === 'string') {
        for (let k = 0; k < key.length && this.keyBytes.length < 16; k++) {
          this.keyBytes.push(key.charCodeAt(k) & 0xFF);
        }
      } else if (Array.isArray(key)) {
        for (let k = 0; k < key.length && this.keyBytes.length < 16; k++) {
          this.keyBytes.push(key[k] & 0xFF);
        }
      } else {
        throw new Error('HC-128 key must be string or byte array');
      }
      
      // Pad key to required length (16 bytes = 128 bits)
      while (this.keyBytes.length < 16) {
        this.keyBytes.push(0);
      }
      
      // Process IV (default to zero IV if not provided)
      if (iv) {
        if (typeof iv === 'string') {
          for (let n = 0; n < iv.length && this.ivBytes.length < 16; n++) {
            this.ivBytes.push(iv.charCodeAt(n) & 0xFF);
          }
        } else if (Array.isArray(iv)) {
          for (let n = 0; n < iv.length && this.ivBytes.length < 16; n++) {
            this.ivBytes.push(iv[n] & 0xFF);
          }
        }
      }
      
      // Pad IV to required length (16 bytes = 128 bits)
      while (this.ivBytes.length < 16) {
        this.ivBytes.push(0);
      }
      
      // Initialize the cipher
      this.initialize();
    }
  };
  
  // Add methods to HC128Instance prototype
  HC128.HC128Instance.prototype = {
    
    /**
     * Initialize HC-128 cipher state
     */
    initialize: function() {
      // Convert key and IV to 32-bit words
      const K = [];
      const IV = [];
      
      for (let i = 0; i < 4; i++) {
        K[i] = global.OpCodes.Pack32LE(
          this.keyBytes[i * 4],
          this.keyBytes[i * 4 + 1],
          this.keyBytes[i * 4 + 2],
          this.keyBytes[i * 4 + 3]
        );
        
        IV[i] = global.OpCodes.Pack32LE(
          this.ivBytes[i * 4],
          this.ivBytes[i * 4 + 1],
          this.ivBytes[i * 4 + 2],
          this.ivBytes[i * 4 + 3]
        );
      }
      
      // Initialize arrays with expanded key and IV
      const W = new Array(1280); // Temporary array for initialization
      
      // Load key and IV into W
      for (let i = 0; i < 4; i++) {
        W[i] = K[i];
        W[i + 4] = IV[i];
      }
      
      // Load key and IV into first 16 positions of W
      for (let i = 0; i < 4; i++) {
        W[i] = K[i];
        W[i + 4] = K[i]; // Duplicate key
        W[i + 8] = IV[i];
        W[i + 12] = IV[i]; // Duplicate IV
      }
      
      // Expand to fill first 272 positions
      for (let i = 16; i < 272; i++) {
        W[i] = (this.f2(W[i - 2]) + W[i - 7] + this.f1(W[i - 15]) + W[i - 16] + i) >>> 0;
      }
      
      // Copy first 16 positions from positions 256-271
      for (let i = 0; i < 16; i++) {
        W[i] = W[256 + i];
      }
      
      // Continue expansion to fill 1024 positions
      for (let i = 16; i < 1024; i++) {
        W[i] = (this.f2(W[i - 2]) + W[i - 7] + this.f1(W[i - 15]) + W[i - 16] + 256 + i) >>> 0;
      }
      
      // Initialize P and Q tables from W
      for (let i = 0; i < HC128.TABLE_SIZE; i++) {
        this.P[i] = W[i];
        this.Q[i] = W[i + 512];
      }
      
      // Initialize X and Y arrays
      this.X = new Array(16);
      this.Y = new Array(16);
      for (let i = 0; i < 16; i++) {
        this.X[i] = W[512 - 16 + i];
        this.Y[i] = W[1024 - 16 + i];
      }
      
      // Run setup for 1024 steps (64 iterations of 16 steps)
      this.counter = 0;
      for (let i = 0; i < 64; i++) {
        this.setupUpdate();
      }
      
      // Reset counter for keystream generation
      this.counter = 0;
    },
    
    /**
     * f1 function for key expansion
     * @param {number} x - Input value
     * @returns {number} Transformed value
     */
    f1: function(x) {
      return global.OpCodes.RotR32(x, 7) ^ global.OpCodes.RotR32(x, 18) ^ (x >>> 3);
    },
    
    /**
     * f2 function for key expansion
     * @param {number} x - Input value
     * @returns {number} Transformed value
     */
    f2: function(x) {
      return global.OpCodes.RotR32(x, 17) ^ global.OpCodes.RotR32(x, 19) ^ (x >>> 10);
    },
    
    /**
     * G1 function for P table updates
     * @param {number} x - Input value
     * @param {number} y - Input value
     * @param {number} z - Input value
     * @returns {number} Transformed value
     */
    g1: function(x, y, z) {
      return (global.OpCodes.RotR32(x, 10) ^ global.OpCodes.RotR32(z, 23)) + global.OpCodes.RotR32(y, 8);
    },
    
    /**
     * G2 function for Q table updates
     * @param {number} x - Input value
     * @param {number} y - Input value
     * @param {number} z - Input value
     * @returns {number} Transformed value
     */
    g2: function(x, y, z) {
      return (global.OpCodes.RotL32(x, 10) ^ global.OpCodes.RotL32(z, 23)) + global.OpCodes.RotL32(y, 8);
    },
    
    /**
     * h1 function for P table lookups (Q table)
     * @param {number} x - Input value
     * @returns {number} Transformed value
     */
    h1: function(x) {
      const a = x & 0xFF;
      const c = (x >>> 16) & 0xFF;
      return (this.Q[a] + this.Q[256 + c]) >>> 0;
    },
    
    /**
     * h2 function for Q table lookups (P table)
     * @param {number} x - Input value
     * @returns {number} Transformed value
     */
    h2: function(x) {
      const a = x & 0xFF;
      const c = (x >>> 16) & 0xFF;
      return (this.P[a] + this.P[256 + c]) >>> 0;
    },
    
    /**
     * Helper function for modular arithmetic
     * @param {number} x - Value
     * @param {number} y - Modulus
     * @returns {number} (x - y) mod 512
     */
    dim: function(x, y) {
      return (x - y) & 0x1FF;
    },
    
    /**
     * Setup update function (16 steps without keystream output)
     */
    setupUpdate: function() {
      const cc = this.counter & 0x1FF;
      const dd = (cc + 16) & 0x1FF;
      
      if (this.counter < 512) {
        this.counter = (this.counter + 16) & 0x3FF;
        for (let i = 0; i < 16; i++) {
          const j = (cc + i) & 0x1FF;
          const nextJ = (cc + i + 1) & 0x1FF;
          
          const tem2 = global.OpCodes.RotR32(this.X[(i + 6) & 0xF], 8);
          const tem0 = global.OpCodes.RotR32(this.P[nextJ], 23);
          const tem1 = global.OpCodes.RotR32(this.X[(i + 13) & 0xF], 10);
          const tem3 = this.h1(this.X[(i + 4) & 0xF]);
          
          this.P[j] = (this.P[j] + tem2 + (tem0 ^ tem1)) >>> 0;
          this.P[j] = (this.P[j] ^ tem3) >>> 0;
          this.X[i & 0xF] = this.P[j];
        }
      } else {
        this.counter = (this.counter + 16) & 0x3FF;
        for (let i = 0; i < 16; i++) {
          const j = (512 + cc + i) & 0x3FF;
          const nextJ = (512 + cc + i + 1) & 0x3FF;
          
          const tem2 = global.OpCodes.RotL32(this.Y[(i + 6) & 0xF], 8);
          const tem0 = global.OpCodes.RotL32(this.Q[nextJ & 0x1FF], 23);
          const tem1 = global.OpCodes.RotL32(this.Y[(i + 13) & 0xF], 10);
          const tem3 = this.h2(this.Y[(i + 4) & 0xF]);
          
          this.Q[j & 0x1FF] = (this.Q[j & 0x1FF] + tem2 + (tem0 ^ tem1)) >>> 0;
          this.Q[j & 0x1FF] = (this.Q[j & 0x1FF] ^ tem3) >>> 0;
          this.Y[i & 0xF] = this.Q[j & 0x1FF];
        }
      }
    },
    
    /**
     * Generate keystream (16 steps with output)
     * @param {Array} keystream - Array to store 16 words of keystream
     */
    generateKeystream16: function(keystream) {
      const cc = this.counter & 0x1FF;
      const dd = (cc + 16) & 0x1FF;
      
      if (this.counter < 512) {
        this.counter = (this.counter + 16) & 0x3FF;
        for (let i = 0; i < 16; i++) {
          const j = (cc + i) & 0x1FF;
          const nextJ = (cc + i + 1) & 0x1FF;
          
          const tem2 = global.OpCodes.RotR32(this.X[(i + 6) & 0xF], 8);
          const tem0 = global.OpCodes.RotR32(this.P[nextJ], 23);
          const tem1 = global.OpCodes.RotR32(this.X[(i + 13) & 0xF], 10);
          const tem3 = this.h1(this.X[(i + 4) & 0xF]);
          
          this.P[j] = (this.P[j] + tem2 + (tem0 ^ tem1)) >>> 0;
          this.X[i & 0xF] = this.P[j];
          keystream[i] = (tem3 ^ this.P[j]) >>> 0;
        }
      } else {
        this.counter = (this.counter + 16) & 0x3FF;
        for (let i = 0; i < 16; i++) {
          const j = (512 + cc + i) & 0x3FF;
          const nextJ = (512 + cc + i + 1) & 0x3FF;
          
          const tem2 = global.OpCodes.RotL32(this.Y[(i + 6) & 0xF], 8);
          const tem0 = global.OpCodes.RotL32(this.Q[nextJ & 0x1FF], 23);
          const tem1 = global.OpCodes.RotL32(this.Y[(i + 13) & 0xF], 10);
          const tem3 = this.h2(this.Y[(i + 4) & 0xF]);
          
          this.Q[j & 0x1FF] = (this.Q[j & 0x1FF] + tem2 + (tem0 ^ tem1)) >>> 0;
          this.Y[i & 0xF] = this.Q[j & 0x1FF];
          keystream[i] = (tem3 ^ this.Q[j & 0x1FF]) >>> 0;
        }
      }
    },
    
    /**
     * Generate a block of keystream (64 bytes)
     * @returns {Array} 64 bytes of keystream
     */
    generateBlock: function() {
      const keystreamWords = new Array(16);
      this.generateKeystream16(keystreamWords);
      
      const keystream = [];
      for (let i = 0; i < 16; i++) {
        const bytes = global.OpCodes.Unpack32LE(keystreamWords[i]);
        keystream.push(bytes[0], bytes[1], bytes[2], bytes[3]);
      }
      
      return keystream;
    },
    
    /**
     * Get the next keystream byte
     * @returns {number} Next keystream byte (0-255)
     */
    getNextKeystreamByte: function() {
      // Check if we need to generate a new block
      if (this.keystreamPosition >= this.keystreamBuffer.length) {
        this.keystreamBuffer = this.generateBlock();
        this.keystreamPosition = 0;
      }
      
      return this.keystreamBuffer[this.keystreamPosition++];
    },
    
    /**
     * Generate multiple keystream bytes
     * @param {number} length - Number of bytes to generate
     * @returns {Array} Array of keystream bytes
     */
    generateKeystream: function(length) {
      const keystream = [];
      for (let n = 0; n < length; n++) {
        keystream.push(this.getNextKeystreamByte());
      }
      return keystream;
    },
    
    /**
     * Reset the cipher to initial state with optional new IV
     * @param {Array|string} newIV - Optional new IV
     */
    reset: function(newIV) {
      if (newIV !== undefined) {
        this.ivBytes = [];
        if (typeof newIV === 'string') {
          for (let n = 0; n < newIV.length && this.ivBytes.length < 16; n++) {
            this.ivBytes.push(newIV.charCodeAt(n) & 0xFF);
          }
        } else if (Array.isArray(newIV)) {
          for (let n = 0; n < newIV.length && this.ivBytes.length < 16; n++) {
            this.ivBytes.push(newIV[n] & 0xFF);
          }
        }
        // Pad IV to required length
        while (this.ivBytes.length < 16) {
          this.ivBytes.push(0);
        }
      }
      
      this.keystreamBuffer = [];
      this.keystreamPosition = 0;
      this.counter = 0;
      this.initialize();
    },
    
    /**
     * Set a new IV and reinitialize
     * @param {Array|string} newIV - New IV value
     */
    setIV: function(newIV) {
      this.reset(newIV);
    }
  };
  
  // Auto-register with AlgorithmFramework if available
  if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
    global.AlgorithmFramework.RegisterAlgorithm(HC128);
  }
  
  // Legacy registration
  if (typeof global.RegisterAlgorithm === 'function') {
    global.RegisterAlgorithm(HC128);
  }
  
  // Auto-register with Cipher system if available
  if (global.Cipher) {
    global.Cipher.Add(HC128);
  }
  
  // Export to global scope
  global.HC128 = HC128;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HC128;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);