/*
 * Saturnin AEAD Family - NIST Lightweight Cryptography Round 2 Candidate
 * Implements SATURNIN-CTR-Cascade and SATURNIN-Short variants
 * Based on 256-bit block cipher with bit-sliced structure
 * Reference: https://project.inria.fr/saturnin/
 * Reference Implementation: https://github.com/rweather/lwc-finalists
 * (c)2006-2025 Hawkynt
 *
 * The bit-sliced block cipher layout - the word ordering that the MDS layer
 * leaves behind and that each following layer has to be told about - follows
 * the reference implementation in rweather/lightweight-crypto, which is
 * distributed under the MIT licence:
 *
 *   Copyright (C) 2020 Southern Storm Software, Pty Ltd.
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a
 *   copy of this software and associated documentation files (the "Software"),
 *   to deal in the Software without restriction, including without limitation
 *   the rights to use, copy, modify, merge, publish, distribute, sublicense,
 *   and/or sell copies of the Software, and to permit persons to whom the
 *   Software is furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included
 *   in all copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 *   OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 *   FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 *   DEALINGS IN THE SOFTWARE.
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
          AeadAlgorithm, IAeadInstance, LinkItem } = AlgorithmFramework;

// Saturnin Round Constants for different domain separators
// RC_10_1 (Domain 0, 10 rounds)
/** @type {uint32[]} */
const SATURNIN_RC_10_1 = [0x4eb026c2, 0x90595303, 0xaa8fe632, 0xfe928a92, 0x4115a419,
   0x93539532, 0x5db1cc4e, 0x541515ca, 0xbd1f55a8, 0x5a6e1a0d];
// RC_10_2 (Domain 1, 10 rounds)
/** @type {uint32[]} */
const SATURNIN_RC_10_2 = [0x4e4526b5, 0xa3565ff0, 0x0f8f20d8, 0x0b54bee1, 0x7d1a6c9d,
   0x17a6280a, 0xaa46c986, 0xc1199062, 0x182c5cde, 0xa00d53fe];
// RC_10_3 (Domain 2, 10 rounds)
/** @type {uint32[]} */
const SATURNIN_RC_10_3 = [0x4e162698, 0xb2535ba1, 0x6c8f9d65, 0x5816ad30, 0x691fd4fa,
   0x6bf5bcf9, 0xf8eb3525, 0xb21decfa, 0x7b3da417, 0xf62c94b4];
// RC_10_4 (Domain 3, 10 rounds)
/** @type {uint32[]} */
const SATURNIN_RC_10_4 = [0x4faf265b, 0xc5484616, 0x45dcad21, 0xe08bd607, 0x0504fdb8,
   0x1e1f5257, 0x45fbc216, 0xeb529b1f, 0x52194e32, 0x5498c018];
// RC_10_5 (Domain 4, 10 rounds)
/** @type {uint32[]} */
const SATURNIN_RC_10_5 = [0x4ffc2676, 0xd44d4247, 0x26dc109c, 0xb3c9c5d6, 0x110145df,
   0x624cc6a4, 0x17563eb5, 0x9856e787, 0x3108b6fb, 0x02b90752];
// RC_10_6 (Domain 5, 10 rounds)
/** @type {uint32[]} */
const SATURNIN_RC_10_6 = [0x4f092601, 0xe7424eb4, 0x83dcd676, 0x460ff1a5, 0x2d0e8d5b,
   0xe6b97b9c, 0xe0a13b7d, 0x0d5a622f, 0x943bbf8d, 0xf8da4ea1];
// RC_16_7 (Domain 6, 16 rounds)
/** @type {uint32[]} */
const SATURNIN_RC_16_7 = [0x3fba180c, 0x563ab9ab, 0x125ea5ef, 0x859da26c, 0xb8cf779b,
   0x7d4de793, 0x07efb49f, 0x8d525306, 0x1e08e6ab, 0x41729f87,
   0x8c4aef0a, 0x4aa0c9a7, 0xd93a95ef, 0xbb00d2af, 0xb62c5bf0,
   0x386d94d8];
// RC_16_8 (Domain 7, 16 rounds)
/** @type {uint32[]} */
const SATURNIN_RC_16_8 = [0x3c9b19a7, 0xa9098694, 0x23f878da, 0xa7b647d3, 0x74fc9d78,
   0xeacaae11, 0x2f31a677, 0x4cc8c054, 0x2f51ca05, 0x5268f195,
   0x4f5b8a2b, 0xf614b4ac, 0xf1d95401, 0x764d2568, 0x6a493611,
   0x8eef9c3e];
/** @type {uint32[][]} */
const SATURNIN_RC = Object.freeze([
  Object.freeze(SATURNIN_RC_10_1),
  Object.freeze(SATURNIN_RC_10_2),
  Object.freeze(SATURNIN_RC_10_3),
  Object.freeze(SATURNIN_RC_10_4),
  Object.freeze(SATURNIN_RC_10_5),
  Object.freeze(SATURNIN_RC_10_6),
  Object.freeze(SATURNIN_RC_16_7),
  Object.freeze(SATURNIN_RC_16_8)
]);

// Domain separator constants
const SATURNIN_DOMAIN_10_1 = 0;
const SATURNIN_DOMAIN_10_2 = 1;
const SATURNIN_DOMAIN_10_3 = 2;
const SATURNIN_DOMAIN_10_4 = 3;
const SATURNIN_DOMAIN_10_5 = 4;
const SATURNIN_DOMAIN_10_6 = 5;
const SATURNIN_DOMAIN_16_7 = 6;
const SATURNIN_DOMAIN_16_8 = 7;

// Saturnin Block Cipher Core - Bit-sliced Implementation
class SaturninCipher {
  constructor() {
    // Key schedule: 16 32-bit words (8 regular + 8 rotated)
    /** @type {uint32[]} */
    this.k = new Array(16);
  }

  // Load 32-bit word from Saturnin block format
  // Special byte ordering: bytes at positions [0, 1, 16, 17] form a 32-bit word
  /**
   * @param {uint8[]} block
   * @param {int32} offset
   * @returns {uint32}
   */
  loadWord32(block, offset) {
    // Using OpCodes for byte packing - note: custom order [0,1,16,17]
    return OpCodes.Pack32LE(
      block[offset],
      block[offset + 1],
      block[offset + 16],
      block[offset + 17]
    );
  }

  // Store 32-bit word to Saturnin block format
  /**
   * @param {uint8[]} block
   * @param {int32} offset
   * @param {uint32} x
   */
  storeWord32(block, offset, x) {
    // Using OpCodes for byte unpacking
    const bytes = OpCodes.Unpack32LE(x);
    block[offset] = bytes[0];
    block[offset + 1] = bytes[1];
    block[offset + 16] = bytes[2];
    block[offset + 17] = bytes[3];
  }

