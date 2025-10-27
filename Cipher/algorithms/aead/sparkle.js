/*
 * Sparkle AEAD (Schwaemm variants) - NIST Lightweight Cryptography Finalist
 * AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * Sparkle is a family of authenticated encryption algorithms based on the ARX
 * (Add-Rotate-XOR) permutation. Schwaemm is the AEAD mode using Sparkle.
 *
 * Variants:
 * - Schwaemm128-128: 128-bit key, 128-bit nonce, 128-bit tag (SPARKLE-256)
 * - Schwaemm256-128: 128-bit key, 256-bit nonce, 128-bit tag (SPARKLE-384)
 * - Schwaemm192-192: 192-bit key, 192-bit nonce, 192-bit tag (SPARKLE-384)
 * - Schwaemm256-256: 256-bit key, 256-bit nonce, 256-bit tag (SPARKLE-512)
 *
 * Features:
 * - ARX-based permutation (hardware-friendly)
 * - Efficient on constrained devices
 * - NIST LWC finalist
 * - Sponge-based construction with duplex mode
 *
 * References:
 * - https://sparkle-lwc.github.io/
 * - NIST LWC Final Round Specification
 * - https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/sparkle-spec-final.pdf
 *
 * This implementation is for educational purposes only.
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

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AeadAlgorithm, IAeadInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== SPARKLE PERMUTATION (Reused from sparkle-hash.js) =====

  // Sparkle round constants
  const RCON = [
    0xB7E15162, 0xBF715880, 0x38B4DA56, 0x324E7738,
    0xBB1185EB, 0x4F7C7B57, 0xCFBFA1C8, 0xC2B3293D
  ];

  /**
   * ARXBox operation: ADD, ROTATE, XOR
   * @param {number} rc - Round constant
   * @param {number} s00 - First state word
   * @param {number} s01 - Second state word
   * @returns {Object} {s00, s01} - Updated state words
   */
  function ArxBox(rc, s00, s01) {
    s00 = OpCodes.ToDWord(s00 + OpCodes.RotR32(s01, 31));
    s01 ^= OpCodes.RotR32(s00, 24);
    s00 ^= rc;
    s00 = OpCodes.ToDWord(s00 + OpCodes.RotR32(s01, 17));
    s01 ^= OpCodes.RotR32(s00, 17);
    s00 ^= rc;
    s00 = OpCodes.ToDWord(s00 + s01);
    s01 ^= OpCodes.RotR32(s00, 31);
    s00 ^= rc;
    s00 = OpCodes.ToDWord(s00 + OpCodes.RotR32(s01, 24));
    s01 ^= OpCodes.RotR32(s00, 16);
    s00 ^= rc;
    return { s00: s00 >>> 0, s01: s01 >>> 0 };
  }

  /**
   * ELL function: Linear layer mixing operation
   * @param {number} x - Input word
   * @returns {number} Mixed word
   */
  function ELL(x) {
    return OpCodes.RotR32(x, 16) ^ (x & 0xFFFF);
  }

  /**
   * Sparkle permutation for 256-bit state (8 words) - SPARKLE-256
   * @param {Array<number>} state - 8-word state array
   * @param {number} steps - Number of steps (7 or 10)
   */
  function SparkleOpt8(state, steps) {
    let s00 = state[0];
    let s01 = state[1];
    let s02 = state[2];
    let s03 = state[3];
    let s04 = state[4];
    let s05 = state[5];
    let s06 = state[6];
    let s07 = state[7];

    for (let step = 0; step < steps; ++step) {
      // Add round constant
      s01 ^= RCON[step & 7];
      s03 ^= step;

      // ARXBox layer
      let result;
      result = ArxBox(RCON[0], s00, s01);
      s00 = result.s00;
      s01 = result.s01;

      result = ArxBox(RCON[1], s02, s03);
      s02 = result.s00;
      s03 = result.s01;

      result = ArxBox(RCON[2], s04, s05);
      s04 = result.s00;
      s05 = result.s01;

      result = ArxBox(RCON[3], s06, s07);
      s06 = result.s00;
      s07 = result.s01;

      // Linear layer
      const t02 = ELL(s00 ^ s02);
      const t13 = ELL(s01 ^ s03);

      const u00 = s00 ^ s04;
      const u01 = s01 ^ s05;
      const u02 = s02 ^ s06;
      const u03 = s03 ^ s07;

      s04 = s00;
      s05 = s01;
      s06 = s02;
      s07 = s03;

      s00 = u02 ^ t13;
      s01 = u03 ^ t02;
      s02 = u00 ^ t13;
      s03 = u01 ^ t02;
    }

    state[0] = s00 >>> 0;
    state[1] = s01 >>> 0;
    state[2] = s02 >>> 0;
    state[3] = s03 >>> 0;
    state[4] = s04 >>> 0;
    state[5] = s05 >>> 0;
    state[6] = s06 >>> 0;
    state[7] = s07 >>> 0;
  }

  /**
   * Sparkle permutation for 384-bit state (12 words) - SPARKLE-384
   * @param {Array<number>} state - 12-word state array
   * @param {number} steps - Number of steps (7 or 11)
   */
  function SparkleOpt12(state, steps) {
    let s00 = state[0];
    let s01 = state[1];
    let s02 = state[2];
    let s03 = state[3];
    let s04 = state[4];
    let s05 = state[5];
    let s06 = state[6];
    let s07 = state[7];
    let s08 = state[8];
    let s09 = state[9];
    let s10 = state[10];
    let s11 = state[11];

    for (let step = 0; step < steps; ++step) {
      // Add round constant
      s01 ^= RCON[step & 7];
      s03 ^= step;

      // ARXBox layer
      let result;
      result = ArxBox(RCON[0], s00, s01);
      s00 = result.s00;
      s01 = result.s01;

      result = ArxBox(RCON[1], s02, s03);
      s02 = result.s00;
      s03 = result.s01;

      result = ArxBox(RCON[2], s04, s05);
      s04 = result.s00;
      s05 = result.s01;

      result = ArxBox(RCON[3], s06, s07);
      s06 = result.s00;
      s07 = result.s01;

      result = ArxBox(RCON[4], s08, s09);
      s08 = result.s00;
      s09 = result.s01;

      result = ArxBox(RCON[5], s10, s11);
      s10 = result.s00;
      s11 = result.s01;

      // Linear layer
      const t024 = ELL(s00 ^ s02 ^ s04);
      const t135 = ELL(s01 ^ s03 ^ s05);

      const u00 = s00 ^ s06;
      const u01 = s01 ^ s07;
      const u02 = s02 ^ s08;
      const u03 = s03 ^ s09;
      const u04 = s04 ^ s10;
      const u05 = s05 ^ s11;

      s06 = s00;
      s07 = s01;
      s08 = s02;
      s09 = s03;
      s10 = s04;
      s11 = s05;

      s00 = u02 ^ t135;
      s01 = u03 ^ t024;
      s02 = u04 ^ t135;
      s03 = u05 ^ t024;
      s04 = u00 ^ t135;
      s05 = u01 ^ t024;
    }

    state[0] = s00 >>> 0;
    state[1] = s01 >>> 0;
    state[2] = s02 >>> 0;
    state[3] = s03 >>> 0;
    state[4] = s04 >>> 0;
    state[5] = s05 >>> 0;
    state[6] = s06 >>> 0;
    state[7] = s07 >>> 0;
    state[8] = s08 >>> 0;
    state[9] = s09 >>> 0;
    state[10] = s10 >>> 0;
    state[11] = s11 >>> 0;
  }

  /**
   * Sparkle permutation for 512-bit state (16 words) - SPARKLE-512
   * @param {Array<number>} state - 16-word state array
   * @param {number} steps - Number of steps (8 or 12)
   */
  function SparkleOpt16(state, steps) {
    let s00 = state[0];
    let s01 = state[1];
    let s02 = state[2];
    let s03 = state[3];
    let s04 = state[4];
    let s05 = state[5];
    let s06 = state[6];
    let s07 = state[7];
    let s08 = state[8];
    let s09 = state[9];
    let s10 = state[10];
    let s11 = state[11];
    let s12 = state[12];
    let s13 = state[13];
    let s14 = state[14];
    let s15 = state[15];

    for (let step = 0; step < steps; ++step) {
      // Add round constant
      s01 ^= RCON[step & 7];
      s03 ^= step;

      // ARXBox layer
      let result;
      result = ArxBox(RCON[0], s00, s01);
      s00 = result.s00;
      s01 = result.s01;

      result = ArxBox(RCON[1], s02, s03);
      s02 = result.s00;
      s03 = result.s01;

      result = ArxBox(RCON[2], s04, s05);
      s04 = result.s00;
      s05 = result.s01;

      result = ArxBox(RCON[3], s06, s07);
      s06 = result.s00;
      s07 = result.s01;

      result = ArxBox(RCON[4], s08, s09);
      s08 = result.s00;
      s09 = result.s01;

      result = ArxBox(RCON[5], s10, s11);
      s10 = result.s00;
      s11 = result.s01;

      result = ArxBox(RCON[6], s12, s13);
      s12 = result.s00;
      s13 = result.s01;

      result = ArxBox(RCON[7], s14, s15);
      s14 = result.s00;
      s15 = result.s01;

      // Linear layer
      const t0246 = ELL(s00 ^ s02 ^ s04 ^ s06);
      const t1357 = ELL(s01 ^ s03 ^ s05 ^ s07);

      const u00 = s00 ^ s08;
      const u01 = s01 ^ s09;
      const u02 = s02 ^ s10;
      const u03 = s03 ^ s11;
      const u04 = s04 ^ s12;
      const u05 = s05 ^ s13;
      const u06 = s06 ^ s14;
      const u07 = s07 ^ s15;

      s08 = s00;
      s09 = s01;
      s10 = s02;
      s11 = s03;
      s12 = s04;
      s13 = s05;
      s14 = s06;
      s15 = s07;

      s00 = u02 ^ t1357;
      s01 = u03 ^ t0246;
      s02 = u04 ^ t1357;
      s03 = u05 ^ t0246;
      s04 = u06 ^ t1357;
      s05 = u07 ^ t0246;
      s06 = u00 ^ t1357;
      s07 = u01 ^ t0246;
    }

    state[0] = s00 >>> 0;
    state[1] = s01 >>> 0;
    state[2] = s02 >>> 0;
    state[3] = s03 >>> 0;
    state[4] = s04 >>> 0;
    state[5] = s05 >>> 0;
    state[6] = s06 >>> 0;
    state[7] = s07 >>> 0;
    state[8] = s08 >>> 0;
    state[9] = s09 >>> 0;
    state[10] = s10 >>> 0;
    state[11] = s11 >>> 0;
    state[12] = s12 >>> 0;
    state[13] = s13 >>> 0;
    state[14] = s14 >>> 0;
    state[15] = s15 >>> 0;
  }

  // ===== SCHWAEMM128-128 ALGORITHM =====

  class Schwaemm128128Algorithm extends AeadAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Schwaemm128-128";
      this.description = "NIST Lightweight Cryptography finalist using SPARKLE-256 permutation. Compact variant with 128-bit security level for both confidentiality and authentication.";
      this.inventor = "Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.AT;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0)  // 128-bit key only
      ];
      this.SupportedTagSizes = [
        new KeySize(16, 16, 0)  // 128-bit tag only
      ];
      this.SupportsDetached = false;

      // Documentation and references
      this.documentation = [
        new LinkItem("NIST LWC Sparkle Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/sparkle-spec-final.pdf"),
        new LinkItem("Sparkle Project Website", "https://sparkle-lwc.github.io/"),
        new LinkItem("GitHub Reference Implementation", "https://github.com/cryptolu/sparkle")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [];

      // Test vectors from NIST LWC_AEAD_KAT_128_128.txt
      this.tests = [
        {
          text: "NIST LWC KAT Count=1 (empty PT, empty AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("DDCE77CDB748E6D053CAB7E9190A8349")  // Tag only
        },
        {
          text: "NIST LWC KAT Count=2 (empty PT, 1-byte AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("D2A4133E82B64F800B6DAB2403FB094D")
        },
        {
          text: "NIST LWC KAT Count=17 (empty PT, 16-byte AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: [],
          expected: OpCodes.Hex8ToBytes("8B7AEE52D40C7E0EDF9CB56FFAE5D882")
        },
        {
          text: "NIST LWC KAT Count=34 (1-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("FE2647AA4FB548ACF44067BEC0337B4D25")
        },
        {
          text: "NIST LWC KAT Count=529 (16-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("FEDAD36D1A592AEB931BA52BA4056865F5544DD3488406F6AADF8EDAAE271727")
        },
        {
          text: "NIST LWC KAT Count=1057 (32-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          expected: OpCodes.Hex8ToBytes("FEDAD36D1A592AEB931BA52BA4056865B4F5FAFF255AB36E0BCC7E4086A87ABAD8BD1EEBD6CCF00C9EA721DB29727A03")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new Schwaemm128128Instance(this, isInverse);
    }
  }

  // ===== SCHWAEMM256-128 ALGORITHM =====

  class Schwaemm256128Algorithm extends AeadAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Schwaemm256-128";
      this.description = "NIST Lightweight Cryptography finalist using SPARKLE-384 permutation. Primary recommended variant with 256-bit nonce and 128-bit security.";
      this.inventor = "Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.AT;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0)  // 128-bit key only
      ];
      this.SupportedTagSizes = [
        new KeySize(16, 16, 0)  // 128-bit tag only
      ];
      this.SupportsDetached = false;

      // Documentation and references
      this.documentation = [
        new LinkItem("NIST LWC Sparkle Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/sparkle-spec-final.pdf"),
        new LinkItem("Sparkle Project Website", "https://sparkle-lwc.github.io/"),
        new LinkItem("GitHub Reference Implementation", "https://github.com/cryptolu/sparkle")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [];

      // Test vectors from NIST LWC_AEAD_KAT_128_256.txt
      this.tests = [
        {
          text: "NIST LWC KAT Count=1 (empty PT, empty AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("2C5138C506BC537BCE8529C6827D8BBC")
        },
        {
          text: "NIST LWC KAT Count=2 (empty PT, 1-byte AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("E76ECBE4706AF3BE086CB2F7B57603E9")
        },
        {
          text: "NIST LWC KAT Count=18 (1-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("BBA2F68AA6AA63E08F85B16E65F5C36D46")
        },
        {
          text: "NIST LWC KAT Count=33 (16-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("74D71BC3B474C2A5B63866AD97330D1F4B3CC7D0F1CEAF47BD5B89B2F3D231AA")
        },
        {
          text: "NIST LWC KAT Count=49 (32-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          expected: OpCodes.Hex8ToBytes("74D71BC3B474C2A5B63866AD97330D1FAC31E6EF7AB7C0C6AF7E9CA83689A5EF44831DDADB3FCDEE")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new Schwaemm256128Instance(this, isInverse);
    }
  }

  // ===== SCHWAEMM192-192 ALGORITHM =====

  class Schwaemm192192Algorithm extends AeadAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Schwaemm192-192";
      this.description = "NIST Lightweight Cryptography finalist using SPARKLE-384 permutation. Balanced variant with 192-bit security level for both key and tag.";
      this.inventor = "Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.AT;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(24, 24, 0)  // 192-bit key only
      ];
      this.SupportedTagSizes = [
        new KeySize(24, 24, 0)  // 192-bit tag only
      ];
      this.SupportsDetached = false;

      // Documentation and references
      this.documentation = [
        new LinkItem("NIST LWC Sparkle Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/sparkle-spec-final.pdf"),
        new LinkItem("Sparkle Project Website", "https://sparkle-lwc.github.io/"),
        new LinkItem("GitHub Reference Implementation", "https://github.com/cryptolu/sparkle")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [];

      // Test vectors from NIST LWC_AEAD_KAT_192_192.txt
      this.tests = [
        {
          text: "NIST LWC KAT Count=1 (empty PT, empty AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("D3F1A7426DDDA0C2AC570031C85BCF79F7B27C68A0846BB5")
        },
        {
          text: "NIST LWC KAT Count=2 (empty PT, 1-byte AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("1B1BD18102E37E1D0F2E32B3992C1C3CBF4CEF3D7B93C851")
        },
        {
          text: "NIST LWC KAT Count=18 (1-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("EBF8002FC08D9BDD15BB7F69F0E69BAEF7B38F5C0F35D45E6F")
        },
        {
          text: "NIST LWC KAT Count=33 (24-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718"),
          expected: OpCodes.Hex8ToBytes("5DEF3EBA6DD8A0CF2D1E7CAA07B8EBBB26D7E50A5D87B8EC69CAA15C47BBF93B30F2EF97B5609D1A7B")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new Schwaemm192192Instance(this, isInverse);
    }
  }

  // ===== SCHWAEMM256-256 ALGORITHM =====

  class Schwaemm256256Algorithm extends AeadAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Schwaemm256-256";
      this.description = "NIST Lightweight Cryptography finalist using SPARKLE-512 permutation. Maximum security variant with 256-bit security level for key, nonce, and tag.";
      this.inventor = "Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.AT;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(32, 32, 0)  // 256-bit key only
      ];
      this.SupportedTagSizes = [
        new KeySize(32, 32, 0)  // 256-bit tag only
      ];
      this.SupportsDetached = false;

      // Documentation and references
      this.documentation = [
        new LinkItem("NIST LWC Sparkle Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/sparkle-spec-final.pdf"),
        new LinkItem("Sparkle Project Website", "https://sparkle-lwc.github.io/"),
        new LinkItem("GitHub Reference Implementation", "https://github.com/cryptolu/sparkle")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [];

      // Test vectors from NIST LWC_AEAD_KAT_256_256.txt
      this.tests = [
        {
          text: "NIST LWC KAT Count=1 (empty PT, empty AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("1E41C39049501061A480341DC8551F3CCE171900EB8F90BA5C54B2A7CC2BFDF2")
        },
        {
          text: "NIST LWC KAT Count=2 (empty PT, 1-byte AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("6AF0F211BC7FF4186EEA03D37025F294036BE6E90970713E5B5A630FFF07DCBE")
        },
        {
          text: "NIST LWC KAT Count=18 (1-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("0C7D0162FFB5A1C850F5471EF2E5C2C43DEB73D29C0E4FA59663F28E7AEA7CF81F")
        },
        {
          text: "NIST LWC KAT Count=33 (32-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          expected: OpCodes.Hex8ToBytes("3C81E2B3450F48F1C5A4ED3F76B4906E42DDC5084DE3B4C8530DD43C34B04AFE71CAF562CBEFF82D9D3E0CD5DCE4A7EB9F0AF5BDB0056DD40BA0D62E0F7E61C9")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new Schwaemm256256Instance(this, isInverse);
    }
  }

  // ===== SHARED SCHWAEMM INSTANCE IMPLEMENTATION =====

  class SchwaemmInstance extends IAeadInstance {
    constructor(algorithm, isInverse, variant) {
      super(algorithm);
      this.isInverse = isInverse;

      // Variant-specific configuration
      const variants = {
        '128-128': {
          STATE_WORDS: 8,
          RATE_BYTES: 16,
          STEPS_SLIM: 7,
          STEPS_BIG: 10,
          KEY_BYTES: 16,
          NONCE_BYTES: 16,
          TAG_BYTES: 16,
          permute: SparkleOpt8
        },
        '256-128': {
          STATE_WORDS: 12,
          RATE_BYTES: 32,
          STEPS_SLIM: 7,
          STEPS_BIG: 11,
          KEY_BYTES: 16,
          NONCE_BYTES: 32,
          TAG_BYTES: 16,
          permute: SparkleOpt12
        },
        '192-192': {
          STATE_WORDS: 12,
          RATE_BYTES: 24,
          STEPS_SLIM: 7,
          STEPS_BIG: 11,
          KEY_BYTES: 24,
          NONCE_BYTES: 24,
          TAG_BYTES: 24,
          permute: SparkleOpt12
        },
        '256-256': {
          STATE_WORDS: 16,
          RATE_BYTES: 32,
          STEPS_SLIM: 8,
          STEPS_BIG: 12,
          KEY_BYTES: 32,
          NONCE_BYTES: 32,
          TAG_BYTES: 32,
          permute: SparkleOpt16
        }
      };

      const config = variants[variant];
      if (!config) {
        throw new Error(`Unknown variant: ${variant}`);
      }

      // Configuration
      this.variant = variant;
      this.STATE_WORDS = config.STATE_WORDS;
      this.RATE_BYTES = config.RATE_BYTES;
      this.RATE_WORDS = config.RATE_BYTES / 4;
      this.STEPS_SLIM = config.STEPS_SLIM;
      this.STEPS_BIG = config.STEPS_BIG;
      this.KEY_BYTES = config.KEY_BYTES;
      this.NONCE_BYTES = config.NONCE_BYTES;
      this.TAG_BYTES = config.TAG_BYTES;
      this.permute = config.permute;
      this.CAP_BRANS = (this.STATE_WORDS * 4 - this.RATE_BYTES) / 8;
      this.CAP_WORDS = (this.STATE_WORDS * 4 - this.RATE_BYTES) / 4;
      this.CAP_MASK = this.RATE_WORDS > this.CAP_WORDS ? this.CAP_WORDS - 1 : -1;

      // Domain separation constants (in little-endian byte position)
      this._A0 = ((1 << this.CAP_BRANS) << 24) >>> 0;
      this._A1 = ((1 ^ (1 << this.CAP_BRANS)) << 24) >>> 0;
      this._M2 = ((2 ^ (1 << this.CAP_BRANS)) << 24) >>> 0;
      this._M3 = ((3 ^ (1 << this.CAP_BRANS)) << 24) >>> 0;

      // State
      this.state = new Array(this.STATE_WORDS);
      this._key = null;
      this._nonce = null;
      this._associatedData = [];
      this.inputBuffer = [];
      this.initialized = false;
    }

    // Property: key
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      if (keyBytes.length !== this.KEY_BYTES) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected ${this.KEY_BYTES})`);
      }

      this._key = [...keyBytes];
      this._initializeIfReady();
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property: nonce
    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(nonceBytes)) {
        throw new Error("Invalid nonce - must be byte array");
      }

      if (nonceBytes.length !== this.NONCE_BYTES) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected ${this.NONCE_BYTES})`);
      }

      this._nonce = [...nonceBytes];
      this._initializeIfReady();
    }

    get nonce() {
      return this._nonce ? [...this._nonce] : null;
    }

    // Property: associatedData
    set associatedData(adBytes) {
      if (!adBytes) {
        this._associatedData = [];
        return;
      }

      if (!Array.isArray(adBytes)) {
        throw new Error("Invalid associated data - must be byte array");
      }

      this._associatedData = [...adBytes];
    }

    get associatedData() {
      return [...this._associatedData];
    }

    _initializeIfReady() {
      if (!this._key || !this._nonce) {
        this.initialized = false;
        return;
      }

      // Initialize state: nonce in rate part, key in capacity part
      this.state.fill(0);

      // Load nonce into rate (little-endian)
      for (let i = 0; i < this.RATE_WORDS; ++i) {
        const offset = i * 4;
        this.state[i] = OpCodes.Pack32LE(
          this._nonce[offset] || 0,
          this._nonce[offset + 1] || 0,
          this._nonce[offset + 2] || 0,
          this._nonce[offset + 3] || 0
        );
      }

      // Load key into capacity (little-endian)
      const keyWords = this.KEY_BYTES / 4;
      for (let i = 0; i < keyWords; ++i) {
        const offset = i * 4;
        this.state[this.RATE_WORDS + i] = OpCodes.Pack32LE(
          this._key[offset],
          this._key[offset + 1],
          this._key[offset + 2],
          this._key[offset + 3]
        );
      }

      // Execute SPARKLE with big number of steps
      this.permute(this.state, this.STEPS_BIG);

      this.initialized = true;
    }

    /**
     * Rho operation (rate whitening without data XOR)
     * Used in encryption/decryption before XORing with message/ciphertext
     */
    _rho() {
      for (let i = 0; i < this.RATE_WORDS / 2; ++i) {
        const j = i + (this.RATE_WORDS / 2);
        const t = this.state[i];
        this.state[i] = this.state[j] ^ this.state[this.RATE_WORDS + i];
        this.state[j] ^= t ^ this.state[this.RATE_WORDS + (j & this.CAP_MASK)];
      }
    }

    /**
     * Combined Rho and rate-whitening operation
     * Processes a buffer and updates state
     * This is the core operation of the Schwaemm AEAD mode
     * @param {Array<number>} buffer - Word buffer (RATE_WORDS 32-bit words)
     * @param {boolean} forEncryption - true for encryption, false for decryption
     * @returns {Array<number>} - Output buffer (for decryption returns plaintext XOR)
     */
    _rhoWhitening(buffer, forEncryption) {
      const output = new Array(this.RATE_WORDS);

      for (let i = 0; i < this.RATE_WORDS / 2; ++i) {
        const j = i + (this.RATE_WORDS / 2);

        const s_i = this.state[i];
        const s_j = this.state[j];

        const d_i = buffer[i];
        const d_j = buffer[j];

        if (forEncryption) {
          this.state[i] =       s_j ^ d_i ^ this.state[this.RATE_WORDS + i];
          this.state[j] = s_i ^ s_j ^ d_j ^ this.state[this.RATE_WORDS + (j & this.CAP_MASK)];
        } else {
          this.state[i] = s_i ^ s_j ^ d_i ^ this.state[this.RATE_WORDS + i];
          this.state[j] = s_i       ^ d_j ^ this.state[this.RATE_WORDS + (j & this.CAP_MASK)];
        }

        output[i] = d_i ^ s_i;
        output[j] = d_j ^ s_j;
      }

      return output;
    }

    /**
     * Process associated data (following BouncyCastle pattern)
     */
    _processAAD() {
      if (!this._associatedData || this._associatedData.length === 0) {
        return;
      }

      let ad = this._associatedData;
      let adlen = ad.length;
      let pos = 0;

      // Process full blocks (but not the last one)
      while (adlen > this.RATE_BYTES) {
        // Pack AD into word buffer
        const buffer = new Array(this.RATE_WORDS);
        for (let i = 0; i < this.RATE_WORDS; ++i) {
          const offset = pos + i * 4;
          buffer[i] = OpCodes.Pack32LE(ad[offset], ad[offset + 1], ad[offset + 2], ad[offset + 3]);
        }

        // Combined rho+whitening for AD (uses encryption mode)
        for (let i = 0; i < this.RATE_WORDS / 2; ++i) {
          const j = i + (this.RATE_WORDS / 2);
          const s_i = this.state[i];
          const s_j = this.state[j];
          const d_i = buffer[i];
          const d_j = buffer[j];

          this.state[i] = s_j ^ d_i ^ this.state[this.RATE_WORDS + i];
          this.state[j] = s_i ^ s_j ^ d_j ^ this.state[this.RATE_WORDS + (j & this.CAP_MASK)];
        }

        this.permute(this.state, this.STEPS_SLIM);
        pos += this.RATE_BYTES;
        adlen -= this.RATE_BYTES;
      }

      // Process final block
      if (adlen < this.RATE_BYTES) {
        // Partial block - add padding
        this.state[this.STATE_WORDS - 1] ^= this._A0;

        const buffer = new Array(this.RATE_BYTES).fill(0);
        for (let i = 0; i < adlen; ++i) {
          buffer[i] = ad[pos + i];
        }
        buffer[adlen] = 0x80;

        const wordBuffer = new Array(this.RATE_WORDS);
        for (let i = 0; i < this.RATE_WORDS; ++i) {
          wordBuffer[i] = OpCodes.Pack32LE(
            buffer[i * 4],
            buffer[i * 4 + 1],
            buffer[i * 4 + 2],
            buffer[i * 4 + 3]
          );
        }

        // Combined rho+whitening
        for (let i = 0; i < this.RATE_WORDS / 2; ++i) {
          const j = i + (this.RATE_WORDS / 2);
          const s_i = this.state[i];
          const s_j = this.state[j];
          const d_i = wordBuffer[i];
          const d_j = wordBuffer[j];

          this.state[i] = s_j ^ d_i ^ this.state[this.RATE_WORDS + i];
          this.state[j] = s_i ^ s_j ^ d_j ^ this.state[this.RATE_WORDS + (j & this.CAP_MASK)];
        }
      } else {
        // Full final block
        this.state[this.STATE_WORDS - 1] ^= this._A1;

        const buffer = new Array(this.RATE_WORDS);
        for (let i = 0; i < this.RATE_WORDS; ++i) {
          const offset = pos + i * 4;
          buffer[i] = OpCodes.Pack32LE(ad[offset], ad[offset + 1], ad[offset + 2], ad[offset + 3]);
        }

        // Combined rho+whitening
        for (let i = 0; i < this.RATE_WORDS / 2; ++i) {
          const j = i + (this.RATE_WORDS / 2);
          const s_i = this.state[i];
          const s_j = this.state[j];
          const d_i = buffer[i];
          const d_j = buffer[j];

          this.state[i] = s_j ^ d_i ^ this.state[this.RATE_WORDS + i];
          this.state[j] = s_i ^ s_j ^ d_j ^ this.state[this.RATE_WORDS + (j & this.CAP_MASK)];
        }
      }

      this.permute(this.state, this.STEPS_BIG);
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      if (!this.initialized) {
        throw new Error("Not initialized - set key and nonce first");
      }

      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this.initialized) {
        throw new Error("Not initialized - set key and nonce first");
      }

      // Process associated data first
      this._processAAD();

      const output = [];
      let mlen = this.inputBuffer.length;
      let pos = 0;

      if (this.isInverse) {
        // Decryption mode
        if (mlen < this.TAG_BYTES) {
          throw new Error("Ciphertext too short - must include tag");
        }
        mlen -= this.TAG_BYTES;

        // Process full blocks
        while (mlen > this.RATE_BYTES) {
          // XOR ciphertext with state to get plaintext
          const stateBytes = [];
          for (let i = 0; i < this.RATE_WORDS; ++i) {
            const unpacked = OpCodes.Unpack32LE(this.state[i]);
            stateBytes.push(unpacked[0], unpacked[1], unpacked[2], unpacked[3]);
          }

          const block = [];
          for (let i = 0; i < this.RATE_BYTES; ++i) {
            block.push(this.inputBuffer[pos + i] ^ stateBytes[i]);
          }
          output.push(...block);

          // Update state: rho then XOR plaintext
          this._rho();
          for (let i = 0; i < this.RATE_WORDS; ++i) {
            const offset = i * 4;
            this.state[i] ^= OpCodes.Pack32LE(block[offset], block[offset + 1], block[offset + 2], block[offset + 3]);
          }

          this.permute(this.state, this.STEPS_SLIM);
          pos += this.RATE_BYTES;
          mlen -= this.RATE_BYTES;
        }

        // Process final block
        if (mlen === this.RATE_BYTES) {
          // Full final block
          const stateBytes = [];
          for (let i = 0; i < this.RATE_WORDS; ++i) {
            const unpacked = OpCodes.Unpack32LE(this.state[i]);
            stateBytes.push(unpacked[0], unpacked[1], unpacked[2], unpacked[3]);
          }

          const block = [];
          for (let i = 0; i < this.RATE_BYTES; ++i) {
            block.push(this.inputBuffer[pos + i] ^ stateBytes[i]);
          }
          output.push(...block);

          this.state[this.STATE_WORDS - 1] ^= this._M3;
          this._rho();
          for (let i = 0; i < this.RATE_WORDS; ++i) {
            const offset = i * 4;
            this.state[i] ^= OpCodes.Pack32LE(block[offset], block[offset + 1], block[offset + 2], block[offset + 3]);
          }
        } else if (mlen > 0) {
          // Partial final block
          const stateBytes = [];
          for (let i = 0; i < this.RATE_WORDS; ++i) {
            const unpacked = OpCodes.Unpack32LE(this.state[i]);
            stateBytes.push(unpacked[0], unpacked[1], unpacked[2], unpacked[3]);
          }

          const block = [];
          for (let i = 0; i < mlen; ++i) {
            block.push(this.inputBuffer[pos + i] ^ stateBytes[i]);
          }
          output.push(...block);

          this.state[this.STATE_WORDS - 1] ^= this._M2;
          this._rho();

          // XOR plaintext into state with padding
          for (let i = 0; i < mlen; ++i) {
            stateBytes[i] = block[i];
          }
          stateBytes[mlen] ^= 0x80;

          for (let i = 0; i < this.RATE_WORDS; ++i) {
            this.state[i] ^= OpCodes.Pack32LE(
              stateBytes[i * 4],
              stateBytes[i * 4 + 1],
              stateBytes[i * 4 + 2],
              stateBytes[i * 4 + 3]
            );
          }
        }

        this.permute(this.state, this.STEPS_BIG);

        // Generate and verify tag
        const keyWords = this.KEY_BYTES / 4;
        for (let i = 0; i < keyWords; ++i) {
          const offset = i * 4;
          this.state[this.RATE_WORDS + i] ^= OpCodes.Pack32LE(
            this._key[offset],
            this._key[offset + 1],
            this._key[offset + 2],
            this._key[offset + 3]
          );
        }

        // Extract tag from capacity
        const computedTag = [];
        const tagWords = this.TAG_BYTES / 4;
        for (let i = 0; i < tagWords; ++i) {
          const unpacked = OpCodes.Unpack32LE(this.state[this.RATE_WORDS + i]);
          computedTag.push(unpacked[0], unpacked[1], unpacked[2], unpacked[3]);
        }

        // Verify tag
        const providedTag = this.inputBuffer.slice(this.inputBuffer.length - this.TAG_BYTES);
        let tagMatch = true;
        for (let i = 0; i < this.TAG_BYTES; ++i) {
          if (computedTag[i] !== providedTag[i]) {
            tagMatch = false;
          }
        }

        if (!tagMatch) {
          throw new Error("Authentication tag verification failed");
        }

        // Reset for next operation
        this.inputBuffer = [];
        this._initializeIfReady();

        return output;

      } else {
        // Encryption mode - following reference implementation pattern

        if (mlen > 0) {
          // Process full blocks
          while (mlen > this.RATE_BYTES) {
            // XOR state with plaintext to get ciphertext
            const stateBytes = [];
            for (let i = 0; i < this.RATE_WORDS; ++i) {
              const unpacked = OpCodes.Unpack32LE(this.state[i]);
              stateBytes.push(unpacked[0], unpacked[1], unpacked[2], unpacked[3]);
            }

            const block = [];
            for (let i = 0; i < this.RATE_BYTES; ++i) {
              block.push(this.inputBuffer[pos + i] ^ stateBytes[i]);
            }

            // Update state: rho then XOR plaintext
            this._rho();
            for (let i = 0; i < this.RATE_WORDS; ++i) {
              const offset = i * 4;
              this.state[i] ^= OpCodes.Pack32LE(
                this.inputBuffer[pos + offset],
                this.inputBuffer[pos + offset + 1],
                this.inputBuffer[pos + offset + 2],
                this.inputBuffer[pos + offset + 3]
              );
            }

            this.permute(this.state, this.STEPS_SLIM);
            output.push(...block);
            pos += this.RATE_BYTES;
            mlen -= this.RATE_BYTES;
          }

          // Process final block
          if (mlen === this.RATE_BYTES) {
            // Full final block
            const stateBytes = [];
            for (let i = 0; i < this.RATE_WORDS; ++i) {
              const unpacked = OpCodes.Unpack32LE(this.state[i]);
              stateBytes.push(unpacked[0], unpacked[1], unpacked[2], unpacked[3]);
            }

            const block = [];
            for (let i = 0; i < this.RATE_BYTES; ++i) {
              block.push(this.inputBuffer[pos + i] ^ stateBytes[i]);
            }

            this.state[this.STATE_WORDS - 1] ^= this._M3;
            this._rho();
            for (let i = 0; i < this.RATE_WORDS; ++i) {
              const offset = i * 4;
              this.state[i] ^= OpCodes.Pack32LE(
                this.inputBuffer[pos + offset],
                this.inputBuffer[pos + offset + 1],
                this.inputBuffer[pos + offset + 2],
                this.inputBuffer[pos + offset + 3]
              );
            }

            output.push(...block);
          } else {
            // Partial final block
            this.state[this.STATE_WORDS - 1] ^= this._M2;

            // Pack plaintext with padding into word buffer
            const buffer = new Array(this.RATE_WORDS).fill(0);
            for (let i = 0; i < mlen; ++i) {
              buffer[i >> 2] |= this.inputBuffer[pos + i] << ((i & 3) << 3);
            }
            buffer[mlen >> 2] ^= 0x80 << ((mlen & 3) << 3);

            // Combined rho+whitening (modifies state AND buffer)
            for (let i = 0; i < this.RATE_WORDS / 2; ++i) {
              const j = i + (this.RATE_WORDS / 2);
              const s_i = this.state[i];
              const s_j = this.state[j];

              this.state[i] = s_j ^ buffer[i] ^ this.state[this.RATE_WORDS + i];
              this.state[j] = s_i ^ s_j ^ buffer[j] ^ this.state[this.RATE_WORDS + (j & this.CAP_MASK)];

              buffer[i] ^= s_i;
              buffer[j] ^= s_j;
            }

            // Extract ciphertext from buffer
            for (let i = 0; i < mlen; ++i) {
              output.push((buffer[i >> 2] >> ((i & 3) << 3)) & 0xFF);
            }
          }

          this.permute(this.state, this.STEPS_BIG);
        }

        // Tag generation
        const keyWords = this.KEY_BYTES / 4;
        for (let i = 0; i < keyWords; ++i) {
          const offset = i * 4;
          this.state[this.RATE_WORDS + i] ^= OpCodes.Pack32LE(
            this._key[offset],
            this._key[offset + 1],
            this._key[offset + 2],
            this._key[offset + 3]
          );
        }

        // Extract tag from capacity
        const tagWords = this.TAG_BYTES / 4;
        for (let i = 0; i < tagWords; ++i) {
          const unpacked = OpCodes.Unpack32LE(this.state[this.RATE_WORDS + i]);
          output.push(unpacked[0], unpacked[1], unpacked[2], unpacked[3]);
        }

        // Reset for next operation
        this.inputBuffer = [];
        this._initializeIfReady();

        return output;
      }
    }
  }

  // ===== CONCRETE INSTANCE CLASSES =====

  class Schwaemm128128Instance extends SchwaemmInstance {
    constructor(algorithm, isInverse) {
      super(algorithm, isInverse, '128-128');
    }
  }

  class Schwaemm256128Instance extends SchwaemmInstance {
    constructor(algorithm, isInverse) {
      super(algorithm, isInverse, '256-128');
    }
  }

  class Schwaemm192192Instance extends SchwaemmInstance {
    constructor(algorithm, isInverse) {
      super(algorithm, isInverse, '192-192');
    }
  }

  class Schwaemm256256Instance extends SchwaemmInstance {
    constructor(algorithm, isInverse) {
      super(algorithm, isInverse, '256-256');
    }
  }

  // ===== REGISTRATION =====

  RegisterAlgorithm(new Schwaemm128128Algorithm());
  RegisterAlgorithm(new Schwaemm256128Algorithm());
  RegisterAlgorithm(new Schwaemm192192Algorithm());
  RegisterAlgorithm(new Schwaemm256256Algorithm());

  return {
    Schwaemm128128Algorithm,
    Schwaemm256128Algorithm,
    Schwaemm192192Algorithm,
    Schwaemm256256Algorithm
  };
}));
