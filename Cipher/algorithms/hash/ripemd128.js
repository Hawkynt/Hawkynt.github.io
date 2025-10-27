/*
 * RIPEMD-128 Hash Function - Universal AlgorithmFramework Implementation
 * Based on Bouncy Castle RIPEMD128Digest.java reference implementation
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

  class RIPEMD128Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.OutputSize = 16; // 128 bits
      this._Reset();
    }

    _Reset() {
      // RIPEMD-128 initialization values (same as MD4/MD5)
      this.h = new Uint32Array([
        0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476
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
      padding[padLength] = OpCodes.GetByte(bitLength, 0);
      padding[padLength + 1] = OpCodes.GetByte(bitLength, 1);
      padding[padLength + 2] = OpCodes.GetByte(bitLength, 2);
      padding[padLength + 3] = OpCodes.GetByte(bitLength, 3);
      // For practical message sizes, high 32 bits are always 0
      padding[padLength + 4] = 0;
      padding[padLength + 5] = 0;
      padding[padLength + 6] = 0;
      padding[padLength + 7] = 0;

      this.Feed(padding);

      // Convert hash to bytes (little-endian) - only 4 words for RIPEMD-128
      const result = [];
      for (let i = 0; i < 4; i++) {
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

      // RIPEMD-128 message word selection arrays (from Bouncy Castle implementation)
      // Left path - sequential in round 1, then permuted
      const zl = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,   // Round 1
        7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,   // Round 2
        3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,   // Round 3
        1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2    // Round 4
      ];

      // Right path - different permutation
      const zr = [
        5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,   // Round 1
        6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,   // Round 2
        15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,   // Round 3
        8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14    // Round 4
      ];

      // RIPEMD-128 rotation amounts (from Bouncy Castle implementation)
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

      // RIPEMD-128 constants (from Bouncy Castle implementation)
      // Left path constants
      const hl = [0x00000000, 0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC];
      // Right path constants
      const hr = [0x50A28BE6, 0x5C4DD124, 0x6D703EF3, 0x00000000];

      // Initialize working variables (4 variables for RIPEMD-128)
      let al = this.h[0] | 0;
      let bl = this.h[1] | 0;
      let cl = this.h[2] | 0;
      let dl = this.h[3] | 0;

      let ar = this.h[0] | 0;
      let br = this.h[1] | 0;
      let cr = this.h[2] | 0;
      let dr = this.h[3] | 0;

      // RIPEMD-128 Boolean functions (matching Bouncy Castle implementation)
      // f1: x XOR y XOR z
      const fn1 = (a, b, c, d, m, k, s) => {
        return OpCodes.RotL32((a + (b ^ c ^ d) + m + k) | 0, s) | 0;
      };

      // f2: (x AND y) OR (NOT x AND z)
      const fn2 = (a, b, c, d, m, k, s) => {
        return OpCodes.RotL32((a + ((b & c) | (~b & d)) + m + k) | 0, s) | 0;
      };

      // f3: (x OR NOT y) XOR z
      const fn3 = (a, b, c, d, m, k, s) => {
        return OpCodes.RotL32((a + ((b | ~c) ^ d) + m + k) | 0, s) | 0;
      };

      // f4: (x AND z) OR (y AND NOT z)
      const fn4 = (a, b, c, d, m, k, s) => {
        return OpCodes.RotL32((a + ((b & d) | (c & ~d)) + m + k) | 0, s) | 0;
      };

      // 64 rounds computation (4 rounds × 16 steps each)
      for (let i = 0; i < 64; i += 1) {
        let tl;
        let tr;

        if (i < 16) {
          // Round 1: F1 for left, F4 for right
          tl = fn1(al, bl, cl, dl, words[zl[i]], hl[0], sl[i]);
          tr = fn4(ar, br, cr, dr, words[zr[i]], hr[0], sr[i]);
        } else if (i < 32) {
          // Round 2: F2 for left, F3 for right
          tl = fn2(al, bl, cl, dl, words[zl[i]], hl[1], sl[i]);
          tr = fn3(ar, br, cr, dr, words[zr[i]], hr[1], sr[i]);
        } else if (i < 48) {
          // Round 3: F3 for left, F2 for right
          tl = fn3(al, bl, cl, dl, words[zl[i]], hl[2], sl[i]);
          tr = fn2(ar, br, cr, dr, words[zr[i]], hr[2], sr[i]);
        } else { // i < 64
          // Round 4: F4 for left, F1 for right
          tl = fn4(al, bl, cl, dl, words[zl[i]], hl[3], sl[i]);
          tr = fn1(ar, br, cr, dr, words[zr[i]], hr[3], sr[i]);
        }

        // Rotate state variables (4-variable rotation without E)
        al = dl;
        dl = cl;
        cl = bl;
        bl = tl;

        ar = dr;
        dr = cr;
        cr = br;
        br = tr;
      }

      // Update state (matching Bouncy Castle RIPEMD-128 final combination)
      // dd += c + H1;
      // H1 = H2 + d + aa;
      // H2 = H3 + a + bb;
      // H3 = H0 + b + cc;
      // H0 = dd;
      const t = (this.h[1] + cl + dr) | 0;
      this.h[1] = (this.h[2] + dl + ar) | 0;
      this.h[2] = (this.h[3] + al + br) | 0;
      this.h[3] = (this.h[0] + bl + cr) | 0;
      this.h[0] = t;
    }
  }

  class RIPEMD128Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "RIPEMD-128";
      this.description = "RACE Integrity Primitives Evaluation Message Digest with 128-bit output. Developed as part of the RIPEMD family with dual-path design. Produces a 128-bit hash digest but considered weak by modern standards.";
      this.inventor = "Hans Dobbertin, Antoon Bosselaers, Bart Preneel";
      this.year = 1996;
      this.category = CategoryType.HASH;
      this.subCategory = "RIPEMD Family";
      this.securityStatus = SecurityStatus.DEPRECATED;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      // Documentation and references
      this.documentation = [
        new LinkItem("RIPEMD-128 Specification", "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"),
        new LinkItem("ISO/IEC 10118-3:2004 Standard", "https://www.iso.org/standard/39876.html"),
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/RIPEMD")
      ];

      this.references = [
        new LinkItem("Bouncy Castle Java Implementation", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/digests/RIPEMD128Digest.java"),
        new LinkItem("Original RIPEMD Family Specification", "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html")
      ];

      // Test vectors from ISO/IEC 10118-3
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

    CreateInstance(isInverse = false) {
      // Hash functions don't have an inverse operation
      if (isInverse) {
        return null;
      }
      return new RIPEMD128Instance(this);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new RIPEMD128Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RIPEMD128Algorithm, RIPEMD128Instance };
}));
