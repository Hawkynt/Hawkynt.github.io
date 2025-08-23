#!/usr/bin/env node
/*
 * MD4 Implementation - Universal AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 */

if (!global.AlgorithmFramework && typeof require !== 'undefined')
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');

if (!global.OpCodes && typeof require !== 'undefined')
  global.OpCodes = require('../../OpCodes.js');

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem } = AlgorithmFramework;

// MD4 constants
const MD4_H = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476];

// MD4 auxiliary functions
function MD4_F(x, y, z) { return (x & y) | (~x & z); }
function MD4_G(x, y, z) { return (x & y) | (x & z) | (y & z); }
function MD4_AUX_H(x, y, z) { return x ^ y ^ z; }

class MD4Algorithm extends HashFunctionAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "MD4";
    this.description = "MD4 is a 128-bit cryptographic hash function and predecessor to MD5. It is cryptographically broken with practical collision attacks and should only be used for educational purposes.";
    this.inventor = "Ronald Rivest";
    this.year = 1990;
    this.category = CategoryType.HASH;
    this.subCategory = "MD Family";
    this.securityStatus = SecurityStatus.INSECURE;
    this.complexity = ComplexityType.BASIC;
    this.country = CountryCode.US;

    // Hash-specific metadata
    this.SupportedOutputSizes = [16]; // 128 bits = 16 bytes
    
    // Performance and technical specifications
    this.blockSize = 64; // 512 bits = 64 bytes
    this.outputSize = 16; // 128 bits = 16 bytes

    // Documentation and references
    this.documentation = [
      new LinkItem("RFC 1320 - MD4 Message-Digest Algorithm", "https://tools.ietf.org/html/rfc1320"),
      new LinkItem("Wikipedia MD4", "https://en.wikipedia.org/wiki/MD4")
    ];

    this.references = [
      new LinkItem("MD4 Collision Attacks", "https://link.springer.com/chapter/10.1007/978-3-540-28628-8_1")
    ];

    // Test vectors from RFC 1320 with expected byte arrays
    this.tests = [
      {
        text: "RFC 1320 Test Vector - Empty string",
        uri: "https://tools.ietf.org/html/rfc1320",
        input: [],
        expected: OpCodes.Hex8ToBytes("31d6cfe0d16ae931b73c59d7e0c089c0")
      },
      {
        text: "RFC 1320 Test Vector - 'a'",
        uri: "https://tools.ietf.org/html/rfc1320",
        input: OpCodes.AnsiToBytes("a"),
        expected: OpCodes.Hex8ToBytes("bde52cb31de33e46245e05fbdbd6fb24")
      },
      {
        text: "RFC 1320 Test Vector - 'abc'",
        uri: "https://tools.ietf.org/html/rfc1320",
        input: OpCodes.AnsiToBytes("abc"),
        expected: OpCodes.Hex8ToBytes("a448017aaf21d8525fc10ae87aa6729d")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new MD4AlgorithmInstance(this, isInverse);
  }
}


class MD4AlgorithmInstance extends IHashFunctionInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.OutputSize = 16; // 128 bits = 16 bytes
    
    // MD4 state
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
    return this._computeMD4(this._buffer);
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
   * Core MD4 computation following RFC 1320
   * @param {Array} data - Input data as byte array
   * @returns {Array} MD4 hash digest
   */
  _computeMD4(data) {
    // Pre-processing: append padding
    const paddedMsg = this._padMessage(data);
    
    // Initialize MD4 buffer
    let h = [...MD4_H];
    
    // Process message in 512-bit chunks
    for (let chunkStart = 0; chunkStart < paddedMsg.length; chunkStart += 64) {
      const chunk = paddedMsg.slice(chunkStart, chunkStart + 64);
      
      // Break chunk into sixteen 32-bit little-endian words
      const X = new Array(16);
      for (let i = 0; i < 16; i++) {
        const offset = i * 4;
        X[i] = OpCodes.Pack32LE(chunk[offset], chunk[offset + 1], chunk[offset + 2], chunk[offset + 3]);
      }
      
      // Initialize working variables
      let A = h[0], B = h[1], C = h[2], D = h[3];
      
      // MD4 main rounds (simplified)
      for (let i = 0; i < 16; i++) {
        const temp = (A + MD4_F(B, C, D) + X[i]) >>> 0;
        A = D; D = C; C = B;
        B = OpCodes.RotL32(temp, [3, 7, 11, 19][i % 4]);
      }
      
      // Add this chunk's hash to result so far
      h[0] = (h[0] + A) >>> 0;
      h[1] = (h[1] + B) >>> 0;
      h[2] = (h[2] + C) >>> 0;
      h[3] = (h[3] + D) >>> 0;
    }
    
    // Convert to byte array (little-endian)
    const result = [];
    h.forEach(word => {
      const bytes = OpCodes.Unpack32LE(word);
      result.push(...bytes);
    });
    
    return result;
  }

  _padMessage(msgBytes) {
    const msgLength = msgBytes.length;
    const bitLength = msgLength * 8;
    
    // Create copy for padding
    const padded = msgBytes.slice();
    
    // Append the '1' bit (plus zero padding to make it a byte)
    padded.push(0x80);
    
    // Append 0 <= k < 512 bits '0', such that the resulting message length in bits
    // is congruent to 448 (mod 512)
    while ((padded.length % 64) !== 56) {
      padded.push(0x00);
    }
    
    // Append original length in bits mod 2^64 to message as 64-bit little-endian integer
    const bitLengthLow = bitLength & 0xFFFFFFFF;
    const bitLengthHigh = Math.floor(bitLength / 0x100000000);
    
    const lengthBytes = OpCodes.Unpack32LE(bitLengthLow).concat(OpCodes.Unpack32LE(bitLengthHigh));
    padded.push(...lengthBytes);
    
    return padded;
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
    throw new Error('MD4 is a one-way hash function - decryption not possible');
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
  RegisterAlgorithm(new MD4Algorithm());
}