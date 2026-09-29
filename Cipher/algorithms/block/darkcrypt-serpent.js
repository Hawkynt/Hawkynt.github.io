/*
 * Serpent (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The Serpent block cipher as implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). The round function (S-boxes cycling
 * S0..S7, standard linear transform) and 256-bit-only key size match textbook
 * Serpent, but the key schedule's prekey-word generation is NOT the overlapping
 * "circular buffer" recurrence used by common reference sources (e.g. libgcrypt):
 * it produces 33*4 = 132 non-overlapping prekey words w0..w131 from the 8 key
 * words via w[i] = ROTL(w[i-8] XOR w[i-5] XOR w[i-3] XOR w[i-1] XOR PHI XOR i, 11),
 * then groups them into consecutive non-overlapping quads (round i uses
 * w[4i..4i+3]) run through S-boxes in order S3,S2,S1,S0,S7,S6,S5,S4 (repeating).
 * This differs from this repository's textbook algorithms/block/serpent.js, whose
 * key schedule generates prekeys with an overlapping (i+k)%8 recurrence and does
 * not reproduce this variant's subkeys beyond the very first round key.
 * As implemented in the DarkCrypt Total Commander plugin; test vectors verified
 * against the DarkCrypt implementation.
 * 128-bit blocks, 256-bit keys only (fixed). Educational only.
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
}((function () {
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
          BlockCipherAlgorithm, IBlockCipherInstance,
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  const PHI = 0x9E3779B9;
  const ROUNDS = 32;

  // Forward S-boxes S0..S7 (standard Serpent boolean formulas).
  /**
   * Serpent S-box S0
   * @param {uint32} a - Word 0
   * @param {uint32} b - Word 1
   * @param {uint32} c - Word 2
   * @param {uint32} d - Word 3
   * @returns {uint32[]} The four output words
   */
  function sbox0(a, b, c, d) {
    const t1 = OpCodes.Xor32(a, d), t3 = OpCodes.Xor32(c, t1), t4 = OpCodes.Xor32(b, t3);
    const X3 = OpCodes.Xor32(OpCodes.And32(a, d), t4);
    const t7 = OpCodes.Xor32(a, OpCodes.And32(b, t1));
    const X2 = OpCodes.Xor32(t4, OpCodes.Or32(c, t7));
    const t12 = OpCodes.And32(X3, OpCodes.Xor32(t3, t7));
    const X1 = OpCodes.Xor32(~t3, t12);
    const X0 = OpCodes.Xor32(t12, ~t7);
    return [X0, X1, X2, X3];
  }

  /**
   * Serpent S-box S1
   * @param {uint32} a - Word 0
   * @param {uint32} b - Word 1
   * @param {uint32} c - Word 2
   * @param {uint32} d - Word 3
   * @returns {uint32[]} The four output words
   */
  function sbox1(a, b, c, d) {
    const t2 = OpCodes.Xor32(b, ~a);
    const t5 = OpCodes.Xor32(c, OpCodes.Or32(a, t2));
    const X2 = OpCodes.Xor32(d, t5);
    const t7 = OpCodes.Xor32(b, OpCodes.Or32(d, t2));
    const t8 = OpCodes.Xor32(t2, X2);
    const X3 = OpCodes.Xor32(t8, OpCodes.And32(t5, t7));
    const t11 = OpCodes.Xor32(t5, t7);
    const X1 = OpCodes.Xor32(X3, t11);
    const X0 = OpCodes.Xor32(t5, OpCodes.And32(t8, t11));
    return [X0, X1, X2, X3];
  }

  /**
   * Serpent S-box S2
   * @param {uint32} a - Word 0
   * @param {uint32} b - Word 1
   * @param {uint32} c - Word 2
   * @param {uint32} d - Word 3
   * @returns {uint32[]} The four output words
   */
  function sbox2(a, b, c, d) {
    const t1 = ~a;
    const t2 = OpCodes.Xor32(b, d);
    const t3 = OpCodes.And32(c, t1);
    const X0 = OpCodes.Xor32(t2, t3);
    const t5 = OpCodes.Xor32(c, t1);
    const t6 = OpCodes.Xor32(c, X0);
    const t7 = OpCodes.And32(b, t6);
    const X3 = OpCodes.Xor32(t5, t7);
    const X2 = OpCodes.Xor32(a, OpCodes.And32(OpCodes.Or32(d, t7), OpCodes.Or32(X0, t5)));
    const X1 = OpCodes.Xor32(OpCodes.Xor32(t2, X3), OpCodes.Xor32(X2, OpCodes.Or32(d, t1)));
    return [X0, X1, X2, X3];
  }

  /**
   * Serpent S-box S3
   * @param {uint32} a - Word 0
   * @param {uint32} b - Word 1
   * @param {uint32} c - Word 2
   * @param {uint32} d - Word 3
   * @returns {uint32[]} The four output words
   */
  function sbox3(a, b, c, d) {
    const t1 = OpCodes.Xor32(a, b);
    const t2 = OpCodes.And32(a, c);
    const t3 = OpCodes.Or32(a, d);
    const t4 = OpCodes.Xor32(c, d);
    const t5 = OpCodes.And32(t1, t3);
    const t6 = OpCodes.Or32(t2, t5);
    const X2 = OpCodes.Xor32(t4, t6);
    const t8 = OpCodes.Xor32(b, t3);
    const t9 = OpCodes.Xor32(t6, t8);
    const t10 = OpCodes.And32(t4, t9);
    const X0 = OpCodes.Xor32(t1, t10);
    const t12 = OpCodes.And32(X2, X0);
    const X1 = OpCodes.Xor32(t9, t12);
    const X3 = OpCodes.Xor32(OpCodes.Or32(b, d), OpCodes.Xor32(t4, t12));
    return [X0, X1, X2, X3];
  }

  /**
   * Serpent S-box S4
   * @param {uint32} a - Word 0
   * @param {uint32} b - Word 1
   * @param {uint32} c - Word 2
   * @param {uint32} d - Word 3
   * @returns {uint32[]} The four output words
   */
  function sbox4(a, b, c, d) {
    const t1 = OpCodes.Xor32(a, d);
    const t2 = OpCodes.And32(d, t1);
    const t3 = OpCodes.Xor32(c, t2);
    const t4 = OpCodes.Or32(b, t3);
    const X3 = OpCodes.Xor32(t1, t4);
    const t6 = ~b;
    const t7 = OpCodes.Or32(t1, t6);
    const X0 = OpCodes.Xor32(t3, t7);
    const t9 = OpCodes.And32(a, X0);
    const t10 = OpCodes.Xor32(t1, t6);
    const t11 = OpCodes.And32(t4, t10);
    const X2 = OpCodes.Xor32(t9, t11);
    const X1 = OpCodes.Xor32(OpCodes.Xor32(a, t3), OpCodes.And32(t10, X2));
    return [X0, X1, X2, X3];
  }

  /**
   * Serpent S-box S5
   * @param {uint32} a - Word 0
   * @param {uint32} b - Word 1
   * @param {uint32} c - Word 2
   * @param {uint32} d - Word 3
   * @returns {uint32[]} The four output words
   */
  function sbox5(a, b, c, d) {
    const t1 = ~a;
    const t2 = OpCodes.Xor32(a, b);
    const t3 = OpCodes.Xor32(a, d);
    const t4 = OpCodes.Xor32(c, t1);
    const t5 = OpCodes.Or32(t2, t3);
    const X0 = OpCodes.Xor32(t4, t5);
    const t7 = OpCodes.And32(d, X0);
    const t8 = OpCodes.Xor32(t2, X0);
    const X1 = OpCodes.Xor32(t7, t8);
    const t10 = OpCodes.Or32(t1, X0);
    const t11 = OpCodes.Or32(t2, t7);
    const t12 = OpCodes.Xor32(t3, t10);
    const X2 = OpCodes.Xor32(t11, t12);
    const X3 = OpCodes.Xor32(OpCodes.Xor32(b, t7), OpCodes.And32(X1, t12));
    return [X0, X1, X2, X3];
  }

  /**
   * Serpent S-box S6
   * @param {uint32} a - Word 0
   * @param {uint32} b - Word 1
   * @param {uint32} c - Word 2
   * @param {uint32} d - Word 3
   * @returns {uint32[]} The four output words
   */
  function sbox6(a, b, c, d) {
    const t1 = ~a;
    const t2 = OpCodes.Xor32(a, d);
    const t3 = OpCodes.Xor32(b, t2);
    const t4 = OpCodes.Or32(t1, t2);
    const t5 = OpCodes.Xor32(c, t4);
    const X1 = OpCodes.Xor32(b, t5);
    const t7 = OpCodes.Or32(t2, X1);
    const t8 = OpCodes.Xor32(d, t7);
    const t9 = OpCodes.And32(t5, t8);
    const X2 = OpCodes.Xor32(t3, t9);
    const t11 = OpCodes.Xor32(t5, t8);
    const X0 = OpCodes.Xor32(X2, t11);
    const X3 = OpCodes.Xor32(~t5, OpCodes.And32(t3, t11));
    return [X0, X1, X2, X3];
  }

  /**
   * Serpent S-box S7
   * @param {uint32} a - Word 0
   * @param {uint32} b - Word 1
   * @param {uint32} c - Word 2
   * @param {uint32} d - Word 3
   * @returns {uint32[]} The four output words
   */
  function sbox7(a, b, c, d) {
    const t1 = OpCodes.Xor32(b, c);
    const t2 = OpCodes.And32(c, t1);
    const t3 = OpCodes.Xor32(d, t2);
    const t4 = OpCodes.Xor32(a, t3);
    const t5 = OpCodes.Or32(d, t1);
    const t6 = OpCodes.And32(t4, t5);
    const X1 = OpCodes.Xor32(b, t6);
    const t8 = OpCodes.Or32(t3, X1);
    const t9 = OpCodes.And32(a, t4);
    const X3 = OpCodes.Xor32(t1, t9);
    const t11 = OpCodes.Xor32(t4, t8);
    const t12 = OpCodes.And32(X3, t11);
    const X2 = OpCodes.Xor32(t3, t12);
    const X0 = OpCodes.Xor32(~t11, OpCodes.And32(X3, X2));
    return [X0, X1, X2, X3];
  }

  /**
   * Apply forward S-box S<index> to four words
   * @param {int32} index - S-box number 0..7
   * @param {uint32} a - Word 0
   * @param {uint32} b - Word 1
   * @param {uint32} c - Word 2
   * @param {uint32} d - Word 3
   * @returns {uint32[]} The four output words
   */
  function applySbox(index, a, b, c, d) {
    switch (index) {
      case 0: return sbox0(a, b, c, d);
      case 1: return sbox1(a, b, c, d);
      case 2: return sbox2(a, b, c, d);
      case 3: return sbox3(a, b, c, d);
      case 4: return sbox4(a, b, c, d);
      case 5: return sbox5(a, b, c, d);
      case 6: return sbox6(a, b, c, d);
      default: return sbox7(a, b, c, d);
    }
  }

  // Inverse S-boxes InvS0..InvS7.
  /**
   * Serpent S-box InvS0
   * @param {uint32} a - Word 0
   * @param {uint32} b - Word 1
   * @param {uint32} c - Word 2
   * @param {uint32} d - Word 3
   * @returns {uint32[]} The four output words
   */
  function invSbox0(a, b, c, d) {
    const t1 = ~a;
    const t2 = OpCodes.Xor32(a, b);
    const t4 = OpCodes.Xor32(d, OpCodes.Or32(t1, t2));
    const t5 = OpCodes.Xor32(c, t4);
    const X2 = OpCodes.Xor32(t2, t5);
    const t8 = OpCodes.Xor32(t1, OpCodes.And32(d, t2));
    const X1 = OpCodes.Xor32(t4, OpCodes.And32(X2, t8));
    const X3 = OpCodes.Xor32(OpCodes.And32(a, t4), OpCodes.Or32(t5, X1));
    const X0 = OpCodes.Xor32(X3, OpCodes.Xor32(t5, t8));
    return [X0, X1, X2, X3];
  }

  /**
   * Serpent S-box InvS1
   * @param {uint32} a - Word 0
   * @param {uint32} b - Word 1
   * @param {uint32} c - Word 2
   * @param {uint32} d - Word 3
   * @returns {uint32[]} The four output words
   */
  function invSbox1(a, b, c, d) {
    const t1 = OpCodes.Xor32(b, d);
    const t3 = OpCodes.Xor32(a, OpCodes.And32(b, t1));
    const t4 = OpCodes.Xor32(t1, t3);
    const X3 = OpCodes.Xor32(c, t4);
    const t7 = OpCodes.Xor32(b, OpCodes.And32(t1, t3));
    const t8 = OpCodes.Or32(X3, t7);
    const X1 = OpCodes.Xor32(t3, t8);
    const t10 = ~X1;
    const t11 = OpCodes.Xor32(X3, t7);
    const X0 = OpCodes.Xor32(t10, t11);
    const X2 = OpCodes.Xor32(t4, OpCodes.Or32(t10, t11));
    return [X0, X1, X2, X3];
  }

  /**
   * Serpent S-box InvS2
   * @param {uint32} a - Word 0
   * @param {uint32} b - Word 1
   * @param {uint32} c - Word 2
   * @param {uint32} d - Word 3
   * @returns {uint32[]} The four output words
   */
  function invSbox2(a, b, c, d) {
    const t1 = OpCodes.Xor32(b, d);
    const t2 = ~t1;
    const t3 = OpCodes.Xor32(a, c);
    const t4 = OpCodes.Xor32(c, t1);
    const t5 = OpCodes.And32(b, t4);
    const X0 = OpCodes.Xor32(t3, t5);
    const t7 = OpCodes.Or32(a, t2);
    const t8 = OpCodes.Xor32(d, t7);
    const t9 = OpCodes.Or32(t3, t8);
    const X3 = OpCodes.Xor32(t1, t9);
    const t11 = ~t4;
    const t12 = OpCodes.Or32(X0, X3);
    const X1 = OpCodes.Xor32(t11, t12);
    const X2 = OpCodes.Xor32(OpCodes.And32(d, t11), OpCodes.Xor32(t3, t12));
    return [X0, X1, X2, X3];
  }

  /**
   * Serpent S-box InvS3
   * @param {uint32} a - Word 0
   * @param {uint32} b - Word 1
   * @param {uint32} c - Word 2
   * @param {uint32} d - Word 3
   * @returns {uint32[]} The four output words
   */
  function invSbox3(a, b, c, d) {
    const t1 = OpCodes.Or32(a, b);
    const t2 = OpCodes.Xor32(b, c);
    const t3 = OpCodes.And32(b, t2);
    const t4 = OpCodes.Xor32(a, t3);
    const t5 = OpCodes.Xor32(c, t4);
    const t6 = OpCodes.Or32(d, t4);
    const X0 = OpCodes.Xor32(t2, t6);
    const t8 = OpCodes.Or32(t2, t6);
    const t9 = OpCodes.Xor32(d, t8);
    const X2 = OpCodes.Xor32(t5, t9);
    const t11 = OpCodes.Xor32(t1, t9);
    const t12 = OpCodes.And32(X0, t11);
    const X3 = OpCodes.Xor32(t4, t12);
    const X1 = OpCodes.Xor32(X3, OpCodes.Xor32(X0, t11));
    return [X0, X1, X2, X3];
  }

  /**
   * Serpent S-box InvS4
   * @param {uint32} a - Word 0
   * @param {uint32} b - Word 1
   * @param {uint32} c - Word 2
   * @param {uint32} d - Word 3
   * @returns {uint32[]} The four output words
   */
  function invSbox4(a, b, c, d) {
    const t1 = OpCodes.Or32(c, d);
    const t2 = OpCodes.And32(a, t1);
    const t3 = OpCodes.Xor32(b, t2);
    const t4 = OpCodes.And32(a, t3);
    const t5 = OpCodes.Xor32(c, t4);
    const X1 = OpCodes.Xor32(d, t5);
    const t7 = ~a;
    const t8 = OpCodes.And32(t5, X1);
    const X3 = OpCodes.Xor32(t3, t8);
    const t10 = OpCodes.Or32(X1, t7);
    const t11 = OpCodes.Xor32(d, t10);
    const X0 = OpCodes.Xor32(X3, t11);
    const X2 = OpCodes.Xor32(OpCodes.And32(t3, t11), OpCodes.Xor32(X1, t7));
    return [X0, X1, X2, X3];
  }

  /**
   * Serpent S-box InvS5
   * @param {uint32} a - Word 0
   * @param {uint32} b - Word 1
   * @param {uint32} c - Word 2
   * @param {uint32} d - Word 3
   * @returns {uint32[]} The four output words
   */
  function invSbox5(a, b, c, d) {
    const t1 = ~c;
    const t2 = OpCodes.And32(b, t1);
    const t3 = OpCodes.Xor32(d, t2);
    const t4 = OpCodes.And32(a, t3);
    const t5 = OpCodes.Xor32(b, t1);
    const X3 = OpCodes.Xor32(t4, t5);
    const t7 = OpCodes.Or32(b, X3);
    const t8 = OpCodes.And32(a, t7);
    const X1 = OpCodes.Xor32(t3, t8);
    const t10 = OpCodes.Or32(a, d);
    const t11 = OpCodes.Xor32(t1, t7);
    const X0 = OpCodes.Xor32(t10, t11);
    const X2 = OpCodes.Xor32(OpCodes.And32(b, t10), OpCodes.Or32(t4, OpCodes.Xor32(a, c)));
    return [X0, X1, X2, X3];
  }

  /**
   * Serpent S-box InvS6
   * @param {uint32} a - Word 0
   * @param {uint32} b - Word 1
   * @param {uint32} c - Word 2
   * @param {uint32} d - Word 3
   * @returns {uint32[]} The four output words
   */
  function invSbox6(a, b, c, d) {
    const t1 = ~a;
    const t2 = OpCodes.Xor32(a, b);
    const t3 = OpCodes.Xor32(c, t2);
    const t4 = OpCodes.Or32(c, t1);
    const t5 = OpCodes.Xor32(d, t4);
    const X1 = OpCodes.Xor32(t3, t5);
    const t7 = OpCodes.And32(t3, t5);
    const t8 = OpCodes.Xor32(t2, t7);
    const t9 = OpCodes.Or32(b, t8);
    const X3 = OpCodes.Xor32(t5, t9);
    const t11 = OpCodes.Or32(b, X3);
    const X0 = OpCodes.Xor32(t8, t11);
    const X2 = OpCodes.Xor32(OpCodes.And32(d, t1), OpCodes.Xor32(t3, t11));
    return [X0, X1, X2, X3];
  }

  /**
   * Serpent S-box InvS7
   * @param {uint32} a - Word 0
   * @param {uint32} b - Word 1
   * @param {uint32} c - Word 2
   * @param {uint32} d - Word 3
   * @returns {uint32[]} The four output words
   */
  function invSbox7(a, b, c, d) {
    const t3 = OpCodes.Or32(c, OpCodes.And32(a, b));
    const t4 = OpCodes.And32(d, OpCodes.Or32(a, b));
    const X3 = OpCodes.Xor32(t3, t4);
    const t6 = ~d;
    const t7 = OpCodes.Xor32(b, t4);
    const t9 = OpCodes.Or32(t7, OpCodes.Xor32(X3, t6));
    const X1 = OpCodes.Xor32(a, t9);
    const X0 = OpCodes.Xor32(OpCodes.Xor32(c, t7), OpCodes.Or32(d, X1));
    const X2 = OpCodes.Xor32(OpCodes.Xor32(t3, X1), OpCodes.Xor32(X0, OpCodes.And32(a, X3)));
    return [X0, X1, X2, X3];
  }

  /**
   * Apply inverse S-box InvS<index> to four words
   * @param {int32} index - S-box number 0..7
   * @param {uint32} a - Word 0
   * @param {uint32} b - Word 1
   * @param {uint32} c - Word 2
   * @param {uint32} d - Word 3
   * @returns {uint32[]} The four output words
   */
  function applyInvSbox(index, a, b, c, d) {
    switch (index) {
      case 0: return invSbox0(a, b, c, d);
      case 1: return invSbox1(a, b, c, d);
      case 2: return invSbox2(a, b, c, d);
      case 3: return invSbox3(a, b, c, d);
      case 4: return invSbox4(a, b, c, d);
      case 5: return invSbox5(a, b, c, d);
      case 6: return invSbox6(a, b, c, d);
      default: return invSbox7(a, b, c, d);
    }
  }

  class DarkCryptSerpentAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Serpent (DarkCrypt)";
      this.description = "Serpent variant from the DarkCrypt Total Commander plugin: standard 32-round S-box/linear-transform structure, but a non-overlapping flat key-schedule recurrence (unlike the overlapping circular-buffer recurrence used by common reference sources). Fixed 256-bit key, 128-bit block.";
      this.inventor = "Ross Anderson, Eli Biham, Lars Knudsen (base Serpent); DarkCrypt variant by Alexander Myasnikov";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];  // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("Serpent (base algorithm)", "https://www.cl.cam.ac.uk/~rja14/serpent.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard key schedule", "Uses a non-overlapping prekey generation scheme instead of the overlapping circular-buffer recurrence common in reference sources; unanalyzed and not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "NIST AES round-1 Serpent KAT ecb_vk.txt, KEYSIZE=256, I=1 (byte order reversed, the little-endian convention this build uses)",
          uri: "https://web.archive.org/web/20070109105707if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/serpent-vals.zip",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000080"),
          expected: OpCodes.Hex8ToBytes("1908ef821ad2ebc0cb28bf66e796edab")
        },
        {
          text: "DarkCrypt Serpent — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("49672ba898d98df95019180445491089")
        },
        {
          text: "DarkCrypt Serpent — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("de269ff833e432b85b2e88d2701ce75c")
        },
        {
          text: "DarkCrypt Serpent — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("b3691ac95c69060089c450f61fe384b7")
        }
      ];
    }

    /**
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     * @returns {DarkCryptSerpentInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new DarkCryptSerpentInstance(this, isInverse);
    }
  }

  class DarkCryptSerpentInstance extends IBlockCipherInstance {
    /**
     * @param {DarkCryptSerpentAlgorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint32[][]|null} */
      this.roundKeys = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    /**
     * @param {uint8[]|null} keyBytes - Key bytes, or null to clear
     */
    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.roundKeys = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 32)
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. Serpent (DarkCrypt) requires exactly 32 bytes");
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this.roundKeys = this._generateRoundKeys(this._key);
    }

    /**
     * @returns {uint8[]|null} Copy of the key, or null
     */
    get key() { return this._key ? [...this._key] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");
      if (this.inputBuffer.length % this.BlockSize !== 0)
        throw new Error("Input length must be multiple of " + this.BlockSize + " bytes");

      /** @type {uint8[]} */
      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        output.push(...(this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block)));
      }
      this.inputBuffer = [];
      return output;
    }

    // Non-overlapping flat prekey-word generation: w[i] = ROTL(w[i-8]^w[i-5]^w[i-3]^w[i-1]^PHI^i, 11)
    // for i = 0..131, seeded with the 8 key words w[-8..-1]. Round key K_i is derived from the
    // non-overlapping quad w[4i..4i+3] via S-boxes cycling S3,S2,S1,S0,S7,S6,S5,S4.
    /**
     * @param {uint8[]} keyBytes - Key bytes
     * @returns {uint32[][]} The 33 round keys
     */
    _generateRoundKeys(keyBytes) {
      const NUM_PREKEY_WORDS = 4 * (ROUNDS + 1); // 132
      /** @type {uint32[]} */
      const w = new Array(8 + NUM_PREKEY_WORDS);
      w.fill(0);

      for (let i = 0; i < 8; ++i) {
        w[i] = OpCodes.Pack32LE(keyBytes[i * 4], keyBytes[i * 4 + 1], keyBytes[i * 4 + 2], keyBytes[i * 4 + 3]);
      }

      for (let i = 8; i < w.length; ++i) {
        const gen = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(w[i - 8], w[i - 5]), w[i - 3]), w[i - 1]), PHI);
        w[i] = OpCodes.RotL32(OpCodes.Xor32(gen, (i - 8)), 11);
      }

      /** @type {uint32[][]} */
      const subkeyWords = [];
      for (let i = 0; i <= ROUNDS; ++i) {
        const o = 8 + 4 * i;
        const sboxIndex = ((3 - (i % 4)) + (Math.floor(i / 4) % 2) * 4) % 8;
        subkeyWords.push(applySbox(sboxIndex, w[o], w[o + 1], w[o + 2], w[o + 3]));
      }
      return subkeyWords;
    }

    /**
     * Serpent linear transformation
     * @param {uint32} X0 - Word 0
     * @param {uint32} X1 - Word 1
     * @param {uint32} X2 - Word 2
     * @param {uint32} X3 - Word 3
     * @returns {uint32[]} The four output words
     */
    _linearTransform(X0, X1, X2, X3) {
      const x0 = OpCodes.RotL32(X0, 13);
      const x2 = OpCodes.RotL32(X2, 3);
      const x1 = OpCodes.Xor32(OpCodes.Xor32(X1, x0), x2);
      const x3 = OpCodes.Xor32(OpCodes.Xor32(X3, x2), OpCodes.Shl32(x0, 3));
      const nX1 = OpCodes.RotL32(x1, 1);
      const nX3 = OpCodes.RotL32(x3, 7);
      const nX0 = OpCodes.RotL32(OpCodes.Xor32(OpCodes.Xor32(x0, nX1), nX3), 5);
      const nX2 = OpCodes.RotL32(OpCodes.Xor32(OpCodes.Xor32(x2, nX3), OpCodes.Shl32(nX1, 7)), 22);
      return [nX0, nX1, nX2, nX3];
    }

    /**
     * Inverse Serpent linear transformation
     * @param {uint32} X0 - Word 0
     * @param {uint32} X1 - Word 1
     * @param {uint32} X2 - Word 2
     * @param {uint32} X3 - Word 3
     * @returns {uint32[]} The four output words
     */
    _inverseLinearTransform(X0, X1, X2, X3) {
      const x2 = OpCodes.Xor32(OpCodes.Xor32(OpCodes.RotR32(X2, 22), X3), OpCodes.Shl32(X1, 7));
      const x0 = OpCodes.Xor32(OpCodes.Xor32(OpCodes.RotR32(X0, 5), X1), X3);
      const x3 = OpCodes.RotR32(X3, 7);
      const x1 = OpCodes.RotR32(X1, 1);
      const nX3 = OpCodes.Xor32(OpCodes.Xor32(x3, x2), OpCodes.Shl32(x0, 3));
      const nX1 = OpCodes.Xor32(OpCodes.Xor32(x1, x0), x2);
      const nX2 = OpCodes.RotR32(x2, 3);
      const nX0 = OpCodes.RotR32(x0, 13);
      return [nX0, nX1, nX2, nX3];
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _encryptBlock(block) {
      let X0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let X1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      let X2 = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
      let X3 = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);

      for (let round = 0; round < ROUNDS; ++round) {
        X0 = OpCodes.Xor32(X0, this.roundKeys[round][0]);
        X1 = OpCodes.Xor32(X1, this.roundKeys[round][1]);
        X2 = OpCodes.Xor32(X2, this.roundKeys[round][2]);
        X3 = OpCodes.Xor32(X3, this.roundKeys[round][3]);

        [X0, X1, X2, X3] = applySbox(round % 8, X0, X1, X2, X3);

        if (round < ROUNDS - 1) {
          [X0, X1, X2, X3] = this._linearTransform(X0, X1, X2, X3);
        }
      }

      X0 = OpCodes.Xor32(X0, this.roundKeys[ROUNDS][0]);
      X1 = OpCodes.Xor32(X1, this.roundKeys[ROUNDS][1]);
      X2 = OpCodes.Xor32(X2, this.roundKeys[ROUNDS][2]);
      X3 = OpCodes.Xor32(X3, this.roundKeys[ROUNDS][3]);

      return [...OpCodes.Unpack32LE(X0), ...OpCodes.Unpack32LE(X1), ...OpCodes.Unpack32LE(X2), ...OpCodes.Unpack32LE(X3)];
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _decryptBlock(block) {
      let X0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let X1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      let X2 = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
      let X3 = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);

      X0 = OpCodes.Xor32(X0, this.roundKeys[ROUNDS][0]);
      X1 = OpCodes.Xor32(X1, this.roundKeys[ROUNDS][1]);
      X2 = OpCodes.Xor32(X2, this.roundKeys[ROUNDS][2]);
      X3 = OpCodes.Xor32(X3, this.roundKeys[ROUNDS][3]);

      for (let round = ROUNDS - 1; round >= 0; --round) {
        if (round < ROUNDS - 1) {
          [X0, X1, X2, X3] = this._inverseLinearTransform(X0, X1, X2, X3);
        }

        [X0, X1, X2, X3] = applyInvSbox(round % 8, X0, X1, X2, X3);

        X0 = OpCodes.Xor32(X0, this.roundKeys[round][0]);
        X1 = OpCodes.Xor32(X1, this.roundKeys[round][1]);
        X2 = OpCodes.Xor32(X2, this.roundKeys[round][2]);
        X3 = OpCodes.Xor32(X3, this.roundKeys[round][3]);
      }

      return [...OpCodes.Unpack32LE(X0), ...OpCodes.Unpack32LE(X1), ...OpCodes.Unpack32LE(X2), ...OpCodes.Unpack32LE(X3)];
    }
  }

  const algorithmInstance = new DarkCryptSerpentAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptSerpentAlgorithm, DarkCryptSerpentInstance };
}));
