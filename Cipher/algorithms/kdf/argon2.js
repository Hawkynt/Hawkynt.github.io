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

  const ARGON2_VERSION = 0x13; // Version 1.3 (current standard)
  const ARGON2_BLOCK_SIZE = 1024; // Block size in bytes (1 KB)
  const ARGON2_QWORDS_IN_BLOCK = ARGON2_BLOCK_SIZE / 8; // 128 qwords per block
  const ARGON2_SYNC_POINTS = 4; // Number of synchronization points

  // Argon2 variant types
  const Argon2Type = Object.freeze({
    Argon2d: 0,  // Data-dependent (max resistance to GPU attacks)
    Argon2i: 1,  // Data-independent (side-channel resistant)
    Argon2id: 2  // Hybrid (recommended for general use)
  });

  // ===== BLAKE2B LONG HASH =====

  /**
   * Blake2b-based long hash function used in Argon2
   * Similar to Blake2b but can produce outputs > 64 bytes
   */
  function blake2bLong(input, outputLength) {
    const BLAKE2B_OUTBYTES = 64;

    if (outputLength <= BLAKE2B_OUTBYTES) {
      return blake2b(input, null, outputLength);
    }

    // For outputs > 64 bytes, use extended construction
    const result = new Uint8Array(outputLength);

    // First block: H0 = H(LE32(outputLength) || input)
    const lengthBytes = new Uint8Array(4);
    lengthBytes[0] = outputLength & 0xFF;
    lengthBytes[1] = (outputLength >> 8) & 0xFF;
    lengthBytes[2] = (outputLength >> 16) & 0xFF;
    lengthBytes[3] = (outputLength >> 24) & 0xFF;

    const firstInput = new Uint8Array(lengthBytes.length + input.length);
    firstInput.set(lengthBytes, 0);
    firstInput.set(input, lengthBytes.length);

    const v = blake2b(firstInput, null, BLAKE2B_OUTBYTES);
    result.set(v.slice(0, Math.min(BLAKE2B_OUTBYTES / 2, outputLength)), 0);

    let pos = BLAKE2B_OUTBYTES / 2;

    // Generate remaining blocks: Hi = H(Hi-1)
    let prevHash = v;
    while (pos < outputLength) {
      const currentHash = blake2b(prevHash, null, BLAKE2B_OUTBYTES);
      const toCopy = Math.min(BLAKE2B_OUTBYTES / 2, outputLength - pos);
      result.set(currentHash.slice(0, toCopy), pos);
      pos += BLAKE2B_OUTBYTES / 2;
      prevHash = currentHash;
    }

    return result;
  }

  /**
   * Standard Blake2b hash function
   */
  function blake2b(input, key, outputLength) {
    const BLAKE2B_BLOCKBYTES = 128;
    const BLAKE2B_OUTBYTES = 64;

    const IV = [
      BigInt('0x6a09e667f3bcc908'), BigInt('0xbb67ae8584caa73b'),
      BigInt('0x3c6ef372fe94f82b'), BigInt('0xa54ff53a5f1d36f1'),
      BigInt('0x510e527fade682d1'), BigInt('0x9b05688c2b3e6c1f'),
      BigInt('0x1f83d9abfb41bd6b'), BigInt('0x5be0cd19137e2179')
    ];

    const SIGMA = [
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

    function rotr64(x, n) {
      const mask = BigInt('0xffffffffffffffff');
      x = x & mask;
      n = BigInt(n) & BigInt(63);
      return ((x >> n) | (x << (BigInt(64) - n))) & mask;
    }

    function G(v, a, b, c, d, x, y) {
      const mask = BigInt('0xffffffffffffffff');
      v[a] = (v[a] + v[b] + x) & mask;
      v[d] = rotr64(v[d] ^ v[a], 32);
      v[c] = (v[c] + v[d]) & mask;
      v[b] = rotr64(v[b] ^ v[c], 24);
      v[a] = (v[a] + v[b] + y) & mask;
      v[d] = rotr64(v[d] ^ v[a], 16);
      v[c] = (v[c] + v[d]) & mask;
      v[b] = rotr64(v[b] ^ v[c], 63);
    }

    function compress(h, block, counter, finalBlock) {
      const v = new Array(16);

      for (let i = 0; i < 8; i++) v[i] = h[i];
      for (let i = 0; i < 8; i++) v[i + 8] = IV[i];

      v[12] ^= counter & BigInt('0xffffffffffffffff');
      v[13] ^= (counter >> BigInt(64)) & BigInt('0xffffffffffffffff');
      if (finalBlock) v[14] ^= BigInt('0xffffffffffffffff');

      for (let round = 0; round < 12; round++) {
        const s = SIGMA[round % 10];
        G(v, 0, 4, 8, 12, block[s[0]], block[s[1]]);
        G(v, 1, 5, 9, 13, block[s[2]], block[s[3]]);
        G(v, 2, 6, 10, 14, block[s[4]], block[s[5]]);
        G(v, 3, 7, 11, 15, block[s[6]], block[s[7]]);
        G(v, 0, 5, 10, 15, block[s[8]], block[s[9]]);
        G(v, 1, 6, 11, 12, block[s[10]], block[s[11]]);
        G(v, 2, 7, 8, 13, block[s[12]], block[s[13]]);
        G(v, 3, 4, 9, 14, block[s[14]], block[s[15]]);
      }

      for (let i = 0; i < 8; i++) {
        h[i] ^= v[i] ^ v[i + 8];
      }
    }

    function bytesToWords64LE(bytes) {
      const words = [];
      for (let i = 0; i < bytes.length; i += 8) {
        let word = BigInt(0);
        for (let j = 0; j < 8 && i + j < bytes.length; j++) {
          word |= BigInt(bytes[i + j]) << BigInt(j * 8);
        }
        words.push(word);
      }
      return words;
    }

    function words64ToBytes(words, length) {
      const bytes = new Uint8Array(length);
      let byteIndex = 0;
      for (let i = 0; i < words.length && byteIndex < length; i++) {
        let word = words[i];
        for (let j = 0; j < 8 && byteIndex < length; j++) {
          bytes[byteIndex++] = Number(word & BigInt('0xff'));
          word >>= BigInt(8);
        }
      }
      return bytes;
    }

    // Initialize state
    const h = [...IV];
    h[0] ^= BigInt(outputLength || BLAKE2B_OUTBYTES) |
            (BigInt(key ? key.length : 0) << BigInt(8)) |
            (BigInt(1) << BigInt(16)) |
            (BigInt(1) << BigInt(24));

    let counter = BigInt(0);
    const buffer = new Uint8Array(BLAKE2B_BLOCKBYTES);
    let bufferPos = 0;

    // Process key if provided
    if (key && key.length > 0) {
      const keyPadded = new Uint8Array(BLAKE2B_BLOCKBYTES);
      for (let i = 0; i < key.length && i < 64; i++) {
        keyPadded[i] = key[i];
      }
      counter += BigInt(BLAKE2B_BLOCKBYTES);
      const m = bytesToWords64LE(keyPadded);
      while (m.length < 16) m.push(BigInt(0));
      compress(h, m, counter, false);
    }

    // Process input
    for (let i = 0; i < input.length; i++) {
      buffer[bufferPos++] = input[i];

      if (bufferPos === BLAKE2B_BLOCKBYTES) {
        counter += BigInt(BLAKE2B_BLOCKBYTES);
        const m = bytesToWords64LE(buffer);
        while (m.length < 16) m.push(BigInt(0));
        compress(h, m, counter, false);
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
    compress(h, m, counter, true);

    return words64ToBytes(h, outputLength || BLAKE2B_OUTBYTES);
  }

  // ===== ARGON2 CORE FUNCTIONS =====
  // Using Uint32Array with [low, high] pairs for 64-bit values (matching noble-hashes approach)

  // Temporary block buffer - 256 u32 = 128 u64 = 1024 bytes
  const A2_BUF = new Uint32Array(256);

  /**
   * 32-bit multiply returning 64-bit result as {h, l}
   */
  function mul(a, b) {
    const aL = a & 0xffff;
    const aH = a >>> 16;
    const bL = b & 0xffff;
    const bH = b >>> 16;
    const ll = Math.imul(aL, bL);
    const hl = Math.imul(aH, bL);
    const lh = Math.imul(aL, bH);
    const hh = Math.imul(aH, bH);
    const carry = (ll >>> 16) + (hl & 0xffff) + lh;
    const high = (hh + (hl >>> 16) + (carry >>> 16)) | 0;
    const low = (carry << 16) | (ll & 0xffff);
    return { h: high, l: low };
  }

  /**
   * 2 * a * b (via shifts) - returns 64-bit result
   */
  function mul2(a, b) {
    const { h, l } = mul(a, b);
    return { h: ((h << 1) | (l >>> 31)) & 0xffffffff, l: (l << 1) & 0xffffffff };
  }

  /**
   * 64-bit addition of 3 values: Al + Bl + Cl (returns lower 32 bits)
   */
  function add3L(Al, Bl, Cl) {
    return (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
  }

  /**
   * 64-bit addition of 3 values: returns high 32 bits with carry from low
   */
  function add3H(low, Ah, Bh, Ch) {
    return (Ah + Bh + Ch + ((low / 0x100000000) | 0)) | 0;
  }

  /**
   * 64-bit right rotate by 32 (just swaps h and l)
   */
  function rotr32H(_h, l) { return l; }
  function rotr32L(h, _l) { return h; }

  /**
   * 64-bit right rotate for shift in [1, 32)
   */
  function rotrSH(h, l, s) { return (h >>> s) | (l << (32 - s)); }
  function rotrSL(h, l, s) { return (h << (32 - s)) | (l >>> s); }

  /**
   * 64-bit right rotate for shift in (32, 64)
   */
  function rotrBH(h, l, s) { return (h << (64 - s)) | (l >>> (s - 32)); }
  function rotrBL(h, l, s) { return (h >>> (s - 32)) | (l << (64 - s)); }

  /**
   * BlaMka: A + B + (2 * u32(A) * u32(B))
   */
  function blamka(Ah, Al, Bh, Bl) {
    const { h: Ch, l: Cl } = mul2(Al, Bl);
    const Rll = add3L(Al, Bl, Cl);
    return { h: add3H(Rll, Ah, Bh, Ch), l: Rll | 0 };
  }

  /**
   * G function operating on A2_BUF with index-based access
   */
  function G(a, b, c, d) {
    let Al = A2_BUF[2*a], Ah = A2_BUF[2*a + 1];
    let Bl = A2_BUF[2*b], Bh = A2_BUF[2*b + 1];
    let Cl = A2_BUF[2*c], Ch = A2_BUF[2*c + 1];
    let Dl = A2_BUF[2*d], Dh = A2_BUF[2*d + 1];

    ({ h: Ah, l: Al } = blamka(Ah, Al, Bh, Bl));
    ({ Dh, Dl } = { Dh: Dh ^ Ah, Dl: Dl ^ Al });
    ({ Dh, Dl } = { Dh: rotr32H(Dh, Dl), Dl: rotr32L(Dh, Dl) });

    ({ h: Ch, l: Cl } = blamka(Ch, Cl, Dh, Dl));
    ({ Bh, Bl } = { Bh: Bh ^ Ch, Bl: Bl ^ Cl });
    ({ Bh, Bl } = { Bh: rotrSH(Bh, Bl, 24), Bl: rotrSL(Bh, Bl, 24) });

    ({ h: Ah, l: Al } = blamka(Ah, Al, Bh, Bl));
    ({ Dh, Dl } = { Dh: Dh ^ Ah, Dl: Dl ^ Al });
    ({ Dh, Dl } = { Dh: rotrSH(Dh, Dl, 16), Dl: rotrSL(Dh, Dl, 16) });

    ({ h: Ch, l: Cl } = blamka(Ch, Cl, Dh, Dl));
    ({ Bh, Bl } = { Bh: Bh ^ Ch, Bl: Bl ^ Cl });
    ({ Bh, Bl } = { Bh: rotrBH(Bh, Bl, 63), Bl: rotrBL(Bh, Bl, 63) });

    A2_BUF[2*a] = Al; A2_BUF[2*a + 1] = Ah;
    A2_BUF[2*b] = Bl; A2_BUF[2*b + 1] = Bh;
    A2_BUF[2*c] = Cl; A2_BUF[2*c + 1] = Ch;
    A2_BUF[2*d] = Dl; A2_BUF[2*d + 1] = Dh;
  }

  /**
   * P permutation: applies G to 16 elements in column then diagonal pattern
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
   * Memory layout uses Uint32Array with 256 elements per block (128 u64 values)
   */
  function block(B, xPos, yPos, outPos, needXor) {
    // XOR input blocks into A2_BUF
    for (let i = 0; i < 256; i++) {
      A2_BUF[i] = B[xPos + i] ^ B[yPos + i];
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
        B[outPos + i] ^= A2_BUF[i] ^ B[xPos + i] ^ B[yPos + i];
      }
    } else {
      for (let i = 0; i < 256; i++) {
        B[outPos + i] = A2_BUF[i] ^ B[xPos + i] ^ B[yPos + i];
      }
    }

    // Clear temporary buffer
    A2_BUF.fill(0);
  }

  /**
   * Variable-length hash function H' using Blake2b
   * @param {Uint32Array} A - Input data as u32 array
   * @param {number} dkLen - Desired output length in bytes
   * @returns {Uint32Array} - Output as u32 array
   */
  function Hp(A, dkLen) {
    const A8 = new Uint8Array(A.buffer, A.byteOffset, A.byteLength);
    const T = new Uint32Array(1);
    T[0] = dkLen;
    const T8 = new Uint8Array(T.buffer);

    // Build input: LE32(dkLen) || A
    const input = new Uint8Array(4 + A8.length);
    input.set(T8, 0);
    input.set(A8, 4);

    if (dkLen <= 64) {
      // Fast path: single blake2b call
      const hash = blake2b(input, null, dkLen);
      const result = new Uint32Array(Math.ceil(dkLen / 4));
      const hashView = new Uint8Array(hash);
      for (let i = 0; i < dkLen; i++) {
        if (i % 4 === 0) result[i >> 2] = 0;
        result[i >> 2] |= hashView[i] << ((i % 4) * 8);
      }
      return result;
    }

    // Long output: chain blake2b calls
    const out = new Uint8Array(dkLen);
    let V = blake2b(input, null, 64);
    let pos = 0;

    // First block: copy first 32 bytes
    out.set(new Uint8Array(V).subarray(0, 32), pos);
    pos += 32;

    // Middle blocks
    while (dkLen - pos > 64) {
      V = blake2b(V, null, 64);
      out.set(new Uint8Array(V).subarray(0, 32), pos);
      pos += 32;
    }

    // Last block
    const lastLen = dkLen - pos;
    V = blake2b(V, null, lastLen);
    out.set(new Uint8Array(V).subarray(0, lastLen), pos);

    // Convert to Uint32Array
    const result = new Uint32Array(Math.ceil(dkLen / 4));
    for (let i = 0; i < dkLen; i++) {
      if (i % 4 === 0) result[i >> 2] = 0;
      result[i >> 2] |= out[i] << ((i % 4) * 8);
    }
    return result;
  }

  /**
   * Index alpha calculation for reference block selection
   */
  function indexAlpha(r, s, laneLen, segmentLen, index, randL, sameLane) {
    let area;
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
    const rel = area - 1 - mul(area, mul(randL, randL).h).h;
    return (startPos + rel) % laneLen;
  }

  /**
   * Process a single block in a segment
   */
  function processBlock(B, address, l, r, s, index, laneLen, segmentLen, lanes, offset, prev, dataIndependent, needXor) {
    if (offset % laneLen) prev = offset - 1;

    let randL, randH;
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
    const refLane = (r === 0 && s === 0) ? l : randH % lanes;
    const refPos = indexAlpha(r, s, laneLen, segmentLen, index, randL, refLane === l);
    const refBlock = laneLen * refLane + refPos;

    // Apply block compression
    block(B, 256 * prev, 256 * refBlock, offset * 256, needXor);
  }

  /**
   * Initialize Argon2: compute H0 and setup memory
   */
  function argon2Init(password, salt, type, opts) {
    const { p, dkLen, m, t, version, key, personalization } = opts;

    // Compute H0 = Blake2b(LE32(p) || LE32(dkLen) || LE32(m) || LE32(t) ||
    //                       LE32(version) || LE32(type) ||
    //                       LE32(|password|) || password ||
    //                       LE32(|salt|) || salt ||
    //                       LE32(|key|) || key ||
    //                       LE32(|personalization|) || personalization)
    const BUF = new Uint32Array(1);
    const BUF8 = new Uint8Array(BUF.buffer);

    // Build input manually
    const items = [p, dkLen, m, t, version, type];
    const dataItems = [password, salt, key || new Uint8Array(0), personalization || new Uint8Array(0)];

    let totalLen = items.length * 4;
    for (const item of dataItems) {
      totalLen += 4 + item.length;
    }

    const input = new Uint8Array(totalLen);
    let pos = 0;

    for (const item of items) {
      input[pos++] = item & 0xFF;
      input[pos++] = (item >> 8) & 0xFF;
      input[pos++] = (item >> 16) & 0xFF;
      input[pos++] = (item >> 24) & 0xFF;
    }

    for (const data of dataItems) {
      input[pos++] = data.length & 0xFF;
      input[pos++] = (data.length >> 8) & 0xFF;
      input[pos++] = (data.length >> 16) & 0xFF;
      input[pos++] = (data.length >> 24) & 0xFF;
      input.set(data, pos);
      pos += data.length;
    }

    const H0_bytes = blake2b(input, null, 64);
    const H0 = new Uint32Array(18);
    const H0_8 = new Uint8Array(H0.buffer);
    H0_8.set(new Uint8Array(H0_bytes));

    // Memory layout
    const lanes = p;
    // m' = 4 * p * floor(m / (4*p))
    const mP = 4 * p * Math.floor(m / (ARGON2_SYNC_POINTS * p));
    const laneLen = Math.floor(mP / p);
    const segmentLen = Math.floor(laneLen / ARGON2_SYNC_POINTS);

    // Allocate memory: 256 u32 per block
    const memUsed = mP * 256;
    const B = new Uint32Array(memUsed);

    // Fill first two blocks of each lane
    for (let l = 0; l < p; l++) {
      const i = 256 * laneLen * l;
      // B[l][0] = H'(1024)(H0 || LE32(0) || LE32(l))
      H0[17] = l;
      H0[16] = 0;
      B.set(Hp(H0, 1024), i);
      // B[l][1] = H'(1024)(H0 || LE32(1) || LE32(l))
      H0[16] = 1;
      B.set(Hp(H0, 1024), i + 256);
    }

    return { type, mP, p, t, version, B, laneLen, lanes, segmentLen, dkLen };
  }

  /**
   * Compute final output from memory
   */
  function argon2Output(B, p, laneLen, dkLen) {
    const B_final = new Uint32Array(256);
    for (let l = 0; l < p; l++) {
      for (let j = 0; j < 256; j++) {
        B_final[j] ^= B[256 * (laneLen * l + laneLen - 1) + j];
      }
    }
    return Hp(B_final, dkLen);
  }

  /**
   * Main Argon2 computation
   */
  function argon2(password, salt, timeCost, memoryCost, parallelism, outputLength, type, secret, ad) {
    // Validate parameters
    if (timeCost < 1) throw new Error('Time cost must be at least 1');
    if (memoryCost < 8 * parallelism) throw new Error('Memory cost too small');
    if (parallelism < 1) throw new Error('Parallelism must be at least 1');
    if (outputLength < 4) throw new Error('Output length must be at least 4');

    const opts = {
      p: parallelism,
      dkLen: outputLength,
      m: memoryCost,
      t: timeCost,
      version: ARGON2_VERSION,
      key: secret,
      personalization: ad
    };

    const { mP, p, t, version, B, laneLen, lanes, segmentLen, dkLen } = argon2Init(password, salt, type, opts);

    // Address block for data-independent addressing: [address, input, zero_block]
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
        const dataIndependent = type === Argon2Type.Argon2i || (type === Argon2Type.Argon2id && r === 0 && s < 2);

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
          let prev = offset % laneLen ? offset - 1 : offset + laneLen - 1;

          for (let index = startPos; index < segmentLen; index++, offset++, prev++) {
            processBlock(B, address, l, r, s, index, laneLen, segmentLen, lanes, offset, prev, dataIndependent, needXor);
          }
        }
      }
    }

    // Get final output
    const resultU32 = argon2Output(B, p, laneLen, dkLen);

    // Convert Uint32Array to byte array
    const result = new Uint8Array(dkLen);
    for (let i = 0; i < dkLen; i++) {
      result[i] = (resultU32[i >> 2] >> ((i % 4) * 8)) & 0xFF;
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
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new Argon2Instance(this, Argon2Type.Argon2d);
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
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new Argon2Instance(this, Argon2Type.Argon2i);
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
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new Argon2Instance(this, Argon2Type.Argon2id);
    }
  }

  /**
   * Argon2 Instance - Shared by all variants
   */
  class Argon2Instance extends IKdfInstance {
    constructor(algorithm, variant) {
      super(algorithm);
      this.variant = variant;
      this._password = null;
      this._salt = null;
      this._secret = null;
      this._ad = null;
      this._M = 32; // Memory cost in KB (reduced for educational testing)
      this._T = 3;  // Time cost (iterations)
      this._P = 4;  // Parallelism
      this.OutputSize = 32;
    }

    get password() { return this._password; }
    set password(pwd) {
      this._password = pwd instanceof Uint8Array ? pwd : new Uint8Array(pwd);
    }

    get salt() { return this._salt; }
    set salt(saltData) {
      this._salt = saltData instanceof Uint8Array ? saltData : new Uint8Array(saltData);
    }

    get secret() { return this._secret; }
    set secret(sec) {
      this._secret = sec instanceof Uint8Array ? sec : new Uint8Array(sec);
    }

    get ad() { return this._ad; }
    set ad(adData) {
      this._ad = adData instanceof Uint8Array ? adData : new Uint8Array(adData);
    }

    get M() { return this._M; }
    set M(m) { this._M = m; }

    get T() { return this._T; }
    set T(t) { this._T = t; }

    get P() { return this._P; }
    set P(p) { this._P = p; }

    get outputSize() { return this.OutputSize; }
    set outputSize(value) { this.OutputSize = value; }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!this._password) {
        this._password = data instanceof Uint8Array ? data : new Uint8Array(data);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */
    Result() {
      if (!this._password || !this._salt) {
        throw new Error('Password and salt required for Argon2');
      }

      return Array.from(argon2(
        this._password,
        this._salt,
        this._T || 3,
        this._M || 32,
        this._P || 4,
        this.OutputSize || 32,
        this.variant,
        this._secret || new Uint8Array(0),
        this._ad || new Uint8Array(0)
      ));
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
    Argon2Type
  };
}));
