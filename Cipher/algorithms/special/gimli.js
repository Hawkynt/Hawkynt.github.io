/*
 * Gimli Cryptographic Permutation Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of Gimli 384-bit permutation
 * Designed for high security and performance across platforms
 * Can be used to construct hash functions or stream ciphers
 */

// Load AlgorithmFramework (REQUIRED)

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
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

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }
  
  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class GimliAlgorithm extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Gimli";
      this.description = "Cross-platform 384-bit cryptographic permutation designed for high security and performance. Can construct hash functions or stream ciphers using sponge construction. Features 24 rounds with simple operations.";
      this.inventor = "Daniel J. Bernstein, Stefan Kölbl, Stefan Lucks, Pedro Maat Costa Massolino, Florian Mendel, Kashif Nawaz, Tobias Schneider, Peter Schwabe, François-Xavier Standaert, Yosuke Todo, Benoît Viguier";
      this.year = 2017;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Cryptographic Permutation";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.NL;

      // Algorithm-specific metadata
      this.SupportedInputSizes = [
        new KeySize(48, 48, 0)  // 384-bit input only
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Gimli Official Site", "https://gimli.cr.yp.to/"),
        new LinkItem("NIST LWC Specification", "https://csrc.nist.gov/CSRC/media/Projects/Lightweight-Cryptography/documents/round-2/spec-doc-rnd2/gimli-spec-round2.pdf"),
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Gimli_(cipher)")
      ];

      this.references = [
        new LinkItem("Original Research Paper", "https://eprint.iacr.org/2017/630"),
        new LinkItem("Java Implementation", "https://github.com/codahale/gimli"),
        new LinkItem("Cryptographic Constructions", "https://github.com/jedisct1/gimli-constructions")
      ];

      // Test vectors from official C reference implementation
      // Source: https://gimli.cr.yp.to/impl.html (lightweight-crypto repository)
      this.tests = [
        {
          text: "Gimli permutation test vector from C reference",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/unit/test-gimli24.c",
          input: [
            0x00, 0x00, 0x00, 0x00, 0xba, 0x79, 0x37, 0x9e,
            0x7a, 0xf3, 0x6e, 0x3c, 0x46, 0x6d, 0xa6, 0xda,
            0x24, 0xe7, 0xdd, 0x78, 0x1a, 0x61, 0x15, 0x17,
            0x2e, 0xdb, 0x4c, 0xb5, 0x66, 0x55, 0x84, 0x53,
            0xc8, 0xcf, 0xbb, 0xf1, 0x5a, 0x4a, 0xf3, 0x8f,
            0x22, 0xc5, 0x2a, 0x2e, 0x26, 0x40, 0x62, 0xcc
          ],
          expected: [
            0x5a, 0xc8, 0x11, 0xba, 0x19, 0xd1, 0xba, 0x91,
            0x80, 0xe8, 0x0c, 0x38, 0x68, 0x2c, 0x4c, 0xd2,
            0xea, 0xff, 0xce, 0x3e, 0x1c, 0x92, 0x7a, 0x27,
            0xbd, 0xa0, 0x73, 0x4f, 0xd8, 0x9c, 0x5a, 0xda,
            0xf0, 0x73, 0xb6, 0x84, 0xf7, 0x2f, 0xe5, 0x34,
            0x49, 0xef, 0x2b, 0x9e, 0xd6, 0xb8, 0x1b, 0xf4
          ]
        },
        {
          text: "Gimli all-zeros input test vector",
          uri: "https://gimli.cr.yp.to/",
          input: new Array(48).fill(0),
          expected: [
            196, 216, 103, 100, 59, 248, 220, 7, 212, 176, 11, 59,
            76, 54, 33, 27, 220, 49, 52, 8, 142, 190, 251, 14,
            132, 232, 84, 0, 85, 217, 139, 100, 46, 180, 93, 74,
            203, 65, 6, 202, 194, 210, 115, 134, 9, 216, 48, 46
          ]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {GimliAlgorithmInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new GimliAlgorithmInstance(this, isInverse);
    }
  }

  /**
 * GimliAlgorithm cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class GimliAlgorithmInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {GimliAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];

      // Gimli constants
      /** @type {int32} */
      this.ROUNDS = 24;
      /** @type {int32} */
      this.STATE_SIZE = 48; // 384 bits = 48 bytes
    }


    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Validate input length for Gimli permutation
      if (this.inputBuffer.length !== this.STATE_SIZE) {
        throw new Error("Gimli requires exactly " + this.STATE_SIZE + " bytes (384 bits) input");
      }

      // Gimli is a permutation, so the inverse direction is the inverse permutation
      // rather than a second application of the forward one.
      /** @type {uint8[]} */
      const output = this.isInverse
        ? this._gimliInversePermutation(this.inputBuffer.slice())
        : this._gimliPermutation(this.inputBuffer.slice());

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    /**
     * Convert bytes to 32-bit words (little-endian)
     * @param {uint8[]} bytes - 48 bytes
     * @returns {uint32[]} 12 words
     */
    _toWords(bytes) {
      /** @type {uint32[]} */
      const w = new Array(12);
      for (let i = 0; i < 12; i++) {
        w[i] = OpCodes.Pack32LE(
          bytes[i * 4],
          bytes[i * 4 + 1],
          bytes[i * 4 + 2],
          bytes[i * 4 + 3]
        );
      }
      return w;
    }

    /**
     * Convert 32-bit words back to bytes (little-endian)
     * @param {uint32[]} w - 12 words
     * @returns {uint8[]} 48 bytes
     */
    _toBytes(w) {
      /** @type {uint8[]} */
      const result = [];
      for (let i = 0; i < 12; i++) {
        /** @type {uint8[]} */
        const bytes = OpCodes.Unpack32LE(w[i]);
        for (let _i = 0; _i < bytes.length; _i++) result.push(bytes[_i]);
      }
      return result;
    }

    /**
     * Apply the SP-box to all four columns
     * @param {uint32[]} w - State words
     * @returns {void}
     */
    _spColumns(w) {
      this._gimliSPBox(w, 0, 4, 8);
      this._gimliSPBox(w, 1, 5, 9);
      this._gimliSPBox(w, 2, 6, 10);
      this._gimliSPBox(w, 3, 7, 11);
    }

    /**
     * Apply the inverse SP-box to all four columns
     * @param {uint32[]} w - State words
     * @returns {void}
     */
    _inverseSpColumns(w) {
      this._gimliInverseSPBox(w, 0, 4, 8);
      this._gimliInverseSPBox(w, 1, 5, 9);
      this._gimliInverseSPBox(w, 2, 6, 10);
      this._gimliInverseSPBox(w, 3, 7, 11);
    }

    /**
     * Forward Gimli permutation
     * @param {uint8[]} bytes - 48-byte state
     * @returns {uint8[]} Permuted state
     */
    _gimliPermutation(bytes) {
      // State is organized as flat array: s0, s1, s2, s3 (column 0), s4, s5, s6, s7 (column 1), s8, s9, s10, s11 (column 2)
      /** @type {uint32[]} */
      const w = this._toWords(bytes);

      // Apply 24 rounds in groups of 4
      for (let round = 24; round > 0; round -= 4) {
        // Round 0: SP-box, small swap, add round constant
        this._spColumns(w);

        // Small swap - exactly as in C reference
        /** @type {uint32} */
        let x = w[0];
        /** @type {uint32} */
        let y = w[2];
        w[0] = OpCodes.Xor32(OpCodes.Xor32(w[1], 0x9e377900), round);
        w[1] = x;
        w[2] = w[3];
        w[3] = y;

        // Round 1: SP-box only
        this._spColumns(w);

        // Round 2: SP-box, big swap
        this._spColumns(w);

        // Big swap - exactly as in C reference
        x = w[0];
        y = w[1];
        w[0] = w[2];
        w[1] = w[3];
        w[2] = x;
        w[3] = y;

        // Round 3: SP-box only
        this._spColumns(w);
      }

      return this._toBytes(w);
    }

    /**
     * Inverse Gimli permutation
     * @param {uint8[]} bytes - 48-byte state
     * @returns {uint8[]} Unpermuted state
     */
    _gimliInversePermutation(bytes) {
      // Same word layout as the forward direction.
      /** @type {uint32[]} */
      const w = this._toWords(bytes);

      // The forward loop runs round = 24, 20, ..., 4 and each iteration performs
      //   SP, small-swap(round), SP, SP, big-swap, SP
      // so the inverse runs round = 4, 8, ..., 24 and performs the exact reverse:
      //   SP^-1, big-swap, SP^-1, SP^-1, small-swap^-1(round), SP^-1
      for (let round = 4; round <= 24; round += 4) {
        // Undo round 3 (SP-box only)
        this._inverseSpColumns(w);

        // Undo the big swap. It exchanges (s0,s1) with (s2,s3), so it is its own
        // inverse.
        /** @type {uint32} */
        let x = w[0];
        /** @type {uint32} */
        let y = w[1];
        w[0] = w[2];
        w[1] = w[3];
        w[2] = x;
        w[3] = y;

        // Undo round 2 (SP-box only)
        this._inverseSpColumns(w);

        // Undo round 1 (SP-box only)
        this._inverseSpColumns(w);

        // Undo the small swap. Forward it computes
        //   s0' = s1 ^ 0x9e377900 ^ round, s1' = s0, s2' = s3, s3' = s2
        // so the pre-swap words are recovered as below.
        x = w[0];
        y = w[2];
        w[0] = w[1];
        w[1] = OpCodes.Xor32(OpCodes.Xor32(x, 0x9e377900), round);
        w[2] = w[3];
        w[3] = y;

        // Undo round 0 (SP-box)
        this._inverseSpColumns(w);
      }

      return this._toBytes(w);
    }

    /**
     * Gimli SP-box for a column
     * Reference: https://gimli.cr.yp.to/ Section 2.2
     * @param {uint32[]} w - State words
     * @param {int32} i0 - Index of the first word of the column
     * @param {int32} i1 - Index of the second word
     * @param {int32} i2 - Index of the third word
     * @returns {void}
     */
    _gimliSPBox(w, i0, i1, i2) {
      /** @type {uint32} */
      const x = OpCodes.RotL32(w[i0], 24);
      /** @type {uint32} */
      const y = OpCodes.RotL32(w[i1], 9);
      /** @type {uint32} */
      const z = w[i2];

      // Apply SP-box transformations with proper 32-bit masking
      w[i1] = OpCodes.Xor32(OpCodes.Xor32(y, x), OpCodes.Shl32(OpCodes.Or32(x, z), 1));
      w[i0] = OpCodes.Xor32(OpCodes.Xor32(z, y), OpCodes.Shl32(OpCodes.And32(x, y), 3));
      w[i2] = OpCodes.Xor32(OpCodes.Xor32(x, OpCodes.Shl32(z, 1)), OpCodes.Shl32(OpCodes.And32(y, z), 2));
    }

    /**
     * Bit of a word
     * @param {uint32} value - Word
     * @param {int32} index - Bit index
     * @returns {uint32} 0 or 1
     */
    _bitOf(value, index) {
      return OpCodes.And32(OpCodes.Shr32(value, index), 1);
    }

    /**
     * A lower-indexed bit, reading out-of-range indices as zero
     * @param {uint32[]} bits - Bits recovered so far
     * @param {int32} index - Bit index, possibly negative
     * @returns {uint32} 0 or 1
     */
    _lower(bits, index) {
      return index < 0 ? 0 : bits[index];
    }

    /**
     * Assemble 32 bits into a word
     * @param {uint32[]} bits - Bits, least significant first
     * @returns {uint32} Word
     */
    _assemble(bits) {
      /** @type {uint32} */
      let value = 0;
      for (let i = 0; i < 32; i++) value = OpCodes.Or32(value, OpCodes.Shl32(bits[i], i));
      return value;
    }

    // Inverse of the Gimli SP-box.
    // Reference: Gimli specification (https://gimli.cr.yp.to/, NIST LWC round 2
    // spec-doc, Section 2.2), which defines the forward SP-box on a column as
    //   x = s0 <<< 24,  y = s1 <<< 9,  z = s2        (all three read before any write)
    //   s1' = y ^ x ^ ((x | z) << 1)
    //   s0' = z ^ y ^ ((x & y) << 3)
    //   s2' = x ^ (z << 1) ^ ((y & z) << 2)
    // Every shift is a plain left shift, so bit i of each output depends only on
    // bit i and on strictly lower-indexed bits of the inputs. The system is
    // therefore triangular and inverts bit by bit from the least significant end,
    // with out-of-range bit indices reading as zero:
    //   x_i = s2'_i ^ z_(i-1) ^ (y_(i-2) & z_(i-2))
    //   y_i = s1'_i ^ x_i ^ (x_(i-1) | z_(i-1))
    //   z_i = s0'_i ^ y_i ^ (x_(i-3) & y_(i-3))
    // Recovering x, y, z then undoes the two input rotations.
    /**
     * @param {uint32[]} w - State words
     * @param {int32} i0 - Index of the first word of the column
     * @param {int32} i1 - Index of the second word
     * @param {int32} i2 - Index of the third word
     * @returns {void}
     */
    _gimliInverseSPBox(w, i0, i1, i2) {
      /** @type {uint32} */
      const a = w[i0];
      /** @type {uint32} */
      const b = w[i1];
      /** @type {uint32} */
      const c = w[i2];

      /** @type {uint32[]} */
      const xBits = new Array(32);
      /** @type {uint32[]} */
      const yBits = new Array(32);
      /** @type {uint32[]} */
      const zBits = new Array(32);

      for (let i = 0; i < 32; i++) {
        xBits[i] = OpCodes.Xor32(
          OpCodes.Xor32(this._bitOf(c, i), this._lower(zBits, i - 1)),
          OpCodes.And32(this._lower(yBits, i - 2), this._lower(zBits, i - 2)));
        yBits[i] = OpCodes.Xor32(
          OpCodes.Xor32(this._bitOf(b, i), xBits[i]),
          OpCodes.Or32(this._lower(xBits, i - 1), this._lower(zBits, i - 1)));
        zBits[i] = OpCodes.Xor32(
          OpCodes.Xor32(this._bitOf(a, i), yBits[i]),
          OpCodes.And32(this._lower(xBits, i - 3), this._lower(yBits, i - 3)));
      }

      w[i0] = OpCodes.RotR32(this._assemble(xBits), 24);
      w[i1] = OpCodes.RotR32(this._assemble(yBits), 9);
      w[i2] = this._assemble(zBits);
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new GimliAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { GimliAlgorithm, GimliAlgorithmInstance };
}));