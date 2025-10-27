/*
 * SHA-384 Hash Function - Universal AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 */


(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  // SHA-384 initial hash values (first 64 bits of fractional parts of square roots of 9th through 16th primes)
  const H0 = Object.freeze([
    0xcbbb9d5dc1059ed8n, 0x629a292a367cd507n, 0x9159015a3070dd17n, 0x152fecd8f70e5939n,
    0x67332667ffc00b31n, 0x8eb44a8768581511n, 0xdb0c2e0d64f98fa7n, 0x47b5481dbefa4fa4n
  ]);

  // SHA-512 round constants (same as SHA-512 - first 64 bits of fractional parts of cube roots of first 80 primes)
  const K = Object.freeze([
    0x428a2f98d728ae22n, 0x7137449123ef65cdn, 0xb5c0fbcfec4d3b2fn, 0xe9b5dba58189dbbcn,
    0x3956c25bf348b538n, 0x59f111f1b605d019n, 0x923f82a4af194f9bn, 0xab1c5ed5da6d8118n,
    0xd807aa98a3030242n, 0x12835b0145706fben, 0x243185be4ee4b28cn, 0x550c7dc3d5ffb4e2n,
    0x72be5d74f27b896fn, 0x80deb1fe3b1696b1n, 0x9bdc06a725c71235n, 0xc19bf174cf692694n,
    0xe49b69c19ef14ad2n, 0xefbe4786384f25e3n, 0x0fc19dc68b8cd5b5n, 0x240ca1cc77ac9c65n,
    0x2de92c6f592b0275n, 0x4a7484aa6ea6e483n, 0x5cb0a9dcbd41fbd4n, 0x76f988da831153b5n,
    0x983e5152ee66dfabn, 0xa831c66d2db43210n, 0xb00327c898fb213fn, 0xbf597fc7beef0ee4n,
    0xc6e00bf33da88fc2n, 0xd5a79147930aa725n, 0x06ca6351e003826fn, 0x142929670a0e6e70n,
    0x27b70a8546d22ffcn, 0x2e1b21385c26c926n, 0x4d2c6dfc5ac42aedn, 0x53380d139d95b3dfn,
    0x650a73548baf63den, 0x766a0abb3c77b2a8n, 0x81c2c92e47edaee6n, 0x92722c851482353bn,
    0xa2bfe8a14cf10364n, 0xa81a664bbc423001n, 0xc24b8b70d0f89791n, 0xc76c51a30654be30n,
    0xd192e819d6ef5218n, 0xd69906245565a910n, 0xf40e35855771202an, 0x106aa07032bbd1b8n,
    0x19a4c116b8d2d0c8n, 0x1e376c085141ab53n, 0x2748774cdf8eeb99n, 0x34b0bcb5e19b48a8n,
    0x391c0cb3c5c95a63n, 0x4ed8aa4ae3418acbn, 0x5b9cca4f7763e373n, 0x682e6ff3d6b2b8a3n,
    0x748f82ee5defb2fcn, 0x78a5636f43172f60n, 0x84c87814a1f0ab72n, 0x8cc702081a6439ecn,
    0x90befffa23631e28n, 0xa4506cebde82bde9n, 0xbef9a3f7b2c67915n, 0xc67178f2e372532bn,
    0xca273eceea26619cn, 0xd186b8c721c0c207n, 0xeada7dd6cde0eb1en, 0xf57d4f7fee6ed178n,
    0x06f067aa72176fban, 0x0a637dc5a2c898a6n, 0x113f9804bef90daen, 0x1b710b35131c471bn,
    0x28db77f523047d84n, 0x32caab7b40c72493n, 0x3c9ebe0a15c9bebcn, 0x431d67c49c100d4cn,
    0x4cc5d4becb3e42b6n, 0x597f299cfc657e2an, 0x5fcb6fab3ad6faecn, 0x6c44198c4a475817n
  ]);

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
      this.blockSize = 128; // 1024 bits = 128 bytes
      this.outputSize = 48; // 384 bits = 48 bytes

      // Documentation and references
      this.documentation = [
        new LinkItem("NIST FIPS 180-4", "https://csrc.nist.gov/publications/detail/fips/180/4/final"),
        new LinkItem("NIST SHA Examples", "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/SHA384.pdf")
      ];

      this.references = [
        new LinkItem("Wikipedia: SHA-2", "https://en.wikipedia.org/wiki/SHA-2")
      ];

      // Test vectors from NIST with expected byte arrays
      this.tests = [
        {
          text: "NIST Test Vector - Empty String",
          uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf",
          input: [],
          expected: OpCodes.Hex8ToBytes('38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b')
        },
        {
          text: "NIST Test Vector - 'abc'",
          uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf",
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

      // SHA-384 state variables
      this._h = null;
      this._buffer = null;
      this._length = 0;
      this._bufferLength = 0;
    }

    /**
     * Initialize the hash state with SHA-384 initial values
     * NIST FIPS 180-4 Section 5.3.4
     */
    Init() {
      // Copy initial hash values (use slice to avoid modifying original)
      this._h = H0.slice();

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
      this._buffer[this._bufferLength++] = 0x80;

      // Pad to 112 bytes (896 bits), leaving 16 bytes for length
      while (this._bufferLength < 112) {
        this._buffer[this._bufferLength++] = 0;
      }

      // Add length in bits as 128-bit big-endian
      const lengthBits = BigInt(this._length * 8);

      // High 64 bits (for practical message sizes, this is 0)
      for (let i = 0; i < 8; i++) {
        this._buffer[this._bufferLength + i] = 0;
      }

      // Low 64 bits
      for (let i = 0; i < 8; i++) {
        this._buffer[this._bufferLength + 8 + i] = Number(OpCodes.ShiftRn(lengthBits, (7 - i) * 8) & 0xFFn);
      }

      this._processBlock(this._buffer);

      // Convert hash to bytes (big-endian), but only the first 6 words for 384 bits
      const result = [];
      for (let i = 0; i < 6; i++) { // Only first 6 words (384 bits) instead of 8 words (512 bits)
        const value = this._h[i];
        for (let j = 0; j < 8; j++) {
          result.push(Number(OpCodes.ShiftRn(value, (7 - j) * 8) & 0xFFn));
        }
      }

      return result;
    }

    /**
     * Process a single 1024-bit block
     * NIST FIPS 180-4 Section 6.4.2
     * @param {Array} block - 128-byte block to process
     */
    _processBlock(block) {
      const W = new Array(80);
      let a, b, c, d, e, f, g, h;

      // Prepare message schedule W[t] - convert bytes to 64-bit words
      for (let t = 0; t < 16; t++) {
        let value = 0n;
        for (let i = 0; i < 8; i++) {
          value = OpCodes.ShiftLn(value, 8) | BigInt(block[t * 8 + i]);
        }
        W[t] = value;
      }

      // Extend first 16 words into remaining 64 words
      for (let t = 16; t < 80; t++) {
        const s0 = this._rotr64(W[t-15], 1) ^ this._rotr64(W[t-15], 8) ^ OpCodes.ShiftRn(W[t-15], 7);
        const s1 = this._rotr64(W[t-2], 19) ^ this._rotr64(W[t-2], 61) ^ OpCodes.ShiftRn(W[t-2], 6);
        W[t] = (W[t-16] + s0 + W[t-7] + s1) & 0xFFFFFFFFFFFFFFFFn;
      }

      // Initialize working variables
      a = this._h[0]; b = this._h[1]; c = this._h[2]; d = this._h[3];
      e = this._h[4]; f = this._h[5]; g = this._h[6]; h = this._h[7];

      // Main loop (80 rounds)
      for (let t = 0; t < 80; t++) {
        const S1 = this._rotr64(e, 14) ^ this._rotr64(e, 18) ^ this._rotr64(e, 41);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + K[t] + W[t]) & 0xFFFFFFFFFFFFFFFFn;
        const S0 = this._rotr64(a, 28) ^ this._rotr64(a, 34) ^ this._rotr64(a, 39);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) & 0xFFFFFFFFFFFFFFFFn;

        h = g; g = f; f = e; e = (d + temp1) & 0xFFFFFFFFFFFFFFFFn;
        d = c; c = b; b = a; a = (temp1 + temp2) & 0xFFFFFFFFFFFFFFFFn;
      }

      // Add working variables to hash value
      this._h[0] = (this._h[0] + a) & 0xFFFFFFFFFFFFFFFFn;
      this._h[1] = (this._h[1] + b) & 0xFFFFFFFFFFFFFFFFn;
      this._h[2] = (this._h[2] + c) & 0xFFFFFFFFFFFFFFFFn;
      this._h[3] = (this._h[3] + d) & 0xFFFFFFFFFFFFFFFFn;
      this._h[4] = (this._h[4] + e) & 0xFFFFFFFFFFFFFFFFn;
      this._h[5] = (this._h[5] + f) & 0xFFFFFFFFFFFFFFFFn;
      this._h[6] = (this._h[6] + g) & 0xFFFFFFFFFFFFFFFFn;
      this._h[7] = (this._h[7] + h) & 0xFFFFFFFFFFFFFFFFn;
    }

    /**
     * 64-bit right rotation using BigInt
     * @param {BigInt} value - Value to rotate
     * @param {number} n - Number of positions to rotate
     * @returns {BigInt} Rotated value
     */
    _rotr64(value, n) {
      return OpCodes.RotR64n(value, n);
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
          this._h[i] = 0n;
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

  // ===== REGISTRATION =====

    const algorithmInstance = new SHA384Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SHA384Algorithm, SHA384AlgorithmInstance };
}));