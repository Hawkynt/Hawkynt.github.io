/*
 * DryGASCON128 AEAD - NIST Lightweight Cryptography Finalist
 * Professional implementation following the DryGASCON specification
 * (c)2006-2025 Hawkynt
 *
 * DryGASCON128 is a family of authenticated encryption algorithms based on the
 * DrySPONGE construction using a generalized GASCON permutation. The algorithm
 * was a finalist in NIST's Lightweight Cryptography competition and provides
 * protection against power analysis attacks through its unique sponge design.
 *
 * This implementation provides DryGASCON128k16 with:
 * - 16-byte (128-bit) key
 * - 16-byte (128-bit) nonce
 * - 16-byte (128-bit) authentication tag
 * - Variable message and associated data length
 *
 * Reference: https://github.com/sebastien-riou/DryGASCON
 * NIST LWC: https://csrc.nist.gov/projects/lightweight-cryptography
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
          AeadAlgorithm, IAeadInstance, LinkItem, KeySize } = AlgorithmFramework;

  // ========================[ CONSTANTS ]========================

  const GASCON128_STATE_SIZE = 40;    // 5 x 64-bit words
  const DRYSPONGE128_RATE = 16;       // Rate in bytes
  const DRYSPONGE128_XSIZE = 16;      // X value size in bytes
  const DRYSPONGE128_ROUNDS = 7;      // Normal operation rounds
  const DRYSPONGE128_INIT_ROUNDS = 11; // Initialization rounds
  const DRYGASCON128_TAG_SIZE = 16;   // Authentication tag size
  const DRYGASCON128_NONCE_SIZE = 16; // Nonce size

  // Domain separation values
  const DRYDOMAIN128_PADDED = (1 << 8);
  const DRYDOMAIN128_FINAL = (1 << 9);
  const DRYDOMAIN128_NONCE = (1 << 10);
  const DRYDOMAIN128_ASSOC_DATA = (2 << 10);
  const DRYDOMAIN128_MESSAGE = (3 << 10);

  // ========================[ BIT-INTERLEAVED ROTATIONS ]========================

  // 64-bit rotation helper using bit-interleaved format
  // DryGASCON uses bit-interleaving for efficient 32-bit operations
  function rotr64_interleaved(low, high, bits) {
    bits = bits % 64;
    if (bits === 0) return [low, high];

    if (bits < 32) {
      const newLow = OpCodes.RotR32(low, bits);
      const newHigh = OpCodes.RotR32(high, bits);
      return [newLow, newHigh];
    }

    bits -= 32;
    const newLow = OpCodes.RotR32(high, bits);
    const newHigh = OpCodes.RotR32(low, bits);
    return [newLow, newHigh];
  }

  // Odd rotation: swap low/high and adjust rotation amount
  function rotr64_interleaved_odd(low, high, bits) {
    const low_rot = OpCodes.RotR32(low, ((bits + 1) % 32));
    const high_rot = OpCodes.RotR32(high, bits);
    return [high_rot, low_rot];
  }

  // ========================[ GASCON-128 PERMUTATION ]========================

  class GASCON128Permutation {
    constructor() {
      // State: 5 x 64-bit words stored as pairs [low32, high32] for bit-interleaved operations
      this.S = new Array(5);
      for (let i = 0; i < 5; ++i) {
        this.S[i] = [0, 0]; // [low32, high32]
      }
    }

    // Core round function
    coreRound(roundNum) {
      // Add round constant to S[2]: ((0x0F - round) << 4) | round
      const c = ((0x0F - roundNum) << 4) | roundNum;
      this.S[2][0] = (this.S[2][0] ^ c) >>> 0;

      // Substitution layer (chi function)
      // x0 ^= x4; x2 ^= x1; x4 ^= x3;
      this.S[0][0] = (this.S[0][0] ^ this.S[4][0]) >>> 0;
      this.S[0][1] = (this.S[0][1] ^ this.S[4][1]) >>> 0;
      this.S[2][0] = (this.S[2][0] ^ this.S[1][0]) >>> 0;
      this.S[2][1] = (this.S[2][1] ^ this.S[1][1]) >>> 0;
      this.S[4][0] = (this.S[4][0] ^ this.S[3][0]) >>> 0;
      this.S[4][1] = (this.S[4][1] ^ this.S[3][1]) >>> 0;

      // t[i] = (~x[i]) & x[i+1]
      const t0_l = ((~this.S[0][0]) & this.S[1][0]) >>> 0;
      const t0_h = ((~this.S[0][1]) & this.S[1][1]) >>> 0;
      const t1_l = ((~this.S[1][0]) & this.S[2][0]) >>> 0;
      const t1_h = ((~this.S[1][1]) & this.S[2][1]) >>> 0;
      const t2_l = ((~this.S[2][0]) & this.S[3][0]) >>> 0;
      const t2_h = ((~this.S[2][1]) & this.S[3][1]) >>> 0;
      const t3_l = ((~this.S[3][0]) & this.S[4][0]) >>> 0;
      const t3_h = ((~this.S[3][1]) & this.S[4][1]) >>> 0;
      const t4_l = ((~this.S[4][0]) & this.S[0][0]) >>> 0;
      const t4_h = ((~this.S[4][1]) & this.S[0][1]) >>> 0;

      // x[i] ^= t[i+1]
      this.S[0][0] = (this.S[0][0] ^ t1_l) >>> 0;
      this.S[0][1] = (this.S[0][1] ^ t1_h) >>> 0;
      this.S[1][0] = (this.S[1][0] ^ t2_l) >>> 0;
      this.S[1][1] = (this.S[1][1] ^ t2_h) >>> 0;
      this.S[2][0] = (this.S[2][0] ^ t3_l) >>> 0;
      this.S[2][1] = (this.S[2][1] ^ t3_h) >>> 0;
      this.S[3][0] = (this.S[3][0] ^ t4_l) >>> 0;
      this.S[3][1] = (this.S[3][1] ^ t4_h) >>> 0;
      this.S[4][0] = (this.S[4][0] ^ t0_l) >>> 0;
      this.S[4][1] = (this.S[4][1] ^ t0_h) >>> 0;

      // x1 ^= x0; x3 ^= x2; x0 ^= x4; x2 = ~x2;
      this.S[1][0] = (this.S[1][0] ^ this.S[0][0]) >>> 0;
      this.S[1][1] = (this.S[1][1] ^ this.S[0][1]) >>> 0;
      this.S[3][0] = (this.S[3][0] ^ this.S[2][0]) >>> 0;
      this.S[3][1] = (this.S[3][1] ^ this.S[2][1]) >>> 0;
      this.S[0][0] = (this.S[0][0] ^ this.S[4][0]) >>> 0;
      this.S[0][1] = (this.S[0][1] ^ this.S[4][1]) >>> 0;
      this.S[2][0] = (~this.S[2][0]) >>> 0;
      this.S[2][1] = (~this.S[2][1]) >>> 0;

      // Linear diffusion layer (bit-interleaved rotations)
      // x0 ^= rightRotate19(x0) ^ rightRotate28(x0)
      let r1 = rotr64_interleaved_odd(this.S[0][0], this.S[0][1], 9);
      let r2 = rotr64_interleaved(this.S[0][0], this.S[0][1], 14);
      this.S[0][0] = (this.S[0][0] ^ r1[0] ^ r2[0]) >>> 0;
      this.S[0][1] = (this.S[0][1] ^ r1[1] ^ r2[1]) >>> 0;

      // x1 ^= rightRotate61(x1) ^ rightRotate38(x1)  -> interleaved: odd(30), even(19)
      r1 = rotr64_interleaved_odd(this.S[1][0], this.S[1][1], 30);
      r2 = rotr64_interleaved(this.S[1][0], this.S[1][1], 19);
      this.S[1][0] = (this.S[1][0] ^ r1[0] ^ r2[0]) >>> 0;
      this.S[1][1] = (this.S[1][1] ^ r1[1] ^ r2[1]) >>> 0;

      // x2 ^= rightRotate1(x2) ^ rightRotate6(x2)  -> interleaved: odd(0), even(3)
      const r2a = rotr64_interleaved_odd(this.S[2][0], this.S[2][1], 0); // Rotation by 1 in interleaved = odd rotation by 0
      r2 = rotr64_interleaved(this.S[2][0], this.S[2][1], 3);
      this.S[2][0] = (this.S[2][0] ^ r2a[0] ^ r2[0]) >>> 0;
      this.S[2][1] = (this.S[2][1] ^ r2a[1] ^ r2[1]) >>> 0;

      // x3 ^= rightRotate10(x3) ^ rightRotate17(x3)  -> interleaved: even(5), odd(8)
      r1 = rotr64_interleaved(this.S[3][0], this.S[3][1], 5);
      r2 = rotr64_interleaved_odd(this.S[3][0], this.S[3][1], 8);
      this.S[3][0] = (this.S[3][0] ^ r1[0] ^ r2[0]) >>> 0;
      this.S[3][1] = (this.S[3][1] ^ r1[1] ^ r2[1]) >>> 0;

      // x4 ^= rightRotate7(x4) ^ rightRotate40(x4)  -> interleaved: odd(3), even(20)
      r1 = rotr64_interleaved_odd(this.S[4][0], this.S[4][1], 3);
      r2 = rotr64_interleaved(this.S[4][0], this.S[4][1], 20);
      this.S[4][0] = (this.S[4][0] ^ r1[0] ^ r2[0]) >>> 0;
      this.S[4][1] = (this.S[4][1] ^ r1[1] ^ r2[1]) >>> 0;
    }

    // Load bytes into state (little-endian)
    loadBytes(bytes, offset, index) {
      const low = OpCodes.Pack32LE(
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3]
      );
      const high = OpCodes.Pack32LE(
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7]
      );
      this.S[index] = [low, high];
    }

    // Store state to bytes (little-endian)
    storeBytes(bytes, offset, index) {
      const b = OpCodes.Unpack32LE(this.S[index][0]);
      bytes[offset] = b[0];
      bytes[offset + 1] = b[1];
      bytes[offset + 2] = b[2];
      bytes[offset + 3] = b[3];

      const b2 = OpCodes.Unpack32LE(this.S[index][1]);
      bytes[offset + 4] = b2[0];
      bytes[offset + 5] = b2[1];
      bytes[offset + 6] = b2[2];
      bytes[offset + 7] = b2[3];
    }
  }

  // ========================[ DRYSPONGE128 STATE ]========================

  class DrySponge128State {
    constructor() {
      this.c = new GASCON128Permutation();  // Capacity (GASCON-128 state)
      this.r = new Array(DRYSPONGE128_RATE); // Rate buffer
      for (let i = 0; i < DRYSPONGE128_RATE; ++i) this.r[i] = 0;
      this.x = new Array(DRYSPONGE128_XSIZE); // X value
      for (let i = 0; i < DRYSPONGE128_XSIZE; ++i) this.x[i] = 0;
      this.domain = 0;     // Domain separator
      this.rounds = DRYSPONGE128_ROUNDS;
    }

    // Helper to select x word (constant-time selection for cache timing protection)
    selectX(index) {
      // Pack x bytes into 4 x 32-bit words
      const xW = new Array(4);
      for (let i = 0; i < 4; ++i) {
        xW[i] = OpCodes.Pack32LE(
          this.x[i * 4],
          this.x[i * 4 + 1],
          this.x[i * 4 + 2],
          this.x[i * 4 + 3]
        );
      }

      // Constant-time selection
      let result = 0;
      for (let i = 0; i < 4; ++i) {
        const mask = ((i === index) ? 0xFFFFFFFF : 0) >>> 0;
        result = (result ^ (xW[i] & mask)) >>> 0;
      }
      return result;
    }

    // Mix phase: absorb data into state
    mixPhase(data) {
      // Process 16 bytes of data in 10-bit chunks with domain separator
      const ds = this.domain;

      // Mix 10-bit groups into state, interleaving with core rounds
      const mixData = new Array(14);
      mixData[0] = data[0] | (data[1] << 8);
      mixData[1] = (data[1] >>> 2) | (data[2] << 6);
      mixData[2] = (data[2] >>> 4) | (data[3] << 4);
      mixData[3] = (data[3] >>> 6) | (data[4] << 2);
      mixData[4] = data[5] | (data[6] << 8);
      mixData[5] = (data[6] >>> 2) | (data[7] << 6);
      mixData[6] = (data[7] >>> 4) | (data[8] << 4);
      mixData[7] = (data[8] >>> 6) | (data[9] << 2);
      mixData[8] = data[10] | (data[11] << 8);
      mixData[9] = (data[11] >>> 2) | (data[12] << 6);
      mixData[10] = (data[12] >>> 4) | (data[13] << 4);
      mixData[11] = (data[13] >>> 6) | (data[14] << 2);
      mixData[12] = data[15] ^ ds; // Add domain separator
      mixData[13] = ds >>> 10;

      for (let i = 0; i < 14; ++i) {
        this.mixPhaseRound(mixData[i] & 0x3FF);
        this.c.coreRound(0);
      }
    }

    // Mix a single 10-bit value into state
    mixPhaseRound(data) {
      // Mix in elements from x according to 2-bit indexes in data
      const x0 = this.selectX((data) & 0x03);
      const x1 = this.selectX((data >>> 2) & 0x03);
      const x2 = this.selectX((data >>> 4) & 0x03);
      const x3 = this.selectX((data >>> 6) & 0x03);
      const x4 = this.selectX((data >>> 8) & 0x03);

      // XOR into state.c.W[0,2,4,6,8]
      this.c.S[0][0] = (this.c.S[0][0] ^ x0) >>> 0;
      this.c.S[1][0] = (this.c.S[1][0] ^ x1) >>> 0;
      this.c.S[2][0] = (this.c.S[2][0] ^ x2) >>> 0;
      this.c.S[3][0] = (this.c.S[3][0] ^ x3) >>> 0;
      this.c.S[4][0] = (this.c.S[4][0] ^ x4) >>> 0;
    }

    // G function: run core rounds and squeeze output
    g() {
      // Perform rounds and XOR output from state
      this.c.coreRound(0);

      // First round output
      const w0 = (this.c.S[0][0] ^ this.c.S[2][1]) >>> 0;
      const w1 = (this.c.S[0][1] ^ this.c.S[3][0]) >>> 0;
      const w2 = (this.c.S[1][0] ^ this.c.S[3][1]) >>> 0;
      const w3 = (this.c.S[1][1] ^ this.c.S[2][0]) >>> 0;

      // Remaining rounds
      for (let round = 1; round < this.rounds; ++round) {
        this.c.coreRound(round);

        // XOR additional output
        const w0_new = (this.c.S[0][0] ^ this.c.S[2][1]) >>> 0;
        const w1_new = (this.c.S[0][1] ^ this.c.S[3][0]) >>> 0;
        const w2_new = (this.c.S[1][0] ^ this.c.S[3][1]) >>> 0;
        const w3_new = (this.c.S[1][1] ^ this.c.S[2][0]) >>> 0;

        this.r[0] ^= OpCodes.Unpack32LE(w0_new)[0];
        this.r[1] ^= OpCodes.Unpack32LE(w0_new)[1];
        this.r[2] ^= OpCodes.Unpack32LE(w0_new)[2];
        this.r[3] ^= OpCodes.Unpack32LE(w0_new)[3];

        this.r[4] ^= OpCodes.Unpack32LE(w1_new)[0];
        this.r[5] ^= OpCodes.Unpack32LE(w1_new)[1];
        this.r[6] ^= OpCodes.Unpack32LE(w1_new)[2];
        this.r[7] ^= OpCodes.Unpack32LE(w1_new)[3];

        this.r[8] ^= OpCodes.Unpack32LE(w2_new)[0];
        this.r[9] ^= OpCodes.Unpack32LE(w2_new)[1];
        this.r[10] ^= OpCodes.Unpack32LE(w2_new)[2];
        this.r[11] ^= OpCodes.Unpack32LE(w2_new)[3];

        this.r[12] ^= OpCodes.Unpack32LE(w3_new)[0];
        this.r[13] ^= OpCodes.Unpack32LE(w3_new)[1];
        this.r[14] ^= OpCodes.Unpack32LE(w3_new)[2];
        this.r[15] ^= OpCodes.Unpack32LE(w3_new)[3];
      }

      // Store final output
      const b0 = OpCodes.Unpack32LE(w0);
      const b1 = OpCodes.Unpack32LE(w1);
      const b2 = OpCodes.Unpack32LE(w2);
      const b3 = OpCodes.Unpack32LE(w3);

      this.r[0] = b0[0]; this.r[1] = b0[1]; this.r[2] = b0[2]; this.r[3] = b0[3];
      this.r[4] = b1[0]; this.r[5] = b1[1]; this.r[6] = b1[2]; this.r[7] = b1[3];
      this.r[8] = b2[0]; this.r[9] = b2[1]; this.r[10] = b2[2]; this.r[11] = b2[3];
      this.r[12] = b3[0]; this.r[13] = b3[1]; this.r[14] = b3[2]; this.r[15] = b3[3];
    }

    // F function wrapper: mix + g
    f(input, len) {
      // Pad input if needed
      const padded = new Array(DRYSPONGE128_RATE);
      if (len < DRYSPONGE128_RATE) {
        for (let i = 0; i < len; ++i) padded[i] = input[i];
        padded[len] = 0x01; // Padding byte
        for (let i = len + 1; i < DRYSPONGE128_RATE; ++i) padded[i] = 0;
      } else {
        for (let i = 0; i < DRYSPONGE128_RATE; ++i) padded[i] = input[i];
      }

      this.mixPhase(padded);
      this.g();

      // Reset domain for next block
      this.domain = 0;
    }

    // Check if x words are all different (for key setup)
    xWordsAreSame() {
      const xW = new Array(4);
      for (let i = 0; i < 4; ++i) {
        xW[i] = OpCodes.Pack32LE(
          this.x[i * 4],
          this.x[i * 4 + 1],
          this.x[i * 4 + 2],
          this.x[i * 4 + 3]
        );
      }

      for (let i = 0; i < 3; ++i) {
        for (let j = i + 1; j < 4; ++j) {
          if (xW[i] === xW[j]) return true;
        }
      }
      return false;
    }
  }

  // ========================[ DRYGASCON128K16 ALGORITHM ]========================

  class DryGASCON128k16 extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "DryGASCON128k16";
      this.description = "NIST Lightweight Cryptography finalist using DrySPONGE construction with GASCON permutation. Provides authenticated encryption with 16-byte key and protection against side-channel attacks.";
      this.inventor = "Sébastien Riou, Michaël Raulet, Stéphane Castelain";
      this.year = 2020;
      this.category = CategoryType.AEAD;
      this.subCategory = "Lightweight Cryptography";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.FRANCE;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedTagSizes = [new KeySize(16, 16, 1)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem(
          "DryGASCON GitHub Repository",
          "https://github.com/sebastien-riou/DryGASCON"
        ),
        new LinkItem(
          "NIST LWC Project Page",
          "https://csrc.nist.gov/projects/lightweight-cryptography"
        ),
        new LinkItem(
          "DryGASCON Specification",
          "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/drygascon-spec-final.pdf"
        )
      ];

      // Official test vectors from NIST LWC KAT files
      this.tests = [
        {
          text: "DryGASCON128k16: Empty message, empty AAD (Count 1)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("BB857CC1CB30BD12F67FBBCC00206053")
        },
        {
          text: "DryGASCON128k16: Empty message, 1-byte AAD (Count 2)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("FED9825CEAE6CCD64CF6042FCB18628B")
        },
        {
          text: "DryGASCON128k16: Empty message, 16-byte AAD (Count 17)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("8D376C65983428D27D936228AF47435B")
        },
        {
          text: "DryGASCON128k16: 1-byte plaintext, empty AAD (Count 34)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("F249CAF7DD8BD11993B3A1E63A38E8997A")
        },
        {
          text: "DryGASCON128k16: 1-byte plaintext, 1-byte AAD (Count 35)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("51D99A58C5A70590B6CAFDCFD1A0FFA8C2")
        },
        {
          text: "DryGASCON128k16: 8-byte plaintext, empty AAD (Count 265)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("8D8F6233FB2FB74DD5DE8C9BD8CCD4CAD04C3BD1C7B7")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DryGASCON128k16Instance(this, isInverse);
    }
  }

  // ========================[ DRYGASCON128K16 INSTANCE ]========================

  class DryGASCON128k16Instance extends IAeadInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._nonce = null;
      this._aad = [];
      this.inputBuffer = [];
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      if (keyBytes.length !== 16) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 16)`);
      }

      this._key = [...keyBytes];
    }

    get key() { return this._key ? [...this._key] : null; }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (nonceBytes.length !== DRYGASCON128_NONCE_SIZE) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected ${DRYGASCON128_NONCE_SIZE})`);
      }

      this._nonce = [...nonceBytes];
    }

    get nonce() { return this._nonce ? [...this._nonce] : null; }

    set aad(aadBytes) {
      if (!aadBytes) {
        this._aad = [];
        return;
      }
      this._aad = [...aadBytes];
    }

    get aad() { return [...this._aad]; }

    set associatedData(adBytes) {
      this.aad = adBytes;
    }

    get associatedData() {
      return this.aad;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");

      if (this.isInverse) {
        return this._decrypt();
      } else {
        return this._encrypt();
      }
    }

    _setup(state, finalBlock) {
      // Initialize state with 16-byte key
      // Fill GASCON-128 state (40 bytes) with repeated key
      for (let i = 0; i < 40; i += 16) {
        const copyLen = Math.min(16, 40 - i);
        for (let j = 0; j < copyLen; ++j) {
          const stateIdx = Math.floor((i + j) / 8);
          const wordOffset = (i + j) % 8;
          if (wordOffset < 4) {
            // Low word
            const bytePos = wordOffset;
            const keyByte = j < 16 ? this._key[j] : 0;
            if (bytePos === 0) state.c.S[stateIdx][0] = keyByte;
            else if (bytePos === 1) state.c.S[stateIdx][0] |= (keyByte << 8);
            else if (bytePos === 2) state.c.S[stateIdx][0] |= (keyByte << 16);
            else if (bytePos === 3) state.c.S[stateIdx][0] |= (keyByte << 24);
            state.c.S[stateIdx][0] = state.c.S[stateIdx][0] >>> 0;
          } else {
            // High word
            const bytePos = wordOffset - 4;
            const keyByte = j < 16 ? this._key[j] : 0;
            if (bytePos === 0) state.c.S[stateIdx][1] = keyByte;
            else if (bytePos === 1) state.c.S[stateIdx][1] |= (keyByte << 8);
            else if (bytePos === 2) state.c.S[stateIdx][1] |= (keyByte << 16);
            else if (bytePos === 3) state.c.S[stateIdx][1] |= (keyByte << 24);
            state.c.S[stateIdx][1] = state.c.S[stateIdx][1] >>> 0;
          }
        }
      }

      // Generate x value by running core rounds until all words are unique
      // Safety limit: max 1000 rounds to prevent infinite loops
      let roundCount = 0;
      const MAX_ROUNDS = 1000;
      do {
        state.c.coreRound(0);
        roundCount++;
        if (roundCount >= MAX_ROUNDS) {
          throw new Error(`DryGASCON128: Failed to generate unique X words after ${MAX_ROUNDS} rounds`);
        }
      } while (state.xWordsAreSame());

      // Copy first 16 bytes of state.c to x
      const xBytes = new Array(16);
      for (let i = 0; i < 16; ++i) {
        const stateIdx = Math.floor(i / 8);
        const wordOffset = i % 8;
        if (wordOffset < 4) {
          xBytes[i] = (state.c.S[stateIdx][0] >>> (wordOffset * 8)) & 0xFF;
        } else {
          xBytes[i] = (state.c.S[stateIdx][1] >>> ((wordOffset - 4) * 8)) & 0xFF;
        }
      }
      for (let i = 0; i < 16; ++i) state.x[i] = xBytes[i];

      // Replace first 16 bytes of state with key
      for (let i = 0; i < 16; ++i) {
        const stateIdx = Math.floor(i / 8);
        const wordOffset = i % 8;
        if (wordOffset < 4) {
          // Update low word
          const mask = ~(0xFF << (wordOffset * 8));
          state.c.S[stateIdx][0] = ((state.c.S[stateIdx][0] & mask) | (this._key[i] << (wordOffset * 8))) >>> 0;
        } else {
          // Update high word
          const mask = ~(0xFF << ((wordOffset - 4) * 8));
          state.c.S[stateIdx][1] = ((state.c.S[stateIdx][1] & mask) | (this._key[i] << ((wordOffset - 4) * 8))) >>> 0;
        }
      }

      // Absorb nonce with increased rounds
      state.rounds = DRYSPONGE128_INIT_ROUNDS;
      state.domain = DRYDOMAIN128_NONCE;
      if (finalBlock) {
        state.domain |= DRYDOMAIN128_FINAL;
      }
      state.f(this._nonce, 16);

      // Set normal rounds for future operations
      state.rounds = DRYSPONGE128_ROUNDS;
    }

    _processAD(state, ad, finalBlock) {
      if (ad.length === 0) return;

      let offset = 0;
      // Process all blocks except last
      while (ad.length - offset > DRYSPONGE128_RATE) {
        const block = ad.slice(offset, offset + DRYSPONGE128_RATE);
        state.f(block, DRYSPONGE128_RATE);
        offset += DRYSPONGE128_RATE;
      }

      // Process last block with domain separation
      const lastBlock = ad.slice(offset);
      state.domain = DRYDOMAIN128_ASSOC_DATA;
      if (finalBlock) {
        state.domain |= DRYDOMAIN128_FINAL;
      }
      if (lastBlock.length < DRYSPONGE128_RATE) {
        state.domain |= DRYDOMAIN128_PADDED;
      }
      state.f(lastBlock, lastBlock.length);
    }

    _encrypt() {
      const plaintext = this.inputBuffer;
      const output = [];

      const state = new DrySponge128State();
      const adLen = this._aad.length;
      const mLen = plaintext.length;

      // Setup
      this._setup(state, adLen === 0 && mLen === 0);

      // Process associated data
      if (adLen > 0) {
        this._processAD(state, this._aad, mLen === 0);
      }

      // Encrypt plaintext
      if (mLen > 0) {
        let offset = 0;

        // Process all blocks except last
        while (mLen - offset > DRYSPONGE128_RATE) {
          const block = plaintext.slice(offset, offset + DRYSPONGE128_RATE);
          // Encrypt: C = P XOR state.r
          for (let i = 0; i < DRYSPONGE128_RATE; ++i) {
            output.push(block[i] ^ state.r[i]);
          }
          // Absorb plaintext
          state.f(block, DRYSPONGE128_RATE);
          offset += DRYSPONGE128_RATE;
        }

        // Process last block
        const lastBlock = plaintext.slice(offset);
        state.domain = DRYDOMAIN128_MESSAGE | DRYDOMAIN128_FINAL;
        if (lastBlock.length < DRYSPONGE128_RATE) {
          state.domain |= DRYDOMAIN128_PADDED;
        }

        // Encrypt last block
        for (let i = 0; i < lastBlock.length; ++i) {
          output.push(lastBlock[i] ^ state.r[i]);
        }

        // Absorb last plaintext block
        state.f(lastBlock, lastBlock.length);
      }

      // Generate tag
      for (let i = 0; i < DRYGASCON128_TAG_SIZE; ++i) {
        output.push(state.r[i]);
      }

      this.inputBuffer = [];
      return output;
    }

    _decrypt() {
      const ciphertext = this.inputBuffer;

      if (ciphertext.length < DRYGASCON128_TAG_SIZE) {
        throw new Error("Ciphertext too short (must include tag)");
      }

      const output = [];
      const state = new DrySponge128State();

      const ctLen = ciphertext.length - DRYGASCON128_TAG_SIZE;
      const adLen = this._aad.length;

      // Setup
      this._setup(state, adLen === 0 && ctLen === 0);

      // Process associated data
      if (adLen > 0) {
        this._processAD(state, this._aad, ctLen === 0);
      }

      // Decrypt ciphertext
      if (ctLen > 0) {
        let offset = 0;

        // Process all blocks except last
        while (ctLen - offset > DRYSPONGE128_RATE) {
          const block = ciphertext.slice(offset, offset + DRYSPONGE128_RATE);
          // Decrypt: P = C XOR state.r
          const plainBlock = new Array(DRYSPONGE128_RATE);
          for (let i = 0; i < DRYSPONGE128_RATE; ++i) {
            plainBlock[i] = block[i] ^ state.r[i];
            output.push(plainBlock[i]);
          }
          // Absorb plaintext
          state.f(plainBlock, DRYSPONGE128_RATE);
          offset += DRYSPONGE128_RATE;
        }

        // Process last block
        const lastBlockLen = ctLen - offset;
        const lastBlock = ciphertext.slice(offset, offset + lastBlockLen);
        state.domain = DRYDOMAIN128_MESSAGE | DRYDOMAIN128_FINAL;
        if (lastBlockLen < DRYSPONGE128_RATE) {
          state.domain |= DRYDOMAIN128_PADDED;
        }

        // Decrypt last block
        const plainBlock = new Array(lastBlockLen);
        for (let i = 0; i < lastBlockLen; ++i) {
          plainBlock[i] = lastBlock[i] ^ state.r[i];
          output.push(plainBlock[i]);
        }

        // Absorb last plaintext block
        state.f(plainBlock, lastBlockLen);
      }

      // Verify tag
      const receivedTag = ciphertext.slice(ctLen, ctLen + DRYGASCON128_TAG_SIZE);
      const computedTag = state.r.slice(0, DRYGASCON128_TAG_SIZE);

      // Constant-time tag comparison
      let tagMatch = 0;
      for (let i = 0; i < DRYGASCON128_TAG_SIZE; ++i) {
        tagMatch |= receivedTag[i] ^ computedTag[i];
      }

      if (tagMatch !== 0) {
        throw new Error("Authentication tag verification failed");
      }

      this.inputBuffer = [];
      return output;
    }
  }

  // ========================[ REGISTRATION ]========================

  RegisterAlgorithm(new DryGASCON128k16());

  return {
    DryGASCON128k16,
    DryGASCON128k16Instance
  };
}));
