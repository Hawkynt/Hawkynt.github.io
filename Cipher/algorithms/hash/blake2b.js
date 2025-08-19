#!/usr/bin/env node
/*
 * BLAKE2b Implementation
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
  
  // BLAKE2b constants
  const BLAKE2B_BLOCKBYTES = 128;    // Block size in bytes
  const BLAKE2B_OUTBYTES = 64;       // Default output size in bytes
  const BLAKE2B_KEYBYTES = 64;       // Max key size in bytes
  const BLAKE2B_SALTBYTES = 16;      // Salt size in bytes
  const BLAKE2B_PERSONALBYTES = 16;  // Personal string size in bytes
  
  // BLAKE2b initialization vectors (64-bit words as BigInt values)
  const IV = [
    BigInt('0x6a09e667f3bcc908'), BigInt('0xbb67ae8584caa73b'),
    BigInt('0x3c6ef372fe94f82b'), BigInt('0xa54ff53a5f1d36f1'),
    BigInt('0x510e527fade682d1'), BigInt('0x9b05688c2b3e6c1f'),
    BigInt('0x1f83d9abfb41bd6b'), BigInt('0x5be0cd19137e2179')
  ];
  
  // BLAKE2b sigma permutation schedule
  const SIGMA = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
    [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
    [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
    [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
    [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
    [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
    [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
    [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
    [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0]
  ];
  
  /**
   * 64-bit right rotation for BigInt values
   * @param {BigInt} value - 64-bit value to rotate
   * @param {number} positions - Number of positions to rotate (0-63)
   * @returns {BigInt} Rotated 64-bit value
   */
  function RotR64(value, positions) {
    const mask64 = BigInt('0xffffffffffffffff');
    value = value & mask64;
    positions = BigInt(positions) & BigInt(63);
    return ((value >> positions) | (value << (BigInt(64) - positions))) & mask64;
  }
  
  /**
   * BLAKE2b G function (mixing function)
   * @param {BigInt[]} v - Working vector (16 elements)
   * @param {number} a, b, c, d - Indices
   * @param {BigInt} x, y - Message words
   */
  function G(v, a, b, c, d, x, y) {
    v[a] = (v[a] + v[b] + x) & BigInt('0xffffffffffffffff');
    v[d] = RotR64(v[d] ^ v[a], 32);
    v[c] = (v[c] + v[d]) & BigInt('0xffffffffffffffff');
    v[b] = RotR64(v[b] ^ v[c], 24);
    v[a] = (v[a] + v[b] + y) & BigInt('0xffffffffffffffff');
    v[d] = RotR64(v[d] ^ v[a], 16);
    v[c] = (v[c] + v[d]) & BigInt('0xffffffffffffffff');
    v[b] = RotR64(v[b] ^ v[c], 63);
  }
  
  /**
   * BLAKE2b compression function
   * @param {BigInt[]} h - Hash state (8 elements)
   * @param {BigInt[]} m - Message block (16 elements)
   * @param {BigInt} t - Counter
   * @param {boolean} f - Final block flag
   */
  function compress(h, m, t, f) {
    const v = new Array(16);
    
    // Initialize working vector
    for (let i = 0; i < 8; i++) {
      v[i] = h[i];
    }
    for (let i = 0; i < 8; i++) {
      v[i + 8] = IV[i];
    }
    
    // Mix counter and final flag
    v[12] ^= t & BigInt('0xffffffffffffffff');
    v[13] ^= (t >> BigInt(64)) & BigInt('0xffffffffffffffff');
    if (f) {
      v[14] ^= BigInt('0xffffffffffffffff');
    }
    
    // 12 rounds of mixing
    for (let round = 0; round < 12; round++) {
      const s = SIGMA[round % 10];
      
      // Mix columns
      G(v, 0, 4, 8, 12, m[s[0]], m[s[1]]);
      G(v, 1, 5, 9, 13, m[s[2]], m[s[3]]);
      G(v, 2, 6, 10, 14, m[s[4]], m[s[5]]);
      G(v, 3, 7, 11, 15, m[s[6]], m[s[7]]);
      
      // Mix diagonals
      G(v, 0, 5, 10, 15, m[s[8]], m[s[9]]);
      G(v, 1, 6, 11, 12, m[s[10]], m[s[11]]);
      G(v, 2, 7, 8, 13, m[s[12]], m[s[13]]);
      G(v, 3, 4, 9, 14, m[s[14]], m[s[15]]);
    }
    
    // Update hash state
    for (let i = 0; i < 8; i++) {
      h[i] ^= v[i] ^ v[i + 8];
    }
  }
  
  /**
   * Convert bytes to 64-bit words (little-endian)
   * @param {Uint8Array} bytes - Input bytes
   * @returns {BigInt[]} - Array of 64-bit words
   */
  function bytesToWords64(bytes) {
    const words = [];
    for (let i = 0; i < bytes.length; i += 8) {
      let word = BigInt(0);
      for (let j = 0; j < 8 && i + j < bytes.length; j++) {
        word |= BigInt(bytes[i + j]) << BigInt(j * 8);
      }
      words.push(word);
    }
    return words;
  }
  
  /**
   * Convert 64-bit words to bytes (little-endian)
   * @param {BigInt[]} words - Input words
   * @param {number} length - Output length in bytes
   * @returns {Uint8Array} - Output bytes
   */
  function words64ToBytes(words, length) {
    const bytes = new Uint8Array(length);
    let byteIndex = 0;
    
    for (let i = 0; i < words.length && byteIndex < length; i++) {
      let word = words[i];
      for (let j = 0; j < 8 && byteIndex < length; j++) {
        bytes[byteIndex++] = Number(word & BigInt('0xff'));
        word >>= BigInt(8);
      }
    }
    
    return bytes;
  }
  
  /**
   * BLAKE2b hasher class
   */
  function Blake2bHasher(key, outputLength) {
    this.outputLength = outputLength || BLAKE2B_OUTBYTES;
    this.key = key || null;
    this.h = new Array(8);
    this.buffer = new Uint8Array(BLAKE2B_BLOCKBYTES);
    this.bufferLength = 0;
    this.counter = BigInt(0);
    
    // Initialize hash state
    for (let i = 0; i < 8; i++) {
      this.h[i] = IV[i];
    }
    
    // Set parameter block in h[0]
    this.h[0] ^= BigInt(this.outputLength) |
                 (BigInt(key ? key.length : 0) << BigInt(8)) |
                 (BigInt(1) << BigInt(16)) |  // fanout = 1
                 (BigInt(1) << BigInt(24));   // depth = 1
    
    // Process key if provided
    if (key && key.length > 0) {
      const keyPadded = new Uint8Array(BLAKE2B_BLOCKBYTES);
      for (let i = 0; i < key.length && i < BLAKE2B_KEYBYTES; i++) {
        keyPadded[i] = key[i];
      }
      this.update(keyPadded);
    }
  }
  
  Blake2bHasher.prototype.update = function(data) {
    if (typeof data === 'string') {
      data = OpCodes.StringToBytes(data);
    }
    
    let offset = 0;
    
    while (offset < data.length) {
      const remaining = BLAKE2B_BLOCKBYTES - this.bufferLength;
      const toCopy = Math.min(remaining, data.length - offset);
      
      // Copy data to buffer
      for (let i = 0; i < toCopy; i++) {
        this.buffer[this.bufferLength + i] = data[offset + i];
      }
      
      this.bufferLength += toCopy;
      offset += toCopy;
      
      // Process full blocks
      if (this.bufferLength === BLAKE2B_BLOCKBYTES) {
        this.counter += BigInt(BLAKE2B_BLOCKBYTES);
        const m = bytesToWords64(this.buffer);
        
        // Pad message block to 16 words
        while (m.length < 16) {
          m.push(BigInt(0));
        }
        
        compress(this.h, m, this.counter, false);
        this.bufferLength = 0;
      }
    }
  };
  
  Blake2bHasher.prototype.finalize = function() {
    // Process final block
    this.counter += BigInt(this.bufferLength);
    
    // Pad final block with zeros
    for (let i = this.bufferLength; i < BLAKE2B_BLOCKBYTES; i++) {
      this.buffer[i] = 0;
    }
    
    const m = bytesToWords64(this.buffer);
    while (m.length < 16) {
      m.push(BigInt(0));
    }
    
    compress(this.h, m, this.counter, true);
    
    // Convert hash state to bytes
    return words64ToBytes(this.h, this.outputLength);
  };
  
  // BLAKE2b Universal Cipher Interface
  const Blake2b = {
    name: "BLAKE2b",
    description: "High-speed cryptographic hash function optimized for 64-bit platforms. Faster than MD5, SHA-1, SHA-2, and SHA-3.",
    inventor: "Jean-Philippe Aumasson, Samuel Neves, Zooko Wilcox-O'Hearn, Christian Winnerlein",
    year: 2012,
    country: "CH",
    category: "hash",
    subCategory: "Cryptographic Hash",
    securityStatus: "secure",
    securityNotes: "BLAKE2b is a modern hash function with excellent security properties. Educational implementation - use proven libraries for production.",
    
    documentation: [
      {text: "RFC 7693 - BLAKE2 Cryptographic Hash and MAC", uri: "https://tools.ietf.org/html/rfc7693"},
      {text: "BLAKE2 Official Specification", uri: "https://blake2.net/blake2.pdf"},
      {text: "Wikipedia BLAKE2", uri: "https://en.wikipedia.org/wiki/BLAKE_(hash_function)#BLAKE2"}
    ],
    
    references: [
      {text: "BLAKE2 Reference Implementation", uri: "https://github.com/BLAKE2/BLAKE2"},
      {text: "libsodium BLAKE2b", uri: "https://github.com/jedisct1/libsodium"}
    ],
    
    knownVulnerabilities: [],
    
    tests: [
      {
        text: "RFC 7693 Test Vector - Empty string",
        uri: "https://tools.ietf.org/html/rfc7693",
        input: OpCodes.Hex8ToBytes(""),
        key: null,
        expected: OpCodes.Hex8ToBytes("786a02f742015903c6c6fd852552d272912f4740e15847618a86e217f71f5419d25e1031afee585313896444934eb04b903a685b1448b755d56f701afe9be2ce")
      },
      {
        text: "RFC 7693 Test Vector - abc",
        uri: "https://tools.ietf.org/html/rfc7693",
        input: OpCodes.StringToBytes("abc"),
        key: null,
        expected: OpCodes.Hex8ToBytes("ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d17d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923")
      },
      {
        text: "RFC 7693 Test Vector - MAC mode",
        uri: "https://tools.ietf.org/html/rfc7693",
        input: OpCodes.Hex8ToBytes(""),
        key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
        expected: OpCodes.Hex8ToBytes("10ebb67700b1868efb4417987acf4690ae9d972fb7a590c2f02871799aaa4786b5e996e8f0f4eb981fc214b005f42d2ff4233499391653df7aefcbc13fc51568")
      }
    ],
    
    Init: function() {
      return true;
    },

    // Core BLAKE2b computation
    // Required interface method for hash functions
    Hash: function(data, key, outputLength) {
      return this.compute(data, key, outputLength);
    },

    compute: function(data, key, outputLength) {
      outputLength = outputLength || BLAKE2B_OUTBYTES;
      const hasher = new Blake2bHasher(key, outputLength);
      hasher.update(data);
      return hasher.finalize();
    }
  };
  
  // Auto-register with Subsystem (according to category) if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(Blake2b);
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Blake2b;
  }
  
  // Export to global scope
  global.Blake2b = Blake2b;

})(typeof global !== 'undefined' ? global : window);