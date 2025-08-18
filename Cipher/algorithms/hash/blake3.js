#!/usr/bin/env node
/*
 * BLAKE3 Universal Hash Function Implementation
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * BLAKE3 is a cryptographic hash function based on the BLAKE2 design.
 * It provides better performance than BLAKE2 and offers parallel hashing,
 * unlimited output length, tree hashing, and fast key derivation.
 * 
 * Specification: https://github.com/BLAKE3-team/BLAKE3-specs/blob/master/blake3.pdf
 * Test Vectors: https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json
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
  
  // BLAKE3 constants
  const BLAKE3_OUT_LEN = 32;           // Default output length in bytes
  const BLAKE3_KEY_LEN = 32;           // Key length in bytes  
  const BLAKE3_BLOCK_LEN = 64;         // Input block length in bytes
  const BLAKE3_CHUNK_LEN = 1024;       // Chunk length in bytes
  const BLAKE3_MAX_DEPTH = 54;         // Maximum tree depth
  
  // BLAKE3 initialization vector (same as ChaCha20)
  const IV = [
    0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
    0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19
  ];
  
  // Domain separation flags
  const CHUNK_START = 1 << 0;
  const CHUNK_END = 1 << 1;
  const PARENT = 1 << 2;
  const ROOT = 1 << 3;
  const KEYED_HASH = 1 << 4;
  const DERIVE_KEY_CONTEXT = 1 << 5;
  const DERIVE_KEY_MATERIAL = 1 << 6;
  
  /**
   * BLAKE3 compression function based on ChaCha20 quarter round
   * @param {Uint32Array} state - 16-word state array
   * @param {number} a, b, c, d - Indices for quarter round
   */
  function quarterRound(state, a, b, c, d) {
    state[a] = (state[a] + state[b]) >>> 0;
    state[d] = OpCodes.RotR32(state[d] ^ state[a], 16);
    state[c] = (state[c] + state[d]) >>> 0;
    state[b] = OpCodes.RotR32(state[b] ^ state[c], 12);
    state[a] = (state[a] + state[b]) >>> 0;
    state[d] = OpCodes.RotR32(state[d] ^ state[a], 8);
    state[c] = (state[c] + state[d]) >>> 0;
    state[b] = OpCodes.RotR32(state[b] ^ state[c], 7);
  }
  
  /**
   * BLAKE3 permutation function
   * @param {Uint32Array} state - 16-word state array
   */
  function permute(state) {
    // Column rounds
    quarterRound(state, 0, 4, 8, 12);
    quarterRound(state, 1, 5, 9, 13);
    quarterRound(state, 2, 6, 10, 14);
    quarterRound(state, 3, 7, 11, 15);
    
    // Diagonal rounds
    quarterRound(state, 0, 5, 10, 15);
    quarterRound(state, 1, 6, 11, 12);
    quarterRound(state, 2, 7, 8, 13);
    quarterRound(state, 3, 4, 9, 14);
  }
  
  /**
   * BLAKE3 compression function
   * @param {Uint32Array} chainingValue - 8-word chaining value
   * @param {Uint8Array} blockWords - 16 message words as bytes
   * @param {number} counter - Block counter
   * @param {number} blockLen - Block length in bytes
   * @param {number} flags - Domain separation flags
   * @returns {Uint32Array} - 16-word output
   */
  function compress(chainingValue, blockWords, counter, blockLen, flags) {
    // Convert block words from bytes to 32-bit words (little-endian)
    const messageWords = new Uint32Array(16);
    for (let i = 0; i < 16; i++) {
      messageWords[i] = OpCodes.Pack32LE(
        blockWords[i * 4],
        blockWords[i * 4 + 1],
        blockWords[i * 4 + 2],
        blockWords[i * 4 + 3]
      );
    }
    
    // Initialize state
    const state = new Uint32Array(16);
    
    // First 8 words: chaining value
    for (let i = 0; i < 8; i++) {
      state[i] = chainingValue[i];
    }
    
    // Next 4 words: initialization vector
    for (let i = 0; i < 4; i++) {
      state[8 + i] = IV[i];
    }
    
    // Last 4 words: counter, block length, and flags
    state[12] = counter >>> 0;
    state[13] = (counter / 0x100000000) >>> 0; // High 32 bits of 64-bit counter
    state[14] = blockLen;
    state[15] = flags;
    
    // XOR in message words to last 16 words of state
    for (let i = 0; i < 16; i++) {
      state[i] ^= messageWords[i % 16];
    }
    
    // Run 7 rounds of permutation
    for (let round = 0; round < 7; round++) {
      permute(state);
    }
    
    // XOR first 8 and last 8 words to produce 16-word output
    const output = new Uint32Array(16);
    for (let i = 0; i < 8; i++) {
      output[i] = state[i] ^ state[i + 8];
      output[i + 8] = state[i] ^ chainingValue[i];
    }
    
    return output;
  }
  
  /**
   * Process a single chunk of data
   * @param {Uint32Array} chainingValue - 8-word chaining value
   * @param {Uint8Array} chunk - Chunk data (up to 1024 bytes)
   * @param {number} counter - Chunk counter
   * @param {number} flags - Domain separation flags
   * @returns {Uint32Array} - 8-word chaining value
   */
  function chunkState(chainingValue, chunk, counter, flags) {
    let localFlags = flags;
    if (chunk.length <= BLAKE3_BLOCK_LEN) {
      localFlags |= CHUNK_START | CHUNK_END;
    } else {
      localFlags |= CHUNK_START;
    }
    
    let currentChaining = new Uint32Array(chainingValue);
    let offset = 0;
    
    while (offset < chunk.length) {
      const blockLen = Math.min(BLAKE3_BLOCK_LEN, chunk.length - offset);
      const block = new Uint8Array(64);
      
      // Copy block data and pad with zeros if necessary
      for (let i = 0; i < blockLen; i++) {
        block[i] = chunk[offset + i];
      }
      
      // Update flags for last block
      if (offset + blockLen === chunk.length) {
        localFlags |= CHUNK_END;
      }
      
      const output = compress(currentChaining, block, counter, blockLen, localFlags);
      
      // Take first 8 words as new chaining value
      for (let i = 0; i < 8; i++) {
        currentChaining[i] = output[i];
      }
      
      offset += blockLen;
      localFlags &= ~CHUNK_START; // Clear CHUNK_START for subsequent blocks
    }
    
    return currentChaining;
  }
  
  /**
   * BLAKE3 hasher class
   */
  function Blake3Hasher(key) {
    this.chainingValue = new Uint32Array(IV);
    this.chunks = [];
    this.key = key || null;
    this.flags = key ? KEYED_HASH : 0;
    
    if (key) {
      // Use key as initial chaining value
      const keyWords = OpCodes.StringToWords32LE(key, BLAKE3_KEY_LEN);
      for (let i = 0; i < 8; i++) {
        this.chainingValue[i] = keyWords[i];
      }
    }
  }
  
  Blake3Hasher.prototype.update = function(data) {
    if (typeof data === 'string') {
      data = OpCodes.StringToBytes(data);
    }
    
    let offset = 0;
    while (offset < data.length) {
      const chunkLen = Math.min(BLAKE3_CHUNK_LEN, data.length - offset);
      const chunk = data.slice(offset, offset + chunkLen);
      
      const chunkOutput = chunkState(this.chainingValue, chunk, this.chunks.length, this.flags);
      this.chunks.push(chunkOutput);
      
      offset += chunkLen;
    }
  };
  
  Blake3Hasher.prototype.finalize = function(outputLength) {
    outputLength = outputLength || BLAKE3_OUT_LEN;
    
    if (this.chunks.length === 0) {
      // Empty input case
      const emptyChunk = new Uint8Array(0);
      const output = chunkState(this.chainingValue, emptyChunk, 0, this.flags | ROOT);
      return this.extractBytes(output, outputLength);
    }
    
    if (this.chunks.length === 1) {
      // Single chunk case
      return this.extractBytes(this.chunks[0], outputLength);
    }
    
    // Multiple chunks - build Merkle tree
    let currentLevel = this.chunks.slice();
    
    while (currentLevel.length > 1) {
      const nextLevel = [];
      
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : null;
        
        if (right) {
          // Parent node with two children
          const parentInput = new Uint8Array(64);
          
          // Pack left child into first 32 bytes
          for (let j = 0; j < 8; j++) {
            const bytes = OpCodes.Unpack32LE(left[j]);
            parentInput[j * 4] = bytes[0];
            parentInput[j * 4 + 1] = bytes[1];
            parentInput[j * 4 + 2] = bytes[2];
            parentInput[j * 4 + 3] = bytes[3];
          }
          
          // Pack right child into second 32 bytes
          for (let j = 0; j < 8; j++) {
            const bytes = OpCodes.Unpack32LE(right[j]);
            parentInput[32 + j * 4] = bytes[0];
            parentInput[32 + j * 4 + 1] = bytes[1];
            parentInput[32 + j * 4 + 2] = bytes[2];
            parentInput[32 + j * 4 + 3] = bytes[3];
          }
          
          const parentFlags = PARENT | (currentLevel.length === 2 ? ROOT : 0);
          const parentOutput = compress(this.chainingValue, parentInput, 0, 64, parentFlags);
          
          // Take first 8 words
          const parent = new Uint32Array(8);
          for (let j = 0; j < 8; j++) {
            parent[j] = parentOutput[j];
          }
          
          nextLevel.push(parent);
        } else {
          // Odd node, carry forward
          nextLevel.push(left);
        }
      }
      
      currentLevel = nextLevel;
    }
    
    return this.extractBytes(currentLevel[0], outputLength);
  };
  
  Blake3Hasher.prototype.extractBytes = function(chainingValue, outputLength) {
    const output = new Uint8Array(outputLength);
    let outputOffset = 0;
    let counter = 0;
    
    while (outputOffset < outputLength) {
      const block = new Uint8Array(64);
      const compressed = compress(chainingValue, block, counter, 0, ROOT);
      
      // Extract 64 bytes from compressed output
      const blockOutput = new Uint8Array(64);
      for (let i = 0; i < 16; i++) {
        const bytes = OpCodes.Unpack32LE(compressed[i]);
        blockOutput[i * 4] = bytes[0];
        blockOutput[i * 4 + 1] = bytes[1];
        blockOutput[i * 4 + 2] = bytes[2];
        blockOutput[i * 4 + 3] = bytes[3];
      }
      
      const copyLen = Math.min(64, outputLength - outputOffset);
      for (let i = 0; i < copyLen; i++) {
        output[outputOffset + i] = blockOutput[i];
      }
      
      outputOffset += copyLen;
      counter++;
    }
    
    return output;
  };
  
  // BLAKE3 Universal Cipher Interface
  const Blake3 = {
    internalName: 'blake3',
    name: 'BLAKE3',
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
      this.hasher = new Blake3Hasher();
      this.bKey = false;
    },
    
    KeySetup: function(key) {
      if (key && key.length > 0) {
        this.hasher = new Blake3Hasher(key.slice(0, BLAKE3_KEY_LEN));
        this.bKey = true;
      } else {
        this.hasher = new Blake3Hasher();
        this.bKey = false;
      }
    },
    
    encryptBlock: function(blockIndex, data) {
      if (typeof data === 'string') {
        this.hasher.update(data);
        return OpCodes.BytesToHex(this.hasher.finalize());
      }
      return '';
    },
    
    decryptBlock: function(blockIndex, data) {
      // Hash functions don't decrypt
      return this.encryptBlock(blockIndex, data);
    },
    
    // Direct hash interface
    hash: function(data, outputLength) {
      const hasher = new Blake3Hasher();
      hasher.update(data);
      return hasher.finalize(outputLength);
    },
    
    // Keyed hash interface
    keyedHash: function(key, data, outputLength) {
      const hasher = new Blake3Hasher(key);
      hasher.update(data);
      return hasher.finalize(outputLength);
    },
    
    ClearData: function() {
      if (this.hasher) {
        this.hasher.chainingValue.fill(0);
        this.hasher.chunks = [];
      }
      this.bKey = false;
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(Blake3);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Blake3;
  }
  
  // Make available globally
  global.Blake3 = Blake3;
  
})(typeof global !== 'undefined' ? global : window);