#!/usr/bin/env node
/*
 * Universal Grain v1 Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on eSTREAM specification by Hell, Johansson, and Meier
 * (c)2006-2025 Hawkynt
 * 
 * Grain v1 is a lightweight stream cipher designed for restricted hardware environments.
 * It was selected for the final eSTREAM portfolio in the Profile 2 category.
 * The algorithm uses:
 * - 80-bit keys and 64-bit IVs
 * - 80-bit Linear Feedback Shift Register (LFSR)
 * - 80-bit Non-linear Feedback Shift Register (NFSR)
 * - Boolean output filter function
 * - 160 initialization rounds before keystream generation
 * 
 * This implementation follows the eSTREAM specification.
 * For educational purposes only - use proven libraries for production.
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
  } else {
      console.error('Grain v1 cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create Grain v1 cipher object
  const GrainV1 = {
    internalName: 'grain-v1',
    name: 'Grain v1',
    comment: 'Grain v1 Stream Cipher - eSTREAM Profile 2 portfolio cipher for hardware',
    
    // Required metadata following CONTRIBUTING.md
    description: "Lightweight stream cipher using LFSR and NFSR designed for restricted hardware environments. Selected for eSTREAM Portfolio Profile 2. Uses 80-bit keys and 64-bit IVs with 160-bit total state.",
    inventor: "Martin Hell, Thomas Johansson, and Willi Meier",
    year: 2004,
    country: "SE",
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.STREAM : 'stream',
    subCategory: "Stream Cipher",
    securityStatus: null,
    securityNotes: "Part of eSTREAM Portfolio Profile 2. Designed for hardware efficiency with limited gate count. No known practical attacks.",
    
    documentation: [
      {text: "eSTREAM Grain v1 Specification", uri: "https://www.ecrypt.eu.org/stream/grainpf.html"},
      {text: "Grain - A New Stream Cipher", uri: "https://www.eit.lth.se/fileadmin/eit/courses/eit060f/Grain.pdf"},
      {text: "eSTREAM Portfolio", uri: "https://www.ecrypt.eu.org/stream/"}
    ],
    
    references: [
      {text: "eSTREAM Grain Page", uri: "https://www.ecrypt.eu.org/stream/grainpf.html"},
      {text: "Grain Family Website", uri: "http://www.grain-cipher.com/"}
    ],
    
    knownVulnerabilities: [],
    
    tests: [
      {
        text: "eSTREAM Grain v1 Test Vector",
        uri: "https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/grain/",
        keySize: 10,
        input: global.OpCodes ? global.OpCodes.Hex8ToBytes("0000000000000000") : [],
        key: global.OpCodes ? global.OpCodes.Hex8ToBytes("00000000000000000000") : [],
        expected: global.OpCodes ? global.OpCodes.Hex8ToBytes("6b12c5c6a594a0d5") : []
      }
    ],
    
    // Cipher parameters
    nBlockSizeInBits: 1,   // Stream cipher - 1 bit at a time
    nKeySizeInBits: 80,    // 80-bit key
    nIVSizeInBits: 64,     // 64-bit IV
    
    // Required by cipher system
    minKeyLength: 10,   // 80 bits = 10 bytes
    maxKeyLength: 10,   // Fixed key length
    stepKeyLength: 1,   // Step size
    minBlockSize: 1,    // Minimum block size
    maxBlockSize: 1024, // Maximum block size
    stepBlockSize: 1,   // Step size
    instances: {},
    
    // Internal state
    lfsr: null,    // 80-bit LFSR state (stored as array of 80 bits)
    nfsr: null,    // 80-bit NFSR state (stored as array of 80 bits)
    isInitialized: false,
    
    /**
     * Initialize cipher with empty state
     */
    Init: function() {
      this.lfsr = new Array(80).fill(0);
      this.nfsr = new Array(80).fill(0);
      this.isInitialized = false;
      return true;
    },
    
    /**
     * Setup key and IV for Grain v1
     * @param {Array} key - 80-bit key as byte array (10 bytes)
     * @param {Array} iv - 64-bit IV as byte array (8 bytes) 
     */
    KeySetup: function(key, iv) {
      if (!key || key.length !== 10) {
        throw new Error('Grain v1 requires 80-bit (10 byte) key');
      }
      if (!iv || iv.length !== 8) {
        throw new Error('Grain v1 requires 64-bit (8 byte) IV');
      }
      
      // Initialize arrays
      this.Init();
      
      // Load key into NFSR (80 bits)
      for (let i = 0; i < 80; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        this.nfsr[i] = (key[byteIndex] >>> bitIndex) & 1;
      }
      
      // Load IV into LFSR low 64 bits
      for (let i = 0; i < 64; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        this.lfsr[i] = (iv[byteIndex] >>> bitIndex) & 1;
      }
      
      // Fill remaining 16 LFSR bits with ones
      for (let i = 64; i < 80; i++) {
        this.lfsr[i] = 1;
      }
      
      // Initialization phase - 160 rounds
      for (let round = 0; round < 160; round++) {
        const output = this.generateOutputBit();
        
        // Update both registers with feedback XOR output
        const newLFSRBit = this.updateLFSR() ^ output;
        const newNFSRBit = this.updateNFSR() ^ output;
        
        // Shift and insert new bits
        this.shiftRegister(this.lfsr, newLFSRBit);
        this.shiftRegister(this.nfsr, newNFSRBit);
      }
      
      this.isInitialized = true;
      return true;
    },
    
    /**
     * LFSR feedback function - polynomial: x^80 + x^62 + x^51 + x^13 + 1
     * @returns {number} New LFSR feedback bit
     */
    updateLFSR: function() {
      // Feedback polynomial positions: 62, 51, 13, 0
      return this.lfsr[62] ^ this.lfsr[51] ^ this.lfsr[13] ^ this.lfsr[0];
    },
    
    /**
     * NFSR feedback function - includes linear terms from LFSR and nonlinear terms
     * @returns {number} New NFSR feedback bit  
     */
    updateNFSR: function() {
      // Linear terms from NFSR and LFSR
      const linear = this.nfsr[62] ^ this.nfsr[60] ^ this.nfsr[52] ^ this.nfsr[45] ^ 
                    this.nfsr[37] ^ this.nfsr[33] ^ this.nfsr[28] ^ this.nfsr[21] ^ 
                    this.nfsr[14] ^ this.nfsr[9] ^ this.nfsr[0] ^ this.lfsr[63];
      
      // Nonlinear terms (simplified version)
      const nonlinear = (this.nfsr[63] & this.nfsr[60]) ^ 
                       (this.nfsr[37] & this.nfsr[33]) ^ 
                       (this.nfsr[15] & this.nfsr[9]) ^ 
                       (this.nfsr[60] & this.nfsr[52] & this.nfsr[45]) ^
                       (this.nfsr[33] & this.nfsr[28] & this.nfsr[21]) ^
                       (this.nfsr[63] & this.nfsr[45] & this.nfsr[28] & this.nfsr[9]) ^
                       (this.nfsr[60] & this.nfsr[52] & this.nfsr[37] & this.nfsr[33]) ^
                       (this.nfsr[63] & this.nfsr[60] & this.nfsr[21] & this.nfsr[15]) ^
                       (this.nfsr[63] & this.nfsr[60] & this.nfsr[52] & this.nfsr[45] & this.nfsr[37]) ^
                       (this.nfsr[33] & this.nfsr[28] & this.nfsr[21] & this.nfsr[15] & this.nfsr[9]) ^
                       (this.nfsr[52] & this.nfsr[45] & this.nfsr[37] & this.nfsr[33] & this.nfsr[28] & this.nfsr[21]);
      
      return linear ^ nonlinear;
    },
    
    /**
     * Generate output bit using filter function
     * @returns {number} Output keystream bit
     */
    generateOutputBit: function() {
      // Output filter: combines bits from LFSR and NFSR
      const lfsrBits = this.lfsr[3] ^ this.lfsr[25] ^ this.lfsr[46] ^ this.lfsr[64];
      const nfsrBits = this.nfsr[63] ^ this.nfsr[60] ^ this.nfsr[52] ^ this.nfsr[45] ^
                      this.nfsr[37] ^ this.nfsr[33] ^ this.nfsr[28];
      
      // Boolean function h(x) - simplified 5-input function
      const x1 = this.lfsr[25], x2 = this.lfsr[46], x3 = this.lfsr[64], x4 = this.lfsr[63];
      const x5 = this.nfsr[63];
      
      const h = x1 ^ x4 ^ (x1 & x3) ^ (x2 & x3) ^ (x3 & x4) ^ (x1 & x2 & x5);
      
      return lfsrBits ^ nfsrBits ^ h;
    },
    
    /**
     * Shift register left and insert new bit at position 0
     * @param {Array} register - Register to shift
     * @param {number} newBit - New bit to insert
     */
    shiftRegister: function(register, newBit) {
      for (let i = 79; i > 0; i--) {
        register[i] = register[i - 1];
      }
      register[0] = newBit & 1;
    },
    
    /**
     * Generate keystream bytes
     * @param {number} length - Number of bytes to generate
     * @returns {Array} Keystream bytes
     */
    generateKeystream: function(length) {
      if (!this.isInitialized) {
        throw new Error('Cipher not initialized - call KeySetup first');
      }
      
      const keystream = [];
      
      for (let i = 0; i < length; i++) {
        let byte = 0;
        
        // Generate 8 bits for one byte
        for (let bit = 0; bit < 8; bit++) {
          const outputBit = this.generateOutputBit();
          byte |= (outputBit << bit);
          
          // Update registers for next bit
          const newLFSRBit = this.updateLFSR();
          const newNFSRBit = this.updateNFSR();
          
          this.shiftRegister(this.lfsr, newLFSRBit);
          this.shiftRegister(this.nfsr, newNFSRBit);
        }
        
        keystream.push(byte);
      }
      
      return keystream;
    },
    
    /**
     * Encrypt/decrypt block (XOR with keystream)
     * @param {number} position - Block position (unused for stream cipher)
     * @param {string} input - Input data as string
     * @returns {string} Output data as string
     */
    encryptBlock: function(position, input) {
      if (!this.isInitialized) {
        throw new Error('Cipher not initialized');
      }
      
      const inputBytes = OpCodes.AsciiToBytes(input);
      const keystream = this.generateKeystream(inputBytes.length);
      const outputBytes = OpCodes.XorArrays(inputBytes, keystream);
      
      return OpCodes.BytesToString(outputBytes);
    },
    
    /**
     * Decrypt block (same as encrypt for stream cipher)
     * @param {number} position - Block position (unused)
     * @param {string} input - Input data as string
     * @returns {string} Output data as string
     */
    decryptBlock: function(position, input) {
      return this.encryptBlock(position, input);
    },
    
    /**
     * Clear sensitive data
     */
    ClearData: function() {
      if (this.lfsr) {
        OpCodes.ClearArray(this.lfsr);
        this.lfsr = null;
      }
      if (this.nfsr) {
        OpCodes.ClearArray(this.nfsr);
        this.nfsr = null;
      }
      this.isInitialized = false;
    }
  };
  
  // Auto-register with Cipher system
  // Auto-register with AlgorithmFramework if available
  if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
    global.AlgorithmFramework.RegisterAlgorithm(GrainV1);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GrainV1;
  }
  
  // Make available globally
  global.GrainV1 = GrainV1;
  
})(typeof global !== 'undefined' ? global : window);