/*
 * SHA-256 Hash Function - Universal AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 */

if (!global.AlgorithmFramework && typeof require !== 'undefined')
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');

if (!global.OpCodes && typeof require !== 'undefined')
  global.OpCodes = require('../../OpCodes.js');

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem } = AlgorithmFramework;

// SHA-256 constants - NIST FIPS 180-4 Section 4.2.2
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

class SHA256Algorithm extends HashFunctionAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "SHA-256";
    this.description = "SHA-256 (Secure Hash Algorithm 256-bit) is a cryptographic hash function from the SHA-2 family designed by NIST. Produces 256-bit (32-byte) hash values from arbitrary input data.";
    this.inventor = "NIST";
    this.year = 2001;
    this.category = CategoryType.HASH;
    this.subCategory = "SHA-2 Family";
    this.securityStatus = SecurityStatus.SECURE;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;

    // Hash-specific metadata
    this.SupportedOutputSizes = [32]; // 256 bits = 32 bytes
    
    // Performance and technical specifications
    this.blockSize = 64; // 512 bits = 64 bytes
    this.outputSize = 32; // 256 bits = 32 bytes

    // Documentation and references
    this.documentation = [
      new LinkItem("NIST FIPS 180-4", "https://csrc.nist.gov/publications/detail/fips/180/4/final"),
      new LinkItem("NIST SHA Examples", "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/SHA256.pdf"),
      new LinkItem("RFC 6234 - US Secure Hash Algorithms", "https://tools.ietf.org/html/rfc6234")
    ];

    this.references = [
      new LinkItem("Wikipedia: SHA-2", "https://en.wikipedia.org/wiki/SHA-2"),
      new LinkItem("NIST Hash Competition", "https://csrc.nist.gov/projects/hash-functions")
    ];

    // Test vectors from NIST with expected byte arrays
    this.tests = [
      {
        text: "NIST Test Vector - Empty String",
        uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/SHA256.pdf",
        input: [],
        expected: OpCodes.Hex8ToBytes('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
      },
      {
        text: "NIST Test Vector - 'abc'",
        uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/SHA256.pdf",
        input: [97, 98, 99], // "abc"
        expected: OpCodes.Hex8ToBytes('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
      },
      {
        text: "NIST Test Vector - Long String",
        uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/SHA256.pdf",
        input: [97,98,99,100,98,99,100,101,99,100,101,102,100,101,102,103,101,102,103,104,102,103,104,105,103,104,105,106,104,105,106,107,105,106,107,108,106,107,108,109,107,108,109,110,108,109,110,111,109,110,111,112,110,111,112,113], // "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"
        expected: OpCodes.Hex8ToBytes('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1')
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new SHA256AlgorithmInstance(this, isInverse);
  }
}

class SHA256AlgorithmInstance extends IHashFunctionInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.OutputSize = 32; // 256 bits = 32 bytes
    
    // SHA-256 state variables
    this._h = null;
    this._buffer = null;
    this._length = 0;
    this._bufferLength = 0;
  }

  /**
   * Initialize the hash state with standard SHA-256 initial values
   * NIST FIPS 180-4 Section 5.3.3
   */
  Init() {
    // Initial hash values (first 32 bits of fractional parts of square roots of first 8 primes)
    this._h = OpCodes.Hex32ToDWords('6a09e667bb67ae853c6ef372a54ff53a510e527f9b05688c1f83d9ab5be0cd19');
    
    this._buffer = new Array(64);
    this._length = 0;
    this._bufferLength = 0;
  }

  /**
   * Process a single 512-bit block
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
   * @returns {Array} Hash digest as byte array
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
    this._buffer[60] = (lengthBits >>> 24) & 0xFF;
    this._buffer[61] = (lengthBits >>> 16) & 0xFF;
    this._buffer[62] = (lengthBits >>> 8) & 0xFF;
    this._buffer[63] = lengthBits & 0xFF;
    
    // Process final block
    this._processBlock(this._buffer);
    
    // Convert hash to byte array
    const result = [];
    for (let i = 0; i < 8; i++) {
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
    throw new Error('SHA-256 is a one-way hash function - decryption not possible');
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
RegisterAlgorithm(new SHA256Algorithm());