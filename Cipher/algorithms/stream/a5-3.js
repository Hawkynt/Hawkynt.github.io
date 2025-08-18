#!/usr/bin/env node
/*
 * Universal A5/3 Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on the 3GPP A5/3 specification using KASUMI
 * (c)2006-2025 Hawkynt
 * 
 * A5/3 is a stream cipher used in 3G mobile communications (UMTS).
 * It is based on the KASUMI block cipher operated in OFB-like mode.
 * The algorithm uses:
 * - 128-bit keys (derived from 128-bit Kc)
 * - KASUMI block cipher as the core primitive
 * - 5-bit COUNT-C and 1-bit BEARER parameters
 * - Direction bit (uplink/downlink)
 * - Output up to 20000 bits of keystream
 * 
 * This implementation is simplified for educational purposes only.
 * Real A5/3 implementations should follow 3GPP TS 55.216 exactly.
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
      console.error('A5/3 cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create A5/3 cipher object
  const A5_3 = {
    internalName: 'a5-3',
    name: 'A5/3',
    version: '1.0',
    author: '3GPP (UMTS/LTE)',
    description: 'KASUMI-based stream cipher for 3G mobile communications',

    // Required by cipher system
    minKeyLength: 1,
    maxKeyLength: 1024,
    stepKeyLength: 1,
    minBlockSize: 1,
    maxBlockSize: 1024,
    stepBlockSize: 1,
    instances: {},
    
    // Cipher parameters
    nBlockSizeInBits: 64,    // KASUMI block size
    nKeySizeInBits: 128,     // 128-bit key
    
    // A5/3 specific parameters
    MAX_OUTPUT_BITS: 20000,  // Maximum keystream length
    
    // Simplified KASUMI S-boxes (subset for educational purposes)
    S7: [
      54, 50, 62, 56, 22, 34, 94, 96, 38, 6, 63, 93, 2, 18, 123, 33,
      55, 113, 39, 114, 21, 67, 65, 12, 47, 73, 46, 27, 25, 111, 124, 81,
      53, 9, 121, 79, 52, 60, 58, 48, 101, 127, 40, 120, 104, 70, 71, 43,
      20, 122, 72, 61, 23, 109, 13, 100, 77, 1, 16, 7, 82, 10, 105, 98,
      117, 116, 76, 11, 89, 106, 0, 125, 118, 99, 86, 69, 30, 57, 126, 87,
      112, 51, 17, 5, 95, 14, 90, 84, 91, 8, 35, 103, 32, 97, 28, 66,
      102, 31, 26, 45, 75, 4, 85, 92, 37, 74, 80, 49, 68, 29, 115, 44,
      64, 107, 108, 24, 110, 83, 36, 78, 42, 19, 15, 41, 88, 119, 59, 3
    ],
    
    S9: [
      167, 239, 161, 379, 391, 334, 9, 338, 38, 226, 48, 358, 452, 385, 90, 397,
      183, 253, 147, 331, 415, 340, 51, 362, 306, 500, 262, 82, 216, 159, 356, 177,
      175, 241, 489, 37, 206, 17, 0, 333, 44, 254, 378, 58, 143, 220, 81, 400,
      95, 3, 315, 245, 54, 235, 218, 405, 472, 264, 172, 494, 371, 290, 399, 76,
      165, 197, 395, 121, 257, 480, 423, 212, 240, 28, 462, 176, 406, 507, 288, 223,
      501, 407, 249, 265, 89, 186, 221, 428, 164, 74, 440, 196, 458, 421, 350, 163,
      232, 158, 134, 354, 13, 250, 491, 142, 191, 69, 193, 425, 152, 227, 366, 135,
      344, 300, 276, 242, 437, 320, 113, 278, 11, 243, 87, 317, 36, 93, 496, 27,
      487, 446, 482, 41, 68, 156, 457, 131, 326, 403, 339, 20, 39, 115, 442, 124,
      475, 384, 508, 53, 112, 170, 479, 151, 126, 169, 73, 268, 279, 321, 168, 364,
      363, 292, 46, 499, 393, 327, 324, 24, 456, 267, 157, 460, 488, 426, 309, 229,
      439, 506, 208, 271, 349, 401, 434, 236, 16, 209, 359, 52, 56, 120, 199, 277,
      465, 416, 252, 287, 246, 6, 83, 305, 420, 345, 153, 502, 65, 61, 244, 282,
      173, 222, 418, 67, 386, 368, 261, 101, 476, 291, 195, 430, 49, 79, 166, 330,
      280, 383, 373, 128, 382, 408, 155, 495, 367, 388, 274, 107, 459, 417, 62, 454,
      132, 225, 203, 316, 234, 14, 301, 91, 503, 286, 424, 469, 207, 194, 346, 124,
      // ... (truncated for brevity in educational implementation)
    ],
    
    // Internal state
    key: null,
    count: 0,
    bearer: 0,
    direction: 0,
    keystreamBuffer: [],
    bufferPosition: 0,
    isInitialized: false,
    
    /**
     * Initialize cipher with empty state
     */
    Init: function() {
      this.key = new Array(16).fill(0);
      this.count = 0;
      this.bearer = 0;
      this.direction = 0;
      this.keystreamBuffer = [];
      this.bufferPosition = 0;
      this.isInitialized = false;
      return true;
    },
    
    /**
     * Setup key and parameters for A5/3
     * @param {Array} key - 128-bit key as byte array (16 bytes)
     * @param {Object} params - Additional parameters {count, bearer, direction}
     */
    KeySetup: function(key, params = {}) {
      if (!key || key.length !== 16) {
        throw new Error('A5/3 requires 128-bit (16 byte) key');
      }
      
      // Initialize state
      this.Init();
      
      // Store key
      this.key = key.slice();
      
      // Set parameters
      this.count = (params.count || 0) & 0x1F;     // 5 bits
      this.bearer = (params.bearer || 0) & 0x1F;   // 5 bits
      this.direction = (params.direction || 0) & 1; // 1 bit
      
      // Generate initial keystream
      this.generateKeystreamBlock();
      
      this.isInitialized = true;
      return true;
    },
    
    /**
     * Simplified KASUMI FO function (educational version)
     * @param {number} left - Left 32-bit half
     * @param {number} right - Right 32-bit half
     * @param {Array} roundKey - Round key bytes
     * @returns {Object} {left, right} - Updated halves
     */
    kasumiF0: function(left, right, roundKey) {
      // Extract key material
      const k1 = OpCodes.Pack32BE(roundKey[0], roundKey[1], roundKey[2], roundKey[3]);
      const k2 = OpCodes.Pack32BE(roundKey[4], roundKey[5], roundKey[6], roundKey[7]);
      
      // Simplified F0 function
      let temp = left ^ k1;
      
      // Apply S-boxes (simplified)
      const s1 = this.S7[(temp >>> 25) & 0x7F];
      const s2 = this.S9[(temp >>> 16) & 0x1FF];
      const s3 = this.S7[(temp >>> 9) & 0x7F];
      const s4 = this.S9[temp & 0x1FF];
      
      temp = ((s1 << 25) | (s2 << 16) | (s3 << 9) | s4) >>> 0;
      
      // Linear transformation
      temp = OpCodes.RotL32(temp, 1) ^ k2;
      
      return {
        left: right,
        right: left ^ temp
      };
    },
    
    /**
     * Simplified KASUMI encryption (educational version)
     * @param {Array} plaintext - 8 bytes of plaintext
     * @returns {Array} 8 bytes of ciphertext
     */
    kasumiEncrypt: function(plaintext) {
      if (plaintext.length !== 8) {
        throw new Error('KASUMI requires 8-byte blocks');
      }
      
      // Split into two 32-bit halves
      let left = OpCodes.Pack32BE(plaintext[0], plaintext[1], plaintext[2], plaintext[3]);
      let right = OpCodes.Pack32BE(plaintext[4], plaintext[5], plaintext[6], plaintext[7]);
      
      // Simplified 8-round Feistel network
      for (let round = 0; round < 8; round++) {
        // Use key material cyclically
        const roundKey = this.key.slice(round * 2, (round * 2) + 8);
        if (roundKey.length < 8) {
          // Pad with key material from beginning
          while (roundKey.length < 8) {
            roundKey.push(this.key[roundKey.length % 16]);
          }
        }
        
        const result = this.kasumiF0(left, right, roundKey);
        left = result.left;
        right = result.right;
      }
      
      // Combine halves and return as bytes
      const leftBytes = OpCodes.Unpack32BE(left);
      const rightBytes = OpCodes.Unpack32BE(right);
      
      return [...leftBytes, ...rightBytes];
    },
    
    /**
     * Generate A5/3 keystream block
     */
    generateKeystreamBlock: function() {
      // Construct KASUMI input according to A5/3 specification
      // Input = COUNT-C || BEARER || DIRECTION || 0...0 (64 bits total)
      const input = new Array(8).fill(0);
      
      // Set COUNT-C (5 bits) in upper part
      input[0] = (this.count << 3) & 0xF8;
      
      // Set BEARER (5 bits)
      input[0] |= (this.bearer >>> 2) & 0x07;
      input[1] = (this.bearer << 6) & 0xC0;
      
      // Set DIRECTION (1 bit)
      input[1] |= (this.direction << 5) & 0x20;
      
      // Remaining bits are zero (already filled)
      
      // Encrypt using KASUMI to generate keystream
      const keystreamBlock = this.kasumiEncrypt(input);
      
      // Add to buffer
      this.keystreamBuffer.push(...keystreamBlock);
    },
    
    /**
     * Get keystream bytes
     * @param {number} length - Number of bytes needed
     * @returns {Array} Keystream bytes
     */
    getKeystream: function(length) {
      const result = [];
      
      while (result.length < length) {
        // Check if we need more keystream
        if (this.bufferPosition >= this.keystreamBuffer.length) {
          // Check maximum output limit
          if (this.keystreamBuffer.length >= (this.MAX_OUTPUT_BITS / 8)) {
            throw new Error('A5/3 maximum keystream length exceeded');
          }
          
          this.generateKeystreamBlock();
        }
        
        // Get byte from buffer
        result.push(this.keystreamBuffer[this.bufferPosition]);
        this.bufferPosition++;
      }
      
      return result;
    },
    
    /**
     * Encrypt block using A5/3
     * @param {number} position - Block position (updates count)
     * @param {string} input - Input data as string
     * @returns {string} Encrypted data as string
     */
    encryptBlock: function(position, input) {
      if (!this.isInitialized) {
        throw new Error('Cipher not initialized');
      }
      
      // Update count for this position (simplified)
      this.count = (position % 32);
      
      const inputBytes = OpCodes.StringToBytes(input);
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
     * Set A5/3 parameters
     * @param {Object} params - {count, bearer, direction}
     */
    setParameters: function(params) {
      this.count = (params.count || 0) & 0x1F;
      this.bearer = (params.bearer || 0) & 0x1F;
      this.direction = (params.direction || 0) & 1;
      
      // Reset keystream generation
      this.keystreamBuffer = [];
      this.bufferPosition = 0;
      
      if (this.isInitialized) {
        this.generateKeystreamBlock();
      }
    },
    
    /**
     * Get current parameters
     * @returns {Object} Current parameters
     */
    getParameters: function() {
      return {
        count: this.count,
        bearer: this.bearer,
        direction: this.direction,
        keystreamGenerated: this.keystreamBuffer.length
      };
    },
    
    /**
     * Clear sensitive data
     */
    ClearData: function() {
      if (this.key) {
        OpCodes.ClearArray(this.key);
        this.key = null;
      }
      if (this.keystreamBuffer) {
        OpCodes.ClearArray(this.keystreamBuffer);
        this.keystreamBuffer = [];
      }
      this.count = 0;
      this.bearer = 0;
      this.direction = 0;
      this.bufferPosition = 0;
      this.isInitialized = false;
    }
  };
  
  // Auto-register with Cipher system
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(A5_3);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = A5_3;
  }
  
  // Make available globally
  global.A5_3 = A5_3;
  
})(typeof global !== 'undefined' ? global : window);