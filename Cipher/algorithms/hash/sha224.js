#!/usr/bin/env node
/*
 * SHA-224 Implementation - Universal AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 */

if (!global.AlgorithmFramework && typeof require !== 'undefined')
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');

if (!global.OpCodes && typeof require !== 'undefined')
  global.OpCodes = require('../../OpCodes.js');

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem } = AlgorithmFramework;
  
// SHA-224 constants - NIST FIPS 180-4 Section 4.2.2
// First 32 bits of the fractional parts of the cube roots of the first 64 prime numbers
const K = OpCodes.Hex32ToDWords(
  '428a2f98' + '71374491' + 'b5c0fbcf' + 'e9b5dba5' +
  '3956c25b' + '59f111f1' + '923f82a4' + 'ab1c5ed5' +
  'd807aa98' + '12835b01' + '243185be' + '550c7dc3' +
  '72be5d74' + '80deb1fe' + '9bdc06a7' + 'c19bf174' +
  'e49b69c1' + 'efbe4786' + '0fc19dc6' + '240ca1cc' +
  '2de92c6f' + '4a7484aa' + '5cb0a9dc' + '76f988da' +
  '983e5152' + 'a831c66d' + 'b00327c8' + 'bf597fc7' +
  'c6e00bf3' + 'd5a79147' + '06ca6351' + '14292967' +
  '27b70a85' + '2e1b2138' + '4d2c6dfc' + '53380d13' +
  '650a7354' + '766a0abb' + '81c2c92e' + '92722c85' +
  'a2bfe8a1' + 'a81a664b' + 'c24b8b70' + 'c76c51a3' +
  'd192e819' + 'd6990624' + 'f40e3585' + '106aa070' +
  '19a4c116' + '1e376c08' + '2748774c' + '34b0bcb5' +
  '391c0cb3' + '4ed8aa4a' + '5b9cca4f' + '682e6ff3' +
  '748f82ee' + '78a5636f' + '84c87814' + '8cc70208' +
  '90befffa' + 'a4506ceb' + 'bef9a3f7' + 'c67178f2'
);

