/*
 * Keccak-224 Hash Function - Original Keccak submission
 * Professional implementation matching Crypto++ reference
 * (c)2006-2025 Hawkynt
 *
 * Based on Keccak sponge construction with 224-bit output
 * This is the ORIGINAL Keccak, not SHA-3 (different padding)
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

  // Keccak-224 parameters
  const RATE = 144;          // 1152 bits
  const OUTPUT = 28;         // 224 bits
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

  class Keccak224Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "Keccak-224";
      this.description = "Original Keccak-224 hash function (pre-SHA3). Uses 0x01 padding instead of SHA-3's 0x06. Produces 224-bit digests.";
      this.inventor = "Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche";
      this.year = 2012;
      this.category = CategoryType.HASH;
      this.subCategory = "Keccak Family";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      this.SupportedHashSizes = [new KeySize(28, 28, 1)];
      this.BlockSize = 144;

      this.documentation = [
        new LinkItem("Keccak Team", "https://keccak.team/"),
        new LinkItem("Original Keccak", "http://keccak.noekeon.org/")
      ];

      this.references = [
        new LinkItem("Crypto++ Keccak", "https://github.com/weidai11/cryptopp/blob/master/keccak.cpp"),
        new LinkItem("Keccak Test Vectors", "http://keccak.noekeon.org/KeccakKAT-3.zip")
      ];

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
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new Keccak224Instance(this);
    }
  }

  class Keccak224Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.state = new Array(25);
      for (let i = 0; i < 25; i++) this.state[i] = [0, 0];
      this.buffer = new Uint8Array(RATE);
      this.bufferLength = 0;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      let offset = 0;

      while (offset < data.length && this.bufferLength < RATE) {
        this.buffer[this.bufferLength++] = data[offset++];
      }

      while (this.bufferLength === RATE) {
        this._absorb();
        this.bufferLength = 0;
        while (offset < data.length && this.bufferLength < RATE) {
          this.buffer[this.bufferLength++] = data[offset++];
        }
      }
    }

    _absorb() {
      for (let i = 0; i < RATE; i += 8) {
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
      for (let i = this.bufferLength + 1; i < RATE - 1; i++) this.buffer[i] = 0;
      this.buffer[RATE - 1] = 0x80;
      this._absorb();

      const output = new Uint8Array(OUTPUT);
      let outputOffset = 0;

      for (let i = 0; i < OUTPUT && i < RATE; i += 8) {
        const idx = Math.floor(i / 8);
        const bytes1 = OpCodes.Unpack32LE(this.state[idx][0]);
        const bytes2 = OpCodes.Unpack32LE(this.state[idx][1]);

        for (let j = 0; j < 4 && outputOffset < OUTPUT; j++) output[outputOffset++] = bytes1[j];
        for (let j = 0; j < 4 && outputOffset < OUTPUT; j++) output[outputOffset++] = bytes2[j];
      }

      return Array.from(output);
    }
  }

  const algorithmInstance = new Keccak224Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { Keccak224Algorithm, Keccak224Instance };
}));
