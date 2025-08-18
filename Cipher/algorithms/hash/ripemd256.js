#!/usr/bin/env node
/*
 * RIPEMD-256 Implementation
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Load OpCodes library for common operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes.js:', e.message);
      return;
    }
  }
  
  // Ensure environment dependencies are available
  if (!global.Cipher) {
    if (typeof require !== 'undefined') {
      try {
        require('../../universal-cipher-env.js');
        require('../../cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('RIPEMD-256 requires Cipher system to be loaded first');
      return;
    }
  }
  
  // RIPEMD-256 constants
  const BLOCK_SIZE = 64;        // 512 bits
  const HASH_SIZE = 32;         // 256 bits
  const ROUNDS = 80;            // 80 rounds total (2 lines of 40 each)
  
  // Initial hash values (256-bit)
  const H0 = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476,
              0x76543210, 0xFEDCBA98, 0x89ABCDEF, 0x01234567];
  
  // Selection of message word for left line
  const RL = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
    3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
    1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
    4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13
  ];
  
  // Selection of message word for right line
  const RR = [
    5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
    6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
    15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
    8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
    12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11
  ];
  
  // Amount of left rotate for left line
  const SL = [
    11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
    7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
    11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
    11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
    9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6
  ];
  
  // Amount of left rotate for right line
  const SR = [
    8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
    9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
    9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
    15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
    8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11
  ];
  
  // Constants for left line
  const KL = [0x00000000, 0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xA953FD4E];
  
  // Constants for right line
  const KR = [0x50A28BE6, 0x5C4DD124, 0x6D703EF3, 0x7A6D76E9, 0x00000000];
  
  /**
   * RIPEMD-256 auxiliary functions
   */
  function F(j, x, y, z) {
    if (j < 16) return x ^ y ^ z;
    if (j < 32) return (x & y) | (~x & z);
    if (j < 48) return (x | ~y) ^ z;
    if (j < 64) return (x & z) | (y & ~z);
    return x ^ (y | ~z);
  }
  
  /**
   * RIPEMD-256 hasher class
   */
  function RIPEMD256Hasher() {
    this.state = H0.slice();
    this.buffer = new Uint8Array(BLOCK_SIZE);
    this.bufferLength = 0;
    this.totalLength = 0;
  }
  
  RIPEMD256Hasher.prototype.update = function(data) {
    if (typeof data === 'string') {
      data = OpCodes.StringToBytes(data);
    }
    
    this.totalLength += data.length;
    let offset = 0;
    
    // Fill buffer first
    while (offset < data.length && this.bufferLength < BLOCK_SIZE) {
      this.buffer[this.bufferLength++] = data[offset++];
    }
    
    // Process full buffer
    if (this.bufferLength === BLOCK_SIZE) {
      this.processBlock(this.buffer);
      this.bufferLength = 0;
    }
    
    // Process remaining full blocks
    while (offset + BLOCK_SIZE <= data.length) {
      const block = data.slice(offset, offset + BLOCK_SIZE);
      this.processBlock(block);
      offset += BLOCK_SIZE;
    }
    
    // Store remaining bytes in buffer
    while (offset < data.length) {
      this.buffer[this.bufferLength++] = data[offset++];
    }
  };
  
  RIPEMD256Hasher.prototype.processBlock = function(block) {
    // Convert block to 32-bit words (little-endian)
    const X = new Array(16);
    for (let i = 0; i < 16; i++) {
      X[i] = OpCodes.Pack32LE(
        block[i * 4],
        block[i * 4 + 1],
        block[i * 4 + 2],
        block[i * 4 + 3]
      );
    }
    
    // Initialize working variables
    let AL = this.state[0], BL = this.state[1], CL = this.state[2], DL = this.state[3];
    let AR = this.state[4], BR = this.state[5], CR = this.state[6], DR = this.state[7];
    
    // 80 rounds (40 left + 40 right)
    for (let j = 0; j < 80; j++) {
      // Left line
      let T = OpCodes.AddMod(
        OpCodes.AddMod(
          OpCodes.AddMod(AL, F(j, BL, CL, DL)),
          X[RL[j]]
        ),
        KL[Math.floor(j / 16)]
      );
      T = OpCodes.RotL32(T, SL[j]);
      AL = DL; DL = CL; CL = BL; BL = T;
      
      // Right line
      T = OpCodes.AddMod(
        OpCodes.AddMod(
          OpCodes.AddMod(AR, F(79 - j, BR, CR, DR)),
          X[RR[j]]
        ),
        KR[Math.floor(j / 16)]
      );
      T = OpCodes.RotL32(T, SR[j]);
      AR = DR; DR = CR; CR = BR; BR = T;
    }
    
    // Combine results
    const T = OpCodes.AddMod(this.state[1], OpCodes.AddMod(CL, DR));
    this.state[1] = OpCodes.AddMod(this.state[2], OpCodes.AddMod(DL, AR));
    this.state[2] = OpCodes.AddMod(this.state[3], OpCodes.AddMod(AL, BR));
    this.state[3] = OpCodes.AddMod(this.state[4], OpCodes.AddMod(BL, CR));
    this.state[4] = OpCodes.AddMod(this.state[5], OpCodes.AddMod(CL, DR));
    this.state[5] = OpCodes.AddMod(this.state[6], OpCodes.AddMod(DL, AR));
    this.state[6] = OpCodes.AddMod(this.state[7], OpCodes.AddMod(AL, BR));
    this.state[7] = OpCodes.AddMod(this.state[0], OpCodes.AddMod(BL, CR));
    this.state[0] = T;
  };
  
  RIPEMD256Hasher.prototype.finalize = function() {
    // Padding
    const totalBits = this.totalLength * 8;
    const paddingLength = (this.bufferLength < 56) ? 
      56 - this.bufferLength : 120 - this.bufferLength;
    
    // Add padding
    this.buffer[this.bufferLength] = 0x80;
    for (let i = this.bufferLength + 1; i < this.bufferLength + paddingLength; i++) {
      this.buffer[i] = 0x00;
    }
    
    // Add length (little-endian 64-bit)
    const lengthBlock = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
      lengthBlock[i] = (totalBits >>> (i * 8)) & 0xFF;
    }
    
    // Process final block(s)
    if (this.bufferLength + paddingLength + 8 > BLOCK_SIZE) {
      this.processBlock(this.buffer.slice(0, BLOCK_SIZE));
      
      // Create new block with length
      const finalBlock = new Uint8Array(BLOCK_SIZE);
      const remainingPadding = this.bufferLength + paddingLength - BLOCK_SIZE;
      for (let i = 0; i < remainingPadding; i++) {
        finalBlock[i] = 0x00;
      }
      for (let i = 0; i < 8; i++) {
        finalBlock[remainingPadding + i] = lengthBlock[i];
      }
      this.processBlock(finalBlock);
    } else {
      // Add length to current buffer
      for (let i = 0; i < 8; i++) {
        this.buffer[this.bufferLength + paddingLength + i] = lengthBlock[i];
      }
      this.processBlock(this.buffer);
    }
    
    // Convert hash to bytes (little-endian)
    const hash = new Uint8Array(HASH_SIZE);
    for (let i = 0; i < 8; i++) {
      const bytes = OpCodes.Unpack32LE(this.state[i]);
      for (let j = 0; j < 4; j++) {
        hash[i * 4 + j] = bytes[j];
      }
    }
    
    return hash;
  };
  
  const RIPEMD256 = {
    name: "RIPEMD-256",
    description: "Extended RIPEMD hash function producing 256-bit digest. Part of the RIPEMD family designed as European alternative to MD/SHA family. Uses dual 128-bit computation lines for enhanced security.",
    inventor: "Hans Dobbertin, Antoon Bosselaers, Bart Preneel",
    year: 1996,
    country: "BE",
    category: "hash",
    subCategory: "Cryptographic Hash",
    securityStatus: null,
    securityNotes: "Less analyzed than mainstream hash functions. Designed with dual pipeline structure for collision resistance.",
    
    documentation: [
      {text: "RIPEMD-160: A Strengthened Version of RIPEMD", uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"},
      {text: "ISO/IEC 10118-3:2004 Standard", uri: "https://www.iso.org/standard/39876.html"},
      {text: "RIPEMD Family Analysis", uri: "https://en.wikipedia.org/wiki/RIPEMD"}
    ],
    
    references: [
      {text: "OpenSSL RIPEMD Implementation", uri: "https://github.com/openssl/openssl/tree/master/crypto/ripemd"},
      {text: "Bouncy Castle Java Implementation", uri: "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/digests/RIPEMD256Digest.java"},
      {text: "RIPEMD Specification", uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"}
    ],
    
    knownVulnerabilities: [],
    
    tests: [
      {
        text: "Empty string test vector",
        uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html",
        input: [],
        expected: OpCodes.Hex8ToBytes("02ba4c4e5f8ecd1877fc52d64d30e37a2d9774fb1e5d026380ae0168e3c5522d")
      },
      {
        text: "Single character 'a' test vector",
        uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html",
        input: OpCodes.StringToBytes("a"),
        expected: OpCodes.Hex8ToBytes("f9333e45d857f5d90a91bab70a1eba0cfb1be4b0783c9acfcd883a9134692925")
      },
      {
        text: "String 'abc' test vector",
        uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html",
        input: OpCodes.StringToBytes("abc"),
        expected: OpCodes.Hex8ToBytes("afbd6e228b9d8cbbcef5ca2d03e6dba10ac0bc7dcbe4680e1e42d2e975459b65")
      },
      {
        text: "Message 'message digest' test vector",
        uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html",
        input: OpCodes.StringToBytes("message digest"),
        expected: OpCodes.Hex8ToBytes("87e971759a1ce47a514d5c914c392c9018c7c46bc14465554afcdf54a5070c0e")
      },
      {
        text: "Alphabet test vector",
        uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html",
        input: OpCodes.StringToBytes("abcdefghijklmnopqrstuvwxyz"),
        expected: OpCodes.Hex8ToBytes("649d3034751ea216776bf9a18acc81bc7896118a5197968782dd1fd97d8d5133")
      }
    ],

    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    
    // Hash function interface
    Init: function() {
      this.hasher = new RIPEMD256Hasher();
      this.bKey = false;
    },
    
    KeySetup: function(keyData) {
      // Hash functions don't use keys
      this.bKey = false;
      return true;
    },
    
    Encode: function(data) {
      if (!this.hasher) {
        throw new Error('RIPEMD-256 not initialized');
      }
      
      this.hasher.update(data);
      const hash = this.hasher.finalize();
      
      // Reset for next use
      this.hasher = new RIPEMD256Hasher();
      
      return OpCodes.BytesToString(Array.from(hash));
    },
    
    Decode: function(data) {
      throw new Error('Hash functions cannot decode');
    },
    
    ClearData: function() {
      if (this.hasher) {
        this.hasher = new RIPEMD256Hasher();
      }
    },
    
    // Legacy interface for compatibility
    encryptBlock: function(dataOffset, data) {
      return this.Encode(data);
    },
    
    decryptBlock: function(dataOffset, data) {
      throw new Error('Hash functions cannot decrypt');
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(RIPEMD256);
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RIPEMD256;
  }
  
  // Global access
  global.RIPEMD256 = RIPEMD256;
  
})(typeof global !== 'undefined' ? global : window);