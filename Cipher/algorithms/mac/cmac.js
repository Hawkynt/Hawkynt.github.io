#!/usr/bin/env node
/*
 * CMAC Universal Message Authentication Code Implementation
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * CMAC (Cipher-based Message Authentication Code) is a block cipher-based MAC algorithm.
 * This implementation uses AES as the underlying block cipher.
 * 
 * Specification: NIST SP 800-38B
 * Reference: https://csrc.nist.gov/publications/detail/sp/800-38b/final
 * RFC 4493: https://tools.ietf.org/html/rfc4493
 * 
 * NOTE: This is an educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
 */

(function(global) {
  'use strict';
  
  // Load OpCodes library for common operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  // CMAC constants
  const CMAC_BLOCK_SIZE = 16;       // AES block size in bytes
  const CMAC_KEY_SIZE = 16;         // AES-128 key size
  
  // AES-128 S-box
  const SBOX = [
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
  ];
  
  // AES round constants
  const RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];
  
  /**
   * AES-128 key expansion
   * @param {Uint8Array} key - 16-byte key
   * @returns {Array} Array of round keys
   */
  function aesKeyExpansion(key) {
    const roundKeys = [];
    const w = new Uint8Array(176); // 11 round keys * 16 bytes
    
    // Copy original key
    for (let i = 0; i < 16; i++) {
      w[i] = key[i];
    }
    
    // Generate round keys
    for (let i = 16; i < 176; i += 4) {
      let temp = [w[i-4], w[i-3], w[i-2], w[i-1]];
      
      if (i % 16 === 0) {
        // RotWord
        const t = temp[0];
        temp[0] = temp[1];
        temp[1] = temp[2];
        temp[2] = temp[3];
        temp[3] = t;
        
        // SubWord
        for (let j = 0; j < 4; j++) {
          temp[j] = SBOX[temp[j]];
        }
        
        // XOR with Rcon
        temp[0] ^= RCON[(i / 16) - 1];
      }
      
      for (let j = 0; j < 4; j++) {
        w[i + j] = w[i - 16 + j] ^ temp[j];
      }
    }
    
    // Split into round keys
    for (let i = 0; i < 11; i++) {
      roundKeys[i] = w.slice(i * 16, (i + 1) * 16);
    }
    
    return roundKeys;
  }
  
  /**
   * AES SubBytes transformation
   * @param {Uint8Array} state - 16-byte state
   */
  function subBytes(state) {
    for (let i = 0; i < 16; i++) {
      state[i] = SBOX[state[i]];
    }
  }
  
  /**
   * AES ShiftRows transformation
   * @param {Uint8Array} state - 16-byte state
   */
  function shiftRows(state) {
    let temp;
    
    // Row 1: shift left by 1
    temp = state[1];
    state[1] = state[5];
    state[5] = state[9];
    state[9] = state[13];
    state[13] = temp;
    
    // Row 2: shift left by 2
    temp = state[2];
    state[2] = state[10];
    state[10] = temp;
    temp = state[6];
    state[6] = state[14];
    state[14] = temp;
    
    // Row 3: shift left by 3
    temp = state[3];
    state[3] = state[15];
    state[15] = state[11];
    state[11] = state[7];
    state[7] = temp;
  }
  
  /**
   * AES MixColumns transformation
   * @param {Uint8Array} state - 16-byte state
   */
  function mixColumns(state) {
    for (let c = 0; c < 4; c++) {
      const s0 = state[c];
      const s1 = state[c + 4];
      const s2 = state[c + 8];
      const s3 = state[c + 12];
      
      state[c] = OpCodes.GF256Mul(0x02, s0) ^ OpCodes.GF256Mul(0x03, s1) ^ s2 ^ s3;
      state[c + 4] = s0 ^ OpCodes.GF256Mul(0x02, s1) ^ OpCodes.GF256Mul(0x03, s2) ^ s3;
      state[c + 8] = s0 ^ s1 ^ OpCodes.GF256Mul(0x02, s2) ^ OpCodes.GF256Mul(0x03, s3);
      state[c + 12] = OpCodes.GF256Mul(0x03, s0) ^ s1 ^ s2 ^ OpCodes.GF256Mul(0x02, s3);
    }
  }
  
  /**
   * AES AddRoundKey transformation
   * @param {Uint8Array} state - 16-byte state
   * @param {Uint8Array} roundKey - 16-byte round key
   */
  function addRoundKey(state, roundKey) {
    for (let i = 0; i < 16; i++) {
      state[i] ^= roundKey[i];
    }
  }
  
  /**
   * AES-128 encryption
   * @param {Uint8Array} plaintext - 16-byte plaintext
   * @param {Array} roundKeys - Round keys from key expansion
   * @returns {Uint8Array} 16-byte ciphertext
   */
  function aesEncrypt(plaintext, roundKeys) {
    const state = new Uint8Array(plaintext);
    
    // Initial round
    addRoundKey(state, roundKeys[0]);
    
    // Main rounds
    for (let round = 1; round < 10; round++) {
      subBytes(state);
      shiftRows(state);
      mixColumns(state);
      addRoundKey(state, roundKeys[round]);
    }
    
    // Final round
    subBytes(state);
    shiftRows(state);
    addRoundKey(state, roundKeys[10]);
    
    return state;
  }
  
  /**
   * Left shift operation for CMAC subkey generation
   * @param {Uint8Array} data - Input data
   * @returns {Uint8Array} Left-shifted data
   */
  function leftShift(data) {
    const result = new Uint8Array(data.length);
    let carry = 0;
    
    for (let i = data.length - 1; i >= 0; i--) {
      const newCarry = (data[i] & 0x80) ? 1 : 0;
      result[i] = ((data[i] << 1) | carry) & 0xFF;
      carry = newCarry;
    }
    
    return result;
  }
  
  /**
   * Generate CMAC subkeys K1 and K2
   * @param {Array} roundKeys - AES round keys
   * @returns {Object} {K1, K2} subkeys
   */
  function generateSubkeys(roundKeys) {
    // Encrypt zero block with AES
    const zeroBlock = new Uint8Array(16);
    const L = aesEncrypt(zeroBlock, roundKeys);
    
    // Generate K1
    const K1 = leftShift(L);
    if (L[0] & 0x80) {
      K1[15] ^= 0x87; // Rb constant for 128-bit blocks
    }
    
    // Generate K2
    const K2 = leftShift(K1);
    if (K1[0] & 0x80) {
      K2[15] ^= 0x87;
    }
    
    return { K1, K2 };
  }
  
  /**
   * CMAC hasher class
   */
  function CmacHasher(key) {
    if (!key || key.length !== CMAC_KEY_SIZE) {
      throw new Error('CMAC requires a 128-bit (16-byte) key');
    }
    
    this.roundKeys = aesKeyExpansion(key);
    this.subkeys = generateSubkeys(this.roundKeys);
    this.buffer = new Uint8Array(CMAC_BLOCK_SIZE);
    this.bufferLength = 0;
    this.x = new Uint8Array(CMAC_BLOCK_SIZE); // CBC-MAC state
  }
  
  CmacHasher.prototype.update = function(data) {
    if (typeof data === 'string') {
      data = OpCodes.StringToBytes(data);
    }
    
    let offset = 0;
    
    // Fill buffer first
    while (offset < data.length && this.bufferLength < CMAC_BLOCK_SIZE) {
      this.buffer[this.bufferLength++] = data[offset++];
    }
    
    // Process full buffer
    if (this.bufferLength === CMAC_BLOCK_SIZE) {
      this.processBlock(this.buffer);
      this.bufferLength = 0;
    }
    
    // Process remaining full blocks
    while (offset + CMAC_BLOCK_SIZE <= data.length) {
      const block = data.slice(offset, offset + CMAC_BLOCK_SIZE);
      this.processBlock(block);
      offset += CMAC_BLOCK_SIZE;
    }
    
    // Store remaining bytes in buffer
    while (offset < data.length) {
      this.buffer[this.bufferLength++] = data[offset++];
    }
  };
  
  CmacHasher.prototype.processBlock = function(block) {
    // XOR with previous state
    for (let i = 0; i < CMAC_BLOCK_SIZE; i++) {
      this.x[i] ^= block[i];
    }
    
    // Encrypt with AES
    this.x = aesEncrypt(this.x, this.roundKeys);
  };
  
  CmacHasher.prototype.finalize = function() {
    const finalBlock = new Uint8Array(CMAC_BLOCK_SIZE);
    
    if (this.bufferLength === CMAC_BLOCK_SIZE) {
      // Complete final block: XOR with K1
      for (let i = 0; i < CMAC_BLOCK_SIZE; i++) {
        finalBlock[i] = this.buffer[i] ^ this.subkeys.K1[i];
      }
    } else {
      // Incomplete final block: pad and XOR with K2
      for (let i = 0; i < this.bufferLength; i++) {
        finalBlock[i] = this.buffer[i];
      }
      finalBlock[this.bufferLength] = 0x80; // Padding
      
      for (let i = 0; i < CMAC_BLOCK_SIZE; i++) {
        finalBlock[i] ^= this.subkeys.K2[i];
      }
    }
    
    // XOR with state and encrypt
    for (let i = 0; i < CMAC_BLOCK_SIZE; i++) {
      this.x[i] ^= finalBlock[i];
    }
    
    return aesEncrypt(this.x, this.roundKeys);
  };
  
  // CMAC Universal Cipher Interface
  const Cmac = {
    internalName: 'cmac',
    name: 'CMAC-AES',
    // Required Cipher interface properties
    minKeyLength: 16,        // Minimum key length in bytes
    maxKeyLength: 64,        // Maximum key length in bytes
    stepKeyLength: 1,       // Key length step size
    minBlockSize: 0,        // Minimum block size in bytes
    maxBlockSize: 0,        // Maximum block size (0 = unlimited)
    stepBlockSize: 1,       // Block size step
    instances: {},          // Instance tracking
    
    // MAC interface
    Init: function() {
      this.hasher = null;
      this.bKey = false;
    },
    
    KeySetup: function(key) {
      if (key && key.length >= CMAC_KEY_SIZE) {
        this.hasher = new CmacHasher(key.slice(0, CMAC_KEY_SIZE));
        this.bKey = true;
      } else {
        throw new Error('CMAC requires a 128-bit key');
      }
    },
    
    encryptBlock: function(blockIndex, data) {
      if (!this.bKey || !this.hasher) {
        throw new Error('CMAC key must be set before processing');
      }
      
      if (typeof data === 'string') {
        this.hasher.update(data);
        return OpCodes.BytesToHex(this.hasher.finalize());
      }
      return '';
    },
    
    decryptBlock: function(blockIndex, data) {
      // MAC functions don't decrypt
      return this.encryptBlock(blockIndex, data);
    },
    
    // Direct MAC interface
    mac: function(key, message) {
      const hasher = new CmacHasher(key);
      hasher.update(message);
      return hasher.finalize();
    },
    
    ClearData: function() {
      if (this.hasher) {
        this.hasher.x.fill(0);
        this.hasher.buffer.fill(0);
        this.hasher.subkeys.K1.fill(0);
        this.hasher.subkeys.K2.fill(0);
      }
      this.bKey = false;
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(Cmac);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Cmac;
  }
  
  // Make available globally
  global.Cmac = Cmac;
  
})(typeof global !== 'undefined' ? global : window);