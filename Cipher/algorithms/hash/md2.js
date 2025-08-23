#!/usr/bin/env node
/*
 * MD2 Implementation - Universal AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 */

if (!global.AlgorithmFramework && typeof require !== 'undefined')
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');

if (!global.OpCodes && typeof require !== 'undefined')
  global.OpCodes = require('../../OpCodes.js');

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem } = AlgorithmFramework;

// MD2 S-box (RFC 1319 Appendix A) - Complete 256-byte table
const MD2_S = [
  0x29, 0x2E, 0x43, 0xC9, 0xA2, 0xD8, 0x7C, 0x01, 0x3D, 0x36, 0x54, 0xA1, 0xEC, 0xF0, 0x06, 0x13,
  0x62, 0xA7, 0x05, 0xF3, 0xC0, 0xC7, 0x73, 0x8C, 0x98, 0x93, 0x2B, 0xD9, 0xBC, 0x4C, 0x82, 0xCA,
  0x1E, 0x9B, 0x57, 0x3C, 0xFD, 0xD4, 0xE0, 0x16, 0x67, 0x42, 0x6F, 0x18, 0x8A, 0x17, 0xE5, 0x12,
  0xBE, 0x4E, 0xC4, 0xD6, 0xDA, 0x9E, 0xDE, 0x49, 0xA0, 0xFB, 0xF5, 0x8E, 0xBB, 0x2F, 0xEE, 0x7A,
  0xA9, 0x68, 0x79, 0x91, 0x15, 0xB2, 0x07, 0x3F, 0x94, 0xC2, 0x10, 0x89, 0x0B, 0x22, 0x5F, 0x21,
  0x80, 0x7F, 0x5D, 0x9A, 0x5A, 0x90, 0x32, 0x27, 0x35, 0x3E, 0xCC, 0xE7, 0xBF, 0xF7, 0x97, 0x03,
  0xFF, 0x19, 0x30, 0xB3, 0x48, 0xA5, 0xB5, 0xD1, 0xD7, 0x5E, 0x92, 0x2A, 0xAC, 0x56, 0xAA, 0xC6,
  0x4F, 0xB8, 0x38, 0xD2, 0x96, 0xA4, 0x7D, 0xB6, 0x76, 0xFC, 0x6B, 0xE2, 0x9C, 0x74, 0x04, 0xF1,
  0x45, 0x9D, 0x70, 0x59, 0x64, 0x71, 0x87, 0x20, 0x86, 0x5B, 0xCF, 0x65, 0xE6, 0x2D, 0xA8, 0x02,
  0x1B, 0x60, 0x25, 0xAD, 0xAE, 0xB0, 0xB9, 0xF6, 0x1C, 0x46, 0x61, 0x69, 0x34, 0x40, 0x7E, 0x0F,
  0x55, 0x47, 0xA3, 0x23, 0xDD, 0x51, 0xAF, 0x3A, 0xC3, 0x5C, 0xF9, 0xCE, 0xBA, 0xC5, 0xEA, 0x26,
  0x2C, 0x53, 0x0D, 0x6E, 0x85, 0x28, 0x84, 0x09, 0xD3, 0xDF, 0xCD, 0xF4, 0x41, 0x81, 0x4D, 0x52,
  0x6A, 0xDC, 0x37, 0xC8, 0x6C, 0xC1, 0xAB, 0xFA, 0x24, 0xE1, 0x7B, 0x08, 0x0C, 0xBD, 0xB1, 0x4A,
  0x78, 0x88, 0x95, 0x8B, 0xE3, 0x63, 0xE8, 0x6D, 0xE9, 0xCB, 0xD5, 0xFE, 0x3B, 0x00, 0x1D, 0x39,
  0xF2, 0xEF, 0xB7, 0x0E, 0x66, 0x58, 0xD0, 0xE4, 0xA6, 0x77, 0x72, 0xF8, 0xEB, 0x75, 0x4B, 0x0A,
  0x31, 0x44, 0x50, 0xB4, 0x8F, 0xED, 0x1F, 0x1A, 0xDB, 0x99, 0x8D, 0x33, 0x9F, 0x11, 0x83, 0x14
];

