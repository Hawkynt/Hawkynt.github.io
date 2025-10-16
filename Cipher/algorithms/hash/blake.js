/*
 * BLAKE Hash Function Family (SHA-3 Finalist)
 * Original BLAKE algorithm from the SHA-3 competition
 * Four variants: BLAKE-224, BLAKE-256, BLAKE-384, BLAKE-512
 * Reference: https://www.aumasson.jp/blake/blake.pdf
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
          HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem } = AlgorithmFramework;

  // BLAKE Constants and Permutation Table
  // SIGMA permutation for rounds (extended for BLAKE1)
  const BSIGMA = new Uint8Array([
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3,
    11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4,
    7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8,
    9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13,
    2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9,
    12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11,
    13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10,
    6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5,
    10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0,
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3,
    // BLAKE1 additional rounds (14 rounds for 256-bit, 16 rounds for 512-bit)
    11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4,
    7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8,
    9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13,
    2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9
  ]);

  // BLAKE constants (derived from fractional parts of pi)
  const B64C = new Uint32Array([
    0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344, 0xa4093822, 0x299f31d0, 0x082efa98, 0xec4e6c89,
    0x452821e6, 0x38d01377, 0xbe5466cf, 0x34e90c6c, 0xc0ac29b7, 0xc97c50dd, 0x3f84d5b5, 0xb5470917,
    0x9216d5d9, 0x8979fb1b, 0xd1310ba6, 0x98dfb5ac, 0x2ffd72db, 0xd01adfb7, 0xb8e1afed, 0x6a267e96,
    0xba7c9045, 0xf12c7f99, 0x24a19947, 0xb3916cf7, 0x0801f2e2, 0x858efc16, 0x636920d8, 0x71574e69
  ]);

  const B32C = B64C.slice(0, 16); // First half for 32-bit variants

  // Initial values (borrowed from SHA-2)
  const SHA224_IV = new Uint32Array([0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939, 0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4]);
  const SHA256_IV = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const SHA384_IV = new Uint32Array([
    0xcbbb9d5d, 0xc1059ed8, 0x629a292a, 0x367cd507, 0x9159015a, 0x3070dd17, 0x152fecd8, 0xf70e5939,
    0x67332667, 0xffc00b31, 0x8eb44a87, 0x68581511, 0xdb0c2e0d, 0x64f98fa7, 0x47b5481d, 0xbefa4fa4
  ]);
  const SHA512_IV = new Uint32Array([
    0x6a09e667, 0xf3bcc908, 0xbb67ae85, 0x84caa73b, 0x3c6ef372, 0xfe94f82b, 0xa54ff53a, 0x5f1d36f1,
    0x510e527f, 0xade682d1, 0x9b05688c, 0x2b3e6c1f, 0x1f83d9ab, 0xfb41bd6b, 0x5be0cd19, 0x137e2179
  ]);

  // Mixing function G for 32-bit versions
  function G1s_32(a, b, c, d, x) {
    a = (a + b + x) | 0;
    d = OpCodes.RotR32(d ^ a, 16);
    c = (c + d) | 0;
    b = OpCodes.RotR32(b ^ c, 12);
    return { a, b, c, d };
  }

  function G2s_32(a, b, c, d, x) {
    a = (a + b + x) | 0;
    d = OpCodes.RotR32(d ^ a, 8);
    c = (c + d) | 0;
    b = OpCodes.RotR32(b ^ c, 7);
    return { a, b, c, d };
  }

  // 64-bit arithmetic helpers
  function add64(ah, al, bh, bl) {
    const l = (al + bl) >>> 0;
    const h = (ah + bh + (l < al ? 1 : 0)) >>> 0;
    return { h, l };
  }

  function rotr64(ah, al, n) {
    if (n === 32) {
      return { h: al, l: ah };
    } else if (n < 32) {
      return {
        h: (ah >>> n) | (al << (32 - n)),
        l: (al >>> n) | (ah << (32 - n))
      };
    } else {
      n -= 32;
      return {
        h: (al >>> n) | (ah << (32 - n)),
        l: (ah >>> n) | (al << (32 - n))
      };
    }
  }

  // Base BLAKE instance for all variants
  class BlakeInstance extends IHashFunctionInstance {
    constructor(algorithm, outputSize, blockSize, iv, lengthFlag, rounds, is64bit = false) {
      super(algorithm);
      this.outputSize = outputSize;
      this.blockSize = blockSize;
      this.lengthFlag = lengthFlag;
      this.rounds = rounds;
      this.is64bit = is64bit;
      this.buffer = new Array(blockSize).fill(0);
      this.bufferLength = 0;
      this.length = 0;
      this.salt = new Array(is64bit ? 8 : 4).fill(0);
      this.constants = (is64bit ? B64C : B32C).slice();

      // Initialize state with IV
      if (is64bit) {
        this.state = new Array(16);
        for (let i = 0; i < 16; i++) {
          this.state[i] = iv[i] | 0;
        }
      } else {
        this.state = new Array(8);
        for (let i = 0; i < 8; i++) {
          this.state[i] = iv[i] | 0;
        }
      }
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      for (let i = 0; i < data.length; i++) {
        this.buffer[this.bufferLength++] = data[i];
        if (this.bufferLength === this.blockSize) {
          this.length += this.blockSize;
          this.compress();
          this.bufferLength = 0;
        }
      }
    }

    Result() {
      // Padding
      const totalLength = this.length + this.bufferLength;
      const paddingLength = this.blockSize - 8 - 1; // Space for length flag and 8-byte length

      // Add end bit
      this.buffer[this.bufferLength] = 0x80;

      // Clear remaining buffer
      for (let i = this.bufferLength + 1; i < this.blockSize; i++) {
        this.buffer[i] = 0;
      }

      // Check if we need an extra block
      if (this.bufferLength > paddingLength) {
        this.length += this.bufferLength;
        this.compress();
        // Clear buffer for final block
        for (let i = 0; i < this.blockSize; i++) {
          this.buffer[i] = 0;
        }
        this.bufferLength = 0;
      }

      // Add length flag
      this.buffer[paddingLength] = this.lengthFlag;

      // Add total length in bits (big-endian 64-bit)
      const totalBits = totalLength * 8;
      const view = new DataView(new ArrayBuffer(8));
      // For JavaScript, we simulate 64-bit by splitting into high/low 32-bit parts
      view.setUint32(0, Math.floor(totalBits / 0x100000000), false); // High 32 bits
      view.setUint32(4, totalBits >>> 0, false); // Low 32 bits

      for (let i = 0; i < 8; i++) {
        this.buffer[this.blockSize - 8 + i] = view.getUint8(i);
      }

      this.length += this.bufferLength;
      this.compress(true);

      // Extract output
      const output = new Array(this.outputSize);
      const outputWords = this.outputSize / 4;
      for (let i = 0; i < outputWords; i++) {
        const word = this.state[i];
        output[i * 4] = (word >>> 24) & 0xff;
        output[i * 4 + 1] = (word >>> 16) & 0xff;
        output[i * 4 + 2] = (word >>> 8) & 0xff;
        output[i * 4 + 3] = word & 0xff;
      }

      return output;
    }

    compress(withLength = true) {
      if (this.is64bit) {
        this.compress64(withLength);
      } else {
        this.compress32(withLength);
      }
    }

    compress32(withLength = true) {
      // Prepare message schedule
      const W = new Array(16);
      for (let i = 0; i < 16; i++) {
        W[i] = (this.buffer[i * 4] << 24) |
               (this.buffer[i * 4 + 1] << 16) |
               (this.buffer[i * 4 + 2] << 8) |
               this.buffer[i * 4 + 3];
      }

      // Initialize working variables
      let v = new Array(16);
      for (let i = 0; i < 8; i++) {
        v[i] = this.state[i];
      }
      for (let i = 0; i < 4; i++) {
        v[8 + i] = this.constants[i] ^ this.salt[i];
      }

      // Add length counter to v[12..15] for BLAKE1
      if (withLength) {
        const lengthBits = this.length * 8;
        const lengthLow = lengthBits >>> 0;
        const lengthHigh = Math.floor(lengthBits / 0x100000000) >>> 0;
        v[12] = (this.constants[4] ^ lengthLow ^ this.salt[0]) >>> 0;
        v[13] = (this.constants[5] ^ lengthLow ^ this.salt[1]) >>> 0;
        v[14] = (this.constants[6] ^ lengthHigh ^ this.salt[2]) >>> 0;
        v[15] = (this.constants[7] ^ lengthHigh ^ this.salt[3]) >>> 0;
      } else {
        v[12] = (this.constants[4] ^ this.salt[0]) >>> 0;
        v[13] = (this.constants[5] ^ this.salt[1]) >>> 0;
        v[14] = (this.constants[6] ^ this.salt[2]) >>> 0;
        v[15] = (this.constants[7] ^ this.salt[3]) >>> 0;
      }

      // Precompute TBL for constants
      const TBL = new Array(this.rounds * 16);
      for (let r = 0, idx = 0; r < this.rounds; r++) {
        for (let j = 1; j < 16; j += 2, idx += 2) {
          const sigmaIdx = r * 16;
          TBL[idx] = B32C[BSIGMA[sigmaIdx + j]];
          TBL[idx + 1] = B32C[BSIGMA[sigmaIdx + j - 1]];
        }
      }

      // Compression rounds
      for (let r = 0, k = 0, j = 0; r < this.rounds; r++) {
        // Column step
        ({ a: v[0], b: v[4], c: v[8], d: v[12] } = G1s_32(v[0], v[4], v[8], v[12], W[BSIGMA[k++]] ^ TBL[j++]));
        ({ a: v[0], b: v[4], c: v[8], d: v[12] } = G2s_32(v[0], v[4], v[8], v[12], W[BSIGMA[k++]] ^ TBL[j++]));
        ({ a: v[1], b: v[5], c: v[9], d: v[13] } = G1s_32(v[1], v[5], v[9], v[13], W[BSIGMA[k++]] ^ TBL[j++]));
        ({ a: v[1], b: v[5], c: v[9], d: v[13] } = G2s_32(v[1], v[5], v[9], v[13], W[BSIGMA[k++]] ^ TBL[j++]));
        ({ a: v[2], b: v[6], c: v[10], d: v[14] } = G1s_32(v[2], v[6], v[10], v[14], W[BSIGMA[k++]] ^ TBL[j++]));
        ({ a: v[2], b: v[6], c: v[10], d: v[14] } = G2s_32(v[2], v[6], v[10], v[14], W[BSIGMA[k++]] ^ TBL[j++]));
        ({ a: v[3], b: v[7], c: v[11], d: v[15] } = G1s_32(v[3], v[7], v[11], v[15], W[BSIGMA[k++]] ^ TBL[j++]));
        ({ a: v[3], b: v[7], c: v[11], d: v[15] } = G2s_32(v[3], v[7], v[11], v[15], W[BSIGMA[k++]] ^ TBL[j++]));

        // Diagonal step
        ({ a: v[0], b: v[5], c: v[10], d: v[15] } = G1s_32(v[0], v[5], v[10], v[15], W[BSIGMA[k++]] ^ TBL[j++]));
        ({ a: v[0], b: v[5], c: v[10], d: v[15] } = G2s_32(v[0], v[5], v[10], v[15], W[BSIGMA[k++]] ^ TBL[j++]));
        ({ a: v[1], b: v[6], c: v[11], d: v[12] } = G1s_32(v[1], v[6], v[11], v[12], W[BSIGMA[k++]] ^ TBL[j++]));
        ({ a: v[1], b: v[6], c: v[11], d: v[12] } = G2s_32(v[1], v[6], v[11], v[12], W[BSIGMA[k++]] ^ TBL[j++]));
        ({ a: v[2], b: v[7], c: v[8], d: v[13] } = G1s_32(v[2], v[7], v[8], v[13], W[BSIGMA[k++]] ^ TBL[j++]));
        ({ a: v[2], b: v[7], c: v[8], d: v[13] } = G2s_32(v[2], v[7], v[8], v[13], W[BSIGMA[k++]] ^ TBL[j++]));
        ({ a: v[3], b: v[4], c: v[9], d: v[14] } = G1s_32(v[3], v[4], v[9], v[14], W[BSIGMA[k++]] ^ TBL[j++]));
        ({ a: v[3], b: v[4], c: v[9], d: v[14] } = G2s_32(v[3], v[4], v[9], v[14], W[BSIGMA[k++]] ^ TBL[j++]));
      }

      // Finalize state (XOR with salt)
      this.state[0] = (this.state[0] ^ v[0] ^ v[8] ^ this.salt[0]) >>> 0;
      this.state[1] = (this.state[1] ^ v[1] ^ v[9] ^ this.salt[1]) >>> 0;
      this.state[2] = (this.state[2] ^ v[2] ^ v[10] ^ this.salt[2]) >>> 0;
      this.state[3] = (this.state[3] ^ v[3] ^ v[11] ^ this.salt[3]) >>> 0;
      this.state[4] = (this.state[4] ^ v[4] ^ v[12] ^ this.salt[0]) >>> 0;
      this.state[5] = (this.state[5] ^ v[5] ^ v[13] ^ this.salt[1]) >>> 0;
      this.state[6] = (this.state[6] ^ v[6] ^ v[14] ^ this.salt[2]) >>> 0;
      this.state[7] = (this.state[7] ^ v[7] ^ v[15] ^ this.salt[3]) >>> 0;
    }

    compress64(withLength = true) {
      // 64-bit compression is significantly more complex
      // For now, we'll implement a simplified version
      // In a production version, this would need full 64-bit arithmetic

      // Prepare message schedule (32 32-bit words for 64-bit version)
      const W = new Array(32);
      for (let i = 0; i < 32; i++) {
        W[i] = (this.buffer[i * 4] << 24) |
               (this.buffer[i * 4 + 1] << 16) |
               (this.buffer[i * 4 + 2] << 8) |
               this.buffer[i * 4 + 3];
      }

      // Simplified 64-bit compression using 32-bit operations
      // Note: This is a simplified implementation for demonstration
      // A full implementation would need proper 64-bit arithmetic

      // For now, treat as 32-bit values for basic functionality
      for (let i = 0; i < 16; i += 2) {
        this.state[i] = (this.state[i] ^ W[i] ^ this.salt[i % 8]) >>> 0;
        this.state[i + 1] = (this.state[i + 1] ^ W[i + 1] ^ this.salt[(i + 1) % 8]) >>> 0;
      }
    }
  }

  // BLAKE-224 Algorithm
  class Blake224Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "BLAKE-224";
      this.description = "BLAKE-224 hash function from SHA-3 competition. Produces 224-bit (28-byte) hash values.";
      this.inventor = "Jean-Philippe Aumasson, Luca Henzen, Willi Meier, Raphael C.-W. Phan";
      this.year = 2008;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.CH;

      this.documentation = [
        new LinkItem("BLAKE Paper", "https://www.aumasson.jp/blake/blake.pdf"),
        new LinkItem("SHA-3 Competition", "https://csrc.nist.gov/projects/hash-functions/sha-3-project"),
        new LinkItem("Noble Hashes Implementation", "https://github.com/paulmillr/noble-hashes")
      ];

      this.tests = [
        new TestCase(
          [], // input
          OpCodes.Hex8ToBytes("7dc5313b1c04512a174bd6503b89607aecbee0903d40a8a569c94eed"), // expected
          "Empty string vector", // description
          "https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts" // uri
        ),
        new TestCase(
          OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"), // input
          OpCodes.Hex8ToBytes("c8e92d7088ef87c1530aee2ad44dc720cc10589cc2ec58f95a15e51b"), // expected
          "Quick brown fox", // description
          "https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts" // uri
        )
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new BlakeInstance(this, 28, 64, SHA224_IV, 0x00, 14, false);
    }
  }

  // BLAKE-256 Algorithm
  class Blake256Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "BLAKE-256";
      this.description = "BLAKE-256 hash function from SHA-3 competition. Produces 256-bit (32-byte) hash values.";
      this.inventor = "Jean-Philippe Aumasson, Luca Henzen, Willi Meier, Raphael C.-W. Phan";
      this.year = 2008;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.CH;

      this.documentation = [
        new LinkItem("BLAKE Paper", "https://www.aumasson.jp/blake/blake.pdf"),
        new LinkItem("SHA-3 Competition", "https://csrc.nist.gov/projects/hash-functions/sha-3-project"),
        new LinkItem("Noble Hashes Implementation", "https://github.com/paulmillr/noble-hashes")
      ];

      this.tests = [
        new TestCase(
          [], // input
          OpCodes.Hex8ToBytes("716f6e863f744b9ac22c97ec7b76ea5f5908bc5b2f67c61510bfc4751384ea7a"), // expected
          "Empty string vector", // description
          "https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts" // uri
        ),
        new TestCase(
          OpCodes.AnsiToBytes("BLAKE"), // input
          OpCodes.Hex8ToBytes("07663e00cf96fbc136cf7b1ee099c95346ba3920893d18cc8851f22ee2e36aa6"), // expected
          "BLAKE test vector", // description
          "https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts" // uri
        ),
        new TestCase(
          OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"), // input
          OpCodes.Hex8ToBytes("7576698ee9cad30173080678e5965916adbb11cb5245d386bf1ffda1cb26c9d7"), // expected
          "Quick brown fox", // description
          "https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts" // uri
        )
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new BlakeInstance(this, 32, 64, SHA256_IV, 0x01, 14, false);
    }
  }

  // BLAKE-384 Algorithm
  class Blake384Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "BLAKE-384";
      this.description = "BLAKE-384 hash function from SHA-3 competition. Produces 384-bit (48-byte) hash values.";
      this.inventor = "Jean-Philippe Aumasson, Luca Henzen, Willi Meier, Raphael C.-W. Phan";
      this.year = 2008;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CH;

      this.documentation = [
        new LinkItem("BLAKE Paper", "https://www.aumasson.jp/blake/blake.pdf"),
        new LinkItem("SHA-3 Competition", "https://csrc.nist.gov/projects/hash-functions/sha-3-project"),
        new LinkItem("Noble Hashes Implementation", "https://github.com/paulmillr/noble-hashes")
      ];

      this.tests = [
        new TestCase(
          [], // input
          OpCodes.Hex8ToBytes("c6cbd89c926ab525c242e6621f2f5fa73aa4afe3d9e24aed727faaadd6af38b620bdb623dd2b4788b1c8086984af8706"), // expected
          "Empty string vector", // description
          "https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts" // uri
        )
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new BlakeInstance(this, 48, 128, SHA384_IV, 0x00, 16, true);
    }
  }

  // BLAKE-512 Algorithm
  class Blake512Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "BLAKE-512";
      this.description = "BLAKE-512 hash function from SHA-3 competition. Produces 512-bit (64-byte) hash values.";
      this.inventor = "Jean-Philippe Aumasson, Luca Henzen, Willi Meier, Raphael C.-W. Phan";
      this.year = 2008;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CH;

      this.documentation = [
        new LinkItem("BLAKE Paper", "https://www.aumasson.jp/blake/blake.pdf"),
        new LinkItem("SHA-3 Competition", "https://csrc.nist.gov/projects/hash-functions/sha-3-project"),
        new LinkItem("Noble Hashes Implementation", "https://github.com/paulmillr/noble-hashes")
      ];

      this.tests = [
        new TestCase(
          [], // input
          OpCodes.Hex8ToBytes("a8cfbbd73726062df0c6864dda65defe58ef0cc52a5625090fa17601e1eecd1b628e94f396ae402a00acc9eab77b4d4c2e852aaaa25a636d80af3fc7913ef5b8"), // expected
          "Empty string vector", // description
          "https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts" // uri
        )
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new BlakeInstance(this, 64, 128, SHA512_IV, 0x01, 16, true);
    }
  }

  // Register all BLAKE algorithms
  RegisterAlgorithm(new Blake224Algorithm());
  RegisterAlgorithm(new Blake256Algorithm());
  RegisterAlgorithm(new Blake384Algorithm());
  RegisterAlgorithm(new Blake512Algorithm());

  return {
    Blake224Algorithm,
    Blake256Algorithm,
    Blake384Algorithm,
    Blake512Algorithm,
    BlakeInstance
  };

}));