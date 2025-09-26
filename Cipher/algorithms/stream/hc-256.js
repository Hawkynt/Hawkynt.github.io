#!/usr/bin/env node
/*
 * Universal HC-256 Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on HC-256 specification by Hongjun Wu
 * (c)2006-2025 Hawkynt
 * 
 * HC-256 is a software-efficient stream cipher designed by Hongjun Wu.
 * It features:
 * - Two 1024-word tables (P and Q)
 * - 256-bit keys and 256-bit initialization vectors
 * - High performance in software implementations
 * - Extended version of HC-128 with larger internal state
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
  
  // Create HC-256 cipher object
  const HC256 = {
    // Public interface properties
    internalName: 'HC-256',
    name: 'HC-256 Stream Cipher',
    description: 'HC-256 eSTREAM stream cipher with large table-based design using 256-bit key and IV. Extended version of HC-128 with enhanced security.',
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.STREAM : 'stream',
    comment: 'HC-256 eSTREAM Stream Cipher - Large table-based with 256-bit key and IV',
    minKeyLength: 32,   // HC-256 uses 256-bit keys (32 bytes)
    maxKeyLength: 32,
    stepKeyLength: 1,
    minBlockSize: 1,    // Stream cipher - processes byte by byte
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // HC-256 constants
    TABLE_SIZE: 1024,      // Each table has 1024 32-bit words
    KEY_SIZE: 256,         // 256-bit key
    IV_SIZE: 256,          // 256-bit IV
    INIT_STEPS: 4096,      // Initialization steps
    
    // Official eSTREAM test vectors
    tests: [
      {
        text: "HC-256 eSTREAM Test Vector 1",
        uri: "https://github.com/neoeinstein/bouncycastle/blob/master/crypto/test/data/hc256/hc256/ecrypt_HC-256.txt",
        keySize: 32,
        key: global.OpCodes.Hex8ToBytes("0053A6F94C9FF24598EB3E91E4378ADD3083D6297CCF2275C81B6EC11467BA0D"),
        iv: global.OpCodes.Hex8ToBytes("0D74DB42A91077DE45AC137AE148AF16B9C6B1F8E9C1A86A6B17F1B9A6C3C8F7"),
        input: global.OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
        expected: global.OpCodes.Hex8ToBytes("5B078985D8F6F30D42C5C02FA6B6795153F06534801F89F24E74248B720B4818")
      }
    ],
    
    // Initialize cipher
    Init: function() {
      HC256.isInitialized = true;
    },
    
    // Set up key and initialize HC-256 state
    KeySetup: function(key) {
      let id;
      do {
        id = 'HC-256[' + global.generateUniqueID() + ']';
      } while (HC256.instances[id] || global.objectInstances[id]);
      
      HC256.instances[id] = new HC256.HC256Instance(key);
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
          this._instance = new HC256.HC256Instance(keyData, this._iv || this._nonce);
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
            this._instance = new HC256.HC256Instance(this._key, this._iv || this._nonce);
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
      if (HC256.instances[id]) {
        // Clear sensitive data
        const instance = HC256.instances[id];
        if (instance.P && global.OpCodes) {
          global.OpCodes.ClearArray(instance.P);
        }
        if (instance.Q && global.OpCodes) {
          global.OpCodes.ClearArray(instance.Q);
        }
        if (instance.keyBytes && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyBytes);
        }
        delete HC256.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'HC-256', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (for stream cipher, this generates keystream and XORs with input)
    encryptBlock: function(id, plaintext) {
      if (!HC256.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'HC-256', 'encryptBlock');
        return plaintext;
      }
      
      const instance = HC256.instances[id];
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
      return HC256.encryptBlock(id, ciphertext);
    },
    
    // HC-256 Instance class
    HC256Instance: function(key, iv) {
      this.P = new Array(HC256.TABLE_SIZE);     // P table (1024 32-bit words)
      this.Q = new Array(HC256.TABLE_SIZE);     // Q table (1024 32-bit words)
      this.counter = 0;                         // Step counter
      this.keyBytes = [];                       // Store key as byte array
      this.ivBytes = [];                        // Store IV as byte array
      this.keystreamBuffer = [];                // Buffer for generated keystream
      this.keystreamPosition = 0;               // Current position in keystream buffer
      
      // Convert key to byte array
      if (typeof key === 'string') {
        for (let k = 0; k < key.length && this.keyBytes.length < 32; k++) {
          this.keyBytes.push(key.charCodeAt(k) & 0xFF);
        }
      } else if (Array.isArray(key)) {
        for (let k = 0; k < key.length && this.keyBytes.length < 32; k++) {
          this.keyBytes.push(key[k] & 0xFF);
        }
      } else {
        throw new Error('HC-256 key must be string or byte array');
      }
      
      // Pad key to required length (32 bytes = 256 bits)
      while (this.keyBytes.length < 32) {
        this.keyBytes.push(0);
      }
      
      // Process IV (default to zero IV if not provided)
      if (iv) {
        if (typeof iv === 'string') {
          for (let n = 0; n < iv.length && this.ivBytes.length < 32; n++) {
            this.ivBytes.push(iv.charCodeAt(n) & 0xFF);
          }
        } else if (Array.isArray(iv)) {
          for (let n = 0; n < iv.length && this.ivBytes.length < 32; n++) {
            this.ivBytes.push(iv[n] & 0xFF);
          }
        }
      }
      
      // Pad IV to required length (32 bytes = 256 bits)
      while (this.ivBytes.length < 32) {
        this.ivBytes.push(0);
      }
      
      // Initialize the cipher
      this.initialize();
    }
  };
  
  // Add methods to HC256Instance prototype
  HC256.HC256Instance.prototype = {
    
    /**
     * Initialize HC-256 cipher state
     */
    initialize: function() {
      // Convert key and IV to 32-bit words
      const K = [];
      const IV = [];
      
      for (let i = 0; i < 8; i++) {
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
      const W = new Array(2560); // Temporary array for initialization
      
      // Load key and IV into W
      for (let i = 0; i < 8; i++) {
        W[i] = K[i];
        W[i + 8] = IV[i];
      }
      
      // Key expansion using HC-256 algorithm
      for (let i = 16; i < 2560; i++) {
        W[i] = (this.f2(W[i - 2]) + W[i - 7] + this.f1(W[i - 15]) + W[i - 16] + i) >>> 0;
      }
      
      // Initialize P and Q tables from W
      for (let i = 0; i < HC256.TABLE_SIZE; i++) {
        this.P[i] = W[i + 512];
        this.Q[i] = W[i + 1536];
      }
      
      // Run initialization algorithm
      this.counter = 0;
      for (let i = 0; i < HC256.INIT_STEPS; i++) {
        this.generateWord();
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
     * h1 function for P table lookups (Q table)
     * @param {number} x - Input value
     * @returns {number} Transformed value
     */
    h1: function(x) {
      const a = x & 0xFF;
      const b = (x >>> 8) & 0xFF;
      const c = (x >>> 16) & 0xFF;
      const d = (x >>> 24) & 0xFF;
      return (this.Q[a] + this.Q[256 + b] + this.Q[512 + c] + this.Q[768 + d]) >>> 0;
    },
    
    /**
     * h2 function for Q table lookups (P table)
     * @param {number} x - Input value
     * @returns {number} Transformed value
     */
    h2: function(x) {
      const a = x & 0xFF;
      const b = (x >>> 8) & 0xFF;
      const c = (x >>> 16) & 0xFF;
      const d = (x >>> 24) & 0xFF;
      return (this.P[a] + this.P[256 + b] + this.P[512 + c] + this.P[768 + d]) >>> 0;
    },
    
    /**
     * Generate one 32-bit keystream word
     * @returns {number} 32-bit keystream word
     */
    generateWord: function() {
      const i = this.counter & 0x3FF; // 1024 mask
      let s;
      
      if (this.counter < 1024) {
        // Update P table
        const x = this.P[(i - 3) & 0x3FF];
        const y = this.P[(i - 1023) & 0x3FF];
        
        this.P[i] = (this.P[i] + this.P[(i - 10) & 0x3FF] + 
                     (global.OpCodes.RotR32(x, 10) ^ global.OpCodes.RotR32(y, 23)) + 
                     this.Q[(x ^ y) & 0x3FF]) >>> 0;
        
        const x12 = this.P[(i - 12) & 0x3FF];
        s = (this.h1(x12) ^ this.P[i]) >>> 0;
      } else {
        // Update Q table
        const x = this.Q[(i - 3) & 0x3FF];
        const y = this.Q[(i - 1023) & 0x3FF];
        
        this.Q[i] = (this.Q[i] + this.Q[(i - 10) & 0x3FF] + 
                     (global.OpCodes.RotR32(x, 10) ^ global.OpCodes.RotR32(y, 23)) + 
                     this.P[(x ^ y) & 0x3FF]) >>> 0;
        
        const x12 = this.Q[(i - 12) & 0x3FF];
        s = (this.h2(x12) ^ this.Q[i]) >>> 0;
      }
      
      this.counter = (this.counter + 1) & 0x7FF; // Wrap at 2048
      return s;
    },
    
    /**
     * Generate a block of keystream (16 bytes)
     * @returns {Array} 16 bytes of keystream
     */
    generateBlock: function() {
      const keystream = [];
      
      // Generate 4 32-bit words (16 bytes total)
      for (let i = 0; i < 4; i++) {
        const word = this.generateWord();
        const bytes = global.OpCodes.Unpack32LE(word);
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
          for (let n = 0; n < newIV.length && this.ivBytes.length < 32; n++) {
            this.ivBytes.push(newIV.charCodeAt(n) & 0xFF);
          }
        } else if (Array.isArray(newIV)) {
          for (let n = 0; n < newIV.length && this.ivBytes.length < 32; n++) {
            this.ivBytes.push(newIV[n] & 0xFF);
          }
        }
        // Pad IV to required length
        while (this.ivBytes.length < 32) {
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
    global.AlgorithmFramework.RegisterAlgorithm(HC256);
  }
  
  // Legacy registration
  if (typeof global.RegisterAlgorithm === 'function') {
    global.RegisterAlgorithm(HC256);
  }
  
  // Auto-register with Cipher system if available
  if (global.Cipher) {
    global.Cipher.Add(HC256);
  }
  
  // Export to global scope
  global.HC256 = HC256;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HC256;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);