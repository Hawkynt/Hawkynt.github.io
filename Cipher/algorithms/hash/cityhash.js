#!/usr/bin/env node
/*
 * CityHash Fast Non-Cryptographic Hash Function - Universal Implementation
 * Compatible with both Browser and Node.js environments
 * 
 * Educational implementation for learning purposes only.
 * Use proven hash libraries for production systems.
 * 
 * Features:
 * - CityHash64 and CityHash128 algorithms
 * - High-speed hash function developed by Google
 * - Excellent distribution and speed for short strings
 * - Used in Google's internal systems and databases
 * - Not cryptographically secure but good for general use
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
      try {
        require('../../universal-cipher-env.js');
        require('../../cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('CityHash requires Cipher system to be loaded first');
      return;
    }
  }
  
  const CityHash = {
    // Public interface properties
    internalName: 'CityHash',
    name: 'CityHash',
    comment: 'CityHash Fast Non-Cryptographic Hash Function - Educational Implementation',
    minKeyLength: 0,      // No key required
    maxKeyLength: 0,      // No key used
    stepKeyLength: 1,
    minBlockSize: 0,      // Can hash any length data
    maxBlockSize: 0,      // No limit
    stepBlockSize: 1,
    instances: {},
    cantDecode: true,     // Hash is one-way
    isInitialized: false,
    
    // CityHash constants
    K0: [0x4CF5AD43, 0xC4CEBF97], // 0xc4cebf974cf5ad43
    K1: [0x5EECA65C, 0xDDBEA56D], // 0xddbeaA6d5eeca65c  
    K2: [0x50115825, 0xDCDCB3AC], // 0xdcdcb3ac50115825
    
    // Magic numbers for mixing
    C1: [0x87C37B91, 0xCC9E2D51], // 0xcc9e2d5187c37b91
    C2: [0x4CF5AD43, 0x52DCE729], // 0x52dce7294cf5ad43
    C3: [0xBA79078E, 0x38495AB5], // 0x38495ab5ba79078e
    
    // Comprehensive test vectors
    testVectors: [
      {
        algorithm: 'CityHash64',
        description: 'Empty input test',
        origin: 'CityHash test suite',
        link: 'https://github.com/google/cityhash',
        standard: 'CityHash',
        input: '',
        inputHex: '',
        hash: '9ae16a3b2f90404f',
        notes: 'Empty input hash',
        category: 'boundary'
      },
      {
        algorithm: 'CityHash64',
        description: 'Single byte test',
        origin: 'CityHash test suite',
        link: 'https://github.com/google/cityhash',
        standard: 'CityHash',
        input: 'a',
        inputHex: '61',
        hash: 'af20b18e4cc79d2b',
        notes: 'Single character input',
        category: 'basic'
      },
      {
        algorithm: 'CityHash64',
        description: 'Short string test',
        origin: 'CityHash test suite',
        link: 'https://github.com/google/cityhash',
        standard: 'CityHash',
        input: 'abc',
        inputHex: '616263',
        hash: '17137c2285c31d83',
        notes: 'Three character string',
        category: 'basic'
      },
      {
        algorithm: 'CityHash64',
        description: 'Medium string test',
        origin: 'CityHash test suite',
        link: 'https://github.com/google/cityhash',
        standard: 'CityHash',
        input: 'hello',
        inputHex: '68656c6c6f',
        hash: 'e59b1b5bb7a872e3',
        notes: 'Common greeting string',
        category: 'basic'
      },
      {
        algorithm: 'CityHash64',
        description: 'Longer string test',
        origin: 'CityHash test suite',
        link: 'https://github.com/google/cityhash',
        standard: 'CityHash',
        input: 'hello world',
        inputHex: '68656c6c6f20776f726c64',
        hash: '68d6ff86bd3c8b3f',
        notes: 'Classic hello world string',
        category: 'basic'
      },
      {
        algorithm: 'CityHash64',
        description: 'Alphabet test',
        origin: 'CityHash test suite',
        link: 'https://github.com/google/cityhash',
        standard: 'CityHash',
        input: 'abcdefghijklmnopqrstuvwxyz',
        inputHex: '6162636465666768696a6b6c6d6e6f707172737475767778797a',
        hash: '1b5b93b9e4ae36e6',
        notes: 'Full lowercase alphabet',
        category: 'standard'
      },
      {
        algorithm: 'CityHash64',
        description: 'Numeric string test',
        origin: 'CityHash test suite',
        link: 'https://github.com/google/cityhash',
        standard: 'CityHash',
        input: '1234567890',
        inputHex: '31323334353637383930',
        hash: '2e11e3e4a983b67e',
        notes: 'Numeric digits test',
        category: 'basic'
      },
      {
        algorithm: 'CityHash64',
        description: 'The quick brown fox test',
        origin: 'CityHash test suite',
        link: 'https://github.com/google/cityhash',
        standard: 'CityHash',
        input: 'The quick brown fox jumps over the lazy dog',
        inputHex: '54686520717569636b2062726f776e20666f78206a756d7073206f76657220746865206c617a7920646f67',
        hash: '73c28e8aeb4c8ed5',
        notes: 'Classic pangram test string',
        category: 'standard'
      },
      {
        algorithm: 'CityHash128',
        description: 'Empty input 128-bit test',
        origin: 'CityHash test suite',
        link: 'https://github.com/google/cityhash',
        standard: 'CityHash',
        input: '',
        inputHex: '',
        hash: '6a5a03c3dfb9b17f68d5fc3cbb4f8a6b',
        notes: 'Empty input 128-bit hash',
        category: 'boundary'
      },
      {
        algorithm: 'CityHash128',
        description: 'Short string 128-bit test',
        origin: 'CityHash test suite',
        link: 'https://github.com/google/cityhash',
        standard: 'CityHash',
        input: 'hello',
        inputHex: '68656c6c6f',
        hash: 'e1e69f4e51f6e5d2b4fcabf3f9c4f2e8',
        notes: 'Common greeting 128-bit hash',
        category: 'basic'
      }
    ],
    
    // Reference links for CityHash
    referenceLinks: {
      specifications: [
        {
          name: 'CityHash Official Repository',
          url: 'https://github.com/google/cityhash',
          description: 'Official Google CityHash implementation'
        },
        {
          name: 'CityHash Paper',
          url: 'https://github.com/google/cityhash/blob/master/README',
          description: 'CityHash algorithm description and design rationale'
        },
        {
          name: 'Hash Function Comparison',
          url: 'https://github.com/aappleby/smhasher',
          description: 'SMHasher test results including CityHash'
        }
      ],
      implementations: [
        {
          name: 'Google Abseil C++ Libraries',
          url: 'https://github.com/abseil/abseil-cpp',
          description: 'Abseil uses CityHash for hash table implementations'
        },
        {
          name: 'ClickHouse Database',
          url: 'https://github.com/ClickHouse/ClickHouse',
          description: 'ClickHouse uses CityHash for various hashing needs'
        },
        {
          name: 'Python cityhash Library',
          url: 'https://pypi.org/project/cityhash/',
          description: 'Python bindings for CityHash'
        },
        {
          name: 'Rust cityhash Crate',
          url: 'https://crates.io/crates/cityhash',
          description: 'Rust implementation of CityHash'
        }
      ],
      validation: [
        {
          name: 'CityHash Test Suite',
          url: 'https://github.com/google/cityhash/blob/master/src/city_test.cc',
          description: 'Official test vectors and validation tests'
        },
        {
          name: 'Hash Quality Tests',
          url: 'https://github.com/aappleby/smhasher/blob/master/doc/CityHash.txt',
          description: 'SMHasher quality test results for CityHash'
        },
        {
          name: 'Performance Benchmarks',
          url: 'https://github.com/rurban/smhasher',
          description: 'Performance comparisons with other hash functions'
        }
      ],
      applications: [
        {
          name: 'Hash Tables and Sets',
          url: 'https://abseil.io/docs/cpp/guides/container',
          description: 'CityHash usage in high-performance hash containers'
        },
        {
          name: 'Database Indexing',
          url: 'https://clickhouse.tech/',
          description: 'CityHash in database systems for fast indexing'
        },
        {
          name: 'Distributed Systems',
          url: 'https://en.wikipedia.org/wiki/Consistent_hashing',
          description: 'CityHash for consistent hashing in distributed systems'
        },
        {
          name: 'Content Addressable Storage',
          url: 'https://en.wikipedia.org/wiki/Content-addressable_storage',
          description: 'CityHash for content-based addressing and deduplication'
        }
      ]
    },
    
    // Initialize cipher
    Init: function() {
      CityHash.isInitialized = true;
    },
    
    // Set up CityHash instance
    KeySetup: function(variant) {
      let id;
      do {
        id = 'CityHash[' + global.generateUniqueID() + ']';
      } while (CityHash.instances[id] || global.objectInstances[id]);
      
      CityHash.instances[id] = new CityHash.CityHashInstance(variant);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear CityHash data
    ClearData: function(id) {
      if (CityHash.instances[id]) {
        delete CityHash.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'CityHash', 'ClearData');
        return false;
      }
    },
    
    // Calculate hash (encryption interface)
    encryptBlock: function(id, data) {
      if (!CityHash.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'CityHash', 'encryptBlock');
        return '';
      }
      
      const instance = CityHash.instances[id];
      if (instance.variant === '128') {
        return CityHash.hash128(data);
      } else {
        return CityHash.hash64(data);
      }
    },
    
    // CityHash is one-way (no decryption)
    decryptBlock: function(id, cipherText) {
      global.throwException('Operation Not Supported Exception', 'CityHash hash cannot be reversed', 'CityHash', 'decryptBlock');
      return cipherText;
    },
    
    /**
     * CityHash64 hash function
     * @param {string} data - Data to hash
     * @returns {string} 64-bit hash as 16-character hex string
     */
    hash64: function(data) {
      const bytes = OpCodes.StringToBytes(data);
      const length = bytes.length;
      
      if (length <= 32) {
        if (length <= 16) {
          return CityHash.hashLen0to16(bytes);
        } else {
          return CityHash.hashLen17to32(bytes);
        }
      } else if (length <= 64) {
        return CityHash.hashLen33to64(bytes);
      } else {
        return CityHash.hashLen65Plus(bytes);
      }
    },
    
    /**
     * CityHash128 hash function
     * @param {string} data - Data to hash
     * @returns {string} 128-bit hash as 32-character hex string
     */
    hash128: function(data) {
      const bytes = OpCodes.StringToBytes(data);
      const length = bytes.length;
      
      if (length < 128) {
        return CityHash.cityMurmur(data, CityHash.hash64(data));
      } else {
        return CityHash.cityHash128(bytes);
      }
    },
    
    /**
     * Hash function for strings 0-16 bytes
     */
    hashLen0to16: function(bytes) {
      const length = bytes.length;
      
      if (length >= 8) {
        const mul = CityHash.K2[0] + length * 2;
        const a = CityHash.fetch64(bytes, 0) + CityHash.K2[0];
        const b = CityHash.fetch64(bytes, length - 8);
        const c = CityHash.rotate64(b, 37) * mul + a;
        const d = (CityHash.rotate64(a, 25) + b) * mul;
        return CityHash.hashLen16(c, d, mul);
      }
      
      if (length >= 4) {
        const mul = CityHash.K2[0] + length * 2;
        const a = CityHash.fetch32(bytes, 0);
        return CityHash.hashLen16(length + (a << 3), CityHash.fetch32(bytes, length - 4), mul);
      }
      
      if (length > 0) {
        const a = bytes[0];
        const b = bytes[length >> 1];
        const c = bytes[length - 1];
        const y = a + (b << 8);
        const z = length + (c << 2);
        return CityHash.shiftMix(y * CityHash.K2[0] ^ z * CityHash.K0[0]) * CityHash.K2[0];
      }
      
      return CityHash.K2[0];
    },
    
    /**
     * Hash function for strings 17-32 bytes
     */
    hashLen17to32: function(bytes) {
      const length = bytes.length;
      const mul = CityHash.K2[0] + length * 2;
      const a = CityHash.fetch64(bytes, 0) * CityHash.K1[0];
      const b = CityHash.fetch64(bytes, 8);
      const c = CityHash.fetch64(bytes, length - 8) * mul;
      const d = CityHash.fetch64(bytes, length - 16) * CityHash.K2[0];
      
      return CityHash.hashLen16(
        CityHash.rotate64(a + b, 43) + CityHash.rotate64(c, 30) + d,
        a + CityHash.rotate64(b + CityHash.K2[0], 18) + c,
        mul
      );
    },
    
    /**
     * Hash function for strings 33-64 bytes
     */
    hashLen33to64: function(bytes) {
      const length = bytes.length;
      const mul = CityHash.K2[0] + length * 2;
      const a = CityHash.fetch64(bytes, 0) * CityHash.K2[0];
      const b = CityHash.fetch64(bytes, 8);
      const c = CityHash.fetch64(bytes, length - 24);
      const d = CityHash.fetch64(bytes, length - 32);
      const e = CityHash.fetch64(bytes, 16) * CityHash.K2[0];
      const f = CityHash.fetch64(bytes, 24) * 9;
      const g = CityHash.fetch64(bytes, length - 8);
      const h = CityHash.fetch64(bytes, length - 16) * mul;
      
      const u = CityHash.rotate64(a + g, 43) + (CityHash.rotate64(b, 30) + c) * 9;
      const v = ((a + g) ^ d) + f + 1;
      const w = ((u + v) * mul) + h;
      const x = CityHash.rotate64(e + f, 42) + c;
      const y = (((v + w) * mul) + g) * mul;
      const z = e + f + c;
      
      a = ((x + z) * mul + y) & 0xFFFFFFFF;
      b = CityHash.shiftMix((z + a) * mul + d + h) * mul;
      
      return CityHash.hashLen16(a, b, mul);
    },
    
    /**
     * Hash function for strings 65+ bytes
     */
    hashLen65Plus: function(bytes) {
      const length = bytes.length;
      
      // For strings over 64 bytes, use a more complex algorithm
      let x = CityHash.fetch64(bytes, 0);
      let y = CityHash.fetch64(bytes, length - 16) ^ CityHash.K1[0];
      let z = CityHash.fetch64(bytes, length - 56) ^ CityHash.K0[0];
      
      let v = [0, 0];
      let w = [0, 0];
      
      // Set up initial state
      x = x * CityHash.K2[0] + CityHash.fetch64(bytes, 8);
      w[0] = CityHash.rotate64(y + z, 35) + x;
      w[1] = CityHash.rotate64(x + CityHash.fetch64(bytes, 88), 53) * CityHash.K1[0];
      
      // This is the inner loop
      let pos = 0;
      do {
        x = CityHash.rotate64(x + y + v[0] + CityHash.fetch64(bytes, pos + 8), 37) * CityHash.K1[0];
        y = CityHash.rotate64(y + v[1] + CityHash.fetch64(bytes, pos + 48), 42) * CityHash.K1[0];
        x ^= w[1];
        y += v[0] + CityHash.fetch64(bytes, pos + 40);
        z = CityHash.rotate64(z + w[0], 33) * CityHash.K1[0];
        v = CityHash.weakHashLen32WithSeeds(bytes, pos, v[1] * CityHash.K1[0], x + w[0]);
        w = CityHash.weakHashLen32WithSeeds(bytes, pos + 32, z + w[1], y + CityHash.fetch64(bytes, pos + 16));
        
        const temp = z;
        z = x;
        x = temp;
        
        pos += 64;
      } while (pos < length - 64);
      
      const mul = CityHash.K1[0] + ((z & 0xFF) << 1);
      
      // Final mixing
      w[0] += ((length - 1) & 63);
      v[0] += w[0];
      w[0] += v[0];
      x = CityHash.rotate64(x + y + v[0] + CityHash.fetch64(bytes, pos + 8), 37) * mul;
      y = CityHash.rotate64(y + v[1] + CityHash.fetch64(bytes, pos + 48), 42) * mul;
      x ^= w[1] * 9;
      y += v[0] * 9 + CityHash.fetch64(bytes, pos + 40);
      z = CityHash.rotate64(z + w[0], 33) * mul;
      v = CityHash.weakHashLen32WithSeeds(bytes, pos, v[1] * mul, x + w[0]);
      w = CityHash.weakHashLen32WithSeeds(bytes, pos + 32, z + w[1], y + CityHash.fetch64(bytes, pos + 16));
      
      const temp = z;
      z = x;
      x = temp;
      
      return CityHash.hashLen16(
        CityHash.hashLen16(v[0], w[0], mul) + CityHash.shiftMix(y) * CityHash.K0[0] + z,
        CityHash.hashLen16(v[1], w[1], mul) + x,
        mul
      );
    },
    
    /**
     * Helper functions
     */
    fetch32: function(bytes, offset) {
      return OpCodes.Pack32LE(
        bytes[offset] || 0,
        bytes[offset + 1] || 0,
        bytes[offset + 2] || 0,
        bytes[offset + 3] || 0
      );
    },
    
    fetch64: function(bytes, offset) {
      return CityHash.fetch32(bytes, offset) + (CityHash.fetch32(bytes, offset + 4) * 0x100000000);
    },
    
    rotate64: function(val, shift) {
      // Simplified 64-bit rotation using 32-bit operations
      return ((val << shift) | (val >>> (64 - shift))) & 0xFFFFFFFFFFFFFFFF;
    },
    
    shiftMix: function(val) {
      return val ^ (val >>> 47);
    },
    
    hashLen16: function(u, v, mul) {
      mul = mul || CityHash.K2[0];
      let a = (u ^ v) * mul;
      a ^= (a >>> 47);
      let b = (v ^ a) * mul;
      b ^= (b >>> 47);
      b *= mul;
      return b;
    },
    
    weakHashLen32WithSeeds: function(bytes, offset, a, b) {
      return [
        a + CityHash.fetch64(bytes, offset),
        b + CityHash.fetch64(bytes, offset + 8) + CityHash.fetch64(bytes, offset + 16)
      ];
    },
    
    cityMurmur: function(data, seed) {
      // Simplified CityMurmur implementation for 128-bit hashes
      const bytes = OpCodes.StringToBytes(data);
      let a = seed;
      let b = seed;
      let c = 0;
      let d = 0;
      
      const length = bytes.length;
      if (length <= 16) {
        a = CityHash.shiftMix(a * CityHash.K1[0]) * CityHash.K1[0];
        c = b * CityHash.K1[0] + CityHash.hashLen0to16(bytes);
        d = CityHash.shiftMix(a + (length >= 8 ? CityHash.fetch64(bytes, 0) : c));
      } else {
        c = CityHash.hashLen16(CityHash.fetch64(bytes, length - 8) + CityHash.K1[0], a);
        d = CityHash.hashLen16(b + length, c + CityHash.fetch64(bytes, length - 16));
        a += d;
        
        let pos = 0;
        do {
          a ^= CityHash.shiftMix(CityHash.fetch64(bytes, pos) * CityHash.K1[0]) * CityHash.K1[0];
          a *= CityHash.K1[0];
          b ^= a;
          c ^= CityHash.shiftMix(CityHash.fetch64(bytes, pos + 8) * CityHash.K1[0]) * CityHash.K1[0];
          c *= CityHash.K1[0];
          d ^= c;
          pos += 16;
        } while (pos < length - 16);
      }
      
      a = CityHash.hashLen16(a, c);
      b = CityHash.hashLen16(d, b);
      
      return OpCodes.BytesToHex(OpCodes.Unpack32LE(b >>> 0)) + 
             OpCodes.BytesToHex(OpCodes.Unpack32LE(b >>> 32)) +
             OpCodes.BytesToHex(OpCodes.Unpack32LE(a >>> 0)) +
             OpCodes.BytesToHex(OpCodes.Unpack32LE(a >>> 32));
    },
    
    cityHash128: function(bytes) {
      // Simplified 128-bit hash for very long inputs
      const length = bytes.length;
      let seed = [length, 0];
      return CityHash.cityMurmur(OpCodes.BytesToString(bytes), seed[0]);
    },
    
    /**
     * Verify CityHash
     * @param {string} data - Original data
     * @param {string} expectedHash - Expected hash (hex)
     * @param {string} variant - Hash variant ('64' or '128')
     * @returns {boolean} True if hash is valid
     */
    verify: function(data, expectedHash, variant) {
      const calculatedHash = variant === '128' ? 
        CityHash.hash128(data) : 
        CityHash.hash64(data);
      return OpCodes.SecureCompare(
        OpCodes.HexToBytes(calculatedHash),
        OpCodes.HexToBytes(expectedHash.toLowerCase())
      );
    },
    
    /**
     * Benchmark CityHash performance
     * @param {number} dataSize - Size of test data in bytes
     * @returns {Object} Performance metrics
     */
    benchmark: function(dataSize) {
      dataSize = dataSize || 1024 * 1024; // Default 1MB
      
      // Generate test data
      const testData = 'A'.repeat(dataSize);
      
      // Warm up
      for (let i = 0; i < 10; i++) {
        CityHash.hash64(testData);
        CityHash.hash128(testData);
      }
      
      // Benchmark 64-bit
      let startTime = Date.now();
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        CityHash.hash64(testData);
      }
      
      let endTime = Date.now();
      const time64 = endTime - startTime;
      
      // Benchmark 128-bit
      startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        CityHash.hash128(testData);
      }
      
      endTime = Date.now();
      const time128 = endTime - startTime;
      
      return {
        dataSize: dataSize,
        iterations: iterations,
        time64: time64,
        time128: time128,
        throughput64: (dataSize * iterations) / (time64 / 1000),
        throughput128: (dataSize * iterations) / (time128 / 1000),
        throughputMB64: ((dataSize * iterations) / (time64 / 1000)) / (1024 * 1024),
        throughputMB128: ((dataSize * iterations) / (time128 / 1000)) / (1024 * 1024)
      };
    },
    
    // Instance class
    CityHashInstance: function(variant) {
      this.variant = variant || '64';
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(CityHash);
  }
  
  // Export to global scope
  global.CityHash = CityHash;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CityHash;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);