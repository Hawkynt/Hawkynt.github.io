/*
 * Fortuna PRNG (Pseudo-Random Number Generator)
 * Based on LibTomCrypt implementation by Tom St Denis
 * Original design by Niels Ferguson and Bruce Schneier from "Practical Cryptography" (2003)
 *
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          RandomGenerationAlgorithm, IRandomGeneratorInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // Constants from LibTomCrypt implementation
  const FORTUNA_POOLS = 32;           // Number of entropy pools
  const MIN_POOL_SIZE = 64;           // Minimum bytes in pool 0 before reseed
  const AES_BLOCK_SIZE = 16;          // AES block size
  const AES_KEY_SIZE = 32;            // AES-256 key size
  const SHA256_OUTPUT_SIZE = 32;      // SHA-256 output size

  // ===== SHA-256 Implementation (minimal for Fortuna) =====
  // Integrated directly to avoid circular dependencies

  const SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  class SHA256State {
    constructor() {
      this.h = new Uint32Array(8);
      this.buffer = new Uint8Array(64);
      this.bufferLength = 0;
      this.length = 0;
      this.init();
    }

    init() {
      // NIST FIPS 180-4 initial hash values (first 32 bits of fractional parts of square roots of first 8 primes)
      this.h[0] = 0x6a09e667;
      this.h[1] = 0xbb67ae85;
      this.h[2] = 0x3c6ef372;
      this.h[3] = 0xa54ff53a;
      this.h[4] = 0x510e527f;
      this.h[5] = 0x9b05688c;
      this.h[6] = 0x1f83d9ab;
      this.h[7] = 0x5be0cd19;
      this.bufferLength = 0;
      this.length = 0;
    }

    process(data) {
      for (let i = 0; i < data.length; ++i) {
        this.buffer[this.bufferLength++] = data[i];
        if (this.bufferLength === 64) {
          this._processBlock();
          this.bufferLength = 0;
        }
      }
      this.length += data.length;
    }

    done() {
      // Pad the message
      const paddingLength = this.bufferLength < 56 ? 56 - this.bufferLength : 120 - this.bufferLength;
      const padding = new Uint8Array(paddingLength + 8);
      padding[0] = 0x80;

      // Append length in bits as 64-bit big-endian
      const bitLength = this.length * 8;
      for (let i = 0; i < 8; ++i) {
        padding[paddingLength + i] = OpCodes.AndN(OpCodes.Shr32(bitLength, (7 - i) * 8), 0xff);
      }

      this.process(padding);

      // Extract hash value
      const result = [];
      for (let i = 0; i < 8; ++i) {
        const bytes = OpCodes.Unpack32BE(this.h[i]);
        result.push(...bytes);
      }

      return result;
    }

    _processBlock() {
      const w = new Uint32Array(64);

      // Prepare message schedule
      for (let i = 0; i < 16; ++i) {
        w[i] = OpCodes.Pack32BE(
          this.buffer[i * 4],
          this.buffer[i * 4 + 1],
          this.buffer[i * 4 + 2],
          this.buffer[i * 4 + 3]
        );
      }

      for (let i = 16; i < 64; ++i) {
        const s0 = OpCodes.XorN(OpCodes.XorN(OpCodes.RotR32(w[i - 15], 7), OpCodes.RotR32(w[i - 15], 18)), OpCodes.Shr32(w[i - 15], 3));
        const s1 = OpCodes.XorN(OpCodes.XorN(OpCodes.RotR32(w[i - 2], 17), OpCodes.RotR32(w[i - 2], 19)), OpCodes.Shr32(w[i - 2], 10));
        w[i] = OpCodes.ToUint32(w[i - 16] + s0 + w[i - 7] + s1);
      }

      // Initialize working variables
      let a = this.h[0];
      let b = this.h[1];
      let c = this.h[2];
      let d = this.h[3];
      let e = this.h[4];
      let f = this.h[5];
      let g = this.h[6];
      let h = this.h[7];

      // Compression function main loop
      for (let i = 0; i < 64; ++i) {
        const S1 = OpCodes.XorN(OpCodes.XorN(OpCodes.RotR32(e, 6), OpCodes.RotR32(e, 11)), OpCodes.RotR32(e, 25));
        const ch = OpCodes.XorN(OpCodes.AndN(e, f), OpCodes.AndN(~e, g));
        const temp1 = OpCodes.ToUint32(h + S1 + ch + SHA256_K[i] + w[i]);
        const S0 = OpCodes.XorN(OpCodes.XorN(OpCodes.RotR32(a, 2), OpCodes.RotR32(a, 13)), OpCodes.RotR32(a, 22));
        const maj = OpCodes.XorN(OpCodes.XorN(OpCodes.AndN(a, b), OpCodes.AndN(a, c)), OpCodes.AndN(b, c));
        const temp2 = OpCodes.ToUint32(S0 + maj);

        h = g;
        g = f;
        f = e;
        e = OpCodes.ToUint32(d + temp1);
        d = c;
        c = b;
        b = a;
        a = OpCodes.ToUint32(temp1 + temp2);
      }

      // Add compressed chunk to current hash value
      this.h[0] = OpCodes.ToUint32(this.h[0] + a);
      this.h[1] = OpCodes.ToUint32(this.h[1] + b);
      this.h[2] = OpCodes.ToUint32(this.h[2] + c);
      this.h[3] = OpCodes.ToUint32(this.h[3] + d);
      this.h[4] = OpCodes.ToUint32(this.h[4] + e);
      this.h[5] = OpCodes.ToUint32(this.h[5] + f);
      this.h[6] = OpCodes.ToUint32(this.h[6] + g);
      this.h[7] = OpCodes.ToUint32(this.h[7] + h);
    }
  }

  // ===== AES-256 Implementation (minimal for Fortuna counter mode) =====

  const AES_SBOX = new Uint8Array([
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
  ]);

  const AES_RCON = new Uint8Array([
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36
  ]);

  class AES256 {
    constructor(key) {
      if (key.length !== 32) {
        throw new Error('AES256 requires 32-byte key');
      }
      this.roundKeys = this._expandKey(key);
    }

    _expandKey(key) {
      const nk = 8;  // Number of 32-bit words in key (256 bits / 32)
      const nr = 14; // Number of rounds for AES-256
      const totalWords = 4 * (nr + 1); // 60 words
      const w = new Uint32Array(totalWords);

      // Copy initial key
      for (let i = 0; i < nk; ++i) {
        w[i] = OpCodes.Pack32BE(key[i * 4], key[i * 4 + 1], key[i * 4 + 2], key[i * 4 + 3]);
      }

      // Expand key
      for (let i = nk; i < totalWords; ++i) {
        let temp = w[i - 1];

        if (i % nk === 0) {
          // RotWord, SubWord, Rcon
          temp = this._rotWord(temp);
          temp = this._subWord(temp);
          temp = OpCodes.ToUint32(OpCodes.XorN(temp, OpCodes.Shl32(AES_RCON[(i / nk) - 1], 24)));
        } else if (i % nk === 4) {
          // SubWord for AES-256
          temp = this._subWord(temp);
        }

        w[i] = OpCodes.ToUint32(OpCodes.XorN(w[i - nk], temp));
      }

      // Convert to byte array
      const roundKeys = new Uint8Array(totalWords * 4);
      for (let i = 0; i < totalWords; ++i) {
        const bytes = OpCodes.Unpack32BE(w[i]);
        roundKeys[i * 4] = bytes[0];
        roundKeys[i * 4 + 1] = bytes[1];
        roundKeys[i * 4 + 2] = bytes[2];
        roundKeys[i * 4 + 3] = bytes[3];
      }

      return roundKeys;
    }

    _rotWord(word) {
      return OpCodes.RotL32(word, 8);
    }

    _subWord(word) {
      const bytes = OpCodes.Unpack32BE(word);
      return OpCodes.Pack32BE(
        AES_SBOX[bytes[0]],
        AES_SBOX[bytes[1]],
        AES_SBOX[bytes[2]],
        AES_SBOX[bytes[3]]
      );
    }

    encrypt(block) {
      const state = new Uint8Array(block);
      const nr = 14; // AES-256 rounds

      // Initial round
      this._addRoundKey(state, 0);

      // Main rounds
      for (let round = 1; round < nr; ++round) {
        this._subBytes(state);
        this._shiftRows(state);
        this._mixColumns(state);
        this._addRoundKey(state, round);
      }

      // Final round (no MixColumns)
      this._subBytes(state);
      this._shiftRows(state);
      this._addRoundKey(state, nr);

      return Array.from(state);
    }

    _addRoundKey(state, round) {
      const offset = round * 16;
      for (let i = 0; i < 16; ++i) {
        state[i] = OpCodes.XorN(state[i], this.roundKeys[offset + i]);
      }
    }

    _subBytes(state) {
      for (let i = 0; i < 16; ++i) {
        state[i] = AES_SBOX[state[i]];
      }
    }

    _shiftRows(state) {
      // Row 1: shift left by 1
      let temp = state[1];
      state[1] = state[5];
      state[5] = state[9];
      state[9] = state[13];
      state[13] = temp;

      // Row 2: shift left by 2
      temp = state[2];
      let temp2 = state[6];
      state[2] = state[10];
      state[6] = state[14];
      state[10] = temp;
      state[14] = temp2;

      // Row 3: shift left by 3
      temp = state[3];
      state[3] = state[15];
      state[15] = state[11];
      state[11] = state[7];
      state[7] = temp;
    }

    _mixColumns(state) {
      for (let col = 0; col < 4; ++col) {
        const base = col * 4;
        const s0 = state[base];
        const s1 = state[base + 1];
        const s2 = state[base + 2];
        const s3 = state[base + 3];

        state[base] = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.GF256Mul(s0, 2), OpCodes.GF256Mul(s1, 3)), s2), s3);
        state[base + 1] = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(s0, OpCodes.GF256Mul(s1, 2)), OpCodes.GF256Mul(s2, 3)), s3);
        state[base + 2] = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(s0, s1), OpCodes.GF256Mul(s2, 2)), OpCodes.GF256Mul(s3, 3));
        state[base + 3] = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.GF256Mul(s0, 3), s1), s2), OpCodes.GF256Mul(s3, 2));
      }
    }
  }

  // ===== FORTUNA PRNG IMPLEMENTATION =====

  class FortunaAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Fortuna";
      this.description = "Fortuna is a cryptographically secure PRNG designed by Niels Ferguson and Bruce Schneier. Uses 32 SHA-256 entropy pools with exponential pool scheduling and AES-256 counter mode for output generation.";
      this.inventor = "Niels Ferguson, Bruce Schneier";
      this.year = 2003;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Cryptographic PRNG";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = true;
      this.SupportedSeedSizes = [new KeySize(0, 1024, 1)]; // Flexible seed size

      // Technical specifications
      this.poolCount = FORTUNA_POOLS;
      this.minPoolSize = MIN_POOL_SIZE;
      this.blockSize = AES_BLOCK_SIZE;
      this.keySize = AES_KEY_SIZE;

      // Documentation
      this.documentation = [
        new LinkItem(
          "Practical Cryptography - Ferguson and Schneier (2003)",
          "https://www.schneier.com/books/practical-cryptography/"
        ),
        new LinkItem(
          "LibTomCrypt Implementation",
          "https://github.com/libtom/libtomcrypt/blob/develop/src/prngs/fortuna.c"
        ),
        new LinkItem(
          "Fortuna Design Analysis",
          "https://www.schneier.com/academic/paperfiles/fortuna.pdf"
        )
      ];

      this.references = [
        new LinkItem("Wikipedia: Fortuna PRNG", "https://en.wikipedia.org/wiki/Fortuna_(PRNG)"),
        new LinkItem("LibTomCrypt Documentation", "https://www.libtom.net/LibTomCrypt/")
      ];

      // Test vectors - Fortuna is deterministic given same entropy and reseeding
      // These tests verify that Fortuna produces consistent output given same entropy
      // Generated from this implementation to ensure bit-perfect reproducibility
      this.tests = [
        {
          text: "Deterministic test - 64 bytes entropy pattern, generate 32 bytes",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/prngs/fortuna.c",
          input: null, // Will use seed property
          seed: OpCodes.Hex8ToBytes(
            '0123456789abcdef0123456789abcdef' +
            '0123456789abcdef0123456789abcdef' +
            '0123456789abcdef0123456789abcdef' +
            '0123456789abcdef0123456789abcdef'
          ), // 64 bytes to trigger reseed
          outputSize: 32,
          // Expected output - deterministic given seed
          expected: OpCodes.Hex8ToBytes(
            '224a0fa0d0a71441a7190c4b9fdb0d86' +
            '60905d0f5f390906ca61d2c469f4b886'
          )
        },
        {
          text: "Multiple block test - 128 bytes sequential entropy, generate 64 bytes",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/prngs/fortuna.c",
          input: null,
          seed: new Array(128).fill(0).map((_, i) => OpCodes.AndN(i, 0xff)),
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes(
            '667dbf72dbf3a8b403512fc0e26ec57f' +
            '8b3ea2a5bd5efd0cf33b76dcfcf5bdd0' +
            'f181a1459a23164744c27c2655b296dd' +
            'abf72282dd08fd7c01375758cacca9ba'
          )
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new FortunaInstance(this);
    }
  }

  /**
 * Fortuna cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class FortunaInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Fortuna state
      this.pools = new Array(FORTUNA_POOLS);
      for (let i = 0; i < FORTUNA_POOLS; ++i) {
        this.pools[i] = new SHA256State();
      }

      this.poolIdx = 0;           // Current pool for round-robin entropy distribution
      this.pool0Len = 0;          // Track pool 0 entropy accumulation
      this.resetCnt = 0;          // Reseed counter for pool scheduling
      this.reseedCount = 0;       // Total number of reseeds (for testing)

      this.K = new Uint8Array(32); // AES-256 key
      this.IV = new Uint8Array(16); // Counter for AES CTR mode
      this.aes = null;             // AES cipher instance

      this.ready = false;          // PRNG ready after first reseed

      // Initialize with all-zero key
      this._setupAES();
    }

    _setupAES() {
      this.aes = new AES256(this.K);
    }

    /**
     * Update IV counter (little-endian increment)
     * LibTomCrypt: s_fortuna_update_iv()
     */
    _updateIV() {
      for (let i = 0; i < 16; ++i) {
        this.IV[i] = OpCodes.AndN(this.IV[i] + 1, 0xff);
        if (this.IV[i] !== 0) {
          break; // No carry, done
        }
      }
    }

    /**
     * Reseed the generator from entropy pools
     * LibTomCrypt: s_fortuna_reseed()
     */
    _reseed() {
      // Check minimum pool size
      if (this.pool0Len < MIN_POOL_SIZE && this.resetCnt > 0) {
        return; // Not enough entropy yet
      }

      // Hash all contributing pools
      const md = new SHA256State();
      md.process(Array.from(this.K)); // Start with current key

      const newResetCnt = this.resetCnt + 1;

      // Pool scheduling: pool i is included every 2^i reseeds
      // Pool 0 is always included
      for (let i = 0; i < FORTUNA_POOLS; ++i) {
        if (i === 0 || OpCodes.AndN(OpCodes.Shr32(newResetCnt, i - 1), 1) === 0) {
          // Include this pool
          const poolHash = this.pools[i].done();
          md.process(poolHash);

          // Reset pool
          this.pools[i] = new SHA256State();
        } else {
          break; // No more pools to include
        }
      }

      // New key = SHA256(K || poolHashes)
      const newKey = md.done();
      this.K.set(newKey);

      // Re-setup AES with new key
      this._setupAES();

      // Update IV
      this._updateIV();

      // Update state
      this.pool0Len = 0;
      this.resetCnt = newResetCnt;
      this.reseedCount++;

      this.ready = true;
    }

    /**
     * Add entropy to pools (round-robin distribution)
     * LibTomCrypt: fortuna_add_entropy()
     *
     * @param {Array} data - Entropy bytes
     * @param {number} source - Source identifier (0-255), default 0
     * @param {number} pool - Specific pool (optional, uses round-robin if not specified)
     */
    AddEntropy(data, source = 0, pool = null) {
      if (!data || data.length === 0) {
        return;
      }

      // Limit entropy chunk size to 32 bytes per LibTomCrypt
      const chunk = data.slice(0, Math.min(32, data.length));

      // Determine target pool
      const targetPool = pool !== null ? pool : this.poolIdx;

      if (targetPool < 0 || targetPool >= FORTUNA_POOLS) {
        throw new Error('Invalid pool index: ' + targetPool);
      }

      // Format: source (1 byte) || length (1 byte) || data
      const header = [OpCodes.AndN(source, 0xff), OpCodes.AndN(chunk.length, 0xff)];
      this.pools[targetPool].process(header);
      this.pools[targetPool].process(chunk);

      // Track pool 0 size for reseed triggering
      if (targetPool === 0) {
        this.pool0Len += chunk.length;
      }

      // Advance pool index for round-robin (only when pool not specified)
      if (pool === null) {
        this.poolIdx = (this.poolIdx + 1) % FORTUNA_POOLS;
      }
    }

    /**
     * Generate random bytes
     * LibTomCrypt: fortuna_read()
     *
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (length === 0) {
        return [];
      }

      // Check if reseed needed
      if (this.pool0Len >= MIN_POOL_SIZE) {
        this._reseed();
      }

      // Must have at least one reseed before generating output
      if (this.resetCnt === 0) {
        throw new Error('Fortuna not ready: add entropy and ensure at least one reseed occurs');
      }

      const output = [];

      // Generate full blocks
      while (length >= AES_BLOCK_SIZE) {
        const block = this.aes.encrypt(this.IV);
        output.push(...block);
        this._updateIV();
        length -= AES_BLOCK_SIZE;
      }

      // Generate partial block if needed
      if (length > 0) {
        const block = this.aes.encrypt(this.IV);
        output.push(...block.slice(0, length));
        this._updateIV();
      }

      // Generate new key: K = AES_K(IV) || AES_K(IV+1)
      const newKey = [];
      newKey.push(...this.aes.encrypt(this.IV));
      this._updateIV();
      newKey.push(...this.aes.encrypt(this.IV));
      this._updateIV();

      this.K.set(newKey);
      this._setupAES();

      return output;
    }

    /**
     * Seed the generator (convenience method)
     * @param {Array} seedBytes - Seed material
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        return;
      }

      // Add seed as entropy to pool 0
      this.AddEntropy(seedBytes, 0, 0);

      // Always force initial reseed when setting seed explicitly
      // This matches expected behavior for test vectors
      this._reseed();
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    // AlgorithmFramework interface implementation
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      // For PRNG, Feed adds entropy
      if (data && data.length > 0) {
        this.AddEntropy(data);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Use specified output size or default to 32 bytes
      const size = this._outputSize || 32;
      return this.NextBytes(size);
    }

    /**
     * Set output size for Result() method
     */
    set outputSize(size) {
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize || 32;
    }
  }

  // Register algorithm
  const algorithmInstance = new FortunaAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { FortunaAlgorithm, FortunaInstance };
}));
