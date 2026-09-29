/*
 * Hierocrypt-3 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Hierocrypt-3, a 128-bit block cipher designed by Toshiba Corporation and
 * submitted to the NESSIE project, as implemented in the DarkCrypt Total
 * Commander plugin (Alexander Myasnikov, "Zarya" project). This DarkCrypt
 * build fixes the key size at 256 bits (8 rounds, turning point tturn=5).
 *
 * Hierocrypt-3 uses a nested SPN structure: an 8-bit lower-level S-box (s),
 * a lower-level MDS diffusion (mdsL, GF(2^8) 4x4 circulant matrix), and a
 * higher-level MDS diffusion (MDSH, a GF(2^4) 4x4 circulant matrix applied
 * across 4-byte lanes). The key schedule is a round-trip Feistel-like network
 * (Lambda / Lambda^-1) seeded from binary expansions of small-integer square
 * roots.
 *
 * This implementation was derived directly from Toshiba's official
 * specification (cryptrec.go.jp PDF, "Specification on a Block Cipher:
 * Hierocrypt-3", May 2002) and cross-validated against the DarkCrypt
 * implementation: the S-box, mdsL/mdsL^-1 matrices, the forward/inverse
 * MDSH nibble matrices and the H0..H3 round constants all match the
 * specification exactly. Test vectors were verified against the DarkCrypt
 * implementation.
 * Educational only.
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

  // s-function lower-level S-box (spec section 3.3.4)
  /** @type {uint8[]} */
  const SBOX = [
    0x07,0xFC,0x55,0x70,0x98,0x8E,0x84,0x4E,0xBC,0x75,0xCE,0x18,0x02,0xE9,0x5D,0x80,
    0x1C,0x60,0x78,0x42,0x9D,0x2E,0xF5,0xE8,0xC6,0x7A,0x2F,0xA4,0xB2,0x5F,0x19,0x87,
    0x0B,0x9B,0x9C,0xD3,0xC3,0x77,0x3D,0x6F,0xB9,0x2D,0x4D,0xF7,0x8C,0xA7,0xAC,0x17,
    0x3C,0x5A,0x41,0xC9,0x29,0xED,0xDE,0x27,0x69,0x30,0x72,0xA8,0x95,0x3E,0xF9,0xD8,
    0x21,0x8B,0x44,0xD7,0x11,0x0D,0x48,0xFD,0x6A,0x01,0x57,0xE5,0xBD,0x85,0xEC,0x1E,
    0x37,0x9F,0xB5,0x9A,0x7C,0x09,0xF1,0xB1,0x94,0x81,0x82,0x08,0xFB,0xC0,0x51,0x0F,
    0x61,0x7F,0x1A,0x56,0x96,0x13,0xC1,0x67,0x99,0x03,0x5E,0xB6,0xCA,0xFA,0x9E,0xDF,
    0xD6,0x83,0xCC,0xA2,0x12,0x23,0xB7,0x65,0xD0,0x39,0x7D,0x3B,0xD5,0xB0,0xAF,0x1F,
    0x06,0xC8,0x34,0xC5,0x1B,0x79,0x4B,0x66,0xBF,0x88,0x4A,0xC4,0xEF,0x58,0x3F,0x0A,
    0x2C,0x73,0xD1,0xF8,0x6B,0xE6,0x20,0xB8,0x22,0x43,0xB3,0x33,0xE7,0xF0,0x71,0x7E,
    0x52,0x89,0x47,0x63,0x0E,0x6D,0xE3,0xBE,0x59,0x64,0xEE,0xF6,0x38,0x5C,0xF4,0x5B,
    0x49,0xD4,0xE0,0xF3,0xBB,0x54,0x26,0x2B,0x00,0x86,0x90,0xFF,0xFE,0xA6,0x7B,0x05,
    0xAD,0x68,0xA1,0x10,0xEB,0xC7,0xE2,0xF2,0x46,0x8A,0x6C,0x14,0x6E,0xCF,0x35,0x45,
    0x50,0xD2,0x92,0x74,0x93,0xE1,0xDA,0xAE,0xA9,0x53,0xE4,0x40,0xCD,0xBA,0x97,0xA3,
    0x91,0x31,0x25,0x76,0x36,0x32,0x28,0x3A,0x24,0x4C,0xDB,0xD9,0x8D,0xDC,0x62,0x2A,
    0xEA,0x15,0xDD,0xC2,0xA5,0x0C,0x04,0x1D,0x8F,0xCB,0xB4,0x4F,0x16,0xAB,0xAA,0xA0
  ];
  Object.freeze(SBOX);
  /**
   * @returns {uint8[]} Inverse of SBOX
   */
  function buildInverseSbox() {
    /** @type {uint8[]} */
    const inv = new Array(256);
    for (let i = 0; i < 256; i++) inv[SBOX[i]] = i;
    return inv;
  }
  /** @type {uint8[]} */
  const SBOX_INV = buildInverseSbox();
  Object.freeze(SBOX_INV);

  // GF(2^8) multiplication modulo p(z) = z^8 + z^6 + z^5 + z + 1 (0x163), used by mdsL/mdsL^-1.
  /**
   * @param {uint32} a - First factor (low byte used)
   * @param {uint32} b - Second factor (low byte used)
   * @returns {uint32} Product byte
   */
  function gfMul(a, b) {
    /** @type {uint32} */
    let acc = 0;
    let x = OpCodes.And32(a, 0xff), y = OpCodes.And32(b, 0xff);
    while (y) {
      if (OpCodes.And32(y, 1)) acc = OpCodes.Xor32(acc, x);
      y = OpCodes.Shr32(y, 1);
      x = OpCodes.Shl32(x, 1);
      if (OpCodes.And32(x, 0x100)) x = OpCodes.Xor32(x, 0x163);
    }
    return OpCodes.And32(acc, 0xff);
  }

  /** @type {uint8[]} */
  const MDSL_FWD = [0xC4, 0x65, 0xC8, 0x8B]; // circulant row (spec 3.3.6)
  /** @type {uint8[]} */
  const MDSL_INV = [0x82, 0xC4, 0x34, 0xF6]; // circulant row, inverse

  /**
   * @param {uint8[]} X - Four bytes
   * @param {uint8[]} matrixRow - Circulant matrix row
   * @returns {uint8[]} Four bytes
   */
  function mdsLWord(X, matrixRow) {
    /** @type {uint8[]} */
    const Y = [0, 0, 0, 0];
    for (let r = 0; r < 4; r++) {
      /** @type {uint32} */
      let acc = 0;
      for (let c = 0; c < 4; c++) acc = OpCodes.Xor32(acc, gfMul(X[c], matrixRow[(c - r + 4) % 4]));
      Y[r] = acc;
    }
    return Y;
  }

  /**
   * @param {uint8[]} X16 - 16 bytes
   * @param {uint8[]} matrixRow - Circulant matrix row
   * @returns {uint8[]} 16 bytes
   */
  function MDSL(X16, matrixRow) {
    /** @type {uint8[]} */
    const Y = new Array(16);
    for (let w = 0; w < 4; w++) {
      const y = mdsLWord(X16.slice(w * 4, w * 4 + 4), matrixRow);
      for (let i = 0; i < 4; i++) Y[w * 4 + i] = y[i];
    }
    return Y;
  }

  // GF(2^4) "row op": applies the companion-matrix decomposition of multiply-by-nibble c
  // to a 4-byte lane.
  /**
   * @param {uint8[]} X - Four bytes
   * @param {uint32} c - Nibble multiplier
   * @returns {uint8[]} Four bytes
   */
  function gf16RowOp(X, c) {
    /** @type {uint8[]} */
    const Y = [0, 0, 0, 0];
    if (OpCodes.And32(c, 1)) { Y[0] = OpCodes.Xor32(Y[0], X[0]); Y[1] = OpCodes.Xor32(Y[1], X[1]); Y[2] = OpCodes.Xor32(Y[2], X[2]); Y[3] = OpCodes.Xor32(Y[3], X[3]); }
    if (OpCodes.And32(c, 2)) { Y[0] = OpCodes.Xor32(Y[0], X[1]); Y[1] = OpCodes.Xor32(Y[1], X[2]); Y[2] = OpCodes.Xor32(Y[2], OpCodes.Xor32(X[3], X[0])); Y[3] = OpCodes.Xor32(Y[3], X[0]); }
    if (OpCodes.And32(c, 4)) { Y[0] = OpCodes.Xor32(Y[0], X[2]); Y[1] = OpCodes.Xor32(Y[1], OpCodes.Xor32(X[3], X[0])); Y[2] = OpCodes.Xor32(Y[2], OpCodes.Xor32(X[0], X[1])); Y[3] = OpCodes.Xor32(Y[3], X[1]); }
    if (OpCodes.And32(c, 8)) { Y[0] = OpCodes.Xor32(Y[0], OpCodes.Xor32(X[0], X[3])); Y[1] = OpCodes.Xor32(Y[1], OpCodes.Xor32(X[1], X[0])); Y[2] = OpCodes.Xor32(Y[2], OpCodes.Xor32(X[2], X[1])); Y[3] = OpCodes.Xor32(Y[3], X[2]); }
    return Y;
  }

  // Higher-level MDS diffusion, forward and inverse nibble matrices (spec 2.2.3).
  /** @type {uint8[]} */
  const MDSH_FWD = [5, 5, 10, 14,  14, 5, 5, 10,  10, 14, 5, 5,  5, 10, 14, 5];
  /** @type {uint8[]} */
  const MDSH_INV = [11, 14, 14, 6,  6, 11, 14, 14,  14, 6, 11, 14,  14, 14, 6, 11];

  /**
   * @param {uint8[]} X16 - 16 bytes
   * @param {uint8[]} matrix - 4x4 nibble matrix
   * @returns {uint8[]} 16 bytes
   */
  function MDSH(X16, matrix) {
    /** @type {uint8[]} */
    const Y = new Array(16);
    Y.fill(0);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const coeff = matrix[row * 4 + col];
        const lane = X16.slice(col * 4, col * 4 + 4);
        const t = gf16RowOp(lane, coeff);
        for (let i = 0; i < 4; i++) Y[row * 4 + i] = OpCodes.Xor32(Y[row * 4 + i], t[i]);
      }
    }
    return Y;
  }

  /**
   * @param {uint8[]} X - Bytes
   * @returns {uint8[]} Each byte through SBOX
   */
  function Sfn(X) {
    /** @type {uint8[]} */
    const Y = [];
    for (let i = 0; i < X.length; i++) Y.push(SBOX[X[i]]);
    return Y;
  }
  /**
   * @param {uint8[]} X - Bytes
   * @returns {uint8[]} Each byte through SBOX_INV
   */
  function SfnInv(X) {
    /** @type {uint8[]} */
    const Y = [];
    for (let i = 0; i < X.length; i++) Y.push(SBOX_INV[X[i]]);
    return Y;
  }
  /**
   * @param {uint8[]} a - Bytes
   * @param {uint8[]} b - Bytes (at least as many as a)
   * @returns {uint8[]} a xor b, a.length bytes
   */
  function xorArr(a, b) {
    /** @type {uint8[]} */
    const Y = [];
    for (let i = 0; i < a.length; i++) Y.push(OpCodes.Xor32(a[i], b[i]));
    return Y;
  }

  /**
   * @param {uint8[]} X16 - 16 bytes
   * @param {uint8[]} K1_16 - First 16 key bytes
   * @param {uint8[]} K2_16 - Second 16 key bytes
   * @returns {uint8[]} 16 bytes
   */
  function XS(X16, K1_16, K2_16) {
    const t1 = Sfn(xorArr(X16, K1_16));
    const t2 = MDSL(t1, MDSL_FWD);
    const t3 = xorArr(t2, K2_16);
    return Sfn(t3);
  }
  /**
   * @param {uint8[]} Y16 - 16 bytes
   * @param {uint8[]} K1_16 - First 16 key bytes
   * @param {uint8[]} K2_16 - Second 16 key bytes
   * @returns {uint8[]} 16 bytes
   */
  function XSInv(Y16, K1_16, K2_16) {
    const t3 = SfnInv(Y16);
    const t2 = xorArr(t3, K2_16);
    const t1 = MDSL(t2, MDSL_INV);
    return xorArr(SfnInv(t1), K1_16);
  }

  /**
   * @param {uint8[]} X16 - 16 bytes
   * @param {uint8[]} K32 - 32-byte round key
   * @returns {uint8[]} 16 bytes
   */
  function rho(X16, K32) {
    return MDSH(XS(X16, K32.slice(0, 16), K32.slice(16, 32)), MDSH_FWD);
  }
  /**
   * @param {uint8[]} Y16 - 16 bytes
   * @param {uint8[]} K32 - 32-byte round key
   * @returns {uint8[]} 16 bytes
   */
  function rhoInv(Y16, K32) {
    const t = MDSH(Y16, MDSH_INV);
    return XSInv(t, K32.slice(0, 16), K32.slice(16, 32));
  }

  // ===== Key scheduling part (spec section 3.2.3-3.2.7) =====

  /** @type {uint32[]} */
  const H = [0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xCA62C1D6]; // binary expansions of small-int square roots
  /**
   * @param {uint32} v - Word
   * @returns {uint8[]} Big-endian bytes
   */
  function u32bytes(v) {
    /** @type {uint8[]} */
    const bytes = [OpCodes.And32(OpCodes.Shr32(v, 24), 0xff), OpCodes.And32(OpCodes.Shr32(v, 16), 0xff), OpCodes.And32(OpCodes.Shr32(v, 8), 0xff), OpCodes.And32(v, 0xff)];
    return bytes;
  }
  /**
   * @param {int32} i - Constant selector 0..5
   * @returns {uint8[]} 8 constant bytes
   */
  function G0(i) {
    switch (i) {
      case 0: return [...u32bytes(H[3]), ...u32bytes(H[0])];
      case 1: return [...u32bytes(H[2]), ...u32bytes(H[1])];
      case 2: return [...u32bytes(H[1]), ...u32bytes(H[3])];
      case 3: return [...u32bytes(H[0]), ...u32bytes(H[2])];
      case 4: return [...u32bytes(H[2]), ...u32bytes(H[3])];
      default: return [...u32bytes(H[1]), ...u32bytes(H[0])]; // 5 (the only other selector used)
    }
  }

  // M5E-function (spec 3.3.9): 8-byte input, two independent 4x4 bit matrices per 32-bit half.
  /**
   * @param {uint8[]} x - 8 bytes
   * @returns {uint8[]} 8 bytes
   */
  function M5E(x) {
    /** @type {uint8[]} */
    const y = [
      OpCodes.Xor32(x[0], x[2]),
      OpCodes.Xor32(OpCodes.Xor32(x[0], x[1]), x[3]),
      OpCodes.Xor32(OpCodes.Xor32(x[0], x[1]), x[2]),
      OpCodes.Xor32(x[1], x[3]),
      OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(x[4], x[5]), x[6]), x[7]),
      OpCodes.Xor32(OpCodes.Xor32(x[5], x[6]), x[7]),
      OpCodes.Xor32(x[6], x[7]),
      OpCodes.Xor32(OpCodes.Xor32(x[4], x[5]), x[6])
    ];
    return y;
  }
  // MB3-function (spec 3.3.10)
  /**
   * @param {uint8[]} x - 8 bytes
   * @returns {uint8[]} 8 bytes
   */
  function MB3(x) {
    /** @type {uint8[]} */
    const y = [
      OpCodes.Xor32(x[1], x[3]),
      OpCodes.Xor32(x[0], x[2]),
      OpCodes.Xor32(OpCodes.Xor32(x[0], x[1]), x[3]),
      OpCodes.Xor32(OpCodes.Xor32(x[0], x[2]), x[3]),
      OpCodes.Xor32(x[4], x[5]),
      OpCodes.Xor32(x[5], x[6]),
      OpCodes.Xor32(OpCodes.Xor32(x[4], x[6]), x[7]),
      OpCodes.Xor32(x[4], x[7])
    ];
    return y;
  }

  // P(n)-function (spec 3.3.8): linear transform over 4 equal-size groups.
  /**
   * @param {uint8[][]} groups - Four equal-size byte groups
   * @returns {uint8[][]} Four groups
   */
  function Pn(groups) {
    const g1 = groups[0], g2 = groups[1], g3 = groups[2], g4 = groups[3];
    /** @type {uint8[][]} */
    const out = [
      xorArr(g1, g3),
      xorArr(g2, g4),
      xorArr(xorArr(g2, g3), g4),
      xorArr(xorArr(g1, g3), g4)
    ];
    return out;
  }
  /**
   * @param {uint8[][]} groups - Four equal-size byte groups
   * @returns {uint8[][]} Four groups
   */
  function PnInv(groups) {
    const g1 = groups[0], g2 = groups[1], g3 = groups[2], g4 = groups[3];
    /** @type {uint8[][]} */
    const out = [
      xorArr(xorArr(g1, g2), g3),
      xorArr(xorArr(g1, g2), g4),
      xorArr(g2, g3),
      xorArr(g1, g4)
    ];
    return out;
  }

  // F-function (spec 3.3.11): S-box per byte, then P(16) over four 16-bit groups.
  /**
   * @param {uint8[]} X8 - 8 bytes
   * @returns {uint8[]} 8 bytes
   */
  function Ffn(X8) {
    const s = Sfn(X8);
    /** @type {uint8[][]} */
    const groups = [s.slice(0, 2), s.slice(2, 4), s.slice(4, 6), s.slice(6, 8)];
    const out = Pn(groups);
    return [...out[0], ...out[1], ...out[2], ...out[3]];
  }

  // P(32): combines Z3(64)||Z4(64) into W1(64)||W2(64) (four 32-bit groups).
  /**
   * @param {uint8[]} Z3_8 - 8 bytes
   * @param {uint8[]} Z4_8 - 8 bytes
   * @returns {uint8[][]} [W1, W2], 8 bytes each
   */
  function P32(Z3_8, Z4_8) {
    /** @type {uint8[][]} */
    const groups = [Z3_8.slice(0, 4), Z3_8.slice(4, 8), Z4_8.slice(0, 4), Z4_8.slice(4, 8)];
    const out = Pn(groups);
    /** @type {uint8[][]} */
    const halves = [[...out[0], ...out[1]], [...out[2], ...out[3]]];
    return halves;
  }
  /**
   * @param {uint8[]} W1_8 - 8 bytes
   * @param {uint8[]} W2_8 - 8 bytes
   * @returns {uint8[][]} [Z3, Z4], 8 bytes each
   */
  function P32Inv(W1_8, W2_8) {
    /** @type {uint8[][]} */
    const groups = [W1_8.slice(0, 4), W1_8.slice(4, 8), W2_8.slice(0, 4), W2_8.slice(4, 8)];
    const out = PnInv(groups);
    /** @type {uint8[][]} */
    const halves = [[...out[0], ...out[1]], [...out[2], ...out[3]]];
    return halves;
  }

  // Key schedule for the fixed 256-bit key configuration (T=8 rounds, tturn=5).
  /**
   * @param {uint8[]} key32 - 32 key bytes
   * @returns {uint8[][]} Round keys K[1..9] (index 0 unused), 32 bytes each
   */
  function keySchedule256(key32) {
    const Z1 = key32.slice(0, 8), Z2 = key32.slice(8, 16), Z3 = key32.slice(16, 24), Z4 = key32.slice(24, 32);
    const tturn = 5, T = 8;

    /** @type {uint8[][]} */
    const Gc = [G0(5), G0(4), G0(0), G0(2), G0(1), G0(3), G0(3), G0(1), G0(2), G0(0)];

    // Pre-whitening (Lambda-0-function, spec 3.2.5)
    const Z3_0 = xorArr(M5E(Z3), Gc[0]);
    const Z4_0 = M5E(Z4);
    const Z1_0 = Z2;
    const Z2_0 = xorArr(Z1, Ffn(xorArr(Z2, Z3_0)));

    // Z[t + 1] holds the state after step t (t = -1 .. T+1)
    /** @type {uint8[][][]} */
    const Z = new Array(T + 3);
    /** @type {uint8[][]} */
    const zInitial = [Z1, Z2, Z3, Z4];
    /** @type {uint8[][]} */
    const zWhitened = [Z1_0, Z2_0, Z3_0, Z4_0];
    Z[0] = zInitial;
    Z[1] = zWhitened;

    // Plaintext side (Lambda-function, spec 3.2.6), t = 1..tturn
    for (let t = 1; t <= tturn; t++) {
      const prev = Z[t];
      const w = P32(prev[2], prev[3]);
      const Z3t = xorArr(M5E(w[0]), Gc[t]);
      const Z4t = M5E(w[1]);
      const Z1t = prev[1];
      const Z2t = xorArr(prev[0], Ffn(xorArr(prev[1], Z3t)));
      /** @type {uint8[][]} */
      const zNext = [Z1t, Z2t, Z3t, Z4t];
      Z[t + 1] = zNext;
    }

    // Ciphertext side (Lambda^-1-function, spec 3.2.6), t = tturn+1..T+1
    /** @type {uint8[][][]} */
    const W = new Array(T + 2);
    for (let t = tturn + 1; t <= T + 1; t++) {
      const prev = Z[t];
      const Z1t = xorArr(prev[1], Ffn(xorArr(prev[0], prev[2])));
      const Z2t = prev[0];
      const W1t = MB3(xorArr(prev[2], Gc[t]));
      const W2t = MB3(prev[3]);
      const z34 = P32Inv(W1t, W2t);
      /** @type {uint8[][]} */
      const zNext = [Z1t, Z2t, z34[0], z34[1]];
      Z[t + 1] = zNext;
      /** @type {uint8[][]} */
      const wPair = [W1t, W2t];
      W[t] = wPair;
    }

    // Round key generation (spec 3.2.7)
    /** @type {uint8[][]} */
    const K = new Array(T + 2);
    for (let t = 1; t <= tturn; t++) {
      const prev = Z[t], cur = Z[t + 1];
      const V = Ffn(xorArr(prev[1], cur[2]));
      const K1 = xorArr(prev[0], V);
      const K2 = xorArr(cur[2], V);
      const K3 = xorArr(cur[3], V);
      const K4 = xorArr(prev[1], cur[3]);
      K[t] = [...K1, ...K2, ...K3, ...K4];
    }
    for (let t = tturn + 1; t <= T + 1; t++) {
      const prev = Z[t], cur = Z[t + 1];
      const V = Ffn(xorArr(prev[0], prev[2]));
      const K1 = xorArr(cur[0], prev[2]);
      const K2 = xorArr(W[t][0], V);
      const K3 = xorArr(W[t][1], V);
      const K4 = xorArr(prev[0], W[t][1]);
      K[t] = [...K1, ...K2, ...K3, ...K4];
    }
    return K; // K[1..9], each 32 bytes (256 bits)
  }

  class DarkCryptHierocrypt3Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Hierocrypt-3 (DarkCrypt)";
      this.description = "Hierocrypt-3, Toshiba's NESSIE-submission nested-SPN block cipher, fixed to a 256-bit key (8 rounds, turning point 5) as used by the DarkCrypt Total Commander plugin. 128-bit block. Validated against Toshiba's official specification.";
      this.inventor = "Toshiba Corporation; DarkCrypt integration by Alexander Myasnikov";
      this.year = 2000;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.JP;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];  // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("Toshiba Specification on a Block Cipher: Hierocrypt-3", "https://www.cryptrec.go.jp/en/cryptrec_03_spec_cypherlist_files/PDF/08_02espec.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Not selected by NESSIE", "Hierocrypt-3 was submitted to NESSIE but not selected for the final portfolio; cryptanalysis is comparatively limited.", "Use AES or another vetted, widely analyzed cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "Toshiba Hierocrypt-3 specification test data, 256-bit key",
          uri: "https://www.cryptrec.go.jp/en/cryptrec_03_spec_cypherlist_files/PDF/08_02espec.pdf",
          input: OpCodes.Hex8ToBytes("c16d7efca1cbafc7625cbe9c2593de2d"),
          key: OpCodes.Hex8ToBytes("11a180269a78dda4994746213b5a6dd6e34ffe0cc465d583aff66e1329419c94"),
          expected: OpCodes.Hex8ToBytes("c86cd3b4a3185232e3457d638c6515c9")
        },
        {
          text: "DarkCrypt Hierocrypt-3 — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("a509d3d04066cd974d72135b0b44f64c")
        },
        {
          text: "DarkCrypt Hierocrypt-3 — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("b1921a8d0f1a281b0f7660064c586279")
        },
        {
          text: "DarkCrypt Hierocrypt-3 — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("e220dfc4b0b3e8464b518f9cb48038f2")
        }
      ];
    }

    /**
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     * @returns {DarkCryptHierocrypt3Instance} New instance
     */
    CreateInstance(isInverse = false) {
      return new DarkCryptHierocrypt3Instance(this, isInverse);
    }
  }

  class DarkCryptHierocrypt3Instance extends IBlockCipherInstance {
    /**
     * @param {DarkCryptHierocrypt3Algorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[][]|null} */
      this._roundKeys = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    /**
     * @param {uint8[]|null} keyBytes - Key bytes, or null to clear
     */
    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._roundKeys = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 32)
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. Hierocrypt-3 (DarkCrypt) requires exactly 32 bytes");

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._roundKeys = keySchedule256(this._key);
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

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _encryptBlock(block) {
      const K = this._roundKeys;
      let X = block.slice();
      for (let t = 1; t <= 7; t++) X = rho(X, K[t]);
      X = XS(X, K[8].slice(0, 16), K[8].slice(16, 32));
      return xorArr(X, K[9].slice(0, 16));
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _decryptBlock(block) {
      const K = this._roundKeys;
      let X = xorArr(block, K[9].slice(0, 16));
      X = XSInv(X, K[8].slice(0, 16), K[8].slice(16, 32));
      for (let t = 7; t >= 1; t--) X = rhoInv(X, K[t]);
      return X;
    }
  }

  const algorithmInstance = new DarkCryptHierocrypt3Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptHierocrypt3Algorithm, DarkCryptHierocrypt3Instance };
}));
