/*
 * Subterranean AEAD - NIST LWC Round 2 Candidate
 * Professional implementation following the official specification
 * (c)2006-2025 Hawkynt
 *
 * Subterranean 2.0 is a family of algorithms built around the 257-bit
 * Subterranean permutation. It was a Round 2 candidate in the NIST Lightweight
 * Cryptography competition. The design emphasizes hardware efficiency with a
 * minimalist duplex sponge construction.
 *
 * Algorithm Properties:
 * - State size: 257 bits (9 x 32-bit words, last word has 1 bit)
 * - Key size: 128 bits (16 bytes)
 * - Nonce size: 128 bits (16 bytes)
 * - Tag size: 128 bits (16 bytes)
 * - Rate: 4 bytes per round
 *
 * Reference: https://cs.ru.nl/~joan/subterranean.html
 * Specification: Joan Daemen, Pedro Maat Costa Massolino, Yann Rotella, et al.
 * C Reference: Southern Storm Software lightweight crypto implementation
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

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AeadAlgorithm, IAeadInstance, LinkItem, KeySize } = AlgorithmFramework;

  // ========================[ SUBTERRANEAN PERMUTATION ]========================

  /**
   * Subterranean 257-bit state
   * State is represented as 9 x 32-bit words (x[0-7] full, x[8] has 1 bit)
   */
  class SubterraneanState {
    constructor() {
      this.x = new Array(9);
      for (let i = 0; i < 9; ++i) {
        this.x[i] = 0;
      }
    }

    /**
     * Performs a single Subterranean round
     * Implements chi, iota, theta, and pi steps as defined in specification
     */
    round() {
      let x0 = this.x[0], x1 = this.x[1], x2 = this.x[2], x3 = this.x[3];
      let x4 = this.x[4], x5 = this.x[5], x6 = this.x[6], x7 = this.x[7];
      let x8 = this.x[8];
      let t0, t1;

      // Step chi: s[i] = s[i]^(~(s[i+1])&s[i+2])
      x8 = OpCodes.Xor32(x8, OpCodes.Shl32(x0, 1));

      // CHI macro for each word
      const chi = (a, b) => {
        t0 = OpCodes.ToUint32(OpCodes.Shr32(a, 1)|OpCodes.Shl32(b, 31));
        t1 = OpCodes.ToUint32(OpCodes.Shr32(a, 2)|OpCodes.Shl32(b, 30));
        return OpCodes.Xor32(a, ((~t0)&t1));
      };

      x0 = chi(x0, x1); x1 = chi(x1, x2);
      x2 = chi(x2, x3); x3 = chi(x3, x4);
      x4 = chi(x4, x5); x5 = chi(x5, x6);
      x6 = chi(x6, x7); x7 = chi(x7, x8);
      x8 = OpCodes.Xor32(x8, ((~OpCodes.Shr32(x8, 1))&OpCodes.Shr32(x8, 2)));

      // Step iota: invert s[0]
      x0 = OpCodes.Xor32(x0, 1);

      // Step theta: s[i] = s[i]^s[i + 3]^s[i + 8]
      x8 = OpCodes.Xor32((x8&1), OpCodes.Shl32(x0, 1));

      const theta = (a, b) => {
        t0 = OpCodes.ToUint32(OpCodes.Shr32(a, 3)|OpCodes.Shl32(b, 29));
        t1 = OpCodes.ToUint32(OpCodes.Shr32(a, 8)|OpCodes.Shl32(b, 24));
        return OpCodes.Xor32(OpCodes.Xor32(a, t0), t1);
      };

      x0 = theta(x0, x1); x1 = theta(x1, x2);
      x2 = theta(x2, x3); x3 = theta(x3, x4);
      x4 = theta(x4, x5); x5 = theta(x5, x6);
      x6 = theta(x6, x7); x7 = theta(x7, x8);
      x8 = OpCodes.Xor32(OpCodes.Xor32(x8, OpCodes.Shr32(x8, 3)), OpCodes.Shr32(x8, 8));

      // Step pi: permute bits with rule s[i] = s[(i * 12) % 257]
      // BCP = bit copy, BUP = move bit up, BDN = move bit down
      const BCP = (x, bit) => OpCodes.ToUint32(x&OpCodes.Shl32(1, bit));
      const BUP = (x, from, to) => OpCodes.ToUint32(OpCodes.Shl32(x, (to - from))&OpCodes.Shl32(1, to));
      const BDN = (x, from, to) => OpCodes.ToUint32(OpCodes.Shr32(x, (from - to))&OpCodes.Shl32(1, to));

      this.x[0] = BCP(x0, 0)^BDN(x0, 12,  1)^BDN(x0, 24,  2)^BDN(x1,  4,  3)^BDN(x1, 16,  4)^BDN(x1, 28,  5)^BDN(x2,  8,  6)^BDN(x2, 20,  7)^BUP(x3,  0,  8)^BDN(x3, 12,  9)^BDN(x3, 24, 10)^BUP(x4,  4, 11)^BDN(x4, 16, 12)^BDN(x4, 28, 13)^BUP(x5,  8, 14)^BDN(x5, 20, 15)^BUP(x6,  0, 16)^BUP(x6, 12, 17)^BDN(x6, 24, 18)^BUP(x7,  4, 19)^BUP(x7, 16, 20)^BDN(x7, 28, 21)^BUP(x0,  7, 22)^BUP(x0, 19, 23)^BDN(x0, 31, 24)^BUP(x1, 11, 25)^BUP(x1, 23, 26)^BUP(x2,  3, 27)^BUP(x2, 15, 28)^BUP(x2, 27, 29)^BUP(x3,  7, 30)^BUP(x3, 19, 31);

      this.x[1] = BDN(x3, 31,  0)^BDN(x4, 11,  1)^BDN(x4, 23,  2)^BCP(x5,  3)^BDN(x5, 15,  4)^BDN(x5, 27,  5)^BDN(x6,  7,  6)^BDN(x6, 19,  7)^BDN(x6, 31,  8)^BDN(x7, 11,  9)^BDN(x7, 23, 10)^BUP(x0,  2, 11)^BDN(x0, 14, 12)^BDN(x0, 26, 13)^BUP(x1,  6, 14)^BDN(x1, 18, 15)^BDN(x1, 30, 16)^BUP(x2, 10, 17)^BDN(x2, 22, 18)^BUP(x3,  2, 19)^BUP(x3, 14, 20)^BDN(x3, 26, 21)^BUP(x4,  6, 22)^BUP(x4, 18, 23)^BDN(x4, 30, 24)^BUP(x5, 10, 25)^BUP(x5, 22, 26)^BUP(x6,  2, 27)^BUP(x6, 14, 28)^BUP(x6, 26, 29)^BUP(x7,  6, 30)^BUP(x7, 18, 31);

      this.x[2] = BDN(x7, 30,  0)^BDN(x0,  9,  1)^BDN(x0, 21,  2)^BUP(x1,  1,  3)^BDN(x1, 13,  4)^BDN(x1, 25,  5)^BUP(x2,  5,  6)^BDN(x2, 17,  7)^BDN(x2, 29,  8)^BCP(x3,  9)^BDN(x3, 21, 10)^BUP(x4,  1, 11)^BDN(x4, 13, 12)^BDN(x4, 25, 13)^BUP(x5,  5, 14)^BDN(x5, 17, 15)^BDN(x5, 29, 16)^BUP(x6,  9, 17)^BDN(x6, 21, 18)^BUP(x7,  1, 19)^BUP(x7, 13, 20)^BDN(x7, 25, 21)^BUP(x0,  4, 22)^BUP(x0, 16, 23)^BDN(x0, 28, 24)^BUP(x1,  8, 25)^BUP(x1, 20, 26)^BUP(x2,  0, 27)^BUP(x2, 12, 28)^BUP(x2, 24, 29)^BUP(x3,  4, 30)^BUP(x3, 16, 31);

      this.x[3] = BDN(x3, 28,  0)^BDN(x4,  8,  1)^BDN(x4, 20,  2)^BUP(x5,  0,  3)^BDN(x5, 12,  4)^BDN(x5, 24,  5)^BUP(x6,  4,  6)^BDN(x6, 16,  7)^BDN(x6, 28,  8)^BUP(x7,  8,  9)^BDN(x7, 20, 10)^BUP(x8,  0, 11)^BUP(x0, 11, 12)^BDN(x0, 23, 13)^BUP(x1,  3, 14)^BCP(x1, 15)^BDN(x1, 27, 16)^BUP(x2,  7, 17)^BDN(x2, 19, 18)^BDN(x2, 31, 19)^BUP(x3, 11, 20)^BDN(x3, 23, 21)^BUP(x4,  3, 22)^BUP(x4, 15, 23)^BDN(x4, 27, 24)^BUP(x5,  7, 25)^BUP(x5, 19, 26)^BDN(x5, 31, 27)^BUP(x6, 11, 28)^BUP(x6, 23, 29)^BUP(x7,  3, 30)^BUP(x7, 15, 31);

      this.x[4] = BDN(x7, 27,  0)^BDN(x0,  6,  1)^BDN(x0, 18,  2)^BDN(x0, 30,  3)^BDN(x1, 10,  4)^BDN(x1, 22,  5)^BUP(x2,  2,  6)^BDN(x2, 14,  7)^BDN(x2, 26,  8)^BUP(x3,  6,  9)^BDN(x3, 18, 10)^BDN(x3, 30, 11)^BUP(x4, 10, 12)^BDN(x4, 22, 13)^BUP(x5,  2, 14)^BUP(x5, 14, 15)^BDN(x5, 26, 16)^BUP(x6,  6, 17)^BCP(x6, 18)^BDN(x6, 30, 19)^BUP(x7, 10, 20)^BDN(x7, 22, 21)^BUP(x0,  1, 22)^BUP(x0, 13, 23)^BDN(x0, 25, 24)^BUP(x1,  5, 25)^BUP(x1, 17, 26)^BDN(x1, 29, 27)^BUP(x2,  9, 28)^BUP(x2, 21, 29)^BUP(x3,  1, 30)^BUP(x3, 13, 31);

      this.x[5] = BDN(x3, 25,  0)^BDN(x4,  5,  1)^BDN(x4, 17,  2)^BDN(x4, 29,  3)^BDN(x5,  9,  4)^BDN(x5, 21,  5)^BUP(x6,  1,  6)^BDN(x6, 13,  7)^BDN(x6, 25,  8)^BUP(x7,  5,  9)^BDN(x7, 17, 10)^BDN(x7, 29, 11)^BUP(x0,  8, 12)^BDN(x0, 20, 13)^BUP(x1,  0, 14)^BUP(x1, 12, 15)^BDN(x1, 24, 16)^BUP(x2,  4, 17)^BUP(x2, 16, 18)^BDN(x2, 28, 19)^BUP(x3,  8, 20)^BUP(x3, 20, 21)^BUP(x4,  0, 22)^BUP(x4, 12, 23)^BCP(x4, 24)^BUP(x5,  4, 25)^BUP(x5, 16, 26)^BDN(x5, 28, 27)^BUP(x6,  8, 28)^BUP(x6, 20, 29)^BUP(x7,  0, 30)^BUP(x7, 12, 31);

      this.x[6] = BDN(x7, 24,  0)^BDN(x0,  3,  1)^BDN(x0, 15,  2)^BDN(x0, 27,  3)^BDN(x1,  7,  4)^BDN(x1, 19,  5)^BDN(x1, 31,  6)^BDN(x2, 11,  7)^BDN(x2, 23,  8)^BUP(x3,  3,  9)^BDN(x3, 15, 10)^BDN(x3, 27, 11)^BUP(x4,  7, 12)^BDN(x4, 19, 13)^BDN(x4, 31, 14)^BUP(x5, 11, 15)^BDN(x5, 23, 16)^BUP(x6,  3, 17)^BUP(x6, 15, 18)^BDN(x6, 27, 19)^BUP(x7,  7, 20)^BUP(x7, 19, 21)^BDN(x7, 31, 22)^BUP(x0, 10, 23)^BUP(x0, 22, 24)^BUP(x1,  2, 25)^BUP(x1, 14, 26)^BUP(x1, 26, 27)^BUP(x2,  6, 28)^BUP(x2, 18, 29)^BCP(x2, 30)^BUP(x3, 10, 31);

      this.x[7] = BDN(x3, 22,  0)^BDN(x4,  2,  1)^BDN(x4, 14,  2)^BDN(x4, 26,  3)^BDN(x5,  6,  4)^BDN(x5, 18,  5)^BDN(x5, 30,  6)^BDN(x6, 10,  7)^BDN(x6, 22,  8)^BUP(x7,  2,  9)^BDN(x7, 14, 10)^BDN(x7, 26, 11)^BUP(x0,  5, 12)^BDN(x0, 17, 13)^BDN(x0, 29, 14)^BUP(x1,  9, 15)^BDN(x1, 21, 16)^BUP(x2,  1, 17)^BUP(x2, 13, 18)^BDN(x2, 25, 19)^BUP(x3,  5, 20)^BUP(x3, 17, 21)^BDN(x3, 29, 22)^BUP(x4,  9, 23)^BUP(x4, 21, 24)^BUP(x5,  1, 25)^BUP(x5, 13, 26)^BUP(x5, 25, 27)^BUP(x6,  5, 28)^BUP(x6, 17, 29)^BUP(x6, 29, 30)^BUP(x7,  9, 31);

      this.x[8] = BDN(x7, 21, 0);
    }

    /**
     * Absorbs a single byte into the state
     * Bits are rearranged according to the permutation pattern
     */
    absorb1(data) {
      const x = data&0xFF;

      // Rearrange bits and absorb into state (from C reference)
      this.x[0] = (this.x[0]^(OpCodes.Shl32(x, 1)&0x00000002)) >>> 0;
      this.x[1] = (this.x[1]^(x&0x00000008)) >>> 0;
      this.x[2] = OpCodes.Xor32(this.x[2], 0x00000001); // 9th padding bit is always 1
      this.x[4] = (this.x[4]^((OpCodes.Shl32(x, 6)&0x00000100)^(OpCodes.Shl32(x, 1)&0x00000040))) >>> 0;
      this.x[5] = (this.x[5]^(OpCodes.Shl32(x, 15)&0x00010000)) >>> 0;
      this.x[6] = (this.x[6]^(OpCodes.Shr32(x, 1)&0x00000020)) >>> 0;
      this.x[7] = (this.x[7]^((OpCodes.Shl32(x, 21)&0x02000000)^(OpCodes.Shl32(x, 3)&0x00000400))) >>> 0;
    }

    /**
     * Absorbs a 32-bit word into the state
     * Implements complex bit permutation from C reference
     */
    absorbWord(word) {
      let x = OpCodes.ToUint32(word);
      let y;

      // Permutation P1
      const leftRotate5 = (v) => OpCodes.RotL32(v, 5);
      const leftRotate6 = (v) => OpCodes.RotL32(v, 6);
      const leftRotate12 = (v) => OpCodes.RotL32(v, 12);

      y = (x&0x00080008)|OpCodes.Shl32((x&0x00004001), 1)|OpCodes.Shl32((x&0x00000080), 3)|OpCodes.Shl32((x&0x04000000), 4)|leftRotate6(x&0x80000004)|OpCodes.Shl32((x&0x00400000), 7)|leftRotate12(x&0x01000200)|OpCodes.Shl32((x&0x00000800), 13)|OpCodes.Shl32((x&0x00000002), 15)|OpCodes.Shr32((x&0x08000000), 15)|OpCodes.Shl32((x&0x00002000), 18)|OpCodes.Shr32((x&0x40000000), 13)|OpCodes.Shl32((x&0x00000010), 21)|OpCodes.Shr32((x&0x00001000), 10)|OpCodes.Shr32((x&0x00048000), 9)|OpCodes.Shr32((x&0x00000100), 8)|OpCodes.Shr32((x&0x20000000), 7)|OpCodes.Shr32((x&0x00020000), 6);

      // Permutation P2
      x = OpCodes.Shl32((x&0x00010020), 1)|leftRotate5(x&0x12000000)|OpCodes.Shr32((x&0x00100000), 20)|OpCodes.Shr32((x&0x00200000), 12)|OpCodes.Shl32((x&0x00000400), 21)|OpCodes.Shr32((x&0x00800000), 8)|OpCodes.Shr32((x&0x00000040), 1);

      // Integrate rearranged bits into state
      this.x[0] = (this.x[0]^(y&0x40428816)) >>> 0;
      this.x[1] = (this.x[1]^(y&0x00000008)) >>> 0;
      this.x[2] = (this.x[2]^(y&0x80000041)) >>> 0;
      this.x[3] = (this.x[3]^(x&0x00008000)) >>> 0;
      this.x[4] = (this.x[4]^((y&0x00001300)^(x&0x00000041))) >>> 0;
      this.x[5] = (this.x[5]^((y&0x21010020)^(x&0x40000200))) >>> 0;
      this.x[6] = (this.x[6]^((y&0x00280000)^(x&0x80000020))) >>> 0;
      this.x[7] = (this.x[7]^((y&0x02000400)^(x&0x00020002))) >>> 0;
    }

    /**
     * Extracts 32 bits of output from the state
     */
    extract() {
      let x, y;

      // Extract and permute bits from state (from C reference)
      const leftRotate27 = (v) => OpCodes.RotL32(v, 27);

      // P0
      x = this.x[0];
      x = (x&0x00010000)|OpCodes.Shl32((x&0x00000800), 6)|OpCodes.Shl32((x&0x00400000), 7)|OpCodes.Shl32((x&0x00000004), 10)|OpCodes.Shl32((x&0x00020000), 13)|OpCodes.Shr32((x&0x00800000), 16)|OpCodes.Shl32((x&0x00000010), 20)|OpCodes.Shr32((x&0x40000100), 4)|OpCodes.Shr32((x&0x00008002), 1);
      y = x&0x65035091;

      // P1
      x = this.x[1];
      x = (x&0x00000008)|OpCodes.Shl32((x&0x00004000), 5)|OpCodes.Shl32((x&0x00000004), 8)|OpCodes.Shr32((x&0x10000000), 22)|OpCodes.Shl32((x&0x00000001), 28)|OpCodes.Shr32((x&0x00001000), 3);
      y = (y^(x&0x10080648)) >>> 0;

      // P2
      x = this.x[2];
      x = OpCodes.Shl32((x&0x00000200), 2)|OpCodes.Shl32((x&0x10000000), 3)|OpCodes.Shl32((x&0x00000001), 8)|OpCodes.Shl32((x&0x00000040), 9)|OpCodes.Shr32((x&0x80000000), 18)|OpCodes.Shr32((x&0x00020000), 16)|OpCodes.Shl32((x&0x00000010), 18)|OpCodes.Shl32((x&0x00000008), 22)|OpCodes.Shr32((x&0x01000000), 3);
      y = (y^(x&0x8260a902)) >>> 0;

      // P3
      x = this.x[3];
      x = OpCodes.Shl32((x&0x00200000), 6)|OpCodes.Shl32((x&0x00008000), 8)|OpCodes.Shr32((x&0x02000000), 23)|OpCodes.Shr32((x&0x08000000), 22)|OpCodes.Shr32((x&0x01000000), 6);
      y = (y^(x&0x08840024)) >>> 0;

      // P4 (with duplicated bit 20)
      x = this.x[4];
      y = (y^(OpCodes.Shl32(x, 20)&0x00100000)) >>> 0;
      x = OpCodes.Shl32((x&0x00040000), 5)|OpCodes.Shl32((x&0x00000200), 9)|OpCodes.Shl32((x&0x00001000), 15)|OpCodes.Shl32((x&0x00000002), 19)|OpCodes.Shr32((x&0x00000100), 6)|OpCodes.Shr32((x&0x00000040), 1);
      y = (y^(x&0x08940024)) >>> 0;

      // P5
      x = this.x[5];
      x = OpCodes.Shl32((x&0x00000004), 11)|OpCodes.Shl32((x&0x00000200), 12)|OpCodes.Shr32((x&0x00010000), 15)|OpCodes.Shr32((x&0x01000000), 13)|OpCodes.Shr32((x&0x08000000), 12)|OpCodes.Shr32((x&0x20000000), 7)|OpCodes.Shl32((x&0x00000020), 26)|OpCodes.Shr32((x&0x40000000), 5);
      y = (y^(x&0x8260a802)) >>> 0;

      // P6
      x = this.x[6];
      x = (x&0x00080000)|OpCodes.Shl32((x&0x00000020), 1)|OpCodes.Shr32((x&0x40000000), 27)|OpCodes.Shl32((x&0x00000002), 7)|OpCodes.Shr32((x&0x80000000), 21)|OpCodes.Shr32((x&0x00200000), 12);
      y = (y^(x&0x00080748)) >>> 0;

      // P7
      x = this.x[7];
      x = OpCodes.Shr32((x&0x02000000), 21)|OpCodes.Shr32((x&0x80000000), 19)|OpCodes.Shl32((x&0x00010000), 14)|OpCodes.Shl32((x&0x00000800), 18)|OpCodes.Shl32((x&0x00000008), 23)|leftRotate27(x&0x20400002)|OpCodes.Shr32((x&0x00040000), 4)|OpCodes.Shr32((x&0x00000400), 3)|OpCodes.Shr32((x&0x00020000), 1);
      y = (y^(x&0x75035090)) >>> 0;

      // XOR with bit 8
      return OpCodes.Xor32(y, this.x[8]);
    }

    /**
     * Performs 8 blank rounds (no data absorption)
     */
    blank() {
      for (let i = 0; i < 8; ++i) {
        this.round();
        this.x[0] = OpCodes.Xor32(this.x[0], 0x02); // padding
      }
    }

    /**
     * Duplex operation: round + absorb 0 bytes
     */
    duplex0() {
      this.round();
      this.x[0] = OpCodes.Xor32(this.x[0], 0x02); // padding for empty block
    }

    /**
     * Duplex operation: round + absorb 1 byte
     */
    duplex1(data) {
      this.round();
      this.absorb1(data);
    }

    /**
     * Duplex operation: round + absorb 4 bytes
     */
    duplex4(word) {
      this.round();
      this.absorbWord(word);
      this.x[8] = OpCodes.Xor32(this.x[8], 1);
    }

    /**
     * Duplex operation: round + absorb n bytes (0-4)
     */
    duplexN(data, len) {
      this.round();

      if (len === 0) {
        this.x[0] = OpCodes.Xor32(this.x[0], 0x02);
      } else if (len === 1) {
        this.absorb1(data[0]);
      } else if (len === 2) {
        const word = OpCodes.Pack32LE(data[0], data[1], 0, 0)|0x10000;
        this.absorbWord(word);
      } else if (len === 3) {
        const word = OpCodes.Pack32LE(data[0], data[1], data[2], 0)|0x01000000;
        this.absorbWord(word);
      } else {
        const word = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
        this.absorbWord(word);
        this.x[8] = OpCodes.Xor32(this.x[8], 1);
      }
    }

    /**
     * Absorbs arbitrary length data, 4 bytes at a time
     */
    absorb(data) {
      let offset = 0;

      while (offset + 4 <= data.length) {
        const word = OpCodes.Pack32LE(
          data[offset], data[offset + 1],
          data[offset + 2], data[offset + 3]
        );
        this.duplex4(word);
        offset += 4;
      }

      const remaining = data.length - offset;
      // Always call duplexN with remaining bytes (even if 0)
      this.duplexN(data.slice(offset), remaining);
    }

    /**
     * Squeezes output bytes from the state
     */
    squeeze(length) {
      const output = [];

      while (length > 4) {
        const word = this.extract();
        this.duplex0();
        const bytes = OpCodes.Unpack32LE(word);
        output.push(bytes[0], bytes[1], bytes[2], bytes[3]);
        length -= 4;
      }

      if (length === 4) {
        const word = this.extract();
        const bytes = OpCodes.Unpack32LE(word);
        output.push(bytes[0], bytes[1], bytes[2], bytes[3]);
      } else if (length > 0) {
        const word = this.extract();
        const bytes = OpCodes.Unpack32LE(word);
        for (let i = 0; i < length; ++i) {
          output.push(bytes[i]);
        }
      }

      return output;
    }
  }

  // ========================[ SUBTERRANEAN AEAD ALGORITHM ]========================

  class SubterraneanAEAD extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "Subterranean AEAD";
      this.description = "Minimalist duplex sponge AEAD construction with 257-bit permutation. NIST LWC Round 2 candidate designed for hardware efficiency.";
      this.inventor = "Joan Daemen, Pedro Maat Costa Massolino, Yann Rotella";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Lightweight Cryptography";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.NETHERLANDS;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedTagSizes = [new KeySize(16, 16, 1)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem(
          "Subterranean 2.0 Specification",
          "https://cs.ru.nl/~joan/subterranean.html"
        ),
        new LinkItem(
          "NIST LWC Submission",
          "https://csrc.nist.gov/projects/lightweight-cryptography/round-2-candidates"
        ),
        new LinkItem(
          "C Reference Implementation",
          "https://github.com/rweather/lightweight-crypto"
        )
      ];

      // Official test vectors from NIST LWC KAT files
      this.tests = [
        {
          text: "Subterranean: Empty message, empty AAD (Count 1)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("119838E888C950CDB651E73E1BE37CFB")
        },
        {
          text: "Subterranean: Empty message, 1-byte AAD (Count 2)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("70ED5336DA2EE7A99BAE0CE68832FE0E")
        },
        {
          text: "Subterranean: Empty message, 4-byte AAD (Count 5)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("00010203"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("3239852BC3478B82EDB25C47F6C13ECE")
        },
        {
          text: "Subterranean: 1-byte plaintext, empty AAD (Count 44)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("5FABCEADE76378EA5E2F79F0B5417EB3D5")
        },
        {
          text: "Subterranean: 4-byte plaintext, empty AAD (Count 133)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("5FAE2772E4148412D4479A84F6A0B20EC8E4429B")
        },
        {
          text: "Subterranean: 16-byte plaintext, 8-byte AAD (Count 537)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("0001020304050607"),
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("52B608B5E28E649B680C7B9B6C7DACD5C839DA24570162F6B6F401CE1FF020D9")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SubterraneanAEADInstance(this, isInverse);
    }
  }

  // ========================[ SUBTERRANEAN AEAD INSTANCE ]========================

  /**
 * SubterraneanAEAD cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SubterraneanAEADInstance extends IAeadInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._nonce = null;
      this._aad = [];
      this.inputBuffer = [];
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      if (keyBytes.length !== 16) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 16)`);
      }

      this._key = [...keyBytes];
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() { return this._key ? [...this._key] : null; }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (nonceBytes.length !== 16) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected 16)`);
      }

      this._nonce = [...nonceBytes];
    }

    get nonce() { return this._nonce ? [...this._nonce] : null; }

    set aad(aadBytes) {
      if (!aadBytes) {
        this._aad = [];
        return;
      }
      this._aad = [...aadBytes];
    }

    get aad() { return [...this._aad]; }

    set associatedData(adBytes) {
      this.aad = adBytes;
    }

    get associatedData() {
      return this.aad;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");

      if (this.isInverse) {
        return this._decrypt();
      } else {
        return this._encrypt();
      }
    }

    _encrypt() {
      const plaintext = this.inputBuffer;
      const state = new SubterraneanState();
      const output = [];

      // Initialize state and absorb key and nonce
      state.absorb(this._key);
      state.absorb(this._nonce);
      state.blank();

      // Absorb associated data (even if empty - padding is applied)
      state.absorb(this._aad);

      // Encrypt plaintext
      let offset = 0;
      while (offset + 4 <= plaintext.length) {
        const word = OpCodes.Pack32LE(
          plaintext[offset], plaintext[offset + 1],
          plaintext[offset + 2], plaintext[offset + 3]
        );
        const extracted = state.extract();
        const cipherWord = OpCodes.Xor32(extracted, word);
        state.duplex4(word);

        const cipherBytes = OpCodes.Unpack32LE(cipherWord);
        output.push(cipherBytes[0], cipherBytes[1], cipherBytes[2], cipherBytes[3]);
        offset += 4;
      }

      // Handle remaining bytes
      const remaining = plaintext.length - offset;
      if (remaining > 0) {
        const extracted = state.extract();
        const extractedBytes = OpCodes.Unpack32LE(extracted);

        for (let i = 0; i < remaining; ++i) {
          output.push((extractedBytes[i]^plaintext[offset + i])&0xFF);
        }

        state.duplexN(plaintext.slice(offset), remaining);
      } else if (plaintext.length === 0 || remaining === 0) {
        state.duplex0();
      }

      // Generate authentication tag
      state.blank();
      const tag = state.squeeze(16);
      output.push(...tag);

      // Clear state
      this.inputBuffer = [];

      return output;
    }

    _decrypt() {
      if (this.inputBuffer.length < 16) {
        throw new Error("Ciphertext too short (must include 16-byte tag)");
      }

      const ciphertext = this.inputBuffer.slice(0, -16);
      const receivedTag = this.inputBuffer.slice(-16);
      const state = new SubterraneanState();
      const output = [];

      // Initialize state and absorb key and nonce
      state.absorb(this._key);
      state.absorb(this._nonce);
      state.blank();

      // Absorb associated data (even if empty - padding is applied)
      state.absorb(this._aad);

      // Decrypt ciphertext
      let offset = 0;
      while (offset + 4 <= ciphertext.length) {
        const cipherWord = OpCodes.Pack32LE(
          ciphertext[offset], ciphertext[offset + 1],
          ciphertext[offset + 2], ciphertext[offset + 3]
        );
        const extracted = state.extract();
        const plainWord = OpCodes.Xor32(extracted, cipherWord);
        state.duplex4(plainWord);

        const plainBytes = OpCodes.Unpack32LE(plainWord);
        output.push(plainBytes[0], plainBytes[1], plainBytes[2], plainBytes[3]);
        offset += 4;
      }

      // Handle remaining bytes
      const remaining = ciphertext.length - offset;
      if (remaining > 0) {
        const extracted = state.extract();
        const extractedBytes = OpCodes.Unpack32LE(extracted);
        const plainBytes = [];

        for (let i = 0; i < remaining; ++i) {
          const plainByte = (extractedBytes[i]^ciphertext[offset + i])&0xFF;
          output.push(plainByte);
          plainBytes.push(plainByte);
        }

        state.duplexN(plainBytes, remaining);
      } else if (ciphertext.length === 0 || remaining === 0) {
        state.duplex0();
      }

      // Verify authentication tag
      state.blank();
      const computedTag = state.squeeze(16);

      // Constant-time tag comparison
      let tagMatch = true;
      for (let i = 0; i < 16; ++i) {
        if (computedTag[i] !== receivedTag[i]) {
          tagMatch = false;
        }
      }

      if (!tagMatch) {
        throw new Error("Authentication tag verification failed");
      }

      // Clear state
      this.inputBuffer = [];

      return output;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new SubterraneanAEAD());

  return SubterraneanAEAD;
}));
