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
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem, KeySize,
          BlockAbsorber, SpongePadBlocks } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  /** @type {int32} Number of Keccak-f[1600] rounds */
  const KECCAK_ROUNDS = 24;
  /** @type {uint8} SHAKE-specific padding byte */
  const SHAKE_PADDING = 0x1F;

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
   * SHAKE algorithm class supporting both SHAKE128 and SHAKE256
   * @class
   * @extends {HashFunctionAlgorithm}
   */
  class SHAKEAlgorithm extends HashFunctionAlgorithm {
    /**
     * @param {string} [variant='128'] - '128' or '256'
     * @throws {Error} For any other variant
     */
    constructor(variant = '128') {
      super();

      // Store variant-specific parameters
      /** @type {string} */
      this.variant = variant;
      /** @type {int32} Sponge rate in bytes */
      this.rate = 0;
      /** @type {int32} Capacity in bits */
      this.capacity = 0;
      /** @type {int32} Security level in bits */
      this.securityLevel = 0;

      if (variant === '128') {
        this.description = "SHAKE128 is an extendable-output function (XOF) from NIST FIPS 202 with 128-bit security. Based on Keccak sponge construction with variable-length output capability.";
        this.capacity = 256;  // 2 × 128 (security level) in bits
        this.rate = 168;  // (1600 - 256) / 8 = 168 bytes (1344 bits)
        this.securityLevel = 128;
        this.securityStatus = SecurityStatus.ACTIVE;
        this.tests = [
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
        ];
      } else if (variant === '256') {
        this.description = "SHAKE256 is an extendable-output function (XOF) from NIST FIPS 202 with 256-bit security. Can produce variable-length output, making it suitable for applications requiring arbitrary hash lengths.";
        this.capacity = 512;  // 2 × 256 (security level) in bits
        this.rate = 136;  // (1600 - 512) / 8 = 136 bytes (1088 bits)
        this.securityLevel = 256;
        this.securityStatus = null;  // Safe default per the project guidelines guidelines
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
      } else {
        throw new Error('Unsupported SHAKE variant: SHAKE' + variant);
      }

      // Required metadata
      this.name = 'SHAKE' + variant;
      this.inventor = "Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche";
      this.year = 2015;
      this.category = CategoryType.HASH;
      this.subCategory = "SHA-3 XOF";
      this.country = CountryCode.BE;
      this.complexity = ComplexityType.INTERMEDIATE;

      this.SupportedOutputSizes = [new KeySize(1, 1024, 1)]; // Variable output
      /** @type {int32} */
      this.BlockSize = this.rate;

      this.documentation = [
        new LinkItem("NIST FIPS 202", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf"),
        new LinkItem("Keccak Team", "https://keccak.team/")
      ];

      this.references = [
        new LinkItem("Crypto++ SHAKE", "https://github.com/weidai11/cryptopp/blob/master/sha3.cpp"),
        new LinkItem("NIST Test Vectors", "https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program")
      ];
    }

    /**
     * Create new XOF instance
     * @param {boolean} [isInverse=false] - A hash has no inverse: true yields null
     * @returns {SHAKEInstance} New XOF instance
     */
    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new SHAKEInstance(this);
    }
  }

  /**
   * SHAKE instance class implementing Feed/Result pattern
   * @class
   * @extends {IHashFunctionInstance}
   */
  class SHAKEInstance extends IHashFunctionInstance {
    /**
     * Initialize a SHAKE instance
     * @param {SHAKEAlgorithm} algorithm - Parent algorithm instance
     */
    constructor(algorithm) {
      super(algorithm);

      /** @type {int32} Sponge rate in bytes */
      this.rate = algorithm.rate;
      /** @type {uint32[][]} 25 lanes as [low32, high32] */
      this.state = new Array(25);
      for (let i = 0; i < 25; i++) {
        /** @type {uint32[]} */
        const lane = [0, 0];
        this.state[i] = lane;
      }
      /** @type {BlockAbsorber} */
      this._absorber = new BlockAbsorber(this.rate, block => this._absorb(block));
      /** @type {int32} Requested output length in bytes; 0 until set, which Result() rejects */
      this._outputSize = 0;
    }

    /**
     * Set the output length
     * @param {int32} size - Output length in bytes, 1..1024
     */
    set outputSize(size) {
      if (size < 1 || size > 1024) {
        throw new Error('Invalid output size: ' + size + ' bytes');
      }
      this._outputSize = size;
    }

    /**
     * The output length
     * @returns {int32} Output length in bytes (0 while unset)
     */
    get outputSize() {
      return this._outputSize;
    }

    /**
     * Feed input data to the XOF (absorb phase)
     * @param {uint8[]} data - Input data as byte array
     */
    Feed(data) {
      this._absorber.Absorb(data);
    }

    /**
     * Absorb one complete block into state
     * @param {uint8[]} block - exactly rate bytes
     * @returns {void}
     * @private
     */
    _absorb(block) {
      // XOR block into state (little-endian, 8 bytes per state element)
      for (let i = 0; i < this.rate; i += 8) {
        const idx = i / 8;

        // Pack 8 bytes into two 32-bit words (little-endian)
        const low = OpCodes.Pack32LE(block[i], block[i + 1], block[i + 2], block[i + 3]);
        const high = OpCodes.Pack32LE(block[i + 4], block[i + 5], block[i + 6], block[i + 7]);

        // XOR into state
        this.state[idx][0] = OpCodes.Xor32(this.state[idx][0], low);
        this.state[idx][1] = OpCodes.Xor32(this.state[idx][1], high);
      }

      keccakF(this.state);
    }

    /**
     * Finalize and squeeze output (Result phase)
     * @returns {uint8[]} Output bytes
     */
    Result() {
      if (this._outputSize === 0) {
        throw new Error("SHAKE requires outputSize to be set before Result()");
      }

      // SHAKE padding: 0x1F (differs from SHA-3's 0x06 and Keccak's 0x01).
      //
      // The separator and pad10*1's terminating bit land on the same byte when
      // exactly one byte of the block is free, and writing the terminating bit
      // over the separator rather than into it dropped the separator entirely.
      // Every message of length rate-1 (mod rate) hashed to the wrong value:
      // 167, 335 ... for SHAKE128 and 135, 271 ... for SHAKE256, all of which
      // now agree with the reference. SpongePadBlocks merges them.
      const rate = this.rate;
      /** @type {uint8[][]} */
      const padded = this._absorber.Finish((held, pending) => SpongePadBlocks(held, pending, rate, SHAKE_PADDING));
      for (const block of padded)
        this._absorb(block);

      // Squeeze phase: extract _outputSize bytes
      /** @type {uint8[]} */
      const output = [];

      while (output.length < this._outputSize) {
        // Extract bytes from current state
        for (let i = 0; i < this.rate && output.length < this._outputSize; i += 8) {
          const idx = i / 8;
          const bytes1 = OpCodes.Unpack32LE(this.state[idx][0]);
          const bytes2 = OpCodes.Unpack32LE(this.state[idx][1]);

          for (let j = 0; j < 4 && output.length < this._outputSize; j++) {
            output.push(bytes1[j]);
          }
          for (let j = 0; j < 4 && output.length < this._outputSize; j++) {
            output.push(bytes2[j]);
          }
        }

        // If more output needed, permute again (squeeze)
        if (output.length < this._outputSize) {
          keccakF(this.state);
        }
      }

      return output;
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
