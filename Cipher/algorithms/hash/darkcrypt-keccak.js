/*
 * Keccak (DarkCrypt variant) - AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * As implemented in the DarkCrypt Total Commander plugin (no public specification
 * matches this variant's output). It is a Keccak sponge built on the standard
 * Keccak-f[1600] permutation (identical theta/rho/pi/chi/iota steps, identical
 * rotation offsets, and the standard round constants), but it differs from every
 * published Keccak/SHA-3 parameter set in three ways:
 *
 *  - Only 18 permutation rounds are applied per call instead of the standard 24
 *    (the round-constant schedule is simply truncated to its first 18 entries).
 *  - The rate is fixed at 64 bytes (512 bits) with a 1088-bit capacity, regardless
 *    of digest size - the inverse proportion of standard SHA-3-512's 576-bit rate
 *    and 1024-bit capacity.
 *  - Padding is not the bit-oriented pad10*1 scheme used by Keccak/SHA-3/SHAKE.
 *    Instead a fixed 4-byte suffix (0x01, 0x40, 0x40, 0x01) is appended directly
 *    after the message bytes, and the combined stream is then zero-padded up to
 *    the next multiple of the 64-byte rate.
 *
 * The digest is always 64 bytes (512 bits), read directly as the first rate-sized
 * block of the state after the final permutation (no extra squeeze step is needed
 * since the digest size equals the rate). Test vectors verified against the
 * DarkCrypt implementation.
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
}((function () {
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
          HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // DarkCrypt Keccak: the permutation core uses standard Keccak-f[1600] round
  // constants and rotation offsets, but only the first 18 (of the standard 24)
  // rounds are executed.
  /** @type {int32} */
  const KECCAK_ROUNDS = 18;

  // DarkCrypt Keccak block size: 64 bytes (512-bit rate, 1088-bit capacity).
  /** @type {int32} */
  const RATE = 64;

  // Fixed padding suffix appended after the message before zero-filling to a
  // multiple of RATE (replaces the standard pad10*1 scheme).
  const PAD_SUFFIX = OpCodes.Hex8ToBytes("01404001");

  /** @type {int32} 512-bit digest */
  const OUTPUT_SIZE = 64;

  // Keccak round constants (24 rounds) - FIPS 202 compliant, split into the
  // low and high 32-bit halves of each 64-bit lane constant
  const RC_LO = OpCodes.Hex32ToDWords(
    '00000001' + '00008082' + '0000808a' + '80008000' + '0000808b' + '80000001' + '80008081' + '00008009' +
    '0000008a' + '00000088' + '80008009' + '8000000a' + '8000808b' + '0000008b' + '00008089' + '00008003' +
    '00008002' + '00000080' + '0000800a' + '8000000a' + '80008081' + '00008080' + '80000001' + '80008008'
  );
  const RC_HI = OpCodes.Hex32ToDWords(
    '00000000' + '00000000' + '80000000' + '80000000' + '00000000' + '00000000' + '80000000' + '80000000' +
    '00000000' + '00000000' + '00000000' + '00000000' + '00000000' + '80000000' + '80000000' + '80000000' +
    '80000000' + '80000000' + '00000000' + '80000000' + '80000000' + '80000000' + '00000000' + '80000000'
  );

  // Rotation offsets for rho step
  /** @type {int32[]} */
  const RHO_OFFSETS = [
    0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41,
    45, 15, 21, 8, 18, 2, 61, 56, 14
  ];

  /**
   * 64-bit XOR operation
   * @param {uint32[]} a - [low32, high32]
   * @param {uint32[]} b - [low32, high32]
   * @returns {uint32[]} XOR result [low32, high32]
   */
  function xor64(a, b) {
    /** @type {uint32[]} */
    const r = [OpCodes.Xor32(a[0], b[0]), OpCodes.Xor32(a[1], b[1])];
    return r;
  }

  /**
   * 64-bit left rotation (using 32-bit operations)
   * @param {uint32[]} val - [low32, high32]
   * @param {int32} positions - Rotation positions
   * @returns {uint32[]} Rotated [low32, high32]
   */
  function rotl64(val, positions) {
    const low = val[0];
    const high = val[1];
    positions %= 64;

    /** @type {uint32[]} */
    const r = [low, high];
    if (positions === 0) return r;
    if (positions === 32) {
      r[0] = high;
      r[1] = low;
      return r;
    }

    if (positions < 32) {
      r[0] = OpCodes.Or32(OpCodes.Shl32(low, positions), OpCodes.Shr32(high, 32 - positions));
      r[1] = OpCodes.Or32(OpCodes.Shl32(high, positions), OpCodes.Shr32(low, 32 - positions));
      return r;
    }

    positions -= 32;
    r[0] = OpCodes.Or32(OpCodes.Shl32(high, positions), OpCodes.Shr32(low, 32 - positions));
    r[1] = OpCodes.Or32(OpCodes.Shl32(low, positions), OpCodes.Shr32(high, 32 - positions));
    return r;
  }

  /**
   * Keccak-f[1600] permutation
   * @param {uint32[][]} state - 25 x [low32, high32] state array
   * @returns {void}
   */
  function keccakF(state) {
    for (let round = 0; round < KECCAK_ROUNDS; round++) {
      // Theta step
      /** @type {uint32[][]} */
      const C = new Array(5);
      for (let x = 0; x < 5; x++) {
        /** @type {uint32[]} */
        const zero = [0, 0];
        C[x] = zero;
        for (let y = 0; y < 5; y++) {
          C[x] = xor64(C[x], state[x + 5 * y]);
        }
      }

      /** @type {uint32[][]} */
      const D = new Array(5);
      for (let x = 0; x < 5; x++) {
        D[x] = xor64(C[(x + 4) % 5], rotl64(C[(x + 1) % 5], 1));
      }

      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[x + 5 * y] = xor64(state[x + 5 * y], D[x]);
        }
      }

      // Rho step
      for (let i = 0; i < 25; i++) {
        state[i] = rotl64(state[i], RHO_OFFSETS[i]);
      }

      // Pi step
      /** @type {uint32[][]} */
      const temp = new Array(25);
      for (let i = 0; i < 25; i++) {
        temp[i] = state[i].slice();
      }

      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[y + 5 * ((2 * x + 3 * y) % 5)] = temp[x + 5 * y];
        }
      }

      // Chi step
      for (let y = 0; y < 5; y++) {
        /** @type {uint32[][]} */
        const row = new Array(5);
        for (let x = 0; x < 5; x++) {
          row[x] = state[x + 5 * y].slice();
        }

        for (let x = 0; x < 5; x++) {
          /** @type {uint32[]} */
          const andResult = [
            OpCodes.And32(OpCodes.Not32(row[(x + 1) % 5][0]), row[(x + 2) % 5][0]),
            OpCodes.And32(OpCodes.Not32(row[(x + 1) % 5][1]), row[(x + 2) % 5][1])
          ];
          state[x + 5 * y] = xor64(row[x], andResult);
        }
      }

      // Iota step
      /** @type {uint32[]} */
      const rc = [RC_LO[round], RC_HI[round]];
      state[0] = xor64(state[0], rc);
    }
  }

  // ===== ALGORITHM REGISTRATION =====

  /**
   * DarkCrypt Keccak variant
   * @class
   * @extends {HashFunctionAlgorithm}
   */
  class DarkCryptKeccakAlgorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "Keccak (DarkCrypt)";
      this.description = "Keccak sponge hash variant used by the DarkCrypt Total Commander plugin. Built on the standard Keccak-f[1600] permutation (standard rotation offsets and round constants) but truncated to 18 rounds instead of the standard 24, with a fixed 64-byte rate (1088-bit capacity) and a fixed 4-byte padding suffix (0x01, 0x40, 0x40, 0x01) in place of the usual pad10*1 scheme. Produces a 512-bit digest; matches no published Keccak or SHA-3 test vector.";
      this.inventor = "Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche (Keccak); DarkCrypt plugin author (round-count and padding variant)";
      this.year = 2012;
      this.category = CategoryType.HASH;
      this.subCategory = "DarkCrypt Variant";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BE;

      this.SupportedOutputSizes = [new KeySize(OUTPUT_SIZE, OUTPUT_SIZE, 1)]; // 512 bits
      /** @type {int32} */
      this.blockSize = RATE;
      /** @type {int32} */
      this.outputSize = OUTPUT_SIZE;

      this.documentation = [
        new LinkItem("Keccak Team", "https://keccak.team/keccak.html"),
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.references = [
        new LinkItem("DarkCrypt Total Commander plugin", "https://github.com/Zdimon/DarkCryptTC")
      ];

      // Vectors generated from the DarkCrypt implementation's hashnow(inPtr, outPtr, len)
      // export; empty/"abc"/incr64 (bytes 0x00..0x3F) inputs.
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes(""),
          OpCodes.Hex8ToBytes("8596f8df2e856ec888823da8ccc914139f31baee6aa5c37dbe30bddbfd75c63cdc205f15f30faa348e27b5f90495b339a606e3c84bfcdcd55e88b0e178b56feb"),
          "DarkCrypt Keccak - empty message",
          "https://github.com/Zdimon/DarkCryptTC"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("abc"),
          OpCodes.Hex8ToBytes("4a2e21878d2785dffb751bb0c635e1f5780152922ffe7ef5342f7442d877754a3f866cd5b2d9f2711b02b24f64e437e4484a8d24b7878d288e9c550729ff954e"),
          "DarkCrypt Keccak - \"abc\"",
          "https://github.com/Zdimon/DarkCryptTC"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          OpCodes.Hex8ToBytes("ef3d380fac452a2adddfc2efe065378e82184adbd7cf9cf5ee69a1ad7c49f24b29013b010490715a98b32956df679d2027c68a54626bdca21a969c2d74d2c71e"),
          "DarkCrypt Keccak - 64 incrementing bytes",
          "https://github.com/Zdimon/DarkCryptTC"
        )
      ];
    }

    /**
     * Create new hash instance
     * @param {boolean} [isInverse=false] - A hash has no inverse: true yields null
     * @returns {DarkCryptKeccakInstance} New hash instance
     */
    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new DarkCryptKeccakInstance(this);
    }
  }

  /**
   * DarkCrypt Keccak instance implementing the Feed/Result pattern
   * @class
   * @extends {IHashFunctionInstance}
   */
  class DarkCryptKeccakInstance extends IHashFunctionInstance {
    /**
     * Initialize an instance
     * @param {DarkCryptKeccakAlgorithm} algorithm - Parent algorithm instance
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {uint8[]} Message bytes fed so far */
      this.buffer = [];
    }

    /**
     * Append message bytes
     * @param {uint8[]} data - Input data bytes
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      for (let i = 0; i < data.length; i++) this.buffer.push(data[i]);
    }

    /**
     * Digest of everything fed so far
     * @returns {uint8[]} 64-byte digest
     */
    Result() {
      const stream = this.buffer.concat(PAD_SUFFIX);
      const padLen = (RATE - (stream.length % RATE)) % RATE;
      for (let i = 0; i < padLen; i++) stream.push(0);

      /** @type {uint32[][]} */
      const state = new Array(25);
      for (let i = 0; i < 25; i++) {
        /** @type {uint32[]} */
        const lane = [0, 0];
        state[i] = lane;
      }

      for (let off = 0; off < stream.length; off += RATE) {
        for (let i = 0; i < RATE; i += 8) {
          const low = OpCodes.Pack32LE(stream[off + i], stream[off + i + 1], stream[off + i + 2], stream[off + i + 3]);
          const high = OpCodes.Pack32LE(stream[off + i + 4], stream[off + i + 5], stream[off + i + 6], stream[off + i + 7]);
          const idx = i / 8;
          state[idx][0] = OpCodes.Xor32(state[idx][0], low);
          state[idx][1] = OpCodes.Xor32(state[idx][1], high);
        }
        keccakF(state);
      }

      /** @type {uint8[]} */
      const output = [];
      for (let i = 0; i < OUTPUT_SIZE; i += 8) {
        const idx = i / 8;
        const bytes1 = OpCodes.Unpack32LE(state[idx][0]);
        const bytes2 = OpCodes.Unpack32LE(state[idx][1]);
        for (let j = 0; j < 4; j++) output.push(bytes1[j]);
        for (let j = 0; j < 4; j++) output.push(bytes2[j]);
      }

      return output;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DarkCryptKeccakAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptKeccakAlgorithm, DarkCryptKeccakInstance };
}));
