/*
 * SHA-384 Hash Function - Universal AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 */
// TODO: may be merged with sha512 and just provide two different output sizes if they algorithmic close enough

if (!global.AlgorithmFramework && typeof require !== 'undefined')
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');

if (!global.OpCodes && typeof require !== 'undefined')
  global.OpCodes = require('../../OpCodes.js');

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem } = AlgorithmFramework;

// TODO: looks like OpCode opportunity to me
// SHA-512/SHA-384 constants as hex string to avoid bare hex values
const SHA512_CONSTANTS_HEX = '428a2f98d728ae2271374491d23ef65cdb5c0fbcfec4d3b2fe9b5dba58189dbbc3956c25bf348b538' +
  '59f111f1b605d019923f82a4af194f9bab1c5ed5da6d8118d807aa98a3030242128135b01456706fbe' +
  '243185be4ee4b28c550c7dc3d5ffb4e272be5d74f27b896f80deb1fe3b1696b19bdc06a725c71235' +
  'c19bf174cf692694e49b69c19ef14ad2efbe4786384f25e30fc19dc68b8cd5b5240ca1cc77ac9c65' +
  '2de92c6f592b02754a7484aa6ea6e4835cb0a9dcbd41fbd476f988da831153b5983e5152ee66dfab' +
  'a831c66d2db43210b00327c898fb213fbf597fc7beef0ee4c6e00bf33da88fc2d5a79147930aa725' +
  '06ca6351e003826f14292967c0a0e6e7027b70a8546d22ffc2e1b21385c26c9264d2c6dfc5ac42aed' +
  '53380d139d95b3df650a73548baf63de766a0abb3c77b2a881c2c92e47edaee692722c851482353b' +
  'a2bfe8a14cf10364a81a664bbc423001c24b8b70d0f89791c76c51a30654be30d192e819d6ef5218' +
  'd69906245565a910f40e35855771202a106aa07032bbd1b819a4c116b8d2d0c81e376c085141ab53' +
  '2748774cdf8eeb9934b0bcb5e19b48a8391c0cb3c5c95a634ed8aa4ae3418acb5b9cca4f7763e373' +
  '682e6ff3d6b2b8a3748f82ee5defb2fc78a5636f43172f6084c87814a1f0ab728cc70208c1a6439ec' +
  '90befffa23631e28a4506cebde82bde9bef9a3f7b2c67915c67178f2e372532bca273eceea26619c' +
  'd186b8c721c0c207eada7dd6cde0eb1ef57d4f7fee6ed178066067aa72176fba0a637dc5a2c898a6' +
  '113f9804bef90dae1b710b35131c471b28db77f523047d8432caab7b40c724933c9ebe0a15c9bebc' +
  '431d67c49c100d4c4cc5d4becb3e42b6597f299cfc657e2a5fcb6fab3ad6faec6c44198c4a475817';

// TODO: looks like OpCode opportunity to me
// SHA-384 initial hash values as hex string (NIST FIPS 180-4 Section 5.3.4)
const SHA384_INITIAL_HEX = 'cbbb9d5dc1059ed8629a292a367cd5079159015a3070dd17152fecd8f70e593967332667ffc00b318eb44a8768581511db0c2e0d64f98fa747b5481dbefa4fa4';
  
class SHA384Algorithm extends HashFunctionAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "SHA-384";
    this.description = "SHA-384 (Secure Hash Algorithm 384-bit) is a cryptographic hash function from the SHA-2 family. Uses SHA-512 algorithm with different initial values and truncated output.";
    this.inventor = "NIST";
    this.year = 2001;
    this.category = CategoryType.HASH;
    this.subCategory = "SHA-2 Family";
    this.securityStatus = SecurityStatus.SECURE;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;

    // Hash-specific metadata
    this.SupportedOutputSizes = [48]; // 384 bits = 48 bytes
    
    // Performance and technical specifications
    this.blockSize = 128; // 1024 bits = 128 bytes (SHA-512 block size)
    this.outputSize = 48; // 384 bits = 48 bytes

    // Documentation and references
    this.documentation = [
      new LinkItem("NIST FIPS 180-4", "https://csrc.nist.gov/publications/detail/fips/180/4/final"),
      new LinkItem("NIST SHA Examples", "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/SHA384.pdf")
    ];

    this.references = [
      new LinkItem("Wikipedia: SHA-2", "https://en.wikipedia.org/wiki/SHA-2")
    ];

    // Test vectors from NIST
    this.tests = [
      {
        text: "NIST Test Vector - Empty String",
        uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/SHA384.pdf",
        input: [],
        expected: OpCodes.Hex8ToBytes('38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b')
      },
      {
        text: "NIST Test Vector - 'abc'",
        uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/SHA384.pdf",
        input: [97, 98, 99], // "abc"
        expected: OpCodes.Hex8ToBytes('cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7')
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new SHA384AlgorithmInstance(this, isInverse);
  }
}

