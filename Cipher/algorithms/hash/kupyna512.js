/*
 * DSTU7564-512 (Kupyna-512) Hash Function - Universal AlgorithmFramework Implementation
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

  class Kupyna512Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "DSTU7564-512 (Kupyna-512)";
      this.description = "Ukrainian National Standard hash function (DSTU 7564:2014). 512-bit variant using AES-like structure with Even-Mansour construction. Approved as national cryptographic standard.";
      this.inventor = "Roman Oliynykov, Ivan Gorbenko, Oleksandr Kazymyrov, Victor Ruzhentsev, Oleksandr Kuznetsov";
      this.year = 2014;
      this.category = CategoryType.HASH;
      this.subCategory = "National Standard";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.UA;

      // Hash-specific metadata
      this.SupportedOutputSizes = [64]; // 512 bits
      this.blockSize = 128; // 1024 bits = 128 bytes
      this.outputSize = 64; // 512 bits = 64 bytes

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
          text: "Empty string (DSTU7564-512)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("656B2F4CD71462388B64A37043EA55DBE445D452AECD46C3298343314EF04019BCFA3F04265A9857F91BE91FCE197096187CEDA78C9C1C021C294A0689198538")
        },
        {
          text: "Single byte 0xFF (DSTU7564-512)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes("FF"),
          expected: OpCodes.Hex8ToBytes("871B18CF754B72740307A97B449ABEB32B64444CC0D5A4D65830AE5456837A72D8458F12C8F06C98C616ABE11897F86263B5CB77C420FB375374BEC52B6D0292")
        },
        {
          text: "64-byte test vector (DSTU7564-512)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F"),
          expected: OpCodes.Hex8ToBytes("3813E2109118CDFB5A6D5E72F7208DCCC80A2DFB3AFDFB02F46992B5EDBE536B3560DD1D7E29C6F53978AF58B444E37BA685C0DD910533BA5D78EFFFC13DE62A")
        },
        {
          text: "128-byte test vector (DSTU7564-512)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F404142434445464748494A4B4C4D4E4F505152535455565758595A5B5C5D5E5F606162636465666768696A6B6C6D6E6F707172737475767778797A7B7C7D7E7F"),
          expected: OpCodes.Hex8ToBytes("76ED1AC28B1D0143013FFA87213B4090B356441263C13E03FA060A8CADA32B979635657F256B15D5FCA4A174DE029F0B1B4387C878FCC1C00E8705D783FD7FFE")
        },
        {
          text: "256-byte test vector (DSTU7564-512)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F404142434445464748494A4B4C4D4E4F505152535455565758595A5B5C5D5E5F606162636465666768696A6B6C6D6E6F707172737475767778797A7B7C7D7E7F808182838485868788898A8B8C8D8E8F909192939495969798999A9B9C9D9E9FA0A1A2A3A4A5A6A7A8A9AAABACADAEAFB0B1B2B3B4B5B6B7B8B9BABBBCBDBEBFC0C1C2C3C4C5C6C7C8C9CACBCCCDCECFD0D1D2D3D4D5D6D7D8D9DADBDCDDDEDFE0E1E2E3E4E5E6E7E8E9EAEBECEDEEEFF0F1F2F3F4F5F6F7F8F9FAFBFCFDFEFF"),
          expected: OpCodes.Hex8ToBytes("0DD03D7350C409CB3C29C25893A0724F6B133FA8B9EB90A64D1A8FA93B56556611EB187D715A956B107E3BFC76482298133A9CE8CBC0BD5E1436A5B197284F7E")
        },
        {
          text: "192-byte test vector (DSTU7564-512)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F404142434445464748494A4B4C4D4E4F505152535455565758595A5B5C5D5E5F606162636465666768696A6B6C6D6E6F707172737475767778797A7B7C7D7E7F808182838485868788898A8B8C8D8E8F909192939495969798999A9B9C9D9E9FA0A1A2A3A4A5A6A7A8A9AAABACADAEAFB0B1B2B3B4B5B6B7B8B9BABBBCBDBEBF"),
          expected: OpCodes.Hex8ToBytes("B189BFE987F682F5F167F0D7FA565330E126B6E592B1C55D44299064EF95B1A57F3C2D0ECF17869D1D199EBBD02E8857FB8ADD67A8C31F56CD82C016CF743121")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new Kupyna512AlgorithmInstance(this);
    }
  }

  class Kupyna512AlgorithmInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);

      // Constants for 512-bit variant
      this.NB_1024 = 16;  // Number of 8-byte columns
      this.NR_1024 = 14;  // Number of rounds
      this.blockSize = 128; // 1024 bits = 128 bytes
      this.hashSize = 64;   // 512 bits = 64 bytes

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
      // Initialize state (array of 16 x 64-bit words as byte arrays)
      this.state = new Array(this.NB_1024);
      for (let i = 0; i < this.NB_1024; ++i) {
        this.state[i] = new Array(8).fill(0);
      }
      // Set initial value to block size
      this.state[0][0] = this.blockSize & 0xFF;
      this.state[0][1] = (this.blockSize >>> 8) & 0xFF;

      this.tempState1 = new Array(this.NB_1024);
      this.tempState2 = new Array(this.NB_1024);
      for (let i = 0; i < this.NB_1024; ++i) {
        this.tempState1[i] = new Array(8);
        this.tempState2[i] = new Array(8);
      }

      this.buf = new Array(this.blockSize).fill(0);
      this.bufOff = 0;
      this.inputBlocks = 0;
    }

    // SubBytes transformation using 4 S-boxes
    subBytes(s) {
      for (let col = 0; col < this.NB_1024; ++col) {
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

    // ShiftRows transformation (optimized bit-manipulation version for 1024-bit state)
    shiftRows(s) {
      // Convert to 64-bit representation for efficient shifting
      const words = new Array(this.NB_1024);
      for (let i = 0; i < this.NB_1024; ++i) {
        words[i] = 0;
        for (let j = 0; j < 8; ++j) {
          words[i] |= (s[i][j] & 0xFF) << (j * 8);
        }
        words[i] = words[i] >>> 0; // Ensure unsigned
      }

      let c00 = words[0], c01 = words[1], c02 = words[2], c03 = words[3];
      let c04 = words[4], c05 = words[5], c06 = words[6], c07 = words[7];
      let c08 = words[8], c09 = words[9], c10 = words[10], c11 = words[11];
      let c12 = words[12], c13 = words[13], c14 = words[14], c15 = words[15];
      let d;

      // Bit-parallel permutation for 1024-bit state
      // Row 7 is shifted by 11 (special case)
      d = (c00 ^ c08) & 0xFF00000000000000; c00 ^= d; c08 ^= d;
      d = (c01 ^ c09) & 0xFF00000000000000; c01 ^= d; c09 ^= d;
      d = (c02 ^ c10) & 0xFFFF000000000000; c02 ^= d; c10 ^= d;
      d = (c03 ^ c11) & 0xFFFFFF0000000000; c03 ^= d; c11 ^= d;
      d = (c04 ^ c12) & 0xFFFFFFFF00000000; c04 ^= d; c12 ^= d;
      d = (c05 ^ c13) & 0x00FFFFFFFF000000; c05 ^= d; c13 ^= d;
      d = (c06 ^ c14) & 0x00FFFFFFFFFF0000; c06 ^= d; c14 ^= d;
      d = (c07 ^ c15) & 0x00FFFFFFFFFFFF00; c07 ^= d; c15 ^= d;

      d = (c00 ^ c04) & 0x00FFFFFF00000000; c00 ^= d; c04 ^= d;
      d = (c01 ^ c05) & 0xFFFFFFFFFF000000; c01 ^= d; c05 ^= d;
      d = (c02 ^ c06) & 0xFF00FFFFFFFF0000; c02 ^= d; c06 ^= d;
      d = (c03 ^ c07) & 0xFF0000FFFFFFFF00; c03 ^= d; c07 ^= d;
      d = (c08 ^ c12) & 0x00FFFFFF00000000; c08 ^= d; c12 ^= d;
      d = (c09 ^ c13) & 0xFFFFFFFFFF000000; c09 ^= d; c13 ^= d;
      d = (c10 ^ c14) & 0xFF00FFFFFFFF0000; c10 ^= d; c14 ^= d;
      d = (c11 ^ c15) & 0xFF0000FFFFFFFF00; c11 ^= d; c15 ^= d;

      d = (c00 ^ c02) & 0xFFFF0000FFFF0000; c00 ^= d; c02 ^= d;
      d = (c01 ^ c03) & 0x00FFFF0000FFFF00; c01 ^= d; c03 ^= d;
      d = (c04 ^ c06) & 0xFFFF0000FFFF0000; c04 ^= d; c06 ^= d;
      d = (c05 ^ c07) & 0x00FFFF0000FFFF00; c05 ^= d; c07 ^= d;
      d = (c08 ^ c10) & 0xFFFF0000FFFF0000; c08 ^= d; c10 ^= d;
      d = (c09 ^ c11) & 0x00FFFF0000FFFF00; c09 ^= d; c11 ^= d;
      d = (c12 ^ c14) & 0xFFFF0000FFFF0000; c12 ^= d; c14 ^= d;
      d = (c13 ^ c15) & 0x00FFFF0000FFFF00; c13 ^= d; c15 ^= d;

      d = (c00 ^ c01) & 0xFF00FF00FF00FF00; c00 ^= d; c01 ^= d;
      d = (c02 ^ c03) & 0xFF00FF00FF00FF00; c02 ^= d; c03 ^= d;
      d = (c04 ^ c05) & 0xFF00FF00FF00FF00; c04 ^= d; c05 ^= d;
      d = (c06 ^ c07) & 0xFF00FF00FF00FF00; c06 ^= d; c07 ^= d;
      d = (c08 ^ c09) & 0xFF00FF00FF00FF00; c08 ^= d; c09 ^= d;
      d = (c10 ^ c11) & 0xFF00FF00FF00FF00; c10 ^= d; c11 ^= d;
      d = (c12 ^ c13) & 0xFF00FF00FF00FF00; c12 ^= d; c13 ^= d;
      d = (c14 ^ c15) & 0xFF00FF00FF00FF00; c14 ^= d; c15 ^= d;

      words[0] = c00; words[1] = c01; words[2] = c02; words[3] = c03;
      words[4] = c04; words[5] = c05; words[6] = c06; words[7] = c07;
      words[8] = c08; words[9] = c09; words[10] = c10; words[11] = c11;
      words[12] = c12; words[13] = c13; words[14] = c14; words[15] = c15;

      // Convert back to byte representation
      for (let i = 0; i < this.NB_1024; ++i) {
        for (let j = 0; j < 8; ++j) {
          s[i][j] = (words[i] >>> (j * 8)) & 0xFF;
        }
      }
    }

    // MixColumns transformation (Galois Field multiplication)
    mixColumns(s) {
      for (let col = 0; col < this.NB_1024; ++col) {
        // Pack column into 64-bit word (little-endian)
        let c = 0;
        for (let i = 0; i < 8; ++i) {
          c |= (s[col][i] & 0xFF) << (i * 8);
        }
        c = c >>> 0;

        // MixColumn operation (circulant matrix in GF(2^8))
        const mixed = this.mixColumn(c);

        // Unpack back to bytes
        for (let i = 0; i < 8; ++i) {
          s[col][i] = (mixed >>> (i * 8)) & 0xFF;
        }
      }
    }

    // Single column mixing (optimized from Bouncy Castle)
    mixColumn(c) {
      // Multiply elements by 'x' in GF(2^8) with polynomial 0x1D
      const x1 = ((c & 0x7F7F7F7F7F7F7F7F) << 1) ^ (((c & 0x8080808080808080) >>> 7) * 0x1D);

      let u = c;
      u ^= ((c << 8) | (c >>> 56)) >>> 0; // Rotate by 1 byte
      u ^= ((u << 16) | (u >>> 48)) >>> 0; // Rotate by 2 bytes
      u ^= ((c << 48) | (c >>> 16)) >>> 0; // Rotate by 6 bytes

      let v = u ^ c ^ x1;

      // Multiply by 'x^2'
      v = ((v & 0x3F3F3F3F3F3F3F3F) << 2) ^
          (((v & 0x8080808080808080) >>> 6) * 0x1D) ^
          (((v & 0x4040404040404040) >>> 6) * 0x1D);

      const result = u ^
                     ((v << 32) | (v >>> 32)) ^
                     ((x1 << 40) | (x1 >>> 24)) ^
                     ((x1 << 48) | (x1 >>> 16));

      return result >>> 0;
    }

    // P permutation (encryption-like transformation)
    P(s) {
      for (let round = 0; round < this.NR_1024; ++round) {
        // AddRoundConstants
        let rc = round;
        for (let col = 0; col < this.NB_1024; ++col) {
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
      for (let round = 0; round < this.NR_1024; ++round) {
        // AddRoundConstantsQ
        let rc = (((this.NB_1024 - 1) << 4) ^ round) & 0xFF;
        const rcBase = 0xF3;

        for (let col = 0; col < this.NB_1024; ++col) {
          s[col][7] += (rc << 4) | ((rcBase >>> 4) & 0x0F);
          s[col][6] += rcBase & 0xFF;
          s[col][5] += rcBase & 0xFF;
          s[col][4] += rcBase & 0xFF;
          s[col][3] += rcBase & 0xFF;
          s[col][2] += rcBase & 0xFF;
          s[col][1] += rcBase & 0xFF;
          s[col][0] += rcBase & 0xFF;

          // Ensure bytes stay in range
          for (let i = 0; i < 8; ++i) {
            s[col][i] &= 0xFF;
          }

          rc = (rc - 0x10) & 0xFF;
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
      for (let col = 0; col < this.NB_1024; ++col) {
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
      for (let col = 0; col < this.NB_1024; ++col) {
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
      for (let col = 0; col < this.NB_1024; ++col) {
        for (let i = 0; i < 8; ++i) {
          this.tempState1[col][i] = this.state[col][i];
        }
      }

      this.P(this.tempState1);

      for (let col = 0; col < this.NB_1024; ++col) {
        for (let i = 0; i < 8; ++i) {
          this.state[col][i] ^= this.tempState1[col][i];
          this.state[col][i] &= 0xFF;
        }
      }

      // Extract hash (last 8 columns for 512-bit)
      const output = [];
      const startCol = this.NB_1024 - (this.hashSize >>> 3);
      for (let col = startCol; col < this.NB_1024; ++col) {
        for (let i = 0; i < 8; ++i) {
          output.push(this.state[col][i] & 0xFF);
        }
      }

      this.reset();
      return output;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new Kupyna512Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Kupyna512Algorithm, Kupyna512AlgorithmInstance };
}));
