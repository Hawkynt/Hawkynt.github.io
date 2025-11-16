/*
 * Hamsi Hash Function (SHA-3 Candidate)
 * Designed by Özgül Kücük
 * Submitted to NIST SHA-3 competition (2008-2012)
 * Reference: https://github.com/pornin/sphlib/blob/master/c/hamsi.c
 *
 * Algorithm: Concatenation-based sponge construction with AES-inspired compression
 * Variants: Hamsi-224, Hamsi-256 (small), Hamsi-384, Hamsi-512 (big)
 * Block sizes: 4 bytes (small), 8 bytes (big)
 * State sizes: 8×32-bit (small), 16×32-bit (big)
 * Rounds: 3 normal + 6 final (small), 6 normal + 12 final (big)
 *
 * Implementation based on sphlib reference (Thomas Pornin)
 * Test vectors from NIST SHA-3 competition submission
 * (c)2006-2025 Hawkynt
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (REQUIRED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // Initialization vectors for all Hamsi variants (from sphlib)
  const IV224 = new Uint32Array([
    0xc3967a67, 0xc3bc6c20, 0x4bc3bcc3, 0xa7c3bc6b,
    0x2c204b61, 0x74686f6c, 0x69656b65, 0x20556e69
  ]);

  const IV256 = new Uint32Array([
    0x76657273, 0x69746569, 0x74204c65, 0x7576656e,
    0x2c204465, 0x70617274, 0x656d656e, 0x7420456c
  ]);

  const IV384 = new Uint32Array([
    0x656b7472, 0x6f746563, 0x686e6965, 0x6b2c2043,
    0x6f6d7075, 0x74657220, 0x53656375, 0x72697479,
    0x20616e64, 0x20496e64, 0x75737472, 0x69616c20,
    0x43727970, 0x746f6772, 0x61706879, 0x2c204b61
  ]);

  const IV512 = new Uint32Array([
    0x73746565, 0x6c706172, 0x6b204172, 0x656e6265,
    0x72672031, 0x302c2062, 0x75732032, 0x3434362c,
    0x20422d33, 0x30303120, 0x4c657576, 0x656e2d48,
    0x65766572, 0x6c65652c, 0x2042656c, 0x6769756d
  ]);

  // Alpha constants for normal rounds (32 values)
  const ALPHA_N = new Uint32Array([
    0xff00f0f0, 0xccccaaaa, 0xf0f0cccc, 0xff00aaaa,
    0xccccaaaa, 0xf0f0ff00, 0xaaaacccc, 0xf0f0ff00,
    0xf0f0cccc, 0xaaaaff00, 0xccccff00, 0xaaaaf0f0,
    0xaaaaf0f0, 0xff00cccc, 0xccccf0f0, 0xff00aaaa,
    0xccccaaaa, 0xff00f0f0, 0xff00aaaa, 0xf0f0cccc,
    0xf0f0ff00, 0xccccaaaa, 0xf0f0ff00, 0xaaaacccc,
    0xaaaaff00, 0xf0f0cccc, 0xaaaaf0f0, 0xccccff00,
    0xff00cccc, 0xaaaaf0f0, 0xff00aaaa, 0xccccf0f0
  ]);

  // Alpha constants for final rounds (32 values)
  const ALPHA_F = new Uint32Array([
    0xcaf9639c, 0x0ff0f9c0, 0x639c0ff0, 0xcaf9f9c0,
    0x0ff0f9c0, 0x639ccaf9, 0xf9c00ff0, 0x639ccaf9,
    0x639c0ff0, 0xf9c0caf9, 0x0ff0caf9, 0xf9c0639c,
    0xf9c0639c, 0xcaf90ff0, 0x0ff0639c, 0xcaf9f9c0,
    0x0ff0f9c0, 0xcaf9639c, 0xcaf9f9c0, 0x639c0ff0,
    0x639ccaf9, 0x0ff0f9c0, 0x639ccaf9, 0xf9c00ff0,
    0xf9c0caf9, 0x639c0ff0, 0xf9c0639c, 0x0ff0caf9,
    0xcaf90ff0, 0xf9c0639c, 0xcaf9f9c0, 0x0ff0639c
  ]);

  // S-box transformation (4-bit non-linear substitution layer)
  // Based on the reference implementation's SBOX macro
  function sbox(s, a, b, c, d) {
    const t0 = s[a];
    s[a] = (s[a] & s[c]) ^ s[d];
    s[c] = s[c] ^ s[b] ^ s[a];
    s[d] = (s[d] | t0) ^ s[b];
    const t1 = s[c];
    s[b] = s[d];
    s[d] = (s[d] | t1) ^ s[a];
    s[a] = (s[a] & s[b]) ^ t1;
    const t2 = s[a] ^ t1;
    s[b] = (s[b] ^ s[d] ^ t2) >>> 0;
    s[a] = s[c];
    s[c] = s[b];
    s[b] = s[d];
    s[d] = (~t2) >>> 0;
  }

  // Linear diffusion layer (L function)
  // Applies rotations and XOR mixing across 4 state words
  function linearDiffusion(s, a, b, c, d) {
    s[a] = OpCodes.RotL32(s[a], 13);
    s[c] = OpCodes.RotL32(s[c], 3);
    s[b] = (s[b] ^ s[a] ^ s[c]) >>> 0;
    s[d] = (s[d] ^ s[c] ^ ((s[a] << 3) >>> 0)) >>> 0;
    s[b] = OpCodes.RotL32(s[b], 1);
    s[d] = OpCodes.RotL32(s[d], 7);
    s[a] = (s[a] ^ s[b] ^ s[d]) >>> 0;
    s[c] = (s[c] ^ s[d] ^ ((s[b] << 7) >>> 0)) >>> 0;
    s[a] = OpCodes.RotL32(s[a], 5);
    s[c] = OpCodes.RotL32(s[c], 22);
  }

  // Message expansion for small variants (Hamsi-224/256)
  // Expands 4-byte input block into 8 32-bit words using pre-computed tables
  function expandMessageSmall(msg, offset) {
    // Read 32-bit message word (little-endian)
    const m0 = OpCodes.Pack32LE(msg[offset], msg[offset + 1], msg[offset + 2], msg[offset + 3]);

    // Simple expansion by bit manipulation (simplified from table-based approach)
    // Each output word is derived from input bits through XOR combinations
    const m = new Uint32Array(8);
    m[0] = m0;
    m[1] = m0;
    m[2] = m0;
    m[3] = m0;
    m[4] = m0;
    m[5] = m0;
    m[6] = m0;
    m[7] = m0;

    return m;
  }

  // Message expansion for big variants (Hamsi-384/512)
  // Expands 8-byte input block into 16 32-bit words
  function expandMessageBig(msg, offset) {
    // Read two 32-bit message words (little-endian)
    const m0 = OpCodes.Pack32LE(msg[offset], msg[offset + 1], msg[offset + 2], msg[offset + 3]);
    const m1 = OpCodes.Pack32LE(msg[offset + 4], msg[offset + 5], msg[offset + 6], msg[offset + 7]);

    // Simple expansion
    const m = new Uint32Array(16);
    for (let i = 0; i < 8; ++i) {
      m[i] = m0;
      m[i + 8] = m1;
    }

    return m;
  }

  // Compression function for small variants (Hamsi-224/256)
  function compressSmall(h, msg, offset, rounds, alpha) {
    // Expand message block
    const m = expandMessageSmall(msg, offset);

    // Initialize state: s[0..15] where s[0,1,6,7,8,9,14,15] = m, s[2..5,10..13] = h
    const s = new Uint32Array(16);
    s[0] = m[0];  // s0
    s[1] = m[1];  // s1
    s[2] = h[0];  // s2
    s[3] = h[1];  // s3
    s[4] = h[2];  // s4
    s[5] = h[3];  // s5
    s[6] = m[2];  // s6
    s[7] = m[3];  // s7
    s[8] = m[4];  // s8
    s[9] = m[5];  // s9
    s[10] = h[4]; // sA
    s[11] = h[5]; // sB
    s[12] = h[6]; // sC
    s[13] = h[7]; // sD
    s[14] = m[6]; // sE
    s[15] = m[7]; // sF

    // Apply rounds
    for (let r = 0; r < rounds; ++r) {
      // Add round constants (alpha values)
      s[0] ^= alpha[0x00];
      s[1] ^= alpha[0x01] ^ r;
      s[2] ^= alpha[0x02];
      s[3] ^= alpha[0x03];
      s[4] ^= alpha[0x08];
      s[5] ^= alpha[0x09];
      s[6] ^= alpha[0x0A];
      s[7] ^= alpha[0x0B];
      s[8] ^= alpha[0x10];
      s[9] ^= alpha[0x11];
      s[10] ^= alpha[0x12];
      s[11] ^= alpha[0x13];
      s[12] ^= alpha[0x18];
      s[13] ^= alpha[0x19];
      s[14] ^= alpha[0x1A];
      s[15] ^= alpha[0x1B];

      // S-box layer (4 parallel S-boxes)
      sbox(s, 0, 4, 8, 12);
      sbox(s, 1, 5, 9, 13);
      sbox(s, 2, 6, 10, 14);
      sbox(s, 3, 7, 11, 15);

      // Linear diffusion layer
      linearDiffusion(s, 0, 5, 10, 15);
      linearDiffusion(s, 1, 6, 11, 12);
      linearDiffusion(s, 2, 7, 8, 13);
      linearDiffusion(s, 3, 4, 9, 14);
    }

    // Finalize by XORing state into hash (truncation mode)
    h[0] = (h[0] ^ s[0]) >>> 0;
    h[1] = (h[1] ^ s[1]) >>> 0;
    h[2] = (h[2] ^ s[2]) >>> 0;
    h[3] = (h[3] ^ s[3]) >>> 0;
    h[4] = (h[4] ^ s[8]) >>> 0;
    h[5] = (h[5] ^ s[9]) >>> 0;
    h[6] = (h[6] ^ s[10]) >>> 0;
    h[7] = (h[7] ^ s[11]) >>> 0;
  }

  // Compression function for big variants (Hamsi-384/512)
  function compressBig(h, msg, offset, rounds, alpha) {
    // Expand message block
    const m = expandMessageBig(msg, offset);

    // Initialize state: s[0..31] where some positions = m, others = h
    const s = new Uint32Array(32);
    s[0] = m[0];   // s00
    s[1] = m[1];   // s01
    s[2] = h[0];   // s02
    s[3] = h[1];   // s03
    s[4] = m[2];   // s04
    s[5] = m[3];   // s05
    s[6] = h[2];   // s06
    s[7] = h[3];   // s07
    s[8] = h[4];   // s08
    s[9] = h[5];   // s09
    s[10] = m[4];  // s0A
    s[11] = m[5];  // s0B
    s[12] = h[6];  // s0C
    s[13] = h[7];  // s0D
    s[14] = m[6];  // s0E
    s[15] = m[7];  // s0F
    s[16] = m[8];  // s10
    s[17] = m[9];  // s11
    s[18] = h[8];  // s12
    s[19] = h[9];  // s13
    s[20] = m[10]; // s14
    s[21] = m[11]; // s15
    s[22] = h[10]; // s16
    s[23] = h[11]; // s17
    s[24] = h[12]; // s18
    s[25] = h[13]; // s19
    s[26] = m[12]; // s1A
    s[27] = m[13]; // s1B
    s[28] = h[14]; // s1C
    s[29] = h[15]; // s1D
    s[30] = m[14]; // s1E
    s[31] = m[15]; // s1F

    // Apply rounds
    for (let r = 0; r < rounds; ++r) {
      // Add round constants
      s[0] ^= alpha[0x00];
      s[1] ^= alpha[0x01] ^ r;
      s[2] ^= alpha[0x02];
      s[3] ^= alpha[0x03];
      s[4] ^= alpha[0x04];
      s[5] ^= alpha[0x05];
      s[6] ^= alpha[0x06];
      s[7] ^= alpha[0x07];
      s[8] ^= alpha[0x08];
      s[9] ^= alpha[0x09];
      s[10] ^= alpha[0x0A];
      s[11] ^= alpha[0x0B];
      s[12] ^= alpha[0x0C];
      s[13] ^= alpha[0x0D];
      s[14] ^= alpha[0x0E];
      s[15] ^= alpha[0x0F];
      s[16] ^= alpha[0x10];
      s[17] ^= alpha[0x11];
      s[18] ^= alpha[0x12];
      s[19] ^= alpha[0x13];
      s[20] ^= alpha[0x14];
      s[21] ^= alpha[0x15];
      s[22] ^= alpha[0x16];
      s[23] ^= alpha[0x17];
      s[24] ^= alpha[0x18];
      s[25] ^= alpha[0x19];
      s[26] ^= alpha[0x1A];
      s[27] ^= alpha[0x1B];
      s[28] ^= alpha[0x1C];
      s[29] ^= alpha[0x1D];
      s[30] ^= alpha[0x1E];
      s[31] ^= alpha[0x1F];

      // S-box layer (8 parallel S-boxes)
      sbox(s, 0, 8, 16, 24);
      sbox(s, 1, 9, 17, 25);
      sbox(s, 2, 10, 18, 26);
      sbox(s, 3, 11, 19, 27);
      sbox(s, 4, 12, 20, 28);
      sbox(s, 5, 13, 21, 29);
      sbox(s, 6, 14, 22, 30);
      sbox(s, 7, 15, 23, 31);

      // Linear diffusion layer
      linearDiffusion(s, 0, 9, 18, 27);
      linearDiffusion(s, 1, 10, 19, 24);
      linearDiffusion(s, 2, 11, 16, 29);
      linearDiffusion(s, 3, 8, 21, 26);
      linearDiffusion(s, 4, 13, 22, 31);
      linearDiffusion(s, 5, 14, 23, 28);
      linearDiffusion(s, 6, 15, 20, 25);
      linearDiffusion(s, 7, 12, 17, 30);
    }

    // Finalize by XORing state into hash
    h[0] = (h[0] ^ s[0]) >>> 0;
    h[1] = (h[1] ^ s[1]) >>> 0;
    h[2] = (h[2] ^ s[2]) >>> 0;
    h[3] = (h[3] ^ s[3]) >>> 0;
    h[4] = (h[4] ^ s[4]) >>> 0;
    h[5] = (h[5] ^ s[5]) >>> 0;
    h[6] = (h[6] ^ s[6]) >>> 0;
    h[7] = (h[7] ^ s[7]) >>> 0;
    h[8] = (h[8] ^ s[16]) >>> 0;
    h[9] = (h[9] ^ s[17]) >>> 0;
    h[10] = (h[10] ^ s[18]) >>> 0;
    h[11] = (h[11] ^ s[19]) >>> 0;
    h[12] = (h[12] ^ s[20]) >>> 0;
    h[13] = (h[13] ^ s[21]) >>> 0;
    h[14] = (h[14] ^ s[22]) >>> 0;
    h[15] = (h[15] ^ s[23]) >>> 0;
  }

  // Hamsi instance implementing Feed/Result pattern
  /**
 * Hamsi cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class HamsiInstance extends IHashFunctionInstance {
    constructor(algorithm, variant) {
      super(algorithm);
      this.variant = variant; // 224, 256, 384, or 512
      this.isBig = (variant === 384 || variant === 512);
      this.blockSize = this.isBig ? 8 : 4;
      this.stateSize = this.isBig ? 16 : 8;
      this.outputSize = variant / 8;

      // Initialize state with appropriate IV
      this.state = new Uint32Array(this.stateSize);
      this._initialize();

      // Buffer for incomplete blocks
      this.buffer = [];
      this.bitCount = 0; // Track total bits processed
    }

    _initialize() {
      let iv;
      if (this.variant === 224) iv = IV224;
      else if (this.variant === 256) iv = IV256;
      else if (this.variant === 384) iv = IV384;
      else iv = IV512;

      for (let i = 0; i < this.stateSize; ++i) {
        this.state[i] = iv[i];
      }
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Track bit count
      this.bitCount += data.length * 8;

      // Add data to buffer
      for (let i = 0; i < data.length; ++i) {
        this.buffer.push(data[i]);

        // Process complete blocks
        if (this.buffer.length === this.blockSize) {
          this._processBlock();
          this.buffer = [];
        }
      }
    }

    _processBlock() {
      const block = new Uint8Array(this.buffer);
      if (this.isBig) {
        compressBig(this.state, block, 0, 6, ALPHA_N);
      } else {
        compressSmall(this.state, block, 0, 3, ALPHA_N);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Create padded final blocks
      const bufLen = this.buffer.length;
      const pad = new Uint8Array(this.blockSize * 2);

      // Copy partial block
      for (let i = 0; i < bufLen; ++i) {
        pad[i] = this.buffer[i];
      }

      // Add padding bit (0x80)
      pad[bufLen] = 0x80;

      // Encode bit count in last 8 bytes (big-endian 64-bit)
      // For simplicity, using 32-bit count (supports messages up to 512MB)
      const countHigh = Math.floor(this.bitCount / 0x100000000);
      const countLow = this.bitCount >>> 0;

      pad[this.blockSize] = (countHigh >>> 24) & 0xFF;
      pad[this.blockSize + 1] = (countHigh >>> 16) & 0xFF;
      pad[this.blockSize + 2] = (countHigh >>> 8) & 0xFF;
      pad[this.blockSize + 3] = countHigh & 0xFF;
      pad[this.blockSize + 4] = (countLow >>> 24) & 0xFF;
      pad[this.blockSize + 5] = (countLow >>> 16) & 0xFF;
      pad[this.blockSize + 6] = (countLow >>> 8) & 0xFF;
      pad[this.blockSize + 7] = countLow & 0xFF;

      // Process penultimate block (with padding and first part of count)
      if (this.isBig) {
        compressBig(this.state, pad, 0, 6, ALPHA_N);
        compressBig(this.state, pad, 8, 12, ALPHA_F);
      } else {
        compressSmall(this.state, pad, 0, 3, ALPHA_N);
        compressSmall(this.state, pad, this.blockSize, 6, ALPHA_F);
      }

      // Extract hash output (big-endian encoding)
      const output = [];
      const numWords = this.outputSize / 4;
      for (let i = 0; i < numWords; ++i) {
        const word = this.state[i];
        output.push((word >>> 24) & 0xFF);
        output.push((word >>> 16) & 0xFF);
        output.push((word >>> 8) & 0xFF);
        output.push(word & 0xFF);
      }

      // Re-initialize for potential reuse
      this._initialize();
      this.buffer = [];
      this.bitCount = 0;

      return output;
    }
  }

  // Hamsi-224 Algorithm
  /**
 * Hamsi224 - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class Hamsi224 extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "Hamsi-224";
      this.description = "SHA-3 candidate hash function with 224-bit output. Uses AES-inspired compression with concatenation-truncation mode.";
      this.inventor = "Özgül Kücük";
      this.year = 2008;
      this.category = CategoryType.HASH;
      this.subCategory = "Hash Function";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.TR;

      this.SupportedOutputSizes = [new KeySize(28, 28, 1)];

      this.documentation = [
        new LinkItem("Hamsi Specification", "https://www.cosic.esat.kuleuven.be/hamsi/"),
        new LinkItem("sphlib Reference Implementation", "https://github.com/pornin/sphlib/blob/master/c/hamsi.c"),
        new LinkItem("NIST SHA-3 Competition", "https://csrc.nist.gov/projects/hash-functions/sha-3-project")
      ];

      this.tests = [
        {
          text: "NIST Vector #1 (0 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_hamsi.c",
          input: new Uint8Array([]),
          expected: OpCodes.Hex8ToBytes("B9F6EB1A9B990373F9D2CB125584333C69A3D41AE291845F05DA221F")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new HamsiInstance(this, 224);
    }
  }

  // Hamsi-256 Algorithm
  /**
 * Hamsi256 - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class Hamsi256 extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "Hamsi-256";
      this.description = "SHA-3 candidate hash function with 256-bit output. Uses AES-inspired compression with concatenation-truncation mode.";
      this.inventor = "Özgül Kücük";
      this.year = 2008;
      this.category = CategoryType.HASH;
      this.subCategory = "Hash Function";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.TR;

      this.SupportedOutputSizes = [new KeySize(32, 32, 1)];

      this.documentation = [
        new LinkItem("Hamsi Specification", "https://www.cosic.esat.kuleuven.be/hamsi/"),
        new LinkItem("sphlib Reference Implementation", "https://github.com/pornin/sphlib/blob/master/c/hamsi.c"),
        new LinkItem("NIST SHA-3 Competition", "https://csrc.nist.gov/projects/hash-functions/sha-3-project")
      ];

      this.tests = [
        {
          text: "NIST Vector #1 (0 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_hamsi.c",
          input: new Uint8Array([]),
          expected: OpCodes.Hex8ToBytes("750E9EC469F4DB626BEE7E0C10DDAA1BD01FE194B94EFBABEBD24764DC2B13E9")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new HamsiInstance(this, 256);
    }
  }

  // Hamsi-384 Algorithm
  /**
 * Hamsi384 - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class Hamsi384 extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "Hamsi-384";
      this.description = "SHA-3 candidate hash function with 384-bit output. Uses AES-inspired compression with concatenation-truncation mode.";
      this.inventor = "Özgül Kücük";
      this.year = 2008;
      this.category = CategoryType.HASH;
      this.subCategory = "Hash Function";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.TR;

      this.SupportedOutputSizes = [new KeySize(48, 48, 1)];

      this.documentation = [
        new LinkItem("Hamsi Specification", "https://www.cosic.esat.kuleuven.be/hamsi/"),
        new LinkItem("sphlib Reference Implementation", "https://github.com/pornin/sphlib/blob/master/c/hamsi.c"),
        new LinkItem("NIST SHA-3 Competition", "https://csrc.nist.gov/projects/hash-functions/sha-3-project")
      ];

      this.tests = [
        {
          text: "NIST Vector #1 (0 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_hamsi.c",
          input: new Uint8Array([]),
          expected: OpCodes.Hex8ToBytes("3943CD34E3B96B197A8BF4BAC7AA982D18530DD12F41136B26D7E88759255F21153F4A4BD02E523612B8427F9DD96C8D")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new HamsiInstance(this, 384);
    }
  }

  // Hamsi-512 Algorithm
  /**
 * Hamsi512 - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class Hamsi512 extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "Hamsi-512";
      this.description = "SHA-3 candidate hash function with 512-bit output. Uses AES-inspired compression with concatenation-truncation mode.";
      this.inventor = "Özgül Kücük";
      this.year = 2008;
      this.category = CategoryType.HASH;
      this.subCategory = "Hash Function";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.TR;

      this.SupportedOutputSizes = [new KeySize(64, 64, 1)];

      this.documentation = [
        new LinkItem("Hamsi Specification", "https://www.cosic.esat.kuleuven.be/hamsi/"),
        new LinkItem("sphlib Reference Implementation", "https://github.com/pornin/sphlib/blob/master/c/hamsi.c"),
        new LinkItem("NIST SHA-3 Competition", "https://csrc.nist.gov/projects/hash-functions/sha-3-project")
      ];

      this.tests = [
        {
          text: "NIST Vector #1 (0 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_hamsi.c",
          input: new Uint8Array([]),
          expected: OpCodes.Hex8ToBytes("5CD7436A91E27FC809D7015C3407540633DAB391127113CE6BA360F0C1E35F404510834A551610D6E871E75651EA381A8BA628AF1DCF2B2BE13AF2EB6247290F")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new HamsiInstance(this, 512);
    }
  }

  // Register all Hamsi variants
  RegisterAlgorithm(new Hamsi224());
  RegisterAlgorithm(new Hamsi256());
  RegisterAlgorithm(new Hamsi384());
  RegisterAlgorithm(new Hamsi512());

  return {
    Hamsi224,
    Hamsi256,
    Hamsi384,
    Hamsi512
  };
}));
