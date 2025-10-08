/*
 * Kalyna Block Cipher - DSTU 7624:2014 Implementation
 * EXACT port from Crypto++ kalyna.cpp by Jeffrey Walton
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Ukrainian national encryption standard - production-grade T-table implementation.
 * This is a BIT-PERFECT port of Crypto++ maintaining all mathematical operations exactly.
 *
 * Reference: Crypto++ kalyna.cpp and kalynatab.cpp
 * Based on official DSTU 7624:2014 specification
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

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          BlockCipherAlgorithm, IBlockCipherInstance, KeySize, LinkItem, Vulnerability } = AlgorithmFramework;

  // ===== S-BOXES FROM DSTU 7624:2014 =====
  // 4 S-boxes cycling through byte positions

  const S = [
    // S-box 0
    new Uint8Array([
      0xa8, 0x43, 0x5f, 0x06, 0x6b, 0x75, 0x6c, 0x59, 0x71, 0xdf, 0x87, 0x95, 0x17, 0xf0, 0xd8, 0x09,
      0x6d, 0xf3, 0x1d, 0xcb, 0xc9, 0x4d, 0x2c, 0xaf, 0x79, 0xe0, 0x97, 0xfd, 0x6f, 0x4b, 0x45, 0x39,
      0x3e, 0xdd, 0xa3, 0x4f, 0xb4, 0xb6, 0x9a, 0x0e, 0x1f, 0xbf, 0x15, 0xe1, 0x49, 0xd2, 0x93, 0xc6,
      0x92, 0x72, 0x9e, 0x61, 0xd1, 0x63, 0xfa, 0xee, 0xf4, 0x19, 0xd5, 0xad, 0x58, 0xa4, 0xbb, 0xa1,
      0xdc, 0xf2, 0x83, 0x37, 0x42, 0xe4, 0x7a, 0x32, 0x9c, 0xcc, 0xab, 0x4a, 0x8f, 0x6e, 0x04, 0x27,
      0x2e, 0xe7, 0xe2, 0x5a, 0x96, 0x16, 0x23, 0x2b, 0xc2, 0x65, 0x66, 0x0f, 0xbc, 0xa9, 0x47, 0x41,
      0x34, 0x48, 0xfc, 0xb7, 0x6a, 0x88, 0xa5, 0x53, 0x86, 0xf9, 0x5b, 0xdb, 0x38, 0x7b, 0xc3, 0x1e,
      0x22, 0x33, 0x24, 0x28, 0x36, 0xc7, 0xb2, 0x3b, 0x8e, 0x77, 0xba, 0xf5, 0x14, 0x9f, 0x08, 0x55,
      0x9b, 0x4c, 0xfe, 0x60, 0x5c, 0xda, 0x18, 0x46, 0xcd, 0x7d, 0x21, 0xb0, 0x3f, 0x1b, 0x89, 0xff,
      0xeb, 0x84, 0x69, 0x3a, 0x9d, 0xd7, 0xd3, 0x70, 0x67, 0x40, 0xb5, 0xde, 0x5d, 0x30, 0x91, 0xb1,
      0x78, 0x11, 0x01, 0xe5, 0x00, 0x68, 0x98, 0xa0, 0xc5, 0x02, 0xa6, 0x74, 0x2d, 0x0b, 0xa2, 0x76,
      0xb3, 0xbe, 0xce, 0xbd, 0xae, 0xe9, 0x8a, 0x31, 0x1c, 0xec, 0xf1, 0x99, 0x94, 0xaa, 0xf6, 0x26,
      0x2f, 0xef, 0xe8, 0x8c, 0x35, 0x03, 0xd4, 0x7f, 0xfb, 0x05, 0xc1, 0x5e, 0x90, 0x20, 0x3d, 0x82,
      0xf7, 0xea, 0x0a, 0x0d, 0x7e, 0xf8, 0x50, 0x1a, 0xc4, 0x07, 0x57, 0xb8, 0x3c, 0x62, 0xe3, 0xc8,
      0xac, 0x52, 0x64, 0x10, 0xd0, 0xd9, 0x13, 0x0c, 0x12, 0x29, 0x51, 0xb9, 0xcf, 0xd6, 0x73, 0x8d,
      0x81, 0x54, 0xc0, 0xed, 0x4e, 0x44, 0xa7, 0x2a, 0x85, 0x25, 0xe6, 0xca, 0x7c, 0x8b, 0x56, 0x80
    ]),
    // S-box 1
    new Uint8Array([
      0xce, 0xbb, 0xeb, 0x92, 0xea, 0xcb, 0x13, 0xc1, 0xe9, 0x3a, 0xd6, 0xb2, 0xd2, 0x90, 0x17, 0xf8,
      0x42, 0x15, 0x56, 0xb4, 0x65, 0x1c, 0x88, 0x43, 0xc5, 0x5c, 0x36, 0xba, 0xf5, 0x57, 0x67, 0x8d,
      0x31, 0xf6, 0x64, 0x58, 0x9e, 0xf4, 0x22, 0xaa, 0x75, 0x0f, 0x02, 0xb1, 0xdf, 0x6d, 0x73, 0x4d,
      0x7c, 0x26, 0x2e, 0xf7, 0x08, 0x5d, 0x44, 0x3e, 0x9f, 0x14, 0xc8, 0xae, 0x54, 0x10, 0xd8, 0xbc,
      0x1a, 0x6b, 0x69, 0xf3, 0xbd, 0x33, 0xab, 0xfa, 0xd1, 0x9b, 0x68, 0x4e, 0x16, 0x95, 0x91, 0xee,
      0x4c, 0x63, 0x8e, 0x5b, 0xcc, 0x3c, 0x19, 0xa1, 0x81, 0x49, 0x7b, 0xd9, 0x6f, 0x37, 0x60, 0xca,
      0xe7, 0x2b, 0x48, 0xfd, 0x96, 0x45, 0xfc, 0x41, 0x12, 0x0d, 0x79, 0xe5, 0x89, 0x8c, 0xe3, 0x20,
      0x30, 0xdc, 0xb7, 0x6c, 0x4a, 0xb5, 0x3f, 0x97, 0xd4, 0x62, 0x2d, 0x06, 0xa4, 0xa5, 0x83, 0x5f,
      0x2a, 0xda, 0xc9, 0x00, 0x7e, 0xa2, 0x55, 0xbf, 0x11, 0xd5, 0x9c, 0xcf, 0x0e, 0x0a, 0x3d, 0x51,
      0x7d, 0x93, 0x1b, 0xfe, 0xc4, 0x47, 0x09, 0x86, 0x0b, 0x8f, 0x9d, 0x6a, 0x07, 0xb9, 0xb0, 0x98,
      0x18, 0x32, 0x71, 0x4b, 0xef, 0x3b, 0x70, 0xa0, 0xe4, 0x40, 0xff, 0xc3, 0xa9, 0xe6, 0x78, 0xf9,
      0x8b, 0x46, 0x80, 0x1e, 0x38, 0xe1, 0xb8, 0xa8, 0xe0, 0x0c, 0x23, 0x76, 0x1d, 0x25, 0x24, 0x05,
      0xf1, 0x6e, 0x94, 0x28, 0x9a, 0x84, 0xe8, 0xa3, 0x4f, 0x77, 0xd3, 0x85, 0xe2, 0x52, 0xf2, 0x82,
      0x50, 0x7a, 0x2f, 0x74, 0x53, 0xb3, 0x61, 0xaf, 0x39, 0x35, 0xde, 0xcd, 0x1f, 0x99, 0xac, 0xad,
      0x72, 0x2c, 0xdd, 0xd0, 0x87, 0xbe, 0x5e, 0xa6, 0xec, 0x04, 0xc6, 0x03, 0x34, 0xfb, 0xdb, 0x59,
      0xb6, 0xc2, 0x01, 0xf0, 0x5a, 0xed, 0xa7, 0x66, 0x21, 0x7f, 0x8a, 0x27, 0xc7, 0xc0, 0x29, 0xd7
    ]),
    // S-box 2
    new Uint8Array([
      0x93, 0xd9, 0x9a, 0xb5, 0x98, 0x22, 0x45, 0xfc, 0xba, 0x6a, 0xdf, 0x02, 0x9f, 0xdc, 0x51, 0x59,
      0x4a, 0x17, 0x2b, 0xc2, 0x94, 0xf4, 0xbb, 0xa3, 0x62, 0xe4, 0x71, 0xd4, 0xcd, 0x70, 0x16, 0xe1,
      0x49, 0x3c, 0xc0, 0xd8, 0x5c, 0x9b, 0xad, 0x85, 0x53, 0xa1, 0x7a, 0xc8, 0x2d, 0xe0, 0xd1, 0x72,
      0xa6, 0x2c, 0xc4, 0xe3, 0x76, 0x78, 0xb7, 0xb4, 0x09, 0x3b, 0x0e, 0x41, 0x4c, 0xde, 0xb2, 0x90,
      0x25, 0xa5, 0xd7, 0x03, 0x11, 0x00, 0xc3, 0x2e, 0x92, 0xef, 0x4e, 0x12, 0x9d, 0x7d, 0xcb, 0x35,
      0x10, 0xd5, 0x4f, 0x9e, 0x4d, 0xa9, 0x55, 0xc6, 0xd0, 0x7b, 0x18, 0x97, 0xd3, 0x36, 0xe6, 0x48,
      0x56, 0x81, 0x8f, 0x77, 0xcc, 0x9c, 0xb9, 0xe2, 0xac, 0xb8, 0x2f, 0x15, 0xa4, 0x7c, 0xda, 0x38,
      0x1e, 0x0b, 0x05, 0xd6, 0x14, 0x6e, 0x6c, 0x7e, 0x66, 0xfd, 0xb1, 0xe5, 0x60, 0xaf, 0x5e, 0x33,
      0x87, 0xc9, 0xf0, 0x5d, 0x6d, 0x3f, 0x88, 0x8d, 0xc7, 0xf7, 0x1d, 0xe9, 0xec, 0xed, 0x80, 0x29,
      0x27, 0xcf, 0x99, 0xa8, 0x50, 0x0f, 0x37, 0x24, 0x28, 0x30, 0x95, 0xd2, 0x3e, 0x5b, 0x40, 0x83,
      0xb3, 0x69, 0x57, 0x1f, 0x07, 0x1c, 0x8a, 0xbc, 0x20, 0xeb, 0xce, 0x8e, 0xab, 0xee, 0x31, 0xa2,
      0x73, 0xf9, 0xca, 0x3a, 0x1a, 0xfb, 0x0d, 0xc1, 0xfe, 0xfa, 0xf2, 0x6f, 0xbd, 0x96, 0xdd, 0x43,
      0x52, 0xb6, 0x08, 0xf3, 0xae, 0xbe, 0x19, 0x89, 0x32, 0x26, 0xb0, 0xea, 0x4b, 0x64, 0x84, 0x82,
      0x6b, 0xf5, 0x79, 0xbf, 0x01, 0x5f, 0x75, 0x63, 0x1b, 0x23, 0x3d, 0x68, 0x2a, 0x65, 0xe8, 0x91,
      0xf6, 0xff, 0x13, 0x58, 0xf1, 0x47, 0x0a, 0x7f, 0xc5, 0xa7, 0xe7, 0x61, 0x5a, 0x06, 0x46, 0x44,
      0x42, 0x04, 0xa0, 0xdb, 0x39, 0x86, 0x54, 0xaa, 0x8c, 0x34, 0x21, 0x8b, 0xf8, 0x0c, 0x74, 0x67
    ]),
    // S-box 3
    new Uint8Array([
      0x68, 0x8d, 0xca, 0x4d, 0x73, 0x4b, 0x4e, 0x2a, 0xd4, 0x52, 0x26, 0xb3, 0x54, 0x1e, 0x19, 0x1f,
      0x22, 0x03, 0x46, 0x3d, 0x2d, 0x4a, 0x53, 0x83, 0x13, 0x8a, 0xb7, 0xd5, 0x25, 0x79, 0xf5, 0xbd,
      0x58, 0x2f, 0x0d, 0x02, 0xed, 0x51, 0x9e, 0x11, 0xf2, 0x3e, 0x55, 0x5e, 0xd1, 0x16, 0x3c, 0x66,
      0x70, 0x5d, 0xf3, 0x45, 0x40, 0xcc, 0xe8, 0x94, 0x56, 0x08, 0xce, 0x1a, 0x3a, 0xd2, 0xe1, 0xdf,
      0xb5, 0x38, 0x6e, 0x0e, 0xe5, 0xf4, 0xf9, 0x86, 0xe9, 0x4f, 0xd6, 0x85, 0x23, 0xcf, 0x32, 0x99,
      0x31, 0x14, 0xae, 0xee, 0xc8, 0x48, 0xd3, 0x30, 0xa1, 0x92, 0x41, 0xb1, 0x18, 0xc4, 0x2c, 0x71,
      0x72, 0x44, 0x15, 0xfd, 0x37, 0xbe, 0x5f, 0xaa, 0x9b, 0x88, 0xd8, 0xab, 0x89, 0x9c, 0xfa, 0x60,
      0xea, 0xbc, 0x62, 0x0c, 0x24, 0xa6, 0xa8, 0xec, 0x67, 0x20, 0xdb, 0x7c, 0x28, 0xdd, 0xac, 0x5b,
      0x34, 0x7e, 0x10, 0xf1, 0x7b, 0x8f, 0x63, 0xa0, 0x05, 0x9a, 0x43, 0x77, 0x21, 0xbf, 0x27, 0x09,
      0xc3, 0x9f, 0xb6, 0xd7, 0x29, 0xc2, 0xeb, 0xc0, 0xa4, 0x8b, 0x8c, 0x1d, 0xfb, 0xff, 0xc1, 0xb2,
      0x97, 0x2e, 0xf8, 0x65, 0xf6, 0x75, 0x07, 0x04, 0x49, 0x33, 0xe4, 0xd9, 0xb9, 0xd0, 0x42, 0xc7,
      0x6c, 0x90, 0x00, 0x8e, 0x6f, 0x50, 0x01, 0xc5, 0xda, 0x47, 0x3f, 0xcd, 0x69, 0xa2, 0xe2, 0x7a,
      0xa7, 0xc6, 0x93, 0x0f, 0x0a, 0x06, 0xe6, 0x2b, 0x96, 0xa3, 0x1c, 0xaf, 0x6a, 0x12, 0x84, 0x39,
      0xe7, 0xb0, 0x82, 0xf7, 0xfe, 0x9d, 0x87, 0x5c, 0x81, 0x35, 0xde, 0xb4, 0xa5, 0xfc, 0x80, 0xef,
      0xcb, 0xbb, 0x6b, 0x76, 0xba, 0x5a, 0x7d, 0x78, 0x0b, 0x95, 0xe3, 0xad, 0x74, 0x98, 0x3b, 0x36,
      0x64, 0x6d, 0xdc, 0xf0, 0x59, 0xa9, 0x4c, 0x17, 0x7f, 0x91, 0xb8, 0xc9, 0x57, 0x1b, 0xe0, 0x61
    ])
  ];

  // Inverse S-boxes (computed on demand)
  let IS = null;

  // T-tables and IT-tables (generated from S-boxes and MDS matrix)
  const T = [];
  const IT = [];

  // MDS matrix for diffusion (8x8 circulant matrix from DSTU 7624:2014)
  const MDS = [
    [0x01, 0x01, 0x05, 0x01, 0x08, 0x06, 0x07, 0x04],
    [0x04, 0x01, 0x01, 0x05, 0x01, 0x08, 0x06, 0x07],
    [0x07, 0x04, 0x01, 0x01, 0x05, 0x01, 0x08, 0x06],
    [0x06, 0x07, 0x04, 0x01, 0x01, 0x05, 0x01, 0x08],
    [0x08, 0x06, 0x07, 0x04, 0x01, 0x01, 0x05, 0x01],
    [0x01, 0x08, 0x06, 0x07, 0x04, 0x01, 0x01, 0x05],
    [0x05, 0x01, 0x08, 0x06, 0x07, 0x04, 0x01, 0x01],
    [0x01, 0x05, 0x01, 0x08, 0x06, 0x07, 0x04, 0x01]
  ];

  // Inverse MDS matrix
  const IMDS = [
    [0xad, 0x95, 0x76, 0xa8, 0x2f, 0x49, 0xd7, 0xca],
    [0xca, 0xad, 0x95, 0x76, 0xa8, 0x2f, 0x49, 0xd7],
    [0xd7, 0xca, 0xad, 0x95, 0x76, 0xa8, 0x2f, 0x49],
    [0x49, 0xd7, 0xca, 0xad, 0x95, 0x76, 0xa8, 0x2f],
    [0x2f, 0x49, 0xd7, 0xca, 0xad, 0x95, 0x76, 0xa8],
    [0xa8, 0x2f, 0x49, 0xd7, 0xca, 0xad, 0x95, 0x76],
    [0x76, 0xa8, 0x2f, 0x49, 0xd7, 0xca, 0xad, 0x95],
    [0x95, 0x76, 0xa8, 0x2f, 0x49, 0xd7, 0xca, 0xad]
  ];

  // GF(2^8) multiplication using polynomial 0x11d (Kalyna-specific)
  function KalynaGF256Mul(a, b) {
    let product = 0;
    for (let i = 0; i < 8; i++) {
      if (b & 1) product ^= a;
      const hiBit = a & 0x80;
      a = (a << 1) & 0xff; // GF(2^8) field operation - not replaceable with OpCodes
      if (hiBit) a ^= 0x1d;
      b >>= 1; // GF(2^8) field operation - not replaceable with OpCodes
    }
    return product & 0xff;
  }

  // Initialize T-tables from S-boxes and MDS matrix
  function initializeTTables() {
    if (T.length > 0) return;

    // Generate 8 T-tables for encryption
    for (let i = 0; i < 8; i++) {
      T[i] = new Array(256);
      for (let b = 0; b < 256; b++) {
        const sb = S[i % 4][b];
        let val = 0n;
        for (let j = 0; j < 8; j++) {
          const product = KalynaGF256Mul(MDS[j][i], sb);
          val |= BigInt(product) << BigInt(j * 8);
        }
        T[i][b] = val;
      }
    }

    // Generate inverse S-boxes
    if (!IS) {
      IS = [];
      for (let s = 0; s < 4; s++) {
        IS[s] = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
          IS[s][S[s][i]] = i;
        }
      }
    }

    // IT tables - Pre-computed from Crypto++ kalynatab.cpp (8 tables x 256 entries)
    // These are the EXACT inverse T-tables from the official implementation
    for (let i = 0; i < 8; i++) IT[i] = new Array(256);

    // IT[0]
    const IT0 = [
      0x7826942b9f5f8a9an, 0x210f43c934970c53n, 0x5f028fdd9d0551b8n, 0x14facd82b494c83bn,
      0x2b72ab886edd68c0n, 0xa6a87e5bff19d9b4n, 0xa29ae571db6443ean, 0x039b2c911be8e5b6n,
      0xd9275dcb5fd32cc6n, 0x10c856a890e95265n, 0x7d96e085b27ab85dn, 0x31c71561a47e5e36n,
      0x74702455f3d83978n, 0xe8e048aafbad72f0n, 0x9b39db4437e03460n, 0x75f2cbd1fa8091e1n,
      0x1ab5bee9caa336f6n, 0x8395a6b8eff34fb9n, 0x64b872fd63316b1dn, 0xe1068c7aba0ff3d5n,
      0xeecb1095cd60a581n, 0xbc1dc0b235baef42n, 0xf04c355623be0929n, 0xb252b3d94b8d118fn,
      0x18ac7dfcd8137bd9n, 0xbbb477090a2f90aan, 0x8625d216c2d67d7en, 0x66a1b1e871812632n,
      0x6f4775383023a717n, 0x92df1f947642b545n, 0xe962a72ef2f5da69n, 0x8bf18deca7096605n,
      0xc86de4e7c662d63an, 0xaafece25939e6a56n, 0x5c99a34c86edb40en, 0x52d6d027f8da4ac3n,
      0x6b75ee12145e3d49n, 0x54fd8818ce179db2n, 0xa3180af5d23ceb73n, 0xbe0403a7270aa26dn,
      0xfe03463d5d89f7e4n, 0xf1cedad22ae6a1b0n, 0xd143769f1729057an, 0xc7a07808b10d806en,
      0xfc1a85284f39bacbn, 0xa4b1bd4eeda9949bn, 0x0bff07c55312cc0an, 0xef49ff11c4380d18n,
      0xc392e32295701a30n, 0x7f8f2390a0caf572n, 0x62932ac255fcbc6cn, 0xc9ef0b63cf3a7ea3n,
      0xf9aaf186621c880cn, 0x818c65adfd430296n, 0x325c39f0bf96bb80n, 0x0c56b07e6c87b3e2n,
      0x4bf8425f29919983n, 0xb5fb046274186e67n, 0x462c1da54c4e82f8n, 0x90c6dc8164f2f86an,
      0xf8281e026b442095n, 0x6af701961d0695d0n, 0x5766a489d5ff7804n, 0xf3d719c73856ec9fn,
      0xad57799eac0b15ben, 0x1b37516dc3fb9e6fn, 0xc009cfb38e98ff86n, 0x9576a82f49d7caadn,
      0xe6af3bc1859a8c3dn, 0x208dac4d3dcfa4can, 0x8ddad5d391c4b174n, 0x8e41f9428a2c54c2n,
      0x6cdc59a92bcb42a1n, 0xe53417509e72698bn, 0xd0c1991b1e71ade3n, 0x8217493ce6abe720n,
      0xd4f302313a0c37bdn, 0x5e806059945df921n, 0x73d993eecc4d4690n, 0xf5fc41f80e9b3been,
      0x13537a398b01b7d3n, 0x53543fa3f182e25an, 0x2d59f3b75810bfb1n, 0x35f58e4b8003c468n,
      0x886aa17dbce183b3n, 0x4c51f5e41604e66bn, 0x98a2f7d52c08d1d6n, 0xa101c9e0c08ca65cn,
      0x4007459a7a835589n, 0xcc5f7fcde21f4c64n, 0xa965e2b488768fe0n, 0x12d195bd82591f4an,
      0x2f4030a24aa0f29en, 0x56e44b0ddca7d09dn, 0x914433056daa50f3n, 0x37ec4d5e92b38947n,
      0xe31f4f6fa8bfbefan, 0x50cf1332ea6a07ecn, 0x6d5eb62d2293ea38n, 0x09e6c4d041a28125n,
      0x8fc316c68374fc5bn, 0x421e868f683318a6n, 0xe08463feb3575b4cn, 0x3821d1b1e5dcdf13n,
      0xed503c04d6884037n, 0xd35ab58a05994855n, 0x976f6b3a5b678782n, 0x6ec59abc397b0f8en,
      0x5929d7e2abc886c9n, 0xa53352cae4f13c02n, 0x89e84ef9b5b92b2an, 0x1761e113af7c2d8dn,
      0x28e9871975358d76n, 0xdc97296572f61e01n, 0x67235e6c78d98eabn, 0x3d91a51fc8f9edd4n,
      0x68eec2830fb6d8ffn, 0xfbb3329370acc523n, 0x062b583f36cdd771n, 0x15782206bdcc60a2n,
      0x16e30e97a6248514n, 0x79a47baf96072203n, 0xf7e582ed1c2b76c1n, 0xde8eea706046532en,
      0xaf4eba8bbebb5891n, 0x08642b5448fa29bcn, 0x24bf376719b23e94n, 0x231680dc2627417cn,
      0x0dd45ffa65df1b7bn, 0x1d1c0952f536491en, 0xff81a9b954d15f7dn, 0x992018512550794fn,
      0x71c050fbdefd0bbfn, 0xc18b203787c0571fn, 0x253dd8e310ea960dn, 0xeb7b643be0459746n,
      0x0219c31512b04d2fn, 0xc43b5499aae565d8n, 0xeaf98bbfe91d3fdfn, 0x3a3812a4f76c923cn,
      0x4dd31a601f5c4ef2n, 0xa8e70d30812e2779n, 0x800e8a29f41baa0fn, 0x1c9ee6d6fc6ee187n,
      0x5d1b4cc88fb51c97n, 0x610806534e1459dan, 0xf255f643310e4406n, 0xd2d85a0e0cc1e0ccn,
      0x0182ef840958a899n, 0x7e0dcc14a9925debn, 0x653a9d796a69c384n, 0x4e4836f104b4ab44n,
      0x4fcad9750dec03ddn, 0xcddd9049eb47e4fdn, 0x0e4f736b7e37fecdn, 0x4185aa1e73dbfd10n,
      0x725b7c6ac515ee09n, 0x8a736268ae51ce9cn, 0xc5b9bb1da3bdcd41n, 0x7bbdb8ba84b76f2cn,
      0xdabc715a443bc970n, 0xe29da0eba1e71663n, 0x935df0107f1a1ddcn, 0x608ae9d7474cf143n,
      0xd571edb533549f24n, 0xa0832664c9d40ec5n, 0xfd986aac46611252n, 0x4435deb05efecfd7n,
      0x0000000000000000n, 0x2cdb1c3351481728n, 0x94f447ab408f6234n, 0x45b7313457a6674en,
      0xb82f5b9811c7751cn, 0x8c583a57989c19edn, 0xdd15c6e17baeb698n, 0x696c2d0706ee7066n,
      0x3f88660ada49a0fbn, 0xf47eae7c07c39377n, 0x05b074ae2d2532c7n, 0xb3d05c5d42d5b916n,
      0x39a33e35ec84778an, 0x0fcd9cef776f5654n, 0xacd5961aa553bd27n, 0x5b3014f7b978cbe6n,
      0x347761cf895b6cf1n, 0xc622978cb85528f7n, 0xb7e2c77766a82348n, 0x77eb08c4e830dccen,
      0xb9adb41c189fdd85n, 0x114ab92c99b1fafcn, 0x26a6f4720b0273bbn, 0x1e8725c3eedeaca8n,
      0x2af0440c6785c059n, 0x04329b2a247d9a5en, 0xd7682ea021e4d20bn, 0x7c140f01bb2210c4n,
      0x96ed84be523f2f1bn, 0xca7427f2d4d29b15n, 0x47aef22145162a61n, 0xa72a91dff641712dn,
      0x5ab2fb73b020637fn, 0xcbf6c876dd8a338cn, 0x6311c5465ca414f5n, 0x07a9b7bb3f957fe8n,
      0xe72dd4458cc224a4n, 0x9d12837b012de311n, 0x843c1103d0663051n, 0x0a7de8415a4a6493n,
      0xd6eac12428bc7a92n, 0x9c906cff08754b88n, 0x7042bf7fd7a5a326n, 0xbd9f2f363ce247dbn,
      0xb66028f36ff08bd1n, 0x192e9278d14bd340n, 0x9f0b406e139dae3en, 0x1f05ca47e7860431n,
      0x85befe87d93e98c8n, 0x439c690b616bb03fn, 0xba36988d03773833n, 0x87a73d92cb8ed5e7n,
      0xaecc550fb7e3f008n, 0xc2100ca69c28b2a9n, 0x9abb34c03eb89cf9n, 0x49e1814a3b21d4acn,
      0xecd2d380dfd0e8aen, 0x296b689d7c6d25efn, 0x3c134a9bc1a1454dn, 0xcfc4535cf9f7a9d2n,
      0x557f679cc74f352bn, 0xb479ebe67d40c6fen, 0xf6676d691573de58n, 0x9e89afea1ac506a7n,
      0xd8a5b24f568b845fn, 0x48636ece32797c35n, 0xdf0c05f4691efbb7n, 0xe4b6f8d4972ac112n,
      0xfa31dd1779f46dban, 0xbf86ec232e520af4n, 0x3e0a898ed3110862n, 0x7a3f573e8defc7b5n,
      0x27241bf6025adb22n, 0x58ab3866a2902e50n, 0x3bbafd20fe343aa5n, 0x3045fae5ad26f6afn,
      0x2ec2df2643f85a07n, 0x22946f582f7fe9e5n, 0x366ea2da9beb21den, 0x4a7aaddb20c9311an,
      0xb1c99f485065f439n, 0xb04b70cc593d5ca0n, 0xab7c21a19ac6c2cfn, 0x33ded674b6ce1319n,
      0xce46bcd8f0af014bn, 0xdb3e9ede4d6361e9n, 0x7669e740e1687457n, 0x514dfcb6e332af75n
    ];
    for (let i = 0; i < 256; i++) IT[0][i] = IT0[i];

    // IT[1]
    const IT1 = [
      0x1f4f6fa8bfbefae3n, 0xf0440c6785c0592an, 0x1dc0b235baef42bcn, 0x22978cb85528f7c6n,
      0xcedad22ae6a1b0f1n, 0x180af5d23ceb73a3n, 0x946f582f7fe9e522n, 0xe44b0ddca7d09d56n,
      0x906cff08754b889cn, 0x9f2f363ce247dbbdn, 0xa1b1e87181263266n, 0x21d1b1e5dcdf1338n,
      0x31dd1779f46dbafan, 0x4b70cc593d5ca0b0n, 0xd719c73856ec9ff3n, 0x8725c3eedeaca81en,
      0x71edb533549f24d5n, 0x12837b012de3119dn, 0x3dd8e310ea960d25n, 0x29d7e2abc886c959n,
      0xb477090a2f90aabbn, 0x45fae5ad26f6af30n, 0x9ee6d6fc6ee1871cn, 0xbefe87d93e98c885n,
      0xe30e97a624851416n, 0xd6d027f8da4ac352n, 0xcc550fb7e3f008aen, 0x5ab58a05994855d3n,
      0x806059945df9215en, 0x82ef840958a89901n, 0x4ab92c99b1fafc11n, 0x281e026b442095f8n,
      0x62a72ef2f5da69e9n, 0x8b203787c0571fc1n, 0x4f736b7e37fecd0en, 0xab3866a2902e5058n,
      0x6ea2da9beb21de36n, 0xf447ab408f623494n, 0x235e6c78d98eab67n, 0x11c5465ca414f563n,
      0xd31a601f5c4ef24dn, 0xa2f7d52c08d1d698n, 0x85aa1e73dbfd1041n, 0xdc59a92bcb42a16cn,
      0x59f3b75810bfb12dn, 0xe2c77766a82348b7n, 0xb9bb1da3bdcd41c5n, 0x96e085b27ab85d7dn,
      0x99a34c86edb40e5cn, 0x66a489d5ff780457n, 0x95a6b8eff34fb983n, 0x7f679cc74f352b55n,
      0x7de8415a4a64930an, 0x9b2c911be8e5b603n, 0x4836f104b4ab444en, 0xdb1c33514817282cn,
      0x15c6e17baeb698ddn, 0xed84be523f2f1b96n, 0xe1814a3b21d4ac49n, 0x503c04d6884037edn,
      0x4c355623be0929f0n, 0x3b5499aae565d8c4n, 0x0a898ed31108623en, 0xb074ae2d2532c705n,
      0x028fdd9d0551b85fn, 0xf58e4b8003c46835n, 0x3352cae4f13c02a5n, 0x6c2d0706ee706669n,
      0x7c21a19ac6c2cfabn, 0x19c31512b04d2f02n, 0xa6f4720b0273bb26n, 0x05ca47e78604311fn,
      0x46bcd8f0af014bcen, 0x1e868f683318a642n, 0x5c39f0bf96bb8032n, 0x79ebe67d40c6feb4n,
      0xff07c55312cc0a0bn, 0xaef22145162a6147n, 0xc1991b1e71ade3d0n, 0xded674b6ce131933n,
      0x7aaddb20c9311a4an, 0x4dfcb6e332af7551n, 0x6de4e7c662d63ac8n, 0xbf376719b23e9424n,
      0x07459a7a83558940n, 0xac7dfcd8137bd918n, 0xdf1f947642b54592n, 0x17493ce6abe72082n,
      0xfc41f80e9b3beef5n, 0xe70d30812e2779a8n, 0xd993eecc4d469073n, 0x65e2b488768fe0a9n,
      0xd2d380dfd0e8aeecn, 0xe6c4d041a2812509n, 0x068c7aba0ff3d5e1n, 0x51f5e41604e66b4cn,
      0x41f9428a2c54c28en, 0x537a398b01b7d313n, 0x782206bdcc60a215n, 0x89afea1ac506a79en,
      0x8ae9d7474cf14360n, 0xf6c876dd8a338ccbn, 0x43769f1729057ad1n, 0x8dac4d3dcfa4ca20n,
      0xb7313457a6674e45n, 0x2018512550794f99n, 0xbb34c03eb89cf99an, 0xbafd20fe343aa53bn,
      0x03463d5d89f7e4fen, 0x42bf7fd7a5a32670n, 0x3f573e8defc7b57an, 0xadb41c189fdd85b9n,
      0xcad9750dec03dd4fn, 0x0f43c934970c5321n, 0x2f5b9811c7751cb8n, 0xd85a0e0cc1e0ccd2n,
      0xe048aafbad72f0e8n, 0xf18deca70966058bn, 0xdd9049eb47e4fdcdn, 0xa87e5bff19d9b4a6n,
      0x5df0107f1a1ddc93n, 0xd195bd82591f4a12n, 0x0c05f4691efbb7dfn, 0x8463feb3575b4ce0n,
      0x55f643310e4406f2n, 0xb6f8d4972ac112e4n, 0x4030a24aa0f29e2fn, 0xfd8818ce179db254n,
      0x3c1103d066305184n, 0x682ea021e4d20bd7n, 0x81a9b954d15f7dffn, 0x275dcb5fd32cc6d9n,
      0xfacd82b494c83b14n, 0x4433056daa50f391n, 0xe9871975358d7628n, 0xeac12428bc7a92d6n,
      0x1a85284f39bacbfcn, 0xf8425f299199834bn, 0x676d691573de58f6n, 0xd05c5d42d5b916b3n,
      0x8eea706046532eden, 0xfb046274186e67b5n, 0x134a9bc1a1454d3cn, 0x57799eac0b15beadn,
      0x241bf6025adb2227n, 0x72ab886edd68c02bn, 0x9ae571db6443eaa2n, 0xc050fbdefd0bbf71n,
      0xa5b24f568b845fd8n, 0xe84ef9b5b92b2a89n, 0x6f6b3a5b67878297n, 0xc6dc8164f2f86a90n,
      0x7eae7c07c39377f4n, 0x5eb62d2293ea386dn, 0x8c65adfd43029681n, 0x2dd4458cc224a4e7n,
      0xfece25939e6a56aan, 0xcd9cef776f56540fn, 0xa33e35ec84778a39n, 0xc2df2643f85a072en,
      0xbc715a443bc970dan, 0xa07808b10d806ec7n, 0x36988d03773833ban, 0x1680dc2627417c23n,
      0xcb1095cd60a581een, 0xbdb8ba84b76f2c7bn, 0x702455f3d8397874n, 0x35deb05efecfd744n,
      0x8f2390a0caf5727fn, 0xb1bd4eeda9949ba4n, 0x39db4437e034609bn, 0xe582ed1c2b76c1f7n,
      0xc4535cf9f7a9d2cfn, 0xb2fb73b020637f5an, 0x583a57989c19ed8cn, 0x25d216c2d67d7e86n,
      0x0806534e1459da61n, 0x6b689d7c6d25ef29n, 0x0dcc14a9925deb7en, 0xc99f485065f439b1n,
      0xa9b7bb3f957fe807n, 0x2a91dff641712da7n, 0x1c0952f536491e1dn, 0x75ee12145e3d496bn,
      0xf98bbfe91d3fdfean, 0x92e32295701a30c3n, 0x3e9ede4d6361e9dbn, 0x76a82f49d7caad95n,
      0x9da0eba1e71663e2n, 0x09cfb38e98ff86c0n, 0x9c690b616bb03f43n, 0xdad5d391c4b1748dn,
      0x3812a4f76c923c3an, 0x5f7fcde21f4c64ccn, 0x6aa17dbce183b388n, 0xeec2830fb6d8ff68n,
      0x736268ae51ce9c8an, 0xa47baf9607220379n, 0x543fa3f182e25a53n, 0x4eba8bbebb5891afn,
      0x2e9278d14bd34019n, 0x69e740e168745776n, 0x37516dc3fb9e6f1bn, 0xb3329370acc523fbn,
      0x3a9d796a69c38465n, 0x7761cf895b6cf134n, 0x0000000000000000n, 0x88660ada49a0fb3fn,
      0xb5bee9caa336f61an, 0x5b7c6ac515ee0972n, 0x52b3d94b8d118fb2n, 0x329b2a247d9a5e04n,
      0x0e8a29f41baa0f80n, 0x642b5448fa29bc08n, 0x7b643be0459746ebn, 0xd45ffa65df1b7b0dn,
      0xeb08c4e830dcce77n, 0xf2cbd1fa8091e175n, 0xf302313a0c37bdd4n, 0x91a51fc8f9edd43dn,
      0xef0b63cf3a7ea3c9n, 0xc316c68374fc5b8fn, 0x01c9e0c08ca65ca1n, 0x3417509e72698be5n,
      0x4775383023a7176fn, 0x636ece32797c3548n, 0x1b4cc88fb51c975dn, 0x140f01bb2210c47cn,
      0x7427f2d4d29b15can, 0xa73d92cb8ed5e787n, 0xc71561a47e5e3631n, 0xaaf186621c880cf9n,
      0x6028f36ff08bd1b6n, 0x97296572f61e01dcn, 0xc59abc397b0f8e6en, 0xec4d5e92b3894737n,
      0xb872fd63316b1d64n, 0xaf3bc1859a8c3de6n, 0x0403a7270aa26dben, 0x26942b9f5f8a9a78n,
      0x86ec232e520af4bfn, 0x49ff11c4380d18efn, 0xf701961d0695d06an, 0x56b07e6c87b3e20cn,
      0xd5961aa553bd27acn, 0x61e113af7c2d8d17n, 0x100ca69c28b2a9c2n, 0xcf1332ea6a07ec50n,
      0xc856a890e9526510n, 0x2b583f36cdd77106n, 0x932ac255fcbc6c62n, 0x0b406e139dae3e9fn,
      0x832664c9d40ec5a0n, 0x3014f7b978cbe65bn, 0x2c1da54c4e82f846n, 0x986aac46611252fdn
    ];
    for (let i = 0; i < 256; i++) IT[1][i] = IT1[i];

    // IT[2]
    const IT2 = [
      0x679cc74f352b557fn, 0x376719b23e9424bfn, 0xcc14a9925deb7e0dn, 0xb07e6c87b3e20c56n,
      0xa17dbce183b3886an, 0xee12145e3d496b75n, 0x406e139dae3e9f0bn, 0x942b9f5f8a9a7826n,
      0xb24f568b845fd8a5n, 0xdf2643f85a072ec2n, 0x8c7aba0ff3d5e106n, 0x0b63cf3a7ea3c9efn,
      0x12a4f76c923c3a38n, 0x8bbfe91d3fdfeaf9n, 0x9278d14bd340192en, 0xca47e78604311f05n,
      0x07c55312cc0a0bffn, 0xcfb38e98ff86c009n, 0x991b1e71ade3d0c1n, 0x16c68374fc5b8fc3n,
      0x39f0bf96bb80325cn, 0x3d92cb8ed5e787a7n, 0xac4d3dcfa4ca208dn, 0xfae5ad26f6af3045n,
      0x63feb3575b4ce084n, 0x28f36ff08bd1b660n, 0xc6e17baeb698dd15n, 0x84be523f2f1b96edn,
      0x3c04d6884037ed50n, 0xce25939e6a56aafen, 0xa34c86edb40e5c99n, 0xebe67d40c6feb479n,
      0x27f2d4d29b15ca74n, 0x6d691573de58f667n, 0x329370acc523fbb3n, 0x2c911be8e5b6039bn,
      0x871975358d7628e9n, 0x550fb7e3f008aeccn, 0x7e5bff19d9b4a6a8n, 0xf8d4972ac112e4b6n,
      0xd1b1e5dcdf133821n, 0xfcb6e332af75514dn, 0x1e026b442095f828n, 0x1f947642b54592dfn,
      0x5e6c78d98eab6723n, 0x17509e72698be534n, 0x2ac255fcbc6c6293n, 0x95bd82591f4a12d1n,
      0x799eac0b15bead57n, 0xf0107f1a1ddc935dn, 0xd674b6ce131933den, 0xf5e41604e66b4c51n,
      0x8818ce179db254fdn, 0x03a7270aa26dbe04n, 0x1c33514817282cdbn, 0x2f363ce247dbbd9fn,
      0xa72ef2f5da69e962n, 0x93eecc4d469073d9n, 0xb92c99b1fafc114an, 0x77090a2f90aabbb4n,
      0x0ca69c28b2a9c210n, 0xc9e0c08ca65ca101n, 0x4b0ddca7d09d56e4n, 0x988d03773833ba36n,
      0x06534e1459da6108n, 0x3a57989c19ed8c58n, 0x0952f536491e1d1cn, 0x0af5d23ceb73a318n,
      0x0d30812e2779a8e7n, 0xd7e2abc886c95929n, 0xa51fc8f9edd43d91n, 0x690b616bb03f439cn,
      0x516dc3fb9e6f1b37n, 0xa489d5ff78045766n, 0x52cae4f13c02a533n, 0x4cc88fb51c975d1bn,
      0x459a7a8355894007n, 0x9d796a69c384653an, 0x313457a6674e45b7n, 0x4a9bc1a1454d3c13n,
      0x6268ae51ce9c8a73n, 0xfe87d93e98c885ben, 0xff11c4380d18ef49n, 0x8deca70966058bf1n,
      0xdeb05efecfd74435n, 0xd027f8da4ac352d6n, 0xf186621c880cf9aan, 0x43c934970c53210fn,
      0xbee9caa336f61ab5n, 0x56a890e9526510c8n, 0xe8415a4a64930a7dn, 0xe32295701a30c392n,
      0x3e35ec84778a39a3n, 0x4f6fa8bfbefae31fn, 0x5dcb5fd32cc6d927n, 0x9f485065f439b1c9n,
      0x1095cd60a581eecbn, 0x978cb85528f7c622n, 0x7baf9607220379a4n, 0xd216c2d67d7e8625n,
      0xe4e7c662d63ac86dn, 0xb62d2293ea386d5en, 0x8a29f41baa0f800en, 0x5ffa65df1b7b0dd4n,
      0x61cf895b6cf13477n, 0xa6b8eff34fb98395n, 0x814a3b21d4ac49e1n, 0xaddb20c9311a4a7an,
      0x74ae2d2532c705b0n, 0x30a24aa0f29e2f40n, 0x91dff641712da72an, 0x9049eb47e4fdcdddn,
      0x493ce6abe7208217n, 0x36f104b4ab444e48n, 0xf22145162a6147aen, 0x5c5d42d5b916b3d0n,
      0xf7d52c08d1d698a2n, 0x7a398b01b7d31353n, 0x6cff08754b889c90n, 0x14f7b978cbe65b30n,
      0xc4d041a2812509e6n, 0xe085b27ab85d7d96n, 0xc0b235baef42bc1dn, 0x868f683318a6421en,
      0xea706046532ede8en, 0x4ef9b5b92b2a89e8n, 0xdc8164f2f86a90c6n, 0x2455f3d839787470n,
      0x5499aae565d8c43bn, 0x59a92bcb42a16cdcn, 0xa9b954d15f7dff81n, 0xae7c07c39377f47en,
      0x01961d0695d06af7n, 0xdb4437e034609b39n, 0x3bc1859a8c3de6afn, 0xaa1e73dbfd104185n,
      0x7dfcd8137bd918acn, 0x80dc2627417c2316n, 0xd9750dec03dd4fcan, 0xc5465ca414f56311n,
      0x203787c0571fc18bn, 0xd5d391c4b1748ddan, 0xc2830fb6d8ff68een, 0xbcd8f0af014bce46n,
      0xa0eba1e71663e29dn, 0xfb73b020637f5ab2n, 0x7c6ac515ee09725bn, 0x0000000000000000n,
      0xc876dd8a338ccbf6n, 0x9cef776f56540fcdn, 0x47ab408f623494f4n, 0xcbd1fa8091e175f2n,
      0x9abc397b0f8e6ec5n, 0xb58a05994855d35an, 0x4d5e92b3894737ecn, 0x961aa553bd27acd5n,
      0xc31512b04d2f0219n, 0xe6d6fc6ee1871c9en, 0xe2b488768fe0a965n, 0xb3d94b8d118fb252n,
      0x440c6785c0592af0n, 0x25c3eedeaca81e87n, 0x583f36cdd771062bn, 0x2d0706ee7066696cn,
      0x425f299199834bf8n, 0xfd20fe343aa53bban, 0xf643310e4406f255n, 0xdad22ae6a1b0f1cen,
      0x1da54c4e82f8462cn, 0x355623be0929f04cn, 0x769f1729057ad143n, 0xbd4eeda9949ba4b1n,
      0xd8e310ea960d253dn, 0x736b7e37fecd0e4fn, 0x65adfd430296818cn, 0xb8ba84b76f2c7bbdn,
      0x9b2a247d9a5e0432n, 0xc77766a82348b7e2n, 0x08c4e830dcce77ebn, 0x0e97a624851416e3n,
      0x898ed31108623e0an, 0xe571db6443eaa29an, 0x573e8defc7b57a3fn, 0x21a19ac6c2cfab7cn,
      0x70cc593d5ca0b04bn, 0x2664c9d40ec5a083n, 0x296572f61e01dc97n, 0x85284f39bacbfc1an,
      0x715a443bc970dabcn, 0xef840958a8990182n, 0xcd82b494c83b14fan, 0x48aafbad72f0e8e0n,
      0xe9d7474cf143608an, 0x2390a0caf5727f8fn, 0xb7bb3f957fe807a9n, 0x82ed1c2b76c1f7e5n,
      0xbb1da3bdcd41c5b9n, 0x72fd63316b1d64b8n, 0x7808b10d806ec7a0n, 0x837b012de3119d12n,
      0x689d7c6d25ef296bn, 0x02313a0c37bdd4f3n, 0x1103d0663051843cn, 0xab886edd68c02b72n,
      0x6b3a5b678782976fn, 0xe113af7c2d8d1761n, 0x6aac46611252fd98n, 0x50fbdefd0bbf71c0n,
      0x2ea021e4d20bd768n, 0x5a0e0cc1e0ccd2d8n, 0x34c03eb89cf99abbn, 0xb41c189fdd85b9adn,
      0x9ede4d6361e9db3en, 0xafea1ac506a79e89n, 0x463d5d89f7e4fe03n, 0x18512550794f9920n,
      0x41f80e9b3beef5fcn, 0xa82f49d7caad9576n, 0x0f01bb2210c47c14n, 0xec232e520af4bf86n,
      0x1bf6025adb222724n, 0xa2da9beb21de366en, 0xedb533549f24d571n, 0x643be0459746eb7bn,
      0xbf7fd7a5a3267042n, 0x046274186e67b5fbn, 0x8e4b8003c46835f5n, 0x1332ea6a07ec50cfn,
      0xd380dfd0e8aeecd2n, 0x6f582f7fe9e52294n, 0xf9428a2c54c28e41n, 0x3fa3f182e25a5354n,
      0x535cf9f7a9d2cfc4n, 0x660ada49a0fb3f88n, 0x33056daa50f39144n, 0x8fdd9d0551b85f02n,
      0x19c73856ec9ff3d7n, 0xb1e87181263266a1n, 0x1561a47e5e3631c7n, 0xd4458cc224a4e72dn,
      0xe740e16874577669n, 0xc12428bc7a92d6ean, 0x3866a2902e5058abn, 0x1a601f5c4ef24dd3n,
      0x6059945df9215e80n, 0x05f4691efbb7df0cn, 0x5b9811c7751cb82fn, 0x2b5448fa29bc0864n,
      0xba8bbebb5891af4en, 0xf4720b0273bb26a6n, 0xdd1779f46dbafa31n, 0x6ece32797c354863n,
      0x7fcde21f4c64cc5fn, 0x2206bdcc60a21578n, 0x75383023a7176f47n, 0xf3b75810bfb12d59n
    ];
    for (let i = 0; i < 256; i++) IT[2][i] = IT2[i];

    // IT[3]
    const IT3 = [
      0x03d0663051843c11n, 0xbfe91d3fdfeaf98bn, 0xf80e9b3beef5fc41n, 0xe5ad26f6af3045fan,
      0x5a443bc970dabc71n, 0x7b012de3119d1283n, 0x82b494c83b14facdn, 0x750dec03dd4fcad9n,
      0x090a2f90aabbb477n, 0xb6e332af75514dfcn, 0xadfd430296818c65n, 0xfd63316b1d64b872n,
      0x3d5d89f7e4fe0346n, 0xd7474cf143608ae9n, 0x7e6c87b3e20c56b0n, 0x601f5c4ef24dd31an,
      0x40e16874577669e7n, 0x4437e034609b39dbn, 0xe7c662d63ac86de4n, 0xaf9607220379a47bn,
      0xea1ac506a79e89afn, 0xd8f0af014bce46bcn, 0x7fd7a5a3267042bfn, 0x9f1729057ad14376n,
      0x1c189fdd85b9adb4n, 0x87d93e98c885befen, 0x57989c19ed8c583an, 0xa4f76c923c3a3812n,
      0x2a247d9a5e04329bn, 0xc03eb89cf99abb34n, 0xf6025adb2227241bn, 0xa890e9526510c856n,
      0x06bdcc60a2157822n, 0xc73856ec9ff3d719n, 0xcae4f13c02a53352n, 0xd6fc6ee1871c9ee6n,
      0xf0bf96bb80325c39n, 0x13af7c2d8d1761e1n, 0x3be0459746eb7b64n, 0x99aae565d8c43b54n,
      0x95cd60a581eecb10n, 0x68ae51ce9c8a7362n, 0xcde21f4c64cc5f7fn, 0xdc2627417c231680n,
      0x428a2c54c28e41f9n, 0x76dd8a338ccbf6c8n, 0xb8eff34fb98395a6n, 0xa69c28b2a9c2100cn,
      0x08b10d806ec7a078n, 0xc55312cc0a0bff07n, 0x886edd68c02b72abn, 0xdd9d0551b85f028fn,
      0x1e73dbfd104185aan, 0x911be8e5b6039b2cn, 0x30812e2779a8e70dn, 0x3a5b678782976f6bn,
      0x20fe343aa53bbafdn, 0xb954d15f7dff81a9n, 0x9a7a835589400745n, 0x1fc8f9edd43d91a5n,
      0x0e0cc1e0ccd2d85an, 0xbb3f957fe807a9b7n, 0xc3eedeaca81e8725n, 0x66a2902e5058ab38n,
      0xff08754b889c906cn, 0xfeb3575b4ce08463n, 0x107f1a1ddc935df0n, 0x25939e6a56aafecen,
      0xa92bcb42a16cdc59n, 0x32ea6a07ec50cf13n, 0x947642b54592df1fn, 0x1779f46dbafa31ddn,
      0x5623be0929f04c35n, 0xf2d4d29b15ca7427n, 0x59945df9215e8060n, 0x9370acc523fbb332n,
      0xb05efecfd74435den, 0x71db6443eaa29ae5n, 0xe2abc886c95929d7n, 0x458cc224a4e72dd4n,
      0xce32797c3548636en, 0x1aa553bd27acd596n, 0x4a3b21d4ac49e181n, 0x284f39bacbfc1a85n,
      0xd94b8d118fb252b3n, 0xb235baef42bc1dc0n, 0x2643f85a072ec2dfn, 0x8bbebb5891af4eban,
      0x89d5ff78045766a4n, 0xeecc4d469073d993n, 0x0b616bb03f439c69n, 0xe41604e66b4c51f5n,
      0x16c2d67d7e8625d2n, 0x6c78d98eab67235en, 0x9d7c6d25ef296b68n, 0x64c9d40ec5a08326n,
      0x2ef2f5da69e962a7n, 0xfa65df1b7b0dd45fn, 0x12145e3d496b75een, 0xfcd8137bd918ac7dn,
      0x52f536491e1d1c09n, 0xe67d40c6feb479ebn, 0x2145162a6147aef2n, 0x29f41baa0f800e8an,
      0x0000000000000000n, 0x840958a8990182efn, 0xc88fb51c975d1b4cn, 0xc68374fc5b8fc316n,
      0x5d42d5b916b3d05cn, 0x7dbce183b3886aa1n, 0x512550794f992018n, 0xe17baeb698dd15c6n,
      0x43310e4406f255f6n, 0x6dc3fb9e6f1b3751n, 0x86621c880cf9aaf1n, 0xbc397b0f8e6ec59an,
      0x415a4a64930a7de8n, 0x04d6884037ed503cn, 0xe9caa336f61ab5ben, 0x0ada49a0fb3f8866n,
      0x55f3d83978747024n, 0x3ce6abe720821749n, 0xf5d23ceb73a3180an, 0xa24aa0f29e2f4030n,
      0x582f7fe9e522946fn, 0x7aba0ff3d5e1068cn, 0x313a0c37bdd4f302n, 0x3787c0571fc18b20n,
      0x5cf9f7a9d2cfc453n, 0xbe523f2f1b96ed84n, 0x85b27ab85d7d96e0n, 0x0706ee7066696c2dn,
      0x961d0695d06af701n, 0x1b1e71ade3d0c199n, 0xc255fcbc6c62932an, 0x398b01b7d313537an,
      0xcc593d5ca0b04b70n, 0x5f299199834bf842n, 0x80dfd0e8aeecd2d3n, 0x9eac0b15bead5779n,
      0xef776f56540fcd9cn, 0x2f49d7caad9576a8n, 0x2c99b1fafc114ab9n, 0x8d03773833ba3698n,
      0x720b0273bb26a6f4n, 0x18ce179db254fd88n, 0x8f683318a6421e86n, 0x4f568b845fd8a5b2n,
      0x8ed31108623e0a89n, 0xd22ae6a1b0f1cedan, 0x74b6ce131933ded6n, 0x97a624851416e30en,
      0x6e139dae3e9f0b40n, 0xa7270aa26dbe0403n, 0x5448fa29bc08642bn, 0xe310ea960d253dd8n,
      0x706046532ede8eean, 0x485065f439b1c99fn, 0x6b7e37fecd0e4f73n, 0xfbdefd0bbf71c050n,
      0xd391c4b1748ddad5n, 0xa021e4d20bd7682en, 0xab408f623494f447n, 0x5bff19d9b4a6a87en,
      0xb1e5dcdf133821d1n, 0x026b442095f8281en, 0xdff641712da72a91n, 0x11c4380d18ef49ffn,
      0xae2d2532c705b074n, 0xc1859a8c3de6af3bn, 0x4b8003c46835f58en, 0x92cb8ed5e787a73dn,
      0xcb5fd32cc6d9275dn, 0x8cb85528f7c62297n, 0x9bc1a1454d3c134an, 0x056daa50f3914433n,
      0xf4691efbb7df0c05n, 0xd1fa8091e175f2cbn, 0x7c07c39377f47eaen, 0x14a9925deb7e0dccn,
      0xcf895b6cf1347761n, 0x0fb7e3f008aecc55n, 0x8a05994855d35ab5n, 0xf104b4ab444e4836n,
      0x691573de58f6676dn, 0x4eeda9949ba4b1bdn, 0x2428bc7a92d6eac1n, 0xb75810bfb12d59f3n,
      0x63cf3a7ea3c9ef0bn, 0x6274186e67b5fb04n, 0x1512b04d2f0219c3n, 0xe87181263266a1b1n,
      0x1975358d7628e987n, 0x534e1459da610806n, 0x47e78604311f05can, 0xd4972ac112e4b6f8n,
      0x33514817282cdb1cn, 0x90a0caf5727f8f23n, 0x3e8defc7b57a3f57n, 0x3f36cdd771062b58n,
      0x796a69c384653a9dn, 0x465ca414f56311c5n, 0x5e92b3894737ec4dn, 0x9811c7751cb82f5bn,
      0xd041a2812509e6c4n, 0x49eb47e4fdcddd90n, 0x78d14bd340192e92n, 0xf9b5b92b2a89e84en,
      0x61a47e5e3631c715n, 0x509e72698be53417n, 0xb533549f24d571edn, 0x27f8da4ac352d6d0n,
      0x6572f61e01dc9729n, 0xde4d6361e9db3e9en, 0x3457a6674e45b731n, 0xa54c4e82f8462c1dn,
      0xbd82591f4a12d195n, 0x830fb6d8ff68eec2n, 0x383023a7176f4775n, 0x7766a82348b7e2c7n,
      0x0c6785c0592af044n, 0xba84b76f2c7bbdb8n, 0xe0c08ca65ca101c9n, 0xeba1e71663e29da0n,
      0xd52c08d1d698a2f7n, 0xc4e830dcce77eb08n, 0xda9beb21de366ea2n, 0xa3f182e25a53543fn,
      0xac46611252fd986an, 0xb38e98ff86c009cfn, 0xf36ff08bd1b66028n, 0xdb20c9311a4a7aadn,
      0xa19ac6c2cfab7c21n, 0x6ac515ee09725b7cn, 0x4c86edb40e5c99a3n, 0x363ce247dbbd9f2fn,
      0x8164f2f86a90c6dcn, 0x35ec84778a39a33en, 0xb488768fe0a965e2n, 0x73b020637f5ab2fbn,
      0x232e520af4bf86ecn, 0x6fa8bfbefae31f4fn, 0xeca70966058bf18dn, 0x1da3bdcd41c5b9bbn,
      0x9cc74f352b557f67n, 0x4d3dcfa4ca208dacn, 0x2b9f5f8a9a782694n, 0xaafbad72f0e8e048n,
      0xc934970c53210f43n, 0xed1c2b76c1f7e582n, 0x01bb2210c47c140fn, 0x0ddca7d09d56e44bn,
      0x2d2293ea386d5eb6n, 0xf7b978cbe65b3014n, 0x6719b23e9424bf37n, 0x2295701a30c392e3n
    ];
    for (let i = 0; i < 256; i++) IT[3][i] = IT3[i];

    // IT[4]
    const IT4 = [
      0x9f5f8a9a7826942bn, 0x34970c53210f43c9n, 0x9d0551b85f028fddn, 0xb494c83b14facd82n,
      0x6edd68c02b72ab88n, 0xff19d9b4a6a87e5bn, 0xdb6443eaa29ae571n, 0x1be8e5b6039b2c91n,
      0x5fd32cc6d9275dcbn, 0x90e9526510c856a8n, 0xb27ab85d7d96e085n, 0xa47e5e3631c71561n,
      0xf3d8397874702455n, 0xfbad72f0e8e048aan, 0x37e034609b39db44n, 0xfa8091e175f2cbd1n,
      0xcaa336f61ab5bee9n, 0xeff34fb98395a6b8n, 0x63316b1d64b872fdn, 0xba0ff3d5e1068c7an,
      0xcd60a581eecb1095n, 0x35baef42bc1dc0b2n, 0x23be0929f04c3556n, 0x4b8d118fb252b3d9n,
      0xd8137bd918ac7dfcn, 0x0a2f90aabbb47709n, 0xc2d67d7e8625d216n, 0x7181263266a1b1e8n,
      0x3023a7176f477538n, 0x7642b54592df1f94n, 0xf2f5da69e962a72en, 0xa70966058bf18decn,
      0xc662d63ac86de4e7n, 0x939e6a56aafece25n, 0x86edb40e5c99a34cn, 0xf8da4ac352d6d027n,
      0x145e3d496b75ee12n, 0xce179db254fd8818n, 0xd23ceb73a3180af5n, 0x270aa26dbe0403a7n,
      0x5d89f7e4fe03463dn, 0x2ae6a1b0f1cedad2n, 0x1729057ad143769fn, 0xb10d806ec7a07808n,
      0x4f39bacbfc1a8528n, 0xeda9949ba4b1bd4en, 0x5312cc0a0bff07c5n, 0xc4380d18ef49ff11n,
      0x95701a30c392e322n, 0xa0caf5727f8f2390n, 0x55fcbc6c62932ac2n, 0xcf3a7ea3c9ef0b63n,
      0x621c880cf9aaf186n, 0xfd430296818c65adn, 0xbf96bb80325c39f0n, 0x6c87b3e20c56b07en,
      0x299199834bf8425fn, 0x74186e67b5fb0462n, 0x4c4e82f8462c1da5n, 0x64f2f86a90c6dc81n,
      0x6b442095f8281e02n, 0x1d0695d06af70196n, 0xd5ff78045766a489n, 0x3856ec9ff3d719c7n,
      0xac0b15bead57799en, 0xc3fb9e6f1b37516dn, 0x8e98ff86c009cfb3n, 0x49d7caad9576a82fn,
      0x859a8c3de6af3bc1n, 0x3dcfa4ca208dac4dn, 0x91c4b1748ddad5d3n, 0x8a2c54c28e41f942n,
      0x2bcb42a16cdc59a9n, 0x9e72698be5341750n, 0x1e71ade3d0c1991bn, 0xe6abe7208217493cn,
      0x3a0c37bdd4f30231n, 0x945df9215e806059n, 0xcc4d469073d993een, 0x0e9b3beef5fc41f8n,
      0x8b01b7d313537a39n, 0xf182e25a53543fa3n, 0x5810bfb12d59f3b7n, 0x8003c46835f58e4bn,
      0xbce183b3886aa17dn, 0x1604e66b4c51f5e4n, 0x2c08d1d698a2f7d5n, 0xc08ca65ca101c9e0n,
      0x7a8355894007459an, 0xe21f4c64cc5f7fcdn, 0x88768fe0a965e2b4n, 0x82591f4a12d195bdn,
      0x4aa0f29e2f4030a2n, 0xdca7d09d56e44b0dn, 0x6daa50f391443305n, 0x92b3894737ec4d5en,
      0xa8bfbefae31f4f6fn, 0xea6a07ec50cf1332n, 0x2293ea386d5eb62dn, 0x41a2812509e6c4d0n,
      0x8374fc5b8fc316c6n, 0x683318a6421e868fn, 0xb3575b4ce08463fen, 0xe5dcdf133821d1b1n,
      0xd6884037ed503c04n, 0x05994855d35ab58an, 0x5b678782976f6b3an, 0x397b0f8e6ec59abcn,
      0xabc886c95929d7e2n, 0xe4f13c02a53352can, 0xb5b92b2a89e84ef9n, 0xaf7c2d8d1761e113n,
      0x75358d7628e98719n, 0x72f61e01dc972965n, 0x78d98eab67235e6cn, 0xc8f9edd43d91a51fn,
      0x0fb6d8ff68eec283n, 0x70acc523fbb33293n, 0x36cdd771062b583fn, 0xbdcc60a215782206n,
      0xa624851416e30e97n, 0x9607220379a47bafn, 0x1c2b76c1f7e582edn, 0x6046532ede8eea70n,
      0xbebb5891af4eba8bn, 0x48fa29bc08642b54n, 0x19b23e9424bf3767n, 0x2627417c231680dcn,
      0x65df1b7b0dd45ffan, 0xf536491e1d1c0952n, 0x54d15f7dff81a9b9n, 0x2550794f99201851n,
      0xdefd0bbf71c050fbn, 0x87c0571fc18b2037n, 0x10ea960d253dd8e3n, 0xe0459746eb7b643bn,
      0x12b04d2f0219c315n, 0xaae565d8c43b5499n, 0xe91d3fdfeaf98bbfn, 0xf76c923c3a3812a4n,
      0x1f5c4ef24dd31a60n, 0x812e2779a8e70d30n, 0xf41baa0f800e8a29n, 0xfc6ee1871c9ee6d6n,
      0x8fb51c975d1b4cc8n, 0x4e1459da61080653n, 0x310e4406f255f643n, 0x0cc1e0ccd2d85a0en,
      0x0958a8990182ef84n, 0xa9925deb7e0dcc14n, 0x6a69c384653a9d79n, 0x04b4ab444e4836f1n,
      0x0dec03dd4fcad975n, 0xeb47e4fdcddd9049n, 0x7e37fecd0e4f736bn, 0x73dbfd104185aa1en,
      0xc515ee09725b7c6an, 0xae51ce9c8a736268n, 0xa3bdcd41c5b9bb1dn, 0x84b76f2c7bbdb8ban,
      0x443bc970dabc715an, 0xa1e71663e29da0ebn, 0x7f1a1ddc935df010n, 0x474cf143608ae9d7n,
      0x33549f24d571edb5n, 0xc9d40ec5a0832664n, 0x46611252fd986aacn, 0x5efecfd74435deb0n,
      0x0000000000000000n, 0x514817282cdb1c33n, 0x408f623494f447abn, 0x57a6674e45b73134n,
      0x11c7751cb82f5b98n, 0x989c19ed8c583a57n, 0x7baeb698dd15c6e1n, 0x06ee7066696c2d07n,
      0xda49a0fb3f88660an, 0x07c39377f47eae7cn, 0x2d2532c705b074aen, 0x42d5b916b3d05c5dn,
      0xec84778a39a33e35n, 0x776f56540fcd9cefn, 0xa553bd27acd5961an, 0xb978cbe65b3014f7n,
      0x895b6cf1347761cfn, 0xb85528f7c622978cn, 0x66a82348b7e2c777n, 0xe830dcce77eb08c4n,
      0x189fdd85b9adb41cn, 0x99b1fafc114ab92cn, 0x0b0273bb26a6f472n, 0xeedeaca81e8725c3n,
      0x6785c0592af0440cn, 0x247d9a5e04329b2an, 0x21e4d20bd7682ea0n, 0xbb2210c47c140f01n,
      0x523f2f1b96ed84ben, 0xd4d29b15ca7427f2n, 0x45162a6147aef221n, 0xf641712da72a91dfn,
      0xb020637f5ab2fb73n, 0xdd8a338ccbf6c876n, 0x5ca414f56311c546n, 0x3f957fe807a9b7bbn,
      0x8cc224a4e72dd445n, 0x012de3119d12837bn, 0xd0663051843c1103n, 0x5a4a64930a7de841n,
      0x28bc7a92d6eac124n, 0x08754b889c906cffn, 0xd7a5a3267042bf7fn, 0x3ce247dbbd9f2f36n,
      0x6ff08bd1b66028f3n, 0xd14bd340192e9278n, 0x139dae3e9f0b406en, 0xe78604311f05ca47n,
      0xd93e98c885befe87n, 0x616bb03f439c690bn, 0x03773833ba36988dn, 0xcb8ed5e787a73d92n,
      0xb7e3f008aecc550fn, 0x9c28b2a9c2100ca6n, 0x3eb89cf99abb34c0n, 0x3b21d4ac49e1814an,
      0xdfd0e8aeecd2d380n, 0x7c6d25ef296b689dn, 0xc1a1454d3c134a9bn, 0xf9f7a9d2cfc4535cn,
      0xc74f352b557f679cn, 0x7d40c6feb479ebe6n, 0x1573de58f6676d69n, 0x1ac506a79e89afean,
      0x568b845fd8a5b24fn, 0x32797c3548636ecen, 0x691efbb7df0c05f4n, 0x972ac112e4b6f8d4n,
      0x79f46dbafa31dd17n, 0x2e520af4bf86ec23n, 0xd31108623e0a898en, 0x8defc7b57a3f573en,
      0x025adb2227241bf6n, 0xa2902e5058ab3866n, 0xfe343aa53bbafd20n, 0xad26f6af3045fae5n,
      0x43f85a072ec2df26n, 0x2f7fe9e522946f58n, 0x9beb21de366ea2dan, 0x20c9311a4a7aaddbn,
      0x5065f439b1c99f48n, 0x593d5ca0b04b70ccn, 0x9ac6c2cfab7c21a1n, 0xb6ce131933ded674n,
      0xf0af014bce46bcd8n, 0x4d6361e9db3e9eden, 0xe16874577669e740n, 0xe332af75514dfcb6n
    ];
    for (let i = 0; i < 256; i++) IT[4][i] = IT4[i];

    // IT[5]
    const IT5 = [
      0xbfbefae31f4f6fa8n, 0x85c0592af0440c67n, 0xbaef42bc1dc0b235n, 0x5528f7c622978cb8n,
      0xe6a1b0f1cedad22an, 0x3ceb73a3180af5d2n, 0x7fe9e522946f582fn, 0xa7d09d56e44b0ddcn,
      0x754b889c906cff08n, 0xe247dbbd9f2f363cn, 0x81263266a1b1e871n, 0xdcdf133821d1b1e5n,
      0xf46dbafa31dd1779n, 0x3d5ca0b04b70cc59n, 0x56ec9ff3d719c738n, 0xdeaca81e8725c3een,
      0x549f24d571edb533n, 0x2de3119d12837b01n, 0xea960d253dd8e310n, 0xc886c95929d7e2abn,
      0x2f90aabbb477090an, 0x26f6af3045fae5adn, 0x6ee1871c9ee6d6fcn, 0x3e98c885befe87d9n,
      0x24851416e30e97a6n, 0xda4ac352d6d027f8n, 0xe3f008aecc550fb7n, 0x994855d35ab58a05n,
      0x5df9215e80605994n, 0x58a8990182ef8409n, 0xb1fafc114ab92c99n, 0x442095f8281e026bn,
      0xf5da69e962a72ef2n, 0xc0571fc18b203787n, 0x37fecd0e4f736b7en, 0x902e5058ab3866a2n,
      0xeb21de366ea2da9bn, 0x8f623494f447ab40n, 0xd98eab67235e6c78n, 0xa414f56311c5465cn,
      0x5c4ef24dd31a601fn, 0x08d1d698a2f7d52cn, 0xdbfd104185aa1e73n, 0xcb42a16cdc59a92bn,
      0x10bfb12d59f3b758n, 0xa82348b7e2c77766n, 0xbdcd41c5b9bb1da3n, 0x7ab85d7d96e085b2n,
      0xedb40e5c99a34c86n, 0xff78045766a489d5n, 0xf34fb98395a6b8efn, 0x4f352b557f679cc7n,
      0x4a64930a7de8415an, 0xe8e5b6039b2c911bn, 0xb4ab444e4836f104n, 0x4817282cdb1c3351n,
      0xaeb698dd15c6e17bn, 0x3f2f1b96ed84be52n, 0x21d4ac49e1814a3bn, 0x884037ed503c04d6n,
      0xbe0929f04c355623n, 0xe565d8c43b5499aan, 0x1108623e0a898ed3n, 0x2532c705b074ae2dn,
      0x0551b85f028fdd9dn, 0x03c46835f58e4b80n, 0xf13c02a53352cae4n, 0xee7066696c2d0706n,
      0xc6c2cfab7c21a19an, 0xb04d2f0219c31512n, 0x0273bb26a6f4720bn, 0x8604311f05ca47e7n,
      0xaf014bce46bcd8f0n, 0x3318a6421e868f68n, 0x96bb80325c39f0bfn, 0x40c6feb479ebe67dn,
      0x12cc0a0bff07c553n, 0x162a6147aef22145n, 0x71ade3d0c1991b1en, 0xce131933ded674b6n,
      0xc9311a4a7aaddb20n, 0x32af75514dfcb6e3n, 0x62d63ac86de4e7c6n, 0xb23e9424bf376719n,
      0x8355894007459a7an, 0x137bd918ac7dfcd8n, 0x42b54592df1f9476n, 0xabe7208217493ce6n,
      0x9b3beef5fc41f80en, 0x2e2779a8e70d3081n, 0x4d469073d993eeccn, 0x768fe0a965e2b488n,
      0xd0e8aeecd2d380dfn, 0xa2812509e6c4d041n, 0x0ff3d5e1068c7aban, 0x04e66b4c51f5e416n,
      0x2c54c28e41f9428an, 0x01b7d313537a398bn, 0xcc60a215782206bdn, 0xc506a79e89afea1an,
      0x4cf143608ae9d747n, 0x8a338ccbf6c876ddn, 0x29057ad143769f17n, 0xcfa4ca208dac4d3dn,
      0xa6674e45b7313457n, 0x50794f9920185125n, 0xb89cf99abb34c03en, 0x343aa53bbafd20fen,
      0x89f7e4fe03463d5dn, 0xa5a3267042bf7fd7n, 0xefc7b57a3f573e8dn, 0x9fdd85b9adb41c18n,
      0xec03dd4fcad9750dn, 0x970c53210f43c934n, 0xc7751cb82f5b9811n, 0xc1e0ccd2d85a0e0cn,
      0xad72f0e8e048aafbn, 0x0966058bf18deca7n, 0x47e4fdcddd9049ebn, 0x19d9b4a6a87e5bffn,
      0x1a1ddc935df0107fn, 0x591f4a12d195bd82n, 0x1efbb7df0c05f469n, 0x575b4ce08463feb3n,
      0x0e4406f255f64331n, 0x2ac112e4b6f8d497n, 0xa0f29e2f4030a24an, 0x179db254fd8818cen,
      0x663051843c1103d0n, 0xe4d20bd7682ea021n, 0xd15f7dff81a9b954n, 0xd32cc6d9275dcb5fn,
      0x94c83b14facd82b4n, 0xaa50f3914433056dn, 0x358d7628e9871975n, 0xbc7a92d6eac12428n,
      0x39bacbfc1a85284fn, 0x9199834bf8425f29n, 0x73de58f6676d6915n, 0xd5b916b3d05c5d42n,
      0x46532ede8eea7060n, 0x186e67b5fb046274n, 0xa1454d3c134a9bc1n, 0x0b15bead57799eacn,
      0x5adb2227241bf602n, 0xdd68c02b72ab886en, 0x6443eaa29ae571dbn, 0xfd0bbf71c050fbden,
      0x8b845fd8a5b24f56n, 0xb92b2a89e84ef9b5n, 0x678782976f6b3a5bn, 0xf2f86a90c6dc8164n,
      0xc39377f47eae7c07n, 0x93ea386d5eb62d22n, 0x430296818c65adfdn, 0xc224a4e72dd4458cn,
      0x9e6a56aafece2593n, 0x6f56540fcd9cef77n, 0x84778a39a33e35ecn, 0xf85a072ec2df2643n,
      0x3bc970dabc715a44n, 0x0d806ec7a07808b1n, 0x773833ba36988d03n, 0x27417c231680dc26n,
      0x60a581eecb1095cdn, 0xb76f2c7bbdb8ba84n, 0xd8397874702455f3n, 0xfecfd74435deb05en,
      0xcaf5727f8f2390a0n, 0xa9949ba4b1bd4eedn, 0xe034609b39db4437n, 0x2b76c1f7e582ed1cn,
      0xf7a9d2cfc4535cf9n, 0x20637f5ab2fb73b0n, 0x9c19ed8c583a5798n, 0xd67d7e8625d216c2n,
      0x1459da610806534en, 0x6d25ef296b689d7cn, 0x925deb7e0dcc14a9n, 0x65f439b1c99f4850n,
      0x957fe807a9b7bb3fn, 0x41712da72a91dff6n, 0x36491e1d1c0952f5n, 0x5e3d496b75ee1214n,
      0x1d3fdfeaf98bbfe9n, 0x701a30c392e32295n, 0x6361e9db3e9ede4dn, 0xd7caad9576a82f49n,
      0xe71663e29da0eba1n, 0x98ff86c009cfb38en, 0x6bb03f439c690b61n, 0xc4b1748ddad5d391n,
      0x6c923c3a3812a4f7n, 0x1f4c64cc5f7fcde2n, 0xe183b3886aa17dbcn, 0xb6d8ff68eec2830fn,
      0x51ce9c8a736268aen, 0x07220379a47baf96n, 0x82e25a53543fa3f1n, 0xbb5891af4eba8bben,
      0x4bd340192e9278d1n, 0x6874577669e740e1n, 0xfb9e6f1b37516dc3n, 0xacc523fbb3329370n,
      0x69c384653a9d796an, 0x5b6cf1347761cf89n, 0x0000000000000000n, 0x49a0fb3f88660adan,
      0xa336f61ab5bee9can, 0x15ee09725b7c6ac5n, 0x8d118fb252b3d94bn, 0x7d9a5e04329b2a24n,
      0x1baa0f800e8a29f4n, 0xfa29bc08642b5448n, 0x459746eb7b643be0n, 0xdf1b7b0dd45ffa65n,
      0x30dcce77eb08c4e8n, 0x8091e175f2cbd1fan, 0x0c37bdd4f302313an, 0xf9edd43d91a51fc8n,
      0x3a7ea3c9ef0b63cfn, 0x74fc5b8fc316c683n, 0x8ca65ca101c9e0c0n, 0x72698be53417509en,
      0x23a7176f47753830n, 0x797c3548636ece32n, 0xb51c975d1b4cc88fn, 0x2210c47c140f01bbn,
      0xd29b15ca7427f2d4n, 0x8ed5e787a73d92cbn, 0x7e5e3631c71561a4n, 0x1c880cf9aaf18662n,
      0xf08bd1b66028f36fn, 0xf61e01dc97296572n, 0x7b0f8e6ec59abc39n, 0xb3894737ec4d5e92n,
      0x316b1d64b872fd63n, 0x9a8c3de6af3bc185n, 0x0aa26dbe0403a727n, 0x5f8a9a7826942b9fn,
      0x520af4bf86ec232en, 0x380d18ef49ff11c4n, 0x0695d06af701961dn, 0x87b3e20c56b07e6cn,
      0x53bd27acd5961aa5n, 0x7c2d8d1761e113afn, 0x28b2a9c2100ca69cn, 0x6a07ec50cf1332ean,
      0xe9526510c856a890n, 0xcdd771062b583f36n, 0xfcbc6c62932ac255n, 0x9dae3e9f0b406e13n,
      0xd40ec5a0832664c9n, 0x78cbe65b3014f7b9n, 0x4e82f8462c1da54cn, 0x611252fd986aac46n
    ];
    for (let i = 0; i < 256; i++) IT[5][i] = IT5[i];

    // IT[6]
    const IT6 = [
      0x352b557f679cc74fn, 0x3e9424bf376719b2n, 0x5deb7e0dcc14a992n, 0xb3e20c56b07e6c87n,
      0x83b3886aa17dbce1n, 0x3d496b75ee12145en, 0xae3e9f0b406e139dn, 0x8a9a7826942b9f5fn,
      0x845fd8a5b24f568bn, 0x5a072ec2df2643f8n, 0xf3d5e1068c7aba0fn, 0x7ea3c9ef0b63cf3an,
      0x923c3a3812a4f76cn, 0x3fdfeaf98bbfe91dn, 0xd340192e9278d14bn, 0x04311f05ca47e786n,
      0xcc0a0bff07c55312n, 0xff86c009cfb38e98n, 0xade3d0c1991b1e71n, 0xfc5b8fc316c68374n,
      0xbb80325c39f0bf96n, 0xd5e787a73d92cb8en, 0xa4ca208dac4d3dcfn, 0xf6af3045fae5ad26n,
      0x5b4ce08463feb357n, 0x8bd1b66028f36ff0n, 0xb698dd15c6e17baen, 0x2f1b96ed84be523fn,
      0x4037ed503c04d688n, 0x6a56aafece25939en, 0xb40e5c99a34c86edn, 0xc6feb479ebe67d40n,
      0x9b15ca7427f2d4d2n, 0xde58f6676d691573n, 0xc523fbb3329370acn, 0xe5b6039b2c911be8n,
      0x8d7628e987197535n, 0xf008aecc550fb7e3n, 0xd9b4a6a87e5bff19n, 0xc112e4b6f8d4972an,
      0xdf133821d1b1e5dcn, 0xaf75514dfcb6e332n, 0x2095f8281e026b44n, 0xb54592df1f947642n,
      0x8eab67235e6c78d9n, 0x698be53417509e72n, 0xbc6c62932ac255fcn, 0x1f4a12d195bd8259n,
      0x15bead57799eac0bn, 0x1ddc935df0107f1an, 0x131933ded674b6cen, 0xe66b4c51f5e41604n,
      0x9db254fd8818ce17n, 0xa26dbe0403a7270an, 0x17282cdb1c335148n, 0x47dbbd9f2f363ce2n,
      0xda69e962a72ef2f5n, 0x469073d993eecc4dn, 0xfafc114ab92c99b1n, 0x90aabbb477090a2fn,
      0xb2a9c2100ca69c28n, 0xa65ca101c9e0c08cn, 0xd09d56e44b0ddca7n, 0x3833ba36988d0377n,
      0x59da610806534e14n, 0x19ed8c583a57989cn, 0x491e1d1c0952f536n, 0xeb73a3180af5d23cn,
      0x2779a8e70d30812en, 0x86c95929d7e2abc8n, 0xedd43d91a51fc8f9n, 0xb03f439c690b616bn,
      0x9e6f1b37516dc3fbn, 0x78045766a489d5ffn, 0x3c02a53352cae4f1n, 0x1c975d1b4cc88fb5n,
      0x55894007459a7a83n, 0xc384653a9d796a69n, 0x674e45b7313457a6n, 0x454d3c134a9bc1a1n,
      0xce9c8a736268ae51n, 0x98c885befe87d93en, 0x0d18ef49ff11c438n, 0x66058bf18deca709n,
      0xcfd74435deb05efen, 0x4ac352d6d027f8dan, 0x880cf9aaf186621cn, 0x0c53210f43c93497n,
      0x36f61ab5bee9caa3n, 0x526510c856a890e9n, 0x64930a7de8415a4an, 0x1a30c392e3229570n,
      0x778a39a33e35ec84n, 0xbefae31f4f6fa8bfn, 0x2cc6d9275dcb5fd3n, 0xf439b1c99f485065n,
      0xa581eecb1095cd60n, 0x28f7c622978cb855n, 0x220379a47baf9607n, 0x7d7e8625d216c2d6n,
      0xd63ac86de4e7c662n, 0xea386d5eb62d2293n, 0xaa0f800e8a29f41bn, 0x1b7b0dd45ffa65dfn,
      0x6cf1347761cf895bn, 0x4fb98395a6b8eff3n, 0xd4ac49e1814a3b21n, 0x311a4a7aaddb20c9n,
      0x32c705b074ae2d25n, 0xf29e2f4030a24aa0n, 0x712da72a91dff641n, 0xe4fdcddd9049eb47n,
      0xe7208217493ce6abn, 0xab444e4836f104b4n, 0x2a6147aef2214516n, 0xb916b3d05c5d42d5n,
      0xd1d698a2f7d52c08n, 0xb7d313537a398b01n, 0x4b889c906cff0875n, 0xcbe65b3014f7b978n,
      0x812509e6c4d041a2n, 0xb85d7d96e085b27an, 0xef42bc1dc0b235ban, 0x18a6421e868f6833n,
      0x532ede8eea706046n, 0x2b2a89e84ef9b5b9n, 0xf86a90c6dc8164f2n, 0x397874702455f3d8n,
      0x65d8c43b5499aae5n, 0x42a16cdc59a92bcbn, 0x5f7dff81a9b954d1n, 0x9377f47eae7c07c3n,
      0x95d06af701961d06n, 0x34609b39db4437e0n, 0x8c3de6af3bc1859an, 0xfd104185aa1e73dbn,
      0x7bd918ac7dfcd813n, 0x417c231680dc2627n, 0x03dd4fcad9750decn, 0x14f56311c5465ca4n,
      0x571fc18b203787c0n, 0xb1748ddad5d391c4n, 0xd8ff68eec2830fb6n, 0x014bce46bcd8f0afn,
      0x1663e29da0eba1e7n, 0x637f5ab2fb73b020n, 0xee09725b7c6ac515n, 0x0000000000000000n,
      0x338ccbf6c876dd8an, 0x56540fcd9cef776fn, 0x623494f447ab408fn, 0x91e175f2cbd1fa80n,
      0x0f8e6ec59abc397bn, 0x4855d35ab58a0599n, 0x894737ec4d5e92b3n, 0xbd27acd5961aa553n,
      0x4d2f0219c31512b0n, 0xe1871c9ee6d6fc6en, 0x8fe0a965e2b48876n, 0x118fb252b3d94b8dn,
      0xc0592af0440c6785n, 0xaca81e8725c3eeden, 0xd771062b583f36cdn, 0x7066696c2d0706een,
      0x99834bf8425f2991n, 0x3aa53bbafd20fe34n, 0x4406f255f643310en, 0xa1b0f1cedad22ae6n,
      0x82f8462c1da54c4en, 0x0929f04c355623ben, 0x057ad143769f1729n, 0x949ba4b1bd4eeda9n,
      0x960d253dd8e310ean, 0xfecd0e4f736b7e37n, 0x0296818c65adfd43n, 0x6f2c7bbdb8ba84b7n,
      0x9a5e04329b2a247dn, 0x2348b7e2c77766a8n, 0xdcce77eb08c4e830n, 0x851416e30e97a624n,
      0x08623e0a898ed311n, 0x43eaa29ae571db64n, 0xc7b57a3f573e8defn, 0xc2cfab7c21a19ac6n,
      0x5ca0b04b70cc593dn, 0x0ec5a0832664c9d4n, 0x1e01dc97296572f6n, 0xbacbfc1a85284f39n,
      0xc970dabc715a443bn, 0xa8990182ef840958n, 0xc83b14facd82b494n, 0x72f0e8e048aafbadn,
      0xf143608ae9d7474cn, 0xf5727f8f2390a0can, 0x7fe807a9b7bb3f95n, 0x76c1f7e582ed1c2bn,
      0xcd41c5b9bb1da3bdn, 0x6b1d64b872fd6331n, 0x806ec7a07808b10dn, 0xe3119d12837b012dn,
      0x25ef296b689d7c6dn, 0x37bdd4f302313a0cn, 0x3051843c1103d066n, 0x68c02b72ab886eddn,
      0x8782976f6b3a5b67n, 0x2d8d1761e113af7cn, 0x1252fd986aac4661n, 0x0bbf71c050fbdefdn,
      0xd20bd7682ea021e4n, 0xe0ccd2d85a0e0cc1n, 0x9cf99abb34c03eb8n, 0xdd85b9adb41c189fn,
      0x61e9db3e9ede4d63n, 0x06a79e89afea1ac5n, 0xf7e4fe03463d5d89n, 0x794f992018512550n,
      0x3beef5fc41f80e9bn, 0xcaad9576a82f49d7n, 0x10c47c140f01bb22n, 0x0af4bf86ec232e52n,
      0xdb2227241bf6025an, 0x21de366ea2da9bebn, 0x9f24d571edb53354n, 0x9746eb7b643be045n,
      0xa3267042bf7fd7a5n, 0x6e67b5fb04627418n, 0xc46835f58e4b8003n, 0x07ec50cf1332ea6an,
      0xe8aeecd2d380dfd0n, 0xe9e522946f582f7fn, 0x54c28e41f9428a2cn, 0xe25a53543fa3f182n,
      0xa9d2cfc4535cf9f7n, 0xa0fb3f88660ada49n, 0x50f3914433056daan, 0x51b85f028fdd9d05n,
      0xec9ff3d719c73856n, 0x263266a1b1e87181n, 0x5e3631c71561a47en, 0x24a4e72dd4458cc2n,
      0x74577669e740e168n, 0x7a92d6eac12428bcn, 0x2e5058ab3866a290n, 0x4ef24dd31a601f5cn,
      0xf9215e806059945dn, 0xfbb7df0c05f4691en, 0x751cb82f5b9811c7n, 0x29bc08642b5448fan,
      0x5891af4eba8bbebbn, 0x73bb26a6f4720b02n, 0x6dbafa31dd1779f4n, 0x7c3548636ece3279n,
      0x4c64cc5f7fcde21fn, 0x60a215782206bdccn, 0xa7176f4775383023n, 0xbfb12d59f3b75810n
    ];
    for (let i = 0; i < 256; i++) IT[6][i] = IT6[i];

    // IT[7]
    const IT7 = [
      0x51843c1103d06630n, 0xdfeaf98bbfe91d3fn, 0xeef5fc41f80e9b3bn, 0xaf3045fae5ad26f6n,
      0x70dabc715a443bc9n, 0x119d12837b012de3n, 0x3b14facd82b494c8n, 0xdd4fcad9750dec03n,
      0xaabbb477090a2f90n, 0x75514dfcb6e332afn, 0x96818c65adfd4302n, 0x1d64b872fd63316bn,
      0xe4fe03463d5d89f7n, 0x43608ae9d7474cf1n, 0xe20c56b07e6c87b3n, 0xf24dd31a601f5c4en,
      0x577669e740e16874n, 0x609b39db4437e034n, 0x3ac86de4e7c662d6n, 0x0379a47baf960722n,
      0xa79e89afea1ac506n, 0x4bce46bcd8f0af01n, 0x267042bf7fd7a5a3n, 0x7ad143769f172905n,
      0x85b9adb41c189fddn, 0xc885befe87d93e98n, 0xed8c583a57989c19n, 0x3c3a3812a4f76c92n,
      0x5e04329b2a247d9an, 0xf99abb34c03eb89cn, 0x2227241bf6025adbn, 0x6510c856a890e952n,
      0xa215782206bdcc60n, 0x9ff3d719c73856ecn, 0x02a53352cae4f13cn, 0x871c9ee6d6fc6ee1n,
      0x80325c39f0bf96bbn, 0x8d1761e113af7c2dn, 0x46eb7b643be04597n, 0xd8c43b5499aae565n,
      0x81eecb1095cd60a5n, 0x9c8a736268ae51cen, 0x64cc5f7fcde21f4cn, 0x7c231680dc262741n,
      0xc28e41f9428a2c54n, 0x8ccbf6c876dd8a33n, 0xb98395a6b8eff34fn, 0xa9c2100ca69c28b2n,
      0x6ec7a07808b10d80n, 0x0a0bff07c55312ccn, 0xc02b72ab886edd68n, 0xb85f028fdd9d0551n,
      0x104185aa1e73dbfdn, 0xb6039b2c911be8e5n, 0x79a8e70d30812e27n, 0x82976f6b3a5b6787n,
      0xa53bbafd20fe343an, 0x7dff81a9b954d15fn, 0x894007459a7a8355n, 0xd43d91a51fc8f9edn,
      0xccd2d85a0e0cc1e0n, 0xe807a9b7bb3f957fn, 0xa81e8725c3eedeacn, 0x5058ab3866a2902en,
      0x889c906cff08754bn, 0x4ce08463feb3575bn, 0xdc935df0107f1a1dn, 0x56aafece25939e6an,
      0xa16cdc59a92bcb42n, 0xec50cf1332ea6a07n, 0x4592df1f947642b5n, 0xbafa31dd1779f46dn,
      0x29f04c355623be09n, 0x15ca7427f2d4d29bn, 0x215e806059945df9n, 0x23fbb3329370acc5n,
      0xd74435deb05efecfn, 0xeaa29ae571db6443n, 0xc95929d7e2abc886n, 0xa4e72dd4458cc224n,
      0x3548636ece32797cn, 0x27acd5961aa553bdn, 0xac49e1814a3b21d4n, 0xcbfc1a85284f39ban,
      0x8fb252b3d94b8d11n, 0x42bc1dc0b235baefn, 0x072ec2df2643f85an, 0x91af4eba8bbebb58n,
      0x045766a489d5ff78n, 0x9073d993eecc4d46n, 0x3f439c690b616bb0n, 0x6b4c51f5e41604e6n,
      0x7e8625d216c2d67dn, 0xab67235e6c78d98en, 0xef296b689d7c6d25n, 0xc5a0832664c9d40en,
      0x69e962a72ef2f5dan, 0x7b0dd45ffa65df1bn, 0x496b75ee12145e3dn, 0xd918ac7dfcd8137bn,
      0x1e1d1c0952f53649n, 0xfeb479ebe67d40c6n, 0x6147aef22145162an, 0x0f800e8a29f41baan,
      0x0000000000000000n, 0x990182ef840958a8n, 0x975d1b4cc88fb51cn, 0x5b8fc316c68374fcn,
      0x16b3d05c5d42d5b9n, 0xb3886aa17dbce183n, 0x4f99201851255079n, 0x98dd15c6e17baeb6n,
      0x06f255f643310e44n, 0x6f1b37516dc3fb9en, 0x0cf9aaf186621c88n, 0x8e6ec59abc397b0fn,
      0x930a7de8415a4a64n, 0x37ed503c04d68840n, 0xf61ab5bee9caa336n, 0xfb3f88660ada49a0n,
      0x7874702455f3d839n, 0x208217493ce6abe7n, 0x73a3180af5d23cebn, 0x9e2f4030a24aa0f2n,
      0xe522946f582f7fe9n, 0xd5e1068c7aba0ff3n, 0xbdd4f302313a0c37n, 0x1fc18b203787c057n,
      0xd2cfc4535cf9f7a9n, 0x1b96ed84be523f2fn, 0x5d7d96e085b27ab8n, 0x66696c2d0706ee70n,
      0xd06af701961d0695n, 0xe3d0c1991b1e71adn, 0x6c62932ac255fcbcn, 0xd313537a398b01b7n,
      0xa0b04b70cc593d5cn, 0x834bf8425f299199n, 0xaeecd2d380dfd0e8n, 0xbead57799eac0b15n,
      0x540fcd9cef776f56n, 0xad9576a82f49d7can, 0xfc114ab92c99b1fan, 0x33ba36988d037738n,
      0xbb26a6f4720b0273n, 0xb254fd8818ce179dn, 0xa6421e868f683318n, 0x5fd8a5b24f568b84n,
      0x623e0a898ed31108n, 0xb0f1cedad22ae6a1n, 0x1933ded674b6ce13n, 0x1416e30e97a62485n,
      0x3e9f0b406e139daen, 0x6dbe0403a7270aa2n, 0xbc08642b5448fa29n, 0x0d253dd8e310ea96n,
      0x2ede8eea70604653n, 0x39b1c99f485065f4n, 0xcd0e4f736b7e37fen, 0xbf71c050fbdefd0bn,
      0x748ddad5d391c4b1n, 0x0bd7682ea021e4d2n, 0x3494f447ab408f62n, 0xb4a6a87e5bff19d9n,
      0x133821d1b1e5dcdfn, 0x95f8281e026b4420n, 0x2da72a91dff64171n, 0x18ef49ff11c4380dn,
      0xc705b074ae2d2532n, 0x3de6af3bc1859a8cn, 0x6835f58e4b8003c4n, 0xe787a73d92cb8ed5n,
      0xc6d9275dcb5fd32cn, 0xf7c622978cb85528n, 0x4d3c134a9bc1a145n, 0xf3914433056daa50n,
      0xb7df0c05f4691efbn, 0xe175f2cbd1fa8091n, 0x77f47eae7c07c393n, 0xeb7e0dcc14a9925dn,
      0xf1347761cf895b6cn, 0x08aecc550fb7e3f0n, 0x55d35ab58a059948n, 0x444e4836f104b4abn,
      0x58f6676d691573den, 0x9ba4b1bd4eeda994n, 0x92d6eac12428bc7an, 0xb12d59f3b75810bfn,
      0xa3c9ef0b63cf3a7en, 0x67b5fb046274186en, 0x2f0219c31512b04dn, 0x3266a1b1e8718126n,
      0x7628e9871975358dn, 0xda610806534e1459n, 0x311f05ca47e78604n, 0x12e4b6f8d4972ac1n,
      0x282cdb1c33514817n, 0x727f8f2390a0caf5n, 0xb57a3f573e8defc7n, 0x71062b583f36cdd7n,
      0x84653a9d796a69c3n, 0xf56311c5465ca414n, 0x4737ec4d5e92b389n, 0x1cb82f5b9811c775n,
      0x2509e6c4d041a281n, 0xfdcddd9049eb47e4n, 0x40192e9278d14bd3n, 0x2a89e84ef9b5b92bn,
      0x3631c71561a47e5en, 0x8be53417509e7269n, 0x24d571edb533549fn, 0xc352d6d027f8da4an,
      0x01dc97296572f61en, 0xe9db3e9ede4d6361n, 0x4e45b7313457a667n, 0xf8462c1da54c4e82n,
      0x4a12d195bd82591fn, 0xff68eec2830fb6d8n, 0x176f4775383023a7n, 0x48b7e2c77766a823n,
      0x592af0440c6785c0n, 0x2c7bbdb8ba84b76fn, 0x5ca101c9e0c08ca6n, 0x63e29da0eba1e716n,
      0xd698a2f7d52c08d1n, 0xce77eb08c4e830dcn, 0xde366ea2da9beb21n, 0x5a53543fa3f182e2n,
      0x52fd986aac466112n, 0x86c009cfb38e98ffn, 0xd1b66028f36ff08bn, 0x1a4a7aaddb20c931n,
      0xcfab7c21a19ac6c2n, 0x09725b7c6ac515een, 0x0e5c99a34c86edb4n, 0xdbbd9f2f363ce247n,
      0x6a90c6dc8164f2f8n, 0x8a39a33e35ec8477n, 0xe0a965e2b488768fn, 0x7f5ab2fb73b02063n,
      0xf4bf86ec232e520an, 0xfae31f4f6fa8bfben, 0x058bf18deca70966n, 0x41c5b9bb1da3bdcdn,
      0x2b557f679cc74f35n, 0xca208dac4d3dcfa4n, 0x9a7826942b9f5f8an, 0xf0e8e048aafbad72n,
      0x53210f43c934970cn, 0xc1f7e582ed1c2b76n, 0xc47c140f01bb2210n, 0x9d56e44b0ddca7d0n,
      0x386d5eb62d2293ean, 0xe65b3014f7b978cbn, 0x9424bf376719b23en, 0x30c392e32295701an
    ];
    for (let i = 0; i < 256; i++) IT[7][i] = IT7[i];
  }

  // ===== KALYNA HELPER FUNCTIONS (Crypto++ kalyna.cpp) =====

  // MakeOddKey: Rotate key bytes for odd rounds (Crypto++ line 44-85)
  // For NB=2 (128-bit): U=16, V=7
  function MakeOddKey(evenkey) {
    const evenBytes = new Array(16);
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 8; j++) {
        evenBytes[i * 8 + j] = Number((evenkey[i] >> BigInt(j * 8)) & 0xFFn);
      }
    }

    const oddBytes = new Array(16);
    for (let i = 0; i < 9; i++) {
      oddBytes[i] = evenBytes[i + 7];
    }
    for (let i = 0; i < 7; i++) {
      oddBytes[i + 9] = evenBytes[i];
    }

    const oddkey = new Array(2);
    for (let i = 0; i < 2; i++) {
      let word = 0n;
      for (let j = 0; j < 8; j++) {
        word |= BigInt(oddBytes[i * 8 + j]) << BigInt(j * 8);
      }
      oddkey[i] = word;
    }
    return oddkey;
  }

  // AddKey: Modular addition (Crypto++ line 111-129)
  function AddKey(x, k) {
    const y = new Array(2);
    y[0] = (x[0] + k[0]) & 0xFFFFFFFFFFFFFFFFn;
    y[1] = (x[1] + k[1]) & 0xFFFFFFFFFFFFFFFFn;
    return y;
  }

  // SubKey: Modular subtraction (Crypto++ line 132-150)
  function SubKey(x, k) {
    const y = new Array(2);
    y[0] = (x[0] - k[0]) & 0xFFFFFFFFFFFFFFFFn;
    y[1] = (x[1] - k[1]) & 0xFFFFFFFFFFFFFFFFn;
    return y;
  }

  // AddConstant: Add constant to all words (Crypto++ line 153-171)
  function AddConstant(src, constant) {
    const dst = new Array(2);
    dst[0] = (src[0] + constant) & 0xFFFFFFFFFFFFFFFFn;
    dst[1] = (src[1] + constant) & 0xFFFFFFFFFFFFFFFFn;
    return dst;
  }

  // G0128: T-table transformation WITHOUT key (Crypto++ line 173-179)
  function G0128(x) {
    const y = new Array(2);
    y[0] = T[0][Number(x[0] & 0xFFn)] ^
           T[1][Number((x[0] >> 8n) & 0xFFn)] ^
           T[2][Number((x[0] >> 16n) & 0xFFn)] ^
           T[3][Number((x[0] >> 24n) & 0xFFn)] ^
           T[4][Number((x[1] >> 32n) & 0xFFn)] ^
           T[5][Number((x[1] >> 40n) & 0xFFn)] ^
           T[6][Number((x[1] >> 48n) & 0xFFn)] ^
           T[7][Number((x[1] >> 56n) & 0xFFn)];

    y[1] = T[0][Number(x[1] & 0xFFn)] ^
           T[1][Number((x[1] >> 8n) & 0xFFn)] ^
           T[2][Number((x[1] >> 16n) & 0xFFn)] ^
           T[3][Number((x[1] >> 24n) & 0xFFn)] ^
           T[4][Number((x[0] >> 32n) & 0xFFn)] ^
           T[5][Number((x[0] >> 40n) & 0xFFn)] ^
           T[6][Number((x[0] >> 48n) & 0xFFn)] ^
           T[7][Number((x[0] >> 56n) & 0xFFn)];

    return y;
  }

  // G128: T-table transformation with key XOR (Crypto++ line 373-379)
  function G128(x, k) {
    const y = new Array(2);
    y[0] = k[0] ^
           T[0][Number(x[0] & 0xFFn)] ^
           T[1][Number((x[0] >> 8n) & 0xFFn)] ^
           T[2][Number((x[0] >> 16n) & 0xFFn)] ^
           T[3][Number((x[0] >> 24n) & 0xFFn)] ^
           T[4][Number((x[1] >> 32n) & 0xFFn)] ^
           T[5][Number((x[1] >> 40n) & 0xFFn)] ^
           T[6][Number((x[1] >> 48n) & 0xFFn)] ^
           T[7][Number((x[1] >> 56n) & 0xFFn)];

    y[1] = k[1] ^
           T[0][Number(x[1] & 0xFFn)] ^
           T[1][Number((x[1] >> 8n) & 0xFFn)] ^
           T[2][Number((x[1] >> 16n) & 0xFFn)] ^
           T[3][Number((x[1] >> 24n) & 0xFFn)] ^
           T[4][Number((x[0] >> 32n) & 0xFFn)] ^
           T[5][Number((x[0] >> 40n) & 0xFFn)] ^
           T[6][Number((x[0] >> 48n) & 0xFFn)] ^
           T[7][Number((x[0] >> 56n) & 0xFFn)];

    return y;
  }

  // GL128: T-table transformation with key addition (Crypto++ line 213-219)
  function GL128(x, k) {
    const y = new Array(2);
    y[0] = (k[0] + (
           T[0][Number(x[0] & 0xFFn)] ^
           T[1][Number((x[0] >> 8n) & 0xFFn)] ^
           T[2][Number((x[0] >> 16n) & 0xFFn)] ^
           T[3][Number((x[0] >> 24n) & 0xFFn)] ^
           T[4][Number((x[1] >> 32n) & 0xFFn)] ^
           T[5][Number((x[1] >> 40n) & 0xFFn)] ^
           T[6][Number((x[1] >> 48n) & 0xFFn)] ^
           T[7][Number((x[1] >> 56n) & 0xFFn)])) & 0xFFFFFFFFFFFFFFFFn;

    y[1] = (k[1] + (
           T[0][Number(x[1] & 0xFFn)] ^
           T[1][Number((x[1] >> 8n) & 0xFFn)] ^
           T[2][Number((x[1] >> 16n) & 0xFFn)] ^
           T[3][Number((x[1] >> 24n) & 0xFFn)] ^
           T[4][Number((x[0] >> 32n) & 0xFFn)] ^
           T[5][Number((x[0] >> 40n) & 0xFFn)] ^
           T[6][Number((x[0] >> 48n) & 0xFFn)] ^
           T[7][Number((x[0] >> 56n) & 0xFFn)])) & 0xFFFFFFFFFFFFFFFFn;

    return y;
  }

  // IMC128: Inverse MixColumns (Crypto++ line 253-259)
  // IT tables pre-apply IS, so we pass through S-box here
  // Result: IT[S[byte]] = IMDS * IS[S[byte]] = IMDS * byte (since IS[S[x]] = x)
  function IMC128(x) {
    const y = new Array(2);
    y[0] = IT[0][S[0][Number(x[0] & 0xFFn)]] ^
           IT[1][S[1][Number((x[0] >> 8n) & 0xFFn)]] ^
           IT[2][S[2][Number((x[0] >> 16n) & 0xFFn)]] ^
           IT[3][S[3][Number((x[0] >> 24n) & 0xFFn)]] ^
           IT[4][S[0][Number((x[0] >> 32n) & 0xFFn)]] ^
           IT[5][S[1][Number((x[0] >> 40n) & 0xFFn)]] ^
           IT[6][S[2][Number((x[0] >> 48n) & 0xFFn)]] ^
           IT[7][S[3][Number((x[0] >> 56n) & 0xFFn)]];

    y[1] = IT[0][S[0][Number(x[1] & 0xFFn)]] ^
           IT[1][S[1][Number((x[1] >> 8n) & 0xFFn)]] ^
           IT[2][S[2][Number((x[1] >> 16n) & 0xFFn)]] ^
           IT[3][S[3][Number((x[1] >> 24n) & 0xFFn)]] ^
           IT[4][S[0][Number((x[1] >> 32n) & 0xFFn)]] ^
           IT[5][S[1][Number((x[1] >> 40n) & 0xFFn)]] ^
           IT[6][S[2][Number((x[1] >> 48n) & 0xFFn)]] ^
           IT[7][S[3][Number((x[1] >> 56n) & 0xFFn)]];

    return y;
  }

  // IG128: Inverse G with key XOR (Crypto++ line 293-299)
  function IG128(x, k) {
    const y = new Array(2);
    y[0] = k[0] ^
           IT[0][Number(x[0] & 0xFFn)] ^
           IT[1][Number((x[0] >> 8n) & 0xFFn)] ^
           IT[2][Number((x[0] >> 16n) & 0xFFn)] ^
           IT[3][Number((x[0] >> 24n) & 0xFFn)] ^
           IT[4][Number((x[1] >> 32n) & 0xFFn)] ^
           IT[5][Number((x[1] >> 40n) & 0xFFn)] ^
           IT[6][Number((x[1] >> 48n) & 0xFFn)] ^
           IT[7][Number((x[1] >> 56n) & 0xFFn)];

    y[1] = k[1] ^
           IT[0][Number(x[1] & 0xFFn)] ^
           IT[1][Number((x[1] >> 8n) & 0xFFn)] ^
           IT[2][Number((x[1] >> 16n) & 0xFFn)] ^
           IT[3][Number((x[1] >> 24n) & 0xFFn)] ^
           IT[4][Number((x[0] >> 32n) & 0xFFn)] ^
           IT[5][Number((x[0] >> 40n) & 0xFFn)] ^
           IT[6][Number((x[0] >> 48n) & 0xFFn)] ^
           IT[7][Number((x[0] >> 56n) & 0xFFn)];

    return y;
  }

  // IGL128: Inverse GL with key subtraction (Crypto++ line 333-339)
  // CRITICAL: Use XOR (^) not OR (|) for packing bytes - exact Crypto++ match
  function IGL128(x, k) {
    const y = new Array(2);

    // Pack inverse S-box bytes with XOR, then subtract key (Crypto++ line 335-336)
    // CRITICAL: Parentheses ensure all XORs complete before subtraction
    y[0] = ((BigInt(IS[0][Number(x[0] & 0xFFn)]) ^
             (BigInt(IS[1][Number((x[0] >> 8n) & 0xFFn)]) << 8n) ^
             (BigInt(IS[2][Number((x[0] >> 16n) & 0xFFn)]) << 16n) ^
             (BigInt(IS[3][Number((x[0] >> 24n) & 0xFFn)]) << 24n) ^
             (BigInt(IS[0][Number((x[1] >> 32n) & 0xFFn)]) << 32n) ^
             (BigInt(IS[1][Number((x[1] >> 40n) & 0xFFn)]) << 40n) ^
             (BigInt(IS[2][Number((x[1] >> 48n) & 0xFFn)]) << 48n) ^
             (BigInt(IS[3][Number((x[1] >> 56n) & 0xFFn)]) << 56n)) -
            k[0]) & 0xFFFFFFFFFFFFFFFFn;

    y[1] = ((BigInt(IS[0][Number(x[1] & 0xFFn)]) ^
             (BigInt(IS[1][Number((x[1] >> 8n) & 0xFFn)]) << 8n) ^
             (BigInt(IS[2][Number((x[1] >> 16n) & 0xFFn)]) << 16n) ^
             (BigInt(IS[3][Number((x[1] >> 24n) & 0xFFn)]) << 24n) ^
             (BigInt(IS[0][Number((x[0] >> 32n) & 0xFFn)]) << 32n) ^
             (BigInt(IS[1][Number((x[0] >> 40n) & 0xFFn)]) << 40n) ^
             (BigInt(IS[2][Number((x[0] >> 48n) & 0xFFn)]) << 48n) ^
             (BigInt(IS[3][Number((x[0] >> 56n) & 0xFFn)]) << 56n)) -
            k[1]) & 0xFFFFFFFFFFFFFFFFn;

    return y;
  }

  // ===== KALYNA CIPHER IMPLEMENTATION =====

  class KalynaAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      initializeTTables();

      this.name = "Kalyna";
      this.description = "Ukrainian national encryption standard (DSTU 7624:2014) - exact Crypto++ port with bit-perfect test vector validation.";
      this.inventor = "Roman Oliynykov, Ivan Gorbenko, et al.";
      this.year = 2014;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.UA;

      this.SupportedKeySizes = [
        new KeySize(16, 16, 0),
        new KeySize(32, 32, 0)
      ];
      this.SupportedBlockSizes = [
        new KeySize(16, 16, 0)
      ];

      this.documentation = [
        new LinkItem("DSTU 7624:2014 Official Paper", "https://eprint.iacr.org/2015/650.pdf"),
        new LinkItem("Official Reference Implementation", "https://github.com/Roman-Oliynykov/Kalyna-reference"),
        new LinkItem("Crypto++ Implementation", "https://www.cryptopp.com/wiki/Kalyna")
      ];

      this.references = [
        new LinkItem("Ukrainian Standard DSTU 7624:2014", "https://eprint.iacr.org/2015/650"),
        new LinkItem("Crypto++ kalynatab.cpp", "https://github.com/weidai11/cryptopp/blob/master/kalynatab.cpp")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Educational Implementation",
          "This is an educational implementation and should not be used in production systems.",
          "Use certified cryptographic libraries for production applications."
        )
      ];

      this.tests = [
        {
          text: "DSTU 7624:2014 Kalyna-128/128 (ECB Mode)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/kalyna.txt",
          input: OpCodes.Hex8ToBytes("101112131415161718191A1B1C1D1E1F"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("81BF1C7D779BAC20E1C9EA39B4D2AD06")
        },
        {
          text: "DSTU 7624:2014 Kalyna-128/256 (ECB Mode)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/kalyna.txt",
          input: OpCodes.Hex8ToBytes("202122232425262728292A2B2C2D2E2F"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          expected: OpCodes.Hex8ToBytes("58EC3E091000158A1148F7166F334F14")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new KalynaInstance(this, isInverse);
    }

    // ===== KEY SCHEDULE =====

    // SetKey_22: Key schedule for 128-bit key (Crypto++ line 419-492)
    SetKey_22(key, isDecryption = false) {
      const t1 = new Array(2);
      const t2 = new Array(2);

      t1[0] = 5n;
      t1[1] = 0n;

      let temp = AddKey(t1, key);
      temp = G128(temp, key);
      temp = GL128(temp, key);
      const ks = G0128(temp);

      const rkeys = new Array(22);
      let constant = 0x0001000100010001n;

      const k = [key[0], key[1]];
      const kswapped = [key[1], key[0]];

      for (let round = 0; round <= 10; round += 2) {
        const kmaterial = (round / 2) % 2 === 0 ? k : kswapped;
        const ksc = AddConstant(ks, constant);

        temp = AddKey(kmaterial, ksc);
        temp = G128(temp, ksc);
        temp = GL128(temp, ksc);

        rkeys[round * 2] = temp[0];
        rkeys[round * 2 + 1] = temp[1];

        if (round < 10) {
          const oddkey = MakeOddKey(temp);
          rkeys[(round + 1) * 2] = oddkey[0];
          rkeys[(round + 1) * 2 + 1] = oddkey[1];
        }

        constant = constant << 1n; // BigInt shift for round constant - OpCodes does not support BigInt
      }

      // For decryption: apply IMC128 to round keys 2,4,6,8,10,12,14,16,18 (Crypto++ line 486-490)
      if (isDecryption) {
        for (let i = 2; i <= 18; i += 2) {
          const modified = IMC128([rkeys[i], rkeys[i + 1]]);
          rkeys[i] = modified[0];
          rkeys[i + 1] = modified[1];
        }
      }

      return rkeys;
    }

    // SetKey_24: Key schedule for 256-bit key (Crypto++ line 494+)
    SetKey_24(key, isDecryption = false) {
      const ka = [key[0], key[1]];
      const ko = [key[2], key[3]];

      const t1 = new Array(2);
      t1[0] = 7n;
      t1[1] = 0n;

      let temp = AddKey(t1, ka);
      temp = G128(temp, ko);
      temp = GL128(temp, ka);
      const ks = G0128(temp);

      const rkeys = new Array(30);
      let constant = 0x0001000100010001n;

      // Crypto++ uses k array and SwapBlocks (left rotation)
      const k = [key[0], key[1], key[2], key[3]];

      for (let round = 0; round <= 14; round += 2) {
        // Determine which part of k to use (Crypto++ line 512-575)
        const kmaterial = (round % 4 === 0) ? [k[0], k[1]] : [k[2], k[3]];

        const ksc = AddConstant(ks, constant);

        temp = AddKey(kmaterial, ksc);
        temp = G128(temp, ksc);
        temp = GL128(temp, ksc);

        rkeys[round * 2] = temp[0];
        rkeys[round * 2 + 1] = temp[1];

        if (round < 14) {
          const oddkey = MakeOddKey(temp);
          rkeys[(round + 1) * 2] = oddkey[0];
          rkeys[(round + 1) * 2 + 1] = oddkey[1];
        }

        // SwapBlocks at rounds 4, 8, 12 (Crypto++ line 528, 545, 562)
        if (round === 2 || round === 6 || round === 10) {
          const t = k[0];
          k[0] = k[1];
          k[1] = k[2];
          k[2] = k[3];
          k[3] = t;
        }

        constant = constant << 1n; // BigInt shift for round constant - OpCodes does not support BigInt
      }

      // For decryption: apply IMC128 to round keys (for 256-bit)
      if (isDecryption) {
        for (let i = 2; i <= 26; i += 2) {
          const modified = IMC128([rkeys[i], rkeys[i + 1]]);
          rkeys[i] = modified[0];
          rkeys[i + 1] = modified[1];
        }
      }

      return rkeys;
    }

    // ===== ENCRYPTION/DECRYPTION =====

    // Encrypt single 128-bit block (Crypto++ ProcessBlock_22 line 935-978)
    encryptBlock(plaintext, key) {
      const msg = new Array(2);
      for (let i = 0; i < 2; i++) {
        let word = 0n;
        for (let j = 0; j < 8; j++) {
          word |= BigInt(plaintext[i * 8 + j]) << BigInt(j * 8);
        }
        msg[i] = word;
      }

      const keyWords = new Array(key.length / 8);
      for (let i = 0; i < keyWords.length; i++) {
        let word = 0n;
        for (let j = 0; j < 8; j++) {
          word |= BigInt(key[i * 8 + j]) << BigInt(j * 8);
        }
        keyWords[i] = word;
      }

      const rkeys = (key.length === 16) ? this.SetKey_22(keyWords, false) : this.SetKey_24(keyWords, false);

      let t1, t2;

      if (key.length === 16) {
        // 128-bit key: 10 rounds (Crypto++ line 944-956)
        t1 = AddKey(msg, [rkeys[0], rkeys[1]]);
        t2 = G128(t1, [rkeys[2], rkeys[3]]);
        t1 = G128(t2, [rkeys[4], rkeys[5]]);
        t2 = G128(t1, [rkeys[6], rkeys[7]]);
        t1 = G128(t2, [rkeys[8], rkeys[9]]);
        t2 = G128(t1, [rkeys[10], rkeys[11]]);
        t1 = G128(t2, [rkeys[12], rkeys[13]]);
        t2 = G128(t1, [rkeys[14], rkeys[15]]);
        t1 = G128(t2, [rkeys[16], rkeys[17]]);
        t2 = G128(t1, [rkeys[18], rkeys[19]]);
        t1 = GL128(t2, [rkeys[20], rkeys[21]]);
      } else {
        // 256-bit key: 14 rounds (Crypto++ line 991-1005)
        t1 = AddKey(msg, [rkeys[0], rkeys[1]]);
        t2 = G128(t1, [rkeys[2], rkeys[3]]);
        t1 = G128(t2, [rkeys[4], rkeys[5]]);
        t2 = G128(t1, [rkeys[6], rkeys[7]]);
        t1 = G128(t2, [rkeys[8], rkeys[9]]);
        t2 = G128(t1, [rkeys[10], rkeys[11]]);
        t1 = G128(t2, [rkeys[12], rkeys[13]]);
        t2 = G128(t1, [rkeys[14], rkeys[15]]);
        t1 = G128(t2, [rkeys[16], rkeys[17]]);
        t2 = G128(t1, [rkeys[18], rkeys[19]]);
        t1 = G128(t2, [rkeys[20], rkeys[21]]);
        t2 = G128(t1, [rkeys[22], rkeys[23]]);
        t1 = G128(t2, [rkeys[24], rkeys[25]]);
        t2 = G128(t1, [rkeys[26], rkeys[27]]);
        t1 = GL128(t2, [rkeys[28], rkeys[29]]);
      }

      const output = new Array(16);
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 8; j++) {
          output[i * 8 + j] = Number((t1[i] >> BigInt(j * 8)) & 0xFFn);
        }
      }
      return output;
    }

    // Decrypt single 128-bit block (Crypto++ ProcessBlock_22 line 935-978)
    decryptBlock(ciphertext, key) {
      const msg = new Array(2);
      for (let i = 0; i < 2; i++) {
        let word = 0n;
        for (let j = 0; j < 8; j++) {
          word |= BigInt(ciphertext[i * 8 + j]) << BigInt(j * 8);
        }
        msg[i] = word;
      }

      const keyWords = new Array(key.length / 8);
      for (let i = 0; i < keyWords.length; i++) {
        let word = 0n;
        for (let j = 0; j < 8; j++) {
          word |= BigInt(key[i * 8 + j]) << BigInt(j * 8);
        }
        keyWords[i] = word;
      }

      const rkeys = (key.length === 16) ? this.SetKey_22(keyWords, true) : this.SetKey_24(keyWords, true);

      let t1, t2;

      if (key.length === 16) {
        // 128-bit key: 10 rounds (Crypto++ line 960-971)
        t1 = SubKey(msg, [rkeys[20], rkeys[21]]);
        t1 = IMC128(t1);
        t2 = IG128(t1, [rkeys[18], rkeys[19]]);
        t1 = IG128(t2, [rkeys[16], rkeys[17]]);
        t2 = IG128(t1, [rkeys[14], rkeys[15]]);
        t1 = IG128(t2, [rkeys[12], rkeys[13]]);
        t2 = IG128(t1, [rkeys[10], rkeys[11]]);
        t1 = IG128(t2, [rkeys[8], rkeys[9]]);
        t2 = IG128(t1, [rkeys[6], rkeys[7]]);
        t1 = IG128(t2, [rkeys[4], rkeys[5]]);
        t2 = IG128(t1, [rkeys[2], rkeys[3]]);
        t1 = IGL128(t2, [rkeys[0], rkeys[1]]);
      } else {
        // 256-bit key: 14 rounds (Crypto++ line 1009-1024)
        t1 = SubKey(msg, [rkeys[28], rkeys[29]]);
        t1 = IMC128(t1);
        t2 = IG128(t1, [rkeys[26], rkeys[27]]);
        t1 = IG128(t2, [rkeys[24], rkeys[25]]);
        t2 = IG128(t1, [rkeys[22], rkeys[23]]);
        t1 = IG128(t2, [rkeys[20], rkeys[21]]);
        t2 = IG128(t1, [rkeys[18], rkeys[19]]);
        t1 = IG128(t2, [rkeys[16], rkeys[17]]);
        t2 = IG128(t1, [rkeys[14], rkeys[15]]);
        t1 = IG128(t2, [rkeys[12], rkeys[13]]);
        t2 = IG128(t1, [rkeys[10], rkeys[11]]);
        t1 = IG128(t2, [rkeys[8], rkeys[9]]);
        t2 = IG128(t1, [rkeys[6], rkeys[7]]);
        t1 = IG128(t2, [rkeys[4], rkeys[5]]);
        t2 = IG128(t1, [rkeys[2], rkeys[3]]);
        t1 = IGL128(t2, [rkeys[0], rkeys[1]]);
      }

      const output = new Array(16);
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 8; j++) {
          output[i * 8 + j] = Number((t1[i] >> BigInt(j * 8)) & 0xFFn);
        }
      }
      return output;
    }
  }

  // Instance class
  class KalynaInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.KeySize = 0;
        return;
      }

      if (keyBytes.length !== 16 && keyBytes.length !== 32) {
        throw new Error(`Kalyna: Invalid key size ${keyBytes.length} bytes. Must be 16 or 32 bytes.`);
      }

      this._key = OpCodes.CopyArray(keyBytes);
      this.KeySize = keyBytes.length;
    }

    get key() {
      return this._key ? OpCodes.CopyArray(this._key) : null;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Kalyna: Key not set");

      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error("Kalyna: Key not set");
      if (this.inputBuffer.length === 0) throw new Error("Kalyna: No data fed");

      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error(`Kalyna: Input length must be multiple of ${this.BlockSize} bytes`);
      }

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        const processedBlock = this.isInverse
          ? this.algorithm.decryptBlock(block, this._key)
          : this.algorithm.encryptBlock(block, this._key);
        output.push(...processedBlock);
      }

      this.inputBuffer = [];
      return output;
    }
  }

  const algorithmInstance = new KalynaAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { KalynaAlgorithm, KalynaInstance };
}));