  // Setup key schedule from 256-bit key
  /**
   * @param {uint8[]} key
   */
  setupKey(key) {
    for (let index = 0; index < 16; index += 2) {
      const temp = this.loadWord32(key, index);
      this.k[index / 2] = temp;
      // Rotated key: 5-bit rotation within each 16-bit half
      // Note: Custom bit-sliced operation for Saturnin's key schedule
      // Rotates bits 0-15 and 16-31 independently by 5 positions
      this.k[8 + (index / 2)] = OpCodes.ToUint32(OpCodes.Or32(OpCodes.Shl32(OpCodes.And32(temp, 0x001F001F), 11),
                                OpCodes.And32(OpCodes.Shr32(temp, 5), 0x07FF07FF)));
    }
  }

  // Bit-sliced S-box
  /**
   * @param {uint32[]} w
   * @param {int32} a
   * @param {int32} b
   * @param {int32} c
   * @param {int32} d
   */
  sbox(w, a, b, c, d) {
    w[a] = OpCodes.Xor32(w[a], OpCodes.And32(w[b], w[c]));
    w[b] = OpCodes.Xor32(w[b], OpCodes.Or32(w[a], w[d]));
    w[d] = OpCodes.Xor32(w[d], OpCodes.Or32(w[b], w[c]));
    w[c] = OpCodes.Xor32(w[c], OpCodes.And32(w[b], w[d]));
    w[b] = OpCodes.Xor32(w[b], OpCodes.Or32(w[a], w[c]));
    w[a] = OpCodes.Xor32(w[a], OpCodes.Or32(w[b], w[d]));
  }

  // Inverse bit-sliced S-box
  /**
   * @param {uint32[]} w
   * @param {int32} a
   * @param {int32} b
   * @param {int32} c
   * @param {int32} d
   */
  sboxInverse(w, a, b, c, d) {
    w[a] = OpCodes.Xor32(w[a], OpCodes.Or32(w[b], w[d]));
    w[b] = OpCodes.Xor32(w[b], OpCodes.Or32(w[a], w[c]));
    w[c] = OpCodes.Xor32(w[c], OpCodes.And32(w[b], w[d]));
    w[d] = OpCodes.Xor32(w[d], OpCodes.Or32(w[b], w[c]));
    w[b] = OpCodes.Xor32(w[b], OpCodes.Or32(w[a], w[d]));
    w[a] = OpCodes.Xor32(w[a], OpCodes.And32(w[b], w[c]));
  }

