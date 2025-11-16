/*
 * KNOT-HASH-256-384 - NIST Lightweight Cryptography Finalist
 * Professional implementation following reference specification
 * (c)2006-2025 Hawkynt
 *
 * KNOT is a family of lightweight authenticated encryption and hash algorithms
 * based on bit-slice PRESENT-like permutations. KNOT-HASH-256-384 uses the
 * KNOT-384 permutation in sponge construction with 16-byte rate and 256-bit output.
 *
 * Reference: https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/knot-spec-final.pdf
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

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem } = AlgorithmFramework;

  // KNOT-384 constants
  const STATE_SIZE = 48; // 384 bits = 48 bytes
  const RATE = 16; // 16 bytes input rate for KNOT-HASH-256-384
  const ROUNDS = 80; // Number of permutation rounds

  // Round constants for 7-bit variant (104 constants, we use first 80)
  const RC7 = [
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x41, 0x03, 0x06, 0x0c, 0x18, 0x30,
    0x61, 0x42, 0x05, 0x0a, 0x14, 0x28, 0x51, 0x23, 0x47, 0x0f, 0x1e, 0x3c,
    0x79, 0x72, 0x64, 0x48, 0x11, 0x22, 0x45, 0x0b, 0x16, 0x2c, 0x59, 0x33,
    0x67, 0x4e, 0x1d, 0x3a, 0x75, 0x6a, 0x54, 0x29, 0x53, 0x27, 0x4f, 0x1f,
    0x3e, 0x7d, 0x7a, 0x74, 0x68, 0x50, 0x21, 0x43, 0x07, 0x0e, 0x1c, 0x38,
    0x71, 0x62, 0x44, 0x09, 0x12, 0x24, 0x49, 0x13, 0x26, 0x4d, 0x1b, 0x36,
    0x6d, 0x5a, 0x35, 0x6b, 0x56, 0x2d, 0x5b, 0x37
  ];

  // KNOT S-box applied to four 64-bit words in bit-sliced mode
  // Input: a0, a1, a2, a3 (each as [low, high] pairs)
  // Output: returns [a0_new, b1, b2, b3]
  function knotSbox64(a0, a1, a2, a3) {
    var t1_l = (~a0[0]) >>> 0;
    var t1_h = (~a0[1]) >>> 0;

    var t3_l = (a2[0] ^ (a1[0] & t1_l)) >>> 0;
    var t3_h = (a2[1] ^ (a1[1] & t1_h)) >>> 0;

    var b3_l = (a3[0] ^ t3_l) >>> 0;
    var b3_h = (a3[1] ^ t3_h) >>> 0;

    var t6_l = (a3[0] ^ t1_l) >>> 0;
    var t6_h = (a3[1] ^ t1_h) >>> 0;

    var b2_l = ((a1[0] | a2[0]) ^ t6_l) >>> 0;
    var b2_h = ((a1[1] | a2[1]) ^ t6_h) >>> 0;

    t1_l = (a1[0] ^ a3[0]) >>> 0;
    t1_h = (a1[1] ^ a3[1]) >>> 0;

    var a0_l = (t1_l ^ (t3_l & t6_l)) >>> 0;
    var a0_h = (t1_h ^ (t3_h & t6_h)) >>> 0;

    var b1_l = (t3_l ^ (b2_l & t1_l)) >>> 0;
    var b1_h = (t3_h ^ (b2_h & t1_h)) >>> 0;

    return [
      [a0_l, a0_h],
      [b1_l, b1_h],
      [b2_l, b2_h],
      [b3_l, b3_h]
    ];
  }

  // KNOT S-box applied to four 32-bit words in bit-sliced mode
  function knotSbox32(a0, a1, a2, a3) {
    var t1 = (~a0) >>> 0;
    var t3 = (a2 ^ (a1 & t1)) >>> 0;
    var b3 = (a3 ^ t3) >>> 0;
    var t6 = (a3 ^ t1) >>> 0;
    var b2 = ((a1 | a2) ^ t6) >>> 0;
    t1 = (a1 ^ a3) >>> 0;
    var a0_new = (t1 ^ (t3 & t6)) >>> 0;
    var b1 = (t3 ^ (b2 & t1)) >>> 0;

    return [a0_new, b1, b2, b3];
  }

  // 96-bit rotation helpers
  // Input: 96-bit value as [low64_l (32-bit), low64_h (32-bit), high32 (32-bit)]
  // Represents: bits 0-31, bits 32-63, bits 64-95
  // Reference C macro: leftRotateShort_96(a0, a1, b0, b1, bits) where b0=64-bit, b1=32-bit

  // Short rotation (for 1 and 8 bit rotations)
  function rotl96Short(low64_l, low64_h, high32, bits) {
    // C reference:
    // a0 (64-bit) = (b0 << bits) | (b1 >> (32 - bits))
    // a1 (32-bit) = (b1 << bits) | (b0 >> (64 - bits))
    //
    // Where b0 is 64-bit [low64_l | low64_h] and b1 is 32-bit high32
    //
    // For a0 (64-bit result):
    //   (b0 << bits) shifts the 64-bit value left
    //   (b1 >> (32 - bits)) provides wrap-around bits into LOW part
    //
    // For a1 (32-bit result):
    //   (b1 << bits) shifts the 32-bit value left
    //   (b0 >> (64 - bits)) provides wrap-around bits from HIGH part of b0

    // Calculate a0 (64-bit):
    // (b0 << bits): shift 64-bit left by bits
    var b0_shift_low, b0_shift_high;
    if (bits === 0) {
      b0_shift_low = low64_l;
      b0_shift_high = low64_h;
    } else if (bits < 32) {
      b0_shift_low = (low64_l << bits) >>> 0;
      b0_shift_high = ((low64_h << bits) | (low64_l >>> (32 - bits))) >>> 0;
    } else {
      b0_shift_low = 0;
      b0_shift_high = (low64_l << (bits - 32)) >>> 0;
    }

    // (b1 >> (32 - bits)): shift 32-bit right
    var b1_shift = (high32 >>> (32 - bits)) >>> 0;

    // Combine for a0 - the b1_shift bits go into the LOW 32 bits
    var a0_low = (b0_shift_low | b1_shift) >>> 0;
    var a0_high = b0_shift_high;

    // Calculate a1 (32-bit):
    // (b1 << bits): shift 32-bit left
    var a1_from_b1 = (high32 << bits) >>> 0;

    // (b0 >> (64 - bits)): shift 64-bit right to get top bits
    var shift_right = 64 - bits;
    var a1_from_b0;
    if (shift_right >= 32) {
      // Shifting by 32 or more, so we take from low64_h
      a1_from_b0 = (low64_h >>> (shift_right - 32)) >>> 0;
    } else {
      // Shifting by less than 32, spans both parts
      a1_from_b0 = ((low64_h >>> shift_right) | (low64_l << (32 - shift_right))) >>> 0;
    }

    var a1 = (a1_from_b1 | a1_from_b0) >>> 0;

    return [a0_low, a0_high, a1];
  }

  // Long rotation (for 55 bit rotation)
  function rotl96Long(low64_l, low64_h, high32, bits) {
    // C reference:
    // a0 (64-bit) = (b0 << bits) | (b1 << (bits - 32)) | (b0 >> (96 - bits))
    // a1 (32-bit) = (uint32_t)((b0 << (bits - 32)) >> 32)
    //
    // For bits=55:
    // a0 = (b0 << 55) | (b1 << 23) | (b0 >> 41)
    // a1 = (b0 << 23) >> 32
    //
    // Where b0 is 64-bit [low64_l | low64_h] and b1 is 32-bit high32

    var shift1 = bits;        // 55
    var shift2 = bits - 32;   // 23
    var shift3 = 96 - bits;   // 41

    // Part 1: (b0 << 55)
    // 55 = 32 + 23, so low part is 0, high part is (low64_l << 23)
    var p1_low = 0;
    var p1_high = (low64_l << shift2) >>> 0;

    // Part 2: (b1 << 23) - this is a 64-bit result where b1 (32-bit) is promoted
    // Result: low 32 bits = (b1 << 23), high 32 bits = (b1 >> 9)
    var p2_low = (high32 << shift2) >>> 0;
    var p2_high = (high32 >>> (32 - shift2)) >>> 0;

    // Part 3: (b0 >> 41)
    // 41 = 32 + 9, so we shift right by 9 from the high part
    // Result: low 32 bits = (low64_h >> 9), high 32 bits = 0
    var p3_low = (low64_h >>> (shift3 - 32)) >>> 0;
    var p3_high = 0;

    // Combine for a0
    var a0_low = (p1_low | p2_low | p3_low) >>> 0;
    var a0_high = (p1_high | p2_high | p3_high) >>> 0;

    // Calculate a1: (b0 << 23) >> 32
    // (b0 << 23): shift 64-bit left by 23
    // Low part: (low64_l << 23)
    // High part: (low64_h << 23) | (low64_l >> 9)
    // Then >> 32 means we take the high part
    var a1 = ((low64_h << shift2) | (low64_l >>> (32 - shift2))) >>> 0;

    return [a0_low, a0_high, a1];
  }

  // KNOT-384 permutation with 7-bit round constants
  // State is 4 x 96-bit words stored as byte array (little-endian)
  // State layout (48 bytes = 384 bits):
  // - x0 (64-bit): bytes 0-7
  // - x1 (32-bit): bytes 8-11
  // - x2 (64-bit): bytes 12-19
  // - x3 (32-bit): bytes 20-23
  // - x4 (64-bit): bytes 24-31
  // - x5 (32-bit): bytes 32-35
  // - x6 (64-bit): bytes 36-43
  // - x7 (32-bit): bytes 44-47
  function knot384Permute(stateBytes, rounds) {
    // Load state matching C reference implementation
    // x0 = S[0] (64-bit, bytes 0-7)
    var x0_l = OpCodes.Pack32LE(stateBytes[0], stateBytes[1], stateBytes[2], stateBytes[3]);
    var x0_h = OpCodes.Pack32LE(stateBytes[4], stateBytes[5], stateBytes[6], stateBytes[7]);

    // x1 = W[2] (32-bit, bytes 8-11)
    var x1 = OpCodes.Pack32LE(stateBytes[8], stateBytes[9], stateBytes[10], stateBytes[11]);

    // x2 = W[3] | (W[4] << 32) (64-bit, bytes 12-19)
    var x2_l = OpCodes.Pack32LE(stateBytes[12], stateBytes[13], stateBytes[14], stateBytes[15]);
    var x2_h = OpCodes.Pack32LE(stateBytes[16], stateBytes[17], stateBytes[18], stateBytes[19]);

    // x3 = W[5] (32-bit, bytes 20-23)
    var x3 = OpCodes.Pack32LE(stateBytes[20], stateBytes[21], stateBytes[22], stateBytes[23]);

    // x4 = S[3] (64-bit, bytes 24-31)
    var x4_l = OpCodes.Pack32LE(stateBytes[24], stateBytes[25], stateBytes[26], stateBytes[27]);
    var x4_h = OpCodes.Pack32LE(stateBytes[28], stateBytes[29], stateBytes[30], stateBytes[31]);

    // x5 = W[8] (32-bit, bytes 32-35)
    var x5 = OpCodes.Pack32LE(stateBytes[32], stateBytes[33], stateBytes[34], stateBytes[35]);

    // x6 = W[9] | (W[10] << 32) (64-bit, bytes 36-43)
    var x6_l = OpCodes.Pack32LE(stateBytes[36], stateBytes[37], stateBytes[38], stateBytes[39]);
    var x6_h = OpCodes.Pack32LE(stateBytes[40], stateBytes[41], stateBytes[42], stateBytes[43]);

    // x7 = W[11] (32-bit, bytes 44-47)
    var x7 = OpCodes.Pack32LE(stateBytes[44], stateBytes[45], stateBytes[46], stateBytes[47]);

    // Perform permutation rounds
    for (var r = 0; r < rounds; r++) {
      // Add round constant to first 64-bit word
      x0_l = (x0_l ^ RC7[r]) >>> 0;

      // Apply S-box to 64-bit parts
      var sboxResult64 = knotSbox64([x0_l, x0_h], [x2_l, x2_h], [x4_l, x4_h], [x6_l, x6_h]);
      var new_x0 = sboxResult64[0];
      var b2 = sboxResult64[1];
      var b4 = sboxResult64[2];
      var b6 = sboxResult64[3];

      x0_l = new_x0[0];
      x0_h = new_x0[1];

      // Apply S-box to 32-bit parts
      var sboxResult32 = knotSbox32(x1, x3, x5, x7);
      x1 = sboxResult32[0];
      var b3 = sboxResult32[1];
      var b5 = sboxResult32[2];
      var b7 = sboxResult32[3];

      // Linear diffusion layer with 96-bit rotations
      // Rotate by 1 bit
      var rot1 = rotl96Short(b2[0], b2[1], b3, 1);
      x2_l = rot1[0];
      x2_h = rot1[1];
      x3 = rot1[2];

      // Rotate by 8 bits
      var rot8 = rotl96Short(b4[0], b4[1], b5, 8);
      x4_l = rot8[0];
      x4_h = rot8[1];
      x5 = rot8[2];

      // Rotate by 55 bits
      var rot55 = rotl96Long(b6[0], b6[1], b7, 55);
      x6_l = rot55[0];
      x6_h = rot55[1];
      x7 = rot55[2];
    }

    // Store state back to bytes (little-endian)
    var unpacked = OpCodes.Unpack32LE(x0_l);
    stateBytes[0] = unpacked[0]; stateBytes[1] = unpacked[1];
    stateBytes[2] = unpacked[2]; stateBytes[3] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x0_h);
    stateBytes[4] = unpacked[0]; stateBytes[5] = unpacked[1];
    stateBytes[6] = unpacked[2]; stateBytes[7] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x1);
    stateBytes[8] = unpacked[0]; stateBytes[9] = unpacked[1];
    stateBytes[10] = unpacked[2]; stateBytes[11] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x2_l);
    stateBytes[12] = unpacked[0]; stateBytes[13] = unpacked[1];
    stateBytes[14] = unpacked[2]; stateBytes[15] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x2_h);
    stateBytes[16] = unpacked[0]; stateBytes[17] = unpacked[1];
    stateBytes[18] = unpacked[2]; stateBytes[19] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x3);
    stateBytes[20] = unpacked[0]; stateBytes[21] = unpacked[1];
    stateBytes[22] = unpacked[2]; stateBytes[23] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x4_l);
    stateBytes[24] = unpacked[0]; stateBytes[25] = unpacked[1];
    stateBytes[26] = unpacked[2]; stateBytes[27] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x4_h);
    stateBytes[28] = unpacked[0]; stateBytes[29] = unpacked[1];
    stateBytes[30] = unpacked[2]; stateBytes[31] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x5);
    stateBytes[32] = unpacked[0]; stateBytes[33] = unpacked[1];
    stateBytes[34] = unpacked[2]; stateBytes[35] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x6_l);
    stateBytes[36] = unpacked[0]; stateBytes[37] = unpacked[1];
    stateBytes[38] = unpacked[2]; stateBytes[39] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x6_h);
    stateBytes[40] = unpacked[0]; stateBytes[41] = unpacked[1];
    stateBytes[42] = unpacked[2]; stateBytes[43] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x7);
    stateBytes[44] = unpacked[0]; stateBytes[45] = unpacked[1];
    stateBytes[46] = unpacked[2]; stateBytes[47] = unpacked[3];
  }

  /**
 * KnotHash256_384 - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class KnotHash256_384 extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "KNOT-HASH-256-384";
      this.description = "Lightweight hash function based on bit-sliced PRESENT-like permutations, finalist in NIST Lightweight Cryptography competition. Uses KNOT-384 permutation with 256-bit output.";
      this.inventor = "Zheng Gong, Guohong Liao, Ling Song, Keting Jia, Lei Hu";
      this.year = 2019;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight Hash";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CN;

      this.SupportedOutputSizes = [{ minSize: 32, maxSize: 32, stepSize: 1 }];

      this.documentation = [
        new LinkItem(
          "KNOT Specification (NIST LWC)",
          "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/knot-spec-final.pdf"
        ),
        new LinkItem(
          "NIST Lightweight Cryptography",
          "https://csrc.nist.gov/projects/lightweight-cryptography"
        ),
        new LinkItem(
          "KNOT Official Website",
          "https://www.knotcipher.com/"
        )
      ];

      // Official test vectors from NIST LWC KAT
      this.tests = [
        {
          text: "KNOT-HASH-256-384: Empty message (NIST KAT Count=1)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("5025252949BF0EBF9D750D2E11AB5C75E4F7B8DCA426B58EA2AE52A857653E04")
        },
        {
          text: "KNOT-HASH-256-384: Single zero byte (NIST KAT Count=2)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("C15C34623E347C0D3F73B84D8F1706F4F95C5640A1AB8DB43FD7B07E07AD0397")
        },
        {
          text: "KNOT-HASH-256-384: Two bytes (NIST KAT Count=3)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("53CA8EC8BFBB0610154C86019BDBB45C70706696120233D61EC1199BCCAD8CD3")
        },
        {
          text: "KNOT-HASH-256-384: Three bytes (NIST KAT Count=4)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102"),
          expected: OpCodes.Hex8ToBytes("9E6908918B5445FFAC8321B0D8EB83A47D0C2C858CDAD1DBC81DB70F9DF012ED")
        },
        {
          text: "KNOT-HASH-256-384: Four bytes (NIST KAT Count=5)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("21EF8A4C2E600A3D2B40DE5A80E6BA4B664116A1383F26EF95AD1892BE649CD5")
        },
        {
          text: "KNOT-HASH-256-384: Eight bytes (NIST KAT Count=9)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("DF3DBEFA6AB5194E5692C7FEF78C442F6A6FEAF262ADB5F3630682B58FE3766F")
        },
        {
          text: "KNOT-HASH-256-384: 16 bytes (NIST KAT Count=17)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("B3F056368184838CC83DFB0E7466E439A010743AE7C03E55022D116B5C3733B3")
        },
        {
          text: "KNOT-HASH-256-384: 32 bytes (NIST KAT Count=33)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          expected: OpCodes.Hex8ToBytes("4968D39797D02A81928E67B085E06F5C9DFB44A1FD8D49F3029B9AF126783B54")
        },
        {
          text: "KNOT-HASH-256-384: 48 bytes (NIST KAT Count=49)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F"),
          expected: OpCodes.Hex8ToBytes("8D818B7B903BA04A94CF0992B89A2988BA086C339096D16DFD636B4A3F7BD743")
        },
        {
          text: "KNOT-HASH-256-384: 64 bytes (NIST KAT Count=65)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F"),
          expected: OpCodes.Hex8ToBytes("C38B93AAC496B1376A1E53E7A82A2836A5141A08BC91F48291D1446921A535B8")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new KnotHash256_384Instance(this);
    }
  }

  /**
 * KnotHash256_384 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class KnotHash256_384Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);

      // KNOT-384 state: 48 bytes (384 bits)
      this.state = new Array(STATE_SIZE);
      this.buffer = [];

      this.Reset();
    }

    Reset() {
      // Initialize state to all zeros
      for (var i = 0; i < STATE_SIZE; i++) {
        this.state[i] = 0;
      }

      // Set domain separator: XOR 0x80 at last byte position
      this.state[STATE_SIZE - 1] ^= 0x80;

      this.buffer = [];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Add data to buffer
      for (var i = 0; i < data.length; i++) {
        this.buffer.push(data[i]);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Process all complete blocks
      var offset = 0;
      while (offset + RATE <= this.buffer.length) {
        // XOR rate bytes into state
        for (var i = 0; i < RATE; i++) {
          this.state[i] ^= this.buffer[offset + i];
        }
        // Apply permutation
        knot384Permute(this.state, ROUNDS);
        offset += RATE;
      }

      // Process final partial block
      var remaining = this.buffer.length - offset;
      for (var i = 0; i < remaining; i++) {
        this.state[i] ^= this.buffer[offset + i];
      }

      // Add padding: XOR 0x01 at position after last data byte
      this.state[remaining] ^= 0x01;

      // Apply permutation
      knot384Permute(this.state, ROUNDS);

      // Squeeze first half of output (16 bytes)
      var output = [];
      for (var i = 0; i < 16; i++) {
        output.push(this.state[i]);
      }

      // Apply permutation again
      knot384Permute(this.state, ROUNDS);

      // Squeeze second half of output (16 bytes)
      for (var i = 0; i < 16; i++) {
        output.push(this.state[i]);
      }

      // Clear state and reset
      this.Reset();

      return output;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new KnotHash256_384());

  return {
    KnotHash256_384: KnotHash256_384,
    KnotHash256_384Instance: KnotHash256_384Instance
  };
}));
