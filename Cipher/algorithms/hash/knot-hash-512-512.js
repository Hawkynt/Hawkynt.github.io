/*
 * KNOT-HASH-512-512 - NIST Lightweight Cryptography Finalist
 * Professional implementation following reference specification
 * (c)2006-2025 Hawkynt
 *
 * KNOT is a family of lightweight authenticated encryption and hash algorithms
 * based on bit-slice PRESENT-like permutations. KNOT-HASH-512-512 uses the
 * KNOT-512 permutation (8-bit round constants, 140 rounds) in sponge construction
 * with 8-byte rate and 512-bit output.
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

  // KNOT-512 constants
  const STATE_SIZE = 64; // 512 bits = 64 bytes
  const RATE = 8; // 8 bytes input rate for KNOT-HASH-512-512
  const ROUNDS = 140; // Number of permutation rounds with 8-bit constants

  // Round constants for 8-bit variant (140 constants for KNOT-512 permutation)
  const RC8 = [
    0x01, 0x02, 0x04, 0x08, 0x11, 0x23, 0x47, 0x8e, 0x1c, 0x38, 0x71, 0xe2,
    0xc4, 0x89, 0x12, 0x25, 0x4b, 0x97, 0x2e, 0x5c, 0xb8, 0x70, 0xe0, 0xc0,
    0x81, 0x03, 0x06, 0x0c, 0x19, 0x32, 0x64, 0xc9, 0x92, 0x24, 0x49, 0x93,
    0x26, 0x4d, 0x9b, 0x37, 0x6e, 0xdc, 0xb9, 0x72, 0xe4, 0xc8, 0x90, 0x20,
    0x41, 0x82, 0x05, 0x0a, 0x15, 0x2b, 0x56, 0xad, 0x5b, 0xb6, 0x6d, 0xda,
    0xb5, 0x6b, 0xd6, 0xac, 0x59, 0xb2, 0x65, 0xcb, 0x96, 0x2c, 0x58, 0xb0,
    0x61, 0xc3, 0x87, 0x0f, 0x1f, 0x3e, 0x7d, 0xfb, 0xf6, 0xed, 0xdb, 0xb7,
    0x6f, 0xde, 0xbd, 0x7a, 0xf5, 0xeb, 0xd7, 0xae, 0x5d, 0xba, 0x74, 0xe8,
    0xd1, 0xa2, 0x44, 0x88, 0x10, 0x21, 0x43, 0x86, 0x0d, 0x1b, 0x36, 0x6c,
    0xd8, 0xb1, 0x63, 0xc7, 0x8f, 0x1e, 0x3c, 0x79, 0xf3, 0xe7, 0xce, 0x9c,
    0x39, 0x73, 0xe6, 0xcc, 0x98, 0x31, 0x62, 0xc5, 0x8b, 0x16, 0x2d, 0x5a,
    0xb4, 0x69, 0xd2, 0xa4, 0x48, 0x91, 0x22, 0x45
  ];

  // 128-bit left rotation
  // Input: b0 (low 64 bits as [low32, high32]), b1 (high 64 bits as [low32, high32])
  // Output: rotated result as [a0_low32, a0_high32, a1_low32, a1_high32]
  // Matches C implementation: leftRotate_128(a0, a1, b0, b1, bits)
  function rotl128(b0_l, b0_h, b1_l, b1_h, bits) {
    if (bits === 0) {
      return [b0_l, b0_h, b1_l, b1_h];
    }

    // Convert to 64-bit operations
    // We need to emulate: a0 = (b0 << bits) | (b1 >> (64 - bits))
    //                      a1 = (b1 << bits) | (b0 >> (64 - bits))

    // Helper to emulate 64-bit left shift
    function shift64L(low, high, bits) {
      if (bits === 0) return [low, high];
      if (bits >= 32) {
        return [0, (low << (bits - 32)) >>> 0];
      }
      return [
        (low << bits) >>> 0,
        ((high << bits) | (low >>> (32 - bits))) >>> 0
      ];
    }

    // Helper to emulate 64-bit right shift
    function shift64R(low, high, bits) {
      if (bits === 0) return [low, high];
      if (bits >= 32) {
        return [((high >>> (bits - 32)) | 0) >>> 0, 0];
      }
      return [
        ((low >>> bits) | (high << (32 - bits))) >>> 0,
        (high >>> bits) >>> 0
      ];
    }

    // a0 = (b0 << bits) | (b1 >> (64 - bits))
    var b0_shifted = shift64L(b0_l, b0_h, bits);
    var b1_shifted_r = shift64R(b1_l, b1_h, 64 - bits);
    var a0_l = (b0_shifted[0] | b1_shifted_r[0]) >>> 0;
    var a0_h = (b0_shifted[1] | b1_shifted_r[1]) >>> 0;

    // a1 = (b1 << bits) | (b0 >> (64 - bits))
    var b1_shifted = shift64L(b1_l, b1_h, bits);
    var b0_shifted_r = shift64R(b0_l, b0_h, 64 - bits);
    var a1_l = (b1_shifted[0] | b0_shifted_r[0]) >>> 0;
    var a1_h = (b1_shifted[1] | b0_shifted_r[1]) >>> 0;

    return [a0_l, a0_h, a1_l, a1_h];
  }

  // KNOT S-box applied to four 64-bit words in bit-sliced mode
  // Each 64-bit word is represented as [low32, high32]
  function knotSbox64(a0_l, a0_h, a1_l, a1_h, a2_l, a2_h, a3_l, a3_h) {
    // t1 = ~a0
    var t1_l = (~a0_l) >>> 0;
    var t1_h = (~a0_h) >>> 0;

    // t3 = a2 ^ (a1 & t1)
    var t3_l = (a2_l ^ (a1_l & t1_l)) >>> 0;
    var t3_h = (a2_h ^ (a1_h & t1_h)) >>> 0;

    // b3 = a3 ^ t3
    var b3_l = (a3_l ^ t3_l) >>> 0;
    var b3_h = (a3_h ^ t3_h) >>> 0;

    // t6 = a3 ^ t1
    var t6_l = (a3_l ^ t1_l) >>> 0;
    var t6_h = (a3_h ^ t1_h) >>> 0;

    // b2 = (a1 | a2) ^ t6
    var b2_l = ((a1_l | a2_l) ^ t6_l) >>> 0;
    var b2_h = ((a1_h | a2_h) ^ t6_h) >>> 0;

    // t1 = a1 ^ a3
    t1_l = (a1_l ^ a3_l) >>> 0;
    t1_h = (a1_h ^ a3_h) >>> 0;

    // a0 = t1 ^ (t3 & t6)
    var a0_new_l = (t1_l ^ (t3_l & t6_l)) >>> 0;
    var a0_new_h = (t1_h ^ (t3_h & t6_h)) >>> 0;

    // b1 = t3 ^ (b2 & t1)
    var b1_l = (t3_l ^ (b2_l & t1_l)) >>> 0;
    var b1_h = (t3_h ^ (b2_h & t1_h)) >>> 0;

    return [
      a0_new_l, a0_new_h,
      b1_l, b1_h,
      b2_l, b2_h,
      b3_l, b3_h
    ];
  }

  // KNOT-512 permutation with 8-bit round constants (140 rounds)
  // State is 8 x 64-bit words stored as S[0]...S[7] in little-endian byte array
  // S[0]=bytes[0..7], S[1]=bytes[8..15], ..., S[7]=bytes[56..63]
  function knot512Permute(stateBytes, rounds) {
    // Load state as eight 64-bit words (little-endian)
    // Each 64-bit word is split into low32 and high32
    // x0 = S[0], x1 = S[1], x2 = S[2], x3 = S[3], x4 = S[4], x5 = S[5], x6 = S[6], x7 = S[7]
    var x0_l = OpCodes.Pack32LE(stateBytes[0], stateBytes[1], stateBytes[2], stateBytes[3]);
    var x0_h = OpCodes.Pack32LE(stateBytes[4], stateBytes[5], stateBytes[6], stateBytes[7]);
    var x1_l = OpCodes.Pack32LE(stateBytes[8], stateBytes[9], stateBytes[10], stateBytes[11]);
    var x1_h = OpCodes.Pack32LE(stateBytes[12], stateBytes[13], stateBytes[14], stateBytes[15]);
    var x2_l = OpCodes.Pack32LE(stateBytes[16], stateBytes[17], stateBytes[18], stateBytes[19]);
    var x2_h = OpCodes.Pack32LE(stateBytes[20], stateBytes[21], stateBytes[22], stateBytes[23]);
    var x3_l = OpCodes.Pack32LE(stateBytes[24], stateBytes[25], stateBytes[26], stateBytes[27]);
    var x3_h = OpCodes.Pack32LE(stateBytes[28], stateBytes[29], stateBytes[30], stateBytes[31]);
    var x4_l = OpCodes.Pack32LE(stateBytes[32], stateBytes[33], stateBytes[34], stateBytes[35]);
    var x4_h = OpCodes.Pack32LE(stateBytes[36], stateBytes[37], stateBytes[38], stateBytes[39]);
    var x5_l = OpCodes.Pack32LE(stateBytes[40], stateBytes[41], stateBytes[42], stateBytes[43]);
    var x5_h = OpCodes.Pack32LE(stateBytes[44], stateBytes[45], stateBytes[46], stateBytes[47]);
    var x6_l = OpCodes.Pack32LE(stateBytes[48], stateBytes[49], stateBytes[50], stateBytes[51]);
    var x6_h = OpCodes.Pack32LE(stateBytes[52], stateBytes[53], stateBytes[54], stateBytes[55]);
    var x7_l = OpCodes.Pack32LE(stateBytes[56], stateBytes[57], stateBytes[58], stateBytes[59]);
    var x7_h = OpCodes.Pack32LE(stateBytes[60], stateBytes[61], stateBytes[62], stateBytes[63]);

    // Perform permutation rounds
    for (var r = 0; r < rounds; r++) {
      // Add round constant to first word (low 32 bits)
      x0_l = (x0_l ^ RC8[r]) >>> 0;

      // Apply S-box to both columns
      // Column 0: x0, x2, x4, x6
      var sbox0 = knotSbox64(x0_l, x0_h, x2_l, x2_h, x4_l, x4_h, x6_l, x6_h);
      x0_l = sbox0[0]; x0_h = sbox0[1];
      var b2_l = sbox0[2]; var b2_h = sbox0[3];
      var b4_l = sbox0[4]; var b4_h = sbox0[5];
      var b6_l = sbox0[6]; var b6_h = sbox0[7];

      // Column 1: x1, x3, x5, x7
      var sbox1 = knotSbox64(x1_l, x1_h, x3_l, x3_h, x5_l, x5_h, x7_l, x7_h);
      x1_l = sbox1[0]; x1_h = sbox1[1];
      var b3_l = sbox1[2]; var b3_h = sbox1[3];
      var b5_l = sbox1[4]; var b5_h = sbox1[5];
      var b7_l = sbox1[6]; var b7_h = sbox1[7];

      // Linear diffusion layer with 128-bit rotations
      // Row 1 (x2, x3): rotate left by 1
      var rot1 = rotl128(b2_l, b2_h, b3_l, b3_h, 1);
      x2_l = rot1[0]; x2_h = rot1[1]; x3_l = rot1[2]; x3_h = rot1[3];

      // Row 2 (x4, x5): rotate left by 16
      var rot2 = rotl128(b4_l, b4_h, b5_l, b5_h, 16);
      x4_l = rot2[0]; x4_h = rot2[1]; x5_l = rot2[2]; x5_h = rot2[3];

      // Row 3 (x6, x7): rotate left by 25
      var rot3 = rotl128(b6_l, b6_h, b7_l, b7_h, 25);
      x6_l = rot3[0]; x6_h = rot3[1]; x7_l = rot3[2]; x7_h = rot3[3];
    }

    // Store state back to bytes (little-endian)
    var unpacked = OpCodes.Unpack32LE(x0_l);
    stateBytes[0] = unpacked[0]; stateBytes[1] = unpacked[1];
    stateBytes[2] = unpacked[2]; stateBytes[3] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x0_h);
    stateBytes[4] = unpacked[0]; stateBytes[5] = unpacked[1];
    stateBytes[6] = unpacked[2]; stateBytes[7] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x1_l);
    stateBytes[8] = unpacked[0]; stateBytes[9] = unpacked[1];
    stateBytes[10] = unpacked[2]; stateBytes[11] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x1_h);
    stateBytes[12] = unpacked[0]; stateBytes[13] = unpacked[1];
    stateBytes[14] = unpacked[2]; stateBytes[15] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x2_l);
    stateBytes[16] = unpacked[0]; stateBytes[17] = unpacked[1];
    stateBytes[18] = unpacked[2]; stateBytes[19] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x2_h);
    stateBytes[20] = unpacked[0]; stateBytes[21] = unpacked[1];
    stateBytes[22] = unpacked[2]; stateBytes[23] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x3_l);
    stateBytes[24] = unpacked[0]; stateBytes[25] = unpacked[1];
    stateBytes[26] = unpacked[2]; stateBytes[27] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x3_h);
    stateBytes[28] = unpacked[0]; stateBytes[29] = unpacked[1];
    stateBytes[30] = unpacked[2]; stateBytes[31] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x4_l);
    stateBytes[32] = unpacked[0]; stateBytes[33] = unpacked[1];
    stateBytes[34] = unpacked[2]; stateBytes[35] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x4_h);
    stateBytes[36] = unpacked[0]; stateBytes[37] = unpacked[1];
    stateBytes[38] = unpacked[2]; stateBytes[39] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x5_l);
    stateBytes[40] = unpacked[0]; stateBytes[41] = unpacked[1];
    stateBytes[42] = unpacked[2]; stateBytes[43] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x5_h);
    stateBytes[44] = unpacked[0]; stateBytes[45] = unpacked[1];
    stateBytes[46] = unpacked[2]; stateBytes[47] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x6_l);
    stateBytes[48] = unpacked[0]; stateBytes[49] = unpacked[1];
    stateBytes[50] = unpacked[2]; stateBytes[51] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x6_h);
    stateBytes[52] = unpacked[0]; stateBytes[53] = unpacked[1];
    stateBytes[54] = unpacked[2]; stateBytes[55] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x7_l);
    stateBytes[56] = unpacked[0]; stateBytes[57] = unpacked[1];
    stateBytes[58] = unpacked[2]; stateBytes[59] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x7_h);
    stateBytes[60] = unpacked[0]; stateBytes[61] = unpacked[1];
    stateBytes[62] = unpacked[2]; stateBytes[63] = unpacked[3];
  }

  /**
 * KnotHash512 - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class KnotHash512 extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "KNOT-HASH-512-512";
      this.description = "Lightweight hash function based on bit-sliced PRESENT-like permutations, finalist in NIST Lightweight Cryptography competition. Uses KNOT-512 permutation (8-bit round constants, 140 rounds) with 512-bit state and 512-bit output.";
      this.inventor = "Zheng Gong, Guohong Liao, Ling Song, Keting Jia, Lei Hu";
      this.year = 2019;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight Hash";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CN;

      this.SupportedOutputSizes = [{ minSize: 64, maxSize: 64, stepSize: 1 }];

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
          text: "KNOT-HASH-512-512: Empty message (NIST KAT Count=1)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("729F0DC105A78582B78CD25D3B41CDEEF87D99C6C974D5D1DF4E96410ADD3B23CCFF5A3C69EB2061FD1BACFC8AAAC4E425ED2CC1407F2BEE0FB66FEF17FCEC91")
        },
        {
          text: "KNOT-HASH-512-512: Single zero byte (NIST KAT Count=2)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("C52CD4B2C4BA2D8434E92B9B282F01BE053B8DE3CFF0657716DE40442995DA4AF61347C7C431AF2D1B35799E7C19F8113BB5A69102CD0903D43D1C87C4B159BD")
        },
        {
          text: "KNOT-HASH-512-512: Two bytes (NIST KAT Count=3)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("CEE96A707A416CB1D9AA4F42E9E7268641B53E613B77F337B56AF3CB7426F411714A9ABD52FE83DF5509676D2713B250EEAA998CBE26D374A94002C93C54A618")
        },
        {
          text: "KNOT-HASH-512-512: Three bytes (NIST KAT Count=4)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102"),
          expected: OpCodes.Hex8ToBytes("CD2B323E45F1ED5C96E5A3FA90557580077B297B76EEB2EE9B6A95505DB4798E90C579F69C623B0213CD0AA38638773618887EB11A8B0FE70594DDE14DA99AF2")
        },
        {
          text: "KNOT-HASH-512-512: Four bytes (NIST KAT Count=5)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("9F6EF40003F292DCAFCC6FEA2E4F0C375A527C30190632D2F1FDA172623A11F25BA2C524580A80CEEC9D4C9297D2929FF19ED9767095A9DC4AF5D36B4B99B995")
        },
        {
          text: "KNOT-HASH-512-512: Five bytes (NIST KAT Count=6)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("0001020304"),
          expected: OpCodes.Hex8ToBytes("F0508B66FF661AB94A82C154DB81BB83BE42C238C15B4DE266701D02A5CEDBAFEA5C87BE26EFC9E132FA05FC93E6FA621B18FE457876440B61A81604A2161531")
        },
        {
          text: "KNOT-HASH-512-512: Eight bytes (NIST KAT Count=9)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("39EAC539C10EC0384E7FB96B0DF99B5A7669C55E5151580C6AE6769F9F031528036E3E65664F67B8312975E19AAA9B1BE4A20E51F2DD82981CF6340EA108A4C8")
        },
        {
          text: "KNOT-HASH-512-512: Nine bytes (NIST KAT Count=10)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708"),
          expected: OpCodes.Hex8ToBytes("E44B1FC05E514245944D1E1DF6A2B6D9B8C9C2D304C1B346FFF24CB0A77E3EEA13A72EE29AB99991C515BA0C4C02FD4047866D42B033B6996CAA88B8FF85A4C2")
        },
        {
          text: "KNOT-HASH-512-512: 16 bytes (NIST KAT Count=17)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("C544924BE5549A4694540271C191BF128B6B636D930A8C9AEF26EA0D0D8F12F801A2CB4BD39042A1B71483954445DFA8D1BC83D94F151A3E9254D599B1A0649D")
        },
        {
          text: "KNOT-HASH-512-512: 24 bytes (NIST KAT Count=25)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          expected: OpCodes.Hex8ToBytes("7A1CBC00F4F13ED3C21BD406992BBE0C71539A88CFD3D870602800842AD3C456C1564BA47252B14EF77F088650E83F2578D6C4B9BC84E6BE9951265E44A94F3A")
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
      return new KnotHash512Instance(this);
    }
  }

  /**
 * KnotHash512 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IHashFunctionInstance}
 */

  class KnotHash512Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);

      // KNOT-512 state: 64 bytes (512 bits)
      this.state = new Array(STATE_SIZE);
      this.buffer = [];

      this.Reset();
    }

    Reset() {
      // Initialize state to all zeros
      for (var i = 0; i < STATE_SIZE; i++) {
        this.state[i] = 0;
      }
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
      // Process all complete blocks (8-byte rate)
      var offset = 0;
      while (offset + RATE <= this.buffer.length) {
        // XOR rate bytes into state
        for (var i = 0; i < RATE; i++) {
          this.state[i] ^= this.buffer[offset + i];
        }
        // Apply permutation
        knot512Permute(this.state, ROUNDS);
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
      knot512Permute(this.state, ROUNDS);

      // Squeeze first half of output (32 bytes)
      var output = [];
      for (var i = 0; i < 32; i++) {
        output.push(this.state[i]);
      }

      // Apply permutation again
      knot512Permute(this.state, ROUNDS);

      // Squeeze second half of output (32 bytes)
      for (var i = 0; i < 32; i++) {
        output.push(this.state[i]);
      }

      // Clear state and reset
      this.Reset();

      return output;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new KnotHash512());

  return {
    KnotHash512: KnotHash512,
    KnotHash512Instance: KnotHash512Instance
  };
}));
