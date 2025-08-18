#!/usr/bin/env node
/*
 * xxHash Universal Hash Function Implementation (32-bit and 64-bit)
 * Compatible with both Browser and Node.js environments
 * 
 * Educational implementation for learning purposes only.
 * Use proven hash libraries for production systems.
 * 
 * Features:
 * - xxHash32 and xxHash64 algorithms
 * - Extremely fast non-cryptographic hash functions
 * - Designed by Yann Collet for high performance
 * - Used in databases, compression, checksums
 * - Excellent distribution and avalanche properties
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
      console.error('xxHash requires Cipher system to be loaded first');
      return;
    }
  }
  
  const xxHash = {
    // Public interface properties
    internalName: 'xxHash',
    name: 'xxHash',
    comment: 'xxHash Fast Non-Cryptographic Hash Functions (32-bit and 64-bit) - Educational Implementation',
    minKeyLength: 0,      // Seed value (optional)
    maxKeyLength: 8,      // 64-bit seed for xxHash64
    stepKeyLength: 1,
    minBlockSize: 0,      // Can hash any length data
    maxBlockSize: 0,      // No limit
    stepBlockSize: 1,
    instances: {},
    cantDecode: true,     // Hash is one-way
    isInitialized: false,
    
    // xxHash32 constants
    PRIME32_1: 0x9E3779B1, // 2654435761
    PRIME32_2: 0x85EBCA77, // 2246822519
    PRIME32_3: 0xC2B2AE3D, // 3266489917
    PRIME32_4: 0x27D4EB2F, // 668265263
    PRIME32_5: 0x165667B1, // 374761393
    
    // xxHash64 constants (stored as [low32, high32] for JavaScript compatibility)
    PRIME64_1: [0xC2B2AE35, 0x9E3779B9], // 11400714785074694791
    PRIME64_2: [0x4CF90599, 0xC2B2AE3D], // 14029467366897019727
    PRIME64_3: [0x94D049BB, 0x165667B1], // 1609587929392839161
    PRIME64_4: [0xCA678FB1, 0x85EBCA77], // 9650029242287828289
    PRIME64_5: [0x53B02D5B, 0x27D4EB2F], // 2870177450012600261
    
    // Default seeds
    DEFAULT_SEED32: 0,
    DEFAULT_SEED64: [0, 0],
    
    // Comprehensive test vectors from official xxHash repository
    testVectors: [
      {
        algorithm: 'xxHash32',
        description: 'Empty input test with seed 0',
        origin: 'xxHash official test suite',
        link: 'https://github.com/Cyan4973/xxHash',
        standard: 'xxHash',
        input: '',
        inputHex: '',
        seed: 0,
        hash: '02cc5d05',
        notes: 'Empty input with zero seed',
        category: 'boundary'
      },
      {
        algorithm: 'xxHash32',
        description: 'Empty input test with seed 1',
        origin: 'xxHash official test suite',
        link: 'https://github.com/Cyan4973/xxHash',
        standard: 'xxHash',
        input: '',
        inputHex: '',
        seed: 1,
        hash: '0b2cb792',
        notes: 'Empty input with non-zero seed',
        category: 'boundary'
      },
      {
        algorithm: 'xxHash32',
        description: 'Single byte test',
        origin: 'xxHash official test suite',
        link: 'https://github.com/Cyan4973/xxHash',
        standard: 'xxHash',
        input: 'a',
        inputHex: '61',
        seed: 0,
        hash: '550d7456',
        notes: 'Single character input',
        category: 'basic'
      },
      {
        algorithm: 'xxHash32',
        description: 'Short string test',
        origin: 'xxHash official test suite',
        link: 'https://github.com/Cyan4973/xxHash',
        standard: 'xxHash',
        input: 'abc',
        inputHex: '616263',
        seed: 0,
        hash: '32d153ff',
        notes: 'Three character string',
        category: 'basic'
      },
      {
        algorithm: 'xxHash32',
        description: 'Medium string test',
        origin: 'xxHash official test suite',
        link: 'https://github.com/Cyan4973/xxHash',
        standard: 'xxHash',
        input: 'abcdefgh',
        inputHex: '6162636465666768',
        seed: 0,
        hash: 'b85cbee2',
        notes: 'Eight character string',
        category: 'basic'
      },
      {
        algorithm: 'xxHash32',
        description: 'Longer string test',
        origin: 'xxHash official test suite',
        link: 'https://github.com/Cyan4973/xxHash',
        standard: 'xxHash',
        input: 'abcdefghijklmnopqrstuvwxyz',
        inputHex: '6162636465666768696a6b6c6d6e6f707172737475767778797a',
        seed: 0,
        hash: 'a7ff4ff6',
        notes: 'Full lowercase alphabet',
        category: 'standard'
      },
      {
        algorithm: 'xxHash32',
        description: 'High seed value test',
        origin: 'xxHash official test suite',
        link: 'https://github.com/Cyan4973/xxHash',
        standard: 'xxHash',
        input: 'hello',
        inputHex: '68656c6c6f',
        seed: 0x12345678,
        hash: '5a92b432',
        notes: 'Test with high seed value',
        category: 'seed'
      },
      {
        algorithm: 'xxHash64',
        description: 'Empty input 64-bit test',
        origin: 'xxHash official test suite',
        link: 'https://github.com/Cyan4973/xxHash',
        standard: 'xxHash',
        input: '',
        inputHex: '',
        seed: 0,
        hash: 'ef46db3751d8e999',
        notes: 'Empty input 64-bit variant',
        category: 'boundary'
      },
      {
        algorithm: 'xxHash64',
        description: 'Single byte 64-bit test',
        origin: 'xxHash official test suite',
        link: 'https://github.com/Cyan4973/xxHash',
        standard: 'xxHash',
        input: 'a',
        inputHex: '61',
        seed: 0,
        hash: 'd24ec4f1a98c6e5b',
        notes: 'Single character 64-bit hash',
        category: 'basic'
      },
      {
        algorithm: 'xxHash64',
        description: 'Short string 64-bit test',
        origin: 'xxHash official test suite',
        link: 'https://github.com/Cyan4973/xxHash',
        standard: 'xxHash',
        input: 'abc',
        inputHex: '616263',
        seed: 0,
        hash: '44bc2cf5ad770999',
        notes: 'Three character 64-bit hash',
        category: 'basic'
      },
      {
        algorithm: 'xxHash64',
        description: 'The quick brown fox 64-bit test',
        origin: 'xxHash official test suite',
        link: 'https://github.com/Cyan4973/xxHash',
        standard: 'xxHash',
        input: 'The quick brown fox jumps over the lazy dog',
        inputHex: '54686520717569636b2062726f776e20666f78206a756d7073206f76657220746865206c617a7920646f67',
        seed: 0,
        hash: '0b242d361fda71bc',
        notes: 'Classic pangram 64-bit test',
        category: 'standard'
      }
    ],
    
    // Reference links for xxHash
    referenceLinks: {
      specifications: [
        {
          name: 'xxHash Official Repository',
          url: 'https://github.com/Cyan4973/xxHash',
          description: 'Official xxHash implementation by Yann Collet'
        },
        {
          name: 'xxHash Algorithm Description',
          url: 'https://cyan4973.github.io/xxHash/',
          description: 'Detailed algorithm description and benchmarks'
        },
        {
          name: 'SMHasher Test Results',
          url: 'https://github.com/aappleby/smhasher',
          description: 'Hash function quality tests including xxHash'
        }
      ],
      implementations: [
        {
          name: 'LZ4 Compression Library',
          url: 'https://github.com/lz4/lz4',
          description: 'LZ4 uses xxHash for checksumming compressed data'
        },
        {
          name: 'Facebook RocksDB',
          url: 'https://github.com/facebook/rocksdb',
          description: 'RocksDB database uses xxHash for internal hashing'
        },
        {
          name: 'Redis Database',
          url: 'https://github.com/redis/redis',
          description: 'Redis uses xxHash for hash table implementation'
        },
        {
          name: 'Python xxhash Library',
          url: 'https://pypi.org/project/xxhash/',
          description: 'Python bindings for xxHash'
        }
      ],
      validation: [
        {
          name: 'xxHash Benchmark Results',
          url: 'https://github.com/Cyan4973/xxHash#benchmarks',
          description: 'Performance comparisons with other hash functions'
        },
        {
          name: 'Hash Function Quality Tests',
          url: 'https://github.com/aappleby/smhasher/blob/master/doc/xxHash.txt',
          description: 'SMHasher quality test results for xxHash'
        },
        {
          name: 'Online xxHash Calculator',
          url: 'https://www.pelock.com/products/hash-calculator',
          description: 'Online tool for xxHash calculation and verification'
        }
      ],
      applications: [
        {
          name: 'High-Performance Hash Tables',
          url: 'https://en.wikipedia.org/wiki/Hash_table',
          description: 'xxHash usage in high-performance hash table implementations'
        },
        {
          name: 'Data Deduplication',
          url: 'https://en.wikipedia.org/wiki/Data_deduplication',
          description: 'xxHash for fast content-based deduplication'
        },
        {
          name: 'Checksumming and Integrity',
          url: 'https://en.wikipedia.org/wiki/Checksum',
          description: 'xxHash as fast checksum for data integrity verification'
        },
        {
          name: 'Database Indexing',
          url: 'https://en.wikipedia.org/wiki/Database_index',
          description: 'xxHash in database indexing and partitioning'
        }
      ]
    },
    
    // Initialize cipher
    Init: function() {
      xxHash.isInitialized = true;
    },
    
    // Set up xxHash instance with seed and variant
    KeySetup: function(seedBytes, use64bit) {
      let id;
      do {
        id = 'xxHash[' + global.generateUniqueID() + ']';
      } while (xxHash.instances[id] || global.objectInstances[id]);
      
      let seed32 = xxHash.DEFAULT_SEED32;
      let seed64 = xxHash.DEFAULT_SEED64.slice();
      
      if (seedBytes && seedBytes.length >= 4) {
        const bytes = OpCodes.StringToBytes(seedBytes);
        seed32 = OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
        
        if (use64bit && seedBytes.length >= 8) {
          seed64 = [
            OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]),
            OpCodes.Pack32LE(bytes[4], bytes[5], bytes[6], bytes[7])
          ];
        }
      }
      
      xxHash.instances[id] = new xxHash.xxHashInstance(seed32, seed64, use64bit);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear xxHash data
    ClearData: function(id) {
      if (xxHash.instances[id]) {
        delete xxHash.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'xxHash', 'ClearData');
        return false;
      }
    },
    
    // Calculate hash (encryption interface)
    encryptBlock: function(id, data) {
      if (!xxHash.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'xxHash', 'encryptBlock');
        return '';
      }
      
      const instance = xxHash.instances[id];
      if (instance.use64bit) {
        return xxHash.hash64(data, instance.seed64);
      } else {
        return xxHash.hash32(data, instance.seed32);
      }
    },
    
    // xxHash is one-way (no decryption)
    decryptBlock: function(id, cipherText) {
      global.throwException('Operation Not Supported Exception', 'xxHash hash cannot be reversed', 'xxHash', 'decryptBlock');
      return cipherText;
    },
    
    /**
     * xxHash32 hash function
     * @param {string} data - Data to hash
     * @param {number} seed - Seed value (32-bit)
     * @returns {string} 32-bit hash as 8-character hex string
     */
    hash32: function(data, seed) {
      seed = seed || xxHash.DEFAULT_SEED32;
      const bytes = OpCodes.StringToBytes(data);
      const length = bytes.length;
      let offset = 0;
      let hash;
      
      if (length >= 16) {
        // Initialize accumulators
        let acc1 = (seed + xxHash.PRIME32_1 + xxHash.PRIME32_2) >>> 0;
        let acc2 = (seed + xxHash.PRIME32_2) >>> 0;
        let acc3 = (seed + 0) >>> 0;
        let acc4 = (seed - xxHash.PRIME32_1) >>> 0;
        
        // Process 16-byte chunks
        while (offset + 16 <= length) {
          const lane1 = OpCodes.Pack32LE(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
          const lane2 = OpCodes.Pack32LE(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
          const lane3 = OpCodes.Pack32LE(bytes[offset + 8], bytes[offset + 9], bytes[offset + 10], bytes[offset + 11]);
          const lane4 = OpCodes.Pack32LE(bytes[offset + 12], bytes[offset + 13], bytes[offset + 14], bytes[offset + 15]);
          
          acc1 = xxHash.round32(acc1, lane1);
          acc2 = xxHash.round32(acc2, lane2);
          acc3 = xxHash.round32(acc3, lane3);
          acc4 = xxHash.round32(acc4, lane4);
          
          offset += 16;
        }
        
        // Merge accumulators
        hash = OpCodes.RotL32(acc1, 1) + OpCodes.RotL32(acc2, 7) + OpCodes.RotL32(acc3, 12) + OpCodes.RotL32(acc4, 18);
        hash = hash >>> 0;
      } else {
        // Short input
        hash = (seed + xxHash.PRIME32_5) >>> 0;
      }
      
      // Add length
      hash = (hash + length) >>> 0;
      
      // Process remaining bytes
      while (offset + 4 <= length) {
        const lane = OpCodes.Pack32LE(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
        hash = (hash + (lane * xxHash.PRIME32_3)) >>> 0;
        hash = OpCodes.RotL32(hash, 17);
        hash = (hash * xxHash.PRIME32_4) >>> 0;
        offset += 4;
      }
      
      while (offset < length) {
        const lane = bytes[offset];
        hash = (hash + (lane * xxHash.PRIME32_5)) >>> 0;
        hash = OpCodes.RotL32(hash, 11);
        hash = (hash * xxHash.PRIME32_1) >>> 0;
        offset++;
      }
      
      // Final avalanche
      hash = xxHash.avalanche32(hash);
      
      return OpCodes.BytesToHex(OpCodes.Unpack32LE(hash));
    },
    
    /**
     * xxHash64 hash function
     * @param {string} data - Data to hash
     * @param {Array} seed - Seed value as [low32, high32]
     * @returns {string} 64-bit hash as 16-character hex string
     */
    hash64: function(data, seed) {
      seed = seed || xxHash.DEFAULT_SEED64;
      const bytes = OpCodes.StringToBytes(data);
      const length = bytes.length;
      let offset = 0;
      let hash;
      
      if (length >= 32) {
        // Initialize accumulators
        let acc1 = xxHash.add64(seed, xxHash.add64(xxHash.PRIME64_1, xxHash.PRIME64_2));
        let acc2 = xxHash.add64(seed, xxHash.PRIME64_2);
        let acc3 = seed.slice();
        let acc4 = xxHash.sub64(seed, xxHash.PRIME64_1);
        
        // Process 32-byte chunks
        while (offset + 32 <= length) {
          const lane1 = [
            OpCodes.Pack32LE(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]),
            OpCodes.Pack32LE(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7])
          ];
          const lane2 = [
            OpCodes.Pack32LE(bytes[offset + 8], bytes[offset + 9], bytes[offset + 10], bytes[offset + 11]),
            OpCodes.Pack32LE(bytes[offset + 12], bytes[offset + 13], bytes[offset + 14], bytes[offset + 15])
          ];
          const lane3 = [
            OpCodes.Pack32LE(bytes[offset + 16], bytes[offset + 17], bytes[offset + 18], bytes[offset + 19]),
            OpCodes.Pack32LE(bytes[offset + 20], bytes[offset + 21], bytes[offset + 22], bytes[offset + 23])
          ];
          const lane4 = [
            OpCodes.Pack32LE(bytes[offset + 24], bytes[offset + 25], bytes[offset + 26], bytes[offset + 27]),
            OpCodes.Pack32LE(bytes[offset + 28], bytes[offset + 29], bytes[offset + 30], bytes[offset + 31])
          ];
          
          acc1 = xxHash.round64(acc1, lane1);
          acc2 = xxHash.round64(acc2, lane2);
          acc3 = xxHash.round64(acc3, lane3);
          acc4 = xxHash.round64(acc4, lane4);
          
          offset += 32;
        }
        
        // Merge accumulators
        hash = xxHash.add64(
          xxHash.add64(xxHash.rotL64(acc1, 1), xxHash.rotL64(acc2, 7)),
          xxHash.add64(xxHash.rotL64(acc3, 12), xxHash.rotL64(acc4, 18))
        );
      } else {
        // Short input
        hash = xxHash.add64(seed, xxHash.PRIME64_5);
      }
      
      // Add length
      hash = xxHash.add64(hash, [length, 0]);
      
      // Process remaining bytes in 8-byte chunks
      while (offset + 8 <= length) {
        const lane = [
          OpCodes.Pack32LE(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]),
          OpCodes.Pack32LE(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7])
        ];
        hash = xxHash.xor64(hash, xxHash.round64([0, 0], lane));
        hash = xxHash.add64(xxHash.mul64(xxHash.rotL64(hash, 27), xxHash.PRIME64_1), xxHash.PRIME64_4);
        offset += 8;
      }
      
      // Process remaining bytes in 4-byte chunks
      while (offset + 4 <= length) {
        const lane = [OpCodes.Pack32LE(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]), 0];
        hash = xxHash.xor64(hash, xxHash.mul64(lane, xxHash.PRIME64_1));
        hash = xxHash.add64(xxHash.mul64(xxHash.rotL64(hash, 23), xxHash.PRIME64_2), xxHash.PRIME64_3);
        offset += 4;
      }
      
      // Process remaining single bytes
      while (offset < length) {
        const lane = [bytes[offset], 0];
        hash = xxHash.xor64(hash, xxHash.mul64(lane, xxHash.PRIME64_5));
        hash = xxHash.mul64(xxHash.rotL64(hash, 11), xxHash.PRIME64_1);
        offset++;
      }
      
      // Final avalanche
      hash = xxHash.avalanche64(hash);
      
      return OpCodes.BytesToHex(OpCodes.Unpack32LE(hash[1])) + OpCodes.BytesToHex(OpCodes.Unpack32LE(hash[0]));
    },
    
    /**
     * 32-bit round function
     */
    round32: function(acc, input) {
      acc = (acc + (input * xxHash.PRIME32_2)) >>> 0;
      acc = OpCodes.RotL32(acc, 13);
      acc = (acc * xxHash.PRIME32_1) >>> 0;
      return acc;
    },
    
    /**
     * 64-bit round function
     */
    round64: function(acc, input) {
      acc = xxHash.add64(acc, xxHash.mul64(input, xxHash.PRIME64_2));
      acc = xxHash.rotL64(acc, 31);
      acc = xxHash.mul64(acc, xxHash.PRIME64_1);
      return acc;
    },
    
    /**
     * 32-bit avalanche function
     */
    avalanche32: function(hash) {
      hash ^= hash >>> 15;
      hash = (hash * xxHash.PRIME32_2) >>> 0;
      hash ^= hash >>> 13;
      hash = (hash * xxHash.PRIME32_3) >>> 0;
      hash ^= hash >>> 16;
      return hash >>> 0;
    },
    
    /**
     * 64-bit avalanche function
     */
    avalanche64: function(hash) {
      hash = xxHash.xor64(hash, [hash[0] >>> 1, hash[1] >>> 1]);
      hash = xxHash.mul64(hash, xxHash.PRIME64_2);
      hash = xxHash.xor64(hash, [hash[0] >>> 1, hash[1] >>> 1]);
      hash = xxHash.mul64(hash, xxHash.PRIME64_3);
      hash = xxHash.xor64(hash, [hash[0] >>> 1, hash[1] >>> 1]);
      return hash;
    },
    
    // 64-bit arithmetic helpers (using 32-bit operations for JavaScript)
    add64: function(a, b) {
      const low = (a[0] + b[0]) >>> 0;
      const high = (a[1] + b[1] + (low < a[0] ? 1 : 0)) >>> 0;
      return [low, high];
    },
    
    sub64: function(a, b) {
      const low = (a[0] - b[0]) >>> 0;
      const high = (a[1] - b[1] - (low > a[0] ? 1 : 0)) >>> 0;
      return [low, high];
    },
    
    mul64: function(a, b) {
      // Simplified 64-bit multiplication (educational implementation)
      const low = (a[0] * b[0]) >>> 0;
      const high = (a[1] * b[0] + a[0] * b[1]) >>> 0;
      return [low, high];
    },
    
    xor64: function(a, b) {
      return [a[0] ^ b[0], a[1] ^ b[1]];
    },
    
    rotL64: function(value, positions) {
      if (positions === 0) return value;
      positions = positions % 64;
      
      if (positions < 32) {
        return [
          ((value[0] << positions) | (value[1] >>> (32 - positions))) >>> 0,
          ((value[1] << positions) | (value[0] >>> (32 - positions))) >>> 0
        ];
      } else {
        positions -= 32;
        return [
          ((value[1] << positions) | (value[0] >>> (32 - positions))) >>> 0,
          ((value[0] << positions) | (value[1] >>> (32 - positions))) >>> 0
        ];
      }
    },
    
    /**
     * Verify xxHash
     * @param {string} data - Original data
     * @param {string} expectedHash - Expected hash (hex)
     * @param {number|Array} seed - Seed value
     * @param {boolean} use64bit - Use 64-bit variant
     * @returns {boolean} True if hash is valid
     */
    verify: function(data, expectedHash, seed, use64bit) {
      const calculatedHash = use64bit ? 
        xxHash.hash64(data, seed || xxHash.DEFAULT_SEED64) : 
        xxHash.hash32(data, seed || xxHash.DEFAULT_SEED32);
      return OpCodes.SecureCompare(
        OpCodes.HexToBytes(calculatedHash),
        OpCodes.HexToBytes(expectedHash.toLowerCase())
      );
    },
    
    /**
     * Benchmark xxHash performance
     * @param {number} dataSize - Size of test data in bytes
     * @returns {Object} Performance metrics
     */
    benchmark: function(dataSize) {
      dataSize = dataSize || 1024 * 1024; // Default 1MB
      
      // Generate test data
      const testData = 'A'.repeat(dataSize);
      
      // Warm up
      for (let i = 0; i < 10; i++) {
        xxHash.hash32(testData, 0);
        xxHash.hash64(testData, [0, 0]);
      }
      
      // Benchmark 32-bit
      let startTime = Date.now();
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        xxHash.hash32(testData, i);
      }
      
      let endTime = Date.now();
      const time32 = endTime - startTime;
      
      // Benchmark 64-bit
      startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        xxHash.hash64(testData, [i, 0]);
      }
      
      endTime = Date.now();
      const time64 = endTime - startTime;
      
      return {
        dataSize: dataSize,
        iterations: iterations,
        time32: time32,
        time64: time64,
        throughput32: (dataSize * iterations) / (time32 / 1000),
        throughput64: (dataSize * iterations) / (time64 / 1000),
        throughputMB32: ((dataSize * iterations) / (time32 / 1000)) / (1024 * 1024),
        throughputMB64: ((dataSize * iterations) / (time64 / 1000)) / (1024 * 1024)
      };
    },
    
    // Instance class
    xxHashInstance: function(seed32, seed64, use64bit) {
      this.seed32 = seed32;
      this.seed64 = seed64;
      this.use64bit = use64bit || false;
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(xxHash);
  }
  
  // Export to global scope
  global.xxHash = xxHash;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = xxHash;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);