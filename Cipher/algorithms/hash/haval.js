#!/usr/bin/env node
/*
 * HAVAL Universal Hash Function Implementation
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * HAVAL (HAsh of Variable Length) is a cryptographic hash function designed by
 * Yuliang Zheng, Josef Pieprzyk, and Jennifer Seberry in 1992. It produces
 * hash values of 128, 160, 192, 224, or 256 bits and supports 3, 4, or 5
 * passes over the data.
 * 
 * Specification: "HAVAL - A One-Way Hashing Algorithm with Variable Length of Output" (1992)
 * Reference: https://web.archive.org/web/20171129084214/http://labs.calyptix.com/haval.php
 * Patent: US Patent 5,351,310 (expired)
 * Analysis: https://link.springer.com/chapter/10.1007/3-540-48329-2_24
 * 
 * Features:
 * - Variable output length (128, 160, 192, 224, 256 bits)
 * - Variable number of passes (3, 4, or 5)
 * - 1024-bit blocks (128 bytes)
 * - Based on MD4/MD5 design principles
 * - Eight 32-bit working variables
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
  
  // HAVAL constants
  const HAVAL_BLOCKSIZE = 128;      // 1024 bits
  const HAVAL_WORDS_PER_BLOCK = 32; // 32 words of 32 bits each
  const HAVAL_VERSION = 1;          // HAVAL version
  
  // Initial values for HAVAL (8 words)
  const IV = [
    0x243F6A88, 0x85A308D3, 0x13198A2E, 0x03707344,
    0xA4093822, 0x299F31D0, 0x082EFA98, 0xEC4E6C89
  ];
  
  // HAVAL message ordering for different passes
  const ORDER = [
    // Pass 1
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
     16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
    // Pass 2  
    [5, 14, 26, 18, 11, 28, 7, 16, 0, 23, 20, 22, 1, 10, 4, 8,
     30, 3, 21, 9, 17, 24, 29, 6, 19, 12, 15, 13, 2, 25, 31, 27],
    // Pass 3
    [19, 9, 4, 20, 28, 17, 8, 22, 29, 14, 25, 12, 24, 30, 16, 26,
     31, 15, 7, 3, 1, 0, 18, 27, 13, 6, 21, 10, 23, 11, 5, 2],
    // Pass 4
    [24, 4, 0, 14, 2, 7, 28, 23, 26, 6, 30, 20, 18, 25, 19, 3,
     22, 11, 31, 21, 8, 27, 12, 9, 1, 29, 5, 15, 17, 10, 16, 13],
    // Pass 5
    [27, 3, 21, 26, 17, 11, 20, 29, 19, 0, 12, 7, 13, 8, 31, 10,
     5, 9, 14, 30, 18, 6, 28, 24, 2, 23, 16, 22, 4, 1, 25, 15]
  ];
  
  // HAVAL shift amounts for different passes
  const SHIFT = [
    // Pass 1
    [11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
     7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12],
    // Pass 2
    [7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
     11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5],
    // Pass 3
    [11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
     11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12],
    // Pass 4
    [9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6,
     15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8],
    // Pass 5
    [8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11,
     9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5]
  ];
  
  /**
   * HAVAL auxiliary functions for different passes
   */
  function F1(x6, x5, x4, x3, x2, x1, x0) {
    return (x1 & (x0 ^ x4)) ^ (x2 & x5) ^ (x3 & x6) ^ x0;
  }
  
  function F2(x6, x5, x4, x3, x2, x1, x0) {
    return (x2 & (x1 & ~x3 ^ x4 & x5 ^ x6 ^ x0)) ^ (x4 & (x1 ^ x5)) ^ (x3 & x5) ^ x0;
  }
  
  function F3(x6, x5, x4, x3, x2, x1, x0) {
    return (x3 & (x1 & x2 ^ x6 ^ x0)) ^ (x1 & x4) ^ (x2 & x5) ^ x0;
  }
  
  function F4(x6, x5, x4, x3, x2, x1, x0) {
    return (x4 & (x5 & ~x2 ^ x3 & ~x6 ^ x1 ^ x6 ^ x0)) ^ (x3 & (x1 & x2 ^ x5 ^ x6)) ^ (x2 & x6) ^ x0;
  }
  
  function F5(x6, x5, x4, x3, x2, x1, x0) {
    return (x0 & (x1 & x2 & x3 ^ ~x5)) ^ (x1 & x4) ^ (x2 & x5) ^ (x3 & x6);
  }
  
  const F_FUNCTIONS = [F1, F2, F3, F4, F5];
  
  /**
   * HAVAL constants for different passes
   */
  const K = [
    0x00000000, // Pass 1
    0x5A827999, // Pass 2
    0x6ED9EBA1, // Pass 3
    0x8F1BBCDC, // Pass 4
    0xA953FD4E  // Pass 5
  ];
  
  /**
   * HAVAL hasher class
   */
  function HavalHasher(passes, outputBits) {
    // Validate parameters
    if (![3, 4, 5].includes(passes)) {
      throw new Error('HAVAL passes must be 3, 4, or 5');
    }
    if (![128, 160, 192, 224, 256].includes(outputBits)) {
      throw new Error('HAVAL output bits must be 128, 160, 192, 224, or 256');
    }
    
    this.passes = passes;
    this.outputBits = outputBits;
    this.digestBytes = outputBits / 8;
    
    // Initialize state with HAVAL IVs
    this.state = IV.slice();
    this.buffer = new Uint8Array(HAVAL_BLOCKSIZE);
    this.bufferLength = 0;
    this.totalLength = 0;
  }
  
  HavalHasher.prototype.update = function(data) {
    if (typeof data === 'string') {
      data = OpCodes.StringToBytes(data);
    }
    
    this.totalLength += data.length;
    let offset = 0;
    
    // Fill buffer first
    while (offset < data.length && this.bufferLength < HAVAL_BLOCKSIZE) {
      this.buffer[this.bufferLength++] = data[offset++];
    }
    
    // Process full buffer
    if (this.bufferLength === HAVAL_BLOCKSIZE) {
      this.processBlock(this.buffer);
      this.bufferLength = 0;
    }
    
    // Process remaining full blocks
    while (offset + HAVAL_BLOCKSIZE <= data.length) {
      const block = data.slice(offset, offset + HAVAL_BLOCKSIZE);
      this.processBlock(block);
      offset += HAVAL_BLOCKSIZE;
    }
    
    // Store remaining bytes in buffer
    while (offset < data.length) {
      this.buffer[this.bufferLength++] = data[offset++];
    }
  };
  
  HavalHasher.prototype.processBlock = function(block) {
    // Convert block to 32-bit words (little-endian)
    const X = new Array(HAVAL_WORDS_PER_BLOCK);
    for (let i = 0; i < HAVAL_WORDS_PER_BLOCK; i++) {
      X[i] = OpCodes.Pack32LE(
        block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]
      );
    }
    
    // Initialize working variables
    let [t0, t1, t2, t3, t4, t5, t6, t7] = this.state;
    
    // Perform the specified number of passes
    for (let pass = 0; pass < this.passes; pass++) {
      const order = ORDER[pass];
      const shift = SHIFT[pass];
      const f = F_FUNCTIONS[pass];
      const k = K[pass];
      
      for (let round = 0; round < 32; round++) {
        const temp = ((f(t6, t5, t4, t3, t2, t1, t0) + X[order[round]] + k) >>> 0);
        const rotated = OpCodes.RotR32(temp, shift[round]);
        
        // Rotate working variables
        t7 = t6; t6 = t5; t5 = t4; t4 = t3;
        t3 = t2; t2 = t1; t1 = t0; t0 = rotated;
      }
    }
    
    // Add to state (feedforward)
    this.state[0] = (this.state[0] + t0) >>> 0;
    this.state[1] = (this.state[1] + t1) >>> 0;
    this.state[2] = (this.state[2] + t2) >>> 0;
    this.state[3] = (this.state[3] + t3) >>> 0;
    this.state[4] = (this.state[4] + t4) >>> 0;
    this.state[5] = (this.state[5] + t5) >>> 0;
    this.state[6] = (this.state[6] + t6) >>> 0;
    this.state[7] = (this.state[7] + t7) >>> 0;
  };
  
  HavalHasher.prototype.finalize = function() {
    // HAVAL padding: append length info, 0x01, padding, then final block
    const bitLength = this.totalLength * 8;
    const paddingStart = this.bufferLength;
    
    // Append HAVAL version (4 bits), passes (4 bits), and output bits (8 bits) 
    this.buffer[paddingStart] = (HAVAL_VERSION << 4) | this.passes;
    this.buffer[paddingStart + 1] = (this.outputBits >>> 3) & 0xFF; // Convert bits to bytes
    
    // Append 0x01 padding marker
    let paddingPos = paddingStart + 2;
    this.buffer[paddingPos++] = 0x01;
    
    // Calculate remaining padding needed
    const totalUsed = paddingPos + 10; // +10 for length (10 bytes: 2 for HAVAL info + 8 for length)
    const paddingLength = HAVAL_BLOCKSIZE - (totalUsed % HAVAL_BLOCKSIZE);
    
    // Add zero padding
    for (let i = 0; i < paddingLength; i++) {
      if (paddingPos < HAVAL_BLOCKSIZE) {
        this.buffer[paddingPos++] = 0x00;
      }
    }
    
    // Process current block if it's full
    if (paddingPos >= HAVAL_BLOCKSIZE) {
      this.processBlock(this.buffer);
      this.buffer.fill(0);
      paddingPos = 0;
    }
    
    // Ensure we have room for 8-byte length
    if (paddingPos > HAVAL_BLOCKSIZE - 8) {
      // Pad to end of block and process
      while (paddingPos < HAVAL_BLOCKSIZE) {
        this.buffer[paddingPos++] = 0x00;
      }
      this.processBlock(this.buffer);
      this.buffer.fill(0);
      paddingPos = 0;
    }
    
    // Pad to position for length
    while (paddingPos < HAVAL_BLOCKSIZE - 8) {
      this.buffer[paddingPos++] = 0x00;
    }
    
    // Append length as 64-bit little-endian
    for (let i = 0; i < 8; i++) {
      this.buffer[paddingPos + i] = (bitLength >>> (i * 8)) & 0xFF;
    }
    
    this.processBlock(this.buffer);
    
    // Extract hash value based on output length
    const result = new Uint8Array(this.digestBytes);
    const numWords = Math.ceil(this.digestBytes / 4);
    
    for (let i = 0; i < numWords; i++) {
      const bytes = OpCodes.Unpack32LE(this.state[i]);
      for (let j = 0; j < 4 && i * 4 + j < this.digestBytes; j++) {
        result[i * 4 + j] = bytes[j];
      }
    }
    
    return result;
  };
  
  // HAVAL Universal Cipher Interface
  const Haval = {
    internalName: 'haval',
    name: 'HAVAL',
    // Algorithm metadata
    blockSize: 1024,
    digestSize: 256,
    keySize: 0,
    rounds: 160, // 5 passes × 32 rounds
    
    // Security level
    securityLevel: 128,
    
    // Reference links
    referenceLinks: [
      {
        title: "HAVAL - A One-Way Hashing Algorithm with Variable Length of Output",
        url: "https://web.archive.org/web/20171129084214/http://labs.calyptix.com/haval.php",
        type: "specification"
      },
      {
        title: "US Patent 5,351,310 - HAVAL",
        url: "https://patents.google.com/patent/US5351310A/en",
        type: "patent"
      },
      {
        title: "Cryptanalysis of HAVAL",
        url: "https://link.springer.com/chapter/10.1007/3-540-48329-2_24",
        type: "analysis"
      },
      {
        title: "Hash Function Cryptanalysis",
        url: "https://csrc.nist.gov/projects/hash-functions",
        type: "reference"
      }
    ],
    
    // Test vectors
    testVectors: [
      {
        description: "Empty string - HAVAL-256/5",
        input: "",
        expected: "be417bb4dd5cfb76c7126f4f8eeb1553a449039307b1a3cd451dbfdc0fbbe330"
      },
      {
        description: "Single letter 'a' - HAVAL-256/5",
        input: "a",
        expected: "de8fd5ee72a5e4265af0a756f4e1a1f65c9b2b2f06c63aa04eae9914ca7e8025"
      },
      {
        description: "String 'abc' - HAVAL-128/3",
        input: "abc",
        expected: "0cd40739683e15f01ca5dbceef4059f1"
      }
    ],
    
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
      this.hasher = new HavalHasher(5, 256); // Default: 5 passes, 256 bits
      this.bKey = false;
    },
    
    KeySetup: function(key) {
      // HAVAL doesn't use keys in standard mode
      this.hasher = new HavalHasher(5, 256);
      this.bKey = false;
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
    
    // Direct hash interface with configurable parameters
    hash: function(data, passes, outputBits) {
      const hasher = new HavalHasher(passes || 5, outputBits || 256);
      hasher.update(data);
      return hasher.finalize();
    },
    
    // Convenient preset variants
    hash128: function(data, passes) {
      return this.hash(data, passes || 3, 128);
    },
    
    hash160: function(data, passes) {
      return this.hash(data, passes || 4, 160);
    },
    
    hash192: function(data, passes) {
      return this.hash(data, passes || 4, 192);
    },
    
    hash224: function(data, passes) {
      return this.hash(data, passes || 4, 224);
    },
    
    hash256: function(data, passes) {
      return this.hash(data, passes || 5, 256);
    },
    
    ClearData: function() {
      if (this.hasher) {
        this.hasher.state.fill(0);
        this.hasher.buffer.fill(0);
      }
      this.bKey = false;
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(Haval);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Haval;
  }
  
  // Make available globally
  global.Haval = Haval;
  
})(typeof global !== 'undefined' ? global : window);