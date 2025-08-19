#!/usr/bin/env node
/*
 * SHA-3-256 Universal Hash Function Implementation
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * SHA-3 (Secure Hash Algorithm 3) is a subset of the broader cryptographic primitive 
 * family Keccak, designed by Guido Bertoni, Joan Daemen, Michaël Peeters, and Gilles Van Assche.
 * It was standardized in NIST FIPS 202.
 * 
 * Specification: NIST FIPS 202
 * Reference: https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf
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
  
  // SHA-3-256 constants
  const SHA3_256_RATE = 136;        // Rate in bytes (1088 bits)
  const SHA3_256_CAPACITY = 64;     // Capacity in bytes (512 bits)
  const SHA3_256_OUTPUT = 32;       // Output size in bytes
  const KECCAK_ROUNDS = 24;         // Number of Keccak-f[1600] rounds
  
  // Keccac round constants (24 rounds, 64-bit each) - more readable as hex literals
  const RC = [
    0x0000000000000001, 0x0000000000008082, 0x800000000000808a, 0x8000000080008000,
    0x000000000000808b, 0x0000000080000001, 0x8000000080008081, 0x8000000000008009,
    0x000000000000008a, 0x0000000000000088, 0x0000000080008009, 0x8000000000008003,
    0x8000000000008002, 0x8000000000000080, 0x000000000000800a, 0x800000008000000a,
    0x8000000080008081, 0x8000000000008080, 0x0000000080000001, 0x8000000080008008,
    0x0000000000008082, 0x8000000000000001, 0x0000000080008003, 0x8000000080000000
  ];
  
  // Rotation offsets for rho step
  const RHO_OFFSETS = [
    0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41,
    45, 15, 21, 8, 18, 2, 61, 56, 14
  ];
  
  /**
   * Convert 64-bit number to high/low 32-bit representation
   * @param {number} val - 64-bit value (may lose precision)
   * @returns {Array} [low32, high32]
   */
  function to64bit(val) {
    return [val & 0xFFFFFFFF, Math.floor(val / 0x100000000) & 0xFFFFFFFF];
  }
  
  /**
   * Convert high/low 32-bit to 64-bit number (approximate)
   * @param {number} low - Low 32 bits
   * @param {number} high - High 32 bits
   * @returns {number} 64-bit value (may lose precision)
   */
  function from64bit(low, high) {
    return (high * 0x100000000 + low);
  }
  
  /**
   * 64-bit left rotation (using 32-bit operations)
   * @param {Array} val - [low32, high32]
   * @param {number} positions - Rotation positions
   * @returns {Array} Rotated [low32, high32]
   */
  function rotl64(val, positions) {
    const [low, high] = val;
    positions %= 64;
    
    if (positions === 0) return [low, high];
    
    if (positions === 32) {
      return [high, low];
    } else if (positions < 32) {
      const newHigh = ((high << positions) | (low >>> (32 - positions))) >>> 0;
      const newLow = ((low << positions) | (high >>> (32 - positions))) >>> 0;
      return [newLow, newHigh];
    } else {
      positions -= 32;
      const newHigh = ((low << positions) | (high >>> (32 - positions))) >>> 0;
      const newLow = ((high << positions) | (low >>> (32 - positions))) >>> 0;
      return [newLow, newHigh];
    }
  }
  
  /**
   * 64-bit XOR operation
   * @param {Array} a - [low32, high32]
   * @param {Array} b - [low32, high32]
   * @returns {Array} XOR result [low32, high32]
   */
  function xor64(a, b) {
    return [a[0] ^ b[0], a[1] ^ b[1]];
  }
  
  /**
   * Keccak-f[1600] permutation
   * @param {Array} state - 25 x [low32, high32] state array
   */
  function keccakF(state) {
    for (let round = 0; round < KECCAK_ROUNDS; round++) {
      // Theta step
      const C = new Array(5);
      for (let x = 0; x < 5; x++) {
        C[x] = [0, 0];
        for (let y = 0; y < 5; y++) {
          C[x] = xor64(C[x], state[x + 5 * y]);
        }
      }
      
      const D = new Array(5);
      for (let x = 0; x < 5; x++) {
        D[x] = xor64(C[(x + 4) % 5], rotl64(C[(x + 1) % 5], 1));
      }
      
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[x + 5 * y] = xor64(state[x + 5 * y], D[x]);
        }
      }
      
      // Rho step
      for (let i = 0; i < 25; i++) {
        state[i] = rotl64(state[i], RHO_OFFSETS[i]);
      }
      
      // Pi step
      const temp = new Array(25);
      for (let i = 0; i < 25; i++) {
        temp[i] = [state[i][0], state[i][1]];
      }
      
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[x + 5 * y] = temp[((x + 3 * y) % 5) + 5 * x];
        }
      }
      
      // Chi step
      for (let y = 0; y < 5; y++) {
        const row = new Array(5);
        for (let x = 0; x < 5; x++) {
          row[x] = [state[x + 5 * y][0], state[x + 5 * y][1]];
        }
        
        for (let x = 0; x < 5; x++) {
          const notNext = [~row[(x + 1) % 5][0], ~row[(x + 1) % 5][1]];
          const andResult = [notNext[0] & row[(x + 2) % 5][0], notNext[1] & row[(x + 2) % 5][1]];
          state[x + 5 * y] = xor64(row[x], andResult);
        }
      }
      
      // Iota step
      const rc = to64bit(RC[round]);
      state[0] = xor64(state[0], rc);
    }
  }
  
  /**
   * SHA-3-256 hasher class
   */
  function Sha3256Hasher() {
    this.state = new Array(25);
    for (let i = 0; i < 25; i++) {
      this.state[i] = [0, 0];
    }
    this.buffer = new Uint8Array(SHA3_256_RATE);
    this.bufferLength = 0;
  }
  
  Sha3256Hasher.prototype.absorb = function(data) {
    if (typeof data === 'string') {
      data = OpCodes.StringToBytes(data);
    }
    
    let offset = 0;
    
    while (offset < data.length) {
      const remaining = SHA3_256_RATE - this.bufferLength;
      const toCopy = Math.min(remaining, data.length - offset);
      
      // Copy data to buffer
      for (let i = 0; i < toCopy; i++) {
        this.buffer[this.bufferLength + i] = data[offset + i];
      }
      
      this.bufferLength += toCopy;
      offset += toCopy;
      
      // Process full blocks
      if (this.bufferLength === SHA3_256_RATE) {
        this.absorbBlock();
        this.bufferLength = 0;
      }
    }
  };
  
  Sha3256Hasher.prototype.absorbBlock = function() {
    // XOR buffer into state (little-endian)
    for (let i = 0; i < SHA3_256_RATE; i += 8) {
      const word = [
        OpCodes.Pack32LE(this.buffer[i], this.buffer[i + 1], this.buffer[i + 2], this.buffer[i + 3]),
        OpCodes.Pack32LE(this.buffer[i + 4], this.buffer[i + 5], this.buffer[i + 6], this.buffer[i + 7])
      ];
      const stateIndex = Math.floor(i / 8);
      this.state[stateIndex] = xor64(this.state[stateIndex], word);
    }
    
    keccakF(this.state);
  };
  
  Sha3256Hasher.prototype.finalize = function() {
    // Pad with 0x06 (SHA-3 padding)
    this.buffer[this.bufferLength] = 0x06;
    
    // Fill rest with zeros except last byte
    for (let i = this.bufferLength + 1; i < SHA3_256_RATE - 1; i++) {
      this.buffer[i] = 0;
    }
    
    // Set last bit of last byte
    this.buffer[SHA3_256_RATE - 1] = 0x80;
    
    // Absorb final block
    this.absorbBlock();
    
    // Squeeze output
    const output = new Uint8Array(SHA3_256_OUTPUT);
    for (let i = 0; i < SHA3_256_OUTPUT; i += 8) {
      const stateIndex = Math.floor(i / 8);
      const word = this.state[stateIndex];
      
      const bytes1 = OpCodes.Unpack32LE(word[0]);
      const bytes2 = OpCodes.Unpack32LE(word[1]);
      
      for (let j = 0; j < 4 && i + j < SHA3_256_OUTPUT; j++) {
        output[i + j] = bytes1[j];
      }
      for (let j = 0; j < 4 && i + j + 4 < SHA3_256_OUTPUT; j++) {
        output[i + j + 4] = bytes2[j];
      }
    }
    
    return output;
  };
  
  // SHA-3-256 Universal Cipher Interface
  const Sha3256 = {
    internalName: 'sha3-256',
    name: 'SHA-3-256',
    // Required Cipher interface properties
    minKeyLength: 0,        // Minimum key length in bytes
    maxKeyLength: 64,        // Maximum key length in bytes
    stepKeyLength: 1,       // Key length step size
    minBlockSize: 0,        // Minimum block size in bytes
    maxBlockSize: 0,        // Maximum block size (0 = unlimited)
    stepBlockSize: 1,       // Block size step
    instances: {},          // Instance tracking
    
    // Hash function interface
    Init: function() {
      this.hasher = new Sha3256Hasher();
      this.bKey = false;
    },
    
    KeySetup: function(key) {
      // SHA-3 doesn't use keys in standard mode
      this.hasher = new Sha3256Hasher();
      this.bKey = false;
    },
    
    encryptBlock: function(blockIndex, data) {
      if (typeof data === 'string') {
        this.hasher.absorb(data);
        return OpCodes.BytesToHex(this.hasher.finalize());
      }
      return '';
    },
    
    decryptBlock: function(blockIndex, data) {
      // Hash functions don't decrypt
      return this.encryptBlock(blockIndex, data);
    },
    
    // Direct hash interface
    hash: function(data) {
      const hasher = new Sha3256Hasher();
      hasher.absorb(data);
      return hasher.finalize();
    },
    
    ClearData: function() {
      if (this.hasher) {
        for (let i = 0; i < this.hasher.state.length; i++) {
          this.hasher.state[i] = [0, 0];
        }
        this.hasher.buffer.fill(0);
      }
      this.bKey = false;
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(Sha3256);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Sha3256;
  }
  
  // Make available globally
  global.Sha3256 = Sha3256;
  
})(typeof global !== 'undefined' ? global : window);