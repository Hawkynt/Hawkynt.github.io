/*
 * Luffa Hash Function (SHA-3 Candidate)
 * Designed by Christophe De Cannière, Hisayoshi Sato and Dai Watanabe (Hitachi, Ltd., Japan)
 * Submitted to NIST SHA-3 competition (2008-2012, eliminated in round 2)
 * Reference: https://www.hitachi.com/rd/yrl/crypto/luffa/
 * Specification: SHA-3 submission document
 *
 * Luffa is a sponge-like hash function that runs several independent
 * "chains" (3, 4 or 5 depending on output size) of an AES/Serpent-style
 * permutation P in parallel, mixing a message block into every chain
 * between permutation calls. Finalization performs one message-carrying
 * round followed by one or two "blank" rounds (zero message injection)
 * used purely to squeeze out additional output words for the larger
 * variants (Luffa-384/512), before the chain states are XOR-combined.
 *
 * Implementation and test vectors verified against the sphlib reference
 * (Thomas Pornin): luffa.c and test_luffa.c (NIST KAT derived values).
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
          HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // Initialization vectors for 5 state chains (each 8x32-bit words)
  const V_INIT = [
    new Uint32Array([
      0x6d251e69, 0x44b051e0, 0x4eaa6fb4, 0xdbf78465,
      0x6e292011, 0x90152df4, 0xee058139, 0xdef610bb
    ]),
    new Uint32Array([
      0xc3b44b95, 0xd9d2f256, 0x70eee9a0, 0xde099fa3,
      0x5d9b0557, 0x8fc944b3, 0xcf1ccf0e, 0x746cd581
    ]),
    new Uint32Array([
      0xf7efc89d, 0x5dba5781, 0x04016ce5, 0xad659c05,
      0x0306194f, 0x666d1836, 0x24aa230a, 0x8b264ae7
    ]),
    new Uint32Array([
      0x858075d5, 0x36d79cce, 0xe571f7d7, 0x204b1f67,
      0x35870c6a, 0x57e9e923, 0x14bcb808, 0x7cde72ce
    ]),
    new Uint32Array([
      0x6c68e9be, 0x5ec41e22, 0xc825b7c7, 0xaffb4363,
      0xf5df3999, 0x0fc688f1, 0xb07224cc, 0x03e86cea
    ])
  ];

  // Round constants for each state chain
  const RC00 = new Uint32Array([
    0x303994a6, 0xc0e65299, 0x6cc33a12, 0xdc56983e,
    0x1e00108f, 0x7800423d, 0x8f5b7882, 0x96e1db12
  ]);

  const RC04 = new Uint32Array([
    0xe0337818, 0x441ba90d, 0x7f34d442, 0x9389217f,
    0xe5a8bce6, 0x5274baf4, 0x26889ba7, 0x9a226e9d
  ]);

  const RC10 = new Uint32Array([
    0xb6de10ed, 0x70f47aae, 0x0707a3d4, 0x1c1e8f51,
    0x707a3d45, 0xaeb28562, 0xbaca1589, 0x40a46f3e
  ]);

  const RC14 = new Uint32Array([
    0x01685f3d, 0x05a17cf4, 0xbd09caca, 0xf4272b28,
    0x144ae5cc, 0xfaa7ae2b, 0x2e48f1c1, 0xb923c704
  ]);

  const RC20 = new Uint32Array([
    0xfc20d9d2, 0x34552e25, 0x7ad8818f, 0x8438764a,
    0xbb6de032, 0xedb780c8, 0xd9847356, 0xa2c78434
  ]);

  const RC24 = new Uint32Array([
    0xe25e72c1, 0xe623bb72, 0x5c58a4a4, 0x1e38e2e7,
    0x78e38b9d, 0x27586719, 0x36eda57f, 0x703aace7
  ]);

  const RC30 = new Uint32Array([
    0xb213afa5, 0xc84ebe95, 0x4e608a22, 0x56d858fe,
    0x343b138f, 0xd0ec4e3d, 0x2ceb4882, 0xb3ad2208
  ]);

  const RC34 = new Uint32Array([
    0xe028c9bf, 0x44756f91, 0x7e8fce32, 0x956548be,
    0xfe191be2, 0x3cb226e5, 0x5944a28e, 0xa1c4c355
  ]);

  const RC40 = new Uint32Array([
    0xf0d2e9e3, 0xac11d7fa, 0x1bcb66f2, 0x6f2d9bc9,
    0x78602649, 0x8edae952, 0x3b6ba548, 0xedae9520
  ]);

  const RC44 = new Uint32Array([
    0x5090d577, 0x2d1925ab, 0xb46496ac, 0xd1925ab0,
    0x29131ab6, 0x0fc053c3, 0x3f014f0c, 0xfc053c31
  ]);

  // NIST short-message test inputs, as produced by sphlib's
  // utest_nist_data() helper (a fixed pseudorandom byte pool indexed by
  // bit length via a triangular-number offset - NOT a simple 0,1,2,...
  // counting pattern). Values below are the literal message bytes for
  // bit lengths 0, 8, 16, 24 and 32, extracted from sphlib's utest.c.
  const NIST_MSG_0 = new Uint8Array([]);
  const NIST_MSG_8 = OpCodes.Hex8ToBytes("CC");
  const NIST_MSG_16 = OpCodes.Hex8ToBytes("41FB");
  const NIST_MSG_24 = OpCodes.Hex8ToBytes("1F877C");
  const NIST_MSG_32 = OpCodes.Hex8ToBytes("C1ECFDFC");

  // SUB_CRUMB operation: nonlinear 4-input substitution box.
  // Transliterated 1:1 from the sphlib SUB_CRUMB macro.
  function subCrumb(v, idx0, idx1, idx2, idx3) {
    let tmp = v[idx0];
    v[idx0] = OpCodes.Or32(v[idx0], v[idx1]);
    v[idx2] = OpCodes.Xor32(v[idx2], v[idx3]);
    v[idx1] = OpCodes.Not32(v[idx1]);
    v[idx0] = OpCodes.Xor32(v[idx0], v[idx3]);
    v[idx3] = OpCodes.And32(v[idx3], tmp);
    v[idx1] = OpCodes.Xor32(v[idx1], v[idx3]);
    v[idx3] = OpCodes.Xor32(v[idx3], v[idx2]);
    v[idx2] = OpCodes.And32(v[idx2], v[idx0]);
    v[idx0] = OpCodes.Not32(v[idx0]);
    v[idx2] = OpCodes.Xor32(v[idx2], v[idx1]);
    v[idx1] = OpCodes.Or32(v[idx1], v[idx3]);
    tmp = OpCodes.Xor32(tmp, v[idx1]);
    v[idx3] = OpCodes.Xor32(v[idx3], v[idx2]);
    v[idx2] = OpCodes.And32(v[idx2], v[idx1]);
    v[idx1] = OpCodes.Xor32(v[idx1], v[idx0]);
    v[idx0] = tmp;
  }

  // MIX_WORD operation: diffusion via rotations and XOR
  // Provides cryptographic diffusion between word pairs
  function mixWord(v, uIdx, vIdx) {
    v[vIdx] = OpCodes.Xor32(v[vIdx], v[uIdx]);
    v[uIdx] = OpCodes.Xor32(OpCodes.RotL32(v[uIdx], 2), v[vIdx]);
    v[vIdx] = OpCodes.Xor32(OpCodes.RotL32(v[vIdx], 14), v[uIdx]);
    v[uIdx] = OpCodes.Xor32(OpCodes.RotL32(v[uIdx], 10), v[vIdx]);
    v[vIdx] = OpCodes.RotL32(v[vIdx], 1);
  }

  // TWEAK operation: rotate specific elements in each state chain
  // TWEAK3: rotate V1[4..7] by 1, V2[4..7] by 2
  function tweak3(v0, v1, v2) {
    // V1 chain: rotate elements 4-7 left by 1 bit
    v1[4] = OpCodes.RotL32(v1[4], 1);
    v1[5] = OpCodes.RotL32(v1[5], 1);
    v1[6] = OpCodes.RotL32(v1[6], 1);
    v1[7] = OpCodes.RotL32(v1[7], 1);

    // V2 chain: rotate elements 4-7 left by 2 bits
    v2[4] = OpCodes.RotL32(v2[4], 2);
    v2[5] = OpCodes.RotL32(v2[5], 2);
    v2[6] = OpCodes.RotL32(v2[6], 2);
    v2[7] = OpCodes.RotL32(v2[7], 2);
  }

  // TWEAK operation for Luffa-4
  // TWEAK4: rotate V1[4..7] by 1, V2[4..7] by 2, V3[4..7] by 3
  function tweak4(v0, v1, v2, v3) {
    // V1 chain: rotate elements 4-7 left by 1 bit
    v1[4] = OpCodes.RotL32(v1[4], 1);
    v1[5] = OpCodes.RotL32(v1[5], 1);
    v1[6] = OpCodes.RotL32(v1[6], 1);
    v1[7] = OpCodes.RotL32(v1[7], 1);

    // V2 chain: rotate elements 4-7 left by 2 bits
    v2[4] = OpCodes.RotL32(v2[4], 2);
    v2[5] = OpCodes.RotL32(v2[5], 2);
    v2[6] = OpCodes.RotL32(v2[6], 2);
    v2[7] = OpCodes.RotL32(v2[7], 2);

    // V3 chain: rotate elements 4-7 left by 3 bits
    v3[4] = OpCodes.RotL32(v3[4], 3);
    v3[5] = OpCodes.RotL32(v3[5], 3);
    v3[6] = OpCodes.RotL32(v3[6], 3);
    v3[7] = OpCodes.RotL32(v3[7], 3);
  }

  // TWEAK operation for Luffa-5
  // TWEAK5: rotate V1[4..7] by 1, V2[4..7] by 2, V3[4..7] by 3, V4[4..7] by 4
  function tweak5(v0, v1, v2, v3, v4) {
    // V1 chain: rotate elements 4-7 left by 1 bit
    v1[4] = OpCodes.RotL32(v1[4], 1);
    v1[5] = OpCodes.RotL32(v1[5], 1);
    v1[6] = OpCodes.RotL32(v1[6], 1);
    v1[7] = OpCodes.RotL32(v1[7], 1);

    // V2 chain: rotate elements 4-7 left by 2 bits
    v2[4] = OpCodes.RotL32(v2[4], 2);
    v2[5] = OpCodes.RotL32(v2[5], 2);
    v2[6] = OpCodes.RotL32(v2[6], 2);
    v2[7] = OpCodes.RotL32(v2[7], 2);

    // V3 chain: rotate elements 4-7 left by 3 bits
    v3[4] = OpCodes.RotL32(v3[4], 3);
    v3[5] = OpCodes.RotL32(v3[5], 3);
    v3[6] = OpCodes.RotL32(v3[6], 3);
    v3[7] = OpCodes.RotL32(v3[7], 3);

    // V4 chain: rotate elements 4-7 left by 4 bits
    v4[4] = OpCodes.RotL32(v4[4], 4);
    v4[5] = OpCodes.RotL32(v4[5], 4);
    v4[6] = OpCodes.RotL32(v4[6], 4);
    v4[7] = OpCodes.RotL32(v4[7], 4);
  }

  // Step function: SUB_CRUMB + MIX_WORD for a single state chain.
  // Note the second SUB_CRUMB operates on indices (5,6,7,4), not
  // (4,5,6,7) - this cyclic offset is part of the sphlib specification
  // and is required for bit-exact output.
  function step(v, rc0, rc4, round) {
    // Apply SUB_CRUMB to all word pairs
    subCrumb(v, 0, 1, 2, 3);
    subCrumb(v, 5, 6, 7, 4);

    // Apply MIX_WORD for diffusion
    mixWord(v, 0, 4);
    mixWord(v, 1, 5);
    mixWord(v, 2, 6);
    mixWord(v, 3, 7);

    // Add round constants
    v[0] = OpCodes.Xor32(v[0], rc0[round]);
    v[4] = OpCodes.Xor32(v[4], rc4[round]);
  }

  // Permutation P3 for Luffa-224/256 (3 chains)
  function permutation3(v0, v1, v2) {
    tweak3(v0, v1, v2);

    for (let r = 0; r < 8; ++r) {
      step(v0, RC00, RC04, r);
      step(v1, RC10, RC14, r);
      step(v2, RC20, RC24, r);
    }
  }

  // Permutation P4 for Luffa-384 (4 chains)
  function permutation4(v0, v1, v2, v3) {
    tweak4(v0, v1, v2, v3);

    for (let r = 0; r < 8; ++r) {
      step(v0, RC00, RC04, r);
      step(v1, RC10, RC14, r);
      step(v2, RC20, RC24, r);
      step(v3, RC30, RC34, r);
    }
  }

  // Permutation P5 for Luffa-512 (5 chains)
  function permutation5(v0, v1, v2, v3, v4) {
    tweak5(v0, v1, v2, v3, v4);

    for (let r = 0; r < 8; ++r) {
      step(v0, RC00, RC04, r);
      step(v1, RC10, RC14, r);
      step(v2, RC20, RC24, r);
      step(v3, RC30, RC34, r);
      step(v4, RC40, RC44, r);
    }
  }

  // M2 linear transformation for message injection
  // M2 performs: d[7]=s[6], d[6]=s[5], d[5]=s[4], d[4]=s[3]^s[7],
  //              d[3]=s[2]^s[7], d[2]=s[1], d[1]=s[0]^s[7], d[0]=s[7]
  function m2(dst, src) {
    const tmp = src[7];
    dst[7] = src[6];
    dst[6] = src[5];
    dst[5] = src[4];
    dst[4] = OpCodes.Xor32(src[3], tmp);
    dst[3] = OpCodes.Xor32(src[2], tmp);
    dst[2] = src[1];
    dst[1] = OpCodes.Xor32(src[0], tmp);
    dst[0] = tmp;
  }

  // Message injection for Luffa-3
  // MI3: a = V0 XOR V1 XOR V2; M2(a,a); V0 = a XOR V0 XOR M;
  //      M2(M,M); V1 = a XOR V1 XOR M; M2(M,M); V2 = a XOR V2 XOR M
  function messageInjection3(v0, v1, v2, msg) {
    const a = new Uint32Array(8);
    const m = new Uint32Array(msg); // Copy message

    // Step 1: a = V0 XOR V1 XOR V2
    for (let i = 0; i < 8; ++i) {
      a[i] = OpCodes.Xor32(OpCodes.Xor32(v0[i], v1[i]), v2[i]);
    }

    // Step 2: M2(a, a)
    m2(a, a);

    // Step 3: V0 = a XOR V0 XOR M
    for (let i = 0; i < 8; ++i) {
      v0[i] = OpCodes.Xor32(OpCodes.Xor32(a[i], v0[i]), m[i]);
    }

    // Step 4: M2(M, M)
    m2(m, m);

    // Step 5: V1 = a XOR V1 XOR M
    for (let i = 0; i < 8; ++i) {
      v1[i] = OpCodes.Xor32(OpCodes.Xor32(a[i], v1[i]), m[i]);
    }

    // Step 6: M2(M, M)
    m2(m, m);

    // Step 7: V2 = a XOR V2 XOR M
    for (let i = 0; i < 8; ++i) {
      v2[i] = OpCodes.Xor32(OpCodes.Xor32(a[i], v2[i]), m[i]);
    }
  }

  // Message injection for Luffa-4
  function messageInjection4(v0, v1, v2, v3, msg) {
    const m = new Uint32Array(msg);
    const a = new Uint32Array(8);
    const b = new Uint32Array(8);

    // a = V0 XOR V1; b = V2 XOR V3; a = a XOR b
    for (let i = 0; i < 8; ++i) {
      a[i] = OpCodes.Xor32(v0[i], v1[i]);
      b[i] = OpCodes.Xor32(v2[i], v3[i]);
      a[i] = OpCodes.Xor32(a[i], b[i]);
    }

    // M2(a, a)
    m2(a, a);

    // V0 = a XOR V0; V1 = a XOR V1; V2 = a XOR V2; V3 = a XOR V3
    for (let i = 0; i < 8; ++i) {
      v0[i] = OpCodes.Xor32(a[i], v0[i]);
      v1[i] = OpCodes.Xor32(a[i], v1[i]);
      v2[i] = OpCodes.Xor32(a[i], v2[i]);
      v3[i] = OpCodes.Xor32(a[i], v3[i]);
    }

    // b = M2(V0); b = b XOR V3
    m2(b, v0);
    for (let i = 0; i < 8; ++i) {
      b[i] = OpCodes.Xor32(b[i], v3[i]);
    }

    // V3 = M2(V3); V3 = V3 XOR V2
    m2(v3, v3);
    for (let i = 0; i < 8; ++i) {
      v3[i] = OpCodes.Xor32(v3[i], v2[i]);
    }

    // V2 = M2(V2); V2 = V2 XOR V1
    m2(v2, v2);
    for (let i = 0; i < 8; ++i) {
      v2[i] = OpCodes.Xor32(v2[i], v1[i]);
    }

    // V1 = M2(V1); V1 = V1 XOR V0
    m2(v1, v1);
    for (let i = 0; i < 8; ++i) {
      v1[i] = OpCodes.Xor32(v1[i], v0[i]);
    }

    // V0 = b XOR M
    for (let i = 0; i < 8; ++i) {
      v0[i] = OpCodes.Xor32(b[i], m[i]);
    }

    // M = M2(M); V1 = V1 XOR M
    m2(m, m);
    for (let i = 0; i < 8; ++i) {
      v1[i] = OpCodes.Xor32(v1[i], m[i]);
    }

    // M = M2(M); V2 = V2 XOR M
    m2(m, m);
    for (let i = 0; i < 8; ++i) {
      v2[i] = OpCodes.Xor32(v2[i], m[i]);
    }

    // M = M2(M); V3 = V3 XOR M
    m2(m, m);
    for (let i = 0; i < 8; ++i) {
      v3[i] = OpCodes.Xor32(v3[i], m[i]);
    }
  }

  // Message injection for Luffa-5
  function messageInjection5(v0, v1, v2, v3, v4, msg) {
    const m = new Uint32Array(msg);
    const a = new Uint32Array(8);
    const b = new Uint32Array(8);

    // a = V0 XOR V1; b = V2 XOR V3; a = a XOR b; a = a XOR V4
    for (let i = 0; i < 8; ++i) {
      a[i] = OpCodes.Xor32(v0[i], v1[i]);
      b[i] = OpCodes.Xor32(v2[i], v3[i]);
      a[i] = OpCodes.Xor32(OpCodes.Xor32(a[i], b[i]), v4[i]);
    }

    // M2(a, a)
    m2(a, a);

    // V0 = a XOR V0; V1 = a XOR V1; V2 = a XOR V2; V3 = a XOR V3; V4 = a XOR V4
    for (let i = 0; i < 8; ++i) {
      v0[i] = OpCodes.Xor32(a[i], v0[i]);
      v1[i] = OpCodes.Xor32(a[i], v1[i]);
      v2[i] = OpCodes.Xor32(a[i], v2[i]);
      v3[i] = OpCodes.Xor32(a[i], v3[i]);
      v4[i] = OpCodes.Xor32(a[i], v4[i]);
    }

    // b = M2(V0); b = b XOR V1
    m2(b, v0);
    for (let i = 0; i < 8; ++i) {
      b[i] = OpCodes.Xor32(b[i], v1[i]);
    }

    // V1 = M2(V1); V1 = V1 XOR V2
    m2(v1, v1);
    for (let i = 0; i < 8; ++i) {
      v1[i] = OpCodes.Xor32(v1[i], v2[i]);
    }

    // V2 = M2(V2); V2 = V2 XOR V3
    m2(v2, v2);
    for (let i = 0; i < 8; ++i) {
      v2[i] = OpCodes.Xor32(v2[i], v3[i]);
    }

    // V3 = M2(V3); V3 = V3 XOR V4
    m2(v3, v3);
    for (let i = 0; i < 8; ++i) {
      v3[i] = OpCodes.Xor32(v3[i], v4[i]);
    }

    // V4 = M2(V4); V4 = V4 XOR V0
    m2(v4, v4);
    for (let i = 0; i < 8; ++i) {
      v4[i] = OpCodes.Xor32(v4[i], v0[i]);
    }

    // V0 = M2(b); V0 = V0 XOR V4
    m2(v0, b);
    for (let i = 0; i < 8; ++i) {
      v0[i] = OpCodes.Xor32(v0[i], v4[i]);
    }

    // V4 = M2(V4); V4 = V4 XOR V3
    m2(v4, v4);
    for (let i = 0; i < 8; ++i) {
      v4[i] = OpCodes.Xor32(v4[i], v3[i]);
    }

    // V3 = M2(V3); V3 = V3 XOR V2
    m2(v3, v3);
    for (let i = 0; i < 8; ++i) {
      v3[i] = OpCodes.Xor32(v3[i], v2[i]);
    }

    // V2 = M2(V2); V2 = V2 XOR V1
    m2(v2, v2);
    for (let i = 0; i < 8; ++i) {
      v2[i] = OpCodes.Xor32(v2[i], v1[i]);
    }

    // V1 = M2(V1); V1 = V1 XOR b; V0 = V0 XOR M
    m2(v1, v1);
    for (let i = 0; i < 8; ++i) {
      v1[i] = OpCodes.Xor32(v1[i], b[i]);
      v0[i] = OpCodes.Xor32(v0[i], m[i]);
    }

    // M = M2(M); V1 = V1 XOR M
    m2(m, m);
    for (let i = 0; i < 8; ++i) {
      v1[i] = OpCodes.Xor32(v1[i], m[i]);
    }

    // M = M2(M); V2 = V2 XOR M
    m2(m, m);
    for (let i = 0; i < 8; ++i) {
      v2[i] = OpCodes.Xor32(v2[i], m[i]);
    }

    // M = M2(M); V3 = V3 XOR M
    m2(m, m);
    for (let i = 0; i < 8; ++i) {
      v3[i] = OpCodes.Xor32(v3[i], m[i]);
    }

    // M = M2(M); V4 = V4 XOR M
    m2(m, m);
    for (let i = 0; i < 8; ++i) {
      v4[i] = OpCodes.Xor32(v4[i], m[i]);
    }
  }

  // Base Luffa class for shared functionality
  /**
 * LuffaBase - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class LuffaBase extends HashFunctionAlgorithm {
    constructor(outputBits, numChains) {
      super();
      this.outputBits = outputBits;
      this.numChains = numChains;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.OBSOLETE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.JP; // Hitachi, Japan (with Belgian co-designer)
      this.inventor = "Christophe De Cannière, Hisayoshi Sato, Dai Watanabe";
      this.year = 2008;

      this.documentation = [
        new LinkItem("Luffa SHA-3 Submission (Hitachi)", "https://www.hitachi.com/rd/yrl/crypto/luffa/"),
        new LinkItem("Luffa Submission Package (NIST SHA-3 Round 2)", "https://csrc.nist.gov/CSRC/media/Projects/Hash-Functions/documents/Luffa_Round2.zip"),
        new LinkItem("sphlib Reference Implementation", "https://github.com/pornin/sphlib/blob/master/c/luffa.c"),
        new LinkItem("NIST SHA-3 Competition", "https://csrc.nist.gov/projects/hash-functions/sha-3-project")
      ];

      this.references = [
        new LinkItem("sphlib test vectors (test_luffa.c)", "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c")
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new LuffaInstance(this, this.outputBits, this.numChains);
    }
  }

  // Luffa-224 implementation
  class Luffa224 extends LuffaBase {
    constructor() {
      super(224, 3);
      this.name = "Luffa-224";
      this.description = "SHA-3 candidate hash function producing 224-bit outputs using 3 parallel state chains with a sponge-like construction. Eliminated in round 2 of the NIST SHA-3 competition.";

      // NIST SHA-3 competition short-message test vectors (byte-granular)
      this.tests = [
        {
          text: "NIST Vector (0 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: NIST_MSG_0,
          expected: OpCodes.Hex8ToBytes("DBB8665871F4154D3E4396AEFBBA417CB7837DD683C332BA6BE87E02")
        },
        {
          text: "NIST Vector (8 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: NIST_MSG_8,
          expected: OpCodes.Hex8ToBytes("E47D4158BFE03555D370D8FD877EAD17D6AA9FDC689A9614C411FBBA")
        },
        {
          text: "NIST Vector (16 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: NIST_MSG_16,
          expected: OpCodes.Hex8ToBytes("08CBDD1C9CAEA9711AB2B30B872DDC09F2954B98AC1850ABE3F648F1")
        },
        {
          text: "NIST Vector (24 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: NIST_MSG_24,
          expected: OpCodes.Hex8ToBytes("A590D4995C909ABD9150398D4AB9465A8E9F768C576921C26A998857")
        },
        {
          text: "NIST Vector (32 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: NIST_MSG_32,
          expected: OpCodes.Hex8ToBytes("25C82F898F66355ABA7A6215D07CAB27FBEEEDD16B52AA910040B40F")
        }
      ];
    }
  }

  // Luffa-256 implementation
  class Luffa256 extends LuffaBase {
    constructor() {
      super(256, 3);
      this.name = "Luffa-256";
      this.description = "SHA-3 candidate hash function producing 256-bit outputs using 3 parallel state chains with a sponge-like construction. Eliminated in round 2 of the NIST SHA-3 competition.";

      this.tests = [
        {
          text: "NIST Vector (0 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: NIST_MSG_0,
          expected: OpCodes.Hex8ToBytes("DBB8665871F4154D3E4396AEFBBA417CB7837DD683C332BA6BE87E02A2712D6F")
        },
        {
          text: "NIST Vector (8 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: NIST_MSG_8,
          expected: OpCodes.Hex8ToBytes("E47D4158BFE03555D370D8FD877EAD17D6AA9FDC689A9614C411FBBA370C1706")
        },
        {
          text: "NIST Vector (16 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: NIST_MSG_16,
          expected: OpCodes.Hex8ToBytes("08CBDD1C9CAEA9711AB2B30B872DDC09F2954B98AC1850ABE3F648F11B76BF92")
        },
        {
          text: "NIST Vector (24 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: NIST_MSG_24,
          expected: OpCodes.Hex8ToBytes("A590D4995C909ABD9150398D4AB9465A8E9F768C576921C26A998857E7B0A604")
        },
        {
          text: "NIST Vector (32 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: NIST_MSG_32,
          expected: OpCodes.Hex8ToBytes("25C82F898F66355ABA7A6215D07CAB27FBEEEDD16B52AA910040B40FDA859981")
        }
      ];
    }
  }

  // Luffa-384 implementation
  class Luffa384 extends LuffaBase {
    constructor() {
      super(384, 4);
      this.name = "Luffa-384";
      this.description = "SHA-3 candidate hash function producing 384-bit outputs using 4 parallel state chains with a sponge-like construction. Eliminated in round 2 of the NIST SHA-3 competition.";

      this.tests = [
        {
          text: "NIST Vector (0 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: NIST_MSG_0,
          expected: OpCodes.Hex8ToBytes("117D3AD49024DFE2994F4E335C9B330B48C537A13A9B7FA465938E1A02FF862BCDF33838BC0F371B045D26952D3EA0C5")
        },
        {
          text: "NIST Vector (8 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: NIST_MSG_8,
          expected: OpCodes.Hex8ToBytes("E1979D16848976CA9FF183EC28998AB3D4B56942497F8E2C6D51895A96C7465DF6D7B66D6BA9636A16DBE51AAE6D2EB9")
        },
        {
          text: "NIST Vector (16 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: NIST_MSG_16,
          expected: OpCodes.Hex8ToBytes("836E9C8429D4A071935C72B0E575EA4CCA81642DC14A98A87307E02AC2D812682CE3EEAF8043330A7EA5CBE3A578B5D2")
        },
        {
          text: "NIST Vector (24 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: NIST_MSG_24,
          expected: OpCodes.Hex8ToBytes("0AFF61867C087908D2B9742012BB980CAE833C79FD4ECAAEA31BC1279F4CE356D6308C36D1FD0DBE70F652B0E2C66D35")
        },
        {
          text: "NIST Vector (32 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: NIST_MSG_32,
          expected: OpCodes.Hex8ToBytes("3736466CA7DC43A81025378E6CE678FE010EBB06382A73113AF39104CEA0F9BF00E27D12E0A1E7F37516E5CD0F2E9752")
        }
      ];
    }
  }

  // Luffa-512 implementation
  class Luffa512 extends LuffaBase {
    constructor() {
      super(512, 5);
      this.name = "Luffa-512";
      this.description = "SHA-3 candidate hash function producing 512-bit outputs using 5 parallel state chains with a sponge-like construction. Eliminated in round 2 of the NIST SHA-3 competition.";

      this.tests = [
        {
          text: "NIST Vector (0 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: NIST_MSG_0,
          expected: OpCodes.Hex8ToBytes("6E7DE4501189B3CA58F3AC114916654BBCD4922024B4CC1CD764ACFE8AB4B7805DF133EAB345FFDB1C414564C924F48E0A301824E2AC4C34BD4EFDE2E43DA90E")
        },
        {
          text: "NIST Vector (8 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: NIST_MSG_8,
          expected: OpCodes.Hex8ToBytes("91F1B09B2842871BC2F069E5D278D2D707DDAFABFE3CED5154FAF841E96781908290E6533D146183E8B7EC298F6DA20E0CFB1D41F4F711A3050FAA8DD4641F7F")
        },
        {
          text: "NIST Vector (16 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: NIST_MSG_16,
          expected: OpCodes.Hex8ToBytes("3448D8766E1C8CF84CA83D0882305A8EBCAB3F9C5B87F8F1BB94EC8ABBE86320E6D33024FBE9363595ED3B36BF49A5440A1248F0606940AEC1321FC74DBB6BE5")
        },
        {
          text: "NIST Vector (24 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: NIST_MSG_24,
          expected: OpCodes.Hex8ToBytes("327ED73E847B90A1D098250020E45915CE4991B686E3920043AB17F026B2D3C77F9FED996673D527E4A1F628FB2F4F05949D3EABB0B00D9967063877E4370015")
        },
        {
          text: "NIST Vector (32 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: NIST_MSG_32,
          expected: OpCodes.Hex8ToBytes("D6C06A024D386A58A01D9C5852229593F2197BD9F3AFC9EB3F3230807D99C06D8EEB7AA36D7EEA74FDA69EC1356191985CADEDB24BF0C312BA1DB9E974442B16")
        }
      ];
    }
  }

  // Luffa instance implementation
  /**
 * Luffa cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LuffaInstance extends IHashFunctionInstance {
    constructor(algorithm, outputBits, numChains) {
      super(algorithm);
      this.outputBits = outputBits;
      this.numChains = numChains;
      this.blockSize = 32; // 256 bits = 32 bytes per block

      // Initialize state chains
      this._resetState();

      this.buffer = [];
    }

    _resetState() {
      this.v0 = new Uint32Array(V_INIT[0]);
      this.v1 = new Uint32Array(V_INIT[1]);
      this.v2 = new Uint32Array(V_INIT[2]);
      this.v3 = this.numChains >= 4 ? new Uint32Array(V_INIT[3]) : null;
      this.v4 = this.numChains >= 5 ? new Uint32Array(V_INIT[4]) : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      for (let i = 0; i < data.length; ++i) {
        this.buffer.push(data[i]);

        if (this.buffer.length === this.blockSize) {
          this._injectAndPermute(this._decodeBlock(this.buffer));
          this.buffer = [];
        }
      }
    }

    // Decode a 32-byte block into 8 big-endian 32-bit words
    _decodeBlock(block) {
      const msg = new Uint32Array(8);
      for (let i = 0; i < 8; ++i) {
        msg[i] = OpCodes.Pack32BE(
          block[i * 4],
          block[i * 4 + 1],
          block[i * 4 + 2],
          block[i * 4 + 3]
        );
      }
      return msg;
    }

    // Perform one message injection + permutation round for however
    // many chains this variant uses
    _injectAndPermute(msg) {
      if (this.numChains === 3) {
        messageInjection3(this.v0, this.v1, this.v2, msg);
        permutation3(this.v0, this.v1, this.v2);
      } else if (this.numChains === 4) {
        messageInjection4(this.v0, this.v1, this.v2, this.v3, msg);
        permutation4(this.v0, this.v1, this.v2, this.v3);
      } else {
        messageInjection5(this.v0, this.v1, this.v2, this.v3, this.v4, msg);
        permutation5(this.v0, this.v1, this.v2, this.v3, this.v4);
      }
    }

    // XOR-combine the 8 words of every active chain
    _combineWords() {
      const out = new Uint32Array(8);
      for (let i = 0; i < 8; ++i) {
        let word = OpCodes.Xor32(this.v0[i], this.v1[i]);
        word = OpCodes.Xor32(word, this.v2[i]);
        if (this.numChains >= 4) word = OpCodes.Xor32(word, this.v3[i]);
        if (this.numChains >= 5) word = OpCodes.Xor32(word, this.v4[i]);
        out[i] = word;
      }
      return out;
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Padding: buffered bytes + 0x80 marker + zero fill to a full block
      const bufLen = this.buffer.length;
      const finalBlock = new Uint8Array(this.blockSize);
      for (let i = 0; i < bufLen; ++i) {
        finalBlock[i] = this.buffer[i];
      }
      finalBlock[bufLen] = 0x80;

      const finalMsg = this._decodeBlock(finalBlock);
      const zeroMsg = new Uint32Array(8);
      const outputBytes = this.outputBits / 8;

      // Finalization: one message-carrying round, followed by one blank
      // round (3-chain variants) or two blank rounds (4/5-chain
      // variants). The extra blank round on the larger variants squeezes
      // out the additional output words needed beyond a single 32-byte
      // state XOR (sphlib luffa3_close/luffa4_close/luffa5_close).
      const totalRounds = (this.numChains === 3) ? 2 : 3;
      const outWords = [];

      for (let round = 0; round < totalRounds; ++round) {
        this._injectAndPermute(round === 0 ? finalMsg : zeroMsg);

        if (this.numChains === 3) {
          if (round === totalRounds - 1) {
            const combined = this._combineWords();
            const wordsNeeded = Math.ceil(outputBytes / 4);
            for (let w = 0; w < wordsNeeded; ++w) outWords.push(combined[w]);
          }
        } else if (round === 1) {
          const combined = this._combineWords();
          for (let w = 0; w < 8; ++w) outWords.push(combined[w]);
        } else if (round === 2) {
          const combined = this._combineWords();
          const wordsNeeded = Math.ceil((outputBytes - 32) / 4);
          for (let w = 0; w < wordsNeeded; ++w) outWords.push(combined[w]);
        }
      }

      const output = [];
      for (let i = 0; i < outWords.length; ++i) {
        const bytes = OpCodes.Unpack32BE(outWords[i]);
        output.push(bytes[0], bytes[1], bytes[2], bytes[3]);
      }

      // Re-initialize for potential reuse
      this._resetState();
      this.buffer = [];

      return output.slice(0, outputBytes);
    }
  }

  // Register all Luffa variants
  RegisterAlgorithm(new Luffa224());
  RegisterAlgorithm(new Luffa256());
  RegisterAlgorithm(new Luffa384());
  RegisterAlgorithm(new Luffa512());

  return {
    Luffa224,
    Luffa256,
    Luffa384,
    Luffa512
  };
}));