class MD2Algorithm extends HashFunctionAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "MD2";
    this.description = "MD2 is a 128-bit cryptographic hash function and predecessor to MD4 and MD5. It is extremely slow and cryptographically broken with known collision and preimage attacks.";
    this.inventor = "Ronald Rivest";
    this.year = 1989;
    this.category = CategoryType.HASH;
    this.subCategory = "MD Family";
    this.securityStatus = SecurityStatus.INSECURE;
    this.complexity = ComplexityType.BASIC;
    this.country = CountryCode.US;

    // Hash-specific metadata
    this.SupportedOutputSizes = [16]; // 128 bits = 16 bytes
    
    // Performance and technical specifications
    this.blockSize = 16; // 128 bits = 16 bytes
    this.outputSize = 16; // 128 bits = 16 bytes

    // Documentation and references
    this.documentation = [
      new LinkItem("RFC 1319 - MD2 Message-Digest Algorithm", "https://tools.ietf.org/html/rfc1319"),
      new LinkItem("Wikipedia MD2", "https://en.wikipedia.org/wiki/MD2_(cryptography)")
    ];

    this.references = [
      new LinkItem("MD2 Cryptanalysis Papers", "https://link.springer.com/chapter/10.1007/978-3-540-45146-4_3")
    ];

    // Test vectors from RFC 1319 with expected byte arrays
    this.tests = [
      {
        text: "RFC 1319 Test Vector - Empty string",
        uri: "https://tools.ietf.org/html/rfc1319",
        input: [],
        expected: OpCodes.Hex8ToBytes("8350e5a3e24c153df2275c9f80692773")
      },
      {
        text: "RFC 1319 Test Vector - 'a'", 
        uri: "https://tools.ietf.org/html/rfc1319",
        input: OpCodes.AnsiToBytes("a"),
        expected: OpCodes.Hex8ToBytes("32ec01ec4a6dac72c0ab96fb34c0b5d1")
      },
      {
        text: "RFC 1319 Test Vector - 'abc'", 
        uri: "https://tools.ietf.org/html/rfc1319",
        input: OpCodes.AnsiToBytes("abc"),
        expected: OpCodes.Hex8ToBytes("da853b0d3f88d99b30283a69e6ded6bb")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new MD2AlgorithmInstance(this, isInverse);
  }
}


class MD2AlgorithmInstance extends IHashFunctionInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.OutputSize = 16; // 128 bits = 16 bytes
    
    // MD2 state
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
    return this._computeMD2(this._buffer);
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
   * Core MD2 computation following RFC 1319
   * @param {Array} data - Input data as byte array
   * @returns {Array} MD2 hash digest
   */
  _computeMD2(data) {
    // Step 1: Padding
    const padLength = 16 - (data.length % 16);
    const paddedData = data.concat(new Array(padLength).fill(padLength));
    
    // Step 2: Checksum computation
    const checksum = new Array(16).fill(0);
    let L = 0;
    
    for (let i = 0; i < paddedData.length; i += 16) {
      for (let j = 0; j < 16; j++) {
        const c = paddedData[i + j];
        checksum[j] ^= MD2_S[c ^ L];
        L = checksum[j];
      }
    }
    
    // Step 3: Hash computation
    const finalData = paddedData.concat(checksum);
    const hash = new Array(48).fill(0); // MD2 uses 48-byte state
    
    // Process each 16-byte block
    for (let i = 0; i < finalData.length; i += 16) {
      // Copy block into X[16..31]
      for (let j = 0; j < 16; j++) {
        hash[16 + j] = finalData[i + j];
        hash[32 + j] = hash[16 + j] ^ hash[j];
      }
      
      // 18 rounds of transformation
      let t = 0;
      for (let round = 0; round < 18; round++) {
        for (let k = 0; k < 48; k++) {
          t = hash[k] ^ MD2_S[t];
          hash[k] = t;
        }
        const mod_val = OpCodes.Pack8(...OpCodes.Hex8ToBytes("ff")) + 1;
        t = (t + round) % mod_val;
      }
    }
    
    // Return first 16 bytes as hash
    return hash.slice(0, 16);
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
    throw new Error('MD2 is a one-way hash function - decryption not possible');
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
  RegisterAlgorithm(new MD2Algorithm());
}