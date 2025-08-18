#!/usr/bin/env node
/*
 * xxHash32 Universal Hash Function Implementation
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * xxHash is an extremely fast non-cryptographic hash algorithm, designed by Yann Collet.
 * xxHash32 produces 32-bit hashes and is optimized for speed on 32-bit platforms.
 * 
 * Specification: https://github.com/Cyan4973/xxHash
 * Reference: https://cyan4973.github.io/xxHash/
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
  
  // xxHash32 constants
  const XXHASH32_PRIME1 = 0x9E3779B1; // 2654435761
  const XXHASH32_PRIME2 = 0x85EBCA77; // 2246822519
  const XXHASH32_PRIME3 = 0xC2B2AE3D; // 3266489917
  const XXHASH32_PRIME4 = 0x27D4EB2F; // 668265263
  const XXHASH32_PRIME5 = 0x165667B1; // 374761393
  
  const XXHASH32_SEED = 0;  // Default seed
  
  /**
   * xxHash32 round function
   * @param {number} acc - Accumulator
   * @param {number} input - Input value
   * @returns {number} Updated accumulator
   */
  function xxh32Round(acc, input) {
    acc = (acc + ((input * XXHASH32_PRIME2) >>> 0)) >>> 0;
    acc = OpCodes.RotL32(acc, 13);
    acc = (acc * XXHASH32_PRIME1) >>> 0;
    return acc;
  }
  
  /**
   * xxHash32 avalanche function
   * @param {number} hash - Input hash
   * @returns {number} Avalanched hash
   */
  function xxh32Avalanche(hash) {
    hash ^= hash >>> 15;
    hash = (hash * XXHASH32_PRIME2) >>> 0;
    hash ^= hash >>> 13;
    hash = (hash * XXHASH32_PRIME3) >>> 0;
    hash ^= hash >>> 16;
    return hash >>> 0;
  }
  
  /**
   * xxHash32 implementation
   * @param {Uint8Array} data - Input data
   * @param {number} seed - Seed value (optional)
   * @returns {number} 32-bit hash value
   */
  function xxhash32(data, seed) {
    seed = seed || XXHASH32_SEED;
    const dataLength = data.length;
    let offset = 0;
    let hash;
    
    if (dataLength >= 16) {
      // Initialize accumulators
      let acc1 = (seed + XXHASH32_PRIME1 + XXHASH32_PRIME2) >>> 0;
      let acc2 = (seed + XXHASH32_PRIME2) >>> 0;
      let acc3 = (seed + 0) >>> 0;
      let acc4 = (seed - XXHASH32_PRIME1) >>> 0;
      
      // Process 16-byte chunks
      while (offset + 16 <= dataLength) {
        const lane1 = OpCodes.Pack32LE(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
        const lane2 = OpCodes.Pack32LE(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]);
        const lane3 = OpCodes.Pack32LE(data[offset + 8], data[offset + 9], data[offset + 10], data[offset + 11]);
        const lane4 = OpCodes.Pack32LE(data[offset + 12], data[offset + 13], data[offset + 14], data[offset + 15]);
        
        acc1 = xxh32Round(acc1, lane1);
        acc2 = xxh32Round(acc2, lane2);
        acc3 = xxh32Round(acc3, lane3);
        acc4 = xxh32Round(acc4, lane4);
        
        offset += 16;
      }
      
      // Merge accumulators
      hash = OpCodes.RotL32(acc1, 1) + OpCodes.RotL32(acc2, 7) + OpCodes.RotL32(acc3, 12) + OpCodes.RotL32(acc4, 18);
      hash = hash >>> 0;
    } else {
      // Short input
      hash = (seed + XXHASH32_PRIME5) >>> 0;
    }
    
    // Add data length
    hash = (hash + dataLength) >>> 0;
    
    // Process remaining 4-byte chunks
    while (offset + 4 <= dataLength) {
      const lane = OpCodes.Pack32LE(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
      hash = (hash + (lane * XXHASH32_PRIME3)) >>> 0;
      hash = OpCodes.RotL32(hash, 17);
      hash = (hash * XXHASH32_PRIME4) >>> 0;
      offset += 4;
    }
    
    // Process remaining bytes
    while (offset < dataLength) {
      hash = (hash + (data[offset] * XXHASH32_PRIME5)) >>> 0;
      hash = OpCodes.RotL32(hash, 11);
      hash = (hash * XXHASH32_PRIME1) >>> 0;
      offset++;
    }
    
    // Final avalanche
    return xxh32Avalanche(hash);
  }
  
  /**
   * xxHash32 hasher class for incremental processing
   */
  function XxHash32Hasher(seed) {
    this.seed = seed || XXHASH32_SEED;
    this.totalLength = 0;
    this.largeLength = 0;
    this.buffer = new Uint8Array(16);
    this.bufferLength = 0;
    
    // Accumulators for large input
    this.acc1 = (this.seed + XXHASH32_PRIME1 + XXHASH32_PRIME2) >>> 0;
    this.acc2 = (this.seed + XXHASH32_PRIME2) >>> 0;
    this.acc3 = (this.seed + 0) >>> 0;
    this.acc4 = (this.seed - XXHASH32_PRIME1) >>> 0;
  }
  
  XxHash32Hasher.prototype.update = function(data) {
    if (typeof data === 'string') {
      data = OpCodes.StringToBytes(data);
    }
    
    this.totalLength += data.length;
    let offset = 0;
    
    // Fill buffer first if we have partial data
    if (this.bufferLength > 0) {
      const remaining = 16 - this.bufferLength;
      const toCopy = Math.min(remaining, data.length);
      
      for (let i = 0; i < toCopy; i++) {
        this.buffer[this.bufferLength + i] = data[offset + i];
      }
      
      this.bufferLength += toCopy;
      offset += toCopy;
      
      // Process buffer if full
      if (this.bufferLength === 16) {
        this.processChunk(this.buffer, 0);
        this.largeLength += 16;
        this.bufferLength = 0;
      }
    }
    
    // Process remaining full 16-byte chunks
    while (offset + 16 <= data.length) {
      this.processChunk(data, offset);
      this.largeLength += 16;
      offset += 16;
    }
    
    // Store remaining bytes in buffer
    const remaining = data.length - offset;
    if (remaining > 0) {
      for (let i = 0; i < remaining; i++) {
        this.buffer[this.bufferLength + i] = data[offset + i];
      }
      this.bufferLength += remaining;
    }
  };
  
  XxHash32Hasher.prototype.processChunk = function(data, offset) {
    const lane1 = OpCodes.Pack32LE(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
    const lane2 = OpCodes.Pack32LE(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]);
    const lane3 = OpCodes.Pack32LE(data[offset + 8], data[offset + 9], data[offset + 10], data[offset + 11]);
    const lane4 = OpCodes.Pack32LE(data[offset + 12], data[offset + 13], data[offset + 14], data[offset + 15]);
    
    this.acc1 = xxh32Round(this.acc1, lane1);
    this.acc2 = xxh32Round(this.acc2, lane2);
    this.acc3 = xxh32Round(this.acc3, lane3);
    this.acc4 = xxh32Round(this.acc4, lane4);
  };
  
  XxHash32Hasher.prototype.finalize = function() {
    let hash;
    
    if (this.largeLength > 0) {
      // Large input - merge accumulators
      hash = OpCodes.RotL32(this.acc1, 1) + OpCodes.RotL32(this.acc2, 7) + 
             OpCodes.RotL32(this.acc3, 12) + OpCodes.RotL32(this.acc4, 18);
      hash = hash >>> 0;
    } else {
      // Small input
      hash = (this.seed + XXHASH32_PRIME5) >>> 0;
    }
    
    // Add total length
    hash = (hash + this.totalLength) >>> 0;
    
    // Process remaining buffer in 4-byte chunks
    let offset = 0;
    while (offset + 4 <= this.bufferLength) {
      const lane = OpCodes.Pack32LE(
        this.buffer[offset], this.buffer[offset + 1], 
        this.buffer[offset + 2], this.buffer[offset + 3]
      );
      hash = (hash + (lane * XXHASH32_PRIME3)) >>> 0;
      hash = OpCodes.RotL32(hash, 17);
      hash = (hash * XXHASH32_PRIME4) >>> 0;
      offset += 4;
    }
    
    // Process remaining bytes
    while (offset < this.bufferLength) {
      hash = (hash + (this.buffer[offset] * XXHASH32_PRIME5)) >>> 0;
      hash = OpCodes.RotL32(hash, 11);
      hash = (hash * XXHASH32_PRIME1) >>> 0;
      offset++;
    }
    
    // Final avalanche
    return xxh32Avalanche(hash);
  };
  
  // xxHash32 Universal Cipher Interface
  const XxHash32 = {
    internalName: 'xxhash32',
    name: 'xxHash32',
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
      this.hasher = new XxHash32Hasher();
      this.bKey = false;
    },
    
    KeySetup: function(key) {
      // Use key as seed if provided
      const seed = key && key.length >= 4 ? 
        OpCodes.Pack32LE(key[0], key[1], key[2], key[3]) : XXHASH32_SEED;
      this.hasher = new XxHash32Hasher(seed);
      this.bKey = key && key.length > 0;
    },
    
    encryptBlock: function(blockIndex, data) {
      if (typeof data === 'string') {
        this.hasher.update(data);
        const hash = this.hasher.finalize();
        // Convert 32-bit hash to 8-character hex string
        return ('00000000' + hash.toString(16).toUpperCase()).slice(-8);
      }
      return '';
    },
    
    decryptBlock: function(blockIndex, data) {
      // Hash functions don't decrypt
      return this.encryptBlock(blockIndex, data);
    },
    
    // Direct hash interface
    hash: function(data, seed) {
      if (typeof data === 'string') {
        data = OpCodes.StringToBytes(data);
      }
      return xxhash32(data, seed);
    },
    
    ClearData: function() {
      if (this.hasher) {
        this.hasher.acc1 = 0;
        this.hasher.acc2 = 0;
        this.hasher.acc3 = 0;
        this.hasher.acc4 = 0;
        this.hasher.buffer.fill(0);
      }
      this.bKey = false;
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(XxHash32);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = XxHash32;
  }
  
  // Make available globally
  global.XxHash32 = XxHash32;
  
})(typeof global !== 'undefined' ? global : window);