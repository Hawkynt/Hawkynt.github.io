#!/usr/bin/env node
/*
 * BLAKE2b Implementation - Universal AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 */

if (!global.AlgorithmFramework && typeof require !== 'undefined')
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');

if (!global.OpCodes && typeof require !== 'undefined')
  global.OpCodes = require('../../OpCodes.js');

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem } = AlgorithmFramework;
  
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
      data = OpCodes.AnsiToBytes(data);
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
      this.buffer[i] = 0x00;
    }
    
    const m = bytesToWords64(this.buffer);
    while (m.length < 16) {
      m.push(BigInt(0));
    }
    
    compress(this.h, m, this.counter, true);
    
    // Convert hash state to bytes
    return words64ToBytes(this.h, this.outputLength);
  };
  
class BLAKE2bAlgorithm extends HashFunctionAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "BLAKE2b";
    this.description = "BLAKE2b is a high-speed cryptographic hash function optimized for 64-bit platforms. It's faster than MD5, SHA-1, SHA-2, and SHA-3 while providing excellent security properties.";
    this.inventor = "Jean-Philippe Aumasson, Samuel Neves, Zooko Wilcox-O'Hearn, Christian Winnerlein";
    this.year = 2012;
    this.category = CategoryType.HASH;
    this.subCategory = "BLAKE Family";
    this.securityStatus = null;
    this.complexity = ComplexityType.ADVANCED;
    this.country = CountryCode.CH;

    // Hash-specific metadata
    this.SupportedOutputSizes = [64]; // 512 bits = 64 bytes (default)
    
    // Performance and technical specifications
    this.blockSize = 128; // 1024 bits = 128 bytes
    this.outputSize = 64; // 512 bits = 64 bytes

    // Documentation and references
    this.documentation = [
      new LinkItem("RFC 7693 - BLAKE2 Cryptographic Hash and MAC", "https://tools.ietf.org/html/rfc7693"),
      new LinkItem("BLAKE2 Official Specification", "https://blake2.net/blake2.pdf"),
      new LinkItem("BLAKE2 Reference Implementation", "https://github.com/BLAKE2/BLAKE2")
    ];

    this.references = [
      new LinkItem("Wikipedia BLAKE2", "https://en.wikipedia.org/wiki/BLAKE_(hash_function)#BLAKE2"),
      new LinkItem("libsodium BLAKE2b", "https://github.com/jedisct1/libsodium")
    ];

    // Test vectors from RFC 7693 with expected byte arrays
    this.tests = [
      {
        text: "RFC 7693 Test Vector - Empty string",
        uri: "https://tools.ietf.org/html/rfc7693",
        input: [],
        expected: OpCodes.Hex8ToBytes("786a02f742015903c6c6fd852552d272912f4740e15847618a86e217f71f5419d25e1031afee585313896444934eb04b903a685b1448b755d56f701afe9be2ce")
      },
      {
        text: "RFC 7693 Test Vector - abc",
        uri: "https://tools.ietf.org/html/rfc7693",
        input: OpCodes.AnsiToBytes("abc"),
        expected: OpCodes.Hex8ToBytes("ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d17d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923")
      },
      {
        text: "RFC 7693 Test Vector - The quick brown fox",
        uri: "https://tools.ietf.org/html/rfc7693",
        input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
        expected: OpCodes.Hex8ToBytes("a8add4bdddfd93e4877d2746e62817b116364a1fa7bc148d95090bc7333b3673f82401cf7aa2e4cb1ecd90296e3f14cb5413f8ed77be73045b13914cdcd6a918")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new BLAKE2bAlgorithmInstance(this, isInverse);
  }
}

class BLAKE2bAlgorithmInstance extends IHashFunctionInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.OutputSize = 64; // 512 bits = 64 bytes
    
    // BLAKE2b state
    this._hasher = null;
  }

  /**
   * Initialize the hash state
   */
  Init() {
    this._hasher = new Blake2bHasher(null, BLAKE2B_OUTBYTES);
  }

  /**
   * Add data to the hash calculation
   * @param {Array} data - Data to hash as byte array
   */
  Update(data) {
    if (!this._hasher) this.Init();
    this._hasher.update(data);
  }

  /**
   * Finalize the hash calculation and return result as byte array
   * @returns {Array} Hash digest as byte array
   */
  Final() {
    if (!this._hasher) this.Init();
    const result = this._hasher.finalize();
    return Array.from(result);
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
   * Required interface methods for IAlgorithmInstance compatibility
   */
  KeySetup(key) {
    // Hashes don't use keys (BLAKE2b key support would be separate)
    return true;
  }

  EncryptBlock(blockIndex, plaintext) {
    // Return hash of the plaintext
    return this.Hash(plaintext);
  }

  DecryptBlock(blockIndex, ciphertext) {
    // Hash functions are one-way
    throw new Error('BLAKE2b is a one-way hash function - decryption not possible');
  }

  ClearData() {
    this._hasher = null;
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
  RegisterAlgorithm(new BLAKE2bAlgorithm());
}