/*
 * SHA-3-384 Hash Function - FIPS 202 Standard
 * Professional implementation matching Crypto++ reference
 * (c)2006-2025 Hawkynt
 *
 * Based on Keccak sponge construction with 384-bit output
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

  // SHA3-384 parameters
  const RATE = 104;          // 832 bits
  const OUTPUT = 48;         // 384 bits
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

  class SHA3384Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "SHA-3-384";
      this.description = "SHA-3-384 produces 384-bit digests using the Keccak sponge construction. Part of the NIST FIPS 202 standard.";
      this.inventor = "Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche";
      this.year = 2015;
      this.category = CategoryType.HASH;
      this.subCategory = "SHA-3 Family";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      this.SupportedHashSizes = [new KeySize(48, 48, 1)];
      this.BlockSize = 104;

      this.documentation = [
        new LinkItem("NIST FIPS 202", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf"),
        new LinkItem("Keccak Team", "https://keccak.team/")
      ];

      this.references = [
        new LinkItem("Crypto++ SHA3", "https://github.com/weidai11/cryptopp/blob/master/sha3.cpp"),
        new LinkItem("NIST Test Vectors", "https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program")
      ];

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
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new SHA3384Instance(this);
    }
  }

  class SHA3384Instance extends IHashFunctionInstance {
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
      // SHA-3 padding
      this.buffer[this.bufferLength] = 0x06;
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

  const algorithmInstance = new SHA3384Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { SHA3384Algorithm, SHA3384Instance };
}));
