/* DSTU7564 (Kupyna) Hash Function Implementation
 * Ukrainian National Standard Hash Function (ISO/IEC 10118-3:2018)
 *
 * Based on Bouncy Castle reference implementation:
 * https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/digests/DSTU7564Digest.java
 *
 * Supports 256, 384, and 512-bit output sizes
 * Uses substitution-permutation network with 64-bit words
 */

(function(global) {
  'use strict';

  // Load AlgorithmFramework
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    global.AlgorithmFramework = require('../../AlgorithmFramework.js');
  }

  // Load OpCodes
  if (!global.OpCodes && typeof require !== 'undefined') {
    global.OpCodes = require('../../OpCodes.js');
  }

  const {
    RegisterAlgorithm,
    CategoryType,
    SecurityStatus,
    ComplexityType,
    CountryCode,
    HashFunctionAlgorithm,
    IHashFunctionInstance,
    TestCase,
    LinkItem,
    KeySize
  } = global.AlgorithmFramework;

  const OpCodes = global.OpCodes;

  // ===== S-BOX TABLES =====
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

  // ===== DSTU7564 ALGORITHM CLASS =====
  /**
 * DSTU7564 - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class DSTU7564 extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "DSTU7564 (Kupyna)";
      this.description = "Ukrainian national standard hash function. Substitution-permutation network operating on 512/1024-bit states with 64-bit words. ISO/IEC 10118-3:2018 approved algorithm.";
      this.inventor = "Roman Oliynykov et al.";
      this.year = 2015;
      this.category = CategoryType.HASH;
      this.subCategory = "Hash Function";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.UA;

      // Hash capabilities
      this.SupportedOutputSizes = [
        new KeySize(32, 32, 1),  // 256 bits
        new KeySize(48, 48, 1),  // 384 bits
        new KeySize(64, 64, 1)   // 512 bits
      ];

      // Documentation
      this.documentation = [
        new LinkItem(
          "DSTU 7564:2014 Specification (Ukrainian)",
          "http://dstszi.kmu.gov.ua/dstszi/control/uk/publish/article?art_id=165943&cat_id=38837"
        ),
        new LinkItem(
          "ISO/IEC 10118-3:2018 Amendment (includes Kupyna)",
          "https://www.iso.org/standard/67116.html"
        ),
        new LinkItem(
          "Bouncy Castle Reference Implementation",
          "https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/digests/DSTU7564Digest.java"
        ),
        new LinkItem(
          "Official C Reference Implementation",
          "https://github.com/Roman-Oliynykov/Kupyna-reference"
        )
      ];

      // Official test vectors from Bouncy Castle test suite
      this.tests = [
        {
          text: "Empty string (256-bit)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes(""),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("cd5101d1ccdf0d1d1f4ada56e888cd724ca1a0838a3521e7131d4fb78d0f5eb6")
        },
        {
          text: "Single byte 'a' (256-bit)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes("61"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("c51a1d639596fb613d86557314a150c40f8fff3de48bc93a3b03c161f4105ee4")
        },
        {
          text: "String 'abc' (256-bit)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes("616263"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("0bd1b36109f1318411a0517315aa46b8839df06622a278676f5487996c9cfc04")
        },
        {
          text: "64-byte sequence (256-bit)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("08F4EE6F1BE6903B324C4E27990CB24EF69DD58DBE84813EE0A52F6631239875")
        },
        {
          text: "128-byte sequence (256-bit)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F404142434445464748494A4B4C4D4E4F505152535455565758595A5B5C5D5E5F606162636465666768696A6B6C6D6E6F707172737475767778797A7B7C7D7E7F"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("0A9474E645A7D25E255E9E89FFF42EC7EB31349007059284F0B182E452BDA882")
        },
        {
          text: "256-byte sequence (256-bit)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F404142434445464748494A4B4C4D4E4F505152535455565758595A5B5C5D5E5F606162636465666768696A6B6C6D6E6F707172737475767778797A7B7C7D7E7F808182838485868788898A8B8C8D8E8F909192939495969798999A9B9C9D9E9FA0A1A2A3A4A5A6A7A8A9AAABACADAEAFB0B1B2B3B4B5B6B7B8B9BABBBCBDBEBFC0C1C2C3C4C5C6C7C8C9CACBCCCDCECFD0D1D2D3D4D5D6D7D8D9DADBDCDDDEDFE0E1E2E3E4E5E6E7E8E9EAEBECEDEEEFF0F1F2F3F4F5F6F7F8F9FAFBFCFDFEFF"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("D305A32B963D149DC765F68594505D4077024F836C1BF03806E1624CE176C08F")
        },
        {
          text: "Single byte 0xFF (256-bit)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes("FF"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("EA7677CA4526555680441C117982EA14059EA6D0D7124D6ECDB3DEEC49E890F4")
        },
        {
          text: "95-byte sequence (256-bit)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F404142434445464748494A4B4C4D4E4F505152535455565758595A5B5C5D5E"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("1075C8B0CB910F116BDA5FA1F19C29CF8ECC75CAFF7208BA2994B68FC56E8D16")
        },
        {
          text: "95-byte sequence (384-bit)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F404142434445464748494A4B4C4D4E4F505152535455565758595A5B5C5D5E"),
          outputSize: 48,
          expected: OpCodes.Hex8ToBytes("D9021692D84E5175735654846BA751E6D0ED0FAC36DFBC0841287DCB0B5584C75016C3DECC2A6E47C50B2F3811E351B8")
        },
        {
          text: "Empty string (512-bit)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes(""),
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes("656B2F4CD71462388B64A37043EA55DBE445D452AECD46C3298343314EF04019BCFA3F04265A9857F91BE91FCE197096187CEDA78C9C1C021C294A0689198538")
        },
        {
          text: "64-byte sequence (512-bit)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F"),
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes("3813E2109118CDFB5A6D5E72F7208DCCC80A2DFB3AFDFB02F46992B5EDBE536B3560DD1D7E29C6F53978AF58B444E37BA685C0DD910533BA5D78EFFFC13DE62A")
        },
        {
          text: "128-byte sequence (512-bit)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F404142434445464748494A4B4C4D4E4F505152535455565758595A5B5C5D5E5F606162636465666768696A6B6C6D6E6F707172737475767778797A7B7C7D7E7F"),
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes("76ED1AC28B1D0143013FFA87213B4090B356441263C13E03FA060A8CADA32B979635657F256B15D5FCA4A174DE029F0B1B4387C878FCC1C00E8705D783FD7FFE")
        },
        {
          text: "256-byte sequence (512-bit)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F404142434445464748494A4B4C4D4E4F505152535455565758595A5B5C5D5E5F606162636465666768696A6B6C6D6E6F707172737475767778797A7B7C7D7E7F808182838485868788898A8B8C8D8E8F909192939495969798999A9B9C9D9E9FA0A1A2A3A4A5A6A7A8A9AAABACADAEAFB0B1B2B3B4B5B6B7B8B9BABBBCBDBEBFC0C1C2C3C4C5C6C7C8C9CACBCCCDCECFD0D1D2D3D4D5D6D7D8D9DADBDCDDDEDFE0E1E2E3E4E5E6E7E8E9EAEBECEDEEEFF0F1F2F3F4F5F6F7F8F9FAFBFCFDFEFF"),
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes("0DD03D7350C409CB3C29C25893A0724F6B133FA8B9EB90A64D1A8FA93B56556611EB187D715A956B107E3BFC76482298133A9CE8CBC0BD5E1436A5B197284F7E")
        },
        {
          text: "Single byte 0xFF (512-bit)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes("FF"),
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes("871B18CF754B72740307A97B449ABEB32B64444CC0D5A4D65830AE5456837A72D8458F12C8F06C98C616ABE11897F86263B5CB77C420FB375374BEC52B6D0292")
        },
        {
          text: "192-byte sequence (512-bit)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F404142434445464748494A4B4C4D4E4F505152535455565758595A5B5C5D5E5F606162636465666768696A6B6C6D6E6F707172737475767778797A7B7C7D7E7F808182838485868788898A8B8C8D8E8F909192939495969798999A9B9C9D9E9FA0A1A2A3A4A5A6A7A8A9AAABACADAEAFB0B1B2B3B4B5B6B7B8B9BABBBCBDBEBF"),
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes("B189BFE987F682F5F167F0D7FA565330E126B6E592B1C55D44299064EF95B1A57F3C2D0ECF17869D1D199EBBD02E8857FB8ADD67A8C31F56CD82C016CF743121")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new DSTU7564Instance(this);
    }
  }

  // ===== DSTU7564 INSTANCE CLASS =====
  /**
 * DSTU7564 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class DSTU7564Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);

      this._outputSize = 32; // Default 256-bit
      this.columns = 8;      // NB_512
      this.rounds = 10;      // NR_512
      this.blockSize = 64;   // columns * 8

      this.state = new Array(this.columns).fill(0n);
      this.state[0] = BigInt(this.blockSize);

      this.tempState1 = new Array(this.columns);
      this.tempState2 = new Array(this.columns);

      this.inputBlocks = 0;
      this.buf = [];
      this.bufOff = 0;
    }

    set outputSize(size) {
      if (size !== 32 && size !== 48 && size !== 64) {
        throw new Error("Invalid output size. Must be 32, 48, or 64 bytes");
      }

      this._outputSize = size;

      // Reconfigure based on output size
      if (size > 32) {
        this.columns = 16;  // NB_1024
        this.rounds = 14;   // NR_1024
      } else {
        this.columns = 8;   // NB_512
        this.rounds = 10;   // NR_512
      }

      this.blockSize = this.columns * 8;

      // Reset state
      this.state = new Array(this.columns).fill(0n);
      this.state[0] = BigInt(this.blockSize);

      this.tempState1 = new Array(this.columns);
      this.tempState2 = new Array(this.columns);

      this.inputBlocks = 0;
      this.buf = [];
      this.bufOff = 0;
    }

    get outputSize() {
      return this._outputSize;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      for (let i = 0; i < data.length; ++i) {
        this.buf[this.bufOff++] = data[i];

        if (this.bufOff === this.blockSize) {
          this.processBlock(this.buf, 0);
          this.bufOff = 0;
          ++this.inputBlocks;
        }
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Apply padding
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

      // Encode length in bits (96-bit field)
      const totalBits = BigInt(this.inputBlocks) * BigInt(this.blockSize) * 8n + BigInt(inputBytes) * 8n;

      // Write 96-bit length as little-endian
      for (let i = 0; i < 12; ++i) {
        this.buf[this.bufOff++] = Number((totalBits >> BigInt(i * 8))&0xFFn);
      }

      this.processBlock(this.buf, 0);

      // Final transformation
      for (let col = 0; col < this.columns; ++col) {
        this.tempState1[col] = this.state[col];
      }

      this.P(this.tempState1);

      for (let col = 0; col < this.columns; ++col) {
        this.state[col] ^= this.tempState1[col];
      }

      // Extract output
      const output = [];
      const neededColumns = OpCodes.Shr32(this._outputSize, 3);

      for (let col = this.columns - neededColumns; col < this.columns; ++col) {
        const word = this.state[col];
        // Pack as little-endian
        for (let i = 0; i < 8; ++i) {
          output.push(Number((word >> BigInt(i * 8))&0xFFn));
        }
      }

      // Reset for next use
      this.state = new Array(this.columns).fill(0n);
      this.state[0] = BigInt(this.blockSize);
      this.inputBlocks = 0;
      this.buf = [];
      this.bufOff = 0;

      return output;
    }

    // Process single block
    processBlock(input, inOff) {
      let pos = inOff;

      for (let col = 0; col < this.columns; ++col) {
        // Read 8 bytes as little-endian 64-bit word
        let word = 0n;
        for (let i = 0; i < 8; ++i) {
          word |= BigInt(OpCodes.And32(input[pos++], 0xFF)) << BigInt(i * 8);
        }

        this.tempState1[col] = this.state[col]^word;
        this.tempState2[col] = word;
      }

      this.P(this.tempState1);
      this.Q(this.tempState2);

      for (let col = 0; col < this.columns; ++col) {
        this.state[col] ^= this.tempState1[col]^this.tempState2[col];
      }
    }

    // Permutation P
    P(s) {
      for (let round = 0; round < this.rounds; ++round) {
        // AddRoundConstants
        for (let col = 0; col < this.columns; ++col) {
          s[col] ^= BigInt(round + col * 0x10);
        }

        this.shiftRows(s);
        this.subBytes(s);
        this.mixColumns(s);
      }
    }

    // Permutation Q
    Q(s) {
      for (let round = 0; round < this.rounds; ++round) {
        // AddRoundConstantsQ - matches Bouncy Castle exactly
        let rc = (BigInt(OpCodes.Xor32((this.columns - 1) << 4, round)) << 56n)|0x00F0F0F0F0F0F0F3n;

        for (let col = 0; col < this.columns; ++col) {
          s[col] = (s[col] + rc)&0xFFFFFFFFFFFFFFFFn;
          rc = (rc - 0x1000000000000000n)&0xFFFFFFFFFFFFFFFFn;
        }

        this.shiftRows(s);
        this.subBytes(s);
        this.mixColumns(s);
      }
    }

    // ShiftRows transformation
    shiftRows(s) {
      if (this.columns === 8) {
        // NB_512 case
        let c0 = s[0], c1 = s[1], c2 = s[2], c3 = s[3];
        let c4 = s[4], c5 = s[5], c6 = s[6], c7 = s[7];
        let d;

        d = (c0^c4)&0xFFFFFFFF00000000n; c0 ^= d; c4 ^= d;
        d = (c1^c5)&0x00FFFFFFFF000000n; c1 ^= d; c5 ^= d;
        d = (c2^c6)&0x0000FFFFFFFF0000n; c2 ^= d; c6 ^= d;
        d = (c3^c7)&0x000000FFFFFFFF00n; c3 ^= d; c7 ^= d;

        d = (c0^c2)&0xFFFF0000FFFF0000n; c0 ^= d; c2 ^= d;
        d = (c1^c3)&0x00FFFF0000FFFF00n; c1 ^= d; c3 ^= d;
        d = (c4^c6)&0xFFFF0000FFFF0000n; c4 ^= d; c6 ^= d;
        d = (c5^c7)&0x00FFFF0000FFFF00n; c5 ^= d; c7 ^= d;

        d = (c0^c1)&0xFF00FF00FF00FF00n; c0 ^= d; c1 ^= d;
        d = (c2^c3)&0xFF00FF00FF00FF00n; c2 ^= d; c3 ^= d;
        d = (c4^c5)&0xFF00FF00FF00FF00n; c4 ^= d; c5 ^= d;
        d = (c6^c7)&0xFF00FF00FF00FF00n; c6 ^= d; c7 ^= d;

        s[0] = c0; s[1] = c1; s[2] = c2; s[3] = c3;
        s[4] = c4; s[5] = c5; s[6] = c6; s[7] = c7;
      } else {
        // NB_1024 case
        let c00 = s[0],  c01 = s[1],  c02 = s[2],  c03 = s[3];
        let c04 = s[4],  c05 = s[5],  c06 = s[6],  c07 = s[7];
        let c08 = s[8],  c09 = s[9],  c10 = s[10], c11 = s[11];
        let c12 = s[12], c13 = s[13], c14 = s[14], c15 = s[15];
        let d;

        d = (c00^c08)&0xFF00000000000000n; c00 ^= d; c08 ^= d;
        d = (c01^c09)&0xFF00000000000000n; c01 ^= d; c09 ^= d;
        d = (c02^c10)&0xFFFF000000000000n; c02 ^= d; c10 ^= d;
        d = (c03^c11)&0xFFFFFF0000000000n; c03 ^= d; c11 ^= d;
        d = (c04^c12)&0xFFFFFFFF00000000n; c04 ^= d; c12 ^= d;
        d = (c05^c13)&0x00FFFFFFFF000000n; c05 ^= d; c13 ^= d;
        d = (c06^c14)&0x00FFFFFFFFFF0000n; c06 ^= d; c14 ^= d;
        d = (c07^c15)&0x00FFFFFFFFFFFF00n; c07 ^= d; c15 ^= d;

        d = (c00^c04)&0x00FFFFFF00000000n; c00 ^= d; c04 ^= d;
        d = (c01^c05)&0xFFFFFFFFFF000000n; c01 ^= d; c05 ^= d;
        d = (c02^c06)&0xFF00FFFFFFFF0000n; c02 ^= d; c06 ^= d;
        d = (c03^c07)&0xFF0000FFFFFFFF00n; c03 ^= d; c07 ^= d;
        d = (c08^c12)&0x00FFFFFF00000000n; c08 ^= d; c12 ^= d;
        d = (c09^c13)&0xFFFFFFFFFF000000n; c09 ^= d; c13 ^= d;
        d = (c10^c14)&0xFF00FFFFFFFF0000n; c10 ^= d; c14 ^= d;
        d = (c11^c15)&0xFF0000FFFFFFFF00n; c11 ^= d; c15 ^= d;

        d = (c00^c02)&0xFFFF0000FFFF0000n; c00 ^= d; c02 ^= d;
        d = (c01^c03)&0x00FFFF0000FFFF00n; c01 ^= d; c03 ^= d;
        d = (c04^c06)&0xFFFF0000FFFF0000n; c04 ^= d; c06 ^= d;
        d = (c05^c07)&0x00FFFF0000FFFF00n; c05 ^= d; c07 ^= d;
        d = (c08^c10)&0xFFFF0000FFFF0000n; c08 ^= d; c10 ^= d;
        d = (c09^c11)&0x00FFFF0000FFFF00n; c09 ^= d; c11 ^= d;
        d = (c12^c14)&0xFFFF0000FFFF0000n; c12 ^= d; c14 ^= d;
        d = (c13^c15)&0x00FFFF0000FFFF00n; c13 ^= d; c15 ^= d;

        d = (c00^c01)&0xFF00FF00FF00FF00n; c00 ^= d; c01 ^= d;
        d = (c02^c03)&0xFF00FF00FF00FF00n; c02 ^= d; c03 ^= d;
        d = (c04^c05)&0xFF00FF00FF00FF00n; c04 ^= d; c05 ^= d;
        d = (c06^c07)&0xFF00FF00FF00FF00n; c06 ^= d; c07 ^= d;
        d = (c08^c09)&0xFF00FF00FF00FF00n; c08 ^= d; c09 ^= d;
        d = (c10^c11)&0xFF00FF00FF00FF00n; c10 ^= d; c11 ^= d;
        d = (c12^c13)&0xFF00FF00FF00FF00n; c12 ^= d; c13 ^= d;
        d = (c14^c15)&0xFF00FF00FF00FF00n; c14 ^= d; c15 ^= d;

        s[0] = c00; s[1] = c01; s[2] = c02; s[3] = c03;
        s[4] = c04; s[5] = c05; s[6] = c06; s[7] = c07;
        s[8] = c08; s[9] = c09; s[10] = c10; s[11] = c11;
        s[12] = c12; s[13] = c13; s[14] = c14; s[15] = c15;
      }
    }

    // SubBytes transformation using S-boxes
    subBytes(s) {
      for (let i = 0; i < this.columns; ++i) {
        const u = s[i];
        const lo = Number(u&0xFFFFFFFFn);
        const hi = Number((u >> 32n)&0xFFFFFFFFn);

        // Process low 32 bits
        const t0 = S0[OpCodes.And32(lo, 0xFF)];
        const t1 = S1[OpCodes.And32(OpCodes.Shr32(lo, 8), 0xFF)];
        const t2 = S2[OpCodes.And32(OpCodes.Shr32(lo, 16), 0xFF)];
        const t3 = S3[OpCodes.Shr32(lo, 24)];
        const newLo = OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.And32(t0, 0xFF), OpCodes.Shl32(OpCodes.And32(t1, 0xFF), 8)), OpCodes.Shl32(OpCodes.And32(t2, 0xFF), 16)), OpCodes.Shl32(t3, 24));

        // Process high 32 bits
        const t4 = S0[OpCodes.And32(hi, 0xFF)];
        const t5 = S1[OpCodes.And32(OpCodes.Shr32(hi, 8), 0xFF)];
        const t6 = S2[OpCodes.And32(OpCodes.Shr32(hi, 16), 0xFF)];
        const t7 = S3[OpCodes.Shr32(hi, 24)];
        const newHi = OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.And32(t4, 0xFF), OpCodes.Shl32(OpCodes.And32(t5, 0xFF), 8)), OpCodes.Shl32(OpCodes.And32(t6, 0xFF), 16)), OpCodes.Shl32(t7, 24));

        s[i] = (BigInt(OpCodes.ToDWord(newLo))&0xFFFFFFFFn)|(BigInt(OpCodes.ToDWord(newHi)) << 32n);
      }
    }

    // MixColumns transformation
    mixColumns(s) {
      for (let col = 0; col < this.columns; ++col) {
        s[col] = this.mixColumn(s[col]);
      }
    }

    // Mix single column using GF(2^8) arithmetic
    mixColumn(c) {
      // Multiply elements by 'x' in GF(2^8) with polynomial 0x1D
      const x1 = ((c&0x7F7F7F7F7F7F7F7Fn) << 1n)^(((c&0x8080808080808080n) >> 7n) * 0x1Dn);

      // Use RIGHT rotation to match Bouncy Castle's rotate() function
      let u = OpCodes.RotR64n(c, 8)^c;
      u ^= OpCodes.RotR64n(u, 16);
      u ^= OpCodes.RotR64n(c, 48);

      let v = u^c^x1;

      // Multiply elements by 'x^2'
      v = ((v&0x3F3F3F3F3F3F3F3Fn) << 2n)^(((v&0x8080808080808080n) >> 6n) * 0x1Dn)^(((v&0x4040404040404040n) >> 6n) * 0x1Dn);

      return u^OpCodes.RotR64n(v, 32)^OpCodes.RotR64n(x1, 40)^OpCodes.RotR64n(x1, 48);
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new DSTU7564());

})(
  typeof globalThis !== 'undefined' ? globalThis :
  typeof window !== 'undefined' ? window :
  typeof global !== 'undefined' ? global :
  typeof self !== 'undefined' ? self : this
);
