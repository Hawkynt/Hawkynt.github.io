#!/usr/bin/env node
/*
 * Universal SHA-512 Hash Function
 * Compatible with both Browser and Node.js environments
 * Based on NIST FIPS 180-4 specification
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of the SHA-512 secure hash algorithm.
 * Produces 512-bit (64-byte) hash values from input data.
 * 
 * IMPLEMENTATION NOTES:
 * - Uses 64-bit arithmetic implemented with 32-bit operations
 * - Based on NIST FIPS 180-4 Section 6.4
 * - Optimized with OpCodes for cross-platform portability
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
      console.error('SHA-512 requires Cipher system to be loaded first');
      return;
    }
  }
  
  // 64-bit arithmetic helpers (using [high32, low32] representation)
  const Int64 = {
    // Create 64-bit value from two 32-bit values
    create: function(high, low) {
      return [high >>> 0, low >>> 0];
    },
    
    // Add two 64-bit values
    add: function(a, b) {
      const low = (a[1] + b[1]) >>> 0;
      const high = (a[0] + b[0] + (low < a[1] ? 1 : 0)) >>> 0;
      return [high, low];
    },
    
    // Right rotate 64-bit value
    rotr: function(value, count) {
      if (count === 0) return value;
      if (count >= 64) count %= 64;
      
      if (count < 32) {
        const high = ((value[0] >>> count) | (value[1] << (32 - count))) >>> 0;
        const low = ((value[1] >>> count) | (value[0] << (32 - count))) >>> 0;
        return [high, low];
      } else {
        count -= 32;
        const high = ((value[1] >>> count) | (value[0] << (32 - count))) >>> 0;
        const low = ((value[0] >>> count) | (value[1] << (32 - count))) >>> 0;
        return [high, low];
      }
    },
    
    // Right shift 64-bit value
    shr: function(value, count) {
      if (count === 0) return value;
      if (count >= 64) return [0, 0];
      
      if (count < 32) {
        const high = value[0] >>> count;
        const low = ((value[1] >>> count) | (value[0] << (32 - count))) >>> 0;
        return [high, low];
      } else {
        count -= 32;
        return [0, value[0] >>> count];
      }
    },
    
    // XOR two 64-bit values
    xor: function(a, b) {
      return [a[0] ^ b[0], a[1] ^ b[1]];
    },
    
    // AND two 64-bit values
    and: function(a, b) {
      return [a[0] & b[0], a[1] & b[1]];
    },
    
    // NOT 64-bit value
    not: function(a) {
      return [~a[0] >>> 0, ~a[1] >>> 0];
    }
  };
  
  // SHA-512 constants - NIST FIPS 180-4 Section 4.2.3
  const K = [
    [0x428a2f98, 0xd728ae22], [0x71374491, 0x23ef65cd], [0xb5c0fbcf, 0xec4d3b2f], [0xe9b5dba5, 0x8189dbbc],
    [0x3956c25b, 0xf348b538], [0x59f111f1, 0xb605d019], [0x923f82a4, 0xaf194f9b], [0xab1c5ed5, 0xda6d8118],
    [0xd807aa98, 0xa3030242], [0x12835b01, 0x45706fbe], [0x243185be, 0x4ee4b28c], [0x550c7dc3, 0xd5ffb4e2],
    [0x72be5d74, 0xf27b896f], [0x80deb1fe, 0x3b1696b1], [0x9bdc06a7, 0x25c71235], [0xc19bf174, 0xcf692694],
    [0xe49b69c1, 0x9ef14ad2], [0xefbe4786, 0x384f25e3], [0x0fc19dc6, 0x8b8cd5b5], [0x240ca1cc, 0x77ac9c65],
    [0x2de92c6f, 0x592b0275], [0x4a7484aa, 0x6ea6e483], [0x5cb0a9dc, 0xbd41fbd4], [0x76f988da, 0x831153b5],
    [0x983e5152, 0xee66dfab], [0xa831c66d, 0x2db43210], [0xb00327c8, 0x98fb213f], [0xbf597fc7, 0xbeef0ee4],
    [0xc6e00bf3, 0x3da88fc2], [0xd5a79147, 0x930aa725], [0x06ca6351, 0xe003826f], [0x14292967, 0x0a0e6e70],
    [0x27b70a85, 0x46d22ffc], [0x2e1b2138, 0x5c26c926], [0x4d2c6dfc, 0x5ac42aed], [0x53380d13, 0x9d95b3df],
    [0x650a7354, 0x8baf63de], [0x766a0abb, 0x3c77b2a8], [0x81c2c92e, 0x47edaee6], [0x92722c85, 0x1482353b],
    [0xa2bfe8a1, 0x4cf10364], [0xa81a664b, 0xbc423001], [0xc24b8b70, 0xd0f89791], [0xc76c51a3, 0x0654be30],
    [0xd192e819, 0xd6ef5218], [0xd6990624, 0x5565a910], [0xf40e3585, 0x5771202a], [0x106aa070, 0x32bbd1b8],
    [0x19a4c116, 0xb8d2d0c8], [0x1e376c08, 0x5141ab53], [0x2748774c, 0xdf8eeb99], [0x34b0bcb5, 0xe19b48a8],
    [0x391c0cb3, 0xc5c95a63], [0x4ed8aa4a, 0xe3418acb], [0x5b9cca4f, 0x7763e373], [0x682e6ff3, 0xd6b2b8a3],
    [0x748f82ee, 0x5defb2fc], [0x78a5636f, 0x43172f60], [0x84c87814, 0xa1f0ab72], [0x8cc70208, 0x1a6439ec],
    [0x90befffa, 0x23631e28], [0xa4506ceb, 0xde82bde9], [0xbef9a3f7, 0xb2c67915], [0xc67178f2, 0xe372532b],
    [0xca273ece, 0xea26619c], [0xd186b8c7, 0x21c0c207], [0xeada7dd6, 0xcde0eb1e], [0xf57d4f7f, 0xee6ed178],
    [0x06f067aa, 0x72176fba], [0x0a637dc5, 0xa2c898a6], [0x113f9804, 0xbef90dae], [0x1b710b35, 0x131c471b],
    [0x28db77f5, 0x23047d84], [0x32caab7b, 0x40c72493], [0x3c9ebe0a, 0x15c9bebc], [0x431d67c4, 0x9c100d4c],
    [0x4cc5d4be, 0xcb3e42b6], [0x597f299c, 0xfc657e2a], [0x5fcb6fab, 0x3ad6faec], [0x6c44198c, 0x4a475817]
  ];
  
  // Create SHA-512 hash object
  const SHA512 = {
    // Public interface properties
    internalName: 'SHA512',
    name: 'SHA-512',
    comment: 'SHA-512 Secure Hash Algorithm (NIST FIPS 180-4) - Educational Implementation',
    
    // Cipher interface properties (required for registration)
    minKeyLength: 0,    // Hash functions don't use keys
    maxKeyLength: 0,    // Hash functions don't use keys
    stepKeyLength: 1,   // Not applicable for hash functions
    minBlockSize: 1,    // Can hash any amount of data
    maxBlockSize: 0,    // No maximum block size (0 = unlimited)
    stepBlockSize: 1,   // Can process byte by byte
    instances: {},      // Instance tracking
    
    // Hash state variables (8 64-bit words)
    _h: null,
    _buffer: null,
    _length: 0,
    _bufferLength: 0,
    
    /**
     * Initialize the hash state with standard SHA-512 initial values
     * NIST FIPS 180-4 Section 5.3.5
     */
    Init: function() {
      // Initial hash values (first 64 bits of fractional parts of square roots of first 8 primes)
      this._h = [
        [0x6a09e667, 0xf3bcc908], [0xbb67ae85, 0x84caa73b], [0x3c6ef372, 0xfe94f82b], [0xa54ff53a, 0x5f1d36f1],
        [0x510e527f, 0xade682d1], [0x9b05688c, 0x2b3e6c1f], [0x1f83d9ab, 0xfb41bd6b], [0x5be0cd19, 0x137e2179]
      ];
      
      this._buffer = new Array(128);
      this._length = 0;
      this._bufferLength = 0;
      
      // Clear buffer
      OpCodes.ClearArray(this._buffer);
    },
    
    /**
     * Process a single 1024-bit (128-byte) message block
     * NIST FIPS 180-4 Section 6.4.2
     * @param {Array} block - 128-byte message block
     */
    _processBlock: function(block) {
      // Prepare message schedule (W) - 80 64-bit words
      const W = new Array(80);
      
      // Copy first 16 words from block (big-endian, 64-bit each)
      for (let i = 0; i < 16; i++) {
        const offset = i * 8;
        const high = OpCodes.Pack32BE(block[offset], block[offset + 1], block[offset + 2], block[offset + 3]);
        const low = OpCodes.Pack32BE(block[offset + 4], block[offset + 5], block[offset + 6], block[offset + 7]);
        W[i] = [high, low];
      }
      
      // Extend first 16 words into remaining 64 words
      for (let i = 16; i < 80; i++) {
        const s0 = Int64.xor(Int64.xor(Int64.rotr(W[i - 15], 1), Int64.rotr(W[i - 15], 8)), Int64.shr(W[i - 15], 7));
        const s1 = Int64.xor(Int64.xor(Int64.rotr(W[i - 2], 19), Int64.rotr(W[i - 2], 61)), Int64.shr(W[i - 2], 6));
        W[i] = Int64.add(Int64.add(Int64.add(W[i - 16], s0), W[i - 7]), s1);
      }
      
      // Initialize working variables
      let a = [...this._h[0]], b = [...this._h[1]], c = [...this._h[2]], d = [...this._h[3]];
      let e = [...this._h[4]], f = [...this._h[5]], g = [...this._h[6]], h = [...this._h[7]];
      
      // Main hash computation (80 rounds)
      for (let i = 0; i < 80; i++) {
        const S1 = Int64.xor(Int64.xor(Int64.rotr(e, 14), Int64.rotr(e, 18)), Int64.rotr(e, 41));
        const ch = Int64.xor(Int64.and(e, f), Int64.and(Int64.not(e), g));
        const temp1 = Int64.add(Int64.add(Int64.add(Int64.add(h, S1), ch), K[i]), W[i]);
        const S0 = Int64.xor(Int64.xor(Int64.rotr(a, 28), Int64.rotr(a, 34)), Int64.rotr(a, 39));
        const maj = Int64.xor(Int64.xor(Int64.and(a, b), Int64.and(a, c)), Int64.and(b, c));
        const temp2 = Int64.add(S0, maj);
        
        h = [...g];
        g = [...f];
        f = [...e];
        e = Int64.add(d, temp1);
        d = [...c];
        c = [...b];
        b = [...a];
        a = Int64.add(temp1, temp2);
      }
      
      // Add to hash values
      this._h[0] = Int64.add(this._h[0], a);
      this._h[1] = Int64.add(this._h[1], b);
      this._h[2] = Int64.add(this._h[2], c);
      this._h[3] = Int64.add(this._h[3], d);
      this._h[4] = Int64.add(this._h[4], e);
      this._h[5] = Int64.add(this._h[5], f);
      this._h[6] = Int64.add(this._h[6], g);
      this._h[7] = Int64.add(this._h[7], h);
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
        
        // Process complete 128-byte blocks
        if (this._bufferLength === 128) {
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
      if (this._bufferLength > 112) {
        // Pad current block and process
        while (this._bufferLength < 128) {
          this._buffer[this._bufferLength++] = 0x00;
        }
        this._processBlock(this._buffer);
        this._bufferLength = 0;
      }
      
      // Pad to 112 bytes
      while (this._bufferLength < 112) {
        this._buffer[this._bufferLength++] = 0x00;
      }
      
      // Append length in bits as 128-bit big-endian
      const lengthBits = this._length * 8;
      // High 64 bits (for messages under 2^32 bits, this is mostly 0)
      for (let i = 0; i < 8; i++) {
        this._buffer[112 + i] = 0;
      }
      // Low 64 bits
      this._buffer[120] = (lengthBits >>> 56) & 0xFF;
      this._buffer[121] = (lengthBits >>> 48) & 0xFF;
      this._buffer[122] = (lengthBits >>> 40) & 0xFF;
      this._buffer[123] = (lengthBits >>> 32) & 0xFF;
      this._buffer[124] = (lengthBits >>> 24) & 0xFF;
      this._buffer[125] = (lengthBits >>> 16) & 0xFF;
      this._buffer[126] = (lengthBits >>> 8) & 0xFF;
      this._buffer[127] = lengthBits & 0xFF;
      
      // Process final block
      this._processBlock(this._buffer);
      
      // Convert hash to hex string
      let result = '';
      for (let i = 0; i < 8; i++) {
        // Convert 64-bit word to hex (high 32 bits first, then low 32 bits)
        const highBytes = OpCodes.Unpack32BE(this._h[i][0]);
        const lowBytes = OpCodes.Unpack32BE(this._h[i][1]);
        for (let j = 0; j < 4; j++) {
          result += OpCodes.ByteToHex(highBytes[j]);
        }
        for (let j = 0; j < 4; j++) {
          result += OpCodes.ByteToHex(lowBytes[j]);
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
     * Required cipher interface methods (SHA-512 is a hash, not encryption)
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
      throw new Error('SHA-512 is a one-way hash function - decryption not possible');
    },
    
    ClearData: function() {
      if (this._h) {
        for (let i = 0; i < this._h.length; i++) {
          OpCodes.ClearArray(this._h[i]);
        }
      }
      if (this._buffer) OpCodes.ClearArray(this._buffer);
      this._length = 0;
      this._bufferLength = 0;
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(SHA512);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SHA512;
  }
  
  // Export to global scope
  global.SHA512 = SHA512;
  
})(typeof global !== 'undefined' ? global : window);