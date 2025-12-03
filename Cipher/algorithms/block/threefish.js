/*
 * Threefish-512 Block Cipher - AlgorithmFramework Implementation
 * Compatible with both Browser and Node.js environments
 * Based on Threefish specification from the Skein hash function family
 * (c)2006-2025 Hawkynt
 * 
 * Threefish-512 Algorithm by Bruce Schneier, et al. (2008)
 * Block size: 512 bits (8 x 64-bit words), Key size: 512 bits, Rounds: 72
 * Uses three operations: addition, XOR, and rotation for cache-timing attack resistance
 * 
 * NOTE: This is an educational implementation for learning purposes only.
 * Threefish was designed as part of the Skein hash function for the NIST competition.
 * 
 * References:
 * - Skein Paper v1.3: "The Skein Hash Function Family"
 * - NIST Submission documentation
 * - Ferguson, N., Lucks, S., Schneier, B., et al.
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

  /**
   * Threefish-512 - Tweakable block cipher from the Skein hash function family
   * 512-bit blocks and keys with 72 rounds, optimized for 64-bit platforms and timing attack resistance
   * @class
   * @extends {BlockCipherAlgorithm}
   */
  class Threefish extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Threefish";
      this.description = "Tweakable block cipher family designed as part of the Skein hash function. Threefish-512 uses 512-bit blocks and keys with 72 rounds, optimized for 64-bit platforms and resistance to timing attacks.";
      this.inventor = "Bruce Schneier, Niels Ferguson, Stefan Lucks, Doug Whiting, Mihir Bellare, Tadayoshi Kohno, Jon Callas, Jesse Walker";
      this.year = 2008;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = null; // Conservative - well-analyzed but not claiming secure
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(64, 64, 0) // Fixed 512-bit keys
      ];
      this.SupportedBlockSizes = [
        new KeySize(64, 64, 0) // Fixed 512-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("The Skein Hash Function Family", "https://www.schneier.com/academic/skein/"),
        new LinkItem("Threefish Specification", "https://www.schneier.com/academic/paperfiles/skein1.3.pdf"),
        new LinkItem("NIST SHA-3 Submission", "https://csrc.nist.gov/projects/hash-functions/sha-3-project")
      ];

      this.references = [
        new LinkItem("Threefish Cryptanalysis", "https://eprint.iacr.org/2009/204.pdf"),
        new LinkItem("Skein/Threefish Security Analysis", "https://www.schneier.com/academic/skein/threefish-cryptanalysis.html"),
        new LinkItem("NIST SHA-3 Competition Analysis", "https://csrc.nist.gov/projects/hash-functions/sha-3-project/round-3-submissions")
      ];

      this.knownVulnerabilities = [];

      // Test vectors - all zeros test
      // Source: Crypto++ TestVectors/threefish.txt, skein_golden_kat_internals.txt
      // Test Vector 7: Threefish-512 with null tweak, all zeros key and plaintext
      // Ciphertext word64: BC2560EFC6BBA2B1 E3361F162238EB40 FB8631EE0ABBD175 7B9479D4C5479ED1
      //                    CFF0356E58F8C27B B1B7B08430F0E7F7 E9A380A56139ABF1 BE7B6D4AA11EB47E
      // Converted to little-endian bytes per 64-bit word
      this.tests = [
        {
          text: "Threefish-512 all zeros test vector",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/threefish.txt",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("B1A2BBC6EF6025BC40EB3822161F36E375D1BB0AEE3186FBD19E47C5D479947B7BC2F8586E35F0CFF7E7F03084B0B7B1F1AB3961A580A3E97EB41EA14A6D7BBE")
        }
      ];

      // Constants
      this.WORDS = 8;              // 8 x 64-bit words
      this.ROUNDS = 72;            // 72 rounds total
      this.SUBKEY_INTERVAL = 4;    // Subkey injection every 4 rounds
      this.KEY_SCHEDULE_CONST = [0xA9FC1A22, 0x1BD11BDA]; // Split 64-bit constant: low, high

      // Threefish-512 rotation constants (d=0..7 for round positions, j=0..3 for word pairs)
      // Based on the Skein specification v1.3
      this.ROTATION_512 = [
        [46, 36, 19, 37],  // d=0
        [33, 27, 14, 42],  // d=1  
        [17, 49, 36, 39],  // d=2
        [44,  9, 54, 56],  // d=3
        [39, 30, 34, 24],  // d=4
        [13, 50, 10, 17],  // d=5
        [25, 29, 39, 43],  // d=6
        [ 8, 35, 56, 22]   // d=7
      ];
    }

    /**
     * Create new Threefish cipher instance
     * @param {boolean} [isInverse=false] - True for decryption, false for encryption
     * @returns {ThreefishInstance} New Threefish cipher instance
     */
    CreateInstance(isInverse = false) {
      return new ThreefishInstance(this, isInverse);
    }

    /**
     * 64-bit addition with carry handling for JavaScript
     * @private
     * @param {uint32} aLow - Low 32 bits of first operand
     * @param {uint32} aHigh - High 32 bits of first operand
     * @param {uint32} bLow - Low 32 bits of second operand
     * @param {uint32} bHigh - High 32 bits of second operand
     * @returns {{low: uint32, high: uint32}} 64-bit sum
     */
    add64(aLow, aHigh, bLow, bHigh) {
      const sumLow = OpCodes.ToUint32(aLow + bLow);
      const carry = sumLow < aLow ? 1 : 0;
      const sumHigh = OpCodes.ToUint32(aHigh + bHigh + carry);
      return { low: sumLow, high: sumHigh };
    }

    /**
     * Encryption MIX function for a single word pair
     * @private
     * @param {Object} x0 - First word {low, high}
     * @param {Object} x1 - Second word {low, high}
     * @param {number} rotation - Rotation amount
     * @returns {{x0: Object, x1: Object}} Updated word pair
     */
    mix(x0, x1, rotation) {
      // x0 += x1
      const sum = this.add64(x0.low, x0.high, x1.low, x1.high);
      // x1 = rotl(x1, R) ^ x0
      const rotated = OpCodes.RotL64(x1.low, x1.high, rotation);
      return {
        x0: { low: sum.low, high: sum.high },
        x1: {
          low: OpCodes.Xor32(rotated.low, sum.low),
          high: OpCodes.Xor32(rotated.high, sum.high)
        }
      };
    }

    /**
     * Decryption MIX function for a single word pair (inverse of mix)
     * @private
     * @param {Object} x0 - First word {low, high}
     * @param {Object} x1 - Second word {low, high}
     * @param {number} rotation - Rotation amount
     * @returns {{x0: Object, x1: Object}} Updated word pair
     */
    unmix(x0, x1, rotation) {
      // x1 = rotr(x1 ^ x0, R)
      const xored = {
        low: OpCodes.Xor32(x1.low, x0.low),
        high: OpCodes.Xor32(x1.high, x0.high)
      };
      const rotated = OpCodes.RotR64(xored.low, xored.high, rotation);
      // x0 -= x1
      const diff = this.sub64(x0.low, x0.high, rotated.low, rotated.high);
      return {
        x0: { low: diff.low, high: diff.high },
        x1: { low: rotated.low, high: rotated.high }
      };
    }


    /**
     * Add key for encryption round (matches Botan key.e_add)
     * @private
     * @param {number} R - Round number
     * @param {Array<{low: uint32, high: uint32}>} X - Array of 8 words
     * @param {Array<{low: uint32, high: uint32}>} K - Extended key array (9 elements)
     * @param {Array<{low: uint32, high: uint32}>} T - Tweak array (3 elements)
     */
    keyAdd(R, X, K, T) {
      for (let i = 0; i < 5; ++i) {
        X[i] = this.add64(X[i].low, X[i].high, K[(R + i) % 9].low, K[(R + i) % 9].high);
      }
      // X[5] += K[(R+5) % 9] + T[R % 3]
      let sum = this.add64(X[5].low, X[5].high, K[(R + 5) % 9].low, K[(R + 5) % 9].high);
      X[5] = this.add64(sum.low, sum.high, T[R % 3].low, T[R % 3].high);

      // X[6] += K[(R+6) % 9] + T[(R+1) % 3]
      sum = this.add64(X[6].low, X[6].high, K[(R + 6) % 9].low, K[(R + 6) % 9].high);
      X[6] = this.add64(sum.low, sum.high, T[(R + 1) % 3].low, T[(R + 1) % 3].high);

      // X[7] += K[(R+7) % 9] + R
      sum = this.add64(X[7].low, X[7].high, K[(R + 7) % 9].low, K[(R + 7) % 9].high);
      X[7] = this.add64(sum.low, sum.high, R, 0);
    }

    /**
     * Subtract key for decryption round (matches Botan key.d_add)
     * @private
     * @param {number} R - Round number
     * @param {Array<{low: uint32, high: uint32}>} X - Array of 8 words
     * @param {Array<{low: uint32, high: uint32}>} K - Extended key array (9 elements)
     * @param {Array<{low: uint32, high: uint32}>} T - Tweak array (3 elements)
     */
    keySub(R, X, K, T) {
      for (let i = 0; i < 5; ++i) {
        X[i] = this.sub64(X[i].low, X[i].high, K[(R + i) % 9].low, K[(R + i) % 9].high);
      }
      // X[5] -= K[(R+5) % 9] + T[R % 3]
      let sub = this.add64(K[(R + 5) % 9].low, K[(R + 5) % 9].high, T[R % 3].low, T[R % 3].high);
      X[5] = this.sub64(X[5].low, X[5].high, sub.low, sub.high);

      // X[6] -= K[(R+6) % 9] + T[(R+1) % 3]
      sub = this.add64(K[(R + 6) % 9].low, K[(R + 6) % 9].high, T[(R + 1) % 3].low, T[(R + 1) % 3].high);
      X[6] = this.sub64(X[6].low, X[6].high, sub.low, sub.high);

      // X[7] -= K[(R+7) % 9] + R
      sub = this.add64(K[(R + 7) % 9].low, K[(R + 7) % 9].high, R, 0);
      X[7] = this.sub64(X[7].low, X[7].high, sub.low, sub.high);
    }

    /**
     * Convert byte array to 64-bit word pairs
     * @private
     * @param {uint8[]} bytes - Input byte array
     * @returns {Array<{low: uint32, high: uint32}>} Array of 64-bit words
     */
    bytesToWords64(bytes) {
      const words = [];
      for (let i = 0; i < bytes.length; i += 8) {
        // Little-endian byte order for each 64-bit word
        const b0 = i < bytes.length ? bytes[i] : 0;
        const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
        const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
        const b3 = i + 3 < bytes.length ? bytes[i + 3] : 0;
        const b4 = i + 4 < bytes.length ? bytes[i + 4] : 0;
        const b5 = i + 5 < bytes.length ? bytes[i + 5] : 0;
        const b6 = i + 6 < bytes.length ? bytes[i + 6] : 0;
        const b7 = i + 7 < bytes.length ? bytes[i + 7] : 0;
        words.push({
          low: OpCodes.Pack32LE(b0, b1, b2, b3),
          high: OpCodes.Pack32LE(b4, b5, b6, b7)
        });
      }
      return words;
    }

    /**
     * Convert 64-bit word pairs back to byte array
     * @private
     * @param {Array<{low: uint32, high: uint32}>} words - Array of 64-bit words
     * @returns {uint8[]} Byte array
     */
    words64ToBytes(words) {
      const bytes = [];
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        // Little-endian byte order
        const lowBytes = OpCodes.Unpack32LE(word.low);
        const highBytes = OpCodes.Unpack32LE(word.high);
        bytes.push(lowBytes[0], lowBytes[1], lowBytes[2], lowBytes[3]);
        bytes.push(highBytes[0], highBytes[1], highBytes[2], highBytes[3]);
      }
      return bytes;
    }

    /**
     * Encryption round function matching Botan's e_round
     * In e_round<R1,R2,R3,R4>(X0,X1,X2,X3,X4,X5,X6,X7):
     * - Mix pairs: (X0,X4), (X1,X5), (X2,X6), (X3,X7)
     * - X0 += X4; X4 = rotl(X4,R) XOR X0; etc.
     * @private
     */
    eRound(X0, X1, X2, X3, X4, X5, X6, X7, R1, R2, R3, R4) {
      // X0 += X4
      const sum0 = this.add64(X0.low, X0.high, X4.low, X4.high);
      X0.low = sum0.low; X0.high = sum0.high;
      // X4 = rotl(X4, R1) ^ X0
      const rot4 = OpCodes.RotL64(X4.low, X4.high, R1);
      X4.low = OpCodes.Xor32(rot4.low, X0.low);
      X4.high = OpCodes.Xor32(rot4.high, X0.high);

      // X1 += X5
      const sum1 = this.add64(X1.low, X1.high, X5.low, X5.high);
      X1.low = sum1.low; X1.high = sum1.high;
      // X5 = rotl(X5, R2) ^ X1
      const rot5 = OpCodes.RotL64(X5.low, X5.high, R2);
      X5.low = OpCodes.Xor32(rot5.low, X1.low);
      X5.high = OpCodes.Xor32(rot5.high, X1.high);

      // X2 += X6
      const sum2 = this.add64(X2.low, X2.high, X6.low, X6.high);
      X2.low = sum2.low; X2.high = sum2.high;
      // X6 = rotl(X6, R3) ^ X2
      const rot6 = OpCodes.RotL64(X6.low, X6.high, R3);
      X6.low = OpCodes.Xor32(rot6.low, X2.low);
      X6.high = OpCodes.Xor32(rot6.high, X2.high);

      // X3 += X7
      const sum3 = this.add64(X3.low, X3.high, X7.low, X7.high);
      X3.low = sum3.low; X3.high = sum3.high;
      // X7 = rotl(X7, R4) ^ X3
      const rot7 = OpCodes.RotL64(X7.low, X7.high, R4);
      X7.low = OpCodes.Xor32(rot7.low, X3.low);
      X7.high = OpCodes.Xor32(rot7.high, X3.high);
    }

    /**
     * Decryption round function matching Botan's d_round
     * Inverse of eRound
     * @private
     */
    dRound(X0, X1, X2, X3, X4, X5, X6, X7, R1, R2, R3, R4) {
      // X4 ^= X0, X4 = rotr(X4, R1), X0 -= X4
      X4.low = OpCodes.Xor32(X4.low, X0.low);
      X4.high = OpCodes.Xor32(X4.high, X0.high);
      const rot4 = OpCodes.RotR64(X4.low, X4.high, R1);
      X4.low = rot4.low; X4.high = rot4.high;
      const diff0 = this.sub64(X0.low, X0.high, X4.low, X4.high);
      X0.low = diff0.low; X0.high = diff0.high;

      // X5 ^= X1, X5 = rotr(X5, R2), X1 -= X5
      X5.low = OpCodes.Xor32(X5.low, X1.low);
      X5.high = OpCodes.Xor32(X5.high, X1.high);
      const rot5 = OpCodes.RotR64(X5.low, X5.high, R2);
      X5.low = rot5.low; X5.high = rot5.high;
      const diff1 = this.sub64(X1.low, X1.high, X5.low, X5.high);
      X1.low = diff1.low; X1.high = diff1.high;

      // X6 ^= X2, X6 = rotr(X6, R3), X2 -= X6
      X6.low = OpCodes.Xor32(X6.low, X2.low);
      X6.high = OpCodes.Xor32(X6.high, X2.high);
      const rot6 = OpCodes.RotR64(X6.low, X6.high, R3);
      X6.low = rot6.low; X6.high = rot6.high;
      const diff2 = this.sub64(X2.low, X2.high, X6.low, X6.high);
      X2.low = diff2.low; X2.high = diff2.high;

      // X7 ^= X3, X7 = rotr(X7, R4), X3 -= X7
      X7.low = OpCodes.Xor32(X7.low, X3.low);
      X7.high = OpCodes.Xor32(X7.high, X3.high);
      const rot7 = OpCodes.RotR64(X7.low, X7.high, R4);
      X7.low = rot7.low; X7.high = rot7.high;
      const diff3 = this.sub64(X3.low, X3.high, X7.low, X7.high);
      X3.low = diff3.low; X3.high = diff3.high;
    }

    /**
     * Perform 8 encryption rounds (matches Botan e8_rounds)
     * @private
     * @param {Array<{low: uint32, high: uint32}>} X - Array of 8 words
     * @param {number} R1 - First key injection round number
     * @param {number} R2 - Second key injection round number
     * @param {Array<{low: uint32, high: uint32}>} K - Extended key array
     * @param {Array<{low: uint32, high: uint32}>} T - Tweak array
     */
    e8Rounds(X, R1, R2, K, T) {
      // From Botan: e_round<R1,R2,R3,R4>(X0,X1,X2,X3,X4,X5,X6,X7) mixes:
      // (X0,X4), (X1,X5), (X2,X6), (X3,X7)
      // The word reordering happens in the call site

      // e_round<46, 36, 19, 37>(X0, X2, X4, X6, X1, X3, X5, X7);
      this.eRound(X[0], X[2], X[4], X[6], X[1], X[3], X[5], X[7], 46, 36, 19, 37);
      // e_round<33, 27, 14, 42>(X2, X4, X6, X0, X1, X7, X5, X3);
      this.eRound(X[2], X[4], X[6], X[0], X[1], X[7], X[5], X[3], 33, 27, 14, 42);
      // e_round<17, 49, 36, 39>(X4, X6, X0, X2, X1, X3, X5, X7);
      this.eRound(X[4], X[6], X[0], X[2], X[1], X[3], X[5], X[7], 17, 49, 36, 39);
      // e_round<44,  9, 54, 56>(X6, X0, X2, X4, X1, X7, X5, X3);
      this.eRound(X[6], X[0], X[2], X[4], X[1], X[7], X[5], X[3], 44, 9, 54, 56);

      // Key injection R1
      this.keyAdd(R1, X, K, T);

      // e_round<39, 30, 34, 24>(X0, X2, X4, X6, X1, X3, X5, X7);
      this.eRound(X[0], X[2], X[4], X[6], X[1], X[3], X[5], X[7], 39, 30, 34, 24);
      // e_round<13, 50, 10, 17>(X2, X4, X6, X0, X1, X7, X5, X3);
      this.eRound(X[2], X[4], X[6], X[0], X[1], X[7], X[5], X[3], 13, 50, 10, 17);
      // e_round<25, 29, 39, 43>(X4, X6, X0, X2, X1, X3, X5, X7);
      this.eRound(X[4], X[6], X[0], X[2], X[1], X[3], X[5], X[7], 25, 29, 39, 43);
      // e_round< 8, 35, 56, 22>(X6, X0, X2, X4, X1, X7, X5, X3);
      this.eRound(X[6], X[0], X[2], X[4], X[1], X[7], X[5], X[3], 8, 35, 56, 22);

      // Key injection R2
      this.keyAdd(R2, X, K, T);
    }

    /**
     * Perform 8 decryption rounds (matches Botan d8_rounds)
     * @private
     * @param {Array<{low: uint32, high: uint32}>} X - Array of 8 words
     * @param {number} R1 - First key subtraction round number (higher)
     * @param {number} R2 - Second key subtraction round number (lower)
     * @param {Array<{low: uint32, high: uint32}>} K - Extended key array
     * @param {Array<{low: uint32, high: uint32}>} T - Tweak array
     */
    d8Rounds(X, R1, R2, K, T) {
      // From Botan d8_rounds - reverse order of encryption rounds

      // d_round< 8, 35, 56, 22>(X6, X0, X2, X4, X1, X7, X5, X3);
      this.dRound(X[6], X[0], X[2], X[4], X[1], X[7], X[5], X[3], 8, 35, 56, 22);
      // d_round<25, 29, 39, 43>(X4, X6, X0, X2, X1, X3, X5, X7);
      this.dRound(X[4], X[6], X[0], X[2], X[1], X[3], X[5], X[7], 25, 29, 39, 43);
      // d_round<13, 50, 10, 17>(X2, X4, X6, X0, X1, X7, X5, X3);
      this.dRound(X[2], X[4], X[6], X[0], X[1], X[7], X[5], X[3], 13, 50, 10, 17);
      // d_round<39, 30, 34, 24>(X0, X2, X4, X6, X1, X3, X5, X7);
      this.dRound(X[0], X[2], X[4], X[6], X[1], X[3], X[5], X[7], 39, 30, 34, 24);

      // Key subtraction R1
      this.keySub(R1, X, K, T);

      // d_round<44,  9, 54, 56>(X6, X0, X2, X4, X1, X7, X5, X3);
      this.dRound(X[6], X[0], X[2], X[4], X[1], X[7], X[5], X[3], 44, 9, 54, 56);
      // d_round<17, 49, 36, 39>(X4, X6, X0, X2, X1, X3, X5, X7);
      this.dRound(X[4], X[6], X[0], X[2], X[1], X[3], X[5], X[7], 17, 49, 36, 39);
      // d_round<33, 27, 14, 42>(X2, X4, X6, X0, X1, X7, X5, X3);
      this.dRound(X[2], X[4], X[6], X[0], X[1], X[7], X[5], X[3], 33, 27, 14, 42);
      // d_round<46, 36, 19, 37>(X0, X2, X4, X6, X1, X3, X5, X7);
      this.dRound(X[0], X[2], X[4], X[6], X[1], X[3], X[5], X[7], 46, 36, 19, 37);

      // Key subtraction R2
      this.keySub(R2, X, K, T);
    }

    /**
     * Encrypt a 512-bit block
     * @private
     * @param {uint8[]} bytes - 64-byte input block
     * @param {Array<{low: uint32, high: uint32}>} extendedKey - Extended key schedule
     * @returns {uint8[]} 64-byte encrypted block
     */
    encryptBlock(bytes, extendedKey) {
      const X = this.bytesToWords64(bytes);

      // Ensure we have exactly 8 words (pad if necessary)
      while (X.length < 8) {
        X.push({ low: 0, high: 0 });
      }

      // Extract K (first 9 elements) and T (next 3 elements)
      const K = extendedKey.slice(0, 9);
      const T = extendedKey.slice(9, 12);

      // Initial key addition (key injection 0)
      this.keyAdd(0, X, K, T);

      // 72 rounds = 9 iterations of e8_rounds (each does 8 rounds)
      this.e8Rounds(X, 1, 2, K, T);
      this.e8Rounds(X, 3, 4, K, T);
      this.e8Rounds(X, 5, 6, K, T);
      this.e8Rounds(X, 7, 8, K, T);
      this.e8Rounds(X, 9, 10, K, T);
      this.e8Rounds(X, 11, 12, K, T);
      this.e8Rounds(X, 13, 14, K, T);
      this.e8Rounds(X, 15, 16, K, T);
      this.e8Rounds(X, 17, 18, K, T);

      return this.words64ToBytes(X);
    }

    /**
     * 64-bit subtraction with borrow handling
     * @private
     * @param {uint32} aLow - Low 32 bits of minuend
     * @param {uint32} aHigh - High 32 bits of minuend
     * @param {uint32} bLow - Low 32 bits of subtrahend
     * @param {uint32} bHigh - High 32 bits of subtrahend
     * @returns {{low: uint32, high: uint32}} 64-bit difference
     */
    sub64(aLow, aHigh, bLow, bHigh) {
      const borrowLow = aLow < bLow ? 1 : 0;
      const resultLow = OpCodes.ToUint32(aLow - bLow);
      const resultHigh = OpCodes.ToUint32(aHigh - bHigh - borrowLow);
      return { low: resultLow, high: resultHigh };
    }

    /**
     * Decrypt a 512-bit block
     * @private
     * @param {uint8[]} bytes - 64-byte input block
     * @param {Array<{low: uint32, high: uint32}>} extendedKey - Extended key schedule
     * @returns {uint8[]} 64-byte decrypted block
     */
    decryptBlock(bytes, extendedKey) {
      const X = this.bytesToWords64(bytes);

      // Ensure we have exactly 8 words
      while (X.length < 8) {
        X.push({ low: 0, high: 0 });
      }

      // Extract K (first 9 elements) and T (next 3 elements)
      const K = extendedKey.slice(0, 9);
      const T = extendedKey.slice(9, 12);

      // Subtract final key (key injection 18)
      this.keySub(18, X, K, T);

      // 72 rounds = 9 iterations of d8_rounds (each does 8 rounds)
      // Reverse order from encryption
      this.d8Rounds(X, 17, 16, K, T);
      this.d8Rounds(X, 15, 14, K, T);
      this.d8Rounds(X, 13, 12, K, T);
      this.d8Rounds(X, 11, 10, K, T);
      this.d8Rounds(X, 9, 8, K, T);
      this.d8Rounds(X, 7, 6, K, T);
      this.d8Rounds(X, 5, 4, K, T);
      this.d8Rounds(X, 3, 2, K, T);
      this.d8Rounds(X, 1, 0, K, T);

      return this.words64ToBytes(X);
    }

    /**
     * Generate extended key from key bytes
     * @private
     * @param {uint8[]} keyBytes - 64-byte key
     * @returns {Array<{low: uint32, high: uint32}>} Extended key schedule
     */
    generateExtendedKey(keyBytes) {
      // Convert key to 64-bit words
      const keyWords = this.bytesToWords64(keyBytes);
      const tweak = [{ low: 0, high: 0 }, { low: 0, high: 0 }]; // Default zero tweak

      // Generate extended key: K0..K7, T0, T1, T2, K8
      // where T2 = T0 XOR T1 and K8 = C XOR K0..K7
      const extendedKey = [];

      // Copy original key words K0..K7
      for (let i = 0; i < 8; i++) {
        extendedKey[i] = { low: keyWords[i].low, high: keyWords[i].high };
      }

      // Calculate K8 = C XOR (K0 XOR K1 XOR ... XOR K7)
      let xorResult = { low: OpCodes.ToUint32(this.KEY_SCHEDULE_CONST[0]), high: OpCodes.ToUint32(this.KEY_SCHEDULE_CONST[1]) };
      for (let i = 0; i < 8; i++) {
        xorResult.low = OpCodes.Xor32(xorResult.low, keyWords[i].low);
        xorResult.high = OpCodes.Xor32(xorResult.high, keyWords[i].high);
      }
      extendedKey[8] = xorResult;

      // Add tweak words T0, T1
      extendedKey[9] = { low: tweak[0].low, high: tweak[0].high };
      extendedKey[10] = { low: tweak[1].low, high: tweak[1].high };

      // Calculate T2 = T0 XOR T1
      extendedKey[11] = {
        low: OpCodes.Xor32(tweak[0].low, tweak[1].low),
        high: OpCodes.Xor32(tweak[0].high, tweak[1].high)
      };

      return extendedKey;
    }
  }

  /**
   * Threefish cipher instance implementing Feed/Result pattern
   * @class
   * @extends {IBlockCipherInstance}
   */
  class ThreefishInstance extends IBlockCipherInstance {
    /**
     * Initialize Threefish cipher instance
     * @param {Threefish} algorithm - Parent algorithm instance
     * @param {boolean} [isInverse=false] - Decryption mode flag
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.extendedKey = null;
      this.inputBuffer = [];
      this.BlockSize = 64; // bytes (512 bits)
      this.KeySize = 0;    // will be set when key is assigned
    }

    /**
     * Set encryption/decryption key
     * @param {uint8[]|null} keyBytes - 512-bit (64-byte) key or null to clear
     * @throws {Error} If key size is not exactly 64 bytes
     */
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.extendedKey = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks => 
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
        (ks.stepSize === 0 || (keyBytes.length - ks.minSize) % ks.stepSize === 0)
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes]; // Copy the key
      this.KeySize = keyBytes.length;
      this.extendedKey = this.algorithm.generateExtendedKey(keyBytes);
    }

    /**
     * Get copy of current key
     * @returns {uint8[]|null} Copy of key bytes or null
     */
    get key() {
      return this._key ? [...this._key] : null; // Return copy
    }

    /**
     * Feed data to cipher for encryption/decryption
     * @param {uint8[]} data - Input data bytes
     * @throws {Error} If key not set
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      // Add data to input buffer
      this.inputBuffer.push(...data);
    }

    /**
     * Get cipher result (encrypted or decrypted data)
     * @returns {uint8[]} Processed output bytes
     * @throws {Error} If key not set, no data fed, or invalid input length
     */
    Result() {
      if (!this.key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Process complete blocks
      const output = [];
      const blockSize = this.BlockSize;

      // Validate input length for block cipher
      if (this.inputBuffer.length % blockSize !== 0) {
        throw new Error(`Input length must be multiple of ${blockSize} bytes`);
      }

      // Process each block
      for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
        const block = this.inputBuffer.slice(i, i + blockSize);
        const processedBlock = this.isInverse 
          ? this.algorithm.decryptBlock(block, this.extendedKey) 
          : this.algorithm.encryptBlock(block, this.extendedKey);
        output.push(...processedBlock);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }
  }

  // Register the algorithm immediately

  // ===== REGISTRATION =====

    const algorithmInstance = new Threefish();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Threefish, ThreefishAlgorithm: Threefish, ThreefishInstance };
}));