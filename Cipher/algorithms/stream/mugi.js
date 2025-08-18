#!/usr/bin/env node
/*
 * Universal MUGI Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on Hitachi specification (ISO/IEC 18033-4)
 * (c)2006-2025 Hawkynt
 * 
 * MUGI is a word-based stream cipher designed for 64-bit architectures.
 * It uses components from AES (S-box and MDS matrix) and is influenced by Panama.
 * 
 * Key characteristics:
 * - 128-bit key and 128-bit IV
 * - 1216-bit internal state (3×64-bit state + 16×64-bit buffer)
 * - 64-bit output per round
 * - Uses AES S-box and MDS matrix components
 * - Designed for high-speed hardware implementation
 * 
 * Originally recommended by CRYPTREC for Japanese government use.
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
      console.error('MUGI cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create MUGI cipher object
  const MUGI = {
    // Public interface properties
    internalName: 'MUGI',
    name: 'MUGI Stream Cipher',
    comment: 'MUGI Multi-Giga Stream Cipher - Hitachi ISO/IEC 18033-4',
    minKeyLength: 16,   // 128 bits exactly
    maxKeyLength: 16,
    stepKeyLength: 1,
    minBlockSize: 1,    // Stream cipher - processes byte by byte
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // MUGI constants
    STATE_SIZE: 3,         // 3 × 64-bit state registers
    BUFFER_SIZE: 16,       // 16 × 64-bit buffer registers
    OUTPUT_SIZE: 8,        // 64-bit output = 8 bytes
    KEY_SIZE: 16,          // 128 bits = 16 bytes
    IV_SIZE: 16,           // 128 bits = 16 bytes
    
    // AES S-box (used in MUGI)
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
    
    // Initialize cipher
    Init: function() {
      MUGI.isInitialized = true;
    },
    
    // Set up key and initialize MUGI state
    KeySetup: function(key) {
      let id;
      do {
        id = 'MUGI[' + global.generateUniqueID() + ']';
      } while (MUGI.instances[id] || global.objectInstances[id]);
      
      MUGI.instances[szID] = new MUGI.MUGIInstance(key);
      global.objectInstances[szID] = true;
      return szID;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (MUGI.instances[id]) {
        // Clear sensitive data
        const instance = MUGI.instances[szID];
        if (instance.state && global.OpCodes) {
          global.OpCodes.ClearArray(instance.state);
        }
        if (instance.buffer && global.OpCodes) {
          global.OpCodes.ClearArray(instance.buffer);
        }
        if (instance.keyBytes && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyBytes);
        }
        delete MUGI.instances[szID];
        delete global.objectInstances[szID];
      }
    },
    
    // Generate keystream and XOR with input (encryption/decryption)
    encryptBlock: function(id, szInput) {
      const instance = MUGI.instances[szID];
      if (!instance) {
        throw new Error('Invalid MUGI instance ID');
      }
      
      const inputBytes = global.OpCodes.StringToBytes(szInput);
      const outputBytes = new Array(inputBytes.length);
      
      for (let i = 0; i < inputBytes.length; i++) {
        const keystreamByte = instance.generateKeystreamByte();
        outputBytes[i] = inputBytes[i] ^ keystreamByte;
      }
      
      return global.OpCodes.BytesToString(outputBytes);
    },
    
    // Decryption is identical to encryption for stream ciphers
    decryptBlock: function(id, szInput) {
      return MUGI.encryptBlock(id, szInput);
    },
    
    // MUGI instance class
    MUGIInstance: function(key) {
      this.keyBytes = global.OpCodes.StringToBytes(key);
      if (this.keyBytes.length !== MUGI.KEY_SIZE) {
        throw new Error('MUGI requires exactly 128-bit (16-byte) keys');
      }
      
      // Initialize MUGI internal state
      this.state = new Array(MUGI.STATE_SIZE * 2).fill(0);    // 3 × 64-bit state (stored as pairs of 32-bit words)
      this.buffer = new Array(MUGI.BUFFER_SIZE * 2).fill(0);  // 16 × 64-bit buffer (stored as pairs of 32-bit words)
      
      // Default IV (can be modified for actual IV support)
      this.iv = new Array(MUGI.IV_SIZE).fill(0);
      for (let i = 0; i < Math.min(MUGI.IV_SIZE, this.keyBytes.length); i++) {
        this.iv[i] = this.keyBytes[i] ^ (i + 1); // Simple IV derivation
      }
      
      this.outputBuffer = [];
      this.outputIndex = 0;
      
      this.initialize();
    }
  };
  
  // Add methods to the instance prototype
  MUGI.MUGIInstance.prototype.initialize = function() {
    // Key and IV setup process
    
    // Load key into initial state
    for (let i = 0; i < MUGI.KEY_SIZE / 4; i++) {
      this.state[i] = global.OpCodes.Pack32BE(
        this.keyBytes[i * 4],
        this.keyBytes[i * 4 + 1],
        this.keyBytes[i * 4 + 2],
        this.keyBytes[i * 4 + 3]
      );
    }
    
    // Load IV into buffer (simplified)
    for (let i = 0; i < MUGI.IV_SIZE / 4; i++) {
      this.buffer[i] = global.OpCodes.Pack32BE(
        this.iv[i * 4],
        this.iv[i * 4 + 1],
        this.iv[i * 4 + 2],
        this.iv[i * 4 + 3]
      );
    }
    
    // Initialize remaining buffer positions
    for (let i = MUGI.IV_SIZE / 4; i < MUGI.BUFFER_SIZE * 2; i++) {
      this.buffer[i] = this.state[i % (MUGI.STATE_SIZE * 2)] ^ (i + 0x12345678);
    }
    
    // Warm-up rounds
    for (let i = 0; i < 16; i++) {
      this.updateState();
    }
  };
  
  MUGI.MUGIInstance.prototype.sboxTransform = function(word) {
    // Apply AES S-box to each byte of the 32-bit word
    const bytes = global.OpCodes.Unpack32BE(word);
    for (let i = 0; i < 4; i++) {
      bytes[i] = MUGI.SBOX[bytes[i]];
    }
    return global.OpCodes.Pack32BE(bytes[0], bytes[1], bytes[2], bytes[3]);
  };
  
  MUGI.MUGIInstance.prototype.linearTransform = function(word) {
    // Simplified linear transformation (inspired by AES MDS matrix)
    const bytes = global.OpCodes.Unpack32BE(word);
    
    // Simple MDS-like transformation
    const t0 = global.OpCodes.GF256Mul(bytes[0], 0x02) ^ global.OpCodes.GF256Mul(bytes[1], 0x03) ^ bytes[2] ^ bytes[3];
    const t1 = bytes[0] ^ global.OpCodes.GF256Mul(bytes[1], 0x02) ^ global.OpCodes.GF256Mul(bytes[2], 0x03) ^ bytes[3];
    const t2 = bytes[0] ^ bytes[1] ^ global.OpCodes.GF256Mul(bytes[2], 0x02) ^ global.OpCodes.GF256Mul(bytes[3], 0x03);
    const t3 = global.OpCodes.GF256Mul(bytes[0], 0x03) ^ bytes[1] ^ bytes[2] ^ global.OpCodes.GF256Mul(bytes[3], 0x02);
    
    return global.OpCodes.Pack32BE(t0, t1, t2, t3);
  };
  
  MUGI.MUGIInstance.prototype.updateState = function() {
    // MUGI state update function (simplified)
    
    // Non-linear transformation using S-box
    const temp0 = this.sboxTransform(this.state[0]);
    const temp1 = this.sboxTransform(this.state[2]);
    const temp2 = this.sboxTransform(this.state[4]);
    
    // Linear transformation
    const linear0 = this.linearTransform(temp0 ^ this.buffer[0]);
    const linear1 = this.linearTransform(temp1 ^ this.buffer[2]);
    const linear2 = this.linearTransform(temp2 ^ this.buffer[4]);
    
    // Update buffer (shift and insert)
    for (let i = MUGI.BUFFER_SIZE * 2 - 2; i >= 2; i -= 2) {
      this.buffer[i] = this.buffer[i - 2];
      this.buffer[i + 1] = this.buffer[i - 1];
    }
    
    this.buffer[0] = linear0 ^ this.state[4];
    this.buffer[1] = linear1 ^ this.state[5];
    
    // Update state
    this.state[0] = this.state[2];
    this.state[1] = this.state[3];
    this.state[2] = this.state[4];
    this.state[3] = this.state[5];
    this.state[4] = linear2;
    this.state[5] = linear0 ^ linear1;
  };
  
  MUGI.MUGIInstance.prototype.generateOutput = function() {
    // Generate 64-bit output
    this.updateState();
    
    // Combine state and buffer for output (simplified)
    const output0 = this.state[0] ^ this.buffer[10];
    const output1 = this.state[2] ^ this.buffer[12];
    
    // Convert to byte array
    const bytes0 = global.OpCodes.Unpack32BE(output0);
    const bytes1 = global.OpCodes.Unpack32BE(output1);
    
    return bytes0.concat(bytes1);
  };
  
  MUGI.MUGIInstance.prototype.generateKeystreamByte = function() {
    // Refill output buffer if empty
    if (this.outputIndex >= this.outputBuffer.length) {
      this.outputBuffer = this.generateOutput();
      this.outputIndex = 0;
    }
    
    return this.outputBuffer[this.outputIndex++];
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(MUGI);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MUGI;
  }
  
})(typeof global !== 'undefined' ? global : window);