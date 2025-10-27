/*
 * SHAKE256 - SHA-3 Extendable-Output Function (XOF)
 * Professional implementation matching Crypto++ reference
 * (c)2006-2025 Hawkynt
 *
 * SHAKE256 is an extendable-output function based on Keccak
 * Part of NIST FIPS 202 standard
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

  // SHAKE256 parameters
  const RATE = 136;          // 1088 bits (same as Keccak-256)
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

  class SHAKE256Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "SHAKE256";
      this.description = "SHAKE256 is an extendable-output function (XOF) from NIST FIPS 202. Can produce variable-length output, making it suitable for applications requiring arbitrary hash lengths.";
      this.inventor = "Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche";
      this.year = 2015;
      this.category = CategoryType.HASH;
      this.subCategory = "SHA-3 XOF";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      this.SupportedHashSizes = [new KeySize(1, 1024, 1)]; // Variable output
      this.BlockSize = 136;

      this.documentation = [
        new LinkItem("NIST FIPS 202", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf"),
        new LinkItem("Keccak Team", "https://keccak.team/")
      ];

      this.references = [
        new LinkItem("Crypto++ SHAKE", "https://github.com/weidai11/cryptopp/blob/master/sha3.cpp"),
        new LinkItem("NIST Test Vectors", "https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program")
      ];

      this.tests = [
        {
          text: "SHAKE256: Empty, 64 bytes (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/shake.txt",
          input: [],
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes("46B9DD2B0BA88D13233B3FEB743EEB243FCD52EA62B81B82B50C27646ED5762FD75DC4DDD8C0F200CB05019D67B592F6FC821C49479AB48640292EACB3B7C4BE")
        },
        {
          text: "SHAKE256: Single byte, 64 bytes (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/shake.txt",
          input: OpCodes.Hex8ToBytes("AF"),
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes("B7CBFEDA173533A5FB72340C9AF14B82545BC9FA02828DA3B6773094289FB8FE75CFF7D0BDFB6015F3068907A1BA24611631D1DBE4EADF8D95A9F6B6021231B7")
        },
        {
          text: "SHAKE256: Two bytes, 64 bytes (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/shake.txt",
          input: OpCodes.Hex8ToBytes("4FD6"),
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes("426D6FCDFB2387A470C4B55B999315C69C9CBBCAC337B98D5F5CB38ACCFE99E2B195432BB464B2E857FF20DB2A10563BF93FB518E6F246397C1C86CE19A7C1C1")
        },
        {
          text: "SHAKE256: Four bytes, 64 bytes (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/shake.txt",
          input: OpCodes.Hex8ToBytes("FAE3E468"),
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes("5B3F24082085A8E223CDFDC2D644F559BEFEF6EF22288D87717CC7AF1A9FCB18DFDE7AD7E38838015894F7ACC98E420DB10DED4E85837B1B19CFE0007DC3FC4A")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new SHAKE256Instance(this);
    }
  }

  class SHAKE256Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.state = new Array(25);
      for (let i = 0; i < 25; i++) this.state[i] = [0, 0];
      this.buffer = new Uint8Array(RATE);
      this.bufferLength = 0;
      this._outputSize = 64; // Default 64 bytes
    }

    set outputSize(size) {
      if (size < 1 || size > 1024) {
        throw new Error(`Invalid output size: ${size} bytes`);
      }
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize;
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
      // SHAKE padding (0x1F instead of SHA-3's 0x06 or Keccak's 0x01)
      this.buffer[this.bufferLength] = 0x1F;
      for (let i = this.bufferLength + 1; i < RATE - 1; i++) this.buffer[i] = 0;
      this.buffer[RATE - 1] = 0x80;
      this._absorb();

      // Squeeze out the requested output length
      const output = new Uint8Array(this._outputSize);
      let outputOffset = 0;

      while (outputOffset < this._outputSize) {
        // Extract bytes from current state
        for (let i = 0; i < RATE && outputOffset < this._outputSize; i += 8) {
          const idx = Math.floor(i / 8);
          const bytes1 = OpCodes.Unpack32LE(this.state[idx][0]);
          const bytes2 = OpCodes.Unpack32LE(this.state[idx][1]);

          for (let j = 0; j < 4 && outputOffset < this._outputSize; j++) output[outputOffset++] = bytes1[j];
          for (let j = 0; j < 4 && outputOffset < this._outputSize; j++) output[outputOffset++] = bytes2[j];
        }

        // If more output needed, permute again (squeeze)
        if (outputOffset < this._outputSize) {
          keccakF(this.state);
        }
      }

      return Array.from(output);
    }
  }

  const algorithmInstance = new SHAKE256Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { SHAKE256Algorithm, SHAKE256Instance };
}));
