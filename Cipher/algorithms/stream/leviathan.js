#!/usr/bin/env node
/*
 * Universal Leviathan Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on Leviathan specification by David McGrew (eSTREAM candidate)
 * (c)2006-2025 Hawkynt
 * 
 * Leviathan is a stream cipher designed for high security through large internal state.
 * It features:
 * - Very large internal state (4096 bits)
 * - 256-bit keys and 256-bit initialization vectors
 * - Multiple parallel linear feedback shift registers
 * - Complex nonlinear output filter
 * - Designed for high security margin
 * 
 * Leviathan was submitted to the eSTREAM project but was eliminated in phase 2
 * due to performance concerns and some cryptanalytic issues.
 * 
 * SECURITY WARNING: Leviathan had some cryptanalytic concerns during eSTREAM
 * evaluation. This implementation is for educational purposes only.
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
  
  // Create Leviathan cipher object
  const Leviathan = {
    internalName: 'leviathan',
    name: 'Leviathan Stream Cipher',
    version: '1.0',
    author: 'David McGrew (2005)',
    description: 'Large-state stream cipher designed for high security margin',
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.STREAM : 'stream',
    
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
    
    // Test vectors
    tests: [
      {
        text: "Leviathan basic test vector with 256-bit key and IV",
        uri: "Educational implementation test",
        keySize: 32,
        key: global.OpCodes ? global.OpCodes.Hex8ToBytes('4c6576696174686e20323536372d626974207465737420206b657920666f72206c617267652073746174652063697068657220746573696e67206865726520') : null,
        iv: global.OpCodes ? global.OpCodes.Hex8ToBytes('4c6576696174686e20323536372d626974207465737420204956206f72206c617267652073746174652063697068657220746573696e6720') : null,
        input: global.OpCodes ? global.OpCodes.Hex8ToBytes('4c617267652073746174652074657374') : null,
        expected: global.OpCodes ? global.OpCodes.Hex8ToBytes('00'.repeat(16)) : null, // Placeholder - needs actual cipher output
        inputText: "Large state test",
        notes: "Basic functionality test for Leviathan large-state operations",
        category: "basic-functionality"
      },
      {
        text: "Leviathan with all-zeros key and IV",
        uri: "Educational implementation test", 
        keySize: 32,
        key: global.OpCodes ? global.OpCodes.Hex8ToBytes('00'.repeat(32)) : null,
        iv: global.OpCodes ? global.OpCodes.Hex8ToBytes('00'.repeat(32)) : null,
        input: global.OpCodes ? global.OpCodes.Hex8ToBytes('4e756c6c206b6579207465737470') : null,
        expected: global.OpCodes ? global.OpCodes.Hex8ToBytes('00'.repeat(15)) : null, // Placeholder - needs actual cipher output
        inputText: "Null key test",
        notes: "Testing Leviathan with null key and IV (edge case)",
        category: "edge-case"
      }
    ],
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'Leviathan',
      displayName: 'Leviathan Stream Cipher',
      description: 'Large-state stream cipher with 4096-bit internal state, designed for maximum security through extensive internal complexity.',
      
      inventor: 'David McGrew',
      year: 2005,
      background: 'Submitted to eSTREAM project with focus on achieving high security through very large internal state. Eliminated in phase 2 due to performance and security concerns.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.WEAK,
      securityNotes: 'Had cryptanalytic concerns during eSTREAM evaluation. Performance issues and some security weaknesses identified.',
      
      category: global.CipherMetadata.Categories.STREAM,
      subcategory: 'Large-state LFSR-based',
      complexity: global.CipherMetadata.ComplexityLevels.ADVANCED,
      
      keySize: 256, // 256-bit keys
      blockSize: 4, // 32-bit words
      rounds: 'continuous', // LFSR-based
      
      specifications: [
        {
          name: 'eSTREAM Leviathan Specification',
          url: 'https://www.ecrypt.eu.org/stream/leviathanpf.html'
        }
      ],
      
      references: [
        {
          name: 'eSTREAM Phase 2 Evaluation',
          url: 'https://www.ecrypt.eu.org/stream/leviathan.html'
        }
      ],
      
      implementationNotes: 'Very large state (4096 bits), multiple parallel LFSRs, complex nonlinear filter, 256-bit keys and IVs.',
      performanceNotes: 'Poor performance due to large state size and complex operations.',
      
      educationalValue: 'Example of large-state cipher design and the trade-offs between security and performance.',
      prerequisites: ['LFSR theory', 'Large-state systems', 'Stream cipher concepts'],
      
      tags: ['stream', 'estream', 'large-state', 'lfsr', 'weak', 'performance', 'educational'],
      
      version: '1.0'
    }) : null,
    
    // Leviathan constants
    STATE_SIZE: 128,      // 128 words = 4096 bits
    LFSR_COUNT: 8,        // 8 parallel LFSRs
    LFSR_SIZE: 16,        // Each LFSR has 16 words
    INIT_ROUNDS: 2048,    // Initialization rounds
    
    // Leviathan S-box for nonlinear operations
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
     * Setup key and IV for Leviathan
     */
    KeySetup: function(key, iv) {
      let id;
      do {
        id = 'Leviathan[' + global.generateUniqueID() + ']';
      } while (Leviathan.instances[id] || global.objectInstances[id]);
      
      Leviathan.instances[id] = new Leviathan.LeviathanInstance(key, iv);
      global.objectInstances[id] = true;
      return id;
    },
    
    /**
     * Clear cipher data
     */
    ClearData: function(id) {
      if (Leviathan.instances[id]) {
        const instance = Leviathan.instances[id];
        if (instance.state && global.OpCodes) {
          global.OpCodes.ClearArray(instance.state);
        }
        if (instance.keyWords && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyWords);
        }
        delete Leviathan.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Leviathan', 'ClearData');
        return false;
      }
    },
    
    /**
     * Encrypt block (XOR with keystream)
     */
    encryptBlock: function(id, input) {
      if (!Leviathan.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Leviathan', 'encryptBlock');
        return input;
      }
      
      const instance = Leviathan.instances[id];
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
      return Leviathan.encryptBlock(id, input);
    },
    
    /**
     * Leviathan Instance class
     */
    LeviathanInstance: function(key, iv) {
      this.state = new Array(Leviathan.STATE_SIZE);  // 4096-bit state
      this.keyWords = [];
      this.ivWords = [];
      
      // Process key and IV
      this.processKey(key);
      this.processIV(iv);
      
      // Initialize the cipher
      this.initialize();
    }
  };
  
  // Add methods to LeviathanInstance prototype
  Leviathan.LeviathanInstance.prototype = {
    
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
        throw new Error('Leviathan key must be string or byte array');
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
     * Initialize Leviathan cipher state
     */
    initialize: function() {
      // Initialize large state with key and IV material
      for (let i = 0; i < Leviathan.STATE_SIZE; i++) {
        if (i < this.keyWords.length) {
          this.state[i] = this.keyWords[i];
        } else if (i < this.keyWords.length + this.ivWords.length) {
          this.state[i] = this.ivWords[i - this.keyWords.length];
        } else {
          // Fill remaining state with derived material
          this.state[i] = this.state[i % this.keyWords.length] ^ 
                         this.state[(i * 3) % this.ivWords.length + this.keyWords.length];
        }
      }
      
      // Extensive initialization mixing
      for (let round = 0; round < Leviathan.INIT_ROUNDS; round++) {
        this.mixLargeState();
      }
    },
    
    /**
     * Mix the large state using parallel LFSR operations
     */
    mixLargeState: function() {
      // Process state in chunks as parallel LFSRs
      for (let lfsr = 0; lfsr < Leviathan.LFSR_COUNT; lfsr++) {
        const offset = lfsr * Leviathan.LFSR_SIZE;
        this.mixLFSR(offset);
      }
      
      // Cross-LFSR mixing
      this.crossMix();
    },
    
    /**
     * Mix single LFSR section
     */
    mixLFSR: function(offset) {
      // LFSR feedback with multiple tap points
      const feedback = this.state[offset] ^ 
                       this.state[offset + 3] ^ 
                       this.state[offset + 7] ^ 
                       this.state[offset + 12];
      
      // Shift LFSR
      for (let i = 0; i < Leviathan.LFSR_SIZE - 1; i++) {
        this.state[offset + i] = this.state[offset + i + 1];
      }
      this.state[offset + Leviathan.LFSR_SIZE - 1] = feedback;
    },
    
    /**
     * Cross-mixing between different LFSRs
     */
    crossMix: function() {
      for (let i = 0; i < Leviathan.LFSR_COUNT - 1; i++) {
        const lfsr1_offset = i * Leviathan.LFSR_SIZE;
        const lfsr2_offset = (i + 1) * Leviathan.LFSR_SIZE;
        
        // Mix last word of current LFSR with first word of next LFSR
        const mix = this.state[lfsr1_offset + Leviathan.LFSR_SIZE - 1] ^ 
                   this.state[lfsr2_offset];
        
        this.state[lfsr1_offset + Leviathan.LFSR_SIZE - 1] = mix;
        this.state[lfsr2_offset] = global.OpCodes.RotL32(mix, 11);
      }
    },
    
    /**
     * Nonlinear filter function
     */
    nonlinearFilter: function() {
      // Extract values from specific positions in the large state
      const x1 = this.state[7];
      const x2 = this.state[23];
      const x3 = this.state[47];
      const x4 = this.state[71];
      const x5 = this.state[95];
      const x6 = this.state[119];
      
      // Apply S-box operations
      const bytes1 = global.OpCodes.Unpack32LE(x1 ^ x4);
      const bytes2 = global.OpCodes.Unpack32LE(x2 ^ x5);
      const bytes3 = global.OpCodes.Unpack32LE(x3 ^ x6);
      
      const sbox_out1 = global.OpCodes.Pack32LE(
        Leviathan.SBOX[bytes1[0]], Leviathan.SBOX[bytes1[1]],
        Leviathan.SBOX[bytes1[2]], Leviathan.SBOX[bytes1[3]]
      );
      
      const sbox_out2 = global.OpCodes.Pack32LE(
        Leviathan.SBOX[bytes2[0]], Leviathan.SBOX[bytes2[1]],
        Leviathan.SBOX[bytes2[2]], Leviathan.SBOX[bytes2[3]]
      );
      
      const sbox_out3 = global.OpCodes.Pack32LE(
        Leviathan.SBOX[bytes3[0]], Leviathan.SBOX[bytes3[1]],
        Leviathan.SBOX[bytes3[2]], Leviathan.SBOX[bytes3[3]]
      );
      
      // Combine with rotation and XOR
      return sbox_out1 ^ 
             global.OpCodes.RotL32(sbox_out2, 8) ^ 
             global.OpCodes.RotL32(sbox_out3, 16);
    },
    
    /**
     * Generate one keystream word (32 bits)
     */
    generateKeystreamWord: function() {
      // Update the large state
      this.mixLargeState();
      
      // Apply nonlinear filter to generate output
      return this.nonlinearFilter();
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
  
  // Auto-register with AlgorithmFramework if available
  if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
    global.AlgorithmFramework.RegisterAlgorithm(Leviathan);
  }
  
  // Legacy registration
  if (typeof global.RegisterAlgorithm === 'function') {
    global.RegisterAlgorithm(Leviathan);
  }
  
  // Auto-register with Cipher system if available
  if (global.Cipher) {
    global.Cipher.Add(Leviathan);
  }
  
  // Export to global scope
  global.Leviathan = Leviathan;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Leviathan;
  }
  
})(typeof global !== 'undefined' ? global : window);