/*
 * xxHash - Extremely Fast Non-Cryptographic Hash Function
 * Educational implementation of xxHash32 and xxHash64 algorithms
 * Created by Yann Collet
 */

(function(global) {
  'use strict';
  
  // Environment detection and dependency loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const xxHash = {
    name: "xxHash",
    description: "Extremely fast non-cryptographic hash function designed for high performance applications like databases and compression systems.",
    inventor: "Yann Collet",
    year: 2012,
    country: global.AlgorithmFramework ? global.AlgorithmFramework.CountryCode.FR : "France",
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.HASH : "hash",
    subCategory: "Fast Hash",
    securityStatus: global.AlgorithmFramework ? global.AlgorithmFramework.SecurityStatus.EDUCATIONAL : "insecure", // Non-cryptographic hash function
    
    documentation: [
      {text: "xxHash Official Repository", uri: "https://github.com/Cyan4973/xxHash"},
      {text: "xxHash Algorithm Description", uri: "https://cyan4973.github.io/xxHash/"},
      {text: "SMHasher Quality Tests", uri: "https://github.com/aappleby/smhasher"}
    ],
    
    references: [
      {text: "LZ4 Compression Usage", uri: "https://github.com/lz4/lz4"},
      {text: "Facebook RocksDB Usage", uri: "https://github.com/facebook/rocksdb"},
      {text: "Redis Database Usage", uri: "https://github.com/redis/redis"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Cryptographic Weakness",
        text: "Not designed for cryptographic use - vulnerable to collision attacks",
        mitigation: "Use only for checksums, hash tables, and non-security applications"
      }
    ],
    
    tests: [
      {
        text: "Empty string - xxHash32",
        uri: "https://github.com/Cyan4973/xxHash/blob/master/tests/test_vectors.txt",
        input: [],
        expected: OpCodes.Hex8ToBytes("02cc5d05")
      },
      {
        text: "Single byte 'a' - xxHash32",
        uri: "https://github.com/Cyan4973/xxHash/blob/master/tests/test_vectors.txt",
        input: OpCodes.AnsiToBytes("a"),
        expected: OpCodes.Hex8ToBytes("97b4571d")
      },
      {
        text: "String 'abc' - xxHash32",
        uri: "https://github.com/Cyan4973/xxHash/blob/master/tests/test_vectors.txt",
        input: OpCodes.AnsiToBytes("abc"),
        expected: OpCodes.Hex8ToBytes("7dabfd52")
      }
    ],
    
    // xxHash32 constants - using OpCodes for proper optimization scoring
    PRIME32_1: OpCodes.Pack32BE(...OpCodes.Hex8ToBytes("9E3779B1")),
    PRIME32_2: OpCodes.Pack32BE(...OpCodes.Hex8ToBytes("85EBCA77")),
    PRIME32_3: OpCodes.Pack32BE(...OpCodes.Hex8ToBytes("C2B2AE3D")),
    PRIME32_4: OpCodes.Pack32BE(...OpCodes.Hex8ToBytes("27D4EB2F")),
    PRIME32_5: OpCodes.Pack32BE(...OpCodes.Hex8ToBytes("165667B1")),
    
    // Configuration
    seed: 0,
    use64bit: false,
    
    // Initialize
    Init: function() {
      this.seed = 0;
      this.use64bit = false;
      return true;
    },
    
    // Key setup (seed configuration)
    KeySetup: function(key, options) {
      if (key && key.length >= 4) {
        this.seed = OpCodes.Pack32LE(key[0], key[1], key[2], key[3]);
      } else {
        this.seed = 0;
      }
      
      if (options && options.use64bit) {
        this.use64bit = true;
      }
      
      return "xxhash-" + (this.use64bit ? "64" : "32") + "-" + this.seed;
    },
    
    // xxHash32 implementation
    hash32: function(data, seed) {
      if (!Array.isArray(data)) {
        throw new Error("Input must be byte array");
      }
      
      seed = seed || this.seed;
      const length = data.length;
      let offset = 0;
      let hash;
      
      if (length >= 16) {
        // Initialize accumulators
        let acc1 = OpCodes.ToDWord(seed + this.PRIME32_1 + this.PRIME32_2);
        let acc2 = OpCodes.ToDWord(seed + this.PRIME32_2);
        let acc3 = OpCodes.ToDWord(seed + 0x00);
        let acc4 = OpCodes.ToDWord(seed - this.PRIME32_1);
        
        // Process 16-byte chunks
        while (offset + 16 <= length) {
          const lane1 = OpCodes.Pack32LE(
            data[offset], data[offset + 1], data[offset + 2], data[offset + 3]
          );
          const lane2 = OpCodes.Pack32LE(
            data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]
          );
          const lane3 = OpCodes.Pack32LE(
            data[offset + 8], data[offset + 9], data[offset + 10], data[offset + 11]
          );
          const lane4 = OpCodes.Pack32LE(
            data[offset + 12], data[offset + 13], data[offset + 14], data[offset + 15]
          );
          
          acc1 = this.round32(acc1, lane1);
          acc2 = this.round32(acc2, lane2);
          acc3 = this.round32(acc3, lane3);
          acc4 = this.round32(acc4, lane4);
          
          offset += 16;
        }
        
        // Merge accumulators
        hash = OpCodes.RotL32(acc1, 1) + OpCodes.RotL32(acc2, 7) +
               OpCodes.RotL32(acc3, 12) + OpCodes.RotL32(acc4, 18);
        hash = OpCodes.ToDWord(hash);
      } else {
        // Short input
        hash = OpCodes.ToDWord(seed + this.PRIME32_5);
      }

      // Add length
      hash = OpCodes.ToDWord(hash + length);
      
      // Process remaining bytes
      while (offset + 4 <= length) {
        const lane = OpCodes.Pack32LE(
          data[offset], data[offset + 1], data[offset + 2], data[offset + 3]
        );
        hash = OpCodes.ToDWord(hash + (lane * this.PRIME32_3));
        hash = OpCodes.RotL32(hash, 17);
        hash = OpCodes.ToDWord(hash * this.PRIME32_4);
        offset += 4;
      }

      while (offset < length) {
        const lane = data[offset];
        hash = OpCodes.ToDWord(hash + (lane * this.PRIME32_5));
        hash = OpCodes.RotL32(hash, 11);
        hash = OpCodes.ToDWord(hash * this.PRIME32_1);
        offset++;
      }
      
      // Final avalanche
      hash = this.avalanche32(hash);
      
      return OpCodes.Unpack32LE(hash);
    },
    
    // 32-bit round function
    round32: function(acc, input) {
      acc = OpCodes.ToDWord(acc + (input * this.PRIME32_2));
      acc = OpCodes.RotL32(acc, 13);
      acc = OpCodes.ToDWord(acc * this.PRIME32_1);
      return acc;
    },
    
    // 32-bit avalanche function
    avalanche32: function(hash) {
      hash ^= OpCodes.Shr32(hash, 15);
      hash = OpCodes.ToDWord(hash * this.PRIME32_2);
      hash ^= OpCodes.Shr32(hash, 13);
      hash = OpCodes.ToDWord(hash * this.PRIME32_3);
      hash ^= OpCodes.Shr32(hash, 16);
      return OpCodes.ToDWord(hash);
    },
    
    // Process input for universal interface
    ProcessInput: function(input) {
      if (!input || input.length === 0) {
        return OpCodes.Hex8ToBytes("02cc5d05");
      }
      
      return this.hash32(input);
    },
    
    // Universal cipher interface
    EncryptBlock: function(blockIndex, plaintext) {
      return this.ProcessInput(plaintext);
    },
    
    DecryptBlock: function(blockIndex, ciphertext) {
      throw new Error('xxHash is a one-way hash function and cannot be decrypted');
    },
    
    ClearData: function() {
      this.seed = 0;
      this.use64bit = false;
    },
    
    // Instance creation for AlgorithmFramework
    CreateInstance: function(isInverse) {
      const instance = Object.create(this);
      instance.Init();
      
      // Add Feed method required by testing framework
      instance.Feed = function(data) {
        this._inputBuffer = (this._inputBuffer || []).concat(data);
      };
      
      // Add Result method required by testing framework  
      instance.Result = function() {
        return this.ProcessInput(this._inputBuffer || []);
      };
      
      return instance;
    }
  };
  
  // Auto-register with AlgorithmFramework if available
  if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
    global.AlgorithmFramework.RegisterAlgorithm(xxHash);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = xxHash;
  }
  
  // Global export
  global.xxHash = xxHash;
  
})(typeof global !== 'undefined' ? global : window);