class SHA224Algorithm extends HashFunctionAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "SHA-224";
    this.description = "SHA-224 is a truncated version of SHA-256 producing a 224-bit digest. It is part of the SHA-2 family with identical security properties to SHA-256 but with shorter output.";
    this.inventor = "NIST";
    this.year = 2001;
    this.category = CategoryType.HASH;
    this.subCategory = "SHA-2 Family";
    this.securityStatus = SecurityStatus.SECURE;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;

    // Hash-specific metadata
    this.SupportedOutputSizes = [28]; // 224 bits = 28 bytes
    
    // Performance and technical specifications
    this.blockSize = 64; // 512 bits = 64 bytes
    this.outputSize = 28; // 224 bits = 28 bytes

    // Documentation and references
    this.documentation = [
      new LinkItem("NIST FIPS 180-4: Secure Hash Standard", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf"),
      new LinkItem("RFC 6234: US Secure Hash Algorithms", "https://tools.ietf.org/html/rfc6234"),
      new LinkItem("Wikipedia: SHA-2", "https://en.wikipedia.org/wiki/SHA-2")
    ];

    this.references = [
      new LinkItem("OpenSSL Implementation", "https://github.com/openssl/openssl/blob/master/crypto/sha/sha256.c"),
      new LinkItem("NIST CAVP Test Vectors", "https://csrc.nist.gov/Projects/Cryptographic-Algorithm-Validation-Program/Secure-Hashing")
    ];

    // Test vectors from NIST FIPS 180-4
    this.tests = [
      {
        text: "NIST Test Vector - Empty String",
        uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf",
        input: [],
        expected: OpCodes.Hex8ToBytes("d14a028c2a3a2bc9476102bb288234c415a2b01f828ea62ac5b3e42f")
      },
      {
        text: "NIST Test Vector - 'abc'",
        uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf",
        input: OpCodes.AnsiToBytes("abc"),
        expected: OpCodes.Hex8ToBytes("23097d223405d8228642a477bda255b32aadbce4bda0b3f7e36c9da7")
      },
      {
        text: "NIST Test Vector - Alphabet",
        uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf",
        input: OpCodes.AnsiToBytes("abcdefghijklmnopqrstuvwxyz"),
        expected: OpCodes.Hex8ToBytes("45a5f72c39c5cff2522eb3429799e49e5f44b356ef926bcf390dccc2")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new SHA224AlgorithmInstance(this, isInverse);
  }
}
    

class SHA224AlgorithmInstance extends IHashFunctionInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.OutputSize = 28; // 224 bits = 28 bytes
    
    // SHA-224 state variables
    this._h = null;
    this._buffer = null;
    this._length = 0;
    this._bufferLength = 0;
  }

  /**
   * Initialize the hash state with SHA-224 initial values
   * NIST FIPS 180-4 Section 5.3.2
   */
  Init() {
    // SHA-224 initial hash values (first 32 bits of fractional parts of square roots of 9th through 16th primes)
    this._h = [
      0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939,
      0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4
    ];
    
    this._buffer = new Array(64);
    this._length = 0;
    this._bufferLength = 0;
  }

  /**
   * Process a single 512-bit block (same as SHA-256)
   * NIST FIPS 180-4 Section 6.2.2
   * @param {Array} block - 64-byte block to process
   */
  _processBlock(block) {
    const W = new Array(64);
    let a, b, c, d, e, f, g, h;
    
    // Prepare message schedule W[t]
    for (let t = 0; t < 16; t++) {
      W[t] = OpCodes.Pack32BE(block[t*4], block[t*4+1], block[t*4+2], block[t*4+3]);
    }
    
    for (let t = 16; t < 64; t++) {
      const s0 = OpCodes.RotR32(W[t-15], 7) ^ OpCodes.RotR32(W[t-15], 18) ^ (W[t-15] >>> 3);
      const s1 = OpCodes.RotR32(W[t-2], 17) ^ OpCodes.RotR32(W[t-2], 19) ^ (W[t-2] >>> 10);
      W[t] = (W[t-16] + s0 + W[t-7] + s1) >>> 0; // >>> 0 ensures 32-bit unsigned
    }
    
    // Initialize working variables
    a = this._h[0]; b = this._h[1]; c = this._h[2]; d = this._h[3];
    e = this._h[4]; f = this._h[5]; g = this._h[6]; h = this._h[7];
    
    // Main loop
    for (let t = 0; t < 64; t++) {
      const S1 = OpCodes.RotR32(e, 6) ^ OpCodes.RotR32(e, 11) ^ OpCodes.RotR32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      const S0 = OpCodes.RotR32(a, 2) ^ OpCodes.RotR32(a, 13) ^ OpCodes.RotR32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    
    // Add working variables to hash value
    this._h[0] = (this._h[0] + a) >>> 0;
    this._h[1] = (this._h[1] + b) >>> 0;
    this._h[2] = (this._h[2] + c) >>> 0;
    this._h[3] = (this._h[3] + d) >>> 0;
    this._h[4] = (this._h[4] + e) >>> 0;
    this._h[5] = (this._h[5] + f) >>> 0;
    this._h[6] = (this._h[6] + g) >>> 0;
    this._h[7] = (this._h[7] + h) >>> 0;
  }

  /**
   * Add data to the hash calculation
   * @param {Array} data - Data to hash as byte array
   */
  Update(data) {
    if (!data || data.length === 0) return;
    
    // Convert string to byte array if needed
    if (typeof data === 'string') {
      const bytes = [];
      for (let i = 0; i < data.length; i++) {
        // const byte_mask = 0xFF;
        bytes.push(data.charCodeAt(i) & 0xFF);
      }
      data = bytes;
    }
    
    for (let i = 0; i < data.length; i++) {
      this._buffer[this._bufferLength++] = data[i];
      
      if (this._bufferLength === 64) {
        this._processBlock(this._buffer);
        this._bufferLength = 0;
      }
    }
    
    this._length += data.length;
  }

  /**
   * Finalize the hash calculation and return result as byte array
   * @returns {Array} Hash digest as byte array (truncated to 224 bits)
   */
  Final() {
    // Add padding bit
    this._buffer[this._bufferLength++] = 0x80;
    
    // If not enough space for length, pad and process block
    if (this._bufferLength > 56) {
      while (this._bufferLength < 64) {
        this._buffer[this._bufferLength++] = 0x00;
      }
      this._processBlock(this._buffer);
      this._bufferLength = 0;
    }
    
    // Pad to 56 bytes
    while (this._bufferLength < 56) {
      this._buffer[this._bufferLength++] = 0x00;
    }
    
    // Append length in bits as 64-bit big-endian
    const lengthBits = this._length * 8;
    // High 32 bits (for messages under 2^32 bits, this is 0)
    this._buffer[56] = 0; this._buffer[57] = 0; this._buffer[58] = 0; this._buffer[59] = 0;
    // Low 32 bits
    const lengthBytes = OpCodes.Unpack32BE(lengthBits);
    this._buffer[60] = lengthBytes[0];
    this._buffer[61] = lengthBytes[1];
    this._buffer[62] = lengthBytes[2];
    this._buffer[63] = lengthBytes[3];
    
    // Process final block
    this._processBlock(this._buffer);
    
    // Convert hash to byte array, truncated to first 224 bits (28 bytes)
    const result = [];
    for (let i = 0; i < 7; i++) { // Only first 7 words (7 * 4 = 28 bytes)
      const bytes = OpCodes.Unpack32BE(this._h[i]);
      for (let j = 0; j < 4; j++) {
        result.push(bytes[j]);
      }
    }
    
    return result;
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
    // Hashes don't use keys
    return true;
  }

  EncryptBlock(blockIndex, plaintext) {
    // Return hash of the plaintext
    return this.Hash(plaintext);
  }

  DecryptBlock(blockIndex, ciphertext) {
    // Hash functions are one-way
    throw new Error('SHA-224 is a one-way hash function - decryption not possible');
  }

  ClearData() {
    if (this._h) OpCodes.ClearArray(this._h);
    if (this._buffer) OpCodes.ClearArray(this._buffer);
    this._length = 0;
    this._bufferLength = 0;
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
  RegisterAlgorithm(new SHA224Algorithm());
}