  // Rotate 4-bit nibbles within 16-bit halves
  // Note: Custom bit-sliced permutation for Saturnin's slice layer
  // Applies independent rotations to low and high 16-bit halves
  /**
   * @param {uint32} a
   * @param {uint32} mask1
   * @param {int32} bits1
   * @param {uint32} mask2
   * @param {int32} bits2
   * @returns {uint32}
   */
  leftRotate4N(a, mask1, bits1, mask2, bits2) {
    return OpCodes.ToUint32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(
            OpCodes.Shl32(OpCodes.And32(a, mask1), bits1),
            OpCodes.Shr32(OpCodes.And32(a, OpCodes.Xor32(mask1, 0xFFFF)), (4 - bits1))),
            OpCodes.Shl32(OpCodes.And32(a, OpCodes.ToUint32(OpCodes.Shl32(mask2, 16))), bits2)),
            OpCodes.Shr32(OpCodes.And32(a, OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Shl32(mask2, 16), 0xFFFF0000))), (4 - bits2))));
  }

  // Rotate 16-bit subwords
  // Note: Custom bit-sliced permutation for Saturnin's sheet layer
  // Applies independent rotations to low and high 16-bit halves
  /**
   * @param {uint32} a
   * @param {uint32} mask1
   * @param {int32} bits1
   * @param {uint32} mask2
   * @param {int32} bits2
   * @returns {uint32}
   */
  leftRotate16N(a, mask1, bits1, mask2, bits2) {
    return OpCodes.ToUint32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(
            OpCodes.Shl32(OpCodes.And32(a, mask1), bits1),
            OpCodes.Shr32(OpCodes.And32(a, OpCodes.Xor32(mask1, 0xFFFF)), (16 - bits1))),
            OpCodes.Shl32(OpCodes.And32(a, OpCodes.ToUint32(OpCodes.Shl32(mask2, 16))), bits2)),
            OpCodes.Shr32(OpCodes.And32(a, OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Shl32(mask2, 16), 0xFFFF0000))), (16 - bits2))));
  }

  // The MDS layer permutes the eight bit-sliced words implicitly: rather than
  // moving the words around, each following layer is told which slot now holds
  // which word. Every layer below therefore takes its eight operands as
  // explicit w indices instead of assuming the natural 0..7 order.

  // Slice permutation
  /**
   * @param {uint32[]} w
   * @param {int32} i0
   * @param {int32} i1
   * @param {int32} i2
   * @param {int32} i3
   * @param {int32} i4
   * @param {int32} i5
   * @param {int32} i6
   * @param {int32} i7
   */
  slice(w, i0, i1, i2, i3, i4, i5, i6, i7) {
    w[i0] = this.leftRotate4N(w[i0], 0xFFFF, 0, 0x3333, 2);
    w[i1] = this.leftRotate4N(w[i1], 0xFFFF, 0, 0x3333, 2);
    w[i2] = this.leftRotate4N(w[i2], 0xFFFF, 0, 0x3333, 2);
    w[i3] = this.leftRotate4N(w[i3], 0xFFFF, 0, 0x3333, 2);
    w[i4] = this.leftRotate4N(w[i4], 0x7777, 1, 0x1111, 3);
    w[i5] = this.leftRotate4N(w[i5], 0x7777, 1, 0x1111, 3);
    w[i6] = this.leftRotate4N(w[i6], 0x7777, 1, 0x1111, 3);
    w[i7] = this.leftRotate4N(w[i7], 0x7777, 1, 0x1111, 3);
  }

  // Inverse slice permutation
  /**
   * @param {uint32[]} w
   * @param {int32} i0
   * @param {int32} i1
   * @param {int32} i2
   * @param {int32} i3
   * @param {int32} i4
   * @param {int32} i5
   * @param {int32} i6
   * @param {int32} i7
   */
  sliceInverse(w, i0, i1, i2, i3, i4, i5, i6, i7) {
    w[i0] = this.leftRotate4N(w[i0], 0xFFFF, 0, 0x3333, 2);
    w[i1] = this.leftRotate4N(w[i1], 0xFFFF, 0, 0x3333, 2);
    w[i2] = this.leftRotate4N(w[i2], 0xFFFF, 0, 0x3333, 2);
    w[i3] = this.leftRotate4N(w[i3], 0xFFFF, 0, 0x3333, 2);
    w[i4] = this.leftRotate4N(w[i4], 0x1111, 3, 0x7777, 1);
    w[i5] = this.leftRotate4N(w[i5], 0x1111, 3, 0x7777, 1);
    w[i6] = this.leftRotate4N(w[i6], 0x1111, 3, 0x7777, 1);
    w[i7] = this.leftRotate4N(w[i7], 0x1111, 3, 0x7777, 1);
  }

  // Sheet permutation
  /**
   * @param {uint32[]} w
   * @param {int32} i0
   * @param {int32} i1
   * @param {int32} i2
   * @param {int32} i3
   * @param {int32} i4
   * @param {int32} i5
   * @param {int32} i6
   * @param {int32} i7
   */
  sheet(w, i0, i1, i2, i3, i4, i5, i6, i7) {
    w[i0] = this.leftRotate16N(w[i0], 0xFFFF, 0, 0x00FF, 8);
    w[i1] = this.leftRotate16N(w[i1], 0xFFFF, 0, 0x00FF, 8);
    w[i2] = this.leftRotate16N(w[i2], 0xFFFF, 0, 0x00FF, 8);
    w[i3] = this.leftRotate16N(w[i3], 0xFFFF, 0, 0x00FF, 8);
    w[i4] = this.leftRotate16N(w[i4], 0x0FFF, 4, 0x000F, 12);
    w[i5] = this.leftRotate16N(w[i5], 0x0FFF, 4, 0x000F, 12);
    w[i6] = this.leftRotate16N(w[i6], 0x0FFF, 4, 0x000F, 12);
    w[i7] = this.leftRotate16N(w[i7], 0x0FFF, 4, 0x000F, 12);
  }

  // Inverse sheet permutation
  /**
   * @param {uint32[]} w
   * @param {int32} i0
   * @param {int32} i1
   * @param {int32} i2
   * @param {int32} i3
   * @param {int32} i4
   * @param {int32} i5
   * @param {int32} i6
   * @param {int32} i7
   */
  sheetInverse(w, i0, i1, i2, i3, i4, i5, i6, i7) {
    w[i0] = this.leftRotate16N(w[i0], 0xFFFF, 0, 0x00FF, 8);
    w[i1] = this.leftRotate16N(w[i1], 0xFFFF, 0, 0x00FF, 8);
    w[i2] = this.leftRotate16N(w[i2], 0xFFFF, 0, 0x00FF, 8);
    w[i3] = this.leftRotate16N(w[i3], 0xFFFF, 0, 0x00FF, 8);
    w[i4] = this.leftRotate16N(w[i4], 0x000F, 12, 0x0FFF, 4);
    w[i5] = this.leftRotate16N(w[i5], 0x000F, 12, 0x0FFF, 4);
    w[i6] = this.leftRotate16N(w[i6], 0x000F, 12, 0x0FFF, 4);
    w[i7] = this.leftRotate16N(w[i7], 0x000F, 12, 0x0FFF, 4);
  }

  // XOR the key into the w. The n-th operand always receives k[n], so the
  // caller's index order decides which word each key word lands on.
  /**
   * @param {uint32[]} w
   * @param {int32} i0
   * @param {int32} i1
   * @param {int32} i2
   * @param {int32} i3
   * @param {int32} i4
   * @param {int32} i5
   * @param {int32} i6
   * @param {int32} i7
   */
  xorKey(w, i0, i1, i2, i3, i4, i5, i6, i7) {
    /** @type {int32[]} */
    const idx = [i0, i1, i2, i3, i4, i5, i6, i7];
    for (let n = 0; n < 8; n++) {
      w[idx[n]] = OpCodes.ToUint32(OpCodes.Xor32(w[idx[n]], this.k[n]));
    }
  }

  // XOR the rotated half of the key schedule into the w.
  /**
   * @param {uint32[]} w
   * @param {int32} i0
   * @param {int32} i1
   * @param {int32} i2
   * @param {int32} i3
   * @param {int32} i4
   * @param {int32} i5
   * @param {int32} i6
   * @param {int32} i7
   */
  xorKeyRotated(w, i0, i1, i2, i3, i4, i5, i6, i7) {
    /** @type {int32[]} */
    const idx = [i0, i1, i2, i3, i4, i5, i6, i7];
    for (let n = 0; n < 8; n++) {
      w[idx[n]] = OpCodes.ToUint32(OpCodes.Xor32(w[idx[n]], this.k[8 + n]));
    }
  }

  // MDS matrix helper
  /**
   * @param {uint32[]} w
   * @param {int32} x0
   * @param {int32} x1
   * @param {int32} x2
   * @param {int32} x3
   */
  mul(w, x0, x1, x2, x3) {
    w[x0] = OpCodes.ToUint32(OpCodes.Xor32(w[x0], w[x1]));
  }

  // Inverse MDS matrix helper
  /**
   * @param {uint32[]} w
   * @param {int32} x0
   * @param {int32} x1
   * @param {int32} x2
   * @param {int32} x3
   */
  mulInv(w, x0, x1, x2, x3) {
    w[x3] = OpCodes.ToUint32(OpCodes.Xor32(w[x3], w[x0]));
  }

  // SWAP helper for MDS - swaps 16-bit halves of 32-bit word
  /**
   * @param {uint32} x
   * @returns {uint32}
   */
  swap(x) {
    // Note: Custom cross-word operation not available in OpCodes
    return OpCodes.ToUint32(OpCodes.Or32(OpCodes.Shl32(x, 16), OpCodes.Shr32(x, 16)));
  }

  // MDS matrix
  /**
   * @param {uint32[]} w
   * @param {int32} x0
   * @param {int32} x1
   * @param {int32} x2
   * @param {int32} x3
   * @param {int32} x4
   * @param {int32} x5
   * @param {int32} x6
   * @param {int32} x7
   */
  mds(w, x0, x1, x2, x3, x4, x5, x6, x7) {
    w[x0] = OpCodes.ToUint32(OpCodes.Xor32(w[x0], w[x4]));
    w[x1] = OpCodes.ToUint32(OpCodes.Xor32(w[x1], w[x5]));
    w[x2] = OpCodes.ToUint32(OpCodes.Xor32(w[x2], w[x6]));
    w[x3] = OpCodes.ToUint32(OpCodes.Xor32(w[x3], w[x7]));

    this.mul(w, x4, x5, x6, x7);

    w[x5] = OpCodes.ToUint32(OpCodes.Xor32(w[x5], this.swap(w[x0])));
    w[x6] = OpCodes.ToUint32(OpCodes.Xor32(w[x6], this.swap(w[x1])));
    w[x7] = OpCodes.ToUint32(OpCodes.Xor32(w[x7], this.swap(w[x2])));
    w[x4] = OpCodes.ToUint32(OpCodes.Xor32(w[x4], this.swap(w[x3])));

    this.mul(w, x0, x1, x2, x3);
    this.mul(w, x1, x2, x3, x0);

    w[x2] = OpCodes.ToUint32(OpCodes.Xor32(w[x2], w[x5]));
    w[x3] = OpCodes.ToUint32(OpCodes.Xor32(w[x3], w[x6]));
    w[x0] = OpCodes.ToUint32(OpCodes.Xor32(w[x0], w[x7]));
    w[x1] = OpCodes.ToUint32(OpCodes.Xor32(w[x1], w[x4]));

    w[x5] = OpCodes.ToUint32(OpCodes.Xor32(w[x5], this.swap(w[x2])));
    w[x6] = OpCodes.ToUint32(OpCodes.Xor32(w[x6], this.swap(w[x3])));
    w[x7] = OpCodes.ToUint32(OpCodes.Xor32(w[x7], this.swap(w[x0])));
    w[x4] = OpCodes.ToUint32(OpCodes.Xor32(w[x4], this.swap(w[x1])));
  }

  // Inverse MDS matrix
  /**
   * @param {uint32[]} w
   * @param {int32} x0
   * @param {int32} x1
   * @param {int32} x2
   * @param {int32} x3
   * @param {int32} x4
   * @param {int32} x5
   * @param {int32} x6
   * @param {int32} x7
   */
  mdsInverse(w, x0, x1, x2, x3, x4, x5, x6, x7) {
    w[x6] = OpCodes.ToUint32(OpCodes.Xor32(w[x6], this.swap(w[x2])));
    w[x7] = OpCodes.ToUint32(OpCodes.Xor32(w[x7], this.swap(w[x3])));
    w[x4] = OpCodes.ToUint32(OpCodes.Xor32(w[x4], this.swap(w[x0])));
    w[x5] = OpCodes.ToUint32(OpCodes.Xor32(w[x5], this.swap(w[x1])));

    w[x0] = OpCodes.ToUint32(OpCodes.Xor32(w[x0], w[x4]));
    w[x1] = OpCodes.ToUint32(OpCodes.Xor32(w[x1], w[x5]));
    w[x2] = OpCodes.ToUint32(OpCodes.Xor32(w[x2], w[x6]));
    w[x3] = OpCodes.ToUint32(OpCodes.Xor32(w[x3], w[x7]));

    this.mulInv(w, x0, x1, x2, x3);
    this.mulInv(w, x3, x0, x1, x2);

    w[x6] = OpCodes.ToUint32(OpCodes.Xor32(w[x6], this.swap(w[x0])));
    w[x7] = OpCodes.ToUint32(OpCodes.Xor32(w[x7], this.swap(w[x1])));
    w[x4] = OpCodes.ToUint32(OpCodes.Xor32(w[x4], this.swap(w[x2])));
    w[x5] = OpCodes.ToUint32(OpCodes.Xor32(w[x5], this.swap(w[x3])));

    this.mulInv(w, x4, x5, x6, x7);

    w[x2] = OpCodes.ToUint32(OpCodes.Xor32(w[x2], w[x7]));
    w[x3] = OpCodes.ToUint32(OpCodes.Xor32(w[x3], w[x4]));
    w[x0] = OpCodes.ToUint32(OpCodes.Xor32(w[x0], w[x5]));
    w[x1] = OpCodes.ToUint32(OpCodes.Xor32(w[x1], w[x6]));
  }

  // Encrypt a 256-bit block
  /**
   * @param {uint8[]} output
   * @param {uint8[]} input
   * @param {int32} domain
   */
  encryptBlock(output, input, domain) {
    const rounds = (domain >= SATURNIN_DOMAIN_16_7) ? 8 : 5;
    const rc = SATURNIN_RC[domain];

    // Load input into bit-sliced w
    /** @type {uint32[]} */
    const x = new Array(8);
    x[0] = this.loadWord32(input, 0);
    x[1] = this.loadWord32(input, 2);
    x[2] = this.loadWord32(input, 4);
    x[3] = this.loadWord32(input, 6);
    x[4] = this.loadWord32(input, 8);
    x[5] = this.loadWord32(input, 10);
    x[6] = this.loadWord32(input, 12);
    x[7] = this.loadWord32(input, 14);

    // XOR key into w
    this.xorKey(x, 0, 1, 2, 3, 4, 5, 6, 7);

    // Perform all encryption rounds (2 rounds per iteration)
    let rcIdx = 0;
    for (let r = 0; r < rounds; r++) {
      // Even round
      this.sbox(x, 0, 1, 2, 3);
      this.sbox(x, 4, 5, 6, 7);
      this.mds(x, 1, 2, 3, 0, 7, 5, 4, 6);
      this.sbox(x, 3, 0, 1, 2);
      this.sbox(x, 5, 4, 6, 7);
      this.slice(x, 0, 1, 2, 3, 7, 4, 5, 6);
      this.mds(x, 0, 1, 2, 3, 7, 4, 5, 6);
      this.sliceInverse(x, 2, 3, 0, 1, 4, 5, 6, 7);
      x[2] = OpCodes.ToUint32(OpCodes.Xor32(x[2], rc[rcIdx++]));
      this.xorKeyRotated(x, 2, 3, 0, 1, 4, 5, 6, 7);

      // Odd round
      this.sbox(x, 2, 3, 0, 1);
      this.sbox(x, 4, 5, 6, 7);
      this.mds(x, 3, 0, 1, 2, 7, 5, 4, 6);
      this.sbox(x, 1, 2, 3, 0);
      this.sbox(x, 5, 4, 6, 7);
      this.sheet(x, 2, 3, 0, 1, 7, 4, 5, 6);
      this.mds(x, 2, 3, 0, 1, 7, 4, 5, 6);
      this.sheetInverse(x, 0, 1, 2, 3, 4, 5, 6, 7);
      x[0] = OpCodes.ToUint32(OpCodes.Xor32(x[0], rc[rcIdx++]));
      this.xorKey(x, 0, 1, 2, 3, 4, 5, 6, 7);
    }

    // Store output
    this.storeWord32(output, 0, x[0]);
    this.storeWord32(output, 2, x[1]);
    this.storeWord32(output, 4, x[2]);
    this.storeWord32(output, 6, x[3]);
    this.storeWord32(output, 8, x[4]);
    this.storeWord32(output, 10, x[5]);
    this.storeWord32(output, 12, x[6]);
    this.storeWord32(output, 14, x[7]);
  }

  // Decrypt a 256-bit block
  /**
   * @param {uint8[]} output
   * @param {uint8[]} input
   * @param {int32} domain
   */
  decryptBlock(output, input, domain) {
    const rounds = (domain >= SATURNIN_DOMAIN_16_7) ? 8 : 5;
    const rc = SATURNIN_RC[domain];

    // Load input into bit-sliced w
    /** @type {uint32[]} */
    const x = new Array(8);
    x[0] = this.loadWord32(input, 0);
    x[1] = this.loadWord32(input, 2);
    x[2] = this.loadWord32(input, 4);
    x[3] = this.loadWord32(input, 6);
    x[4] = this.loadWord32(input, 8);
    x[5] = this.loadWord32(input, 10);
    x[6] = this.loadWord32(input, 12);
    x[7] = this.loadWord32(input, 14);

    // Perform all decryption rounds (2 rounds per iteration)
    let rcIdx = (rounds - 1) * 2;
    for (let r = 0; r < rounds; r++) {
      // Odd round (reversed)
      this.xorKey(x, 0, 1, 2, 3, 4, 5, 6, 7);
      x[0] = OpCodes.ToUint32(OpCodes.Xor32(x[0], rc[rcIdx + 1]));
      this.sheet(x, 0, 1, 2, 3, 4, 5, 6, 7);
      this.mdsInverse(x, 0, 1, 2, 3, 4, 5, 6, 7);
      this.sheetInverse(x, 2, 3, 0, 1, 7, 4, 5, 6);
      this.sboxInverse(x, 1, 2, 3, 0);
      this.sboxInverse(x, 5, 4, 6, 7);
      this.mdsInverse(x, 1, 2, 3, 0, 5, 4, 6, 7);
      this.sboxInverse(x, 2, 3, 0, 1);
      this.sboxInverse(x, 4, 5, 6, 7);

      // Even round (reversed)
      this.xorKeyRotated(x, 2, 3, 0, 1, 4, 5, 6, 7);
      x[2] = OpCodes.ToUint32(OpCodes.Xor32(x[2], rc[rcIdx]));
      this.slice(x, 2, 3, 0, 1, 4, 5, 6, 7);
      this.mdsInverse(x, 2, 3, 0, 1, 4, 5, 6, 7);
      this.sliceInverse(x, 0, 1, 2, 3, 7, 4, 5, 6);
      this.sboxInverse(x, 3, 0, 1, 2);
      this.sboxInverse(x, 5, 4, 6, 7);
      this.mdsInverse(x, 3, 0, 1, 2, 5, 4, 6, 7);
      this.sboxInverse(x, 0, 1, 2, 3);
      this.sboxInverse(x, 4, 5, 6, 7);

      rcIdx -= 2;
    }

    // XOR key into w
    this.xorKey(x, 0, 1, 2, 3, 4, 5, 6, 7);

    // Store output
    this.storeWord32(output, 0, x[0]);
    this.storeWord32(output, 2, x[1]);
    this.storeWord32(output, 4, x[2]);
    this.storeWord32(output, 6, x[3]);
    this.storeWord32(output, 8, x[4]);
    this.storeWord32(output, 10, x[5]);
    this.storeWord32(output, 12, x[6]);
    this.storeWord32(output, 14, x[7]);
  }
}

