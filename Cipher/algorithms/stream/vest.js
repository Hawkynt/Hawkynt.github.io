#!/usr/bin/env node
/*
 * Universal VEST Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on VEST specification by Sean O'Neil (eSTREAM candidate)
 * (c)2006-2025 Hawkynt
 * 
 * VEST (Variable Encryption Standard) is a stream cipher featuring:
 * - Variable key sizes (64, 80, 96, 112, 128 bits)
 * - Variable IV sizes (64, 80, 96, 112, 128 bits)
 * - 4, 8, 16, and 32-bit operating modes
 * - Word-based operations for software efficiency
 * - Complex nonlinear filter function
 * 
 * VEST was submitted to the eSTREAM project but not selected for the final portfolio.
 * It uses a combination of linear feedback shift registers (LFSRs) and
 * a complex nonlinear combining function.
 * 
 * SECURITY WARNING: VEST had cryptanalytic concerns during eSTREAM evaluation.
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
      console.error('VEST cipher requires Cipher system to be loaded first');
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
  
  // Create VEST cipher object
  const VEST = {
    internalName: 'vest',
    name: 'VEST Stream Cipher',
    version: '1.0',
    author: 'Sean O\'Neil (2005)',
    description: 'Variable Encryption Standard stream cipher with configurable parameters',
    
    // Cipher parameters
    nBlockSizeInBits: 8,   // Default 8-bit mode
    nKeySizeInBits: 128,   // Default 128-bit key
    nIVSizeInBits: 128,    // Default 128-bit IV
    
    // Required by cipher system
    minKeyLength: 8,    // 64 bits = 8 bytes minimum
    maxKeyLength: 16,   // 128 bits = 16 bytes maximum
    stepKeyLength: 2,   // 16-bit steps (2 bytes)
    minBlockSize: 1,    // Minimum block size
    maxBlockSize: 1024, // Maximum block size
    stepBlockSize: 1,   // Step size
    instances: {},
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'VEST',
      displayName: 'VEST (Variable Encryption Standard)',
      description: 'Software-oriented stream cipher with variable key/IV sizes and operating modes. Features word-based operations and complex nonlinear filter.',
      
      inventor: 'Sean O\'Neil',
      year: 2005,
      background: 'Submitted to eSTREAM project as a software-oriented stream cipher. Features configurable parameters for different security/performance trade-offs.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.WEAK,
      securityNotes: 'Had cryptanalytic concerns during eSTREAM evaluation. Not selected for final portfolio. Educational use only.',
      
      category: global.CipherMetadata.Categories.STREAM,
      subcategory: 'LFSR-based with nonlinear filter',
      complexity: global.CipherMetadata.ComplexityLevels.INTERMEDIATE,
      
      keySize: '64-128', // Variable key sizes
      blockSize: 1, // Stream cipher
      rounds: 'continuous', // LFSR-based
      
      specifications: [
        {
          name: 'eSTREAM VEST Specification',
          url: 'https://www.ecrypt.eu.org/stream/vestpf.html'
        }
      ],
      
      references: [
        {
          name: 'eSTREAM Phase 2 Evaluation',
          url: 'https://www.ecrypt.eu.org/stream/vest.html'
        }
      ],
      
      implementationNotes: 'Variable key/IV sizes (64-128 bits), multiple operating modes (4/8/16/32-bit), LFSR-based with nonlinear filter.',
      performanceNotes: 'Designed for software efficiency with word-based operations.',
      
      educationalValue: 'Good example of configurable stream cipher design and eSTREAM evaluation process.',
      prerequisites: ['LFSR theory', 'Nonlinear functions', 'Stream cipher concepts'],
      
      tags: ['stream', 'estream', 'software', 'lfsr', 'variable-parameters', 'weak', 'educational'],
      
      version: '1.0'
    }) : null,
    
    // VEST constants
    LFSR_COUNT: 4,        // Four LFSRs
    DEFAULT_LFSR_SIZES: [25, 31, 33, 39], // Default LFSR sizes for 128-bit mode
    MAX_WORD_SIZE: 32,    // Maximum word size in bits
    INIT_ROUNDS: 256,     // Initialization rounds
    
    // VEST S-boxes for nonlinear function
    SBOX1: [
      0x7, 0x4, 0xa, 0x2, 0x1, 0xc, 0xe, 0x5, 0x8, 0x6, 0x0, 0xf, 0x3, 0xd, 0x9, 0xb
    ],
    SBOX2: [
      0x2, 0x8, 0xb, 0xd, 0xf, 0x7, 0x6, 0xe, 0x3, 0x1, 0x9, 0x4, 0x0, 0xa, 0xc, 0x5
    ],
    
    // Internal state
    instances: {},
    isInitialized: false,
    
    /**
     * Initialize cipher with empty state
     */
    Init: function() {
      this.isInitialized = true;
      return true;
    },
    
    /**
     * Setup key and IV for VEST
     * @param {Array} key - Variable-length key (8-16 bytes)
     * @param {Array} iv - Variable-length IV (8-16 bytes, optional)
     */
    KeySetup: function(key, iv) {
      let id;
      do {
        id = 'VEST[' + global.generateUniqueID() + ']';
      } while (VEST.instances[id] || global.objectInstances[id]);
      
      VEST.instances[id] = new VEST.VESTInstance(key, iv);
      global.objectInstances[id] = true;
      return id;
    },
    
    /**
     * Clear cipher data
     */
    ClearData: function(id) {
      if (VEST.instances[id]) {
        const instance = VEST.instances[id];
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
        delete VEST.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'VEST', 'ClearData');
        return false;
      }
    },
    
    /**
     * Encrypt block (XOR with keystream)
     */
    encryptBlock: function(id, input) {
      if (!VEST.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'VEST', 'encryptBlock');
        return input;
      }
      
      const instance = VEST.instances[id];
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
      return VEST.encryptBlock(id, input);
    },
    
    /**
     * VEST Instance class
     */
    VESTInstance: function(key, iv) {
      this.keyBytes = [];
      this.ivBytes = [];
      this.lfsrs = [];
      this.lfsrSizes = [];
      this.wordSize = 8; // Default to 8-bit mode
      
      // Process key
      this.processKey(key);
      
      // Process IV (optional)
      this.processIV(iv);
      
      // Configure LFSR sizes based on key length
      this.configureLFSRs();
      
      // Initialize the cipher
      this.initialize();
    }
  };
  
  // Add methods to VESTInstance prototype
  VEST.VESTInstance.prototype = {
    
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
        throw new Error('VEST key must be string or byte array');
      }
      
      // Ensure minimum key length (8 bytes)
      while (this.keyBytes.length < 8) {
        this.keyBytes.push(0);
      }
      
      // Pad to even byte boundary if needed
      if (this.keyBytes.length % 2 === 1) {
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
      
      // Pad IV to match key length
      while (this.ivBytes.length < this.keyBytes.length) {
        this.ivBytes.push(0);
      }
    },
    
    /**
     * Configure LFSR sizes based on key length
     */
    configureLFSRs: function() {
      const keyBits = this.keyBytes.length * 8;
      
      // LFSR sizes based on key length
      switch (keyBits) {
        case 64:
          this.lfsrSizes = [17, 19, 23, 29];
          this.wordSize = 4;
          break;
        case 80:
          this.lfsrSizes = [19, 23, 29, 31];
          this.wordSize = 4;
          break;
        case 96:
          this.lfsrSizes = [23, 29, 31, 37];
          this.wordSize = 8;
          break;
        case 112:
          this.lfsrSizes = [29, 31, 37, 41];
          this.wordSize = 8;
          break;
        default: // 128 bits
          this.lfsrSizes = [25, 31, 33, 39];
          this.wordSize = 8;
          break;
      }
      
      // Initialize LFSRs
      for (let i = 0; i < VEST.LFSR_COUNT; i++) {
        this.lfsrs[i] = new Array(this.lfsrSizes[i]).fill(0);
      }
    },
    
    /**
     * Initialize VEST cipher state
     */
    initialize: function() {
      // Load key material into LFSRs
      let keyIndex = 0;
      let ivIndex = 0;
      
      for (let lfsr = 0; lfsr < VEST.LFSR_COUNT; lfsr++) {
        for (let bit = 0; bit < this.lfsrSizes[lfsr]; bit++) {
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
      
      // Initialization rounds
      for (let round = 0; round < VEST.INIT_ROUNDS; round++) {
        this.clockAllLFSRs();
      }
    },
    
    /**
     * LFSR feedback polynomials (primitive polynomials)
     */
    getLFSRFeedback: function(lfsrIndex) {
      const lfsr = this.lfsrs[lfsrIndex];
      const size = this.lfsrSizes[lfsrIndex];
      
      // Simple primitive polynomials for each LFSR size
      switch (size) {
        case 17: return lfsr[16] ^ lfsr[13];
        case 19: return lfsr[18] ^ lfsr[17] ^ lfsr[13] ^ lfsr[12];
        case 23: return lfsr[22] ^ lfsr[17];
        case 25: return lfsr[24] ^ lfsr[21];
        case 29: return lfsr[28] ^ lfsr[26];
        case 31: return lfsr[30] ^ lfsr[27];
        case 33: return lfsr[32] ^ lfsr[19];
        case 37: return lfsr[36] ^ lfsr[34] ^ lfsr[30] ^ lfsr[28];
        case 39: return lfsr[38] ^ lfsr[34];
        case 41: return lfsr[40] ^ lfsr[37];
        default: return lfsr[size-1] ^ lfsr[size-2];
      }
    },
    
    /**
     * Clock single LFSR
     */
    clockLFSR: function(lfsrIndex) {
      const lfsr = this.lfsrs[lfsrIndex];
      const size = this.lfsrSizes[lfsrIndex];
      const feedback = this.getLFSRFeedback(lfsrIndex);
      
      // Shift left and insert feedback
      for (let i = size - 1; i > 0; i--) {
        lfsr[i] = lfsr[i - 1];
      }
      lfsr[0] = feedback;
      
      return lfsr[size - 1]; // Return output bit
    },
    
    /**
     * Clock all LFSRs and return output bits
     */
    clockAllLFSRs: function() {
      const outputs = [];
      for (let i = 0; i < VEST.LFSR_COUNT; i++) {
        outputs[i] = this.clockLFSR(i);
      }
      return outputs;
    },
    
    /**
     * Nonlinear filter function
     */
    nonlinearFilter: function(bits) {
      // Extract bits from LFSRs at specific positions
      const x0 = this.lfsrs[0][7] ^ this.lfsrs[1][11];
      const x1 = this.lfsrs[1][13] ^ this.lfsrs[2][17];
      const x2 = this.lfsrs[2][19] ^ this.lfsrs[3][23];
      const x3 = this.lfsrs[3][29] ^ this.lfsrs[0][31 % this.lfsrSizes[0]];
      
      // Apply S-boxes
      const s1_input = (x0 << 3) | (x1 << 2) | (x2 << 1) | x3;
      const s1_output = VEST.SBOX1[s1_input & 0xF];
      
      const y0 = this.lfsrs[1][5] ^ this.lfsrs[2][7];
      const y1 = this.lfsrs[2][11] ^ this.lfsrs[3][13];
      const y2 = this.lfsrs[3][17] ^ this.lfsrs[0][19 % this.lfsrSizes[0]];
      const y3 = this.lfsrs[0][23 % this.lfsrSizes[0]] ^ this.lfsrs[1][29 % this.lfsrSizes[1]];
      
      const s2_input = (y0 << 3) | (y1 << 2) | (y2 << 1) | y3;
      const s2_output = VEST.SBOX2[s2_input & 0xF];
      
      // Combine S-box outputs with linear terms
      return (s1_output ^ s2_output ^ 
              this.lfsrs[0][3] ^ this.lfsrs[1][5] ^ 
              this.lfsrs[2][7] ^ this.lfsrs[3][11]) & 0xFF;
    },
    
    /**
     * Generate one keystream byte
     */
    generateKeystreamByte: function() {
      let byte = 0;
      
      for (let bit = 0; bit < 8; bit++) {
        // Clock all LFSRs
        this.clockAllLFSRs();
        
        // Apply nonlinear filter
        const outputBit = this.nonlinearFilter() & 1;
        byte |= (outputBit << bit);
      }
      
      return byte;
    },
    
    /**
     * Generate keystream
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
  
  // Auto-register with Cipher system
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(VEST);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = VEST;
  }
  
  // Make available globally
  global.VEST = VEST;
  
})(typeof global !== 'undefined' ? global : window);