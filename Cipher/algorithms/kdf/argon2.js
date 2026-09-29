/*
 * Argon2 Password Hashing Competition Winner (2015)
 * Universal Implementation - Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Based on PHC reference implementation and RFC 9106 specification
 * Implements all three variants: Argon2d, Argon2i, and Argon2id
 *
 * Educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
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
          KdfAlgorithm, IKdfInstance, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ARGON2 CONSTANTS =====

  /** @type {int32} Version 1.3 (current standard) */
  const ARGON2_VERSION = 0x13;
  /** @type {int32} Number of synchronization points */
  const ARGON2_SYNC_POINTS = 4;

  // Argon2 variant types
  /** @type {int32} Data-dependent (max resistance to GPU attacks) */
  const ARGON2D = 0;
  /** @type {int32} Data-independent (side-channel resistant) */
  const ARGON2I = 1;
  /** @type {int32} Hybrid (recommended for general use) */
  const ARGON2ID = 2;

  // ===== BLAKE2B =====

  /** @type {BigInt} All 64 bits set */
  const MASK64 = BigInt('0xffffffffffffffff');

  /** @type {BigInt[]} BLAKE2b initialization vector */
  const BLAKE2B_IV = [
    BigInt('0x6a09e667f3bcc908'), BigInt('0xbb67ae8584caa73b'),
    BigInt('0x3c6ef372fe94f82b'), BigInt('0xa54ff53a5f1d36f1'),
    BigInt('0x510e527fade682d1'), BigInt('0x9b05688c2b3e6c1f'),
    BigInt('0x1f83d9abfb41bd6b'), BigInt('0x5be0cd19137e2179')
  ];

  /** @type {int32[][]} BLAKE2b message schedule */
  const BLAKE2B_SIGMA = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
    [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
    [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
    [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
    [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
    [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
    [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
    [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
    [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0]
  ];

  /**
   * BLAKE2b mixing function G on the working vector
   * @param {BigInt[]} v - Working vector (16 words)
   * @param {int32} a - Index a
   * @param {int32} b - Index b
   * @param {int32} c - Index c
   * @param {int32} d - Index d
   * @param {BigInt} x - First message word
   * @param {BigInt} y - Second message word
   * @returns {void}
   */
  function blake2bG(v, a, b, c, d, x, y) {
    v[a] = OpCodes.AndN((v[a] + v[b] + x), MASK64);
    v[d] = OpCodes.RotR64n(OpCodes.XorN(v[d], v[a]), 32);
    v[c] = OpCodes.AndN((v[c] + v[d]), MASK64);
    v[b] = OpCodes.RotR64n(OpCodes.XorN(v[b], v[c]), 24);
    v[a] = OpCodes.AndN((v[a] + v[b] + y), MASK64);
    v[d] = OpCodes.RotR64n(OpCodes.XorN(v[d], v[a]), 16);
    v[c] = OpCodes.AndN((v[c] + v[d]), MASK64);
    v[b] = OpCodes.RotR64n(OpCodes.XorN(v[b], v[c]), 63);
  }

  /**
   * BLAKE2b compression of one 128-byte block into the chaining value
   * @param {BigInt[]} h - Chaining value (8 words), updated in place
   * @param {BigInt[]} block - Message block (16 words)
   * @param {BigInt} counter - Bytes processed so far, this block included
   * @param {boolean} finalBlock - Whether this is the last block
   * @returns {void}
   */
  function blake2bCompress(h, block, counter, finalBlock) {
    /** @type {BigInt[]} */
    const v = new Array(16);

    for (let i = 0; i < 8; i++) v[i] = h[i];
    for (let i = 0; i < 8; i++) v[i + 8] = BLAKE2B_IV[i];

    v[12] = OpCodes.XorN(v[12], OpCodes.AndN(counter, MASK64));
    v[13] = OpCodes.XorN(v[13], OpCodes.AndN(OpCodes.ShiftRn(counter, 64), MASK64));
    if (finalBlock) v[14] = OpCodes.XorN(v[14], MASK64);

    for (let round = 0; round < 12; round++) {
      const s = BLAKE2B_SIGMA[round % 10];
      blake2bG(v, 0, 4, 8, 12, block[s[0]], block[s[1]]);
      blake2bG(v, 1, 5, 9, 13, block[s[2]], block[s[3]]);
      blake2bG(v, 2, 6, 10, 14, block[s[4]], block[s[5]]);
      blake2bG(v, 3, 7, 11, 15, block[s[6]], block[s[7]]);
      blake2bG(v, 0, 5, 10, 15, block[s[8]], block[s[9]]);
      blake2bG(v, 1, 6, 11, 12, block[s[10]], block[s[11]]);
      blake2bG(v, 2, 7, 8, 13, block[s[12]], block[s[13]]);
      blake2bG(v, 3, 4, 9, 14, block[s[14]], block[s[15]]);
    }

    for (let i = 0; i < 8; i++) {
      h[i] = OpCodes.XorN(h[i], OpCodes.XorN(v[i], v[i + 8]));
    }
  }

  /**
   * Little-endian 64-bit words of a byte array (a short final word is zero-padded)
   * @param {uint8[]} bytes - Bytes
   * @returns {BigInt[]} Words
   */
  function bytesToWords64LE(bytes) {
    /** @type {BigInt[]} */
    const words = [];
    for (let i = 0; i < bytes.length; i += 8) {
      /** @type {BigInt} */
      let word = BigInt(0);
      for (let j = 0; j < 8 && i + j < bytes.length; j++) {
        word = OpCodes.OrN(word, OpCodes.ShiftLn(BigInt(bytes[i + j]), j * 8));
      }
      words.push(word);
    }
    return words;
  }

  /**
   * First `length` bytes of little-endian 64-bit words
   * @param {BigInt[]} words - Words
   * @param {int32} length - Number of bytes
   * @returns {uint8[]} Bytes
   */
  function words64ToBytes(words, length) {
    /** @type {uint8[]} */
    const bytes = new Uint8Array(length);
    let byteIndex = 0;
    for (let i = 0; i < words.length && byteIndex < length; i++) {
      let word = words[i];
      for (let j = 0; j < 8 && byteIndex < length; j++) {
        /** @type {uint8} */
        const low = Number(OpCodes.AndN(word, BigInt(0xff)));
        bytes[byteIndex++] = low;
        word = OpCodes.ShiftRn(word, 8);
      }
    }
    return bytes;
  }

  /**
   * Standard (optionally keyed) BLAKE2b
   * @param {uint8[]} input - Message bytes
   * @param {uint8[]} key - Key bytes, or null for none
   * @param {int32} outputLength - Digest length in bytes (0 means 64)
   * @returns {uint8[]} Digest
   */
  function blake2b(input, key, outputLength) {
    const BLAKE2B_BLOCKBYTES = 128;
    const BLAKE2B_OUTBYTES = 64;
    const digestLength = outputLength ? outputLength : BLAKE2B_OUTBYTES;
    const keyLength = key ? key.length : 0;

    // Initialize state
    const h = BLAKE2B_IV.slice();
    h[0] = OpCodes.XorN(h[0], OpCodes.OrN(BigInt(digestLength), OpCodes.OrN(OpCodes.ShiftLn(BigInt(keyLength), 8), OpCodes.OrN(OpCodes.ShiftLn(BigInt(1), 16), OpCodes.ShiftLn(BigInt(1), 24)))));

    /** @type {BigInt} */
    let counter = BigInt(0);
    /** @type {uint8[]} */
    const buffer = new Uint8Array(BLAKE2B_BLOCKBYTES);
    let bufferPos = 0;

    // Process key if provided
    if (key && key.length > 0) {
      /** @type {uint8[]} */
      const keyPadded = new Uint8Array(BLAKE2B_BLOCKBYTES);
      for (let i = 0; i < key.length && i < 64; i++) {
        keyPadded[i] = key[i];
      }
      counter += BigInt(BLAKE2B_BLOCKBYTES);
      const m = bytesToWords64LE(keyPadded);
      while (m.length < 16) m.push(BigInt(0));
      blake2bCompress(h, m, counter, false);
    }

    // Process input
    for (let i = 0; i < input.length; i++) {
      buffer[bufferPos++] = input[i];

      if (bufferPos === BLAKE2B_BLOCKBYTES) {
        counter += BigInt(BLAKE2B_BLOCKBYTES);
        const m = bytesToWords64LE(buffer);
        while (m.length < 16) m.push(BigInt(0));
        blake2bCompress(h, m, counter, false);
        bufferPos = 0;
      }
    }

    // Final block
    counter += BigInt(bufferPos);
    for (let i = bufferPos; i < BLAKE2B_BLOCKBYTES; i++) {
      buffer[i] = 0;
    }
    const m = bytesToWords64LE(buffer);
    while (m.length < 16) m.push(BigInt(0));
    blake2bCompress(h, m, counter, true);

    return words64ToBytes(h, digestLength);
  }

  // ===== ARGON2 CORE FUNCTIONS =====
  // 64-bit values are [low, high] pairs of 32-bit words (matching noble-hashes approach)

  // Temporary block buffer - 256 u32 = 128 u64 = 1024 bytes
  /** @type {uint32[]} */
  const A2_BUF = new Uint32Array(256);

  /**
   * 64-bit right rotate for shift in [1, 32): high word
   * @param {uint32} h - High word
   * @param {uint32} l - Low word
   * @param {int32} s - Shift
   * @returns {uint32} High word of the result
   */
  function rotrSH(h, l, s) { return OpCodes.Or32(OpCodes.Shr32(h, s), OpCodes.Shl32(l, (32 - s))); }
  /**
   * 64-bit right rotate for shift in [1, 32): low word
   * @param {uint32} h - High word
   * @param {uint32} l - Low word
   * @param {int32} s - Shift
   * @returns {uint32} Low word of the result
   */
  function rotrSL(h, l, s) { return OpCodes.Or32(OpCodes.Shl32(h, (32 - s)), OpCodes.Shr32(l, s)); }

  /**
   * 64-bit right rotate for shift in (32, 64): high word
   * @param {uint32} h - High word
   * @param {uint32} l - Low word
   * @param {int32} s - Shift
   * @returns {uint32} High word of the result
   */
  function rotrBH(h, l, s) { return OpCodes.Or32(OpCodes.Shl32(h, (64 - s)), OpCodes.Shr32(l, (s - 32))); }
  /**
   * 64-bit right rotate for shift in (32, 64): low word
   * @param {uint32} h - High word
   * @param {uint32} l - Low word
   * @param {int32} s - Shift
   * @returns {uint32} Low word of the result
   */
  function rotrBL(h, l, s) { return OpCodes.Or32(OpCodes.Shr32(h, (s - 32)), OpCodes.Shl32(l, (64 - s))); }

  /**
   * BlaMka on A2_BUF: A = A + B + 2 * u32(A) * u32(B) (mod 2^64)
   * @param {int32} a - Index of the 64-bit word A (written)
   * @param {int32} b - Index of the 64-bit word B
   * @returns {void}
   */
  function blamka(a, b) {
    const Al = A2_BUF[2*a], Ah = A2_BUF[2*a + 1];
    const Bl = A2_BUF[2*b], Bh = A2_BUF[2*b + 1];

    // C = 2 * Al * Bl as a 64-bit [Cl, Ch] pair
    const productH = OpCodes.MulHi32(Al, Bl);
    const productL = OpCodes.Mul32(Al, Bl);
    const Ch = OpCodes.Or32(OpCodes.Shl32(productH, 1), OpCodes.Shr32(productL, 31));
    const Cl = OpCodes.Shl32(productL, 1);

    // A + B + C, the low-word sum carrying into the high word
    const Rll = OpCodes.Add3L64(Al, Bl, Cl);
    A2_BUF[2*a + 1] = OpCodes.ToUint32(OpCodes.Add3H64(Rll, Ah, Bh, Ch));
    A2_BUF[2*a] = OpCodes.ToUint32(Rll);
  }

  /**
   * On A2_BUF: D = rotr64(D xor A, n) for n in {16, 24, 32, 63}
   * @param {int32} d - Index of the 64-bit word D (written)
   * @param {int32} a - Index of the 64-bit word A
   * @param {int32} n - Rotation
   * @returns {void}
   */
  function xorRotr(d, a, n) {
    const h = OpCodes.Xor32(A2_BUF[2*d + 1], A2_BUF[2*a + 1]);
    const l = OpCodes.Xor32(A2_BUF[2*d], A2_BUF[2*a]);
    if (n === 32) {
      // Rotation by 32 just swaps the halves
      A2_BUF[2*d + 1] = l;
      A2_BUF[2*d] = h;
    } else if (n < 32) {
      A2_BUF[2*d + 1] = rotrSH(h, l, n);
      A2_BUF[2*d] = rotrSL(h, l, n);
    } else {
      A2_BUF[2*d + 1] = rotrBH(h, l, n);
      A2_BUF[2*d] = rotrBL(h, l, n);
    }
  }

  /**
   * G function operating on A2_BUF with index-based access
   * @param {int32} a - Index a
   * @param {int32} b - Index b
   * @param {int32} c - Index c
   * @param {int32} d - Index d
   * @returns {void}
   */
  function G(a, b, c, d) {
    blamka(a, b);
    xorRotr(d, a, 32);

    blamka(c, d);
    xorRotr(b, c, 24);

    blamka(a, b);
    xorRotr(d, a, 16);

    blamka(c, d);
    xorRotr(b, c, 63);
  }

  /**
   * P permutation: applies G to 16 elements in column then diagonal pattern
   * @param {int32} v00 - Index 0
   * @param {int32} v01 - Index 1
   * @param {int32} v02 - Index 2
   * @param {int32} v03 - Index 3
   * @param {int32} v04 - Index 4
   * @param {int32} v05 - Index 5
   * @param {int32} v06 - Index 6
   * @param {int32} v07 - Index 7
   * @param {int32} v08 - Index 8
   * @param {int32} v09 - Index 9
   * @param {int32} v10 - Index 10
   * @param {int32} v11 - Index 11
   * @param {int32} v12 - Index 12
   * @param {int32} v13 - Index 13
   * @param {int32} v14 - Index 14
   * @param {int32} v15 - Index 15
   * @returns {void}
   */
  function P(v00, v01, v02, v03, v04, v05, v06, v07,
             v08, v09, v10, v11, v12, v13, v14, v15) {
    G(v00, v04, v08, v12);
    G(v01, v05, v09, v13);
    G(v02, v06, v10, v14);
    G(v03, v07, v11, v15);
    G(v00, v05, v10, v15);
    G(v01, v06, v11, v12);
    G(v02, v07, v08, v13);
    G(v03, v04, v09, v14);
  }

  /**
   * Block compression: XOR inputs, apply P to columns then rows, XOR with inputs
   * Memory layout uses 256 32-bit words per block (128 u64 values)
   * @param {uint32[]} B - Memory
   * @param {int32} xPos - Word offset of the first input block
   * @param {int32} yPos - Word offset of the second input block
   * @param {int32} outPos - Word offset of the output block
   * @param {boolean} needXor - XOR into the output block instead of overwriting it
   * @returns {void}
   */
  function block(B, xPos, yPos, outPos, needXor) {
    // XOR input blocks into A2_BUF
    for (let i = 0; i < 256; i++) {
      A2_BUF[i] = OpCodes.Xor32(B[xPos + i], B[yPos + i]);
    }

    // Apply P to 8 columns (each column has 16 consecutive elements in index space)
    for (let i = 0; i < 128; i += 16) {
      P(i, i+1, i+2, i+3, i+4, i+5, i+6, i+7,
        i+8, i+9, i+10, i+11, i+12, i+13, i+14, i+15);
    }

    // Apply P to 8 rows (interleaved pattern)
    for (let i = 0; i < 16; i += 2) {
      P(i, i+1, i+16, i+17, i+32, i+33, i+48, i+49,
        i+64, i+65, i+80, i+81, i+96, i+97, i+112, i+113);
    }

    // XOR result back with both original inputs
    if (needXor) {
      for (let i = 0; i < 256; i++) {
        B[outPos + i] = OpCodes.Xor32(B[outPos + i], OpCodes.Xor32(A2_BUF[i], OpCodes.Xor32(B[xPos + i], B[yPos + i])));
      }
    } else {
      for (let i = 0; i < 256; i++) {
        B[outPos + i] = OpCodes.Xor32(A2_BUF[i], OpCodes.Xor32(B[xPos + i], B[yPos + i]));
      }
    }

    // Clear temporary buffer
    A2_BUF.fill(0);
  }

  /**
   * Variable-length hash function H' using Blake2b
   * @param {uint32[]} A - Input data as 32-bit words (hashed as little-endian bytes)
   * @param {int32} dkLen - Desired output length in bytes
   * @returns {uint32[]} Output as little-endian 32-bit words
   */
  function Hp(A, dkLen) {
    // Build input: LE32(dkLen) || A
    /** @type {uint8[]} */
    const input = OpCodes.Unpack32LE(dkLen);
    for (let i = 0; i < A.length; i++) {
      const bytes = OpCodes.Unpack32LE(A[i]);
      input.push(bytes[0], bytes[1], bytes[2], bytes[3]);
    }

    /** @type {uint8[]} */
    let out = null;
    if (dkLen <= 64) {
      // Fast path: single blake2b call
      out = blake2b(input, null, dkLen);
    } else {
      // Long output: chain blake2b calls
      out = new Uint8Array(dkLen);
      let V = blake2b(input, null, 64);
      let pos = 0;

      // First block: copy first 32 bytes
      for (let i = 0; i < 32; i++) out[pos + i] = V[i];
      pos += 32;

      // Middle blocks
      while (dkLen - pos > 64) {
        V = blake2b(V, null, 64);
        for (let i = 0; i < 32; i++) out[pos + i] = V[i];
        pos += 32;
      }

      // Last block
      const lastLen = dkLen - pos;
      V = blake2b(V, null, lastLen);
      for (let i = 0; i < lastLen; i++) out[pos + i] = V[i];
    }

    // Convert to 32-bit words
    /** @type {int32} */
    const words = Math.ceil(dkLen / 4);
    /** @type {uint32[]} */
    const result = new Uint32Array(words);
    for (let i = 0; i < dkLen; i++) {
      result[OpCodes.Shr32(i, 2)] = OpCodes.Or32(result[OpCodes.Shr32(i, 2)], OpCodes.Shl32(out[i], ((i % 4) * 8)));
    }
    return result;
  }

  /**
   * Index alpha calculation for reference block selection
   * @param {int32} r - Pass
   * @param {int32} s - Slice
   * @param {int32} laneLen - Blocks per lane
   * @param {int32} segmentLen - Blocks per segment
   * @param {int32} index - Block index within the segment
   * @param {uint32} randL - Low word of the pseudo-random value
   * @param {boolean} sameLane - Whether the reference lane is the current lane
   * @returns {int32} Reference block position within its lane
   */
  function indexAlpha(r, s, laneLen, segmentLen, index, randL, sameLane) {
    /** @type {int32} */
    let area = 0;
    if (r === 0) {
      if (s === 0) area = index - 1;
      else if (sameLane) area = s * segmentLen + index - 1;
      else area = s * segmentLen + (index === 0 ? -1 : 0);
    } else if (sameLane) {
      area = laneLen - segmentLen + index - 1;
    } else {
      area = laneLen - segmentLen + (index === 0 ? -1 : 0);
    }

    const startPos = (r !== 0 && s !== ARGON2_SYNC_POINTS - 1) ? (s + 1) * segmentLen : 0;
    // rel = area - 1 - floor(area * floor(randL^2 / 2^32) / 2^32)
    /** @type {int32} */
    const rel = area - 1 - OpCodes.MulHi32(area, OpCodes.MulHi32(randL, randL));
    return (startPos + rel) % laneLen;
  }

  /**
   * Process a single block in a segment
   * @param {uint32[]} B - Memory
   * @param {uint32[]} address - Address block, input block and zero block (3 * 256 words)
   * @param {int32} l - Lane
   * @param {int32} r - Pass
   * @param {int32} s - Slice
   * @param {int32} index - Block index within the segment
   * @param {int32} laneLen - Blocks per lane
   * @param {int32} segmentLen - Blocks per segment
   * @param {int32} lanes - Number of lanes
   * @param {int32} offset - Absolute index of the block to compute
   * @param {int32} prev - Absolute index of the previous block
   * @param {boolean} dataIndependent - Argon2i-style addressing
   * @param {boolean} needXor - XOR into the block (passes after the first)
   * @returns {void}
   */
  function processBlock(B, address, l, r, s, index, laneLen, segmentLen, lanes, offset, prev, dataIndependent, needXor) {
    if (offset % laneLen !== 0) {
      prev = offset - 1;
    }

    /** @type {uint32} */
    let randL = 0;
    /** @type {uint32} */
    let randH = 0;
    if (dataIndependent) {
      const i128 = index % 128;
      if (i128 === 0) {
        address[256 + 12]++;
        block(address, 256, 2 * 256, 0, false);
        block(address, 0, 2 * 256, 0, false);
      }
      randL = address[2 * i128];
      randH = address[2 * i128 + 1];
    } else {
      const T = 256 * prev;
      randL = B[T];
      randH = B[T + 1];
    }

    // Determine reference lane and position
    /** @type {int32} */
    const refLane = (r === 0 && s === 0) ? l : OpCodes.ToUint32(randH % lanes);
    const refPos = indexAlpha(r, s, laneLen, segmentLen, index, randL, refLane === l);
    const refBlock = laneLen * refLane + refPos;

    // Apply block compression
    block(B, 256 * prev, 256 * refBlock, offset * 256, needXor);
  }

  /**
   * Initialize Argon2: compute H0 and fill the first two blocks of each lane
   * @param {uint8[]} password - Password bytes
   * @param {uint8[]} salt - Salt bytes
   * @param {int32} type - Variant (ARGON2D, ARGON2I, ARGON2ID)
   * @param {int32} p - Parallelism (lanes)
   * @param {int32} dkLen - Tag length in bytes
   * @param {int32} m - Memory cost in KiB
   * @param {int32} t - Time cost
   * @param {int32} version - Argon2 version number
   * @param {uint8[]} key - Secret key bytes
   * @param {uint8[]} personalization - Associated data bytes
   * @param {int32} mP - Memory blocks actually used
   * @param {int32} laneLen - Blocks per lane
   * @returns {uint32[]} Memory, 256 words per block
   */
  function argon2Init(password, salt, type, p, dkLen, m, t, version, key, personalization, mP, laneLen) {
    // Compute H0 = Blake2b(LE32(p) || LE32(dkLen) || LE32(m) || LE32(t) ||
    //                       LE32(version) || LE32(type) ||
    //                       LE32(|password|) || password ||
    //                       LE32(|salt|) || salt ||
    //                       LE32(|key|) || key ||
    //                       LE32(|personalization|) || personalization)
    /** @type {int32[]} */
    const items = [p, dkLen, m, t, version, type];
    /** @type {uint8[][]} */
    const dataItems = [password, salt, key, personalization];

    /** @type {uint8[]} */
    const input = [];
    for (let i = 0; i < items.length; i++) {
      const bytes = OpCodes.Unpack32LE(items[i]);
      input.push(bytes[0], bytes[1], bytes[2], bytes[3]);
    }

    for (let i = 0; i < dataItems.length; i++) {
      const data = dataItems[i];
      const bytes = OpCodes.Unpack32LE(data.length);
      input.push(bytes[0], bytes[1], bytes[2], bytes[3]);
      for (let j = 0; j < data.length; j++) input.push(data[j]);
    }

    const H0_bytes = blake2b(input, null, 64);
    // H0 as 16 little-endian words, plus two words for the block index and the lane
    /** @type {uint32[]} */
    const H0 = new Uint32Array(18);
    for (let i = 0; i < 16; i++) {
      H0[i] = OpCodes.Pack32LE(H0_bytes[4*i], H0_bytes[4*i + 1], H0_bytes[4*i + 2], H0_bytes[4*i + 3]);
    }

    // Allocate memory: 256 u32 per block
    /** @type {uint32[]} */
    const B = new Uint32Array(mP * 256);

    // Fill first two blocks of each lane
    for (let l = 0; l < p; l++) {
      const i = 256 * laneLen * l;
      // B[l][0] = H'(1024)(H0 || LE32(0) || LE32(l))
      H0[17] = l;
      H0[16] = 0;
      const first = Hp(H0, 1024);
      for (let j = 0; j < 256; j++) B[i + j] = first[j];
      // B[l][1] = H'(1024)(H0 || LE32(1) || LE32(l))
      H0[16] = 1;
      const second = Hp(H0, 1024);
      for (let j = 0; j < 256; j++) B[i + 256 + j] = second[j];
    }

    return B;
  }

  /**
   * Compute final output from memory
   * @param {uint32[]} B - Memory
   * @param {int32} p - Lanes
   * @param {int32} laneLen - Blocks per lane
   * @param {int32} dkLen - Tag length in bytes
   * @returns {uint32[]} Tag as little-endian words
   */
  function argon2Output(B, p, laneLen, dkLen) {
    /** @type {uint32[]} */
    const B_final = new Uint32Array(256);
    for (let l = 0; l < p; l++) {
      for (let j = 0; j < 256; j++) {
        B_final[j] = OpCodes.Xor32(B_final[j], B[256 * (laneLen * l + laneLen - 1) + j]);
      }
    }
    return Hp(B_final, dkLen);
  }

  /**
   * Main Argon2 computation
   * @param {uint8[]} password - Password bytes
   * @param {uint8[]} salt - Salt bytes
   * @param {int32} timeCost - Passes
   * @param {int32} memoryCost - Memory in KiB
   * @param {int32} parallelism - Lanes
   * @param {int32} outputLength - Tag length in bytes
   * @param {int32} type - Variant (ARGON2D, ARGON2I, ARGON2ID)
   * @param {uint8[]} secret - Secret key bytes
   * @param {uint8[]} ad - Associated data bytes
   * @returns {uint8[]} Tag
   */
  function argon2(password, salt, timeCost, memoryCost, parallelism, outputLength, type, secret, ad) {
    // Validate parameters
    if (timeCost < 1) throw new Error('Time cost must be at least 1');
    if (memoryCost < 8 * parallelism) throw new Error('Memory cost too small');
    if (parallelism < 1) throw new Error('Parallelism must be at least 1');
    if (outputLength < 4) throw new Error('Output length must be at least 4');

    const p = parallelism;
    const t = timeCost;
    const dkLen = outputLength;
    const version = ARGON2_VERSION;

    // Memory layout: m' = 4 * p * floor(m / (4*p))
    /** @type {int32} */
    const mP = 4 * p * Math.floor(memoryCost / (ARGON2_SYNC_POINTS * p));
    /** @type {int32} */
    const laneLen = Math.floor(mP / p);
    /** @type {int32} */
    const segmentLen = Math.floor(laneLen / ARGON2_SYNC_POINTS);

    const B = argon2Init(password, salt, type, p, dkLen, memoryCost, t, version, secret, ad, mP, laneLen);

    // Address block for data-independent addressing: [address, input, zero_block]
    /** @type {uint32[]} */
    const address = new Uint32Array(3 * 256);
    address[256 + 6] = mP;
    address[256 + 8] = t;
    address[256 + 10] = type;

    // Process all passes
    for (let r = 0; r < t; r++) {
      const needXor = r !== 0 && version === 0x13;
      address[256 + 0] = r;

      for (let s = 0; s < ARGON2_SYNC_POINTS; s++) {
        address[256 + 4] = s;
        const dataIndependent = type === ARGON2I || (type === ARGON2ID && r === 0 && s < 2);

        for (let l = 0; l < p; l++) {
          address[256 + 2] = l;
          address[256 + 12] = 0;

          let startPos = 0;
          if (r === 0 && s === 0) {
            startPos = 2;
            if (dataIndependent) {
              address[256 + 12]++;
              block(address, 256, 2 * 256, 0, false);
              block(address, 0, 2 * 256, 0, false);
            }
          }

          // Current block position
          let offset = l * laneLen + s * segmentLen + startPos;
          // Previous block position
          let prev = offset % laneLen !== 0 ? offset - 1 : offset + laneLen - 1;

          for (let index = startPos; index < segmentLen; index++, offset++, prev++) {
            processBlock(B, address, l, r, s, index, laneLen, segmentLen, p, offset, prev, dataIndependent, needXor);
          }
        }
      }
    }

    // Get final output
    const resultU32 = argon2Output(B, p, laneLen, dkLen);

    // Convert the little-endian words to bytes
    /** @type {uint8[]} */
    const result = new Array(dkLen);
    for (let i = 0; i < dkLen; i++) {
      result[i] = OpCodes.And32(OpCodes.Shr32(resultU32[OpCodes.Shr32(i, 2)], ((i % 4) * 8)), 0xFF);
    }

    return result;
  }

  // ===== ALGORITHM CLASSES =====

  /**
   * Argon2d - Data-dependent variant
   */
  class Argon2dAlgorithm extends KdfAlgorithm {
    constructor() {
      super();

      this.name = "Argon2d";
      this.description = "Password Hashing Competition winner (2015) - data-dependent variant providing maximum resistance to GPU cracking attacks but vulnerable to side-channel attacks. Uses memory access patterns dependent on password content.";
      this.inventor = "Alex Biryukov, Daniel Dinu, Dmitry Khovratovich";
      this.year = 2015;
      this.category = CategoryType.KDF;
      this.subCategory = "Memory-Hard Password Hashing";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedOutputSizes = [new KeySize(4, 1024, 1)];
      this.SaltRequired = true;

      this.documentation = [
        new LinkItem("RFC 9106 - Argon2 Memory-Hard Function for Password Hashing", "https://datatracker.ietf.org/doc/html/rfc9106"),
        new LinkItem("Argon2 Specification", "https://github.com/P-H-C/phc-winner-argon2/blob/master/argon2-specs.pdf"),
        new LinkItem("Password Hashing Competition", "https://www.password-hashing.net/")
      ];

      this.references = [
        new LinkItem("PHC Winner Argon2 Reference Implementation", "https://github.com/P-H-C/phc-winner-argon2"),
        new LinkItem("Botan Argon2 Implementation", "https://botan.randombit.net/"),
        new LinkItem("NIST - Password-Based Key Derivation", "https://csrc.nist.gov/projects/password-hashing")
      ];

      // Test vectors from Botan argon2.vec (official test vectors)
      this.tests = [
        {
          text: "Botan Official Test Vector - Argon2d (M=32, T=3, P=4)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec",
          input: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          password: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          salt: OpCodes.Hex8ToBytes("02020202020202020202020202020202"),
          secret: OpCodes.Hex8ToBytes("0303030303030303"),
          ad: OpCodes.Hex8ToBytes("040404040404040404040404"),
          M: 32,
          T: 3,
          P: 4,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("512b391b6f1162975371d30919734294f868e3be3984f3c1a13a4db9fabe4acb")
        },
        {
          text: "Botan Official Test Vector - Argon2d (M=64, T=3, P=4)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec",
          input: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          password: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          salt: OpCodes.Hex8ToBytes("02020202020202020202020202020202"),
          secret: OpCodes.Hex8ToBytes("0303030303030303"),
          ad: OpCodes.Hex8ToBytes("040404040404040404040404"),
          M: 64,
          T: 3,
          P: 4,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("ab75c7556cd63bbaa818e02dbdfe8c69e80375d64b31d6a7b2bf41da7f7c9951")
        },
        {
          text: "Botan Official Test Vector - Argon2d (M=128, T=3, P=4)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec",
          input: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          password: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          salt: OpCodes.Hex8ToBytes("02020202020202020202020202020202"),
          secret: OpCodes.Hex8ToBytes("0303030303030303"),
          ad: OpCodes.Hex8ToBytes("040404040404040404040404"),
          M: 128,
          T: 3,
          P: 4,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("5fc18a6a56b67cadf60287babc490ca0e866f0880a2b51e56a0ab0a640179d13")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Argon2Instance} New instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new Argon2Instance(this, ARGON2D);
    }
  }

  /**
   * Argon2i - Data-independent variant
   */
  class Argon2iAlgorithm extends KdfAlgorithm {
    constructor() {
      super();

      this.name = "Argon2i";
      this.description = "Password Hashing Competition winner (2015) - data-independent variant resistant to side-channel attacks. Memory access patterns are independent of password content, making it suitable for password hashing in environments with potential side-channel threats.";
      this.inventor = "Alex Biryukov, Daniel Dinu, Dmitry Khovratovich";
      this.year = 2015;
      this.category = CategoryType.KDF;
      this.subCategory = "Memory-Hard Password Hashing";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedOutputSizes = [new KeySize(4, 1024, 1)];
      this.SaltRequired = true;

      this.documentation = [
        new LinkItem("RFC 9106 - Argon2 Memory-Hard Function for Password Hashing", "https://datatracker.ietf.org/doc/html/rfc9106"),
        new LinkItem("Argon2 Specification", "https://github.com/P-H-C/phc-winner-argon2/blob/master/argon2-specs.pdf"),
        new LinkItem("Password Hashing Competition", "https://www.password-hashing.net/")
      ];

      this.references = [
        new LinkItem("PHC Winner Argon2 Reference Implementation", "https://github.com/P-H-C/phc-winner-argon2"),
        new LinkItem("Botan Argon2 Implementation", "https://botan.randombit.net/"),
        new LinkItem("NIST - Password-Based Key Derivation", "https://csrc.nist.gov/projects/password-hashing")
      ];

      // Test vectors from Botan argon2.vec (official test vectors)
      this.tests = [
        {
          text: "Botan Official Test Vector - Argon2i (M=32, T=3, P=4)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec",
          input: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          password: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          salt: OpCodes.Hex8ToBytes("02020202020202020202020202020202"),
          secret: OpCodes.Hex8ToBytes("0303030303030303"),
          ad: OpCodes.Hex8ToBytes("040404040404040404040404"),
          M: 32,
          T: 3,
          P: 4,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("c814d9d1dc7f37aa13f0d77f2494bda1c8de6b016dd388d29952a4c4672b6ce8")
        },
        {
          text: "Botan Official Test Vector - Argon2i (M=64, T=3, P=4)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec",
          input: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          password: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          salt: OpCodes.Hex8ToBytes("02020202020202020202020202020202"),
          secret: OpCodes.Hex8ToBytes("0303030303030303"),
          ad: OpCodes.Hex8ToBytes("040404040404040404040404"),
          M: 64,
          T: 3,
          P: 4,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("0f639e5eb9ae1d4d582ccb6033b95551f916a2bdf48ae23d2b8ba4414eb6a182")
        },
        {
          text: "Botan Official Test Vector - Argon2i (M=128, T=3, P=4)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec",
          input: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          password: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          salt: OpCodes.Hex8ToBytes("02020202020202020202020202020202"),
          secret: OpCodes.Hex8ToBytes("0303030303030303"),
          ad: OpCodes.Hex8ToBytes("040404040404040404040404"),
          M: 128,
          T: 3,
          P: 4,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("88031ec2094b24a9c4399e7f3fdaa5701dc3bae89917c6ba582e924a547a623d")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Argon2Instance} New instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new Argon2Instance(this, ARGON2I);
    }
  }

  /**
   * Argon2id - Hybrid variant (RECOMMENDED)
   */
  class Argon2idAlgorithm extends KdfAlgorithm {
    constructor() {
      super();

      this.name = "Argon2id";
      this.description = "Password Hashing Competition winner (2015) - hybrid variant combining Argon2d and Argon2i. RECOMMENDED for general password hashing. First half uses data-independent addressing (Argon2i), second half uses data-dependent (Argon2d), providing both side-channel resistance and GPU attack resistance.";
      this.inventor = "Alex Biryukov, Daniel Dinu, Dmitry Khovratovich";
      this.year = 2015;
      this.category = CategoryType.KDF;
      this.subCategory = "Memory-Hard Password Hashing";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedOutputSizes = [new KeySize(4, 1024, 1)];
      this.SaltRequired = true;

      this.documentation = [
        new LinkItem("RFC 9106 - Argon2 Memory-Hard Function for Password Hashing", "https://datatracker.ietf.org/doc/html/rfc9106"),
        new LinkItem("Argon2 Specification", "https://github.com/P-H-C/phc-winner-argon2/blob/master/argon2-specs.pdf"),
        new LinkItem("Password Hashing Competition", "https://www.password-hashing.net/")
      ];

      this.references = [
        new LinkItem("PHC Winner Argon2 Reference Implementation", "https://github.com/P-H-C/phc-winner-argon2"),
        new LinkItem("Botan Argon2 Implementation", "https://botan.randombit.net/"),
        new LinkItem("NIST - Password-Based Key Derivation", "https://csrc.nist.gov/projects/password-hashing")
      ];

      // Test vectors from Botan argon2.vec (official test vectors)
      this.tests = [
        {
          text: "Botan Official Test Vector - Argon2id (M=32, T=3, P=4)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec",
          input: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          password: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          salt: OpCodes.Hex8ToBytes("02020202020202020202020202020202"),
          secret: OpCodes.Hex8ToBytes("0303030303030303"),
          ad: OpCodes.Hex8ToBytes("040404040404040404040404"),
          M: 32,
          T: 3,
          P: 4,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659")
        },
        {
          text: "Botan Official Test Vector - Argon2id (M=64, T=3, P=4)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec",
          input: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          password: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          salt: OpCodes.Hex8ToBytes("02020202020202020202020202020202"),
          secret: OpCodes.Hex8ToBytes("0303030303030303"),
          ad: OpCodes.Hex8ToBytes("040404040404040404040404"),
          M: 64,
          T: 3,
          P: 4,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("4275ee5ad887fe3270e82f01e97db8af3cf63fc7f2102bfea84b305f416a4544")
        },
        {
          text: "Botan Official Test Vector - Argon2id (M=128, T=3, P=4)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec",
          input: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          password: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          salt: OpCodes.Hex8ToBytes("02020202020202020202020202020202"),
          secret: OpCodes.Hex8ToBytes("0303030303030303"),
          ad: OpCodes.Hex8ToBytes("040404040404040404040404"),
          M: 128,
          T: 3,
          P: 4,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("8ec72f253bd35d55c3e49c587c77665c9c7fcff26cb3cabe179039b7c4281a48")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Argon2Instance} New instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new Argon2Instance(this, ARGON2ID);
    }
  }

  /**
   * Argon2 Instance - Shared by all variants
   * @class
   * @extends {IKdfInstance}
   */
  class Argon2Instance extends IKdfInstance {
    /**
     * Initialize an Argon2 instance with the default (educational) parameters
     * @param {KdfAlgorithm} algorithm - Parent algorithm instance
     * @param {int32} variant - ARGON2D, ARGON2I or ARGON2ID
     */
    constructor(algorithm, variant) {
      super(algorithm);
      /** @type {int32} */
      this.variant = variant;
      /** @type {uint8[]} */
      this._password = null;
      /** @type {uint8[]} Bytes collected by Feed */
      this._fedPassword = null;
      /** @type {uint8[]} */
      this._salt = null;
      /** @type {uint8[]} */
      this._secret = null;
      /** @type {uint8[]} */
      this._ad = null;
      /** @type {int32} Memory cost in KB (reduced for educational testing) */
      this._M = 32;
      /** @type {int32} Time cost (iterations) */
      this._T = 3;
      /** @type {int32} Parallelism */
      this._P = 4;
      this.OutputSize = 32;
    }

    /** @returns {uint8[]} Password bytes */
    get password() { return this._password; }
    /** @param {uint8[]} pwd - Password bytes (copied) */
    set password(pwd) {
      this._password = new Uint8Array(pwd);
    }

    /** @returns {uint8[]} Salt bytes */
    get salt() { return this._salt; }
    /** @param {uint8[]} saltData - Salt bytes (copied) */
    set salt(saltData) {
      this._salt = new Uint8Array(saltData);
    }

    /** @returns {uint8[]} Secret key bytes */
    get secret() { return this._secret; }
    /** @param {uint8[]} sec - Secret key bytes (copied) */
    set secret(sec) {
      this._secret = new Uint8Array(sec);
    }

    /** @returns {uint8[]} Associated data bytes */
    get ad() { return this._ad; }
    /** @param {uint8[]} adData - Associated data bytes (copied) */
    set ad(adData) {
      this._ad = new Uint8Array(adData);
    }

    /** @returns {int32} Memory cost in KiB */
    get M() { return this._M; }
    /** @param {int32} m - Memory cost in KiB */
    set M(m) { this._M = m; }

    /** @returns {int32} Time cost */
    get T() { return this._T; }
    /** @param {int32} t - Time cost */
    set T(t) { this._T = t; }

    /** @returns {int32} Parallelism */
    get P() { return this._P; }
    /** @param {int32} p - Parallelism */
    set P(p) { this._P = p; }

    /** @returns {int32} Tag length in bytes */
    get outputSize() { return this.OutputSize; }
    /** @param {int32} value - Tag length in bytes */
    set outputSize(value) { this.OutputSize = value; }

    /**
   * Append password bytes (ignored when a password was set through the property)
   * @param {uint8[]} data - Password bytes
   * @returns {void}
   */

    Feed(data) {
      // Feed is a streaming interface: successive calls extend the password
      // rather than being dropped, so Feed(a); Feed(b) derives from the same
      // octet string as Feed(a || b). A password set through the property still
      // takes precedence over the fed bytes, exactly as before.
      if (this._password && !this._fedPassword) return;
      if (!this._fedPassword) this._fedPassword = [];
      for (let i = 0; i < data.length; i++) this._fedPassword.push(data[i]);
      this._password = new Uint8Array(this._fedPassword);
    }

    /**
   * Derive the Argon2 tag
   * @returns {uint8[]} Tag bytes
   * @throws {Error} If password or salt is missing, or a parameter is out of range
   */
    Result() {
      if (!this._password || !this._salt) {
        throw new Error('Password and salt required for Argon2');
      }

      // Parameters left unset (0, null) take their defaults
      /** @type {uint8[]} */
      let secret = this._secret;
      if (!secret) secret = new Uint8Array(0);
      /** @type {uint8[]} */
      let ad = this._ad;
      if (!ad) ad = new Uint8Array(0);

      return argon2(
        this._password,
        this._salt,
        this._T ? this._T : 3,
        this._M ? this._M : 32,
        this._P ? this._P : 4,
        this.OutputSize ? this.OutputSize : 32,
        this.variant,
        secret,
        ad
      );
    }
  }

  // Register all three variants
  RegisterAlgorithm(new Argon2dAlgorithm());
  RegisterAlgorithm(new Argon2iAlgorithm());
  RegisterAlgorithm(new Argon2idAlgorithm());

  // Return for module systems
  return {
    Argon2dAlgorithm,
    Argon2iAlgorithm,
    Argon2idAlgorithm,
    Argon2Instance,
    Argon2Type: Object.freeze({ Argon2d: ARGON2D, Argon2i: ARGON2I, Argon2id: ARGON2ID })
  };
}));
