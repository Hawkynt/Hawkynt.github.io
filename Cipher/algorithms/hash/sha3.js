/*
 * SHA-3 Hash Function Family - FIPS 202 Standard
 * Consolidated parametric implementation for SHA3-224, SHA3-256, SHA3-384, SHA3-512
 * Professional implementation matching Crypto++ reference
 * (c)2006-2025 Hawkynt
 *
 * Based on Keccak sponge construction with variable output sizes
 * Reference: https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf
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

  const { RegisterAlgorithm, CategoryType, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem, KeySize,
          BlockAbsorber, SpongePadBlocks } = AlgorithmFramework;

  // Keccak-f[1600] constants (shared by all SHA3 variants)
  /** @type {int32} */
  const KECCAK_ROUNDS = 24;

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

  /**
 * SHA3Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class SHA3Algorithm extends HashFunctionAlgorithm {
    /**
     * @param {string} [variant='256'] - '224', '256', '384' or '512' (anything else configures SHA3-256)
     */
    constructor(variant = '256') {
      super();

      this.name = 'SHA-3-' + variant;
      this.inventor = "Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche";
      this.year = 2015;
      this.category = CategoryType.HASH;
      this.subCategory = "SHA-3 Family";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      // Variant-specific parameters
      /** @type {string} */
      this.variant = variant;
      /** @type {int32} Digest size in bytes */
      this.outputSize = 32;
      /** @type {int32} Capacity in bits */
      this.capacity = 512;
      /** @type {int32} Rate in bits */
      this.rate = 1088;

      if (variant === '224') {
        this.description = "SHA-3-224 produces 224-bit digests using the Keccak sponge construction with capacity 448 bits. Part of the NIST FIPS 202 standard.";
        this.outputSize = 28;   // bytes
        this.capacity = 448;   // bits
        this.rate = 1152;   // bits
        this.tests = [
          {
            text: "SHA3-224: Empty (NIST FIPS 202)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/sha3_224_fips_202.txt",
            input: [],
            expected: OpCodes.Hex8ToBytes("6b4e03423667dbb73b6e15454f0eb1abd4597f9a1b078e3f5b5a6bc7")
          },
          {
            text: "SHA3-224: Single byte (NIST FIPS 202)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/sha3_224_fips_202.txt",
            input: OpCodes.Hex8ToBytes("01"),
            expected: OpCodes.Hex8ToBytes("488286d9d32716e5881ea1ee51f36d3660d70f0db03b3f612ce9eda4")
          },
          {
            text: "SHA3-224: Two bytes (NIST FIPS 202)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/sha3_224_fips_202.txt",
            input: OpCodes.Hex8ToBytes("69cb"),
            expected: OpCodes.Hex8ToBytes("94bd25c4cf6ca889126df37ddd9c36e6a9b28a4fe15cc3da6debcdd7")
          },
          {
            text: "SHA3-224: 64 bits (NIST FIPS 202)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/sha3_224_fips_202.txt",
            input: OpCodes.Hex8ToBytes("e4ea2c16366b80d6"),
            expected: OpCodes.Hex8ToBytes("7dd1a8e3ffe8c99cc547a69af14bd63b15ac26bd3d36b8a99513e89e")
          }
        ];
      } else if (variant === '384') {
        this.description = "SHA-3-384 produces 384-bit digests using the Keccak sponge construction with capacity 768 bits. Part of the NIST FIPS 202 standard.";
        this.outputSize = 48;   // bytes
        this.capacity = 768;   // bits
        this.rate = 832;   // bits
        this.tests = [
          {
            text: "SHA3-384: Empty (NIST FIPS 202)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/sha3_384_fips_202.txt",
            input: [],
            expected: OpCodes.Hex8ToBytes("0c63a75b845e4f7d01107d852e4c2485c51a50aaaa94fc61995e71bbee983a2ac3713831264adb47fb6bd1e058d5f004")
          },
          {
            text: "SHA3-384: Single byte (NIST FIPS 202)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/sha3_384_fips_202.txt",
            input: OpCodes.Hex8ToBytes("80"),
            expected: OpCodes.Hex8ToBytes("7541384852e10ff10d5fb6a7213a4a6c15ccc86d8bc1068ac04f69277142944f4ee50d91fdc56553db06b2f5039c8ab7")
          },
          {
            text: "SHA3-384: Two bytes (NIST FIPS 202)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/sha3_384_fips_202.txt",
            input: OpCodes.Hex8ToBytes("fb52"),
            expected: OpCodes.Hex8ToBytes("d73a9d0e7f1802352ea54f3e062d3910577bf87edda48101de92a3de957e698b836085f5f10cab1de19fd0c906e48385")
          },
          {
            text: "SHA3-384: 64 bits (NIST FIPS 202)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/sha3_384_fips_202.txt",
            input: OpCodes.Hex8ToBytes("c44a2c58c84c393a"),
            expected: OpCodes.Hex8ToBytes("60ad40f964d0edcf19281e415f7389968275ff613199a069c916a0ff7ef65503b740683162a622b913d43a46559e913c")
          }
        ];
      } else if (variant === '512') {
        this.description = "SHA-3-512 produces 512-bit digests using the Keccak sponge construction with capacity 1024 bits. Part of the NIST FIPS 202 standard.";
        this.outputSize = 64;   // bytes
        this.capacity = 1024;   // bits
        this.rate = 576;   // bits
        this.tests = [
          {
            text: "SHA3-512: Empty (NIST FIPS 202)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/sha3_512_fips_202.txt",
            input: [],
            expected: OpCodes.Hex8ToBytes("a69f73cca23a9ac5c8b567dc185a756e97c982164fe25859e0d1dcc1475c80a615b2123af1f5f94c11e3e9402c3ac558f500199d95b6d3e301758586281dcd26")
          },
          {
            text: "SHA3-512: Single byte (NIST FIPS 202)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/sha3_512_fips_202.txt",
            input: OpCodes.Hex8ToBytes("e5"),
            expected: OpCodes.Hex8ToBytes("150240baf95fb36f8ccb87a19a41767e7aed95125075a2b2dbba6e565e1ce8575f2b042b62e29a04e9440314a821c6224182964d8b557b16a492b3806f4c39c1")
          },
          {
            text: "SHA3-512: Two bytes (NIST FIPS 202)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/sha3_512_fips_202.txt",
            input: OpCodes.Hex8ToBytes("ef26"),
            expected: OpCodes.Hex8ToBytes("809b4124d2b174731db14585c253194c8619a68294c8c48947879316fef249b1575da81ab72aad8fae08d24ece75ca1be46d0634143705d79d2f5177856a0437")
          },
          {
            text: "SHA3-512: 64 bits (NIST FIPS 202)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/sha3_512_fips_202.txt",
            input: OpCodes.Hex8ToBytes("af53fa3ff8a3cfb2"),
            expected: OpCodes.Hex8ToBytes("03c2ac02de1765497a0a6af466fb64758e3283ed83d02c0edb3904fd3cf296442e790018d4bf4ce55bc869cebb4aa1a799afc9d987e776fef5dfe6628e24de97")
          }
        ];
      } else {
        this.description = "SHA-3-256 produces 256-bit digests using the Keccak sponge construction with capacity 512 bits. Part of the NIST FIPS 202 standard.";
        this.outputSize = 32;   // bytes
        this.capacity = 512;   // bits
        this.rate = 1088;   // bits
        this.tests = [
          {
            text: "NIST Test Vector - Empty String",
            uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf",
            input: [],
            expected: OpCodes.Hex8ToBytes('a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a')
          },
          {
            text: "NIST Test Vector - 'abc'",
            uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf",
            input: [0x61, 0x62, 0x63], // 'abc'
            expected: OpCodes.Hex8ToBytes('3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532')
          },
          {
            text: "NIST Test Vector - Long String",
            uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf",
            input: [0x61,0x62,0x63,0x64,0x62,0x63,0x64,0x65,0x63,0x64,0x65,0x66,0x64,0x65,0x66,0x67,0x65,0x66,0x67,0x68,0x66,0x67,0x68,0x69,0x67,0x68,0x69,0x6a,0x68,0x69,0x6a,0x6b,0x69,0x6a,0x6b,0x6c,0x6a,0x6b,0x6c,0x6d,0x6b,0x6c,0x6d,0x6e,0x6c,0x6d,0x6e,0x6f,0x6d,0x6e,0x6f,0x70,0x6e,0x6f,0x70,0x71], // 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'
            expected: OpCodes.Hex8ToBytes('41c0dba2a9d6240849100376a8235e2c82e1b9998a999e21db32dd97496d3376')
          }
        ];
      }

      /** @type {int32} Rate in bytes */
      this.rateInBytes = this.rate / 8;

      this.SupportedOutputSizes = [new KeySize(this.outputSize, this.outputSize, 1)];
      /** @type {int32} */
      this.BlockSize = this.rateInBytes;

      this.documentation = [
        new LinkItem("NIST FIPS 202", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf"),
        new LinkItem("Keccak Team", "https://keccak.team/")
      ];

      this.references = [
        new LinkItem("Crypto++ SHA3", "https://github.com/weidai11/cryptopp/blob/master/sha3.cpp"),
        new LinkItem("NIST Test Vectors", "https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program")
      ];
    }

    /**
     * Create new hash instance
     * @param {boolean} [isInverse=false] - A hash has no inverse: true yields null
     * @returns {SHA3Instance} New hash instance
     */
    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new SHA3Instance(this);
    }
  }

  /**
 * SHA3 hash instance implementing the Feed/Result pattern
 * @class
 * @extends {IHashFunctionInstance}
 */

  class SHA3Instance extends IHashFunctionInstance {
    /**
     * Initialize a SHA-3 instance
     * @param {SHA3Algorithm} algorithm - Parent algorithm instance
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {int32} Sponge rate in bytes */
      this._rate = algorithm.rateInBytes;
      /** @type {int32} Digest size in bytes */
      this._outputSize = algorithm.outputSize;
      /** @type {uint32[][]} 25 lanes as [low32, high32] */
      this.state = new Array(25);
      for (let i = 0; i < 25; i++) {
        /** @type {uint32[]} */
        const lane = [0, 0];
        this.state[i] = lane;
      }
      /** @type {BlockAbsorber} */
      this._absorber = new BlockAbsorber(this._rate, block => this._absorb(block));
    }

    /**
     * Feed data to the sponge
     * @param {uint8[]} data - Input data bytes
     */
    Feed(data) {
      this._absorber.Absorb(data);
    }

    /**
     * XOR one rate block into the state and permute
     * @param {uint8[]} block - Exactly rate bytes
     * @returns {void}
     */
    _absorb(block) {
      const rate = this._rate;
      for (let i = 0; i < rate; i += 8) {
        const idx = i / 8;
        const low = OpCodes.Pack32LE(block[i], block[i + 1], block[i + 2], block[i + 3]);
        const high = OpCodes.Pack32LE(block[i + 4], block[i + 5], block[i + 6], block[i + 7]);
        this.state[idx][0] = OpCodes.Xor32(this.state[idx][0], low);
        this.state[idx][1] = OpCodes.Xor32(this.state[idx][1], high);
      }
      keccakF(this.state);
    }

    /**
     * Pad, absorb the last block and squeeze the digest
     * @returns {uint8[]} Hash digest as byte array
     */
    Result() {
      const rate = this._rate;
      const outputSize = this._outputSize;

      // SHA-3 padding: the domain separator 0x06 followed by pad10*1, whose
      // final bit lands in the top bit of the last rate byte (FIPS 202 sections
      // 5.1 and B.2). The two coincide when exactly one byte of the block is
      // free and must merge to 0x86; SpongePadBlocks is the one place that rule
      // is now written down, shared with Keccak, SHAKE and cSHAKE.
      /** @type {uint8[][]} */
      const padded = this._absorber.Finish((held, pending) => SpongePadBlocks(held, pending, rate, 0x06));
      for (const block of padded)
        this._absorb(block);

      // Squeeze phase: extract outputSize bytes from state (outputSize < rate)
      /** @type {uint8[]} */
      const output = [];

      for (let i = 0; i < outputSize && i < rate; i += 8) {
        const idx = i / 8;
        const bytes1 = OpCodes.Unpack32LE(this.state[idx][0]);
        const bytes2 = OpCodes.Unpack32LE(this.state[idx][1]);

        for (let j = 0; j < 4 && output.length < outputSize; j++) {
          output.push(bytes1[j]);
        }
        for (let j = 0; j < 4 && output.length < outputSize; j++) {
          output.push(bytes2[j]);
        }
      }

      return output;
    }
  }

  // Register all 4 SHA3 variants
  /** @type {string[]} */
  const variants = ['224', '256', '384', '512'];
  for (let i = 0; i < variants.length; i++) {
    const algorithmInstance = new SHA3Algorithm(variants[i]);
    if (!AlgorithmFramework.Find(algorithmInstance.name)) {
      RegisterAlgorithm(algorithmInstance);
    }
  }

  return { SHA3Algorithm, SHA3Instance };
}));
