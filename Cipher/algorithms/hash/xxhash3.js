/*
 * xxHash3 Implementation - Ultra-Fast Non-Cryptographic Hash Function
 * Latest generation xxHash (64-bit and 128-bit variants)
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection and OpCodes loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const XXHash3 = {
    name: "xxHash3",
    description: "Ultra-fast non-cryptographic hash function optimized for speed and quality. Latest generation of xxHash family with improved performance on small data and better distribution properties.",
    inventor: "Yann Collet",
    year: 2019,
    country: "Multi-national",
    category: "hash",
    subCategory: "Fast Hash",
    securityStatus: "educational",
    securityNotes: "Non-cryptographic hash function optimized for speed and distribution quality. Not suitable for cryptographic applications requiring collision or preimage resistance.",
    
    documentation: [
      {text: "xxHash Official Website", uri: "https://xxhash.com/"},
      {text: "GitHub Repository", uri: "https://github.com/Cyan4973/xxHash"},
      {text: "Algorithm Documentation", uri: "https://github.com/Cyan4973/xxHash/blob/dev/doc/xxhash_spec.md"}
    ],
    
    references: [
      {text: "Reference Implementation", uri: "https://github.com/Cyan4973/xxHash/blob/dev/xxhash.h"},
      {text: "SMHasher Test Results", uri: "https://github.com/rurban/smhasher"},
      {text: "Performance Benchmarks", uri: "https://xxhash.com/#benchmarks"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Cryptographic Weakness",
        text: "Not designed for cryptographic use - vulnerable to deliberate collision attacks",
        mitigation: "Use only for non-cryptographic applications like hash tables and checksums"
      }
    ],
    
    tests: [
      {
        text: "xxHash3-64 Empty String",
        uri: "https://github.com/Cyan4973/xxHash/blob/dev/tests/",
        input: OpCodes.Hex8ToBytes(""),
        seed: 0,
        outputSize: 8,
        expectedOutput64: OpCodes.Hex8ToBytes("2D06800538D394C2")
      },
      {
        text: "xxHash3-64 Single Byte",
        uri: "https://github.com/Cyan4973/xxHash/blob/dev/tests/",
        input: OpCodes.Hex8ToBytes("00"),
        seed: 0,
        outputSize: 8,
        expectedOutput64: OpCodes.Hex8ToBytes("C44BDFF4074EECDB")
      },
      {
        text: "xxHash3-64 Test Vector 'a'",
        uri: "https://github.com/Cyan4973/xxHash/blob/dev/tests/",
        input: OpCodes.StringToBytes("a"),
        seed: 0,
        outputSize: 8,
        expectedOutput64: OpCodes.Hex8ToBytes("D24EC4F1A98C6E5B")
      },
      {
        text: "xxHash3-128 Test Vector 'Hello World'",
        uri: "https://github.com/Cyan4973/xxHash/blob/dev/tests/",
        input: OpCodes.StringToBytes("Hello World"),
        seed: 0,
        outputSize: 16,
        expectedOutput128: OpCodes.Hex8ToBytes("C89A7F4C2FAD5E3EC61F46F8CE5E9E3A")
      },
      {
        text: "xxHash3-64 with Custom Seed",
        uri: "https://github.com/Cyan4973/xxHash/blob/dev/tests/",
        input: OpCodes.StringToBytes("test"),
        seed: 0x123456789ABCDEF0,
        outputSize: 8,
        expectedOutput64: OpCodes.Hex8ToBytes("4FCE394CC88952D8")
      }
    ],

    // Legacy interface properties
    internalName: 'xxhash3',
    minKeyLength: 0,
    maxKeyLength: 8,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 1000000,
    stepBlockSize: 1,
    instances: {},
    version: '1.0.0',
    keySize: 8,
    blockSize: 32,
    
    // Algorithm metadata
    isStreamCipher: false,
    isBlockCipher: false,
    isHash: true,
    complexity: 'Low',
    family: 'xxHash',
    category: 'Fast-Hash',
    
    // xxHash3 constants
    PRIME32_1: 0x9E3779B1,
    PRIME32_2: 0x85EBCA77,
    PRIME32_3: 0xC2B2AE3D,
    PRIME32_4: 0x27D4EB2F,
    PRIME32_5: 0x165667B1,
    
    PRIME64_1: 0x9E3779B185EBCA87n,
    PRIME64_2: 0xC2B2AE3D27D4EB4Fn,
    PRIME64_3: 0x165667B19E3779F9n,
    PRIME64_4: 0x85EBCA77C2B2AE63n,
    PRIME64_5: 0x27D4EB2F165667C5n,
    
    // xxHash3 secret (first 192 bytes of the default secret)
    SECRET: new Uint8Array([
      0xb8, 0xfe, 0x6c, 0x39, 0x23, 0xa4, 0x4b, 0xbe, 0x7c, 0x01, 0x81, 0x2c, 0xf7, 0x21, 0xad, 0x1c,
      0xde, 0xd4, 0x6d, 0xe9, 0x83, 0x90, 0x97, 0xdb, 0x72, 0x40, 0xa4, 0xa4, 0xb7, 0xb3, 0x67, 0x1f,
      0xcb, 0x79, 0xe6, 0x4e, 0xcc, 0xc0, 0xe5, 0x78, 0x82, 0x5a, 0xd0, 0x7d, 0xcc, 0xff, 0x72, 0x21,
      0xb8, 0x08, 0x46, 0x74, 0xf7, 0x43, 0x24, 0x8e, 0xe0, 0x35, 0x90, 0xe6, 0x81, 0x3a, 0x26, 0x4c,
      0x3c, 0x28, 0x52, 0xbb, 0x91, 0xc3, 0x00, 0xcb, 0x88, 0xd0, 0x65, 0x8b, 0x1b, 0x53, 0x2e, 0xa3,
      0x71, 0x64, 0x48, 0x97, 0xa2, 0x0d, 0xf9, 0x4e, 0x38, 0x19, 0xef, 0x46, 0xa9, 0xde, 0xac, 0xd8,
      0xa8, 0xfa, 0x76, 0x3f, 0xe3, 0x9c, 0x34, 0x3f, 0xf9, 0xdc, 0xbb, 0xc7, 0xc7, 0x0b, 0x4f, 0x1d,
      0x8a, 0x51, 0xe0, 0x4b, 0xcd, 0xb4, 0x59, 0x31, 0xc8, 0x9f, 0x7e, 0xc9, 0xd9, 0x78, 0x73, 0x64,
      0xea, 0xc5, 0xac, 0x83, 0x34, 0xd3, 0xeb, 0xc3, 0xc5, 0x81, 0xa0, 0xff, 0xfa, 0x13, 0x63, 0xeb,
      0x17, 0x0d, 0xdd, 0x51, 0xb7, 0xf0, 0xda, 0x49, 0xd3, 0x16, 0x55, 0x26, 0x29, 0xd4, 0x68, 0x9e,
      0x2b, 0x16, 0xbe, 0x58, 0x7d, 0x47, 0xa1, 0xfc, 0x8f, 0xf8, 0xb8, 0xd1, 0x7a, 0xd0, 0x31, 0xce,
      0x45, 0xcb, 0x3a, 0x8f, 0x95, 0x16, 0x04, 0x28, 0xaf, 0xd7, 0xfb, 0xca, 0xbb, 0x4b, 0x40, 0x7e
    ]),
    
    seed: 0,
    variant: 64, // 64 or 128 bit output
    
    // Initialize hash
    Init: function() {
      this.seed = 0;
      this.variant = 64;
      return true;
    },
    
    // Set seed (key)
    KeySetup: function(key, options) {
      if (typeof key === 'number') {
        this.seed = key;
      } else if (Array.isArray(key) && key.length >= 8) {
        // Convert byte array to 64-bit seed
        this.seed = 0;
        for (let i = 0; i < 8; i++) {
          this.seed = (this.seed << 8) | (key[i] || 0);
        }
      } else if (typeof key === 'string') {
        // Hash string to create seed
        this.seed = this.simpleHash(key);
      } else {
        this.seed = 0;
      }
      
      if (options && options.variant) {
        this.variant = options.variant === 128 ? 128 : 64;
      }
      
      return 'xxhash3-' + this.variant + '-' + Math.random().toString(36).substr(2, 9);
    },
    
    // Simple hash for seed generation
    simpleHash: function(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xFFFFFFFF;
      }
      return hash;
    },
    
    // 32-bit rotation
    rotl32: function(x, r) {
      return ((x << r) | (x >>> (32 - r))) >>> 0;
    },
    
    // 64-bit rotation (using BigInt for precision)
    rotl64: function(x, r) {
      if (typeof x === 'number') {
        x = BigInt(x);
      }
      r = BigInt(r);
      return ((x << r) | (x >> (64n - r))) & 0xFFFFFFFFFFFFFFFFn;
    },
    
    // Read 32-bit little endian
    readLE32: function(data, offset) {
      offset = offset || 0;
      if (offset + 4 > data.length) return 0;
      
      return (data[offset] |
              (data[offset + 1] << 8) |
              (data[offset + 2] << 16) |
              (data[offset + 3] << 24)) >>> 0;
    },
    
    // Read 64-bit little endian (as BigInt)
    readLE64: function(data, offset) {
      offset = offset || 0;
      if (offset + 8 > data.length) return 0n;
      
      let result = 0n;
      for (let i = 0; i < 8; i++) {
        result |= BigInt(data[offset + i] || 0) << (BigInt(i) * 8n);
      }
      return result;
    },
    
    // Mix function for 64-bit hash
    mix64: function(input, secret) {
      const input_lo = Number(input & 0xFFFFFFFFn);
      const input_hi = Number(input >> 32n);
      const secret_64 = this.readLE64(secret, 0);
      const secret_lo = Number(secret_64 & 0xFFFFFFFFn);
      const secret_hi = Number(secret_64 >> 32n);
      
      const mul_lo = BigInt(input_lo ^ secret_lo) * BigInt(input_hi ^ secret_hi);
      return mul_lo;
    },
    
    // Avalanche function
    avalanche: function(h64) {
      h64 ^= h64 >> 37n;
      h64 *= 0x165667919E3779F9n;
      h64 ^= h64 >> 32n;
      return h64;
    },
    
    // xxHash3-64 implementation
    hash64: function(input, seed) {
      seed = seed || this.seed;
      const len = input.length;
      
      if (len === 0) {
        return this.avalanche(BigInt(seed) ^ this.PRIME64_1);
      }
      
      if (len <= 16) {
        return this.hash64_0to16(input, len, BigInt(seed));
      }
      
      if (len <= 128) {
        return this.hash64_17to128(input, len, BigInt(seed));
      }
      
      return this.hash64_129to240(input, len, BigInt(seed));
    },
    
    // Hash 0-16 bytes
    hash64_0to16: function(input, len, seed) {
      if (len > 8) {
        const inputLo = this.readLE64(input, 0);
        const inputHi = this.readLE64(input, len - 8);
        let acc = seed ^ (this.readLE64(this.SECRET, 24) + this.readLE64(this.SECRET, 32));
        acc ^= inputLo;
        acc ^= inputHi;
        return this.avalanche(acc);
      }
      
      if (len >= 4) {
        const input1 = BigInt(this.readLE32(input, 0));
        const input2 = BigInt(this.readLE32(input, len - 4));
        const acc = seed ^ (this.readLE64(this.SECRET, 8) + this.readLE64(this.SECRET, 16));
        const keyed = (input1 << 32n) | input2;
        return this.avalanche(acc ^ keyed);
      }
      
      if (len === 1) {
        const c1 = BigInt(input[0]);
        const c2 = BigInt(input[0]);
        const combined = c1 | (c2 << 8n);
        const keyed = combined ^ (this.readLE64(this.SECRET, 0) & 0xFFFFn);
        return this.avalanche(seed ^ keyed);
      }
      
      return this.avalanche(seed ^ this.PRIME64_1);
    },
    
    // Hash 17-128 bytes (simplified)
    hash64_17to128: function(input, len, seed) {
      let acc = BigInt(len) * this.PRIME64_1;
      
      for (let i = 0; i < len; i += 8) {
        const chunk = this.readLE64(input, i);
        const secret = this.readLE64(this.SECRET, (i % 192));
        acc += chunk ^ secret;
      }
      
      acc ^= seed;
      return this.avalanche(acc);
    },
    
    // Hash 129+ bytes (simplified)
    hash64_129to240: function(input, len, seed) {
      let acc = BigInt(len) * this.PRIME64_1;
      
      // Process in 32-byte stripes
      for (let i = 0; i < len; i += 32) {
        for (let j = 0; j < 4; j++) {
          const offset = i + j * 8;
          if (offset + 8 <= len) {
            const chunk = this.readLE64(input, offset);
            const secret = this.readLE64(this.SECRET, ((offset / 8) % 24) * 8);
            acc += chunk ^ secret;
          }
        }
      }
      
      acc ^= seed;
      return this.avalanche(acc);
    },
    
    // xxHash3-128 implementation (simplified)
    hash128: function(input, seed) {
      seed = seed || this.seed;
      
      // For educational purposes, generate 128-bit hash as two 64-bit hashes
      const hash1 = this.hash64(input, seed);
      const hash2 = this.hash64(input, Number(BigInt(seed) ^ 0xAAAAAAAAAAAAAAAAn));
      
      // Combine into 128-bit result
      const result = new Array(16);
      
      // Little-endian encoding of hash1
      for (let i = 0; i < 8; i++) {
        result[i] = Number((hash1 >> (BigInt(i) * 8n)) & 0xFFn);
      }
      
      // Little-endian encoding of hash2
      for (let i = 0; i < 8; i++) {
        result[8 + i] = Number((hash2 >> (BigInt(i) * 8n)) & 0xFFn);
      }
      
      return result;
    },
    
    // Main hash function
    hash: function(input, outputSize) {
      outputSize = outputSize || this.variant / 8;
      
      if (outputSize === 8) {
        const hash64 = this.hash64(input);
        const result = new Array(8);
        for (let i = 0; i < 8; i++) {
          result[i] = Number((hash64 >> (BigInt(i) * 8n)) & 0xFFn);
        }
        return result;
      } else if (outputSize === 16) {
        return this.hash128(input);
      } else {
        throw new Error('xxHash3 supports only 64-bit (8 bytes) or 128-bit (16 bytes) output');
      }
    },
    
    // Legacy cipher interface
    szEncryptBlock: function(blockIndex, plaintext) {
      return this.hash(plaintext, this.variant / 8);
    },
    
    szDecryptBlock: function(blockIndex, ciphertext) {
      throw new Error('xxHash3 is a one-way hash function and cannot be decrypted');
    },
    
    ClearData: function() {
      this.seed = 0;
    },
    
    // Test vector runner
    runTestVector: function() {
      console.log('Running xxHash3 test vectors...');
      
      let allPassed = true;
      
      for (let i = 0; i < this.tests.length; i++) {
        const test = this.tests[i];
        console.log(`Running test: ${test.text}`);
        
        try {
          this.Init();
          this.KeySetup(test.seed, {variant: test.outputSize * 8});
          
          const result = this.hash(test.input, test.outputSize);
          
          let expected;
          if (test.outputSize === 8 && test.expectedOutput64) {
            expected = test.expectedOutput64;
          } else if (test.outputSize === 16 && test.expectedOutput128) {
            expected = test.expectedOutput128;
          } else {
            console.log(`Test ${i + 1}: SKIP (no expected output for size ${test.outputSize})`);
            continue;
          }
          
          const passed = OpCodes.SecureCompare(result, expected);
          
          if (passed) {
            console.log(`Test ${i + 1}: PASS`);
          } else {
            console.log(`Test ${i + 1}: FAIL`);
            console.log('Expected:', OpCodes.BytesToHex8(expected));
            console.log('Actual:', OpCodes.BytesToHex8(result));
            allPassed = false;
          }
          
        } catch (error) {
          console.log(`Test ${i + 1}: ERROR - ${error.message}`);
          allPassed = false;
        }
      }
      
      // Additional demonstration
      console.log('\nxxHash3 Speed Demonstration:');
      this.Init();
      this.KeySetup(0);
      
      const demoData = OpCodes.StringToBytes("The quick brown fox jumps over the lazy dog");
      const hash64 = this.hash(demoData, 8);
      const hash128 = this.hash(demoData, 16);
      
      console.log('Input:', OpCodes.BytesToString(demoData));
      console.log('xxHash3-64:', OpCodes.BytesToHex8(hash64));
      console.log('xxHash3-128:', OpCodes.BytesToHex8(hash128));
      
      return {
        algorithm: 'xxHash3',
        variant: this.variant,
        allTestsPassed: allPassed,
        testCount: this.tests.length,
        notes: 'Ultra-fast non-cryptographic hash function for hash tables, checksums, and fingerprinting'
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(XXHash3);
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = XXHash3;
  }
  
  // Global export
  global.XXHash3 = XXHash3;
  
})(typeof global !== 'undefined' ? global : window);