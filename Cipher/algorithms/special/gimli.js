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

    CreateInstance(isInverse = false) {
      return new GimliAlgorithmInstance(this, isInverse);
    }
  }

  class GimliAlgorithmInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];

      // Gimli constants
      this.ROUNDS = 24;
      this.STATE_SIZE = 48; // 384 bits = 48 bytes
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    Result() {
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Validate input length for Gimli permutation
      if (this.inputBuffer.length !== this.STATE_SIZE) {
        throw new Error(`Gimli requires exactly ${this.STATE_SIZE} bytes (384 bits) input`);
      }

      // Apply Gimli permutation
      const output = this._gimliPermutation([...this.inputBuffer]);

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    _gimliPermutation(state) {
      // Convert bytes to 32-bit words (little-endian)
      // State is organized as flat array: s0, s1, s2, s3 (column 0), s4, s5, s6, s7 (column 1), s8, s9, s10, s11 (column 2)
      const s = new Array(12);
      for (let i = 0; i < 12; i++) {
        s[i] = OpCodes.Pack32LE(
          state[i * 4],
          state[i * 4 + 1],
          state[i * 4 + 2],
          state[i * 4 + 3]
        );
      }

      // Apply 24 rounds in groups of 4
      for (let round = 24; round > 0; round -= 4) {
        // Round 0: SP-box, small swap, add round constant
        this._gimliSPBox(s, 0, 4, 8);
        this._gimliSPBox(s, 1, 5, 9);
        this._gimliSPBox(s, 2, 6, 10);
        this._gimliSPBox(s, 3, 7, 11);

        // Small swap - exactly as in C reference
        let x = s[0];
        let y = s[2];
        s[0] = (s[1] ^ 0x9e377900 ^ round) >>> 0;
        s[1] = x;
        s[2] = s[3];
        s[3] = y;

        // Round 1: SP-box only
        this._gimliSPBox(s, 0, 4, 8);
        this._gimliSPBox(s, 1, 5, 9);
        this._gimliSPBox(s, 2, 6, 10);
        this._gimliSPBox(s, 3, 7, 11);

        // Round 2: SP-box, big swap
        this._gimliSPBox(s, 0, 4, 8);
        this._gimliSPBox(s, 1, 5, 9);
        this._gimliSPBox(s, 2, 6, 10);
        this._gimliSPBox(s, 3, 7, 11);

        // Big swap - exactly as in C reference
        x = s[0];
        y = s[1];
        s[0] = s[2];
        s[1] = s[3];
        s[2] = x;
        s[3] = y;

        // Round 3: SP-box only
        this._gimliSPBox(s, 0, 4, 8);
        this._gimliSPBox(s, 1, 5, 9);
        this._gimliSPBox(s, 2, 6, 10);
        this._gimliSPBox(s, 3, 7, 11);
      }

      // Convert back to bytes (little-endian)
      const result = [];
      for (let i = 0; i < 12; i++) {
        const bytes = OpCodes.Unpack32LE(s[i]);
        result.push(...bytes);
      }

      return result;
    }

    // Gimli SP-box for a column
    // Reference: https://gimli.cr.yp.to/ Section 2.2
    _gimliSPBox(s, i0, i1, i2) {
      const x = OpCodes.RotL32(s[i0], 24);
      const y = OpCodes.RotL32(s[i1], 9);
      const z = s[i2];

      // Apply SP-box transformations with proper 32-bit masking
      s[i1] = (y ^ x ^ (((x | z) << 1) >>> 0)) >>> 0;
      s[i0] = (z ^ y ^ (((x & y) << 3) >>> 0)) >>> 0;
      s[i2] = (x ^ ((z << 1) >>> 0) ^ (((y & z) << 2) >>> 0)) >>> 0;
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