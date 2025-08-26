

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

  // BLAKE2s constants
  const BLAKE2S_BLOCKBYTES = 64;
  const BLAKE2S_OUTBYTES = 32;
  const BLAKE2S_KEYBYTES = 32;

  // BLAKE2s initialization vectors - BLAKE2 RFC 7693 Section 2.6
  const BLAKE2S_IV = OpCodes.Hex32ToDWords('6a09e667bb67ae853c6ef372a54ff53a510e527f9b05688c1f83d9ab5be0cd19');

  // BLAKE2s sigma permutation schedule
  const BLAKE2S_SIGMA = [
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

  class BLAKE2sAlgorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BLAKE2s";
      this.description = "BLAKE2s is a high-speed cryptographic hash function optimized for 8-32 bit platforms. It's the 32-bit version of BLAKE2 and is used in protocols like WireGuard.";
      this.inventor = "Jean-Philippe Aumasson, Samuel Neves, Zooko Wilcox-O'Hearn, Christian Winnerlein";
      this.year = 2012;
      this.category = CategoryType.HASH;
      this.subCategory = "BLAKE Family";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CH;

      // Hash-specific metadata
      this.SupportedOutputSizes = [32]; // 256 bits = 32 bytes (default)

      // Performance and technical specifications
      this.blockSize = 64; // 512 bits = 64 bytes
      this.outputSize = 32; // 256 bits = 32 bytes

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 7693 - BLAKE2 Cryptographic Hash and MAC", "https://tools.ietf.org/html/rfc7693"),
        new LinkItem("BLAKE2 Official Specification", "https://blake2.net/blake2.pdf"),
        new LinkItem("BLAKE2 Reference Implementation", "https://github.com/BLAKE2/BLAKE2")
      ];

      this.references = [
        new LinkItem("Wikipedia BLAKE2", "https://en.wikipedia.org/wiki/BLAKE_(hash_function)#BLAKE2"),
        new LinkItem("WireGuard Protocol", "https://www.wireguard.com/papers/wireguard.pdf")
      ];

      // Test vectors from RFC 7693 - BLAKE2s unkeyed hashing
      this.tests = [
        {
          text: "RFC 7693 BLAKE2s - Empty string",
          uri: "https://datatracker.ietf.org/doc/html/rfc7693",
          input: [],
          expected: OpCodes.Hex8ToBytes("69217a3079908094e11121d042354a7c1f55b6482ca1a51e1b250dfd1ed0eef9")
        },
        {
          text: "RFC 7693 BLAKE2s - 'abc'", 
          uri: "https://datatracker.ietf.org/doc/html/rfc7693",
          input: OpCodes.AnsiToBytes("abc"),
          expected: OpCodes.Hex8ToBytes("508c5e8c327c14e2e1a72ba34eeb452f37458b209ed63a294d999b4c86675982")
        },
        {
          text: "Linux crypto test vector - Empty string unkeyed",
          uri: "https://kdave.github.io/linux-crypto-blake2s/",
          input: [],
          expected: OpCodes.Hex8ToBytes("69217a3079908094e11121d042354a7c1f55b6482ca1a51e1b250dfd1ed0eef9")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new BLAKE2sAlgorithmInstance(this, isInverse);
    }
  }

    /**
     * BLAKE2s G function (mixing function)
     */
    function G(v, a, b, c, d, x, y) {
      v[a] = (v[a] + v[b] + x) >>> 0;
      v[d] = OpCodes.RotR32(v[d] ^ v[a], 16);
      v[c] = (v[c] + v[d]) >>> 0;
      v[b] = OpCodes.RotR32(v[b] ^ v[c], 12);
      v[a] = (v[a] + v[b] + y) >>> 0;
      v[d] = OpCodes.RotR32(v[d] ^ v[a], 8);
      v[c] = (v[c] + v[d]) >>> 0;
      v[b] = OpCodes.RotR32(v[b] ^ v[c], 7);
    }

    /**
     * BLAKE2s compression function
     */
    function compress(h, m, t0, t1, f) {
      const v = new Uint32Array(16);

      // Initialize working vector
      for (let i = 0; i < 8; i++) {
        v[i] = h[i];
      }
      for (let i = 0; i < 8; i++) {
        v[i + 8] = BLAKE2S_IV[i];
      }

      // Mix counter and final flag
      v[12] ^= t0;
      v[13] ^= t1;
      if (f) {
        v[14] = ~v[14] >>> 0;
      }

      // 10 rounds of mixing
      for (let round = 0; round < 10; round++) {
        const s = BLAKE2S_SIGMA[round];

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
     * BLAKE2s hasher class
     */
    function Blake2sHasher(key, outputLength) {
      this.outputLength = outputLength || BLAKE2S_OUTBYTES;
      this.key = key || null;
      this.h = new Uint32Array(8);
      this.buffer = new Uint8Array(BLAKE2S_BLOCKBYTES);
      this.bufferLength = 0;
      this.t0 = 0; // Low 32 bits of counter
      this.t1 = 0; // High 32 bits of counter

      // Initialize hash state
      for (let i = 0; i < 8; i++) {
        this.h[i] = BLAKE2S_IV[i];
      }

      // Set parameter block in h[0]
      this.h[0] ^= this.outputLength |
                   ((key ? key.length : 0) << 8) |
                   (1 << 16) |  // fanout = 1
                   (1 << 24);   // depth = 1

      // Process key if provided
      if (key && key.length > 0) {
        const keyPadded = new Uint8Array(BLAKE2S_BLOCKBYTES);
        for (let i = 0; i < key.length && i < BLAKE2S_KEYBYTES; i++) {
          keyPadded[i] = key[i];
        }
        this.update(keyPadded);
      }
    }

    Blake2sHasher.prototype.update = function(data) {
      if (typeof data === 'string') {
        data = OpCodes.AnsiToBytes(data);
      }

      let offset = 0;

      while (offset < data.length) {
        const remaining = BLAKE2S_BLOCKBYTES - this.bufferLength;
        const toCopy = Math.min(remaining, data.length - offset);

        // Copy data to buffer
        for (let i = 0; i < toCopy; i++) {
          this.buffer[this.bufferLength + i] = data[offset + i];
        }

        this.bufferLength += toCopy;
        offset += toCopy;

        // Process full blocks
        if (this.bufferLength === BLAKE2S_BLOCKBYTES) {
          // Increment counter (64-bit addition)
          this.t0 += BLAKE2S_BLOCKBYTES;
          if (this.t0 < BLAKE2S_BLOCKBYTES) {
            this.t1++; // Overflow
          }

          // Convert buffer to 32-bit words (little-endian)
          const m = new Uint32Array(16);
          for (let i = 0; i < 16; i++) {
            m[i] = OpCodes.Pack32LE(
              this.buffer[i * 4],
              this.buffer[i * 4 + 1],
              this.buffer[i * 4 + 2],
              this.buffer[i * 4 + 3]
            );
          }

          compress(this.h, m, this.t0, this.t1, false);
          this.bufferLength = 0;
        }
      }
    };

    Blake2sHasher.prototype.finalize = function() {
      // Increment counter for final block
      this.t0 += this.bufferLength;
      if (this.t0 < this.bufferLength) {
        this.t1++; // Overflow
      }

      // Pad final block with zeros
      for (let i = this.bufferLength; i < BLAKE2S_BLOCKBYTES; i++) {
        this.buffer[i] = 0;
      }

      // Convert buffer to 32-bit words (little-endian)
      const m = new Uint32Array(16);
      for (let i = 0; i < 16; i++) {
        m[i] = OpCodes.Pack32LE(
          this.buffer[i * 4],
          this.buffer[i * 4 + 1],
          this.buffer[i * 4 + 2],
          this.buffer[i * 4 + 3]
        );
      }

      compress(this.h, m, this.t0, this.t1, true);

      // Convert hash state to bytes (little-endian)
      const output = new Uint8Array(this.outputLength);
      for (let i = 0; i < this.outputLength; i++) {
        const wordIndex = Math.floor(i / 4);
        const byteIndex = i % 4;
        const word = this.h[wordIndex];
        output[i] = OpCodes.GetByte(word, byteIndex);
      }

      return output;
    };

  class BLAKE2sAlgorithmInstance extends IHashFunctionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 32; // 256 bits = 32 bytes

      // BLAKE2s state
      this._hasher = null;
    }

    /**
     * Initialize the hash state
     */
    Init() {
      this._hasher = new Blake2sHasher(null, BLAKE2S_OUTBYTES);
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
      // Hashes don't use keys (BLAKE2s key support would be separate)
      return true;
    }

    EncryptBlock(blockIndex, plaintext) {
      // Return hash of the plaintext
      return this.Hash(plaintext);
    }

    DecryptBlock(blockIndex, ciphertext) {
      // Hash functions are one-way
      throw new Error('BLAKE2s is a one-way hash function - decryption not possible');
    }

    ClearData() {
      this._hasher = null;
    }

    /**
     * Feed method required by test suite - processes input data
     * @param {Array} data - Input data as byte array
     */
    Feed(data) {
      if (!this._hasher) this.Init();
      this.Update(data);
    }

    /**
     * Result method required by test suite - returns final hash
     * @returns {Array} Hash digest as byte array
     */
    Result() {
      if (!this._hasher) this.Init();
      // Create a copy of the current state to avoid modifying the original
      const hasherCopy = new Blake2sHasher(null, BLAKE2S_OUTBYTES);
      hasherCopy.h = new Uint32Array(this._hasher.h);
      hasherCopy.buffer = new Uint8Array(this._hasher.buffer);
      hasherCopy.bufferLength = this._hasher.bufferLength;
      hasherCopy.t0 = this._hasher.t0;
      hasherCopy.t1 = this._hasher.t1;

      const result = hasherCopy.finalize();
      return Array.from(result);
    }
  }

  // ===== REGISTRATION =====

    const algorithmInstance = new BLAKE2sAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BLAKE2sAlgorithm, BLAKE2sAlgorithmInstance };
}));