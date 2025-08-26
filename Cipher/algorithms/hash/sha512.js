/*
 * SHA-512 Hash Function - Universal AlgorithmFramework Implementation
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

  class SHA512Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SHA-512";
      this.description = "SHA-512 (Secure Hash Algorithm 512-bit) is a cryptographic hash function from the SHA-2 family. Produces 512-bit (64-byte) hash values.";
      this.inventor = "NIST";
      this.year = 2001;
      this.category = CategoryType.HASH;
      this.subCategory = "SHA-2 Family";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Hash-specific metadata
      this.SupportedOutputSizes = [64]; // 512 bits = 64 bytes

      // Performance and technical specifications
      this.blockSize = 128; // 1024 bits = 128 bytes
      this.outputSize = 64; // 512 bits = 64 bytes

      // Documentation and references
      this.documentation = [
        new LinkItem("NIST FIPS 180-4", "https://csrc.nist.gov/publications/detail/fips/180/4/final")
      ];

      this.references = [
        new LinkItem("Wikipedia: SHA-2", "https://en.wikipedia.org/wiki/SHA-2")
      ];

      // Test vectors from NIST
      this.tests = [
        {
          text: "NIST Test Vector - Empty String",
          uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf",
          input: [],
          expected: OpCodes.Hex8ToBytes('cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e')
        },
        {
          text: "NIST Test Vector - 'abc'",
          uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf",
          input: [97, 98, 99], // "abc"
          expected: OpCodes.Hex8ToBytes('ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f')
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new SHA512AlgorithmInstance(this, isInverse);
    }
  }

  class SHA512AlgorithmInstance extends IHashFunctionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 64; // 512 bits = 64 bytes
    }

    /**
     * Initialize the hash state with SHA-512 initial values
     * NIST FIPS 180-4 Section 5.3.5
     */
    Init() {
      // SHA-512 initial hash values (first 64 bits of fractional parts of square roots of first 8 primes)
      this._h = [];
      for (let i = 0; i < 8; i++) {
        const offset = i * 16;
        const high = parseInt(SHA512_INITIAL_HEX.substr(offset, 8), 16);
        const low = parseInt(SHA512_INITIAL_HEX.substr(offset + 8, 8), 16);
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
     * @returns {Array} Hash digest as byte array (512 bits = 64 bytes)
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

      // Convert hash to bytes (big-endian)
      const result = [];
      for (let i = 0; i < 8; i++) {
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
    _add64(a, b) {
      // Fixed 64-bit addition - detect carry before truncation
      const lowSum = (a[1] >>> 0) + (b[1] >>> 0);
      const carry = (lowSum > 0xFFFFFFFF) ? 1 : 0;
      const low = lowSum >>> 0;
      const high = ((a[0] >>> 0) + (b[0] >>> 0) + carry) >>> 0;
      return [high, low];
    }

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

    _xor64(a, b) {
      return [(a[0] ^ b[0]) >>> 0, (a[1] ^ b[1]) >>> 0];
    }

    _and64(a, b) {
      return [(a[0] & b[0]) >>> 0, (a[1] & b[1]) >>> 0];
    }

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
      throw new Error('SHA-512 is a one-way hash function - decryption not possible');
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

  // ===== REGISTRATION =====

    const algorithmInstance = new SHA512Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SHA512Algorithm, SHA512AlgorithmInstance };
}));