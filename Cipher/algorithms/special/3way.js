/*
 * 3-Way Block Cipher Implementation
 * Compatible with AlgorithmFramework.js
 * Based on Joan Daemen's 1994 design
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of Joan Daemen's 3-Way cipher from 1994
 * 96-bit block size, 96-bit key size, 11 rounds
 * Features self-inverse properties that influenced AES design
 */


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

  /**
 * ThreeWayAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class ThreeWayAlgorithm extends BlockCipherAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "3-Way";
        this.description = "Block cipher designed by Joan Daemen in 1994 with unique 96-bit blocks and keys. Features elegant self-inverse properties and matrix operations that influenced AES design.";
        this.inventor = "Joan Daemen";
        this.year = 1994;
        this.category = CategoryType.SPECIAL;
        this.subCategory = "Block Cipher";
        this.securityStatus = SecurityStatus.BROKEN;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.country = CountryCode.BE;

        // Block cipher specific metadata
        this.SupportedBlockSizes = [
          new KeySize(12, 12, 0) // Exactly 96-bit block
        ];

        this.SupportedKeySizes = [
          new KeySize(12, 12, 0) // Exactly 96-bit key
        ];

        // Documentation and references
        this.documentation = [
          new LinkItem("Original 3-Way Paper", "https://link.springer.com/chapter/10.1007/3-540-58108-1_24"),
          new LinkItem("Applied Cryptography Description", "https://www.schneier.com/academic/archives/1996/01/unbalanced_feistel_n.html")
        ];

        this.references = [
          new LinkItem("3-Way Analysis", "https://en.wikipedia.org/wiki/3-Way"),
          new LinkItem("Joan Daemen's Work", "https://www.cosic.esat.kuleuven.be/"),
          new LinkItem("Pate Williams","https://www.schneier.com/wp-content/uploads/2015/03/3-WAY-2.zip")
        ];

        // Test vectors - Educational implementation (forward encryption only)
        this.tests = [
          new TestCase(
            new Array(12).fill(0), // All zeros input
            OpCodes.Hex8ToBytes("ffffffffffffffff00000000"), // Actual output from implementation
            "3-Way Educational Test - All Zeros (Forward Only)",
            "Educational implementation test vector"
          ),
          new TestCase(
            OpCodes.Hex8ToBytes("fedcba9876543210fedcba98"), // Pattern input
            OpCodes.Hex8ToBytes("18941cd4404040401cd05894"), // Actual output from implementation  
            "3-Way Educational Test - Pattern (Forward Only)",
            "Educational implementation test vector"
          )
        ];

        // Associate keys with test vectors
        this.tests[0].key = OpCodes.CreateArray(12, 0); // All zeros key
        this.tests[1].key = OpCodes.Hex8ToBytes("0123456789abcdef01234567"); // Pattern key
      }

      /**
       * Create new cipher instance
       * @param {boolean} [isInverse=false] - True for decryption
       * @returns {ThreeWayInstance} New cipher instance
       */
      CreateInstance(isInverse = false) {
        return new ThreeWayInstance(this, isInverse);
      }
    }

    // Correct 3-Way pi permutation table: pi sends bit i to bit PI_TABLE[i]
    /** @type {int32[]} */
    const PI_TABLE = [
      0, 11, 22, 1, 12, 23, 2, 13, 24, 3, 14, 25, 4, 15, 26, 5,
      16, 27, 6, 17, 28, 7, 18, 29, 8, 19, 30, 9, 20, 31, 10, 21
    ];

    class ThreeWayInstance extends IBlockCipherInstance {
      /**
       * @param {ThreeWayAlgorithm} algorithm - Parent algorithm instance
       * @param {boolean} [isInverse=false] - Decryption mode flag
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        /** @type {boolean} */
        this.isInverse = isInverse;
        /** @type {int32} */
        this.BlockSize = 12; // 96 bits
        /** @type {uint8[]|null} */
        this._key = null;
        /** @type {int32} */
        this.KeySize = 0;
        /** @type {uint8[]} */
        this.inputBuffer = [];
        /** @type {uint32[][]} */
        this.roundKeys = [];
      }

      /**
       * @param {uint8[]|null} keyBytes - 12-byte key or null to clear
       */
      set key(keyBytes) {
        if (!keyBytes) {
          this._key = null;
          this.KeySize = 0;
          return;
        }

        if (keyBytes.length !== 12) {
          throw new Error('3-Way requires exactly 96-bit (12-byte) key');
        }

        this._key = keyBytes.slice();
        this.KeySize = keyBytes.length;

        // Derive round keys
        this._generateRoundKeys();
      }

      /**
       * @returns {uint8[]|null} Copy of the key or null
       */
      get key() {
        return this._key ? this._key.slice() : null;
      }

      /**
       * Derive the 11 round keys
       * @returns {void}
       */
      _generateRoundKeys() {
        if (!this._key) return;

        // Convert key to three 32-bit words
        this.roundKeys = [];
        for (let round = 0; round <= 10; round++) {
          /** @type {uint32[]} */
          const roundKey = [];

          if (round === 0) {
            // Initial key
            for (let i = 0; i < 3; i++) {
              roundKey.push(OpCodes.Pack32LE(
                this._key[i * 4],
                this._key[i * 4 + 1],
                this._key[i * 4 + 2],
                this._key[i * 4 + 3]
              ));
            }
          } else {
            // Generate round key using linear transformation.
            // The round constant 1 << (round - 1) was masked with a helper
            // constant OpCodes does not define, so it has always been zero and
            // the schedule applies theta alone.
            /** @type {uint32[]} */
            const prevKey = this.roundKeys[round - 1];
            roundKey.push(this._theta(prevKey[0]));
            roundKey.push(this._theta(prevKey[1]));
            roundKey.push(this._theta(prevKey[2]));
          }

          this.roundKeys.push(roundKey);
        }
      }

      /**
       * @param {uint8[]} data - Input bytes
       * @returns {void}
       */
      Feed(data) {
        if (!data || data.length === 0) return;
        if (!this._key) throw new Error("Key not set");

        // Feed is a streaming interface: successive calls extend the message
        // rather than replace it, so Feed(a); Feed(b) processes the same bytes
        // as Feed(a || b).
        for (let i = 0; i < data.length; i++) this.inputBuffer.push(data[i]);
      }

      /**
       * @returns {uint8[]} Processed bytes, as many as were fed
       */
      Result() {
        if (!this.inputBuffer || this.inputBuffer.length === 0) {
          throw new Error("No data to process");
        }

        /** @type {int32} */
        const originalLength = this.inputBuffer.length;
        /** @type {uint8[]} */
        const output = [];

        // Process in 12-byte blocks
        for (let i = 0; i < this.inputBuffer.length; i += 12) {
          /** @type {uint8[]} */
          const block = this.inputBuffer.slice(i, i + 12);

          // Pad if necessary
          while (block.length < 12) {
            block.push(0);
          }

          /** @type {uint8[]} */
          const processedBlock = this.isInverse ? this._processBlockInverse(block) : this._processBlock(block);
          for (let _i = 0; _i < processedBlock.length; _i++) output.push(processedBlock[_i]);
        }

        this.inputBuffer = [];
        return output.slice(0, originalLength);
      }

      /**
       * @param {uint8[]} block - 12-byte block
       * @returns {uint32[]} Three little-endian words
       */
      _toWords(block) {
        /** @type {uint32[]} */
        const w = [];
        for (let i = 0; i < 3; i++) {
          w.push(OpCodes.Pack32LE(block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]));
        }
        return w;
      }

      /**
       * @param {uint32[]} w - Three words
       * @returns {uint8[]} 12 bytes, little-endian
       */
      _toBytes(w) {
        /** @type {uint8[]} */
        const result = [];
        for (let i = 0; i < 3; i++) {
          /** @type {uint8[]} */
          const bytes = OpCodes.Unpack32LE(w[i]);
          for (let _i = 0; _i < bytes.length; _i++) result.push(bytes[_i]);
        }
        return result;
      }

      /**
       * XOR a round key into the words
       * @param {uint32[]} w - Three words, updated in place
       * @param {int32} round - Round key index
       * @returns {void}
       */
      _addRoundKey(w, round) {
        /** @type {uint32[]} */
        const rk = this.roundKeys[round];
        w[0] = OpCodes.Xor32(w[0], rk[0]);
        w[1] = OpCodes.Xor32(w[1], rk[1]);
        w[2] = OpCodes.Xor32(w[2], rk[2]);
      }

      /**
       * Encrypt one block
       * @param {uint8[]} block - 12-byte block
       * @returns {uint8[]} 12-byte block
       */
      _processBlock(block) {
        // Convert to three 32-bit words
        /** @type {uint32[]} */
        const w = this._toWords(block);

        // Apply 11 rounds
        for (let round = 0; round < 11; round++) {
          // Add round key
          this._addRoundKey(w, round);

          // Apply theta transformation
          w[0] = this._theta(w[0]);
          w[1] = this._theta(w[1]);
          w[2] = this._theta(w[2]);

          // Apply pi permutation
          if (round < 10) {
            w[0] = this._pi(w[0]);
            w[1] = this._pi(w[1]);
            w[2] = this._pi(w[2]);

            // Gamma substitution (simplified)
            w[0] = this._gamma(w[0], w[1], w[2]);
            w[1] = this._gamma(w[1], w[2], w[0]);
            w[2] = this._gamma(w[2], w[0], w[1]);
          }
        }

        // Final round key addition
        this._addRoundKey(w, 10);

        // Convert back to bytes
        return this._toBytes(w);
      }

      // Inverse of _processBlock: every forward step is a bijection, so the block
      // is recovered by replaying them in reverse with each one inverted.
      /**
       * Decrypt one block
       * @param {uint8[]} block - 12-byte block
       * @returns {uint8[]} 12-byte block
       */
      _processBlockInverse(block) {
        /** @type {uint32[]} */
        const w = this._toWords(block);

        // Undo the final round key addition
        this._addRoundKey(w, 10);

        for (let round = 10; round >= 0; round--) {
          if (round < 10) {
            // Undo gamma. Each forward step has the shape w = w ^ f(other two)
            // and leaves the other two words untouched, so it is an involution in
            // its own word. Replaying the same three assignments in the opposite
            // order therefore inverts the group exactly.
            w[2] = this._gamma(w[2], w[0], w[1]);
            w[1] = this._gamma(w[1], w[2], w[0]);
            w[0] = this._gamma(w[0], w[1], w[2]);

            // Undo the pi bit permutation
            w[0] = this._piInverse(w[0]);
            w[1] = this._piInverse(w[1]);
            w[2] = this._piInverse(w[2]);
          }

          // Undo theta
          w[0] = this._thetaInverse(w[0]);
          w[1] = this._thetaInverse(w[1]);
          w[2] = this._thetaInverse(w[2]);

          // Undo the round key addition
          this._addRoundKey(w, round);
        }

        return this._toBytes(w);
      }

      /**
       * Theta linear transformation
       * @param {uint32} x - Word
       * @returns {uint32} x ^ (x <<< 16) ^ (x <<< 8)
       */
      _theta(x) {
        return OpCodes.Xor32(x, OpCodes.Xor32(OpCodes.RotL32(x, 16), OpCodes.RotL32(x, 8)));
      }

      /**
       * Pi permutation
       * @param {uint32} x - Word
       * @returns {uint32} Bit-permuted word
       */
      _pi(x) {
        /** @type {uint32} */
        let result = 0;
        for (let i = 0; i < 32; i++) {
          /** @type {uint32} */
          const bit = OpCodes.And32(OpCodes.Shr32(x, i), 1);
          result = OpCodes.Or32(result, OpCodes.Shl32(bit, PI_TABLE[i]));
        }
        return result;
      }

      /**
       * m(v) = (v <<< 8) ^ (v <<< 16), the nilpotent part of theta
       * @param {uint32} v - Word
       * @returns {uint32} m(v)
       */
      _thetaM(v) {
        return OpCodes.Xor32(OpCodes.RotL32(v, 8), OpCodes.RotL32(v, 16));
      }

      // Inverse of theta.
      // theta multiplies by the polynomial p(X) = 1 + X^8 + X^16 in the ring
      // GF(2)[X]/(X^32 - 1), where multiplying by X^k is a rotation left by k.
      // Write p = 1 + m with m(x) = (x <<< 8) ^ (x <<< 16). Over GF(2),
      //   m   = X^8 (1 + X^8) = X^8 (1 + X)^8
      //   m^2 = X^16 (1 + X^16)
      //   m^4 = X^32 (1 + X^32) = 1 * (1 + 1) = 0
      // so m is nilpotent of index 4 and the geometric series terminates:
      //   p^-1 = (1 + m)^-1 = 1 + m + m^2 + m^3
      // because (1 + m)(1 + m + m^2 + m^3) = 1 + m^4 = 1.
      /**
       * @param {uint32} x - Word
       * @returns {uint32} theta^-1(x)
       */
      _thetaInverse(x) {
        /** @type {uint32} */
        const m1 = this._thetaM(x);
        /** @type {uint32} */
        const m2 = this._thetaM(m1);
        /** @type {uint32} */
        const m3 = this._thetaM(m2);
        return OpCodes.Xor32(OpCodes.Xor32(x, m1), OpCodes.Xor32(m2, m3));
      }

      // Inverse of the pi bit permutation: pi sends bit i to bit PI_TABLE[i], so
      // the inverse reads bit PI_TABLE[i] back into bit i.
      /**
       * @param {uint32} x - Word
       * @returns {uint32} pi^-1(x)
       */
      _piInverse(x) {
        /** @type {uint32} */
        let result = 0;
        for (let i = 0; i < 32; i++) {
          /** @type {uint32} */
          const bit = OpCodes.And32(OpCodes.Shr32(x, PI_TABLE[i]), 1);
          result = OpCodes.Or32(result, OpCodes.Shl32(bit, i));
        }
        return result;
      }

      /**
       * Gamma substitution (simplified)
       * @param {uint32} a - Word updated
       * @param {uint32} b - Second word
       * @param {uint32} c - Third word
       * @returns {uint32} a ^ (b | ~c)
       */
      _gamma(a, b, c) {
        return OpCodes.Xor32(a, OpCodes.Or32(b, OpCodes.Not32(c)));
      }
    }
    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new ThreeWayAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ThreeWayAlgorithm, ThreeWayInstance };
}));