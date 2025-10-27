/*
 * DSTU7564-256 (Kupyna-256) Hash Function - Universal AlgorithmFramework Implementation
 * Ukrainian National Standard DSTU 7564:2014
 * (c)2006-2025 Hawkynt
 *
 * Reference: Bouncy Castle DSTU7564Digest.java
 * Official Standard: DSTU 7564:2014
 */

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

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== S-BOXES (Ukrainian National Standard) =====

  const S0 = new Uint8Array([
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
  ]);

  const S1 = new Uint8Array([
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
  ]);

  const S2 = new Uint8Array([
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
  ]);

  const S3 = new Uint8Array([
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
  ]);

  // ===== ALGORITHM IMPLEMENTATION =====

  class Kupyna256Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "DSTU7564-256 (Kupyna-256)";
      this.description = "Ukrainian National Standard hash function (DSTU 7564:2014). 256-bit variant using AES-like structure with Even-Mansour construction. Approved as national cryptographic standard.";
      this.inventor = "Roman Oliynykov, Ivan Gorbenko, Oleksandr Kazymyrov, Victor Ruzhentsev, Oleksandr Kuznetsov";
      this.year = 2014;
      this.category = CategoryType.HASH;
      this.subCategory = "National Standard";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.UA;

      // Hash-specific metadata
      this.SupportedOutputSizes = [32]; // 256 bits
      this.blockSize = 64; // 512 bits = 64 bytes
      this.outputSize = 32; // 256 bits = 32 bytes

      // Documentation and references
      this.documentation = [
        new LinkItem("DSTU 7564:2014 Standard", "https://www.tc26.ru/en/standard/dstu-7564-2014/"),
        new LinkItem("ISO/IEC 10118-3:2018", "https://www.iso.org/standard/67116.html"),
        new LinkItem("Kupyna Reference Implementation", "https://github.com/Roman-Oliynykov/Kupyna-reference")
      ];

      this.references = [
        new LinkItem("Wikipedia: Kupyna", "https://en.wikipedia.org/wiki/Kupyna"),
        new LinkItem("NIST Cryptographic Hash Algorithm", "https://csrc.nist.gov/projects/hash-functions")
      ];

      // Test vectors from Bouncy Castle test suite
      this.tests = [
        {
          text: "Empty string (DSTU7564-256)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("CD5101D1CCDF0D1D1F4ADA56E888CD724CA1A0838A3521E7131D4FB78D0F5EB6")
        },
        {
          text: "Single byte 0xFF (DSTU7564-256)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes("FF"),
          expected: OpCodes.Hex8ToBytes("EA7677CA4526555680441C117982EA14059EA6D0D7124D6ECDB3DEEC49E890F4")
        },
        {
          text: "64-byte test vector (DSTU7564-256)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F"),
          expected: OpCodes.Hex8ToBytes("08F4EE6F1BE6903B324C4E27990CB24EF69DD58DBE84813EE0A52F6631239875")
        },
        {
          text: "128-byte test vector (DSTU7564-256)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F404142434445464748494A4B4C4D4E4F505152535455565758595A5B5C5D5E5F606162636465666768696A6B6C6D6E6F707172737475767778797A7B7C7D7E7F"),
          expected: OpCodes.Hex8ToBytes("0A9474E645A7D25E255E9E89FFF42EC7EB31349007059284F0B182E452BDA882")
        },
        {
          text: "256-byte test vector (DSTU7564-256)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F404142434445464748494A4B4C4D4E4F505152535455565758595A5B5C5D5E5F606162636465666768696A6B6C6D6E6F707172737475767778797A7B7C7D7E7F808182838485868788898A8B8C8D8E8F909192939495969798999A9B9C9D9E9FA0A1A2A3A4A5A6A7A8A9AAABACADAEAFB0B1B2B3B4B5B6B7B8B9BABBBCBDBEBFC0C1C2C3C4C5C6C7C8C9CACBCCCDCECFD0D1D2D3D4D5D6D7D8D9DADBDCDDDEDFE0E1E2E3E4E5E6E7E8E9EAEBECEDEEEFF0F1F2F3F4F5F6F7F8F9FAFBFCFDFEFF"),
          expected: OpCodes.Hex8ToBytes("D305A32B963D149DC765F68594505D4077024F836C1BF03806E1624CE176C08F")
        },
        {
          text: "95-byte test vector (DSTU7564-256)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F404142434445464748494A4B4C4D4E4F505152535455565758595A5B5C5D5E"),
          expected: OpCodes.Hex8ToBytes("1075C8B0CB910F116BDA5FA1F19C29CF8ECC75CAFF7208BA2994B68FC56E8D16")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new Kupyna256AlgorithmInstance(this);
    }
  }

  class Kupyna256AlgorithmInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);

      // Constants for 256-bit variant
      this.NB_512 = 8;  // Number of 8-byte columns
      this.NR_512 = 10; // Number of rounds
      this.blockSize = 64; // 512 bits = 64 bytes
      this.hashSize = 32; // 256 bits = 32 bytes

      // Internal state
      this.state = null;
      this.tempState1 = null;
      this.tempState2 = null;
      this.inputBlocks = 0;
      this.buf = null;
      this.bufOff = 0;

      this.reset();
    }

    reset() {
      // Initialize state (array of 8 x 64-bit words as byte arrays)
      this.state = new Array(this.NB_512);
      for (let i = 0; i < this.NB_512; ++i) {
        this.state[i] = new Array(8).fill(0);
      }
      // Set initial value to block size
      this.state[0][0] = this.blockSize & 0xFF;
      this.state[0][1] = (this.blockSize >>> 8) & 0xFF;

      this.tempState1 = new Array(this.NB_512);
      this.tempState2 = new Array(this.NB_512);
      for (let i = 0; i < this.NB_512; ++i) {
        this.tempState1[i] = new Array(8);
        this.tempState2[i] = new Array(8);
      }

      this.buf = new Array(this.blockSize).fill(0);
      this.bufOff = 0;
      this.inputBlocks = 0;
    }

    // SubBytes transformation using 4 S-boxes
    subBytes(s) {
      for (let col = 0; col < this.NB_512; ++col) {
        s[col][0] = S0[s[col][0] & 0xFF];
        s[col][1] = S1[s[col][1] & 0xFF];
        s[col][2] = S2[s[col][2] & 0xFF];
        s[col][3] = S3[s[col][3] & 0xFF];
        s[col][4] = S0[s[col][4] & 0xFF];
        s[col][5] = S1[s[col][5] & 0xFF];
        s[col][6] = S2[s[col][6] & 0xFF];
        s[col][7] = S3[s[col][7] & 0xFF];
      }
    }

    // ShiftRows transformation (using BigInt for proper 64-bit operations)
    shiftRows(s) {
      // Convert to 64-bit BigInt representation
      const words = new Array(this.NB_512);
      for (let i = 0; i < this.NB_512; ++i) {
        words[i] = 0n;
        for (let j = 0; j < 8; ++j) {
          words[i] |= BigInt(s[i][j] & 0xFF) << BigInt(j * 8);
        }
      }

      let c0 = words[0], c1 = words[1], c2 = words[2], c3 = words[3];
      let c4 = words[4], c5 = words[5], c6 = words[6], c7 = words[7];
      let d;

      // Bit-parallel permutation for 512-bit state
      d = (c0 ^ c4) & 0xFFFFFFFF00000000n; c0 ^= d; c4 ^= d;
      d = (c1 ^ c5) & 0x00FFFFFFFF000000n; c1 ^= d; c5 ^= d;
      d = (c2 ^ c6) & 0x0000FFFFFFFF0000n; c2 ^= d; c6 ^= d;
      d = (c3 ^ c7) & 0x000000FFFFFFFF00n; c3 ^= d; c7 ^= d;

      d = (c0 ^ c2) & 0xFFFF0000FFFF0000n; c0 ^= d; c2 ^= d;
      d = (c1 ^ c3) & 0x00FFFF0000FFFF00n; c1 ^= d; c3 ^= d;
      d = (c4 ^ c6) & 0xFFFF0000FFFF0000n; c4 ^= d; c6 ^= d;
      d = (c5 ^ c7) & 0x00FFFF0000FFFF00n; c5 ^= d; c7 ^= d;

      d = (c0 ^ c1) & 0xFF00FF00FF00FF00n; c0 ^= d; c1 ^= d;
      d = (c2 ^ c3) & 0xFF00FF00FF00FF00n; c2 ^= d; c3 ^= d;
      d = (c4 ^ c5) & 0xFF00FF00FF00FF00n; c4 ^= d; c5 ^= d;
      d = (c6 ^ c7) & 0xFF00FF00FF00FF00n; c6 ^= d; c7 ^= d;

      words[0] = c0; words[1] = c1; words[2] = c2; words[3] = c3;
      words[4] = c4; words[5] = c5; words[6] = c6; words[7] = c7;

      // Convert back to byte representation
      for (let i = 0; i < this.NB_512; ++i) {
        for (let j = 0; j < 8; ++j) {
          s[i][j] = Number((words[i] >> BigInt(j * 8)) & 0xFFn);
        }
      }
    }

    // MixColumns transformation (Galois Field multiplication)
    mixColumns(s) {
      for (let col = 0; col < this.NB_512; ++col) {
        // Pack column into 64-bit BigInt word (little-endian)
        let c = 0n;
        for (let i = 0; i < 8; ++i) {
          c |= BigInt(s[col][i] & 0xFF) << BigInt(i * 8);
        }

        // MixColumn operation (circulant matrix in GF(2^8))
        const mixed = this.mixColumn(c);

        // Unpack back to bytes
        for (let i = 0; i < 8; ++i) {
          s[col][i] = Number((mixed >> BigInt(i * 8)) & 0xFFn);
        }
      }
    }

    // Single column mixing (optimized from Bouncy Castle, using BigInt)
    mixColumn(c) {
      // Multiply elements by 'x' in GF(2^8) with polynomial 0x1D
      const x1 = ((c & 0x7F7F7F7F7F7F7F7Fn) << 1n) ^ (((c & 0x8080808080808080n) >> 7n) * 0x1Dn);

      // Use RIGHT rotation to match Bouncy Castle's rotate() function
      let u = c;
      u ^= (c >> 8n) | (c << 56n); // Rotate RIGHT by 8 bits (1 byte)
      u ^= (u >> 16n) | (u << 48n); // Rotate RIGHT by 16 bits (2 bytes)
      u ^= (c >> 48n) | (c << 16n); // Rotate RIGHT by 48 bits (6 bytes)

      let v = u ^ c ^ x1;

      // Multiply by 'x^2'
      v = ((v & 0x3F3F3F3F3F3F3F3Fn) << 2n) ^
          (((v & 0x8080808080808080n) >> 6n) * 0x1Dn) ^
          (((v & 0x4040404040404040n) >> 6n) * 0x1Dn);

      const result = u ^
                     ((v >> 32n) | (v << 32n)) ^  // Rotate RIGHT by 32 bits
                     ((x1 >> 40n) | (x1 << 24n)) ^  // Rotate RIGHT by 40 bits
                     ((x1 >> 48n) | (x1 << 16n));   // Rotate RIGHT by 48 bits

      return result & 0xFFFFFFFFFFFFFFFFn;
    }

    // P permutation (encryption-like transformation)
    P(s) {
      for (let round = 0; round < this.NR_512; ++round) {
        // AddRoundConstants
        let rc = round;
        for (let col = 0; col < this.NB_512; ++col) {
          s[col][0] ^= rc & 0xFF;
          rc += 0x10;
        }

        this.shiftRows(s);
        this.subBytes(s);
        this.mixColumns(s);
      }
    }

    // Q permutation (decryption-like transformation)
    Q(s) {
      for (let round = 0; round < this.NR_512; ++round) {
        // AddRoundConstantsQ - matches Bouncy Castle exactly
        let rc = (BigInt(((this.NB_512 - 1) << 4) ^ round) << 56n) | 0x00F0F0F0F0F0F0F3n;

        for (let col = 0; col < this.NB_512; ++col) {
          // Convert column to 64-bit BigInt
          let word = 0n;
          for (let i = 0; i < 8; ++i) {
            word |= BigInt(s[col][i] & 0xFF) << BigInt(i * 8);
          }

          // Add constant
          word = (word + rc) & 0xFFFFFFFFFFFFFFFFn;

          // Convert back to bytes
          for (let i = 0; i < 8; ++i) {
            s[col][i] = Number((word >> BigInt(i * 8)) & 0xFFn);
          }

          // Decrement constant
          rc = (rc - 0x1000000000000000n) & 0xFFFFFFFFFFFFFFFFn;
        }

        this.shiftRows(s);
        this.subBytes(s);
        this.mixColumns(s);
      }
    }

    // Process single block
    processBlock(input, inOff) {
      let pos = inOff;

      // Load block and XOR with state for tempState1, copy to tempState2
      for (let col = 0; col < this.NB_512; ++col) {
        for (let i = 0; i < 8; ++i) {
          const word = input[pos++] & 0xFF;
          this.tempState1[col][i] = this.state[col][i] ^ word;
          this.tempState2[col][i] = word;
        }
      }

      // Apply P and Q transformations
      this.P(this.tempState1);
      this.Q(this.tempState2);

      // XOR results back into state
      for (let col = 0; col < this.NB_512; ++col) {
        for (let i = 0; i < 8; ++i) {
          this.state[col][i] ^= this.tempState1[col][i] ^ this.tempState2[col][i];
          this.state[col][i] &= 0xFF;
        }
      }
    }

    // Feed data for hashing
    Feed(data) {
      if (!data || data.length === 0) return;

      let inOff = 0;
      let len = data.length;

      // Fill buffer first
      while (this.bufOff !== 0 && len > 0) {
        this.buf[this.bufOff++] = data[inOff++];
        --len;

        if (this.bufOff === this.blockSize) {
          this.processBlock(this.buf, 0);
          this.bufOff = 0;
          ++this.inputBlocks;
        }
      }

      // Process complete blocks
      while (len >= this.blockSize) {
        this.processBlock(data, inOff);
        inOff += this.blockSize;
        len -= this.blockSize;
        ++this.inputBlocks;
      }

      // Buffer remaining bytes
      while (len > 0) {
        this.buf[this.bufOff++] = data[inOff++];
        --len;
      }
    }

    // Compute final hash
    Result() {
      // Padding: 0x80 byte followed by zeros, then 96-bit length
      const inputBytes = this.bufOff;
      this.buf[this.bufOff++] = 0x80;

      const lenPos = this.blockSize - 12;
      if (this.bufOff > lenPos) {
        while (this.bufOff < this.blockSize) {
          this.buf[this.bufOff++] = 0;
        }
        this.bufOff = 0;
        this.processBlock(this.buf, 0);
      }

      while (this.bufOff < lenPos) {
        this.buf[this.bufOff++] = 0;
      }

      // Append length in bits (little-endian, 96 bits)
      const totalBits = (this.inputBlocks * this.blockSize + inputBytes) * 8;
      this.buf[this.bufOff++] = totalBits & 0xFF;
      this.buf[this.bufOff++] = (totalBits >>> 8) & 0xFF;
      this.buf[this.bufOff++] = (totalBits >>> 16) & 0xFF;
      this.buf[this.bufOff++] = (totalBits >>> 24) & 0xFF;

      // Upper 64 bits of length (usually 0 for reasonable input sizes)
      for (let i = 0; i < 8; ++i) {
        this.buf[this.bufOff++] = 0;
      }

      this.processBlock(this.buf, 0);

      // Final transformation: state = P(state) XOR state
      for (let col = 0; col < this.NB_512; ++col) {
        for (let i = 0; i < 8; ++i) {
          this.tempState1[col][i] = this.state[col][i];
        }
      }

      this.P(this.tempState1);

      for (let col = 0; col < this.NB_512; ++col) {
        for (let i = 0; i < 8; ++i) {
          this.state[col][i] ^= this.tempState1[col][i];
          this.state[col][i] &= 0xFF;
        }
      }

      // Extract hash (last 4 columns for 256-bit)
      const output = [];
      const startCol = this.NB_512 - (this.hashSize >>> 3);
      for (let col = startCol; col < this.NB_512; ++col) {
        for (let i = 0; i < 8; ++i) {
          output.push(this.state[col][i] & 0xFF);
        }
      }

      this.reset();
      return output;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new Kupyna256Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Kupyna256Algorithm, Kupyna256AlgorithmInstance };
}));
