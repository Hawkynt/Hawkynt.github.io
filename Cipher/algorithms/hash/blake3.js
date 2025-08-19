#!/usr/bin/env node
/*
 * BLAKE3 Implementation
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Load OpCodes for cryptographic operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes.js:', e.message);
      return;
    }
  }

  const Blake3 = {
    name: "BLAKE3",
    description: "Modern cryptographic hash function based on BLAKE2. Features parallel hashing, unlimited output length, and fast key derivation.",
    inventor: "Jack O'Connor, Jean-Philippe Aumasson, Samuel Neves, Zooko Wilcox-O'Hearn",
    year: 2020,
    country: "US",
    category: "hash",
    subCategory: "Cryptographic Hash",
    securityStatus: null,
    securityNotes: "BLAKE3 is a modern hash function with excellent security properties. Educational implementation - use proven libraries for production.",
    
    documentation: [
      {text: "BLAKE3 Specification", uri: "https://github.com/BLAKE3-team/BLAKE3-specs/blob/master/blake3.pdf"},
      {text: "BLAKE3 Official Website", uri: "https://blake3.io/"},
      {text: "Wikipedia BLAKE3", uri: "https://en.wikipedia.org/wiki/BLAKE_(hash_function)#BLAKE3"}
    ],
    
    references: [
      {text: "BLAKE3 Reference Implementation", uri: "https://github.com/BLAKE3-team/BLAKE3"},
      {text: "BLAKE3 Rust Implementation", uri: "https://crates.io/crates/blake3"}
    ],
    
    knownVulnerabilities: [],
    
    tests: [
      {
        text: "BLAKE3 Test Vector - Empty string",
        uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
        input: OpCodes.Hex8ToBytes(""),
        key: null,
        expected: OpCodes.Hex8ToBytes("af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262")
      },
      {
        text: "BLAKE3 Test Vector - abc",
        uri: "https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json",
        input: OpCodes.StringToBytes("abc"),
        key: null,
        expected: OpCodes.Hex8ToBytes("6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85")
      }
    ],

    Init: function() {
      return true;
    },

    // BLAKE3 constants
    BLAKE3_OUT_LEN: 32,
    BLAKE3_KEY_LEN: 32,
    BLAKE3_BLOCK_LEN: 64,
    BLAKE3_CHUNK_LEN: 1024,
    BLAKE3_MAX_DEPTH: 54,
    
    // BLAKE3 initialization vector (same as ChaCha20)
    IV: [
      0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
      0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19
    ],
    
    // Domain separation flags
    CHUNK_START: 1 << 0,
    CHUNK_END: 1 << 1,
    PARENT: 1 << 2,
    ROOT: 1 << 3,
    KEYED_HASH: 1 << 4,
    DERIVE_KEY_CONTEXT: 1 << 5,
    DERIVE_KEY_MATERIAL: 1 << 6,

    // Core BLAKE3 computation
    compute: function(data, key, outputLength) {
      outputLength = outputLength || this.BLAKE3_OUT_LEN;
      const hasher = new Blake3Hasher(key);
      hasher.update(data);
      return hasher.finalize(outputLength);
    }
  };

  /**
   * BLAKE3 compression function based on ChaCha20 quarter round
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
      state[8 + i] = Blake3.IV[i];
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
   * BLAKE3 hasher class
   */
  function Blake3Hasher(key) {
    this.chainingValue = new Uint32Array(Blake3.IV);
    this.chunks = [];
    this.key = key || null;
    this.flags = key ? Blake3.KEYED_HASH : 0;
    
    if (key) {
      // Use key as initial chaining value
      const keyWords = OpCodes.StringToWords32LE(key, Blake3.BLAKE3_KEY_LEN);
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
      const chunkLen = Math.min(Blake3.BLAKE3_CHUNK_LEN, data.length - offset);
      const chunk = data.slice(offset, offset + chunkLen);
      
      const chunkOutput = this.chunkState(this.chainingValue, chunk, this.chunks.length, this.flags);
      this.chunks.push(chunkOutput);
      
      offset += chunkLen;
    }
  };

  Blake3Hasher.prototype.chunkState = function(chainingValue, chunk, counter, flags) {
    let localFlags = flags;
    if (chunk.length <= Blake3.BLAKE3_BLOCK_LEN) {
      localFlags |= Blake3.CHUNK_START | Blake3.CHUNK_END;
    } else {
      localFlags |= Blake3.CHUNK_START;
    }
    
    let currentChaining = new Uint32Array(chainingValue);
    let offset = 0;
    
    while (offset < chunk.length) {
      const blockLen = Math.min(Blake3.BLAKE3_BLOCK_LEN, chunk.length - offset);
      const block = new Uint8Array(64);
      
      // Copy block data and pad with zeros if necessary
      for (let i = 0; i < blockLen; i++) {
        block[i] = chunk[offset + i];
      }
      
      // Update flags for last block
      if (offset + blockLen === chunk.length) {
        localFlags |= Blake3.CHUNK_END;
      }
      
      const output = compress(currentChaining, block, counter, blockLen, localFlags);
      
      // Take first 8 words as new chaining value
      for (let i = 0; i < 8; i++) {
        currentChaining[i] = output[i];
      }
      
      offset += blockLen;
      localFlags &= ~Blake3.CHUNK_START; // Clear CHUNK_START for subsequent blocks
    }
    
    return currentChaining;
  };

  Blake3Hasher.prototype.finalize = function(outputLength) {
    outputLength = outputLength || Blake3.BLAKE3_OUT_LEN;
    
    if (this.chunks.length === 0) {
      // Empty input case
      const emptyChunk = new Uint8Array(0);
      const output = this.chunkState(this.chainingValue, emptyChunk, 0, this.flags | Blake3.ROOT);
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
          
          // Pack left and right children
          for (let j = 0; j < 8; j++) {
            const leftBytes = OpCodes.Unpack32LE(left[j]);
            const rightBytes = OpCodes.Unpack32LE(right[j]);
            parentInput[j * 4] = leftBytes[0];
            parentInput[j * 4 + 1] = leftBytes[1];
            parentInput[j * 4 + 2] = leftBytes[2];
            parentInput[j * 4 + 3] = leftBytes[3];
            parentInput[32 + j * 4] = rightBytes[0];
            parentInput[32 + j * 4 + 1] = rightBytes[1];
            parentInput[32 + j * 4 + 2] = rightBytes[2];
            parentInput[32 + j * 4 + 3] = rightBytes[3];
          }
          
          const parentFlags = Blake3.PARENT | (currentLevel.length === 2 ? Blake3.ROOT : 0);
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
      const compressed = compress(chainingValue, block, counter, 0, Blake3.ROOT);
      
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

  // Auto-register with Subsystem (according to category) if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(Blake3);
  


  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Blake3;
  }
  
  // Export to global scope
  global.Blake3 = Blake3;

})(typeof global !== 'undefined' ? global : window);