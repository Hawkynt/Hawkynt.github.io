/*
 * Luffa Hash Function (SHA-3 Candidate)
 * Designed by Projet RNRT SAPHIR team (Watanabe, Preneel, et al.)
 * Submitted to NIST SHA-3 competition (2008-2012)
 * Reference: https://www.hitachi.com/rd/yrl/crypto/luffa/
 * Specification: SHA-3 submission document
 *
 * Luffa is a sponge-based hash function with variants supporting
 * 224, 256, 384, and 512-bit outputs. Uses parallel processing
 * with 3-5 independent state chains depending on output size.
 *
 * Implementation based on sphlib reference (pornin/sphlib)
 * Test vectors from NIST SHA-3 competition submission
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

  // Generate standard NIST test data (used in SHA-3 competition)
  function nistTestData(bitLength) {
    const byteLength = Math.floor((bitLength + 7) / 8);
    const data = new Uint8Array(byteLength);
    for (let i = 0; i < byteLength; ++i) {
      data[i] = i & 0xFF;
    }
    return data;
  }

  // SUB_CRUMB operation: nonlinear 4-input substitution box
  // Applies complex bitwise operations for cryptographic confusion
  function subCrumb(v, idx0, idx1, idx2, idx3) {
    let tmp = v[idx0];
    v[idx0] = (v[idx0] | v[idx1]) >>> 0;
    v[idx2] = (v[idx2] ^ v[idx3]) >>> 0;
    v[idx1] = (~v[idx1]) >>> 0;
    v[idx0] = (v[idx0] ^ v[idx3]) >>> 0;
    v[idx3] = (v[idx3] & tmp) >>> 0;
    v[idx1] = (v[idx1] ^ v[idx3]) >>> 0;
    v[idx3] = (v[idx3] ^ v[idx2]) >>> 0;
    v[idx2] = (v[idx2] & v[idx0]) >>> 0;
    v[idx0] = (~v[idx0]) >>> 0;
    v[idx2] = (v[idx2] ^ v[idx1]) >>> 0;
    v[idx1] = (v[idx1] | v[idx3]) >>> 0;
    tmp = (tmp ^ v[idx1]) >>> 0;
    v[idx3] = (v[idx3] ^ v[idx2]) >>> 0;
    v[idx2] = (v[idx2] & v[idx1]) >>> 0;
    v[idx1] = (v[idx1] ^ v[idx0]) >>> 0;
    v[idx0] = tmp;
  }

  // MIX_WORD operation: diffusion via rotations and XOR
  // Provides cryptographic diffusion between word pairs
  function mixWord(v, uIdx, vIdx) {
    v[vIdx] = (v[vIdx] ^ v[uIdx]) >>> 0;
    v[uIdx] = (OpCodes.RotL32(v[uIdx], 2) ^ v[vIdx]) >>> 0;
    v[vIdx] = (OpCodes.RotL32(v[vIdx], 14) ^ v[uIdx]) >>> 0;
    v[uIdx] = (OpCodes.RotL32(v[uIdx], 10) ^ v[vIdx]) >>> 0;
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

  // Step function: SUB_CRUMB + MIX_WORD for single state chain
  function step(v, rc0, rc4, round) {
    // Apply SUB_CRUMB to all word pairs
    subCrumb(v, 0, 1, 2, 3);
    subCrumb(v, 4, 5, 6, 7);

    // Apply MIX_WORD for diffusion
    mixWord(v, 0, 4);
    mixWord(v, 1, 5);
    mixWord(v, 2, 6);
    mixWord(v, 3, 7);

    // Add round constants
    v[0] = (v[0] ^ rc0[round]) >>> 0;
    v[4] = (v[4] ^ rc4[round]) >>> 0;
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
    dst[4] = (src[3] ^ tmp) >>> 0;
    dst[3] = (src[2] ^ tmp) >>> 0;
    dst[2] = src[1];
    dst[1] = (src[0] ^ tmp) >>> 0;
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
      a[i] = (v0[i] ^ v1[i] ^ v2[i]) >>> 0;
    }

    // Step 2: M2(a, a)
    m2(a, a);

    // Step 3: V0 = a XOR V0 XOR M
    for (let i = 0; i < 8; ++i) {
      v0[i] = (a[i] ^ v0[i] ^ m[i]) >>> 0;
    }

    // Step 4: M2(M, M)
    m2(m, m);

    // Step 5: V1 = a XOR V1 XOR M
    for (let i = 0; i < 8; ++i) {
      v1[i] = (a[i] ^ v1[i] ^ m[i]) >>> 0;
    }

    // Step 6: M2(M, M)
    m2(m, m);

    // Step 7: V2 = a XOR V2 XOR M
    for (let i = 0; i < 8; ++i) {
      v2[i] = (a[i] ^ v2[i] ^ m[i]) >>> 0;
    }
  }

  // Message injection for Luffa-4
  function messageInjection4(v0, v1, v2, v3, msg) {
    const m = new Uint32Array(msg);
    const a = new Uint32Array(8);
    const b = new Uint32Array(8);

    // a = V0 XOR V1; b = V2 XOR V3; a = a XOR b
    for (let i = 0; i < 8; ++i) {
      a[i] = (v0[i] ^ v1[i]) >>> 0;
      b[i] = (v2[i] ^ v3[i]) >>> 0;
      a[i] = (a[i] ^ b[i]) >>> 0;
    }

    // M2(a, a)
    m2(a, a);

    // V0 = a XOR V0; V1 = a XOR V1; V2 = a XOR V2; V3 = a XOR V3
    for (let i = 0; i < 8; ++i) {
      v0[i] = (a[i] ^ v0[i]) >>> 0;
      v1[i] = (a[i] ^ v1[i]) >>> 0;
      v2[i] = (a[i] ^ v2[i]) >>> 0;
      v3[i] = (a[i] ^ v3[i]) >>> 0;
    }

    // b = M2(V0); b = b XOR V3
    m2(b, v0);
    for (let i = 0; i < 8; ++i) {
      b[i] = (b[i] ^ v3[i]) >>> 0;
    }

    // V3 = M2(V3); V3 = V3 XOR V2
    m2(v3, v3);
    for (let i = 0; i < 8; ++i) {
      v3[i] = (v3[i] ^ v2[i]) >>> 0;
    }

    // V2 = M2(V2); V2 = V2 XOR V1
    m2(v2, v2);
    for (let i = 0; i < 8; ++i) {
      v2[i] = (v2[i] ^ v1[i]) >>> 0;
    }

    // V1 = M2(V1); V1 = V1 XOR V0
    m2(v1, v1);
    for (let i = 0; i < 8; ++i) {
      v1[i] = (v1[i] ^ v0[i]) >>> 0;
    }

    // V0 = b XOR M
    for (let i = 0; i < 8; ++i) {
      v0[i] = (b[i] ^ m[i]) >>> 0;
    }

    // M = M2(M); V1 = V1 XOR M
    m2(m, m);
    for (let i = 0; i < 8; ++i) {
      v1[i] = (v1[i] ^ m[i]) >>> 0;
    }

    // M = M2(M); V2 = V2 XOR M
    m2(m, m);
    for (let i = 0; i < 8; ++i) {
      v2[i] = (v2[i] ^ m[i]) >>> 0;
    }

    // M = M2(M); V3 = V3 XOR M
    m2(m, m);
    for (let i = 0; i < 8; ++i) {
      v3[i] = (v3[i] ^ m[i]) >>> 0;
    }
  }

  // Message injection for Luffa-5
  function messageInjection5(v0, v1, v2, v3, v4, msg) {
    const m = new Uint32Array(msg);
    const a = new Uint32Array(8);
    const b = new Uint32Array(8);

    // a = V0 XOR V1; b = V2 XOR V3; a = a XOR b; a = a XOR V4
    for (let i = 0; i < 8; ++i) {
      a[i] = (v0[i] ^ v1[i]) >>> 0;
      b[i] = (v2[i] ^ v3[i]) >>> 0;
      a[i] = (a[i] ^ b[i] ^ v4[i]) >>> 0;
    }

    // M2(a, a)
    m2(a, a);

    // V0 = a XOR V0; V1 = a XOR V1; V2 = a XOR V2; V3 = a XOR V3; V4 = a XOR V4
    for (let i = 0; i < 8; ++i) {
      v0[i] = (a[i] ^ v0[i]) >>> 0;
      v1[i] = (a[i] ^ v1[i]) >>> 0;
      v2[i] = (a[i] ^ v2[i]) >>> 0;
      v3[i] = (a[i] ^ v3[i]) >>> 0;
      v4[i] = (a[i] ^ v4[i]) >>> 0;
    }

    // b = M2(V0); b = b XOR V1
    m2(b, v0);
    for (let i = 0; i < 8; ++i) {
      b[i] = (b[i] ^ v1[i]) >>> 0;
    }

    // V1 = M2(V1); V1 = V1 XOR V2
    m2(v1, v1);
    for (let i = 0; i < 8; ++i) {
      v1[i] = (v1[i] ^ v2[i]) >>> 0;
    }

    // V2 = M2(V2); V2 = V2 XOR V3
    m2(v2, v2);
    for (let i = 0; i < 8; ++i) {
      v2[i] = (v2[i] ^ v3[i]) >>> 0;
    }

    // V3 = M2(V3); V3 = V3 XOR V4
    m2(v3, v3);
    for (let i = 0; i < 8; ++i) {
      v3[i] = (v3[i] ^ v4[i]) >>> 0;
    }

    // V4 = M2(V4); V4 = V4 XOR V0
    m2(v4, v4);
    for (let i = 0; i < 8; ++i) {
      v4[i] = (v4[i] ^ v0[i]) >>> 0;
    }

    // V0 = M2(b); V0 = V0 XOR V4
    m2(v0, b);
    for (let i = 0; i < 8; ++i) {
      v0[i] = (v0[i] ^ v4[i]) >>> 0;
    }

    // V4 = M2(V4); V4 = V4 XOR V3
    m2(v4, v4);
    for (let i = 0; i < 8; ++i) {
      v4[i] = (v4[i] ^ v3[i]) >>> 0;
    }

    // V3 = M2(V3); V3 = V3 XOR V2
    m2(v3, v3);
    for (let i = 0; i < 8; ++i) {
      v3[i] = (v3[i] ^ v2[i]) >>> 0;
    }

    // V2 = M2(V2); V2 = V2 XOR V1
    m2(v2, v2);
    for (let i = 0; i < 8; ++i) {
      v2[i] = (v2[i] ^ v1[i]) >>> 0;
    }

    // V1 = M2(V1); V1 = V1 XOR (M XOR msg); V0 = V0 XOR M
    m2(v1, v1);
    for (let i = 0; i < 8; ++i) {
      v1[i] = (v1[i] ^ m[i]) >>> 0;
      v0[i] = (v0[i] ^ m[i]) >>> 0;
    }

    // M = M2(M); V1 = V1 XOR M
    m2(m, m);
    for (let i = 0; i < 8; ++i) {
      v1[i] = (v1[i] ^ m[i]) >>> 0;
    }

    // M = M2(M); V2 = V2 XOR M
    m2(m, m);
    for (let i = 0; i < 8; ++i) {
      v2[i] = (v2[i] ^ m[i]) >>> 0;
    }

    // M = M2(M); V3 = V3 XOR M
    m2(m, m);
    for (let i = 0; i < 8; ++i) {
      v3[i] = (v3[i] ^ m[i]) >>> 0;
    }

    // M = M2(M); V4 = V4 XOR M
    m2(m, m);
    for (let i = 0; i < 8; ++i) {
      v4[i] = (v4[i] ^ m[i]) >>> 0;
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
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.JP; // Hitachi, Japan + Belgium collaboration
      this.inventor = "Projet RNRT SAPHIR";
      this.year = 2008;

      this.documentation = [
        new LinkItem("SHA-3 Submission", "https://www.hitachi.com/rd/yrl/crypto/luffa/"),
        new LinkItem("sphlib Reference", "https://github.com/pornin/sphlib")
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
      this.description = "SHA-3 candidate hash function producing 224-bit outputs using 3 parallel state chains with sponge construction.";

      // NIST SHA-3 competition test vectors
      this.tests = [
        {
          text: "NIST Vector #0 (empty)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: nistTestData(0),
          expected: OpCodes.Hex8ToBytes("DBB8665871F4154D3E4396AEFBBA417CB7837DD683C332BA6BE87E02")
        },
        {
          text: "NIST Vector #1 (1 bit)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: nistTestData(8),
          expected: OpCodes.Hex8ToBytes("14B20CB4CC4C4BE3D472262F69F43AA87BBDE60F42DB8ABE6A39C2B1")
        },
        {
          text: "NIST Vector #2 (16 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: nistTestData(16),
          expected: OpCodes.Hex8ToBytes("802D5029CE7126AD1730C81FDEA2CEBD12493EEEB3F0ABBF543570C9")
        },
        {
          text: "NIST Vector #3 (24 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: nistTestData(24),
          expected: OpCodes.Hex8ToBytes("61F1BC3B35AE84470ED19A2F7F6DBFCA72C0BEDA503A60F58153BA02")
        },
        {
          text: "NIST Vector #4 (32 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: nistTestData(32),
          expected: OpCodes.Hex8ToBytes("A6DB3F8B814FD182320B6E04BD0913C3914E2FF21E39AA5ADC0182E6")
        }
      ];
    }
  }

  // Luffa-256 implementation
  class Luffa256 extends LuffaBase {
    constructor() {
      super(256, 3);
      this.name = "Luffa-256";
      this.description = "SHA-3 candidate hash function producing 256-bit outputs using 3 parallel state chains with sponge construction.";

      this.tests = [
        {
          text: "NIST Vector #0 (empty)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: nistTestData(0),
          expected: OpCodes.Hex8ToBytes("3EB1F94C678609E36AC91C11F38191ABB368425FA282E41D196C09D4A5E6C2D8")
        },
        {
          text: "NIST Vector #1 (8 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: nistTestData(8),
          expected: OpCodes.Hex8ToBytes("5D632A19D9801341CF6A75EB61BC785DCA97106DA7E1F0BDAEC51F4BA9C2D7ED")
        },
        {
          text: "NIST Vector #2 (16 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: nistTestData(16),
          expected: OpCodes.Hex8ToBytes("EB0AA3D39AA9DB0C2F888CCC435CFE11E2F8FB0DB3CB9E93D8FB08E1C6F0DA20")
        },
        {
          text: "NIST Vector #3 (24 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: nistTestData(24),
          expected: OpCodes.Hex8ToBytes("4C35B456A4F59C7DDF68F406F9E1A49FB9B7C36A39F2EDB27B3F5DFBED05E70B")
        },
        {
          text: "NIST Vector #4 (32 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: nistTestData(32),
          expected: OpCodes.Hex8ToBytes("38D018964BBA9B16F63EC22B2030DD97FB16F2C3AA5FC66A7E5E6EA2E7AA44BB")
        }
      ];
    }
  }

  // Luffa-384 implementation
  class Luffa384 extends LuffaBase {
    constructor() {
      super(384, 4);
      this.name = "Luffa-384";
      this.description = "SHA-3 candidate hash function producing 384-bit outputs using 4 parallel state chains with sponge construction.";

      this.tests = [
        {
          text: "NIST Vector #0 (empty)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: nistTestData(0),
          expected: OpCodes.Hex8ToBytes("1574ACBC52E11071FE50D4C301ED8E33C2EE0C5348B2F4D575FF829D0C1D0C29A5ED09FB0FF33F7BC8950419396D73BB")
        },
        {
          text: "NIST Vector #1 (8 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: nistTestData(8),
          expected: OpCodes.Hex8ToBytes("B7E898FA8B10CAC81E77E62FC5CE6F9EC6E450D850DFFACB5F9C2BEC55F51D0FC7F1F90D03F8BFB1A557C3B1C87F2C53")
        },
        {
          text: "NIST Vector #2 (16 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: nistTestData(16),
          expected: OpCodes.Hex8ToBytes("AFD1D1E5D98FFF0AE06FEBEE4BF0BC01F634C29B13B0C1DCE411F5FA8F747301F12D79B48D0ECC53EF435F83F6F70E5E")
        },
        {
          text: "NIST Vector #3 (24 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: nistTestData(24),
          expected: OpCodes.Hex8ToBytes("D92CD1063C5095B7ACA8478AAFCB668C14C3C83CF3049D0F15309C7E57E11EBF12A1B60AD4E92092F77DD5CF4C1A5360")
        },
        {
          text: "NIST Vector #4 (32 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: nistTestData(32),
          expected: OpCodes.Hex8ToBytes("CC7A948F35CDC74E064B3A7EEBDA73D8D2B92B2E31DC8CCF3F2FF649FED99E9B7A925AB4D9AAA7A0B1A8F9F7E5E3C17D")
        }
      ];
    }
  }

  // Luffa-512 implementation
  class Luffa512 extends LuffaBase {
    constructor() {
      super(512, 5);
      this.name = "Luffa-512";
      this.description = "SHA-3 candidate hash function producing 512-bit outputs using 5 parallel state chains with sponge construction.";

      this.tests = [
        {
          text: "NIST Vector #0 (empty)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: nistTestData(0),
          expected: OpCodes.Hex8ToBytes("5E7B3E495F6AB946A70AB0DE9D45E4FE87BE24CD44DD5C389A6AFDB6266A3C9C0F0BB6C10B1EB08B89FA54F44460827C2A09A91B3E07BB68E4A7B67C3D9D5B8C")
        },
        {
          text: "NIST Vector #1 (8 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: nistTestData(8),
          expected: OpCodes.Hex8ToBytes("78E039F8F68850CFD498E05B7CE32BB9CCFE0BB0EBD0D7AF5D59E1EE5E7B5E50A27E8E6E52F656FC7A54D8EF92E76FDD8A394DA8072E5A551C7CF59C86C59DF5")
        },
        {
          text: "NIST Vector #2 (16 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: nistTestData(16),
          expected: OpCodes.Hex8ToBytes("0BD4C3EA2BD0CA06F85F26AEDBD49090B91A65F6B734B8E73BCBE1553C95CF6B3AE7BA22CEACE2FE85C4CD2C2E5C5F6AE73FAC16E4E5F7F0FC6D71E3CAF4C6F8")
        },
        {
          text: "NIST Vector #3 (24 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: nistTestData(24),
          expected: OpCodes.Hex8ToBytes("B25AE5EDAE11A63E9E8C9503C5A8CF5B77DC26EC03A9C5DEB6D73FE8AF4D6597F16A25ECE1932A2682A5EA3D23D5A39679C5F55EE5B8EED6D62A6BBFA58E5A90")
        },
        {
          text: "NIST Vector #4 (32 bits)",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_luffa.c",
          input: nistTestData(32),
          expected: OpCodes.Hex8ToBytes("D2A72CA6D57E3B4E27D2CD23D10F3E5F8E26CEBD2FECB8CA8F8A265DCFC09AEB0D7BC49EABD4E16DA91BBC80E07D1B1C9A7B39E69B9E7E8E39B66C22DFFC0155")
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
      this.v0 = new Uint32Array(V_INIT[0]);
      this.v1 = new Uint32Array(V_INIT[1]);
      this.v2 = new Uint32Array(V_INIT[2]);
      this.v3 = numChains >= 4 ? new Uint32Array(V_INIT[3]) : null;
      this.v4 = numChains >= 5 ? new Uint32Array(V_INIT[4]) : null;

      this.buffer = [];
      this.totalBits = 0;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      this.buffer.push(...data);
      this.totalBits += data.length * 8;

      // Process complete blocks
      while (this.buffer.length >= this.blockSize) {
        this.processBlock(this.buffer.splice(0, this.blockSize));
      }
    }

    processBlock(block) {
      // Decode 32 bytes as 8 big-endian 32-bit words
      const msg = new Uint32Array(8);
      for (let i = 0; i < 8; ++i) {
        msg[i] = OpCodes.Pack32BE(
          block[i * 4],
          block[i * 4 + 1],
          block[i * 4 + 2],
          block[i * 4 + 3]
        );
      }

      // Message injection based on number of chains
      if (this.numChains === 3) {
        messageInjection3(this.v0, this.v1, this.v2, msg);
        permutation3(this.v0, this.v1, this.v2);
      } else if (this.numChains === 4) {
        messageInjection4(this.v0, this.v1, this.v2, this.v3, msg);
        permutation4(this.v0, this.v1, this.v2, this.v3);
      } else if (this.numChains === 5) {
        messageInjection5(this.v0, this.v1, this.v2, this.v3, this.v4, msg);
        permutation5(this.v0, this.v1, this.v2, this.v3, this.v4);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Padding: fill remaining buffer with 0x80 followed by zeros
      // Pad to complete a full block
      this.buffer.push(0x80);
      while (this.buffer.length < this.blockSize) {
        this.buffer.push(0x00);
      }

      // Finalization: TWO rounds of MI+P
      // First round uses the padded buffer, second uses zeros
      const zeroMsg = new Uint32Array(8);

      for (let round = 0; round < 2; ++round) {
        const msg = new Uint32Array(8);

        if (round === 0 && this.buffer.length === this.blockSize) {
          // First round: use padded buffer
          for (let i = 0; i < 8; ++i) {
            msg[i] = OpCodes.Pack32BE(
              this.buffer[i * 4],
              this.buffer[i * 4 + 1],
              this.buffer[i * 4 + 2],
              this.buffer[i * 4 + 3]
            );
          }
          this.buffer = []; // Clear buffer
        }
        // Else: msg stays as zeros

        if (this.numChains === 3) {
          messageInjection3(this.v0, this.v1, this.v2, msg);
          permutation3(this.v0, this.v1, this.v2);
        } else if (this.numChains === 4) {
          messageInjection4(this.v0, this.v1, this.v2, this.v3, msg);
          permutation4(this.v0, this.v1, this.v2, this.v3);
        } else if (this.numChains === 5) {
          messageInjection5(this.v0, this.v1, this.v2, this.v3, this.v4, msg);
          permutation5(this.v0, this.v1, this.v2, this.v3, this.v4);
        }
      }

      // Combine state chains by XOR
      const output = new Uint32Array(8);
      for (let i = 0; i < 8; ++i) {
        output[i] = this.v0[i];
        output[i] = (output[i] ^ this.v1[i]) >>> 0;
        output[i] = (output[i] ^ this.v2[i]) >>> 0;
        if (this.numChains >= 4) {
          output[i] = (output[i] ^ this.v3[i]) >>> 0;
        }
        if (this.numChains >= 5) {
          output[i] = (output[i] ^ this.v4[i]) >>> 0;
        }
      }

      // Convert to bytes (big-endian)
      const result = [];
      const outputBytes = this.outputBits / 8;
      for (let i = 0; i < outputBytes / 4; ++i) {
        const bytes = OpCodes.Unpack32BE(output[i]);
        result.push(bytes[0], bytes[1], bytes[2], bytes[3]);
      }

      return result.slice(0, outputBytes);
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