// Helper function: XOR two byte arrays with optional offsets
/**
 * @param {uint8[]} dest
 * @param {uint8[]} src1
 * @param {uint8[]} src2
 * @param {int32} len
 * @param {int32} destOffset
 * @param {int32} src1Offset
 * @param {int32} src2Offset
 */
function xorBytes(dest, src1, src2, len, destOffset = 0, src1Offset = 0, src2Offset = 0) {
  for (let i = 0; i < len; i++) {
    dest[destOffset + i] = OpCodes.ToUint32(OpCodes.And32(OpCodes.Xor32(src1[src1Offset + i], src2[src2Offset + i]), 0xFF));
  }
}

// Helper function: Constant-time tag comparison
/**
 * @param {uint8[]} plaintext
 * @param {int32} plaintextLen
 * @param {uint8[]} tag1
 * @param {uint8[]} tag2
 * @param {int32} tagLen
 * @returns {int32}
 */
function checkTag(plaintext, plaintextLen, tag1, tag2, tagLen) {
  /** @type {uint32} */
  let diff = 0;
  for (let i = 0; i < tagLen; i++) {
    diff = OpCodes.Or32(diff, OpCodes.Xor32(tag1[i], tag2[i]));
  }
  if (diff !== 0) {
    // Clear plaintext on auth failure
    for (let i = 0; i < plaintextLen; i++) {
      plaintext[i] = 0;
    }
    return -1;
  }
  return 0;
}

