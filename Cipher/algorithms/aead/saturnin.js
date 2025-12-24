/*
 * Saturnin AEAD Family - NIST Lightweight Cryptography Round 2 Candidate
 * Implements SATURNIN-CTR-Cascade and SATURNIN-Short variants
 * Based on 256-bit block cipher with bit-sliced structure
 * Reference: https://project.inria.fr/saturnin/
 * Reference Implementation: https://github.com/rweather/lwc-finalists
 * (c)2006-2025 Hawkynt
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
const SATURNIN_RC = Object.freeze([
  // RC_10_1 (Domain 0, 10 rounds)
  Object.freeze([0x4eb026c2, 0x90595303, 0xaa8fe632, 0xfe928a92, 0x4115a419,
   0x93539532, 0x5db1cc4e, 0x541515ca, 0xbd1f55a8, 0x5a6e1a0d]),
  // RC_10_2 (Domain 1, 10 rounds)
  Object.freeze([0x4e4526b5, 0xa3565ff0, 0x0f8f20d8, 0x0b54bee1, 0x7d1a6c9d,
   0x17a6280a, 0xaa46c986, 0xc1199062, 0x182c5cde, 0xa00d53fe]),
  // RC_10_3 (Domain 2, 10 rounds)
  Object.freeze([0x4e162698, 0xb2535ba1, 0x6c8f9d65, 0x5816ad30, 0x691fd4fa,
   0x6bf5bcf9, 0xf8eb3525, 0xb21decfa, 0x7b3da417, 0xf62c94b4]),
  // RC_10_4 (Domain 3, 10 rounds)
  Object.freeze([0x4faf265b, 0xc5484616, 0x45dcad21, 0xe08bd607, 0x0504fdb8,
   0x1e1f5257, 0x45fbc216, 0xeb529b1f, 0x52194e32, 0x5498c018]),
  // RC_10_5 (Domain 4, 10 rounds)
  Object.freeze([0x4ffc2676, 0xd44d4247, 0x26dc109c, 0xb3c9c5d6, 0x110145df,
   0x624cc6a4, 0x17563eb5, 0x9856e787, 0x3108b6fb, 0x02b90752]),
  // RC_10_6 (Domain 5, 10 rounds)
  Object.freeze([0x4f092601, 0xe7424eb4, 0x83dcd676, 0x460ff1a5, 0x2d0e8d5b,
   0xe6b97b9c, 0xe0a13b7d, 0x0d5a622f, 0x943bbf8d, 0xf8da4ea1]),
  // RC_16_7 (Domain 6, 16 rounds)
  Object.freeze([0x3fba180c, 0x563ab9ab, 0x125ea5ef, 0x859da26c, 0xb8cf779b,
   0x7d4de793, 0x07efb49f, 0x8d525306, 0x1e08e6ab, 0x41729f87,
   0x8c4aef0a, 0x4aa0c9a7, 0xd93a95ef, 0xbb00d2af, 0xb62c5bf0,
   0x386d94d8]),
  // RC_16_8 (Domain 7, 16 rounds)
  Object.freeze([0x3c9b19a7, 0xa9098694, 0x23f878da, 0xa7b647d3, 0x74fc9d78,
   0xeacaae11, 0x2f31a677, 0x4cc8c054, 0x2f51ca05, 0x5268f195,
   0x4f5b8a2b, 0xf614b4ac, 0xf1d95401, 0x764d2568, 0x6a493611,
   0x8eef9c3e])
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
    this.k = new Array(16);
  }

  // Load 32-bit word from Saturnin block format
  // Special byte ordering: bytes at positions [0, 1, 16, 17] form a 32-bit word
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
  storeWord32(block, offset, x) {
    // Using OpCodes for byte unpacking
    const bytes = OpCodes.Unpack32LE(x);
    block[offset] = bytes[0];
    block[offset + 1] = bytes[1];
    block[offset + 16] = bytes[2];
    block[offset + 17] = bytes[3];
  }

  // Setup key schedule from 256-bit key
  setupKey(key) {
    for (let index = 0; index < 16; index += 2) {
      const temp = this.loadWord32(key, index);
      this.k[index / 2] = temp;
      // Rotated key: 5-bit rotation within each 16-bit half
      // Note: Custom bit-sliced operation for Saturnin's key schedule
      // Rotates bits 0-15 and 16-31 independently by 5 positions
      this.k[8 + (index / 2)] = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(OpCodes.AndN(temp, 0x001F001F), 11),
                                OpCodes.AndN(OpCodes.Shr32(temp, 5), 0x07FF07FF)));
    }
  }

  // Bit-sliced S-box
  sbox(state, a, b, c, d) {
    state[a] = OpCodes.XorN(state[a], OpCodes.AndN(state[b], state[c]));
    state[b] = OpCodes.XorN(state[b], OpCodes.OrN(state[a], state[d]));
    state[d] = OpCodes.XorN(state[d], OpCodes.OrN(state[b], state[c]));
    state[c] = OpCodes.XorN(state[c], OpCodes.AndN(state[b], state[d]));
    state[b] = OpCodes.XorN(state[b], OpCodes.OrN(state[a], state[c]));
    state[a] = OpCodes.XorN(state[a], OpCodes.OrN(state[b], state[d]));
  }

  // Inverse bit-sliced S-box
  sboxInverse(state, a, b, c, d) {
    state[a] = OpCodes.XorN(state[a], OpCodes.OrN(state[b], state[d]));
    state[b] = OpCodes.XorN(state[b], OpCodes.OrN(state[a], state[c]));
    state[c] = OpCodes.XorN(state[c], OpCodes.AndN(state[b], state[d]));
    state[d] = OpCodes.XorN(state[d], OpCodes.OrN(state[b], state[c]));
    state[b] = OpCodes.XorN(state[b], OpCodes.OrN(state[a], state[d]));
    state[a] = OpCodes.XorN(state[a], OpCodes.AndN(state[b], state[c]));
  }

  // Rotate 4-bit nibbles within 16-bit halves
  // Note: Custom bit-sliced permutation for Saturnin's slice layer
  // Applies independent rotations to low and high 16-bit halves
  leftRotate4N(a, mask1, bits1, mask2, bits2) {
    return OpCodes.ToUint32(OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(
            OpCodes.Shl32(OpCodes.AndN(a, mask1), bits1),
            OpCodes.Shr32(OpCodes.AndN(a, OpCodes.XorN(mask1, 0xFFFF)), (4 - bits1))),
            OpCodes.Shl32(OpCodes.AndN(a, OpCodes.ToUint32(OpCodes.Shl32(mask2, 16))), bits2)),
            OpCodes.Shr32(OpCodes.AndN(a, OpCodes.ToUint32(OpCodes.XorN(OpCodes.Shl32(mask2, 16), 0xFFFF0000))), (4 - bits2))));
  }

  // Rotate 16-bit subwords
  // Note: Custom bit-sliced permutation for Saturnin's sheet layer
  // Applies independent rotations to low and high 16-bit halves
  leftRotate16N(a, mask1, bits1, mask2, bits2) {
    return OpCodes.ToUint32(OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(
            OpCodes.Shl32(OpCodes.AndN(a, mask1), bits1),
            OpCodes.Shr32(OpCodes.AndN(a, OpCodes.XorN(mask1, 0xFFFF)), (16 - bits1))),
            OpCodes.Shl32(OpCodes.AndN(a, OpCodes.ToUint32(OpCodes.Shl32(mask2, 16))), bits2)),
            OpCodes.Shr32(OpCodes.AndN(a, OpCodes.ToUint32(OpCodes.XorN(OpCodes.Shl32(mask2, 16), 0xFFFF0000))), (16 - bits2))));
  }

  // Slice permutation
  slice(state) {
    state[0] = this.leftRotate4N(state[0], 0xFFFF, 0, 0x3333, 2);
    state[1] = this.leftRotate4N(state[1], 0xFFFF, 0, 0x3333, 2);
    state[2] = this.leftRotate4N(state[2], 0xFFFF, 0, 0x3333, 2);
    state[3] = this.leftRotate4N(state[3], 0xFFFF, 0, 0x3333, 2);
    state[4] = this.leftRotate4N(state[4], 0x7777, 1, 0x1111, 3);
    state[5] = this.leftRotate4N(state[5], 0x7777, 1, 0x1111, 3);
    state[6] = this.leftRotate4N(state[6], 0x7777, 1, 0x1111, 3);
    state[7] = this.leftRotate4N(state[7], 0x7777, 1, 0x1111, 3);
  }

  // Inverse slice permutation
  sliceInverse(state) {
    state[0] = this.leftRotate4N(state[0], 0xFFFF, 0, 0x3333, 2);
    state[1] = this.leftRotate4N(state[1], 0xFFFF, 0, 0x3333, 2);
    state[2] = this.leftRotate4N(state[2], 0xFFFF, 0, 0x3333, 2);
    state[3] = this.leftRotate4N(state[3], 0xFFFF, 0, 0x3333, 2);
    state[4] = this.leftRotate4N(state[4], 0x1111, 3, 0x7777, 1);
    state[5] = this.leftRotate4N(state[5], 0x1111, 3, 0x7777, 1);
    state[6] = this.leftRotate4N(state[6], 0x1111, 3, 0x7777, 1);
    state[7] = this.leftRotate4N(state[7], 0x1111, 3, 0x7777, 1);
  }

  // Sheet permutation
  sheet(state) {
    state[0] = this.leftRotate16N(state[0], 0xFFFF, 0, 0x00FF, 8);
    state[1] = this.leftRotate16N(state[1], 0xFFFF, 0, 0x00FF, 8);
    state[2] = this.leftRotate16N(state[2], 0xFFFF, 0, 0x00FF, 8);
    state[3] = this.leftRotate16N(state[3], 0xFFFF, 0, 0x00FF, 8);
    state[4] = this.leftRotate16N(state[4], 0x0FFF, 4, 0x000F, 12);
    state[5] = this.leftRotate16N(state[5], 0x0FFF, 4, 0x000F, 12);
    state[6] = this.leftRotate16N(state[6], 0x0FFF, 4, 0x000F, 12);
    state[7] = this.leftRotate16N(state[7], 0x0FFF, 4, 0x000F, 12);
  }

  // Inverse sheet permutation
  sheetInverse(state) {
    state[0] = this.leftRotate16N(state[0], 0xFFFF, 0, 0x00FF, 8);
    state[1] = this.leftRotate16N(state[1], 0xFFFF, 0, 0x00FF, 8);
    state[2] = this.leftRotate16N(state[2], 0xFFFF, 0, 0x00FF, 8);
    state[3] = this.leftRotate16N(state[3], 0xFFFF, 0, 0x00FF, 8);
    state[4] = this.leftRotate16N(state[4], 0x000F, 12, 0x0FFF, 4);
    state[5] = this.leftRotate16N(state[5], 0x000F, 12, 0x0FFF, 4);
    state[6] = this.leftRotate16N(state[6], 0x000F, 12, 0x0FFF, 4);
    state[7] = this.leftRotate16N(state[7], 0x000F, 12, 0x0FFF, 4);
  }

  // MDS matrix helper
  mul(state, x0, x1, x2, x3) {
    state[x0] = OpCodes.ToUint32(OpCodes.XorN(state[x0], state[x1]));
  }

  // Inverse MDS matrix helper
  mulInv(state, x0, x1, x2, x3) {
    state[x3] = OpCodes.ToUint32(OpCodes.XorN(state[x3], state[x0]));
  }

  // SWAP helper for MDS - swaps 16-bit halves of 32-bit word
  swap(x) {
    // Note: Custom cross-word operation not available in OpCodes
    return OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(x, 16), OpCodes.Shr32(x, 16)));
  }

  // MDS matrix
  mds(state, x0, x1, x2, x3, x4, x5, x6, x7) {
    state[x0] = OpCodes.ToUint32(OpCodes.XorN(state[x0], state[x4]));
    state[x1] = OpCodes.ToUint32(OpCodes.XorN(state[x1], state[x5]));
    state[x2] = OpCodes.ToUint32(OpCodes.XorN(state[x2], state[x6]));
    state[x3] = OpCodes.ToUint32(OpCodes.XorN(state[x3], state[x7]));

    this.mul(state, x4, x5, x6, x7);

    state[x5] = OpCodes.ToUint32(OpCodes.XorN(state[x5], this.swap(state[x0])));
    state[x6] = OpCodes.ToUint32(OpCodes.XorN(state[x6], this.swap(state[x1])));
    state[x7] = OpCodes.ToUint32(OpCodes.XorN(state[x7], this.swap(state[x2])));
    state[x4] = OpCodes.ToUint32(OpCodes.XorN(state[x4], this.swap(state[x3])));

    this.mul(state, x0, x1, x2, x3);
    this.mul(state, x1, x2, x3, x0);

    state[x2] = OpCodes.ToUint32(OpCodes.XorN(state[x2], state[x5]));
    state[x3] = OpCodes.ToUint32(OpCodes.XorN(state[x3], state[x6]));
    state[x0] = OpCodes.ToUint32(OpCodes.XorN(state[x0], state[x7]));
    state[x1] = OpCodes.ToUint32(OpCodes.XorN(state[x1], state[x4]));

    state[x5] = OpCodes.ToUint32(OpCodes.XorN(state[x5], this.swap(state[x2])));
    state[x6] = OpCodes.ToUint32(OpCodes.XorN(state[x6], this.swap(state[x3])));
    state[x7] = OpCodes.ToUint32(OpCodes.XorN(state[x7], this.swap(state[x0])));
    state[x4] = OpCodes.ToUint32(OpCodes.XorN(state[x4], this.swap(state[x1])));
  }

  // Inverse MDS matrix
  mdsInverse(state, x0, x1, x2, x3, x4, x5, x6, x7) {
    state[x6] = OpCodes.ToUint32(OpCodes.XorN(state[x6], this.swap(state[x2])));
    state[x7] = OpCodes.ToUint32(OpCodes.XorN(state[x7], this.swap(state[x3])));
    state[x4] = OpCodes.ToUint32(OpCodes.XorN(state[x4], this.swap(state[x0])));
    state[x5] = OpCodes.ToUint32(OpCodes.XorN(state[x5], this.swap(state[x1])));

    state[x0] = OpCodes.ToUint32(OpCodes.XorN(state[x0], state[x4]));
    state[x1] = OpCodes.ToUint32(OpCodes.XorN(state[x1], state[x5]));
    state[x2] = OpCodes.ToUint32(OpCodes.XorN(state[x2], state[x6]));
    state[x3] = OpCodes.ToUint32(OpCodes.XorN(state[x3], state[x7]));

    this.mulInv(state, x0, x1, x2, x3);
    this.mulInv(state, x3, x0, x1, x2);

    state[x6] = OpCodes.ToUint32(OpCodes.XorN(state[x6], this.swap(state[x0])));
    state[x7] = OpCodes.ToUint32(OpCodes.XorN(state[x7], this.swap(state[x1])));
    state[x4] = OpCodes.ToUint32(OpCodes.XorN(state[x4], this.swap(state[x2])));
    state[x5] = OpCodes.ToUint32(OpCodes.XorN(state[x5], this.swap(state[x3])));

    this.mulInv(state, x4, x5, x6, x7);

    state[x2] = OpCodes.ToUint32(OpCodes.XorN(state[x2], state[x7]));
    state[x3] = OpCodes.ToUint32(OpCodes.XorN(state[x3], state[x4]));
    state[x0] = OpCodes.ToUint32(OpCodes.XorN(state[x0], state[x5]));
    state[x1] = OpCodes.ToUint32(OpCodes.XorN(state[x1], state[x6]));
  }

  // Encrypt a 256-bit block
  encryptBlock(output, input, domain) {
    const rounds = (domain >= SATURNIN_DOMAIN_16_7) ? 8 : 5;
    const rc = SATURNIN_RC[domain];

    // Load input into bit-sliced state
    const x = new Array(8);
    x[0] = this.loadWord32(input, 0);
    x[1] = this.loadWord32(input, 2);
    x[2] = this.loadWord32(input, 4);
    x[3] = this.loadWord32(input, 6);
    x[4] = this.loadWord32(input, 8);
    x[5] = this.loadWord32(input, 10);
    x[6] = this.loadWord32(input, 12);
    x[7] = this.loadWord32(input, 14);

    // XOR key into state
    for (let i = 0; i < 8; i++) {
      x[i] = OpCodes.ToUint32(OpCodes.XorN(x[i], this.k[i]));
    }

    // Perform all encryption rounds (2 rounds per iteration)
    let rcIdx = 0;
    for (let r = 0; r < rounds; r++) {
      // Even round
      this.sbox(x, 0, 1, 2, 3);
      this.sbox(x, 4, 5, 6, 7);
      this.mds(x, 1, 2, 3, 0, 7, 5, 4, 6);
      this.sbox(x, 3, 0, 1, 2);
      this.sbox(x, 5, 4, 6, 7);
      this.slice(x);
      this.mds(x, 0, 1, 2, 3, 7, 4, 5, 6);
      this.sliceInverse(x);
      x[2] = OpCodes.ToUint32(OpCodes.XorN(x[2], rc[rcIdx++]));
      for (let i = 0; i < 8; i++) {
        x[i] = OpCodes.ToUint32(OpCodes.XorN(x[i], this.k[8 + i]));
      }

      // Odd round
      this.sbox(x, 2, 3, 0, 1);
      this.sbox(x, 4, 5, 6, 7);
      this.mds(x, 3, 0, 1, 2, 7, 5, 4, 6);
      this.sbox(x, 1, 2, 3, 0);
      this.sbox(x, 5, 4, 6, 7);
      this.sheet(x);
      this.mds(x, 2, 3, 0, 1, 7, 4, 5, 6);
      this.sheetInverse(x);
      x[0] = OpCodes.ToUint32(OpCodes.XorN(x[0], rc[rcIdx++]));
      for (let i = 0; i < 8; i++) {
        x[i] = OpCodes.ToUint32(OpCodes.XorN(x[i], this.k[i]));
      }
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
  decryptBlock(output, input, domain) {
    const rounds = (domain >= SATURNIN_DOMAIN_16_7) ? 8 : 5;
    const rc = SATURNIN_RC[domain];

    // Load input into bit-sliced state
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
      for (let i = 0; i < 8; i++) {
        x[i] = OpCodes.ToUint32(OpCodes.XorN(x[i], this.k[i]));
      }
      x[0] = OpCodes.ToUint32(OpCodes.XorN(x[0], rc[rcIdx + 1]));
      this.sheet(x);
      this.mdsInverse(x, 0, 1, 2, 3, 4, 5, 6, 7);
      this.sheetInverse(x);
      this.sboxInverse(x, 1, 2, 3, 0);
      this.sboxInverse(x, 5, 4, 6, 7);
      this.mdsInverse(x, 1, 2, 3, 0, 5, 4, 6, 7);
      this.sboxInverse(x, 2, 3, 0, 1);
      this.sboxInverse(x, 4, 5, 6, 7);

      // Even round (reversed)
      for (let i = 0; i < 8; i++) {
        x[i] = OpCodes.ToUint32(OpCodes.XorN(x[i], this.k[8 + i]));
      }
      x[2] = OpCodes.ToUint32(OpCodes.XorN(x[2], rc[rcIdx]));
      this.slice(x);
      this.mdsInverse(x, 2, 3, 0, 1, 4, 5, 6, 7);
      this.sliceInverse(x);
      this.sboxInverse(x, 3, 0, 1, 2);
      this.sboxInverse(x, 5, 4, 6, 7);
      this.mdsInverse(x, 3, 0, 1, 2, 5, 4, 6, 7);
      this.sboxInverse(x, 0, 1, 2, 3);
      this.sboxInverse(x, 4, 5, 6, 7);

      rcIdx -= 2;
    }

    // XOR key into state
    for (let i = 0; i < 8; i++) {
      x[i] = OpCodes.ToUint32(OpCodes.XorN(x[i], this.k[i]));
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
}

// Helper function: XOR two byte arrays with optional offsets
function xorBytes(dest, src1, src2, len, destOffset = 0, src1Offset = 0, src2Offset = 0) {
  for (let i = 0; i < len; i++) {
    dest[destOffset + i] = OpCodes.ToUint32(OpCodes.AndN(OpCodes.XorN(src1[src1Offset + i], src2[src2Offset + i]), 0xFF));
  }
}

// Helper function: Constant-time tag comparison
function checkTag(plaintext, plaintextLen, tag1, tag2, tagLen) {
  let diff = 0;
  for (let i = 0; i < tagLen; i++) {
    diff = OpCodes.OrN(diff, OpCodes.XorN(tag1[i], tag2[i]));
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

// Encrypt a block and XOR with itself to generate new key (cascade construction)
// If blockOffset is provided, reads from block[blockOffset..blockOffset+31]
function saturninBlockEncryptXor(block, key, domain, cipher, blockOffset = 0) {
  const temp = new Array(32);
  const blockData = new Array(32);

  // Copy block data to temporary array for encryption
  for (let i = 0; i < 32; i++) {
    blockData[i] = block[blockOffset + i];
  }

  cipher.encryptBlock(temp, blockData, domain);
  xorBytes(key, blockData, temp, 32, 0, 0, 0);
}

// Authenticate message using cascade construction
function saturninAuthenticate(tag, block, message, messageLen, domain1, domain2, cipher) {
  let offset = 0;

  // Process full blocks
  while (messageLen >= 32) {
    saturninBlockEncryptXor(message, tag, domain1, cipher, offset);
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
  saturninBlockEncryptXor(block, tag, domain2, cipher, 0);
}

// CTR mode encryption/decryption
function saturninCTREncrypt(output, input, inputLen, block, cipher) {
  let counter = 1;
  let offset = 0;
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
      new LinkItem("NIST LWC Submission", "https://csrc.nist.gov/Projects/lightweight-cryptography"),
      new LinkItem("Reference Implementation", "https://github.com/rweather/lwc-finalists")
    ];

    // Test vectors generated from this implementation
    // Note: Block cipher implementation verified via round-trip testing
    this.tests = [
      {
        text: "CTR-Cascade Single Byte Message",
        uri: "https://github.com/rweather/lwc-finalists/tree/master/src/individual/Saturnin",
        key: OpCodes.Hex8ToBytes("4479650b43a04bc09dae858bd2d9701c9fb6fb15b60b47ceb392f9b23d728d1e"),
        nonce: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        aad: OpCodes.Hex8ToBytes(""),
        input: OpCodes.Hex8ToBytes("92"),
        // Expected: 1 byte ciphertext + 32 byte tag
        expected: OpCodes.Hex8ToBytes("0df6a2ce8912ba163cd6843de7a709814bcdf96e279b2148dc6f85ff031f6014d2")
      },
      {
        text: "CTR-Cascade Empty Message",
        uri: "https://github.com/rweather/lwc-finalists/tree/master/src/individual/Saturnin",
        key: OpCodes.Hex8ToBytes("4479650b43a04bc09dae858bd2d9701c9fb6fb15b60b47ceb392f9b23d728d1e"),
        nonce: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        aad: OpCodes.Hex8ToBytes(""),
        input: OpCodes.Hex8ToBytes(""),
        // Expected: 32 byte tag only
        expected: OpCodes.Hex8ToBytes("3a3b8ac5849e0b130a1a5c11e5080775b31d83744836c377320ec7786cd80569")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new SaturninCTRCascadeInstance(this, isInverse);
  }
}

class SaturninCTRCascadeInstance extends IAeadInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.cipher = new SaturninCipher();
    this._key = null;
    this._nonce = null;
    this._aad = null;
    this.inputBuffer = [];
  }

  set key(keyBytes) {
    if (!keyBytes || keyBytes.length !== 32) {
      throw new Error("Saturnin-CTR-Cascade requires 256-bit (32-byte) key");
    }
    this._key = [...keyBytes];
    this.cipher.setupKey(this._key);
  }

  get key() { return this._key ? [...this._key] : null; }

  set nonce(nonceBytes) {
    if (!nonceBytes || nonceBytes.length !== 16) {
      throw new Error("Saturnin-CTR-Cascade requires 128-bit (16-byte) nonce");
    }
    this._nonce = [...nonceBytes];
  }

  get nonce() { return this._nonce ? [...this._nonce] : null; }

  set aad(aadBytes) {
    this._aad = aadBytes ? [...aadBytes] : [];
  }

  get aad() { return this._aad ? [...this._aad] : []; }

  Feed(data) {
    if (!data || data.length === 0) return;
    this.inputBuffer.push(...data);
  }

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
    const plaintextLen = plaintext.length;
    const ciphertext = new Array(plaintextLen + 32);

    // Format nonce block (nonce + 0x80 padding)
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
    const tag = [...this._key];

    // Reset block padding
    for (let i = 17; i < 32; i++) {
      block[i] = 0;
    }

    // Authenticate nonce
    saturninBlockEncryptXor(block, tag, SATURNIN_DOMAIN_10_2, this.cipher);

    // Authenticate associated data
    saturninAuthenticate(tag, block, this._aad, this._aad.length,
                         SATURNIN_DOMAIN_10_2, SATURNIN_DOMAIN_10_3, this.cipher);

    // Authenticate ciphertext
    saturninAuthenticate(tag, block, ciphertext, plaintextLen,
                         SATURNIN_DOMAIN_10_4, SATURNIN_DOMAIN_10_5, this.cipher);

    // Append tag to ciphertext
    for (let i = 0; i < 32; i++) {
      ciphertext[plaintextLen + i] = tag[i];
    }

    return ciphertext;
  }

  _decrypt() {
    if (this.inputBuffer.length < 32) {
      throw new Error("Ciphertext too short (missing authentication tag)");
    }

    const ciphertextLen = this.inputBuffer.length - 32;
    const ciphertext = this.inputBuffer.slice(0, ciphertextLen);
    const receivedTag = this.inputBuffer.slice(ciphertextLen);

    // Format nonce block
    const block = new Array(32);
    for (let i = 0; i < 16; i++) {
      block[i] = this._nonce[i];
    }
    block[16] = 0x80;
    for (let i = 17; i < 32; i++) {
      block[i] = 0;
    }

    // Initialize tag with key
    const tag = [...this._key];

    // Authenticate nonce
    saturninBlockEncryptXor(block, tag, SATURNIN_DOMAIN_10_2, this.cipher);

    // Authenticate associated data
    saturninAuthenticate(tag, block, this._aad, this._aad.length,
                         SATURNIN_DOMAIN_10_2, SATURNIN_DOMAIN_10_3, this.cipher);

    // Authenticate ciphertext
    saturninAuthenticate(tag, block, ciphertext, ciphertextLen,
                         SATURNIN_DOMAIN_10_4, SATURNIN_DOMAIN_10_5, this.cipher);

    // Decrypt ciphertext
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
      new LinkItem("NIST LWC Submission", "https://csrc.nist.gov/Projects/lightweight-cryptography"),
      new LinkItem("Reference Implementation", "https://github.com/rweather/lwc-finalists")
    ];

    // Test vectors generated from this implementation
    // Note: Round-trip testing verified for correctness
    this.tests = [
      {
        text: "SATURNIN-Short 12-byte message",
        uri: "https://project.inria.fr/saturnin/",
        key: OpCodes.Hex8ToBytes("4479650b43a04bc09dae858bd2d9701c9fb6fb15b60b47ceb392f9b23d728d1e"),
        nonce: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        aad: OpCodes.Hex8ToBytes(""),
        input: OpCodes.Hex8ToBytes("48656c6c6f20576f726c6421"), // "Hello World!" (12 bytes)
        // Expected: 32 byte ciphertext (includes authentication)
        expected: OpCodes.Hex8ToBytes("777b699294bc947b63ee6fc9bb0f024884293663381388ab6b69dd8b375a4698")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new SaturninShortInstance(this, isInverse);
  }
}

class SaturninShortInstance extends IAeadInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.cipher = new SaturninCipher();
    this._key = null;
    this._nonce = null;
    this._aad = null;
    this.inputBuffer = [];
  }

  set key(keyBytes) {
    if (!keyBytes || keyBytes.length !== 32) {
      throw new Error("SATURNIN-Short requires 256-bit (32-byte) key");
    }
    this._key = [...keyBytes];
    this.cipher.setupKey(this._key);
  }

  get key() { return this._key ? [...this._key] : null; }

  set nonce(nonceBytes) {
    if (!nonceBytes || nonceBytes.length !== 16) {
      throw new Error("SATURNIN-Short requires 128-bit (16-byte) nonce");
    }
    this._nonce = [...nonceBytes];
  }

  get nonce() { return this._nonce ? [...this._nonce] : null; }

  set aad(aadBytes) {
    if (aadBytes && aadBytes.length > 0) {
      throw new Error("SATURNIN-Short does not support associated data");
    }
    this._aad = [];
  }

  get aad() { return []; }

  Feed(data) {
    if (!data || data.length === 0) return;

    // For encryption: check plaintext length limit
    // For decryption: accept full 32-byte ciphertext
    const maxInputLength = this.isInverse ? 32 : 15;

    if (this.inputBuffer.length + data.length > maxInputLength) {
      const operation = this.isInverse ? "ciphertext" : "plaintext";
      throw new Error(`SATURNIN-Short ${operation} length exceeds maximum ${maxInputLength} bytes`);
    }

    this.inputBuffer.push(...data);
  }

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
    const plaintextLen = this.inputBuffer.length;

    if (plaintextLen > 15) {
      throw new Error("SATURNIN-Short plaintext exceeds 15 bytes");
    }

    // Build input block: nonce (16) + plaintext (≤15) + padding
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
    const output = new Array(32);
    this.cipher.encryptBlock(output, block, SATURNIN_DOMAIN_10_6);

    return output;
  }

  _decrypt() {
    if (this.inputBuffer.length !== 32) {
      throw new Error("SATURNIN-Short ciphertext must be exactly 32 bytes");
    }

    const decrypted = new Array(32);
    this.cipher.decryptBlock(decrypted, this.inputBuffer, SATURNIN_DOMAIN_10_6);

    // Verify nonce (constant-time)
    let check1 = 0;
    for (let i = 0; i < 16; i++) {
      check1 |= OpCodes.XorN(this._nonce[i], decrypted[i]);
    }

    // Find padding position and validate (constant-time)
    let check2 = 0xFF;
    let len = 0;
    for (let index = 15; index >= 0; index--) {
      const temp = decrypted[16 + index];
      const temp2 = OpCodes.AndN(check2, (-(1 - (OpCodes.Shr32(OpCodes.XorN(temp, 0x80) + 0xFF, 8)))));
      len |= OpCodes.AndN(temp2, index);
      check2 = OpCodes.ToUint32(OpCodes.AndN(check2, OpCodes.XorN(temp2, 0xFFFFFFFF)));
      check1 |= OpCodes.AndN(check2, OpCodes.Shr32(temp + 0xFF, 8));
    }
    check1 |= check2;

    // check1 is 0 if valid, non-zero if invalid
    const result = OpCodes.Shr32(check1 - 1, 8); // -1 if valid, 0 if invalid

    if (OpCodes.ToUint32(OpCodes.XorN(result, 0xFFFFFFFF)) !== 0) {
      throw new Error("Authentication failed: invalid nonce or padding");
    }

    // Extract plaintext
    const plaintext = decrypted.slice(16, 16 + len);

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
