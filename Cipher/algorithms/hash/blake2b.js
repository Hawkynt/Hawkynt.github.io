#!/usr/bin/env node
/*
 * BLAKE2b Universal Hash Function Implementation
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * BLAKE2b is a cryptographic hash function optimized for 64-bit platforms.
 * It is faster than MD5, SHA-1, SHA-2, and SHA-3, yet provides better security.
 * 
 * Specification: RFC 7693 - https://tools.ietf.org/html/rfc7693
 * Test Vectors: Reference/Organized/HashFunctions/BLAKE2/blake2b-kat.txt
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
    internalName: 'blake2b',
    name: 'BLAKE2b',
    
    // Required Cipher interface properties
    minKeyLength: 0,        // BLAKE2b can work without a key
    maxKeyLength: 64,       // BLAKE2B_KEYBYTES = 64
    stepKeyLength: 1,       // Any key length up to max
    minBlockSize: 0,        // Hash functions accept any input size
    maxBlockSize: 0,        // No maximum (0 = unlimited)
    stepBlockSize: 1,       // Any data size
    instances: {},          // Instance tracking
    
    // Comprehensive test vectors from RFC 7693 and official BLAKE2 specification
    testVectors: [
      {
        algorithm: 'BLAKE2b',
        description: 'Empty string',
        origin: 'RFC 7693',
        link: 'https://tools.ietf.org/html/rfc7693',
        standard: 'RFC 7693',
        input: '',
        hash: '786a02f742015903c6c6fd852552d272912f4740e15847618a86e217f71f5419d25e1031afee585313896444934eb04b903a685b1448b755d56f701afe9be2ce',
        inputHex: '',
        hashHex: '786a02f742015903c6c6fd852552d272912f4740e15847618a86e217f71f5419d25e1031afee585313896444934eb04b903a685b1448b755d56f701afe9be2ce',
        notes: 'BLAKE2b-512 of empty string from RFC 7693',
        category: 'basic'
      },
      {
        algorithm: 'BLAKE2b',
        description: 'Single byte 0x00',
        origin: 'RFC 7693',
        link: 'https://tools.ietf.org/html/rfc7693',
        standard: 'RFC 7693',
        input: '\x00',
        hash: '2fa3f686df876995167e7c2e5d74c4c7b6e48f8068fe0e44208344d480f7904c36963e44115fe3eb2a3ac8694c28bcb4f5a0f3276f2e79487d8219057a506e4b',
        inputHex: '00',
        hashHex: '2fa3f686df876995167e7c2e5d74c4c7b6e48f8068fe0e44208344d480f7904c36963e44115fe3eb2a3ac8694c28bcb4f5a0f3276f2e79487d8219057a506e4b',
        notes: 'Single null byte test',
        category: 'basic'
      },
      {
        algorithm: 'BLAKE2b',
        description: 'abc string',
        origin: 'RFC 7693',
        link: 'https://tools.ietf.org/html/rfc7693',
        standard: 'RFC 7693',
        input: 'abc',
        hash: 'ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d17d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923',
        inputHex: '616263',
        hashHex: 'ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d17d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923',
        notes: 'Standard abc test vector from RFC 7693',
        category: 'basic'
      },
      {
        algorithm: 'BLAKE2b',
        description: 'Long alphabet string',
        origin: 'RFC 7693',
        link: 'https://tools.ietf.org/html/rfc7693',
        standard: 'RFC 7693',
        input: 'abcdefghijklmnopqrstuvwxyz',
        hash: 'c68ede143e416eb7b4aaae0d8e48e55dd529eafed10b1df1a61416953a2b0a5666c761e7d412e6709e31ffe221b7a7a73908cb95a4d120b8b090a87912ee706a',
        inputHex: '6162636465666768696a6b6c6d6e6f707172737475767778797a',
        hashHex: 'c68ede143e416eb7b4aaae0d8e48e55dd529eafed10b1df1a61416953a2b0a5666c761e7d412e6709e31ffe221b7a7a73908cb95a4d120b8b090a87912ee706a',
        notes: 'Full alphabet test vector',
        category: 'basic'
      },
      {
        algorithm: 'BLAKE2b',
        description: 'BLAKE2b with key (MAC mode)',
        origin: 'RFC 7693',
        link: 'https://tools.ietf.org/html/rfc7693',
        standard: 'RFC 7693',
        key: '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f',
        input: '',
        hash: '10ebb67700b1868efb4417987acf4690ae9d972fb7a590c2f02871799aaa4786b5e996e8f0f4eb981fc214b005f42d2ff4233499391653df7aefcbc13fc51568',
        keyHex: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
        inputHex: '',
        hashHex: '10ebb67700b1868efb4417987acf4690ae9d972fb7a590c2f02871799aaa4786b5e996e8f0f4eb981fc214b005f42d2ff4233499391653df7aefcbc13fc51568',
        notes: 'BLAKE2b in MAC mode with 32-byte key and empty message',
        category: 'mac'
      },
      {
        algorithm: 'BLAKE2b',
        description: 'Variable output length (256-bit)',
        origin: 'RFC 7693',
        link: 'https://tools.ietf.org/html/rfc7693',
        standard: 'RFC 7693',
        input: 'abc',
        hash: 'bddd813c634239723171ef3fee98579b94964e3bb1cb3e427262c8c068d52319',
        inputHex: '616263',
        hashHex: 'bddd813c634239723171ef3fee98579b94964e3bb1cb3e427262c8c068d52319',
        notes: 'BLAKE2b-256 (32-byte output) of abc',
        category: 'variable'
      }
    ],
    
    // Reference links for BLAKE2b
    referenceLinks: {
      specifications: [
        {
          name: 'RFC 7693: The BLAKE2 Cryptographic Hash and Message Authentication Code (MAC)',
          url: 'https://tools.ietf.org/html/rfc7693',
          description: 'Official IETF specification for BLAKE2b and BLAKE2s'
        },
        {
          name: 'BLAKE2 Official Specification',
          url: 'https://blake2.net/blake2.pdf',
          description: 'Original BLAKE2 specification by Aumasson et al.'
        },
        {
          name: 'NIST Third SHA-3 Competition Analysis',
          url: 'https://csrc.nist.gov/Projects/Hash-Functions/SHA-3-Project',
          description: 'NIST analysis of BLAKE2 as SHA-3 candidate'
        }
      ],
      implementations: [
        {
          name: 'Official BLAKE2 Reference Implementation',
          url: 'https://github.com/BLAKE2/BLAKE2',
          description: 'Reference implementations in C by the BLAKE2 team'
        },
        {
          name: 'libsodium BLAKE2b',
          url: 'https://github.com/jedisct1/libsodium/tree/master/src/libsodium/crypto_generichash/blake2b',
          description: 'Production-ready libsodium implementation'
        },
        {
          name: 'OpenSSL EVP_blake2b',
          url: 'https://github.com/openssl/openssl/blob/master/crypto/blake2/',
          description: 'OpenSSL BLAKE2b implementation'
        },
        {
          name: 'Rust blake2 crate',
          url: 'https://github.com/RustCrypto/hashes/tree/master/blake2',
          description: 'Rust implementation of BLAKE2b/BLAKE2s'
        }
      ],
      validation: [
        {
          name: 'RFC 7693 Test Vectors',
          url: 'https://tools.ietf.org/html/rfc7693#appendix-A',
          description: 'Official test vectors from IETF RFC'
        },
        {
          name: 'BLAKE2 Official Test Vectors',
          url: 'https://github.com/BLAKE2/BLAKE2/tree/master/testvectors',
          description: 'Comprehensive test vectors from BLAKE2 team'
        },
        {
          name: 'SUPERCOP BLAKE2 Benchmarks',
          url: 'https://bench.cr.yp.to/results-hash.html',
          description: 'Performance benchmarks and validation'
        }
      ],
      applications: [
        {
          name: 'Argon2 Password Hashing',
          url: 'https://tools.ietf.org/html/rfc9106',
          description: 'BLAKE2b used as compression function in Argon2'
        },
        {
          name: 'Zcash Cryptocurrency',
          url: 'https://github.com/zcash/zcash',
          description: 'BLAKE2b used in Zcash proof-of-work algorithm'
        },
        {
          name: 'WireGuard VPN Protocol',
          url: 'https://www.wireguard.com/papers/wireguard.pdf',
          description: 'BLAKE2s used for MAC in WireGuard protocol'
        }
      ]
    },
    
    // Hash function interface
    Init: function() {
      this.hasher = new Blake2bHasher();
      this.bKey = false;
    },
    
    KeySetup: function(key) {
      if (key && key.length > 0) {
        this.hasher = new Blake2bHasher(key.slice(0, BLAKE2B_KEYBYTES));
        this.bKey = true;
      } else {
        this.hasher = new Blake2bHasher();
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
      const hasher = new Blake2bHasher(null, outputLength);
      hasher.update(data);
      return hasher.finalize();
    },
    
    // Keyed hash interface (MAC)
    keyedHash: function(key, data, outputLength) {
      const hasher = new Blake2bHasher(key, outputLength);
      hasher.update(data);
      return hasher.finalize();
    },
    
    ClearData: function() {
      if (this.hasher) {
        this.hasher.h.fill(BigInt(0));
        this.hasher.buffer.fill(0);
        this.hasher.counter = BigInt(0);
      }
      this.bKey = false;
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(Blake2b);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Blake2b;
  }
  
  // Make available globally
  global.Blake2b = Blake2b;
  
})(typeof global !== 'undefined' ? global : window);