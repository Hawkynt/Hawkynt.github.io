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

  const MASK64 = 0xFFFFFFFFFFFFFFFFn;
  const MASK32 = 0xFFFFFFFFn;

  // xxHash primes
  const PRIME64_1 = 0x9E3779B185EBCA87n;
  const PRIME64_2 = 0xC2B2AE3D27D4EB4Fn;
  const PRIME64_3 = 0x165667B19E3779F9n;
  const PRIME64_4 = 0x85EBCA77C2B2AE63n;
  const PRIME64_5 = 0x27D4EB2F165667C5n;
  const PRIME32_1 = 0x9E3779B1n;
  const PRIME32_2 = 0x85EBCA77n;
  const PRIME32_3 = 0xC2B2AE3Dn;

  // xxHash3-specific mixing constants
  const PRIME_MX1 = 0x165667919E3779F9n;
  const PRIME_MX2 = 0x9FB21C651E98DF25n;

  // Layout constants from the reference implementation
  const SECRET_DEFAULT_SIZE = 192;
  const SECRET_SIZE_MIN = 136;
  const MIDSIZE_MAX = 240;
  const MIDSIZE_STARTOFFSET = 3;
  const MIDSIZE_LASTOFFSET = 17;
  const STRIPE_LEN = 64;
  const SECRET_CONSUME_RATE = 8;
  const ACC_NB = 8;
  const SECRET_MERGEACCS_START = 11;
  const SECRET_LASTACC_START = 7;

  // The official 192-byte default secret
  const K_SECRET = Object.freeze([
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
  ]);

  // ===== 64-bit helpers (BigInt) =====

  const m64 = v => OpCodes.AndN(v, MASK64);
  const m32 = v => OpCodes.AndN(v, MASK32);
  const mul64 = (a, b) => m64(a * b);

  function readLE32(arr, off) {
    return OpCodes.OrN(
      OpCodes.OrN(BigInt(arr[off]), OpCodes.ShiftLn(BigInt(arr[off + 1]), 8)),
      OpCodes.OrN(OpCodes.ShiftLn(BigInt(arr[off + 2]), 16), OpCodes.ShiftLn(BigInt(arr[off + 3]), 24))
    );
  }

  function readLE64(arr, off) {
    return OpCodes.OrN(readLE32(arr, off), OpCodes.ShiftLn(readLE32(arr, off + 4), 32));
  }

  function writeLE64(arr, off, value) {
    for (let i = 0; i < 8; i++) {
      arr[off + i] = Number(OpCodes.AndN(OpCodes.ShiftRn(value, i * 8), 0xFFn));
    }
  }

  function swap32(v) {
    v = m32(v);
    return m32(OpCodes.OrN(
      OpCodes.OrN(OpCodes.ShiftLn(v, 24), OpCodes.ShiftLn(OpCodes.AndN(v, 0xFF00n), 8)),
      OpCodes.OrN(OpCodes.AndN(OpCodes.ShiftRn(v, 8), 0xFF00n), OpCodes.ShiftRn(v, 24))
    ));
  }

  function swap64(v) {
    v = m64(v);
    let r = 0n;
    for (let i = 0; i < 8; i++) {
      r = OpCodes.OrN(OpCodes.ShiftLn(r, 8), OpCodes.AndN(v, 0xFFn));
      v = OpCodes.ShiftRn(v, 8);
    }
    return r;
  }

  function xorshift64(v, shift) {
    v = m64(v);
    return m64(OpCodes.XorN(v, OpCodes.ShiftRn(v, shift)));
  }

  // 64x64 -> 128 multiply, returned as { lo, hi }
  function mult64to128(a, b) {
    const product = m64(a) * m64(b);
    return { lo: m64(product), hi: m64(OpCodes.ShiftRn(product, 64)) };
  }

  function mul128Fold64(a, b) {
    const p = mult64to128(a, b);
    return m64(OpCodes.XorN(p.lo, p.hi));
  }

  function mult32to64(a, b) {
    return m64(m32(a) * m32(b));
  }

  function xxh64Avalanche(h) {
    h = m64(h);
    h = m64(OpCodes.XorN(h, OpCodes.ShiftRn(h, 33)));
    h = mul64(h, PRIME64_2);
    h = m64(OpCodes.XorN(h, OpCodes.ShiftRn(h, 29)));
    h = mul64(h, PRIME64_3);
    h = m64(OpCodes.XorN(h, OpCodes.ShiftRn(h, 32)));
    return h;
  }

  function xxh3Avalanche(h) {
    h = xorshift64(h, 37);
    h = mul64(h, PRIME_MX1);
    h = xorshift64(h, 32);
    return h;
  }

  // Stronger finalizer for 4..8 byte inputs, inspired by Pelle Evensen's rrmxmx
  function rrmxmx(h, len) {
    h = m64(OpCodes.XorN(OpCodes.XorN(h, OpCodes.RotL64n(h, 49)), OpCodes.RotL64n(h, 24)));
    h = mul64(h, PRIME_MX2);
    h = m64(OpCodes.XorN(h, m64(OpCodes.ShiftRn(h, 35) + BigInt(len))));
    h = mul64(h, PRIME_MX2);
    return xorshift64(h, 28);
  }

  // ===== 64-bit length-dependent paths =====

  function len1to3_64(input, off, len, secret, seed) {
    const c1 = BigInt(input[off]);
    const c2 = BigInt(input[off + OpCodes.Shr32(len, 1)]);
    const c3 = BigInt(input[off + len - 1]);
    const combined = m32(OpCodes.OrN(
      OpCodes.OrN(OpCodes.ShiftLn(c1, 16), OpCodes.ShiftLn(c2, 24)),
      OpCodes.OrN(c3, OpCodes.ShiftLn(BigInt(len), 8))
    ));
    const bitflip = m64(m64(OpCodes.XorN(readLE32(secret, 0), readLE32(secret, 4))) + seed);
    return xxh64Avalanche(OpCodes.XorN(combined, bitflip));
  }

  function len4to8_64(input, off, len, secret, seed) {
    seed = m64(OpCodes.XorN(seed, OpCodes.ShiftLn(swap32(m32(seed)), 32)));
    const input1 = readLE32(input, off);
    const input2 = readLE32(input, off + len - 4);
    const bitflip = m64(m64(OpCodes.XorN(readLE64(secret, 8), readLE64(secret, 16))) - seed);
    const input64 = m64(input2 + OpCodes.ShiftLn(input1, 32));
    return rrmxmx(OpCodes.XorN(input64, bitflip), len);
  }

  function len9to16_64(input, off, len, secret, seed) {
    const bitflip1 = m64(m64(OpCodes.XorN(readLE64(secret, 24), readLE64(secret, 32))) + seed);
    const bitflip2 = m64(m64(OpCodes.XorN(readLE64(secret, 40), readLE64(secret, 48))) - seed);
    const inputLo = m64(OpCodes.XorN(readLE64(input, off), bitflip1));
    const inputHi = m64(OpCodes.XorN(readLE64(input, off + len - 8), bitflip2));
    const acc = m64(BigInt(len) + swap64(inputLo) + inputHi + mul128Fold64(inputLo, inputHi));
    return xxh3Avalanche(acc);
  }

  function len0to16_64(input, off, len, secret, seed) {
    if (len > 8) return len9to16_64(input, off, len, secret, seed);
    if (len >= 4) return len4to8_64(input, off, len, secret, seed);
    if (len > 0) return len1to3_64(input, off, len, secret, seed);
    return xxh64Avalanche(OpCodes.XorN(seed, m64(OpCodes.XorN(readLE64(secret, 56), readLE64(secret, 64)))));
  }

  function mix16B(input, inOff, secret, secOff, seed) {
    const inputLo = readLE64(input, inOff);
    const inputHi = readLE64(input, inOff + 8);
    return mul128Fold64(
      OpCodes.XorN(inputLo, m64(readLE64(secret, secOff) + seed)),
      OpCodes.XorN(inputHi, m64(readLE64(secret, secOff + 8) - seed))
    );
  }

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

  function accumulate(acc, input, inOff, secret, secOff, nbStripes) {
    for (let n = 0; n < nbStripes; n++) {
      accumulate512(acc, input, inOff + n * STRIPE_LEN, secret, secOff + n * SECRET_CONSUME_RATE);
    }
  }

  function scrambleAcc(acc, secret, secOff) {
    for (let lane = 0; lane < ACC_NB; lane++) {
      const key64 = readLE64(secret, secOff + lane * 8);
      let acc64 = xorshift64(acc[lane], 47);
      acc64 = OpCodes.XorN(acc64, key64);
      acc[lane] = mul64(acc64, PRIME32_1);
    }
  }

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

  function mix2Accs(acc, accOff, secret, secOff) {
    return mul128Fold64(
      OpCodes.XorN(acc[accOff], readLE64(secret, secOff)),
      OpCodes.XorN(acc[accOff + 1], readLE64(secret, secOff + 8))
    );
  }

  function mergeAccs(acc, secret, secOff, start) {
    let result = m64(start);
    for (let i = 0; i < 4; i++) {
      result = m64(result + mix2Accs(acc, 2 * i, secret, secOff + 16 * i));
    }
    return xxh3Avalanche(result);
  }

  function initAcc() {
    return [PRIME32_3, PRIME64_1, PRIME64_2, PRIME64_3, PRIME64_4, PRIME32_2, PRIME64_5, PRIME32_1];
  }

  // Seeded long inputs derive their own secret from the default one
  function initCustomSecret(seed) {
    const secret = new Array(SECRET_DEFAULT_SIZE);
    const nbRounds = SECRET_DEFAULT_SIZE / 16;
    for (let i = 0; i < nbRounds; i++) {
      writeLE64(secret, 16 * i, m64(readLE64(K_SECRET, 16 * i) + seed));
      writeLE64(secret, 16 * i + 8, m64(readLE64(K_SECRET, 16 * i + 8) - seed));
    }
    return secret;
  }

  function hashLong64(input, len, secret, secretSize) {
    const acc = initAcc();
    hashLongLoop(acc, input, len, secret, secretSize);
    return mergeAccs(acc, secret, SECRET_MERGEACCS_START, mul64(BigInt(len), PRIME64_1));
  }

  function xxh3_64bits(input, seed) {
    seed = m64(seed);
    const len = input.length;
    if (len <= 16) return len0to16_64(input, 0, len, K_SECRET, seed);
    if (len <= 128) return len17to128_64(input, 0, len, K_SECRET, seed);
    if (len <= MIDSIZE_MAX) return len129to240_64(input, 0, len, K_SECRET, seed);
    const secret = seed === 0n ? K_SECRET : initCustomSecret(seed);
    return hashLong64(input, len, secret, SECRET_DEFAULT_SIZE);
  }

  // ===== 128-bit length-dependent paths =====

  function len1to3_128(input, off, len, secret, seed) {
    const c1 = BigInt(input[off]);
    const c2 = BigInt(input[off + OpCodes.Shr32(len, 1)]);
    const c3 = BigInt(input[off + len - 1]);
    const combinedLo = m32(OpCodes.OrN(
      OpCodes.OrN(OpCodes.ShiftLn(c1, 16), OpCodes.ShiftLn(c2, 24)),
      OpCodes.OrN(c3, OpCodes.ShiftLn(BigInt(len), 8))
    ));
    const swapped = swap32(combinedLo);
    const combinedHi = m32(OpCodes.OrN(OpCodes.ShiftLn(swapped, 13), OpCodes.ShiftRn(swapped, 19)));
    const bitflipLo = m64(m64(OpCodes.XorN(readLE32(secret, 0), readLE32(secret, 4))) + seed);
    const bitflipHi = m64(m64(OpCodes.XorN(readLE32(secret, 8), readLE32(secret, 12))) - seed);
    return {
      lo: xxh64Avalanche(OpCodes.XorN(combinedLo, bitflipLo)),
      hi: xxh64Avalanche(OpCodes.XorN(combinedHi, bitflipHi))
    };
  }

  function len4to8_128(input, off, len, secret, seed) {
    seed = m64(OpCodes.XorN(seed, OpCodes.ShiftLn(swap32(m32(seed)), 32)));
    const inputLo = readLE32(input, off);
    const inputHi = readLE32(input, off + len - 4);
    const input64 = m64(inputLo + OpCodes.ShiftLn(inputHi, 32));
    const bitflip = m64(m64(OpCodes.XorN(readLE64(secret, 16), readLE64(secret, 24))) + seed);
    const keyed = OpCodes.XorN(input64, bitflip);

    // Shifting len left keeps the multiplier even, which avoids even multiplies
    const m128 = mult64to128(keyed, m64(PRIME64_1 + OpCodes.ShiftLn(BigInt(len), 2)));
    m128.hi = m64(m128.hi + m64(OpCodes.ShiftLn(m128.lo, 1)));
    m128.lo = m64(OpCodes.XorN(m128.lo, OpCodes.ShiftRn(m128.hi, 3)));
    m128.lo = xorshift64(m128.lo, 35);
    m128.lo = mul64(m128.lo, PRIME_MX2);
    m128.lo = xorshift64(m128.lo, 28);
    m128.hi = xxh3Avalanche(m128.hi);
    return { lo: m128.lo, hi: m128.hi };
  }

  function len9to16_128(input, off, len, secret, seed) {
    const bitflipLo = m64(m64(OpCodes.XorN(readLE64(secret, 32), readLE64(secret, 40))) - seed);
    const bitflipHi = m64(m64(OpCodes.XorN(readLE64(secret, 48), readLE64(secret, 56))) + seed);
    const inputLo = readLE64(input, off);
    let inputHi = readLE64(input, off + len - 8);

    const m128 = mult64to128(OpCodes.XorN(OpCodes.XorN(inputLo, inputHi), bitflipLo), PRIME64_1);
    // Put len in the middle of m128 so it reaches both halves of the 128x64 multiply
    m128.lo = m64(m128.lo + OpCodes.ShiftLn(BigInt(len - 1), 54));
    inputHi = OpCodes.XorN(inputHi, bitflipHi);
    m128.hi = m64(m128.hi + inputHi + mult32to64(m32(inputHi), PRIME32_2 - 1n));
    m128.lo = m64(OpCodes.XorN(m128.lo, swap64(m128.hi)));

    const h128 = mult64to128(m128.lo, PRIME64_2);
    h128.hi = m64(h128.hi + mul64(m128.hi, PRIME64_2));
    return { lo: xxh3Avalanche(h128.lo), hi: xxh3Avalanche(h128.hi) };
  }

  function len0to16_128(input, off, len, secret, seed) {
    if (len > 8) return len9to16_128(input, off, len, secret, seed);
    if (len >= 4) return len4to8_128(input, off, len, secret, seed);
    if (len > 0) return len1to3_128(input, off, len, secret, seed);
    const bitflipLo = m64(OpCodes.XorN(readLE64(secret, 64), readLE64(secret, 72)));
    const bitflipHi = m64(OpCodes.XorN(readLE64(secret, 80), readLE64(secret, 88)));
    return {
      lo: xxh64Avalanche(OpCodes.XorN(seed, bitflipLo)),
      hi: xxh64Avalanche(OpCodes.XorN(seed, bitflipHi))
    };
  }

  function mix32B(acc, input, off1, off2, secret, secOff, seed) {
    acc.lo = m64(acc.lo + mix16B(input, off1, secret, secOff, seed));
    acc.lo = m64(OpCodes.XorN(acc.lo, m64(readLE64(input, off2) + readLE64(input, off2 + 8))));
    acc.hi = m64(acc.hi + mix16B(input, off2, secret, secOff + 16, seed));
    acc.hi = m64(OpCodes.XorN(acc.hi, m64(readLE64(input, off1) + readLE64(input, off1 + 8))));
    return acc;
  }

  function finish128(acc, len, seed) {
    let lo = m64(acc.lo + acc.hi);
    let hi = m64(mul64(acc.lo, PRIME64_1) + mul64(acc.hi, PRIME64_4) + mul64(m64(BigInt(len) - seed), PRIME64_2));
    lo = xxh3Avalanche(lo);
    hi = m64(0n - xxh3Avalanche(hi));
    return { lo, hi };
  }

  function len17to128_128(input, off, len, secret, seed) {
    let acc = { lo: mul64(BigInt(len), PRIME64_1), hi: 0n };
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

  function len129to240_128(input, off, len, secret, seed) {
    let acc = { lo: mul64(BigInt(len), PRIME64_1), hi: 0n };
    let i;
    for (i = 32; i < 160; i += 32) {
      acc = mix32B(acc, input, off + i - 32, off + i - 16, secret, i - 32, seed);
    }
    acc.lo = xxh3Avalanche(acc.lo);
    acc.hi = xxh3Avalanche(acc.hi);
    // Note: i <= len duplicates the last 32 bytes when len is a multiple of 32.
    // That is required to keep the published results stable.
    for (i = 160; i <= len; i += 32) {
      acc = mix32B(acc, input, off + i - 32, off + i - 16, secret, MIDSIZE_STARTOFFSET + i - 160, seed);
    }
    acc = mix32B(acc, input, off + len - 16, off + len - 32,
      secret, SECRET_SIZE_MIN - MIDSIZE_LASTOFFSET - 16, m64(0n - seed));
    return finish128(acc, len, seed);
  }

  function hashLong128(input, len, secret, secretSize) {
    const acc = initAcc();
    hashLongLoop(acc, input, len, secret, secretSize);
    const lo = mergeAccs(acc, secret, SECRET_MERGEACCS_START, mul64(BigInt(len), PRIME64_1));
    const hi = mergeAccs(acc, secret, secretSize - STRIPE_LEN - SECRET_MERGEACCS_START,
      m64(OpCodes.XorN(mul64(BigInt(len), PRIME64_2), MASK64)));
    return { lo, hi };
  }

  function xxh3_128bits(input, seed) {
    seed = m64(seed);
    const len = input.length;
    if (len <= 16) return len0to16_128(input, 0, len, K_SECRET, seed);
    if (len <= 128) return len17to128_128(input, 0, len, K_SECRET, seed);
    if (len <= MIDSIZE_MAX) return len129to240_128(input, 0, len, K_SECRET, seed);
    const secret = seed === 0n ? K_SECRET : initCustomSecret(seed);
    return hashLong128(input, len, secret, SECRET_DEFAULT_SIZE);
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
      this.SupportedOutputSizes = [8, 16]; // 64 and 128 bits

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
        {
          type: "Cryptographic Weakness",
          text: "Not designed for cryptographic use - vulnerable to deliberate collision attacks",
          mitigation: "Use only for non-cryptographic applications like hash tables and checksums"
        }
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

      this.tests = VECTORS(URI);
    }

    /**
   * Create new hash instance
   * @param {boolean} [isInverse=false] - Unused; hash functions have no inverse
   * @returns {Object} New hash instance
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
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Unused
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 8; // Default to 64-bit
      this.inputBuffer = [];
      this._seed = 0n;
    }

    /**
     * Set the 64-bit seed. Accepts a hex string, a byte array (big-endian),
     * a Number or a BigInt.
     */
    setSeed(seed) {
      if (seed === null || seed === undefined) {
        this._seed = 0n;
      } else if (typeof seed === 'bigint') {
        this._seed = m64(seed);
      } else if (typeof seed === 'number') {
        this._seed = m64(BigInt(Math.trunc(seed)));
      } else if (typeof seed === 'string') {
        const clean = seed.replace(/[^0-9a-fA-F]/g, '');
        this._seed = clean.length === 0 ? 0n : m64(BigInt('0x' + clean));
      } else if (Array.isArray(seed) || ArrayBuffer.isView(seed)) {
        let v = 0n;
        for (let i = 0; i < seed.length; i++) {
          v = OpCodes.OrN(OpCodes.ShiftLn(v, 8), BigInt(OpCodes.AndN(seed[i], 0xFF)));
        }
        this._seed = m64(v);
      } else {
        this._seed = 0n;
      }
      return true;
    }

    get seed() { return this._seed; }
    set seed(value) { this.setSeed(value); }

    SetOutputSize(size) {
      if (size !== 8 && size !== 16) {
        throw new Error('xxHash3 supports only 64-bit (8 bytes) or 128-bit (16 bytes) output');
      }
      this.OutputSize = size;
    }

    // Lower-case alias: this is the setter name the test engine looks for when a
    // vector carries an "outputSize" property.
    setOutputSize(size) {
      this.SetOutputSize(size);
    }

    /**
     * Hash a complete message in one operation
     * @param {Array} message - Message to hash as byte array
     * @returns {Array} Hash digest as byte array
     */
    Hash(message) {
      const data = message || [];
      const out = [];
      if (this.OutputSize === 16) {
        const h = xxh3_128bits(data, this._seed);
        // high half first, then low half, each big-endian
        for (let i = 7; i >= 0; i--) out.push(Number(OpCodes.AndN(OpCodes.ShiftRn(h.hi, i * 8), 0xFFn)));
        for (let i = 7; i >= 0; i--) out.push(Number(OpCodes.AndN(OpCodes.ShiftRn(h.lo, i * 8), 0xFFn)));
      } else {
        const h = xxh3_64bits(data, this._seed);
        for (let i = 7; i >= 0; i--) out.push(Number(OpCodes.AndN(OpCodes.ShiftRn(h, i * 8), 0xFFn)));
      }
      return out;
    }

    /**
     * Result method required by test suite - returns final hash.
     * Feed() is inherited from the framework base class and simply appends to
     * inputBuffer, so Feed(a); Feed(b) hashes the same bytes as Feed(a || b).
     * @returns {Array} Hash digest as byte array
     */
    Result() {
      const result = this.Hash(this.inputBuffer || []);
      this.inputBuffer = [];
      return result;
    }

    ClearData() {
      this.inputBuffer = [];
      this._seed = 0n;
    }
  }

  // ===== TEST VECTORS =====
  // Defined after the classes so the long hex literals do not obscure the code.
  function VECTORS(URI) {
    return [
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

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new XXHash3Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { XXHash3Algorithm, XXHash3AlgorithmInstance };
}));
