#!/usr/bin/env node
/*
 * RIPEMD-160 Implementation
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
  
  // Ensure environment dependencies are available
  if (!global.Cipher) {
    if (typeof require !== 'undefined') {
      // Node.js environment - load dependencies
      try {
        require('../../universal-cipher-env.js');
        require('../../cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('RIPEMD-160 requires Cipher system to be loaded first');
      return;
    }
  }
  
  const RIPEMD160 = {
    name: "RIPEMD-160",
    description: "RACE Integrity Primitives Evaluation Message Digest with 160-bit output. Developed as a European alternative to SHA-1 with different design principles. Produces a 160-bit hash digest.",
    inventor: "Hans Dobbertin, Antoon Bosselaers, Bart Preneel",
    year: 1996,
    country: "BE",
    category: "hash",
    subCategory: "Cryptographic Hash",
    securityStatus: null,
    securityNotes: "Generally considered secure but less analyzed than SHA-256. Designed as SHA-1 alternative with different structure.",
    
    documentation: [
      {text: "RIPEMD-160: A Strengthened Version of RIPEMD", uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"},
      {text: "ISO/IEC 10118-3:2004 Standard", uri: "https://www.iso.org/standard/39876.html"},
      {text: "Wikipedia Article", uri: "https://en.wikipedia.org/wiki/RIPEMD"}
    ],
    
    references: [
      {text: "OpenSSL Implementation", uri: "https://github.com/openssl/openssl/tree/master/crypto/ripemd"},
      {text: "Bouncy Castle Java Implementation", uri: "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/digests/RIPEMD160Digest.java"},
      {text: "Original Specification", uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"}
    ],
    
    knownVulnerabilities: [],
    
    tests: [
      {
        text: "Empty string test vector",
        uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html",
        input: [],
        expected: OpCodes.Hex8ToBytes("9c1185a5c5e9fc54612808977ee8f548b2258d31")
      },
      {
        text: "Single character 'a' test vector", 
        uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html",
        input: OpCodes.StringToBytes("a"),
        expected: OpCodes.Hex8ToBytes("0bdc9d2d256b3ee9daae347be6f4dc835a467ffe")
      },
      {
        text: "String 'abc' test vector",
        uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html",
        input: OpCodes.StringToBytes("abc"),
        expected: OpCodes.Hex8ToBytes("8eb208f7e05d987a9b044a8e98c6b087f15a0bfc")
      },
      {
        text: "Message 'message digest' test vector",
        uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html",
        input: OpCodes.StringToBytes("message digest"),
        expected: OpCodes.Hex8ToBytes("5d0689ef49d2fae572b881b123a85ffa21595f36")
      },
      {
        text: "Alphabet test vector",
        uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html",
        input: OpCodes.StringToBytes("abcdefghijklmnopqrstuvwxyz"),
        expected: OpCodes.Hex8ToBytes("f71c27109c692c1b56bbdceb5b9d2865b3708dbc")
      }
    ],

    // Required cipher interface properties
    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 1,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    
    // Hash state variables
    _h: null,
    _buffer: null,
    _length: 0,
    _bufferLength: 0,
    
    /**
     * RIPEMD-160 auxiliary functions
     */
    _f: function(j, x, y, z) {
      if (j < 16) return x ^ y ^ z;
      if (j < 32) return (x & y) | (~x & z);
      if (j < 48) return (x | ~y) ^ z;
      if (j < 64) return (x & z) | (y & ~z);
      return x ^ (y | ~z);
    },
    
    _K: function(j) {
      if (j < 16) return 0x00000000;
      if (j < 32) return 0x5A827999;
      if (j < 48) return 0x6ED9EBA1;
      if (j < 64) return 0x8F1BBCDC;
      return 0xA953FD4E;
    },
    
    _Kh: function(j) {
      if (j < 16) return 0x50A28BE6;
      if (j < 32) return 0x5C4DD124;
      if (j < 48) return 0x6D703EF3;
      if (j < 64) return 0x7A6D76E9;
      return 0x00000000;
    },
    
    /**
     * Initialize the hash state with standard RIPEMD-160 initial values
     */
    Init: function() {
      // Initial hash values
      this._h = [
        0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0
      ];
      
      this._buffer = new Array(64);
      this._length = 0;
      this._bufferLength = 0;
      
      // Clear buffer
      OpCodes.ClearArray(this._buffer);
    },
    
    /**
     * Process a single 512-bit (64-byte) message block
     * @param {Array} block - 64-byte message block
     */
    _processBlock: function(block) {
      // Convert block to 16 32-bit words (little-endian)
      const X = new Array(16);
      for (let i = 0; i < 16; i++) {
        X[i] = OpCodes.Pack32LE(block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]);
      }
      
      // Initialize working variables
      let AL = this._h[0], BL = this._h[1], CL = this._h[2], DL = this._h[3], EL = this._h[4];
      let AR = this._h[0], BR = this._h[1], CR = this._h[2], DR = this._h[3], ER = this._h[4];
      
      // Message schedule permutations
      const r = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13];
      const rh = [5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11];
      
      // Rotation amounts
      const s = [11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,9,15,8,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11];
      const sh = [8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11];
      
      // Main computation
      for (let j = 0; j < 80; j++) {
        // Left line
        let T = (AL + this._f(j, BL, CL, DL) + X[r[j]] + this._K(j)) >>> 0;
        T = OpCodes.RotL32(T, s[j]) + EL;
        T = T >>> 0;
        AL = EL; EL = DL; DL = OpCodes.RotL32(CL, 10); CL = BL; BL = T;
        
        // Right line
        T = (AR + this._f(79 - j, BR, CR, DR) + X[rh[j]] + this._Kh(j)) >>> 0;
        T = OpCodes.RotL32(T, sh[j]) + ER;
        T = T >>> 0;
        AR = ER; ER = DR; DR = OpCodes.RotL32(CR, 10); CR = BR; BR = T;
      }
      
      // Final addition
      const T = (this._h[1] + CL + DR) >>> 0;
      this._h[1] = (this._h[2] + DL + ER) >>> 0;
      this._h[2] = (this._h[3] + EL + AR) >>> 0;
      this._h[3] = (this._h[4] + AL + BR) >>> 0;
      this._h[4] = (this._h[0] + BL + CR) >>> 0;
      this._h[0] = T;
    },
    
    /**
     * Update hash with new data
     * @param {string|Array} data - Input data to hash
     */
    Update: function(data) {
      // Convert input to byte array
      const bytes = (typeof data === 'string') ? OpCodes.StringToBytes(data) : data;
      
      for (let i = 0; i < bytes.length; i++) {
        this._buffer[this._bufferLength++] = bytes[i] & 0xFF;
        this._length++;
        
        // Process complete 64-byte blocks
        if (this._bufferLength === 64) {
          this._processBlock(this._buffer);
          this._bufferLength = 0;
        }
      }
    },
    
    /**
     * Finalize hash computation and return digest
     * @returns {string} Hexadecimal hash digest
     */
    Final: function() {
      // Add padding bit
      this._buffer[this._bufferLength++] = 0x80;
      
      // Check if we need an additional block for length
      if (this._bufferLength > 56) {
        // Pad current block and process
        while (this._bufferLength < 64) {
          this._buffer[this._bufferLength++] = 0x00;
        }
        this._processBlock(this._buffer);
        this._bufferLength = 0;
      }
      
      // Pad to 56 bytes
      while (this._bufferLength < 56) {
        this._buffer[this._bufferLength++] = 0x00;
      }
      
      // Append length in bits as 64-bit little-endian
      const lengthBits = this._length * 8;
      // Low 32 bits first (little-endian)
      this._buffer[56] = lengthBits & 0xFF;
      this._buffer[57] = (lengthBits >>> 8) & 0xFF;
      this._buffer[58] = (lengthBits >>> 16) & 0xFF;
      this._buffer[59] = (lengthBits >>> 24) & 0xFF;
      // High 32 bits (for messages under 2^32 bits, this is 0)
      this._buffer[60] = 0; this._buffer[61] = 0; this._buffer[62] = 0; this._buffer[63] = 0;
      
      // Process final block
      this._processBlock(this._buffer);
      
      // Convert hash to hex string (little-endian output)
      let result = '';
      for (let i = 0; i < 5; i++) {
        const bytes = OpCodes.Unpack32LE(this._h[i]);
        for (let j = 0; j < 4; j++) {
          result += OpCodes.ByteToHex(bytes[j]);
        }
      }
      
      return result.toLowerCase();
    },
    
    /**
     * Hash a complete message in one operation
     * @param {string|Array} message - Message to hash
     * @returns {string} Hexadecimal hash digest
     */
    Hash: function(message) {
      this.Init();
      this.Update(message);
      return this.Final();
    },
    
    /**
     * Required cipher interface methods (RIPEMD-160 is a hash, not encryption)
     */
    KeySetup: function(key) {
      // Hashes don't use keys - this is for HMAC compatibility
      return true;
    },
    
    encryptBlock: function(blockType, plaintext) {
      return this.Hash(plaintext);
    },
    
    decryptBlock: function(blockType, ciphertext) {
      // Hash functions are one-way
      throw new Error('RIPEMD-160 is a one-way hash function - decryption not possible');
    },
    
    ClearData: function() {
      if (this._h) OpCodes.ClearArray(this._h);
      if (this._buffer) OpCodes.ClearArray(this._buffer);
      this._length = 0;
      this._bufferLength = 0;
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(RIPEMD160);
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RIPEMD160;
  }
  
  // Export to global scope
  global.RIPEMD160 = RIPEMD160;
  
})(typeof global !== 'undefined' ? global : window);