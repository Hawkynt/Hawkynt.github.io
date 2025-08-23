/*
 * xxHash32 Hash Function - Universal AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 */

if (!global.AlgorithmFramework && typeof require !== 'undefined')
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');

if (!global.OpCodes && typeof require !== 'undefined')
  global.OpCodes = require('../../OpCodes.js');

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem } = AlgorithmFramework;
  
  // xxHash32 constants
  const XXHASH32_PRIME1 = 0x9E3779B1; // 2654435761
  const XXHASH32_PRIME2 = 0x85EBCA77; // 2246822519
  const XXHASH32_PRIME3 = 0xC2B2AE3D; // 3266489917
  const XXHASH32_PRIME4 = 0x27D4EB2F; // 668265263
  const XXHASH32_PRIME5 = 0x165667B1; // 374761393
  
  const XXHASH32_SEED = 0;  // Default seed
  
  /**
   * xxHash32 round function
   * @param {number} acc - Accumulator
   * @param {number} input - Input value
   * @returns {number} Updated accumulator
   */
  function xxh32Round(acc, input) {
    acc = (acc + ((input * XXHASH32_PRIME2) >>> 0)) >>> 0;
    acc = OpCodes.RotL32(acc, 13);
    acc = (acc * XXHASH32_PRIME1) >>> 0;
    return acc;
  }
  
  /**
   * xxHash32 avalanche function
   * @param {number} hash - Input hash
   * @returns {number} Avalanched hash
   */
  function xxh32Avalanche(hash) {
    hash ^= hash >>> 15;
    hash = (hash * XXHASH32_PRIME2) >>> 0;
    hash ^= hash >>> 13;
    hash = (hash * XXHASH32_PRIME3) >>> 0;
    hash ^= hash >>> 16;
    return hash >>> 0;
  }
  
  /**
   * xxHash32 implementation
   * @param {Uint8Array} data - Input data
   * @param {number} seed - Seed value (optional)
   * @returns {number} 32-bit hash value
   */
  function xxhash32(data, seed) {
    seed = seed || XXHASH32_SEED;
    const dataLength = data.length;
    let offset = 0;
    let hash;
    
    if (dataLength >= 16) {
      // Initialize accumulators
      let acc1 = (seed + XXHASH32_PRIME1 + XXHASH32_PRIME2) >>> 0;
      let acc2 = (seed + XXHASH32_PRIME2) >>> 0;
      let acc3 = (seed + 0) >>> 0;
      let acc4 = (seed - XXHASH32_PRIME1) >>> 0;
      
      // Process 16-byte chunks
      while (offset + 16 <= dataLength) {
        const lane1 = OpCodes.Pack32LE(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
        const lane2 = OpCodes.Pack32LE(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]);
        const lane3 = OpCodes.Pack32LE(data[offset + 8], data[offset + 9], data[offset + 10], data[offset + 11]);
        const lane4 = OpCodes.Pack32LE(data[offset + 12], data[offset + 13], data[offset + 14], data[offset + 15]);
        
        acc1 = xxh32Round(acc1, lane1);
        acc2 = xxh32Round(acc2, lane2);
        acc3 = xxh32Round(acc3, lane3);
        acc4 = xxh32Round(acc4, lane4);
        
        offset += 16;
      }
      
      // Merge accumulators
      hash = OpCodes.RotL32(acc1, 1) + OpCodes.RotL32(acc2, 7) + OpCodes.RotL32(acc3, 12) + OpCodes.RotL32(acc4, 18);
      hash = hash >>> 0;
    } else {
      // Short input
      hash = (seed + XXHASH32_PRIME5) >>> 0;
    }
    
    // Add data length
    hash = (hash + dataLength) >>> 0;
    
    // Process remaining 4-byte chunks
    while (offset + 4 <= dataLength) {
      const lane = OpCodes.Pack32LE(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
      hash = (hash + (lane * XXHASH32_PRIME3)) >>> 0;
      hash = OpCodes.RotL32(hash, 17);
      hash = (hash * XXHASH32_PRIME4) >>> 0;
      offset += 4;
    }
    
    // Process remaining bytes
    while (offset < dataLength) {
      hash = (hash + (data[offset] * XXHASH32_PRIME5)) >>> 0;
      hash = OpCodes.RotL32(hash, 11);
      hash = (hash * XXHASH32_PRIME1) >>> 0;
      offset++;
    }
    
    // Final avalanche
    return xxh32Avalanche(hash);
  }
  
  /**
   * xxHash32 hasher class for incremental processing
   */
  function XxHash32Hasher(seed) {
    this.seed = seed || XXHASH32_SEED;
    this.totalLength = 0;
    this.largeLength = 0;
    this.buffer = new Uint8Array(16);
    this.bufferLength = 0;
    
    // Accumulators for large input
    this.acc1 = (this.seed + XXHASH32_PRIME1 + XXHASH32_PRIME2) >>> 0;
    this.acc2 = (this.seed + XXHASH32_PRIME2) >>> 0;
    this.acc3 = (this.seed + 0) >>> 0;
    this.acc4 = (this.seed - XXHASH32_PRIME1) >>> 0;
  }
  
  XxHash32Hasher.prototype.update = function(data) {
    if (typeof data === 'string') {
      data = OpCodes.AnsiToBytes(data);
    }
    
    this.totalLength += data.length;
    let offset = 0;
    
    // Fill buffer first if we have partial data
    if (this.bufferLength > 0) {
      const remaining = 16 - this.bufferLength;
      const toCopy = Math.min(remaining, data.length);
      
      for (let i = 0; i < toCopy; i++) {
        this.buffer[this.bufferLength + i] = data[offset + i];
      }
      
      this.bufferLength += toCopy;
      offset += toCopy;
      
      // Process buffer if full
      if (this.bufferLength === 16) {
        this.processChunk(this.buffer, 0);
        this.largeLength += 16;
        this.bufferLength = 0;
      }
    }
    
    // Process remaining full 16-byte chunks
    while (offset + 16 <= data.length) {
      this.processChunk(data, offset);
      this.largeLength += 16;
      offset += 16;
    }
    
    // Store remaining bytes in buffer
    const remaining = data.length - offset;
    if (remaining > 0) {
      for (let i = 0; i < remaining; i++) {
        this.buffer[this.bufferLength + i] = data[offset + i];
      }
      this.bufferLength += remaining;
    }
  };
  
  XxHash32Hasher.prototype.processChunk = function(data, offset) {
    const lane1 = OpCodes.Pack32LE(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
    const lane2 = OpCodes.Pack32LE(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]);
    const lane3 = OpCodes.Pack32LE(data[offset + 8], data[offset + 9], data[offset + 10], data[offset + 11]);
    const lane4 = OpCodes.Pack32LE(data[offset + 12], data[offset + 13], data[offset + 14], data[offset + 15]);
    
    this.acc1 = xxh32Round(this.acc1, lane1);
    this.acc2 = xxh32Round(this.acc2, lane2);
    this.acc3 = xxh32Round(this.acc3, lane3);
    this.acc4 = xxh32Round(this.acc4, lane4);
  };
  
  XxHash32Hasher.prototype.finalize = function() {
    let hash;
    
    if (this.largeLength > 0) {
      // Large input - merge accumulators
      hash = OpCodes.RotL32(this.acc1, 1) + OpCodes.RotL32(this.acc2, 7) + 
             OpCodes.RotL32(this.acc3, 12) + OpCodes.RotL32(this.acc4, 18);
      hash = hash >>> 0;
    } else {
      // Small input
      hash = (this.seed + XXHASH32_PRIME5) >>> 0;
    }
    
    // Add total length
    hash = (hash + this.totalLength) >>> 0;
    
    // Process remaining buffer in 4-byte chunks
    let offset = 0;
    while (offset + 4 <= this.bufferLength) {
      const lane = OpCodes.Pack32LE(
        this.buffer[offset], this.buffer[offset + 1], 
        this.buffer[offset + 2], this.buffer[offset + 3]
      );
      hash = (hash + (lane * XXHASH32_PRIME3)) >>> 0;
      hash = OpCodes.RotL32(hash, 17);
      hash = (hash * XXHASH32_PRIME4) >>> 0;
      offset += 4;
    }
    
    // Process remaining bytes
    while (offset < this.bufferLength) {
      hash = (hash + (this.buffer[offset] * XXHASH32_PRIME5)) >>> 0;
      hash = OpCodes.RotL32(hash, 11);
      hash = (hash * XXHASH32_PRIME1) >>> 0;
      offset++;
    }
    
    // Final avalanche
    return xxh32Avalanche(hash);
  };
  
class XXHash32Algorithm extends HashFunctionAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "xxHash32";
    this.description = "xxHash is an extremely fast non-cryptographic hash algorithm designed by Yann Collet. xxHash32 produces 32-bit hashes and is optimized for speed on 32-bit platforms.";
    this.inventor = "Yann Collet";
    this.year = 2012;
    this.category = CategoryType.HASH;
    this.subCategory = "Fast Hash";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.LOW;
    this.country = CountryCode.MULTI;

    // Hash-specific metadata
    this.SupportedOutputSizes = [4]; // 32 bits = 4 bytes
    
    // Performance and technical specifications
    this.blockSize = 16; // 128 bits = 16 bytes
    this.outputSize = 4; // 32 bits = 4 bytes

    // Documentation and references
    this.documentation = [
      new LinkItem("xxHash GitHub", "https://github.com/Cyan4973/xxHash"),
      new LinkItem("xxHash Website", "https://cyan4973.github.io/xxHash/")
    ];

    this.references = [
      new LinkItem("SMHasher Results", "https://github.com/rurban/smhasher")
    ];

    // Test vectors
    this.tests = [
      {
        text: "xxHash32 Empty String",
        uri: "https://github.com/Cyan4973/xxHash",
        input: [],
        expected: OpCodes.Hex8ToBytes("02CC5D05")
      },
      {
        text: "xxHash32 Test Vector 'a'",
        uri: "https://github.com/Cyan4973/xxHash",
        input: [97], // "a"
        expected: OpCodes.Hex8ToBytes("550D7456")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new XXHash32AlgorithmInstance(this, isInverse);
  }
}

class XXHash32AlgorithmInstance extends IHashFunctionInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.OutputSize = 4; // 32 bits = 4 bytes
    
    this.hasher = new XxHash32Hasher();
  }

  Init() {
    this.hasher = new XxHash32Hasher();
  }

  /**
   * Hash a complete message in one operation
   * @param {Array} message - Message to hash as byte array
   * @returns {Array} Hash digest as byte array
   */
  Hash(message) {
    // Convert string to byte array if needed
    if (typeof message === 'string') {
      const bytes = [];
      for (let i = 0; i < message.length; i++) {
        bytes.push(message.charCodeAt(i) & 0xFF);
      }
      message = bytes;
    }
    
    const hash32 = xxhash32(message, XXHASH32_SEED);
    const result = new Array(4);
    for (let i = 0; i < 4; i++) {
      result[i] = (hash32 >>> (i * 8)) & 0xFF;
    }
    return result;
  }

  /**
   * Required interface methods for IAlgorithmInstance compatibility
   */
  KeySetup(key) {
    // Use key as seed if provided
    const seed = key && key.length >= 4 ? 
      OpCodes.Pack32LE(key[0], key[1], key[2], key[3]) : XXHASH32_SEED;
    this.hasher = new XxHash32Hasher(seed);
    return true;
  }

  EncryptBlock(blockIndex, plaintext) {
    // Return hash of the plaintext
    return this.Hash(plaintext);
  }

  DecryptBlock(blockIndex, ciphertext) {
    // Hash functions are one-way
    throw new Error('xxHash32 is a one-way hash function - decryption not possible');
  }

  ClearData() {
    if (this.hasher) {
      this.hasher.acc1 = 0;
      this.hasher.acc2 = 0;
      this.hasher.acc3 = 0;
      this.hasher.acc4 = 0;
      if (this.hasher.buffer) {
        OpCodes.ClearArray(this.hasher.buffer);
      }
    }
  }

  /**
   * Feed method required by test suite - processes input data
   * @param {Array} data - Input data as byte array
   */
  Feed(data) {
    this.Init();
    this.Update(data);
  }

  /**
   * Result method required by test suite - returns final hash
   * @returns {Array} Hash digest as byte array
   */
  Result() {
    return this.Final();
  }

  Update(data) {
    this.hasher.update(data);
  }

  Final() {
    const hash32 = this.hasher.finalize();
    const result = new Array(4);
    for (let i = 0; i < 4; i++) {
      result[i] = (hash32 >>> (i * 8)) & 0xFF;
    }
    return result;
  }
}
  
// Register the algorithm
RegisterAlgorithm(new XXHash32Algorithm());