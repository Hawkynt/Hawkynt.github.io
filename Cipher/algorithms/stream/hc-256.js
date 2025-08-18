#!/usr/bin/env node
/*
 * Universal HC-256 Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on HC-256 specification by Hongjun Wu
 * (c)2006-2025 Hawkynt
 * 
 * HC-256 is a software-efficient stream cipher designed by Hongjun Wu,
 * an extended version of HC-128. It features:
 * - Two 1024-word tables (P and Q) - larger than HC-128's 512-word tables
 * - 256-bit keys and 256-bit initialization vectors
 * - High performance in software implementations
 * - eSTREAM Profile 1 finalist (HC-128 variant)
 * 
 * The cipher generates keystream by updating and combining
 * values from the two large tables using nonlinear functions.
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
  
  if (!global.Cipher) {
    if (typeof require !== 'undefined') {
      // Node.js environment - load dependencies
      try {
        require('../../universal-cipher-env.js');
        require('../../cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('HC-256 cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Load metadata system
  if (!global.CipherMetadata && typeof require !== 'undefined') {
    try {
      require('../../cipher-metadata.js');
    } catch (e) {
      console.warn('Could not load cipher metadata system:', e.message);
    }
  }
  
  // Create HC-256 cipher object
  const HC256 = {
    internalName: 'hc-256',
    name: 'HC-256 Stream Cipher',
    version: '1.0',
    author: 'Hongjun Wu (2005)',
    description: 'Large-table software-efficient stream cipher (256-bit variant)',
    
    // Cipher parameters
    nBlockSizeInBits: 32,   // 32-bit word-based operations
    nKeySizeInBits: 256,    // 256-bit key
    nIVSizeInBits: 256,     // 256-bit IV
    
    // Required by cipher system
    minKeyLength: 32,   // 256 bits = 32 bytes
    maxKeyLength: 32,   // Fixed key length
    stepKeyLength: 1,   // Step size
    minBlockSize: 1,    // Minimum block size
    maxBlockSize: 1024, // Maximum block size
    stepBlockSize: 1,   // Step size
    instances: {},
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'HC-256',
      displayName: 'HC-256 Stream Cipher',
      description: 'Large-table stream cipher with 2048-word internal state. Extended version of HC-128 with larger keys, IVs, and tables.',
      
      inventor: 'Hongjun Wu',
      year: 2005,
      background: 'Extended version of HC-128 with larger state and 256-bit parameters. Designed for high-speed software implementation with large internal state.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.SECURE,
      securityNotes: 'Generally considered secure with no known practical attacks. Based on HC-128 which is an eSTREAM finalist.',
      
      category: global.CipherMetadata.Categories.STREAM,
      subcategory: 'Large-table software-oriented',
      complexity: global.CipherMetadata.ComplexityLevels.ADVANCED,
      
      keySize: 256, // 256-bit keys
      blockSize: 4, // 32-bit words
      rounds: 'continuous', // Table-based
      
      specifications: [
        {
          name: 'HC-256 Specification',
          url: 'https://www.ecrypt.eu.org/stream/hc256pf.html'
        }
      ],
      
      references: [
        {
          name: 'HC Stream Cipher Family',
          url: 'https://www.ecrypt.eu.org/stream/hc128.html'
        }
      ],
      
      implementationNotes: 'Two 1024-word tables (P and Q), 256-bit keys and IVs, large internal state (8192 bits).',
      performanceNotes: 'High-speed software implementation with large memory requirements.',
      
      educationalValue: 'Example of large-table stream cipher design and scaling up from HC-128.',
      prerequisites: ['Stream cipher concepts', 'Table-based ciphers', 'Large-state systems'],
      
      tags: ['stream', 'estream-family', 'large-table', 'software', 'secure', 'high-performance'],
      
      version: '1.0'
    }) : null,
    
    // HC-256 constants
    TABLE_SIZE: 1024,     // Each table has 1024 words (larger than HC-128's 512)
    INIT_ROUNDS: 4096,    // Initialization rounds (4 * 1024)
    
    // Internal state
    isInitialized: false,
    
    /**
     * Initialize cipher with empty state
     */
    Init: function() {
      this.isInitialized = true;
      return true;
    },
    
    /**
     * Setup key and IV for HC-256
     */
    KeySetup: function(key, iv) {
      let id;
      do {
        id = 'HC256[' + global.generateUniqueID() + ']';
      } while (HC256.instances[id] || global.objectInstances[id]);
      
      HC256.instances[id] = new HC256.HC256Instance(key, iv);
      global.objectInstances[id] = true;
      return id;
    },
    
    /**
     * Clear cipher data
     */
    ClearData: function(id) {
      if (HC256.instances[id]) {
        const instance = HC256.instances[id];
        if (instance.tableP && global.OpCodes) {
          global.OpCodes.ClearArray(instance.tableP);
        }
        if (instance.tableQ && global.OpCodes) {
          global.OpCodes.ClearArray(instance.tableQ);
        }
        if (instance.keyWords && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyWords);
        }
        delete HC256.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'HC256', 'ClearData');
        return false;
      }
    },
    
    /**
     * Encrypt block (XOR with keystream)
     */
    encryptBlock: function(id, input) {
      if (!HC256.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'HC256', 'encryptBlock');
        return input;
      }
      
      const instance = HC256.instances[id];
      let result = '';
      
      for (let n = 0; n < input.length; n++) {
        const keystreamByte = instance.generateKeystreamByte();
        const inputByte = input.charCodeAt(n) & 0xFF;
        const outputByte = inputByte ^ keystreamByte;
        result += String.fromCharCode(outputByte);
      }
      
      return result;
    },
    
    /**
     * Decrypt block (same as encrypt for stream cipher)
     */
    decryptBlock: function(id, input) {
      return HC256.encryptBlock(id, input);
    },
    
    /**
     * HC-256 Instance class
     */
    HC256Instance: function(key, iv) {
      this.tableP = new Array(HC256.TABLE_SIZE);  // P table (1024 words)
      this.tableQ = new Array(HC256.TABLE_SIZE);  // Q table (1024 words)
      this.keyWords = [];
      this.ivWords = [];
      this.counter = 0;
      
      // Process key and IV
      this.processKey(key);
      this.processIV(iv);
      
      // Initialize the cipher
      this.initialize();
    }
  };
  
  // Add methods to HC256Instance prototype
  HC256.HC256Instance.prototype = {
    
    /**
     * Process and validate key
     */
    processKey: function(key) {
      const keyBytes = [];
      
      if (typeof key === 'string') {
        for (let i = 0; i < key.length && keyBytes.length < 32; i++) {
          keyBytes.push(key.charCodeAt(i) & 0xFF);
        }
      } else if (Array.isArray(key)) {
        for (let i = 0; i < key.length && keyBytes.length < 32; i++) {
          keyBytes.push(key[i] & 0xFF);
        }
      } else {
        throw new Error('HC-256 key must be string or byte array');
      }
      
      // Ensure exact key length (32 bytes for 256-bit)
      while (keyBytes.length < 32) {
        keyBytes.push(0);
      }
      
      // Convert to 32-bit words (little-endian)
      for (let i = 0; i < 32; i += 4) {
        const word = global.OpCodes.Pack32LE(
          keyBytes[i], keyBytes[i+1], keyBytes[i+2], keyBytes[i+3]
        );
        this.keyWords.push(word);
      }
    },
    
    /**
     * Process and validate IV
     */
    processIV: function(iv) {
      const ivBytes = [];
      
      if (iv) {
        if (typeof iv === 'string') {
          for (let i = 0; i < iv.length && ivBytes.length < 32; i++) {
            ivBytes.push(iv.charCodeAt(i) & 0xFF);
          }
        } else if (Array.isArray(iv)) {
          for (let i = 0; i < iv.length && ivBytes.length < 32; i++) {
            ivBytes.push(iv[i] & 0xFF);
          }
        }
      }
      
      // Pad IV to 32 bytes (256 bits)
      while (ivBytes.length < 32) {
        ivBytes.push(0);
      }
      
      // Convert to 32-bit words (little-endian)
      for (let i = 0; i < 32; i += 4) {
        const word = global.OpCodes.Pack32LE(
          ivBytes[i], ivBytes[i+1], ivBytes[i+2], ivBytes[i+3]
        );
        this.ivWords.push(word);
      }
    },
    
    /**
     * Initialize HC-256 cipher state
     */
    initialize: function() {
      // Initialize W array for key scheduling (2048 words)
      const W = new Array(2048);
      
      // Fill first 16 words with key and IV
      for (let i = 0; i < 8; i++) {
        W[i] = this.keyWords[i];
        W[i + 8] = this.ivWords[i];
      }
      
      // Expand W using HC-256 key scheduling
      for (let i = 16; i < 2048; i++) {
        W[i] = this.f2(W[i - 2]) + W[i - 7] + this.f1(W[i - 15]) + W[i - 16] + i;
        W[i] = W[i] >>> 0; // Ensure 32-bit unsigned
      }
      
      // Initialize tables P and Q from W
      for (let i = 0; i < HC256.TABLE_SIZE; i++) {
        this.tableP[i] = W[i + 512];
        this.tableQ[i] = W[i + 1536];
      }
      
      // Run cipher for initialization (discard output)
      for (let i = 0; i < HC256.INIT_ROUNDS; i++) {
        this.generateKeystreamWord();
      }
      
      this.counter = 0;
    },
    
    /**
     * f1 function for key scheduling
     */
    f1: function(x) {
      return global.OpCodes.RotR32(x, 7) ^ global.OpCodes.RotR32(x, 18) ^ (x >>> 3);
    },
    
    /**
     * f2 function for key scheduling
     */
    f2: function(x) {
      return global.OpCodes.RotR32(x, 17) ^ global.OpCodes.RotR32(x, 19) ^ (x >>> 10);
    },
    
    /**
     * g1 function for keystream generation
     */
    g1: function(x, y, z) {
      return (global.OpCodes.RotR32(x, 10) ^ global.OpCodes.RotR32(z, 23)) + global.OpCodes.RotR32(y, 8);
    },
    
    /**
     * g2 function for keystream generation
     */
    g2: function(x, y, z) {
      return (global.OpCodes.RotL32(x, 10) ^ global.OpCodes.RotL32(z, 23)) + global.OpCodes.RotL32(y, 8);
    },
    
    /**
     * h1 function for table lookups
     */
    h1: function(x) {
      return this.tableQ[x & 0xFF] + this.tableQ[((x >>> 16) & 0xFF) + 256];
    },
    
    /**
     * h2 function for table lookups  
     */
    h2: function(x) {
      return this.tableP[x & 0xFF] + this.tableP[((x >>> 16) & 0xFF) + 256];
    },
    
    /**
     * Generate one keystream word (32 bits)
     */
    generateKeystreamWord: function() {
      const i = this.counter & 1023; // Index into tables (0-1023)
      let s;
      
      if (this.counter < 1024) {
        // Use table P
        const j = (i - 3) & 1023;
        const k = (i - 1023) & 1023;
        this.tableP[i] = this.tableP[i] + this.g1(this.tableP[j], this.tableP[k], this.tableP[(i - 10) & 1023]);
        s = this.h1(this.tableP[(i - 12) & 1023]) ^ this.tableP[i];
      } else {
        // Use table Q
        const j = (i - 3) & 1023;
        const k = (i - 1023) & 1023;
        this.tableQ[i] = this.tableQ[i] + this.g2(this.tableQ[j], this.tableQ[k], this.tableQ[(i - 10) & 1023]);
        s = this.h2(this.tableQ[(i - 12) & 1023]) ^ this.tableQ[i];
      }
      
      this.counter = (this.counter + 1) & 2047; // Wrap at 2048
      return s >>> 0; // Ensure 32-bit unsigned
    },
    
    /**
     * Generate one keystream byte
     */
    generateKeystreamByte: function() {
      if (!this.wordBuffer || this.wordBufferPos >= 4) {
        this.wordBuffer = global.OpCodes.Unpack32LE(this.generateKeystreamWord());
        this.wordBufferPos = 0;
      }
      
      return this.wordBuffer[this.wordBufferPos++];
    },
    
    /**
     * Generate keystream bytes
     */
    generateKeystream: function(length) {
      const keystream = [];
      for (let i = 0; i < length; i++) {
        keystream.push(this.generateKeystreamByte());
      }
      return keystream;
    },
    
    /**
     * Reset cipher with optional new IV
     */
    reset: function(newIV) {
      if (newIV !== undefined) {
        this.ivWords = [];
        this.processIV(newIV);
      }
      this.wordBuffer = null;
      this.wordBufferPos = 0;
      this.initialize();
    }
  };
  
  // Auto-register with Cipher system
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(HC256);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HC256;
  }
  
  // Make available globally
  global.HC256 = HC256;
  
})(typeof global !== 'undefined' ? global : window);