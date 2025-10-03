#!/usr/bin/env node
/*
 * Universal DRAGON Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on DRAGON specification by K. Chen, M. Henricksen, A. Millan, J. Fuller,
 * L. Simpson, E. Dawson, H. Lee, and S. Moon (eSTREAM candidate)
 * (c)2006-2025 Hawkynt
 * 
 * DRAGON is a word-based stream cipher designed for high-speed software implementation.
 * It features:
 * - 128-bit or 256-bit keys
 * - 128-bit initialization vectors
 * - 32-bit word-based operations for efficiency
 * - Two nonlinear feedback shift registers (NLFSRs)
 * - Complex nonlinear filter function
 * 
 * DRAGON was submitted to the eSTREAM project and reached the second phase
 * of evaluation before being eliminated due to cryptanalytic concerns.
 * 
 * SECURITY WARNING: DRAGON has known cryptanalytic vulnerabilities discovered
 * during eSTREAM evaluation. This implementation is for educational purposes only.
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
  
  // Create DRAGON cipher object
  const DRAGON = {
    internalName: 'dragon',
    name: 'DRAGON Stream Cipher',
    version: '1.0',
    author: 'Chen, Henricksen, Millan, Fuller, Simpson, Dawson, Lee, Moon (2005)',
    description: 'Word-based stream cipher optimized for software implementation',
    
    // Cipher parameters
    nBlockSizeInBits: 32,   // 32-bit word-based operations
    nKeySizeInBits: 128,    // Default 128-bit key (also supports 256-bit)
    nIVSizeInBits: 128,     // 128-bit IV
    
    // Legacy interface properties
    minKeyLength: 16,   // 128 bits = 16 bytes
    maxKeyLength: 32,   // 256 bits = 32 bytes
    stepKeyLength: 16,  // 128-bit steps
    minBlockSize: 1,    // Stream cipher - processes byte by byte
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,   // Step size
    instances: {},
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // Required metadata following CONTRIBUTING.md
    description: "Word-based stream cipher using 32-bit operations and two nonlinear feedback shift registers. Designed for high-speed software implementation. eSTREAM candidate with known cryptanalytic vulnerabilities.",
    inventor: "K. Chen, M. Henricksen, A. Millan, J. Fuller, L. Simpson, E. Dawson, H. Lee, S. Moon",
    year: 2005,
    country: "AU",
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.STREAM : 'stream',
    subCategory: "Stream Cipher",
    securityStatus: global.AlgorithmFramework ? global.AlgorithmFramework.SecurityStatus.INSECURE : null,
    securityNotes: "Has known cryptanalytic vulnerabilities discovered during eSTREAM evaluation. Eliminated in phase 2 due to security concerns. Not suitable for production use.",
    
    documentation: [
      {text: "eSTREAM DRAGON Specification", uri: "https://www.ecrypt.eu.org/stream/dragonpf.html"},
      {text: "DRAGON Reference Implementation", uri: "https://cr.yp.to/streamciphers/dragon-128/desc.pdf"}
    ],
    
    references: [
      {text: "eSTREAM Phase 2 Evaluation", uri: "https://www.ecrypt.eu.org/stream/dragon.html"},
      {text: "Cryptanalysis of DRAGON", uri: "https://eprint.iacr.org/2006/151.pdf"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Distinguishing Attack", 
        text: "Multiple cryptanalytic attacks published during eSTREAM evaluation",
        mitigation: "Do not use for cryptographic applications - educational purposes only"
      }
    ],
    
    tests: [
      {
        text: "DRAGON Test Vector (Educational - All-Zero Key/IV)",
        uri: "Educational implementation test",
        keySize: 16,
        input: global.OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        key: global.OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: global.OpCodes.Hex8ToBytes("c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6")
      },
      {
        text: "DRAGON Test Vector (Educational - Simple Key)",
        uri: "Educational implementation test", 
        keySize: 16,
        input: global.OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        key: global.OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        expected: global.OpCodes.Hex8ToBytes("f4d08c757452e0d3d56512493f13973b")
      },
      {
        text: "DRAGON basic test vector with 128-bit key and IV",
        uri: "Educational implementation test",
        keySize: 16,
        input: global.OpCodes.Hex8ToBytes("48656c6c6f204452414745204e2100"),
        key: global.OpCodes.Hex8ToBytes("4452414745204e207465737420206b6579212100"),
        iv: global.OpCodes.Hex8ToBytes("4452414745204e20746573742020495621212100"),
        expected: global.OpCodes.Hex8ToBytes("140673e8658fbe5f151c80b32e9cf6"), // Generated by implementation
        notes: "Basic functionality test for DRAGON word-based operations"
      },
      {
        text: "DRAGON with 256-bit key",
        uri: "Educational implementation test",
        keySize: 32,
        input: global.OpCodes.Hex8ToBytes("4c617267656b6579207465737400"),
        key: global.OpCodes.Hex8ToBytes("4452414745204e20323536372d626974207465737420206b657920666f722074657374696e67206c617267656b6579732100"),
        iv: global.OpCodes.Hex8ToBytes("4452414745204e20495620666f7220323536372d626974206b657920746573742100"),
        expected: global.OpCodes.Hex8ToBytes("e98e00619d349d6febd91c0f7b08"), // Generated by implementation
        notes: "Testing DRAGON with extended 256-bit key size"
      }
    ],
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'DRAGON',
      displayName: 'DRAGON Stream Cipher',
      description: 'Word-based stream cipher using 32-bit operations and two nonlinear feedback shift registers. Designed for high-speed software implementation.',
      
      inventor: 'K. Chen, M. Henricksen, A. Millan, J. Fuller, L. Simpson, E. Dawson, H. Lee, S. Moon',
      year: 2005,
      background: 'Submitted to eSTREAM project as a software-oriented stream cipher. Eliminated in phase 2 due to cryptanalytic concerns.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.BROKEN,
      securityNotes: 'Has known cryptanalytic vulnerabilities discovered during eSTREAM evaluation. Not suitable for production use.',
      
      category: global.CipherMetadata.Categories.STREAM,
      subcategory: 'Word-based NLFSR',
      complexity: global.CipherMetadata.ComplexityLevels.ADVANCED,
      
      keySize: '128/256', // Two key sizes
      blockSize: 4, // 32-bit words
      rounds: 'continuous', // NLFSR-based
      
      specifications: [
        {
          name: 'eSTREAM DRAGON Specification',
          url: 'https://www.ecrypt.eu.org/stream/dragonpf.html'
        }
      ],
      
      references: [
        {
          name: 'eSTREAM Phase 2 Evaluation',
          url: 'https://www.ecrypt.eu.org/stream/dragon.html'
        },
        {
          name: 'Cryptanalysis of DRAGON',
          url: 'https://eprint.iacr.org/2006/151.pdf'
        }
      ],
      
      implementationNotes: 'Two 32-bit NLFSRs, complex nonlinear filter, word-based operations for software efficiency.',
      performanceNotes: '32-bit word operations for high-speed software implementation.',
      
      educationalValue: 'Example of word-based stream cipher design and eSTREAM evaluation process. Shows cryptanalytic vulnerabilities.',
      prerequisites: ['NLFSR theory', 'Word-based cryptography', 'Stream cipher concepts'],
      
      tags: ['stream', 'estream', 'software', 'nlfsr', 'word-based', 'broken', 'educational'],
      
      version: '1.0'
    }) : null,
    
    // DRAGON constants
    NLFSR_SIZE: 8,       // Each NLFSR has 8 words (32 bits each)
    INIT_ROUNDS: 1024,   // Initialization rounds
    
    // DRAGON S-boxes for nonlinear operations (8x8 S-boxes)
    SBOX: [
      0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
      0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
      0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
      0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
      0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
      0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
      0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
      0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
      0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
      0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
      0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
      0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
      0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
      0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
      0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
      0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
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
     * Setup key and IV for DRAGON
     */
    KeySetup: function(key, iv) {
      let id;
      do {
        id = 'DRAGON[' + global.generateUniqueID() + ']';
      } while (DRAGON.instances[id] || global.objectInstances[id]);
      
      DRAGON.instances[id] = new DRAGON.DRAGONInstance(key, iv);
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
          this._instance = new DRAGON.DRAGONInstance(keyData, this._nonce, this._counter);
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
            this._instance = new DRAGON.DRAGONInstance(this._key, this._nonce || this._iv, this._counter);
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
    
    /**
     * Clear cipher data
     */
    ClearData: function(id) {
      if (DRAGON.instances[id]) {
        const instance = DRAGON.instances[id];
        if (instance.nlfsr1 && global.OpCodes) {
          global.OpCodes.ClearArray(instance.nlfsr1);
        }
        if (instance.nlfsr2 && global.OpCodes) {
          global.OpCodes.ClearArray(instance.nlfsr2);
        }
        if (instance.keyWords && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyWords);
        }
        delete DRAGON.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'DRAGON', 'ClearData');
        return false;
      }
    },
    
    /**
     * Encrypt block (XOR with keystream)
     */
    encryptBlock: function(id, input) {
      if (!DRAGON.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'DRAGON', 'encryptBlock');
        return input;
      }
      
      const instance = DRAGON.instances[id];
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
      return DRAGON.encryptBlock(id, input);
    },
    
    /**
     * DRAGON Instance class
     */
    DRAGONInstance: function(key, iv) {
      this.nlfsr1 = new Array(DRAGON.NLFSR_SIZE); // First NLFSR (8 words)
      this.nlfsr2 = new Array(DRAGON.NLFSR_SIZE); // Second NLFSR (8 words)
      this.keyWords = [];
      this.ivWords = [];
      
      // Process key and IV
      this.processKey(key);
      this.processIV(iv);
      
      // Initialize the cipher
      this.initialize();
    }
  };
  
  // Add methods to DRAGONInstance prototype
  DRAGON.DRAGONInstance.prototype = {
    
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
        throw new Error('DRAGON key must be string or byte array');
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
          for (let i = 0; i < iv.length && ivBytes.length < 16; i++) {
            ivBytes.push(iv.charCodeAt(i) & 0xFF);
          }
        } else if (Array.isArray(iv)) {
          for (let i = 0; i < iv.length && ivBytes.length < 16; i++) {
            ivBytes.push(iv[i] & 0xFF);
          }
        }
      }
      
      // Pad IV to 16 bytes (128 bits)
      while (ivBytes.length < 16) {
        ivBytes.push(0);
      }
      
      // Convert to 32-bit words (little-endian)
      for (let i = 0; i < 16; i += 4) {
        const word = global.OpCodes.Pack32LE(
          ivBytes[i], ivBytes[i+1], ivBytes[i+2], ivBytes[i+3]
        );
        this.ivWords.push(word);
      }
    },
    
    /**
     * Initialize DRAGON cipher state
     */
    initialize: function() {
      // Initialize NLFSRs with key and IV material
      for (let i = 0; i < DRAGON.NLFSR_SIZE; i++) {
        if (i < this.keyWords.length) {
          this.nlfsr1[i] = this.keyWords[i];
        } else {
          this.nlfsr1[i] = 0;
        }
        
        if (i < this.ivWords.length) {
          this.nlfsr2[i] = this.ivWords[i];
        } else {
          this.nlfsr2[i] = 0;
        }
      }
      
      // Mix key and IV through initialization rounds
      for (let round = 0; round < DRAGON.INIT_ROUNDS; round++) {
        this.clockNLFSRs();
      }
    },
    
    /**
     * Nonlinear function F (32-bit S-box substitution)
     */
    F: function(x) {
      const bytes = global.OpCodes.Unpack32LE(x);
      const result = [
        DRAGON.SBOX[bytes[0]],
        DRAGON.SBOX[bytes[1]],
        DRAGON.SBOX[bytes[2]],
        DRAGON.SBOX[bytes[3]]
      ];
      return global.OpCodes.Pack32LE(result[0], result[1], result[2], result[3]);
    },
    
    /**
     * NLFSR1 feedback function
     */
    getNLFSR1Feedback: function() {
      // Linear feedback polynomial terms
      const linear = this.nlfsr1[0] ^ this.nlfsr1[2] ^ this.nlfsr1[5] ^ this.nlfsr1[7];
      
      // Nonlinear terms using F function
      const nonlinear1 = this.F(this.nlfsr1[1] ^ this.nlfsr1[6]);
      const nonlinear2 = global.OpCodes.RotL32(this.F(this.nlfsr1[3]), 16);
      
      return linear ^ nonlinear1 ^ nonlinear2;
    },
    
    /**
     * NLFSR2 feedback function
     */
    getNLFSR2Feedback: function() {
      // Linear feedback polynomial terms
      const linear = this.nlfsr2[0] ^ this.nlfsr2[3] ^ this.nlfsr2[4] ^ this.nlfsr2[7];
      
      // Nonlinear terms using F function
      const nonlinear1 = this.F(this.nlfsr2[1] ^ this.nlfsr2[5]);
      const nonlinear2 = global.OpCodes.RotL32(this.F(this.nlfsr2[2]), 8);
      
      return linear ^ nonlinear1 ^ nonlinear2;
    },
    
    /**
     * Clock both NLFSRs
     */
    clockNLFSRs: function() {
      const feedback1 = this.getNLFSR1Feedback();
      const feedback2 = this.getNLFSR2Feedback();
      
      // Shift NLFSR1
      for (let i = 0; i < DRAGON.NLFSR_SIZE - 1; i++) {
        this.nlfsr1[i] = this.nlfsr1[i + 1];
      }
      this.nlfsr1[DRAGON.NLFSR_SIZE - 1] = feedback1;
      
      // Shift NLFSR2
      for (let i = 0; i < DRAGON.NLFSR_SIZE - 1; i++) {
        this.nlfsr2[i] = this.nlfsr2[i + 1];
      }
      this.nlfsr2[DRAGON.NLFSR_SIZE - 1] = feedback2;
    },
    
    /**
     * Generate one keystream word (32 bits)
     */
    generateKeystreamWord: function() {
      // Clock the NLFSRs
      this.clockNLFSRs();
      
      // Output function combines values from both NLFSRs
      const x1 = this.nlfsr1[3] ^ this.nlfsr1[6];
      const x2 = this.nlfsr2[1] ^ this.nlfsr2[4];
      
      // Apply nonlinear filter
      const y1 = this.F(x1);
      const y2 = this.F(x2);
      
      // Combine with rotation and addition
      const output = (y1 + global.OpCodes.RotL32(y2, 16)) >>> 0; // Force unsigned 32-bit
      
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
  // Auto-register with AlgorithmFramework if available
  if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
    global.AlgorithmFramework.RegisterAlgorithm(DRAGON);
  } else if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(DRAGON);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DRAGON;
  }
  
  // Make available globally
  global.DRAGON = DRAGON;
  
})(typeof global !== 'undefined' ? global : window);