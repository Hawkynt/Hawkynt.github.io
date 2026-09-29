/*
 * Keccak Hash Function Family - Original Keccak submission
 * Professional implementation matching Crypto++ reference
 * (c)2006-2025 Hawkynt
 *
 * Based on Keccak sponge construction with 224/256/384/512-bit outputs
 * This is the ORIGINAL Keccak, not SHA-3 (different padding: 0x01 vs 0x06)
 * Reference: http://keccak.noekeon.org/
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
 * KeccakAlgorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class KeccakAlgorithm extends HashFunctionAlgorithm {
    /**
     * @param {string} [variant='256'] - '224', '256', '384' or '512'
     * @throws {Error} For any other variant
     */
    constructor(variant = '256') {
      super();

      this.name = 'Keccak-' + variant;
      this.inventor = "Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche";
      this.year = 2012;
      this.category = CategoryType.HASH;
      this.subCategory = "Keccak Family";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      /** @type {string} */
      this.variant = variant;
      /** @type {int32} Digest size in bytes */
      this.outputSize = 0;
      /** @type {int32} Sponge rate in bytes */
      this.rate = 0;
      /** @type {int32} Capacity in bits */
      this.capacity = 0;

      if (variant === '224') {
        this.description = "Original Keccak-224 hash function (pre-SHA3). Uses 0x01 padding instead of SHA-3's 0x06. Produces 224-bit digests.";
        this.outputSize = 28;
        this.capacity = 448;
        this.rate = 144;
        this.tests = [
          {
            text: "Keccak-224: Empty (Crypto++)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt",
            input: [],
            expected: OpCodes.Hex8ToBytes("f71837502ba8e10837bdd8d365adb85591895602fc552b48b7390abd")
          },
          {
            text: "Keccak-224: 'abc' (Crypto++)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt",
            input: OpCodes.AnsiToBytes("abc"),
            expected: OpCodes.Hex8ToBytes("c30411768506ebe1c2871b1ee2e87d38df342317300a9b97a95ec6a8")
          },
          {
            text: "Keccak-224: 'The quick brown fox...' (Crypto++)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt",
            input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
            expected: OpCodes.Hex8ToBytes("310aee6b30c47350576ac2873fa89fd190cdc488442f3ef654cf23fe")
          },
          {
            text: "Keccak-224: Long message (Crypto++)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt",
            input: OpCodes.AnsiToBytes("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
            expected: OpCodes.Hex8ToBytes("e51faa2b4655150b931ee8d700dc202f763ca5f962c529eae55012b6")
          }
        ];
      } else if (variant === '256') {
        this.description = "Original Keccak-256 hash function (pre-SHA3). Uses 0x01 padding instead of SHA-3's 0x06. Widely used in blockchain applications like Ethereum.";
        this.outputSize = 32;
        this.capacity = 512;
        this.rate = 136;
        this.tests = [
          {
            text: "Keccak-256: Empty (Crypto++)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt",
            input: [],
            expected: OpCodes.Hex8ToBytes("c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470")
          },
          {
            text: "Keccak-256: 'abc' (Crypto++)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt",
            input: OpCodes.AnsiToBytes("abc"),
            expected: OpCodes.Hex8ToBytes("4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45")
          },
          {
            text: "Keccak-256: 'The quick brown fox...' (Crypto++)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt",
            input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
            expected: OpCodes.Hex8ToBytes("4d741b6f1eb29cb2a9b9911c82f56fa8d73b04959d3d9d222895df6c0b28aa15")
          },
          {
            text: "Keccak-256: Long message (Crypto++)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt",
            input: OpCodes.AnsiToBytes("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
            expected: OpCodes.Hex8ToBytes("45d3b367a6904e6e8d502ee04999a7c27647f91fa845d456525fd352ae3d7371")
          }
        ];
      } else if (variant === '384') {
        this.description = "Original Keccak-384 hash function (pre-SHA3). Uses 0x01 padding instead of SHA-3's 0x06. Produces 384-bit digests.";
        this.outputSize = 48;
        this.capacity = 768;
        this.rate = 104;
        this.tests = [
          {
            text: "Keccak-384: Empty (Crypto++)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt",
            input: [],
            expected: OpCodes.Hex8ToBytes("2c23146a63a29acf99e73b88f8c24eaa7dc60aa771780ccc006afbfa8fe2479b2dd2b21362337441ac12b515911957ff")
          },
          {
            text: "Keccak-384: 'abc' (Crypto++)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt",
            input: OpCodes.AnsiToBytes("abc"),
            expected: OpCodes.Hex8ToBytes("f7df1165f033337be098e7d288ad6a2f74409d7a60b49c36642218de161b1f99f8c681e4afaf31a34db29fb763e3c28e")
          },
          {
            text: "Keccak-384: 'The quick brown fox...' (Crypto++)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt",
            input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
            expected: OpCodes.Hex8ToBytes("283990fa9d5fb731d786c5bbee94ea4db4910f18c62c03d173fc0a5e494422e8a0b3da7574dae7fa0baf005e504063b3")
          },
          {
            text: "Keccak-384: Long message (Crypto++)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt",
            input: OpCodes.AnsiToBytes("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
            expected: OpCodes.Hex8ToBytes("b41e8896428f1bcbb51e17abd6acc98052a3502e0d5bf7fa1af949b4d3c855e7c4dc2c390326b3f3e74c7b1e2b9a3657")
          }
        ];
      } else if (variant === '512') {
        this.description = "Original Keccak-512 hash function (pre-SHA3). Uses 0x01 padding instead of SHA-3's 0x06. Produces 512-bit digests.";
        this.outputSize = 64;
        this.capacity = 1024;
        this.rate = 72;
        this.tests = [
          {
            text: "Keccak-512: Empty (Crypto++)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt",
            input: [],
            expected: OpCodes.Hex8ToBytes("0eab42de4c3ceb9235fc91acffe746b29c29a8c366b7c60e4e67c466f36a4304c00fa9caf9d87976ba469bcbe06713b435f091ef2769fb160cdab33d3670680e")
          },
          {
            text: "Keccak-512: 'abc' (Crypto++)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt",
            input: OpCodes.AnsiToBytes("abc"),
            expected: OpCodes.Hex8ToBytes("18587dc2ea106b9a1563e32b3312421ca164c7f1f07bc922a9c83d77cea3a1e5d0c6991073902537 2dc14ac964262937 9540c17e2a65b19d 77aa511a9d00bb96".replace(/ /g, ''))
          },
          {
            text: "Keccak-512: 'The quick brown fox...' (Crypto++)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt",
            input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
            expected: OpCodes.Hex8ToBytes("d135bb84d0439dbac432247ee573a23ea7d3c9deb2a968eb31d47c4fb45f1ef4422d6c531b5b9bd6f449ebcc449ea94d0a8f05f62130fda612da53c79659f609")
          },
          {
            text: "Keccak-512: Long message (Crypto++)",
            uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt",
            input: OpCodes.AnsiToBytes("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
            expected: OpCodes.Hex8ToBytes("6aa6d3669597df6d 5a007b00d09c2079 5b5c4218234e1698 a944757a488ecdc0 9965435d97ca32c3 cfed7201ff30e070 cd947f1fc12b9d92 14c467d342bcba5d".replace(/ /g, ''))
          }
        ];
      } else {
        throw new Error('Unsupported Keccak variant: ' + variant + '. Supported: 224, 256, 384, 512');
      }

      this.SupportedOutputSizes = [new KeySize(this.outputSize, this.outputSize, 1)];
      /** @type {int32} */
      this.BlockSize = this.rate;

      this.documentation = [
        new LinkItem("Keccak Team", "https://keccak.team/"),
        new LinkItem("Original Keccak", "http://keccak.noekeon.org/")
      ];

      this.references = [
        new LinkItem("Crypto++ Keccak", "https://github.com/weidai11/cryptopp/blob/master/keccak.cpp"),
        new LinkItem("Keccak Test Vectors", "http://keccak.noekeon.org/KeccakKAT-3.zip")
      ];
    }

    /**
     * Create new hash instance
     * @param {boolean} [isInverse=false] - A hash has no inverse: true yields null
     * @returns {KeccakInstance} New hash instance
     */
    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new KeccakInstance(this);
    }
  }

  /**
 * Keccak hash instance implementing the Feed/Result pattern
 * @class
 * @extends {IHashFunctionInstance}
 */

  class KeccakInstance extends IHashFunctionInstance {
    /**
     * Initialize a Keccak instance
     * @param {KeccakAlgorithm} algorithm - Parent algorithm instance
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {uint32[][]} 25 lanes as [low32, high32] */
      this.state = new Array(25);
      for (let i = 0; i < 25; i++) {
        /** @type {uint32[]} */
        const lane = [0, 0];
        this.state[i] = lane;
      }
      /** @type {int32} Sponge rate in bytes */
      this.rate = algorithm.rate;
      /** @type {int32} Digest size in bytes */
      this.outputSize = algorithm.outputSize;
      /** @type {BlockAbsorber} */
      this._absorber = new BlockAbsorber(this.rate, block => this._absorb(block));
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
      for (let i = 0; i < this.rate; i += 8) {
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
      // Keccak padding (0x01 instead of SHA-3's 0x06), then pad10*1. The two
      // coincide when exactly one byte of the block is free and must merge to
      // 0x81 rather than one overwriting the other; SpongePadBlocks is the one
      // place that rule is now written down.
      const rate = this.rate;
      /** @type {uint8[][]} */
      const padded = this._absorber.Finish((held, pending) => SpongePadBlocks(held, pending, rate, 0x01));
      for (const block of padded)
        this._absorb(block);

      /** @type {uint8[]} */
      const output = [];

      for (let i = 0; i < this.outputSize && i < this.rate; i += 8) {
        const idx = i / 8;
        const bytes1 = OpCodes.Unpack32LE(this.state[idx][0]);
        const bytes2 = OpCodes.Unpack32LE(this.state[idx][1]);

        for (let j = 0; j < 4 && output.length < this.outputSize; j++) output.push(bytes1[j]);
        for (let j = 0; j < 4 && output.length < this.outputSize; j++) output.push(bytes2[j]);
      }

      return output;
    }
  }

  // Register all 4 variants
  RegisterAlgorithm(new KeccakAlgorithm('224'));
  RegisterAlgorithm(new KeccakAlgorithm('256'));
  RegisterAlgorithm(new KeccakAlgorithm('384'));
  RegisterAlgorithm(new KeccakAlgorithm('512'));

  return { KeccakAlgorithm, KeccakInstance };
}));
