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

  /**
 * RIPEMD cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class RIPEMDInstance extends IHashFunctionInstance {
    constructor(algorithm, variant) {
      super(algorithm);
      this.variant = variant; // 128, 160, 256, or 320
      this.OutputSize = variant / 8; // Convert bits to bytes
      this._Reset();
    }

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

    Initialize() {
      this._Reset();
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
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
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
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
      const result = [];
      const wordCount = this.variant / 32; // Number of 32-bit words
      for (let i = 0; i < wordCount; i++) {
        const bytes = OpCodes.Unpack32LE(this.h[i]);
        result.push(...bytes);
      }

      // Restore original state (so Result() can be called multiple times)
      this.h = originalH;
      this.buffer = originalBuffer;
      this.bufferLength = originalBufferLength;
      this.totalLength = originalTotalLength;

      return result;
    }

    _ProcessBlock(block) {
      // Convert block to 32-bit words (little-endian)
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

    _ProcessBlock128(X) {
      // RIPEMD-128 message word selection arrays
      const zl = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
        7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
        3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
        1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2
      ];

      const zr = [
        5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
        6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
        15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
        8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14
      ];

      const sl = [
        11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
        7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
        11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
        11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12
      ];

      const sr = [
        8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
        9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
        9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
        15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8
      ];

      const hl = [0x00000000, 0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC];
      const hr = [0x50A28BE6, 0x5C4DD124, 0x6D703EF3, 0x00000000];

      // Initialize working variables
      let al = this.h[0] | 0;
      let bl = this.h[1] | 0;
      let cl = this.h[2] | 0;
      let dl = this.h[3] | 0;

      let ar = this.h[0] | 0;
      let br = this.h[1] | 0;
      let cr = this.h[2] | 0;
      let dr = this.h[3] | 0;

      // Boolean functions
      const fn1 = (a, b, c, d, m, k, s) => {
        return OpCodes.RotL32((a + (b ^ c ^ d) + m + k) | 0, s) | 0;
      };

      const fn2 = (a, b, c, d, m, k, s) => {
        return OpCodes.RotL32((a + ((b & c) | (~b & d)) + m + k) | 0, s) | 0;
      };

      const fn3 = (a, b, c, d, m, k, s) => {
        return OpCodes.RotL32((a + ((b | ~c) ^ d) + m + k) | 0, s) | 0;
      };

      const fn4 = (a, b, c, d, m, k, s) => {
        return OpCodes.RotL32((a + ((b & d) | (c & ~d)) + m + k) | 0, s) | 0;
      };

      // 64 rounds computation
      for (let i = 0; i < 64; ++i) {
        let tl;
        let tr;

        if (i < 16) {
          tl = fn1(al, bl, cl, dl, X[zl[i]], hl[0], sl[i]);
          tr = fn4(ar, br, cr, dr, X[zr[i]], hr[0], sr[i]);
        } else if (i < 32) {
          tl = fn2(al, bl, cl, dl, X[zl[i]], hl[1], sl[i]);
          tr = fn3(ar, br, cr, dr, X[zr[i]], hr[1], sr[i]);
        } else if (i < 48) {
          tl = fn3(al, bl, cl, dl, X[zl[i]], hl[2], sl[i]);
          tr = fn2(ar, br, cr, dr, X[zr[i]], hr[2], sr[i]);
        } else {
          tl = fn4(al, bl, cl, dl, X[zl[i]], hl[3], sl[i]);
          tr = fn1(ar, br, cr, dr, X[zr[i]], hr[3], sr[i]);
        }

        al = dl;
        dl = cl;
        cl = bl;
        bl = tl;

        ar = dr;
        dr = cr;
        cr = br;
        br = tr;
      }

      // Update state
      const t = (this.h[1] + cl + dr) | 0;
      this.h[1] = (this.h[2] + dl + ar) | 0;
      this.h[2] = (this.h[3] + al + br) | 0;
      this.h[3] = (this.h[0] + bl + cr) | 0;
      this.h[0] = t;
    }

    _ProcessBlock160(X) {
      // RIPEMD-160 message word selection arrays
      const zl = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
        7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
        3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
        1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
        4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13
      ];

      const zr = [
        5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
        6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
        15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
        8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
        12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11
      ];

      const sl = [
        11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
        7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
        11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
        11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
        9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6
      ];

      const sr = [
        8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
        9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
        9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
        15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
        8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11
      ];

      const hl = [0x00000000, 0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xA953FD4E];
      const hr = [0x50A28BE6, 0x5C4DD124, 0x6D703EF3, 0x7A6D76E9, 0x00000000];

      // Initialize working variables
      let al = this.h[0] | 0;
      let bl = this.h[1] | 0;
      let cl = this.h[2] | 0;
      let dl = this.h[3] | 0;
      let el = this.h[4] | 0;

      let ar = this.h[0] | 0;
      let br = this.h[1] | 0;
      let cr = this.h[2] | 0;
      let dr = this.h[3] | 0;
      let er = this.h[4] | 0;

      // Boolean functions
      const fn1 = (a, b, c, d, e, m, k, s) => {
        return (OpCodes.RotL32((a + (b ^ c ^ d) + m + k) | 0, s) + e) | 0;
      };

      const fn2 = (a, b, c, d, e, m, k, s) => {
        return (OpCodes.RotL32((a + ((b & c) | (~b & d)) + m + k) | 0, s) + e) | 0;
      };

      const fn3 = (a, b, c, d, e, m, k, s) => {
        return (OpCodes.RotL32((a + ((b | ~c) ^ d) + m + k) | 0, s) + e) | 0;
      };

      const fn4 = (a, b, c, d, e, m, k, s) => {
        return (OpCodes.RotL32((a + ((b & d) | (c & ~d)) + m + k) | 0, s) + e) | 0;
      };

      const fn5 = (a, b, c, d, e, m, k, s) => {
        return (OpCodes.RotL32((a + (b ^ (c | ~d)) + m + k) | 0, s) + e) | 0;
      };

      // 80 rounds computation
      for (let i = 0; i < 80; ++i) {
        let tl;
        let tr;
        if (i < 16) {
          tl = fn1(al, bl, cl, dl, el, X[zl[i]], hl[0], sl[i]);
          tr = fn5(ar, br, cr, dr, er, X[zr[i]], hr[0], sr[i]);
        } else if (i < 32) {
          tl = fn2(al, bl, cl, dl, el, X[zl[i]], hl[1], sl[i]);
          tr = fn4(ar, br, cr, dr, er, X[zr[i]], hr[1], sr[i]);
        } else if (i < 48) {
          tl = fn3(al, bl, cl, dl, el, X[zl[i]], hl[2], sl[i]);
          tr = fn3(ar, br, cr, dr, er, X[zr[i]], hr[2], sr[i]);
        } else if (i < 64) {
          tl = fn4(al, bl, cl, dl, el, X[zl[i]], hl[3], sl[i]);
          tr = fn2(ar, br, cr, dr, er, X[zr[i]], hr[3], sr[i]);
        } else {
          tl = fn5(al, bl, cl, dl, el, X[zl[i]], hl[4], sl[i]);
          tr = fn1(ar, br, cr, dr, er, X[zr[i]], hr[4], sr[i]);
        }

        al = el;
        el = dl;
        dl = OpCodes.RotL32(cl, 10);
        cl = bl;
        bl = tl;

        ar = er;
        er = dr;
        dr = OpCodes.RotL32(cr, 10);
        cr = br;
        br = tr;
      }

      // Update state
      const t = (this.h[1] + cl + dr) | 0;
      this.h[1] = (this.h[2] + dl + er) | 0;
      this.h[2] = (this.h[3] + el + ar) | 0;
      this.h[3] = (this.h[4] + al + br) | 0;
      this.h[4] = (this.h[0] + bl + cr) | 0;
      this.h[0] = t;
    }

    _ProcessBlock256(X) {
      // Initialize working variables for both chains
      let a = this.h[0], b = this.h[1], c = this.h[2], d = this.h[3];
      let aa = this.h[4], bb = this.h[5], cc = this.h[6], dd = this.h[7];

      // Round 1: Left chain uses f1 (x^y^z), Right chain uses f4 ((x&z)|(y&~z))
      a = OpCodes.RotL32((a + (b ^ c ^ d) + X[0]) >>> 0, 11);
      d = OpCodes.RotL32((d + (a ^ b ^ c) + X[1]) >>> 0, 14);
      c = OpCodes.RotL32((c + (d ^ a ^ b) + X[2]) >>> 0, 15);
      b = OpCodes.RotL32((b + (c ^ d ^ a) + X[3]) >>> 0, 12);
      a = OpCodes.RotL32((a + (b ^ c ^ d) + X[4]) >>> 0, 5);
      d = OpCodes.RotL32((d + (a ^ b ^ c) + X[5]) >>> 0, 8);
      c = OpCodes.RotL32((c + (d ^ a ^ b) + X[6]) >>> 0, 7);
      b = OpCodes.RotL32((b + (c ^ d ^ a) + X[7]) >>> 0, 9);
      a = OpCodes.RotL32((a + (b ^ c ^ d) + X[8]) >>> 0, 11);
      d = OpCodes.RotL32((d + (a ^ b ^ c) + X[9]) >>> 0, 13);
      c = OpCodes.RotL32((c + (d ^ a ^ b) + X[10]) >>> 0, 14);
      b = OpCodes.RotL32((b + (c ^ d ^ a) + X[11]) >>> 0, 15);
      a = OpCodes.RotL32((a + (b ^ c ^ d) + X[12]) >>> 0, 6);
      d = OpCodes.RotL32((d + (a ^ b ^ c) + X[13]) >>> 0, 7);
      c = OpCodes.RotL32((c + (d ^ a ^ b) + X[14]) >>> 0, 9);
      b = OpCodes.RotL32((b + (c ^ d ^ a) + X[15]) >>> 0, 8);

      aa = OpCodes.RotL32((aa + ((bb & dd) | (cc & ~dd)) + X[5] + 0x50A28BE6) >>> 0, 8);
      dd = OpCodes.RotL32((dd + ((aa & cc) | (bb & ~cc)) + X[14] + 0x50A28BE6) >>> 0, 9);
      cc = OpCodes.RotL32((cc + ((dd & bb) | (aa & ~bb)) + X[7] + 0x50A28BE6) >>> 0, 9);
      bb = OpCodes.RotL32((bb + ((cc & aa) | (dd & ~aa)) + X[0] + 0x50A28BE6) >>> 0, 11);
      aa = OpCodes.RotL32((aa + ((bb & dd) | (cc & ~dd)) + X[9] + 0x50A28BE6) >>> 0, 13);
      dd = OpCodes.RotL32((dd + ((aa & cc) | (bb & ~cc)) + X[2] + 0x50A28BE6) >>> 0, 15);
      cc = OpCodes.RotL32((cc + ((dd & bb) | (aa & ~bb)) + X[11] + 0x50A28BE6) >>> 0, 15);
      bb = OpCodes.RotL32((bb + ((cc & aa) | (dd & ~aa)) + X[4] + 0x50A28BE6) >>> 0, 5);
      aa = OpCodes.RotL32((aa + ((bb & dd) | (cc & ~dd)) + X[13] + 0x50A28BE6) >>> 0, 7);
      dd = OpCodes.RotL32((dd + ((aa & cc) | (bb & ~cc)) + X[6] + 0x50A28BE6) >>> 0, 7);
      cc = OpCodes.RotL32((cc + ((dd & bb) | (aa & ~bb)) + X[15] + 0x50A28BE6) >>> 0, 8);
      bb = OpCodes.RotL32((bb + ((cc & aa) | (dd & ~aa)) + X[8] + 0x50A28BE6) >>> 0, 11);
      aa = OpCodes.RotL32((aa + ((bb & dd) | (cc & ~dd)) + X[1] + 0x50A28BE6) >>> 0, 14);
      dd = OpCodes.RotL32((dd + ((aa & cc) | (bb & ~cc)) + X[10] + 0x50A28BE6) >>> 0, 14);
      cc = OpCodes.RotL32((cc + ((dd & bb) | (aa & ~bb)) + X[3] + 0x50A28BE6) >>> 0, 12);
      bb = OpCodes.RotL32((bb + ((cc & aa) | (dd & ~aa)) + X[12] + 0x50A28BE6) >>> 0, 6);

      let t = a; a = aa; aa = t;

      // Round 2
      a = OpCodes.RotL32((a + ((b & c) | (~b & d)) + X[7] + 0x5A827999) >>> 0, 7);
      d = OpCodes.RotL32((d + ((a & b) | (~a & c)) + X[4] + 0x5A827999) >>> 0, 6);
      c = OpCodes.RotL32((c + ((d & a) | (~d & b)) + X[13] + 0x5A827999) >>> 0, 8);
      b = OpCodes.RotL32((b + ((c & d) | (~c & a)) + X[1] + 0x5A827999) >>> 0, 13);
      a = OpCodes.RotL32((a + ((b & c) | (~b & d)) + X[10] + 0x5A827999) >>> 0, 11);
      d = OpCodes.RotL32((d + ((a & b) | (~a & c)) + X[6] + 0x5A827999) >>> 0, 9);
      c = OpCodes.RotL32((c + ((d & a) | (~d & b)) + X[15] + 0x5A827999) >>> 0, 7);
      b = OpCodes.RotL32((b + ((c & d) | (~c & a)) + X[3] + 0x5A827999) >>> 0, 15);
      a = OpCodes.RotL32((a + ((b & c) | (~b & d)) + X[12] + 0x5A827999) >>> 0, 7);
      d = OpCodes.RotL32((d + ((a & b) | (~a & c)) + X[0] + 0x5A827999) >>> 0, 12);
      c = OpCodes.RotL32((c + ((d & a) | (~d & b)) + X[9] + 0x5A827999) >>> 0, 15);
      b = OpCodes.RotL32((b + ((c & d) | (~c & a)) + X[5] + 0x5A827999) >>> 0, 9);
      a = OpCodes.RotL32((a + ((b & c) | (~b & d)) + X[2] + 0x5A827999) >>> 0, 11);
      d = OpCodes.RotL32((d + ((a & b) | (~a & c)) + X[14] + 0x5A827999) >>> 0, 7);
      c = OpCodes.RotL32((c + ((d & a) | (~d & b)) + X[11] + 0x5A827999) >>> 0, 13);
      b = OpCodes.RotL32((b + ((c & d) | (~c & a)) + X[8] + 0x5A827999) >>> 0, 12);

      aa = OpCodes.RotL32((aa + ((bb | ~cc) ^ dd) + X[6] + 0x5C4DD124) >>> 0, 9);
      dd = OpCodes.RotL32((dd + ((aa | ~bb) ^ cc) + X[11] + 0x5C4DD124) >>> 0, 13);
      cc = OpCodes.RotL32((cc + ((dd | ~aa) ^ bb) + X[3] + 0x5C4DD124) >>> 0, 15);
      bb = OpCodes.RotL32((bb + ((cc | ~dd) ^ aa) + X[7] + 0x5C4DD124) >>> 0, 7);
      aa = OpCodes.RotL32((aa + ((bb | ~cc) ^ dd) + X[0] + 0x5C4DD124) >>> 0, 12);
      dd = OpCodes.RotL32((dd + ((aa | ~bb) ^ cc) + X[13] + 0x5C4DD124) >>> 0, 8);
      cc = OpCodes.RotL32((cc + ((dd | ~aa) ^ bb) + X[5] + 0x5C4DD124) >>> 0, 9);
      bb = OpCodes.RotL32((bb + ((cc | ~dd) ^ aa) + X[10] + 0x5C4DD124) >>> 0, 11);
      aa = OpCodes.RotL32((aa + ((bb | ~cc) ^ dd) + X[14] + 0x5C4DD124) >>> 0, 7);
      dd = OpCodes.RotL32((dd + ((aa | ~bb) ^ cc) + X[15] + 0x5C4DD124) >>> 0, 7);
      cc = OpCodes.RotL32((cc + ((dd | ~aa) ^ bb) + X[8] + 0x5C4DD124) >>> 0, 12);
      bb = OpCodes.RotL32((bb + ((cc | ~dd) ^ aa) + X[12] + 0x5C4DD124) >>> 0, 7);
      aa = OpCodes.RotL32((aa + ((bb | ~cc) ^ dd) + X[4] + 0x5C4DD124) >>> 0, 6);
      dd = OpCodes.RotL32((dd + ((aa | ~bb) ^ cc) + X[9] + 0x5C4DD124) >>> 0, 15);
      cc = OpCodes.RotL32((cc + ((dd | ~aa) ^ bb) + X[1] + 0x5C4DD124) >>> 0, 13);
      bb = OpCodes.RotL32((bb + ((cc | ~dd) ^ aa) + X[2] + 0x5C4DD124) >>> 0, 11);

      t = b; b = bb; bb = t;

      // Round 3
      a = OpCodes.RotL32((a + ((b | ~c) ^ d) + X[3] + 0x6ED9EBA1) >>> 0, 11);
      d = OpCodes.RotL32((d + ((a | ~b) ^ c) + X[10] + 0x6ED9EBA1) >>> 0, 13);
      c = OpCodes.RotL32((c + ((d | ~a) ^ b) + X[14] + 0x6ED9EBA1) >>> 0, 6);
      b = OpCodes.RotL32((b + ((c | ~d) ^ a) + X[4] + 0x6ED9EBA1) >>> 0, 7);
      a = OpCodes.RotL32((a + ((b | ~c) ^ d) + X[9] + 0x6ED9EBA1) >>> 0, 14);
      d = OpCodes.RotL32((d + ((a | ~b) ^ c) + X[15] + 0x6ED9EBA1) >>> 0, 9);
      c = OpCodes.RotL32((c + ((d | ~a) ^ b) + X[8] + 0x6ED9EBA1) >>> 0, 13);
      b = OpCodes.RotL32((b + ((c | ~d) ^ a) + X[1] + 0x6ED9EBA1) >>> 0, 15);
      a = OpCodes.RotL32((a + ((b | ~c) ^ d) + X[2] + 0x6ED9EBA1) >>> 0, 14);
      d = OpCodes.RotL32((d + ((a | ~b) ^ c) + X[7] + 0x6ED9EBA1) >>> 0, 8);
      c = OpCodes.RotL32((c + ((d | ~a) ^ b) + X[0] + 0x6ED9EBA1) >>> 0, 13);
      b = OpCodes.RotL32((b + ((c | ~d) ^ a) + X[6] + 0x6ED9EBA1) >>> 0, 6);
      a = OpCodes.RotL32((a + ((b | ~c) ^ d) + X[13] + 0x6ED9EBA1) >>> 0, 5);
      d = OpCodes.RotL32((d + ((a | ~b) ^ c) + X[11] + 0x6ED9EBA1) >>> 0, 12);
      c = OpCodes.RotL32((c + ((d | ~a) ^ b) + X[5] + 0x6ED9EBA1) >>> 0, 7);
      b = OpCodes.RotL32((b + ((c | ~d) ^ a) + X[12] + 0x6ED9EBA1) >>> 0, 5);

      aa = OpCodes.RotL32((aa + ((bb & cc) | (~bb & dd)) + X[15] + 0x6D703EF3) >>> 0, 9);
      dd = OpCodes.RotL32((dd + ((aa & bb) | (~aa & cc)) + X[5] + 0x6D703EF3) >>> 0, 7);
      cc = OpCodes.RotL32((cc + ((dd & aa) | (~dd & bb)) + X[1] + 0x6D703EF3) >>> 0, 15);
      bb = OpCodes.RotL32((bb + ((cc & dd) | (~cc & aa)) + X[3] + 0x6D703EF3) >>> 0, 11);
      aa = OpCodes.RotL32((aa + ((bb & cc) | (~bb & dd)) + X[7] + 0x6D703EF3) >>> 0, 8);
      dd = OpCodes.RotL32((dd + ((aa & bb) | (~aa & cc)) + X[14] + 0x6D703EF3) >>> 0, 6);
      cc = OpCodes.RotL32((cc + ((dd & aa) | (~dd & bb)) + X[6] + 0x6D703EF3) >>> 0, 6);
      bb = OpCodes.RotL32((bb + ((cc & dd) | (~cc & aa)) + X[9] + 0x6D703EF3) >>> 0, 14);
      aa = OpCodes.RotL32((aa + ((bb & cc) | (~bb & dd)) + X[11] + 0x6D703EF3) >>> 0, 12);
      dd = OpCodes.RotL32((dd + ((aa & bb) | (~aa & cc)) + X[8] + 0x6D703EF3) >>> 0, 13);
      cc = OpCodes.RotL32((cc + ((dd & aa) | (~dd & bb)) + X[12] + 0x6D703EF3) >>> 0, 5);
      bb = OpCodes.RotL32((bb + ((cc & dd) | (~cc & aa)) + X[2] + 0x6D703EF3) >>> 0, 14);
      aa = OpCodes.RotL32((aa + ((bb & cc) | (~bb & dd)) + X[10] + 0x6D703EF3) >>> 0, 13);
      dd = OpCodes.RotL32((dd + ((aa & bb) | (~aa & cc)) + X[0] + 0x6D703EF3) >>> 0, 13);
      cc = OpCodes.RotL32((cc + ((dd & aa) | (~dd & bb)) + X[4] + 0x6D703EF3) >>> 0, 7);
      bb = OpCodes.RotL32((bb + ((cc & dd) | (~cc & aa)) + X[13] + 0x6D703EF3) >>> 0, 5);

      t = c; c = cc; cc = t;

      // Round 4
      a = OpCodes.RotL32((a + ((b & d) | (c & ~d)) + X[1] + 0x8F1BBCDC) >>> 0, 11);
      d = OpCodes.RotL32((d + ((a & c) | (b & ~c)) + X[9] + 0x8F1BBCDC) >>> 0, 12);
      c = OpCodes.RotL32((c + ((d & b) | (a & ~b)) + X[11] + 0x8F1BBCDC) >>> 0, 14);
      b = OpCodes.RotL32((b + ((c & a) | (d & ~a)) + X[10] + 0x8F1BBCDC) >>> 0, 15);
      a = OpCodes.RotL32((a + ((b & d) | (c & ~d)) + X[0] + 0x8F1BBCDC) >>> 0, 14);
      d = OpCodes.RotL32((d + ((a & c) | (b & ~c)) + X[8] + 0x8F1BBCDC) >>> 0, 15);
      c = OpCodes.RotL32((c + ((d & b) | (a & ~b)) + X[12] + 0x8F1BBCDC) >>> 0, 9);
      b = OpCodes.RotL32((b + ((c & a) | (d & ~a)) + X[4] + 0x8F1BBCDC) >>> 0, 8);
      a = OpCodes.RotL32((a + ((b & d) | (c & ~d)) + X[13] + 0x8F1BBCDC) >>> 0, 9);
      d = OpCodes.RotL32((d + ((a & c) | (b & ~c)) + X[3] + 0x8F1BBCDC) >>> 0, 14);
      c = OpCodes.RotL32((c + ((d & b) | (a & ~b)) + X[7] + 0x8F1BBCDC) >>> 0, 5);
      b = OpCodes.RotL32((b + ((c & a) | (d & ~a)) + X[15] + 0x8F1BBCDC) >>> 0, 6);
      a = OpCodes.RotL32((a + ((b & d) | (c & ~d)) + X[14] + 0x8F1BBCDC) >>> 0, 8);
      d = OpCodes.RotL32((d + ((a & c) | (b & ~c)) + X[5] + 0x8F1BBCDC) >>> 0, 6);
      c = OpCodes.RotL32((c + ((d & b) | (a & ~b)) + X[6] + 0x8F1BBCDC) >>> 0, 5);
      b = OpCodes.RotL32((b + ((c & a) | (d & ~a)) + X[2] + 0x8F1BBCDC) >>> 0, 12);

      aa = OpCodes.RotL32((aa + (bb ^ cc ^ dd) + X[8]) >>> 0, 15);
      dd = OpCodes.RotL32((dd + (aa ^ bb ^ cc) + X[6]) >>> 0, 5);
      cc = OpCodes.RotL32((cc + (dd ^ aa ^ bb) + X[4]) >>> 0, 8);
      bb = OpCodes.RotL32((bb + (cc ^ dd ^ aa) + X[1]) >>> 0, 11);
      aa = OpCodes.RotL32((aa + (bb ^ cc ^ dd) + X[3]) >>> 0, 14);
      dd = OpCodes.RotL32((dd + (aa ^ bb ^ cc) + X[11]) >>> 0, 14);
      cc = OpCodes.RotL32((cc + (dd ^ aa ^ bb) + X[15]) >>> 0, 6);
      bb = OpCodes.RotL32((bb + (cc ^ dd ^ aa) + X[0]) >>> 0, 14);
      aa = OpCodes.RotL32((aa + (bb ^ cc ^ dd) + X[5]) >>> 0, 6);
      dd = OpCodes.RotL32((dd + (aa ^ bb ^ cc) + X[12]) >>> 0, 9);
      cc = OpCodes.RotL32((cc + (dd ^ aa ^ bb) + X[2]) >>> 0, 12);
      bb = OpCodes.RotL32((bb + (cc ^ dd ^ aa) + X[13]) >>> 0, 9);
      aa = OpCodes.RotL32((aa + (bb ^ cc ^ dd) + X[9]) >>> 0, 12);
      dd = OpCodes.RotL32((dd + (aa ^ bb ^ cc) + X[7]) >>> 0, 5);
      cc = OpCodes.RotL32((cc + (dd ^ aa ^ bb) + X[10]) >>> 0, 15);
      bb = OpCodes.RotL32((bb + (cc ^ dd ^ aa) + X[14]) >>> 0, 8);

      t = d; d = dd; dd = t;

      // Update hash values - SEPARATE updates (not combined like RIPEMD-160)
      this.h[0] = (this.h[0] + a) >>> 0;
      this.h[1] = (this.h[1] + b) >>> 0;
      this.h[2] = (this.h[2] + c) >>> 0;
      this.h[3] = (this.h[3] + d) >>> 0;
      this.h[4] = (this.h[4] + aa) >>> 0;
      this.h[5] = (this.h[5] + bb) >>> 0;
      this.h[6] = (this.h[6] + cc) >>> 0;
      this.h[7] = (this.h[7] + dd) >>> 0;
    }

    _ProcessBlock320(X) {
      // RIPEMD auxiliary functions
      const f1 = (x, y, z) => x ^ y ^ z;
      const f2 = (x, y, z) => (x & y) | (~x & z);
      const f3 = (x, y, z) => (x | ~y) ^ z;
      const f4 = (x, y, z) => (x & z) | (y & ~z);
      const f5 = (x, y, z) => x ^ (y | ~z);

      const RL = (x, n) => OpCodes.RotL32(x, n);

      // Initialize working variables
      let a = this.h[0];
      let b = this.h[1];
      let c = this.h[2];
      let d = this.h[3];
      let e = this.h[4];
      let aa = this.h[5];
      let bb = this.h[6];
      let cc = this.h[7];
      let dd = this.h[8];
      let ee = this.h[9];

      let t; // temp for swaps

      // Round 1-16 (left: f1, right: f5)
      a = (RL((a + f1(b,c,d) + X[ 0]) | 0, 11) + e) | 0; c = RL(c, 10);
      e = (RL((e + f1(a,b,c) + X[ 1]) | 0, 14) + d) | 0; b = RL(b, 10);
      d = (RL((d + f1(e,a,b) + X[ 2]) | 0, 15) + c) | 0; a = RL(a, 10);
      c = (RL((c + f1(d,e,a) + X[ 3]) | 0, 12) + b) | 0; e = RL(e, 10);
      b = (RL((b + f1(c,d,e) + X[ 4]) | 0,  5) + a) | 0; d = RL(d, 10);
      a = (RL((a + f1(b,c,d) + X[ 5]) | 0,  8) + e) | 0; c = RL(c, 10);
      e = (RL((e + f1(a,b,c) + X[ 6]) | 0,  7) + d) | 0; b = RL(b, 10);
      d = (RL((d + f1(e,a,b) + X[ 7]) | 0,  9) + c) | 0; a = RL(a, 10);
      c = (RL((c + f1(d,e,a) + X[ 8]) | 0, 11) + b) | 0; e = RL(e, 10);
      b = (RL((b + f1(c,d,e) + X[ 9]) | 0, 13) + a) | 0; d = RL(d, 10);
      a = (RL((a + f1(b,c,d) + X[10]) | 0, 14) + e) | 0; c = RL(c, 10);
      e = (RL((e + f1(a,b,c) + X[11]) | 0, 15) + d) | 0; b = RL(b, 10);
      d = (RL((d + f1(e,a,b) + X[12]) | 0,  6) + c) | 0; a = RL(a, 10);
      c = (RL((c + f1(d,e,a) + X[13]) | 0,  7) + b) | 0; e = RL(e, 10);
      b = (RL((b + f1(c,d,e) + X[14]) | 0,  9) + a) | 0; d = RL(d, 10);
      a = (RL((a + f1(b,c,d) + X[15]) | 0,  8) + e) | 0; c = RL(c, 10);

      aa = (RL((aa + f5(bb,cc,dd) + X[ 5] + 0x50a28be6) | 0,  8) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f5(aa,bb,cc) + X[14] + 0x50a28be6) | 0,  9) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f5(ee,aa,bb) + X[ 7] + 0x50a28be6) | 0,  9) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f5(dd,ee,aa) + X[ 0] + 0x50a28be6) | 0, 11) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f5(cc,dd,ee) + X[ 9] + 0x50a28be6) | 0, 13) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f5(bb,cc,dd) + X[ 2] + 0x50a28be6) | 0, 15) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f5(aa,bb,cc) + X[11] + 0x50a28be6) | 0, 15) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f5(ee,aa,bb) + X[ 4] + 0x50a28be6) | 0,  5) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f5(dd,ee,aa) + X[13] + 0x50a28be6) | 0,  7) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f5(cc,dd,ee) + X[ 6] + 0x50a28be6) | 0,  7) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f5(bb,cc,dd) + X[15] + 0x50a28be6) | 0,  8) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f5(aa,bb,cc) + X[ 8] + 0x50a28be6) | 0, 11) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f5(ee,aa,bb) + X[ 1] + 0x50a28be6) | 0, 14) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f5(dd,ee,aa) + X[10] + 0x50a28be6) | 0, 14) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f5(cc,dd,ee) + X[ 3] + 0x50a28be6) | 0, 12) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f5(bb,cc,dd) + X[12] + 0x50a28be6) | 0,  6) + ee) | 0; cc = RL(cc, 10);

      t = a; a = aa; aa = t;

      // Round 17-32 (left: f2, right: f4)
      e = (RL((e + f2(a,b,c) + X[ 7] + 0x5a827999) | 0,  7) + d) | 0; b = RL(b, 10);
      d = (RL((d + f2(e,a,b) + X[ 4] + 0x5a827999) | 0,  6) + c) | 0; a = RL(a, 10);
      c = (RL((c + f2(d,e,a) + X[13] + 0x5a827999) | 0,  8) + b) | 0; e = RL(e, 10);
      b = (RL((b + f2(c,d,e) + X[ 1] + 0x5a827999) | 0, 13) + a) | 0; d = RL(d, 10);
      a = (RL((a + f2(b,c,d) + X[10] + 0x5a827999) | 0, 11) + e) | 0; c = RL(c, 10);
      e = (RL((e + f2(a,b,c) + X[ 6] + 0x5a827999) | 0,  9) + d) | 0; b = RL(b, 10);
      d = (RL((d + f2(e,a,b) + X[15] + 0x5a827999) | 0,  7) + c) | 0; a = RL(a, 10);
      c = (RL((c + f2(d,e,a) + X[ 3] + 0x5a827999) | 0, 15) + b) | 0; e = RL(e, 10);
      b = (RL((b + f2(c,d,e) + X[12] + 0x5a827999) | 0,  7) + a) | 0; d = RL(d, 10);
      a = (RL((a + f2(b,c,d) + X[ 0] + 0x5a827999) | 0, 12) + e) | 0; c = RL(c, 10);
      e = (RL((e + f2(a,b,c) + X[ 9] + 0x5a827999) | 0, 15) + d) | 0; b = RL(b, 10);
      d = (RL((d + f2(e,a,b) + X[ 5] + 0x5a827999) | 0,  9) + c) | 0; a = RL(a, 10);
      c = (RL((c + f2(d,e,a) + X[ 2] + 0x5a827999) | 0, 11) + b) | 0; e = RL(e, 10);
      b = (RL((b + f2(c,d,e) + X[14] + 0x5a827999) | 0,  7) + a) | 0; d = RL(d, 10);
      a = (RL((a + f2(b,c,d) + X[11] + 0x5a827999) | 0, 13) + e) | 0; c = RL(c, 10);
      e = (RL((e + f2(a,b,c) + X[ 8] + 0x5a827999) | 0, 12) + d) | 0; b = RL(b, 10);

      ee = (RL((ee + f4(aa,bb,cc) + X[ 6] + 0x5c4dd124) | 0,  9) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f4(ee,aa,bb) + X[11] + 0x5c4dd124) | 0, 13) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f4(dd,ee,aa) + X[ 3] + 0x5c4dd124) | 0, 15) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f4(cc,dd,ee) + X[ 7] + 0x5c4dd124) | 0,  7) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f4(bb,cc,dd) + X[ 0] + 0x5c4dd124) | 0, 12) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f4(aa,bb,cc) + X[13] + 0x5c4dd124) | 0,  8) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f4(ee,aa,bb) + X[ 5] + 0x5c4dd124) | 0,  9) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f4(dd,ee,aa) + X[10] + 0x5c4dd124) | 0, 11) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f4(cc,dd,ee) + X[14] + 0x5c4dd124) | 0,  7) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f4(bb,cc,dd) + X[15] + 0x5c4dd124) | 0,  7) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f4(aa,bb,cc) + X[ 8] + 0x5c4dd124) | 0, 12) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f4(ee,aa,bb) + X[12] + 0x5c4dd124) | 0,  7) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f4(dd,ee,aa) + X[ 4] + 0x5c4dd124) | 0,  6) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f4(cc,dd,ee) + X[ 9] + 0x5c4dd124) | 0, 15) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f4(bb,cc,dd) + X[ 1] + 0x5c4dd124) | 0, 13) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f4(aa,bb,cc) + X[ 2] + 0x5c4dd124) | 0, 11) + dd) | 0; bb = RL(bb, 10);

      t = b; b = bb; bb = t;

      // Round 33-48 (left: f3, right: f3)
      d = (RL((d + f3(e,a,b) + X[ 3] + 0x6ed9eba1) | 0, 11) + c) | 0; a = RL(a, 10);
      c = (RL((c + f3(d,e,a) + X[10] + 0x6ed9eba1) | 0, 13) + b) | 0; e = RL(e, 10);
      b = (RL((b + f3(c,d,e) + X[14] + 0x6ed9eba1) | 0,  6) + a) | 0; d = RL(d, 10);
      a = (RL((a + f3(b,c,d) + X[ 4] + 0x6ed9eba1) | 0,  7) + e) | 0; c = RL(c, 10);
      e = (RL((e + f3(a,b,c) + X[ 9] + 0x6ed9eba1) | 0, 14) + d) | 0; b = RL(b, 10);
      d = (RL((d + f3(e,a,b) + X[15] + 0x6ed9eba1) | 0,  9) + c) | 0; a = RL(a, 10);
      c = (RL((c + f3(d,e,a) + X[ 8] + 0x6ed9eba1) | 0, 13) + b) | 0; e = RL(e, 10);
      b = (RL((b + f3(c,d,e) + X[ 1] + 0x6ed9eba1) | 0, 15) + a) | 0; d = RL(d, 10);
      a = (RL((a + f3(b,c,d) + X[ 2] + 0x6ed9eba1) | 0, 14) + e) | 0; c = RL(c, 10);
      e = (RL((e + f3(a,b,c) + X[ 7] + 0x6ed9eba1) | 0,  8) + d) | 0; b = RL(b, 10);
      d = (RL((d + f3(e,a,b) + X[ 0] + 0x6ed9eba1) | 0, 13) + c) | 0; a = RL(a, 10);
      c = (RL((c + f3(d,e,a) + X[ 6] + 0x6ed9eba1) | 0,  6) + b) | 0; e = RL(e, 10);
      b = (RL((b + f3(c,d,e) + X[13] + 0x6ed9eba1) | 0,  5) + a) | 0; d = RL(d, 10);
      a = (RL((a + f3(b,c,d) + X[11] + 0x6ed9eba1) | 0, 12) + e) | 0; c = RL(c, 10);
      e = (RL((e + f3(a,b,c) + X[ 5] + 0x6ed9eba1) | 0,  7) + d) | 0; b = RL(b, 10);
      d = (RL((d + f3(e,a,b) + X[12] + 0x6ed9eba1) | 0,  5) + c) | 0; a = RL(a, 10);

      dd = (RL((dd + f3(ee,aa,bb) + X[15] + 0x6d703ef3) | 0,  9) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f3(dd,ee,aa) + X[ 5] + 0x6d703ef3) | 0,  7) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f3(cc,dd,ee) + X[ 1] + 0x6d703ef3) | 0, 15) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f3(bb,cc,dd) + X[ 3] + 0x6d703ef3) | 0, 11) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f3(aa,bb,cc) + X[ 7] + 0x6d703ef3) | 0,  8) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f3(ee,aa,bb) + X[14] + 0x6d703ef3) | 0,  6) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f3(dd,ee,aa) + X[ 6] + 0x6d703ef3) | 0,  6) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f3(cc,dd,ee) + X[ 9] + 0x6d703ef3) | 0, 14) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f3(bb,cc,dd) + X[11] + 0x6d703ef3) | 0, 12) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f3(aa,bb,cc) + X[ 8] + 0x6d703ef3) | 0, 13) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f3(ee,aa,bb) + X[12] + 0x6d703ef3) | 0,  5) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f3(dd,ee,aa) + X[ 2] + 0x6d703ef3) | 0, 14) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f3(cc,dd,ee) + X[10] + 0x6d703ef3) | 0, 13) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f3(bb,cc,dd) + X[ 0] + 0x6d703ef3) | 0, 13) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f3(aa,bb,cc) + X[ 4] + 0x6d703ef3) | 0,  7) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f3(ee,aa,bb) + X[13] + 0x6d703ef3) | 0,  5) + cc) | 0; aa = RL(aa, 10);

      t = c; c = cc; cc = t;

      // Round 49-64 (left: f4, right: f2)
      c = (RL((c + f4(d,e,a) + X[ 1] + 0x8f1bbcdc) | 0, 11) + b) | 0; e = RL(e, 10);
      b = (RL((b + f4(c,d,e) + X[ 9] + 0x8f1bbcdc) | 0, 12) + a) | 0; d = RL(d, 10);
      a = (RL((a + f4(b,c,d) + X[11] + 0x8f1bbcdc) | 0, 14) + e) | 0; c = RL(c, 10);
      e = (RL((e + f4(a,b,c) + X[10] + 0x8f1bbcdc) | 0, 15) + d) | 0; b = RL(b, 10);
      d = (RL((d + f4(e,a,b) + X[ 0] + 0x8f1bbcdc) | 0, 14) + c) | 0; a = RL(a, 10);
      c = (RL((c + f4(d,e,a) + X[ 8] + 0x8f1bbcdc) | 0, 15) + b) | 0; e = RL(e, 10);
      b = (RL((b + f4(c,d,e) + X[12] + 0x8f1bbcdc) | 0,  9) + a) | 0; d = RL(d, 10);
      a = (RL((a + f4(b,c,d) + X[ 4] + 0x8f1bbcdc) | 0,  8) + e) | 0; c = RL(c, 10);
      e = (RL((e + f4(a,b,c) + X[13] + 0x8f1bbcdc) | 0,  9) + d) | 0; b = RL(b, 10);
      d = (RL((d + f4(e,a,b) + X[ 3] + 0x8f1bbcdc) | 0, 14) + c) | 0; a = RL(a, 10);
      c = (RL((c + f4(d,e,a) + X[ 7] + 0x8f1bbcdc) | 0,  5) + b) | 0; e = RL(e, 10);
      b = (RL((b + f4(c,d,e) + X[15] + 0x8f1bbcdc) | 0,  6) + a) | 0; d = RL(d, 10);
      a = (RL((a + f4(b,c,d) + X[14] + 0x8f1bbcdc) | 0,  8) + e) | 0; c = RL(c, 10);
      e = (RL((e + f4(a,b,c) + X[ 5] + 0x8f1bbcdc) | 0,  6) + d) | 0; b = RL(b, 10);
      d = (RL((d + f4(e,a,b) + X[ 6] + 0x8f1bbcdc) | 0,  5) + c) | 0; a = RL(a, 10);
      c = (RL((c + f4(d,e,a) + X[ 2] + 0x8f1bbcdc) | 0, 12) + b) | 0; e = RL(e, 10);

      cc = (RL((cc + f2(dd,ee,aa) + X[ 8] + 0x7a6d76e9) | 0, 15) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f2(cc,dd,ee) + X[ 6] + 0x7a6d76e9) | 0,  5) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f2(bb,cc,dd) + X[ 4] + 0x7a6d76e9) | 0,  8) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f2(aa,bb,cc) + X[ 1] + 0x7a6d76e9) | 0, 11) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f2(ee,aa,bb) + X[ 3] + 0x7a6d76e9) | 0, 14) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f2(dd,ee,aa) + X[11] + 0x7a6d76e9) | 0, 14) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f2(cc,dd,ee) + X[15] + 0x7a6d76e9) | 0,  6) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f2(bb,cc,dd) + X[ 0] + 0x7a6d76e9) | 0, 14) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f2(aa,bb,cc) + X[ 5] + 0x7a6d76e9) | 0,  6) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f2(ee,aa,bb) + X[12] + 0x7a6d76e9) | 0,  9) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f2(dd,ee,aa) + X[ 2] + 0x7a6d76e9) | 0, 12) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f2(cc,dd,ee) + X[13] + 0x7a6d76e9) | 0,  9) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f2(bb,cc,dd) + X[ 9] + 0x7a6d76e9) | 0, 12) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f2(aa,bb,cc) + X[ 7] + 0x7a6d76e9) | 0,  5) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f2(ee,aa,bb) + X[10] + 0x7a6d76e9) | 0, 15) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f2(dd,ee,aa) + X[14] + 0x7a6d76e9) | 0,  8) + bb) | 0; ee = RL(ee, 10);

      t = d; d = dd; dd = t;

      // Round 65-80 (left: f5, right: f1)
      b = (RL((b + f5(c,d,e) + X[ 4] + 0xa953fd4e) | 0,  9) + a) | 0; d = RL(d, 10);
      a = (RL((a + f5(b,c,d) + X[ 0] + 0xa953fd4e) | 0, 15) + e) | 0; c = RL(c, 10);
      e = (RL((e + f5(a,b,c) + X[ 5] + 0xa953fd4e) | 0,  5) + d) | 0; b = RL(b, 10);
      d = (RL((d + f5(e,a,b) + X[ 9] + 0xa953fd4e) | 0, 11) + c) | 0; a = RL(a, 10);
      c = (RL((c + f5(d,e,a) + X[ 7] + 0xa953fd4e) | 0,  6) + b) | 0; e = RL(e, 10);
      b = (RL((b + f5(c,d,e) + X[12] + 0xa953fd4e) | 0,  8) + a) | 0; d = RL(d, 10);
      a = (RL((a + f5(b,c,d) + X[ 2] + 0xa953fd4e) | 0, 13) + e) | 0; c = RL(c, 10);
      e = (RL((e + f5(a,b,c) + X[10] + 0xa953fd4e) | 0, 12) + d) | 0; b = RL(b, 10);
      d = (RL((d + f5(e,a,b) + X[14] + 0xa953fd4e) | 0,  5) + c) | 0; a = RL(a, 10);
      c = (RL((c + f5(d,e,a) + X[ 1] + 0xa953fd4e) | 0, 12) + b) | 0; e = RL(e, 10);
      b = (RL((b + f5(c,d,e) + X[ 3] + 0xa953fd4e) | 0, 13) + a) | 0; d = RL(d, 10);
      a = (RL((a + f5(b,c,d) + X[ 8] + 0xa953fd4e) | 0, 14) + e) | 0; c = RL(c, 10);
      e = (RL((e + f5(a,b,c) + X[11] + 0xa953fd4e) | 0, 11) + d) | 0; b = RL(b, 10);
      d = (RL((d + f5(e,a,b) + X[ 6] + 0xa953fd4e) | 0,  8) + c) | 0; a = RL(a, 10);
      c = (RL((c + f5(d,e,a) + X[15] + 0xa953fd4e) | 0,  5) + b) | 0; e = RL(e, 10);
      b = (RL((b + f5(c,d,e) + X[13] + 0xa953fd4e) | 0,  6) + a) | 0; d = RL(d, 10);

      bb = (RL((bb + f1(cc,dd,ee) + X[12]) | 0,  8) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f1(bb,cc,dd) + X[15]) | 0,  5) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f1(aa,bb,cc) + X[10]) | 0, 12) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f1(ee,aa,bb) + X[ 4]) | 0,  9) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f1(dd,ee,aa) + X[ 1]) | 0, 12) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f1(cc,dd,ee) + X[ 5]) | 0,  5) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f1(bb,cc,dd) + X[ 8]) | 0, 14) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f1(aa,bb,cc) + X[ 7]) | 0,  6) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f1(ee,aa,bb) + X[ 6]) | 0,  8) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f1(dd,ee,aa) + X[ 2]) | 0, 13) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f1(cc,dd,ee) + X[13]) | 0,  6) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f1(bb,cc,dd) + X[14]) | 0,  5) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f1(aa,bb,cc) + X[ 0]) | 0, 15) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f1(ee,aa,bb) + X[ 3]) | 0, 13) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f1(dd,ee,aa) + X[ 9]) | 0, 11) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f1(cc,dd,ee) + X[11]) | 0, 11) + aa) | 0; dd = RL(dd, 10);

      // Update state
      this.h[0] = (this.h[0] + a) | 0;
      this.h[1] = (this.h[1] + b) | 0;
      this.h[2] = (this.h[2] + c) | 0;
      this.h[3] = (this.h[3] + d) | 0;
      this.h[4] = (this.h[4] + ee) | 0;
      this.h[5] = (this.h[5] + aa) | 0;
      this.h[6] = (this.h[6] + bb) | 0;
      this.h[7] = (this.h[7] + cc) | 0;
      this.h[8] = (this.h[8] + dd) | 0;
      this.h[9] = (this.h[9] + e) | 0;
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
   * @returns {Object} New cipher instance
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
   * @returns {Object} New cipher instance
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
   * @returns {Object} New cipher instance
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
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new RIPEMDInstance(this, 320);
    }
  }

  // ===== REGISTRATION =====

  const algorithms = [
    new RIPEMD128Algorithm(),
    new RIPEMD160Algorithm(),
    new RIPEMD256Algorithm(),
    new RIPEMD320Algorithm()
  ];

  algorithms.forEach(algo => {
    if (!AlgorithmFramework.Find(algo.name)) {
      RegisterAlgorithm(algo);
    }
  });

  // ===== EXPORTS =====

  return {
    RIPEMDInstance,
    RIPEMD128Algorithm,
    RIPEMD160Algorithm,
    RIPEMD256Algorithm,
    RIPEMD320Algorithm
  };
}));