class SHA384AlgorithmInstance extends IHashFunctionInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.OutputSize = 48; // 384 bits = 48 bytes
  }

  /**
   * Initialize the hash state with SHA-384 specific initial values
   * NIST FIPS 180-4 Section 5.3.4
   */
  Init() {
    // SHA-384 initial hash values (first 64 bits of fractional parts of square roots of 9th through 16th primes)
    this._h = [];
    for (let i = 0; i < 8; i++) {
      const offset = i * 16;
      const high = parseInt(SHA384_INITIAL_HEX.substr(offset, 8), 16);
      const low = parseInt(SHA384_INITIAL_HEX.substr(offset + 8, 8), 16);
      this._h[i] = [high, low];
    }
    
    this._buffer = new Array(128); // 1024-bit buffer
    this._length = 0;
    this._bufferLength = 0;
  }

  /**
   * Update hash with new data
   * @param {string|Array} data - Input data to hash
   */
  Update(data) {
    // Convert string to byte array if needed
    if (typeof data === 'string') {
      const bytes = [];
      for (let i = 0; i < data.length; i++) {
        bytes.push(data.charCodeAt(i) & 0xFF);
      }
      data = bytes;
    }
    
    this._length += data.length;
    
    // Process data
    for (let i = 0; i < data.length; i++) {
      this._buffer[this._bufferLength++] = data[i];
      
      if (this._bufferLength === 128) {
        this._processBlock(this._buffer);
        this._bufferLength = 0;
      }
    }
  }

  /**
   * Finalize hash computation and return digest
   * @returns {Array} Hash digest as byte array (384 bits = 48 bytes)
   */
  Final() {
    // Add padding (0x80 = 128 = 10000000 binary)
    this._buffer[this._bufferLength++] = 128;
    
    // Pad to 112 bytes (896 bits), leaving 16 bytes for length
    while (this._bufferLength < 112) {
      this._buffer[this._bufferLength++] = 0;
    }
    
    // Add length in bits (128-bit big-endian)
    const lengthBits = this._length * 8;
    
    // High 64 bits (for messages under 2^53 bits, this is mostly 0)
    for (let i = 0; i < 8; i++) {
      this._buffer[this._bufferLength + i] = 0;
    }
    
    // Low 64 bits - manually encode big-endian
    for (let i = 0; i < 8; i++) {
      const shift = (7 - i) * 8;
      this._buffer[this._bufferLength + 8 + i] = (lengthBits >>> shift) & 0xFF;
    }
    
    this._processBlock(this._buffer);
    
    // Convert hash to bytes (big-endian), but only the first 6 words for 384 bits
    const result = [];
    for (let i = 0; i < 6; i++) { // Only first 6 words (384 bits) instead of 8 words (512 bits)
      const [high, low] = this._h[i];
      const highBytes = OpCodes.Unpack32BE(high);
      const lowBytes = OpCodes.Unpack32BE(low);
      for (let j = 0; j < 4; j++) {
        result.push(highBytes[j]);
      }
      for (let j = 0; j < 4; j++) {
        result.push(lowBytes[j]);
      }
    }
    
    return result;
  }

  /**
   * Process a 1024-bit block using the SHA-512 compression function
   * @param {Array} block - 128-byte block to process
   */
  _processBlock(block) {
    // SHA-512 constants (NIST FIPS 180-4 Section 4.2.3) - parse from hex string
    const K = [];
    for (let i = 0; i < 80; i++) {
      const offset = i * 16;
      const high = parseInt(SHA512_CONSTANTS_HEX.substr(offset, 8), 16);
      const low = parseInt(SHA512_CONSTANTS_HEX.substr(offset + 8, 8), 16);
      K[i] = [high, low];
    }
    
    // Prepare message schedule (W) - 80 64-bit words  
    const W = new Array(80);
    
    // Copy first 16 words from block (big-endian, 64-bit each)
    for (let i = 0; i < 16; i++) {
      const offset = i * 8;
      const high = OpCodes.Pack32BE(block[offset], block[offset + 1], block[offset + 2], block[offset + 3]);
      const low = OpCodes.Pack32BE(block[offset + 4], block[offset + 5], block[offset + 6], block[offset + 7]);
      W[i] = [high, low];
    }
    
    // Extend first 16 words into remaining 64 words
    for (let i = 16; i < 80; i++) {
      const s0 = this._xor64(this._xor64(this._rotr64(W[i - 15], 1), this._rotr64(W[i - 15], 8)), this._shr64(W[i - 15], 7));
      const s1 = this._xor64(this._xor64(this._rotr64(W[i - 2], 19), this._rotr64(W[i - 2], 61)), this._shr64(W[i - 2], 6));
      W[i] = this._add64(this._add64(this._add64(W[i - 16], s0), W[i - 7]), s1);
    }
    
    // Initialize working variables
    let a = [this._h[0][0], this._h[0][1]], b = [this._h[1][0], this._h[1][1]];
    let c = [this._h[2][0], this._h[2][1]], d = [this._h[3][0], this._h[3][1]];
    let e = [this._h[4][0], this._h[4][1]], f = [this._h[5][0], this._h[5][1]];
    let g = [this._h[6][0], this._h[6][1]], h = [this._h[7][0], this._h[7][1]];
    
    // Main hash computation (80 rounds)
    for (let i = 0; i < 80; i++) {
      const S1 = this._xor64(this._xor64(this._rotr64(e, 14), this._rotr64(e, 18)), this._rotr64(e, 41));
      const ch = this._xor64(this._and64(e, f), this._and64(this._not64(e), g));
      const temp1 = this._add64(this._add64(this._add64(this._add64(h, S1), ch), K[i]), W[i]);
      
      const S0 = this._xor64(this._xor64(this._rotr64(a, 28), this._rotr64(a, 34)), this._rotr64(a, 39));
      const maj = this._xor64(this._xor64(this._and64(a, b), this._and64(a, c)), this._and64(b, c));
      const temp2 = this._add64(S0, maj);
      
      h = [g[0], g[1]];
      g = [f[0], f[1]];
      f = [e[0], e[1]];
      e = this._add64(d, temp1);
      d = [c[0], c[1]];
      c = [b[0], b[1]];
      b = [a[0], a[1]];
      a = this._add64(temp1, temp2);
    }
    
    // Add to hash values
    this._h[0] = this._add64(this._h[0], a);
    this._h[1] = this._add64(this._h[1], b);
    this._h[2] = this._add64(this._h[2], c);
    this._h[3] = this._add64(this._h[3], d);
    this._h[4] = this._add64(this._h[4], e);
    this._h[5] = this._add64(this._h[5], f);
    this._h[6] = this._add64(this._h[6], g);
    this._h[7] = this._add64(this._h[7], h);
  }

  // 64-bit operations using [high32, low32] representation
