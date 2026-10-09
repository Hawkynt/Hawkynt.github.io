/*
 * xxHash3 Implementation - Ultra-Fast Non-Cryptographic Hash Function
 * Latest generation xxHash (64-bit and 128-bit variants)
 * (c)2006-2025 Hawkynt
 *
 * Transcribed from the reference implementation in xxhash.h
 * (https://github.com/Cyan4973/xxHash/blob/dev/xxhash.h): the four
 * length-dependent code paths (0..16, 17..128, 129..240 and the long
 * accumulate/scramble loop above 240 bytes), the 192-byte default secret,
 * the custom-secret derivation used for seeded long inputs, and both the
 * 64-bit and 128-bit finalizers.
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

  /** @type {BigInt} */
  const MASK64 = 0xFFFFFFFFFFFFFFFFn;
  /** @type {BigInt} */
  const MASK32 = 0xFFFFFFFFn;

  // xxHash primes
  /** @type {BigInt} */
  const PRIME64_1 = 0x9E3779B185EBCA87n;
  /** @type {BigInt} */
  const PRIME64_2 = 0xC2B2AE3D27D4EB4Fn;
  /** @type {BigInt} */
  const PRIME64_3 = 0x165667B19E3779F9n;
  /** @type {BigInt} */
  const PRIME64_4 = 0x85EBCA77C2B2AE63n;
  /** @type {BigInt} */
  const PRIME64_5 = 0x27D4EB2F165667C5n;
  /** @type {BigInt} */
  const PRIME32_1 = 0x9E3779B1n;
  /** @type {BigInt} */
  const PRIME32_2 = 0x85EBCA77n;
  /** @type {BigInt} */
  const PRIME32_3 = 0xC2B2AE3Dn;

  // xxHash3-specific mixing constants
  /** @type {BigInt} */
  const PRIME_MX1 = 0x165667919E3779F9n;
  /** @type {BigInt} */
  const PRIME_MX2 = 0x9FB21C651E98DF25n;

  // Layout constants from the reference implementation
  /** @type {int32} */
  const SECRET_DEFAULT_SIZE = 192;
  /** @type {int32} */
  const SECRET_SIZE_MIN = 136;
  /** @type {int32} */
  const MIDSIZE_MAX = 240;
  /** @type {int32} */
  const MIDSIZE_STARTOFFSET = 3;
  /** @type {int32} */
  const MIDSIZE_LASTOFFSET = 17;
  /** @type {int32} */
  const STRIPE_LEN = 64;
  /** @type {int32} */
  const SECRET_CONSUME_RATE = 8;
  /** @type {int32} */
  const ACC_NB = 8;
  /** @type {int32} */
  const SECRET_MERGEACCS_START = 11;
  /** @type {int32} */
  const SECRET_LASTACC_START = 7;

  // The official 192-byte default secret (never written to)
  /** @type {uint8[]} */
  const K_SECRET = [
    0xb8, 0xfe, 0x6c, 0x39, 0x23, 0xa4, 0x4b, 0xbe, 0x7c, 0x01, 0x81, 0x2c, 0xf7, 0x21, 0xad, 0x1c,
    0xde, 0xd4, 0x6d, 0xe9, 0x83, 0x90, 0x97, 0xdb, 0x72, 0x40, 0xa4, 0xa4, 0xb7, 0xb3, 0x67, 0x1f,
    0xcb, 0x79, 0xe6, 0x4e, 0xcc, 0xc0, 0xe5, 0x78, 0x82, 0x5a, 0xd0, 0x7d, 0xcc, 0xff, 0x72, 0x21,
    0xb8, 0x08, 0x46, 0x74, 0xf7, 0x43, 0x24, 0x8e, 0xe0, 0x35, 0x90, 0xe6, 0x81, 0x3a, 0x26, 0x4c,
    0x3c, 0x28, 0x52, 0xbb, 0x91, 0xc3, 0x00, 0xcb, 0x88, 0xd0, 0x65, 0x8b, 0x1b, 0x53, 0x2e, 0xa3,
    0x71, 0x64, 0x48, 0x97, 0xa2, 0x0d, 0xf9, 0x4e, 0x38, 0x19, 0xef, 0x46, 0xa9, 0xde, 0xac, 0xd8,
    0xa8, 0xfa, 0x76, 0x3f, 0xe3, 0x9c, 0x34, 0x3f, 0xf9, 0xdc, 0xbb, 0xc7, 0xc7, 0x0b, 0x4f, 0x1d,
    0x8a, 0x51, 0xe0, 0x4b, 0xcd, 0xb4, 0x59, 0x31, 0xc8, 0x9f, 0x7e, 0xc9, 0xd9, 0x78, 0x73, 0x64,
    0xea, 0xc5, 0xac, 0x83, 0x34, 0xd3, 0xeb, 0xc3, 0xc5, 0x81, 0xa0, 0xff, 0xfa, 0x13, 0x63, 0xeb,
    0x17, 0x0d, 0xdd, 0x51, 0xb7, 0xf0, 0xda, 0x49, 0xd3, 0x16, 0x55, 0x26, 0x29, 0xd4, 0x68, 0x9e,
    0x2b, 0x16, 0xbe, 0x58, 0x7d, 0x47, 0xa1, 0xfc, 0x8f, 0xf8, 0xb8, 0xd1, 0x7a, 0xd0, 0x31, 0xce,
    0x45, 0xcb, 0x3a, 0x8f, 0x95, 0x16, 0x04, 0x28, 0xaf, 0xd7, 0xfb, 0xca, 0xbb, 0x4b, 0x40, 0x7e
  ];

  // ===== 64-bit helpers (BigInt) =====
  // 128-bit values (products and the 128-bit hash) are BigInt pairs [lo, hi].

  /**
   * Reduce to 64 bits
   * @param {BigInt} v - Any BigInt
   * @returns {BigInt} v mod 2^64
   */
  function m64(v) {
    return OpCodes.AndN(v, MASK64);
  }

  /**
   * Reduce to 32 bits
   * @param {BigInt} v - Any BigInt
   * @returns {BigInt} v mod 2^32
   */
  function m32(v) {
    return OpCodes.AndN(v, MASK32);
  }

  /**
   * 64-bit wrapping multiplication
   * @param {BigInt} a - Factor
   * @param {BigInt} b - Factor
   * @returns {BigInt} a * b mod 2^64
   */
  function mul64(a, b) {
    return m64(a * b);
  }

  /**
   * Little-endian 32-bit read
   * @param {uint8[]} arr - Source bytes
   * @param {int32} off - Index of the first byte
   * @returns {BigInt} The word
   */
  function readLE32(arr, off) {
    return OpCodes.OrN(
      OpCodes.OrN(BigInt(arr[off]), OpCodes.ShiftLn(BigInt(arr[off + 1]), 8)),
      OpCodes.OrN(OpCodes.ShiftLn(BigInt(arr[off + 2]), 16), OpCodes.ShiftLn(BigInt(arr[off + 3]), 24))
    );
  }

  /**
   * Little-endian 64-bit read
   * @param {uint8[]} arr - Source bytes
   * @param {int32} off - Index of the first byte
   * @returns {BigInt} The word
   */
  function readLE64(arr, off) {
    return OpCodes.OrN(readLE32(arr, off), OpCodes.ShiftLn(readLE32(arr, off + 4), 32));
  }

  /**
   * Little-endian 64-bit write
   * @param {uint8[]} arr - Destination bytes
   * @param {int32} off - Index of the first byte
   * @param {BigInt} value - The word
   * @returns {void}
   */
  function writeLE64(arr, off, value) {
    for (let i = 0; i < 8; i++) {
      /** @type {uint8} */
      const b = Number(OpCodes.AndN(OpCodes.ShiftRn(value, i * 8), 0xFFn));
      arr[off + i] = b;
    }
  }

  /**
   * Byte-swap a 32-bit value
   * @param {BigInt} v - Value (reduced to 32 bits first)
   * @returns {BigInt} Swapped value
   */
  function swap32(v) {
    v = m32(v);
    return m32(OpCodes.OrN(
      OpCodes.OrN(OpCodes.ShiftLn(v, 24), OpCodes.ShiftLn(OpCodes.AndN(v, 0xFF00n), 8)),
      OpCodes.OrN(OpCodes.AndN(OpCodes.ShiftRn(v, 8), 0xFF00n), OpCodes.ShiftRn(v, 24))
    ));
  }

  /**
   * Byte-swap a 64-bit value
   * @param {BigInt} v - Value (reduced to 64 bits first)
   * @returns {BigInt} Swapped value
   */
  function swap64(v) {
    v = m64(v);
    /** @type {BigInt} */
    let r = 0n;
    for (let i = 0; i < 8; i++) {
      r = OpCodes.OrN(OpCodes.ShiftLn(r, 8), OpCodes.AndN(v, 0xFFn));
      v = OpCodes.ShiftRn(v, 8);
    }
    return r;
  }

  /**
   * v ^ (v >> shift) on 64 bits
   * @param {BigInt} v - Value
   * @param {int32} shift - Shift count
   * @returns {BigInt} Mixed value
   */
  function xorshift64(v, shift) {
    v = m64(v);
    return m64(OpCodes.XorN(v, OpCodes.ShiftRn(v, shift)));
  }

  /**
   * 64x64 -> 128 multiply
   * @param {BigInt} a - Factor
   * @param {BigInt} b - Factor
   * @returns {BigInt[]} Product as [lo, hi]
   */
  function mult64to128(a, b) {
    const product = m64(a) * m64(b);
    /** @type {BigInt[]} */
    const p = [m64(product), m64(OpCodes.ShiftRn(product, 64))];
    return p;
  }

  /**
   * 128-bit product folded to 64 bits
   * @param {BigInt} a - Factor
   * @param {BigInt} b - Factor
   * @returns {BigInt} lo ^ hi of the product
   */
  function mul128Fold64(a, b) {
    const p = mult64to128(a, b);
    return m64(OpCodes.XorN(p[0], p[1]));
  }

  /**
   * 32x32 -> 64 multiply of the low halves
   * @param {BigInt} a - Factor (low 32 bits used)
   * @param {BigInt} b - Factor (low 32 bits used)
   * @returns {BigInt} Product
   */
  function mult32to64(a, b) {
    return m64(m32(a) * m32(b));
  }

  /**
   * XXH64 avalanche
   * @param {BigInt} h - Value
   * @returns {BigInt} Mixed value
   */
  function xxh64Avalanche(h) {
    h = m64(h);
    h = m64(OpCodes.XorN(h, OpCodes.ShiftRn(h, 33)));
    h = mul64(h, PRIME64_2);
    h = m64(OpCodes.XorN(h, OpCodes.ShiftRn(h, 29)));
    h = mul64(h, PRIME64_3);
    h = m64(OpCodes.XorN(h, OpCodes.ShiftRn(h, 32)));
    return h;
  }

  /**
   * XXH3 avalanche
   * @param {BigInt} h - Value
   * @returns {BigInt} Mixed value
   */
  function xxh3Avalanche(h) {
    h = xorshift64(h, 37);
    h = mul64(h, PRIME_MX1);
    h = xorshift64(h, 32);
    return h;
  }

  /**
   * Stronger finalizer for 4..8 byte inputs, inspired by Pelle Evensen's rrmxmx
   * @param {BigInt} h - Value
   * @param {int32} len - Input length
   * @returns {BigInt} Mixed value
   */
  function rrmxmx(h, len) {
    h = m64(OpCodes.XorN(OpCodes.XorN(h, OpCodes.RotL64n(h, 49)), OpCodes.RotL64n(h, 24)));
    h = mul64(h, PRIME_MX2);
    h = m64(OpCodes.XorN(h, m64(OpCodes.ShiftRn(h, 35) + BigInt(len))));
    h = mul64(h, PRIME_MX2);
    return xorshift64(h, 28);
  }

  // ===== 64-bit length-dependent paths =====

  /**
   * XXH3-64 for 1..3 bytes
   * @param {uint8[]} input - Message bytes
   * @param {int32} off - Start of the message
   * @param {int32} len - Message length
   * @param {uint8[]} secret - Secret bytes
   * @param {BigInt} seed - 64-bit seed
   * @returns {BigInt} Hash
   */
  function len1to3_64(input, off, len, secret, seed) {
    /** @type {int32} */
    const half = OpCodes.Shr32(len, 1);
    const c1 = BigInt(input[off]);
    const c2 = BigInt(input[off + half]);
    const c3 = BigInt(input[off + len - 1]);
    const combined = m32(OpCodes.OrN(
      OpCodes.OrN(OpCodes.ShiftLn(c1, 16), OpCodes.ShiftLn(c2, 24)),
      OpCodes.OrN(c3, OpCodes.ShiftLn(BigInt(len), 8))
    ));
    const bitflip = m64(m64(OpCodes.XorN(readLE32(secret, 0), readLE32(secret, 4))) + seed);
    return xxh64Avalanche(OpCodes.XorN(combined, bitflip));
  }

  /**
   * XXH3-64 for 4..8 bytes
   * @param {uint8[]} input - Message bytes
   * @param {int32} off - Start of the message
   * @param {int32} len - Message length
   * @param {uint8[]} secret - Secret bytes
   * @param {BigInt} seed - 64-bit seed
   * @returns {BigInt} Hash
   */
  function len4to8_64(input, off, len, secret, seed) {
    seed = m64(OpCodes.XorN(seed, OpCodes.ShiftLn(swap32(m32(seed)), 32)));
    const input1 = readLE32(input, off);
    const input2 = readLE32(input, off + len - 4);
    const bitflip = m64(m64(OpCodes.XorN(readLE64(secret, 8), readLE64(secret, 16))) - seed);
    const input64 = m64(input2 + OpCodes.ShiftLn(input1, 32));
    return rrmxmx(OpCodes.XorN(input64, bitflip), len);
  }

  /**
   * XXH3-64 for 9..16 bytes
   * @param {uint8[]} input - Message bytes
   * @param {int32} off - Start of the message
   * @param {int32} len - Message length
   * @param {uint8[]} secret - Secret bytes
   * @param {BigInt} seed - 64-bit seed
   * @returns {BigInt} Hash
   */
  function len9to16_64(input, off, len, secret, seed) {
    const bitflip1 = m64(m64(OpCodes.XorN(readLE64(secret, 24), readLE64(secret, 32))) + seed);
    const bitflip2 = m64(m64(OpCodes.XorN(readLE64(secret, 40), readLE64(secret, 48))) - seed);
    const inputLo = m64(OpCodes.XorN(readLE64(input, off), bitflip1));
    const inputHi = m64(OpCodes.XorN(readLE64(input, off + len - 8), bitflip2));
    const acc = m64(BigInt(len) + swap64(inputLo) + inputHi + mul128Fold64(inputLo, inputHi));
    return xxh3Avalanche(acc);
  }

  /**
   * XXH3-64 for 0..16 bytes
   * @param {uint8[]} input - Message bytes
   * @param {int32} off - Start of the message
   * @param {int32} len - Message length
   * @param {uint8[]} secret - Secret bytes
   * @param {BigInt} seed - 64-bit seed
   * @returns {BigInt} Hash
   */
  function len0to16_64(input, off, len, secret, seed) {
    if (len > 8) return len9to16_64(input, off, len, secret, seed);
    if (len >= 4) return len4to8_64(input, off, len, secret, seed);
    if (len > 0) return len1to3_64(input, off, len, secret, seed);
    return xxh64Avalanche(OpCodes.XorN(seed, m64(OpCodes.XorN(readLE64(secret, 56), readLE64(secret, 64)))));
  }

  /**
   * Mix 16 input bytes with 16 secret bytes
   * @param {uint8[]} input - Message bytes
   * @param {int32} inOff - Input offset
   * @param {uint8[]} secret - Secret bytes
   * @param {int32} secOff - Secret offset
   * @param {BigInt} seed - 64-bit seed
   * @returns {BigInt} Mixed value
   */
  function mix16B(input, inOff, secret, secOff, seed) {
    const inputLo = readLE64(input, inOff);
    const inputHi = readLE64(input, inOff + 8);
    return mul128Fold64(
      OpCodes.XorN(inputLo, m64(readLE64(secret, secOff) + seed)),
      OpCodes.XorN(inputHi, m64(readLE64(secret, secOff + 8) - seed))
    );
  }

  /**
   * XXH3-64 for 17..128 bytes
   * @param {uint8[]} input - Message bytes
   * @param {int32} off - Start of the message
   * @param {int32} len - Message length
   * @param {uint8[]} secret - Secret bytes
   * @param {BigInt} seed - 64-bit seed
   * @returns {BigInt} Hash
   */
  function len17to128_64(input, off, len, secret, seed) {
    let acc = mul64(BigInt(len), PRIME64_1);
    if (len > 32) {
      if (len > 64) {
        if (len > 96) {
          acc = m64(acc + mix16B(input, off + 48, secret, 96, seed));
          acc = m64(acc + mix16B(input, off + len - 64, secret, 112, seed));
        }
        acc = m64(acc + mix16B(input, off + 32, secret, 64, seed));
        acc = m64(acc + mix16B(input, off + len - 48, secret, 80, seed));
      }
      acc = m64(acc + mix16B(input, off + 16, secret, 32, seed));
      acc = m64(acc + mix16B(input, off + len - 32, secret, 48, seed));
    }
    acc = m64(acc + mix16B(input, off, secret, 0, seed));
    acc = m64(acc + mix16B(input, off + len - 16, secret, 16, seed));
    return xxh3Avalanche(acc);
  }

  /**
   * XXH3-64 for 129..240 bytes
   * @param {uint8[]} input - Message bytes
   * @param {int32} off - Start of the message
   * @param {int32} len - Message length
   * @param {uint8[]} secret - Secret bytes
   * @param {BigInt} seed - 64-bit seed
   * @returns {BigInt} Hash
   */
  function len129to240_64(input, off, len, secret, seed) {
    let acc = mul64(BigInt(len), PRIME64_1);
    const nbRounds = Math.floor(len / 16);
    for (let i = 0; i < 8; i++) {
      acc = m64(acc + mix16B(input, off + 16 * i, secret, 16 * i, seed));
    }
    let accEnd = mix16B(input, off + len - 16, secret, SECRET_SIZE_MIN - MIDSIZE_LASTOFFSET, seed);
    acc = xxh3Avalanche(acc);
    for (let i = 8; i < nbRounds; i++) {
      accEnd = m64(accEnd + mix16B(input, off + 16 * i, secret, 16 * (i - 8) + MIDSIZE_STARTOFFSET, seed));
    }
    return xxh3Avalanche(m64(acc + accEnd));
  }

  // ===== Long-input accumulate / scramble loop =====

  /**
   * Accumulate one 64-byte stripe
   * @param {BigInt[]} acc - Eight accumulators, updated in place
   * @param {uint8[]} input - Message bytes
   * @param {int32} inOff - Stripe offset
   * @param {uint8[]} secret - Secret bytes
   * @param {int32} secOff - Secret offset
   * @returns {void}
   */
  function accumulate512(acc, input, inOff, secret, secOff) {
    for (let lane = 0; lane < ACC_NB; lane++) {
      const dataVal = readLE64(input, inOff + lane * 8);
      const dataKey = OpCodes.XorN(dataVal, readLE64(secret, secOff + lane * 8));
      // Adjacent lanes are swapped when the raw data word is added
      const other = OpCodes.Xor32(lane, 1);
      acc[other] = m64(acc[other] + dataVal);
      acc[lane] = m64(acc[lane] + mult32to64(dataKey, OpCodes.ShiftRn(dataKey, 32)));
    }
  }

  /**
   * Accumulate consecutive stripes
   * @param {BigInt[]} acc - Eight accumulators, updated in place
   * @param {uint8[]} input - Message bytes
   * @param {int32} inOff - First stripe offset
   * @param {uint8[]} secret - Secret bytes
   * @param {int32} secOff - Secret offset
   * @param {int32} nbStripes - Number of stripes
   * @returns {void}
   */
  function accumulate(acc, input, inOff, secret, secOff, nbStripes) {
    for (let n = 0; n < nbStripes; n++) {
      accumulate512(acc, input, inOff + n * STRIPE_LEN, secret, secOff + n * SECRET_CONSUME_RATE);
    }
  }

  /**
   * Scramble the accumulators
   * @param {BigInt[]} acc - Eight accumulators, updated in place
   * @param {uint8[]} secret - Secret bytes
   * @param {int32} secOff - Secret offset
   * @returns {void}
   */
  function scrambleAcc(acc, secret, secOff) {
    for (let lane = 0; lane < ACC_NB; lane++) {
      const key64 = readLE64(secret, secOff + lane * 8);
      let acc64 = xorshift64(acc[lane], 47);
      acc64 = OpCodes.XorN(acc64, key64);
      acc[lane] = mul64(acc64, PRIME32_1);
    }
  }

  /**
   * Long-input block loop
   * @param {BigInt[]} acc - Eight accumulators, updated in place
   * @param {uint8[]} input - Message bytes
   * @param {int32} len - Message length
   * @param {uint8[]} secret - Secret bytes
   * @param {int32} secretSize - Secret length
   * @returns {void}
   */
  function hashLongLoop(acc, input, len, secret, secretSize) {
    const nbStripesPerBlock = Math.floor((secretSize - STRIPE_LEN) / SECRET_CONSUME_RATE);
    const blockLen = STRIPE_LEN * nbStripesPerBlock;
    const nbBlocks = Math.floor((len - 1) / blockLen);

    for (let n = 0; n < nbBlocks; n++) {
      accumulate(acc, input, n * blockLen, secret, 0, nbStripesPerBlock);
      scrambleAcc(acc, secret, secretSize - STRIPE_LEN);
    }

    // Last partial block
    const nbStripes = Math.floor(((len - 1) - (blockLen * nbBlocks)) / STRIPE_LEN);
    accumulate(acc, input, nbBlocks * blockLen, secret, 0, nbStripes);

    // Last stripe, always taken from the very end of the input
    accumulate512(acc, input, len - STRIPE_LEN, secret, secretSize - STRIPE_LEN - SECRET_LASTACC_START);
  }

  /**
   * Mix two accumulators with the secret
   * @param {BigInt[]} acc - Accumulators
   * @param {int32} accOff - Index of the first accumulator
   * @param {uint8[]} secret - Secret bytes
   * @param {int32} secOff - Secret offset
   * @returns {BigInt} Mixed value
   */
  function mix2Accs(acc, accOff, secret, secOff) {
    return mul128Fold64(
      OpCodes.XorN(acc[accOff], readLE64(secret, secOff)),
      OpCodes.XorN(acc[accOff + 1], readLE64(secret, secOff + 8))
    );
  }

  /**
   * Merge the eight accumulators into one 64-bit value
   * @param {BigInt[]} acc - Accumulators
   * @param {uint8[]} secret - Secret bytes
   * @param {int32} secOff - Secret offset
   * @param {BigInt} start - Starting value
   * @returns {BigInt} Merged hash
   */
  function mergeAccs(acc, secret, secOff, start) {
    let result = m64(start);
    for (let i = 0; i < 4; i++) {
      result = m64(result + mix2Accs(acc, 2 * i, secret, secOff + 16 * i));
    }
    return xxh3Avalanche(result);
  }

  /**
   * Initial accumulator values
   * @returns {BigInt[]} Eight accumulators
   */
  function initAcc() {
    /** @type {BigInt[]} */
    const acc = [PRIME32_3, PRIME64_1, PRIME64_2, PRIME64_3, PRIME64_4, PRIME32_2, PRIME64_5, PRIME32_1];
    return acc;
  }

  /**
   * Seeded long inputs derive their own secret from the default one
   * @param {BigInt} seed - 64-bit seed
   * @returns {uint8[]} Derived secret
   */
  function initCustomSecret(seed) {
    /** @type {uint8[]} */
    const secret = new Array(SECRET_DEFAULT_SIZE);
    const nbRounds = SECRET_DEFAULT_SIZE / 16;
    for (let i = 0; i < nbRounds; i++) {
      writeLE64(secret, 16 * i, m64(readLE64(K_SECRET, 16 * i) + seed));
      writeLE64(secret, 16 * i + 8, m64(readLE64(K_SECRET, 16 * i + 8) - seed));
    }
    return secret;
  }

  /**
   * Secret for the long-input path
   * @param {BigInt} seed - 64-bit seed
   * @returns {uint8[]} The default secret for seed 0, otherwise a derived one
   */
  function longSecret(seed) {
    if (seed === 0n) return K_SECRET;
    return initCustomSecret(seed);
  }

  /**
   * XXH3-64 for more than 240 bytes
   * @param {uint8[]} input - Message bytes
   * @param {int32} len - Message length
   * @param {uint8[]} secret - Secret bytes
   * @param {int32} secretSize - Secret length
   * @returns {BigInt} Hash
   */
  function hashLong64(input, len, secret, secretSize) {
    const acc = initAcc();
    hashLongLoop(acc, input, len, secret, secretSize);
    return mergeAccs(acc, secret, SECRET_MERGEACCS_START, mul64(BigInt(len), PRIME64_1));
  }

  /**
   * XXH3_64bits_withSeed
   * @param {uint8[]} input - Message bytes
   * @param {BigInt} seed - Seed
   * @returns {BigInt} 64-bit hash
   */
  function xxh3_64bits(input, seed) {
    seed = m64(seed);
    const len = input.length;
    if (len <= 16) return len0to16_64(input, 0, len, K_SECRET, seed);
    if (len <= 128) return len17to128_64(input, 0, len, K_SECRET, seed);
    if (len <= MIDSIZE_MAX) return len129to240_64(input, 0, len, K_SECRET, seed);
    return hashLong64(input, len, longSecret(seed), SECRET_DEFAULT_SIZE);
  }

  // ===== 128-bit length-dependent paths =====
  // Every 128-bit result and accumulator is a BigInt pair [lo, hi].

  /**
   * XXH3-128 for 1..3 bytes
   * @param {uint8[]} input - Message bytes
   * @param {int32} off - Start of the message
   * @param {int32} len - Message length
   * @param {uint8[]} secret - Secret bytes
   * @param {BigInt} seed - 64-bit seed
   * @returns {BigInt[]} Hash as [lo, hi]
   */
  function len1to3_128(input, off, len, secret, seed) {
    /** @type {int32} */
    const half = OpCodes.Shr32(len, 1);
    const c1 = BigInt(input[off]);
    const c2 = BigInt(input[off + half]);
    const c3 = BigInt(input[off + len - 1]);
    const combinedLo = m32(OpCodes.OrN(
      OpCodes.OrN(OpCodes.ShiftLn(c1, 16), OpCodes.ShiftLn(c2, 24)),
      OpCodes.OrN(c3, OpCodes.ShiftLn(BigInt(len), 8))
    ));
    const swapped = swap32(combinedLo);
    const combinedHi = m32(OpCodes.OrN(OpCodes.ShiftLn(swapped, 13), OpCodes.ShiftRn(swapped, 19)));
    const bitflipLo = m64(m64(OpCodes.XorN(readLE32(secret, 0), readLE32(secret, 4))) + seed);
    const bitflipHi = m64(m64(OpCodes.XorN(readLE32(secret, 8), readLE32(secret, 12))) - seed);
    /** @type {BigInt[]} */
    const h = [
      xxh64Avalanche(OpCodes.XorN(combinedLo, bitflipLo)),
      xxh64Avalanche(OpCodes.XorN(combinedHi, bitflipHi))
    ];
    return h;
  }

  /**
   * XXH3-128 for 4..8 bytes
   * @param {uint8[]} input - Message bytes
   * @param {int32} off - Start of the message
   * @param {int32} len - Message length
   * @param {uint8[]} secret - Secret bytes
   * @param {BigInt} seed - 64-bit seed
   * @returns {BigInt[]} Hash as [lo, hi]
   */
  function len4to8_128(input, off, len, secret, seed) {
    seed = m64(OpCodes.XorN(seed, OpCodes.ShiftLn(swap32(m32(seed)), 32)));
    const inputLo = readLE32(input, off);
    const inputHi = readLE32(input, off + len - 4);
    const input64 = m64(inputLo + OpCodes.ShiftLn(inputHi, 32));
    const bitflip = m64(m64(OpCodes.XorN(readLE64(secret, 16), readLE64(secret, 24))) + seed);
    const keyed = OpCodes.XorN(input64, bitflip);

    // Shifting len left keeps the multiplier even, which avoids even multiplies
    const m128 = mult64to128(keyed, m64(PRIME64_1 + OpCodes.ShiftLn(BigInt(len), 2)));
    m128[1] = m64(m128[1] + m64(OpCodes.ShiftLn(m128[0], 1)));
    m128[0] = m64(OpCodes.XorN(m128[0], OpCodes.ShiftRn(m128[1], 3)));
    m128[0] = xorshift64(m128[0], 35);
    m128[0] = mul64(m128[0], PRIME_MX2);
    m128[0] = xorshift64(m128[0], 28);
    m128[1] = xxh3Avalanche(m128[1]);
    return m128;
  }

  /**
   * XXH3-128 for 9..16 bytes
   * @param {uint8[]} input - Message bytes
   * @param {int32} off - Start of the message
   * @param {int32} len - Message length
   * @param {uint8[]} secret - Secret bytes
   * @param {BigInt} seed - 64-bit seed
   * @returns {BigInt[]} Hash as [lo, hi]
   */
  function len9to16_128(input, off, len, secret, seed) {
    const bitflipLo = m64(m64(OpCodes.XorN(readLE64(secret, 32), readLE64(secret, 40))) - seed);
    const bitflipHi = m64(m64(OpCodes.XorN(readLE64(secret, 48), readLE64(secret, 56))) + seed);
    const inputLo = readLE64(input, off);
    let inputHi = readLE64(input, off + len - 8);

    const m128 = mult64to128(OpCodes.XorN(OpCodes.XorN(inputLo, inputHi), bitflipLo), PRIME64_1);
    // Put len in the middle of m128 so it reaches both halves of the 128x64 multiply
    m128[0] = m64(m128[0] + OpCodes.ShiftLn(BigInt(len - 1), 54));
    inputHi = OpCodes.XorN(inputHi, bitflipHi);
    m128[1] = m64(m128[1] + inputHi + mult32to64(m32(inputHi), PRIME32_2 - 1n));
    m128[0] = m64(OpCodes.XorN(m128[0], swap64(m128[1])));

    const h128 = mult64to128(m128[0], PRIME64_2);
    h128[1] = m64(h128[1] + mul64(m128[1], PRIME64_2));
    /** @type {BigInt[]} */
    const h = [xxh3Avalanche(h128[0]), xxh3Avalanche(h128[1])];
    return h;
  }

  /**
   * XXH3-128 for 0..16 bytes
   * @param {uint8[]} input - Message bytes
   * @param {int32} off - Start of the message
   * @param {int32} len - Message length
   * @param {uint8[]} secret - Secret bytes
   * @param {BigInt} seed - 64-bit seed
   * @returns {BigInt[]} Hash as [lo, hi]
   */
  function len0to16_128(input, off, len, secret, seed) {
    if (len > 8) return len9to16_128(input, off, len, secret, seed);
    if (len >= 4) return len4to8_128(input, off, len, secret, seed);
    if (len > 0) return len1to3_128(input, off, len, secret, seed);
    const bitflipLo = m64(OpCodes.XorN(readLE64(secret, 64), readLE64(secret, 72)));
    const bitflipHi = m64(OpCodes.XorN(readLE64(secret, 80), readLE64(secret, 88)));
    /** @type {BigInt[]} */
    const h = [
      xxh64Avalanche(OpCodes.XorN(seed, bitflipLo)),
      xxh64Avalanche(OpCodes.XorN(seed, bitflipHi))
    ];
    return h;
  }

  /**
   * Mix 32 input bytes into a 128-bit accumulator
   * @param {BigInt[]} acc - Accumulator [lo, hi], updated in place
   * @param {uint8[]} input - Message bytes
   * @param {int32} off1 - First 16-byte block
   * @param {int32} off2 - Second 16-byte block
   * @param {uint8[]} secret - Secret bytes
   * @param {int32} secOff - Secret offset
   * @param {BigInt} seed - 64-bit seed
   * @returns {BigInt[]} The same accumulator
   */
  function mix32B(acc, input, off1, off2, secret, secOff, seed) {
    acc[0] = m64(acc[0] + mix16B(input, off1, secret, secOff, seed));
    acc[0] = m64(OpCodes.XorN(acc[0], m64(readLE64(input, off2) + readLE64(input, off2 + 8))));
    acc[1] = m64(acc[1] + mix16B(input, off2, secret, secOff + 16, seed));
    acc[1] = m64(OpCodes.XorN(acc[1], m64(readLE64(input, off1) + readLE64(input, off1 + 8))));
    return acc;
  }

  /**
   * Final mix of the mid-size 128-bit paths
   * @param {BigInt[]} acc - Accumulator [lo, hi]
   * @param {int32} len - Message length
   * @param {BigInt} seed - 64-bit seed
   * @returns {BigInt[]} Hash as [lo, hi]
   */
  function finish128(acc, len, seed) {
    let lo = m64(acc[0] + acc[1]);
    let hi = m64(mul64(acc[0], PRIME64_1) + mul64(acc[1], PRIME64_4) + mul64(m64(BigInt(len) - seed), PRIME64_2));
    lo = xxh3Avalanche(lo);
    hi = m64(0n - xxh3Avalanche(hi));
    /** @type {BigInt[]} */
    const h = [lo, hi];
    return h;
  }

  /**
   * XXH3-128 for 17..128 bytes
   * @param {uint8[]} input - Message bytes
   * @param {int32} off - Start of the message
   * @param {int32} len - Message length
   * @param {uint8[]} secret - Secret bytes
   * @param {BigInt} seed - 64-bit seed
   * @returns {BigInt[]} Hash as [lo, hi]
   */
  function len17to128_128(input, off, len, secret, seed) {
    /** @type {BigInt[]} */
    let acc = [mul64(BigInt(len), PRIME64_1), 0n];
    if (len > 32) {
      if (len > 64) {
        if (len > 96) acc = mix32B(acc, input, off + 48, off + len - 64, secret, 96, seed);
        acc = mix32B(acc, input, off + 32, off + len - 48, secret, 64, seed);
      }
      acc = mix32B(acc, input, off + 16, off + len - 32, secret, 32, seed);
    }
    acc = mix32B(acc, input, off, off + len - 16, secret, 0, seed);
    return finish128(acc, len, seed);
  }

  /**
   * XXH3-128 for 129..240 bytes
   * @param {uint8[]} input - Message bytes
   * @param {int32} off - Start of the message
   * @param {int32} len - Message length
   * @param {uint8[]} secret - Secret bytes
   * @param {BigInt} seed - 64-bit seed
   * @returns {BigInt[]} Hash as [lo, hi]
   */
  function len129to240_128(input, off, len, secret, seed) {
    /** @type {BigInt[]} */
    let acc = [mul64(BigInt(len), PRIME64_1), 0n];
    /** @type {int32} */
    let i;
    for (i = 32; i < 160; i += 32) {
      acc = mix32B(acc, input, off + i - 32, off + i - 16, secret, i - 32, seed);
    }
    acc[0] = xxh3Avalanche(acc[0]);
    acc[1] = xxh3Avalanche(acc[1]);
    // Note: i <= len duplicates the last 32 bytes when len is a multiple of 32.
    // That is required to keep the published results stable.
    for (i = 160; i <= len; i += 32) {
      acc = mix32B(acc, input, off + i - 32, off + i - 16, secret, MIDSIZE_STARTOFFSET + i - 160, seed);
    }
    acc = mix32B(acc, input, off + len - 16, off + len - 32,
      secret, SECRET_SIZE_MIN - MIDSIZE_LASTOFFSET - 16, m64(0n - seed));
    return finish128(acc, len, seed);
  }

  /**
   * XXH3-128 for more than 240 bytes
   * @param {uint8[]} input - Message bytes
   * @param {int32} len - Message length
   * @param {uint8[]} secret - Secret bytes
   * @param {int32} secretSize - Secret length
   * @returns {BigInt[]} Hash as [lo, hi]
   */
  function hashLong128(input, len, secret, secretSize) {
    const acc = initAcc();
    hashLongLoop(acc, input, len, secret, secretSize);
    const lo = mergeAccs(acc, secret, SECRET_MERGEACCS_START, mul64(BigInt(len), PRIME64_1));
    const hi = mergeAccs(acc, secret, secretSize - STRIPE_LEN - SECRET_MERGEACCS_START,
      m64(OpCodes.XorN(mul64(BigInt(len), PRIME64_2), MASK64)));
    /** @type {BigInt[]} */
    const h = [lo, hi];
    return h;
  }

  /**
   * XXH3_128bits_withSeed
   * @param {uint8[]} input - Message bytes
   * @param {BigInt} seed - Seed
   * @returns {BigInt[]} 128-bit hash as [lo, hi]
   */
  function xxh3_128bits(input, seed) {
    seed = m64(seed);
    const len = input.length;
    if (len <= 16) return len0to16_128(input, 0, len, K_SECRET, seed);
    if (len <= 128) return len17to128_128(input, 0, len, K_SECRET, seed);
    if (len <= MIDSIZE_MAX) return len129to240_128(input, 0, len, K_SECRET, seed);
    return hashLong128(input, len, longSecret(seed), SECRET_DEFAULT_SIZE);
  }

  /**
 * XXHash3Algorithm - Fast non-cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class XXHash3Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "xxHash3";
      this.description = "Ultra-fast non-cryptographic hash function optimized for speed and quality. Latest generation of xxHash family with improved performance on small data and better distribution properties.";
      this.inventor = "Yann Collet";
      this.year = 2019;
      this.category = CategoryType.HASH;
      this.subCategory = "Fast Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.LOW;
      this.country = CountryCode.MULTI;

      // Hash-specific metadata
      this.SupportedOutputSizes = [new KeySize(8, 8, 1), new KeySize(16, 16, 1)]; // 64 and 128 bits

      // Performance and technical specifications
      this.blockSize = 64;  // 64-byte stripe in the long-input accumulate loop
      this.outputSize = 8;  // 64 bits = 8 bytes (default)

      // Documentation and references
      this.documentation = [
        new LinkItem("xxHash Official Website", "https://xxhash.com/"),
        new LinkItem("GitHub Repository", "https://github.com/Cyan4973/xxHash"),
        new LinkItem("Algorithm Documentation", "https://github.com/Cyan4973/xxHash/blob/dev/doc/xxhash_spec.md")
      ];

      this.references = [
        new LinkItem("Reference Implementation", "https://github.com/Cyan4973/xxHash/blob/dev/xxhash.h"),
        new LinkItem("Official sanity test vectors", "https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h"),
        new LinkItem("SMHasher Test Results", "https://github.com/rurban/smhasher")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Cryptographic Weakness",
          "Not designed for cryptographic use - vulnerable to deliberate collision attacks",
          "Use only for non-cryptographic applications like hash tables and checksums"
        )
      ];

      // Official test vectors from the xxHash sanity test suite.
      // tests/sanity_test.c builds a deterministic buffer of 4096+64+1 bytes
      // (byteGen starts at 2654435761, each byte is the top byte of byteGen, then
      // byteGen is multiplied by 11400714785074694797), and the tables in
      // tests/sanity_test_vectors.h give XXH3_64bits / XXH3_128bits over the first
      // N bytes of that buffer for several seeds. The inputs below are those exact
      // prefixes. Lengths cover both sides of every algorithm branch: 0/1/3 and 4
      // and 8/9 and 16/17 inside the short paths, 128/129 at the mid-size switch,
      // 240/241 at the long-input switch, and 1024/2048 for the block scrambling
      // loop (one block is 1024 bytes).
      // Digests are rendered big-endian; the 128-bit value is high half then low
      // half, matching the way xxhsum prints XXH128 results.
      const URI = "https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h";

      this.tests = [
        // ---- XXH3-64, default secret, seed = 0 ----
        {
          text: "XXH3-64 len=0, seed 0",
          uri: URI,
          input: OpCodes.Hex8ToBytes(""),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("2D06800538D394C2")
        },
        {
          text: "XXH3-64 len=1, seed 0",
          uri: URI,
          input: OpCodes.Hex8ToBytes("00"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("C44BDFF4074EECDB")
        },
        {
          text: "XXH3-64 len=3, seed 0",
          uri: URI,
          input: OpCodes.Hex8ToBytes("005292"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("54247382A8D6B94D")
        },
        {
          text: "XXH3-64 len=4, seed 0",
          uri: URI,
          input: OpCodes.Hex8ToBytes("0052929B"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("E5DC74BC51848A51")
        },
        {
          text: "XXH3-64 len=8, seed 0",
          uri: URI,
          input: OpCodes.Hex8ToBytes("0052929BB732A324"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("24CCC9ACAA9F65E4")
        },
        {
          text: "XXH3-64 len=9, seed 0",
          uri: URI,
          input: OpCodes.Hex8ToBytes("0052929BB732A3242D"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("14D5001C15DD3F2B")
        },
        {
          text: "XXH3-64 len=16, seed 0",
          uri: URI,
          input: OpCodes.Hex8ToBytes("0052929BB732A3242D00AF950EECB893"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("981B17D36C7498C9")
        },
        {
          text: "XXH3-64 len=17, seed 0",
          uri: URI,
          input: OpCodes.Hex8ToBytes("0052929BB732A3242D00AF950EECB893E3"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("796F5ACD3A60F862")
        },
        {
          text: "XXH3-64 len=128, seed 0",
          uri: URI,
          input: OpCodes.Hex8ToBytes(
          "0052929BB732A3242D00AF950EECB893E3DFEF93AAD6CD2A538B5C3F545A6FD5" +
          "59C0FFFC8F85B9331DAB74F7B6059327B07084B3677C9F76480072ED7B9817E8" +
          "DD485E0C0CCBD0653FADB28F11B06CE88DB0F186086159566C8E4E781363BDAB" +
          "9D327309EA712FD97A9D55F0CA8AD0E95E1A36B36B0FCA51EF8BA2C462ED0096"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("FCFF24126754D861")
        },
        {
          text: "XXH3-64 len=129, seed 0",
          uri: URI,
          input: OpCodes.Hex8ToBytes(
          "0052929BB732A3242D00AF950EECB893E3DFEF93AAD6CD2A538B5C3F545A6FD5" +
          "59C0FFFC8F85B9331DAB74F7B6059327B07084B3677C9F76480072ED7B9817E8" +
          "DD485E0C0CCBD0653FADB28F11B06CE88DB0F186086159566C8E4E781363BDAB" +
          "9D327309EA712FD97A9D55F0CA8AD0E95E1A36B36B0FCA51EF8BA2C462ED0096" +
          "F3"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("98F1B0A679A2CA29")
        },
        {
          text: "XXH3-64 len=240, seed 0",
          uri: URI,
          input: OpCodes.Hex8ToBytes(
          "0052929BB732A3242D00AF950EECB893E3DFEF93AAD6CD2A538B5C3F545A6FD5" +
          "59C0FFFC8F85B9331DAB74F7B6059327B07084B3677C9F76480072ED7B9817E8" +
          "DD485E0C0CCBD0653FADB28F11B06CE88DB0F186086159566C8E4E781363BDAB" +
          "9D327309EA712FD97A9D55F0CA8AD0E95E1A36B36B0FCA51EF8BA2C462ED0096" +
          "F33449EB0FD13B92A1A963DBAAED3DCFF10942CDF9B321A2EBF2C8F4E42F48D1" +
          "4B10F4C2EFECF84AB53874C3A4A6620EBFFD633741E386981AEB4CBA56036687" +
          "ED004559C18544B6C368F941A9EAF987E09F12D0D51454485D444051E338069A" +
          "4C3C0DEF6489F8A361EEE3C51C9368C8"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("81C3C2B67F568CCF")
        },
        {
          text: "XXH3-64 len=241, seed 0",
          uri: URI,
          input: OpCodes.Hex8ToBytes(
          "0052929BB732A3242D00AF950EECB893E3DFEF93AAD6CD2A538B5C3F545A6FD5" +
          "59C0FFFC8F85B9331DAB74F7B6059327B07084B3677C9F76480072ED7B9817E8" +
          "DD485E0C0CCBD0653FADB28F11B06CE88DB0F186086159566C8E4E781363BDAB" +
          "9D327309EA712FD97A9D55F0CA8AD0E95E1A36B36B0FCA51EF8BA2C462ED0096" +
          "F33449EB0FD13B92A1A963DBAAED3DCFF10942CDF9B321A2EBF2C8F4E42F48D1" +
          "4B10F4C2EFECF84AB53874C3A4A6620EBFFD633741E386981AEB4CBA56036687" +
          "ED004559C18544B6C368F941A9EAF987E09F12D0D51454485D444051E338069A" +
          "4C3C0DEF6489F8A361EEE3C51C9368C8E5"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("C5A639ECD2030E5E")
        },
        {
          text: "XXH3-64 len=1024, seed 0",
          uri: URI,
          input: OpCodes.Hex8ToBytes(
          "0052929BB732A3242D00AF950EECB893E3DFEF93AAD6CD2A538B5C3F545A6FD5" +
          "59C0FFFC8F85B9331DAB74F7B6059327B07084B3677C9F76480072ED7B9817E8" +
          "DD485E0C0CCBD0653FADB28F11B06CE88DB0F186086159566C8E4E781363BDAB" +
          "9D327309EA712FD97A9D55F0CA8AD0E95E1A36B36B0FCA51EF8BA2C462ED0096" +
          "F33449EB0FD13B92A1A963DBAAED3DCFF10942CDF9B321A2EBF2C8F4E42F48D1" +
          "4B10F4C2EFECF84AB53874C3A4A6620EBFFD633741E386981AEB4CBA56036687" +
          "ED004559C18544B6C368F941A9EAF987E09F12D0D51454485D444051E338069A" +
          "4C3C0DEF6489F8A361EEE3C51C9368C8E597D70998FF97A84CEAA479ABCD2CC8" +
          "9F1BF2F1CEE282503882AD8E9BB8B488818EB636D9A96548743CC9DBFCBBD82A" +
          "229EB424E2B267ABAA13E22A4DFC711C076291BDF8E2975D0C84FD6745671B09" +
          "9A4B20A2773095DA28B1863F9EF2E1DB10DF90F86D912F0678B3485BDFF6DBD8" +
          "7CA7AEA589404C027320F09FDD637995B103C47E6F2FE022F6D488E9666E9D35" +
          "19BD411B4F1ACFD578B00049F01F8F8DF614BCB5946DC45376A7A75391CF8DB6" +
          "166C397E362F06F2231E8E0FC886F476618EF66436FC8C27A1FA12CBFECE583F" +
          "8167886C7DC081E7F8C08E540EC9D9519D219035690A0BACA171444B9F45FE9D" +
          "981F1E1B776C5DF1FB7E2C64FE6B571968CDDDE4D009361A609962D707E64D09" +
          "86F78E9B2F42D983CBA5CAAD2262757F5B40EF1AAFEC48756B22B5C405004D2A" +
          "097D8B8D6EBB5CD4A6B2A10D24ACAF16F37F6EBAFD0D0791D263F1BB83DE4148" +
          "1B7431E2F33F19A750F24E5BAE206093D50C7EA5527798ECD52C0D52E75CAE04" +
          "84EFFBAECDB45CBAC8CE982BD0A3A2E6256EB9CC066AB27F56578B4CAA09214F" +
          "4AC3904BA9D00736CF54119E27E39F503F58C294D47188A7814ED78F1E5D21DD" +
          "C2016D5A1FD194B659885E377D176E8E1655107CCF70EAE75029A542E03028A0" +
          "1E3DD559B168737022D33D2A634613AEDB1E350598A1DD56F0E3DC62B1CC2591" +
          "22DB36FC998C813776D677F3ACF44C16A684FFDA1082FC1F4F73E87CF5A96829" +
          "B37FA47B1F2CA010ABA85D82ADF74EB7130C4D4EF53FA3938892EF424CFC95BF" +
          "D276C2928F86903B7B845F7B57C9B95AF823B3263D411EDE092BBDDC53138B19" +
          "9BA2F7F58C317390C5A1D3B943706C768EFE8FD306F59D84D075DAFDC074F24B" +
          "B42A776FD4BE4A472606F04D2C901CDE7E083828801606663BFC74E59C926F26" +
          "AD0E2505451F421FFEBA7EF6133BE520ACEBB0B22A31301A6CC0A6A2A5F24129" +
          "9E4819E225C4713A79DDBE1FCF634355761336BF3A3A70026000A7114E675D36" +
          "640FF0DF89C016C657D4701296C94F9BBAACC7572385E1A056F9511A2B18CFD6" +
          "A773EE01DEFD63EA25C7EA5473C72A71B3F6A52B7A9819254D77951405CF9D42"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("DD85C9B5C1109C5C")
        },
        {
          text: "XXH3-64 len=2048, seed 0",
          uri: URI,
          input: OpCodes.Hex8ToBytes(
          "0052929BB732A3242D00AF950EECB893E3DFEF93AAD6CD2A538B5C3F545A6FD5" +
          "59C0FFFC8F85B9331DAB74F7B6059327B07084B3677C9F76480072ED7B9817E8" +
          "DD485E0C0CCBD0653FADB28F11B06CE88DB0F186086159566C8E4E781363BDAB" +
          "9D327309EA712FD97A9D55F0CA8AD0E95E1A36B36B0FCA51EF8BA2C462ED0096" +
          "F33449EB0FD13B92A1A963DBAAED3DCFF10942CDF9B321A2EBF2C8F4E42F48D1" +
          "4B10F4C2EFECF84AB53874C3A4A6620EBFFD633741E386981AEB4CBA56036687" +
          "ED004559C18544B6C368F941A9EAF987E09F12D0D51454485D444051E338069A" +
          "4C3C0DEF6489F8A361EEE3C51C9368C8E597D70998FF97A84CEAA479ABCD2CC8" +
          "9F1BF2F1CEE282503882AD8E9BB8B488818EB636D9A96548743CC9DBFCBBD82A" +
          "229EB424E2B267ABAA13E22A4DFC711C076291BDF8E2975D0C84FD6745671B09" +
          "9A4B20A2773095DA28B1863F9EF2E1DB10DF90F86D912F0678B3485BDFF6DBD8" +
          "7CA7AEA589404C027320F09FDD637995B103C47E6F2FE022F6D488E9666E9D35" +
          "19BD411B4F1ACFD578B00049F01F8F8DF614BCB5946DC45376A7A75391CF8DB6" +
          "166C397E362F06F2231E8E0FC886F476618EF66436FC8C27A1FA12CBFECE583F" +
          "8167886C7DC081E7F8C08E540EC9D9519D219035690A0BACA171444B9F45FE9D" +
          "981F1E1B776C5DF1FB7E2C64FE6B571968CDDDE4D009361A609962D707E64D09" +
          "86F78E9B2F42D983CBA5CAAD2262757F5B40EF1AAFEC48756B22B5C405004D2A" +
          "097D8B8D6EBB5CD4A6B2A10D24ACAF16F37F6EBAFD0D0791D263F1BB83DE4148" +
          "1B7431E2F33F19A750F24E5BAE206093D50C7EA5527798ECD52C0D52E75CAE04" +
          "84EFFBAECDB45CBAC8CE982BD0A3A2E6256EB9CC066AB27F56578B4CAA09214F" +
          "4AC3904BA9D00736CF54119E27E39F503F58C294D47188A7814ED78F1E5D21DD" +
          "C2016D5A1FD194B659885E377D176E8E1655107CCF70EAE75029A542E03028A0" +
          "1E3DD559B168737022D33D2A634613AEDB1E350598A1DD56F0E3DC62B1CC2591" +
          "22DB36FC998C813776D677F3ACF44C16A684FFDA1082FC1F4F73E87CF5A96829" +
          "B37FA47B1F2CA010ABA85D82ADF74EB7130C4D4EF53FA3938892EF424CFC95BF" +
          "D276C2928F86903B7B845F7B57C9B95AF823B3263D411EDE092BBDDC53138B19" +
          "9BA2F7F58C317390C5A1D3B943706C768EFE8FD306F59D84D075DAFDC074F24B" +
          "B42A776FD4BE4A472606F04D2C901CDE7E083828801606663BFC74E59C926F26" +
          "AD0E2505451F421FFEBA7EF6133BE520ACEBB0B22A31301A6CC0A6A2A5F24129" +
          "9E4819E225C4713A79DDBE1FCF634355761336BF3A3A70026000A7114E675D36" +
          "640FF0DF89C016C657D4701296C94F9BBAACC7572385E1A056F9511A2B18CFD6" +
          "A773EE01DEFD63EA25C7EA5473C72A71B3F6A52B7A9819254D77951405CF9D42" +
          "F6544E4C77EC3648CC47AC94810D108850F7A2D8C1CA827BD7C42D092627FBE6" +
          "065EE7C61AD70AA64029C0E4211A91B19F4D007EDAAAE26DA8F51308DAEC116B" +
          "3396C89A7750E3426221CB8039E5F2F22820431816CF20C5C1650B93711C520B" +
          "41981EBA8507CE90FBDC9B9603C8CFBF4C0D8FAA40A096CD43A7B3A48AB29A0A" +
          "5E812D87B6990B0500E2732BBE8992D1DFE590A30F47D6966AE6558DB19630FF" +
          "3825F357F7BDCAE02EC36A4DF3EA5F14751D3FABDA08062B5934E38FDB9DFBC5" +
          "181663F17475DEBD527D867FFAF8A976F9CF383A7FB98EC2E70D4EB288DE12A3" +
          "B47907691CCCAE0F646D4C57AED99D835F109A33E23703AAA9BC92E9E11DFC64" +
          "81B926ECD2E10D69F66BFE022FA623138786E4FF702CE1C6111B92815068EFD9" +
          "23946D8B57CC99F339129A7CF872394360F16C5489A4D8EE7F9E1911B48B7275" +
          "AB0076FED358991439A34CEA606AFF7ED88EAB3FC54D0CB5C766083E6B39AF5B" +
          "11E34A100B2750CBC031DCB3047FC2310B0992A47E89D7A09870FED21B8C027D" +
          "8C948034364907FB973D369C89DDEF5590D2E5C907CB41E2F9E36BC43479180C" +
          "119C397379192347BB3008406509D7E0CE8C874187EE9A6FEDD150FACEB93EBF" +
          "7F2DCFC6F15ACFF65A930DEF663AB3A6856C54BF61AA380CFC9E97A9AEA84D23" +
          "A732B694759BDF8C602E6D28E9186E27E61D3538996B86DE70972E75CE6ADD5E" +
          "87F184F6E0F4DFD678A43378B3E62B45C51EBAEBAF434ED79E3AC25EF4BB3685" +
          "E2A0DDF30E311D396E70C7B7AB84A9C4941090BADBDC3517A1E0390E7984D4D5" +
          "61536AF2729D151B0995CC45A1B60CF02CE3DD789CB620558B83C1C78B8CEFD3" +
          "3E2CC21962A3527950A2CEFEA375B4C86462839D153B551416A17DD0D523F6A2" +
          "9EA4A659FD8B7A9A8E0C8C54580E4765E0FC0512AE82D35B741692F692FD876B" +
          "6F54AA6FDA98F21F1643BB17123127687A44C392E4EA9A5EEB369F38B503DB0B" +
          "CF8AD22560011F91493C881A5F05059819FFFE564C0A1C7A873A4994F81745E4" +
          "BD9279A5EC0A01CFFD871F0A0FD161DBB03A02953DA066A21F82D83D3A7ACFD9" +
          "F37943AAB6E27BABE872F474A9953C259A38A29894BA1F46AEF1888DB89CA84C" +
          "8CA08BF69C9C6A4450FC821A948056E97DA613FB9D38A56DD42E744253F07600" +
          "406F5362BA041389C5E3B5512D06D72037E0FBDC049441D11B44B495335760AA" +
          "B1EE556EFBC876B25439226151D24DCD74BC89A065A4954889938415B7A2E406" +
          "710F653B9ABC5338FB94B16BCDA96A7CC8890114DFD603FFA5EA071ABB8D720C" +
          "36F20564B6E4BE4315F3528594E9051B46C559A4C13C027C36D95EFFFE96E11C" +
          "AA567A14E4166F3D902BCD7157005D0EED2EFD793E7E008D6C4DAC4058EBCE9D" +
          "350A7F6F07F7ECBEC4B4C75DA6EBAE3C229D032EA8A68BCE62DD9E045D9E16C8"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("DD59E2C3A5F038E0")
        },

        // ---- XXH3-64, seeded ----
        {
          text: "XXH3-64 len=0, seed 0x9E3779B185EBCA8D",
          uri: URI,
          input: OpCodes.Hex8ToBytes(""),
          seed: "9E3779B185EBCA8D",
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("A8A6B918B2F0364A")
        },
        {
          text: "XXH3-64 len=1, seed 0x9E3779B185EBCA8D",
          uri: URI,
          input: OpCodes.Hex8ToBytes("00"),
          seed: "9E3779B185EBCA8D",
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("032BE332DD766EF8")
        },
        {
          text: "XXH3-64 len=17, seed 0x9E3779B185EBCA8D",
          uri: URI,
          input: OpCodes.Hex8ToBytes("0052929BB732A3242D00AF950EECB893E3"),
          seed: "9E3779B185EBCA8D",
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("F3EC5067F4306DB3")
        },
        {
          text: "XXH3-64 len=129, seed 0x9E3779B185EBCA8D",
          uri: URI,
          input: OpCodes.Hex8ToBytes(
          "0052929BB732A3242D00AF950EECB893E3DFEF93AAD6CD2A538B5C3F545A6FD5" +
          "59C0FFFC8F85B9331DAB74F7B6059327B07084B3677C9F76480072ED7B9817E8" +
          "DD485E0C0CCBD0653FADB28F11B06CE88DB0F186086159566C8E4E781363BDAB" +
          "9D327309EA712FD97A9D55F0CA8AD0E95E1A36B36B0FCA51EF8BA2C462ED0096" +
          "F3"),
          seed: "9E3779B185EBCA8D",
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("21FFFDBCA099C844")
        },
        {
          text: "XXH3-64 len=241, seed 0x9E3779B185EBCA8D",
          uri: URI,
          input: OpCodes.Hex8ToBytes(
          "0052929BB732A3242D00AF950EECB893E3DFEF93AAD6CD2A538B5C3F545A6FD5" +
          "59C0FFFC8F85B9331DAB74F7B6059327B07084B3677C9F76480072ED7B9817E8" +
          "DD485E0C0CCBD0653FADB28F11B06CE88DB0F186086159566C8E4E781363BDAB" +
          "9D327309EA712FD97A9D55F0CA8AD0E95E1A36B36B0FCA51EF8BA2C462ED0096" +
          "F33449EB0FD13B92A1A963DBAAED3DCFF10942CDF9B321A2EBF2C8F4E42F48D1" +
          "4B10F4C2EFECF84AB53874C3A4A6620EBFFD633741E386981AEB4CBA56036687" +
          "ED004559C18544B6C368F941A9EAF987E09F12D0D51454485D444051E338069A" +
          "4C3C0DEF6489F8A361EEE3C51C9368C8E5"),
          seed: "9E3779B185EBCA8D",
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("DDA9B0A161D4829A")
        },
        {
          text: "XXH3-64 len=2048, seed 0x9E3779B185EBCA8D",
          uri: URI,
          input: OpCodes.Hex8ToBytes(
          "0052929BB732A3242D00AF950EECB893E3DFEF93AAD6CD2A538B5C3F545A6FD5" +
          "59C0FFFC8F85B9331DAB74F7B6059327B07084B3677C9F76480072ED7B9817E8" +
          "DD485E0C0CCBD0653FADB28F11B06CE88DB0F186086159566C8E4E781363BDAB" +
          "9D327309EA712FD97A9D55F0CA8AD0E95E1A36B36B0FCA51EF8BA2C462ED0096" +
          "F33449EB0FD13B92A1A963DBAAED3DCFF10942CDF9B321A2EBF2C8F4E42F48D1" +
          "4B10F4C2EFECF84AB53874C3A4A6620EBFFD633741E386981AEB4CBA56036687" +
          "ED004559C18544B6C368F941A9EAF987E09F12D0D51454485D444051E338069A" +
          "4C3C0DEF6489F8A361EEE3C51C9368C8E597D70998FF97A84CEAA479ABCD2CC8" +
          "9F1BF2F1CEE282503882AD8E9BB8B488818EB636D9A96548743CC9DBFCBBD82A" +
          "229EB424E2B267ABAA13E22A4DFC711C076291BDF8E2975D0C84FD6745671B09" +
          "9A4B20A2773095DA28B1863F9EF2E1DB10DF90F86D912F0678B3485BDFF6DBD8" +
          "7CA7AEA589404C027320F09FDD637995B103C47E6F2FE022F6D488E9666E9D35" +
          "19BD411B4F1ACFD578B00049F01F8F8DF614BCB5946DC45376A7A75391CF8DB6" +
          "166C397E362F06F2231E8E0FC886F476618EF66436FC8C27A1FA12CBFECE583F" +
          "8167886C7DC081E7F8C08E540EC9D9519D219035690A0BACA171444B9F45FE9D" +
          "981F1E1B776C5DF1FB7E2C64FE6B571968CDDDE4D009361A609962D707E64D09" +
          "86F78E9B2F42D983CBA5CAAD2262757F5B40EF1AAFEC48756B22B5C405004D2A" +
          "097D8B8D6EBB5CD4A6B2A10D24ACAF16F37F6EBAFD0D0791D263F1BB83DE4148" +
          "1B7431E2F33F19A750F24E5BAE206093D50C7EA5527798ECD52C0D52E75CAE04" +
          "84EFFBAECDB45CBAC8CE982BD0A3A2E6256EB9CC066AB27F56578B4CAA09214F" +
          "4AC3904BA9D00736CF54119E27E39F503F58C294D47188A7814ED78F1E5D21DD" +
          "C2016D5A1FD194B659885E377D176E8E1655107CCF70EAE75029A542E03028A0" +
          "1E3DD559B168737022D33D2A634613AEDB1E350598A1DD56F0E3DC62B1CC2591" +
          "22DB36FC998C813776D677F3ACF44C16A684FFDA1082FC1F4F73E87CF5A96829" +
          "B37FA47B1F2CA010ABA85D82ADF74EB7130C4D4EF53FA3938892EF424CFC95BF" +
          "D276C2928F86903B7B845F7B57C9B95AF823B3263D411EDE092BBDDC53138B19" +
          "9BA2F7F58C317390C5A1D3B943706C768EFE8FD306F59D84D075DAFDC074F24B" +
          "B42A776FD4BE4A472606F04D2C901CDE7E083828801606663BFC74E59C926F26" +
          "AD0E2505451F421FFEBA7EF6133BE520ACEBB0B22A31301A6CC0A6A2A5F24129" +
          "9E4819E225C4713A79DDBE1FCF634355761336BF3A3A70026000A7114E675D36" +
          "640FF0DF89C016C657D4701296C94F9BBAACC7572385E1A056F9511A2B18CFD6" +
          "A773EE01DEFD63EA25C7EA5473C72A71B3F6A52B7A9819254D77951405CF9D42" +
          "F6544E4C77EC3648CC47AC94810D108850F7A2D8C1CA827BD7C42D092627FBE6" +
          "065EE7C61AD70AA64029C0E4211A91B19F4D007EDAAAE26DA8F51308DAEC116B" +
          "3396C89A7750E3426221CB8039E5F2F22820431816CF20C5C1650B93711C520B" +
          "41981EBA8507CE90FBDC9B9603C8CFBF4C0D8FAA40A096CD43A7B3A48AB29A0A" +
          "5E812D87B6990B0500E2732BBE8992D1DFE590A30F47D6966AE6558DB19630FF" +
          "3825F357F7BDCAE02EC36A4DF3EA5F14751D3FABDA08062B5934E38FDB9DFBC5" +
          "181663F17475DEBD527D867FFAF8A976F9CF383A7FB98EC2E70D4EB288DE12A3" +
          "B47907691CCCAE0F646D4C57AED99D835F109A33E23703AAA9BC92E9E11DFC64" +
          "81B926ECD2E10D69F66BFE022FA623138786E4FF702CE1C6111B92815068EFD9" +
          "23946D8B57CC99F339129A7CF872394360F16C5489A4D8EE7F9E1911B48B7275" +
          "AB0076FED358991439A34CEA606AFF7ED88EAB3FC54D0CB5C766083E6B39AF5B" +
          "11E34A100B2750CBC031DCB3047FC2310B0992A47E89D7A09870FED21B8C027D" +
          "8C948034364907FB973D369C89DDEF5590D2E5C907CB41E2F9E36BC43479180C" +
          "119C397379192347BB3008406509D7E0CE8C874187EE9A6FEDD150FACEB93EBF" +
          "7F2DCFC6F15ACFF65A930DEF663AB3A6856C54BF61AA380CFC9E97A9AEA84D23" +
          "A732B694759BDF8C602E6D28E9186E27E61D3538996B86DE70972E75CE6ADD5E" +
          "87F184F6E0F4DFD678A43378B3E62B45C51EBAEBAF434ED79E3AC25EF4BB3685" +
          "E2A0DDF30E311D396E70C7B7AB84A9C4941090BADBDC3517A1E0390E7984D4D5" +
          "61536AF2729D151B0995CC45A1B60CF02CE3DD789CB620558B83C1C78B8CEFD3" +
          "3E2CC21962A3527950A2CEFEA375B4C86462839D153B551416A17DD0D523F6A2" +
          "9EA4A659FD8B7A9A8E0C8C54580E4765E0FC0512AE82D35B741692F692FD876B" +
          "6F54AA6FDA98F21F1643BB17123127687A44C392E4EA9A5EEB369F38B503DB0B" +
          "CF8AD22560011F91493C881A5F05059819FFFE564C0A1C7A873A4994F81745E4" +
          "BD9279A5EC0A01CFFD871F0A0FD161DBB03A02953DA066A21F82D83D3A7ACFD9" +
          "F37943AAB6E27BABE872F474A9953C259A38A29894BA1F46AEF1888DB89CA84C" +
          "8CA08BF69C9C6A4450FC821A948056E97DA613FB9D38A56DD42E744253F07600" +
          "406F5362BA041389C5E3B5512D06D72037E0FBDC049441D11B44B495335760AA" +
          "B1EE556EFBC876B25439226151D24DCD74BC89A065A4954889938415B7A2E406" +
          "710F653B9ABC5338FB94B16BCDA96A7CC8890114DFD603FFA5EA071ABB8D720C" +
          "36F20564B6E4BE4315F3528594E9051B46C559A4C13C027C36D95EFFFE96E11C" +
          "AA567A14E4166F3D902BCD7157005D0EED2EFD793E7E008D6C4DAC4058EBCE9D" +
          "350A7F6F07F7ECBEC4B4C75DA6EBAE3C229D032EA8A68BCE62DD9E045D9E16C8"),
          seed: "9E3779B185EBCA8D",
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("66F81670669ABABC")
        },

        // ---- XXH3-128 (high64 then low64, each big-endian, as xxhsum prints them) ----
        {
          text: "XXH3-128 len=0, seed 0",
          uri: URI,
          input: OpCodes.Hex8ToBytes(""),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("99AA06D3014798D86001C324468D497F")
        },
        {
          text: "XXH3-128 len=1, seed 0",
          uri: URI,
          input: OpCodes.Hex8ToBytes("00"),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("A6CD5E9392000F6AC44BDFF4074EECDB")
        },
        {
          text: "XXH3-128 len=16, seed 0",
          uri: URI,
          input: OpCodes.Hex8ToBytes("0052929BB732A3242D00AF950EECB893"),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("C68C368ECF8A9C05562980258A998629")
        },
        {
          text: "XXH3-128 len=17, seed 0",
          uri: URI,
          input: OpCodes.Hex8ToBytes("0052929BB732A3242D00AF950EECB893E3"),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("955FA78643ED3669ABBC12D11973D7DB")
        },
        {
          text: "XXH3-128 len=128, seed 0",
          uri: URI,
          input: OpCodes.Hex8ToBytes(
          "0052929BB732A3242D00AF950EECB893E3DFEF93AAD6CD2A538B5C3F545A6FD5" +
          "59C0FFFC8F85B9331DAB74F7B6059327B07084B3677C9F76480072ED7B9817E8" +
          "DD485E0C0CCBD0653FADB28F11B06CE88DB0F186086159566C8E4E781363BDAB" +
          "9D327309EA712FD97A9D55F0CA8AD0E95E1A36B36B0FCA51EF8BA2C462ED0096"),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("39992220E045260AEBB15E34A7FB5AB1")
        },
        {
          text: "XXH3-128 len=240, seed 0",
          uri: URI,
          input: OpCodes.Hex8ToBytes(
          "0052929BB732A3242D00AF950EECB893E3DFEF93AAD6CD2A538B5C3F545A6FD5" +
          "59C0FFFC8F85B9331DAB74F7B6059327B07084B3677C9F76480072ED7B9817E8" +
          "DD485E0C0CCBD0653FADB28F11B06CE88DB0F186086159566C8E4E781363BDAB" +
          "9D327309EA712FD97A9D55F0CA8AD0E95E1A36B36B0FCA51EF8BA2C462ED0096" +
          "F33449EB0FD13B92A1A963DBAAED3DCFF10942CDF9B321A2EBF2C8F4E42F48D1" +
          "4B10F4C2EFECF84AB53874C3A4A6620EBFFD633741E386981AEB4CBA56036687" +
          "ED004559C18544B6C368F941A9EAF987E09F12D0D51454485D444051E338069A" +
          "4C3C0DEF6489F8A361EEE3C51C9368C8"),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("AA4202DAA2769DC85C9AAE94C8EBE5A0")
        },
        {
          text: "XXH3-128 len=241, seed 0",
          uri: URI,
          input: OpCodes.Hex8ToBytes(
          "0052929BB732A3242D00AF950EECB893E3DFEF93AAD6CD2A538B5C3F545A6FD5" +
          "59C0FFFC8F85B9331DAB74F7B6059327B07084B3677C9F76480072ED7B9817E8" +
          "DD485E0C0CCBD0653FADB28F11B06CE88DB0F186086159566C8E4E781363BDAB" +
          "9D327309EA712FD97A9D55F0CA8AD0E95E1A36B36B0FCA51EF8BA2C462ED0096" +
          "F33449EB0FD13B92A1A963DBAAED3DCFF10942CDF9B321A2EBF2C8F4E42F48D1" +
          "4B10F4C2EFECF84AB53874C3A4A6620EBFFD633741E386981AEB4CBA56036687" +
          "ED004559C18544B6C368F941A9EAF987E09F12D0D51454485D444051E338069A" +
          "4C3C0DEF6489F8A361EEE3C51C9368C8E5"),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("99A80ECF0ECFC647C5A639ECD2030E5E")
        },
        {
          text: "XXH3-128 len=1024, seed 0",
          uri: URI,
          input: OpCodes.Hex8ToBytes(
          "0052929BB732A3242D00AF950EECB893E3DFEF93AAD6CD2A538B5C3F545A6FD5" +
          "59C0FFFC8F85B9331DAB74F7B6059327B07084B3677C9F76480072ED7B9817E8" +
          "DD485E0C0CCBD0653FADB28F11B06CE88DB0F186086159566C8E4E781363BDAB" +
          "9D327309EA712FD97A9D55F0CA8AD0E95E1A36B36B0FCA51EF8BA2C462ED0096" +
          "F33449EB0FD13B92A1A963DBAAED3DCFF10942CDF9B321A2EBF2C8F4E42F48D1" +
          "4B10F4C2EFECF84AB53874C3A4A6620EBFFD633741E386981AEB4CBA56036687" +
          "ED004559C18544B6C368F941A9EAF987E09F12D0D51454485D444051E338069A" +
          "4C3C0DEF6489F8A361EEE3C51C9368C8E597D70998FF97A84CEAA479ABCD2CC8" +
          "9F1BF2F1CEE282503882AD8E9BB8B488818EB636D9A96548743CC9DBFCBBD82A" +
          "229EB424E2B267ABAA13E22A4DFC711C076291BDF8E2975D0C84FD6745671B09" +
          "9A4B20A2773095DA28B1863F9EF2E1DB10DF90F86D912F0678B3485BDFF6DBD8" +
          "7CA7AEA589404C027320F09FDD637995B103C47E6F2FE022F6D488E9666E9D35" +
          "19BD411B4F1ACFD578B00049F01F8F8DF614BCB5946DC45376A7A75391CF8DB6" +
          "166C397E362F06F2231E8E0FC886F476618EF66436FC8C27A1FA12CBFECE583F" +
          "8167886C7DC081E7F8C08E540EC9D9519D219035690A0BACA171444B9F45FE9D" +
          "981F1E1B776C5DF1FB7E2C64FE6B571968CDDDE4D009361A609962D707E64D09" +
          "86F78E9B2F42D983CBA5CAAD2262757F5B40EF1AAFEC48756B22B5C405004D2A" +
          "097D8B8D6EBB5CD4A6B2A10D24ACAF16F37F6EBAFD0D0791D263F1BB83DE4148" +
          "1B7431E2F33F19A750F24E5BAE206093D50C7EA5527798ECD52C0D52E75CAE04" +
          "84EFFBAECDB45CBAC8CE982BD0A3A2E6256EB9CC066AB27F56578B4CAA09214F" +
          "4AC3904BA9D00736CF54119E27E39F503F58C294D47188A7814ED78F1E5D21DD" +
          "C2016D5A1FD194B659885E377D176E8E1655107CCF70EAE75029A542E03028A0" +
          "1E3DD559B168737022D33D2A634613AEDB1E350598A1DD56F0E3DC62B1CC2591" +
          "22DB36FC998C813776D677F3ACF44C16A684FFDA1082FC1F4F73E87CF5A96829" +
          "B37FA47B1F2CA010ABA85D82ADF74EB7130C4D4EF53FA3938892EF424CFC95BF" +
          "D276C2928F86903B7B845F7B57C9B95AF823B3263D411EDE092BBDDC53138B19" +
          "9BA2F7F58C317390C5A1D3B943706C768EFE8FD306F59D84D075DAFDC074F24B" +
          "B42A776FD4BE4A472606F04D2C901CDE7E083828801606663BFC74E59C926F26" +
          "AD0E2505451F421FFEBA7EF6133BE520ACEBB0B22A31301A6CC0A6A2A5F24129" +
          "9E4819E225C4713A79DDBE1FCF634355761336BF3A3A70026000A7114E675D36" +
          "640FF0DF89C016C657D4701296C94F9BBAACC7572385E1A056F9511A2B18CFD6" +
          "A773EE01DEFD63EA25C7EA5473C72A71B3F6A52B7A9819254D77951405CF9D42"),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("0D30D24071C64C57DD85C9B5C1109C5C")
        },
        {
          text: "XXH3-128 len=1, seed 0x9E3779B185EBCA8D",
          uri: URI,
          input: OpCodes.Hex8ToBytes("00"),
          seed: "9E3779B185EBCA8D",
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("20E49ABCC53B3842032BE332DD766EF8")
        },
        {
          text: "XXH3-128 len=241, seed 0x9E3779B185EBCA8D",
          uri: URI,
          input: OpCodes.Hex8ToBytes(
          "0052929BB732A3242D00AF950EECB893E3DFEF93AAD6CD2A538B5C3F545A6FD5" +
          "59C0FFFC8F85B9331DAB74F7B6059327B07084B3677C9F76480072ED7B9817E8" +
          "DD485E0C0CCBD0653FADB28F11B06CE88DB0F186086159566C8E4E781363BDAB" +
          "9D327309EA712FD97A9D55F0CA8AD0E95E1A36B36B0FCA51EF8BA2C462ED0096" +
          "F33449EB0FD13B92A1A963DBAAED3DCFF10942CDF9B321A2EBF2C8F4E42F48D1" +
          "4B10F4C2EFECF84AB53874C3A4A6620EBFFD633741E386981AEB4CBA56036687" +
          "ED004559C18544B6C368F941A9EAF987E09F12D0D51454485D444051E338069A" +
          "4C3C0DEF6489F8A361EEE3C51C9368C8E5"),
          seed: "9E3779B185EBCA8D",
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("EC64AFAE6A137582DDA9B0A161D4829A")
        }
      ];
    }

    /**
   * Create new hash instance
   * @param {boolean} [isInverse=false] - Unused; hash functions have no inverse
   * @returns {XXHash3AlgorithmInstance} New hash instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new XXHash3AlgorithmInstance(this, isInverse);
    }
  }

  /**
 * XXHash3Algorithm instance implementing the Feed/Result pattern
 * @class
 * @extends {IHashFunctionInstance}
 */

  class XXHash3AlgorithmInstance extends IHashFunctionInstance {
    /**
   * Initialize instance
   * @param {XXHash3Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Unused
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 8; // Default to 64-bit
      this.inputBuffer = [];
      /** @type {BigInt} */
      this._seed = 0n;
    }

    /**
     * Set the 64-bit seed from a hex string (non-hex characters are ignored;
     * null, undefined or an empty string select seed 0).
     * @param {string} seed - Seed as hex digits, most significant first
     * @returns {boolean} Always true
     */
    setSeed(seed) {
      if (seed === null || seed === undefined) {
        this._seed = 0n;
        return true;
      }
      /** @type {string} */
      const clean = seed.replace(/[^0-9a-fA-F]/g, '');
      if (clean.length === 0) this._seed = 0n;
      else this._seed = m64(BigInt('0x' + clean));
      return true;
    }

    /**
     * Current 64-bit seed, in the hex form the setter takes
     * @returns {string} The seed as 16 upper-case hex digits, most significant first
     */
    get seed() {
      /** @type {string} */
      const digits = '0123456789ABCDEF';
      /** @type {uint8[]} */
      const bytes = OpCodes.Unpack64BE(this._seed);
      /** @type {string} */
      let text = '';
      for (let i = 0; i < bytes.length; ++i) {
        text += digits.charAt(Math.floor(bytes[i] / 16)) + digits.charAt(bytes[i] % 16);
      }
      return text;
    }

    /**
     * Set the seed from a hex string
     * @param {string} value - Seed as hex digits
     */
    set seed(value) { this.setSeed(value); }

    /**
     * Select the digest size
     * @param {int32} size - 8 or 16 bytes
     * @returns {void}
     */
    SetOutputSize(size) {
      if (size !== 8 && size !== 16) {
        throw new Error('xxHash3 supports only 64-bit (8 bytes) or 128-bit (16 bytes) output');
      }
      this.OutputSize = size;
    }

    /**
     * Lower-case alias: this is the setter name the test engine looks for when a
     * vector carries an "outputSize" property.
     * @param {int32} size - 8 or 16 bytes
     * @returns {void}
     */
    setOutputSize(size) {
      this.SetOutputSize(size);
    }

    /**
     * Append a 64-bit value big-endian
     * @param {BigInt} value - The value
     * @param {uint8[]} out - Destination, appended to
     * @returns {void}
     */
    _pushBE64(value, out) {
      for (let i = 7; i >= 0; i--) {
        /** @type {uint8} */
        const b = Number(OpCodes.AndN(OpCodes.ShiftRn(value, i * 8), 0xFFn));
        out.push(b);
      }
    }

    /**
     * Hash a complete message in one operation
     * @param {uint8[]} message - Message to hash as byte array (null hashes the empty message)
     * @returns {uint8[]} Hash digest as byte array
     */
    Hash(message) {
      /** @type {uint8[]} */
      const out = [];
      /** @type {uint8[]} */
      let data = message;
      if (!data) data = [];
      if (this.OutputSize === 16) {
        const h = xxh3_128bits(data, this._seed);
        // high half first, then low half, each big-endian
        this._pushBE64(h[1], out);
        this._pushBE64(h[0], out);
      } else {
        const h = xxh3_64bits(data, this._seed);
        this._pushBE64(h, out);
      }
      return out;
    }

    /**
     * Result method required by test suite - returns final hash.
     * Feed() is inherited from the framework base class and simply appends to
     * inputBuffer, so Feed(a); Feed(b) hashes the same bytes as Feed(a || b).
     * @returns {uint8[]} Hash digest as byte array
     */
    Result() {
      const result = this.Hash(this.inputBuffer);
      this.inputBuffer = [];
      return result;
    }

    /**
     * Drop buffered input and reset the seed
     * @returns {void}
     */
    ClearData() {
      this.inputBuffer = [];
      this._seed = 0n;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new XXHash3Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { XXHash3Algorithm, XXHash3AlgorithmInstance };
}));
