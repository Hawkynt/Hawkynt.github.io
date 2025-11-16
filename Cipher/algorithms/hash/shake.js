/*
 * SHAKE (SHAKE128 / SHAKE256) - SHA-3 Extendable-Output Functions (XOF)
 * Professional implementation matching NIST FIPS 202 specification
 * (c)2006-2025 Hawkynt
 *
 * SHAKE128 and SHAKE256 are extendable-output functions based on Keccak
 * Part of NIST FIPS 202 standard
 * Reference: https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf
 *
 * Key differences from SHA-3/Keccak:
 * - SHAKE padding byte: 0x1F (differs from SHA-3's 0x06 and Keccak's 0x01)
 * - Variable-length output (XOF) instead of fixed digest size
 * - SHAKE128: 256-bit capacity (128-bit security), 1344-bit rate
 * - SHAKE256: 512-bit capacity (256-bit security), 1088-bit rate
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

  // ===== ALGORITHM IMPLEMENTATION =====

  const KECCAK_ROUNDS = 24;         // Number of Keccak-f[1600] rounds
  const SHAKE_PADDING = 0x1F;       // SHAKE-specific padding byte

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

    if (positions === 32) {
      return [high, low];
    } else if (positions < 32) {
      const newLow = ((low << positions) | (high >>> (32 - positions))) >>> 0;
      const newHigh = ((high << positions) | (low >>> (32 - positions))) >>> 0;
      return [newLow, newHigh];
    } else {
      positions -= 32;
      const newLow = ((high << positions) | (low >>> (32 - positions))) >>> 0;
      const newHigh = ((low << positions) | (high >>> (32 - positions))) >>> 0;
      return [newLow, newHigh];
    }
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

  /**
   * SHAKE algorithm class supporting both SHAKE128 and SHAKE256
   */
  class SHAKEAlgorithm extends HashFunctionAlgorithm {
    constructor(variant = '128') {
      super();

      const config = this._getVariantConfig(variant);

      // Store variant-specific parameters
      this.variant = variant;
      this.rate = config.rate;
      this.capacity = config.capacity;
      this.securityLevel = config.securityLevel;

      // Required metadata
      this.name = `SHAKE${variant}`;
      this.description = config.description;
      this.inventor = "Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche";
      this.year = 2015;
      this.category = CategoryType.HASH;
      this.subCategory = "SHA-3 XOF";
      this.country = CountryCode.BE;
      this.securityStatus = config.securityStatus;
      this.complexity = ComplexityType.INTERMEDIATE;

      this.SupportedHashSizes = [new KeySize(1, 1024, 1)]; // Variable output
      this.BlockSize = this.rate;

      this.documentation = [
        new LinkItem("NIST FIPS 202", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf"),
        new LinkItem("Keccak Team", "https://keccak.team/")
      ];

      this.references = [
        new LinkItem("Crypto++ SHAKE", "https://github.com/weidai11/cryptopp/blob/master/sha3.cpp"),
        new LinkItem("NIST Test Vectors", "https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program")
      ];

      this.tests = config.tests;
    }

    _getVariantConfig(variant) {
      const configs = {
        '128': {
          description: "SHAKE128 is an extendable-output function (XOF) from NIST FIPS 202 with 128-bit security. Based on Keccak sponge construction with variable-length output capability.",
          capacity: 256,    // 2 × 128 (security level) in bits
          rate: 168,        // (1600 - 256) / 8 = 168 bytes (1344 bits)
          securityLevel: 128,
          securityStatus: SecurityStatus.ACTIVE,
          tests: [
            {
              text: "SHAKE128 Empty String - 16 bytes output",
              uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf",
              input: [],
              outputSize: 16,
              expected: OpCodes.Hex8ToBytes("7f9c2ba4e88f827d616045507605853e")
            },
            {
              text: "SHAKE128 'abc' - 16 bytes output",
              uri: "https://asecuritysite.com/hash/shake",
              input: OpCodes.AnsiToBytes("abc"),
              outputSize: 16,
              expected: OpCodes.Hex8ToBytes("5881092dd818bf5cf8a3ddb793fbcba7")
            },
            {
              text: "SHAKE128 'abc' - 32 bytes output",
              uri: "https://asecuritysite.com/hash/shake",
              input: OpCodes.AnsiToBytes("abc"),
              outputSize: 32,
              expected: OpCodes.Hex8ToBytes("5881092dd818bf5cf8a3ddb793fbcba74097d5c526a6d35f97b83351940f2cc8")
            }
          ]
        },
        '256': {
          description: "SHAKE256 is an extendable-output function (XOF) from NIST FIPS 202 with 256-bit security. Can produce variable-length output, making it suitable for applications requiring arbitrary hash lengths.",
          capacity: 512,    // 2 × 256 (security level) in bits
          rate: 136,        // (1600 - 512) / 8 = 136 bytes (1088 bits)
          securityLevel: 256,
          securityStatus: null,  // Safe default per CLAUDE.md guidelines
          tests: [
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
          ]
        }
      };

      if (!configs[variant]) {
        throw new Error(`Unsupported SHAKE variant: SHAKE${variant}`);
      }

      return configs[variant];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new SHAKEInstance(this);
    }
  }

  /**
   * SHAKE instance class implementing Feed/Result pattern
   */
  class SHAKEInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);

      this.rate = algorithm.rate;
      this.state = new Array(25);
      for (let i = 0; i < 25; i++) {
        this.state[i] = [0, 0];
      }
      this.buffer = new Uint8Array(this.rate);
      this.bufferLength = 0;
      this._outputSize = null;  // Must be set before Result()
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

    /**
     * Feed input data to the XOF (absorb phase)
     * @param {Array} data - Input data as byte array
     */
    Feed(data) {
      if (!data || data.length === 0) return;

      let offset = 0;

      // Fill buffer first
      while (offset < data.length && this.bufferLength < this.rate) {
        this.buffer[this.bufferLength++] = data[offset++];
      }

      // Process complete blocks
      while (this.bufferLength === this.rate) {
        this._absorb();
        this.bufferLength = 0;

        // Fill buffer with more data
        while (offset < data.length && this.bufferLength < this.rate) {
          this.buffer[this.bufferLength++] = data[offset++];
        }
      }
    }

    /**
     * Absorb one complete block into state
     * @private
     */
    _absorb() {
      // XOR buffer into state (little-endian, 8 bytes per state element)
      for (let i = 0; i < this.rate; i += 8) {
        const idx = Math.floor(i / 8);

        // Pack 8 bytes into two 32-bit words (little-endian)
        const low = OpCodes.Pack32LE(
          this.buffer[i] || 0,
          this.buffer[i + 1] || 0,
          this.buffer[i + 2] || 0,
          this.buffer[i + 3] || 0
        );
        const high = OpCodes.Pack32LE(
          this.buffer[i + 4] || 0,
          this.buffer[i + 5] || 0,
          this.buffer[i + 6] || 0,
          this.buffer[i + 7] || 0
        );

        // XOR into state
        this.state[idx][0] ^= low;
        this.state[idx][1] ^= high;
      }

      keccakF(this.state);
    }

    /**
     * Finalize and squeeze output (Result phase)
     * @returns {Array} Output bytes
     */
    Result() {
      if (!this._outputSize) {
        throw new Error("SHAKE requires outputSize to be set before Result()");
      }

      // SHAKE padding: 0x1F (differs from SHA-3's 0x06 and Keccak's 0x01)
      this.buffer[this.bufferLength] = SHAKE_PADDING;

      // Fill rest with zeros except last byte
      for (let i = this.bufferLength + 1; i < this.rate - 1; i++) {
        this.buffer[i] = 0;
      }

      // Set last bit of last byte
      this.buffer[this.rate - 1] = 0x80;

      // Absorb final block
      this._absorb();

      // Squeeze phase: extract _outputSize bytes
      const output = new Uint8Array(this._outputSize);
      let outputOffset = 0;

      while (outputOffset < this._outputSize) {
        // Extract bytes from current state
        for (let i = 0; i < this.rate && outputOffset < this._outputSize; i += 8) {
          const idx = Math.floor(i / 8);
          const bytes1 = OpCodes.Unpack32LE(this.state[idx][0]);
          const bytes2 = OpCodes.Unpack32LE(this.state[idx][1]);

          for (let j = 0; j < 4 && outputOffset < this._outputSize; j++) {
            output[outputOffset++] = bytes1[j];
          }
          for (let j = 0; j < 4 && outputOffset < this._outputSize; j++) {
            output[outputOffset++] = bytes2[j];
          }
        }

        // If more output needed, permute again (squeeze)
        if (outputOffset < this._outputSize) {
          keccakF(this.state);
        }
      }

      return Array.from(output);
    }
  }

  // ===== REGISTRATION =====

  // Register both SHAKE128 and SHAKE256
  const shake128 = new SHAKEAlgorithm('128');
  if (!AlgorithmFramework.Find(shake128.name)) {
    RegisterAlgorithm(shake128);
  }

  const shake256 = new SHAKEAlgorithm('256');
  if (!AlgorithmFramework.Find(shake256.name)) {
    RegisterAlgorithm(shake256);
  }

  // ===== EXPORTS =====

  return { SHAKEAlgorithm, SHAKEInstance };
}));
