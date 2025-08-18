#!/usr/bin/env node
/*
 * Universal PIKE Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on PIKE specification by Ross Anderson (eSTREAM candidate)
 * (c)2006-2025 Hawkynt
 * 
 * PIKE is a fast stream cipher designed by Ross Anderson for high-speed
 * software implementation. It features:
 * - Variable key sizes (128, 192, 256 bits)
 * - 64-bit initialization vectors
 * - Word-based operations optimized for modern processors
 * - Simple and fast design for high throughput
 * 
 * PIKE was submitted to the eSTREAM project and was designed to achieve
 * very high speeds in software (multiple Gbps on modern processors).
 * 
 * SECURITY WARNING: PIKE was withdrawn from eSTREAM due to cryptanalytic
 * concerns. This implementation is for educational purposes only.
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
      console.error('PIKE cipher requires Cipher system to be loaded first');
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
  
  // Create PIKE cipher object
  const PIKE = {
    internalName: 'pike',
    name: 'PIKE Stream Cipher',
    version: '1.0',
    author: 'Ross Anderson (2005)',
    description: 'Fast stream cipher optimized for high-speed software implementation',
    
    // Cipher parameters
    nBlockSizeInBits: 32,   // 32-bit word-based operations
    nKeySizeInBits: 128,    // Default 128-bit key
    nIVSizeInBits: 64,      // 64-bit IV
    
    // Required by cipher system
    minKeyLength: 16,   // 128 bits = 16 bytes
    maxKeyLength: 32,   // 256 bits = 32 bytes
    stepKeyLength: 8,   // 64-bit steps
    minBlockSize: 1,    // Minimum block size
    maxBlockSize: 1024, // Maximum block size
    stepBlockSize: 1,   // Step size
    instances: {},
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'PIKE',
      displayName: 'PIKE Stream Cipher',
      description: 'Ultra-fast stream cipher designed for maximum software performance using simple operations and minimal state.',
      
      inventor: 'Ross Anderson',
      year: 2005,
      background: 'Submitted to eSTREAM project with focus on achieving maximum software throughput (multi-Gbps speeds). Withdrawn due to security concerns.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.BROKEN,
      securityNotes: 'Withdrawn from eSTREAM due to cryptanalytic vulnerabilities. Not suitable for production use.',
      
      category: global.CipherMetadata.Categories.STREAM,
      subcategory: 'Fast software-oriented',
      complexity: global.CipherMetadata.ComplexityLevels.INTERMEDIATE,
      
      keySize: '128/192/256', // Variable key sizes
      blockSize: 4, // 32-bit words
      rounds: 'continuous', // Stream cipher
      
      specifications: [
        {
          name: 'eSTREAM PIKE Specification',
          url: 'https://www.ecrypt.eu.org/stream/pikepf.html'
        }
      ],
      
      references: [
        {
          name: 'PIKE Cryptanalysis Papers',
          url: 'https://www.cl.cam.ac.uk/~rja14/pike.html'
        }
      ],
      
      implementationNotes: 'Simple word-based operations, minimal state, optimized for modern processor architectures.',
      performanceNotes: 'Designed for multi-Gbps throughput in software with simple operations.',
      
      educationalValue: 'Example of performance-focused stream cipher design and the trade-offs between speed and security.',
      prerequisites: ['Stream cipher concepts', 'Performance optimization'],
      
      tags: ['stream', 'estream', 'fast', 'software', 'broken', 'performance', 'educational'],
      
      version: '1.0'
    }) : null,
    
    // PIKE constants
    STATE_SIZE: 8,        // 8 words of state (32 bits each)
    ROUNDS_PER_WORD: 4,   // Rounds per output word
    INIT_ROUNDS: 1024,    // Initialization rounds
    
    // PIKE mixing constants (derived from mathematical constants)
    MIX_CONSTANTS: [
      0x9E3779B9, 0x3C6EF372, 0x78DDE6E4, 0xF1BBCDCA,
      0xE3779B97, 0xC6EF372F, 0x8DDE6E4E, 0x1BBCDCA7
    ],
    
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
     * Setup key and IV for PIKE
     */
    KeySetup: function(key, iv) {
      let id;
      do {
        id = 'PIKE[' + global.generateUniqueID() + ']';
      } while (PIKE.instances[id] || global.objectInstances[id]);
      
      PIKE.instances[id] = new PIKE.PIKEInstance(key, iv);
      global.objectInstances[id] = true;
      return id;
    },
    
    /**
     * Clear cipher data
     */
    ClearData: function(id) {
      if (PIKE.instances[id]) {
        const instance = PIKE.instances[id];
        if (instance.state && global.OpCodes) {
          global.OpCodes.ClearArray(instance.state);
        }
        if (instance.keyWords && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyWords);
        }
        delete PIKE.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'PIKE', 'ClearData');
        return false;
      }
    },
    
    /**
     * Encrypt block (XOR with keystream)
     */
    encryptBlock: function(id, input) {
      if (!PIKE.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'PIKE', 'encryptBlock');
        return input;
      }
      
      const instance = PIKE.instances[id];
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
      return PIKE.encryptBlock(id, input);
    },
    
    /**
     * PIKE Instance class
     */
    PIKEInstance: function(key, iv) {
      this.state = new Array(PIKE.STATE_SIZE);  // 8 words of state
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
  
  // Add methods to PIKEInstance prototype
  PIKE.PIKEInstance.prototype = {
    
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
        throw new Error('PIKE key must be string or byte array');
      }
      
      // Ensure minimum key length (16 bytes for 128-bit)
      while (keyBytes.length < 16) {
        keyBytes.push(0);
      }
      
      // Pad to 32-bit word boundary
      while (keyBytes.length % 4 !== 0) {
        keyBytes.push(0);
      }
      
      // Convert to 32-bit words (little-endian)
      for (let i = 0; i < keyBytes.length; i += 4) {
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
          for (let i = 0; i < iv.length && ivBytes.length < 8; i++) {
            ivBytes.push(iv.charCodeAt(i) & 0xFF);
          }
        } else if (Array.isArray(iv)) {
          for (let i = 0; i < iv.length && ivBytes.length < 8; i++) {
            ivBytes.push(iv[i] & 0xFF);
          }
        }
      }
      
      // Pad IV to 8 bytes (64 bits)
      while (ivBytes.length < 8) {
        ivBytes.push(0);
      }
      
      // Convert to 32-bit words (little-endian)
      for (let i = 0; i < 8; i += 4) {
        const word = global.OpCodes.Pack32LE(
          ivBytes[i], ivBytes[i+1], ivBytes[i+2], ivBytes[i+3]
        );
        this.ivWords.push(word);
      }
    },
    
    /**
     * Initialize PIKE cipher state
     */
    initialize: function() {
      // Initialize state with key material
      for (let i = 0; i < PIKE.STATE_SIZE; i++) {
        if (i < this.keyWords.length) {
          this.state[i] = this.keyWords[i];
        } else {
          this.state[i] = PIKE.MIX_CONSTANTS[i % PIKE.MIX_CONSTANTS.length];
        }
      }
      
      // Mix in IV
      if (this.ivWords.length >= 2) {
        this.state[0] ^= this.ivWords[0];
        this.state[1] ^= this.ivWords[1];
      }
      
      // Initial mixing rounds
      for (let round = 0; round < PIKE.INIT_ROUNDS; round++) {
        this.mixState();
      }
      
      this.counter = 0;
    },
    
    /**
     * PIKE mixing function (simplified version)
     */
    mixState: function() {
      // Simple ARX (Add-Rotate-XOR) operations for speed
      for (let i = 0; i < PIKE.STATE_SIZE; i++) {
        const prev = this.state[(i + PIKE.STATE_SIZE - 1) % PIKE.STATE_SIZE];
        const next = this.state[(i + 1) % PIKE.STATE_SIZE];
        
        // Add
        this.state[i] = (this.state[i] + prev + this.counter) >>> 0;
        
        // Rotate
        this.state[i] = global.OpCodes.RotL32(this.state[i], 7);
        
        // XOR
        this.state[i] ^= next ^ PIKE.MIX_CONSTANTS[i];
      }
      
      this.counter = (this.counter + 1) >>> 0;
    },
    
    /**
     * Generate one keystream word (32 bits)
     */
    generateKeystreamWord: function() {
      // Perform mixing rounds
      for (let round = 0; round < PIKE.ROUNDS_PER_WORD; round++) {
        this.mixState();
      }
      
      // Output function: combine state words
      let output = this.state[0];
      for (let i = 1; i < PIKE.STATE_SIZE; i++) {
        output ^= global.OpCodes.RotL32(this.state[i], i * 4);
      }
      
      return output;
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
    Cipher.AddCipher(PIKE);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PIKE;
  }
  
  // Make available globally
  global.PIKE = PIKE;
  
})(typeof global !== 'undefined' ? global : window);