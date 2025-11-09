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
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem, KeySize } = AlgorithmFramework;

  // Keccak constants (shared across all variants)
  const ROUNDS = 24;

  // Keccak round constants
  const RC = Object.freeze([
    [0x00000001, 0x00000000], [0x00008082, 0x00000000], [0x0000808a, 0x80000000], [0x80008000, 0x80000000],
    [0x0000808b, 0x00000000], [0x80000001, 0x00000000], [0x80008081, 0x80000000], [0x00008009, 0x80000000],
    [0x0000008a, 0x00000000], [0x00000088, 0x00000000], [0x80008009, 0x00000000], [0x8000000a, 0x00000000],
    [0x8000808b, 0x00000000], [0x0000008b, 0x80000000], [0x00008089, 0x80000000], [0x00008003, 0x80000000],
    [0x00008002, 0x80000000], [0x00000080, 0x80000000], [0x0000800a, 0x00000000], [0x8000000a, 0x80000000],
    [0x80008081, 0x80000000], [0x00008080, 0x80000000], [0x80000001, 0x00000000], [0x80008008, 0x80000000]
  ]);

  const RHO_OFFSETS = Object.freeze([
    0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41,
    45, 15, 21, 8, 18, 2, 61, 56, 14
  ]);

  function xor64(a, b) { return [a[0] ^ b[0], a[1] ^ b[1]]; }

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
          const andResult = [notNext[0] & row[(x + 2) % 5][0], notNext[1] & row[(x + 2) % 5][1]];
          state[x + 5 * y] = xor64(row[x], andResult);
        }
      }

      // Iota
      state[0] = xor64(state[0], RC[round]);
    }
  }

  class KeccakAlgorithm extends HashFunctionAlgorithm {
    constructor(variant = '256') {
      super();
      const config = this._getVariantConfig(variant);

      this.name = `Keccak-${variant}`;
      this.description = config.description;
      this.inventor = "Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche";
      this.year = 2012;
      this.category = CategoryType.HASH;
      this.subCategory = "Keccak Family";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      this.variant = variant;
      this.outputSize = config.outputSize;
      this.rate = config.rate;
      this.capacity = config.capacity;

      this.SupportedHashSizes = [new KeySize(config.outputSize, config.outputSize, 1)];
      this.BlockSize = config.rate;

      this.documentation = [
        new LinkItem("Keccak Team", "https://keccak.team/"),
        new LinkItem("Original Keccak", "http://keccak.noekeon.org/")
      ];

      this.references = [
        new LinkItem("Crypto++ Keccak", "https://github.com/weidai11/cryptopp/blob/master/keccak.cpp"),
        new LinkItem("Keccak Test Vectors", "http://keccak.noekeon.org/KeccakKAT-3.zip")
      ];

      this.tests = config.tests;
    }

    _getVariantConfig(variant) {
      const configs = {
        '224': {
          description: "Original Keccak-224 hash function (pre-SHA3). Uses 0x01 padding instead of SHA-3's 0x06. Produces 224-bit digests.",
          outputSize: 28,
          capacity: 448,
          rate: 144,
          tests: [
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
          ]
        },
        '256': {
          description: "Original Keccak-256 hash function (pre-SHA3). Uses 0x01 padding instead of SHA-3's 0x06. Widely used in blockchain applications like Ethereum.",
          outputSize: 32,
          capacity: 512,
          rate: 136,
          tests: [
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
          ]
        },
        '384': {
          description: "Original Keccak-384 hash function (pre-SHA3). Uses 0x01 padding instead of SHA-3's 0x06. Produces 384-bit digests.",
          outputSize: 48,
          capacity: 768,
          rate: 104,
          tests: [
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
          ]
        },
        '512': {
          description: "Original Keccak-512 hash function (pre-SHA3). Uses 0x01 padding instead of SHA-3's 0x06. Produces 512-bit digests.",
          outputSize: 64,
          capacity: 1024,
          rate: 72,
          tests: [
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
          ]
        }
      };

      if (!configs[variant]) {
        throw new Error(`Unsupported Keccak variant: ${variant}. Supported: 224, 256, 384, 512`);
      }

      return configs[variant];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new KeccakInstance(this);
    }
  }

  class KeccakInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.state = new Array(25);
      for (let i = 0; i < 25; i++) this.state[i] = [0, 0];
      this.buffer = new Uint8Array(algorithm.rate);
      this.bufferLength = 0;
      this.rate = algorithm.rate;
      this.outputSize = algorithm.outputSize;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      let offset = 0;

      while (offset < data.length && this.bufferLength < this.rate) {
        this.buffer[this.bufferLength++] = data[offset++];
      }

      while (this.bufferLength === this.rate) {
        this._absorb();
        this.bufferLength = 0;
        while (offset < data.length && this.bufferLength < this.rate) {
          this.buffer[this.bufferLength++] = data[offset++];
        }
      }
    }

    _absorb() {
      for (let i = 0; i < this.rate; i += 8) {
        const idx = Math.floor(i / 8);
        const low = OpCodes.Pack32LE(this.buffer[i] || 0, this.buffer[i+1] || 0, this.buffer[i+2] || 0, this.buffer[i+3] || 0);
        const high = OpCodes.Pack32LE(this.buffer[i+4] || 0, this.buffer[i+5] || 0, this.buffer[i+6] || 0, this.buffer[i+7] || 0);
        this.state[idx][0] ^= low;
        this.state[idx][1] ^= high;
      }
      keccakF(this.state);
    }

    Result() {
      // Keccak padding (0x01 instead of SHA-3's 0x06)
      this.buffer[this.bufferLength] = 0x01;
      for (let i = this.bufferLength + 1; i < this.rate - 1; i++) this.buffer[i] = 0;
      this.buffer[this.rate - 1] = 0x80;
      this._absorb();

      const output = new Uint8Array(this.outputSize);
      let outputOffset = 0;

      for (let i = 0; i < this.outputSize && i < this.rate; i += 8) {
        const idx = Math.floor(i / 8);
        const bytes1 = OpCodes.Unpack32LE(this.state[idx][0]);
        const bytes2 = OpCodes.Unpack32LE(this.state[idx][1]);

        for (let j = 0; j < 4 && outputOffset < this.outputSize; j++) output[outputOffset++] = bytes1[j];
        for (let j = 0; j < 4 && outputOffset < this.outputSize; j++) output[outputOffset++] = bytes2[j];
      }

      return Array.from(output);
    }
  }

  // Register all 4 variants
  RegisterAlgorithm(new KeccakAlgorithm('224'));
  RegisterAlgorithm(new KeccakAlgorithm('256'));
  RegisterAlgorithm(new KeccakAlgorithm('384'));
  RegisterAlgorithm(new KeccakAlgorithm('512'));

  return { KeccakAlgorithm, KeccakInstance };
}));
