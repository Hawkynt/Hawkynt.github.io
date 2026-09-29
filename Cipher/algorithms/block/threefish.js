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

  // Skein key schedule constant C = 0x1BD11BDAA9FC1A22, as low/high halves.
  const KEY_SCHEDULE_CONST_LO = 0xA9FC1A22;
  const KEY_SCHEDULE_CONST_HI = 0x1BD11BDA;

  // ===== 64-BIT WORD HELPERS =====
  // A 64-bit word w of an array A is held as two uint32 halves: A[2w] (low) and
  // A[2w + 1] (high).

  /**
   * W[wi] += (bLo, bHi) mod 2^64
   * @param {uint32[]} W - Word array, updated in place
   * @param {int32} wi - Word index
   * @param {uint32} bLo - Low half of the addend
   * @param {uint32} bHi - High half of the addend
   */
  function addTo(W, wi, bLo, bHi) {
    const aLo = W[2 * wi], aHi = W[2 * wi + 1];
    const sumLow = OpCodes.Add32(aLo, bLo);
    const carry = sumLow < aLo ? 1 : 0;
    W[2 * wi] = sumLow;
    W[2 * wi + 1] = OpCodes.Add32(OpCodes.Add32(aHi, bHi), carry);
  }

  /**
   * W[wi] -= (bLo, bHi) mod 2^64
   * @param {uint32[]} W - Word array, updated in place
   * @param {int32} wi - Word index
   * @param {uint32} bLo - Low half of the subtrahend
   * @param {uint32} bHi - High half of the subtrahend
   */
  function subFrom(W, wi, bLo, bHi) {
    const aLo = W[2 * wi], aHi = W[2 * wi + 1];
    const borrowLow = aLo < bLo ? 1 : 0;
    W[2 * wi] = OpCodes.Sub32(aLo, bLo);
    W[2 * wi + 1] = OpCodes.Sub32(OpCodes.Sub32(aHi, bHi), borrowLow);
  }

  /**
   * Rotate word W[wi] left by r bits (same case split as OpCodes.RotL64)
   * @param {uint32[]} W - Word array, updated in place
   * @param {int32} wi - Word index
   * @param {int32} r - Rotation (0..63)
   */
  function rotlAt(W, wi, r) {
    const lo = W[2 * wi], hi = W[2 * wi + 1];
    /** @type {int32} */
    const p = OpCodes.And32(r, 63);
    if (p === 0) return;
    if (p < 32) {
      W[2 * wi] = OpCodes.Or32(OpCodes.Shl32(lo, p), OpCodes.Shr32(hi, 32 - p));
      W[2 * wi + 1] = OpCodes.Or32(OpCodes.Shl32(hi, p), OpCodes.Shr32(lo, 32 - p));
    } else if (p === 32) {
      W[2 * wi] = hi;
      W[2 * wi + 1] = lo;
    } else {
      const q = p - 32;
      W[2 * wi] = OpCodes.Or32(OpCodes.Shl32(hi, q), OpCodes.Shr32(lo, 32 - q));
      W[2 * wi + 1] = OpCodes.Or32(OpCodes.Shl32(lo, q), OpCodes.Shr32(hi, 32 - q));
    }
  }

  /**
   * Rotate word W[wi] right by r bits (same case split as OpCodes.RotR64)
   * @param {uint32[]} W - Word array, updated in place
   * @param {int32} wi - Word index
   * @param {int32} r - Rotation (0..63)
   */
  function rotrAt(W, wi, r) {
    const lo = W[2 * wi], hi = W[2 * wi + 1];
    /** @type {int32} */
    const p = OpCodes.And32(r, 63);
    if (p === 0) return;
    if (p < 32) {
      W[2 * wi] = OpCodes.Or32(OpCodes.Shr32(lo, p), OpCodes.Shl32(hi, 32 - p));
      W[2 * wi + 1] = OpCodes.Or32(OpCodes.Shr32(hi, p), OpCodes.Shl32(lo, 32 - p));
    } else if (p === 32) {
      W[2 * wi] = hi;
      W[2 * wi + 1] = lo;
    } else {
      const q = p - 32;
      W[2 * wi] = OpCodes.Or32(OpCodes.Shr32(hi, q), OpCodes.Shl32(lo, 32 - q));
      W[2 * wi + 1] = OpCodes.Or32(OpCodes.Shr32(lo, q), OpCodes.Shl32(hi, 32 - q));
    }
  }

  /**
   * Encryption MIX of words i and j: X[i] += X[j]; X[j] = rotl(X[j], r) XOR X[i]
   * @param {uint32[]} X - State words
   * @param {int32} i - First word
   * @param {int32} j - Second word
   * @param {int32} r - Rotation
   */
  function mixE(X, i, j, r) {
    addTo(X, i, X[2 * j], X[2 * j + 1]);
    rotlAt(X, j, r);
    X[2 * j] = OpCodes.Xor32(X[2 * j], X[2 * i]);
    X[2 * j + 1] = OpCodes.Xor32(X[2 * j + 1], X[2 * i + 1]);
  }

  /**
   * Decryption MIX (inverse of mixE): X[j] ^= X[i]; X[j] = rotr(X[j], r); X[i] -= X[j]
   * @param {uint32[]} X - State words
   * @param {int32} i - First word
   * @param {int32} j - Second word
   * @param {int32} r - Rotation
   */
  function mixD(X, i, j, r) {
    X[2 * j] = OpCodes.Xor32(X[2 * j], X[2 * i]);
    X[2 * j + 1] = OpCodes.Xor32(X[2 * j + 1], X[2 * i + 1]);
    rotrAt(X, j, r);
    subFrom(X, i, X[2 * j], X[2 * j + 1]);
  }

  /**
   * Encryption round (Botan e_round): mixes the pairs (a0,b0) .. (a3,b3)
   * @param {uint32[]} X - State words
   * @param {int32} a0 - Word
   * @param {int32} a1 - Word
   * @param {int32} a2 - Word
   * @param {int32} a3 - Word
   * @param {int32} b0 - Word
   * @param {int32} b1 - Word
   * @param {int32} b2 - Word
   * @param {int32} b3 - Word
   * @param {int32} R1 - Rotation of pair 0
   * @param {int32} R2 - Rotation of pair 1
   * @param {int32} R3 - Rotation of pair 2
   * @param {int32} R4 - Rotation of pair 3
   */
  function eRound(X, a0, a1, a2, a3, b0, b1, b2, b3, R1, R2, R3, R4) {
    mixE(X, a0, b0, R1);
    mixE(X, a1, b1, R2);
    mixE(X, a2, b2, R3);
    mixE(X, a3, b3, R4);
  }

  /**
   * Decryption round (Botan d_round), inverse of eRound
   * @param {uint32[]} X - State words
   * @param {int32} a0 - Word
   * @param {int32} a1 - Word
   * @param {int32} a2 - Word
   * @param {int32} a3 - Word
   * @param {int32} b0 - Word
   * @param {int32} b1 - Word
   * @param {int32} b2 - Word
   * @param {int32} b3 - Word
   * @param {int32} R1 - Rotation of pair 0
   * @param {int32} R2 - Rotation of pair 1
   * @param {int32} R3 - Rotation of pair 2
   * @param {int32} R4 - Rotation of pair 3
   */
  function dRound(X, a0, a1, a2, a3, b0, b1, b2, b3, R1, R2, R3, R4) {
    mixD(X, a0, b0, R1);
    mixD(X, a1, b1, R2);
    mixD(X, a2, b2, R3);
    mixD(X, a3, b3, R4);
  }

  // The extended key holds 12 words: K0..K8 at 0..8 and T0..T2 at 9..11.

  /**
   * Key injection R for encryption (Botan key.e_add)
   * @param {int32} R - Injection number
   * @param {uint32[]} X - State words
   * @param {uint32[]} ek - Extended key words
   */
  function keyAdd(R, X, ek) {
    for (let i = 0; i < 5; ++i) {
      const ki = (R + i) % 9;
      addTo(X, i, ek[2 * ki], ek[2 * ki + 1]);
    }
    // X[5] += K[(R+5) % 9] + T[R % 3]
    let k = (R + 5) % 9;
    let t = 9 + R % 3;
    addTo(X, 5, ek[2 * k], ek[2 * k + 1]);
    addTo(X, 5, ek[2 * t], ek[2 * t + 1]);
    // X[6] += K[(R+6) % 9] + T[(R+1) % 3]
    k = (R + 6) % 9;
    t = 9 + (R + 1) % 3;
    addTo(X, 6, ek[2 * k], ek[2 * k + 1]);
    addTo(X, 6, ek[2 * t], ek[2 * t + 1]);
    // X[7] += K[(R+7) % 9] + R
    k = (R + 7) % 9;
    addTo(X, 7, ek[2 * k], ek[2 * k + 1]);
    addTo(X, 7, R, 0);
  }

  /**
   * Key subtraction R for decryption (Botan key.d_add)
   * @param {int32} R - Injection number
   * @param {uint32[]} X - State words
   * @param {uint32[]} ek - Extended key words
   */
  function keySub(R, X, ek) {
    for (let i = 0; i < 5; ++i) {
      const ki = (R + i) % 9;
      subFrom(X, i, ek[2 * ki], ek[2 * ki + 1]);
    }
    /** @type {uint32[]} */
    const sum = [0, 0];
    // X[5] -= K[(R+5) % 9] + T[R % 3]
    let k = (R + 5) % 9;
    let t = 9 + R % 3;
    sum[0] = ek[2 * k]; sum[1] = ek[2 * k + 1];
    addTo(sum, 0, ek[2 * t], ek[2 * t + 1]);
    subFrom(X, 5, sum[0], sum[1]);
    // X[6] -= K[(R+6) % 9] + T[(R+1) % 3]
    k = (R + 6) % 9;
    t = 9 + (R + 1) % 3;
    sum[0] = ek[2 * k]; sum[1] = ek[2 * k + 1];
    addTo(sum, 0, ek[2 * t], ek[2 * t + 1]);
    subFrom(X, 6, sum[0], sum[1]);
    // X[7] -= K[(R+7) % 9] + R
    k = (R + 7) % 9;
    sum[0] = ek[2 * k]; sum[1] = ek[2 * k + 1];
    addTo(sum, 0, R, 0);
    subFrom(X, 7, sum[0], sum[1]);
  }

  /**
   * Little-endian bytes to 64-bit words (missing trailing bytes read as 0)
   * @param {uint8[]} bytes - Input bytes
   * @param {int32} minWords - Minimum number of words (zero-padded)
   * @returns {uint32[]} Words as low/high halves
   */
  function bytesToWords64(bytes, minWords) {
    const n = Math.max(minWords, Math.ceil(bytes.length / 8));
    /** @type {uint32[]} */
    const words = [];
    for (let w = 0; w < n; w++) {
      const i = w * 8;
      const b0 = i < bytes.length ? bytes[i] : 0;
      const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
      const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
      const b3 = i + 3 < bytes.length ? bytes[i + 3] : 0;
      const b4 = i + 4 < bytes.length ? bytes[i + 4] : 0;
      const b5 = i + 5 < bytes.length ? bytes[i + 5] : 0;
      const b6 = i + 6 < bytes.length ? bytes[i + 6] : 0;
      const b7 = i + 7 < bytes.length ? bytes[i + 7] : 0;
      words.push(OpCodes.Pack32LE(b0, b1, b2, b3));
      words.push(OpCodes.Pack32LE(b4, b5, b6, b7));
    }
    return words;
  }

  /**
   * 64-bit words back to little-endian bytes
   * @param {uint32[]} words - Words as low/high halves
   * @returns {uint8[]} Bytes
   */
  function words64ToBytes(words) {
    /** @type {uint8[]} */
    const bytes = [];
    for (let i = 0; i < words.length; i++) {
      const part = OpCodes.Unpack32LE(words[i]);
      for (let b = 0; b < 4; b++) bytes.push(part[b]);
    }
    return bytes;
  }

  /**
   * Eight encryption rounds (Botan e8_rounds)
   * @param {uint32[]} X - State words
   * @param {int32} R1 - First key injection
   * @param {int32} R2 - Second key injection
   * @param {uint32[]} ek - Extended key words
   */
  function e8Rounds(X, R1, R2, ek) {
    eRound(X, 0, 2, 4, 6, 1, 3, 5, 7, 46, 36, 19, 37);
    eRound(X, 2, 4, 6, 0, 1, 7, 5, 3, 33, 27, 14, 42);
    eRound(X, 4, 6, 0, 2, 1, 3, 5, 7, 17, 49, 36, 39);
    eRound(X, 6, 0, 2, 4, 1, 7, 5, 3, 44, 9, 54, 56);
    keyAdd(R1, X, ek);
    eRound(X, 0, 2, 4, 6, 1, 3, 5, 7, 39, 30, 34, 24);
    eRound(X, 2, 4, 6, 0, 1, 7, 5, 3, 13, 50, 10, 17);
    eRound(X, 4, 6, 0, 2, 1, 3, 5, 7, 25, 29, 39, 43);
    eRound(X, 6, 0, 2, 4, 1, 7, 5, 3, 8, 35, 56, 22);
    keyAdd(R2, X, ek);
  }

  /**
   * Eight decryption rounds (Botan d8_rounds)
   * @param {uint32[]} X - State words
   * @param {int32} R1 - First key subtraction (higher)
   * @param {int32} R2 - Second key subtraction (lower)
   * @param {uint32[]} ek - Extended key words
   */
  function d8Rounds(X, R1, R2, ek) {
    dRound(X, 6, 0, 2, 4, 1, 7, 5, 3, 8, 35, 56, 22);
    dRound(X, 4, 6, 0, 2, 1, 3, 5, 7, 25, 29, 39, 43);
    dRound(X, 2, 4, 6, 0, 1, 7, 5, 3, 13, 50, 10, 17);
    dRound(X, 0, 2, 4, 6, 1, 3, 5, 7, 39, 30, 34, 24);
    keySub(R1, X, ek);
    dRound(X, 6, 0, 2, 4, 1, 7, 5, 3, 44, 9, 54, 56);
    dRound(X, 4, 6, 0, 2, 1, 3, 5, 7, 17, 49, 36, 39);
    dRound(X, 2, 4, 6, 0, 1, 7, 5, 3, 33, 27, 14, 42);
    dRound(X, 0, 2, 4, 6, 1, 3, 5, 7, 46, 36, 19, 37);
    keySub(R2, X, ek);
  }

  /**
   * Encrypt a 512-bit block (words past the eighth pass through)
   * @param {uint8[]} bytes - 64-byte block
   * @param {uint32[]} ek - Extended key words
   * @returns {uint8[]} Encrypted block
   */
  function threefishEncrypt(bytes, ek) {
    const X = bytesToWords64(bytes, 8);
    keyAdd(0, X, ek);
    for (let r = 1; r < 18; r += 2) e8Rounds(X, r, r + 1, ek);
    return words64ToBytes(X);
  }

  /**
   * Decrypt a 512-bit block (words past the eighth pass through)
   * @param {uint8[]} bytes - 64-byte block
   * @param {uint32[]} ek - Extended key words
   * @returns {uint8[]} Decrypted block
   */
  function threefishDecrypt(bytes, ek) {
    const X = bytesToWords64(bytes, 8);
    keySub(18, X, ek);
    for (let r = 17; r > 0; r -= 2) d8Rounds(X, r, r - 1, ek);
    return words64ToBytes(X);
  }

  /**
   * Extended key: K0..K7, K8 = C XOR K0..K7, T0, T1, T2 = T0 XOR T1
   * @param {uint8[]} keyBytes - 64-byte key
   * @param {uint8[]|null} tweakBytes - 16-byte tweak, or null/other length for the zero tweak
   * @returns {uint32[]} 12 words as low/high halves
   */
  function threefishExtendedKey(keyBytes, tweakBytes) {
    const keyWords = bytesToWords64(keyBytes, 0);
    /** @type {uint32[]} */
    const zero = [0, 0, 0, 0];
    const tweak = (tweakBytes && tweakBytes.length === 16) ? bytesToWords64(tweakBytes, 0) : zero;

    /** @type {uint32[]} */
    const ek = [];
    for (let i = 0; i < 16; i++) ek.push(keyWords[i]);
    let lo = KEY_SCHEDULE_CONST_LO;
    let hi = KEY_SCHEDULE_CONST_HI;
    for (let i = 0; i < 8; i++) {
      lo = OpCodes.Xor32(lo, keyWords[2 * i]);
      hi = OpCodes.Xor32(hi, keyWords[2 * i + 1]);
    }
    ek.push(lo);
    ek.push(hi);
    for (let i = 0; i < 4; i++) ek.push(tweak[i]);
    ek.push(OpCodes.Xor32(tweak[0], tweak[2]));
    ek.push(OpCodes.Xor32(tweak[1], tweak[3]));
    return ek;
  }

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
      /** @type {int32} */
      this.WORDS = 8;              // 8 x 64-bit words
      /** @type {int32} */
      this.ROUNDS = 72;            // 72 rounds total
      /** @type {int32} */
      this.SUBKEY_INTERVAL = 4;    // Subkey injection every 4 rounds
      /** @type {uint32[]} */
      this.KEY_SCHEDULE_CONST = [0xA9FC1A22, 0x1BD11BDA]; // Split 64-bit constant: low, high

      // Threefish-512 rotation constants (d=0..7 for round positions, j=0..3 for word pairs)
      // Based on the Skein specification v1.3
      /** @type {uint8[][]} */
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
     * Encrypt a 512-bit block
     * @param {uint8[]} bytes - 64-byte input block
     * @param {uint32[]} extendedKey - Extended key (12 words as low/high halves)
     * @returns {uint8[]} 64-byte encrypted block
     */
    encryptBlock(bytes, extendedKey) {
      return threefishEncrypt(bytes, extendedKey);
    }

    /**
     * Decrypt a 512-bit block
     * @param {uint8[]} bytes - 64-byte input block
     * @param {uint32[]} extendedKey - Extended key (12 words as low/high halves)
     * @returns {uint8[]} 64-byte decrypted block
     */
    decryptBlock(bytes, extendedKey) {
      return threefishDecrypt(bytes, extendedKey);
    }

    /**
     * Generate extended key from key bytes
     * @param {uint8[]} keyBytes - 64-byte key
     * @param {uint8[]|null} tweakBytes - 16-byte tweak, or null for the all-zero tweak
     * @returns {uint32[]} Extended key (12 words as low/high halves)
     */
    generateExtendedKey(keyBytes, tweakBytes) {
      return threefishExtendedKey(keyBytes, tweakBytes);
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
      /** @type {uint8[]|null} */
      this._tweak = null;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint32[]|null} */
      this.extendedKey = null;
      this.key = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = 64; // bytes (512 bits)
      this.KeySize = 0;    // will be set when key is assigned
    }

    /**
     * Set the 128-bit tweak value. Threefish is a tweakable block cipher; the
     * tweak participates in the key schedule alongside the key.
     * @param {uint8[]|null} tweakBytes - 16-byte tweak, or null for the all-zero tweak
     * @throws {Error} If the tweak is not exactly 16 bytes
     */
    set tweak(tweakBytes) {
      if (!tweakBytes) {
        this._tweak = null;
      } else {
        if (tweakBytes.length !== 16) {
          throw new Error("Invalid tweak size: " + tweakBytes.length + " bytes (must be 16)");
        }
        this._tweak = [...tweakBytes];
      }
      if (this._key) {
        this.extendedKey = threefishExtendedKey(this._key, this._tweak);
      }
    }

    /**
     * Get copy of the current tweak
     * @returns {uint8[]|null} Copy of tweak bytes or null
     */
    get tweak() {
      return this._tweak ? [...this._tweak] : null;
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
      /** @type {KeySize[]} */
      const sizes = this.algorithm.SupportedKeySizes;
      let isValidSize = false;
      for (let i = 0; i < sizes.length; i++) {
        const ks = sizes[i];
        if (keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
            (ks.stepSize === 0 || (keyBytes.length - ks.minSize) % ks.stepSize === 0)) {
          isValidSize = true;
          break;
        }
      }

      if (!isValidSize) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes");
      }

      this._key = [...keyBytes]; // Copy the key
      this.KeySize = keyBytes.length;
      this.extendedKey = threefishExtendedKey(keyBytes, this._tweak);
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
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
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
      /** @type {uint8[]} */
      const output = [];
      const blockSize = this.BlockSize;

      // Validate input length for block cipher
      if (this.inputBuffer.length % blockSize !== 0) {
        throw new Error("Input length must be multiple of " + blockSize + " bytes");
      }

      // Process each block
      for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
        const block = this.inputBuffer.slice(i, i + blockSize);
        const processedBlock = this.isInverse
          ? threefishDecrypt(block, this.extendedKey)
          : threefishEncrypt(block, this.extendedKey);
        for (let _i = 0; _i < processedBlock.length; _i++) output.push(processedBlock[_i]);
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