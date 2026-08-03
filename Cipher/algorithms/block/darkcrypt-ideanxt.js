/*
 * IDEA-NXT / FOX128 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * IDEA NXT, originally named FOX, is a block cipher family designed by
 * Pascal Junod and Serge Vaudenay (EPFL) for MediaCrypt AG. This module
 * implements the FOX128/256/32 member of the family (128-bit block,
 * 256-bit key, 32 rounds) as used by the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project) -- the generic FOX128/256
 * configuration uses 16 rounds, but this build uses 32.
 *
 * The cipher is built on an Extended Lai-Massey scheme: each round splits
 * the 128-bit state into four 32-bit words, combines them through a
 * substitution-permutation round function f64 (sigma8 substitution, mu8
 * MDS diffusion over GF(2^8), and round-key addition), and applies an
 * orthomorphism to two of the four output words. The key schedule derives
 * 32 round keys from the 256-bit key using a 24-bit LFSR (D-part) followed
 * by a non-linear mixing stage (NL128) built from the very same f64-like
 * primitives.
 *
 * Structure and constants (S-box, mu8 matrix, LFSR polynomial, pad
 * constant, key-schedule algorithm) were reconstructed from:
 *   - P. Junod, S. Vaudenay, "FOX: a New Family of Block Ciphers",
 *     Selected Areas in Cryptography 2004 (includes S-box table and
 *     mu4/mu8 matrices in Appendix B).
 *   - O. Gay's public-domain reference implementation of IDEA NXT
 *     (nxt128.c/nxt_common.c, 2006), used to resolve byte-ordering and
 *     wiring details left ambiguous by the academic paper's figures.
 *   - Cross-validation against the DarkCrypt implementation, which confirmed
 *     the S-box and mu8 constants but also exposed two deviations from the
 *     published FOX128/256 defaults: it runs 32 rounds instead of the
 *     generic 16 (the LFSR reseed value 0x00B51062 only reproduces from
 *     the seed formula with r=32), and the key schedule's "pad" constant
 *     behaves as an all-zero pad rather than the SAC 2004 paper's e-2
 *     based constant.
 * Test vectors were verified against the DarkCrypt implementation.
 * 128-bit blocks, 256-bit keys. Educational only.
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

  // This implementation uses 32 rounds, not the generic FOX128 default of 16 (confirmed
  // via the LFSR reseed constant 0x00B51062, which only reproduces with r=32).
  const ROUNDS = 32;
  const KEY_BYTES = 32;
  const BLOCK_BYTES = 16;
  const IRRED_POLY_LOW = 0xF9;        // x^8+x^7+x^6+x^5+x^4+x^3+1, low byte of 0x1F9
  const IRRED_POLY_FULL = 0x1F9;
  const LFSR_POLY = 0x100001b;        // x^24+x^4+x^3+x+1

  // sbox: FOX/IDEA-NXT non-linear byte permutation (Lai-Massey of S1/S2/S3), from Appendix B of the SAC 2004 paper.
  const SBOX = [
    0x5d,0xde,0x00,0xb7,0xd3,0xca,0x3c,0x0d,0xc3,0xf8,0xcb,0x8d,0x76,0x89,0xaa,0x12,
    0x88,0x22,0x4f,0xdb,0x6d,0x47,0xe4,0x4c,0x78,0x9a,0x49,0x93,0xc4,0xc0,0x86,0x13,
    0xa9,0x20,0x53,0x1c,0x4e,0xcf,0x35,0x39,0xb4,0xa1,0x54,0x64,0x03,0xc7,0x85,0x5c,
    0x5b,0xcd,0xd8,0x72,0x96,0x42,0xb8,0xe1,0xa2,0x60,0xef,0xbd,0x02,0xaf,0x8c,0x73,
    0x7c,0x7f,0x5e,0xf9,0x65,0xe6,0xeb,0xad,0x5a,0xa5,0x79,0x8e,0x15,0x30,0xec,0xa4,
    0xc2,0x3e,0xe0,0x74,0x51,0xfb,0x2d,0x6e,0x94,0x4d,0x55,0x34,0xae,0x52,0x7e,0x9d,
    0x4a,0xf7,0x80,0xf0,0xd0,0x90,0xa7,0xe8,0x9f,0x50,0xd5,0xd1,0x98,0xcc,0xa0,0x17,
    0xf4,0xb6,0xc1,0x28,0x5f,0x26,0x01,0xab,0x25,0x38,0x82,0x7d,0x48,0xfc,0x1b,0xce,
    0x3f,0x6b,0xe2,0x67,0x66,0x43,0x59,0x19,0x84,0x3d,0xf5,0x2f,0xc9,0xbc,0xd9,0x95,
    0x29,0x41,0xda,0x1a,0xb0,0xe9,0x69,0xd2,0x7b,0xd7,0x11,0x9b,0x33,0x8a,0x23,0x09,
    0xd4,0x71,0x44,0x68,0x6f,0xf2,0x0e,0xdf,0x87,0xdc,0x83,0x18,0x6a,0xee,0x99,0x81,
    0x62,0x36,0x2e,0x7a,0xfe,0x45,0x9c,0x75,0x91,0x0c,0x0f,0xe7,0xf6,0x14,0x63,0x1d,
    0x0b,0x8b,0xb3,0xf3,0xb2,0x3b,0x08,0x4b,0x10,0xa6,0x32,0xb9,0xa8,0x92,0xf1,0x56,
    0xdd,0x21,0xbf,0x04,0xbe,0xd6,0xfd,0x77,0xea,0x3a,0xc8,0x8f,0x57,0x1e,0xfa,0x2b,
    0x58,0xc5,0x27,0xac,0xe3,0xed,0x97,0xbb,0x46,0x05,0x40,0x31,0xe5,0x37,0x2c,0x9e,
    0x0a,0xb1,0xb5,0x06,0x6c,0x1f,0xa3,0x2a,0x70,0xff,0xba,0x07,0x24,0x16,0xc6,0x61
  ];

  // pad: the FOX spec defines this as the first 256 bits of the hex expansion of (e-2).
  // In the DarkCrypt implementation, however, the key schedule's pad buffer is never
  // populated before use and stays all-zero, so this port reproduces that as-built
  // behavior (an all-zero pad) rather than the published constant.
  const PAD = new Array(32).fill(0);

  // GF(2^8) multiplication by alpha (the field generator, represented as 0x02) and its inverse,
  // reducing modulo P(alpha) = alpha^8+alpha^7+alpha^6+alpha^5+alpha^4+alpha^3+1 (0x1F9).
  function mulAlpha(x) {
    const shifted = OpCodes.And32(OpCodes.Shl32(x, 1), 0xFF);
    return OpCodes.And32(x, 0x80) ? OpCodes.Xor32(shifted, IRRED_POLY_LOW) : shifted;
  }

  function divAlpha(x) {
    if (OpCodes.And32(x, 1))
      return OpCodes.And32(OpCodes.Shr32(OpCodes.Xor32(x, IRRED_POLY_FULL), 1), 0xFF);
    return OpCodes.And32(OpCodes.Shr32(x, 1), 0xFF);
  }

  // Multiplication-by-constant helpers for the mu8 (and mu4) MDS matrix elements:
  //   a = alpha+1, b = alpha^-1+alpha^-2, c = alpha, d = alpha^2, e = alpha^-1, f = alpha^-2
  function mulByA(x) { return OpCodes.Xor32(x, mulAlpha(x)); }
  function mulByC(x) { return mulAlpha(x); }
  function mulByD(x) { return mulAlpha(mulAlpha(x)); }
  function mulByE(x) { return divAlpha(x); }
  function mulByF(x) { return divAlpha(divAlpha(x)); }
  function mulByB(x) { return OpCodes.Xor32(mulByE(x), mulByF(x)); }

  // mu8: the (8,8) MDS linear multipermutation used by f64 and the key schedule's NL128 stage.
  function mu8(X) {
    const Y = new Array(8);
    Y[0] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(X[0], X[1]), X[2]), X[3]), X[4]), X[5]), X[6]), mulByA(X[7]));
    Y[1] = OpCodes.Xor32(X[0], OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(mulByA(X[1]), mulByB(X[2])), OpCodes.Xor32(mulByC(X[3]), mulByD(X[4]))), OpCodes.Xor32(OpCodes.Xor32(mulByE(X[5]), mulByF(X[6])), X[7])));
    Y[2] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(mulByA(X[0]), mulByB(X[1])), OpCodes.Xor32(mulByC(X[2]), mulByD(X[3]))), OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(mulByE(X[4]), mulByF(X[5])), X[6]), X[7]));
    Y[3] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(mulByB(X[0]), mulByC(X[1])), OpCodes.Xor32(mulByD(X[2]), mulByE(X[3]))), OpCodes.Xor32(OpCodes.Xor32(mulByF(X[4]), X[5]), OpCodes.Xor32(mulByA(X[6]), X[7])));
    Y[4] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(mulByC(X[0]), mulByD(X[1])), OpCodes.Xor32(mulByE(X[2]), mulByF(X[3]))), X[4]), OpCodes.Xor32(OpCodes.Xor32(mulByA(X[5]), mulByB(X[6])), X[7]));
    Y[5] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(mulByD(X[0]), mulByE(X[1])), OpCodes.Xor32(OpCodes.Xor32(mulByF(X[2]), X[3]), OpCodes.Xor32(mulByA(X[4]), mulByB(X[5])))), OpCodes.Xor32(mulByC(X[6]), X[7]));
    Y[6] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(mulByE(X[0]), mulByF(X[1])), X[2]), OpCodes.Xor32(OpCodes.Xor32(mulByA(X[3]), mulByB(X[4])), OpCodes.Xor32(mulByC(X[5]), mulByD(X[6])))), X[7]);
    Y[7] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(mulByF(X[0]), X[1]), OpCodes.Xor32(mulByA(X[2]), mulByB(X[3]))), OpCodes.Xor32(OpCodes.Xor32(mulByC(X[4]), mulByD(X[5])), OpCodes.Xor32(mulByE(X[6]), X[7])));
    for (let i = 0; i < 8; ++i) Y[i] &= 0xFF;
    return Y;
  }

  // sigma8 (applied per-byte; also used at 32-bit granularity as "SIGMA" in the key schedule).
  function sigmaBytes(bytes) { return bytes.map(b => SBOX[b]); }
  function sigmaWord(word) {
    const b = OpCodes.Unpack32BE(word);
    return OpCodes.Pack32BE(SBOX[b[0]], SBOX[b[1]], SBOX[b[2]], SBOX[b[3]]);
  }

  // mu8(sigma8(x||y)) split into its first and second 32-bit halves (no key mixing).
  function sigmaMu8(x, y) {
    const bytes = OpCodes.Unpack32BE(x).concat(OpCodes.Unpack32BE(y));
    const diffused = mu8(sigmaBytes(bytes));
    return [
      OpCodes.Pack32BE(diffused[0], diffused[1], diffused[2], diffused[3]),
      OpCodes.Pack32BE(diffused[4], diffused[5], diffused[6], diffused[7])
    ];
  }

  // f64(X0,X1, RK) = sigma8(mu8(sigma8(X0||X1 ^ RK0)) ^ RK1) ^ RK0, RK = [RK0a,RK0b,RK1a,RK1b] (four 32-bit words).
  function f64(X0, X1, rk) {
    const t0 = OpCodes.Xor32(X0, rk[0]);
    const t1 = OpCodes.Xor32(X1, rk[1]);
    const [smu0, smu1] = sigmaMu8(t0, t1);

    const rk1Bytes = OpCodes.Unpack32BE(rk[2]).concat(OpCodes.Unpack32BE(rk[3]));
    const smuBytes = OpCodes.Unpack32BE(smu0).concat(OpCodes.Unpack32BE(smu1));
    const xored = smuBytes.map((b, i) => OpCodes.Xor32(b, rk1Bytes[i]));
    const substituted = sigmaBytes(xored);

    const rk0Bytes = OpCodes.Unpack32BE(rk[0]).concat(OpCodes.Unpack32BE(rk[1]));
    const out = substituted.map((b, i) => OpCodes.Xor32(b, rk0Bytes[i]));

    return [
      OpCodes.Pack32BE(out[0], out[1], out[2], out[3]),
      OpCodes.Pack32BE(out[4], out[5], out[6], out[7])
    ];
  }

  // The 32-bit orthomorphism "or" (a one-round Feistel with the identity as round function) and its inverse "io".
  function orthomorphism(x) {
    return OpCodes.Xor32(OpCodes.Xor32((OpCodes.Shl32(x, 16)), OpCodes.Shr32(x, 16)), OpCodes.And32(x, 0x0000FFFF));
  }
  function orthomorphismInv(x) {
    return OpCodes.Xor32(OpCodes.Xor32((OpCodes.Shl32(x, 16)), OpCodes.Shr32(x, 16)), OpCodes.And32(x, 0xFFFF0000));
  }

  // elmor128 / elmid128 / elmio128: the Extended Lai-Massey round functions on the 128-bit state [x0,x1,x2,x3].
  function elmor128(state, rk) {
    const fl = OpCodes.Xor32(state[0], state[1]);
    const fr = OpCodes.Xor32(state[2], state[3]);
    const [f0, f1] = f64(fl, fr, rk);
    return [
      orthomorphism(OpCodes.Xor32(state[0], f0)),
      OpCodes.Xor32(state[1], f0),
      orthomorphism(OpCodes.Xor32(state[2], f1)),
      OpCodes.Xor32(state[3], f1)
    ];
  }

  function elmid128(state, rk) {
    const fl = OpCodes.Xor32(state[0], state[1]);
    const fr = OpCodes.Xor32(state[2], state[3]);
    const [f0, f1] = f64(fl, fr, rk);
    return [
      OpCodes.Xor32(state[0], f0),
      OpCodes.Xor32(state[1], f0),
      OpCodes.Xor32(state[2], f1),
      OpCodes.Xor32(state[3], f1)
    ];
  }

  function elmio128(state, rk) {
    const fl = OpCodes.Xor32(state[0], state[1]);
    const fr = OpCodes.Xor32(state[2], state[3]);
    const [f0, f1] = f64(fl, fr, rk);
    return [
      orthomorphismInv(OpCodes.Xor32(state[0], f0)),
      OpCodes.Xor32(state[1], f0),
      orthomorphismInv(OpCodes.Xor32(state[2], f1)),
      OpCodes.Xor32(state[3], f1)
    ];
  }

  // 24-bit LFSR (primitive polynomial x^24+x^4+x^3+x+1) driving the key schedule's D-part.
  function lfsrClock(reg) {
    let r = OpCodes.Shl32(reg, 1);
    if (OpCodes.And32(r, 0x1000000)) r = OpCodes.Xor32(r, LFSR_POLY);
    return r;
  }

  // dnl128: D-part (LFSR-masked key) + NL128 (sigma8/mu8/mix128 non-linear mixing) producing one 128-bit round key.
  // Returns { rk: [w0,w1,w2,w3], reg: <updated LFSR state> }.
  function dnl128(mkey, reg, eq) {
    const dkey = new Array(32);
    let r = reg;

    for (let i = 0; i < 10; ++i) {
      r = lfsrClock(r);
      dkey[0 + i * 3] = OpCodes.Xor32(mkey[0 + i * 3], OpCodes.And32(OpCodes.Shr32(r, 16), 0xFF));
      dkey[1 + i * 3] = OpCodes.Xor32(mkey[1 + i * 3], OpCodes.And32(OpCodes.Shr32(r, 8), 0xFF));
      dkey[2 + i * 3] = OpCodes.Xor32(mkey[2 + i * 3], OpCodes.And32(r, 0xFF));
    }
    r = lfsrClock(r);
    dkey[30] = OpCodes.Xor32(mkey[30], OpCodes.And32(OpCodes.Shr32(r, 16), 0xFF));
    dkey[31] = OpCodes.Xor32(mkey[31], OpCodes.And32(OpCodes.Shr32(r, 8), 0xFF));

    const dkey32 = new Array(8);
    for (let i = 0; i < 8; ++i)
      dkey32[i] = OpCodes.Pack32BE(dkey[4 * i], dkey[4 * i + 1], dkey[4 * i + 2], dkey[4 * i + 3]);

    const t1 = new Array(8);
    for (let g = 0; g < 4; ++g) {
      const [w0, w1] = sigmaMu8(dkey32[2 * g], dkey32[2 * g + 1]);
      t1[2 * g] = w0;
      t1[2 * g + 1] = w1;
    }

    // MIX128: each output quarter is the XOR of the three quarters other than its own.
    const t0 = [
      OpCodes.Xor32(OpCodes.Xor32(t1[2], t1[4]), t1[6]),
      OpCodes.Xor32(OpCodes.Xor32(t1[3], t1[5]), t1[7]),
      OpCodes.Xor32(OpCodes.Xor32(t1[0], t1[4]), t1[6]),
      OpCodes.Xor32(OpCodes.Xor32(t1[1], t1[5]), t1[7]),
      OpCodes.Xor32(OpCodes.Xor32(t1[0], t1[2]), t1[6]),
      OpCodes.Xor32(OpCodes.Xor32(t1[1], t1[3]), t1[7]),
      OpCodes.Xor32(OpCodes.Xor32(t1[0], t1[2]), t1[4]),
      OpCodes.Xor32(OpCodes.Xor32(t1[1], t1[3]), t1[5])
    ];

    const padWords = new Array(8);
    for (let i = 0; i < 8; ++i)
      padWords[i] = OpCodes.Pack32BE(PAD[4 * i], PAD[4 * i + 1], PAD[4 * i + 2], PAD[4 * i + 3]);

    for (let i = 0; i < 8; ++i) {
      t0[i] = OpCodes.Xor32(t0[i], padWords[i]);
      if (eq) t0[i] = OpCodes.ToUint32(~t0[i]);
    }

    const x0 = OpCodes.Xor32(sigmaWord(t0[0]), sigmaWord(t0[4]));
    const x1 = OpCodes.Xor32(sigmaWord(t0[1]), sigmaWord(t0[5]));
    const x2 = OpCodes.Xor32(sigmaWord(t0[2]), sigmaWord(t0[6]));
    const x3 = OpCodes.Xor32(sigmaWord(t0[3]), sigmaWord(t0[7]));

    let state = [x0, x1, x2, x3];
    state = elmor128(state, [dkey32[0], dkey32[1], dkey32[2], dkey32[3]]);
    state = elmid128(state, [dkey32[4], dkey32[5], dkey32[6], dkey32[7]]);

    return { rk: state, reg: r };
  }

  // Full key schedule for a 256-bit key (ek = k = 256, so the P/M padding/mixing stages are skipped
  // and the flip condition "eq" (k == ek) is always true).
  function keySchedule(keyBytes) {
    let reg = OpCodes.Or32(OpCodes.Or32(0x006a0000, OpCodes.And32(OpCodes.Shl32(ROUNDS, 8), 0x0000FF00)), OpCodes.And32((~ROUNDS), 0x000000FF));
    if (OpCodes.And32(reg, 1)) reg = OpCodes.Xor32(reg, LFSR_POLY);
    reg = OpCodes.Shr32(reg, 1);

    const roundKeys = new Array(ROUNDS);
    for (let i = 0; i < ROUNDS; ++i) {
      const { rk, reg: nextReg } = dnl128(keyBytes, reg, true);
      roundKeys[i] = rk;
      reg = nextReg;
    }
    return roundKeys;
  }

  function encryptBlock(block, roundKeys) {
    let state = [
      OpCodes.Pack32BE(block[0], block[1], block[2], block[3]),
      OpCodes.Pack32BE(block[4], block[5], block[6], block[7]),
      OpCodes.Pack32BE(block[8], block[9], block[10], block[11]),
      OpCodes.Pack32BE(block[12], block[13], block[14], block[15])
    ];
    for (let i = 0; i < ROUNDS - 1; ++i)
      state = elmor128(state, roundKeys[i]);
    state = elmid128(state, roundKeys[ROUNDS - 1]);

    return [].concat(
      OpCodes.Unpack32BE(state[0]),
      OpCodes.Unpack32BE(state[1]),
      OpCodes.Unpack32BE(state[2]),
      OpCodes.Unpack32BE(state[3])
    );
  }

  function decryptBlock(block, roundKeys) {
    let state = [
      OpCodes.Pack32BE(block[0], block[1], block[2], block[3]),
      OpCodes.Pack32BE(block[4], block[5], block[6], block[7]),
      OpCodes.Pack32BE(block[8], block[9], block[10], block[11]),
      OpCodes.Pack32BE(block[12], block[13], block[14], block[15])
    ];
    for (let i = ROUNDS - 1; i >= 1; --i)
      state = elmio128(state, roundKeys[i]);
    state = elmid128(state, roundKeys[0]);

    return [].concat(
      OpCodes.Unpack32BE(state[0]),
      OpCodes.Unpack32BE(state[1]),
      OpCodes.Unpack32BE(state[2]),
      OpCodes.Unpack32BE(state[3])
    );
  }

  class DarkCryptIdeaNxtAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "IDEA-NXT (DarkCrypt)";
      this.description = "FOX128/256/32 (IDEA NXT-128 with a 256-bit key, 32 rounds): an Extended Lai-Massey block cipher by Junod and Vaudenay (EPFL), built from an f64 substitution-diffusion round function (sigma8 S-box layer plus an (8,8) MDS mu8 matrix over GF(2^8)) and orthomorphisms. 128-bit block, 256-bit key. As implemented by the DarkCrypt Total Commander plugin, which uses 32 rounds (vs. the generic FOX128/256 default of 16) and an all-zero key-schedule pad constant.";
      this.inventor = "Pascal Junod, Serge Vaudenay (EPFL); DarkCrypt port by Alexander Myasnikov";
      this.year = 2004;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CH;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];    // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)];  // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("FOX: a New Family of Block Ciphers (Junod, Vaudenay, SAC 2004)", "https://crypto.junod.info/sac04a.pdf"),
        new LinkItem("IDEA NXT reference implementation (O. Gay, 2006)", "https://github.com/ogay/idea_nxt"),
        new LinkItem("IDEA NXT overview (Wikipedia)", "https://en.wikipedia.org/wiki/IDEA_NXT")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Patent-encumbered design", "IDEA NXT/FOX was covered by software patents held by MediaCrypt AG; unrelated to any cryptographic weakness.", "Use AES or another vetted, unencumbered cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Ideanxt — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("180880d3e4ea58fc61294492bcb46ae6")
        },
        {
          text: "DarkCrypt Ideanxt — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("7cfe4b5c127efe0676dc062e929b2846")
        },
        {
          text: "DarkCrypt Ideanxt — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("41d8033ba27c7f215294ca9b0cf25211")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptIdeaNxtInstance(this, isInverse);
    }
  }

  class DarkCryptIdeaNxtInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._roundKeys = null;
      this.inputBuffer = [];
      this.BlockSize = BLOCK_BYTES;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._roundKeys = null; this.KeySize = 0; return; }
      if (keyBytes.length !== KEY_BYTES)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. IDEA-NXT (DarkCrypt) requires exactly ${KEY_BYTES} bytes`);
      this._key = [...keyBytes];
      this._roundKeys = keySchedule(this._key);
      this.KeySize = keyBytes.length;
    }

    get key() { return this._key ? [...this._key] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");
      if (this.inputBuffer.length % this.BlockSize !== 0)
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        output.push(...(this.isInverse ? decryptBlock(block, this._roundKeys) : encryptBlock(block, this._roundKeys)));
      }
      this.inputBuffer = [];
      return output;
    }
  }

  const algorithmInstance = new DarkCryptIdeaNxtAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptIdeaNxtAlgorithm, DarkCryptIdeaNxtInstance };
}));