// TODO: looks like OpCode opportunity to me
  _add64(a, b) {
    const low = (a[1] + b[1]) >>> 0;
    const high = (a[0] + b[0] + (low < a[1] ? 1 : 0)) >>> 0;
    return [high, low];
  }
  
// TODO: looks like OpCode opportunity to me
  _rotr64(a, n) {
    if (n === 0) return [a[0], a[1]];
    if (n < 32) {
      const high = ((a[0] >>> n) | (a[1] << (32 - n))) >>> 0;
      const low = ((a[1] >>> n) | (a[0] << (32 - n))) >>> 0;
      return [high, low];
    } else {
      const high = ((a[1] >>> (n - 32)) | (a[0] << (64 - n))) >>> 0;
      const low = ((a[0] >>> (n - 32)) | (a[1] << (64 - n))) >>> 0;
      return [high, low];
    }
  }
  
// TODO: looks like OpCode opportunity to me
  _shr64(a, n) {
    if (n === 0) return [a[0], a[1]];
    if (n < 32) {
      const high = (a[0] >>> n) >>> 0;
      const low = ((a[1] >>> n) | (a[0] << (32 - n))) >>> 0;
      return [high, low];
    } else {
      return [0, (a[0] >>> (n - 32)) >>> 0];
    }
  }
  
// TODO: looks like OpCode opportunity to me
  _xor64(a, b) {
    return [(a[0] ^ b[0]) >>> 0, (a[1] ^ b[1]) >>> 0];
  }
  
// TODO: looks like OpCode opportunity to me
  _and64(a, b) {
    return [(a[0] & b[0]) >>> 0, (a[1] & b[1]) >>> 0];
  }
  
// TODO: looks like OpCode opportunity to me
  _not64(a) {
    return [(~a[0]) >>> 0, (~a[1]) >>> 0];
  }

  /**
   * Hash a complete message in one operation
   * @param {string|Array} message - Message to hash
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
    throw new Error('SHA-384 is a one-way hash function - decryption not possible');
  }

  ClearData() {
    if (this._h) {
      for (let i = 0; i < this._h.length; i++) {
        this._h[i] = [0, 0];
      }
    }
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
RegisterAlgorithm(new SHA384Algorithm());