// One step of the Saturnin cascade.
//
// The running tag is what keys the block cipher, and the 32-byte data block is
// what gets encrypted; the tag is then replaced by block XOR E_tag(block). Every
// step therefore folds the previous tag into the next one through the key
// schedule, which is precisely what makes the cascade a MAC over all the blocks
// absorbed so far. Re-keying on each step is not optional: keying the cipher
// once and leaving it fixed would make each step overwrite the tag with a
// function of that block alone, so only the final block would be authenticated.
//
// If blockOffset is provided, reads from block[blockOffset..blockOffset+31].
/**
 * @param {uint8[]} block
 * @param {uint8[]} tag
 * @param {int32} domain
 * @param {int32} blockOffset
 */
function saturninBlockEncryptXor(block, tag, domain, blockOffset = 0) {
  /** @type {uint8[]} */
  const temp = new Array(32);
  /** @type {uint8[]} */
  const blockData = new Array(32);

  // Copy block data to temporary array for encryption
  for (let i = 0; i < 32; i++) {
    blockData[i] = block[blockOffset + i];
  }

  /** @type {SaturninCipher} */
  const cipher = new SaturninCipher();
  cipher.setupKey(tag);
  cipher.encryptBlock(temp, blockData, domain);
  xorBytes(tag, blockData, temp, 32, 0, 0, 0);
}

// Authenticate message using cascade construction
/**
 * @param {uint8[]} tag
 * @param {uint8[]} block
 * @param {uint8[]} message
 * @param {int32} messageLen
 * @param {int32} domain1
 * @param {int32} domain2
 */
function saturninAuthenticate(tag, block, message, messageLen, domain1, domain2) {
  let offset = 0;

  // Process full blocks
  while (messageLen >= 32) {
    saturninBlockEncryptXor(message, tag, domain1, offset);
    offset += 32;
    messageLen -= 32;
  }

  // Process final partial block with padding
  for (let i = 0; i < messageLen; i++) {
    block[i] = message[offset + i];
  }
  block[messageLen] = 0x80;
  for (let i = messageLen + 1; i < 32; i++) {
    block[i] = 0;
  }
  saturninBlockEncryptXor(block, tag, domain2, 0);
}

// CTR mode encryption/decryption
/**
 * @param {uint8[]} output
 * @param {uint8[]} input
 * @param {int32} inputLen
 * @param {uint8[]} block
 * @param {SaturninCipher} cipher
 */
