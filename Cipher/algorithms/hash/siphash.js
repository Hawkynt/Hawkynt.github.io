#!/usr/bin/env node
/*
 * SipHash-2-4 Universal MAC Implementation
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * SipHash is a family of pseudorandom functions (PRFs) optimized for speed on short messages.
 * It was designed by Jean-Philippe Aumasson and Daniel J. Bernstein in 2012 as a defense 
 * against hash-flooding DoS attacks.
 * 
 * Specification: https://cr.yp.to/siphash/siphash-20120918.pdf
 * Test Vectors: https://github.com/veorq/SipHash/blob/master/vectors.h
 * RFC 9018: https://www.rfc-editor.org/rfc/rfc9018.txt (DNS Cookie usage)
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
  
  // SipHash constants
  const SIPHASH_KEY_SIZE = 16;      // 128-bit key
  const SIPHASH_OUTPUT_SIZE = 8;    // 64-bit output
  const SIPHASH_C_ROUNDS = 2;       // Compression rounds per message block
  const SIPHASH_D_ROUNDS = 4;       // Finalization rounds
  
  /**
   * 64-bit addition using 32-bit operations
   * @param {Array} a - [low32, high32]
   * @param {Array} b - [low32, high32]
   * @returns {Array} Sum [low32, high32]
   */
  function add64(a, b) {
    const low = (a[0] + b[0]) >>> 0;
    const high = (a[1] + b[1] + (low < a[0] ? 1 : 0)) >>> 0;
    return [low, high];
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
   * 64-bit left rotation using 32-bit operations
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
   * SipRound - one round of SipHash
   * @param {Array} v0, v1, v2, v3 - State variables [low32, high32]
   * @returns {Array} Updated state [v0, v1, v2, v3]
   */
  function sipRound(v0, v1, v2, v3) {
    v0 = add64(v0, v1);
    v1 = rotl64(v1, 13);
    v1 = xor64(v1, v0);
    v0 = rotl64(v0, 32);
    
    v2 = add64(v2, v3);
    v3 = rotl64(v3, 16);
    v3 = xor64(v3, v2);
    
    v0 = add64(v0, v3);
    v3 = rotl64(v3, 21);
    v3 = xor64(v3, v0);
    
    v2 = add64(v2, v1);
    v1 = rotl64(v1, 17);
    v1 = xor64(v1, v2);
    v2 = rotl64(v2, 32);
    
    return [v0, v1, v2, v3];
  }
  
  /**
   * Convert bytes to 64-bit little-endian word
   * @param {Uint8Array} bytes - Input bytes (8 bytes)
   * @param {number} offset - Starting offset
   * @returns {Array} [low32, high32]
   */
  function bytesToWord64LE(bytes, offset) {
    const low = OpCodes.Pack32LE(
      bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]
    );
    const high = OpCodes.Pack32LE(
      bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]
    );
    return [low, high];
  }
  
  /**
   * Convert 64-bit word to bytes (little-endian)
   * @param {Array} word - [low32, high32]
   * @returns {Uint8Array} 8 bytes
   */
  function word64ToBytes(word) {
    const bytes = new Uint8Array(8);
    const lowBytes = OpCodes.Unpack32LE(word[0]);
    const highBytes = OpCodes.Unpack32LE(word[1]);
    
    for (let i = 0; i < 4; i++) {
      bytes[i] = lowBytes[i];
      bytes[i + 4] = highBytes[i];
    }
    
    return bytes;
  }
  
  /**
   * SipHash-2-4 implementation
   * @param {Uint8Array} key - 128-bit key
   * @param {Uint8Array} message - Input message
   * @returns {Uint8Array} 64-bit tag
   */
  function siphash24(key, message) {
    if (key.length !== 16) {
      throw new Error('SipHash key must be exactly 16 bytes');
    }
    
    // Initialize state with key
    const k0 = bytesToWord64LE(key, 0);
    const k1 = bytesToWord64LE(key, 8);
    
    let v0 = xor64(k0, [0x736f6d65, 0x646f7261]); // "somepseudo"
    let v1 = xor64(k1, [0x6e646f6d, 0x7465646f]); // "random"
    let v2 = xor64(k0, [0x6c796765, 0x6e657261]); // "lygenera"
    let v3 = xor64(k1, [0x74656462, 0x79746573]); // "tedbytes"
    
    // Process message in 8-byte blocks
    const messageLen = message.length;
    let offset = 0;
    
    while (offset + 8 <= messageLen) {
      const m = bytesToWord64LE(message, offset);
      v3 = xor64(v3, m);
      
      // c rounds of SipRound
      for (let i = 0; i < SIPHASH_C_ROUNDS; i++) {
        [v0, v1, v2, v3] = sipRound(v0, v1, v2, v3);
      }
      
      v0 = xor64(v0, m);
      offset += 8;
    }
    
    // Handle final partial block
    const finalBlock = new Uint8Array(8);
    const remaining = messageLen - offset;
    
    for (let i = 0; i < remaining; i++) {
      finalBlock[i] = message[offset + i];
    }
    
    // Pad with message length in last byte
    finalBlock[7] = messageLen & 0xFF;
    
    const m = bytesToWord64LE(finalBlock, 0);
    v3 = xor64(v3, m);
    
    // c rounds of SipRound
    for (let i = 0; i < SIPHASH_C_ROUNDS; i++) {
      [v0, v1, v2, v3] = sipRound(v0, v1, v2, v3);
    }
    
    v0 = xor64(v0, m);
    
    // Finalization
    v2 = xor64(v2, [0xff, 0]);
    
    // d rounds of SipRound
    for (let i = 0; i < SIPHASH_D_ROUNDS; i++) {
      [v0, v1, v2, v3] = sipRound(v0, v1, v2, v3);
    }
    
    // Return v0 ⊕ v1 ⊕ v2 ⊕ v3
    const result = xor64(xor64(v0, v1), xor64(v2, v3));
    return word64ToBytes(result);
  }
  
  /**
   * SipHash hasher class for incremental processing
   */
  function SipHasher(key) {
    if (!key || key.length !== SIPHASH_KEY_SIZE) {
      throw new Error('SipHash requires a 128-bit (16-byte) key');
    }
    
    this.key = new Uint8Array(key);
    this.buffer = new Uint8Array(8);
    this.bufferLength = 0;
    this.totalLength = 0;
    this.finalized = false;
    
    // Initialize state
    const k0 = bytesToWord64LE(this.key, 0);
    const k1 = bytesToWord64LE(this.key, 8);
    
    this.v0 = xor64(k0, [0x736f6d65, 0x646f7261]);
    this.v1 = xor64(k1, [0x6e646f6d, 0x7465646f]);
    this.v2 = xor64(k0, [0x6c796765, 0x6e657261]);
    this.v3 = xor64(k1, [0x74656462, 0x79746573]);
  }
  
  SipHasher.prototype.update = function(data) {
    if (this.finalized) {
      throw new Error('Cannot update after finalization');
    }
    
    if (typeof data === 'string') {
      data = OpCodes.StringToBytes(data);
    }
    
    this.totalLength += data.length;
    let offset = 0;
    
    // Fill buffer first
    while (offset < data.length && this.bufferLength < 8) {
      this.buffer[this.bufferLength++] = data[offset++];
    }
    
    // Process full buffer
    if (this.bufferLength === 8) {
      this.processBlock(this.buffer, 0);
      this.bufferLength = 0;
    }
    
    // Process remaining full blocks
    while (offset + 8 <= data.length) {
      this.processBlock(data, offset);
      offset += 8;
    }
    
    // Store remaining bytes in buffer
    while (offset < data.length) {
      this.buffer[this.bufferLength++] = data[offset++];
    }
  };
  
  SipHasher.prototype.processBlock = function(data, offset) {
    const m = bytesToWord64LE(data, offset);
    this.v3 = xor64(this.v3, m);
    
    for (let i = 0; i < SIPHASH_C_ROUNDS; i++) {
      [this.v0, this.v1, this.v2, this.v3] = sipRound(this.v0, this.v1, this.v2, this.v3);
    }
    
    this.v0 = xor64(this.v0, m);
  };
  
  SipHasher.prototype.finalize = function() {
    if (this.finalized) {
      return this.result;
    }
    
    // Pad final block
    const finalBlock = new Uint8Array(8);
    for (let i = 0; i < this.bufferLength; i++) {
      finalBlock[i] = this.buffer[i];
    }
    finalBlock[7] = this.totalLength & 0xFF;
    
    const m = bytesToWord64LE(finalBlock, 0);
    this.v3 = xor64(this.v3, m);
    
    for (let i = 0; i < SIPHASH_C_ROUNDS; i++) {
      [this.v0, this.v1, this.v2, this.v3] = sipRound(this.v0, this.v1, this.v2, this.v3);
    }
    
    this.v0 = xor64(this.v0, m);
    this.v2 = xor64(this.v2, [0xff, 0]);
    
    for (let i = 0; i < SIPHASH_D_ROUNDS; i++) {
      [this.v0, this.v1, this.v2, this.v3] = sipRound(this.v0, this.v1, this.v2, this.v3);
    }
    
    const result = xor64(xor64(this.v0, this.v1), xor64(this.v2, this.v3));
    this.result = word64ToBytes(result);
    this.finalized = true;
    
    return this.result;
  };
  
  // SipHash Universal Cipher Interface
  const SipHash = {
    internalName: 'siphash',
    name: 'SipHash-2-4',
    // Required Cipher interface properties
    minKeyLength: 0,        // Minimum key length in bytes
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
      if (key && key.length >= SIPHASH_KEY_SIZE) {
        this.hasher = new SipHasher(key.slice(0, SIPHASH_KEY_SIZE));
        this.bKey = true;
      } else {
        throw new Error('SipHash requires a 128-bit key');
      }
    },
    
    encryptBlock: function(blockIndex, data) {
      if (!this.bKey || !this.hasher) {
        throw new Error('SipHash key must be set before processing');
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
      return siphash24(key, message);
    },
    
    ClearData: function() {
      if (this.hasher) {
        this.hasher.key.fill(0);
        this.hasher.buffer.fill(0);
        this.hasher.v0 = [0, 0];
        this.hasher.v1 = [0, 0];
        this.hasher.v2 = [0, 0];
        this.hasher.v3 = [0, 0];
      }
      this.bKey = false;
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(SipHash);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SipHash;
  }
  
  // Make available globally
  global.SipHash = SipHash;
  
})(typeof global !== 'undefined' ? global : window);