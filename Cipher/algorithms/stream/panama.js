/*
 * PANAMA Stream Cipher Implementation
 * (c)2006-2025 Hawkynt
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
      console.error('PANAMA cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  const PANAMA = {
    name: "PANAMA",
    description: "Dual-purpose cryptographic primitive that can function as both a hash function and stream cipher. This implementation provides stream cipher functionality with 256-bit keys and high-performance design. The hash function mode has known collisions.",
    inventor: "Joan Daemen, Craig Clapp",
    year: 1998,
    country: "BE",
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.STREAM : 'stream',
    subCategory: "Stream Cipher",
    securityStatus: "insecure",
    securityNotes: "Hash function mode has known collisions discovered by Vincent Rijmen and others. Stream cipher mode lacks thorough cryptanalysis. Not recommended for production use.",
    
    documentation: [
      {text: "PANAMA Specification (FSE 1998)", uri: "https://link.springer.com/chapter/10.1007/3-540-69710-1_5"},
      {text: "Cryptanalysis by Vincent Rijmen", uri: "https://www.cosic.esat.kuleuven.be/publications/article-40.pdf"}
    ],
    
    references: [
      {text: "Original PANAMA Implementation", uri: "https://www.esat.kuleuven.be/cosic/panama/"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Hash Collision", 
        text: "Hash function mode vulnerable to collision attacks found by Vincent Rijmen",
        mitigation: "Use only stream cipher mode, avoid hash functionality"
      }
    ],
    
    tests: [
      {
        text: "Basic Stream Cipher Test",
        uri: "Educational test vector",
        keySize: 32,
        key: OpCodes.Hex8ToBytes("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: [] // Will be filled during implementation validation
      }
    ],

    // Required by cipher system
    minKeyLength: 1,
    maxKeyLength: 1024,
    stepKeyLength: 1,
    minBlockSize: 1,
    maxBlockSize: 1024,
    stepBlockSize: 1,
    instances: {},
    
    // Cipher parameters
    nBlockSizeInBits: 256,    // 32 bytes per block
    nKeySizeInBits: 256,      // 256-bit key
    
    // Internal state - 17 32-bit words
    state: null,
    buffer: null,
    bufferPos: 0,
    isInitialized: false,
    
    /**
     * Initialize cipher with empty state
     */
    Init: function() {
      this.state = new Array(17).fill(0);
      this.buffer = new Array(32).fill(0);
      this.bufferPos = 0;
      this.isInitialized = false;
      return true;
    },
    
    /**
     * Setup key for PANAMA stream cipher
     * @param {Array} key - 256-bit key as byte array (32 bytes)
     */
    KeySetup: function(key) {
      if (!key || key.length !== 32) {
        throw new Error('PANAMA requires 256-bit (32 byte) key');
      }
      
      // Initialize state
      this.Init();
      
      // Load key into state as 8 32-bit words
      for (let i = 0; i < 8; i++) {
        this.state[i] = OpCodes.Pack32LE(
          key[i * 4], 
          key[i * 4 + 1], 
          key[i * 4 + 2], 
          key[i * 4 + 3]
        );
      }
      
      // Initialize remaining state words
      for (let i = 8; i < 17; i++) {
        this.state[i] = 0;
      }
      
      // Perform initialization rounds
      for (let round = 0; round < 32; round++) {
        this.updateState();
      }
      
      this.isInitialized = true;
      return true;
    },
    
    /**
     * PANAMA state update function (simplified version of the full algorithm)
     */
    updateState: function() {
      // Save original state
      const oldState = this.state.slice();
      
      // Gamma transformation (non-linear transformation)
      for (let i = 0; i < 17; i++) {
        this.state[i] = oldState[i] ^ 
                       (oldState[(i + 1) % 17] | ~oldState[(i + 2) % 17]);
      }
      
      // Pi transformation (word rotation)
      const temp = this.state.slice();
      this.state[0] = temp[7];
      this.state[1] = OpCodes.RotL32(temp[0], 1);
      this.state[2] = OpCodes.RotL32(temp[1], 3);
      this.state[3] = OpCodes.RotL32(temp[2], 6);
      this.state[4] = OpCodes.RotL32(temp[3], 10);
      this.state[5] = OpCodes.RotL32(temp[4], 15);
      this.state[6] = OpCodes.RotL32(temp[5], 21);
      this.state[7] = OpCodes.RotL32(temp[6], 28);
      
      for (let i = 8; i < 17; i++) {
        this.state[i] = OpCodes.RotL32(temp[i], ((i - 8) * 7) % 32);
      }
      
      // Theta transformation (linear mixing)
      for (let i = 0; i < 17; i++) {
        this.state[i] ^= this.state[(i + 2) % 17] ^ this.state[(i + 15) % 17];
      }
    },
    
    /**
     * Generate keystream block
     * @returns {Array} 32 bytes of keystream
     */
    generateKeystreamBlock: function() {
      if (!this.isInitialized) {
        throw new Error('Cipher not initialized - call KeySetup first');
      }
      
      // Update state to generate new keystream
      this.updateState();
      
      // Extract keystream from state (use first 8 words = 32 bytes)
      const keystream = [];
      for (let i = 0; i < 8; i++) {
        const bytes = OpCodes.Unpack32LE(this.state[i]);
        keystream.push(...bytes);
      }
      
      return keystream;
    },
    
    /**
     * Get keystream bytes
     * @param {number} length - Number of bytes needed
     * @returns {Array} Keystream bytes
     */
    getKeystream: function(length) {
      const result = [];
      
      while (result.length < length) {
        // Check if we need more keystream in buffer
        if (this.bufferPos >= this.buffer.length) {
          this.buffer = this.generateKeystreamBlock();
          this.bufferPos = 0;
        }
        
        // Copy bytes from buffer
        const bytesToCopy = Math.min(length - result.length, 
                                   this.buffer.length - this.bufferPos);
        
        for (let i = 0; i < bytesToCopy; i++) {
          result.push(this.buffer[this.bufferPos + i]);
        }
        
        this.bufferPos += bytesToCopy;
      }
      
      return result;
    },
    
    /**
     * Encrypt block using PANAMA stream cipher
     * @param {number} position - Block position (used for stream position)
     * @param {string} input - Input data as string
     * @returns {string} Encrypted data as string
     */
    encryptBlock: function(position, input) {
      if (!this.isInitialized) {
        throw new Error('Cipher not initialized');
      }
      
      const inputBytes = OpCodes.AsciiToBytes(input);
      const keystream = this.getKeystream(inputBytes.length);
      const outputBytes = OpCodes.XorArrays(inputBytes, keystream);
      
      return OpCodes.BytesToString(outputBytes);
    },
    
    /**
     * Decrypt block (same as encrypt for stream cipher)
     * @param {number} position - Block position
     * @param {string} input - Input data as string
     * @returns {string} Decrypted data as string
     */
    decryptBlock: function(position, input) {
      return this.encryptBlock(position, input);
    },
    
    /**
     * Clear sensitive data
     */
    ClearData: function() {
      if (this.state) {
        OpCodes.ClearArray(this.state);
        this.state = null;
      }
      if (this.buffer) {
        OpCodes.ClearArray(this.buffer);
        this.buffer = null;
      }
      this.bufferPos = 0;
      this.isInitialized = false;
    }
  };
  
  // Auto-register with Subsystem (according to category) if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(PANAMA);
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PANAMA;
  }
  
  // Make available globally
  global.PANAMA = PANAMA;
  
})(typeof global !== 'undefined' ? global : window);