function saturninCTREncrypt(output, input, inputLen, block, cipher) {
  /** @type {uint32} */
  let counter = 1;
  let offset = 0;
  /** @type {uint8[]} */
  const out = new Array(32);

  while (inputLen >= 32) {
    // Store counter in big-endian at offset 28 using OpCodes
    const counterBytes = OpCodes.Unpack32BE(counter);
    block[28] = counterBytes[0];
    block[29] = counterBytes[1];
    block[30] = counterBytes[2];
    block[31] = counterBytes[3];

    cipher.encryptBlock(out, block, SATURNIN_DOMAIN_10_1);
    xorBytes(output, out, input, 32, offset, 0, offset);

    offset += 32;
    inputLen -= 32;
    counter++;
  }

  if (inputLen > 0) {
    // Store counter in big-endian at offset 28 using OpCodes
    const counterBytes = OpCodes.Unpack32BE(counter);
    block[28] = counterBytes[0];
    block[29] = counterBytes[1];
    block[30] = counterBytes[2];
    block[31] = counterBytes[3];

    cipher.encryptBlock(out, block, SATURNIN_DOMAIN_10_1);
    xorBytes(output, out, input, inputLen, offset, 0, offset);
  }
}

// ===== SATURNIN-CTR-CASCADE ALGORITHM =====

