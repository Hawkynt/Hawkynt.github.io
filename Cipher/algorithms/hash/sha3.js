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
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem, KeySize } = AlgorithmFramework;

  // Keccak-f[1600] constants (shared by all SHA3 variants)
  const KECCAK_ROUNDS = 24;
  const KECCAK_STATE_WIDTH = 1600; // bits

  // Keccak round constants (24 rounds, as [low32, high32] pairs) - FIPS 202 compliant
  const RC = Object.freeze([
    [0x00000001, 0x00000000], [0x00008082, 0x00000000], [0x0000808a, 0x80000000], [0x80008000, 0x80000000],
    [0x0000808b, 0x00000000], [0x80000001, 0x00000000], [0x80008081, 0x80000000], [0x00008009, 0x80000000],
    [0x0000008a, 0x00000000], [0x00000088, 0x00000000], [0x80008009, 0x00000000], [0x8000000a, 0x00000000],
    [0x8000808b, 0x00000000], [0x0000008b, 0x80000000], [0x00008089, 0x80000000], [0x00008003, 0x80000000],
    [0x00008002, 0x80000000], [0x00000080, 0x80000000], [0x0000800a, 0x00000000], [0x8000000a, 0x80000000],
    [0x80008081, 0x80000000], [0x00008080, 0x80000000], [0x80000001, 0x00000000], [0x80008008, 0x80000000]
  ]);

  // Rotation offsets for rho step
  const RHO_OFFSETS = Object.freeze([
    0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41,
    45, 15, 21, 8, 18, 2, 61, 56, 14
  ]);

  /**
   * 64-bit XOR operation
   * @param {Array} a - [low32, high32]
   * @param {Array} b - [low32, high32]
   * @returns {Array} XOR result [low32, high32]
   */
  function xor64(a, b) {
    return [a[0] ^ b[0], a[1] ^ b[1]];
  }

  /**
   * 64-bit left rotation (using 32-bit operations)
   * @param {Array} val - [low32, high32]
   * @param {number} positions - Rotation positions
   * @returns {Array} Rotated [low32, high32]
   */
  function rotl64(val, positions) {
    const [low, high] = val;
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

  /**
   * Keccak-f[1600] permutation
   * @param {Array} state - 25 x [low32, high32] state array
   */
  function keccakF(state) {
    for (let round = 0; round < KECCAK_ROUNDS; round++) {
      // Theta step
      const C = new Array(5);
      for (let x = 0; x < 5; x++) {
        C[x] = [0, 0];
        for (let y = 0; y < 5; y++) {
          C[x] = xor64(C[x], state[x + 5 * y]);
        }
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

      // Rho step
      for (let i = 0; i < 25; i++) {
        state[i] = rotl64(state[i], RHO_OFFSETS[i]);
      }

      // Pi step
      const temp = new Array(25);
      for (let i = 0; i < 25; i++) {
        temp[i] = [state[i][0], state[i][1]];
      }

      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[y + 5 * ((2 * x + 3 * y) % 5)] = temp[x + 5 * y];
        }
      }

      // Chi step
      for (let y = 0; y < 5; y++) {
        const row = new Array(5);
        for (let x = 0; x < 5; x++) {
          row[x] = [state[x + 5 * y][0], state[x + 5 * y][1]];
        }

        for (let x = 0; x < 5; x++) {
          const notNext = [~row[(x + 1) % 5][0], ~row[(x + 1) % 5][1]];
          const andResult = [notNext[0] & row[(x + 2) % 5][0], notNext[1] & row[(x + 2) % 5][1]];
          state[x + 5 * y] = xor64(row[x], andResult);
        }
      }

      // Iota step
      state[0] = xor64(state[0], RC[round]);
    }
  }

  class SHA3Algorithm extends HashFunctionAlgorithm {
    constructor(variant = '256') {
      super();

      const config = this._getVariantConfig(variant);

      this.name = `SHA-3-${variant}`;
      this.description = config.description;
      this.inventor = "Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche";
      this.year = 2015;
      this.category = CategoryType.HASH;
      this.subCategory = "SHA-3 Family";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      // Variant-specific parameters
      this.variant = variant;
      this.outputSize = config.outputSize;   // bytes
      this.capacity = config.capacity;       // bits
      this.rate = config.rate;               // bits
      this.rateInBytes = config.rate / 8;

      this.SupportedHashSizes = [new KeySize(config.outputSize, config.outputSize, 1)];
      this.BlockSize = this.rateInBytes;

      this.documentation = [
        new LinkItem("NIST FIPS 202", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf"),
        new LinkItem("Keccak Team", "https://keccak.team/")
      ];

      this.references = [
        new LinkItem("Crypto++ SHA3", "https://github.com/weidai11/cryptopp/blob/master/sha3.cpp"),
        new LinkItem("NIST Test Vectors", "https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program")
      ];

      this.tests = config.tests;
    }

    _getVariantConfig(variant) {
      const configs = {
        '224': {
          description: "SHA-3-224 produces 224-bit digests using the Keccak sponge construction with capacity 448 bits. Part of the NIST FIPS 202 standard.",
          outputSize: 28,   // 224 bits / 8
          capacity: 448,    // 2 × 224
          rate: 1152,       // 1600 - 448
          tests: [
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
          ]
        },
        '256': {
          description: "SHA-3-256 produces 256-bit digests using the Keccak sponge construction with capacity 512 bits. Part of the NIST FIPS 202 standard.",
          outputSize: 32,   // 256 bits / 8
          capacity: 512,    // 2 × 256
          rate: 1088,       // 1600 - 512
          tests: [
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
          ]
        },
        '384': {
          description: "SHA-3-384 produces 384-bit digests using the Keccak sponge construction with capacity 768 bits. Part of the NIST FIPS 202 standard.",
          outputSize: 48,   // 384 bits / 8
          capacity: 768,    // 2 × 384
          rate: 832,        // 1600 - 768
          tests: [
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
          ]
        },
        '512': {
          description: "SHA-3-512 produces 512-bit digests using the Keccak sponge construction with capacity 1024 bits. Part of the NIST FIPS 202 standard.",
          outputSize: 64,   // 512 bits / 8
          capacity: 1024,   // 2 × 512
          rate: 576,        // 1600 - 1024
          tests: [
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
          ]
        }
      };

      return configs[variant] || configs['256'];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new SHA3Instance(this);
    }
  }

  class SHA3Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.state = new Array(25);
      for (let i = 0; i < 25; i++) this.state[i] = [0, 0];
      this.buffer = new Uint8Array(algorithm.rateInBytes);
      this.bufferLength = 0;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      let offset = 0;
      const rate = this.algorithm.rateInBytes;

      while (offset < data.length && this.bufferLength < rate) {
        this.buffer[this.bufferLength++] = data[offset++];
      }

      while (this.bufferLength === rate) {
        this._absorb();
        this.bufferLength = 0;
        while (offset < data.length && this.bufferLength < rate) {
          this.buffer[this.bufferLength++] = data[offset++];
        }
      }
    }

    _absorb() {
      const rate = this.algorithm.rateInBytes;
      for (let i = 0; i < rate; i += 8) {
        const idx = Math.floor(i / 8);
        const low = OpCodes.Pack32LE(
          this.buffer[i] || 0,
          this.buffer[i+1] || 0,
          this.buffer[i+2] || 0,
          this.buffer[i+3] || 0
        );
        const high = OpCodes.Pack32LE(
          this.buffer[i+4] || 0,
          this.buffer[i+5] || 0,
          this.buffer[i+6] || 0,
          this.buffer[i+7] || 0
        );
        this.state[idx][0] ^= low;
        this.state[idx][1] ^= high;
      }
      keccakF(this.state);
    }

    Result() {
      const rate = this.algorithm.rateInBytes;
      const outputSize = this.algorithm.outputSize;

      // SHA-3 padding (domain separator 0x06)
      this.buffer[this.bufferLength] = 0x06;
      for (let i = this.bufferLength + 1; i < rate - 1; i++) {
        this.buffer[i] = 0;
      }
      this.buffer[rate - 1] = 0x80;
      this._absorb();

      // Squeeze phase: extract outputSize bytes from state
      const output = new Uint8Array(outputSize);
      let outputOffset = 0;

      for (let i = 0; i < outputSize && i < rate; i += 8) {
        const idx = Math.floor(i / 8);
        const bytes1 = OpCodes.Unpack32LE(this.state[idx][0]);
        const bytes2 = OpCodes.Unpack32LE(this.state[idx][1]);

        for (let j = 0; j < 4 && outputOffset < outputSize; j++) {
          output[outputOffset++] = bytes1[j];
        }
        for (let j = 0; j < 4 && outputOffset < outputSize; j++) {
          output[outputOffset++] = bytes2[j];
        }
      }

      return Array.from(output);
    }
  }

  // Register all 4 SHA3 variants
  const variants = ['224', '256', '384', '512'];
  for (const variant of variants) {
    const algorithmInstance = new SHA3Algorithm(variant);
    if (!AlgorithmFramework.Find(algorithmInstance.name)) {
      RegisterAlgorithm(algorithmInstance);
    }
  }

  return { SHA3Algorithm, SHA3Instance };
}));
