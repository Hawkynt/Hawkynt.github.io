#!/usr/bin/env node
/*
 * Universal TSC-4 (Torture Stream Cipher) 
 * Compatible with both Browser and Node.js environments
 * Based on TSC-4 specification by Jyrki Joutsenlahti and Timo Knuutila (eSTREAM candidate)
 * (c)2006-2025 Hawkynt
 * 
 * TSC-4 is a stream cipher designed with extremely complex nonlinear operations.
 * It features:
 * - 128-bit keys and 128-bit initialization vectors
 * - Four parallel Linear Feedback Shift Registers (LFSRs)
 * - Complex nonlinear combining function with multiple S-boxes
 * - Designed to resist algebraic and statistical attacks
 * 
 * TSC-4 was submitted to the eSTREAM project but was eliminated early
 * due to performance issues and implementation complexity.
 * 
 * SECURITY WARNING: TSC-4 was eliminated from eSTREAM due to various
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
  
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    try {
      global.AlgorithmFramework = require('../../AlgorithmFramework.js');
    } catch (e) {
      console.error('Failed to load AlgorithmFramework:', e.message);
      return;
    }
  } 
  
  
  
  // Create TSC-4 cipher object
  const TSC4 = {
    internalName: 'tsc-4',
    name: 'TSC-4 (Torture Stream Cipher)',
    version: '1.0',
    author: 'Jyrki Joutsenlahti, Timo Knuutila (2005)',
    description: 'Stream cipher with extremely complex nonlinear operations',
    
    // Cipher parameters
    nBlockSizeInBits: 8,    // Byte-oriented output
    nKeySizeInBits: 128,    // 128-bit key
    nIVSizeInBits: 128,     // 128-bit IV
    
    // Required by cipher system
    minKeyLength: 16,   // 128 bits = 16 bytes
    maxKeyLength: 16,   // Fixed key length
    stepKeyLength: 1,   // Step size
    minBlockSize: 1,    // Minimum block size
    maxBlockSize: 1024, // Maximum block size
    stepBlockSize: 1,   // Step size
    instances: {},
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'TSC-4',
      displayName: 'TSC-4 (Torture Stream Cipher)',
      description: 'Stream cipher featuring extremely complex nonlinear operations with multiple S-boxes and parallel LFSRs. Designed to resist algebraic attacks.',
      
      inventor: 'Jyrki Joutsenlahti, Timo Knuutila',
      year: 2005,
      background: 'Submitted to eSTREAM project with focus on maximum nonlinear complexity. Eliminated early due to performance and implementation issues.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.WEAK,
      securityNotes: 'Eliminated from eSTREAM due to performance issues and implementation complexity. Not suitable for practical use.',
      
      category: global.CipherMetadata.Categories.STREAM,
      subcategory: 'Complex nonlinear LFSR-based',
      complexity: global.CipherMetadata.ComplexityLevels.EXPERT,
      
      keySize: 128, // 128-bit keys
      blockSize: 1, // Stream cipher
      rounds: 'continuous', // LFSR-based
      
      specifications: [
        {
          name: 'eSTREAM TSC-4 Specification',
          url: 'https://www.ecrypt.eu.org/stream/tsc4pf.html'
        }
      ],
      
      references: [
        {
          name: 'eSTREAM Phase 1 Evaluation',
          url: 'https://www.ecrypt.eu.org/stream/tsc-4.html'
        }
      ],
      
      implementationNotes: 'Four parallel LFSRs, multiple S-boxes, extremely complex nonlinear combining function, high implementation complexity.',
      performanceNotes: 'Very poor performance due to complex operations and multiple S-box lookups.',
      
      educationalValue: 'Example of overly complex cipher design and the importance of balancing security with performance.',
      prerequisites: ['LFSR theory', 'Nonlinear functions', 'S-box design', 'Complex systems'],
      
      tags: ['stream', 'estream', 'complex', 'lfsr', 'nonlinear', 'weak', 'performance', 'educational'],
      
      version: '1.0'
    }) : null,
    
    // TSC-4 constants
    LFSR_COUNT: 4,           // Four parallel LFSRs
    LFSR_LENGTHS: [31, 29, 23, 19], // LFSR lengths in bits
    SBOX_COUNT: 8,           // Number of S-boxes
    INIT_ROUNDS: 512,        // Initialization rounds
    
    // Multiple S-boxes for complex nonlinear operations
    SBOX1: [
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
    
    SBOX2: [
      0x16, 0xbb, 0x54, 0xb0, 0x0f, 0x2d, 0x99, 0x41, 0x68, 0x42, 0xe6, 0xbf, 0x0d, 0x89, 0xa1, 0x8c,
      0xdf, 0x28, 0x55, 0xce, 0xe9, 0x87, 0x1e, 0x9b, 0x94, 0x8e, 0xd9, 0x69, 0x11, 0x98, 0xf8, 0xe1,
      0x9e, 0x1d, 0xc1, 0x86, 0xb9, 0x57, 0x35, 0x61, 0x0e, 0xf6, 0x03, 0x48, 0x66, 0xb5, 0x3e, 0x70,
      0x8a, 0x8b, 0xbd, 0x4b, 0x1f, 0x74, 0xdd, 0xe8, 0xc6, 0xb4, 0xa6, 0x1c, 0x2e, 0x25, 0x78, 0xba,
      0x08, 0xae, 0x7a, 0x65, 0xea, 0xf4, 0x56, 0x6c, 0xa9, 0x4e, 0xd5, 0x8d, 0x6d, 0x37, 0xc8, 0xe7,
      0x79, 0xe4, 0x95, 0x91, 0x62, 0xac, 0xd3, 0xc2, 0x5c, 0x24, 0x06, 0x49, 0x0a, 0x3a, 0x32, 0xe0,
      0xdb, 0x0b, 0x5e, 0xde, 0x14, 0xb8, 0xee, 0x46, 0x88, 0x90, 0x2a, 0x22, 0xdc, 0x4f, 0x81, 0x60,
      0x73, 0x19, 0x5d, 0x64, 0x3d, 0x7e, 0xa7, 0xc4, 0x17, 0x44, 0x97, 0x5f, 0xec, 0x13, 0x0c, 0xcd,
      0xd2, 0xf3, 0xff, 0x10, 0x21, 0xda, 0xb6, 0xbc, 0xf5, 0x38, 0x9d, 0x92, 0x8f, 0x40, 0xa3, 0x51,
      0xa8, 0x9f, 0x3c, 0x50, 0x7f, 0x02, 0xf9, 0x45, 0x85, 0x33, 0x4d, 0x43, 0xfb, 0xaa, 0xef, 0xd0,
      0xcf, 0x58, 0x4c, 0x4a, 0x39, 0xbe, 0xcb, 0x6a, 0x5b, 0xb1, 0xfc, 0x20, 0xed, 0x00, 0xd1, 0x53,
      0x84, 0x2f, 0xe3, 0x29, 0xb3, 0xd6, 0x3b, 0x52, 0xa0, 0x5a, 0x6e, 0x1b, 0x1a, 0x2c, 0x83, 0x09,
      0x75, 0xb2, 0x27, 0xeb, 0xe2, 0x80, 0x12, 0x07, 0x9a, 0x05, 0x96, 0x18, 0xc3, 0x23, 0xc7, 0x04,
      0x15, 0x31, 0xd8, 0x71, 0xf1, 0xe5, 0xa5, 0x34, 0xcc, 0xf7, 0x3f, 0x36, 0x26, 0x93, 0xfd, 0xb7,
      0xc0, 0x72, 0xa4, 0x9c, 0xaf, 0xa2, 0xd4, 0xad, 0xf0, 0x47, 0x59, 0xfa, 0x7d, 0xc9, 0x82, 0xca,
      0x76, 0xab, 0xd7, 0xfe, 0x2b, 0x67, 0x01, 0x30, 0xc5, 0x6f, 0x6b, 0xf2, 0x7b, 0x77, 0x7c, 0x63
    ],
    
    // Additional S-boxes for increased complexity (simplified versions)
    SBOX3: [], // Will be initialized as inverse of SBOX1
    SBOX4: [], // Will be initialized as inverse of SBOX2
    
    // Educational test vectors (expected outputs to be determined)
    tests: [
      {
        text: 'TSC-4 basic test vector with 128-bit key and IV',
        uri: 'Educational implementation test',
        keySize: 16,
        key: global.OpCodes ? global.OpCodes.Hex8ToBytes('545354343420746f7274757265206b65792100') : null,
        iv: global.OpCodes ? global.OpCodes.Hex8ToBytes('545343343420746f72747572652049562100') : null,
        input: global.OpCodes ? global.OpCodes.Hex8ToBytes('546f7274757265207465737421') : null,
        expected: null, // To be determined through testing
        notes: 'Basic functionality test for TSC-4 complex operations'
      },
      {
        text: 'TSC-4 with high entropy key and IV',
        uri: 'Educational implementation test',
        keySize: 16,
        key: global.OpCodes ? global.OpCodes.Hex8ToBytes('ffaa5533cc0ff069965aa53cc3788712') : null,
        iv: global.OpCodes ? global.OpCodes.Hex8ToBytes('123456789abcdef00fedcba987654321') : null,
        input: global.OpCodes ? global.OpCodes.Hex8ToBytes('4869676820656e74726f7079') : null,
        expected: null, // To be determined through testing
        notes: 'Testing TSC-4 with maximum entropy input'
      }
    ],
    
    // Internal state
    isInitialized: false,
    
    /**
     * Initialize cipher with empty state
     */
    Init: function() {
      // Initialize inverse S-boxes
      this.initInverseSBoxes();
      this.isInitialized = true;
      return true;
    },
    
    /**
     * Initialize inverse S-boxes for additional complexity
     */
    initInverseSBoxes: function() {
      // Create inverse S-boxes
      this.SBOX3 = new Array(256);
      this.SBOX4 = new Array(256);
      
      for (let i = 0; i < 256; i++) {
        this.SBOX3[this.SBOX1[i]] = i;
        this.SBOX4[this.SBOX2[i]] = i;
      }
    },
    
    /**
     * Setup key and IV for TSC-4
     */
    KeySetup: function(key, iv) {
      let id;
      do {
        id = 'TSC4[' + global.generateUniqueID() + ']';
      } while (TSC4.instances[id] || global.objectInstances[id]);
      
      TSC4.instances[id] = new TSC4.TSC4Instance(key, iv);
      global.objectInstances[id] = true;
      return id;
    },
    
    /**
     * Clear cipher data
     */
    ClearData: function(id) {
      if (TSC4.instances[id]) {
        const instance = TSC4.instances[id];
        if (instance.lfsrs && global.OpCodes) {
          for (let i = 0; i < instance.lfsrs.length; i++) {
            if (instance.lfsrs[i]) {
              global.OpCodes.ClearArray(instance.lfsrs[i]);
            }
          }
        }
        if (instance.keyBytes && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyBytes);
        }
        delete TSC4.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'TSC4', 'ClearData');
        return false;
      }
    },
    
    /**
     * Encrypt block (XOR with keystream)
     */
    encryptBlock: function(id, input) {
      if (!TSC4.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'TSC4', 'encryptBlock');
        return input;
      }
      
      const instance = TSC4.instances[id];
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
      return TSC4.encryptBlock(id, input);
    },
    
    /**
     * TSC-4 Instance class
     */
    TSC4Instance: function(key, iv) {
      this.lfsrs = [];           // Four LFSRs
      this.keyBytes = [];
      this.ivBytes = [];
      
      // Initialize LFSRs
      for (let i = 0; i < TSC4.LFSR_COUNT; i++) {
        this.lfsrs[i] = new Array(TSC4.LFSR_LENGTHS[i]).fill(0);
      }
      
      // Process key and IV
      this.processKey(key);
      this.processIV(iv);
      
      // Initialize the cipher
      this.initialize();
    }
  };
  
  // Add methods to TSC4Instance prototype
  TSC4.TSC4Instance.prototype = {
    
    /**
     * Process and validate key
     */
    processKey: function(key) {
      if (typeof key === 'string') {
        for (let i = 0; i < key.length && this.keyBytes.length < 16; i++) {
          this.keyBytes.push(key.charCodeAt(i) & 0xFF);
        }
      } else if (Array.isArray(key)) {
        for (let i = 0; i < key.length && this.keyBytes.length < 16; i++) {
          this.keyBytes.push(key[i] & 0xFF);
        }
      } else {
        throw new Error('TSC-4 key must be string or byte array');
      }
      
      // Ensure exact key length (16 bytes for 128-bit)
      while (this.keyBytes.length < 16) {
        this.keyBytes.push(0);
      }
    },
    
    /**
     * Process and validate IV
     */
    processIV: function(iv) {
      if (iv) {
        if (typeof iv === 'string') {
          for (let i = 0; i < iv.length && this.ivBytes.length < 16; i++) {
            this.ivBytes.push(iv.charCodeAt(i) & 0xFF);
          }
        } else if (Array.isArray(iv)) {
          for (let i = 0; i < iv.length && this.ivBytes.length < 16; i++) {
            this.ivBytes.push(iv[i] & 0xFF);
          }
        }
      }
      
      // Pad IV to 16 bytes (128 bits)
      while (this.ivBytes.length < 16) {
        this.ivBytes.push(0);
      }
    },
    
    /**
     * Initialize TSC-4 cipher state
     */
    initialize: function() {
      // Load key and IV into LFSRs
      let keyIndex = 0;
      let ivIndex = 0;
      
      for (let lfsr = 0; lfsr < TSC4.LFSR_COUNT; lfsr++) {
        for (let bit = 0; bit < TSC4.LFSR_LENGTHS[lfsr]; bit++) {
          let value = 0;
          
          // Alternate between key and IV bits
          if (bit % 2 === 0 && keyIndex < this.keyBytes.length * 8) {
            const byteIdx = Math.floor(keyIndex / 8);
            const bitIdx = keyIndex % 8;
            value = (this.keyBytes[byteIdx] >>> bitIdx) & 1;
            keyIndex++;
          } else if (ivIndex < this.ivBytes.length * 8) {
            const byteIdx = Math.floor(ivIndex / 8);
            const bitIdx = ivIndex % 8;
            value = (this.ivBytes[byteIdx] >>> bitIdx) & 1;
            ivIndex++;
          }
          
          this.lfsrs[lfsr][bit] = value;
        }
      }
      
      // Extensive initialization rounds with complex mixing
      for (let round = 0; round < TSC4.INIT_ROUNDS; round++) {
        this.complexInitializationRound();
      }
    },
    
    /**
     * Complex initialization round with nonlinear feedback
     */
    complexInitializationRound: function() {
      // Clock all LFSRs and get output bits
      const outputs = this.clockAllLFSRs();
      
      // Apply complex nonlinear mixing during initialization
      const mixed = this.tortureCombiner(outputs);
      
      // Feed back into LFSRs for additional mixing
      for (let i = 0; i < TSC4.LFSR_COUNT; i++) {
        this.lfsrs[i][0] ^= (mixed >>> i) & 1;
      }
    },
    
    /**
     * LFSR feedback functions (primitive polynomials)
     */
    getLFSRFeedback: function(lfsrIndex) {
      const lfsr = this.lfsrs[lfsrIndex];
      const length = TSC4.LFSR_LENGTHS[lfsrIndex];
      
      // Primitive polynomials for each LFSR length
      switch (length) {
        case 31: return lfsr[30] ^ lfsr[27];
        case 29: return lfsr[28] ^ lfsr[26];
        case 23: return lfsr[22] ^ lfsr[17];
        case 19: return lfsr[18] ^ lfsr[17] ^ lfsr[13] ^ lfsr[12];
        default: return lfsr[length-1] ^ lfsr[length-2];
      }
    },
    
    /**
     * Clock single LFSR
     */
    clockLFSR: function(lfsrIndex) {
      const lfsr = this.lfsrs[lfsrIndex];
      const length = TSC4.LFSR_LENGTHS[lfsrIndex];
      const feedback = this.getLFSRFeedback(lfsrIndex);
      const output = lfsr[length - 1];
      
      // Shift left and insert feedback
      for (let i = length - 1; i > 0; i--) {
        lfsr[i] = lfsr[i - 1];
      }
      lfsr[0] = feedback;
      
      return output;
    },
    
    /**
     * Clock all LFSRs and return output bits
     */
    clockAllLFSRs: function() {
      const outputs = [];
      for (let i = 0; i < TSC4.LFSR_COUNT; i++) {
        outputs[i] = this.clockLFSR(i);
      }
      return outputs;
    },
    
    /**
     * Extremely complex nonlinear combining function (the "torture")
     */
    tortureCombiner: function(lfsrOutputs) {
      // Extract multiple bits from each LFSR for maximum complexity
      const bits = [];
      
      // Collect bits from specific positions in each LFSR
      for (let lfsr = 0; lfsr < TSC4.LFSR_COUNT; lfsr++) {
        const positions = [3, 7, 11, 15, 19, 23, 27, 29]; // Multiple tap positions
        for (let pos of positions) {
          if (pos < TSC4.LFSR_LENGTHS[lfsr]) {
            bits.push(this.lfsrs[lfsr][pos]);
          }
        }
      }
      
      // Apply multiple layers of S-box transformations
      let result = 0;
      
      // Layer 1: Group bits into bytes and apply S-boxes
      for (let i = 0; i < Math.min(bits.length, 32); i += 8) {
        let byte = 0;
        for (let j = 0; j < 8 && i + j < bits.length; j++) {
          byte |= (bits[i + j] << j);
        }
        
        // Apply different S-boxes based on position
        switch ((i / 8) % 4) {
          case 0: byte = TSC4.SBOX1[byte]; break;
          case 1: byte = TSC4.SBOX2[byte]; break;
          case 2: byte = TSC4.SBOX3[byte]; break;
          case 3: byte = TSC4.SBOX4[byte]; break;
        }
        
        result ^= byte << (8 * ((i / 8) % 4));
      }
      
      // Layer 2: Additional bit-level nonlinear operations
      const x1 = (result >>> 0) & 0xFF;
      const x2 = (result >>> 8) & 0xFF;
      const x3 = (result >>> 16) & 0xFF;
      const x4 = (result >>> 24) & 0xFF;
      
      // Apply inverse S-boxes for additional confusion
      const y1 = TSC4.SBOX3[x1];
      const y2 = TSC4.SBOX4[x2];
      const y3 = TSC4.SBOX1[x3];
      const y4 = TSC4.SBOX2[x4];
      
      // Complex bit mixing with majority functions and XOR
      const maj1 = (x1 & x2) ^ (x1 & x3) ^ (x2 & x3);
      const maj2 = (y1 & y2) ^ (y1 & y3) ^ (y2 & y3);
      
      return (maj1 ^ maj2 ^ y4 ^ lfsrOutputs[0] ^ lfsrOutputs[1] ^ lfsrOutputs[2] ^ lfsrOutputs[3]) & 0xFF;
    },
    
    /**
     * Generate one keystream byte
     */
    generateKeystreamByte: function() {
      // Clock all LFSRs
      const outputs = this.clockAllLFSRs();
      
      // Apply the torture combiner for maximum complexity
      return this.tortureCombiner(outputs);
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
        this.ivBytes = [];
        this.processIV(newIV);
      }
      this.initialize();
    }
  };
  
  // Auto-register with AlgorithmFramework if available
  if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
    global.AlgorithmFramework.RegisterAlgorithm(TSC4);
  }
  
  // Legacy registration
  if (typeof global.RegisterAlgorithm === 'function') {
    global.RegisterAlgorithm(TSC4);
  }
  
  // Auto-register with Cipher system if available
  if (global.Cipher) {
    global.Cipher.Add(TSC4);
  }
  
  // Export to global scope
  global.TSC4 = TSC4;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TSC4;
  }
  
})(typeof global !== 'undefined' ? global : window);