class SaturninCTRCascadeAlgorithm extends AeadAlgorithm {
  constructor() {
    super();

    this.name = "SATURNIN-CTR-Cascade";
    this.description = "Advanced AEAD cipher based on 256-bit block cipher with CTR-Cascade construction. NIST Lightweight Cryptography Round 2 candidate optimized for high security and performance.";
    this.inventor = "Anne Canteaut, Sébastien Duval, Gaëtan Leurent, María Naya-Plasencia, Léo Perrin, Thomas Pornin, André Schrottenloher";
    this.year = 2019;
    this.category = CategoryType.AEAD;
    this.subCategory = "Authenticated Encryption";
    this.securityStatus = SecurityStatus.EXPERIMENTAL;
    this.complexity = ComplexityType.ADVANCED;
    this.country = CountryCode.FR; // France (INRIA)

    this.keySize = 32;    // 256 bits
    this.nonceSize = 16;  // 128 bits
    this.tagSize = 32;    // 256 bits
    this.blockSize = 32;  // 256 bits

    this.documentation = [
      new LinkItem("Official Specification", "https://project.inria.fr/saturnin/"),
      new LinkItem("NIST LWC Submission", "https://csrc.nist.gov/Projects/lightweight-cryptography")
    ];

    this.references = [
      new LinkItem("rweather/lightweight-crypto C Reference Implementation", "https://github.com/rweather/lightweight-crypto/blob/master/src/individual/Saturnin/saturnin.c"),
      new LinkItem("Saturnin Project Site (reference package)", "https://project.inria.fr/saturnin/")
    ];

    // Published Known-Answer-Test vectors from the NIST LWC submission package
    // for SATURNIN, as distributed in the SATURNIN-CTR-Cascade.txt KAT file.
    // Counts refer to the numbering in that file. The implementation reproduces
    // all 1089 vectors it contains.
    const KAT_URI = "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SATURNIN-CTR-Cascade.txt";
    this.tests = [
      {
        text: "SATURNIN-CTR-Cascade KAT Count 1 (empty plaintext, empty AD)",
        uri: KAT_URI,
        key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
        nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        aad: OpCodes.Hex8ToBytes(""),
        input: OpCodes.Hex8ToBytes(""),
        // Expected: 32 byte tag only
        expected: OpCodes.Hex8ToBytes("BA6F18356B82C46910FE1738E72D99A43250269B8FE631CE0C1C6A38A5AFC6CB")
      },
      {
        text: "SATURNIN-CTR-Cascade KAT Count 35 (1-byte plaintext, 1-byte AD)",
        uri: KAT_URI,
        key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
        nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        aad: OpCodes.Hex8ToBytes("00"),
        input: OpCodes.Hex8ToBytes("00"),
        // Expected: 1 byte ciphertext + 32 byte tag
        expected: OpCodes.Hex8ToBytes("73A4FACF5AE96450E8BB1A98FE2492A1ACD92B322D60280D229463545D22B5ADCB")
      },
      {
        text: "SATURNIN-CTR-Cascade KAT Count 69 (2-byte plaintext, 2-byte AD)",
        uri: KAT_URI,
        key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
        nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        aad: OpCodes.Hex8ToBytes("0001"),
        input: OpCodes.Hex8ToBytes("0001"),
        expected: OpCodes.Hex8ToBytes("73A3DB8D008657A5844BCD7FB9F7AC5805F83B1715754970A7004D9E481EA475D4E9")
      },
      {
        text: "SATURNIN-CTR-Cascade KAT Count 1089 (32-byte plaintext, 32-byte AD)",
        uri: KAT_URI,
        key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
        nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        aad: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
        input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
        expected: OpCodes.Hex8ToBytes("73A3610620A34B523A47EA4EDDFF83AC52370B3A1643965ACE464BE43F5033F5E9E56ED79C0BE6ED0B3A96FC6CF741E1D5E5398F23F98D8208FBA00F43BA6BC7")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new SaturninCTRCascadeInstance(this, isInverse);
  }
}

class SaturninCTRCascadeInstance extends IAeadInstance {
  /**
   * @param {SaturninCTRCascadeAlgorithm} algorithm
   * @param {boolean} [isInverse=false]
   */
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    /** @type {boolean} */
    this.isInverse = isInverse;
    /** @type {SaturninCipher} */
    this.cipher = new SaturninCipher();
    /** @type {uint8[]|null} */
    this._key = null;
    /** @type {uint8[]|null} */
    this._nonce = null;
    /** @type {uint8[]|null} */
    this._aad = null;
    /** @type {uint8[]} */
    this.inputBuffer = [];
  }

  /**
   * @param {uint8[]|null} keyBytes
   */
  set key(keyBytes) {
    if (!keyBytes || keyBytes.length !== 32) {
      throw new Error("Saturnin-CTR-Cascade requires 256-bit (32-byte) key");
    }
    this._key = [...keyBytes];
    this.cipher.setupKey(this._key);
  }

  /**
   * @returns {uint8[]|null}
   */
  get key() { return this._key ? [...this._key] : null; }

  /**
   * @param {uint8[]|null} nonceBytes
   */
  set nonce(nonceBytes) {
    if (!nonceBytes || nonceBytes.length !== 16) {
      throw new Error("Saturnin-CTR-Cascade requires 128-bit (16-byte) nonce");
    }
    this._nonce = [...nonceBytes];
  }

  /**
   * @returns {uint8[]|null}
   */
  get nonce() { return this._nonce ? [...this._nonce] : null; }

  /**
   * @param {uint8[]|null} aadBytes
   */
  set aad(aadBytes) {
    /** @type {uint8[]} */
    let copy = [];
    if (aadBytes) {
      copy = [...aadBytes];
    }
    this._aad = copy;
  }

  /**
   * @returns {uint8[]|null}
   */
  get aad() {
    /** @type {uint8[]} */
    let copy = [];
    if (this._aad) {
      copy = [...this._aad];
    }
    return copy;
  }


  /**
   * @returns {uint8[]}
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

  /**
   * @returns {uint8[]}
   */
  _encrypt() {
    /** @type {uint8[]} */
    const aad = this.aad;
    const plaintext = this.inputBuffer;
    const plaintextLen = plaintext.length;
    /** @type {uint8[]} */
    const ciphertext = new Array(plaintextLen + 32);

    // Format nonce block (nonce + 0x80 padding)
    /** @type {uint8[]} */
    const block = new Array(32);
    for (let i = 0; i < 16; i++) {
      block[i] = this._nonce[i];
    }
    block[16] = 0x80;
    for (let i = 17; i < 32; i++) {
      block[i] = 0;
    }

    // Encrypt plaintext in CTR mode
    saturninCTREncrypt(ciphertext, plaintext, plaintextLen, block, this.cipher);

    // Initialize tag with key
    /** @type {uint8[]} */
    const tag = [...this._key];

    // Reset block padding
    for (let i = 17; i < 32; i++) {
      block[i] = 0;
    }

    // Authenticate nonce
    saturninBlockEncryptXor(block, tag, SATURNIN_DOMAIN_10_2);

    // Authenticate associated data
    saturninAuthenticate(tag, block, aad, aad.length,
                         SATURNIN_DOMAIN_10_2, SATURNIN_DOMAIN_10_3);

    // Authenticate ciphertext
    saturninAuthenticate(tag, block, ciphertext, plaintextLen,
                         SATURNIN_DOMAIN_10_4, SATURNIN_DOMAIN_10_5);

    // Append tag to ciphertext
    for (let i = 0; i < 32; i++) {
      ciphertext[plaintextLen + i] = tag[i];
    }

    return ciphertext;
  }

  /**
   * @returns {uint8[]}
   */
  _decrypt() {
    if (this.inputBuffer.length < 32) {
      throw new Error("Ciphertext too short (missing authentication tag)");
    }

    /** @type {uint8[]} */
    const aad = this.aad;
    const ciphertextLen = this.inputBuffer.length - 32;
    const ciphertext = this.inputBuffer.slice(0, ciphertextLen);
    const receivedTag = this.inputBuffer.slice(ciphertextLen);

    // Format nonce block
    /** @type {uint8[]} */
    const block = new Array(32);
    for (let i = 0; i < 16; i++) {
      block[i] = this._nonce[i];
    }
    block[16] = 0x80;
    for (let i = 17; i < 32; i++) {
      block[i] = 0;
    }

    // Initialize tag with key
    /** @type {uint8[]} */
    const tag = [...this._key];

    // Authenticate nonce
    saturninBlockEncryptXor(block, tag, SATURNIN_DOMAIN_10_2);

    // Authenticate associated data
    saturninAuthenticate(tag, block, aad, aad.length,
                         SATURNIN_DOMAIN_10_2, SATURNIN_DOMAIN_10_3);

    // Authenticate ciphertext
    saturninAuthenticate(tag, block, ciphertext, ciphertextLen,
                         SATURNIN_DOMAIN_10_4, SATURNIN_DOMAIN_10_5);

    // Decrypt ciphertext
    /** @type {uint8[]} */
    const plaintext = new Array(ciphertextLen);

    // Reset nonce block for CTR (it was modified by authenticate)
    for (let i = 0; i < 16; i++) {
      block[i] = this._nonce[i];
    }
    block[16] = 0x80;
    for (let i = 17; i < 32; i++) {
      block[i] = 0;
    }

    saturninCTREncrypt(plaintext, ciphertext, ciphertextLen, block, this.cipher);

    // Verify tag
    if (checkTag(plaintext, ciphertextLen, tag, receivedTag, 32) !== 0) {
      throw new Error("Authentication tag verification failed");
    }

    return plaintext;
  }
}

// ===== SATURNIN-SHORT ALGORITHM =====

class SaturninShortAlgorithm extends AeadAlgorithm {
  constructor() {
    super();

    this.name = "SATURNIN-Short";
    this.description = "Optimized AEAD cipher for short messages (≤15 bytes plaintext, no associated data). Single-block operation with 256-bit key and nonce, producing 256-bit ciphertext.";
    this.inventor = "Anne Canteaut, Sébastien Duval, Gaëtan Leurent, María Naya-Plasencia, Léo Perrin, Thomas Pornin, André Schrottenloher";
    this.year = 2019;
    this.category = CategoryType.AEAD;
    this.subCategory = "Authenticated Encryption";
    this.securityStatus = SecurityStatus.EXPERIMENTAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.FR; // France (INRIA)

    this.keySize = 32;    // 256 bits
    this.nonceSize = 16;  // 128 bits
    this.tagSize = 32;    // 256 bits (includes ciphertext)
    this.blockSize = 32;  // 256 bits

    this.maxPlaintextLength = 15; // Bytes
    this.supportsAAD = false;

    this.documentation = [
      new LinkItem("Official Specification", "https://project.inria.fr/saturnin/"),
      new LinkItem("NIST LWC Submission", "https://csrc.nist.gov/Projects/lightweight-cryptography")
    ];

    this.references = [
      new LinkItem("rweather/lightweight-crypto C Reference Implementation", "https://github.com/rweather/lightweight-crypto/blob/master/src/individual/Saturnin/saturnin.c"),
      new LinkItem("Saturnin Project Site (reference package)", "https://project.inria.fr/saturnin/")
    ];

    // Published Known-Answer-Test vectors from the NIST LWC submission package
    // for SATURNIN, as distributed in the SATURNIN-Short.txt KAT file. The
    // implementation reproduces all 16 vectors it contains.
    const KAT_URI = "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SATURNIN-Short.txt";
    this.tests = [
      {
        text: "SATURNIN-Short KAT Count 1 (empty message)",
        uri: KAT_URI,
        key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
        nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        aad: OpCodes.Hex8ToBytes(""),
        input: OpCodes.Hex8ToBytes(""),
        // Expected: 32 byte ciphertext (includes authentication)
        expected: OpCodes.Hex8ToBytes("EF142FC810CE92839726D600FCCFD7119050DA25A3EC5586C7C43CA668E3C8C0")
      },
      {
        text: "SATURNIN-Short KAT Count 13 (12-byte message)",
        uri: KAT_URI,
        key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
        nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        aad: OpCodes.Hex8ToBytes(""),
        input: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
        expected: OpCodes.Hex8ToBytes("20A7207939100227C9E3CAB563AB1FE472A971711E12A5CAD360B6757F8D8D14")
      },
      {
        text: "SATURNIN-Short KAT Count 16 (15-byte message, maximum length)",
        uri: KAT_URI,
        key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
        nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        aad: OpCodes.Hex8ToBytes(""),
        input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E"),
        expected: OpCodes.Hex8ToBytes("F8B7DBF80E519CF80E03A207A4798A5A0144F9392169FAEBF781BF4DA9BDB0E4")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new SaturninShortInstance(this, isInverse);
  }
}

class SaturninShortInstance extends IAeadInstance {
  /**
   * @param {SaturninShortAlgorithm} algorithm
   * @param {boolean} [isInverse=false]
   */
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    /** @type {boolean} */
    this.isInverse = isInverse;
    /** @type {SaturninCipher} */
    this.cipher = new SaturninCipher();
    /** @type {uint8[]|null} */
    this._key = null;
    /** @type {uint8[]|null} */
    this._nonce = null;
    /** @type {uint8[]|null} */
    this._aad = null;
    /** @type {uint8[]} */
    this.inputBuffer = [];
  }

  /**
   * @param {uint8[]|null} keyBytes
   */
  set key(keyBytes) {
    if (!keyBytes || keyBytes.length !== 32) {
      throw new Error("SATURNIN-Short requires 256-bit (32-byte) key");
    }
    this._key = [...keyBytes];
    this.cipher.setupKey(this._key);
  }

  /**
   * @returns {uint8[]|null}
   */
  get key() { return this._key ? [...this._key] : null; }

  /**
   * @param {uint8[]|null} nonceBytes
   */
  set nonce(nonceBytes) {
    if (!nonceBytes || nonceBytes.length !== 16) {
      throw new Error("SATURNIN-Short requires 128-bit (16-byte) nonce");
    }
    this._nonce = [...nonceBytes];
  }

  /**
   * @returns {uint8[]|null}
   */
  get nonce() { return this._nonce ? [...this._nonce] : null; }

  /**
   * @param {uint8[]|null} aadBytes
   */
  set aad(aadBytes) {
    if (aadBytes && aadBytes.length > 0) {
      throw new Error("SATURNIN-Short does not support associated data");
    }
    this._aad = [];
  }

  /**
   * @returns {uint8[]|null}
   */
  get aad() {
    /** @type {uint8[]} */
    const none = [];
    return none;
  }

  /**
   * @param {uint8[]} data
   */
  Feed(data) {
    if (!data || data.length === 0) return;

    // For encryption: check plaintext length limit
    // For decryption: accept full 32-byte ciphertext
    const maxInputLength = this.isInverse ? 32 : 15;

    if (this.inputBuffer.length + data.length > maxInputLength) {
      const operation = this.isInverse ? "ciphertext" : "plaintext";
      throw new Error("SATURNIN-Short " + operation + " length exceeds maximum " + maxInputLength + " bytes");
    }

    for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
  }

  /**
   * @returns {uint8[]}
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

  /**
   * @returns {uint8[]}
   */
  _encrypt() {
    const plaintextLen = this.inputBuffer.length;

    if (plaintextLen > 15) {
      throw new Error("SATURNIN-Short plaintext exceeds 15 bytes");
    }

    // Build input block: nonce (16) + plaintext (≤15) + padding
    /** @type {uint8[]} */
    const block = new Array(32);

    for (let i = 0; i < 16; i++) {
      block[i] = this._nonce[i];
    }

    for (let i = 0; i < plaintextLen; i++) {
      block[16 + i] = this.inputBuffer[i];
    }

    block[16 + plaintextLen] = 0x80;
    for (let i = 17 + plaintextLen; i < 32; i++) {
      block[i] = 0;
    }

    // Encrypt block
    /** @type {uint8[]} */
    const output = new Array(32);
    this.cipher.encryptBlock(output, block, SATURNIN_DOMAIN_10_6);

    return output;
  }

  /**
   * @returns {uint8[]}
   */
  _decrypt() {
    if (this.inputBuffer.length !== 32) {
      throw new Error("SATURNIN-Short ciphertext must be exactly 32 bytes");
    }

    /** @type {uint8[]} */
    const decrypted = new Array(32);
    this.cipher.decryptBlock(decrypted, this.inputBuffer, SATURNIN_DOMAIN_10_6);

    // Saturnin-Short authenticates implicitly rather than with a separate tag:
    // the specification (Saturnin submission, "Saturnin-Short") encrypts the
    // single block N || M || 10* and decryption is one inverse block call
    // followed by two checks - the recovered nonce must equal the one supplied,
    // and the second half must be a message followed by 0x80 and then zeroes.
    // Anything else is a forgery and must be refused.
    //
    // Both scans run to completion whatever they find, so the work done does
    // not reveal where a difference lies. `failed` accumulates every reason to
    // reject and is non-zero exactly when the block is not well formed.
    /** @type {uint32} */
    let failed = 0;

    // The first half must reproduce the nonce.
    for (let i = 0; i < 16; i++) {
      failed = OpCodes.Or32(failed, OpCodes.Xor32(this._nonce[i], decrypted[i]));
    }

    // The second half must be M || 0x80 || 0*. Scanning downwards locates the
    // last 0x80, which is the padding marker: `searching` stays 0xFF until the
    // marker is met, and while it does every byte seen has to be zero.
    /** @type {uint32} */
    let searching = 0xFF;
    /** @type {uint32} */
    let len = 0;
    for (let index = 15; index >= 0; index--) {
      const octet = decrypted[16 + index];
      // notMarker is 1 for any byte other than 0x80 and 0 for 0x80 itself, so
      // notMarker - 1 is an all-ones mask exactly at the marker.
      const notMarker = OpCodes.Shr32(OpCodes.Add32(OpCodes.Xor32(octet, 0x80), 0xFF), 8);
      const isMarker = OpCodes.And32(searching, OpCodes.Sub32(notMarker, 1));
      len = OpCodes.Or32(len, OpCodes.And32(isMarker, index));
      searching = OpCodes.And32(searching, OpCodes.Xor32(isMarker, 0xFF));
      failed = OpCodes.Or32(failed, OpCodes.And32(searching, OpCodes.Shr32(OpCodes.Add32(octet, 0xFF), 8)));
    }
    // Still searching once the scan is done means there was no 0x80 at all.
    failed = OpCodes.Or32(failed, searching);

    if (failed !== 0) {
      throw new Error("Authentication failed: invalid nonce or padding");
    }

    // Extract plaintext
    const plaintext = decrypted.slice(16, 16 + OpCodes.ToInt(len));

    return plaintext;
  }
}

  // Register algorithms
  RegisterAlgorithm(new SaturninCTRCascadeAlgorithm());
  RegisterAlgorithm(new SaturninShortAlgorithm());

  // Return both algorithm classes
  return {
    SaturninCTRCascadeAlgorithm,
    SaturninShortAlgorithm
  };
}));
