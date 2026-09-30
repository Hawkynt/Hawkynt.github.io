/*
 * Keccak (DarkCrypt variant) - AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * The Keccak-512 used by the DarkCrypt Total Commander plugin is the original
 * SHA-3 round 1 submission (Keccak specifications version 1, October 2008),
 * Keccak[r=512, c=1088, d=64], which predates the later changes to Keccak:
 *
 *  - Keccak-f[1600] has 18 rounds (12 + l), raised to 24 for SHA-3 round 2; the
 *    round function, rotation offsets and round constants are unchanged.
 *  - The rate is the largest power of two within the security limit, 512 bits
 *    for a 512-bit digest (1088-bit capacity); round 3 raised it to 576 bits.
 *  - Byte-aligned messages are padded as M || 0x01 || d || r/8 || 0x01 || 0x00...
 *    with the diversifier d = 64 (digest bytes) and r/8 = 64, so the suffix is
 *    0x01 0x40 0x40 0x01, zero-filled to a multiple of the 64-byte rate. Round 3
 *    replaced this with the simple pad10*1 rule.
 *
 * The digest is the first 64 bytes of the state after the final permutation,
 * which is exactly one rate-sized block. It matches every byte-aligned entry of
 * the round 1 known-answer tests (ShortMsgKAT_512, LongMsgKAT_512). Test
 * vectors verified against the DarkCrypt implementation.
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

  // Keccak version 1: 12 + l = 18 rounds of Keccak-f[1600] (24 from round 2 on)
  /** @type {int32} */
  const KECCAK_ROUNDS = 18;

  // Keccak version 1 Keccak-512: 64-byte rate (512 bits), 1088-bit capacity
  /** @type {int32} */
  const RATE = 64;

  // Version 1 byte-aligned padding: 0x01, diversifier d = 64, r/8 = 64, 0x01,
  // then zero-filled to a multiple of RATE
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
      this.description = "Keccak-512 as used by the DarkCrypt Total Commander plugin: the original SHA-3 round 1 submission (Keccak version 1, 2008), Keccak[r=512, c=1088, d=64] with 18 rounds of Keccak-f[1600] and the version 1 padding that encodes the diversifier and rate. Differs from later Keccak-512 and SHA3-512, which use 24 rounds, a 576-bit rate and pad10*1; matches the published round 1 known-answer tests.";
      this.inventor = "Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche";
      this.year = 2008;
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
        new LinkItem("Keccak specifications, round 1 (obsolete documents)", "https://keccak.team/archives.html"),
        new LinkItem("Simplifying Keccak's padding rule for round 3", "https://keccak.team/2011/version_3.0.html"),
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.references = [
        new LinkItem("DarkCrypt Total Commander plugin", "https://github.com/Zdimon/DarkCryptTC")
      ];

      // Round 1 known-answer tests (ShortMsgKAT_512 / LongMsgKAT_512) and further
      // test vectors verified against the DarkCrypt implementation.
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes(""),
          OpCodes.Hex8ToBytes("8596f8df2e856ec888823da8ccc914139f31baee6aa5c37dbe30bddbfd75c63cdc205f15f30faa348e27b5f90495b339a606e3c84bfcdcd55e88b0e178b56feb"),
          "Keccak round 1 ShortMsgKAT_512 - Len = 0",
          "https://keccak.team/obsolete/KeccakKAT.zip"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("cc"),
          OpCodes.Hex8ToBytes("84be36543acdabb7d4e097e8bd23ecbf231ec672f771d8bdb807b8ad98976120f361212493564addce36077cc1def7c483cd4bbd8946563a127883b3593945a6"),
          "Keccak round 1 ShortMsgKAT_512 - Len = 8",
          "https://keccak.team/obsolete/KeccakKAT.zip"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("a62fc595b4096e6336e53fcdfc8d1cc175d71dac9d750a6133d23199eaac288207944cea6b16d27631915b4619f743da2e30a0c00bbdb1bbb35ab852ef3b9aec6b0a8dcc6e9e1abaa3ad62ac0a6c5de765de2c3711b769e3fde44a74016fff82ac46fa8f1797d3b2a726b696e3dea5530439acee3a45c2a51bc32dd055650b"),
          OpCodes.Hex8ToBytes("8e20c08e35cd59e0c21dc36edc59647125af8c0597ed64a87db634ae54f1ce1564b9400eab7d12e847189c363acbd1b6b8a17437f0d1959ce48de980e93143c2"),
          "Keccak round 1 ShortMsgKAT_512 - Len = 1016 (two blocks)",
          "https://keccak.team/obsolete/KeccakKAT.zip"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("724627916c50338643e6996f07877eafd96bdf01da7e991d4155b9be1295ea7d21c9391f4c4a41c75f77e5d27389253393725f1427f57914b273ab862b9e31dabce506e558720520d33352d119f699e784f9e548ff91bc35ca147042128709820d69a8287ea3257857615eb0321270e94b84f446942765ce882b191faee7e1c87e0f0bd4e0cd8a927703524b559b769ca4ece1f6dbf313fdcf67c572ec4185c1a88e86ec11b6454b371980020f19633b6b95bd280e4fbcb0161e1a82470320cec6ecfa25ac73d09f1536f286d3f9dacafb2cd1d0ce72d64d197f5c7520b3ccb2fd74eb72664ba93853ef41eabf52f015dd591500d018dd162815cc993595b195"),
          OpCodes.Hex8ToBytes("f28d27e97389800e972cb2202365a4f344ec1db0d8a58f5fcd08ac80fb2cf1a7e8cfaa81b7d9b2a9344b08a98d2e3433f7edd30a5d63dfb41d2b3463e77e17fc"),
          "Keccak round 1 LongMsgKAT_512 - Len = 2048",
          "https://keccak.team/obsolete/KeccakKAT.zip"
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
