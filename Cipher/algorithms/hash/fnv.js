#!/usr/bin/env node
/*
 * FNV Hash Implementation - Universal AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 */

if (!global.AlgorithmFramework && typeof require !== 'undefined')
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');

if (!global.OpCodes && typeof require !== 'undefined')
  global.OpCodes = require('../../OpCodes.js');

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem } = AlgorithmFramework;

// FNV-1a 32-bit constants
const FNV_32_PRIME = 0x01000193;
const FNV_32_OFFSET_BASIS = 0x811c9dc5;

class FNVAlgorithm extends HashFunctionAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "FNV-1a";
    this.description = "FNV-1a is a fast non-cryptographic hash function with good distribution properties. It uses simple multiply and XOR operations for high performance.";
    this.inventor = "Glenn Fowler, Landon Curt Noll, Phong Vo";
    this.year = 1991;
    this.category = CategoryType.HASH;
    this.subCategory = "Fast Hash";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.BASIC;
    this.country = CountryCode.US;

    // Hash-specific metadata
    this.SupportedOutputSizes = [4]; // 32 bits = 4 bytes
    
    // Performance and technical specifications
    this.blockSize = 1; // Processes one byte at a time
    this.outputSize = 4; // 32 bits = 4 bytes

    // Documentation and references
    this.documentation = [
      new LinkItem("FNV Hash Official Website", "http://www.isthe.com/chongo/tech/comp/fnv/index.html"),
      new LinkItem("FNV Hash Specification", "http://www.isthe.com/chongo/tech/comp/fnv/"),
      new LinkItem("Wikipedia FNV Hash", "https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function")
    ];

    this.references = [
      new LinkItem("FNV Reference Implementation", "http://www.isthe.com/chongo/src/fnv/"),
      new LinkItem("Hash Function Performance Tests", "https://github.com/aappleby/smhasher")
    ];

    // Test vectors from FNV specification
    this.tests = [
      {
        text: "FNV-1a Test Vector - Empty string",
        uri: "http://www.isthe.com/chongo/tech/comp/fnv/",
        input: [],
        expected: OpCodes.Hex8ToBytes("811c9dc5")
      },
      {
        text: "FNV-1a Test Vector - 'a'",
        uri: "http://www.isthe.com/chongo/tech/comp/fnv/",
        input: OpCodes.AnsiToBytes("a"),
        expected: OpCodes.Hex8ToBytes("e40c292c")
      },
      {
        text: "FNV-1a Test Vector - 'foobar'",
        uri: "http://www.isthe.com/chongo/tech/comp/fnv/",
        input: OpCodes.AnsiToBytes("foobar"),
        expected: OpCodes.Hex8ToBytes("a9f37ed7")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new FNVAlgorithmInstance(this, isInverse);
  }
}


class FNVAlgorithmInstance extends IHashFunctionInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.OutputSize = 4; // 32 bits = 4 bytes
    
    // FNV state
    this._buffer = [];
    this._length = 0;
  }

  /**
   * Initialize the hash state
   */
  Init() {
    this._buffer = [];
    this._length = 0;
  }

  /**
   * Add data to the hash calculation
   * @param {Array} data - Data to hash as byte array
   */
  Update(data) {
    if (!data || data.length === 0) return;
    
    // Convert string to byte array if needed
    if (typeof data === 'string') {
      data = OpCodes.AnsiToBytes(data);
    }
    
    this._buffer = this._buffer.concat(Array.from(data));
    this._length += data.length;
  }

  /**
   * Finalize the hash calculation and return result as byte array
   * @returns {Array} Hash digest as byte array
   */
  Final() {
    return this._computeFNV1a(this._buffer);
  }

  /**
   * Hash a complete message in one operation
   * @param {Array} message - Message to hash as byte array
   * @returns {Array} Hash digest as byte array
   */
  Hash(message) {
    this.Init();
    this.Update(message);
    return this.Final();
  }

  /**
   * Core FNV-1a computation
   * @param {Array} data - Input data as byte array
   * @returns {Array} FNV-1a hash digest
   */
  _computeFNV1a(data) {
    const bytes = Array.isArray(data) ? data : OpCodes.AnsiToBytes(data);
    let hash = FNV_32_OFFSET_BASIS;
    
    for (let i = 0; i < bytes.length; i++) {
      // FNV-1a: XOR byte first, then multiply
      hash = (hash ^ (bytes[i] & 0xFF)) >>> 0;
      hash = Math.imul(hash, FNV_32_PRIME) >>> 0;
    }
    
    // Return as 4-byte array (big-endian)
    return [
      (hash >>> 24) & 0xFF,
      (hash >>> 16) & 0xFF,
      (hash >>> 8) & 0xFF,
      hash & 0xFF
    ];
  }

  /**
   * Required interface methods for IAlgorithmInstance compatibility
   */
  KeySetup(key) {
    // Hashes don't use keys
    return true;
  }

  EncryptBlock(blockIndex, plaintext) {
    // Return hash of the plaintext
    return this.Hash(plaintext);
  }

  DecryptBlock(blockIndex, ciphertext) {
    // Hash functions are one-way
    throw new Error('FNV-1a is a one-way hash function - decryption not possible');
  }

  ClearData() {
    if (this._buffer) OpCodes.ClearArray(this._buffer);
    this._length = 0;
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
}

// Register the algorithm
if (typeof RegisterAlgorithm === 'function') {
  RegisterAlgorithm(new FNVAlgorithm());
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FNVAlgorithm;
}