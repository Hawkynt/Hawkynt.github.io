/*
 * KNOT-HASH-256-256 - NIST Lightweight Cryptography Finalist
 * Professional implementation following reference specification
 * (c)2006-2025 Hawkynt
 *
 * KNOT is a family of lightweight authenticated encryption and hash algorithms
 * based on bit-slice PRESENT-like permutations. KNOT-HASH-256-256 uses the
 * KNOT-256 permutation in sponge construction with 4-byte rate.
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

  // KNOT-256 constants
  const STATE_SIZE = 32; // 256 bits = 32 bytes
  const RATE = 4; // 4 bytes input rate for KNOT-HASH-256-256
  const ROUNDS = 68; // Number of permutation rounds

  // Round constants for 7-bit variant (104 constants, we use first 68)
  const RC7 = [
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x41, 0x03, 0x06, 0x0c, 0x18, 0x30,
    0x61, 0x42, 0x05, 0x0a, 0x14, 0x28, 0x51, 0x23, 0x47, 0x0f, 0x1e, 0x3c,
    0x79, 0x72, 0x64, 0x48, 0x11, 0x22, 0x45, 0x0b, 0x16, 0x2c, 0x59, 0x33,
    0x67, 0x4e, 0x1d, 0x3a, 0x75, 0x6a, 0x54, 0x29, 0x53, 0x27, 0x4f, 0x1f,
    0x3e, 0x7d, 0x7a, 0x74, 0x68, 0x50, 0x21, 0x43, 0x07, 0x0e, 0x1c, 0x38,
    0x71, 0x62, 0x44, 0x09, 0x12, 0x24, 0x49, 0x13
  ];

  // 64-bit rotation helpers using pairs of 32-bit words [low, high]
  function rotl64(low, high, positions) {
    positions %= 64;
    if (positions === 0) return [low, high];
    if (positions === 32) return [high, low];

    if (positions < 32) {
      return [
        ((low << positions) | (high >>> (32 - positions))) >>> 0,
        ((high << positions) | (low >>> (32 - positions))) >>> 0
      ];
    }

    positions -= 32;
    return [
      ((high << positions) | (low >>> (32 - positions))) >>> 0,
      ((low << positions) | (high >>> (32 - positions))) >>> 0
    ];
  }

  // KNOT S-box applied to four 64-bit words in bit-sliced mode
  // Input: a0, a1, a2, a3 (each as [low, high] pairs)
  // Output: returns [a0_new, b1, b2, b3]
  function knotSbox64(a0, a1, a2, a3) {
    // All operations on [low, high] pairs
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

  // KNOT-256 permutation with 7-bit round constants
  // State is 4 x 64-bit words stored as byte array (little-endian)
  function knot256Permute(stateBytes, rounds) {
    // Load state as four 64-bit words (little-endian)
    var x0 = [
      OpCodes.Pack32LE(stateBytes[0], stateBytes[1], stateBytes[2], stateBytes[3]),
      OpCodes.Pack32LE(stateBytes[4], stateBytes[5], stateBytes[6], stateBytes[7])
    ];
    var x1 = [
      OpCodes.Pack32LE(stateBytes[8], stateBytes[9], stateBytes[10], stateBytes[11]),
      OpCodes.Pack32LE(stateBytes[12], stateBytes[13], stateBytes[14], stateBytes[15])
    ];
    var x2 = [
      OpCodes.Pack32LE(stateBytes[16], stateBytes[17], stateBytes[18], stateBytes[19]),
      OpCodes.Pack32LE(stateBytes[20], stateBytes[21], stateBytes[22], stateBytes[23])
    ];
    var x3 = [
      OpCodes.Pack32LE(stateBytes[24], stateBytes[25], stateBytes[26], stateBytes[27]),
      OpCodes.Pack32LE(stateBytes[28], stateBytes[29], stateBytes[30], stateBytes[31])
    ];

    // Perform permutation rounds
    for (var r = 0; r < rounds; r++) {
      // Add round constant to first word
      x0[0] = (x0[0] ^ RC7[r]) >>> 0;

      // Apply S-box
      var sboxResult = knotSbox64(x0, x1, x2, x3);
      x0 = sboxResult[0];
      var b1 = sboxResult[1];
      var b2 = sboxResult[2];
      var b3 = sboxResult[3];

      // Linear diffusion layer with rotations
      x1 = rotl64(b1[0], b1[1], 1);   // rotate left by 1
      x2 = rotl64(b2[0], b2[1], 8);   // rotate left by 8
      x3 = rotl64(b3[0], b3[1], 25);  // rotate left by 25
    }

    // Store state back to bytes (little-endian)
    var unpacked = OpCodes.Unpack32LE(x0[0]);
    stateBytes[0] = unpacked[0]; stateBytes[1] = unpacked[1];
    stateBytes[2] = unpacked[2]; stateBytes[3] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x0[1]);
    stateBytes[4] = unpacked[0]; stateBytes[5] = unpacked[1];
    stateBytes[6] = unpacked[2]; stateBytes[7] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x1[0]);
    stateBytes[8] = unpacked[0]; stateBytes[9] = unpacked[1];
    stateBytes[10] = unpacked[2]; stateBytes[11] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x1[1]);
    stateBytes[12] = unpacked[0]; stateBytes[13] = unpacked[1];
    stateBytes[14] = unpacked[2]; stateBytes[15] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x2[0]);
    stateBytes[16] = unpacked[0]; stateBytes[17] = unpacked[1];
    stateBytes[18] = unpacked[2]; stateBytes[19] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x2[1]);
    stateBytes[20] = unpacked[0]; stateBytes[21] = unpacked[1];
    stateBytes[22] = unpacked[2]; stateBytes[23] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x3[0]);
    stateBytes[24] = unpacked[0]; stateBytes[25] = unpacked[1];
    stateBytes[26] = unpacked[2]; stateBytes[27] = unpacked[3];

    unpacked = OpCodes.Unpack32LE(x3[1]);
    stateBytes[28] = unpacked[0]; stateBytes[29] = unpacked[1];
    stateBytes[30] = unpacked[2]; stateBytes[31] = unpacked[3];
  }

  class KnotHash256 extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "KNOT-HASH-256-256";
      this.description = "Lightweight hash function based on bit-sliced PRESENT-like permutations, finalist in NIST Lightweight Cryptography competition. Uses KNOT-256 permutation in sponge construction with 256-bit output.";
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
          text: "KNOT-HASH-256-256: Empty message (NIST KAT Count=1)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("CF1AC5B7AA08D36D544E2D2049D0D0A5F1F6FF7B553D18035E69323D8E4118B1")
        },
        {
          text: "KNOT-HASH-256-256: Single zero byte (NIST KAT Count=2)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("1B8F1C5978ADCE6C4BAC3715E304A0F3026F873820CA4A6386CBFD0A3709949C")
        },
        {
          text: "KNOT-HASH-256-256: Two bytes (NIST KAT Count=3)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("3CFF1E8CD8CAC2FEEB696969251F828AA2288D8CCBBECBAF422634577FCED63B")
        },
        {
          text: "KNOT-HASH-256-256: Four bytes (NIST KAT Count=5)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("8410C4BBD8828E9D9A2183F23918B5F45182735560A2E1D142884D10B66327A8")
        },
        {
          text: "KNOT-HASH-256-256: Eight bytes (NIST KAT Count=9)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("6B8CCC0A32775C876B63E8E146E103172188287CDF7ED236CD5D6276C16C6B76")
        },
        {
          text: "KNOT-HASH-256-256: 16 bytes (NIST KAT Count=17)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("3D1BB21C5B2FDB385DB2231896467CC987E9EB5CCC622F88E9FA45AFEF66B6AB")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new KnotHash256Instance(this);
    }
  }

  class KnotHash256Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);

      // KNOT-256 state: 32 bytes (256 bits)
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

    Feed(data) {
      if (!data || data.length === 0) return;

      // Add data to buffer
      for (var i = 0; i < data.length; i++) {
        this.buffer.push(data[i]);
      }
    }

    Result() {
      // Process all complete blocks
      var offset = 0;
      while (offset + RATE <= this.buffer.length) {
        // XOR rate bytes into state
        for (var i = 0; i < RATE; i++) {
          this.state[i] ^= this.buffer[offset + i];
        }
        // Apply permutation
        knot256Permute(this.state, ROUNDS);
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
      knot256Permute(this.state, ROUNDS);

      // Squeeze first half of output (16 bytes)
      var output = [];
      for (var i = 0; i < 16; i++) {
        output.push(this.state[i]);
      }

      // Apply permutation again
      knot256Permute(this.state, ROUNDS);

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
  RegisterAlgorithm(new KnotHash256());

  return {
    KnotHash256: KnotHash256,
    KnotHash256Instance: KnotHash256Instance
  };
}));
