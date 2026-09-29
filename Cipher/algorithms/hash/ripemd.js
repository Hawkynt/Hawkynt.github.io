/*
 * RIPEMD Family Hash Functions - Universal AlgorithmFramework Implementation
 * Implements RIPEMD-128, RIPEMD-160, RIPEMD-256, and RIPEMD-320
 * Based on Bouncy Castle reference implementations
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

  // ===== SHARED IMPLEMENTATION =====

  // Message word selection and rotation amounts of the left and right lines
  // (RIPEMD-160 has five rounds of 16 steps; RIPEMD-128/256 use the first four)
  /** @type {int32[]} */
  const RMD_ZL = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
    3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
    1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
    4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13
  ];

  /** @type {int32[]} */
  const RMD_ZR = [
    5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
    6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
    15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
    8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
    12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11
  ];

  /** @type {int32[]} */
  const RMD_SL = [
    11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
    7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
    11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
    11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
    9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6
  ];

  /** @type {int32[]} */
  const RMD_SR = [
    8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
    9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
    9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
    15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
    8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11
  ];

  // Round constants of the left line, and of the right line of the four-round
  // (128/256) and five-round (160/320) variants
  /** @type {uint32[]} */
  const RMD_KL = OpCodes.Hex32ToDWords('000000005A8279996ED9EBA18F1BBCDCA953FD4E');
  /** @type {uint32[]} */
  const RMD_KR4 = OpCodes.Hex32ToDWords('50A28BE65C4DD1246D703EF300000000');
  /** @type {uint32[]} */
  const RMD_KR5 = OpCodes.Hex32ToDWords('50A28BE65C4DD1246D703EF37A6D76E900000000');

  // Register updated by step i of a five-register line (RIPEMD-160/320 name the
  // registers a, b, c, d, e; the steps update a, e, d, c, b, a, ...)
  /** @type {int32[]} */
  const RMD_ORDER5 = [0, 4, 3, 2, 1];

  /**
   * RIPEMD boolean function j (0..4 = f1..f5)
   * @param {int32} j - Function index
   * @param {uint32} x - Word
   * @param {uint32} y - Word
   * @param {uint32} z - Word
   * @returns {uint32} f_j(x, y, z)
   */
  function RMD_F(j, x, y, z) {
    if (j === 0) return OpCodes.Xor32(OpCodes.Xor32(x, y), z);
    if (j === 1) return OpCodes.Or32(OpCodes.And32(x, y), OpCodes.And32(OpCodes.Not32(x), z));
    if (j === 2) return OpCodes.Xor32(OpCodes.Or32(x, OpCodes.Not32(y)), z);
    if (j === 3) return OpCodes.Or32(OpCodes.And32(x, z), OpCodes.And32(y, OpCodes.Not32(z)));
    return OpCodes.Xor32(x, OpCodes.Or32(y, OpCodes.Not32(z)));
  }

  /**
   * One step of a four-register line (RIPEMD-128/256): register p absorbs
   * f(next three registers), a message word and the round constant
   * @param {uint32[]} v - The four registers, updated in place
   * @param {int32} p - Index of the register to update
   * @param {int32} f - Boolean function index
   * @param {uint32} m - Message word
   * @param {uint32} k - Round constant
   * @param {int32} s - Rotation amount
   * @returns {void}
   */
  function RMD_Step4(v, p, f, m, k, s) {
    const sum = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(v[p], RMD_F(f, v[(p + 1) % 4], v[(p + 2) % 4], v[(p + 3) % 4])), m), k);
    v[p] = OpCodes.RotL32(sum, s);
  }

  /**
   * One step of a five-register line (RIPEMD-160/320): register p absorbs
   * f(next three registers), a message word, the round constant and the
   * fourth register after it, and the second register after it rotates by 10
   * @param {uint32[]} v - The five registers, updated in place
   * @param {int32} p - Index of the register to update
   * @param {int32} f - Boolean function index
   * @param {uint32} m - Message word
   * @param {uint32} k - Round constant
   * @param {int32} s - Rotation amount
   * @returns {void}
   */
  function RMD_Step5(v, p, f, m, k, s) {
    const sum = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(v[p], RMD_F(f, v[(p + 1) % 5], v[(p + 2) % 5], v[(p + 3) % 5])), m), k);
    v[p] = OpCodes.Add32(OpCodes.RotL32(sum, s), v[(p + 4) % 5]);
    v[(p + 2) % 5] = OpCodes.RotL32(v[(p + 2) % 5], 10);
  }

  /**
 * RIPEMD cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class RIPEMDInstance extends IHashFunctionInstance {
    /**
     * Initialize a RIPEMD instance
     * @param {HashFunctionAlgorithm} algorithm - Parent algorithm instance
     * @param {int32} variant - Digest size in bits: 128, 160, 256 or 320
     */
    constructor(algorithm, variant) {
      super(algorithm);
      /** @type {int32} */
      this.variant = variant; // 128, 160, 256, or 320
      this.OutputSize = variant / 8; // Convert bits to bytes
      this._Reset();
    }

    /**
     * Reset the chaining value and the block buffer
     * @returns {void}
     */
    _Reset() {
      // Initialization vectors based on variant
      if (this.variant === 128) {
        this.h = new Uint32Array([
          0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476
        ]);
      } else if (this.variant === 160) {
        this.h = new Uint32Array([
          0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0
        ]);
      } else if (this.variant === 256) {
        this.h = new Uint32Array([
          0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476,
          0x76543210, 0xFEDCBA98, 0x89ABCDEF, 0x01234567
        ]);
      } else if (this.variant === 320) {
        this.h = new Uint32Array([
          0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0,
          0x76543210, 0xFEDCBA98, 0x89ABCDEF, 0x01234567, 0x3C2D1E0F
        ]);
      }

      this.buffer = new Uint8Array(64);
      this.bufferLength = 0;
      this.totalLength = 0;
    }

    /**
     * Reset the chaining value and the block buffer
     * @returns {void}
     */
    Initialize() {
      this._Reset();
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @returns {void}
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      const input = new Uint8Array(data);
      this.totalLength += input.length;

      let offset = 0;

      // Process any remaining bytes in buffer
      if (this.bufferLength > 0) {
        const needed = 64 - this.bufferLength;
        const available = Math.min(needed, input.length);

        this.buffer.set(input.slice(0, available), this.bufferLength);
        this.bufferLength += available;
        offset = available;

        if (this.bufferLength === 64) {
          this._ProcessBlock(this.buffer);
          this.bufferLength = 0;
        }
      }

      // Process complete 64-byte blocks
      while (offset + 64 <= input.length) {
        this._ProcessBlock(input.slice(offset, offset + 64));
        offset += 64;
      }

      // Store remaining bytes in buffer
      if (offset < input.length) {
        const remaining = input.slice(offset);
        this.buffer.set(remaining, 0);
        this.bufferLength = remaining.length;
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Digest
   */

    Result() {
      // Save current state
      const originalH = this.h.slice();
      const originalBuffer = this.buffer.slice();
      const originalBufferLength = this.bufferLength;
      const originalTotalLength = this.totalLength;

      // Create padding
      const msgLength = this.totalLength;
      const padLength = (msgLength % 64 < 56) ? (56 - (msgLength % 64)) : (120 - (msgLength % 64));

      // Add padding
      const padding = new Uint8Array(padLength + 8);
      padding[0] = 0x80; // First padding bit is 1

      // Add length in bits as 64-bit little-endian
      const bitLength = msgLength * 8;
      const lengthBytes = OpCodes.Unpack32LE(bitLength);
      padding[padLength] = lengthBytes[0];
      padding[padLength + 1] = lengthBytes[1];
      padding[padLength + 2] = lengthBytes[2];
      padding[padLength + 3] = lengthBytes[3];
      // For practical message sizes, high 32 bits are always 0
      padding[padLength + 4] = 0;
      padding[padLength + 5] = 0;
      padding[padLength + 6] = 0;
      padding[padLength + 7] = 0;

      this.Feed(padding);

      // Convert hash to bytes (little-endian)
      /** @type {uint8[]} */
      const result = [];
      const wordCount = this.variant / 32; // Number of 32-bit words
      for (let i = 0; i < wordCount; i++) {
        const bytes = OpCodes.Unpack32LE(this.h[i]);
        for (let _i = 0; _i < bytes.length; _i++) result.push(bytes[_i]);
      }

      // Restore original state (so Result() can be called multiple times)
      this.h = originalH;
      this.buffer = originalBuffer;
      this.bufferLength = originalBufferLength;
      this.totalLength = originalTotalLength;

      return result;
    }

    /**
     * Process one 64-byte block
     * @param {uint8[]} block - 64-byte block
     * @returns {void}
     */
    _ProcessBlock(block) {
      // Convert block to 32-bit words (little-endian)
      /** @type {uint32[]} */
      const X = new Array(16);
      for (let i = 0; i < 16; i++) {
        X[i] = OpCodes.Pack32LE(block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]);
      }

      if (this.variant === 128) {
        this._ProcessBlock128(X);
      } else if (this.variant === 160) {
        this._ProcessBlock160(X);
      } else if (this.variant === 256) {
        this._ProcessBlock256(X);
      } else if (this.variant === 320) {
        this._ProcessBlock320(X);
      }
    }

    /**
     * RIPEMD-128 compression: two four-round lines, combined crosswise
     * @param {uint32[]} X - The 16 message words
     * @returns {void}
     */
    _ProcessBlock128(X) {
      /** @type {uint32[]} */
      const L = [this.h[0], this.h[1], this.h[2], this.h[3]];
      /** @type {uint32[]} */
      const R = [this.h[0], this.h[1], this.h[2], this.h[3]];

      for (let r = 0; r < 4; ++r) {
        for (let j = 0; j < 16; ++j) {
          const i = r * 16 + j;
          const p = (4 - (j % 4)) % 4;
          RMD_Step4(L, p, r, X[RMD_ZL[i]], RMD_KL[r], RMD_SL[i]);
          RMD_Step4(R, p, 3 - r, X[RMD_ZR[i]], RMD_KR4[r], RMD_SR[i]);
        }
      }

      // Update state
      const t = OpCodes.Add32(OpCodes.Add32(this.h[1], L[2]), R[3]);
      this.h[1] = OpCodes.Add32(OpCodes.Add32(this.h[2], L[3]), R[0]);
      this.h[2] = OpCodes.Add32(OpCodes.Add32(this.h[3], L[0]), R[1]);
      this.h[3] = OpCodes.Add32(OpCodes.Add32(this.h[0], L[1]), R[2]);
      this.h[0] = t;
    }

    /**
     * RIPEMD-160 compression: two five-round lines, combined crosswise
     * @param {uint32[]} X - The 16 message words
     * @returns {void}
     */
    _ProcessBlock160(X) {
      /** @type {uint32[]} */
      const L = [this.h[0], this.h[1], this.h[2], this.h[3], this.h[4]];
      /** @type {uint32[]} */
      const R = [this.h[0], this.h[1], this.h[2], this.h[3], this.h[4]];

      for (let r = 0; r < 5; ++r) {
        for (let j = 0; j < 16; ++j) {
          const i = r * 16 + j;
          const p = RMD_ORDER5[i % 5];
          RMD_Step5(L, p, r, X[RMD_ZL[i]], RMD_KL[r], RMD_SL[i]);
          RMD_Step5(R, p, 4 - r, X[RMD_ZR[i]], RMD_KR5[r], RMD_SR[i]);
        }
      }

      // Update state
      const t = OpCodes.Add32(OpCodes.Add32(this.h[1], L[2]), R[3]);
      this.h[1] = OpCodes.Add32(OpCodes.Add32(this.h[2], L[3]), R[4]);
      this.h[2] = OpCodes.Add32(OpCodes.Add32(this.h[3], L[4]), R[0]);
      this.h[3] = OpCodes.Add32(OpCodes.Add32(this.h[4], L[0]), R[1]);
      this.h[4] = OpCodes.Add32(OpCodes.Add32(this.h[0], L[1]), R[2]);
      this.h[0] = t;
    }

    /**
     * RIPEMD-256 compression: the two RIPEMD-128 lines run on separate halves
     * of the state and exchange register r after round r
     * @param {uint32[]} X - The 16 message words
     * @returns {void}
     */
    _ProcessBlock256(X) {
      /** @type {uint32[]} */
      const L = [this.h[0], this.h[1], this.h[2], this.h[3]];
      /** @type {uint32[]} */
      const R = [this.h[4], this.h[5], this.h[6], this.h[7]];

      for (let r = 0; r < 4; ++r) {
        for (let j = 0; j < 16; ++j) {
          const i = r * 16 + j;
          const p = (4 - (j % 4)) % 4;
          RMD_Step4(L, p, r, X[RMD_ZL[i]], RMD_KL[r], RMD_SL[i]);
          RMD_Step4(R, p, 3 - r, X[RMD_ZR[i]], RMD_KR4[r], RMD_SR[i]);
        }
        const t = L[r];
        L[r] = R[r];
        R[r] = t;
      }

      // Update state
      for (let k = 0; k < 4; ++k) {
        this.h[k] = OpCodes.Add32(this.h[k], L[k]);
        this.h[4 + k] = OpCodes.Add32(this.h[4 + k], R[k]);
      }
    }

    /**
     * RIPEMD-320 compression: the two RIPEMD-160 lines run on separate halves
     * of the state and exchange register r after round r (the exchange of e
     * after the last round is folded into the feed-forward)
     * @param {uint32[]} X - The 16 message words
     * @returns {void}
     */
    _ProcessBlock320(X) {
      /** @type {uint32[]} */
      const L = [this.h[0], this.h[1], this.h[2], this.h[3], this.h[4]];
      /** @type {uint32[]} */
      const R = [this.h[5], this.h[6], this.h[7], this.h[8], this.h[9]];

      for (let r = 0; r < 5; ++r) {
        for (let j = 0; j < 16; ++j) {
          const i = r * 16 + j;
          const p = RMD_ORDER5[i % 5];
          RMD_Step5(L, p, r, X[RMD_ZL[i]], RMD_KL[r], RMD_SL[i]);
          RMD_Step5(R, p, 4 - r, X[RMD_ZR[i]], RMD_KR5[r], RMD_SR[i]);
        }
        if (r < 4) {
          const t = L[r];
          L[r] = R[r];
          R[r] = t;
        }
      }

      // Update state
      this.h[0] = OpCodes.Add32(this.h[0], L[0]);
      this.h[1] = OpCodes.Add32(this.h[1], L[1]);
      this.h[2] = OpCodes.Add32(this.h[2], L[2]);
      this.h[3] = OpCodes.Add32(this.h[3], L[3]);
      this.h[4] = OpCodes.Add32(this.h[4], R[4]);
      this.h[5] = OpCodes.Add32(this.h[5], R[0]);
      this.h[6] = OpCodes.Add32(this.h[6], R[1]);
      this.h[7] = OpCodes.Add32(this.h[7], R[2]);
      this.h[8] = OpCodes.Add32(this.h[8], R[3]);
      this.h[9] = OpCodes.Add32(this.h[9], L[4]);
    }
  }

  // ===== ALGORITHM CLASSES =====

  /**
 * RIPEMD128Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class RIPEMD128Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "RIPEMD-128";
      this.description = "RACE Integrity Primitives Evaluation Message Digest with 128-bit output. Developed as part of the RIPEMD family with dual-path design. Produces a 128-bit hash digest but considered weak by modern standards.";
      this.inventor = "Hans Dobbertin, Antoon Bosselaers, Bart Preneel";
      this.year = 1996;
      this.category = CategoryType.HASH;
      this.subCategory = "RIPEMD Family";
      this.securityStatus = SecurityStatus.DEPRECATED;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      this.documentation = [
        new LinkItem("RIPEMD-128 Specification", "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"),
        new LinkItem("ISO/IEC 10118-3:2004 Standard", "https://www.iso.org/standard/39876.html"),
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/RIPEMD")
      ];

      this.references = [
        new LinkItem("Bouncy Castle Java Implementation", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/digests/RIPEMD128Digest.java"),
        new LinkItem("Original RIPEMD Family Specification", "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html")
      ];

      this.tests = [
        {
          input: [],
          expected: OpCodes.Hex8ToBytes("cdf26213a150dc3ecb610f18f6b38b46"),
          text: "Empty string test vector",
          uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"
        },
        {
          input: OpCodes.AnsiToBytes("a"),
          expected: OpCodes.Hex8ToBytes("86be7afa339d0fc7cfc785e72f578d33"),
          text: "Single character 'a' test vector",
          uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"
        },
        {
          input: OpCodes.AnsiToBytes("abc"),
          expected: OpCodes.Hex8ToBytes("c14a12199c66e4ba84636b0f69144c77"),
          text: "String 'abc' test vector",
          uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"
        },
        {
          input: OpCodes.AnsiToBytes("message digest"),
          expected: OpCodes.Hex8ToBytes("9e327b3d6e523062afc1132d7df9d1b8"),
          text: "String 'message digest' test vector",
          uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"
        },
        {
          input: OpCodes.AnsiToBytes("abcdefghijklmnopqrstuvwxyz"),
          expected: OpCodes.Hex8ToBytes("fd2aa607f71dc8f510714922b371834e"),
          text: "Lowercase alphabet test vector",
          uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"
        },
        {
          input: OpCodes.AnsiToBytes("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
          expected: OpCodes.Hex8ToBytes("a1aa0689d0fafa2ddc22e88b49133a06"),
          text: "Repeated pattern test vector",
          uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"
        },
        {
          input: OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"),
          expected: OpCodes.Hex8ToBytes("d1e959eb179c911faea4624c60c5c702"),
          text: "Alphanumeric test vector",
          uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"
        },
        {
          input: OpCodes.AnsiToBytes("12345678901234567890123456789012345678901234567890123456789012345678901234567890"),
          expected: OpCodes.Hex8ToBytes("3f45ef194732c2dbb2c4a2c769795fa3"),
          text: "Repeated digits test vector",
          uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {RIPEMDInstance} New hash instance (null for the inverse)
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new RIPEMDInstance(this, 128);
    }
  }

  /**
 * RIPEMD160Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class RIPEMD160Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "RIPEMD-160";
      this.description = "RACE Integrity Primitives Evaluation Message Digest with 160-bit output. Developed as a European alternative to SHA-1 with different design principles. Produces a 160-bit hash digest.";
      this.inventor = "Hans Dobbertin, Antoon Bosselaers, Bart Preneel";
      this.year = 1996;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      this.documentation = [
        new LinkItem("RIPEMD-160: A Strengthened Version of RIPEMD", "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"),
        new LinkItem("ISO/IEC 10118-3:2004 Standard", "https://www.iso.org/standard/39876.html"),
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/RIPEMD")
      ];

      this.references = [
        new LinkItem("OpenSSL Implementation", "https://github.com/openssl/openssl/tree/master/crypto/ripemd"),
        new LinkItem("Bouncy Castle Java Implementation", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/digests/RIPEMD160Digest.java"),
        new LinkItem("Original Specification", "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html")
      ];

      this.tests = [
        {
          input: [],
          expected: OpCodes.Hex8ToBytes("9c1185a5c5e9fc54612808977ee8f548b2258d31"),
          text: "RIPEMD-160 empty string - Official OpenSSL test vector",
          uri: "https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpmd_ripemd.txt"
        },
        {
          input: OpCodes.AnsiToBytes("a"),
          expected: OpCodes.Hex8ToBytes("0bdc9d2d256b3ee9daae347be6f4dc835a467ffe"),
          text: "RIPEMD-160 single character 'a' - Official OpenSSL test vector",
          uri: "https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpmd_ripemd.txt"
        },
        {
          input: OpCodes.AnsiToBytes("abc"),
          expected: OpCodes.Hex8ToBytes("8eb208f7e05d987a9b044a8e98c6b087f15a0bfc"),
          text: "RIPEMD-160 string 'abc' - Official OpenSSL test vector",
          uri: "https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpmd_ripemd.txt"
        },
        {
          input: OpCodes.AnsiToBytes("message digest"),
          expected: OpCodes.Hex8ToBytes("5d0689ef49d2fae572b881b123a85ffa21595f36"),
          text: "RIPEMD-160 'message digest' - Official OpenSSL test vector",
          uri: "https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpmd_ripemd.txt"
        },
        {
          input: OpCodes.AnsiToBytes("abcdefghijklmnopqrstuvwxyz"),
          expected: OpCodes.Hex8ToBytes("f71c27109c692c1b56bbdceb5b9d2865b3708dbc"),
          text: "RIPEMD-160 lowercase alphabet - Official OpenSSL test vector",
          uri: "https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpmd_ripemd.txt"
        },
        {
          input: OpCodes.AnsiToBytes("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
          expected: OpCodes.Hex8ToBytes("12a053384a9c0c88e405a06c27dcf49ada62eb2b"),
          text: "RIPEMD-160 repeated pattern string - Official OpenSSL test vector",
          uri: "https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpmd_ripemd.txt"
        },
        {
          input: OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"),
          expected: OpCodes.Hex8ToBytes("b0e20b6e3116640286ed3a87a5713079b21f5189"),
          text: "RIPEMD-160 alphanumeric string - Official OpenSSL test vector",
          uri: "https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpmd_ripemd.txt"
        },
        {
          input: OpCodes.AnsiToBytes("12345678901234567890123456789012345678901234567890123456789012345678901234567890"),
          expected: OpCodes.Hex8ToBytes("9b752e45573d4b39f4dbd3323cab82bf63326bfb"),
          text: "RIPEMD-160 repeated digits (80 chars) - Official OpenSSL test vector",
          uri: "https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpmd_ripemd.txt"
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {RIPEMDInstance} New hash instance (null for the inverse)
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new RIPEMDInstance(this, 160);
    }
  }

  /**
 * RIPEMD256Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class RIPEMD256Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "RIPEMD-256";
      this.description = "RIPEMD-256 is an extension of RIPEMD-128 with 256-bit output. Uses two parallel computation lines with different initial values and no final combination. Part of the RIPEMD family designed as European alternatives to SHA algorithms.";
      this.inventor = "Hans Dobbertin, Antoon Bosselaers, Bart Preneel";
      this.year = 1996;
      this.category = CategoryType.HASH;
      this.subCategory = "RIPEMD Family";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      this.documentation = [
        new LinkItem("RIPEMD Family Specification", "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"),
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/RIPEMD")
      ];

      this.references = [
        new LinkItem("Bouncy Castle Implementation", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/digests/RIPEMD256Digest.java")
      ];

      this.tests = [
        {
          input: [],
          expected: OpCodes.Hex8ToBytes("02ba4c4e5f8ecd1877fc52d64d30e37a2d9774fb1e5d026380ae0168e3c5522d"),
          text: "Empty string test vector",
          uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"
        },
        {
          input: OpCodes.AnsiToBytes("a"),
          expected: OpCodes.Hex8ToBytes("f9333e45d857f5d90a91bab70a1eba0cfb1be4b0783c9acfcd883a9134692925"),
          text: "Single character 'a' test vector",
          uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"
        },
        {
          input: OpCodes.AnsiToBytes("abc"),
          expected: OpCodes.Hex8ToBytes("afbd6e228b9d8cbbcef5ca2d03e6dba10ac0bc7dcbe4680e1e42d2e975459b65"),
          text: "String 'abc' test vector",
          uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {RIPEMDInstance} New hash instance (null for the inverse)
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new RIPEMDInstance(this, 256);
    }
  }

  /**
 * RIPEMD320Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class RIPEMD320Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "RIPEMD-320";
      this.description = "Extended RIPEMD hash function producing 320-bit digest. Uses dual 160-bit computation pipelines for enhanced security margin. Part of the RIPEMD family designed as European alternative to MD/SHA.";
      this.inventor = "Hans Dobbertin, Antoon Bosselaers, Bart Preneel";
      this.year = 1996;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      this.documentation = [
        new LinkItem("RIPEMD-160: A Strengthened Version of RIPEMD", "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"),
        new LinkItem("ISO/IEC 10118-3:2004 Standard", "https://www.iso.org/standard/39876.html"),
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/RIPEMD")
      ];

      this.references = [
        new LinkItem("OpenSSL Implementation", "https://github.com/openssl/openssl/tree/master/crypto/ripemd"),
        new LinkItem("Bouncy Castle Java Implementation", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/digests/RIPEMD320Digest.java"),
        new LinkItem("Original Specification", "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html")
      ];

      this.tests = [
        {
          input: [],
          expected: OpCodes.Hex8ToBytes("22d65d5661536cdc75c1fdf5c6de7b41b9f27325ebc61e8557177d705a0ec880151c3a32a00899b8"),
          text: "Empty string test vector (Bouncy Castle)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/RIPEMD320DigestTest.java"
        },
        {
          input: OpCodes.AnsiToBytes("a"),
          expected: OpCodes.Hex8ToBytes("ce78850638f92658a5a585097579926dda667a5716562cfcf6fbe77f63542f99b04705d6970dff5d"),
          text: "Single character 'a' test vector (Bouncy Castle)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/RIPEMD320DigestTest.java"
        },
        {
          input: OpCodes.AnsiToBytes("abc"),
          expected: OpCodes.Hex8ToBytes("de4c01b3054f8930a79d09ae738e92301e5a17085beffdc1b8d116713e74f82fa942d64cdbc4682d"),
          text: "String 'abc' test vector (Bouncy Castle)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/RIPEMD320DigestTest.java"
        },
        {
          input: OpCodes.AnsiToBytes("abcdefghijklmnopqrstuvwxyz"),
          expected: OpCodes.Hex8ToBytes("cabdb1810b92470a2093aa6bce05952c28348cf43ff60841975166bb40ed234004b8824463e6b009"),
          text: "Alphabet test vector (Bouncy Castle)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/RIPEMD320DigestTest.java"
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {RIPEMDInstance} New hash instance (null for the inverse)
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new RIPEMDInstance(this, 320);
    }
  }

  // ===== REGISTRATION =====

  /** @type {HashFunctionAlgorithm[]} */
  const algorithms = [
    new RIPEMD128Algorithm(),
    new RIPEMD160Algorithm(),
    new RIPEMD256Algorithm(),
    new RIPEMD320Algorithm()
  ];

  for (let i = 0; i < algorithms.length; ++i) {
    if (!AlgorithmFramework.Find(algorithms[i].name)) {
      RegisterAlgorithm(algorithms[i]);
    }
  }

  // ===== EXPORTS =====

  return {
    RIPEMDInstance,
    RIPEMD128Algorithm,
    RIPEMD160Algorithm,
    RIPEMD256Algorithm,
    RIPEMD320Algorithm
  };
}));
