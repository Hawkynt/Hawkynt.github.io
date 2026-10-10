

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
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem,
          BlockAbsorber, KeySize } = AlgorithmFramework;

  // ===== SHARED BLAKE2 CONSTANTS =====

  // Shared sigma permutation schedule (used by both BLAKE2b and BLAKE2s)
  /** @type {int32[][]} */
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

  /**
   * A zero-filled byte array
   * @param {int32} length - Number of bytes
   * @returns {uint8[]} length zero bytes
   */
  function zeroBytes(length) {
    /** @type {uint8[]} */
    const bytes = [];
    for (let i = 0; i < length; i++) bytes.push(0);
    return bytes;
  }

  // ===== BLAKE2B (64-BIT) IMPLEMENTATION =====

  // BLAKE2b constants
  /** @type {int32} */
  const BLAKE2B_BLOCKBYTES = 128;
  /** @type {int32} */
  const BLAKE2B_OUTBYTES = 64;
  /** @type {int32} */
  const BLAKE2B_KEYBYTES = 64;
  /** @type {BigInt} */
  const MASK64 = BigInt('0xffffffffffffffff');

  // BLAKE2b initialization vectors (64-bit words as BigInt values)
  /** @type {BigInt[]} */
  const BLAKE2B_IV = [
    BigInt('0x6a09e667f3bcc908'), BigInt('0xbb67ae8584caa73b'),
    BigInt('0x3c6ef372fe94f82b'), BigInt('0xa54ff53a5f1d36f1'),
    BigInt('0x510e527fade682d1'), BigInt('0x9b05688c2b3e6c1f'),
    BigInt('0x1f83d9abfb41bd6b'), BigInt('0x5be0cd19137e2179')
  ];

  /**
   * BLAKE2b G function (mixing function for 64-bit)
   * @param {BigInt[]} v - Working vector, modified in place
   * @param {int32} a - Index
   * @param {int32} b - Index
   * @param {int32} c - Index
   * @param {int32} d - Index
   * @param {BigInt} x - First message word
   * @param {BigInt} y - Second message word
   * @returns {void}
   */
  function BLAKE2b_G(v, a, b, c, d, x, y) {
    v[a] = OpCodes.AndN(v[a] + v[b] + x, MASK64);
    v[d] = OpCodes.RotR64n(OpCodes.XorN(v[d], v[a]), 32);
    v[c] = OpCodes.AndN(v[c] + v[d], MASK64);
    v[b] = OpCodes.RotR64n(OpCodes.XorN(v[b], v[c]), 24);
    v[a] = OpCodes.AndN(v[a] + v[b] + y, MASK64);
    v[d] = OpCodes.RotR64n(OpCodes.XorN(v[d], v[a]), 16);
    v[c] = OpCodes.AndN(v[c] + v[d], MASK64);
    v[b] = OpCodes.RotR64n(OpCodes.XorN(v[b], v[c]), 63);
  }

  /**
   * BLAKE2b compression function
   * @param {BigInt[]} h - Chaining value, updated in place
   * @param {BigInt[]} m - 16 message words
   * @param {BigInt} t - Byte counter (up to 128 bits)
   * @param {boolean} f - Final-block flag
   * @returns {void}
   */
  function BLAKE2b_compress(h, m, t, f) {
    /** @type {BigInt[]} */
    const v = new Array(16);

    // Initialize working vector
    for (let i = 0; i < 8; i++) {
      v[i] = h[i];
    }
    for (let i = 0; i < 8; i++) {
      v[i + 8] = BLAKE2B_IV[i];
    }

    // Mix counter and final flag
    v[12] = OpCodes.XorN(v[12], OpCodes.AndN(t, MASK64));
    v[13] = OpCodes.XorN(v[13], OpCodes.AndN(OpCodes.ShiftRn(t, 64), MASK64));
    if (f) {
      v[14] = OpCodes.XorN(v[14], MASK64);
    }

    // 12 rounds of mixing
    for (let round = 0; round < 12; round++) {
      const s = SIGMA[round % 10];

      // Mix columns
      BLAKE2b_G(v, 0, 4, 8, 12, m[s[0]], m[s[1]]);
      BLAKE2b_G(v, 1, 5, 9, 13, m[s[2]], m[s[3]]);
      BLAKE2b_G(v, 2, 6, 10, 14, m[s[4]], m[s[5]]);
      BLAKE2b_G(v, 3, 7, 11, 15, m[s[6]], m[s[7]]);

      // Mix diagonals
      BLAKE2b_G(v, 0, 5, 10, 15, m[s[8]], m[s[9]]);
      BLAKE2b_G(v, 1, 6, 11, 12, m[s[10]], m[s[11]]);
      BLAKE2b_G(v, 2, 7, 8, 13, m[s[12]], m[s[13]]);
      BLAKE2b_G(v, 3, 4, 9, 14, m[s[14]], m[s[15]]);
    }

    // Update hash state
    for (let i = 0; i < 8; i++) {
      h[i] = OpCodes.XorN(h[i], OpCodes.XorN(v[i], v[i + 8]));
    }
  }

  /**
   * Convert bytes to 64-bit words (little-endian); a short tail makes a partial word
   * @param {uint8[]} bytes - Input bytes
   * @returns {BigInt[]} Words
   */
  function bytesToWords64(bytes) {
    /** @type {BigInt[]} */
    const words = [];
    for (let i = 0; i < bytes.length; i += 8) {
      /** @type {uint64} */
      let word = BigInt(0);
      for (let j = 0; j < 8 && i + j < bytes.length; j++) {
        word = OpCodes.OrN(word, OpCodes.ShiftLn(BigInt(bytes[i + j]), j * 8));
      }
      words.push(word);
    }
    return words;
  }

  /**
   * Convert 64-bit words to bytes (little-endian)
   * @param {BigInt[]} words - Words, at least length / 8 of them
   * @param {int32} length - Number of bytes to produce
   * @returns {uint8[]} The first length bytes
   */
  function words64ToBytes(words, length) {
    /** @type {uint8[]} */
    const bytes = [];

    for (let i = 0; i < words.length && bytes.length < length; i++) {
      let word = words[i];
      for (let j = 0; j < 8 && bytes.length < length; j++) {
        /** @type {uint8} */
        const b = Number(OpCodes.AndN(word, BigInt(255)));
        bytes.push(b);
        word = OpCodes.ShiftRn(word, 8);
      }
    }

    return bytes;
  }

  /**
   * BLAKE2b hasher (RFC 7693)
   * @class
   */
  class Blake2bHasher {
    /**
     * @param {uint8[]} key - Key bytes, or null for unkeyed hashing
     * @param {int32} outputLength - Digest length in bytes (anything not positive selects 64)
     */
    constructor(key, outputLength) {
      /** @type {int32} */
      this.outputLength = outputLength > 0 ? outputLength : BLAKE2B_OUTBYTES;
      /** @type {uint8[]} */
      this.key = key;
      /** @type {BigInt[]} */
      this.h = BLAKE2B_IV.slice();
      /** @type {BigInt} */
      this.counter = BigInt(0);
      // Holds the last full block back, so finalize always sees the block the
      // finalization flag belongs to. See BlockAbsorber.
      /** @type {BlockAbsorber} */
      this._absorber = new BlockAbsorber(BLAKE2B_BLOCKBYTES, block => this._compress(block));

      const keyLength = key !== null ? key.length : 0;

      // Set parameter block in h[0]
      this.h[0] = OpCodes.XorN(this.h[0], OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(
                   BigInt(this.outputLength),
                   OpCodes.ShiftLn(BigInt(keyLength), 8)),
                   OpCodes.ShiftLn(BigInt(1), 16)),  // fanout = 1
                   OpCodes.ShiftLn(BigInt(1), 24)));   // depth = 1

      // Process key if provided
      if (keyLength > 0) {
        const keyPadded = zeroBytes(BLAKE2B_BLOCKBYTES);
        for (let i = 0; i < keyLength && i < BLAKE2B_KEYBYTES; i++) {
          keyPadded[i] = key[i];
        }
        this.update(keyPadded);
      }
    }

    /**
     * Compress one full block that is known not to be the last.
     * @param {uint8[]} block - exactly BLAKE2B_BLOCKBYTES bytes
     * @returns {void}
     */
    _compress(block) {
      this.counter = this.counter + BigInt(BLAKE2B_BLOCKBYTES);
      const m = bytesToWords64(block);
      while (m.length < 16) m.push(BigInt(0));
      BLAKE2b_compress(this.h, m, this.counter, false);
    }

    /**
     * Absorb message bytes
     * @param {uint8[]} data - Message bytes
     * @returns {void}
     */
    update(data) {
      this._absorber.Absorb(data);
    }

    /**
     * RFC 7693 section 3.3 compresses the final block with the finalization flag
     * set, and for a message whose length is an exact multiple of the block size
     * that final block is a full one. The absorber holds it back, so the flag can
     * never be missed the way it was for every message of exactly 128, 256, 384
     * ... bytes.
     *
     * Nothing here writes to the hasher, so calling it twice gives the same
     * digest twice.
     * @returns {uint8[]} Digest of outputLength bytes
     */
    finalize() {
      /** @type {uint8[]} */
      const digest = this._absorber.Finish((held, pending) => this._finalize(held, pending));
      return digest;
    }

    /**
     * Compress the held final block on a copy of the state
     * @param {uint8[]} held - The final (possibly empty or full) block's bytes
     * @param {int32} pending - Number of valid bytes in held
     * @returns {uint8[]} Digest of outputLength bytes
     */
    _finalize(held, pending) {
      const block = zeroBytes(BLAKE2B_BLOCKBYTES);
      for (let i = 0; i < pending; i++) block[i] = held[i];

      const m = bytesToWords64(block);
      while (m.length < 16) m.push(BigInt(0));

      const h = this.h.slice();
      BLAKE2b_compress(h, m, this.counter + BigInt(pending), true);

      return words64ToBytes(h, this.outputLength);
    }
  }

  // ===== BLAKE2S (32-BIT) IMPLEMENTATION =====

  // BLAKE2s constants
  /** @type {int32} */
  const BLAKE2S_BLOCKBYTES = 64;
  /** @type {int32} */
  const BLAKE2S_OUTBYTES = 32;
  /** @type {int32} */
  const BLAKE2S_KEYBYTES = 32;

  // BLAKE2s initialization vectors
  const BLAKE2S_IV = OpCodes.Hex32ToDWords('6a09e667bb67ae853c6ef372a54ff53a510e527f9b05688c1f83d9ab5be0cd19');

  /**
   * BLAKE2s G function (mixing function for 32-bit)
   * @param {uint32[]} v - Working vector, modified in place
   * @param {int32} a - Index
   * @param {int32} b - Index
   * @param {int32} c - Index
   * @param {int32} d - Index
   * @param {uint32} x - First message word
   * @param {uint32} y - Second message word
   * @returns {void}
   */
  function BLAKE2s_G(v, a, b, c, d, x, y) {
    v[a] = OpCodes.Add32(OpCodes.Add32(v[a], v[b]), x);
    v[d] = OpCodes.RotR32(OpCodes.Xor32(v[d], v[a]), 16);
    v[c] = OpCodes.Add32(v[c], v[d]);
    v[b] = OpCodes.RotR32(OpCodes.Xor32(v[b], v[c]), 12);
    v[a] = OpCodes.Add32(OpCodes.Add32(v[a], v[b]), y);
    v[d] = OpCodes.RotR32(OpCodes.Xor32(v[d], v[a]), 8);
    v[c] = OpCodes.Add32(v[c], v[d]);
    v[b] = OpCodes.RotR32(OpCodes.Xor32(v[b], v[c]), 7);
  }

  /**
   * BLAKE2s compression function
   * @param {uint32[]} h - Chaining value, updated in place
   * @param {uint32[]} m - 16 message words
   * @param {uint32} t0 - Low word of the byte counter
   * @param {uint32} t1 - High word of the byte counter
   * @param {boolean} f - Final-block flag
   * @returns {void}
   */
  function BLAKE2s_compress(h, m, t0, t1, f) {
    /** @type {uint32[]} */
    const v = new Array(16);

    // Initialize working vector
    for (let i = 0; i < 8; i++) {
      v[i] = h[i];
    }
    for (let i = 0; i < 8; i++) {
      v[i + 8] = BLAKE2S_IV[i];
    }

    // Mix counter and final flag
    v[12] = OpCodes.Xor32(v[12], t0);
    v[13] = OpCodes.Xor32(v[13], t1);
    if (f) {
      v[14] = OpCodes.Not32(v[14]);
    }

    // 10 rounds of mixing
    for (let round = 0; round < 10; round++) {
      const s = SIGMA[round];

      // Mix columns
      BLAKE2s_G(v, 0, 4, 8, 12, m[s[0]], m[s[1]]);
      BLAKE2s_G(v, 1, 5, 9, 13, m[s[2]], m[s[3]]);
      BLAKE2s_G(v, 2, 6, 10, 14, m[s[4]], m[s[5]]);
      BLAKE2s_G(v, 3, 7, 11, 15, m[s[6]], m[s[7]]);

      // Mix diagonals
      BLAKE2s_G(v, 0, 5, 10, 15, m[s[8]], m[s[9]]);
      BLAKE2s_G(v, 1, 6, 11, 12, m[s[10]], m[s[11]]);
      BLAKE2s_G(v, 2, 7, 8, 13, m[s[12]], m[s[13]]);
      BLAKE2s_G(v, 3, 4, 9, 14, m[s[14]], m[s[15]]);
    }

    // Update hash state
    for (let i = 0; i < 8; i++) {
      h[i] = OpCodes.Xor32(h[i], OpCodes.Xor32(v[i], v[i + 8]));
    }
  }

  /**
   * Turn a 64-byte block into 16 little-endian 32-bit words.
   * @param {uint8[]} block - 64 bytes
   * @returns {uint32[]} 16 words
   */
  function blake2sWords(block) {
    /** @type {uint32[]} */
    const m = [];
    for (let i = 0; i < 16; i++)
      m.push(OpCodes.Pack32LE(block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]));
    return m;
  }

  /**
   * BLAKE2s hasher (RFC 7693), with the tree/XOF parameter block fields BLAKE2X uses
   * @class
   */
  class Blake2sHasher {
    /**
     * @param {uint8[]} key - Key bytes, or null for unkeyed hashing
     * @param {int32} outputLength - Digest length in bytes (anything not positive selects 32)
     * @param {uint8[]} salt - 8-byte salt, or null
     * @param {uint8[]} personalization - 8-byte personalization, or null
     * @param {uint32} nodeOffset - Node offset (tree hashing)
     * @param {int32} fanout - Fanout (1 for sequential hashing)
     * @param {int32} depth - Maximal depth (1 for sequential hashing)
     * @param {uint32} leafLength - Leaf maximal byte length
     * @param {int32} innerHashLength - Inner hash byte length
     * @param {int32} nodeDepth - Node depth
     * @param {int32} xofLength - XOF digest length (0 for plain BLAKE2s)
     */
    constructor(key, outputLength, salt, personalization, nodeOffset, fanout, depth, leafLength, innerHashLength, nodeDepth, xofLength) {
      /** @type {int32} */
      this.outputLength = outputLength > 0 ? outputLength : BLAKE2S_OUTBYTES;
      /** @type {uint8[]} */
      this.key = key;
      /** @type {uint32[]} */
      this.h = BLAKE2S_IV.slice();
      /** @type {uint32} Low 32 bits of the byte counter */
      this.t0 = 0;
      /** @type {uint32} High 32 bits of the byte counter */
      this.t1 = 0;
      // The same absorber BLAKE2b uses. These two implementations of one rule
      // used to disagree, which is how the BLAKE2b defect survived review in a
      // file that also contained a correct copy.
      /** @type {BlockAbsorber} */
      this._absorber = new BlockAbsorber(BLAKE2S_BLOCKBYTES, block => this._compress(block));

      const keyLength = key !== null ? key.length : 0;

      // Set parameter block
      this.h[0] = OpCodes.Xor32(this.h[0],
                   OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(this.outputLength,
                   OpCodes.Shl32(keyLength, 8)),
                   OpCodes.Shl32(fanout, 16)),
                   OpCodes.Shl32(depth, 24)));

      this.h[1] = OpCodes.Xor32(this.h[1], leafLength);

      // h[2]: node_offset
      this.h[2] = OpCodes.Xor32(this.h[2], OpCodes.ToUint32(nodeOffset));
      this.h[3] = OpCodes.Xor32(this.h[3], OpCodes.Or32(OpCodes.Or32(OpCodes.And32(xofLength, 0xFFFF), OpCodes.Shl32(nodeDepth, 16)), OpCodes.Shl32(innerHashLength, 24)));

      // h[4] and h[5]: salt
      if (salt !== null && salt.length === 8) {
        this.h[4] = OpCodes.Xor32(this.h[4], OpCodes.Pack32LE(salt[0], salt[1], salt[2], salt[3]));
        this.h[5] = OpCodes.Xor32(this.h[5], OpCodes.Pack32LE(salt[4], salt[5], salt[6], salt[7]));
      }

      // h[6] and h[7]: personalization
      if (personalization !== null && personalization.length === 8) {
        this.h[6] = OpCodes.Xor32(this.h[6], OpCodes.Pack32LE(personalization[0], personalization[1], personalization[2], personalization[3]));
        this.h[7] = OpCodes.Xor32(this.h[7], OpCodes.Pack32LE(personalization[4], personalization[5], personalization[6], personalization[7]));
      }

      // Process key if provided
      if (keyLength > 0) {
        const keyPadded = zeroBytes(BLAKE2S_BLOCKBYTES);
        for (let i = 0; i < keyLength && i < BLAKE2S_KEYBYTES; i++) {
          keyPadded[i] = key[i];
        }
        this.update(keyPadded);
      }
    }

    /**
     * Compress one full block that is known not to be the last.
     * @param {uint8[]} block - exactly BLAKE2S_BLOCKBYTES bytes
     * @returns {void}
     */
    _compress(block) {
      // Increment counter (64-bit addition)
      this.t0 = OpCodes.Add32(this.t0, BLAKE2S_BLOCKBYTES);
      if (this.t0 < BLAKE2S_BLOCKBYTES) {
        this.t1 = OpCodes.Add32(this.t1, 1); // Overflow
      }
      BLAKE2s_compress(this.h, blake2sWords(block), this.t0, this.t1, false);
    }

    /**
     * Absorb message bytes
     * @param {uint8[]} data - Message bytes
     * @returns {void}
     */
    update(data) {
      this._absorber.Absorb(data);
    }

    /**
     * Digest of everything absorbed so far; repeatable
     * @returns {uint8[]} Digest of outputLength bytes
     */
    finalize() {
      /** @type {uint8[]} */
      const digest = this._absorber.Finish((held, pending) => this._finalize(held, pending));
      return digest;
    }

    /**
     * Compress the held final block on copies of the counter and state
     * @param {uint8[]} held - The final (possibly empty or full) block's bytes
     * @param {int32} pending - Number of valid bytes in held
     * @returns {uint8[]} Digest of outputLength bytes
     */
    _finalize(held, pending) {
      // Counter and state are advanced on copies, so finalizing twice gives the
      // same digest twice and Result() needs no clone of the hasher.
      const t0 = OpCodes.Add32(this.t0, pending);
      let t1 = this.t1;
      if (t0 < pending) t1 = OpCodes.Add32(t1, 1); // Overflow

      const block = zeroBytes(BLAKE2S_BLOCKBYTES);
      for (let i = 0; i < pending; i++) block[i] = held[i];

      const h = this.h.slice();
      BLAKE2s_compress(h, blake2sWords(block), t0, t1, true);

      // Convert hash state to bytes (little-endian)
      /** @type {uint8[]} */
      const output = [];
      for (let w = 0; w < 8 && output.length < this.outputLength; w++) {
        for (let b = 0; b < 4 && output.length < this.outputLength; b++) {
          output.push(OpCodes.GetByte(h[w], b));
        }
      }

      return output;
    }
  }

  // ===== BLAKE2B ALGORITHM =====

  /**
 * BLAKE2bAlgorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class BLAKE2bAlgorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BLAKE2b";
      this.description = "BLAKE2b is a high-speed cryptographic hash function optimized for 64-bit platforms. It's faster than MD5, SHA-1, SHA-2, and SHA-3 while providing excellent security properties.";
      this.inventor = "Jean-Philippe Aumasson, Samuel Neves, Zooko Wilcox-O'Hearn, Christian Winnerlein";
      this.year = 2012;
      this.category = CategoryType.HASH;
      this.subCategory = "BLAKE Family";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CH;

      // Hash-specific metadata
      this.SupportedOutputSizes = [new KeySize(64, 64, 1)]; // 512 bits = 64 bytes (default)

      // Performance and technical specifications
      /** @type {int32} */
      this.blockSize = 128; // 1024 bits = 128 bytes
      /** @type {int32} */
      this.outputSize = 64; // 512 bits = 64 bytes

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 7693 - BLAKE2 Cryptographic Hash and MAC", "https://tools.ietf.org/html/rfc7693"),
        new LinkItem("BLAKE2 Official Specification", "https://blake2.net/blake2.pdf"),
        new LinkItem("BLAKE2 Reference Implementation", "https://github.com/BLAKE2/BLAKE2")
      ];

      this.references = [
        new LinkItem("Wikipedia BLAKE2", "https://en.wikipedia.org/wiki/BLAKE_(hash_function)#BLAKE2"),
        new LinkItem("libsodium BLAKE2b", "https://github.com/jedisct1/libsodium")
      ];

      // Test vectors from RFC 7693
      this.tests = [
        {
          text: "RFC 7693 Test Vector - Empty string",
          uri: "https://tools.ietf.org/html/rfc7693",
          input: [],
          expected: OpCodes.Hex8ToBytes("786a02f742015903c6c6fd852552d272912f4740e15847618a86e217f71f5419d25e1031afee585313896444934eb04b903a685b1448b755d56f701afe9be2ce")
        },
        {
          text: "RFC 7693 Test Vector - abc",
          uri: "https://tools.ietf.org/html/rfc7693",
          input: OpCodes.AnsiToBytes("abc"),
          expected: OpCodes.Hex8ToBytes("ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d17d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923")
        },
        {
          text: "RFC 7693 Test Vector - The quick brown fox",
          uri: "https://tools.ietf.org/html/rfc7693",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
          expected: OpCodes.Hex8ToBytes("a8add4bdddfd93e4877d2746e62817b116364a1fa7bc148d95090bc7333b3673f82401cf7aa2e4cb1ecd90296e3f14cb5413f8ed77be73045b13914cdcd6a918")
        }
      ];
    }

    /**
     * Create new hash instance
     * @param {boolean} [isInverse=false] - Unused: a hash has no inverse
     * @returns {BLAKE2bAlgorithmInstance} New hash instance
     */
    CreateInstance(isInverse = false) {
      return new BLAKE2bAlgorithmInstance(this, isInverse);
    }
  }

  /**
 * BLAKE2b hash instance implementing the Feed/Result pattern
 * @class
 * @extends {IHashFunctionInstance}
 */

  class BLAKE2bAlgorithmInstance extends IHashFunctionInstance {
    /**
     * Initialize a BLAKE2b instance
     * @param {BLAKE2bAlgorithm} algorithm - Parent algorithm instance
     * @param {boolean} [isInverse=false] - Unused: a hash has no inverse
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 64; // 512 bits = 64 bytes

      // BLAKE2b state
      /** @type {Blake2bHasher} */
      this._hasher = null;
    }

    /**
     * Start a new message
     * @returns {void}
     */
    Init() {
      this._hasher = new Blake2bHasher(null, BLAKE2B_OUTBYTES);
    }

    /**
     * Absorb message bytes
     * @param {uint8[]} data - Message bytes
     * @returns {void}
     */
    Update(data) {
      if (this._hasher === null) {
        this.Init();
      }
      this._hasher.update(data);
    }

    /**
     * Digest of everything absorbed so far
     * @returns {uint8[]} Hash digest as byte array
     */
    Final() {
      if (this._hasher === null) {
        this.Init();
      }
      /** @type {uint8[]} */
      const digest = this._hasher.finalize();
      return digest;
    }

    /**
     * Hash a complete message in one operation
     * @param {uint8[]} message - Message bytes
     * @returns {uint8[]} Hash digest as byte array
     */
    Hash(message) {
      this.Init();
      this.Update(message);
      return this.Final();
    }

    /**
     * Hashes take no key
     * @param {uint8[]} key - Unused
     * @returns {boolean} Always true
     */
    KeySetup(key) {
      return true;
    }

    /**
     * Hash one block (block-cipher style convenience)
     * @param {int32} blockIndex - Unused
     * @param {uint8[]} plaintext - Bytes to hash
     * @returns {uint8[]} Hash digest as byte array
     */
    EncryptBlock(blockIndex, plaintext) {
      return this.Hash(plaintext);
    }

    /**
     * Hash functions have no inverse
     * @param {int32} blockIndex - Unused
     * @param {uint8[]} ciphertext - Unused
     * @throws {Error} Always
     */
    DecryptBlock(blockIndex, ciphertext) {
      throw new Error('BLAKE2b is a one-way hash function - decryption not possible');
    }

    /**
     * Forget the message
     * @returns {void}
     */
    ClearData() {
      this._hasher = null;
    }

    /**
     * Feed data to the hash
     * @param {uint8[]} data - Input data bytes
     */
    Feed(data) {
      // Init() replaces the hasher, so it belongs at the start of the message and
      // not at the start of every call - the same guard the BLAKE2s and BLAKE2X
      // instances below already use. Feed(a); Feed(b) must absorb the same block
      // sequence as Feed(a || b).
      if (this._hasher === null) {
        this.Init();
      }
      this.Update(data);
    }

    /**
     * Digest of everything fed so far
     * @returns {uint8[]} Hash digest as byte array
     */
    Result() {
      return this.Final();
    }
  }

  // ===== BLAKE2S ALGORITHM =====

  /**
 * BLAKE2sAlgorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class BLAKE2sAlgorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BLAKE2s";
      this.description = "BLAKE2s is a high-speed cryptographic hash function optimized for 8-32 bit platforms. It's the 32-bit version of BLAKE2 and is used in protocols like WireGuard.";
      this.inventor = "Jean-Philippe Aumasson, Samuel Neves, Zooko Wilcox-O'Hearn, Christian Winnerlein";
      this.year = 2012;
      this.category = CategoryType.HASH;
      this.subCategory = "BLAKE Family";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CH;

      // Hash-specific metadata
      this.SupportedOutputSizes = [new KeySize(32, 32, 1)]; // 256 bits = 32 bytes (default)

      // Performance and technical specifications
      /** @type {int32} */
      this.blockSize = 64; // 512 bits = 64 bytes
      /** @type {int32} */
      this.outputSize = 32; // 256 bits = 32 bytes

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 7693 - BLAKE2 Cryptographic Hash and MAC", "https://tools.ietf.org/html/rfc7693"),
        new LinkItem("BLAKE2 Official Specification", "https://blake2.net/blake2.pdf"),
        new LinkItem("BLAKE2 Reference Implementation", "https://github.com/BLAKE2/BLAKE2")
      ];

      this.references = [
        new LinkItem("Wikipedia BLAKE2", "https://en.wikipedia.org/wiki/BLAKE_(hash_function)#BLAKE2"),
        new LinkItem("WireGuard Protocol", "https://www.wireguard.com/papers/wireguard.pdf")
      ];

      // Test vectors from RFC 7693
      this.tests = [
        {
          text: "RFC 7693 BLAKE2s - Empty string",
          uri: "https://datatracker.ietf.org/doc/html/rfc7693",
          input: [],
          expected: OpCodes.Hex8ToBytes("69217a3079908094e11121d042354a7c1f55b6482ca1a51e1b250dfd1ed0eef9")
        },
        {
          text: "RFC 7693 BLAKE2s - 'abc'",
          uri: "https://datatracker.ietf.org/doc/html/rfc7693",
          input: OpCodes.AnsiToBytes("abc"),
          expected: OpCodes.Hex8ToBytes("508c5e8c327c14e2e1a72ba34eeb452f37458b209ed63a294d999b4c86675982")
        },
        {
          text: "Linux crypto test vector - Empty string unkeyed",
          uri: "https://kdave.github.io/linux-crypto-blake2s/",
          input: [],
          expected: OpCodes.Hex8ToBytes("69217a3079908094e11121d042354a7c1f55b6482ca1a51e1b250dfd1ed0eef9")
        }
      ];
    }

    /**
     * Create new hash instance
     * @param {boolean} [isInverse=false] - Unused: a hash has no inverse
     * @returns {BLAKE2sAlgorithmInstance} New hash instance
     */
    CreateInstance(isInverse = false) {
      return new BLAKE2sAlgorithmInstance(this, isInverse);
    }
  }

  /**
 * BLAKE2s hash instance implementing the Feed/Result pattern
 * @class
 * @extends {IHashFunctionInstance}
 */

  class BLAKE2sAlgorithmInstance extends IHashFunctionInstance {
    /**
     * Initialize a BLAKE2s instance
     * @param {BLAKE2sAlgorithm} algorithm - Parent algorithm instance
     * @param {boolean} [isInverse=false] - Unused: a hash has no inverse
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 32; // 256 bits = 32 bytes

      // BLAKE2s state
      /** @type {Blake2sHasher} */
      this._hasher = null;
    }

    /**
     * Start a new message
     * @returns {void}
     */
    Init() {
      this._hasher = new Blake2sHasher(null, BLAKE2S_OUTBYTES, null, null, 0, 1, 1, 0, 0, 0, 0);
    }

    /**
     * Absorb message bytes
     * @param {uint8[]} data - Message bytes
     * @returns {void}
     */
    Update(data) {
      if (this._hasher === null) {
        this.Init();
      }
      this._hasher.update(data);
    }

    /**
     * Digest of everything absorbed so far
     * @returns {uint8[]} Hash digest as byte array
     */
    Final() {
      if (this._hasher === null) {
        this.Init();
      }
      /** @type {uint8[]} */
      const digest = this._hasher.finalize();
      return digest;
    }

    /**
     * Hash a complete message in one operation
     * @param {uint8[]} message - Message bytes
     * @returns {uint8[]} Hash digest as byte array
     */
    Hash(message) {
      this.Init();
      this.Update(message);
      return this.Final();
    }

    /**
     * Hashes take no key
     * @param {uint8[]} key - Unused
     * @returns {boolean} Always true
     */
    KeySetup(key) {
      return true;
    }

    /**
     * Hash one block (block-cipher style convenience)
     * @param {int32} blockIndex - Unused
     * @param {uint8[]} plaintext - Bytes to hash
     * @returns {uint8[]} Hash digest as byte array
     */
    EncryptBlock(blockIndex, plaintext) {
      return this.Hash(plaintext);
    }

    /**
     * Hash functions have no inverse
     * @param {int32} blockIndex - Unused
     * @param {uint8[]} ciphertext - Unused
     * @throws {Error} Always
     */
    DecryptBlock(blockIndex, ciphertext) {
      throw new Error('BLAKE2s is a one-way hash function - decryption not possible');
    }

    /**
     * Forget the message
     * @returns {void}
     */
    ClearData() {
      this._hasher = null;
    }

    /**
     * Feed data to the hash
     * @param {uint8[]} data - Input data bytes
     */
    Feed(data) {
      if (this._hasher === null) {
        this.Init();
      }
      this.Update(data);
    }

    /**
     * Digest of everything fed so far
     * @returns {uint8[]} Hash digest as byte array
     */
    Result() {
      // finalize() advances the counter and the state on copies, so it no
      // longer needs a clone of the hasher to stay repeatable.
      return this.Final();
    }
  }

  // ===== BLAKE2XS ALGORITHM =====

  // BLAKE2xs constants
  /** @type {int32} */
  const BLAKE2XS_DIGEST_LENGTH = 32;
  /** @type {int32} */
  const BLAKE2XS_UNKNOWN_DIGEST_LENGTH = 65535;
  /** @type {uint64} */
  const BLAKE2XS_MAX_NUMBER_BLOCKS = 0x100000000; // 2^32

  /**
 * BLAKE2xsAlgorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class BLAKE2xsAlgorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BLAKE2xs";
      this.description = "BLAKE2xs is an eXtendable Output Function (XOF) based on BLAKE2s. It supports variable-length output from 1 byte to 2^32 blocks of 32 bytes.";
      this.inventor = "Jean-Philippe Aumasson, Samuel Neves, Zooko Wilcox-O'Hearn, Christian Winnerlein";
      this.year = 2016;
      this.category = CategoryType.HASH;
      this.subCategory = "BLAKE Family";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CH;

      // Hash-specific metadata - XOF supports variable output
      // Variable output size: 1 to 2^16-2 bytes; 2^16-1 marks a length not known in advance
      this.SupportedOutputSizes = [new KeySize(1, 65534, 1)];

      // Performance and technical specifications
      /** @type {int32} */
      this.blockSize = 64; // 512 bits = 64 bytes (BLAKE2s block size)
      /** @type {int32} */
      this.outputSize = 0; // Variable output: no fixed digest size

      // Documentation and references
      this.documentation = [
        new LinkItem("BLAKE2X Specification", "https://blake2.net/blake2x.pdf"),
        new LinkItem("BLAKE2 Official Specification", "https://blake2.net/blake2.pdf"),
        new LinkItem("BLAKE2 Reference Implementation", "https://github.com/BLAKE2/BLAKE2")
      ];

      this.references = [
        new LinkItem("BouncyCastle BLAKE2xs Implementation", "https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/digests/Blake2xsDigest.java"),
        new LinkItem("BLAKE2 Test Vectors", "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json")
      ];

      // Test vectors from BouncyCastle test suite
      const input256 = OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff");

      this.tests = [
        {
          text: "BLAKE2xs XOF - 256 byte input, 1 byte output",
          uri: "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json",
          input: input256,
          outputSize: 1,
          expected: OpCodes.Hex8ToBytes("99")
        },
        {
          text: "BLAKE2xs XOF - 256 byte input, 2 byte output",
          uri: "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json",
          input: input256,
          outputSize: 2,
          expected: OpCodes.Hex8ToBytes("57d5")
        },
        {
          text: "BLAKE2xs XOF - 256 byte input, 3 byte output",
          uri: "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json",
          input: input256,
          outputSize: 3,
          expected: OpCodes.Hex8ToBytes("72d07f")
        },
        {
          text: "BLAKE2xs XOF - 256 byte input, 4 byte output",
          uri: "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json",
          input: input256,
          outputSize: 4,
          expected: OpCodes.Hex8ToBytes("bdf28396")
        },
        {
          text: "BLAKE2xs XOF - 256 byte input, 5 byte output",
          uri: "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json",
          input: input256,
          outputSize: 5,
          expected: OpCodes.Hex8ToBytes("20e81fc0f3")
        },
        {
          text: "BLAKE2xs XOF - 256 byte input, 16 byte output",
          uri: "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json",
          input: input256,
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("541e57a4988909ea2f81953f6ca1cb75")
        },
        {
          text: "BLAKE2xs XOF - 256 byte input, 32 byte output",
          uri: "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json",
          input: input256,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("91cab802b466092897c7639a02acf529ca61864e5e8c8e422b3a9381a95154d1")
        },
        {
          text: "BLAKE2xs XOF - 256 byte input, 64 byte output",
          uri: "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json",
          input: input256,
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes("57aa5c761e7cfa573c48785109ad76445441de0ee0f9fe9dd4abb920b7cb5f608fc9a029f85ec478a130f194372b6112f5f2d10408e0d23f696cc9e313b7f1d3")
        },
        {
          text: "BLAKE2xs XOF - 256 byte input, 128 byte output",
          uri: "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json",
          input: input256,
          outputSize: 128,
          expected: OpCodes.Hex8ToBytes("4d1f33edc0d969128edb16e0756c5b1ef45caa7c23a2f3724dab70c8d068cfbfc4ee15ca2fa799b1eb286c2298036faec73d3cac41b950083e17ef20ddff9d55aa8b4d0365c6dd38d5ddea19ebfa2cb009dd5961320c547af20f96044f7a82a0919126466bad6f88f49b0342fd40f5c7b85206e77d26256c8b7ff4fedf36119b")
        },
        {
          text: "BLAKE2xs XOF - 256 byte input, 256 byte output",
          uri: "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json",
          input: input256,
          outputSize: 256,
          expected: OpCodes.Hex8ToBytes("d4a23a17b657fa3ddc2df61eefce362f048b9dd156809062997ab9d5b1fb26b8542b1a638f517fcbad72a6fb23de0754db7bb488b75c12ac826dcced9806d7873e6b31922097ef7b42506275ccc54caf86918f9d1c6cdb9bad2bacf123c0380b2e5dc3e98de83a159ee9e10a8444832c371e5b72039b31c38621261aa04d8271598b17dba0d28c20d1858d879038485ab069bdb58733b5495f934889658ae81b7536bcf601cfcc572060863c1ff2202d2ea84c800482dbe777335002204b7c1f70133e4d8a6b7516c66bb433ad31030a7a9a9a6b9ea69890aa40662d908a5acfe8328802595f0284c51a000ce274a985823de9ee74250063a879a3787fca23a6")
        }
      ];
    }

    /**
     * Create new XOF instance
     * @param {boolean} [isInverse=false] - Unused: a hash has no inverse
     * @returns {BLAKE2xsAlgorithmInstance} New XOF instance
     */
    CreateInstance(isInverse = false) {
      return new BLAKE2xsAlgorithmInstance(this, isInverse);
    }
  }

  /**
 * BLAKE2xs XOF instance implementing the Feed/Result pattern
 * @class
 * @extends {IHashFunctionInstance}
 */

  class BLAKE2xsAlgorithmInstance extends IHashFunctionInstance {
    /**
     * Initialize a BLAKE2xs instance
     * @param {BLAKE2xsAlgorithm} algorithm - Parent algorithm instance
     * @param {boolean} [isInverse=false] - Unused: a hash has no inverse
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;

      // XOF parameters
      /** @type {int32} */
      this._digestLength = BLAKE2XS_UNKNOWN_DIGEST_LENGTH;
      /** @type {int32} */
      this._outputSize = 32;

      // Root hash
      /** @type {Blake2sHasher} */
      this._rootHash = null;
      /** @type {uint8[]} */
      this._h0 = null;

      // Current output buffer
      /** @type {uint8[]} */
      this._buf = zeroBytes(32);
      /** @type {int32} */
      this._bufPos = 32;

      // Position tracking
      /** @type {int32} */
      this._digestPos = 0;
      /** @type {uint64} */
      this._blockPos = 0;
      /** @type {uint32} */
      this._nodeOffset = 0;
    }

    /**
     * Set the output length and restart the message
     * @param {int32} size - Output length in bytes (at least 1)
     */
    set outputSize(size) {
      if (size < 1) {
        throw new Error("BLAKE2xs output size must be at least 1 byte");
      }
      this._outputSize = size;
      this._digestLength = size;
      this.Reset();
    }

    /**
     * The output length
     * @returns {int32} Output length in bytes
     */
    get outputSize() {
      return this._outputSize;
    }

    /**
     * Start a new message
     * @returns {void}
     */
    Init() {
      this._nodeOffset = 0;
      this._rootHash = this.createRootHash(null, null, null);
      this._h0 = null;
      this._bufPos = 32;
      this._digestPos = 0;
      this._blockPos = 0;
    }

    /**
     * Start a new message
     * @returns {void}
     */
    Reset() {
      this.Init();
    }

    /**
     * The root BLAKE2s instance of the XOF
     * @param {uint8[]} key - Key bytes, or null
     * @param {uint8[]} salt - 8-byte salt, or null
     * @param {uint8[]} personalization - 8-byte personalization, or null
     * @returns {Blake2sHasher} Root hasher
     */
    createRootHash(key, salt, personalization) {
      return new Blake2sHasher(key, BLAKE2XS_DIGEST_LENGTH, salt, personalization, 0,
        1, 1, 0, 0, 0, this._digestLength);
    }

    /**
     * The BLAKE2s instance producing one output block
     * @param {int32} stepLength - Bytes this block contributes
     * @param {uint32} nodeOffset - Block index
     * @returns {Blake2sHasher} Output-block hasher
     */
    createInternalHash(stepLength, nodeOffset) {
      return new Blake2sHasher(null, stepLength, null, null, nodeOffset,
        0, 0, BLAKE2XS_DIGEST_LENGTH, BLAKE2XS_DIGEST_LENGTH, 0, this._digestLength);
    }

    /**
     * Absorb message bytes
     * @param {uint8[]} data - Message bytes
     * @returns {void}
     */
    Update(data) {
      if (this._rootHash === null) this.Init();
      this._rootHash.update(data);
    }

    /**
     * Compute the root digest h0 once
     * @returns {void}
     */
    finalizeRootHash() {
      if (this._h0 === null) {
        /** @type {uint8[]} */
        const result = this._rootHash.finalize();
        /** @type {uint8[]} */
        const h0 = [];
        for (let i = 0; i < 32; i++) {
          h0.push(result[i]);
        }
        this._h0 = h0;
      }
    }

    /**
     * Length of the next output block
     * @returns {int32} Bytes, at most 32
     */
    computeStepLength() {
      if (this._digestLength === BLAKE2XS_UNKNOWN_DIGEST_LENGTH) {
        return BLAKE2XS_DIGEST_LENGTH;
      }
      return Math.min(BLAKE2XS_DIGEST_LENGTH, this._digestLength - this._digestPos);
    }

    /**
     * Squeeze output bytes
     * @param {int32} outputLength - Number of bytes
     * @returns {uint8[]} Output bytes
     */
    doOutput(outputLength) {
      this.finalizeRootHash();

      // Check output length constraints
      if (this._digestLength !== BLAKE2XS_UNKNOWN_DIGEST_LENGTH) {
        if (this._digestPos + outputLength > this._digestLength) {
          throw new Error("Output length exceeds digest length");
        }
      } else if (this._blockPos >= BLAKE2XS_MAX_NUMBER_BLOCKS) {
        throw new Error("Maximum length is 2^32 blocks of 32 bytes");
      }

      /** @type {uint8[]} */
      const output = [];

      for (let i = 0; i < outputLength; i++) {
        // Generate new block if buffer exhausted
        if (this._bufPos >= BLAKE2XS_DIGEST_LENGTH) {
          const stepLength = this.computeStepLength();
          const h = this.createInternalHash(stepLength, this._nodeOffset);

          // Hash the root digest h0
          h.update(this._h0);

          // Finalize to get next block
          /** @type {uint8[]} */
          const result = h.finalize();
          for (let j = 0; j < result.length; j++) {
            this._buf[j] = result[j];
          }

          this._bufPos = 0;
          this._nodeOffset++;
          this._blockPos++;
        }

        output.push(this._buf[this._bufPos]);
        this._bufPos++;
        this._digestPos++;
      }

      return output;
    }

    /**
     * Squeeze outputSize bytes
     * @returns {uint8[]} Output bytes
     */
    Final() {
      if (this._rootHash === null) this.Init();
      return this.doOutput(this._outputSize);
    }

    /**
     * Hash a complete message in one operation
     * @param {uint8[]} message - Message bytes
     * @returns {uint8[]} Output bytes
     */
    Hash(message) {
      this.Init();
      this.Update(message);
      return this.Final();
    }

    /**
     * Hashes take no key
     * @param {uint8[]} key - Unused
     * @returns {boolean} Always true
     */
    KeySetup(key) {
      return true;
    }

    /**
     * Hash one block (block-cipher style convenience)
     * @param {int32} blockIndex - Unused
     * @param {uint8[]} plaintext - Bytes to hash
     * @returns {uint8[]} Output bytes
     */
    EncryptBlock(blockIndex, plaintext) {
      return this.Hash(plaintext);
    }

    /**
     * Hash functions have no inverse
     * @param {int32} blockIndex - Unused
     * @param {uint8[]} ciphertext - Unused
     * @throws {Error} Always
     */
    DecryptBlock(blockIndex, ciphertext) {
      throw new Error('BLAKE2xs is a one-way hash function - decryption not possible');
    }

    /**
     * Forget the message and the output buffer
     * @returns {void}
     */
    ClearData() {
      this._rootHash = null;
      this._h0 = null;
      OpCodes.ClearArray(this._buf);
    }

    /**
     * Feed data to the XOF
     * @param {uint8[]} data - Input data bytes
     */
    Feed(data) {
      if (this._rootHash === null) this.Init();
      this.Update(data);
    }

    /**
     * Squeeze outputSize bytes
     * @returns {uint8[]} Output bytes
     */
    Result() {
      if (this._rootHash === null) this.Init();
      return this.doOutput(this._outputSize);
    }
  }

  // ===== REGISTRATION =====

  const blake2bInstance = new BLAKE2bAlgorithm();
  if (!AlgorithmFramework.Find(blake2bInstance.name)) {
    RegisterAlgorithm(blake2bInstance);
  }

  const blake2sInstance = new BLAKE2sAlgorithm();
  if (!AlgorithmFramework.Find(blake2sInstance.name)) {
    RegisterAlgorithm(blake2sInstance);
  }

  const blake2xsInstance = new BLAKE2xsAlgorithm();
  if (!AlgorithmFramework.Find(blake2xsInstance.name)) {
    RegisterAlgorithm(blake2xsInstance);
  }

  // ===== EXPORTS =====

  return {
    BLAKE2bAlgorithm, BLAKE2bAlgorithmInstance, Blake2bHasher,
    BLAKE2sAlgorithm, BLAKE2sAlgorithmInstance, Blake2sHasher,
    BLAKE2xsAlgorithm, BLAKE2xsAlgorithmInstance
  };
}));
