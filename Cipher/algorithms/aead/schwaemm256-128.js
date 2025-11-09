/*
 * Schwaemm256-128 AEAD - NIST Lightweight Cryptography Finalist
 * AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * Schwaemm256-128 is an authenticated encryption algorithm based on the
 * SPARKLE-384 permutation. It provides 128-bit security with a 256-bit nonce.
 *
 * Specifications:
 * - Key: 128 bits (16 bytes)
 * - Nonce: 256 bits (32 bytes)
 * - Tag: 128 bits (16 bytes)
 * - Rate: 256 bits (32 bytes)
 * - State: 384 bits (12 words × 32-bit)
 * - Permutation: SPARKLE-384 with 7 or 11 steps
 *
 * SPARKLE is an ARX-based (Add-Rotate-XOR) permutation designed for
 * lightweight applications. The Alzette S-box provides efficient diffusion
 * and the Feistel-like structure enables hardware-friendly implementation.
 *
 * References:
 * - NIST LWC Final Round: https://csrc.nist.gov/Projects/lightweight-cryptography/finalists
 * - Specification: https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/sparkle-spec-final.pdf
 * - Reference Implementation: https://github.com/cryptolu/sparkle
 *
 * This implementation is for educational purposes only.
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

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AeadAlgorithm, IAeadInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== SPARKLE-384 PERMUTATION =====

  // Round constants for SPARKLE permutation (from specification)
  const RCON = [
    0xB7E15162, 0xBF715880, 0x38B4DA56, 0x324E7738,
    0xBB1185EB, 0x4F7C7B57, 0xCFBFA1C8, 0xC2B3293D
  ];

  /**
   * Alzette ARXbox: The core S-box of SPARKLE using Add-Rotate-XOR operations
   * Provides non-linear transformation in the SPARKLE permutation
   *
   * Reference implementation uses left rotations:
   * x += ROT(y, 1); y ^= ROT(x, 8); x ^= k;
   * x += ROT(y, 15); y ^= ROT(x, 15); x ^= k;
   * x += y; y ^= ROT(x, 1); x ^= k;
   * x += ROT(y, 8); y ^= ROT(x, 16); x ^= k;
   *
   * @param {number} x - Left 32-bit word
   * @param {number} y - Right 32-bit word
   * @param {number} rc - Round constant
   * @returns {Object} {x, y} - Transformed word pair
   */
  function Alzette(x, y, rc) {
    // Round 1
    x = OpCodes.ToDWord(x + OpCodes.RotL32(y, 1));
    y ^= OpCodes.RotL32(x, 8);
    x ^= rc;

    // Round 2
    x = OpCodes.ToDWord(x + OpCodes.RotL32(y, 15));
    y ^= OpCodes.RotL32(x, 15);
    x ^= rc;

    // Round 3
    x = OpCodes.ToDWord(x + y);
    y ^= OpCodes.RotL32(x, 1);
    x ^= rc;

    // Round 4
    x = OpCodes.ToDWord(x + OpCodes.RotL32(y, 8));
    y ^= OpCodes.RotL32(x, 16);
    x ^= rc;

    return { x: x >>> 0, y: y >>> 0 };
  }

  /**
   * ELL linear mixing function
   * Provides diffusion in the linear layer
   * ELL(x) = (x >>> 16) ^ (x & 0xFFFF)
   *
   * @param {number} x - Input word
   * @returns {number} Mixed output
   */
  function ELL(x) {
    return OpCodes.RotR32(x, 16) ^ (x & 0xFFFF);
  }

  /**
   * SPARKLE-384 permutation
   *
   * State: 12 words (384 bits) organized as 6 branches of (x,y) pairs
   * Each step consists of:
   * 1. Add round constant to branch 0
   * 2. Apply ARXbox layer (6 parallel Alzette boxes)
   * 3. Apply linear layer (Feistel-like mixing with ELL)
   *
   * @param {Array<number>} state - 12-word state array (modified in-place)
   * @param {number} steps - Number of steps (7 for slim, 11 for big)
   */
  function Sparkle384(state, steps) {
    let x0 = state[0];
    let y0 = state[1];
    let x1 = state[2];
    let y1 = state[3];
    let x2 = state[4];
    let y2 = state[5];
    let x3 = state[6];
    let y3 = state[7];
    let x4 = state[8];
    let y4 = state[9];
    let x5 = state[10];
    let y5 = state[11];

    for (let step = 0; step < steps; ++step) {
      // Add round constants
      y0 ^= RCON[step & 7];
      y1 ^= step;

      // ARXbox layer - 6 parallel Alzette transformations
      let result;

      result = Alzette(x0, y0, RCON[0]);
      x0 = result.x;
      y0 = result.y;

      result = Alzette(x1, y1, RCON[1]);
      x1 = result.x;
      y1 = result.y;

      result = Alzette(x2, y2, RCON[2]);
      x2 = result.x;
      y2 = result.y;

      result = Alzette(x3, y3, RCON[3]);
      x3 = result.x;
      y3 = result.y;

      result = Alzette(x4, y4, RCON[4]);
      x4 = result.x;
      y4 = result.y;

      result = Alzette(x5, y5, RCON[5]);
      x5 = result.x;
      y5 = result.y;

      // Linear layer - Reference: internal-sparkle.c lines 221-243
      let tx = x0 ^ x1 ^ x2;
      let ty = y0 ^ y1 ^ y2;
      tx = OpCodes.RotL32(tx ^ (tx << 16), 16);
      ty = OpCodes.RotL32(ty ^ (ty << 16), 16);

      y3 ^= tx;
      y4 ^= tx;
      tx ^= y5;
      y5 = y2;
      y2 = y3 ^ y0;
      y3 = y0;
      y0 = y4 ^ y1;
      y4 = y1;
      y1 = tx ^ y5;  // Note: y5 was already updated to old y2

      x3 ^= ty;
      x4 ^= ty;
      ty ^= x5;
      x5 = x2;
      x2 = x3 ^ x0;
      x3 = x0;
      x0 = x4 ^ x1;
      x4 = x1;
      x1 = ty ^ x5;  // Note: x5 was already updated to old x2
    }

    state[0] = x0 >>> 0;
    state[1] = y0 >>> 0;
    state[2] = x1 >>> 0;
    state[3] = y1 >>> 0;
    state[4] = x2 >>> 0;
    state[5] = y2 >>> 0;
    state[6] = x3 >>> 0;
    state[7] = y3 >>> 0;
    state[8] = x4 >>> 0;
    state[9] = y4 >>> 0;
    state[10] = x5 >>> 0;
    state[11] = y5 >>> 0;
  }

  // ===== SCHWAEMM256-128 ALGORITHM =====

  class Schwaemm256128Algorithm extends AeadAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Schwaemm256-128";
      this.description = "NIST Lightweight Cryptography finalist using SPARKLE-384 permutation. Primary recommended variant with 256-bit nonce and 128-bit security for authenticated encryption with associated data.";
      this.inventor = "Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 1)  // 128-bit key only
      ];
      this.SupportedTagSizes = [
        new KeySize(16, 16, 1)  // 128-bit tag only
      ];
      this.SupportsDetached = false;

      // Documentation and references
      this.documentation = [
        new LinkItem("NIST LWC Final Round", "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists"),
        new LinkItem("Sparkle Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/sparkle-spec-final.pdf"),
        new LinkItem("Reference Implementation", "https://github.com/cryptolu/sparkle"),
        new LinkItem("Sparkle Project Website", "https://sparkle-lwc.github.io/")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [];

      // Test vectors from NIST LWC KAT file (Schwaemm256-128.txt)
      this.tests = [
        {
          text: "NIST LWC KAT Count=1 (empty PT, empty AD)",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/sparkle-spec-final.pdf",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("9E3F9F2E8E26E7D00A9EB92730717A51")
        },
        {
          text: "NIST LWC KAT Count=2 (empty PT, 1-byte AD)",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/sparkle-spec-final.pdf",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("57F83C3E696AE65582DD27FE6FC2F239")
        },
        {
          text: "NIST LWC KAT Count=17 (empty PT, 16-byte AD)",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/sparkle-spec-final.pdf",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: [],
          expected: OpCodes.Hex8ToBytes("07126E0FF608D8EB866A4B7E33BF7B21")
        },
        {
          text: "NIST LWC KAT Count=34 (1-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/sparkle-spec-final.pdf",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("9B6F7DB3323C0B372A4584082E5AB4265C")
        },
        {
          text: "NIST LWC KAT Count=529 (16-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/sparkle-spec-final.pdf",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("9BAC759DB8D6D0C50EA19385A3456BA7BFAE89698782544828F11895D2EE85E9")
        },
        {
          text: "NIST LWC KAT Count=1057 (32-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/sparkle-spec-final.pdf",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          expected: OpCodes.Hex8ToBytes("9BAC759DB8D6D0C50EA19385A3456BA7E061097CCB2683B3F4253C36569A3D15A3A5E0AFDFE60754EB50684FE945AA6A")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new Schwaemm256128Instance(this, isInverse);
    }
  }

  // ===== SCHWAEMM256-128 INSTANCE =====

  class Schwaemm256128Instance extends IAeadInstance {
    constructor(algorithm, isInverse) {
      super(algorithm);
      this.isInverse = isInverse;

      // Schwaemm256-128 configuration
      this.STATE_WORDS = 12;        // SPARKLE-384: 12 words
      this.RATE_BYTES = 32;         // Rate: 32 bytes (256 bits)
      this.RATE_WORDS = 8;          // Rate in words: 8
      this.CAP_WORDS = 4;           // Capacity in words: 4
      this.KEY_BYTES = 16;          // Key: 16 bytes (128 bits)
      this.NONCE_BYTES = 32;        // Nonce: 32 bytes (256 bits)
      this.TAG_BYTES = 16;          // Tag: 16 bytes (128 bits)
      this.STEPS_SLIM = 7;          // Slim steps for rate processing
      this.STEPS_BIG = 11;          // Big steps for initialization/finalization

      // Domain separation constants (little-endian byte position 3)
      // Format: (domain_value << 24) for the last word
      this._A0 = 0x04000000;        // 0x04 in MSB position (partial AD block)
      this._A1 = 0x05000000;        // 0x05 in MSB position (full AD block)
      this._M2 = 0x06000000;        // 0x06 in MSB position (partial message block)
      this._M3 = 0x07000000;        // 0x07 in MSB position (full message block)

      // State initialization
      this.state = new Array(this.STATE_WORDS);
      this._key = null;
      this._nonce = null;
      this._associatedData = [];
      this.inputBuffer = [];
      this.initialized = false;
    }

    // Property: key
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      if (keyBytes.length !== this.KEY_BYTES) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected ${this.KEY_BYTES})`);
      }

      this._key = [...keyBytes];
      this._initializeIfReady();
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property: nonce
    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(nonceBytes)) {
        throw new Error("Invalid nonce - must be byte array");
      }

      if (nonceBytes.length !== this.NONCE_BYTES) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected ${this.NONCE_BYTES})`);
      }

      this._nonce = [...nonceBytes];
      this._initializeIfReady();
    }

    get nonce() {
      return this._nonce ? [...this._nonce] : null;
    }

    // Property: associatedData
    set associatedData(adBytes) {
      if (!adBytes) {
        this._associatedData = [];
        return;
      }

      if (!Array.isArray(adBytes)) {
        throw new Error("Invalid associated data - must be byte array");
      }

      this._associatedData = [...adBytes];
    }

    get associatedData() {
      return [...this._associatedData];
    }

    /**
     * Initialize state when both key and nonce are set
     * State layout: [Rate (8 words) | Capacity (4 words)]
     * Initial: Nonce in rate, Key in capacity
     */
    _initializeIfReady() {
      if (!this._key || !this._nonce) {
        this.initialized = false;
        return;
      }

      // Initialize state to zeros
      for (let i = 0; i < this.STATE_WORDS; ++i) {
        this.state[i] = 0;
      }

      // Load nonce into rate part (little-endian)
      for (let i = 0; i < this.RATE_WORDS; ++i) {
        const offset = i * 4;
        this.state[i] = OpCodes.Pack32LE(
          this._nonce[offset],
          this._nonce[offset + 1],
          this._nonce[offset + 2],
          this._nonce[offset + 3]
        );
      }

      // Load key into capacity part (little-endian)
      for (let i = 0; i < this.CAP_WORDS; ++i) {
        const offset = i * 4;
        this.state[this.RATE_WORDS + i] = OpCodes.Pack32LE(
          this._key[offset],
          this._key[offset + 1],
          this._key[offset + 2],
          this._key[offset + 3]
        );
      }

      // Initial permutation with big steps
      Sparkle384(this.state, this.STEPS_BIG);

      this.initialized = true;
    }

    /**
     * Rho operation: Rate whitening transformation
     * Mixes rate with capacity without data absorption
     *
     * For Schwaemm256-128 (SPARKLE-384 with rate=8 words, capacity=4 words):
     * Reference implementation (sparkle.c lines 127-141):
     * - Save s[0..3] to temps
     * - s[0] = s[4] ^ s[8]
     * - s[4] ^= temp ^ s[8]
     * - (and same for 1,2,3)
     */
    _rho() {
      const t0 = this.state[0];
      const t1 = this.state[1];
      const t2 = this.state[2];
      const t3 = this.state[3];

      this.state[0] = this.state[4] ^ this.state[8];
      this.state[1] = this.state[5] ^ this.state[9];
      this.state[2] = this.state[6] ^ this.state[10];
      this.state[3] = this.state[7] ^ this.state[11];

      this.state[4] ^= t0 ^ this.state[8];
      this.state[5] ^= t1 ^ this.state[9];
      this.state[6] ^= t2 ^ this.state[10];
      this.state[7] ^= t3 ^ this.state[11];
    }

    /**
     * Process associated data
     * Reference: sparkle.c lines 150-173 (schwaemm_256_128_authenticate)
     * NOTE: Called ONLY when adlen > 0 (line 196-197 in reference)
     *
     * Algorithm:
     * 1. While adlen > RATE: rho, XOR block, sparkle(7), advance
     * 2. If adlen == RATE: domain 0x05, rho, XOR block
     * 3. Else (adlen < RATE but > 0): domain 0x04, rho, XOR partial+pad
     * 4. sparkle(11)
     */
    _processAAD() {
      // Empty AD is NOT processed - this matches reference line 196
      if (!this._associatedData || this._associatedData.length === 0) {
        return;
      }

      let ad = this._associatedData;
      let adlen = ad.length;
      let pos = 0;

      // Process full blocks (while adlen > RATE)
      while (adlen > this.RATE_BYTES) {
        this._rho();

        // XOR AD block into state (treating state as byte array)
        for (let i = 0; i < this.RATE_BYTES; ++i) {
          const wordIdx = i >>> 2;
          const byteIdx = (i & 3) << 3;
          this.state[wordIdx] ^= ad[pos + i] << byteIdx;
        }

        Sparkle384(this.state, this.STEPS_SLIM);
        pos += this.RATE_BYTES;
        adlen -= this.RATE_BYTES;
      }

      // Process final block (adlen is now <= RATE and > 0)
      if (adlen === this.RATE_BYTES) {
        // Full final block: domain 0x05
        this.state[this.STATE_WORDS - 1] ^= this._A1;
        this._rho();

        // XOR full block
        for (let i = 0; i < this.RATE_BYTES; ++i) {
          const wordIdx = i >>> 2;
          const byteIdx = (i & 3) << 3;
          this.state[wordIdx] ^= ad[pos + i] << byteIdx;
        }
      } else {
        // Partial block (0 < adlen < RATE): domain 0x04
        this.state[this.STATE_WORDS - 1] ^= this._A0;
        this._rho();

        // XOR partial block
        for (let i = 0; i < adlen; ++i) {
          const wordIdx = i >>> 2;
          const byteIdx = (i & 3) << 3;
          this.state[wordIdx] ^= ad[pos + i] << byteIdx;
        }

        // Add padding byte 0x80
        const padWordIdx = adlen >>> 2;
        const padByteIdx = (adlen & 3) << 3;
        this.state[padWordIdx] ^= 0x80 << padByteIdx;
      }

      Sparkle384(this.state, this.STEPS_BIG);
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      if (!this.initialized) {
        throw new Error("Not initialized - set key and nonce first");
      }

      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this.initialized) {
        throw new Error("Not initialized - set key and nonce first");
      }

      // Process associated data first
      this._processAAD();

      const output = [];
      let mlen = this.inputBuffer.length;
      let pos = 0;

      if (this.isInverse) {
        // ===== DECRYPTION MODE =====
        // Reference: sparkle.c lines 264-299
        if (mlen < this.TAG_BYTES) {
          throw new Error("Ciphertext too short - must include tag");
        }
        mlen -= this.TAG_BYTES;

        if (mlen > 0) {
          // Process full blocks (while mlen > RATE)
          while (mlen > this.RATE_BYTES) {
            // Decrypt: plaintext = ciphertext XOR state
            for (let i = 0; i < this.RATE_BYTES; ++i) {
              const wordIdx = i >>> 2;
              const byteIdx = (i & 3) << 3;
              const stateByte = (this.state[wordIdx] >>> byteIdx) & 0xFF;
              const plainByte = this.inputBuffer[pos + i] ^ stateByte;
              output.push(plainByte);
            }

            // rho operation
            this._rho();

            // XOR plaintext into state
            for (let i = 0; i < this.RATE_BYTES; ++i) {
              const wordIdx = i >>> 2;
              const byteIdx = (i & 3) << 3;
              this.state[wordIdx] ^= output[output.length - this.RATE_BYTES + i] << byteIdx;
            }

            Sparkle384(this.state, this.STEPS_SLIM);
            pos += this.RATE_BYTES;
            mlen -= this.RATE_BYTES;
          }

          // Process final block
          if (mlen === this.RATE_BYTES) {
            // Full final block: domain 0x07
            // Decrypt first
            for (let i = 0; i < this.RATE_BYTES; ++i) {
              const wordIdx = i >>> 2;
              const byteIdx = (i & 3) << 3;
              const stateByte = (this.state[wordIdx] >>> byteIdx) & 0xFF;
              const plainByte = this.inputBuffer[pos + i] ^ stateByte;
              output.push(plainByte);
            }

            this.state[this.STATE_WORDS - 1] ^= this._M3;
            this._rho();

            // XOR plaintext into state
            for (let i = 0; i < this.RATE_BYTES; ++i) {
              const wordIdx = i >>> 2;
              const byteIdx = (i & 3) << 3;
              this.state[wordIdx] ^= output[output.length - this.RATE_BYTES + i] << byteIdx;
            }
          } else if (mlen > 0) {
            // Partial final block: domain 0x06
            // Decrypt partial block first
            for (let i = 0; i < mlen; ++i) {
              const wordIdx = i >>> 2;
              const byteIdx = (i & 3) << 3;
              const stateByte = (this.state[wordIdx] >>> byteIdx) & 0xFF;
              const plainByte = this.inputBuffer[pos + i] ^ stateByte;
              output.push(plainByte);
            }

            this.state[this.STATE_WORDS - 1] ^= this._M2;
            this._rho();

            // XOR plaintext into state
            for (let i = 0; i < mlen; ++i) {
              const wordIdx = i >>> 2;
              const byteIdx = (i & 3) << 3;
              this.state[wordIdx] ^= output[output.length - mlen + i] << byteIdx;
            }

            // Add padding
            const padWordIdx = mlen >>> 2;
            const padByteIdx = (mlen & 3) << 3;
            this.state[padWordIdx] ^= 0x80 << padByteIdx;
          }

          Sparkle384(this.state, this.STEPS_BIG);
        }

        // Tag verification: compute tag = capacity XOR key
        // Reference: sparkle.c lines 296-298
        const computedTag = [];
        for (let i = 0; i < this.TAG_BYTES; ++i) {
          const wordIdx = (this.RATE_BYTES + i) >>> 2;
          const byteIdx = (i & 3) << 3;
          const capacityByte = (this.state[wordIdx] >>> byteIdx) & 0xFF;
          computedTag.push(capacityByte ^ this._key[i]);
        }

        // Verify tag (constant-time comparison)
        const providedTag = this.inputBuffer.slice(this.inputBuffer.length - this.TAG_BYTES);
        let tagMatch = 0;
        for (let i = 0; i < this.TAG_BYTES; ++i) {
          tagMatch |= computedTag[i] ^ providedTag[i];
        }

        if (tagMatch !== 0) {
          throw new Error("Authentication tag verification failed");
        }

        // Reset for next operation
        this.inputBuffer = [];
        this._initializeIfReady();

        return output;

      } else {
        // ===== ENCRYPTION MODE =====
        // Reference: sparkle.c lines 199-236

        if (mlen > 0) {
          // Process full blocks (while mlen > RATE)
          while (mlen > this.RATE_BYTES) {
            // Compute ciphertext: c = m XOR state
            for (let i = 0; i < this.RATE_BYTES; ++i) {
              const wordIdx = i >>> 2;
              const byteIdx = (i & 3) << 3;
              const stateByte = (this.state[wordIdx] >>> byteIdx) & 0xFF;
              output.push(this.inputBuffer[pos + i] ^ stateByte);
            }

            // rho operation
            this._rho();

            // XOR plaintext into state
            for (let i = 0; i < this.RATE_BYTES; ++i) {
              const wordIdx = i >>> 2;
              const byteIdx = (i & 3) << 3;
              this.state[wordIdx] ^= this.inputBuffer[pos + i] << byteIdx;
            }

            Sparkle384(this.state, this.STEPS_SLIM);
            pos += this.RATE_BYTES;
            mlen -= this.RATE_BYTES;
          }

          // Process final block
          if (mlen === this.RATE_BYTES) {
            // Full final block: domain 0x07
            // Compute ciphertext first
            for (let i = 0; i < this.RATE_BYTES; ++i) {
              const wordIdx = i >>> 2;
              const byteIdx = (i & 3) << 3;
              const stateByte = (this.state[wordIdx] >>> byteIdx) & 0xFF;
              output.push(this.inputBuffer[pos + i] ^ stateByte);
            }

            this.state[this.STATE_WORDS - 1] ^= this._M3;
            this._rho();

            // XOR plaintext into state
            for (let i = 0; i < this.RATE_BYTES; ++i) {
              const wordIdx = i >>> 2;
              const byteIdx = (i & 3) << 3;
              this.state[wordIdx] ^= this.inputBuffer[pos + i] << byteIdx;
            }
          } else if (mlen > 0) {
            // Partial final block: domain 0x06
            // Compute partial ciphertext first
            for (let i = 0; i < mlen; ++i) {
              const wordIdx = i >>> 2;
              const byteIdx = (i & 3) << 3;
              const stateByte = (this.state[wordIdx] >>> byteIdx) & 0xFF;
              output.push(this.inputBuffer[pos + i] ^ stateByte);
            }

            this.state[this.STATE_WORDS - 1] ^= this._M2;
            this._rho();

            // XOR plaintext into state
            for (let i = 0; i < mlen; ++i) {
              const wordIdx = i >>> 2;
              const byteIdx = (i & 3) << 3;
              this.state[wordIdx] ^= this.inputBuffer[pos + i] << byteIdx;
            }

            // Add padding
            const padWordIdx = mlen >>> 2;
            const padByteIdx = (mlen & 3) << 3;
            this.state[padWordIdx] ^= 0x80 << padByteIdx;
          }

          Sparkle384(this.state, this.STEPS_BIG);
        }

        // Tag generation: tag = capacity XOR key
        // Reference: sparkle.c line 233-234
        // lw_xor_block_2_src(c, SCHWAEMM_256_128_RIGHT(s), k, SCHWAEMM_256_128_TAG_SIZE)
        // This means: tag[i] = capacity[i] ^ key[i]
        for (let i = 0; i < this.TAG_BYTES; ++i) {
          const wordIdx = (this.RATE_BYTES + i) >>> 2;
          const byteIdx = (i & 3) << 3;
          const capacityByte = (this.state[wordIdx] >>> byteIdx) & 0xFF;
          output.push(capacityByte ^ this._key[i]);
        }

        // Reset for next operation
        this.inputBuffer = [];
        this._initializeIfReady();

        return output;
      }
    }
  }

  // ===== REGISTRATION =====

  RegisterAlgorithm(new Schwaemm256128Algorithm());

  return {
    Schwaemm256128Algorithm,
    Schwaemm256128Instance
  };
}));
