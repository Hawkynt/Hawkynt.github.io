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
  // For 32-bit BLAKE
  const B32C = new Uint32Array([
    0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344, 0xa4093822, 0x299f31d0, 0x082efa98, 0xec4e6c89,
    0x452821e6, 0x38d01377, 0xbe5466cf, 0x34e90c6c, 0xc0ac29b7, 0xc97c50dd, 0x3f84d5b5, 0xb5470917
  ]);

  // For 64-bit BLAKE (stored as [HIGH, LOW] pairs matching noble-hashes B64C format)
  const B64C = new Uint32Array([
    0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344, 0xa4093822, 0x299f31d0, 0x082efa98, 0xec4e6c89,
    0x452821e6, 0x38d01377, 0xbe5466cf, 0x34e90c6c, 0xc0ac29b7, 0xc97c50dd, 0x3f84d5b5, 0xb5470917,
    0x9216d5d9, 0x8979fb1b, 0xd1310ba6, 0x98dfb5ac, 0x2ffd72db, 0xd01adfb7, 0xb8e1afed, 0x6a267e96,
    0xba7c9045, 0xf12c7f99, 0x24a19947, 0xb3916cf7, 0x0801f2e2, 0x858efc16, 0x636920d8, 0x71574e69
  ]);

  // Initial values (borrowed from SHA-2)
  const SHA224_IV = new Uint32Array([0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939, 0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4]);
  const SHA256_IV = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  // SHA-2 IVs for BLAKE-384 and BLAKE-512
  // CRITICAL: Stored as [HIGH, LOW] pairs matching noble-hashes format!
  // noble-hashes uses BACKWARD variable naming: v0l=IV[0] (HIGH), v0h=IV[1] (LOW)
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

  // G1b function matching noble-hashes (first half of mixing function)
  // CRITICAL: noble-hashes uses BACKWARD variable naming!
  //   Variables ending in 'l' actually contain HIGH 32 bits
  //   Variables ending in 'h' actually contain LOW 32 bits
  // Storage: v[i*2] = HIGH, v[i*2+1] = LOW
  // So: Al = v[2*a+1] = LOW word, Ah = v[2*a] = HIGH word
  function G1b_64(v, a, b, c, d, msg, k, TBL) {
    const Xpos = 2 * BSIGMA[k];
    const Xl = msg[Xpos + 1] ^ TBL[k * 2 + 1];  // LOW ^ LOW
    const Xh = msg[Xpos] ^ TBL[k * 2];          // HIGH ^ HIGH

    // Load values: Al gets v[2*a+1] (LOW), Ah gets v[2*a] (HIGH)
    let Al = v[2 * a + 1], Ah = v[2 * a];
    let Bl = v[2 * b + 1], Bh = v[2 * b];
    let Cl = v[2 * c + 1], Ch = v[2 * c];
    let Dl = v[2 * d + 1], Dh = v[2 * d];

    // v[a] = v[a] + v[b] + x
    let ll = OpCodes.Add3L64(Al, Bl, Xl);
    Ah = OpCodes.Add3H64(ll, Ah, Bh, Xh) >>> 0;
    Al = (ll | 0) >>> 0;

    // v[d] = rotr(v[d] ^ v[a], 32) - swaps high/low
    const xorD1 = OpCodes.Xor64_HL(Dh, Dl, Ah, Al);
    Dh = xorD1.h;
    Dl = xorD1.l;
    const swap = OpCodes.Swap64_HL(Dh, Dl);
    Dh = swap.h;
    Dl = swap.l;

    // v[c] = v[c] + v[d]
    const addCD = OpCodes.Add64_HL(Ch, Cl, Dh, Dl);
    Ch = addCD.h;
    Cl = addCD.l;

    // v[b] = rotr(v[b] ^ v[c], 25)
    const xorB1 = OpCodes.Xor64_HL(Bh, Bl, Ch, Cl);
    Bh = xorB1.h;
    Bl = xorB1.l;
    const rotB = OpCodes.RotR64_HL(Bh, Bl, 25);
    Bh = rotB.h;
    Bl = rotB.l;

    // Write back
    v[2 * a] = Ah;
    v[2 * a + 1] = Al;
    v[2 * b] = Bh;
    v[2 * b + 1] = Bl;
    v[2 * c] = Ch;
    v[2 * c + 1] = Cl;
    v[2 * d] = Dh;
    v[2 * d + 1] = Dl;
  }

  // G2b function matching noble-hashes (second half of mixing function)
  function G2b_64(v, a, b, c, d, msg, k, TBL) {
    const Xpos = 2 * BSIGMA[k];
    const Xl = msg[Xpos + 1] ^ TBL[k * 2 + 1];  // LOW ^ LOW
    const Xh = msg[Xpos] ^ TBL[k * 2];          // HIGH ^ HIGH

    // Load values: Al=LOW, Ah=HIGH (backwards naming!)
    let Al = v[2 * a + 1], Ah = v[2 * a];
    let Bl = v[2 * b + 1], Bh = v[2 * b];
    let Cl = v[2 * c + 1], Ch = v[2 * c];
    let Dl = v[2 * d + 1], Dh = v[2 * d];

    // v[a] = v[a] + v[b] + x
    let ll = OpCodes.Add3L64(Al, Bl, Xl);
    Ah = OpCodes.Add3H64(ll, Ah, Bh, Xh) >>> 0;
    Al = (ll | 0) >>> 0;

    // v[d] = rotr(v[d] ^ v[a], 16)
    const xorD2 = OpCodes.Xor64_HL(Dh, Dl, Ah, Al);
    Dh = xorD2.h;
    Dl = xorD2.l;
    const rotD = OpCodes.RotR64_HL(Dh, Dl, 16);
    Dh = rotD.h;
    Dl = rotD.l;

    // v[c] = v[c] + v[d]
    const addCD = OpCodes.Add64_HL(Ch, Cl, Dh, Dl);
    Ch = addCD.h;
    Cl = addCD.l;

    // v[b] = rotr(v[b] ^ v[c], 11)
    const xorB2 = OpCodes.Xor64_HL(Bh, Bl, Ch, Cl);
    Bh = xorB2.h;
    Bl = xorB2.l;
    const rotB = OpCodes.RotR64_HL(Bh, Bl, 11);
    Bh = rotB.h;
    Bl = rotB.l;

    // Write back
    v[2 * a] = Ah;
    v[2 * a + 1] = Al;
    v[2 * b] = Bh;
    v[2 * b + 1] = Bl;
    v[2 * c] = Ch;
    v[2 * c + 1] = Cl;
    v[2 * d] = Dh;
    v[2 * d + 1] = Dl;
  }

  // Generate TBL512 matching noble-hashes pattern
  function generateTBL512() {
    const TBL = [];
    for (let r = 0, k = 0; r < 16; r++, k += 16) {
      for (let offset = 1; offset < 16; offset += 2) {
        TBL.push(B64C[BSIGMA[k + offset] * 2 + 0]);      // HIGH of odd index
        TBL.push(B64C[BSIGMA[k + offset] * 2 + 1]);      // LOW of odd index
        TBL.push(B64C[BSIGMA[k + offset - 1] * 2 + 0]);  // HIGH of even index
        TBL.push(B64C[BSIGMA[k + offset - 1] * 2 + 1]);  // LOW of even index
      }
    }
    return TBL;
  }

  const TBL512 = generateTBL512();

  // Base BLAKE instance for all variants
  /**
 * Blake cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

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
      // Salt: 4 32-bit words for 32-bit, 8 32-bit words for 64-bit (representing 4 64-bit values)
      this.salt = new Array(is64bit ? 8 : 4).fill(0);
      this.constants = (is64bit ? B64C.slice() : B32C.slice());

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

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

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

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Padding
      const totalLength = this.length + this.bufferLength;
      // Length encoding size: 8 bytes for 32-bit variants, 16 bytes for 64-bit variants
      const lengthFieldSize = this.is64bit ? 16 : 8;
      const paddingLength = this.blockSize - lengthFieldSize - 1; // Space for length flag and length

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

      // Add total length in bits (big-endian)
      const totalBits = totalLength * 8;

      if (this.is64bit) {
        // 128-bit length encoding for BLAKE-384/512
        const view = new DataView(new ArrayBuffer(16));
        // For JavaScript, we can only handle up to 53-bit integers safely
        // Store as 128-bit: [0, 0, 0, 0, high32, low32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        // Actually: upper 64 bits are 0, lower 64 bits contain the actual length
        view.setUint32(8, Math.floor(totalBits / 0x100000000), false);  // High 32 bits of lower 64-bit
        view.setUint32(12, OpCodes.ToUint32(totalBits), false);                      // Low 32 bits of lower 64-bit

        for (let i = 0; i < 16; i++) {
          this.buffer[this.blockSize - 16 + i] = view.getUint8(i);
        }
      } else {
        // 64-bit length encoding for BLAKE-224/256
        const view = new DataView(new ArrayBuffer(8));
        view.setUint32(0, Math.floor(totalBits / 0x100000000), false); // High 32 bits
        view.setUint32(4, OpCodes.ToUint32(totalBits), false);                      // Low 32 bits

        for (let i = 0; i < 8; i++) {
          this.buffer[this.blockSize - 8 + i] = view.getUint8(i);
        }
      }

      // Noble-hashes pattern: withLength is based on bufferLength BEFORE adding to length
      const withLength = this.bufferLength !== 0;
      this.length += this.bufferLength;
      this.compress(withLength);

      // Extract output
      const output = new Array(this.outputSize);

      if (this.is64bit) {
        // For 64-bit: state is stored as [HIGH, LOW] pairs
        // Output in big-endian order: HIGH word first, then LOW word
        const num64BitWords = this.outputSize / 8;
        for (let i = 0; i < num64BitWords; i++) {
          const high = this.state[i * 2];      // HIGH word at even index
          const low = this.state[i * 2 + 1];   // LOW word at odd index
          // Write HIGH word first (big-endian)
          const highBytes = OpCodes.Unpack32BE(high);
          output[i * 8] = highBytes[0];
          output[i * 8 + 1] = highBytes[1];
          output[i * 8 + 2] = highBytes[2];
          output[i * 8 + 3] = highBytes[3];
          // Write LOW word
          const lowBytes = OpCodes.Unpack32BE(low);
          output[i * 8 + 4] = lowBytes[0];
          output[i * 8 + 5] = lowBytes[1];
          output[i * 8 + 6] = lowBytes[2];
          output[i * 8 + 7] = lowBytes[3];
        }
      } else {
        // For 32-bit: state is directly 32-bit words
        const outputWords = this.outputSize / 4;
        for (let i = 0; i < outputWords; i++) {
          const word = this.state[i];
          const bytes = OpCodes.Unpack32BE(word);
          output[i * 4] = bytes[0];
          output[i * 4 + 1] = bytes[1];
          output[i * 4 + 2] = bytes[2];
          output[i * 4 + 3] = bytes[3];
        }
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
        W[i] = OpCodes.Pack32BE(
          this.buffer[i * 4],
          this.buffer[i * 4 + 1],
          this.buffer[i * 4 + 2],
          this.buffer[i * 4 + 3]
        );
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
        const lengthLow = OpCodes.ToUint32(lengthBits);
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
      // Prepare message schedule (16 64-bit words as 32 32-bit words)
      // CRITICAL: Storage format [HIGH, LOW] matching noble-hashes!
      // M[i*2] = HIGH word (bytes 0-3), M[i*2+1] = LOW word (bytes 4-7)
      const M = new Array(32);
      for (let i = 0; i < 16; i++) {
        // Big-endian reading
        const high = OpCodes.Pack32BE(
          this.buffer[i * 8],
          this.buffer[i * 8 + 1],
          this.buffer[i * 8 + 2],
          this.buffer[i * 8 + 3]
        );
        const low = OpCodes.Pack32BE(
          this.buffer[i * 8 + 4],
          this.buffer[i * 8 + 5],
          this.buffer[i * 8 + 6],
          this.buffer[i * 8 + 7]
        );
        M[i * 2] = high;      // Store HIGH first (matching line 447 of noble-hashes)
        M[i * 2 + 1] = low;   // Store LOW second
      }

      // Initialize working variables BBUF (16 64-bit as 32 32-bit)
      // CRITICAL: BBUF[i*2] = HIGH, BBUF[i*2+1] = LOW (matching noble-hashes line 449)
      const v = new Array(32);
      // Copy state (first 8 64-bit values = 16 32-bit words)
      for (let i = 0; i < 16; i++) {
        v[i] = this.state[i];
      }

      // v[8..15] = first 8 constants (16 words from constants array)
      for (let i = 0; i < 16; i++) {
        v[16 + i] = this.constants[i];
      }

      // XOR salt into v[8..11] (indices 16..23 in flat array)
      for (let i = 0; i < 8; i++) {
        v[16 + i] ^= this.salt[i];
      }

      // XOR length counter into v[12..13] if withLength (noble-hashes line 451-457)
      // BBUF naming: v12l is stored at BBUF[24] and contains HIGH word
      //              v12h is stored at BBUF[25] and contains LOW word
      if (withLength) {
        const lengthBits = this.length * 8;
        const lengthHigh = Math.floor(lengthBits / 0x100000000) >>> 0;
        const lengthLow = OpCodes.ToUint32(lengthBits);

        // v[24] = v12l (contains HIGH word), v[25] = v12h (contains LOW word)
        v[24] = (v[24] ^ lengthHigh) >>> 0;  // HIGH word ^= HIGH bits
        v[25] = (v[25] ^ lengthLow) >>> 0;   // LOW word ^= LOW bits
        // v[26] = v13l (contains HIGH word), v[27] = v13h (contains LOW word)
        v[26] = (v[26] ^ lengthHigh) >>> 0;  // HIGH word ^= HIGH bits
        v[27] = (v[27] ^ lengthLow) >>> 0;   // LOW word ^= LOW bits
      }

      // 16 rounds of compression (matching noble-hashes lines 458-476)
      for (let i = 0, k = 0; i < this.rounds; i++) {
        // Column step
        G1b_64(v, 0, 4, 8, 12, M, k++, TBL512);
        G2b_64(v, 0, 4, 8, 12, M, k++, TBL512);
        G1b_64(v, 1, 5, 9, 13, M, k++, TBL512);
        G2b_64(v, 1, 5, 9, 13, M, k++, TBL512);
        G1b_64(v, 2, 6, 10, 14, M, k++, TBL512);
        G2b_64(v, 2, 6, 10, 14, M, k++, TBL512);
        G1b_64(v, 3, 7, 11, 15, M, k++, TBL512);
        G2b_64(v, 3, 7, 11, 15, M, k++, TBL512);

        // Diagonal step
        G1b_64(v, 0, 5, 10, 15, M, k++, TBL512);
        G2b_64(v, 0, 5, 10, 15, M, k++, TBL512);
        G1b_64(v, 1, 6, 11, 12, M, k++, TBL512);
        G2b_64(v, 1, 6, 11, 12, M, k++, TBL512);
        G1b_64(v, 2, 7, 8, 13, M, k++, TBL512);
        G2b_64(v, 2, 7, 8, 13, M, k++, TBL512);
        G1b_64(v, 3, 4, 9, 14, M, k++, TBL512);
        G2b_64(v, 3, 4, 9, 14, M, k++, TBL512);
      }

      // Finalize state (matching noble-hashes lines 477-492)
      // Pattern: this.v0l ^= BBUF[0] ^ BBUF[16] ^ this.salt[0]
      this.state[0] ^= v[0] ^ v[16] ^ this.salt[0];   // v0l
      this.state[1] ^= v[1] ^ v[17] ^ this.salt[1];   // v0h
      this.state[2] ^= v[2] ^ v[18] ^ this.salt[2];   // v1l
      this.state[3] ^= v[3] ^ v[19] ^ this.salt[3];   // v1h
      this.state[4] ^= v[4] ^ v[20] ^ this.salt[4];   // v2l
      this.state[5] ^= v[5] ^ v[21] ^ this.salt[5];   // v2h
      this.state[6] ^= v[6] ^ v[22] ^ this.salt[6];   // v3l
      this.state[7] ^= v[7] ^ v[23] ^ this.salt[7];   // v3h
      this.state[8] ^= v[8] ^ v[24] ^ this.salt[0];   // v4l (salt repeats)
      this.state[9] ^= v[9] ^ v[25] ^ this.salt[1];   // v4h
      this.state[10] ^= v[10] ^ v[26] ^ this.salt[2]; // v5l
      this.state[11] ^= v[11] ^ v[27] ^ this.salt[3]; // v5h
      this.state[12] ^= v[12] ^ v[28] ^ this.salt[4]; // v6l
      this.state[13] ^= v[13] ^ v[29] ^ this.salt[5]; // v6h
      this.state[14] ^= v[14] ^ v[30] ^ this.salt[6]; // v7l
      this.state[15] ^= v[15] ^ v[31] ^ this.salt[7]; // v7h
    }
  }

  // BLAKE-224 Algorithm
  /**
 * Blake224Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

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
        {
          text: "Empty string vector",
          uri: "https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts",
          input: [],
          expected: OpCodes.Hex8ToBytes("7dc5313b1c04512a174bd6503b89607aecbee0903d40a8a569c94eed")
        },
        {
          text: "Quick brown fox",
          uri: "https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
          expected: OpCodes.Hex8ToBytes("c8e92d7088ef87c1530aee2ad44dc720cc10589cc2ec58f95a15e51b")
        }
      ];

      this.testVectors = this.tests;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new BlakeInstance(this, 28, 64, SHA224_IV, 0x00, 14, false);
    }
  }

  // BLAKE-256 Algorithm
  /**
 * Blake256Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

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
        {
          text: "Empty string vector",
          uri: "https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts",
          input: [],
          expected: OpCodes.Hex8ToBytes("716f6e863f744b9ac22c97ec7b76ea5f5908bc5b2f67c61510bfc4751384ea7a")
        },
        {
          text: "BLAKE test vector",
          uri: "https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts",
          input: OpCodes.AnsiToBytes("BLAKE"),
          expected: OpCodes.Hex8ToBytes("07663e00cf96fbc136cf7b1ee099c95346ba3920893d18cc8851f22ee2e36aa6")
        },
        {
          text: "Quick brown fox",
          uri: "https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
          expected: OpCodes.Hex8ToBytes("7576698ee9cad30173080678e5965916adbb11cb5245d386bf1ffda1cb26c9d7")
        }
      ];

      this.testVectors = this.tests;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new BlakeInstance(this, 32, 64, SHA256_IV, 0x01, 14, false);
    }
  }

  // BLAKE-384 Algorithm
  /**
 * Blake384Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

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
        {
          text: "Empty string vector",
          uri: "https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts",
          input: [],
          expected: OpCodes.Hex8ToBytes("c6cbd89c926ab525c242e6621f2f5fa73aa4afe3d9e24aed727faaadd6af38b620bdb623dd2b4788b1c8086984af8706")
        }
      ];

      this.testVectors = this.tests;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new BlakeInstance(this, 48, 128, SHA384_IV, 0x00, 16, true);
    }
  }

  // BLAKE-512 Algorithm
  /**
 * Blake512Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

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
        {
          text: "Empty string vector",
          uri: "https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts",
          input: [],
          expected: OpCodes.Hex8ToBytes("a8cfbbd73726062df0c6864dda65defe58ef0cc52a5625090fa17601e1eecd1b628e94f396ae402a00acc9eab77b4d4c2e852aaaa25a636d80af3fc7913ef5b8")
        }
      ];

      this.testVectors = this.tests;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

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