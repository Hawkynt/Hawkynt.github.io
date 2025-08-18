/*
 * BLAKE2s Implementation
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const Blake2s = {
    name: "BLAKE2s",
    description: "High-speed cryptographic hash function optimized for 8-32 bit platforms. 32-bit version of BLAKE2.",
    inventor: "Jean-Philippe Aumasson, Samuel Neves, Zooko Wilcox-O'Hearn, Christian Winnerlein",
    year: 2012,
    country: "CH",
    category: "hash",
    subCategory: "Cryptographic Hash",
    securityStatus: null,
    securityNotes: "BLAKE2s is a modern hash function with excellent security properties. Educational implementation - use proven libraries for production.",
    
    documentation: [
      {text: "RFC 7693 - BLAKE2 Cryptographic Hash and MAC", uri: "https://tools.ietf.org/html/rfc7693"},
      {text: "BLAKE2 Official Specification", uri: "https://blake2.net/blake2.pdf"},
      {text: "Wikipedia BLAKE2", uri: "https://en.wikipedia.org/wiki/BLAKE_(hash_function)#BLAKE2"}
    ],
    
    references: [
      {text: "BLAKE2 Reference Implementation", uri: "https://github.com/BLAKE2/BLAKE2"},
      {text: "WireGuard Protocol", uri: "https://www.wireguard.com/papers/wireguard.pdf"}
    ],
    
    knownVulnerabilities: [],
    
    tests: [
      {
        text: "RFC 7693 Test Vector - Empty string",
        uri: "https://tools.ietf.org/html/rfc7693",
        input: OpCodes.Hex8ToBytes(""),
        key: null,
        expected: OpCodes.Hex8ToBytes("69217a3079908094e11121d042354a7c1f55b6482ca1a51e1b250dfd1ed0eef9")
      },
      {
        text: "RFC 7693 Test Vector - abc",
        uri: "https://tools.ietf.org/html/rfc7693",
        input: OpCodes.ANSIToBytes("abc"),
        key: null,
        expected: OpCodes.Hex8ToBytes("508c5e8c327c14e2e1a72ba34eeb452f37458b209ed63a294d999b4c86675982")
      }
    ],

    Init: function() {
      return true;
    },

    // BLAKE2s constants
    BLAKE2S_BLOCKBYTES: 64,
    BLAKE2S_OUTBYTES: 32,
    BLAKE2S_KEYBYTES: 32,
    
    // BLAKE2s initialization vectors
    IV: [
      0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
      0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19
    ],
    
    // BLAKE2s sigma permutation schedule
    SIGMA: [
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
    ],

    // Core BLAKE2s computation
    compute: function(data, key, outputLength) {
      outputLength = outputLength || this.BLAKE2S_OUTBYTES;
      const hasher = new Blake2sHasher(key, outputLength);
      hasher.update(data);
      return hasher.finalize();
    }
  };

  /**
   * BLAKE2s G function (mixing function)
   */
  function G(v, a, b, c, d, x, y) {
    v[a] = (v[a] + v[b] + x) >>> 0;
    v[d] = OpCodes.RotR32(v[d] ^ v[a], 16);
    v[c] = (v[c] + v[d]) >>> 0;
    v[b] = OpCodes.RotR32(v[b] ^ v[c], 12);
    v[a] = (v[a] + v[b] + y) >>> 0;
    v[d] = OpCodes.RotR32(v[d] ^ v[a], 8);
    v[c] = (v[c] + v[d]) >>> 0;
    v[b] = OpCodes.RotR32(v[b] ^ v[c], 7);
  }

  /**
   * BLAKE2s compression function
   */
  function compress(h, m, t0, t1, f) {
    const v = new Uint32Array(16);
    
    // Initialize working vector
    for (let i = 0; i < 8; i++) {
      v[i] = h[i];
    }
    for (let i = 0; i < 8; i++) {
      v[i + 8] = Blake2s.IV[i];
    }
    
    // Mix counter and final flag
    v[12] ^= t0;
    v[13] ^= t1;
    if (f) {
      v[14] ^= 0xFFFFFFFF;
    }
    
    // 10 rounds of mixing
    for (let round = 0; round < 10; round++) {
      const s = Blake2s.SIGMA[round];
      
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
   * BLAKE2s hasher class
   */
  function Blake2sHasher(key, outputLength) {
    this.outputLength = outputLength || Blake2s.BLAKE2S_OUTBYTES;
    this.key = key || null;
    this.h = new Uint32Array(8);
    this.buffer = new Uint8Array(Blake2s.BLAKE2S_BLOCKBYTES);
    this.bufferLength = 0;
    this.t0 = 0; // Low 32 bits of counter
    this.t1 = 0; // High 32 bits of counter
    
    // Initialize hash state
    for (let i = 0; i < 8; i++) {
      this.h[i] = Blake2s.IV[i];
    }
    
    // Set parameter block in h[0]
    this.h[0] ^= this.outputLength |
                 ((key ? key.length : 0) << 8) |
                 (1 << 16) |  // fanout = 1
                 (1 << 24);   // depth = 1
    
    // Process key if provided
    if (key && key.length > 0) {
      const keyPadded = new Uint8Array(Blake2s.BLAKE2S_BLOCKBYTES);
      for (let i = 0; i < key.length && i < Blake2s.BLAKE2S_KEYBYTES; i++) {
        keyPadded[i] = key[i];
      }
      this.update(keyPadded);
    }
  }

  Blake2sHasher.prototype.update = function(data) {
    if (typeof data === 'string') {
      data = OpCodes.StringToBytes(data);
    }
    
    let offset = 0;
    
    while (offset < data.length) {
      const remaining = Blake2s.BLAKE2S_BLOCKBYTES - this.bufferLength;
      const toCopy = Math.min(remaining, data.length - offset);
      
      // Copy data to buffer
      for (let i = 0; i < toCopy; i++) {
        this.buffer[this.bufferLength + i] = data[offset + i];
      }
      
      this.bufferLength += toCopy;
      offset += toCopy;
      
      // Process full blocks
      if (this.bufferLength === Blake2s.BLAKE2S_BLOCKBYTES) {
        // Increment counter (64-bit addition)
        this.t0 += Blake2s.BLAKE2S_BLOCKBYTES;
        if (this.t0 < Blake2s.BLAKE2S_BLOCKBYTES) {
          this.t1++; // Overflow
        }
        
        // Convert buffer to 32-bit words (little-endian)
        const m = new Uint32Array(16);
        for (let i = 0; i < 16; i++) {
          m[i] = OpCodes.Pack32LE(
            this.buffer[i * 4],
            this.buffer[i * 4 + 1],
            this.buffer[i * 4 + 2],
            this.buffer[i * 4 + 3]
          );
        }
        
        compress(this.h, m, this.t0, this.t1, false);
        this.bufferLength = 0;
      }
    }
  };

  Blake2sHasher.prototype.finalize = function() {
    // Increment counter for final block
    this.t0 += this.bufferLength;
    if (this.t0 < this.bufferLength) {
      this.t1++; // Overflow
    }
    
    // Pad final block with zeros
    for (let i = this.bufferLength; i < Blake2s.BLAKE2S_BLOCKBYTES; i++) {
      this.buffer[i] = 0;
    }
    
    // Convert buffer to 32-bit words (little-endian)
    const m = new Uint32Array(16);
    for (let i = 0; i < 16; i++) {
      m[i] = OpCodes.Pack32LE(
        this.buffer[i * 4],
        this.buffer[i * 4 + 1],
        this.buffer[i * 4 + 2],
        this.buffer[i * 4 + 3]
      );
    }
    
    compress(this.h, m, this.t0, this.t1, true);
    
    // Convert hash state to bytes (little-endian)
    const output = new Uint8Array(this.outputLength);
    for (let i = 0; i < this.outputLength; i++) {
      const wordIndex = Math.floor(i / 4);
      const byteIndex = i % 4;
      const word = this.h[wordIndex];
      output[i] = (word >>> (byteIndex * 8)) & 0xFF;
    }
    
    return output;
  };

  // Auto-register with Subsystem (according to category) if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(Blake2s);
  

})(typeof global !== 'undefined' ? global : window);