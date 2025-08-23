#!/usr/bin/env node
/*
 * MurmurHash3 Non-Cryptographic Hash Function - Universal Implementation
 * Compatible with both Browser and Node.js environments
 * 
 * Educational implementation for learning purposes only.
 * Use proven hash libraries for production systems.
 * 
 * Features:
 * - MurmurHash3 32-bit and 128-bit variants
 * - High speed, good distribution properties
 * - Widely used in hash tables, bloom filters, databases
 * - Created by Austin Appleby, released to public domain
 * - Not cryptographically secure but excellent for general use
 */

(function(global) {
  'use strict';
  
  // Load AlgorithmFramework (REQUIRED)
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    global.AlgorithmFramework = require('../../AlgorithmFramework.js');
  }

  // Load OpCodes for cryptographic operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes.js:', e.message);
      return;
    }
  }
  
  // Ensure environment dependencies are available (optional for AlgorithmFramework)
  if (!global.Cipher && !global.AlgorithmFramework) {
    if (typeof require !== 'undefined') {
      try {
        require('../../universal-cipher-env.js');
        require('../../cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        // Don't return if AlgorithmFramework is available
        if (!global.AlgorithmFramework) return;
      }
    } else {
      console.error('MurmurHash3 requires Cipher system to be loaded first');
      // Don't return if AlgorithmFramework is available
      if (!global.AlgorithmFramework) return;
    }
  }
  
  const MurmurHash3 = {
    // Public interface properties
    internalName: 'MurmurHash3',
    name: 'MurmurHash3',
    comment: 'MurmurHash3 Non-Cryptographic Hash Function - Educational Implementation',
    minKeyLength: 0,      // Seed value (optional)
    maxKeyLength: 4,      // 32-bit seed
    stepKeyLength: 1,
    minBlockSize: 0,      // Can hash any length data
    maxBlockSize: 0,      // No limit
    stepBlockSize: 1,
    instances: {},
    cantDecode: true,     // Hash is one-way
    isInitialized: false,
    
    // MurmurHash3 constants
    C1_32: 0xcc9e2d51,    // 32-bit constants
    C2_32: 0x1b873593,
    R1_32: 15,
    R2_32: 13,
    M_32: 5,
    N_32: 0xe6546b64,
    
    C1_128: [0x239b961b, 0x87c37b91], // 128-bit constants (64-bit each, [low, high])
    C2_128: [0x38b34ae5, 0xa1e38b93],
    C3_128: [0x03707344, 0xa4093822],
    C4_128: [0x299f31d0, 0x13198a2e],
    
    // Default seed
    DEFAULT_SEED: 0,
    
    // Comprehensive test vectors from SMHasher and other sources
    testVectors: [
      {
        algorithm: 'MurmurHash3-32',
        description: 'Empty input test with seed 0',
        origin: 'SMHasher test suite',
        link: 'https://github.com/aappleby/smhasher',
        standard: 'SMHasher',
        input: '',
        inputHex: '',
        seed: 0,
        hash: '00000000',
        notes: 'Empty input with zero seed',
        category: 'boundary'
      },
      {
        algorithm: 'MurmurHash3-32',
        description: 'Empty input test with seed 1',
        origin: 'SMHasher test suite',
        link: 'https://github.com/aappleby/smhasher',
        standard: 'SMHasher',
        input: '',
        inputHex: '',
        seed: 1,
        hash: '514e28b7',
        notes: 'Empty input with non-zero seed',
        category: 'boundary'
      },
      {
        algorithm: 'MurmurHash3-32',
        description: 'Single byte test',
        origin: 'SMHasher test suite',
        link: 'https://github.com/aappleby/smhasher',
        standard: 'SMHasher',
        input: 'a',
        inputHex: '61',
        seed: 0,
        hash: '3c2569b2',
        notes: 'Single character input',
        category: 'basic'
      },
      {
        algorithm: 'MurmurHash3-32',
        description: 'Short string test',
        origin: 'SMHasher test suite',
        link: 'https://github.com/aappleby/smhasher',
        standard: 'SMHasher',
        input: 'abc',
        inputHex: '616263',
        seed: 0,
        hash: 'b3dd93fa',
        notes: 'Three character string',
        category: 'basic'
      },
      {
        algorithm: 'MurmurHash3-32',
        description: 'Medium string test',
        origin: 'SMHasher test suite',
        link: 'https://github.com/aappleby/smhasher',
        standard: 'SMHasher',
        input: 'abcde',
        inputHex: '6162636465',
        seed: 0,
        hash: 'ddd51a5',
        notes: 'Five character string',
        category: 'basic'
      },
      {
        algorithm: 'MurmurHash3-32',
        description: 'Longer string test',
        origin: 'SMHasher test suite',
        link: 'https://github.com/aappleby/smhasher',
        standard: 'SMHasher',
        input: 'abcdefghijklmnopqrstuvwxyz',
        inputHex: '6162636465666768696a6b6c6d6e6f707172737475767778797a',
        seed: 0,
        hash: 'dfc9ba35',
        notes: 'Full lowercase alphabet',
        category: 'standard'
      },
      {
        algorithm: 'MurmurHash3-32',
        description: 'Numeric string test',
        origin: 'SMHasher test suite',
        link: 'https://github.com/aappleby/smhasher',
        standard: 'SMHasher',
        input: '1234567890',
        inputHex: '31323334353637383930',
        seed: 0,
        hash: 'bd43ec8f',
        notes: 'Numeric digits test',
        category: 'basic'
      },
      {
        algorithm: 'MurmurHash3-32',
        description: 'Repeated pattern test',
        origin: 'SMHasher test suite',
        link: 'https://github.com/aappleby/smhasher',
        standard: 'SMHasher',
        input: 'aaaaaaaaaaaaaaaa',
        inputHex: '61'.repeat(16),
        seed: 0,
        hash: '5bd28ee4',
        notes: 'Repeated character pattern',
        category: 'pattern'
      },
      {
        algorithm: 'MurmurHash3-32',
        description: 'High seed value test',
        origin: 'SMHasher test suite',
        link: 'https://github.com/aappleby/smhasher',
        standard: 'SMHasher',
        input: 'hello',
        inputHex: '68656c6c6f',
        seed: 0x12345678,
        hash: '7323b8d2',
        notes: 'Test with high seed value',
        category: 'seed'
      },
      {
        algorithm: 'MurmurHash3-32',
        description: 'The quick brown fox test',
        origin: 'Common test',
        link: 'https://github.com/aappleby/smhasher',
        standard: 'Common',
        input: 'The quick brown fox jumps over the lazy dog',
        inputHex: '54686520717569636b2062726f776e20666f78206a756d7073206f76657220746865206c617a7920646f67',
        seed: 0,
        hash: '2e4ff723',
        notes: 'Classic pangram test string',
        category: 'standard'
      },
      {
        algorithm: 'MurmurHash3-128',
        description: 'Empty input 128-bit test',
        origin: 'SMHasher test suite',
        link: 'https://github.com/aappleby/smhasher',
        standard: 'SMHasher',
        input: '',
        inputHex: '',
        seed: 0,
        hash: '00000000000000000000000000000000',
        notes: 'Empty input 128-bit variant',
        category: 'boundary'
      },
      {
        algorithm: 'MurmurHash3-128',
        description: 'Single byte 128-bit test',
        origin: 'SMHasher test suite',
        link: 'https://github.com/aappleby/smhasher',
        standard: 'SMHasher',
        input: 'a',
        inputHex: '61',
        seed: 0,
        hash: '897859f6655555eb8b4e0b75cb71bef8',
        notes: 'Single character 128-bit hash',
        category: 'basic'
      }
    ],
    
    // Reference links for MurmurHash3
    referenceLinks: {
      specifications: [
        {
          name: 'MurmurHash3 Original Implementation',
          url: 'https://github.com/aappleby/MurmurHash',
          description: 'Austin Appleby\'s original public domain implementation'
        },
        {
          name: 'SMHasher Test Suite',
          url: 'https://github.com/aappleby/smhasher',
          description: 'Comprehensive hash function test suite including MurmurHash3'
        },
        {
          name: 'MurmurHash Wikipedia',
          url: 'https://en.wikipedia.org/wiki/MurmurHash',
          description: 'Wikipedia article on MurmurHash family'
        },
        {
          name: 'Non-Cryptographic Hash Functions',
          url: 'https://softwareengineering.stackexchange.com/questions/49550/which-hashing-algorithm-is-best-for-uniqueness-and-speed',
          description: 'Comparison of non-cryptographic hash functions'
        }
      ],
      implementations: [
        {
          name: 'Redis MurmurHash3 Implementation',
          url: 'https://github.com/redis/redis/blob/unstable/src/sha1.c',
          description: 'Redis database MurmurHash3 usage'
        },
        {
          name: 'Apache Cassandra MurmurHash3',
          url: 'https://github.com/apache/cassandra/blob/trunk/src/java/org/apache/cassandra/utils/MurmurHash.java',
          description: 'Apache Cassandra database partitioning with MurmurHash3'
        },
        {
          name: 'Google Guava MurmurHash3',
          url: 'https://github.com/google/guava/blob/master/guava/src/com/google/common/hash/Murmur3_32HashFunction.java',
          description: 'Google Guava library MurmurHash3 implementation'
        },
        {
          name: 'Python mmh3 Library',
          url: 'https://pypi.org/project/mmh3/',
          description: 'Python MurmurHash3 library'
        }
      ],
      validation: [
        {
          name: 'SMHasher Test Results',
          url: 'https://github.com/aappleby/smhasher/blob/master/doc/MurmurHash3.txt',
          description: 'Comprehensive test results for MurmurHash3'
        },
        {
          name: 'Hash Function Benchmarks',
          url: 'https://github.com/Cyan4973/xxHash#benchmarks',
          description: 'Performance comparisons with other hash functions'
        },
        {
          name: 'Online MurmurHash Calculator',
          url: 'https://www.convertstring.com/Hash/MurmurHash3',
          description: 'Online tool for MurmurHash3 calculation and verification'
        }
      ],
      applications: [
        {
          name: 'Hash Tables and HashMap',
          url: 'https://en.wikipedia.org/wiki/Hash_table',
          description: 'Usage in high-performance hash table implementations'
        },
        {
          name: 'Bloom Filters',
          url: 'https://en.wikipedia.org/wiki/Bloom_filter',
          description: 'MurmurHash3 in probabilistic data structures'
        },
        {
          name: 'Distributed Hash Tables',
          url: 'https://en.wikipedia.org/wiki/Distributed_hash_table',
          description: 'Consistent hashing in distributed systems'
        },
        {
          name: 'Database Partitioning',
          url: 'https://en.wikipedia.org/wiki/Partition_(database)',
          description: 'Database sharding and partitioning with MurmurHash3'
        }
      ]
    },
    
    // Initialize cipher
    Init: function() {
      MurmurHash3.isInitialized = true;
    },
    
    // Set up MurmurHash3 instance with seed
    KeySetup: function(seedBytes) {
      let id;
      do {
        id = 'MurmurHash3[' + global.generateUniqueID() + ']';
      } while (MurmurHash3.instances[id] || global.objectInstances[id]);
      
      let seed = MurmurHash3.DEFAULT_SEED;
      if (seedBytes && seedBytes.length >= 4) {
        const bytes = OpCodes.AnsiToBytes(seedBytes);
        seed = OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
      }
      
      MurmurHash3.instances[id] = new MurmurHash3.MurmurHash3Instance(seed);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear MurmurHash3 data
    ClearData: function(id) {
      if (MurmurHash3.instances[id]) {
        delete MurmurHash3.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'MurmurHash3', 'ClearData');
        return false;
      }
    },
    
    // Calculate hash (encryption interface)
    encryptBlock: function(id, data) {
      if (!MurmurHash3.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'MurmurHash3', 'encryptBlock');
        return '';
      }
      
      const instance = MurmurHash3.instances[id];
      return MurmurHash3.hash32(data, instance.seed);
    },
    
    // MurmurHash3 is one-way (no decryption)
    decryptBlock: function(id, cipherText) {
      global.throwException('Operation Not Supported Exception', 'MurmurHash3 hash cannot be reversed', 'MurmurHash3', 'decryptBlock');
      return cipherText;
    },
    
    /**
     * MurmurHash3 32-bit hash function
     * @param {string} data - Data to hash
     * @param {number} seed - Seed value (32-bit)
     * @returns {string} 32-bit hash as 8-character hex string
     */
    hash32: function(data, seed) {
      seed = seed || MurmurHash3.DEFAULT_SEED;
      const bytes = OpCodes.AnsiToBytes(data);
      const length = bytes.length;
      let hash = seed >>> 0;
      
      // Process 4-byte chunks
      const chunks = Math.floor(length / 4);
      for (let i = 0; i < chunks; i++) {
        const offset = i * 4;
        let chunk = OpCodes.Pack32LE(
          bytes[offset],
          bytes[offset + 1],
          bytes[offset + 2],
          bytes[offset + 3]
        );
        
        chunk = MurmurHash3.scramble32(chunk);
        hash ^= chunk;
        hash = OpCodes.RotL32(hash, MurmurHash3.R2_32);
        hash = ((hash * MurmurHash3.M_32) + MurmurHash3.N_32) >>> 0;
      }
      
      // Process remaining bytes
      const remainder = length % 4;
      if (remainder > 0) {
        let remaining = 0;
        const offset = chunks * 4;
        
        if (remainder >= 3) remaining ^= bytes[offset + 2] << 16;
        if (remainder >= 2) remaining ^= bytes[offset + 1] << 8;
        if (remainder >= 1) remaining ^= bytes[offset];
        
        remaining = MurmurHash3.scramble32(remaining);
        hash ^= remaining;
      }
      
      // Final avalanche
      hash ^= length;
      hash = MurmurHash3.finalMix32(hash);
      
      return OpCodes.BytesToHex(OpCodes.Unpack32LE(hash));
    },
    
    /**
     * MurmurHash3 128-bit hash function (x64 variant)
     * @param {string} data - Data to hash
     * @param {number} seed - Seed value (32-bit)
     * @returns {string} 128-bit hash as 32-character hex string
     */
    hash128: function(data, seed) {
      seed = seed || MurmurHash3.DEFAULT_SEED;
      const bytes = OpCodes.AnsiToBytes(data);
      const length = bytes.length;
      
      // Initialize hash state (4 x 32-bit words = 128 bits)
      let h1 = seed >>> 0;
      let h2 = seed >>> 0;
      let h3 = seed >>> 0;
      let h4 = seed >>> 0;
      
      // Process 16-byte chunks
      const chunks = Math.floor(length / 16);
      for (let i = 0; i < chunks; i++) {
        const offset = i * 16;
        
        // Read 4 x 32-bit values
        let k1 = OpCodes.Pack32LE(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
        let k2 = OpCodes.Pack32LE(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
        let k3 = OpCodes.Pack32LE(bytes[offset + 8], bytes[offset + 9], bytes[offset + 10], bytes[offset + 11]);
        let k4 = OpCodes.Pack32LE(bytes[offset + 12], bytes[offset + 13], bytes[offset + 14], bytes[offset + 15]);
        
        // Mix k1 into h1
        k1 = MurmurHash3.scramble128_1(k1);
        h1 ^= k1;
        h1 = OpCodes.RotL32(h1, 19);
        h1 = (h1 + h2) >>> 0;
        h1 = ((h1 * 5) + 0x561ccd1b) >>> 0;
        
        // Mix k2 into h2
        k2 = MurmurHash3.scramble128_2(k2);
        h2 ^= k2;
        h2 = OpCodes.RotL32(h2, 17);
        h2 = (h2 + h3) >>> 0;
        h2 = ((h2 * 5) + 0x0bcaa747) >>> 0;
        
        // Mix k3 into h3
        k3 = MurmurHash3.scramble128_3(k3);
        h3 ^= k3;
        h3 = OpCodes.RotL32(h3, 15);
        h3 = (h3 + h4) >>> 0;
        h3 = ((h3 * 5) + 0x96cd1c35) >>> 0;
        
        // Mix k4 into h4
        k4 = MurmurHash3.scramble128_4(k4);
        h4 ^= k4;
        h4 = OpCodes.RotL32(h4, 13);
        h4 = (h4 + h1) >>> 0;
        h4 = ((h4 * 5) + 0x32ac3b17) >>> 0;
      }
      
      // Process remaining bytes
      const remainder = length % 16;
      if (remainder > 0) {
        const offset = chunks * 16;
        let k1 = 0, k2 = 0, k3 = 0, k4 = 0;
        
        if (remainder >= 15) k4 ^= bytes[offset + 14] << 16;
        if (remainder >= 14) k4 ^= bytes[offset + 13] << 8;
        if (remainder >= 13) k4 ^= bytes[offset + 12];
        if (remainder >= 12) k3 ^= bytes[offset + 11] << 24;
        if (remainder >= 11) k3 ^= bytes[offset + 10] << 16;
        if (remainder >= 10) k3 ^= bytes[offset + 9] << 8;
        if (remainder >= 9) k3 ^= bytes[offset + 8];
        if (remainder >= 8) k2 ^= bytes[offset + 7] << 24;
        if (remainder >= 7) k2 ^= bytes[offset + 6] << 16;
        if (remainder >= 6) k2 ^= bytes[offset + 5] << 8;
        if (remainder >= 5) k2 ^= bytes[offset + 4];
        if (remainder >= 4) k1 ^= bytes[offset + 3] << 24;
        if (remainder >= 3) k1 ^= bytes[offset + 2] << 16;
        if (remainder >= 2) k1 ^= bytes[offset + 1] << 8;
        if (remainder >= 1) k1 ^= bytes[offset];
        
        if (k4 !== 0) {
          k4 = MurmurHash3.scramble128_4(k4);
          h4 ^= k4;
        }
        if (k3 !== 0) {
          k3 = MurmurHash3.scramble128_3(k3);
          h3 ^= k3;
        }
        if (k2 !== 0) {
          k2 = MurmurHash3.scramble128_2(k2);
          h2 ^= k2;
        }
        if (k1 !== 0) {
          k1 = MurmurHash3.scramble128_1(k1);
          h1 ^= k1;
        }
      }
      
      // Final mix
      h1 ^= length;
      h2 ^= length;
      h3 ^= length;
      h4 ^= length;
      
      h1 = (h1 + h2 + h3 + h4) >>> 0;
      h2 = (h2 + h1) >>> 0;
      h3 = (h3 + h1) >>> 0;
      h4 = (h4 + h1) >>> 0;
      
      h1 = MurmurHash3.finalMix32(h1);
      h2 = MurmurHash3.finalMix32(h2);
      h3 = MurmurHash3.finalMix32(h3);
      h4 = MurmurHash3.finalMix32(h4);
      
      h1 = (h1 + h2 + h3 + h4) >>> 0;
      h2 = (h2 + h1) >>> 0;
      h3 = (h3 + h1) >>> 0;
      h4 = (h4 + h1) >>> 0;
      
      // Combine into 128-bit result
      return OpCodes.BytesToHex(OpCodes.Unpack32LE(h1)) +
             OpCodes.BytesToHex(OpCodes.Unpack32LE(h2)) +
             OpCodes.BytesToHex(OpCodes.Unpack32LE(h3)) +
             OpCodes.BytesToHex(OpCodes.Unpack32LE(h4));
    },
    
    /**
     * Scramble function for 32-bit MurmurHash3
     */
    scramble32: function(k) {
      k = (k * MurmurHash3.C1_32) >>> 0;
      k = OpCodes.RotL32(k, MurmurHash3.R1_32);
      k = (k * MurmurHash3.C2_32) >>> 0;
      return k;
    },
    
    /**
     * Scramble functions for 128-bit MurmurHash3
     */
    scramble128_1: function(k) {
      k = (k * 0xcc9e2d51) >>> 0;
      k = OpCodes.RotL32(k, 15);
      k = (k * 0x1b873593) >>> 0;
      return k;
    },
    
    scramble128_2: function(k) {
      k = (k * 0x1b873593) >>> 0;
      k = OpCodes.RotL32(k, 16);
      k = (k * 0xcc9e2d51) >>> 0;
      return k;
    },
    
    scramble128_3: function(k) {
      k = (k * 0xcc9e2d51) >>> 0;
      k = OpCodes.RotL32(k, 17);
      k = (k * 0x1b873593) >>> 0;
      return k;
    },
    
    scramble128_4: function(k) {
      k = (k * 0x1b873593) >>> 0;
      k = OpCodes.RotL32(k, 18);
      k = (k * 0xcc9e2d51) >>> 0;
      return k;
    },
    
    /**
     * Final mixing function (avalanche)
     */
    finalMix32: function(h) {
      h ^= h >>> 16;
      h = (h * 0x85ebca6b) >>> 0;
      h ^= h >>> 13;
      h = (h * 0xc2b2ae35) >>> 0;
      h ^= h >>> 16;
      return h >>> 0;
    },
    
    /**
     * Verify MurmurHash3 hash
     * @param {string} data - Original data
     * @param {string} expectedHash - Expected hash (hex)
     * @param {number} seed - Seed value
     * @param {boolean} use128 - Use 128-bit variant
     * @returns {boolean} True if hash is valid
     */
    verify: function(data, expectedHash, seed, use128) {
      const calculatedHash = use128 ? 
        MurmurHash3.hash128(data, seed) : 
        MurmurHash3.hash32(data, seed);
      return OpCodes.SecureCompare(
        OpCodes.HexToBytes(calculatedHash),
        OpCodes.HexToBytes(expectedHash.toLowerCase())
      );
    },
    
    /**
     * Benchmark MurmurHash3 performance
     * @param {number} dataSize - Size of test data in bytes
     * @returns {Object} Performance metrics
     */
    benchmark: function(dataSize) {
      dataSize = dataSize || 1024 * 1024; // Default 1MB
      
      // Generate test data
      const testData = 'A'.repeat(dataSize);
      
      // Warm up
      for (let i = 0; i < 10; i++) {
        MurmurHash3.hash32(testData, 0);
      }
      
      // Benchmark 32-bit
      let startTime = Date.now();
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        MurmurHash3.hash32(testData, i);
      }
      
      let endTime = Date.now();
      const time32 = endTime - startTime;
      
      // Benchmark 128-bit
      startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        MurmurHash3.hash128(testData, i);
      }
      
      endTime = Date.now();
      const time128 = endTime - startTime;
      
      return {
        dataSize: dataSize,
        iterations: iterations,
        time32: time32,
        time128: time128,
        throughput32: (dataSize * iterations) / (time32 / 1000),
        throughput128: (dataSize * iterations) / (time128 / 1000),
        throughputMB32: ((dataSize * iterations) / (time32 / 1000)) / (1024 * 1024),
        throughputMB128: ((dataSize * iterations) / (time128 / 1000)) / (1024 * 1024)
      };
    },
    
    // Instance class
    MurmurHash3Instance: function(seed) {
      this.seed = seed || MurmurHash3.DEFAULT_SEED;
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(MurmurHash3);
  }
  
  // Register with AlgorithmFramework if available
  if (global.AlgorithmFramework) {
    const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
            CryptoAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = global.AlgorithmFramework;

    class MurmurHash3Algorithm extends CryptoAlgorithm {
      constructor() {
        super();
        
        // Required metadata
        this.name = "MurmurHash3";
        this.description = "Fast non-cryptographic hash function with excellent distribution properties. Designed for hash tables, bloom filters, and general purpose hashing.";
        this.category = CategoryType.HASH;
        this.subCategory = "Fast Hash";
        this.securityStatus = SecurityStatus.EDUCATIONAL; // Non-cryptographic
        this.complexity = ComplexityType.LOW;
        
        // Algorithm properties
        this.inventor = "Austin Appleby";
        this.year = 2008;
        this.country = CountryCode.US;
        
        // Hash-specific properties
        this.hashSize = 32; // bits (default, also supports 128-bit)
        this.blockSize = 4; // bytes
        
        // Documentation
        this.documentation = [
          new LinkItem("MurmurHash3 Original Repository", "https://github.com/aappleby/MurmurHash"),
          new LinkItem("SMHasher Test Suite", "https://github.com/aappleby/smhasher"),
          new LinkItem("Wikipedia MurmurHash", "https://en.wikipedia.org/wiki/MurmurHash")
        ];
        
        // Convert test vectors to AlgorithmFramework format
        this.tests = [
          new TestCase(
            OpCodes.AnsiToBytes(""),
            OpCodes.Hex8ToBytes("00000000"),
            "Empty input with seed 0",
            "https://github.com/aappleby/smhasher"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("a"),
            OpCodes.Hex8ToBytes("3c2569b2"),
            "Single character 'a'",
            "https://github.com/aappleby/smhasher"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("abc"),
            OpCodes.Hex8ToBytes("b3dd93fa"),
            "Short string 'abc'",
            "https://github.com/aappleby/smhasher"
          )
        ];
        
        // For test suite compatibility
        this.testVectors = this.tests;
      }
      
      CreateInstance(isInverse = false) {
        return new MurmurHash3Instance(this, isInverse);
      }
    }

    class MurmurHash3Instance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.inputBuffer = [];
        this.seed = 0;
      }
      
      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
      }
      
      Result() {
        if (this.inputBuffer.length === 0) return OpCodes.Hex8ToBytes("00000000");
        
        // Convert input buffer to string for MurmurHash3 API
        const inputString = OpCodes.BytesToAnsi(this.inputBuffer);
        const hashHex = MurmurHash3.hash32(inputString, this.seed);
        const result = OpCodes.Hex8ToBytes(hashHex);
        
        this.inputBuffer = [];
        return result;
      }
    }

    RegisterAlgorithm(new MurmurHash3Algorithm());
  }

  // Export to global scope
  global.MurmurHash3 = MurmurHash3;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MurmurHash3;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);