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
          HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem } = AlgorithmFramework;

  // DarkCrypt Keccak: the permutation core uses standard Keccak-f[1600] round
  // constants and rotation offsets, but only the first 18 (of the standard 24)
  // rounds are executed.
  const ROUNDS = 18;

  const RC = Object.freeze([
    [0x00000001, 0x00000000], [0x00008082, 0x00000000], [0x0000808a, 0x80000000], [0x80008000, 0x80000000],
    [0x0000808b, 0x00000000], [0x80000001, 0x00000000], [0x80008081, 0x80000000], [0x00008009, 0x80000000],
    [0x0000008a, 0x00000000], [0x00000088, 0x00000000], [0x80008009, 0x00000000], [0x8000000a, 0x00000000],
    [0x8000808b, 0x00000000], [0x0000008b, 0x80000000], [0x00008089, 0x80000000], [0x00008003, 0x80000000],
    [0x00008002, 0x80000000], [0x00000080, 0x80000000]
  ]);

  const RHO_OFFSETS = Object.freeze([
    0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41,
    45, 15, 21, 8, 18, 2, 61, 56, 14
  ]);

  // DarkCrypt Keccak block size: 64 bytes (512-bit rate, 1088-bit capacity).
  const RATE = 64;

  // Fixed padding suffix appended after the message before zero-filling to a
  // multiple of RATE (replaces the standard pad10*1 scheme).
  const PAD_SUFFIX = Object.freeze([0x01, 0x40, 0x40, 0x01]);

  const OUTPUT_SIZE = 64; // 512-bit digest

  function xor64(a, b) { return [OpCodes.XorN(a[0], b[0]), OpCodes.XorN(a[1], b[1])]; }

  function rotl64(val, positions) {
    const [low, high] = val;
    positions %= 64;
    if (positions === 0) return [low, high];
    if (positions === 32) return [high, low];

    if (positions < 32) {
      return [
        OpCodes.OrN(OpCodes.Shl32(low, positions), OpCodes.Shr32(high, 32 - positions)),
        OpCodes.OrN(OpCodes.Shl32(high, positions), OpCodes.Shr32(low, 32 - positions))
      ];
    }

    positions -= 32;
    return [
      OpCodes.OrN(OpCodes.Shl32(high, positions), OpCodes.Shr32(low, 32 - positions)),
      OpCodes.OrN(OpCodes.Shl32(low, positions), OpCodes.Shr32(high, 32 - positions))
    ];
  }

  function keccakF(state) {
    for (let round = 0; round < ROUNDS; round++) {
      // Theta
      const C = new Array(5);
      for (let x = 0; x < 5; x++) {
        C[x] = [0, 0];
        for (let y = 0; y < 5; y++) C[x] = xor64(C[x], state[x + 5 * y]);
      }

      const D = new Array(5);
      for (let x = 0; x < 5; x++) {
        D[x] = xor64(C[(x + 4) % 5], rotl64(C[(x + 1) % 5], 1));
      }

      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[x + 5 * y] = xor64(state[x + 5 * y], D[x]);
        }
      }

      // Rho
      for (let i = 0; i < 25; i++) {
        state[i] = rotl64(state[i], RHO_OFFSETS[i]);
      }

      // Pi
      const temp = new Array(25);
      for (let i = 0; i < 25; i++) temp[i] = [state[i][0], state[i][1]];
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[y + 5 * ((2 * x + 3 * y) % 5)] = temp[x + 5 * y];
        }
      }

      // Chi
      for (let y = 0; y < 5; y++) {
        const row = new Array(5);
        for (let x = 0; x < 5; x++) row[x] = [state[x + 5 * y][0], state[x + 5 * y][1]];
        for (let x = 0; x < 5; x++) {
          const notNext = [~row[(x + 1) % 5][0], ~row[(x + 1) % 5][1]];
          const andResult = [OpCodes.AndN(notNext[0], row[(x + 2) % 5][0]), OpCodes.AndN(notNext[1], row[(x + 2) % 5][1])];
          state[x + 5 * y] = xor64(row[x], andResult);
        }
      }

      // Iota
      state[0] = xor64(state[0], RC[round]);
    }
  }

  // ===== ALGORITHM REGISTRATION =====

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

      this.SupportedOutputSizes = [OUTPUT_SIZE]; // 512 bits
      this.blockSize = RATE;
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

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new DarkCryptKeccakInstance(this);
    }
  }

  class DarkCryptKeccakInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.buffer = [];
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let i = 0; i < data.length; i++) this.buffer.push(data[i]);
    }

    Result() {
      const stream = this.buffer.concat(PAD_SUFFIX);
      const padLen = (RATE - (stream.length % RATE)) % RATE;
      for (let i = 0; i < padLen; i++) stream.push(0);

      const state = new Array(25);
      for (let i = 0; i < 25; i++) state[i] = [0, 0];

      for (let off = 0; off < stream.length; off += RATE) {
        for (let i = 0; i < RATE; i += 8) {
          const low = OpCodes.Pack32LE(stream[off + i], stream[off + i + 1], stream[off + i + 2], stream[off + i + 3]);
          const high = OpCodes.Pack32LE(stream[off + i + 4], stream[off + i + 5], stream[off + i + 6], stream[off + i + 7]);
          const idx = i / 8;
          state[idx][0] = OpCodes.XorN(state[idx][0], low);
          state[idx][1] = OpCodes.XorN(state[idx][1], high);
        }
        keccakF(state);
      }

      const output = new Array(OUTPUT_SIZE);
      let outputOffset = 0;
      for (let i = 0; i < OUTPUT_SIZE; i += 8) {
        const idx = i / 8;
        const bytes1 = OpCodes.Unpack32LE(state[idx][0]);
        const bytes2 = OpCodes.Unpack32LE(state[idx][1]);
        for (let j = 0; j < 4; j++) output[outputOffset++] = bytes1[j];
        for (let j = 0; j < 4; j++) output[outputOffset++] = bytes2[j];
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
