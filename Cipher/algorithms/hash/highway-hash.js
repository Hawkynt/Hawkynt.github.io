/*
 * HighwayHash Implementation - Fast Keyed Hash Function
 * Google's high-performance keyed hash function (SipHash successor)
 * Universal AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * Follows the portable reference implementation published by Google at
 * https://github.com/google/highwayhash/blob/master/c/highwayhash.c
 * (HighwayHashReset / Update / ZipperMergeAndAdd / UpdateRemainder /
 * PermuteAndUpdate / ModularReduction / Finalize64 / Finalize128 /
 * Finalize256). The 256-bit internal state is held as four lanes each of
 * v0, v1, mul0 and mul1, all 64-bit, represented here as BigInt.
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
  /** @type {int32} */
  const PACKET_SIZE = 32;

  // Initial multipliers from the reference HighwayHashReset()
  /** @type {BigInt[]} */
  const INIT_MUL0 = [
    0xdbe6d5d5fe4cce2fn, 0xa4093822299f31d0n, 0x13198a2e03707344n, 0x243f6a8885a308d3n
  ];
  /** @type {BigInt[]} */
  const INIT_MUL1 = [
    0x3bd39e10cb0ef593n, 0xc0acf169b5f18a8cn, 0xbe5466cf34e90c6cn, 0x452821e638d01377n
  ];

  /**
   * Reduce to 64 bits
   * @param {BigInt} v - Any BigInt
   * @returns {BigInt} v mod 2^64
   */
  function m64(v) {
    return OpCodes.AndN(v, MASK64);
  }

  /**
   * ZipperMergeAndAdd: adds the byte-shuffled combination of (v0, v1) into the
   * two supplied accumulator lanes, exactly as in the reference implementation.
   * @private
   * @param {BigInt} v1 - High input lane
   * @param {BigInt} v0 - Low input lane
   * @param {BigInt[]} acc - Accumulator lanes, updated in place
   * @param {int32} idx1 - Index of the lane receiving add1
   * @param {int32} idx0 - Index of the lane receiving add0
   * @returns {void}
   */
  function zipperMergeAndAdd(v1, v0, acc, idx1, idx0) {
    const add0 = OpCodes.OrN(
      OpCodes.OrN(
        OpCodes.OrN(
          OpCodes.OrN(
            OpCodes.OrN(
              OpCodes.ShiftRn(OpCodes.OrN(OpCodes.AndN(v0, 0xff000000n), OpCodes.AndN(v1, 0xff00000000n)), 24),
              OpCodes.ShiftRn(OpCodes.OrN(OpCodes.AndN(v0, 0xff0000000000n), OpCodes.AndN(v1, 0xff000000000000n)), 16)),
            OpCodes.AndN(v0, 0xff0000n)),
          OpCodes.ShiftLn(OpCodes.AndN(v0, 0xff00n), 32)),
        OpCodes.ShiftRn(OpCodes.AndN(v1, 0xff00000000000000n), 8)),
      OpCodes.ShiftLn(v0, 56));

    const add1 = OpCodes.OrN(
      OpCodes.OrN(
        OpCodes.OrN(
          OpCodes.OrN(
            OpCodes.OrN(
              OpCodes.OrN(
                OpCodes.ShiftRn(OpCodes.OrN(OpCodes.AndN(v1, 0xff000000n), OpCodes.AndN(v0, 0xff00000000n)), 24),
                OpCodes.AndN(v1, 0xff0000n)),
              OpCodes.ShiftRn(OpCodes.AndN(v1, 0xff0000000000n), 16)),
            OpCodes.ShiftLn(OpCodes.AndN(v1, 0xff00n), 24)),
          OpCodes.ShiftRn(OpCodes.AndN(v0, 0xff000000000000n), 8)),
        OpCodes.ShiftLn(OpCodes.AndN(v1, 0xffn), 48)),
      OpCodes.AndN(v0, 0xff00000000000000n));

    acc[idx0] = m64(acc[idx0] + m64(add0));
    acc[idx1] = m64(acc[idx1] + m64(add1));
  }

  /**
   * HighwayHash state: 4 lanes each of v0, v1, mul0, mul1.
   * @private
   * @class
   */
  class HighwayHashState {
    /**
     * Create an all-zero state; reset() keys it.
     */
    constructor() {
      /** @type {BigInt[]} */
      this.mul0 = [0n, 0n, 0n, 0n];
      /** @type {BigInt[]} */
      this.mul1 = [0n, 0n, 0n, 0n];
      /** @type {BigInt[]} */
      this.v0 = [0n, 0n, 0n, 0n];
      /** @type {BigInt[]} */
      this.v1 = [0n, 0n, 0n, 0n];
    }

    /**
     * HighwayHashReset: key the state
     * @param {BigInt[]} keyWords - Four 64-bit key words
     * @returns {void}
     */
    reset(keyWords) {
      for (let i = 0; i < 4; i++) {
        this.mul0[i] = INIT_MUL0[i];
        this.mul1[i] = INIT_MUL1[i];
        this.v0[i] = m64(OpCodes.XorN(INIT_MUL0[i], keyWords[i]));
        // v1 mixes in the key word with its 32-bit halves swapped
        this.v1[i] = m64(OpCodes.XorN(INIT_MUL1[i], OpCodes.RotR64n(keyWords[i], 32)));
      }
    }

    /**
     * Become an independent copy of another state
     * @param {HighwayHashState} other - State to copy
     * @returns {void}
     */
    copyFrom(other) {
      this.mul0 = other.mul0.slice();
      this.mul1 = other.mul1.slice();
      this.v0 = other.v0.slice();
      this.v1 = other.v1.slice();
    }

    /**
     * Absorb four 64-bit lanes
     * @param {BigInt[]} lanes - Four input lanes
     * @returns {void}
     */
    update(lanes) {
      for (let i = 0; i < 4; i++) {
        this.v1[i] = m64(this.v1[i] + this.mul0[i] + lanes[i]);
        this.mul0[i] = m64(OpCodes.XorN(this.mul0[i],
          m64(OpCodes.AndN(this.v1[i], MASK32) * OpCodes.ShiftRn(this.v0[i], 32))));
        this.v0[i] = m64(this.v0[i] + this.mul1[i]);
        this.mul1[i] = m64(OpCodes.XorN(this.mul1[i],
          m64(OpCodes.AndN(this.v0[i], MASK32) * OpCodes.ShiftRn(this.v1[i], 32))));
      }

      zipperMergeAndAdd(this.v1[1], this.v1[0], this.v0, 1, 0);
      zipperMergeAndAdd(this.v1[3], this.v1[2], this.v0, 3, 2);
      zipperMergeAndAdd(this.v0[1], this.v0[0], this.v1, 1, 0);
      zipperMergeAndAdd(this.v0[3], this.v0[2], this.v1, 3, 2);
    }

    /**
     * Absorb one 32-byte packet
     * @param {uint8[]} bytes - Source bytes
     * @param {int32} offset - Index of the first byte
     * @returns {void}
     */
    updatePacket(bytes, offset) {
      /** @type {BigInt[]} */
      const lanes = new Array(4);
      for (let i = 0; i < 4; i++) lanes[i] = readLE64(bytes, offset + i * 8);
      this.update(lanes);
    }

    /**
     * Rotate each 32-bit half of every v1 lane left by `count` bits.
     * @private
     * @param {int32} count - Rotation count (taken mod 32)
     * @returns {void}
     */
    rotate32By(count) {
      /** @type {int32} */
      const c = OpCodes.And32(count, 31);
      for (let i = 0; i < 4; i++) {
        const half0 = OpCodes.AndN(this.v1[i], MASK32);
        const half1 = OpCodes.AndN(OpCodes.ShiftRn(this.v1[i], 32), MASK32);
        let r0 = half0;
        let r1 = half1;
        if (c !== 0) {
          r0 = OpCodes.AndN(OpCodes.OrN(OpCodes.ShiftLn(half0, c), OpCodes.ShiftRn(half0, 32 - c)), MASK32);
          r1 = OpCodes.AndN(OpCodes.OrN(OpCodes.ShiftLn(half1, c), OpCodes.ShiftRn(half1, 32 - c)), MASK32);
        }
        this.v1[i] = m64(OpCodes.OrN(r0, OpCodes.ShiftLn(r1, 32)));
      }
    }

    /**
     * Absorb the final 0..31 trailing bytes.
     * @private
     * @param {uint8[]} bytes - Source bytes
     * @param {int32} offset - Index of the first trailing byte
     * @param {int32} sizeMod32 - Number of trailing bytes
     * @returns {void}
     */
    updateRemainder(bytes, offset, sizeMod32) {
      /** @type {int32} */
      const sizeMod4 = OpCodes.And32(sizeMod32, 3);
      const wholeWords = sizeMod32 - sizeMod4;
      const remOffset = offset + wholeWords;

      for (let i = 0; i < 4; i++) {
        this.v0[i] = m64(this.v0[i] + OpCodes.ShiftLn(BigInt(sizeMod32), 32) + BigInt(sizeMod32));
      }
      this.rotate32By(sizeMod32);

      const packet = OpCodes.CreateArray(PACKET_SIZE, 0);
      for (let i = 0; i < wholeWords; i++) packet[i] = bytes[offset + i];

      if (OpCodes.And32(sizeMod32, 16) !== 0) {
        for (let i = 0; i < 4; i++) packet[28 + i] = bytes[remOffset + i + sizeMod4 - 4];
      } else if (sizeMod4 !== 0) {
        /** @type {int32} */
        const half = OpCodes.Shr32(sizeMod4, 1);
        packet[16] = bytes[remOffset];
        packet[17] = bytes[remOffset + half];
        packet[18] = bytes[remOffset + sizeMod4 - 1];
      }

      this.updatePacket(packet, 0);
    }

    /**
     * PermuteAndUpdate
     * @returns {void}
     */
    permuteAndUpdate() {
      // Each lane of v0 has its 32-bit halves swapped, and the lanes are
      // rotated by two positions before being fed back in.
      /** @type {BigInt[]} */
      const permuted = [
        OpCodes.RotR64n(this.v0[2], 32),
        OpCodes.RotR64n(this.v0[3], 32),
        OpCodes.RotR64n(this.v0[0], 32),
        OpCodes.RotR64n(this.v0[1], 32)
      ];
      this.update(permuted);
    }

    /**
     * Finalize64
     * @returns {BigInt[]} One 64-bit word
     */
    finalize64() {
      for (let i = 0; i < 4; i++) this.permuteAndUpdate();
      /** @type {BigInt[]} */
      const words = [m64(this.v0[0] + this.v1[0] + this.mul0[0] + this.mul1[0])];
      return words;
    }

    /**
     * Finalize128
     * @returns {BigInt[]} Two 64-bit words
     */
    finalize128() {
      for (let i = 0; i < 6; i++) this.permuteAndUpdate();
      /** @type {BigInt[]} */
      const words = [
        m64(this.v0[0] + this.mul0[0] + this.v1[2] + this.mul1[2]),
        m64(this.v0[1] + this.mul0[1] + this.v1[3] + this.mul1[3])
      ];
      return words;
    }

    /**
     * Finalize256
     * @returns {BigInt[]} Four 64-bit words
     */
    finalize256() {
      for (let i = 0; i < 10; i++) this.permuteAndUpdate();
      const lo = modularReduction(
        m64(this.v1[1] + this.mul1[1]), m64(this.v1[0] + this.mul1[0]),
        m64(this.v0[1] + this.mul0[1]), m64(this.v0[0] + this.mul0[0]));
      const hi = modularReduction(
        m64(this.v1[3] + this.mul1[3]), m64(this.v1[2] + this.mul1[2]),
        m64(this.v0[3] + this.mul0[3]), m64(this.v0[2] + this.mul0[2]));
      /** @type {BigInt[]} */
      const words = [lo[0], lo[1], hi[0], hi[1]];
      return words;
    }
  }

  /**
   * Reduce a 256-bit value modulo the irreducible polynomial used by the
   * 256-bit finalizer. Returns [m0, m1].
   * @private
   * @param {BigInt} a3Unmasked - Word 3 (top two bits are dropped)
   * @param {BigInt} a2 - Word 2
   * @param {BigInt} a1 - Word 1
   * @param {BigInt} a0 - Word 0
   * @returns {BigInt[]} [m0, m1]
   */
  function modularReduction(a3Unmasked, a2, a1, a0) {
    const a3 = OpCodes.AndN(a3Unmasked, 0x3FFFFFFFFFFFFFFFn);
    const m1 = m64(OpCodes.XorN(
      OpCodes.XorN(a1, m64(OpCodes.OrN(OpCodes.ShiftLn(a3, 1), OpCodes.ShiftRn(a2, 63)))),
      m64(OpCodes.OrN(OpCodes.ShiftLn(a3, 2), OpCodes.ShiftRn(a2, 62)))));
    const m0 = m64(OpCodes.XorN(
      OpCodes.XorN(a0, m64(OpCodes.ShiftLn(a2, 1))),
      m64(OpCodes.ShiftLn(a2, 2))));
    /** @type {BigInt[]} */
    const words = [m0, m1];
    return words;
  }

  /**
   * Little-endian 64-bit read
   * @param {uint8[]} bytes - Source bytes
   * @param {int32} offset - Index of the first byte
   * @returns {BigInt} The word
   */
  function readLE64(bytes, offset) {
    /** @type {BigInt} */
    let r = 0n;
    for (let i = 7; i >= 0; i--) {
      r = OpCodes.OrN(OpCodes.ShiftLn(r, 8), BigInt(OpCodes.And32(bytes[offset + i], 0xFF)));
    }
    return r;
  }

  /**
   * Append a 64-bit word little-endian
   * @param {BigInt} word - The word
   * @param {uint8[]} out - Destination, appended to
   * @returns {void}
   */
  function writeLE64(word, out) {
    for (let i = 0; i < 8; i++) {
      /** @type {uint8} */
      const b = Number(OpCodes.AndN(OpCodes.ShiftRn(word, i * 8), 0xFFn));
      out.push(b);
    }
  }

  /**
   * Hex string of the bytes 00 01 .. (n-1), used to spell the test inputs
   * @param {int32} n - Number of bytes
   * @returns {string} Hex string
   */
  function seq(n) {
    /** @type {string} */
    let s = '';
    for (let i = 0; i < n; i++) {
      /** @type {string} */
      const h = i.toString(16);
      /** @type {string} */
      const padded = h.padStart(2, '0');
      s += padded;
    }
    return s;
  }

  /**
 * HighwayHashAlgorithm - Keyed hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class HighwayHashAlgorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "HighwayHash";
      this.description = "Google's keyed hash function designed as a faster, stronger successor to SipHash. Absorbs 32-byte packets into a 256-bit state of multiply/permute/zipper-merge lanes and supports 64-, 128- and 256-bit output. Not a cryptographic hash, but designed to resist key recovery from observed outputs.";
      this.inventor = "Jyrki Alakuijala, Bill Cox, Jan Wassenberg (Google)";
      this.year = 2016;
      this.category = CategoryType.HASH;
      this.subCategory = "Keyed Hash Function";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Hash-specific metadata
      this.SupportedOutputSizes = [new KeySize(8, 8, 1), new KeySize(16, 16, 1), new KeySize(32, 32, 1)]; // 64, 128, 256 bits
      this.RequiresKey = true; // HighwayHash requires a 256-bit key

      // Performance and technical specifications
      this.blockSize = 32; // 256 bits = 32 bytes
      this.keySize = 32;   // 256 bits = 32 bytes
      this.outputSize = 8; // Default 64-bit output

      // Documentation and references
      this.documentation = [
        new LinkItem("Google Research Paper", "https://arxiv.org/abs/1612.06257"),
        new LinkItem("GitHub Repository", "https://github.com/google/highwayhash"),
        new LinkItem("HighwayHash Specification", "https://github.com/google/highwayhash/blob/master/g3doc/highway_hash.md")
      ];

      this.references = [
        new LinkItem("Portable reference implementation (c/highwayhash.c)", "https://github.com/google/highwayhash/blob/master/c/highwayhash.c"),
        new LinkItem("Official test vectors (highwayhash_test.cc)", "https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Not a cryptographic hash",
          "HighwayHash is not collision resistant against an adversary who knows the key, and is not a general-purpose message digest",
          "Use only as a keyed hash/PRF with a secret key; use SHA-2 or SHA-3 where collision resistance is required"
        )
      ];

      // Official test vectors from Google's HighwayHash reference test suite.
      // VerifyImplementations() uses key {0x0706050403020100, 0x0F0E0D0C0B0A0908,
      // 0x1716151413121110, 0x1F1E1D1C1B1A1918} (little-endian bytes 00..1F) and,
      // for each size N, the input 00 01 02 ... (N-1). The kExpected64/128/256
      // tables hold the golden values; they are serialized here little-endian per
      // 64-bit word, which is the natural byte order of the algorithm.
      const testKey = OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F");

      const V64 = "https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc";

      this.tests = [
        // ---- 64-bit output: sweep every branch boundary of UpdateRemainder ----
        { text: "HighwayHash-64, size 0 (empty)", uri: V64, key: testKey, input: [], outputSize: 8,
          expected: OpCodes.Hex8ToBytes("536EC222DE567A90") },
        { text: "HighwayHash-64, size 1", uri: V64, key: testKey, input: OpCodes.Hex8ToBytes(seq(1)), outputSize: 8,
          expected: OpCodes.Hex8ToBytes("78DDCDC7AA43AB7E") },
        { text: "HighwayHash-64, size 2", uri: V64, key: testKey, input: OpCodes.Hex8ToBytes(seq(2)), outputSize: 8,
          expected: OpCodes.Hex8ToBytes("623DB5B09A56D0B8") },
        { text: "HighwayHash-64, size 3", uri: V64, key: testKey, input: OpCodes.Hex8ToBytes(seq(3)), outputSize: 8,
          expected: OpCodes.Hex8ToBytes("803D468AABEF6B5C") },
        { text: "HighwayHash-64, size 4 (size_mod4 boundary)", uri: V64, key: testKey, input: OpCodes.Hex8ToBytes(seq(4)), outputSize: 8,
          expected: OpCodes.Hex8ToBytes("DA7E009368A405F2") },
        { text: "HighwayHash-64, size 7", uri: V64, key: testKey, input: OpCodes.Hex8ToBytes(seq(7)), outputSize: 8,
          expected: OpCodes.Hex8ToBytes("8294F53817AE024D") },
        { text: "HighwayHash-64, size 8", uri: V64, key: testKey, input: OpCodes.Hex8ToBytes(seq(8)), outputSize: 8,
          expected: OpCodes.Hex8ToBytes("71315FE5085120E1") },
        { text: "HighwayHash-64, size 15", uri: V64, key: testKey, input: OpCodes.Hex8ToBytes(seq(15)), outputSize: 8,
          expected: OpCodes.Hex8ToBytes("3BF349A4863F7940") },
        { text: "HighwayHash-64, size 16 (16-byte remainder branch boundary)", uri: V64, key: testKey, input: OpCodes.Hex8ToBytes(seq(16)), outputSize: 8,
          expected: OpCodes.Hex8ToBytes("32B87EF98934ABCF") },
        { text: "HighwayHash-64, size 17", uri: V64, key: testKey, input: OpCodes.Hex8ToBytes(seq(17)), outputSize: 8,
          expected: OpCodes.Hex8ToBytes("E2C0C5C8D267FE19") },
        { text: "HighwayHash-64, size 31 (one below a full packet)", uri: V64, key: testKey, input: OpCodes.Hex8ToBytes(seq(31)), outputSize: 8,
          expected: OpCodes.Hex8ToBytes("685A03CF7C00C79F") },
        { text: "HighwayHash-64, size 32 (exactly one packet, no remainder)", uri: V64, key: testKey, input: OpCodes.Hex8ToBytes(seq(32)), outputSize: 8,
          expected: OpCodes.Hex8ToBytes("FC80D5ECD964C9A0") },
        { text: "HighwayHash-64, size 33 (one over a full packet)", uri: V64, key: testKey, input: OpCodes.Hex8ToBytes(seq(33)), outputSize: 8,
          expected: OpCodes.Hex8ToBytes("FC8131A03CF7902C") },
        { text: "HighwayHash-64, size 63", uri: V64, key: testKey, input: OpCodes.Hex8ToBytes(seq(63)), outputSize: 8,
          expected: OpCodes.Hex8ToBytes("A03921BFE9EB8EAB") },
        { text: "HighwayHash-64, size 64 (exactly two packets)", uri: V64, key: testKey, input: OpCodes.Hex8ToBytes(seq(64)), outputSize: 8,
          expected: OpCodes.Hex8ToBytes("FFA6D24C5D2C5475") },

        // ---- 128-bit output ----
        { text: "HighwayHash-128, size 0 (empty)", uri: V64, key: testKey, input: [], outputSize: 16,
          expected: OpCodes.Hex8ToBytes("C7FE8F9D8F26ED0F6F3E097F765E5633") },
        { text: "HighwayHash-128, size 1", uri: V64, key: testKey, input: OpCodes.Hex8ToBytes(seq(1)), outputSize: 16,
          expected: OpCodes.Hex8ToBytes("A8E7813689A8B0D6B4DC9CEBF91D29DC") },
        { text: "HighwayHash-128, size 32 (exactly one packet)", uri: V64, key: testKey, input: OpCodes.Hex8ToBytes(seq(32)), outputSize: 16,
          expected: OpCodes.Hex8ToBytes("AA4A43C166DF8419B9E4B3F95819FC16") },
        { text: "HighwayHash-128, size 33", uri: V64, key: testKey, input: OpCodes.Hex8ToBytes(seq(33)), outputSize: 16,
          expected: OpCodes.Hex8ToBytes("6CC3C6E0AF7816119D84A2E59DB558F9") },
        { text: "HighwayHash-128, size 64", uri: V64, key: testKey, input: OpCodes.Hex8ToBytes(seq(64)), outputSize: 16,
          expected: OpCodes.Hex8ToBytes("F2C4D498711FBB98C88F91DE7105BCE0") },

        // ---- 256-bit output ----
        { text: "HighwayHash-256, size 0 (empty)", uri: V64, key: testKey, input: [], outputSize: 32,
          expected: OpCodes.Hex8ToBytes("F574C8C22A4844DD1F35C713730146D9FF1487B9CCBEAEB3F41D75453123DA41") },
        { text: "HighwayHash-256, size 1", uri: V64, key: testKey, input: OpCodes.Hex8ToBytes(seq(1)), outputSize: 32,
          expected: OpCodes.Hex8ToBytes("54825FE4BC41B9ED0FC6CA3DEF440DE2474A32CB9B1B657284E475B24C627320") },
        { text: "HighwayHash-256, size 32 (exactly one packet)", uri: V64, key: testKey, input: OpCodes.Hex8ToBytes(seq(32)), outputSize: 32,
          expected: OpCodes.Hex8ToBytes("FEC3A139908CE3BC8912C1A32663D542A9AEFC64F79555E3995A47C96B3CB0C9") },
        { text: "HighwayHash-256, size 64", uri: V64, key: testKey, input: OpCodes.Hex8ToBytes(seq(64)), outputSize: 32,
          expected: OpCodes.Hex8ToBytes("7524C16AFFE6D890F2C1DA6E192A421A02B08E1FFE65379EBECF51C3C4D7BDC1") }
      ];
    }

    /**
   * Create new hash instance
   * @param {boolean} [isInverse=false] - Unused; hash functions have no inverse
   * @returns {HighwayHashAlgorithmInstance} New hash instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new HighwayHashAlgorithmInstance(this, isInverse);
    }
  }

  /**
 * HighwayHash instance implementing the Feed/Result pattern
 * @class
 * @extends {IHashFunctionInstance}
 */

  class HighwayHashAlgorithmInstance extends IHashFunctionInstance {
    /**
   * Initialize HighwayHash instance
   * @param {HighwayHashAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Unused
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 8; // Default 64-bit output

      // Default key: the all-zero 256-bit key. Callers should always supply one.
      /** @type {uint8[]} */
      this._key = OpCodes.CreateArray(32, 0);
      /** @type {HighwayHashState} */
      this._state = null;
      /** @type {uint8[]} */
      this._packet = OpCodes.CreateArray(PACKET_SIZE, 0);
      /** @type {int32} */
      this._packetLength = 0;
    }

    /**
     * Set the 256-bit key and restart the message.
     * @param {uint8[]} k - 32 key bytes
     */
    set key(k) {
      this.KeySetup(k);
    }

    /**
     * Copy of the current key
     * @returns {uint8[]} The key, or null when none is set
     */
    get key() {
      if (!this._key) return null;
      return this._key.slice();
    }

    /**
     * Initialize (or re-initialize) the state from the current key.
     * @returns {void}
     */
    Init() {
      /** @type {BigInt[]} */
      const keyWords = new Array(4);
      for (let i = 0; i < 4; i++) keyWords[i] = readLE64(this._key, i * 8);
      this._state = new HighwayHashState();
      this._state.reset(keyWords);
      this._packet = OpCodes.CreateArray(PACKET_SIZE, 0);
      this._packetLength = 0;
    }

    /**
     * Add data to the hash calculation
     * @param {uint8[]} data - Data to hash as byte array
     * @returns {void}
     */
    Update(data) {
      if (!data || data.length === 0) return;
      if (!this._state) this.Init();

      let offset = 0;
      let remaining = data.length;

      // Top up a partially filled packet first
      if (this._packetLength !== 0) {
        const take = Math.min(PACKET_SIZE - this._packetLength, remaining);
        for (let i = 0; i < take; i++) this._packet[this._packetLength + i] = data[offset + i];
        this._packetLength += take;
        offset += take;
        remaining -= take;
        if (this._packetLength === PACKET_SIZE) {
          this._state.updatePacket(this._packet, 0);
          this._packetLength = 0;
        }
      }

      // Absorb whole packets straight from the input
      while (remaining >= PACKET_SIZE) {
        this._state.updatePacket(data, offset);
        offset += PACKET_SIZE;
        remaining -= PACKET_SIZE;
      }

      // Keep the tail for the next call / the finalizer
      for (let i = 0; i < remaining; i++) this._packet[this._packetLength + i] = data[offset + i];
      this._packetLength += remaining;
    }

    /**
     * Finalize the hash calculation and return the digest as a byte array.
     * Serialization is little-endian per 64-bit output word.
     * @returns {uint8[]} Hash digest as byte array
     */
    Final() {
      if (!this._state) this.Init();

      // Finalizing must not destroy the state, so work on a copy
      const st = new HighwayHashState();
      st.copyFrom(this._state);
      if (this._packetLength !== 0) {
        st.updateRemainder(this._packet, 0, this._packetLength);
      }

      /** @type {BigInt[]} */
      let words;
      if (this.OutputSize === 16) words = st.finalize128();
      else if (this.OutputSize === 32) words = st.finalize256();
      else words = st.finalize64();

      /** @type {uint8[]} */
      const out = [];
      for (let i = 0; i < words.length; i++) writeLE64(words[i], out);
      return out;
    }

    /**
     * Hash a complete message in one operation
     * @param {uint8[]} message - Message to hash as byte array
     * @returns {uint8[]} Hash digest as byte array
     */
    Hash(message) {
      this.Init();
      this.Update(message);
      return this.Final();
    }

    /**
     * Install the 256-bit key.
     * @param {uint8[]} key - 32 key bytes
     * @returns {boolean} Always true
     */
    KeySetup(key) {
      if (!key || key.length !== 32) {
        throw new Error('HighwayHash requires exactly 32-byte (256-bit) key');
      }
      this._key = OpCodes.CopyArray(key);
      this.Init();
      return true;
    }

    /**
     * Select the digest size
     * @param {int32} size - 8, 16 or 32 bytes
     * @returns {void}
     */
    SetOutputSize(size) {
      if (size !== 8 && size !== 16 && size !== 32) {
        throw new Error('HighwayHash supports only 8, 16, or 32 byte output sizes');
      }
      this.OutputSize = size;
    }

    /**
     * Lower-case alias: this is the setter name the test engine looks for when a
     * vector carries an "outputSize" property.
     * @param {int32} size - 8, 16 or 32 bytes
     * @returns {void}
     */
    setOutputSize(size) {
      this.SetOutputSize(size);
    }

    /**
     * Feed method required by test suite - processes input data
     * @param {uint8[]} data - Input data as byte array
     */
    Feed(data) {
      if (!this._state) this.Init();
      this.Update(data);
    }

    /**
     * Result method required by test suite - returns final hash
     * @returns {uint8[]} Hash digest as byte array
     */
    Result() {
      return this.Final();
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new HighwayHashAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { HighwayHashAlgorithm, HighwayHashAlgorithmInstance };
}));
