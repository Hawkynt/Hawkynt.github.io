/*
 * DryGASCON-HASH - NIST Lightweight Cryptography Hash Functions
 * Professional implementation following the DryGASCON specification
 * (c)2006-2025 Hawkynt
 *
 * DryGASCON-HASH is the hash function mode of DryGASCON, a finalist in NIST's
 * Lightweight Cryptography competition. It uses the DrySPONGE construction with
 * the GASCON permutation to provide cryptographic hash functions.
 *
 * This implementation provides:
 * - DryGASCON128-HASH: 256-bit (32-byte) output
 * - DryGASCON256-HASH: 512-bit (64-byte) output
 *
 * Reference: https://github.com/sebastien-riou/DryGASCON
 * NIST LWC: https://csrc.nist.gov/projects/lightweight-cryptography
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
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem, KeySize } = AlgorithmFramework;

  // ========================[ CONSTANTS ]========================

  const GASCON128_STATE_SIZE = 40;    // 5 x 64-bit words
  const DRYSPONGE128_RATE = 16;       // Rate in bytes
  const DRYSPONGE128_XSIZE = 16;      // X value size in bytes
  const DRYSPONGE128_ROUNDS = 7;      // Normal operation rounds
  const DRYSPONGE128_INIT_ROUNDS = 11; // Initialization rounds

  const DRYSPONGE256_RATE = 16;       // Rate in bytes for 256 variant
  const DRYSPONGE256_XSIZE = 16;      // X value size in bytes for 256 variant (same as 128)
  const DRYSPONGE256_ROUNDS = 8;      // Normal operation rounds for 256 (NOT 11!)
  const DRYSPONGE256_INIT_ROUNDS = 12; // Initialization rounds for 256 (NOT 11!)

  // Domain separation values (use same as AEAD - hash processes input as associated data)
  const DRYDOMAIN128_PADDED = OpCodes.Shl32(1, 8);
  const DRYDOMAIN128_FINAL = OpCodes.Shl32(1, 9);
  const DRYDOMAIN128_ASSOC_DATA = OpCodes.Shl32(2, 10);

  const DRYDOMAIN256_PADDED = OpCodes.Shl32(1, 2);
  const DRYDOMAIN256_FINAL = OpCodes.Shl32(1, 3);
  const DRYDOMAIN256_ASSOC_DATA = OpCodes.Shl32(2, 4);

  // ========================[ BIT-INTERLEAVED ROTATIONS ]========================

  // 64-bit rotation helper using bit-interleaved format
  function rotr64_interleaved(low, high, bits) {
    bits = bits % 64;
    if (bits === 0) return [low, high];

    if (bits < 32) {
      const newLow = OpCodes.RotR32(low, bits);
      const newHigh = OpCodes.RotR32(high, bits);
      return [newLow, newHigh];
    }

    bits -= 32;
    const newLow = OpCodes.RotR32(high, bits);
    const newHigh = OpCodes.RotR32(low, bits);
    return [newLow, newHigh];
  }

  // Odd rotation: swap low/high and adjust rotation amount
  function rotr64_interleaved_odd(low, high, bits) {
    const low_rot = OpCodes.RotR32(low, ((bits + 1) % 32));
    const high_rot = OpCodes.RotR32(high, bits);
    return [high_rot, low_rot];
  }

  // ========================[ GASCON-128 PERMUTATION ]========================

  class GASCON128Permutation {
    constructor() {
      // State: 5 x 64-bit words stored as pairs [low32, high32] for bit-interleaved operations
      this.S = new Array(5);
      for (let i = 0; i < 5; ++i) {
        this.S[i] = [0, 0]; // [low32, high32]
      }
    }

    // Core round function
    coreRound(roundNum) {
      // Add round constant to S[2]: ((0x0F - round) << 4) | round
      const c = OpCodes.OrN(OpCodes.Shl32(0x0F - roundNum, 4), roundNum);
      this.S[2][0] = OpCodes.ToUint32(OpCodes.XorN(this.S[2][0], c));

      // Substitution layer (chi function)
      this.S[0][0] = OpCodes.ToUint32(OpCodes.XorN(this.S[0][0], this.S[4][0]));
      this.S[0][1] = OpCodes.ToUint32(OpCodes.XorN(this.S[0][1], this.S[4][1]));
      this.S[2][0] = OpCodes.ToUint32(OpCodes.XorN(this.S[2][0], this.S[1][0]));
      this.S[2][1] = OpCodes.ToUint32(OpCodes.XorN(this.S[2][1], this.S[1][1]));
      this.S[4][0] = OpCodes.ToUint32(OpCodes.XorN(this.S[4][0], this.S[3][0]));
      this.S[4][1] = OpCodes.ToUint32(OpCodes.XorN(this.S[4][1], this.S[3][1]));

      // t[i] = (~x[i])&x[i+1]
      const t0_l = OpCodes.ToUint32(OpCodes.AndN(~this.S[0][0], this.S[1][0]));
      const t0_h = OpCodes.ToUint32(OpCodes.AndN(~this.S[0][1], this.S[1][1]));
      const t1_l = OpCodes.ToUint32(OpCodes.AndN(~this.S[1][0], this.S[2][0]));
      const t1_h = OpCodes.ToUint32(OpCodes.AndN(~this.S[1][1], this.S[2][1]));
      const t2_l = OpCodes.ToUint32(OpCodes.AndN(~this.S[2][0], this.S[3][0]));
      const t2_h = OpCodes.ToUint32(OpCodes.AndN(~this.S[2][1], this.S[3][1]));
      const t3_l = OpCodes.ToUint32(OpCodes.AndN(~this.S[3][0], this.S[4][0]));
      const t3_h = OpCodes.ToUint32(OpCodes.AndN(~this.S[3][1], this.S[4][1]));
      const t4_l = OpCodes.ToUint32(OpCodes.AndN(~this.S[4][0], this.S[0][0]));
      const t4_h = OpCodes.ToUint32(OpCodes.AndN(~this.S[4][1], this.S[0][1]));

      // x[i] ^= t[i+1]
      this.S[0][0] = OpCodes.ToUint32(OpCodes.XorN(this.S[0][0], t1_l));
      this.S[0][1] = OpCodes.ToUint32(OpCodes.XorN(this.S[0][1], t1_h));
      this.S[1][0] = OpCodes.ToUint32(OpCodes.XorN(this.S[1][0], t2_l));
      this.S[1][1] = OpCodes.ToUint32(OpCodes.XorN(this.S[1][1], t2_h));
      this.S[2][0] = OpCodes.ToUint32(OpCodes.XorN(this.S[2][0], t3_l));
      this.S[2][1] = OpCodes.ToUint32(OpCodes.XorN(this.S[2][1], t3_h));
      this.S[3][0] = OpCodes.ToUint32(OpCodes.XorN(this.S[3][0], t4_l));
      this.S[3][1] = OpCodes.ToUint32(OpCodes.XorN(this.S[3][1], t4_h));
      this.S[4][0] = OpCodes.ToUint32(OpCodes.XorN(this.S[4][0], t0_l));
      this.S[4][1] = OpCodes.ToUint32(OpCodes.XorN(this.S[4][1], t0_h));

      // x1 ^= x0; x3 ^= x2; x0 ^= x4; x2 = ~x2;
      this.S[1][0] = OpCodes.ToUint32(OpCodes.XorN(this.S[1][0], this.S[0][0]));
      this.S[1][1] = OpCodes.ToUint32(OpCodes.XorN(this.S[1][1], this.S[0][1]));
      this.S[3][0] = OpCodes.ToUint32(OpCodes.XorN(this.S[3][0], this.S[2][0]));
      this.S[3][1] = OpCodes.ToUint32(OpCodes.XorN(this.S[3][1], this.S[2][1]));
      this.S[0][0] = OpCodes.ToUint32(OpCodes.XorN(this.S[0][0], this.S[4][0]));
      this.S[0][1] = OpCodes.ToUint32(OpCodes.XorN(this.S[0][1], this.S[4][1]));
      this.S[2][0] = OpCodes.ToUint32(~this.S[2][0]);
      this.S[2][1] = OpCodes.ToUint32(~this.S[2][1]);

      // Linear diffusion layer (bit-interleaved rotations)
      let r1 = rotr64_interleaved_odd(this.S[0][0], this.S[0][1], 9);
      let r2 = rotr64_interleaved(this.S[0][0], this.S[0][1], 14);
      this.S[0][0] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(this.S[0][0], r1[0]), r2[0]));
      this.S[0][1] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(this.S[0][1], r1[1]), r2[1]));

      r1 = rotr64_interleaved_odd(this.S[1][0], this.S[1][1], 30);
      r2 = rotr64_interleaved(this.S[1][0], this.S[1][1], 19);
      this.S[1][0] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(this.S[1][0], r1[0]), r2[0]));
      this.S[1][1] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(this.S[1][1], r1[1]), r2[1]));

      const r2a = rotr64_interleaved_odd(this.S[2][0], this.S[2][1], 0);
      r2 = rotr64_interleaved(this.S[2][0], this.S[2][1], 3);
      this.S[2][0] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(this.S[2][0], r2a[0]), r2[0]));
      this.S[2][1] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(this.S[2][1], r2a[1]), r2[1]));

      r1 = rotr64_interleaved(this.S[3][0], this.S[3][1], 5);
      r2 = rotr64_interleaved_odd(this.S[3][0], this.S[3][1], 8);
      this.S[3][0] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(this.S[3][0], r1[0]), r2[0]));
      this.S[3][1] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(this.S[3][1], r1[1]), r2[1]));

      r1 = rotr64_interleaved_odd(this.S[4][0], this.S[4][1], 3);
      r2 = rotr64_interleaved(this.S[4][0], this.S[4][1], 20);
      this.S[4][0] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(this.S[4][0], r1[0]), r2[0]));
      this.S[4][1] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(this.S[4][1], r1[1]), r2[1]));
    }
  }

  // ========================[ GASCON-256 PERMUTATION ]========================

  class GASCON256Permutation {
    constructor() {
      // State: 9 x 64-bit words stored as pairs [low32, high32] for bit-interleaved operations
      this.S = new Array(9);
      for (let i = 0; i < 9; ++i) {
        this.S[i] = [0, 0]; // [low32, high32]
      }
    }

    // Core round function
    coreRound(roundNum) {
      // Add round constant to S[4]: ((0x0F - round) << 4) | round
      const c = OpCodes.Or32(OpCodes.Shl32(0x0F - roundNum, 4), roundNum);
      this.S[4][0] = OpCodes.Xor32(this.S[4][0], c);

      // Substitution layer (chi function)
      this.S[0][0] = OpCodes.Xor32(this.S[0][0], this.S[8][0]);
      this.S[0][1] = OpCodes.Xor32(this.S[0][1], this.S[8][1]);
      this.S[2][0] = OpCodes.Xor32(this.S[2][0], this.S[1][0]);
      this.S[2][1] = OpCodes.Xor32(this.S[2][1], this.S[1][1]);
      this.S[4][0] = OpCodes.Xor32(this.S[4][0], this.S[3][0]);
      this.S[4][1] = OpCodes.Xor32(this.S[4][1], this.S[3][1]);
      this.S[6][0] = OpCodes.Xor32(this.S[6][0], this.S[5][0]);
      this.S[6][1] = OpCodes.Xor32(this.S[6][1], this.S[5][1]);
      this.S[8][0] = OpCodes.Xor32(this.S[8][0], this.S[7][0]);
      this.S[8][1] = OpCodes.Xor32(this.S[8][1], this.S[7][1]);

      // t[i] = (~x[i])&x[i+1]
      const t0_l = OpCodes.And32(OpCodes.Not32(this.S[0][0]), this.S[1][0]);
      const t0_h = OpCodes.And32(OpCodes.Not32(this.S[0][1]), this.S[1][1]);
      const t1_l = OpCodes.And32(OpCodes.Not32(this.S[1][0]), this.S[2][0]);
      const t1_h = OpCodes.And32(OpCodes.Not32(this.S[1][1]), this.S[2][1]);
      const t2_l = OpCodes.And32(OpCodes.Not32(this.S[2][0]), this.S[3][0]);
      const t2_h = OpCodes.And32(OpCodes.Not32(this.S[2][1]), this.S[3][1]);
      const t3_l = OpCodes.And32(OpCodes.Not32(this.S[3][0]), this.S[4][0]);
      const t3_h = OpCodes.And32(OpCodes.Not32(this.S[3][1]), this.S[4][1]);
      const t4_l = OpCodes.And32(OpCodes.Not32(this.S[4][0]), this.S[5][0]);
      const t4_h = OpCodes.And32(OpCodes.Not32(this.S[4][1]), this.S[5][1]);
      const t5_l = OpCodes.And32(OpCodes.Not32(this.S[5][0]), this.S[6][0]);
      const t5_h = OpCodes.And32(OpCodes.Not32(this.S[5][1]), this.S[6][1]);
      const t6_l = OpCodes.And32(OpCodes.Not32(this.S[6][0]), this.S[7][0]);
      const t6_h = OpCodes.And32(OpCodes.Not32(this.S[6][1]), this.S[7][1]);
      const t7_l = OpCodes.And32(OpCodes.Not32(this.S[7][0]), this.S[8][0]);
      const t7_h = OpCodes.And32(OpCodes.Not32(this.S[7][1]), this.S[8][1]);
      const t8_l = OpCodes.And32(OpCodes.Not32(this.S[8][0]), this.S[0][0]);
      const t8_h = OpCodes.And32(OpCodes.Not32(this.S[8][1]), this.S[0][1]);

      // x[i] ^= t[i+1]
      this.S[0][0] = OpCodes.Xor32(this.S[0][0], t1_l);
      this.S[0][1] = OpCodes.Xor32(this.S[0][1], t1_h);
      this.S[1][0] = OpCodes.Xor32(this.S[1][0], t2_l);
      this.S[1][1] = OpCodes.Xor32(this.S[1][1], t2_h);
      this.S[2][0] = OpCodes.Xor32(this.S[2][0], t3_l);
      this.S[2][1] = OpCodes.Xor32(this.S[2][1], t3_h);
      this.S[3][0] = OpCodes.Xor32(this.S[3][0], t4_l);
      this.S[3][1] = OpCodes.Xor32(this.S[3][1], t4_h);
      this.S[4][0] = OpCodes.Xor32(this.S[4][0], t5_l);
      this.S[4][1] = OpCodes.Xor32(this.S[4][1], t5_h);
      this.S[5][0] = OpCodes.Xor32(this.S[5][0], t6_l);
      this.S[5][1] = OpCodes.Xor32(this.S[5][1], t6_h);
      this.S[6][0] = OpCodes.Xor32(this.S[6][0], t7_l);
      this.S[6][1] = OpCodes.Xor32(this.S[6][1], t7_h);
      this.S[7][0] = OpCodes.Xor32(this.S[7][0], t8_l);
      this.S[7][1] = OpCodes.Xor32(this.S[7][1], t8_h);
      this.S[8][0] = OpCodes.Xor32(this.S[8][0], t0_l);
      this.S[8][1] = OpCodes.Xor32(this.S[8][1], t0_h);

      // x1 ^= x0; x3 ^= x2; x5 ^= x4; x7 ^= x6; x0 ^= x8; x4 = ~x4;
      this.S[1][0] = OpCodes.Xor32(this.S[1][0], this.S[0][0]);
      this.S[1][1] = OpCodes.Xor32(this.S[1][1], this.S[0][1]);
      this.S[3][0] = OpCodes.Xor32(this.S[3][0], this.S[2][0]);
      this.S[3][1] = OpCodes.Xor32(this.S[3][1], this.S[2][1]);
      this.S[5][0] = OpCodes.Xor32(this.S[5][0], this.S[4][0]);
      this.S[5][1] = OpCodes.Xor32(this.S[5][1], this.S[4][1]);
      this.S[7][0] = OpCodes.Xor32(this.S[7][0], this.S[6][0]);
      this.S[7][1] = OpCodes.Xor32(this.S[7][1], this.S[6][1]);
      this.S[0][0] = OpCodes.Xor32(this.S[0][0], this.S[8][0]);
      this.S[0][1] = OpCodes.Xor32(this.S[0][1], this.S[8][1]);
      this.S[4][0] = OpCodes.Not32(this.S[4][0]);
      this.S[4][1] = OpCodes.Not32(this.S[4][1]);

      // Linear diffusion layer (bit-interleaved rotations)
      let r1, r2, r2a;

      r1 = rotr64_interleaved_odd(this.S[0][0], this.S[0][1], 9);
      r2 = rotr64_interleaved(this.S[0][0], this.S[0][1], 14);
      this.S[0][0] = OpCodes.Xor32(OpCodes.Xor32(this.S[0][0], r1[0]), r2[0]);
      this.S[0][1] = OpCodes.Xor32(OpCodes.Xor32(this.S[0][1], r1[1]), r2[1]);

      r1 = rotr64_interleaved_odd(this.S[1][0], this.S[1][1], 30);
      r2 = rotr64_interleaved(this.S[1][0], this.S[1][1], 19);
      this.S[1][0] = OpCodes.Xor32(OpCodes.Xor32(this.S[1][0], r1[0]), r2[0]);
      this.S[1][1] = OpCodes.Xor32(OpCodes.Xor32(this.S[1][1], r1[1]), r2[1]);

      r2a = rotr64_interleaved_odd(this.S[2][0], this.S[2][1], 0);
      r2 = rotr64_interleaved(this.S[2][0], this.S[2][1], 3);
      this.S[2][0] = OpCodes.Xor32(OpCodes.Xor32(this.S[2][0], r2a[0]), r2[0]);
      this.S[2][1] = OpCodes.Xor32(OpCodes.Xor32(this.S[2][1], r2a[1]), r2[1]);

      r1 = rotr64_interleaved(this.S[3][0], this.S[3][1], 5);
      r2 = rotr64_interleaved_odd(this.S[3][0], this.S[3][1], 8);
      this.S[3][0] = OpCodes.Xor32(OpCodes.Xor32(this.S[3][0], r1[0]), r2[0]);
      this.S[3][1] = OpCodes.Xor32(OpCodes.Xor32(this.S[3][1], r1[1]), r2[1]);

      r1 = rotr64_interleaved_odd(this.S[4][0], this.S[4][1], 3);
      r2 = rotr64_interleaved(this.S[4][0], this.S[4][1], 20);
      this.S[4][0] = OpCodes.Xor32(OpCodes.Xor32(this.S[4][0], r1[0]), r2[0]);
      this.S[4][1] = OpCodes.Xor32(OpCodes.Xor32(this.S[4][1], r1[1]), r2[1]);

      r1 = rotr64_interleaved_odd(this.S[5][0], this.S[5][1], 15);
      r2 = rotr64_interleaved(this.S[5][0], this.S[5][1], 13);
      this.S[5][0] = OpCodes.Xor32(OpCodes.Xor32(this.S[5][0], r1[0]), r2[0]);
      this.S[5][1] = OpCodes.Xor32(OpCodes.Xor32(this.S[5][1], r1[1]), r2[1]);

      r1 = rotr64_interleaved_odd(this.S[6][0], this.S[6][1], 26);
      r2 = rotr64_interleaved(this.S[6][0], this.S[6][1], 29);
      this.S[6][0] = OpCodes.Xor32(OpCodes.Xor32(this.S[6][0], r1[0]), r2[0]);
      this.S[6][1] = OpCodes.Xor32(OpCodes.Xor32(this.S[6][1], r1[1]), r2[1]);

      r1 = rotr64_interleaved_odd(this.S[7][0], this.S[7][1], 4);
      r2 = rotr64_interleaved(this.S[7][0], this.S[7][1], 23);
      this.S[7][0] = OpCodes.Xor32(OpCodes.Xor32(this.S[7][0], r1[0]), r2[0]);
      this.S[7][1] = OpCodes.Xor32(OpCodes.Xor32(this.S[7][1], r1[1]), r2[1]);

      r1 = rotr64_interleaved_odd(this.S[8][0], this.S[8][1], 21);
      r2 = rotr64_interleaved(this.S[8][0], this.S[8][1], 25);
      this.S[8][0] = OpCodes.Xor32(OpCodes.Xor32(this.S[8][0], r1[0]), r2[0]);
      this.S[8][1] = OpCodes.Xor32(OpCodes.Xor32(this.S[8][1], r1[1]), r2[1]);
    }
  }

  // ========================[ DRYSPONGE128 STATE ]========================

  class DrySponge128State {
    constructor(rate, xsize, rounds, initRounds) {
      this.c = new GASCON128Permutation();
      this.r = new Array(rate);
      for (let i = 0; i < rate; ++i) this.r[i] = 0;
      this.x = new Array(xsize);
      for (let i = 0; i < xsize; ++i) this.x[i] = 0;
      this.domain = 0;
      this.rounds = rounds;
      this.initRounds = initRounds;
      this.rate = rate;
      this.xsize = xsize;
    }

    // Helper to select x word (constant-time selection)
    selectX(index) {
      const wordsCount = this.xsize / 4;
      const xW = new Array(wordsCount);
      for (let i = 0; i < wordsCount; ++i) {
        xW[i] = OpCodes.Pack32LE(
          this.x[i * 4],
          this.x[i * 4 + 1],
          this.x[i * 4 + 2],
          this.x[i * 4 + 3]
        );
      }

      // Constant-time selection
      let result = 0;
      for (let i = 0; i < wordsCount; ++i) {
        const mask = ((i === index) ? 0xFFFFFFFF : 0);
        result = OpCodes.Xor32(result, OpCodes.And32(xW[i], mask));
      }
      return result;
    }

    // Mix phase: absorb data into state
    mixPhase(data) {
      const ds = this.domain;

      // Mix 10-bit groups into state
      const mixData = new Array(14);
      mixData[0] = OpCodes.Or32(data[0], OpCodes.Shl32(data[1], 8));
      mixData[1] = OpCodes.Or32(OpCodes.Shr32(data[1], 2), OpCodes.Shl32(data[2], 6));
      mixData[2] = OpCodes.Or32(OpCodes.Shr32(data[2], 4), OpCodes.Shl32(data[3], 4));
      mixData[3] = OpCodes.Or32(OpCodes.Shr32(data[3], 6), OpCodes.Shl32(data[4], 2));
      mixData[4] = OpCodes.Or32(data[5], OpCodes.Shl32(data[6], 8));
      mixData[5] = OpCodes.Or32(OpCodes.Shr32(data[6], 2), OpCodes.Shl32(data[7], 6));
      mixData[6] = OpCodes.Or32(OpCodes.Shr32(data[7], 4), OpCodes.Shl32(data[8], 4));
      mixData[7] = OpCodes.Or32(OpCodes.Shr32(data[8], 6), OpCodes.Shl32(data[9], 2));
      mixData[8] = OpCodes.Or32(data[10], OpCodes.Shl32(data[11], 8));
      mixData[9] = OpCodes.Or32(OpCodes.Shr32(data[11], 2), OpCodes.Shl32(data[12], 6));
      mixData[10] = OpCodes.Or32(OpCodes.Shr32(data[12], 4), OpCodes.Shl32(data[13], 4));
      mixData[11] = OpCodes.Or32(OpCodes.Shr32(data[13], 6), OpCodes.Shl32(data[14], 2));
      mixData[12] = OpCodes.Xor32(data[15], ds);  // Domain separator added here
      mixData[13] = OpCodes.Shr32(ds, 10);

      // Mix rounds: 13 rounds with core_round, last without
      for (let i = 0; i < 13; ++i) {
        this.mixPhaseRound(OpCodes.And32(mixData[i], 0x3FF));
        this.c.coreRound(0);
      }
      // Final mix round without core_round after it
      this.mixPhaseRound(OpCodes.And32(mixData[13], 0x3FF));
    }

    // Mix a single 10-bit value into state
    mixPhaseRound(data) {
      const wordsCount = this.xsize / 4;
      const x0 = this.selectX(OpCodes.And32(data, 0x03));
      const x1 = this.selectX(OpCodes.And32(OpCodes.Shr32(data, 2), 0x03));
      const x2 = this.selectX(OpCodes.And32(OpCodes.Shr32(data, 4), 0x03));
      const x3 = this.selectX(OpCodes.And32(OpCodes.Shr32(data, 6), 0x03));
      const x4 = this.selectX(OpCodes.And32(OpCodes.Shr32(data, 8), 0x03));

      this.c.S[0][0] = OpCodes.Xor32(this.c.S[0][0], x0);
      this.c.S[1][0] = OpCodes.Xor32(this.c.S[1][0], x1);
      this.c.S[2][0] = OpCodes.Xor32(this.c.S[2][0], x2);
      this.c.S[3][0] = OpCodes.Xor32(this.c.S[3][0], x3);
      this.c.S[4][0] = OpCodes.Xor32(this.c.S[4][0], x4);
    }

    // G function: run core rounds and squeeze output
    g() {
      // Extract W[0-9] as flat 32-bit words from bit-interleaved state
      // W[0]=S[0][low], W[1]=S[0][high], W[2]=S[1][low], W[3]=S[1][high], ...
      for (let round = 0; round < this.rounds; ++round) {
        this.c.coreRound(round);

        // XOR pattern from reference: W[0]^W[5], W[1]^W[6], W[2]^W[7], W[3]^W[4]
        const W = [
          this.c.S[0][0],  // W[0]
          this.c.S[0][1],  // W[1]
          this.c.S[1][0],  // W[2]
          this.c.S[1][1],  // W[3]
          this.c.S[2][0],  // W[4]
          this.c.S[2][1],  // W[5]
          this.c.S[3][0],  // W[6]
          this.c.S[3][1],  // W[7]
          this.c.S[4][0],  // W[8]
          this.c.S[4][1]   // W[9]
        ];

        const out0 = OpCodes.Xor32(W[0], W[5]);
        const out1 = OpCodes.Xor32(W[1], W[6]);
        const out2 = OpCodes.Xor32(W[2], W[7]);
        const out3 = OpCodes.Xor32(W[3], W[4]);

        // Convert to bytes
        const b0 = OpCodes.Unpack32LE(out0);
        const b1 = OpCodes.Unpack32LE(out1);
        const b2 = OpCodes.Unpack32LE(out2);
        const b3 = OpCodes.Unpack32LE(out3);

        if (round === 0) {
          // First round: set r[]
          this.r[0] = b0[0]; this.r[1] = b0[1]; this.r[2] = b0[2]; this.r[3] = b0[3];
          this.r[4] = b1[0]; this.r[5] = b1[1]; this.r[6] = b1[2]; this.r[7] = b1[3];
          this.r[8] = b2[0]; this.r[9] = b2[1]; this.r[10] = b2[2]; this.r[11] = b2[3];
          this.r[12] = b3[0]; this.r[13] = b3[1]; this.r[14] = b3[2]; this.r[15] = b3[3];
        } else {
          // Subsequent rounds: XOR into r[]
          this.r[0] = OpCodes.Xor32(this.r[0], b0[0]); this.r[1] = OpCodes.Xor32(this.r[1], b0[1]); this.r[2] = OpCodes.Xor32(this.r[2], b0[2]); this.r[3] = OpCodes.Xor32(this.r[3], b0[3]);
          this.r[4] = OpCodes.Xor32(this.r[4], b1[0]); this.r[5] = OpCodes.Xor32(this.r[5], b1[1]); this.r[6] = OpCodes.Xor32(this.r[6], b1[2]); this.r[7] = OpCodes.Xor32(this.r[7], b1[3]);
          this.r[8] = OpCodes.Xor32(this.r[8], b2[0]); this.r[9] = OpCodes.Xor32(this.r[9], b2[1]); this.r[10] = OpCodes.Xor32(this.r[10], b2[2]); this.r[11] = OpCodes.Xor32(this.r[11], b2[3]);
          this.r[12] = OpCodes.Xor32(this.r[12], b3[0]); this.r[13] = OpCodes.Xor32(this.r[13], b3[1]); this.r[14] = OpCodes.Xor32(this.r[14], b3[2]); this.r[15] = OpCodes.Xor32(this.r[15], b3[3]);
        }
      }
    }

    // F function: mix + g
    f(input, len) {
      const padded = new Array(this.rate);
      if (len < this.rate) {
        for (let i = 0; i < len; ++i) padded[i] = input[i];
        padded[len] = 0x01;
        for (let i = len + 1; i < this.rate; ++i) padded[i] = 0;
      } else {
        for (let i = 0; i < this.rate; ++i) padded[i] = input[i];
      }

      this.mixPhase(padded);
      this.g();
      this.domain = 0;
    }
  }

  // ========================[ DRYSPONGE256 STATE ]========================

  class DrySponge256State {
    constructor(rate, xsize, rounds, initRounds) {
      this.c = new GASCON256Permutation();
      this.r = new Array(rate);
      for (let i = 0; i < rate; ++i) this.r[i] = 0;
      this.x = new Array(xsize);
      for (let i = 0; i < xsize; ++i) this.x[i] = 0;
      this.domain = 0;
      this.rounds = rounds;
      this.initRounds = initRounds;
      this.rate = rate;
      this.xsize = xsize;
    }

    // Helper to select x word (constant-time selection)
    selectX(index) {
      const wordsCount = this.xsize / 4;
      const xW = new Array(wordsCount);
      for (let i = 0; i < wordsCount; ++i) {
        xW[i] = OpCodes.Pack32LE(
          this.x[i * 4],
          this.x[i * 4 + 1],
          this.x[i * 4 + 2],
          this.x[i * 4 + 3]
        );
      }

      // Constant-time selection
      let result = 0;
      for (let i = 0; i < wordsCount; ++i) {
        const mask = ((i === index) ? 0xFFFFFFFF : 0);
        result = OpCodes.Xor32(result, OpCodes.And32(xW[i], mask));
      }
      return result;
    }

    // Mix phase: absorb data into state (18-bit groups for GASCON256)
    mixPhase(data) {
      const ds = this.domain;

      // For GASCON256: mix 18-bit groups (9 x 2-bit indices = 18 bits per mix round)
      // Reference: internal-drysponge.c lines 485-522
      // Exactly matching C code line-by-line

      // Round 1: data[0..2] (bits 0-23, take bits 0-17)
      this.mixPhaseRound(OpCodes.Or32(OpCodes.Or32(data[0], OpCodes.Shl32(data[1], 8)), OpCodes.Shl32(data[2], 16)));
      this.c.coreRound(0);

      // Round 2: data[2..4] shifted (bits 18-41, take bits 18-35)
      this.mixPhaseRound(OpCodes.Or32(OpCodes.Or32(OpCodes.Shr32(data[2], 2), OpCodes.Shl32(data[3], 6)), OpCodes.Shl32(data[4], 14)));
      this.c.coreRound(0);

      // Round 3: data[4..6] shifted (bits 36-59, take bits 36-53)
      this.mixPhaseRound(OpCodes.Or32(OpCodes.Or32(OpCodes.Shr32(data[4], 4), OpCodes.Shl32(data[5], 4)), OpCodes.Shl32(data[6], 12)));
      this.c.coreRound(0);

      // Round 4: data[6..8] shifted (bits 54-77, take bits 54-71)
      this.mixPhaseRound(OpCodes.Or32(OpCodes.Or32(OpCodes.Shr32(data[6], 6), OpCodes.Shl32(data[7], 2)), OpCodes.Shl32(data[8], 10)));
      this.c.coreRound(0);

      // Round 5: data[9..11] (bits 72-95, take bits 72-89)
      this.mixPhaseRound(OpCodes.Or32(OpCodes.Or32(data[9], OpCodes.Shl32(data[10], 8)), OpCodes.Shl32(data[11], 16)));
      this.c.coreRound(0);

      // Round 6: data[11..13] shifted (bits 90-113, take bits 90-107)
      this.mixPhaseRound(OpCodes.Or32(OpCodes.Or32(OpCodes.Shr32(data[11], 2), OpCodes.Shl32(data[12], 6)), OpCodes.Shl32(data[13], 14)));
      this.c.coreRound(0);

      // Round 7: data[13..15] shifted (bits 108-127, take bits 108-125)
      this.mixPhaseRound(OpCodes.Or32(OpCodes.Or32(OpCodes.Shr32(data[13], 4), OpCodes.Shl32(data[14], 4)), OpCodes.Shl32(data[15], 12)));
      this.c.coreRound(0);

      // Round 8: data[15] final 2 bits + domain separator (bits 126-127)
      this.mixPhaseRound(OpCodes.Xor32(OpCodes.Shr32(data[15], 6), ds));

      // Reset domain for next block
      this.domain = 0;
    }

    // Mix a value into state (up to 9 x 2-bit indices = 18 bits for GASCON256)
    mixPhaseRound(data) {
      // For GASCON256: up to 9 x 2-bit indices
      // Mix into c.W[0, 2, 4, 6, 8, 10, 12, 14, 16] (9 even-indexed words)
      // In bit-interleaved format: S[0][0], S[1][0], S[2][0], ..., S[8][0]
      // Reference: internal-drysponge.c lines 410-423
      const indices = 9;  // GASCON256 always uses 9 indices
      const x = new Array(indices);

      for (let i = 0; i < indices; ++i) {
        x[i] = this.selectX(OpCodes.And32(OpCodes.Shr32(data, (i * 2)), 0x03));
      }

      this.c.S[0][0] = OpCodes.Xor32(this.c.S[0][0], x[0]);
      this.c.S[1][0] = OpCodes.Xor32(this.c.S[1][0], x[1]);
      this.c.S[2][0] = OpCodes.Xor32(this.c.S[2][0], x[2]);
      this.c.S[3][0] = OpCodes.Xor32(this.c.S[3][0], x[3]);
      this.c.S[4][0] = OpCodes.Xor32(this.c.S[4][0], x[4]);
      this.c.S[5][0] = OpCodes.Xor32(this.c.S[5][0], x[5]);
      this.c.S[6][0] = OpCodes.Xor32(this.c.S[6][0], x[6]);
      this.c.S[7][0] = OpCodes.Xor32(this.c.S[7][0], x[7]);
      this.c.S[8][0] = OpCodes.Xor32(this.c.S[8][0], x[8]);
    }

    // G function for GASCON256: XOR pattern W[0]^W[5]^W[10]^W[15], etc.
    g() {
      // GASCON256 has 18 x 32-bit words (W[0..17])
      // XOR pattern from reference C code:
      // W[0] = c.W[0] ^ c.W[5] ^ c.W[10] ^ c.W[15]
      // W[1] = c.W[1] ^ c.W[6] ^ c.W[11] ^ c.W[12]
      // W[2] = c.W[2] ^ c.W[7] ^ c.W[8] ^ c.W[13]
      // W[3] = c.W[3] ^ c.W[4] ^ c.W[9] ^ c.W[14]

      for (let round = 0; round < this.rounds; ++round) {
        this.c.coreRound(round);

        // Extract W[0-17] as flat 32-bit words from bit-interleaved state
        const W = [
          this.c.S[0][0], this.c.S[0][1],  // W[0], W[1]
          this.c.S[1][0], this.c.S[1][1],  // W[2], W[3]
          this.c.S[2][0], this.c.S[2][1],  // W[4], W[5]
          this.c.S[3][0], this.c.S[3][1],  // W[6], W[7]
          this.c.S[4][0], this.c.S[4][1],  // W[8], W[9]
          this.c.S[5][0], this.c.S[5][1],  // W[10], W[11]
          this.c.S[6][0], this.c.S[6][1],  // W[12], W[13]
          this.c.S[7][0], this.c.S[7][1],  // W[14], W[15]
          this.c.S[8][0], this.c.S[8][1]   // W[16], W[17]
        ];

        // XOR pattern for 256 variant
        const out0 = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(W[0], W[5]), W[10]), W[15]);
        const out1 = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(W[1], W[6]), W[11]), W[12]);
        const out2 = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(W[2], W[7]), W[8]), W[13]);
        const out3 = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(W[3], W[4]), W[9]), W[14]);

        // Convert to bytes
        const b0 = OpCodes.Unpack32LE(out0);
        const b1 = OpCodes.Unpack32LE(out1);
        const b2 = OpCodes.Unpack32LE(out2);
        const b3 = OpCodes.Unpack32LE(out3);

        if (round === 0) {
          // First round: set r[]
          this.r[0] = b0[0]; this.r[1] = b0[1]; this.r[2] = b0[2]; this.r[3] = b0[3];
          this.r[4] = b1[0]; this.r[5] = b1[1]; this.r[6] = b1[2]; this.r[7] = b1[3];
          this.r[8] = b2[0]; this.r[9] = b2[1]; this.r[10] = b2[2]; this.r[11] = b2[3];
          this.r[12] = b3[0]; this.r[13] = b3[1]; this.r[14] = b3[2]; this.r[15] = b3[3];
        } else {
          // Subsequent rounds: XOR into r[]
          this.r[0] = OpCodes.Xor32(this.r[0], b0[0]); this.r[1] = OpCodes.Xor32(this.r[1], b0[1]); this.r[2] = OpCodes.Xor32(this.r[2], b0[2]); this.r[3] = OpCodes.Xor32(this.r[3], b0[3]);
          this.r[4] = OpCodes.Xor32(this.r[4], b1[0]); this.r[5] = OpCodes.Xor32(this.r[5], b1[1]); this.r[6] = OpCodes.Xor32(this.r[6], b1[2]); this.r[7] = OpCodes.Xor32(this.r[7], b1[3]);
          this.r[8] = OpCodes.Xor32(this.r[8], b2[0]); this.r[9] = OpCodes.Xor32(this.r[9], b2[1]); this.r[10] = OpCodes.Xor32(this.r[10], b2[2]); this.r[11] = OpCodes.Xor32(this.r[11], b2[3]);
          this.r[12] = OpCodes.Xor32(this.r[12], b3[0]); this.r[13] = OpCodes.Xor32(this.r[13], b3[1]); this.r[14] = OpCodes.Xor32(this.r[14], b3[2]); this.r[15] = OpCodes.Xor32(this.r[15], b3[3]);
        }
      }
    }

    // F function with absorb only (g_core - no squeeze)
    fAbsorb(input, len) {
      const padded = new Array(this.rate);
      if (len < this.rate) {
        for (let i = 0; i < len; ++i) padded[i] = input[i];
        padded[len] = 0x01;
        for (let i = len + 1; i < this.rate; ++i) padded[i] = 0;
      } else {
        for (let i = 0; i < this.rate; ++i) padded[i] = input[i];
      }

      this.mixPhase(padded);
    }

    // G-core: run rounds but don't squeeze
    gCore() {
      for (let round = 0; round < this.rounds; ++round) {
        this.c.coreRound(round);
      }
    }
  }

  // ========================[ DRYGASCON128-HASH ALGORITHM ]========================

  /**
 * DryGASCON128Hash - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class DryGASCON128Hash extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "DryGASCON128-HASH";
      this.description = "Lightweight hash function using DrySPONGE construction with GASCON permutation. NIST Lightweight Cryptography finalist providing 256-bit hash output with protection against side-channel attacks.";
      this.inventor = "Sébastien Riou, Michaël Raulet, Stéphane Castelain";
      this.year = 2020;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight Hash";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.FRANCE;

      this.SupportedOutputSizes = [new KeySize(32, 32, 1)];

      this.documentation = [
        new LinkItem(
          "DryGASCON GitHub Repository",
          "https://github.com/sebastien-riou/DryGASCON"
        ),
        new LinkItem(
          "NIST LWC Project Page",
          "https://csrc.nist.gov/projects/lightweight-cryptography"
        ),
        new LinkItem(
          "DryGASCON Specification",
          "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/drygascon-spec-final.pdf"
        )
      ];

      // Official test vectors from DryGASCON128-HASH.txt
      this.tests = [
        {
          text: "DryGASCON128-HASH: Empty message (Count=1)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON128-HASH.txt",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("1EDC77386E20A37C721D6E77ADABB9C4830F199F5ED25284A13C1D84B9FC257A")
        },
        {
          text: "DryGASCON128-HASH: Single byte 0x00 (Count=2)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON128-HASH.txt",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("1BEC89506E75D725BF93BCCFDD6EC81DF05CA281CF5201E3EE0865A7063763EE")
        },
        {
          text: "DryGASCON128-HASH: Two bytes (Count=3)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON128-HASH.txt",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("0FE4ED67EA1FF705E94E6D8AF07197728C1FC2D7D5ACCECB8D08CF39AE4D208D")
        },
        {
          text: "DryGASCON128-HASH: Four bytes (Count=5)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON128-HASH.txt",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("591A2858B4E3B0B99BC116E18B44B55D711F2A8E83FAE677CED46DB03E031B73")
        },
        {
          text: "DryGASCON128-HASH: Eight bytes (Count=9)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON128-HASH.txt",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("CDE2DEE0235345CBFA51EC2CE57435718EC0133EC2756E035FA404C1CE511E24")
        },
        {
          text: "DryGASCON128-HASH: 16 bytes (Count=17)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON128-HASH.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("572821D80D943E153CBB8C4556C3AD8CF20D77EDAD7998E8CD46F590D8D13EEB")
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
      return new DryGASCON128HashInstance(this);
    }
  }

  /**
 * DryGASCON128Hash cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class DryGASCON128HashInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.state = new DrySponge128State(
        DRYSPONGE128_RATE,
        DRYSPONGE128_XSIZE,
        DRYSPONGE128_ROUNDS,
        DRYSPONGE128_INIT_ROUNDS
      );
      this.inputBuffer = [];
      this.initialized = false;
    }

    _initialize() {
      if (this.initialized) return;

      // Precomputed initialization vector from C reference implementation
      // drygascon128_hash_init
      const hashInit = OpCodes.Hex8ToBytes(
        "243f6a8885a308d313198a2e03707344" +  // c[0-15]
        "243f6a8885a308d313198a2e03707344" +  // c[16-31]
        "243f6a8885a308d3" +                  // c[32-39]
        "a4093822299f31d0082efa98ec4e6c89"    // x[0-15]
      );

      // Load precomputed c state (40 bytes)
      for (let i = 0; i < 40; i += 8) {
        const idx = i / 8;
        this.state.c.S[idx] = [
          OpCodes.Pack32LE(hashInit[i], hashInit[i+1], hashInit[i+2], hashInit[i+3]),
          OpCodes.Pack32LE(hashInit[i+4], hashInit[i+5], hashInit[i+6], hashInit[i+7])
        ];
      }

      // Load precomputed x value (16 bytes)
      for (let i = 0; i < 16; ++i) {
        this.state.x[i] = hashInit[40 + i];
      }

      // Initialize r to zeros
      for (let i = 0; i < this.state.rate; ++i) {
        this.state.r[i] = 0;
      }

      this.state.domain = 0;
      this.initialized = true;
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
      this._initialize();

      const message = this.inputBuffer;
      const mLen = message.length;

      if (mLen === 0) {
        // Empty message: final block with domain separation
        this.state.domain = OpCodes.Or32(OpCodes.Or32(DRYDOMAIN128_ASSOC_DATA, DRYDOMAIN128_FINAL), DRYDOMAIN128_PADDED);
        this.state.f([], 0);
      } else {
        let offset = 0;

        // Absorb all blocks except the last (no domain separation)
        while (mLen - offset > this.state.rate) {
          const block = message.slice(offset, offset + this.state.rate);
          this.state.f(block, this.state.rate);
          offset += this.state.rate;
        }

        // Final block with domain separation (ASSOC_DATA for hash mode)
        const lastBlock = message.slice(offset);
        this.state.domain = OpCodes.Or32(DRYDOMAIN128_ASSOC_DATA, DRYDOMAIN128_FINAL);
        if (lastBlock.length < this.state.rate) {
          this.state.domain = OpCodes.Or32(this.state.domain, DRYDOMAIN128_PADDED);
        }
        this.state.f(lastBlock, lastBlock.length);
      }

      // Squeeze hash (two blocks for 256-bit output)
      const output = [];
      for (let i = 0; i < 16; ++i) {
        output.push(this.state.r[i]);
      }

      // Second block (call g to get next 16 bytes)
      this.state.g();
      for (let i = 0; i < 16; ++i) {
        output.push(this.state.r[i]);
      }

      this.inputBuffer = [];
      return output;
    }
  }

  // ========================[ DRYGASCON256-HASH ALGORITHM ]========================

  /**
 * DryGASCON256Hash - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class DryGASCON256Hash extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "DryGASCON256-HASH";
      this.description = "Extended lightweight hash function using DrySPONGE construction with GASCON permutation. Provides 512-bit hash output with enhanced security margin and side-channel resistance.";
      this.inventor = "Sébastien Riou, Michaël Raulet, Stéphane Castelain";
      this.year = 2020;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight Hash";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.FRANCE;

      this.SupportedOutputSizes = [new KeySize(64, 64, 1)];

      this.documentation = [
        new LinkItem(
          "DryGASCON GitHub Repository",
          "https://github.com/sebastien-riou/DryGASCON"
        ),
        new LinkItem(
          "NIST LWC Project Page",
          "https://csrc.nist.gov/projects/lightweight-cryptography"
        ),
        new LinkItem(
          "DryGASCON Specification",
          "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/drygascon-spec-final.pdf"
        )
      ];

      // Official test vectors from DryGASCON256-HASH.txt
      this.tests = [
        {
          text: "DryGASCON256-HASH: Empty message (Count=1)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON256-HASH.txt",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("6896590A319FDE1F3B18EBAE1DF1E5E8FB0756A878EE9E2165B085FF3AED6805F8F73D5714C75960A6A8095DAE5EF9C00D3F055490D4CF45D4A26B37FD7B5441")
        },
        {
          text: "DryGASCON256-HASH: Single byte 0x00 (Count=2)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON256-HASH.txt",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("DAB16B97C37160586B647B0DCA689794365480324E539CD63F87B119B0C46668DCDE5163A170E06DA9361B05F7CE7645EF68BDC99B3B813B8B1583C5C62D4E4A")
        },
        {
          text: "DryGASCON256-HASH: Two bytes (Count=3)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON256-HASH.txt",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("D1982BC43D8C42DCD94C1C7E9611951374DC8BF5E6FC407E8A8DC423F4F0F45909A4AEAA1000B35A8081862E797508807E8763F611AEF1D3C06ECAEDB5229980")
        },
        {
          text: "DryGASCON256-HASH: Four bytes (Count=5)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON256-HASH.txt",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("3C4C288299FD3986FB213B945ADDB70F26EDEA09FA4291CF42467355DA09FDD7E69A7B306636DAC078EE81643A19F5126EA71DBC4032BE2320B8382119238D5B")
        },
        {
          text: "DryGASCON256-HASH: Eight bytes (Count=9)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON256-HASH.txt",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("AC99FD9156D4C6FC613A85CBBFD283FC7214792B3E786E34B33D368020F79BF6FFC2C29FA86EAF1286506F30ADB3481B3830E115AE72F155C3045DD8A27894D1")
        },
        {
          text: "DryGASCON256-HASH: 16 bytes (Count=17)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON256-HASH.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("E743DE651072AE1A078D201373BC383FFAE607545308D268AC663B0B680FEE8BD0D053EA40A55C5DD2AEE281C1CBFFA79152ACC9BD5705F3FB4DAF415458CA12")
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
      return new DryGASCON256HashInstance(this);
    }
  }

  /**
 * DryGASCON256Hash cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class DryGASCON256HashInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.state = new DrySponge256State(
        DRYSPONGE256_RATE,
        DRYSPONGE256_XSIZE,
        DRYSPONGE256_ROUNDS,
        DRYSPONGE256_INIT_ROUNDS
      );
      this.inputBuffer = [];
      this.initialized = false;
    }

    _initialize() {
      if (this.initialized) return;

      // Precomputed initialization vector from C reference implementation
      // drygascon256_hash_init: c is 72 bytes (9 x 64-bit words), x is 16 bytes
      const hashInit = OpCodes.Hex8ToBytes(
        "243f6a8885a308d313198a2e03707344" +  // c[0-15]
        "a4093822299f31d0082efa98ec4e6c89" +  // c[16-31]
        "243f6a8885a308d313198a2e03707344" +  // c[32-47]
        "a4093822299f31d0082efa98ec4e6c89" +  // c[48-63]
        "243f6a8885a308d3" +                  // c[64-71]
        "452821e638d01377be5466cf34e90c6c"    // x[0-15]
      );

      // Load precomputed c state (72 bytes = 9 x 64-bit words)
      for (let i = 0; i < 72; i += 8) {
        const idx = i / 8;
        this.state.c.S[idx] = [
          OpCodes.Pack32LE(hashInit[i], hashInit[i+1], hashInit[i+2], hashInit[i+3]),
          OpCodes.Pack32LE(hashInit[i+4], hashInit[i+5], hashInit[i+6], hashInit[i+7])
        ];
      }

      // Load precomputed x value (16 bytes, starting at byte 72)
      for (let i = 0; i < 16; ++i) {
        this.state.x[i] = hashInit[72 + i];
      }

      // Initialize r to zeros
      for (let i = 0; i < this.state.rate; ++i) {
        this.state.r[i] = 0;
      }

      this.state.domain = 0;
      this.initialized = true;
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
      this._initialize();

      const message = this.inputBuffer;
      const mLen = message.length;

      // Process message as associated data (following drygascon256_process_ad)
      if (mLen === 0) {
        // Empty message: final block with domain separation
        this.state.domain = OpCodes.Or32(OpCodes.Or32(DRYDOMAIN256_ASSOC_DATA, DRYDOMAIN256_FINAL), DRYDOMAIN256_PADDED);
        this.state.fAbsorb([], 0);
        this.state.g();  // Final block gets full g() with squeeze
      } else {
        let offset = 0;

        // Absorb all blocks except the last using fAbsorb + gCore
        while (mLen - offset > this.state.rate) {
          const block = message.slice(offset, offset + this.state.rate);
          this.state.fAbsorb(block, this.state.rate);
          this.state.gCore();  // Only run rounds, no squeeze
          offset += this.state.rate;
        }

        // Final block with domain separation (ASSOC_DATA for hash mode)
        const lastBlock = message.slice(offset);
        this.state.domain = OpCodes.Or32(DRYDOMAIN256_ASSOC_DATA, DRYDOMAIN256_FINAL);
        if (lastBlock.length < this.state.rate) {
          this.state.domain = OpCodes.Or32(this.state.domain, DRYDOMAIN256_PADDED);
        }
        this.state.fAbsorb(lastBlock, lastBlock.length);
        this.state.g();  // Final block gets full g() with squeeze
      }

      // Squeeze hash (four blocks for 512-bit output)
      // First 16 bytes are in state.r after the final g() call above
      const output = [];
      for (let i = 0; i < 16; ++i) {
        output.push(this.state.r[i]);
      }

      // Additional three blocks (call g between each)
      for (let blockNum = 1; blockNum < 4; ++blockNum) {
        this.state.g();
        for (let i = 0; i < 16; ++i) {
          output.push(this.state.r[i]);
        }
      }

      this.inputBuffer = [];
      return output;
    }
  }

  // ========================[ REGISTRATION ]========================

  RegisterAlgorithm(new DryGASCON128Hash());
  RegisterAlgorithm(new DryGASCON256Hash());

  return {
    DryGASCON128Hash,
    DryGASCON128HashInstance,
    DryGASCON256Hash,
    DryGASCON256HashInstance
  };
}));
