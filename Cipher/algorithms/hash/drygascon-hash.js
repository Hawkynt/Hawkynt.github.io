/*
 * DryGASCON-HASH - NIST Lightweight Cryptography Hash Functions
 * Professional implementation following the DryGASCON specification
 * (c)2006-2025 Hawkynt
 *
 * DryGASCON-HASH is the hash function mode of DryGASCON, a finalist in NIST's
 * Lightweight Cryptography competition. It uses the DrySPONGE construction with
 * the GASCON permutation to provide cryptographic hash functions.
 *
 * This implementation provides:
 * - DryGASCON128-HASH: 256-bit (32-byte) output
 * - DryGASCON256-HASH: 512-bit (64-byte) output
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
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem, KeySize } = AlgorithmFramework;

  // ========================[ CONSTANTS ]========================

  const GASCON128_WORDS = 5;          // 5 x 64-bit words (40 bytes)
  const GASCON256_WORDS = 9;          // 9 x 64-bit words (72 bytes)

  const DRYSPONGE128_RATE = 16;       // Rate in bytes
  const DRYSPONGE128_XSIZE = 16;      // X value size in bytes
  const DRYSPONGE128_ROUNDS = 7;      // Normal operation rounds
  const DRYSPONGE128_INIT_ROUNDS = 11; // Initialization rounds

  const DRYSPONGE256_RATE = 16;       // Rate in bytes for 256 variant
  const DRYSPONGE256_XSIZE = 16;      // X value size in bytes for 256 variant (same as 128)
  const DRYSPONGE256_ROUNDS = 8;      // Normal operation rounds for 256 (NOT 11!)
  const DRYSPONGE256_INIT_ROUNDS = 12; // Initialization rounds for 256 (NOT 11!)

  // Domain separation values (use same as AEAD - hash processes input as associated data)
  const DRYDOMAIN128_PADDED = OpCodes.Shl32(1, 8);
  const DRYDOMAIN128_FINAL = OpCodes.Shl32(1, 9);
  const DRYDOMAIN128_ASSOC_DATA = OpCodes.Shl32(2, 10);

  const DRYDOMAIN256_PADDED = OpCodes.Shl32(1, 2);
  const DRYDOMAIN256_FINAL = OpCodes.Shl32(1, 3);
  const DRYDOMAIN256_ASSOC_DATA = OpCodes.Shl32(2, 4);

  // Linear layer of GASCON: word i becomes
  //   x[i] ^ rotr64(x[i], ROT_ODD[i]) ^ rotr64(x[i], ROT_EVEN[i])
  // in bit-interleaved form, where an odd 64-bit rotation swaps the two halves
  // and an even one rotates each half. GASCON-128 uses the first five entries.
  /** @type {int32[]} */
  const ROT_ODD = [9, 30, 0, 8, 3, 15, 26, 4, 21];
  /** @type {int32[]} */
  const ROT_EVEN = [14, 19, 3, 5, 20, 13, 29, 23, 25];

  // ========================[ GASCON PERMUTATION ]========================

  /**
   * GASCON permutation over n bit-interleaved 64-bit words (n = 5 for
   * GASCON-128, n = 9 for GASCON-256). Word i is stored as S[2*i] (even bits,
   * "low") and S[2*i+1] (odd bits, "high").
   */
  class GASCONPermutation {
    /**
     * @param {boolean} is256 - True for GASCON-256 (9 words), false for GASCON-128 (5 words)
     */
    constructor(is256) {
      /** @type {int32} */
      this.wordCount = is256 ? GASCON256_WORDS : GASCON128_WORDS;
      /** @type {uint32[]} */
      this.S = [];
      for (let i = 0; i < 2 * this.wordCount; ++i) {
        this.S.push(0);
      }
    }

    /**
     * XOR 64-bit word j into word i (both halves)
     * @param {int32} i - Destination word
     * @param {int32} j - Source word
     * @returns {void}
     */
    _xorWord(i, j) {
      this.S[2 * i] = OpCodes.Xor32(this.S[2 * i], this.S[2 * j]);
      this.S[2 * i + 1] = OpCodes.Xor32(this.S[2 * i + 1], this.S[2 * j + 1]);
    }

    /**
     * Core round function
     * @param {int32} roundNum - Round number (selects the round constant)
     * @returns {void}
     */
    coreRound(roundNum) {
      const n = this.wordCount;
      const mid = (n - 1) / 2;

      // Add round constant to the middle word: ((0x0F - round) << 4) | round
      const c = OpCodes.Or32(OpCodes.Shl32(0x0F - roundNum, 4), roundNum);
      this.S[2 * mid] = OpCodes.Xor32(this.S[2 * mid], c);

      // Substitution layer (chi function)
      // x0 ^= x[n-1]; x2 ^= x1; x4 ^= x3; ...
      this._xorWord(0, n - 1);
      for (let i = 2; i < n; i += 2) {
        this._xorWord(i, i - 1);
      }

      // t[i] = (~x[i])&x[i+1]
      /** @type {uint32[]} */
      const t = [];
      for (let i = 0; i < n; ++i) {
        const j = (i + 1) % n;
        t.push(OpCodes.And32(OpCodes.Not32(this.S[2 * i]), this.S[2 * j]));
        t.push(OpCodes.And32(OpCodes.Not32(this.S[2 * i + 1]), this.S[2 * j + 1]));
      }

      // x[i] ^= t[i+1]
      for (let i = 0; i < n; ++i) {
        const j = (i + 1) % n;
        this.S[2 * i] = OpCodes.Xor32(this.S[2 * i], t[2 * j]);
        this.S[2 * i + 1] = OpCodes.Xor32(this.S[2 * i + 1], t[2 * j + 1]);
      }

      // x1 ^= x0; x3 ^= x2; ...; x0 ^= x[n-1]; x[mid] = ~x[mid];
      for (let i = 1; i < n; i += 2) {
        this._xorWord(i, i - 1);
      }
      this._xorWord(0, n - 1);
      this.S[2 * mid] = OpCodes.Not32(this.S[2 * mid]);
      this.S[2 * mid + 1] = OpCodes.Not32(this.S[2 * mid + 1]);

      // Linear diffusion layer (bit-interleaved rotations)
      for (let i = 0; i < n; ++i) {
        const lo = this.S[2 * i];
        const hi = this.S[2 * i + 1];
        const odd = ROT_ODD[i];
        const even = ROT_EVEN[i];
        this.S[2 * i] = OpCodes.Xor32(OpCodes.Xor32(lo, OpCodes.RotR32(hi, odd)), OpCodes.RotR32(lo, even));
        this.S[2 * i + 1] = OpCodes.Xor32(OpCodes.Xor32(hi, OpCodes.RotR32(lo, odd + 1)), OpCodes.RotR32(hi, even));
      }
    }
  }

  // ========================[ DRYSPONGE STATE ]========================

  /**
   * DrySPONGE state over a GASCON permutation (5 words for DrySPONGE128,
   * 9 words for DrySPONGE256)
   */
  class DrySpongeState {
    /**
     * @param {boolean} is256 - True for DrySPONGE256 over GASCON-256, false for DrySPONGE128
     * @param {int32} rate - Rate in bytes
     * @param {int32} xsize - X value size in bytes
     * @param {int32} rounds - Rounds of normal operation
     * @param {int32} initRounds - Rounds of initialization
     */
    constructor(is256, rate, xsize, rounds, initRounds) {
      /** @type {GASCONPermutation} */
      this.c = new GASCONPermutation(is256);
      /** @type {uint8[]} */
      this.r = OpCodes.CreateArray(rate, 0);
      /** @type {uint8[]} */
      this.x = OpCodes.CreateArray(xsize, 0);
      /** @type {uint32} */
      this.domain = 0;
      /** @type {int32} */
      this.rounds = rounds;
      /** @type {int32} */
      this.initRounds = initRounds;
      /** @type {int32} */
      this.rate = rate;
      /** @type {int32} */
      this.xsize = xsize;
    }

    /**
     * Select one 32-bit word of x (constant-time selection)
     * @param {uint32} index - Word index (0..3)
     * @returns {uint32} The selected word
     */
    selectX(index) {
      const wordsCount = this.xsize / 4;
      /** @type {uint32[]} */
      const xW = [];
      for (let i = 0; i < wordsCount; ++i) {
        xW.push(OpCodes.Pack32LE(
          this.x[i * 4],
          this.x[i * 4 + 1],
          this.x[i * 4 + 2],
          this.x[i * 4 + 3]
        ));
      }

      // Constant-time selection
      /** @type {uint32} */
      let result = 0;
      for (let i = 0; i < wordsCount; ++i) {
        /** @type {uint32} */
        const mask = (i === index) ? 0xFFFFFFFF : 0;
        result = OpCodes.Xor32(result, OpCodes.And32(xW[i], mask));
      }
      return result;
    }

    /**
     * Mix one group of 2-bit x indices into the even halves of the state words
     * (10 bits for DrySPONGE128, 18 bits for DrySPONGE256)
     * @param {uint32} data - Packed 2-bit indices, word 0 in the lowest bits
     * @returns {void}
     */
    mixPhaseRound(data) {
      for (let i = 0; i < this.c.wordCount; ++i) {
        const xi = this.selectX(OpCodes.And32(OpCodes.Shr32(data, i * 2), 0x03));
        this.c.S[2 * i] = OpCodes.Xor32(this.c.S[2 * i], xi);
      }
    }

    /**
     * Mix phase of DrySPONGE128: absorb one padded block in 10-bit groups
     * @param {uint8[]} data - Padded block (16 bytes)
     * @returns {void}
     */
    mixPhase128(data) {
      const ds = this.domain;

      // Mix 10-bit groups into state
      /** @type {uint32[]} */
      const mixData = [
        OpCodes.Or32(data[0], OpCodes.Shl32(data[1], 8)),
        OpCodes.Or32(OpCodes.Shr32(data[1], 2), OpCodes.Shl32(data[2], 6)),
        OpCodes.Or32(OpCodes.Shr32(data[2], 4), OpCodes.Shl32(data[3], 4)),
        OpCodes.Or32(OpCodes.Shr32(data[3], 6), OpCodes.Shl32(data[4], 2)),
        OpCodes.Or32(data[5], OpCodes.Shl32(data[6], 8)),
        OpCodes.Or32(OpCodes.Shr32(data[6], 2), OpCodes.Shl32(data[7], 6)),
        OpCodes.Or32(OpCodes.Shr32(data[7], 4), OpCodes.Shl32(data[8], 4)),
        OpCodes.Or32(OpCodes.Shr32(data[8], 6), OpCodes.Shl32(data[9], 2)),
        OpCodes.Or32(data[10], OpCodes.Shl32(data[11], 8)),
        OpCodes.Or32(OpCodes.Shr32(data[11], 2), OpCodes.Shl32(data[12], 6)),
        OpCodes.Or32(OpCodes.Shr32(data[12], 4), OpCodes.Shl32(data[13], 4)),
        OpCodes.Or32(OpCodes.Shr32(data[13], 6), OpCodes.Shl32(data[14], 2)),
        OpCodes.Xor32(data[15], ds),  // Domain separator added here
        OpCodes.Shr32(ds, 10)
      ];

      // Mix rounds: 13 rounds with core_round, last without
      for (let i = 0; i < 13; ++i) {
        this.mixPhaseRound(OpCodes.And32(mixData[i], 0x3FF));
        this.c.coreRound(0);
      }
      // Final mix round without core_round after it
      this.mixPhaseRound(OpCodes.And32(mixData[13], 0x3FF));
    }

    /**
     * Mix phase of DrySPONGE256: absorb one padded block in 18-bit groups
     * (9 x 2-bit indices per mix round). Reference: internal-drysponge.c lines 485-522
     * @param {uint8[]} data - Padded block (16 bytes)
     * @returns {void}
     */
    mixPhase256(data) {
      const ds = this.domain;

      // Round 1: data[0..2] (bits 0-23, take bits 0-17)
      this.mixPhaseRound(OpCodes.Or32(OpCodes.Or32(data[0], OpCodes.Shl32(data[1], 8)), OpCodes.Shl32(data[2], 16)));
      this.c.coreRound(0);

      // Round 2: data[2..4] shifted (bits 18-41, take bits 18-35)
      this.mixPhaseRound(OpCodes.Or32(OpCodes.Or32(OpCodes.Shr32(data[2], 2), OpCodes.Shl32(data[3], 6)), OpCodes.Shl32(data[4], 14)));
      this.c.coreRound(0);

      // Round 3: data[4..6] shifted (bits 36-59, take bits 36-53)
      this.mixPhaseRound(OpCodes.Or32(OpCodes.Or32(OpCodes.Shr32(data[4], 4), OpCodes.Shl32(data[5], 4)), OpCodes.Shl32(data[6], 12)));
      this.c.coreRound(0);

      // Round 4: data[6..8] shifted (bits 54-77, take bits 54-71)
      this.mixPhaseRound(OpCodes.Or32(OpCodes.Or32(OpCodes.Shr32(data[6], 6), OpCodes.Shl32(data[7], 2)), OpCodes.Shl32(data[8], 10)));
      this.c.coreRound(0);

      // Round 5: data[9..11] (bits 72-95, take bits 72-89)
      this.mixPhaseRound(OpCodes.Or32(OpCodes.Or32(data[9], OpCodes.Shl32(data[10], 8)), OpCodes.Shl32(data[11], 16)));
      this.c.coreRound(0);

      // Round 6: data[11..13] shifted (bits 90-113, take bits 90-107)
      this.mixPhaseRound(OpCodes.Or32(OpCodes.Or32(OpCodes.Shr32(data[11], 2), OpCodes.Shl32(data[12], 6)), OpCodes.Shl32(data[13], 14)));
      this.c.coreRound(0);

      // Round 7: data[13..15] shifted (bits 108-127, take bits 108-125)
      this.mixPhaseRound(OpCodes.Or32(OpCodes.Or32(OpCodes.Shr32(data[13], 4), OpCodes.Shl32(data[14], 4)), OpCodes.Shl32(data[15], 12)));
      this.c.coreRound(0);

      // Round 8: data[15] final 2 bits + domain separator (bits 126-127)
      this.mixPhaseRound(OpCodes.Xor32(OpCodes.Shr32(data[15], 6), ds));

      // Reset domain for next block
      this.domain = 0;
    }

    /**
     * G function: run the core rounds and squeeze r. Each output word folds
     * the state words W[4k + ((j + k) mod 4)]: W[0]^W[5], W[1]^W[6], W[2]^W[7],
     * W[3]^W[4] for GASCON-128, and W[0]^W[5]^W[10]^W[15], W[1]^W[6]^W[11]^W[12],
     * W[2]^W[7]^W[8]^W[13], W[3]^W[4]^W[9]^W[14] for GASCON-256.
     * @returns {void}
     */
    g() {
      const terms = (this.c.wordCount - 1) / 2;
      for (let round = 0; round < this.rounds; ++round) {
        this.c.coreRound(round);

        for (let j = 0; j < 4; ++j) {
          let out = this.c.S[j];
          for (let k = 1; k < terms; ++k) {
            out = OpCodes.Xor32(out, this.c.S[4 * k + (j + k) % 4]);
          }
          const bytes = OpCodes.Unpack32LE(out);
          for (let b = 0; b < 4; ++b) {
            if (round === 0) {
              // First round: set r[]
              this.r[4 * j + b] = bytes[b];
            } else {
              // Subsequent rounds: XOR into r[]
              this.r[4 * j + b] = OpCodes.Xor8(this.r[4 * j + b], bytes[b]);
            }
          }
        }
      }
    }

    /**
     * G-core: run the rounds without squeezing
     * @returns {void}
     */
    gCore() {
      for (let round = 0; round < this.rounds; ++round) {
        this.c.coreRound(round);
      }
    }

    /**
     * Pad a block to the rate: a short block gets 0x01 then zeros
     * @param {uint8[]} input - Block bytes
     * @param {int32} len - Number of bytes of input to use
     * @returns {uint8[]} Padded block of rate bytes
     */
    _pad(input, len) {
      /** @type {uint8[]} */
      const padded = [];
      if (len < this.rate) {
        for (let i = 0; i < len; ++i) padded.push(input[i]);
        padded.push(0x01);
        for (let i = len + 1; i < this.rate; ++i) padded.push(0);
      } else {
        for (let i = 0; i < this.rate; ++i) padded.push(input[i]);
      }
      return padded;
    }

    /**
     * F function of DrySPONGE128: mix + g
     * @param {uint8[]} input - Block bytes
     * @param {int32} len - Number of bytes of input to use
     * @returns {void}
     */
    f(input, len) {
      this.mixPhase128(this._pad(input, len));
      this.g();
      this.domain = 0;
    }

    /**
     * F function of DrySPONGE256 with absorb only (g_core - no squeeze)
     * @param {uint8[]} input - Block bytes
     * @param {int32} len - Number of bytes of input to use
     * @returns {void}
     */
    fAbsorb(input, len) {
      this.mixPhase256(this._pad(input, len));
    }

    /**
     * Load a precomputed c state and x value
     * @param {uint8[]} init - c state (8 bytes per word) followed by the 16 x bytes
     * @returns {void}
     */
    load(init) {
      const cBytes = 8 * this.c.wordCount;
      for (let i = 0; i < cBytes; i += 4) {
        this.c.S[i / 4] = OpCodes.Pack32LE(init[i], init[i + 1], init[i + 2], init[i + 3]);
      }
      for (let i = 0; i < 16; ++i) {
        this.x[i] = init[cBytes + i];
      }
      for (let i = 0; i < this.rate; ++i) {
        this.r[i] = 0;
      }
      this.domain = 0;
    }
  }

  // ========================[ DRYGASCON128-HASH ALGORITHM ]========================

  /**
 * DryGASCON128Hash - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class DryGASCON128Hash extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "DryGASCON128-HASH";
      this.description = "Lightweight hash function using DrySPONGE construction with GASCON permutation. NIST Lightweight Cryptography finalist providing 256-bit hash output with protection against side-channel attacks.";
      this.inventor = "Sébastien Riou, Michaël Raulet, Stéphane Castelain";
      this.year = 2020;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight Hash";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.FRANCE;

      this.SupportedOutputSizes = [new KeySize(32, 32, 1)];

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

      this.references = [
        new LinkItem("Official DryGASCON reference implementation (Sébastien Riou)", "https://github.com/sebastien-riou/DryGASCON")
      ];

      // Official test vectors from DryGASCON128-HASH.txt
      this.tests = [
        {
          text: "DryGASCON128-HASH: Empty message (Count=1)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON128-HASH.txt",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("1EDC77386E20A37C721D6E77ADABB9C4830F199F5ED25284A13C1D84B9FC257A")
        },
        {
          text: "DryGASCON128-HASH: Single byte 0x00 (Count=2)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON128-HASH.txt",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("1BEC89506E75D725BF93BCCFDD6EC81DF05CA281CF5201E3EE0865A7063763EE")
        },
        {
          text: "DryGASCON128-HASH: Two bytes (Count=3)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON128-HASH.txt",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("0FE4ED67EA1FF705E94E6D8AF07197728C1FC2D7D5ACCECB8D08CF39AE4D208D")
        },
        {
          text: "DryGASCON128-HASH: Four bytes (Count=5)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON128-HASH.txt",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("591A2858B4E3B0B99BC116E18B44B55D711F2A8E83FAE677CED46DB03E031B73")
        },
        {
          text: "DryGASCON128-HASH: Eight bytes (Count=9)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON128-HASH.txt",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("CDE2DEE0235345CBFA51EC2CE57435718EC0133EC2756E035FA404C1CE511E24")
        },
        {
          text: "DryGASCON128-HASH: 16 bytes (Count=17)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON128-HASH.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("572821D80D943E153CBB8C4556C3AD8CF20D77EDAD7998E8CD46F590D8D13EEB")
        }
      ];
    }

    /**
   * Create new hash instance
   * @param {boolean} [isInverse=false] - A hash has no inverse: true yields null
   * @returns {DryGASCON128HashInstance} New hash instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new DryGASCON128HashInstance(this);
    }
  }

  /**
 * DryGASCON128-HASH instance implementing the Feed/Result pattern
 * @class
 * @extends {IHashFunctionInstance}
 */

  class DryGASCON128HashInstance extends IHashFunctionInstance {
    /**
     * @param {DryGASCON128Hash} algorithm - Parent algorithm instance
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {DrySpongeState} */
      this.state = new DrySpongeState(
        false,
        DRYSPONGE128_RATE,
        DRYSPONGE128_XSIZE,
        DRYSPONGE128_ROUNDS,
        DRYSPONGE128_INIT_ROUNDS
      );
      /** @type {boolean} */
      this.initialized = false;
    }

    /**
     * Load the precomputed initial state, once
     * @returns {void}
     */
    _initialize() {
      if (this.initialized) return;

      // Precomputed initialization vector from C reference implementation
      // drygascon128_hash_init: c is 40 bytes (5 x 64-bit words), x is 16 bytes
      this.state.load(OpCodes.Hex8ToBytes(
        "243f6a8885a308d313198a2e03707344" +  // c[0-15]
        "243f6a8885a308d313198a2e03707344" +  // c[16-31]
        "243f6a8885a308d3" +                  // c[32-39]
        "a4093822299f31d0082efa98ec4e6c89"    // x[0-15]
      ));

      this.initialized = true;
    }


    /**
   * Hash the fed message
   * @returns {uint8[]} 32-byte digest
   */

    Result() {
      this._initialize();

      const message = this.inputBuffer;
      const mLen = message.length;

      if (mLen === 0) {
        // Empty message: final block with domain separation
        this.state.domain = OpCodes.Or32(OpCodes.Or32(DRYDOMAIN128_ASSOC_DATA, DRYDOMAIN128_FINAL), DRYDOMAIN128_PADDED);
        this.state.f(message, 0);
      } else {
        let offset = 0;

        // Absorb all blocks except the last (no domain separation)
        while (mLen - offset > this.state.rate) {
          const block = message.slice(offset, offset + this.state.rate);
          this.state.f(block, this.state.rate);
          offset += this.state.rate;
        }

        // Final block with domain separation (ASSOC_DATA for hash mode)
        const lastBlock = message.slice(offset);
        this.state.domain = OpCodes.Or32(DRYDOMAIN128_ASSOC_DATA, DRYDOMAIN128_FINAL);
        if (lastBlock.length < this.state.rate) {
          this.state.domain = OpCodes.Or32(this.state.domain, DRYDOMAIN128_PADDED);
        }
        this.state.f(lastBlock, lastBlock.length);
      }

      // Squeeze hash (two blocks for 256-bit output)
      /** @type {uint8[]} */
      const output = [];
      for (let i = 0; i < 16; ++i) {
        output.push(this.state.r[i]);
      }

      // Second block (call g to get next 16 bytes)
      this.state.g();
      for (let i = 0; i < 16; ++i) {
        output.push(this.state.r[i]);
      }

      this.inputBuffer = [];
      return output;
    }
  }

  // ========================[ DRYGASCON256-HASH ALGORITHM ]========================

  /**
 * DryGASCON256Hash - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class DryGASCON256Hash extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "DryGASCON256-HASH";
      this.description = "Extended lightweight hash function using DrySPONGE construction with GASCON permutation. Provides 512-bit hash output with enhanced security margin and side-channel resistance.";
      this.inventor = "Sébastien Riou, Michaël Raulet, Stéphane Castelain";
      this.year = 2020;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight Hash";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.FRANCE;

      this.SupportedOutputSizes = [new KeySize(64, 64, 1)];

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

      this.references = [
        new LinkItem("Official DryGASCON reference implementation (Sébastien Riou)", "https://github.com/sebastien-riou/DryGASCON")
      ];

      // Official test vectors from DryGASCON256-HASH.txt
      this.tests = [
        {
          text: "DryGASCON256-HASH: Empty message (Count=1)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON256-HASH.txt",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("6896590A319FDE1F3B18EBAE1DF1E5E8FB0756A878EE9E2165B085FF3AED6805F8F73D5714C75960A6A8095DAE5EF9C00D3F055490D4CF45D4A26B37FD7B5441")
        },
        {
          text: "DryGASCON256-HASH: Single byte 0x00 (Count=2)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON256-HASH.txt",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("DAB16B97C37160586B647B0DCA689794365480324E539CD63F87B119B0C46668DCDE5163A170E06DA9361B05F7CE7645EF68BDC99B3B813B8B1583C5C62D4E4A")
        },
        {
          text: "DryGASCON256-HASH: Two bytes (Count=3)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON256-HASH.txt",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("D1982BC43D8C42DCD94C1C7E9611951374DC8BF5E6FC407E8A8DC423F4F0F45909A4AEAA1000B35A8081862E797508807E8763F611AEF1D3C06ECAEDB5229980")
        },
        {
          text: "DryGASCON256-HASH: Four bytes (Count=5)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON256-HASH.txt",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("3C4C288299FD3986FB213B945ADDB70F26EDEA09FA4291CF42467355DA09FDD7E69A7B306636DAC078EE81643A19F5126EA71DBC4032BE2320B8382119238D5B")
        },
        {
          text: "DryGASCON256-HASH: Eight bytes (Count=9)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON256-HASH.txt",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("AC99FD9156D4C6FC613A85CBBFD283FC7214792B3E786E34B33D368020F79BF6FFC2C29FA86EAF1286506F30ADB3481B3830E115AE72F155C3045DD8A27894D1")
        },
        {
          text: "DryGASCON256-HASH: 16 bytes (Count=17)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON256-HASH.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("E743DE651072AE1A078D201373BC383FFAE607545308D268AC663B0B680FEE8BD0D053EA40A55C5DD2AEE281C1CBFFA79152ACC9BD5705F3FB4DAF415458CA12")
        }
      ];
    }

    /**
   * Create new hash instance
   * @param {boolean} [isInverse=false] - A hash has no inverse: true yields null
   * @returns {DryGASCON256HashInstance} New hash instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new DryGASCON256HashInstance(this);
    }
  }

  /**
 * DryGASCON256-HASH instance implementing the Feed/Result pattern
 * @class
 * @extends {IHashFunctionInstance}
 */

  class DryGASCON256HashInstance extends IHashFunctionInstance {
    /**
     * @param {DryGASCON256Hash} algorithm - Parent algorithm instance
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {DrySpongeState} */
      this.state = new DrySpongeState(
        true,
        DRYSPONGE256_RATE,
        DRYSPONGE256_XSIZE,
        DRYSPONGE256_ROUNDS,
        DRYSPONGE256_INIT_ROUNDS
      );
      /** @type {boolean} */
      this.initialized = false;
    }

    /**
     * Load the precomputed initial state, once
     * @returns {void}
     */
    _initialize() {
      if (this.initialized) return;

      // Precomputed initialization vector from C reference implementation
      // drygascon256_hash_init: c is 72 bytes (9 x 64-bit words), x is 16 bytes
      this.state.load(OpCodes.Hex8ToBytes(
        "243f6a8885a308d313198a2e03707344" +  // c[0-15]
        "a4093822299f31d0082efa98ec4e6c89" +  // c[16-31]
        "243f6a8885a308d313198a2e03707344" +  // c[32-47]
        "a4093822299f31d0082efa98ec4e6c89" +  // c[48-63]
        "243f6a8885a308d3" +                  // c[64-71]
        "452821e638d01377be5466cf34e90c6c"    // x[0-15]
      ));

      this.initialized = true;
    }


    /**
   * Hash the fed message
   * @returns {uint8[]} 64-byte digest
   */

    Result() {
      this._initialize();

      const message = this.inputBuffer;
      const mLen = message.length;

      // Process message as associated data (following drygascon256_process_ad)
      if (mLen === 0) {
        // Empty message: final block with domain separation
        this.state.domain = OpCodes.Or32(OpCodes.Or32(DRYDOMAIN256_ASSOC_DATA, DRYDOMAIN256_FINAL), DRYDOMAIN256_PADDED);
        this.state.fAbsorb(message, 0);
        this.state.g();  // Final block gets full g() with squeeze
      } else {
        let offset = 0;

        // Absorb all blocks except the last using fAbsorb + gCore
        while (mLen - offset > this.state.rate) {
          const block = message.slice(offset, offset + this.state.rate);
          this.state.fAbsorb(block, this.state.rate);
          this.state.gCore();  // Only run rounds, no squeeze
          offset += this.state.rate;
        }

        // Final block with domain separation (ASSOC_DATA for hash mode)
        const lastBlock = message.slice(offset);
        this.state.domain = OpCodes.Or32(DRYDOMAIN256_ASSOC_DATA, DRYDOMAIN256_FINAL);
        if (lastBlock.length < this.state.rate) {
          this.state.domain = OpCodes.Or32(this.state.domain, DRYDOMAIN256_PADDED);
        }
        this.state.fAbsorb(lastBlock, lastBlock.length);
        this.state.g();  // Final block gets full g() with squeeze
      }

      // Squeeze hash (four blocks for 512-bit output)
      // First 16 bytes are in state.r after the final g() call above
      /** @type {uint8[]} */
      const output = [];
      for (let i = 0; i < 16; ++i) {
        output.push(this.state.r[i]);
      }

      // Additional three blocks (call g between each)
      for (let blockNum = 1; blockNum < 4; ++blockNum) {
        this.state.g();
        for (let i = 0; i < 16; ++i) {
          output.push(this.state.r[i]);
        }
      }

      this.inputBuffer = [];
      return output;
    }
  }

  // ========================[ REGISTRATION ]========================

  RegisterAlgorithm(new DryGASCON128Hash());
  RegisterAlgorithm(new DryGASCON256Hash());

  return {
    DryGASCON128Hash,
    DryGASCON128HashInstance,
    DryGASCON256Hash,
    DryGASCON256HashInstance
  };
}));
