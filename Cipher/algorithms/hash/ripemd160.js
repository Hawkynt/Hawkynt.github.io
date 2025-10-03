/*
 * RIPEMD-160 Hash Function - Universal AlgorithmFramework Implementation
 * Fixed implementation based on working npm ripemd160 package
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

  class RIPEMD160Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.OutputSize = 20; // 160 bits
      this._Reset();
    }

    _Reset() {
      // RIPEMD-160 initialization values (same as MD4/MD5)
      this.h = new Uint32Array([
        0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0
      ]);

      this.buffer = new Uint8Array(64);
      this.bufferLength = 0;
      this.totalLength = 0;
    }

    Initialize() {
      this._Reset();
    }

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
      // Pack as 64-bit little-endian (low 32 bits first, then high 32 bits)
      padding[padLength] = bitLength & 0xFF;
      padding[padLength + 1] = (bitLength >>> 8) & 0xFF;
      padding[padLength + 2] = (bitLength >>> 16) & 0xFF;
      padding[padLength + 3] = (bitLength >>> 24) & 0xFF;
      // For practical message sizes, high 32 bits are always 0
      padding[padLength + 4] = 0;
      padding[padLength + 5] = 0;
      padding[padLength + 6] = 0;
      padding[padLength + 7] = 0;

      this.Feed(padding);

      // Convert hash to bytes (little-endian)
      const result = [];
      for (let i = 0; i < 5; i++) {
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
      const words = new Array(16);
      for (let i = 0; i < 16; i++) {
        words[i] = OpCodes.Pack32LE(block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]);
      }

      // RIPEMD-160 message word selection arrays (from working npm implementation)
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

      // RIPEMD-160 rotation amounts (from working npm implementation)
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

      // RIPEMD-160 constants (from working npm implementation)
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

      // RIPEMD-160 Boolean functions (matching npm implementation exactly)
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

      // 80 rounds computation (exactly matching npm implementation)
      for (let i = 0; i < 80; i += 1) {
        let tl;
        let tr;
        if (i < 16) {
          tl = fn1(al, bl, cl, dl, el, words[zl[i]], hl[0], sl[i]);
          tr = fn5(ar, br, cr, dr, er, words[zr[i]], hr[0], sr[i]);
        } else if (i < 32) {
          tl = fn2(al, bl, cl, dl, el, words[zl[i]], hl[1], sl[i]);
          tr = fn4(ar, br, cr, dr, er, words[zr[i]], hr[1], sr[i]);
        } else if (i < 48) {
          tl = fn3(al, bl, cl, dl, el, words[zl[i]], hl[2], sl[i]);
          tr = fn3(ar, br, cr, dr, er, words[zr[i]], hr[2], sr[i]);
        } else if (i < 64) {
          tl = fn4(al, bl, cl, dl, el, words[zl[i]], hl[3], sl[i]);
          tr = fn2(ar, br, cr, dr, er, words[zr[i]], hr[3], sr[i]);
        } else { // if (i<80)
          tl = fn5(al, bl, cl, dl, el, words[zl[i]], hl[4], sl[i]);
          tr = fn1(ar, br, cr, dr, er, words[zr[i]], hr[4], sr[i]);
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

      // Update state (exactly matching npm implementation)
      const t = (this.h[1] + cl + dr) | 0;
      this.h[1] = (this.h[2] + dl + er) | 0;
      this.h[2] = (this.h[3] + el + ar) | 0;
      this.h[3] = (this.h[4] + al + br) | 0;
      this.h[4] = (this.h[0] + bl + cr) | 0;
      this.h[0] = t;
    }
  }

  class RIPEMD160Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "RIPEMD-160";
      this.description = "RACE Integrity Primitives Evaluation Message Digest with 160-bit output. Developed as a European alternative to SHA-1 with different design principles. Produces a 160-bit hash digest.";
      this.inventor = "Hans Dobbertin, Antoon Bosselaers, Bart Preneel";
      this.year = 1996;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      // Documentation and references
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

      // Test vectors from official RIPEMD-160 specification
      this.tests = [
        {
          input: [],
          expected: OpCodes.Hex8ToBytes("9c1185a5c5e9fc54612808977ee8f548b2258d31"),
          text: "Empty string test vector",
          uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"
        },
        {
          input: OpCodes.AnsiToBytes("a"),
          expected: OpCodes.Hex8ToBytes("0bdc9d2d256b3ee9daae347be6f4dc835a467ffe"),
          text: "Single character 'a' test vector",
          uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"
        },
        {
          input: OpCodes.AnsiToBytes("abc"),
          expected: OpCodes.Hex8ToBytes("8eb208f7e05d987a9b044a8e98c6b087f15a0bfc"),
          text: "String 'abc' test vector",
          uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"
        }
      ];
    }

    CreateInstance(isInverse = false) {
      // Hash functions don't have an inverse operation
      if (isInverse) {
        return null;
      }
      return new RIPEMD160Instance(this);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new RIPEMD160Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RIPEMD160Algorithm, RIPEMD160Instance };
}));